import * as THREE from 'three';

/** Fingertips, in the hand's local space. +Z reaches, +Y is the back of the hand. */
const PINCH = new THREE.Vector3(0.0, -0.1, 1.24);

interface Finger {
  base: THREE.Group;
  mid: THREE.Group;
  tip: THREE.Group;
}

export interface HandRig {
  root: THREE.Group;
  pinch: THREE.Object3D;
  setSkin: (hex: string) => void;
  setSleeve: (hex: string) => void;
  setGrasp: (amount: number) => void;
  dispose: () => void;
}

function segmentGeometry(r0: number, r1: number, length: number): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const radius = r0 + (r1 - r0) * t;
    const belly = Math.sin(Math.PI * t) * Math.min(r0, r1) * 0.22;
    const cap = i === 0 || i === steps ? 0.86 : 1;
    points.push(new THREE.Vector2((radius + belly) * cap, length * t));
  }
  const geometry = new THREE.LatheGeometry(points, 18);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function knuckleMesh(radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), material);
  mesh.scale.set(1.22, 0.58, 0.92);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function nailPlate(width: number, length: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(width, length) * 0.5, 14, 10), material);
  mesh.scale.set(width / Math.max(width, length), 0.22, length / Math.max(width, length));
  mesh.castShadow = true;
  return mesh;
}

function makeFinger(
  skin: THREE.Material,
  nail: THREE.Material,
  x: number,
  length: number,
  radius: number,
  yaw: number,
): Finger {
  const proximal = length * 0.46;
  const middle = length * 0.32;
  const distal = length * 0.3;
  const base = new THREE.Group();
  base.position.set(x, 0.02, 0.22);
  base.rotation.y = yaw;

  const rootKnuckle = knuckleMesh(radius * 1.35, skin);
  rootKnuckle.position.set(0, radius * 0.35, 0.02);
  base.add(rootKnuckle);
  const proximalMesh = new THREE.Mesh(segmentGeometry(radius * 1.05, radius * 0.92, proximal), skin);
  proximalMesh.castShadow = true;
  base.add(proximalMesh);

  const mid = new THREE.Group();
  mid.position.z = proximal * 0.86;
  const midKnuckle = knuckleMesh(radius * 1.12, skin);
  midKnuckle.position.set(0, radius * 0.42, 0);
  mid.add(midKnuckle);
  const midMesh = new THREE.Mesh(segmentGeometry(radius * 0.96, radius * 0.8, middle), skin);
  midMesh.castShadow = true;
  mid.add(midMesh);

  const tip = new THREE.Group();
  tip.position.z = middle * 0.84;
  const tipKnuckle = knuckleMesh(radius * 0.9, skin);
  tipKnuckle.position.set(0, radius * 0.38, 0);
  tip.add(tipKnuckle);
  const tipMesh = new THREE.Mesh(segmentGeometry(radius * 0.82, radius * 0.62, distal), skin);
  tipMesh.castShadow = true;
  tip.add(tipMesh);
  const plate = nailPlate(radius * 1.15, distal * 0.62, nail);
  plate.position.set(0, radius * 0.72, distal * 0.58);
  tip.add(plate);

  mid.add(tip);
  base.add(mid);
  return { base, mid, tip };
}

function skinMaps(): { color: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 256;
  colorCanvas.height = 256;
  const colorCtx = colorCanvas.getContext('2d');
  if (!colorCtx) throw new Error('Could not draw skin.');
  colorCtx.fillStyle = '#fff7f3';
  colorCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = 90 + Math.random() * 80;
    colorCtx.fillStyle = `rgba(${shade}, ${shade * 0.62}, ${shade * 0.5}, ${0.04 + Math.random() * 0.08})`;
    colorCtx.fillRect(x, y, 1.4, 1.4);
  }
  const color = new THREE.CanvasTexture(colorCanvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = THREE.RepeatWrapping;
  color.wrapT = THREE.RepeatWrapping;
  color.repeat.set(2, 2);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bumpCtx = bumpCanvas.getContext('2d');
  if (!bumpCtx) throw new Error('Could not draw skin.');
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const v = 100 + Math.random() * 80;
    bumpCtx.fillStyle = `rgb(${v},${v},${v})`;
    bumpCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.colorSpace = THREE.LinearSRGBColorSpace;
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 2);
  return { color, bump };
}

