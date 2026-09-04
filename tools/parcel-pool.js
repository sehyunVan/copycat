/* ============================================================
   parcel-pool.js — 택배 풀을 **게임에서 그대로 꺼내** 서버 SQL 로 굽는다.

   왜 필요한가: 상자를 돈으로 팔면 추첨을 서버가 해야 한다(클라이언트가 굴리면
   공시한 확률을 증명할 방법이 없다). 그런데 무엇이 들어 있는지는 게임 코드가
   알고 있다 — 가구 카탈로그(game.js) · 멸치(gacha.js) · 장비(cats.js) · 벽돌.

   그래서 **표를 손으로 옮겨 적지 않는다.** 진짜 게임을 헤드리스로 띄워
   `gaPool()` 을 부르고, 그 결과를 그대로 INSERT 문으로 굽는다. 카탈로그를 고치면
   이 도구를 다시 돌리는 것이 절차다 — 옮겨 적으면 언젠가 서버만 옛 표를 갖는다.

     node spike/serve.js          (다른 창에서)
     node tools/parcel-pool.js    → spike/supabase-parcel-pool.sql
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9801;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, '..', 'spike', 'supabase-parcel-pool.sql');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-pool-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 100 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(12000);
  /* 시작화면을 넘겨야 S 가 선다(풀은 SHOP·EQUIP 을 읽는다) */
  await ev(`(() => { const t=document.querySelector('#cctitle .go') || document.querySelector('#cctitle'); if (t) t.click(); })()`);
  await sleep(2500);
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/재생|Play|再生/.test(x.textContent||'')); if (b) b.click(); })()`);
  await sleep(900);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2600);
  await ev(`document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove())`);
  await sleep(1200);

  const raw = await ev(`(() => {
    if (typeof gaPool !== 'function') return null;
    return JSON.stringify(gaPool().map(it => ({
      id: it.id, kind: it.kind, star: (typeof GA_STAR === 'function') ? GA_STAR(it) : (it.star || 1),
      amount: it.amount || null, cost: it.cost || null,
      n: (it.n && (it.n.ko || it.n)) || it.id,
    })));
  })()`);
  try { ws.close(); chrome.kill(); } catch(e){}
  if (!raw) throw new Error('gaPool 을 못 읽었다 — 게임이 안 떴거나 gacha.js 가 안 실렸다');

  const pool = JSON.parse(raw);
  const by = k => pool.filter(x => x.kind === k).length;
  const stars = s => pool.filter(x => x.star === s).length;
  console.log(`풀 ${pool.length}장 — 가구 ${by('furn')} · 멸치 ${by('fish')} · 장비 ${by('gear')} · 벽돌 ${by('brick')}`);
  console.log(`등급별 — ★3 ${stars(3)} · ★2 ${stars(2)} · ★1 ${stars(1)}`);
  if (!pool.length || !by('furn')) throw new Error('풀이 비었다 — 굽지 않는다');

  const q = s => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
  const rows = pool.map(x =>
    `  (${q(x.id)}, ${q(x.kind)}, ${x.star}, ${x.amount == null ? 'null' : x.amount}, ${q(x.n)})`).join(',\n');

  const sql = `-- ============================================================
-- 택배 풀 — **자동 생성 파일이다. 손으로 고치지 말 것.**
--   node tools/parcel-pool.js   (게임에서 gaPool() 을 그대로 꺼내 굽는다)
--
-- 생성 ${new Date().toISOString().slice(0, 10)} · ${pool.length}장
--   가구 ${by('furn')} · 멸치 ${by('fish')} · 장비 ${by('gear')} · 벽돌 ${by('brick')}
--   ★3 ${stars(3)} · ★2 ${stars(2)} · ★1 ${stars(1)}
--
-- 가구 카탈로그나 장비를 고쳤으면 이 도구를 다시 돌린다 — 서버만 옛 표를 들고
-- 있으면 공시한 확률과 실제로 나오는 것이 갈린다.
-- ============================================================

create table if not exists public.parcel_pool (
  id     text primary key,
  kind   text not null,        -- furn | fish | gear | brick
  star   int  not null,
  amount int,                  -- 멸치만 (액수)
  name   text
);
alter table public.parcel_pool enable row level security;
-- 풀은 **누구나 읽는다** — 확률 공시의 근거라 감출 이유가 없다. 쓰기는 아무도 못 한다.
drop policy if exists "풀은 읽기만" on public.parcel_pool;
create policy "풀은 읽기만" on public.parcel_pool for select using (true);

truncate public.parcel_pool;
insert into public.parcel_pool (id, kind, star, amount, name) values
${rows};
`;
  fs.writeFileSync(OUT, sql);
  console.log('→ ' + path.relative(path.join(__dirname, '..'), OUT));
  process.exit(0);
})();
