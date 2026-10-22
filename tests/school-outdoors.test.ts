import test from 'node:test';
import assert from 'node:assert/strict';
import {gateSpawn,places,parkingColumns,campusBounds,showCampusCutaway} from '../src/school-layout.ts';
import {portals,courtRect,courtDrop,diningStairs,diningHall,diningTables} from '../src/school-structure.ts';
import {fieldStairs,fieldDrop,campusHeight,parkedCars,campusEntrancePoint,canInteractFromCampus,recyclingObstacles,gardenBeds,campusFences,insideCampusBoundary} from '../src/school-outdoors.ts';
import {findSchoolPath,isWalkable,moveSchoolVisitor,moveInSchool} from '../src/school-navigation.ts';
const closed=new Set<string>();

test('court doorway remains walkable when each small step switches between indoor and outdoor modes',()=>{
  const open=new Set(['court-door']),door=portals.find(p=>p.id==='court-door')!;
  for(const step of [.025,.13])for(const z of [7.3,7.8,8.3]) {
    let p={x:door.at+1,z,y:0},mode:'floor1'|'campus'='floor1';
    for(const direction of [-1,1]) {
      for(let i=0;i<Math.ceil(3/step);i++) {
        const before=p;
        p=moveSchoolVisitor(p,{x:direction*step,z:0},mode,open);
        assert.notEqual(p.x,before.x,`Stuck at ${JSON.stringify(p)} in ${mode}`);
        if((before.x>door.at)!==(p.x>door.at))mode=p.x>door.at?'floor1':'campus';
        assert.ok(isWalkable(p,mode,open),'The new mode must accept the doorway position');
      }
      assert.equal(mode,direction<0?'campus':'floor1');
    }
    assert.ok(Math.abs(p.x-(door.at+1))<1e-7);
    assert.equal(p.y,0);
  }
  const outside={x:door.at-1,z:door.center};
  assert.deepEqual(moveInSchool(outside,{x:2,z:0},'campus',closed),outside,'A closed door still blocks entry');
  for(const z of [door.center-1.1,door.center+1.1]) {
    const wall={x:door.at-1,z};
    assert.deepEqual(moveInSchool(wall,{x:2,z:0},'campus',open),wall,'Adjacent walls remain solid');
  }
});

test('east piloti ends at the measured stair wall and the entrance follows the recessed facade',()=>{
  const stair=places.find(p=>p.id==='stairs-east')!.rect,entry=places.find(p=>p.id==='east-passage')!.rect;
  assert.ok(Math.abs(stair.minZ-1.05)<1e-8,'East stair starts on the 36.6 m reference line');
  assert.ok(Math.abs(entry.maxZ-15.75)<1e-8);
  assert.deepEqual(campusEntrancePoint('east-passage'),{x:38.25,z:16.95});
  assert.ok(parkingColumns.some(p=>Math.abs(p.x-40.5)<1e-8&&Math.abs(p.z-1.05)<1e-8),'The entrance column meets the east stair boundary');
  for(const x of [33,36,39.8]) {
    const outside={x,z:.35};
    assert.ok(isWalkable(outside,'campus',closed),'The piloti approach north of the stair remains open');
    assert.deepEqual(moveInSchool(outside,{x:0,z:2},'campus',closed),outside,'There is a stair wall, not a shortcut through the building');
  }
  for(const goal of [{x:38,z:18},{x:42,z:10},{x:41.7,z:.35},{x:39.8,z:.35}])
    assert.ok(findSchoolPath(gateSpawn,goal,'campus',closed).length,'The actual route around the east wall stays connected');
});

test('all east side windows are solid and cannot activate the front entrance from the side',()=>{
  for(const z of [7,10,14,15.3]) {
    const outside={x:41,z},inside={x:38.5,z};
    assert.equal(isWalkable(inside,'campus',closed),false,`Window interior at z=${z}`);
    assert.deepEqual(moveInSchool(outside,{x:-2.5,z:0},'campus',closed),outside);
    assert.equal(canInteractFromCampus('east-passage',outside),false);
  }
  assert.equal(canInteractFromCampus('east-passage',{x:41,z:15.3}),false);
  for(const z of [17.5,19.7])assert.equal(isWalkable({x:38.5,z},'campus',closed),true,'The obsolete facade must not block the measured front apron');
  assert.equal(canInteractFromCampus('library',{x:43,z:17}),false);
  for(const id of ['entrance','east-passage','west-entrance'])assert.equal(canInteractFromCampus(id,campusEntrancePoint(id)),true);
});

