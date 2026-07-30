/* ============================================================
   game.js — 경제, 결재함, 분기, 저장
   ============================================================ */

const SAVE_KEY = 'copycat.save.v1';

const SHOP = [
  { id:'coffee',  em:'☕', n:'커피머신',      d:'전 직원 생산 +15% · 카페인 욕구 해소',  cost:320,     tier:0, prod:0.15 },
  { id:'copier',  em:'🖨️', n:'복사기',       d:'결재 1건당 멸치 ×1.8',                  cost:900,     tier:1, todoMul:1.8 },
  { id:'tower',   em:'🗼', n:'캣타워',        d:'욕구 감소 -30% · 낮잠 장소 추가',       cost:1600,    tier:1, decay:0.70 },
  { id:'scratch', em:'🪵', n:'스크래처 존',   d:'욕구 회복 속도 ×1.6',                   cost:5200,    tier:2, recover:1.6 },
  { id:'server',  em:'🖥️', n:'건조실',       d:'전 직원 생산 +35% (따뜻해서 인기)',      cost:14000,   tier:3, prod:0.35 },
  { id:'feeder',  em:'🍚', n:'자동급식기',    d:'오프라인 수익 8h→16h, +50%',            cost:26000,   tier:3, offline:1.5 },
  { id:'meeting', em:'🪑', n:'회의 테이블',   d:'결재 성과(KPI) ×1.4',                   cost:60000,   tier:4, kpiMul:1.4 },
  { id:'gym',     em:'🏋️', n:'사내 헬스장',  d:'전 직원 생산 +55%',                     cost:150000,  tier:4, prod:0.55 },
  { id:'lab',     em:'🔬', n:'정제실',        d:'전 직원 생산 +90% · 승진비 -20%',       cost:420000,  tier:5, prod:0.90, promoDisc:0.8 },
  { id:'rocket',  em:'🚀', n:'사내 로켓',     d:'전 직원 생산 +120%',                    cost:1500000, tier:6, prod:1.20 },
];

const SIZE_INFO = {
  s:{ kpi:1, mult:1,   sec:35,  label:'작음' },
  m:{ kpi:3, mult:3.4, sec:110, label:'보통' },
  l:{ kpi:7, mult:8.5, sec:280, label:'큼'   },
};

const HIRE_BASE = 140, HIRE_GROW = 1.72;
/* 분기 목표. 지수로 두면 후반이 도달 불가라 완만한 곡선을 쓴다.
   대신 todoReward의 성과가 사무실 등급과 함께 커져서 "분기당 처리 건수"가 일정하게 유지된다. */
const qTarget = q => Math.round(6 + 1.6 * Math.pow(q - 1, 1.45));

/* 사건 표.
   Copycat은 캣닢을 재배·정제해 파는 회사다. 좋은 일은 대체로 안 걸린 일이고,
   나쁜 일은 대체로 흔적이 남은 일이다. */
const EVENTS = [
  { t:'건조기 온도를 잘못 맞춰 한 배치를 통째로 태웠다.',            k:'bad',  money:-0.06 },
  { t:'「고양이 사료」로 신고한 컨테이너가 항구를 무사히 통과했다.',   k:'good', flat:2.5 },
  { t:'단속 일정을 미리 입수했다. 그날은 전 직원 연차를 썼다.',           k:'good', heat:-1 },
  { t:'인턴 냥이가 3급을 1급 봉지에 담았다. 아무도 눈치 못 챘다.',   k:'good', flat:1.6 },
  { t:'창밖에 낯선 차가 이틀째 서 있다. 다들 조용히 일했다.',             k:'bad',  need:{ fun:-20 }, heat:1 },
  { t:'재고 실사 중 전 직원이 시식에 참여했다. 생산성은 0이 되었다.',       k:'good', need:{ fun:100 }, money:-0.03 },
  { t:'대표냥이 이중장부 위에서 잤다. 장부가 따뜻해졌다.',                k:'neutral' },
  { t:'경쟁사 멍멍상사가 우리 구역에 물건을 풀었다. 다들 이를 갈았다.',            k:'bad',  money:-0.08, need:{ fun:-15 } },
  { t:'「월간 캣워크」가 우리를 유기농 허브 스타트업으로 소개했다.', k:'good', flat:2.0, drop:1 },
  { t:'택배 상자가 도착했다. 송장에 적힌 이름은 우리 회사가 아니었다.',   k:'neutral', need:{ fun:40 } },
  { t:'세무 조사에서 회계 장부 대신 발자국이 발견되었다.',                k:'bad',  money:-0.05, heat:1 },
  { t:'신입 냥이가 문 앞에서 울고 있었다. 채용 공고도 안 냈는데.',        k:'hire' },
  { t:'전 직원 단체 그루밍 워크숍. 감식에 털이 안 남게 하는 요령도 배웠다.',k:'good', need:{ fun:50, energy:30 } },
  { t:'투자자 미팅에서 골골송을 불렀다. 아무도 사업 내용을 묻지 않았다.', k:'good', flat:3.2, drop:1 },
  { t:'분실물 센터에서 「우리 것이 아닌」 물건을 찾아왔다.',              k:'good', drop:1 },
  { t:'건조실 온기 때문에 아무도 자리에 안 돌아왔다.',                    k:'neutral', need:{ energy:60 }, money:-0.02 },
  { t:'내부 고발 편지가 반송되어 돌아왔다. 주소를 잘못 썼더라.',          k:'good', heat:-1 },
  { t:'창고 재고와 장부가 안 맞는다. 직원들이 조금씩 먹는 것 같다.',               k:'bad',  heat:1 },
];

