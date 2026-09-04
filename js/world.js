/* ============================================================
   world.js — 절차적 사무실 생성 + 길찾기
   OpenMMO의 procedural terrain 아이디어를 사무실 평면도로 옮긴 것.
   같은 seed면 같은 사무실이 나온다(저장/복원 가능).
   ============================================================ */

const TILE = {
  FLOOR:0, WALL:1, DESK:2, DOOR:3, WINDOW:4, INBOX:5,
  BED:6, LITTER:7, COOLER:8, PLANT:9,
  COFFEE:10, COPIER:11, TOWER:12, SCRATCH:13, SERVER:14,
  FEEDER:15, MEETING:16, GYM:17, LAB:18, ROCKET:19, WHITEBOARD:20, LEGAL:21,
  DECOR:22, SHELF:23, FILLER:24, DESK_R:25,
  /* 벽에 거는 것들. 격자에는 안 들어가고 wallDecor 목록으로만 산다 —
     길찾기에 영향이 없어야 벽을 마음껏 채울 수 있다. */
  CLOCK:31, WALLSHELF:32, CATWALK:33,
  /* 새 비품 — 벽 쉼터 · 해먹 · 간식바.
     벽 쉼터는 벽에 붙지만 격자에서는 벽에 닿은 **바닥 한 칸**을 차지한다.
     그래야 길찾기가 그대로 돌고(고양이는 그 칸까지 걸어가면 된다),
     렌더러가 그 칸의 고양이를 선반 위로 올린다. */
  PERCH:26, HAMMOCK:27, SNACK:28,
  /* 놀잇감. 다른 가구와 달리 **놀이(play)** 라는 쓰임을 새로 만든다 —
     정수기 앞에서 노는 것과 털뭉치를 굴리는 것이 같은 행동일 수는 없다. */
  YARN:29, TOY:30,
  /* CD 플레이어 — 배경음악을 고르는 곳. 툴바 버튼이 아니라 **가구**다.
     쥬크박스가 설정 메뉴 안에 있으면 그건 옵션이지만, 사무실에 놓여 있으면
     그건 사무실의 일부다. 이 게임은 하루 종일 켜 두는 방 하나가 전부인 게임이라
     "오늘 뭘 틀까"도 그 방 안에서 일어나야 한다. */
  JUKE:34,
  /* 벽걸이 달력 — 날짜를 보는 곳. CD 플레이어와 같은 이유로 **가구**다.
     달력은 이미 벽에 걸려 있었다(DECOR 변주 중 하나였고 그림일 뿐이었다).
     기한이 생긴 뒤로 이 방에서 날짜는 그림이 아니라 조작 대상이 되었으므로,
     그 그림을 진짜 달력으로 승격시켰다 — 새 물건을 들여놓은 게 아니라
     걸려 있던 것에 손잡이를 달았다. */
  CAL:35,
  /* 제휴 게시판 — 다른 지점을 구경하는 곳. 달력과 같은 승격이다: 벽에는 이미 코르크
     게시판이 걸려 있었고(DECOR 변주), 폴라로이드가 압정으로 붙어 있는 그림이었다.
     남의 사무실을 보러 가는 문이 있어야 한다면 그건 툴바가 아니라 그 게시판이다. */
  BOARD:36,
  /* 사내 오락기 — 놀잇감 셋째. 털뭉치·낚싯대와 같은 쓰임(play)이지만 덩치가 있어서
     벽에 등을 대고 서고, 조이스틱이 둘이라 두 마리가 같이 붙는다.
     이 가구의 값어치는 숫자가 아니라 **고양이가 「한 판만 더…」 라고 말하는 것**이다. */
  GAME:37,
  /* 도배 견본책 — 벽지와 바닥을 고르는 곳. 달력·게시판과 같은 승격이 아니라
     **사고 나서 걸리는** 첫 벽 물건이다. 상점에서 480멸치를 내면 문 옆에 걸린다.
     음반이 CD 플레이어를 얻은 것과 같은 구조다(TODO 34): 이 회사에서 「생산 효과가
     없는데 돈을 쓰는」 물건은 상점 목록에 섞이지 않고 자기 문을 갖는다. */
  BINDER:38,

  /* ============================================================
     가구 카탈로그 (2026-09-01 · 39~62)

     여기부터는 **효과가 하나뿐인 가구**다. 위의 비품들은 저마다 다른 숫자를 건드리지만
     (생산·욕구·KPI·오프라인), 이 스물넷은 전부 「사무실 쾌적도」 하나에만 기여한다.
     스물넷에 각자 다른 효과를 달면 표가 스물네 줄 늘어나는 게 아니라 **곱이 스물네 겹**이
     되고, 그때부터 이 게임의 숫자는 아무도 못 읽는다(정제실 하나가 +90% 인 게임이다).

     격자는 칸당 바이트 하나라 255까지 쓸 수 있다 — 자리는 넉넉하다.
     쓰임(use)이 없는 것이 대부분이다: 고양이가 「쓰는」 가구가 아니라 **놓여 있는**
     가구이고, 그 차이가 비품과 가구를 가른다. 예외는 앉는 것 넷(소파·안락의자·빈백·
     카페의자)인데 그건 실제로 쉬는 자리라 social 을 준다.
     ============================================================ */
  DRAWER:39, FILECAB:40, MEETCHAIR:41,
  LOCKER:42, CABINET:43, OPENSHELF:44, BOOKRACK:45, PAPERTRAY:46, BOX:47, BIN:48,
  PLANT_S:49, PLANT_L:50, FLOORLAMP:51, CANDLE:52, LANTERN:53, PENHOLDER:54,
  SOFA1:55, SOFA2:56, LOWTABLE:57, ARMCHAIR:58, BEANBAG:59, CAFETABLE:60, CAFECHAIR:61,
  /* 벽에 거는 둘 — 격자에 안 들어가고 wallDecor 로만 산다(위 CLOCK 무리와 같다) */
  CURTAIN:62, MEMO:63,
};
// 걸어 다닐 수 있는 타일
const WALKABLE = new Set([TILE.FLOOR, TILE.DOOR]);

