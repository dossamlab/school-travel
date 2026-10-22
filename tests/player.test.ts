import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPlayerMotion, type PlayerPose } from '../src/player.ts';
import { schoolPlayerHeight } from '../src/school-plan-data.ts';

for(const [folder,filename] of [['assets','player.glb'],['public','school-player-meshy.glb']])test(`${filename} stands at full height, walks in place and keeps a supporting foot grounded`,async()=>{
  const bytes=readFileSync(new URL(`../${folder}/${filename}`,import.meta.url));
  const loader=new GLTFLoader();
  // Rendering textures needs a browser; geometry, skin weights and clips remain real.
  loader.register(()=>({name:'headlessMaterials',loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())}));
  const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const expectedHeight=filename.startsWith('school-player')?schoolPlayerHeight:1.45;
  if(filename.startsWith('school-player')) {
    const initial=new THREE.Box3().setFromObject(asset.scene);
    asset.scene.scale.setScalar(schoolPlayerHeight/(initial.max.y-initial.min.y));
    assert.equal(schoolPlayerHeight,1.70);
  }
  const player=new THREE.Group();player.position.set(-1,.17,2.65);player.add(asset.scene);
  const update=createPlayerMotion(asset.scene,asset.animations);
  const bounds=new THREE.Box3();
  function measure(){player.updateMatrixWorld(true);return bounds.setFromObject(asset.scene,true);}
  update(1/60,false);
  measure();
  assert.ok(Math.abs(bounds.min.y-.17)<.012,`idle floor: ${bounds.min.y}`);
  assert.ok(Math.abs(bounds.max.y-bounds.min.y-expectedHeight)<.01,`idle height: ${bounds.max.y-bounds.min.y}`);
  const height=bounds.max.y-bounds.min.y;
  const head=asset.scene.getObjectByName('mixamorigHead')!;
  const hips=asset.scene.getObjectByName('playerHips')!;
  const headRatio=(bounds.max.y-head.getWorldPosition(new THREE.Vector3()).y)/height;
  const hipsRatio=(hips.getWorldPosition(new THREE.Vector3()).y-bounds.min.y)/height;
  assert.ok(headRatio>.37&&headRatio<.42,`enlarged head must occupy about 40% of height: ${headRatio}`);
  assert.ok(filename==='school-player-meshy.glb'?hipsRatio>.25&&hipsRatio<.30:hipsRatio>.20&&hipsRatio<.24,`hips must retain the selected character's proportions: ${hipsRatio}`);
  assert.ok((bounds.max.x-bounds.min.x)/height>.44,'head and body must retain the wider cozy silhouette');
  if(filename==='school-player-meshy.glb')for(const [side,word] of [['L','Left'],['R','Right']]) {
    const shoulder=asset.scene.getObjectByName(`playerArm${side}`)!.getWorldPosition(new THREE.Vector3());
    const elbow=asset.scene.getObjectByName(`mixamorig${word}ForeArm`)!.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(elbow.x-shoulder.x)<.06,`${side} elbow should rest close to the body`);
  }
  if(filename==='school-player-meshy.glb')for(const foot of ['playerFootL','playerFootR']) {
    let sole=Infinity;
    asset.scene.traverse(object=>{
      if(!(object instanceof THREE.SkinnedMesh))return;
      const joints=object.geometry.getAttribute('skinIndex'),weights=object.geometry.getAttribute('skinWeight');
      for(let i=0;i<joints.count;i++)for(let j=0;j<4;j++)if(weights.getComponent(i,j)>.5&&object.skeleton.bones[joints.getComponent(i,j)].name===foot) {
        const p=object.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(object.matrixWorld);
        sole=Math.min(sole,p.y);
      }
    });
    assert.ok(Math.abs(sole-.17)<.012,`${foot} must rest on the floor while standing: ${sole}`);
  }
  const leg=asset.scene.getObjectByName('playerLegL')!;
  const rest=leg.quaternion.clone();
  for(let frame=0;frame<120;frame++){
    player.position.x+=.02;player.rotation.y+=.03;
    update(1/60,true);measure();
    assert.ok(Number.isFinite(bounds.min.y));
    assert.ok(Math.abs(bounds.min.y-.17)<.012,`walking floor at ${frame}: ${bounds.min.y}`);
    assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).z-player.position.z)<.35,'walking clip must not move the player through the room');
    if(filename==='school-player-meshy.glb') {
      const local=new THREE.Matrix4().copy(player.matrixWorld).invert();
      const left=asset.scene.getObjectByName('mixamorigLeftLeg')!.getWorldPosition(new THREE.Vector3()).applyMatrix4(local);
      const right=asset.scene.getObjectByName('mixamorigRightLeg')!.getWorldPosition(new THREE.Vector3()).applyMatrix4(local);
      assert.ok(left.x-right.x>.08,`knees must not cross at frame ${frame}: ${left.x-right.x}`);
    }
  }
  assert.ok(leg.quaternion.angleTo(rest)>.05,'walking must articulate the leg');
  for(let frame=0;frame<90;frame++)update(1/60,false);
  assert.ok(leg.quaternion.angleTo(rest)<.01,'stopping must return to the neutral pose');
});

test('school character keeps its jacket intact through every interaction pose',async()=>{
  const bytes=readFileSync(new URL('../public/school-player-meshy.glb',import.meta.url));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'headlessMaterials',loadMaterial:()=>Promise.resolve(new THREE.MeshStandardMaterial())}));
  const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const initial=new THREE.Box3().setFromObject(asset.scene);
  asset.scene.scale.setScalar(schoolPlayerHeight/(initial.max.y-initial.min.y));
  const player=new THREE.Group();player.add(asset.scene);
  const update=createPlayerMotion(asset.scene,asset.animations);
  let mesh!:THREE.SkinnedMesh;asset.scene.traverse(object=>{if(object instanceof THREE.SkinnedMesh)mesh=object;});
  const index=mesh.geometry.index!,v=new THREE.Vector3();
  const snapshot=()=>{player.updateMatrixWorld(true);return Array.from({length:mesh.geometry.getAttribute('position').count},(_,i)=>mesh.getVertexPosition(i,v).clone());};
  update(1/60,false);const rest=snapshot();
  const poses:[string,PlayerPose,number][]=[['squat',{activity:'squat'},1.31],['curl',{activity:'curl'},1.05],['cheer',{activity:'cheer'},1],['wave',{activity:'wave'},1],['run',{activity:'run'},1],['piano',{seat:.5,activity:'play'},1]];
  for(const [name,pose,seconds] of poses) {
    for(let t=0;t<seconds;t+=1/60)update(1/60,false,pose);
    const now=snapshot();let worst=0;
    // A spike is a short edge pulled out into a long sliver: hand-to-hip faces once reached 27-64 cm.
    for(let t=0;t<index.count;t+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]) {
      const i=index.getX(t+a),j=index.getX(t+b);
      if(rest[i]!.distanceTo(rest[j]!)<.03)worst=Math.max(worst,now[i]!.distanceTo(now[j]!));
    }
    assert.ok(worst<.15,`${name}: a short edge stretched to ${(worst*100).toFixed(1)} cm`);
    for(let t=0;t<1.5;t+=1/60)update(1/60,false);
  }
});
