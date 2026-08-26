/* ============================================================
   widget.js — 위젯 모드와 떠 있는 창

   이 게임은 근무시간을 같이 견뎌주는 물건이라, 화면의 주인이 아니라
   화면 한 구석의 세입자여야 한다. 그래서 레이아웃이 두 가지다.

   1) 위젯 모드 (#app.compact)
      3열 → 1열. 사무실만 남기고 결재함·경영 패널은 아래에서 올라오는
      서랍이 된다. 상단 아이콘 6개는 ⋯ 팝오버로 접히고, 분기 게이지는
      상단 바 밑선 3px 짜리 줄이 된다. 300×260 에서도 고양이가 보인다.
      창이 작아지면 자동으로 들어가고, 🔳 로 직접 고정할 수도 있다.

   2) 떠 있는 창 (Document Picture-in-Picture)
      🪟 를 누르면 #app 을 **통째로** PiP 창으로 옮긴다. 사본이 아니라
      원본을 옮기는 이유: 저장소(localStorage)가 하나뿐이라 사본을 띄우면
      두 시뮬레이션이 같은 세이브를 서로 덮어쓴다. DOM 을 옮기는 쪽이
      "게임이 하나"라는 사실을 구조로 보장한다.

      옮기고 나면 렌더 대상 문서가 바뀌므로 ui.js 의 DOC 를 갈아끼우고,
      루프가 도는 창(HOST)도 같이 바꾼다 — rAF 는 숨은 문서에서 멈추므로
      떠 있는 창에서 돌려야 다른 탭에 가 있어도 고양이가 계속 일한다.
   ============================================================ */

const CMP_KEY = 'copycat.compact';   // '1' 고정 · '0' 해제 · 없으면 창 크기에 맡긴다
const CMP_W = 620, CMP_H = 560;      // 이보다 좁거나 낮으면 저절로 위젯이 된다

let cmpPref = null;
try { cmpPref = localStorage.getItem(CMP_KEY); } catch(e){}

/* 게임이 지금 살고 있는 창. PiP 로 나가면 그 창이 된다.
   main.js 의 rAF 와 fitWorld 가 이걸 본다. */
let HOST = window;
let PIP = null;
const pipLive = () => !!PIP;
const pipOk = () => 'documentPictureInPicture' in window;

const isCompact = () => $('#app').classList.contains('compact');

/* 폰은 **좁고 길다.** 위젯은 작은 창을 위한 것이고(가로도 세로도 작다) 폰은
   작지 않으므로, 폰에서는 위젯이 아니라 탭 바 배치(#app.tabbar, js/col.js)로 간다.
   이 한 줄이 "폰이면 M4" 의 전부다 — 세로 조건이 둘을 가른다.
   PiP 로 떠 있는 창은 이 판단에 안 온다(autoCompact 가 먼저 걸러 낸다). */
const phoneish = () => HOST.innerWidth <= 700 && HOST.innerHeight >= 600;

/* 상단 아이콘이 ⋯ 로 접혀 있나. 위젯만 그랬는데 탭 바도 같은 상단 바를 쓴다
   (style.css 의 #app.slim). 이 함수가 없으면 폰에서 ⋯ 가 안 닫힌다. */
const toolsFolded = () => isCompact() || $('#app').classList.contains('tabbar');

/* ---------- 위젯 모드 ---------- */
function applyCompact(on){
  const app = $('#app');
  if (app.classList.contains('compact') === on) return;
  app.classList.toggle('compact', on);
  if (!on) closeDrawers();
  closeTools();
  syncWidgetBtns();
  /* 위젯을 켜거나 끄면 살아 있는 배치가 바뀐다 — 위젯이면 한 기둥/탭 바는 비켜난다.
     여기서 안 알려 주면 클래스가 둘 다 걸린 채로 남아 화면이 겹친다. */
  if (typeof colApply === 'function') colApply();
  // 뷰포트 크기가 방금 바뀌었다 — 카메라를 다시 맞춘다.
  // 한 프레임 뒤에 한 번 더: 서랍/독이 붙는 건 다음 레이아웃에서 확정된다.
  fitWorld();
  HOST.requestAnimationFrame(fitWorld);
}

