import { PortraitSpec, eyeHex, hairHex, shirtHex, skinHex } from './palette';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgb(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const channel = (n: number, goal: number) => Math.max(0, Math.min(255, Math.round(n + (goal - n) * t)));
  return `rgb(${channel(r, target)}, ${channel(g, target)}, ${channel(b, target)})`;
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
  path.bezierCurveTo(cx - p.jaw, chinY - 10, cx - p.cheek, 304, cx - p.cheek + 4, 260);
  path.bezierCurveTo(cx - p.temple, 210, cx - p.brow, 160, cx - p.crown, 132);
  path.quadraticCurveTo(cx, 108, cx + p.crown, 132);
  path.bezierCurveTo(cx + p.brow, 160, cx + p.temple, 210, cx + p.cheek - 4, 260);
  path.bezierCurveTo(cx + p.cheek, 304, cx + p.jaw, chinY - 10, cx, chinY);
  path.closePath();
  return path;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  shape: PortraitSpec['eyeShape'],
  iris: string,
  skin: string,
) {
  const open = shape === 'round' ? 12 : shape === 'narrow' ? 7 : shape === 'deep' ? 8 : 10;
  ctx.fillStyle = 'rgba(50, 24, 16, 0.22)';
  ellipse(ctx, x, 234, 28, 16);
  ctx.fillStyle = '#f6f1e8';
  ellipse(ctx, x, 230, 17, open);
  const irisGrad = ctx.createRadialGradient(x - 2, 227, 1, x + 1, 230, 7);
  irisGrad.addColorStop(0, rgb(iris, 0.4));
  irisGrad.addColorStop(0.65, iris);
  irisGrad.addColorStop(1, '#140e0c');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(x + 1, 230, shape === 'narrow' ? 5.2 : 6.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d0b0a';
  ctx.beginPath();
  ctx.arc(x + 1.2, 230.4, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x - 1.1, 228, 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgb(skin, -0.05);
  ctx.beginPath();
  ctx.moveTo(x - 18, 228);
  ctx.quadraticCurveTo(x, 214 - (shape === 'deep' ? 2 : 0), x + 18, 229);
  ctx.quadraticCurveTo(x, 224, x - 18, 228);
  ctx.fill();
  ctx.strokeStyle = '#24160f';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 17, 229);
  ctx.quadraticCurveTo(x, 216, x + 17, 229);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80, 36, 28, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 14, 232);
  ctx.quadraticCurveTo(x, 230 + open, x + 14, 233);
  ctx.stroke();
}

