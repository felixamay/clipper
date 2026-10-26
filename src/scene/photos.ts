/** Seated photographs and reaching arms, keyed by the roster photo. Measured from the images. */
export interface PlayerRig {
  seated: string;
  /** Width over height of the seated photo. */
  seatedAspect: number;
  /** The front of the knees, from the left of the seated photo (0–1). */
  knee: number;
  /** The near shoulder, as fractions of the seated photo from its top-left. */
  shoulder: [number, number];
  hand: string;
  handAspect: number;
  /** Where thumb and finger meet, as fractions of the arm photo from its top-left. */
  pinch: [number, number];
}

export const PLAYER_RIGS: Record<string, PlayerRig> = {
  'people/ade.jpg': {
    seated: 'people/ade-seated.webp',
    seatedAspect: 0.61,
    knee: 0.997,
    shoulder: [0.51, 0.33],
    hand: 'people/ade-hand.webp',
    handAspect: 3.6524,
    pinch: [0.9768, 0.65],
  },
  'people/helen.jpg': {
    seated: 'people/helen-seated.webp',
    seatedAspect: 0.5473,
    knee: 0.9967,
    shoulder: [0.63, 0.34],
    hand: 'people/helen-hand.webp',
    handAspect: 3.7238,
    pinch: [0.9772, 0.3583],
  },
  'people/mateo.jpg': {
    seated: 'people/mateo-seated.webp',
    seatedAspect: 0.5791,
    knee: 0.9984,
    shoulder: [0.71, 0.35],
    hand: 'people/mateo-hand.webp',
    handAspect: 3.4524,
    pinch: [0.9754, 0.5667],
  },
  'people/priya.jpg': {
    seated: 'people/priya-seated.webp',
    seatedAspect: 0.6173,
    knee: 0.9971,
    shoulder: [0.7, 0.35],
    hand: 'people/priya-hand.webp',
    handAspect: 2.5214,
    pinch: [0.9664, 0.4274],
  },
  'people/soren.jpg': {
    seated: 'people/soren-seated.webp',
    seatedAspect: 0.5845,
    knee: 0.9984,
    shoulder: [0.62, 0.3],
    hand: 'people/soren-hand.webp',
    handAspect: 3.8286,
    pinch: [0.9779, 0.556],
  },
  'people/amara.jpg': {
    seated: 'people/amara-seated.webp',
    seatedAspect: 0.5645,
    knee: 0.9952,
    shoulder: [0.6, 0.3],
    hand: 'people/amara-hand.webp',
    handAspect: 3.3548,
    pinch: [0.9747, 0.5833],
  },
  'people/jonah.jpg': {
    seated: 'people/jonah-seated.webp',
    seatedAspect: 0.5745,
    knee: 0.9984,
    shoulder: [0.66, 0.32],
    hand: 'people/jonah-hand.webp',
    handAspect: 3.2,
    pinch: [0.9735, 0.5988],
  },
  'people/leila.jpg': {
    seated: 'people/leila-seated.webp',
    seatedAspect: 0.5273,
    knee: 0.9966,
    shoulder: [0.62, 0.31],
    hand: 'people/leila-hand.webp',
    handAspect: 3.419,
    pinch: [0.9759, 0.6679],
  },
};
