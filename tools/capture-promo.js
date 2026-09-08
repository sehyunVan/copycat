/* ============================================================
   capture-promo.js — 홍보용 사진. **고양이가 주인공이다.**

   스토어 스크린샷(capture-store.js)과 목적이 다르다. 그쪽은 「이 게임이 무엇인가」를
   설명해야 해서 UI 가 보여야 하고, 이쪽은 **눈길을 끄는 것**이 일이라 UI 를 걷고
   고양이에 붙는다. 그래서 게임에 이미 있는 손잡이를 그대로 쓴다 —
   **카메라 모드**(#app.photo · 판을 걷고 방만 남긴다)와 **추적 카메라**
   (R3.followOn · followZoom · camSet). 목업을 그리지 않는다: 여기 찍히는 것은
   실제로 도는 시뮬레이션이고, 말풍선도 사람이 올린 결재를 고양이가 집어 든 것이다.

   ── 왜 http 로 띄우나 ──
   3D 렌더러가 모듈이라 file:// 에서는 안 뜬다(index.html 의 그 주석). 방과 고양이가
   없는 홍보 사진은 뜻이 없으므로 작은 정적 서버를 띄운다.

   실행: node tools/capture-promo.js [--n 8] [--out dist/promo]
   출력: dist/promo/00-loading.png · 01-cat.png …
   ============================================================ */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..') + path.sep;
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.join(ROOT, argOf('--out', 'dist/promo')) + path.sep;
const SHOTS = Math.max(1, +argOf('--n', 8) | 0);
const PORT = 9350, CDP = 9351;
/* 폰 세로. 스토어와 SNS 가 둘 다 좋아하는 비율이고, 이 게임은 세로로 쓰는 물건이다.
   배율 3 으로 찍어 1170x2532 — 도트 그림이라 정수배로 찍어야 선명하다. */
