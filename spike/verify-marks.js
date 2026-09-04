/* 꾸미기 — 무늬와 표정 (TODO 73).  node spike/serve.js 먼저.

   이 기능의 주장은 넷이다:
     1. **손이 둘로 갈려 있다** — 연필은 그리고 이동은 돌린다. 서로 안 넘어온다
     2. **자유롭게 그린다** — 획은 점이 아니라 선이고, 몇 획이든 상한이 없다
     3. **몸에 붙는다** — 저장에 남고, 초상에도 나오고, 다시 열어도 그대로다
     4. **표정은 눈 × 입** — 고르면 늘 그 얼굴(사원증까지), 「그때그때」면 지금까지 그대로
     5. **언제든 바꾼다** — 면접창·인사 파일·폰의 직원 탭에서 같은 창이 열린다

   그리고 이 화면에는 조용히 게임을 죽일 수 있는 자리가 하나 있다: **WebGL 컨텍스트**.
   작업대는 자기 렌더러를 세우므로, 닫을 때 안 버리면 몇 번 여닫는 것만으로 한도에
   걸리고 그때 죽는 것은 이 창이 아니라 **사무실**이다. 그래서 여닫기를 반복해서 잰다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9470 + (process.pid % 90), W = 390, H = 844;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
const ok = (n, p, note) => rows.push({ name:n, pass:!!p, note });

(async () => {
  /* 서버가 죽어 있으면 모든 항목이 「기능이 없다」로 보인다 — 제품 이야기로 읽힌다.
     맨 앞에서 확인하고, 안 떠 있으면 여기서 멈춘다. (69번에서 밟은 자리) */
  try { await fetch('http://localhost:8123/index.html'); }
  catch(e){ console.log('❌ spike/serve.js 가 안 떠 있다. `node spike/serve.js` 먼저.'); process.exit(1); }

  /* ── 자세가 바뀌어도 무늬가 몸에 붙어 있나 ──
     브라우저를 띄우기 전에, **기하학만으로** 먼저 잰다. 무늬 좌표계는 자세마다 다시
     잡히므로(앉으면 다리를 접고 꼬리가 옆으로 흐른다) 서서 찍은 양말이 앉았을 때도
     발에 남아 있어야 한다. 화면으로는 「대충 맞는 것 같다」밖에 못 보는 자리다.

     여기가 한 번 실제로 틀렸다: 상자의 가로 한가운데를 재서 쓰면 앉은 자세에서
     0.086 만큼 밀려 **오른쪽 발의 무늬만 발에서 벗겨졌다.** 몸이 x 대칭이라는 사실이
     재서 나온 값보다 믿을 만하다 — 그래서 0 으로 못 박았고, 이 항목이 그 증거다. */
  {
    const { build, PRESETS } = await import('../js/three/sculpt.js');
    const SOCK = { FR:[0.408,-0.857,0.315], FL:[-0.410,-0.856,0.315],
                   BR:[0.402,-0.846,-0.350], BL:[-0.404,-0.845,-0.350] };
    const RAD = { FR:0.28, FL:0.28, BR:0.26, BL:0.26 };
    for (const [n, pre] of [['서기','stand'],['앉음','앉음'],['식빵','식빵']]){
      const a = build({ ...(PRESETS[pre] || {}), res:30, pads:false }).anchor;
      const gaps = a.paws.map(q => {
        const k = q.tag + q.side;
        const v = [(q.p[0]-a.body[0])/a.bodyR[0], (q.p[1]-a.body[1])/a.bodyR[1], (q.p[2]-a.body[2])/a.bodyR[2]];
        const l = Math.hypot(...v), d = v.map(x => x/l);
        const t = SOCK[k];
        return { k, gap: Math.hypot(d[0]-t[0], d[1]-t[1], d[2]-t[2]), r: RAD[k] };
      });
      ok(`발에 그린 무늬가 ${n} 자세에서도 발에 남는다`, gaps.every(g => g.gap < g.r),
         gaps.map(g => `${g.k} ${g.gap.toFixed(2)}/${g.r}`).join(' · '));
    }
  }

  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-marks-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); let errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown')
      errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 220));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 220));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || '').slice(0, 400));
    return r?.result?.value;
  };

  /* 폰에서 먼저 본다 — 주력이 폰이고, 헤드리스에서도 mobile:true 가 더 잘 뜬다 */
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:true });
  await send('Page.navigate', { url:'http://localhost:8123/index.html' });
  /* 시계로 기다리지 않는다 — 게임이 설 때까지 본다 */
  for (let i = 0; i < 90; i++){
    if (await ev(`!!(window.S && window.R3 && R3.ready)`)) break;
    await sleep(400);
  }
  await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();
    document.body.classList.remove('titleon');
    document.querySelectorAll('.coach,.coachring').forEach(e=>e.remove());return 1})()`);
  await sleep(1500);
  await ev(`(()=>{const g=document.querySelector('#cnGo');if(g)g.click();return 1})()`);
  await sleep(1200);
  await ev(`document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove())`);
  await sleep(600);
  errs = [];

  /* ── 0. 손잡이가 붙었나 ── */
  const api = await ev(`JSON.stringify({
    studio: typeof R3.studio, pal: (R3.markPalette&&R3.markPalette().length)|0,
    key: typeof R3.markKey, cover: typeof R3.paintCoverage,
    eyes: (R3.faceSets&&R3.faceSets().eyes.length)|0,
    mouths: (R3.faceSets&&R3.faceSets().mouths.length)|0,
    eyeN: (typeof EYE_NAMES!=='undefined'&&EYE_NAMES.length)|0,
    mouthN: (typeof MOUTH_NAMES!=='undefined'&&MOUTH_NAMES.length)|0,
    noCap: typeof R3.markMax, gone: typeof MARK_SETS })`);
  const A = JSON.parse(api);
  ok('손잡이 — studio · 팔레트 셋 · 눈 × 입',
     A.studio === 'function' && A.pal === 3 && A.key === 'function' && A.cover === 'function'
       && A.eyes + 1 === A.eyeN && A.mouths === A.mouthN && A.eyes >= 8 && A.mouths >= 7,
     `팔레트 ${A.pal} · 눈 ${A.eyeN}(그때그때 포함) · 입 ${A.mouthN} = ${A.eyes * A.mouths}가지`);
  ok('개수 상한이 없어졌다 (미리 만든 무늬 벌도 없다)',
     A.noCap === 'undefined' && A.gone === 'undefined', `markMax ${A.noCap} · MARK_SETS ${A.gone}`);

  /* ── 1. 인사 파일에 무늬 줄이 있고, 누르면 작업대가 열린다 ── */
  const open = await ev(`(async()=>{
    document.querySelectorAll('.veil').forEach(e=>e.remove());
    showCat(S.cats[0].id);
    await new Promise(r=>setTimeout(r,300));
    const row = document.querySelector('#catMark .markopen');
    if (!row) return JSON.stringify({ row:false });
    row.click();
    await new Promise(r=>setTimeout(r,1200));
    const st = document.querySelector('.mkstage');
    const cv = st && st.querySelector('canvas');
    const b = st && st.getBoundingClientRect();
    return JSON.stringify({ row:true, stage:!!st, canvas:!!cv,
      w: b?Math.round(b.width):0, h: b?Math.round(b.height):0,
      cw: cv?cv.width:0, ch: cv?cv.height:0,
      inks: document.querySelectorAll('.mkink').length,
      sizes: document.querySelectorAll('.mksize').length,
      modes: [...document.querySelectorAll('.mkmode')].map(b=>b.dataset.mode).join(','),
      on: (document.querySelector('.mkmode.on')||{}).dataset?.mode,
      /* 연필·이동은 **아이콘**이고 **제 줄**에 있어야 한다 — 색·굵기와 같은 줄이면
         「무엇을 고르는가」와 「무엇을 하는가」가 섞인다 */
      icons: [...document.querySelectorAll('.mkmode svg')].length,
      words: [...document.querySelectorAll('.mkmode')].some(b=>(b.textContent||'').trim()),
      ownRow: !!document.querySelector('.mkhand [data-mode]')
              && !document.querySelector('.mkbar [data-mode]'),
      tabs: [...document.querySelectorAll('.mktab')].map(b=>b.dataset.tab).join(','),
      tabOn: (document.querySelector('.mktab.on')||{}).dataset?.tab,
      facePaneHidden: !!document.querySelector('[data-pane="face"]').hidden });
  })()`);
  const O = JSON.parse(open);
  ok('인사 파일 → 무늬 줄 → 작업대가 열린다',
     O.row && O.stage && O.canvas && O.w > 100 && O.h > 80 && O.cw > 0,
     `무대 ${O.w}×${O.h} · 캔버스 ${O.cw}×${O.ch}`);
  ok('손 둘(연필·이동) · 잉크 셋 + 지우개 · 굵기 셋',
     O.modes === 'draw,move' && O.on === 'draw' && O.inks === 4 && O.sizes === 3,
     `모드 ${O.modes} (${O.on}) · 잉크 ${O.inks} · 굵기 ${O.sizes}`);
  ok('연필·이동은 아이콘이고 제 줄에 있다 (색·굵기와 안 섞인다)',
     O.icons === 2 && !O.words && O.ownRow,
     `아이콘 ${O.icons} · 낱말 ${O.words} · 제 줄 ${O.ownRow}`);
  ok('칸 둘 — 무늬가 먼저 열리고 표정 칸은 접혀 있다',
     O.tabs === 'mark,face' && O.tabOn === 'mark' && O.facePaneHidden,
     `탭 ${O.tabs} (${O.tabOn})`);

  /* ── 2. 눌러서 찍는다 · 저장에 남는다 ── */
  const stamp = await ev(`(async()=>{
    const before = (S.cats[0].marks||[]).length;
    const p0 = R3.portrait(S.cats[0], 96);
    const st = document.querySelector('.mkstage'), b = st.getBoundingClientRect();
    const x = b.left + b.width*0.50, y = b.top + b.height*0.44;
    const mk = t => st.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
      clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true}));
    mk('pointerdown'); mk('pointerup');
    await new Promise(r=>setTimeout(r,400));
    const now = S.cats[0].marks||[];
    const saved = JSON.parse(localStorage.getItem('copycat.save.v1')||'{}');
    const p1 = R3.portrait(S.cats[0], 96);
    return JSON.stringify({ before, after: now.length, one: now[now.length-1]||null,
      inSave: ((saved.cats&&saved.cats[0]&&saved.cats[0].marks)||[]).length,
      picChanged: p0 !== p1 });
  })()`);
  const T = JSON.parse(stamp);
  ok('눌러서 찍는다 — 획 하나가 는다', T.after === T.before + 1,
     `${T.before} → ${T.after} · ${JSON.stringify(T.one)}`);
  ok('저장에 남는다', T.inSave === T.after, `저장 ${T.inSave}개`);
  ok('초상이 실제로 바뀐다 (초상 캐시 열쇠에 무늬가 들어간다)', T.picChanged);

  /* ── 3. 연필로 끌면 **획이 그어진다**, 이동으로 끌면 **돌아가기만 한다** ── */
  const modes = await ev(`(async()=>{
    const st = document.querySelector('.mkstage'), b = st.getBoundingClientRect();
    const cv = st.querySelector('canvas');
    const shot = () => { try { return cv.toDataURL().slice(200,600); } catch(e){ return ''; } };
    const swipe = async () => {
      const x = b.left + b.width*0.42, y = b.top + b.height*0.42;
      const mk = (t,ex,ey) => st.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
        clientX:ex,clientY:ey,pointerId:1,pointerType:'touch',isPrimary:true}));
      mk('pointerdown',x,y);
      for (let i=1;i<=10;i++){ mk('pointermove', x+i*7, y+i*2); await new Promise(r=>setTimeout(r,20)); }
      mk('pointerup', x+70, y+20);
      await new Promise(r=>setTimeout(r,360));
    };
    document.querySelector('[data-mode="draw"]').click();
    const d0 = (S.cats[0].marks||[]).length;
    await swipe();
    const d1 = (S.cats[0].marks||[]).length;
    document.querySelector('#mkSpin').click();
    await new Promise(r=>setTimeout(r,260));
    document.querySelector('[data-mode="move"]').click();
    const s0 = shot();
    await swipe();
    const last = (S.cats[0].marks||[]).slice(-1)[0];
    return JSON.stringify({ d0, d1, pts: last ? (last.p||[]).length/3 : 0,
      m1:(S.cats[0].marks||[]).length, turned: shot() !== s0 });
  })()`);
  const D = JSON.parse(modes);
  ok('연필 — 끌면 **한 획**이 남고 그 획에 점이 여럿이다',
     D.d1 === D.d0 + 1 && D.pts >= 4, `획 ${D.d0}→${D.d1} · 마지막 획의 점 ${D.pts}`);
  ok('이동 — 끌어도 안 그려지고 돌아가기만 한다', D.m1 === D.d1 && D.turned,
     `획 ${D.d1}→${D.m1} · 화면 바뀜 ${D.turned}`);

  /* ── 4. 되돌리기 ── */
  const undo = await ev(`(async()=>{
    const n0 = (S.cats[0].marks||[]).length;
    document.querySelector('#mkUndo').click();
    await new Promise(r=>setTimeout(r,350));
    return JSON.stringify({ n0, n1:(S.cats[0].marks||[]).length });
  })()`);
  const U = JSON.parse(undo);
  /* 앞에서 한 번 눌러 찍은 것 하나 + 한 획(여러 점)이 쌓여 있다.
     되돌리기 한 번에 **획 전체**가 빠지고 처음 찍은 하나만 남아야 한다 —
     점마다 쌓였다면 여기서 6 이 나온다. */
  ok('되돌리기 — 한 획이 한 번 (앞에서 찍은 한 점만 남는다)', U.n0 === 2 && U.n1 === 1,
     `획 ${U.n0} → ${U.n1}`);

  /* ── 5. 표정 — 눈과 입이 따로 ── */
  const faces = await ev(`(async()=>{
    document.querySelector('[data-tab="face"]').click();
    await new Promise(r=>setTimeout(r,700));
    const eyes = [...document.querySelectorAll('#mkEye .swatch')];
    const mouths = [...document.querySelectorAll('#mkMouth .swatch')];
    const pic = b => (b.querySelector('.pix')||{}).style?.backgroundImage || '';
    const uniqE = new Set(eyes.map(pic).filter(Boolean)).size;
    const uniqM = new Set(mouths.map(pic).filter(Boolean)).size;
    eyes[7].click();                       // 별 눈 (첫 칸이 그때그때라 -1 부터)
    await new Promise(r=>setTimeout(r,420));
    document.querySelectorAll('#mkMouth .swatch')[2].click();   // 활짝
    await new Promise(r=>setTimeout(r,420));
    const saved = JSON.parse(localStorage.getItem('copycat.save.v1')||'{}');
    const autoMark = document.querySelectorAll('#mkEye .swatch.auto').length;
    return JSON.stringify({ nE:eyes.length, nM:mouths.length, uniqE, uniqM, autoMark,
      face:S.cats[0].face, inSave:(saved.cats&&saved.cats[0]&&saved.cats[0].face)||null,
      onE:[...document.querySelectorAll('#mkEye .swatch')].findIndex(x=>x.classList.contains('on')),
      onM:[...document.querySelectorAll('#mkMouth .swatch')].findIndex(x=>x.classList.contains('on')),
      /* 이동 모드로 넘어갔나 — 표정 칸에서 무대를 만지면 그림이 그어지면 안 된다 */
      mode:(document.querySelector('.mkmode.on')||{}).dataset?.mode });
  })()`);
  const F = JSON.parse(faces);
  ok('표정 — 눈과 입을 따로 고르고, 고른 것이 저장에 남는다',
     F.face && F.face.e === 6 && F.face.m === 2
       && F.inSave && F.inSave.e === 6 && F.inSave.m === 2 && F.onE === 7 && F.onM === 2,
     `눈 ${F.face && F.face.e} · 입 ${F.face && F.face.m}`);
  /* 눈 줄에서 하나가 겹치는 것은 **맞는 것이다**: 첫 칸 「그때그때」는 얼굴이 아니라
     「안 고름」이라 정적인 한 장으로는 그릴 방법이 없고(무엇으로 그려도 나머지 중 하나와
     같아진다), 그래서 UI 에서 흐린 점선 칸으로 따로 표시한다. 나머지는 전부 달라야 한다. */
  ok('눈 열 · 입 여덟이 서로 다른 얼굴이다 (초상으로 갈린다)',
     F.uniqE >= F.nE - 1 && F.uniqM === F.nM,
     `눈 ${F.uniqE}/${F.nE}(그때그때 하나는 겹치는 게 맞다) · 입 ${F.uniqM}/${F.nM}`);
  ok('「그때그때」 칸은 얼굴 칸과 다르게 보인다', F.autoMark, `점선 칸 ${F.autoMark}`);
  ok('표정 칸으로 넘어가면 손이 **이동**으로 바뀐다', F.mode === 'move', `모드 ${F.mode}`);

  /* 사원증(폰 직원 탭)도 그 얼굴이어야 한다 — 여기만 뜬 눈으로 못 박고 있었다 */
  const idcard = await ev(`(()=>{
    const c = S.cats[0];
    const withFace = R3.portrait(c, 220, { front:true });
    const forced   = R3.portrait(c, 220, { front:true, eyeMode:0 });
    return JSON.stringify({ differs: withFace !== forced });
  })()`);
  ok('사원증 — 고른 표정이 증명사진에도 나온다', JSON.parse(idcard).differs);

  const erase = await ev(`(async()=>{
    /* 지우개는 이제 「어느 무늬를 지울까」를 안 고른다 — 같은 붓으로 알파를 깎는다.
       그래서 「무늬 개수」로는 아무것도 못 잰다. **몸의 몇 텍셀이 칠해져 있나**를 잰다. */
    document.querySelector('[data-tab="mark"]').click();
    await new Promise(r=>setTimeout(r,300));
    const st = document.querySelector('.mkstage'), b = st.getBoundingClientRect();
    document.querySelector('#mkSpin').click();
    await new Promise(r=>setTimeout(r,240));
    const swipe = async () => {
      const x = b.left + b.width*0.42, y = b.top + b.height*0.42;
      const mk = (t,ex,ey) => st.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
        clientX:ex,clientY:ey,pointerId:1,pointerType:'touch',isPrimary:true}));
      mk('pointerdown',x,y);
      for (let i=1;i<=10;i++){ mk('pointermove', x+i*6, y+i*2); await new Promise(r=>setTimeout(r,20)); }
      mk('pointerup', x+60, y+20);
      await new Promise(r=>setTimeout(r,420));
    };
    document.querySelector('[data-mode="draw"]').click();
    document.querySelector('[data-ink="2"]').click();
    document.querySelectorAll('[data-size]')[0].click();
    await swipe();
    const drawn = R3.paintCoverage(S.cats[0].marks||[]);
    document.querySelector('[data-ink="-1"]').click();
    document.querySelectorAll('[data-size]')[2].click();       // 굵은 지우개
    await swipe();
    const left = R3.paintCoverage(S.cats[0].marks||[]);
    return JSON.stringify({ drawn, left, strokes:(S.cats[0].marks||[]).length });
  })()`);
  const E = JSON.parse(erase);
  ok('지우개 — 그은 자리가 실제로 지워진다 (칠한 텍셀이 준다)',
     E.drawn > 40 && E.left < E.drawn * 0.35, `칠한 텍셀 ${E.drawn} → ${E.left}`);

  /* ── 상한이 없다 ── */
  const many = await ev(`(async()=>{
    const st = document.querySelector('.mkstage'), b = st.getBoundingClientRect();
    document.querySelector('[data-ink="0"]').click();
    document.querySelectorAll('[data-size]')[0].click();
    const n0 = (S.cats[0].marks||[]).length;
    for (let k=0;k<30;k++){
      const x = b.left + b.width*(0.34 + (k%6)*0.04), y = b.top + b.height*(0.34 + ((k/6)|0)*0.05);
      const mk = (t,ex,ey) => st.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
        clientX:ex,clientY:ey,pointerId:1,pointerType:'touch',isPrimary:true}));
      mk('pointerdown',x,y); mk('pointermove',x+10,y+6); mk('pointerup',x+10,y+6);
      await new Promise(r=>setTimeout(r,45));
    }
    await new Promise(r=>setTimeout(r,400));
    return JSON.stringify({ n0, n1:(S.cats[0].marks||[]).length });
  })()`);
  const M = JSON.parse(many);
  ok('서른 획을 더 그어도 하나도 안 버린다 (개수 상한이 없다)',
     M.n1 >= M.n0 + 28, `획 ${M.n0} → ${M.n1}`);

  /* ── 6. 면접창에도 같은 줄이 있다 ── */
  const hire = await ev(`(async()=>{
    document.querySelectorAll('.veil').forEach(e=>e.remove());
    S.anchovy = 999999;
    showHire();
    await new Promise(r=>setTimeout(r,500));
    const row = document.querySelector('#hireMark .markopen');
    if (!row) return JSON.stringify({ row:false, why: document.querySelector('.mhead h3')?.textContent });
    row.click();
    await new Promise(r=>setTimeout(r,1100));
    const st = document.querySelector('.mkstage'), b = st && st.getBoundingClientRect();
    const n0 = (S.candidate.marks||[]).length;
    if (st){
      const x = b.left + b.width*0.50, y = b.top + b.height*0.44;
      const mk = t => st.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
        clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true}));
      mk('pointerdown'); mk('pointerup');
      await new Promise(r=>setTimeout(r,380));
    }
    const n1 = (S.candidate.marks||[]).length;
    document.querySelector('.mkstage') && document.querySelectorAll('.veil')[1].remove();
    await new Promise(r=>setTimeout(r,200));
    const label = document.querySelector('#hireMark .markopen b')?.textContent.trim();
    return JSON.stringify({ row:true, stage:!!st, n0, n1, label });
  })()`);
  const Hr = JSON.parse(hire);
  ok('면접창 — 색 고르기 밑에 같은 줄이 있고, 지원자에게 찍힌다',
     Hr.row && Hr.stage && Hr.n1 === Hr.n0 + 1, `${Hr.n0} → ${Hr.n1} · 「${Hr.label}」`);

  /* ── 7. 채용해도 그 무늬가 따라간다 ── */
  const carried = await ev(`(async()=>{
    const want = JSON.stringify(S.candidate.marks||[]);
    const before = S.cats.length;
    document.querySelector('#hireGo').click();
    await new Promise(r=>setTimeout(r,600));
    const c = S.cats[S.cats.length-1];
    return JSON.stringify({ grew: S.cats.length === before+1,
      same: JSON.stringify(c.marks||[]) === want, n:(c.marks||[]).length });
  })()`);
  const C = JSON.parse(carried);
  ok('채용 — 지원자에게 찍은 무늬가 그대로 입사한다', C.grew && C.same && C.n > 0,
     `무늬 ${C.n}개`);

  /* ── 8. 컨텍스트를 반납하나 — 여닫기 반복 ── */
  errs = [];
  const churn = await ev(`(async()=>{
    for (let i=0;i<6;i++){
      document.querySelectorAll('.veil').forEach(e=>e.remove());
      showCat(S.cats[0].id);
      await new Promise(r=>setTimeout(r,220));
      document.querySelector('#catMark .markopen').click();
      await new Promise(r=>setTimeout(r,600));
      const st = document.querySelector('.mkstage canvas');
      if (!st) return JSON.stringify({ round:i, opened:false });
      document.querySelectorAll('.veil')[1].remove();
      await new Promise(r=>setTimeout(r,180));
    }
    document.querySelectorAll('.veil').forEach(e=>e.remove());
    await new Promise(r=>setTimeout(r,600));
    const gl = document.getElementById('gl');
    const ctx = gl.getContext('webgl2') || gl.getContext('webgl');
    return JSON.stringify({ opened:true, stageAlive: !!(ctx && !ctx.isContextLost()),
      cats: S.cats.length });
  })()`);
  const K = JSON.parse(churn);
  ok('여섯 번 여닫아도 사무실 무대가 안 죽는다 (WebGL 컨텍스트 반납)',
     K.opened && K.stageAlive && !errs.length, K.opened ? `무대 살아 있음 ${K.stageAlive}` : `${K.round}회에서 못 열림`);

  /* ── 폰의 직원 탭에서도 열린다 ── */
  const phone = await ev(`(async()=>{
    document.querySelectorAll('.veil').forEach(e=>e.remove());
    /* 폰의 탭은 게임이 그린 그대로다 — cozy.js 가 #colTabs 의 data-col 을 안 건드린다 */
    const tab = document.querySelector('#colTabs button[data-col="staff"]');
    if (tab) tab.click();
    await new Promise(r=>setTimeout(r,1400));
    const b = document.querySelector('.dexdeco');
    if (!b) return JSON.stringify({ btn:false,
      where: (document.querySelector('.dex') ? 'dex 있음' : 'dex 없음')
             + ' · 탭 ' + (tab ? tab.dataset.col : '없음')
             + ' · cozyskin ' + document.body.classList.contains('cozyskin') });
    b.click();
    await new Promise(r=>setTimeout(r,1400));
    const on = !!document.querySelector('.mkstage canvas');
    document.querySelectorAll('.veil').forEach(e=>e.remove());
    return JSON.stringify({ btn:true, on });
  })()`);
  const Ph = JSON.parse(phone);
  ok('폰 직원 탭 — 사원증 옆 단추가 같은 창을 연다', Ph.btn && Ph.on,
     Ph.btn ? `열림 ${Ph.on}` : `단추 없음 (${Ph.where})`);

  /* ── 9. 새로 고쳐도 그대로다 ── */
  const want = await ev(`R3.markKey(S.cats[0].marks||[]) + '|' + R3.faceKey(S.cats[0].face)`);
  await send('Page.navigate', { url:'http://localhost:8123/index.html' });
  for (let i = 0; i < 90; i++){
    if (await ev(`!!(window.S && window.R3 && R3.ready)`)) break;
    await sleep(400);
  }
  await sleep(1500);
  const back = await ev(`R3.markKey(S.cats[0].marks||[]) + '|' + R3.faceKey(S.cats[0].face)`);
  ok('새로 고쳐도 무늬와 표정이 그대로다', !!want && want === back, `${(want||'').slice(0,46)}…`);

  const bad = errs.filter(e => !/favicon|ERR_/.test(e));
  ok('오류 0', bad.length === 0, bad.slice(0, 3).join(' | '));

  console.log('\n══════ 꾸미기 — 무늬와 표정 ══════');
  let fail = 0;
  for (const r of rows){
    if (!r.pass) fail++;
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.note ? '   ' + r.note : ''}`);
  }
  console.log(`\n  ${rows.length - fail}/${rows.length}\n`);
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
