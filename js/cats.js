/* ============================================================
   cats.js — 고양이 = 자율 에이전트
   OpenMMO의 "agent-human parity"를 빌려왔다.
   고양이는 특권 API를 쓰지 않는다. 플레이어의 결재도, 고양이의 행동도
   전부 같은 월드 이벤트로 처리된다(bus.emit). 고양이는 그저
   "욕구 → 시설 탐색 → 길찾기 → 행동" 루프를 자기 힘으로 돈다.
   ============================================================ */

const NAMES = ['치즈','나비','까망','두부','모카','호두','참치','간장','미역','설탕','양말','단추','뭉치','보리',
  '감자','콩이','루비','코코','바닐라','쿠키','젤리','반달','구름','초코','밤톨','수리','포도','시루','만두','댕구',
  '유자','팥죽','호박','땅콩','마요','깨비','흑임자','라떼','참깨','도토리'];

const FURS = [
  { b:'#F5CE95', d:'#E0AE6C', e:'#FFC4C9' },
  { b:'#FFFDF6', d:'#EFE3D0', e:'#FFC4C9' },
  { b:'#5F5A57', d:'#494441', e:'#D89AA0' },
  { b:'#C9C3BB', d:'#ABA49B', e:'#FFC4C9' },
  { b:'#E3A96B', d:'#C98A4B', e:'#FFC4C9' },
  { b:'#8D6E5A', d:'#715746', e:'#E7A9AE' },
  { b:'#FFE3B0', d:'#F0C98A', e:'#FFC4C9' },
];

/* D&D식 6능력치. 이름만 사무직으로 갈아끼웠다. */
const STAT_KEYS = ['str','dex','con','int','wis','cha'];
const STAT_NAME = { str:'근성', dex:'민첩', con:'체력', int:'기획', wis:'눈치', cha:'애교' };
const STAT_DESC = {
  str:'서류를 많이 든다',   dex:'사무실을 빨리 돈다', con:'덜 지친다',
  int:'생산량의 핵심',      wis:'욕구를 늦게 느낀다', cha:'동료 사기를 올린다',
};

const RANKS = [
  { n:'인턴',   rate:0.30, cost:0      },
  { n:'사원',   rate:0.95, cost:90     },
  { n:'대리',   rate:3.0,  cost:290    },
  { n:'과장',   rate:9.5,  cost:950    },
  { n:'차장',   rate:30,   cost:3100   },
  { n:'부장',   rate:96,   cost:10500  },
  { n:'이사',   rate:310,  cost:36000  },
  { n:'대표냥', rate:1000, cost:130000 },
];

const TRAITS = [
  { id:'night',  n:'야근형',   d:'생산 +25%, 밤에도 일한다',        prod:1.25, decay:1.6, nocturnal:true },
  { id:'nap',    n:'낮잠형',   d:'생산 -12%, 욕구가 거의 안 준다',   prod:0.88, decay:0.40 },
  { id:'perf',   n:'완벽주의', d:'결재 보상 +18%',                  prod:1.00, decay:1.0, bonusTodo:0.18 },
  { id:'social', n:'사교왕',   d:'모든 동료 생산 +5%, 자주 논다',    prod:1.00, decay:1.2, teamProd:0.05, chatty:true },
  { id:'coffee', n:'커피중독', d:'커피머신 있으면 생산 +40%',        prod:1.00, decay:1.1, needs:'coffee', ifOwned:0.40 },
  { id:'steady', n:'꾸준냥',   d:'생산 +8%, 욕구 감소 -20%',         prod:1.08, decay:0.8 },
  { id:'lucky',  n:'행운냥',   d:'가끔 어디선가 멸치를 주워온다',     prod:1.00, decay:1.0, luck:true },
  { id:'boss',   n:'관리자냥', d:'전 직원 생산 +8%',                 prod:1.00, decay:1.0, teamProd:0.08 },
  { id:'sprint', n:'단거리형', d:'이동 속도 +60%, 금방 지친다',      prod:1.00, decay:1.4, speed:1.6 },
];

const ACCS = ['tie','tie','glasses','headset','bow','none'];

/* 장비: 분기 이벤트로 얻는다. 3슬롯. */
const EQUIP = [
  { id:'glasses',  em:'👓', n:'뿔테 안경',   slot:'head', s:{int:2} },
  { id:'cap',      em:'🧢', n:'사원 모자',   slot:'head', s:{wis:2} },
  { id:'crown',    em:'👑', n:'대표 왕관',   slot:'head', s:{cha:3, int:1} },
  { id:'tie',      em:'👔', n:'실크 넥타이', slot:'neck', s:{cha:2} },
  { id:'bell',     em:'🔔', n:'황금 방울',   slot:'neck', s:{cha:2, dex:1} },
  { id:'scarf',    em:'🧣', n:'목도리',      slot:'neck', s:{con:2} },
  { id:'shoes',    em:'👟', n:'러닝화',      slot:'paw',  s:{dex:3} },
  { id:'gloves',   em:'🧤', n:'손목 보호대', slot:'paw',  s:{str:2, con:1} },
  { id:'cushion',  em:'🪑', n:'인체공학 방석',slot:'paw', s:{con:3} },
];
const SLOTS = [['head','머리'], ['neck','목'], ['paw','발']];

const CHAT = {
  coffee:  ['커피 한 잔 하고 오겠다냥','카페인 없이는 못 산다','아메리카노 세 잔째'],
  sleep:   ['5분만 잔다냥','상자가 부른다','충전 중…zzz'],
  litter:  ['잠깐 다녀오겠다','실례 좀'],
  social:  ['어제 그 참치캔 봤어?','옆 팀 소문 들었냥?','정수기 앞에서 잠깐만','골골골'],
  work:    ['일한다냥','키보드 따뜻해','이번 건은 내가 맡지'],
  stamp:   ['결재 완료!','도장 쾅','처리했다냥','한 건 끝'],
  idle:    ['냐앙…','창밖에 새가 있다','월급날 언제냥'],
  night:   ['야근이다…','다들 갔네','밤이 조용해서 좋다'],
  legal:   ['미처리 건 확인차 나왔습니다','소명 자료를 요청드립니다','이 건은 반려 처리하겠습니다','기한이 지났습니다'],
  police:  ['냥찰청 특별사법경찰입니다','협조 부탁드립니다','장부 좀 보겠습니다','발자국을 채증하겠습니다','상자 안도 확인하겠습니다'],
  scared:  ['저는 인턴인데요','아무것도 몰라요','캣닢은 제 게 아닙니다','저 그날 야근했는데요'],
};

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
    fur: Math.floor(Math.random()*FURS.length),
    acc: ACCS[Math.floor(Math.random()*ACCS.length)],
    trait: t.id,
    rank: 0,
    stats: rollStats(),
    equip: { head:null, neck:null, paw:null },
    needs: { energy:100, fun:100, caffeine:100, bladder:100 },
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
