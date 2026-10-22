import test from 'node:test';
import assert from 'node:assert/strict';
import {floorData} from '../src/school-floor-data.ts';
import {planFloorData,planAspectRatios,schematicPlanFloorData} from '../src/school-plan-data.ts';
import {cellRect,places,furnishings,bookReturn,securityBooth,floorSpawn,campusSpawn,campusGate,gateSpawn,campusBounds,schoolBounds,doorWidth,wallThickness,characterRadius,type Point} from '../src/school-layout.ts';
import {isWalkable,moveInSchool,findSchoolPath,advanceSchoolRoute,schoolInputDirection} from '../src/school-navigation.ts';
import {portals} from '../src/school-structure.ts';
import {campusEntrancePoint} from '../src/school-outdoors.ts';

const closed=new Set<string>();
const passageDoors=new Set(portals.map(p=>p.id));
test('central lobby exit is reached at the south floor sign rather than the middle mat',()=>{
  const lobby=places.find(p=>p.id==='entrance')!,middle={x:(lobby.rect.minX+lobby.rect.maxX)/2,z:(lobby.rect.minZ+lobby.rect.maxZ)/2};
  assert.ok(Math.abs(lobby.approach.x-middle.x)<1e-8);
  assert.ok(Math.abs(lobby.approach.z-(lobby.rect.maxZ-1.2))<1e-8,'Interaction must align with the labelled exit box');
  assert.ok(Math.hypot(middle.x-lobby.approach.x,middle.z-lobby.approach.z)>4.2,'The central mat must not trigger the exit');
  assert.ok(findSchoolPath(floorSpawn,lobby.approach,'floor1',closed).length);
});
test('first-floor corridors and south rooms use the architectural drawing dimensions',()=>{
  for(const cell of planFloorData[1].filter(c=>c.name==='복도')) {
    const rect=cellRect(cell);
    assert.ok(Math.abs(rect.maxZ-rect.minZ-2.7)<1e-6,'Main corridor dimension must be 2.7 m');
  }
  for(const id of ['individual','principal','admin','open-library','library']) {
    const rect=places.find(p=>p.id===id)!.rect;
    assert.ok(Math.abs(rect.maxZ-rect.minZ-7.5)<1e-6,`${id} room depth must be 7.5 m`);
  }
  const west=places.find(p=>p.id==='admin')!.rect,east=places.find(p=>p.id==='open-library')!.rect;
  assert.ok(Math.abs(west.minZ-east.minZ-4.5)<1e-6,'The east room row must be set back 4.5 m');
  assert.ok(Math.abs(schoolBounds.maxZ-schoolBounds.minZ-55.8)<1e-6,'The structural depth must be 55.8 m');
});
test('diagonal controls follow the school walls without lateral drift',()=>{
  for(const [x,y,expectedX,expectedZ] of [[1,1,1,0],[-1,-1,-1,0],[1,-1,0,-1],[-1,1,0,1]]) {
    const direction=schoolInputDirection(x,y);
    assert.ok(Math.abs(direction.x-expectedX)<1e-12,`input ${x},${y}: x=${direction.x}`);
    assert.ok(Math.abs(direction.z-expectedZ)<1e-12,`input ${x},${y}: z=${direction.z}`);
  }
  assert.deepEqual(schoolInputDirection(0,0),{x:0,z:0});
  for(const [x,y] of [[1,0],[0,1],[-1,0],[0,-1],[.3,.7]])assert.ok(Math.abs(Math.hypot(...Object.values(schoolInputDirection(x,y)))-1)<1e-12);
  const corridor=cellRect(planFloorData[1].find(c=>c.name==='복도'&&c.col>20)!);
  const start={x:corridor.minX+2,z:(corridor.minZ+corridor.maxZ)/2};
  const direction=schoolInputDirection(1,1);
  let position=start;
  for(let i=0;i<120;i++)position=moveInSchool(position,{x:direction.x*5.2/60,z:direction.z*5.2/60},'floor1',closed);
  assert.ok(Math.abs(position.x-start.x-10.4)<1e-9);
  assert.ok(Math.abs(position.z-start.z)<1e-9);
});
const center=(rect:{minX:number;maxX:number;minZ:number;maxZ:number}):Point=>({x:(rect.minX+rect.maxX)/2,z:(rect.minZ+rect.maxZ)/2});
function assertPath(path:Point[],start:Point,goal:Point,doors:ReadonlySet<string>,mode:'floor1'|'campus'='floor1') {
  assert.ok(path.length>0,`No path to ${JSON.stringify(goal)}`);
  assert.deepEqual(path[0],start);
  assert.deepEqual(path.at(-1),goal);
  for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.025));
    for(let s=0;s<=steps;s++) assert.ok(isWalkable({x:a.x+(b.x-a.x)*s/steps,z:a.z+(b.z-a.z)*s/steps},mode,doors),`Blocked segment ${i}`);
  }
}

