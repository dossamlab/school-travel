import {places,furnishings,groundFurniture,fixedObstacles,floorVoids,schoolBounds,campusBounds,campusInteriors,campusFrontSolids,placeWalls,doorWidth,wallThickness,characterRadius,type Point,type Rect,type TourMode} from './school-layout.ts';
import {portals,portalLeaf,stairGroundObstacles,stairSupport,surfaceHeight,groundHeight,diningHall,diningVestibule} from './school-structure.ts';
import {campusWalkAreas,campusDoorways,containsOutdoor,campusHeight,rostrum,insideCampusBoundary,gateApproach} from './school-outdoors.ts';
import {upperRooms,upperFurniture,upperProps,upperResidentObstacles,upperRoomWalls,upperDoorLeaf,upperFloorSurface,walkingFloor,onFloorLevel} from './school-upper-floors.ts';
import {floorRise} from './school-structure.ts';

const roomWalls=places.filter(p=>p.enterable).flatMap(placeWalls);
const solidServices=places.filter(p=>p.kind==='service' && !portals.some(portal=>portal.id===p.id) && !/복도|통로|현관|계단|로비|출입구|출입문|유리문|홀/.test(p.name)).flatMap(p=>p.id==='dining'?[
  {...p.rect,minX:diningVestibule.maxX,maxZ:diningHall.minZ},
  {...p.rect,maxX:diningVestibule.maxX,maxZ:diningVestibule.minZ},
]:[p.rect]);
const campusOuter:Rect=campusBounds;
const campusExclusions:Rect[]=[
  rostrum,
  ...campusFrontSolids.flatMap(r=>{
    // The court exit crosses the lobby facade before the visitor has cleared its thickness.
    const doorway=campusDoorways[2];
    const a=Math.max(r.minX,doorway.minX),b=Math.min(r.maxX,doorway.maxX),c=Math.max(r.minZ,doorway.minZ),d=Math.min(r.maxZ,doorway.maxZ);
    if(a>=b||c>=d)return [r];
    return [{...r,maxX:a},{...r,minX:b},{minX:a,maxX:b,minZ:r.minZ,maxZ:c},{minX:a,maxX:b,minZ:d,maxZ:r.maxZ}].filter(r=>r.maxX>r.minX&&r.maxZ>r.minZ);
  }),
];
const gridStep=.5;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.z);
const onCampusSurface=(p:Point)=>Array.from({length:8},(_,i)=>({x:p.x+Math.cos(i*Math.PI/4)*characterRadius,z:p.z+Math.sin(i*Math.PI/4)*characterRadius})).every(p=>(insideCampusBoundary(p)||containsOutdoor(p,gateApproach))&&campusWalkAreas.some(r=>containsOutdoor(p,r))&&(!campusInteriors.some(r=>containsOutdoor(p,r))||campusDoorways.some(r=>containsOutdoor(p,r))));
export function schoolInputDirection(x:number,y:number):Point {
  const length=Math.hypot(x,y)*Math.SQRT2;
  if(!length)return {x:0,z:0};
  // Keep diagonal controls parallel to the school axes, including camera transitions.
  return {x:(x+y)/length,z:(y-x)/length};
}
let geometryKey='';
let obstacles:Rect[]=[];

function collisionGeometry(doors:ReadonlySet<string>,floor=1):Rect[] {
  const key=`${floor}:${[...doors].sort().join(',')}`;
  if(obstacles.length && key===geometryKey) return obstacles;
  geometryKey=key;
  if(floor>1) {
    const rooms=upperRooms.filter(r=>r.floor===floor);
    obstacles=[...rooms.flatMap(upperRoomWalls),...rooms.filter(r=>!doors.has(r.id)).map(upperDoorLeaf),...upperFurniture.filter(f=>f.floor===floor).map(f=>f.rect),...upperProps.filter(p=>p.floor===floor&&p.solid).map(p=>p.rect),...upperResidentObstacles.filter(p=>p.floor===floor).map(p=>p.rect),...stairGroundObstacles];
    return obstacles;
  }
  const closedLeaves=places.filter(p=>p.enterable&&!doors.has(p.id)).map(p=>({
    minX:p.door.x-doorWidth/2,maxX:p.door.x+doorWidth/2,
    minZ:p.door.z-wallThickness/2,maxZ:p.door.z+wallThickness/2,
  }));
  obstacles=[...roomWalls,...solidServices,...furnishings.map(f=>f.rect),...groundFurniture.filter(f=>f.solid).map(f=>f.rect),...fixedObstacles,...stairGroundObstacles,...closedLeaves,...portals.filter(p=>!doors.has(p.id)).map(portalLeaf)];
  return obstacles;
}

