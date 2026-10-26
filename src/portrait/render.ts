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

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const FACE = {
  oval: { jaw: 46, cheek: 72, temple: 66, brow: 58, crown: 44, chin: 14 },
  round: { jaw: 62, cheek: 80, temple: 74, brow: 66, crown: 56, chin: 4 },
  square: { jaw: 68, cheek: 74, temple: 70, brow: 62, crown: 48, chin: 2 },
  long: { jaw: 40, cheek: 62, temple: 56, brow: 50, crown: 36, chin: 22 },
  heart: { jaw: 34, cheek: 70, temple: 76, brow: 68, crown: 50, chin: 18 },
} as const;

function facePath(spec: PortraitSpec): Path2D {
  const p = FACE[spec.face];
  const cx = 200;
  const chinY = 352 + p.chin;
  const path = new Path2D();
  path.moveTo(cx, chinY);
  path.bezierCurveTo(cx - p.jaw, chinY - 8, cx - p.cheek, 300, cx - p.cheek + 2, 258);
  path.bezierCurveTo(cx - p.temple, 208, cx - p.brow, 158, cx - p.crown, 128);
  path.quadraticCurveTo(cx, 104, cx + p.crown, 128);
  path.bezierCurveTo(cx + p.brow, 158, cx + p.temple, 208, cx + p.cheek - 2, 258);
  path.bezierCurveTo(cx + p.cheek, 300, cx + p.jaw, chinY - 8, cx, chinY);
  path.closePath();
  return path;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function seedOf(spec: PortraitSpec): number {
  const text = [
    spec.skin,
    spec.face,
    spec.hairStyle,
    spec.hairColor,
    spec.eyeShape,
    spec.eyeColor,
    spec.brow,
    spec.nose,
    spec.mouth,
    spec.facialHair,
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  spec: PortraitSpec,
  iris: string,
  skin: string,
) {
  const open = spec.eyeShape === 'round' ? 13 : spec.eyeShape === 'narrow' ? 7.2 : spec.eyeShape === 'deep' ? 8.4 : 10.5;
  const wide = spec.eyeShape === 'narrow' ? 15.5 : 18;
  const y = 232;
  const tilt = spec.eyeShape === 'almond' ? 1.4 : 0;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - wide, y + 1);
  ctx.quadraticCurveTo(x, y - open - tilt, x + wide, y + tilt * 0.2);
  ctx.quadraticCurveTo(x, y + open * 0.95, x - wide, y + 1);
  ctx.clip();

  const sclera = ctx.createRadialGradient(x - 2, y - 1, 2, x, y, wide);
  sclera.addColorStop(0, '#fbf8f4');
  sclera.addColorStop(0.62, '#efe8df');
  sclera.addColorStop(1, '#d5ccc2');
  ctx.fillStyle = sclera;
  ctx.fillRect(x - wide - 2, y - open - 4, wide * 2 + 4, open * 2 + 10);

  const irisY = y + open * 0.06;
  const irisR = spec.eyeShape === 'narrow' ? 5.2 : 6.5;
  const irisGrad = ctx.createRadialGradient(x - 1.4, irisY - 1.6, 0.6, x + 0.2, irisY, irisR);
  irisGrad.addColorStop(0, mix(iris, '#fff4e8', 0.55));
  irisGrad.addColorStop(0.22, mix(iris, '#ffffff', 0.18));
  irisGrad.addColorStop(0.68, iris);
  irisGrad.addColorStop(0.88, mix(iris, '#120e0c', 0.45));
  irisGrad.addColorStop(1, '#16110e');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(x + 0.4, irisY, irisR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mix(iris, '#1a120e', 0.35);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(x + 0.4 + Math.cos(angle) * 1.5, irisY + Math.sin(angle) * 1.5);
    ctx.lineTo(x + 0.4 + Math.cos(angle) * irisR, irisY + Math.sin(angle) * irisR);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0c0b0a';
  ctx.beginPath();
  ctx.arc(x + 0.6, irisY + 0.3, irisR * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(x - 1.7, irisY - 1.8, 1.55, 1.05, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(x + 2.1, irisY + 1.5, 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = mix(skin, '#4a3028', 0.35);
  ctx.beginPath();
  ctx.moveTo(x - wide, y + 0.5);
  ctx.quadraticCurveTo(x, y - open - tilt, x + wide, y + tilt * 0.15);
  ctx.quadraticCurveTo(x, y - open * 0.62, x - wide, y + 0.5);
  ctx.fill();

  ctx.strokeStyle = '#24160f';
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const lx = x - wide + 2 + t * (wide * 2 - 4);
    const lift = Math.sin(t * Math.PI);
    const ly = y - open * lift * 0.72 + 0.4;
    ctx.lineWidth = 0.8 + lift * 0.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + (t - 0.45) * 5, ly - 4.5, lx + (t - 0.25) * 7, ly - 6.5 - lift);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const lx = x - wide * 0.7 + t * wide * 1.4;
    const ly = y + open * 0.72;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + (t - 0.5) * 2, ly + 3.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = mix(skin, '#2a1814', spec.eyeShape === 'deep' ? 0.55 : 0.38);
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = spec.eyeShape === 'deep' ? 2.4 : 1.5;
  ctx.beginPath();
  const crease = spec.eyeShape === 'deep' ? 9 : spec.eyeShape === 'round' ? 4.5 : 6;
  ctx.moveTo(x - wide + 1, y - 1);
  ctx.quadraticCurveTo(x, y - open - crease, x + wide - 1, y - 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(186, 112, 104, 0.7)';
  ellipse(ctx, x - wide + 2.4, y + 1.2, 2.3, 1.5);
}

function brows(ctx: CanvasRenderingContext2D, spec: PortraitSpec, color: string, random: () => number) {
  const arch = spec.brow === 'arched' ? 14 : spec.brow === 'straight' ? 3 : spec.brow === 'soft' ? 8 : 7;
  const hairs = spec.brow === 'thick' ? 18 : spec.brow === 'soft' ? 8 : 12;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < hairs; i++) {
      const t = i / (hairs - 1);
      const x = 200 + side * (14 + t * 42);
      const y = 206 - Math.sin(t * Math.PI) * arch + (random() - 0.5) * 1.4;
      ctx.strokeStyle = i % 3 === 0 ? mix(color, '#1a120e', 0.25) : color;
      ctx.globalAlpha = 0.55 + random() * 0.4;
      ctx.lineWidth = spec.brow === 'thick' ? 1.35 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.quadraticCurveTo(x + side * 4, y - 1, x + side * 8, y + 1.5);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function nose(ctx: CanvasRenderingContext2D, spec: PortraitSpec, skin: string) {
  const width = spec.nose === 'broad' ? 16 : spec.nose === 'narrow' ? 8 : spec.nose === 'soft' ? 11 : 12;
  const shadow = ctx.createRadialGradient(208, 292, 2, 208, 296, 24);
  shadow.addColorStop(0, 'rgba(70, 36, 28, 0.2)');
  shadow.addColorStop(1, 'rgba(70, 36, 28, 0)');
  ctx.fillStyle = shadow;
  ellipse(ctx, 208, 296, 12, 34);

  const bridge = ctx.createRadialGradient(194, 286, 1, 196, 290, 22);
  bridge.addColorStop(0, 'rgba(255, 248, 242, 0.28)');
  bridge.addColorStop(1, 'rgba(255, 248, 242, 0)');
  ctx.fillStyle = bridge;
  ellipse(ctx, 196, 292, 8, 18);

  const tip = ctx.createRadialGradient(200, 318, 1, 200, 320, width);
  tip.addColorStop(0, 'rgba(255, 246, 238, 0.4)');
  tip.addColorStop(1, 'rgba(255, 246, 238, 0)');
  ctx.fillStyle = tip;
  ellipse(ctx, 200, 320, width * 0.55, 7);

  ctx.fillStyle = rgba(mix(skin, '#3a2218', 0.2), 0.55);
  ellipse(ctx, 200 - width * 0.7, 324, width * 0.42, 5);
  ellipse(ctx, 200 + width * 0.74, 324, width * 0.42, 5.2);

  ctx.fillStyle = 'rgba(36, 16, 12, 0.62)';
  ctx.beginPath();
  ctx.ellipse(200 - width * 0.55, 326, Math.max(2.2, width * 0.2), 3.1, -0.45, 0, Math.PI * 2);
  ctx.ellipse(200 + width * 0.58, 326, Math.max(2.2, width * 0.2), 3.1, 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(40, 18, 14, 0.12)';
  ellipse(ctx, 200, 338, width, 5);
}

function mouth(ctx: CanvasRenderingContext2D, spec: PortraitSpec, skin: string) {
  const half = spec.mouth === 'wide' ? 28 : spec.mouth === 'narrow' ? 15 : 22;
  const full = spec.mouth === 'full' ? 13 : spec.mouth === 'soft' ? 8 : spec.mouth === 'narrow' ? 6.5 : 10;
  const y = 348;
  const upper = mix(skin, '#6a3030', 0.55);
  const lower = mix(skin, '#a85048', 0.42);
  ctx.fillStyle = 'rgba(70, 36, 32, 0.18)';
  ellipse(ctx, 200, y - 8, 8, 10);

  ctx.fillStyle = upper;
  ctx.beginPath();
  ctx.moveTo(200 - half, y);
  ctx.quadraticCurveTo(200 - half * 0.45, y - 7, 200, y - 1.5);
  ctx.quadraticCurveTo(200 + half * 0.45, y - 7, 200 + half, y);
  ctx.quadraticCurveTo(200 + half * 0.2, y + 2.4, 200, y + 2);
  ctx.quadraticCurveTo(200 - half * 0.2, y + 2.4, 200 - half, y);
  ctx.fill();

  const lip = ctx.createLinearGradient(200, y, 200, y + full);
  lip.addColorStop(0, mix(lower, '#4a2424', 0.25));
  lip.addColorStop(0.45, lower);
  lip.addColorStop(1, mix(lower, '#fff0ea', 0.28));
  ctx.fillStyle = lip;
  ctx.beginPath();
  ctx.moveTo(200 - half + 1, y + 1);
  ctx.quadraticCurveTo(200, y + full, 200 + half - 1, y + 1);
  ctx.quadraticCurveTo(200, y + 2.2, 200 - half + 1, y + 1);
  ctx.fill();

  ctx.strokeStyle = 'rgba(70, 24, 28, 0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(200 - half + 3, y + 0.6);
  ctx.quadraticCurveTo(200, y + 2.4, 200 + half - 3, y + 0.6);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(200 - half * 0.35, y + full * 0.48);
  ctx.quadraticCurveTo(200, y + full * 0.32, 200 + half * 0.35, y + full * 0.5);
  ctx.stroke();
}

function strokeHair(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  color: string,
  width: number,
  alpha = 1,
) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function hair(ctx: CanvasRenderingContext2D, spec: PortraitSpec, color: string, random: () => number, layer: 'back' | 'front') {
  const shade = mix(color, '#120e0c', 0.45);
  const mid = color;
  const light = mix(color, '#fff4e4', 0.42);
  const p = FACE[spec.face];
  if (spec.hairStyle === 'bald') {
    if (layer === 'back') return;
    ctx.strokeStyle = rgba(shade, 0.35);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(200 - p.crown, 150);
    ctx.quadraticCurveTo(200, 132, 200 + p.crown, 150);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ellipse(ctx, 168, 168, 28, 16);
    return;
  }
  if (layer === 'back' && spec.hairStyle !== 'long' && spec.hairStyle !== 'wavy') return;

  const sideLock = (dir: number) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(200 + dir * 62, 188);
    ctx.bezierCurveTo(200 + dir * 108, 250, 200 + dir * 96, 390, 200 + dir * 70, 478);
    ctx.lineTo(200 + dir * 46, 478);
    ctx.bezierCurveTo(200 + dir * 58, 360, 200 + dir * 64, 250, 200 + dir * 48, 196);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const x = 200 + dir * (52 + t * 18);
      strokeHair(
        ctx,
        x,
        200,
        x + dir * (10 + random() * 16),
        320 + random() * 40,
        x + dir * (6 + Math.sin(i) * 8),
        460,
        i % 3 === 0 ? light : mid,
        1.1,
        0.45,
      );
    }
  };

  if (layer === 'back' && (spec.hairStyle === 'long' || spec.hairStyle === 'wavy')) {
    sideLock(-1);
    sideLock(1);
    if (spec.hairStyle === 'wavy') {
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 8; i++) {
          const x = 200 + dir * (58 + i * 3);
          strokeHair(ctx, x, 230, x + dir * 24, 300 + i * 8, x + dir * 4, 420, light, 1.3, 0.35);
        }
      }
    }
  }

  if (layer === 'back') return;

  const drawCap = (top: number, side: number, brow: number) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(200 - side, brow + 8);
    ctx.bezierCurveTo(200 - side - 8, 150, 200 - 40, top, 200, top - 4);
    ctx.bezierCurveTo(200 + 40, top, 200 + side + 8, 150, 200 + side, brow + 8);
    ctx.quadraticCurveTo(200, brow + 18, 200 - side, brow + 8);
    ctx.fill();
  };

  if (spec.hairStyle === 'crop') drawCap(118, p.temple - 4, 186);
  else if (spec.hairStyle === 'short') drawCap(108, p.temple + 6, 198);
  else if (spec.hairStyle === 'bun') drawCap(112, p.temple - 2, 176);
  else if (spec.hairStyle === 'coily' || spec.hairStyle === 'curly') {
    const tight = spec.hairStyle === 'coily';
    const count = tight ? 40 : 26;
    for (let i = 0; i < count; i++) {
      const band = i / count;
      const angle = -2.5 + band * 5;
      const cx = 200 + Math.cos(angle) * (50 + (i % 3) * 9);
      const cy = 158 + Math.sin(angle) * 16 - (i % 2) * (tight ? 8 : 14);
      const radius = tight ? 9 + (i % 3) : 14 + (i % 3);
      ctx.fillStyle = i % 4 === 0 ? light : i % 3 === 0 ? shade : mid;
      ctx.beginPath();
      ctx.arc(cx, Math.max(124, Math.min(196, cy)), radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(200, 178, p.temple - 6, 26, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else {
    drawCap(100, p.temple + 4, 188);
  }

  if (spec.hairStyle === 'bun') {
    ctx.fillStyle = shade;
    ellipse(ctx, 214, 108, 30, 26);
    ctx.fillStyle = mid;
    ellipse(ctx, 214, 108, 24, 20);
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(208, 100, 12, 0.4, 2.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (spec.hairStyle === 'short') {
    for (const dir of [-1, 1]) {
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.moveTo(200 + dir * p.temple, 190);
      ctx.quadraticCurveTo(200 + dir * (p.temple + 10), 236, 200 + dir * (p.temple - 8), 258);
      ctx.quadraticCurveTo(200 + dir * (p.temple - 16), 220, 200 + dir * (p.temple - 6), 190);
      ctx.fill();
    }
  }

  const hairline = spec.hairStyle === 'coily' || spec.hairStyle === 'curly' ? 188 : spec.hairStyle === 'crop' ? 192 : 180;
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = 146 + t * 108;
    const tone = i % 3 === 0 ? light : mid;
    strokeHair(ctx, x, hairline - 6, x + (random() - 0.5) * 4, hairline + 4, x + (random() - 0.5) * 3, hairline + 12, tone, 1.05, 0.55);
  }
}

function stipple(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, shade: string, random: () => number, alpha: number) {
  for (let i = 0; i < 80; i++) {
    const x = x0 + random() * (x1 - x0);
    const y = y0 + random() * (y1 - y0);
    ctx.fillStyle = random() > 0.45 ? color : shade;
    ctx.globalAlpha = alpha * (0.45 + random() * 0.55);
    ctx.fillRect(x, y, 1.4, 1.6);
  }
  ctx.globalAlpha = 1;
}

function facialHair(ctx: CanvasRenderingContext2D, spec: PortraitSpec, color: string, random: () => number) {
  if (spec.facialHair === 'none') return;
  const shade = mix(color, '#100e0c', 0.35);
  if (spec.facialHair === 'stubble') {
    stipple(ctx, 158, 308, 242, 368, color, shade, random, 0.45);
    return;
  }
  ctx.fillStyle = rgba(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(174, 332);
  ctx.quadraticCurveTo(186, 318, 200, 326);
  ctx.quadraticCurveTo(214, 318, 226, 332);
  ctx.quadraticCurveTo(214, 338, 200, 332);
  ctx.quadraticCurveTo(186, 338, 174, 332);
  ctx.fill();
  if (spec.facialHair === 'mustache') return;
  if (spec.facialHair === 'goatee') {
    ctx.fillStyle = rgba(color, 0.78);
    ctx.beginPath();
    ctx.moveTo(184, 352);
    ctx.quadraticCurveTo(186, 378, 200, 384);
    ctx.quadraticCurveTo(214, 378, 216, 352);
    ctx.quadraticCurveTo(200, 360, 184, 352);
    ctx.fill();
    stipple(ctx, 184, 350, 216, 384, color, shade, random, 0.65);
    return;
  }
  ctx.fillStyle = rgba(shade, 0.55);
  ctx.beginPath();
  ctx.moveTo(148, 268);
  ctx.quadraticCurveTo(136, 320, 162, 352);
  ctx.quadraticCurveTo(170, 300, 166, 262);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(252, 268);
  ctx.quadraticCurveTo(264, 320, 238, 352);
  ctx.quadraticCurveTo(230, 300, 234, 262);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(164, 348);
  ctx.quadraticCurveTo(168, 378, 200, 384);
  ctx.quadraticCurveTo(232, 378, 236, 348);
  ctx.quadraticCurveTo(200, 362, 164, 348);
  ctx.fill();
  stipple(ctx, 146, 270, 176, 360, color, shade, random, 0.55);
  stipple(ctx, 224, 270, 254, 360, color, shade, random, 0.55);
  stipple(ctx, 166, 346, 234, 382, color, shade, random, 0.6);
}

function skinGrain(ctx: CanvasRenderingContext2D, path: Path2D, random: () => number) {
  ctx.save();
  ctx.clip(path);
  for (let i = 0; i < 700; i++) {
    const x = 120 + random() * 160;
    const y = 140 + random() * 230;
    const v = random();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,20,16,0.05)';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

export function paintPortrait(canvas: HTMLCanvasElement, spec: PortraitSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = canvas.width / 400;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const random = rng(seedOf(spec));
  const skin = skinHex(spec);
  const hairColor = hairHex(spec);
  const iris = eyeHex(spec);
  const shirt = shirtHex(spec);
  const path = facePath(spec);
  const p = FACE[spec.face];

  const sky = ctx.createLinearGradient(0, 0, 0, 500);
  sky.addColorStop(0, '#c5d0c2');
  sky.addColorStop(0.55, '#e4d9c8');
  sky.addColorStop(1, '#d9cbb8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 400, 500);

  ctx.fillStyle = mix(shirt, '#1c1612', 0.25);
  ctx.beginPath();
  ctx.moveTo(78, 500);
  ctx.quadraticCurveTo(110, 430, 150, 392);
  ctx.quadraticCurveTo(176, 378, 200, 396);
  ctx.quadraticCurveTo(224, 378, 250, 392);
  ctx.quadraticCurveTo(290, 430, 322, 500);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(150, 396);
  ctx.quadraticCurveTo(168, 430, 156, 500);
  ctx.lineTo(244, 500);
  ctx.quadraticCurveTo(232, 430, 250, 396);
  ctx.quadraticCurveTo(220, 414, 200, 404);
  ctx.quadraticCurveTo(180, 414, 150, 396);
  ctx.fill();

  hair(ctx, spec, hairColor, random, 'back');

  ctx.fillStyle = mix(skin, '#2a1812', 0.18);
  ctx.beginPath();
  ctx.moveTo(172, 348);
  ctx.quadraticCurveTo(166, 400, 160, 448);
  ctx.lineTo(240, 448);
  ctx.quadraticCurveTo(234, 400, 228, 348);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 20, 16, 0.18)';
  ellipse(ctx, 200, 392, 22, 10);

  const ear = (x: number, flip: number) => {
    ctx.save();
    ctx.translate(x, 252);
    ctx.scale(flip, 1);
    ctx.fillStyle = mix(skin, '#000000', 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(skin, '#3a2218', 0.22);
    ctx.beginPath();
    ctx.ellipse(-1, 2, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 30, 28, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-1, 6, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  ear(200 - p.cheek - 2, 1);
  ear(200 + p.cheek + 2, -1);

  ctx.save();
  ctx.clip(path);
  const base = ctx.createRadialGradient(168, 188, 16, 210, 260, 210);
  base.addColorStop(0, mix(skin, '#fff3ea', 0.34));
  base.addColorStop(0.45, skin);
  base.addColorStop(1, mix(skin, '#4a3024', 0.22));
  ctx.fillStyle = base;
  ctx.fillRect(80, 80, 260, 320);

  const socket = ctx.createRadialGradient(156, 214, 2, 156, 216, 26);
  socket.addColorStop(0, 'rgba(70, 36, 28, 0.22)');
  socket.addColorStop(1, 'rgba(70, 36, 28, 0)');
  ctx.fillStyle = socket;
  ellipse(ctx, 156, 214, 26, 12);
  const socketRight = ctx.createRadialGradient(244, 214, 2, 244, 216, 26);
  socketRight.addColorStop(0, 'rgba(70, 36, 28, 0.22)');
  socketRight.addColorStop(1, 'rgba(70, 36, 28, 0)');
  ctx.fillStyle = socketRight;
  ellipse(ctx, 244, 214, 26, 12);
  const jaw = ctx.createRadialGradient(200, 360, 4, 200, 358, 48);
  jaw.addColorStop(0, 'rgba(50, 26, 20, 0.16)');
  jaw.addColorStop(1, 'rgba(50, 26, 20, 0)');
  ctx.fillStyle = jaw;
  ellipse(ctx, 200, 358, 46, 16);

  const blush = ctx.createRadialGradient(150, 292, 2, 150, 292, 28);
  blush.addColorStop(0, rgba(mix(skin, '#c45a4a', 0.55), 0.22));
  blush.addColorStop(1, rgba(mix(skin, '#c45a4a', 0.55), 0));
  ctx.fillStyle = blush;
  ellipse(ctx, 150, 292, 28, 16);
  const blushRight = ctx.createRadialGradient(252, 296, 2, 252, 296, 26);
  blushRight.addColorStop(0, rgba(mix(skin, '#c45a4a', 0.55), 0.16));
  blushRight.addColorStop(1, rgba(mix(skin, '#c45a4a', 0.55), 0));
  ctx.fillStyle = blushRight;
  ellipse(ctx, 252, 296, 26, 14);

  ctx.fillStyle = 'rgba(255, 250, 244, 0.28)';
  ellipse(ctx, 156, 176, 36, 18);
  ellipse(ctx, 186, 300, 10, 22);
  ctx.restore();

  eye(ctx, 162, spec, iris, skin);
  eye(ctx, 238, spec, iris, skin);
  nose(ctx, spec, skin);
  mouth(ctx, spec, skin);
  facialHair(ctx, spec, hairColor, random);
  hair(ctx, spec, hairColor, random, 'front');
  brows(ctx, spec, hairColor === '#ddd6cc' ? '#8d8478' : mix(hairColor, '#1a140f', 0.15), random);
  skinGrain(ctx, path, random);

  if (spec.hairStyle !== 'bald') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const fringe = spec.hairStyle === 'long' || spec.hairStyle === 'wavy' ? 8 : 0;
    for (let i = 0; i < fringe; i++) {
      const x = 150 + i * 7;
      strokeHair(ctx, x, 156, x + 2, 176, x - 2, 196, i % 2 ? hairColor : mix(hairColor, '#fff', 0.25), 1.2, 0.55);
    }
    ctx.restore();
  }
}
