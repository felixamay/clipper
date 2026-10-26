import { Board, Color, Move } from '../engine/board';

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

let worker: Worker | null = null;
let sequence = 1;
const pending = new Map<number, (move: Move | null) => void>();

function ensure(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<{ id: number; move: Move | null }>) => {
    const resolve = pending.get(event.data.id);
    pending.delete(event.data.id);
    resolve?.(event.data.move);
  };
  return worker;
}

export function requestMove(job: SearchJob): Promise<Move | null> {
  const id = sequence++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ensure().postMessage({ ...job, id });
  });
}

export function stopSearch(): void {
  worker?.terminate();
  worker = null;
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
}
