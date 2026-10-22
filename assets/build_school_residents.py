"""Static school residents reuse the supplied Meshy explorer, with local styling.

Blender --background --python assets/build_school_residents.py
No external generation or identifiable reference photographs are used.
"""
import math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgb, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .75
    shader.inputs['Metallic'].default_value = metal
    return mat


navy = material('navy security accessories', (.025, .055, .095))
dark = material('charcoal glasses and shoes', (.025, .035, .04))
silver = material('satin metal', (.4, .47, .48), .4)
gold = material('security badge', (.65, .48, .16), .3)
white = material('warm porcelain', (.88, .89, .85))
water = material('basin recess', (.37, .57, .57))
wood = material('standing desk oak', (.55, .36, .19))
screen = material('computer display', (.13, .32, .37))
cushion = material('chair sage upholstery', (.14, .25, .23))
crease = material('warm smile creases', (.27, .13, .065))


def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def box(parent, name, p, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(p[0], -p[2], p[1]))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('soft edges', 'BEVEL')
        modifier.width = min(bevel, min(size)/3)
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def ellipse(parent, name, p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=(p[0], -p[2], p[1]))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[2], size[1])
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    obj.parent = parent
    return obj


def ring(parent, name, p, radius, thickness, mat, upright=False):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thickness,
        major_segments=24, minor_segments=8, location=(p[0], -p[2], p[1]),
        rotation=(math.pi/2 if upright else 0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    obj.parent = parent
    return obj


def recolor(mesh, principal):
    mat = mesh.data.materials[0].copy()
    mesh.data.materials[0] = mat
    shader = mat.node_tree.nodes.get('Principled BSDF')
    image_node = shader.inputs['Base Color'].links[0].from_node
    image = image_node.image.copy()
    image_node.image = image
    image.scale(1024, 1024)
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((-1, 4))
    rgb = rgba[:, :3].copy()
    r, g, b = rgb.T
    w, h = image.size
    head = np.zeros((h, w), dtype=bool)
    lower = np.zeros((h, w), dtype=bool)
    jacket_region = np.zeros((h, w), dtype=bool)
    temples = np.zeros((h, w), dtype=bool)
    uv = mesh.data.uv_layers.active.data
    mesh.data.calc_loop_triangles()
    for tri in mesh.data.loop_triangles:
        vertices = [mesh.data.vertices[index] for index in tri.vertices]
        p = sum((v.co for v in vertices), Vector())/3
        weights = {mesh.vertex_groups[g.group].name for v in vertices for g in v.groups if g.weight>.28}
        exposed = any('Hand' in name or 'Neck' in name for name in weights)
        masks = []
        if p.z > 1.02:
            masks.append(head)
            if abs(p.x-.055)>.22:
                masks.append(temples)
        elif not exposed and .12 < p.z < .43:
            masks.append(lower)
        elif not exposed and .43 < p.z < .94 and (abs(p.x-.055)>.10 or p.y>-.06 or p.z<.60):
            masks.append(jacket_region)
        if not masks:
            continue
        a, bb, c = [np.array(uv[i].uv)*(w-1, h-1) for i in tri.loops]
        low = np.maximum(0, np.floor(np.minimum(np.minimum(a, bb), c)).astype(int)-1)
        high = np.minimum((w-1, h-1), np.ceil(np.maximum(np.maximum(a, bb), c)).astype(int)+1)
        xx, yy = np.meshgrid(np.arange(low[0], high[0]+1), np.arange(low[1], high[1]+1))
        ab, ac = bb-a, c-a
        det = ab[0]*ac[1]-ab[1]*ac[0]
        if abs(det) < 1e-8:
            continue
        u = ((xx-a[0])*ac[1]-(yy-a[1])*ac[0])/det
        v = (ab[0]*(yy-a[1])-ab[1]*(xx-a[0]))/det
        for mask in masks:
            mask[low[1]:high[1]+1, low[0]:high[0]+1] |= (u>=0)&(v>=0)&(u+v<=1)
    def padded(mask):
        pad = np.pad(mask, 2)
        return np.logical_or.reduce([pad[y:y+h, x:x+w] for y in range(5) for x in range(5)]).ravel()
    head = padded(head)
    # UV regions keep face/hands/shirt untouched. Preserve the original shading.
    hair = head & (r > g*1.25) & (g > b*1.1) & (r < .36) & (g < .17)
    luminance = rgb.mean(axis=1)
    tone = (.24 + luminance*.8) if principal else (.68 + luminance*.55)
    if principal:
        tone[padded(temples)] += .28
    rgba[hair, :3] = tone[hair, None]*np.array((1, .99, .95))
    jacket = padded(jacket_region)
    rgba[jacket, :3] = (.18+luminance[jacket, None]*.12)*np.array((.70, .90, 1.15))
    trousers = padded(lower)
    rgba[trousers, :3] = (.15+luminance[trousers, None]*.13)*np.array((.75, .83, .94))
    image.pixels.foreach_set(pixels)
    image.update()
    image.pack()


def resident(name, principal=False, seated=False):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/school-player-meshy.glb'))
    imported = set(bpy.context.scene.objects)-before
    rig = next(o for o in imported if o.type == 'ARMATURE')
    mesh = next(o for o in imported if o.type == 'MESH' and len(o.data.vertices)>100 and len(o.data.materials)>0)
    rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    recolor(mesh, principal)
    if seated:
        for side, word in [('L', 'Left'), ('R', 'Right')]:
            for name_part, angle in [(f'playerLeg{side}', -math.pi/2), (f'mixamorig:{word}Leg', math.pi/2)]:
                bone = rig.pose.bones[name_part]
                axes = bone.bone.matrix_local.to_quaternion()
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = axes.inverted() @ Quaternion((1, 0, 0), angle) @ axes
    bpy.context.view_layer.update()
    # Bake the pose: the scene's static batching never depends on a live skeleton.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh.evaluated_get(depsgraph)
    baked = bpy.data.meshes.new_from_object(evaluated)
    body = bpy.data.objects.new(name+' tailored Meshy body', baked)
    bpy.context.collection.objects.link(body)
    body.matrix_world = mesh.matrix_world.copy()
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    group = root(name)
    body.parent = group
    if seated:
        body.location.z += .1
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    modifier = body.modifiers.new('resident mobile budget', 'DECIMATE')
    modifier.ratio = .36
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Match the explorer's large head; unobtrusive round glasses leave eyes visible.
    height = 1.16 + (.1 if seated else 0)
    for x in [-.10, .16]:
        ring(group, 'round glasses', (x, height, .35), .105, .012, dark, True)
        box(group, 'glasses temple', (x+(-.1 if x<0 else .1), height, .20), (.018, .018, .24), dark, .005)
    box(group, 'glasses bridge', (.03, height+.015, .35), (.065, .015, .018), dark, .004)
    for x in [-.24, .30]:
        for dy in [-.045, -.075]:
            box(group, 'gentle eye crease', (x, height+dy, .285), (.045, .009, .009), crease, .003)
    if not principal:
        box(group, 'security chest badge', (.145, .84+(.1 if seated else 0), .15), (.065, .06, .015), gold, .008)
        for x in [-.13, .22]:
            box(group, 'uniform epaulette', (x, .93+(.1 if seated else 0), .025), (.085, .018, .09), navy, .005)
    if seated:
        box(group, 'chair seat', (.05, .47, -.03), (.55, .09, .5), cushion)
        box(group, 'chair back', (.05, .76, -.27), (.55, .58, .08), cushion)
        for x in [-.17, .27]:
            for z in [-.23, .16]:
                box(group, 'chair leg', (x, .22, z), (.045, .44, .045), silver)
        box(group, 'footrest', (.05, .22, .38), (.48, .08, .28), wood)
    # A slightly longer torso and smaller head distinguish adults from the pupil.
    # Apply the same mapping to face accessories, preserving their alignment.
    for obj in list(group.children):
        if obj.type!='MESH' or obj.name.startswith(('chair', 'footrest')):
            continue
        world = obj.matrix_world.copy()
        inverse = world.inverted()
        offset = .1 if seated else 0
        for vertex in obj.data.vertices:
            p = world @ vertex.co
            z = p.z-offset
            if z>.99:
                p.z = 1.0975+(z-.99)*.87+offset
                p.x = .055+(p.x-.055)*.9
                p.y *= .9
            elif z>.56:
                p.z = .56+(z-.56)*1.25+offset
            vertex.co = inverse @ p
    return group


resident('principal-resident', principal=True)
resident('duty-resident', seated=True)
resident('gate-resident')

desk = root('standing-desk')
box(desk, 'desktop', (0, 1.04, 0), (1.6, .08, .8), wood)
for x in [-.62, .62]:
    box(desk, 'adjustable leg', (x, .51, 0), (.075, 1.02, .075), silver)
    box(desk, 'desk foot', (x, .04, 0), (.12, .08, .65), dark)
box(desk, 'monitor stand', (0, 1.16, .12), (.055, .24, .06), silver)
box(desk, 'monitor base', (0, 1.09, .12), (.28, .025, .18), dark)
box(desk, 'monitor', (0, 1.37, .12), (.61, .37, .055), dark)
box(desk, 'screen', (0, 1.37, .151), (.56, .32, .008), screen, .005)
box(desk, 'keyboard', (0, 1.095, .28), (.42, .025, .15), dark)
for i in range(3):
    box(desk, 'screen document', (-.10, 1.43-i*.05, .157), (.24, .015, .005), white, 0)

sink = root('restroom-sink')
box(sink, 'pedestal', (0, .39, -.08), (.22, .78, .24), white)
ellipse(sink, 'basin', (0, .80, 0), (.31, .09, .24), white)
ellipse(sink, 'basin recess', (0, .87, .02), (.23, .015, .15), water)
box(sink, 'tap stem', (0, .93, -.17), (.035, .16, .035), silver)
box(sink, 'tap spout', (0, 1.01, -.12), (.04, .035, .14), silver)

toilet = root('restroom-toilet')
ellipse(toilet, 'toilet base', (0, .20, 0), (.20, .20, .27), white)
ellipse(toilet, 'toilet bowl', (0, .37, .07), (.25, .14, .33), white)
ellipse(toilet, 'bowl recess', (0, .493, .09), (.17, .012, .23), water)
seat = ring(toilet, 'toilet seat', (0, .50, .09), .21, .035, white)
seat.scale.y = 1.32
box(toilet, 'cistern', (0, .62, -.23), (.44, .47, .18), white)
box(toilet, 'flush button', (0, .86, -.23), (.06, .015, .04), silver)

# Keep named prototypes independent and merge only opaque accessory materials.
for group in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
    members = [o for o in group.children if o.type == 'MESH']
    for mat in {o.data.materials[0] for o in members}:
        bpy.ops.object.select_all(action='DESELECT')
        selected = [o for o in group.children if o.type == 'MESH' and o.data.materials[0] == mat]
        for obj in selected:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = selected[0]
        if len(selected)>1:
            bpy.ops.object.join()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/school-residents.glb'), export_format='GLB',
    export_yup=True, export_apply=True, export_animations=False, export_skins=False,
    export_image_format='JPEG', export_jpeg_quality=86)
