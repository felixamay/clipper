export const SKIN_TONES = [
  '#f4d2bc',
  '#efc2a4',
  '#e2aa7c',
  '#c9844a',
  '#a86c3e',
  '#8a552b',
  '#6b3c24',
  '#4e2e1e',
  '#3a2418',
] as const;

export const HAIR_COLORS = [
  '#1b1917',
  '#3b2918',
  '#6b4630',
  '#a56d3e',
  '#c6a56a',
  '#8e8a84',
  '#8e3a32',
  '#ddd6cc',
] as const;

export const EYE_COLORS = ['#3a2918', '#6a4630', '#2f4a3c', '#3c5e7c', '#6a6844', '#171513'] as const;

export const FACE_SHAPES = ['oval', 'round', 'square', 'long', 'heart'] as const;
export const HAIR_STYLES = ['short', 'crop', 'curly', 'wavy', 'long', 'bun', 'bald', 'coily'] as const;
export const EYE_SHAPES = ['almond', 'round', 'narrow', 'deep'] as const;
export const BROWS = ['straight', 'arched', 'thick', 'soft'] as const;
export const NOSES = ['narrow', 'straight', 'broad', 'soft'] as const;
export const MOUTHS = ['narrow', 'full', 'wide', 'soft'] as const;
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'beard', 'goatee'] as const;

export type FaceShape = (typeof FACE_SHAPES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type EyeShape = (typeof EYE_SHAPES)[number];
export type BrowStyle = (typeof BROWS)[number];
export type NoseStyle = (typeof NOSES)[number];
export type MouthStyle = (typeof MOUTHS)[number];
export type FacialHair = (typeof FACIAL_HAIR)[number];

export interface PortraitSpec {
  skin: number;
  face: FaceShape;
  hairStyle: HairStyle;
  hairColor: number;
  eyeShape: EyeShape;
  eyeColor: number;
  brow: BrowStyle;
  nose: NoseStyle;
  mouth: MouthStyle;
  facialHair: FacialHair;
}

export const SHIRTS = ['#2d3f55', '#3c5340', '#5c3d3a', '#2f2e2c', '#6a5344', '#234e4a', '#4d4468', '#6a4528'];

export function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return 0;
  return ((Math.floor(index) % length) + length) % length;
}

export function skinHex(spec: PortraitSpec): string {
  return SKIN_TONES[clampIndex(spec.skin, SKIN_TONES.length)];
}

export function hairHex(spec: PortraitSpec): string {
  return HAIR_COLORS[clampIndex(spec.hairColor, HAIR_COLORS.length)];
}

export function eyeHex(spec: PortraitSpec): string {
  return EYE_COLORS[clampIndex(spec.eyeColor, EYE_COLORS.length)];
}

export function shirtHex(spec: PortraitSpec): string {
  const index = clampIndex(spec.skin * 2 + spec.hairColor + spec.face.length, SHIRTS.length);
  return SHIRTS[index];
}

export function strengthLabel(depth: number): string {
  if (depth <= 3) return 'Casual';
  if (depth === 4) return 'Club';
  if (depth === 5) return 'Seasoned';
  if (depth === 6) return 'Sharp';
  if (depth === 7) return 'Expert';
  return 'Master';
}

export function noiseForDepth(depth: number): number {
  return Math.max(1, 22 - depth * 2);
}

export const DEFAULT_PORTRAIT: PortraitSpec = {
  skin: 4,
  face: 'oval',
  hairStyle: 'wavy',
  hairColor: 1,
  eyeShape: 'almond',
  eyeColor: 0,
  brow: 'straight',
  nose: 'straight',
  mouth: 'soft',
  facialHair: 'none',
};
