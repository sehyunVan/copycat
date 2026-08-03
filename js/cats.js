/* ============================================================
   cats.js — 고양이 = 자율 에이전트
   OpenMMO의 "agent-human parity"를 빌려왔다.
   고양이는 특권 API를 쓰지 않는다. 플레이어의 결재도, 고양이의 행동도
   전부 같은 월드 이벤트로 처리된다(bus.emit). 고양이는 그저
   "욕구 → 시설 탐색 → 길찾기 → 행동" 루프를 자기 힘으로 돈다.
   ============================================================ */

const NAMES = L({
  ko: ['치즈','나비','까망','두부','모카','호두','참치','간장','미역','설탕','양말','단추','뭉치','보리',
    '감자','콩이','루비','코코','바닐라','쿠키','젤리','반달','구름','초코','밤톨','수리','포도','시루','만두','댕구',
    '유자','팥죽','호박','땅콩','마요','깨비','흑임자','라떼','참깨','도토리'],
  en: ['Cheese','Whiskers','Sooty','Tofu','Mocha','Walnut','Tuna','Soy','Kelp','Sugar','Socks','Button','Fluffy','Barley',
    'Spud','Beans','Ruby','Coco','Vanilla','Cookie','Jelly','Luna','Cloudy','Choco','Chestnut','Scout','Grape','Crumpet','Dumpling','Waffles',
    'Yuzu','Azuki','Pumpkin','Peanut','Mayo','Pixie','Oreo','Latte','Sesame','Acorn'],
  ja: ['チーズ','たま','くろ','とうふ','モカ','くるみ','まぐろ','しょうゆ','わかめ','さとう','くつした','ぼたん','もこ','むぎ',
    'いも','まめ','ルビー','ココ','バニラ','クッキー','ゼリー','みかづき','くも','チョコ','くり','すばる','ぶどう','だんご','ぎょうざ','こむぎ',
    'ゆず','あずき','かぼちゃ','ピーナッツ','マヨ','おはぎ','ごま','ラテ','きなこ','どんぐり'],
});

/* 시트 색상 4종. 검정은 화면에서 존재감이 커서 덜 나오게 가중치를 준다. */
const FURS = [
  { n: L({ ko:'검정', en:'Black',  ja:'くろ'   }) },
  { n: L({ ko:'갈색', en:'Brown',  ja:'ちゃとら' }) },
  { n: L({ ko:'치즈', en:'Orange', ja:'チーズ' }) },
  { n: L({ ko:'백묘', en:'White',  ja:'しろ'   }) },
];
const FUR_POOL = [0, 1, 1, 1, 2, 2, 2, 3, 3];
/* 4색만으로는 20마리를 구분 못 하므로 CSS 색조 회전을 곁들인다.
   크게 돌리면 초록·분홍 고양이가 나오니 고양이로 읽히는 범위만 쓴다.
   190도는 회청색(러시안블루처럼)이 된다. 검정·백묘는 채도가 낮아 거의 안 변한다. */
const HUES = [0, 0, 0, 18, -18, 30, -28, 190];
/* 채용 화면에서 고를 수 있는 색조. HUES는 무작위 생성용이라 0이 중복 가중치로
   들어 있어서, 사람이 고를 목록은 중복을 뺀 6종으로 따로 둔다. */
const HUE_CHOICES = [
  { h:0,    n: L({ ko:'기본',   en:'Original', ja:'標準'   }) },
  { h:18,   n: L({ ko:'노란끼', en:'Warm',     ja:'黄み'   }) },
  { h:-18,  n: L({ ko:'붉은끼', en:'Rosy',     ja:'赤み'   }) },
  { h:30,   n: L({ ko:'금빛',   en:'Golden',   ja:'金色'   }) },
  { h:-28,  n: L({ ko:'적갈',   en:'Rust',     ja:'赤茶'   }) },
  { h:190,  n: L({ ko:'회청',   en:'Blue-grey',ja:'青灰'   }) },
];