/* ---------- 상태 ---------- */
let S = null;

function newGame(){
  const first = newCat('치즈');
  first.fur = 0; first.acc = 'tie'; first.trait = 'steady';
  return {
    v: 2,
    seed: Math.floor(Math.random() * 1e9),
    anchovy: 0, quarter: 1, kpi: 0, tier: 0,
    clock: 9 * 60, day: 1,
    cats: [first],
    todos: [], shop: {}, log: [], bag: [],
    penalty: 0, jail: [], referred: 0,
    stats: { done:0, totalKpi:0, totalEarned:0, qEarned:0, qDone:0, started:Date.now() },
    working: 0,
    last: Date.now(),
  };
}

function save(){
  if (!S) return;
  S.last = Date.now();
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
    d.todos = (d.todos || []).map(t => ({ ...t, q: t.q || 1 }));
    d.cats.forEach(c => {
      c.stats = c.stats || rollStats();
      c.equip = c.equip || { head:null, neck:null, paw:null };
      c.needs = c.needs || { energy:100, fun:100, caffeine:100, bladder:100 };
      c.act = { s:'idle', t:0 }; c.doc = null;
    });
    return d;
  } catch(e){ return null; }
}

/* ---------- 계산 ---------- */
const shopHas = id => !!S.shop[id];
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
  const office  = 1 + shopSum('prod') + teamProd();
  const tierMul = 1 + S.tier * 0.22;
  const legalMul = legalDrag();
  return Math.max(0.02, r.rate * m * Math.max(0.3, statMul) * moodMul * office * tierMul * legalMul);
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
  const nx = RANKS[c.rank + 1];
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

/* ---------- 결재함 ---------- */
function addTodo(text, size){
  // 올린 분기를 기록한다. 다음 분기까지 안 끝내면 흔적으로 남는다.
  S.todos.push({ id:'t' + Math.random().toString(36).slice(2,9), text, size, done:false, q:S.quarter });
  save();
}
/* 이번 분기 마감 때 밖으로 샐 건 (= 전 분기 이월분) */
const overdueTodos = () => S.todos.filter(t => !t.done && t.q < S.quarter);
const isOverdue = t => !t.done && t.q < S.quarter;
function completeTodo(id){
  const t = S.todos.find(x => x.id === id);
  if (!t || t.done) return false;
  t.done = true;
  spawnDoc(t);                       // 보상은 고양이가 도장을 찍어야 들어온다
  bus.emit('todo:done', t);
  save();
  return true;
}
function delTodo(id){
  const i = S.todos.findIndex(x => x.id === id);
  if (i >= 0){ S.todos.splice(i, 1); save(); }
}

/* 고양이가 도장을 찍는 순간 실제 보상 지급 */
bus.on('doc:stamped', ({ cat, doc }) => {
  const r = todoReward(doc.size);
  S.anchovy += r.money;
  S.kpi += r.kpi;
  S.stats.done++; S.stats.qDone++;
  S.stats.totalKpi += r.kpi; S.stats.totalEarned += r.money; S.stats.qEarned += r.money;

  const rec = { s:10, m:20, l:34 }[doc.size] * shopMul('recover', 1);
  S.cats.forEach(c => { c.needs.fun = Math.min(100, c.needs.fun + rec); });
  cat.needs.energy = Math.max(0, cat.needs.energy - 3);

  bus.emit('reward', { cat, money:r.money, kpi:r.kpi, doc });
  if (S.kpi >= qTarget(S.quarter)) setTimeout(closeQuarter, 700);
});

