/* ============================================================
   capture-store-promo.js — 스토어에 거는 **꾸민** 스크린샷 여섯 장.

   `capture-ios.js` 는 게임 화면을 그대로 뜬다. 그건 심사에 내는 증거지 홍보물이
   아니다 — 스토어 목록에서 사람이 보는 것은 엄지손톱만 한 그림 여섯 개이고,
   그 크기에서는 UI 의 잔글씨가 하나도 안 읽힌다. 읽히는 것은 **한 줄**뿐이다.

   ── 어떻게 꾸미나 ──
   새 비주얼을 만들지 않는다. 이 게임에는 이미 자기 서식이 있다:
   창 머리의 작은 대문자 코드 한 줄 + 그 아래 한국어 제목(ui.js 의 `.mhead .q`).
   스토어 장도 그 문법을 그대로 쓴다.

     CODE / 02              ← 작은 대문자 · 자간 넓게
     큰 한 줄               ← 갈무리 볼드. 이 장이 하는 말 전부
     받쳐 주는 한 줄        ← 흐린 글자. 없어도 되는 말이라 작게
     [ 게임 화면 ]          ← 둥근 카드. 아래로 잘려 나간다(화면은 계속된다)

   바탕은 게임의 종이색이고 글자는 게임의 잉크색이다. 여섯 장이 같은 바탕에
   같은 자리로 서야 **한 벌**로 읽힌다 — 스토어 목록은 옆으로 미는 판이라
   장마다 구도가 다르면 여섯 개의 다른 게임처럼 보인다.

   ── 글은 게임이 이미 한 말로 ──
   광고 문구를 새로 쓰지 않는다. 사규(showHelp)와 인수인계 편지에 있는 문장을
   줄여서 쓴다. 그래야 받고 나서 「그 화면」이 나온다.

   실행:
     node tools/pack-mobile.js       # 배포본을 먼저 굽는다 (찍는 대상이 이것이다)
     node tools/serve-mobile.js      # 다른 창에서 띄운다
     node tools/capture-store-promo.js [--lang ko|en|ja] [--out dist/store/promo]
   출력: <out>/01..06-*.png  (1290×2796 · 24비트 PNG)
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const LANG = argOf('--lang', 'ko');
const OUT = path.join(ROOT, argOf('--out', path.join('dist', 'store', 'promo')));
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8188';
/* 6.9" 아이폰 = 430×932 논리 픽셀 × 3. 플레이도 이 크기를 그대로 받는다
   (세로 스크린샷 · 최대 3840px · 가로세로비 2:1 이내). */
const W = 430, H = 932, SCALE = 3;
const PORT = 9420 + (process.pid % 40);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 장 여섯 ──
   code  창 머리의 그 대문자 줄
   lead  큰 한 줄 — 이 장이 하는 말
   sub   받쳐 주는 한 줄
   tone  paper(밝은 종이) | night(어두운 판) — 장면의 밝기에 맞춘다 */
