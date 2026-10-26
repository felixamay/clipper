export type GameWinner = 'white' | 'black' | 'draw';

export interface BracketMatch {
  id: string;
  round: number;
  index: number;
  a: string | null;
  b: string | null;
  winner: string | null;
  bye: boolean;
  games: GameWinner[];
  tiebreaks: GameWinner[];
  whiteId: string | null;
  blackId: string | null;
}

export interface RobinMatch {
  id: string;
  a: string;
  b: string;
  whiteId: string;
  blackId: string;
  games: GameWinner[];
  done: boolean;
  split: boolean;
  winnerId: string | null;
}

export interface Standing {
  id: string;
  matchPoints: number;
  seriesWins: number;
  seriesLosses: number;
  splits: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
}

export function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

export function seriesOutcome(games: GameWinner[]): 'white' | 'black' | 'split' {
  let white = 0;
  let black = 0;
  for (const game of games) {
    if (game === 'white') white++;
    else if (game === 'black') black++;
  }
  if (white > black) return 'white';
  if (black > white) return 'black';
  return 'split';
}

export function arrangeSeeds(ids: string[]): (string | null)[] {
  const size = nextPowerOfTwo(ids.length);
  const byeCount = size - ids.length;
  const players = ids.slice();
  const arranged: (string | null)[] = [];
  for (let i = 0; i < byeCount; i++) arranged.push(players.shift() ?? null, null);
  while (players.length) arranged.push(players.shift() ?? null, players.shift() ?? null);
  while (arranged.length < size) arranged.push(null);
  return arranged.slice(0, size);
}

function propagate(slots: BracketMatch[]): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const slot of slots) {
      if (!slot.winner) continue;
      const next = slots.find(
        (candidate) => candidate.round === slot.round + 1 && candidate.index === Math.floor(slot.index / 2),
      );
      if (!next) continue;
      if (slot.index % 2 === 0) {
        if (next.a !== slot.winner) {
          next.a = slot.winner;
          changed = true;
        }
      } else if (next.b !== slot.winner) {
        next.b = slot.winner;
        changed = true;
      }
    }
  }
}

export function buildSingleElim(ids: string[]): BracketMatch[] {
  const arranged = arrangeSeeds(ids);
  const rounds = Math.round(Math.log2(arranged.length));
  const slots: BracketMatch[] = [];
  for (let round = 0; round < rounds; round++) {
    const count = arranged.length >> (round + 1);
    for (let index = 0; index < count; index++) {
      slots.push({
        id: `r${round}-${index}`,
        round,
        index,
        a: round === 0 ? arranged[index * 2] : null,
        b: round === 0 ? arranged[index * 2 + 1] : null,
        winner: null,
        bye: false,
        games: [],
        tiebreaks: [],
        whiteId: null,
        blackId: null,
      });
    }
  }
  for (const slot of slots) {
    if (slot.round !== 0) continue;
    if (slot.a && !slot.b) {
      slot.winner = slot.a;
      slot.bye = true;
    } else if (slot.b && !slot.a) {
      slot.winner = slot.b;
      slot.bye = true;
    }
  }
  propagate(slots);
  return slots;
}

export function nextBracketMatch(slots: BracketMatch[]): BracketMatch | null {
  const maxRound = slots.reduce((max, slot) => Math.max(max, slot.round), 0);
  for (let round = 0; round <= maxRound; round++) {
    for (const slot of slots) {
      if (slot.round !== round || slot.winner || slot.bye) continue;
      if (slot.a && slot.b) return slot;
    }
  }
  return null;
}

export function assignColors(match: BracketMatch, swap: boolean): BracketMatch {
  if (!match.a || !match.b) return match;
  if (match.whiteId && match.blackId) return match;
  return {
    ...match,
    whiteId: swap ? match.b : match.a,
    blackId: swap ? match.a : match.b,
  };
}

