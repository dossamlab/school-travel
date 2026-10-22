import type {FloorCell} from './school-floor-data.ts';
import {planFloorData as floorData,planAspectRatios,firstFloorDimensions} from './school-plan-data.ts';
import {extraFloors,boundaryWalls,portals,stairs,stairEntry,diningTables,diningBenches} from './school-structure.ts';
import {carObstacles,gardenRect,campusGround,recyclingObstacles,gardenBeds,campusFences} from './school-outdoors.ts';
import {libraryLayout,groundRoomsLayout,pieceRect} from './school-classrooms.ts';

export type Point={x:number;z:number};
export type TourMode='campus'|'floor1';
export type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
export type Place={id:string;name:string;rect:Rect;kind:'room'|'outdoor'|'service';door:Point;approach:Point;enterable:boolean;area?:number;areaNote?:string;description:string};
export type Furnishing={roomId:string;kind:'desk'|'shelf'|'bench';rect:Rect};

// First-floor reference lines use A-202 metres. Door and wall sizes remain estimates.
export const doorWidth=1.8;
export const wallThickness=.16;
export const characterRadius=.25;
export const schoolBounds:Rect={minX:-firstFloorDimensions.width/2,maxX:firstFloorDimensions.width/2,minZ:20.25-firstFloorDimensions.depth,maxZ:20.25};
export const campusBounds:Rect={...campusGround,maxX:56,maxZ:100};
export const campusGate:Point={x:49,z:25};
export const gateSpawn:Point={x:campusGate.x+1.5,z:campusGate.z};
export const campusCutawayZ=15.5;
export function showCampusCutaway(p:Point):boolean {
  // Reveal the actual parking/courtyard area, never the road beside the east windows.
  return p.z<campusCutawayZ&&(p.x<34||(p.x<40.5&&p.z<1.05));
}
// The exported facade and navigation now share the measured first-floor cells.
export const campusFrontSolids:Rect[]=floorData[1]
  .filter(c=>!c.name.startsWith('필로티')&&c.name!=='농구장'&&c.name!=='매점')
  .map(c=>cellRect(c)).filter(r=>r.maxZ>=15.75-1e-8)
  .map(r=>({minX:r.minX-.16,maxX:r.maxX+.16,minZ:r.minZ-.16,maxZ:r.maxZ+.16}));

export function cellRect(cell:FloorCell,floor=1):Rect {
  const width=floor===1?firstFloorDimensions.width:78.75,colScale=width/42,rowScale=width*planAspectRatios[floor]/9;
  const minX=(cell.col-1)*colScale-width/2,minZ=(cell.row-10)*rowScale+20.25;
  return {minX,maxX:minX+cell.colSpan*colScale,minZ,maxZ:minZ+cell.rowSpan*rowScale};
}

const entranceRect=cellRect(floorData[1].find(cell=>cell.name==='중앙로비')!);
export const lobbyExit:Point={x:(entranceRect.minX+entranceRect.maxX)/2,z:entranceRect.maxZ-1.2};
// Complement of the mapped floor footprint: courtyard gaps are not invisible shortcuts.
const footprints=[...floorData[1].map(cell=>cellRect(cell)),...extraFloors];
export const campusInteriors:Rect[]=floorData[1].filter(cell=>!cell.name.startsWith('필로티')&&cell.name!=='농구장'&&cell.name!=='매점').map(cell=>cellRect(cell));
campusInteriors.push(...stairs.map(stair=>stair.rect));
const floorXs=[...new Set(footprints.flatMap(r=>[r.minX,r.maxX]).map(n=>Number(n.toFixed(8))))].sort((a,b)=>a-b);
const floorZs=[...new Set(footprints.flatMap(r=>[r.minZ,r.maxZ]).map(n=>Number(n.toFixed(8))))].sort((a,b)=>a-b);
export const floorVoids:Rect[]=floorXs.slice(0,-1).flatMap((minX,i)=>floorZs.slice(0,-1).flatMap((minZ,j)=>{
  const maxX=floorXs[i+1],maxZ=floorZs[j+1],x=(minX+maxX)/2,z=(minZ+maxZ)/2;
  return footprints.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ)?[]:[{minX,maxX,minZ,maxZ}];
}));
export const floorSpawn:Point={x:(entranceRect.minX+entranceRect.maxX)/2,z:entranceRect.minZ+1.3};
export const campusSpawn:Point={x:floorSpawn.x,z:24.75};