// 가구 렌더 정보 { 이모지, 이름, 상호작용 종류 }
const TILE_INFO = {
  [TILE.DESK]:      { em:'💻', n: L({ ko:'책상',        en:'Desk',           ja:'デスク' }),               use:'work'   },
  [TILE.INBOX]:     { em:'📥', n: L({ ko:'결재함',      en:'Inbox',          ja:'決裁箱' }),               use:'inbox'  },
  [TILE.BED]:       { em:'🧺', n: L({ ko:'낮잠 상자',   en:'Nap Box',        ja:'昼寝箱' }),               use:'sleep'  },
  [TILE.LITTER]:    { em:'🪣', n: L({ ko:'모래상자',    en:'Litter Box',     ja:'猫トイレ' }),             use:'litter' },
  [TILE.COOLER]:    { em:'🚰', n: L({ ko:'정수기',      en:'Water Cooler',   ja:'ウォーターサーバー' }),   use:'social' },
  [TILE.PLANT]:     { em:'🪴', n: L({ ko:'화분',        en:'Plant',          ja:'観葉植物' }),             use:'social' },
  [TILE.COFFEE]:    { em:'☕', n: L({ ko:'커피머신',    en:'Coffee Machine', ja:'コーヒーマシン' }),       use:'coffee' },
  [TILE.COPIER]:    { em:'🖨️', n: L({ ko:'복사기',     en:'Copier',         ja:'コピー機' }),             use:'work'   },
  [TILE.TOWER]:     { em:'🗼', n: L({ ko:'캣타워',      en:'Cat Tower',      ja:'キャットタワー' }),       use:'sleep'  },
  [TILE.SCRATCH]:   { em:'🪵', n: L({ ko:'스크래처',    en:'Scratcher',      ja:'爪とぎ' }),               use:'social' },
  [TILE.SERVER]:    { em:'🖥️', n: L({ ko:'건조실',     en:'Drying Room',    ja:'乾燥室' }),               use:'sleep'  },
  [TILE.FEEDER]:    { em:'🍚', n: L({ ko:'자동급식기',  en:'Auto Feeder',    ja:'自動給餌器' }),           use:'coffee' },
  [TILE.MEETING]:   { em:'🪑', n: L({ ko:'회의 테이블', en:'Meeting Table',  ja:'会議テーブル' }),         use:'social' },
  [TILE.GYM]:       { em:'🏋️', n: L({ ko:'헬스장',     en:'Gym',            ja:'ジム' }),                 use:'social' },
  [TILE.LAB]:       { em:'🔬', n: L({ ko:'정제실',      en:'Refinery',       ja:'精製室' }),               use:'work'   },
  [TILE.ROCKET]:    { em:'🚀', n: L({ ko:'사내 로켓',   en:'Company Rocket', ja:'社用ロケット' }),         use:'social' },
  [TILE.WHITEBOARD]:{ em:'📋', n: L({ ko:'화이트보드',  en:'Whiteboard',     ja:'ホワイトボード' }),       use:null     },
  [TILE.LEGAL]:     { em:'⚖️', n: L({ ko:'법무팀 데스크',en:'Legal Desk',    ja:'法務デスク' }),           use:'legal'  },
  [TILE.DECOR]:     { em:'🖼️', n: L({ ko:'사내 액자',  en:'Office Art',     ja:'社内アート' }),           use:null     },
  [TILE.SHELF]:     { em:'🗄️', n: L({ ko:'문서 선반',  en:'File Shelf',     ja:'書類棚' }),               use:null     },
  [TILE.PERCH]:     { em:'🧗', n: L({ ko:'벽 쉼터',      en:'Wall Perch',     ja:'壁の休憩棚' }),           use:'sleep'  },
  [TILE.HAMMOCK]:   { em:'🛏️', n: L({ ko:'해먹',        en:'Hammock',        ja:'ハンモック' }),           use:'sleep'  },
  [TILE.YARN]:      { em:'🧶', n: L({ ko:'털뭉치',       en:'Yarn Ball',      ja:'毛糸玉' }),               use:'play'   },
  [TILE.TOY]:       { em:'🪶', n: L({ ko:'낚싯대 장난감', en:'Feather Wand',   ja:'猫じゃらし' }),           use:'play'   },
  [TILE.SNACK]:     { em:'🍪', n: L({ ko:'간식바',       en:'Snack Bar',      ja:'おやつバー' }),           use:'coffee' },
  /* 쓰임이 social 인 건 덤이 아니다 — 고양이가 **음악을 들으러 온다.**
     정수기 앞에 모이는 것과 같은 행동이고, 그래서 이 가구는 장식이 아니라 시설이다. */
  [TILE.JUKE]:      { em:'💿', n: L({ ko:'CD 플레이어',  en:'CD Player',      ja:'CDプレーヤー' }),         use:'social' },
  /* 쓰임은 play 다(social 이 아니다) — 정수기 앞의 수다와 오락기 앞의 한 판은
     같은 행동이 아니고, play 는 재미를 social 의 두 배 가까이 채운다. */
  [TILE.GAME]:      { em:'🕹️', n: L({ ko:'사내 오락기',  en:'Arcade Cabinet', ja:'社内アーケード' }),       use:'play'   },
  [TILE.WINDOW]:    { em:'🪟', n: L({ ko:'창문',        en:'Window',         ja:'窓' }),                   use:null     },
  [TILE.CLOCK]:     { em:'🕐', n: L({ ko:'벽시계',      en:'Wall Clock',     ja:'掛け時計' }),             use:null     },
  [TILE.CAL]:       { em:'📅', n: L({ ko:'벽걸이 달력',  en:'Wall Calendar',  ja:'壁掛けカレンダー' }),     use:null     },
  [TILE.BOARD]:     { em:'📌', n: L({ ko:'제휴 게시판',  en:'Branch Board',   ja:'提携掲示板' }),           use:null     },
  [TILE.WALLSHELF]: { em:'🗃️', n: L({ ko:'벽 선반',     en:'Wall Shelf',     ja:'壁棚' }),                 use:null     },
  [TILE.CATWALK]:   { em:'🐾', n: L({ ko:'캣워크',      en:'Catwalk',        ja:'キャットウォーク' }),     use:null     },
  [TILE.FILLER]:    { em:'',   n:'',  use:null   },   // 여러 칸 가구가 차지하는 나머지 칸
  [TILE.BINDER]:    { em:'📕', n: L({ ko:'도배 견본책',  en:'Sample Binder',  ja:'見本帳' }),               use:null     },
  [TILE.DESK_R]:    { em:'💻', n: L({ ko:'책상', en:'Desk', ja:'デスク' }),  use:'work' },   // 2칸 책상의 오른쪽 절반

  /* ---------- 가구 카탈로그 ----------
     **대부분 use 가 없다.** 고양이가 쓰는 물건이 아니라 놓여 있는 물건이라,
     쓰임을 주면 길찾기 목적지가 스물넷 늘어나서 고양이가 하루 종일 가구 순례를 한다.
     앉는 것 넷만 social 을 갖는다 — 소파에 안 앉는 고양이는 소파가 아니라 벽이다. */
  [TILE.DRAWER]:    { em:'🗄️', n: L({ ko:'서랍장',      en:'Drawer Unit',   ja:'引き出し' }),        use:null },
  [TILE.FILECAB]:   { em:'🗃️', n: L({ ko:'파일 캐비닛',  en:'File Cabinet',  ja:'ファイルキャビネット' }), use:null },
  [TILE.MEETCHAIR]: { em:'🪑', n: L({ ko:'회의용 의자',  en:'Meeting Chair', ja:'会議用椅子' }),      use:'social' },
  [TILE.LOCKER]:    { em:'🚪', n: L({ ko:'락커',        en:'Lockers',       ja:'ロッカー' }),        use:null },
  [TILE.CABINET]:   { em:'🗄️', n: L({ ko:'수납장',      en:'Cabinet',       ja:'収納棚' }),          use:null },
  [TILE.OPENSHELF]: { em:'🪜', n: L({ ko:'오픈 선반',    en:'Open Shelving', ja:'オープン棚' }),      use:null },
  [TILE.BOOKRACK]:  { em:'📚', n: L({ ko:'책꽂이',      en:'Book Rack',     ja:'本立て' }),          use:null },
  [TILE.PAPERTRAY]: { em:'📄', n: L({ ko:'서류 트레이',  en:'Paper Tray',    ja:'書類トレイ' }),      use:null },
  [TILE.BOX]:       { em:'📦', n: L({ ko:'박스',        en:'Box',           ja:'段ボール' }),        use:null },
  [TILE.BIN]:       { em:'🗑️', n: L({ ko:'휴지통',      en:'Trash Bin',     ja:'ごみ箱' }),          use:null },
  [TILE.PLANT_S]:   { em:'🌵', n: L({ ko:'화분 (소)',    en:'Plant (S)',     ja:'鉢植え(小)' }),      use:null },
  [TILE.PLANT_L]:   { em:'🌴', n: L({ ko:'화분 (대)',    en:'Plant (L)',     ja:'鉢植え(大)' }),      use:null },
  [TILE.FLOORLAMP]: { em:'🛋️', n: L({ ko:'스탠드 조명',  en:'Floor Lamp',    ja:'スタンドライト' }),  use:null },
  [TILE.CANDLE]:    { em:'🕯️', n: L({ ko:'캔들',        en:'Candles',       ja:'キャンドル' }),      use:null },
  [TILE.LANTERN]:   { em:'🏮', n: L({ ko:'랜턴',        en:'Lantern',       ja:'ランタン' }),        use:null },
  [TILE.PENHOLDER]: { em:'🖊️', n: L({ ko:'펜 홀더',     en:'Pen Holder',    ja:'ペン立て' }),        use:null },
  [TILE.SOFA1]:     { em:'🛋️', n: L({ ko:'소파 (1인)',   en:'Sofa (1)',      ja:'ソファ(1人)' }),     use:'social' },
  [TILE.SOFA2]:     { em:'🛋️', n: L({ ko:'소파 (2인)',   en:'Sofa (2)',      ja:'ソファ(2人)' }),     use:'social' },
  [TILE.LOWTABLE]:  { em:'🪵', n: L({ ko:'테이블',      en:'Low Table',     ja:'ローテーブル' }),    use:null },
  [TILE.ARMCHAIR]:  { em:'💺', n: L({ ko:'안락 의자',    en:'Lounge Chair',  ja:'アームチェア' }),    use:'social' },
  [TILE.BEANBAG]:   { em:'🫘', n: L({ ko:'빈백',        en:'Bean Bag',      ja:'ビーズクッション' }), use:'sleep' },
  [TILE.CAFETABLE]: { em:'☕', n: L({ ko:'카페 테이블',  en:'Café Table',    ja:'カフェテーブル' }),  use:null },
  [TILE.CAFECHAIR]: { em:'🪑', n: L({ ko:'카페 의자',    en:'Café Chair',    ja:'カフェチェア' }),    use:'social' },
  [TILE.CURTAIN]:   { em:'🪟', n: L({ ko:'커튼',        en:'Curtains',      ja:'カーテン' }),        use:null },
  [TILE.MEMO]:      { em:'🗒️', n: L({ ko:'스티커 메모',  en:'Sticky Notes',  ja:'付箋メモ' }),        use:null },
};


/* ---------- 배치 규칙 표 셋 ----------
   이 셋은 **도트 렌더러(js/sprite.js)에 얹혀 살고 있었다.** 스프라이트 시트를 등록하는
   `sheetAt()` 의 부수효과로 채워졌기 때문인데, 하는 일은 그림이 아니라 **배치**다 —
   그래서 렌더러를 지운 2026-08-24 에 여기로 옮겼다. 배치 규칙은 배치기 옆에 있어야 한다.

   옮기면서 값은 한 칸도 안 바꿨다. 사무실은 시드에서 유도되므로 이 표가 흔들리면
   **이미 저장된 사무실이 다시 열릴 때 달라진다** — 옮기는 김에 고칠 자리가 아니다. */

/* 격자에서 **실제로 차지하는 칸 수**. 오른쪽 칸을 FILLER 로 예약한다.
   그림 폭과는 다른 값이다: 도트 시트의 가구는 두 칸으로 그려진 게 많았지만 3D 모델은
   대부분 한 칸 안에 선다. 그림을 기준으로 예약하면 옆칸이 이유 없이 비고, 그 빈 칸에는
   아무것도 못 놓는다. 보이는 것과 막히는 것이 어긋나면 그건 그냥 버그다. */
