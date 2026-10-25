import { useMemo } from 'react';
import { PortraitSpec } from '../portrait/palette';
import { portraitMarkup } from '../portrait/render';

export function Portrait({ spec, id }: { spec: PortraitSpec; id: string }) {
  const markup = useMemo(() => portraitMarkup(spec, id), [spec, id]);
  return <div className="portrait" dangerouslySetInnerHTML={{ __html: markup }} />;
}
