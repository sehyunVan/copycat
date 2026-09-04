/* 62번의 문구 넷과 57번의 본사 택배.
   node spike/serve.js 먼저.  →  node spike/verify-beats.js

   ── 무엇을 재나 ──
   둘 다 **화면에는 잘 안 보이는 규칙**이 본론이다.
   문구 넷은 「분기가 차야 나오고 · 한 번만 나오고 · 정해진 화면에만 나온다」이고,
   택배는 「티켓으로만 열리고 · 멸치로 티켓을 살 수 없고 · 꽝이 쌓인다」이다.
   둘 다 틀려도 화면은 멀쩡해 보인다.

   재는 것 열둘:
     1  분기가 모자라면 아무 줄도 안 나온다
     2  Q9 에 사보 한 줄
     3  같은 줄이 두 번 안 나온다
     4  Q13 에 결산표의 칸 하나 (「반출」 — 분기 매출과 같은 숫자)
     5  Q19 에 사보의 두 번째 줄
     6  Q25 에 통지서의 점검표 (37항)
     7  본 것은 저장에 남는다 (S.beats)
     8  상자에는 넷이 들어 있다 — 가구 · 멸치 · 장비 · 벽돌
     9  뜯으면 티켓이 준다 (멸치는 안 준다)
    10 갈래마다 제대로 들어온다 (창고 · 지갑 · 가방 · 벽돌)
    11 **멸치로 티켓을 사는 길이 없다**
    12 벽돌 열 개 → 티켓 한 장
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9418, W = 390, H = 844;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
const ok = (name, pass, note) => rows.push({ name, pass, note });

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-beat-' + PORT);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });

  let page;
  for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text
      + ' ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 160));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' '
      + (r.exceptionDetails.exception?.description || '').slice(0, 300));
    return r?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:true });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  await sleep(14000);
  if (!await ev(`typeof beatTake === 'function'`)) throw new Error('story.js 가 안 올라왔다');
  await ev(`(()=>{const el=document.querySelector('#cctitle'); if(el) el.remove();
    document.body.classList.remove('titleon'); S.beats = []; return 1})()`);

  /* ---------- 1 ---------- */
  const early = await ev(`(()=>{ S.quarter = 5; S.beats = [];
    return { news: !!beatTake('news'), q: beatQuarterRow({ earned:1234 }), raid: beatRaidNote() }; })()`);
  ok('분기가 모자라면 아무 줄도 안 나온다', !early.news && !early.q && !early.raid,
      JSON.stringify(early).slice(0, 60));

  /* ---------- 2·3 ---------- */
  const q9 = await ev(`(()=>{ S.quarter = 9; S.beats = []; S.log = [];
    const a = beatNews(), one = S.log.length;
    const b = beatNews(), two = S.log.length;        // 두 번째는 안 나와야 한다
    return { a, b, one, two, text: (S.log[0] || {}).t || '' }; })()`);
  ok('Q9 에 사보 한 줄', q9.a === true && q9.one === 1 && /서른두 번째/.test(q9.text),
      (q9.text || '(없음)').replace(/<[^>]+>/g, '').slice(0, 44));
  ok('같은 줄이 두 번 안 나온다', q9.b === false && q9.two === 1, `두 번째 ${q9.b} · 사보 ${q9.two}줄`);

  /* ---------- 4 ---------- */
  /* 「같은 숫자」가 이 줄의 전부다 — 화면에 찍히는 문자열이 분기 매출과 같아야 한다.
     fmt 는 4321 을 4.32K 로 줄이므로 원본 숫자를 찾으면 안 된다(그렇게 한 번 틀렸다). */
  const q13 = await ev(`(()=>{ S.quarter = 13;
    const html = beatQuarterRow({ earned: 4321 });
    return { html, same: html.indexOf(fmt(4321)) >= 0, want: fmt(4321) }; })()`);
  ok('Q13 결산표에 「반출」 칸', /반출|Removed|搬出/.test(q13.html) && q13.same,
      (q13.html.replace(/<[^>]+>/g, ' ').trim() + ' — 분기 매출과 같은 ' + q13.want).slice(0, 52));

  /* ---------- 5 ---------- */
  const q19 = await ev(`(()=>{ S.quarter = 19; S.log = [];
    const a = beatNews(); return { a, text: (S.log[0] || {}).t || '' }; })()`);
  ok('Q19 에 사보의 두 번째 줄', q19.a === true && /같습니다|the same|同じ/.test(q19.text),
      (q19.text || '(없음)').replace(/<[^>]+>/g, '').slice(0, 44));

  /* ---------- 6·7 ---------- */
  const q25 = await ev(`(()=>{ S.quarter = 25;
    const html = beatRaidNote();
    const raw = JSON.parse(localStorage.getItem('copycat.save.v1') || '{}');
    return { html, beats: S.beats.slice(), saved: (raw.beats || []).length }; })()`);
  ok('Q25 통지서에 점검표 37항', /37/.test(q25.html), q25.html.replace(/<[^>]+>/g, ' ').trim().slice(0, 46) || '(없음)');
  ok('본 것은 저장에 남는다', q25.beats.length === 4 && q25.saved === 4,
      `${q25.beats.join(',')} · 저장 ${q25.saved}`);

  /* ---------- 8. 상자 내용물 ---------- */
  const pool = await ev(`(()=>{
    const p = GACHA.pool();
    const k = {};
    p.forEach(x => k[x.kind] = (k[x.kind] | 0) + 1);
    return { n: p.length, k, stars: [1,2,3].map(s => p.filter(x => (x.star || (x.cost >= 460 ? 3 : x.cost >= 220 ? 2 : 1)) === s).length) };
  })()`);
  /* 장비를 뺐다(2026-09-03) — 이제 셋이다. gear 가 0 이어야 한다는 것까지 본다:
     남아 있으면 없앤 체계가 상자에서만 계속 나온다. */
  ok('상자에 셋이 들어 있다',
      pool.k.furn > 5 && pool.k.fish === 3 && pool.k.brick === 4 && !pool.k.gear,
      `${pool.n}종 — ` + Object.entries(pool.k).map(([a, b]) => a + ' ' + b).join(' · '));

  /* ---------- 9·10 ---------- */
  const pull = await ev(`(()=>{
    const g = (S.gacha = S.gacha || {});
    S.beats = S.beats || [];
    /* 창고·지갑·벽돌을 다 비우고 티켓만 넉넉히 준다 */
    S.shop = {}; S.anchovy = 0; g.tix = 60; g.brick = 0; g.free = dayKey();
    /* 누적 보상을 미리 받은 것으로 해 둔다 — 안 그러면 50상자 중간에 티켓이 들어와서
       「티켓이 준다」를 셀 수가 없다(10·30·50 에서 +15). 그건 이 검사가 볼 것이 아니다. */
    g.pulls = 0; g.got = [10, 30, 50, 100];
    const fish0 = S.anchovy, tix0 = g.tix;
    /* 넉넉히 뜯어서 갈래가 다 나오게 한다 — 한 번으로는 벽돌이 안 나올 수 있다.
       **잔액의 처음과 끝을 빼면 안 된다**: 상자는 배경에서도 들어온다(결재 10건마다
       한 장 · 분기 사건). 그래서 뽑기 **한 번의 앞뒤**만 재서 더한다 — 그 사이에는
       아무것도 못 끼어든다(동기 호출이다). 실제로 이 검사가 그것 때문에 한 번 틀렸다. */
    let got = [], spent = 0;
    for (let i = 0; i < 5; i++){
      /* **매번 gaS() 로 읽는다.** 위에서 잡아 둔 g 를 계속 보면, 그 사이에 누가
         S.gacha 를 갈아 끼웠을 때 낡은 객체의 숫자를 재게 된다(그렇게 한 번 틀렸다). */
      const b = gaS().tix;
      got = got.concat(gaPull(10) || []);
      spent += b - gaS().tix;
    }
    return { n: got.length, spent, tix: g.tix, tix0, fishUp: S.anchovy - fish0,
             shop: Object.keys(S.shop).length, brick: g.brick | 0,
             gear: typeof EQUIP, bag: typeof S.bag };
  })()`);
  ok('뜯으면 상자가 준다', pull.n === 50 && pull.spent === 50,
      `${pull.n}개 뜯고 상자 ${pull.spent}개 씀`);

  /* 받은 누적 보상은 **두 번 안 준다.** 서버층이 켜져 있어도 그렇다 —
     예전에는 그때 없는 칸을 읽어서 뽑을 때마다 지나온 정거장이 다시 지급됐다. */
  const mile = await ev(`(()=>{
    const g = gaS(); g.pulls = 0; g.got = []; g.tix = 100; g.free = dayKey();
    const on = (typeof gaOn === 'function') && gaOn();
    const a = g.tix; gaPull(10); const first = g.tix - (a - 10);   // 10회 정거장 +2
    const b = g.tix; gaPull(10); const again = g.tix - (b - 10);   // 20회 — 더 줄 것이 없다
    return { first, again, on, got: g.got.slice().join(',') };
  })()`);
  ok('누적 보상은 한 번만 준다', mile.first === 2 && mile.again === 0,
      `첫 정거장 +${mile.first} · 다시 +${mile.again} (서버층 ${mile.on}) · 받은 것 ${mile.got}`);
  ok('갈래마다 제대로 들어온다', pull.shop > 0 && pull.fishUp > 0 && pull.brick > 0,
      `창고 ${pull.shop}종 · 멸치 +${pull.fishUp} · 벽돌 ${pull.brick}`);
  ok('장비 체계가 남아 있지 않다', pull.gear === 'undefined' && pull.bag === 'undefined',
      `EQUIP ${pull.gear} · S.bag ${pull.bag}`);

  /* ---------- 11 ---------- */
  const noBuy = await ev(`(()=>({
    fn: typeof gaTixCost, api: !!(window.GACHA && GACHA.cost),
  }))()`);
  ok('멸치로 티켓을 사는 길이 없다', noBuy.fn === 'undefined' && !noBuy.api,
      `gaTixCost ${noBuy.fn} · GACHA.cost ${noBuy.api}`);

  /* ---------- 12 ---------- */
  /* 벽돌은 재화가 아니다 — 모아서 바꾸는 길이 **없어야** 한다.
     한때 열 개 = 상자 하나였고, 그러면 꽝이 꽝이 아니라 느린 상자가 된다. */
  const nb = await ev(`(()=>{
    const g = S.gacha; g.brick = 99; const t0 = g.tix;
    if (typeof gaBrickTrade === 'function') gaBrickTrade();
    return { fn: typeof gaBrickTrade, api: !!(window.GACHA && GACHA.brick),
             srv: !!(window.PARCEL && PARCEL.bricks), tix: g.tix - t0, kept: g.brick };
  })()`);
  ok('벽돌을 바꾸는 길이 없다',
      nb.fn === 'undefined' && !nb.api && !nb.srv && nb.tix === 0 && nb.kept === 99,
      `gaBrickTrade ${nb.fn} · GACHA.brick ${nb.api} · PARCEL.bricks ${nb.srv} · 상자 +${nb.tix}`);

  /* ---------- 13 ---------- */
  /* 그래도 몇 개 받았는지는 센다 — 쓰는 곳 없는 눈금이라 재화가 아니다. */
  const tally = await ev(`(()=>{
    const g = S.gacha; g.brick = 0;
    gaGrant({ kind:'brick' }); gaGrant({ kind:'brick' });
    return g.brick;
  })()`);
  ok('받은 벽돌은 세어 둔다', tally === 2, `${tally}개`);

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | ') || '0');

  ws.close(); chrome.kill();
  const pass = rows.filter(r => r.pass).length;
  for (const r of rows) console.log(`  ${r.pass ? 'OK ' : 'X  '} ${r.name.padEnd(28)} ${r.note || ''}`);
  console.log(`\n  ${pass}/${rows.length}`);
  process.exit(pass === rows.length ? 0 : 1);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
