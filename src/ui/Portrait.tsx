import { useEffect, useRef } from 'react';
import { PortraitSpec } from '../portrait/palette';
import { paintPortrait } from '../portrait/render';

export function Portrait({ spec }: { spec: PortraitSpec; id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paintPortrait(canvas, spec);
  }, [spec]);
  return <canvas ref={ref} className="portrait-canvas" width={400} height={500} />;
}
