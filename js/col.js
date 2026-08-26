/* ============================================================
   col.js — 한 기둥(D3) 과 모바일 탭 바(M4)

   두 배치는 그림이 다르지만 **기구는 하나다: 한 번에 한 화면.**
   결재함·직원·비품·사보가 탭이 되고(폰에서는 사무실도 한 탭이 된다),
   #app 의 data-col 이 지금 어느 화면인지를 들고 있다. 보이고 숨는 건
   전부 style.css 가 그 속성 하나로 한다 — 인라인 스타일을 쓰지 않는다.

   왜 하나로 묶었나: 후보판(spike/ui/layouts2.html)에서 D3 를 고른 값어치가
   "모바일과 구조가 같아진다" 였고, 실제로 같은 줄을 **위에 붙이면 D3,
   아래에 붙이면 M4** 다. 화면을 둘 만들어 둘 다 유지하는 일을 피한다.

   어느 배치인지는 **JS 가 정한다**(matchMedia). CSS 미디어 쿼리와 JS 의 판단이
   갈리면 "CSS 는 M4 인데 JS 는 D3" 같은 버그가 나는데, 그건 화면을 보고도
   원인을 못 찾는 종류다. 그래서 **클래스가 진실**이고 폭 조건은 이 파일 안에만 있다.
   ============================================================ */

const COL_KEY = 'copycat.col';
const COLS = ['stage','inbox','staff','shop','log'];

/* 폰은 **좁고 길다.** 위젯 모드(.compact)의 기준과 일부러 다르다 — 위젯은
   작은 창(가로도 세로도 작다)을 위한 것이고, 폰은 작지 않다. 길다.
   그래서 세로 조건이 들어가 있고, 이 한 줄이 "폰이면 M4" 의 전부다. */
const MQ_M4 = '(max-width:700px) and (min-height:600px)';
const MQ_D3 = '(min-width:1141px)';

/* 폰용 배포본인가. `tools/pack-mobile.js` 가 dist/android · dist/iphone 의 index.html
   머리에 도장을 하나 찍어 둔다(다른 배포본과 소스 트리에는 없다).

   **왜 필요한가** — 배치는 창 폭이 정하는데, 폰용 주소를 PC 브라우저로 열면 폭이
   넓으니 데스크톱 배치가 나온다. 폰에 나갈 화면을 보러 들어온 사람에게 그건 확인이
   안 되는 상태고, 실기기 없이 폰 화면을 보는 유일한 길이 막힌 것이다.
   도장이 있으면 **폭과 무관하게** 탭 바로 가고, 앱을 폰 폭 상자에 넣어 가운데 세운다.

   `?mobile=1` 은 개발용 비상구다 — 소스 트리에서 같은 화면을 보고 검사를 돌리는 길.
   저장하지 않는다(?3d=0 · ?debug=1 과 같은 규칙: 저장하면 그건 설정이다). */
const PHONE_DIST = (() => {
  try {
    if (/[?&]mobile=1/.test(location.search)) return true;
    const m = document.querySelector('meta[name="copycat-dist"]');
    return !!m && m.content === 'mobile';
  } catch(e){ return false; }
})();

let uiCol = 'inbox';
try { const v = localStorage.getItem(COL_KEY); if (COLS.indexOf(v) >= 0) uiCol = v; } catch(e){}

const colHost = () => (typeof HOST !== 'undefined' && HOST) ? HOST : window;

/* 지금 살아 있는 배치. null 이면 예전 배치(3열)거나 위젯이고, 그 둘은
   각자 이미 자기 항법을 갖고 있으므로 이 파일이 손대지 않는다. */
function colMode(){
  const app = $('#app');
  if (!app || app.classList.contains('compact')) return null;
  /* 폰용 배포본은 폭을 안 본다. PiP 로 띄운 위젯(.compact)만 예외로 위에서 빠진다 —
     그건 사람이 직접 작은 창으로 만든 것이고, 그 판단을 뺏지 않는다. */
  if (PHONE_DIST) return 'm4';
  const h = colHost();
  if (!h.matchMedia) return null;
  if (h.matchMedia(MQ_M4).matches) return 'm4';
  if (app.classList.contains('stageui') && h.matchMedia(MQ_D3).matches) return 'd3';
  return null;
}

const colOn = () => { const a = $('#app'); return a.classList.contains('onecol') || a.classList.contains('tabbar'); };
/* 무대가 가려져 있나. 그렸는데 아무도 못 보는 프레임은 폰에서 그냥 배터리다. */
function stageCovered(){
  const a = $('#app');
  return a.classList.contains('tabbar') && a.dataset.col && a.dataset.col !== 'stage';
}
/* 경영 패널이 화면에 있나 — 1.2초마다 도는 renderRight 를 아낀다 */
function bizShown(){
  const a = $('#app');
  if (!colOn()) return true;
  return a.dataset.col === 'staff' || a.dataset.col === 'shop' || a.dataset.col === 'log';
}

