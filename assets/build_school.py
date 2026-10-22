"""Original rounded school assets; Blender --background --python assets/build_school.py.

Photo observations inform colors/details only. Footprints follow the PDF-derived
school-plan-data rectangles. No source photographs or PDFs are embedded.
"""
import bpy
import bmesh
import json
import math
import re
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def material(name, rgb, rough=.78, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    return mat


clear()
brick = material('soft beige yellow brick', (.76, .70, .49))
cream = material('limestone bands', (.88, .84, .70))
facade_white = material('white facade bands', (.93, .94, .89))
silver = material('silver window frames and guards', (.76, .81, .80), .38, .45)
teal = material('shop teal wall', (.31, .62, .60))
roof = material('slate roof', (.25, .29, .31))
ink = material('recess shadow', (.13, .22, .22))
glass = material('opaque sea glass', (.36, .60, .62), .34)
glasslight = material('sky reflected upper pane', (.66, .80, .76), .32)
wood = material('maple cabinet', (.63, .40, .20))
maple = material('light maple edge', (.81, .61, .36))
sage = material('sage cushion', (.43, .64, .54))
paper = material('ivory stationery', (.96, .91, .76))
brass = material('satin brass', (.62, .45, .22), .4, .45)
coral = material('clay book cover', (.69, .35, .27))
blue = material('blue book cover', (.33, .49, .61))
stone = material('gate stone', (.57, .59, .53))
stone_light = material('gate stone alternating courses', (.68, .69, .61))
diamond = material('east diamond brick', (.35, .21, .17))

# Original tiny baked color image, with softened mortar and deterministic variation.
image = bpy.data.images.new('original school brick courses', width=256, height=256)
pixels = []
for v in range(256):
    row = v // 32
    for u in range(256):
        offset = 32 if row % 2 else 0
        joint = v % 32 < 2 or (u + offset) % 64 < 2
        tone = .97 + .025 * math.sin((u + offset) // 64 * 7 + row * 3)
        rgb = (.63, .61, .49) if joint else (.76 * tone, .70 * tone, .49 * tone)
        pixels.extend((*rgb, 1))
image.pixels = pixels
image.pack()
texture = brick.node_tree.nodes.new('ShaderNodeTexImage')
texture.image = image
brick.node_tree.links.new(texture.outputs['Color'], brick.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])


def coord(p):
    return (p[0], -p[2], p[1])


def box(name, p, size, mat, bevel=.025):
    # Build locally, avoiding thousands of scene-wide operator updates.
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vertex in bm.verts:
        vertex.co.x *= size[0]
        vertex.co.y *= size[2]
        vertex.co.z *= size[1]
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) / 3), segments=2 if name.startswith('cushion') else 1, affect='EDGES')
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = coord(p)
    mesh.materials.append(mat)
    if mat == brick:
        uv = mesh.uv_layers.new(name='UVMap')
        for face in mesh.polygons:
            side = abs(face.normal.x) > .7
            for loop in face.loop_indices:
                pnt = mesh.vertices[mesh.loops[loop].vertex_index].co + Vector(coord(p))
                uv.data[loop].uv = ((-pnt.y if side else pnt.x) / 2, pnt.z / 2)
    return obj


def beam(name, a, b, radius, mat, sides=8):
    av, bv = Vector(coord(a)), Vector(coord(b))
    direction = bv - av
    rotation = direction.to_track_quat('Z', 'Y')
    vertices = [rotation @ Vector((radius * math.cos(i * math.tau / sides), radius * math.sin(i * math.tau / sides), y)) + (av + bv) / 2 for y in [-direction.length / 2, direction.length / 2] for i in range(sides)]
    faces = [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)] + [tuple(reversed(range(sides))), tuple(range(sides, sides * 2))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def export(name):
    # Bake transforms and join each material to one draw call. Origin remains zero.
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    keys = {(obj.parent, obj.data.materials[0]) for obj in meshes}
    for parent, mat in sorted(keys, key=lambda item: ((item[0].name if item[0] else ''), item[1].name)):
        bpy.ops.object.select_all(action='DESELECT')
        selected = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.parent == parent and obj.data.materials[0] == mat]
        for obj in selected:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = selected[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = (parent.name if parent else name) + '-' + mat.name
        bpy.context.scene.cursor.location = (0, 0, 0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    triangles = sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in objects)
    path = ROOT / 'public' / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_yup=True, export_animations=False, export_texcoords=True, export_meshopt_compression_enable=name in ('school-exterior', 'school-classrooms'))
    print('SCHOOL_ASSET', json.dumps({'file': path.name, 'bytes': path.stat().st_size, 'triangles': triangles, 'primitives': len(objects)}), flush=True)