const FURN_SPAN = {
  [TILE.DESK]: 2, [TILE.MEETING]: 2, [TILE.LEGAL]: 2,
  /* 2인 소파만 두 칸이다 — 폭이 1.46 이라 한 칸에 넣으면 옆 칸 가구를 뚫는다.
     나머지 가구는 전부 1.0 아래로 깎아 뒀다(락커 0.92 · 수납장 1.00). */
  [TILE.SOFA2]: 2,
};

/* 덩치 큰 가구 — 통로 한가운데 서 있으면 어색하니 벽 쪽에만 놓는다.
   예전에는 도트 시트의 그림 크기(2x2 이상이거나 세로 3칸 이상)에서 **자동으로** 유도했다.
   시트가 없어졌으므로 그때 유도되던 집합을 그대로 적어 둔다 — 언젠가 3D 모델의 부피에서
   다시 유도하는 게 맞지만, 그건 사무실 배치가 바뀌는 변경이라 따로 해야 한다. */
const FURN_BIG = {
  [TILE.DESK]:1, [TILE.MEETING]:1, [TILE.LEGAL]:1, [TILE.COOLER]:1, [TILE.PLANT]:1,
  [TILE.COFFEE]:1, [TILE.FEEDER]:1, [TILE.SERVER]:1, [TILE.LAB]:1, [TILE.GYM]:1,
  [TILE.SCRATCH]:1, [TILE.WHITEBOARD]:1, [TILE.SHELF]:1, [TILE.PERCH]:1, [TILE.SNACK]:1,
  /* 키가 크거나 폭이 넓어 벽을 등져야 하는 것들 */
  [TILE.LOCKER]:1, [TILE.FILECAB]:1, [TILE.CABINET]:1, [TILE.OPENSHELF]:1, [TILE.SOFA2]:1,
};

/* 가구 분류. 아무 데나 흩뿌리면 사무실이 아니라 창고로 보인다.
   같은 종류끼리 모여야 「저기가 탕비실, 저기가 설비 쪽」으로 읽힌다.
   break: 탕비실 / rest: 휴식 / machine: 설비 / meet: 회의 / decor: 장식 / wall: 벽에만 */
const FURN_CAT = {
  [TILE.COFFEE]:'break',  [TILE.FEEDER]:'break',  [TILE.COOLER]:'break',
  [TILE.SNACK]:'break',   [TILE.JUKE]:'break',    [TILE.GAME]:'break',
  [TILE.BED]:'rest',      [TILE.TOWER]:'rest',    [TILE.LITTER]:'rest',
  [TILE.SCRATCH]:'rest',  [TILE.YARN]:'rest',     [TILE.TOY]:'rest',
  [TILE.HAMMOCK]:'rest',
  [TILE.SERVER]:'machine',[TILE.LAB]:'machine',   [TILE.COPIER]:'machine',
  [TILE.GYM]:'machine',   [TILE.ROCKET]:'machine',
  [TILE.MEETING]:'meet',  [TILE.LEGAL]:'meet',    [TILE.INBOX]:'meet',
  [TILE.PLANT]:'decor',   [TILE.SHELF]:'decor',
  [TILE.PERCH]:'wall',
  /* 가구 카탈로그 — 수납은 벽을 등지고, 쉬는 것은 라운지로, 데코는 아무 데나.
     이 세 줄이 「사무실이 사무실처럼 보이는가」의 대부분이다: 소파가 통로 한가운데
     서 있고 락커가 방 복판에 있으면 가구를 아무리 잘 만들어도 창고다. */
  [TILE.DRAWER]:'wall',   [TILE.FILECAB]:'wall',   [TILE.LOCKER]:'wall',
  [TILE.CABINET]:'wall',  [TILE.OPENSHELF]:'wall', [TILE.BOOKRACK]:'wall',
  [TILE.BIN]:'wall',      [TILE.BOX]:'wall',
  [TILE.SOFA1]:'rest',    [TILE.SOFA2]:'rest',     [TILE.ARMCHAIR]:'rest',
  [TILE.BEANBAG]:'rest',  [TILE.LOWTABLE]:'rest',
  [TILE.CAFETABLE]:'break', [TILE.CAFECHAIR]:'break', [TILE.MEETCHAIR]:'meet',
  [TILE.PLANT_S]:'decor', [TILE.PLANT_L]:'decor',  [TILE.FLOORLAMP]:'decor',
  [TILE.CANDLE]:'decor',  [TILE.LANTERN]:'decor',  [TILE.PENHOLDER]:'decor',
  [TILE.PAPERTRAY]:'decor',
};

/* 작은 소품 — 초·펜 홀더처럼 **책상 위에 놓는 크기**의 것들.
   자리 고르기에서 규칙 하나를 풀어 준다: 큰 가구는 앞에 통로가 두 칸 있어야 하지만
   (freeAround >= 2 — 고양이가 지나가고 쓸 자리), 초 한 개는 구석에 놓여도 된다.
   그 규칙을 똑같이 걸어 뒀더니 **방이 좀 차면 초를 아예 못 놓았다.**
   진짜 초는 구석에 놓는 물건이라 규칙이 물건을 안 닮은 쪽이었다. */
const FURN_SMALL = new Set([
  TILE.CANDLE, TILE.LANTERN, TILE.PENHOLDER, TILE.PAPERTRAY, TILE.PLANT_S,
]);

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- 사무실 등급 ----------
   방 비율은 정사각형에 가깝게 둔다. 가로로 길쭉하면 가로가 먼저 꽉 차서
   세로에 여백만 남는다.

   크기는 전반적으로 좁게 잡았다. 넓은 방은 고양이가 점이 되고 걸어다니는 시간만 길어진다.
   특히 3D 로 오면서 더 그렇다 — 사무실이 넓으면 카메라가 멀어지고, 멀어지면
   표정도 개체 구분도 사라진다. 좁아야 북적인다.

   그래서 한 번 더 줄였다(면적 기준 전 등급 -20~30%). 특히 첫 사무실은 두 자리짜리
   종이상자다 — 시작이 좁아야 이사가 사건이 된다. 위로 올라가는 폭도 같이 줄였다.
   책상 줄은 세로 3칸마다 한 줄이라 높이가 12·15 를 넘을 때만 줄이 늘어난다.
   그래서 크기는 마음대로 못 정한다 — 필요한 자리 수가 최소 크기를 정한다.
   책상 수용량은 tools/world-audit.js 로 전 등급 전수 검증한다. */
const TIERS = [
  { name: L({ ko:'골목 종이상자 지점', en:'Alley Cardboard Branch',   ja:'路地裏ダンボール支店' }), w:9,  h:7,  desks:2,
    flavor: L({ ko:'비가 오면 젖는다. 그래도 사무실이다.',    en:'It gets wet when it rains. Still an office.',        ja:'雨が降ると濡れる。それでもオフィスだ。' }) },
  { name: L({ ko:'반지하 원룸 오피스', en:'Semi-basement Studio',     ja:'半地下ワンルームオフィス' }), w:10, h:8,  desks:4,
    flavor: L({ ko:'창문이 발목 높이에 있다.',                en:'The window is at ankle height.',                     ja:'窓が足首の高さにある。' }) },
  { name: L({ ko:'상가 2층 사무실',    en:'2nd-floor Walk-up Office', ja:'商店街2階オフィス' }), w:11, h:9,  desks:6,
    flavor: L({ ko:'아래층 붕어빵 냄새가 올라온다.',          en:'The taiyaki smell drifts up from downstairs.',       ja:'下の階からたい焼きの匂いが上がってくる。' }) },
  { name: L({ ko:'냥코 소형 빌딩',     en:'Nyanco Small Building',    ja:'ニャンコ小型ビル' }), w:13, h:12, desks:9,
    flavor: L({ ko:'드디어 엘리베이터가 생겼다.',             en:'Finally, an elevator.',                              ja:'ついにエレベーターができた。' }) },
  { name: L({ ko:'냥코퍼레이션 사옥',  en:'Nyancorporation HQ',       ja:'ニャンコーポレーション本社' }), w:14, h:12, desks:12,
    flavor: L({ ko:'로비에 대형 캣타워가 서 있다.',           en:'A giant cat tower stands in the lobby.',             ja:'ロビーに巨大キャットタワーが立っている。' }) },
  { name: L({ ko:'냥타워',            en:'Nyan Tower',               ja:'ニャンタワー' }), w:15, h:15, desks:16,
    flavor: L({ ko:'야경이 보인다. 야근도 보인다.',           en:'You can see the night view. And the overtime.',      ja:'夜景が見える。残業も見える。' }) },
  { name: L({ ko:'달 지사 (Moon Br.)', en:'Moon Branch',              ja:'月支社' }), w:17, h:15, desks:20,
    flavor: L({ ko:'중력이 약해서 다들 잘 뛴다.',             en:'Low gravity. Everyone jumps beautifully.',           ja:'重力が弱くて、みんなよく跳ぶ。' }) },
];
const TIER_AT_QUARTER = [1, 3, 6, 10, 15, 21, 28];
const tierForQuarter = q => {
  let t = 0;
  TIER_AT_QUARTER.forEach((s, i) => { if (q >= s) t = i; });
  return Math.min(t, TIERS.length - 1);
};