/* D&D식 6능력치. 이름만 사무직으로 갈아끼웠다. */
const STAT_KEYS = ['str','dex','con','int','wis','cha'];
const STAT_NAME = {
  str: L({ ko:'근성', en:'Grit',     ja:'根性' }),
  dex: L({ ko:'민첩', en:'Agility',  ja:'敏捷' }),
  con: L({ ko:'체력', en:'Stamina',  ja:'体力' }),
  int: L({ ko:'기획', en:'Planning', ja:'企画' }),
  wis: L({ ko:'눈치', en:'Tact',     ja:'察し' }),
  cha: L({ ko:'애교', en:'Charm',    ja:'愛嬌' }),
};
const STAT_DESC = {
  str: L({ ko:'서류를 많이 든다',   en:'Carries more documents',        ja:'書類をたくさん持てる' }),
  dex: L({ ko:'사무실을 빨리 돈다', en:'Gets around the office fast',   ja:'オフィスを速く回れる' }),
  con: L({ ko:'덜 지친다',          en:'Tires less',                    ja:'疲れにくい' }),
  int: L({ ko:'생산량의 핵심',      en:'The core of output',            ja:'生産量の要' }),
  wis: L({ ko:'욕구를 늦게 느낀다', en:'Feels needs later (patience)',  ja:'欲求を感じにくい（がまん強い）' }),
  cha: L({ ko:'동료 사기를 올린다', en:'Lifts coworker morale',         ja:'同僚の士気を上げる' }),
};

const RANKS = [
  { n: L({ ko:'인턴',   en:'Intern',       ja:'インターン' }), rate:0.30, cost:0      },
  { n: L({ ko:'사원',   en:'Staff',        ja:'社員'       }), rate:0.95, cost:90     },
  { n: L({ ko:'대리',   en:'Senior',       ja:'主任'       }), rate:3.0,  cost:290    },
  { n: L({ ko:'과장',   en:'Manager',      ja:'課長'       }), rate:9.5,  cost:950    },
  { n: L({ ko:'차장',   en:'Deputy Chief', ja:'次長'       }), rate:30,   cost:3100   },
  { n: L({ ko:'부장',   en:'Chief',        ja:'部長'       }), rate:96,   cost:10500  },
  { n: L({ ko:'이사',   en:'Executive',    ja:'取締役'     }), rate:310,  cost:36000  },
  { n: L({ ko:'대표냥', en:'CEO Cat',      ja:'代表ニャン' }), rate:1000, cost:130000 },
];

const TRAITS = [
  { id:'night',  n: L({ ko:'야근형',   en:'Night Owl',        ja:'夜勤型' }),
    d: L({ ko:'생산 +25%, 밤에도 일한다',      en:'Output +25%, works at night',            ja:'生産+25%、夜も働く' }),
    prod:1.25, decay:1.6, nocturnal:true },
  { id:'nap',    n: L({ ko:'낮잠형',   en:'Napper',           ja:'昼寝型' }),
    d: L({ ko:'생산 -12%, 욕구가 거의 안 준다', en:'Output −12%, needs barely drain',        ja:'生産−12%、欲求がほぼ減らない' }),
    prod:0.88, decay:0.40 },
  { id:'perf',   n: L({ ko:'완벽주의', en:'Perfectionist',    ja:'完璧主義' }),
    d: L({ ko:'결재 보상 +18%',                en:'Approval rewards +18%',                  ja:'決裁報酬+18%' }),
    prod:1.00, decay:1.0, bonusTodo:0.18 },
  { id:'social', n: L({ ko:'사교왕',   en:'Social Butterfly', ja:'社交家' }),
    d: L({ ko:'모든 동료 생산 +5%, 자주 논다',  en:'All coworkers +5%, plays often',         ja:'同僚全員の生産+5%、よく遊ぶ' }),
    prod:1.00, decay:1.2, teamProd:0.05, chatty:true },
  { id:'coffee', n: L({ ko:'커피중독', en:'Caffeine Fiend',   ja:'カフェイン中毒' }),
    d: L({ ko:'커피머신 있으면 생산 +40%',      en:'+40% output with a coffee machine',      ja:'コーヒーマシンがあれば生産+40%' }),
    prod:1.00, decay:1.1, needs:'coffee', ifOwned:0.40 },
  { id:'steady', n: L({ ko:'꾸준냥',   en:'Steady Paws',      ja:'コツコツ型' }),
    d: L({ ko:'생산 +8%, 욕구 감소 -20%',       en:'Output +8%, needs drain −20%',           ja:'生産+8%、欲求減少−20%' }),
    prod:1.08, decay:0.8 },
  { id:'lucky',  n: L({ ko:'행운냥',   en:'Lucky Cat',        ja:'招き猫' }),
    d: L({ ko:'가끔 어디선가 멸치를 주워온다',   en:'Sometimes finds anchovies somewhere',    ja:'たまにどこかで煮干しを拾ってくる' }),
    prod:1.00, decay:1.0, luck:true },
  { id:'boss',   n: L({ ko:'관리자냥', en:'Born Manager',     ja:'管理職ニャン' }),
    d: L({ ko:'전 직원 생산 +8%',               en:'All staff output +8%',                   ja:'全社員の生産+8%' }),
    prod:1.00, decay:1.0, teamProd:0.08 },
  { id:'sprint', n: L({ ko:'단거리형', en:'Sprinter',         ja:'短距離型' }),
    d: L({ ko:'이동 속도 +60%, 금방 지친다',     en:'Move speed +60%, tires fast',            ja:'移動速度+60%、すぐ疲れる' }),
    prod:1.00, decay:1.4, speed:1.6 },
];

