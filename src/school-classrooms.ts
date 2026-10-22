import type {Point,Rect} from './school-layout.ts';

// Footprints (x width, z depth in metres) of the prototypes in public/school-classrooms.glb.
// assets/build_school_classrooms.py centres every prototype on its footprint, facing +Z.
export const classroomModels={
  'lab-set-orange':[2.42,1.86],'lab-set-grey':[2.42,1.86],'lab-set-maroon':[2.42,1.86],'teacher-desk':[1.62,.72],
  'board-electronic':[5.32,.34],'board-green':[4.12,.34],'glass-cabinet':[1.22,.48],'printer-cabinet':[1.3,.683],
  'incubator-counter':[2.02,.72],'germ-incubator-a':[.56,.56],'germ-incubator-b':[.46,.56],'clean-bench':[1.31,.756],
  'microscope-cabinet':[.8,.604],'incubator':[.55,.55],'side-counter':[2.42,.64],'sink-counter':[2.42,.64],
  'sink-counter-brown':[2.42,.64],'cubby-shelf':[1.6,.4],'basket-shelf':[1.61,.45],'fume-hood':[1.5,.845],
  'seminar-set':[1.52,1],'conference-set':[2.42,2.08],'wall-desk':[2.42,1.17],'whiteboard-stand':[1.3,.55],
  'bookcase':[1.01,.35],'display-stand':[1.66,.55],'lectern':[.66,.515],'gym-mat':[7.6,8.6],'power-rack':[1.7,1.35],
  'treadmill':[.8,1.885],'weight-bench':[.56,1.3],'dumbbell-rack':[1.46,.55],'cable-machine':[1.2,1],
  'computer-set':[1.52,1.19],'hex-table-set':[2.12,2.12],'storage-wall':[2.4,.522],'art-set':[1.82,1.84],
  'open-shelf':[2,.4],'easel':[.656,.577],'student-set':[.67,.88],'lounge-set':[1.82,1.1],'wall-bench-blue':[3,.5],
  'stage':[3.6,1.9],'welcome-banner':[4.417,.432],'balloon-arch':[3.54,.473],'balloon-cluster':[.697,.692],
  'balloon-column':[.483,.494],'arcade-balloon':[.83,.7],'arcade-quiz':[.83,.7],'oval-table-set':[1.6,1.72],
  'carrel-row':[2.46,1.05],'curved-sofa':[2.574,1.12],'round-table-stools':[1.47,.6],'window-bench-green':[3,.455],
  'booth':[1.92,.72],'window-desk':[1.22,1],'germ':[.624,.528],'staff-desk':[1.42,1.27],'office-cabinet':[.92,.48],
  'locker-wall':[2.4,.473],'board-projector':[5.32,.34],'stage-wide':[7.9,2.415],
  'library-stack':[2.424,.56],'low-book-shelf':[1.81,.38],'wood-bookcase':[1.815,.36],'library-table-set':[2.5,2.04],
  'circulation-desk':[2.46,.76],'lounge-chair-green':[.7,.68],'book-cart':[.88,.42],'folding-glass-door':[.08,.88],
  'broadcast-console':[1.8,1.21],'server-rack':[.6,1.013],'infirmary-bed':[.95,1.955],'sofa-set':[1.78,1.605],'workbench':[1.8,.7],
  'storage-rack':[1.8,.5],'upright-piano':[1.5,1.095],'theater-row':[3.015,.58],'bleacher':[3,1.6],'drink-fridge':[.7,.665],
  'parked-car':[1.94,3.946],
} as const satisfies Record<string,readonly [number,number]>;
export type ClassroomModel=keyof typeof classroomModels;

/** rotation is the model's yaw: 0 faces +Z, π/2 faces +X, π faces −Z, −π/2 faces −X. */
export type ClassroomPiece={model:ClassroomModel;x:number;z:number;rotation:number;y?:number;solid:boolean};
export type PropAction='cabinet'|'germ'|'game'|'info'|'exercise'|'microscope'|'photo';
export type Exercise='run'|'squat'|'curl';
/**
 * `reach` overrides how far in front of the prop a visitor stands (the photo spot sits past the stage);
 * `exercise` props put the visitor onto the machine while the action runs.
 */
