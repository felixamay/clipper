import { GameResult } from '../engine/game';
import { ScriptName } from './scripts';
import {
  BracketMatch,
  GameWinner,
  RobinMatch,
  assignColors,
  bracketWinner,
  buildRoundRobin,
  buildSingleElim,
  nextBracketMatch,
  nextRobinMatch,
  recordBracketGame,
  recordRobinGame,
  robinWinners,
  roundLabel,
  seriesOutcome,
} from '../tournament/tournament';

export interface PlayEvent {
  mode: 'casual' | 'exhibition' | 'single' | 'robin';
  gamesPerMatch: number;
  script: ScriptName | null;
  players: string[];
  bracket: BracketMatch[] | null;
  robin: RobinMatch[] | null;
  matchId: string | null;
  whiteId: string;
  blackId: string;
  seriesGames: GameWinner[];
  over: boolean;
  champions: string[];
  lastResult: GameResult | null;
  lastDetail: string;
}

export interface Cue {
  key: string;
  whiteId: string;
  blackId: string;
  script: ScriptName | null;
  title: string;
  detail: string;
  score: string;
  tiebreak: boolean;
}

function scoreLine(games: GameWinner[]): string {
  if (games.length === 0) return 'First game of the match';
  let white = 0;
  let black = 0;
  let draws = 0;
  for (const game of games) {
    if (game === 'white') white++;
    else if (game === 'black') black++;
    else draws++;
  }
  const drawText = draws ? `, ${draws} draw${draws === 1 ? '' : 's'}` : '';
  return `Series ${white}–${black}${drawText}`;
}

function blank(
  partial: Omit<PlayEvent, 'over' | 'champions' | 'lastResult' | 'lastDetail' | 'seriesGames'> & {
    seriesGames?: GameWinner[];
  },
): PlayEvent {
  return {
    ...partial,
    seriesGames: partial.seriesGames ?? [],
    over: false,
    champions: [],
    lastResult: null,
    lastDetail: '',
  };
}

export function createCasual(whiteId: string, blackId: string, script: ScriptName | null): PlayEvent {
  return blank({
    mode: 'casual',
    gamesPerMatch: 1,
    script,
    players: [whiteId, blackId],
    bracket: null,
    robin: null,
    matchId: null,
    whiteId,
    blackId,
  });
}

export function createExhibition(whiteId: string, blackId: string, games: number): PlayEvent {
  return blank({
    mode: 'exhibition',
    gamesPerMatch: Math.max(1, Math.min(21, games)),
    script: null,
    players: [whiteId, blackId],
    bracket: null,
    robin: null,
    matchId: null,
    whiteId,
    blackId,
  });
}

export function createSingle(ids: string[], games: number, swap: boolean): PlayEvent {
  let bracket = buildSingleElim(ids);
  const opening = nextBracketMatch(bracket);
  if (!opening || !opening.a || !opening.b) {
    throw new Error('Could not seat a bracket.');
  }
  const colored = assignColors(opening, swap);
  bracket = bracket.map((slot) => (slot.id === colored.id ? colored : slot));
  return blank({
    mode: 'single',
    gamesPerMatch: Math.max(1, Math.min(21, games)),
    script: null,
    players: ids,
    bracket,
    robin: null,
    matchId: colored.id,
    whiteId: colored.whiteId!,
    blackId: colored.blackId!,
  });
}

export function createRobin(ids: string[], games: number, swap: (index: number) => boolean): PlayEvent {
  const robin = buildRoundRobin(ids, swap);
  const opening = robin[0];
  return blank({
    mode: 'robin',
    gamesPerMatch: Math.max(1, Math.min(21, games)),
    script: null,
    players: ids,
    bracket: null,
    robin,
    matchId: opening?.id ?? null,
    whiteId: opening?.whiteId ?? ids[0],
    blackId: opening?.blackId ?? ids[1],
  });
}

