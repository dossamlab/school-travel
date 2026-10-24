// 학교 여행(school-travel) — Template by 청학고 도쌤 (dossamlab) · https://github.com/dossamlab/school-travel
import './school-style.css';
import {bindGameKeyboard} from './interaction';
import {planFloorData as floorData,planAspectRatios} from './school-plan-data';
import {places,floorSpawn,campusSpawn,gateSpawn,schoolBounds,type Place,type Point,type TourMode} from './school-layout';
import {findSchoolPath,moveInSchool,moveSchoolVisitor,isWalkable,advanceSchoolRoute,schoolInputDirection} from './school-navigation';
import {portals,stairs,stairSupport,groundHeight,floorRise} from './school-structure';
import {createSchool,type Seat,type School} from './school-scene';
import {exerciseStance,type Exercise} from './school-classrooms';
import {squatRate,curlRate} from './player';
import {drawOnionCells,composePhoto,photoDate} from './school-pictures';
import {campusEntrancePoint,campusHeight,canInteractFromCampus} from './school-outdoors';
import {upperRooms,upperPlanData,upperProps,customRooms,walkingFloor,onFloorLevel,type UpperProp} from './school-upper-floors';
import {mountBalloonGame,mountQuizGame} from './school-minigames';
import {installDeviceGuards,installFullscreen,showFullscreenHint} from './school-device';
import {createSound} from './audio';
import {tourCourses,tourStopPoint,reachedTourStop,type TourCourse} from './school-tour';
import {gatePrincipal,principalTalkRadius,canTalkToPrincipal,nearbyGreeter,type Greeter} from './school-principal';
import {showGuestbook,showPrincipalGuide,showRoomGuide} from './school-sheet-ui';
import {nearbyStair,automaticStairPath,advanceStairRoute,type SchoolStair} from './school-auto-stairs';
import {schoolConfig} from './school-config';
import {templateCredit} from './template-credit';
const allPlaces=[...places,...upperRooms,gatePrincipal];
const placeFloor=(place:Place)=>'floor' in place?Number(place.floor):1;
const mapCells=(floor:number)=>floor===1?floorData[1]:upperPlanData[floor];

