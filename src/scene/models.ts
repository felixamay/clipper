/** Rigged 3D players built with MakeHuman, keyed by the roster photo. Generated from the player specs. */
export interface PlayerModel {
  model: string;
  /** Hex colours keyed by a fragment of the garment or hair mesh name; `skin` tints the body. */
  tints: Record<string, string>;
}

export const PLAYER_MODELS: Record<string, PlayerModel> = {
  'people/ade.jpg': {
    model: 'players/ade.glb',
    tints: {
      'elvs_crude_t-shirt_male': '#2b6a42',
      'toigo_wool_pants': '#2a2a30',
      'shoes04': '#2a221d',
      'short01': '#1b1614',
    },
  },
  'people/helen.jpg': {
    model: 'players/helen.glb',
    tints: {
      'toigo_fisherman_sweater': '#25304f',
      'toigo_wool_pants': '#2c3346',
      'toigo_ballet_flats': '#222226',
      'long01': '#9a5a34',
    },
  },
  'people/mateo.jpg': {
    model: 'players/mateo.glb',
    tints: {
      'namuhekam_male_polo_shirt': '#c4612f',
      'cortu_cargo_pants': '#b7a586',
      'shoes04': '#24201d',
      'culturalibre_hair_02': '#141210',
      'skin': '#d9b090',
    },
  },
  'people/priya.jpg': {
    model: 'players/priya.glb',
    tints: {
      'toigo_fisherman_sweater': '#d9a62a',
      'toigo_wool_pants': '#2a2622',
      'toigo_ballet_flats': '#6b4a32',
      'rehmanpolanski_hair_bun_brown': '#161210',
    },
  },
  'people/soren.jpg': {
    model: 'players/soren.glb',
    tints: {
      'elvs_crude_t-shirt_male': '#a9abaf',
      'cortu_cargo_pants': '#3f5f8a',
      'shoes05': '#b8b8b8',
      'cortu_short_messy_hair': '#f2d79a',
    },
  },
  'people/amara.jpg': {
    model: 'players/amara.glb',
    tints: {
      'toigo_basic_tucked_t-shirt': '#a3222b',
      'toigo_harem_pants': '#c23a3a',
      'toigo_ballet_flats': '#6a4630',
      'afro01': '#121010',
    },
  },
  'people/jonah.jpg': {
    model: 'players/jonah.glb',
    tints: {
      'toigo_fisherman_sweater': '#e6dcc6',
      'toigo_wool_pants': '#6e5238',
      'culturalibre_hair_05': '#a4927a',
    },
  },
  'people/leila.jpg': {
    model: 'players/leila.glb',
    tints: {
      'toigo_fisherman_sweater': '#1f8a92',
      'toigo_wool_pants': '#1f1f26',
      'toigo_ballet_flats': '#2a2a2e',
      'o4saken_long01': '#1e1612',
      'skin': '#e8c4a6',
    },
  },
};
