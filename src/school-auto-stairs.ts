import {stairs,stairEntry,stairPoint,stairSupport} from './school-structure.ts';
import {findSchoolPath,moveSchoolVisitor,type VisitorPosition} from './school-navigation.ts';
import {onFloorLevel,walkingFloor} from './school-upper-floors.ts';
import type {Point} from './school-layout.ts';

export type SchoolStair=typeof stairs[number];
export function stairApproach(stair:SchoolStair,floor:number):Point {
  if(floor===1)return stairEntry(stair);
  const start=stairPoint(stair,.6,stair.id==='stairs-east'?.9:3.1);
  return stair.id==='stairs-east'?{x:start.x,z:5.9}:stair.id==='stairs-central'?{x:start.x,z:6.6}:stair.id==='stairs-west'?{x:start.x,z:11.4}:{x:2.9,z:start.z};
}

export function nearbyStair(position:VisitorPosition):SchoolStair|undefined {
  if(!onFloorLevel(position.y))return;
  const support=stairSupport(position,position.y);
  if(support)return stairs.find(s=>s.id===support.stairId);
  const floor=walkingFloor(position.y);
  return stairs.find(s=>{const p=stairApproach(s,floor);return Math.hypot(p.x-position.x,p.z-position.z)<1.9;});
}

// Route along both flights and the intermediate landing, never through the stairwell void.
export function automaticStairPath(start:VisitorPosition,stair:SchoolStair,toFloor:number,doors:ReadonlySet<string>):Point[] {
  const fromFloor=walkingFloor(start.y);
  if(!onFloorLevel(start.y)||Math.abs(toFloor-fromFloor)!==1||toFloor<1||toFloor>5)return [];
  const approach=stairApproach(stair,fromFloor),support=stairSupport(start,start.y);
  const approachPath=support?.stairId===stair.id?[{x:start.x,z:start.z}]:findSchoolPath(start,approach,'floor1',doors,fromFloor);
  if(!approachPath.length)return [];
  const a=stairPoint(stair,.6,3.1),b=stairPoint(stair,5.2,3.1),c=stairPoint(stair,5.2,.9),d=stairPoint(stair,.6,.9);
  // Enter / leave east stairs through the lower-z side of the same full-height landing.
  const entrance=stairPoint(stair,.6,stair.id==='stairs-east'?.9:3.1);
  return [...approachPath,entrance,...(toFloor>fromFloor?[a,b,c,d]:[d,c,b,a]),entrance,stairApproach(stair,toFloor)];
}

export function advanceStairRoute(start:VisitorPosition,path:readonly Point[],travel:number,doors:ReadonlySet<string>) {
  let position={...start},consumed=0;
  // Ignore floating-point residue after subdividing one animation frame.
  while(travel>1e-8&&consumed<path.length){
    const target=path[consumed],length=Math.hypot(target.x-position.x,target.z-position.z);
    if(length<1e-8){consumed++;continue;}
    const step=Math.min(length,travel,.04);
    const next=moveSchoolVisitor(position,{x:(target.x-position.x)/length*step,z:(target.z-position.z)/length*step},'floor1',doors);
    if(Math.hypot(next.x-position.x,next.z-position.z)<step*.5)return {position,consumed,blocked:true};
    position=next;travel-=step;if(step===length)consumed++;
  }
  return {position,consumed,blocked:false};
}

