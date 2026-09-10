/* ============================================================
   game.js — 경제, 결재함, 분기, 저장
   ============================================================ */

const SAVE_KEY = 'copycat.save.v1';

const SHOP = [
  { id:'coffee',  em:'☕', n: L({ ko:'커피머신',    en:'Coffee Machine', ja:'コーヒーマシン' }),
    d: L({ ko:'전 직원 생산 +15% · 카페인 욕구 해소', en:'All staff +15% · quenches caffeine', ja:'全員の生産+15%・カフェイン解消' }),
    cost:320,     tier:0, prod:0.15 },
  { id:'copier',  em:'🖨️', n: L({ ko:'복사기',      en:'Copier',         ja:'コピー機' }),
    d: L({ ko:'결재 1건당 멸치 ×1.8',               en:'Anchovies ×1.8 per approval',        ja:'決裁1件あたり煮干し×1.8' }),
    cost:900,     tier:1, todoMul:1.8 },
  { id:'tower',   em:'🗼', n: L({ ko:'캣타워',      en:'Cat Tower',      ja:'キャットタワー' }),
    d: L({ ko:'욕구 감소 -30% · 낮잠 장소 추가',     en:'Needs drain −30% · adds a nap spot', ja:'欲求減少−30%・昼寝場所追加' }),
    cost:1600,    tier:1, decay:0.70 },
  { id:'scratch', em:'🪵', n: L({ ko:'스크래처 존', en:'Scratcher Zone', ja:'爪とぎゾーン' }),
    d: L({ ko:'욕구 회복 속도 ×1.6',                en:'Need recovery ×1.6',                 ja:'欲求回復速度×1.6' }),
    cost:5200,    tier:2, recover:1.6 },
  { id:'server',  em:'🖥️', n: L({ ko:'건조실',      en:'Drying Room',    ja:'乾燥室' }),
    d: L({ ko:'전 직원 생산 +35% (따뜻해서 인기)',   en:'All staff +35% (warm & popular)',    ja:'全員の生産+35%（暖かくて人気）' }),
    cost:14000,   tier:3, prod:0.35 },
  /* 닫혀 있는 동안의 수익은 기본이 0이다. 이 비품이 그걸 여는 유일한 열쇠 —
     밥 주는 사람이 있으면 문 닫힌 사무실도 근무시간엔 조금 돌아간다. */
  { id:'feeder',  em:'🍚', n: L({ ko:'자동급식기',  en:'Auto Feeder',    ja:'自動給餌器' }),
    d: L({ ko:'꺼둔 동안에도 근무시간엔 25%로 돌아감 (최대 8시간)',
           en:'Runs at 25% during work hours even while closed (up to 8h)',
           ja:'閉じている間も勤務時間は25%で稼働（最大8時間）' }),
    cost:26000,   tier:3, offline:1.0 },
  /* 벽 쉼터 — 바닥이 가구로 꽉 차도 벽 위는 비어 있다.
     그리고 위에 앉은 고양이는 책상·의자에 안 가려서, 미학만이 아니라 가독성 문제이기도 하다. */
  { id:'perch',   em:'🧗', n: L({ ko:'벽 쉼터',      en:'Wall Perch',     ja:'壁の休憩棚' }),
    d: L({ ko:'벽에 붙는 3단 선반 · 낮잠 장소 추가 · 욕구 감소 -15%',
           en:'Three-tier wall shelf · adds a nap spot · needs drain −15%',
           ja:'壁付け3段棚・昼寝場所追加・欲求減少−15%' }),
    cost:2600,    tier:2, decay:0.85 },
  /* 놀잇감 둘. 값이 싸고 등급이 낮은 대신 효과도 작다 —
     이것들의 진짜 값어치는 숫자가 아니라 **고양이가 자리를 뜨는 이유**가 하나 더 생기는 것이다.
     여러 개 놓을수록 사무실이 붐빈다. */
  { id:'yarn',    em:'🧶', n: L({ ko:'털뭉치',       en:'Yarn Ball',      ja:'毛糸玉' }),
    d: L({ ko:'놀이 장소 · 재미 회복이 빠릅니다 · 욕구 감소 -5%',
           en:'A play spot · fun recovers fast · needs drain −5%',
           ja:'遊び場・楽しさの回復が速い・欲求減少−5%' }),
    cost:180,     tier:0, decay:0.95 },
  { id:'toy',     em:'🪶', n: L({ ko:'낚싯대 장난감', en:'Feather Wand',   ja:'猫じゃらし' }),
    d: L({ ko:'놀이 장소 · 재미 회복이 매우 빠름 · 욕구 회복 ×1.15',
           en:'A play spot · fun recovers very fast · need recovery ×1.15',
           ja:'遊び場・楽しさの回復がとても速い・欲求回復×1.15' }),
    cost:1200,    tier:1, recover:1.15 },
  /* 놀잇감 셋째 — 값이 세 배지만 하는 일은 같은 계열이다(play 자리 하나).
     차이는 **조이스틱이 둘**이라는 것: 털뭉치는 한 마리가 굴리고 오락기는 둘이 붙는다.
     효과를 해먹과 같은 1.3 으로 둔 이유 — 여기서 숫자를 더 올리면 「욕구 회복」 항목이
     넷째가 되어 곱이 3을 넘고, 그때부터 고양이는 아무 데도 안 가고 자리에만 앉아 있다. */
  { id:'game',    em:'🕹️', n: L({ ko:'사내 오락기',  en:'Arcade Cabinet', ja:'社内アーケード' }),
    d: L({ ko:'놀이 장소 · 두 마리가 같이 붙습니다 · 욕구 회복 속도 ×1.3',
           en:'A play spot · fits two cats at once · need recovery ×1.3',
           ja:'遊び場・2匹で一緒に遊べる・欲求回復速度×1.3' }),
    cost:12000,   tier:3, recover:1.3 },
  /* 도배 견본책 — 이 게임에서 **생산 효과가 하나도 없는 두 번째 물건**이다.
     첫째는 음반이었고(10번), 그래서 음반은 상점이 아니라 💿 에 있다. 인테리어도 같은
     성격이라 벽지·바닥을 상점 목록에 스물여덟 줄로 붓지 않고, **문 하나만 판다.**
     한 번 사면 그 안에서 고르는 건 전부 무료다(4번: 안 산 것은 목록에 없다). */
  { id:'binder',  em:'📕', n: L({ ko:'인테리어 견본책', en:'Sample Binder', ja:'内装の見本帳' }),
    d: L({ ko:'벽에 걸리는 견본 바인더 · 벽지 · 바닥 · 러그 · 가구 톤을 고를 수 있게 됩니다',
           en:'A sample binder on the wall · lets you pick wallpaper, flooring, rugs and furniture tone',
           ja:'壁に掛かる見本帳・壁紙／床／ラグ／家具のトーンを選べるようになります' }),
    cost:480,     tier:0, wallTile:'BINDER' },
  { id:'snack',   em:'🍪', n: L({ ko:'간식바',       en:'Snack Bar',      ja:'おやつバー' }),
    d: L({ ko:'전 직원 생산 +12% · 카페인 욕구 해소',
           en:'All staff +12% · quenches caffeine',
           ja:'全員の生産+12%・カフェイン解消' }),
    cost:3400,    tier:2, prod:0.12 },
  { id:'hammock', em:'🛏️', n: L({ ko:'해먹',        en:'Hammock',        ja:'ハンモック' }),
    d: L({ ko:'낮잠 장소 추가 · 욕구 회복 속도 ×1.3',
           en:'Adds a nap spot · need recovery ×1.3',
           ja:'昼寝場所追加・欲求回復速度×1.3' }),
    cost:8800,    tier:3, recover:1.3 },
  { id:'meeting', em:'🪑', n: L({ ko:'회의 테이블', en:'Meeting Table',  ja:'会議テーブル' }),
    d: L({ ko:'결재 성과(KPI) ×1.4',                en:'Approval KPI ×1.4',                  ja:'決裁成果(KPI)×1.4' }),
    cost:60000,   tier:4, kpiMul:1.4 },
  { id:'gym',     em:'🏋️', n: L({ ko:'사내 헬스장', en:'Office Gym',     ja:'社内ジム' }),
    d: L({ ko:'전 직원 생산 +55%',                  en:'All staff +55%',                     ja:'全員の生産+55%' }),
    cost:150000,  tier:4, prod:0.55 },
  { id:'lab',     em:'🔬', n: L({ ko:'정제실',      en:'Refinery',       ja:'精製室' }),
    d: L({ ko:'전 직원 생산 +90% · 승진비 -20%',     en:'All staff +90% · promotions −20%',   ja:'全員の生産+90%・昇進費−20%' }),
    cost:420000,  tier:5, prod:0.90, promoDisc:0.8 },
  { id:'rocket',  em:'🚀', n: L({ ko:'사내 로켓',   en:'Company Rocket', ja:'社用ロケット' }),
    d: L({ ko:'전 직원 생산 +120%',                 en:'All staff +120%',                    ja:'全員の生産+120%' }),
    cost:1500000, tier:6, prod:1.20 },

  /* ============================================================
     가구 카탈로그 (2026-09-01)

     위의 비품과 **같은 표에 살지만 다른 물건이다.** 비품은 저마다 다른 숫자를
     건드리고(생산·욕구·KPI·오프라인), 가구는 전부 **쾌적도 하나**에만 기여한다.
     그래서 `furn` 이 붙어 있고, 상점 화면은 그 표시로 둘을 갈라 그린다.

     ── 왜 효과를 하나로 묶었나 ──

     스물넷에 각자 다른 효과를 달면 표가 스물네 줄 느는 게 아니라 **곱이 스물네 겹**이
     된다. 이 게임은 정제실 하나가 +90% 인 게임이고, +2% 짜리 스물넷이 그 옆에 붙으면
     플레이어가 읽을 수 있는 숫자가 아니게 된다. 그리고 무엇보다 가구를 고르는 이유가
     「예뻐서」가 아니라 「효율 좋아서」가 되는데, 그건 인테리어가 아니라 스프레드시트다.

     쾌적도는 **개수만 센다**(comfort). 무엇을 놓든 같은 값이라, 어떤 가구를 살지는
     순수하게 취향의 문제로 남는다. 그게 이 카탈로그가 있어야 하는 이유다.

     ── 가구도 등급을 탄다 (2026-09-02) ──

     처음에는 전부 tier 0 이었다(「가구의 관문은 등급이 아니라 돈」). 그런데 그러면
     상점 화면에 **규칙이 둘**이 된다: 비품은 열리고 가구는 처음부터 다 있다.
     한 화면에서 잠금 규칙이 둘이면 「이건 왜 안 열리지」를 물건마다 따로 배워야 하고,
     스물다섯이 한꺼번에 깔린 첫 화면은 고를 것이 너무 많아 아무것도 안 고르게 된다.

     그래서 **가구도 등급으로 열린다.** 값이 싼 것부터 차례로 — 첫 사무실에서는
     상자·메모·화분 같은 것들만 있고, 소파는 사옥에 가야 나온다. 4번 규칙(안 산 것은
     목록에 없다)이 그대로 적용되므로 잠긴 가구는 **아예 안 보인다**(개수만 알린다).
     ============================================================ */
  ...furnCatalog(),
];

/* 카탈로그 스물셋. 한 줄에 하나씩 스물셋을 손으로 적으면 이름 셋(ko/en/ja) 때문에
   백 줄이 넘는데, 그중 다른 것은 이름·값·분류 셋뿐이다. 표로 적고 펼친다. */
function furnCatalog(){
  /* [id, 분류, 이모지, 값, 등급, 한국어, English, 日本語]

     **등급은 값을 따라간다.** 싼 것이 먼저 열린다 — 종이상자 지점에서 소파를 파는
     것보다 박스와 메모를 파는 쪽이 그 사무실의 이야기에 맞고, 값이 곧 순서라서
     「왜 이건 아직 안 열리지」를 따로 배울 필요가 없다.
     한 등급에 일곱→여섯→다섯→넷→둘→하나. 사무실을 옮길 때마다 목록이 눈에 띄게
     늘지만, 뒤로 갈수록 새로 열리는 수가 줄어 마지막까지 아껴 둘 것이 남는다. */
  /* ── 벽에 거는 것은 **팔지 않는다** ──
     스티커 메모·커튼이 여기 있었는데 뺐다. 파는 물건은 사람이 **놓고 옮기고 치울 수
     있어야** 하는데 벽 물건은 그 셋이 다 안 된다: 놓는 길이 따로고(ensureWallItem),
     배치 모드에서 집히지도 않는다(js/edit.js — 벽은 방의 일부다).
     살 수는 있는데 만질 수 없는 물건은 목록을 길게 만들 뿐이다.
     가챠도 원래부터 벽 물건을 뺐다(js/gacha.js 의 furn !== 'wall') — 이제 두 곳이
     같은 말을 한다. */
  const T = [
    ['f_box',       'store', '📦',   60, 0, '박스',        'Box',           '段ボール'],
    ['f_bin',       'store', '🗑️',   70, 0, '휴지통',      'Trash Bin',     'ごみ箱'],
    ['f_penholder', 'deco',  '🖊️',   70, 0, '펜 홀더',     'Pen Holder',    'ペン立て'],
    ['f_plantS',    'deco',  '🌵',   80, 0, '화분 (소)',    'Plant (S)',     '鉢植え(小)'],
    ['f_papertray', 'store', '📄',   90, 0, '서류 트레이',  'Paper Tray',    '書類トレイ'],
    ['f_candle',    'deco',  '🕯️',  120, 0, '캔들',        'Candles',       'キャンドル'],
    ['f_cafechair', 'rest',  '🪑',  150, 1, '카페 의자',    'Café Chair',    'カフェチェア'],
    ['f_meetchair', 'work',  '🪑',  160, 1, '회의용 의자',  'Meeting Chair', '会議用椅子'],
    ['f_lantern',   'deco',  '🏮',  180, 1, '랜턴',        'Lantern',       'ランタン'],
    ['f_bookrack',  'store', '📚',  220, 1, '책꽂이',      'Book Rack',     '本立て'],
    ['f_drawer',    'work',  '🗄️',  240, 1, '서랍장',      'Drawer Unit',   '引き出し'],
    ['f_plantL',    'deco',  '🌴',  260, 2, '화분 (대)',    'Plant (L)',     '鉢植え(大)'],
    ['f_openshelf', 'store', '🪜',  300, 2, '오픈 선반',    'Open Shelving', 'オープン棚'],
    ['f_lowtable',  'rest',  '🪵',  300, 2, '테이블',      'Low Table',     'ローテーブル'],
    ['f_cafetable', 'rest',  '☕',  320, 2, '카페 테이블',  'Café Table',    'カフェテーブル'],
    ['f_beanbag',   'rest',  '🫘',  340, 2, '빈백',        'Bean Bag',      'ビーズクッション'],
    ['f_floorlamp', 'deco',  '🛋️',  340, 3, '스탠드 조명',  'Floor Lamp',    'スタンドライト'],
    ['f_cabinet',   'store', '🗄️',  360, 3, '수납장',      'Cabinet',       '収納棚'],
    ['f_filecab',   'work',  '🗃️',  380, 3, '파일 캐비닛',  'File Cabinet',  'ファイルキャビネット'],
    ['f_locker',    'store', '🚪',  420, 3, '락커',        'Lockers',       'ロッカー'],
    ['f_armchair',  'rest',  '💺',  460, 4, '안락 의자',    'Lounge Chair',  'アームチェア'],
    ['f_sofa1',     'rest',  '🛋️',  520, 4, '소파 (1인)',   'Sofa (1)',      'ソファ(1人)'],
    ['f_sofa2',     'rest',  '🛋️',  880, 5, '소파 (2인)',   'Sofa (2)',      'ソファ(2人)'],
  ];
  /* 설명은 스물넷이 다 같다 — 실제로 하는 일이 같기 때문이다. 물건마다 그럴듯한
     문장을 지어내면 그건 없는 차이를 말하는 것이고, 이 게임은 그걸 안 한다. */
  const d = L({ ko:'사무실 쾌적도 +1 — 가구가 늘수록 생산이 오르고 욕구가 천천히 닳습니다',
                en:'Office comfort +1 — more furniture means better output and slower needs',
                ja:'オフィス快適度+1 — 家具が増えるほど生産が上がり欲求がゆっくり減ります' });
  return T.map(([id, furn, em, cost, tier, ko, en, ja]) => ({
    id, furn, em, cost, tier, d, n: L({ ko, en, ja }),
    /* 벽에 거는 둘은 바닥 자리를 안 먹는다 — 견본책과 같은 배선이다(buyItem 의 wallTile).
       다만 견본책과 달리 **여러 장 걸 수 있다**: 커튼은 창마다 하나씩이 자연스럽다. */
    ...(furn === 'wall' ? { wallTile: id === 'f_curtain' ? 'CURTAIN' : 'MEMO', wallMany:1 } : {}),
  }));
}