const stableIds:Record<string,string>={
  '개별화교육지원실':'individual','교장실':'principal','행정실':'admin','열린도서관':'open-library',
  '도서관':'library','매점':'shop','필로티주차장':'parking','농구장':'basketball','중앙로비':'entrance',
  '서쪽현관':'west-entrance','동편출입구':'east-passage','서쪽통로':'west-passage','당직실':'night-duty',
  '교직원화장실(남)':'staff-toilet','장애인화장실':'accessible-toilet','화장실(남)':'men-toilet','화장실(여)':'women-toilet',
  '창고':'storage','통로':'north-passage','급식실':'dining','엘리베이터홀':'elevator-hall','필로티진입부':'parking-entry',
};
const roomIds=new Set(['individual','principal','admin','open-library','library','shop']);
const oldAreas:Record<string,number>={principal:67.5,admin:67.5,library:135,'open-library':101.25,shop:86.43};

export const places:Place[]=floorData[1].filter(c=>c.name).map((cell,index,cells)=>{
  const name=cell.name.replace(/\n/g,''),rect=cellRect(cell);
  const baseId=stableIds[name]??`${name==='계단'?'stair':'corridor'}-${cell.col}-${cell.row}`;
  const duplicate=cells.slice(0,index).filter(c=>c.name===cell.name).length;
  const id=stableIds[name]&&duplicate?`${baseId}-${duplicate+1}`:baseId;
  const enterable=roomIds.has(id),outdoor=name.startsWith('필로티')||name==='농구장';
  const passage=/복도|통로|현관|계단|로비|출입구|홀/.test(name);
  const middle:Point={x:(rect.minX+rect.maxX)/2,z:(rect.minZ+rect.maxZ)/2};
  let door={...middle},approach={...middle};
  if(enterable) {
    // The PDF has a continuous corridor along the entire south room frontage.
    door={x:middle.x,z:id==='shop'?rect.maxZ:rect.minZ};
    approach={x:door.x,z:door.z+(id==='shop'?.9:-.9)};
  } else if(!passage) {
    if(id==='dining') {
      door={x:rect.maxX,z:middle.z};approach={x:door.x+.9,z:door.z};
    } else if(id==='night-duty'||id==='staff-toilet') {
      door={x:rect.minX,z:middle.z};approach={x:door.x-.9,z:door.z};
    } else {
      door={x:middle.x,z:rect.maxZ};
      approach={x:door.x,z:door.z+.8};
    }
  }
  const area=oldAreas[id];
  const areaNote=area===undefined?undefined:`2023년 면적 자료의 참고값${id==='shop'||id==='open-library'?' — 과거와 현재 배치의 범위가 다름':''}. 현재 실측 면적이 아닙니다.`;
  const description=id==='individual'?'현재 개별화교육지원실입니다. 도면의 9×7.5m 구조 모듈과 과거 33.75㎡ 두 공간에 대응했으며, 현재 내부 칸막이는 실측하지 않았습니다.':
    id==='elevator-hall'?'현장 영상 00:51에서 확인한 엘리베이터 앞공간입니다. 정확한 내부 분할은 추정이며 층 이동은 아직 제공하지 않습니다.':
    id==='dining'?'북쪽통로와 서쪽 외부 계단으로 출입할 수 있는 급식실입니다. 식탁 배치와 조리 구역 경계는 실제 내부 자료 확인 전의 견본입니다.':
    passage?'PDF와 현장 영상의 연결을 따른 통행 공간입니다. 서편·북편·중앙·동편 계단에서 1~5층 계단참까지 오르내릴 수 있습니다.':
    enterable?'현재 공개 배치도의 실 이름입니다. 문을 열고 들어가 둘러볼 수 있습니다.':
    id.startsWith('parking')?'현장 영상과 주석 사진으로 확인한 기둥 아래 주차 공간입니다. 텃밭은 건물 밖 분리수거장 오른쪽 뒤편에 있으며 건물 전체 보기에서 확인할 수 있습니다.':
    outdoor?'공개 배치도와 현장 영상의 외부 공간입니다. 실제 면적은 확인되지 않았습니다.':'현재 안내도와 현장 설명의 공간입니다. 내부는 구현하지 않고 바깥에서 안내합니다.';
  return {id,name,rect,kind:outdoor?'outdoor':enterable?'room':'service',door,approach,enterable,...(area===undefined?{}:{area,areaNote}),description};
});

