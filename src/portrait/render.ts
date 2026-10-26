import { PortraitSpec, eyeHex, hairHex, shirtHex, skinHex } from './palette';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  const channel = (from: number, to: number) => Math.max(0, Math.min(255, Math.round(from + (to - from) * amount)));
  return `rgb(${channel(a.r, b.r)}, ${channel(a.g, b.g)}, ${channel(a.b, b.b)})`;
}

interface FaceMetrics {
  jaw: number;
  cheek: number;
  temple: number;
  crown: number;
  chinY: number;
  mouthY: number;
  noseY: number;
  eyeY: number;
  browY: number;
  crownY: number;
}

const SHAPES = {
  oval: { jaw: 50, cheek: 72, temple: 66, crown: 48, chin: 10 },
  round: { jaw: 66, cheek: 80, temple: 74, crown: 58, chin: 0 },
  square: { jaw: 68, cheek: 74, temple: 70, crown: 52, chin: 2 },
  long: { jaw: 44, cheek: 62, temple: 56, crown: 40, chin: 18 },
  heart: { jaw: 38, cheek: 70, temple: 76, crown: 54, chin: 12 },
} as const;

function metrics(spec: PortraitSpec): FaceMetrics {
  const shape = SHAPES[spec.face];
  const chinY = 346 + shape.chin;
  const mouthY = chinY - 30;
  const noseY = mouthY - 34;
  const eyeY = noseY - 62;
  const browY = eyeY - 18;
  const crownY = browY - 36;
  return { ...shape, chinY, mouthY, noseY, eyeY, browY, crownY };
}

function facePath(m: FaceMetrics): Path2D {
  const cx = 200;
  const path = new Path2D();
  path.moveTo(cx, m.chinY);
  path.bezierCurveTo(cx - m.jaw, m.chinY - 4, cx - m.cheek, m.mouthY + 6, cx - m.cheek + 2, m.noseY);
  path.bezierCurveTo(cx - m.temple, m.eyeY + 8, cx - m.temple + 2, m.browY, cx - m.crown, m.crownY + 16);
  path.quadraticCurveTo(cx, m.crownY, cx + m.crown, m.crownY + 16);
  path.bezierCurveTo(cx + m.temple - 2, m.browY, cx + m.temple, m.eyeY + 8, cx + m.cheek - 2, m.noseY);
  path.bezierCurveTo(cx + m.cheek, m.mouthY + 6, cx + m.jaw, m.chinY - 4, cx, m.chinY);
  path.closePath();
  return path;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, spec: PortraitSpec, iris: string, skin: string) {
  const open = spec.eyeShape === 'round' ? 11 : spec.eyeShape === 'narrow' ? 6.5 : spec.eyeShape === 'deep' ? 7.5 : 9;
  const wide = spec.eyeShape === 'narrow' ? 15 : 17;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - wide, y);
  ctx.quadraticCurveTo(x, y - open, x + wide, y + (spec.eyeShape === 'almond' ? -1 : 0));
  ctx.quadraticCurveTo(x, y + open * 0.85, x - wide, y);
  ctx.clip();
  ctx.fillStyle = '#f4efe8';
  ctx.fillRect(x - wide - 1, y - open - 2, wide * 2 + 2, open * 2 + 6);
  const irisR = spec.eyeShape === 'narrow' ? 4.8 : 6;
  const irisY = y + 1;
  const grad = ctx.createRadialGradient(x - 1, irisY - 1, 0.5, x, irisY, irisR);
  grad.addColorStop(0, mix(iris, '#fff6ee', 0.4));
  grad.addColorStop(0.55, iris);
  grad.addColorStop(1, '#1a120e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, irisY, irisR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e0c0b';
  ctx.beginPath();
  ctx.arc(x, irisY, irisR * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x - 1.6, irisY - 1.5, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = mix(skin, '#3a241c', 0.28);
  ctx.beginPath();
  ctx.moveTo(x - wide, y);
  ctx.quadraticCurveTo(x, y - open, x + wide, y);
  ctx.quadraticCurveTo(x, y - open * 0.55, x - wide, y);
  ctx.fill();
  ctx.strokeStyle = '#2a1812';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - wide + 1, y - 0.5);
  ctx.quadraticCurveTo(x, y - open - 1, x + wide - 1, y);
  ctx.stroke();
  ctx.fillStyle = mix(skin, '#a06058', 0.35);
  ellipse(ctx, x - wide + 2, y + 1, 2, 1.3);
}

