/* 설정 정리 · CD 플레이어 문구 · 유튜브 재생 검증.  node spike/serve.js 먼저.

   유튜브는 **실제로 소리가 나는 데까지** 잰다. 자동재생 정책과 최소 크기가 원인이었으므로
   "링크가 파싱된다" 까지만 재면 아무것도 확인한 게 없다 — 재생기 상태가 1(재생 중)이 되고
   음소거가 풀렸는지를 본다. 헤드리스에서 유튜브에 못 닿으면 그것도 그대로 적는다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9530;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-music');
  fs.rmSync(dir, { recursive:true, force:true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars',
    '--autoplay-policy=document-user-activation-required',   // 실제 브라우저와 같은 정책으로 잰다
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 160));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(700);

  console.log('\n══ 1. 고정된 기본값 ══');
  console.log(await ev(`JSON.stringify({
    '3D': want3d, 'is3d()': is3d(),
    'body.eerie': document.body.classList.contains('eerie'),
    '고양이': (typeof R3 !== 'undefined' && R3.getCatLook) ? R3.getCatLook() : 'R3없음',
    '음악켜짐': music.pref(),
    '저장값무시': (() => { const before = { r:localStorage.getItem('copycat.render3d'),
      s:localStorage.getItem('copycat.style'), c:localStorage.getItem('copycat.catlook'),
      m:localStorage.getItem('copycat.music') }; return JSON.stringify(before); })(),
  })`));

  console.log('\n══ 2. 설정 화면 ══');
  await ev(`$('#btnSettings').click()`);
  await sleep(800);
  console.log(await ev(`(() => {
    const v = document.querySelector('.veil');
    const cards = [...v.querySelectorAll('.mbody .card .info > b')].map(b => b.textContent.trim());
    return JSON.stringify({ 남은항목: cards,
      '없앤넷': ['배경 음악','3D 사무실','사무실 톤','고양이 그림체'].filter(n => cards.includes(n)),
      부제: v.querySelector('.mhead p').textContent.trim(),
      죽은버튼: [...v.querySelectorAll('[data-set]')].map(b => b.dataset.set) });
  })()`));
  await ev(`document.querySelector('.veil [data-close]').click()`);
  await sleep(500);

  console.log('\n══ 3. CD 플레이어 문구 ══');
  await ev(`showJuke()`);
  await sleep(900);
  console.log(await ev(`(() => {
    const v = document.querySelector('.veil');
    return JSON.stringify({
      머리: v.querySelector('.mhead p').textContent.trim(),
      곡줄: [...v.querySelectorAll('#jukeBody .card .info')].map(i => ({
        이름: (i.querySelector('b')||{}).textContent, 설명있음: !!i.querySelector('span') })).slice(0,8),
    });
  })()`));

  console.log('\n══ 4. 유튜브 ══');
  // 스크립트가 미리 받아졌나 (showJuke 가 ytWarm 을 부른다)
  await sleep(3500);
  console.log('  스크립트 도착: ' + await ev(`!!(window.YT && window.YT.Player)`));

  // 링크 읽기 — 여러 형태
  const forms = [
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtu.be/jNQXAC9IVRw',
    'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    'jNQXAC9IVRw',
    '그냥 아무 글자',
  ];
  for (const f of forms){
    const r = await ev(`JSON.stringify({ 걸림: music.setYT(${JSON.stringify(f)}), 읽음: music.ytStatus().parsed })`);
    console.log('  ' + JSON.stringify(f) + ' → ' + r);
  }

  /* 진짜 재생. 사용자 입력 안에서 걸어야 실제 경로와 같다 —
     「걸기」 버튼을 실제로 누르게 만든다(CDP 입력으로 활성화를 준다). */
  await ev(`(() => { const u = document.querySelector('#ytUrl');
    if (u){ u.value = 'https://youtu.be/jNQXAC9IVRw'; u.scrollIntoView({block:'center'}); } })()`);
  await sleep(600);
  const btn = await ev(`(() => { const b = document.querySelector('#ytGo');
    if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect();
    if (r.y < 0 || r.y > innerHeight) return null;
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }); })()`);
  console.log('  걸기 버튼 좌표: ' + btn);
  if (btn){
    const { x, y } = JSON.parse(btn);
    await send('Input.dispatchMouseEvent', { type:'mousePressed', x, y, button:'left', clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', x, y, button:'left', clickCount:1 });
  }
  for (let i = 0; i < 7; i++){
    await sleep(2500);
    const st = await ev(`(() => {
      const f = document.getElementById('ytbox');
      const box = f ? f.getBoundingClientRect() : null;
      const s = music.ytStatus();
      return JSON.stringify({ t:${i}, 상태: s, 상자: box ? { w:Math.round(box.width), h:Math.round(box.height),
        x:Math.round(box.x), y:Math.round(box.y), 태그:f.tagName } : '없음',
        지금곡: music.now().id, 재생중: music.playing() });
    })()`);
    console.log('  ' + st);
    if (/"playing":true/.test(st)) break;
  }

  console.log('\n══ 오류 ══');
  console.log(errs.length ? errs.slice(0, 8).join('\n  ') : '  없음');
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