export type ClassroomProp={id:string;model:ClassroomModel;name:string;action:PropAction;description:string;x:number;z:number;rotation:number;y?:number;game?:'balloon'|'quiz';exercise?:Exercise;reach?:number;solid:boolean};
export type ClassroomLayout={pieces:ClassroomPiece[];props:ClassroomProp[]};

export function pieceRect(piece:{model:ClassroomModel;x:number;z:number;rotation:number}):Rect {
  const [w,d]=classroomModels[piece.model],c=Math.abs(Math.cos(piece.rotation)),s=Math.abs(Math.sin(piece.rotation));
  const hw=(w*c+d*s)/2,hd=(w*s+d*c)/2;
  return {minX:piece.x-hw,maxX:piece.x+hw,minZ:piece.z-hd,maxZ:piece.z+hd};
}
/** The standing spot in front of an interactive prop. */
export function propSpot(prop:ClassroomProp):Point {
  const [,d]=classroomModels[prop.model],reach=prop.reach??d/2+.75;
  return {x:prop.x+Math.sin(prop.rotation)*reach,z:prop.z+Math.cos(prop.rotation)*reach};
}
// Where the visitor stands on each machine, in the model's own frame (+Z is its front), and which way they face.
const stances:Record<Exercise,{along:number;lift:number;turn:number}>={
  // On the belt facing the console at the back.
  run:{along:.12,lift:.215,turn:Math.PI},
  // On the platform just in front of the bar pivot, facing out of the rack.
  squat:{along:.53,lift:.05,turn:0},
  // In front of the rack, turned away from it towards the room.
  curl:{along:1.05,lift:0,turn:0},
};
/** World position, facing and floor lift of a visitor using an exercise machine. */
export function exerciseStance(prop:ClassroomProp&{exercise:Exercise}) {
  const {along,lift,turn}=stances[prop.exercise];
  return {x:prop.x+Math.sin(prop.rotation)*along,z:prop.z+Math.cos(prop.rotation)*along,yaw:prop.rotation+turn,lift};
}

export type Side='n'|'s'|'w'|'e';
const facing:Record<Side,number>={n:0,s:Math.PI,w:Math.PI/2,e:-Math.PI/2};
const gap=.1;

function planner(rect:Rect) {
  const pieces:ClassroomPiece[]=[],props:ClassroomProp[]=[];
  const at=(u:number,v:number)=>({x:rect.minX+u,z:rect.minZ+v});
  /** Free-standing piece at room-local (u, v). */
  const put=(model:ClassroomModel,u:number,v:number,rotation=0,options:{y?:number;solid?:boolean}={})=>{
    const piece={model,...at(u,v),rotation,y:options.y,solid:options.solid??true};pieces.push(piece);return piece;
  };
  /** Piece backed against a wall; `along` runs from the room's min corner. */
  const wall=(model:ClassroomModel,side:Side,along:number,options:{y?:number;solid?:boolean}={})=>{
    const [,d]=classroomModels[model],inset=gap+d/2;
    const u=side==='w'?inset:side==='e'?rect.maxX-rect.minX-inset:along;
    const v=side==='n'?inset:side==='s'?rect.maxZ-rect.minZ-inset:along;
    return put(model,u,v,facing[side],options);
  };
  const prop=(spec:Omit<ClassroomProp,'x'|'z'|'rotation'|'solid'>&{side:Side;along:number;offset?:number;solid?:boolean})=>{
    const [,d]=classroomModels[spec.model],inset=gap+(spec.offset??d/2);
    const u=spec.side==='w'?inset:spec.side==='e'?rect.maxX-rect.minX-inset:spec.along;
    const v=spec.side==='n'?inset:spec.side==='s'?rect.maxZ-rect.minZ-inset:spec.along;
    const {side,along,offset,...rest}=spec;
    const entry={...rest,...at(u,v),rotation:facing[side],solid:spec.solid??true};props.push(entry);return entry;
  };
  /** Interactive prop standing free at room-local (u, v). */
  const propAt=(spec:Omit<ClassroomProp,'x'|'z'|'rotation'|'solid'>&{solid?:boolean},u:number,v:number,rotation=0)=>{
    const entry={...spec,...at(u,v),rotation,solid:spec.solid??true};props.push(entry);return entry;
  };
  return {pieces,props,put,wall,prop,propAt};
}