function pointRectDistanceSq(point:Point,rect:Rect):number {
  const dx=point.x-Math.max(rect.minX,Math.min(rect.maxX,point.x));
  const dz=point.z-Math.max(rect.minZ,Math.min(rect.maxZ,point.z));
  return dx*dx+dz*dz;
}

function pointSegmentDistanceSq(point:Point,start:Point,end:Point):number {
  const dx=end.x-start.x,dz=end.z-start.z,lengthSq=dx*dx+dz*dz;
  const t=lengthSq?Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.z-start.z)*dz)/lengthSq)):0;
  return (point.x-start.x-dx*t)**2+(point.z-start.z-dz*t)**2;
}

function segmentRectDistanceSq(start:Point,end:Point,rect:Rect):number {
  // Intersect both rectangle slabs to detect a segment crossing its interior.
  let enter=0,exit=1;
  for(const [origin,delta,min,max] of [[start.x,end.x-start.x,rect.minX,rect.maxX],[start.z,end.z-start.z,rect.minZ,rect.maxZ]]) {
    if(delta===0) {
      if(origin<min||origin>max) {enter=Infinity;break;}
    } else {
      const a=(min-origin)/delta,b=(max-origin)/delta;
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    }
  }
  if(enter<=exit) return 0;
  // For disjoint segments/rectangles, the nearest pair includes an endpoint or corner.
  let result=Math.min(pointRectDistanceSq(start,rect),pointRectDistanceSq(end,rect));
  for(const x of [rect.minX,rect.maxX]) for(const z of [rect.minZ,rect.maxZ]) result=Math.min(result,pointSegmentDistanceSq({x,z},start,end));
  return result;
}

function segmentBlocked(start:Point,end:Point,rect:Rect):boolean {
  const r=characterRadius;
  if(Math.max(start.x,end.x)<rect.minX-r||Math.min(start.x,end.x)>rect.maxX+r||
    Math.max(start.z,end.z)<rect.minZ-r||Math.min(start.z,end.z)>rect.maxZ+r) return false;
  return segmentRectDistanceSq(start,end,rect)<=r*r;
}

function walkable(point:Point,mode:TourMode,geometry:Rect[],floor=1):boolean {
  if(!finite(point)) return false;
  const r=characterRadius,bounds=mode==='floor1'?schoolBounds:campusOuter;
  if(point.x<bounds.minX+r||point.x>bounds.maxX-r||point.z<bounds.minZ+r||point.z>bounds.maxZ-r) return false;
  if(mode==='campus'&&campusExclusions.some(rect=>pointRectDistanceSq(point,rect)<=r*r)) return false;
  if(mode==='campus'&&!onCampusSurface(point))return false;
  if(mode==='floor1'&&floor===1&&floorVoids.some(rect=>pointRectDistanceSq(point,rect)<=r*r)) return false;
  if(mode==='floor1'&&floor>1&&!Array.from({length:8},(_,i)=>({x:point.x+Math.cos(i*Math.PI/4)*r,z:point.z+Math.sin(i*Math.PI/4)*r})).every(p=>upperFloorSurface(p,floor)))return false;
  return !geometry.some(rect=>pointRectDistanceSq(point,rect)<=r*r);
}

function clearSegment(start:Point,end:Point,mode:TourMode,geometry:Rect[],floor=1):boolean {
  if(!walkable(start,mode,geometry,floor)||!walkable(end,mode,geometry,floor)) return false;
  if(mode==='campus'&&campusExclusions.some(rect=>segmentBlocked(start,end,rect))) return false;
  if(mode==='campus') {
    let height=campusHeight(start);
    for(let i=1,n=Math.max(1,Math.ceil(distance(start,end)/.1));i<=n;i++) {
      const p={x:start.x+(end.x-start.x)*i/n,z:start.z+(end.z-start.z)*i/n},nextHeight=campusHeight(p);
      if(!onCampusSurface(p)||Math.abs(nextHeight-height)>.12)return false;
      height=nextHeight;
    }
  }
  if(mode==='floor1'&&floor===1&&floorVoids.some(rect=>segmentBlocked(start,end,rect))) return false;
  if(mode==='floor1'&&floor>1)for(let i=1,n=Math.ceil(distance(start,end)/.12);i<n;i++)if(!walkable({x:start.x+(end.x-start.x)*i/n,z:start.z+(end.z-start.z)*i/n},mode,geometry,floor))return false;
  // The outer bound is convex; safe endpoints also contain the entire segment.
  return !geometry.some(rect=>segmentBlocked(start,end,rect));
}