test('the outside east road keeps the exterior visible before and after an entrance round trip',()=>{
  for(let pass=0;pass<2;pass++)for(const z of [25,21,19,17,10,3,0,-5,-20]) {
    assert.equal(showCampusCutaway({x:43,z}),false,`The road is outside at z=${z}`);
  }
  assert.equal(showCampusCutaway({x:39.8,z:17}),false);
  assert.equal(showCampusCutaway({x:37,z:-6}),true,'Inside the piloti parking area remains visible');
  assert.equal(showCampusCutaway({x:5.6,z:-9.1}),true);
  assert.equal(showCampusCutaway({x:-20,z:3}),true);
});

test('the visible east entrance facade blocks side and corner crossings without closing the parking route',()=>{
  const outside={x:41.2,z:14.8},inside={x:39.2,z:14.8};
  assert.ok(isWalkable(outside,'campus',closed));
  assert.equal(isWalkable(inside,'campus',closed),false,'The visible facade interior is solid');
  assert.deepEqual(moveInSchool(outside,{x:-2,z:0},'campus',closed),outside);
  const walked=moveSchoolVisitor({...outside,y:0},{x:-2,z:0},'campus',closed);
  assert.ok(walked.x>40.5,'Continuous movement stops outside the visible side wall');
  const corner={x:41.2,z:16.6};
  assert.deepEqual(moveInSchool(corner,{x:-2,z:-2},'campus',closed),corner);
  assert.equal(findSchoolPath(outside,inside,'campus',closed).length,0);
  for(const goal of [campusEntrancePoint('east-passage'),{x:43,z:10},{x:37,z:-6}])assert.ok(findSchoolPath(gateSpawn,goal,'campus',closed).length);
  assert.ok(isWalkable(places.find(p=>p.id==='east-passage')!.approach,'floor1',closed),'The entrance interaction still arrives on a valid indoor floor');
});

test('the perimeter fence blocks road crossings while preserving the gate and every school destination',()=>{
  assert.ok(campusFences.length>=6);
  for(const fence of campusFences) {
    const center={x:(fence.minX+fence.maxX)/2,z:(fence.minZ+fence.maxZ)/2};
    assert.equal(isWalkable(center,'campus',closed),false);
    const dx=fence.maxX-fence.minX,dz=fence.maxZ-fence.minZ;
    const crossings=[.25,.5,.75].flatMap(t=>[-1,1].map(sign=>({
      start:{x:dx<dz?center.x+sign*.7:fence.minX+dx*t,z:dx<dz?fence.minZ+dz*t:center.z+sign*.7},
      delta:{x:dx<dz?-sign*1.4:0,z:dx<dz?0:-sign*1.4},
    })));
    const crossing=crossings.find(c=>insideCampusBoundary(c.start)&&isWalkable(c.start,'campus',closed));
    assert.ok(crossing,'Each fence is checked from a walkable inside point');
    assert.deepEqual(moveInSchool(crossing.start,crossing.delta,'campus',closed),crossing.start);
  }
  assert.equal(insideCampusBoundary({x:52,z:0}),false);
  assert.equal(isWalkable({x:52,z:0},'campus',closed),false);
  assert.equal(isWalkable({x:52,z:25},'campus',closed),true,'The gate remains open to its short outside approach');
  for(const goal of [{x:34.5,z:-23},{x:44,z:-28},{x:6.5,z:-15.05},{x:0,z:90},{x:40,z:95}])assert.ok(findSchoolPath(gateSpawn,goal,'campus',closed).length,JSON.stringify(goal));
});

test('open school grounds are walkable beyond the former parking route strips',()=>{
  for(const goal of [{x:10,z:-20},{x:20,z:-20},{x:20,z:-30},{x:26,z:-15},{x:12,z:-6},{x:48,z:0},{x:-42,z:0},{x:-30,z:-2.8}]) {
    assert.ok(isWalkable(goal,'campus',closed),`Open ground blocked at ${JSON.stringify(goal)}`);
    assert.ok(findSchoolPath(gateSpawn,goal,'campus',closed).length,`No connected route to ${JSON.stringify(goal)}`);
  }
});

test('expanded grounds still respect pillars, bins, flower beds, buildings and the outer boundary',()=>{
  for(const p of [...parkingColumns,...[...recyclingObstacles,...gardenBeds].map(r=>({x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2}))])assert.equal(isWalkable(p,'campus',closed),false);
  for(const p of [{x:0,z:-20},{x:0,z:18},{x:campusBounds.maxX+.1,z:0},{x:campusBounds.minX-.1,z:0}])assert.equal(isWalkable(p,'campus',closed),false);
  const shop=places.find(p=>p.id==='shop')!;
  const inside={x:shop.door.x,z:shop.door.z-.8};
  assert.equal(findSchoolPath(shop.approach,inside,'campus',closed).length,0);
  assert.ok(findSchoolPath(shop.approach,inside,'campus',new Set(['shop'])).length);
});

