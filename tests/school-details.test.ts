import test from 'node:test';
import assert from 'node:assert/strict';
import {places,restroomFixtures,schoolResidents,residentObstacles} from '../src/school-layout.ts';
import {portals} from '../src/school-structure.ts';
import {moveInSchool,isWalkable} from '../src/school-navigation.ts';
import {upperRooms,upperResidents} from '../src/school-upper-floors.ts';

test('north parking exits share one sign and cafeteria side door is steel',()=>{
  const north=portals.filter(p=>p.id==='north-parking-door'||p.id==='north-secondary-parking-door');
  assert.equal(north.length,2);
  assert.equal(north.filter(p=>!p.hideSign).length,1);
  assert.ok(north.every(p=>p.name==='북편 주차장 출입문'));
  const side=portals.find(p=>p.id==='dining-side-door')!;
  assert.equal(side.name,'급식실 측문');assert.equal(side.steel,true);
  // Renaming a portal must not turn its approach into a solid service room.
  const p=moveInSchool({x:side.center,z:side.at+.5},{x:0,z:-.8},'floor1',new Set(portals.map(p=>p.id)));
  assert.ok(p.z<side.at,'Opened steel door must remain traversable');
});

test('each first-floor restroom has exactly one sink and one toilet inside its walls',()=>{
  for(const place of places.filter(p=>/화장실/.test(p.name))) {
    const fixtures=restroomFixtures.filter(f=>f.roomId===place.id);
    assert.deepEqual(fixtures.map(f=>f.model).sort(),['restroom-sink','restroom-toilet']);
    for(const f of fixtures)assert.ok(f.x-.32>place.rect.minX&&f.x+.32<place.rect.maxX&&f.z-.35>place.rect.minZ&&f.z+.45<place.rect.maxZ);
  }
  assert.equal(schoolResidents.length,4);assert.equal(residentObstacles.length,4);
  for(const resident of schoolResidents.filter(p=>!p.outside)) {
    const r=places.find(p=>p.id===resident.roomId)!.rect;
    assert.ok(resident.x>r.minX&&resident.x<r.maxX&&resident.z>r.minZ&&resident.z<r.maxZ);
  }
});

test('principal welcomes visitors at the gate as well as in his office, and vice principal stays upstairs',()=>{
  const principals=schoolResidents.filter(p=>p.model==='principal-resident');
  assert.equal(principals.length,2);
  assert.ok(principals.some(p=>p.roomId==='principal'&&!p.outside));
  const welcome=principals.find(p=>p.outside)!;
  assert.ok(welcome.x>42&&welcome.x<49&&welcome.z>21&&welcome.z<28);
  const vice=upperResidents.find(p=>p.model==='vice-principal-resident')!;
  const office=upperRooms.find(p=>p.id===vice.roomId)!;
  assert.equal(vice.floor,2);assert.equal(office.name,'교무실');
  assert.ok(vice.x>office.rect.minX+.5&&vice.x<office.rect.maxX-.5&&vice.z>office.rect.minZ+.5&&vice.z<office.rect.maxZ-.5);
  assert.ok(isWalkable({x:vice.x-1,z:vice.z},'floor1',new Set([office.id]),2),'The approach to the vice principal must be walkable');
  const blocked=moveInSchool({x:vice.x-1,z:vice.z},{x:1,z:0},'floor1',new Set([office.id]),2);
  assert.ok(blocked.x<vice.x-.4,'The second-floor NPC must have a collision boundary');
  const gate=moveInSchool({x:50,z:25},{x:-3,z:0},'campus',new Set());
  assert.ok(gate.x<48,'Welcoming principal must not obstruct the gate approach');
});
