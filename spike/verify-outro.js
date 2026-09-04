/* 아웃트로가 **실제로 열리고 · 로고를 띄우고 · 원래 상태로 돌아가나.**
   node spike/serve.js 먼저.  →  node spike/verify-outro.js

   ── 왜 그림이 아니라 이걸 재나 ──
   그림은 shot-outro.js 가 찍는다. 이쪽은 그림으로는 안 보이는 것을 잰다:
   컷신이 **켜지는 조건**, 끝난 뒤 렌더러에서 **빌린 것을 돌려줬나**, 그리고 본 사람의
   시작화면이 바뀌나. 이 셋은 틀려도 화면이 멀쩡해 보이고, 다음에 게임을 켜면 드러난다
   (천장이 열린 채로 남거나, 안개가 꺼진 채로 남거나, 카메라 화각이 52 로 남는다).

   재는 것 열:
     1  조건 전에는 안 열린다
     2  분기 28 이면 열린다
     3  카메라를 아웃트로가 잡는다 · 격자가 섰다
     4  자막이 뜬다
     5  누르면 **마지막 로고**가 뜬다 (고른 간판)
     6  끝나면 판이 걷힌다
     7  **빌린 것을 돌려준다** — 천장 · 안개 · 화각 · 추적
     8  본 것이 저장에 남는다 (S.ending + 거울 키)
     9  다시 켜면 시작화면이 **정경**이다
    10 콘솔 오류 없음
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9414, W = 390, H = 844;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'dist', 'shots');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
const ok = (name, pass, note) => rows.push({ name, pass, note });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-vout-' + PORT);
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
      + ' ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' '
      + (r.exceptionDetails.exception?.description || '').slice(0, 300));
    return r?.result?.value;
  };
  const boot = async () => {
    await ev(`(()=>{const st=document.createElement('style');
      st.textContent='#app{height:${H}px !important}';document.head.appendChild(st);
      const a=document.getElementById('app'); if(a.classList.contains('tabbar')) a.dataset.col='stage';
      if(typeof colApply==='function')colApply();
      if(typeof fitWorld==='function')fitWorld(); if(window.R3&&R3.fit)R3.fit(); return 1})()`);
  };

  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:true });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  await sleep(15000);
  if (!await ev(`!!(window.R3 && R3.ready)`)) throw new Error('3D 가 안 올라왔다');
  await boot();
  await sleep(800);

  /* 시작화면을 걷는다 — 컷신은 그 판이 떠 있는 동안 일부러 안 열린다(story.js endingCheck) */
  await ev(`(()=>{const el=document.querySelector('#cctitle'); if(el) el.remove();
    document.body.classList.remove('titleon'); return 1})()`);

  /* 빌려 가기 전의 상태를 적어 둔다 — 7번이 이걸 대조한다 */
  const before = await ev(`(()=>({ ceil: R3.ceiling(),
    fog: !!(window.R3E && R3E.fog()), follow: R3.following() }))()`);

  /* ---------- 1. 조건 전에는 안 열린다 ---------- */
  const no = await ev(`(()=>{ S.quarter = 3; S.found = [];
    const r = endingCheck(); return { r, on: !!document.querySelector('.outro') }; })()`);
  ok('조건 전에는 안 열린다', no.r === false && !no.on, JSON.stringify(no));

  /* ---------- 2·3·4. 분기 28 이면 열린다 ---------- */
  const opened = await ev(`(()=>{ S.quarter = 28; return { why: endingWhy(), r: endingCheck() }; })()`);
  await sleep(1500);
  const on = await ev(`(()=>{
    const el = document.querySelector('.outro');
    const i = R3.outroInfo();
    return { el: !!el, cam: i.on, built: i.built, dur: +i.dur.toFixed(1),
             titleon: document.body.classList.contains('titleon'),
             sky: typeof skyForced === 'function' ? skyForced() : null }; })()`);
  ok('분기 28 이면 열린다', opened.why === 'q28' && opened.r === true && on.el,
      `why=${opened.why} · 판 ${on.el}`);
  ok('카메라를 아웃트로가 잡는다 · 격자가 섰다', on.cam && on.built && on.dur > 20,
      `카메라 ${on.cam} · 격자 ${on.built} · ${on.dur}초 · 하늘 ${on.sky}`);

  /* 자막은 **2장의 6.4초**에 뜬다 = 처음부터 11.4초다(1장이 5초). 8.5초에 봤다가
     「자막이 안 뜬다」로 한 번 틀렸다 — 컷신 시각과 장 안의 시각을 헷갈리면 이렇게 된다. */
  await sleep(11000);
  const sub = await ev(`(()=>{ const s = document.querySelector('.outro .osub');
    return { on: getComputedStyle(s).opacity > 0.5, t: s.textContent.trim() }; })()`);
  ok('자막이 뜬다', sub.on && sub.t.length > 3, sub.t || '(없음)');

  /* ---------- 5. 누르면 마지막 로고 ---------- */
  const logo = await ev(`(()=>{
    document.querySelector('.outro').click();
    const l = document.querySelector('.outro .ologo');
    return { cls: document.querySelector('.outro').className,
             img: !!(l && l.querySelector('img')) }; })()`);
  ok('누르면 마지막 로고가 뜬다', logo.cls.includes('logoon'), `${logo.cls} · 그림 ${logo.img}`);
  await sleep(1400);
  const shot = await send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(path.join(OUT, 'outro-logo.png'), Buffer.from(shot.data, 'base64'));

  /* ---------- 6·7·8. 끝나면 돌려준다 ---------- */
  await sleep(3600);
  const after = await ev(`(()=>{
    const i = R3.outroInfo();
    const raw = JSON.parse(localStorage.getItem('copycat.save.v1') || '{}');
    return { el: !!document.querySelector('.outro'), cam: i.on, built: i.built,
             ceil: R3.ceiling(), fog: !!(window.R3E && R3E.fog()), follow: R3.following(),
             titleon: document.body.classList.contains('titleon'),
             sky: typeof skyForced === 'function' ? skyForced() : null,
             ending: S.ending, saved: raw.ending, key: localStorage.getItem('copycat.ending') }; })()`);
  ok('끝나면 판이 걷힌다', !after.el && !after.cam && !after.built && !after.titleon,
      `판 ${after.el} · 카메라 ${after.cam} · 격자 ${after.built}`);
  ok('빌린 것을 돌려준다', after.ceil === before.ceil && after.fog === before.fog
      && after.follow === before.follow && !after.sky,
      `천장 ${before.ceil}→${after.ceil} · 안개 ${before.fog}→${after.fog}`
      + ` · 추적 ${before.follow}→${after.follow} · 하늘 ${after.sky}`);
  ok('본 것이 저장에 남는다', after.ending === 1 && after.saved === 1 && after.key === '1',
      `S.ending ${after.ending} · 저장 ${after.saved} · 거울 ${after.key}`);

  /* ---------- 9. 다시 켜면 정경 ---------- */
  await send('Page.reload', {});
  await sleep(15000);
  await boot();
  await sleep(2500);
  const vista = await ev(`(()=>{
    const el = document.querySelector('#cctitle');
    return { on: !!el, vista: !!(el && el.classList.contains('vista')),
             live: !!(el && el.classList.contains('live')),
             built: (R3.outroInfo() || {}).built }; })()`);
  ok('다시 켜면 시작화면이 정경이다', vista.on && vista.vista && vista.built,
      JSON.stringify(vista));

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | ') || '0');

  ws.close(); chrome.kill();
  const pass = rows.filter(r => r.pass).length;
  for (const r of rows) console.log(`  ${r.pass ? 'OK ' : 'X  '} ${r.name.padEnd(30)} ${r.note || ''}`);
  console.log(`\n  ${pass}/${rows.length}`);
  process.exit(pass === rows.length ? 0 : 1);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
