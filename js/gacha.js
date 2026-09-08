/* ══════════════════════════════════════════════════════════════════════════
   본사 택배 (TODO 57)

   무엇인가 — **본사에서 택배가 온다.** 뜯으면 가구나 멸치가 나오고, 꽝이면 벽돌이다.
   원래는 「가구 뽑기」였다. 겉만 바꾼 게 아니라 안에 든 것이 늘었다.

   ── 뜯는 데 드는 것은 **상자**다 ──
   멸치와 **별개 재화**다. 그래서 **멸치로 상자를 살 수 없다** — 그 길을 열어 두면
   상자는 멸치의 다른 이름일 뿐이고, 재화가 둘인 척하는 재화 하나가 된다.
   상자는 하루 한 번 무료 · 결재 10건마다 하나 · 누적 보상으로 온다.

   화면에 적는 이름은 **상자(📦)** 이고, 코드 안의 이름은 `tix` 그대로다 —
   저장에 들어 있는 칸이라 이름을 바꾸면 옛 저장이 그 칸을 잃는다. 보이는 말과
   저장의 열쇠는 다른 물건이고, 바꿔야 하는 것은 보이는 말 쪽이었다.
   (원화 패키지 칸은 여전히 비워 둔다 — 앱 안에서 돈을 받는 건 스토어 심사와
   등급분류가 딸린 별개의 결정이다. site/SELLING.md 의 무료 + 도네이션이 지금 정책이다.)

   대신 **멸치가 상자에서 나온다.** 방향이 뒤집힌 셈이다: 멸치로 상자를 사는 게 아니라
   상자로 멸치를 얻는다.

   ── 꽝은 왜 있나 ──
   앞판에는 꽝이 없었고 머리말이 그걸 자랑처럼 적어 뒀다 — 「뽑아서 손해 볼 수 있는 것이
   없다」. 그런데 **꽝이 없으면 ★1 이 꽝이 된다.** 싼 가구가 나오면 그게 실질적인 실패인데
   실패라고 말해 주지 않으니, 스물몇 종 중 싼 것들이 전부 「안 나왔으면 하는 것」이 된다.

   그래서 벽돌이 꽝의 자리를 맡는다. **벽돌은 재화가 아니다** — 모아서 뭘 사는 물건이
   아니라, 꽝이면 나오는 그것이다. 한때 열 개를 상자 하나로 바꿔 줬는데 그건 벽돌을
   느린 재화로 만드는 길이었다: 그러면 꽝이 꽝이 아니고, 상자에서 나오는 모든 것이
   결국 상자로 돌아온다. 꽝은 꽝이어야 다음 상자가 두근거린다.
   받은 개수는 세어서 적어만 둔다 — 쓰는 곳이 없는 숫자라 재화가 아니고, 농담의 눈금이다.
   톤에도 맞는다: 본사가 보낸 택배에 벽돌이 들어 있다는 건 62번의 그 이야기
   (이 회사가 사업이 아니라는 것)의 농담 판이다.

   ── 분류를 없앴다 ──
   앞판에는 업무·수납·데코·휴식을 골라 뽑는 칸이 있었다. **택배는 고를 수 없다.**
   그리고 고를 수 있으면 「멸치만 나오는 상자」를 고르게 되고, 그 순간 이건 상자가 아니라
   자판기다. 확률표는 그래서 한 벌이면 된다.

   등급은 값으로 읽는다 — ★3 460멸치↑ · ★2 220↑ · ★1 그 아래.
   가구가 아닌 것(멸치·벽돌)은 표에 등급을 직접 적는다(star).

   뽑은 것은 어디로 가나 — 가구는 **창고**다. 방에 바로 놓지 않는다: 자리가 없으면 놓기가
   실패하는데 그러면 뽑은 것이 사라지고, 무엇을 어디에 둘지는 배치 모드가 정할 일이다.
   창고는 새 상태가 아니다 — `가진 수(S.shop) − 방에 있는 수(격자)` 로 읽는다(js/cozy.js).
   ══════════════════════════════════════════════════════════════════════════ */

/* 등급 확률. 시안의 값 그대로다(★3 2.50% · ★2 20.00% · ★1 77.50%). */
const GA_ODDS = { 3: 0.025, 2: 0.20 };
/* 10연차의 확정은 **★2 이상**이다. 시안은 ★3 확정이었는데, 그러면 열 번마다
   소파가 하나씩 들어온다 — 뽑기의 ★3 이 「드물어서 좋은 것」이 아니라 「열 번의
   대가」가 되고, 그 순간부터 1회 뽑기를 누를 이유가 없어진다. 확정 등급을
   올리는 건 이 한 줄이다(GA_TEN_FLOOR = 3). */
const GA_TEN_FLOOR = 2;
const GA_MILE = [
  { at: 10,  tix: 2 },
  { at: 30,  tix: 5 },
  { at: 50,  tix: 8 },
  { at: 100, tix: 15 },
];

/* 옛 저장에는 이 칸이 없다 — 읽을 때 만든다. loadSave 를 건드리지 않는 이유는
   저장 형식을 바꾸면 v 를 올려야 하고, 지금 v 를 올리면 남의 사무실이 날아간다. */
function gaS(){
  if (!S.gacha || typeof S.gacha !== 'object') S.gacha = {};
  const g = S.gacha;
  if (typeof g.tix !== 'number') g.tix = 3;        // 처음 세 장은 그냥 준다 — 한 번은 당겨 봐야 안다
  if (typeof g.pulls !== 'number') g.pulls = 0;
  if (typeof g.free !== 'string') g.free = '';
  if (!Array.isArray(g.got)) g.got = [];
  if (typeof g.since !== 'number') g.since = 0;    // 결재 몇 건이 지났나 (10건마다 한 장)
  if (typeof g.brick !== 'number') g.brick = 0;   // 받은 벽돌 — 세기만 한다(재화가 아니다)
  return g;
}
/* ── 잔액은 **서버가 진짜다** (js/parcel.js) ──
   상자를 돈으로 팔기로 한 순간 이 숫자는 재화가 아니라 장부가 됐다. 그래서 서버가
   붙어 있으면 그쪽 값을 보고, 로그인 전이거나 오프라인이면 **로컬 저장이 그 자리를
   대신한다** — 게임의 나머지(사무실·결재)는 서버를 안 쓰므로 여기만 조용히 갈린다.
   두 잔액을 나중에 합치지는 않는다: 합치는 순간 구멍이 생긴다(parcel.js 머리말). */
const gaOn = () => { try { return !!(window.PARCEL && PARCEL.state().on); } catch (e){ return false; } };
const gaTix = () => gaOn() ? (PARCEL.state().balance | 0) : (gaS().tix | 0);
const gaBrick = () => gaOn() ? (PARCEL.state().bricks | 0) : (gaS().brick | 0);
const gaPulls = () => gaOn() ? (PARCEL.state().pulls | 0) : (gaS().pulls | 0);
/* 누적 보상을 **어디까지 받았는지는 이쪽이 안다.** 서버는 그 목록을 안 들고 있다
   (ticket_state 가 주는 것은 잔액·벽돌·누적횟수·무료날짜뿐이다). 그런데 예전에는
   서버가 붙어 있으면 PARCEL.state().got 를 읽었고, 그건 **없는 칸이라 늘 빈 목록**이었다.
   빈 목록은 「하나도 안 받았다」는 뜻이라, 뽑을 때마다 지나온 정거장이 전부 다시
   지급됐다 — 5연 한 판에 상자 33개가 공짜로 생겼다(spike/verify-beats.js 가 잡았다).
   서버가 이 목록을 갖게 되면 그때 여기를 고친다. 없는 값을 있는 척 읽지 않는다. */
const gaGot   = () => gaS().got || [];
/* 하루 한 번. 서버가 붙어 있으면 **서버의 날짜**로 센다 — 기기 시계로 재면
   시계를 돌려 여러 번 받는다. 로컬일 때는 게임의 날짜 키를 그대로 쓴다(sim.js dayKey). */
const gaFreeReady = () => gaOn() ? !!PARCEL.state().freeReady : (gaS().free !== dayKey());

const GA_S3 = 460, GA_S2 = 220;
/* 가구는 값이 등급이고, 가구가 아닌 것은 표에 등급을 직접 적는다(star).
   값으로만 읽으면 「멸치 200마리」가 값 0 인 물건이 되어 전부 ★1 로 떨어진다. */
const GA_STAR = it => it.star || (it.cost >= GA_S3 ? 3 : it.cost >= GA_S2 ? 2 : 1);

/* ── 상자에 든 것 ──
   가구(카탈로그) · 멸치 뭉치 · 벽돌. 셋이 한 표에 섞여 있고 분류는 없다 —
   택배는 고를 수 없다(위 머리말).

   **비품이 아니라 카탈로그다.** 비품(커피머신·복사기·정제실…)은 생산 배수를 갖고
   등급으로 잠겨 있다. 그걸 운으로 주면 분기를 넘겨 사무실을 넓히는 일이 의미를 잃고,
   가구를 고르는 이유가 「예뻐서」가 아니라 「효율 좋아서」가 된다. */