test('source preserves upper-floor maps while calibrating the first-floor grid',()=>{
  assert.deepEqual(Object.keys(floorData),['1','2','3','4','5']);
  assert.equal(Object.values(floorData).flat().length,170);
  for(const floor of [1,2,3,4,5]) {
    const r=cellRect({name:'',col:1,colSpan:42,row:1,rowSpan:9,border:true},floor);
    assert.ok(Math.abs((r.maxZ-r.minZ)/(r.maxX-r.minX)-planAspectRatios[floor])<1e-10);
    assert.ok(Math.abs(r.maxZ-20.25)<1e-10);
  }
  const principal=places.find(p=>p.id==='principal')!.rect;
  assert.ok(Math.abs((principal.maxX-principal.minX)/(principal.maxZ-principal.minZ)-9/7.5)<.001);
  assert.equal(schoolBounds.maxX-schoolBounds.minX,81);
  for(const floor of [2,3,4,5])assert.deepEqual(planFloorData[floor],schematicPlanFloorData[floor]);
  assert.ok(doorWidth>=1.6);
  assert.equal(characterRadius,.25);
});

test('only six known rooms allow entry and old areas have explicit provenance',()=>{
  assert.deepEqual(places.filter(p=>p.enterable).map(p=>p.id).sort(),['admin','individual','library','open-library','principal','shop']);
  for(const [id,area] of [['principal',67.5],['admin',67.5],['library',135],['open-library',101.25],['shop',86.43]] as const) {
    const p=places.find(p=>p.id===id)!;
    assert.equal(p.area,area);assert.match(p.areaNote!,/2023/);
  }
  assert.match(places.find(p=>p.id==='open-library')!.areaNote!,/다름/);
  assert.match(places.find(p=>p.id==='shop')!.areaNote!,/다름/);
  for(const id of ['individual','parking','basketball','dining']) assert.equal(places.find(p=>p.id===id)!.area,undefined);
  assert.ok(furnishings.every(f=>places.find(p=>p.id===f.roomId)!.enterable));
});

test('PDF geometry preserves current names without overlaps or duplicate place IDs',()=>{
  for(const floor of [1,2,3,4,5]) {
    const cells=planFloorData[floor];
    const names=(data:typeof cells)=>[...new Set(data.map(c=>c.name.replace(/\n/g,'')).filter(Boolean))].sort();
    const expected=names(floorData[floor]);
    if(floor===1) {
      for(const name of ['중앙현관','동쪽통로','텃밭','숙직실'])expected.splice(expected.indexOf(name),1);
      expected.push('중앙로비','동편출입구','급식실','엘리베이터홀','필로티주차장','필로티진입부','당직실','북편 출입홀');expected.sort();
    }
    assert.deepEqual(names(cells),expected);
    for(const [i,c] of cells.entries()) {
      assert.ok(c.col>=1&&c.row>=1&&c.col+c.colSpan<=43.001&&c.row+c.rowSpan<=10.001);
      for(const other of cells.slice(i+1)) {
        const overlapX=Math.min(c.col+c.colSpan,other.col+other.colSpan)-Math.max(c.col,other.col);
        const overlapY=Math.min(c.row+c.rowSpan,other.row+other.rowSpan)-Math.max(c.row,other.row);
        assert.ok(overlapX<.001||overlapY<.001,`${floor}: ${c.name}/${other.name}`);
      }
    }
  }
  assert.equal(new Set(places.map(p=>p.id)).size,places.length);
  const storage=places.find(p=>p.id==='storage')!.rect;
  const women=places.find(p=>p.id==='women-toilet')!.rect;
  const library=places.find(p=>p.id==='library')!.rect;
  assert.ok(Math.abs(storage.minX-women.maxX)<.001);
  assert.ok(storage.minZ<women.maxZ&&storage.maxZ>women.minZ);
  assert.ok(storage.maxZ<library.minZ-2*characterRadius,'Storage must leave the library corridor clear');
});

