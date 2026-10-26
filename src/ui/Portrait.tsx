import { useEffect, useRef, useState } from 'react';
import { PortraitSpec } from '../portrait/palette';
import { paintPortrait } from '../portrait/render';
import { PlayerModel } from '../scene/models';
import { portraitOf } from '../scene/snapshot';

export function photoUrl(photo: string): string {
  return `${import.meta.env.BASE_URL}${photo}`;
}

/** The picture of a body as it sits at the table, once it has been made. */
export function useBodyPortrait(body?: PlayerModel): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!body) return undefined;
    let live = true;
    setUrl(null);
    portraitOf(body)
      .then((made) => live && setUrl(made))
      .catch((error) => console.error('Could not make a portrait', error));
    return () => {
      live = false;
    };
  }, [body?.model, JSON.stringify(body?.tints)]);
  return url;
}

/** A player's picture: their 3D body at the table when they have one, else their photo or drawn face. */
export function Portrait({ spec, photo, name, body }: { spec: PortraitSpec; id: string; photo?: string; name?: string; body?: PlayerModel }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shot = useBodyPortrait(body);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paintPortrait(canvas, spec);
  }, [spec, photo, body]);
  if (body) {
    return shot ? <img className="portrait-photo" src={shot} alt={name ?? ''} /> : <div className="portrait-photo portrait-pending" aria-label={name ?? ''} />;
  }
  if (photo) return <img className="portrait-photo" src={photoUrl(photo)} alt={name ?? ''} loading="lazy" />;
  return <canvas ref={ref} className="portrait-canvas" width={800} height={1000} />;
}
