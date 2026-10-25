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
  return canvasTexture(128, 160, (ctx) => {
    ctx.clearRect(0, 0, 128, 160);
    const leaf = new Path2D();
    leaf.moveTo(64, 8);
    leaf.bezierCurveTo(108, 36, 112, 96, 64, 150);
    leaf.bezierCurveTo(16, 96, 20, 36, 64, 8);
    const fill = ctx.createLinearGradient(20, 20, 100, 140);
    fill.addColorStop(0, '#8fbf63');
    fill.addColorStop(0.45, '#4f8d3e');
    fill.addColorStop(1, '#2f6a32');
    ctx.fillStyle = fill;
    ctx.fill(leaf);
    ctx.strokeStyle = '#24562c';
    ctx.lineWidth = 2;
    ctx.stroke(leaf);
    ctx.strokeStyle = '#d7e7b0';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(64, 18);
    ctx.lineTo(64, 142);
    ctx.moveTo(64, 48);
    ctx.lineTo(42, 64);
    ctx.moveTo(64, 72);
    ctx.lineTo(90, 90);
    ctx.moveTo(64, 96);
    ctx.lineTo(40, 112);
    ctx.stroke();
  });
}

export function dappleTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 36; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const rx = 28 + Math.random() * 70;
      const ry = 16 + Math.random() * 40;
      const grad = ctx.createRadialGradient(x, y, 4, x, y, rx);
      grad.addColorStop(0, 'rgba(70, 90, 50, 0.16)');
      grad.addColorStop(0.6, 'rgba(90, 110, 60, 0.07)');
      grad.addColorStop(1, 'rgba(90, 110, 60, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 36);
      grad.addColorStop(0, 'rgba(255, 236, 190, 0.16)');
      grad.addColorStop(1, 'rgba(255, 236, 190, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 36, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 1);
}
