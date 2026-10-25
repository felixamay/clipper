import * as THREE from 'three';

/** Fingertips, in the hand's local space. +Z reaches, +Y is the back of the hand. */
const PINCH = new THREE.Vector3(0.0, -0.02, 1.28);

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
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const radius = r0 + (r1 - r0) * t;
    const belly = Math.sin(Math.PI * t) * Math.min(r0, r1) * 0.16;
    const cap = i === 0 || i === steps ? 0.9 : 1;
    points.push(new THREE.Vector2((radius + belly) * cap, length * t));
  }
  const geometry = new THREE.LatheGeometry(points, 20);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function knuckleMesh(radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
  mesh.scale.set(1.08, 0.62, 0.86);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function nailMesh(width: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(width, 16, 12), material);
  mesh.scale.set(0.92, 0.28, 1.45);
  mesh.castShadow = true;
  return mesh;
}

function makeFinger(
  skin: THREE.Material,
  nail: THREE.Material,
  x: number,
  length: number,
  radius: number,
): Finger {
  const proximal = length * 0.42;
  const middle = length * 0.31;
  const distal = length * 0.27;
  const base = new THREE.Group();
  base.position.set(x, 0.05, 0.26);
  base.add(knuckleMesh(radius * 1.22, skin));
  base.add(new THREE.Mesh(segmentGeometry(radius, radius * 0.9, proximal), skin));

  const mid = new THREE.Group();
  mid.position.z = proximal;
  mid.add(knuckleMesh(radius * 0.98, skin));
  const midMesh = new THREE.Mesh(segmentGeometry(radius * 0.9, radius * 0.74, middle), skin);
  midMesh.castShadow = true;
  mid.add(midMesh);

  const tip = new THREE.Group();
  tip.position.z = middle;
  tip.add(knuckleMesh(radius * 0.72, skin));
  const tipMesh = new THREE.Mesh(segmentGeometry(radius * 0.74, radius * 0.58, distal), skin);
  tipMesh.castShadow = true;
  tip.add(tipMesh);
  const plate = nailMesh(radius * 0.62, nail);
  plate.position.set(0, radius * 0.62, distal * 0.58);
  plate.rotation.x = -0.25;
  tip.add(plate);

  mid.add(tip);
  base.add(mid);
  base.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return { base, mid, tip };
}

export function createHand(): HandRig {
  const root = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({
    color: '#d7a57c',
    roughness: 0.46,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.32,
    sheenColor: new THREE.Color('#ffd2b4'),
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
  });
  const nail = new THREE.MeshPhysicalMaterial({
    color: '#f6e4d6',
    roughness: 0.28,
    metalness: 0.04,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#3c5340', roughness: 0.86, metalness: 0 });

  const palmShape = new THREE.Shape();
  palmShape.moveTo(-0.22, -0.2);
  palmShape.quadraticCurveTo(-0.42, -0.16, -0.4, 0.02);
  palmShape.quadraticCurveTo(-0.4, 0.24, -0.18, 0.28);
  palmShape.lineTo(0.24, 0.28);
  palmShape.quadraticCurveTo(0.4, 0.22, 0.38, 0.02);
  palmShape.quadraticCurveTo(0.34, -0.18, 0.08, -0.22);
  palmShape.quadraticCurveTo(-0.08, -0.24, -0.22, -0.2);
  const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 8,
  });
  palmGeo.rotateX(-Math.PI / 2);
  const palm = new THREE.Mesh(palmGeo, skin);
  palm.position.y = -0.02;
  palm.castShadow = true;
  palm.receiveShadow = true;
  root.add(palm);

  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), skin);
  heel.scale.set(1.35, 0.32, 0.85);
  heel.position.set(0.0, 0.02, -0.22);
  heel.castShadow = true;
  root.add(heel);

  const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), skin);
  thenar.scale.set(1.1, 0.45, 1.4);
  thenar.position.set(-0.24, 0.04, 0.0);
  thenar.castShadow = true;
  root.add(thenar);

  const fingers = [
    makeFinger(skin, nail, -0.24, 0.9, 0.062),
    makeFinger(skin, nail, -0.08, 1.0, 0.066),
    makeFinger(skin, nail, 0.08, 0.94, 0.062),
    makeFinger(skin, nail, 0.23, 0.76, 0.054),
  ];
  for (const finger of fingers) root.add(finger.base);

  const thumb = new THREE.Group();
  thumb.position.set(-0.4, 0.02, 0.06);
  const thumbMid = new THREE.Group();
  thumbMid.position.z = 0.24;
  thumb.add(knuckleMesh(0.07, skin));
  thumb.add(new THREE.Mesh(segmentGeometry(0.062, 0.052, 0.24), skin));
  thumbMid.add(knuckleMesh(0.055, skin));
  thumbMid.add(new THREE.Mesh(segmentGeometry(0.05, 0.04, 0.2), skin));
  const thumbNail = nailMesh(0.04, nail);
  thumbNail.position.set(0, 0.045, 0.12);
  thumbNail.rotation.x = -0.3;
  thumbMid.add(thumbNail);
  thumb.add(thumbMid);
  thumb.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  root.add(thumb);

  const wristGeo = segmentGeometry(0.13, 0.16, 0.22);
  const wrist = new THREE.Mesh(wristGeo, skin);
  wrist.position.set(0, -0.01, -0.5);
  wrist.rotation.y = Math.PI;
  wrist.castShadow = true;
  root.add(wrist);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 20), sleeveMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, -0.015, -0.66);
  cuff.castShadow = true;
  root.add(cuff);

  const pinch = new THREE.Object3D();
  pinch.position.copy(PINCH);
  root.add(pinch);

  const setGrasp = (amount: number) => {
    const g = THREE.MathUtils.clamp(amount, 0, 1);
    fingers.forEach((finger, index) => {
      finger.base.rotation.x = 0.12 + g * 0.85;
      finger.base.rotation.z = (index - 1.5) * 0.035 * (1 - g * 0.5);
      finger.mid.rotation.x = 0.16 + g * 0.95;
      finger.tip.rotation.x = 0.08 + g * 0.55;
    });
    thumb.rotation.set(0.45 + g * 0.35, -1.05, 0.05);
    thumbMid.rotation.x = 0.2 + g * 0.65;
  };
  setGrasp(0.08);

  return {
    root,
    pinch,
    setSkin: (hex) => {
      skin.color.set(hex);
      skin.sheenColor.copy(skin.color.clone().lerp(new THREE.Color('#fff4ec'), 0.62));
      nail.color.copy(skin.color.clone().lerp(new THREE.Color('#fff8f4'), 0.55));
    },
    setSleeve: (hex) => sleeveMat.color.set(hex),
    setGrasp,
    dispose: () => {
      skin.dispose();
      nail.dispose();
      sleeveMat.dispose();
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