/* ---------- 사무실 쾌적도 ----------
   가진 **가구 개수**만 센다. 종류가 아니라 개수인 이유: 화분 하나짜리 사무실과
   화분 여섯짜리 사무실은 다른 방이고, 종류로 세면 두 번째 화분을 살 이유가 없어진다.

   **수확 체감이다.** 개수에 비례시키면 값싼 박스(60멸치)를 백 개 사는 게 최적해가
   되고, 그러면 이 카탈로그는 사무실을 꾸미는 물건이 아니라 창고에 상자를 쌓는 버그가
   된다. 지수 포화 곡선이라 열 개쯤에서 절반이 차고 마흔 개 넘으면 거의 안 움직인다.

     0개 +0%   ·   6개 +8.4%   ·   12개 +14.6%   ·   24개 +22.1%   ·   ∞ +30%

   상한 30% 는 이 게임의 다른 값들과 나란히 놓고 정했다 — 커피머신 15%, 건조실 35%,
   헬스장 55%, 정제실 90%. 「사무실을 잘 꾸미면 건조실 하나쯤」이 맞는 크기다.
   공짜가 아니라 값을 치른 결과이기도 하고(가구 스물넷이면 7천 멸치쯤 든다). */
const COMFORT_CAP = 0.30, COMFORT_HALF = 18;
function furnOwned(){
  let n = 0;
  SHOP.forEach(i => { if (i.furn) n += shopCount(i.id); });
  return n;
}
function comfort(){ return COMFORT_CAP * (1 - Math.exp(-furnOwned() / COMFORT_HALF)); }

const SIZE_INFO = {
  s:{ kpi:1, mult:1,   sec:35,  label: L({ ko:'작음', en:'Small',  ja:'小' }) },
  m:{ kpi:3, mult:3.4, sec:110, label: L({ ko:'보통', en:'Medium', ja:'中' }) },
  l:{ kpi:7, mult:8.5, sec:280, label: L({ ko:'큼',   en:'Large',  ja:'大' }) },
};

const HIRE_BASE = 140, HIRE_GROW = 1.72;
/* 분기 목표. 지수로 두면 후반이 도달 불가라 완만한 곡선을 쓴다.
   대신 todoReward의 성과가 사무실 등급과 함께 커져서 "분기당 처리 건수"가 일정하게 유지된다. */
const qTarget = q => Math.round(6 + 1.6 * Math.pow(q - 1, 1.45));

/* 사건 표.
   캣닢은 냥법상 마약류이고, Copycat은 그걸 제조·유통한다.
   좋은 일은 대체로 안 걸린 일이고, 나쁜 일은 대체로 흔적이 남은 일이다. */
const EVENTS = [
  { t: L({ ko:'건조 온도를 잘못 맞춰 한 배치를 통째로 태웠다. 순도가 안 나온다.',
           en:'Set the drying temperature wrong and torched a whole batch. Purity is shot.',
           ja:'乾燥温度を間違えて1ロット丸ごと焦がした。純度が出ない。' }), k:'bad',  money:-0.06 },
  { t: L({ ko:'「유기농 허브」로 신고한 컨테이너가 세관을 무사히 통과했다.',
           en:'The container declared as “organic herbs” cleared customs without a hitch.',
           ja:'「オーガニックハーブ」と申告したコンテナが無事に税関を通過した。' }), k:'good', flat:2.5 },
  { t: L({ ko:'단속 일정을 미리 입수했다. 그날은 전 직원 연차를 썼다.',
           en:'Got the crackdown schedule in advance. Everyone took the day off.',
           ja:'摘発の日程を事前に入手。その日は全員有休を取った。' }), k:'good', heat:-1 },
  { t: L({ ko:'멍멍파 유통책이 검거됐다. 그쪽 거래처가 우리에게 넘어왔다.',
           en:'A Woof Gang distributor got busted. Their clients came over to us.',
           ja:'ワンワン組の売人が検挙された。あちらの取引先がうちに流れてきた。' }), k:'good', rival:-0.08 },
  { t: L({ ko:'멍멍파가 개껌 신제품을 냈다. 우리 단골이 몇 빠졌다.',
           en:'The Woof Gang dropped a new chew product. A few regulars left us.',
           ja:'ワンワン組が新作ガムを出した。常連が数匹離れた。' }), k:'bad',  rival:+0.06 },
  { t: L({ ko:'인턴 냥이가 3급을 1급 봉지에 담았다. 구매자는 눈치 못 챘다.',
           en:'The intern bagged grade-3 in grade-1 pouches. Buyers never noticed.',
           ja:'インターンが3級品を1級の袋に詰めた。買い手は気づかなかった。' }), k:'good', flat:1.6 },
  { t: L({ ko:'창밖에 낯선 차가 이틀째 서 있다. 다들 조용히 일했다.',
           en:'An unfamiliar car has been parked outside for two days. Everyone worked quietly.',
           ja:'見知らぬ車が2日間、外に停まっている。みんな静かに働いた。' }), k:'bad',  need:{ fun:-20 }, heat:1 },
  { t: L({ ko:'재고 실사 중 전 직원이 제품을 흡입했다. 그날 생산량은 0이었다.',
           en:'During inventory, the entire staff inhaled the product. Output that day: zero.',
           ja:'棚卸し中、全員が商品を吸ってしまった。その日の生産量はゼロ。' }), k:'good', need:{ fun:100 }, money:-0.03 },
  { t: L({ ko:'대표냥이 이중장부 위에서 잤다. 장부가 따뜻해졌다.',
           en:'The CEO cat slept on the double books. The books are warm now.',
           ja:'代表ニャンが裏帳簿の上で寝た。帳簿があったかくなった。' }), k:'neutral' },
  { t: L({ ko:'멍멍파가 우리 구역에 개껌을 풀었다. 가격이 무너졌다.',
           en:'The Woof Gang flooded our turf with chews. Prices collapsed.',
           ja:'ワンワン組がうちのシマにガムをばらまいた。価格が崩れた。' }), k:'bad',  money:-0.08, need:{ fun:-15 }, rival:+0.05 },
  { t: L({ ko:'「월간 캣워크」가 우리를 유기농 허브 스타트업으로 소개했다. 아무도 확인 안 했다.',
           en:'“Monthly Catwalk” profiled us as an organic herb startup. Nobody fact-checked.',
           ja:'『月刊キャットウォーク』がうちをハーブ系スタートアップとして紹介。誰も裏を取らなかった。' }), k:'good', flat:2.0, drop:1 },
  { t: L({ ko:'택배 상자가 도착했다. 송장에 적힌 이름은 우리 회사가 아니었다.',
           en:'A parcel arrived. The name on the label wasn’t ours.',
           ja:'宅配便が届いた。伝票の名前はうちの会社じゃなかった。' }), k:'neutral', need:{ fun:40 } },
  { t: L({ ko:'세무 조사에서 회계 장부 대신 발자국이 발견되었다.',
           en:'The tax audit found pawprints instead of ledgers.',
           ja:'税務調査で帳簿の代わりに足跡が見つかった。' }), k:'bad',  money:-0.05, heat:1 },
  { t: L({ ko:'신입 냥이가 문 앞에서 울고 있었다. 채용 공고도 안 냈는데.',
           en:'A rookie cat was crying at the door. We never even posted a job.',
           ja:'新入りが玄関で鳴いていた。求人も出してないのに。' }), k:'hire' },
  { t: L({ ko:'전 직원 단체 그루밍 워크숍. 감식에 털이 안 남게 하는 요령도 배웠다.',
           en:'All-staff grooming workshop. Also learned how to leave no fur for forensics.',
           ja:'全員参加のグルーミング研修。鑑識に毛を残さないコツも学んだ。' }), k:'good', need:{ fun:50, energy:30 } },
  { t: L({ ko:'투자자 미팅에서 골골송을 불렀다. 아무도 실제 품목을 묻지 않았다.',
           en:'Purred through the investor meeting. Nobody asked what we actually sell.',
           ja:'投資家ミーティングでゴロゴロ喉を鳴らした。誰も実際の商品を聞かなかった。' }), k:'good', flat:3.2, drop:1 },
  { t: L({ ko:'분실물 센터에서 「우리 것이 아닌」 물건을 찾아왔다.',
           en:'Picked up something “not ours” from lost and found.',
           ja:'遺失物センターで「うちのじゃない」荷物を引き取ってきた。' }), k:'good', drop:1 },
  { t: L({ ko:'건조실 온기 때문에 아무도 자리에 안 돌아왔다.',
           en:'The drying room was so warm nobody came back to their desk.',
           ja:'乾燥室が暖かすぎて誰も席に戻らなかった。' }), k:'neutral', need:{ energy:60 }, money:-0.02 },
  { t: L({ ko:'내부 고발 편지가 반송되어 돌아왔다. 주소를 잘못 썼더라.',
           en:'The whistleblower letter came back — wrong address.',
           ja:'内部告発の手紙が宛先違いで返送されてきた。' }), k:'good', heat:-1 },
  { t: L({ ko:'창고 재고와 장부가 안 맞는다. 직원들이 조금씩 손대는 것 같다.',
           en:'Warehouse stock doesn’t match the books. The staff seem to be skimming.',
           ja:'倉庫の在庫と帳簿が合わない。社員が少しずつつまみ食いしているようだ。' }), k:'bad',  heat:1 },
];

/* ---------- 상태 ---------- */
let S = null;

/* 함께한 시간.
   이 게임이 스스로에게 물어야 하는 질문은 "얼마나 벌었나"가 아니라 "며칠을 같이
   버텼나"다. 그런데 그걸 세는 칸이 어디에도 없었다 — 분기도 성과도 게임 안 숫자지
   사람이 실제로 옆에 있었던 시간이 아니다.
     days  창을 연 적 있는 날짜의 수 (하루에 몇 번을 열든 1)
     sec   창이 열려 있던 실제 초
     work  그중 평일 근무시간(점심 제외)에 해당하는 초 — 같이 견딘 몫
     since 처음 만난 날
   초는 틱 수가 아니라 벽시계 차이로 센다. 배경 탭의 setInterval 은 크롬이 분당
   한 번까지 늦추기 때문에, 틱을 세면 정작 배경에 켜 둔 사람의 시간이 사라진다. */
const newTogether = () => ({ days: 0, sec: 0, work: 0, since: null });
const normTogether = t => ({
  days: (t && t.days) || 0, sec: (t && t.sec) || 0,
  work: (t && t.work) || 0, since: (t && t.since) || null,
});

