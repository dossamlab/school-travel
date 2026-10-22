"""Special-room furniture; Blender --background --python assets/build_school_classrooms.py.

Shapes follow the supplied room walk-through videos (src/classrooms, not shipped).
Only representative furniture is modelled; small props such as extinguishers or bins are
left out. Every prototype stands on y=0, is centred on its footprint and faces +Z.
Game coordinates (x, y-up, z) are converted by build_school.coord.
"""
import bmesh
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_school as base  # noqa: E402  (helpers only; its own exports stay untouched)

box, beam, material, coord = base.box, base.beam, base.material, base.coord

white = material('white laminate', (.91, .91, .88), .62)
trim = material('grey edge trim', (.52, .55, .56), .55)
steel = material('brushed steel', (.72, .74, .74), .34, .6)
black = material('black plastic', (.11, .12, .13), .55)
screen = material('glossy dark screen', (.03, .04, .06), .18)
navy = material('navy seat', (.17, .23, .42))
orange = material('orange seat', (.86, .55, .24))
maroon = material('maroon seat', (.55, .17, .25))
grey_seat = material('grey seat', (.55, .58, .60))
royal = material('royal blue cabinet', (.16, .26, .68), .45)
clear_glass = material('cabinet clear glass', (.74, .87, .92), .08)
chalk = material('chalkboard green', (.22, .42, .33), .9)
yellow = material('yellow basket', (.96, .84, .22))
teal = material('incubator teal', (.33, .70, .69), .5)
cream = material('incubator cream', (.90, .88, .79), .6)
red = material('rack red', (.80, .17, .15), .45)
rubber = material('rubber floor mat', (.21, .22, .23), .95)
walnut = material('walnut top', (.34, .21, .13), .55)
maple = material('light maple', (.82, .64, .40), .6)
granite = material('granite counter', (.66, .66, .62), .5)
brown_top = material('brown counter', (.42, .22, .17), .5)
peach = material('peach cubby', (.96, .74, .62))
mint = material('mint cubby', (.66, .84, .70))
sky = material('sky cubby', (.68, .80, .93))
lavender = material('lavender cubby', (.76, .70, .90))
light_blue = material('light blue cushion', (.63, .81, .91))
sofa_green = material('sage sofa', (.58, .72, .47))
coral_leg = material('coral table leg', (.86, .40, .26))
gold = material('festival gold', (.88, .67, .22), .32, .55)
biohazard = material('biohazard yellow', (.96, .80, .10))
balloon_colors = [material(name, rgb, .22) for name, rgb in [
    ('balloon pink', (.97, .47, .63)), ('balloon yellow', (.99, .82, .30)), ('balloon sky', (.45, .71, .96)),
    ('balloon mint', (.43, .85, .65)), ('balloon lavender', (.72, .56, .92)), ('balloon coral', (.99, .52, .40))]]
germ_body = material('germ red', (.93, .29, .33), .5)
germ_wing = material('germ wing', (.60, .12, .22), .55)
germ_belly = material('germ belly', (.99, .78, .74), .55)
germ_nub = material('germ nub', (.99, .56, .58), .5)
horn = material('germ horn', (.99, .90, .58), .45)
eye = material('germ eye white', (.99, .99, .97), .3)
pupil = material('germ pupil', (.06, .06, .09), .25)
cheek = material('germ cheek', (.99, .60, .68), .6)
pink_body = material('arcade pink', (.97, .62, .72), .45)
sky_body = material('arcade sky', (.46, .70, .93), .45)
snow = material('arcade white', (.98, .97, .93), .5)

footprints = {}


def link(name, mesh, mat, p, scale=(1, 1, 1)):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = coord(p)
    obj.scale = (scale[0], scale[2], scale[1])
    mesh.materials.append(mat)
    return obj