/* 비품 id → 타일. 구매 시 이 표를 보고 그 가구 하나만 추가한다. */
const SHOP_TILE = {
  coffee:TILE.COFFEE, copier:TILE.COPIER, tower:TILE.TOWER, scratch:TILE.SCRATCH,
  server:TILE.SERVER, feeder:TILE.FEEDER, meeting:TILE.MEETING, gym:TILE.GYM,
  lab:TILE.LAB, rocket:TILE.ROCKET,
  perch:TILE.PERCH, hammock:TILE.HAMMOCK, snack:TILE.SNACK,
  yarn:TILE.YARN, toy:TILE.TOY, game:TILE.GAME,
  /* 가구 카탈로그. 비품과 같은 표를 쓴다 — 사는 경로가 하나여야 「샀는데 안 나타난다」가
     한 곳에서만 생기고, 그 한 곳은 이미 고쳐져 있다(buyItem 의 자리부터 잡기). */
  f_drawer:TILE.DRAWER,     f_filecab:TILE.FILECAB,   f_meetchair:TILE.MEETCHAIR,
  f_locker:TILE.LOCKER,     f_cabinet:TILE.CABINET,   f_openshelf:TILE.OPENSHELF,
  f_bookrack:TILE.BOOKRACK, f_papertray:TILE.PAPERTRAY, f_box:TILE.BOX, f_bin:TILE.BIN,
  f_plantS:TILE.PLANT_S,    f_plantL:TILE.PLANT_L,    f_floorlamp:TILE.FLOORLAMP,
  f_candle:TILE.CANDLE,     f_lantern:TILE.LANTERN,   f_penholder:TILE.PENHOLDER,
  f_sofa1:TILE.SOFA1,       f_sofa2:TILE.SOFA2,       f_lowtable:TILE.LOWTABLE,
  f_armchair:TILE.ARMCHAIR, f_beanbag:TILE.BEANBAG,
  f_cafetable:TILE.CAFETABLE, f_cafechair:TILE.CAFECHAIR,
};
/* ---------- 생성 ---------- */
function genOffice(tier, owned, seed){
  const T = TIERS[tier], W = T.w, H = T.h;
  const rng = mulberry32(seed * 7919 + tier * 131 + 17);
  const g = new Uint8Array(W * H).fill(TILE.FLOOR);
  const at = (x, y) => y * W + x;
  const set = (x, y, v) => { if (x>=0 && y>=0 && x<W && y<H) g[at(x,y)] = v; };
  const get = (x, y) => (x<0||y<0||x>=W||y>=H) ? TILE.WALL : g[at(x,y)];

  for (let x = 0; x < W; x++){ set(x,0,TILE.WALL); set(x,H-1,TILE.WALL); }
  for (let y = 0; y < H; y++){ set(0,y,TILE.WALL); set(W-1,y,TILE.WALL); }

  // 창문은 두지 않는다 — 이 타일셋에 맞는 창문 타일이 없어서 CSS로 그리면 혼자 겉돈다.

  // 출입문 + 결재함
  const doorX = Math.max(2, Math.min(W-3, Math.floor(W/2) + (rng()<.5?-1:1)));
  set(doorX, H-1, TILE.DOOR);
  const inbox = { x: doorX >= W-4 ? doorX-2 : doorX+2, y: H-2 };

  // 오른쪽 3칸은 편의시설 구역으로 확보
  const deskRight = W - 4;

  // 무언가를 놓았을 때 바닥이 끊기면 되돌린다 (고양이가 구석에 갇히는 것 방지)
  const probe = { W, H, grid:g };
  const entry = { x:doorX, y:H-2 };
  function keepsConnected(){
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  }
  function tryPlace(x, y, tile){
    const prev = get(x, y);
    set(x, y, tile);
    if (keepsConnected()) return true;
    set(x, y, prev);
    return false;
  }

  set(inbox.x, inbox.y, TILE.INBOX);   // 결재함은 문 옆 고정 (통로를 막지 않는 위치)

  /* --- 휴게실: 한쪽 구석을 칸막이로 나눈다 ---
     타일셋 제작자의 예시 배치가 한 덩어리 방이 아니라 구역이 나뉜 사무실이라
     그 구조를 따라간다. 바닥재도 구역마다 다르게 깐다. */
  const zone = new Uint8Array(W * H);          // 0 본 사무실 · 1 휴게실 · 2 회의실 · 3 라운지
  const brW = Math.max(3, Math.min(6, Math.floor(W * 0.34)));
  const brH = Math.max(3, Math.min(5, Math.floor(H * 0.30)));
  const bx1 = brW, by0 = H - 1 - brH;          // 좌하단 구석
  if (W >= 11 && H >= 9 && by0 > 3 && Math.abs(doorX - bx1) > 1){
    const before = g.slice();
    for (let y = by0; y <= H-2; y++) set(bx1, y, TILE.WALL);      // 세로 칸막이
    for (let x = 1; x <= bx1; x++)   set(x, by0, TILE.WALL);      // 가로 칸막이
    const doorY = by0 + 1 + Math.floor(rng() * Math.max(1, brH - 1));
    set(bx1, Math.min(H-2, doorY), TILE.FLOOR);                   // 출입구
    if (keepsConnectedAfterPartition()){
      for (let y = by0+1; y <= H-2; y++)
        for (let x = 1; x < bx1; x++) zone[y*W + x] = 1;
    } else {
      g.set(before);                                              // 막히면 통째로 취소
    }
  }
  function keepsConnectedAfterPartition(){
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  }

  /* --- 회의실: 큰 사무실에만. 오른쪽 위 구석을 칸막이로 나눈다 --- */
  if (tier >= 3 && W >= 12 && H >= 12){
    const mw = Math.max(4, Math.min(6, Math.floor(W * 0.30)));
    const mh = Math.max(3, Math.min(5, Math.floor(H * 0.26)));
    const mx0 = W - 1 - mw, my1 = mh;
    const before = g.slice();
    for (let y = 1; y <= my1; y++)      set(mx0, y, TILE.WALL);   // 세로 칸막이
    for (let x = mx0; x <= W-2; x++)    set(x, my1, TILE.WALL);   // 가로 칸막이
    const doorY = 1 + Math.floor(rng() * Math.max(1, mh - 1));
    set(mx0, Math.min(my1 - 1, doorY), TILE.FLOOR);               // 출입구
    if (keepsConnectedAfterPartition()){
      for (let y = 1; y < my1; y++)
        for (let x = mx0+1; x <= W-2; x++) zone[y*W + x] = 2;
    } else g.set(before);
  }

  /* --- 라운지: 벽 없이 바닥재만 바꾼 구역. 이 팩엔 러그가 없어서 바닥으로 대신한다 --- */
  if (tier >= 2){
    const lw = Math.max(3, Math.min(5, Math.floor(W * 0.22)));
    const lh = Math.max(2, Math.min(4, Math.floor(H * 0.20)));
    const lx = W - 2 - lw, ly = Math.max(3, Math.floor(H * 0.55));
    let clear = true;
    for (let y = ly; y < ly + lh && clear; y++)
      for (let x = lx; x < lx + lw; x++)
        if (get(x, y) !== TILE.FLOOR || zone[y*W + x]){ clear = false; break; }
    if (clear)
      for (let y = ly; y < ly + lh; y++)
        for (let x = lx; x < lx + lw; x++) zone[y*W + x] = 3;
  }

  /* --- 책상 배치: 2칸짜리 팀 섬(pod)을 여러 행에 고르게 --- */
  const desks = [];
  const rowYs = [];
  for (let y = 2; y <= H-4; y += 3) rowYs.push(y);

  const canDesk = (x, y) =>
    get(x, y) === TILE.FLOOR && get(x, y+1) === TILE.FLOOR &&
    !zone[y*W + x] && !zone[(y+1)*W + x] &&           // 휴게실에는 책상을 두지 않는다
    !(x === inbox.x && Math.abs(y - inbox.y) < 2);
  /* 책상은 2칸이 한 짝이다 — 타일셋의 책상이 가로 2칸이고,
     참고 배치도 2인 1조로 붙여 놓는다. 자리는 각 칸 아래에 하나씩. */
  const putDesk = (x, y) => {
    if (!canDesk(x, y) || !canDesk(x+1, y)) return false;
    const prevL = get(x, y), prevR = get(x+1, y);
    set(x, y, TILE.DESK); set(x+1, y, TILE.DESK_R);
    if (!keepsConnected()){ set(x, y, prevL); set(x+1, y, prevR); return false; }
    desks.push({ desk:{x,y},     seat:{x,   y:y+1} });
    desks.push({ desk:{x:x+1,y}, seat:{x:x+1, y:y+1} });
    return true;
  };

  const need = T.desks;
  const perRow = Math.ceil(need / rowYs.length / 2) * 2;      // 행마다 짝수로
  for (const y of rowYs){
    if (desks.length >= need) break;
    const pods = Math.min(Math.ceil(perRow / 2), Math.ceil((need - desks.length) / 2));
    const span = pods * 2 + (pods - 1) * 2;                   // 책상 2칸 + 사이 통로 2칸
    const jitter = rng() < .5 ? 0 : 1;
    const x0 = Math.max(2, Math.floor((deskRight + 2 - span) / 2) + jitter);
    for (let p = 0; p < pods && desks.length < need; p++){
      const x = x0 + p * 4;
      if (x + 1 > deskRight) break;
      putDesk(x, y);
    }
  }
  // 못 채웠으면 남은 칸을 훑어서 마저 채운다 (여기서도 2칸 한 짝)
  for (const y of rowYs){
    for (let x = 2; x + 1 <= deskRight && desks.length < need; x++){
      if (get(x-1, y) === TILE.DESK || get(x-1, y) === TILE.DESK_R) continue;
      putDesk(x, y);
    }
  }

  const facilities = {};
  const machineSide = rng() < 0.5 ? 'left' : 'right';
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* --- CD 플레이어: 문 옆 고정 ---
     결재함의 **반대쪽** 문간이다. 출근하면서 서류를 내려놓고 음악을 트는 자리라
     그림이 맞고, 무엇보다 **자리를 못 잡는 일이 없어야 한다.**

     배치기에 맡겨 봤더니 평면도 560개 중 116개에서 안 놓였다 — 1칸짜리라 2×3 짜리
     기계에 계속 밀린다. 그러면 음악을 고를 방법이 통째로 사라지고, 그건 아무 안내도
     없이 기능 하나가 없는 판이 된다. 반대로 배치기보다 **먼저** 끼워 넣으면 11×9 에서
     그 기계가 들어갈 연속된 자리를 1칸짜리가 쪼개서 비품 하나가 못 들어갔다
     (화분을 하나 빼 봐도 그대로였다 — 칸 수가 아니라 모양의 문제였다).

     둘 다 피하는 자리는 애초에 배치기가 안 쓰는 **문간**이다. 여기도 안 되면
     아래 목록에 얹어 배치기에 맡긴다 — 그때는 못 놓을 수도 있지만 그런 평면도는 없었다. */
  let jukeSet = false;
  for (const x of jukeSpots(W, H, doorX)){
    if (x === inbox.x) continue;
    if (get(x, H-2) !== TILE.FLOOR) continue;
    if (desks.some(d => (d.desk.x === x && d.desk.y === H-2) || (d.seat.x === x && d.seat.y === H-2))) continue;
    if (tryPlace(x, H-2, TILE.JUKE)){
      /* 시설 목록에도 올린다. placeFurniture 는 놓으면서 같이 올려 주는데
         여기는 격자에 직접 쓰는 길이라 빠진다 — 안 올리면 **처음 만든 사무실에서만**
         고양이가 음악을 들으러 안 온다(다시 켜면 worldFromGrid 가 격자에서 유도해서
         갑자기 오기 시작한다). 그런 종류의 어긋남이 제일 늦게 발견된다. */
      const use = TILE_INFO[TILE.JUKE] && TILE_INFO[TILE.JUKE].use;
      if (use) (facilities[use] = facilities[use] || []).push({ x, y: H-2 });
      jukeSet = true;
      break;
    }
  }

  /* --- 편의시설: 항상 있는 것 + 구매한 비품 --- */
  const wanted = [TILE.BED, TILE.LITTER, TILE.COOLER];
  if (!jukeSet) wanted.push(TILE.JUKE);
  /* owned[k] 는 **개수**다(옛 저장에서는 true — 그건 1로 읽힌다). 두 개 산 사람이
     사무실을 옮겼다고 한 개가 되면 안 된다. */
  Object.keys(SHOP_TILE).forEach(k => {
    const n = owned[k] === true ? 1 : (owned[k] | 0);
    for (let i = 0; i < n; i++) wanted.push(SHOP_TILE[k]);
  });
  if (tier >= 1) wanted.push(TILE.LEGAL);        // 법무팀이 왔을 때 앉는 자리
  // 바닥에 놓는 장식 — 사무실이 텅 비어 보이지 않게 한다
  for (let i = 0; i < 2 + tier; i++) wanted.push(TILE.PLANT);
  for (let i = 0; i < 1 + Math.floor(tier * 0.6); i++) wanted.push(TILE.SHELF);

  for (const t of wanted) placeFurniture(
    { W, H, grid:g, zone, desks, facilities, inbox, door:{x:doorX, y:H-1} }, t, rng, machineSide);

  /* 바닥 잡동사니 — 현금 뭉치, 서류 가방. 기능은 없고 격자도 안 건드린다.
     길찾기에 영향이 없어야 하니 걸어 다닐 수 있는 칸 위에 그림만 얹는다.
     사무실이 "정리된 전시장"이 아니라 "일하는 곳"으로 보이게 하는 장치. */
  const clutter = [];
  {
    const cand = [];
    for (let y = 2; y <= H-3; y++)
      for (let x = 1; x <= W-2; x++){
        if (get(x, y) !== TILE.FLOOR) continue;
        if (desks.some(d => d.seat.x === x && d.seat.y === y)) continue;
        if (Math.abs(x - doorX) < 3 && y >= H-4) continue;
        // 벽이나 가구에 기대어 있는 칸만 — 통로 한가운데 굴러다니면 이상하다
        const leans = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
          const t = get(x+dx, y+dy);
          return t !== TILE.FLOOR && t !== TILE.DOOR;
        });
        if (leans) cand.push({ x, y });
      }
    shuffle(cand);
    const want = 2 + Math.floor(tier * 0.9);
    for (let i = 0; i < cand.length && clutter.length < want; i++){
      const c = cand[i];
      if (clutter.some(p => Math.abs(p.x - c.x) <= 1 && Math.abs(p.y - c.y) <= 1)) continue;
      clutter.push({ x:c.x, y:c.y, i: clutter.length + tier });
    }
  }

  /* 벽에 거는 것 — 액자·화이트보드·창문·시계·선반.
     격자는 그대로 WALL로 두고 별도 목록으로 관리한다(길찾기에 영향 없음).

     벽면은 사무실에서 제일 넓은 면인데, 액자 두어 개만 걸려 있으면 방이 아니라
     창고로 보인다. 그래서 벽을 **한 줄씩 훑으면서 채운다** — 벽 하나를 이어진
     칸들의 줄(run)로 보고, 줄을 따라 물건을 차례로 놓는다.

     쓰는 벽은 바깥벽 둘뿐이다. 안쪽 칸막이는 넘겨다볼 수 있게 낮게(0.95) 세우는데
     거기에 그림을 걸면 3D 에서 허공에 뜬다. 북쪽 벽은 두 렌더러 모두 보여주고,
     서쪽 벽은 3D 에서만 보인다(도트판은 그 열을 아예 안 그린다) — face 로 구분해 둔다. */
  const wallDecor = [];
  {
    const runs = [];
    let run = [];
    for (let x = 1; x <= W-2; x++){
      if (get(x, 0) === TILE.WALL) run.push({ x, y:0, face:'n' });
      else if (run.length){ runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    run = [];
    for (let y = 1; y <= H-2; y++){
      if (get(0, y) === TILE.WALL) run.push({ x:0, y, face:'w' });
      else if (run.length){ runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);

    /* 몇 칸을 먹는가. 창문·화이트보드는 두 칸, 캣워크는 세 칸이다. */
    const SPAN = { [TILE.WINDOW]:2, [TILE.WHITEBOARD]:2, [TILE.CATWALK]:3 };
    /* 등급이 오를수록 벽도 같이 자란다. 사무실이 커지면 빈 벽도 같이 커지기 때문이다. */
    const budget = {
      [TILE.WINDOW]:     2 + Math.floor(tier / 2),
      [TILE.WHITEBOARD]: tier >= 1 ? 1 : 0,
      [TILE.CLOCK]:      1,
      /* 달력은 **한 장뿐**이고 반드시 있어야 한다(누르는 물건이다). 아래 ORDER 에서
         제일 먼저 나오는 자리에 놓고, 그래도 못 놓은 사무실은 아래에서 억지로 끼운다.
         게시판도 같다 — 둘 다 눌러야 여는 물건이라 없는 사무실이 나오면 안 된다. */
      [TILE.CAL]:        1,
      [TILE.BOARD]:      1,
      [TILE.WALLSHELF]:  1 + Math.floor(tier / 2),
      [TILE.CATWALK]:    tier >= 2 ? 1 : 0,
      /* DECOR 는 액자만이 아니라 게시판·달력·등록증·포스터·환풍구·배관이 전부 여기서 나온다
         (render3d 가 d.v 로 고른다). 종류가 늘었으므로 수도 같이 늘렸다 — 예전 값이면
         벽이 커져도 빈 면이 그만큼 커지기만 했다. */
      [TILE.DECOR]:      6 + tier * 2,
    };
    /* 순서를 정해 두고 돌린다 — 무작위로 뽑으면 액자만 다섯 개 붙은 벽이 나온다.
       줄마다 시작점을 옮겨서 북쪽 벽과 서쪽 벽이 같은 모양이 되지 않게 한다. */
    const ORDER = [TILE.WINDOW, TILE.CAL, TILE.DECOR, TILE.BOARD, TILE.WALLSHELF, TILE.DECOR, TILE.WINDOW,
                   TILE.WHITEBOARD, TILE.DECOR, TILE.CLOCK, TILE.DECOR, TILE.WINDOW,
                   TILE.CATWALK, TILE.DECOR, TILE.WALLSHELF, TILE.DECOR];
    let cursor = Math.floor(rng() * ORDER.length);

    runs.forEach(cells => {
      let i = 0;                                   // 줄 안에서의 위치
      let miss = 0;                                // 연속으로 못 놓은 횟수
      /* 벽 끝에 딱 붙이지 않는다. 모서리에 걸린 액자는 벽이 아니라 기둥에 붙은 것처럼 보인다. */
      if (cells.length > 4) i = 1;
      while (i < cells.length && miss < ORDER.length){
        const tile = ORDER[cursor % ORDER.length];
        cursor++;
        const span = SPAN[tile] || 1;
        if (!budget[tile] || i + span > cells.length){ miss++; continue; }
        miss = 0;
        budget[tile]--;
        const c = cells[i];
        /* v — 그림 고르기용 변주. 액자마다 다른 그림이 걸려야 벽이 벽지가 아니라 벽이 된다.
           저장에 같이 실어 두면 사무실을 다시 열어도 같은 그림이 걸려 있다. */
        wallDecor.push({ x:c.x, y:c.y, tile, span, face:c.face, v: Math.floor(rng() * 64) });
        /* 예전에는 무조건 한 칸을 띄웠다. 작은 것(액자·달력·시계)까지 그러면 벽이 성기다.
           두 칸 이상 먹는 것 뒤에만 띄운다 — 큰 것끼리 붙으면 그건 띠가 되니까. */
        i += span + (span > 1 ? 1 : 0);
      }
    });
  }

  /* 달력·게시판이 한 장도 안 걸린 사무실이 나올 수 있다(짧은 벽·창문이 다 먹은 벽).
     그 사무실에서는 날짜를 볼 방법도, 남을 구경할 방법도 없으므로 억지로 끼운다. */
  [[TILE.CAL, 5], [TILE.BOARD, 4]].forEach(([tile, v], i) => {
    if (wallDecor.some(d => d.tile === tile)) return;
    const spare = wallDecor.filter(d => d.tile === TILE.DECOR);
    const first = spare[i] || spare[0] || wallDecor[0];
    if (first) first.tile = tile;
    else if (get(1 + i, 0) === TILE.WALL)
      wallDecor.push({ x:1 + i, y:0, tile, span:1, face:'n', v });
  });

  /* rot — 플레이어가 배치 모드에서 돌려 둔 가구. 칸 번호 → 90° 단위 0~3.
     격자(grid)에는 못 싣는다. 한 칸이 타일 번호 하나짜리 바이트라 각도가 들어갈 자리가 없고,
     넓히면 저장·길찾기·검증이 전부 같이 넓어진다. 각도는 **그림에만** 쓰이는 값이므로
     따로 옆에 둔다 — 시뮬은 이 값을 한 번도 안 읽는다. */
  /* ── 가구 **위에** 얹힌 소품 ── (tops)
     격자는 한 칸에 하나다. 그런데 초·펜 홀더는 진짜로 **책상 위에 놓는** 물건이라,
     칸을 하나 먹는 것 자체가 물건을 안 닮았다(초 하나가 락커와 같은 자리를 차지한다).

     그래서 격자를 안 건드리고 **목록을 하나 더** 둔다: `{ x, y, tile }` — 그 칸의 가구
     위에 이 소품이 얹혀 있다는 뜻이다. 딸려 오는 성질이 이 설계의 이유다:
       · 바닥 칸을 안 먹으므로 **길을 막을 수가 없다** — 검사 자체가 필요 없다
       · 러그와 같은 방식이라(W.rugs) 저장·배치 모드가 이미 아는 모양이다
       · 한 칸에 하나씩만 — 책상 위에 초를 열 개 쌓는 건 배치가 아니라 사고다 */
  const world = { W, H, grid:g, zone, wallDecor, clutter, tops:[], lights:null, rot:{}, machineSide, tier, desks, facilities, inbox, door:{x:doorX, y:H-1}, seed };

  /* --- 연결성 검사: 문에서 못 가는 자리는 버린다 --- */
  const reach = floodFrom(world, { x:doorX, y:H-2 });
  world.desks = desks.filter(d => reach.has(d.seat.y * W + d.seat.x));
  Object.keys(world.facilities).forEach(k => {
    world.facilities[k] = world.facilities[k].filter(f =>
      adjacentFree(world, f).some(p => reach.has(p.y * W + p.x)));
    if (!world.facilities[k].length) delete world.facilities[k];
  });
  return world;
}

function tileAt(w, x, y){
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return TILE.WALL;
  return w.grid[y * w.W + x];
}
function walkable(w, x, y){ return WALKABLE.has(tileAt(w, x, y)); }

function adjacentFree(w, p){
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy]) => ({ x:p.x+dx, y:p.y+dy }))
    .filter(q => walkable(w, q.x, q.y));
}

