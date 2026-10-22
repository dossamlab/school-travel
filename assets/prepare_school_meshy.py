"""Bind the supplied posed school character and retarget the existing local walk."""
import json
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'public/school-player-meshy.glb'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/player.glb'))
old_rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
walk=next(a for a in bpy.data.actions if a.name=='Walk')
old_rig.animation_data.action=walk
old_rest={b.name:old_rig.matrix_world@b.matrix_local for b in old_rig.data.bones}
samples=[]
for frame in range(round(walk.frame_range[0]),round(walk.frame_range[1])+1):
    bpy.context.scene.frame_set(frame)
    samples.append((frame,{b.name:b.matrix_basis.copy() for b in old_rig.pose.bones}))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/school-player-meshy-source.glb'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
points=[mesh.matrix_world@v.co for v in mesh.data.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)])
hi=Vector([max(p[i] for p in points) for i in range(3)])
origin=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
scale=1.7/(hi.z-lo.z)
for v,p in zip(mesh.data.vertices,points):v.co=(p-origin)*scale
mesh.parent=None;mesh.matrix_world=Matrix.Identity(4);mesh.name='SchoolUniform'
bpy.context.view_layer.objects.active=mesh
mesh.select_set(True)
mesh.data.calc_loop_triangles()
source_triangles=len(mesh.data.loop_triangles)
# Join exported UV-seam duplicates before reduction so the surface stays closed.
bm=bmesh.new();bm.from_mesh(mesh.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bm.to_mesh(mesh.data);bm.free()
decimate=mesh.modifiers.new('Mobile surface budget','DECIMATE')
decimate.ratio=min(1,22000/source_triangles)
decimate.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=decimate.name)

# Landmarks measured against the supplied mesh after normalization to 1.7 m.
# Source left leg is raised; source and neutral chains share names and hierarchy.
bones={
    'playerHips':(None,(.055,-.03,.46),(.055,-.035,.58)),
    'mixamorig:Spine':('playerHips',(.055,-.035,.58),(.055,-.04,.70)),
    'mixamorig:Spine1':('mixamorig:Spine',(.055,-.04,.70),(.055,-.04,.82)),
    'mixamorig:Spine2':('mixamorig:Spine1',(.055,-.04,.82),(.055,-.04,.93)),
    'mixamorig:Neck':('mixamorig:Spine2',(.055,-.04,.93),(.055,-.035,1.0)),
    'mixamorig:Head':('mixamorig:Neck',(.055,-.035,1.0),(.055,-.035,1.55)),
    'playerArmL':('mixamorig:Spine2',(.24,-.025,.85),(.31,-.075,.65)),
    'mixamorig:LeftForeArm':('playerArmL',(.31,-.075,.65),(.32,-.15,.47)),
    'mixamorig:LeftHand':('mixamorig:LeftForeArm',(.32,-.15,.47),(.31,-.18,.38)),
    'playerArmR':('mixamorig:Spine2',(-.14,-.025,.85),(-.23,-.02,.65)),
    'mixamorig:RightForeArm':('playerArmR',(-.23,-.02,.65),(-.235,-.045,.43)),
    'mixamorig:RightHand':('mixamorig:RightForeArm',(-.235,-.045,.43),(-.22,-.04,.34)),
    'playerLegL':('playerHips',(.15,-.015,.46),(.15,.035,.30)),
    'mixamorig:LeftLeg':('playerLegL',(.15,.035,.30),(.15,.20,.18)),
    'playerFootL':('mixamorig:LeftLeg',(.15,.20,.18),(.15,.125,.06)),
    'playerLegR':('playerHips',(-.045,-.045,.46),(-.05,-.09,.27)),
    'mixamorig:RightLeg':('playerLegR',(-.05,-.09,.27),(-.05,-.12,.075)),
    'playerFootR':('mixamorig:RightLeg',(-.05,-.12,.075),(-.05,-.23,.035)),
}
armature=bpy.data.armatures.new('SchoolExplorerSkeleton')
rig=bpy.data.objects.new('SchoolExplorerRig',armature)
bpy.context.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,(parent,head,tail) in bones.items():
    bone=armature.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=armature.edit_bones[parent]
    bone.align_roll(Vector((0,1,0)))
