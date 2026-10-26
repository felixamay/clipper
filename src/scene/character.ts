import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A rigged MakeHuman player who sits at the table and moves pieces with their own hands, the left for
 * squares on their left and the right for the rest.
 * Every pose is set by aiming bones at world-space directions, so it does not depend on how each
 * bone happens to be rolled in the exported skeleton.
 */
export interface PlayerCharacter {
  root: THREE.Object3D;
  /** World position of the reaching index fingertip. */
  pinch: THREE.Object3D;
  /** Reach a hand toward a world point; null eases it back to rest. */
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
  'index_01_l', 'index_02_l', 'index_03_l', 'thumb_01_l', 'thumb_02_l', 'thumb_03_l',
  'middle_01_l', 'middle_02_l', 'middle_03_l', 'ring_01_l', 'ring_02_l', 'ring_03_l',
  'pinky_01_l', 'pinky_02_l', 'pinky_03_l',
] as const;
type BoneName = (typeof BONES)[number];
/** Which hand reaches: the right for squares ahead and to the right, the left for those on the left. */
type Hand = 'l' | 'r';

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

/** Bend a finger joint chain toward the palm, turning each joint about its own bending axis. */
function curl(bones: THREE.Bone[], amount: number, axes: Map<THREE.Bone, THREE.Vector3>): void {
  for (const bone of bones) bone.rotateOnAxis(axes.get(bone)!, amount);
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
  /** The board's top surface and half its width, centred on the world origin; hands and arms stay above it. */
  boardTop: number;
  boardHalf: number;
}