def window(x, y, z, width, side=0):
    # Local face convention: positive Z is outside; rotate into the chosen wall.
    before = set(bpy.context.scene.objects)
    box('deep window recess', (0, y, 0), (width + .18, 1.85, .13), ink, 0)
    box('window lower glass', (0, y - .22, .075), (width - .08, 1.18, .04), glass, 0)
    box('window transom glass', (0, y + .61, .075), (width - .08, .37, .04), glasslight, 0)
    for dx in [-width / 2, width / 2]:
        box('window outer jamb', (dx, y, .12), (.095, 1.86, .12), silver, 0)
    for dy in [-.89, .38, .89]:
        box('window horizontal frame', (0, y + dy, .13), (width, .075, .12), silver, 0)
    for dx in [-width / 6, width / 6]:
        box('window mullion', (dx, y - .22, .13), (.065, 1.19, .11), silver, 0)
    box('window projecting sill', (0, y - .97, .16), (width + .3, .14, .38), facade_white, 0)
    guard_height = 1.12 if y < 3 else .58
    for dy in [-.84, -.84 + guard_height]:
        box('window guard rail', (0, y + dy, .27), (width, .045, .045), silver, 0)
    bars = max(3, round(width / (.45 if y < 3 else .92)))
    for i in range(bars + 1):
        dx = -width / 2 + width * i / bars
        box('window guard upright', (dx, y - .84 + guard_height / 2, .27), (.035, guard_height, .035), silver, 0)
    for obj in set(bpy.context.scene.objects) - before:
        local = obj.location.copy()
        obj.location.x = x + math.cos(side) * local.x + math.sin(side) * (-local.y)
        obj.location.y = -z + math.sin(side) * local.x + math.cos(side) * local.y
        obj.rotation_euler.z = side


def subtract_intervals(start, end, covers):
    remaining = [(start, end)]
    for low, high in covers:
        cuts = []
        for a, b in remaining:
            if high <= a or low >= b:
                cuts.append((a, b))
            else:
                if low > a:
                    cuts.append((a, low))
                if high < b:
                    cuts.append((high, b))
        remaining = cuts
    return remaining


def outline_edges(rectangles):
    # Subtract covered intervals from rectangle edges, then merge collinear runs.
    edges = {}
    for x0, z0, x1, z1 in rectangles:
        for dc, dr, fixed, start, end in [
            (0, -1, z0, x0, x1), (0, 1, z1, x0, x1),
            (-1, 0, x0, z0, z1), (1, 0, x1, z0, z1),
        ]:
            covers = []
            for a, c, b, d in rectangles:
                low, high = (c, d) if dr else (a, b)
                outside = low < fixed <= high if dc + dr < 0 else low <= fixed < high
                if outside:
                    covers.append((a, b) if dr else (c, d))
            edges.setdefault((dc, dr, fixed), []).extend(subtract_intervals(start, end, covers))
    merged = {}
    for key, intervals in edges.items():
        runs = []
        for start, end in sorted(intervals):
            if runs and start <= runs[-1][1] + 1e-8:
                runs[-1] = (runs[-1][0], max(end, runs[-1][1]))
            elif end - start > 1e-8:
                runs.append((start, end))
        if runs:
            merged[key] = runs
    return merged