function brows(ctx: CanvasRenderingContext2D, spec: PortraitSpec, color: string) {
  const arch = spec.brow === 'arched' ? 16 : spec.brow === 'straight' ? 4 : spec.brow === 'soft' ? 10 : 8;
  const weight = spec.brow === 'thick' ? 3.2 : spec.brow === 'soft' ? 1.4 : 2.2;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const strokes = spec.brow === 'thick' ? 5 : 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < strokes; i++) {
      ctx.lineWidth = weight - i * 0.25;
      ctx.globalAlpha = 0.75 - i * 0.08;
      ctx.beginPath();
      const y = 206 + i * 1.3;
      ctx.moveTo(200 + side * 58, y + 4);
      ctx.quadraticCurveTo(200 + side * 36, y - arch, 200 + side * 14, y + 1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function nose(ctx: CanvasRenderingContext2D, spec: PortraitSpec, skin: string) {
  const width = spec.nose === 'broad' ? 16 : spec.nose === 'narrow' ? 8 : spec.nose === 'soft' ? 11 : 12;
  ctx.fillStyle = rgb(skin, -0.35);
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.moveTo(196, 228);
  ctx.quadraticCurveTo(188, 280, 200 - width, 312);
  ctx.quadraticCurveTo(196, 292, 200, 250);
  ctx.fill();
  ctx.globalAlpha = 0.32;
  ellipse(ctx, 200 - width + 2, 314, width * 0.28, 3.4);
  ellipse(ctx, 200 + width - 2, 314, width * 0.3, 3.6);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(198, 236);
  ctx.quadraticCurveTo(196, 280, 199, 308);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function mouth(ctx: CanvasRenderingContext2D, spec: PortraitSpec, skin: string) {
  const half = spec.mouth === 'wide' ? 30 : spec.mouth === 'narrow' ? 16 : 24;
  const full = spec.mouth === 'full' ? 14 : spec.mouth === 'soft' ? 9 : spec.mouth === 'narrow' ? 7 : 11;
  const y = 338;
  const { r, g, b } = hexToRgb(skin);
  const upper = `rgb(${Math.min(255, r * 0.62 + 70)}, ${g * 0.42 + 24}, ${b * 0.4 + 22})`;
  const lower = `rgb(${Math.min(255, r * 0.7 + 90)}, ${g * 0.5 + 40}, ${b * 0.48 + 36})`;
  ctx.fillStyle = upper;
  ctx.beginPath();
  ctx.moveTo(200 - half, y);
  ctx.quadraticCurveTo(200 - half * 0.4, y - 8, 200, y - 1);
  ctx.quadraticCurveTo(200 + half * 0.4, y - 8, 200 + half, y);
  ctx.quadraticCurveTo(200, y + 3, 200 - half, y);
  ctx.fill();
  ctx.fillStyle = lower;
  ctx.beginPath();
  ctx.moveTo(200 - half + 1, y + 1);
  ctx.quadraticCurveTo(200, y + full, 200 + half - 1, y + 1);
  ctx.quadraticCurveTo(200, y + 3, 200 - half + 1, y + 1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 30, 32, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200 - half + 4, y + 0.5);
  ctx.quadraticCurveTo(200, y + 3, 200 + half - 4, y + 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(200 - half * 0.4, y + full * 0.45);
  ctx.quadraticCurveTo(200, y + full * 0.25, 200 + half * 0.4, y + full * 0.5);
  ctx.stroke();
}

function hair(ctx: CanvasRenderingContext2D, spec: PortraitSpec, color: string) {
  const p = FACE[spec.face];
  const left = 200 - p.temple - 8;
  const right = 200 + p.temple + 8;
  const shade = rgb(color, -0.3);
  const light = rgb(color, 0.4);
  ctx.fillStyle = color;
  if (spec.hairStyle === 'bald') {
    ctx.strokeStyle = shade;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 156);
    ctx.quadraticCurveTo(200, 140, 250, 158);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  if (spec.hairStyle === 'long' || spec.hairStyle === 'wavy') {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(124, 210);
    ctx.bezierCurveTo(70, 280, 78, 400, 108, 470);
    ctx.lineTo(148, 470);
    ctx.bezierCurveTo(130, 380, 140, 280, 164, 220);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(276, 210);
    ctx.bezierCurveTo(330, 280, 322, 400, 292, 470);
    ctx.lineTo(252, 470);
    ctx.bezierCurveTo(270, 380, 260, 280, 236, 220);
    ctx.fill();
    ctx.fillStyle = color;
    if (spec.hairStyle === 'wavy') {
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
  ctx.beginPath();
  if (spec.hairStyle === 'crop') {
    ctx.moveTo(left + 10, 200);
    ctx.bezierCurveTo(left, 140, 170, 112, 200, 112);
    ctx.bezierCurveTo(230, 112, right, 140, right - 10, 200);
    ctx.bezierCurveTo(right - 20, 170, 220, 160, 200, 164);
    ctx.bezierCurveTo(180, 160, left + 20, 170, left + 10, 200);
  } else if (spec.hairStyle === 'coily' || spec.hairStyle === 'curly') {
    const lift = spec.hairStyle === 'coily' ? 70 : 90;
    ctx.moveTo(left - 6, 220);
    ctx.bezierCurveTo(left - 30, 140, 150, lift, 200, lift - 6);
    ctx.bezierCurveTo(250, lift, right + 30, 140, right + 6, 220);
    ctx.bezierCurveTo(right, 160, 230, lift + 24, 200, lift + 30);
    ctx.bezierCurveTo(170, lift + 24, left, 160, left - 6, 220);
  } else {
    ctx.moveTo(left, 216);
    ctx.bezierCurveTo(left - 10, 150, 160, 96, 200, 96);
    ctx.bezierCurveTo(240, 96, right + 10, 150, right, 216);
    ctx.bezierCurveTo(right - 16, 170, 228, 156, 200, 160);
    ctx.bezierCurveTo(172, 156, left + 16, 170, left, 216);
  }
  ctx.fill();
  if (spec.hairStyle === 'bun') {
    ellipse(ctx, 226, 104, 28, 26);
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.35;
    ellipse(ctx, 216, 96, 10, 7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
  }
  if (spec.hairStyle === 'short') {
    ctx.beginPath();
    ctx.moveTo(left, 200);
    ctx.quadraticCurveTo(left - 8, 250, left + 22, 258);
    ctx.quadraticCurveTo(left + 6, 230, left + 16, 200);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(right, 200);
    ctx.quadraticCurveTo(right + 8, 250, right - 22, 258);
    ctx.quadraticCurveTo(right - 6, 230, right - 16, 200);
    ctx.fill();
  }
  ctx.strokeStyle = light;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(158, 132);
  ctx.quadraticCurveTo(200, 108, 246, 130);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function facialHair(ctx: CanvasRenderingContext2D, spec: PortraitSpec, color: string) {
  if (spec.facialHair === 'none') return;
  ctx.fillStyle = color;
  if (spec.facialHair === 'stubble') {
    ctx.globalAlpha = 0.35;
    for (let y = 308; y <= 362; y += 4) {
      for (let x = 160; x <= 240; x += 4) {
        const dx = (x - 200) / 48;
        const dy = (y - 338) / 32;
        if (dx * dx + dy * dy > 1) continue;
        if (y < 330 && Math.abs(x - 200) < 16) continue;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.beginPath();
  ctx.moveTo(170, 328);
  ctx.quadraticCurveTo(184, 314, 200, 324);
  ctx.quadraticCurveTo(216, 314, 230, 328);
  ctx.quadraticCurveTo(214, 334, 200, 328);
  ctx.quadraticCurveTo(186, 334, 170, 328);
  ctx.fill();
  if (spec.facialHair === 'mustache') return;
  if (spec.facialHair === 'goatee') {
    ctx.beginPath();
    ctx.moveTo(180, 350);
    ctx.quadraticCurveTo(182, 378, 200, 386);
    ctx.quadraticCurveTo(218, 378, 220, 350);
    ctx.quadraticCurveTo(200, 362, 180, 350);
    ctx.fill();
    return;
  }
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(138, 260);
  ctx.quadraticCurveTo(126, 310, 154, 346);
  ctx.quadraticCurveTo(148, 300, 164, 258);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(262, 260);
  ctx.quadraticCurveTo(274, 310, 246, 346);
  ctx.quadraticCurveTo(252, 300, 236, 258);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(160, 344);
  ctx.quadraticCurveTo(162, 386, 200, 396);
  ctx.quadraticCurveTo(238, 386, 240, 344);
  ctx.quadraticCurveTo(200, 366, 160, 344);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function grain(ctx: CanvasRenderingContext2D) {
  const image = ctx.getImageData(0, 0, 400, 500);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 5;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

export function paintPortrait(canvas: HTMLCanvasElement, spec: PortraitSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const skin = skinHex(spec);
  const hairColor = hairHex(spec);
  const iris = eyeHex(spec);
  const shirt = shirtHex(spec);
  ctx.clearRect(0, 0, 400, 500);
  const bg = ctx.createLinearGradient(0, 0, 0, 500);
  bg.addColorStop(0, '#b9c6b6');
  bg.addColorStop(0.6, '#d7d1c4');
  bg.addColorStop(1, '#c3bdb0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 400, 500);

  ctx.fillStyle = rgb(shirt, -0.2);
  ctx.beginPath();
  ctx.moveTo(96, 500);
  ctx.lineTo(122, 400);
  ctx.quadraticCurveTo(160, 368, 200, 392);
  ctx.quadraticCurveTo(240, 368, 278, 400);
  ctx.lineTo(304, 500);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.fillRect(176, 400, 48, 100);

  const path = facePath(spec);
  ctx.save();
  ctx.fillStyle = rgb(skin, -0.08);
  ctx.beginPath();
  ctx.moveTo(176, 360);
  ctx.quadraticCurveTo(170, 400, 166, 430);
  ctx.lineTo(234, 430);
  ctx.quadraticCurveTo(230, 400, 224, 360);
  ctx.fill();
  const p = FACE[spec.face];
  const earX = 200 - p.cheek;
  ctx.fillStyle = rgb(skin, -0.1);
  ellipse(ctx, earX, 250, 13, 20);
  ellipse(ctx, 400 - earX, 250, 13, 20);
  ctx.fillStyle = skin;
  ctx.fill(path);
  ctx.clip(path);
  const key = ctx.createRadialGradient(150, 170, 10, 210, 250, 190);
  key.addColorStop(0, rgb(skin, 0.32));
  key.addColorStop(0.45, skin);
  key.addColorStop(1, rgb(skin, -0.38));
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, 400, 500);
  ctx.fillStyle = rgb(skin, -0.45);
  ctx.globalAlpha = 0.22;
  ellipse(ctx, 268, 250, 54, 100);
  ctx.globalAlpha = 0.18;
  ellipse(ctx, 162, 214, 30, 14);
  ellipse(ctx, 238, 214, 30, 14);
  ctx.fillStyle = `rgba(${hexToRgb(skin).r + 30}, ${hexToRgb(skin).g * 0.6}, ${hexToRgb(skin).b * 0.6}, 0.28)`;
  ctx.globalAlpha = 1;
  ellipse(ctx, 156, 292, 26, 14);
  ctx.globalAlpha = 0.7;
  ellipse(ctx, 246, 296, 22, 12);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#fff';
  ellipse(ctx, 150, 168, 40, 22);
  ctx.globalAlpha = 1;
  ctx.restore();

  eye(ctx, 162, spec.eyeShape, iris, skin);
  eye(ctx, 238, spec.eyeShape, iris, skin);
  brows(ctx, spec, hairColor === '#ddd6cc' ? '#8a8176' : rgb(hairColor, -0.2));
  nose(ctx, spec, skin);
  mouth(ctx, spec, skin);
  facialHair(ctx, spec, hairColor);
  hair(ctx, spec, hairColor);
  grain(ctx);
}
