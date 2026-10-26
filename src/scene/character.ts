import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A rigged MakeHuman player who sits at the table and moves pieces with their own right hand.
 * Every pose is set by aiming bones at world-space directions, so it does not depend on how each
 * bone happens to be rolled in the exported skeleton.
 */
export interface PlayerCharacter {
  root: THREE.Object3D;
  /** World position of the pinch between right thumb and index finger. */
  pinch: THREE.Object3D;
  /** Reach the right hand toward a world point; null rests it back on the thigh. */
  reachFor: (target: THREE.Vector3 | null, grip: number) => void;
  /** Where the eyes should rest, usually the board or the piece in hand. */
  lookAt: (target: THREE.Vector3) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

const BONES = [
  'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r',
  'index_01_r', 'index_02_r', 'index_03_r', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r',
  'middle_01_r', 'middle_02_r', 'middle_03_r', 'ring_01_r', 'ring_02_r', 'ring_03_r',
  'pinky_01_r', 'pinky_02_r', 'pinky_03_r',
] as const;
type BoneName = (typeof BONES)[number];

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

/** Turn a bone so that it runs from its head toward `dir` in world space. */
function aimBone(bone: THREE.Bone, child: THREE.Object3D, dir: THREE.Vector3, weight = 1): void {
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(false, false);
  const from = tmpA.setFromMatrixPosition(child.matrixWorld).sub(tmpB.setFromMatrixPosition(bone.matrixWorld)).normalize();
  const swing = tmpQ.setFromUnitVectors(from, tmpB.copy(dir).normalize());
  if (weight < 1) swing.slerp(tmpQ2.identity(), 1 - weight);
  // Apply the world-space swing in the bone's parent space.
  const parentWorld = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const boneWorld = bone.getWorldQuaternion(new THREE.Quaternion());
  const next = swing.multiply(boneWorld);
  bone.quaternion.copy(parentWorld.invert().multiply(next));
  bone.updateWorldMatrix(false, true);
}

function worldPos(obj: THREE.Object3D, out = new THREE.Vector3()): THREE.Vector3 {
  obj.updateWorldMatrix(true, false);
  return out.setFromMatrixPosition(obj.matrixWorld);
}

/** Bend a finger joint chain toward the palm by turning each joint about its own side axis. */
function curl(bones: THREE.Bone[], amount: number): void {
  for (const bone of bones) bone.rotateX(amount);
}

let shared: GLTFLoader | null = null;
/** One loader for every player; their meshes are Draco-compressed, decoded by the copy in public/draco. */
function loader(): GLTFLoader {
  if (!shared) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    shared = new GLTFLoader();
    shared.setDRACOLoader(draco);
  }
  return shared;
}

export interface SeatSpec {
  /** Where the middle of the seat is, in world units, and which way the player faces. */
  seat: THREE.Vector3;
  facing: THREE.Vector3;
  /** World units per metre. */
  scale: number;
  /** Height of the tabletop, and how far ahead of the seat its edge is; the body stays clear of both. */
  tableTop: number;
  edgeAhead: number;
}