def cylinder(name, p, radius, height, mat, sides=16, scale=(1, 1), top=None):
    """Vertical cylinder (or cone with top radius) centred at p."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=radius, radius2=radius if top is None else top, depth=height)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link(name, mesh, mat, p, (scale[0], 1, scale[1]))


def sphere(name, p, radius, mat, scale=(1, 1, 1), segments=12, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    for face in bm.faces:
        face.smooth = True
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return link(name, mesh, mat, p, scale)


def turn(obj, yaw=0, pitch=0, roll=0):
    """Rotate about game Y (yaw), game X (pitch) and game Z (roll)."""
    obj.rotation_mode = 'XYZ'
    obj.rotation_euler = (pitch, roll, yaw)
    return obj


def cone(name, p, radius, height, mat, sides=8, pitch=0, roll=0):
    obj = cylinder(name, p, radius, height, mat, sides, top=0)
    return turn(obj, pitch=pitch, roll=roll)


def pivot(name, p, yaw=0):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = coord(p)
    obj.rotation_euler = (0, 0, yaw)
    return obj


FACING = {'+z': 0, '-z': math.pi, '+x': math.pi / 2, '-x': -math.pi / 2}


def seat(x, y, z, face):
    """Sitting spot for the explorer: on the seat surface, local +Z looking the way the sitter faces."""
    return pivot('seat', (x, y, z), FACING[face])


def attach(objects, parent):
    bpy.context.view_layer.update()
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world


def model(name, before, size):
    """Parent new objects to a named root, centred on its footprint and standing on y=0."""
    objects = set(bpy.context.scene.objects) - before
    loose = [obj for obj in objects if obj.parent is None]
    bpy.context.view_layer.update()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for obj in objects:
        if obj.type != 'MESH':
            continue
        for vertex in obj.data.vertices:
            world = obj.matrix_world @ vertex.co
            lo = Vector(map(min, lo, world))
            hi = Vector(map(max, hi, world))
    # Blender (x, y, z) is game (x, -z, y); recentring keeps every rect in the room layout honest.
    shift = Vector((-(hi.x + lo.x) / 2, -(hi.y + lo.y) / 2, -lo.z))
    assert shift.length < .25, (name, 'prototype drifted from its origin', shift)
    parent = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(parent)
    for obj in loose:
        obj.location += shift
        obj.parent = parent
    width, depth = hi.x - lo.x, hi.y - lo.y
    if abs(width - size[0]) > .06 or abs(depth - size[1]) > .06:
        print('FOOTPRINT_NOTE', name, round(width, 3), round(depth, 3), 'expected', size, flush=True)
    footprints[name] = [round(width, 3), round(depth, 3), round(hi.z - lo.z, 3)]
    return parent


def start():
    return set(bpy.context.scene.objects)


# ---------------------------------------------------------------- shared parts
def chair(x, z, face, cushion=navy, shell=black, legs=steel):
    """Stacking school chair; `face` is the direction the sitter looks: +z, -z, +x or -x."""
    sx, sz = {'+z': (0, -1), '-z': (0, 1), '+x': (-1, 0), '-x': (1, 0)}[face]
    along_x = sx != 0
    seat(x, .475, z, face)
    seat_size = (.40, .05, .42) if along_x else (.42, .05, .40)
    box('chair seat', (x, .45, z), seat_size, cushion, .02)
    bx, bz = x + sx * .18, z + sz * .18
    box('chair back shell', (bx, .74, bz), (.04, .32, .42) if along_x else (.42, .32, .04), shell, .02)
    for a in (-.17, .17):
        for b in (-.16, .16):
            lx, lz = (x + b, z + a) if along_x else (x + a, z + b)
            beam('chair leg', (lx, 0, lz), (lx, .43, lz), .013, legs, 6)
    for a in (-.15, .15):
        px, pz = (bx, z + a) if along_x else (x + a, bz)
        beam('chair back post', (px, .46, pz), (px, .62, pz), .012, legs, 6)


def office_chair(x, z, face, color=black):
    sx, sz = {'+z': (0, -1), '-z': (0, 1), '+x': (-1, 0), '-x': (1, 0)}[face]
    along_x = sx != 0
    seat(x, .51, z, face)
    box('office chair seat', (x, .47, z), (.46, .08, .46), color, .03)
    bx, bz = x + sx * .22, z + sz * .22
    box('office chair mesh back', (bx, .82, bz), (.06, .48, .44) if along_x else (.44, .48, .06), color, .03)
    beam('office chair post', (x, .08, z), (x, .44, z), .025, steel, 8)
    box('office chair base', (x, .05, z), (.52, .04, .07), black, .015)
    box('office chair base', (x, .05, z), (.07, .04, .52), black, .015)


def table_top(p, size, top, edge=trim):
    box('table top', (p[0], p[1], p[2]), size, top, .015)
    box('table edge band', (p[0], p[1] - .02, p[2]), (size[0] + .02, .025, size[2] + .02), edge, .006)


def shelf_books(x0, x1, y, z, depth=.22):
    covers = [balloon_colors[2], walnut, sofa_green, maroon, peach, navy]
    x, i = x0, 0
    while x < x1 - .05:
        h = .2 + (i % 3) * .03
        box('book', (x + .025, y + h / 2, z), (.045, h, depth), covers[i % len(covers)], .004)
        x += .055
        i += 1


def balloon(x, y, z, mat, r=.15):
    sphere('balloon', (x, y, z), r, mat, (1, 1.18, 1), 10, 7)
    cone('balloon knot', (x, y - r * 1.2, z), .02, .04, mat, 5, pitch=math.pi)


# ---------------------------------------------------------------- lab rooms
def lab_set(name, seat, shell=black):
    before = start()
    table_top((0, .765, 0), (2.4, .04, .9), white)
    box('lab table pedestal', (0, .38, 0), (2.28, .66, .78), white, .02)
    box('lab table seam', (0, .38, .395), (.012, .6, .01), trim, 0)
    box('lab table toe kick', (0, .035, 0), (2.24, .07, .72), trim, .01)
    for x in (-.6, .6):
        chair(x, .73, '-z', seat, shell)
        chair(x, -.73, '+z', seat, shell)
    model(name, before, (2.4, 1.88))


def teacher_desk():
    before = start()
    table_top((0, .745, 0), (1.6, .04, .7), white)
    box('teacher desk modesty panel', (0, .4, .32), (1.56, .62, .03), trim, .01)
    box('teacher desk drawer pedestal', (.5, .37, 0), (.5, .7, .62), white, .02)
    for x in (-.74,):
        for z in (-.3, .3):
            beam('teacher desk leg', (x, 0, z), (x, .72, z), .02, steel, 6)
    box('monitor screen', (-.15, 1.03, -.12), (.56, .34, .025), screen, .01)
    box('monitor back', (-.15, 1.03, -.1), (.58, .36, .02), black, .01)
    beam('monitor stand', (-.15, .77, -.06), (-.15, .88, -.06), .02, black, 6)
    box('monitor foot', (-.15, .775, -.06), (.2, .015, .14), black, .005)
    box('keyboard', (-.15, .775, -.32 + .1), (.42, .015, .13), black, .004)
    model('teacher-desk', before, (1.62, .72))


def board_stand(width, posts):
    for x in posts:
        beam('board stand post', (x, 0, 0), (x, 2.16, 0), .025, steel, 6)
        box('board stand foot', (x, .02, 0), (.08, .04, .34), steel, .01)


def electronic_board():
    before = start()
    box('board aluminium frame', (0, 1.55, 0), (5.3, 1.24, .05), steel, .015)
    for x in (-1.85, 1.85):
        box('green board', (x, 1.55, .028), (1.55, 1.16, .012), chalk, 0)
    box('electronic board bezel', (0, 1.55, .035), (2.18, 1.24, .05), black, .02)
    box('electronic board screen', (0, 1.55, .062), (2.02, 1.12, .005), screen, 0)
    box('electronic board camera', (0, 2.13, .05), (.12, .035, .03), black, .005)
    box('chalk tray', (0, .95, .07), (5.2, .03, .1), steel, .008)
    board_stand(5.3, (-2.62, 2.62))
    model('board-electronic', before, (5.3, .34))


def projector_board():
    """Computer room front wall: green boards either side of a pull-down projector screen."""
    before = start()
    box('board aluminium frame', (0, 1.55, 0), (5.3, 1.24, .05), steel, .015)
    for x in (-1.85, 1.85):
        box('green board', (x, 1.55, .028), (1.55, 1.16, .012), chalk, 0)
    box('projector screen case', (0, 2.12, .06), (2.3, .08, .08), white, .02)
    box('projector screen', (0, 1.55, .05), (2.1, 1.08, .008), snow, 0)
    box('chalk tray', (0, .95, .07), (5.2, .03, .1), steel, .008)
    board_stand(5.3, (-2.62, 2.62))
    model('board-projector', before, (5.3, .34))


def green_board():
    before = start()
    box('board aluminium frame', (0, 1.55, 0), (4.1, 1.2, .05), steel, .015)
    box('green board', (0, 1.55, .028), (3.98, 1.1, .012), chalk, 0)
    box('chalk tray', (0, .97, .07), (4.0, .03, .1), steel, .008)
    board_stand(4.1, (-2.02, 2.02))
    model('board-green', before, (4.1, .34))


def glass_cabinet():
    before = start()
    box('cabinet base', (0, .45, 0), (1.2, .9, .45), white, .02)
    box('cabinet base door seam', (0, .45, .227), (.01, .82, .006), trim, 0)
    for x in (-.08, .08):
        box('cabinet handle', (x, .7, .235), (.02, .12, .02), steel, .005)
    box('cabinet upper back', (0, 1.43, -.2), (1.16, 1.02, .03), white, .01)
    for x in (-.59, .59):
        box('cabinet upper side', (x, 1.43, 0), (.03, 1.06, .45), white, .01)
    box('cabinet top', (0, 1.97, 0), (1.22, .05, .47), white, .01)
    for y in (1.25, 1.6):
        box('cabinet glass shelf', (0, y, -.02), (1.14, .015, .38), clear_glass, 0)
    for i, x in enumerate((-.38, -.08, .25)):
        box('cabinet sample box', (x, 1.02, -.02), (.24, .18, .3), [yellow, sky, white][i], .01)
        box('cabinet sample jar', (x + .05, 1.35, -.02), (.12, .18, .12), [mint, peach, lavender][i], .02)
    box('cabinet glass door', (0, 1.43, .21), (1.14, 1.02, .015), clear_glass, 0)
    box('cabinet door mullion', (0, 1.43, .222), (.025, 1.02, .02), white, 0)
    model('glass-cabinet', before, (1.22, .47))


def printer(x, y, z):
    box('3d printer frame', (x, y + .24, z), (.5, .48, .46), grey_seat, .025)
    box('3d printer dark window', (x, y + .27, z + .231), (.38, .3, .005), screen, 0)
    box('3d printer build plate', (x, y + .14, z + .02), (.34, .02, .3), black, .005)
    box('3d printer touch screen', (x + .12, y + .07, z + .235), (.1, .06, .008), sky, .003)


def printer_cabinet():
    before = start()
    for x in (-.55, .55):
        for z in (-.24, .24):
            cylinder('cabinet caster', (x, .035, z), .035, .03, black, 8)
    box('cabinet open base frame', (0, .09, 0), (1.3, .05, .62), white, .015)
    for x in (-.635, .635):
        box('cabinet base side', (x, .33, 0), (.03, .48, .62), white, .01)
    box('cabinet base back', (0, .33, -.295), (1.24, .48, .03), white, .01)
    for x in (-.35, 0):
        box('yellow basket', (x, .2, .03), (.32, .17, .44), yellow, .02)
    box('filament carton', (.38, .23, 0), (.36, .24, .4), maple, .01)
    # Upper blue cabinet; interior stays white so the printers read through the glass.
    box('cabinet floor', (0, .575, 0), (1.3, .05, .62), white, .015)
    for x in (-.635, .635):
        box('cabinet blue side', (x, 1.25, 0), (.03, 1.32, .62), royal, .01)
    box('cabinet blue top', (0, 1.925, 0), (1.3, .05, .62), royal, .012)
    box('cabinet white back', (0, 1.25, -.295), (1.24, 1.32, .03), white, .01)
    box('cabinet middle shelf', (0, 1.17, -.02), (1.24, .025, .54), white, .005)
    printer(-.3, .6, -.03)
    printer(.3, .6, -.03)
    for i, x in enumerate((-.4, -.15, .15, .4)):
        cylinder('filament spool', (x, 1.27, -.04), .09, .07, black, 12)
        cylinder('filament wind', (x, 1.27, -.04), .07, .072, [balloon_colors[2], orange, white, mint][i], 12)
    for side, hinge in (('l', -.635), ('r', .635)):
        door_before = start()
        sign = 1 if side == 'l' else -1
        cx = hinge + sign * .3175
        for x in (hinge + sign * .02, hinge + sign * .615):
            box('door blue stile', (x, 1.25, .325), (.04, 1.32, .03), royal, .008)
        for y in (.61, 1.89):
            box('door blue rail', (cx, y, .325), (.635, .04, .03), royal, .008)
        box('door clear glass', (cx, 1.25, .325), (.56, 1.24, .01), clear_glass, 0)
        box('door bar handle', (hinge + sign * .56, 1.38, .36), (.025, .3, .025), steel, .008)
        box('door key lock', (hinge + sign * .56, 1.16, .345), (.025, .04, .015), steel, .004)
        door = pivot(f'printer-cabinet-door-{side}', (hinge, 0, .31))
        attach([obj for obj in set(bpy.context.scene.objects) - door_before if obj is not door], door)
    model('printer-cabinet', before, (1.3, .7))


def incubator_counter():
    before = start()
    table_top((0, .765, 0), (2.0, .04, .7), white)
    box('counter front panel', (0, .42, .3), (1.94, .64, .03), white, .01)
    for x in (-.97, .97):
        box('counter side panel', (x, .37, 0), (.04, .74, .66), white, .01)
    model('incubator-counter', before, (2.02, .72))


def germ_incubator(name, w, d, h, body, base_mat, window):
    before = start()
    box('incubator base band', (0, .04, 0), (w, .08, d), base_mat, .015)
    box('incubator left wall', (-w / 2 + .02, h / 2, 0), (.04, h, d), body, .01)
    box('incubator right wall', (w / 2 - .02, h / 2, 0), (.04, h, d), body, .01)
    box('incubator roof', (0, h - .02, 0), (w, .04, d), body, .01)
    box('incubator back', (0, h / 2, -d / 2 + .02), (w, h, .04), body, .01)
    box('incubator floor', (0, .1, 0), (w - .06, .04, d - .04), white, .005)
    box('incubator inner glow', (0, h / 2 + .03, -d / 2 + .045), (w - .1, h - .2, .01), mint, 0)
    box('incubator wire shelf', (0, .32, -.02), (w - .08, .01, d - .1), steel, 0)
    if name.endswith('-b'):
        box('incubator control band', (0, .07, d / 2 - .01), (w, .14, .04), grey_seat, .01)
        box('incubator display', (.08, .08, d / 2 + .012), (.12, .045, .01), black, .003)
        cylinder('incubator knob', (-.12, .08, d / 2 + .02), .02, .02, black, 8)
    door_before = start()
    z = d / 2 + .015
    y0 = .16 if name.endswith('-b') else .1
    dh = h - y0 - .02
    box('incubator door', (0, y0 + dh / 2, z), (w - .02, dh, .03), body, .012)
    if window:
        box('incubator door window', (.03, y0 + dh * .62, z + .017), (.13, .12, .005), screen, 0)
        tri = cylinder('biohazard sticker', (-.12, y0 + dh * .62, z + .02), .055, .004, biohazard, 3)
        turn(tri, pitch=math.pi / 2, roll=-math.pi / 2)
    else:
        sphere('incubator oval display', (0, y0 + dh * .72, z + .015), .07, teal, (1, .42, .08), 12, 6)
        box('incubator teal edge', (w / 2 - .03, y0 + dh / 2, z + .016), (.025, dh, .005), teal, 0)
    box('incubator handle', (w / 2 - .06, y0 + dh / 2, z + .03), (.025, .16, .03), steel, .008)
    door = pivot(name + '-door', (-w / 2 + .01, 0, z))
    attach([obj for obj in set(bpy.context.scene.objects) - door_before if obj is not door], door)
    model(name, before, (w, d + .06))


def clean_bench():
    before = start()
    box('clean bench base', (0, .38, 0), (1.3, .76, .75), grey_seat, .02)
    for i in range(7):
        box('clean bench vent slot', (-.42 + i * .14, .4, .378), (.05, .5, .006), black, 0)
    box('clean bench steel work surface', (0, .79, .03), (1.22, .04, .66), steel, .01)
    for x in (-.635, .635):
        box('clean bench side panel', (x, 1.15, 0), (.04, .8, .75), white, .01)
    box('clean bench back panel', (0, 1.15, -.355), (1.26, .8, .04), white, .01)
    box('clean bench glass sash', (0, 1.18, .33), (1.22, .52, .012), clear_glass, 0)
    box('clean bench sash rail', (0, .93, .34), (1.22, .03, .03), grey_seat, .005)
    box('clean bench header', (0, 1.72, .02), (1.3, .38, .71), white, .02)
    box('clean bench label band', (0, 1.6, .37), (1.2, .1, .01), grey_seat, 0)
    box('clean bench control glass', (0, 1.78, .37), (1.2, .14, .01), screen, 0)
    for i in range(6):
        box('clean bench button', (-.1 + i * .05, 1.78, .378), (.03, .03, .006), white, 0)
    box('clean bench status light', (-.22, 1.81, .378), (.12, .025, .006), mint, 0)
    model('clean-bench', before, (1.31, .76))


def microscope(x, y, z):
    box('microscope base', (x, y + .025, z), (.14, .05, .2), white, .015)
    beam('microscope arm', (x, y + .05, z - .07), (x, y + .27, z - .03), .025, white, 6)
    box('microscope stage', (x, y + .14, z + .02), (.12, .015, .11), black, .004)
    box('microscope head', (x, y + .28, z), (.08, .07, .12), white, .015)
    beam('microscope eyepiece', (x, y + .3, z - .02), (x, y + .36, z - .06), .014, black, 6)
    beam('microscope objective', (x, y + .25, z + .02), (x, y + .19, z + .03), .012, black, 6)


def microscope_cabinet():
    before = start()
    box('microscope cabinet top', (0, 1.9, 0), (.8, .1, .6), white, .015)
    box('microscope cabinet floor', (0, .04, 0), (.8, .08, .6), white, .015)
    for x in (-.38, .38):
        box('microscope cabinet side', (x, .97, 0), (.04, 1.86, .6), white, .01)
    box('microscope cabinet back', (0, .97, -.28), (.76, 1.86, .04), grey_seat, .01)
    for y in (.08, .52, .96, 1.4):
        box('microscope shelf', (0, y, -.02), (.72, .02, .52), steel, .004)
        for x in (-.17, .17):
            microscope(x, y + .01, -.02)
    box('microscope cabinet glass door', (0, .97, .29), (.72, 1.78, .012), clear_glass, 0)
    box('microscope cabinet display', (0, 1.9, .302), (.2, .05, .005), screen, 0)
    model('microscope-cabinet', before, (.8, .61))


def incubator():
    before = start()
    box('incubator cabinet', (0, .33, 0), (.55, .66, .5), cream, .02)
    box('incubator front door', (-.02, .4, .26), (.5, .48, .025), cream, .012)
    box('incubator handle', (.18, .44, .285), (.03, .16, .03), steel, .01)
    box('incubator control panel', (0, .08, .255), (.5, .12, .012), white, .004)
    cylinder('incubator dial', (-.1, .08, .265), .022, .02, black, 10)
    for x in (.02, .07):
        box('incubator switch', (x, .08, .265), (.025, .03, .01), maroon, .003)
    tri = cylinder('biohazard sticker', (-.12, .55, .275), .055, .004, biohazard, 3)
    turn(tri, pitch=math.pi / 2, roll=-math.pi / 2)
    model('incubator', before, (.55, .53))


def side_counter(name='side-counter', top=granite, sink=False, width=2.4):
    before = start()
    h = .9 if sink else .8
    box('counter cabinets', (0, h / 2 - .02, 0), (width, h - .04, .6), white, .015)
    box('counter toe kick', (0, .04, .02), (width - .04, .08, .56), trim, .005)
    doors = round(width / .6)
    for i in range(1, doors):
        box('counter door seam', (-width / 2 + i * width / doors, h / 2, .301), (.008, h - .2, .006), trim, 0)
    for i in range(doors):
        box('counter handle', (-width / 2 + (i + .5) * width / doors, h - .16, .31), (.12, .015, .015), steel, .004)
    box('counter top', (0, h - .015, .01), (width + .02, .04, .64), top, .01)
    if sink:
        box('sink basin', (-.35, h - .02, .02), (.7, .045, .44), steel, .01)
        beam('faucet riser', (-.35, h, -.24), (-.35, h + .32, -.24), .018, steel, 6)
        beam('faucet spout', (-.35, h + .32, -.24), (-.35, h + .28, -.04), .016, steel, 6)
    model(name, before, (width + .02, .64))


def cubby_shelf():
    before = start()
    box('cubby back', (0, .55, -.18), (1.6, 1.1, .03), maple, .005)
    for x in (-.785, -.39, 0, .39, .785):
        box('cubby divider', (x, .55, 0), (.03, 1.1, .4), maple, .005)
    for y in (.015, .37, .73, 1.085):
        box('cubby board', (0, y, 0), (1.6, .03, .4), maple, .005)
    for row, y in enumerate((.03, .39, .75)):
        for col, x in enumerate((-.59, -.195, .195, .59)):
            box('white basket', (x, y + .09, .03), (.33, .17, .3), white, .02)
            box('basket label', (x, y + .14, .182), (.16, .03, .004), yellow, 0)
    model('cubby-shelf', before, (1.6, .4))


def basket_shelf():
    before = start()
    for x in (-.79, .79):
        box('basket shelf side', (x, .45, 0), (.03, .9, .45), white, .005)
    box('basket shelf top', (0, .89, 0), (1.6, .03, .45), white, .005)
    box('basket shelf back', (0, .45, -.21), (1.56, .9, .02), white, .005)
    for row in range(4):
        for col in range(3):
            box('yellow basket', (-.52 + col * .52, .12 + row * .2, .02), (.46, .16, .38), yellow, .02)
    model('basket-shelf', before, (1.61, .45))


def fume_hood():
    before = start()
    box('fume hood base cabinet', (0, .42, 0), (1.5, .84, .8), white, .015)
    for x in (-.37, .37):
        box('fume hood door', (x, .42, .402), (.68, .72, .01), grey_seat, .005)
        box('fume hood handle', (x + (.27 if x < 0 else -.27), .6, .41), (.02, .14, .02), steel, .004)
    box('fume hood worktop', (0, .865, .02), (1.5, .05, .78), granite, .01)
    for x in (-.72, .72):
        box('fume hood side', (x, 1.5, 0), (.06, 1.25, .8), white, .01)
    box('fume hood back', (0, 1.5, -.37), (1.4, 1.25, .06), white, .01)
    box('fume hood sash', (0, 1.33, .35), (1.36, .66, .015), clear_glass, 0)
    box('fume hood sash rail', (0, 1.0, .36), (1.38, .04, .03), grey_seat, .005)
    box('fume hood header', (0, 2.0, .02), (1.5, .4, .78), white, .015)
    box('fume hood blue band', (0, 1.88, .412), (1.4, .1, .01), grey_seat, 0)
    for i in range(3):
        cylinder('fume hood knob', (-.2 + i * .2, 1.88, .42), .025, .02, black, 8)
    model('fume-hood', before, (1.5, .81))


# ---------------------------------------------------------------- general rooms
def seminar_set():
    before = start()
    table_top((0, .725, -.25), (1.5, .03, .5), white)
    for x in (-.68, .68):
        beam('folding table leg', (x, .04, -.25), (x, .7, -.25), .02, white, 6)
        box('folding table foot', (x, .04, -.25), (.05, .04, .46), white, .01)
        cylinder('folding table caster', (x, .02, -.45), .02, .02, black, 6)
    box('folding table modesty panel', (0, .5, -.47), (1.36, .3, .015), white, .005)
    for x in (-.38, .38):
        chair(x, .29, '-z', navy)
    model('seminar-set', before, (1.52, 1.0))


def conference_set():
    before = start()
    table_top((0, .745, 0), (2.4, .05, 1.0), walnut, black)
    for x in (-1.15, 1.15):
        box('conference table frame leg', (x, .36, 0), (.05, .72, .9), black, .01)
    box('conference table cable tray', (0, .65, 0), (2.2, .05, .1), black, .005)
    for x in (-.75, 0, .75):
        office_chair(x, .78, '-z')
        office_chair(x, -.78, '+z')
    model('conference-set', before, (2.4, 2.03))


def wall_desk():
    before = start()
    table_top((0, .745, -.3), (2.4, .04, .6), walnut, black)
    for x in (-1.17, 1.17):
        box('desk frame leg', (x, .36, -.3), (.04, .72, .55), black, .005)
    for x in (-.8, 0, .8):
        office_chair(x, .3, '-z')
    model('wall-desk', before, (2.4, 1.15))


def whiteboard_stand():
    before = start()
    box('whiteboard frame', (0, 1.4, 0), (1.3, .95, .04), steel, .01)
    box('whiteboard face', (0, 1.4, .022), (1.24, .89, .005), snow, 0)
    for x in (-.6, .6):
        beam('whiteboard leg', (x, .08, 0), (x, 1.88, 0), .02, black, 6)
        box('whiteboard foot', (x, .05, 0), (.06, .04, .55), black, .01)
        cylinder('whiteboard caster', (x, .025, .24), .025, .02, black, 6)
        cylinder('whiteboard caster', (x, .025, -.24), .025, .02, black, 6)
    model('whiteboard-stand', before, (1.3, .55))


def bookcase():
    before = start()
    for x in (-.49, .49):
        box('bookcase side', (x, .9, 0), (.03, 1.8, .35), maple, .005)
    box('bookcase back', (0, .9, -.16), (.96, 1.8, .02), white, .005)
    for y in (.02, .45, .9, 1.35, 1.785):
        box('bookcase board', (0, y, 0), (.98, .03, .35), maple, .005)
    for y in (.035, .465, .915, 1.365):
        shelf_books(-.46, .46, y, .02)
    model('bookcase', before, (1.01, .35))


def display_stand():
    before = start()
    box('display stand foot', (0, .03, 0), (.9, .06, .55), black, .015)
    beam('display stand column', (0, .06, -.05), (0, 1.3, -.05), .05, white, 8)
    box('display panel back', (0, 1.42, 0), (1.66, .97, .06), black, .02)
    box('display panel screen', (0, 1.43, .032), (1.58, .89, .005), screen, 0)
    model('display-stand', before, (1.66, .55))


def lectern():
    before = start()
    box('lectern body', (0, .52, 0), (.62, 1.04, .45), walnut, .02)
    box('lectern front inlay', (0, .55, .227), (.48, .8, .01), maple, .005)
    top = box('lectern slanted top', (0, 1.08, -.02), (.66, .05, .52), walnut, .015)
    turn(top, pitch=-.18)
    model('lectern', before, (.66, .53))


# ---------------------------------------------------------------- fitness room
def gym_mat():
    before = start()
    box('rubber floor mat', (0, .01, 0), (7.6, .02, 8.6), rubber, 0)
    model('gym-mat', before, (7.6, 8.6))


def power_rack():
    before = start()
    box('rack platform', (0, .025, 0), (1.3, .05, 1.3), black, .01)
    for x in (-.55, .55):
        for z in (-.5, .5):
            box('rack red upright', (x, 1.12, z), (.07, 2.14, .07), red, .01)
        box('rack top rail', (x, 2.2, 0), (.07, .07, 1.07), red, .01)
    for z in (-.5, .5):
        box('rack cross bar', (0, 2.2, z), (1.17, .07, .07), red, .01)
    # The loaded bar hangs from its own pivot so a squatting visitor can carry it.
    bar_before = start()
    beam('rack barbell', (-.85, 1.3, .5), (.85, 1.3, .5), .018, steel, 8)
    for x in (-.72, .72):
        turn(cylinder('rack plate', (x, 1.3, .5), .2, .05, black, 16), roll=math.pi / 2)
    bar = pivot('power-rack-bar', (0, 1.3, .5))
    attach([obj for obj in set(bpy.context.scene.objects) - bar_before if obj is not bar], bar)
    model('power-rack', before, (1.7, 1.3))


def treadmill():
    before = start()
    box('treadmill deck', (0, .14, .1), (.8, .2, 1.7), grey_seat, .03)
    box('treadmill belt', (0, .245, .14), (.56, .02, 1.5), black, .005)
    for x in (-.36, .36):
        beam('treadmill upright', (x, .2, -.65), (x, 1.15, -.78), .03, grey_seat, 6)
        beam('treadmill handrail', (x, 1.0, -.74), (x, 1.0, -.38), .022, black, 6)
    console = box('treadmill console', (0, 1.22, -.8), (.8, .1, .28), black, .03)
    turn(console, pitch=.45)
    box('treadmill console screen', (0, 1.26, -.73), (.34, .012, .12), sky, 0)
    model('treadmill', before, (.82, 1.87))


def weight_bench():
    before = start()
    box('bench pad', (0, .44, 0), (.3, .08, 1.3), black, .03)
    for z in (-.55, .55):
        box('bench frame foot', (0, .03, z), (.56, .06, .08), grey_seat, .01)
        beam('bench frame post', (0, .06, z), (0, .4, z * .9), .03, grey_seat, 6)
    beam('bench spine', (0, .38, -.52), (0, .38, .52), .03, grey_seat, 6)
    model('weight-bench', before, (.56, 1.34))


def dumbbell_rack():
    before = start()
    for x in (-.7, .7):
        box('dumbbell rack end frame', (x, .42, 0), (.06, .84, .55), grey_seat, .01)
    for y, z in ((.45, .12), (.8, -.1)):
        box('dumbbell rack rail', (0, y, z), (1.44, .04, .2), grey_seat, .01)
        for i in range(5):
            x = -.52 + i * .26
            for dx in (-.07, .07):
                c = cylinder('dumbbell head', (x + dx, y + .07, z), .055, .05, black, 10)
                turn(c, roll=math.pi / 2)
            beam('dumbbell handle', (x - .05, y + .07, z), (x + .05, y + .07, z), .014, steel, 6)
    model('dumbbell-rack', before, (1.46, .55))


def cable_machine():
    before = start()
    box('cable machine base', (0, .04, 0), (1.2, .08, 1.0), grey_seat, .01)
    for x in (-.52, .52):
        box('cable machine upright', (x, 1.05, -.38), (.08, 2.0, .08), grey_seat, .01)
    box('cable machine top beam', (0, 2.05, -.38), (1.12, .08, .1), grey_seat, .01)
    box('cable machine weight stack', (0, .55, -.38), (.32, .9, .14), black, .01)
    box('cable machine stack shroud', (0, 1.05, -.31), (.4, 1.9, .02), screen, 0)
    box('cable machine seat', (0, .5, .22), (.42, .08, .4), black, .03)
    box('cable machine back pad', (0, .85, -.06), (.4, .55, .07), black, .03)
    beam('cable machine seat post', (0, .08, .22), (0, .46, .22), .035, grey_seat, 6)
    beam('cable machine lat bar', (-.45, 1.85, .2), (.45, 1.85, .2), .016, steel, 6)
    beam('cable machine cable', (0, 2.0, -.3), (0, 1.86, .2), .006, black, 4)
    model('cable-machine', before, (1.2, 1.0))


# ---------------------------------------------------------------- third and fourth floor rooms
def computer_set():
    before = start()
    table_top((0, .745, -.3), (1.5, .04, .6), maple)
    box('computer desk modesty panel', (0, .42, -.58), (1.44, .6, .025), maple, .005)
    for x in (-.73, .73):
        box('computer desk side', (x, .37, -.3), (.04, .74, .58), maple, .005)
    for x in (-.37, .37):
        box('monitor back', (x, 1.02, -.4), (.5, .32, .03), black, .01)
        box('monitor screen', (x, 1.02, -.383), (.46, .28, .005), screen, 0)
        beam('monitor stand', (x, .77, -.43), (x, .88, -.42), .018, black, 6)
        box('monitor foot', (x, .775, -.43), (.18, .015, .14), black, .004)
        box('keyboard', (x, .775, -.18), (.4, .015, .13), black, .004)
        box('computer tower', (x + (.2 if x < 0 else -.2), .23, -.36), (.18, .4, .36), black, .01)
        chair(x, .38, '-z', royal, royal)
    model('computer-set', before, (1.5, 1.19))


def hex_table_set():
    before = start()
    cylinder('hex table top', (0, .74, 0), .78, .04, maple, 6)
    cylinder('hex table edge', (0, .71, 0), .79, .025, trim, 6)
    for i in range(3):
        a = i * math.tau / 3 + .5
        beam('hex table leg', (math.cos(a) * .45, 0, math.sin(a) * .45), (math.cos(a) * .45, .7, math.sin(a) * .45), .022, steel, 6)
    for i, (x, z, face) in enumerate(((0, .86, '-z'), (0, -.86, '+z'), (.86, 0, '-x'), (-.86, 0, '+x'))):
        chair(x, z, face, black, black)
    model('hex-table-set', before, (2.13, 2.13))


def storage_wall():
    before = start()
    box('storage lower cabinets', (0, .45, 0), (2.4, .9, .5), white, .015)
    for i in range(1, 4):
        box('storage door seam', (-1.2 + i * .6, .45, .251), (.008, .78, .006), trim, 0)
    for i in range(4):
        box('storage handle', (-1.2 + (i + .5) * .6, .62, .262), (.02, .16, .02), steel, .004)
    colors = [peach, mint, sky, lavender]
    for i in range(4):
        x = -.9 + i * .6
        box('storage cubby frame', (x, 1.28, 0), (.6, .76, .48), white, .01)
        box('storage cubby pastel back', (x, 1.28, -.05), (.52, .68, .4), colors[i], .01)
    box('storage cubby bins', (-.9, 1.06, .1), (.3, .2, .22), lavender, .01)
    shelf_books(.5, 1.1, .95, .05, .25)
    box('storage upper cabinets', (0, 1.85, 0), (2.4, .38, .5), white, .015)
    model('storage-wall', before, (2.4, .5))


def art_set():
    before = start()
    table_top((0, .745, 0), (1.8, .03, .9), screen, black)
    for x in (-.82, .82):
        for z in (-.38, .38):
            beam('art table leg', (x, 0, z), (x, .72, z), .02, black, 6)
    for x in (-.45, .45):
        chair(x, .72, '-z', grey_seat, grey_seat)
        chair(x, -.72, '+z', grey_seat, grey_seat)
    box('art palette', (-.3, .77, .1), (.3, .015, .22), snow, .005)
    for i, mat in enumerate((balloon_colors[0], balloon_colors[2], balloon_colors[1])):
        cylinder('paint dab', (-.38 + i * .08, .78, .12), .025, .006, mat, 8)
    model('art-set', before, (1.82, 1.86))


def open_shelf():
    before = start()
    for x in (-.985, -.33, .33, .985):
        box('open shelf side', (x, .9, 0), (.03, 1.8, .4), white, .005)
    for y in (.02, .46, .9, 1.34, 1.785):
        box('open shelf board', (0, y, 0), (2.0, .03, .4), white, .005)
    items = [peach, sky, balloon_colors[0], mint, yellow, lavender, maple, balloon_colors[5]]
    for row, y in enumerate((.035, .475, .915, 1.355)):
        for col, x in enumerate((-.66, 0, .66)):
            mat = items[(row * 3 + col) % len(items)]
            if (row + col) % 2:
                box('art supply box', (x, y + .1, .02), (.4, .2, .3), mat, .015)
            else:
                for i in range(3):
                    cylinder('art supply jar', (x - .15 + i * .15, y + .08, .03), .05, .16, mat, 8)
    model('open-shelf', before, (2.0, .4))


def easel():
    before = start()
    for x in (-.28, .28):
        beam('easel leg', (x * 1.1, 0, .12), (x * .4, 1.65, 0), .02, maple, 6)
    beam('easel back leg', (0, 0, -.42), (0, 1.5, -.05), .02, maple, 6)
    box('easel ledge', (0, .8, .1), (.62, .03, .08), maple, .005)
    box('easel canvas', (0, 1.13, .11), (.56, .62, .03), snow, .005)
    for i, mat in enumerate((sky, sofa_green, balloon_colors[1])):
        box('easel painting stroke', (0, .95 + i * .17, .128), (.46, .1, .005), mat, 0)
    model('easel', before, (.66, .58))


def student_set():
    before = start()
    table_top((0, .725, -.17), (.65, .03, .5), white, navy)
    box('student desk body', (0, .6, -.2), (.6, .16, .42), navy, .015)
    for x in (-.29, .29):
        beam('student desk leg', (x, 0, -.2), (x, .55, -.2), .018, steel, 6)
        box('student desk foot', (x, .02, -.2), (.04, .04, .44), steel, .005)
    chair(0, .25, '-z', navy, navy)
    model('student-set', before, (.67, .94))


def lounge_set():
    before = start()
    table_top((0, .725, -.27), (1.8, .03, .6), maple)
    for x in (-.85, .85):
        beam('lounge table leg', (x, 0, -.27), (x, .7, -.27), .02, steel, 6)
        box('lounge table foot', (x, .02, -.27), (.05, .04, .5), steel, .005)
    for x in (-.55, 0, .55):
        chair(x, .32, '-z', navy, navy)
    model('lounge-set', before, (1.82, 1.1))


def wall_bench():
    before = start()
    box('wall bench white base', (0, .2, 0), (3.0, .4, .5), white, .015)
    box('wall bench blue cushion', (0, .44, .02), (2.96, .08, .46), light_blue, .03)
    box('wall bench back cushion', (0, .75, -.22), (2.96, .5, .06), light_blue, .03)
    for x in (-1, 0, 1):
        seat(x, .48, .05, '+z')
    model('wall-bench-blue', before, (3.0, .5))


def wide_stage():
    before = start()
    box('wide stage platform', (0, .11, 0), (7.9, .22, 2.4), maple, .02)
    box('wide stage nosing', (0, .11, 1.2), (7.9, .22, .03), walnut, .005)
    model('stage-wide', before, (7.9, 2.42))


def stage():
    before = start()
    box('low stage platform', (0, .1, 0), (3.6, .2, 1.6), maple, .02)
    box('stage front nosing', (0, .1, .8), (3.6, .2, .03), walnut, .005)
    box('stage step', (1.2, .05, .95), (.9, .1, .3), maple, .015)
    model('stage', before, (3.6, 1.86))


# ---------------------------------------------------------------- festival decorations
def welcome_banner():
    before = start()
    for x in (-1.85, 1.85):
        box('banner pole foot', (x, .03, 0), (.4, .06, .4), snow, .02)
        beam('banner pole', (x, .06, 0), (x, 2.42, 0), .03, gold, 8)
        sphere('banner pole finial', (x, 2.45, 0), .05, gold, (1, 1, 1), 8, 5)
    box('banner panel', (0, 1.8, 0), (3.6, 1.1, .03), snow, .01)
    box('banner gold edge', (0, 2.37, 0), (3.66, .04, .05), gold, .01)
    box('banner gold edge', (0, 1.23, 0), (3.66, .04, .05), gold, .01)
    for i in range(12):
        x = -1.65 + i * .3
        flag = cylinder('bunting flag', (x, 1.18, .03), .13, .004, balloon_colors[i % 6], 3)
        turn(flag, pitch=math.pi / 2, roll=math.pi / 2)
    for side in (-1, 1):
        for i, (dx, dy) in enumerate(((0, 2.75), (.22, 2.62), (-.2, 2.6))):
            balloon(side * 1.85 + dx, dy, (i - 1) * .06, balloon_colors[(i + (side > 0) * 3) % 6], .16)
            beam('balloon string', (side * 1.85 + dx, dy - .2, (i - 1) * .06), (side * 1.85, 2.42, 0), .004, snow, 3)
    pivot('welcome-banner-face', (0, 1.8, .02))
    model('welcome-banner', before, (4.46, .44))


def balloon_arch():
    before = start()
    for x in (-1.6, 1.6):
        box('arch weight', (x, .08, 0), (.3, .16, .3), snow, .03)
    n = 26
    for i in range(n + 1):
        t = math.pi * i / n
        x, y = 1.6 * math.cos(t), .2 + 2.6 * math.sin(t)
        for k, dz in enumerate((-.1, .1)):
            balloon(x + (k - .5) * .08, y, dz, balloon_colors[(i * 2 + k) % 6], .14)
    model('balloon-arch', before, (3.54, .47))


def balloon_cluster():
    before = start()
    box('balloon weight', (0, .07, 0), (.22, .14, .22), gold, .04)
    spots = [(0, 2.05, 0), (.2, 1.85, .08), (-.2, 1.88, -.06), (.08, 1.68, -.18), (-.1, 1.7, .2)]
    for i, (x, y, z) in enumerate(spots):
        balloon(x, y, z, balloon_colors[i], .16)
        beam('balloon string', (x, y - .2, z), (0, .14, 0), .004, snow, 3)
    model('balloon-cluster', before, (.72, .74))


def balloon_column():
    before = start()
    box('column weight', (0, .06, 0), (.4, .12, .4), snow, .03)
    beam('column pole', (0, .1, 0), (0, 1.9, 0), .015, snow, 6)
    for level in range(7):
        for k in range(4):
            a = k * math.pi / 2 + level * .4
            balloon(math.cos(a) * .13, .32 + level * .24, math.sin(a) * .13, balloon_colors[(level + k) % 6], .12)
    sphere('column topper star', (0, 2.12, 0), .17, gold, (1, 1, .5), 5, 4)
    model('balloon-column', before, (.52, .52))


def arcade(name, body, accent):
    before = start()
    box('arcade body', (0, .62, -.06), (.78, 1.24, .6), body, .04)
    box('arcade side trim', (-.4, .9, -.06), (.03, 1.8, .62), accent, .01)
    box('arcade side trim', (.4, .9, -.06), (.03, 1.8, .62), accent, .01)
    box('arcade upper body', (0, 1.5, -.18), (.78, .66, .36), body, .03)
    box('arcade screen bezel', (0, 1.42, .015), (.66, .5, .03), black, .02)
    box('arcade marquee box', (0, 1.88, -.1), (.78, .2, .5), accent, .03)
    box('arcade control deck', (0, 1.0, .18), (.74, .08, .3), snow, .02)
    beam('arcade joystick', (-.17, 1.04, .2), (-.17, 1.13, .2), .012, black, 6)
    sphere('arcade joystick ball', (-.17, 1.14, .2), .03, balloon_colors[0], (1, 1, 1), 8, 5)
    for i, x in enumerate((.05, .15, .25)):
        cylinder('arcade button', (x, 1.05, .2 + (i % 2) * .05), .03, .03, balloon_colors[(i + 1) % 6], 10)
    box('arcade coin door', (0, .5, .245), (.24, .3, .02), black, .01)
    box('arcade kick plate', (0, .06, .1), (.74, .12, .4), accent, .01)
    for marker, p in (('screen', (0, 1.42, .035)), ('marquee', (0, 1.88, .155))):
        pivot(f'{name}-{marker}', p)
    model(name, before, (.81, .71))


# ---------------------------------------------------------------- homerooms and staff rooms
def staff_desk():
    """One teacher's workstation; two face each other back to back in the staff rooms."""
    before = start()
    table_top((0, .745, -.27), (1.4, .04, .7), white)
    box('staff desk pedestal', (.42, .37, -.27), (.42, .7, .62), white, .015)
    for i, y in enumerate((.2, .43, .62)):
        box('staff drawer handle', (.42, y, .05), (.14, .015, .015), steel, .004)
    beam('staff desk leg', (-.66, 0, -.55), (-.66, .72, -.55), .02, steel, 6)
    beam('staff desk leg', (-.66, 0, .03), (-.66, .72, .03), .02, steel, 6)
    box('staff desk partition', (0, .95, -.6), (1.4, .38, .03), grey_seat, .01)
    box('monitor back', (-.12, 1.03, -.44), (.54, .33, .03), black, .01)
    box('monitor screen', (-.12, 1.03, -.423), (.5, .29, .005), screen, 0)
    beam('monitor stand', (-.12, .77, -.47), (-.12, .88, -.46), .018, black, 6)
    box('monitor foot', (-.12, .775, -.47), (.18, .015, .14), black, .004)
    box('keyboard', (-.12, .775, -.17), (.42, .015, .13), black, .004)
    box('document tray', (.42, .8, -.42), (.3, .07, .24), sky, .01)
    office_chair(-.05, .38, '-z')
    model('staff-desk', before, (1.42, 1.25))