test('central entrance reaches every first-floor destination approach with continuous safe segments',()=>{
  for(const p of places) {
    if(p.enterable||/화장실|당직실|창고/.test(p.name)) assert.equal(p.approach.x>p.rect.minX&&p.approach.x<p.rect.maxX&&p.approach.z>p.rect.minZ&&p.approach.z<p.rect.maxZ,false);
    assertPath(findSchoolPath(floorSpawn,p.approach,'floor1',passageDoors),floorSpawn,p.approach,passageDoors);
  }
});

test('each closed door blocks entry and opening it permits crossing its gap',()=>{
  for(const p of places.filter(p=>p.enterable)) {
    const inside={x:p.door.x,z:p.door.z+(p.id==='shop'?-1:1)};
    assert.deepEqual(findSchoolPath(p.approach,inside,'floor1',closed),[],p.id);
    assert.deepEqual(moveInSchool(p.approach,{x:inside.x-p.approach.x,z:inside.z-p.approach.z},'floor1',closed),p.approach,p.id);
    const open=new Set([...passageDoors,p.id]);
    assertPath(findSchoolPath(p.approach,inside,'floor1',open),p.approach,inside,open);
    assertPath(findSchoolPath(floorSpawn,inside,'floor1',open),floorSpawn,inside,open);
    assert.deepEqual(moveInSchool(p.approach,{x:inside.x-p.approach.x,z:inside.z-p.approach.z},'floor1',open),inside);
    assert.ok(isWalkable({x:p.door.x+doorWidth/2-characterRadius-.02,z:p.door.z},'floor1',open));
    assert.equal(isWalkable({x:p.door.x+doorWidth/2-.01,z:p.door.z},'floor1',open),false);
  }
});

test('long movement cannot tunnel through a closed room or its back wall',()=>{
  const p=places.find(p=>p.id==='principal')!;
  assert.deepEqual(moveInSchool(p.approach,{x:0,z:12},'floor1',closed),p.approach);
  const open=new Set([p.id]);
  const start={x:p.door.x,z:p.door.z+1};
  assert.deepEqual(moveInSchool(start,{x:0,z:12},'floor1',open),start);
});

test('diagonal motion does not cut a wall corner',()=>{
  const p=places.find(p=>p.id==='library')!;
  const start={x:p.rect.maxX-.6,z:p.rect.minZ-.6};
  const goal={x:p.rect.maxX+.6,z:p.rect.minZ+.6};
  assert.ok(isWalkable(start,'floor1',closed));assert.ok(isWalkable(goal,'floor1',closed));
  assert.deepEqual(moveInSchool(start,{x:goal.x-start.x,z:goal.z-start.z},'floor1',closed),start);
  assertPath(findSchoolPath(start,goal,'floor1',closed),start,goal,closed);
});

test('furniture blocks both route endpoints and movement while room floors stay usable',()=>{
  for(const f of furnishings) {
    const doors=new Set([f.roomId]);
    assert.equal(isWalkable(center(f.rect),'floor1',doors),false);
    assert.deepEqual(findSchoolPath(floorSpawn,center(f.rect),'floor1',doors),[]);
    const start={x:f.rect.minX-.5,z:(f.rect.minZ+f.rect.maxZ)/2};
    assert.ok(isWalkable(start,'floor1',doors));
    assert.deepEqual(moveInSchool(start,{x:f.rect.maxX-start.x+.5,z:0},'floor1',doors),start);
  }
});

test('service interiors are inaccessible even if their IDs are supplied as open doors',()=>{
  for(const p of places.filter(p=>p.kind==='service' && /화장실|당직실|창고/.test(p.name))) {
    assert.equal(isWalkable(center(p.rect),'floor1',new Set([p.id])),false);
    assert.deepEqual(findSchoolPath(floorSpawn,center(p.rect),'floor1',new Set([p.id])),[]);
  }
});

test('known ground-level corridors and entrances remain connected; stairs use height-aware movement',()=>{
  for(const c of planFloorData[1].filter(c=>/복도|통로|현관|로비|출입구|홀/.test(c.name))) {
    const goal=center(cellRect(c));
    assertPath(findSchoolPath(floorSpawn,goal,'floor1',closed),floorSpawn,goal,closed);
  }
});

