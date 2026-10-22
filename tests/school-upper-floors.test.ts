import test from 'node:test';
import assert from 'node:assert/strict';
import {upperRooms,upperFurniture,upperFloorSurface} from '../src/school-upper-floors.ts';
import {stairs,stairPoint,floorRise,portals,courtRect,courtAccess} from '../src/school-structure.ts';
import {findSchoolPath,isWalkable,moveSchoolVisitor,moveInSchool} from '../src/school-navigation.ts';
const open=new Set([...upperRooms.map(r=>r.id),...portals.map(p=>p.id)]);

test('court-facing upper corridor windows cannot be crossed or used to drop downstairs',()=>{
  for(const floor of [2,3,4,5])for(let x=courtRect.minX+.5;x<courtAccess.maxX;x+=1) {
    let p={x,z:courtRect.maxZ+1,y:(floor-1)*floorRise};
    assert.ok(isWalkable(p,'floor1',open,floor));
    for(let i=0;i<40;i++)p=moveSchoolVisitor(p,{x:0,z:-.1},'floor1',open);
    assert.ok(p.z>courtRect.maxZ,'Visitor stays on the corridor side of the window');
    assert.equal(p.y,(floor-1)*floorRise,'Looking outside does not change the floor');
  }
});
test('every upper-floor room has a reachable doorway and furniture inside its walls',()=>{
  for(const floor of [2,3,4,5]) {
    const start={x:-33.8,z:11.4};
    assert.ok(isWalkable(start,'floor1',open,floor));
    for(const room of upperRooms.filter(r=>r.floor===floor)) {
      assert.ok(isWalkable(room.approach,'floor1',open,floor),`${floor}F ${room.name} approach ${JSON.stringify(room.approach)}`);
      assert.ok(findSchoolPath(start,room.approach,'floor1',open,floor).length,`${floor}F ${room.name} disconnected`);
      const r=room.rect;
      for(const f of upperFurniture.filter(f=>f.roomId===room.id))assert.ok(f.rect.minX>r.minX&&f.rect.maxX<r.maxX&&f.rect.minZ>r.minZ&&f.rect.maxZ<r.maxZ,`${floor}F ${room.name} furniture outside`);
      const inside={x:room.door.x+(room.axis==='x'?(room.door.x<room.approach.x?-1:1):0),z:room.door.z+(room.axis==='z'?(room.door.z<room.approach.z?-1:1):0)};
      const delta={x:inside.x-room.approach.x,z:inside.z-room.approach.z};
      assert.notDeepEqual(moveInSchool(room.approach,delta,'floor1',open,floor),room.approach,`${room.name} opened door blocked`);
      const closed=new Set(open);closed.delete(room.id);
      assert.deepEqual(moveInSchool(room.approach,delta,'floor1',closed,floor),room.approach,`${room.name} closed door passable`);
    }
  }
});
test('all four stair landings connect to each upper floor without a height jump',()=>{
  for(const stair of stairs)for(const floor of [2,3,4,5]) {
    const start=stairPoint(stair,.6,stair.id==='stairs-east'?.9:3.1);
    const target=stair.id==='stairs-east'?{x:start.x,z:5.9}:stair.id==='stairs-central'?{x:start.x,z:6.6}:stair.id==='stairs-west'?{x:start.x,z:11.4}:{x:2.9,z:start.z};
    let p={...start,y:(floor-1)*floorRise};
    const delta={x:(target.x-p.x)/100,z:(target.z-p.z)/100};
    for(let i=0;i<100;i++)p=moveSchoolVisitor(p,delta,'floor1',open);
    assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.01,`${floor}F ${stair.id}: ${JSON.stringify(p)}`);
    assert.equal(p.y,(floor-1)*floorRise);
    const back={x:(start.x-p.x)/100,z:(start.z-p.z)/100};
    for(let i=0;i<100;i++)p=moveSchoolVisitor(p,back,'floor1',open);
    assert.ok(Math.hypot(p.x-start.x,p.z-start.z)<.01,'Can return to the stairs');
  }
});
test('classrooms keep 67.5 square metre modules and the gym upper void stays open',()=>{
  for(const room of upperRooms.filter(r=>/^\d-\d/.test(r.name)))assert.ok(Math.abs((room.rect.maxX-room.rect.minX)*(room.rect.maxZ-room.rect.minZ)-67.5)<.001);
  assert.ok(upperFloorSurface({x:-15,z:-15},4));
  assert.ok(!upperFloorSurface({x:-15,z:-15},5));
  assert.ok(!isWalkable({x:20,z:-10},'floor1',open,3),'No floor across the courtyard');
});