const grid=(us:number[],vs:number[])=>vs.flatMap(v=>us.map(u=>[u,v] as const));
const staffDepth=classroomModels['staff-desk'][1],staffWidth=classroomModels['staff-desk'][0];

/** Homerooms copy 인문학교실: navy desks facing a board at the door end (west), lockers at the back. */
function homeroom(room:ReturnType<typeof planner>) {
  room.wall('board-green','w',3.75);
  room.put('lectern',1,3.75,Math.PI/2);
  for(const [u,v] of grid([2.6,3.8,5,6.2,7.4],[1.9,2.8,3.7,4.6,5.5,6.4]))room.put('student-set',u,v,Math.PI/2);
  room.wall('locker-wall','e',3.75);
}
/** Teachers' desks face each other in back-to-back pairs; `v` is the south desk of the pair. */
function staffPods(room:ReturnType<typeof planner>,u0:number,columns:number,v:number) {
  for(let i=0;i<columns;i++) {
    room.put('staff-desk',u0+i*staffWidth,v);
    room.put('staff-desk',u0+i*staffWidth,v-staffDepth,Math.PI);
  }
}
function staffRoom(room:ReturnType<typeof planner>,rect:Rect) {
  const width=rect.maxX-rect.minX,depth=rect.maxZ-rect.minZ;
  const cabinets=(side:Side,from:number,count:number)=>{for(let i=0;i<count;i++)room.wall('office-cabinet',side,from+i*classroomModels['office-cabinet'][0]);};
  if(width>15) {
    // The vice principal stands at the west end of the main staff room.
    staffPods(room,4.6,3,4.6);staffPods(room,10.6,3,4.6);
    room.put('conference-set',16.2,4.2);
    cabinets('s',1,10);
  } else if(depth>8) {
    staffPods(room,1.55,2,3);staffPods(room,1.55,2,5.6);
    cabinets('n',.96,4);
  } else if(depth>7) {
    staffPods(room,2.1,3,4.6);
    room.put('conference-set',7.4,4);
    cabinets('s',1,5);
  } else {
    staffPods(room,1.6,1,2.9);
    cabinets('n',.6,2);
  }
}

/** 4.5 m counselling offices: one teacher desk and a sofa for the visitor. */
function counselRoom(room:ReturnType<typeof planner>) {
  room.put('staff-desk',1.2,1.25);
  room.put('sofa-set',3.25,1.4);
  room.wall('bookcase','w',3.4);
}
/** Multipurpose rooms: folding tables facing a west-wall board, like the seminar room. */
function multipurposeRoom(room:ReturnType<typeof planner>) {
  room.wall('board-green','w',3.75);
  for(const [u,v] of grid([2.6,4.4,6.2,8],[1.9,3.75,5.6]))room.put('seminar-set',u,v,Math.PI/2);
}
/** Self-study halls reuse the 청학스터디존 carrels; the door corner stays clear. */
function studyHall(room:ReturnType<typeof planner>) {
  for(const u of [1.33,3.84]){room.wall('carrel-row','n',u);for(const v of [2.3,3.95,5.6,7.25])room.put('carrel-row',u,v);}
  for(const v of [3.95,5.6,7.25])room.put('carrel-row',6.35,v);
}
/** Storerooms get steel racks along the side walls; science prep rooms add a counter and glass cabinets. */
function storeRoom(room:ReturnType<typeof planner>,rect:Rect,doorSide:Side,prep:boolean) {
  if(rect.maxX-rect.minX>6){for(const [u,v] of grid([1.4,3.3],[2.6,4.6,6.6]))room.put('storage-rack',u,v);return;}
  const side=doorSide==='w'?'e':'w',other=side==='w'?'e':'w';
  for(const v of [1.2,3.1,5])room.wall('storage-rack',side,v);
  if(prep) {
    room.wall('side-counter',other,3.6);
    for(const u of [1.6,2.9])room.wall('glass-cabinet',doorSide==='s'?'n':'s',u);
  } else if(doorSide==='n'||doorSide==='s')for(const v of [1.2,3.1,5])room.wall('storage-rack',other,v);
}

