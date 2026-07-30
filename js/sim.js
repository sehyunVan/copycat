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

/* ---------- 시계 ---------- */
const MIN_PER_SEC = 0.75;                    // 실시간 1초 = 게임 0.75분 (하루 = 32분)
function phaseOf(min){
  const h = min / 60;
  if (h >= 8 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}
const PHASE_MUL = { day:1, evening:0.80, night:0.35 };
function clockStr(){
  const h = Math.floor(S.clock/60) % 24, m = Math.floor(S.clock % 60);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

/* ---------- 월드 구축 ---------- */
function buildWorld(){
  W = genOffice(S.tier, S.shop, S.seed);
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
  const p = phaseOf(S.clock);
  if (p === 'night' && !traitOf(c).nocturnal) return c.needs.energy > 55;   // 잠결에도 급하면 일어난다
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
const NEED_FACILITY = { energy:'sleep', bladder:'litter', caffeine:'coffee', fun:'social' };

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

  // 밤에는 잔다 (야근형 제외)
  if (p === 'night' && !tr.nocturnal){
    const bed = nearestUse(W, 'sleep', c);
    if (bed && Math.random() < 0.7 && goTo(c, bed.spot, 'sleep', bed.target)) return;
    c.act = { s:'sleep', t:0, use:null };
    return;
  }

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
    const use = NEED_FACILITY[need];
    const f = nearestUse(W, use, c);
    if (f){
      if (goTo(c, f.spot, use === 'sleep' ? 'sleep' : 'use', f.target)){ chat(c, use, 0.3); return; }
    } else if (need === 'energy'){
      c.act = { s:'sleep', t:0, use:null };   // 잘 데가 없으면 그 자리에서 존다
      return;
    } else if (need === 'caffeine'){
      c.needs.caffeine = 55;                  // 커피머신이 없으면 갈망 자체가 없다
    }
  }

  // 저녁: 야근형이 아니면 절반은 논다
  if (p === 'evening' && !tr.nocturnal && Math.random() < 0.45){
    const f = nearestUse(W, 'social', c);
    if (f && goTo(c, f.spot, 'use', f.target)) return;
  }

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

/* ---------- 말풍선 ---------- */
function chat(c, kind, chance){
  if (Math.random() > (chance == null ? 1 : chance)) return;
  const pool = CHAT[kind] || CHAT.idle;
  const line = pool[Math.floor(Math.random() * pool.length)];
  bus.emit('cat:say', { cat:c, text:line });
}

/* ============================================================
   외부인: 법무팀 · 냥찰
   직원과 같은 길찾기/이동 코드를 그대로 쓴다. 특권 없음.
   ============================================================ */
/* 냥찰청은 늘 같은 두 마리가 온다. 매번 다른 이름이 나오면 조직이 아니라
   무작위 NPC로 읽힌다. 얼굴이 고정되어야 "또 왔네"가 된다. */
const POLICE = [
  { name:'도 경찰', fur:0 },
  { name:'김 경찰', fur:1 },
];
const NPC_NAMES = { legal: ['법무 정', '법무 윤', '법무 한'] };

function spawnNpc(kind, count){
  const made = [];
  for (let i = 0; i < count; i++){
    const cop = kind === 'police' ? POLICE[i % POLICE.length] : null;
    const n = newCat(cop ? cop.name : NPC_NAMES[kind][i % NPC_NAMES[kind].length]);
    n.npc = kind;
    n.fur = cop ? cop.fur : 2;
    n.hue = 0;
    n.acc = kind === 'police' ? 'none' : 'tie';
    n.equip = kind === 'police' ? { head:'cap', neck:null, paw:null }
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
    const dur = n.npc === 'police' ? 8 : 7;
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
function sendLegal(){
  if (NPCS.some(n => n.npc === 'legal')) return;
  spawnNpc('legal', 1);
}

/* ---------- 틱 ---------- */
const RESTORE = { sleep:{ energy:6 }, coffee:{ caffeine:12, energy:2.5 }, litter:{ bladder:18 }, social:{ fun:9 } };
const NEED_SCALE = 0.35;   // 욕구가 닳는 전체 속도. 낮출수록 고양이가 자리를 오래 지킨다.

function simTick(dt){
  const p = phaseOf(S.clock);
  S.clock = (S.clock + dt * MIN_PER_SEC) % 1440;
  if (S.clock < dt * MIN_PER_SEC) { S.day++; bus.emit('day:new', S.day); }

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
    } else if (a.s === 'work'){
      working++;
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
      if (a.s === 'sleep' && p === 'night' && !tr.nocturnal) full = false;   // 밤엔 계속 잔다
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
