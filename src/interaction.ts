export type Interaction = { tap:(name:string|null,x:number,y:number)=>void; drag:(name:string|null,dx:number,dy:number,x?:number,y?:number)=>void; end:(cancelled:boolean,x?:number,y?:number)=>void; pick:(x:number,y:number)=>string|null; zoom:(delta:number)=>void };

export function bindGameKeyboard(target:Window,actions:{enabled:()=>boolean;move:(key:string,pressed:boolean)=>void;interact:()=>void}) {
  const keys=['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  const movementKey=(e:KeyboardEvent)=>['KeyW','KeyA','KeyS','KeyD'].includes(e.code)?e.code.slice(3).toLowerCase():e.key.length===1?e.key.toLowerCase():e.key;
  target.addEventListener('keydown',e=>{
    const element=e.target as HTMLElement;
    if(!actions.enabled()||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||element?.isContentEditable||element?.closest?.('input,textarea,select'))return;
    const key=movementKey(e);
    if(keys.includes(key)){
      if(key.startsWith('Arrow')&&element?.closest?.('button,a'))return;
      e.preventDefault();actions.move(key,true);
    }else if(e.code==='Space'||e.key===' '){
      if(element?.closest?.('button,a'))return;
      e.preventDefault();if(!e.repeat)actions.interact();
    }
  });
  target.addEventListener('keyup',e=>{const key=movementKey(e);if(keys.includes(key))actions.move(key,false);});
}

export function bindInteraction(element:HTMLElement,actions:Interaction) {
  let active:{id:number;x:number;y:number;lastX:number;lastY:number;name:string|null;moved:boolean}|null=null;
  element.addEventListener('pointerdown',e=>{
    if(active || e.button>0) return;
    const hotspot=(e.target as HTMLElement).closest<HTMLElement>('[data-object]');
    active={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,name:hotspot?.dataset.object??actions.pick(e.clientX,e.clientY),moved:false};
    element.setPointerCapture(e.pointerId);
  });
  element.addEventListener('pointermove',e=>{
    if(!active || e.pointerId!==active.id) return;
    const dx=e.clientX-active.lastX,dy=e.clientY-active.lastY;
    if(Math.hypot(e.clientX-active.x,e.clientY-active.y)>5) active.moved=true;
    if(active.moved) actions.drag(active.name,dx,dy,e.clientX,e.clientY);
    active.lastX=e.clientX;active.lastY=e.clientY;
  });
  const end=(e:PointerEvent,cancelled:boolean)=>{
    if(!active || active.id!==e.pointerId) return;
    const old=active;active=null;
    if(!cancelled && !old.moved) actions.tap(old.name,e.clientX,e.clientY);
    actions.end(cancelled,e.clientX,e.clientY);
    if(element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
  };
  element.addEventListener('pointerup',e=>end(e,false));
  element.addEventListener('pointercancel',e=>end(e,true));
  element.addEventListener('lostpointercapture',()=>{if(active){active=null;actions.end(true);}});
  element.addEventListener('wheel',e=>{e.preventDefault();actions.zoom(-e.deltaY*.001);},{passive:false});
  element.addEventListener('keydown',e=>{
    const name=(e.target as HTMLElement).closest<HTMLElement>('[data-object]')?.dataset.object;
    if(!name) return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)actions.tap(name,0,0);}
    if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)) {e.preventDefault();actions.drag(name,['ArrowLeft','ArrowDown'].includes(e.key)?-12:12,0);actions.end(false);}
  });
}
