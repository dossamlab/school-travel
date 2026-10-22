# 에셋 출처와 제작 기록

이 저장소의 모형·이미지·소리를 누가, 무엇으로, 어떤 조건으로 만들었는지 적는다. 다른 학교가 캐릭터나 모형을 바꾸면 이 문서의 해당 항목을 그 학교의 기록으로 바꾼다([학교 캐릭터 만들기](docs/학교-캐릭터-만들기.md)).

Meshy 모형과 그 파생본은 CC BY 4.0이다. 공유할 때는 제작 정보, [라이선스 링크](https://creativecommons.org/licenses/by/4.0/), 바꾼 사실을 함께 제공한다. 사이트 도움말에도 출처를 표시한다(`src/school-config.ts`의 `about.credits`).

## 학생 캐릭터 — 청학고 교복

- 제작: 청학고 도쌤(dossamlab), [Meshy](https://www.meshy.ai/) **Meshy 6 Lite**, 2026-10-15. Meshy 작업 이름 「Tiny Scholar」, 작업 식별자 `01a13d18-7fed-74bb-bb2f-dc5f880296ca`.
- 라이선스: **CC BY 4.0** — 2026-10-22 제작 계정의 Meshy 에셋 상세 화면에서 확인. 무료 요금제로 만든 모형이다.
- 원본: `assets/school-player-meshy-source.glb` — 관절·동작이 없고 한쪽 다리를 든 자세의 모형. 고치지 않고 보존한다.
- 사이트용: `public/school-player-meshy.glb`. `assets/prepare_school_meshy.py`가 18개 관절을 심고, 아래 기본 주인공의 걷기 동작을 옮겨 붙이고, 키 1.70m·22,000삼각형으로 정리한다. 재킷의 버건디색과 피부색을 보정했다. 과정은 [청학고 교복 기록](docs/cheonghak/SCHOOL_UNIFORM_PLAN.md)에 있다.
- 교복은 사용자가 제공한 교복 사진의 색과 형태만 참고했다. 학생의 얼굴·체형·명찰은 따라 만들지 않았고, 사진은 저장소와 외부 서비스에 넣지 않았다.

## 교직원 캐릭터 4명

- 교장선생님·교감선생님·학교보안관·숙직실 경비원. 제작: 청학고 도쌤(dossamlab), Meshy. 제작자가 CC BY 4.0으로 공개한다.
- Meshy 무료 요금제의 결과물은 CC BY 4.0이고, 유료 요금제의 결과물은 제작자 소유라 제작자가 이용 조건을 정한다. 2026-10-22 확인한 제작 계정의 에셋 목록에는 이 네 모형이 없어 어느 요금제로 만들었는지는 확인하지 못했다. 어느 경우든 위 조건으로 공개할 수 있다.
- 원본: `assets/principal-meshy-source.glb`, `vice-principal-meshy-source.glb`, `school-marshal-meshy-source.glb`, `night-guard-meshy-source.glb`.
- 사이트용: `public/school-residents.glb`. `assets/prepare_school_residents_meshy.py`가 키 1.70m에 맞추고 학생과 같은 큰 머리 비율로 다듬는다. 숙직실 경비원은 앉은 자세로 바꾼다. 스탠딩 책상과 화장실 세면대·변기는 이 프로젝트에서 직접 만든 모형이다.
- 교장선생님·교감선생님 모형은 두 분의 동의를 받아 참고 사진으로 만들었다. 참고 사진은 저장소에 넣지 않았다.

## 기본 주인공 — 걷기 동작 원본

- 제작: dossamlab, 2026-10-04, Meshy **Meshy 6 Lite**. 모형에 표시된 라이선스: CC BY 4.0.
- 모형·색 원본: `assets/player-meshy-source.glb`(내려받은 이름 `Meshy_AI_A_single_original_cut_1004134528_texture.glb`). 관절·동작 원본: `assets/player-meshy-rig.glb` — Meshy에서 사람형 관절을 넣고 걷기 동작을 추가해 Mixamo 형식으로 내려받았다.
- 파생본: `assets/player.glb`. `assets/prepare_player.py`가 24,000삼각형 이내, 1024px 색 이미지, 큰 머리·짧은 몸의 비율로 다듬고 서기 동작을 더했다. 사이트에는 직접 나오지 않고, 학생 캐릭터에 걷기 동작을 옮겨 줄 때와 검사에 쓴다.
- 무료 크레딧 20(모형 10 + 색 10)을 사용했다. 구독·크레딧 구매는 하지 않았다.

> 생성 요청문: A single original cute human island explorer, full body in neutral A-pose for animation rigging, arms angled down 40 degrees away from torso, hands empty and separate, feet apart on ground. Chibi 2.5-heads-tall proportions, very large round head, short stocky torso, short thick limbs, rounded mitten hands, round cream boots. (이하 생략)

## 안내자 루미의 얼굴

- 화면 아래 안내 말풍선의 얼굴 그림 `public/lumi-portrait.png`(256×256 투명 PNG).
- 원본 모형: 수달 연구원 루미. 제작 dossamlab, 2026-10-04, Meshy 6 Lite, CC BY 4.0, 생성 작업 식별자(텍스처) `01a106f9-b6c9-72a9-ab7c-b99152235ace`. Blender로 다듬은 모형을 정면에서 촬영한 파생 이미지다. 3D 모형 자체는 이 저장소에 들어 있지 않다.
- 다른 학교는 학교 마스코트 그림으로 바꿔도 된다(`src/school-main.ts`의 안내 말풍선).

## 학교 건물·가구 모형

- `assets/build_school.py`, `assets/build_school_classrooms.py`로 이 프로젝트에서 직접 만든 Blender 모형이다. 벽돌·나무 무늬도 스크립트가 그린다. 상용 게임의 모형이나 텍스처를 쓰지 않았다.
- 청학고 외관 참고: [학교 공식 시설 사진](https://cheonghak-h.goegn.kr/cheonghak-h/cm/cntnts/cntntsView.do?cntntsId=3028&mi=7677), 지도 서비스의 위성사진과 거리뷰, 사용자가 제공한 현장 영상·사진. 실 이름 참고: [다산캠프 학교 안내](https://dasancamp.netlify.app/). 배치·치수 참고: 학교 설계 도면과 교실 배치도.
- 참고 사진·지도 타일·도면은 모형과 배포 파일에 넣지 않았다. 치수·문·가구·장식은 탐방을 위한 해석이며 실측 복원이 아니다.

## 소리

- 배경음악과 성공·상호작용 소리는 `src/audio.ts`의 악보·합성 코드로 이 프로젝트에서 만들었다. 브라우저 안에서 음을 생성하며 외부 음원 파일을 쓰지 않는다.

## 공유 이미지

- `public/school-share-v1.jpg`(1200×630)는 `assets/school-share-card.html`을 브라우저에서 열어 촬영한 이미지다. 학교 3D 모형 화면으로 만들었다.
