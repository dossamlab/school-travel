# School Tour Implementation Plan

## 2026-10-15 Walls, exits and vertical walking

The latest scope includes semitransparent collision walls, four operable glass portals, a ten-riser court descent and west/north/east switchback stairs through the fifth-floor landings. Upper-floor rooms remain unbuilt; old flat-stair assumptions below describe the original prototype only. `src/school-structure.ts` shares geometry between rendering and movement. See `SCHOOL_METRIC_PLAN.md` for provisional heights and inferred placements. The school character keeps its rig and receives a 2048-pixel warm-color atlas with mip bleeding disabled; its original source remains untouched.

## 2026-10-15 Metric calibration

The walkable first floor now uses A-202 dimensions from the newly supplied architectural PDF: width 81m, depth 55.8m, main corridors 2.7m, south room depth 7.5m, player height 1.70m. Current subdivisions remain inferred. See SCHOOL_METRIC_PLAN.md. The coordinate contract below describes the original prototype; floors 2–5 and the exterior GLB retain their schematic data. No exterior rescaling is implied.

> **For agentic workers:** Use subagent-driven-development for the independent tasks below. The current `school-tour` branch is the user-requested workspace. Do not create another worktree or change branches.

**Goal:** 현재 청학고 배치와 과거 면적을 구분하여, 1층을 직접 걷고 목적지 안내를 받을 수 있는 학교 탐방 견본을 만든다.

**Architecture:** PDF 형태를 옮긴 1~5층 공간 데이터에 웹 안내도의 현행 실명을 대응하고 학교용 이동 계산을 분리한다. Three.js 학교 장면에서 기존 주인공 모형과 걷기 동작을 재사용하고, 학교 전용 진입 화면이 지도·이동·문·안내를 연결한다.

**Tech Stack:** Existing Three.js, TypeScript, Vite, Node test runner. No new dependencies or external runtime services.

## Global Constraints

- `school-tour` branch only. Existing game source and assets remain available; do not deploy or merge to main.
- Latest room names come from `src/school-floor-data.ts`, captured from https://dasancamp.netlify.app/ on 2026-10-14. Its transformed grid is not physical geometry authority.
- The 2023 PDF is the shape and relative-position authority; `src/school-plan-data.ts` supplies geometry to navigation, maps, scenes and Blender. The user places current 1F storage beside the women's toilet. See `SCHOOL_PLAN_MAPPING.md` for uncertain subdivisions. PDF areas remain historical references. Do not commit or serve the source PDF or KakaoTalkChats.txt.
- Floor 1 is walkable. Floors 2–5 are overview/map information only. Field videos and the annotated photo supplied on 2026-10-15 take priority for confirmed 1F names and connections: dining room west of the north passage, elevator alcove opposite the open library, piloti parking below the shop, recycling and garden outside. Their precise boundaries remain schematic; do not invent unobserved facilities or assert an exact campus boundary. Campus walking remains on the front apron, with a separate east-side overview.
- Public UI explains that door locations, heights, furniture and dimensions are schematic. Old areas are labeled 2023 reference, not current measurements.
- Reuse the existing warm ivory/mint/wood visual language and public/player.glb; no paid generation.

## Shared interfaces

```ts
export type Point={x:number;z:number};
export type TourMode='campus'|'floor1';
export type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
export type Place={id:string;name:string;rect:Rect;kind:'room'|'outdoor'|'service';door:Point;approach:Point;enterable:boolean;area?:number;areaNote?:string;description:string};
export type Furnishing={roomId:string;kind:'desk'|'shelf'|'bench';rect:Rect};
```

Coordinates use `x=(col-1)*1.875-39.375`, `z=(row-1)*4.5-20.25`. One unit is a reference metre, inferred from a 4-column × 2-row office and its old 67.5㎡ area. This is not a surveyed scale. The grid is 42 columns; the first-floor occupied map ends at row 9. North is negative z.

`school-layout.ts` exports the types above, `cellRect(cell):Rect`, `places:Place[]`, `furnishings:Furnishing[]`, `schoolBounds:Rect`, `floorSpawn:Point`, `campusSpawn:Point`. Use stable IDs `individual`, `principal`, `admin`, `open-library`, `library`, `shop`, `garden`, `basketball`, `entrance`, `west-entrance`, `east-passage`, and service IDs as needed. Names match the website after removing newlines. Six rooms are enterable: individual, principal, admin, open-library, library, shop. Main five south rooms have north-facing doors. Shop has a south-facing door. Services are labeled from outside; never furnish a toilet as an office. The main entrance is a transition, not an enclosed room.

`school-navigation.ts` exports `isWalkable(point,mode,openDoors)`, `moveInSchool(start,delta,mode,openDoors)` and `findSchoolPath(start,goal,mode,openDoors)`. Doors are a `ReadonlySet<string>`. Furniture and walls are collision obstacles; rooms can be entered only through an open door gap. The same geometry constrains keyboard movement and route finding. Invalid or unreachable destinations return an empty path without teleporting.