const PANELS = [
  { id: '01-office', code: 'OFFICE', tone: 'paper',
    lead: { ko: '사무실 시계는\n당신의 시계입니다',
            en: 'The office clock\nis your clock',
            ja: '事務所の時計は\nあなたの時計です' },
    sub:  { ko: '12시엔 밥, 18시엔 퇴근. 하루를 같이 넘깁니다.',
            en: 'Lunch at noon, home at six. It gets through the day with you.',
            ja: '12時にごはん、18時に退勤。一日を一緒に越えます。' } },
  { id: '02-inbox', code: 'INBOX', tone: 'paper',
    lead: { ko: '할 일을 올리면\n고양이가 물고 갑니다',
            en: 'Add a task and\na cat carries it off',
            ja: 'やることを上げると\n猫がくわえて運びます' },
    sub:  { ko: '자기 자리에 앉아 도장을 찍어야 멸치가 들어옵니다.',
            en: 'They must sit down and stamp it before the anchovies arrive.',
            ja: '自分の席で判を押して、はじめて煮干しが入ります。' } },
  { id: '03-staff', code: 'PERSONNEL', tone: 'paper',
    lead: { ko: '고양이는\n스스로 움직입니다',
            en: 'The cats move\non their own',
            ja: '猫は自分で\n動きます' },
    sub:  { ko: '기력·재미·화장실·카페인 — 알아서 챙기러 갑니다.',
            en: 'Energy, fun, litter, caffeine — they go and see to it themselves.',
            ja: '元気・楽しさ・トイレ・カフェイン——自分で片づけに行きます。' } },
  { id: '04-shop', code: 'SUPPLIES', tone: 'paper',
    lead: { ko: '번 멸치로\n사무실을 채웁니다',
            en: 'Fill the office\nwith what you earn',
            ja: '稼いだ煮干しで\n事務所を埋めます' },
    sub:  { ko: '커피머신·낮잠상자·캣타워 — 사면 방에 실제로 놓입니다.',
            en: 'Coffee machine, nap box, cat tower — what you buy really goes in the room.',
            ja: 'コーヒーメーカー・昼寝箱・キャットタワー——買えば実際に部屋に置かれます。' } },
  /* 한때 이 자리가 **상자 구매 창**이었다. 스토어 목록에서 그 장은 「돈 내는 화면」 하나로
     읽힌다 — 파는 물건을 보여 주는 것과 사라고 하는 것은 다르다. 상자를 뜯는 컷신으로도
     바꿔 봤는데, 그 컷은 움직여야 읽히는 그림이라 한 장으로 세우면 얼굴 클로즈업일 뿐이었다.
     심사에 낼 결제 화면은 capture-ios.js 쪽(03-parcel.png)에 그대로 있다. */
  { id: '05-decor', code: 'DECORATE', tone: 'paper',
    lead: { ko: '놓는 자리까지\n당신이 정합니다',
            en: 'You decide\nwhere everything sits',
            ja: '置く場所まで\nあなたが決めます' },
    sub:  { ko: '벽지도 바닥도 함께 바꿉니다.',
            en: 'The wallpaper and the floor change with it.',
            ja: '壁紙も床も一緒に変えられます。' } },
  { id: '06-board', code: 'BRANCH BOARD', tone: 'paper',
    lead: { ko: '다른 지점의\n결재함을 들여다봅니다',
            en: 'Look in on\nanother branch',
            ja: '別の支店の\n決裁箱をのぞきます' },
    sub:  { ko: '코드 하나로 이어집니다. 방해하지는 못합니다.',
            en: 'One code links you. Neither of you can interfere.',
            ja: 'コードひとつでつながります。邪魔はできません。' } },
];

const L = o => (o && (o[LANG] != null ? o[LANG] : o.ko)) || '';

/* ── 꾸민 장 한 판 ──
   게임 화면은 data URI 로 박는다. 바깥에서 파일을 불러오면 헤드리스가 그리기 전에
   찍히는 일이 생긴다(실제로 한 번 흰 칸을 찍었다). */