export function recordBracketGame(
  slots: BracketMatch[],
  matchId: string,
  result: GameWinner,
  gamesPerMatch: number,
): BracketMatch[] {
  const next = slots.map((slot) => ({
    ...slot,
    games: slot.games.slice(),
    tiebreaks: slot.tiebreaks.slice(),
  }));
  const match = next.find((slot) => slot.id === matchId);
  if (!match || !match.whiteId || !match.blackId) return next;
  const scheduledDone = match.games.length >= gamesPerMatch;
  if (!scheduledDone) match.games.push(result);
  else match.tiebreaks.push(result);

  const outcome = seriesOutcome(match.games);
  const needsTiebreak = match.games.length >= gamesPerMatch && outcome === 'split';
  if (match.games.length < gamesPerMatch) return next;
  if (needsTiebreak) {
    const last = match.tiebreaks[match.tiebreaks.length - 1];
    if (!last || last === 'draw') return next;
    match.winner = last === 'white' ? match.whiteId : match.blackId;
  } else if (outcome === 'white') match.winner = match.whiteId;
  else if (outcome === 'black') match.winner = match.blackId;
  propagate(next);
  return next;
}

export function bracketWinner(slots: BracketMatch[]): string | null {
  if (slots.length === 0) return null;
  const maxRound = slots.reduce((max, slot) => Math.max(max, slot.round), 0);
  return slots.find((slot) => slot.round === maxRound)?.winner ?? null;
}

export function buildRoundRobin(ids: string[], swap: (index: number) => boolean): RobinMatch[] {
  const matches: RobinMatch[] = [];
  let index = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const flipped = swap(index);
      matches.push({
        id: `m${index}`,
        a: ids[i],
        b: ids[j],
        whiteId: flipped ? ids[j] : ids[i],
        blackId: flipped ? ids[i] : ids[j],
        games: [],
        done: false,
        split: false,
        winnerId: null,
      });
      index++;
    }
  }
  return matches;
}

export function recordRobinGame(matches: RobinMatch[], matchId: string, result: GameWinner, gamesPerMatch: number): RobinMatch[] {
  return matches.map((match) => {
    if (match.id !== matchId || match.done) return match;
    const games = match.games.concat(result);
    if (games.length < gamesPerMatch) return { ...match, games };
    const outcome = seriesOutcome(games);
    if (outcome === 'split') {
      return { ...match, games, done: true, split: true, winnerId: null };
    }
    return {
      ...match,
      games,
      done: true,
      split: false,
      winnerId: outcome === 'white' ? match.whiteId : match.blackId,
    };
  });
}

export function nextRobinMatch(matches: RobinMatch[]): RobinMatch | null {
  return matches.find((match) => !match.done) ?? null;
}

export function standings(ids: string[], matches: RobinMatch[]): Standing[] {
  const rows = new Map<string, Standing>();
  for (const id of ids) {
    rows.set(id, {
      id,
      matchPoints: 0,
      seriesWins: 0,
      seriesLosses: 0,
      splits: 0,
      gameWins: 0,
      gameLosses: 0,
      gameDraws: 0,
    });
  }
  for (const match of matches) {
    if (!match.done) continue;
    const white = rows.get(match.whiteId);
    const black = rows.get(match.blackId);
    if (!white || !black) continue;
    for (const game of match.games) {
      if (game === 'white') {
        white.gameWins++;
        black.gameLosses++;
      } else if (game === 'black') {
        black.gameWins++;
        white.gameLosses++;
      } else {
        white.gameDraws++;
        black.gameDraws++;
      }
    }
    if (match.split || !match.winnerId) {
      white.splits++;
      black.splits++;
      white.matchPoints++;
      black.matchPoints++;
    } else if (match.winnerId === white.id) {
      white.seriesWins++;
      black.seriesLosses++;
      white.matchPoints += 2;
    } else {
      black.seriesWins++;
      white.seriesLosses++;
      black.matchPoints += 2;
    }
  }
  return [...rows.values()].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.gameWins !== a.gameWins) return b.gameWins - a.gameWins;
    const diffA = a.gameWins - a.gameLosses;
    const diffB = b.gameWins - b.gameLosses;
    if (diffB !== diffA) return diffB - diffA;
    return a.id.localeCompare(b.id);
  });
}

export function robinWinners(ids: string[], matches: RobinMatch[]): string[] {
  const table = standings(ids, matches);
  if (table.length === 0 || matches.some((match) => !match.done)) return [];
  const top = table[0];
  return table
    .filter(
      (row) =>
        row.matchPoints === top.matchPoints &&
        row.gameWins === top.gameWins &&
        row.gameWins - row.gameLosses === top.gameWins - top.gameLosses,
    )
    .map((row) => row.id);
}

export function roundLabel(round: number, maxRound: number): string {
  const fromEnd = maxRound - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Round ${round + 1}`;
}
