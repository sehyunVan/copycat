/* **배포본(단일 HTML)** 을 file:// 로 열어 같은 것을 잰다. 모듈이 인라인되는 경로가
   달라서 소스 트리에서 통과한 것이 여기서 안 될 수 있다 — 실제로 그런 적이 있다.
   먼저: node tools/pack-single.js

   확인하는 것:
     1. 폭마다 **어느 배치가 살아나는지** (1560 → onecol, 1000 → 3열, 390 → tabbar, 520×430 → 위젯)
     2. 탭을 실제로 눌러서 화면이 바뀌는지 (한 번에 하나만 보이는지)
     3. 390px 에서 상단 바가 **한 줄**인지 — 후보판 넷 모두에서 두 줄로 접혔던 그 문제
     4. 가로 오버플로 · 콘솔 오류
   그림도 같이 찍는다(spike/ui/out-*.png). WebGL 이 이 헤드리스에서 합성이 안 되므로
   캔버스는 toDataURL 로 따로 읽어 확인만 하고, 배치 판정은 좌표로 한다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9560;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = [
  { name:'d3',     w:1560, h:900, want:'onecol' },
  { name:'m4',     w:390,  h:780, want:'tabbar', mobile:true },
  { name:'widget', w:520,  h:430, want:'compact' },
];

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-dist-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
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
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  let fail = 0;
  for (const c of CASES){
    errs.length = 0;
    await send('Emulation.setDeviceMetricsOverride', { width:c.w, height:c.h, deviceScaleFactor:1, mobile:!!c.mobile });
    await send('Page.navigate', { url:'file:///' + path.resolve(__dirname,'..','dist','copycat.html').split(path.sep).join('/') + '?3d=1' });
    await sleep(11000);
    // 프롤로그를 넘기고 회사를 키운다 — 비품·직원 탭에 실제 내용이 있어야 판정이 된다
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1200);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1200);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2200);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
    await sleep(600);
    await ev(`(() => {
      S.tier = 3; S.anchovy = 9999;
      while (S.cats.length < 5 && deskCount() > S.cats.length){
        const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
      }
      assignDesks(); renderTiles(); renderRight(); renderTodos();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
    })()`);
    await sleep(900);

    const mode = await ev(`(() => {
      const a = document.getElementById('app');
      return a.classList.contains('compact') ? 'compact'
           : a.classList.contains('tabbar') ? 'tabbar'
           : a.classList.contains('onecol') ? 'onecol' : '-';
    })()`);

    /* 탭을 하나씩 눌러 본다. 판정: 그 탭이 요구하는 패널만 보이고 나머지는 안 보인다. */
    const tabs = await ev(`(async () => {
      const box = e => { const r = e.getBoundingClientRect(); return { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height) }; };
      const shown = e => !!(e && e.offsetWidth && e.offsetHeight);
      const app = document.getElementById('app');
      const live = app.classList.contains('onecol') || app.classList.contains('tabbar');
      const out = { live, strip:shown(document.getElementById('colTabs')), steps:[],
        보이는탭: [...document.querySelectorAll('#colTabs button')].filter(shown).map(b => b.dataset.col) };
      if (!live) return out;
      out.stripBox = box(document.getElementById('colTabs'));
      const want = { stage:[], inbox:['panelInbox'], staff:['panelBiz'], shop:['panelBiz'], log:['panelBiz'] };
      for (const k of ['inbox','staff','shop','log','stage']){
        const b = document.querySelector('#colTabs [data-col="' + k + '"]');
        if (!shown(b)) { out.steps.push({ tab:k, skip:'탭없음' }); continue; }
        b.click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const vis = ['panelInbox','panelBiz'].filter(pid => shown(document.getElementById(pid)));
        /* 무대 장식이 패널 위로 새는지 — 폰에서 이름표가 결재함 위에 떠 있었다 */
        const sw = document.querySelector('.stagewrap');
        const leak = app.classList.contains('tabbar') && k !== 'stage'
          && getComputedStyle(sw).visibility !== 'hidden';
        const body = k === 'inbox' ? document.getElementById('todoList')
                   : k === 'stage' ? document.getElementById('viewport')
                   : document.getElementById('rightBody');
        out.steps.push({ tab:k, vis, 무대샘: leak,
                         ok: JSON.stringify(vis) === JSON.stringify(want[k]) && !leak,
                         내용: body ? (body.textContent || '').trim().length : -1,
                         on: b.classList.contains('on') });
      }
      document.querySelector('#colTabs [data-col="inbox"]').click();
      return out;
    })()`);

    const geo = await ev(`(() => {
      const r = e => { const b = (typeof e === 'string' ? document.querySelector(e) : e); if (!b) return null;
        const x = b.getBoundingClientRect(); return { x:Math.round(x.x), y:Math.round(x.y), w:Math.round(x.width), h:Math.round(x.height) }; };
      const tb = document.getElementById('topbar');
      const de = document.documentElement;
      return { topbar:r(tb), 상단바줄: tb.offsetHeight > 62 ? '두 줄 이상' : '한 줄',
        무대:r('.stagewrap'), 결재함:r('#panelInbox'), 경영:r('#panelBiz'),
        바닥줄:r('.stagefoot'), 시계:r('.clockchip'), 카메라:r('.cambtn'),
        가로오버플로: de.scrollWidth - de.clientWidth,
        캔버스칠해짐: (() => { const cv = document.getElementById('gl');
          if (!cv || cv.style.display === 'none') return '2D';
          try { return cv.toDataURL().length > 5000 ? true : false; } catch(e){ return 'x'; } })() };
    })()`);

    const okMode = mode === c.want;
    const okTabs = !tabs.live || tabs.steps.every(s => s.skip || s.ok);
    const okBar = c.w > 700 || geo.상단바줄 === '한 줄';
    const okFlow = geo.가로오버플로 === 0;
    const pass = okMode && okTabs && okBar && okFlow && !errs.length;
    if (!pass) fail++;
    console.log(`\n${pass ? '✅' : '❌'} ${c.name}  ${c.w}×${c.h}  배치=${mode} (기대 ${c.want})`);
    console.log('   ' + JSON.stringify(geo));
    if (tabs.live){
      console.log('   보이는퇭: ' + JSON.stringify(tabs.보이는퇭));
      console.log('   퇭: ' + JSON.stringify(tabs.steps));
    }
    if (errs.length) console.log('   오류: ' + errs.slice(0, 4).join(' | '));

    const shot = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:c.w, height:c.h, scale:1 } });
    fs.writeFileSync(OUT + 'dist-' + c.name + '.png', Buffer.from(shot.data, 'base64'));
  }

  console.log(`\n${fail ? '❌ ' + fail + '건 실패' : '✅ 전부 통과'}`);
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