/** How far the chest, shoulders and neck stay above whatever is under them, in metres; a leaning head comes close. */
const CLEARANCE = { chest: 0.1, shoulder: 0.08, neck: 0.05 };
/** How far the front of the body sits in front of the spine, in metres, from the hips up to the chest; and the upper arm's radius. */
const TORSO_DEPTH = { spine_01: 0.14, spine_02: 0.13, spine_03: 0.12, arm: 0.055 };

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
  // Each finger's bending axis, found from the bind pose (arms out, palms down) rather than trusting
  // how the exporter rolled the bones, which differs from model to model: the axis that turns the
  // finger's length down toward the palm, in each joint's own frame.
  const bendAxes = new Map<THREE.Bone, THREE.Vector3>();
  model.updateMatrixWorld(true);
  for (const hand of ['l', 'r'] as const) {
    for (const finger of ['index', 'thumb', 'middle', 'ring', 'pinky'] as const) {
      const chain = (['01', '02', '03'] as const).map((j) => bones[`${finger}_${j}_${hand}` as BoneName]);
      const length = worldPos(chain[2]).sub(worldPos(chain[0])).normalize();
      const axis = length.clone().cross(new THREE.Vector3(0, -1, 0)).normalize();
      for (const bone of chain) bendAxes.set(bone, axis.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()));
    }
  }

  // Face the player along `facing`, then drop the pelvis onto the seat.
  const facing = spec.facing.clone().setY(0).normalize();
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), facing).normalize(); // player's left
  const up = new THREE.Vector3(0, 1, 0);
  const metres = spec.scale;

  const pinch = new THREE.Object3D();
  let reachTarget: THREE.Vector3 | null = null;
  // The last place reached for, which the arm keeps easing back from after the reach ends.
  let reachAim: THREE.Vector3 | null = null;
  let reachBlend = 0;
  let grip = 0;
  const gaze = new THREE.Vector3().copy(spec.seat).addScaledVector(facing, 0.6 * metres);
  const gazeNow = gaze.clone();
  let clock = Math.random() * 10;

  /** The height of whatever solid surface lies under a point: the board, the bare table, or nothing. */
  const floorUnder = (p: THREE.Vector3) => {
    const margin = 0.4;
    if (Math.abs(p.x) < spec.boardHalf + margin && Math.abs(p.z) < spec.boardHalf + margin) return spec.boardTop;
    if (p.clone().sub(spec.seat).dot(facing) > spec.edgeAhead) return spec.tableTop;
    return -Infinity;
  };
  // Sample the skin and sleeve of each forearm, hand and fingers, so contact with the board or
  // table is judged on the real surface rather than on the joints inside it.
  type Sample = { mesh: THREE.SkinnedMesh; index: number };
  const surfaceSamples = (pattern: RegExp) => {
    const found: Sample[] = [];
    model.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const skinIndex = mesh.geometry.attributes.skinIndex;
      const skinWeight = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < skinIndex.count; i++) {
        let best = 0;
        for (let k = 1; k < 4; k++) if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, best)) best = k;
        const bone = mesh.skeleton.bones[skinIndex.getComponent(i, best)];
        if (bone && pattern.test(bone.name)) found.push({ mesh, index: i });
      }
    });
    return found;
  };
  // The reaching arm is left out: it has its own check once the reach is solved.
  const torsoSamples = surfaceSamples(/^(spine_0[123]|clavicle_[lr]|neck_01)$/);
  const torsoStride = Math.max(1, Math.floor(torsoSamples.length / 700));
  const ownerOf = ({ mesh, index }: Sample) => {
    const skinIndex = mesh.geometry.attributes.skinIndex;
    const skinWeight = mesh.geometry.attributes.skinWeight;
    let top = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(index, k) > skinWeight.getComponent(index, top)) top = k;
    return mesh.skeleton.bones[skinIndex.getComponent(index, top)].name;
  };
  const strideFor = (from: Sample[], count: number) => Math.max(1, Math.floor(from.length / count));
  /** Each arm's bones and skin: all of it, split at the wrist, and the index finger that touches the piece. */
  const armOf = (hand: Hand) => {
    const all = surfaceSamples(new RegExp(`^(lowerarm|hand|index|thumb|middle|ring|pinky)(_0[123])?_${hand}$`));
    const upperArm = surfaceSamples(new RegExp(`^upperarm_${hand}$`));
    const finger = all.filter((sample) => new RegExp(`^index_0\\d_${hand}$`).test(ownerOf(sample)));
    const forearm = all.filter((sample) => ownerOf(sample) === `lowerarm_${hand}`);
    const palm = all.filter((sample) => ownerOf(sample) !== `lowerarm_${hand}`);
    const bone = (name: string) => bones[`${name}_${hand}` as BoneName];
    return {
      clavicle: bone('clavicle'), upper: bone('upperarm'), lower: bone('lowerarm'), hand: bone('hand'),
      fingers: (['index', 'thumb', 'middle', 'ring', 'pinky'] as const).flatMap((f) => ['01', '02', '03'].map((j) => bone(`${f}_${j}`))),
      chain: (f: 'index' | 'thumb' | 'middle' | 'ring' | 'pinky') => (f === 'thumb' ? ['02', '03'] : ['01', '02', '03']).map((j) => bone(`${f}_${j}`)),
      // Which way is outward from this arm's side of the body, along the player's left.
      out: hand === 'l' ? 1 : -1,
      all, stride: strideFor(all, 900),
      upperArm, upperArmStride: strideFor(upperArm, 300),
      finger, fingerStride: strideFor(finger, 400),
      forearm, forearmStride: strideFor(forearm, 400),
      palm, palmStride: strideFor(palm, 500),
    };
  };
  type Arm = ReturnType<typeof armOf>;
  const arms: Record<Hand, Arm> = { l: armOf('l'), r: armOf('r') };
  // The hand doing the moving; chosen as each reach begins and kept until the arm is home again.
  let reaching: Hand = 'r';
  const startPose = new Map<THREE.Bone, THREE.Quaternion>();
  // How far the last seated pose had to slide back on the chair to keep clear of the table.
  let slidBack = 0;
  const surfacePoint = new THREE.Vector3();
  /** How far an arm's surface dips into the board or table, at its deepest point. */
  const armDip = (from: Sample[], step: number) => {
    root.updateMatrixWorld(true);
    let dip = 0;
    for (let i = 0; i < from.length; i += step) {
      const { mesh, index } = from[i];
      // The body's shape comes from morph targets on a shared base mesh, so take the morphed, skinned vertex.
      mesh.getVertexPosition(index, surfacePoint).applyMatrix4(mesh.matrixWorld);
      // Below the tabletop and its apron is the open space under the table, where the lap goes.
      if (surfacePoint.y < spec.tableTop - 0.12 * metres) continue;
      dip = Math.max(dip, floorUnder(surfacePoint) + 0.002 * metres - surfacePoint.y);
    }
    return dip;
  };

  const dir = (f: number, u: number, s = 0) => new THREE.Vector3().addScaledVector(facing, f).addScaledVector(up, u).addScaledVector(side, s);

  const sit = (breath: number, sway: number, lean: THREE.Vector3 | null, leanAmount: number) => {
    for (const [bone, q] of rest) bone.quaternion.copy(q);
    root.position.copy(spec.seat);
    root.updateMatrixWorld(true);
    // Put the pelvis on the seat.
    const pelvis = worldPos(bones.pelvis);
    root.position.y += spec.seat.y - pelvis.y + 0.04 * metres;
    // Scoot forward on the seat when stretching for a far square; the player never rises off it.
    root.position.addScaledVector(facing, (-0.06 + 0.1 * leanAmount) * metres);
    root.updateMatrixWorld(true);
    const bend = (base: THREE.Vector3, amount: number) =>
      lean && leanAmount > 0 ? base.normalize().lerp(lean.clone().multiplyScalar(1.25).add(up).normalize(), leanAmount * amount) : base;
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
    // Reaching far, slide forward on the seat until the belly is just behind the table edge.
    if (leanAmount > 0) {
      const front = (bone: THREE.Bone, depth: number) => worldPos(bone).sub(spec.seat).dot(facing) + depth * metres;
      const gap = spec.edgeAhead - 0.01 * metres - Math.max(front(bones.spine_01, TORSO_DEPTH.spine_01), front(bones.spine_02, TORSO_DEPTH.spine_02));
      if (gap > 0) {
        root.position.addScaledVector(facing, Math.min(gap, 0.22 * metres) * leanAmount);
        root.updateMatrixWorld(true);
      }
    }
    // The reaching shoulder rolls forward toward the square.
    const mover = arms[reaching];
    if (lean && leanAmount > 0) aimBone(mover.clavicle, mover.upper, lean.clone().multiplyScalar(1.2).addScaledVector(side, mover.out), leanAmount * 0.9);
    // Both hands rest in the lap, well back from the table, and the moving one starts from there.
    for (const arm of [arms.l, arms.r]) {
      aimBone(arm.upper, arm.lower, dir(0.12, -1, 0.06 * arm.out));
      aimBone(arm.lower, arm.hand, dir(0.75, -0.45, -0.55 * arm.out));
      // Leaning in brings the lap forward toward the table: draw the elbow back, then turn the forearm in
      // across the lap, until both are back from the edge.
      const behind = (bone: THREE.Bone) => worldPos(bone).sub(spec.seat).dot(facing) - (spec.edgeAhead - 0.06 * metres);
      for (let tuck = 0; tuck < 4 && behind(arm.lower) > 0; tuck++) {
        aimBone(arm.upper, arm.lower, dir(0.12 - 0.35 * (tuck + 1), -1, 0.06 * arm.out));
        aimBone(arm.lower, arm.hand, dir(0.75, -0.45, -0.55 * arm.out));
      }
      for (let tuck = 0; tuck < 4; tuck++) {
        const ahead = worldPos(arm.hand).sub(spec.seat).dot(facing) - (spec.edgeAhead - 0.06 * metres);
        if (ahead <= 0) break;
        aimBone(arm.lower, arm.hand, dir(0.75 - 0.3 * (tuck + 1), -0.45, -0.55 * arm.out));
      }
    }
    // Whatever still touches the table or board means sitting too close: slide back on the chair until it clears.
    slidBack = 0;
    for (let back = 0; back < 6; back++) {
      const dip = armDip(torsoSamples, torsoStride);
      if (dip <= 0.003 * metres) break;
      root.position.addScaledVector(facing, -(dip * 1.5 + 0.005 * metres));
      slidBack += dip * 1.5 + 0.005 * metres;
      root.updateMatrixWorld(true);
    }
    // The moving arm's pose before it reaches, for each solve to start again from.
    for (const bone of [mover.upper, mover.lower, mover.hand]) startPose.set(bone, bone.quaternion.clone());
  };

  /** Two-bone reach: place the wrist so the fingertip lands on `target`, elbow dropping outward. */
  // How far the elbow swings up from its usual low, outward bend, to keep the forearm off the table.
  let elbowRaise = 0;
  const reachWith = (arm: Arm, target: THREE.Vector3, weight: number) => {
    const shoulder = worldPos(arm.upper);
    const elbow0 = worldPos(arm.lower);
    const wrist0 = worldPos(arm.hand);
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
    // The elbow swings out to the side and only a little down, so the forearm stays off the board.
    const pole = new THREE.Vector3().copy(up).multiplyScalar(-0.35 + elbowRaise).addScaledVector(side, arm.out);
    const bendPlane = pole.sub(axisDir.clone().multiplyScalar(pole.dot(axisDir))).normalize();
    const elbow = shoulder.clone()
      .addScaledVector(axisDir, Math.cos(angle) * upper)
      .addScaledVector(bendPlane, Math.sin(angle) * upper);
    const restUpper = elbow0.clone().sub(shoulder).normalize();
    const restLower = wrist0.clone().sub(elbow0).normalize();
    const wantUpper = elbow.clone().sub(shoulder).normalize();
    aimBone(arm.upper, arm.lower, restUpper.lerp(wantUpper, weight));
    const elbowNow = worldPos(arm.lower);
    const wantLower = shoulder.clone().add(reachVec).sub(elbowNow).normalize();
    aimBone(arm.lower, arm.hand, restLower.lerp(wantLower, weight));
    // Point the hand well down at the board, so the index fingertip is its lowest point.
    const wrist = worldPos(arm.hand);
    const handDir = target.clone().sub(wrist).normalize().lerp(dir(0.3, -1, 0), 0.85);
    aimBone(arm.hand, arm.chain('middle')[0], handDir, weight);
  };

  /** The arm every reach is solved from, so the forearm and hand always turn the same way: hand on the thigh. */
  const restArm = (arm: Arm) => {
    aimBone(arm.upper, arm.lower, dir(0.22, -1, 0.1 * arm.out));
    aimBone(arm.lower, arm.hand, dir(1, -0.75, -0.08 * arm.out));
  };
  /** Where the hand touches the piece: the lowest point of the pushing index finger. */
  const pinchNow = (arm: Arm, out = new THREE.Vector3()) => {
    root.updateMatrixWorld(true);
    let lowest = Infinity;
    for (let i = 0; i < arm.finger.length; i += arm.fingerStride) {
      const { mesh, index } = arm.finger[i];
      // The body's shape comes from morph targets on a shared base mesh, so take the morphed, skinned vertex.
      mesh.getVertexPosition(index, surfacePoint).applyMatrix4(mesh.matrixWorld);
      if (surfacePoint.y < lowest) {
        lowest = surfacePoint.y;
        out.copy(surfacePoint);
      }
    }
    return out;
  };

  const pose = (dt: number) => {
    clock += dt;
    const breath = Math.sin(clock * 1.6);
    const sway = Math.sin(clock * 0.37) * 0.6 + Math.sin(clock * 0.91) * 0.4;
    const wantReach = reachTarget ? 1 : 0;
    // A new reach picks its hand: the left for squares left of the player's middle, otherwise the right.
    if (reachTarget && reachBlend < 0.02) reaching = reachTarget.clone().sub(spec.seat).dot(side) > 0 ? 'l' : 'r';
    reachBlend += (wantReach - reachBlend) * Math.min(1, dt * 9);
    const mover = arms[reaching];
    // How far past an easy seated reach the target lies decides how much the body leans in.
    let lean: THREE.Vector3 | null = null;
    let leanAmount = 0;
    if (reachAim && reachBlend > 0.001) {
      lean = reachAim.clone().sub(spec.seat).setY(0);
      const reach = lean.length();
      lean.normalize();
      leanAmount = THREE.MathUtils.clamp((reach - 0.4 * metres) / (0.3 * metres), 0, 1) * reachBlend;
    }
    // Lean as far as the reach wants, but no further than keeps the shoulders, chest and arms clear
    // of the table: search for the deepest lean that passes, then pose it.
    const clear = (amount: number) => {
      sit(breath, sway, lean, amount);
      // The chest may lean out over the table; only the belly has to stay behind its edge.
      const shoulder = worldPos(mover.upper);
      const belly = worldPos(bones.spine_01);
      const bellyAhead = belly.clone().sub(spec.seat).dot(facing);
      const bellyClear = bellyAhead < spec.edgeAhead - 0.03 * metres || belly.y > spec.tableTop + 0.08 * metres;
      // Chest and shoulders keep a hand's height above the board or table under them.
      const chest = worldPos(bones.spine_03);
      const neck = worldPos(bones.neck_01);
      const above = (p: THREE.Vector3, clearance: number) => p.y > floorUnder(p) + clearance * metres;
      // Nothing at table height may push into the table's edge: the front of the belly and chest stay behind it.
      // The front surface sits `depth` ahead of the bone at the same height, with a few centimetres of
      // body below it; it may hang over the table as long as that stays above the tabletop.
      const behindEdge = (p: THREE.Vector3, depth: number) =>
        p.y - 0.04 * metres >= spec.tableTop || p.clone().sub(spec.seat).dot(facing) + depth * metres < spec.edgeAhead - 0.005 * metres;
      const torsoClear =
        behindEdge(worldPos(bones.spine_01), TORSO_DEPTH.spine_01) &&
        behindEdge(worldPos(bones.spine_02), TORSO_DEPTH.spine_02) &&
        behindEdge(chest, TORSO_DEPTH.spine_03);
      // The skin of the chest, shoulders and upper arms must stay out of the table and board.
      // A lean that only clears by sliding well back on the chair gains nothing; lean less instead.
      if (slidBack > 0.03 * metres) return false;
      return bellyClear && torsoClear && above(chest, CLEARANCE.chest) && above(neck, CLEARANCE.neck) && above(shoulder, CLEARANCE.shoulder);
    };
    if (leanAmount > 0.02 && !clear(leanAmount)) {
      let lo = 0;
      let hi = leanAmount;
      for (let step = 0; step < 7; step++) {
        const mid = (lo + hi) / 2;
        if (clear(mid)) lo = mid;
        else hi = mid;
      }
      leanAmount = lo;
    }
    sit(breath, sway, lean, leanAmount);
    const curlFingers = (arm: Arm, g: number) => {
      // Pushing a piece: the index finger rests on top of it, the middle finger bends in behind it,
      // and the ring and little fingers and the thumb tuck in, off the board.
      curl(arm.chain('index'), 0.12 + g * 0.1, bendAxes);
      curl(arm.chain('middle'), 0.6 + g * 0.3, bendAxes);
      curl(arm.chain('ring'), 0.95 + g * 0.3, bendAxes);
      curl(arm.chain('pinky'), 1.0 + g * 0.3, bendAxes);
      curl(arm.chain('thumb'), 0.5 + g * 0.2, bendAxes);
    };
    const resetFingers = (arm: Arm) => {
      for (const bone of arm.fingers) bone.quaternion.copy(rest.get(bone)!);
    };
    const resolve = (aim: THREE.Vector3) => {
      for (const bone of [mover.upper, mover.lower, mover.hand]) bone.quaternion.copy(rest.get(bone)!);
      restArm(mover);
      reachWith(mover, aim, 1);
    };
    if (reachAim && reachBlend > 0.001) {
      elbowRaise = 0;
      // Solve, measure where the fingertip actually landed, and correct the aim twice over.
      const aim = reachAim.clone();
      for (let pass = 0; pass < 3; pass++) {
        resolve(aim);
        if (pass === 2) break;
        resetFingers(mover);
        curlFingers(mover, grip);
        aim.add(reachAim.clone().sub(pinchNow(mover)));
      }
      // If any part of the arm or hand dips into the board or table, lift the reach and solve again.
      for (let lift = 0; lift < 8; lift++) {
        resetFingers(mover);
        curlFingers(mover, grip);
        // A forearm resting on the table edge lifts the elbow; a hand or finger in the board lifts the hand.
        const forearm = armDip(mover.forearm, mover.forearmStride);
        const hand = armDip(mover.palm, mover.palmStride);
        if (Math.max(forearm, hand) <= 0.002 * metres) break;
        if (forearm > hand && elbowRaise < 1.4) elbowRaise += 0.35;
        else aim.y += Math.max(forearm, hand) * 1.1;
        resolve(aim);
      }
      resetFingers(mover);
      // Ease from the resting arm into the full reach.
      for (const bone of [mover.upper, mover.lower, mover.hand]) {
        const solved = bone.quaternion.clone();
        bone.quaternion.copy(startPose.get(bone)!).slerp(solved, reachBlend);
      }
    }
    curlFingers(arms.r, reaching === 'r' ? grip : 0.06);
    if (reaching === 'l') curlFingers(arms.l, grip);
    // Head follows the gaze target smoothly.
    gazeNow.lerp(gaze, Math.min(1, dt * 4));
    const head = worldPos(bones.neck_01);
    aimBone(bones.neck_01, bones.head, gazeNow.clone().sub(head).normalize().lerp(up, 0.72), 0.85);
    pinchNow(mover, pinch.position);
  };
  pose(0);

  return {
    root,
    pinch,
    reachFor: (target, g) => {
      reachTarget = target ? target.clone() : null;
      if (target) reachAim = target.clone();
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