def exterior():
    text = (ROOT / 'src' / 'school-plan-data.ts').read_text(encoding='utf-8')
    # Read the same metre-based cells as the runtime, never the old schematic grid.
    metric = []
    for name, x, z, width, depth in re.findall(r"metricCell\('([^']+)',([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)", text):
        metric.append(dict(name=name.replace('\\n', '\n'), col=1+float(x), row=1+float(z), colSpan=float(width), rowSpan=float(depth), border=True))
    assert len(metric) > 20, 'Measured first-floor cells must be parsed before exporting'
    # Upper shells align to the same structural wings; room maps remain separate.
    floors = {floor: metric for floor in range(1, 6)}
    for floor, data in floors.items():
        before = set(bpy.context.scene.objects)
        print('SCHOOL_BUILD exterior floor', floor, flush=True)
        cells = [cell for cell in data if cell['name'] not in ['농구장', '텃밭'] and (floor > 1 or not cell['name'].startswith('필로티'))]
        depth = 1
        z_origin = -35.55
        base = (floor - 1) * 3.6
        rectangles = [(round(cell['col'] - 1, 8), round(cell['row'] - 1, 8), round(cell['col'] - 1 + cell['colSpan'], 8), round(cell['row'] - 1 + cell['rowSpan'], 8)) for cell in cells]
        entrances = [rect for cell, rect in zip(cells, rectangles) if floor == 1 and cell['name'].replace('\n', '') in ['중앙현관', '중앙로비', '동쪽통로', '동편출입구']]
        if floor == 1:
            west = next(rect for cell, rect in zip(cells, rectangles) if cell['name'].replace('\n', '') == '서쪽현관')
            west_mid = west[0] + (west[2] - west[0]) / 4
            entrances.append((west_mid-1.2,west[1],west_mid+1.2,west[3]))
        # PDF coordinates preserve each drawing's aspect ratio and front alignment.
        for cell in cells:
            x = (cell['col'] - 1 + cell['colSpan'] / 2) - 40.5
            z = (cell['row'] - 1 + cell['rowSpan'] / 2) * depth + z_origin
            box('floor plate', (x, base + .08, z), (cell['colSpan'], .16, cell['rowSpan'] * depth), facade_white, 0)
        edges = outline_edges(rectangles)
        for (dc, dr, fixed), runs in edges.items():
            for start, end in runs:
                length = end - start
                x = (start + end) / 2 - 40.5 if dr else fixed - 40.5
                z = fixed * depth + z_origin if dr else (start + end) / 2 * depth + z_origin
                openings = [entrance for entrance in entrances if dr == 1 and abs(fixed - entrance[3]) < 1e-8 and start < entrance[2] and end > entrance[0]]
                front_entrance = bool(openings)
                if front_entrance:
                    cuts = subtract_intervals(start, end, [(entrance[0], entrance[2]) for entrance in openings])
                    for a, b in cuts:
                        if b > a:
                            box('brick entrance wing', ((a + b) / 2 - 40.5, base + 1.76, z), (b - a, 3.35, .24), brick)
                else:
                    box('brick facade', (x, base + 1.76, z), (length if dr else .24, 3.35, .24 if dr else length), brick)
                for y, height, extra in [(base + .29, .24, .08), (base + 3.47, .15, .16)]:
                    if front_entrance and y < 1:
                        for a, b in cuts:
                            if b > a:
                                box('entrance wing stone base', ((a + b) / 2 - 40.5, y, z), (b - a, height, .31), facade_white, .018)
                        continue
                    box('continuous limestone course', (x, y, z), (length + extra if dr else .31, height, .31 if dr else length + extra), facade_white, .018)
                modules = max(1, round(length / (3.9 if dr else 5.0)))
                step = length / modules
                for i in range(modules):
                    offset = -length / 2 + step * (i + .5)
                    wx, wz = (x + offset, z + dr * .15) if dr else (x + dc * .15, z + offset)
                    if any(wx + min(2.85, step * .77) / 2 > entrance[0] - 40.5 and wx - min(2.85, step * .77) / 2 < entrance[2] - 40.5 for entrance in openings):
                        continue
                    # Photo's east end bay carries diamond inlay on every upper floor.
                    if dc == 1 and abs(fixed - 81) < 1e-8 and floor > 1 and abs(wz - 5) < 4:
                        points = [(wx + .03, base + 1.87 + dy, wz + dz) for dy, dz in [(0, -1.25), (.85, 0), (0, 1.25), (-.85, 0), (0, -1.25)]]
                        for a, b in zip(points, points[1:]):
                            beam('brick diamond inlay', a, b, .045, diamond)
                    elif length > .35:
                        window(wx, base + 1.98, wz, min(2.85, step * .77), 0 if dr == 1 else math.pi if dr == -1 else math.pi / 2 if dc == 1 else -math.pi / 2)
                if floor == 5:
                    box('roof eave', (x, 18.06, z), (length + .32 if dr else .55, .2, .55 if dr else length + .32), roof, .045)
        if floor == 5:
            for cell in cells:
                x0 = (cell['col'] - 1) - 40.5
                x1 = x0 + cell['colSpan']
                z0 = (cell['row'] - 1) * depth + z_origin
                z1 = z0 + cell['rowSpan'] * depth
                ridge = -7.65
                breaks = [z0] + ([ridge] if z0 < ridge < z1 else []) + [z1]
                height = lambda z: 18.15 + .82 * max(0, 1 - abs(z - ridge) / 27.9)
                for a, b in zip(breaks, breaks[1:]):
                    mesh = bpy.data.meshes.new('shallow roof slope')
                    mesh.from_pydata([coord(p) for p in [(x0, height(a), a), (x1, height(a), a), (x1, height(b), b), (x0, height(b), b)]], [], [(0, 3, 2, 1)])
                    obj = bpy.data.objects.new('low pitched roof', mesh)
                    bpy.context.collection.objects.link(obj)
                    mesh.materials.append(roof)
        if floor > 1:
            for x in [-28.125, -13.125, 9.375, 24.375]:
                col = x + 40.5
                fronts = [fixed for (dc, dr, fixed), runs in edges.items() if dr == 1 and any(a + .15 <= col <= b - .15 for a, b in runs)]
                if fronts:
                    box('light vertical facade strip', (x, base + 1.9, max(fronts) * depth + z_origin + .18), (.53, 3.6, .34), facade_white, .035)
        if floor == 1:
            root('exterior-ground-floor', before)
    exterior_video_details()
    export('school-exterior')


