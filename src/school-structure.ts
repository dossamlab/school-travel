import type {Point,Rect} from './school-layout.ts';

// Reference-line metres from A-202. Heights and current door positions are estimates.
export const floorRise=3.6;
export const courtSteps=10;
export const courtDrop=courtSteps*.18;
export const planRect=(x:number,z:number,w:number,d:number):Rect=>({minX:x-40.5,maxX:x+w-40.5,minZ:z-35.55,maxZ:z+d-35.55});
export const contains=(p:Point,r:Rect)=>p.x>=r.minX-1e-7&&p.x<=r.maxX+1e-7&&p.z>=r.minZ-1e-7&&p.z<=r.maxZ+1e-7;
export const courtRect=planRect(15,33.6,12,12);
export const courtAccess=planRect(27,41.1,9,4.5);
export const courtRamp=planRect(32.25,41.1,2.25,4.5);
// West dining exit: ten estimated 18 cm risers, with a level door landing.
export const diningStairs=planRect(1.5,8.1,3,3);
export const diningLanding=planRect(4.5,8.1,1.5,3);
export const diningVestibule=planRect(6,3.6,4.5,8);
export const diningHall:Rect={minX:-34.5,maxX:1.5,minZ:-23.95,maxZ:-3.95};
// A-202 local grid fit; these wall-line dimensions are estimates, not surveyed clear widths.
export const northStairHall=planRect(42,13.4,7.5,5.1);
export const northExitHall=planRect(42,18.5,4,7);
export const northDutyRoom=planRect(45,25.5,4.5,5);
export const diningTables:Rect[]=[-15.6,-7.8].flatMap(z=>Array.from({length:6},(_,i)=>({minX:-31+i*5,maxX:-28+i*5,minZ:z-.7,maxZ:z+.7})));
export const diningBenches:Rect[]=diningTables.flatMap(r=>[r.minZ-.55,r.maxZ+.55].map(z=>({minX:r.minX,maxX:r.maxX,minZ:z-.2,maxZ:z+.2})));
export function groundHeight(p:Point):number {
  if(contains(p,diningStairs))return -courtDrop*(1-(p.x-diningStairs.minX)/(diningStairs.maxX-diningStairs.minX));
  if(contains(p,courtRect))return -courtDrop;
  if(contains(p,courtAccess))return -courtDrop*(1-Math.max(0,Math.min(1,(p.x-courtRamp.minX)/(courtRamp.maxX-courtRamp.minX))));
  return 0;
}
export const stairs=[
  {id:'stairs-west',name:'서편 계단',rect:planRect(5.8,41.1,5.8,4.5)},
  {id:'stairs-north',name:'북편 계단 · 송천홀 방향',rect:planRect(44.2,13.4,5.3,4.8)},
  {id:'stairs-east',name:'동편 계단',rect:planRect(74.5,36.6,5.8,4.5)},
  {id:'stairs-central',name:'중앙계단',rect:planRect(37.5,33.6,4.5,7.5)},
];
// East stairs ascend west along the north wall, to the right of the west-facing exit.
export const stairPoint=(s:typeof stairs[number],x:number,z:number):Point=>{
  const w=s.rect.maxX-s.rect.minX,d=s.rect.maxZ-s.rect.minZ;
  if(s.id==='stairs-central')return {x:s.rect.minX+z*w/4,z:s.rect.maxZ-x*d/5.8};
  return s.id==='stairs-east'?{x:s.rect.maxX-x*w/5.8,z:s.rect.maxZ-z*d/4}:{x:s.rect.minX+x*w/5.8,z:s.rect.minZ+z*d/4};
};
function stairRect(s:typeof stairs[number],r:Rect):Rect {
  const a=stairPoint(s,r.minX,r.minZ),b=stairPoint(s,r.maxX,r.maxZ);
  return {minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z)};
}
export const parkingConnector=planRect(46,18.5,24.2,7);
export const extraFloors=[courtAccess,stairs[1].rect,stairs[2].rect,stairs[3].rect,parkingConnector,planRect(70.2,36.6,1.8,4.5),diningStairs,diningLanding];
export type Portal={id:string;name:string;axis:'x'|'z';at:number;center:number;width:number;approach:Point;double?:boolean;steel?:boolean;hideSign?:boolean};
export const portals:Portal[]=[
  {id:'court-door',name:'농구장 유리문',axis:'x',at:-4.5,center:7.8,width:1.8,approach:{x:-3.5,z:7.8}},
  {id:'north-parking-door',name:'북편 주차장 출입문',axis:'x',at:5.5,center:-15.05,width:2,approach:{x:4.5,z:-15.05},double:true},
  {id:'east-parking-door',name:'동편 주차장 출입문',axis:'x',at:31.5,center:3.3,width:1.8,approach:{x:32.5,z:3.3}},
  {id:'dining-door',name:'급식실 정문 · 유리문',axis:'x',at:1.5,center:-20.05,width:2.4,approach:{x:2.5,z:-20.05},double:true},
  {id:'dining-exit',name:'급식실 외부 출입문',axis:'x',at:-34.5,center:-25.95,width:1.8,approach:{x:-33.5,z:-25.95}},
  {id:'north-secondary-parking-door',name:'북편 주차장 출입문',axis:'x',at:5.5,center:-12.15,width:2,approach:{x:4.5,z:-12.15},double:true,hideSign:true},
  {id:'dining-side-door',name:'급식실 측문',axis:'z',at:-22.15,center:2.4,width:1.2,approach:{x:2.4,z:-21.35},steel:true},
];
export function portalLeaf(p:Portal):Rect {
  return p.axis==='x'?{minX:p.at-.08,maxX:p.at+.08,minZ:p.center-p.width/2,maxZ:p.center+p.width/2}:{minX:p.center-p.width/2,maxX:p.center+p.width/2,minZ:p.at-.08,maxZ:p.at+.08};
}
function wall(axis:'x'|'z',at:number,from:number,to:number):Rect {
  return axis==='x'?{minX:at-.08,maxX:at+.08,minZ:from,maxZ:to}:{minX:from,maxX:to,minZ:at-.08,maxZ:at+.08};
}
function splitWall(axis:'x'|'z',at:number,from:number,to:number,gaps:[number,number][]):Rect[] {
  const result:Rect[]=[];let start=from;
  for(const [a,b] of gaps.sort((a,b)=>a[0]-b[0])){if(a>start)result.push(wall(axis,at,start,a));start=b;}
  if(start<to)result.push(wall(axis,at,start,to));return result;
}
export const boundaryWalls:Rect[]=[
  ...splitWall('x',diningHall.minX,-35.55,diningHall.maxZ,[[-26.85,-25.05]]),
  wall('x',diningVestibule.maxX,diningVestibule.minZ,diningVestibule.maxZ),
  wall('z',diningVestibule.minZ,diningVestibule.minX,diningVestibule.maxX),
  ...splitWall('x',diningHall.maxX,northStairHall.minZ,diningHall.maxZ,[[-21.25,-18.85]]),
  wall('z',diningHall.maxZ,diningHall.minX,diningHall.maxX),
  wall('z',diningHall.minZ,diningVestibule.maxX,4.5),
  // Court and its stair access cannot be entered from the office frontage.
  wall('z',10.05,-25.5,-4.5),wall('z',5.55,-13.5,-4.5),
  ...splitWall('x',-4.5,5.55,10.05,[[6.9,8.7]]),
  // Main corridor: 2.7 m reference-line width, 0.16 m estimated partition.
  wall('z',5.55,18,31.5),
  wall('z',1.05,31.5,40.5),
  ...splitWall('x',31.5,1.05,5.55,[[2.4,4.2]]),
  wall('x',18,1.05,5.55),
  // East wing / north passage is enclosed except the marked openings.
  wall('x',4.5,-23.95,-22.15),
  ...splitWall('z',northStairHall.minZ,1.5,9,[[1.8,3]]),
  wall('x',northStairHall.maxX,northStairHall.minZ,northStairHall.maxZ),
  wall('z',northStairHall.maxZ,northExitHall.maxX,northStairHall.maxX),
  ...splitWall('x',northExitHall.maxX,northExitHall.minZ,northExitHall.maxZ,[[-16.05,-14.05],[-13.15,-11.15]]),
  wall('z',northExitHall.maxZ,4.5,northExitHall.maxX),
  wall('x',4.5,northDutyRoom.maxZ,-3.95),
];
export type StairSurface={stairId:string;floor:number;kind:'landing'|'flight';rect:Rect;localRect:Rect;axis:'x'|'z';leftHeight:number;rightHeight:number};
export const stairSurfaces:StairSurface[]=stairs.flatMap(stair=>{
  const x=0,z=0,result:StairSurface[]=[];
  function add(floor:number,kind:StairSurface['kind'],localRect:Rect,left:number,right:number) {
    const reversed=stair.id==='stairs-east'||stair.id==='stairs-central';
    result.push({stairId:stair.id,floor,kind,rect:stairRect(stair,localRect),localRect,axis:stair.id==='stairs-central'?'z':'x',leftHeight:reversed?right:left,rightHeight:reversed?left:right});
  }
  for(let floor=1;floor<=5;floor++) {
    const h=(floor-1)*floorRise;
    add(floor,'landing',{minX:x,maxX:x+1.2,minZ:z,maxZ:z+4},h,h);
    if(floor===5)continue;
    add(floor,'flight',{minX:x+1.2,maxX:x+4.6,minZ:z+2.2,maxZ:z+4},h,h+floorRise/2);
    add(floor,'landing',{minX:x+4.6,maxX:x+5.8,minZ:z,maxZ:z+4},h+floorRise/2,h+floorRise/2);
    add(floor,'flight',{minX:x+1.2,maxX:x+4.6,minZ:z,maxZ:z+1.8},h+floorRise,h+floorRise/2);
  }
  return result;
});
export const stairGroundObstacles=stairs.map(s=>stairRect(s,{minX:1.2,maxX:5.8,minZ:0,maxZ:4}));
export function surfaceHeight(s:StairSurface,p:Point):number {
  const ratio=s.axis==='x'?(p.x-s.rect.minX)/(s.rect.maxX-s.rect.minX):(p.z-s.rect.minZ)/(s.rect.maxZ-s.rect.minZ);
  return s.leftHeight+(s.rightHeight-s.leftHeight)*ratio;
}
export function stairSupport(p:Point,height:number):StairSurface|undefined {
  return stairSurfaces.filter(s=>contains(p,s.rect)&&Math.abs(surfaceHeight(s,p)-height)<.16).sort((a,b)=>Math.abs(surfaceHeight(a,p)-height)-Math.abs(surfaceHeight(b,p)-height))[0];
}
export const stairEntry=(s:typeof stairs[number]):Point=>s.id==='stairs-east'?stairPoint(s,.6,-.65):stairPoint(s,s.id==='stairs-west'?.6:-.65,s.id==='stairs-west'?4.65:3.1);
