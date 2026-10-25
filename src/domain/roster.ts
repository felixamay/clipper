import { Character, emptyRecord } from './character';
import { PortraitSpec } from '../portrait/palette';

function starter(
  id: string,
  name: string,
  portrait: PortraitSpec,
  depth: number,
  noise: number,
): Character {
  return { id, name, portrait, depth, noise, record: emptyRecord() };
}

export const STARTER_ROSTER: Character[] = [
  starter('starter-ade', 'Ade Okonkwo', {
    skin: 7, face: 'square', hairStyle: 'crop', hairColor: 0, eyeShape: 'deep', eyeColor: 5, brow: 'thick', nose: 'broad', mouth: 'full', facialHair: 'beard',
  }, 7, 3),
  starter('starter-helen', 'Helen Varga', {
    skin: 1, face: 'oval', hairStyle: 'long', hairColor: 2, eyeShape: 'almond', eyeColor: 2, brow: 'arched', nose: 'narrow', mouth: 'soft', facialHair: 'none',
  }, 5, 8),
  starter('starter-mateo', 'Mateo Ruiz', {
    skin: 3, face: 'round', hairStyle: 'curly', hairColor: 1, eyeShape: 'round', eyeColor: 0, brow: 'straight', nose: 'straight', mouth: 'wide', facialHair: 'mustache',
  }, 6, 5),
  starter('starter-priya', 'Priya Shah', {
    skin: 4, face: 'heart', hairStyle: 'bun', hairColor: 0, eyeShape: 'almond', eyeColor: 1, brow: 'soft', nose: 'straight', mouth: 'full', facialHair: 'none',
  }, 5, 6),
  starter('starter-soren', 'Soren Lind', {
    skin: 0, face: 'long', hairStyle: 'short', hairColor: 4, eyeShape: 'narrow', eyeColor: 3, brow: 'straight', nose: 'narrow', mouth: 'narrow', facialHair: 'stubble',
  }, 4, 12),
  starter('starter-amara', 'Amara Diallo', {
    skin: 8, face: 'oval', hairStyle: 'coily', hairColor: 0, eyeShape: 'deep', eyeColor: 5, brow: 'thick', nose: 'broad', mouth: 'full', facialHair: 'none',
  }, 8, 2),
  starter('starter-jonah', 'Jonah Keller', {
    skin: 1, face: 'square', hairStyle: 'wavy', hairColor: 6, eyeShape: 'round', eyeColor: 4, brow: 'soft', nose: 'soft', mouth: 'wide', facialHair: 'beard',
  }, 3, 14),
  starter('starter-leila', 'Leila Haddad', {
    skin: 3, face: 'heart', hairStyle: 'wavy', hairColor: 0, eyeShape: 'almond', eyeColor: 0, brow: 'arched', nose: 'straight', mouth: 'soft', facialHair: 'none',
  }, 6, 4),
];