function poster(p, dataURI){
  const night = p.tone === 'night';
  const bg    = night ? '#1E1813' : '#EFE6D6';
  const ink   = night ? '#F2E8D8' : '#413324';
  const soft  = night ? '#A08F7B' : '#8B7A68';
  const code  = night ? '#C8944F' : '#B08A4E';
  const rule  = night ? 'rgba(242,232,216,.20)' : 'rgba(65,51,36,.18)';
  const lift  = night ? '0 22px 52px rgba(0,0,0,.55)' : '0 22px 46px rgba(74,55,40,.30)';
  const lead = L(p.lead).split('\n').map(x => `<span>${x}</span>`).join('');
  return `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:'Galmuri11';src:url('assets/font/Galmuri11.woff2') format('woff2');font-weight:400;font-display:block}
  @font-face{font-family:'Galmuri11';src:url('assets/font/Galmuri11-Bold.woff2') format('woff2');font-weight:700 900;font-display:block}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:${bg};font-family:'Galmuri11',sans-serif;color:${ink};
    display:flex;flex-direction:column;-webkit-font-smoothing:none}
  /* 위쪽 말 — 여백이 이 판의 절반이다. 빽빽하면 홍보물이 아니라 안내문이 된다 */
  .head{padding:60px 34px 0;flex:0 0 auto}
  .code{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:700;
    letter-spacing:.26em;color:${code};margin-bottom:16px}
  .code i{display:block;flex:1 1 auto;height:1px;background:${rule};font-style:normal}
  .lead{font-size:27px;font-weight:700;line-height:1.42;letter-spacing:-.4px}
  .lead span{display:block}
  .sub{margin-top:13px;font-size:12.5px;line-height:1.75;color:${soft};max-width:344px}
  /* 아래 그림 — **잘려 나간다.** 한 화면을 통째로 넣으면 그 안의 잔글씨까지 들어가고,
     엄지손톱 크기에서는 그게 전부 회색 얼룩이다. 위쪽만 보여 주고 잘라 낸다. */
  .shot{flex:1 1 auto;position:relative;margin:34px 34px 0;min-height:0}
  .shot .frame{position:absolute;left:0;right:0;top:0;height:calc(100% + 40px);
    border-radius:20px 20px 0 0;overflow:hidden;box-shadow:${lift};
    background:${night ? '#100C08' : '#fff'}}
  .shot img{display:block;width:100%;height:auto}
</style>
<div class="head">
  <div class="code">${p.code}<i></i>${p.n} / ${PANELS.length}</div>
  <div class="lead">${lead}</div>
  <div class="sub">${L(p.sub)}</div>
</div>
<div class="shot"><div class="frame"><img src="${dataURI}"></div></div>`;
}

