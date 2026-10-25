export type PaceName = 'slow' | 'normal' | 'fast';

export const PACE: Record<PaceName, { think: number; anim: number; gap: number }> = {
  slow: { think: 1300, anim: 1.75, gap: 3800 },
  normal: { think: 800, anim: 1, gap: 2400 },
  fast: { think: 450, anim: 0.48, gap: 1200 },
};

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
