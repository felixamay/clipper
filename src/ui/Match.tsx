import { RefObject, useEffect, useRef, useState } from 'react';
import { Character, PLAY, saltFromId } from '../domain/character';
import { Cue, PlayEvent, currentCue, pushResult } from '../domain/event';
import { PACE, PaceName, humanThinkMs, waitRemaining } from '../domain/pace';
import { scriptNote, scriptedGame } from '../domain/scripts';
import { getRoster, recordResult, useRoster } from '../domain/storage';
import { Color, describeMove } from '../engine/board';
import { GameState, resultOf, startGame, afterMove } from '../engine/game';
import { legalMoves, sameMove } from '../engine/moves';
import { shirtHex, skinHex } from '../portrait/palette';
import { bodyFor } from '../scene/bodies';
import { SceneHandle } from '../scene/mountScene';
import { BracketMatch, RobinMatch, roundLabel, seriesOutcome, standings } from '../tournament/tournament';
import { requestMove, stopSearch } from '../worker/client';
import { Portrait, photoUrl } from './Portrait';
import { Records } from './Records';

function explain(state: GameState, white: Character, black: Character): string {
  if (state.status.kind === 'draw' && state.status.reason === 'repetition') {
    return 'Draw — the same position came up three times.';
  }
  if (state.status.kind === 'draw') {
    return 'Draw — 25 moves each with no capture and no promotion.';
  }
  const winner = state.status.winner === 'white' ? white.name : black.name;
  if (state.status.reason === 'no-moves') {
    const stuck = state.status.winner === 'white' ? black.name : white.name;
    return `${winner} wins — ${stuck} has no move.`;
  }
  return `${winner} wins.`;
}

function eventHeadline(event: PlayEvent, roster: Character[]): string {
  const name = (id: string) => roster.find((character) => character.id === id)?.name ?? 'Player';
  if (event.mode === 'casual') return event.lastDetail;
  if (event.mode === 'exhibition') {
    if (seriesOutcome(event.seriesGames) === 'split') return `The series is split. ${event.lastDetail}`;
    return event.champions[0] ? `${name(event.champions[0])} takes the exhibition.` : event.lastDetail;
  }
  if (event.champions.length > 1) return `Joint winners: ${event.champions.map(name).join(' and ')}.`;
  if (event.champions[0]) return `${name(event.champions[0])} wins the tournament.`;
  return event.lastDetail;
}

function Bracket({ slots, currentId, roster }: { slots: BracketMatch[]; currentId: string | null; roster: Character[] }) {
  const name = (id: string | null) => roster.find((character) => character.id === id)?.name ?? (id ? 'Player' : '—');
  const maxRound = slots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const rounds = [];
  for (let round = 0; round <= maxRound; round++) rounds.push(round);
  return (
    <div className="bracket">
      {rounds.map((round) => (
        <section key={round}>
          <h3>{roundLabel(round, maxRound)}</h3>
          {slots
            .filter((slot) => slot.round === round)
            .map((slot) => (
              <p key={slot.id} className={slot.id === currentId ? 'match current' : 'match'}>
                {slot.bye ? `${name(slot.winner)} · bye` : `${name(slot.a)} vs ${name(slot.b)}`}
                {slot.winner && !slot.bye ? ` · ${name(slot.winner)}` : ''}
                {slot.games.length ? ` ${slot.games.filter((item) => item === 'white').length}–${slot.games.filter((item) => item === 'black').length}` : ''}
              </p>
            ))}
        </section>
      ))}
    </div>
  );
}

