import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { dress } from './bodies';
import { loadPlayerCharacter } from './character';
import { PlayerModel } from './models';

/** Portraits are head and shoulders, 4:5, the shape of the player cards. */
const WIDTH = 480;
const HEIGHT = 600;
const METRE = 25;

let studio: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null;
/** One small renderer for every portrait, apart from the table's, lit like a shaded spot under the tree. */
function getStudio() {
  if (studio) return studio;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cdb894');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b5638, 1.1));
  const key = new THREE.DirectionalLight(0xffeccc, 1.6);
  key.position.set(1.2, 2, 2.4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, WIDTH / HEIGHT, 0.5, 400);
  studio = { renderer, scene, camera };
  return studio;
}

const portraits = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** A picture of this body as it sits at the table, facing the viewer; made once and reused. */
export function portraitOf(model: PlayerModel): Promise<string> {
  const key = `${model.model}|${JSON.stringify(model.tints)}`;
  let pending = portraits.get(key);
  if (!pending) {
    // One at a time, since they share the renderer.
    pending = queue.then(() => shoot(model));
    queue = pending.catch(() => undefined);
    portraits.set(key, pending);
    pending.catch(() => portraits.delete(key));
  }
  return pending;
}

async function shoot(model: PlayerModel): Promise<string> {
  const { renderer, scene, camera } = getStudio();
  // Seated at no table: nothing to lean over or keep clear of.
  const seat = new THREE.Vector3(0, 0.5 * METRE, 0);
  const facing = new THREE.Vector3(0, 0, 1);
  const character = await loadPlayerCharacter(`${import.meta.env.BASE_URL}${model.model}`, {
    seat,
    facing,
    scale: METRE,
    tableTop: -1000,
    edgeAhead: 1000,
    boardTop: -1000,
    boardHalf: 0,
  });
  try {
    dress(character.root, model);
    scene.add(character.root);
    const head = new THREE.Vector3();
    character.root.getObjectByName('head')?.getWorldPosition(head);
    // Face the camera, a little below eye level, and settle the gaze.
    camera.position.copy(head).addScaledVector(facing, 1.15 * METRE).add(new THREE.Vector3(0, -0.04 * METRE, 0));
    character.lookAt(camera.position);
    for (let i = 0; i < 4; i++) character.update(1);
    character.root.getObjectByName('head')?.getWorldPosition(head);
    camera.position.copy(head).addScaledVector(facing, 1.15 * METRE).add(new THREE.Vector3(0, -0.04 * METRE, 0));
    camera.lookAt(head.clone().add(new THREE.Vector3(0, -0.1 * METRE, 0)));
    renderer.render(scene, camera);
    return await new Promise<string>((resolve) => {
      renderer.domElement.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : renderer.domElement.toDataURL()), 'image/webp', 0.9);
    });
  } finally {
    scene.remove(character.root);
    character.dispose();
  }
}
