/* ============================================================
   world-audit.js — 평면도를 전수로 만들어 보고 규칙을 지켰는지 검사한다.

   사무실 크기를 줄이면 조용히 깨지는 것들이 있다. 책상이 다 안 들어가거나,
   시설 하나가 자리를 못 잡거나, 어딘가가 문에서 닿지 않는다. 셋 다 화면에서는
   "좀 허전하네" 로만 보이고 원인이 안 보인다. 그래서 숫자로 본다.

   world.js 를 **그대로 실행해서** 검사한다 — 규칙을 여기에 베껴 두면
   언젠가 반드시 어긋난다 — 그래서 world.js 를 **그대로 실행해서** 표를 꺼낸다.

   node tools/world-audit.js [시드수]
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SEEDS = Number(process.argv[2]) || 30;
const ROOT = path.join(__dirname, '..');

/* world.js 는 i18n 의 L() 만 바깥에서 받는다. 가구 표(FURN_SPAN·FURN_BIG·FURN_CAT)는
   2026-08-24 부터 world.js 안에 있다 — 예전에는 도트 렌더러(js/sprite.js)에 얹혀 살았고
   그래서 이 감사가 sprite.js 를 같이 올려야 했다. 배치 규칙은 배치기 옆에 있어야 한다. */
const sandbox = {
  L: o => (o && typeof o === 'object' ? (o.ko || o.en || '') : o),
  console,
};
vm.createContext(sandbox);
/* world.js 의 최상위 const 는 VM 의 전역이 되지 않는다(함수 선언만 된다).
   그래서 같은 스코프에 한 줄을 덧붙여서 필요한 것들을 꺼낸다.
   값을 여기에 베끼지 않는 게 요점이다 — 베끼면 언젠가 어긋난다. */
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js', 'world.js'), 'utf8')
  + ';globalThis.__W = { TIERS, TILE, SHOP_TILE, genOffice, tileAt, walkable, floodFrom, adjacentFree };',
  sandbox, { filename: 'world.js' });

const { TIERS, TILE, SHOP_TILE, genOffice, tileAt, walkable, floodFrom, adjacentFree } = sandbox.__W;

/* 상점 표도 game.js 에서 **그대로 꺼내 쓴다.** 등급 조건을 여기에 베끼면
   상점을 고칠 때마다 같이 고쳐야 하고, 언젠가 반드시 어긋난다.
   (game.js 전체는 다른 전역에 의존하므로 SHOP 리터럴만 떼어 평가한다.) */
const gameSrc = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
const shopAt = gameSrc.indexOf('const SHOP = [');
const shopEnd = gameSrc.indexOf('\n];', shopAt) + 3;
const shopSrc = gameSrc.slice(shopAt, shopEnd);
vm.runInContext(shopSrc + ';globalThis.__SHOP = SHOP;', sandbox, { filename:'game.js#SHOP' });
const SHOP = sandbox.__SHOP;

/* 그 등급에서 실제로 살 수 있는 비품만 산 것으로 친다 —
   0등급에서 전 비품 보유는 게임에서 불가능한 상태다. */
const ownedUpTo = tier => Object.fromEntries(
  SHOP.filter(it => it.tier <= tier && SHOP_TILE[it.id]).map(it => [it.id, true]));

let bad = 0, plans = 0;
const rows = [];

[{ label:'빈 사무실', all:false }, { label:'살 수 있는 비품 전부', all:true }]
  .forEach(CASE => TIERS.forEach((T, tier) => {
  const owned = CASE.all ? ownedUpTo(tier) : {};
  const shopIds = Object.keys(owned);
  let deskMin = Infinity, deskMax = 0, missing = 0, unreachable = 0, noAccess = 0, blocked = 0;

  for (let seed = 1; seed <= SEEDS; seed++){
    const w = genOffice(tier, owned, seed);
    plans++;
    const W = w.W, H = w.H;

    deskMin = Math.min(deskMin, w.desks.length);
    deskMax = Math.max(deskMax, w.desks.length);
    if (w.desks.length < T.desks) missing++;

    /* 문 옆에서 시작해 모든 바닥이 닿아야 한다 — 안 그러면 고양이가 갇힌다 */
    const entry = { x: w.door.x, y: H - 2 };
    if (!walkable(w, entry.x, entry.y)){ blocked++; continue; }
    const reach = floodFrom(w, entry);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++)
        if (walkable(w, x, y) && !reach.has(y * W + x)) unreachable++;

    /* 모든 자리와 시설에 접근 칸이 하나는 있어야 한다 */
    w.desks.forEach(d => { if (!reach.has(d.seat.y * W + d.seat.x)) unreachable++; });
    Object.values(w.facilities).forEach(list => list.forEach(f => {
      if (!adjacentFree(w, f).some(p => reach.has(p.y * W + p.x))) noAccess++;
    }));

    /* 필수 시설 — 낮잠 자리·모래상자·정수기는 늘 있어야 한다 */
    ['sleep', 'litter', 'social'].forEach(u => { if (!w.facilities[u]) missing++; });
  }

  /* 비품을 다 산 경우엔 산 물건이 실제로 놓였는지도 본다 —
     자리가 없어서 조용히 사라지면 돈만 쓰고 아무 일도 안 일어난다. */
  let unplaced = 0;
  if (CASE.all && shopIds.length){
    for (let seed = 1; seed <= SEEDS; seed++){
      const w = genOffice(tier, owned, seed);
      const has = new Set(Array.from(w.grid));
      shopIds.forEach(id => { if (!has.has(SHOP_TILE[id])) unplaced++; });
    }
  }
  const ok = !missing && !unreachable && !noAccess && !blocked && !unplaced;
  if (!ok) bad++;
  rows.push({ label: CASE.label, tier, size: `${T.w}×${T.h}`, need: T.desks, unplaced,
              missing, unreachable, noAccess, blocked, ok, items: shopIds.length,
              desks: deskMin === deskMax ? String(deskMin) : `${deskMin}~${deskMax}` });
}));

const pad = (s, n) => String(s).padEnd(n);
console.log(`평면도 ${plans}개 (${TIERS.length}등급 × ${SEEDS}시드)\n`);
console.log(pad('경우', 11) + pad('등급', 5) + pad('크기', 8) + pad('필요', 6) + pad('실제', 8)
          + pad('부족', 6) + pad('고립', 6) + pad('진입불가', 10) + pad('비품', 6) + pad('미설치', 8) + '판정');
rows.forEach(r => console.log(
  pad(r.label, 11) + pad(r.tier, 5) + pad(r.size, 8) + pad(r.need, 6) + pad(r.desks, 8)
  + pad(r.missing, 6) + pad(r.unreachable, 6) + pad(r.noAccess, 10) + pad(r.items, 6) + pad(r.unplaced, 8)
  + (r.ok ? 'OK' : '실패')));

console.log(bad ? `\n${bad}개 등급 실패` : '\n전 등급 통과');
process.exit(bad ? 1 : 0);