/* ---------- 채용 / 승진 / 구매 ---------- */
function hire(){
  if (S.cats.length >= deskCount()) return { err:'자리가 없다냥. 사무실을 넓히자.' };
  const cost = hireCost();
  if (S.anchovy < cost) return { err:'멸치가 부족하다' };
  S.anchovy -= cost;
  const c = newCat();
  c.x = W.door.x; c.y = W.H - 2;
  S.cats.push(c);
  assignDesks();
  pushLog(`<b>${esc(c.name)}</b> 냥이 입사했습니다. (${traitOf(c).n})`, 'good');
  save();
  return { cat:c };
}
function promote(id){
  const c = S.cats.find(x => x.id === id);
  if (!c || !RANKS[c.rank + 1]) return false;
  const cost = promoCost(c);
  if (S.anchovy < cost) return false;
  S.anchovy -= cost;
  c.rank++;
  c.needs.fun = Math.min(100, c.needs.fun + 30);
  pushLog(`<b>${esc(c.name)}</b> 냥이 <b>${RANKS[c.rank].n}</b>(으)로 승진했습니다.`, 'good');
  bus.emit('cat:say', { cat:c, text: RANKS[c.rank].n + '이다냥!' });
  save();
  return true;
}
function buyItem(id){
  const it = SHOP.find(x => x.id === id);
  if (!it || shopHas(id) || S.tier < it.tier || S.anchovy < it.cost) return false;
  S.anchovy -= it.cost;
  S.shop[id] = true;
  buildWorld();                      // 비품은 실제로 사무실 안에 놓인다
  pushLog(`사무실에 <b>${it.n}</b>${it.em} 이(가) 들어왔습니다.`, 'good');
  save();
  return true;
}
function equipItem(catId, itemId){
  const c = S.cats.find(x => x.id === catId);
  const it = EQUIP.find(x => x.id === itemId);
  if (!c || !it) return false;
  const i = S.bag.indexOf(itemId);
  if (i < 0) return false;
  S.bag.splice(i, 1);
  const old = c.equip[it.slot];
  if (old) S.bag.push(old);
  c.equip[it.slot] = itemId;
  save();
  return true;
}
function unequip(catId, slot){
  const c = S.cats.find(x => x.id === catId);
  if (!c || !c.equip[slot]) return false;
  S.bag.push(c.equip[slot]);
  c.equip[slot] = null;
  save();
  return true;
}

/* ============================================================
   흔적 · 혐의 · 냥찰
   분기 마감 시점에 전 분기 이월 미처리 건은 정리되지 못한 채 밖으로 샌다 = 증거.
   혐의가 쌓이면 다들 몸을 사려 생산성이 떨어지고, 5점을 넘기면 압수수색이 들어온다.
   ============================================================ */
const RAID_THRESHOLD = 5;   // 이 점수를 넘으면 영장이 나온다

/* 혐의 1점당 생산 -6% — 다들 몸을 사린다. 압수수색 중엔 sim에서 추가 감산 */
function legalDrag(){ return Math.max(0.40, 1 - 0.06 * (S.penalty || 0)); }

