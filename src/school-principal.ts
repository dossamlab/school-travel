import {schoolResidents,places,type Place,type Point,type TourMode} from './school-layout.ts';
import {upperResidents,upperRooms} from './school-upper-floors.ts';

const resident=schoolResidents.find(person=>person.roomId==='gate-welcome')!;
export const principalTalkRadius=5.5;
export const gatePrincipal:Place={id:'gate-principal',name:'교장선생님',kind:'service',enterable:false,
  rect:{minX:resident.x-.35,maxX:resident.x+.35,minZ:resident.z-.4,maxZ:resident.z+.5},
  door:{x:resident.x,z:resident.z},approach:{x:resident.x,z:resident.z},description:'환영 인사와 학교 이야기를 들려드려요.'};
export function canTalkToPrincipal(position:Point&{y:number},mode:TourMode):boolean {
  return mode==='campus'&&Math.abs(position.y)<.15&&Math.hypot(position.x-resident.x,position.z-resident.z)<principalTalkRadius;
}

/** Teachers standing inside the building who greet a visitor walking up to them. */
export type Greeter={id:'principal-office'|'vice-principal';name:string;floor:number;x:number;z:number;room:Place};
const office=schoolResidents.find(person=>person.roomId==='principal')!,vice=upperResidents[0]!;
export const indoorGreeters:Greeter[]=[
  {id:'principal-office',name:'교장선생님',floor:1,x:office.x,z:office.z,room:places.find(place=>place.id==='principal')!},
  {id:'vice-principal',name:'교감선생님',floor:2,x:vice.x,z:vice.z,room:upperRooms.find(room=>room.id===vice.roomId)!},
];
export const greetRadius=2.2;
/** The teacher close enough to greet on this floor, if any. */
export function nearbyGreeter(position:Point,floor:number):Greeter|undefined {
  return indoorGreeters.find(greeter=>greeter.floor===floor&&Math.hypot(position.x-greeter.x,position.z-greeter.z)<greetRadius);
}
