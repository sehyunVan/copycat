/* 시작화면 배경 네 조건 —
   1. 엔딩 본 뒤 → B(정경)   2. 엔딩 본 뒤 리셋 → A(사무실)
   3. 엔딩 전 → A            4. 엔딩 본 뒤 사무실은 이어진다 */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const ROOT = process.env.ROOT_DIR || 'c:/Users/sehyu/playground/copycat/';
const PORT = +(process.env.PORT || 9404), CDP = PORT + 1;
const TAG = process.env.TAG || 'vi';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };

(async () => {
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPE[path.extname(p).toLowerCase()] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
      r.end(d);
    });
  }).listen(PORT);
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + CDP,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-vi-' + Date.now()), 'about:blank'],
    { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return '**터짐** ' + ((r.exceptionDetails.exception || {}).description || '').split('\n')[0];
    return r.result ? r.result.value : null;
  };
  const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(__dirname + '/' + n + '.png', Buffer.from(r.data, 'base64')); };

  const URL = 'http://localhost:' + PORT + '/index.html?mobile=1';
  const vis = sel => "(() => !![...document.querySelectorAll(" + JSON.stringify(sel) + ")].find(x => x && !x.hidden && x.offsetHeight > 0))()";
  const click = sel => ev("(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")].find(x => x && !x.hidden && x.offsetHeight > 0); if (e) { e.click(); return 1; } return 0; })()");
  const until = async (l, e, ms) => { const end = Date.now() + (ms || 40000);
    while (Date.now() < end) { if (await ev(e)) return true; await sleep(500); } console.log('   (' + l + ' 안 나옴)'); return false; };

  /* 배경이 A 인가 B 인가 — 세 가지를 같이 본다.
     · #cctitle.vista 클래스   · 격자가 서 있나(outroInfo.built)   · 추적 카메라가 켜졌나 */
  const which = async () => {
    const r = await ev(`(() => {
      const t = document.querySelector('#cctitle');
      const cls = t ? t.className : '없음';
      let built = '?', on = '?';
      try { const i = R3.outroInfo(); built = i.built; on = i.on; } catch (e) {}
      let follow = '?';
      try { follow = R3.following(); } catch (e) {}
      const key = (() => { try { return localStorage.getItem('copycat.ending'); } catch (e){ return '?'; } })();
      return JSON.stringify({ cls, built, on, follow, key });
    })()`);
    const o = JSON.parse(r);
    const isB = /\bvista\b/.test(o.cls) && o.built === true;
    return { ...o, ans: isB ? 'B(정경)' : 'A(사무실)' };
  };

  const toOffice = async () => {
    await click('#cctitle .go'); await sleep(2200);
    await ev("(() => { try { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); } catch (e) {} })()");
    if (await until('편지', vis('#oLetterGo'), 30000)) await click('#oLetterGo');
    if (await until('계약서', vis('#cnGo'), 30000)) await click('#cnGo');
    /* 지점 등록이 뜨면 그대로 등록한다(기본 간판이 들어가는지도 같이 본다) */
    if (await until('지점등록', vis('#brGo'), 20000)) await click('#brGo');
    await until('방', "(() => document.body.classList.contains('r3ready') && !document.querySelector('.opening'))()", 60000);
    await sleep(1500);
    await click('.coach [data-tut="skip"]');
    await ev("document.querySelectorAll('.veil,.coach,.coachring,#pwaBar').forEach(e => e.remove())");
    await sleep(600);
  };

  /* ── ③ 엔딩 전 ── */
  await send('Page.navigate', { url: URL }); await sleep(1600);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  await send('Page.navigate', { url: URL });
  await until('시작화면', vis('#cctitle .go'), 40000);
  await sleep(3000);
  console.log('③ 엔딩 전            → ' + JSON.stringify(await which()));
  await shot(TAG + '-3-before');

  /* 사무실로 들어가서 엔딩을 본다 */
  await toOffice();
  const anch0 = await ev('(() => { try { return Math.round(S.anchovy) + "/" + S.day + "/" + (S.branch.logo||"없음"); } catch (e){ return "?"; } })()');
  await ev('(() => { try { S.anchovy = 777777; save(); return 1; } catch (e){ return 0; } })()');
  console.log('   사무실 세움 (멸치/날/간판 ' + anch0 + ' → 멸치 777777 로 표시)');
  await ev('(() => { try { return String(playOutro()); } catch (e){ return "터짐"; } })()');
  await until('엔딩 끝', "(() => !document.querySelector('.outro'))()", 90000);
  await sleep(1200);

  /* ── ④ 엔딩 본 뒤 사무실은 이어지나 ── */
  console.log('④ 엔딩 직후 사무실   → ' + await ev(`(() => {
    const has = (() => { try { return !!(S && S.cats && S.cats.length); } catch (e){ return false; } })();
    let g = '?'; try { g = R3.outroInfo().built; } catch (e) {}
    return JSON.stringify({ 저장있음: has,
      멸치: (() => { try { return Math.round(S.anchovy); } catch (e){ return '?'; } })(),
      ending: (() => { try { return S.ending; } catch (e){ return '?'; } })(),
      격자남음: g, titleon: document.body.classList.contains('titleon'),
      키: (() => { try { return localStorage.getItem('copycat.ending'); } catch (e){ return '?'; } })() });
  })()`));
  await shot(TAG + '-4-after');

  /* ── ① 엔딩 본 뒤 새로고침 ── */
  await send('Page.navigate', { url: URL });
  await until('시작화면', vis('#cctitle .go'), 40000);
  await sleep(4000);
  console.log('① 엔딩 본 뒤        → ' + JSON.stringify(await which()));
  await shot(TAG + '-1-seen');

  /* ── ② 엔딩 본 뒤 리셋 ── */
  await click('#cctitle .go'); await sleep(2500);
  await until('방', "(() => document.body.classList.contains('r3ready'))()", 60000);
  await ev("document.querySelectorAll('.veil,.coach,.coachring,#pwaBar,.opening').forEach(e => e.remove())");
  await sleep(800);
  /* 처음부터 — confirm 을 통과시킨다 */
  await ev('window.confirm = () => true');
  const reset = await ev("(() => { const b = document.querySelector('#btnReset'); if (!b) return '단추 없음'; b.click(); return 'eq'; })()");
  console.log('   리셋 단추 : ' + reset);
  await sleep(2500);
  console.log('   리셋 직후 키 : ' + await ev("(() => { try { return localStorage.getItem('copycat.ending'); } catch (e){ return '?'; } })()")
    + ' · S.ending ' + await ev('(() => { try { return S.ending; } catch (e){ return "?"; } })()')
    + ' · 멸치 ' + await ev('(() => { try { return Math.round(S.anchovy); } catch (e){ return "?"; } })()'));
  await send('Page.navigate', { url: URL });
  await until('시작화면', vis('#cctitle .go'), 40000);
  await sleep(4000);
  console.log('② 리셋 뒤            → ' + JSON.stringify(await which()));
  await shot(TAG + '-2-reset');

  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