function colApply(){
  const app = $('#app');
  const m = colMode();
  app.classList.toggle('onecol', m === 'd3');
  app.classList.toggle('tabbar', m === 'm4');
  /* 폰용 배포본을 넓은 화면에서 열었을 때만 상자에 담는다. 실제 폰에서는 창이
     이미 그 폭이라 담을 것이 없다 — 담으면 좌우에 쓸데없는 여백이 생긴다.
     m 을 같이 보는 이유: 위젯(.compact)일 때는 사람이 직접 작은 창으로 만든 것이고,
     그 창을 다시 420px 상자에 넣으면 상자 안의 상자가 된다. */
  const host = colHost();
  app.classList.toggle('phonebox',
    PHONE_DIST && m === 'm4' && (host.innerWidth || 0) > 460);
  /* 상단 바를 좁히는 규칙은 위젯이 이미 갖고 있다. 베껴 쓰지 않고 같이 쓴다 —
     390px 에서 상단 바가 두 줄로 접히는 건 후보판 넷 모두에서 났던 일이고,
     그 해결책은 이미 만들어져 검증돼 있었다. */
  app.classList.toggle('slim', m === 'm4' || app.classList.contains('compact'));
  /* D3 에는 사무실 탭이 없다(무대가 늘 뒤에 있다). 폰에서 사무실을 보다가
     창을 넓히면 아무 화면도 안 뜨게 되므로 결재함으로 데려온다. */
  if (m !== 'm4' && uiCol === 'stage') uiCol = 'inbox';
  if (m) app.dataset.col = uiCol; else delete app.dataset.col;
  colSync();
  if (typeof fitWorld === 'function') fitWorld();
}

/* 탭 줄의 표시만 갱신한다. 숫자는 renderTodos 가 넣는다(ui.js). */
function colSync(){
  $$('#colTabs button').forEach(b => b.classList.toggle('on', b.dataset.col === uiCol));
}

/* 화면을 바꾼다. **uiCol 이 진실이고 uiTab 은 따라온다** —
   두 상태를 나란히 두면 반드시 갈린다(오른쪽 패널의 탭과 이 줄이 서로 다른 걸 가리킨다). */
function setCol(v, opts){
  if (COLS.indexOf(v) < 0) return;
  const app = $('#app');
  uiCol = v;
  try { localStorage.setItem(COL_KEY, v); } catch(e){}
  if (colOn()) app.dataset.col = v;
  if (v === 'staff' || v === 'shop' || v === 'log'){
    uiTab = v;
    $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === v));
    renderRight();
  }
  colSync();
  /* 결재함으로 오면 바로 적을 수 있게 커서를 넣는다 — 단 폰에서는 넣지 않는다.
     자판이 올라오면서 방금 보러 온 목록의 절반을 덮는다. */
  if (v === 'inbox' && app.classList.contains('onecol') && !(opts && opts.quiet)){
    const i = $('#todoInput'); if (i) i.focus();
  }
  if (typeof fitWorld === 'function') fitWorld();
}

/* 어떤 요소를 보여주려면 어느 탭이어야 하는지. 안내판(tutor.js)과 조사가 쓴다 —
   탭마다 좌표를 적어 두는 대신 **요소가 어디 살고 있는지**를 묻는다. */
function colFor(el){
  if (!el || !colOn()) return null;
  if (el.closest('#panelInbox')) return 'inbox';
  if (el.closest('#panelBiz')) return (uiTab === 'inbox' ? 'staff' : uiTab);
  if (el.closest('.stagewrap')) return $('#app').classList.contains('tabbar') ? 'stage' : null;
  return null;
}
/* 그 요소가 있는 화면으로 옮긴다. 이미 맞으면 아무 일도 안 한다. */
function colReveal(el){
  const want = colFor(el);
  if (want && want !== uiCol) setCol(want, { quiet:true });
  return want;
}

function colInit(){
  /* 탭 줄이 없는 문서에서도 부팅은 끝나야 한다 — 이 파일이 던지면 뒤의 main.js 가
     통째로 멈추고, 그건 "탭이 안 보인다" 가 아니라 "게임이 안 뜬다" 가 된다. */
  const tabs = $('#colTabs');
  if (!tabs) return;
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-col]');
    if (b) setCol(b.dataset.col);
  });
  colHost().addEventListener('resize', colApply);
  /* 세로/가로를 돌리면 폭과 높이가 같이 바뀐다. resize 가 먼저 오는 기기도 있어
     둘 다 듣는다 — 한 번 더 도는 비용은 클래스 토글 세 개다. */
  colHost().addEventListener('orientationchange', () => setTimeout(colApply, 120));
  colApply();
}
