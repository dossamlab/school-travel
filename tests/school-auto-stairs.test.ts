import test from 'node:test';
import assert from 'node:assert/strict';
import {stairs,floorRise} from '../src/school-structure.ts';
import {stairApproach,automaticStairPath,advanceStairRoute,nearbyStair} from '../src/school-auto-stairs.ts';
import {isWalkable} from '../src/school-navigation.ts';

test('automatic stairs traverse all four cores up and down every floor without jumps',()=>{
  for(const stair of stairs)for(const from of [1,2,3,4,5])for(const to of [from-1,from+1]){
    const doors=new Set<string>();let position={...stairApproach(stair,from),y:(from-1)*floorRise};
    assert.equal(nearbyStair(position)?.id,stair.id);
    const path=automaticStairPath(position,stair,to,doors);
    if(to<1||to>5){assert.equal(path.length,0);continue;}
    assert.ok(path.length);
    for(let ticks=0;path.length&&ticks<3000;ticks++){
      const step=advanceStairRoute(position,path,[.11,.052,.16,.027,.08,.12000000000000001][ticks%6],doors);
      assert.equal(step.blocked,false,`${stair.id} ${from}→${to} ${JSON.stringify(position)} target ${JSON.stringify(path[0])}`);
      assert.ok(Math.abs(step.position.y-position.y)<.12);
      position=step.position;path.splice(0,step.consumed);
    }
    assert.equal(path.length,0);assert.ok(Math.abs(position.y-(to-1)*floorRise)<1e-6);
    assert.ok(isWalkable(position,'floor1',doors,to),'Ends on the corridor');
    assert.ok(Math.hypot(position.x-stairApproach(stair,to).x,position.z-stairApproach(stair,to).z)<.001);
  }
});