export async function loadPlayerCharacter(url: string, spec: SeatSpec): Promise<PlayerCharacter> {
  const gltf = await loader().loadAsync(url);
  const model = gltf.scene;
  const root = new THREE.Group();
  root.add(model);
  model.scale.setScalar(spec.scale);
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    // MakeHuman exports every material as blended, which the browser draws out of order and
    // lets the skin show through the shirt. Skin, eyes and cloth are solid; hair, brows and
    // lashes keep cut-out edges.
    const cutout = /hair|eyebrow|eyelash|short0|long0|bob0|afro|braid|ponytail/i.test(mesh.name);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.transparent = false;
      material.depthWrite = true;
      material.alphaTest = cutout ? 0.5 : 0;
      material.side = cutout ? THREE.DoubleSide : THREE.FrontSide;
      material.needsUpdate = true;
    }
  });

  const bones = {} as Record<BoneName, THREE.Bone>;
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone && (BONES as readonly string[]).includes(obj.name)) bones[obj.name as BoneName] = obj as THREE.Bone;
  });
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  for (const bone of Object.values(bones)) rest.set(bone, bone.quaternion.clone());

  // Face the player along `facing`, then drop the pelvis onto the seat.
  const facing = spec.facing.clone().setY(0).normalize();
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), facing).normalize(); // player's left
  const up = new THREE.Vector3(0, 1, 0);
  const metres = spec.scale;

  const pinch = new THREE.Object3D();
  let reachTarget: THREE.Vector3 | null = null;
  let reachBlend = 0;
  let grip = 0;
  const gaze = new THREE.Vector3().copy(spec.seat).addScaledVector(facing, 0.6 * metres);
  const gazeNow = gaze.clone();
  let clock = Math.random() * 10;

  const dir = (f: number, u: number, s = 0) => new THREE.Vector3().addScaledVector(facing, f).addScaledVector(up, u).addScaledVector(side, s);

  const sit = (breath: number, sway: number, lean: THREE.Vector3 | null, leanAmount: number) => {
    for (const [bone, q] of rest) bone.quaternion.copy(q);
    root.position.copy(spec.seat);
    root.updateMatrixWorld(true);
    // Put the pelvis on the seat.
    const pelvis = worldPos(bones.pelvis);
    root.position.y += spec.seat.y - pelvis.y + 0.04 * metres;
    // Scoot forward on the seat when stretching for a far square.
    root.position.addScaledVector(facing, (-0.06 + 0.1 * leanAmount) * metres);
    root.updateMatrixWorld(true);
    const bend = (base: THREE.Vector3, amount: number) =>
      lean && leanAmount > 0 ? base.normalize().lerp(lean.clone().multiplyScalar(1.8).add(up).normalize(), leanAmount * amount) : base;
    // Tip the hips forward first; the legs are re-aimed below, so they stay put.
    aimBone(bones.pelvis, bones.spine_01, bend(dir(0.12, 1, 0), 0.4));
    // Legs: thighs forward along the seat, shins down to the floor.
    aimBone(bones.thigh_l, bones.calf_l, dir(1, -0.08, 0.12));
    aimBone(bones.thigh_r, bones.calf_r, dir(1, -0.08, -0.12));
    aimBone(bones.calf_l, bones.foot_l, dir(0.12, -1, 0.04));
    aimBone(bones.calf_r, bones.foot_r, dir(0.12, -1, -0.04));
    // Torso leans in over the table, breathing gently, and bends toward a far square to reach it.
    aimBone(bones.spine_01, bones.spine_02, bend(dir(0.28 + sway * 0.02, 1, sway * 0.03), 0.8));
    aimBone(bones.spine_02, bones.spine_03, bend(dir(0.32, 1 + breath * 0.02, 0), 1));
    aimBone(bones.spine_03, bones.neck_01, bend(dir(0.3, 1, 0), 0.7));
    // The right shoulder rolls forward toward the square.
    if (lean && leanAmount > 0) aimBone(bones.clavicle_r, bones.upperarm_r, lean.clone().multiplyScalar(0.6).addScaledVector(side, -1), leanAmount * 0.5);
    // Left hand rests on the left thigh.
    aimBone(bones.upperarm_l, bones.lowerarm_l, dir(0.22, -1, 0.1));
    aimBone(bones.lowerarm_l, bones.hand_l, dir(1, -0.75, -0.08));
  };

  /** Two-bone reach: place the right wrist so the pinch lands on `target`, elbow dropping outward. */
  const reachRight = (target: THREE.Vector3, weight: number) => {
    const shoulder = worldPos(bones.upperarm_r);
    const elbow0 = worldPos(bones.lowerarm_r);
    const wrist0 = worldPos(bones.hand_r);
    const upper = shoulder.distanceTo(elbow0);
    const lower = elbow0.distanceTo(wrist0);
    // The pinch sits a hand's length past the wrist; aim the wrist short of the target by that.
    const handLength = 0.1 * metres;
    const toTarget = target.clone().sub(shoulder);
    const wristGoal = target.clone().addScaledVector(toTarget.clone().normalize(), -handLength).addScaledVector(up, 0.05 * metres);
    const reachVec = wristGoal.clone().sub(shoulder);
    const dist = THREE.MathUtils.clamp(reachVec.length(), 0.05, (upper + lower) * 0.999);
    reachVec.setLength(dist);
    // Law of cosines for the shoulder angle, then swing the elbow toward a downward-outward pole.
    const cosA = (upper * upper + dist * dist - lower * lower) / (2 * upper * dist);
    const angle = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    const axisDir = reachVec.clone().normalize();
    const pole = new THREE.Vector3().copy(up).multiplyScalar(-1).addScaledVector(side, -0.5);
    const bendPlane = pole.sub(axisDir.clone().multiplyScalar(pole.dot(axisDir))).normalize();
    const elbow = shoulder.clone()
      .addScaledVector(axisDir, Math.cos(angle) * upper)
      .addScaledVector(bendPlane, Math.sin(angle) * upper);
    const restUpper = elbow0.clone().sub(shoulder).normalize();
    const restLower = wrist0.clone().sub(elbow0).normalize();
    const wantUpper = elbow.clone().sub(shoulder).normalize();
    aimBone(bones.upperarm_r, bones.lowerarm_r, restUpper.lerp(wantUpper, weight));
    const elbowNow = worldPos(bones.lowerarm_r);
    const wantLower = shoulder.clone().add(reachVec).sub(elbowNow).normalize();
    aimBone(bones.lowerarm_r, bones.hand_r, restLower.lerp(wantLower, weight));
    // Tip the hand down toward the piece.
    const wrist = worldPos(bones.hand_r);
    const handDir = target.clone().sub(wrist).normalize().lerp(dir(0.4, -1, 0), 0.35);
    const fingerTip = bones.middle_01_r;
    aimBone(bones.hand_r, fingerTip, handDir, weight);
  };

  const restRight = () => {
    aimBone(bones.upperarm_r, bones.lowerarm_r, dir(0.22, -1, -0.1));
    aimBone(bones.lowerarm_r, bones.hand_r, dir(1, -0.75, 0.08));
  };
  const pinchNow = (out = new THREE.Vector3()) => worldPos(bones.index_03_r, out).lerp(worldPos(bones.thumb_03_r), 0.5);

  const pose = (dt: number) => {
    clock += dt;
    const breath = Math.sin(clock * 1.6);
    const sway = Math.sin(clock * 0.37) * 0.6 + Math.sin(clock * 0.91) * 0.4;
    const wantReach = reachTarget ? 1 : 0;
    reachBlend += (wantReach - reachBlend) * Math.min(1, dt * 9);
    // How far past an easy seated reach the target lies decides how much the body leans in.
    let lean: THREE.Vector3 | null = null;
    let leanAmount = 0;
    if (reachTarget) {
      lean = reachTarget.clone().sub(spec.seat).setY(0);
      const reach = lean.length();
      lean.normalize();
      leanAmount = THREE.MathUtils.clamp((reach - 0.4 * metres) / (0.3 * metres), 0, 1) * reachBlend;
    }
    // Lean no further than keeps the shoulders above the tabletop and the chest behind its edge.
    for (let attempt = 0; attempt < 6; attempt++) {
      sit(breath, sway, lean, leanAmount);
      if (leanAmount <= 0.02) break;
      // The chest may lean out over the table; only the belly has to stay behind its edge.
      const shoulder = worldPos(bones.upperarm_r);
      const belly = worldPos(bones.spine_01);
      const bellyAhead = belly.clone().sub(spec.seat).dot(facing);
      const bellyClear = bellyAhead < spec.edgeAhead - 0.03 * metres || belly.y > spec.tableTop + 0.08 * metres;
      if (shoulder.y > spec.tableTop + 0.1 * metres && bellyClear) break;
      leanAmount *= 0.75;
    }
    restRight();
    const curlFingers = () => {
      // Relaxed curl, closing thumb and index into a pinch as the grip tightens.
      curl([bones.middle_01_r, bones.middle_02_r, bones.middle_03_r], 0.35 + grip * 0.5);
      curl([bones.ring_01_r, bones.ring_02_r, bones.ring_03_r], 0.45 + grip * 0.55);
      curl([bones.pinky_01_r, bones.pinky_02_r, bones.pinky_03_r], 0.5 + grip * 0.6);
      curl([bones.index_01_r, bones.index_02_r, bones.index_03_r], 0.2 + grip * 0.35);
      curl([bones.thumb_02_r, bones.thumb_03_r], 0.15 + grip * 0.3);
    };
    if (reachTarget && reachBlend > 0.001) {
      // Solve, measure where the fingertips actually landed, and correct the aim twice over.
      const aim = reachTarget.clone();
      for (let pass = 0; pass < 3; pass++) {
        for (const bone of [bones.upperarm_r, bones.lowerarm_r, bones.hand_r]) bone.quaternion.copy(rest.get(bone)!);
        restRight();
        reachRight(aim, reachBlend);
        if (pass === 2) break;
        for (const finger of Object.keys(bones).filter((n) => n.endsWith('_r') && /^(index|thumb|middle|ring|pinky)/.test(n))) {
          const bone = bones[finger as BoneName];
          bone.quaternion.copy(rest.get(bone)!);
        }
        curlFingers();
        const miss = reachTarget.clone().sub(pinchNow());
        aim.addScaledVector(miss, reachBlend);
      }
      for (const finger of Object.keys(bones).filter((n) => n.endsWith('_r') && /^(index|thumb|middle|ring|pinky)/.test(n))) {
        const bone = bones[finger as BoneName];
        bone.quaternion.copy(rest.get(bone)!);
      }
    }
    curlFingers();
    // Head follows the gaze target smoothly.
    gazeNow.lerp(gaze, Math.min(1, dt * 4));
    const head = worldPos(bones.neck_01);
    aimBone(bones.neck_01, bones.head, gazeNow.clone().sub(head).normalize().lerp(up, 0.72), 0.85);
    pinchNow(pinch.position);
  };
  pose(0);

  return {
    root,
    pinch,
    reachFor: (target, g) => {
      reachTarget = target ? target.clone() : null;
      grip = g;
    },
    lookAt: (target) => gaze.copy(target),
    update: pose,
    dispose: () => {
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      });
    },
  };
}