/* 사용자가 직접 고정한 게 있으면 그걸 따르고, 없으면 창 크기로 판단한다 */
function autoCompact(){
  if (PIP) return applyCompact(true);              // 떠 있는 창은 언제나 위젯이다
  if (cmpPref === '1' || cmpPref === '0') return applyCompact(cmpPref === '1');
  /* 직접 고정한 게 없으면 창 크기로 판단한다 — 단 폰은 빼 놓는다.
     폰에서 위젯을 켜면 300×260 을 위해 만든 배치가 780px 세로에 늘어난다. */
  applyCompact(!phoneish() && (HOST.innerWidth < CMP_W || HOST.innerHeight < CMP_H));
}

function toggleCompact(){
  const on = !isCompact();
  cmpPref = on ? '1' : '0';
  try { localStorage.setItem(CMP_KEY, cmpPref); } catch(e){}
  applyCompact(on);
}

function syncWidgetBtns(){
  const b = $('#btnCompact');
  b.classList.toggle('on', isCompact());
  b.textContent = isCompact() ? '🔲' : '🔳';
  // 떠 있는 창에서는 접기를 끌 수 없다 — 380px 창에 3열을 펴면 아무것도 안 보인다.
  // 돌아가는 길은 창을 닫는 것이고, 그건 창 제목줄이 이미 제공한다.
  b.style.display = PIP ? 'none' : '';
  /* 🪟 버튼은 마크업에서 뺐다(index.html). 코드는 지우지 않고 문만 닫아 둔다 —
     되살리는 데 필요한 건 버튼 하나뿐이라, 지우는 것보다 꺼 두는 쪽이 싸다.
     (site/pay 를 꺼 둔 것과 같은 규칙) */
  const fb = $('#btnFloat');
  if (fb) fb.style.display = (pipOk() && !PIP) ? '' : 'none';
}

/* ---------- 서랍 (위젯 모드의 결재함·경영) ---------- */
function closeDrawers(){
  $$('#main .panel').forEach(p => p.classList.remove('open'));
  $$('.dockbtn').forEach(b => b.classList.remove('on'));
  if (isCompact()) fitWorld();      // 사무실이 다시 뷰포트 전체를 쓴다
}

function toggleDrawer(sel, btn){
  const p = $(sel), was = p.classList.contains('open');
  closeDrawers();
  if (was) return;
  p.classList.add('open');
  btn.classList.add('on');
  fitWorld();                        // 서랍 위에 남은 띠로 카메라를 올린다
  if (sel === '#panelInbox') $('#todoInput').focus();
}

/* ---------- ⋯ 팝오버 ---------- */
function closeTools(){ $('#tools').classList.remove('open'); }

/* ---------- 떠 있는 창 ---------- */
/* 스타일시트를 새 문서로 옮긴다. 같은 출처면 규칙을 그대로 읽어 넣고,
   못 읽으면(file:// 의 <link> 등) 링크를 다시 걸어 준다. */
function copyStyles(d){
  for (const sheet of Array.from(document.styleSheets)){
    let css = null;
    try { css = Array.from(sheet.cssRules).map(r => r.cssText).join('\n'); } catch(e){}
    if (css != null){
      const s = d.createElement('style');
      s.textContent = css;
      d.head.appendChild(s);
    } else if (sheet.href){
      const l = d.createElement('link');
      l.rel = 'stylesheet'; l.href = sheet.href;
      d.head.appendChild(l);
    }
  }
}

/* 문서 전체에 걸어 둔 리스너(배치 모드의 ESC, 음악의 첫 입력)는 원래 문서에 있다.
   떠 있는 창에서 일어난 입력을 그쪽으로 넘겨 준다 — 창이 바뀌었다는 걸
   edit.js·music.js 가 몰라도 되게. */
