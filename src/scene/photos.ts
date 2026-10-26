/** Seated photographs and reaching hands, keyed by the roster photo. Measured from the images. */
export interface PlayerRig {
  seated: string;
  /** Width over height of the seated photo. */
  seatedAspect: number;
  /** Height of the tabletop, from the top of the seated photo (0–1). */
  table: number;
  /** Where the table edge meets the player, from the left of the seated photo (0–1). */
  edge: number;
  hand: string;
  handAspect: number;
  /** Where thumb and finger meet, as fractions of the hand photo from its top-left. */
  pinch: [number, number];
}

export const PLAYER_RIGS: Record<string, PlayerRig> = {
  'people/ade.jpg': {
    seated: 'people/ade-seated.webp',
    seatedAspect: 0.8018,
    table: 0.4482,
    edge: 0.7045,
    hand: 'people/ade-hand.webp',
    handAspect: 3.6524,
    pinch: [0.9768, 0.65],
  },
  'people/helen.jpg': {
    seated: 'people/helen-seated.webp',
    seatedAspect: 0.86,
    table: 0.4182,
    edge: 0.8563,
    hand: 'people/helen-hand.webp',
    handAspect: 3.7238,
    pinch: [0.9772, 0.3583],
  },
  'people/mateo.jpg': {
    seated: 'people/mateo-seated.webp',
    seatedAspect: 0.72,
    table: 0.3955,
    edge: 0.6997,
    hand: 'people/mateo-hand.webp',
    handAspect: 3.4524,
    pinch: [0.9754, 0.5667],
  },
  'people/priya.jpg': {
    seated: 'people/priya-seated.webp',
    seatedAspect: 0.7336,
    table: 0.3073,
    edge: 0.7285,
    hand: 'people/priya-hand.webp',
    handAspect: 2.5214,
    pinch: [0.9664, 0.4274],
  },
  'people/soren.jpg': {
    seated: 'people/soren-seated.webp',
    seatedAspect: 0.7136,
    table: 0.4391,
    edge: 0.7112,
    hand: 'people/soren-hand.webp',
    handAspect: 3.8286,
    pinch: [0.9779, 0.556],
  },
  'people/amara.jpg': {
    seated: 'people/amara-seated.webp',
    seatedAspect: 0.7545,
    table: 0.39,
    edge: 0.7186,
    hand: 'people/amara-hand.webp',
    handAspect: 3.3548,
    pinch: [0.9747, 0.5833],
  },
  'people/jonah.jpg': {
    seated: 'people/jonah-seated.webp',
    seatedAspect: 0.7409,
    table: 0.39,
    edge: 0.6831,
    hand: 'people/jonah-hand.webp',
    handAspect: 3.2,
    pinch: [0.9735, 0.5988],
  },
  'people/leila.jpg': {
    seated: 'people/leila-seated.webp',
    seatedAspect: 0.6245,
    table: 0.3745,
    edge: 0.7762,
    hand: 'people/leila-hand.webp',
    handAspect: 3.419,
    pinch: [0.9759, 0.6679],
  },
};