(async () => {
  try { const r = await fetch(BASE + '/index.html'); if (!r.ok) throw new Error('HTTP ' + r.status); }
  catch (e){ console.log(BASE + ' 가 안 열린다 — node tools/serve-mobile.js 를 먼저 켠다.'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });

  const dir = path.join(process.env.TEMP || '.', 'cdp-promo-' + PORT);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + dir, 'about:blank'], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 160 && !page; i++){
    try { page = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page){ chrome.kill(); throw new Error('크롬이 ' + PORT + ' 에서 안 떴다'); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });

  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return null;
    return r && r.result ? r.result.value : null;
  };
  const png = async () => (await send('Page.captureScreenshot', { format: 'png' })).data;
  const vis = sel => "(() => !![...document.querySelectorAll(" + JSON.stringify(sel) + ")].find(x => x && !x.hidden && x.offsetHeight > 0))()";
  const click = sel => ev("(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")].find(x => x && !x.hidden && x.offsetHeight > 0); if (e) { e.click(); return 1; } return 0; })()");
  const until = async (l, e, ms) => { const end = Date.now() + (ms || 45000);
    while (Date.now() < end) { if (await ev(e)) return true; await sleep(500); } console.log('   (' + l + ' 안 나옴)'); return false; };
  const clear = () => ev("document.querySelectorAll('.veil').forEach(v => v.remove())");

  /* ── 사무실까지 ── */
  const URL = BASE + '/index.html?mobile=1';
  await send('Page.navigate', { url: URL }); await sleep(1800);
  await ev("(() => { try { localStorage.clear(); sessionStorage.clear();"
    + " localStorage.setItem('copycat.lang', " + JSON.stringify(LANG) + "); return 1; } catch (e){ return 0; } })()");
  await send('Page.navigate', { url: URL });
  await until('시작화면', vis('#cctitle .go'));
  await click('#cctitle .go'); await sleep(2500);

  /* ── 프롤로그를 **확실히** 지나간다 ──
     여기서 두 번 헛디뎠다(2026-09-11).
       · 소리 문(「▶ 재생」)을 안 눌러 그 앞에서 멈췄다 — 여섯 장이 전부 그 검은 화면이었다
       · `CCOpen.jump('letter')` 를 **아직 안 돌아가는 컷신**에 불러서 아무 일도 안 났고,
         그 다음에 부른 것은 그 장을 **다시 시작**시켰다(opening.js 의 jump 주석)
     그래서 순서를 지킨다: 소리 문을 누른다 → 컷신이 도는 것을 확인한다 → 한 번만 건너뛴다.
     그리고 **화면을 보고** 기다린다. 못 넘어가면 그 자리를 찍어 둔다(promo-stuck.png). */
  const step = async (label, ms) => {
    const st = await ev(`(() => {
      const t = s => { const e = document.querySelector(s); return e && e.offsetHeight ? '있음' : '없음'; };
      return [ '.opening ' + t('.opening'), '재생 ' + (function(){ const b = [...document.querySelectorAll('button,.go,.okbtn')]
        .find(x => x.offsetHeight && /재생|Play|再生/.test((x.textContent||'').trim())); return b ? '있음' : '없음'; })(),
        '편지 ' + t('#oLetterGo'), '계약서 ' + t('#cnGo'), '지점 ' + t('#brGo'),
        '방 ' + (document.body.classList.contains('r3ready') ? '섰음' : '아직') ].join(' · ');
    })()`);
    console.log('   [' + label + '] ' + st);
  };

  for (let k = 0; k < 10; k++){
    const hit = await ev("(() => { const b = [...document.querySelectorAll('button, .go, .okbtn')]"
      + ".find(x => x.offsetHeight && /재생|Play|再生/.test((x.textContent||'').trim()));"
      + ' if (b) { b.click(); return 1; } return 0; })()');
    if (hit) break;
    await sleep(700);
  }
  await sleep(1500);
  await step('소리 문');

  /* 컷신이 실제로 도는 것을 본 다음에 **한 번만** 건너뛴다 */
  await until('컷신 시작', "(() => { try { return !!(window.CCOpen && CCOpen.playing()); } catch (e){ return false; } })()", 20000);
  await ev("(() => { try { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); } catch (e) {} })()");
  if (await until('편지', vis('#oLetterGo'), 60000)) await click('#oLetterGo');
  await step('편지 뒤');
  if (await until('계약서', vis('#cnGo'), 60000)) await click('#cnGo');
  await step('계약서 뒤');
  if (await until('지점등록', vis('#brGo'), 40000)) await click('#brGo');
  await step('지점 뒤');
  if (!await until('방', "(() => document.body.classList.contains('r3ready') && !document.querySelector('.opening'))()", 90000)){
    fs.writeFileSync(path.join(OUT, 'promo-stuck.png'), Buffer.from(await png(), 'base64'));
    console.log('   막힌 자리를 찍어 뒀다 → promo-stuck.png');
  }
  await sleep(2500);
  await click('.coach [data-tut="skip"]');
  /* 안내·설치 띠·토스트는 **다시 못 뜨게** 지켜본다(capture-ios.js 와 같은 손). */
  await ev(`(() => { new MutationObserver(() => {
      const b = document.querySelector('#pwaBar'); if (b) b.remove();
      document.querySelectorAll('.toast,.coach,.coachring').forEach(x => x.remove());
    }).observe(document.body, { childList:true, subtree:true }); return 1 })()`);
  /* 사무실을 조금 채운다 — 빈 방은 「아직 안 만든 게임」으로 보인다 */
  await ev('(() => { try { S.anchovy = 24000; renderAll(); } catch (e) {} return 1; })()');
  await sleep(1200);

  /* ── 장면 여섯을 날것으로 먼저 찍는다 ── */
  const raw = {};
  const tab = async (k, ms) => {
    await ev("(() => { const b = document.querySelector('#colTabs button[data-col=\"" + k + "\"]');"
      + ' if (b) { b.click(); return 1; } try { setCol(' + JSON.stringify(k) + '); return 2; } catch (e){ return 0; } })()');
    await sleep(ms || 1400);
  };
  /* **어느 칸을 찍을지 매번 못 박는다.** 안내를 건너뛰어도 그 안내가 열어 둔 칸은 그대로
     남는다 — 첫 장이 사무실이 아니라 결재함이었다(2026-09-11). */
  await tab('stage', 2000);
  raw['01-office'] = await png();

  const TASKS = { ko: ['분기 보고서 정리', '거래처 회신', '창고 재고 확인', '신규 라인 검토'],
                  en: ['Quarterly report', 'Reply to clients', 'Stock check', 'Review new line'],
                  ja: ['四半期報告の整理', '取引先へ返信', '在庫の確認', '新ラインの検討'] };
  await tab('inbox');
  for (const t of (TASKS[LANG] || TASKS.ko)){
    await ev("(() => { const i = document.querySelector('#todoInput'); if (!i) return 0;"
      + " i.value = " + JSON.stringify(t) + "; i.dispatchEvent(new Event('input', { bubbles:true }));"
      + " const b = document.querySelector('#btnAdd'); if (b) b.click(); return 1; })()");
    await sleep(320);
  }
  await ev("document.querySelectorAll('#todoList .todo .chk').forEach((b, i) => { if (i < 2) b.click(); })");
  await sleep(2200);
  raw['02-inbox'] = await png();
  /* 결재를 체크하면 이야기 창이 하나 뜬다(첫 결재 · 총무의 쪽지). 걷지 않으면 **다음 장을
     그 창이 먹는다** — 상자 컷신 자리에 그 창이 찍혀 있었다(2026-09-11). */
  await clear(); await sleep(500);

  await tab('staff', 1800);
  raw['03-staff'] = await png();

  await tab('shop', 1800);
  raw['04-shop'] = await png();

  /* 05 — 배치 모드. 방 위에 격자가 깔리고 가구를 집어 옮기는 그 화면이다. */
  await tab('stage', 1200);
  await clear(); await sleep(400);
  /* **오른쪽 레일의 「배치」를 누른다.** toggleEdit(true) 를 직접 부르면 상태만 켜지고
     폰 스킨의 배치 판(격자·미리보기·회전)은 그 단추가 여는 것이라 화면이 그대로였다. */
  await ev("(() => { const b = [...document.querySelectorAll('button')]"
    + ".find(x => x.offsetHeight && /^(배치|Decorate|模様替え)$/.test((x.textContent||'').trim()));"
    + " if (b) { b.click(); return 1; }"
    + ' try { toggleEdit(true); return 2; } catch (e){ return 0; } })()');
  await sleep(2400);
  raw['05-decor'] = await png();
  await ev('(() => { try { toggleEdit(false); } catch (e) {} return 1; })()');
  await sleep(900);
  await clear(); await sleep(400);

  await ev('(() => { try { showBoard(); } catch (e) {} return 1; })()');
  await sleep(1800);
  raw['06-board'] = await png();
  await clear();

  /* ── 그 위에 판을 씌운다 ── */
  /* ── 판을 씌우기 전에 **게임을 멈춘다** ──
     `document.write` 는 DOM 만 갈아 끼운다. 게임의 스크립트는 그대로 돌고 있어서,
     다음 프레임에 자기 단추들을 **새 문서에** 다시 붙인다 — 배치 모드 장 위쪽에
     「미리보기」 한 조각이 떠 있었다(2026-09-11). 타이머와 프레임 고리를 전부 끊는다. */
  await ev(`(() => {
    for (let i = 1; i < 100000; i++){
      try { cancelAnimationFrame(i); } catch (e) {}
      try { clearInterval(i); } catch (e) {}
      try { clearTimeout(i); } catch (e) {}
    }
    return 1;
  })()`);

  console.log('꾸민 장 ' + PANELS.length + '개 · ' + (W * SCALE) + '×' + (H * SCALE) + ' · ' + LANG);
  let n = 0;
  for (const p of PANELS){
    p.n = String(++n).padStart(2, '0');
    const shot = raw[p.id];
    if (!shot){ console.log('  ' + p.id + ' — 장면을 못 찍었다'); continue; }
    /* 같은 출처에 머문 채로 문서만 갈아 끼운다 — 그래야 글꼴 파일이 그대로 잡힌다. */
    await ev('document.open(); document.write(' + JSON.stringify(poster(p, 'data:image/png;base64,' + shot)) + '); document.close(); 1');
    await ev('(async () => { try { await document.fonts.ready; } catch (e) {} return 1; })()');
    await sleep(900);
    const out = path.join(OUT, p.id + '.png');
    fs.writeFileSync(out, Buffer.from(await png(), 'base64'));
    console.log('  ' + p.n + '  ' + p.code.padEnd(14) + L(p.lead).replace('\n', ' '));
  }
  console.log('→ ' + OUT);
  try { ws.close(); } catch (e) {}
  chrome.kill();
})();
