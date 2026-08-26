/* ============================================================
   sim.js — 월드 시뮬레이션
   고정 10Hz 틱. 플레이어의 결재도, 고양이의 행동도 전부 같은
   이벤트 버스(bus)를 지난다. 특권 API 없음.
   ============================================================ */

const bus = {
  h: {},
  on(t, f){ (this.h[t] = this.h[t] || []).push(f); return this; },
  emit(t, d){ (this.h[t] || []).forEach(f => { try { f(d); } catch(e){ console.error(e); } }); },
};

let W = null;              // 현재 사무실
let DOCS = [];             // 결재 문서들
let NPCS = [];             // 외부인(법무팀·냥찰) — 직원이 아니라 급여도 생산도 없다
let RAID = null;           // 압수수색 진행 상태
const clampv = (v,a,b) => Math.max(a, Math.min(b, v));

/* ---------- 시계 ----------
   게임 시계는 데스크탑 시계 그 자체다. 예전에는 1초 = 0.75분(하루 32분)으로
   돌렸지만, 이 게임은 진짜 근무 시간을 같이 견뎌주는 동행이라 시간을 감지 않는다.
   당신의 12시에 고양이들도 밥을 먹으러 가고, 당신의 18시에 고양이들도 퇴근한다.
   분기 진행은 시간이 아니라 성과(KPI)로 굴러가므로 경제는 그대로다. */
function nowMin(){
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}
/* 날짜 키는 **자리를 채운다**(2026-08-07). 캘린더가 생기면서 이 문자열은 비교·정렬·
   저장 키가 전부 되었고, 2026-8-7 은 문자열로 정렬하면 2026-12-1 보다 뒤로 간다.
   옛 저장의 안 채운 키는 loadSave 가 normDay 로 고쳐 넣는다. */
