import { Character } from '../domain/character';
import { STARTER_ROSTER } from '../domain/roster';
import { hairHex, shirtHex } from '../portrait/palette';
import { PLAYER_MODELS, PlayerModel } from './models';

/** Garment and hair meshes, by a fragment of their names, so a borrowed body can be redressed. */
const TOP = /shirt|sweater/;
const HAIR = /hair|afro|long01|short01/;

/** A face reads as a man's when it has facial hair or, failing that, a short cut. */
const looksMasculine = (character: Pick<Character, 'portrait'>) =>
  character.portrait.facialHair !== 'none' || ['short', 'crop', 'bald'].includes(character.portrait.hairStyle);

/**
 * The rigged body a character sits at the table in. Starter players have their own; anyone created
 * in the app borrows the starter body closest to their portrait, in their own shirt and hair colour.
 */
export function bodyFor(character: Pick<Character, 'portrait' | 'photo'>): PlayerModel | undefined {
  if (character.photo && PLAYER_MODELS[character.photo]) return PLAYER_MODELS[character.photo];
  const masculine = looksMasculine(character);
  const candidates = STARTER_ROSTER.filter((starter) => starter.photo && PLAYER_MODELS[starter.photo]);
  const best = candidates.reduce<{ starter: Character; score: number } | null>((found, starter) => {
    const score = Math.abs(starter.portrait.skin - character.portrait.skin) + (looksMasculine(starter) === masculine ? 0 : 10);
    return !found || score < found.score ? { starter, score } : found;
  }, null);
  if (!best) return undefined;
  const base = PLAYER_MODELS[best.starter.photo!];
  const tints = { ...base.tints };
  for (const fragment of Object.keys(tints)) {
    if (TOP.test(fragment)) tints[fragment] = shirtHex(character.portrait);
    else if (HAIR.test(fragment)) tints[fragment] = hairHex(character.portrait);
  }
  return { model: base.model, tints };
}
