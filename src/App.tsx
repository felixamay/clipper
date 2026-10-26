import { useEffect, useRef, useState } from 'react';
import { createCasual } from './domain/event';
import { PlayEvent } from './domain/event';
import { addCharacter, useRoster } from './domain/storage';
import { ScriptName } from './domain/scripts';
import { initialBoard } from './engine/board';
import { PortraitSpec, shirtHex, skinHex } from './portrait/palette';
import { SceneHandle } from './scene/mountScene';
import { BoardScene } from './ui/BoardScene';
import { Creator } from './ui/Creator';
import { Home } from './ui/Home';
import { Match } from './ui/Match';
import { ExhibitionSetup, TournamentSetup } from './ui/Setup';

type Screen =
  | { type: 'home' }
  | { type: 'create' }
  | { type: 'exhibition' }
  | { type: 'tournament' }
  | { type: 'match'; event: PlayEvent };

function pickTwo<T>(items: T[]): [T, T] | null {
  if (items.length < 2) return null;
  const first = Math.floor(Math.random() * items.length);
  let second = Math.floor(Math.random() * (items.length - 1));
  if (second >= first) second += 1;
  return [items[first], items[second]];
}

export default function App() {
  const roster = useRoster();
  const sceneRef = useRef<SceneHandle>(null);
  const [screen, setScreen] = useState<Screen>({ type: 'home' });

  useEffect(() => {
    if (screen.type === 'match') return;
    const scene = sceneRef.current;
    const pair = roster.slice(0, 2);
    if (!scene || pair.length < 2) return;
    scene.setColors(
      skinHex(pair[0].portrait),
      skinHex(pair[1].portrait),
      shirtHex(pair[0].portrait),
      shirtHex(pair[1].portrait),
    );
    scene.reset(initialBoard());
    scene.setShift(0);
  }, [screen.type, roster]);

  const startCasual = (script: ScriptName | null) => {
    const pair = pickTwo(roster);
    if (!pair) return;
    setScreen({ type: 'match', event: createCasual(pair[0].id, pair[1].id, script) });
  };

  return (
    <>
      <BoardScene ref={sceneRef} />
      {screen.type === 'home' && (
        <Home
          roster={roster}
          onRandom={() => startCasual(null)}
          onCreate={() => setScreen({ type: 'create' })}
          onExhibition={() => setScreen({ type: 'exhibition' })}
          onTournament={() => setScreen({ type: 'tournament' })}
          onScript={startCasual}
        />
      )}
      {screen.type === 'create' && (
        <Creator
          onCancel={() => setScreen({ type: 'home' })}
          onSave={(name: string, portrait: PortraitSpec, depth: number) => {
            addCharacter({
              id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              name: name.replace(/\s+/g, ' ').trim().slice(0, 28),
              portrait,
              depth: Math.max(3, Math.min(8, Math.round(depth))),
              noise: Math.max(1, 22 - Math.round(depth) * 2),
              record: { played: 0, wins: 0, losses: 0, draws: 0 },
            });
            setScreen({ type: 'home' });
          }}
        />
      )}
      {screen.type === 'exhibition' && (
        <ExhibitionSetup roster={roster} onCancel={() => setScreen({ type: 'home' })} onStart={(event) => setScreen({ type: 'match', event })} />
      )}
      {screen.type === 'tournament' && (
        <TournamentSetup roster={roster} onCancel={() => setScreen({ type: 'home' })} onStart={(event) => setScreen({ type: 'match', event })} />
      )}
      {screen.type === 'match' && (
        <Match initial={screen.event} sceneRef={sceneRef} onExit={() => setScreen({ type: 'home' })} />
      )}
    </>
  );
}