export function isWalkable(point:Point,mode:TourMode,openDoors:ReadonlySet<string>,floor=1):boolean {
  return walkable(point,mode,collisionGeometry(openDoors,floor),floor);
}

export function moveInSchool(start:Point,delta:Point,mode:TourMode,openDoors:ReadonlySet<string>,floor=1):Point {
  if(!finite(start)||!finite(delta)) return {...start};
  const end={x:start.x+delta.x,z:start.z+delta.z};
  return clearSegment(start,end,mode,collisionGeometry(openDoors,floor),floor)?end:{...start};
}

export type VisitorPosition=Point&{y:number};
/** Resolve small continuous steps against the current height, never the floor above/below. */
export function moveSchoolVisitor(start:VisitorPosition,delta:Point,mode:TourMode,openDoors:ReadonlySet<string>):VisitorPosition {
  if(!finite(start)||!finite(delta)||!Number.isFinite(start.y))return {...start};
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.06));
  if(steps>10000)return {...start};
  let position={...start};
  for(let i=0;i<steps;i++) {
    const next={x:position.x+delta.x/steps,z:position.z+delta.z/steps};
    const current=mode==='floor1'?stairSupport(position,position.y):undefined;
    const support=mode==='floor1'?stairSupport(next,position.y):undefined;
    if(support&&(current||support.kind==='landing'&&onFloorLevel(position.y))) {
      const y=surfaceHeight(support,next);
      const safe=Array.from({length:8},(_,j)=>({x:next.x+Math.cos(j*Math.PI/4)*characterRadius,z:next.z+Math.sin(j*Math.PI/4)*characterRadius})).every(p=>{
        if(stairSupport(p,y))return true;
        return support.kind==='landing'&&onFloorLevel(y)&&isWalkable(p,mode,openDoors,walkingFloor(y));
      });
      if(!safe)break;
      position={...next,y};continue;
    }
    const floor=mode==='floor1'?walkingFloor(position.y):1;
    const y=mode==='floor1'?(floor>1?(floor-1)*floorRise:groundHeight(next)):campusHeight(next);
    if(Math.abs(y-position.y)>.12)break;
    const moved=moveInSchool(position,{x:next.x-position.x,z:next.z-position.z},mode,openDoors,floor);
    if(moved.x===position.x&&moved.z===position.z)break;
    position={...next,y};
  }
  return position;
}

export function advanceSchoolRoute(start:Point,path:readonly Point[],travelDistance:number,mode:TourMode,openDoors:ReadonlySet<string>,floor=1):{position:Point;consumed:number;blocked:boolean} {
  let position={...start},remaining=travelDistance,consumed=0;
  while(remaining>0&&consumed<path.length) {
    const target=path[consumed],length=distance(position,target),step=Math.min(length,remaining);
    if(length===0) {consumed++;continue;}
    const reached=step===length;
    const delta=reached?{x:target.x-position.x,z:target.z-position.z}:{x:(target.x-position.x)/length*step,z:(target.z-position.z)/length*step};
    const next=moveInSchool(position,delta,mode,openDoors,floor);
    if(next.x===position.x&&next.z===position.z) return {position,consumed,blocked:true};
    remaining-=step;
    // Consume a corner only after completing its segment, preserving the exact next start.
    position=reached?{...target}:next;
    if(reached) consumed++;
  }
  return {position,consumed,blocked:false};
}

type Grid={key:string;minX:number;minZ:number;cols:number;rows:number;valid:Uint8Array;edges:Uint8Array};
let cachedGrid:Grid|undefined;
const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

function navigationGrid(mode:TourMode,geometry:Rect[],floor=1):Grid {
  const key=`${mode}:${geometryKey}`;
  if(cachedGrid?.key===key) return cachedGrid;
  const bounds=mode==='floor1'?schoolBounds:campusOuter;
  const cols=Math.floor((bounds.maxX-bounds.minX)/gridStep),rows=Math.floor((bounds.maxZ-bounds.minZ)/gridStep);
  const grid:Grid={key,minX:bounds.minX+gridStep/2,minZ:bounds.minZ+gridStep/2,cols,rows,valid:new Uint8Array(cols*rows),edges:new Uint8Array(cols*rows*8)};
  for(let i=0;i<grid.valid.length;i++) grid.valid[i]=walkable(gridPoint(grid,i),mode,geometry,floor)?1:0;
  cachedGrid=grid;
  return grid;
}