test('the PDF library frontage is one continuous corridor, not a storage room',()=>{
  const library=places.find(p=>p.id==='library')!;
  const start={x:library.rect.minX+.6,z:library.rect.minZ-.8};
  const end={x:library.rect.maxX-.6,z:start.z};
  assert.ok(isWalkable(start,'floor1',closed));
  assert.ok(isWalkable(end,'floor1',closed),'The east library frontage must remain walkable');
  assert.deepEqual(moveInSchool(start,{x:end.x-start.x,z:0},'floor1',closed),end,'Walking along the library must not encounter the misplaced storage wall');
});

test('campus walking stays on the apron and entrance',()=>{
  const entrance=places.find(p=>p.id==='entrance')!;
  const threshold=campusEntrancePoint('entrance');
  assertPath(findSchoolPath(campusSpawn,threshold,'campus',closed),campusSpawn,threshold,closed,'campus');
  assert.equal(isWalkable(floorSpawn,'campus',closed),false,'Enter the building through its interaction rather than walking through the facade');
  assert.ok(isWalkable(campusSpawn,'campus',closed));
  assert.equal(isWalkable(campusSpawn,'floor1',closed),false);
  assert.ok(entrance.rect.maxZ<campusSpawn.z);
  assert.equal(places.some(p=>/학교정문|운동장/.test(p.name)),false);
});
test('the visitor can start just outside the gate and walk through it to the central entrance',()=>{
  assert.ok(gateSpawn.x>campusGate.x&&Math.abs(gateSpawn.z-campusGate.z)<1e-8);
  assert.ok(isWalkable(gateSpawn,'campus',closed));
  assert.equal(isWalkable(gateSpawn,'floor1',closed),false);
  const throughGate={x:campusGate.x-1,z:campusGate.z};
  assert.deepEqual(moveInSchool(gateSpawn,{x:throughGate.x-gateSpawn.x,z:0},'campus',closed),throughGate);
  assertPath(findSchoolPath(gateSpawn,campusSpawn,'campus',closed),gateSpawn,campusSpawn,closed,'campus');
});

test('video landmarks retain their sides of the measured corridors and courtyard',()=>{
  const p=(id:string)=>places.find(place=>place.id===id)!;
  const court=p('basketball').rect;
  assert.ok(Math.abs(court.maxX-court.minX-12)<1e-6&&Math.abs(court.maxZ-court.minZ-12)<1e-6);
  assert.ok(court.maxX<p('north-passage').rect.minX);
  assert.ok(p('dining').rect.maxX<=p('north-passage').rect.minX+.001);
  assert.ok(p('night-duty').rect.minX>=p('north-passage').rect.maxX-.001);
  assert.ok(p('elevator-hall').rect.maxZ<p('open-library').rect.minZ);
  assertPath(findSchoolPath(p('east-passage').approach,p('elevator-hall').approach,'floor1',closed),p('east-passage').approach,p('elevator-hall').approach,closed);
  assert.equal(isWalkable(center(bookReturn),'floor1',closed),false);
  assert.equal(isWalkable(center(securityBooth),'campus',closed),false);
  const across={x:bookReturn.maxX+.5,z:bookReturn.maxZ+.4};
  const start={x:bookReturn.minX-.5,z:across.z};
  assert.deepEqual(moveInSchool(start,{x:across.x-start.x,z:0},'floor1',closed),across);
  assertPath(findSchoolPath(campusSpawn,{x:35,z:27.7},'campus',closed),campusSpawn,{x:35,z:27.7},closed,'campus');
});

test('courtyard voids cannot be walked across or used as route shortcuts',()=>{
  const start={x:3,z:-17},end={x:34.5,z:-17};
  assert.ok(isWalkable(start,'floor1',closed)&&isWalkable(end,'floor1',closed));
  assert.equal(isWalkable({x:16,z:-17},'floor1',closed),false);
  assert.deepEqual(moveInSchool(start,{x:end.x-start.x,z:0},'floor1',closed),start);
  assertPath(findSchoolPath(start,end,'floor1',passageDoors),start,end,passageDoors);
});