const ACCS = ['tie','tie','glasses','headset','bow','none'];

/* 장비: 분기 이벤트로 얻는다. 3슬롯. */
const EQUIP = [
  { id:'glasses',  em:'👓', n: L({ ko:'뿔테 안경',    en:'Horn-rim Glasses',  ja:'黒縁メガネ' }),        slot:'head', s:{int:2} },
  { id:'cap',      em:'🧢', n: L({ ko:'사원 모자',    en:'Company Cap',       ja:'社員帽' }),            slot:'head', s:{wis:2} },
  { id:'crown',    em:'👑', n: L({ ko:'대표 왕관',    en:'CEO Crown',         ja:'代表の王冠' }),        slot:'head', s:{cha:3, int:1} },
  { id:'tie',      em:'👔', n: L({ ko:'실크 넥타이',  en:'Silk Tie',          ja:'シルクのネクタイ' }),  slot:'neck', s:{cha:2} },
  { id:'bell',     em:'🔔', n: L({ ko:'황금 방울',    en:'Golden Bell',       ja:'金の鈴' }),            slot:'neck', s:{cha:2, dex:1} },
  { id:'scarf',    em:'🧣', n: L({ ko:'목도리',       en:'Muffler',           ja:'マフラー' }),          slot:'neck', s:{con:2} },
  { id:'shoes',    em:'👟', n: L({ ko:'러닝화',       en:'Running Shoes',     ja:'ランニングシューズ' }),slot:'paw',  s:{dex:3} },
  { id:'gloves',   em:'🧤', n: L({ ko:'손목 보호대',  en:'Wrist Guards',      ja:'リストガード' }),      slot:'paw',  s:{str:2, con:1} },
  { id:'cushion',  em:'🪑', n: L({ ko:'인체공학 방석',en:'Ergonomic Cushion', ja:'人間工学クッション' }),slot:'paw',  s:{con:3} },
];
const SLOTS = [
  ['head', L({ ko:'머리', en:'Head', ja:'あたま' })],
  ['neck', L({ ko:'목',   en:'Neck', ja:'くび'   })],
  ['paw',  L({ ko:'발',   en:'Paw',  ja:'あし'   })],
];