function newGame(){
  /* 이름은 프롤로그 끝의 근로계약서에서 플레이어가 정한다(signContract).
     여기서 넣는 이름은 계약서를 쓰기 전에 창을 닫아버린 경우의 폴백일 뿐이다. */
  const first = newCat(L({ ko:'치즈', en:'Cheese', ja:'チーズ' }));
  first.fur = 2; first.acc = 'tie'; first.trait = 'steady';
  first.rec = newRecord(1);        // 창업 멤버. 회사를 접고 다시 차려도 Q1 입사다.
  first.founder = true;
  return {
    v: 2,
    intro: 0,                       // 프롤로그·계약서를 아직 안 봤다 (main.js 가 본다)
    seed: Math.floor(Math.random() * 1e9),
    anchovy: 0, quarter: 1, kpi: 0, tier: 0,
    clock: nowMin(), day: 1, dateKey: dayKey(),
    /* 업무일(bizKey)과 날짜별 기록. 캘린더와 기한이 이 둘 위에 산다 —
       dateKey 는 벽시계 날짜(함께한 날 세기), bizKey 는 사람의 하루다 (sim.js). */
    bizKey: bizKey(), days: {},
    /* 제휴 지점 — 내 초대 코드와 보낸 인사. 서버가 오면 이 칸이 그대로 쓰인다. */
    friends: { code:'', sent:{}, seen:{} },
    /* 이 지점 — 간판 로고와 이름(TODO 59). 계약서 다음에 한 번 정한다(ui.js showBranchSetup).
       로고를 비워 두면 시작화면은 박아 둔 글자 로고를 쓴다(js/title.js). */
    branch: { logo:'', name:'' },
    /* 마지막 장면(아웃트로)을 봤나 — js/story.js 가 세운다. 본 사람은 시작화면이
       사무실이 아니라 그 정경이 된다(js/title.js). */
    ending: 0,
    beats: [],                      // 바깥 겹(냥찰청)의 문구 중 본 것 — js/story.js 의 BEATS
    routines: [],                   // 루틴 — 요일 규칙 (js/game.js runRoutines)
    cats: [first],
    todos: [], shop: {}, log: [],
    candidate: null,                                 // 문 앞에서 기다리는 지원자
    /* 근무 시간. 09–18 이 기본이고 ⚙️ 에서 바꾼다(자정을 넘어도 된다) — sim.js shiftOf */
    shift: { start: 9, end: 18 },
    /* 천장등 — 켜져 있는가. 처음 온 사람의 사무실은 불이 켜져 있어야 한다
       (js/render3d.js 의 벽 스위치로 끈다). 옛 저장에 없으면 켜진 것으로 본다. */
    ceil: 1,
    /* 쥬크박스 · 조사 (music.js · story.js). 옛 저장에는 없고, 양쪽 다 없으면 채운다. */
    music: { owned:['box', 'aquarium'], cur:'aquarium', mode:'loop', yt:'' },
    /* 벽지·바닥 (js/decor.js). own 에 없는 것은 목록에도 없다 —
       기본 한 벌은 처음부터 갖고 있다(회벽·카펫타일은 값이 0 이다). */
    decor: { wall:'plain', floor:'carpet', tone:'tone_std', own:['plain', 'carpet'], rugs:[] },
    found: [], nudged: [], firstDoc: null, tutor: 0,
    penalty: 0, jail: [], referred: 0, rival: 0.10,
    stats: { done:0, totalKpi:0, totalEarned:0, qEarned:0, qDone:0, started:Date.now() },
    together: newTogether(),
    working: 0,
    last: Date.now(),
  };
}

function save(){
  if (!S) return;
  /* last = "시뮬레이션이 마지막으로 돈 시각"이고, 그건 루프가 찍는다 (js/main.js).
     저장은 여기서 손대지 않는다 — last 는 켜져 있던 시간과 닫혀 있던 시간을 가르는
     유일한 경계라, 8초마다 도는 자동 저장이 덮어쓰면 그 경계가 사라진다.
     (배경 탭도 이제 감시 타이머가 실제로 돌리므로 last 가 계속 갱신된다.) */
  // path는 매 틱 바뀌는 임시 데이터라 저장하지 않는다
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S, (k, v) => k === 'path' ? undefined : v)); } catch(e){}
}
function loadSave(){
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!d || d.v !== 2 || !Array.isArray(d.cats) || !d.cats.length) return null;
    // 구버전 저장에서 빠진 필드 보정
    d.bag = d.bag || []; d.log = d.log || []; d.shop = d.shop || {};
    d.penalty = d.penalty || 0; d.jail = d.jail || []; d.referred = d.referred || 0;
    d.rival = typeof d.rival === 'number' ? d.rival : 0.10;
    /* 날짜 키가 자리를 채우는 형식으로 바뀌었다(sim.js dayKey). 옛 키를 그대로 두면
       문자열 비교가 어긋나고, 같은 하루가 두 번 새 하루로 읽힌다. */
    d.dateKey = normDay(d.dateKey) || dayKey();   // 32분-하루 시절 저장 보정
    d.bizKey = normDay(d.bizKey) || bizKey();
    d.days = d.days || {};
    d.friends = d.friends || { code:'', sent:{}, seen:{} };   // 제휴 지점 (js/friends.js)
    /* 지점 간판은 나중에 생긴 칸이다. 옛 저장에는 빈 채로 둔다 — 로고를 골라 준
       것으로 만들면 「내가 고른 것」이 아니게 되고, 시작화면은 빈 값에서 옛 로고로
       내려가므로 화면이 깨지지도 않는다(js/title.js). */
    d.branch = d.branch || { logo:'', name:'' };
    d.ending = d.ending ? 1 : 0;                              // 마지막 장면을 봤나 (js/story.js)
    d.beats = Array.isArray(d.beats) ? d.beats : [];          // 바깥 겹의 문구 중 본 것 (js/story.js)
    d.routines = Array.isArray(d.routines) ? d.routines : [];
    if (d.careDay) d.careDay.date = normDay(d.careDay.date);
    if (d.together) d.together.since = normDay(d.together.since);
    d.candidate = d.candidate || null;
    /* 인테리어는 나중에 생긴 칸이다. 옛 저장에는 기본 한 벌만 넣어 준다 —
       견본책을 안 산 사람에게 목록을 미리 채워 주면 「산 것」의 의미가 없어진다. */
    d.decor = d.decor || {};
    d.decor.wall = d.decor.wall || 'plain';
    d.decor.floor = d.decor.floor || 'carpet';
    d.decor.own = Array.isArray(d.decor.own) ? d.decor.own : [];
    ['plain','carpet'].forEach(id => { if (!d.decor.own.includes(id)) d.decor.own.push(id); });
    d.together = normTogether(d.together);   // 함께한 시간도 나중에 생긴 칸이다
    /* 프롤로그는 나중에 생긴 것이다. 저장이 있다는 건 이미 시작한 사람이라는 뜻이라
       1로 채운다 — 안 그러면 며칠 하던 사람이 갑자기 오프닝부터 다시 본다.
       (계약서를 쓰기 전에 창을 닫은 새 저장은 0 이 그대로 남아서 다시 이어진다.) */
    if (d.intro == null) d.intro = 1;
    /* 「대표」는 나중에 생긴 개념이다. 옛 저장의 1번 사원도 창업 멤버 = 플레이어이므로
       사장으로 세운다. 그리고 그 저장에 대표냥까지 올라간 직원이 있으면 이사로 내린다 —
       대표가 둘이면 "처음부터 사장 고정"이라는 규칙 자체가 안 보인다. */
    if (d.cats[0] && d.cats[0].founder == null) d.cats[0].founder = true;
    d.cats.forEach(c => {
      if (!c.founder && c.rank > RANKS.length - 2) c.rank = RANKS.length - 2;
    });
    /* 투두가 **날짜 위에** 살게 됐다. 옛 저장의 건들은 날짜를 모르므로 오늘 칸에 놓고
       기한은 걸지 않는다 — 있던 사람의 목록에 없던 마감이 갑자기 생기면 그건 선물이
       아니라 벌이다. 분기(q)는 기록으로 남긴다(첫 결재·인사 기록이 그걸 쓴다). */
    {
      const tk = normDay(d.bizKey) || bizKey();
      d.todos = (d.todos || []).map(t => ({
        ...t, q: t.q || 1,
        day: normDay(t.day) || tk,
        due: normDay(t.due) || tk,
        alarm: !!t.alarm,
      }));
    }
    d.cats.forEach(c => {
      c.stats = c.stats || rollStats();
      c.needs = c.needs || { energy:100, fun:100, caffeine:100, bladder:100 };
      c.act = { s:'idle', t:0 }; c.doc = null;
    });
    // 기록부는 나중에 생긴 칸이다. 옛 저장에는 없으니 빈 기록부를 끼워 넣는다.
    // 구금 중인 냥이와 문 앞의 지원자도 언젠가 인사 파일이 열리므로 같이 챙긴다.
    d.cats.concat(d.jail.map(j => j.cat), d.candidate ? [d.candidate] : [])
      .forEach(c => { if (c) c.rec = normRecord(c.rec); });
    return d;
  } catch(e){ return null; }
}

/* ---------- 계산 ---------- */
/* S.shop[id] 는 **개수**다. 옛 저장에는 true 가 들어 있어서 1로 읽는다.
   효과(생산·욕구감소)는 개수만큼 곱하지 않는다 — 커피머신 열 대로 생산 10배가 되면
   그건 배치 게임이 아니라 엑셀이다. 두 번째부터의 값어치는 **가구가 하나 더 놓이는 것**,
   즉 줄을 안 선다는 것이고 이 게임에서는 그걸로 충분히 실질적이다. */
const shopCount = id => (S.shop[id] === true ? 1 : (S.shop[id] | 0));
const shopHas = id => shopCount(id) > 0;
/* 두 번째 사본부터 값이 오른다. 도배가 최적해가 되지 않게. */
const shopCost = it => Math.round(it.cost * Math.pow(1.7, shopCount(it.id)));
function shopSum(key){ let v = 0; SHOP.forEach(i => { if (shopHas(i.id) && i[key]) v += i[key]; }); return v; }
function shopMul(key, base){ let v = base; SHOP.forEach(i => { if (shopHas(i.id) && i[key]) v *= i[key]; }); return v; }

function teamProd(){
  let b = 0;
  S.cats.forEach(c => { const t = traitOf(c); if (t.teamProd) b += t.teamProd; });
  let cha = 0;
  S.cats.forEach(c => cha += Math.max(0, mod(statOf(c,'cha'))) * 0.012);
  return b + Math.min(cha, 0.5);
}

function catRate(c){
  const tr = traitOf(c);
  const r = RANKS[Math.min(c.rank, RANKS.length - 1)];
  const hasCoffee = !!(W && W.facilities.coffee);
  let m = tr.prod;
  if (tr.needs && shopHas(tr.needs)) m *= (1 + tr.ifOwned);
  const statMul = 1 + mod(statOf(c,'int')) * 0.10 + mod(statOf(c,'str')) * 0.025;
  const moodMul = 0.40 + 0.80 * (moodOf(c, hasCoffee) / 100);
  /* 쾌적도가 여기 들어간다 — 비품의 prod 와 **같은 자리**다.
     따로 곱하면 「가구 보너스」라는 새 축이 생기고, 이 게임의 숫자는 이미 충분히 많다. */
  const office  = 1 + shopSum('prod') + teamProd() + comfort();
  const tierMul = 1 + S.tier * 0.22;
  const legalMul = legalDrag() * rivalDrag();
  /* 자리에 앉아 있는 동안만 번다. 그런데 고양이가 자리를 뜨는 빈도를 올렸으므로
     (하루의 94% → 73% 착석, spike/behavior.js 실측) 초당 요율을 그만큼 올려서
     **하루 벌이는 그대로** 두었다. 자유도를 올린 대가를 플레이어가 조용히 치르면
     그건 자유도가 아니라 하향이다. 1.28 = 0.94 / 0.73. */
  const AWAY = 1.28;
  return Math.max(0.02, r.rate * m * Math.max(0.3, statMul) * moodMul * office * tierMul * legalMul * AWAY);
}
/* 표시용: 지금 실제로 자리에 앉아 있는 고양이들의 합 */
function totalRate(){
  const p = typeof phaseOf === 'function' ? PHASE_MUL[phaseOf(S.clock)] : 1;
  return S.cats.reduce((a,c) => a + ((c.act && (c.act.s === 'work' || c.act.s === 'stamp')) ? catRate(c) : 0), 0) * p;
}
function potentialRate(){ return S.cats.reduce((a,c) => a + catRate(c), 0); }
function avgMood(){
  const hc = !!(W && W.facilities.coffee);
  return S.cats.length ? S.cats.reduce((a,c) => a + moodOf(c, hc), 0) / S.cats.length : 0;
}
function deskCount(){ return W ? W.desks.length : TIERS[S.tier].desks; }
function hireCost(){ return Math.round(HIRE_BASE * Math.pow(HIRE_GROW, S.cats.length - 1) * (1 + S.tier * 0.35)); }
function promoCost(c){
  const nx = nextRank(c);
  return nx ? Math.round(nx.cost * shopMul('promoDisc', 1)) : Infinity;
}

function todoReward(size){
  const si = SIZE_INFO[size];
  const base = 22 * si.mult * (1 + 0.55 * (S.quarter - 1));
  const passive = potentialRate() * si.sec;
  let money = (base + passive) * shopMul('todoMul', 1);
  let bonus = 0;
  S.cats.forEach(c => { const t = traitOf(c); if (t.bonusTodo) bonus += t.bonusTodo; });
  money *= (1 + bonus);
  // 성과도 등급과 함께 커진다 — 같은 서류 한 장이 더 큰 회사에서 더 큰 실적이 된다
  const kpi = si.kpi * (1 + S.tier * 0.6) * shopMul('kpiMul', 1);
  return { money: Math.round(money), kpi: Math.max(1, Math.round(kpi)) };
}

/* ============================================================
   결재함 — 할 일은 **날짜 위에** 산다

   투두메이트와 같은 모양이다: 모든 건은 어느 하루의 칸에 놓이고(due), 그 날짜가
   캘린더의 한 칸이 된다. 다른 건 하나뿐인데 그게 이 게임의 전부다 — **기한(⏰)**.

   기한은 **직접 걸어야 생긴다.** 걸지 않은 건은 언제 해도 되고 아무 일도 없다.
   걸어 둔 건을 그날 안에 못 내면 서류가 정리되지 못한 채 밖으로 새고(= 증거),
   혐의가 붙는다. 압박의 크기를 게임이 정하지 않고 **올린 사람이 정한다** —
   이 게임은 근무 시간을 같이 견뎌 주는 물건이고, 안 시킨 마감을 붙이는 순간
   동행이 아니라 잔소리가 된다.

   그래서 기한을 놓친 건은 목록에서 **사라지지 않는다.** 늦게라도 도장을 찍으면
   그 건이 만든 혐의가 지워진다 — 이 게임이 바라는 행동이 "늦어도 한다" 이기 때문이다.
   지워 주지 않으면 늦은 줄을 지워 버리는 것이 최적해가 되고, 그러면 할 일 관리
   도구로서 거짓이 된다.
   ============================================================ */
/* 지금의 업무일. 결재함·기한·캘린더가 말하는 「오늘」이 전부 이것이다 (sim.js bizKey). */
const bizToday = () => bizKey();

