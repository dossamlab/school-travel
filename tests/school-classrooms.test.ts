import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Matrix4,Quaternion,Vector3} from 'three';
import {classroomModels} from '../src/school-classrooms.ts';
import {upperRooms,upperFurniture,upperProps,upperDecor,customRooms} from '../src/school-upper-floors.ts';
import {findSchoolPath,isWalkable} from '../src/school-navigation.ts';
import {portals} from '../src/school-structure.ts';
import {places,groundFurniture,libraryPassage} from '../src/school-layout.ts';
import {makeFloorQuiz,balloonPoints} from '../src/school-minigames.ts';

type Node={name?:string;children?:number[];mesh?:number;translation?:number[];rotation?:number[];scale?:number[];matrix?:number[]};
type Asset={nodes:Node[];meshes:{primitives:{indices?:number;attributes:{POSITION:number}}[]}[];accessors:{count:number;min?:number[];max?:number[]}[]};
const file=readFileSync(new URL('../public/school-classrooms.glb',import.meta.url));
const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12))) as Asset;
function bounds(name:string) {
  const index=data.nodes.findIndex(node=>node.name===name);
  assert.ok(index>=0,`Missing prototype ${name}`);
  const result=new Box3();
  (function visit(id:number,parent:Matrix4) {
    const node=data.nodes[id]!;
    const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3().fromArray(node.translation??[0,0,0]),new Quaternion().fromArray(node.rotation??[0,0,0,1]),new Vector3().fromArray(node.scale??[1,1,1]));
    const world=parent.clone().multiply(local);
    if(node.mesh!==undefined)for(const primitive of data.meshes[node.mesh]!.primitives) {
      const position=data.accessors[primitive.attributes.POSITION]!;
      result.union(new Box3(new Vector3().fromArray(position.min!),new Vector3().fromArray(position.max!)).applyMatrix4(world));
    }
    for(const child of node.children??[])visit(child,world);
  })(index,new Matrix4());
  return result;
}
const open=new Set([...upperRooms.map(r=>r.id),...portals.map(p=>p.id)]);
const overlaps=(a:{minX:number;maxX:number;minZ:number;maxZ:number},b:typeof a)=>a.minX<b.maxX-1e-6&&b.minX<a.maxX-1e-6&&a.minZ<b.maxZ-1e-6&&b.minZ<a.maxZ-1e-6;

test('classroom prototypes are centred, grounded and match the declared footprints',()=>{
  assert.ok(file.length<1.5*1024*1024,`school-classrooms.glb: ${file.length} bytes`);
  const triangles=data.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+data.accessors[p.indices??p.attributes.POSITION]!.count/3,0);
  assert.ok(triangles<70000,`${triangles} triangles`);
  for(const [name,[width,depth]] of Object.entries(classroomModels)) {
    const box=bounds(name),size=box.getSize(new Vector3()),centre=box.getCenter(new Vector3());
    assert.ok(Math.abs(box.min.y)<.01,`${name} stands on the floor`);
    assert.ok(Math.abs(centre.x)<.01&&Math.abs(centre.z)<.01,`${name} is centred on its footprint`);
    assert.ok(Math.abs(size.x-width)<.02&&Math.abs(size.z-depth)<.02,`${name}: ${size.x.toFixed(3)} x ${size.z.toFixed(3)}`);
  }
});

test('interactive cabinets keep hinge pivots and the arcades keep their screen anchors',()=>{
  for(const name of ['printer-cabinet-door-l','printer-cabinet-door-r','germ-incubator-a-door','germ-incubator-b-door','arcade-balloon-screen','arcade-quiz-marquee','welcome-banner-face','power-rack-bar'])
    assert.ok(data.nodes.some(node=>node.name===name),`Missing node ${name}`);
  assert.ok(bounds('germ').max.y<.7,'The germ is scaled up only while it pops out');
});