def office_cabinet():
    before = start()
    box('office cabinet body', (0, .9, 0), (.9, 1.8, .45), white, .015)
    box('office cabinet top', (0, 1.81, 0), (.92, .03, .47), grey_seat, .008)
    box('office cabinet door seam', (0, .95, .226), (.008, 1.65, .006), trim, 0)
    box('office cabinet shelf seam', (0, .62, .226), (.86, .008, .006), trim, 0)
    for x in (-.06, .06):
        box('office cabinet handle', (x, 1.05, .235), (.02, .16, .02), steel, .004)
    model('office-cabinet', before, (.92, .47))


def locker_wall():
    before = start()
    box('locker carcass', (0, .55, 0), (2.4, 1.1, .45), maple, .015)
    for row in range(3):
        for col in range(6):
            x, y = -1.0 + col * .4, .2 + row * .35
            box('locker door', (x, y, .228), (.37, .32, .012), white, .006)
            box('locker number plate', (x - .1, y + .1, .236), (.08, .04, .004), sky, 0)
            box('locker knob', (x + .12, y, .238), (.03, .05, .02), steel, .004)
    model('locker-wall', before, (2.4, .47))


# ---------------------------------------------------------------- study zone and corridors
def oval_table_set():
    before = start()
    cylinder('oval table top', (0, .74, 0), .8, .04, white, 24, (1, .55))
    for x, z in ((-.5, -.25), (.5, -.25), (-.5, .25), (.5, .25)):
        beam('oval table splayed leg', (x * 1.2, 0, z * 1.3), (x * .8, .72, z * .8), .025, coral_leg, 6)
    for x in (-.4, .4):
        chair(x, .66, '-z', navy, navy)
        chair(x, -.66, '+z', snow, snow)
    model('oval-table-set', before, (1.6, 1.72))