function floodFrom(w, start){
  const seen = new Set();
  if (!walkable(w, start.x, start.y)) return seen;
  const q = [start]; seen.add(start.y * w.W + start.x);
  while (q.length){
    const c = q.shift();
    for (const n of adjacentFree(w, c)){
      const k = n.y * w.W + n.x;
      if (!seen.has(k)){ seen.add(k); q.push(n); }
    }
  }
  return seen;
}

/* BFS 최단경로. from/to 는 걸을 수 있는 타일. */
function findPath(w, from, to){
  if (from.x === to.x && from.y === to.y) return [];
  const W = w.W, start = from.y*W + from.x, goal = to.y*W + to.x;
  if (!walkable(w, to.x, to.y)) return null;
  const prev = new Int32Array(W * w.H).fill(-2);
  prev[start] = -1;
  const q = [from];
  let head = 0;
  while (head < q.length){
    const c = q[head++];
    if (c.y*W + c.x === goal) break;
    for (const n of adjacentFree(w, c)){
      const k = n.y*W + n.x;
      if (prev[k] === -2){ prev[k] = c.y*W + c.x; q.push(n); }
    }
  }
  if (prev[goal] === -2) return null;
  const path = [];
  let cur = goal;
  while (cur !== start && cur !== -1){
    path.push({ x: cur % W, y: Math.floor(cur / W) });
    cur = prev[cur];
  }
  return path.reverse();
}

