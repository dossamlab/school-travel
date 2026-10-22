"""Prepare a Meshy-rigged character, keeping its skin weights and walking action.

blender --background --python-exit-code 1 --python assets/prepare_player.py
Another school's student: append `-- <Meshy rig+walk GLB> public/school-player-meshy.glb`.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SOURCE = ROOT / (ARGS[0] if ARGS else 'assets/player-meshy-rig.glb')
OUTPUT = ROOT / (ARGS[1] if len(ARGS) > 1 else 'assets/player.glb')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
# Blender also creates hidden bone-display spheres when importing a skeleton.
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH'
          and any(modifier.type == 'ARMATURE' for modifier in o.modifiers)]
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
rig.name = 'ExplorerRig'

# Stable names connect the skeleton to the game's movement and floor checks.
for source, target in {
    'Hips': 'playerHips', 'LeftArm': 'playerArmL', 'RightArm': 'playerArmR',
    'LeftUpLeg': 'playerLegL', 'RightUpLeg': 'playerLegR',
    'LeftFoot': 'playerFootL', 'RightFoot': 'playerFootR',
}.items():
    rig.data.bones['mixamorig:' + source].name = target

for action in bpy.data.actions:
    if 'Walking' in action.name:
        action.name = 'Walk'
        walk = action
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
    if action != walk:
        bpy.data.actions.remove(action)

# Compress the body while enlarging the face and hair uniformly above the neck.
# The same continuous map moves the surface AND rest skeleton, so skinning has
# no detached head or mismatched inverse-bind matrices.
height_keys = [(0, 0), (.475, .36), (.90, .70), (1.08, .89), (1.18, 1.05), (1.70, 1.70)]
slopes = [(b[1]-a[1])/(b[0]-a[0]) for a, b in zip(height_keys, height_keys[1:])]
tangents = [slopes[0]] + [2*a*b/(a+b) for a, b in zip(slopes, slopes[1:])] + [slopes[-1]]
# The complete head retains its original aspect ratio.
tangents[-2] = tangents[-1]

def cozy_point(point):
    z = point.z
    if z >= height_keys[-2][0]:
        height = height_keys[-2][1] + (z-height_keys[-2][0])*slopes[-1]
    else:
        i = next(i for i, (_, b) in enumerate(zip(height_keys, height_keys[1:])) if z <= b[0])
        a, b = height_keys[i:i+2]
        length = b[0]-a[0]
        t = max(0, (z-a[0])/length)
        height = ((2*t**3-3*t**2+1)*a[1] + (t**3-2*t**2+t)*length*tangents[i]
                  + (-2*t**3+3*t**2)*b[1] + (t**3-t**2)*length*tangents[i+1])
    t = max(0, min(1, (z-1.0)/.18))
    width = 1.10 + .15*t*t*(3-2*t)
    return Vector((point.x*width, point.y*width, height))

# Retarget the authored walk to the new rest axes. Rotations are conjugated
# rather than copied: a bent/shortened bone still swings along its original axis.
start, end = (round(frame) for frame in walk.frame_range)
rig.animation_data.action = walk
old_rest = {bone.name: bone.matrix_local.copy() for bone in rig.data.bones}
samples = []
for frame in range(start, end+1):
    bpy.context.scene.frame_set(frame)
    samples.append((frame, {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}))
rig.animation_data.action = None
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
inverse_rig = rig.matrix_world.inverted()
for bone in rig.data.edit_bones:
    bone.head = inverse_rig @ cozy_point(rig.matrix_world @ bone.head)
    bone.tail = inverse_rig @ cozy_point(rig.matrix_world @ bone.tail)
bpy.ops.object.mode_set(mode='OBJECT')
for mesh in meshes:
    inverse_mesh = mesh.matrix_world.inverted()
    for vertex in mesh.data.vertices:
        vertex.co = inverse_mesh @ cozy_point(mesh.matrix_world @ vertex.co)
    mesh.data.update()
bpy.data.actions.remove(walk)
walk = bpy.data.actions.new('Walk')
rig.animation_data.action = walk
for frame, poses in samples:
    for bone in rig.pose.bones:
        old = old_rest[bone.name]
        new = bone.bone.matrix_local
        axes = old.to_quaternion().inverted() @ new.to_quaternion()
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = axes.inverted() @ poses[bone.name].to_quaternion() @ axes
        old_point = rig.matrix_world @ (old @ poses[bone.name].to_translation())
        new_point = inverse_rig @ cozy_point(old_point)
        bone.location = new.to_3x3().inverted() @ (new_point-new.translation)
        bone.scale = poses[bone.name].to_scale()
        for channel in ('location', 'rotation_quaternion', 'scale'):
            bone.keyframe_insert(channel, frame=frame)

# A neutral standing action allows smooth transitions without freezing mid-step.
idle = bpy.data.actions.new('Idle')
rig.animation_data.action = idle
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'
    bone.matrix_basis.identity()
    for frame in (1, 31):
        bone.keyframe_insert('location', frame=frame)
        bone.keyframe_insert('rotation_quaternion', frame=frame)
        bone.keyframe_insert('scale', frame=frame)
idle.use_fake_user = True
rig.animation_data.action = walk

triangles = 0
for mesh in meshes:
    mesh.data.calc_loop_triangles()
    triangles += len(mesh.data.loop_triangles)
for i, mesh in enumerate(meshes):
    mesh.name = 'ExplorerSurface' + (str(i) if i else '')
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    decimate = mesh.modifiers.new('mobile triangle budget', 'DECIMATE')
    decimate.ratio = min(1, 24000 / triangles)
    decimate.use_collapse_triangulate = True
    # Collapse the neutral mesh before the armature deforms it.
    bpy.ops.object.modifier_move_to_index(modifier=decimate.name, index=0)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for poly in mesh.data.polygons:
        poly.use_smooth = True
    for material in mesh.data.materials:
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Metallic'].default_value = 0
        bsdf.inputs['Roughness'].default_value = .95

# Keep transforms on one parent so mesh, bind matrices and animation agree.
rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
points = []
for mesh in meshes:
    evaluated = mesh.evaluated_get(depsgraph)
    surface = evaluated.to_mesh()
    # Measure only surfaces that will be rendered.
    used = {index for polygon in surface.polygons for index in polygon.vertices}
    points.extend(evaluated.matrix_world @ surface.vertices[index].co for index in used)
    evaluated.to_mesh_clear()
minimum = Vector(tuple(min(p[a] for p in points) for a in range(3)))
maximum = Vector(tuple(max(p[a] for p in points) for a in range(3)))
scale = 1.45 / (maximum.z - minimum.z)
head_ratio = (maximum.z-(rig.matrix_world @ rig.data.bones['mixamorig:Head'].head_local).z) / (maximum.z-minimum.z)
root = bpy.data.objects.new('Explorer', None)
bpy.context.collection.objects.link(root)
for obj in [rig, *meshes]:
    if obj.parent is None:
        obj.parent = root
root.scale = (scale, scale, scale)
root.location = (-scale * (minimum.x + maximum.x) / 2,
                 -scale * (minimum.y + maximum.y) / 2, -scale * minimum.z)
rig.data.pose_position = 'POSE'

sizes = []
for image in bpy.data.images:
    if image.type != 'IMAGE' or not image.size[0]:
        continue
    w, h = image.size
    factor = min(1, 1024 / max(w, h))
    if factor < 1:
        image.scale(round(w * factor), round(h * factor))
    image.pack()
    sizes.append(list(image.size))

bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format='GLB', export_yup=True,
    export_apply=False, export_skins=True, export_all_influences=False,
    export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_image_format='JPEG', export_jpeg_quality=88,
)
print('PLAYER_MOBILE ' + json.dumps({
    'bytes': OUTPUT.stat().st_size, 'source_triangles': triangles,
    'triangles': sum(len(o.data.polygons) for o in meshes),
    'texture_sizes': sizes, 'height': 1.45, 'joints': len(rig.data.bones),
    'action': walk.name, 'scale': scale,
    'head_ratio': head_ratio,
}))
