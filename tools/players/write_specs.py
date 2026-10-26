"""Split players.json into one spec per player and write src/scene/models.ts for the game."""
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
models_ts = sys.argv[1]
specs = os.path.join(here, "specs")
os.makedirs(specs, exist_ok=True)
players = json.load(open(os.path.join(here, 'players.json')))

for name, spec in players.items():
    json.dump(spec, open(os.path.join(specs, f'{name}.json'), 'w'), indent=2)


lines = [
    '/** Rigged 3D players built with MakeHuman, keyed by the roster photo. Generated from the player specs. */',
    'export interface PlayerModel {',
    '  model: string;',
    '  /** Hex colours keyed by a fragment of the garment or hair mesh name; `skin` tints the body. */',
    '  tints: Record<string, string>;',
    '}',
    '',
    'export const PLAYER_MODELS: Record<string, PlayerModel> = {',
]
for name, spec in players.items():
    tints = {item['name'].lower(): item['color'] for item in spec['clothes'] if item.get('color')}
    if spec.get('hairColor'):
        tints[spec['hair'].lower()] = spec['hairColor']
    if spec.get('skinTint'):
        tints['skin'] = spec['skinTint']
    lines.append(f"  'people/{name}.jpg': {{")
    lines.append(f"    model: 'players/{name}.glb',")
    lines.append('    tints: {')
    for key, value in tints.items():
        lines.append(f"      '{key}': '{value}',")
    lines.append('    },')
    lines.append('  },')
lines += ['};', '']
open(models_ts, 'w').write('\n'.join(lines))
print('wrote', models_ts)