## Task 1: Current layout, area provenance and navigation

**Ownership:** `src/school-layout.ts`, `src/school-navigation.ts`, `tests/school-navigation.test.ts`.

- [x] Write failing tests before implementation: central entrance to every named destination approach; closed room cannot be crossed; opening its door enables a continuous route to its interior; no diagonal wall corner cutting; furniture is solid; NaN/outside/unreachable target does not teleport; all route segments remain walkable. Check all five source floors are preserved.
- [x] Implement stable places from current grid cells. Use old areas only with explicit provenance: principal 67.5, admin 67.5, library 135, open-library 101.25 (old footprint differs), shop 86.43 (old footprint differs). Individual support room replaces two old 33.75 spaces; do not claim a current measured area. No area for garden/basketball without a source.
- [x] Implement bounded collision and path finding with a shared clearance radius and wall openings. Distinguish campus (front approach/outside) and floor1. Ensure the entrance and front apron connect safely.
- [x] Run `node --test tests/school-navigation.test.ts` and `npm run check`. Report exact test results and any source ambiguity. Commit only owned files after checks; do not stage source inputs or unrelated files.

## Task 2: Cozy 3D school scene

**Ownership:** `src/school-scene.ts` only.

```ts
export async function createSchool(host:HTMLElement) {
  // Return these members with working implementations:
  // renderer:THREE.WebGLRenderer, scene:THREE.Scene,
  // camera:THREE.OrthographicCamera, player:THREE.Group,
  // setMode(mode:TourMode):void, setOverview(on:boolean):void,
  // openDoor(id:string,open:boolean):void, setRoute(points:Point[]):void,
  // pick(x:number,y:number):{point?:Point;placeId?:string},
  // project(point:Point,height?:number):{x:number;y:number;visible:boolean},
  // tick(dt:number,time:number,moving:boolean):void.
}
```

- [x] Build first-floor cutaway walls with matching gaps, wooden door leaves animated at their hinges, warm floors, signs, windows and simple furnishings. Geometry must match the layout/navigation data. Keep the player visible by cutting away camera-facing walls; never hide the whole room floor.
- [x] Build a whole-building overview from the known five floors and current footprints, with garden and basketball court in their mapped positions. Treat unlabeled cells as unspecified, not named new facilities. A front apron is schematic context, not a claimed school gate.
- [x] Reuse GLTFLoader and `createPlayerMotion` from the existing game, soft shadows, rounded trim, wood/mint palette, contact shadow. Follow camera must keep the character large enough to operate. Provide full overview and a follow view.
- [x] Implement ray picking, projection, route marks, smooth door targets. Batch repeated static meshes/materials where practical. Handle resize and cap pixel ratio for mobile.
- [x] Run `npm run check`; report scene limitations and commit only the owned file. Browser verification is performed in Task 3.

## Task 3: Visitor UI, integration and verification

**Ownership:** Controller handles `src/school-main.ts`, `src/school-style.css`, `index.html`, `SCHOOL_TOUR_DESIGN.md`, `SCHOOL_TOUR_VERIFICATION.md`, and integration fixes after worker handoff.

- [x] Build a full-screen Korean welcome flow, compact header, destination selector, nearby-only interaction button, mini-map, source note and keyboard/touch guidance. Native dialog is dismissible with Escape and has clear close control. Use no personal-data collection or external calls.
- [x] Use the scene/navigation contracts for continuous WASD, click-to-walk, screen joystick, Space interaction, proximity labels, door toggle and destination route. Clicking a UI control must not break subsequent WASD; dialogs clear movement keys; pointer cancel releases the joystick.
- [x] Show all five floors using the captured grid exactly. Show 2023 area provenance in place details. A destination guide may finish outside a closed room; opening its door then permits entering. Indoor/outdoor entry and return must preserve safe spawn positions.
- [x] Switch only this branch's `index.html` entry to school-main. Keep the original lab modules intact and run the original regression suite too.
- [x] Run `npm run check`, `npm test`, `npm run build`. Inspect desktop and phone-size browsers, actual movement after clicking, door passage, map scrolling, all destination routes, close/reopen dialogs and source notes. Record observed results without claiming physical-device performance.
- [x] Review full branch diff for unrelated changes, debug logs, source inputs and private data. Commit the school work only. Open local preview; do not publish until requested.

## Progress

- Source capture complete: 170 grid cells across floors 1–5; existing 40 tests pass before implementation.
- Task 1: complete; 19 school tests pass. Continuous clearance and exact route endpoint consumption replace the initial sampled collision/near-point skipping. Independent re-review passed.
- Task 2: complete; exterior references added the front field and east gate context. Browser checks caught and fixed geometry indexing and corridor wall occlusion.
- Task 3: complete; all 59 tests and production build pass. Desktop/phone viewport checks cover movement, touch cancellation, doors, maps and source notes. See SCHOOL_TOUR_VERIFICATION.md. Parent consolidates commits on school-tour; no main merge or deployment.
