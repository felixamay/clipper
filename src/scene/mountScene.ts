import * as THREE from 'three';
import { Board, Color, Move } from '../engine/board';
import { applyMove } from '../engine/moves';
import { HandRig, createHand, placeHand } from './hands';
import { PlayerCharacter, loadPlayerCharacter } from './character';
import { PLAYER_MODELS } from './models';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { dappleTexture, leafLightTexture, woodTexture } from './textures';

const SQUARE = 1;
const BOARD_TOP = 0.5;
/** Half the board's width, frame included. */
const BOARD_HALF = 5.85;
/** The board rests on a table: a square is 5 cm, so a 75 cm table is 15 squares tall. */
const TABLE_TOP = 0.02;
const TABLE_HEIGHT = 15;
/** Half the table's length toward each player, and half its depth toward the camera: a 65 cm table, just wider than the board. */
const TABLE_X = 6.5;
const TABLE_Z = 7;
const FLOOR = TABLE_TOP - TABLE_HEIGHT;
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
/** A chair seat is 45 cm high, and its middle sits this far back from the table edge, so only the knees go under. */
const SEAT_HEIGHT = 9;
const SEAT_BACK = 5;
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

  // Soft light from all round, so skin and cloth pick up the shade under the tree.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.32;
  scene.add(new THREE.HemisphereLight(0xd6dfe8, 0x6b5638, 0.55));
  // The sun comes through the leaves: a spotlight that projects the canopy's pattern and casts shadows.
  const leafLight = leafLightTexture();
  const sun = new THREE.SpotLight(0xffeccc, 4.2, 0, 0.5, 0.5, 0);
  sun.map = leafLight;
  sun.position.set(14, 72, 22);
  sun.target.position.set(0, FLOOR + 8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 30;
  sun.shadow.camera.far = 120;
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
  const characters: Partial<Record<Color, PlayerCharacter>> = {};
  const chairs: Partial<Record<Color, THREE.Group>> = {};
  const seatToken: Record<Color, number> = { white: 0, black: 0 };
  const chairMat = new THREE.MeshStandardMaterial({ map: woodTexture('#8a5a34', '#5a3820', 2), roughness: 0.8 });
  const boardCentre = new THREE.Vector3(0, BOARD_TOP, 0);
  /** A plain wooden chair, its seat centred on `x`, with the back away from the table. */
  const buildChair = (x: number, sign: number) => {
    const chair = new THREE.Group();
    const part = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), chairMat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      chair.add(mesh);
    };
    part(8.6, 0.7, 8.6, 0, FLOOR + SEAT_HEIGHT - 0.35, 0);
    for (const lx of [-3.8, 3.8]) for (const lz of [-3.8, 3.8]) part(0.7, SEAT_HEIGHT - 0.7, 0.7, lx, FLOOR + (SEAT_HEIGHT - 0.7) / 2, lz);
    const back = sign * 3.95;
    for (const lz of [-3.8, 3.8]) part(0.7, 9, 0.7, back, FLOOR + SEAT_HEIGHT + 4.5, lz);
    part(0.5, 2.2, 8.2, back, FLOOR + SEAT_HEIGHT + 7.6, 0);
    part(0.5, 1.4, 8.2, back, FLOOR + SEAT_HEIGHT + 3.8, 0);
    chair.position.x = x;
    return chair;
  };
  // A seated player's hand comes home toward their own lap, just in front of the table edge.
  const restFor = (side: Color) =>
    characters[side]
      ? new THREE.Vector3(sideSign(side) * (TABLE_X + 1.5), TABLE_TOP - 2, 2.5)
      : side === 'white'
        ? new THREE.Vector3(0.7, 0.74, 2.15)
        : new THREE.Vector3(-0.35, 0.8, -0.85);
  const rollFor = (side: Color) => (side === 'white' ? 0 : 0);
  // Where the moving hand was last sent; a seated player's carried piece follows this planned path.
  const handTarget = new THREE.Vector3();
  const poseHand = (side: Color, target: THREE.Vector3, grasp: number) => {
    const character = characters[side];
    if (character) {
      if (anim && anim.side === side) handTarget.copy(target);
      character.reachFor(anim && anim.side === side ? target : null, grasp);
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

  const clearSeat = (side: Color) => {
    const character = characters[side];
    if (character) {
      scene.remove(character.root, character.pinch);
      character.dispose();
      delete characters[side];
    }
    const chair = chairs[side];
    if (chair) {
      scene.remove(chair);
      chair.traverse((obj) => (obj as THREE.Mesh).geometry?.dispose());
      delete chairs[side];
    }
    hands[side] = drawnHands[side];
  };
  const seatCharacter = (side: Color, photo: string) => {
    const model = PLAYER_MODELS[photo];
    const sign = sideSign(side);
    const seatX = sign * (TABLE_X + SEAT_BACK);
    const chair = buildChair(seatX, sign);
    chairs[side] = chair;
    scene.add(chair);
    const token = ++seatToken[side];
    loadPlayerCharacter(`${import.meta.env.BASE_URL}${model.model}`, {
      seat: new THREE.Vector3(seatX, FLOOR + SEAT_HEIGHT, 0),
      facing: new THREE.Vector3(-sign, 0, 0),
      scale: 20,
      tableTop: TABLE_TOP,
      edgeAhead: SEAT_BACK,
      boardTop: BOARD_TOP,
      boardHalf: BOARD_HALF,
    })
      .then((character) => {
        if (dead || token !== seatToken[side]) {
          character.dispose();
          return;
        }
        character.root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const name = mesh.name.toLowerCase();
          // `skin` tints the body itself, which exports under the bare name "Human".
          const tint = Object.entries(model.tints).find(([fragment]) => (fragment === 'skin' ? name === 'human' : name.includes(fragment)));
          if (tint) (mesh.material as THREE.MeshStandardMaterial).color.set(tint[1]);
        });
        characters[side] = character;
        scene.add(character.root, character.pinch);
        hands[side] = {
          root: character.pinch,
          pinch: character.pinch,
          setSkin: () => {},
          setSleeve: () => {},
          setGrasp: () => {},
          dispose: () => {},
        };
      })
      .catch((error) => console.error('Could not load player model', error));
  };
  const seatPlayer = (side: Color, photo?: string) => {
    clearSeat(side);
    seatToken[side]++;
    // Starter players have rigged models; anyone else plays with the hidden guide hand.
    if (photo && PLAYER_MODELS[photo]) seatCharacter(side, photo);
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
    // A carried piece never sinks below the board, even if the fingertips dip a little as they set it down.
    // A seated player pushes with the index fingertip on top of the piece, and the piece keeps to the
    // move's path even where the reach falls a little short; the guide hand pinches it.
    if (anim && characters[anim.side]) {
      moving.position.set(handTarget.x, Math.max(BOARD_TOP, handTarget.y - 0.16), handTarget.z);
    } else {
      moving.position.set(point.x, Math.max(BOARD_TOP, point.y - 0.11), point.z);
    }
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

  /** Breathe, shift, and keep each player's eyes on the board, or on the piece they are carrying. */
  const updateCharacters = (dt: number) => {
    for (const side of ['white', 'black'] as const) {
      const character = characters[side];
      if (!character) continue;
      character.lookAt(moving && anim && anim.side === side ? moving.position : boardCentre);
      character.update(dt);
    }
  };

  let dead = false;
  let last = performance.now();
  let clock = 0;
  let reported = false;
  const loop = (now: number) => {
    if (dead) return;
    // Capped so a stalled tab does not jump, but loose enough that slow machines stay near real time.
    const dt = Math.min(0.1, (now - last) / 1000);
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
      updateCharacters(dt);
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
      updateCharacters(dt);
    } else {
      updateCharacters(dt);
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
      const touch = characters[side] ? 0.17 : 0.18;
      const targets = move.path.map((square) => squareToWorld(square, BOARD_TOP + touch));
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
      const landing = squareToWorld(move.path[move.path.length - 1], BOARD_TOP + (characters[side] ? 0.17 : 0.16));
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
      leafLight.dispose();
      environment.dispose();
      chairMat.dispose();
      drawnHands.white.dispose();
      drawnHands.black.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