function gridPoint(grid:Grid,index:number):Point {
  return {x:grid.minX+(index%grid.cols)*gridStep,z:grid.minZ+Math.floor(index/grid.cols)*gridStep};
}

function nearestNode(point:Point,grid:Grid,mode:TourMode,geometry:Rect[],floor=1):number {
  const col=Math.round((point.x-grid.minX)/gridStep),row=Math.round((point.z-grid.minZ)/gridStep);
  let nearest=-1,best=Infinity;
  for(let z=row-2;z<=row+2;z++) for(let x=col-2;x<=col+2;x++) {
    if(x<0||x>=grid.cols||z<0||z>=grid.rows) continue;
    const index=z*grid.cols+x,target=gridPoint(grid,index),length=distance(point,target);
    if(grid.valid[index]&&length<best&&clearSegment(point,target,mode,geometry,floor)) {nearest=index;best=length;}
  }
  return nearest;
}

type QueueEntry={index:number;score:number};
function push(queue:QueueEntry[],entry:QueueEntry) {
  queue.push(entry);
  let i=queue.length-1;
  while(i>0) {
    const parent=(i-1)>>1;
    if(queue[parent].score<=entry.score) break;
    queue[i]=queue[parent];i=parent;
  }
  queue[i]=entry;
}
function pop(queue:QueueEntry[]):QueueEntry {
  const first=queue[0],last=queue.pop()!;
  if(queue.length) {
    let i=0;
    while(i*2+1<queue.length) {
      let child=i*2+1;
      if(child+1<queue.length&&queue[child+1].score<queue[child].score) child++;
      if(queue[child].score>=last.score) break;
      queue[i]=queue[child];i=child;
    }
    queue[i]=last;
  }
  return first;
}

export function findSchoolPath(start:Point,goal:Point,mode:TourMode,openDoors:ReadonlySet<string>,floor=1):Point[] {
  const geometry=collisionGeometry(openDoors,floor);
  if(!walkable(start,mode,geometry,floor)||!walkable(goal,mode,geometry,floor)) return [];
  if(distance(start,goal)<1e-9) return [{...start}];
  if(clearSegment(start,goal,mode,geometry,floor)) return [{...start},{...goal}];
  const grid=navigationGrid(mode,geometry,floor),from=nearestNode(start,grid,mode,geometry,floor),to=nearestNode(goal,grid,mode,geometry,floor);
  if(from<0||to<0) return [];
  const costs=new Float64Array(grid.valid.length).fill(Infinity),parents=new Int32Array(grid.valid.length).fill(-1),visited=new Uint8Array(grid.valid.length);
  const queue:QueueEntry[]=[];
  costs[from]=0;push(queue,{index:from,score:distance(gridPoint(grid,from),goal)});
  while(queue.length) {
    const current=pop(queue).index;
    if(visited[current]) continue;
    visited[current]=1;
    if(current===to) {
      const nodes:Point[]=[];
      for(let i=to;i!==-1;i=parents[i]) nodes.push(gridPoint(grid,i));
      const raw=[{...start},...nodes.reverse(),{...goal}],path:Point[]=[raw[0]];
      let index=0;
      while(index<raw.length-1) {
        let next=index+1;
        while(next+1<raw.length&&clearSegment(raw[index],raw[next+1],mode,geometry,floor)) next++;
        path.push(raw[next]);index=next;
      }
      return path;
    }
    const point=gridPoint(grid,current),col=current%grid.cols,row=Math.floor(current/grid.cols);
    for(let d=0;d<directions.length;d++) {
      const [dx,dz]=directions[d],x=col+dx,z=row+dz;
      if(x<0||x>=grid.cols||z<0||z>=grid.rows) continue;
      const neighbor=z*grid.cols+x;
      if(!grid.valid[neighbor]||visited[neighbor]) continue;
      const edge=current*8+d,target=gridPoint(grid,neighbor);
      if(!grid.edges[edge]) grid.edges[edge]=clearSegment(point,target,mode,geometry,floor)?2:1;
      if(grid.edges[edge]!==2) continue;
      const cost=costs[current]+gridStep*(dx&&dz?Math.SQRT2:1);
      if(cost>=costs[neighbor]) continue;
      costs[neighbor]=cost;parents[neighbor]=current;
      push(queue,{index:neighbor,score:cost+distance(target,gridPoint(grid,to))});
    }
  }
  return [];
}