test('video-based rooms keep furniture apart, inside their walls and their props reachable',()=>{
  const names=new Set(upperRooms.filter(r=>customRooms.has(r.id)).map(r=>`${r.floor}:${r.name}`));
  for(const name of ['2:물리/지학실','2:생명과학실','2:세미나실','2:온라인학습실','2:체력단련실','2:화학실','3:미술실','3:스마트AI교실','3:인문학교실','3:창의상상라운지','3:컴퓨터실','4:청학스터디존'])assert.ok(names.has(name),name);
  // Only washrooms, showers and the gym keep their own fixtures instead of a furniture layout.
  for(const room of upperRooms.filter(r=>r.style!=='toilet'&&r.style!=='gym'))assert.ok(customRooms.has(room.id),`${room.floor}F ${room.name} is furnished`);
  for(const room of upperRooms.filter(r=>customRooms.has(r.id))) {
    const solids=[...upperFurniture.filter(f=>f.roomId===room.id),...upperProps.filter(p=>p.roomId===room.id&&p.solid)].map(item=>item.rect);
    for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++)assert.ok(!overlaps(solids[i]!,solids[j]!),`${room.name}: furniture ${i} and ${j} overlap`);
    for(const prop of upperProps.filter(p=>p.roomId===room.id)) {
      assert.ok(isWalkable(prop.spot,'floor1',open,room.floor),`${prop.name} spot is walkable`);
      assert.ok(findSchoolPath(room.approach,prop.spot,'floor1',open,room.floor).length,`${prop.name} is reachable from the door`);
    }
  }
  assert.ok(upperDecor.some(d=>d.model==='balloon-arch'),'The lounge arch is walk-through decoration');
});

test('every homeroom matches 인문학교실 desks and every staff room uses the same teacher desks',()=>{
  const furniture=(id:string)=>upperFurniture.filter(f=>f.roomId===id);
  const local=(id:string)=>{const r=upperRooms.find(r=>r.id===id)!.rect;return furniture(id).map(f=>`${f.model}@${(f.x!-r.minX).toFixed(2)},${(f.z!-r.minZ).toFixed(2)}`).sort().join('|');};
  const homerooms=upperRooms.filter(r=>/^\d-\d$/.test(r.name));
  assert.equal(homerooms.length,20);
  for(const room of homerooms) {
    assert.ok(customRooms.has(room.id));
    assert.equal(local(room.id),local(homerooms[0]!.id),`${room.floor}F ${room.name} differs from the other homerooms`);
  }
  const humanities=upperRooms.find(r=>r.name==='인문학교실')!.id;
  assert.ok(furniture(humanities).some(f=>f.model==='student-set')&&furniture(homerooms[0]!.id).some(f=>f.model==='student-set'));
  const staff=upperRooms.filter(r=>/교무실$/.test(r.name));
  assert.equal(staff.length,6);
  for(const room of staff) {
    const models=new Set(furniture(room.id).map(f=>f.model));
    assert.ok(models.has('staff-desk')&&models.has('office-cabinet')&&!models.has('student-set'),`${room.floor}F ${room.name}`);
  }
});

test('requested props exist in their rooms',()=>{
  const room=(floor:number,name:string)=>upperRooms.find(r=>r.floor===floor&&r.name===name)!.id;
  const props=(id:string)=>upperProps.filter(p=>p.roomId===id);
  assert.deepEqual(props(room(2,'물리/지학실')).map(p=>p.action).sort(),['cabinet','info']);
  assert.equal(props(room(2,'생명과학실')).filter(p=>p.action==='germ').length,2);
  assert.deepEqual(props(room(2,'생명과학실')).filter(p=>p.action==='info').map(p=>p.name).sort(),['멸균실험대','인큐베이터']);
  assert.equal(props(room(2,'생명과학실')).find(p=>p.action==='microscope')?.name,'현미경함');
  // First-round interactions: three gym machines and the lounge photo zone.
  assert.deepEqual(props(room(2,'체력단련실')).map(p=>p.exercise).sort(),['curl','run','squat']);
  assert.equal(props(room(3,'창의상상라운지')).filter(p=>p.action==='photo').length,1);
  assert.deepEqual(props(room(3,'창의상상라운지')).filter(p=>p.game).map(p=>p.game).sort(),['balloon','quiz']);
  assert.ok(upperProps.some(f=>f.roomId===room(3,'창의상상라운지')&&f.model==='welcome-banner'),'The welcome banner stands on the lounge stage');
});

test('doors sit at the corner the room videos enter by',()=>{
  const at=(floor:number,name:string)=>{const r=upperRooms.find(r=>r.floor===floor&&r.name===name)!;return {r,u:r.door.x-r.rect.minX,v:r.door.z-r.rect.minZ};};
  const expect:[number,string,'n'|'s'|'e',number][]=[
    [2,'물리/지학실','s',12.2],[2,'생명과학실','s',12.2],[2,'화학실','n',12.2],[2,'세미나실','n',12.2],[2,'온라인학습실','n',1.3],
    [2,'체력단련실','e',1.3],[3,'컴퓨터실','s',12.2],[3,'스마트AI교실','s',12.2],[3,'미술실','n',12.2],[3,'인문학교실','e',1.3],
    [3,'창의상상라운지','e',4.2],[4,'청학스터디존','e',9.9],[3,'1-1','n',1.3],[5,'3-6','n',1.3],
  ];
  for(const [floor,name,side,along] of expect) {
    const {r,u,v}=at(floor,name),w=r.rect.maxX-r.rect.minX,d=r.rect.maxZ-r.rect.minZ;
    const wall=side==='n'?v:side==='s'?d-v:w-u,offset=side==='e'?v:u;
    assert.ok(Math.abs(wall)<1e-6&&Math.abs(offset-along)<1e-6,`${floor}F ${name} door at ${u.toFixed(2)},${v.toFixed(2)}`);
  }
});