/* 특정 용도의 시설 중 가장 가까운 접근 타일을 찾는다 */
function nearestUse(w, use, from){
  const list = w.facilities[use];
  if (!list || !list.length) return null;
  let best = null, bd = Infinity;
  for (const f of list){
    for (const p of adjacentFree(w, f)){
      const d = Math.abs(p.x - from.x) + Math.abs(p.y - from.y);
      if (d < bd){ bd = d; best = { spot:p, target:f }; }
    }
  }
  return best;
}

/* 가장 가까운 곳만 고르면 가구를 여러 개 놔도 한 개만 닳는다. 캣타워를 두 대 사도
   늘 같은 쪽에만 고양이가 있고, 사무실은 넓은데 다니는 길은 하나가 된다.
   그래서 가까운 것 몇 개 중에서 고른다 — 가까울수록 뽑힐 확률이 높되, 독점은 아니다.
   rnd 는 안 주면 Math.random. (생성기는 시드 난수를 쓰므로 받을 수 있게 열어 둔다) */
function pickUse(w, use, from, rnd){
  const list = w.facilities[use];
  if (!list || !list.length) return null;
  const cand = [];
  for (const f of list)
    for (const p of adjacentFree(w, f))
      cand.push({ spot:p, target:f, d: Math.abs(p.x - from.x) + Math.abs(p.y - from.y) });
  if (!cand.length) return null;
  cand.sort((a, b) => a.d - b.d);
  /* 가중치는 거리에 반비례. 바로 옆 것과 사무실 반대편 것이 같은 확률이면
     고양이가 아니라 랜덤 워크가 된다. */
  const top = cand.slice(0, 6);
  let sum = 0;
  for (const c of top) sum += (c.w = 1 / (1 + c.d * 0.6));
  let r = (rnd || Math.random)() * sum;
  for (const c of top){ r -= c.w; if (r <= 0) return c; }
  return top[0];
}


/* ============================================================
   가구 한 개를 기존 사무실에 놓는다.
   생성할 때도, 비품을 새로 살 때도 같은 함수를 쓴다 —
   비품 하나 샀다고 사무실을 새로 생성하면 기존 가구가 전부 이사한다.
   ============================================================ */
