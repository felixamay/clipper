import * as THREE from 'three';

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw a texture.');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

export function woodTexture(base: string, grain: string, repeat: number): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const y = (i * 5.7) % 512;
      ctx.strokeStyle = grain;
      ctx.globalAlpha = 0.08 + (i % 4) * 0.04;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = grain;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 1);
    }
  }, repeat);
}

export function grassTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#5d7a3c';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const tone = Math.random();
      ctx.strokeStyle = tone < 0.2 ? '#8ea85a' : tone < 0.55 ? '#6d8c45' : tone < 0.85 ? '#456532' : '#c4b48a';
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 6);
      ctx.stroke();
    }
  }, 6);
}

export function barkTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 512, (ctx) => {
    ctx.fillStyle = '#5c4030';
    ctx.fillRect(0, 0, 256, 512);
    for (let x = 0; x < 256; x += 7) {
      ctx.strokeStyle = x % 2 === 0 ? '#3a281c' : '#7a5a40';
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2 + (x % 3);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 16) ctx.lineTo(x + Math.sin(y * 0.05 + x) * 3, y);
      ctx.stroke();
    }
  }, 1);
}

export function leafTexture(kind: 'sun' | 'shade' = 'sun'): THREE.CanvasTexture {
  return canvasTexture(128, 168, (ctx) => {
    ctx.clearRect(0, 0, 128, 168);
    const leaf = new Path2D();
    leaf.moveTo(64, 6);
    leaf.bezierCurveTo(102, 28, 118, 78, 96, 118);
    leaf.bezierCurveTo(86, 146, 70, 162, 64, 162);
    leaf.bezierCurveTo(58, 162, 42, 146, 32, 118);
    leaf.bezierCurveTo(10, 78, 26, 28, 64, 6);
    const sunlit = kind === 'sun';
    const fill = ctx.createLinearGradient(24, 10, 100, 150);
    fill.addColorStop(0, sunlit ? '#c6dd78' : '#6fa356');
    fill.addColorStop(0.42, sunlit ? '#5f9a40' : '#3d7a38');
    fill.addColorStop(1, sunlit ? '#2f6b30' : '#1e4a28');
    ctx.fillStyle = fill;
    ctx.fill(leaf);
    ctx.strokeStyle = sunlit ? '#24562a' : '#16361c';
    ctx.lineWidth = 2;
    ctx.stroke(leaf);
    ctx.strokeStyle = sunlit ? '#e7f3c4' : '#b7d48a';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(64, 16);
    ctx.quadraticCurveTo(66, 90, 64, 154);
    for (const y of [40, 62, 84, 108, 130]) {
      ctx.moveTo(64, y);
      ctx.quadraticCurveTo(48, y + 6, 36, y + 14);
      ctx.moveTo(64, y + 6);
      ctx.quadraticCurveTo(80, y + 12, 92, y + 18);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = sunlit ? '#f4ffd8' : '#d5ecc0';
    ctx.beginPath();
    ctx.ellipse(52, 48, 10, 16, -0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function dappleTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    let seed = 0x51a7;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 70; i++) {
      const x = next() * 512;
      const y = next() * 512;
      const rx = 10 + next() * 26;
      const ry = 6 + next() * 16;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, rx);
      grad.addColorStop(0, 'rgba(62, 84, 42, 0.1)');
      grad.addColorStop(1, 'rgba(62, 84, 42, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, next() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 28; i++) {
      const x = next() * 512;
      const y = next() * 512;
      const radius = 14 + next() * 22;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, radius);
      grad.addColorStop(0, 'rgba(255, 236, 196, 0.14)');
      grad.addColorStop(1, 'rgba(255, 236, 196, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 1);
}
