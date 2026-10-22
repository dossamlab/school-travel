import {balloonShape,balloonPalette} from './school-props';
import {schoolConfig} from './school-config.ts';

// Pictures drawn in the browser for two interactions: the microscope view and the photo-zone keepsake.

/** Stained onion epidermis as seen at about 400x: brick-like cells with one red nucleus each. */
export function drawOnionCells(canvas:HTMLCanvasElement,seed=7) {
  const context=canvas.getContext('2d')!,{width,height}=canvas;
  let state=seed;const random=()=>(state=(state*16807)%2147483647)/2147483647;
  context.fillStyle='#f7e9ef';context.fillRect(0,0,width,height);
  context.save();context.translate(width/2,height/2);context.rotate(-.21);
  const cellW=width*.26,cellH=width*.075;
  for(let row=-9;row<=9;row++) {
    const shift=(row%2)*cellW*.5+random()*cellW*.2;
    for(let col=-4;col<=4;col++) {
      const x=col*cellW+shift-cellW/2,y=row*cellH-cellH/2,w=cellW*(.92+random()*.16),h=cellH*(.9+random()*.2);
      context.fillStyle=`hsl(${330+random()*12} 55% ${90+random()*4}%)`;
      context.beginPath();
      // Cell walls are slightly tapered at the ends like the real tissue.
      context.moveTo(x+w*.06,y);context.lineTo(x+w*.94,y+h*.04);context.lineTo(x+w,y+h*.5);context.lineTo(x+w*.94,y+h*.96);
      context.lineTo(x+w*.06,y+h);context.lineTo(x,y+h*.5);context.closePath();context.fill();
      context.strokeStyle='#b5658a';context.lineWidth=width*.006;context.stroke();
      const nx=x+w*(.25+random()*.5),ny=y+h*(.35+random()*.3),r=cellH*(.17+random()*.06);
      context.fillStyle='#a8325f';context.beginPath();context.ellipse(nx,ny,r*1.25,r,random(),0,Math.PI*2);context.fill();
      context.fillStyle='#6d1c3e';context.beginPath();context.arc(nx+r*.25,ny-r*.15,r*.32,0,Math.PI*2);context.fill();
    }
  }
  context.restore();
  // Light falls off towards the edge of the eyepiece.
  const vignette=context.createRadialGradient(width/2,height/2,width*.28,width/2,height/2,width*.52);
  vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#2a1020aa');
  context.fillStyle=vignette;context.fillRect(0,0,width,height);
}

const font=(weight:number,size:number)=>`${weight} ${size}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
export const photoDate=(date:Date)=>`${date.getFullYear()}. ${date.getMonth()+1}. ${date.getDate()}.`;

/** Frames a captured 3D view as a keepsake: the centre of the shot inside a balloon border with the date. */
export function composePhoto(shot:HTMLCanvasElement,date:Date) {
  const width=1200,height=1040,inset=44,photoW=width-inset*2,photoH=photoW*3/4;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d')!;
  const background=context.createLinearGradient(0,0,width,height);
  background.addColorStop(0,'#fff1f5');background.addColorStop(.5,'#fffbe9');background.addColorStop(1,'#eaf5ff');
  context.fillStyle=background;context.fillRect(0,0,width,height);
  for(let i=0;i<90;i++){context.fillStyle=balloonPalette[i%6]+'88';context.fillRect((i*173)%width,(i*97)%height,9,9);}
  // Crop the middle of the shot to 4:3, where the follow camera keeps the visitor.
  const cropH=Math.min(shot.height*.9,shot.width*.9*3/4),cropW=cropH*4/3;
  context.save();context.beginPath();context.roundRect(inset,inset,photoW,photoH,26);context.clip();
  context.drawImage(shot,(shot.width-cropW)/2,(shot.height-cropH)/2,cropW,cropH,inset,inset,photoW,photoH);
  context.restore();
  context.lineWidth=6;context.strokeStyle='#ffffff';context.beginPath();context.roundRect(inset,inset,photoW,photoH,26);context.stroke();
  for(const [x,y,r,i] of [[70,90,46,0],[150,58,34,1],[width-80,96,48,2],[width-160,56,32,3],[64,inset+photoH-30,38,4],[width-66,inset+photoH-40,40,5]] as const)
    balloonShape(context,x,y,r,balloonPalette[i]!);
  context.textAlign='center';context.textBaseline='middle';
  context.fillStyle='#d9506f';context.font=font(800,46);context.fillText(schoolConfig.eventTitle,width/2,inset+photoH+62);
  context.fillStyle='#6f8068';context.font=font(500,28);context.fillText(`${schoolConfig.siteName} · ${photoDate(date)}`,width/2,inset+photoH+112);
  return canvas;
}