export function createHand(): HandRig {
  const root = new THREE.Group();
  const maps = skinMaps();
  const skin = new THREE.MeshPhysicalMaterial({
    color: '#d7a57c',
    map: maps.color,
    bumpMap: maps.bump,
    bumpScale: 0.012,
    roughness: 0.52,
    metalness: 0,
    sheen: 0.55,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color('#ffd8c2'),
    clearcoat: 0.06,
    clearcoatRoughness: 0.6,
  });
  const crease = new THREE.MeshPhysicalMaterial({
    color: '#b48362',
    roughness: 0.72,
    metalness: 0,
  });
  const nail = new THREE.MeshPhysicalMaterial({
    color: '#f3d2c4',
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#3c5340', roughness: 0.9, metalness: 0 });

  const palmShape = new THREE.Shape();
  palmShape.moveTo(-0.34, 0.38);
  palmShape.lineTo(0.34, 0.36);
  palmShape.quadraticCurveTo(0.5, 0.22, 0.44, 0.02);
  palmShape.quadraticCurveTo(0.38, -0.26, 0.14, -0.4);
  palmShape.quadraticCurveTo(-0.14, -0.44, -0.28, -0.24);
  palmShape.quadraticCurveTo(-0.58, -0.02, -0.5, 0.2);
  palmShape.quadraticCurveTo(-0.44, 0.36, -0.34, 0.38);
  const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 10,
  });
  palmGeo.rotateX(Math.PI / 2);
  const palm = new THREE.Mesh(palmGeo, skin);
  palm.position.y = 0.02;
  palm.castShadow = true;
  palm.receiveShadow = true;
  root.add(palm);

  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 14), skin);
  heel.scale.set(1.25, 0.48, 0.85);
  heel.position.set(0.02, -0.02, -0.16);
  heel.castShadow = true;
  root.add(heel);

  const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), skin);
  thenar.scale.set(1.1, 0.6, 1.35);
  thenar.position.set(-0.26, 0.0, 0.02);
  thenar.castShadow = true;
  root.add(thenar);

  const fingers = [
    makeFinger(skin, nail, -0.33, 0.86, 0.1, -0.05),
    makeFinger(skin, nail, -0.11, 0.98, 0.105, -0.015),
    makeFinger(skin, nail, 0.11, 0.9, 0.098, 0.02),
    makeFinger(skin, nail, 0.32, 0.7, 0.082, 0.06),
  ];
  for (const finger of fingers) root.add(finger.base);

  const thumb = new THREE.Group();
  thumb.position.set(-0.46, 0.0, 0.02);
  const thumbMid = new THREE.Group();
  thumbMid.position.z = 0.26;
  const thumbKnuckle = knuckleMesh(0.11, skin);
  thumbKnuckle.position.y = 0.04;
  thumb.add(thumbKnuckle);
  const thumbBase = new THREE.Mesh(segmentGeometry(0.1, 0.086, 0.3), skin);
  thumbBase.castShadow = true;
  thumb.add(thumbBase);
  const thumbTipKnuckle = knuckleMesh(0.09, skin);
  thumbTipKnuckle.position.y = 0.045;
  thumbMid.add(thumbTipKnuckle);
  const thumbTip = new THREE.Mesh(segmentGeometry(0.084, 0.068, 0.26), skin);
  thumbTip.castShadow = true;
  thumbMid.add(thumbTip);
  const thumbNail = nailPlate(0.09, 0.14, nail);
  thumbNail.position.set(0, 0.07, 0.14);
  thumbMid.add(thumbNail);
  thumb.add(thumbMid);
  root.add(thumb);

  const wrist = new THREE.Mesh(segmentGeometry(0.15, 0.17, 0.2), skin);
  wrist.position.set(0.02, -0.02, -0.52);
  wrist.rotation.y = Math.PI;
  wrist.castShadow = true;
  root.add(wrist);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.175, 0.12, 18), sleeveMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0.02, -0.02, -0.66);
  cuff.castShadow = true;
  root.add(cuff);

  const pinch = new THREE.Object3D();
  pinch.position.copy(PINCH);
  root.add(pinch);

  const setGrasp = (amount: number) => {
    const g = THREE.MathUtils.clamp(amount, 0, 1);
    fingers.forEach((finger, index) => {
      const spread = (index - 1.5) * 0.03 * (1 - g * 0.5);
      finger.base.rotation.x = 0.06 + g * 0.7;
      finger.base.rotation.z = spread;
      finger.mid.rotation.x = 0.08 + g * 0.8;
      finger.tip.rotation.x = 0.05 + g * 0.45;
    });
    thumb.rotation.set(0.25 + g * 0.45, -0.85, 0.08);
    thumbMid.rotation.x = 0.1 + g * 0.65;
  };
  setGrasp(0.05);

  return {
    root,
    pinch,
    setSkin: (hex) => {
      skin.color.set(hex);
      skin.sheenColor.copy(skin.color.clone().lerp(new THREE.Color('#fff1e6'), 0.7));
      crease.color.copy(skin.color.clone().multiplyScalar(0.62));
      nail.color.copy(skin.color.clone().lerp(new THREE.Color('#ffe4d8'), 0.42));
    },
    setSleeve: (hex) => sleeveMat.color.set(hex),
    setGrasp,
    dispose: () => {
      skin.dispose();
      crease.dispose();
      nail.dispose();
      sleeveMat.dispose();
      maps.color.dispose();
      maps.bump.dispose();
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    },
  };
}

export function placeHand(rig: HandRig, target: THREE.Vector3, yaw: number, pitch: number, roll: number): void {
  rig.root.rotation.set(pitch, yaw, roll);
  const offset = PINCH.clone().multiply(rig.root.scale).applyEuler(rig.root.rotation);
  rig.root.position.copy(target).sub(offset);
}
