import type {Point,Rect,Place} from './school-layout.ts';
import type {FloorCell} from './school-floor-data.ts';
import {planRect,stairs,stairPoint,floorRise} from './school-structure.ts';
import {classroomLayout,corridorLayout,pieceRect,propSpot,type ClassroomModel,type ClassroomProp} from './school-classrooms.ts';

export type UpperRoom=Place&{floor:number;axis:'x'|'z';style:'classroom'|'office'|'lab'|'hall'|'gym'|'gallery'|'toilet'};
export type UpperFurniture={floor:number;roomId:string;rect:Rect;kind:'desk'|'bench'|'shelf'|'sink'|'toilet'|'model';model?:ClassroomModel;x?:number;z?:number;y?:number;rotation?:number};
/** Walk-through furniture without collision: floor mats, balloon arches. */
export type UpperDecor={floor:number;roomId:string;model:ClassroomModel;x:number;z:number;y:number;rotation:number};
export type UpperProp=ClassroomProp&{floor:number;roomId:string;rect:Rect;spot:Point};
export const upperRooms:UpperRoom[]=[];
export const upperDecor:UpperDecor[]=[];
export const upperProps:UpperProp[]=[];
/** Rooms furnished from the walk-through videos rather than the generic sample. */
export const customRooms=new Set<string>();
export const upperCorridors:Record<number,Rect[]>={};
export const upperFurniture:UpperFurniture[]=[];
export const upperPlanData:Record<number,FloorCell[]>={};
export const walkingFloor=(height:number)=>Math.max(1,Math.min(5,Math.round(height/floorRise)+1));
export const onFloorLevel=(height:number)=>Math.abs(height-(walkingFloor(height)-1)*floorRise)<.12;
const mid=(r:Rect):Point=>({x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2});
const within=(p:Point,r:Rect)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;

/**
 * Rooms keep one door. The plan (A-204~207) gives every room of 8 m or more a door at each
 * end of its corridor wall; we keep the one the walk-through video enters by. 'start' is the
 * west end of a north/south wall or the north end of an east/west wall, a number is metres
 * from that end. Homerooms copy 인문학교실 (door at the board end); other large rooms use
 * the start end, and small rooms keep a centred door.
 */
const doorEnds:Record<string,'start'|'end'|number>={
  '2:물리/지학실':'end','2:생명과학실':'end','2:화학실':'end','2:세미나실':'end','2:온라인학습실':'start','2:체력단련실':'start',
  '3:컴퓨터실':'end','3:스마트AI교실':'end','3:미술실':'end','3:음악실':'end','3:인문학교실':'start','3:창의상상라운지':4.2,
  '4:청학스터디존':9.9,
};
// The door leaf (1.8 m opening) stays clear of the corner column.
const doorInset=1.3;

function room(floor:number,name:string,x:number,z:number,w:number,d:number,side:'north'|'south'|'east'|'west',style:UpperRoom['style'],area?:number) {
  const rect=planRect(x,z,w,d),c=mid(rect),axis=side==='east'||side==='west'?'x':'z',length=axis==='x'?d:w;
  const end=doorEnds[`${floor}:${name}`]??(length>=8&&['classroom','office','lab'].includes(style)?'start':undefined);
  const along=(min:number,max:number,mid:number)=>end==='start'?min+doorInset:end==='end'?max-doorInset:typeof end==='number'?min+end:mid;
  const door=axis==='x'?{x:side==='east'?rect.maxX:rect.minX,z:along(rect.minZ,rect.maxZ,c.z)}:{x:along(rect.minX,rect.maxX,c.x),z:side==='south'?rect.maxZ:rect.minZ};
  const approach={x:door.x+(side==='east'?1.05:side==='west'?-1.05:0),z:door.z+(side==='south'?1.05:side==='north'?-1.05:0)};
  const id=`floor-${floor}-room-${upperRooms.filter(r=>r.floor===floor).length}`;
  const entry:UpperRoom={id,name,rect,door,approach,floor,axis,style,kind:'room',enterable:true,area,
    areaNote:'2023년 배치도의 대응 공간 참고값입니다. 현재 칸막이와 실측 면적은 다를 수 있습니다.',
    description:`${floor}층 ${name}입니다. 건축 도면의 구조 치수에 현재 실 이름을 대응했습니다. 가구는 공간 용도를 보여 주는 견본입니다.`};
  upperRooms.push(entry);
  const layout=classroomLayout(floor,name,rect,id,side==='north'?'n':side==='south'?'s':side==='east'?'e':'w');
  if(layout) {
    customRooms.add(id);
    entry.description=`${floor}층 ${name}입니다. 공간 용도에 맞는 대표 가구를 배치했어요. 위치와 개수는 실제와 다를 수 있어요.`;
    placePieces(floor,id,layout.pieces);
    for(const prop of layout.props)upperProps.push({...prop,floor,roomId:id,rect:pieceRect(prop),spot:propSpot(prop)});
    return entry;
  }
  const add=(kind:UpperFurniture['kind'],cx:number,cz:number,width:number,depth:number)=>upperFurniture.push({floor,roomId:id,kind,rect:{minX:cx-width/2,maxX:cx+width/2,minZ:cz-depth/2,maxZ:cz+depth/2}});
  if(style==='classroom') {
    for(let row=0;row<4;row++)for(let col=0;col<5;col++) {
      const px=rect.minX+1.3+col*1.25,pz=rect.minZ+2+row*1.18;
      add('desk',px,pz,.72,.5);add('bench',px,pz+.43,.42,.38);
    }
  } else if(style==='lab') {
    for(let row=0;row<2;row++)for(let col=0;col<3;col++)add('desk',rect.minX+2+col*3.1,rect.minZ+2.5+row*3,1.9,.9);
  } else if(style==='office') {
    const count=Math.min(3,Math.floor((w-1)/2.4));
    for(let i=0;i<count;i++)add('desk',rect.minX+1.2+i*2.4,rect.minZ+(axis==='z'?2.3:1.1),1.4,.75);
  } else if(style==='toilet') {
    add('sink',rect.minX+.7,rect.minZ+.7,.62,.48);add('toilet',rect.maxX-.7,rect.minZ+.8,.5,.7);
  } else if(style==='gallery') {
    for(let i=0;i<6;i++)add('bench',rect.minX+1.3,rect.minZ+1.5+i*2.2,1.8,.55);
  } else if(style==='hall') {
    for(let row=0;row<4;row++)for(let col=0;col<5;col++)add('bench',rect.minX+3+col*5,rect.minZ+2+row*1.8,2.8,.6);
  }
  return entry;
}