const CHAT = L({
  ko: {
    coffee:  ['커피 한 잔 하고 오겠다냥','카페인 없이는 못 산다','아메리카노 세 잔째'],
    sleep:   ['5분만 잔다냥','상자가 부른다','충전 중…zzz'],
    litter:  ['잠깐 다녀오겠다','실례 좀'],
    social:  ['어제 그 참치캔 봤어?','옆 팀 소문 들었냥?','정수기 앞에서 잠깐만','골골골'],
    lunch:   ['밥 먹으러 가자냥','오늘 급식은 참치라던데','12시는 못 참는다','점심 같이 갈 사람!','후식은 츄르다냥'],
    work:    ['일한다냥','키보드 따뜻해','이번 건은 내가 맡지'],
    stamp:   ['결재 완료!','도장 쾅','처리했다냥','한 건 끝'],
    idle:    ['냐앙…','창밖에 새가 있다','월급날 언제냥'],
    night:   ['야근이다…','다들 갔네','밤이 조용해서 좋다'],
    care:    ['쉬엄쉬엄 하자냥','기지개 쭉—','물 마시러 gogo','오늘도 잘하고 있다냥'],
    legal:   ['미처리 건 확인차 나왔습니다','소명 자료를 요청드립니다','이 건은 반려 처리하겠습니다','기한이 지났습니다'],
    police:  ['냥찰청 특별사법경찰입니다','협조 부탁드립니다','장부 좀 보겠습니다','발자국을 채증하겠습니다','상자 안도 확인하겠습니다'],
    scared:  ['저는 인턴인데요','아무것도 몰라요','캣닢은 제 게 아닙니다','저 그날 야근했는데요'],
  },
  en: {
    coffee:  ['Coffee run, be right back','Can’t live without caffeine','Third americano today'],
    sleep:   ['Just five minutes, nya','The box is calling','Recharging…zzz'],
    litter:  ['Be right back','Excuse me a sec'],
    social:  ['Did you see that tuna can?','Heard the rumor next team?','Quick chat by the cooler','Purrrr'],
    lunch:   ['Lunch time, let’s go','Heard it’s tuna today','No cat resists noon','Who’s in for lunch!','Churu for dessert, nya'],
    work:    ['Working, nya','Keyboard’s warm','I’ll take this one'],
    stamp:   ['Approved!','Stamp goes bam','Handled it','One down'],
    idle:    ['Nyaa…','There’s a bird outside','When’s payday, nya'],
    night:   ['Overtime again…','Everyone’s gone','The night is nice and quiet'],
    care:    ['Take it easy, nya','Biiig stretch—','Water break, go go','You’re doing fine today'],
    legal:   ['Here about the unresolved items','We request your written explanation','This one is being returned','The deadline has passed'],
    police:  ['Pawlice, Special Investigation Unit','Your cooperation, please','We’ll see the books now','Collecting pawprint evidence','We’ll check inside the boxes too'],
    scared:  ['I’m just an intern','I know nothing','The catnip isn’t mine','I was on overtime that day'],
  },
  ja: {
    coffee:  ['コーヒー飲んでくるにゃ','カフェインなしでは無理','アメリカーノ3杯目'],
    sleep:   ['5分だけ寝るにゃ','箱が呼んでいる','充電中…zzz'],
    litter:  ['ちょっと失礼','すぐ戻るにゃ'],
    social:  ['昨日のツナ缶見た？','隣のチームの噂、聞いた？','ウォーターサーバー前でちょっとだけ','ゴロゴロゴロ'],
    lunch:   ['ごはん行こうにゃ','今日はまぐろらしい','12時は我慢できない','ランチ行く人ー！','デザートはちゅーるにゃ'],
    work:    ['仕事するにゃ','キーボードがあったかい','この案件はもらった'],
    stamp:   ['決裁完了！','ハンコ、ドン','処理したにゃ','一件落着'],
    idle:    ['にゃーん…','窓の外に鳥がいる','給料日はまだかにゃ'],
    night:   ['残業だ…','みんな帰ったな','夜は静かでいい'],
    care:    ['ぼちぼちいこうにゃ','のび〜っ','お水タイム','今日もえらいにゃ'],
    legal:   ['未処理案件の確認に参りました','釈明資料をお願いします','この件は差し戻します','期限が過ぎています'],
    police:  ['ニャン察庁特別司法警察です','ご協力お願いします','帳簿を拝見します','足跡を採取します','箱の中も確認します'],
    scared:  ['ただのインターンです','何も知りません','マタタビは私のじゃない','あの日は残業でした'],
  },
});

function d6(){ return 1 + Math.floor(Math.random()*6); }
/* 4d6 중 최저 1개 버리기 — OpenMMO(그리고 D&D)의 캐릭터 생성 규칙 */
function roll4d6(){
  const r = [d6(), d6(), d6(), d6()].sort((a,b)=>a-b);
  return r[1] + r[2] + r[3];
}
function rollStats(){
  const s = {};
  STAT_KEYS.forEach(k => s[k] = roll4d6());
  return s;
}

