# Players

The eight starter players are rigged 3D people made with [MakeHuman](http://www.makehumancommunity.org) through its Blender add-on, MPFB. Each one sits at the table, breathes, watches the board, and reaches for the exact square it moves to; that motion is worked out live in `src/scene/character.ts`.

`players.json` describes every player: body shape (sex, age, build, height, ethnicity), skin, eyes, brows, hair, clothes, and the colours that match their portrait.

To rebuild them you need Blender 4.2 with MPFB installed and these MakeHuman asset packs in its library: `makehuman_system_assets`, `skins01`, `shirts01`, `pants01`, `shoes01`, `hair01` (all CC0).

```sh
python3 tools/players/write_specs.py src/scene/models.ts
for name in ade helen mateo priya soren amara jonah leila; do
  blender -b --python tools/players/build_player.py -- tools/players/specs/$name.json public/players/$name.glb
done
```

`write_specs.py` also regenerates `src/scene/models.ts`, which holds each garment's colour; the game applies those when it loads a player, over greyscale textures the build makes for anything it recolours.
