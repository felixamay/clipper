import { Board, Color } from './board';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function rand64(rng: () => number): bigint {
  return (BigInt(rng()) << 32n) | BigInt(rng());
}

const rng = makeRng(0x0a17d);
const ZOB_PIECE: bigint[][] = [];
for (let s = 0; s < 100; s++) {
  ZOB_PIECE.push([0n, rand64(rng), rand64(rng), rand64(rng), rand64(rng)]);
}
const ZOB_TURN = rand64(rng);
const ZOB_PROGRESS = Array.from({ length: 64 }, () => rand64(rng));

export function positionKey(board: Board, turn: Color): bigint {
  let hash = turn === 'black' ? ZOB_TURN : 0n;
  for (let i = 0; i < board.length; i++) {
    const piece = board[i];
    if (piece) hash ^= ZOB_PIECE[i][piece];
  }
  return hash;
}

export function ttKey(board: Board, turn: Color, noProgress: number): bigint {
  return positionKey(board, turn) ^ ZOB_PROGRESS[Math.min(63, noProgress)];
}
