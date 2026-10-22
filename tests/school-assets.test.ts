import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Matrix4,Quaternion,Vector3} from 'three';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

type Node={name?:string;children?:number[];mesh?:number;matrix?:number[];translation?:number[];rotation?:number[];scale?:number[]};
type Primitive={indices?:number;attributes:{POSITION:number}};
type Asset={nodes:Node[];meshes:{primitives:Primitive[]}[];accessors:{count:number;min?:number[];max?:number[]}[];buffers:{uri?:string}[];images?:{uri?:string;bufferView?:number}[]};
const names=['school-exterior','school-entry','school-furniture','school-residents'];
for(const name of ['school-player-meshy'])test(`${name} retains a skinned, self-contained mobile character`,()=>{
  const {bytes,data}=readAsset(name);
  const triangles=data.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+data.accessors[p.indices!].count/3,0);
  assert.ok(bytes<2*1024*1024);
  assert.ok(triangles>0&&triangles<=25000);
  for(const primitive of data.meshes.flatMap(m=>m.primitives)) {
    assert.ok('JOINTS_0' in primitive.attributes&&'WEIGHTS_0' in primitive.attributes);
  }
  assert.ok(data.images?.every(image=>image.bufferView!==undefined&&!image.uri));
  assert.ok(data.nodes.some(node=>node.name==='SchoolUniform'));
});
function readAsset(name:string) {
  const buffer=readFileSync(new URL(`../public/${name}.glb`,import.meta.url));
  assert.equal(buffer.toString('ascii',0,4),'glTF');
  assert.equal(buffer.readUInt32LE(4),2);
  assert.equal(buffer.readUInt32LE(8),buffer.length);
  return {bytes:buffer.length,data:JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12))) as Asset};
}
function bounds(asset:Asset,name:string) {
  const index=asset.nodes.findIndex(node=>node.name===name);
  assert.ok(index>=0,`Missing independent model: ${name}`);
  const result=new Box3();
  function visit(id:number,parent:Matrix4) {
    const node=asset.nodes[id]!;
    const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(
      new Vector3().fromArray(node.translation??[0,0,0]),
      new Quaternion().fromArray(node.rotation??[0,0,0,1]),
      new Vector3().fromArray(node.scale??[1,1,1]));
    const world=parent.clone().multiply(local);
    if(node.mesh!==undefined)for(const primitive of asset.meshes[node.mesh]!.primitives) {
      const position=asset.accessors[primitive.attributes.POSITION]!;
      assert.ok(position.min&&position.max,'Position bounds must be exported');
      result.union(new Box3(new Vector3().fromArray(position.min),new Vector3().fromArray(position.max)).applyMatrix4(world));
    }
    for(const child of node.children??[])visit(child,world);
  }
  visit(index,new Matrix4());
  assert.ok(!result.isEmpty(),`${name} must contain geometry`);
  return result;
}

test('school models are self-contained and share a bounded mobile asset budget',()=>{
  let bytes=0,triangles=0,primitives=0;
  for(const name of names) {
    const asset=readAsset(name);bytes+=asset.bytes;
    assert.ok(asset.data.buffers.every(buffer=>!buffer.uri),'Geometry must be embedded');
    assert.ok((asset.data.images??[]).every(image=>!image.uri&&image.bufferView!==undefined),'Textures must be embedded');
    for(const mesh of asset.data.meshes)for(const primitive of mesh.primitives) {
      triangles+=asset.data.accessors[primitive.indices??primitive.attributes.POSITION]!.count/3;
      primitives++;
    }
  }
  assert.ok(bytes<6*1024*1024,`School assets: ${bytes} bytes`);
  assert.ok(triangles>0&&triangles<200000,`School assets: ${triangles} triangles`);
  assert.ok(primitives<80,`School assets: ${primitives} material primitives before cloning`);
});

