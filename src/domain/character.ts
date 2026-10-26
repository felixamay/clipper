import { PortraitSpec, noiseForDepth } from '../portrait/palette';

export interface RecordBook {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface Character {
  id: string;
  name: string;
  portrait: PortraitSpec;
  photo?: string;
  depth: number;
  noise: number;
  record: RecordBook;
}

export function emptyRecord(): RecordBook {
  return { played: 0, wins: 0, losses: 0, draws: 0 };
}

export function winRate(record: RecordBook): string {
  if (record.played <= 0) return '—';
  return `${Math.round((100 * record.wins) / record.played)}%`;
}

export function saltFromId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * How every player reads the board. Nobody is set up to be stronger than anyone else: each sees
 * as far ahead and misjudges by as much, and those misjudgements land differently every game,
 * so a game is won by the moves made in it.
 */
export const PLAY = { depth: 6, noise: 8 } as const;

export function characterFromDraft(name: string, portrait: PortraitSpec, depth: number): Character {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 28);
  const level = Math.max(3, Math.min(8, Math.round(depth)));
  return {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: clean,
    portrait,
    depth: level,
    noise: noiseForDepth(level),
    record: emptyRecord(),
  };
}
