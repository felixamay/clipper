import * as THREE from 'three';
import { Board, Color, Move } from '../engine/board';
import { applyMove } from '../engine/moves';
import { HandRig, createHand, placeHand } from './hands';
import { barkTexture, dappleTexture, grassTexture, leafTexture, woodTexture } from './textures';

const SQUARE = 1;
const BOARD_TOP = 0.5;
function pitchFor(side: Color): number {
  return side === 'white' ? 0.12 : 0.14;
}

export interface SceneHandle {
  reset: (board: Board) => void;
  setColors: (whiteSkin: string, blackSkin: string, whiteSleeve: string, blackSleeve: string) => void;
  playMove: (move: Move, side: Color, speed: () => number, paused: () => boolean) => Promise<void>;
  cancel: () => void;
  setShift: (amount: number) => void;
  dispose: () => void;
}

function squareToWorld(square: number, y = BOARD_TOP): THREE.Vector3 {
  const row = Math.floor(square / 10);
  const col = square % 10;
  return new THREE.Vector3((col - 4.5) * SQUARE, y, (4.5 - row) * SQUARE);
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xa9c3cc);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb7c6bf, 14, 34);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  let shift = 0;

  const applyCamera = () => {
    camera.position.set(0.3 + shift, 8.2, 12.4);
    camera.lookAt(shift * 0.25, 0.2, -0.2);
  };
  applyCamera();

  scene.add(new THREE.HemisphereLight(0xc9daf0, 0x3e5a32, 0.72));
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.15);
  sun.position.set(2.4, 18, 4.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 36;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xc5d4e4, 0.45);
  fill.position.set(-5, 6, 6);
  scene.add(fill);

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(26, 48),
    new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0xffffff, roughness: 1, metalness: 0 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  const earth = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x6a5038, roughness: 1 }),
  );
  earth.rotation.x = -Math.PI / 2;
  earth.position.set(-6.4, 0.01, -1.6);
  earth.receiveShadow = true;
  scene.add(earth);

  const meadow = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 28),
    new THREE.MeshStandardMaterial({ color: 0x6e9148, roughness: 1 }),
  );
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.set(0.4, 0.008, -11.5);
  meadow.receiveShadow = true;
  scene.add(meadow);

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
      mesh.position.set((col - 4.5) * SQUARE, 0.455, (4.5 - row) * SQUARE);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  const trunkMat = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.92 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 7.2, 16), trunkMat);
  trunk.position.set(-6.4, 3.5, -1.6);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  scene.add(trunk);

  const addBranch = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
    const dir = to.clone().sub(from);
    const length = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, length, 8), trunkMat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.castShadow = false;
    scene.add(mesh);
  };
  const fork = new THREE.Vector3(-5.5, 5.15, -0.2);
  const reach = new THREE.Vector3(-1.4, 6.35, 3.2);
  const tip = new THREE.Vector3(2.8, 6.15, 5.1);
  addBranch(new THREE.Vector3(-6.25, 4.1, -1.35), fork, 0.18, 0.1);
  addBranch(fork, reach, 0.09, 0.05);
  addBranch(reach, tip, 0.055, 0.028);
  addBranch(fork, new THREE.Vector3(-3.2, 6.45, 1.5), 0.07, 0.03);
  addBranch(reach, new THREE.Vector3(0.4, 6.7, 4.6), 0.045, 0.022);
  addBranch(fork, new THREE.Vector3(-6.6, 6.1, -2.2), 0.06, 0.028);

  const sunLeaf = leafTexture('sun');
  const shadeLeaf = leafTexture('shade');
  sunLeaf.wrapS = THREE.ClampToEdgeWrapping;
  sunLeaf.wrapT = THREE.ClampToEdgeWrapping;
  shadeLeaf.wrapS = THREE.ClampToEdgeWrapping;
  shadeLeaf.wrapT = THREE.ClampToEdgeWrapping;
  const leafMat = (map: THREE.Texture, emissive: number) =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.62,
      emissive,
      emissiveIntensity: 0.2,
    });
  const litMat = leafMat(sunLeaf, 0x244818);
  const deepMat = leafMat(shadeLeaf, 0x163214);
  const leaves: THREE.Mesh[] = [];
  let leafSeed = 0x1a77;
  const rand = () => {
    leafSeed = (Math.imul(leafSeed, 1664525) + 1013904223) >>> 0;
    return leafSeed / 4294967296;
  };
  const tuft = (center: THREE.Vector3, count: number, radius: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand();
      const dist = radius * (0.25 + rand() * 0.75);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72 + rand() * 0.38, 0.95 + rand() * 0.4), i % 3 === 0 ? deepMat : litMat);
      mesh.position.set(
        center.x + Math.cos(angle) * dist,
        center.y + (rand() - 0.35) * radius * 0.85,
        center.z + Math.sin(angle) * dist * 0.75,
      );
      mesh.rotation.set(-0.55 - rand() * 0.45, (rand() - 0.5) * 1.1, (rand() - 0.5) * 0.5);
      mesh.castShadow = false;
      scene.add(mesh);
      leaves.push(mesh);
    }
  };
  const limbs = [fork, reach, tip, new THREE.Vector3(-3.2, 6.45, 1.5), new THREE.Vector3(0.4, 6.7, 4.6)];
  for (const limb of limbs) tuft(limb, 11, 0.85);
  tuft(fork.clone().lerp(reach, 0.45), 9, 0.7);
  tuft(reach.clone().lerp(tip, 0.5), 9, 0.7);
  tuft(new THREE.Vector3(-4.4, 6.05, 0.7), 8, 0.65);
  tuft(new THREE.Vector3(1.6, 6.25, 4.4), 8, 0.6);

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

  const whiteHand = createHand();
  const blackHand = createHand();
  scene.add(whiteHand.root);
  scene.add(blackHand.root);
  whiteHand.root.scale.setScalar(1.35);
  blackHand.root.scale.setScalar(1.35);
  const restWhite = new THREE.Vector3(0.7, 0.74, 2.15);
  const restBlack = new THREE.Vector3(-0.35, 0.8, -0.85);
  const rollFor = (side: Color) => (side === 'white' ? 0 : 0);

  const park = (rig: HandRig, side: Color, target: THREE.Vector3) => {
    placeHand(rig, target, yawFor(side, target), pitchFor(side), rollFor(side));
    rig.setGrasp(0.06);
  };
  const parkHands = () => {
    park(whiteHand, 'white', restWhite);
    park(blackHand, 'black', restBlack);
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
    for (const leaf of leaves) {
      leaf.rotation.z += Math.sin(clock * 0.7 + leaf.position.x) * 0.0008;
    }
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
      const bob = Math.sin(clock * 1.5) * 0.025;
      const whiteTarget = restWhite.clone();
      whiteTarget.y += bob;
      park(whiteHand, 'white', whiteTarget);
      const blackTarget = restBlack.clone();
      blackTarget.y += Math.sin(clock * 1.5 + 1.2) * 0.025;
      park(blackHand, 'black', blackTarget);
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
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const playMove = (move: Move, side: Color, speed: () => number, paused: () => boolean) => {
    return new Promise<void>((resolve) => {
      const hand = side === 'white' ? whiteHand : blackHand;
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
      const pose = (target: THREE.Vector3, grasp: number) => {
        placeHand(hand, target, yawFor(side, target), pitchFor(side), rollFor(side));
        hand.setGrasp(grasp);
      };
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
                  dir: side === 'white' ? 1 : -1,
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
          const home = side === 'white' ? restWhite : restBlack;
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
      whiteHand.setSkin(whiteSkin);
      blackHand.setSkin(blackSkin);
      whiteHand.setSleeve(whiteSleeve);
      blackHand.setSleeve(blackSleeve);
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
      whiteHand.dispose();
      blackHand.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
