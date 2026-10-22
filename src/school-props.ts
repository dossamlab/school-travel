import * as THREE from 'three';
import type {UpperProp} from './school-upper-floors';
import {schoolConfig} from './school-config.ts';

export type PropResult='opened'|'closed'|'germ'|'busy'|'info'|'game'|'printing'|'exercise'|'microscope'|'photo';
/** What the printer cabinet offers next: open it, print, wait, then close it again. */
export type CabinetStage='closed'|'open'|'printing'|'printed';
type PropView={
  prop:UpperProp;root:THREE.Object3D;doors:{pivot:THREE.Object3D;open:number}[];open:boolean;germ?:THREE.Object3D;clock:number;
  print?:{glass:THREE.Mesh;draw:(progress:number,time:number)=>void;clock:number};belt?:THREE.Texture;glow?:THREE.MeshStandardMaterial;bar?:THREE.Object3D;
};

// Germ surprise timeline in seconds: door opens, the germ pops out, hovers, then hides again.
const pop=[.3,.85],hide=[3.3,3.85],finished=4.4,germScale=1.6;
const easeOutBack=(t:number)=>1+2.7*(t-1)**3+1.7*(t-1)**2;

function canvasMaterial(width:number,height:number,draw:(context:CanvasRenderingContext2D)=>void,lit=false) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  draw(canvas.getContext('2d')!);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  return lit?new THREE.MeshBasicMaterial({map,toneMapped:false}):new THREE.MeshStandardMaterial({map,roughness:.85});
}
const font=(weight:number,size:number)=>`${weight} ${size}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
function balloonShape(context:CanvasRenderingContext2D,x:number,y:number,r:number,color:string) {
  context.fillStyle=color;context.beginPath();context.ellipse(x,y,r,r*1.18,0,0,Math.PI*2);context.fill();
  context.fillStyle='#ffffff66';context.beginPath();context.ellipse(x-r*.35,y-r*.45,r*.22,r*.32,-.5,0,Math.PI*2);context.fill();
  context.strokeStyle='#ffffffaa';context.lineWidth=2;context.beginPath();context.moveTo(x,y+r*1.18);context.quadraticCurveTo(x+r*.4,y+r*1.9,x,y+r*2.6);context.stroke();
}
const palette=['#f77aa0','#fdd14d','#73b5f5','#6cd9a6','#b78ef0','#fd8566'];
export {balloonShape,palette as balloonPalette};

// The right printer's front window (the one the follow camera sees past the visitor), in the cabinet's own frame.
const printWindow={x:.3,y:.85,z:.176,width:.38,height:.3},printSeconds=6.5,printLayers=14;
/**
 * The view through the printer window: a leaf standing on the build plate grows one layer at a time
 * while the orange nozzle sweeps across the current layer.
 */
function printerView() {
  const canvas=document.createElement('canvas');canvas.width=152;canvas.height=120;
  const context=canvas.getContext('2d')!,plateY=104,leafH=78,cx=76;
  const leaf=new Path2D();
  leaf.moveTo(cx,plateY);leaf.bezierCurveTo(cx-44,plateY-24,cx-30,plateY-66,cx,plateY-leafH);
  leaf.bezierCurveTo(cx+30,plateY-66,cx+44,plateY-24,cx,plateY);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  function draw(progress:number,time:number) {
    const glow=context.createLinearGradient(0,0,0,120);glow.addColorStop(0,'#fdf7e8');glow.addColorStop(1,'#dfe7e4');
    context.fillStyle=glow;context.fillRect(0,0,152,120);
    context.fillStyle='#2f3437';context.fillRect(14,plateY,124,7);
    const layers=Math.ceil(progress*printLayers),top=plateY-leafH*layers/printLayers;
    context.save();context.beginPath();context.rect(0,top,152,plateY-top);context.clip();
    context.fillStyle='#3fae8a';context.fill(leaf);
    context.strokeStyle='#2f8a6b';context.lineWidth=1;
    for(let y=plateY-leafH/printLayers;y>top-1;y-=leafH/printLayers){context.beginPath();context.moveTo(0,y);context.lineTo(152,y);context.stroke();}
    context.strokeStyle='#ffffff99';context.lineWidth=2;context.beginPath();context.moveTo(cx,plateY);context.lineTo(cx,plateY-leafH*.8);context.stroke();
    context.restore();
    // Gantry rail and nozzle at the layer being laid down; parked at the top once finished.
    const nozzleY=progress<1?top-9:14,nozzleX=progress<1?cx+Math.sin(time*7)*34:126;
    context.fillStyle='#9aa3a8';context.fillRect(6,nozzleY-2,140,4);
    context.fillStyle='#f08a3c';context.fillRect(nozzleX-9,nozzleY-8,18,12);
    context.fillStyle='#55463a';context.beginPath();context.moveTo(nozzleX-4,nozzleY+4);context.lineTo(nozzleX+4,nozzleY+4);context.lineTo(nozzleX,nozzleY+9);context.fill();
    map.needsUpdate=true;
  }
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(printWindow.width,printWindow.height),new THREE.MeshBasicMaterial({map,toneMapped:false}));
  glass.position.set(printWindow.x,printWindow.y,printWindow.z);glass.visible=false;
  return {glass,draw};
}
const stripes=(()=>{
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=64;
  const context=canvas.getContext('2d')!;context.fillStyle='#202326';context.fillRect(0,0,16,64);
  context.fillStyle='#3d4247';for(let y=0;y<64;y+=16)context.fillRect(0,y,16,5);
  return canvas;
})();

/** Welcome sign on the lounge banner; text is drawn by the browser so Korean needs no font asset. */
export function bannerMaterial() {
  return canvasMaterial(1400,420,context=>{
    const gradient=context.createLinearGradient(0,0,1400,0);
    gradient.addColorStop(0,'#fff4f7');gradient.addColorStop(.5,'#fffdf0');gradient.addColorStop(1,'#eef7ff');
    context.fillStyle=gradient;context.fillRect(0,0,1400,420);
    for(let i=0;i<70;i++){context.fillStyle=palette[i%6]+'aa';const x=(i*197)%1400,y=(i*89)%420;context.fillRect(x,y,10,10);}
    context.textAlign='center';context.textBaseline='middle';
    context.fillStyle='#4d7a62';context.font=font(700,60);context.fillText(schoolConfig.eventTitle,700,110);
    context.fillStyle='#d9506f';context.font=font(800,150);context.fillText('환영합니다!',700,265);
    context.fillStyle='#7d8f80';context.font=font(500,40);context.fillText(schoolConfig.eventWelcome,700,370);
  });
}

function arcadeMaterials(game:'balloon'|'quiz') {
  const title=game==='balloon'?'풍선 팡팡':'길찾기 OX';
  const marquee=canvasMaterial(512,128,context=>{
    context.fillStyle=game==='balloon'?'#ffe2ea':'#e1efff';context.fillRect(0,0,512,128);
    for(let i=0;i<16;i++){context.fillStyle=palette[i%6];context.beginPath();context.arc(16+i*32,10,6,0,Math.PI*2);context.arc(16+i*32,118,6,0,Math.PI*2);context.fill();}
    context.fillStyle=game==='balloon'?'#d9506f':'#2f63b5';context.font=font(800,66);context.textAlign='center';context.textBaseline='middle';context.fillText(title,256,66);
  },true);
  const screen=canvasMaterial(512,384,context=>{
    const gradient=context.createLinearGradient(0,0,0,384);
    gradient.addColorStop(0,game==='balloon'?'#8fd0ff':'#29407a');gradient.addColorStop(1,game==='balloon'?'#e6f6ff':'#5a3f8f');
    context.fillStyle=gradient;context.fillRect(0,0,512,384);
    context.textAlign='center';context.textBaseline='middle';
    if(game==='balloon') {
      [[110,170,46],[230,120,54],[360,180,44],[430,95,34],[170,280,30]].forEach(([x,y,r],i)=>balloonShape(context,x!,y!,r!,palette[i]!));
      context.fillStyle='#2a5674';context.font=font(800,50);context.fillText('POP! POP!',256,330);
    } else {
      context.lineWidth=18;context.strokeStyle='#6cd9a6';context.beginPath();context.arc(160,170,72,0,Math.PI*2);context.stroke();
      context.strokeStyle='#fd8566';context.beginPath();context.moveTo(290,100);context.lineTo(420,240);context.moveTo(420,100);context.lineTo(290,240);context.stroke();
      context.fillStyle='#fffdf0';context.font=font(800,46);context.fillText('몇 층일까요?',256,325);
    }
  },true);
  return {marquee,screen};
}

export function createClassroomProps(props:UpperProp[],asset:(name:string)=>THREE.Object3D,group:(floor:number)=>THREE.Group) {
  const views=new Map<string,PropView>(),pickables=new Map<number,THREE.Object3D[]>();
  for(const prop of props) {
    const root=asset(prop.model);root.name=prop.id;
    root.position.set(prop.x,prop.y??0,prop.z);root.rotation.y=prop.rotation;
    group(prop.floor).add(root);
    root.traverse(object=>{object.userData.propId=prop.id;});
    pickables.set(prop.floor,[...pickables.get(prop.floor)??[],root]);
    const doors:PropView['doors']=[];
    root.traverse(object=>{
      if(/-door-l$|incubator-[ab]-door$/.test(object.name))doors.push({pivot:object,open:-1.9});
      else if(/-door-r$/.test(object.name))doors.push({pivot:object,open:1.9});
    });
    const view:PropView={prop,root,doors,open:false,clock:-1};
    if(prop.model==='printer-cabinet') {
      const {glass,draw}=printerView();root.add(glass);
      view.print={glass,draw,clock:-1};
    }
    if(prop.exercise==='run') {
      const map=new THREE.CanvasTexture(stripes);map.wrapT=THREE.RepeatWrapping;map.repeat.set(1,6);map.colorSpace=THREE.SRGBColorSpace;
      const belt=new THREE.Mesh(new THREE.PlaneGeometry(.54,1.48),new THREE.MeshStandardMaterial({map,roughness:.9}));
      belt.rotation.x=-Math.PI/2;belt.position.set(0,.218,.14);root.add(belt);view.belt=map;
      root.traverse(object=>{
        if(object instanceof THREE.Mesh&&/sky/.test((object.material as THREE.Material).name))
          object.material=view.glow=(object.material as THREE.MeshStandardMaterial).clone();
      });
    }
    view.bar=root.getObjectByName('power-rack-bar');
    const face=root.getObjectByName('welcome-banner-face');
    if(face) {
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.05),bannerMaterial());
      root.updateMatrixWorld(true);sign.position.copy(root.worldToLocal(face.getWorldPosition(new THREE.Vector3())));root.add(sign);
    }
    if(prop.action==='germ') {
      const germ=asset('germ');germ.position.set(0,.12,0);germ.scale.setScalar(.45);germ.visible=false;root.add(germ);view.germ=germ;
    }
    if(prop.action==='game'&&prop.game) {
      const {marquee,screen}=arcadeMaterials(prop.game);
      for(const [marker,mat,w,h] of [['screen',screen,.62,.46],['marquee',marquee,.74,.17]] as const) {
        const anchor=root.getObjectByName(`${prop.model}-${marker}`);
        if(anchor)anchor.add(new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat));
      }
    }
    views.set(prop.id,view);
  }
  let active:PropView|undefined;
  const dumbbells=[0,1].map(()=>{
    const group=new THREE.Group(),steel=new THREE.MeshStandardMaterial({color:0xb8bec4,metalness:.6,roughness:.35}),black=new THREE.MeshStandardMaterial({color:0x1d1f22,roughness:.6});
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.16,8),steel);handle.rotation.z=Math.PI/2;group.add(handle);
    for(const x of [-.08,.08]){const head=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.05,12),black);head.rotation.z=Math.PI/2;head.position.x=x;group.add(head);}
    group.visible=false;return group;
  });
  const stage=(view:PropView):CabinetStage=>!view.open?'closed':view.print&&view.print.clock>=0?(view.print.clock<printSeconds?'printing':'printed'):'open';
  function use(id:string):PropResult {
    const view=views.get(id);if(!view)return 'info';
    if(view.prop.action==='cabinet') {
      const next=stage(view);
      if(next==='printing')return 'busy';
      if(next==='open'&&view.print){view.print.clock=0;return 'printing';}
      view.open=!view.open;
      if(!view.open&&view.print){view.print.clock=-1;view.print.glass.visible=false;}
      return view.open?'opened':'closed';
    }
    if(view.prop.action==='germ'){if(view.clock>=0)return 'busy';view.clock=0;return 'germ';}
    return view.prop.action;
  }
  const hand=new THREE.Vector3(),yaw=new THREE.Quaternion(),parent=new THREE.Quaternion();
  /** Moves the machine the visitor is using; `rig` is the visitor's model while an exercise runs. */
  function tick(dt:number,rig?:THREE.Object3D) {
    if(active?.belt)active.belt.offset.y=(active.belt.offset.y+dt*1.6)%1;
    for(const view of views.values()) {
      if(view.glow)view.glow.emissive.setHex(view===active?0x4aa8ff:0);
      if(view.bar) {
        // The bar rides on the squatting visitor's shoulders and settles back onto the hooks afterwards.
        const neck=view===active?rig?.getObjectByName('mixamorigNeck'):undefined;
        const rest=view.bar.userData.rest??=view.bar.position.y;
        if(neck){view.root.updateMatrixWorld();view.bar.position.y=view.root.worldToLocal(neck.getWorldPosition(hand)).y-.02;}
        else view.bar.position.y=THREE.MathUtils.damp(view.bar.position.y,rest,8,dt);
      }
      if(view.print&&view.print.clock>=0) {
        const p=view.print,t=p.clock+=dt,progress=Math.min(1,t/printSeconds);
        p.glass.visible=true;
        // Redraw while printing and once more for the finished leaf.
        if(t-dt<printSeconds+.1)p.draw(progress,t);
      }
      let open=view.open;
      if(view.germ&&view.clock>=0) {
        const t=view.clock+=dt,germ=view.germ;
        open=t<hide[1];
        const out=t<pop[0]?0:t<pop[1]?easeOutBack((t-pop[0])/(pop[1]-pop[0])):t<hide[0]?1:t<hide[1]?1-((t-hide[0])/(hide[1]-hide[0]))**2:0;
        germ.visible=out>.01;
        // Rise above the visitor standing in front of the counter.
        germ.position.set(0,.12+.75*out+(t>pop[1]&&t<hide[0]?Math.sin((t-pop[1])*7)*.05:0),.4*Math.min(1,out));
        germ.scale.setScalar(.3+(germScale-.3)*out*(t>pop[1]&&t<hide[0]?1+Math.sin(t*14)*.03:1));
        germ.rotation.set(0,t>pop[1]&&t<hide[0]?Math.sin(t*5)*.35:0,t>pop[1]&&t<hide[0]?Math.sin(t*9)*.08:0);
        if(t>finished){view.clock=-1;germ.visible=false;}
      }
      for(const door of view.doors)door.pivot.rotation.y=THREE.MathUtils.damp(door.pivot.rotation.y,open?door.open:0,9,dt);
    }
    const holding=active?.prop.exercise==='curl'?rig:undefined;
    ['mixamorigLeftHand','mixamorigRightHand'].forEach((name,i)=>{
      const bell=dumbbells[i]!,bone=holding?.getObjectByName(name);
      if(!holding||!bone){bell.visible=false;return;}
      if(bell.parent!==bone)bone.add(bell);
      bell.visible=true;
      // Keep the handles level across the body whatever the hand bone's own axes are.
      bone.getWorldQuaternion(parent).invert();
      bell.quaternion.copy(parent).multiply(holding.getWorldQuaternion(yaw));
      bell.position.set(0,0,0);
    });
  }
  return {
    use,tick,
    stage:(id:string):CabinetStage=>{const view=views.get(id);return view?stage(view):'closed';},
    /** The exercise machine in use, or undefined when the visitor stops. */
    setActive:(id:string|undefined)=>{active=id?views.get(id):undefined;},
    pickables:(floor:number)=>pickables.get(floor)??[],
  };
}