def exterior_video_details():
    # Video-observed details use schematic sizes; no photographs or identifiers.
    before = set(bpy.context.scene.objects)
    entry_x = 36.59
    for x in [34.2, 38.97]:
        box('east entrance white portal', (x, 1.74, 19.70), (.30, 3.48, 1.10), facade_white, .04)
        box('east entrance teal plinth', (x, .21, 19.70), (.32, .26, 1.12), teal, .025)
    box('east entrance portal lintel', (entry_x, 3.14, 19.70), (5.05, .48, 1.15), facade_white, .04)
    box('east entrance shallow canopy', (entry_x, 3.32, 19.75), (5.30, .17, 2.35), silver, .04)
    # Steps stay inside the entrance footprint, before the campus apron z=20.25.
    for i in range(3):
        height = .10 * (i + 1)
        box('east entrance shallow step', (entry_x, height / 2, 20.04 - i * .29), (4.45, height, .29), stone_light, .018)
    for dx in [-1.09, 1.09]:
        box('east entry door bottom panel', (entry_x + dx, .58, 18.91), (2.06, .46, .08), silver, .015)
        box('east entry door glass', (entry_x + dx, 1.60, 18.91), (1.98, 1.58, .07), glass, .015)
        for edge in [-1.03, 1.03]:
            box('east entry glass door frame', (entry_x + dx + edge, 1.39, 18.97), (.065, 2.24, .10), silver, .012)
        for height in [.28, 2.51]:
            box('east entry glass door crosspiece', (entry_x + dx, height, 18.97), (2.12, .08, .10), silver, .012)
        box('east glass door pull', (entry_x + dx * .24, 1.32, 19.08), (.045, .42, .06), silver, .014)
    # Reuse the observed entrance details at the measured, recessed east facade.
    for obj in set(bpy.context.scene.objects) - before:
        obj.location.x = 38.25 + (obj.location.x - entry_x) * .82
        obj.scale.x *= .82
        obj.location.y += 4.5
    # Replace the westmost ground-floor window with a separate glass entrance.
    west_x = -38.25
    for dx in [-.6,.6]:
        box('west entry door glass', (west_x+dx,1.30,20.43),(1.14,2.38,.07),glass,.014)
        for edge in [-.57,.57]:
            box('west entry door frame', (west_x+dx+edge,1.30,20.48),(.06,2.44,.10),silver,.012)
        for y in [.10,1.05,2.50]:
            box('west entry crosspiece',(west_x+dx,y,20.48),(1.20,.07,.10),silver,.012)
        box('west entry pull',(west_x+dx*.25,1.25,20.57),(.045,.4,.06),silver,.012)
    # The booth is away from the entrance threshold; navigation owns its obstacle.
    bx, bz = 37.5, 25.7
    box('security booth floor', (bx, .08, bz), (2.60, .16, 2.10), silver, .025)
    box('security booth roof', (bx, 2.48, bz), (2.60, .20, 2.10), silver, .035)
    for dx in [-1.24, 1.24]:
        box('security booth side panel', (bx + dx, .60, bz), (.10, 1.04, 1.96), silver, .016)
        box('security booth side glass', (bx + dx, 1.73, bz), (.08, 1.22, 1.94), glass, .01)
    for dz in [-.99, .99]:
        box('security booth lower panel', (bx, .60, bz + dz), (2.40, 1.04, .10), silver, .016)
        box('security booth front glass', (bx, 1.73, bz + dz), (2.40, 1.22, .08), glass, .01)
        for dx in [-1.22, 0, 1.22]:
            box('security booth window jamb', (bx + dx, 1.74, bz + dz), (.065, 1.32, .12), silver, .01)
        box('security booth window sill', (bx, 1.10, bz + dz), (2.50, .075, .13), silver, .01)
    box('security booth door inset', (bx + .63, 1.22, bz + 1.05), (.98, 2.13, .035), glasslight, .012)
    box('security booth door pull', (bx + .23, 1.13, bz + 1.09), (.04, .30, .04), silver, .01)
    # Shop, recycling and piloti supports now use the shared measured runtime layout.


