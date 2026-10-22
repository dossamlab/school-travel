/**
 * 학교마다 바꾸는 이름·주소·연결값을 한곳에 둔다. 다른 학교는 이 파일부터 고친다.
 * 배치·문·가구 같은 형상은 docs/내-학교로-바꾸기.md의 파일 표를 따른다.
 * index.html의 제목·공유 정보와 홈 화면 manifest도 빌드할 때 이 값으로 채운다(vite.config.ts).
 */
export const schoolConfig={
  schoolName:'청학고등학교',
  /** 게임 문구에 붙는 짧은 이름: '청학 축제', '청학 길잡이' */
  shortName:'청학',
  /** 첫 화면 위쪽의 작은 영문 표기 */
  englishName:'CHEONGHAK',
  siteName:'청학 여행',
  tagline:'청학고등학교를 거닐다',
  description:'익숙한 학교를, 새로운 산책으로. 교문부터 시작하는 포근한 3D 청학고등학교 여행.',
  shareDescription:'익숙한 학교를, 새로운 산책으로. 교문부터 시작하는 포근한 3D 학교 여행에 초대합니다.',
  /** 배포한 사이트의 주소. 끝에 /를 붙인다. 공유 미리보기 이미지 주소에 쓰인다. */
  siteUrl:'https://ch-travel.vercel.app/',
  /** public/ 안의 1200×630 공유 이미지 */
  shareImage:'school-share-v1.jpg',
  shareImageAlt:'청학 여행 — 크림색 배경에 펼쳐진 청학고등학교 3D 전경',
  themeColor:'#f3eedf',
  /**
   * 방명록·교장선생님 인사말·공간 안내를 주는 Apps Script 웹앱 주소(docs/시트-연결.md).
   * 비워 두면 시트 기능은 "아직 연결하지 않았어요" 안내만 보여 준다.
   */
  dataUrl:'',
  /** 로비 현수막과 기념사진 아래쪽 글 */
  eventTitle:'청학고등학교 입학설명회',
  eventWelcome:'예비 청학인 여러분, 마음껏 둘러보세요',
  /** 도움말의 '자료와 표현 범위' 상자 */
  about:{
    note:'1~5층은 교사동 건축 도면의 구조 치수와 과거 면적자료를 기준으로 구성했습니다. 실 이름은 다산캠프·현장 설명 기준이며 현재 칸막이·문·가구 배치는 견본입니다. 서편·북편·중앙·동편 계단으로 층별 복도와 교실을 둘러볼 수 있습니다. 층간 3.6m·농구장 10단(1.8m)은 임시 높이이며 외관·지붕은 개략 표현입니다.',
    details:[
      '1~5층의 복도와 교실을 걸을 수 있어요. 계단에서는 WASD·방향키 또는 이동판을 사용하세요. 층에 도착하면 해당 층의 목적지 목록과 현재 위치 지도가 표시돼요. 교실 문을 열고 들어갈 수 있으며 특별실의 가구는 기본 견본이에요. 2~4층 특별실 일부는 현장 영상을 참고해 대표 가구를 놓았고, 물리/지학실의 3D 프린터 보관함, 생명과학실의 세균배양기, 창의상상라운지의 게임기는 가까이 가서 눌러 볼 수 있어요.',
      '외관은 제공된 현장 영상과 주석 사진을 우선 참고했고, 지도·거리뷰·학교 시설 사진으로 보완했어요. 필로티 주차장과 건물 밖 텃밭을 구분했으며, 정확한 치수는 실측이 필요해요.',
    ],
    /** 층별 안내도 아래 '실 이름 참고' 링크 */
    roomNames:{label:'다산캠프',url:'https://dasancamp.netlify.app/'},
    links:[
      {label:'현재 실 이름 참고',url:'https://dasancamp.netlify.app/'},
      {label:'학교 지도·거리뷰',url:'https://map.naver.com/p/search/%EC%B2%AD%ED%95%99%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90'},
      {label:'학교 시설 사진',url:'https://cheonghak-h.goegn.kr/cheonghak-h/cm/cntnts/cntntsView.do?cntntsId=3028&mi=7677'},
    ],
    credits:'주인공·교장·교감·학교보안관·숙직실 경비원: Meshy 모형 · 비율·자세 조정: Blender · 걷기 동작·루미: dossamlab Meshy 모형',
    maker:'청학고 도쌤',
  },
};
