/* 톤앤매너 후보를 같은 사무실·같은 시각에서 나란히 찍는다.  node spike/serve.js 먼저.

   재는 것이 아니라 **고르는 것**이다. 낮 화면의 밝기 폭이 22밖에 안 된다는 건
   이미 픽셀로 잰 사실이고(three/tone.js 머리말), 남은 질문은 찬 배경을 남색으로
   갈지 청록으로 갈지 하나뿐이다. 그건 숫자로 안 갈리고 눈으로 갈린다.

   그래서 조건을 최대한 묶는다: 같은 seed·같은 배치·같은 카메라·같은 고양이,
   시각만 R3.night 으로 강제한다. 실제 시계를 따라가게 두면 세 판이 서로 다른
   시각에 찍혀서 비교가 안 된다.

   실행: node spike/shot-tone.js
   출력: C:/tmp/copycat-tone/raw/{none|navy|teal}-{day|evening|night}.png
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9713;
const OUT = 'C:/tmp/copycat-tone/raw/';
const W = 1400, H = 860;
/* 1단계에서 계열(남색·청록)을 봤고, 2단계에서 보는 건 **깊이**다.
   k 는 three/tone.js 의 다이얼 — 클수록 ambient 가 내려가고 등불이 올라간다.
   같은 계열을 세 단계로 늘어놓아야 "여기서부터 고양이가 안 보인다" 를 눈으로 찾는다. */
const MODE = process.argv[2] || 'hue';
const RUNS =
  MODE === 'depth' ? [['none',''], ['navy','&k=1'], ['navy','&k=1.8'], ['navy','&k=2.8']] :
  MODE === 'pool'  ? [['none',''], ['navy','&k=1.8'], ['navy','&k=1.8&lr=3.2'], ['navy','&k=1.8&lr=2.2']] :
  MODE === 'now'   ? [['none','']] :
                     [['none',''], ['navy','&k=1'], ['teal','&k=1']];
const TONES = RUNS.map(r => r[0]);
const TIMES = ['day', 'evening', 'night'];

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME){ console.error('크롬을 못 찾았다'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-tone-' + process.pid);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });

  let page;
  for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  for (const [tone, extra] of RUNS){
    const q = (tone === 'none' ? '' : '&tone=' + tone) + (tone === 'none' ? '' : extra);
    const tag = tone + (extra ? extra.replace(/&/g, '-').replace(/=/g, '') : '');
    console.log(`\n[${tone}]`);
    await send('Page.navigate', { url:`http://localhost:8123/index.html?3d=1&debug=1${q}` });
    await sleep(13000);

    /* 컷신·계약서·튜토리얼을 지난다 — verify-fog.js 와 같은 길이다 */
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1200);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1200);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2400);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
    await sleep(900);

    /* 세 판이 같은 방이어야 한다 — seed 를 박고 같은 물건을 산다.
       고양이도 같은 수만큼. 톤 비교인데 방이 다르면 아무것도 못 고른다. */
    const info = await ev(`(() => {
      S.tier = 2; S.seed = 4242; S.anchovy = 99999;
      SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = 1; });
      buildWorld(true);
      while (S.cats.length < 8 && deskCount() > S.cats.length){
        const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
      }
      assignDesks(); renderTiles();
      S.cats.forEach(c => { c.needs.energy = 85; c.needs.bladder = 85; c.needs.caffeine = 85; c.needs.fun = 85; });
      document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn')
        .forEach(e => e.style.display = 'none');
      const vp = document.getElementById('viewport');
      vp.style.position = 'fixed'; vp.style.inset = '0'; vp.style.zIndex = '9999';
      /* 인형의 집처럼 멀리서 잡으면 배경색이 화면의 절반을 먹어서 톤 비교가 안 된다.
         바닥과 책상이 화면을 채우도록 당긴다 — 고를 것은 방이지 배경판이 아니다. */
      R3.camReset(false); R3.camSet({ zoom: 0.34, az: 0.72, el: 0.50 }); R3.fit();
      return JSON.stringify({ 사무실: W.W + '×' + W.H, 고양이: S.cats.length, tone: (window.R3E && R3E.TONE) || '(없음)' });
    })()`);
    console.log('  ' + info);
    await sleep(5000);

    for (const t of TIMES){
      /* R3.night 을 직접 부르면 소용없다 — ui.js 의 renderNight 이 **매 프레임**
         실제 시계로 다시 칠한다. 게임이 이미 갖고 있는 손잡이(설정창의 「풍경 고정」)를
         쓴다. 그게 곧 사람이 눈으로 비교할 때 쓰는 길이기도 하다. */
      await ev(`setSkyForce(${JSON.stringify(t)})`);
      await sleep(700);
      await ev(`R3.draw()`);
      const p = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:W, height:H, scale:1 } });
      const f = OUT + tag + '-' + t + '.png';
      fs.writeFileSync(f, Buffer.from(p.data, 'base64'));
      console.log('  ' + path.basename(f));
    }
  }

  if (errs.length) console.log('\n에러:', [...new Set(errs)].slice(0, 6));
  ws.close(); chrome.kill();
  console.log('\n→ ' + OUT);
  process.exit(0);
})();
