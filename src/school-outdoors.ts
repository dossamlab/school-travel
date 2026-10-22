import type {Point,Rect} from './school-layout.ts';
import {courtRect,courtAccess,courtDrop,groundHeight,diningStairs,diningLanding} from './school-structure.ts';

// Reference positions follow the supplied screenshots; heights remain provisional.
export const fieldDrop=1.8;
export const fieldRect:Rect={minX:-36,maxX:36,minZ:34,maxZ:82};
export const fieldStairs:Rect[]=[-35,-12,2].map(x=>({minX:x-1.8,maxX:x+1.8,minZ:29.5,maxZ:34}));
export const fieldRamps:Rect[]=[{minX:-44.5,maxX:-40.5,minZ:29.5,maxZ:34},{minX:40.5,maxX:49,minZ:29.5,maxZ:34}];
export const rostrum:Rect={minX:-10,maxX:0,minZ:29.8,maxZ:33.6};
// Satellite road alignment, fitted to the measured building; fence lengths are estimates.
export const campusGround:Rect={minX:-44.5,maxX:49,minZ:-38.5,maxZ:29.5};
export const lowerGround:Rect={minX:-44.5,maxX:49,minZ:34,maxZ:100};
export const eastWalk:Rect={minX:40.5,maxX:49,minZ:-36.5,maxZ:100};
export const gateApproach:Rect={minX:49,maxX:54,minZ:22.5,maxZ:27.5};
export const campusOutline:Point[]=[{x:-44.5,z:-38.5},{x:4,z:-38.5},{x:4,z:-36.5},{x:49,z:-36.5},{x:49,z:100},{x:-44.5,z:100}];
export const campusFences:Rect[]=campusOutline.flatMap((a,i)=>{
  const b=campusOutline[(i+1)%campusOutline.length],t=.06;
  const intervals=a.x===49&&b.x===49?[[a.z,gateApproach.minZ],[gateApproach.maxZ,b.z]]:[[a.z,b.z]];
  return intervals.map(([z1,z2])=>({minX:Math.min(a.x,b.x)-t,maxX:Math.max(a.x,b.x)+t,minZ:Math.min(z1,z2)-t,maxZ:Math.max(z1,z2)+t}));
});
export function insideCampusBoundary(p:Point):boolean {
  return p.x>=-44.5&&p.x<=49&&p.z>=-38.5&&p.z<=100&&(p.x<=4||p.z>=-36.5);
}
export const parkingWalkAreas:Rect[]=[
  {minX:40.5,maxX:47,minZ:-35.5,maxZ:25.5},
  {minX:29.7,maxX:47,minZ:-23.95,maxZ:1.05},
  {minX:18,maxX:31.5,minZ:-3.95,maxZ:5.55},
  {minX:5.5,maxX:29.7,minZ:-17.05,maxZ:-10.05},
  {minX:39.3,maxX:49,minZ:-36.5,maxZ:-23.95},
];
export const campusWalkAreas:Rect[]=[
  campusGround,...fieldStairs,...fieldRamps,lowerGround,eastWalk,gateApproach,
];
// Small overlaps allow crossing the door plane before the indoor scene takes over.
export const campusDoorways:Rect[]=[
  {minX:31.1,maxX:33,minZ:2.3,maxZ:4.3},
  {minX:4,maxX:7,minZ:-16.05,maxZ:-14.05},
  {minX:-5.5,maxX:-3,minZ:6.9,maxZ:8.7},
  {minX:-35.5,maxX:-33.3,minZ:-26.85,maxZ:-25.05},
  {minX:4,maxX:7,minZ:-13.15,maxZ:-11.15},
];
// Pastel visitor cars in the share-image palette: mint, butter, sky and peach.
export const parkedCars=[
  // Courtyard cars stand in the open north half so the upper corridor windows look down on them.
  {x:20.9,z:-1.5,color:0xa9d3c2,turn:0},
  {x:23.9,z:-1.5,color:0xf2dc9b,turn:0},
  {x:26.9,z:-1.5,color:0xf6c6d0,turn:0},
  {x:32,z:-17,color:0xa8cbe6,turn:Math.PI/2},
  {x:32,z:-10.5,color:0xf0bca4,turn:Math.PI/2},
];
export const carObstacles:Rect[]=parkedCars.map(p=>({minX:p.x-(p.turn?2.1:.95),maxX:p.x+(p.turn?2.1:.95),minZ:p.z-(p.turn?.95:2.1),maxZ:p.z+(p.turn?.95:2.1)}));
export const recyclingPoint:Point={x:42,z:-30.8};
export const gardenRect:Rect={minX:44,maxX:49,minZ:-35.5,maxZ:-30.8};
export const recyclingObstacles:Rect[]=[
  ...Array.from({length:3},(_,i)=>({minX:recyclingPoint.x-1+i-.425,maxX:recyclingPoint.x-1+i+.425,minZ:recyclingPoint.z-.425,maxZ:recyclingPoint.z+.425})),
  ...[-1.4,1.4].flatMap(x=>[-1,1].map(z=>({minX:recyclingPoint.x+x-.055,maxX:recyclingPoint.x+x+.055,minZ:recyclingPoint.z+z-.055,maxZ:recyclingPoint.z+z+.055}))),
];
export const gardenBeds:Rect[]=Array.from({length:3},(_,row)=>({minX:gardenRect.minX+.5,maxX:gardenRect.maxX-.5,minZ:gardenRect.minZ+.8+row*1.5-.525,maxZ:gardenRect.minZ+.8+row*1.5+.525}));
export const containsOutdoor=(p:Point,r:Rect)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;
// Exterior grade falls gradually towards the north/west courtyard; indoor floors stay level.
export function exteriorGrade(p:Point):number {
  const west=Math.max(0,Math.min(1,(-4.5-p.x)/9));
  const north=Math.max(0,Math.min(1,(20.25-p.z)/(20.25-courtRect.maxZ)));
  return -courtDrop*west*north;
}
export function campusHeight(p:Point):number {
  const stair=[...fieldStairs,...fieldRamps].find(r=>containsOutdoor(p,r));
  if(stair)return -fieldDrop*Math.max(0,Math.min(1,(p.z-stair.minZ)/(stair.maxZ-stair.minZ)));
  if(containsOutdoor(p,courtAccess))return groundHeight(p);
  if(containsOutdoor(p,diningStairs))return groundHeight(p);
  if(containsOutdoor(p,diningLanding)||containsOutdoor(p,campusDoorways[3]))return 0;
  if(containsOutdoor(p,courtRect))return -courtDrop;
  return containsOutdoor(p,lowerGround)?-fieldDrop:exteriorGrade(p);
}
export function campusEntrancePoint(id:string):Point {
  return {x:id==='west-entrance'?-38.25:id==='east-passage'?38.25:0,z:id==='east-passage'?16.95:21.45};
}
export function canInteractFromCampus(id:string,p:Point):boolean {
  if(['entrance','east-passage','west-entrance'].includes(id)) {
    const entrance=campusEntrancePoint(id),halfWidth=id==='west-entrance'?1.2:id==='east-passage'?2.2:3.8;
    return p.z>=entrance.z-.8&&p.z<=entrance.z+3.05&&Math.abs(p.x-entrance.x)<=halfWidth;
  }
  return ['east-parking-door','north-parking-door','north-secondary-parking-door','court-door','dining-exit','shop'].includes(id);
}