function placeFurniture(w, tile, rnd, machineSide){
  const W = w.W, H = w.H, g = w.grid, zone = w.zone;
  const at = (x, y) => y * W + x;
  const get = (x, y) => (x<0||y<0||x>=W||y>=H) ? TILE.WALL : g[at(x,y)];
  const set = (x, y, v) => { if (x>=0 && y>=0 && x<W && y<H) g[at(x,y)] = v; };
  const rng = rnd || Math.random;
  const probe = { W, H, grid:g };
  const entry = { x:w.door.x, y:H-2 };

  const keepsConnected = () => {
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  };
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  const isSeat = (x, y) => w.desks.some(d => d.seat.x === x && d.seat.y === y);
  const freeAround = p => [[1,0],[-1,0],[0,1],[0,-1]]
    .filter(([dx,dy]) => get(p.x+dx, p.y+dy) === TILE.FLOOR).length;

  /* 이미 놓인 가구 — 이들의 진입로를 막으면 안 된다 */
  const placed = [];
  for (let y = 1; y < H-1; y++)
    for (let x = 1; x < W-1; x++){
      const t = g[at(x,y)];
      if (t !== TILE.FLOOR && t !== TILE.WALL && t !== TILE.DOOR &&
          t !== TILE.DESK && t !== TILE.DESK_R && t !== TILE.FILLER) placed.push({ x, y });
    }
  const crowded = p => placed.some(q => Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1);
  /* ── 진입로를 지켜야 하는 것은 **쓰는 물건**뿐이다 ──
     예전에는 `placed.every(p => freeAround(p) > 0)` 이었다 — 「모든 가구의 앞이 열려
     있어야 한다」. 두 가지가 틀렸다.

     첫째, **이미 막힌 가구가 하나라도 있으면 그때부터 아무것도 못 놓는다**(every 가
     처음부터 거짓이다). 지킬 것은 「막힌 것을 열어라」가 아니라 「열린 것을 막지 마라」다.

     둘째, **아무도 안 가는 가구까지 지키고 있었다.** 커피 머신·화장실처럼 시뮬이 걸어가서
     쓰는 것(TILE_INFO 의 use)은 앞이 막히면 정말로 못 쓰게 된다. 그런데 락커·화분은
     아무도 가지 않으므로 그 앞이 막혀도 아무 일도 안 일어난다. 전부를 지키게 해 두니
     방이 좀 차면 **놓을 수 있는 칸이 남아 있는데도 전부 거부**됐다 — 실측으로 그 방에는
     연결성까지 통과하는 칸이 일곱 개 있었고, 그 일곱 개가 모두 이 규칙에 걸렸다.

     길이 끊기는 것은 별개로 계속 막는다(keepsConnected) — 그게 진짜 지켜야 하는 것이다. */
  const usedTile = p => {
    const tt = g[at(p.x, p.y)];
    return !!(typeof TILE_INFO !== 'undefined' && TILE_INFO[tt] && TILE_INFO[tt].use);
  };
  const openBefore = placed.filter(p => usedTile(p) && freeAround(p) > 0);

  /* 후보 자리. 벽면만 쓰면 상단 벽에 한 줄로 늘어서고,
     안쪽만 쓰면 통로 한가운데 물건이 선다. 둘을 섞는다. */
  const breakSpots = [], wallSpots = [], innerSpots = [], meetSpots = [], loungeSpots = [];
  /* **모든 후보.** 분류 목록만 두면 어느 목록에도 안 들어가는 칸이 생긴다 —
     탕비실(zone 1) 안쪽처럼 벽에 안 닿는 칸이 그렇다(`z===1 && !touchesWall` 이
     아무 목록에도 안 담겼다). 그 방에서는 빈 바닥이 스무 칸 남아도 **아무것도**
     못 놓았다. 마지막 패스는 이 목록을 본다: 분류는 취향이고, 놓이는 건 약속이다. */
  const allSpots = [];
  for (let y = 1; y <= H-2; y++){
    for (let x = 1; x <= W-2; x++){
      if (get(x, y) !== TILE.FLOOR) continue;
      if (isSeat(x, y)) continue;
      if (Math.abs(x - w.inbox.x) + Math.abs(y - w.inbox.y) < 2) continue;
      if (Math.abs(x - w.door.x) < 2 && y >= H-3) continue;
      allSpots.push({ x, y });
      const touchesWall = get(x-1,y) === TILE.WALL || get(x+1,y) === TILE.WALL
                       || get(x,y-1) === TILE.WALL || get(x,y+1) === TILE.WALL;
      const z = zone ? zone[at(x,y)] : 0;
      if (z === 1){ if (touchesWall) breakSpots.push({ x, y }); }
      else if (z === 2){ meetSpots.push({ x, y }); }
      else if (z === 3){ loungeSpots.push({ x, y }); }
      else if (touchesWall) wallSpots.push({ x, y });
      else innerSpots.push({ x, y });
    }
  }
  shuffle(allSpots);
  shuffle(wallSpots); shuffle(innerSpots); shuffle(loungeSpots);
  const spots = breakSpots.slice();
  for (let i = 0; i < Math.max(wallSpots.length, innerSpots.length); i++){
    if (wallSpots[i]) spots.push(wallSpots[i]);
    if (innerSpots[i]) spots.push(innerSpots[i]);
  }
  const wallOnly = breakSpots.concat(wallSpots);

  /* 어느 벽에 닿았는지. 위치만 보면 칸막이에 붙은 안쪽 칸까지 바깥벽으로 샌다. */
  const side = p => {
    if (p.y <= 2   && get(p.x, p.y-1) === TILE.WALL) return 'top';
    if (p.x <= 2   && get(p.x-1, p.y) === TILE.WALL) return 'left';
    if (p.x >= W-3 && get(p.x+1, p.y) === TILE.WALL) return 'right';
    if (p.y >= H-3 && get(p.x, p.y+1) === TILE.WALL) return 'bottom';
    return 'inner';
  };
  const ms = machineSide || w.machineSide || 'left';
  const bySide = which => wallSpots.filter(p => side(p) === which)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const machineSpots = bySide(ms).concat(bySide(ms === 'left' ? 'right' : 'left'), bySide('top'));

  const cat = FURN_CAT[tile] || null;
  const list = cat === 'break' ? breakSpots.concat(wallOnly)
             : cat === 'rest'  ? loungeSpots.concat(breakSpots, wallOnly)   // 쉬는 건 라운지 먼저
             : cat === 'wall' ? wallOnly                      // 벽에 붙어야만 하는 것
             : cat === 'machine' ? machineSpots.concat(wallOnly)
             : cat === 'meet'  ? meetSpots.concat(innerSpots, spots)        // 회의는 회의실 먼저
             : cat === 'decor' ? loungeSpots.concat(spots)
             : FURN_BIG[tile] ? wallOnly : spots;
  const spaced = cat !== 'machine';   // 설비는 벽을 따라 붙어 서는 게 맞다

  const tryAt = (x, y) => {
    const wide = FURN_SPAN[tile] || 1;
    if (wide > 1 && (get(x+1, y) !== TILE.FLOOR || isSeat(x+1, y))) return false;
    const prev = get(x, y), prevR = wide > 1 ? get(x+1, y) : null;
    set(x, y, tile);
    if (wide > 1) set(x+1, y, TILE.FILLER);
    const ok = freeAround({x,y}) > 0 && openBefore.every(p => freeAround(p) > 0) && keepsConnected();
    if (!ok){ set(x, y, prev); if (wide > 1) set(x+1, y, prevR); return false; }
    return true;
  };

  /* 3번째 패스는 **분류를 버린다**. 벽에만 놓는 물건은 벽자리가 다 차면 영영 못 놓이는데,
     그때 조용히 사라지면 산 사람은 돈만 잃는다(기본 사무실 10×8 에서는 벽 쉼터가
     들어갈 자리가 아예 0이었다). 자리 맞추기는 취향이고, 산 물건이 나타나는 건 약속이다.
     그래도 못 놓으면 null 을 돌려주고, 부른 쪽이 그걸 사람에게 말한다. */
  /* 4번째 패스는 **작은 소품에만** 있다. 앞의 셋은 「앞에 통로 두 칸」을 요구하는데
     (freeAround >= 2), 초·펜 홀더는 그럴 필요가 없다 — 그 규칙 때문에 방이 좀 차면
     소품을 영영 못 놓았다(실제로 「놓을 자리가 없습니다」가 그것이었다).
     한 칸만 열려 있으면 된다: 칸이 완전히 봉해지면 그건 벽 속에 넣는 것이라 여전히 막는다.
     연결성 검사(tryAt 안의 keepsConnected)는 그대로다 — 길을 막는 자리는 못 쓴다. */
  const small = FURN_SMALL.has(tile);
  const anywhere = spots.concat(innerSpots, loungeSpots, meetSpots, allSpots);
  const passes = [
    { list, spacedPass:spaced, need:2 },        // 분류대로, 띄엄띄엄
    { list, spacedPass:false, need:2 },         // 분류대로, 붙여도 됨
    { list:anywhere, spacedPass:false, need:2 },                      // 아무 데나
    ...(small ? [{ list:anywhere, spacedPass:false, need:1 }] : []),  // 소품은 구석도
  ];
  for (const { list: L, spacedPass, need } of passes){
    for (const sp of L){
      if (get(sp.x, sp.y) !== TILE.FLOOR) continue;
      if (freeAround(sp) < need) continue;
      if (spacedPass && crowded(sp)) continue;
      /* 두 칸짜리는 오른쪽이 막혔으면 왼쪽으로 한 칸 물러서서도 대 본다 —
         벽에 붙는 물건은 오른쪽이 벽인 자리가 많아서, 이것만으로 놓이는 경우가 꽤 있다. */
      const wide = FURN_SPAN[tile] || 1;
      const at2 = tryAt(sp.x, sp.y) ? sp
                : (wide > 1 && get(sp.x-1, sp.y) === TILE.FLOOR && !isSeat(sp.x-1, sp.y)
                   && tryAt(sp.x-1, sp.y)) ? { x:sp.x-1, y:sp.y } : null;
      if (!at2) continue;
      const use = TILE_INFO[tile] && TILE_INFO[tile].use;
      if (use) (w.facilities[use] = w.facilities[use] || []).push({ x:at2.x, y:at2.y });
      return { x:at2.x, y:at2.y };
    }
  }
  return null;
}

/* CD 플레이어를 놓을 문간 자리 후보 — 아래 벽줄 바로 위(y=H-2)를 **문에서 가까운 순**으로.

   가장자리(x=1 · x=W-2)를 후보에 넣었다가 한 번 물렸다: 무대 위에 결재함·경영 패널이
   반투명하게 얹혀 있어서(#app.stageui), 왼쪽 끝에 놓인 가구는 **눌러도 패널이 먹는다.**
   가구가 화면에 보이는데 안 눌리는 건 없는 것보다 나쁘다. 문 근처는 가운데라 안 덮인다. */