bpy.ops.object.mode_set(mode='OBJECT')
source_rest={b.name:b.matrix_local.copy() for b in armature.bones}

def smooth(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)))
    return t*t*(3-2*t)

def chain_weights(p,names):
    distances=[]
    for name in names:
        a,b=(Vector(v) for v in bones[name][1:])
        t=max(0,min(1,(p-a).dot(b-a)/(b-a).length_squared))
        distances.append(((p-a-(b-a)*t).length,name))
    closest=sorted(distances)[:2]
    values={name:1/(distance+.035)**4 for distance,name in closest}
    total=sum(values.values())
    return {name:value/total for name,value in values.items()}

def weights(p):
    if p.z>=.99:return {'mixamorig:Head':1}
    if p.z>.91:
        t=smooth(.91,.99,p.z)
        return {'mixamorig:Head':t,'mixamorig:Neck':1-t}
    side='L' if p.x>.055 else 'R'
    word='Left' if side=='L' else 'Right'
    # Separate sleeves/hands from the torso, preserving the jacket and face texture.
    arm_boundary=.205 if side=='L' else -.145
    arm_amount=smooth(0,.045,(p.x-arm_boundary)*(1 if side=='L' else -1))
    arm_amount*=1-smooth(.80,.91,p.z)
    if p.z<.3:arm_amount=0
    if p.z<.54:
        names=[f'playerLeg{side}',f'mixamorig:{word}Leg',f'playerFoot{side}']
        base=chain_weights(p,names)
        hip=smooth(.36,.51,p.z)
        base={name:value*(1-hip) for name,value in base.items()}
        base['playerHips']=hip
    else:
        base=chain_weights(p,['playerHips','mixamorig:Spine','mixamorig:Spine1','mixamorig:Spine2'])
    if arm_amount:
        base={name:value*(1-arm_amount) for name,value in base.items()}
        for name,value in chain_weights(p,[f'playerArm{side}',f'mixamorig:{word}ForeArm',f'mixamorig:{word}Hand']).items():
            base[name]=base.get(name,0)+value*arm_amount
    values=sorted(base.items(),key=lambda pair:pair[1],reverse=True)[:4]
    total=sum(value for _,value in values)
    return {name:value/total for name,value in values if value>0}

skin=[weights(v.co) for v in mesh.data.vertices]
# Straighten both legs and relax the arms before binding the animation.
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for side,x in [('L',.15),('R',-.05)]:
    word='Left' if side=='L' else 'Right'
    for name,head,tail in [
        (f'playerLeg{side}',(x,-.03,.46),(x,-.03,.27)),
        (f'mixamorig:{word}Leg',(x,-.03,.27),(x,-.03,.075)),
        (f'playerFoot{side}',(x,-.03,.075),(x,-.15,.035)),
    ]:
        bone=armature.edit_bones[name];bone.head=head;bone.tail=tail;bone.align_roll(Vector((0,1,0)))
for side,shoulder,elbow in [('L',.24,.27),('R',-.14,-.17)]:
    word='Left' if side=='L' else 'Right'
    for name,head,tail in [
        (f'playerArm{side}',(shoulder,-.025,.85),(elbow,-.035,.65)),
        (f'mixamorig:{word}ForeArm',(elbow,-.035,.65),(elbow,-.06,.44)),
        (f'mixamorig:{word}Hand',(elbow,-.06,.44),(elbow,-.075,.35)),
    ]:
        bone=armature.edit_bones[name];bone.head=head;bone.tail=tail;bone.align_roll(Vector((0,1,0)))