/* ---------- 개인 기록부 ----------
   고양이가 능력치 뭉치로만 남으면 정이 안 붙는다. 정이 붙는 건 이력이 있는 개체다.
   그래서 한 마리마다 이력을 쌓아 둔다. 다만 이건 저장에 매번 실리는 데이터라
   칸을 최소로 잡았다 — 숫자 몇 개와 짧은 문자열 하나가 전부다.
     q     입사 분기 (0 = 기록부가 생기기 전에 입사)
     docs  처리한 서류 수, 크기별
     det   구금 횟수 · detQ 마지막 구금 분기
     fac   시설 이용 횟수, 타일 번호를 키로 (이름은 TILE_INFO가 이미 3개 국어로 갖고 있다)
     first 첫 결재 { q, t } */
function normRecord(r){
  const d = (r && r.docs) || {};
  return {
    q:     (r && r.q)     || 0,
    docs:  { s: d.s || 0, m: d.m || 0, l: d.l || 0 },
    det:   (r && r.det)   || 0,
    detQ:  (r && r.detQ)  || 0,
    fac:   (r && r.fac)   || {},
    first: (r && r.first) || null,
  };
}
const newRecord = q => { const r = normRecord(null); r.q = q; return r; };
/* 기록부를 꺼낸다. 없으면 그 자리에서 만든다 — 옛 저장을 절대 터뜨리지 않는다.
   입사 분기는 모르는 채로 두는 게 맞다. 없던 이력을 지어내지 않는다. */
const recOf = c => c.rec || (c.rec = newRecord(0));
/* 가장 자주 간 시설. 한 번도 안 갔으면 null */
function recTopFac(c){
  const f = recOf(c).fac;
  let tile = null, n = 0;
  for (const k in f) if (f[k] > n){ n = f[k]; tile = +k; }
  return tile == null ? null : { tile, n };
}

/* 사내에 같은 이름이 둘 있으면 헷갈리므로 안 쓰는 이름을 고른다 */
function uniqueName(){
  const roster = (typeof S !== 'undefined' && S)
    ? (S.cats || []).concat((S.jail || []).map(j => j.cat)) : [];
  const used = new Set(roster.map(c => c.name));
  const pool = NAMES.filter(n => !used.has(n));
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + (used.size + 1);
}

function newCat(seedName){
  const t = TRAITS[Math.floor(Math.random()*TRAITS.length)];
  return {
    id: 'c' + Math.random().toString(36).slice(2, 9),
    name: seedName || uniqueName(),
    fur: FUR_POOL[Math.floor(Math.random()*FUR_POOL.length)],
    hue: HUES[Math.floor(Math.random()*HUES.length)],
    acc: ACCS[Math.floor(Math.random()*ACCS.length)],
    trait: t.id,
    rank: 0,
    stats: rollStats(),
    equip: { head:null, neck:null, paw:null },
    needs: { energy:100, fun:100, caffeine:100, bladder:100 },
    // 입사 분기는 여기서 임시로 찍고, 실제 채용 시점에 hire()가 다시 찍는다
    // (지원자는 채용될 때까지 문 앞에서 몇 분기고 기다릴 수 있다)
    rec: newRecord(typeof S !== 'undefined' && S ? S.quarter : 1),
    // 시뮬 상태
    x: 1, y: 1, deskIdx: -1,
    act: { s:'idle', t:0, path:null, pi:0, target:null, use:null },
    doc: null,
    _bubble: 0,
  };
}

function traitOf(c){ return TRAITS.find(t => t.id === c.trait) || TRAITS[0]; }

function statOf(c, k){
  let v = c.stats[k] || 10;
  SLOTS.forEach(([sl]) => {
    const e = c.equip && c.equip[sl];
    if (!e) return;
    const it = EQUIP.find(x => x.id === e);
    if (it && it.s[k]) v += it.s[k];
  });
  return v;
}
const mod = v => (v - 10) / 2;   // D&D 능력 보정치

function moodOf(c, hasCoffee){
  const n = c.needs;
  return hasCoffee
    ? n.energy*0.34 + n.fun*0.27 + n.bladder*0.19 + n.caffeine*0.20
    : (n.energy*0.42 + n.fun*0.34 + n.bladder*0.24);
}

/* 렌더링은 sprite.js가 담당한다 (도트 스프라이트) */