def carrel_row():
    before = start()
    for i in range(4):
        x = -1.215 + i * .81
        side = box('carrel rounded partition', (x, .65, -.22), (.03, 1.3, .62), maple, .012)
    for i in range(3):
        x = -.81 + i * .81
        box('carrel desk', (x, .73, -.25), (.78, .03, .56), maple, .005)
        box('carrel top shelf', (x, 1.15, -.42), (.78, .02, .22), maple, .004)
        box('carrel back panel', (x, .95, -.52), (.78, .5, .015), maple, .004)
        chair(x, .32, '-z', snow, snow)
    model('carrel-row', before, (2.46, 1.07))


def curved_sofa():
    before = start()
    for i in range(5):
        a = math.pi * (i + .5) / 5
        x, z = 1.0 * math.cos(a), -.45 * math.sin(a) + .2
        seat = box('curved sofa seat', (x, .22, z), (.58, .44, .55), sofa_green, .05)
        back = box('curved sofa back', (x * 1.12, .62, z - .26 * math.sin(a)), (.58, .5, .16), sofa_green, .05)
        yaw = a - math.pi / 2
        turn(seat, yaw=yaw)
        turn(back, yaw=yaw)
    cylinder('round side table', (0, .45, .28), .25, .03, white, 16)
    beam('round side table stem', (0, 0, .28), (0, .44, .28), .025, white, 8)
    model('curved-sofa', before, (2.57, 1.12))