test('parking connects through the north door to dining and the basketball stairs in both directions',()=>{
  const open=new Set(['north-parking-door','court-door']);
  const north=portals.find(p=>p.id==='north-parking-door')!,court=portals.find(p=>p.id==='court-door')!;
  const outside={x:north.at+1,z:north.center};
  assert.ok(findSchoolPath(gateSpawn,outside,'campus',closed).length);
  const inside=moveSchoolVisitor({...outside,y:0},{x:-2,z:0},'campus',open);
  assert.ok(Math.abs(inside.x-north.approach.x)<1e-8);
  for(const destination of [portals.find(p=>p.id==='dining-door')!.approach,court.approach])assert.ok(findSchoolPath(inside,destination,'floor1',open).length);
  let p=moveSchoolVisitor({...court.approach,y:0},{x:-2,z:0},'floor1',open);
  const start={...p};
  for(let i=0;i<300;i++)p=moveSchoolVisitor(p,{x:-.05,z:0},'campus',open);
  assert.ok(p.x<courtRect.maxX&&p.x>courtRect.minX);
  assert.ok(Math.abs(p.y+courtDrop)<1e-8);
  for(let i=0;i<300;i++)p=moveSchoolVisitor(p,{x:.05,z:0},'campus',open);
  assert.ok(Math.hypot(p.x-start.x,p.z-start.z,p.y)<1e-7);
  const returned=moveSchoolVisitor(p,{x:2,z:0},'campus',open);
  assert.ok(isWalkable(returned,'floor1',open));
  const edge={x:-20,z:courtRect.minZ-.5,y:-courtDrop};
  assert.ok(moveSchoolVisitor(edge,{x:0,z:2},'campus',open).z>courtRect.minZ);
  assert.equal(moveInSchool(edge,{x:0,z:2},'campus',open).z,edge.z+2,'The outside ground meets the court without a retaining edge');
});
test('gate side approach slopes continuously to the basketball court without using a door',()=>{
  const route=[gateSpawn,{x:47,z:25},{x:47,z:28},{x:-42,z:28},{x:-42,z:-2.8},{x:-20,z:-2.8},{x:-20,z:3}];
  let p={...route[0],y:campusHeight(route[0])};
  for(const target of route.slice(1)) {
    const next=moveSchoolVisitor(p,{x:target.x-p.x,z:target.z-p.z},'campus',closed);
    assert.ok(Math.hypot(next.x-target.x,next.z-target.z)<1e-6,JSON.stringify({p,target,next}));p=next;
  }
  assert.equal(p.y,-courtDrop);
  for(const target of route.slice(0,-1).reverse())p=moveSchoolVisitor(p,{x:target.x-p.x,z:target.z-p.z},'campus',closed);
  assert.ok(Math.hypot(p.x-gateSpawn.x,p.z-gateSpawn.z,p.y)<1e-6);
});
test('west dining stairs reach a closed door, then connect through the dining hall to the corridor',()=>{
  const z=portals.find(p=>p.id==='dining-exit')!.center;
  const start={x:diningStairs.minX-.5,z,y:-courtDrop},outside={x:-35.1,z};
  assert.ok(findSchoolPath(gateSpawn,start,'campus',closed).length);
  let p=moveSchoolVisitor(start,{x:outside.x-start.x,z:0},'campus',closed);
  assert.ok(Math.abs(p.x-outside.x)<1e-6&&Math.abs(p.y)<1e-6);
  assert.ok(moveSchoolVisitor(p,{x:1.6,z:0},'campus',closed).x<diningHall.minX);
  const open=new Set(['dining-exit','dining-door']);
  p=moveSchoolVisitor(p,{x:1.6,z:0},'campus',open);
  assert.ok(p.x>diningHall.minX&&isWalkable(p,'floor1',open));
  const entrance=portals.find(d=>d.id==='dining-door')!.approach;
  for(const destination of [entrance,outside]) {
    const path=findSchoolPath(p,destination,'floor1',open);
    assert.ok(path.length,'Offset doors connect through the dining aisle');
    for(const target of path)p=moveSchoolVisitor(p,{x:target.x-p.x,z:target.z-p.z},'floor1',open);
    assert.ok(Math.hypot(p.x-destination.x,p.z-destination.z)<1e-6);
  }
  p=moveSchoolVisitor(p,{x:start.x-p.x,z:0},'campus',open);
  assert.ok(Math.abs(p.x-start.x)<1e-6&&Math.abs(p.y+courtDrop)<1e-6);
  for(const r of diningTables)assert.equal(isWalkable({x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2},'floor1',open),false);
  assert.equal(isWalkable({x:-20,z:-25},'floor1',open),false,'Unverified kitchen stays closed');
});
test('gate side road reaches the full parking lot, shop, recycling, garden and north door',()=>{
  for(const goal of [{x:43,z:10},{x:37,z:-6},{x:34.5,z:-23},{x:44,z:-28},{x:45,z:-30},{x:6.5,z:-15.05}]) {
    const path=findSchoolPath(gateSpawn,goal,'campus',closed);
    assert.ok(path.length,`No outdoor route to ${JSON.stringify(goal)}`);
    for(let i=1;i<path.length;i++){
      const moved=moveInSchool(path[i-1],{x:path[i].x-path[i-1].x,z:path[i].z-path[i-1].z},'campus',closed);
      assert.ok(Math.hypot(moved.x-path[i].x,moved.z-path[i].z)<1e-8);
    }
  }
});
test('three field stairs descend and return continuously, while the ledge cannot be crossed',()=>{
  assert.equal(fieldStairs.length,3);
  for(const r of fieldStairs) {
    const x=(r.minX+r.maxX)/2;
    let p={x,z:r.minZ-.35,y:0};
    for(let i=0;i<540;i++)p=moveSchoolVisitor(p,{x:0,z:.01},'campus',closed);
    assert.ok(p.z>r.maxZ&&Math.abs(p.y+fieldDrop)<1e-7);
    for(let i=0;i<540;i++)p=moveSchoolVisitor(p,{x:0,z:-.01},'campus',closed);
    assert.ok(Math.abs(p.y)<1e-7&&Math.abs(p.z-(r.minZ-.35))<1e-6);
  }
  const p={x:20,z:29,y:0},next=moveSchoolVisitor(p,{x:0,z:8},'campus',closed);
  assert.ok(next.z<29.51&&next.y===0,'A visitor cannot jump down the retaining wall');
  assert.equal(campusHeight({x:20,z:40}),-fieldDrop);
});