/** Representative furniture per room: from the walk-through videos where they exist, else by room use. */
export function classroomLayout(floor:number,name:string,rect:Rect,id:string,doorSide:Side='n'):ClassroomLayout|null {
  const room=planner(rect),{put,wall,prop,propAt}=room;
  const key=`${floor}:${name}`;
  if(/^\d-\d$/.test(name))homeroom(room);
  else if(/교무실$/.test(name))staffRoom(room,rect);
  else if(key==='2:물리/지학실') {
    // Door at the south-east corner; boards on the west wall, maker corner in the north-east.
    prop({id:`${id}-smart-board`,model:'board-electronic',name:'전자칠판',action:'info',side:'w',along:4.25,
      description:'가운데 검은 화면이 전자칠판이에요. 양옆 초록 칠판과 함께 수업 자료를 띄우고 바로 필기할 수 있어요.'});
    put('teacher-desk',1.3,6.1,Math.PI/2);
    prop({id:`${id}-printer-cabinet`,model:'printer-cabinet',name:'3D 프린터 보관함',action:'cabinet',side:'n',along:11.3,
      description:'파란 유리문 안에 3D 프린터가 들어 있어요.'});
    for(const u of [7.4,9.05])wall('basket-shelf','n',u);
    wall('sink-counter','e',3.4);
    for(const u of [1.6,2.85,4.1,5.35,7.9,9.15,10.4])wall('glass-cabinet','s',u);
    for(const [u,v] of grid([3.4,6.1,8.8],[2.6,5.4]))put('lab-set-orange',u,v);
  } else if(key==='2:생명과학실') {
    // Door at the south-east corner; boards on the east wall, sinks and equipment on the north wall.
    wall('board-electronic','e',4.25);
    put('teacher-desk',12.2,4.4,-Math.PI/2);
    wall('cubby-shelf','n',2.2);
    prop({id:`${id}-clean-bench`,model:'clean-bench',name:'멸균실험대',action:'info',side:'n',along:3.75,
      description:'걸러 낸 깨끗한 공기 속에서 미생물 실험을 하는 작업대예요. 유리창 아래로 손을 넣어 다뤄요.'});
    for(const u of [5.7,8.15])wall('sink-counter','n',u);
    wall('incubator-counter','n',11.2);
    const counterV=gap+classroomModels['incubator-counter'][1]/2;
    for(const [suffix,model,u] of [['a','germ-incubator-a',10.75],['b','germ-incubator-b',11.65]] as const)
      room.props.push({id:`${id}-germ-${suffix}`,model,name:'세균배양기',action:'germ',x:rect.minX+u,z:rect.minZ+counterV,rotation:0,y:.785,solid:false,
        description:'눌러 보면 배양기 안에서 무언가 튀어나와요!'});
    prop({id:`${id}-microscope-cabinet`,model:'microscope-cabinet',name:'현미경함',action:'microscope',side:'w',along:1,
      description:'학생용 광학 현미경을 칸마다 나누어 보관하는 유리 보관장이에요. 한 대 꺼내 들여다볼 수 있어요.'});
    for(const v of [2.65,5.1])wall('side-counter','w',v);
    prop({id:`${id}-incubator`,model:'incubator',name:'인큐베이터',action:'info',side:'w',along:3.2,offset:classroomModels['side-counter'][1]/2,solid:false,
      description:'일정한 온도를 유지하며 미생물이나 세포를 기르는 장비예요.'});
    room.props.at(-1)!.y=.805;
    for(const u of [5.3,7.8])wall('side-counter','s',u);
    for(const [u,v] of grid([3.4,6.1,8.8],[2.95,5.65]))put('lab-set-grey',u,v);
  } else if(key==='2:화학실') {
    // Door at the north-east corner; electronic board on the west wall, sinks and fume hood on the east.
    wall('board-electronic','w',4.25);
    put('teacher-desk',1.3,4.25,Math.PI/2);
    wall('sink-counter-brown','e',3.2);
    wall('fume-hood','e',6.9);
    for(const u of [4.3,6.75])wall('side-counter','n',u);
    for(const u of [4,6.5])wall('side-counter','s',u);
    for(const [u,v] of grid([4.4,8.4],[1.95,4.25,6.55]))put('lab-set-maroon',u,v);
  } else if(key==='2:세미나실') {
    // Door at the north-east corner; students face the east-wall board, PCs along the west wall.
    wall('board-green','e',4.25);
    put('lectern',12.5,7.2,-Math.PI/2);
    for(const v of [2,3.7])wall('computer-set','w',v);
    for(const [u,v] of grid([2.4,4.3,6.2,8.1,10],[2.2,4.25,6.3]))put('seminar-set',u,v,-Math.PI/2);
  } else if(key==='2:온라인학습실') {
    // Door at the north-west corner; whiteboard on the west wall, window counter along the south.
    wall('whiteboard-stand','w',3.75);
    for(const [u,v] of grid([3,5.6],[2.3,4.45]))put('conference-set',u,v);
    for(const u of [2.1,6.9])wall('wall-desk','s',u);
    wall('lectern','s',4.5);
    wall('office-cabinet','e',.76);
    wall('side-counter','e',3.41);
    wall('bookcase','e',5.5);
  } else if(key==='2:체력단련실') {
    // Door at the north end of the east wall; chalkboard on the north wall, machines round the walls.
    put('gym-mat',4.05,4.5,0,{solid:false});
    wall('board-green','n',4.05);
    propAt({id:`${id}-treadmill`,model:'treadmill',name:'러닝머신',action:'exercise',exercise:'run',reach:1.4,
      description:'벨트 위에서 제자리 달리기를 해요.'},1.04,1,Math.PI/2);
    put('treadmill',1.04,2,Math.PI/2);
    propAt({id:`${id}-squat-rack`,model:'power-rack',name:'스쿼트 랙',action:'exercise',exercise:'squat',
      description:'바벨을 메고 앉았다 일어나기를 반복해요.'},3.8,1.22);
    put('cable-machine',5.5,1.1);
    for(const v of [3.4,5.3])wall('cable-machine','w',v);
    wall('power-rack','s',4.6);
    // Free-standing on the east side: by the south windows the frames and the stairwell outside hide the visitor.
    propAt({id:`${id}-dumbbells`,model:'dumbbell-rack',name:'덤벨 랙',action:'exercise',exercise:'curl',
      description:'덤벨을 들고 팔 굽히기를 반복해요.'},6.4,3.4,Math.PI/2);
    for(const [u,v] of [[3.2,4.6],[4.7,5]] as const)put('weight-bench',u,v);
  } else if(key==='3:컴퓨터실') {
    // Door at the south-east corner; projector board on the east wall, students face east.
    wall('board-projector','e',4.25);
    put('teacher-desk',12.1,2.2,-Math.PI/2);
    wall('open-shelf','w',3.8);
    for(const [u,v] of grid([2,3.6,5.2,6.8,8.4,10],[1.6,4.9,6.5]))put('computer-set',u,v,-Math.PI/2);
  } else if(key==='3:스마트AI교실') {
    // Door at the south-east corner; display on the west wall, pastel storage along the east wall.
    wall('display-stand','w',4.25);
    wall('teacher-desk','w',1.6);
    put('lectern',1.6,3,Math.PI/2);
    for(const v of [1.4,3.85,6.3])wall('storage-wall','e',v);
    wall('office-cabinet','n',8.5);
    for(const u of [1.5,2.75])wall('glass-cabinet','s',u);
    for(const [u,v] of grid([4.2,7,9.8],[1.75,4.25,6.75]))put('hex-table-set',u,v);
  } else if(key==='3:미술실') {
    // Door at the north-east corner; screens on the west wall, counters with a sink under the south windows.
    wall('display-stand','w',6.6);
    wall('whiteboard-stand','w',2.5);
    put('side-counter',2,5.2,Math.PI/2);
    for(const u of [1.9,4.35,6.8,9.25])wall('side-counter','s',u);
    wall('sink-counter','s',11.7);
    for(const u of [2.6,4.65,6.7,8.75])wall('open-shelf','n',u);
    for(const v of [2.4,3.35,4.3,5.25])wall('office-cabinet','e',v);
    for(const [u,v] of grid([4.5,7.2,9.9],[3.4,5.9]))put('art-set',u,v);
  } else if(key==='3:창의상상라운지') {
    // Admission-day dressing over the lounge: stage along the north wall, bench along the west windows.
    put('stage-wide',4.05,gap+classroomModels['stage-wide'][1]/2);
    // The welcome banner doubles as the photo zone; visitors pose just in front of the stage.
    const bannerV=gap+classroomModels['welcome-banner'][1]/2;
    propAt({id:`${id}-photo-zone`,model:'welcome-banner',name:'환영 포토존',action:'photo',y:.22,solid:false,
      reach:gap+classroomModels['stage-wide'][1]+.55-bannerV,description:'현수막 앞에서 기념사진을 찍어요.'},4.05,bannerV);
    put('balloon-arch',4.05,2.8,0,{solid:false});
    for(const v of [2.9,5.5])put('balloon-column',7.55,v);
    for(const [u,v] of [[7.55,14.7],[4,14.7],[7.55,9.5]] as const)put('balloon-cluster',u,v);
    for(const v of [4.1,7.15,10.2,13.25])wall('wall-bench-blue','w',v);
    for(const v of [4,5.85,7.7,9.55,11.4,13.25])put('lounge-set',1.3,v,Math.PI/2);
    wall('cubby-shelf','e',6.8);
    prop({id:`${id}-arcade-balloon`,model:'arcade-balloon',name:'풍선 팡팡 게임기',action:'game',game:'balloon',side:'e',along:11,
      description:'20초 동안 떠오르는 풍선을 터뜨려요.'});
    prop({id:`${id}-arcade-quiz`,model:'arcade-quiz',name:'청학 길찾기 OX 게임기',action:'game',game:'quiz',side:'e',along:12,
      description:'교실이 몇 층에 있는지 O·X로 맞혀요.'});
  } else if(key==='3:인문학교실') {
    // Door at the north end of the east wall, right beside the north-wall board; students face north.
    wall('board-green','n',3.4);
    put('lectern',2.8,1.6);
    for(const [u,v] of grid([1.2,1.9,3.7,4.4,6.2,6.9],[3,4.1,5.2,6.3,7.4]))put('student-set',u,v);
  } else if(key==='4:청학스터디존') {
    // Carrel area at the north end, oval tables and a screen in the middle, a raised platform to the south.
    for(const u of [1.33,3.84,6.35]){wall('carrel-row','n',u);for(const v of [2.25,3.85])put('carrel-row',u,v);}
    put('display-stand',3,4.95);
    for(const v of [6,7.3,8.6])wall('window-desk','w',v);
    for(const [u,v] of grid([3.2,5.4],[6.2,8.05]))put('oval-table-set',u,v);
    put('whiteboard-stand',5,10.2,-Math.PI/2);
    put('curved-sofa',2.3,11.6,Math.PI);
    put('curved-sofa',6.6,11.8,Math.PI);
    put('stage-wide',4.05,15.2-gap-classroomModels['stage-wide'][1]/2);
  }
  else if(/진학상담실\d|진로진학상담부/.test(name))counselRoom(room);
  else if(/^다목적실\d$/.test(name))multipurposeRoom(room);
  else if(/^자기주도학습실\d$/.test(name))studyHall(room);
  else if(/물품보관실|교구보관실|비품창고|준비실$/.test(name))storeRoom(room,rect,doorSide,/^준비실$/.test(name)&&floor===2);
  else if(name==='Wee Class') {
    room.put('sofa-set',6.2,3);
    room.put('lounge-chair-green',4.6,3,Math.PI/2);
    room.put('lounge-chair-green',7.8,3,-Math.PI/2);
    room.put('teacher-desk',2.4,6.6,Math.PI);
    room.wall('bookcase','e',6);
  } else if(name==='C.B.S(방송실)') {
    room.wall('broadcast-console','s',5);
    for(const v of [2,2.65])room.wall('server-rack','e',v);
    room.wall('display-stand','w',3.75);
    room.put('round-table-stools',4.5,3.5);
  } else if(name==='시설관리실') {
    room.wall('workbench','e',3.5);
    for(const v of [3,5])room.wall('storage-rack','w',v);
    room.wall('office-cabinet','s',2.25);
  } else if(name==='서버실') {
    for(const [u,v] of grid([1.25,1.85,2.45,3.05],[3.4,5.6]))room.put('server-rack',u,v);
  } else if(name==='보건실') {
    for(const u of [3,4.4,5.8,7.2])room.wall('infirmary-bed','s',u);
    room.put('teacher-desk',2.4,2.6);
    for(const v of [2,3.25])room.wall('glass-cabinet','e',v);
    room.wall('sink-counter','n',5.5);
  } else if(name==='평가관리실'||name==='학생안전부')staffRoom(room,rect);
  else if(name==='학부모실') {
    room.put('sofa-set',2.25,1.9);
    room.put('conference-set',2.25,5.2,Math.PI/2);
  } else if(name==='회의실') {
    for(const v of [3.3,5.73])room.put('conference-set',2.25,v,Math.PI/2);
    room.wall('whiteboard-stand','s',2.25);
  } else if(name==='협의실')room.put('conference-set',1.35,3,Math.PI/2);
  else if(name==='학생회실') {
    for(const v of [1.9,4.3])room.put('conference-set',3,v);
    room.wall('bookcase','w',3.1);
    room.put('whiteboard-stand',5.7,5.3,-Math.PI/2);
  } else if(/직원휴게실/.test(name)) {
    room.wall('sofa-set','w',2.1);
    room.wall('sink-counter','n',4);
    room.put('lounge-chair-green',3.2,3.2,-Math.PI/2);
    room.wall('office-cabinet','s',4.5);
  } else if(name==='공감교실') {
    for(const v of [1.7,5.1])room.wall('sofa-set','w',v);
    room.put('oval-table-set',4.2,3.4);
    for(const v of [1,5.8])room.put('lounge-chair-green',4.2,v,v<3?0:Math.PI);
  } else if(name==='음악실') {
    room.wall('board-green','w',4.25);
    // North-west corner, clear of the south window frames so the pianist stays in view.
    room.put('upright-piano',1.3,1.25,Math.PI/2);
    for(const [u,v] of grid([3.6,5,6.4,7.8,9.2,10.6],[2.2,3.3,4.4,5.5,6.6]))room.put('student-set',u,v,Math.PI/2);
  } else if(name==='시청각실 (송천홀)') {
    // Auditorium: stage and projector board at the west end, seat blocks facing it.
    room.wall('stage-wide','w',5.8);
    room.wall('board-projector','w',5.8,{y:.22,solid:false});
    for(const [u,v] of grid(Array.from({length:12},(_,i)=>5+i*1.1),[2.2,5.8,9.4]))room.put('theater-row',u,v,-Math.PI/2);
  } else if(name==='송학관 관람석') {
    for(const v of [1.8,5,10.5,13.7])room.put('bleacher',.9,v,-Math.PI/2);
  }
  else return null;
  return {pieces:room.pieces,props:room.props};
}

