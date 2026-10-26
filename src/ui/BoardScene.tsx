import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { SceneHandle, mountScene } from '../scene/mountScene';

export const BoardScene = forwardRef<SceneHandle>(function BoardScene(_props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<SceneHandle | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    let mounted: SceneHandle | null = null;
    try {
      mounted = mountScene(node);
      api.current = mounted;
    } catch (error) {
      node.textContent = error instanceof Error ? error.message : 'The board could not be started.';
    }
    return () => mounted?.dispose();
  }, []);

  useImperativeHandle(ref, () => ({
    reset: (board) => api.current?.reset(board),
    setColors: (whiteSkin, blackSkin, whiteSleeve, blackSleeve) =>
      api.current?.setColors(whiteSkin, blackSkin, whiteSleeve, blackSleeve),
    playMove: (move, side, speed, paused) => api.current?.playMove(move, side, speed, paused) ?? Promise.resolve(),
    cancel: () => api.current?.cancel(),
    setShift: (amount) => api.current?.setShift(amount),
    setPlayers: (white, black) => api.current?.setPlayers(white, black),
    dispose: () => api.current?.dispose(),
  }));

  return <div className="scene-host" ref={host} />;
});
