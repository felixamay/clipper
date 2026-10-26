import { Board, Color, Move } from '../engine/board';
import { chooseMove } from '../engine/search';

interface Job {
  id: number;
  board: Uint8Array;
  turn: Color;
  depth: number;
  noise: number;
  salt: number;
  timeMs: number;
  noProgress: number;
  seen: Array<[string, number]>;
}

self.onmessage = (event: MessageEvent<Job>) => {
  const job = event.data;
  const board: Board = new Uint8Array(job.board);
  const seen = new Map(job.seen.map(([key, count]) => [BigInt(key), count]));
  const move = chooseMove(
    board,
    job.turn,
    { depth: job.depth, noise: job.noise, salt: job.salt },
    job.timeMs,
    { noProgress: job.noProgress, seen },
  );
  const payload: { id: number; move: Move | null } = { id: job.id, move };
  self.postMessage(payload);
};