/** Window-side seating seen in the east corridor videos; furniture stays within 1.1 m of the windows. */
export function corridorLayout(floor:number):ClassroomPiece[] {
  const windowX=40.5,item=(model:ClassroomModel,z:number):ClassroomPiece=>({model,x:windowX-gap-classroomModels[model][1]/2,z,rotation:-Math.PI/2,solid:true});
  if(floor===2)return [item('window-bench-green',-20.5),item('round-table-stools',-16.4),item('window-bench-green',-12),item('round-table-stools',-8)];
  if(floor===3)return [-21,-18.6,-11,-8.6].map(z=>item('booth',z));
  if(floor===4)return [-20.5,-19.1,-10.5,-9.1].map(z=>item('window-desk',z));
  return [];
}

/**
 * First-floor library from its two walk-through videos: 열린도서관 has group tables on a wood
 * floor, 도서관 has rows of double-sided stacks whose blue end panels face the glass corridor.
 * Folded glass doors stand in the shared-wall passage between them.
 */
export function libraryLayout(open:Rect,library:Rect,passage:{x:number;minZ:number;maxZ:number}):(ClassroomPiece&{roomId:string})[] {
  const pieces:(ClassroomPiece&{roomId:string})[]=[];
  for(const [roomId,rect,build] of [['open-library',open,(room:ReturnType<typeof planner>)=>{
    for(const u of [3,6.75,10.4])room.put('library-table-set',u,4);
    for(const u of [1.6,3.5,5.4,8.1,10,11.9])room.wall('wood-bookcase','s',u);
    room.wall('whiteboard-stand','w',2.2);
    room.wall('computer-set','w',5.6);
    for(const v of [1.2,6.3])room.wall('low-book-shelf','e',v);
  }],['library',library,(room:ReturnType<typeof planner>)=>{
    room.put('library-table-set',3,1.9);
    room.put('circulation-desk',2.4,6.5,Math.PI);
    for(const u of [6,7.5,10.5,12,13.5,15])for(const v of [2.6,5.03])room.put('library-stack',u,v,Math.PI/2);
    for(const u of [6.75,8.6,10.45,12.3,14.15])room.wall('low-book-shelf','s',u);
    for(const v of [1.6,3.5,5.4])room.wall('wood-bookcase','e',v);
    for(const u of [.5,16.5])room.put('lounge-chair-green',u,6.9,Math.PI);
    room.put('book-cart',4.7,6.6);
  }]] as const) {
    const room=planner(rect);build(room);
    pieces.push(...room.pieces.map(piece=>({...piece,roomId})));
  }
  // Folded leaves narrow the passage to about 1.4 m, like the half-open folding doors in the video.
  for(const z of [passage.minZ+.44,passage.maxZ-.44])pieces.push({roomId:'library',model:'folding-glass-door',x:passage.x,z,rotation:0,solid:true});
  return pieces;
}