const W = 390, H = 844, DSF = 3;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('크롬을 못 찾았다'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json',
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, {
        'Content-Type': TYPE[path.extname(p).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      r.end(d);
    });
  }).listen(PORT);

  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + CDP,
    /* **프로필을 매번 버린다.** 캐시가 남으면 3D 가 바로 서서 로딩 판이 스쳐 지나가고,
       그러면 그 장을 못 찍는다. 저장도 같이 비워야 늘 같은 출발점에서 찍힌다. */
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-promo-' + Date.now()), 'about:blank'],
    { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) { console.error('크롬이 안 뜬다'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: true });

  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return null;
    return r.result ? r.result.value : null;
  };
  /* **찍기 전에 창을 걷는다.** 게임은 때가 되면 이야기 창을 스스로 띄우는데(첫 도장·
     분기 승급·사건), 그게 뜨면 그 뒤의 모든 장이 같은 창 사진이 된다 — 실제로 여덟
     장이 전부 「도장이 찍혔습니다」였다. 걷는 것은 사진을 위한 조작이 아니다:
     사람도 읽고 닫는 창이고, 닫아야 방이 보인다. */
  const clearVeils = async () => {
    await ev("document.querySelectorAll('.veil .okbtn, .veil [data-close], .veil .mfoot button')"
      + '.forEach(b => b.click())');
    await sleep(350);
    await ev("document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove())");
  };

  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(r.data, 'base64');
    fs.writeFileSync(OUT + name, buf);
    console.log('  ' + name.padEnd(24) + (buf.length / 1024).toFixed(0) + ' KB');
  };

  /* ---------- 1) 새 회사로 시작 ---------- */
  console.log('새 회사로 시작한다');
  const URL = 'http://localhost:' + PORT + '/index.html?mobile=1';
  /* 저장을 비운다 — 지난번 사무실이 남아 있으면 프롤로그도 로딩도 건너뛰고,
     사진에 지난 회사의 사건 카드가 찍힌다(실제로 그렇게 찍혔다). */
  await send('Page.navigate', { url: URL });
  await sleep(2000);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  await send('Page.navigate', { url: URL });

  /* ---------- 2) 사무실로 ---------- */
  console.log('사무실로 들어간다 (첫 판 — 프롤로그를 지난다)');
  for (let i = 0; i < 80; i++) {
    if (await ev("!!document.querySelector('#cctitle .go')")) break;
    await sleep(200);
  }
  await ev("(() => { const g = document.querySelector('#cctitle .go'); if (g) g.click(); })()");
  await sleep(2600);
  await ev("(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()"); await sleep(1200);
  await ev("(() => { const b = document.querySelector('#oLetterGo'); if (b) b.click(); })()"); await sleep(1200);
  await ev("(() => { const g = document.querySelector('#cnGo'); if (g) g.click(); })()"); await sleep(2800);
  await ev("(() => { const b = document.querySelector('.coach [data-tut=\"skip\"]'); if (b) b.click();"
    + " document.querySelectorAll('.veil,.coach,.coachring,#pwaBar').forEach(e => e.remove()); })()");
  await sleep(1500);

  /* ---------- 3) 로딩 화면 ----------
     **저장이 있어야 보이는 화면이다.** 새 회사로 켜면 프롤로그(검은 화면)로 가고,
     시작화면은 z-index 9999 로 로딩 판(9500)을 덮는다 — 그래서 켜자마자 찍으면
     시작화면이, 새 회사에서 찍으면 프롤로그의 검은 화면이 찍힌다(둘 다 찍어 봤다).
     사무실을 한 번 만든 **뒤에** 다시 열고, 「게임 시작」을 누른 그 순간에 찍는다.
     걷히는 조건은 body.r3ready 다(js/ui.js). */
  console.log('로딩 화면 (사무실이 있는 판에서)');
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 100; i++) {
    if (await ev("!!document.querySelector('#cctitle .go')")) break;
    await sleep(200);
  }
  await ev("(() => { const g = document.querySelector('#cctitle .go'); if (g) g.click(); })()");
  let caught = false;
  for (let i = 0; i < 200; i++) {
    const on = await ev('(() => {'
      + " const g = document.querySelector('#loadgate'); if (!g) return 0;"
      + ' const cs = getComputedStyle(g);'
      + " if (cs.visibility === 'hidden' || +cs.opacity < 0.9 || !g.offsetHeight) return 0;"
      + " const t = document.querySelector('#cctitle');"
      + " if (t && getComputedStyle(t).display !== 'none' && t.offsetHeight) return 0;"
      + " if (document.querySelector('.opening')) return 0;"
      + " const w = g.querySelector('.lword'); return w && w.offsetHeight ? 1 : 0; })()");
    if (on) { caught = true; break; }
    await sleep(60);
  }
  await shot('00-loading.png');
  if (!caught) console.log('      (로딩 판을 못 잡았다 — 다른 화면이 찍혔을 수 있다)');
  /* 게임이 서기를 기다린다 — 이 뒤부터 고양이 사진이다 */
  for (let i = 0; i < 60; i++) {
    if (await ev("document.body.classList.contains('r3ready')")) break;
    await sleep(300);
  }
  await sleep(1500);
  await ev("(() => { const b = document.querySelector('.coach [data-tut=\"skip\"]'); if (b) b.click();"
    + " document.querySelectorAll('.veil,.coach,.coachring,#pwaBar').forEach(e => e.remove()); })()");
  await sleep(800);

  /* 결재를 올린다 — 고양이가 컴퓨터 앞에서 그 이름을 말한다(sim.js sayTask).
     그래서 말풍선이 진짜 문장이 된다: 「빨래 개기」 하는 중… */
  const TASKS = ['분기 보고서 정리', '빨래 개기', '장부 맞추기', '이사 준비'];
  console.log('결재를 올린다: ' + TASKS.join(' · '));
  /* 폰 배치에서는 결재함이 **탭**이다 — 그 탭에 있어야 입력칸이 화면에 있다 */
  await ev("(() => { const b = document.querySelector('#colTabs button[data-col=\"inbox\"]');"
    + ' if (b) b.click(); })()');
  await sleep(900);
  for (const t of TASKS) {
    await ev("(() => { const i = document.querySelector('#todoInput'); if (!i) return;"
      + ' i.value = ' + JSON.stringify(t) + "; i.dispatchEvent(new Event('input', { bubbles:true }));"
      + " const b = document.querySelector('#btnAdd'); if (b) b.click(); })()");
    await sleep(350);
  }
  /* **체크까지 해야 서류가 된다.** 올리기만 하고 기다렸더니 아무도 일을 안 해서
     일하는 장면을 두 번 놓쳤다 — 체크가 결재함에 서류를 떨어뜨리고, 고양이는 그
     서류를 가지러 간다(capture-store.js 가 쓰던 그 길이다). */
  await ev("document.querySelectorAll('#todoList .todo .chk').forEach((b, i) => { if (i < 3) b.click(); })");
  await ev("(() => { try { S.anchovy = Math.max(S.anchovy | 0, 4000); save(); return 1; }"
    + ' catch (e){ return 0; } })()');            /* 값이 0 이면 홍보 사진에 안 좋다 */

  /* 상태가 될 때까지 **기다린다.** 고양이는 걸어가서 앉고 나서 일한다 — 9초를 세고
     찍었더니 그 사이에 아무도 책상에 없었다. 시뮬레이션의 시계는 진짜 시계다. */
  const waitFor = async (label, pick, ms) => {
    const until = Date.now() + (ms || 90000);
    while (Date.now() < until) {
      const ok = await ev('(() => { try { return !!(' + pick + '); } catch (e){ return false; } })()');
      if (ok) return true;
      await sleep(1500);
    }
    console.log('      (' + label + ' — ' + Math.round((ms || 90000) / 1000) + '초 기다려도 안 왔다)');
    return false;
  };

  /* ---------- 4) 카메라 모드 ---------- */
  console.log('카메라 모드 — 판을 걷고 고양이에 붙는다');
  await ev("(() => { const b = document.querySelector('.photobtn'); if (b) b.click();"
    + " else document.querySelector('#app').classList.add('photo'); })()");
  /* 카메라 모드는 **나가는 문**(사진 단추)을 일부러 남긴다 — 사람에게는 맞는 선택이지만
     사진에는 남으면 안 된다. 그래서 촬영 동안만 그 단추까지 걷는다. */
  await ev("(() => { const st = document.createElement('style'); st.id = 'promo';"
    + " st.textContent = '.photobtn,.cambtn,#btnCam,.parcelbtn,.stagestack{display:none!important}';"
    + ' document.head.appendChild(st); })()');
  /* 천장등을 켠다. 이 게임의 방은 어둡게 설계됐고(eerie) 그건 그대로 두는 게 맞지만,
     홍보 사진에서 주인공이 안 보이면 그림이 아니다 — 등은 게임 안에서도 켜는 것이다. */
  await ev('(() => { try { R3.setCeiling(true); return 1; } catch (e){ return 0; } })()');
  await sleep(900);

  /* ── 한 마리를 **지정해서** 겨눈다 ──
     추적 카메라(followOn)는 고양이를 돌아가며 잡아 주지만, 무엇을 하는 중인지는
     고르지 못한다 — 열 장 중 여덟 장이 「걸어가는 뒷모습」이 됐다. 그래서 상태로
     고르고(일하는 중 · 자는 중 · 노는 중) 그 자리를 직접 본다(camSet at). */
  const aim = async (name, pick, look, opt) => {
    const o = opt || {};
    const who = await ev('(() => { try {'
      + ' const c = ' + pick + '; if (!c) return null;'
      + ' R3.followOn(false);'
      + ' R3.camSet({ at:{ x:c.x, y:c.y, up:' + (o.up != null ? o.up : 0.62) + ' },'
      + '   az:' + look.az + ', el:' + look.el + ', zoom:' + look.z + ' });'
      + " return (c.name || '고양이') + ' · ' + ((c.act && c.act.s) || '-');"
      + ' } catch (e){ return null; } })()');
    if (!who) { console.log('  (' + name + ' — 그런 고양이가 지금 없다, 건너뜀)'); return false; }
    await sleep(1100);
    await clearVeils();
    /* 말풍선이 있는 장은 그것이 사진의 절반이다 — 뜰 때까지 조금 기다린다 */
    if (o.bubble) {
      for (let i = 0; i < 24; i++) {
        const t = await ev("(() => { const b = document.querySelector('#tags3d .bubble');"
          + " return b && b.offsetHeight ? b.textContent.trim() : ''; })()");
        if (t) { console.log('      말풍선: ' + t.slice(0, 28)); break; }
        await sleep(400);
      }
    }
    await shot(name);
    return true;
  };

  const WORK = "S.cats.find(c => c.act && (c.act.s === 'work' || c.act.s === 'stamp'))";
  const SLEEP = "S.cats.find(c => c.act && c.act.s === 'sleep')";
  const PLAY = "S.cats.find(c => c.act && c.act.s === 'use')";
  const ANY = 'S.cats[0]';

  console.log('고양이 사진');
  /* **일하는 장면이 먼저다.** 이 게임의 한 문장이 그것이고("체크하면 고양이가 서류를
     처리한다"), 자게·놀게 만드는 것은 그 뒤에 해야 한다 — 먼저 재우면 일할 고양이가
     없어진다(처음에 그렇게 해서 두 장을 놓쳤다). */
  await waitFor('일하는 고양이', WORK, 120000);
  /* **각도를 낮추면 가구를 파고든다.** 눈높이(el 0.3 근처)에서 겨누면 책상·칸막이가
     화면을 반쯤 덮는 장이 나온다 — 열 장 중 두 장이 그랬다. 그래서 기본은 내려다보는
     각(el 0.6 이상)이고, 낮은 각은 **한 장만** 남긴다: 잘 걸리면 그게 제일 좋은 사진이다. */
  await aim('01-work.png', WORK, { az: 0.72, el: 0.66, z: 0.22 }, { bubble: true });
  await aim('02-work-close.png', WORK, { az: 1.85, el: 0.32, z: 0.17 }, { bubble: true, up: 0.7 });

  /* 이제 한 마리를 재운다. 값만 밀어 주고 어디서 잘지는 시뮬레이션이 정한다. */
  await ev("(() => { try { const c = S.cats[S.cats.length - 1]; if (!c) return 0;"
    + ' c.needs.energy = 4; save(); return 1; } catch (e){ return 0; } })()');
  await waitFor('자는 고양이', SLEEP, 90000);
  await aim('03-sleep.png', SLEEP, { az: 2.35, el: 0.80, z: 0.24 });

  /* 노는 장면은 **놀 물건이 있어야** 난다(캣타워·장난감). 첫 사무실에는 없을 수 있어서
     기다리는 시간을 짧게 두고, 없으면 그 장은 건너뛴다. */
  await ev("(() => { try { const c = S.cats[0]; if (!c) return 0;"
    + ' c.needs.fun = 4; save(); return 1; } catch (e){ return 0; } })()');
  await waitFor('노는 고양이', PLAY, 45000);
  await aim('04-play.png', PLAY, { az: -0.30, el: 0.68, z: 0.22 });
  await aim('05-walk.png', ANY, { az: 0.30, el: 0.58, z: 0.20 });

  /* 방 전체 — 「고양이들이 사는 사무실」이 한 장에 들어가야 한다. 위에서 살짝 내려다본다. */
  console.log('사무실 전경');
  await ev('(() => { try { R3.followOn(false); R3.camSet({ center:true, az:0.72, el:0.78, zoom:0.62 });'
    + ' return 1; } catch (e){ return 0; } })()');
  await sleep(1400);
  await clearVeils();
  await shot('06-office.png');
  await ev('(() => { try { R3.camSet({ center:true, az:2.35, el:0.55, zoom:0.52 }); return 1; }'
    + ' catch (e){ return 0; } })()');
  await sleep(1400);
  await clearVeils();
  await shot('07-office-side.png');

  /* 마지막 한 장은 **추적 카메라 그대로** — 게임 안에서 사람이 보는 그 구도다 */
  await ev('(() => { try { R3.followZoom(0.24); R3.followOn(true); return 1; } catch (e){ return 0; } })()');
  await sleep(3200);
  await clearVeils();
  await shot('08-follow.png');

  console.log('');
  console.log('나온 곳: ' + OUT);
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