def root(name, before):
    objects = set(bpy.context.scene.objects) - before
    parent = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(parent)
    for obj in objects:
        obj.parent = parent
    return parent


def entry_assets():
    clear()
    before = set(bpy.context.scene.objects)
    # Wall-mounted brackets leave the entire existing entrance route open.
    for x in [-7.95, 7.95]:
        box('canopy wall mounting plate', (x, 2.98, -.30), (.25, .65, .20), cream, .03)
        beam('canopy diagonal brace', (x, 2.8, -.30), (x, 3.21, 1.05), .065, sage)
    box('wide entrance canopy', (0, 3.31, .88), (16.3, .25, 4.0), cream, .075)
    box('sage canopy fascia', (0, 3.49, .88), (16.55, .16, 4.18), sage, .045)
    for x in [-6, -4, -2, 0, 2, 4, 6]:
        box('underside maple rib', (x, 3.13, .88), (.10, .13, 3.7), maple, .015)
    box('entrance nameboard backing', (0, 3.71, 2.97), (5.8, .67, .14), ink, .06)
    root('entrance', before)
    before = set(bpy.context.scene.objects)
    for z in [-3.5, 3.5]:
        for course in range(5):
            box('gate dressed stone course', (0, .145 + course * .27, z), (1.30, .255, 1.30), stone if course % 2 else stone_light, .04)
        box('gate capstone', (0, 1.42, z), (1.56, .20, 1.56), cream, .065)
        box('gate dark inset plaque', (.672, .85, z), (.035, .75, .39), ink, .018)
        for i in range(3):
            box('gate plaque raised ornament', (.698, 1.08 - i * .19, z), (.025, .085, .23), brass, .008)
    # The open retractable gate is folded beside each stone pier, leaving 5m clear.
    for side in [-1, 1]:
        for i in range(4):
            z = side * (2.76 + i * .11)
            beam('folded metal gate upright', (-.32, .09, z), (-.32, 1.09, z), .022, roof)
            beam('folded gate crossbrace', (-.32, .12, z), (-.32, .95, z + side * .16), .018, roof)
        for segment in range(3):
            z0 = side * (4.3 + segment * 2.5)
            for dz in [0, 2.5]:
                box('green fence post', (0, .71, z0 + side * dz), (.10, 1.42, .10), sage, .015)
            for y in [.25, 1.22]:
                beam('green fence rail', (0, y, z0), (0, y, z0 + side * 2.5), .028, sage)
            for i in range(1, 10):
                z = z0 + side * i * .25
                beam('green fence picket', (0, .26, z), (0, 1.23, z), .012, sage)
    root('gate', before)
    export('school-entry')


