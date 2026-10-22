import * as THREE from 'three';

export type PlayerActivity='run'|'squat'|'curl'|'cheer'|'play'|'wave';
export type PlayerPose={seat?:number;activity?:PlayerActivity;lift?:number};
/** Repetition rates (rad/s) of the exercise loops; one repetition is 2π/rate seconds. */
export const squatRate=2.4,curlRate=3;
// Treadmill jog speed of the walk clip; faster reads as shaking at the 30 fps many phones render.
const runPace=2.1,jogLean=Math.PI*.06;

/**
 * The generated rigs rest the hands against the hips: hip and hem vertices carry a little hand weight and a few
 * faces join hand to hip, so raising an arm drags the jacket into thin spikes. Give each vertex to the arm or the
 * body, never both, and drop the faces that still join a hand to the lower body.
 */
export function separateArms(mesh:THREE.SkinnedMesh) {
  const geometry=mesh.geometry,joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  const names=mesh.skeleton.bones.map(bone=>bone.name);
  const sum=(i:number,pattern:RegExp)=>{let total=0;for(let k=0;k<4;k++)if(pattern.test(names[joints.getComponent(i,k)]??''))total+=weights.getComponent(i,k);return total;};
  const lowerArm=/ForeArm|Hand/,arm=/Arm|Hand/,lowerBody=/Hips|Spine1?$|Leg|Foot/;
  for(let i=0;i<joints.count;i++) {
    // Mostly arm: let go of the hips and lower spine. Mostly lower body: let go of the arm. Chest and shoulders keep
    // their arm blend so the armpit still bends smoothly; they only drop the forearm and hand.
    const strip=sum(i,arm)>=.5?lowerBody:sum(i,lowerBody)>=.5?arm:lowerArm;
    let total=0;
    for(let k=0;k<4;k++){if(strip.test(names[joints.getComponent(i,k)]??''))weights.setComponent(i,k,0);total+=weights.getComponent(i,k);}
    if(total>0)for(let k=0;k<4;k++)weights.setComponent(i,k,weights.getComponent(i,k)/total);
  }
  weights.needsUpdate=true;
  const index=geometry.index;if(!index)return;
  const side=(i:number)=>sum(i,arm)>=.5?1:sum(i,lowerBody)>=.5?-1:0;
  const kept:number[]=[];
  for(let t=0;t<index.count;t+=3) {
    const sides=[0,1,2].map(j=>side(index.getX(t+j)));
    if(!(sides.includes(1)&&sides.includes(-1)))kept.push(index.getX(t),index.getX(t+1),index.getX(t+2));
  }
  geometry.setIndex(kept);
}

