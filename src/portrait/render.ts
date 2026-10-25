import {
  PortraitSpec,
  clampIndex,
  eyeHex,
  hairHex,
  shirtHex,
  skinHex,
} from './palette';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mix(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

function lipColor(skin: string, lift: number): string {
  const { r, g, b } = hexToRgb(skin);
  return rgbToHex(Math.min(255, r * 0.82 + 28 + lift), g * 0.58 + 8, b * 0.52);
}

const FACE = {
  oval: { jaw: 48, cheek: 76, temple: 70, brow: 62, crown: 48, chin: 10 },
  round: { jaw: 66, cheek: 84, temple: 78, brow: 70, crown: 60, chin: 2 },
  square: { jaw: 72, cheek: 78, temple: 74, brow: 66, crown: 52, chin: 0 },
  long: { jaw: 42, cheek: 66, temple: 60, brow: 54, crown: 40, chin: 18 },
  heart: { jaw: 36, cheek: 74, temple: 80, brow: 72, crown: 54, chin: 16 },
} as const;

function headPath(spec: PortraitSpec): string {
  const p = FACE[spec.face];
  const cx = 200;
  const chinY = 352 + p.chin;
  return [
    `M ${cx} ${chinY}`,
    `C ${cx - p.jaw} ${chinY - 6}, ${cx - p.cheek} ${304}, ${cx - p.cheek + 2} ${262}`,
    `C ${cx - p.temple - 2} ${214}, ${cx - p.brow} ${156}, ${cx - p.crown} ${128}`,
    `Q ${cx} ${104} ${cx + p.crown} ${128}`,
    `C ${cx + p.brow} ${156}, ${cx + p.temple + 2} ${214}, ${cx + p.cheek - 2} ${262}`,
    `C ${cx + p.cheek} ${304}, ${cx + p.jaw} ${chinY - 6}, ${cx} ${chinY}`,
    'Z',
  ].join(' ');
}

function eye(cx: number, iris: string, shape: PortraitSpec['eyeShape']): string {
  const open = shape === 'round' ? 11 : shape === 'narrow' ? 6.2 : shape === 'deep' ? 7.4 : 9;
  const lid = shape === 'deep' ? 5.5 : shape === 'narrow' ? 7 : shape === 'round' ? 12 : 10;
  const crease = shape === 'deep' ? -1 : -6;
  return `
    <g transform="translate(${cx} 232)">
      <ellipse cx="0" cy="3" rx="22" ry="14" fill="rgba(50,24,16,0.10)" />
      <ellipse cx="0" cy="0" rx="16" ry="${open}" fill="#f6f3ec" />
      <circle cx="1.2" cy="0.8" r="6.4" fill="${iris}" />
      <circle cx="1.2" cy="0.8" r="6.4" fill="rgba(0,0,0,0.18)" />
      <circle cx="1.2" cy="0.8" r="2.7" fill="#120e0c" />
      <circle cx="-1.2" cy="-1.3" r="1.45" fill="#fff" />
      <path d="M-16 1 Q0 ${-lid} 16 1" fill="none" stroke="#2c1d16" stroke-width="1.7" stroke-linecap="round" />
      <path d="M-13 ${crease * 0.15} Q0 ${crease} 13 0" fill="none" stroke="rgba(70,36,24,0.45)" stroke-width="1" />
      <path d="M-14 2 Q0 ${open * 0.85} 14 2" fill="none" stroke="rgba(80,40,28,0.35)" stroke-width="1" />
    </g>`;
}

function brows(spec: PortraitSpec, color: string): string {
  const weight = spec.brow === 'thick' ? 4.4 : spec.brow === 'soft' ? 2.2 : 3.2;
  const arch = spec.brow === 'arched' ? 18 : spec.brow === 'straight' ? 8 : spec.brow === 'soft' ? 12 : 11;
  const opacity = spec.brow === 'soft' ? 0.75 : 0.95;
  return `
    <path d="M146 214 Q164 ${214 - arch} 182 210" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" opacity="${opacity}" />
    <path d="M218 210 Q236 ${214 - arch} 254 214" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" opacity="${opacity}" />`;
}

function nose(spec: PortraitSpec): string {
  const width = spec.nose === 'broad' ? 16 : spec.nose === 'narrow' ? 8 : spec.nose === 'soft' ? 11 : 12;
  const bridge = spec.nose === 'narrow' ? 3 : spec.nose === 'broad' ? 7 : 5;
  return `
    <path d="M200 236 C${200 + bridge * 0.4} 262 ${200 + bridge * 0.3} 286 200 302" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2.2" stroke-linecap="round" />
    <path d="M${200 + bridge} 250 C${208 + width * 0.2} 286 ${204 + width * 0.15} 308 200 312" fill="none" stroke="rgba(40,18,10,0.20)" stroke-width="${spec.nose === 'soft' ? 3 : 4.5}" stroke-linecap="round" />
    <ellipse cx="${200 - width}" cy="308" rx="${width * 0.48}" ry="4.2" fill="rgba(40,18,10,0.22)" />
    <ellipse cx="${200 + width}" cy="308" rx="${width * 0.48}" ry="4.2" fill="rgba(40,18,10,0.28)" />
    <ellipse cx="200" cy="300" rx="${width * 0.7}" ry="5" fill="rgba(255,255,255,0.10)" />`;
}

function mouth(spec: PortraitSpec, upper: string, lower: string): string {
  const half = spec.mouth === 'wide' ? 34 : spec.mouth === 'narrow' ? 20 : 27;
  const full = spec.mouth === 'full' ? 18 : spec.mouth === 'soft' ? 12 : spec.mouth === 'narrow' ? 8 : 14;
  const bow = spec.mouth === 'soft' ? 6 : 10;
  const y = 332;
  return `
    <path d="M${200 - half} ${y} Q${200 - half / 2} ${y - bow} 200 ${y - 2} Q${200 + half / 2} ${y - bow} ${200 + half} ${y} Q${200 + half / 2} ${y + 5} 200 ${y + 3} Q${200 - half / 2} ${y + 5} ${200 - half} ${y} Z" fill="${upper}" />
    <path d="M${200 - half + 2} ${y + 2} Q200 ${y + full} ${200 + half - 2} ${y + 2} Q200 ${y + full * 0.45} ${200 - half + 2} ${y + 2} Z" fill="${lower}" />
    <path d="M${200 - half + 4} ${y + 1} Q200 ${y + 7} ${200 + half - 4} ${y + 1}" fill="none" stroke="rgba(70,24,24,0.45)" stroke-width="1.2" />
    <ellipse cx="200" cy="${y + full * 0.55}" rx="${half * 0.28}" ry="2.4" fill="rgba(255,255,255,0.16)" />`;
}

function hairBack(spec: PortraitSpec, color: string): string {
  if (spec.hairStyle === 'bald' || spec.hairStyle === 'crop' || spec.hairStyle === 'bun') return '';
  if (spec.hairStyle === 'long') {
    return `
      <path d="M118 210 C90 280 78 390 96 470 L146 470 C132 390 140 300 156 230 Z" fill="${color}" />
      <path d="M282 210 C310 280 322 390 304 470 L254 470 C268 390 260 300 244 230 Z" fill="${color}" />
      <path d="M96 430 C120 470 150 490 200 492 C250 490 280 470 304 430 L286 430 C268 458 240 468 200 468 C160 468 132 458 114 430 Z" fill="${mix(color, -0.18)}" />`;
  }
  if (spec.hairStyle === 'wavy') {
    return `
      <path d="M124 214 C100 280 108 360 126 420 L156 408 C140 340 138 270 160 230 Z" fill="${color}" />
      <path d="M276 214 C300 280 292 360 274 420 L244 408 C260 340 262 270 240 230 Z" fill="${color}" />`;
  }
  return '';
}

function hairFront(spec: PortraitSpec, color: string, shade: string): string {
  const p = FACE[spec.face];
  const left = 200 - p.temple - 8;
  const right = 200 + p.temple + 8;
  if (spec.hairStyle === 'bald') {
    return `
      <ellipse cx="176" cy="150" rx="28" ry="10" fill="rgba(255,255,255,0.10)" />
      <path d="M${left + 18} 168 Q200 156 ${right - 18} 168" fill="none" stroke="${shade}" stroke-width="3" opacity="0.25" />`;
  }
  if (spec.hairStyle === 'coily' || spec.hairStyle === 'curly') {
    const coils: string[] = [];
    const dense = spec.hairStyle === 'coily';
    const step = dense ? 16 : 22;
    const radius = dense ? 11 : 15;
    for (let y = 112; y <= 196; y += step) {
      for (let x = left + 8; x <= right - 8; x += step) {
        const span = y < 150 ? right - left : (right - left) * 0.72;
        if (Math.abs(x - 200) > span / 2) continue;
        coils.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${(x + y) % (step * 2) === 0 ? shade : color}" />`);
      }
    }
    return coils.join('');
  }
  const cap = `
    <path d="M${left} 214
      C${left - 6} 150 ${200 - p.crown - 10} 96 200 96
      C${200 + p.crown + 10} 96 ${right + 6} 150 ${right} 214
      C${right - 10} 176 ${200 + 20} 150 200 156
      C${200 - 20} 150 ${left + 10} 176 ${left} 214 Z" fill="${color}" />
    <path d="M${left + 16} 150 C${200 - 30} 118 ${200 + 10} 112 ${right - 20} 146" fill="none" stroke="${shade}" stroke-width="8" stroke-linecap="round" opacity="0.55" />`;
  if (spec.hairStyle === 'crop') {
    return `
      <path d="M${left + 10} 188 C${left} 140 ${200 - 20} 112 200 112 C${200 + 20} 112 ${right} 140 ${right - 10} 188
        C${right - 24} 166 200 158 ${left + 24} 170 Z" fill="${color}" />`;
  }
  if (spec.hairStyle === 'bun') {
    return `
      ${cap}
      <ellipse cx="214" cy="108" rx="28" ry="26" fill="${color}" />
      <ellipse cx="214" cy="108" rx="28" ry="26" fill="none" stroke="${shade}" stroke-width="3" />
      <path d="M${left + 20} 170 Q200 150 ${right - 16} 164" fill="none" stroke="${shade}" stroke-width="4" opacity="0.5" />`;
  }
  if (spec.hairStyle === 'short') {
    return `
      ${cap}
      <path d="M${left + 2} 210 C${left - 4} 250 ${left + 8} 268 ${left + 22} 260" fill="${color}" />
      <path d="M${right - 2} 210 C${right + 4} 250 ${right - 8} 268 ${right - 22} 260" fill="${color}" />`;
  }
  return cap;
}

function facialHair(spec: PortraitSpec, color: string): string {
  if (spec.facialHair === 'none') return '';
  if (spec.facialHair === 'stubble') {
    const dots: string[] = [];
    for (let y = 300; y <= 366; y += 6) {
      for (let x = 154; x <= 246; x += 6) {
        const dx = (x - 200) / 58;
        const dy = (y - 338) / 36;
        if (dx * dx + dy * dy > 1) continue;
        if (y < 326 && Math.abs(x - 200) < 24) continue;
        dots.push(`<circle cx="${x}" cy="${y}" r="1.05" fill="${color}" opacity="0.28" />`);
      }
    }
    return dots.join('');
  }
  const mustache = `<path d="M172 324 Q186 312 200 322 Q214 312 228 324 Q214 330 200 326 Q186 330 172 324 Z" fill="${color}" />`;
  if (spec.facialHair === 'mustache') return mustache;
  if (spec.facialHair === 'goatee') {
    return `
      ${mustache}
      <path d="M176 348 C178 374 190 388 200 390 C210 388 222 374 224 348 C214 358 206 362 200 362 C194 362 186 358 176 348 Z" fill="${color}" />`;
  }
  return `
    <path d="M132 292 C126 318 138 336 148 340 L156 300 Z" fill="${color}" />
    <path d="M268 292 C274 318 262 336 252 340 L244 300 Z" fill="${color}" />
    <path d="M156 346 C154 378 174 398 200 402 C226 398 246 378 244 346 C226 364 214 370 200 370 C186 370 174 364 156 346 Z" fill="${color}" />
    ${mustache}`;
}

export function renderPortrait(spec: PortraitSpec, id = 'face'): string {
  const skin = skinHex(spec);
  const skinLight = mix(skin, 0.22);
  const skinDark = mix(skin, -0.28);
  const hair = hairHex(spec);
  const hairDark = mix(hair, -0.25);
  const iris = eyeHex(spec);
  const shirt = shirtHex(spec);
  const shirtDark = mix(shirt, -0.25);
  const upper = lipColor(skin, 0);
  const lower = lipColor(skin, 28);
  const { r, g, b } = hexToRgb(skin);
  const blush = rgbToHex(Math.min(255, r + 28), g * 0.72, b * 0.7);
  const p = FACE[spec.face];
  const earX = 200 - p.cheek - 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" role="img">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d7d1c6" />
      <stop offset="100%" stop-color="#b9b3a6" />
    </linearGradient>
    <radialGradient id="${id}-skin" cx="36%" cy="30%" r="72%">
      <stop offset="0%" stop-color="${skinLight}" />
      <stop offset="48%" stop-color="${skin}" />
      <stop offset="100%" stop-color="${skinDark}" />
    </radialGradient>
    <linearGradient id="${id}-shirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mix(shirt, 0.08)}" />
      <stop offset="100%" stop-color="${shirtDark}" />
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#${id}-bg)" />
  ${hairBack(spec, hair)}
  <path d="M78 500 L108 392 C140 360 164 378 200 386 C236 378 260 360 292 392 L322 500 Z" fill="url(#${id}-shirt)" />
  <path d="M168 392 Q200 430 232 392 L224 500 L176 500 Z" fill="${shirtDark}" />
  <path d="M174 348 C170 372 166 392 162 408 L238 408 C234 392 230 372 226 348 Z" fill="url(#${id}-skin)" />
  <g>
    <ellipse cx="${earX}" cy="252" rx="16" ry="24" fill="${mix(skin, -0.08)}" />
    <path d="M${earX + 4} 238 Q${earX - 4} 252 ${earX + 5} 270" fill="none" stroke="rgba(40,16,8,0.25)" stroke-width="2" />
    <ellipse cx="${400 - earX}" cy="252" rx="16" ry="24" fill="${mix(skin, -0.16)}" />
    <path d="M${400 - earX - 4} 238 Q${400 - earX + 4} 252 ${400 - earX - 5} 270" fill="none" stroke="rgba(40,16,8,0.28)" stroke-width="2" />
  </g>
  <path d="${headPath(spec)}" fill="url(#${id}-skin)" />
  <ellipse cx="248" cy="250" rx="46" ry="78" fill="${skinDark}" opacity="0.16" />
  <ellipse cx="156" cy="292" rx="24" ry="13" fill="${blush}" opacity="0.28" />
  <ellipse cx="246" cy="296" rx="22" ry="12" fill="${blush}" opacity="0.2" />
  <ellipse cx="200" cy="${348 + p.chin}" rx="54" ry="12" fill="rgba(40,16,8,0.12)" />
  ${eye(164, iris, spec.eyeShape)}
  ${eye(236, iris, spec.eyeShape)}
  ${brows(spec, hair === '#ddd6cc' ? '#8a8175' : hairDark)}
  ${nose(spec)}
  ${mouth(spec, upper, lower)}
  ${facialHair(spec, hair)}
  ${hairFront(spec, hair, hairDark)}
</svg>`;
}

export function portraitMarkup(spec: PortraitSpec, seed: string): string {
  const safe = seed.replace(/[^a-zA-Z0-9_-]/g, '') || 'face';
  return renderPortrait(
    {
      ...spec,
      skin: clampIndex(spec.skin, 9),
      hairColor: clampIndex(spec.hairColor, 8),
      eyeColor: clampIndex(spec.eyeColor, 6),
    },
    safe,
  );
}
