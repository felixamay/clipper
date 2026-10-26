import { Board, Color, Move } from '../engine/board';
import { chooseMove } from '../engine/search';

export interface SearchJob {
  board: Board;
  turn: Color;
  depth: number;
  noise: number;
  salt: number;
  timeMs: number;
  noProgress: number;
  seen: Array<[string, number]>;
}

/** How long past its own time budget a search may take before the page stops waiting for the worker. */
const GRACE_MS = 4000;

// One worker for the whole visit: made once and kept, so a later game never has to fetch it again
// (a dropped connection would otherwise leave that game waiting on a worker that never starts).
let worker: Worker | null = null;
let workerFailed = false;
let sequence = 1;
const pending = new Map<number, { job: SearchJob; resolve: (move: Move | null) => void; timer: number }>();

/** The same search, run here on the page; used whenever the worker cannot answer. */
function searchHere(job: SearchJob): Move | null {
  const seen = new Map(job.seen.map(([key, count]) => [BigInt(key), count]));
  return chooseMove(job.board.slice(), job.turn, { depth: job.depth, noise: job.noise, salt: job.salt }, job.timeMs, {
    noProgress: job.noProgress,
    seen,
  });
}

function settle(id: number, move: Move | null): void {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  window.clearTimeout(entry.timer);
  entry.resolve(move);
}

/** Give up on the worker and answer everything still waiting from here instead. */
function abandonWorker(reason: unknown): void {
  console.error('Move search worker failed; searching on the page instead.', reason);
  worker?.terminate();
  worker = null;
  workerFailed = true;
  for (const [id, entry] of [...pending]) settle(id, searchHere(entry.job));
}

function ensure(): Worker | null {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    abandonWorker(error);
    return null;
  }
  worker.onmessage = (event: MessageEvent<{ id: number; move: Move | null }>) => settle(event.data.id, event.data.move);
  worker.onerror = (event) => abandonWorker(event.message || event);
  return worker;
}

export function requestMove(job: SearchJob): Promise<Move | null> {
  const id = sequence++;
  return new Promise((resolve) => {
    const target = ensure();
    if (!target) {
      resolve(searchHere(job));
      return;
    }
    // A worker that never answers must not stall the game.
    const timer = window.setTimeout(() => abandonWorker(new Error('no answer in time')), job.timeMs + GRACE_MS);
    pending.set(id, { job, resolve, timer });
    target.postMessage({ ...job, id });
  });
}

/** Stop waiting for any search in progress; the worker itself stays for the next game. */
export function stopSearch(): void {
  for (const id of [...pending.keys()]) settle(id, null);
}
