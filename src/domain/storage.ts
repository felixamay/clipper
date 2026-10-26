import { useSyncExternalStore } from 'react';
import { Character, RecordBook } from './character';
import { STARTER_ROSTER } from './roster';
import { PortraitSpec, FACE_SHAPES, HAIR_STYLES, EYE_SHAPES, BROWS, NOSES, MOUTHS, FACIAL_HAIR } from '../portrait/palette';

const KEY = 'clipper.draughts.roster.v1';

function isPortrait(value: unknown): value is PortraitSpec {
  if (!value || typeof value !== 'object') return false;
  const portrait = value as PortraitSpec;
  return (
    typeof portrait.skin === 'number' &&
    FACE_SHAPES.includes(portrait.face) &&
    HAIR_STYLES.includes(portrait.hairStyle) &&
    typeof portrait.hairColor === 'number' &&
    EYE_SHAPES.includes(portrait.eyeShape) &&
    typeof portrait.eyeColor === 'number' &&
    BROWS.includes(portrait.brow) &&
    NOSES.includes(portrait.nose) &&
    MOUTHS.includes(portrait.mouth) &&
    FACIAL_HAIR.includes(portrait.facialHair)
  );
}

function isRecord(value: unknown): value is RecordBook {
  if (!value || typeof value !== 'object') return false;
  const record = value as RecordBook;
  return [record.played, record.wins, record.losses, record.draws].every((n) => typeof n === 'number' && n >= 0);
}

function isCharacter(value: unknown): value is Character {
  if (!value || typeof value !== 'object') return false;
  const character = value as Character;
  return (
    typeof character.id === 'string' &&
    typeof character.name === 'string' &&
    character.name.length > 0 &&
    typeof character.depth === 'number' &&
    typeof character.noise === 'number' &&
    isPortrait(character.portrait) &&
    isRecord(character.record)
  );
}

function seed(): Character[] {
  return STARTER_ROSTER.map((character) => ({
    ...character,
    portrait: { ...character.portrait },
    record: { ...character.record },
  }));
}

function load(): Character[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isCharacter)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

let roster = load();
const listeners = new Set<() => void>();

function emit(): void {
  localStorage.setItem(KEY, JSON.stringify(roster));
  for (const listener of listeners) listener();
}

export function getRoster(): Character[] {
  return roster;
}

export function subscribeRoster(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoster(): Character[] {
  return useSyncExternalStore(subscribeRoster, getRoster, getRoster);
}

export function addCharacter(character: Character): void {
  roster = [...roster, character];
  emit();
}

export function recordResult(whiteId: string, blackId: string, result: 'white' | 'black' | 'draw'): void {
  roster = roster.map((character) => {
    if (character.id !== whiteId && character.id !== blackId) return character;
    const record = { ...character.record, played: character.record.played + 1 };
    if (result === 'draw') record.draws += 1;
    else if ((result === 'white' && character.id === whiteId) || (result === 'black' && character.id === blackId)) {
      record.wins += 1;
    } else {
      record.losses += 1;
    }
    return { ...character, record };
  });
  emit();
}
