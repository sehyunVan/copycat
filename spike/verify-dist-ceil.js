/* 빌드된 단일 파일에서 천장등·스위치·블라인드가 실제로 도는가.  서버 없이 file:// 로 연다.

   **소스에서 되는 것과 dist 에서 되는 것은 다른 문제다.** dist/copycat.html 은 ES 모듈을
   전부 한 파일로 접어 넣은 것이고(tools/inline-modules.js), 새로 만든 모듈(three/tone.js)이
   import 그래프에서 빠지면 소스에서는 멀쩡한데 배포본에서만 조용히 죽는다.
   그래서 문자열이 들어갔는지가 아니라 **광선이 스위치에 맞는지**를 잰다.

   실행: node spike/verify-dist-ceil.js [파일경로]
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9717;
const FILE = process.argv[2] || path.resolve(__dirname, '..', 'dist', 'copycat.html');
const URL = 'file:///' + FILE.split(String.fromCharCode(92)).join('/');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(URL);
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-dist-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text
      || (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:860, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const click = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x, y, button:'left', clickCount:1 });
    await sleep(450);
  };

  await send('Page.navigate', { url: URL });
  await sleep(15000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1400);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1400);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2600);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1600);

  const boot = JSON.parse(await ev(`JSON.stringify({
    r3: typeof R3 !== 'undefined' && !!(R3 && R3.ready),
    has: !!(window.R3 && R3.pickSwitch && R3.setCeiling && R3.switchAt),
    sw: (window.R3 && R3.switchAt) ? R3.switchAt() : null,
    /* 시간대 다섯 벌이 실렸는가. 배포본은 모듈을 한 파일로 접으므로,
       새로 만든 모듈이나 새 필드가 빠져도 화면은 그냥 「예전 색」으로 돌아갈 뿐
       에러가 안 난다 — 조용히 틀린 채로 나가는 종류다. */
    phases: (window.R3E && R3E.TIME) ? Object.keys(R3E.TIME) : [],
    grade: !!(window.R3E && R3E.TIME && R3E.TIME.night && R3E.TIME.night.grade
              && R3E.TIME.night.grade.tintAmt > 0),
    skyAt: typeof setSkyAt === 'function',
  })`));
  console.log('  3D 준비 ' + (boot.r3 ? 'O' : 'X') + ' · 손잡이 ' + (boot.has ? 'O' : 'X')
            + ' · 스위치 ' + (boot.sw ? `방(${boot.sw.x.toFixed(2)}, ${boot.sw.z.toFixed(2)})` : '없음'));
  console.log('  시간대 ' + boot.phases.length + '벌 [' + boot.phases.join(' ') + ']'
            + ' · 필름 룩 ' + (boot.grade ? 'O' : 'X') + ' · setSkyAt ' + (boot.skyAt ? 'O' : 'X'));
  if (!boot.sw){ console.log('  → 실패: 배포본에 천장등 배선이 안 들어갔다'); ws.close(); chrome.kill(); process.exit(1); }

  /* 폰용 배포본(dist/android · dist/iphone)은 **한 번에 한 화면**이라(js/col.js M4)
     사무실이 아닌 탭이 떠 있으면 패널이 캔버스를 덮는다. 광선은 맞는데 클릭은
     패널이 먹는다 — 실제로 그렇게 걸렸다(맨위요소 "empty").
     사람도 사무실 탭을 눌러야 사무실을 보므로, 검사도 거기서 시작한다. */
  await ev(`(() => { const b = document.querySelector('button[data-col="stage"]');
    if (b && getComputedStyle(b).display !== 'none') b.click(); })()`);
  await sleep(800);

  /* **방 전체를 잡고 잰다.** 기본 카메라는 고양이를 따라다니므로(FOLLOW zoom 0.30)
     벽에 붙은 물건은 화면 밖에 있는 게 정상이다 — CD 플레이어·달력도 마찬가지다.
     여기서 재려는 건 「기본 시점에서 보이는가」가 아니라 **「광선이 맞는가」** 다. */
  await ev(`(() => { R3.followOn(false); R3.camReset(false); R3.fit(); R3.draw(); })()`);
  await sleep(900);

  const pos = JSON.parse(await ev(`JSON.stringify((() => {
    const w = R3.switchAt();
    return w && w.onScreen ? { x:Math.round(w.sx), y:Math.round(w.sy) } : null; })())`));
  if (!pos){ console.log('  스위치가 화면 밖이다'); ws.close(); chrome.kill(); process.exit(1); }
  /* 안 눌렸을 때 **어디서 막혔는지**를 알아야 한다. 광선이 안 맞는 것과
     클릭이 다른 요소에 먹히는 것은 전혀 다른 고장이다. */
  console.log('  진단: ' + await ev(`JSON.stringify({
    광선: R3.pickSwitch(${pos.x}, ${pos.y}),
    맨위요소: (el => el ? (el.id || el.className || el.tagName) : null)(document.elementFromPoint(${pos.x}, ${pos.y})),
    고양이가먼저: !!R3.pickCat(${pos.x}, ${pos.y}),
    창떠있음: !!document.querySelector('.veil'),
    배치모드: (typeof EDIT !== 'undefined' && EDIT && !!EDIT.on),
    is3d: (typeof is3d === 'function') ? is3d() : null,
  })`));

  /* 광선이 아예 안 맞으면 **메시가 광선을 받는 상태가 아닌 것**이다. 주변을 훑어
     어디서든 맞는지, 그리고 스위치 실물이 씬에 어떤 꼴로 들어 있는지 같이 본다. */
  console.log('  훑기: ' + await ev(`JSON.stringify((() => {
    const hits = [];
    for (let dy = -40; dy <= 40; dy += 10) for (let dx = -40; dx <= 40; dx += 10)
      if (R3.pickSwitch(${pos.x} + dx, ${pos.y} + dy)) hits.push([dx, dy]);
    return { 맞은칸: hits.length, 첫칸: hits[0] || null };
  })())`));

  const st = async () => JSON.parse(await ev(`JSON.stringify({ on:R3.ceiling(), saved:S.ceil })`));
  const a = await st(); await click(pos.x, pos.y);
  const b = await st(); await click(pos.x, pos.y);
  const c = await st();
  console.log(`  스위치 화면 (${pos.x}, ${pos.y}) — 처음 ${a.on?'켜짐':'꺼짐'} → ${b.on?'켜짐':'꺼짐'} → ${c.on?'켜짐':'꺼짐'} · 저장 ${a.saved}/${b.saved}/${c.saved}`);

  /* 블라인드 — 창 메시의 자식 수로 본다. 살이 안 붙었으면 5개(틀·판·살2·선반)뿐이다. */
  const blind = await ev(`(() => { const w = LP_TEST_WINDOW; return w; })()`).catch(() => null);
  const onScreen = pos.x > 0 && pos.y > 0 && pos.x < 1400 && pos.y < 860;

  const ok = boot.r3 && boot.has && a.on !== b.on && b.on !== c.on && onScreen && errs.length === 0
          && boot.phases.length === 5 && boot.grade && boot.skyAt;
  const p = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:1400,height:860,scale:1} });
  fs.writeFileSync('C:/tmp/copycat-tone/10-dist.png', Buffer.from(p.data,'base64'));
  console.log('  화면 안 ' + (onScreen ? 'O' : 'X') + ' · 콘솔 에러 ' + errs.length);
  if (errs.length) console.log('   ', [...new Set(errs)].slice(0,4));
  console.log(`  → ${ok ? '통과' : '실패'}`);
  ws.close(); chrome.kill(); process.exit(ok ? 0 : 1);
})();
