import test from 'node:test';
import assert from 'node:assert/strict';
import {stairs,stairPoint,floorRise,portals,courtDrop,groundHeight,stairEntry,boundaryWalls,northStairHall,northExitHall,northDutyRoom,diningStairs,courtRamp,planRect} from '../src/school-structure.ts';
import {moveSchoolVisitor,moveInSchool,findSchoolPath,type VisitorPosition} from '../src/school-navigation.ts';
import {floorSpawn,places} from '../src/school-layout.ts';
const open=new Set(portals.map(p=>p.id));
function walk(p:VisitorPosition,x:number,z:number) {
  const n=Math.ceil(Math.hypot(x-p.x,z-p.z)/.03),start={...p};
  for(let i=0;i<n;i++){
    const previous=p;p=moveSchoolVisitor(p,{x:(x-start.x)/n,z:(z-start.z)/n},'floor1',open);
    assert.ok(Math.abs(p.y-previous.y)<.04,'Height must change continuously');
  }
  assert.ok(Math.hypot(p.x-x,p.z-z)<.001,`Stopped at ${JSON.stringify(p)}, target ${x},${z}`);
  return p;
}
test('six marked stair locations include four vertical cores and two outdoor descents',()=>{
  assert.equal(stairs.length,4);
  const central=stairs.find(s=>s.id==='stairs-central');assert.ok(central,'Central lobby stair 5 must exist');
  assert.deepEqual(central.rect,planRect(37.5,33.6,4.5,7.5));
  const entry=stairEntry(central);assert.ok(entry.z>central.rect.maxZ,'Entrance faces the central lobby');
  const a=stairPoint(central,1.2,3.1),b=stairPoint(central,4.6,3.1);
  assert.ok(b.z<a.z&&Math.abs(a.x-b.x)<1e-8,'Central flight ascends north');
  assert.deepEqual(diningStairs,planRect(1.5,8.1,3,3));
  assert.deepEqual(courtRamp,planRect(32.25,41.1,2.25,4.5));
});