test('every chair, stool and bench seat carries a sitting marker',()=>{
  const seats=data.nodes.filter(node=>node.name?.startsWith('seat'));
  assert.ok(seats.length>=50,`${seats.length} seat markers`);
  for(const name of ['lab-set-orange','student-set','computer-set','staff-desk','booth','wall-bench-blue','round-table-stools']) {
    const root=data.nodes.find(node=>node.name===name)!;
    assert.ok(root.children?.some(child=>data.nodes[child]!.name?.startsWith('seat')),`${name} has a seat`);
  }
  for(const node of seats)assert.ok(node.translation&&node.translation[1]!>.4&&node.translation[1]!<1,`${node.name} sits at seat height`);
});

test('first-floor library follows its videos and connects through the folding-door passage',()=>{
  const models=(id:string)=>groundFurniture.filter(f=>f.roomId===id).map(f=>f.model);
  assert.ok(models('library').filter(m=>m==='library-stack').length>=10,'Rows of double-sided stacks');
  for(const model of ['circulation-desk','library-table-set','lounge-chair-green','folding-glass-door'] as const)assert.ok(models('library').includes(model),model);
  for(const model of ['library-table-set','wood-bookcase'] as const)assert.ok(models('open-library').includes(model),model);
  for(const id of ['open-library','library']) {
    const r=places.find(p=>p.id===id)!.rect,solid=groundFurniture.filter(f=>f.roomId===id&&f.solid&&f.model!=='folding-glass-door');
    for(const f of solid)assert.ok(f.rect.minX>r.minX&&f.rect.maxX<r.maxX&&f.rect.minZ>r.minZ&&f.rect.maxZ<r.maxZ,`${id} ${f.model} inside`);
    for(let i=0;i<solid.length;i++)for(let j=i+1;j<solid.length;j++)assert.ok(!overlaps(solid[i]!.rect,solid[j]!.rect),`${id}: ${solid[i]!.model} overlaps ${solid[j]!.model}`);
  }
  const openOnly=new Set(['open-library',...portals.map(p=>p.id)]),inside={x:libraryPassage.x+1.2,z:(libraryPassage.minZ+libraryPassage.maxZ)/2};
  assert.ok(findSchoolPath(places.find(p=>p.id==='open-library')!.approach,inside,'floor1',openOnly).length,'Walk from 열린도서관 into 도서관');
  assert.ok(!isWalkable({x:libraryPassage.x,z:libraryPassage.minZ-.5},'floor1',openOnly),'The shared wall stays solid beside the passage');
});

test('east corridor seating leaves the corridor and every east doorway open',()=>{
  for(const floor of [2,3,4]) {
    assert.ok(findSchoolPath({x:38.85,z:-23.3},{x:38.85,z:.6},'floor1',open,floor).length,`${floor}F east corridor`);
    for(const f of upperFurniture.filter(f=>f.roomId===`floor-${floor}-east-corridor`))assert.ok(f.rect.minX>39.3,`${floor}F seating hugs the windows`);
  }
});

test('floor quiz answers match the walkable map',()=>{
  let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const rooms=upperRooms.map(r=>({name:r.name,floor:r.floor}));
  for(let round=0;round<20;round++) {
    const quiz=makeFloorQuiz(rooms,random);
    assert.equal(quiz.length,5);
    assert.equal(new Set(quiz.map(q=>q.statement)).size,5);
    for(const q of quiz) {
      const [,name,floor]=q.statement.match(/^(.+)은\(는\) (\d)층에 있어요\.$/)!;
      const actual=upperRooms.filter(r=>r.name===name).map(r=>r.floor);
      assert.equal(actual.length,1,`${name} is unique`);
      assert.equal(q.answer,actual[0]===Number(floor),q.statement);
    }
  }
  assert.equal(balloonPoints(true),3);assert.equal(balloonPoints(false),1);
});