function addTodo(text, size, opt){
  opt = opt || {};
  const day = bizToday();
  const t = {
    id:'t' + Math.random().toString(36).slice(2,9), text, size, done:false,
    q: S.quarter,                       // 올린 분기 — 기록부와 첫 결재가 쓴다
    day,                                // 올린 날
    due: opt.due || day,                // 놓인 날 (캘린더의 그 칸)
    alarm: !!opt.alarm,                 // ⏰ — 이 건만 기한이 있다
  };
  /* 세부 업무 — 부모의 id 하나. 트리를 따로 두지 않는다(부모가 자식 목록을 들고 있으면
     지우기·이동·저장이 두 곳에서 어긋난다). 관계는 이 한 칸에서 유도한다. */
  if (opt.parent){
    const p = S.todos.find(x => x.id === opt.parent);
    if (p && !p.parent){                // 손자는 안 만든다 — 두 층이면 목록이고 세 층이면 문서다
      t.parent = p.id;
      t.due = p.due;                    // 잎은 부모의 날에 산다. 대청소는 하루의 일이다
      /* 다 끝나서 닫혀 있던 부모에 잎이 하나 더 붙었다 — 다시 열어야 한다 */
      if (p.done){ p.done = false; p.doneDay = null; }
    }
  }
  if (opt.rt) t.rt = opt.rt;            // 루틴이 찍은 건 (js/game.js runRoutines)
  S.todos.push(t);
  /* 첫 출근 안내(tutor.js)가 "실제로 올렸는지"를 이걸로 안다.
     버튼 클릭을 듣게 하면 빈 칸으로 눌러도 넘어간다 — 넘어가면 안 되는 단계다. */
  bus.emit('todo:add', t);
  save();
  return t;
}

/* 결재함에 보이는 것 = **오늘까지 놓인 것.** 앞날에 미리 적어 둔 건은 그날이 되면
   저절로 올라온다(그게 "매일 갱신"이다). 기한 없이 지나간 건은 그대로 남는다 —
   할 일 목록에서 할 일이 저절로 사라지면 안 된다. */
const openTodos = () => { const d = bizToday(); return S.todos.filter(t => !t.done && t.due <= d); };
/* ---------- 세부 업무 ----------
   보상은 **잎에서만** 나온다. 부모까지 도장을 찍으면 같은 일로 두 번 받고, 고양이도
   서류를 두 번 나른다. 그래서 부모에는 체크 칸이 없고, 잎이 다 끝나면 저절로 닫힌다. */
const kidsOf = id => S.todos.filter(t => t.parent === id);
const openKids = id => S.todos.filter(t => t.parent === id && !t.done);
const isParent = t => S.todos.some(x => x.parent === t.id);

/* 기한을 넘긴 건. 기한(⏰)이 없으면 넘길 것도 없다. */
const isOverdue = t => !t.done && !!t.alarm && t.due < bizToday();
const overdueTodos = () => S.todos.filter(isOverdue);
/* 아직 값을 치르지 않은 기한 초과분 — 업무일이 넘어갈 때 이것만 샌다. */
const leakable = () => { const d = bizToday();
  return S.todos.filter(t => !t.done && t.alarm && !t.late && t.due < d); };

function completeTodo(id){
  const t = S.todos.find(x => x.id === id);
  if (!t || t.done) return false;
  /* 부모는 손으로 닫지 않는다. 잎이 남아 있으면 그 잎들이 아직 일이다 —
     화면에는 부모의 체크 칸이 없지만, 다른 경로로 들어와도 여기서 막는다. */
  if (openKids(t.id).length) return false;
  t.done = true;
  t.doneDay = bizToday();            // 캘린더가 "그날 무엇을 끝냈나"를 이걸로 안다
  /* 늦게라도 채워 넣었다 — 그 건이 만든 혐의를 지운다. 벌점을 남겨 두면
     늦은 줄을 지우는 게 최적해가 되고, 그때부터 이 목록은 거짓말을 한다. */
  if (t.late){
    const back = t.late;
    t.late = 0;
    S.penalty = Math.max(0, S.penalty - back);
    pushLog(L({
      ko:`늦은 서류 <b>${esc(t.text)}</b>를 뒤늦게 채워 넣었습니다. 혐의 ${back}점이 지워졌습니다.`,
      en:`Filed the late paperwork for <b>${esc(t.text)}</b>. Heat -${back}.`,
      ja:`遅れていた<b>${esc(t.text)}</b>の書類を後から出しました。容疑${back}点が消えました。`,
    }), 'good');
  }
  spawnDoc(t);                       // 보상은 고양이가 도장을 찍어야 들어온다
  bus.emit('todo:done', t);
  /* 마지막 잎이었으면 부모가 저절로 닫힌다. 서류는 안 나간다 —
     그 몫은 잎들이 이미 냈고, 부모는 묶음의 이름일 뿐이다. */
  if (t.parent){
    const p = S.todos.find(x => x.id === t.parent);
    if (p && !p.done && !openKids(p.id).length){
      p.done = true; p.doneDay = bizToday();
      bus.emit('todo:done', p);
    }
  }
  save();
  return true;
}
function delTodo(id){
  const i = S.todos.findIndex(x => x.id === id);
  if (i < 0) return 0;
  /* 이미 값을 치른 건을 지우면 그 혐의는 어떻게 되나 — 지워 준다. 안 그러면
     "지우기"가 벌점을 굳히는 버튼이 되고, 사람들은 못 한 줄을 못 지운다. */
  const t = S.todos[i];
  /* 부모를 지우면 잎도 같이 간다. 남겨 두면 어디에도 안 걸린 줄이 목록에 떠 있고,
     그건 지운 것도 아니고 남은 것도 아니다. 부르는 쪽이 먼저 물어본다(ui.js). */
  const gone = [t].concat(kidsOf(t.id));
  gone.forEach(x => { if (x.late) S.penalty = Math.max(0, S.penalty - x.late); });
  const ids = new Set(gone.map(x => x.id));
  S.todos = S.todos.filter(x => !ids.has(x.id));
  /* **지운 잎이 마지막 열린 잎이었으면 부모를 닫는다.**
     이게 없으면 「끝난 잎 하나 + 열린 잎 하나」에서 열린 쪽을 지웠을 때, 부모는 잎이
     남아 있으므로 계속 묶음이고(체크 칸 대신 접기 손잡이가 붙는다) 열린 잎이 없으므로
     completeTodo 도 안 받는다 — **닫을 방법이 없는 줄**이 목록에 남았다.
     잎이 하나도 안 남았으면 닫지 않는다. 그건 다시 보통 업무로 돌아가는 것이다. */
  if (t.parent){
    const p = S.todos.find(x => x.id === t.parent);
    if (p && !p.done && kidsOf(p.id).length && !openKids(p.id).length){
      p.done = true; p.doneDay = bizToday();
      bus.emit('todo:done', p);
    }
  }
  save();
  return gone.length;
}

/* 묶음을 한 번에 끝낸다 — 부모의 체크 칸이 이걸 부른다.
   **잎을 하나씩 끝내는 것과 같은 일이다**: 서류도 보상도 잎에서 나오고(도장 N번),
   마지막 잎이 부모를 닫는다. 부모에만 done 을 찍으면 잎들이 안 끝난 채로 남아
   목록과 결재함이 갈린다. */
function completeGroup(id){
  const p = S.todos.find(x => x.id === id);
  if (!p || p.done) return false;
  const kids = openKids(p.id);
  if (!kids.length) return completeTodo(id);
  kids.forEach(k => completeTodo(k.id));
  return true;
}

/* 날짜를 옮긴다(미루기) · 기한을 걸거나 뗀다.
   **기한이 지난 뒤에는 못 옮긴다** — 지나고 나서 미루는 건 미루기가 아니라 무르기다.
   대신 늦게라도 처리하면 위에서 지워 준다. */
function setDue(id, key, alarm){
  const t = S.todos.find(x => x.id === id);
  if (!t || t.done) return false;
  if (t.late) return false;
  if (key){
    t.due = key;
    /* 묶음은 하루의 일이다 — 대청소를 모레로 미루면 빨래도 같이 간다.
       잎만 남겨 두면 부모 없는 날에 잎이 떠 있고, 그 줄은 무슨 일인지 알 수 없다. */
    kidsOf(t.id).forEach(k => { if (!k.late) k.due = key; });
  }
  if (alarm != null) t.alarm = !!alarm;
  save();
  return true;
}

/* ============================================================
   루틴 — 정해 두면 아침에 이미 올라와 있다

   규칙 하나(무슨 요일에 무엇을)와, 규칙이 날짜를 만나면 실제 투두로 찍히는 자리 하나.
   찍힌 뒤로는 **보통 건과 똑같다** — 지우고, 미루고, 세부 업무를 붙일 수 있다.
   루틴이 따로 사는 목록을 화면에 하나 더 두지 않으려는 것이다.

   두 가지를 일부러 안 한다.

   1. **지난 날 몫은 소급해서 안 찍는다.** 사흘 만에 켰을 때 루틴이 열다섯 줄로 쌓이면
      그건 할 일이 아니라 빚이다. 오늘 것만 놓는다.
   2. **루틴에는 기한(⏰)을 걸 수 없다.** 한 번 걸어 두면 매일 새기 때문이다 —
      그러면 이 게임은 매일 아침 벌점을 예약해 두는 물건이 된다. 오늘 것만 급하면
      오늘 줄에 손으로 ⏰ 를 걸면 된다. 그건 그날의 내가 정한 것이다.
   ============================================================ */
const DOW_ALL = [0, 1, 2, 3, 4, 5, 6];
const DOW_WEEK = [1, 2, 3, 4, 5];

function addRoutine(text, size, dows){
  if (!S.routines) S.routines = [];
  const r = { id:'r' + Math.random().toString(36).slice(2,9), text, size: size || 's',
              dows: (dows && dows.length ? dows : DOW_ALL).slice().sort(), on:true, last:'' };
  S.routines.push(r);
  save();
  return r;
}
function delRoutine(id){
  if (!S.routines) return false;
  const i = S.routines.findIndex(r => r.id === id);
  if (i < 0) return false;
  S.routines.splice(i, 1);
  save();
  return true;
}
/* 오늘 몫을 찍는다. 부팅과 업무일이 넘어갈 때(biz:new) 부른다 — 두 경로가 같은 함수를
   쓰는 게 중요하다. 하루에 한 번만 찍히는 건 r.last 가 보장한다. */
function runRoutines(){
  const today = bizToday();
  const dow = dowOf(today);
  let n = 0;
  (S.routines || []).forEach(r => {
    if (r.last === today) return;
    r.last = today;                                  // 오늘은 이미 봤다 (요일이 아니어도)
    if (!r.on || !(r.dows || []).includes(dow)) return;
    /* 같은 루틴이 오늘 이미 놓여 있으면 두 번 안 찍는다 — 저장을 옮겨 왔거나
       창을 둘 열었을 때 같은 줄이 겹치는 걸 막는다. */
    if (S.todos.some(t => t.rt === r.id && t.due === today)) return;
    addTodo(r.text, r.size, { due: today, alarm:false, rt: r.id });
    n++;
  });
  if (n || (S.routines || []).length) save();
  return n;
}

/* 고양이가 도장을 찍는 순간 실제 보상 지급 */
bus.on('doc:stamped', ({ cat, doc }) => {
  const r = todoReward(doc.size);
  S.anchovy += r.money;
  S.kpi += r.kpi;
  S.stats.done++; S.stats.qDone++;
  S.stats.totalKpi += r.kpi; S.stats.totalEarned += r.money; S.stats.qEarned += r.money;

  const fun = { s:10, m:20, l:34 }[doc.size] * shopMul('recover', 1);
  S.cats.forEach(c => { c.needs.fun = Math.min(100, c.needs.fun + fun); });
  cat.needs.energy = Math.max(0, cat.needs.energy - 3);

  // 개인 기록부. 도장을 찍은 그 순간이 이력이 되는 유일한 시점이다.
  const rec = recOf(cat);
  if (rec.docs[doc.size] != null) rec.docs[doc.size]++;
  // 첫 결재는 서류 문구까지 남긴다. 여기서 안 챙기면 doc은 곧 버려져서 되살릴 수 없다.
  if (!rec.first) rec.first = { q: S.quarter, t: String(doc.text || '').slice(0, 40) };

  bus.emit('reward', { cat, money:r.money, kpi:r.kpi, doc });
  if (S.kpi >= qTarget(S.quarter)) setTimeout(closeQuarter, 700);
});

/* 시설 이용도 기록부에 남는다. 어디를 자주 가는지가 그 냥이의 성격이 된다.
   외부인(법무팀·냥찰)은 직원이 아니라서 세지 않는다. */
bus.on('cat:use', ({ cat, tile }) => {
  if (!S || cat.npc || tile == null) return;
  const f = recOf(cat).fac;
  f[tile] = (f[tile] || 0) + 1;
});

/* ============================================================
   사내 소식 — 사보에 오는 잡담

   **난수로 뿌리지 않는다.** 실제로 일어난 일에 붙인다: `cat:use` 는 고양이가 가구에
   **도착한 순간**에만 뜨므로(sim.js arrive — 「가다가 마음이 바뀐 건 이용이 아니다」),
   그 자리에서 나온 한 줄은 화면에서 방금 본 것과 어긋나지 않는다. 회의 탁자에 둘이
   붙어 있을 때만 「둘이 야차를 떴다」가 나오는 이유다.

   그래서 이 표는 **가구별**이고, 두 마리가 필요한 줄은 실제로 같은 칸에 둘이 있어야 나온다.
   자주 나오면 잡담이 아니라 소음이므로 **한 번 나오면 한동안 조용하다**(GOSSIP_GAP).
   저장하지 않는다 — 지난 잡담을 다시 읽을 이유가 없고, 사보 목록에는 어차피 남는다.
   ============================================================ */
/* 한국어 조사 — 이름이 사람이 지은 것이라 받침을 코드가 봐야 한다.
   「냥1이」와 「치즈가」를 「냥1이(가)」로 때우면 그 순간 이건 문장이 아니라 서식이다. */