bpy.ops.object.mode_set(mode='OBJECT')
neutral_rest={b.name:b.matrix_local.copy() for b in armature.bones}
transforms={name:neutral_rest[name]@source_rest[name].inverted() for name in bones}
groups={name:mesh.vertex_groups.new(name=name) for name in bones}
for vertex,values in zip(mesh.data.vertices,skin):
    p=vertex.co.copy()
    vertex.co=sum((transforms[name]@p*value for name,value in values.items()),Vector())
    for name,value in values.items():groups[name].add([vertex.index],value,'REPLACE')
for side in ['L','R']:
    sole=[v for v,values in zip(mesh.data.vertices,skin) if values.get(f'playerFoot{side}',0)>.5]
    bottom=min(v.co.z for v in sole)
    for vertex,values in zip(mesh.data.vertices,skin):
        influence=sum(values.get(name,0) for name in [f'playerLeg{side}',f'mixamorig:{"Left" if side=="L" else "Right"}Leg',f'playerFoot{side}'])
        vertex.co.z-=bottom*influence*(1-smooth(.12,.24,vertex.co.z))
    for vertex in sole:
        if vertex.co.z<.018:vertex.co.z=0
for polygon in mesh.data.polygons:polygon.use_smooth=True
mesh.data.normals_split_custom_set([(0,0,0)]*len(mesh.data.loops))
mesh.data.update()
modifier=mesh.modifiers.new('School walking skeleton','ARMATURE');modifier.object=rig
mesh.parent=rig

rig.animation_data_create()
idle=bpy.data.actions.new('Idle');idle.use_fake_user=True
rig.animation_data.action=idle
for bone in rig.pose.bones:
    bone.rotation_mode='QUATERNION';bone.matrix_basis.identity()
    for frame in (1,31):
        for channel in ['location','rotation_quaternion','scale']:bone.keyframe_insert(channel,frame=frame)
walk=bpy.data.actions.new('Walk');walk.use_fake_user=True
rig.animation_data.action=walk
for frame,poses in samples:
    for bone in rig.pose.bones:
        axes=old_rest[bone.name].to_quaternion().inverted()@neutral_rest[bone.name].to_quaternion()
        rotation=axes.inverted()@poses[bone.name].to_quaternion()@axes
        if any(part in bone.name for part in ['Leg','Foot','Arm','Hand']):
            old_axes=old_rest[bone.name].to_quaternion()
            swing=(old_axes@poses[bone.name].to_quaternion()@old_axes.inverted()).to_euler('XYZ').x
            new_axes=neutral_rest[bone.name].to_quaternion()
            amount=.42 if any(part in bone.name for part in ['Arm','Hand']) else .65
            rotation=new_axes.inverted()@Quaternion((1,0,0),swing*amount)@new_axes
        else:rotation=Quaternion().slerp(rotation,.25)
        bone.rotation_quaternion=rotation
        bone.location=Vector()
        if bone.name=='playerHips':
            translation=old_rest[bone.name].to_3x3()@poses[bone.name].to_translation()
            translation.z*=.35
            bone.location=(neutral_rest[bone.name].to_3x3().inverted()@translation)*(1.7/1.45)
        for channel in ['location','rotation_quaternion','scale']:bone.keyframe_insert(channel,frame=frame)
rig.animation_data.action=idle;bpy.context.scene.frame_set(1)