for(const portal of portals)places.push({id:portal.id,name:portal.name,rect:{minX:portal.approach.x-.1,maxX:portal.approach.x+.1,minZ:portal.approach.z-.1,maxZ:portal.approach.z+.1},kind:'service',enterable:false,door:portal.axis==='x'?{x:portal.at,z:portal.center}:{x:portal.center,z:portal.at},approach:portal.approach,description:'Space 또는 클릭으로 문을 열고 지나갈 수 있습니다.'});
for(const stair of stairs)places.push({id:stair.id,name:stair.name,rect:stair.rect,kind:'service',enterable:false,door:stairEntry(stair),approach:stairEntry(stair),description:'이동키나 화면 조이스틱으로 1~5층 계단과 계단참을 오르내려 보세요. 각 층의 복도와 교실로 이어집니다. 층간 높이 3.6m는 임시값입니다.'});
places.find(p=>p.id==='basketball')!.approach={...portals[0].approach};
places.find(p=>p.id==='entrance')!.approach={...lobbyExit};
places.find(p=>p.id==='west-entrance')!.approach={x:-36,z:schoolBounds.maxZ-1.2};
places.find(p=>p.id==='parking')!.approach={...portals[2].approach};
places.find(p=>p.id==='parking-2')!.approach.z=places.find(p=>p.id==='parking-2')!.rect.maxZ-1;
places.find(p=>p.id==='parking-entry')!.approach.z=stairs[2].rect.minZ-1;
places.find(p=>p.id==='dining')!.approach={...portals[3].approach};
for(const p of places.filter(p=>p.id.startsWith('stair-'))) {
  const nearby=stairs.find(s=>{const x=(s.rect.minX+s.rect.maxX)/2,z=(s.rect.minZ+s.rect.maxZ)/2;return x>=p.rect.minX&&x<=p.rect.maxX&&z>=p.rect.minZ&&z<=p.rect.maxZ;});
  p.approach=nearby?stairEntry(nearby):{x:0,z:6.8};
}

