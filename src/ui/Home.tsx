import { Character, describeStrength } from '../domain/character';
import { ScriptName } from '../domain/scripts';
import { Portrait } from './Portrait';
import { Records } from './Records';

export function Home({
  roster,
  onRandom,
  onCreate,
  onExhibition,
  onTournament,
  onScript,
}: {
  roster: Character[];
  onRandom: () => void;
  onCreate: () => void;
  onExhibition: () => void;
  onTournament: () => void;
  onScript: (script: ScriptName) => void;
}) {
  return (
    <aside className="home-panel">
      <p className="eyebrow">Under the tree</p>
      <h1>International draughts</h1>
      <p className="lede">
        A 10×10 board, twenty men a side, flying kings. Captures are mandatory. Either player can win.
      </p>
      <div className="actions">
        <button className="btn" data-testid="random-opponents" onClick={onRandom} disabled={roster.length < 2}>
          Random opponents
        </button>
        <button className="btn secondary" onClick={onExhibition}>
          Exhibition
        </button>
        <button className="btn secondary" onClick={onTournament}>
          Tournament
        </button>
        <button className="btn secondary" onClick={onCreate}>
          New character
        </button>
      </div>
      <h2>Roster</h2>
      <div className="roster-grid">
        {roster.map((character) => (
          <article className="person" key={character.id}>
            <Portrait spec={character.portrait} photo={character.photo} name={character.name} id={character.id} />
            <h3>{character.name}</h3>
            <p className="quiet">{describeStrength(character)}</p>
            <Records record={character.record} />
          </article>
        ))}
      </div>
      <h2>Scripted positions</h2>
      <p className="quiet">Short positions for checking a capture, and that either color can be the one to win.</p>
      <div className="actions">
        <button className="btn secondary" onClick={() => onScript('capture')}>
          Watch a capture
        </button>
        <button className="btn secondary" onClick={() => onScript('white-win')}>
          White wins next
        </button>
        <button className="btn secondary" onClick={() => onScript('black-win')}>
          Black wins next
        </button>
      </div>
    </aside>
  );
}
