// Rows of the '공간 안내' sheet tab, read from the site's places.
// npm run room-rows            → JSON for setupRoomGuide_ in assets/school-guestbook.gs
// npm run room-rows -- --tsv   → ID·층·장소명 columns to paste at A2 of the tab
import {places} from '../src/school-layout.ts';
import {upperRooms} from '../src/school-upper-floors.ts';

export const roomGuideRows=()=>[...places.map(place=>({...place,floor:1})),...upperRooms]
  .map(place=>[place.id,place.floor,place.name.replace(/\n/g,''),'',false] as const);

if(import.meta.main)console.log(process.argv.includes('--tsv')
  ?roomGuideRows().map(([id,floor,name])=>`${id}\t${floor}\t${name}`).join('\n')
  :JSON.stringify(roomGuideRows()));
