# 학교 여행 (school-travel)

**교문부터 걸어 들어가 보는 3D 학교 여행 웹사이트 견본**입니다. 신입생·학부모·전학생이 학교에 오기 전에 휴대폰이나 PC 브라우저로 교문에서 현관, 교실, 특별실, 급식실까지 직접 걸어 보며 길을 익힙니다. 설치나 로그인이 필요 없습니다.

이 저장소는 청학고등학교의 [청학 여행](https://ch-travel.vercel.app/)을 다른 학교 선생님들이 **우리 학교의 항공사진·로드뷰·배치도·설계 도면으로 바꿔 쓸 수 있게** 정리한 것입니다. 청학고가 들어 있는 상태 그대로 돌아가는 견본이며, Claude Code·Codex 같은 AI 코딩 도구로 단계별로 바꿔 나갑니다.

## 무엇을 할 수 있나

- 교문에서 출발해 현관으로 들어가고, 계단으로 1~5층의 복도와 교실을 걷습니다. 문을 열고 들어가 의자에 앉을 수 있습니다.
- 층별 안내도에서 교실을 누르면 입구까지 길을 안내합니다. `신입생 코스`·`학부모 코스`처럼 순서대로 둘러보는 추천 코스가 있습니다.
- 교문과 교장실의 교장선생님에게 인사하면 Google 시트에서 고친 학교 소개가 나옵니다. 방명록은 선생님이 승인한 글만 공개됩니다.
- 3D 프린터, 현미경, 게임기, 운동기구, 포토존처럼 특별실의 물건을 눌러 볼 수 있습니다.
- 휴대폰 이동판·터치, PC 키보드(WASD·Space·Tab)를 모두 지원합니다.

## 바로 실행하기

[Node.js 24](https://nodejs.org/)와 Git이 필요합니다.

```bash
git clone https://github.com/dossamlab/school-travel.git
```

```bash
cd school-travel && npm ci && npm run dev
```

터미널에 나온 `Local` 주소를 엽니다. 같은 Wi-Fi의 휴대폰에서는 `Network` 주소를 씁니다.

```bash
npm run check && npm test && npm run build
```

타입 검사, 자동 검사(걷기·문·계단·가구·모형 예산 등), 배포 파일 생성을 차례로 실행합니다.

## 우리 학교로 바꾸기

| 안내서 | 내용 |
| --- | --- |
| [우리 학교로 바꾸기](docs/내-학교로-바꾸기.md) | 준비물, **어느 파일을 고치는지** 표, 단계별 AI 요청문, 검사 다루는 법 |
| [학교 캐릭터 만들기](docs/학교-캐릭터-만들기.md) | Meshy AI로 교복 입은 학생·교직원을 만들고 Blender로 다듬는 순서 |
| [3D 모형 만들기](docs/3D-모형-만들기.md) | 건물 외관·현관·가구를 만드는 Blender 스크립트와 이름 약속 |
| [시트 연결](docs/시트-연결.md) | 방명록·교장선생님 인사말·공간 안내를 Google 시트로 연결 |
| [배포](docs/배포.md) | Vercel 무료 요금제로 `○○.vercel.app` 주소 만들기 |
| [청학고 제작 기록](docs/cheonghak/) | 견본 학교의 배치도 대응·치수·외관·검증 기록. AI에게 "같은 방식으로"라고 할 때 참고 |

가장 먼저 고치는 파일은 [`src/school-config.ts`](src/school-config.ts)입니다. 학교 이름, 사이트 주소, 공유 이미지, 시트 주소, 도움말의 자료 출처가 모두 여기 있습니다.

## 폴더 구성

| 폴더 | 내용 |
| --- | --- |
| `src/` | 사이트 코드. `school-config.ts`(학교 값), `school-plan-data.ts`(층별 배치), `school-structure.ts`(계단·문), `school-layout.ts`(장소·교문), `school-upper-floors.ts`(2층 이상), `school-classrooms.ts`(가구), `school-scene.ts`(3D 장면), `school-main.ts`(화면·조작) |
| `public/` | 사이트가 읽는 모형(GLB)·이미지 |
| `assets/` | 모형을 만드는 Blender 스크립트, Meshy 원본 모형, 방명록 Apps Script |
| `tests/` | 자동 검사 |
| `scripts/` | 보조 명령 (`npm run room-rows`: 공간 안내 시트의 장소 목록) |
| `docs/` | 안내서와 청학고 제작 기록 |
| `references/` | **직접 만드는 폴더.** 우리 학교 원본 자료를 두는 곳이며 Git과 배포에서 빠집니다 |

## 라이선스

- 코드: [MIT](LICENSE)
- 문서·학교 모형·이미지: [CC BY 4.0](LICENSE-CONTENT.md)
- Meshy로 만든 캐릭터: CC BY 4.0 — 출처와 바꾼 내용은 [에셋 출처](ASSET_CREDITS.md)

Copyright (c) 2026 청학고 도쌤 (dossamlab). 바꿔 쓰실 때는 출처를 남겨 주세요. 사이트의 첫 화면과 도움말에 나오는 `Template by 청학고 도쌤`(`src/template-credit.ts`)도 그대로 두면 됩니다. 예: "청학고 도쌤의 학교 여행(school-travel)을 바탕으로 만들었습니다."

함께 고치고 싶은 점은 [협업 안내](CONTRIBUTING.md)를 참고해 이슈나 PR로 알려 주세요.
