import { Board, Color, Move, countPieces, initialBoard, isKing, opponent } from './board';
import { positionKey } from './hash';
import { legalMoves, applyMove } from './moves';

export type GameResult = 'white' | 'black' | 'draw';

export interface Status {
  kind: 'playing' | 'win' | 'draw';
  winner?: Color;
  reason?: 'no-moves' | 'no-pieces' | 'repetition' | 'no-progress';
}

export interface GameState {
  board: Board;
  turn: Color;
  noProgress: number;
  seen: Map<bigint, number>;
  status: Status;
}

function judge(board: Board, turn: Color, noProgress: number, seen: Map<bigint, number>): Status {
  const key = positionKey(board, turn);
  if ((seen.get(key) ?? 0) >= 3) return { kind: 'draw', reason: 'repetition' };
  if (noProgress >= 50) return { kind: 'draw', reason: 'no-progress' };
  if (legalMoves(board, turn).length === 0) {
    const winner = opponent(turn);
    const reason = countPieces(board, turn) === 0 ? 'no-pieces' : 'no-moves';
    return { kind: 'win', winner, reason };
  }
  return { kind: 'playing' };
}

export function startGame(board: Board = initialBoard(), turn: Color = 'white'): GameState {
  const seen = new Map<bigint, number>();
  seen.set(positionKey(board, turn), 1);
  return {
    board,
    turn,
    noProgress: 0,
    seen,
    status: judge(board, turn, 0, seen),
  };
}

export function afterMove(state: GameState, move: Move): GameState {
  const moving = state.board[move.path[0]];
  const board = applyMove(state.board, move);
  const dest = move.path[move.path.length - 1];
  const promoted = isKing(board[dest]) && !isKing(moving);
  const noProgress = move.captures.length > 0 || promoted ? 0 : state.noProgress + 1;
  const turn = opponent(state.turn);
  const seen = new Map(state.seen);
  const key = positionKey(board, turn);
  seen.set(key, (seen.get(key) ?? 0) + 1);
  return { board, turn, noProgress, seen, status: judge(board, turn, noProgress, seen) };
}

export function resultOf(state: GameState): GameResult | null {
  if (state.status.kind === 'draw') return 'draw';
  if (state.status.kind === 'win') return state.status.winner ?? null;
  return null;
}
