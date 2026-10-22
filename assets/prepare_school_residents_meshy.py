"""Prepare the four supplied Meshy adults; preserve the existing room fixtures.

Blender --background --python assets/prepare_school_residents_meshy.py
Original GLBs remain unchanged. Static seating is baked for scene batching.
"""
import json
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT/'public/school-residents.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUTPUT))
fixtures = {'standing-desk', 'restroom-sink', 'restroom-toilet'}
keep = set()
for obj in bpy.context.scene.objects:
    if obj.name in fixtures:
        keep.add(obj)
        keep.update(obj.children_recursive)
for obj in list(bpy.context.scene.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)


def box(parent, name, location, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new('rounded chair edges', 'BEVEL')
    modifier.width = min(.025, min(size)/3)
    modifier.segments = 2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(chair_material)
    obj.parent = parent


chair_material = bpy.data.materials.new('night guard chair sage')
chair_material.diffuse_color = (.14, .25, .23, 1)
chair_material.use_nodes = True
shader = chair_material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = chair_material.diffuse_color
shader.inputs['Roughness'].default_value = .85
stats = []
for name, filename, neck, seated in [
    ('principal-resident', 'principal', 1.00, False),
    ('vice-principal-resident', 'vice-principal', 1.12, False),
    ('gate-resident', 'school-marshal', 1.00, False),
    ('duty-resident', 'night-guard', 1.02, True),
]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets'/f'{filename}-meshy-source.glb'))
    imported = set(bpy.context.scene.objects)-before
    meshes = [obj for obj in imported if obj.type == 'MESH']
    points = [obj.matrix_world@v.co for obj in meshes for v in obj.data.vertices]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    origin = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
    scale = 1.7/(hi.z-lo.z)
    group = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(group)
    triangles = 0
    for mesh in meshes:
        world = mesh.matrix_world.copy()
        mesh.parent = None
        mesh.matrix_world = Matrix.Identity(4)
        for vertex in mesh.data.vertices:
            p = (world@vertex.co-origin)*scale
            # Match the student's 40% head height while retaining each adult face.
            head_scale = .68/(1.7-neck)
            blend = max(0, min(1, (p.z-neck+.06)/.12))
            p.x *= 1+(head_scale-1)*blend
            p.y *= 1+(head_scale-1)*blend
            p.z = p.z*1.02/neck if p.z <= neck else 1.02+(p.z-neck)*head_scale
            if seated:
                # Bend thighs forward and retain vertical shins; soften the hip seam.
                z = p.z
                thigh = Vector((p.x, z-.62, .62-p.y))
                shin = Vector((p.x, p.y-.30, z+.30))
                bent = thigh.lerp(shin, max(0, min(1, (.36-z)/.08)))
                p = p.lerp(bent, max(0, min(1, (.70-z)/.12)))
                p.z -= .12
            vertex.co = p
        mesh.name = name+' body'
        mesh.parent = group
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.select_all(action='DESELECT')
        mesh.select_set(True)
        bm = bmesh.new()
        bm.from_mesh(mesh.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
        bm.to_mesh(mesh.data)
        bm.free()
        mesh.data.calc_loop_triangles()
        modifier = mesh.modifiers.new('mobile resident surface budget', 'DECIMATE')
        modifier.ratio = min(1, 10000/len(mesh.data.loop_triangles))
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        mesh.data.calc_loop_triangles()
        triangles += len(mesh.data.loop_triangles)
        for face in mesh.data.polygons:
            face.use_smooth = True
        for mat in mesh.data.materials:
            bsdf = mat.node_tree.nodes.get('Principled BSDF')
            for slot in ['Normal', 'Metallic', 'Roughness']:
                for link in list(bsdf.inputs[slot].links):
                    mat.node_tree.links.remove(link)
            bsdf.inputs['Metallic'].default_value = 0
            bsdf.inputs['Roughness'].default_value = .85
            bsdf.inputs['Alpha'].default_value = 1
            for link in list(bsdf.inputs['Alpha'].links):
                mat.node_tree.links.remove(link)
            color = bsdf.inputs['Base Color'].links[0].from_node.image
            color.scale(1024, 1024)
            color.pack()
    for obj in imported:
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    if seated:
        box(group, 'chair seat', (0, .03, .44), (.60, .50, .09))
        box(group, 'chair back', (0, .27, .78), (.60, .07, .64))
        for x in [-.25, .25]:
            for y in [-.17, .23]:
                box(group, 'chair leg', (x, y, .20), (.045, .045, .40))
        box(group, 'footrest', (0, -.38, .15), (.56, .38, .06))
    stats.append({'name': name, 'triangles': triangles, 'standingHeight': 1.7})

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB',
    export_yup=True, export_apply=True, export_skins=False, export_animations=False,
    export_image_format='JPEG', export_jpeg_quality=90)
print('SCHOOL_RESIDENTS', json.dumps({'bytes': OUTPUT.stat().st_size, 'models': stats}), flush=True)