test('both field-side ramps connect the forecourt and lower field without a height jump',()=>{
  for(const x of [-42.5,44.5]) {
    let p={x,z:29,y:0};
    for(const direction of [1,-1]) {
      for(let i=0;i<120;i++) {
        const before=p;p=moveSchoolVisitor(p,{x:0,z:direction*.05},'campus',closed);
        assert.ok(Math.abs(p.z-before.z-direction*.05)<1e-7,`Ramp blocked at ${JSON.stringify(p)}`);
        assert.ok(Math.abs(p.y-before.y)<.03,'Ramp must change height continuously');
      }
      assert.ok(Math.abs(p.y-(direction===1?-fieldDrop:0))<1e-7);
    }
    const bottom={x,z:35,y:-fieldDrop};
    const field=moveSchoolVisitor(bottom,{x:x<0?6:-6,z:0},'campus',closed);
    assert.ok(Math.abs(field.x-(x+(x<0?6:-6)))<1e-7,'Ramp landing connects sideways to the field');
    assert.equal(field.y,-fieldDrop);
  }
});
test('parked cars block movement and all three front entrances have reachable thresholds',()=>{
  for(const car of parkedCars)assert.equal(isWalkable(car,'campus',closed),false);
  for(const id of ['entrance','west-entrance','east-passage']) {
    const goal=campusEntrancePoint(id);
    assert.ok(findSchoolPath(gateSpawn,goal,'campus',closed).length,id);
    assert.ok(isWalkable(places.find(p=>p.id===id)!.approach,'floor1',closed),id);
  }
});
test('parking doors block direct crossing closed and connect outdoor and corridor sides open',()=>{
  for(const door of portals.filter(p=>p.id.endsWith('parking-door'))) {
    const sign=door.id==='east-parking-door'?1:-1;
    const outside={x:door.at-sign*.6,z:door.center,y:0},inside={x:door.at+sign*.6,z:door.center};
    assert.ok(isWalkable(outside,'campus',closed));
    assert.ok(Math.abs(moveSchoolVisitor(outside,{x:sign*1.2,z:0},'campus',closed).x-outside.x)<.5);
    const crossed=moveSchoolVisitor(outside,{x:sign*1.2,z:0},'campus',new Set([door.id]));
    assert.ok(Math.abs(crossed.x-inside.x)<1e-7,door.id);
    assert.ok(isWalkable(inside,'floor1',new Set([door.id])),door.id);
  }
});
