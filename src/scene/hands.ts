import * as THREE from 'three';

/** Where the fingertips meet a piece. +Z reaches, +Y is the back of the hand. */
const PINCH = new THREE.Vector3(0, -0.08, 0.9);

interface Finger {
  base: THREE.Group;
}

export interface HandRig {
  root: THREE.Object3D;
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

/** Where the photographed hand starts, back from the pinch, as a share of the arm photo's width. */
const HAND_SHARE = 0.36;
/** The fingers hover this far above the pinch, so they sit over the piece rather than through it. */
const HOVER = 0.3;

export interface ArmRig {
  root: THREE.Mesh;
  /** Follows the fingertips, for the piece being carried. */
  pinch: THREE.Object3D;
  /** Lay the arm from the shoulder to the pinch point, turned to face the eye. */
  reach: (shoulder: THREE.Vector3, target: THREE.Vector3, eye: THREE.Vector3, grasp: number) => void;
  setOpacity: (amount: number) => void;
  dispose: () => void;
}

/**
 * A photographed arm that runs from the player's shoulder to the piece in one piece. The hand
 * keeps its photographed size; the sleeve and upper arm stretch to cover the rest of the reach.
 * `flip` mirrors it into a left arm for the player on the right.
 */
export function createPhotoArm(url: string, aspect: number, pinchAt: [number, number], width: number, flip: boolean): ArmRig {
  const length = width * aspect;
  const [pinchU, pinchV] = pinchAt;
  const wristU = Math.max(0.05, pinchU - HAND_SHARE);
  const geometry = new THREE.BufferGeometry();
  // Three rungs across the arm: shoulder, wrist, fingertips.
  const positions = new Float32Array(6 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const top = flip ? 0 : 1;
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array([0, top, 0, 1 - top, wristU, top, wristU, 1 - top, 1, top, 1, 1 - top]), 2),
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);

  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xe6ded2,
    transparent: true,
    alphaTest: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const root = new THREE.Mesh(geometry, material);
  root.frustumCulled = false;
  root.renderOrder = 2;
  root.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: texture, alphaTest: 0.5 });
  const pinch = new THREE.Object3D();

  const dir = new THREE.Vector3();
  const across = new THREE.Vector3();
  const toEye = new THREE.Vector3();
  const rung = (index: number, at: THREE.Vector3) => {
    // Top of the photo on one side of the line through the pinch, bottom on the other.
    const above = at.clone().addScaledVector(across, pinchV * width);
    const below = at.clone().addScaledVector(across, -(1 - pinchV) * width);
    positions.set([above.x, above.y, above.z, below.x, below.y, below.z], index * 6);
  };

  return {
    root,
    pinch,
    reach: (shoulder, target, eye, grasp) => {
      const tip = target.clone();
      tip.y += HOVER - THREE.MathUtils.clamp(grasp, 0, 1) * 0.08;
      pinch.position.copy(target);
      dir.subVectors(tip, shoulder);
      const span = Math.max(0.001, dir.length());
      dir.divideScalar(span);
      toEye.subVectors(eye, tip).normalize();
      across.crossVectors(dir, toEye).normalize();
      if (flip) across.negate();
      const handLength = Math.min((pinchU - wristU) * length, span * 0.7);
      const wrist = tip.clone().addScaledVector(dir, -handLength);
      const fingertips = tip.clone().addScaledVector(dir, (1 - pinchU) * length);
      rung(0, shoulder);
      rung(1, wrist);
      rung(2, fingertips);
      geometry.getAttribute('position').needsUpdate = true;
    },
    setOpacity: (amount) => {
      material.opacity = amount;
      root.visible = amount > 0.01;
      root.castShadow = amount > 0.5;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      root.customDepthMaterial?.dispose();
      texture.dispose();
    },
  };
}

export function placeHand(rig: HandRig, target: THREE.Vector3, yaw: number, pitch: number, roll: number): void {
  rig.root.rotation.set(pitch, yaw, roll);
  const offset = rig.pinch.position.clone().multiply(rig.root.scale).applyEuler(rig.root.rotation);
  rig.root.position.copy(target).sub(offset);
}
