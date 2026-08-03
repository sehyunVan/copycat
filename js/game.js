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
  { id:'feeder',  em:'🍚', n: L({ ko:'자동급식기',  en:'Auto Feeder',    ja:'自動給餌器' }),
    d: L({ ko:'오프라인 수익 8h→16h, +50%',          en:'Offline income 8h→16h, +50%',        ja:'オフライン収益8h→16h、+50%' }),
    cost:26000,   tier:3, offline:1.5 },
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
];

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
  const first = newCat(L({ ko:'치즈', en:'Cheese', ja:'チーズ' }));
  first.fur = 0; first.acc = 'tie'; first.trait = 'steady';
  first.rec = newRecord(1);        // 창업 멤버. 회사를 접고 다시 차려도 Q1 입사다.
  return {
    v: 2,
    seed: Math.floor(Math.random() * 1e9),
    anchovy: 0, quarter: 1, kpi: 0, tier: 0,
    clock: nowMin(), day: 1, dateKey: dayKey(),
    cats: [first],
    todos: [], shop: {}, log: [], bag: [],
    candidate: null,                                 // 문 앞에서 기다리는 지원자
    penalty: 0, jail: [], referred: 0, rival: 0.10,
    stats: { done:0, totalKpi:0, totalEarned:0, qEarned:0, qDone:0, started:Date.now() },
    together: newTogether(),
    working: 0,
    last: Date.now(),
  };
}

function save(){
  if (!S) return;
  /* last = "시뮬레이션이 마지막으로 돌던 때". 탭이 숨으면 rAF 루프가 멈춰 고양이가
     일을 안 하므로, 그 시간은 오프라인으로 쳐서 나중에 정산해 줘야 한다.
     8초마다 도는 자동 저장이 숨은 동안에도 last를 새로 찍으면 그 시간이 통째로
     증발한다 — 탭을 아예 닫은 사람은 8시간치를 받고, 배경에 켜 둔 사람은 0을 받는다.
     이 게임은 배경에 켜 두라고 만든 물건이라 그게 제일 나쁜 결과다. */
  if (typeof document === 'undefined' || !document.hidden) S.last = Date.now();
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
    d.dateKey = d.dateKey || dayKey();   // 32분-하루 시절 저장 보정
    d.candidate = d.candidate || null;
    d.together = normTogether(d.together);   // 함께한 시간도 나중에 생긴 칸이다
    d.todos = (d.todos || []).map(t => ({ ...t, q: t.q || 1 }));
    d.cats.forEach(c => {
      c.stats = c.stats || rollStats();
      c.equip = c.equip || { head:null, neck:null, paw:null };
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
  const legalMul = legalDrag() * rivalDrag();
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
  save();
  return c;
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
function promote(id){
  const c = S.cats.find(x => x.id === id);
  if (!c || !RANKS[c.rank + 1]) return false;
  const cost = promoCost(c);
  if (S.anchovy < cost) return false;
  S.anchovy -= cost;
  c.rank++;
  c.needs.fun = Math.min(100, c.needs.fun + 30);
  pushLog(L({
    ko:`<b>${esc(c.name)}</b> 냥이 <b>${RANKS[c.rank].n}</b>(으)로 승진했습니다.`,
    en:`<b>${esc(c.name)}</b> was promoted to <b>${RANKS[c.rank].n}</b>.`,
    ja:`<b>${esc(c.name)}</b>が<b>${RANKS[c.rank].n}</b>に昇進しました。`,
  }), 'good');
  bus.emit('cat:say', { cat:c, text: L({
    ko: RANKS[c.rank].n + '이다냥!',
    en: RANKS[c.rank].n + ' now, nya!',
    ja: RANKS[c.rank].n + 'になったにゃ！',
  }) });
  save();
  return true;
}
function buyItem(id){
  const it = SHOP.find(x => x.id === id);
  if (!it || shopHas(id) || S.tier < it.tier || S.anchovy < it.cost) return false;
  S.anchovy -= it.cost;
  S.shop[id] = true;
  // 산 가구 하나만 끼워 넣는다. 사무실을 다시 생성하면 기존 가구가 전부 이사한다.
  const tile = SHOP_TILE[id];
  if (tile) addFurniture(tile);
  pushLog(L({
    ko:`사무실에 <b>${it.n}</b>${it.em} 이(가) 들어왔습니다.`,
    en:`<b>${it.n}</b>${it.em} has been installed in the office.`,
    ja:`オフィスに<b>${it.n}</b>${it.em}が届きました。`,
  }), 'good');
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
  pushLog(L({
    ko:`미처리 <b>${list.length}건</b>이 정리되지 않은 채 밖으로 나갔습니다. 혐의 +${points}, 뒷수습 비용 🐟${fmt(fee)}.`,
    en:`<b>${list.length} unresolved item(s)</b> leaked out uncleaned. Heat +${points}, cleanup cost 🐟${fmt(fee)}.`,
    ja:`未処理<b>${list.length}件</b>が整理されないまま外部に流出。容疑+${points}、後始末費用🐟${fmt(fee)}。`,
  }), 'bad');
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

  // 1) 전 분기 이월 미처리 건 → 법무팀 이관
  const legal = referToLegal(overdueTodos());
  if (!legal && S.penalty > 0){
    S.penalty--;                                   // 무사고 분기 1점 소멸
    pushLog(L({
      ko:'이번 분기는 흔적을 남기지 않았습니다. 혐의 1점이 소멸되었습니다.',
      en:'No traces left this quarter. One point of heat expired.',
      ja:'今期は痕跡を残しませんでした。容疑1点が消滅。',
    }), 'good');
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
  if (ev.rival){ S.rival = Math.max(0, Math.min(RIVAL_MAX, S.rival + ev.rival)); }
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
    ko:`창고에 <b>${evDrop.n}</b>${evDrop.em} 이(가) 들어왔습니다.`,
    en:`<b>${evDrop.n}</b>${evDrop.em} was added to storage.`,
    ja:`倉庫に<b>${evDrop.n}</b>${evDrop.em}が入りました。`,
  }), 'good');
  if (moved)  pushLog(L({
    ko:`🎉 <b>${TIERS[S.tier].name}</b>(으)로 이전했습니다. 자리 ${deskCount()}석`,
    en:`🎉 Moved to <b>${TIERS[S.tier].name}</b>. ${deskCount()} desks`,
    ja:`🎉 <b>${TIERS[S.tier].name}</b>に移転。席は${deskCount()}席`,
  }), 'big');

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
    legal, back, raiding, penalty:S.penalty, rival, rivalNews: rivalNews(),
  });
  save();
}

