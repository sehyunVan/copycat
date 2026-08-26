/* 하루를 통째로 찍는다.  node spike/serve.js 먼저.

   두 가지를 찍는다:
     shot-day.js         다섯 단계만 (아침·오전·오후·더 오후·밤)
     shot-day.js sweep   06시부터 23시까지 30분 간격 — **사이가 부드러운지** 보는 것

   sweep 이 본체다. 다섯 장은 각 룩이 제 모습인지만 말하고, 색이 점진적으로
   변하는지는 그 사이에서만 드러난다. 한 칸이라도 툭 튀면 거기가 표의 구멍이다.

   시각은 setSkyForce(단계) 가 아니라 **S.clock 을 직접 돌려서** 만든다 —
   그래야 SKY_AT 의 보간이 실제로 도는 경로를 지난다(고정은 t=0 이라 섞이지 않는다).

   출력: C:/tmp/copycat-tone/day/*.png
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9718, OUT = 'C:/tmp/copycat-tone/day/', W = 1400, H = 860;
const SWEEP = process.argv[2] === 'sweep';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 다섯 단계가 제 모습인 시각 — SKY_AT 에서 같은 이름이 두 번 나오는 구간의 한가운데 */
const PEAKS = [[8.1,'1-아침'], [11.5,'2-오전'], [15.5,'3-오후'], [18.9,'4-더오후'], [23.0,'5-밤']];

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-day-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
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
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1&debug=1' });
  await sleep(13000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(900);
  console.log(await ev(`(() => {
    S.tier = 1; S.seed = 4242; S.anchovy = 99999;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = 1; });
    buildWorld(true);
    while (S.cats.length < 6 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks(); renderTiles();
    S.cats.forEach(c => { c.needs.energy=85; c.needs.bladder=85; c.needs.caffeine=85; c.needs.fun=85; });
    document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn')
      .forEach(e => e.style.display='none');
    const vp=document.getElementById('viewport'); vp.style.position='fixed'; vp.style.inset='0'; vp.style.zIndex='9999';
    R3.followOn(false); R3.camReset(false); R3.camSet({ zoom:0.40 }); R3.fit();
    return JSON.stringify({ 사무실:W.W+'×'+W.H, 고양이:S.cats.length });
  })()`));
  await sleep(5000);

  /* 시계를 직접 돌린다. setSkyForce 를 쓰면 t=0 으로 고정되어 **섞이는 구간을 못 본다** —
     이 스크립트가 확인하려는 게 정확히 그 구간이다. */
  const at = async (hour) => {
    await ev(`(() => { setSkyForce(''); setSkyAt(${hour}); renderNight(); R3.draw(); })()`);
    await sleep(420);
    await ev(`R3.draw()`);
    return JSON.parse(await ev(`JSON.stringify((() => { const m = skyMix(0);
      return { a:m.a, b:m.b, t:+m.t.toFixed(2) }; })())`));
  };
  const shot = async (name) => {
    const p = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:W,height:H,scale:1} });
    fs.writeFileSync(OUT + name + '.png', Buffer.from(p.data,'base64'));
  };

  const list = SWEEP
    ? Array.from({ length: 35 }, (_, i) => [6 + i * 0.5, String(6 + i * 0.5).padStart(4,'0')])
    : PEAKS;
  for (const [h, name] of list){
    const m = await at(h);
    const hh = String(Math.floor(h)).padStart(2,'0') + ':' + (h % 1 ? '30' : '00');
    await shot((SWEEP ? 'sweep-' : 'peak-') + name);
    console.log(`  ${hh}  ${m.a}${m.a === m.b ? '' : ' → ' + m.b + ' ' + (m.t*100).toFixed(0) + '%'}`);
  }
  if (errs.length) console.log('에러:', [...new Set(errs)].slice(0,5));
  ws.close(); chrome.kill(); process.exit(0);
})();