function placePieces(floor:number,roomId:string,pieces:ReturnType<typeof corridorLayout>) {
  for(const piece of pieces) {
    const placed={model:piece.model,x:piece.x,z:piece.z,y:piece.y??0,rotation:piece.rotation};
    if(piece.solid)upperFurniture.push({floor,roomId,kind:'model',rect:pieceRect(piece),...placed});
    else upperDecor.push({floor,roomId,...placed});
  }
}

for(const floor of [2,3,4,5]) {
  // A-204..207: same 2.7 m main corridors, 4.5 m east setback, 3 m north spine.
  upperCorridors[floor]=[
    planRect(0,45.6,36,2.7),planRect(36,41.1,9,7.2),planRect(45,41.1,36,2.7),
    planRect(42,11.6,3,29.5),planRect(78.3,11.6,2.7,25),
    planRect(72,36.6,9,4.5),planRect(4.5,41.1,9,4.5),
    planRect(45,31.6,3,9.5),planRect(48,39.1,24,2),
  ];
  // Keep all four stair cores, including the central lobby stair, vertically aligned.
  for(const stair of stairs) {
    const a=stairPoint(stair,0,0),b=stairPoint(stair,1.2,4);
    upperCorridors[floor].push({minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z)});
  }
  room(floor,floor===2?'진로진학상담부':`진학상담실${floor-2}`,0,41.1,4.5,4.5,'south','office',20.25);
  const south=floor===2?[
    ['Wee Class',9],['교무실',18],['C.B.S(방송실)',9],['시설관리실',4.5],['서버실',4.5],['보건실',9],['평가관리실',9],['온라인학습실',9],['학생안전부',9],
  ] as const: (floor===3?['다목적실1','1-7','1-6','1-5','1-4','1-3','1-2','1-1','1학년교무실']:floor===4?['2-7','2-6','2-5','2-4','2-3','2-2','2-1','다목적실2','2학년교무실']:['3-6','3-5','3-4','3-3','3-2','3-1','다목적실4','다목적실3','3학년교무실']).map(name=>[name,9] as const);
  let x=0;
  for(const [name,width] of south){room(floor,name,x,x<45?48.3:43.8,width,7.5,'north',/^\d-\d|학습|다목적/.test(name)?'classroom':'office',width*7.5);x+=width;}
  if(floor<=3) {
    upperCorridors[floor].push(planRect(6,20.1,36,3));
    const rows=floor===2?[['학부모실','생명과학실','물리/지학실','준비실'],['회의실','세미나실','화학실','준비실']]:[['물품보관실','컴퓨터실','스마트AI교실','교무실'],['미술준비실','미술실','음악실','음악준비실']];
    for(let row=0;row<2;row++) {
      let x=6;
      for(let i=0;i<4;i++){const w=[4.5,13.5,13.5,4.5][i];room(floor,rows[row][i],x,row===0?11.6:23.1,w,8.5,row===0?'south':'north',w>5?'lab':'office',w*8.5);x+=w;}
    }
    if(floor===2) {
      const hall=room(floor,'시청각실 (송천홀)',6,0,36,11.6,'east','hall',291.6);
      // The north hall opens toward the top of the north spine, beside its stairs.
      hall.door={x:1.5,z:-25.15};hall.approach={x:2.55,z:-25.15};
      upperCorridors[floor].push(planRect(42,9,3,2.6));
    }
  } else if(floor===4)room(floor,'송학관(체육관)',6,11.6,36,20,'east','gym',720);
  else {
    room(floor,'교무실',37.5,11.6,4.5,4.5,'east','office',20);
    room(floor,'송학관 관람석',37.5,16.1,4.5,15.5,'east','gallery');
  }
  if(floor<5)room(floor,floor===2?'교직원화장실(여)':'샤워실(남)',45,25.5,3,6.1,'west','toilet',floor===2?13.5:27);
  if(floor===3)room(floor,'비품창고',45,18.5,4.5,7,'west','office');
  if(floor===4)room(floor,'샤워실(여)',45,20,3,5.5,'west','toilet');
  room(floor,'남학생화장실',48,31.6,3,7.5,'south','toilet',floor===2?27:40.5);
  room(floor,'여학생화장실',51,31.6,3,7.5,'south','toilet',floor===2?27:40.5);
  for(let i=0;i<2;i++)room(floor,floor===3?`교직원화장실(${i===0?'남':'여'})`:`화장실(${i===0?'남':'여'})`,70.2+i*4.05,3.9,4.05,7.7,'south','toilet',27);
  upperCorridors[floor].push(planRect(70.2,11.6,8.1,1.4));
  placePieces(floor,`floor-${floor}-east-corridor`,corridorLayout(floor));
  const east=floor===2?['학생회실','남직원휴게실','여직원휴게실','체력단련실']:floor===3?['창의상상라운지','인문학교실']:floor===4?['자기주도학습실1','청학스터디존']:['자기주도학습실2','공감교실','교구보관실'];
  const heights=floor===2?[6.2,4.2,4.2,9]:floor===3?[15.2,8.4]:floor===4?[8.4,15.2]:[8.4,6.8,8.4];
  let z=13;
  east.forEach((name,i)=>{room(floor,name,70.2,z,8.1,heights[i],'east',/학습|교실/.test(name)?'classroom':'office',/휴게실/.test(name)?34.02:68.04);z+=heights[i];});
  if(floor>=4)room(floor,floor===4?'여교사화장실':'협의실',78.3,3.9,2.7,7.7,'south',floor===4?'toilet':'office',floor===4?20:27);
  const cells:FloorCell[]=[];
  const cell=(name:string,r:Rect)=>cells.push({name,col:1+(r.minX+40.5)/81*42,row:1+(r.minZ+35.55)/55.8*9,colSpan:(r.maxX-r.minX)/81*42,rowSpan:(r.maxZ-r.minZ)/55.8*9,border:true});
  upperCorridors[floor].forEach(r=>cell('복도',r));upperRooms.filter(r=>r.floor===floor).forEach(r=>cell(r.name,r.rect));stairs.forEach(s=>cell(s.name,s.rect));upperPlanData[floor]=cells;
}

