export type PaceName = 'slow' | 'normal' | 'fast';

// think is the range a person sits over an ordinary position; search is what the engine actually gets.
export const PACE: Record<PaceName, { think: [number, number]; search: number; anim: number; gap: number }> = {
  slow: { think: [9000, 26000], search: 1300, anim: 2.6, gap: 6000 },
  normal: { think: [5000, 15000], search: 800, anim: 1.8, gap: 4000 },
  fast: { think: [1600, 4500], search: 450, anim: 0.8, gap: 1500 },
};

export interface Position {
  legal: number;
  captures: boolean;
  ply: number;
}

// People play forced moves and opening moves quickly and slow down when there is a lot to weigh.
export function humanThinkMs(pace: PaceName, position: Position, random: () => number = Math.random): number {
  const [low, high] = PACE[pace].think;
  if (position.legal <= 1) return low * (0.25 + random() * 0.25);
  const busy = Math.min(1, (position.legal - 2) / 12);
  let base = low + (high - low) * (0.2 + 0.55 * busy + 0.25 * random());
  if (position.ply < 6) base *= 0.45;
  else if (position.ply < 14) base *= 0.75;
  if (position.captures) base *= 1.15;
  if (random() < 0.12) base *= 1.6;
  return Math.round(base);
}

export function waitRemaining(
  started: number,
  total: number,
  cancelled: () => boolean,
  paused: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    let remaining = Math.max(0, total - (performance.now() - started));
    let last = performance.now();
    const step = () => {
      if (cancelled()) {
        resolve();
        return;
      }
      const now = performance.now();
      if (!paused()) remaining -= now - last;
      last = now;
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    step();
  });
}