test('school door retains its left hinge, floor origin and navigable width',()=>{
  const data=readAsset('school-furniture').data;
  const box=bounds(data,'door');
  assert.ok(Math.abs(box.min.x)<.005,'Left hinge must stay at x=0');
  assert.ok(Math.abs(box.min.y)<.005,'Door must rest on its pivot floor');
  assert.ok(Math.abs(box.max.x-1.74)<.01,'Door must fit the 1.8 m opening');
  assert.ok(Math.abs(box.max.y-2.22)<.01,'Door must fit the retained frame');
  assert.ok(box.max.z-box.min.z<.3,'Handles must not extend far into the corridor');
});

test('residents and symbolic furnishings are separate static models at human scale',()=>{
  const data=readAsset('school-residents').data;
  for(const name of ['principal-resident','vice-principal-resident','duty-resident','gate-resident','standing-desk','restroom-sink','restroom-toilet']) {
    const box=bounds(data,name);
    assert.ok(box.min.y>=-.03,`${name} must not sink into the floor`);
    assert.ok(box.max.y<1.95,`${name} must keep the explorer scale`);
  }
  for(const name of ['principal-resident','vice-principal-resident','gate-resident']) {
    const box=bounds(data,name);
    assert.ok(Math.abs(box.max.y-box.min.y-1.7)<.02,`${name} matches the 170 cm explorer`);
    assert.ok(box.max.x-box.min.x>.65,`${name} retains a wide cozy head silhouette`);
  }
  assert.ok(bounds(data,'standing-desk').max.y>1.3,'Standing desk includes the computer');
  for(const primitive of data.meshes.flatMap(m=>m.primitives))assert.ok(!('JOINTS_0' in primitive.attributes),'Static poses must be baked before batching');
});

test('exterior ground floor uses the same 81 by 55.8 metre reference grid as the interior',()=>{
  const box=bounds(readAsset('school-exterior').data,'exterior-ground-floor');
  // Window sills project 0.50 m beyond the structural reference lines.
  assert.ok(Math.abs(box.min.x+41)<.01&&Math.abs(box.max.x-41)<.01,'Facade must align with both measured side walls');
  assert.ok(Math.abs(box.min.z+36.05)<.01&&Math.abs(box.max.z-20.75)<.01,'Facade must retain the measured building depth');
});

test('compressed measured exterior can decode every mesh buffer without external files',async()=>{
  const file=readFileSync(new URL('../public/school-exterior.glb',import.meta.url)),jsonLength=file.readUInt32LE(12);
  const data=JSON.parse(file.toString('utf8',20,20+jsonLength)),binary=file.subarray(28+jsonLength);
  await MeshoptDecoder.ready;
  let decoded=0;
  for(const view of data.bufferViews) {
    const ext=view.extensions?.EXT_meshopt_compression;if(!ext)continue;
    const target=new Uint8Array(ext.count*ext.byteStride),source=binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength);
    MeshoptDecoder.decodeGltfBuffer(target,ext.count,ext.byteStride,source,ext.mode,ext.filter);
    assert.equal(target.byteLength,view.byteLength);decoded++;
  }
  assert.ok(decoded>0,'The larger measured exterior must ship compressed');
});

test('school furniture has separate grounded models and entries remain separate',()=>{
  const furniture=readAsset('school-furniture').data;
  for(const [name,width,depth,maxHeight] of [['desk',2,1.2,1.1],['shelf',2,.7,1.8],['bench',2,1,1.1]] as const) {
    const box=bounds(furniture,name),size=box.getSize(new Vector3());
    assert.ok(Math.abs(box.min.y)<.01,`${name}: feet must touch the floor`);
    assert.ok(Math.abs(size.x-width)<.06,`${name}: keep canonical width`);
    assert.ok(Math.abs(size.z-depth)<.06,`${name}: keep canonical depth`);
    assert.ok(size.y>0&&size.y<maxHeight,`${name}: retain visitor-scale height`);
  }
  const entry=readAsset('school-entry').data;
  for(const name of ['entrance','gate'])bounds(entry,name);
  assert.ok(bounds(entry,'entrance').min.y>2.4,'Wall-mounted canopy must clear the walkable entrance and visitor');
});
