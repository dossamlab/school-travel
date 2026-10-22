import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {gatePrincipal,canTalkToPrincipal,principalTalkRadius} from '../src/school-principal.ts';
import {schoolResidents,gateSpawn} from '../src/school-layout.ts';

test('gate principal interaction follows the actual model and is available from the initial gate',()=>{
  const model=schoolResidents.find(p=>p.roomId==='gate-welcome')!;
  assert.deepEqual(gatePrincipal.approach,{x:model.x,z:model.z});
  assert.equal(canTalkToPrincipal({...gateSpawn,y:0},'campus'),true);
  assert.equal(canTalkToPrincipal({...gateSpawn,y:0},'floor1'),false);
  assert.equal(canTalkToPrincipal({...gateSpawn,y:3.6},'campus'),false);
  assert.equal(canTalkToPrincipal({x:model.x+principalTalkRadius+.1,z:model.z,y:0},'campus'),false);
});
function guide(rows:unknown[][]){
  const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-sheet'})},SpreadsheetApp:{openById:()=>({getSheetByName:(name:string)=>{assert.equal(name,'학교 안내');return {getLastRow:()=>rows.length+1,getRange:()=>({getValues:()=>rows})};}})}});
  vm.runInContext(readFileSync(new URL('../assets/school-guestbook.gs',import.meta.url),'utf8'),context);
  return context.getSchoolGuide();
}
test('school guide exposes only published nonempty topics and the first published greeting',()=>{
  const result=guide([
    ['환영인사','인사','비공개 인사',false],['환영인사','인사','반갑습니다.',true],['환영인사','인사','두 번째 인사',true],
    ['소개','학교 연혁','확인된 연혁 문구',true],['소개','학교의 장점','비공개 문구',false],['소개','비어 있음','  ',true],
    ['소개','','제목 없는 문구',true],['소개','잘못된 체크','숨김','TRUE'],['방명록','이름','노출 금지',true],
  ]);
  assert.equal(result.greeting,'반갑습니다.');assert.equal(result.topics.length,1);
  assert.equal(result.topics[0].title,'학교 연혁');assert.equal(result.topics[0].text,'확인된 연혁 문구');
});
test('school guide preserves line breaks and treats markup as text, with a fallback for empty configuration',()=>{
  const result=guide([['소개','<b>제목</b>','첫 줄\n<script>bad()</script>',true]]);
  assert.equal(result.topics[0].text,'첫 줄\n<script>bad()</script>');
  assert.ok(result.greeting.includes('환영'));assert.equal(guide([]).topics.length,0);
});
test('principal dialog pages split only on lines holding ---',async()=>{
  const {sheetPages}=await import('../src/school-sheet-ui.ts');
  assert.deepEqual(sheetPages('첫 장\n둘째 줄\n---\n둘째 장\r\n  ----  \r\n셋째 장 - 대시 --- 포함'),['첫 장\n둘째 줄','둘째 장','셋째 장 - 대시 --- 포함']);
  assert.deepEqual(sheetPages('한 장뿐\n\n빈 줄도 같은 장'),['한 장뿐\n\n빈 줄도 같은 장']);
  assert.deepEqual(sheetPages('---\n\n---'),[]);
});

test('the office principal and the vice principal can be greeted from a reachable spot in their rooms',async()=>{
  const {indoorGreeters,nearbyGreeter,greetRadius}=await import('../src/school-principal.ts');
  const {isWalkable,findSchoolPath}=await import('../src/school-navigation.ts');
  assert.deepEqual(indoorGreeters.map(g=>[g.name,g.floor]),[['교장선생님',1],['교감선생님',2]]);
  for(const greeter of indoorGreeters) {
    const open=new Set([greeter.room.id]);
    // Some spot around the teacher, inside the greeting radius, is free floor the visitor can walk to.
    const spots=Array.from({length:16},(_,i)=>({x:greeter.x+Math.sin(i/16*Math.PI*2)*(greetRadius-.6),z:greeter.z+Math.cos(i/16*Math.PI*2)*(greetRadius-.6)}));
    const spot=spots.find(p=>isWalkable(p,'floor1',open,greeter.floor)&&findSchoolPath(greeter.room.approach,p,'floor1',open,greeter.floor).length);
    assert.ok(spot,`${greeter.name} can be approached`);
    assert.equal(nearbyGreeter(spot,greeter.floor)?.id,greeter.id);
    assert.equal(nearbyGreeter(spot,greeter.floor===1?2:1),undefined,'Only on their own floor');
  }
});