export function currentCue(event: PlayEvent): Cue | null {
  if (event.over) return null;
  if (event.mode === 'single' && event.bracket && event.matchId) {
    const match = event.bracket.find((slot) => slot.id === event.matchId);
    if (!match?.whiteId || !match.blackId) return null;
    const maxRound = event.bracket.reduce((max, slot) => Math.max(max, slot.round), 0);
    const tiebreak = match.games.length >= event.gamesPerMatch && seriesOutcome(match.games) === 'split' && !match.winner;
    const number = tiebreak ? match.tiebreaks.length + 1 : match.games.length + 1;
    return {
      key: `${match.id}-${match.games.length}-${match.tiebreaks.length}`,
      whiteId: match.whiteId,
      blackId: match.blackId,
      script: null,
      title: roundLabel(match.round, maxRound),
      detail: tiebreak ? `Tiebreak game ${number}` : `Game ${number} of ${event.gamesPerMatch}`,
      score: scoreLine(match.games),
      tiebreak,
    };
  }
  if (event.mode === 'robin' && event.robin && event.matchId) {
    const match = event.robin.find((item) => item.id === event.matchId);
    if (!match) return null;
    return {
      key: `${match.id}-${match.games.length}`,
      whiteId: match.whiteId,
      blackId: match.blackId,
      script: null,
      title: 'Round robin',
      detail: `Game ${match.games.length + 1} of ${event.gamesPerMatch}`,
      score: scoreLine(match.games),
      tiebreak: false,
    };
  }
  const tiebreak = false;
  return {
    key: `series-${event.seriesGames.length}`,
    whiteId: event.whiteId,
    blackId: event.blackId,
    script: event.seriesGames.length === 0 ? event.script : null,
    title: event.mode === 'exhibition' ? 'Exhibition' : 'Match',
    detail:
      event.gamesPerMatch === 1 ? 'Single game' : `Game ${event.seriesGames.length + 1} of ${event.gamesPerMatch}`,
    score: scoreLine(event.seriesGames),
    tiebreak,
  };
}

function finishSeries(whiteId: string, blackId: string, games: GameWinner[]): { overText: string; champions: string[] } {
  const outcome = seriesOutcome(games);
  if (outcome === 'split') return { overText: 'The series is split.', champions: [] };
  const winner = outcome === 'white' ? whiteId : blackId;
  return { overText: '', champions: [winner] };
}

export function pushResult(event: PlayEvent, result: GameWinner, detail: string): PlayEvent {
  const base = { ...event, lastResult: result, lastDetail: detail };
  if (event.mode === 'single' && event.bracket && event.matchId) {
    const bracket = recordBracketGame(event.bracket, event.matchId, result, event.gamesPerMatch);
    const match = bracket.find((slot) => slot.id === event.matchId);
    if (match && !match.winner) return { ...base, bracket };
    const upcoming = nextBracketMatch(bracket);
    if (!upcoming || !upcoming.a || !upcoming.b) {
      const winner = bracketWinner(bracket);
      return { ...base, bracket, over: true, champions: winner ? [winner] : [], matchId: null };
    }
    const colored = assignColors(upcoming, Math.random() < 0.5);
    return {
      ...base,
      bracket: bracket.map((slot) => (slot.id === colored.id ? colored : slot)),
      matchId: colored.id,
      whiteId: colored.whiteId!,
      blackId: colored.blackId!,
    };
  }
  if (event.mode === 'robin' && event.robin && event.matchId) {
    const robin = recordRobinGame(event.robin, event.matchId, result, event.gamesPerMatch);
    const match = robin.find((item) => item.id === event.matchId);
    if (match && !match.done) return { ...base, robin };
    const upcoming = nextRobinMatch(robin);
    if (!upcoming) {
      return { ...base, robin, over: true, champions: robinWinners(event.players, robin), matchId: null };
    }
    return {
      ...base,
      robin,
      matchId: upcoming.id,
      whiteId: upcoming.whiteId,
      blackId: upcoming.blackId,
    };
  }
  const seriesGames = event.seriesGames.concat(result);
  if (seriesGames.length < event.gamesPerMatch) return { ...base, seriesGames };
  const done = finishSeries(event.whiteId, event.blackId, seriesGames);
  return { ...base, seriesGames, over: true, champions: done.champions };
}