function brows(ctx: CanvasRenderingContext2D, m: FaceMetrics, spec: PortraitSpec, color: string) {
  const arch = spec.brow === 'arched' ? 10 : spec.brow === 'straight' ? 2 : spec.brow === 'soft' ? 6 : 5;
  const weight = spec.brow === 'thick' ? 3.4 : spec.brow === 'soft' ? 1.6 : 2.3;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = weight;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(200 + side * 16, m.browY + 2);
    ctx.quadraticCurveTo(200 + side * 32, m.browY - arch, 200 + side * 52, m.browY + 3);
    ctx.stroke();
  }
}

function nose(ctx: CanvasRenderingContext2D, m: FaceMetrics, spec: PortraitSpec, skin: string) {
  const width = spec.nose === 'broad' ? 14 : spec.nose === 'narrow' ? 8 : spec.nose === 'soft' ? 10 : 11;
  const top = m.eyeY + 8;
  const tip = m.noseY;
  ctx.fillStyle = mix(skin, '#2a1812', 0.18);
  ctx.beginPath();
  ctx.moveTo(200 - 3, top);
  ctx.quadraticCurveTo(200 + width * 0.35, (top + tip) / 2, 200 + width * 0.15, tip - 2);
  ctx.quadraticCurveTo(200, tip - 10, 200 - 4, top);
  ctx.fill();
  ctx.fillStyle = mix(skin, '#fff4ec', 0.22);
  ellipse(ctx, 198, tip - 8, width * 0.28, 5);
  ctx.fillStyle = mix(skin, '#3a2218', 0.12);
  ellipse(ctx, 200 - width * 0.55, tip + 2, width * 0.32, 4);
  ellipse(ctx, 200 + width * 0.55, tip + 2, width * 0.32, 4);
  ctx.fillStyle = 'rgba(30, 14, 12, 0.75)';
  ellipse(ctx, 200 - width * 0.42, tip + 3, Math.max(1.8, width * 0.16), 2.4);
  ellipse(ctx, 200 + width * 0.42, tip + 3, Math.max(1.8, width * 0.16), 2.4);
}

