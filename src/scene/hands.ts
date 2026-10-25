import * as THREE from 'three';

/** Where the fingertips meet a piece. +Z is reach, +Y is the back of the hand. */
const PINCH = new THREE.Vector3(0.0, -0.06, 1.12);

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

function rounded(width: number, height: number, length: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(width, height) * 0.5, Math.max(0.02, length - height), 3, 8), material);
  mesh.scale.set(width / height, 1, 1);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = length / 2;
  mesh.castShadow = true;
  return mesh;
}

function makeFinger(material: THREE.Material, nail: THREE.Material, x: number, length: number, width: number): Finger {
  const baseLen = length * 0.42;
  const midLen = length * 0.32;
  const tipLen = length * 0.26;
  const base = new THREE.Group();
  base.position.set(x, 0.09, 0.42);
  const mid = new THREE.Group();
  mid.position.z = baseLen;
  const tip = new THREE.Group();
  tip.position.z = midLen;
  base.add(rounded(width, 0.11, baseLen, material));
  mid.add(rounded(width * 0.92, 0.1, midLen, material));
  const tipSeg = new THREE.Group();
  tipSeg.add(rounded(width * 0.84, 0.09, tipLen, material));
  const nailMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.018, tipLen * 0.55), nail);
  nailMesh.position.set(0, 0.055, tipLen * 0.62);
  tipSeg.add(nailMesh);
  tip.add(tipSeg);
  mid.add(tip);
  base.add(mid);
  return { base, mid, tip };
}

function palmShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.42);
  shape.bezierCurveTo(-0.22, -0.46, -0.4, -0.18, -0.46, 0.08);
  shape.bezierCurveTo(-0.5, 0.28, -0.44, 0.46, -0.36, 0.52);
  shape.lineTo(0.34, 0.52);
  shape.bezierCurveTo(0.46, 0.4, 0.42, 0.12, 0.3, -0.12);
  shape.bezierCurveTo(0.2, -0.36, 0.12, -0.46, 0, -0.42);
  return shape;
}

export function createHand(): HandRig {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#d7a57c', roughness: 0.64, metalness: 0.02 });
  const nail = new THREE.MeshStandardMaterial({ color: '#f4e0d2', roughness: 0.3, metalness: 0.06 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#3c5340', roughness: 0.84, metalness: 0 });

  const palm = new THREE.Mesh(
    new THREE.ExtrudeGeometry(palmShape(), {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 10,
    }),
    skin,
  );
  palm.rotation.x = -Math.PI / 2;
  palm.position.y = -0.04;
  palm.castShadow = true;
  palm.receiveShadow = true;
  root.add(palm);

  const fingers = [
    makeFinger(skin, nail, -0.27, 0.62, 0.15),
    makeFinger(skin, nail, -0.09, 0.7, 0.155),
    makeFinger(skin, nail, 0.09, 0.66, 0.15),
    makeFinger(skin, nail, 0.26, 0.54, 0.135),
  ];
  for (const finger of fingers) {
    root.add(finger.base);
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin);
    knuckle.scale.set(1.1, 0.55, 0.8);
    knuckle.position.set(finger.base.position.x, 0.12, 0.46);
    knuckle.castShadow = true;
    root.add(knuckle);
  }

  const thumb = new THREE.Group();
  thumb.position.set(-0.42, 0.02, 0.02);
  const thumbMid = new THREE.Group();
  thumbMid.position.z = 0.26;
  thumb.add(rounded(0.16, 0.13, 0.26, skin));
  const thumbTip = new THREE.Group();
  thumbTip.add(rounded(0.14, 0.11, 0.22, skin));
  const thumbNail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.1), nail);
  thumbNail.position.set(0, 0.06, 0.14);
  thumbTip.add(thumbNail);
  thumbMid.add(thumbTip);
  thumb.add(thumbMid);
  root.add(thumb);

  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), skin);
  wrist.position.set(0, 0.01, -0.5);
  wrist.castShadow = true;
  root.add(wrist);
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.16), sleeveMat);
  cuff.position.set(0, 0.0, -0.66);
  cuff.castShadow = true;
  root.add(cuff);

  const pinch = new THREE.Object3D();
  pinch.position.copy(PINCH);
  root.add(pinch);

  const setGrasp = (amount: number) => {
    const g = THREE.MathUtils.clamp(amount, 0, 1);
    fingers.forEach((finger, index) => {
      finger.base.rotation.x = 0.05 + g * 0.9;
      finger.base.rotation.z = (index - 1.5) * 0.03 * (1 - g);
      finger.mid.rotation.x = 0.08 + g * 1.05;
      finger.tip.rotation.x = 0.05 + g * 0.65;
    });
    thumb.rotation.set(0.25 + g * 0.5, -0.95, -0.05);
    thumbMid.rotation.x = 0.2 + g * 0.7;
  };
  setGrasp(0.04);

  return {
    root,
    pinch,
    setSkin: (hex) => {
      skin.color.set(hex);
      nail.color.copy(skin.color.clone().lerp(new THREE.Color('#fff7f1'), 0.45));
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
