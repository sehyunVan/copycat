/* 소리를 되살리는 길이 살아 있나.  node spike/serve.js 먼저.

   신고: "화면을 눌러도 유투브 플레이가 안 됨."

   화면에는 「멈춰 있음 — 화면을 한 번 누르면 시작합니다」가 적혀 있었는데, 그 말을 듣는
   리스너는 **재생이 한 번 성공하면 영구히 떼어졌다**(music.js 의 disarm). 부팅 때 WAV 가
   돌면 그때 떼어지고, 그 뒤 유튜브로 갈아탔다가 막히면 화면을 아무리 눌러도 아무 일이
   없다. 그래서 재는 것 둘:

     1. 재생이 시작된 뒤에도 **문서에 리스너가 붙어 있나** (전에는 0.4초 뒤에 사라졌다)
     2. 멈춰 있을 때 쥬크박스에 **누를 수 있는 ▶︎** 가 있고, 진짜로 누르면 소리가 나나

   자동재생 정책은 켜 둔 채로 돈다(--autoplay-policy=document-user-activation-required).
   끄면 측정하려는 것이 사라진다 — 그 정책이 이 버그의 무대다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9648;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-kick-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars',
    '--autoplay-policy=document-user-activation-required',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  /* 문서에 실제로 붙어 있는 리스너 목록. 화면에 안 보이는 것을 재는 유일한 길이다. */
  const docListeners = async () => {
    const objectId = (await send('Runtime.evaluate', { expression:'document' })).result?.objectId;
    const r = await send('DOMDebugger.getEventListeners', { objectId });
    return (r.listeners || []).map(l => l.type).sort();
  };
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type:'mousePressed', x, y, button:'left', clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', x, y, button:'left', clickCount:1 });
  };

  let fail = 0;
  const ok = (cond, name, extra) => {
    if (!cond) fail++;
    console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '   ' + extra : ''}`);
  };

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  const WANT = ['click','keydown','pointerdown','pointerup','touchend'];
  const has = (list) => WANT.filter(t => list.includes(t));

  console.log('── 첫 입력 전 ──');
  let L1 = await docListeners();
  ok(has(L1).length === WANT.length, '대기 리스너가 다섯 종류 다 붙어 있다', has(L1).join(','));
  let playing = await ev(`music.playing()`);
  ok(playing === false, '아직 소리가 안 난다 (자동재생 정책)', String(playing));

  console.log('\n── 화면을 한 번 누른다 ──');
  await click(700, 500);
  for (let i = 0; i < 10 && !playing; i++){ await sleep(500); playing = await ev(`music.playing()`); }
  ok(playing === true, '누르면 소리가 난다', JSON.stringify(await ev(`JSON.stringify({곡:music.now().id})`)));

  /* ---------- 이게 이 파일의 이유 ----------
     옛 코드는 재생 시작 0.4초 뒤에 disarm() 으로 리스너를 통째로 뗐다. 그러면 이 다음에
     소리가 멈추는 어떤 경우에도(유튜브로 갈아타기·다른 곡·정책 거절) 화면을 눌러
     살릴 방법이 없다. 넉넉히 기다린 뒤에 본다. */
  await sleep(2500);
  const L2 = await docListeners();
  ok(has(L2).length === WANT.length, '재생이 시작된 뒤에도 리스너가 그대로 있다', has(L2).join(','));

  /* ---------- ▶︎ 버튼 ----------
     새로 띄운다. 아래는 전부 **프로그램 클릭**이라 사용자 활성화를 주지 않으므로
     소리는 계속 멈춰 있다 — 그게 우리가 재려는 상태다.

     ▶︎ 를 누를 때는 그 클릭이 문서까지 올라가지 못하게 막는다(아래) — 안 막으면 문서에
     붙은 대기 리스너도 소리를 켤 수 있어서, 버튼이 일한 것인지 알 수 없다. */
  console.log('\n── 쥬크박스의 ▶︎ ──');
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  ok((await ev(`music.playing()`)) === false, '아직 멈춰 있다');
  /* kick() 자체가 던지지 않는지 먼저 본다 — 사용자 활성화가 없으니 여기서 소리는 안 난다.
     (제스처 없이 부른 것이므로 false 가 정상이다. 재는 건 "예외 없이 돌아온다".) */
  const kickRet = await ev(`typeof music.kick === 'function' ? String(music.kick()) : 'no-kick'`);
  ok(kickRet === 'false' || kickRet === 'true', 'music.kick() 이 예외 없이 돌아온다', kickRet);

  await ev(`showJuke()`);
  await sleep(900);
  const panel = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#jukeKick');
    const t = document.querySelector('.veil .mbody').textContent;
    if (b) b.scrollIntoView({ block:'center' });
    const r = b && b.getBoundingClientRect();
    return JSON.stringify({ 버튼: !!b, 옛문구: t.includes('화면을 한 번 누르면'), 멈춤표시: t.includes('멈춰 있음'),
      x: r ? Math.round(r.x + r.width/2) : 0, y: r ? Math.round(r.y + r.height/2) : 0 }); })()`));
  ok(panel.버튼, '멈춰 있으면 ▶︎ 가 있다', JSON.stringify(panel));
  ok(panel.멈춤표시 && !panel.옛문구, '「화면을 한 번 누르면」은 사라졌다');

  if (panel.버튼){
    /* **버튼만 일하게 한다.** 이 클릭은 문서까지 거품처럼 올라가는데, 거기 붙은 대기
       리스너(arm)도 소리를 켤 수 있어서 그냥 누르면 어느 쪽이 켰는지 알 수 없다.
       버튼에서 전파를 끊으면 남는 길은 버튼의 onclick → music.kick() 하나뿐이다.
       (stopPropagation 은 같은 대상의 다른 리스너는 막지 않는다 — onclick 은 그대로 돈다.) */
    await ev(`(() => { const b = document.querySelector('#jukeKick');
      ['pointerdown','pointerup','click','touchend','keydown'].forEach(t =>
        b.addEventListener(t, e => e.stopPropagation())); })()`);
    await click(panel.x, panel.y);
    let on = false;
    for (let i = 0; i < 10 && !on; i++){ await sleep(500); on = await ev(`music.playing()`); }
    ok(on === true, '▶︎ 를 누르면 소리가 난다 (버튼 혼자서)', JSON.stringify(await ev(`JSON.stringify({곡:music.now().id})`)));
    await sleep(1800);
    ok((await ev(`!document.querySelector('#jukeKick')`)) === true, '소리가 나면 ▶︎ 는 사라진다');
  }

  /* 음소거일 때는 눌러도 소리가 안 나는 게 맞다 — 그러면 버튼을 내놓지 않는다 */
  await ev(`setVolume(0)`);
  await sleep(600);
  await ev(`(() => { const b = document.querySelector('.veil [data-close]'); if (b) b.click(); })()`);
  await ev(`showJuke()`);
  await sleep(900);
  const muted = JSON.parse(await ev(`(() => {
    const t = document.querySelector('.veil .mbody').textContent;
    return JSON.stringify({ 버튼: !!document.querySelector('#jukeKick'), 음소거안내: t.includes('음소거 중입니다') }); })()`));
  ok(!muted.버튼 && muted.음소거안내, '음소거 중에는 ▶︎ 대신 음소거라고 말한다', JSON.stringify(muted));

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 3).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
