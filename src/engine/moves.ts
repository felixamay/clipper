import {
  BLACK_STEPS,
  Board,
  EMPTY,
  KING_RAYS,
  MAN_JUMPS,
  Move,
  WHITE_STEPS,
  colorOf,
  opponent,
  promoteIfNeeded,
} from './board';

export interface Undo {
  from: number;
  dest: number;
  piece: number;
  captures: { at: number; piece: number }[];
}

function pushLeaf(found: Move[], path: number[], captured: number[]): void {
  if (path.length > 1) found.push({ path: path.slice(), captures: captured.slice() });
}

function manCaptures(
  board: Board,
  from: number,
  piece: number,
  path: number[],
  captured: number[],
  found: Move[],
): void {
  const foe = opponent(colorOf(piece)!);
  let extended = false;
  const jumps = MAN_JUMPS[from];
  for (let i = 0; i < jumps.length; i++) {
    const { mid, to } = jumps[i];
    if (board[to] !== EMPTY) continue;
    const victim = board[mid];
    if (colorOf(victim) !== foe) continue;
    if (captured.includes(mid)) continue;
    extended = true;
    board[from] = EMPTY;
    board[to] = piece;
    path.push(to);
    captured.push(mid);
    manCaptures(board, to, piece, path, captured, found);
    captured.pop();
    path.pop();
    board[to] = EMPTY;
    board[from] = piece;
  }
  if (!extended) pushLeaf(found, path, captured);
}

function kingCaptures(
  board: Board,
  from: number,
  piece: number,
  path: number[],
  captured: number[],
  found: Move[],
): void {
  const foe = opponent(colorOf(piece)!);
  let extended = false;
  const rays = KING_RAYS[from];
  for (let d = 0; d < rays.length; d++) {
    const ray = rays[d];
    let cursor = 0;
    while (cursor < ray.length && board[ray[cursor]] === EMPTY) cursor++;
    if (cursor >= ray.length) continue;
    const mid = ray[cursor];
    const victim = board[mid];
    if (colorOf(victim) !== foe) continue;
    if (captured.includes(mid)) continue;
    for (let land = cursor + 1; land < ray.length; land++) {
      const to = ray[land];
      if (board[to] !== EMPTY) break;
      extended = true;
      board[from] = EMPTY;
      board[to] = piece;
      path.push(to);
      captured.push(mid);
      kingCaptures(board, to, piece, path, captured, found);
      captured.pop();
      path.pop();
      board[to] = EMPTY;
      board[from] = piece;
    }
  }
  if (!extended) pushLeaf(found, path, captured);
}

export function captureMoves(board: Board, color: 'white' | 'black'): Move[] {
  const found: Move[] = [];
  for (let s = 0; s < board.length; s++) {
    const piece = board[s];
    if (colorOf(piece) !== color) continue;
    if (piece === 2 || piece === 4) kingCaptures(board, s, piece, [s], [], found);
    else manCaptures(board, s, piece, [s], [], found);
  }
  return found;
}

export function quietMoves(board: Board, color: 'white' | 'black'): Move[] {
  const moves: Move[] = [];
  for (let s = 0; s < board.length; s++) {
    const piece = board[s];
    if (colorOf(piece) !== color) continue;
    if (piece === 2 || piece === 4) {
      const rays = KING_RAYS[s];
      for (let d = 0; d < rays.length; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          if (board[ray[i]] !== EMPTY) break;
          moves.push({ path: [s, ray[i]], captures: [] });
        }
      }
    } else {
      const steps = color === 'white' ? WHITE_STEPS[s] : BLACK_STEPS[s];
      for (let i = 0; i < steps.length; i++) {
        if (board[steps[i]] === EMPTY) moves.push({ path: [s, steps[i]], captures: [] });
      }
    }
  }
  return moves;
}

export function legalMoves(board: Board, color: 'white' | 'black'): Move[] {
  const captures = captureMoves(board, color);
  if (captures.length === 0) return quietMoves(board, color);
  let max = 0;
  for (let i = 0; i < captures.length; i++) {
    if (captures[i].captures.length > max) max = captures[i].captures.length;
  }
  const best: Move[] = [];
  for (let i = 0; i < captures.length; i++) {
    if (captures[i].captures.length === max) best.push(captures[i]);
  }
  return best;
}

export function applyMove(board: Board, move: Move): Board {
  const next = board.slice();
  applyInPlace(next, move);
  return next;
}

export function applyInPlace(board: Board, move: Move): Undo {
  const from = move.path[0];
  const dest = move.path[move.path.length - 1];
  const piece = board[from];
  const captures = move.captures.map((at) => ({ at, piece: board[at] }));
  board[from] = EMPTY;
  for (let i = 0; i < captures.length; i++) board[captures[i].at] = EMPTY;
  board[dest] = promoteIfNeeded(piece, dest);
  return { from, dest, piece, captures };
}

export function undoInPlace(board: Board, undo: Undo): void {
  board[undo.dest] = EMPTY;
  for (let i = 0; i < undo.captures.length; i++) {
    board[undo.captures[i].at] = undo.captures[i].piece;
  }
  board[undo.from] = undo.piece;
}

export function sameMove(a: Move, b: Move): boolean {
  if (a.path.length !== b.path.length || a.captures.length !== b.captures.length) return false;
  for (let i = 0; i < a.path.length; i++) if (a.path[i] !== b.path[i]) return false;
  for (let i = 0; i < a.captures.length; i++) if (a.captures[i] !== b.captures[i]) return false;
  return true;
}
