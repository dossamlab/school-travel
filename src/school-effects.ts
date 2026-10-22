import * as THREE from 'three';

/** Short world-space effects for the interactions: floating notes, sparkles and a thrown basketball. */

function glyphTexture(text:string,color:string) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d')!;
  context.font='700 52px "Noto Sans KR", "Segoe UI Symbol", sans-serif';context.textAlign='center';context.textBaseline='middle';
  context.lineWidth=6;context.strokeStyle='#ffffff';context.strokeText(text,32,34);
  context.fillStyle=color;context.fillText(text,32,34);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}

type Particle={sprite:THREE.Sprite;velocity:THREE.Vector3;age:number;life:number;sway:number};
type Ball={mesh:THREE.Mesh;from:THREE.Vector3;to:THREE.Vector3;apex:number;flight:number;age:number;velocity?:THREE.Vector3;floor:number;bounces:number};

const gravity=9.8,ballRadius=.12;
/** Point on the throw arc at progress t (0..1): a straight line lifted by a parabola peaking `apex` above it. */
export function arcPoint(from:THREE.Vector3,to:THREE.Vector3,apex:number,t:number,target=new THREE.Vector3()) {
  return target.lerpVectors(from,to,t).setY(THREE.MathUtils.lerp(from.y,to.y,t)+apex*4*t*(1-t));
}

export function createEffects(scene:THREE.Scene) {
  const notes=['♪','♫','♩','♬'].map((glyph,i)=>new THREE.SpriteMaterial({map:glyphTexture(glyph,['#e2557a','#3f7fd0','#3a9c76','#9a5fd0'][i]!),transparent:true,depthWrite:false}));
  const sparkles=['#ffd34d','#ff8fb1','#7fd3ff'].map(color=>new THREE.SpriteMaterial({map:glyphTexture('✦',color),transparent:true,depthWrite:false}));
  const particles:Particle[]=[];
  function emit(material:THREE.SpriteMaterial,at:THREE.Vector3,velocity:THREE.Vector3,life:number,size:number,sway=0) {
    const sprite=new THREE.Sprite(material.clone());sprite.position.copy(at);sprite.scale.setScalar(size);sprite.renderOrder=5;scene.add(sprite);
    particles.push({sprite,velocity,age:0,life,sway});
  }
  const ballMaterial=new THREE.MeshStandardMaterial({color:0xe8742c,roughness:.7});
  const seams=new THREE.MeshBasicMaterial({color:0x3a2416});
  const ballGeometry=new THREE.SphereGeometry(ballRadius,18,12);
  let ball:Ball|undefined;
  return {
    /** One note rising and swaying from a point (call repeatedly while the piano plays). */
    note(at:THREE.Vector3) {
      const material=notes[Math.floor(Math.random()*notes.length)]!;
      emit(material,at.clone().add(new THREE.Vector3((Math.random()-.5)*.5,0,(Math.random()-.5)*.3)),new THREE.Vector3(0,.55,0),2.2,.32,.6);
    },
    /** A ring of sparkles bursting around the visitor. */
    sparkle(at:THREE.Vector3) {
      for(let i=0;i<14;i++) {
        const angle=i/14*Math.PI*2;
        emit(sparkles[i%3]!,at.clone().add(new THREE.Vector3(Math.cos(angle)*.35,.9+Math.random()*.6,Math.sin(angle)*.35)),new THREE.Vector3(Math.cos(angle)*.9,.6+Math.random()*.6,Math.sin(angle)*.9),1.1,.26);
      }
    },
    /**
     * Throw a ball from `from` towards the hoop centre. A made shot drops through the net;
     * a miss clips the front of the rim and bounces back. Returns the flight time in seconds.
     */
    shoot(from:THREE.Vector3,hoop:THREE.Vector3,made:boolean,floor:number) {
      if(ball){scene.remove(ball.mesh);ball=undefined;}
      const toShooter=new THREE.Vector3(from.x-hoop.x,0,from.z-hoop.z).normalize();
      const to=made?hoop.clone().setY(hoop.y+.04):hoop.clone().addScaledVector(toShooter,.3).setY(hoop.y+.06);
      const distance=Math.hypot(to.x-from.x,to.z-from.z),flight=.7+distance*.07;
      const mesh=new THREE.Mesh(ballGeometry,ballMaterial);mesh.castShadow=true;
      const seam=new THREE.Mesh(new THREE.TorusGeometry(ballRadius*1.01,.006,4,24),seams);mesh.add(seam);
      const seam2=seam.clone();seam2.rotation.y=Math.PI/2;mesh.add(seam2);
      mesh.position.copy(from);scene.add(mesh);
      ball={mesh,from:from.clone(),to,apex:.9+distance*.12,flight,age:0,floor,bounces:0,
        velocity:made?new THREE.Vector3(0,-.6,0):toShooter.clone().multiplyScalar(1.4).setY(1.8)};
      return flight;
    },
    tick(dt:number) {
      for(let i=particles.length-1;i>=0;i--) {
        const p=particles[i]!;p.age+=dt;
        p.sprite.position.addScaledVector(p.velocity,dt);
        if(p.sway)p.sprite.position.x+=Math.cos(p.age*4)*p.sway*dt;
        (p.sprite.material as THREE.SpriteMaterial).opacity=1-(p.age/p.life)**2;
        if(p.age>=p.life){scene.remove(p.sprite);(p.sprite.material as THREE.Material).dispose();particles.splice(i,1);}
      }
      if(!ball)return;
      const b=ball;b.age+=dt;b.mesh.rotation.x-=dt*8;
      if(b.age<=b.flight){arcPoint(b.from,b.to,b.apex,b.age/b.flight,b.mesh.position);return;}
      // After the arc the ball falls freely and bounces on the court until it settles.
      const v=b.velocity!;v.y-=gravity*dt;b.mesh.position.addScaledVector(v,dt);
      if(b.mesh.position.y<b.floor+ballRadius){b.mesh.position.y=b.floor+ballRadius;v.y=Math.abs(v.y)*.55;v.x*=.8;v.z*=.8;b.bounces++;}
      if(b.age>b.flight+2.6){scene.remove(b.mesh);ball=undefined;}
    },
  };
}