bottom=min(v.co.z for v in mesh.data.vertices)
height=max(v.co.z for v in mesh.data.vertices)-bottom
root=bpy.data.objects.new('SchoolExplorer',None);bpy.context.collection.objects.link(root)
rig.parent=root;root.scale=(1.7/height,)*3;root.location.z=-bottom*root.scale.z
for material in mesh.data.materials:
    bsdf=material.node_tree.nodes.get('Principled BSDF')
    # The imported normal atlas has visible island-edge artifacts after reduction.
    for link in list(bsdf.inputs['Normal'].links):material.node_tree.links.remove(link)
    color_node=bsdf.inputs['Base Color'].links[0].from_node
    color_image=color_node.image
    pixels=np.empty(len(color_image.pixels),dtype=np.float32);color_image.pixels.foreach_get(pixels)
    rgba=pixels.reshape((-1,4));r,g,b=rgba[:,0].copy(),rgba[:,1].copy(),rgba[:,2].copy()
    jacket=(r>.012)&(r>b)&(b>r*.45)&(g<r*.5)
    rgba[jacket,0]=np.minimum(1,r[jacket]*1.07)
    rgba[jacket,1]=np.maximum(g[jacket],r[jacket]*.23)
    rgba[jacket,2]=np.minimum(b[jacket],r[jacket]*.34)
    # Restrict the peach tint to face/neck/hands, leaving ivory clothing untouched.
    width,height=color_image.size
    skin_region=np.zeros((height,width),dtype=bool)
    uv=mesh.data.uv_layers.active.data
    exposed=[sum(values.get(name,0) for name in ('mixamorig:Head','mixamorig:Neck','mixamorig:LeftHand','mixamorig:RightHand'))>.5 for values in skin]
    mesh.data.calc_loop_triangles()
    for triangle in mesh.data.loop_triangles:
        if not all(exposed[index] for index in triangle.vertices):continue
        a,b_uv,c=[np.array(uv[index].uv)*(width-1,height-1) for index in triangle.loops]
        low=np.maximum(0,np.floor(np.minimum(np.minimum(a,b_uv),c)).astype(int)-2)
        high=np.minimum((width-1,height-1),np.ceil(np.maximum(np.maximum(a,b_uv),c)).astype(int)+2)
        xx,yy=np.meshgrid(np.arange(low[0],high[0]+1),np.arange(low[1],high[1]+1))
        ab,ac=b_uv-a,c-a
        determinant=ab[0]*ac[1]-ab[1]*ac[0]
        if abs(determinant)<1e-8:continue
        u=((xx-a[0])*ac[1]-(yy-a[1])*ac[0])/determinant
        v=(ab[0]*(yy-a[1])-ab[1]*(xx-a[0]))/determinant
        skin_region[low[1]:high[1]+1,low[0]:high[0]+1]|=(u>=0)&(v>=0)&(u+v<=1)
    # Cover UV edge texels too; the color mask protects hair, eyes and shirt cuffs.
    padded=np.pad(skin_region,2)
    skin_region=np.logical_or.reduce([padded[y:y+height,x:x+width] for y in range(5) for x in range(5)])
    flesh=skin_region.ravel()&(r>.35)&(g>r*.48)&(g<r*.96)&(b>g*.5)&(b<g*.96)
    rgba[flesh,:3]*=np.array((.98,.78,.77),dtype=np.float32)
    color_image.pixels.foreach_set(pixels);color_image.update();color_image.pack()
    for link in list(bsdf.inputs['Metallic'].links):material.node_tree.links.remove(link)
    bsdf.inputs['Metallic'].default_value=0
    for link in list(bsdf.inputs['Roughness'].links):material.node_tree.links.remove(link)
    bsdf.inputs['Roughness'].default_value=.85
for image in bpy.data.images:
    if image.type!='IMAGE' or not image.size[0] or not image.users:continue
    factor=min(1,2048/max(image.size))
    if factor<1:image.scale(round(image.size[0]*factor),round(image.size[1]*factor))
    image.pack()
bpy.ops.object.select_all(action='DESELECT')
for obj in [root,rig,mesh]:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_skins=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_image_format='JPEG',export_jpeg_quality=90)
mesh.data.calc_loop_triangles()
print('SCHOOL_MESHY',json.dumps({'bytes':OUTPUT.stat().st_size,'source_triangles':source_triangles,'triangles':len(mesh.data.loop_triangles),'joints':len(bones),'height':1.7}),flush=True)
