"""Build one rigged MakeHuman player from a JSON spec and export it as a GLB for the game.

blender -b --python build_player.py -- spec.json out.glb
"""
import json
import os
import sys

import addon_utils
import bpy

spec_path, out = sys.argv[sys.argv.index('--') + 1:][:2]
spec = json.load(open(spec_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.locationservice import LocationService  # noqa: E402

LIB = LocationService.get_user_data()
SYS = LocationService.get_mpfb_data()


def find(kind, name):
    """Find an asset file (.mhclo/.mhmat) by folder name in the user library, then the system one."""
    for base in (LIB, SYS, os.path.join(LIB, 'packs')):
        folder = os.path.join(base, kind, name)
        if os.path.isdir(folder):
            for ext in ('.mhclo', '.mhmat'):
                hits = [f for f in os.listdir(folder) if f.endswith(ext)]
                if hits:
                    return os.path.join(folder, hits[0])
        flat = os.path.join(base, kind, name)
        if os.path.isfile(flat):
            return flat
    raise FileNotFoundError(f'{kind}/{name}')


macros = {
    'gender': 0.5, 'age': 0.5, 'muscle': 0.5, 'weight': 0.5, 'proportions': 0.5, 'height': 0.5,
    'cupsize': 0.5, 'firmness': 0.5, 'race': {'asian': 0.33, 'caucasian': 0.33, 'african': 0.33},
}
for key, value in spec.get('macros', {}).items():
    if key == 'race':
        macros['race'].update(value)
    else:
        macros[key] = value

basemesh = HumanService.create_human(macro_detail_dict=macros)
rig = HumanService.add_builtin_rig(basemesh, 'game_engine')

if spec.get('skin'):
    HumanService.set_character_skin(find('skins', spec['skin']), basemesh, skin_type='GAMEENGINE')

for kind, name in (('eyes', spec.get('eyes')), ('eyebrows', spec.get('eyebrows')), ('eyelashes', spec.get('eyelashes'))):
    if name:
        try:
            HumanService.add_mhclo_asset(find(kind, name), basemesh, asset_type=kind.capitalize(), subdiv_levels=0)
        except FileNotFoundError as err:
            print('MISSING', err)

if spec.get('hair'):
    try:
        HumanService.add_mhclo_asset(find('hair', spec['hair']), basemesh, asset_type='Hair', subdiv_levels=0)
    except FileNotFoundError as err:
        print('MISSING', err)

for item in spec.get('clothes', []):
    obj = HumanService.add_mhclo_asset(find('clothes', item['name']), basemesh, asset_type='Clothes', subdiv_levels=0)
    print('CLOTHES', item['name'], obj.name if obj else None)

# Delete the body under clothing and the fitting helpers outright, rather than trusting the
# exporter to apply masks that sit after the skeleton in the modifier stack.
import bmesh  # noqa: E402
for mod in list(basemesh.modifiers):
    if mod.type != 'MASK':
        continue
    group = basemesh.vertex_groups.get(mod.vertex_group)
    if group is None:
        basemesh.modifiers.remove(mod)
        continue
    inside = set()
    for v in basemesh.data.vertices:
        for g in v.groups:
            if g.group == group.index and g.weight > 0.5:
                inside.add(v.index)
                break
    # A normal mask keeps the group; an inverted one keeps everything else.
    doomed = {v.index for v in basemesh.data.vertices if (v.index in inside) == mod.invert_vertex_group}
    bm = bmesh.new()
    bm.from_mesh(basemesh.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in doomed], context='VERTS')
    bm.to_mesh(basemesh.data)
    bm.free()
    basemesh.modifiers.remove(mod)
    print('MASKED', mod.name if False else group.name, len(doomed), 'verts removed')

# None of the trousers carry "hide the body" data, so seated knees poke through them. Under any
# trousers, delete the skin of the thighs and shins outright.
if any(word in item['name'] for item in spec.get('clothes', []) for word in ('pants', 'trousers', 'jeans')):
    legs = {g.index for g in basemesh.vertex_groups if g.name in ('thigh_l', 'thigh_r', 'calf_l', 'calf_r')}
    # Only the skeleton's own weight groups count; the mesh also carries helper groups like "body".
    bone_groups = {g.index for g in basemesh.vertex_groups if rig and g.name in rig.data.bones}
    doomed = set()
    for v in basemesh.data.vertices:
        weights = [g for g in v.groups if g.group in bone_groups]
        if weights and max(weights, key=lambda g: g.weight).group in legs:
            doomed.add(v.index)
    bm = bmesh.new()
    bm.from_mesh(basemesh.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in doomed], context='VERTS')
    bm.to_mesh(basemesh.data)
    bm.free()
    print('LEGS', len(doomed), 'verts removed under trousers')

# Solid skin, eyes and cloth; cut-out edges for hair, brows and lashes. Blended transparency
# draws in the wrong order in the browser and lets the skin show through the shirt.
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    cutout = any(word in obj.name.lower() for word in ('eyebrow', 'eyelash', 'hair', 'short0', 'long0', 'bob0', 'afro', 'braid', 'ponytail'))
    for mat in obj.data.materials:
        if mat is None:
            continue
        mat.blend_method = 'CLIP' if cutout else 'OPAQUE'
        if cutout:
            mat.alpha_threshold = 0.5

# Garments and hair that the game recolours get a bright greyscale texture first, so the tint
# becomes the real colour while the weave, folds and strands survive.
import numpy as np  # noqa: E402
tinted = {item['name'] for item in spec.get('clothes', []) if item.get('color')}
if spec.get('hairColor'):
    tinted.add(spec['hair'])
done = set()
for obj in bpy.data.objects:
    if obj.type != 'MESH' or not any(obj.name.endswith(name) for name in tinted):
        continue
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            image = getattr(node, 'image', None)
            if node.type != 'TEX_IMAGE' or image is None or image.name in done:
                continue
            if any(word in image.name.lower() for word in ('norm', 'nrm', 'spec', 'rough', 'bump', '_ao')):
                continue
            done.add(image.name)
            px = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(px)
            rgba = px.reshape(-1, 4)
            luma = rgba[:, 0] * 0.3 + rgba[:, 1] * 0.59 + rgba[:, 2] * 0.11
            seen = luma[rgba[:, 3] > 0.5] if (rgba[:, 3] > 0.5).any() else luma
            top = max(float(np.percentile(seen, 90)), 1e-3)
            grey = np.clip(luma / top * 0.92, 0, 1)
            rgba[:, 0] = rgba[:, 1] = rgba[:, 2] = grey
            image.pixels.foreach_set(rgba.ravel())
            image.update()
            print('NEUTRAL', obj.name, image.name)

# Smaller textures keep each player a few megabytes: skin and eyes at 1024, everything else at 512.
for image in bpy.data.images:
    keep = 1024 if any(w in image.name.lower() for w in ('skin', 'diffuse', 'eye')) and 'shoe' not in image.name.lower() else 512
    if image.size[0] > keep:
        image.scale(keep, max(1, int(image.size[1] * keep / image.size[0])))

report = {
    'objects': [o.name for o in bpy.data.objects],
    'bones': len(rig.data.bones) if rig else 0,
    'images': [(i.name, tuple(i.size)) for i in bpy.data.images],
}
print('REPORT', json.dumps(report))
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', export_skins=True, export_animations=False, export_apply=True,
    export_image_format='WEBP', export_image_quality=82,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
)
print('EXPORTED', out, os.path.getsize(out))