const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const icons:Record<string,string>={
  leaf:'<path d="M19 4C10 3 4 6 5 13s9 8 12 2c2-4 2-8 2-11Z"/><path d="m6 19 9-11m-4 5-4-1"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  door:'<path d="M5 21V3h14v18M3 21h18M5 3l10 3v15"/><path d="M11 12h1"/>',
  view:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 2v.1"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]??icons.pin}</svg>`;
const {about}=schoolConfig;
const outbound=(link:{label:string;url:string},arrow=' ↗')=>`<a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.label)}${arrow}</a>`;

$('#app').innerHTML=`
  <main id="school-stage" tabindex="-1" aria-label="${schoolConfig.siteName} · ${schoolConfig.schoolName} 3D 탐방 화면"></main>
  <div id="loading" role="status"><span class="loading-leaf">${icon('leaf')}</span><b>학교의 문을 열고 있어요</b><span>캐릭터와 공간을 불러오는 중입니다.</span></div>
  <section id="welcome" hidden aria-labelledby="welcome-title">
    <div class="welcome-card"><div class="eyebrow">${schoolConfig.englishName} · SCHOOL WALK</div><h1 id="welcome-title">처음 오는 길도,<br>천천히 둘러봐요.</h1><p>교문에서 학교로 걸어 들어가며<br>찾아갈 곳을 미리 만나 보세요.</p><div class="welcome-tags"><span>교문부터 학교 산책</span><span>1–5층 안내도</span></div><button id="start-campus" class="primary">교문에서 탐방 시작 ${icon('arrow')}</button><button id="start-course" class="secondary">3분 추천 코스 둘러보기</button><button id="start-tour" class="quiet">1층 바로 둘러보기</button><small>${schoolConfig.schoolName} · 배치도 기반 3D 견본<br>건물 외형과 문 위치는 실제 모습과 다를 수 있어요.<br>${outbound({label:templateCredit.text,url:templateCredit.url},'')}</small></div>
  </section>
  <div id="hud" hidden>
    <header class="topbar"><div class="school-brand"><span class="brand-mark">${icon('leaf')}</span><div><strong>${schoolConfig.siteName}</strong><span>${schoolConfig.tagline}</span></div></div><nav aria-label="화면 보기"><button id="mode-floor" class="tab active">1층 산책</button><button id="mode-campus" class="tab">건물 전체</button></nav><div class="header-tools"><button id="menu-toggle" class="round-button menu-toggle" aria-expanded="false" aria-controls="hud" aria-label="메뉴 펼치기">☰<span>메뉴</span></button><button id="map-button" class="round-button" aria-label="교실 바로가기 · 층별 안내도 열기">${icon('map')}<span>교실 바로가기</span></button><button id="help-button" class="icon-button" aria-label="조작 방법과 자료 출처">${icon('help')}</button></div></header>
    <aside id="destinations" class="destinations"><div class="panel-title"><span class="eyebrow">어디로 가 볼까요?</span><button id="collapse-destinations" class="icon-button small" aria-label="목적지 목록 접기">−</button></div><div id="destination-content"><h2>오늘의 발걸음</h2><p>장소를 고르면 입구까지 안내해요.</p><label class="search"><span>${icon('pin')}</span><input id="place-search" type="search" placeholder="찾고 싶은 장소" aria-label="목적지 검색"></label><div id="destination-list"></div><div class="panel-footer">현재 층의 목적지</div></div></aside>
    <div id="route-card" hidden role="status"><span class="route-dot"></span><span id="route-status"></span><button id="cancel-route" aria-label="길 안내 멈추기">${icon('close')}</button></div>
    <button id="nearby-action" class="nearby-action" hidden></button>
    <div id="stair-actions" hidden aria-label="계단 이동"></div>
    <div class="scene-tools"><button id="overview" class="round-button">${icon('view')}<span>전체 보기</span></button><button id="music-toggle" class="round-button" aria-label="배경음악 끄기" aria-pressed="true">♫ 음악 ON</button><button id="course-button" class="round-button" aria-label="3분 추천 코스 열기">${icon('map')}<span>3분 투어</span></button><button id="guestbook-button" class="round-button" aria-label="방명록 열기">${icon('leaf')}<span>방명록</span></button><span id="location-chip">1층 · 중앙로비</span></div>
    <button id="joystick" aria-label="화면 이동판. 누른 채 원하는 방향으로 움직이세요."><span class="stick-cross"></span><span id="stick-thumb"></span><small>이동</small></button>
    <footer class="guide"><img src="${import.meta.env.BASE_URL}lumi-portrait.png" alt="안내자 루미"><div><b>루미의 학교 안내</b><p id="guide-text">반가워요! 목적지를 고르거나 복도를 눌러 걸어 보세요.</p></div><button id="place-info" class="icon-button" aria-label="가까운 장소 자세히 보기">${icon('help')}</button></footer>
    <div class="keyboard-hint"><kbd>WASD</kbd> 이동 <span>·</span> <kbd>Space</kbd> 문·의자·물건 <span>·</span> 바닥 클릭</div>
    <button id="mini-map" aria-label="현재 위치와 층별 안내도 보기"><span>현재 위치</span><svg viewBox="0 0 420 115" aria-hidden="true"><g id="mini-rooms"></g><g id="mini-player"><circle r="28" fill="#c54738" fill-opacity=".2"/><circle r="18" fill="#c54738" stroke="#fffdf1" stroke-width="2" vector-effect="non-scaling-stroke"/></g></svg></button>
  </div>
  <button id="fullscreen-button" class="fullscreen-button" aria-pressed="false" aria-label="전체화면으로 보기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="enter" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path class="exit" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg></button>
  <div id="toast" role="status" aria-live="polite" hidden></div>
  <dialog id="tour-dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><div><span class="eyebrow" id="dialog-eyebrow">학교 안내</span><h2 id="dialog-title"></h2></div><button id="dialog-close" class="icon-button" aria-label="안내창 닫기">${icon('close')}</button></div><div id="dialog-content"></div></dialog>`;

installDeviceGuards(document.body);
const fullscreen=installFullscreen($<HTMLButtonElement>('#fullscreen-button'),message=>toast(message));
if(matchMedia('(orientation: landscape)').matches)showFullscreenHint($<HTMLButtonElement>('#fullscreen-button'),fullscreen.enter);
else addEventListener('resize',function once(){if(innerWidth>innerHeight){removeEventListener('resize',once);showFullscreenHint($<HTMLButtonElement>('#fullscreen-button'),fullscreen.enter);}});
// Phones held sideways: secondary buttons fold into the menu and the action button stays on the right.
const compactLandscape=matchMedia('(orientation: landscape) and (max-height: 560px)');
$('#menu-toggle').onclick=()=>{
  const open=!$('#hud').classList.contains('menu-open');
  $('#hud').classList.toggle('menu-open',open);
  $('#menu-toggle').setAttribute('aria-expanded',String(open));$('#menu-toggle').setAttribute('aria-label',open?'메뉴 접기':'메뉴 펼치기');
};
for(const id of ['#map-button','#help-button','#overview','#course-button','#guestbook-button'])$(id).addEventListener('click',()=>{if(compactLandscape.matches){$('#hud').classList.remove('menu-open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
let school:Awaited<ReturnType<typeof createSchool>>;
let mode:TourMode='campus',started=false,overview=true;
let walkingPath:Point[]=[],routeGoal:Place|null=null,nearby:Place|null=null;
/** What Space and the bottom action button do right now. */
type Hoop=School['hoops'][number];
type Action={kind:'prop';prop:UpperProp}|{kind:'seat';seat:Seat}|{kind:'stand'}|{kind:'place';place:Place}|{kind:'stop'}|{kind:'piano'}|{kind:'shoot';hoop:Hoop}|{kind:'greet';greeter:Greeter};
let action:Action|null=null,seated:{seat:Seat;back:Point}|null=null;
/** The machine the visitor is exercising on, with the fun-only counters shown in the chip. */
let exercise:{prop:UpperProp&{exercise:Exercise};back:Point;clock:number;count:number;metres:number}|null=null;
/** Short scenes (piano, photo, free throw) that ignore a second press until they finish. */
let performingUntil=0,pianoTimer=0;
const now=()=>performance.now()/1000;
const wait=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));
let afterPortal:Place|null=null;
let tour:{course:TourCourse;index:number;arrived:boolean}|null=null;
let stairTrip:{path:Point[];floor:number;resumeTour:boolean}|null=null;
const openDoors=new Set<string>(),held=new Set<string>();
const joystick={x:0,y:0};
const dialog=$<HTMLDialogElement>('#tour-dialog');
const sound=createSound(()=>toast('음악을 재생하지 못했어요. 음악 버튼을 눌러 다시 켜 주세요.'));
sound.settings.volume=.28;
// Interaction sounds follow the same on/off button as the music.
sound.settings.effects=sound.settings.music;
function renderMusicButton(){
  const button=$('#music-toggle'),on=sound.settings.music;
  button.textContent=on?'♫ 음악 ON':'♫ 음악 OFF';
  button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'배경음악 끄기':'배경음악 켜기');
}
async function playMusic(){
  await sound.activate();
  if(sound.state!=='running')sound.settings.music=false;
  else sound.update();
  renderMusicButton();
}
$('#music-toggle').onclick=()=>{
  sound.settings.music=!sound.settings.music;sound.settings.effects=sound.settings.music;
  if(sound.settings.music)void playMusic();else sound.update();
  renderMusicButton();$('#school-stage').focus();
};
let refreshMap=()=>{};
const mapResizeObserver=new ResizeObserver(()=>refreshMap());
let selected:Place|null=null,toastTimer=0,mapFloor=1;
const destinations=places.filter(place=>['admin','library','open-library','individual','principal','shop','basketball','parking','dining','elevator-hall','east-passage',...stairs.map(s=>s.id)].includes(place.id));
const currentFloor=()=>school&&mode==='floor1'?walkingFloor(school.player.position.y):1;
let hudFloor=0;
const point=():Point=>({x:school.player.position.x,z:school.player.position.z});
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const isEntrance=(place:Place)=>['entrance','east-passage','west-entrance'].includes(place.id);
const isParkingDoor=(place:Place)=>place.id.endsWith('parking-door');
const isOutdoorDoor=(place:Place)=>isParkingDoor(place)||place.id==='court-door'||place.id==='dining-exit';
const hasDoor=(place:Place)=>place.enterable||portals.some(p=>p.id===place.id);
/** Automatic sliding doors open as a visitor comes near and close after they walk away. */
const autoDoors=new Set(['library','open-library']);
const onStairs=()=>!onFloorLevel(school.player.position.y)&&Math.abs(school.player.position.y-groundHeight(point()))>.12||!isWalkable(point(),'floor1',openDoors,currentFloor());
const interactionPoint=(place:Place):Point=>mode==='campus'?(isEntrance(place)?campusEntrancePoint(place.id):isOutdoorDoor(place)?{x:place.door.x+(place.id.startsWith('north-')?1:-1),z:place.door.z}:place.approach):place.approach;
const interactionRadius=(place:Place)=>place.id===gatePrincipal.id?principalTalkRadius:mode==='floor1'&&place.id==='entrance'?1.8:4.2;

function toast(message:string) {
  $('#toast').textContent=message;$('#toast').hidden=false;window.clearTimeout(toastTimer);
  toastTimer=window.setTimeout(()=>{$('#toast').hidden=true;},4200);
}
function clearInput(){held.clear();joystick.x=0;joystick.y=0;$('#stick-thumb').style.transform='translate(0,0)';}
function stopRoute(){walkingPath=[];routeGoal=null;afterPortal=null;school?.setRoute([]);$('#route-card').hidden=true;}
function beginStair(stair:SchoolStair,floor:number,resumeTour=false){
  if(mode!=='floor1'||stairTrip)return;
  const path=automaticStairPath(school.player.position,stair,floor,openDoors);
  if(!path.length){toast('계단 앞 복도로 조금 더 가까이 와 주세요.');return;}
  if(dialog.open)dialog.close();clearInput();stopRoute();setOverview(false);
  stairTrip={path,floor,resumeTour};$('#guide-text').textContent=`${stair.name}을 따라 ${floor}층으로 이동하고 있어요.`;
}
function setOverview(value:boolean){overview=value;school.setOverview(value);$('#overview span').textContent=value?'따라 보기':'전체 보기';}
function setMode(value:TourMode,keepInput=false){
  stairTrip=null;
  if(!keepInput)clearInput();stopRoute();mode=value;school.setMode(value);
  const spawn=value==='floor1'?floorSpawn:campusSpawn;
  school.player.position.set(spawn.x,0,spawn.z);school.player.rotation.y=Math.PI;
  setOverview(value==='campus');
  $('#mode-floor').classList.toggle('active',value==='floor1');$('#mode-campus').classList.toggle('active',value==='campus');
  $('#mini-map').hidden=value==='campus';
  $('#guide-text').textContent=value==='floor1'?'중앙로비에 도착했어요. 동편으로는 열린도서관과 도서관, 북쪽통로에는 급식실과 당직실이 있어요.':'교문 옆길에서 필로티 주차장까지 걸어가 보세요. 동편·북측 주차장 문이나 중앙·서편·동편 출입구로 실내에 들어갈 수 있어요.';
  $('#location-chip').textContent=value==='floor1'?'1층 · 중앙로비':'건물 전체 · 현장 영상 반영';
  standUp();stopExercise();nearby=null;action=null;$('#nearby-action').hidden=true;
}
function collapseDestinations(collapsed:boolean){
  $('#destinations').classList.toggle('collapsed',collapsed);$('#collapse-destinations').textContent=collapsed?'+':'−';
  $('#collapse-destinations').setAttribute('aria-label',collapsed?'목적지 목록 펼치기':'목적지 목록 접기');
}
function start(value:TourMode){
  void playMusic();
  started=true;$('#welcome').hidden=true;$('#hud').hidden=false;setMode(value);
  if(value==='campus'){
    school.player.position.set(gateSpawn.x,0,gateSpawn.z);school.player.rotation.y=-Math.PI/2;setOverview(false);
    $('#guide-text').textContent='교문 앞에 도착했어요. 교문을 지나 건물 앞길을 따라 걸어 보세요. 중앙현관의 안내 표시를 누르면 1층으로 들어갈 수 있어요.';
    $('#location-chip').textContent='학교 바깥 · 교문 앞';
  }
  collapseDestinations(innerWidth<=700);$('#school-stage').focus();
}
function showDialog(title:string,content:string,eyebrow='학교 안내'){
  sound.duck(true);
  mapResizeObserver.disconnect();dialog.classList.remove('map-dialog','guestbook-dialog');
  clearInput();stopRoute();$('#dialog-title').textContent=title;$('#dialog-eyebrow').textContent=eyebrow;$('#dialog-content').innerHTML=content;
  if(!dialog.open)dialog.showModal();
}
function renderCourseButton(){
  $('#course-button span').textContent=tour?`${tour.index+1}/${tour.course.stops.length} 코스 안내`:'3분 투어';
  $('#course-button').classList.toggle('active',!!tour);
  $('#course-button').setAttribute('aria-label',tour?`${tour.course.name} ${tour.index+1}번째 장소 · 코스 안내 열기`:'3분 추천 코스 열기');
}
function showCourses(){
  if(stairTrip){toast('계단 이동을 마친 뒤 코스 안내를 열어 주세요.');return;}
  if(tour){
    const {course,index}=tour;
    showDialog(course.name,`<p class="description">잠시 쉬어도 괜찮아요. 현재 장소부터 안내를 이어갈 수 있어요.</p><ol class="course-stops">${course.stops.map((stop,i)=>`<li class="${i<index?'visited':i===index?'current':''}" ${i===index?'aria-current="step"':''}>${escape(allPlaces.find(p=>p.id===stop.placeId)!.name)}<span>${i<index?'방문 완료':i===index?'현재 안내':''}</span></li>`).join('')}</ol><div class="dialog-actions"><button id="resume-course" class="primary">${tour.arrived?'현재 장소 설명 보기':'이어서 안내'} ${icon('arrow')}</button><button id="end-course" class="secondary">코스 종료</button></div>`,'3분 학교 투어');
    $('#resume-course').onclick=()=>tour?.arrived?showTourStop():navigateTourStop();
    $('#end-course').onclick=()=>{tour=null;renderCourseButton();dialog.close();toast('코스 안내를 종료했어요. 자유롭게 둘러보세요.');};
    return;
  }
  showDialog('어떤 산책을 해 볼까요?',`<p class="description">교문에서 출발해 주요 공간을 둘러보는 코스예요. 송천홀 코스는 계단을 통해 2층까지 이어져요.</p><div class="course-options">${tourCourses.map(course=>`<button class="course-option" data-course="${course.id}"><b>${course.name}</b><p>${course.intro}</p><span>${course.stops.map(stop=>escape(allPlaces.find(p=>p.id===stop.placeId)!.name)).join(' → ')}</span><strong>교문에서 출발 ${icon('arrow')}</strong></button>`).join('')}</div><p class="source-note">코스를 선택하면 교문으로 이동해요. 이동키나 화면 이동판을 사용하면 자동 걷기가 멈추고, ‘코스 안내’에서 이어갈 수 있어요.</p>`,'3분 학교 투어');
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-course]'))button.onclick=()=>{
    const course=tourCourses.find(course=>course.id===button.dataset.course)!;
    tour={course,index:0,arrived:false};renderCourseButton();start('campus');navigateTourStop();
  };
}
function navigateTourStop(){
  if(!tour)return;
  const stop=tour.course.stops[tour.index];
  if(!onFloorLevel(school.player.position.y)){toast('층 복도에 도착한 뒤 안내를 이어 주세요.');return;}
  if(mode==='floor1'&&currentFloor()!==(stop.floor??1)){
    beginStair(stairs.find(stair=>stair.id==='stairs-north')!,currentFloor()+Math.sign((stop.floor??1)-currentFloor()),true);return;
  }
  if(stop.mode==='campus'&&stop.placeId==='entrance'&&mode!=='campus'){toast('중앙현관에서 건물 바깥으로 나와 주세요.');return;}
  if(reachedTourStop(stop,school.player.position,mode)){tour.arrived=true;showTourStop();return;}
  if(dialog.open)dialog.close();
  if(stop.mode==='floor1'||stop.placeId==='shop')chooseDestination(allPlaces.find(place=>place.id===stop.placeId)!);
  else{
    stopRoute();clearInput();const path=findSchoolPath(point(),tourStopPoint(stop),mode,openDoors);
    if(!path.length){toast('중앙현관으로 이어지는 길 가까이에서 다시 안내를 선택해 주세요.');return;}
    walkingPath=path;routeGoal=places.find(place=>place.id===stop.placeId)!;school.setRoute(path);setOverview(false);
    $('#route-card').hidden=false;$('#route-status').textContent='중앙현관으로 이동 중';
  }
  $('#guide-text').textContent=`${tour.course.name} · ${tour.index+1}/${tour.course.stops.length}. ${allPlaces.find(place=>place.id===stop.placeId)!.name}으로 함께 걸어요. 도착하면 설명이 열려요.`;
}
function showTourStop(){
  if(!tour)return;
  const active=tour,index=active.index,stop=active.course.stops[index],last=index===active.course.stops.length-1;
  showDialog(stop.title,`<span class="place-badge">${active.course.name} · ${index+1} / ${active.course.stops.length}</span><p class="description">${escape(stop.description)}</p><div class="dialog-actions"><button id="next-course" class="primary">${last?'산책 마무리':stop.mode==='campus'&&stop.placeId==='entrance'?'중앙현관으로 들어가기':'다음 장소로'} ${icon('arrow')}</button><button id="look-around-course" class="secondary">이곳 둘러보기</button></div><p class="source-note">둘러본 뒤 오른쪽 ‘코스 안내’를 누르면 다시 이어갈 수 있어요.</p>`,'한 걸음씩 알아가는 학교');
  $('#look-around-course').onclick=()=>dialog.close();
  $('#next-course').onclick=()=>{
    if(tour!==active||active.index!==index)return;
    if(last){
      tour=null;renderCourseButton();
      showDialog('오늘의 산책을 마쳤어요',`<span class="place-badge">${active.course.name} · ${active.course.stops.length}곳 방문 완료</span><p class="description">처음보다 학교가 조금 더 익숙해졌나요?<br>방명록에 오늘의 산책을 한 줄 남겨 주세요.</p><div class="dialog-actions"><button id="course-guestbook" class="primary">방명록에 발자국 남기기 ${icon('leaf')}</button><button id="course-free" class="secondary">자유롭게 더 둘러보기</button></div>`,'3분 학교 투어 · 완료');
      $('#course-guestbook').onclick=()=>$('#guestbook-button').click();$('#course-free').onclick=()=>dialog.close();return;
    }
    // Enter through the same central doorway used by normal interaction.
    if(stop.mode==='campus'&&stop.placeId==='entrance'&&mode==='campus'){
      if(!reachedTourStop(stop,school.player.position,mode)){active.arrived=false;navigateTourStop();return;}
      interact(places.find(place=>place.id==='entrance')!);
    }
    active.index++;active.arrived=false;renderCourseButton();navigateTourStop();
  };
}
function chooseDestination(place:Place){
  if(stairTrip)return;
  if(dialog.open)dialog.close();
  // Parking routes continue through doors instead of resetting to the lobby.
  if(mode!=='floor1'&&place.id!=='shop'&&!isWalkable(point(),'floor1',openDoors))setMode('floor1');
  if(placeFloor(place)!==currentFloor()){toast(`${placeFloor(place)}층 장소예요. 서편·북편·중앙·동편 계단으로 해당 층에 올라간 뒤 길 안내를 선택해 주세요.`);return;}
  if(onStairs()){toast('계단에서는 이동키나 조이스틱으로 걸어 주세요. 복도에 도착하면 길 안내를 이용할 수 있어요.');return;}
  clearInput();selected=place;
  if(innerWidth<=700)collapseDestinations(true);
  const pathMode=mode==='campus'&&place.id==='shop'?'campus':'floor1';
  let path=findSchoolPath(point(),place.approach,pathMode,openDoors,currentFloor()),target=place;
  afterPortal=null;
  if(!path.length&&currentFloor()===1) {
    const allOpen=new Set([...openDoors,...portals.map(p=>p.id)]),through=findSchoolPath(point(),place.approach,'floor1',allOpen);
    outer:for(let i=1;i<through.length;i++)for(const portal of portals.filter(p=>!openDoors.has(p.id))) {
      const a=through[i-1],b=through[i],closedOne=new Set(allOpen);closedOne.delete(portal.id);
      const step=moveInSchool(a,{x:b.x-a.x,z:b.z-a.z},'floor1',closedOne);
      if(step.x===a.x&&step.z===a.z) {
        const approach=portal.axis==='x'?{x:portal.at+(a.x>=portal.at?1.1:-1.1),z:portal.center}:{x:portal.center,z:portal.at+(a.z>=portal.at?1.1:-1.1)};
        path=findSchoolPath(point(),approach,mode,openDoors);
        if(path.length){target=places.find(p=>p.id===portal.id)!;afterPortal=place;break outer;}
      }
    }
  }
  if(!path.length){if(distance(point(),place.approach)<1.5){toast(`${place.name} 입구에 도착했어요.`);return;}toast('현재 위치에서는 이어지는 통로를 찾지 못했어요. 중앙현관에서 다시 선택해 주세요.');return;}
  setOverview(false);walkingPath=path;routeGoal=target;school.setRoute(path);$('#route-card').hidden=false;
  $('#route-status').textContent=`${target.name} 입구로 이동 중`;$('#guide-text').textContent=afterPortal?`${place.name}으로 가려면 ${target.name}을 열어야 해요. 문 앞에서 Space나 안내 버튼을 눌러 주세요.`:`바닥의 안내선을 따라 ${place.name} 입구로 가요. 이동키를 누르면 직접 걸을 수 있어요.`;
  $('#school-stage').focus();
}
function interact(place:Place){
  if(place.id===gatePrincipal.id){
    if(!canTalkToPrincipal(school.player.position,mode))return;
    showDialog('교장선생님과 이야기','<div id="principal-guide"></div>',`${schoolConfig.schoolName}에 오신 것을 환영합니다`);
    showPrincipalGuide($('#principal-guide'));return;
  }
  if(mode==='campus'&&!canInteractFromCampus(place.id,point()))return;
  if(distance(point(),interactionPoint(place))>interactionRadius(place))return;
  if(mode==='floor1'&&(placeFloor(place)!==currentFloor()||!onFloorLevel(school.player.position.y)))return;
  selected=place;
  if(isEntrance(place)){
    setMode(mode==='campus'?'floor1':'campus');
    const position=mode==='floor1'?place.approach:campusEntrancePoint(place.id);
    school.player.position.set(position.x,0,position.z);setOverview(false);
    $('#guide-text').textContent=mode==='floor1'?`${place.name}에 도착했어요. 복도를 따라 학교를 둘러보세요.`:'건물 앞 공간으로 나왔어요.';
    toast(mode==='floor1'?`${place.name}에 도착했어요.`:'건물 앞 전체 보기로 나왔어요.');return;
  }
  if(autoDoors.has(place.id)){if(!openDoors.has(place.id)){openDoors.add(place.id);school.openDoor(place.id,true);}toast(`${place.name} · 자동문이에요. 다가가면 열려요.`);return;}
  if(hasDoor(place)){
    const opening=!openDoors.has(place.id);
    // Leave the doorway clear before closing; a visitor must never be caught in a wall.
    if(!opening&&distance(point(),place.door)<1.15){toast('문에서 한 걸음 떨어진 뒤 닫아 주세요.');return;}
    const resume=afterPortal;stopRoute();if(opening)openDoors.add(place.id);else openDoors.delete(place.id);
    school.openDoor(place.id,opening);
    $('#guide-text').textContent=opening?`${place.name} 문을 열었어요. 바닥을 눌러 들어가 둘러보세요.`:`${place.name} 문을 닫았어요.`;
    toast(opening?`${place.name} · 문이 열렸어요`:`${place.name} · 문을 닫았어요`);
    if(opening&&resume)chooseDestination(resume);
    return;
  }
  showPlace(place);
}
const propReach=1.4,seatReach=1;
function sitDown(seat:Seat){
  stopRoute();clearInput();
  seated={seat,back:point()};
  school.player.position.set(seat.x,school.player.position.y,seat.z);school.player.rotation.y=seat.yaw;school.setSeated(seat.y);
  $('#guide-text').textContent='의자에 앉았어요. Space나 이동키를 누르면 일어나요.';
}
function standUp(){
  if(!seated)return;
  const {back}=seated;seated=null;
  window.clearInterval(pianoTimer);performingUntil=0;school.setActivityPose({});school.setFocus(1);
  school.player.position.set(back.x,school.player.position.y,back.z);school.setSeated(undefined);
}
const exerciseNames:Record<Exercise,string>={run:'러닝머신',squat:'스쿼트',curl:'덤벨 컬'};
function startExercise(prop:UpperProp&{exercise:Exercise}){
  stopRoute();clearInput();
  const stance=exerciseStance(prop);
  exercise={prop,back:point(),clock:0,count:0,metres:0};
  school.player.position.set(stance.x,school.player.position.y,stance.z);school.player.rotation.y=stance.yaw;
  school.setActivityPose({activity:prop.exercise,lift:stance.lift});school.setActiveProp(prop.id);school.setFocus(1.8);
  toast(prop.exercise==='run'?'러닝머신이 돌아가요. 가볍게 달려 볼까요?':prop.exercise==='squat'?'바벨을 메고 앉았다 일어나요. 무릎은 발끝 방향으로!':'덤벨을 들고 팔을 굽혀요. 팔꿈치는 몸 옆에 붙이고!');
  $('#guide-text').textContent='운동 중이에요. 그만하기 버튼이나 이동키를 누르면 내려와요.';
}
function stopExercise(){
  if(!exercise)return;
  const {back,prop,metres,count}=exercise;exercise=null;
  school.setActivityPose({});school.setActiveProp(undefined);school.setFocus(1);
  school.player.position.set(back.x,school.player.position.y,back.z);
  $('#guide-text').textContent=prop.exercise==='run'?`러닝머신에서 ${Math.floor(metres)} m를 달렸어요. 수고했어요!`:`${exerciseNames[prop.exercise]} ${count}회를 했어요. 수고했어요!`;
}
function exerciseTick(dt:number){
  const e=exercise!;e.clock+=dt;
  if(e.prop.exercise==='run'){
    const before=Math.floor(e.metres/100);e.metres+=dt*3.4;
    if(Math.floor(e.metres/100)>before){toast(`파이팅! ${Math.floor(e.metres/100)*100} m 돌파`);school.effects.sparkle(school.player.position);}
    return;
  }
  // One repetition is a full down-and-up cycle of the pose (see player.ts).
  const reps=Math.floor(e.clock*(e.prop.exercise==='squat'?squatRate:curlRate)/(Math.PI*2));
  if(reps>e.count){e.count=reps;if(reps%10===0){toast(`${exerciseNames[e.prop.exercise]} ${reps}회 달성!`);school.effects.sparkle(school.player.position);}}
}
function exerciseLabel(){
  const e=exercise!,seconds=Math.floor(e.clock);
  return e.prop.exercise==='run'?`러닝머신 · ${Math.floor(e.metres)} m · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:`${exerciseNames[e.prop.exercise]} · ${e.count}회`;
}
function playPiano(){
  if(!seated||now()<performingUntil)return;
  performingUntil=now()+5.4;
  school.setActivityPose({activity:'play'});school.setFocus(1.6);sound.cue('piano');
  toast(sound.settings.effects?'♪ 직접 만든 짧은 곡을 연주해요':'♪ 음악 버튼을 켜면 피아노 소리도 들을 수 있어요');
  $('#guide-text').textContent='음악실 피아노를 연주하고 있어요. 이동키를 누르면 일어나요.';
  const {seat}=seated,started=now();
  window.clearInterval(pianoTimer);
  pianoTimer=window.setInterval(()=>{
    if(now()-started>5.2){window.clearInterval(pianoTimer);school.setFocus(1);if(seated)school.setActivityPose({});return;}
    // Notes rise from the music desk in front of the player.
    const at=school.player.position.clone();at.x+=Math.sin(seat.yaw)*.5;at.z+=Math.cos(seat.yaw)*.5;at.y+=1.25;
    school.effects.note(at);
  },320);
}
async function takePhoto(prop:UpperProp){
  if(now()<performingUntil)return;
  performingUntil=now()+4;stopRoute();clearInput();
  // Face away from the banner (it faces the room) so it stands behind the visitor in the picture.
  school.player.rotation.y=prop.rotation;
  school.setActivityPose({activity:'cheer'});school.setFocus(2.2);
  for(const word of ['하나','둘','셋!']){toast(`📸 ${word}`);await wait(650);}
  const shot=school.capture();
  const flash=document.createElement('div');flash.className='photo-flash';document.body.append(flash);flash.addEventListener('animationend',()=>flash.remove());
  school.setActivityPose({});school.setFocus(1);performingUntil=0;
  const date=new Date(),photo=composePhoto(shot,date),url=photo.toDataURL('image/jpeg',.9);
  const fileName=`${schoolConfig.siteName.replace(/\s+/g,'')}-포토존-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}.jpg`;
  showDialog('환영 포토존',`<figure class="photo-card"><img src="${url}" alt="입학설명회 현수막 앞에서 찍은 기념사진, ${photoDate(date)}"></figure><div class="photo-actions"><a class="primary" id="photo-save" href="${url}" download="${fileName}">사진 저장하기</a><button class="secondary" id="photo-share" hidden>공유하기</button></div><p class="photo-note">저장이 안 되면 사진을 길게 눌러 ‘이미지 저장’을 골라 주세요.</p>`,'입학설명회 기념사진');
  const blob=await new Promise<Blob|null>(resolve=>photo.toBlob(resolve,'image/jpeg',.9));
  const file=blob&&new File([blob],fileName,{type:'image/jpeg'});
  const share=$<HTMLButtonElement>('#photo-share');
  if(file&&navigator.canShare?.({files:[file]})){share.hidden=false;share.onclick=()=>{void navigator.share({files:[file],title:`${schoolConfig.siteName} 기념사진`}).catch(()=>{});};}
}
function showMicroscope(prop:UpperProp){
  showDialog('현미경 들여다보기',`<div class="scope-view"><canvas width="480" height="480" aria-label="400배로 본 양파 표피세포"></canvas></div><p class="scope-note">양파 표피세포를 400배로 봤어요. 벽돌처럼 늘어선 칸이 세포벽이고, 붉게 물든 동그라미가 핵이에요. 세포를 잘 보려고 아세트산카민 용액으로 핵을 염색해요.</p>`,prop.name);
  const view=$('.scope-view');drawOnionCells(view.querySelector('canvas')!);
  // Start out of focus, then the fine-focus knob brings the cells in.
  requestAnimationFrame(()=>view.classList.add('focused'));
}
function shootHoop(hoop:Hoop){
  if(now()<performingUntil)return;
  stopRoute();clearInput();
  const yaw=Math.atan2(hoop.x-school.player.position.x,hoop.z-school.player.position.z);school.player.rotation.y=yaw;
  school.setActivityPose({activity:'cheer'});
  const made=Math.random()<.75,from=school.player.position.clone();from.y+=1.45;from.x+=Math.sin(yaw)*.15;from.z+=Math.cos(yaw)*.15;
  const flight=school.effects.shoot(from,hoop,made,school.courtFloor+.06);
  performingUntil=now()+flight+.8;
  window.setTimeout(()=>school.setActivityPose({}),500);
  window.setTimeout(()=>{
    if(made){sound.cue('claps');toast('골인! 짝짝짝 👏');const below=hoop.clone();below.y-=.6;school.effects.sparkle(below);}
    else toast('아깝다! 림을 맞고 튕겨 나왔어요. 한 번 더 던져 볼까요?');
  },flight*1000);
}
/** Wave to a teacher indoors, then hear what they have to say. */
function greet(greeter:Greeter){
  if(now()<performingUntil)return;
  performingUntil=now()+1.4;stopRoute();clearInput();
  school.player.rotation.y=Math.atan2(greeter.x-school.player.position.x,greeter.z-school.player.position.z);
  school.setActivityPose({activity:'wave'});
  toast(`👋 ${greeter.name}께 인사했어요`);
  window.setTimeout(()=>{
    school.setActivityPose({});performingUntil=0;
    if(greeter.id==='principal-office'){
      // The office principal shares the gate principal's sheet-managed welcome and topics.
      showDialog('교장선생님과 이야기','<div id="principal-guide"></div>','교장실에 오신 것을 환영합니다');
      showPrincipalGuide($('#principal-guide'));
    }else{
      showDialog('교감선생님과 인사','<p class="description greet-text">반가워요! 교무실까지 찾아와 줘서 고마워요.<br>2층에는 물리/지학실·생명과학실·화학실과 체력단련실이 있어요. 체력단련실에서는 러닝머신도 타 볼 수 있어요. 천천히 둘러보세요!</p><div class="dialog-actions"><button class="primary" id="greet-close">고맙습니다</button></div>','2층 교무실');
      $('#greet-close').onclick=()=>dialog.close();
    }
  },900);
}
/** A hoop the visitor can shoot at from where they stand on the court. */
function nearbyHoop(){
  if(Math.abs(school.player.position.y-school.courtFloor)>.3)return undefined;
  return school.hoops.find(hoop=>{const d=Math.hypot(hoop.x-school.player.position.x,hoop.z-school.player.position.z);return d>1.6&&d<7.5;});
}
function runAction(){
  if(!action)return;
  if(action.kind==='stand')standUp();
  else if(action.kind==='stop')stopExercise();
  else if(action.kind==='piano')playPiano();
  else if(action.kind==='shoot')shootHoop(action.hoop);
  else if(action.kind==='greet')greet(action.greeter);
  else if(action.kind==='seat')sitDown(action.seat);
  else if(action.kind==='prop')useProp(action.prop);
  else interact(action.place);
}
function useProp(prop:UpperProp){
  if(mode!=='floor1'||prop.floor!==currentFloor()||!onFloorLevel(school.player.position.y))return;
  if(distance(point(),prop.spot)>propReach){toast(`${prop.name} 앞으로 조금 더 다가가 주세요.`);return;}
  if(prop.action==='exercise'&&prop.exercise){startExercise(prop as UpperProp&{exercise:Exercise});return;}
  const result=school.useProp(prop.id);
  if(result==='opened'||result==='closed'){
    toast(result==='opened'?`${prop.name} · 유리문을 열었어요. 안에 3D 프린터 두 대가 있어요.`:`${prop.name} · 문을 닫았어요.`);
    $('#guide-text').textContent=result==='opened'?'3D 프린터는 설계한 모양을 한 층씩 쌓아 실제 물체로 만들어요. 한 번 더 누르면 출력해요.':`${prop.name} 문을 닫았어요.`;
  }else if(result==='printing'){
    toast(`3D 프린터가 ${schoolConfig.shortName} 잎사귀를 한 층씩 쌓아 올려요…`);school.setFocus(2.2);
    $('#guide-text').textContent='노즐이 녹인 재료를 얇게 짜내고, 판 위에 한 층씩 쌓아 모양을 만들어요.';
    window.setTimeout(()=>{school.setFocus(1);toast('출력 완료! 초록 잎사귀가 완성됐어요.');},6600);
  }else if(result==='busy'&&prop.action==='cabinet')toast('아직 출력 중이에요. 조금만 기다려 주세요.');
  else if(result==='microscope')showMicroscope(prop);
  else if(result==='photo')void takePhoto(prop);
  else if(result==='germ'){
    toast('깜짝이야! 배양기 속 꼬마 세균이 삼지창을 흔들며 튀어나왔어요.');
    $('#guide-text').textContent='실제 세균배양기는 일정한 온도로 미생물을 기르는 장비예요. 안의 세균은 눈에 보이지 않을 만큼 작아요.';
  }else if(result==='info'){toast(`${prop.name} · ${prop.description}`);$('#guide-text').textContent=prop.description;}
  else if(result==='game'){
    showDialog(prop.name,'<div id="minigame"></div>','입학설명회 미니게임');
    if(prop.game==='balloon')mountBalloonGame($('#minigame'));
    // Ask about rooms a new student would visit, not offices or service rooms.
    else mountQuizGame($('#minigame'),upperRooms.filter(room=>customRooms.has(room.id)||!['office','toilet'].includes(room.style)).map(room=>({name:room.name,floor:room.floor})));
  }
}
function showPlace(place:Place){
  if(place.id===gatePrincipal.id){interact(place);return;}
  selected=place;
  const canInteract=mode==='floor1'&&placeFloor(place)===currentFloor()&&onFloorLevel(school.player.position.y)&&distance(point(),place.approach)<=4.2;
  showDialog(place.name,`<span class="place-badge">${placeFloor(place)}층 · ${place.kind==='outdoor'?'야외 공간':'방문 장소'}</span><div id="room-guide"></div><div class="dialog-actions"><button id="go-place" class="primary">입구까지 길 안내 ${icon('arrow')}</button>${place.enterable&&canInteract?`<button id="toggle-place" class="secondary">${openDoors.has(place.id)?'문 닫기':'문 열기'}</button>`:''}</div>`);
  showRoomGuide($('#room-guide'),place.id);
  $('#go-place').onclick=()=>chooseDestination(place);
  if($('#toggle-place'))$('#toggle-place').onclick=()=>{dialog.close();interact(place);};
}
function renderDestinations(){
  const query=$<HTMLInputElement>('#place-search').value.trim();
  const filtered=(currentFloor()===1?destinations:upperRooms.filter(r=>r.floor===currentFloor())).filter(place=>place.name.includes(query));
  $('#destination-list').innerHTML=filtered.length?filtered.map(place=>`<div class="destination-row"><button data-destination="${place.id}"><span class="place-symbol">${icon(place.kind==='outdoor'?'leaf':'door')}</span><span><b>${escape(place.name)}</b><small>${place.kind==='outdoor'?'바깥 공간':`${placeFloor(place)}층`}</small></span><span class="row-arrow">↗</span></button><button data-details="${place.id}" class="detail-button" aria-label="${escape(place.name)} 설명 보기">ⓘ</button></div>`).join(''):'<p class="empty-search">일치하는 장소가 없어요.</p>';
  $('#destination-list').querySelectorAll<HTMLButtonElement>('[data-destination]').forEach(button=>button.onclick=()=>chooseDestination(allPlaces.find(place=>place.id===button.dataset.destination)!));
  $('#destination-list').querySelectorAll<HTMLButtonElement>('[data-details]').forEach(button=>button.onclick=()=>showPlace(allPlaces.find(place=>place.id===button.dataset.details)!));
}
function bindMapView(){
  const viewport=dialog.querySelector<HTMLElement>('.map-viewport')!,map=viewport.querySelector<HTMLElement>('.floor-map')!;
  let zoom=1,x=0,y=0,dragged=false;
  let drag:{id:number;startX:number;startY:number;x:number;y:number}|null=null;
  const pointers=new Map<number,{x:number;y:number}>();
  const pair=()=>{
    const [a,b]=[...pointers.values()];
    return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}:null;
  };
  let pinch:ReturnType<typeof pair>=null;
  refreshMap=()=>{
    const scale=Math.min(viewport.clientWidth/map.offsetWidth,viewport.clientHeight/map.offsetHeight,1)*zoom;
    const limitX=Math.max(0,(map.offsetWidth*scale-viewport.clientWidth)/2),limitY=Math.max(0,(map.offsetHeight*scale-viewport.clientHeight)/2);
    x=Math.max(-limitX,Math.min(limitX,x));y=Math.max(-limitY,Math.min(limitY,y));
    map.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale})`;
    viewport.classList.toggle('zoomed',zoom>1);
  };
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
    const next=Math.max(1,Math.min(6,zoom*Math.exp(-delta*.002))),ratio=next/zoom,rect=viewport.getBoundingClientRect();
    const anchorX=event.clientX-rect.left-rect.width/2,anchorY=event.clientY-rect.top-rect.height/2;
    x=anchorX+(x-anchorX)*ratio;y=anchorY+(y-anchorY)*ratio;zoom=next;refreshMap();
  },{passive:false});
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    if(!pointers.size)dragged=false;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2){
      dragged=true;drag=null;pinch=pair();
      for(const id of pointers.keys())viewport.setPointerCapture(id);
      return;
    }
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x,y};
  });
  viewport.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const nextPair=pair();
    if(pinch&&nextPair){
      const next=Math.max(1,Math.min(6,zoom*nextPair.distance/pinch.distance)),ratio=next/zoom;
      const rect=viewport.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      x=nextPair.x-cx+(x-(pinch.x-cx))*ratio;
      y=nextPair.y-cy+(y-(pinch.y-cy))*ratio;
      zoom=next;pinch=nextPair;refreshMap();return;
    }
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!dragged&&Math.hypot(dx,dy)<5)return;
    dragged=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');
    if(zoom>1){x=drag.x+dx;y=drag.y+dy;refreshMap();}
  });
  const endDrag=(event:PointerEvent)=>{
    if(!pointers.delete(event.pointerId))return;
    pinch=pair();drag=null;
    if(pointers.size===1){
      const [id,point]=[...pointers.entries()][0];
      drag={id,startX:point.x,startY:point.y,x,y};
    }
    if(!pointers.size)viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);
  viewport.addEventListener('lostpointercapture',event=>{if(event.target===viewport)endDrag(event);});
  viewport.addEventListener('click',event=>{
    if(dragged){event.preventDefault();event.stopPropagation();dragged=false;}
  },true);
  dialog.querySelector<HTMLButtonElement>('.map-fit')!.onclick=()=>{zoom=1;x=0;y=0;refreshMap();};
  refreshMap();mapResizeObserver.observe(viewport);
}
function showMap(floor=mapFloor){
  mapFloor=floor;
  const cells=mapCells(floor);
  const html=cells.map(cell=>{
    const name=cell.name.replace(/\n/g,'');const cls=/복도|통로|계단|현관|로비|출입구|엘리베이터홀/.test(name)?'passage':/화장실|창고|숙직|당직/.test(name)?'service':/필로티|농구장/.test(name)?'outdoor':'room';
    const style=`left:${(cell.col-1)/42*100}%;top:${(cell.row-1)/9*100}%;width:${cell.colSpan/42*100}%;height:${cell.rowSpan/9*100}%`;
    if(!name)return `<div class="map-empty ${cell.border?'bordered':''}" style="${style}"></div>`;
    return `<button class="map-cell ${cls}${cell.colSpan/42*960<65?' compact':''}${cell.rowSpan/9*960*planAspectRatios[1]<27||cell.colSpan/42*960<20?' narrow':''}" style="${style}" title="${escape(name)}" aria-label="${escape(name)}" data-room-name="${escape(name)}">${escape(cell.name).replace(/\n/g,'<br>')}</button>`;
  }).join('');
showDialog('층별 안내도',`<div class="floor-tabs" role="group" aria-label="안내도 층 선택">${[1,2,3,4,5].map(f=>`<button data-floor="${f}" aria-pressed="${f===floor}" class="${f===floor?'active':''}">${f}<span>층</span></button>`).join('')}</div><p class="map-instruction">가고 싶은 교실을 눌러보세요.<span>두 손가락 또는 마우스 휠로 확대·축소 · 끌어서 이동</span></p><div class="map-viewport" aria-label="${floor}층 교실 배치도"><div class="floor-map">${html}</div></div><div class="map-footer"><div class="map-legend" aria-label="공간 색상 안내"><span class="room">교실·특별실</span><span class="passage">복도·계단</span><span class="service">편의시설</span><span class="outdoor">야외</span></div><button class="map-fit" aria-label="안내도 전체 맞춤">전체 맞춤</button></div><div id="map-selection" role="status">같은 층의 교실은 입구까지 길을 안내해 드려요.</div><p class="source-note">건축 도면 치수 기준 · 현재 칸막이·문은 추정 · 실 이름: ${outbound(about.roomNames,'')}</p>`,`교실 바로가기 · ${schoolConfig.schoolName}`);
  dialog.classList.add('map-dialog');
  dialog.querySelector<HTMLElement>('.floor-map')!.style.height=`${960*planAspectRatios[1]}px`;
  bindMapView();
  dialog.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach(button=>button.onclick=()=>showMap(Number(button.dataset.floor)));
  dialog.querySelectorAll<HTMLButtonElement>('[data-room-name]').forEach(button=>button.onclick=()=>{
    const name=button.dataset.roomName!;
    const place=allPlaces.find(p=>placeFloor(p)===floor&&p.name===name);
    if(place){dialog.classList.remove('map-dialog');showPlace(place);}
    else $('#map-selection').textContent=`${floor}층 · ${name} — 이동키나 조이스틱으로 걸어 보세요.`;
  });
}
function showHelp(){
showDialog('천천히 둘러보는 방법',`<div class="help-grid"><article><b>PC에서</b><p>WASD 또는 방향키로 움직이고, 빈 바닥을 클릭하면 그곳으로 걸어가요. 가까운 문은 Space나 화면 아래 버튼으로 열고, 의자 옆에서 누르면 앉아요.</p></article><article><b>휴대폰·태블릿에서</b><p>왼쪽 아래 이동판을 원하는 방향으로 밀거나 바닥을 눌러요. 가까운 장소의 안내 표시를 눌러 문을 열 수 있어요.</p></article><article><b>목적지와 전체 보기</b><p>목적지를 고르면 입구까지 걸어가요. 이동키를 누르면 안내를 멈추고 직접 걸어요. ‘전체 보기’로 주변을 살펴볼 수 있어요.</p></article></div><div class="source-box"><b>자료와 표현 범위</b><p>${escape(about.note)}</p>${about.details.map(text=>`<p>${escape(text)}</p>`).join('')}<p>${about.links.map(link=>outbound(link)).join(' · ')}</p></div><p class="credits">${escape(about.credits)} · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · 제작: ${escape(about.maker)}${templateCredit.text.endsWith(about.maker)?'':` · ${outbound({label:templateCredit.text,url:templateCredit.url},'')}`}</p>`);
}

