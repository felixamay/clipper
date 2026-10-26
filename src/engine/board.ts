export const SIZE = 10;
export const EMPTY = 0;
export const WHITE_MAN = 1;
export const WHITE_KING = 2;
export const BLACK_MAN = 3;
export const BLACK_KING = 4;

export type Color = 'white' | 'black';
export type Board = Uint8Array;

export interface Move {
  path: number[];
  captures: number[];
}

export const rowOf = (s: number) => (s / SIZE) | 0;
export const colOf = (s: number) => s % SIZE;
export const sq = (row: number, col: number) => row * SIZE + col;

export function isDark(row: number, col: number): boolean {
  return ((row + col) & 1) === 1;
}

export function isKing(piece: number): boolean {
  return piece === WHITE_KING || piece === BLACK_KING;
}

export function colorOf(piece: number): Color | null {
  if (piece === WHITE_MAN || piece === WHITE_KING) return 'white';
  if (piece === BLACK_MAN || piece === BLACK_KING) return 'black';
  return null;
}

export function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function cloneBoard(board: Board): Board {
  return board.slice();
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export const MAN_JUMPS: { mid: number; to: number }[][] = [];
export const KING_RAYS: number[][][] = [];
export const WHITE_STEPS: number[][] = [];
export const BLACK_STEPS: number[][] = [];

for (let s = 0; s < SIZE * SIZE; s++) {
  const row = rowOf(s);
  const col = colOf(s);
  const jumps: { mid: number; to: number }[] = [];
  const rays: number[][] = [];
  const white: number[] = [];
  const black: number[] = [];
  if (isDark(row, col)) {
    for (const [dr, dc] of DIRS) {
      const ray: number[] = [];
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        ray.push(sq(r, c));
        r += dr;
        c += dc;
      }
      rays.push(ray);
      const midR = row + dr;
      const midC = col + dc;
      const toR = row + dr * 2;
      const toC = col + dc * 2;
      if (toR >= 0 && toR < SIZE && toC >= 0 && toC < SIZE) {
        jumps.push({ mid: sq(midR, midC), to: sq(toR, toC) });
      }
      const stepR = row + dr;
      const stepC = col + dc;
      if (stepR >= 0 && stepR < SIZE && stepC >= 0 && stepC < SIZE) {
        const dest = sq(stepR, stepC);
        if (dr > 0) white.push(dest);
        else black.push(dest);
      }
    }
  }
  MAN_JUMPS.push(jumps);
  KING_RAYS.push(rays);
  WHITE_STEPS.push(white);
  BLACK_STEPS.push(black);
}

export function squareName(square: number): string {
  return `${'abcdefghij'[colOf(square)]}${rowOf(square) + 1}`;
}

export function describeMove(move: Move): string {
  const from = squareName(move.path[0]);
  const to = squareName(move.path[move.path.length - 1]);
  if (move.captures.length === 0) return `${from}–${to}`;
  const taken = move.captures.map(squareName).join(' ');
  return `${from}×${to} taking ${taken}`;
}

export function initialBoard(): Board {
  const board = new Uint8Array(SIZE * SIZE);
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (!isDark(row, col)) continue;
      if (row <= 3) board[sq(row, col)] = WHITE_MAN;
      else if (row >= 6) board[sq(row, col)] = BLACK_MAN;
    }
  }
  return board;
}

export function countPieces(board: Board, color: Color): number {
  let n = 0;
  for (let i = 0; i < board.length; i++) {
    if (colorOf(board[i]) === color) n++;
  }
  return n;
}

export function promoteIfNeeded(piece: number, dest: number): number {
  if (isKing(piece)) return piece;
  const row = rowOf(dest);
  if (piece === WHITE_MAN && row === SIZE - 1) return WHITE_KING;
  if (piece === BLACK_MAN && row === 0) return BLACK_KING;
  return piece;
}
