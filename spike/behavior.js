/* ============================================================
   behavior.js — 고양이가 시간을 어디에 쓰는지 센다.

   "너무 책상에만 앉아 있다" 는 눈으로는 맞출 수 없는 종류의 말이다. 자리 비율이
   90% 인지 70% 인지에 따라 고쳐야 할 양이 다르고, 고치고 나면 수입이 같이 움직인다.
   그래서 **진짜 sim.js 를 돌려서** 상태 비율과 수입을 같이 잰다 — 규칙을 여기에
   베껴 쓰지 않는다(world-audit.js 와 같은 이유).

   페이지 안에서 simTick(dt) 를 직접 여러 번 불러 시간을 앞으로 감는다. 게임은 데스크탑
   시계로 돌기 때문에 기다려서는 못 재고, 시계(S.clock)는 매 틱 실제 시각으로 덮어써지므로
   시간대는 고정된 채로 하루치 근무를 압축해서 보는 셈이 된다.

   node spike/serve.js &
   node spike/behavior.js [분] [고양이수] [시행수]   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const MIN    = Number(process.argv[2]) || 60;    // 몇 분어치를 돌릴까
const CATS   = Number(process.argv[3]) || 6;
/* 사무실 배치도 고양이 능력치도 매번 다르게 뽑히므로 한 번만 재면 ±15% 는 그냥 흔들린다.
   여러 번 돌려 평균과 폭을 같이 본다 — 폭을 안 보면 튜닝이 미신이 된다. */
const TRIALS = Number(process.argv[4]) || 3;const PORT = 9600 + (process.pid % 300);
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 페이지 안에서 도는 부분. 상태를 매 틱 세고, 시설은 어느 가구에 머물렀는지까지 센다. */
const SCRIPT = (min, cats, trials) => `(() => {
  try {
   const runs = [];
   for (let trial = 0; trial < ${trials}; trial++){
    S.cats.length = 0;
    S.shop = {};
    /* 자리를 넉넉히 만들고 고양이를 채운다 — 자리가 모자라면 그것 때문에 안 앉는 거라
       "책상에만 앉아 있다" 를 재는 게 아니라 "자리가 없다" 를 재게 된다.
       등급을 올리고 비품도 다 사 둔다(가구 종류가 있어야 가구 사용을 잰다). */
    while (TIERS[S.tier].desks < ${cats} && S.tier < TIERS.length - 1) S.tier++;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = true; });
    S.layout = null;
    buildWorld(true);
    while (S.cats.length < ${cats}){
      const c = newCat();
      if (!c) break;
      S.cats.push(c);
    }
    assignDesks();

    const dt = 0.1, steps = Math.round(${min} * 60 / dt);
    const tally = {}, furn = {}, seen = new Set();
    let income0 = S.anchovy, moved = 0;
    const last = new Map();
    for (const c of S.cats) last.set(c.id, [c.x, c.y]);

    for (let i = 0; i < steps; i++){
      simTick(dt);
      for (const c of S.cats){
        const s = (c.act || {}).s || 'idle';
        tally[s] = (tally[s] || 0) + dt;
        if (s === 'use' || s === 'sleep'){
          const u = c.act.use;
          const t = u ? tileAt(W, u.x, u.y) : null;
          const nm = t ? ((TILE_INFO[t] || {}).n || String(t)) : '(제자리)';
          furn[nm] = (furn[nm] || 0) + dt;
          if (u) seen.add(u.x + ',' + u.y);
        }
        const p = last.get(c.id);
        moved += Math.abs(c.x - p[0]) + Math.abs(c.y - p[1]);
        last.set(c.id, [c.x, c.y]);
      }
    }
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    let placed = 0;
    for (const k in W.facilities) placed += W.facilities[k].length;
    runs.push({ tally, furn, seen: seen.size, placed,
                moved: moved / S.cats.length / ${min},
                income: (S.anchovy - income0) / (${min} * 60), total });
   }

   /* 합치기 — 상태 비율은 시간을 다 더해서 내고, 수입은 평균과 최소·최대를 같이 낸다 */
   const sumOf = key => runs.reduce((o, r) => {
     for (const k in r[key]) o[k] = (o[k] || 0) + r[key][k];
     return o;
   }, {});
   const total = runs.reduce((a, r) => a + r.total, 0);
   const pct = o => Object.fromEntries(Object.entries(o)
     .sort((a, b) => b[1] - a[1])
     .map(([k, v]) => [k, +(v / total * 100).toFixed(1)]));
   const avg = f => +(runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(2);
   const incomes = runs.map(r => r.income);

   return JSON.stringify({
     시행: runs.length, 고양이: S.cats.length, 분: ${min},
     상태: pct(sumOf('tally')),
     가구: pct(sumOf('furn')),
     쓴가구: avg(r => r.seen), 놓인시설: avg(r => r.placed),
     이동칸: avg(r => r.moved),
     수입초: avg(r => r.income),
     수입폭: [+Math.min(...incomes).toFixed(2), +Math.max(...incomes).toFixed(2)],
   }, null, 1);
  } catch (e){ return '오류: ' + (e && e.stack || e); }
})()`;

(async () => {
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-beh-' + process.pid),
    'about:blank'], { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable'); await send('Page.enable');
  /* 3D 는 재는 데 필요 없고 소프트웨어 렌더러에서 느리기만 하다 */
  await send('Page.navigate', { url: BASE + '/index.html?3d=0' });
  await sleep(3000);

  const r = await send('Runtime.evaluate', { expression: SCRIPT(MIN, CATS, TRIALS), returnByValue: true });
  console.log(r.result?.value ?? r.exceptionDetails?.exception?.description ?? r.result);

  await send('Browser.close');
  ws.close(); chrome.kill();
  process.exit(0);
})();
