import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPlayerMotion, type PlayerActivity } from './player';
import { createEffects } from './school-effects';
import { planFloorData as floorData, planAspectRatios, schoolPlayerHeight } from './school-plan-data';
import { cellRect, places, furnishings, groundFurniture, libraryPassage, schoolResidents, restroomFixtures, bookReturn, parkingColumns, frontPlanters, outdoorGarden, schoolBounds, campusSpawn, campusGate, showCampusCutaway, lobbyExit, doorWidth, wallThickness } from './school-layout';
import {boundaryWalls,portals,stairs,stairPoint,stairSurfaces,stairGroundObstacles,surfaceHeight,floorRise,courtDrop,courtRect,courtAccess,courtRamp,courtSteps,extraFloors,parkingConnector,groundHeight,diningStairs,diningLanding,diningHall,diningVestibule,diningTables,diningBenches,planRect} from './school-structure';
import type { Point, Rect, TourMode } from './school-layout';
/** `model` names the furniture the seat belongs to (the piano bench plays the piano). */
export type Seat={floor:number;x:number;y:number;z:number;yaw:number;model:string};
import {campusHeight,exteriorGrade,campusEntrancePoint,fieldRect,fieldStairs,fieldRamps,fieldDrop,rostrum,parkedCars,recyclingPoint,parkingWalkAreas,campusGround,lowerGround,eastWalk,campusFences,gateApproach} from './school-outdoors';
import {upperRooms,upperCorridors,upperFurniture,upperDecor,upperProps,customRooms,upperResidents,upperRoomWalls,walkingFloor,onFloorLevel} from './school-upper-floors';
import {classroomModels} from './school-classrooms';
import {createClassroomProps,bannerMaterial} from './school-props';
import {schoolConfig} from './school-config';

const center = (rect: Rect) => ({x:(rect.minX+rect.maxX)/2,z:(rect.minZ+rect.maxZ)/2});
const inside = (point:Point,rect:Rect) => point.x>=rect.minX&&point.x<=rect.maxX&&point.z>=rect.minZ&&point.z<=rect.maxZ;

