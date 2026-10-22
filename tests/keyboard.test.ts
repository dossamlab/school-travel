import test from 'node:test';
import assert from 'node:assert/strict';
import { bindGameKeyboard } from '../src/interaction.ts';

function keyboard() {
  const target=new EventTarget();
  const held=new Set<string>();
  let enabled=true,interactions=0;
  bindGameKeyboard(target as unknown as Window,{
    enabled:()=>enabled,
    move:(key,pressed)=>{if(pressed)held.add(key);else held.delete(key);},
    interact:()=>{interactions++;},
  });
  function send(type:string,key:string,code:string,focus='body',options:{repeat?:boolean;prevented?:boolean;ctrlKey?:boolean}={}) {
    const element={isContentEditable:focus==='editable',closest:(selector:string)=>selector.split(',').includes(focus)?element:null};
    const event=new Event(type,{cancelable:true});
    Object.defineProperties(event,{
      key:{value:key},code:{value:code},target:{value:element},
      repeat:{value:options.repeat??false},ctrlKey:{value:options.ctrlKey??false},
    });
    if(options.prevented)event.preventDefault();
    target.dispatchEvent(event);
    return event;
  }
  return {held,send,setEnabled:(value:boolean)=>{enabled=value;},interactions:()=>interactions};
}

test('물체나 시점 버튼에 초점이 남아도 WASD 이동과 키 놓음이 작동한다',()=>{
  const game=keyboard();
  for(const key of ['w','a','s','d'])assert.equal(game.send('keydown',key,`Key${key.toUpperCase()}`,'button').defaultPrevented,true);
  assert.deepEqual([...game.held],['w','a','s','d']);
  for(const key of ['w','a','s','d'])game.send('keyup',key,`Key${key.toUpperCase()}`,'button');
  assert.equal(game.held.size,0);
});

test('한글 입력 상태와 대문자 표시에서도 같은 물리 WASD 키로 이동한다',()=>{
  const game=keyboard();
  game.send('keydown','ㅈ','KeyW');game.send('keydown','D','KeyD');
  assert.deepEqual([...game.held],['w','d']);
  game.send('keyup','W','KeyW');game.send('keyup','ㅇ','KeyD');
  assert.equal(game.held.size,0);
});

test('Space를 길게 눌러도 주변 물체는 한 번만 조작하고 화면은 스크롤하지 않는다',()=>{
  const game=keyboard();
  assert.equal(game.send('keydown',' ','Space').defaultPrevented,true);
  assert.equal(game.send('keydown',' ','Space','body',{repeat:true}).defaultPrevented,true);
  game.send('keydown',' ','Space','body',{repeat:true});game.send('keyup',' ','Space');
  assert.equal(game.interactions(),1);
  assert.equal(game.held.size,0);
});

test('표식에서 처리한 Space와 방향키는 이동이나 이중 조작으로 이어지지 않는다',()=>{
  const game=keyboard();
  game.send('keydown',' ','Space','button',{prevented:true});
  game.send('keydown','ArrowRight','ArrowRight','button',{prevented:true});
  assert.equal(game.interactions(),0);assert.equal(game.held.size,0);
});

test('글 입력·편집·대화창·시스템 단축키 중에는 게임 키를 가로채지 않는다',()=>{
  const game=keyboard();
  for(const focus of ['input','textarea','select','editable']){
    assert.equal(game.send('keydown','w','KeyW',focus).defaultPrevented,false);
    assert.equal(game.send('keydown',' ','Space',focus).defaultPrevented,false);
  }
  game.send('keydown','w','KeyW','body',{ctrlKey:true});
  game.setEnabled(false);game.send('keydown','d','KeyD');game.send('keydown',' ','Space');
  assert.equal(game.held.size,0);assert.equal(game.interactions(),0);
});

test('키를 놓으면 대화창이 열리거나 초점이 달라져도 눌린 이동키를 해제한다',()=>{
  const game=keyboard();game.send('keydown','w','KeyW');assert.equal(game.held.has('w'),true);
  game.setEnabled(false);game.send('keyup','w','KeyW','textarea',{prevented:true});
  assert.equal(game.held.size,0);
});

test('일반 화면 버튼과 링크의 Space·방향키는 기본 키보드 동작을 유지한다',()=>{
  const game=keyboard();
  for(const focus of ['button','a']){
    assert.equal(game.send('keydown',' ','Space',focus).defaultPrevented,false);
    assert.equal(game.send('keydown','ArrowDown','ArrowDown',focus).defaultPrevented,false);
  }
  assert.equal(game.interactions(),0);assert.equal(game.held.size,0);
});
