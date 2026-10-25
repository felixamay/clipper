import { Board, Color, Move, isKing, opponent } from './board';
import { evaluate } from './eval';
import { positionKey, ttKey } from './hash';
import { Undo, applyInPlace, legalMoves, undoInPlace } from './moves';

export interface Strength {
  depth: number;
  noise: number;
  salt: number;
}

export interface SearchContext {
  noProgress?: number;
  seen?: Map<bigint, number>;
}

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const MATE = 25000;

interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  move: Move | null;
}

class TimeUp extends Error {
  constructor() {
    super('time');
    this.name = 'TimeUp';
  }
}

function moveKey(move: Move, salt: number): number {
  let hash = salt >>> 0;
  for (let i = 0; i < move.path.length; i++) {
    hash = Math.imul(hash ^ move.path[i], 16777619);
  }
  for (let i = 0; i < move.captures.length; i++) {
    hash = Math.imul(hash ^ (move.captures[i] << 1), 16777619);
  }
  return hash >>> 0;
}

function childProgress(board: Board, move: Move, noProgress: number): number {
  const moving = board[move.path[0]];
  const dest = move.path[move.path.length - 1];
  const row = (dest / 10) | 0;
  const promotes =
    !isKing(moving) && ((moving === 1 && row === 9) || (moving === 3 && row === 0));
  if (move.captures.length > 0 || promotes) return 0;
  return noProgress + 1;
}

interface Ctx {
  deadline: number;
  noise: number;
  salt: number;
  seen: Map<bigint, number>;
  tt: Map<bigint, TTEntry>;
  nodes: number;
}

function negamax(
  board: Board,
  turn: Color,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  noProgress: number,
  qLeft: number,
  ctx: Ctx,
): number {
  ctx.nodes += 1;
  if (performance.now() > ctx.deadline) throw new TimeUp();
  if (noProgress >= 50) return 0;
  const key = positionKey(board, turn);
  const repetitions = ctx.seen.get(key) ?? 0;
  if (repetitions >= 3) return 0;

  const moves = legalMoves(board, turn);
  if (moves.length === 0) return -30000 + ply;

  const capturing = moves[0].captures.length > 0;
  if (depth <= 0 && (!capturing || qLeft <= 0)) {
    return evaluate(board, turn, ctx.noise, ctx.salt);
  }

  const storeKey = ttKey(board, turn, noProgress);
  const entry = ctx.tt.get(storeKey);
  let ordered = moves;
  if (entry?.move) {
    const hint = entry.move;
    const hinted = moves.findIndex((move) => samePath(move, hint));
    if (hinted > 0) {
      ordered = [moves[hinted], ...moves.slice(0, hinted), ...moves.slice(hinted + 1)];
    }
  }
  if (entry && entry.depth >= depth && Math.abs(entry.score) < MATE) {
    if (entry.flag === EXACT) return entry.score;
    if (entry.flag === LOWER && entry.score >= beta) return entry.score;
    if (entry.flag === UPPER && entry.score <= alpha) return entry.score;
  }

  const nextDepth = depth <= 0 ? 0 : depth - 1;
  const nextQ = depth <= 0 ? qLeft - 1 : qLeft;
  const alphaOrig = alpha;
  let best = -Infinity;
  let bestMove: Move | null = null;

  for (let i = 0; i < ordered.length; i++) {
    const move = ordered[i];
    const progress = childProgress(board, move, noProgress);
    const undo = applyInPlace(board, move);
    const childKey = positionKey(board, opponent(turn));
    const seenBefore = ctx.seen.get(childKey) ?? 0;
    ctx.seen.set(childKey, seenBefore + 1);
    let score = 0;
    try {
      score = -negamax(
        board,
        opponent(turn),
        nextDepth,
        -beta,
        -alpha,
        ply + 1,
        progress,
        nextQ,
        ctx,
      );
    } finally {
      if (seenBefore === 0) ctx.seen.delete(childKey);
      else ctx.seen.set(childKey, seenBefore);
      undoInPlace(board, undo);
    }
    if (score > best) {
      best = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  if (Math.abs(best) < MATE) {
    let flag = EXACT;
    if (best <= alphaOrig) flag = UPPER;
    else if (best >= beta) flag = LOWER;
    ctx.tt.set(storeKey, { depth: Math.max(depth, 0), score: best, flag, move: bestMove });
  }
  return best;
}

function samePath(a: Move, b: Move): boolean {
  if (a.path.length !== b.path.length) return false;
  for (let i = 0; i < a.path.length; i++) if (a.path[i] !== b.path[i]) return false;
  return true;
}

export function chooseMove(
  board: Board,
  turn: Color,
  strength: Strength,
  timeMs: number,
  context: SearchContext = {},
): Move | null {
  const moves = legalMoves(board, turn);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const ctx: Ctx = {
    deadline: Number.POSITIVE_INFINITY,
    noise: strength.noise,
    salt: strength.salt,
    seen: new Map(context.seen ?? []),
    tt: new Map(),
    nodes: 0,
  };
  const rootKey = positionKey(board, turn);
  if (!ctx.seen.has(rootKey)) ctx.seen.set(rootKey, 1);

  const noProgress = context.noProgress ?? 0;
  let ordered = moves.slice().sort((a, b) => moveKey(a, strength.salt) - moveKey(b, strength.salt));
  let best = ordered[0];
  const started = performance.now();
  const maxDepth = Math.max(1, strength.depth);
  ctx.deadline = started + timeMs;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (depth > 1 && performance.now() >= ctx.deadline) break;
    try {
      let localBest = ordered[0];
      let localScore = -Infinity;
      for (let i = 0; i < ordered.length; i++) {
        if (performance.now() >= ctx.deadline && (depth > 1 || i > 0)) throw new TimeUp();
        const move = ordered[i];
        const progress = childProgress(board, move, noProgress);
        let undo: Undo | null = null;
        let score = 0;
        const childTurn = opponent(turn);
        try {
          undo = applyInPlace(board, move);
          const childKey = positionKey(board, childTurn);
          const seenBefore = ctx.seen.get(childKey) ?? 0;
          ctx.seen.set(childKey, seenBefore + 1);
          try {
            score = -negamax(board, childTurn, depth - 1, -Infinity, Infinity, 1, progress, 4, ctx);
          } finally {
            if (seenBefore === 0) ctx.seen.delete(childKey);
            else ctx.seen.set(childKey, seenBefore);
          }
        } finally {
          if (undo) undoInPlace(board, undo);
        }
        if (
          score > localScore ||
          (score === localScore && moveKey(move, strength.salt) > moveKey(localBest, strength.salt))
        ) {
          localScore = score;
          localBest = move;
        }
        best = localBest;
      }
      ordered = [best, ...ordered.filter((item) => item !== best)];
    } catch (error) {
      if (error instanceof TimeUp) break;
      throw error;
    }
  }
  return best;
}