function jukeSpots(W, H, doorX){
  const xs = [];
  for (let x = 1; x <= W - 2; x++) xs.push(x);
  /* 문에서 가까운 순. 다만 **양 끝 열은 뒤로 미룬다** — 무대 위에 결재함·경영 패널이
     반투명하게 얹혀 있어서(#app.stageui) 가장자리 가구는 패널에 덮여 눌리지 않는다. */
  const edge = x => (x <= 1 || x >= W - 2) ? 1 : 0;
  return xs.sort((a, b) => edge(a) - edge(b)
                        || Math.abs(a - doorX) - Math.abs(b - doorX)
                        || a - b)
           .filter(x => Math.abs(x - doorX) >= 1);      // 문 바로 위는 통로다
}

/* 옛 저장에 벽걸이 달력을 걸어 준다.

   CD 플레이어와 같은 함정이다(아래 ensureJuke) — 사무실은 저장된 격자에서 그대로
   되살아나므로, 이미 놀고 있던 사람의 벽에는 달력이 영영 안 걸린다. 그런데 기한을
   고치고 미루는 문이 그 달력이다.

   벽 장식은 길찾기에 영향이 없으므로 자리 걱정이 없다. **이미 달력 그림이 걸려 있던
   액자칸**(DECOR 의 v%9===5 변주가 달력 그림이다 — render3d)을 먼저 승격시킨다.
   그게 없으면 아무 액자 하나, 액자도 없으면 벽칸 하나를 새로 쓴다.
   벽에 걸려 있던 그림이 그대로 진짜 달력이 되는 쪽이 "새 가구가 생겼다"보다 조용하다. */
/* 옛 저장에 제휴 게시판을 걸어 준다 — 달력과 같은 이유, 같은 방법이다.
   이미 코르크 게시판 그림이던 액자(v%9===4)를 먼저 승격시킨다. */
function ensureBoard(w){
  if (!w) return false;
  const list = w.wallDecor || (w.wallDecor = []);
  if (list.some(d => d.tile === TILE.BOARD)) return false;
  const pic = list.find(d => d.tile === TILE.DECOR && ((d.v | 0) % 9) === 4)
           || list.find(d => d.tile === TILE.DECOR);
  if (pic){ pic.tile = TILE.BOARD; pic.span = 1; return true; }
  for (let x = 1; x <= w.W - 2; x++){
    if (w.grid[x] !== TILE.WALL) continue;
    if (list.some(d => d.face !== 'w' && x >= d.x && x < d.x + (d.span || 1))) continue;
    list.push({ x, y:0, tile:TILE.BOARD, span:1, face:'n', v:4 });
    return true;
  }
  return false;
}

/* 벽에 거는 물건을 **나중에** 걸어 준다. ensureBoard·ensureCal 이 각자 하던 일을
   한 벌로 뺀 것 — 견본책은 상점에서 사는 물건이라 사무실을 넓힐 때마다 다시 걸어야 한다.
   벽 장식은 길찾기와 무관하므로 자리 걱정이 없다. 액자 하나를 승격시키고,
   액자가 없으면 북쪽 벽의 빈 칸을 쓴다. */
function ensureWallItem(w, tile, v){
  if (!w) return false;
  const list = w.wallDecor || (w.wallDecor = []);
  if (list.some(d => d.tile === tile)) return false;
  const pic = list.find(d => d.tile === TILE.DECOR);
  if (pic){ pic.tile = tile; pic.span = 1; return true; }
  for (let x = 1; x <= w.W - 2; x++){
    if (w.grid[x] !== TILE.WALL) continue;
    if (list.some(d => d.face !== 'w' && x >= d.x && x < d.x + (d.span || 1))) continue;
    list.push({ x, y:0, tile, span:1, face:'n', v: v || 0 });
    return true;
  }
  return false;
}

/* 벽에 거는 것을 **한 장 더** 건다. ensureWallItem 은 「없으면 건다」라서 두 번째부터
   아무 일도 안 하는데, 커튼처럼 여럿 걸리는 물건에는 그게 조용한 실패가 된다.

   자리는 액자를 승격시키지 않고 **빈 벽칸**에서만 찾는다 — 커튼 넉 장을 사면 액자가
   넉 장 사라지는 건 산 사람이 기대한 일이 아니다. 북쪽 벽을 먼저, 없으면 서쪽 벽.
   벽 장식은 길찾기와 무관하므로 자리 걱정은 「빈 칸이 있는가」뿐이다. */
function addWallItem(w, tile, v){
  if (!w) return false;
  const list = w.wallDecor || (w.wallDecor = []);
  const taken = (face, i) => list.some(d => (d.face === 'w') === (face === 'w')
    && i >= (face === 'w' ? d.y : d.x) && i < (face === 'w' ? d.y : d.x) + (d.span || 1));
  for (let x = 1; x <= w.W - 2; x++)
    if (w.grid[x] === TILE.WALL && !taken('n', x)){
      list.push({ x, y:0, tile, span:1, face:'n', v: v | 0 });
      return true;
    }
  for (let y = 1; y <= w.H - 2; y++)
    if (w.grid[y * w.W] === TILE.WALL && !taken('w', y)){
      list.push({ x:0, y, tile, span:1, face:'w', v: v | 0 });
      return true;
    }
  return false;
}

function ensureCal(w){
  if (!w) return false;
  const list = w.wallDecor || (w.wallDecor = []);
  if (list.some(d => d.tile === TILE.CAL)) return false;
  const pic = list.find(d => d.tile === TILE.DECOR && ((d.v | 0) % 9) === 5)
           || list.find(d => d.tile === TILE.DECOR);
  if (pic){ pic.tile = TILE.CAL; pic.span = 1; return true; }
  /* 벽 장식이 하나도 없는 저장(아주 옛 것). 북쪽 벽에서 빈 칸을 찾아 건다. */
  for (let x = 1; x <= w.W - 2; x++){
    if (w.grid[x] !== TILE.WALL) continue;
    if (list.some(d => d.face !== 'w' && x >= d.x && x < d.x + (d.span || 1))) continue;
    list.push({ x, y:0, tile:TILE.CAL, span:1, face:'n', v:5 });
    return true;
  }
  return false;
}

/* 옛 저장에 CD 플레이어를 끼워 넣는다.

   배치는 저장된 격자에서 그대로 되살아난다(worldFromGrid) — 그게 "내 사무실"을 지키는
   핵심인데, 새 가구가 생겼을 때는 그 성질이 그대로 함정이 된다. **이미 놀고 있던 사람의
   사무실에는 CD 플레이어가 영영 안 생긴다.** 사무실을 옮기는 분기(3·6·10…)까지 기다려야
   하고, 그때까지는 음악을 고를 방법이 아예 없다 — 그런데 버튼은 이미 뗐다.

   자리는 새 사무실과 같은 규칙이다: 문 옆, 결재함 반대쪽. 거기가 막혀 있으면
   일반 배치기에 맡긴다. 넣었으면 true — 부른 쪽이 저장을 다시 뜬다. */
function ensureJuke(w){
  if (!w || !w.grid) return false;
  for (let i = 0; i < w.grid.length; i++) if (w.grid[i] === TILE.JUKE) return false;

  const W = w.W, H = w.H, doorX = w.door.x;
  const probe = { W, H, grid: w.grid };
  const entry = { x: doorX, y: H - 2 };
  const connected = () => {
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  };
  const isSeat = (x, y) => (w.desks || []).some(d => d.seat.x === x && d.seat.y === y);

  for (const x of jukeSpots(W, H, doorX)){
    if (x === w.inbox.x && H-2 === w.inbox.y) continue;
    if (w.grid[(H-2)*W + x] !== TILE.FLOOR || isSeat(x, H-2)) continue;
    w.grid[(H-2)*W + x] = TILE.JUKE;
    if (connected()){
      const use = TILE_INFO[TILE.JUKE] && TILE_INFO[TILE.JUKE].use;
      if (use) (w.facilities[use] = w.facilities[use] || []).push({ x, y: H-2 });
      return true;
    }
    w.grid[(H-2)*W + x] = TILE.FLOOR;
  }
  /* 문간이 막힌 사무실(직접 옮겨 놨을 수 있다) — 남은 자리 아무 데나 */
  return !!placeFurniture(w, TILE.JUKE, Math.random, w.machineSide);
}

/* 저장된 격자만으로 월드를 되살린다. 배치가 절대 안 바뀌게 하는 핵심. */
function worldFromGrid(saved){
  const W = saved.w, H = saved.h;
  const w = {
    W, H, tier: saved.tier, seed: saved.seed, machineSide: saved.machineSide || 'left',
    grid: Uint8Array.from(saved.grid), zone: Uint8Array.from(saved.zone || []),
    wallDecor: saved.wallDecor || [], clutter: saved.clutter || [], tops: saved.tops || [],
    lights: Array.isArray(saved.lights) ? saved.lights : null,
    rot: saved.rot || {},
    desks: [], facilities: {}, inbox: { x:1, y:H-2 }, door: { x:Math.floor(W/2), y:H-1 },
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const t = w.grid[y*W + x];
    if (t === TILE.DESK || t === TILE.DESK_R){ w.desks.push({ desk:{x,y}, seat:{x, y:y+1} }); continue; }
    if (t === TILE.INBOX){ w.inbox = { x, y }; continue; }
    if (t === TILE.DOOR){ w.door = { x, y }; continue; }
    const use = TILE_INFO[t] && TILE_INFO[t].use;
    if (use) (w.facilities[use] = w.facilities[use] || []).push({ x, y });
  }
  w.desks.sort((a, b) => (a.desk.y - b.desk.y) || (a.desk.x - b.desk.x));
  return w;
}
