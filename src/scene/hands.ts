import * as THREE from 'three';

/** Where the fingertips meet a piece. +Z reaches, +Y is the back of the hand. */
const PINCH = new THREE.Vector3(0, -0.08, 0.9);

interface Finger {
  base: THREE.Group;
}

export interface HandRig {
  root: THREE.Group;
  pinch: THREE.Object3D;
  setSkin: (hex: string) => void;
  setSleeve: (hex: string) => void;
  setGrasp: (amount: number) => void;
  dispose: () => void;
}

function fingerTube(length: number, radius: number, material: THREE.Material): THREE.Mesh {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.03, length * 0.55),
    new THREE.Vector3(0, -0.1, length),
  );
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 12, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function nailPlate(width: number, length: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, length), material);
  mesh.castShadow = true;
  return mesh;
}

function makeFinger(skin: THREE.Material, nail: THREE.Material, x: number, length: number, radius: number): Finger {
  const base = new THREE.Group();
  base.position.set(x, 0.045, 0.16);
  base.add(fingerTube(length, radius, skin));
  const plate = nailPlate(radius * 0.85, length * 0.16, nail);
  plate.position.set(0, -0.04, length * 0.86);
  base.add(plate);
  return { base };
}

export function createHand(): HandRig {
  const root = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({
    color: '#d7a57c',
    roughness: 0.48,
    metalness: 0,
    sheen: 0.4,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#ffd8c2'),
  });
  const nail = new THREE.MeshStandardMaterial({ color: '#e7b8a6', roughness: 0.35, metalness: 0.02 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#3c5340', roughness: 0.9 });

  const palmShape = new THREE.Shape();
  palmShape.moveTo(-0.28, 0.22);
  palmShape.lineTo(0.28, 0.2);
  palmShape.quadraticCurveTo(0.4, 0.08, 0.36, -0.08);
  palmShape.quadraticCurveTo(0.3, -0.32, 0.08, -0.4);
  palmShape.quadraticCurveTo(-0.16, -0.42, -0.28, -0.22);
  palmShape.quadraticCurveTo(-0.48, -0.02, -0.4, 0.14);
  palmShape.quadraticCurveTo(-0.34, 0.24, -0.28, 0.22);
  const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 8,
  });
  palmGeo.rotateX(Math.PI / 2);
  const palm = new THREE.Mesh(palmGeo, skin);
  palm.position.y = 0.02;
  palm.castShadow = true;
  palm.receiveShadow = true;
  root.add(palm);

  const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  thenar.scale.set(1, 0.55, 1.2);
  thenar.position.set(-0.24, 0.03, -0.02);
  thenar.castShadow = true;
  root.add(thenar);

  const fingers = [
    makeFinger(skin, nail, -0.155, 0.7, 0.052),
    makeFinger(skin, nail, -0.05, 0.78, 0.055),
    makeFinger(skin, nail, 0.055, 0.72, 0.052),
    makeFinger(skin, nail, 0.15, 0.58, 0.044),
  ];
  for (const finger of fingers) root.add(finger.base);

  const thumb = new THREE.Group();
  thumb.position.set(-0.32, 0.04, 0.02);
  thumb.add(fingerTube(0.4, 0.058, skin));
  const thumbNail = nailPlate(0.045, 0.06, nail);
  thumbNail.position.set(0, -0.02, 0.34);
  thumb.add(thumbNail);
  root.add(thumb);

  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.12, 4, 12), skin);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0.02, 0.01, -0.46);
  wrist.castShadow = true;
  root.add(wrist);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.16, 0.1, 16), sleeveMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, -0.64);
  cuff.castShadow = true;
  root.add(cuff);

  const pinch = new THREE.Object3D();
  pinch.position.copy(PINCH);
  root.add(pinch);

  const setGrasp = (amount: number) => {
    const g = THREE.MathUtils.clamp(amount, 0, 1);
    fingers.forEach((finger) => {
      finger.base.rotation.set(0.12 + g * 0.7, 0, 0);
    });
    thumb.rotation.set(0.2 + g * 0.45, -1.15 + g * 0.5, 0.15);
  };
  setGrasp(0.08);

  return {
    root,
    pinch,
    setSkin: (hex) => {
      skin.color.set(hex);
      skin.sheenColor.copy(skin.color.clone().lerp(new THREE.Color('#fff1e6'), 0.65));
      nail.color.copy(skin.color.clone().lerp(new THREE.Color('#f0c2b2'), 0.35));
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