const pad2 = n => (n < 10 ? '0' : '') + n;
function dayKey(d){
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
/* 안 채운 옛 키를 채운 키로. 없으면 그대로 없음. */
function normDay(k){
  if (!k) return k;
  const m = String(k).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) : k;
}
const keyToDate = k => { const [y, m, d] = String(k).split('-').map(Number);
                         return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
/* 요일 (0=일). 캘린더 격자와 「평일만」 판단이 이걸 쓴다. */
const dowOf = k => keyToDate(k).getDay();

/* ---------- 업무일 ----------
   달력 날짜는 자정에 바뀌지만 **사람의 하루는 자정에 안 바뀐다.** 9–18 근무자가
   01시에 적는 할 일은 그 사람에게 「오늘」이고, 22–06 근무자의 하루는 자정에 반으로
   잘리면 아예 못 쓴다. 그래서 업무일은 **근무의 반대편**, 즉 자고 있을 시각에 바뀐다:
   근무 가운데 시각 + 12시간. 9–18 이면 01:30, 22–06 이면 14:00 이다.
   근무 시간 하나에서 유도되므로 새 설정이 늘지 않는다 (위 shiftOf 머리말과 같은 규칙). */
function rollMin(){
  const s = shiftOf();
  return Math.round((s.start + s.len / 2 + 720) % 1440);
}
/* 지금이 속한 업무일. 캘린더·기한·결재함이 말하는 「오늘」이 전부 이것이다. */
function bizKey(ts){
  const d = ts == null ? new Date() : new Date(ts);
  if (d.getHours() * 60 + d.getMinutes() < rollMin()) d.setDate(d.getDate() - 1);
  return dayKey(d);
}
/* ---------- 근무 시간 ----------
   09–18 을 코드에 박아 두고 있었다. 이 게임의 전제가 "당신의 시계로 돈다"인데,
   **모두가 아홉 시에 출근하지는 않는다.** 밤에 할 일을 적는 사람에게 09–18 고정은
   "당신의 시계"가 아니라 남의 시계고, 그 사람의 사무실은 하루 내내 밤이다.

   그래서 설정값이 된다(S.shift). 그리고 **자정을 넘어도 된다** — 22–06 이면
   그 사람의 근무는 밤이고, 밤이 곧 낮이다. 그 아래 모든 판단(단계·수당·케어 방송·
   스트레칭 타이머·닫혀 있던 시간 환산)이 이 하나에서 유도된다.

   창밖 어둠과 음악 볼륨은 여기 안 딸려온다 — 그건 **세상**이 밤인 것이고,
   야근하는 사람의 창밖도 어두운 게 맞다. */
const SHIFT_DEF = { start: 9, end: 18 };
const shiftHour = h => ((Math.round(Number(h)) % 24) + 24) % 24;
/* 분 단위로 펼친 근무표. 길이는 자정을 넘어도 양수다. */
function shiftOf(){
  const s = (typeof S !== 'undefined' && S && S.shift) || SHIFT_DEF;
  const start = shiftHour(s.start), end = shiftHour(s.end);
  const hours = ((end - start + 24) % 24) || 24;       // 같은 시각이면 24시간 근무로 읽는다
  const startM = start * 60, len = hours * 60;
  /* 점심은 근무의 가운데쯤 한 시간. 9–18 이면 12시가 나온다(전에 박아 뒀던 값과 같다).
     네 시간이 안 되는 근무에는 점심이 없다 — 두 시간 일하고 밥 먹으러 가진 않는다. */
  const lunch = hours >= 4 ? (startM + (Math.floor(hours / 2) - 1) * 60) % 1440 : null;
  return { start: startM, end: (startM + len) % 1440, len, hours,
           lunch, lunchEnd: lunch == null ? null : (lunch + 60) % 1440 };
}
/* 자정을 넘는 구간을 다루려면 모듈러로 봐야 한다. [a, b) 반열림. */
const inWin = (m, a, b) => {
  const n = x => ((x % 1440) + 1440) % 1440;
  m = n(m); a = n(a); b = n(b);
  return a <= b ? (m >= a && m < b) : (m >= a || m < b);
};
/* 남은 시간(분). 자정을 넘어도 음수가 안 나온다 — "퇴근까지 -3:00" 을 막는 값이다. */
const untilMin = (from, to) => (((to - from) % 1440) + 1440) % 1440;

/* 근무표에서 유도되는 창들. WORK 는 옛 이름을 그대로 쓰는 얼굴이다(care.js·ui.js). */
const WORK = {
  get start(){ return shiftOf().start; },
  get end(){ return shiftOf().end; },
  get lunch(){ const s = shiftOf(); return s.lunch == null ? s.start : s.lunch; },
  get lunchEnd(){ const s = shiftOf(); return s.lunchEnd == null ? s.start : s.lunchEnd; },
  get hours(){ return shiftOf().hours; },
};
function phaseOf(min){
  const s = shiftOf();
  if (s.lunch != null && inWin(min, s.lunch, s.lunchEnd)) return 'lunch';
  /* 출근 한 시간 전부터 사무실이 깬다 — 원래도 9시 근무에 8시부터 'day' 였다 */
  if (inWin(min, s.start - 60, s.end)) return 'day';
  if (inWin(min, s.end, s.end + 4 * 60)) return 'evening';      // 야근 창
  return 'night';                                                // 근무 밖
}
const PHASE_MUL = { day:1, lunch:0.60, evening:0.80, night:0.35 };

/* ============================================================
   세상의 시각 — skyOf / skyMix

   **근무표와 무관하다.** 근무를 22–06 으로 바꿨다고 창밖이 낮이 되지는 않는다 —
   내 출근 시간이 바뀌어도 해가 뜨는 시각은 그대로다. 그래서 이 게임에는 시각이 둘이다:

     · phaseOf(min) — **당신의 근무 단계**(day/lunch/evening/night). 근무표에서 나온다.
                      수당 배수 · 케어 방송 · 「퇴근까지」 · 고양이의 느슨함이 여기서 나온다
     · skyOf(min)   — **세상의 시각**(morning/day/evening/night). 시계에 고정이다.
                      창밖 색 · 햇빛 · 실내 밝기 · 밤 볼륨 · 시간대 자동 재생이 여기서 나온다

   둘을 섞어 두면 22–06 으로 일하는 사람의 사무실이 새벽 3시에 대낮이 된다.
   (예전에는 renderNight 이 phaseOf 를 봤고, 실제로 그렇게 됐다)
   ============================================================ */
/* **다섯 단계다**(넷이었다). 하루가 「아침·낮·저녁·밤」이면 근무시간 아홉 시간이
   통째로 한 칸('day')이라, 켜 두고 곁눈질하는 화면에서 오전과 오후가 같은 색이었다.
   이 게임은 사람이 일하는 동안 옆에 켜 두는 방 하나가 전부이므로, 색이 바뀌는 일이
   **근무시간 안에서** 일어나야 한다. 그래서 낮을 오전·오후로 갈랐다.

     morning    아침 — 안개 낀 새벽. 색이 빠지고 흐릿하다
     day        오전 — 낡은 필름. 대비 낮고 그레인이 섞인다
     afternoon  오후 — 웜 라이트. 전구색으로 데워진다
     evening    더 오후 — 선셋 데스크. 노을이 창으로 들어온다
     night      밤 — 딥 블루. 모니터와 책상등만 남는다

   **같은 이름이 두 번 나오는 줄이 곧 「그 단계 그대로 있는 구간」이다.**
   한 번씩만 적으면 각 룩은 정확히 그 시각 한 순간에만 제 모습이고 나머지는 전부
   섞인 상태가 된다 — 그러면 아홉 장을 만들어 놓고 아무것도 안 보이는 셈이다.
   지금은 단계마다 1.5~2시간쯤 제 모습으로 머물고, 그 사이를 2시간쯤 걸쳐 건너간다. */
const SKY_AT = [
  [0,    'night'    ],
  [4.4,  'night'    ],   // 밤 그대로
  [7.4,  'morning'  ],   // 아침 도착 — 안개        (3.0h · 아래 참고)
  [8.8,  'morning'  ],   // 아침 그대로
  [10.6, 'day'      ],   // 오전 도착 — 필름        (1.8h)
  [12.4, 'day'      ],   // 오전 그대로
  [14.4, 'afternoon'],   // 오후 도착 — 전구색      (2.0h)
  [16.6, 'afternoon'],   // 오후 그대로
  [18.4, 'evening'  ],   // 노을 도착               (1.8h)
  [19.4, 'evening'  ],   // 노을 그대로
  [22.0, 'night'    ],   // 밤 도착                 (2.6h · 아래 참고)
  [24,   'night'    ],
];
/* **건너가는 시간이 다 다른 이유.** 처음엔 전부 1.8시간쯤으로 고르게 뒀는데, 30분
   간격으로 훑어 보니(spike/shot-day.js sweep) 두 군데서만 화면이 툭 튀었다 —
   밤→아침과 저녁→밤. 프레임 간 색 변화량이 나머지의 네 배였다.

   시간이 같은데 튀는 이유는 **색 거리가 다르기** 때문이다. 오전→오후는 바랜 베이지에서
   전구색으로 가는 짧은 길이지만, 저녁→밤은 타는 주황에서 남색까지 색상환을 반 바퀴
   돈다. 같은 시간에 더 먼 길을 가면 당연히 빠르다.

   그래서 **먼 구간에 시간을 더 준다** — 밤→아침 3.0h, 저녁→밤 2.6h.
   고르게 나누는 것이 고르게 보이는 것은 아니다. */
/* 두 칸 사이의 어디쯤인지. 이름 하나만 돌려주면 저녁이 시작되는 순간 방 전체 색이
   한 프레임에 튀는데, 켜 두고 곁눈질하는 화면에서 그건 사고로 읽힌다.
   그래서 **양쪽과 섞는 비율**을 같이 준다 — 빛은 render3d 가 이걸로 보간한다. */
function skyMix(min){
  /* 디버그로 고정해 뒀으면 시계를 안 본다. 섞을 상대가 자기 자신이라 t 는 뜻이 없다. */
  if (skyForce) return { a:skyForce, b:skyForce, t:0, h:-1 };
  /* 시각만 갈아 끼운 상태면 그 시각으로 본다 — **섞임은 그대로 돈다**(setSkyAt).
     단계 고정(skyForce)과 다른 물건이다: 고정은 t=0 이라 사이를 못 보고,
     시간대가 점진적으로 건너가는지는 정확히 그 사이에서만 드러난다. */
  const h = (skyHour != null) ? skyHour : ((((min / 60) % 24) + 24) % 24);
  for (let i = 1; i < SKY_AT.length; i++){
    if (h <= SKY_AT[i][0]){
      const [h0, a] = SKY_AT[i - 1], [h1, b] = SKY_AT[i];
      return { a, b, t: h1 === h0 ? 0 : (h - h0) / (h1 - h0), h };
    }
  }
  return { a:'night', b:'night', t:0, h };
}
/* 이름 하나로 답해야 하는 곳(음악·2D 폴백)을 위한 얼굴. 가까운 쪽을 고른다. */
function skyOf(min){ const m = skyMix(min); return m.t < 0.5 ? m.a : m.b; }

/* ---------- 디버그: 풍경을 시각에서 떼어 고정한다 ----------
   **설정이 아니다.** 이 게임의 전제가 "당신의 시계로 돈다" 이고 시간대를 고를 수 있게
   만들면 그 전제가 무너진다. 그래서 ?debug=1 로만 열리고 **저장하지 않는다** —
   ?3d=0 · ?style=pastel 과 같은 규칙이다(저장하면 그건 디버그가 아니라 설정이다).

   고정하는 자리를 skyMix 한 곳으로 잡은 이유: 창밖·햇빛·빛 자락·밤 볼륨·시간대 자동
   재생이 전부 여기서 갈라져 나간다. 여기 하나를 돌리면 **그 시간대의 전부**가 온다 —
   빛만 바꿔 보고 "밤인데 왜 음악이 낮이지" 를 따로 확인하는 일이 없다. */
const DEBUG = /[?&](debug|dev)=1/.test(location.search);
let skyForce = null;
function setSkyForce(id){
  skyForce = (id && SKY_AT.some(e => e[1] === id)) ? id : null;
  if (typeof renderNight === 'function') renderNight();
  return skyForce;
}
const skyForced = () => skyForce;

/* ---------- 디버그: 시계를 손으로 돌린다 ----------
   skyForce 가 「단계를 고정」이라면 이쪽은 「시각을 고정」이다. 하루가 다섯 단계로
   늘어나면서(SKY_AT) 정작 봐야 할 것이 단계가 아니라 **단계 사이**가 되었는데,
   고정은 t=0 이라 그 구간을 통과하지 않는다. 시각을 넣으면 표의 보간이 실제로 돈다.

   skyForce 와 같은 규칙: ?debug=1 전용, **저장하지 않는다.** 이 게임의 전제가
   「당신의 시계로 돈다」이므로 시각을 고를 수 있게 만들면 그 전제가 무너진다.
     setSkyAt(7.5)   07:30 으로 본다 · setSkyAt(null) 실제 시계로 돌아간다 */
let skyHour = null;
function setSkyAt(h){
  skyHour = (h == null || h === '') ? null : (((+h % 24) + 24) % 24);
  if (typeof renderNight === 'function') renderNight();
  return skyHour;
}
const skyAt = () => skyHour;
function clockStr(){
  const h = Math.floor(S.clock/60) % 24, m = Math.floor(S.clock % 60);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

/* ---------- 월드 구축 ----------
   배치는 한 번 정해지면 안 바뀌어야 한다. 비품 하나 샀다고, 혹은 게임을 다시 켰다고
   가구가 전부 이사하면 내 사무실이라는 느낌이 사라진다. 그래서 격자를 저장해두고
   그대로 되살린다. 새로 생성하는 건 창업할 때와 사무실을 옮길 때뿐이다. */
function snapshotWorld(){
  S.layout = {
    tier: S.tier, seed: S.seed, w: W.W, h: W.H,
    grid: Array.from(W.grid), zone: Array.from(W.zone || []),
    wallDecor: W.wallDecor, clutter: W.clutter, rot: W.rot || {}, machineSide: W.machineSide,
  };
}
/* 가구 한 개를 지금 사무실에 끼워 넣는다. 기존 배치는 그대로 둔다. */
function addFurniture(tile){
  const spot = placeFurniture(W, tile, Math.random, W.machineSide);
  if (spot) snapshotWorld();
  bus.emit('world:rebuilt', W);
  return spot;
}
/* 이번 부팅에서 CD 플레이어를 새로 끼워 넣었나 — main.js 가 사보에 한 줄 남긴다.
   말없이 가구가 하나 늘어나면 그건 선물이 아니라 못 보고 지나가는 것이다. */
let newJuke = false, newCal = false, newBoard = false;
function buildWorld(regenerate){
  if (regenerate) S.layout = null;
  const L = S.layout, T = TIERS[S.tier];
  if (L && L.tier === S.tier && L.w === T.w && L.h === T.h){
    W = worldFromGrid(L);
    /* 새 가구가 생겼는데 저장된 배치에는 없다. 되살리는 쪽은 격자를 그대로 믿게
       되어 있어서(그게 "내 사무실"을 지키는 성질이다) 여기서 한 번 끼워 넣어 준다. */
    if (ensureJuke(W)){
      snapshotWorld();
      newJuke = true;
    }
    /* 벽걸이 달력도 같이 챙긴다. 이쪽은 벽 장식이라 길찾기와 무관하고, 걸려 있던
       달력 그림을 승격시키는 것뿐이라 조용하다 (world.js ensureCal). */
    if (ensureCal(W)){
      snapshotWorld();
      newCal = true;
    }
    if (ensureBoard(W)){
      snapshotWorld();
      newBoard = true;
    }
  } else {
    W = genOffice(S.tier, S.shop, S.seed);
    snapshotWorld();
  }
  /* 견본책은 **산 물건**이라 생성기가 안 걸어 준다. 이사한 사무실에도 따라와야
     한다 — 산 물건이 사무실을 넓혔다고 사라지면 그건 이사가 아니라 압수다. */
  if (typeof shopHas === 'function' && shopHas('binder') && ensureWallItem(W, TILE.BINDER, 7))
    snapshotWorld();
  /* 러그는 **격자가 아니라 목록**이라 저장된 배치(S.layout)에 안 들어 있다.
     그래서 사무실을 옮겨도 따라온다 — 다만 새 방이 좁으면 밖으로 삐져나가므로
     여기서 안으로 밀어 넣는다. `W.rugs` 는 저장 배열을 **그대로 가리킨다**:
     배치 모드가 옮긴 자리가 곧 저장이어야 하기 때문이다 (TODO 49). */
  if (typeof decorState === 'function'){
    const rugs = decorState().rugs;
    for (const r of rugs){
      const s = DECOR.rugSize(r);
      r.x = Math.max(1, Math.min(W.W - 1 - s.w, r.x | 0));
      r.y = Math.max(1, Math.min(W.H - 1 - s.h, r.y | 0));
    }
    W.rugs = rugs;
  }
  assignDesks();
  DOCS.forEach(d => { if (d.state === 'inbox'){ d.x = W.inbox.x; d.y = W.inbox.y; } });
  bus.emit('world:rebuilt', W);
}

function assignDesks(){
  const n = W.desks.length;
  const reach = floodFrom(W, { x:W.door.x, y:W.H - 2 });
  S.cats.forEach((c, i) => {
    c.deskIdx = i < n ? i : -1;
    // 벽 속이거나 문에서 못 닿는 칸이면 자리(없으면 문 앞)로 소환
    const rx = Math.round(c.x), ry = Math.round(c.y);
    if (!walkable(W, rx, ry) || !reach.has(ry * W.W + rx)){
      const s = c.deskIdx >= 0 ? W.desks[c.deskIdx].seat : { x: W.door.x, y: W.H-2 };
      c.x = s.x; c.y = s.y;
    }
    c.act = { s:'idle', t:0, path:null, pi:0, use:null, then:null };
    if (c.doc){ const d = DOCS.find(x => x.id === c.doc); if (d){ d.state = 'inbox'; d.by = null; } c.doc = null; }
  });
}

/* ---------- 이동 ---------- */
function speedOf(c){
  const tr = traitOf(c);
  return (2.0 + mod(statOf(c,'dex')) * 0.28) * (tr.speed || 1);
}
function goTo(c, spot, then, use){
  const from = { x: Math.round(c.x), y: Math.round(c.y) };
  if (!walkable(W, from.x, from.y)){ c.x = W.door.x; c.y = W.H - 2; return false; }
  const path = findPath(W, from, spot);
  if (!path) return false;
  c.act = { s:'walk', t:0, path, pi:0, then: then || 'idle', use: use || null };
  return true;
}
function moveAlong(c, dt){
  const a = c.act;
  if (!a.path || a.pi >= a.path.length){ arrive(c); return; }
  const n = a.path[a.pi];
  const dx = n.x - c.x, dy = n.y - c.y;
  const dist = Math.hypot(dx, dy);
  const step = speedOf(c) * dt;
  if (dist <= step){
    c.x = n.x; c.y = n.y; a.pi++;
    if (a.pi >= a.path.length) arrive(c);
  } else {
    c.x += dx / dist * step;
    c.y += dy / dist * step;
  }
}
function arrive(c){
  const then = c.act.then, use = c.act.use;
  if (then === 'work')      c.act = { s:'work',  t:0, use:null };
  else if (then === 'use')  c.act = { s:'use',   t:0, use };
  else if (then === 'pickup') pickupDoc(c);
  else if (then === 'stamp')c.act = { s:'stamp', t:0, use:null };
  else if (then === 'sleep')c.act = { s:'sleep', t:0, use };
  else                      c.act = { s:'idle',  t:0, use:null };
  // 시설은 **도착한 순간**만 이용으로 친다. 가다가 마음이 바뀐 건 이용이 아니다.
  if (use && (then === 'use' || then === 'sleep')){
    bus.emit('cat:use', { cat:c, tile: tileAt(W, use.x, use.y) });
    /* 도착했으면 무엇을 하는지 말한다. 여기는 확률을 안 건다 — 「커피 한 잔 하고
       오겠다냥」 하고 떠난 고양이가 도착해서 아무 말도 안 하면, 그 물건 앞에 앉은
       것이 화면에 안 보인다. 도착은 드문 사건이라 이걸 항상 켜도 조용하다. */
    sayDoing(c);
  }
}

/* ---------- 문서 (결재 파이프라인) ---------- */
function spawnDoc(todo){
  const d = {
    id: 'd' + Math.random().toString(36).slice(2,8),
    size: todo.size, text: todo.text,
    state: 'inbox', by: null,
    x: W.inbox.x, y: W.inbox.y,
  };
  DOCS.push(d);
  bus.emit('doc:spawn', d);
  return d;
}
function pickupDoc(c){
  const d = DOCS.find(x => x.by === c.id && x.state === 'claim');
  if (!d){ c.act = { s:'idle', t:0 }; return; }
  d.state = 'carry';
  c.doc = d.id;
  chat(c, 'stamp', 0.35);
  const seat = c.deskIdx >= 0 ? W.desks[c.deskIdx].seat : null;
  if (!seat || !goTo(c, seat, 'stamp')) c.act = { s:'stamp', t:0 };
}
function finishStamp(c){
  const d = DOCS.find(x => x.id === c.doc);
  c.doc = null;
  if (!d) { c.act = { s:'idle', t:0 }; return; }
  d.state = 'done';
  DOCS = DOCS.filter(x => x.id !== d.id);
  bus.emit('doc:stamped', { cat:c, doc:d });
  c.act = { s:'work', t:0 };
}
function canHandleDocs(c){
  /* 시각을 안 본다. **올린 서류는 언제 올려도 처리된다.**
     전에는 근무 밖이면 기력 55 를 넘겨야 서류를 받았다 — 밤에 할 일을 적는 사람에게는
     그게 "체크했는데 아무도 안 온다"였고, 이 게임에서 제일 나쁜 침묵이다.
     기력·화장실이 바닥인 고양이만 못 받는다. 그건 시각과 상관없는 사정이다. */
  return c.needs.energy > 12 && c.needs.bladder > 12;
}

/* 서류가 들어오면 가장 가까운 고양이가 곧바로 반응한다.
   안 그러면 근무 중인 고양이는 다음 재판단(4~8초)까지 서류를 못 본다. */
bus.on('doc:spawn', () => {
  const cands = S.cats.filter(c => !c.doc && canHandleDocs(c) &&
    (c.act.s === 'work' || c.act.s === 'idle'));
  if (!cands.length) return;
  const d = c => Math.abs(c.x - W.inbox.x) + Math.abs(c.y - W.inbox.y);
  cands.sort((a, b) => d(a) - d(b));
  decide(cands[0]);
});

/* ---------- 의사결정 ---------- */
/* 욕구 → 어디로 가는가. 재미는 갈 곳이 둘이다 — 놀잇감이 있으면 그쪽이 먼저고,
   없으면 정수기 앞 잡담으로 푼다. 배열로 둔 이유는 그 우선순위를 코드가 아니라
   표로 읽히게 하기 위해서다. */
const NEED_FACILITY = { energy:'sleep', bladder:'litter', caffeine:'coffee', fun:'social' };
const NEED_PLACES = { energy:['sleep'], bladder:['litter'], caffeine:['coffee'], fun:['play', 'social'] };
function decide(c){
  const tr = traitOf(c);
  const p = phaseOf(S.clock);

  // 문서가 최우선 (플레이어가 실제로 한 일)
  if (c.doc){
    const seat = c.deskIdx >= 0 ? W.desks[c.deskIdx].seat : null;
    if (seat && (Math.round(c.x) !== seat.x || Math.round(c.y) !== seat.y)){
      if (goTo(c, seat, 'stamp')) return;
    }
    c.act = { s:'stamp', t:0 };
    return;
  }
  const waiting = DOCS.find(d => d.state === 'inbox');
  if (waiting && canHandleDocs(c)){
    const spots = adjacentFree(W, W.inbox);
    if (spots.length){
      waiting.state = 'claim'; waiting.by = c.id;
      if (goTo(c, spots[0], 'pickup')) return;
      waiting.state = 'inbox'; waiting.by = null;
    }
  }

  // 점심시간: 다 같이 휴게실로 몰려간다. 밥이 먼저다.
  if (p === 'lunch' && Math.random() < 0.75){
    const f = nearestUse(W, 'social', c);
    if (f && goTo(c, f.spot, 'use', f.target)){ chat(c, 'lunch', 0.3); return; }
  }

  /* 밤이라고 전부 눕히지 않는다. 전에는 근무 밖이면 야근형을 뺀 모두가 무조건 자러 갔다 —
     그러면 밤에 사무실을 열어 둔 사람의 화면은 **잠든 고양이만 있는 방**이고,
     같이 버텨주는 물건이 혼자 자는 물건이 된다.
     이제는 시각이 아니라 **기력**이 눕힌다(바로 아래 욕구 판단이 그 일을 한다).
     피곤한 냥은 낮에도 자고, 안 피곤한 냥은 새벽에도 돌아다닌다. */

  // 욕구 확인 — 눈치(WIS)가 높으면 더 오래 참는다
  const tol = mod(statOf(c,'wis')) * 2.5;
  const checks = [
    ['bladder', 30 - tol],
    ['energy',  36 - tol],
    ['caffeine',32 - tol],
    ['fun',     34 - tol],
  ];
  checks.sort((a,b) => (c.needs[a[0]] - a[1]) - (c.needs[b[0]] - b[1]));
  for (const [need, th] of checks){
    if (c.needs[need] >= th) continue;
    /* 갈 곳이 여러 종류일 수 있다 — 재미는 놀잇감이 먼저, 없으면 정수기 앞 잡담. */
    for (const use of (NEED_PLACES[need] || [NEED_FACILITY[need]])){
      const f = pickUse(W, use, c);
      if (!f) continue;
      if (goTo(c, f.spot, use === 'sleep' ? 'sleep' : 'use', f.target)){ chat(c, use, 0.3); return; }
    }
    const use = NEED_FACILITY[need];
    if (need === 'energy'){
      c.act = { s:'sleep', t:0, use:null };   // 잘 데가 없으면 그 자리에서 존다
      return;
    } else if (need === 'caffeine' && !W.facilities.coffee){
      c.needs.caffeine = 55;                  // 커피머신이 없으면 갈망 자체가 없다
    }
    void use;
  }

  // 저녁: 야근형이 아니면 절반은 논다
  if (p === 'evening' && !tr.nocturnal && Math.random() < 0.45 && wander2(c, 'evening')) return;

  /* 자리를 오래 지켰으면 쉰다. 욕구가 바닥나야만 일어서면 고양이는 하루의 94%를
     책상에 앉아 있는다(실측). 그건 고양이가 아니라 성실한 직원이고, 이 게임이 보여주려는
     것도 아니다. 그래서 **집중 시간**을 준다 — 그만큼 앉아 있으면 이유 없이도 일어선다.
     길이는 성격과 기력이 정한다: 꾸준냥은 길고, 기운이 없으면 짧다. */
  if ((c.deskT || 0) > focusSpan(c) && wander2(c, 'break')) return;

  // 기본: 자기 자리에서 일한다
  const seat = c.deskIdx >= 0 ? W.desks[c.deskIdx].seat : null;
  if (seat){
    if (Math.round(c.x) === seat.x && Math.round(c.y) === seat.y){ c.act = { s:'work', t:0 }; return; }
    if (goTo(c, seat, 'work')) return;
  }
  wander(c);
}

function wander(c){
  for (let i = 0; i < 8; i++){
    const x = 1 + Math.floor(Math.random() * (W.W - 2));
    const y = 1 + Math.floor(Math.random() * (W.H - 2));
    if (walkable(W, x, y) && goTo(c, { x, y }, 'idle')) return;
  }
  c.act = { s:'idle', t:0 };
}

/* 얼마나 앉아 있다가 일어서는가(초). 꾸준냥은 오래 앉아 있고, 기운이 빠지면 짧아진다.
   난수를 섞는 이유는 여섯 마리가 동시에 우르르 일어서지 않게 하기 위해서다. */
function focusSpan(c){
  const tr = traitOf(c);
  const base = 44 + mod(statOf(c,'con')) * 9;         // 체력이 좋으면 오래 붙어 있는다
  const trait = 1 / (tr.decay || 1);                  // 욕구가 빨리 닳는 성격은 자주 일어선다
  const tired = 0.55 + 0.45 * (c.needs.energy / 100);
  return Math.max(12, base * trait * tired) * (0.7 + Math.random() * 0.7);
}

/* 쉬러 간다. 목적지는 놀잇감 → 잡담 자리 → 낮잠 자리 순으로 보고, 아무것도 없으면
   그냥 사무실을 한 바퀴 돈다. 돌아다니는 것 자체가 이 게임의 볼거리다.
   why:'break' 는 이유 없는 휴식, 'evening' 은 저녁의 느슨함. */
function wander2(c, why){
  c.deskT = 0;
  /* 순서를 섞는다. 고정 우선순위면 놀잇감 하나에 전부 몰려서, 사무실을 꾸며 놔도
     실제로 닳는 가구는 한두 개가 된다(실측: 놀잇감이 휴식 시간의 3/4을 먹었다). */
  const order = (why === 'evening' ? ['play', 'social'] : ['play', 'social', 'sleep', 'social'])
    .slice().sort(() => Math.random() - 0.5);
  for (const use of order){
    if (use === 'sleep' && c.needs.energy > 70) continue;   // 안 졸린데 자러 가진 않는다
    const f = pickUse(W, use, c);
    if (!f) continue;
    if (goTo(c, f.spot, use === 'sleep' ? 'sleep' : 'use', f.target)){
      /* 욕구가 다 안 찼어도 잠깐은 머문다 — 도착하자마자 자리로 돌아가면
         "가구를 쓴다" 가 화면에 안 보인다. */
      c.act.stay = 4 + Math.random() * 8;
      chat(c, use === 'play' ? 'idle' : use, 0.2);
      return true;
    }
  }
  /* 갈 데가 없으면 산책. 자리로 곧장 돌아가는 것보다 낫다. */
  const before = c.act && c.act.s;
  wander(c);
  return (c.act && c.act.s) !== before || c.act.s === 'walk';
}

/* ---------- 말풍선 ---------- */
function chat(c, kind, chance){
  if (Math.random() > (chance == null ? 1 : chance)) return;
  const pool = CHAT[kind] || CHAT.idle;
  const line = pool[Math.floor(Math.random() * pool.length)];
  bus.emit('cat:say', { cat:c, text:line });
}

/* 지금 어느 가구 앞에서 무엇을 하고 있나 — DOING 의 칸 이름을 돌려준다.
   가구를 안 쓰고 있으면 null 이다(근무·이동·대기에는 이 말이 없다 —
   스무 마리가 「이동 중…」 을 동시에 띄우면 그건 상태 표시가 아니라 자막이다).

   자는 것만 가구를 안 본다. 자는 자리가 낮잠 상자든 캣타워든 해먹이든
   하고 있는 일은 자는 것 하나다. */
function doingKind(c){
  const a = c.act;
  if (!a) return null;
  if (a.s === 'sleep') return 'sleep';
  if (a.s !== 'use' || !a.use) return null;
  const tile = tileAt(W, a.use.x, a.use.y);
  return DOING_TILE[tile] || (TILE_INFO[tile] || {}).use || 'social';
}
/* 지금 하는 일을 나타내는 한 줄. 고르기만 하고 띄우지는 않는다 —
   가구를 쓰는 동안 말풍선을 **계속** 들고 있는 건 화면 쪽이다(ui.js syncBubbles).
   거기서 말이 없는 고양이를 보면 이 함수로 한 줄을 받아 간다. */
function doingLine(c){
  const kind = doingKind(c);
  if (!kind) return null;
  const pool = DOING[kind] || DOING.social;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* 하고 있는 일을 **다른 줄로 바꿔** 말한다. chance 를 안 주면 반드시 바꾼다.

   풍선 자체는 가구를 쓰는 내내 떠 있으므로 이 함수가 하는 일은 「띄우기」가 아니라
   「말 갈아 끼우기」다 — 3분 동안 같은 줄이 떠 있으면 그건 말이 아니라 간판이다.
   너무 자주 갈면 글자가 깜빡이므로 2.8초 자물쇠는 그대로 둔다. */
function sayDoing(c, chance){
  const kind = doingKind(c);
  if (!kind) return false;
  const now = performance.now();
  if (now - (c._bubble || 0) < 2800) return false;
  if (chance != null && Math.random() > chance) return false;
  const pool = DOING[kind] || DOING.social;
  c._bubble = now;
  bus.emit('cat:say', { cat:c, text: pool[Math.floor(Math.random() * pool.length)] });
  return true;
}

/* ============================================================
   외부인: 법무팀 · 냥찰
   직원과 같은 길찾기/이동 코드를 그대로 쓴다. 특권 없음.
   ============================================================ */
/* 냥찰청은 늘 같은 두 마리가 온다. 매번 다른 이름이 나오면 조직이 아니라
   무작위 NPC로 읽힌다. 얼굴이 고정되어야 "또 왔네"가 된다. */
/* 색까지 여기서 정한다. 둘이 같은 색으로 오면 "또 왔네" 가 아니라 그냥 경찰 두 마리다.
   도 경찰은 제복 남색으로 고정(render3d 가 덮어쓴다), 김 경찰은 보통 고양이와 같은 규칙. */
const POLICE = [
  { name: L({ ko:'도 경찰', en:'Officer Doh', ja:'ドー巡査' }), fur:0, hue:0 },
  { name: L({ ko:'김 경찰', en:'Officer Kim', ja:'キム巡査' }), fur:2, hue:18 },
];
const NPC_NAMES = {
  legal: L({ ko:['법무 정','법무 윤','법무 한'], en:['Legal Jung','Legal Yoon','Legal Han'], ja:['法務ジョン','法務ユン','法務ハン'] }),
  rival: L({ ko:['멍멍파 끄나풀'], en:['Woof Gang snoop'], ja:['ワンワン組の下っ端'] }),
};

function spawnNpc(kind, count){
  const made = [];
  for (let i = 0; i < count; i++){
    const cop = kind === 'police' ? POLICE[i % POLICE.length] : null;
    const n = newCat(cop ? cop.name : NPC_NAMES[kind][i % NPC_NAMES[kind].length]);
    n.npc = kind;
    n.fur = cop ? cop.fur : 2;
    n.hue = cop ? (cop.hue || 0) : 0;
    n.acc = kind === 'police' ? 'none' : 'tie';
    n.equip = kind === 'police' ? { head:'cap', neck:null, paw:null }
            : kind === 'rival' ? { head:null, neck:null, paw:null }
                               : { head:'glasses', neck:null, paw:null };
    n.rank = 0;
    n.x = W.door.x; n.y = W.H - 1;
    n.job = { stage:'enter', t:0 };
    n.act = { s:'idle', t:0 };
    NPCS.push(n);
    made.push(n);
  }
  bus.emit('npc:arrive', { kind, cats:made });
  return made;
}

function npcTarget(n){
  if (n.npc === 'rival'){
    // 문 근처만 어슬렁거린다. 안까지는 안 들어온다.
    for (let i = 0; i < 12; i++){
      const x = W.door.x + Math.floor(rngi(5)) - 2;
      const y = W.H - 2 - Math.floor(rngi(2));
      if (walkable(W, x, y)) return { x, y };
    }
    return null;
  }
  if (n.npc === 'legal'){
    const desk = (W.facilities.legal && W.facilities.legal[0]) || W.inbox;
    const spots = adjacentFree(W, desk);
    return spots[0] || null;
  }
  // 냥찰은 사무실을 헤집는다
  for (let i = 0; i < 12; i++){
    const x = 1 + Math.floor(Math.random() * (W.W - 2));
    const y = 1 + Math.floor(Math.random() * (W.H - 2));
    if (walkable(W, x, y)) return { x, y };
  }
  return null;
}

const rngi = n => Math.floor(Math.random() * n);

function npcStep(n, dt){
  const j = n.job;
  j.t += dt;
  if (n.act.s === 'walk'){ moveAlong(n, dt); return; }

  if (j.stage === 'enter'){
    const spot = npcTarget(n);
    j.stage = 'work'; j.t = 0;
    if (spot) goTo(n, spot, 'idle');
    return;
  }
  if (j.stage === 'work'){
    const dur = n.npc === 'police' ? 8 : n.npc === 'rival' ? 5 : 7;
    if (Math.random() < dt * 0.10) chat(n, n.npc);
    if (j.t > dur){
      if (n.npc === 'police' && RAID){        // 계속 다른 자리를 뒤진다
        const spot = npcTarget(n);
        j.t = 0;
        if (spot) goTo(n, spot, 'idle');
      } else {
        j.stage = 'leave'; j.t = 0;
      }
    }
    return;
  }
  if (j.stage === 'leave'){
    if (!j.going){
      j.going = true;
      if (!goTo(n, { x:W.door.x, y:W.H - 1 }, 'idle')) NPCS = NPCS.filter(x => x !== n);
      return;
    }
    NPCS = NPCS.filter(x => x !== n);
  }
}

function startRaid(){
  if (RAID) return;
  RAID = { t:0, dur:36 };
  spawnNpc('police', POLICE.length);
  bus.emit('raid:start');
}
/* 멍멍파가 점유율을 챙기러 문 앞을 기웃거린다 */
function sendRival(){
  if (NPCS.some(n => n.npc === 'rival')) return;
  spawnNpc('rival', 1);
}

function sendLegal(){
  if (NPCS.some(n => n.npc === 'legal')) return;
  spawnNpc('legal', 1);
}

/* ---------- 틱 ---------- */
const RESTORE = { sleep:{ energy:6 }, coffee:{ caffeine:12, energy:2.5 }, litter:{ bladder:18 },
                  social:{ fun:9 }, play:{ fun:15, energy:-1.5 } };   // 노는 건 재밌지만 기운을 쓴다
const NEED_SCALE = 0.35;   // 욕구가 닳는 전체 속도. 낮출수록 고양이가 자리를 오래 지킨다.

function simTick(dt){
  const p = phaseOf(S.clock);
  S.clock = nowMin();                        // 데스크탑 시계와 동기
  const dk = dayKey();
  if (S.dateKey !== dk){ S.dateKey = dk; S.day++; bus.emit('day:new', S.day); }
  /* 업무일은 자정이 아니라 rollMin 에 바뀐다(위). 결재함이 갱신되고 기한이 정산되는
     경계는 이쪽이다 — 두 날짜를 한 변수로 합치면 야근하는 사람의 하루가 반으로 잘린다. */
  const bk = bizKey();
  if (S.bizKey !== bk){ const from = S.bizKey; S.bizKey = bk; bus.emit('biz:new', { from, to: bk }); }

  const hasCoffee = !!(W.facilities.coffee);
  const decayMul = shopMul('decay', 1);
  const raidMul = RAID ? 0.4 : 1;            // 압수수색 중에는 일이 손에 안 잡힌다
  let working = 0, income = 0;

  for (const c of S.cats){
    const tr = traitOf(c);
    const a = c.act;
    a.t += dt;

    // --- 욕구 ---
    const conSlow = 1 - clampv(mod(statOf(c,'con')) * 0.055, -0.25, 0.35);
    const base = dt * tr.decay * decayMul * NEED_SCALE;
    const resting = (a.s === 'sleep' || a.s === 'use');
    c.needs.energy   -= base * 0.62 * conSlow * (a.s === 'work' || a.s === 'stamp' ? 1.25 : resting ? 0 : 0.7);
    c.needs.fun      -= base * 0.70 * (a.s === 'use' ? 0 : 1);
    c.needs.bladder  -= base * 0.44;
    if (hasCoffee) c.needs.caffeine -= base * 0.55;
    else c.needs.caffeine = Math.max(c.needs.caffeine, 55);

    // --- 상태별 처리 ---
    if (a.s === 'walk'){
      moveAlong(c, dt);
      c.deskT = 0;
    } else if (a.s === 'work'){
      working++;
      c.deskT = (c.deskT || 0) + dt;      // 얼마나 붙어 있었는가 — decide() 가 이걸 본다
      income += catRate(c) * PHASE_MUL[p] * raidMul * dt;
      if (a.t > 4 + Math.random() * 4){ decide(c); }
      if (Math.random() < dt * 0.012) chat(c, p === 'night' ? 'night' : 'work');
      if (tr.luck && Math.random() < dt * 0.004){
        const g = Math.round(totalRate() * 14 + 25);
        S.anchovy += g; S.stats.qEarned += g; S.stats.totalEarned += g;
        bus.emit('cat:found', { cat:c, amount:g });
      }
    } else if (a.s === 'stamp'){
      income += catRate(c) * PHASE_MUL[p] * raidMul * dt * 0.5;
      if (a.t > 1.7) finishStamp(c);
    } else if (a.s === 'use' || a.s === 'sleep'){
      const kind = a.s === 'sleep' ? 'sleep' : (a.use ? (TILE_INFO[tileAt(W, a.use.x, a.use.y)] || {}).use : null) || 'social';
      const r = RESTORE[kind] || {};
      let full = true;
      for (const k in r){
        c.needs[k] = Math.min(100, c.needs[k] + r[k] * dt * shopMul('recover', 1));
        if (c.needs[k] < 96) full = false;
      }
      /* 기력이 차면 깬다 — 시각은 안 본다. 전에는 밤이면 영영 안 깨웠고,
         그래서 새벽에 서류를 올려도 일어날 냥이 하나도 없었다. */
      if (a.stay && a.t < a.stay) full = false;    // 쉬러 온 거면 잠깐은 머문다
      /* 머무는 동안에도 이따금 한 번 더. 말풍선은 2.6초에 사라지는데 머무는 시간은
         4~22초라, 도착에 한 번만 말하면 나중에 화면을 본 사람에게는 그냥 서 있는
         고양이다. 근무 중의 혼잣말(위 work 가지)과 같은 빈도로 둔다 — 그보다
         잦으면 사무실이 자막으로 덮인다. */
      if (Math.random() < dt * 0.012) sayDoing(c);
      if (full || a.t > 22) decide(c);
    } else { // idle
      if (a.t > 0.6) decide(c);
    }

    for (const k in c.needs) c.needs[k] = clampv(c.needs[k], 0, 100);
  }

  S.anchovy += income;
  S.stats.qEarned += income;
  S.stats.totalEarned += income;
  S.working = working;

  // 외부인(법무팀·냥찰)
  for (const n of NPCS.slice()) npcStep(n, dt);
  if (RAID){
    RAID.t += dt;
    if (RAID.t >= RAID.dur) endRaid();
  }

  // 버려진 문서 회수
  for (const d of DOCS){
    if (d.state === 'claim' && !S.cats.some(c => c.id === d.by)) { d.state = 'inbox'; d.by = null; }
    if (d.state === 'carry'){
      const c = S.cats.find(x => x.doc === d.id);
      if (c){ d.x = c.x; d.y = c.y; } else { d.state = 'inbox'; d.by = null; d.x = W.inbox.x; d.y = W.inbox.y; }
    }
  }
}