function Table({ matches, players, roster }: { matches: RobinMatch[]; players: string[]; roster: Character[] }) {
  const rows = standings(players, matches);
  const name = (id: string) => roster.find((character) => character.id === id)?.name ?? 'Player';
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>Player</th>
          <th>Pts</th>
          <th>W</th>
          <th>L</th>
          <th>Split</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{name(row.id)}</td>
            <td>{row.matchPoints}</td>
            <td>{row.seriesWins}</td>
            <td>{row.seriesLosses}</td>
            <td>{row.splits}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Match({
  initial,
  sceneRef,
  onExit,
}: {
  initial: PlayEvent;
  sceneRef: RefObject<SceneHandle>;
  onExit: () => void;
}) {
  const [event, setEvent] = useState(initial);
  const [phase, setPhase] = useState<'card' | 'live' | 'over'>(initial.over ? 'over' : 'card');
  const [banner, setBanner] = useState('The board is set');
  const [pace, setPace] = useState<PaceName>('normal');
  const [thinker, setThinker] = useState<{ side: Color; since: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [liveState, setLiveState] = useState<GameState | null>(null);
  const eventRef = useRef(initial);
  const paceRef = useRef(pace);
  const pausedRef = useRef(paused);
  const token = useRef(0);
  const running = useRef(false);
  const beginRef = useRef<() => void>(() => undefined);
  paceRef.current = pace;
  pausedRef.current = paused;
  eventRef.current = event;
  const cue = currentCue(event);
  const rosterNow = useRoster();
  const white = rosterNow.find((character) => character.id === (cue?.whiteId ?? event.whiteId));
  const black = rosterNow.find((character) => character.id === (cue?.blackId ?? event.blackId));

  useEffect(() => {
    sceneRef.current?.setShift(event.mode === 'single' || event.mode === 'robin' ? 0.95 : 0);
    return () => sceneRef.current?.setShift(0);
  }, [event.mode, sceneRef]);

  useEffect(() => {
    if (!cue || !white || !black) return;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setColors(skinHex(white.portrait), skinHex(black.portrait), shirtHex(white.portrait), shirtHex(black.portrait));
    scene.setPlayers(bodyFor(white), bodyFor(black));
    const opening = cue.script ? scriptedGame(cue.script) : startGame();
    scene.reset(opening.board);
    setLiveState(opening);
  }, [cue?.key, sceneRef, white?.id, black?.id]);

  useEffect(() => {
    return () => {
      token.current += 1;
      running.current = false;
      sceneRef.current?.cancel();
      stopSearch();
    };
  }, [sceneRef]);

  const begin = () => {
    if (running.current || phase !== 'card' || !cue || !white || !black) return;
    running.current = true;
    setCountdown(null);
    setPhase('live');
    void run(cue);
  };
  beginRef.current = begin;

  useEffect(() => {
    if (phase !== 'card' || !cue || event.mode === 'casual') {
      setCountdown(null);
      return undefined;
    }
    let left = PACE[paceRef.current].gap;
    let fired = false;
    setCountdown(Math.ceil(left / 1000));
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      left -= 100;
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0 && !fired) {
        fired = true;
        window.clearInterval(timer);
        beginRef.current();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, cue?.key, event.mode]);

  async function run(active: Cue) {
    const my = ++token.current;
    const scene = sceneRef.current;
    if (!scene) return;
    let state = active.script ? scriptedGame(active.script) : startGame();
    const gameSeed = (Math.random() * 2 ** 32) >>> 0;
    scene.reset(state.board);
    setLiveState(state);
    let ply = 0;
    while (state.status.kind === 'playing') {
      if (token.current !== my) return;
      const people = getRoster();
      const player = people.find((character) => character.id === (state.turn === 'white' ? active.whiteId : active.blackId));
      if (!player) return;
      setBanner(`${player.name} is thinking`);
      const options = legalMoves(state.board, state.turn);
      const think = humanThinkMs(paceRef.current, {
        legal: options.length,
        captures: options.some((item) => item.captures.length > 0),
        ply,
      });
      const started = performance.now();
      setThinker({ side: state.turn, since: started });
      const seen = [...state.seen.entries()].map(([key, count]) => [key.toString(), count] as [string, number]);
      const move = await requestMove({
        board: state.board,
        turn: state.turn,
        depth: PLAY.depth,
        noise: PLAY.noise,
        // The same for everyone, but drawn afresh each game, so nobody repeats the same slips.
        salt: (saltFromId(player.id) ^ gameSeed) >>> 0,
        timeMs: PACE[paceRef.current].search,
        noProgress: state.noProgress,
        seen,
      });
      if (token.current !== my) return;
      await waitRemaining(started, think, () => token.current !== my, () => pausedRef.current);
      if (token.current !== my) return;
      const legal = legalMoves(state.board, state.turn);
      const chosen = (move && legal.find((item) => sameMove(item, move))) || legal[0];
      if (!chosen) break;
      setThinker(null);
      setBanner(`${player.name} plays ${describeMove(chosen)}`);
      await scene.playMove(
        chosen,
        state.turn,
        () => PACE[paceRef.current].anim,
        () => pausedRef.current,
      );
      if (token.current !== my) return;
      state = afterMove(state, chosen);
      ply += 1;
      setLiveState(state);
    }
    setThinker(null);
    if (token.current !== my) return;
    const result = resultOf(state);
    running.current = false;
    if (!result) return;
    recordResult(active.whiteId, active.blackId, result);
    const people = getRoster();
    const whitePlayer = people.find((character) => character.id === active.whiteId);
    const blackPlayer = people.find((character) => character.id === active.blackId);
    if (!whitePlayer || !blackPlayer) return;
    const detail = explain(state, whitePlayer, blackPlayer);
    setBanner(detail);
    const next = pushResult(eventRef.current, result, detail);
    eventRef.current = next;
    setEvent(next);
    setPhase(next.over ? 'over' : 'card');
  }

  const showDock = event.mode === 'single' || event.mode === 'robin';
  const headline = event.over ? eventHeadline(event, rosterNow) : banner;

  return (
    <div className={phase === 'live' ? 'overlay' : 'overlay dim'}>
      {showDock && (
        <aside className={phase === 'live' ? 'dock compact' : 'dock'}>
          <h2>{event.mode === 'single' ? 'Bracket' : 'Standings'}</h2>
          {event.bracket && <Bracket slots={event.bracket} currentId={event.matchId} roster={rosterNow} />}
          {event.robin && <Table matches={event.robin} players={event.players} roster={rosterNow} />}
        </aside>
      )}
      {phase !== 'live' && white && black && (
        <div className="card-center">
          <section className="card pregame" data-testid="pregame-card">
            <p className="eyebrow dark">{cue?.title ?? 'Result'}</p>
            <h2>{phase === 'over' ? headline : 'Before they sit'}</h2>
            {cue?.script && <p className="note">{scriptNote(cue.script)}</p>}
            {event.lastDetail && phase === 'card' && <p className="note">{event.lastDetail}</p>}
            {phase === 'over' && <p className="note">{headline}</p>}
            <div className="pair">
              <Seat character={white} side="White · red" />
              <p className="vs">vs</p>
              <Seat character={black} side="Black · dark wood" />
            </div>
            {cue && phase === 'card' && (
              <>
                <p className="quiet dark center">
                  {cue.detail}. {cue.score}.
                  {countdown !== null ? ` Starting in ${countdown}s.` : ''}
                </p>
                <div className="actions center">
                  <button className="btn paper" data-testid="start-game" onClick={begin}>
                    Start the game
                  </button>
                </div>
              </>
            )}
            {phase === 'over' && (
              <div className="actions center">
                <button className="btn paper" onClick={onExit}>
                  Back to the roster
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {phase === 'live' && (
        <>
          {white && black && (
            <div className="players">
              <Player character={white} label="Red" thinking={thinker?.side === 'white' ? thinker.since : null} paused={paused} />
              <Player character={black} label="Dark" thinking={thinker?.side === 'black' ? thinker.since : null} paused={paused} />
            </div>
          )}
          <header className="hud-top" data-testid="live-hud">
            <span>{white?.name} · red</span>
            <span>{banner}</span>
            <span>{black?.name} · dark</span>
          </header>
          <footer className="hud-bottom">
            <button className="btn tiny" onClick={() => setPaused((value) => !value)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            {(['slow', 'normal', 'fast'] as const).map((name) => (
              <button key={name} className={pace === name ? 'btn tiny on' : 'btn tiny'} onClick={() => setPace(name)}>
                {name}
              </button>
            ))}
            <button className="btn tiny" onClick={() => (confirmLeave ? onExit() : setConfirmLeave(true))}>
              {confirmLeave ? 'Leave now' : 'Leave'}
            </button>
          </footer>
        </>
      )}
      {liveState && phase === 'live' &&       <span className="sr-only">{liveState.turn} to move</span>}
    </div>
  );
}

function Seat({ character, side }: { character: Character; side: string }) {
  return (
    <div className="seat">
      <p className="side">{side}</p>
      <Portrait spec={character.portrait} photo={character.photo} name={character.name} id={`${character.id}-card`} />
      <h3>{character.name}</h3>
      <Records record={character.record} />
    </div>
  );
}

function Player({
  character,
  label,
  thinking,
  paused,
}: {
  character: Character;
  label: string;
  thinking: number | null;
  paused: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (thinking === null || paused) return undefined;
    const timer = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(timer);
  }, [thinking, paused]);
  const seconds = thinking === null ? 0 : Math.floor((performance.now() - thinking) / 1000);
  const className = thinking === null ? 'player' : 'player thinking';
  return (
    <figure className={className} data-testid={`player-${label.toLowerCase()}`}>
      <div className="player-frame">
        {character.photo ? (
          <img src={photoUrl(character.photo)} alt={character.name} />
        ) : (
          <Portrait spec={character.portrait} name={character.name} id={`${character.id}-live`} />
        )}
      </div>
      <figcaption>
        <strong>{character.name}</strong>
        <span>
          {label}
          {thinking !== null &&
            (paused ? ' · paused' : ` · thinking ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`)}
        </span>
      </figcaption>
    </figure>
  );
}