/* ---------- 오프라인 ----------
   돌아온 사람에게 숫자 하나만 내미는 건 정산이지 인수인계가 아니다.
   그래서 실제 상태에서만 두세 문장을 뽑는다. 규칙은 두 개다:
     1) 없던 사건은 지어내지 않는다 — 자리를 비운 동안 사무실에는 아무도 오지 않았고
        혐의도 점유율도 움직이지 않았다. 그러니 "그대로였다"까지만 쓴다.
     2) 재촉하지 않는다. 남은 서류는 세기만 하고, 왜 안 했는지는 묻지 않는다. */
function offlineStory(gain, rates, total){
  const out = [];

  // 1) 누가 제일 벌어왔나 — 오프라인 수익을 나눈 비율 그대로다. 지어낸 순위가 아니다.
  const top = rates.slice().sort((a, b) => b.r - a.r)[0];
  if (top){
    const share = total > 0 ? top.r / total : 1;
    const cut = Math.round(gain * share);
    const nm = esc(top.c.name);
    out.push(S.cats.length === 1
      ? L({ ko:`혼자 사무실을 지킨 <b>${nm}</b> 냥이 🐟${fmt(cut)} 벌어놨습니다.`,
            en:`<b>${nm}</b> held the office alone and brought in 🐟${fmt(cut)}.`,
            ja:`ひとりでオフィスを守った<b>${nm}</b>が🐟${fmt(cut)}を稼いでおきました。` })
      : L({ ko:`가장 많이 벌어온 건 <b>${nm}</b> ${RANKS[Math.min(top.c.rank, RANKS.length-1)].n}입니다 — 🐟${fmt(cut)}, 전체의 ${Math.round(share*100)}%.`,
            en:`<b>${nm}</b> (${RANKS[Math.min(top.c.rank, RANKS.length-1)].n}) brought in the most — 🐟${fmt(cut)}, ${Math.round(share*100)}% of it.`,
            ja:`いちばん稼いだのは<b>${nm}</b>${RANKS[Math.min(top.c.rank, RANKS.length-1)].n}——🐟${fmt(cut)}、全体の${Math.round(share*100)}%です。` }));
  }

  // 2) 제일 지친 냥이 — 자리를 비운 동안 실제로 깎인 기력이다.
  //    1번과 같은 냥이면 통째로 건너뛴다. 두 문장 연속 같은 이름은 보고서가 아니라 험담이다.
  const tired = S.cats.slice().sort((a, b) => a.needs.energy - b.needs.energy)[0];
  if (tired && S.cats.length > 1 && tired !== (top && top.c) && tired.needs.energy <= 45){
    const nm = esc(tired.name), e = Math.round(tired.needs.energy);
    // 조사(-로/-으로)가 숫자 읽는 법에 따라 갈리므로 아예 붙이지 않는 문형을 쓴다
    out.push(L({ ko:`제일 지쳐 있는 건 <b>${nm}</b> 냥입니다 — 기력 ${e}.`,
                 en:`<b>${nm}</b> is the most worn out — energy ${e}.`,
                 ja:`<b>${nm}</b>がいちばん疲れています——気力${e}。` }));
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
    out.push(L({ ko:`지난 분기 건 ${over}개가 목록에 남아 있습니다.`,
                 en:`${over} item(s) from last quarter are still on the list.`,
                 ja:`前期の案件が${over}件、リストに残っています。` }));
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

  // 고양이별 몫을 여기서 같이 뽑는다 — 리포트에 쓸 "누가 제일 벌었나"가
  // 총합을 나누는 그 비율 자체여야 한다. 따로 계산하면 없는 얘기가 된다.
  const rates = S.cats.map(c => ({ c, r: catRate(c) }));
  const total = rates.reduce((a, x) => a + x.r, 0);
  const gain = Math.round(total * 0.55 * shopMul('offline', 1) * capped);
  S.anchovy += gain; S.stats.totalEarned += gain; S.stats.qEarned += gain;
  // 시계는 데스크탑 시각과 동기라 여기서 감을 필요가 없다

  const hrs = capped / 3600;
  const timeStr = hrs >= 1
    ? L({ ko: hrs.toFixed(1) + '시간', en: hrs.toFixed(1) + 'h', ja: hrs.toFixed(1) + '時間' })
    : L({ ko: Math.round(capped/60) + '분', en: Math.round(capped/60) + 'min', ja: Math.round(capped/60) + '分' });
  return { gain, timeStr, mins: capped / 60, story: offlineStory(gain, rates, total) };
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