const libraryRect=places.find(p=>p.id==='library')!.rect;
const eastCorridor=cellRect(floorData[1].find(c=>c.name==='복도'&&c.col>23)!);
export const bookReturn:Rect={minX:libraryRect.minX-.4,maxX:libraryRect.minX+.4,minZ:eastCorridor.minZ+.06,maxZ:eastCorridor.minZ+.46};
export const securityBooth:Rect={minX:36.2,maxX:38.8,minZ:24.65,maxZ:26.75};
// A-202 east-wing grid: 10.8 m span, 8.4 + 8.4 + 8.2 m bays. Diameter remains estimated.
export const parkingColumns:Point[]=[70.2,81].flatMap(x=>[11.6,20,28.4,36.6].map(z=>({x:x-40.5,z:z-35.55})));
export const frontPlanters:Rect[]=Array.from({length:17},(_,i)=>-33+i*4).filter(x=>x<entranceRect.minX-1.5||x>entranceRect.maxX+1.5).map(x=>({minX:x-1.25,maxX:x+1.25,minZ:20.75,maxZ:22.05}));
// User-supplied Meshy residents; the principal also welcomes visitors at the gate.
export const schoolResidents=[
  {model:'principal-resident',roomId:'principal',x:-20.5,z:14.05,outside:false,rotation:0},
  {model:'principal-resident',roomId:'gate-welcome',x:46,z:23,outside:true,rotation:Math.PI/2},
  {model:'duty-resident',roomId:'night-duty',x:6.75,z:-7.55,outside:false,rotation:0},
  {model:'gate-resident',roomId:'security-booth',x:37.5,z:27.1,outside:true,rotation:0},
];
export const residentObstacles:Rect[]=schoolResidents.map(p=>({minX:p.x-.35,maxX:p.x+.35,minZ:p.z-.4,maxZ:p.z+.5}));
export const restroomFixtures=places.filter(p=>/화장실/.test(p.name)).flatMap(p=>[
  {roomId:p.id,model:'restroom-sink',x:p.rect.minX+.65,z:p.rect.minZ+.65},
  {roomId:p.id,model:'restroom-toilet',x:p.rect.maxX-.65,z:p.rect.minZ+.75},
]);
export const fixedObstacles:Rect[]=[bookReturn,securityBooth,...residentObstacles,...carObstacles,...recyclingObstacles,...gardenBeds,...frontPlanters,...boundaryWalls,...campusFences,...diningTables,...diningBenches,...parkingColumns.map(p=>({minX:p.x-.47,maxX:p.x+.47,minZ:p.z-.47,maxZ:p.z+.47}))];
export const outdoorGarden:Rect=gardenRect;

// The principal's standing desk and the 개별화교육지원실 desk stay; other rooms use groundFurniture.
export const furnishings:Furnishing[]=places.filter(p=>p.id==='principal'||p.id==='individual').flatMap<Furnishing>(p=>{
  const r=p.rect;
  return [{roomId:p.id,kind:'desk' as const,rect:{minX:r.minX+1,maxX:r.minX+3,minZ:r.minZ+2,maxZ:r.minZ+3.2}}];
});

// The second library video walks from 열린도서관 into 도서관 through folding glass doors.
const openLibraryRect=places.find(p=>p.id==='open-library')!.rect;
export const libraryPassage={x:libraryRect.minX,minZ:(libraryRect.minZ+libraryRect.maxZ)/2-1.6,maxZ:(libraryRect.minZ+libraryRect.maxZ)/2+1.6};
/** Library furniture modelled from the videos; solid pieces block walking. */
const roomRect=(id:'admin'|'individual'|'principal'|'shop')=>places.find(p=>p.id===id)!.rect;
export const groundFurniture=[...libraryLayout(openLibraryRect,libraryRect,libraryPassage),...groundRoomsLayout({admin:roomRect('admin'),individual:roomRect('individual'),principal:roomRect('principal'),shop:roomRect('shop')})].map(piece=>({...piece,rect:pieceRect(piece)}));

/** Room walls shared by rendering and navigation. Door gaps remain geometrically open. */
export function placeWalls(place:Place):Rect[] {
  const r=place.rect,t=wallThickness/2,d=doorWidth/2;
  const walls:Rect[]=[];
  for(const x of [r.minX,r.maxX]) {
    const passage=(place.id==='library'||place.id==='open-library')&&Math.abs(x-libraryPassage.x)<.001;
    for(const [a,b] of passage?[[r.minZ-t,libraryPassage.minZ],[libraryPassage.maxZ,r.maxZ+t]]:[[r.minZ-t,r.maxZ+t]])walls.push({minX:x-t,maxX:x+t,minZ:a!,maxZ:b!});
  }
  for(const z of [r.minZ,r.maxZ]) {
    if(place.enterable && Math.abs(place.door.z-z)<.001) walls.push(
      {minX:r.minX,maxX:place.door.x-d,minZ:z-t,maxZ:z+t},
      {minX:place.door.x+d,maxX:r.maxX,minZ:z-t,maxZ:z+t},
    );
    else walls.push({minX:r.minX,maxX:r.maxX,minZ:z-t,maxZ:z+t});
  }
  return walls;
}
