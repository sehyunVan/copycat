/* 안드로이드 두 가지 —
   ① 아래에 뜨는 판이 내비 바·탭 막대에 안 가리나 (안내판 · 토스트)
   ② 뒤로 단추가 한 겹씩 벗기고 마지막에 앱을 닫나
   가짜 Capacitor 를 **문서보다 먼저** 심어서 backButton 손잡이를 붙잡는다. */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const ROOT = process.env.ROOT_DIR || 'c:/Users/sehyu/playground/copycat/';
const PORT = +(process.env.PORT || 9408), CDP = PORT + 1;
const TAG = process.env.TAG || 'and';
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
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-and-' + Date.now()), 'about:blank'],
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

  /* 가짜 Capacitor — 문서보다 먼저 선다. 안전영역도 여기서 흉내 낸다(헤드리스는 0이다). */
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__exit = 0; window.__back = null;
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android',
      Plugins: { App: {
        addListener: (name, fn) => { if (name === 'backButton') window.__back = fn; return { remove(){} }; },
        exitApp: () => { window.__exit++; },
      } } };
    /* 3버튼 내비를 쓰는 기기를 흉내 낸다 — env() 를 못 심으니 변수로 덮는다.
       (.coach 는 JS 가 재므로 그쪽은 탭 막대 몫만 검사된다) */
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = ':root{--safeb:48px !important}';
      document.head.appendChild(st);
    });
  ` });

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
  const back = async () => { await ev('(() => { if (window.__back) window.__back({}); return 1; })()'); await sleep(700); };

  /* 진짜 안전영역을 먹여 본다 — 크롬이 받아 주면 env() 가 실제로 48px 이 된다.
     (안 받아 주면 위 CSS 변수 흉내만 남는다 — 그때는 탭 막대 몫만 검사된다) */
  const safeOK = await send('Emulation.setSafeAreaInsetsOverride',
    { insets: { top: 0, left: 0, bottom: 48, right: 0 } });
  console.log('안전영역 주입 : ' + (safeOK && safeOK.error ? '거부' : '됨'));

  await send('Page.navigate', { url: URL }); await sleep(1800);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  await send('Page.navigate', { url: URL });
  await until('시작화면', vis('#cctitle .go'), 40000);
  await click('#cctitle .go'); await sleep(2200);
  await ev("(() => { try { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); } catch (e) {} })()");
  if (await until('편지', vis('#oLetterGo'), 30000)) await click('#oLetterGo');
  if (await until('계약서', vis('#cnGo'), 30000)) await click('#cnGo');
  if (await until('지점등록', vis('#brGo'), 20000)) await click('#brGo');
  await until('방', "(() => document.body.classList.contains('r3ready') && !document.querySelector('.opening'))()", 60000);
  await sleep(2500);

  console.log('── ① 아래에 뜨는 판');
  console.log('   backButton 손잡이 : ' + await ev('!!window.__back'));
  /* 안내판을 몇 걸음 넘겨 본다 — 걸음마다 자리가 다르다 */
  for (let i = 0; i < 6; i++){
    const r = await ev(`(() => {
      const c = document.querySelector('.coach'); if (!c) return '안내판 없음';
      const b = c.getBoundingClientRect();
      const app = document.querySelector('#app');
      const bar = document.querySelector('.tabbar-dock, .tabs, nav') || null;
      const probe = (() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;bottom:0;height:var(--safeb,0px);width:1px;visibility:hidden';
        document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; })();
      const tabH = (() => { try { const v = parseFloat(getComputedStyle(app).getPropertyValue('--tabbar')); return isFinite(v)?v:54; } catch(e){ return 54; } })();
      const 벽 = innerHeight - probe - tabH;
      return JSON.stringify({ 걸음: (c.querySelector('.cstep')||{}).textContent || '?',
        아래끝: Math.round(b.bottom), 벽: Math.round(벽), 창: innerHeight,
        가림: Math.round(b.bottom - 벽) });
    })()`);
    console.log('   ' + r);
    if (i === 0) await shot(TAG + '-coach');
    if (!(await click('.coach [data-tut="next"], .coach .cacts .buy:not(.quit)'))) break;
    await sleep(900);
  }
  /* 토스트도 본다 */
  await ev("(() => { try { toast('테스트 토스트'); } catch (e) {} })()");
  await sleep(400);
  console.log('   토스트 : ' + await ev(`(() => { const t = document.querySelector('.toast');
    if (!t) return '없음'; const b = t.getBoundingClientRect();
    return JSON.stringify({ 아래끝: Math.round(b.bottom), 창: innerHeight,
      바닥까지: Math.round(innerHeight - b.bottom) }); })()`));

  await click('.coach [data-tut="skip"]');
  await ev("document.querySelectorAll('.veil,.coach,.coachring,#pwaBar').forEach(e => e.remove())");
  await sleep(600);

  console.log('── ② 뒤로 단추');
  await ev("(() => { try { showSettings(); } catch (e) {} })()"); await sleep(900);
  console.log('   창 열고 뒤로   : 창 ' + await ev("!!document.querySelector('.veil')") + ' →');
  await back();
  console.log('                    창 ' + await ev("!!document.querySelector('.veil')") + ' · 종료 ' + await ev('window.__exit'));

  await ev("(() => { const b = document.querySelector('#colTabs button[data-col=\"staff\"]'); if (b) b.click(); })()");
  await sleep(900);
  console.log('   탭 옮기고 뒤로 : ' + await ev("(document.querySelector('#app')||{}).dataset ? document.querySelector('#app').dataset.col : '?'") + ' →');
  await back();
  console.log('                    ' + await ev("document.querySelector('#app').dataset.col || 'stage'") + ' · 종료 ' + await ev('window.__exit'));

  await back();
  console.log('   맨 위에서 뒤로 : 토스트 「' + await ev("(() => { const t = document.querySelector('.toast'); return t ? t.textContent.slice(0,24) : '없음'; })()") + '」 · 종료 ' + await ev('window.__exit'));
  await back();
  console.log('   한 번 더       : 종료 ' + await ev('window.__exit') + ' (1 이어야 한다)');
  await sleep(2600);
  await back();
  console.log('   한참 뒤 한 번  : 종료 ' + await ev('window.__exit') + ' (아직 1 — 다시 물어야 한다)');

  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