/** Metric floor plans share their walking geometry and cutaway model. */
export async function createSchool(host:HTMLElement) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.92;
  renderer.setClearColor(0xeceee3);
  renderer.domElement.setAttribute('aria-label','학교 탐방 3D 견본. 주인공을 움직이거나 방과 바닥을 눌러 탐방합니다.');
  host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,400);
  const indoor=new THREE.Group(),building=new THREE.Group(),outdoors=new THREE.Group(),campusContext=new THREE.Group(),parkingContext=new THREE.Group();
  indoor.name='first-floor-cutaway';building.name='five-floor-model';outdoors.name='mapped-outdoors';
  campusContext.name='observed-campus-context';
  parkingContext.name='walkable-parking-context';scene.add(indoor,building,outdoors,campusContext,parkingContext);
  const stairRoot=new THREE.Group();scene.add(stairRoot);
  const courtyardView=new THREE.Group();courtyardView.name='courtyard-view';scene.add(courtyardView);
  const upperViews=new Map<number,THREE.Group>();
  const upperGym=new THREE.Group();upperGym.name='fourth-floor-gym';upperGym.position.y=3*floorRise;scene.add(upperGym);
  const pmrem=new THREE.PMREMGenerator(renderer),roomEnvironment=new RoomEnvironment();
  const environment=pmrem.fromScene(roomEnvironment,.06);
  scene.environment=environment.texture;scene.environmentIntensity=.26;
  roomEnvironment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff9e7,0x98afa3,1.35));
  const sun=new THREE.DirectionalLight(0xffecd1,2.25);
  sun.position.set(-28,65,36);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-61,right:61,top:53,bottom:-53,near:1,far:140});
  sun.shadow.normalBias=.045;sun.shadow.bias=-.00018;sun.shadow.radius=3;
  scene.add(sun);scene.add(sun.target);
  const fill=new THREE.DirectionalLight(0xd8eee5,.6);fill.position.set(38,24,-28);scene.add(fill);

  const material = (color:number,roughness=.88) => new THREE.MeshStandardMaterial({color,roughness,metalness:0});
  const palette={cream:material(0xfff9e9),mint:material(0xa6c8ba),darkMint:material(0x668f80),wood:material(0xc99458),lightWood:material(0xe0b87f),floor:material(0xe9d3ad),corridor:material(0xece8d8),stone:material(0xd9dfd3),soil:material(0x917257),green:material(0x719e6b),leaf:material(0x99ba7d),glass:material(0xb5d9d8,.4),ink:material(0x5f756b),white:material(0xfffaf0)};
  const facade={field:material(0x6f936c),fieldStripe:material(0x7a9f74),court:material(0xb87967),courtEdge:material(0x789aa8),road:material(0xb8beb6)};
  const wallFinish={body:material(0xe2cfad),base:material(0xa48c73)};
  const hall={trim:material(0xb7bfbd),metal:material(0xc1cac6,.48),blue:material(0xc3dcdf),returnGreen:material(0xb9ce76),dark:material(0x626b67)};
  const roomGlass=new THREE.MeshStandardMaterial({color:0xb7d7cf,roughness:.3,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [exteriorAsset,entryAsset,furnitureAsset,residentAsset,classroomAsset]=await Promise.all(
    ['school-exterior','school-entry','school-furniture','school-residents','school-classrooms'].map(name=>loader.loadAsync(`${import.meta.env.BASE_URL}${name}.glb`)),
  );
  const prototypes=new Map<string,THREE.Object3D>();
  for(const name of ['entrance','gate'])prototypes.set(name,entryAsset!.scene.getObjectByName(name)!);
  for(const name of ['door','desk','shelf','bench'])prototypes.set(name,furnitureAsset!.scene.getObjectByName(name)!);
  for(const name of ['principal-resident','vice-principal-resident','duty-resident','gate-resident','standing-desk','restroom-sink','restroom-toilet'])prototypes.set(name,residentAsset!.scene.getObjectByName(name)!);
  for(const name of Object.keys(classroomModels))prototypes.set(name,classroomAsset!.scene.getObjectByName(name)!);
  // Cabinet glass shows the printers and microscopes stored behind it.
  classroomAsset!.scene.traverse(object=>{if(object instanceof THREE.Mesh&&/clear glass/.test((object.material as THREE.Material).name)){
    Object.assign(object.material,{transparent:true,opacity:.3,depthWrite:false});object.castShadow=false;
  }});
  // Preserve the supplied residents' atlas colors around tightly packed UV seams.
  residentAsset!.scene.traverse(object=>{if(object instanceof THREE.Mesh){
    const mat=object.material as THREE.MeshStandardMaterial;
    if(mat.map){mat.map.minFilter=THREE.LinearFilter;mat.map.generateMipmaps=false;mat.map.needsUpdate=true;}
  }});
  function asset(name:string) {
    const model=prototypes.get(name)!.clone(true);
    model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    return model;
  }
  const batches=new Map<THREE.Group,Map<THREE.Material,THREE.BufferGeometry[]>>();
  function staticGeometry(group:THREE.Group,geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,rotation?:THREE.Euler) {
    if(geometry.index) {const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(rotation??new THREE.Euler()),new THREE.Vector3(1,1,1));
    geometry.applyMatrix4(matrix);
    const batch=batches.get(group)??new Map<THREE.Material,THREE.BufferGeometry[]>();
    const geometries=batch.get(mat)??[];geometries.push(geometry);batch.set(mat,geometries);batches.set(group,batch);
  }
  function box(group:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,width:number,height:number,depth:number,rounded=false) {
    if(width<=0||height<=0||depth<=0)return;
    const geometry=rounded?new RoundedBoxGeometry(width,height,depth,2,Math.min(.1,width/5,height/5,depth/5)):new THREE.BoxGeometry(width,height,depth);
    staticGeometry(group,geometry,mat,x,y,z);
  }
  // Keep walls separate from floor/furniture batches so only an obstructing wall fades.
  const occludingWalls:{mesh:THREE.Mesh;material:THREE.Material;bounds:THREE.Box3}[]=[];
  function wallBox(group:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number) {
    if(w<=0||h<=0||d<=0)return;
    const faded=mat.clone();faded.transparent=true;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),faded);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    occludingWalls.push({mesh,material:faded,bounds:new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2))});
  }
  function gradedPaving(r:Rect) {
    const geometry=new THREE.PlaneGeometry(r.maxX-r.minX,r.maxZ-r.minZ,Math.ceil(r.maxX-r.minX),Math.ceil(r.maxZ-r.minZ));
    geometry.rotateX(-Math.PI/2);geometry.translate((r.minX+r.maxX)/2,0,(r.minZ+r.maxZ)/2);
    const vertices=geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)vertices.setY(i,exteriorGrade({x:vertices.getX(i),z:vertices.getZ(i)})-.015);
    geometry.computeVertexNormals();staticGeometry(outdoors,geometry,facade.road,0,0,0);
  }
  function cylinder(group:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,radius:number,height:number) {
    staticGeometry(group,new THREE.CylinderGeometry(radius*.88,radius,height,10),mat,x,y,z);
  }
  function staticModel(group:THREE.Group,model:THREE.Object3D) {
    model.updateMatrixWorld(true);
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      let geometry=object.geometry.clone();
      if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
      geometry.applyMatrix4(object.matrixWorld);
      // Imported models contain one material per mesh; match the scene's batch attributes.
      for(const name of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(name))geometry.deleteAttribute(name);
      if(!geometry.hasAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
      const batch=batches.get(group)??new Map<THREE.Material,THREE.BufferGeometry[]>();
      const mat=object.material as THREE.Material,geometries=batch.get(mat)??[];
      geometries.push(geometry);batch.set(mat,geometries);batches.set(group,batch);
    });
  }
  function plant(group:THREE.Group,x:number,y:number,z:number,size=1) {
    cylinder(group,palette.wood,x,y+.16*size,z,.23*size,.32*size);
    cylinder(group,palette.soil,x,y+.33*size,z,.205*size,.025);
    for(let i=0;i<4;i++) {
      const angle=i*Math.PI/2;
      const geometry=new THREE.SphereGeometry(.25*size,8,5);geometry.scale(.64,1.4,.74);
      staticGeometry(group,geometry,i%2?palette.leaf:palette.green,x+Math.cos(angle)*.14*size,y+.63*size,z+Math.sin(angle)*.14*size,new THREE.Euler(0,angle,.38));
    }
  }
  const signNames=[...new Set([...places.map(place=>place.name),...upperRooms.map(room=>room.name),schoolConfig.schoolName,'학교보안관실','분리수거장','텃밭','구령대','방문 차량','도서 반납함','1층 · 탐방 견본','1층','2층','3층','4층','5층'])];
  const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=Math.ceil(signNames.length/2)*128;
  const signContext=signCanvas.getContext('2d')!;
  signContext.fillStyle='#f8f4e7';signContext.fillRect(0,0,signCanvas.width,signCanvas.height);
  for(let i=0;i<signNames.length;i++) {
    const x=i%2*512,y=Math.floor(i/2)*128;
    signContext.fillStyle='#f8f4e7';signContext.fillRect(x,y,512,128);
    signContext.strokeStyle='#a2bdb1';signContext.lineWidth=5;signContext.strokeRect(x+6,y+6,500,116);
    signContext.fillStyle='#39554a';signContext.font='600 42px "Noto Sans KR", "Malgun Gothic", sans-serif';signContext.textAlign='center';signContext.textBaseline='middle';
    signContext.fillText(signNames[i]!,x+256,y+65,464);
  }
  const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const signMaterial=new THREE.MeshStandardMaterial({map:signTexture,roughness:.95,side:THREE.DoubleSide});
  function sign(group:THREE.Group,text:string,x:number,y:number,z:number,width=2.6,rotation=new THREE.Euler()) {
    const index=signNames.indexOf(text);if(index<0)return;
    const geometry=new THREE.PlaneGeometry(width,width/4),uv=geometry.getAttribute('uv');
    const rowCount=signCanvas.height/128;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+index%2)/2,(uv.getY(i)+rowCount-1-Math.floor(index/2))/rowCount);
    staticGeometry(group,geometry,signMaterial,x,y,z,rotation);
  }
  // A neutral plinth supplies context without asserting a campus boundary.
  const baseNorth=Math.min(schoolBounds.minZ,20.25-78.75*Math.max(...Object.values(planAspectRatios)))-4,baseSouth=29.5;
  const pit={...courtRect,maxX:courtAccess.maxX};
  const aroundPit=(r:Rect):Rect[]=>[
    {...r,maxX:pit.minX},{...r,minX:pit.maxX},
    {minX:pit.minX,maxX:pit.maxX,minZ:r.minZ,maxZ:pit.minZ},
    {minX:pit.minX,maxX:pit.maxX,minZ:pit.maxZ,maxZ:r.maxZ},
  ];
  for(const r of aroundPit({...campusGround,minZ:baseNorth,maxZ:baseSouth}))gradedPaving(r);
  gradedPaving({minX:courtRect.maxX,maxX:courtAccess.maxX,minZ:courtRect.minZ,maxZ:courtAccess.minZ});
  box(outdoors,palette.stone,(pit.minX+pit.maxX)/2,-2.35,(pit.minZ+pit.maxZ)/2,pit.maxX-pit.minX,.8,pit.maxZ-pit.minZ);
  box(building,palette.stone,(pit.minX+pit.maxX)/2,-.48,(pit.minZ+pit.maxZ)/2,pit.maxX-pit.minX,.8,pit.maxZ-pit.minZ);
  const groundMaterial=facade.road;
  for(const r of aroundPit({minX:-150,maxX:150,minZ:-150,maxZ:150}))
    box(outdoors,groundMaterial,(r.minX+r.maxX)/2,-2.7,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.02,r.maxZ-r.minZ);
  const apronCenter=center(schoolBounds);
  box(outdoors,facade.road,apronCenter.x,-.055,(schoolBounds.maxZ+29.5)/2,schoolBounds.maxX-schoolBounds.minX,.12,29.5-schoolBounds.maxZ,true);

  for(const cell of floorData[1]!) {
    const rect=cellRect(cell),point=center(rect),name=cell.name.replaceAll('\n','');
    if(name.startsWith('필로티')||name==='농구장')continue;
    const room=places.find(place=>place.kind==='room'&&inside(point,place.rect));
    // The raised dining floor can also hide a visitor on the lower exterior path.
    const floorBox=name==='급식실'?wallBox:box;
    floorBox(indoor,room?palette.floor:palette.corridor,point.x,-.11,point.z,rect.maxX-rect.minX,.22,rect.maxZ-rect.minZ);
  }

  const doors=new Map<string,{pivot:THREE.Group;second?:THREE.Group;target:number;angle:number;slide?:THREE.Object3D[]}>();
  /** Chair, stool and bench seats from the classroom furniture markers. */
  const seats:Seat[]=[];
  let seatHeight:number|undefined;
  let activityPose:{activity?:PlayerActivity;lift?:number}={};
  /** Batch one classroom prototype into a floor group, keeping its seats and banner face. */
  function placePiece(group:THREE.Group,floor:number,name:string,x:number,y:number,z:number,rotation:number) {
    const model=asset(name);model.position.set(x,y,z);model.rotation.y=rotation;model.updateMatrixWorld(true);
    model.traverse(marker=>{if(marker.name.startsWith('seat')){
      const at=marker.getWorldPosition(new THREE.Vector3()),facing=new THREE.Vector3(0,0,1).applyQuaternion(marker.getWorldQuaternion(new THREE.Quaternion()));
      seats.push({floor,x:at.x,y:at.y,z:at.z,yaw:Math.atan2(facing.x,facing.z),model:name});
    }});
    const face=model.getObjectByName('welcome-banner-face');
    if(face){const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.05),bannerMaterial());face.getWorldPosition(sign.position);sign.rotation.y=model.rotation.y;group.add(sign);}
    staticModel(group,model);
  }
  const pickDoors:THREE.Object3D[]=[];
  /** Rim centres of the two basketball hoops, in world coordinates. */
  const hoops:THREE.Vector3[]=[];
  for(const place of places) {
    if(place.kind==='outdoor'||portals.some(p=>p.id===place.id)||!place.enterable&&/현관|통로|복도|계단|로비|출입구|홀/.test(place.name))continue;
    const rect=place.rect,c=center(rect),width=rect.maxX-rect.minX,depth=rect.maxZ-rect.minZ;
    const northDoor=place.enterable&&Math.abs(place.door.z-rect.minZ)<.5;
    const southDoor=place.enterable&&!northDoor;
    const wall=wallThickness,high=rect.minZ===schoolBounds.minZ?2.8:.72,low=.62;
    // Retain only the far back wall; corridor-side walls must not hide a visitor.
    const northZ=rect.minZ,southZ=rect.maxZ;
    function horizontalWall(z:number,height:number,hasDoor:boolean) {
      if(!hasDoor){wallBox(indoor,wallFinish.body,c.x,height/2,z,width,height,wall);wallBox(indoor,wallFinish.base,c.x,.16,z,width,.3,wall+.035);return;}
      const left=place.door.x-doorWidth/2,right=place.door.x+doorWidth/2;
      box(indoor,wallFinish.body,(rect.minX+left)/2,height/2,z,left-rect.minX,height,wall);
      box(indoor,wallFinish.body,(right+rect.maxX)/2,height/2,z,rect.maxX-right,height,wall);
      box(indoor,wallFinish.base,(rect.minX+left)/2,.16,z,left-rect.minX,.3,wall+.035);
      box(indoor,wallFinish.base,(right+rect.maxX)/2,.16,z,rect.maxX-right,.3,wall+.035);
      if(height>2.3)box(indoor,wallFinish.body,place.door.x,2.58,z,doorWidth,.44,wall);
      box(indoor,palette.lightWood,left-.045,1.15,z,.09,2.3,.23,true);
      box(indoor,palette.lightWood,right+.045,1.15,z,.09,2.3,.23,true);
      box(indoor,palette.lightWood,place.door.x,2.32,z,doorWidth+.17,.12,.23,true);
    }
    const glazed=place.id==='library'||place.id==='open-library';
    if(glazed) {
      const spans=[[rect.minX,place.door.x-doorWidth/2],[place.door.x+doorWidth/2,rect.maxX]];
      for(const [a,b] of spans) {
        const count=Math.max(1,Math.ceil((b-a)/1.55)),step=(b-a)/count;
        for(let i=0;i<count;i++) {
          const x=a+(i+.5)*step;
          box(indoor,roomGlass,x,1.23,northZ,step-.04,2.42,.035);
          box(indoor,palette.glass,x,.59,northZ,step-.04,1.12,.025);
          box(indoor,hall.metal,a+i*step,1.25,northZ,.045,2.5,.08);
          box(indoor,hall.metal,x,1.15,northZ,step,.035,.08);
          box(indoor,hall.metal,x,2.13,northZ,step,.035,.08);
        }
        box(indoor,hall.metal,b,1.25,northZ,.045,2.5,.08);
        box(indoor,hall.metal,(a+b)/2,2.48,northZ,b-a,.06,.09);
      }
    } else horizontalWall(northZ,high,northDoor);
    horizontalWall(southZ,low,southDoor);
    const passage=[[rect.minZ,libraryPassage.minZ],[libraryPassage.maxZ,rect.maxZ]];
    const westSpans=place.id==='dining'?[[rect.minZ,-26.85],[-25.05,rect.maxZ]]:place.id==='library'?passage:[[rect.minZ,rect.maxZ]];
    for(const [a,b] of westSpans) {
      wallBox(indoor,wallFinish.body,rect.minX,high/2,(a+b)/2,wall,high,b-a);
      wallBox(indoor,wallFinish.base,rect.minX,.16,(a+b)/2,wall+.035,.3,b-a);
    }
    if(place.id==='dining') {
      const portal=portals.find(p=>p.id==='dining-door')!;
      for(const [a,b] of [[rect.minZ,diningHall.minZ],[-22.15,portal.center-portal.width/2],[portal.center+portal.width/2,rect.maxZ]]) {
        box(indoor,wallFinish.body,rect.maxX,low/2,(a+b)/2,wall,low,b-a);
        box(indoor,wallFinish.base,rect.maxX,.16,(a+b)/2,wall+.035,.3,b-a);
      }
      box(indoor,roomGlass,(diningVestibule.maxX+rect.maxX)/2,1.2,diningHall.minZ,rect.maxX-diningVestibule.maxX,2.4,.1);
    } else for(const [a,b] of place.id==='open-library'?passage:[[rect.minZ,rect.maxZ]]) {
      wallBox(indoor,wallFinish.body,rect.maxX,low/2,(a+b)/2,wall,low,b-a);
      wallBox(indoor,wallFinish.base,rect.maxX,.16,(a+b)/2,wall+.035,.3,b-a);
    }
    // The window is schematic and rests on the retained back wall.
    if(width>5&&high>2.3) {
      const windowX=place.enterable?rect.minX+1.5:c.x;
      box(indoor,palette.glass,windowX,1.66,northZ+.105,1.65,1.1,.035,true);
      box(indoor,palette.lightWood,windowX,1.08,northZ+.13,1.85,.09,.15,true);
      box(indoor,palette.cream,windowX,1.66,northZ+.14,.06,1.15,.04);
      box(indoor,palette.cream,windowX,1.66,northZ+.14,1.7,.05,.04);
    }
    const labelX=place.enterable?place.door.x:c.x;
    sign(indoor,place.name,labelX,place.enterable?2.62:high/2,northZ+.14,Math.min(place.enterable?3.6:2.4,width-.4));
    if(place.enterable) {
      const pivot=new THREE.Group();pivot.position.set(place.door.x-doorWidth/2,.025,place.door.z);pivot.userData.placeId=place.id;
      let door:THREE.Object3D,slide:THREE.Object3D[]|undefined;
      if(glazed) {
        // The library entrances are automatic bi-parting sliding doors with stainless frames.
        const leafWidth=doorWidth/2,glassDoor=new THREE.Group();slide=[];
        for(const side of [-1,1]) {
          const leaf=new THREE.Group();leaf.position.x=doorWidth/2;glassDoor.add(leaf);slide.push(leaf);
          const part=(mat:THREE.Material,x:number,y:number,w:number,h:number,d=.05)=>{
            const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(side*x,y,side*.03);mesh.castShadow=true;leaf.add(mesh);
          };
          part(roomGlass,leafWidth/2,1.12,leafWidth-.05,2.22,.03);
          part(palette.glass,leafWidth/2,.55,leafWidth-.05,1.04,.03);
          for(const x of [.02,leafWidth-.02])part(hall.metal,x,1.12,.04,2.24);
          for(const y of [.025,2.22])part(hall.metal,leafWidth/2,y,leafWidth,.05);
        }
        const header=new THREE.Mesh(new THREE.BoxGeometry(doorWidth+.4,.16,.14),hall.metal);header.position.set(doorWidth/2,2.33,0);glassDoor.add(header);
        const sensor=new THREE.Mesh(new THREE.BoxGeometry(.18,.05,.06),hall.dark);sensor.position.set(doorWidth/2,2.22,-.08);glassDoor.add(sensor);
        door=glassDoor;
      } else door=asset('door');
      door.traverse(object=>{if(object instanceof THREE.Mesh)object.userData.placeId=place.id;});pivot.add(door);
      indoor.add(pivot);doors.set(place.id,{pivot,target:0,angle:0,slide});pickDoors.push(door);
      box(indoor,palette.darkMint,place.door.x,.015,place.door.z+(northDoor?.55:-.55),doorWidth,.025,.72,true);
    }
  }

  for(const r of [...diningTables,...diningBenches]) {
    const c=center(r),height=diningTables.includes(r)?.74:.43;
    box(indoor,palette.lightWood,c.x,height,c.z,r.maxX-r.minX,.08,r.maxZ-r.minZ,true);
    for(const x of [r.minX+.2,r.maxX-.2])box(indoor,hall.metal,x,height/2,c.z,.08,height,r.maxZ-r.minZ-.1);
  }
  for(const furniture of furnishings) {
    const rect=furniture.rect,c=center(rect),width=rect.maxX-rect.minX,depth=rect.maxZ-rect.minZ;
    const model=new THREE.Group(),detail=asset(furniture.roomId==='principal'?'standing-desk':furniture.kind);model.add(detail);
    if(furniture.roomId==='principal')detail.rotation.y=Math.PI;
    if(furniture.kind==='shelf'&&depth>width)detail.rotation.y=Math.PI/2;
    const bounds=new THREE.Box3().setFromObject(model),extent=bounds.getSize(new THREE.Vector3());
    model.scale.set(width/extent.x,1,depth/extent.z);
    const fitted=new THREE.Box3().setFromObject(model),middle=fitted.getCenter(new THREE.Vector3());
    model.position.set(c.x-middle.x,-fitted.min.y,c.z-middle.z);
    staticModel(indoor,model);
  }
  for(const f of groundFurniture)placePiece(indoor,1,f.model,f.x,f.y??0,f.z,f.rotation);
  for(const resident of schoolResidents) {
    const model=asset(resident.model);
    model.position.set(resident.x,resident.outside?campusHeight(resident):0,resident.z);
    model.rotation.y=resident.rotation;
    staticModel(resident.outside?campusContext:indoor,model);
  }
  for(const fixture of restroomFixtures) {
    const model=asset(fixture.model);model.position.set(fixture.x,0,fixture.z);staticModel(indoor,model);
  }
  // Draw an actual wheelchair pictogram, independent of platform emoji fonts.
  const accessible=places.find(p=>p.id==='accessible-toilet')!;
  const accessCanvas=document.createElement('canvas');accessCanvas.width=256;accessCanvas.height=256;
  const accessContext=accessCanvas.getContext('2d')!;
  accessContext.fillStyle='#4b7c89';accessContext.fillRect(0,0,256,256);
  accessContext.strokeStyle='#fffaf0';accessContext.fillStyle='#fffaf0';accessContext.lineWidth=16;accessContext.lineCap='round';accessContext.lineJoin='round';
  accessContext.beginPath();accessContext.arc(127,48,18,0,Math.PI*2);accessContext.fill();
  accessContext.beginPath();accessContext.arc(101,166,51,-Math.PI*.15,Math.PI*1.45);accessContext.stroke();
  accessContext.beginPath();accessContext.moveTo(125,88);accessContext.lineTo(133,142);accessContext.lineTo(173,142);accessContext.lineTo(196,191);accessContext.lineTo(218,181);accessContext.moveTo(130,108);accessContext.lineTo(176,108);accessContext.stroke();
  const accessTexture=new THREE.CanvasTexture(accessCanvas);accessTexture.colorSpace=THREE.SRGBColorSpace;
  const accessMaterial=new THREE.MeshStandardMaterial({map:accessTexture,roughness:.9,side:THREE.DoubleSide});
  staticGeometry(indoor,new THREE.PlaneGeometry(.8,.8),accessMaterial,accessible.rect.minX+.01,1.2,(accessible.rect.minZ+accessible.rect.maxZ)/2,new THREE.Euler(0,-Math.PI/2,0));
  for(const r of extraFloors.filter(r=>r!==courtAccess&&r!==diningStairs))box(indoor,r===parkingConnector?facade.road:palette.corridor,(r.minX+r.maxX)/2,-.11,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.22,r.maxZ-r.minZ);
  for(let i=0;i<10;i++) {
    const w=(diningStairs.maxX-diningStairs.minX)/10,x=diningStairs.minX+(i+.5)*w,y=-courtDrop+(i+1)*courtDrop/10;
    const z=(diningStairs.minZ+diningStairs.maxZ)/2,d=diningStairs.maxZ-diningStairs.minZ;
    box(indoor,palette.stone,x,y-.09,z,w,.18,d);
    box(indoor,palette.lightWood,x-w/2+.015,y+.008,z,.03,.016,d);
  }
  // Ten 18 cm risers; tread run and total drop remain provisional until measured.
  for(const [a,b,h] of [[courtAccess.minX,courtRamp.minX,-courtDrop],[courtRamp.maxX,courtAccess.maxX,0]])
    box(courtyardView,palette.corridor,(a+b)/2,h-.1,(courtAccess.minZ+courtAccess.maxZ)/2,b-a,.2,courtAccess.maxZ-courtAccess.minZ);
  for(let i=0;i<courtSteps;i++) {
    const width=(courtRamp.maxX-courtRamp.minX)/courtSteps,x=courtRamp.minX+(i+.5)*width,y=-courtDrop+(i+1)*courtDrop/courtSteps;
    box(courtyardView,palette.stone,x,y-.1,(courtRamp.minZ+courtRamp.maxZ)/2,width,.2,courtRamp.maxZ-courtRamp.minZ);
    box(courtyardView,palette.lightWood,x-width/2+.015,y+.008,(courtRamp.minZ+courtRamp.maxZ)/2,.03,.016,courtRamp.maxZ-courtRamp.minZ);
  }
  const stairViews:{group:THREE.Group;floor:number;stairId:string;arrival?:boolean}[]=[];
  function rail(group:THREE.Group,a:THREE.Vector3,b:THREE.Vector3) {
    const geometry=new THREE.CylinderGeometry(.035,.035,a.distanceTo(b),6);
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));
    const c=a.clone().add(b).multiplyScalar(.5);staticGeometry(group,geometry,hall.metal,c.x,c.y,c.z,rotation);
  }
  for(const z of [diningStairs.minZ+.08,diningStairs.maxZ-.08]) {
    rail(indoor,new THREE.Vector3(diningStairs.minX,1-courtDrop,z),new THREE.Vector3(diningStairs.maxX,1,z));
    rail(indoor,new THREE.Vector3(diningLanding.minX,1,z),new THREE.Vector3(diningLanding.maxX,1,z));
    for(let i=0;i<=5;i++){const x=diningStairs.minX+(diningStairs.maxX-diningStairs.minX)*i/5;cylinder(indoor,hall.metal,x,groundHeight({x,z})+.5,z,.03,1);}
  }
  for(const stair of stairs)for(let floor=1;floor<=5;floor++) {
    const group=new THREE.Group();group.name=`${stair.id}-${floor}F`;stairRoot.add(group);stairViews.push({group,floor,stairId:stair.id});
    const origin=stairPoint(stair,0,0);
    const central=stair.id==='stairs-central',w=stair.rect.maxX-stair.rect.minX,d=stair.rect.maxZ-stair.rect.minZ;
    group.position.set(origin.x,0,origin.z);group.rotation.y=central?Math.PI/2:stair.id==='stairs-east'?Math.PI:0;
    group.scale.set((central?d:w)/5.8,1,(central?w:d)/4);
    for(const s of stairSurfaces.filter(s=>s.stairId===stair.id&&s.floor===floor)) {
      const r=s.localRect,c=center(r),count=s.kind==='flight'?10:1,w=(r.maxX-r.minX)/count;
      const height=(x:number,z:number)=>surfaceHeight(s,stairPoint(stair,x,z));
      for(let i=0;i<count;i++) {
        const x=r.minX+(i+.5)*w,y=height(x,c.z);
        box(group,palette.corridor,x,y-.09,c.z,w,.18,r.maxZ-r.minZ);
        if(s.kind==='flight')box(group,palette.lightWood,x-w/2+.02,y+.006,c.z,.04,.012,r.maxZ-r.minZ);
      }
      if(s.kind==='flight')for(const z of [r.minZ+.08,r.maxZ-.08]) {
        rail(group,new THREE.Vector3(r.minX,height(r.minX,z)+.95,z),new THREE.Vector3(r.maxX,height(r.maxX,z)+.95,z));
        for(let i=0;i<=4;i++){const x=r.minX+(r.maxX-r.minX)*i/4,y=height(x,z);cylinder(group,hall.metal,x,y+.47,z,.025,.94);}
      } else {
        const outsideX=r.minX===0?r.minX:r.maxX;
        if(r.minX!==0)rail(group,new THREE.Vector3(outsideX,s.leftHeight+.95,r.minZ),new THREE.Vector3(outsideX,s.leftHeight+.95,r.maxZ));
        for(const z of [r.minZ,r.maxZ])if(r.minX!==0||floor===1&&z===r.minZ&&stair.id!=='stairs-east')rail(group,new THREE.Vector3(r.minX,s.leftHeight+.95,z),new THREE.Vector3(r.maxX,s.leftHeight+.95,z));
        if(r.minX===0) {
          const a=floor===1?r.minZ:r.minZ+1.8,b=floor===5?r.maxZ:r.minZ+2.2;
          rail(group,new THREE.Vector3(r.maxX,s.leftHeight+.95,a),new THREE.Vector3(r.maxX,s.leftHeight+.95,b));
        }
      }
    }
    sign(group,`${floor}층`,.6,(floor-1)*floorRise+.8,.12,1);
    if(floor<5) {
      const arrival=new THREE.Group(),h=floor*floorRise;
      arrival.position.copy(group.position);arrival.rotation.copy(group.rotation);arrival.scale.copy(group.scale);
      stairRoot.add(arrival);stairViews.push({group:arrival,floor,stairId:stair.id,arrival:true});
      box(arrival,palette.corridor,.6,h-.09,2,1.2,.18,4);
    }
  }
  for(const portal of portals) {
    const frame=new THREE.Group(),pivot=new THREE.Group(),second=portal.double?new THREE.Group():undefined;
    frame.position.set(portal.axis==='x'?portal.at:portal.center-portal.width/2,0,portal.axis==='x'?portal.center-portal.width/2:portal.at);
    if(portal.axis==='x')frame.rotation.y=-Math.PI/2;
    frame.add(pivot);indoor.add(frame);
    if(second){second.position.x=portal.width;frame.add(second);}
    const leafWidth=portal.width/(second?2:1);
    for(const leaf of second?[pivot,second]:[pivot]) {
      const sign=leaf===pivot?1:-1;
      const part=(mat:THREE.Material,x:number,y:number,w:number,h:number,d:number)=>{
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(sign*x,y,0);mesh.userData.placeId=portal.id;leaf.add(mesh);pickDoors.push(mesh);
      };
      part(portal.steel?hall.trim:roomGlass,leafWidth/2,1.15,leafWidth-.08,2.25,portal.steel?.07:.04);
      for(const x of [0,leafWidth])part(hall.metal,x,1.15,.06,2.3,.08);
      for(const y of portal.steel?[.03,2.3]:[.03,1.05,2.3])part(hall.metal,leafWidth/2,y,leafWidth,.06,.08);
      part(hall.dark,leafWidth-.16,1.15,.05,.35,.18);
    }
    doors.set(portal.id,{pivot,second,target:0,angle:0});
    if(!portal.hideSign)sign(indoor,portal.name,portal.axis==='x'?portal.at:portal.center,2.6,portal.axis==='x'?portal.center:portal.at,2.4,portal.axis==='x'?new THREE.Euler(0,Math.PI/2,0):new THREE.Euler());
  }
  for(const place of places.filter(place=>place.id==='entrance'||place.id==='west-entrance')) {
    const c=place.id==='entrance'?lobbyExit:center(place.rect);
    box(indoor,palette.mint,c.x,.018,c.z,Math.min(7,place.rect.maxX-place.rect.minX-1),.035,2.1,true);
  }

  // One world-aligned 1.5 m grid continues through corridor/lobby boundaries.
  const tiledFloors=[...floorData[1].filter(c=>/복도|통로|현관|로비|출입구|홀/.test(c.name)).map(c=>cellRect(c)),...extraFloors.filter(r=>r!==courtAccess&&r!==parkingConnector&&r!==diningStairs&&r!==diningLanding&&!stairs.some(s=>s.rect===r))];
  for(const r of tiledFloors) {
    const firstX=schoolBounds.minX+Math.ceil((r.minX-schoolBounds.minX)/1.5)*1.5;
    const firstZ=schoolBounds.minZ+Math.ceil((r.minZ-schoolBounds.minZ)/1.5)*1.5;
    for(let x=firstX;x<r.maxX;x+=1.5)box(indoor,hall.trim,x,.007,(r.minZ+r.maxZ)/2,.012,.012,r.maxZ-r.minZ);
    for(let z=firstZ;z<r.maxZ;z+=1.5)box(indoor,hall.trim,(r.minX+r.maxX)/2,.008,z,r.maxX-r.minX,.012,.012);
  }
  // Video landmarks sit against walls, keeping the corridor's walking strip clear.
  const returned=center(bookReturn);
  box(indoor,hall.returnGreen,returned.x,.57,returned.z,bookReturn.maxX-bookReturn.minX,1.14,bookReturn.maxZ-bookReturn.minZ,true);
  box(indoor,hall.dark,returned.x,.91,bookReturn.maxZ+.008,.55,.075,.02);
  sign(indoor,'도서 반납함',returned.x,.68,bookReturn.maxZ+.025,.66);
  const elevator=places.find(p=>p.id==='elevator-hall')!.rect,ec=center(elevator);
  box(indoor,hall.blue,ec.x,-.014,ec.z,elevator.maxX-elevator.minX,.04,elevator.maxZ-elevator.minZ);
  box(indoor,hall.blue,ec.x,1.4,elevator.minZ+.08,3.2,2.8,.12);
  for(const side of [-1,1]) {
    box(indoor,hall.metal,ec.x+side*.39,1.06,elevator.minZ+.17,.76,2.12,.09);
    box(indoor,hall.trim,ec.x+side*.87,1.15,elevator.minZ+.16,.16,2.3,.16);
  }
  box(indoor,hall.dark,ec.x,1.05,elevator.minZ+.23,.02,2.1,.02);
  box(indoor,hall.dark,ec.x+1.12,1.1,elevator.minZ+.22,.12,.28,.045);
  sign(indoor,'엘리베이터홀',ec.x,2.48,elevator.minZ+.2,2.4);
  const lobby=places.find(p=>p.id==='entrance')!.rect;
  for(const x of [lobby.minX-.04,lobby.maxX+.04])for(let z=lobby.maxZ-3.5;z<lobby.maxZ-.2;z+=.2)box(indoor,palette.lightWood,x,1.25,z,.10,2.5,.09);
  sign(indoor,'중앙로비',lobbyExit.x,.045,lobbyExit.z,3.6,new THREE.Euler(-Math.PI/2,0,0));
  const east=places.find(p=>p.id==='east-passage')!.rect;
  box(indoor,palette.wood,east.maxX-.06,1.25,(east.minZ+east.maxZ)/2,.12,1.3,2.4,true);
  box(indoor,palette.cream,east.maxX-.13,1.25,(east.minZ+east.maxZ)/2,.025,1.12,2.2);
  for(let i=0;i<4;i++)box(indoor,i%2?palette.mint:palette.lightWood,east.maxX-.15,1.25,east.minZ+1.4+i*.48,.02,.65,.35);
  sign(indoor,'동편출입구',(east.minX+east.maxX)/2,.025,east.maxZ-1.1,3,new THREE.Euler(-Math.PI/2,0,0));

  // Exterior context uses the same measured cells as the Blender export and interior.
  const campusPlaces=floorData[1].map(cell=>({name:cell.name.replaceAll('\n',''),rect:cellRect(cell)}));
  for(const [group,mappedPlaces] of [[indoor,places],[building,campusPlaces]] as const) {
    const basketball=mappedPlaces.find(place=>place.name==='농구장');
    if(basketball) {
      const courtGroup=new THREE.Group();(group===indoor?courtyardView:group).add(courtGroup);courtGroup.position.y=-courtDrop;
      const rect=basketball.rect,c=center(rect),width=rect.maxX-rect.minX,depth=rect.maxZ-rect.minZ;
      box(courtGroup,palette.darkMint,c.x,-.025,c.z,width,.13,depth,true);
      box(courtGroup,palette.mint,c.x,.048,c.z,width-1,.02,depth-1,true);
      const boundaryWidth=width-1.7,boundaryDepth=depth-1.7;
      for(const z of [c.z-boundaryDepth/2,c.z+boundaryDepth/2])box(courtGroup,palette.white,c.x,.066,z,boundaryWidth,.016,.045);
      for(const x of [c.x-boundaryWidth/2,c.x,c.x+boundaryWidth/2])box(courtGroup,palette.white,x,.066,c.z,.045,.016,boundaryDepth);
      staticGeometry(courtGroup,new THREE.TorusGeometry(1.15,.024,5,36),palette.white,c.x,.076,c.z,new THREE.Euler(Math.PI/2,0,0));
      for(const side of [-1,1]) {
        const x=c.x+side*(boundaryWidth/2-.8);
        cylinder(courtGroup,palette.ink,x,.9,c.z,.08,1.8);
        box(courtGroup,palette.cream,x,2.05,c.z,.12,.95,1.45,true);
        staticGeometry(courtGroup,new THREE.TorusGeometry(.27,.035,6,16),palette.wood,x-side*.45,1.8,c.z,new THREE.Euler(Math.PI/2,0,0));
        if(group===indoor)hoops.push(new THREE.Vector3(x-side*.45,1.8-courtDrop,c.z));
      }
      sign(courtGroup,basketball.name,c.x,.087,c.z+boundaryDepth/2-.7,3,new THREE.Euler(-Math.PI/2,0,0));
    }
    for(const parking of mappedPlaces.filter(place=>group===indoor&&place.name.startsWith('필로티'))) {
      const r=parking.rect,c=center(r);
      box(parkingContext,facade.road,c.x,-.025,c.z,r.maxX-r.minX,.12,r.maxZ-r.minZ);
      if(parking.name!=='필로티진입부')for(let x=r.minX+1.4;x<r.maxX-.5;x+=3)box(parkingContext,palette.white,x,.041,c.z,.045,.015,Math.min(3.4,r.maxZ-r.minZ-.5));
      sign(parkingContext,parking.name,c.x,.06,r.maxZ-.55,3.8,new THREE.Euler(-Math.PI/2,0,0));
    }
  }
  for(const r of parkingWalkAreas)box(parkingContext,facade.road,(r.minX+r.maxX)/2,-.055,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.1,r.maxZ-r.minZ);
  for(const p of parkingColumns)cylinder(parkingContext,palette.cream,p.x,1.65,p.z,.47,3.3);
  // Soft stall paint, wheel stops and flower rings make the visitor parking feel like the welcome image.
  const stallPaint=material(0xdfe8dc,.95),wheelStop=material(0xf3ead2,.8),petals=[material(0xf2a7b8,.6),material(0xf6d77a,.6),material(0xb9a3e3,.6)];
  for(const car of parkedCars) {
    const g=new THREE.Group();g.position.set(car.x,0,car.z);g.rotation.y=car.turn;parkingContext.add(g);
    const model=asset('parked-car'),paint=new THREE.MeshStandardMaterial({color:car.color,roughness:.38});
    model.traverse(object=>{if(object instanceof THREE.Mesh&&(object.material as THREE.Material).name==='car paint')object.material=paint;});
    g.add(model);
    box(g,stallPaint,0,.03,0,2.5,.012,4.9);
    box(g,wheelStop,0,.06,-2.25,1.5,.1,.18,true);
  }
  for(const p of parkingColumns) {
    staticGeometry(parkingContext,new THREE.TorusGeometry(.56,.1,6,20),palette.green,p.x,.08,p.z,new THREE.Euler(Math.PI/2,0,0));
    for(let i=0;i<8;i++){const a=i*Math.PI/4;staticGeometry(parkingContext,new THREE.SphereGeometry(.07,6,4),petals[i%3]!,p.x+Math.cos(a)*.56,.17,p.z+Math.sin(a)*.56);}
  }
  const shop=places.find(p=>p.id==='shop')!.rect,shopX=(shop.minX+shop.maxX)/2;
  box(parkingContext,palette.darkMint,shopX,1.4,shop.minZ,shop.maxX-shop.minX,2.8,.16);
  box(parkingContext,palette.darkMint,shop.maxX,1.4,(shop.minZ+shop.maxZ)/2,.16,2.8,shop.maxZ-shop.minZ);
  sign(parkingContext,'매점',shopX,2.5,shop.maxZ+.1,2.4);
  const recycle=recyclingPoint;
  box(parkingContext,palette.lightWood,recycle.x,2.4,recycle.z,3.1,.16,2.3,true);
  for(const x of [recycle.x-1.4,recycle.x+1.4])for(const z of [recycle.z-1,recycle.z+1])cylinder(parkingContext,hall.metal,x,1.2,z,.055,2.4);
  for(let i=0;i<3;i++){box(parkingContext,palette.darkMint,recycle.x-1+i,.5,recycle.z,.8,1,.8,true);box(parkingContext,hall.metal,recycle.x-1+i,1.04,recycle.z,.85,.1,.85,true);}
  sign(parkingContext,'분리수거장',recycle.x,2.65,recycle.z+1.2,3);
  const boundaryMaterial=new THREE.MeshStandardMaterial({color:0xc4a680,roughness:.9,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});
  for(const r of boundaryWalls) {
    const c=center(r),width=r.maxX-r.minX,depth=r.maxZ-r.minZ;
    box(indoor,boundaryMaterial,c.x,1.2,c.z,width,2.4,depth);
    box(indoor,wallFinish.base,c.x,.10,c.z,width,.20,depth+.01);
    box(indoor,wallFinish.body,c.x,2.4,c.z,width,.045,depth);
  }
  // Close the raised dining floor's exposed edge down to the sloping courtyard ground.
  const diningWidth=diningHall.maxX-diningHall.minX;
  const foundationGeometry=new THREE.BoxGeometry(diningWidth,1,wallThickness,Math.ceil(diningWidth),1,1);
  foundationGeometry.translate((diningHall.minX+diningHall.maxX)/2,-.5,diningHall.maxZ);
  const foundationVertices=foundationGeometry.getAttribute('position');
  for(let i=0;i<foundationVertices.count;i++)foundationVertices.setY(i,foundationVertices.getY(i)<-.5?exteriorGrade({x:foundationVertices.getX(i),z:foundationVertices.getZ(i)})-.08:.01);
  foundationGeometry.computeVertexNormals();
  const diningFoundation=new THREE.Mesh(foundationGeometry,wallFinish.base);
  diningFoundation.name='dining-courtyard-foundation';diningFoundation.castShadow=true;diningFoundation.receiveShadow=true;outdoors.add(diningFoundation);

  // Ground-floor silhouette is calibrated to A-202; upper shells share its structural wings.
  staticModel(building,exteriorAsset!.scene);
  const entrance=campusPlaces.find(place=>place.name==='중앙로비');
  if(entrance) {
    const c=center(entrance.rect);
    const canopy=asset('entrance');canopy.scale.x=(entrance.rect.maxX-entrance.rect.minX+1.5)/16.55;
    canopy.position.set(c.x,0,entrance.rect.maxZ);staticModel(building,canopy);
    sign(building,schoolConfig.schoolName,c.x,3.72,entrance.rect.maxZ+3.055,5.45);
  }
  // Field and three access stairs share heights with visitor movement.
  const field=fieldRect,fieldCenter=center(field);
  const fieldGroup=new THREE.Group();fieldGroup.position.y=-fieldDrop;campusContext.add(fieldGroup);
  const stairRail=(x:number,z:number,y:number)=>cylinder(campusContext,hall.metal,x,y+.5,z,.035,1);
  for(const r of fieldStairs)for(let i=0;i<10;i++) {
    const depth=(r.maxZ-r.minZ)/10,z=r.minZ+(i+.5)*depth,y=-(i+.5)*fieldDrop/10;
    box(campusContext,palette.stone,(r.minX+r.maxX)/2,y-.09,z,r.maxX-r.minX,.18,depth);
    for(const x of [r.minX+.08,r.maxX-.08])stairRail(x,z,y);
  }
  for(const r of fieldStairs)for(const x of [r.minX+.08,r.maxX-.08])rail(campusContext,new THREE.Vector3(x,.95,r.minZ),new THREE.Vector3(x,.95-fieldDrop,r.maxZ));
  for(const r of fieldRamps) {
    const geometry=new THREE.BoxGeometry(r.maxX-r.minX,1,r.maxZ-r.minZ);
    geometry.translate((r.minX+r.maxX)/2,-.5,(r.minZ+r.maxZ)/2);
    const vertices=geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)vertices.setY(i,vertices.getY(i)<-.5?-fieldDrop-.18:campusHeight({x:vertices.getX(i),z:vertices.getZ(i)})-.015);
    geometry.computeVertexNormals();staticGeometry(campusContext,geometry,facade.road,0,0,0);
  }
  const stageCenter=center(rostrum);
  box(campusContext,palette.stone,stageCenter.x,.32,stageCenter.z,rostrum.maxX-rostrum.minX,.64,rostrum.maxZ-rostrum.minZ,true);
  box(campusContext,palette.lightWood,stageCenter.x,.67,stageCenter.z,rostrum.maxX-rostrum.minX,.07,rostrum.maxZ-rostrum.minZ,true);
  box(campusContext,palette.wood,stageCenter.x,1.15,rostrum.maxZ-.7,.8,.9,.55,true);
  sign(campusContext,'구령대',stageCenter.x,1.35,rostrum.maxZ-.4,1.1);
  for(const [a,b] of [[-40.5,fieldStairs[0].minX],[fieldStairs[0].maxX,fieldStairs[1].minX],[fieldStairs[1].maxX,fieldStairs[2].minX],[fieldStairs[2].maxX,40.5]])
    box(campusContext,facade.road,(a+b)/2,-fieldDrop/2,31.75,b-a,fieldDrop,4.5);
  const lowerCenter=center(lowerGround);
  box(campusContext,facade.road,lowerCenter.x,-fieldDrop-.51,lowerCenter.z,lowerGround.maxX-lowerGround.minX,.8,lowerGround.maxZ-lowerGround.minZ,true);
  box(fieldGroup,facade.field,fieldCenter.x,-.005,fieldCenter.z,72,.1,48,true);
  for(let i=0;i<8;i++)if(i%2===0)box(fieldGroup,facade.fieldStripe,0,.049,field.minZ+3+i*6,71.6,.015,6);
  const pitch={minX:-33,maxX:33,minZ:37,maxZ:79},pitchCenter=center(pitch);
  for(const z of [pitch.minZ,pitch.maxZ])box(fieldGroup,palette.white,0,.068,z,66,.02,.075);
  for(const x of [pitch.minX,0,pitch.maxX])box(fieldGroup,palette.white,x,.068,pitchCenter.z,.075,.02,42);
  staticGeometry(fieldGroup,new THREE.TorusGeometry(4.5,.045,5,48),palette.white,0,.081,pitchCenter.z,new THREE.Euler(Math.PI/2,0,0));
  for(const x of [pitch.minX,pitch.maxX]) {
    const direction=x===pitch.minX?1:-1,penaltyX=x+direction*7.5;
    box(fieldGroup,palette.white,penaltyX,.071,pitchCenter.z,.075,.02,24);
    for(const z of [pitchCenter.z-12,pitchCenter.z+12])box(fieldGroup,palette.white,x+direction*3.75,.071,z,7.5,.02,.075);
    for(const z of [pitchCenter.z-3.6,pitchCenter.z+3.6])box(fieldGroup,palette.white,x,1.05,z,.09,2.1,.09,true);
    box(fieldGroup,palette.white,x,2.12,pitchCenter.z,.09,.09,7.3,true);
    box(fieldGroup,palette.white,x-direction*1.6,.13,pitchCenter.z,.08,.08,7.3);
    for(const z of [pitchCenter.z-3.6,pitchCenter.z+3.6])box(fieldGroup,palette.white,x-direction*1.6,1.05,z,.07,2.1,.07);
    box(fieldGroup,palette.white,x-direction*1.6,2.08,pitchCenter.z,.06,.06,7.3);
  }
  const sportsCourts=new THREE.Group();sportsCourts.position.y=-fieldDrop;campusContext.add(sportsCourts);
  box(sportsCourts,facade.courtEdge,0,.015,91,72,.12,15,true);
  for(const x of [-20,20]) {
    box(sportsCourts,facade.court,x,.08,91,27,.025,11,true);
    for(const z of [86.4,95.6])box(sportsCourts,palette.white,x,.099,z,24,.018,.065);
    for(const edgeX of [x-12,x,x+12])box(sportsCourts,palette.white,edgeX,.099,91,.065,.018,9.2);
    staticGeometry(sportsCourts,new THREE.TorusGeometry(1.1,.035,5,28),palette.white,x,.11,91,new THREE.Euler(Math.PI/2,0,0));
  }
  box(campusContext,facade.road,(eastWalk.minX+eastWalk.maxX)/2,-.055,(eastWalk.minZ+campusGround.maxZ)/2,eastWalk.maxX-eastWalk.minX,.1,campusGround.maxZ-eastWalk.minZ);
  box(campusContext,facade.road,47,-.025,25,18,.12,6,true);
  const gate=asset('gate');gate.position.set(campusGate.x,0,campusGate.z);staticModel(campusContext,gate);
  const fenceMaterial=material(0x718e82,.65),roadMaterial=material(0x8d9690);
  // Shared fence rectangles define both the visible boundary and collision.
  for(const r of campusFences) {
    const alongX=r.maxX-r.minX>r.maxZ-r.minZ,c=center(r),length=alongX?r.maxX-r.minX:r.maxZ-r.minZ;
    const count=Math.ceil(length/2.5);
    for(let i=0;i<count;i++) {
      const start=-length/2+i*length/count,end=-length/2+(i+1)*length/count;
      const a={x:c.x+(alongX?start:0),z:c.z+(alongX?0:start)},b={x:c.x+(alongX?end:0),z:c.z+(alongX?0:end)};
      const ay=campusHeight(a),by=campusHeight(b);
      cylinder(campusContext,fenceMaterial,a.x,ay+.85,a.z,.055,1.7);
      if(i===count-1)cylinder(campusContext,fenceMaterial,b.x,by+.85,b.z,.055,1.7);
      for(const h of [.22,.85,1.5])rail(campusContext,new THREE.Vector3(a.x,ay+h,a.z),new THREE.Vector3(b.x,by+h,b.z));
      for(let j=1;j<9;j++) {
        const t=j/9,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=ay+(by-ay)*t;
        box(campusContext,fenceMaterial,x,y+.85,z,.025,1.35,.025);
      }
    }
  }
  // North/east public roads stay outside the school fence; the gate is the crossing.
  box(campusContext,roadMaterial,53,-.08,30,8,.12,141);
  box(campusContext,roadMaterial,-20.25,-.08,-42.5,56.5,.12,8);
  box(campusContext,roadMaterial,28.5,-.08,-40.5,49,.12,8);
  for(let z=-33;z<101;z+=6)box(campusContext,palette.cream,53,.001,z,.1,.015,2.5);
  for(let x=-43;x<50;x+=6)box(campusContext,palette.cream,x,.001,x<4?-42.5:-40.5,2.5,.015,.1);
  box(campusContext,facade.road,(gateApproach.minX+gateApproach.maxX)/2,-.015,25,gateApproach.maxX-gateApproach.minX,.05,gateApproach.maxZ-gateApproach.minZ);
  box(campusContext,facade.road,43,-.025,-1,8,.12,32,true);
  const gardenCenter=center(outdoorGarden);
  box(parkingContext,facade.road,gardenCenter.x,-.025,gardenCenter.z,5,.12,4.7,true);
  for(let row=0;row<3;row++) {
    const z=outdoorGarden.minZ+.8+row*1.5;
    box(parkingContext,palette.wood,gardenCenter.x,.17,z,4,.32,1.05,true);
    box(parkingContext,palette.soil,gardenCenter.x,.34,z,3.8,.04,.87);
    for(let i=0;i<4;i++)plant(parkingContext,outdoorGarden.minX+1+i,.36,z,.45);
  }
  sign(parkingContext,'텃밭',gardenCenter.x,1.3,outdoorGarden.maxZ,2.2);
  const campusEast=campusPlaces.find(place=>place.name==='동편출입구')!.rect;
  sign(campusContext,'동편출입구',(campusEast.minX+campusEast.maxX)/2,3.35,campusEast.maxZ+.35,3);
  sign(campusContext,'서쪽현관',campusEntrancePoint('west-entrance').x,2.9,20.6,2.8);
  for(const planter of frontPlanters) {
    const x=center(planter).x;
    box(campusContext,palette.stone,x,.22,21.4,2.5,.44,1.3,true);
    plant(campusContext,x,.45,21.4,1.25);
    box(campusContext,palette.white,x,.015,26.8,.045,.018,3.7);
  }
  for(const x of [-30,-17,17,30])plant(campusContext,x,.015,31.3,2.1);
  for(const floor of [2,3,4,5]) {
    const group=new THREE.Group();group.name=`walkable-floor-${floor}`;group.position.y=(floor-1)*floorRise;group.visible=false;scene.add(group);upperViews.set(floor,group);
    const rooms=upperRooms.filter(r=>r.floor===floor);
    let corridorRects=upperCorridors[floor];
    for(const hole of stairGroundObstacles)corridorRects=corridorRects.flatMap(r=>{
      const a=Math.max(r.minX,hole.minX),b=Math.min(r.maxX,hole.maxX),c=Math.max(r.minZ,hole.minZ),d=Math.min(r.maxZ,hole.maxZ);
      if(a>=b||c>=d)return [r];
      return [{...r,maxX:a},{...r,minX:b},{minX:a,maxX:b,minZ:r.minZ,maxZ:c},{minX:a,maxX:b,minZ:d,maxZ:r.maxZ}].filter(r=>r.maxX>r.minX&&r.maxZ>r.minZ);
    });
    for(const rect of corridorRects) {
      const c=center(rect);box(group,palette.corridor,c.x,-.10,c.z,rect.maxX-rect.minX,.20,rect.maxZ-rect.minZ);
      for(let x=Math.ceil(rect.minX);x<rect.maxX;x++)box(group,hall.trim,x,.003,c.z,.012,.006,rect.maxZ-rect.minZ);
      for(let z=Math.ceil(rect.minZ);z<rect.maxZ;z++)box(group,hall.trim,c.x,.003,z,rect.maxX-rect.minX,.006,.012);
    }
    // The court-facing edge is a window wall; the court stays at its ground-floor elevation.
    const windows=new THREE.Group();windows.name=`court-windows-${floor}`;group.add(windows);
    const central=stairs.find(s=>s.id==='stairs-central')!.rect;
    const south=upperCorridors[floor][0],lobby=upperCorridors[floor][1],westHall=upperCorridors[floor][6];
    const parkingStrip=upperCorridors[floor][8],parkingCorner=upperCorridors[floor][5];
    const north=planRect(6,31.6,36,0);
    // Follow the building faces around the open court, including the central stair's stepped outline.
    const edges:[number,number,number,number,boolean][]=[
      [westHall.maxX,south.minZ,lobby.minX,south.minZ,true],
      [westHall.maxX,westHall.minZ,westHall.maxX,south.minZ,true],
      [lobby.minX,south.minZ,lobby.minX,lobby.minZ,true],
      [lobby.minX,lobby.minZ,central.minX,lobby.minZ,true],
      [central.minX,lobby.minZ,central.minX,central.minZ,true],
      [central.minX,central.minZ,central.maxX,central.minZ,true],
      [central.maxX,central.minZ,central.maxX,north.maxZ,true],
      [north.minX,north.maxZ,central.maxX,north.maxZ,false],
      // Windows over the open parking courtyard in front of the east classrooms (1-1, 1-2 on 3F).
      [parkingStrip.minX,parkingStrip.minZ,parkingStrip.maxX,parkingStrip.minZ,true],
      [parkingCorner.minX,parkingCorner.minZ,parkingCorner.minX,parkingStrip.minZ,true],
    ];
    for(const [ax,az,bx,bz,solid] of edges) {
      const edge=new THREE.Group();edge.position.set(ax,0,az);edge.rotation.y=-Math.atan2(bz-az,bx-ax);windows.add(edge);
      const length=Math.hypot(bx-ax,bz-az),bays=Math.ceil(length/1.5),bayWidth=length/bays;
      if(solid) {
        box(edge,wallFinish.body,length/2,.39,0,length,.78,.16);
        box(edge,wallFinish.base,length/2,.10,0,length,.20,.18);
      }
      box(edge,palette.lightWood,length/2,.84,0,length,.08,.24);
      for(let i=0;i<bays;i++) {
        const x=(i+.5)*bayWidth;
        box(edge,roomGlass,x,1.76,0,bayWidth-.06,1.76,.035);
        box(edge,hall.metal,i*bayWidth,1.77,0,.055,1.82,.08);
        box(edge,hall.metal,x,1.68,0,bayWidth,.035,.08);
      }
      box(edge,hall.metal,length,1.77,0,.055,1.82,.08);
      box(edge,hall.metal,length/2,2.68,0,length,.06,.10);
    }
    for(const room of rooms) {
      const roomGroup=room.style==='gym'?upperGym:group;
      const r=room.rect,c=center(r);box(roomGroup,room.style==='gym'?palette.lightWood:palette.floor,c.x,-.08,c.z,r.maxX-r.minX,.16,r.maxZ-r.minZ);
      for(const wall of upperRoomWalls(room)) {
        const c=center(wall);box(roomGroup,wallFinish.body,c.x,.40,c.z,wall.maxX-wall.minX,.8,wall.maxZ-wall.minZ);
        box(roomGroup,wallFinish.base,c.x,.13,c.z,wall.maxX-wall.minX+.01,.20,wall.maxZ-wall.minZ+.01);
      }
      const frame=new THREE.Group(),pivot=new THREE.Group();
      frame.position.set(room.axis==='x'?room.door.x:room.door.x-.9,0,room.axis==='x'?room.door.z-.9:room.door.z);
      if(room.axis==='x')frame.rotation.y=-Math.PI/2;
      const leaf=asset('door');pivot.add(leaf);frame.add(pivot);roomGroup.add(frame);
      leaf.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.placeId=room.id;pickDoors.push(o);}});
      doors.set(room.id,{pivot,target:0,angle:0});
      for(const offset of [-.94,.94])box(roomGroup,palette.lightWood,room.door.x+(room.axis==='z'?offset:0),1.12,room.door.z+(room.axis==='x'?offset:0),.1,2.24,.1);
      sign(roomGroup,room.name,room.door.x,2.5,room.door.z,Math.min(3.8,Math.max(2.2,room.name.length*.28)),room.axis==='x'?new THREE.Euler(0,Math.PI/2,0):new THREE.Euler());
      if((room.style==='classroom'||room.style==='lab')&&!customRooms.has(room.id))box(roomGroup,palette.darkMint,c.x,1.25,r.maxZ-.12,Math.min(3.6,r.maxX-r.minX-1),1.1,.08);
      if(room.style==='gym') {
        for(const z of [r.minZ+2,r.maxZ-2])box(roomGroup,palette.white,c.x,.015,z,r.maxX-r.minX-5,.02,.06);
        for(const x of [r.minX+2.5,r.maxX-2.5])box(roomGroup,palette.white,x,.015,c.z,.06,.02,r.maxZ-r.minZ-4);
        box(roomGroup,palette.white,c.x,.015,c.z,.06,.02,r.maxZ-r.minZ-4);
        staticGeometry(roomGroup,new THREE.TorusGeometry(1.8,.035,6,40),palette.white,c.x,.025,c.z,new THREE.Euler(-Math.PI/2,0,0));
        for(const x of [r.minX+3,r.maxX-3]){cylinder(roomGroup,hall.metal,x,1.4,c.z,.06,2.8);box(roomGroup,palette.white,x,2.9,c.z,.10,.9,1.5);}
      }
    }
    for(const resident of upperResidents.filter(p=>p.floor===floor)) {
      const model=asset(resident.model);model.position.set(resident.x,0,resident.z);model.rotation.y=resident.rotation;staticModel(group,model);
    }
    for(const f of [...upperFurniture.filter(f=>f.floor===floor&&f.model),...upperDecor.filter(f=>f.floor===floor)])placePiece(group,floor,f.model!,f.x!,f.y??0,f.z!,f.rotation??0);
    for(const f of upperFurniture.filter(f=>f.floor===floor&&!f.model)) {
      const r=f.rect,c=center(r),w=r.maxX-r.minX,d=r.maxZ-r.minZ;
      if(f.kind==='sink'||f.kind==='toilet'){const model=asset(f.kind==='sink'?'restroom-sink':'restroom-toilet');model.position.set(c.x,0,c.z);staticModel(group,model);continue;}
      const h=f.kind==='bench'?.42:.74;
      box(group,palette.lightWood,c.x,h,c.z,w,.06,d,true);
      for(const x of [r.minX+.06,r.maxX-.06])for(const z of [r.minZ+.06,r.maxZ-.06])box(group,hall.metal,x,h/2,z,.035,h,.035);
      if(f.kind==='bench')box(group,palette.mint,c.x,.66,r.maxZ-.02,w,.42,.05,true);
    }
  }
  for(const [group,materials] of batches)for(const [mat,geometries] of materials) {
    const merged=mergeGeometries(geometries);
    if(merged) {const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
    geometries.forEach(geometry=>geometry.dispose());
  }

  const classroomProps=createClassroomProps(upperProps,asset,floor=>upperViews.get(floor)!);
  const character=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}school-player-meshy.glb`);
  const player=new THREE.Group();player.name='school-tour-player';player.position.set(campusSpawn.x,.08,campusSpawn.z);scene.add(player);
  character.scene.traverse(object=>{if(object instanceof THREE.Mesh){
    object.castShadow=true;object.receiveShadow=true;
    const mat=object.material as THREE.MeshStandardMaterial;
    // This densely packed atlas has no gutters: mip levels mix skin/ivory into hair.
    if(mat.map){mat.map.minFilter=THREE.LinearFilter;mat.map.generateMipmaps=false;mat.map.needsUpdate=true;}
  }});
  const characterBounds=new THREE.Box3().setFromObject(character.scene),characterHeight=characterBounds.max.y-characterBounds.min.y;
  character.scene.scale.setScalar(schoolPlayerHeight/Math.max(.01,characterHeight));player.add(character.scene);
  const animatePlayer=createPlayerMotion(character.scene,character.animations);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const shadowContext=shadowCanvas.getContext('2d')!,gradient=shadowContext.createRadialGradient(32,32,1,32,32,31);
  gradient.addColorStop(0,'rgba(54,67,42,.36)');gradient.addColorStop(.5,'rgba(54,67,42,.17)');gradient.addColorStop(1,'rgba(54,67,42,0)');
  shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,64,64);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.04,.78),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,toneMapped:false}));
  contact.rotation.x=-Math.PI/2;scene.add(contact);
  const routeMaterial=new THREE.MeshBasicMaterial({color:0xa26d33,transparent:true,opacity:.82,depthWrite:false});
  const routeDots=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.12,.018,10),routeMaterial,180);routeDots.count=0;routeDots.frustumCulled=false;scene.add(routeDots);
  const routeEnd=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,6,28),new THREE.MeshBasicMaterial({color:0xa26d33,transparent:true,opacity:.9}));routeEnd.rotation.x=-Math.PI/2;routeEnd.visible=false;scene.add(routeEnd);
  let mode:TourMode='campus',overview=true;
  let currentSpan=158;
  // Phones held sideways see more of the school around the visitor (0.6x magnification).
  let followSpan=20,focus=1;
  const target=new THREE.Vector3(4,5,38),desiredTarget=new THREE.Vector3(),desiredPosition=new THREE.Vector3();
  const followOffset=new THREE.Vector3(9.5,13,18),overviewOffset=new THREE.Vector3(26,58,76);
  camera.position.copy(target).add(overviewOffset);camera.lookAt(target);
  const size=()=>host.getBoundingClientRect();
  function updateFrustum() {
    const rect=size(),aspect=Math.max(1,rect.width)/Math.max(1,rect.height);
    const height=overview?currentSpan/Math.min(aspect,1.55):currentSpan/Math.max(1,aspect);
    camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  }
  const resize=()=>{const rect=size();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height));updateFrustum();};
  new ResizeObserver(resize).observe(host);resize();
  function setMode(next:TourMode) {mode=next;indoor.visible=mode==='floor1';building.visible=mode==='campus';campusContext.visible=mode==='campus';}
  function setOverview(on:boolean) {if(overview!==on)camera.zoom=1;overview=on;updateFrustum();}
  function zoomBy(factor:number) {
    camera.zoom=Math.max(.45,Math.min(2.6,camera.zoom*factor));
    camera.updateProjectionMatrix();
  }
  renderer.domElement.addEventListener('wheel',event=>{
    if(event.ctrlKey)return;
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?size().height:1);
    zoomBy(Math.exp(-delta*.0015));
  },{passive:false});
  function openDoor(id:string,open:boolean) {const door=doors.get(id);if(door)door.target=open?(id==='shop'?Math.PI/2:-Math.PI/2):0;}
  function setRoute(points:Point[]) {
    const dots:Point[]=[];let remaining=0;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1]!,b=points[i]!,length=Math.hypot(b.x-a.x,b.z-a.z);
      if(!Number.isFinite(length)||length===0)continue;
      for(let distance=remaining;distance<length;distance+=.55)dots.push({x:a.x+(b.x-a.x)*distance/length,z:a.z+(b.z-a.z)*distance/length});
      remaining=(remaining-length)% .55;if(remaining<0)remaining+=.55;
    }
    const stride=Math.max(1,Math.ceil(dots.length/180)),matrix=new THREE.Matrix4();let count=0;
    const floor=walkingFloor(player.position.y),height=(floor-1)*floorRise;
    for(let i=0;i<dots.length;i+=stride){const point=dots[i]!;matrix.makeTranslation(point.x,(mode==='floor1'?(floor>1?height:groundHeight(point)):campusHeight(point))+.105,point.z);routeDots.setMatrixAt(count++,matrix);}
    routeDots.count=count;routeDots.instanceMatrix.needsUpdate=true;
    const end=points.at(-1);routeEnd.visible=!!end&&Number.isFinite(end.x)&&Number.isFinite(end.z);
    if(routeEnd.visible&&end)routeEnd.position.set(end.x,(mode==='floor1'?(floor>1?height:groundHeight(end)):campusHeight(end))+.13,end.z);
  }
  const parkingView={minX:upperCorridors[2]![8]!.minX,maxX:upperCorridors[2]![8]!.maxX,z:upperCorridors[2]![8]!.minZ};
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
  function pick(x:number,y:number):{point?:Point;placeId?:string;propId?:string} {
    const rect=size();if(rect.width<=0||rect.height<=0)return {};
    pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    floorPlane.constant=-(player.position.y+.08);
    const hit=new THREE.Vector3();if(!raycaster.ray.intersectPlane(floorPlane,hit))return {};
    const point={x:hit.x,z:hit.z};
    const activePlaces=mode==='floor1'&&walkingFloor(player.position.y)>1?upperRooms.filter(r=>r.floor===walkingFloor(player.position.y)):places;
    if(mode==='floor1'&&onFloorLevel(player.position.y)) {
      const propHit=raycaster.intersectObjects(classroomProps.pickables(walkingFloor(player.position.y)),true)[0];
      if(propHit)return {point,propId:propHit.object.userData.propId as string};
    }
    if(onFloorLevel(player.position.y)) {
      const doorHit=raycaster.intersectObjects(pickDoors,true).find(hit=>activePlaces.some(place=>place.id===hit.object.userData.placeId));
      if(doorHit) {
        const id=doorHit.object.userData.placeId as string,place=activePlaces.find(place=>place.id===id);
        if(place&&Math.hypot(player.position.x-place.door.x,player.position.z-place.door.z)<2.8)return {point,placeId:id};
      }
    }
    const place=activePlaces.find(place=>inside(point,place.rect));
    // An open room's floor remains a walking target instead of closing its door.
    if(place?.enterable&&doors.get(place.id)?.target===0)return {point,placeId:place.id};
    if(mode==='campus')for(const id of ['entrance','east-passage','west-entrance'])if(Math.hypot(point.x-campusEntrancePoint(id).x,point.z-campusEntrancePoint(id).z)<1.5)return {point,placeId:id};
    return {point};
  }
  function project(point:Point,height=0) {
    const position=new THREE.Vector3(point.x,height,point.z).project(camera),rect=size();
    return {x:(position.x+1)*rect.width/2,y:(1-position.y)*rect.height/2,visible:Number.isFinite(position.x)&&position.z>=-1&&position.z<=1&&Math.abs(position.x)<1&&Math.abs(position.y)<1};
  }
  function tick(dt:number,time:number,moving:boolean) {
    dt=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.05):0;
    animatePlayer(dt,moving,{seat:seatHeight,...activityPose});
    for(const view of stairViews) {
      const base=(view.floor-1)*floorRise,stair=stairs.find(s=>s.id===view.stairId)!;
      view.group.visible=player.position.y>=base-.15&&player.position.y<(base+floorRise+(view.arrival?-.15:.15))&&(player.position.y<.2||Math.hypot(player.position.x-stair.rect.minX,player.position.z-stair.rect.minZ)<12);
    }
    const parkingCutaway=mode==='campus'&&!overview&&showCampusCutaway(player.position);
    const activeFloor=Math.max(1,Math.min(5,Math.floor((player.position.y+.15)/floorRise)+1));
    indoor.visible=mode==='floor1'&&activeFloor===1||parkingCutaway;building.visible=mode==='campus'&&!parkingCutaway;
    courtyardView.visible=mode==='floor1'||parkingCutaway;
    stairRoot.visible=mode==='floor1'||parkingCutaway;
    for(const [floor,view] of upperViews)view.visible=mode==='floor1'&&floor===activeFloor;
    upperGym.visible=mode==='floor1'&&activeFloor>=4;
    contact.position.set(player.position.x,player.position.y+.035,player.position.z);
    classroomProps.tick(dt,player);
    effects.tick(dt);
    if(cue.visible){cueClock+=dt;arrow.position.y=rim.position.y=Math.sin(cueClock*4)*.08;cue.rotation.y+=dt*1.8;}
    for(const door of doors.values()) {
      door.angle=THREE.MathUtils.damp(door.angle,door.target,door.slide?7:12,dt);
      // Sliding leaves part sideways along the wall instead of swinging.
      if(door.slide){const open=Math.abs(door.angle)/(Math.PI/2);door.slide.forEach((leaf,i)=>{leaf.position.x=doorWidth/2+(i?1:-1)*open*(doorWidth/2-.04);});continue;}
      door.pivot.rotation.y=door.angle;if(door.second)door.second.rotation.y=-door.angle;
    }
    if(overview)desiredTarget.set(mode==='campus'?4:0,mode==='campus'?5:(activeFloor-1)*floorRise,mode==='campus'?25:(schoolBounds.minZ+schoolBounds.maxZ)/2);
    else desiredTarget.set(player.position.x,player.position.y+1,player.position.z-.5);
    desiredPosition.copy(desiredTarget).add(overview?overviewOffset:followOffset);
    if(!overview&&mode==='floor1'&&activeFloor>1) {
      const distance=Math.hypot(Math.max(courtRect.minX-player.position.x,0,player.position.x-courtAccess.maxX),player.position.z-courtRect.maxZ);
      // The parking courtyard lies north of the strip in front of the east classrooms.
      const parkingDistance=Math.hypot(Math.max(parkingView.minX-player.position.x,0,player.position.x-parkingView.maxX),player.position.z-parkingView.z);
      // Raise the viewing angle near the windows so the upper slab does not hide the court or parking below.
      desiredPosition.y+=Math.max(0,1-Math.min(distance,parkingDistance)/6)*(6+player.position.y*2.5);
    }
    const blend=1-Math.exp(-dt*5.5);target.lerp(desiredTarget,blend);camera.position.lerp(desiredPosition,blend);
    currentSpan=THREE.MathUtils.lerp(currentSpan,overview?(mode==='campus'?158:activeFloor>1?110:90):followSpan/focus,blend);camera.lookAt(target);updateFrustum();
    const viewDirection=camera.getWorldDirection(new THREE.Vector3()).negate();
    for(const wall of occludingWalls) {
      const hidden=!overview&&indoor.visible&&[.45,1,1.5].some(h=>{
        const ray=new THREE.Ray(player.position.clone().add(new THREE.Vector3(0,h,0)),viewDirection);
        return ray.intersectsBox(wall.bounds);
      });
      wall.material.opacity=THREE.MathUtils.damp(wall.material.opacity,hidden?.12:1,14,dt);
      wall.material.depthWrite=wall.material.opacity>.98;
      wall.mesh.castShadow=wall.material.opacity>.98;
    }
    if(routeEnd.visible)routeEnd.scale.setScalar(1+Math.sin(Number.isFinite(time)?time*3:0)*.06);
    renderer.render(scene,camera);
  }
  setMode('campus');
  const effects=createEffects(scene);
  // A bobbing orange marker above whatever the action button would use; drawn over walls so it is never lost.
  const cue=new THREE.Group();cue.visible=false;cue.renderOrder=10;scene.add(cue);
  const cueMaterial=new THREE.MeshBasicMaterial({color:0xff7a2f,depthTest:false,transparent:true});
  const cueEdge=new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true});
  const arrow=new THREE.Mesh(new THREE.ConeGeometry(.16,.3,4),cueMaterial);arrow.rotation.x=Math.PI;arrow.renderOrder=11;
  const rim=new THREE.Mesh(new THREE.ConeGeometry(.2,.37,4),cueEdge);rim.rotation.x=Math.PI;rim.position.y=.02;rim.renderOrder=10;
  cue.add(rim,arrow);
  let cueClock=0;
  /** The current view as a 2D canvas, rendered now so the WebGL buffer is still intact. */
  function capture() {
    renderer.render(scene,camera);
    const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
    canvas.getContext('2d')!.drawImage(renderer.domElement,0,0);return canvas;
  }
  /** Shows the cue above a point (world height included), or hides it. */
  function setCue(at:{x:number;y:number;z:number}|undefined) {
    cue.visible=!!at&&!overview;if(at)cue.position.set(at.x,at.y,at.z);
  }
  return {effects,hoops,setCue,courtFloor:-courtDrop,capture,setFocus:(value:number)=>{focus=value;},setActiveProp:classroomProps.setActive,propStage:classroomProps.stage,renderer,scene,camera,player,setMode,setOverview,zoomBy,openDoor,setRoute,pick,project,tick,useProp:classroomProps.use,seats,setActivityPose:(pose:{activity?:PlayerActivity;lift?:number})=>{activityPose=pose;},setFollowScale:(magnification:number)=>{followSpan=20/magnification;},setSeated:(height:number|undefined)=>{seatHeight=height;}};
}
export type School=Awaited<ReturnType<typeof createSchool>>;
