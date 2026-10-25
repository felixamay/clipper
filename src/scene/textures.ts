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

export function leafTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#2f6a38';
    ctx.beginPath();
    ctx.ellipse(64, 64, 26, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d4a26';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 16);
    ctx.lineTo(64, 112);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(64, 40);
    ctx.lineTo(40, 58);
    ctx.moveTo(64, 62);
    ctx.lineTo(88, 78);
    ctx.stroke();
  });
}
