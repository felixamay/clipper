import { describe, expect, it } from 'vitest';
import {
  bracketWinner,
  buildRoundRobin,
  buildSingleElim,
  nextBracketMatch,
  nextRobinMatch,
  recordBracketGame,
  recordRobinGame,
  robinWinners,
  seriesOutcome,
  standings,
} from './tournament';

describe('tournament builder', () => {
  it('does not cap the field at 8', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `p${index}`);
    const slots = buildSingleElim(ids);
    const first = slots.filter((slot) => slot.round === 0);
    expect(first).toHaveLength(8);
    expect(first.filter((slot) => slot.bye)).toHaveLength(6);
    expect(first.filter((slot) => !slot.bye)).toHaveLength(2);
    expect(nextBracketMatch(slots)?.a).toBeTruthy();
    expect(buildSingleElim(Array.from({ length: 20 }, (_, index) => `p${index}`)).length).toBeGreaterThan(8);
  });

  it('gives a three-player bracket one opening match and a final', () => {
    const slots = buildSingleElim(['a', 'b', 'c']);
    const opening = nextBracketMatch(slots);
    expect(opening).toBeTruthy();
    expect([opening!.a, opening!.b].sort()).toEqual(['b', 'c']);
    const played = recordBracketGame(
      slots.map((slot) =>
        slot.id === opening!.id ? { ...slot, whiteId: opening!.a, blackId: opening!.b } : slot,
      ),
      opening!.id,
      'white',
      1,
    );
    const final = nextBracketMatch(played);
    expect(final?.round).toBe(1);
    expect([final?.a, final?.b].sort()).toEqual(['a', opening!.a].sort());
  });

  it('splits a tied series and uses a tiebreak only to advance', () => {
    expect(seriesOutcome(['white', 'black'])).toBe('split');
    expect(seriesOutcome(['white', 'draw'])).toBe('white');
    let slots = buildSingleElim(['a', 'b']).map((slot, index) =>
      index === 0 ? { ...slot, whiteId: 'a', blackId: 'b' } : slot,
    );
    slots = recordBracketGame(slots, slots[0].id, 'white', 2);
    expect(slots[0].winner).toBeNull();
    slots = recordBracketGame(slots, slots[0].id, 'black', 2);
    expect(slots[0].winner).toBeNull();
    expect(bracketWinner(slots)).toBeNull();
    slots = recordBracketGame(slots, slots[0].id, 'black', 2);
    expect(slots[0].winner).toBe('b');
    expect(bracketWinner(slots)).toBe('b');
  });

  it('lets a round robin split and crowns the leader from the results', () => {
    const ids = ['a', 'b', 'c'];
    let matches = buildRoundRobin(ids, () => false);
    expect(matches).toHaveLength(3);
    const first = nextRobinMatch(matches)!;
    matches = recordRobinGame(matches, first.id, 'white', 2);
    matches = recordRobinGame(matches, first.id, 'black', 2);
    expect(matches.find((match) => match.id === first.id)?.split).toBe(true);
    for (const match of [...matches]) {
      if (match.done) continue;
      const result = match.whiteId === 'a' ? 'white' : 'black';
      matches = recordRobinGame(matches, match.id, result, 1);
    }
    const table = standings(ids, matches);
    expect(table[0].id).toBe('a');
    expect(robinWinners(ids, matches)).toEqual(['a']);
  });
});