const libraryRect=places.find(p=>p.id==='library')!.rect;
const deskRect=furnishings.find(f=>f.roomId==='individual'&&f.kind==='desk')!.rect;
const libraryCorner={x:libraryRect.maxX+wallThickness/2,z:libraryRect.minZ-wallThickness/2};
const grazingA=.193747258045114,grazingB=.159099025766974;
for(const regression of [
  {name:'library wall',mode:'floor1' as const,doors:closed,a:{x:libraryCorner.x+grazingA,z:libraryCorner.z-grazingB},b:{x:libraryCorner.x+grazingB,z:libraryCorner.z-grazingA}},
  {name:'desk',mode:'floor1' as const,doors:new Set(['individual']),a:{x:deskRect.minX-grazingA,z:deskRect.minZ-grazingB},b:{x:deskRect.minX-grazingB,z:deskRect.minZ-grazingA}},
]) test(`a short segment grazing the ${regression.name} cannot pass between safe endpoints`,()=>{
  const {a,b,mode,doors}=regression;
  const midpoint={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
  assert.ok(isWalkable(a,mode,doors));assert.ok(isWalkable(b,mode,doors));
  assert.equal(isWalkable(midpoint,mode,doors),false);
  assert.deepEqual(moveInSchool(a,{x:b.x-a.x,z:b.z-a.z},mode,doors),a);
  const path=findSchoolPath(a,b,mode,doors);
  assert.notDeepEqual(path,[a,b]);
  assertPath(path,a,b,doors,mode);
  for(let i=1;i<path.length;i++) {
    const start=path[i-1],goal=path[i];
    assert.deepEqual(moveInSchool(start,{x:goal.x-start.x,z:goal.z-start.z},mode,doors),goal);
  }
});

test('campus routes go around the entrance and apron boundary corner',()=>{
  const corner={x:schoolBounds.minX,z:schoolBounds.maxZ};
  const a={x:corner.x-.6,z:corner.z-.6},b={x:corner.x+.6,z:corner.z+.6};
  assert.ok(isWalkable(a,'campus',closed));assert.ok(isWalkable(b,'campus',closed));
  assert.equal(isWalkable(corner,'campus',closed),false);
  assert.deepEqual(moveInSchool(a,{x:b.x-a.x,z:b.z-a.z},'campus',closed),a);
  assertPath(findSchoolPath(a,b,'campus',closed),a,b,closed,'campus');
});

test('invalid, outside and unreachable destinations return no path and never teleport',()=>{
  for(const goal of [{x:NaN,z:0},{x:Infinity,z:0},{x:0,z:999},{x:-999,z:0}]) {
    assert.equal(isWalkable(goal,'floor1',closed),false);
    assert.deepEqual(findSchoolPath(floorSpawn,goal,'floor1',closed),[]);
    assert.deepEqual(moveInSchool(floorSpawn,{x:goal.x-floorSpawn.x,z:goal.z-floorSpawn.z},'floor1',closed),floorSpawn);
  }
  assert.deepEqual(findSchoolPath({x:NaN,z:0},floorSpawn,'floor1',closed),[]);
  assertPath(findSchoolPath(floorSpawn,floorSpawn,'floor1',closed),floorSpawn,floorSpawn,closed);
});

for(const frameTimes of [[1/60],[1/30],[1/144],[.008,.05,.017,.033]]) test(`automatic routes reach eight destinations at frame times ${frameTimes.join(',')}`,()=>{
  for(const id of ['shop','individual','principal','admin','open-library','library','parking','basketball']) {
    const goal=places.find(p=>p.id===id)!.approach;
    let position={...floorSpawn},path=findSchoolPath(position,goal,'floor1',passageDoors);
    assert.ok(path.length);
    for(let frame=0;path.length&&frame<3000;frame++) {
      const step=advanceSchoolRoute(position,path,frameTimes[frame%frameTimes.length]*6,'floor1',passageDoors);
      assert.equal(step.blocked,false,`${id} blocked at ${JSON.stringify(step.position)}`);
      position=step.position;path=path.slice(step.consumed);
    }
    assert.equal(path.length,0,id);
    assert.ok(Math.hypot(position.x-goal.x,position.z-goal.z)<1e-8,`${id} stopped before its destination`);
  }
});

test('automatic route respects door closure during walking and resumes through an open door',()=>{
  const room=places.find(p=>p.id==='principal')!,open=new Set([room.id]);
  const goal={x:room.door.x,z:room.door.z+1},path=findSchoolPath(room.approach,goal,'floor1',open);
  const original=structuredClone(path);
  const blocked=advanceSchoolRoute(room.approach,path,10,'floor1',closed);
  assert.equal(blocked.blocked,true);assert.deepEqual(blocked.position,room.approach);
  assert.deepEqual(path,original);
  const arrived=advanceSchoolRoute(room.approach,path,10,'floor1',open);
  assert.equal(arrived.blocked,false);assert.equal(arrived.consumed,path.length);assert.deepEqual(arrived.position,goal);
});