def round_table_stools():
    before = start()
    cylinder('round table top', (0, .72, 0), .3, .03, white, 18)
    beam('round table stem', (0, .03, 0), (0, .71, 0), .03, white, 8)
    cylinder('round table base', (0, .015, 0), .2, .03, white, 14)
    for x in (-.55, .55):
        cylinder('green stool', (x, .21, 0), .19, .42, sofa_green, 14)
        seat(x, .42, 0, '+x' if x < 0 else '-x')
    model('round-table-stools', before, (1.48, .6))


def window_bench_green():
    before = start()
    box('window bench base', (0, .18, 0), (3.0, .36, .45), white, .015)
    box('window bench green cushion', (0, .41, .01), (2.96, .1, .43), sofa_green, .035)
    box('window bench back cushion', (0, .72, -.2), (2.96, .5, .06), sofa_green, .035)
    for x in (-1, 0, 1):
        seat(x, .46, .05, '+z')
    model('window-bench-green', before, (3.0, .45))


def booth():
    before = start()
    for x, s in ((-.72, -1), (.72, 1)):
        box('booth bench base', (x, .2, 0), (.45, .4, .72), white, .015)
        box('booth seat cushion', (x, .44, 0), (.45, .08, .7), light_blue, .03)
        box('booth high back', (x + s * .2, .78, 0), (.08, .62, .7), light_blue, .03)
        seat(x, .48, 0, '+x' if s < 0 else '-x')
    table_top((0, .725, 0), (.7, .04, .6), white)
    box('booth table pillar', (0, .36, 0), (.08, .7, .4), white, .01)
    model('booth', before, (1.89, .72))