const viceOffice=upperRooms.find(room=>room.floor===2&&room.name==='교무실')!;
export const upperResidents=[{model:'vice-principal-resident',floor:2,roomId:viceOffice.id,x:viceOffice.rect.minX+2.5,z:viceOffice.rect.minZ+3.5,rotation:0}];
export const upperResidentObstacles=upperResidents.map(p=>({floor:p.floor,rect:{minX:p.x-.4,maxX:p.x+.4,minZ:p.z-.4,maxZ:p.z+.4}}));
const upperSurfaces=Object.fromEntries([2,3,4,5].map(floor=>[floor,[...upperCorridors[floor],...upperRooms.filter(r=>r.floor===floor).map(r=>r.rect)]]));
export function upperFloorSurface(point:Point,floor:number):boolean {
  return (upperSurfaces[floor]??[]).some(r=>within(point,r));
}
export function upperRoomWalls(room:UpperRoom):Rect[] {
  const r=room.rect,result:Rect[]=[],t=.08,d=.9;
  for(const axis of ['x','z'] as const)for(const at of axis==='x'?[r.minX,r.maxX]:[r.minZ,r.maxZ]) {
    const start=axis==='x'?r.minZ:r.minX,end=axis==='x'?r.maxZ:r.maxX;
    const gap=axis===room.axis&&Math.abs((axis==='x'?room.door.x:room.door.z)-at)<.001;
    const center=axis==='x'?room.door.z:room.door.x;
    for(const [a,b] of gap?[[start,center-d],[center+d,end]]:[[start,end]])if(b>a)result.push(axis==='x'?{minX:at-t,maxX:at+t,minZ:a,maxZ:b}:{minX:a,maxX:b,minZ:at-t,maxZ:at+t});
  }
  return result;
}
export function upperDoorLeaf(room:UpperRoom):Rect {
  return room.axis==='x'?{minX:room.door.x-.08,maxX:room.door.x+.08,minZ:room.door.z-.9,maxZ:room.door.z+.9}:{minX:room.door.x-.9,maxX:room.door.x+.9,minZ:room.door.z-.08,maxZ:room.door.z+.08};
}
