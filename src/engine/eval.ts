import { BLACK_KING, BLACK_MAN, Board, Color, WHITE_KING, WHITE_MAN } from './board';
import { positionKey } from './hash';

function center(row: number, col: number): number {
  const dr = Math.abs(row * 2 - 9);
  const dc = Math.abs(col * 2 - 9);
  return 20 - (dr + dc);
}

export function evaluate(board: Board, turn: Color, noise: number, salt: number): number {
  let white = 0;
  let black = 0;
  for (let s = 0; s < board.length; s++) {
    const piece = board[s];
    if (!piece) continue;
    const row = (s / 10) | 0;
    const col = s % 10;
    const place = center(row, col);
    if (piece === WHITE_MAN) white += 100 + row * 5 + place;
    else if (piece === BLACK_MAN) black += 100 + (9 - row) * 5 + place;
    else if (piece === WHITE_KING) white += 310 + place;
    else if (piece === BLACK_KING) black += 310 + place;
  }
  let score = white - black;
  if (turn === 'black') score = -score;
  if (noise > 0) {
    const span = noise * 2 + 1;
    const mixed = positionKey(board, turn) ^ BigInt(salt >>> 0);
    const wobble = Number(mixed & 0xffffn) % span - noise;
    score += wobble;
  }
  return score;
}