def window_desk():
    before = start()
    table_top((0, .725, -.22), (1.2, .03, .5), maple)
    for x in (-.56, .56):
        box('window desk leg', (x, .36, -.22), (.04, .72, .45), grey_seat, .005)
    office_chair(0, .26, '-z', maroon)
    model('window-desk', before, (1.2, .97))


# ---------------------------------------------------------------- the incubator's surprise
def germ():
    before = start()
    sphere('germ body', (0, .21, 0), .17, germ_body, (1, .95, .9), 16, 10)
    sphere('germ belly', (0, .17, .07), .11, germ_belly, (1, 1, .55), 12, 8)
    for i in range(7):
        a = i * math.tau / 7 + .3
        sphere('germ nub', (math.cos(a) * .16, .21 + math.sin(a) * .15, -.04), .035, germ_nub, (1, 1, 1), 8, 5)
    for s in (-1, 1):
        cone('germ horn', (s * .08, .37, 0), .042, .1, horn, 8, roll=s * .45)
        sphere('germ eye', (s * .06, .25, .135), .048, eye, (1, 1.1, .7), 10, 7)
        sphere('germ pupil', (s * .055, .245, .168), .026, pupil, (1, 1.15, .6), 8, 6)
        sphere('germ eye shine', (s * .045, .262, .184), .009, eye, (1, 1, 1), 6, 4)
        sphere('germ cheek', (s * .115, .19, .125), .028, cheek, (1, .7, .4), 8, 5)
        beam('germ arm', (s * .15, .18, .02), (s * .23, .14 + (s > 0) * .1, .06), .022, germ_body, 6)
        sphere('germ foot', (s * .07, .035, .03), .045, germ_body, (1, .7, 1.3), 8, 5)
    sphere('germ grin', (0, .158, .152), .05, pupil, (1.5, .45, .3), 12, 6)
    sphere('germ tongue', (.012, .146, .162), .022, cheek, (1, .5, .4), 8, 5)
    cone('germ fang', (.035, .152, .17), .011, .025, eye, 5, pitch=math.pi)
    for s in (-1, 1):
        for k, (lift, size) in enumerate(((.0, .11), (-.06, .08))):
            wing = cylinder('germ bat wing', (s * (.2 + k * .04), .33 + lift, -.1), size, .012, germ_wing, 3)
            turn(wing, pitch=math.pi / 2, roll=-math.pi / 4 if s > 0 else -3 * math.pi / 4)
    # Pointed devil tail behind.
    beam('germ tail', (0, .12, -.14), (.08, .1, -.26), .014, germ_body, 6)
    beam('germ tail', (.08, .1, -.26), (.14, .18, -.3), .014, germ_body, 6)
    cone('germ tail tip', (.15, .21, -.3), .035, .07, germ_body, 4, roll=.6)
    # Little trident in the right hand.
    beam('trident shaft', (.24, .0, .07), (.24, .5, .07), .011, gold, 6)
    beam('trident crossbar', (.17, .44, .07), (.31, .44, .07), .011, gold, 6)
    for x in (.17, .24, .31):
        beam('trident prong', (x, .44, .07), (x, .52, .07), .009, gold, 6)
        cone('trident tip', (x, .545, .07), .02, .05, gold, 6)
    model('germ', before, (.62, .53))