test('four stairs reach every landing from 1F to 5F and return without a height jump',()=>{
  for(const stair of stairs){
    const a=stairPoint(stair,.6,3.1),b=stairPoint(stair,5.2,3.1),c=stairPoint(stair,5.2,.9),d=stairPoint(stair,.6,.9);
    let p={...a,y:0};
    for(let floor=1;floor<5;floor++){
      p=walk(p,b.x,b.z);p=walk(p,c.x,c.z);p=walk(p,d.x,d.z);
      assert.ok(Math.abs(p.y-floor*floorRise)<1e-6,stair.id);
      p=walk(p,a.x,a.z);
    }
    const outside=stairPoint(stair,-5,3.1),edge=moveSchoolVisitor(p,{x:outside.x-p.x,z:outside.z-p.z},'floor1',open);
    assert.ok(Math.abs(edge.y-14.4)<1e-6,'Leaving an upper landing must preserve the connected floor height');
    for(let floor=4;floor>0;floor--){
      p=walk(p,d.x,d.z);p=walk(p,c.x,c.z);p=walk(p,b.x,b.z);p=walk(p,a.x,a.z);
      assert.ok(Math.abs(p.y-(floor-1)*floorRise)<1e-6);
    }
  }
});
test('all four stairs can be entered from and exited to the first-floor corridor',()=>{
  for(const stair of stairs){
    const entry=stairEntry(stair),landing=stairPoint(stair,.6,3.1);
    assert.ok(findSchoolPath(floorSpawn,entry,'floor1',new Set()).length,stair.id);
    let p=walk({...entry,y:0},landing.x,landing.z);
    p=walk(p,entry.x,entry.z);assert.equal(p.y,0);
  }
});
test('marked glass doors block closed and allow passage open',()=>{
  for(const door of portals){
    const a=door.axis==='x'?{x:door.at+.6,z:door.center}:{x:door.center,z:door.at+.6};
    const d=door.axis==='x'?{x:-1.2,z:0}:{x:0,z:-1.2};
    assert.deepEqual(moveInSchool(a,d,'floor1',new Set()),a,door.id);
    const b=moveInSchool(a,d,'floor1',open);
    assert.ok(Math.hypot(b.x-a.x,b.z-a.z)>1,door.id);
  }
});
test('piloti cannot be entered around the side of a closed exit or via the stair landing',()=>{
  const shop=places.find(p=>p.id==='shop')!.approach;
  assert.deepEqual(findSchoolPath(floorSpawn,shop,'floor1',new Set()),[]);
  for(const id of ['east-parking-door','north-parking-door','north-secondary-parking-door'])
    assert.ok(findSchoolPath(floorSpawn,shop,'floor1',new Set([id])).length,id);
});
test('A-202 north entrance cluster follows the annotated grid and has independent dining doors',()=>{
  const main=portals.find(p=>p.id==='dining-door')!,side=portals.find(p=>p.id==='dining-side-door')!;
  const north=stairs.find(s=>s.id==='stairs-north')!,duty=places.find(p=>p.id==='night-duty')!;
  assert.ok(Math.abs(northStairHall.maxX-northStairHall.minX-7.5)<1e-8);
  assert.ok(Math.abs(north.rect.maxX-north.rect.minX-5.3)<1e-8&&Math.abs(north.rect.maxZ-north.rect.minZ-4.8)<1e-8);
  assert.ok(north.rect.maxZ<northExitHall.minZ&&northExitHall.maxZ<=northDutyRoom.minZ);
  assert.equal(duty.name,'당직실');
  for(const key of ['minX','maxX','minZ','maxZ'] as const)assert.ok(Math.abs(duty.rect[key]-northDutyRoom[key])<1e-8);
  assert.equal(main.axis,'x');assert.equal(side.axis,'z');assert.ok(side.at<main.center);
  for(const door of [main,side]) {
    const inside=door===main?{x:door.at-.8,z:door.center}:{x:door.center,z:door.at-.8};
    assert.equal(findSchoolPath(floorSpawn,inside,'floor1',new Set()).length,0);
    assert.ok(findSchoolPath(floorSpawn,inside,'floor1',new Set([door.id])).length,door.id);
    assert.ok(findSchoolPath(inside,{x:0,z:-20},'floor1',new Set([door.id])).length,'Both doors enter the dining hall');
  }
  for(const door of portals.filter(p=>p.id.startsWith('north-'))) {
    assert.equal(door.double,true);assert.equal(door.width,2);
    assert.ok(door.center>northStairHall.maxZ&&door.center<northDutyRoom.minZ);
    const outside={x:door.at+1,z:door.center},closed=new Set<string>(),opened=new Set([door.id]);
    assert.deepEqual(moveInSchool(door.approach,{x:2,z:0},'floor1',closed),door.approach);
    assert.deepEqual(moveInSchool(door.approach,{x:2,z:0},'floor1',opened),outside);
    assert.deepEqual(moveInSchool(outside,{x:-2,z:0},'campus',opened),door.approach);
  }
});
test('east parking exit faces west and the first stair flight follows its right-hand wall',()=>{
  const stair=stairs.find(s=>s.id==='stairs-east')!,door=portals.find(p=>p.id==='east-parking-door')!;
  assert.equal(door.name,'동편 주차장 출입문');
  assert.equal(door.axis,'x','The door must be on the west wall the visitor faces');
  assert.ok(door.at<stair.rect.minX&&door.center>stair.rect.minZ&&door.center<stair.rect.maxZ);
  const bottom=stairPoint(stair,1.2,3.1),top=stairPoint(stair,4.6,3.1);
  assert.ok(top.x<bottom.x&&Math.abs(top.z-bottom.z)<1e-8&&bottom.z<door.center,'First flight rises west along the north/right-hand wall');
  const start={x:30.6,z:6.55};
  assert.deepEqual(moveInSchool(start,{x:0,z:-2},'floor1',open),start,'Old opening must remain closed even with all doors open');
  assert.ok(findSchoolPath(floorSpawn,door.approach,'floor1',new Set()).length);
  const parking={x:door.at-.7,z:door.center};
  assert.deepEqual(findSchoolPath(door.approach,parking,'floor1',new Set()),[]);
  assert.ok(findSchoolPath(door.approach,parking,'floor1',new Set([door.id])).length);
  const previousExit={x:33.9,z:2.05};
  assert.deepEqual(moveInSchool(previousExit,{x:0,z:-2},'floor1',open),previousExit,'The mistaken north-wall doorway must be sealed');
});
test('court stairs descend ten risers and return through the designated entrance',()=>{
  let p={x:-3.5,z:7.8,y:0};
  p=walk(p,-16,7.8);assert.ok(Math.abs(p.y+courtDrop)<1e-6);
  p=walk(p,-3.5,7.8);assert.ok(Math.abs(p.y)<1e-6);
  const a={x:-20,z:11.4};assert.deepEqual(moveInSchool(a,{x:0,z:-3},'floor1',open),a);
  assert.ok(Math.abs(groundHeight({x:-20,z:8})+1.8)<1e-8);
});
test('elevator and piloti partitions block crossing, with reachable stair approaches',()=>{
  for(const [a,d] of [[{x:17,z:3},{x:2,z:0}],[{x:23,z:6.7},{x:0,z:-2}],[{x:39,z:2.2},{x:0,z:-2}]] as const)
    assert.deepEqual(moveInSchool(a,d,'floor1',open),a);
  for(const stair of stairs)assert.ok(findSchoolPath(floorSpawn,stairEntry(stair),'floor1',open).length,stair.id);
  assert.ok(boundaryWalls.length>=8);
});
