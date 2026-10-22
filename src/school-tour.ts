import {places,type Point,type TourMode} from './school-layout.ts';
import {campusEntrancePoint} from './school-outdoors.ts';
import {upperRooms} from './school-upper-floors.ts';
import {floorRise} from './school-structure.ts';

export type TourStop={placeId:string;mode:TourMode;floor?:number;title:string;description:string};
export type TourCourse={id:string;name:string;intro:string;stops:TourStop[]};
const entrance:TourStop={placeId:'entrance',mode:'campus',title:'학교 안으로 첫걸음',description:'중앙현관에 도착했어요. 이곳으로 들어가면 1층 중앙로비와 양쪽 복도로 이어집니다. 다음 버튼을 눌러 함께 들어가 볼까요?'};
const library:TourStop={placeId:'library',mode:'floor1',title:'책과 만나는 도서관',description:'도서관 입구예요. 복도에서 문을 열고 안쪽을 둘러볼 수 있어요. 학교에서 조용히 책을 읽고 싶은 날, 이 위치를 기억해 두세요.'};
export const tourCourses:TourCourse[]=[
  {id:'student',name:'신입생 코스',intro:'처음 오는 학교에서 자주 찾게 될 공간을 만나 보세요.',stops:[
    entrance,
    {placeId:'open-library',mode:'floor1',title:'잠깐 쉬어 가는 열린도서관',description:'중앙로비에서 동쪽으로 오면 열린도서관이 있어요. 도서관과 가까이 있는 공간이니 두 장소의 위치를 함께 기억해 보세요.'},
    library,
    {placeId:'dining',mode:'floor1',title:'점심시간에 찾아올 급식실',description:'북쪽 통로를 따라 급식실 입구까지 왔어요. 중앙로비에서 이곳까지 이어지는 길을 기억하면 처음 찾아올 때 도움이 됩니다.'},
    {placeId:'shop',mode:'campus',title:'쉬는 시간에 생각나는 매점',description:'매점에 도착했어요! 급식실 옆 북편 주차장 출입문을 통해 이곳으로 올 수 있어요. 친구들과 찾게 될 매점의 위치도 기억해 두세요.'},
    {placeId:'stairs-central',mode:'floor1',title:'위층으로 이어지는 중앙계단',description:'중앙계단에 도착했어요. 계단 앞의 올라가기 버튼을 누르면 자동으로 걸어 올라가요. 오늘의 짧은 코스는 여기까지, 이후에는 2~5층도 자유롭게 둘러보세요.'},
  ]},
  {id:'parent',name:'학부모 코스',intro:'학교를 방문할 때 알아 두면 좋은 장소를 둘러보세요.',stops:[
    entrance,
    {placeId:'admin',mode:'floor1',title:'학교 업무를 안내하는 행정실',description:'중앙로비에서 서쪽 복도를 따라오면 행정실이 있어요. 실제 방문 시에는 방문 목적과 담당 부서를 학교에 먼저 확인해 주세요.'},
    {placeId:'principal',mode:'floor1',title:'교장실이 있는 복도',description:'행정실과 같은 복도에 교장실이 있어요. 게임에서는 문을 열고 교장선생님이 계신 공간도 둘러볼 수 있어요.'},
    library,
    {placeId:'entrance',mode:'floor1',title:'다시 중앙로비에서',description:'학교의 중심인 중앙로비로 돌아왔어요. 안내도에서 다른 층의 장소를 확인하거나, 계단을 따라 자유롭게 탐방을 이어가 보세요.'},
  ]},
  {id:'songcheon',name:'송천홀(시청각실) 찾아가기',intro:'중앙현관에서 북편 계단을 지나 2층 송천홀까지 함께 걸어요.',stops:[
    entrance,
    {placeId:'stairs-north',mode:'floor1',title:'송천홀로 이어지는 북편 계단',description:'급식실 입구 옆 북편 계단이에요. 다음 장소로 버튼을 누르면 계단을 따라 자동으로 2층에 올라간 뒤 송천홀 입구로 안내해요.'},
    {placeId:upperRooms.find(room=>room.floor===2&&room.name.includes('송천홀'))!.id,mode:'floor1',floor:2,title:'송천홀(시청각실)에 도착했어요',description:'2층 송천홀 입구예요. 북편 계단에서 올라와 이어지는 통로를 기억해 두세요. 문을 열고 홀 안쪽도 둘러볼 수 있어요.'},
  ]},
];

export function tourStopPoint(stop:TourStop):Point {
  return stop.mode==='campus'&&stop.placeId==='entrance'?campusEntrancePoint(stop.placeId):[...places,...upperRooms].find(place=>place.id===stop.placeId)!.approach;
}
export function reachedTourStop(stop:TourStop,position:Point&{y:number},mode:TourMode):boolean {
  const target=tourStopPoint(stop);
  return mode===stop.mode&&Math.abs(position.y-((stop.floor??1)-1)*floorRise)<.15&&Math.hypot(position.x-target.x,position.z-target.z)<.65;
}