$('#start-tour').onclick=()=>start('floor1');$('#start-campus').onclick=()=>start('campus');
$('#mode-floor').onclick=()=>{if(mode!=='floor1')setMode('floor1');else setOverview(false);$('#school-stage').focus();};
$('#mode-campus').onclick=()=>{setMode('campus');$('#school-stage').focus();};
$('#overview').onclick=()=>{setOverview(!overview);$('#school-stage').focus();};
$('#map-button').onclick=()=>showMap(currentFloor());$('#mini-map').onclick=()=>showMap(currentFloor());$('#help-button').onclick=showHelp;
$('#course-button').onclick=showCourses;$('#start-course').onclick=showCourses;
$('#guestbook-button').onclick=()=>{
  showDialog('방명록','<div id="native-guestbook"></div>','함께 남긴 발자국');
  showGuestbook($('#native-guestbook'));
};
$('#dialog-close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{sound.duck(false);mapResizeObserver.disconnect();if(dialog.classList.contains('guestbook-dialog'))$('#dialog-content').replaceChildren();dialog.classList.remove('map-dialog','guestbook-dialog');clearInput();$('#school-stage').focus();});
$('#place-search').addEventListener('input',renderDestinations);
$('#collapse-destinations').onclick=()=>collapseDestinations(!$('#destinations').classList.contains('collapsed'));
$('#cancel-route').onclick=()=>{stopRoute();$('#guide-text').textContent='안내를 멈췄어요. 원하는 방향으로 자유롭게 걸어 보세요.';};
$('#nearby-action').onclick=()=>{runAction();$('#school-stage').focus();};
$('#place-info').onclick=()=>{const place=nearby??selected;if(place)showPlace(place);else showHelp();};
renderDestinations();
function renderMiniMap(floor:number){
  const miniRowScale=420*planAspectRatios[1]/9;
  $('#mini-map svg').setAttribute('viewBox',`0 0 420 ${420*planAspectRatios[1]+25}`);
  $('#mini-rooms').innerHTML=mapCells(floor).filter(cell=>cell.name).map(cell=>`<rect x="${(cell.col-1)*10}" y="${(cell.row-1)*miniRowScale}" width="${cell.colSpan*10}" height="${cell.rowSpan*miniRowScale}" rx="1" fill="${/통로|복도|현관|로비|출입구|홀/.test(cell.name)?'#f3e8cf':/필로티|농구장/.test(cell.name)?'#bad1b8':'#b9cfc4'}" stroke="#faf8ed" stroke-width="1"/>`).join('');
}
renderMiniMap(1);

async function init(){
  try{school=await createSchool($('#school-stage'));}
  catch{ $('#loading').innerHTML='<b>학교 모형을 불러오지 못했어요.</b><span>화면을 새로고침해 다시 열어 주세요.</span><button id="reload-school" class="primary">다시 열기</button>';$('#reload-school').onclick=()=>location.reload();return; }
  const fitCamera=()=>school.setFollowScale(compactLandscape.matches?.6:1);
  compactLandscape.addEventListener('change',fitCamera);fitCamera();
  school.setMode('campus');school.setOverview(true);school.player.position.set(campusSpawn.x,0,campusSpawn.z);
  $('#loading').hidden=true;$('#welcome').hidden=false;
  const enabled=()=>started&&!dialog.open&&!document.hidden;
  const controlsEnabled=()=>enabled()&&!stairTrip;
  bindGameKeyboard(window,{enabled:controlsEnabled,move:(key,pressed)=>{
    if(!pressed){held.delete(key);return;}
    (document.activeElement as HTMLElement)?.closest<HTMLButtonElement>('button')?.blur();held.add(key);stopRoute();if(overview)setOverview(false);
  },interact:()=>{
    if(mode==='floor1'&&nearbyStair({...point(),y:school.player.position.y})){$<HTMLButtonElement>('#stair-actions button')?.focus();return;}
    runAction();
  }});
  window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
  const stick=$('#joystick');let stickPointer:number|null=null;
  const updateStick=(event:PointerEvent)=>{const rect=stick.getBoundingClientRect();const x=(event.clientX-rect.left-rect.width/2)/38,y=(event.clientY-rect.top-rect.height/2)/38;const norm=Math.max(1,Math.hypot(x,y));joystick.x=x/norm;joystick.y=y/norm;$('#stick-thumb').style.transform=`translate(${joystick.x*32}px,${joystick.y*32}px)`;};
  stick.addEventListener('pointerdown',event=>{if(!controlsEnabled()||stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;stick.setPointerCapture(event.pointerId);stopRoute();setOverview(false);updateStick(event);});
  stick.addEventListener('pointermove',event=>{if(event.pointerId===stickPointer)updateStick(event);});
  const releaseStick=()=>{stickPointer=null;joystick.x=joystick.y=0;$('#stick-thumb').style.transform='translate(0,0)';};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,releaseStick);
  window.addEventListener('blur',releaseStick);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseStick();});
  let down:(Point&{id:number})|null=null,pinching=false,pinchDistance=0;
  const touches=new Map<number,Point>();
  const touchDistance=()=>{const [a,b]=[...touches.values()];return a&&b?distance(a,b):0;};
  const resetGesture=()=>{down=null;touches.clear();pinching=false;pinchDistance=0;};
  const canvas=school.renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
    if(!enabled()||event.button!==0)return;
    if(event.pointerType==='touch') {
      touches.set(event.pointerId,{x:event.clientX,z:event.clientY});canvas.setPointerCapture(event.pointerId);
      if(touches.size>=2){pinching=true;pinchDistance=touchDistance();down=null;stopRoute();clearInput();return;}
    }
    if(!pinching)down={id:event.pointerId,x:event.clientX,z:event.clientY};
  });
  canvas.addEventListener('pointermove',event=>{
    if(!touches.has(event.pointerId))return;
    touches.set(event.pointerId,{x:event.clientX,z:event.clientY});
    const next=touchDistance();
    if(enabled()&&pinching&&next>0&&pinchDistance>0)school.zoomBy(next/pinchDistance);
    pinchDistance=next;
  });
  const releaseTouch=(event:PointerEvent)=>{touches.delete(event.pointerId);pinchDistance=touchDistance();if(!touches.size)pinching=false;};
  for(const name of ['pointercancel','lostpointercapture'] as const)canvas.addEventListener(name,event=>{down=null;releaseTouch(event);});
  window.addEventListener('blur',resetGesture);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetGesture();});
  canvas.addEventListener('pointerup',event=>{
    const wasPinching=pinching;releaseTouch(event);
    const origin=down;down=null;if(wasPinching||!origin||origin.id!==event.pointerId||!controlsEnabled()||Math.hypot(origin.x-event.clientX,origin.z-event.clientY)>8)return;
    if(seated){standUp();return;}
    if(exercise){stopExercise();return;}
    const hit=school.pick(event.clientX,event.clientY);$('#school-stage').focus();
    if(mode==='floor1'&&onStairs()){toast('계단은 WASD 또는 조이스틱으로 직접 오르내려 주세요.');return;}
    if(hit.propId){
      const prop=upperProps.find(p=>p.id===hit.propId)!;
      if(distance(point(),prop.spot)<=propReach){useProp(prop);return;}
      const path=findSchoolPath(point(),prop.spot,mode,openDoors,currentFloor());
      if(path.length){stopRoute();walkingPath=path;school.setRoute(path);setOverview(false);$('#guide-text').textContent=`${prop.name} 앞으로 걸어가요. 도착하면 한 번 더 누르거나 Space를 눌러 보세요.`;return;}
    }
    if(hit.placeId){const place=allPlaces.find(p=>p.id===hit.placeId);if(place){if(distance(point(),interactionPoint(place))<=interactionRadius(place))interact(place);else if(mode==='floor1')chooseDestination(place);else toast('실내 산책에서 이 장소를 찾아갈 수 있어요.');return;}}
    if(!hit.point||!isWalkable(hit.point,mode,openDoors,currentFloor())){toast('빈 바닥이나 복도를 눌러 이동해 주세요.');return;}
    const path=findSchoolPath(point(),hit.point,mode,openDoors,currentFloor());if(!path.length)return;stopRoute();walkingPath=path;school.setRoute(path);setOverview(false);
  });
  let last=performance.now(),elapsed=0,uiClock=0;
  function frame(now:number){
    const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;uiClock+=dt;
    const before=point();
    if(enabled()&&!pinching){
      const ix=joystick.x+(held.has('d')||held.has('ArrowRight')?1:0)-(held.has('a')||held.has('ArrowLeft')?1:0);
      const iy=joystick.y+(held.has('s')||held.has('ArrowDown')?1:0)-(held.has('w')||held.has('ArrowUp')?1:0);
      if(stairTrip){
        const trip=stairTrip,step=advanceStairRoute({...point(),y:school.player.position.y},trip.path,dt*3.2,openDoors);
        school.player.position.set(step.position.x,step.position.y,step.position.z);trip.path.splice(0,step.consumed);
        if(step.blocked){stairTrip=null;toast('계단 이동이 멈췄어요. 주변을 확인해 주세요.');}
        else if(!trip.path.length){stairTrip=null;toast(`${trip.floor}층에 도착했어요.`);if(trip.resumeTour)navigateTourStop();}
      }else if(exercise){
        if(Math.hypot(ix,iy)>.08)stopExercise();else exerciseTick(dt);
      }else if(seated){
        if(Math.hypot(ix,iy)>.08)standUp();
      }else if(Math.hypot(ix,iy)>.08){
        const direction=schoolInputDirection(ix,iy);
        const next=moveSchoolVisitor({...before,y:school.player.position.y},{x:direction.x*dt*5.2,z:direction.z*dt*5.2},mode,openDoors);school.player.position.set(next.x,next.y,next.z);
      }else if(walkingPath.length){
        const floor=currentFloor(),step=advanceSchoolRoute(point(),walkingPath,dt*6,mode,openDoors,floor);
        school.player.position.set(step.position.x,mode==='floor1'?(floor>1?(floor-1)*floorRise:groundHeight(step.position)):campusHeight(step.position),step.position.z);walkingPath.splice(0,step.consumed);
        if(step.blocked){stopRoute();toast('문이나 가구 앞에서 멈췄어요. 주변을 확인해 주세요.');}
        if(!walkingPath.length){school.setRoute([]);if(routeGoal){toast(`${routeGoal.name} 입구에 도착했어요.`);$('#guide-text').textContent=routeGoal.id.startsWith('stairs-')?`${routeGoal.name}에 도착했어요. 올라가기 또는 내려가기 버튼으로 층을 선택해 주세요.`:`${routeGoal.name}에 도착했어요. 가까운 안내 표시나 Space를 눌러 보세요.`;routeGoal=null;$('#route-card').hidden=true;}}
      }
    }
    const after=point(),moving=distance(before,after)>.0001;
    if(moving&&Math.abs(school.player.position.y)<.15)for(const door of portals.filter(p=>p.id.endsWith('parking-door')||p.id==='court-door'||p.id==='dining-exit')) {
      if(!openDoors.has(door.id)||Math.abs(after.z-door.center)>door.width/2)continue;
      const insideSign=door.id.startsWith('north-')?-1:1;
      const wasInside=(before.x-door.at)*insideSign>0,isInside=(after.x-door.at)*insideSign>0;
      if(wasInside!==isInside&&((mode==='campus'&&isInside)||(mode==='floor1'&&!isInside))){
        const remaining=walkingPath,goal=routeGoal,resume=afterPortal;
        setMode(isInside?'floor1':'campus',true);school.player.position.set(after.x,0,after.z);setOverview(false);
        walkingPath=remaining;routeGoal=goal;afterPortal=resume;school.setRoute(remaining);
        if(remaining.length){$('#route-card').hidden=false;$('#route-status').textContent=`${goal?.name??'목적지'} 입구로 이동 중`;}
        $('#guide-text').textContent=door.id==='dining-exit'?(isInside?'급식실에 들어왔어요. 가운데 통로를 따라 반대편 북쪽 복도로 나갈 수 있어요.':'급식실 바깥 계단에 나왔어요. 계단을 내려가 건물 옆길과 농구장으로 걸어가 보세요.'):isInside?'출입문을 통해 복도로 들어왔어요.':door.id==='court-door'?'계단을 따라 농구장으로 내려가 보세요.':'필로티 주차장에 나왔어요. 매점과 분리수거장·텃밭을 둘러보거나 북측 문까지 걸어가 보세요.';
        break;
      }
    }
    if(moving){const angle=Math.atan2(after.x-before.x,after.z-before.z);school.player.rotation.y+=Math.atan2(Math.sin(angle-school.player.rotation.y),Math.cos(angle-school.player.rotation.y))*Math.min(1,dt*12);}
    school.tick(dt,elapsed,moving);
    if(uiClock>.08){
      uiClock=0;updateHUD();
      if(enabled()&&!stairTrip&&tour&&!tour.arrived&&reachedTourStop(tour.course.stops[tour.index],school.player.position,mode)){tour.arrived=true;showTourStop();}
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/** Where the 3D cue marker floats for the current action; nothing while sitting or exercising. */
function cueTarget(current:Action|null){
  if(!current||dialog.open||stairTrip)return undefined;
  const base=school.player.position.y;
  if(current.kind==='prop')return {x:current.prop.x,y:base+2.1,z:current.prop.z};
  if(current.kind==='seat')return {x:current.seat.x,y:current.seat.y+1,z:current.seat.z};
  if(current.kind==='greet')return {x:current.greeter.x,y:base+2.05,z:current.greeter.z};
  if(current.kind==='shoot')return {x:current.hoop.x,y:current.hoop.y+.75,z:current.hoop.z};
  if(current.kind==='place'){const at=current.place.id===gatePrincipal.id?current.place.approach:current.place.door;return {x:at.x,y:base+2.3,z:at.z};}
  return undefined;
}
function propVerb(prop:UpperProp){
  if(prop.action==='cabinet')return ({closed:'문 열기',open:'3D 프린터 출력',printing:'출력 중…',printed:'문 닫기'} as const)[school.propStage(prop.id)];
  return ({germ:'살짝 열어 보기',game:'게임 하기',exercise:prop.exercise==='run'?'달리기':'운동하기',microscope:'들여다보기',photo:'기념사진 찍기',info:'설명 보기'} as const)[prop.action];
}
function updateHUD(){
  if(!started)return;
  const position=point();
  const floor=currentFloor();
  if(hudFloor!==floor){hudFloor=floor;renderDestinations();renderMiniMap(floor);$('#mode-floor').textContent=`${floor}층 산책`;}
  const candidates=allPlaces.filter(place=>place.id===gatePrincipal.id?canTalkToPrincipal(school.player.position,mode):mode==='campus'?canInteractFromCampus(place.id,position):placeFloor(place)===floor&&onFloorLevel(school.player.position.y)&&(isEntrance(place)||!/복도|통로|계단/.test(place.name))).sort((a,b)=>Number(hasDoor(b))-Number(hasDoor(a)));
  nearby=candidates.reduce<Place|null>((best,place)=>distance(position,interactionPoint(place))<interactionRadius(place)&&(!best||distance(position,interactionPoint(place))<distance(position,interactionPoint(best)))?place:best,null);
  const stair=mode==='floor1'&&!stairTrip&&!dialog.open?nearbyStair({...position,y:school.player.position.y}):undefined;
  const stairActions=$('#stair-actions');stairActions.hidden=!stair;
  const stairKey=stair?`${stair.id}:${floor}`:'';
  if(stairActions.dataset.key!==stairKey){
    stairActions.dataset.key=stairKey;stairActions.replaceChildren();
    if(stair){
      const label=document.createElement('strong');label.textContent=stair.name;stairActions.append(label);
      for(const target of [floor-1,floor+1].filter(n=>n>=1&&n<=5)){
        const action=document.createElement('button');action.className='secondary';action.textContent=`${target}층 ${target>floor?'올라가기':'내려가기'}`;
        action.onclick=()=>beginStair(stair,target);stairActions.append(action);
      }
    }
  }
  if(mode==='floor1'&&floor===1)for(const id of autoDoors) {
    const door=places.find(p=>p.id===id)!.door,near=distance(position,door);
    if(near<1.7&&!openDoors.has(id)){openDoors.add(id);school.openDoor(id,true);}
    else if(near>2.4&&openDoors.has(id)){openDoors.delete(id);school.openDoor(id,false);}
  }
  const onFloor=mode==='floor1'&&onFloorLevel(school.player.position.y);
  const prop=onFloor?upperProps.filter(p=>p.floor===floor&&distance(position,p.spot)<propReach).sort((a,b)=>distance(position,a.spot)-distance(position,b.spot))[0]:undefined;
  const seat=onFloor&&!seated?school.seats.filter(s=>s.floor===floor&&distance(position,s)<seatReach).sort((a,b)=>distance(position,a)-distance(position,b))[0]:undefined;
  const hoop=!seated&&!exercise?nearbyHoop():undefined;
  const greeter=onFloor&&!seated&&!exercise?nearbyGreeter(position,floor):undefined;
  action=exercise?{kind:'stop'}:seated?(seated.seat.model==='upright-piano'?{kind:'piano'}:{kind:'stand'}):greeter?{kind:'greet',greeter}:prop&&(!seat||distance(position,prop.spot)<=distance(position,seat))?{kind:'prop',prop}:seat?{kind:'seat',seat}:hoop?{kind:'shoot',hoop}:nearby?{kind:'place',place:nearby}:null;
  const button=$<HTMLButtonElement>('#nearby-action');
  // In compact landscape the action button stays in place on the right, dimmed when nothing is near.
  const always=compactLandscape.matches&&!(mode==='campus'&&overview);
  button.hidden=(!action&&!always)||!!stair||!!stairTrip||dialog.open||(mode==='campus'&&overview);
  button.disabled=!action;
  school.setCue(button.hidden?undefined:cueTarget(action));
  const [label,verb]=!action?['상호작용','가까이 가 보세요']:action.kind==='stand'?['의자','일어나기']:action.kind==='seat'?['의자','앉기']
    :action.kind==='stop'?[exercise!.prop.name,'그만하기']:action.kind==='greet'?[action.greeter.name,'인사 나누기']:action.kind==='piano'?['피아노','연주하기']:action.kind==='shoot'?['농구 골대','자유투 던지기']
    :action.kind==='prop'?[action.prop.name,propVerb(action.prop)]
    :[action.place.name,action.place.id===gatePrincipal.id?'인사 나누기':isEntrance(action.place)?(mode==='campus'?'1층으로 들어가기':'건물 앞으로 나가기'):autoDoors.has(action.place.id)?'자동문 · 다가가면 열려요':hasDoor(action.place)?(openDoors.has(action.place.id)?'문 닫기':'문 열기'):'공간 안내'];
  const key=`${label}:${verb}`;
  // The button stays fixed above the guide; only its words follow the nearest target.
  if(button.dataset.key!==key){
    // Replay the pop each time a new target becomes usable.
    if(action){button.classList.remove('pop');void button.offsetWidth;button.classList.add('pop');}
    button.dataset.key=key;button.innerHTML=`<span class="pin-dot">${icon(action?.kind==='place'&&hasDoor(action.place)?'door':'pin')}</span><span>${escape(label)}<small>${verb}</small></span><kbd>Space</kbd>`;}
  const mini=$('#mini-player'),miniScale=420/(schoolBounds.maxX-schoolBounds.minX);mini.setAttribute('transform',`translate(${(position.x-schoolBounds.minX)*miniScale} ${(position.z-schoolBounds.minZ)*miniScale})`);
  if(mode==='floor1'){
    const support=stairSupport(position,school.player.position.y),floor=Math.min(5,Math.floor((school.player.position.y+.1)/floorRise)+1);
    $('#location-chip').textContent=support?`${Math.max(1,floor)}층 ${support.kind==='flight'?'이동 중':'계단참'} · ${stairs.find(s=>s.id===support.stairId)!.name}`:school.player.position.y<-.15?'농구장 · 내려가는 길':`${currentFloor()}층 · ${nearby?.name??'복도를 산책 중'}`;
    if(exercise)$('#location-chip').textContent=exerciseLabel();
  }else $('#location-chip').textContent=position.x<-34.5&&position.z<-3.95?'학교 바깥 · 급식실 옆길':school.player.position.y<-.15?(position.z<20?'학교 바깥 · 농구장 연결길':'학교 바깥 · 운동장'):position.z<(position.x>4.5?15.75:20.25)?(position.x<4.5?'학교 바깥 · 건물 옆길':'학교 바깥 · 필로티 주차장'):position.x>45?'학교 바깥 · 교문 앞':'학교 바깥 · 건물 앞길';
}
void init();
