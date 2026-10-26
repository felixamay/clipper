import { useMemo, useState } from 'react';
import { Character } from '../domain/character';
import { createExhibition, createRobin, createSingle } from '../domain/event';
import { PlayEvent } from '../domain/event';

function shuffle<T>(items: T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function ExhibitionSetup({
  roster,
  onStart,
  onCancel,
}: {
  roster: Character[];
  onStart: (event: PlayEvent) => void;
  onCancel: () => void;
}) {
  const [whiteId, setWhiteId] = useState(roster[0]?.id ?? '');
  const [blackId, setBlackId] = useState(roster[1]?.id ?? roster[0]?.id ?? '');
  const [games, setGames] = useState(1);

  const randomize = () => {
    if (roster.length < 2) return;
    const [a, b] = shuffle(roster);
    setWhiteId(a.id);
    setBlackId(b.id);
  };

  return (
    <div className="card-center">
      <form
        className="card setup"
        onSubmit={(event) => {
          event.preventDefault();
          if (!whiteId || !blackId || whiteId === blackId) return;
          onStart(createExhibition(whiteId, blackId, games));
        }}
      >
        <h2>Exhibition</h2>
        <p className="quiet dark">Pick both sides, or let the seats be drawn. A series can split.</p>
        <label className="field dark-field">
          White
          <select value={whiteId} onChange={(event) => setWhiteId(event.target.value)}>
            {roster.map((character) => (
              <option key={character.id} value={character.id} disabled={character.id === blackId}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field dark-field">
          Black
          <select value={blackId} onChange={(event) => setBlackId(event.target.value)}>
            {roster.map((character) => (
              <option key={character.id} value={character.id} disabled={character.id === whiteId}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field dark-field">
          Games
          <input
            type="number"
            min={1}
            max={21}
            value={games}
            onChange={(event) => setGames(Math.max(1, Math.min(21, Number(event.target.value) || 1)))}
          />
        </label>
        <div className="actions">
          <button className="btn paper" type="submit" disabled={!whiteId || whiteId === blackId}>
            Open the card
          </button>
          <button className="btn secondary dark-ghost" type="button" onClick={randomize}>
            Randomize
          </button>
          <button className="btn secondary dark-ghost" type="button" onClick={onCancel}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

export function TournamentSetup({
  roster,
  onStart,
  onCancel,
}: {
  roster: Character[];
  onStart: (event: PlayEvent) => void;
  onCancel: () => void;
}) {
  const [format, setFormat] = useState<'single' | 'robin'>('single');
  const [games, setGames] = useState(1);
  // The field opens already seated, up to four players drawn from the roster, so it can start at once.
  const [target, setTarget] = useState(() => Math.max(2, Math.min(4, roster.length)));
  const [seated, setSeated] = useState<string[]>(() => shuffle(roster).slice(0, 4).map((character) => character.id));
  const [addId, setAddId] = useState('');
  const [note, setNote] = useState(
    roster.length < 2
      ? 'A tournament needs at least two players. Create some from the roster first.'
      : 'Up to 64 players. Change the field size and fill the empty seats, or add and remove players below.',
  );
  const available = useMemo(() => roster.filter((character) => !seated.includes(character.id)), [roster, seated]);

  const fill = () => {
    const asked = Math.max(2, Math.min(64, Math.round(target) || 2));
    if (target > 64) setNote('The field stops at 64 players.');
    const need = asked - seated.length;
    if (need <= 0) {
      setSeated(seated.slice(0, asked));
      setNote(`Field set to ${asked}.`);
      return;
    }
    const picked = shuffle(available).slice(0, need);
    const next = [...seated, ...picked.map((character) => character.id)];
    setSeated(next);
    if (picked.length < need) {
      setNote(`The roster has ${roster.length} characters, so this field is ${next.length}. Create more players to go higher, up to 64.`);
    } else {
      setNote(`${next.length} players seated.`);
    }
  };

  return (
    <div className="card-center">
      <form
        className="card setup"
        onSubmit={(event) => {
          event.preventDefault();
          if (seated.length < 2 || seated.length > 64) return;
          const field = seated.slice(0, 64);
          onStart(
            format === 'single'
              ? createSingle(field, games, Math.random() < 0.5)
              : createRobin(field, games, () => Math.random() < 0.5),
          );
        }}
      >
        <h2>Tournament</h2>
        <p className="quiet dark">{note}</p>
        <div className="choice-row">
          <label>
            <input type="radio" checked={format === 'single'} onChange={() => setFormat('single')} /> Single elimination
          </label>
          <label>
            <input type="radio" checked={format === 'robin'} onChange={() => setFormat('robin')} /> Round robin
          </label>
        </div>
        <label className="field dark-field">
          Games in each match
          <input
            type="number"
            min={1}
            max={21}
            value={games}
            onChange={(event) => setGames(Math.max(1, Math.min(21, Number(event.target.value) || 1)))}
          />
        </label>
        <p className="quiet dark">
          One game, or a series of however many you type. If both sides win the same number, the series splits. A bracket
          plays one extra game so someone advances.
        </p>
        <label className="field dark-field">
          Field size
          <input
            type="number"
            min={2}
            max={64}
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
          />
        </label>
        <div className="actions">
          <button className="btn paper" type="button" onClick={fill}>
            Fill empty seats
          </button>
        </div>
        <div className="seat-add">
          <select value={addId} onChange={(event) => setAddId(event.target.value)}>
            <option value="">Add from the roster</option>
            {available.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
          <button
            className="btn secondary dark-ghost"
            type="button"
            disabled={!addId || seated.length >= 64}
            onClick={() => {
              if (!addId) return;
              setSeated([...seated, addId]);
              setAddId('');
            }}
          >
            Add
          </button>
        </div>
        <ul className="seated">
          {seated.map((id, index) => {
            const character = roster.find((item) => item.id === id);
            return (
              <li key={id}>
                <span>
                  {index + 1}. {character?.name ?? 'Player'}
                </span>
                <button type="button" onClick={() => setSeated(seated.filter((seat) => seat !== id))}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <div className="actions">
          <button className="btn paper" type="submit" disabled={seated.length < 2}>
            Start tournament
          </button>
          <button className="btn secondary dark-ghost" type="button" onClick={onCancel}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