function mouth(ctx: CanvasRenderingContext2D, m: FaceMetrics, spec: PortraitSpec, skin: string) {
  const half = Math.min(spec.mouth === 'wide' ? 24 : spec.mouth === 'narrow' ? 13 : 18, m.jaw * 0.55);
  const full = spec.mouth === 'full' ? 9 : spec.mouth === 'soft' ? 6 : spec.mouth === 'narrow' ? 5 : 7;
  const y = m.mouthY;
  ctx.fillStyle = mix(skin, '#6a3030', 0.5);
  ctx.beginPath();
  ctx.moveTo(200 - half, y);
  ctx.quadraticCurveTo(200 - half * 0.35, y - 5, 200, y - 1);
  ctx.quadraticCurveTo(200 + half * 0.35, y - 5, 200 + half, y);
  ctx.quadraticCurveTo(200, y + 2, 200 - half, y);
  ctx.fill();
  ctx.fillStyle = mix(skin, '#b06058', 0.38);
  ctx.beginPath();
  ctx.moveTo(200 - half + 1, y + 1);
  ctx.quadraticCurveTo(200, y + full, 200 + half - 1, y + 1);
  ctx.quadraticCurveTo(200, y + 2, 200 - half + 1, y + 1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 28, 28, 0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(200 - half + 2, y + 0.4);
  ctx.quadraticCurveTo(200, y + 2, 200 + half - 2, y + 0.4);
  ctx.stroke();
}

function hairMass(ctx: CanvasRenderingContext2D, m: FaceMetrics, spec: PortraitSpec, color: string, layer: 'back' | 'front') {
  const shade = mix(color, '#140e0c', 0.4);
  const light = mix(color, '#fff2e4', 0.35);
  if (spec.hairStyle === 'bald') {
    if (layer === 'front') {
      ctx.strokeStyle = shade;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(200 - m.crown, m.crownY + 18);
      ctx.quadraticCurveTo(200, m.crownY + 6, 200 + m.crown, m.crownY + 18);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (layer === 'back' && (spec.hairStyle === 'long' || spec.hairStyle === 'wavy')) {
    for (const dir of [-1, 1]) {
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(200 + dir * (m.temple - 8), m.browY + 10);
      ctx.bezierCurveTo(200 + dir * (m.temple + 28), m.mouthY, 200 + dir * (m.temple + 18), 430, 200 + dir * (m.temple - 4), 490);
      ctx.lineTo(200 + dir * (m.cheek - 16), 490);
      ctx.bezierCurveTo(200 + dir * m.cheek, 400, 200 + dir * (m.temple - 18), m.eyeY, 200 + dir * (m.temple - 14), m.browY + 8);
      ctx.fill();
      if (spec.hairStyle === 'wavy') {
        ctx.strokeStyle = light;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(200 + dir * m.temple, m.eyeY);
        ctx.quadraticCurveTo(200 + dir * (m.temple + 16), m.chinY, 200 + dir * (m.temple - 2), 460);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    return;
  }
  if (layer === 'back') return;

  ctx.fillStyle = shade;
  const side = spec.hairStyle === 'coily' ? m.temple + 18 : spec.hairStyle === 'curly' ? m.temple + 12 : m.temple + 4;
  const top = spec.hairStyle === 'coily' ? m.crownY - 28 : spec.hairStyle === 'curly' ? m.crownY - 16 : m.crownY - 8;
  ctx.beginPath();
  ctx.moveTo(200 - side, m.browY + 4);
  ctx.bezierCurveTo(200 - side - 6, m.eyeY, 200 - 30, top, 200, top);
  ctx.bezierCurveTo(200 + 30, top, 200 + side + 6, m.eyeY, 200 + side, m.browY + 4);
  ctx.quadraticCurveTo(200, m.browY + 14, 200 - side, m.browY + 4);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(168, m.crownY + 8);
  ctx.quadraticCurveTo(200, top + 6, 236, m.crownY + 10);
  ctx.lineWidth = 8;
  ctx.strokeStyle = light;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (spec.hairStyle === 'curly' || spec.hairStyle === 'coily') {
    const count = spec.hairStyle === 'coily' ? 18 : 12;
    const radius = spec.hairStyle === 'coily' ? 8 : 11;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const angle = Math.PI + t * Math.PI;
      const cx = 200 + Math.cos(angle) * (side - 6);
      const cy = m.browY - 8 + Math.sin(angle) * 22;
      ctx.fillStyle = i % 3 === 0 ? light : i % 2 === 0 ? color : shade;
      ctx.beginPath();
      ctx.arc(cx, Math.max(top + radius, Math.min(m.browY + 2, cy)), radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (spec.hairStyle === 'bun') {
    ctx.fillStyle = shade;
    ellipse(ctx, 228, top + 8, 22, 18);
    ctx.fillStyle = color;
    ellipse(ctx, 228, top + 8, 16, 13);
  }
  if (spec.hairStyle === 'short') {
    ctx.fillStyle = color;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(200 + dir * m.temple, m.browY);
      ctx.quadraticCurveTo(200 + dir * (m.temple + 8), m.eyeY + 20, 200 + dir * (m.temple - 10), m.noseY);
      ctx.quadraticCurveTo(200 + dir * (m.temple - 16), m.eyeY, 200 + dir * (m.temple - 4), m.browY);
      ctx.fill();
    }
  }
}

function facialHair(ctx: CanvasRenderingContext2D, m: FaceMetrics, spec: PortraitSpec, color: string) {
  if (spec.facialHair === 'none') return;
  const shade = mix(color, '#120e0c', 0.25);
  ctx.fillStyle = color;
  if (spec.facialHair === 'stubble') {
    ctx.globalAlpha = 0.35;
    for (let y = m.noseY + 8; y < m.chinY - 2; y += 4) {
      for (let x = 200 - m.jaw + 8; x < 200 + m.jaw - 8; x += 4) {
        if (y < m.mouthY && Math.abs(x - 200) < 12) continue;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  const half = Math.min(22, m.jaw * 0.4);
  ctx.beginPath();
  ctx.moveTo(200 - half, m.mouthY - 6);
  ctx.quadraticCurveTo(200 - half * 0.4, m.mouthY - 14, 200, m.mouthY - 8);
  ctx.quadraticCurveTo(200 + half * 0.4, m.mouthY - 14, 200 + half, m.mouthY - 6);
  ctx.quadraticCurveTo(200, m.mouthY - 2, 200 - half, m.mouthY - 6);
  ctx.fill();
  if (spec.facialHair === 'mustache') return;
  ctx.fillStyle = shade;
  if (spec.facialHair === 'goatee') {
    ctx.beginPath();
    ctx.moveTo(200 - 14, m.mouthY + 8);
    ctx.quadraticCurveTo(200, m.chinY + 6, 200 + 14, m.mouthY + 8);
    ctx.quadraticCurveTo(200, m.mouthY + 4, 200 - 14, m.mouthY + 8);
    ctx.fill();
    return;
  }
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(200 - m.cheek + 10, m.noseY + 6);
  ctx.quadraticCurveTo(200 - m.jaw - 2, m.mouthY, 200 - m.jaw + 8, m.chinY - 4);
  ctx.quadraticCurveTo(200 - m.jaw + 16, m.mouthY, 200 - m.cheek + 18, m.noseY + 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(200 + m.cheek - 10, m.noseY + 6);
  ctx.quadraticCurveTo(200 + m.jaw + 2, m.mouthY, 200 + m.jaw - 8, m.chinY - 4);
  ctx.quadraticCurveTo(200 + m.jaw - 16, m.mouthY, 200 + m.cheek - 18, m.noseY + 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(200 - m.jaw + 6, m.chinY - 8);
  ctx.quadraticCurveTo(200, m.chinY + 8, 200 + m.jaw - 6, m.chinY - 8);
  ctx.quadraticCurveTo(200, m.mouthY + 8, 200 - m.jaw + 6, m.chinY - 8);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function paintPortrait(canvas: HTMLCanvasElement, spec: PortraitSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = canvas.width / 400;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const skin = skinHex(spec);
  const hairColor = hairHex(spec);
  const iris = eyeHex(spec);
  const shirt = shirtHex(spec);
  const m = metrics(spec);
  const path = facePath(m);

  const sky = ctx.createLinearGradient(0, 0, 0, 500);
  sky.addColorStop(0, '#c9d3c4');
  sky.addColorStop(1, '#e6dccb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 400, 500);

  ctx.fillStyle = mix(shirt, '#1a1410', 0.2);
  ctx.beginPath();
  ctx.moveTo(90, 500);
  ctx.quadraticCurveTo(130, 430, 168, m.chinY + 36);
  ctx.quadraticCurveTo(184, m.chinY + 24, 200, m.chinY + 34);
  ctx.quadraticCurveTo(216, m.chinY + 24, 232, m.chinY + 36);
  ctx.quadraticCurveTo(270, 430, 310, 500);
  ctx.fill();

  hairMass(ctx, m, spec, hairColor, 'back');

  ctx.fillStyle = mix(skin, '#2a1812', 0.12);
  ctx.beginPath();
  ctx.moveTo(200 - 22, m.chinY - 4);
  ctx.quadraticCurveTo(200 - 26, m.chinY + 40, 200 - 18, 460);
  ctx.lineTo(200 + 18, 460);
  ctx.quadraticCurveTo(200 + 26, m.chinY + 40, 200 + 22, m.chinY - 4);
  ctx.fill();

  const ear = (x: number) => {
    ctx.fillStyle = mix(skin, '#000000', 0.06);
    ellipse(ctx, x, m.eyeY + 16, 11, 16);
    ctx.fillStyle = mix(skin, '#3a2218', 0.16);
    ellipse(ctx, x, m.eyeY + 18, 5, 9);
  };
  ear(200 - m.cheek - 4);
  ear(200 + m.cheek + 4);

  ctx.save();
  ctx.clip(path);
  const lit = ctx.createRadialGradient(170, m.browY, 10, 210, m.noseY, 180);
  lit.addColorStop(0, mix(skin, '#fff1e6', 0.28));
  lit.addColorStop(0.5, skin);
  lit.addColorStop(1, mix(skin, '#4a3024', 0.2));
  ctx.fillStyle = lit;
  ctx.fillRect(40, 40, 320, 420);
  ctx.fillStyle = mix(skin, '#c45c4c', 0.35);
  ctx.globalAlpha = 0.18;
  ellipse(ctx, 200 - m.cheek * 0.55, m.noseY + 6, 18, 10);
  ellipse(ctx, 200 + m.cheek * 0.55, m.noseY + 8, 16, 9);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = mix(skin, '#2a1812', 0.4);
  ellipse(ctx, 200 - 36, m.eyeY, 22, 8);
  ellipse(ctx, 200 + 36, m.eyeY, 22, 8);
  ctx.globalAlpha = 1;
  eye(ctx, 200 - 34, m.eyeY, spec, iris, skin);
  eye(ctx, 200 + 34, m.eyeY, spec, iris, skin);
  brows(ctx, m, spec, hairColor === '#ddd6cc' ? '#8a8176' : mix(hairColor, '#1a140f', 0.1));
  nose(ctx, m, spec, skin);
  mouth(ctx, m, spec, skin);
  facialHair(ctx, m, spec, hairColor);
  ctx.restore();

  hairMass(ctx, m, spec, hairColor, 'front');
}
