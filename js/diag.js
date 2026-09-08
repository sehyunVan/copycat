/* ============================================================
   diag.js — 실기기에서 **화면이 어떻게 되어 있는지** 눈으로 읽는 창.

   왜 있나: 폰에서만 나는 증상을 헤드리스로 못 재현한 일이 세 번 있었다(키보드가
   올라올 때 배치가 바뀐다 · 채용 창이 옆으로 밀린다). 재현이 안 되면 고칠 수가 없고,
   폰에는 개발자 도구가 없다. 그래서 숫자를 화면에 띄운다 — 사진 한 장이면 된다.

   ?diag=1 일 때만 붙는다. 그 외에는 이 파일은 아무 일도 안 한다(자동 실행 없음).
   ============================================================ */
(function () {
  'use strict';
  /* 켜는 길이 둘이다.
     · 웹: 주소에 ?diag=1
     · 앱: **왼쪽 위 고양이 로고를 1.2초 길게 누른다** — 앱에는 주소창이 없어서
       질의문자를 붙일 수가 없다. 폰에서만 나는 증상은 앱에서 나므로, 앱에서 열 수
       있어야 이 창이 쓸모가 있다. 우연히 눌릴 자리가 아니라 숨긴 문으로 충분하다. */
  const auto = (() => { try { return /[?&]diag=1/.test(location.search); } catch (e) { return false; } })();

  const box = document.createElement('div');
  box.id = 'ccdiag';
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;pointer-events:none;' +
    'background:rgba(10,8,6,.86);color:#FFE9C8;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;' +
    'padding:6px 8px;white-space:pre;letter-spacing:0';
  let on = false;
  function show(v){
    on = v;
    if (!v) { if (box.parentNode) box.parentNode.removeChild(box); return; }
    (document.body || document.documentElement).appendChild(box);
    paint();
  }
  function armLongPress(){
    const hit = document.querySelector('.brand') || document.querySelector('#logo');
    if (!hit) return setTimeout(armLongPress, 1000);
    let t = null;
    const start = () => { clearTimeout(t); t = setTimeout(() => show(!on), 1200); };
    const stop = () => clearTimeout(t);
    ['pointerdown'].forEach(e => hit.addEventListener(e, start));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => hit.addEventListener(e, stop));
  }
  if (document.body) armLongPress(); else document.addEventListener('DOMContentLoaded', armLongPress);
  if (auto) { if (document.body) show(true); else document.addEventListener('DOMContentLoaded', () => show(true)); }

  const n = v => Math.round(v || 0);

  /* 화면보다 넓은 것 — 「옆으로 밀린다」의 범인은 늘 이것이다 */
  function widest(){
    let worst = null;
    document.querySelectorAll('.veil *, #app *').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.width <= innerWidth + 0.5 || r.height < 6) return;
      if (!worst || r.width > worst.w) worst = { s: (e.id ? '#' + e.id : e.tagName.toLowerCase() +
        (e.className && e.className.split ? '.' + e.className.split(' ')[0] : '')), w: r.width };
    });
    return worst ? worst.s + ' ' + n(worst.w) + 'px' : '없음';
  }

  function paint(){
    const app = document.querySelector('#app');
    const de = document.documentElement;
    const vv = window.visualViewport;
    const a = document.activeElement;
    box.textContent =
      '창 ' + n(innerWidth) + '×' + n(innerHeight) +
      '  뷰 ' + (vv ? n(vv.width) + '×' + n(vv.height) + ' @' + n(vv.offsetLeft) + ',' + n(vv.offsetTop) +
                ' ×' + (vv.scale || 1).toFixed(2) : '(없음)') + '\n' +
      '#app ' + (app ? app.className || '(무)' : '(없음)') + '\n' +
      '스크롤 ' + n(de.scrollLeft) + ',' + n(de.scrollTop) +
      '  넘침 ' + (de.scrollWidth > de.clientWidth ? n(de.scrollWidth - de.clientWidth) + 'px' : '없음') +
      '  포커스 ' + (a ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') : '-') + '\n' +
      '화면보다 넓은 것: ' + widest();
  }

  ['resize', 'orientationchange', 'focusin', 'focusout', 'scroll'].forEach(t =>
    window.addEventListener(t, () => { if (on) paint(); }, true));
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', () => { if (on) paint(); });
    window.visualViewport.addEventListener('scroll', () => { if (on) paint(); });
  }
  setInterval(() => { if (on) paint(); }, 700);   /* 배치는 게임이 늦게 바꾸기도 한다 */
})();