function bridgeInput(win){
  win.document.addEventListener('keydown', e => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key:e.key, code:e.code }));
  });
  win.document.addEventListener('pointerdown', () => {
    document.dispatchEvent(new Event('pointerdown'));
  });
}

async function floatOut(){
  if (!pipOk() || PIP) return;
  const app = $('#app');
  let win;
  try {
    win = await documentPictureInPicture.requestWindow({ width:380, height:470 });
  } catch(e){ return; }   // 사용자가 막았거나 제스처가 없었다

  copyStyles(win.document);
  win.document.documentElement.lang = document.documentElement.lang;
  win.document.title = document.title;
  win.document.body.appendChild(app);      // 사본이 아니라 원본을 옮긴다

  PIP = win; HOST = win; DOC = win.document;
  /* 떠 있는 창도 3D 로 돈다. 한동안 여기서 도트로 떨어뜨렸는데, 이유는
     「캔버스를 다른 문서로 옮겼을 때 WebGL 컨텍스트가 사는지 실측한 적이 없다」였다.
     재 봤고, **산다**(spike/pipcv.html — adoptNode 뒤에 isContextLost=false 이고
     그 뒤에 그린 색이 읽힌다). 그래서 도트판은 지웠고 이 창도 같은 무대를 쓴다.
     캔버스가 #app 과 함께 넘어왔으니 다시 세울 필요는 없지만, 뷰포트 크기가
     바뀌었으므로 카메라를 맞춰 준다(아래 fitWorld). */
  renderNight();
  bridgeInput(win);
  music.init(win.document);          // 아직 음악이 안 켜졌다면 이 창의 입력으로 켠다
  win.addEventListener('resize', () => fitWorld());
  autoCompact();
  fitWorld();
  resumeLoop();      // 이제부터는 떠 있는 창의 rAF 로 돈다

  // 창을 닫으면 게임은 원래 탭으로 돌아온다. 여기서 안 돌려놓으면 화면이 빈다.
  win.addEventListener('pagehide', () => {
    document.body.appendChild(app);
    PIP = null; HOST = window; DOC = document;
    renderNight();
    music.init(document);            // 떠 있던 창의 문서는 사라졌다 — 이 탭에 다시 붙인다
    autoCompact();
    fitWorld();
    syncWidgetBtns();
    // 떠 있던 창에서 돌던 rAF 가 끊겼으니 루프를 이 창에서 다시 잇는다
    resumeLoop();
  });

  syncWidgetBtns();
  toast(L({
    ko:'🪟 사무실을 창으로 띄웠습니다 — 다른 창 위에 얹어 두세요',
    en:'🪟 The office is floating now — park it on top of your work',
    ja:'🪟 オフィスを浮かせました——作業ウィンドウの上に置いてください',
  }), '', 3600);
}

/* ---------- 배선 ---------- */
function widgetInit(){
  $('#btnCompact').onclick = toggleCompact;
  { const fb = $('#btnFloat'); if (fb) fb.onclick = floatOut; }
  $('#btnMore').onclick = e => { e.stopPropagation(); $('#tools').classList.toggle('open'); };
  $('#tools').addEventListener('click', () => { if (toolsFolded()) closeTools(); });
  $('#dkInbox').onclick = e => toggleDrawer('#panelInbox', e.currentTarget);
  $('#dkBiz').onclick   = e => toggleDrawer('#panelBiz', e.currentTarget);
  // 사무실을 건드리면 서랍은 비켜난다 — 위젯에서는 고양이가 주인이다
  $('#viewport').addEventListener('pointerdown', () => { if (isCompact()) { closeDrawers(); closeTools(); } });

  window.addEventListener('resize', autoCompact);
  autoCompact();
  syncWidgetBtns();
}
