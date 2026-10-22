import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {roomGuideRows} from '../scripts/room-guide-rows.ts';

const source=readFileSync(new URL('../assets/school-guestbook.gs',import.meta.url),'utf8');
function sandbox(rows:unknown[][]=[],{bound=false}={}){
  const props=new Map<string,string>(bound?[]:[['SHEET_ID','test-sheet']]),cache=new Map<string,string>(),writes:unknown[][]=[];
  let released=0;
  const range={setRichTextValues:(v:unknown[][])=>{writes.push(...v);return range;},setValue:()=>range,setNumberFormat:()=>range,setWrap:()=>range,insertCheckboxes:()=>range,getValues:()=>rows};
  const book={getSheetByName:()=>({getLastRow:()=>rows.length+1,getRange:()=>range})};
  const context=vm.createContext({Date,PropertiesService:{getScriptProperties:()=>({getProperty:(k:string)=>props.get(k),setProperties:(values:Record<string,string>)=>Object.entries(values).forEach(([k,v])=>props.set(k,v))})},
    // A template copy has no SHEET_ID and reads the spreadsheet its script is bound to.
    SpreadsheetApp:{openById:()=>{if(bound)throw new Error('bound copies never open another sheet');return book;},getActiveSpreadsheet:()=>bound?book:null,newRichTextValue:()=>({setText:(text:string)=>({build:()=>text})}),flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},CacheService:{getScriptCache:()=>({get:(k:string)=>cache.get(k),put:(k:string,v:string)=>cache.set(k,v)})},
    Utilities:{formatDate:()=> '2026-01-01'},HtmlService:{createHtmlOutput:()=>({})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:(text:string)=>({setMimeType:()=>JSON.parse(text)})}});
  vm.runInContext(source,context);
  return {context,writes,props,released:()=>released};
}
const valid={nickname:'산책자',message:'즐거운 산책이었어요.',consent:true,website:'',token:'test-visitor-12345678'};
test('guestbook validates consent, lengths and bot field before writing',()=>{
  const {context}=sandbox();
  for(const input of [{...valid,consent:false},{...valid,message:' '},{...valid,message:'가'.repeat(301)},{...valid,nickname:'가'.repeat(21)},{...valid,website:'spam'},{...valid,token:'short'},null]) assert.throws(()=>context.validateEntry_(input));
  assert.equal(context.validateEntry_({...valid,nickname:'  '}).nickname,'익명의 산책자');
});
test('guestbook only returns explicitly approved rows, newest first, up to 30',()=>{
  const rows=Array.from({length:35},(_,i)=>[new Date(),'산책자'+i,'공개 글',true]);
  rows.push([new Date(),'미승인','비공개 글',false],[new Date(),'문자 승인','비공개 글','TRUE']);
  const {context}=sandbox(rows),entries=context.getApprovedEntries();
  assert.equal(entries.length,30);assert.equal(entries[0].nickname,'산책자34');assert.equal(entries[29].nickname,'산책자5');
  assert.ok(entries.every((entry:{message:string})=>entry.message==='공개 글'));
});
test('guestbook stores formula-like input literally and throttles repeat submissions',()=>{
  const state=sandbox();
  assert.equal(state.context.submitEntry({...valid,nickname:'=1+1',message:'<script>alert(1)</script>'}).ok,true);
  assert.equal(state.writes[0][0],'=1+1');assert.equal(state.writes[0][1],'<script>alert(1)</script>');
  assert.throws(()=>state.context.submitEntry(valid),/1분/);assert.equal(state.released(),2);
});
test('guestbook daily cap prevents writes and releases the lock',()=>{
  const state=sandbox();state.props.set('COUNT_DAY','2026-01-01');state.props.set('COUNT','300');
  assert.throws(()=>state.context.submitEntry(valid),/마감/);assert.equal(state.writes.length,0);assert.equal(state.released(),1);
});

test('data API exposes approved rows and validates POST without accepting writes through GET',()=>{
  const {context,writes}=sandbox([[new Date(),'산책자','공개 글',true],[new Date(),'미승인','숨김',false]]);
  const response=context.doGet({parameter:{action:'guestbook'}});
  assert.equal(response.ok,true);assert.equal(response.data.length,1);assert.equal(response.data[0].message,'공개 글');
  assert.equal(context.doGet({parameter:{action:'submit'}}).ok,false);
  assert.equal(context.doPost({postData:{contents:'invalid json'}}).ok,false);
  assert.equal(context.doPost({postData:{contents:JSON.stringify({...valid,action:'submit',consent:false})}}).ok,false);
  assert.equal(writes.length,0);
  assert.equal(context.doPost({postData:{contents:JSON.stringify({...valid,action:'submit'})}}).ok,true);
  assert.equal(writes.length,1);
});

test('room API never sends unchecked, empty or non-boolean published descriptions',()=>{
  const {context}=sandbox([
    ['library',1,'도서관','첫 줄\n<b>문구</b>',true],
    ['principal',1,'교장실','비공개 글',false],['empty',2,'빈 공간','  ',true],['string',3,'공간','비공개','TRUE'],
  ]);
  const response=context.doGet({parameter:{action:'rooms'}});
  assert.equal(response.ok,true);assert.equal(response.data.length,1);
  assert.equal(response.data[0].id,'library');assert.equal(response.data[0].text,'첫 줄\n<b>문구</b>');
});

test('room guide starter rows only name places that exist on the site', () => {
  // After changing rooms, refresh setupRoomGuide_ from `npm run room-rows`.
  const rows=JSON.parse(/const rows = (\[\[.*?\]\]);/.exec(source)![1]!) as [string,number,string,string,boolean][];
  const ids=new Set(roomGuideRows().map(row=>row[0]));
  assert.ok(rows.length>0);
  for(const [id,floor,name] of rows)assert.ok(ids.has(id),`${floor}층 ${name} (${id}) is not a place on the site`);
});

test('a copy of the template sheet reads and writes its own bound spreadsheet without SHEET_ID', () => {
  const state=sandbox([[new Date(),'산책자','공개 글',true]],{bound:true});
  assert.equal(state.context.getApprovedEntries().length,1);
  assert.equal(state.context.submitEntry(valid).ok,true);
  assert.equal(state.props.has('SHEET_ID'),false);
});
