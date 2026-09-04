/* 폰 사무실 화면의 **사건 카드** (js/cozy.js fillCard).  node spike/serve.js 먼저.

   이 카드는 게임이 이미 그린 카드를 **베낀다** — 경영 패널의 수사 카드(`.legalcard`)에서
   줄 하나를 복제해 사무실 화면에 얹는다. 그 방식의 값어치는 숫자를 두 군데서 계산하지
   않는다는 것이고, 그 방식의 함정은 **베낀 것이 살아 있는 것처럼 보인다**는 것이다.

   실제로 밟았다: 「무마」 단추가 `.crow` 안에 들어 있어서 줄을 통째로 복제하면 단추도
   같이 오는데, 그건 리스너가 없는 사본이다. 그 밑에 제대로 배선한 사본을 하나 더
   붙이고 있었으므로 **단추가 둘 뜨고 왼쪽 것이 죽어 있었다.**

   그래서 이 검사는 두 가지를 본다:
     1. 단추가 **하나**다
     2. 그 하나가 **실제로 돈다** (누르면 혐의가 준다)
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9560 + (process.pid % 80), W = 390, H = 844;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
const ok = (n, p, note) => rows.push({ name:n, pass:!!p, note });

(async () => {
  try { await fetch('http://localhost:8123/index.html'); }
  catch(e){ console.log('❌ spike/serve.js 가 안 떠 있다.'); process.exit(1); }

  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-card-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); let errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown')
      errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 200));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || '').slice(0, 300));
    return r?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:true });
  await send('Page.navigate', { url:'http://localhost:8123/index.html' });
  for (let i = 0; i < 90; i++){
    if (await ev(`!!(window.S && window.R3 && R3.ready)`)) break;
    await sleep(400);
  }
  await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();
    document.body.classList.remove('titleon');return 1})()`);
  await sleep(1400);
  await ev(`(()=>{const g=document.querySelector('#cnGo');if(g)g.click();return 1})()`);
  await sleep(1200);
  await ev(`document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove())`);
  await sleep(800);
  errs = [];

  /* 혐의를 세우고 돈을 넉넉히 준다 — 카드는 혐의가 있을 때만 뜬다 */
  const shown = await ev(`(async()=>{
    S.penalty = 3; S.anchovy = 500000;
    if (typeof renderRight === 'function') renderRight();
    if (typeof renderTop === 'function') renderTop();
    /* 카드는 사무실 칸에서 뜬다 */
    const t = document.querySelector('#colTabs button[data-col="stage"]');
    if (t) t.click();
    await new Promise(r=>setTimeout(r,1800));
    const card = document.querySelector('.stagecard');
    const btns = card ? [...card.querySelectorAll('[data-act]')] : [];
    return JSON.stringify({ card:!!card, n:btns.length,
      wired: btns.map(b => b.classList.contains('cardact')),
      txt: btns.map(b => (b.textContent||'').trim().slice(0,12)) });
  })()`);
  const C = JSON.parse(shown);
  ok('수사 카드가 폰 사무실 화면에 뜬다', C.card);
  ok('「무마」 단추가 **하나**다 (죽은 사본이 안 남는다)',
     C.n === 1 && C.wired[0] === true, `단추 ${C.n}개 · 배선 ${JSON.stringify(C.wired)} · ${C.txt.join(' | ')}`);

  const works = await ev(`(async()=>{
    const before = S.penalty | 0, cash = S.anchovy | 0;
    const b = document.querySelector('.stagecard [data-act]');
    if (!b) return JSON.stringify({ hit:false });
    b.click();
    await new Promise(r=>setTimeout(r,900));
    return JSON.stringify({ hit:true, before, after: S.penalty|0, paid: cash - (S.anchovy|0) });
  })()`);
  const Wk = JSON.parse(works);
  ok('그 하나가 실제로 돈다 — 누르면 혐의가 준다',
     Wk.hit && Wk.after === Wk.before - 1 && Wk.paid > 0,
     `혐의 ${Wk.before} → ${Wk.after} · 멸치 ${Wk.paid}`);

  const bad = errs.filter(e => !/favicon|ERR_/.test(e));
  ok('오류 0', bad.length === 0, bad.slice(0, 2).join(' | '));

  console.log('\n══════ 폰 사건 카드 ══════');
  let fail = 0;
  for (const r of rows){
    if (!r.pass) fail++;
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.note ? '   ' + r.note : ''}`);
  }
  console.log(`\n  ${rows.length - fail}/${rows.length}\n`);
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