function referToLegal(list){
  if (!list.length) return null;
  const points = list.reduce((a, t) => a + (t.size === 'l' ? 2 : 1), 0);
  const feeRate = Math.min(0.40, 0.06 * list.length);
  const fee = Math.round(S.anchovy * feeRate);
  S.anchovy = Math.max(0, S.anchovy - fee);
  S.penalty += points;
  S.referred += list.length;
  const ids = new Set(list.map(t => t.id));
  S.todos = S.todos.filter(t => !ids.has(t.id));
  S.cats.forEach(c => { c.needs.fun = Math.max(0, c.needs.fun - 12); });
  sendLegal();
  pushLog(`미처리 <b>${list.length}건</b>이 정리되지 않은 채 밖으로 나갔습니다. 혐의 +${points}, 뒷수습 비용 🐟${fmt(fee)}.`, 'bad');
  return { count:list.length, points, fee, items:list.map(t => t.text) };
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
  pushLog(`법무법인에 <b>🐟${fmt(cost)}</b>을 집행했습니다. 혐의 1점이 조용히 사라졌습니다.`, 'bad');
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
    S.jail.push({ cat: taken, returnQ: S.quarter + 1 });
    assignDesks();
  }
  S.cats.forEach(c => { c.needs.fun = Math.max(0, c.needs.fun - 25); });

  pushLog(`냥찰청 조사 종료. 과징금 🐟${fmt(fine)} 부과, 혐의 ${before} → 0.`
    + (taken ? ` <b>${esc(taken.name)}</b> 냥은 참고인 조사차 연행되었습니다.` : ''), 'bad');
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

  // 1) 전 분기 이월 미처리 건 → 법무팀 이관
  const legal = referToLegal(overdueTodos());
  if (!legal && S.penalty > 0){
    S.penalty--;                                   // 무사고 분기 1점 소멸
    pushLog('이번 분기는 흔적을 남기지 않았습니다. 혐의 1점이 소멸되었습니다.', 'good');
  }

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
  if (ev.drop || Math.random() < 0.35){
    const it = EQUIP[Math.floor(Math.random() * EQUIP.length)];
    S.bag.push(it.id);
    evDrop = it;
  }
  if (ev.k === 'hire'){
    if (S.cats.length < deskCount()){
      evHire = newCat();
      evHire.x = W.door.x; evHire.y = W.H - 2;
      S.cats.push(evHire);
      assignDesks();
    } else {
      evText = '신입 냥이가 문 앞에 왔지만 자리가 없어 발길을 돌렸다.';
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
    pushLog(`<b>${esc(j.cat.name)}</b> 냥이 조사를 마치고 복귀했습니다. 무혐의.`, 'good');
  });
  if (back.length) assignDesks();

  const oldTier = S.tier;
  const newTier = tierForQuarter(S.quarter);
  let moved = false;
  if (newTier > oldTier){
    S.tier = newTier;
    S.seed = Math.floor(Math.random() * 1e9);   // 새 사무실은 새로 그린다
    buildWorld();
    moved = true;
  }

  const bonus = Math.round(Math.max(150, earned * 0.5) * (1 + S.tier * 0.4));
  S.anchovy += bonus;
  S.cats.forEach(c => { c.needs.fun = Math.min(100, c.needs.fun + 40); });

  pushLog(`<b>Q${q} 결산</b> — 매출 🐟${fmt(earned)}, 결재 ${done}건. ${evText}`, 'big');
  if (evDrop) pushLog(`창고에 <b>${evDrop.n}</b>${evDrop.em} 이(가) 들어왔습니다.`, 'good');
  if (moved)  pushLog(`🎉 <b>${TIERS[S.tier].name}</b>(으)로 이전했습니다. 자리 ${deskCount()}석`, 'big');

  // 3) 혐의 한계 초과 → 영장 발부
  const raiding = S.penalty >= RAID_THRESHOLD;
  if (raiding){
    pushLog(`혐의 ${S.penalty}점. <b>냥찰청 특별사법경찰</b>이 압수수색 영장을 받았습니다.`, 'bad');
    setTimeout(startRaid, 2500);
  }

  bus.emit('quarter:closed', {
    q, earned, done, evText, evGain, evHire, evDrop, moved, oldTier, bonus,
    legal, back, raiding, penalty:S.penalty,
  });
  save();
}

/* ---------- 오프라인 ---------- */
function applyOffline(){
  const now = Date.now();
  const dt = Math.max(0, (now - (S.last || now)) / 1000);
  S.last = now;
  if (dt < 60) return null;

  const maxH = shopHas('feeder') ? 16 : 8;
  const capped = Math.min(dt, maxH * 3600);

  // 자리 비운 동안 욕구는 천천히 떨어지고, 고양이들은 알아서 쉬어가며 일한다
  S.cats.forEach(c => {
    const tr = traitOf(c);
    const drain = Math.min(55, capped / 3600 * 9 * tr.decay * shopMul('decay', 1));
    c.needs.energy = Math.max(20, c.needs.energy - drain);
    c.needs.fun    = Math.max(15, c.needs.fun - drain);
  });

  const eff = potentialRate() * 0.55 * shopMul('offline', 1);
  const gain = Math.round(eff * capped);
  S.anchovy += gain; S.stats.totalEarned += gain; S.stats.qEarned += gain;
  S.clock = (S.clock + capped / 60 * MIN_PER_SEC) % 1440;

  const hrs = capped / 3600;
  return { gain, timeStr: hrs >= 1 ? hrs.toFixed(1) + '시간' : Math.round(capped / 60) + '분' };
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
