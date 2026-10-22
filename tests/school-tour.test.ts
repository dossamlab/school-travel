import test from 'node:test';
import assert from 'node:assert/strict';
import {tourCourses,tourStopPoint,reachedTourStop} from '../src/school-tour.ts';
import {places,gateSpawn} from '../src/school-layout.ts';
import {findSchoolPath,advanceSchoolRoute} from '../src/school-navigation.ts';
import {upperRooms} from '../src/school-upper-floors.ts';
import {stairs,portals,floorRise} from '../src/school-structure.ts';
import {automaticStairPath,advanceStairRoute} from '../src/school-auto-stairs.ts';

for(const course of tourCourses)test(`${course.name}: every stop is reachable in order through doors and stairs`,()=>{
  let position={...gateSpawn,y:0},mode:'campus'|'floor1'='campus',floor=1;
  const doors=new Set<string>();
  for(const stop of course.stops){
    assert.ok([...places,...upperRooms].some(place=>place.id===stop.placeId));
    if(mode==='campus'&&stop.mode==='floor1'&&position.z>20){position={...places.find(p=>p.id==='entrance')!.approach,y:0};mode='floor1';}
    if(floor!==(stop.floor??1)){
      const path=automaticStairPath(position,stairs.find(s=>s.id==='stairs-north')!,stop.floor!,doors);
      assert.ok(path.length);
      for(let ticks=0;path.length&&ticks<10000;ticks++){const step=advanceStairRoute(position,path,.1,doors);assert.equal(step.blocked,false);position=step.position;path.splice(0,step.consumed);}
      assert.equal(path.length,0);floor=stop.floor!;
    }
    const target=tourStopPoint(stop),pathMode=stop.placeId==='entrance'&&stop.mode==='campus'?'campus':'floor1';
    let path=findSchoolPath(position,target,pathMode,doors,floor);
    if(!path.length){for(const portal of portals)doors.add(portal.id);path=findSchoolPath(position,target,pathMode,doors,floor);}
    assert.ok(path.length>0||Math.hypot(position.x-target.x,position.z-target.z)<.65,stop.placeId);
    let steps=0;
    while(path.length&&steps++<10000){const step=advanceSchoolRoute(position,path,.1,pathMode,doors,floor);assert.equal(step.blocked,false,stop.placeId);position={...step.position,y:(floor-1)*floorRise};path.splice(0,step.consumed);}
    mode=stop.mode;
    assert.ok(reachedTourStop(stop,position,mode),`${stop.placeId} must be physically reached`);
  }
});
test('tour arrival cannot be triggered from another floor or the other side of the entrance',()=>{
  const stop=tourCourses[0].stops[0],point=tourStopPoint(stop);
  assert.equal(reachedTourStop(stop,{...point,y:3.6},'campus'),false);
  assert.equal(reachedTourStop(stop,{...point,y:0},'floor1'),false);
  assert.equal(reachedTourStop(stop,{x:point.x+2,z:point.z,y:0},'campus'),false);
  assert.equal(reachedTourStop(stop,{...point,y:0},'campus'),true);
});