/** First-floor offices around the lobby, kept beside their existing desks (principal, 개별화교육지원실). */
export function groundRoomsLayout(rooms:Record<'admin'|'individual'|'principal'|'shop',Rect>):(ClassroomPiece&{roomId:string})[] {
  const pieces:(ClassroomPiece&{roomId:string})[]=[];
  const add=(roomId:keyof typeof rooms,build:(room:ReturnType<typeof planner>)=>void)=>{const room=planner(rooms[roomId]);build(room);pieces.push(...room.pieces.map(piece=>({...piece,roomId})));};
  add('admin',room=>{staffPods(room,2.1,3,4.6);room.put('conference-set',7.4,4);for(let i=0;i<5;i++)room.wall('office-cabinet','s',1+i*classroomModels['office-cabinet'][0]);});
  add('individual',room=>{room.put('hex-table-set',6,4.5);room.wall('sofa-set','s',2.5);room.wall('storage-wall','e',3.75);});
  add('principal',room=>{room.put('sofa-set',6,5);for(const v of [2.5,3.6])room.wall('bookcase','e',v);});
  add('shop',room=>{for(const u of [2.1,4.15,6.2,8.25])room.wall('open-shelf','n',u);for(const v of [2,2.75,3.5])room.wall('drink-fridge','e',v);room.put('side-counter',3,5.5);room.put('round-table-stools',9,5.3);});
  return pieces;
}