const hasJong = s => {
  const t = String(s);
  const c = t.charCodeAt(t.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0;
  /* 숫자로 끝나는 이름 — 기본 이름이 「냥1」이라 이게 흔하다. 읽는 대로 본다:
     영·일·삼·육·칠·팔은 받침이 있고 이·사·오·구는 없다. 「냥1가」는 사람이 안 읽는 말이다. */
  if (c >= 0x30 && c <= 0x39) return [1,1,0,1,0,0,1,1,1,0][c - 0x30] === 1;
  return false;                    // 로마자 이름은 받침 없는 쪽으로 읽는다
};
const bold = n => `<b>${esc(n)}</b>`;
const josa = (n, a, b) => bold(n) + (hasJong(n) ? a : b);

/* [필요한 마리 수, 문장] — 문장은 이름 배열을 받는다.
   둘짜리는 **같은 칸에 실제로 둘이 있을 때만** 후보가 된다. */
const GOSSIP = {
  MEETING: [
    [2, (a, b) => L({
      ko:`${bold(a)}${hasJong(a) ? '과' : '와'} ${josa(b, '이', '가')} 회의 시간에 야차를 떴습니다.`,
      en:`${bold(a)} and ${bold(b)} got into it during the meeting.`,
      ja:`${bold(a)}と${bold(b)}が会議中にやり合いました。` })],
    [2, (a, b) => L({
      ko:`${bold(a)}${hasJong(a) ? '과' : '와'} ${josa(b, '이', '가')} 같은 서류를 서로 자기 것이라고 우겼습니다.`,
      en:`${bold(a)} and ${bold(b)} each insisted the same file was theirs.`,
      ja:`${bold(a)}と${bold(b)}が同じ書類を互いに自分のだと言い張りました。` })],
  ],
  SNACK: [
    [1, a => L({
      ko:`${josa(a, '이', '가')} 탕비실의 간식을 싹쓸이 했습니다.`,
      en:`${bold(a)} cleaned out the snack bar.`,
      ja:`${bold(a)}が給湯室のおやつを一掃しました。` })],
  ],
  FEEDER: [
    [1, a => L({
      ko:`${josa(a, '이', '가')} 급식기 앞에서 「한 번 더」를 눌렀습니다. 세 번째입니다.`,
      en:`${bold(a)} hit "one more" at the feeder. That was the third.`,
      ja:`${bold(a)}が給餌器で「もう一回」を押しました。三度目です。` })],
  ],
  COOLER: [
    [2, (a, b) => L({
      ko:`${bold(a)}${hasJong(a) ? '과' : '와'} ${josa(b, '이', '가')} 정수기 앞에서 20분째 서 있습니다.`,
      en:`${bold(a)} and ${bold(b)} have been at the water cooler for twenty minutes.`,
      ja:`${bold(a)}と${bold(b)}がウォーターサーバーの前に20分立っています。` })],
  ],
  COPIER: [
    [1, a => L({
      ko:`${josa(a, '이', '가')} 복사기에 얼굴을 대고 스무 장을 뽑았습니다.`,
      en:`${bold(a)} put their face on the copier and ran twenty pages.`,
      ja:`${bold(a)}がコピー機に顔を乗せて20枚刷りました。` })],
  ],
  GAME: [
    [2, (a, b) => L({
      ko:`${bold(a)}${hasJong(a) ? '과' : '와'} ${josa(b, '이', '가')} 오락기 앞에서 「마지막 한 판」을 네 번 했습니다.`,
      en:`${bold(a)} and ${bold(b)} played "one last round" four times.`,
      ja:`${bold(a)}と${bold(b)}が「最後の一戦」を四回やりました。` })],
  ],
  SCRATCH: [
    [1, a => L({
      ko:`${josa(a, '이', '가')} 스크래처를 새로 뜯어 놓았습니다. 어제 산 것입니다.`,
      en:`${bold(a)} shredded the scratcher again. We bought it yesterday.`,
      ja:`${bold(a)}が爪とぎをまた裂きました。昨日買ったものです。` })],
  ],
  TOWER: [
    [1, a => L({
      ko:`${josa(a, '이', '가')} 캣타워 꼭대기에서 안 내려옵니다.`,
      en:`${bold(a)} will not come down from the top of the cat tower.`,
      ja:`${bold(a)}がキャットタワーの上から降りてきません。` })],
  ],
};
/* 한 번 나오면 이만큼은 조용하다. 잡담은 드물어야 잡담이다 */
const GOSSIP_GAP = 150000;
let gossipAt = 0;

bus.on('cat:use', ({ cat, tile }) => {
  if (!S || !W || cat.npc || tile == null) return;
  const now = Date.now();
  if (now - gossipAt < GOSSIP_GAP) return;
  /* 타일 이름으로 표를 찾는다 — 숫자를 여기 적어 두면 TILE 이 바뀔 때 조용히 어긋난다 */
  const key = Object.keys(TILE).find(k => TILE[k] === tile);
  const pool = GOSSIP[key];
  if (!pool) return;
  const cell = cat.act && cat.act.use;
  if (!cell) return;
  /* 같은 칸에 붙어 있는 다른 직원 — 둘짜리 줄은 이게 있어야 후보가 된다 */
  const mate = S.cats.find(o => o !== cat && !o.npc && o.act && o.act.use
    && o.act.use.x === cell.x && o.act.use.y === cell.y);
  const ok = pool.filter(([n]) => n === 1 || mate);
  if (!ok.length) return;
  if (Math.random() > 0.45) return;
  const [n, line] = ok[Math.floor(Math.random() * ok.length)];
  gossipAt = now;
  pushLog(n === 2 ? line(cat.name, mate.name) : line(cat.name), '');
});

/* ---------- 채용 / 승진 / 구매 ----------
   지원자는 한 번 굴려두고 **채용될 때까지 유지된다**(저장에도 남는다).
   면접창을 닫고 다시 열어 능력치를 다시 굴리는 건 4d6의 의미를 없애기 때문이다.
   플레이어가 정하는 건 능력치가 아니라 **이름과 색**이다. */
function candidateCat(){
  if (!S.candidate){
    S.candidate = newCat();
    save();
  }
  return S.candidate;
}
/* 지원자의 겉모습·이름만 바꾼다. 능력치·특성은 손대지 않는다. */
function styleCandidate(look){
  const c = candidateCat();
  if (!look) return c;
  if (typeof look.name === 'string'){
    const n = look.name.trim().slice(0, 12);
    if (n) c.name = n;
  }
  if (look.fur != null) c.fur = ((look.fur % FURS.length) + FURS.length) % FURS.length;
  if (look.hue != null) c.hue = look.hue;
  /* 어떤 그림으로 그릴지. 도트 렌더러는 안 쓰지만 저장에는 남는다 —
     렌더러를 갈아 끼워도 고른 것이 유지되어야 한다. */
  if (look.draw != null) c.draw = look.draw;
  /* 무늬 — 지원자도 찍을 수 있다. 저장에 남으므로 면접창을 닫았다 열어도 그대로다
     (능력치를 지켜 주는 그 규칙이 겉모습에도 그대로 적용된다). */
  if (look.marks != null) c.marks = normMarks(look.marks);
  if (look.face != null) c.face = normFace(look.face);
  save();
  return c;
}
/* 이미 입사한 냥의 무늬를 바꾼다. **언제든 바꿀 수 있다** — 이 게임은 되돌릴 수 없는
   소비를 벌로 취급하지 않는다(벽지도 가구도 몇 번을 갈아도 값이 안 든다).
   화면의 배우와 목록의 초상은 다음 프레임에 저절로 따라온다(render3d sync·portrait). */
function setCatMarks(cat, marks){
  if (!cat) return null;
  cat.marks = normMarks(marks);
  save();
  return cat.marks;
}
/* 표정도 같은 규칙이다 — 언제든 바꾸고, 0 이면 상태 연동으로 돌아간다. */
function setCatFace(cat, i){
  if (!cat) return 0;
  cat.face = normFace(i);
  save();
  return cat.face;
}
/* 지원자 이름만 새로 뽑아준다 (🎲). 사내에 없는 이름을 고른다. */
function rerollCandidateName(){
  const c = candidateCat();
  c.name = uniqueName();
  save();
  return c.name;
}

function hire(look){
  if (S.cats.length >= deskCount())
    return { err: L({ ko:'자리가 없다냥. 사무실을 넓히자.', en:'No desks left, nya. Time for a bigger office.', ja:'席がないにゃ。オフィスを広げよう。' }) };
  const cost = hireCost();
  if (S.anchovy < cost)
    return { err: L({ ko:'멸치가 부족하다', en:'Not enough anchovies', ja:'煮干しが足りない' }) };
  S.anchovy -= cost;
  const c = styleCandidate(look);
  recOf(c).q = S.quarter;              // 입사 분기는 지원자를 굴린 때가 아니라 도장 찍은 때다
  S.candidate = null;                  // 다음 채용은 새 지원자를 굴린다
  c.x = W.door.x; c.y = W.H - 2;
  S.cats.push(c);
  assignDesks();
  pushLog(L({
    ko:`<b>${esc(c.name)}</b> 냥이 입사했습니다. (${traitOf(c).n})`,
    en:`<b>${esc(c.name)}</b> joined the company. (${traitOf(c).n})`,
    ja:`<b>${esc(c.name)}</b>が入社しました。（${traitOf(c).n}）`,
  }), 'good');
  save();
  return { cat:c };
}
/* 프롤로그 끝의 근로계약서. 1번 사원 = 프롤로그의 "나" = 플레이어다.
   채용(hire)과 달리 능력치를 다시 굴리지 않고, 돈도 받지 않는다 — 창업 멤버다. */
/* ── 시작화면이 읽는 거울 키 ──
   고른 로고는 저장(S.branch.logo)이 원본이다. 그런데 **시작화면은 저장을 읽기 전에
   그려진다** — title.js 는 부팅 맨 앞에서 돌고, 그 시점에는 게임 코드도 저장도 없다.
   거기서 저장 전체를 JSON.parse 하게 만들면 로고 한 줄 때문에 저장을 통째로 뜯게 되고,
   저장 형식이 바뀔 때 시작화면이 같이 깨진다. 그래서 **작은 키 하나로 비춰 둔다.**
   원본은 어디까지나 저장이고, 이 키는 그림 이름만 아는 사본이다. */
const LOGO_KEY = 'copycat.logo';
function setBranch(o){
  if (!S.branch || typeof S.branch !== 'object') S.branch = { logo:'', name:'' };
  if (o && typeof o.logo === 'string') S.branch.logo = o.logo;
  if (o && typeof o.name === 'string') S.branch.name = o.name.trim().slice(0, 10);
  try { localStorage.setItem(LOGO_KEY, S.branch.logo || ''); } catch(e){}
  save();
  return S.branch;
}
/* 「OO점」. 이름을 안 정했으면 지점 이름이 없는 것이고, 그 자리는 회사 이름이 채운다 —
   빈 이름에 「점」만 붙여 「점」이라는 지점을 만들지 않는다. */
const branchLabel = () => {
  const n = (S.branch && S.branch.name || '').trim();
  return n ? n + L({ ko:'점', en:' Br.', ja:'店' }) : '';
};

function signContract(look){
  const c = S.cats[0];
  if (!c) return null;
  if (look){
    if (typeof look.name === 'string'){
      const n = look.name.trim().slice(0, 12);
      if (n) c.name = n;
    }
    if (look.fur != null) c.fur = ((look.fur % FURS.length) + FURS.length) % FURS.length;
    if (look.hue != null) c.hue = look.hue;
    if (look.draw != null) c.draw = look.draw;
  }
  c.founder = true;
  S.intro = 1;
  save();
  return c;
}

function promote(id){
  const c = S.cats.find(x => x.id === id);
  if (!c || !nextRank(c)) return false;
  const cost = promoCost(c);
  if (S.anchovy < cost) return false;
  S.anchovy -= cost;
  c.rank++;
  c.needs.fun = Math.min(100, c.needs.fun + 30);
  /* 대표는 승진하지 않는다 — 직급은 처음부터 고정이고, 오르는 건 자기 몫이다 */
  pushLog(c.founder ? L({
    ko:`<b>${esc(c.name)}</b> 대표가 자기 몫을 올렸습니다. 아무도 반대하지 않았습니다.`,
    en:`<b>${esc(c.name)}</b> raised their own cut. Nobody objected.`,
    ja:`<b>${esc(c.name)}</b>社長が自分の取り分を上げました。誰も反対しませんでした。`,
  }) : L({
    ko:`<b>${esc(c.name)}</b> 냥이 <b>${RANKS[c.rank].n}</b>(으)로 승진했습니다.`,
    en:`<b>${esc(c.name)}</b> was promoted to <b>${RANKS[c.rank].n}</b>.`,
    ja:`<b>${esc(c.name)}</b>が<b>${RANKS[c.rank].n}</b>に昇進しました。`,
  }), 'good');
  bus.emit('cat:say', { cat:c, text: c.founder ? L({
    ko:'회사가 좀 살아났다냥', en:'The company can afford me, nya', ja:'会社が持ち直したにゃ',
  }) : L({
    ko: RANKS[c.rank].n + '이다냥!',
    en: RANKS[c.rank].n + ' now, nya!',
    ja: RANKS[c.rank].n + 'になったにゃ！',
  }) });
  save();
  return true;
}
function buyItem(id){
  const it = SHOP.find(x => x.id === id);
  if (!it || S.tier < it.tier) return false;
  /* 이미 있는 것도 하나 더 살 수 있다 — 단 가구가 있는 것만. 가구 없는 비품(오프라인
     수익 같은 것)은 두 번 사도 놓일 게 없으므로 한 번으로 끝난다. */
  const again = shopHas(id);
  if (again && !SHOP_TILE[id] && !it.wallTile) return false;
  /* 벽에 거는 비품(견본책)은 두 권 사도 걸 벽이 하나다.
     **커튼·메모는 예외다**(wallMany) — 창이 여럿이면 커튼도 여럿이 자연스럽고,
     메모는 애초에 여러 장 붙이는 물건이다. 견본책만 한 권인 이유는 그게 문이기 때문이고,
     문이 둘이면 그건 문이 아니라 벽지다. */
  if (again && it.wallTile && !it.wallMany) return false;
  const cost = shopCost(it);
  if (S.anchovy < cost) return false;

  /* 자리부터 잡고 돈을 받는다. 예전에는 순서가 반대라서, 사무실이 꽉 찼을 때
     돈만 빠져나가고 아무것도 안 나타났다 — 사는 사람 입장에서는 그냥 사라진 것이다.
     (기본 사무실에서 벽 쉼터가 정확히 이랬다.) */
  const tile = SHOP_TILE[id];
  if (tile && !addFurniture(tile)){
    sfx.err();
    toast(L({ ko:`사무실에 <b>${it.n}</b>을(를) 놓을 자리가 없습니다. 분기를 넘겨 사무실을 넓히세요.`,
              en:`No room for <b>${it.n}</b>. Advance quarters to expand the office.`,
              ja:`<b>${it.n}</b>を置く場所がありません。四半期を進めてオフィスを広げましょう。` }));
    return false;
  }
  /* 벽 물건은 바닥 자리를 안 먹는다 — 길찾기와 무관한 wallDecor 목록으로 산다.
     그래서 「자리가 없다」로 실패할 수 없고, 대신 걸 벽이 없으면 실패한다. */
  if (it.wallTile){
    const wt = TILE[it.wallTile];
    /* 여러 장 걸 수 있는 것은 **이미 있어도 한 장 더** 건다 — ensureWallItem 은
       「없으면 건다」라서 두 번째부터 조용히 실패한다(그러면 돈만 나간다). */
    const hung = it.wallMany ? addWallItem(W, wt, shopCount(id))
                             : ensureWallItem(W, wt, 7);
    if (!hung){
      sfx.err();
      toast(L({ ko:`<b>${it.n}</b>을(를) 걸 벽이 없습니다.`,
                en:`No wall to hang <b>${it.n}</b> on.`,
                ja:`<b>${it.n}</b>を掛ける壁がありません。` }));
      return false;
    }
    if (typeof snapshotWorld === 'function') snapshotWorld();
  }
  S.anchovy -= cost;
  S.shop[id] = shopCount(id) + 1;
  if (it.wallTile && typeof renderTiles === 'function') renderTiles();
  pushLog(again
    ? L({ ko:`<b>${it.n}</b>${it.em} 을(를) 하나 더 들였습니다 — 모두 ${shopCount(id)}개.`,
          en:`One more <b>${it.n}</b>${it.em} arrived — ${shopCount(id)} in total.`,
          ja:`<b>${it.n}</b>${it.em}をもう一つ入れました — 全部で${shopCount(id)}個。` })
    : L({ ko:`사무실에 <b>${it.n}</b>${it.em} 이(가) 들어왔습니다.`,
          en:`<b>${it.n}</b>${it.em} has been installed in the office.`,
          ja:`オフィスに<b>${it.n}</b>${it.em}が届きました。` }), 'good');
  save();
  return true;
}
/* ---------- 인테리어 ----------
   decor.js 는 카탈로그와 그림만 갖고 있고 **소유와 돈은 여기 있다.** 그래야
   「산 것만 목록에 있다」를 한 곳에서 지킬 수 있다(4번 규칙).

   고르기는 무료다 — 한 번 산 벽지는 계속 갖고 있고 몇 번을 갈아도 값이 안 든다.
   되돌릴 수 없는 소비는 이 게임에서 벌이 되기 때문이다(27번의 그 판단). */
function decorState(){
  if (!S.decor) S.decor = { wall:'plain', floor:'carpet', tone:'tone_std', own:['plain','carpet'], rugs:[] };
  if (!Array.isArray(S.decor.own)) S.decor.own = ['plain','carpet'];
  /* 옛 저장 보정 — 러그와 가구 톤은 2026-08-25 에 생겼다(TODO 49 · 34 뒷절반).
     빠진 칸을 기본값으로 채우기만 한다. 있던 벽지·바닥은 한 줄도 안 건드린다. */
  if (!S.decor.tone) S.decor.tone = 'tone_std';
  if (!Array.isArray(S.decor.rugs)) S.decor.rugs = [];
  /* 없어진 벌을 들고 있는 저장 — 가구 톤이 넷이던 하루가 있었고(tone_steel · tone_white)
     그 뒤 레퍼런스 아홉으로 갈렸다. 모르는 id 를 그대로 두면 DECOR.set 이 조용히
     무시해서 **저장에는 있고 화면에는 없는 벌**이 된다. 기본으로 되돌린다. */
  if (!DECOR.toneById[S.decor.tone]) S.decor.tone = 'tone_std';
  S.decor.own = S.decor.own.filter(id => !!DECOR.byId(id));
  return S.decor;
}
function decorOwns(id){
  const d = decorState();
  const it = DECOR.byId(id);
  if (!it) return false;
  if (it.cost === 0) return true;                 // 기본 한 벌은 처음부터 있다
  return d.own.includes(id);
}
/* 잠긴 둘(전단 도배·첫 사무실 바닥)은 팔지 않는다. Q28 의 잠긴 방을 열면
   story.js 가 grantDecor 로 넣어 준다 — 돈으로는 절대 안 된다. */
function decorBuy(id){
  const it = DECOR.byId(id);
  if (!it || it.cost < 0) return false;
  if (!shopHas('binder')) return false;
  if (decorOwns(id)) return false;
  if (S.anchovy < it.cost){ sfx.err(); return false; }
  S.anchovy -= it.cost;
  decorState().own.push(id);
  pushLog(L({ ko:`<b>${it.n}</b>을(를) 들였습니다.`,
              en:`<b>${it.n}</b> added to the binder.`,
              ja:`<b>${it.n}</b>を入れました。` }), 'good');
  save();
  return true;
}
function decorGrant(id, quiet){
  const it = DECOR.byId(id);
  if (!it || decorOwns(id)) return false;
  decorState().own.push(id);
  if (!quiet) pushLog(L({ ko:`견본책에 <b>${it.n}</b>이(가) 끼워져 있습니다.`,
                          en:`<b>${it.n}</b> is tucked into the binder.`,
                          ja:`見本帳に<b>${it.n}</b>が挟まっています。` }), 'good');
  save();
  return true;
}
function decorPick(id){
  const kind = DECOR.kindOf(id);
  if (!kind || !decorOwns(id)) return false;
  /* 러그는 「바른다」가 아니라 「깐다」다 — 한 장을 고르는 게 아니라 여러 장이
     각자 자리를 갖고 방에 놓인다. 그래서 누르면 깔거나 걷는다(rugToggle). */
  if (kind === 'rug') return rugToggle(id);
  const d = decorState();
  d[kind] = id;
  DECOR.set(d.wall, d.floor, d.tone, true);
  DECOR.clearCache();
  if (typeof renderTiles === 'function') renderTiles();
  save();
  return true;
}

/* ---------- 러그 (TODO 49) ----------
   깔린 러그는 `S.decor.rugs` 에 산다: `{ id, x, y, rot }`. 격자가 아니라 목록이고,
   `W.rugs` 는 **같은 배열을 가리킨다**(sim.js buildWorld) — 배치 모드가 옮긴 값이
   저장에 그대로 있어야 하고, 저장이 이사를 건너 살아남아야 하기 때문이다.

   격자에 안 들어가므로 길찾기·통행 검사는 이 파일을 모른다. 러그를 밟고 지나가는
   것이 이 물건의 전부다. */
const rugLaid = id => decorState().rugs.some(r => r.id === id);

/* 어디에 깔까 — 자동으로 한 자리 고른다. 규칙 하나뿐이다: **방 안에 들어갈 것.**
   그 안에서 바닥이 제일 많이 보이는 자리를 고른다(가구 밑에 깔려도 되지만,
   처음 깔릴 때 통째로 책상 밑이면 산 사람이 못 알아본다).
   같은 사무실에서 같은 답이 나와야 하므로 난수를 안 쓴다. */
function rugSpot(rw, rh){
  if (!W) return null;
  const free = (x, y) => W.grid[y*W.W + x] === TILE.FLOOR;
  const taken = (x, y) => decorState().rugs.some(r => {
    const s = DECOR.rugSize(r);
    return x >= r.x && x < r.x + s.w && y >= r.y && y < r.y + s.h;
  });
  let best = null, bestScore = -1;
  for (let y = 1; y + rh <= W.H - 1; y++)
    for (let x = 1; x + rw <= W.W - 1; x++){
      let score = 0, ok = true;
      for (let j = 0; j < rh && ok; j++)
        for (let i = 0; i < rw; i++){
          if (taken(x+i, y+j)){ ok = false; break; }        // 러그 위에 러그는 안 깐다
          if (free(x+i, y+j)) score += 2;
          else score -= 1;                                   // 가구 밑도 되지만 덜 좋다
        }
      /* 방 한가운데를 아주 조금 민다 — 구석에 처박히면 산 게 안 보인다 */
      const cx = (x + rw/2) / W.W - 0.5, cy = (y + rh/2) / W.H - 0.5;
      score -= (Math.abs(cx) + Math.abs(cy)) * 1.5;
      if (ok && score > bestScore){ bestScore = score; best = { x, y }; }
    }
  return best;
}

/* 깔거나 걷는다. 이미 깔려 있으면 말아서 치운다(값은 안 돌려준다 — 계속 갖고 있다). */
function rugToggle(id){
  const it = DECOR.byId(id);
  if (!it || DECOR.kindOf(id) !== 'rug') return false;
  const d = decorState();
  const i = d.rugs.findIndex(r => r.id === id);
  if (i >= 0){
    d.rugs.splice(i, 1);
  } else {
    const spot = rugSpot(it.w, it.h);
    if (!spot){
      if (typeof toast === 'function') toast(L({
        ko:'깔 자리가 없다냥. 사무실을 넓히거나 다른 러그를 걷어 보세요.',
        en:'No room to lay it. Expand the office, or roll up another rug.',
        ja:'敷く場所がないにゃ。オフィスを広げるか、別のラグを片づけて。' }));
      return false;
    }
    d.rugs.push({ id, x:spot.x, y:spot.y, rot:0 });
  }
  if (W) W.rugs = d.rugs;
  save();
  if (typeof renderTiles === 'function') renderTiles();
  return true;
}

/* 저장을 불러온 직후 한 번. decor.js 의 사본을 저장과 맞춘다 */
function decorSync(){
  const d = decorState();
  DECOR.set(d.wall, d.floor, d.tone, true);
  DECOR.clearCache();
}

/* ============================================================
   흔적 · 혐의 · 냥찰

   **혐의는 마감에서만 나온다.** ⏰ 를 걸어 둔 건을 그 날짜 안에 못 내면, 업무일이
   넘어가는 순간 그 서류는 정리되지 못한 채 밖으로 샌다 = 증거.

   전에는 **분기 마감**이 이 자리였다. 그런데 이 게임의 분기는 시간이 아니라 성과(KPI)로
   굴러간다 — 일을 많이 하면 분기가 빨리 닫히고, 그러면 아직 안 끝낸 건이 **더 빨리**
   샜다. 열심히 한 사람이 먼저 걸리는 시계였고, 그건 규칙이 아니라 버그에 가까웠다.
   지금은 사람이 정한 날짜가 그 시계다.

   혐의가 쌓이면 다들 몸을 사려 생산성이 떨어지고, 5점을 넘기면 압수수색이 들어온다.
   ============================================================ */
const RAID_THRESHOLD = 5;   // 이 점수를 넘으면 영장이 나온다

/* 혐의 1점당 생산 -6% — 다들 몸을 사린다. 압수수색 중엔 sim에서 추가 감산 */
function legalDrag(){ return Math.max(0.40, 1 - 0.06 * (S.penalty || 0)); }

/* ============================================================
   경쟁사 — 멍멍파
   마약 개껌을 만드는 강아지 조직. 우리가 분기마다 충분히 굴리지 않으면
   그 사이에 거래처를 가져간다. 뺏긴 점유율만큼 수입이 줄어든다.
   "가만히 있으면 손해"를 시스템으로 만든 장치.
   ============================================================ */
const RIVAL_MAX = 0.60;
/* 분기 결산에 붙는 멍멍파 근황 — 점유율이 오를수록 노골적으로 */
const RIVAL_NEWS = [
  L({ ko:'멍멍파는 아직 우리 구역 밖에 있습니다.',
      en:'The Woof Gang is still outside our turf.',
      ja:'ワンワン組はまだうちのシマの外です。' }),
  L({ ko:'멍멍파가 옆 골목에 개껌 노점을 냈습니다.',
      en:'The Woof Gang opened a chew stall in the next alley.',
      ja:'ワンワン組が隣の路地にガム屋台を出しました。' }),
  L({ ko:'우리 단골 몇이 개껌으로 갈아탔다는 보고가 있습니다.',
      en:'Reports say a few of our regulars switched to chews.',
      ja:'常連の何匹かがガムに乗り換えたとの報告があります。' }),
  L({ ko:'멍멍파 영업책이 우리 거래처에 명함을 돌리고 있습니다.',
      en:'Woof Gang sales dogs are handing out cards to our clients.',
      ja:'ワンワン組の営業がうちの取引先に名刺を配っています。' }),
  L({ ko:'거래처 절반이 개껌을 같이 받고 있습니다. 곧 우리를 뺄 겁니다.',
      en:'Half our clients now also take chews. They’ll drop us soon.',
      ja:'取引先の半分がガムも仕入れています。じきにうちは切られます。' }),
];
const rivalNews = () => RIVAL_NEWS[Math.min(RIVAL_NEWS.length-1, Math.floor((S.rival||0) / 0.13))];
/* 분기당 이 정도는 처리해야 본전 — 사무실이 클수록 기대치도 오른다 */
const rivalPar = () => 3 + S.tier * 2;
function rivalDrag(){ return 1 - Math.min(RIVAL_MAX, S.rival || 0); }
function rivalShift(done){
  const par = rivalPar();
  let d;
  if (done <= 0)            d = +0.12;     // 한 건도 안 처리하면 크게 뺏긴다
  else if (done < par)      d = +0.06;
  else if (done < par * 1.6) d = -0.03;
  else                       d = -0.07;    // 확실히 밀어붙인 분기는 되찾는다
  const before = S.rival;
  S.rival = Math.max(0, Math.min(RIVAL_MAX, S.rival + d));
  return { before, after: S.rival, par, delta: S.rival - before };
}

/* 하루에 샐 수 있는 점수의 천장. 스무 건을 한꺼번에 놓친 하루가 곧바로 압수수색이
   되면 그건 규칙이 아니라 사고다 — 법무팀이 하루에 처리할 수 있는 양이 이만큼이라고 읽는다. */
const LEAK_CAP = 3;
const leakPoints = t => (t.size === 'l' ? 2 : 1);

/* 기한을 넘긴 건들이 밖으로 샌다. **목록에서 지우지 않는다** — 값은 치르지만 할 일은
   그대로 남아 있고, 늦게라도 도장을 찍으면 completeTodo 가 그 점수를 되돌린다. */
function leakOverdue(list){
  if (!list.length) return null;
  let points = 0;
  list.forEach(t => {
    const p = Math.min(leakPoints(t), Math.max(0, LEAK_CAP - points));
    t.late = p;                      // 이 건이 만든 점수. 늦게 처리하면 이만큼 지워진다
    points += p;
  });
  const fee = Math.round(S.anchovy * Math.min(0.12, 0.03 * list.length));
  S.anchovy = Math.max(0, S.anchovy - fee);
  S.penalty += points;
  S.referred += list.length;
  S.cats.forEach(c => { c.needs.fun = Math.max(0, c.needs.fun - 8); });
  sendLegal();
  pushLog(L({
    ko:`기한을 넘긴 <b>${list.length}건</b>이 정리되지 않은 채 밖으로 나갔습니다. 혐의 +${points}, 뒷수습 비용 🐟${fmt(fee)}.`
      + ' 늦게라도 처리하면 그만큼 지워집니다.',
    en:`<b>${list.length} past-due item(s)</b> leaked out uncleaned. Heat +${points}, cleanup 🐟${fmt(fee)}.`
      + ' Filing them late clears that much again.',
    ja:`期限を過ぎた<b>${list.length}件</b>が整理されないまま流出。容疑+${points}、後始末🐟${fmt(fee)}。`
      + '遅れてでも処理すればその分は消えます。',
  }), 'bad');
  return { count:list.length, points, fee, items:list.map(t => t.text) };
}

/* ---------- 기한 정산 ----------
   업무일이 넘어갈 때(biz:new), 그리고 며칠 닫아 두었다 돌아왔을 때 한 번 부른다.
   두 경로가 같은 함수를 쓰는 게 중요하다 — 닫아 둔 사이에 지나간 기한이 그냥 없어지면
   기한은 "창을 켜 두면 걸리는 벌"이 되고, 그건 이 게임에서 제일 하지 말아야 할 것이다.
   그리고 며칠을 비웠어도 **한 건이 새는 건 한 번뿐**이다(t.late 가 이미 서 있으면 넘긴다). */
function settleDue(){
  const today = bizToday();
  /* 오늘 이 정산을 처음 도는가. 새는 것은 t.late 로 한 번만 부과되니 몇 번 불러도
     같지만, **1점 소멸은 하루에 한 번**이어야 한다 — 안 그러면 창을 몇 번 여는 것이
     혐의를 지우는 방법이 된다. */
  const first = S.dueDay !== today;
  const list = leakable();
  const leaked = list.length ? leakOverdue(list) : null;

  /* 어제 기한이던 건을 하나도 안 놓치고 다 냈으면 혐의 1점이 소멸한다.
     전에는 "흔적 없는 분기"가 이 자리였다. 하루가 그 자리를 물려받는 게 맞다 —
     지켜야 하는 단위가 하루로 내려왔으니 회복하는 단위도 하루여야 한다. */
  let cleared = 0;
  if (first && !leaked && S.penalty > 0){
    const y = addDays(today, -1);
    const yy = S.todos.filter(t => t.alarm && t.due === y);
    if (yy.length && yy.every(t => t.done)){
      S.penalty--; cleared = 1;
      pushLog(L({
        ko:`어제 기한을 전부 지켰습니다. 혐의 1점이 소멸되었습니다.`,
        en:`Every deadline yesterday was met. Heat -1.`,
        ja:`昨日の期限はすべて守られました。容疑1点が消滅。`,
      }), 'good');
    }
  }
  /* 여기서 도장을 찍어 둔다 — 부팅에서 한 번 돌고 첫 틱이 또 도는 걸 막는다.
     (sim.js 의 biz:new 는 S.bizKey 를 보고 판단한다) */
  S.dueDay = today; S.bizKey = today;
  if (leaked || cleared || first) save();
  return { leaked, cleared };
}

/* ---------- 오래된 줄 접기 ----------
   캘린더가 지난 날을 보여주므로 끝난 건도 지우지 않는다. 대신 넉 달이 지난 줄은
   **날짜별 숫자로 접는다**(S.days) — 그 뒤로도 달력의 그 칸은 비지 않고, 저장은 안 자란다.
   접는 단위가 날인 것이 요점이다: 지난 6월의 할 일 제목까지 들고 있을 이유는 없지만,
   그날 뭔가 했다는 사실은 남아 있어야 그 칸이 거짓말을 하지 않는다. */
const KEEP_DAYS = 120;
function pruneTodos(){
  const cut = addDays(bizToday(), -KEEP_DAYS);
  const old = S.todos.filter(t => (t.doneDay || t.due) < cut);
  if (!old.length) return 0;
  const days = S.days || (S.days = {});
  old.forEach(t => {
    const k = t.doneDay || t.due;
    const d = days[k] || (days[k] = { up:0, done:0, late:0 });
    d.up++;
    if (t.done) d.done++;
    if (t.late) d.late++;
  });
  const ids = new Set(old.map(t => t.id));
  S.todos = S.todos.filter(t => !ids.has(t.id));
  return old.length;
}

/* 무마 — 혐의를 돈으로 지운다.
   불법 회사에 어울리는 선택지이자, "무사고 분기로 버틸까 / 돈으로 막을까"의 저울질. */
function lobbyCost(){ return Math.max(600, Math.round(S.anchovy * 0.22)); }
function lobby(){
  if (!S.penalty || RAID) return false;
  const cost = lobbyCost();
  if (S.anchovy < cost) return false;
  S.anchovy -= cost;
  S.penalty--;
  S.stats.lobbied = (S.stats.lobbied || 0) + 1;
  pushLog(L({
    ko:`법무법인에 <b>🐟${fmt(cost)}</b>을 집행했습니다. 혐의 1점이 조용히 사라졌습니다.`,
    en:`Paid <b>🐟${fmt(cost)}</b> to the law firm. One point of heat quietly vanished.`,
    ja:`法律事務所に<b>🐟${fmt(cost)}</b>を執行。容疑1点が静かに消えました。`,
  }), 'bad');
  bus.emit('lobby', { cost });
  save();
  return true;
}

/* 냥찰 압수수색 종료 — sim.js의 RAID 타이머가 부른다 */
function endRaid(){
  if (!RAID) return;
  RAID = null;
  NPCS.forEach(n => { if (n.npc === 'police'){ n.job.stage = 'leave'; n.job.t = 0; } });

  const fine = Math.round(S.anchovy * 0.15);
  S.anchovy = Math.max(0, S.anchovy - fine);
  const before = S.penalty;
  S.penalty = 0;

  let taken = null;
  if (S.cats.length >= 3 && Math.random() < 0.35){
    const i = 1 + Math.floor(Math.random() * (S.cats.length - 1));   // 대표냥(0번)은 안 잡혀간다
    taken = S.cats.splice(i, 1)[0];
    taken.doc = null;
    const rec = recOf(taken);
    rec.det++; rec.detQ = S.quarter;   // 무혐의로 돌아와도 연행된 사실은 기록에 남는다
    S.jail.push({ cat: taken, returnQ: S.quarter + 1 });
    assignDesks();
  }
  S.cats.forEach(c => { c.needs.fun = Math.max(0, c.needs.fun - 25); });

  pushLog(L({
    ko:`냥찰청 조사 종료. 과징금 🐟${fmt(fine)} 부과, 혐의 ${before} → 0.`
      + (taken ? ` <b>${esc(taken.name)}</b> 냥은 참고인 조사차 연행되었습니다.` : ''),
    en:`Pawlice investigation over. Fine of 🐟${fmt(fine)}, heat ${before} → 0.`
      + (taken ? ` <b>${esc(taken.name)}</b> was taken in as a witness.` : ''),
    ja:`ニャン察の調査終了。課徴金🐟${fmt(fine)}、容疑${before}→0。`
      + (taken ? `<b>${esc(taken.name)}</b>は参考人として連行されました。` : ''),
  }), 'bad');
  bus.emit('raid:end', { fine, taken, before });
  save();
}

/* ---------- 로그 ---------- */
function pushLog(text, kind){
  S.log.push({ t:text, k:kind || '' });
  if (S.log.length > 140) S.log.shift();
  bus.emit('log', { text, kind });
}

/* ---------- 분기 결산 ---------- */
function closeQuarter(){
  const q = S.quarter;
  const earned = S.stats.qEarned, done = S.stats.qDone;

  /* 분기 마감은 이제 **혐의를 건드리지 않는다.** 흔적은 기한에서만 나오고(settleDue),
     그 시계는 사람이 정한 날짜다. 여기 있던 이관·소멸을 남겨 두면 같은 일에 두 번
     값을 치른다. 결산 화면의 「미처리 건 유출」 칸도 같이 뗐다 (ui.js). */

  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  let evText = ev.t, evGain = 0, evHire = null, evDrop = null;

  if (ev.money) evGain = -Math.round(S.anchovy * Math.abs(ev.money));
  if (ev.flat)  evGain = Math.round(Math.max(100, earned * 0.25) * ev.flat);
  if (ev.need){
    S.cats.forEach(c => {
      for (const k in ev.need) c.needs[k] = Math.max(0, Math.min(100, c.needs[k] + ev.need[k]));
    });
  }
  if (ev.heat){ S.penalty = Math.max(0, S.penalty + ev.heat); }
  if (ev.rival){ S.rival = Math.max(0, Math.min(RIVAL_MAX, S.rival + ev.rival)); }
  /* 분기마다 가끔 떨어지던 것이 **장비**였는데 그 체계를 없앴다(js/cats.js 머리말).
     빈자리를 두지 않고 **본사 택배 한 상자**로 갈음한다 — 얻는 리듬은 그대로 두되
     그 보상이 이미 있는 물건(TODO 57)으로 흐르게 한다. 상자는 세는 데가 한 곳이다. */
  if (ev.drop || Math.random() < 0.35){
    if (typeof gaS === 'function') gaS().tix = (gaS().tix | 0) + 1;
    evDrop = { n: L({ ko:'본사 택배 한 상자', en:'A parcel from HQ', ja:'本社からの宅配ひと箱' }) };
  }
  if (ev.k === 'hire'){
    if (S.cats.length < deskCount()){
      evHire = newCat();
      evHire.x = W.door.x; evHire.y = W.H - 2;
      S.cats.push(evHire);
      assignDesks();
    } else {
      evText = L({
        ko:'신입 냥이가 문 앞에 왔지만 자리가 없어 발길을 돌렸다.',
        en:'A rookie came to the door, but there was no desk — they turned away.',
        ja:'新入りが来たが、席がなくて帰っていった。',
      });
    }
  }
  S.anchovy = Math.max(0, S.anchovy + evGain);

  S.quarter++;
  S.kpi = Math.max(0, S.kpi - qTarget(q));
  S.stats.qEarned = 0; S.stats.qDone = 0;

  // 2) 연행됐던 직원 복귀
  const back = S.jail.filter(j => j.returnQ <= S.quarter);
  S.jail = S.jail.filter(j => j.returnQ > S.quarter);
  back.forEach(j => {
    j.cat.needs.fun = 45; j.cat.needs.energy = 60;
    j.cat.x = W.door.x; j.cat.y = W.H - 2;
    S.cats.push(j.cat);
    pushLog(L({
      ko:`<b>${esc(j.cat.name)}</b> 냥이 조사를 마치고 복귀했습니다. 무혐의.`,
      en:`<b>${esc(j.cat.name)}</b> is back from questioning. Cleared.`,
      ja:`<b>${esc(j.cat.name)}</b>が取り調べから復帰。嫌疑なしです。`,
    }), 'good');
  });
  if (back.length) assignDesks();

  const oldTier = S.tier;
  const newTier = tierForQuarter(S.quarter);
  let moved = false;
  if (newTier > oldTier){
    S.tier = newTier;
    S.seed = Math.floor(Math.random() * 1e9);   // 새 사무실은 새로 그린다
    buildWorld(true);
    moved = true;
  }

  // 경쟁사 정산 — 이번 분기에 얼마나 굴렸는지로 점유율이 오간다
  const rival = rivalShift(done);
  // 점유율이 높으면 끄나풀이 문 앞을 기웃거린다
  if (S.rival >= 0.25) setTimeout(sendRival, 1800);
  if (rival.delta > 0)
    pushLog(L({
      ko:`분기 처리량이 par(${rival.par})에 못 미쳤습니다. <b>멍멍파</b>가 거래처를 가져갔습니다. `
        + `점유율 ${Math.round(rival.before*100)}% → ${Math.round(rival.after*100)}%`,
      en:`Quarterly volume fell short of par (${rival.par}). The <b>Woof Gang</b> took clients. `
        + `Share ${Math.round(rival.before*100)}% → ${Math.round(rival.after*100)}%`,
      ja:`今期の処理量がpar（${rival.par}）に届かず。<b>ワンワン組</b>に取引先を取られました。`
        + `シェア${Math.round(rival.before*100)}%→${Math.round(rival.after*100)}%`,
    }), 'bad');
  else if (rival.delta < 0)
    pushLog(L({
      ko:`거래처를 되찾았습니다. 멍멍파 점유율 ${Math.round(rival.before*100)}% → ${Math.round(rival.after*100)}%`,
      en:`Clients won back. Woof Gang share ${Math.round(rival.before*100)}% → ${Math.round(rival.after*100)}%`,
      ja:`取引先を取り戻しました。ワンワン組のシェア${Math.round(rival.before*100)}%→${Math.round(rival.after*100)}%`,
    }), 'good');

  const bonus = Math.round(Math.max(150, earned * 0.5) * (1 + S.tier * 0.4));
  S.anchovy += bonus;
  S.cats.forEach(c => { c.needs.fun = Math.min(100, c.needs.fun + 40); });

  pushLog(L({
    ko:`<b>Q${q} 결산</b> — 매출 🐟${fmt(earned)}, 결재 ${done}건. ${evText}`,
    en:`<b>Q${q} report</b> — revenue 🐟${fmt(earned)}, ${done} approvals. ${evText}`,
    ja:`<b>Q${q}決算</b>——売上🐟${fmt(earned)}、決裁${done}件。${evText}`,
  }), 'big');
  if (evDrop) pushLog(L({
    ko:`📦 <b>${evDrop.n}</b> 이(가) 도착했습니다.`,
    en:`📦 <b>${evDrop.n}</b> arrived.`,
    ja:`📦 <b>${evDrop.n}</b>が届きました。`,
  }), 'good');
  if (moved)  pushLog(L({
    ko:`🎉 <b>${TIERS[S.tier].name}</b>(으)로 이전했습니다. 자리 ${deskCount()}석`,
    en:`🎉 Moved to <b>${TIERS[S.tier].name}</b>. ${deskCount()} desks`,
    ja:`🎉 <b>${TIERS[S.tier].name}</b>に移転。席は${deskCount()}席`,
  }), 'big');
  /* 이전하면 비품 목록이 늘어난다. 그런데 잠긴 비품을 목록에서 감춘 뒤로는(ui.js shopHTML)
     **늘어난 걸 아무도 안 알려준다** — 상점을 다시 열어 보는 사람만 안다.
     그래서 해금을 사건으로 만든다. 무엇이 열렸는지 이름까지 말해도 된다,
     지금은 살 수 있으니까. 감춰야 하는 건 아직 못 사는 것뿐이다. */
  if (moved){
    const opened = SHOP.filter(it => it.tier > oldTier && it.tier <= S.tier);
    if (opened.length) pushLog(L({
      ko:`총무가 비품 목록을 갱신했습니다 — ${opened.map(it => `${it.em} <b>${it.n}</b>`).join(', ')}`,
      en:`Admin updated the supply catalog — ${opened.map(it => `${it.em} <b>${it.n}</b>`).join(', ')}`,
      ja:`総務が備品目録を更新しました——${opened.map(it => `${it.em} <b>${it.n}</b>`).join('、')}`,
    }), 'good');
  }

  /* 2-b) 도배 자투리 — 견본책이 걸려 있으면 총무가 분기마다 한 번쯤 남은 걸 준다.
     돈이 안 도는 초반에도 벽지가 한 장씩 늘어나야 이 물건이 산 값을 한다.
     무엇이 올지는 못 고른다 — 고르면 그건 선물이 아니라 상점이다.
     비싼 것부터 주지 않는다(값 순으로 싼 절반에서 뽑는다): 첫 자투리로 5,600멸치짜리가
     나오면 그 뒤의 상점이 전부 시들해진다. */
  if (shopHas('binder') && Math.random() < 0.45){
    /* 러그도 자투리로 온다 — 견본책의 셋째 칸이고 값도 벽지 언저리다.
       **가구 톤은 뺐다.** 벌은 방 한 채가 통째로 바뀌는 물건이라 「어느 날 총무가
       사무실을 흰색으로 바꿔 놓았다」가 되고, 그건 선물이 아니라 사고다. */
    const pool = DECOR.WALLS.concat(DECOR.FLOORS, DECOR.RUGS)
      .filter(it => it.cost > 0 && !decorOwns(it.id))
      .sort((a, b) => a.cost - b.cost);
    const cut = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
    const pick = cut[Math.floor(Math.random() * cut.length)];
    if (pick){
      decorState().own.push(pick.id);
      pushLog(L({ ko:`총무가 <b>${pick.n}</b> 자투리를 견본책에 끼워 두었습니다.`,
                  en:`Admin tucked a scrap of <b>${pick.n}</b> into the binder.`,
                  ja:`総務が<b>${pick.n}</b>の端切れを見本帳に挟んでおきました。` }), 'good');
    }
  }

  // 3) 혐의 한계 초과 → 영장 발부
  const raiding = S.penalty >= RAID_THRESHOLD;
  if (raiding){
    pushLog(L({
      ko:`혐의 ${S.penalty}점. <b>냥찰청 특별사법경찰</b>이 압수수색 영장을 받았습니다.`,
      en:`Heat at ${S.penalty}. The <b>Pawlice Special Investigation Unit</b> got a search warrant.`,
      ja:`容疑${S.penalty}点。<b>ニャン察庁特別司法警察</b>に捜索令状が出ました。`,
    }), 'bad');
    setTimeout(startRaid, 2500);
  }

  bus.emit('quarter:closed', {
    q, earned, done, evText, evGain, evHire, evDrop, moved, oldTier, bonus,
    back, raiding, penalty:S.penalty, rival, rivalNews: rivalNews(),
  });
  save();
}

/* ---------- 닫혀 있던 시간 ----------
   돌아온 사람에게 숫자 하나만 내미는 건 정산이지 인수인계가 아니다.
   그래서 실제 상태에서만 두세 문장을 뽑는다. 규칙은 두 개다:
     1) 없던 사건은 지어내지 않는다 — 사무실이 닫혀 있는 동안 아무도 오지 않았고
        혐의도 점유율도 움직이지 않았다. 그러니 "그대로였다"까지만 쓴다.
     2) 재촉하지 않는다. 남은 서류는 세기만 하고, 왜 안 했는지는 묻지 않는다.
        벌어들이지 못한 금액을 계산해 보여주는 것도 재촉이다 — 그건 쓰지 않는다. */
function closedStory(gain, rates, total, feeder){
  const out = [];

  // 1) 급식기가 돌린 몫이 있으면 누가 벌었는지까지 쓴다 — 수익을 나눈 그 비율 그대로다.
  //    없으면 그냥 닫혀 있었다고 쓴다. 그게 사실이고, 사실이 제일 안 미안하다.
  const top = feeder && gain > 0 ? rates.slice().sort((a, b) => b.r - a.r)[0] : null;
  if (!top){
    out.push(S.cats.length === 1
      ? L({ ko:'문은 잠겨 있었습니다. 혼자 남은 고양이가 상자 안에서 잤습니다.',
            en:'The door stayed locked. Your one cat slept in the box.',
            ja:'ドアは閉まったまま。ひとりの猫が箱の中で寝ていました。' })
      : L({ ko:'문은 잠겨 있었습니다. 고양이들은 각자 자리에서 잤습니다.',
            en:'The door stayed locked. The cats slept at their own desks.',
            ja:'ドアは閉まったまま。猫たちはそれぞれの席で寝ていました。' }));
  }
  if (top){
    const share = total > 0 ? top.r / total : 1;
    const cut = Math.round(gain * share);
    const nm = esc(top.c.name);
    out.push(S.cats.length === 1
      ? L({ ko:`혼자 사무실을 지킨 <b>${nm}</b> 냥이 🐟${fmt(cut)} 벌어놨습니다.`,
            en:`<b>${nm}</b> held the office alone and brought in 🐟${fmt(cut)}.`,
            ja:`ひとりでオフィスを守った<b>${nm}</b>が🐟${fmt(cut)}を稼いでおきました。` })
      : L({ ko:`가장 많이 벌어온 건 <b>${nm}</b> ${rankName(top.c)}입니다 — 🐟${fmt(cut)}, 전체의 ${Math.round(share*100)}%.`,
            en:`<b>${nm}</b> (${rankName(top.c)}) brought in the most — 🐟${fmt(cut)}, ${Math.round(share*100)}% of it.`,
            ja:`いちばん稼いだのは<b>${nm}</b>${rankName(top.c)}——🐟${fmt(cut)}、全体の${Math.round(share*100)}%です。` }));
  }

  // 2) 쉰 흔적. 닫혀 있던 사무실에서 고양이는 일하지 않고 쉰다 —
  //    돌아온 사람이 제일 먼저 볼 문장이 "다들 잘 쉬었다"인 편이 낫다.
  const rested = S.cats.slice().sort((a, b) => b.needs.energy - a.needs.energy)[0];
  if (rested && rested.needs.energy >= 70 && rested !== (top && top.c)){
    const nm = esc(rested.name), e = Math.round(rested.needs.energy);
    out.push(L({ ko:`<b>${nm}</b> 냥은 푹 쉬었습니다 — 기력 ${e}.`,
                 en:`<b>${nm}</b> is well rested — energy ${e}.`,
                 ja:`<b>${nm}</b>はよく休みました——気力${e}。` }));
  }

  // 3) 마지막 한 줄은 지금 사무실의 사실 하나. 참인 것 중 위에서부터 하나만 고른다.
  const jailed = S.jail[0];
  const inbox = DOCS.filter(d => d.state !== 'done').length;
  const left = S.todos.filter(t => !t.done).length;
  const over = overdueTodos().length;
  if (jailed){
    const nm = esc(jailed.cat.name);
    out.push(L({ ko:`<b>${nm}</b> 냥은 아직 조사 중입니다. Q${jailed.returnQ}에 돌아옵니다.`,
                 en:`<b>${nm}</b> is still being questioned. Back in Q${jailed.returnQ}.`,
                 ja:`<b>${nm}</b>はまだ取り調べ中です。Q${jailed.returnQ}に戻ります。` }));
  } else if (inbox){
    out.push(L({ ko:`결재함에는 서류 ${inbox}장이 그대로 놓여 있습니다.`,
                 en:`${inbox} document(s) are still sitting in the inbox.`,
                 ja:`決裁箱には書類が${inbox}枚そのまま置いてあります。` }));
  } else if (over){
    out.push(L({ ko:`기한을 넘긴 ${over}건이 목록에 남아 있습니다. 늦게라도 내면 혐의는 지워집니다.`,
                 en:`${over} past-due item(s) are still on the list — filing them late still clears the heat.`,
                 ja:`期限を過ぎた${over}件がリストに残っています。遅れてでも出せば容疑は消えます。` }));
  } else if (left){
    out.push(L({ ko:`할 일 목록은 ${left}건 그대로입니다.`,
                 en:`The list is unchanged at ${left} item(s).`,
                 ja:`やることリストは${left}件のままです。` }));
  } else if (S.penalty > 0){
    out.push(L({ ko:`혐의는 ${S.penalty}점 그대로입니다. 그동안 찾아온 사람은 없었습니다.`,
                 en:`Heat is unchanged at ${S.penalty}. Nobody came by in the meantime.`,
                 ja:`容疑は${S.penalty}点のままです。その間、訪ねてきた者はいません。` }));
  } else if (S.rival >= 0.15){
    out.push(L({ ko:`멍멍파 점유율은 ${Math.round(S.rival*100)}%에서 움직이지 않았습니다.`,
                 en:`The Woof Gang’s share stayed put at ${Math.round(S.rival*100)}%.`,
                 ja:`ワンワン組のシェアは${Math.round(S.rival*100)}%のまま動いていません。` }));
  } else {
    out.push(L({ ko:'그 밖에는 별일 없었습니다. 문은 잠겨 있었고, 아무도 오지 않았습니다.',
                 en:'Otherwise, nothing happened. The door stayed locked and nobody came.',
                 ja:'ほかに変わったことはありません。ドアは閉まったまま、誰も来ませんでした。' }));
  }
  return out;
}

/* ---------- 닫혀 있던 시간의 정산 ----------
   예전에는 꺼둔 시간을 "전원이 항상 자리에 앉아 있었다"고 가정하고, 시간대 배수도
   없이 55%로 지급했다. 실시간은 실제로 앉아 있는 고양이만 세고 밤에는 0.35를 곱한다.
   그래서 밤새 꺼두는 쪽이 밤새 켜두는 쪽보다 몇 배 이득이었다 — 옆에 있어 주는 게
   전부인 게임에서 유인이 정확히 반대로 걸려 있었다.

   이제 닫혀 있던 시간은 0이다. 사무실이 닫혀 있었으면 아무 일도 없었던 것이다.
   대신 켜 둔 시간은 배경에 있어도 실제로 시뮬레이션된다 (js/main.js 의 watchdog).

   예외는 자동급식기 하나. 밥 주는 사람이 있으면 근무시간 동안은 조금 돌아간다.
   비품 하나에 이 역할을 맡긴 건 바닥을 만들기 위해서다 — 노트북 덮은 사람에게
   못 번 돈을 계산해 보여주는 게임이 되면, 동행하려던 물건이 잔소리가 된다. */
const CLOSED_RATE = 0.25;        // 급식기가 있을 때 잠재 생산의 몇 %로 도는가
const CLOSED_SEATED = 0.6;       // 그동안의 평균 착석 비율 — 실시간 관측값에 맞춘 근사
const CLOSED_CAP_H = 8;          // 이 이상은 세지 않는다
/* 닫혀 있어도 사무실은 근무시간에만 돈다. 밤에 닫아둔 시간이 0인 건 벌이 아니라
   사실이다 — 고양이들은 22시부터 자니까. 이래서 "밤새 켜두기" 유인도 안 생긴다. */
const CLOSED_PHASE = { day:1, lunch:0.5, evening:0.25, night:0 };

const minOfDay = ts => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };

