/* ============================================================
   capture-ios.js — App Store 에 올릴 아이폰 스크린샷을 뽑는다.

   왜 `capture-store.js` 를 안 쓰나: 그건 1440×900 **데스크톱**이고 itch.io 페이지용이다.
   애플은 세로 아이폰 크기를 요구한다(6.9" = 1290×2796).

   ── 폰 배포본을 찍는다, 소스가 아니라 ──
   `dist/android` 를 띄운 것을 찍는다. 거기에는 `<meta copycat-dist=mobile>` 이 박혀 있어
   폭과 무관하게 **언제나 폰 배치**로 뜨고, 무엇보다 **사람이 받을 그 파일**이다.
   소스를 찍으면 zip 에 안 담긴 것까지 같이 찍힌다.

     node tools/pack-mobile.js          먼저 굽는다
     node tools/serve-mobile.js         다른 창에서 띄운다
     node tools/capture-ios.js
   출력: dist/store/ios/*.png
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'store', 'ios');
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8188';
/* 6.9" 아이폰. 430×932 논리 픽셀 × 3 = 1290×2796 — 애플이 받는 크기 그대로다. */
const W = 430, H = 932, SCALE = 3;
const PORT = 9370 + (process.pid % 60);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(BASE + '/index.html'); if (!r.ok) throw new Error('HTTP ' + r.status); }
  catch (e){ console.log(`${BASE} 가 안 열린다 — node tools/serve-mobile.js 를 먼저 켠다.`); process.exit(2); }

  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(process.env.TEMP || '.', 'cdp-ios-' + PORT);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=' + PORT,
    '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page;
  for (let i = 0; i < 160 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page){ chrome.kill(); throw new Error(`크롬이 ${PORT} 에서 안 떴다`); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,140)); });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:SCALE, mobile:true });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description||'').slice(0,300));
    return r?.result?.value;
  };
  const shot = async name => {
    /* 찍기 **직전에** 한 번 더 걷는다 — 띠는 15초 뒤에 스스로 뜨기도 해서,
       처음에 한 번 지우는 것만으로는 다음 장에 다시 들어온다. */
    await ev(`(()=>{const b=document.querySelector('#pwaBar'); if(b) b.remove();
      document.querySelectorAll('.toast').forEach(x=>x.remove()); return 1})()`).catch(()=>{});
    await sleep(150);
    const r = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
    const buf = Buffer.from(r.data, 'base64');
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log('  ' + name.padEnd(22) + (buf.length/1024).toFixed(0) + ' KB');
  };
  /* 창·코치마크에 더해 **웹에서만 뜨는 것들**을 걷는다.
     `#pwaBar` 는 「홈 화면에 설치」 띠다 — 브라우저의 beforeinstallprompt 로 뜨는 것이라
     네이티브 앱 안에서는 존재하지도 않는다. 그게 App Store 스크린샷에 찍혀 있으면
     심사자는 **웹페이지를 앱이라고 낸 것**으로 읽는다.
     말풍선(.toast)도 지운다 — 반쯤 뜨다 잘린 글자가 찍히면 그건 광고가 아니라 사고다. */
  const clear = () => ev(`(()=>{document.querySelectorAll(
    '.veil,.coach,.coachring,#pwaBar,.toast').forEach(x=>x.remove());return 1})()`);

  /* 늘 같은 출발점에서 찍는다 — 스크린샷이 판마다 다르면 그건 광고가 아니라 사고다. */
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(2500);
  await ev(`localStorage.clear()`).catch(()=>{});
  await send('Page.navigate', { url: BASE + '/index.html' });
  let up = false;
  for (let i = 0; i < 80 && !up; i++){
    await sleep(700);
    up = await ev(`(()=>{const t=document.querySelector('#cctitle');if(t)t.remove();
      document.body.classList.remove('titleon');
      return typeof S!=='undefined' && !!S && !!document.querySelector('#gl')})()`).catch(()=>false);
  }
  if (!up){ console.log('게임이 안 섰다'); chrome.kill(); process.exit(1); }
  await clear(); await sleep(2200);

  console.log(`아이폰 6.9" ${W*SCALE}×${H*SCALE}`);

  /* 1) 사무실 — 첫인상. 이 게임이 무엇인지 한 장으로 말하는 자리다. */
  await shot('01-office.png');

  /* 2) 결재함 — 「할 일을 체크하면 고양이가 서류를 물어간다」. 이 게임의 한 문장이다. */
  const TASKS = ['분기 보고서 정리', '거래처 회신', '창고 재고 확인', '신규 라인 검토'];
  for (const t of TASKS){
    await ev(`(()=>{const i=document.querySelector('#todoInput'); if(!i) return 0;
      i.value=${JSON.stringify(t)}; i.dispatchEvent(new Event('input',{bubbles:true}));
      const b=document.querySelector('#btnAdd'); if(b) b.click(); return 1})()`);
    await sleep(300);
  }
  await ev(`document.querySelectorAll('#todoList .todo .chk').forEach((b,i)=>{ if(i<3) b.click(); })`);
  await sleep(2000);
  await shot('02-inbox.png');

  /* 3) 본사 택배 — 파는 것이 무엇인지 심사도 본다. */
  await ev(`showGacha()`); await sleep(1200);
  await shot('03-parcel.png');
  await clear(); await sleep(500);

  /* 4) 인사 파일 — 사원증. 고양이 하나하나가 다르다는 것이 여기서 보인다. */
  await ev(`(()=>{const t=document.querySelector('.tab[data-tab="staff"]'); if(t) t.click(); return 1})()`); await sleep(1500);
  await ev(`(()=>{const c=document.querySelector('.dexrow,.dexcell,.staffrow,[data-cat]'); if(c) c.click(); return !!c})()`); await sleep(1500);
  await shot('04-staff.png');
  await clear(); await sleep(500);

  /* 5) 꾸미기 — 비품 칸. 무엇을 사서 놓는가. */
  await ev(`(()=>{const t=document.querySelector('.tab[data-tab="shop"]'); if(t) t.click(); return 1})()`);
  await sleep(1200);
  await shot('05-shop.png');

  /* 6) 제휴 게시판 — 혼자 하는 게임이 아니라는 것. */
  await ev(`showBoard()`); await sleep(1400);
  await shot('06-board.png');
  await clear();

  console.log(errs.length ? '\n오류: ' + errs.slice(0,3).join(' | ') : '\n오류 없음');
  console.log('→ ' + OUT);
  try { ws.close(); } catch(e){}
  chrome.kill();
})();