# ---------------------------------------------------------------- first-floor library
stack_blue = material('library stack blue panel', (.29, .47, .64), .55)
lime = material('library lime cushion', (.66, .80, .27), .6)
cart_red = material('book cart red', (.78, .20, .17), .45)


def book_band(x0, x1, y, z, depth=.22, seed=0):
    """A shelf row as a few unbevelled book blocks; the library holds thousands of books."""
    covers = [balloon_colors[2], walnut, sofa_green, maroon, peach, navy, snow, lavender]
    count = max(2, round((x1 - x0) / .28))
    step = (x1 - x0) / count
    for i in range(count):
        h = .2 + ((i + seed) % 3) * .03
        box('book block', (x0 + (i + .5) * step, y + h / 2, z), (step - .012, h, depth), covers[(i * 3 + seed) % len(covers)], 0)


def library_stack():
    """Double-sided white steel stack; blue end panels carry the subject number plates."""
    before = start()
    for x in (-1.18, 1.18):
        box('stack blue end panel', (x, .95, 0), (.05, 1.9, .56), stack_blue, .015)
        for s in (-1, 1):
            box('stack number plate', (x + s * .028, 1.62, 0), (.008, .22, .14), white, .004)
    box('stack spine', (0, .95, 0), (2.32, 1.86, .03), white, .005)
    for y in (.06, .4, .74, 1.08, 1.42, 1.86):
        box('stack shelf', (0, y, 0), (2.32, .025, .54), white, .004)
    for y in (.075, .415, .755, 1.095, 1.435):
        for z in (-.13, .13):
            book_band(-1.12, 1.12, y, z, .22, round(y * 10) + (z > 0))
    model('library-stack', before, (2.41, .56))


def low_book_shelf():
    before = start()
    for x in (-.89, .89):
        box('low shelf side', (x, .5, 0), (.03, 1.0, .38), white, .005)
    box('low shelf back', (0, .5, -.175), (1.76, 1.0, .02), white, .005)
    for y in (.03, .5, .99):
        box('low shelf board', (0, y, 0), (1.8, .03, .38), white, .005)
    for y in (.045, .515):
        book_band(-.85, .85, y, .02, .24, round(y * 10))
    for x, mat in ((-.5, peach), (.1, sky), (.6, mint)):
        stand = box('book display stand', (x, 1.12, 0), (.2, .22, .03), mat, .006)
        turn(stand, pitch=-.25)
    model('low-book-shelf', before, (1.82, .38))


def wood_bookcase():
    """Light wood bookcase with slanted sides, as in the open library and the library walls."""
    before = start()
    for x in (-.89, .89):
        side = box('wood bookcase side', (x, .9, -.02), (.035, 1.8, .36), maple, .008)
    box('wood bookcase back', (0, .9, -.18), (1.76, 1.8, .02), maple, .005)
    for y in (.03, .46, .89, 1.32, 1.785):
        box('wood bookcase board', (0, y, -.02), (1.78, .03, .34), maple, .005)
    for y in (.045, .475, .905, 1.335):
        book_band(-.85, .85, y, -.03, .24, round(y * 10))
    model('wood-bookcase', before, (1.82, .38))


def library_table_set():
    """Two trapezoid tables (lavender and white) forming a hexagon, six chairs with green seats."""
    before = start()
    for s, mat in ((-1, lavender), (1, white)):
        top = cylinder('trapezoid table half', (0, .74, s * .19), .78, .035, mat, 6, (1, .5))
        box('trapezoid table edge', (0, .72, s * .02), (1.55, .02, .02), trim, 0)
        for x in (-.5, .5):
            beam('trapezoid table leg', (x, 0, s * .32), (x, .72, s * .32), .022, steel, 6)
    for x, z, face in ((-.55, .82, '-z'), (.55, .82, '-z'), (-.55, -.82, '+z'), (.55, -.82, '+z'), (1.05, 0, '-x'), (-1.05, 0, '+x')):
        chair(x, z, face, sofa_green, snow, steel)
    model('library-table-set', before, (2.5, 2.08))


def circulation_desk():
    """대출·반납 counter: magazine panel on the visitor side (+Z), staff side behind."""
    before = start()
    box('circulation counter body', (0, .5, 0), (2.4, 1.0, .7), white, .02)
    box('circulation counter top', (0, 1.02, .02), (2.46, .04, .76), grey_seat, .01)
    box('magazine perforated panel', (-.5, .55, .36), (1.2, .85, .02), grey_seat, .005)
    for i, mat in enumerate((peach, sky, mint, lavender)):
        box('magazine cover', (-.95 + i * .3, .72 - (i % 2) * .25, .375), (.22, .3, .01), mat, 0)
    box('circulation sign board', (0, 1.55, -.1), (.9, .28, .03), maroon, .01)
    box('circulation sign face', (0, 1.55, -.08), (.8, .2, .005), snow, 0)
    beam('circulation sign post', (0, 1.04, -.1), (0, 1.41, -.1), .015, steel, 6)
    box('circulation monitor', (.6, 1.24, -.15), (.5, .32, .03), black, .01)
    model('circulation-desk', before, (2.46, .77))


def lounge_chair():
    before = start()
    box('green lounge chair base', (0, .22, 0), (.7, .44, .68), lime, .06)
    box('green lounge chair seat', (0, .47, .04), (.6, .08, .56), grey_seat, .03)
    box('green lounge chair back', (0, .68, -.26), (.7, .5, .16), lime, .05)
    seat(0, .52, .05, '+z')
    model('lounge-chair-green', before, (.7, .68))


def book_cart():
    before = start()
    for x in (-.4, .4):
        box('book cart side', (x, .55, 0), (.04, .9, .42), cart_red, .01)
        for z in (-.16, .16):
            cylinder('book cart wheel', (x, .04, z), .04, .03, black, 8)
    for y in (.22, .6):
        shelf = box('book cart shelf', (0, y, 0), (.8, .03, .4), maple, .005)
        book_band(-.36, .36, y + .015, 0, .18)
    model('book-cart', before, (.84, .42))


def folding_glass_door():
    """Black-framed folding glass doors, folded back against the jamb of the library passage."""
    before = start()
    for i in range(4):
        z = -.3 + i * .2
        box('folding door black frame', (0, 1.1, z), (.05, 2.2, .04), black, .006)
        box('folding door glass', (0, 1.1, z + .1), (.012, 2.1, .16), clear_glass, 0)
    box('folding door head', (0, 2.22, 0), (.08, .05, .8), black, .006)
    model('folding-glass-door', before, (.08, .8))


# ---------------------------------------------------------------- offices, stores and halls
beige = material('beige upholstery', (.80, .72, .60), .7)
seat_red = material('auditorium red', (.66, .18, .22), .6)
piano_black = material('piano gloss black', (.05, .05, .06), .15)


def broadcast_console():
    """Broadcasting room desk: sloped mixer, two monitors and an operator chair (+Z)."""
    before = start()
    box('console desk', (0, .38, -.15), (1.8, .76, .7), grey_seat, .015)
    mixer = box('console mixer', (0, .82, -.12), (1.2, .08, .5), black, .01)
    turn(mixer, pitch=.25)
    for i in range(12):
        box('mixer fader', (-.5 + i * .09, .87, -.08), (.02, .01, .12), snow, 0)
    for x in (-.5, .5):
        box('console monitor', (x, 1.15, -.42), (.55, .34, .03), screen, .008)
        beam('console monitor stand', (x, .8, -.44), (x, .98, -.44), .018, black, 6)
    office_chair(0, .45, '-z')
    model('broadcast-console', before, (1.8, 1.2))


def server_rack():
    before = start()
    box('server rack cabinet', (0, 1.0, 0), (.6, 2.0, 1.0), black, .015)
    box('server rack door', (0, 1.0, .5), (.54, 1.9, .015), screen, 0)
    for i in range(8):
        box('server unit light', (-.18, .3 + i * .2, .51), (.05, .015, .006), mint if i % 3 else biohazard, 0)
    model('server-rack', before, (.6, 1.02))