function gaFurn(){
  if (typeof SHOP === 'undefined' || typeof SHOP_TILE === 'undefined') return [];
  /* 칸이 있는 것만. 칸이 없으면 방에 세울 수가 없다.
     벽에 거는 것(wall)은 놓는 길이 따로라(ensureWallItem) 창고에서 못 꺼낸다. */
  return SHOP.filter(it => it.furn && it.furn !== 'wall' && SHOP_TILE[it.id] !== undefined)
             .map(it => ({ ...it, kind: 'furn' }));
}
/* 멸치 뭉치. 액수는 **가구 값과 같은 자리**에 놓는다 — 상자에서 나온 것끼리 비교가
   되어야 「이번엔 꽝에 가깝다」가 읽힌다. */
const GA_FISH = () => [
  { kind:'fish', id:'fish1', star:1, amount:120,  em:'🐟', n: L({ ko:'멸치 한 줌',   en:'A handful of anchovies', ja:'煮干しひとつかみ' }) },
  { kind:'fish', id:'fish2', star:2, amount:340,  em:'🐟', n: L({ ko:'멸치 한 봉지', en:'A bag of anchovies',     ja:'煮干し一袋' }) },
  { kind:'fish', id:'fish3', star:3, amount:900,  em:'🐟', n: L({ ko:'멸치 한 상자', en:'A case of anchovies',    ja:'煮干し一箱' }) },
];
/* 꽝. 표에 **네 장** 넣는다 — 한 장이면 스물몇 개 중 하나라 거의 안 나오고,
   그러면 「꽝이 있다」가 규칙이 아니라 소문이 된다.
   바꿔 주지 않는다: 벽돌은 재화가 아니라 꽝 그 자체다(머리말). */
const GA_BRICK = () => Array.from({ length: 4 }, (_, i) =>
  ({ kind:'brick', id:'brick' + i, star:1, em:'🧱',
     n: L({ ko:'벽돌', en:'A brick', ja:'レンガ' }) }));

function gaAll(){
  return [...gaFurn(), ...GA_FISH(), ...GA_BRICK()];
}
/* 분류가 없으므로 표는 한 벌이다. cat 인자는 옛 호출을 위해 남겨 두고 무시한다. */
function gaPool(){ return gaAll(); }
function gaBands(cat){
  const b = { 1: [], 2: [], 3: [] };
  gaPool(cat).forEach(it => b[GA_STAR(it)].push(it));
  return b;
}
/* 실제 확률. 비어 있는 등급의 몫은 **아래 등급으로 내려간다** — 분류를 좁히면
   그 안에 ★3 이 없을 수 있다(데코는 제일 비싼 것이 340멸치라 ★3 이 없다).
   그때 표에 2.5% 라고 적어 두고 안 나오면 그건 거짓말이다. */