def furniture_assets():
    clear()
    before = set(bpy.context.scene.objects)
    # Door x=[0,1.74], y=[0,2.22]; origin is the retained left hinge.
    box('door maple leaf', (.87, 1.11, 0), (1.74, 2.22, .105), wood, .03)
    for z in [-.066, .066]:
        box('door recessed lower panel', (.87, .65, z), (1.37, .98, .025), maple, .025)
        box('door inset frosted glass', (.87, 1.64, z), (1.34, .73, .025), glasslight, .035)
        for x in [.16, 1.58]:
            box('door glass stile', (x, 1.64, z * 1.22), (.065, .8, .045), cream, .01)
        for y in [1.23, 2.05]:
            box('door glass rail', (.87, y, z * 1.22), (1.48, .065, .045), cream, .01)
        box('door handle escutcheon', (1.5, 1.02, z * 1.25), (.10, .26, .035), brass, .02)
        box('door lever grip', (1.44, 1.07, z * 1.7), (.18, .045, .065), brass, .02)
        box('door kick plate', (.87, .1, z * 1.23), (1.4, .10, .022), cream, .01)
    for y in [.27, 1.85]:
        beam('door hinge barrel', (.033, y - .08, 0), (.033, y + .08, 0), .033, brass)
    root('door', before)
    before = set(bpy.context.scene.objects)
    # Canonical desktop footprint 2 x 1.2, including all props and feet.
    box('desk maple top', (0, .78, 0), (2, .12, 1.2), maple, .055)
    box('desk underside apron', (0, .66, -.43), (1.78, .16, .11), wood, .025)
    for x in [-.83, .83]:
        for z in [-.43, .43]:
            box('desk tapered leg', (x, .35, z), (.12, .70, .12), wood, .025)
            box('desk sage foot', (x, .055, z), (.14, .11, .14), sage, .02)
    box('desk drawer case', (.55, .54, 0), (.66, .37, .93), wood, .025)
    for y in [.44, .61]:
        box('desk drawer front', (.55, y, .49), (.60, .145, .055), maple, .025)
        box('desk drawer handle', (.55, y, .532), (.22, .036, .06), brass, .012)
    box('desk writing pad', (-.28, .853, .02), (.73, .025, .54), sage, .025)
    box('desk paper stack', (-.29, .888, .04), (.42, .045, .33), paper, .009)
    for i in range(3):
        box('desk paper ruled line', (-.29, .912, -.055 + i * .06), (.26, .003, .006), blue, 0)
    beam('desk pencil', (-.62, .876, .09), (-.56, .876, .35), .011, coral)
    box('desk closed notebook', (.58, .865, -.20), (.30, .045, .39), coral, .015)
    root('desk', before)
    before = set(bpy.context.scene.objects)
    # Shelf is 2 x .7, open on positive Z; shelves remain inside its collision box.
    for x in [-.94, .94]:
        box('shelf maple side', (x, .79, 0), (.12, 1.58, .7), maple, .028)
    box('shelf inset backing', (0, .81, -.318), (1.78, 1.45, .064), wood, .018)
    for y in [.10, .53, .99, 1.53]:
        box('shelf board', (0, y, 0), (1.88, .075, .69), maple, .025)
    for row, y in enumerate([.15, .58, 1.04]):
        for i in range(10):
            x = -.79 + i * .164
            height = .26 + (i % 3) * .047
            cover = [coral, blue, sage, brass][(i + row) % 4]
            box('shelf book cover', (x, y + height / 2, .045), (.12, height, .39), cover, .01)
            box('shelf book spine label', (x, y + height * .65, .247), (.075, .042, .018), paper, .005)
    root('shelf', before)
    before = set(bpy.context.scene.objects)
    # Bench canonical footprint 2 x 1, with cushions contained by the wood rim.
    for x in [-.78, .78]:
        for z in [-.32, .32]:
            box('bench stout foot', (x, .19, z), (.16, .38, .16), wood, .035)
    box('bench maple seat rim', (0, .41, 0), (2, .15, 1), maple, .05)
    for x in [-.48, .48]:
        box('cushion plump upholstered seat', (x, .555, 0), (.91, .20, .89), sage, .075)
        box('cushion front piping', (x, .55, .448), (.80, .025, .018), cream, .008)
    box('bench back rail', (0, .77, -.40), (1.82, .13, .12), maple, .035)
    for x in [-.86, .86]:
        box('bench back post', (x, .67, -.40), (.12, .55, .12), wood, .02)
    root('bench', before)
    export('school-furniture')


# build_school_classrooms.py imports these helpers without rebuilding the other GLBs.
if __name__ == '__main__':
    selected = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not selected or 'exterior' in selected:
        exterior()
    if not selected or 'entry' in selected:
        entry_assets()
    if not selected or 'furniture' in selected:
        furniture_assets()
