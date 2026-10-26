import { useEffect, useRef } from 'react';
import { PortraitSpec } from '../portrait/palette';
import { paintPortrait } from '../portrait/render';

export function photoUrl(photo: string): string {
  return `${import.meta.env.BASE_URL}${photo}`;
}

export function Portrait({ spec, photo, name }: { spec: PortraitSpec; id: string; photo?: string; name?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paintPortrait(canvas, spec);
  }, [spec, photo]);
  if (photo) return <img className="portrait-photo" src={photoUrl(photo)} alt={name ?? ''} loading="lazy" />;
  return <canvas ref={ref} className="portrait-canvas" width={800} height={1000} />;
}