function gaRates(cat){
  const b = gaBands(cat), r = { 1: 0, 2: 0, 3: 0 };
  let spill = 0;
  for (const s of [3, 2]){
    const w = GA_ODDS[s] + spill;
    if (b[s].length){ r[s] = w; spill = 0; } else spill = w;
  }
  r[1] = b[1].length ? 1 - r[2] - r[3] : 0;
  return r;
}
function gaRollOne(floor){
  const b = gaBands(), r = gaRates();
  let pick = 0;
  if (floor){
    /* 확정 뽑기 — floor 이상에서만 고른다. 그 위가 비어 있으면 floor 로 내려온다.
       확정 안에서도 등급 비율은 지킨다: 확정이 곧 최고 등급이 되면
       ★3 이 열 번마다 한 번씩 나온다. */
    const up = [3, 2, 1].filter(s => s >= floor && b[s].length);
    if (up.length){
      const tot = up.reduce((a, s) => a + (r[s] || 0.0001), 0);
      let x = Math.random() * tot;
      for (const s of up){ x -= (r[s] || 0.0001); if (x <= 0){ pick = s; break; } }
      if (!pick) pick = up[up.length - 1];
    }
  }
  if (!pick){
    let x = Math.random();
    for (const s of [3, 2, 1]){ x -= r[s]; if (x <= 0 && b[s].length){ pick = s; break; } }
    if (!pick) pick = b[1].length ? 1 : (b[2].length ? 2 : 3);
  }
  const arr = b[pick];
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
/* **상자를 멸치로 팔지 않는다.** 앞판에는 「기대값 × 0.9」로 값을 매겨 파는 칸이 있었다.
   그 길을 열어 두면 상자는 멸치의 다른 이름이고, 별개 재화라는 말이 거짓이 된다.
   대신 멸치는 **상자에서 나온다**(GA_FISH) — 방향이 뒤집혔다. */

/* 상자에서 나온 것을 준다. 가구는 **창고**로 — 격자를 안 건드리므로 실패할 수 없다.
   방에 바로 놓으면 자리가 없을 때 뽑은 것이 사라진다(buyItem 이 실제로 그렇게 실패한다). */
function gaGrant(it){
  if (it.kind === 'fish'){
    S.anchovy += it.amount;
    if (S.stats){ S.stats.qEarned += it.amount; S.stats.totalEarned += it.amount; }
    return;
  }
  /* 벽돌은 세어만 둔다. 쓰는 곳이 없다 — 몇 개 받았는지 적어 두는 눈금이다. */
  if (it.kind === 'brick'){ gaS().brick = (gaS().brick | 0) + 1; return; }
  S.shop[it.id] = (typeof shopCount === 'function' ? shopCount(it.id) : (S.shop[it.id] | 0)) + 1;
}

function gaPull(n, opts){
  const g = gaS();
  const free = !!(opts && opts.free);
  if (free && !gaFreeReady()) return null;
  if (!free && g.tix < n) return null;
  if (!gaPool().length) return null;

  if (free) g.free = dayKey(); else g.tix -= n;
  const out = [];
  /* 확정은 **뽑는 중에 이미 나왔는지** 보고 마지막 한 장에만 건다. 처음에 마지막
     칸을 무조건 확정으로 만들었더니, 앞에서 ★3 이 나온 판도 끝에서 또 하나를
     끼워 줘서 열 번에 둘이 됐다. */
  for (let i = 0; i < n; i++){
    const last = i === n - 1;
    const need = n >= 10 && last && !out.some(x => GA_STAR(x) >= GA_TEN_FLOOR);
    const it = gaRollOne(need ? GA_TEN_FLOOR : 0);
    if (!it) break;
    out.push(it);
    gaGrant(it);
  }
  g.pulls += out.length;
  /* 누적 보상은 뽑은 자리에서 바로 준다 — 「받기」 단추를 하나 더 만들면
     그건 보상이 아니라 심부름이다. */
  GA_MILE.forEach(x => {
    if (g.pulls < x.at || gaGot().includes(x.at)) return;
    g.got.push(x.at);
    g.tix += x.tix;
    if (typeof pushLog === 'function') pushLog(L({
      ko: `누적 ${x.at}상자 — <b>📦 상자 ${x.tix}개</b>가 더 왔습니다.`,
      en: `${x.at} opened — <b>📦 ${x.tix} more box(es)</b> arrived.`,
      ja: `累計${x.at}回 — <b>チケット${x.tix}枚</b>が届きました。`,
    }), 'good');
  });
  save();
  return out;
}

/* ── 서버가 굴린다 ──
   `gaPull` 은 이제 **서버가 없을 때의 길**이다. 서버가 붙어 있으면 추첨도 저쪽에서
   한다 — 확률을 공시해 놓고 이쪽에서 굴리면 그 표는 증명할 수 없는 숫자가 된다.

   서버는 **무엇이 나왔는지만** 돌려준다. 그것을 어디에 넣을지(가구는 창고, 멸치는
   잔고)는 게임의 규칙이라 여기서 그대로 한다 — 서버가 그 규칙을 또
   알 이유가 없다. 벽돌만 예외다: 세는 곳이 서버라 여기서 또 세면 두 번 센다. */
async function gaOpen(n, opts){
  if (!gaOn()) return gaPull(n, opts);
  const r = await PARCEL.open(n, opts);
  if (!r || !r.ok) return null;
  const byId = {};
  gaAll().forEach(it => { byId[it.id] = it; });
  const out = [];
  (r.items || []).forEach(x => {
    const it = byId[x.id];
    if (!it) return;                      // 서버 풀이 더 새것이다 — 모르는 것은 조용히 건너뛴다
    out.push(it);
    if (it.kind !== 'brick') gaGrant(it);
  });
  (r.granted || []).forEach(x => {
    if (typeof pushLog !== 'function') return;
    pushLog(L({
      ko: `누적 ${x.at}상자 — <b>📦 상자 ${x.tix}개</b>가 더 왔습니다.`,
      en: `${x.at} opened — <b>📦 ${x.tix} more box(es)</b> arrived.`,
      ja: `累計${x.at}回 — <b>チケット${x.tix}枚</b>が届きました。`,
    }), 'good');
  });
  save();
  return out;
}

/* ── 결재가 뽑기권을 만든다 ──
   하루 무료 한 번만 두면 뽑기가 게임 밖의 일이 된다. 결재는 이 게임의 유일한
   본업이므로 거기에 붙인다 — 10건마다 한 장. */
if (typeof bus !== 'undefined' && bus.on) bus.on('reward', () => {
  const g = gaS();
  g.since = (g.since | 0) + 1;
  if (g.since < 10) return;
  g.since = 0;
  g.tix += 1;
  if (typeof toast === 'function') toast(L({
    ko: '결재 10건 — 본사에서 <b>📦 택배 상자</b> 하나가 왔습니다.',
    en: '10 approvals — a <b>📦 parcel</b> arrived from HQ.',
    ja: '決裁10件 — 本社から<b>📦 宅配の箱</b>が1つ届きました。',
  }));
});

/* ══════════════════ 화면 ══════════════════ */
const gaEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gaStars = n => '<span class="gastars">' + '★'.repeat(n) + '</span>';
/* 그림은 **실제 그 가구**다 — 아이콘이 아니다. 게임이 방에 세우는 물건을 한 장
   굽는다(render3d.js furnPortrait). 못 구우면 상점의 이모지로 내려간다. */
function gaImg(it, size){
  try {
    if (!window.R3 || !R3.furnPortrait || typeof SHOP_TILE === 'undefined') return null;
    const t = SHOP_TILE[it.id];
    if (t === undefined) return null;
    return R3.furnPortrait(t, size) || null;
  } catch (e) { return null; }
}
const gaCell = (it, size) => {
  const u = gaImg(it, size);
  return u ? `<img class="gafurn" src="${u}" alt="">` : `<span class="gafurn gafurn--em">${it.em}</span>`;
};
/* 아이콘은 폰 스킨이 그린다(js/cozy.js 가 window.CCIcon 을 내놓는다). 없으면
   그냥 빈 칸으로 둔다 — 이모지로 내려가면 이 화면에서 혼자 다른 그림체가 된다. */
function gaIcons(root){
  if (!window.CCIcon) return;
  root.querySelectorAll('[data-ga]').forEach(el => CCIcon(el, el.dataset.ga));
}

/* ── 확률표에 **확정과 누적까지** 적는다 ──
   상자를 돈으로 사기로 하면(TODO 57) 이 화면은 친절이 아니라 **의무**가 된다.
   게임산업법의 확률형 아이템은 「직접적·간접적으로 유상으로」 사는 것을 다 포함해서,
   상자를 파는 것과 상자를 여는 재화를 파는 것이 법적으로 같다. 스토어도 같은 것을
   요구한다(애플 3.1.1 · 구글플레이) — 구매 전에 보여야 한다.

   그래서 등급 확률만으로는 모자란다: **10연 확정**과 **누적 보상**도 「우연이 아닌
   약속」이라 같이 적어야 표가 완성된다. 값은 전부 위의 상수에서 읽는다 —
   손으로 옮겨 적으면 코드를 고쳤을 때 표만 옛날 말을 한다. */
/* 상자를 파는 칸. **STORE 가 켜졌을 때만** 그린다(js/store.js) — 웹에서도, 스토어
   계정이 서기 전에도 이 칸은 아예 없다. 값은 스토어가 말하는 문자열 그대로 쓴다:
   통화도 자릿수도 나라마다 다르고, 그걸 게임이 계산하면 반드시 어딘가 틀린다. */
function gaShopHTML(){
  const st = window.STORE && STORE.state();
  /* **앱에서 안 뜨면 이유를 적는다.** 웹에서는 원래 안 파는 게 맞아서 조용한 것이
     맞지만, 앱에서 칸이 사라지면 「고장인지 아직 준비가 안 된 건지」를 구분할 방법이
     없다 — 실제로 아이폰에서 그 자리에서 막혔다(2026-09-08). 스토어와 서버 중
     어디가 아직인지는 `why` 가 안다. */
  if (!st || !st.on || !st.items.length){
    const native = (() => { try {
      const c = window.Capacitor;
      return !!(c && (c.isNativePlatform ? c.isNativePlatform() : c.getPlatform));
    } catch (e){ return false; } })();
    if (!native) return '';
    const why = (st && st.why) || '아직 준비되지 않았습니다';
    return `<div class="gashop"><div class="gashophead">${L({
        ko: '상자 사기', en: 'Buy boxes', ja: '箱を買う' })}</div>
      <div class="tiny" style="opacity:.6">${esc(why)}</div></div>`;
  }
  return `<div class="gashop">
    <div class="gashophead">${L({ ko: '상자 사기', en: 'Buy boxes', ja: '箱を買う' })}</div>
    <div class="gashoprow">${st.items.map(x => `
      <button class="gashopbtn" data-buy="${esc(x.id)}">
        <b><span class="gaem">📦</span> ${x.boxes}</b>
        <i>${esc(x.price)}</i></button>`).join('')}</div>
    <div class="gashopfoot">
      <button class="gashopres" data-restore>${L({
        ko: '구매 복원', en: 'Restore purchases', ja: '購入を復元' })}</button>
      <button class="gashopres" data-payinfo>${L({
        ko: '결제 전에 읽어 주세요', en: 'Before you buy', ja: 'purchase の前に' })}</button>
    </div>
  </div>`;
}

/* 결제 안내와 구매 내역. **새 판을 안 짜고** 확률 정보와 같은 자리에 같은 모양으로 뜬다.

   왜 있어야 하나: 상자는 소모품이라 뜯으면 되돌릴 수 없는데, **그 사실을 미리 알려야**
   전자상거래법의 청약철회 예외가 성립한다. 미성년자 결제 안내도 결제하는 자리 가까이에
   있어야 하고, 스토어 심사(App Store 3.1.1 · Google Play)도 결제 전 고지와 문의 경로를
   본다. 상자 세 개와 복원 링크만 있으면 그 어느 것도 없는 화면이다. */
function showPayInfo(){
  const mail = (window.STORE && STORE.contact && STORE.contact()) || '';
  const m = modal(`
    <div class="mhead"><div class="q">PAYMENT</div>
      <h3>${L({ ko: '결제 전에', en: 'Before you buy', ja: '購入の前に' })}</h3>
      <p>${L({ ko: '결제는 스토어가 처리합니다. 카드 정보는 이 게임에 오지 않습니다.',
               en: 'The store handles payment. Card details never reach this game.',
               ja: '決済はストアが処理します。カード情報はこのゲームに届きません。' })}</p></div>
    <div class="mbody">
      <div class="paylist" id="payNotes"></div>
      <div class="gamhead" style="margin-top:14px"><b>${L({
        ko: '구매 내역', en: 'Purchases', ja: '購入履歴' })}</b></div>
      <div class="paylog" id="payLog">${L({
        ko: '불러오는 중…', en: 'Loading…', ja: '読み込み中…' })}</div>
      <div class="tiny" style="margin-top:10px">${mail ? `${L({
        ko: '문의', en: 'Contact', ja: 'お問い合わせ' })}
        <a href="mailto:${esc(mail)}?subject=${encodeURIComponent('Copycat 결제 문의')}">${esc(mail)}</a>` : ''}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({
      ko: '닫기', en: 'Close', ja: '閉じる' })}</button></div>`);

  /* 안내를 배열로 두는 이유: 한 줄씩 늘거나 줄기 때문이다(스토어 정책은 바뀐다). */
  const NOTES = [
    L({ ko: '상자는 <b>소모품</b>입니다. 한 번 뜯으면 되돌릴 수 없습니다.',
        en: 'Boxes are <b>consumable</b>. Once opened they cannot be undone.',
        ja: '箱は<b>消耗品</b>です。開けたら戻せません。' }),
    L({ ko: '환불은 <b>스토어를 통해</b> 신청합니다 — 애플 또는 구글이 직접 처리합니다.',
        en: 'Refunds go <b>through the store</b> — Apple or Google handles them.',
        ja: '返金は<b>ストア経由</b>です — Apple または Google が処理します。' }),
    L({ ko: '미성년자는 <b>법정대리인의 동의</b>가 필요합니다. 동의 없이 한 결제는 취소할 수 있습니다.',
        en: 'Minors need <b>a guardian’s consent</b>. Purchases made without it can be cancelled.',
        ja: '未成年者は<b>法定代理人の同意</b>が必要です。同意なき決済は取り消せます。' }),
    L({ ko: '무엇이 들었는지는 <b>확률 정보</b>에 적혀 있습니다.',
        en: 'What is inside is listed under <b>Odds</b>.',
        ja: '中身の確率は<b>確率情報</b>にあります。' }),
  ];
  const box = m.veil.querySelector('#payNotes');
  if (box) box.innerHTML = NOTES.map(t => `<div class="payrow">${t}</div>`).join('');

  /* 내역은 **서버에서** 읽는다(PARCEL.history) — 게임이 따로 센 숫자를 보여 주면
     그건 증거가 아니라 주장이다. */
  const log = m.veil.querySelector('#payLog');
  const paint = rows => {
    if (!log || !log.isConnected) return;
    if (!rows.length){
      log.textContent = L({ ko: '아직 없습니다.', en: 'None yet.', ja: 'まだありません。' });
      return;
    }
    log.innerHTML = rows.map(r => {
      const d = new Date(r.created_at);
      const day = isNaN(d) ? '' : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
      return `<div class="payitem"><span>${esc(day)}</span>
        <b><span class="gaem">📦</span> ${r.boxes | 0}</b>
        <i>${esc(r.product_id || '')}</i></div>`;
    }).join('');
    gaIcons(m.veil);
  };
  if (window.PARCEL && PARCEL.history) PARCEL.history().then(paint).catch(() => paint([]));
  else paint([]);
  return m;
}

function gaGuaranteeHTML(){
  const r = gaRates();
  const top = [3, 2, 1].find(s => r[s] > 0) || 1;
  const floor = Math.min(GA_TEN_FLOOR, top);
  const mile = GA_MILE.map(x => L({
    ko: `${x.at}회 → 상자 ${x.tix}개`,
    en: `${x.at} → ${x.tix} boxes`,
    ja: `${x.at}回 → 箱${x.tix}個`,
  })).join(' · ');
  return `<div class="garow"><div class="galeft"><b>${L({
      ko: '열 상자 확정', en: 'Ten-box guarantee', ja: '10箱の確定' })}</b></div>
      <div class="garate">★${floor}↑</div></div>
    <div class="gapool">${L({
      ko: `한 번에 열 상자를 뜯으면 ★${floor} 이상이 하나는 나옵니다. 확정이 걸려도 그 안에서 등급 비율은 위 표를 따릅니다.`,
      en: `Opening ten at once guarantees at least one ★${floor}+. Within the guarantee the grade split still follows the table above.`,
      ja: `10箱まとめて開けると★${floor}以上が1つ確定します。確定の中でも等級比率は上の表に従います。` })}</div>
    <div class="garow"><div class="galeft"><b>${L({
      ko: '누적 보상', en: 'Milestones', ja: '累計報酬' })}</b></div>
      <div class="garate">${GA_MILE.length}</div></div>
    <div class="gapool">${mile}</div>`;
}

function showGachaOdds(){
  const r = gaRates(), b = gaBands();
  const NAME = {
    3: L({ ko: '고급', en: 'Prime',  ja: '高級' }),
    2: L({ ko: '일반', en: 'Rare',   ja: '普通' }),
    1: L({ ko: '보통', en: 'Common', ja: 'ふつう' }),
  };
  const row = s => `<div class="garow">
      <div class="galeft">${gaStars(s)} <b>${NAME[s]}</b></div>
      <div class="garate">${(r[s] * 100).toFixed(2)}%</div>
    </div>
    <div class="gapool">${b[s].length
      ? b[s].map(it => `${gaEsc(it.n)}${it.cost ? ` <em>${it.cost}</em>` : ''}`).join(' · ')
      : L({ ko: '이 분류에는 이 등급의 가구가 없습니다',
            en: 'This category has nothing at this grade',
            ja: 'この分類にこの等級の家具はありません' })}</div>`;
  const m = modal(`
    <div class="mhead"><div class="q">ODDS</div>
      <h3>${L({ ko: '확률 정보', en: 'Drop Rates', ja: '確率情報' })}</h3>
      <p>${L({ ko: '가구는 값으로 등급이 나뉩니다 — ★3 460멸치 이상, ★2 220 이상. 그 밖의 것은 정해진 등급입니다.',
               en: 'Furniture grades follow the price — ★3 from 460, ★2 from 220. Everything else has a fixed grade.',
               ja: '家具は値段で等級が決まります — ★3は460以上、★2は220以上。それ以外は決まった等級です。' })}</p></div>
    <div class="mbody">
      ${[3, 2, 1].map(row).join('')}
      ${gaGuaranteeHTML()}
      <div class="tiny">${L({
        ko: '고른 분류에 그 등급이 없으면 확률은 아래 등급으로 내려갑니다. 가구는 전부 쾌적도 +1 로 효과가 같습니다 — 등급은 값과 생김새의 차이입니다.',
        en: 'If the chosen category has no such grade, those odds fall to the grade below. Every piece gives the same comfort +1 — grade is price and looks, not power.',
        ja: '選んだ分類にその等級がなければ確率は下の等級に下がります。家具の効果はすべて快適度+1で同じです。' })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko: '닫기', en: 'Close', ja: '閉じる' })}</button></div>`);
  gaIcons(m.veil);
}

/* ── 뜯는 장면(3D 가 없을 때) ──
   상자를 뜯으면 결과가 **바로** 뜬다. 그게 이 화면에서 제일 아쉬운 자리였다:
   뽑기의 재미는 결과가 아니라 **결과가 나오기 직전의 1.5초**에 있는데, 그 1.5초가 없다.

   그래서 짧은 장면 하나를 끼운다. **고양이가 상자를 뜯는다** — 앞발로 테이프를 긁고,
   테이프가 뜯기고, 뚜껑이 벌어지고, 그 안에서 빛이 한 번 샌다. 그다음에 결과 창이 뜬다.
   상자에서 고양이가 나오는 게 아니다 — 그건 다른 이야기다.

   ── 왜 영상 파일이 아닌가 ──
   이 게임의 배포 방식이 **파일 한 장**이다(tools/pack-single.js). 영상이나 gif 를 실으면
   그 파일이 통째로 커지고, 무엇보다 이 저장소는 그림을 코드로 그린다(프롤로그도
   실시간 폴리곤이다 — js/three/opening.js). 그래서 상자·앞발·테이프·빛은 div 와 CSS 로 그리고,
   고양이만 **이미 있는 그림**을 쓴다: assets/loading-cat.png — 로딩 화면의 그 고양이이고,
   시작화면 로고의 고양이와 같은 고양이다(둘 다 게임의 렌더러가 구운 것이다).
   로고 컷(logo-cat.png)은 **머리만** 잘린 그림이라 상자 뒤에 두면 어깨 없이 떠 있는 머리가 된다.
   앞발 둘은 따로 그린다 — 그림 속 앞다리는 상자에 가려 안 보이고, 무엇보다 움직여야 한다.

   ── 건너뛸 수 있다 ──
   누르면 그 자리에서 결과로 간다. 못 건너뛰는 연출은 두 번째부터 벌이다 —
   하루에 열 번 누르는 물건이라 더 그렇다(프롤로그·아웃트로와 같은 규칙). */
/* 발바닥 도장 하나. 폰 스킨이 쓰는 그 길과 같은 그림이다(js/cozy.js 의 paw) —
   같은 발바닥이 사방에서 다르게 생기면 그건 두 마리다. 여기서는 상자에 찍힌 도장이라
   한 벌만 있으면 되므로 길만 옮겨 둔다. */
const GA_PAW_D = 'M6.3 6.5c1.1-.3 2.4.6 2.8 2s-.1 2.7-1.2 3-2.4-.6-2.8-2 .1-2.7 1.2-3Zm11.4 0c1.1.3 1.6 1.6 1.2 3s-1.7 2.3-2.8 2-1.6-1.6-1.2-3 1.7-2.3 2.8-2ZM12 4.3c1.3 0 2.3 1.3 2.3 2.9S13.3 10 12 10 9.7 8.8 9.7 7.2 10.7 4.3 12 4.3Zm0 7.3c2.7 0 4.9 2.2 4.9 5 0 2-1.3 3.4-3.1 3.4-1.1 0-1.6-.4-1.8-.4s-.7.4-1.8.4c-1.8 0-3.1-1.4-3.1-3.4 0-2.8 2.2-5 4.9-5Z';

/* 누가 뜯나 — **대표**다(플레이어의 그 고양이). 없으면 아무나, 그것도 없으면 마스코트.
   이름을 부르려고 고르는 것이 아니라, 그림을 그 고양이로 굽기 위해서다. */
function gaOpenCat(){
  const list = (typeof S !== 'undefined' && S.cats) || [];
  return list.find(c => c.founder) || list[0] || null;
}
/* 한글 조사. 「치즈가」와 「팥죽이」를 둘 다 맞히려면 받침을 봐야 한다.
   한글이 아닌 이름(영문·일문)에는 붙이지 않는다 — 「Momo가」는 어느 쪽이든 틀린다. */
function gaSubjectJosa(name){
  const ch = String(name || '').trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (!(c >= 0xAC00 && c <= 0xD7A3)) return '';
  return ((c - 0xAC00) % 28) ? '이' : '가';
}

const GA_OPEN_MS = 2050;

/* ── 뜯는 장면은 **3D 다** ──
   상자도 사무실도 고양이도 진짜다. 카메라가 방으로 들어와 그 냥이의 책상에 내려앉고,
   고양이가 앞발로 상자를 까딱까딱 두드리고, 뚜껑이 젖혀지며 안에서 빛이 샌다.
   장면은 js/three/parcel.js 가 짜고 여기서는 **시계와 화면 위의 것**만 맡는다:
   말풍선 · 상자 개수 · 건너뛰기. 프롤로그·아웃트로와 같은 나눔이다.

   3D 가 없으면(손그림 그림체 · 옛 기기) 아래 gaOpeningFlat 로 내려간다 — 없는 것을
   있는 척하지 않는다. */
function gaOpening(items, onDone){
  const cats = (typeof S !== 'undefined' && S.cats) || [];
  const can = typeof is3d === 'function' && is3d()
           && window.R3 && R3.ready && R3.parcelBuild && cats.length;
  if (!can){
    window.__gaWhy = '3D 가 아니다: is3d ' + (typeof is3d === 'function' && is3d())
      + ' · ready ' + !!(window.R3 && R3.ready)
      + ' · api ' + !!(window.R3 && R3.parcelBuild) + ' · 고양이 ' + cats.length;
    return gaOpeningFlat(items, onDone);
  }

  let info = null;
  /* **두 번 해 본다.** 방이 막 다시 세워졌으면 배우가 아직 없을 수 있다(sync 가 한 틱
     뒤에 만든다). 한 번 실패했다고 바로 평면으로 내려가면 그 한 틱 때문에 컷신이 사라진다. */
  for (let k = 0; k < 2 && !info; k++){
    try { info = R3.parcelBuild(cats); }
    catch (e) { info = null; window.__gaWhy = '터졌다: ' + (e && e.message); }
    if (!info && k === 0){ try { R3.sync(S.cats, [], 0.016); } catch (e) {} }
  }
  if (!info){
    /* **왜 내려갔는지 남긴다.** 조용한 폴백은 「어느 날 갑자기 예전 2D 가 나온다」로
       나타나고, 그때 물어볼 곳이 없으면 처음부터 다시 재야 한다. */
    window.__gaWhy = window.__gaWhy || (window.R3 && R3.parcelWhy && R3.parcelWhy()) || '알 수 없음';
    return gaOpeningFlat(items, onDone);
  }
  window.__gaWhy = '';

  const boxes = (items && items.length) || 1;
  const root = document.createElement('div');
  root.className = 'gaopen gaopen--3d';
  root.innerHTML =
      `<div class="gaosay">${L({
          ko: `<b>${gaEsc(info.name)}</b>${gaSubjectJosa(info.name)}<br>상자를 열고 있어요…`,
          en: `<b>${gaEsc(info.name)}</b> is<br>opening the box…`,
          ja: `<b>${gaEsc(info.name)}</b>が<br>箱を開けています…` })}</div>`
    + (boxes > 1
        ? `<div class="gaodots">${Array.from({ length: Math.min(boxes, 10) },
            (_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>`
        : '')
    + `<div class="gaoskip">${L({ ko:'눌러서 건너뛰기', en:'tap to skip', ja:'タップでスキップ' })}</div>`;
  document.body.appendChild(root);
  /* 방만 남긴다 — 상단 바·탭 바·결재함·말풍선까지 전부 걷는다(style.css 의 body.gacut).
     컷신 위에 게임 UI 가 얹혀 있으면 그건 컷신이 아니라 카메라가 움직인 게임 화면이다. */
  document.body.classList.add('gacut');

  const dots = [...root.querySelectorAll('.gaodots i')];
  let raf = 0, gone = false;
  const done = () => {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    clearInterval(tick);
    root.remove();
    document.body.classList.remove('gacut');
    try { R3.parcelStop(); } catch (e) {}
    onDone();
  };
  root.addEventListener('click', done);

  /* 두구두구 — 이미 있는 소리로만 낸다. 두드리는 동안 짧게 여러 번, 열릴 때 한 번. */
  let n = 0;
  const tick = setInterval(() => {
    n++;
    if (n > 8){ clearInterval(tick); return; }
    try { sfx.add(); } catch (e) {}
  }, 130);
  setTimeout(() => { try { sfx.coin(); } catch (e) {} }, 2400);

  /* 컷신의 시계는 **벽시계**다. 프레임 사이 dt 를 쌓으면 느린 기기에서 장면이
     슬로모션으로 늘어진다(아웃트로에서 겪은 그것 — js/story.js 의 같은 주석). */
  const t0 = performance.now();
  let last = t0;
  const step = now => {
    if (gone) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    try { R3.parcelSeek(t, dt); R3.draw(); } catch (e) { done(); return; }
    /* 점은 장면이 지나가는 만큼 켜진다 — 몇 상자를 뜯는 중인지가 여기서만 보인다 */
    if (dots.length){
      const k = Math.min(1, t / info.dur);
      dots.forEach((d, i) => d.classList.toggle('on', i <= Math.floor(k * (dots.length - 1))));
    }
    if (t >= info.dur){ done(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
function gaOpeningFlat(items, onDone){
  const boxes = (items && items.length) || 1;
  const done = () => {
    if (!root || root.__gone) return;
    root.__gone = true;
    clearTimeout(timer);
    clearInterval(tick);
    root.remove();
    onDone();
  };
  const root = document.createElement('div');
  root.className = 'gaopen';
  /* 겹 순서가 이 장면의 전부다: 고양이 → 상자 → 앞발.
     고양이 가슴 아래를 상자가 가려야 「상자 뒤에 앉아서 뜯는」으로 읽힌다. */
  const cat = gaOpenCat();
  /* 그림은 **그 고양이**를 굽는다 — 앉은 자세·뜬 눈(render3d.js portrait).
     못 구우면 마스코트로 내려간다: 로딩 화면의 그 고양이이고 로고와 같은 고양이다. */
  let pic = null, paw = '#241d1f';
  try {
    if (cat && window.R3 && R3.portrait && typeof is3d === 'function' && is3d()){
      pic = R3.portrait(cat, 320, { pose:'sit', eyeMode:0 });
      /* 털색 **그대로**는 안 쓴다. 앞발은 몸에 붙어 그늘에 있는 부위라, 밝은 털을
         그대로 칠하면 상자 위에 분홍 덩어리 둘이 얹힌다(실측). 0.66 배로 깎는다. */
      const f = R3.catFur && R3.catFur(cat);
      if (typeof f === 'number'){
        const dim = v => Math.max(0, Math.round(v * 0.66));
        paw = 'rgb(' + [dim((f >> 16) & 255), dim((f >> 8) & 255), dim(f & 255)].join(',') + ')';
      }
    }
  } catch (e) {}
  if (!pic) pic = assetURL('assets/loading-cat.png');

  const name = cat ? gaEsc(cat.name) : L({ ko:'고양이', en:'A cat', ja:'ねこ' });
  const say = L({
    ko: `<b>${name}</b>${gaSubjectJosa(cat && cat.name)}<br>상자를 열고 있어요…`,
    en: `<b>${name}</b> is<br>opening the box…`,
    ja: `<b>${name}</b>が<br>箱を開けています…`,
  });
  /* 반짝임 여덟. 자리와 박자를 인라인으로 흩는다 — 표로 만들면 여덟 개가 같은 별이 된다. */
  const SP = [[12,26],[80,20],[6,58],[90,54],[26,8],[68,4],[46,70],[88,76]];
  const sparks = SP.map(([x, y], i) =>
    `<div class="gaosp" style="left:${x}%;top:${y}%;font-size:${11 + (i % 3) * 3}px;`
    + `animation-delay:${(i * 0.19).toFixed(2)}s">✦</div>`).join('');
  const dots = boxes > 1
    ? `<div class="gaodots">${Array.from({ length: Math.min(boxes, 10) },
        (_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>`
    : '';

  root.innerHTML =
      '<div class="gaobg"></div>'
    + `<div class="gaosay">${say}</div>`
    + sparks
    + '<div class="gaostage">'
    +   `<img class="gaocat" src="${pic}" alt="">`
    +   '<div class="gaobox">'
    +     '<div class="gaobk"></div>'
    +     '<div class="gaoflap l"></div><div class="gaoflap r"></div>'
    +     `<div class="gaofr"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${GA_PAW_D}"/></svg></div>`
    +     '<div class="gaotp l"></div><div class="gaotp r"></div>'
    +     '<div class="gaoburst"></div>'
    +   '</div>'
    +   `<div class="gaopaw l" style="--paw:${paw}"></div>`
    +   `<div class="gaopaw r" style="--paw:${paw}"></div>`
    + '</div>'
    + dots
    + `<div class="gaoskip">${L({ ko:'눌러서 건너뛰기', en:'tap to skip', ja:'タップでスキップ' })}</div>`
    /* **왜 평면으로 내려왔는지 그 자리에 적는다.** 조용한 폴백은 「어느 날 갑자기 예전
       것이 나온다」로 나타나고, 폰에서는 콘솔을 열 수가 없어서 물어볼 곳이 없다.
       (임시다 — 원인이 잡히면 이 줄은 지운다.) */
    + (window.__gaWhy ? `<div class="gaowhy">평면으로 내려왔습니다 — ${gaEsc(window.__gaWhy)}</div>` : '');
  document.body.appendChild(root);
  root.addEventListener('click', done);

  /* 두구두구 — 소리는 이미 있는 것으로만 낸다. 새 소리를 만들면 이 장면만
     다른 악기를 쓰게 된다. 떨리는 동안 짧게 여러 번, 열릴 때 한 번. */
  let n = 0;
  const tick = setInterval(() => {
    n++;
    if (n > 7){ clearInterval(tick); return; }
    try { sfx.add(); } catch (e) {}
  }, 110);
  setTimeout(() => { try { sfx.coin(); } catch (e) {} }, 980);

  const timer = setTimeout(done, GA_OPEN_MS);
}

/* 결과 한 줄. 「N개가 창고로」는 이제 거짓말이다 — 상자에서 넷이 나오고
   가는 곳이 다 다르다. 갈래별로 세어서 그대로 적는다. */
function gaResultLine(items){
  const n = k => items.filter(x => x.kind === k).length;
  const furn = n('furn'), brick = n('brick');
  const fish = items.filter(x => x.kind === 'fish').reduce((a, x) => a + x.amount, 0);
  const bits = [];
  if (furn)  bits.push(L({ ko:`가구 ${furn}개는 창고로`, en:`${furn} to storage`, ja:`家具${furn}個は倉庫へ` }));
  if (fish)  bits.push(L({ ko:`멸치 ${fmt(fish)}`,       en:`🐟 ${fmt(fish)}`,    ja:`煮干し${fmt(fish)}` }));
  if (brick) bits.push(L({ ko:`벽돌 ${brick}개`,         en:`${brick} brick(s)`,  ja:`レンガ${brick}個` }));
  return bits.join(' · ') || L({ ko:'…비어 있었습니다.', en:'…it was empty.', ja:'……空でした。' });
}

/* ══════════════════ 개봉 결과 ══════════════════

   ── 레퍼런스에서 가져온 것 ──
   본 그림 셋(뜯는 장면 · 하나 얻었을 때 · 열 개 얻었을 때)에서 공통으로 읽힌 것:

     1. **띠 제목** — 창 제목이 아니라 끝이 파인 리본이 위에 걸린다. 「지금은 잔치다」를
        글자보다 먼저 말한다.
     2. **단 위의 물건** — 물건 하나를 크게 세우고 발밑에 타원 빛, 뒤로 빛살.
        목록의 한 칸이 아니라 **무대에 선 하나**다.
     3. **그래서 뭐가 달라지나** — 이름 밑에 별, 그 밑에 효과 줄. 이름만 있으면
        「좋은 건가?」가 남는다.
     4. **색종이** — 잠깐, 위에서만.
     5. 여럿일 때는 **크림 카드 격자에 별 줄**. 하나하나 무대에 세우지 않는다.

   ── 안 가져온 것 ──
   레퍼런스의 효과 줄은 「업무 효율 +2%」 같은 능력치다. 이 게임의 가구는 전부
   쾌적도 +1 로 **효과가 같다**(등급은 값과 생김새의 차이다 — 확률표에도 그렇게 적혀 있다).
   그러니 여기서 숫자를 만들어 적으면 그건 거짓말이 된다. 대신 **진짜인 것**을 적는다:
   어디로 가는지, 무엇이 되는지.

   ── 왜 modal() 이 아닌가 ──
   modal 은 스킨을 따른다(폰에서는 크림 카드). 이 화면은 제 색을 들고 있어야 해서
   (style.css 의 .gawin 머리말) 따로 세운다. 대신 modal 이 주던 것 — 바깥을 눌러
   닫기 · Esc — 는 여기서 다시 해 준다. 결과를 실수로 닫는 건 나쁘므로 **바깥 누르기는
   안 닫는다.** 단추로만 닫는다. */

const GA_CONF = ['#F0B95A', '#E8734A', '#7FB77E', '#E6C9A8', '#C98AE0', '#6FAEDB'];

/* 색종이 열네 조각. 자리와 시각을 흩어 놓는다 — 같이 떨어지면 그건 색종이가 아니라 커튼이다. */
function gaConfetti(){
  let h = '<div class="rvconf">';
  for (let i = 0; i < 14; i++){
    const x = Math.round(4 + Math.random() * 92);
    const d = (Math.random() * 1.1).toFixed(2);
    const t = (1.5 + Math.random() * 1.4).toFixed(2);
    const c = GA_CONF[i % GA_CONF.length];
    h += `<i style="left:${x}%;background:${c};animation-duration:${t}s;animation-delay:${d}s"></i>`;
  }
  return h + '</div>';
}

/* 별 줄. **빈 별도 그린다** — ★ 하나만 있으면 그게 최고인지 최저인지 모른다. */
const gaStarRow = (n, cls) => `<span class="${cls || 'rvstars'}">`
  + '★'.repeat(n) + `<i>${'★'.repeat(Math.max(0, 3 - n))}</i></span>`;

/* 그 물건이 실제로 무엇이 되는지. 지어내지 않는다 — 게임이 진짜로 하는 일만 적는다. */
function gaFacts(it){
  const row = (k, v) => `<div class="rvrow"><span>${k}</span><b>${v}</b></div>`;
  if (it.kind === 'fish') return row(L({ ko:'멸치', en:'Anchovies', ja:'煮干し' }), '+' + fmt(it.amount))
    + row(L({ ko:'들어간 곳', en:'Where', ja:'入った先' }), L({ ko:'지갑', en:'Wallet', ja:'財布' }));
  if (it.kind === 'brick') return row(L({ ko:'쓸모', en:'Use', ja:'使い道' }),
      L({ ko:'없음', en:'None', ja:'なし' }))
    + row(L({ ko:'받은 벽돌', en:'Bricks so far', ja:'これまでのレンガ' }), (gaS().brick | 0) + '');
  return row(L({ ko:'사무실 쾌적도', en:'Office comfort', ja:'オフィス快適度' }), '+1')
    + row(L({ ko:'들어간 곳', en:'Where', ja:'入った先' }), L({ ko:'창고', en:'Storage', ja:'倉庫' }))
    + row(L({ ko:'값', en:'Value', ja:'値段' }), it.cost ? '🐟 ' + fmt(it.cost) : '—');
}

/* 창 하나. 두 화면이 같은 껍데기를 쓴다 — 다른 것은 가운데뿐이다. */
function gaWindow(inner, onEsc){
  const root = document.createElement('div');
  root.className = 'gawin';
  root.innerHTML = gaConfetti() + inner;
  document.body.appendChild(root);
  const close = () => {
    if (root.__gone) return;
    root.__gone = true;
    document.removeEventListener('keydown', key);
    root.remove();
    if (onEsc) onEsc();
  };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  return { root, close };
}

/* ── 하나 나왔을 때 ── 무대에 세운다. */
function gaRevealOne(it){
  const url = gaImg(it, 260);
  const star = GA_STAR(it);
  const w = gaWindow(`
    <div class="rvribbon">${L({ ko:'개봉 완료', en:'Opened', ja:'開封完了' })}</div>
    <div class="rvstage">
      <div class="rvrays"></div><div class="rvdisc"></div>
      ${url ? `<img class="rvitem" src="${url}" alt="">`
            : `<div class="rvitem rvitem--em">${it.em}</div>`}
    </div>
    <div class="rvname">${gaEsc(it.n)}</div>
    ${gaStarRow(star)}
    <div class="rvfacts">${gaFacts(it)}</div>
    <div class="rvbtns">
      <button class="rvbtn" data-ok>${L({ ko:'확인', en:'OK', ja:'確認' })}</button>
      ${it.kind === 'furn' || !it.kind ? `<button class="rvbtn alt" data-edit>${
        L({ ko:'창고에서 확인하기', en:'See in storage', ja:'倉庫で確認' })}</button>` : ''}
    </div>`);
  gaRevealWire(w, [it]);
}

/* ── 여럿 나왔을 때 ── 격자. 다섯 칸이면 폰에서 열 개가 두 줄이다(레퍼런스와 같다). */
function gaRevealMany(items){
  const cols = Math.min(5, items.length);
  const cell = (it, i) => {
    const u = gaImg(it, 120);
    /* 굽을 그림이 없는 것(멸치·벽돌)은 이모지에 **한 줄**을 붙인다 — 그림체가 다른
       칸이 아무 말 없이 서 있으면 그 칸만 빈 것처럼 읽힌다. */
    const cap = u ? '' : (it.kind === 'fish'
      ? `<span class="cap">${fmt(it.amount)}</span>`
      : `<span class="cap">${gaEsc(it.n)}</span>`);
    return `<div class="rvcard" style="animation-delay:${Math.min(i, 12) * 0.045}s">
      ${u ? `<img src="${u}" alt="">` : `<span class="em">${it.em}</span>`}
      ${cap}${gaStarRow(GA_STAR(it), 'rvst')}
    </div>`;
  };
  const hasFurn = items.some(x => !x.kind || x.kind === 'furn');
  const w = gaWindow(`
    <div class="rvribbon">${L({ ko:'택배 개봉 결과', en:'Parcel opened', ja:'開封の結果' })}</div>
    <p class="rvsub">${L({
      ko: `${items.length}개를 받았습니다`,
      en: `You got ${items.length}`,
      ja: `${items.length}個を受け取りました` })}<br>
      <small>${gaResultLine(items)}</small></p>
    <div class="rvgrid" style="grid-template-columns:repeat(${cols},1fr)">
      ${items.map(cell).join('')}
    </div>
    <div class="rvbtns">
      <button class="rvbtn" data-ok>${L({ ko:'확인', en:'OK', ja:'確認' })}</button>
      ${hasFurn ? `<button class="rvbtn alt" data-edit>${
        L({ ko:'창고에서 확인하기', en:'See in storage', ja:'倉庫で確認' })}</button>` : ''}
    </div>`);
  gaRevealWire(w, items);
}

/* ── 「창고에서 확인하기」 ──
   한 번 되물렸다. 처음에는 배치 **모드만** 켰다 — 그건 「놓아 준다」가 아니라 「놓을 수
   있는 화면을 열어 준다」고, 누른 사람 눈에는 아무 일도 안 일어난 것이다. 그래서
   **아무 데나 놓아** 줬다. 그것도 아니었다: 뽑은 것은 창고로 가는 게 이 게임의 규칙이고
   (확률표에도 그렇게 적혀 있다), 놓는 자리는 사람이 고르는 것이다. 자동으로 흩어 놓으면
   방금 꾸민 방이 흐트러진다.

   지금은 **창고를 열어 준다.** 이 게임에서 창고는 배치 창의 「가구」 칸이다 —
   가진 것과 방에 있는 것의 차이가 거기 적혀 있고, 놓기 단추도 거기 있다.
   결과 창을 닫고 그 문을 여는 것까지가 이 단추의 일이다. */
function gaOpenStorage(){
  /* 문을 새로 만들지 않는다. 폰 스킨의 망치(.decobtn)가 이미 그 문이고,
     그걸 누르면 배치 시트가 「가구」 칸으로 열린다(js/cozy.js decoToggle).
     이미 열려 있으면 다시 안 누른다 — 누르면 닫힌다. */
  const app = document.getElementById('app');
  if (app && app.classList.contains('decoon')) return true;
  const b = document.querySelector('.decobtn');
  if (b){ b.click(); return true; }
  /* 폰 스킨이 없는 화면(데스크톱)에는 시트가 없다. 거기서는 배치 모드가 그 자리다. */
  if (typeof toggleEdit === 'function' && typeof EDIT !== 'undefined' && !EDIT.on){
    toggleEdit(true);
    return true;
  }
  return false;
}

/* 두 화면의 단추는 같은 일을 한다. */
function gaRevealWire(w, items){
  const ok = w.root.querySelector('[data-ok]');
  if (ok) ok.onclick = () => { try { sfx.add(); } catch (e){} w.close(); };
  const ed = w.root.querySelector('[data-edit]');
  if (ed) ed.onclick = () => {
    w.close();
    try { sfx.add(); } catch (e){}
    gaOpenStorage();
  };
}

/* 갈림길. 하나면 무대, 여럿이면 격자다 — 열 개를 하나씩 무대에 세우면 그건 잔치가
   아니라 열 번의 확인이다. */
function showGachaResult(items){
  if (!items || !items.length) return;
  if (items.length === 1) gaRevealOne(items[0]);
  else gaRevealMany(items);
}


function showGacha(){
  const g = gaS();
  const pool = gaPool(), rates = gaRates();
  /* 다음 보상은 **아직 안 받았고 아직 안 지난** 것이다. 「안 받은 것」만 찾으면
     이미 지나친 정거장이 잡혀서 「다음 보상까지 -7상자」 같은 음수가 뜬다. */
  const nextM = GA_MILE.find(x => !gaGot().includes(x.at) && x.at > g.pulls)
             || GA_MILE.find(x => !gaGot().includes(x.at));
  /* 이 분류의 **최고 등급**. 업무·수납·데코에는 ★3 가 아예 없다(가장 비싼 것이
     420·420·340 멸치라 460 문턱에 못 닿는다). 그런 분류에서 「★3 0.00%」만
     보여 주면 고장으로 읽히므로, 실제로 나올 수 있는 제일 높은 별을 말한다. */
  const top = [3, 2, 1].find(x => rates[x] > 0) || 1;
  const last = GA_MILE[GA_MILE.length - 1].at;
  const m = modal(`
    <div class="mhead"><div class="q">PARCEL</div>
      <h3>${L({ ko: '본사 택배', en: 'Parcel from HQ', ja: '本社からの宅配' })}</h3>
      <p>${L({ ko: '무엇이 들었는지는 뜯어야 압니다. 가구는 창고로, 멸치는 바로 들어옵니다.',
               en: 'You find out by opening it. Furniture goes to storage; anchovies come straight in.',
               ja: '中身は開けてみないと分かりません。家具は倉庫へ、煮干しはそのまま。' })}</p></div>
    <div class="mbody">
      <div class="gahead">
        <div class="gatix"><span class="gaem">📦</span><b>${gaTix()}</b>
          <span>${L({ ko: '상자', en: 'boxes', ja: '箱' })}</span></div>
        <button class="buy alt" id="gaOdds">${L({ ko: '확률 정보', en: 'Odds', ja: '確率' })}</button>
      </div>

      <div class="gabnote gabnote--solo">${L({
        ko: `${pool.length}종이 섞여 있습니다 · 최고 ★${top} ${(rates[top] * 100).toFixed(2)}% · 열 상자를 한 번에 뜯으면 ★${Math.min(GA_TEN_FLOOR, top)} 이상이 하나는 나옵니다.`,
        en: `${pool.length} kinds inside · top ★${top} ${(rates[top] * 100).toFixed(2)}% · open ten at once and one is ★${Math.min(GA_TEN_FLOOR, top)}+ guaranteed.`,
        ja: `${pool.length}種が混ざっています・最高★${top} ${(rates[top] * 100).toFixed(2)}%・10箱まとめて開けると★${Math.min(GA_TEN_FLOOR, top)}以上が1つ確定。` })}</div>

      <div class="gabtns">
        <button class="gabtn" data-pull="1" ${gaTix() < 1 ? 'disabled' : ''}>
          <b>${L({ ko: '한 상자 뜯기', en: 'Open one', ja: '1箱あける' })}</b>
          <span><span class="gaem">📦</span> 1</span></button>
        <button class="gabtn gabtn--hot" data-pull="10" ${gaTix() < 10 ? 'disabled' : ''}>
          <b>${L({ ko: '열 상자 뜯기', en: 'Open ten', ja: '10箱あける' })}</b>
          <span><span class="gaem">📦</span> 10</span>
          <i>${L({ ko: `★${GA_TEN_FLOOR}↑ 확정`, en: `★${GA_TEN_FLOOR}+ sure`, ja: `★${GA_TEN_FLOOR}↑確定` })}</i></button>
      </div>

      <button class="gafree" id="gaFree" ${gaFreeReady() ? '' : 'disabled'}>
        ${gaFreeReady()
          ? L({ ko: '오늘 온 택배 한 상자 (무료)', en: 'Today’s parcel (free)', ja: '今日届いた分（無料）' })
          : L({ ko: '오늘 온 택배는 이미 뜯었습니다', en: 'Today’s parcel is already open', ja: '今日の分はもう開けました' })}
      </button>
      ${gaShopHTML()}
      ${(g.brick | 0) ? `<div class="gabrick">🧱 ${L({
          ko: `본사가 보낸 벽돌 ${g.brick | 0}개`,
          en: `${g.brick | 0} brick(s) from HQ`,
          ja: `本社から届いたレンガ ${g.brick | 0}個` })}</div>` : ''}

      <div class="gamile">
        <div class="gamhead"><b>${L({ ko: '누적 횟수 보상', en: 'Pull milestones', ja: '累計報酬' })}</b>
          <span>${L({ ko: `${g.pulls}회`, en: `${g.pulls} pulls`, ja: `${g.pulls}回` })}</span></div>
        <div class="gambar"><i style="width:${Math.min(100, g.pulls / last * 100)}%"></i></div>
        <div class="gamrow">${GA_MILE.map(x => `<div class="gamstop ${gaGot().includes(x.at) ? 'on' : ''}">
            <span class="gaem">${gaGot().includes(x.at) ? '✅' : '📦'}</span>
            <b>${x.at}</b><span>+${x.tix}</span></div>`).join('')}</div>
        ${nextM ? `<div class="tiny">${L({
          ko: `다음 보상까지 ${Math.max(0, nextM.at - gaPulls())}상자 — 📦 ${nextM.tix}개`,
          en: `${Math.max(0, nextM.at - gaPulls())} more to open — 📦 ${nextM.tix}`,
          ja: `次の報酬まで${Math.max(0, nextM.at - gaPulls())}箱 — 📦 ${nextM.tix}個` })}</div>` : ''}
      </div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko: '닫기', en: 'Close', ja: '閉じる' })}</button></div>`);

  gaIcons(m.veil);
  const V = m.veil;
  const done = items => {
    if (!items || !items.length){
      if (typeof sfx !== 'undefined') sfx.err();
      /* 못 뜯었으면 **단추를 돌려준다.** 서버가 잠깐 안 받은 것일 수 있는데
         잠긴 채로 두면 창을 닫았다 여는 수밖에 없다. */
      V.querySelectorAll('[data-pull]').forEach(b => { b.disabled = gaTix() < +b.dataset.pull; });
      const f = V.querySelector('#gaFree');
      if (f) f.disabled = !gaFreeReady();
      if (typeof toast === 'function' && !gaOn())
        toast(L({ ko: '지금은 상자를 못 뜯습니다 — 서버에 연결되면 됩니다.',
                  en: 'Can’t open boxes right now — needs the server.',
                  ja: '今は箱を開けられません——サーバーに繋がると開けます。' }));
      return;
    }
    m.close();
    /* 결과를 **바로** 안 띄운다 — 뜯는 장면이 먼저다(위 gaOpening). */
    gaOpening(items, () => showGachaResult(items));
  };
  /* 뜯는 것은 **서버가 굴린다**(gaOpen — 서버가 없으면 gaPull 로 내려간다). 그래서
     여기부터는 기다림이 있다: 두 번 눌리지 않게 단추를 먼저 잠근다. 서버가 안 받으면
     null 이 오고, done 이 그 자리에서 「지금은 못 뜯는다」를 말한다. */
  V.querySelectorAll('[data-pull]').forEach(b => {
    b.onclick = () => { b.disabled = true; gaOpen(+b.dataset.pull).then(done); };
  });
  const fb = V.querySelector('#gaFree');
  if (fb) fb.onclick = () => { fb.disabled = true; gaOpen(1, { free: true }).then(done); };
  const ob = V.querySelector('#gaOdds');
  if (ob) ob.onclick = () => showGachaOdds();

  /* 산 뒤에 잔액을 **다시 그린다.** 상자는 웹훅으로 들어오므로 이 창이 들고 있는
     숫자는 산 순간 이미 옛것이다. 창을 닫았다 열게 하지 않는다. */
  const paint = () => {
    const b = V.querySelector('.gatix b');
    if (b) b.textContent = gaTix();
    V.querySelectorAll('[data-pull]').forEach(x => { x.disabled = gaTix() < +x.dataset.pull; });
  };
  const pb = V.querySelector('[data-payinfo]');
  if (pb) pb.onclick = () => showPayInfo();

  /* 제일 큰 묶음만 **한 번 더 묻는다.** 스토어가 자기 결제창을 띄우긴 하지만, 그 창은
     우리 말로 「상자 몇 개」를 말해 주지 않는다 — 세 칸이 나란히 붙어 있어서 잘못
     누르기 쉬운 자리이기도 하다. 전부 물으면 그건 확인이 아니라 방해다. */
  const biggest = (window.STORE ? STORE.state().items : [])
    .reduce((a, x) => Math.max(a, x.boxes | 0), 0);
  const askBig = it => new Promise(res => {
    const c = modal(`
      <div class="mhead"><div class="q">PAYMENT</div>
        <h3>${L({ ko: '이걸로 삽니다', en: 'Confirm', ja: 'これで購入します' })}</h3>
        <p>${L({ ko: `상자 ${it.boxes}개 · ${it.price}`,
                 en: `${it.boxes} boxes · ${it.price}`,
                 ja: `箱 ${it.boxes}個 · ${it.price}` })}</p></div>
      <div class="mfoot" style="display:flex;gap:8px">
        <button class="okbtn" id="pcNo" style="flex:1">${L({
          ko: '그만두기', en: 'Not now', ja: 'やめる' })}</button>
        <button class="okbtn" id="pcYes" style="flex:1">${L({
          ko: '사기', en: 'Buy', ja: '買う' })}</button>
      </div>`, () => res(false));
    c.veil.querySelector('#pcNo').onclick = () => c.close();
    c.veil.querySelector('#pcYes').onclick = () => { res(true); c.close(); };
  });

  V.querySelectorAll('[data-buy]').forEach(b => {
    b.onclick = async () => {
      /* 결제창이 닫힌 뒤에도 **몇 초 더 기다린다**(영수증이 서버로 가는 길). 그동안
         단추만 잠가 두면 아무 일도 안 일어나는 것처럼 보인다 — 누른 단추가 그 사이
         무엇을 하고 있는지 말한다. 새 판을 띄우지 않고 눌린 자리에 적는다. */
      const it = (window.STORE ? STORE.state().items : [])
        .find(x => x.id === b.dataset.buy);
      if (it && biggest > 0 && (it.boxes | 0) >= biggest && !(await askBig(it))) return;
      const keep = b.innerHTML;
      V.querySelectorAll('[data-buy]').forEach(x => { x.disabled = true; });
      b.innerHTML = `<b><span class="gaem">📦</span></b><i>${L({
        ko: '받는 중', en: 'arriving', ja: '受け取り中' })}</i>`;
      /* 늦게 닿으면 그때 다시 그린다 — 창이 아직 열려 있을 때만(닫혔으면 다음에 열 때
         어차피 새로 그려진다). */
      const r = await STORE.buy(b.dataset.buy,
        () => { if (V.isConnected) paint(); });
      b.innerHTML = keep;
      V.querySelectorAll('[data-buy]').forEach(x => { x.disabled = false; });
      paint();
      if (typeof toast !== 'function') return;
      /* 그만둔 것은 말하지 않는다 — 취소는 사고가 아니다. */
      if (!r.ok && r.why === 'cancel') return;
      /* 데모 진열(?store=demo)은 **틀만 보는 판**이다. 「결제를 못 마쳤다」로 말하면
         고장으로 읽히므로 무엇인지 그대로 말한다. */
      if (!r.ok && r.why === 'demo') return toast(L({
        ko: '데모 진열입니다 — 값과 칸만 보는 판이라 결제는 안 됩니다.',
        en: 'Demo shelf — layout only, purchases are off.',
        ja: 'デモ陳列です — 表示だけで購入はできません。' }));
      if (!r.ok) return toast(L({ ko: '결제를 못 마쳤습니다.',
        en: 'The purchase did not go through.', ja: '購入を完了できませんでした。' }));
      /* **결제는 됐는데 아직 안 들어온** 자리가 있다(영수증이 서버로 가는 몇 초).
         「실패」로 말하면 산 사람이 두 번 사게 된다. */
      toast(r.landed
        ? L({ ko: `상자 ${r.boxes}개가 왔습니다.`, en: `${r.boxes} boxes arrived.`,
              ja: `箱が${r.boxes}個届きました。` })
        : L({ ko: '결제됐습니다 — 상자는 곧 도착합니다.',
              en: 'Paid — the boxes are on the way.',
              ja: '購入しました——箱はまもなく届きます。' }));
    };
  });
  const rb = V.querySelector('[data-restore]');
  if (rb) rb.onclick = async () => {
    rb.disabled = true;
    await STORE.restore();
    rb.disabled = false;
    paint();
    if (typeof toast === 'function') toast(L({ ko: '확인했습니다.',
      en: 'Checked.', ja: '確認しました。' }));
  };
  return m;
}

/* ── 임시: 시험용 상자 (2026-09-03) ──
   뜯는 장면과 결과 화면을 손볼 때 상자가 계속 모자랐다. 그때마다 하루를 기다리거나
   결재를 열 건씩 하는 건 시험이 아니라 노동이다.

   **이건 임시다.** 남겨 두면 재화가 재화가 아니게 된다 — 다 보고 나면 지운다.
   그래서 두 가지를 못 박아 둔다:
     · **서버가 잔액을 들고 있으면 안 먹는다.** 그게 이 장부의 전부다(js/parcel.js) —
       로그인한 사람의 잔액을 화면 쪽에서 늘릴 수 있으면 공시도 결제도 뜻이 없다.
     · 주소에 적어야 들어온다(`?boxes=50`) 또는 콘솔에서 `GACHA.give(50)`.
       화면 어디에도 단추를 안 만든다. 단추가 있으면 그건 임시가 아니라 기능이다. */
function gaGive(n){
  gaTestOffline();
  const g = gaS();
  g.tix = Math.max(0, (g.tix | 0) + (n | 0));
  save();
  if (typeof bus !== 'undefined' && bus.emit) bus.emit('tick');   // 열려 있는 화면을 다시 그린다
  /* **어느 잔액에 넣었는지** 말한다. 시험용은 이 기기 저장이고, 서버 장부는 안 건드린다. */
  if (typeof toast === 'function') toast(L({
    ko: `📦 시험용 상자 ${n | 0}개 (이 기기 저장) — 지금 ${g.tix}개`,
    en: `📦 ${n | 0} test boxes (local save) — now ${g.tix}`,
    ja: `📦 テスト用の箱 ${n | 0}個（この端末の保存）— 現在 ${g.tix}個` }));
  return g.tix;
}

/* ── 시험 동안만 서버층을 내린다 ──
   로그인한 기기에서는 상자 잔액이 **서버 장부**이고, 화면도 추첨도 그쪽을 본다
   (js/parcel.js). 그래서 로컬에 50개를 넣어도 화면은 서버의 3개를 보여 준다 —
   실제로 그렇게 막혔다.

   그 잔액을 화면 쪽에서 늘리는 길은 만들지 않는다. 그게 이 장부의 요점이다.
   대신 **이 세션에서만 서버층을 안 쓰게** 한다: PARCEL.state().on 을 false 로 덮으면
   게임은 원래 있던 오프라인 길(gaPull)로 돌고, 그 길은 이 기기 저장의 잔액을 쓴다.
   서버의 숫자는 한 자리도 안 바뀐다. 새로 고치면 원래대로 돌아온다. */
let gaTestOff = false;
function gaTestOffline(){
  if (gaTestOff || typeof PARCEL === 'undefined' || !PARCEL.state) return;
  gaTestOff = true;
  const real = PARCEL.state.bind(PARCEL);
  PARCEL.state = () => ({ ...real(), on: false, why: '시험용으로 내려 둠(임시)' });
}

/* 주소로 넣는 길. 폰에서는 콘솔을 열 수 없어서 이게 필요하다 — 주소창에 치면 된다.

   **서버가 붙는 것을 기다렸다가** 넣는다. 로그인은 게임보다 늦게 붙어서(js/parcel.js 가
   몇 번 두드린다), 바로 넣으면 「로컬에는 50개가 들어갔는데 화면에는 3개」가 된다 —
   화면이 보는 것은 서버 잔액이기 때문이다. 그래서 붙을 때까지(또는 4초) 기다린 다음
   gaGive 에 맡긴다: 서버가 세고 있으면 거기서 못 넣는다고 말한다. */
(function(){
  const m = /[?&]boxes=(\d{1,4})/.exec(location.search);
  if (!m) return;
  const t0 = Date.now();
  const put = () => {
    if (typeof S === 'undefined' || !S || typeof gaS !== 'function') return setTimeout(put, 300);
    /* `why` 로는 못 판단한다 — 로그인이 붙기 전에도 「로그인 전」으로 바뀌어 있다.
       **붙었는지(on)** 만 보고, 안 붙으면 6초 뒤에 포기한다(그 경우가 로그인 안 한 기기다). */
    const on = (typeof PARCEL !== 'undefined') && PARCEL.state().on;
    const settled = on || Date.now() - t0 > 6000;
    if (!settled) return setTimeout(put, 300);
    gaGive(+m[1]);
  };
  setTimeout(put, 1200);
})();

window.GACHA = { show: showGacha, tix: gaTix, freeReady: gaFreeReady,
                 pool: gaPool, rates: gaRates,
                 /* 임시 — 위 gaGive 의 머리말. 다 보고 나면 이 줄도 같이 지운다. */
                 give: gaGive };