/* 닫혀 있던 구간을 5분 단위로 걸으며 "근무시간으로 환산한 초"를 더한다.
   상한(8시간)을 이 환산값에 물리는 게 중요하다. 최근 8시간 창을 잘라 쓰면
   15시에 닫고 아침에 돌아온 사람은 창이 통째로 밤에 걸려서 0이 되는데,
   그 사람의 부재에는 분명히 근무시간이 들어 있었다. */
function closedEffectiveSec(fromTs, toTs){
  const STEP = 5 * 60 * 1000;
  let eff = 0;
  for (let t = fromTs; t < toTs; t += STEP){
    const span = Math.min(STEP, toTs - t) / 1000;
    eff += span * (CLOSED_PHASE[phaseOf(minOfDay(t))] || 0);
  }
  return eff;
}

function settleClosed(sec){
  const now = Date.now();
  S.last = now;
  if (!S.cats.length || sec < 60) return null;

  /* 닫힌 사무실에서 고양이는 일하지 않고 쉰다. 예전엔 여기서 욕구를 깎았는데
     그건 "자리를 비운 동안에도 일했다"는 옛 모델의 흔적이다.
     회복은 75까지만 — 넘기면 "쉬게 하려고 끄는" 유인이 생긴다. */
  const rest = Math.min(45, sec / 3600 * 14);
  S.cats.forEach(c => {
    if (c.needs.energy < 75) c.needs.energy = Math.min(75, c.needs.energy + rest);
    if (c.needs.fun < 75)    c.needs.fun    = Math.min(75, c.needs.fun + rest * 0.6);
  });

  // 고양이별 몫을 여기서 같이 뽑는다 — 리포트에 쓸 "누가 제일 벌었나"가
  // 총합을 나누는 그 비율 자체여야 한다. 따로 계산하면 없는 얘기가 된다.
  const feeder = shopHas('feeder');
  let gain = 0, rates = [], total = 0;
  if (feeder){
    rates = S.cats.map(c => ({ c, r: catRate(c) }));
    total = rates.reduce((a, x) => a + x.r, 0);
    // 근무시간으로 환산한 초에 상한을 물린다 — 밤만 걸친 부재는 이 값이 0이다
    const eff = Math.min(closedEffectiveSec(now - sec * 1000, now), CLOSED_CAP_H * 3600);
    gain = Math.round(total * CLOSED_SEATED * CLOSED_RATE * shopMul('offline', 1) * eff);
    if (gain > 0){ S.anchovy += gain; S.stats.totalEarned += gain; S.stats.qEarned += gain; }
  }
  // 시계는 데스크탑 시각과 동기라 여기서 감을 필요가 없다

  const hrs = sec / 3600;
  const timeStr = hrs >= 1
    ? L({ ko: hrs.toFixed(1) + '시간', en: hrs.toFixed(1) + 'h', ja: hrs.toFixed(1) + '時間' })
    : L({ ko: Math.round(sec/60) + '분', en: Math.round(sec/60) + 'min', ja: Math.round(sec/60) + '分' });
  return { gain, feeder, timeStr, mins: sec / 60, story: closedStory(gain, rates, total, feeder) };
}

/* ---------- 포맷 ---------- */
function fmt(n){
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const u = ['K','M','B','T','Qa','Qi'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1){ n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i];
}
const fmt1 = n => n < 10 ? n.toFixed(2) : n < 1000 ? n.toFixed(1) : fmt(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
