import * as THREE from 'three';
import { Board, Color, Move } from '../engine/board';
import { applyMove } from '../engine/moves';
import { ArmRig, HandRig, createHand, createPhotoArm, placeHand } from './hands';
import { PLAYER_RIGS } from './photos';
import { dappleTexture, woodTexture } from './textures';

const SQUARE = 1;
const BOARD_TOP = 0.5;
/** The board rests on a table: a square is 5 cm, so a 75 cm table is 15 squares tall. */
const TABLE_TOP = 0.02;
const TABLE_HEIGHT = 15;
/** Half the table's length toward each player, and half its depth toward the camera. */
const TABLE_X = 9;
const TABLE_Z = 7;
const FLOOR = TABLE_TOP - TABLE_HEIGHT;
/** A seated adult, head to feet, about 1.25 m. */
const SEATED_HEIGHT = 25;
/** Width of the photographed arm strip, in squares. */
const ARM_WIDTH = 2.5;
/**
 * The backdrop photo was made from a layout rendered with exactly this camera: 2.25 m above the
 * floor, 2.8 m back from the table, tipped down 24 degrees, 40 degree vertical view. Its open
 * patch of ground is where the table and players stand.
 */
const EYE = new THREE.Vector3(0, FLOOR + 45, 56);
const EYE_PITCH = (24 * Math.PI) / 180;
const EYE_FOV = 40;
const BACKDROP_ASPECT = 2752 / 1536;
/** The backdrop is drawn a little larger than the screen so the view can slide sideways for side panels. */
const BACKDROP_SLACK = 1.06;
function pitchFor(side: Color): number {
  return side === 'white' ? 0.12 : 0.14;
}
/** Light sits on the left of the table and dark on the right, each reaching in with the right hand. */
function sideSign(side: Color): number {
  return side === 'white' ? -1 : 1;
}

export interface SceneHandle {
  reset: (board: Board) => void;
  setColors: (whiteSkin: string, blackSkin: string, whiteSleeve: string, blackSleeve: string) => void;
  playMove: (move: Move, side: Color, speed: () => number, paused: () => boolean) => Promise<void>;
  cancel: () => void;
  setShift: (amount: number) => void;
  /** Seat the two players by their roster photos; a player without a seated photo is left out. */
  setPlayers: (whitePhoto?: string, blackPhoto?: string) => void;
  dispose: () => void;
}

/** Light's home rows face the left of the table, so the players sit at either end and face each other. */
function squareToWorld(square: number, y = BOARD_TOP): THREE.Vector3 {
  const row = Math.floor(square / 10);
  const col = square % 10;
  return new THREE.Vector3((row - 4.5) * SQUARE, y, (col - 4.5) * SQUARE);
}

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpVec(a: THREE.Vector3, b: THREE.Vector3, t: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(a).lerp(b, t);
}

function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number): THREE.Vector3 {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}

function yawFor(side: Color, _target: THREE.Vector3): number {
  return side === 'white' ? Math.PI : Math.PI;
}

interface Phase {
  duration: number;
  apply: (t: number) => void;
}

interface Anim {
  phases: Phase[];
  index: number;
  elapsed: number;
  side: Color;
  speed: () => number;
  paused: () => boolean;
  commit: () => void;
  unblock: () => void;
  settled: boolean;
}

interface Removal {
  mesh: THREE.Group;
  from: THREE.Vector3;
  elapsed: number;
  duration: number;
  dir: number;
}