/** Blend the explorer's authored poses and keep its supporting sole on the floor. */
export function createPlayerMotion(model:THREE.Object3D,clips:THREE.AnimationClip[]) {
  const idleClip=THREE.AnimationClip.findByName(clips,'Idle');
  const walkClip=THREE.AnimationClip.findByName(clips,'Walk')?.clone();
  if(!idleClip||!walkClip)throw new Error('주인공의 서기·걷기 동작이 누락됐습니다.');
  const idleHips=idleClip.tracks.find(track=>track.name==='playerHips.position')!;
  const walkHips=walkClip.tracks.find(track=>track.name==='playerHips.position')!;
  // Only the game moves across the room; the animation retains its vertical step.
  for(let i=0;i<walkHips.values.length;i+=3){walkHips.values[i]=idleHips.values[0]!;walkHips.values[i+2]=idleHips.values[2]!;}
  const mixer=new THREE.AnimationMixer(model);
  const idle=mixer.clipAction(idleClip).play();
  const walk=mixer.clipAction(walkClip).setEffectiveWeight(0).setEffectiveTimeScale(1.8).play();
  const soles:{mesh:THREE.SkinnedMesh;indices:number[]}[]=[];
  model.traverse(object=>{
    if(!(object instanceof THREE.SkinnedMesh))return;
    object.frustumCulled=false;separateArms(object);
    const position=object.geometry.getAttribute('position');
    object.geometry.computeBoundingBox();
    const box=object.geometry.boundingBox!;
    const threshold=box.min.y+(box.max.y-box.min.y)*.025;
    const indices:number[]=[];
    for(let i=0;i<position.count;i++)if(position.getY(i)<=threshold)indices.push(i);
    soles.push({mesh:object,indices});
  });
  const point=new THREE.Vector3(),inverse=new THREE.Matrix4();
  // Sitting bends the thighs forward and the knees back about the body's side axis.
  const thighs=['playerLegL','playerLegR'].map(name=>model.getObjectByName(name)).filter((bone):bone is THREE.Object3D=>!!bone);
  const knees=thighs.map(thigh=>thigh.children.find(child=>(child as THREE.Bone).isBone)).filter((bone):bone is THREE.Object3D=>!!bone);
  const upperArms=['playerArmL','playerArmR'].map(name=>model.getObjectByName(name)).filter((bone):bone is THREE.Object3D=>!!bone);
  const forearms=upperArms.map(arm=>arm.children.find(child=>(child as THREE.Bone).isBone)).filter((bone):bone is THREE.Object3D=>!!bone);
  const axis=new THREE.Vector3(),turn=new THREE.Quaternion(),parentTurn=new THREE.Quaternion();
  // The hip joint sits just above the seat surface.
  const hips=model.getObjectByName('playerHips'),hipAboveSeat=.055;
  const spine=model.getObjectByName('mixamorigSpine1');
  let seatHeight=.53;
  // The mixer skips bones whose animated value did not change, so undo last frame's bend first.
  const unbent=new Map<THREE.Object3D,THREE.Quaternion>();
  /** Turn a bone about the body's side (x) or front (z) axis, whatever its own bone axes are. */
  function bend(bone:THREE.Object3D,angle:number,about:'side'|'front'='side') {
    if(!unbent.has(bone))unbent.set(bone,bone.quaternion.clone());
    bone.parent!.updateWorldMatrix(true,false);
    axis.set(about==='side'?1:0,0,about==='front'?1:0).applyQuaternion(model.getWorldQuaternion(turn)).applyQuaternion(bone.parent!.getWorldQuaternion(parentTurn).invert());
    bone.quaternion.premultiply(turn.setFromAxisAngle(axis.normalize(),angle));
    bone.updateMatrixWorld(true);
  }
  let weight=0,sit=0,act=0,ramp=0,jog=0,clock=0,lastActivity:PlayerActivity|undefined,current:PlayerActivity|undefined;
  return (dt:number,moving:boolean,pose:PlayerPose={})=>{
    const seated=pose.seat!==undefined;if(seated)seatHeight=pose.seat!+hipAboveSeat;
    const running=pose.activity==='run';
    // Each exercise starts its repetitions from standing so callers can count them on their own clock;
    // stopping keeps the clock running so the pose eases out instead of snapping back to rest.
    if(pose.activity!==current){if(pose.activity)clock=0;current=pose.activity;}
    clock+=dt;
    if(pose.activity&&pose.activity!=='run')lastActivity=pose.activity;
    weight=THREE.MathUtils.lerp(weight,(moving||running)&&!seated?1:0,1-Math.exp(-dt*14));
    sit=THREE.MathUtils.lerp(sit,seated?1:0,1-Math.exp(-dt*12));
    // Poses blend in and out over 0.4 s on a smoothstep, starting and ending at rest instead of jumping.
    ramp=THREE.MathUtils.clamp(ramp+(pose.activity&&!running?dt:-dt)/.4,0,1);act=ramp*ramp*(3-2*ramp);
    jog=THREE.MathUtils.clamp(jog+(running?dt:-dt)/.4,0,1);
    idle.setEffectiveWeight(1-weight);walk.setEffectiveWeight(weight);walk.setEffectiveTimeScale(running?runPace:1.8);
    for(const [bone,rest] of unbent)bone.quaternion.copy(rest);
    unbent.clear();
    mixer.update(dt);
    model.updateMatrixWorld(true);
    if(sit>.001) {
      for(const thigh of thighs)bend(thigh,-Math.PI*.44*sit);
      for(const knee of knees)bend(knee,Math.PI/2*sit);
    }
    if(jog>0) {
      // Jogging reads through posture rather than speed: elbows bent and a slight forward lean.
      const j=jog*jog*(3-2*jog);
      for(const forearm of forearms)bend(forearm,-Math.PI*.42*j);
      if(spine)bend(spine,jogLean*j);
    }
    if(act>.001&&lastActivity) {
      // Exercise and play poses repeat on a shared clock; counts are kept by the scene on the same rhythm.
      const cycle=(rate:number)=>(1-Math.cos(clock*rate))/2;
      if(lastActivity==='squat') {
        const s=cycle(squatRate)*act;
        for(const thigh of thighs)bend(thigh,-Math.PI*.28*s);
        // Past a right angle the trouser skin behind the knee folds into a spike, so this stays a half squat.
        for(const knee of knees)bend(knee,Math.PI*.48*s);
        // Hands reach up to grip the bar resting behind the neck.
        upperArms.forEach((arm,i)=>bend(arm,(i?-1:1)*Math.PI*.5*act,'front'));
        forearms.forEach((forearm,i)=>bend(forearm,(i?-1:1)*Math.PI*.6*act,'front'));
      } else if(lastActivity==='curl') {
        const s=cycle(curlRate)*act;
        for(const arm of upperArms)bend(arm,-Math.PI*.12*act);
        for(const forearm of forearms)bend(forearm,-Math.PI*.7*s);
      } else if(lastActivity==='cheer') {
        upperArms.forEach((arm,i)=>bend(arm,(i?-1:1)*Math.PI*.78*act,'front'));
      } else if(lastActivity==='wave') {
        // Right elbow out at shoulder height, the forearm up and swinging clear of the big head.
        bend(upperArms[1]!,-Math.PI*.58*act,'front');
        bend(forearms[1]!,-Math.PI*(.3+.12*Math.sin(clock*11))*act,'front');
      } else if(lastActivity==='play') {
        for(const arm of upperArms)bend(arm,-Math.PI*.3*act);
        forearms.forEach((forearm,i)=>bend(forearm,-Math.PI*(.32+.05*Math.sin(clock*9+i*2))*act));
      }
    }
    model.position.y=0;
    model.parent!.updateWorldMatrix(true,false);
    model.parent!.updateMatrixWorld(true);
    inverse.copy(model.parent!.matrixWorld).invert();
    let bottom=Infinity;
    for(const {mesh,indices} of soles)for(const index of indices){
      mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      bottom=Math.min(bottom,point.y);
    }
    // The chibi legs are shorter than a chair; seated, the thighs rest on the seat and the feet dangle.
    let seatLift=-bottom;
    if(sit>.001&&hips){hips.getWorldPosition(point).applyMatrix4(inverse);seatLift=seatHeight-point.y;}
    // A treadmill deck or stage lifts the character without changing the walking floor.
    model.position.y=THREE.MathUtils.lerp(-bottom,seatLift,sit)+(pose.lift??0);
  };
}