def infirmary_bed():
    before = start()
    box('bed frame', (0, .3, 0), (.95, .3, 1.95), steel, .02)
    box('bed mattress', (0, .5, .02), (.9, .14, 1.88), snow, .04)
    box('bed blanket', (0, .58, .35), (.92, .04, 1.1), sky, .015)
    box('bed pillow', (0, .62, -.7), (.6, .1, .32), snow, .04)
    box('bed headboard', (0, .55, -.96), (.95, .6, .04), white, .015)
    for x in (-.42, .42):
        for z in (-.88, .88):
            beam('bed leg', (x, 0, z), (x, .16, z), .02, steel, 6)
    model('infirmary-bed', before, (.95, 2.0))


def sofa_set():
    """Two-seat sofa facing +Z across a low coffee table."""
    before = start()
    box('sofa base', (0, .22, -.35), (1.7, .44, .8), beige, .06)
    box('sofa back', (0, .62, -.68), (1.7, .5, .2), beige, .06)
    for x in (-.8, .8):
        box('sofa arm', (x, .5, -.35), (.18, .32, .8), beige, .05)
    for x in (-.38, .38):
        seat(x, .48, -.3, '+z')
    box('coffee table top', (0, .42, .55), (1.0, .04, .55), maple, .015)
    for x in (-.42, .42):
        box('coffee table leg', (x, .2, .55), (.05, .4, .45), maple, .01)
    model('sofa-set', before, (1.7, 1.6))


def workbench():
    before = start()
    box('workbench top', (0, .88, 0), (1.8, .06, .7), maple, .01)
    for x in (-.82, .82):
        box('workbench leg frame', (x, .43, 0), (.06, .86, .62), grey_seat, .008)
    box('workbench shelf', (0, .2, 0), (1.66, .03, .6), grey_seat, .005)
    box('workbench pegboard', (0, 1.45, -.33), (1.7, .9, .02), maple, .005)
    box('workbench vise', (.7, .96, .25), (.18, .1, .14), red, .01)
    for i, mat in enumerate((red, sky, biohazard)):
        box('tool case', (-.5 + i * .35, 1.0, .05), (.28, .16, .2), mat, .01)
    model('workbench', before, (1.8, .7))


def storage_rack():
    before = start()
    for x in (-.88, .88):
        for z in (-.23, .23):
            box('rack post', (x, .95, z), (.035, 1.9, .035), grey_seat, 0)
    for y in (.08, .58, 1.08, 1.58):
        box('rack shelf', (0, y, 0), (1.8, .025, .5), grey_seat, 0)
    colours = [maple, white, sky, maple, peach, white]
    for row, y in enumerate((.09, .59, 1.09)):
        for col in range(3):
            box('storage box', (-.58 + col * .58, y + .14, 0), (.5, .28, .42), colours[(row * 3 + col) % len(colours)], 0)
    model('storage-rack', before, (1.8, .5))


def upright_piano():
    before = start()
    box('piano body', (0, .62, -.08), (1.5, 1.24, .45), piano_black, .02)
    box('piano keybed', (0, .72, .2), (1.4, .1, .22), piano_black, .01)
    box('piano white keys', (0, .78, .22), (1.3, .02, .16), snow, 0)
    for i in range(18):
        box('piano black key', (-.6 + i * .07, .8, .17), (.025, .02, .08), piano_black, 0)
    box('piano bench', (0, .45, .62), (.8, .06, .34), piano_black, .015)
    for x in (-.34, .34):
        box('piano bench leg', (x, .22, .62), (.05, .44, .28), piano_black, .005)
    seat(0, .5, .62, '-z')
    model('upright-piano', before, (1.5, .95))


def theater_row():
    """Five fold-down auditorium seats on one beam, sitters facing +Z."""
    before = start()
    box('theater row beam', (0, .06, -.05), (3.0, .12, .5), black, .01)
    for i in range(5):
        x = -1.2 + i * .6
        box('theater seat cushion', (x, .44, .05), (.52, .1, .46), seat_red, .03)
        box('theater seat back', (x, .78, -.22), (.52, .62, .1), seat_red, .03)
        box('theater armrest', (x - .29, .58, 0), (.05, .1, .5), black, .01)
        seat(x, .5, .05, '+z')
    model('theater-row', before, (3.05, .62))


def bleacher():
    """Two tiers of gallery bench seating rising towards -Z, sitters facing +Z."""
    before = start()
    box('bleacher lower tier', (0, .22, .4), (3.0, .44, .8), maple, .015)
    box('bleacher upper tier', (0, .45, -.4), (3.0, .9, .8), maple, .015)
    for i in range(4):
        x = -1.1 + i * .73
        seat(x, .46, .45, '+z')
        seat(x, .92, -.35, '+z')
    model('bleacher', before, (3.0, 1.6))


def drink_fridge():
    before = start()
    box('fridge body', (0, .95, 0), (.7, 1.9, .65), white, .02)
    box('fridge glass door', (0, 1.0, .33), (.6, 1.6, .012), clear_glass, 0)
    for row, y in enumerate((.45, .85, 1.25, 1.62)):
        for col in range(4):
            cylinder('drink bottle', (-.21 + col * .14, y, .1), .035, .24, balloon_colors[(row + col) % 6], 8)
    box('fridge header', (0, 1.85, .33), (.66, .12, .02), sky, 0)
    model('drink-fridge', before, (.7, .66))


# ---------------------------------------------------------------- parking
car_paint = material('car paint', (.66, .80, .74), .38)
car_glass = material('car window glass', (.30, .45, .50), .15)
tyre = material('car tyre', (.16, .17, .18), .8)


def parked_car():
    """Rounded pastel hatchback, front (+Z); the scene recolours 'car paint' per car."""
    before = start()
    box('car lower body', (0, .55, 0), (1.76, .56, 3.9), car_paint, .16)
    # Cabin: a dark glass band under a soft painted roof, readable from the high camera.
    box('car window band', (0, 1.06, -.25), (1.5, .42, 2.1), car_glass, .1)
    box('car roof', (0, 1.32, -.3), (1.6, .16, 2.2), car_paint, .07)
    box('car rear pillar', (0, 1.06, -1.3), (1.52, .4, .1), car_paint, .03)
    for x in (-.86, .86):
        box('car mirror', (x, .95, .72), (.12, .1, .16), car_paint, .03)
    for x in (-.86, .86):
        for z in (-1.25, 1.3):
            wheel = cylinder('car wheel', (x, .32, z), .32, .22, tyre, 14)
            turn(wheel, roll=math.pi / 2)
            cap = cylinder('car hubcap', (x * 1.08, .32, z), .15, .04, snow, 10)
            turn(cap, roll=math.pi / 2)
    for x in (-.55, .55):
        sphere('car headlight', (x, .68, 1.93), .13, snow, (1, .8, .35), 10, 6)
        sphere('car tail light', (x, .7, -1.93), .1, cart_red, (1.4, .7, .35), 8, 5)
    box('car front plate', (0, .44, 1.96), (.5, .12, .02), snow, .005)
    box('car bumper', (0, .36, 1.9), (1.6, .14, .14), snow, .05)
    box('car rear bumper', (0, .36, -1.9), (1.6, .14, .14), snow, .05)
    model('parked-car', before, (1.76, 3.96))


builders = [
    lambda: lab_set('lab-set-orange', orange), lambda: lab_set('lab-set-grey', grey_seat, grey_seat),
    lambda: lab_set('lab-set-maroon', maroon, maroon), teacher_desk, electronic_board, green_board,
    glass_cabinet, printer_cabinet, incubator_counter,
    lambda: germ_incubator('germ-incubator-a', .56, .5, .56, white, teal, False),
    lambda: germ_incubator('germ-incubator-b', .46, .5, .62, white, grey_seat, True),
    clean_bench, microscope_cabinet, incubator, side_counter,
    lambda: side_counter('sink-counter', granite, True), lambda: side_counter('sink-counter-brown', brown_top, True),
    cubby_shelf, basket_shelf, fume_hood, seminar_set, conference_set, wall_desk, whiteboard_stand, bookcase,
    display_stand, lectern, gym_mat, power_rack, treadmill, weight_bench, dumbbell_rack, cable_machine,
    computer_set, hex_table_set, storage_wall, art_set, open_shelf, easel, student_set, lounge_set, wall_bench,
    stage, wide_stage, projector_board, welcome_banner, balloon_arch, balloon_cluster, balloon_column,
    lambda: arcade('arcade-balloon', pink_body, sky_body), lambda: arcade('arcade-quiz', sky_body, pink_body),
    staff_desk, office_cabinet, locker_wall,
    library_stack, low_book_shelf, wood_bookcase, library_table_set, circulation_desk, lounge_chair, book_cart, folding_glass_door,
    broadcast_console, server_rack, infirmary_bed, sofa_set, workbench, storage_rack, upright_piano, theater_row, bleacher, drink_fridge,
    parked_car,
    oval_table_set, carrel_row, curved_sofa, round_table_stools, window_bench_green, booth, window_desk, germ,
]

base.clear()
for build in builders:
    build()
print('CLASSROOM_FOOTPRINTS', json.dumps(footprints, ensure_ascii=False), flush=True)
# Bake turned parts into their vertices so joined meshes export without node rotations.
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    obj.select_set(obj.type == 'MESH' and (obj.rotation_euler.to_quaternion().angle > 1e-6 or obj.scale != Vector((1, 1, 1))))
bpy.context.view_layer.objects.active = next((obj for obj in bpy.context.selected_objects), None)
if bpy.context.selected_objects:
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
base.export('school-classrooms')
