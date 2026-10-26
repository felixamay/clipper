import { describe, expect, it } from 'vitest';
import { PACE, humanThinkMs } from './pace';

const fixed = (value: number) => () => value;

describe('human thinking time', () => {
  it('plays a forced move quickly', () => {
    const forced = humanThinkMs('normal', { legal: 1, captures: true, ply: 30 }, fixed(0.5));
    expect(forced).toBeLessThan(PACE.normal.think[0]);
  });

  it('takes longer over a busy middlegame than over the opening', () => {
    const opening = humanThinkMs('normal', { legal: 9, captures: false, ply: 2 }, fixed(0.5));
    const middle = humanThinkMs('normal', { legal: 9, captures: false, ply: 30 }, fixed(0.5));
    expect(middle).toBeGreaterThan(opening);
  });

  it('is slower at the slow pace', () => {
    const position = { legal: 8, captures: false, ply: 20 };
    expect(humanThinkMs('slow', position, fixed(0.5))).toBeGreaterThan(humanThinkMs('normal', position, fixed(0.5)));
  });
});