export function mountScene(host: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  // The photograph of the square under the tree sits behind the canvas.
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(EYE_FOV, BACKDROP_ASPECT, 0.5, 400);
  let shift = 0;

  const applyCamera = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    // Crop the camera's frame exactly as the backdrop is cropped, so the two stay registered.
    const fullHeight = (width / height > BACKDROP_ASPECT ? width / BACKDROP_ASPECT : height) * BACKDROP_SLACK;
    const fullWidth = fullHeight * BACKDROP_ASPECT;
    const left = ((fullWidth - width) / 2) * (1 + THREE.MathUtils.clamp(shift, -1, 1));
    const top = (fullHeight - height) / 2;
    camera.position.copy(EYE);
    camera.rotation.set(-EYE_PITCH, 0, 0);
    camera.setViewOffset(fullWidth, fullHeight, left, top, width, height);
    camera.updateProjectionMatrix();
    host.style.backgroundSize = `${fullWidth}px ${fullHeight}px`;
    host.style.backgroundPosition = `${-left}px ${-top}px`;
  };
  applyCamera();

  scene.add(new THREE.HemisphereLight(0xc9daf0, 0x3e5a32, 0.72));
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.15);
  sun.position.set(3.6, 27, 6.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xc5d4e4, 0.45);
  fill.position.set(-5, 6, 6);
  scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR;
  ground.receiveShadow = true;
  scene.add(ground);

  const tableMat = new THREE.MeshStandardMaterial({
    map: woodTexture('#9a7350', '#6a4a30', 3),
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
  });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(TABLE_X * 2, 0.7, TABLE_Z * 2), tableMat);
  tableTop.position.y = TABLE_TOP - 0.35;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  scene.add(tableTop);
  const apronLong = new THREE.BoxGeometry(TABLE_X * 2 - 2.4, 1.6, 0.4);
  const apronShort = new THREE.BoxGeometry(0.4, 1.6, TABLE_Z * 2 - 2.4);
  for (const z of [TABLE_Z - 1.2, -(TABLE_Z - 1.2)]) {
    const apron = new THREE.Mesh(apronLong, tableMat);
    apron.position.set(0, TABLE_TOP - 1.5, z);
    apron.castShadow = true;
    scene.add(apron);
  }
  for (const x of [TABLE_X - 1.2, -(TABLE_X - 1.2)]) {
    const apron = new THREE.Mesh(apronShort, tableMat);
    apron.position.set(x, TABLE_TOP - 1.5, 0);
    apron.castShadow = true;
    scene.add(apron);
  }
  const legGeo = new THREE.BoxGeometry(0.9, TABLE_HEIGHT - 0.7, 0.9);
  for (const x of [TABLE_X - 1.2, -(TABLE_X - 1.2)]) {
    for (const z of [TABLE_Z - 1.2, -(TABLE_Z - 1.2)]) {
      const leg = new THREE.Mesh(legGeo, tableMat);
      leg.position.set(x, FLOOR + (TABLE_HEIGHT - 0.7) / 2, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      scene.add(leg);
    }
  }

  const frameMat = new THREE.MeshPhysicalMaterial({
    map: woodTexture('#6d4630', '#3e2618', 2),
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.02,
    clearcoat: 0.18,
    clearcoatRoughness: 0.6,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.42, 11.5), frameMat);
  slab.position.y = 0.23;
  slab.castShadow = true;
  slab.receiveShadow = true;
  scene.add(slab);
  const lipGeo = new THREE.BoxGeometry(11.7, 0.1, 0.22);
  for (const z of [5.74, -5.74]) {
    const lip = new THREE.Mesh(lipGeo, frameMat);
    lip.position.set(0, 0.49, z);
    lip.castShadow = true;
    scene.add(lip);
  }
  const lipSide = new THREE.BoxGeometry(0.22, 0.1, 11.7);
  for (const x of [-5.74, 5.74]) {
    const lip = new THREE.Mesh(lipSide, frameMat);
    lip.position.set(x, 0.49, 0);
    lip.castShadow = true;
    scene.add(lip);
  }

  const lightSquare = new THREE.MeshPhysicalMaterial({
    map: woodTexture('#e7cfa6', '#c8a56e', 1),
    roughness: 0.48,
    clearcoat: 0.12,
    clearcoatRoughness: 0.5,
  });
  const darkSquare = new THREE.MeshPhysicalMaterial({
    map: woodTexture('#8a5534', '#4e2e1c', 1),
    roughness: 0.5,
    clearcoat: 0.1,
    clearcoatRoughness: 0.55,
  });
  const tile = new THREE.BoxGeometry(0.97, 0.045, 0.97);
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const dark = ((row + col) & 1) === 1;
      const mesh = new THREE.Mesh(tile, dark ? darkSquare : lightSquare);
      mesh.position.copy(squareToWorld(row * 10 + col, 0.455));
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  const dapple = new THREE.Mesh(
    new THREE.PlaneGeometry(10.6, 10.6),
    new THREE.MeshBasicMaterial({ map: dappleTexture(), transparent: true, depthWrite: false }),
  );
  dapple.rotation.x = -Math.PI / 2;
  dapple.position.y = 0.478;
  scene.add(dapple);

  const manGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.26, 0),
      new THREE.Vector2(0.34, 0.028),
      new THREE.Vector2(0.34, 0.11),
      new THREE.Vector2(0.28, 0.15),
      new THREE.Vector2(0, 0.15),
    ],
    36,
  );
  const kingGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.26, 0),
      new THREE.Vector2(0.34, 0.03),
      new THREE.Vector2(0.34, 0.15),
      new THREE.Vector2(0.28, 0.2),
      new THREE.Vector2(0, 0.2),
    ],
    36,
  );
  const lightWood = new THREE.MeshPhysicalMaterial({
    color: 0xf0d0a4,
    roughness: 0.38,
    metalness: 0.04,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
  });
  const darkWood = new THREE.MeshPhysicalMaterial({
    color: 0x3a2416,
    roughness: 0.42,
    metalness: 0.05,
    clearcoat: 0.4,
    clearcoatRoughness: 0.4,
  });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.65 });
  const ring = new THREE.TorusGeometry(0.16, 0.022, 8, 24);

  const pieceGroup = new THREE.Group();
  const fx = new THREE.Group();
  scene.add(pieceGroup);
  scene.add(fx);
  const pieces = new Map<number, THREE.Group>();

  const makePiece = (piece: number) => {
    const king = piece === 2 || piece === 4;
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(king ? kingGeo : manGeo, piece === 1 || piece === 2 ? lightWood : darkWood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (king) {
      const crown = new THREE.Mesh(ring, brass);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.155;
      crown.castShadow = true;
      group.add(crown);
    }
    return group;
  };

  let logical: Board = new Uint8Array(100);
  const rebuild = (board: Board) => {
    pieceGroup.clear();
    pieces.clear();
    for (let s = 0; s < board.length; s++) {
      if (!board[s]) continue;
      const mesh = makePiece(board[s]);
      const pos = squareToWorld(s);
      mesh.position.copy(pos);
      mesh.rotation.y = ((Math.sin(s * 12.9898) * 43758.5453) % 1) * 0.35;
      pieceGroup.add(mesh);
      pieces.set(s, mesh);
    }
  };

  // Without a seated photo the drawn rigs stay hidden and only guide the pieces.
  const drawnHands: Record<Color, HandRig> = { white: createHand(), black: createHand() };
  for (const rig of Object.values(drawnHands)) {
    rig.root.scale.setScalar(1.35);
    rig.root.visible = false;
    scene.add(rig.root);
  }
  const hands: Record<Color, HandRig> = { ...drawnHands };
  const arms: Partial<Record<Color, ArmRig>> = {};
  const armOpacity: Record<Color, number> = { white: 0, black: 0 };
  const shoulders: Partial<Record<Color, THREE.Vector3>> = {};
  const seats: Partial<Record<Color, THREE.Mesh>> = {};
  const seatShadows: Partial<Record<Color, THREE.Mesh>> = {};
  // A soft dark patch under each chair, since a photograph cannot cast a shadow of its own.
  const contactTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const glow = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      glow.addColorStop(0, 'rgba(20, 14, 8, 0.75)');
      glow.addColorStop(1, 'rgba(20, 14, 8, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(canvas);
  })();
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  contactGeometry.rotateX(-Math.PI / 2);
  const restFor = (side: Color) =>
    arms[side]
      ? new THREE.Vector3(sideSign(side) * (TABLE_X - 1.5), TABLE_TOP + 0.4, 2.2)
      : side === 'white'
        ? new THREE.Vector3(0.7, 0.74, 2.15)
        : new THREE.Vector3(-0.35, 0.8, -0.85);
  const rollFor = (side: Color) => (side === 'white' ? 0 : 0);
  const poseHand = (side: Color, target: THREE.Vector3, grasp: number) => {
    const arm = arms[side];
    const shoulder = shoulders[side];
    if (arm && shoulder) {
      arm.reach(shoulder, target, camera.position, grasp);
      return;
    }
    const rig = hands[side];
    placeHand(rig, target, yawFor(side, target), pitchFor(side), rollFor(side));
    rig.setGrasp(grasp);
  };
  const parkHands = () => {
    poseHand('white', restFor('white'), 0.06);
    poseHand('black', restFor('black'), 0.06);
  };

  const loader = new THREE.TextureLoader();
  const clearSeat = (side: Color) => {
    const seat = seats[side];
    if (seat) {
      scene.remove(seat);
      seat.geometry.dispose();
      const material = seat.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
      delete seats[side];
    }
    const shadow = seatShadows[side];
    if (shadow) {
      scene.remove(shadow);
      (shadow.material as THREE.Material).dispose();
      delete seatShadows[side];
    }
    const arm = arms[side];
    if (arm) {
      scene.remove(arm.root, arm.pinch);
      arm.dispose();
      delete arms[side];
    }
    delete shoulders[side];
    armOpacity[side] = 0;
    hands[side] = drawnHands[side];
  };
  const seatPlayer = (side: Color, photo?: string) => {
    clearSeat(side);
    const rig = photo ? PLAYER_RIGS[photo] : undefined;
    if (!rig) return;
    const sign = sideSign(side);
    const base = import.meta.env.BASE_URL;
    const width = SEATED_HEIGHT * rig.seatedAspect;
    const texture = loader.load(`${base}${rig.seated}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const seat = new THREE.Mesh(
      new THREE.PlaneGeometry(width, SEATED_HEIGHT),
      new THREE.MeshBasicMaterial({ map: texture, color: 0xe6ded2, transparent: true, alphaTest: 0.04 }),
    );
    // The player on the right is the mirror image, facing left.
    seat.scale.x = -sign;
    // Knees just under the table edge, feet on the floor, and the photo tipped back to face the
    // raised camera it was taken from.
    const centreY = FLOOR + SEATED_HEIGHT / 2;
    seat.position.set(sign * (TABLE_X - 1.2) + sign * (rig.knee - 0.5) * width, centreY, 0);
    seat.rotation.x = -Math.atan2(EYE.y - centreY, EYE.z);
    seats[side] = seat;
    scene.add(seat);
    seat.updateMatrixWorld(true);
    const shadow = new THREE.Mesh(
      contactGeometry,
      new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false }),
    );
    shadow.scale.set(width * 0.95, 1, 9);
    shadow.position.set(seat.position.x, FLOOR + 0.05, 1);
    seatShadows[side] = shadow;
    scene.add(shadow);
    // The near shoulder, a little in front of the photo so the arm comes out of the body.
    shoulders[side] = seat.localToWorld(
      new THREE.Vector3((rig.shoulder[0] - 0.5) * width, (0.5 - rig.shoulder[1]) * SEATED_HEIGHT, 1.2),
    );

    const arm = createPhotoArm(`${base}${rig.hand}`, rig.handAspect, rig.pinch, ARM_WIDTH, side === 'black');
    arm.setOpacity(0);
    arms[side] = arm;
    scene.add(arm.root, arm.pinch);
    hands[side] = {
      root: arm.pinch,
      pinch: arm.pinch,
      setSkin: () => {},
      setSleeve: () => {},
      setGrasp: () => {},
      dispose: () => {},
    };
  };
  parkHands();

  let anim: Anim | null = null;
  const removals: Removal[] = [];
  let moving: THREE.Group | null = null;
  let holding = false;
  let active: HandRig | null = null;

  const followPiece = () => {
    if (!holding || !moving || !active) return;
    active.root.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    active.pinch.getWorldPosition(point);
    moving.position.set(point.x, point.y - 0.11, point.z);
    moving.rotation.x = 0;
    moving.rotation.z = 0;
  };

  const fadeMaterials = (mesh: THREE.Object3D) => {
    mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const source = Array.isArray(obj.material) ? obj.material : [obj.material];
      obj.material = source.map((material) => {
        const copy = material.clone();
        copy.transparent = true;
        return copy;
      });
    });
  };

  const setOpacity = (mesh: THREE.Object3D, opacity: number) => {
    mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material.opacity = opacity;
    });
  };

  let dead = false;
  let last = performance.now();
  let clock = 0;
  let reported = false;
  const loop = (now: number) => {
    if (dead) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    try {
    if (anim && !anim.paused()) {
      const phase = anim.phases[anim.index];
      if (!phase) throw new Error(`missing phase ${anim.index}/${anim.phases.length}`);
      anim.elapsed += dt;
      const duration = Math.max(0.05, phase.duration * anim.speed());
      const t = Math.min(1, anim.elapsed / duration);
      phase.apply(ease(t));
      followPiece();
      if (t >= 1) {
        anim.index += 1;
        anim.elapsed = 0;
        if (anim.index >= anim.phases.length && !anim.settled) {
          anim.settled = true;
          const commit = anim.commit;
          anim = null;
          holding = false;
          moving = null;
          active = null;
          commit();
        }
      }
    } else if (!anim) {
      const whiteTarget = restFor('white');
      whiteTarget.y += Math.sin(clock * 1.5) * 0.025;
      poseHand('white', whiteTarget, 0.06);
      const blackTarget = restFor('black');
      blackTarget.y += Math.sin(clock * 1.5 + 1.2) * 0.025;
      poseHand('black', blackTarget, 0.06);
    }
    // A photographed arm only shows while its player is reaching for a piece.
    for (const side of ['white', 'black'] as const) {
      const arm = arms[side];
      if (!arm) continue;
      const want = anim && anim.side === side ? 1 : 0;
      armOpacity[side] += (want - armOpacity[side]) * Math.min(1, dt * 7);
      arm.setOpacity(armOpacity[side]);
    }
    for (let i = removals.length - 1; i >= 0; i--) {
      const removal = removals[i];
      removal.elapsed += dt;
      const t = Math.min(1, removal.elapsed / removal.duration);
      removal.mesh.position.set(
        removal.from.x + removal.dir * t * 0.85,
        removal.from.y + Math.sin(t * Math.PI) * 0.55,
        removal.from.z + t * 0.25,
      );
      removal.mesh.rotation.z = t * 1.1;
      setOpacity(removal.mesh, 1 - t);
      if (t >= 1) {
        fx.remove(removal.mesh);
        removals.splice(i, 1);
      }
    }
    } catch (error) {
      if (!reported) {
        reported = true;
        console.error(error);
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const resize = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    renderer.setSize(width, height);
    applyCamera();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const playMove = (move: Move, side: Color, speed: () => number, paused: () => boolean) => {
    return new Promise<void>((resolve) => {
      const hand = hands[side];
      const mesh = pieces.get(move.path[0]);
      const before = logical.slice();
      const commit = () => {
        logical = applyMove(before, move);
        rebuild(logical);
        parkHands();
        resolve();
      };
      const unblock = () => {
        holding = false;
        moving = null;
        active = null;
        rebuild(logical);
        parkHands();
        resolve();
      };
      if (!mesh) {
        commit();
        return;
      }
      moving = mesh;
      active = hand;
      holding = false;
      const start = new THREE.Vector3();
      hand.root.updateMatrixWorld(true);
      hand.pinch.getWorldPosition(start);
      const targets = move.path.map((square) => squareToWorld(square, BOARD_TOP + 0.18));
      const phases: Phase[] = [];
      const pose = (target: THREE.Vector3, grasp: number) => poseHand(side, target, grasp);
      phases.push({
        duration: 0.46,
        apply: (t) => pose(lerpVec(start, targets[0], t), 0.18 + t * 0.08),
      });
      phases.push({
        duration: 0.16,
        apply: (t) => {
          pose(targets[0], 0.26 + t * 0.58);
          if (t > 0.65) holding = true;
        },
      });
      const lifted = targets[0].clone();
      lifted.y += 0.48;
      phases.push({
        duration: 0.16,
        apply: (t) => pose(lerpVec(targets[0], lifted, t), 0.84),
      });
      for (let hop = 0; hop < move.path.length - 1; hop++) {
        const from = squareToWorld(move.path[hop], BOARD_TOP + 0.62);
        const to = squareToWorld(move.path[hop + 1], BOARD_TOP + 0.62);
        const distance = from.distanceTo(to);
        const mid = from.clone().lerp(to, 0.5);
        mid.y += (move.captures.length ? 0.48 : 0.22) + distance * 0.08;
        const capIndex = move.captures[hop];
        let removed = false;
        phases.push({
          duration: 0.34 + distance * 0.05,
          apply: (t) => {
            pose(bezier(from, mid, to, t), 0.84);
            if (!removed && capIndex !== undefined && t > 0.42) {
              removed = true;
              const cap = pieces.get(capIndex);
              if (cap) {
                pieces.delete(capIndex);
                fadeMaterials(cap);
                fx.add(cap);
                removals.push({
                  mesh: cap,
                  from: cap.position.clone(),
                  elapsed: 0,
                  duration: 0.55,
                  dir: sideSign(side),
                });
              }
            }
          },
        });
      }
      const landing = squareToWorld(move.path[move.path.length - 1], BOARD_TOP + 0.16);
      const hover = landing.clone();
      hover.y += 0.42;
      phases.push({
        duration: 0.16,
        apply: (t) => pose(lerpVec(hover, landing, t), 0.84 - t * 0.2),
      });
      phases.push({
        duration: 0.14,
        apply: (t) => {
          pose(landing, 0.64 - t * 0.46);
          if (t > 0.4) {
            holding = false;
            moving?.position.copy(squareToWorld(move.path[move.path.length - 1]));
          }
        },
      });
      phases.push({
        duration: 0.42,
        apply: (t) => {
          const home = restFor(side);
          pose(lerpVec(landing, home, t), 0.18);
        },
      });
      anim = { phases, index: 0, elapsed: 0, side, speed, paused, settled: false, commit, unblock };
    });
  };

  return {
    reset: (board) => {
      if (anim && !anim.settled) {
        anim.settled = true;
        const unblock = anim.unblock;
        anim = null;
        unblock();
      }
      holding = false;
      moving = null;
      active = null;
      for (const removal of removals) fx.remove(removal.mesh);
      removals.length = 0;
      logical = board.slice();
      rebuild(logical);
      parkHands();
    },
    setColors: (whiteSkin, blackSkin, whiteSleeve, blackSleeve) => {
      drawnHands.white.setSkin(whiteSkin);
      drawnHands.black.setSkin(blackSkin);
      drawnHands.white.setSleeve(whiteSleeve);
      drawnHands.black.setSleeve(blackSleeve);
    },
    setPlayers: (whitePhoto, blackPhoto) => {
      seatPlayer('white', whitePhoto);
      seatPlayer('black', blackPhoto);
      parkHands();
    },
    playMove,
    cancel: () => {
      if (anim && !anim.settled) {
        anim.settled = true;
        const unblock = anim.unblock;
        anim = null;
        unblock();
      }
    },
    setShift: (amount) => {
      shift = amount;
      applyCamera();
    },
    dispose: () => {
      dead = true;
      observer.disconnect();
      clearSeat('white');
      clearSeat('black');
      contactTexture.dispose();
      contactGeometry.dispose();
      drawnHands.white.dispose();
      drawnHands.black.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
