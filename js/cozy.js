/* ============================================================
   cozy.js — 폰 UI 「아늑 스킨」

   원본은 `spike/ui/cozy/skin.js` 다. 저기서는 게임을 안 건드리고 **밖에서 주입**해
   시안을 보는 판이었고, 이 파일은 그 판을 **게임 안으로 옮긴 것**이다(2026-08-31 배포).
   그래서 둘의 내용은 같다 — 시안을 고칠 때는 저쪽을 고치고 여기로 다시 굽는다.

   ── 아직 시안 등급인 곳 둘 ──
   1. 사건 카드가 **직원 패널에 이미 그려진 카드를 베낀다.** 게임 상태(S)가 모듈 안에
      있어서 밖에서 못 읽던 시절의 방법이다. 이제 게임 안이니 ui.js 에서 상태를 직접
      읽어 그리는 게 맞다 — 지금은 사무실 탭에 오래 있으면 **분기 처리 건수가 늦는다.**
   2. 직원 화면을 renderRight 가 다시 쓸 때마다 **통째로 다시 짓는다**(1.2초마다).
      관찰자가 마이크로태스크에서 도니까 깜빡이지는 않지만, 제자리에서 갱신하는 것이
      맞다.
   둘 다 「보기」에는 지장이 없어서 이대로 낸다. 고칠 자리는 ui.js 안이다.
   ============================================================ */
/* ============================================================
   아늑 스킨 — 게임 밖에서 얹는 판 (2026-08-31)

   `skin.css` 가 못 하는 것을 **바깥에서** 한다. 게임 파일은 한 줄도 안 고친다 —
   이건 시안이고, 시안이 원본을 건드리면 그건 시안이 아니다.

     1. 시계를 두 줄로     ui.js 의 clockChipHTML 은 한 줄을 만든다. 그 결과를 받아
                          `Day 1 · 09:00` / `근무 · 점심까지 2:59` 로 쪼갠다.
     2. 사건 카드          무대 아래에 멍멍파·수사를 띄운다. 게임 상태(S)는 모듈 안에
                          있어서 밖에서 못 읽는다 — 그래서 **직원 패널에 이미 그려진
                          카드를 옮겨 온다.**
     3. 아이콘             이모지를 직접 그린 SVG 로 갈아 끼운다.
     4. 직원 도감          목록을 「선택된 하나 + 인사 게시판」으로 다시 짓는다.
     5. 배치·인테리어 시트  망치 하나로 가구 배치와 벽지·바닥·러그를 한 문에 모은다.

   ── 진짜로 넣을 때는 이렇게 안 한다 ──
   2번은 ui.js 안에서 상태를 직접 읽어 그리는 게 맞다. 여기서 DOM 을 베끼는 이유는
   오직 「게임을 안 건드린다」 하나다. 그래서 **숫자가 늦다**: #rightBody 는 경영
   화면이 보일 때만 다시 그려지므로, 사무실 탭에 오래 있으면 카드의 분기 처리 건수가
   마지막으로 본 값에 멈춘다. 시안을 보는 데는 지장이 없지만 설계도는 아니라는 뜻이다.

   (시간대에 따라 UI 색이 흐르게 한 판이 있었는데 접었다 — 색이 계속 움직이는 것이
    산만했다. 되살리려면 R3.skyInfo().sky 가 "morning|day|17|1" 을 준다.)
   ============================================================ */
(function (doc) {
  const $ = s => doc.querySelector(s);
  const app = $('#app');
  if (!app) return;

  /* ---------- 1. 시계 두 줄 ----------
     **타이머로 하면 안 된다.** ui.js 의 renderTop 이 1초마다 #clock 을 통째로 다시 쓰는데,
     0.5초짜리 폴링으로 고쳐 놓으면 화면의 절반의 시간은 한 줄짜리다 — 사진을 찍으면
     실제로 반은 한 줄로 찍힌다(그렇게 한 번 찍혔다). 그래서 **저쪽이 쓰는 순간에**
     바로 얹는다. 우리가 쓴 것이 다시 우리를 부르는 것은 flag 로 끊는다. */
  const clock = $('#clock');
  let mine = false;
  function twoLine() {
    if (mine || !app.classList.contains('tabbar')) return;
    if (clock.querySelector('b')) return;                 // 이미 두 줄이다
    const raw = (clock.textContent || '').trim();
    const p = raw.split(' · ');
    if (p.length < 3) return;
    const bar = clock.querySelector('i');
    mine = true;
    clock.innerHTML = `<b>${p[0]} · ${p[1]}</b><em>${p.slice(2).join(' · ')}</em>`;
    if (bar) clock.appendChild(bar);
    mine = false;
  }
  /* 시계 **밑에** 근무·사기 줄이 붙는다. 그 자리를 숫자로 박아 두면(예전 122px)
     시계가 한 줄 늘어나는 날 바로 겹친다 — 그래서 여기서 재서 넘긴다.
     읽는 곳은 style.css 의 --hudtop 하나뿐이고, 못 재면 예전 값으로 돌아간다. */
  function hudTop(){
    if (!app.classList.contains('tabbar')) return;
    /* 시계 칩 **자신의 자리**도 숫자가 아니라 잰 값이다. 위쪽 띠는 안전 영역만큼
       높아지는데(노치·다이나믹 아일랜드·글자 크기 설정), 칩이 `top:60px` 처럼
       추측한 값을 들고 있으면 그 띠 밑으로 파고든다 — 아이폰에서 실제로 그랬다
       (2026-09-08). 띠를 재서 넘기면 칩도 오른쪽 줄도 같이 따라온다. */
    const bar = doc.getElementById('topbar');
    /* **높이가 아니라 아래 모서리**를 넘긴다. 높이를 주면 읽는 쪽이 「띠는 0 에서
       시작한다」를 가정해야 하는데, 그 띠는 배치에 따라 absolute 이기도 하다 —
       가정이 틀리면 오른쪽 줄이 띠 위로 올라가 설정 단추와 겹친다(실기기 2026-09-08).
       bottom 은 가정이 필요 없다. */
    const bb = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
    if (bb > 0) app.style.setProperty('--topb', bb + 'px');

    const h = clock.offsetHeight;
    if (!h) return;                                        /* 아직 안 그려졌다 */
    app.style.setProperty('--hudtop', (clock.offsetTop + h + 8) + 'px');
  }

  new MutationObserver(() => { twoLine(); hudTop(); })
    .observe(clock, { childList: true, characterData: true, subtree: true });
  /* 첫 그림과 창 크기 변화 — 시계는 1초마다 다시 쓰이므로 위 관찰자가 대부분 잡지만,
     처음 한 번과 회전은 그 전에 온다. */
  hudTop();
  window.addEventListener('resize', hudTop);
  setTimeout(hudTop, 1200);

  /* ---------- 3. 이모지를 직접 그린 아이콘으로 ----------
     레퍼런스의 아이콘은 그려진 것이지 이모지가 아니다. 이모지는 기기마다 그림이 다르고
     (애플·삼성·구글이 전부 다른 고양이를 그린다) 색을 못 바꿔서 **고른 칸에서 흰색이
     되지 않는다** — 그게 제일 큰 이유다.

     24×24 격자에 **채운 실루엣**으로 통일하고 안쪽 무늬는 구멍으로 판다
     (fill-rule:evenodd). 그래서 어느 바탕 위에서도 같은 그림이고, 색은
     `fill:currentColor` 로 CSS 가 정한다. */
  const P = {
    /* 사무실 = **집**. 창문 달린 빌딩이었는데 레퍼런스는 집이다 — 이 게임의 사무실은
       회사이기도 하지만 하루를 같이 보내는 방이라 집이 더 맞는 그림이기도 하다. */
    office:  'M12 2.3a1.4 1.4 0 0 1 .9.33l8.5 7.2-1.5 1.75-1.3-1.1V21a1 1 0 0 1-1 1h-4.2v-5.9h-4.8V22H5a1 1 0 0 1-1-1v-10.5l-1.3 1.1L1.2 9.85l8.5-7.2A1.4 1.4 0 0 1 12 2.3Z',
    inbox:   'M8.6 2h6.8a1.6 1.6 0 0 1 1.6 1.6V4H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3.6A1.6 1.6 0 0 1 8.6 2Zm.4 2v1.6h6V4H9ZM7.4 9.4v2h9.2v-2H7.4Zm0 4.2v2h9.2v-2H7.4Zm0 4.2v2h6v-2h-6Z',
    staff:   'M4.9 3.1 7.5 8.3A9 9 0 0 1 12 7.1c1.7 0 3.2.4 4.5 1.2l2.6-5.2a.7.7 0 0 1 1.3.3v8.2c0 4.9-3.8 8.2-8.4 8.2S3.6 16.5 3.6 11.6V3.4a.7.7 0 0 1 1.3-.3ZM9 12.6a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Zm6 0a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z',
    /* 비품 = **상자**. 쇼핑백은 「산다」를 말하는데, 이 목록은 사서 **사무실에 들어오는**
       물건이라 배송 상자가 맞다. */
    shop:    'M12 2.2 21.6 6.6v10.8L12 21.8 2.4 17.4V6.6L12 2.2Zm0 2.5L6.1 7.4 12 10.1l5.9-2.7L12 4.7ZM4.4 9.1v7l6.6 3v-7l-6.6-3Zm15.2 0-6.6 3v7l6.6-3v-7Z',
    log:     'M3 4.6A1.6 1.6 0 0 1 4.6 3h12.8A1.6 1.6 0 0 1 19 4.6V6h1.4A1.6 1.6 0 0 1 22 7.6V18a3 3 0 0 1-3 3H5.2A2.2 2.2 0 0 1 3 18.8V4.6ZM19 8v10a1 1 0 0 0 2 0V8h-2ZM6 6.6v5.2h5.4V6.6H6Zm7.4 0v1.8H17V6.6h-3.6Zm0 3.4v1.8H17V10h-3.6ZM6 14v1.8h11V14H6Zm0 3.6v1.8h11v-1.8H6Z',
    fish:    'M20.4 5.6a.8.8 0 0 1 .6.9c-.3 1.6-.9 3-1.7 4.3.8 1.3 1.4 2.7 1.7 4.3a.8.8 0 0 1-1.3.7l-3.2-2c-1.5 1.4-3.5 2.3-5.9 2.3-4.3 0-8-2.9-8.6-5a.9.9 0 0 1 0-.5c.6-2.2 4.3-5 8.6-5 2.4 0 4.4.8 5.9 2.2l3.2-2a.8.8 0 0 1 .7-.2ZM7.9 9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
    paw:     'M6.3 6.5c1.1-.3 2.4.6 2.8 2s-.1 2.7-1.2 3-2.4-.6-2.8-2 .1-2.7 1.2-3Zm11.4 0c1.1.3 1.6 1.6 1.2 3s-1.7 2.3-2.8 2-1.6-1.6-1.2-3 1.7-2.3 2.8-2ZM12 4.3c1.3 0 2.3 1.3 2.3 2.9S13.3 10 12 10 9.7 8.8 9.7 7.2 10.7 4.3 12 4.3Zm0 7.3c2.7 0 4.9 2.2 4.9 5 0 2-1.3 3.4-3.1 3.4-1.1 0-1.6-.4-1.8-.4s-.7.4-1.8.4c-1.8 0-3.1-1.4-3.1-3.4 0-2.8 2.2-5 4.9-5Z',
    heat:    'M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Zm0 2.4a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2Zm5.7 11.3 1.8-1.8 4.1 4.2a1.3 1.3 0 0 1-1.8 1.8l-4.1-4.2Z',
    chair:   'M7 3h10v8.2H7V3Zm-2 9.4h14v2.2H5v-2.2ZM7 15h2.1v6H7v-6Zm7.9 0H17v6h-2.1v-6Z',
    doc:     'M6 2h7.2L18 6.8V22H6V2Zm7.4 1.9v3.4h3.4l-3.4-3.4ZM8.4 11v1.9h7.2V11H8.4Zm0 3.7v1.9h7.2v-1.9H8.4Zm0 3.7V20h4.8v-1.6H8.4Z',
    check:   'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4.6 6.2-6.2 6.2-2.5-2.5-1.8 1.8 4.3 4.3 8-8-1.8-1.8Z',
    cam:     'M3 7.4A2.4 2.4 0 0 1 5.4 5h6.2A2.4 2.4 0 0 1 14 7.4v9.2a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 16.6V7.4Zm13 3.1 4-2.6a.8.8 0 0 1 1.3.7v6.8a.8.8 0 0 1-1.3.7l-4-2.6v-3ZM6.4 8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z',
    /* 사진기 — cam(캠코더)은 「따라다니기」가 쓰고 있다. 렌즈는 disc 와 같은 문법
       (구멍 고리 + 가운데 점)이라 한 벌로 읽힌다. */
    photo:   'M8.1 4.7a1.7 1.7 0 0 1 1.4-.7h5a1.7 1.7 0 0 1 1.4.7l1 1.5h2.7A2.4 2.4 0 0 1 22 8.6v9a2.4 2.4 0 0 1-2.4 2.4H4.4A2.4 2.4 0 0 1 2 17.6v-9a2.4 2.4 0 0 1 2.4-2.4h2.7l1-1.5ZM12 8.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 2.1a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Zm6.4-2.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z',
    dots:    'M5 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Zm7 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Zm7 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z',
    /* 멍멍파. 직원(고양이)과 **한눈에 갈려야** 하므로 귀를 세우지 않고 옆으로 늘어뜨린다 —
       뾰족한 귀 둘이면 24px 에서 고양이와 구분이 안 된다(첫 판이 그랬다). */
    dog:     'M7.2 4.1a8 8 0 0 1 9.6 0c1.5.5 2.4 1.7 2.4 3.4v4.9c0 4-3.2 7.1-7.2 7.1s-7.2-3.1-7.2-7.1V7.5c0-1.7.9-2.9 2.4-3.4ZM4.8 6.6C3.4 7 2.5 8.3 2.5 10v2.4c0 1.6.9 2.8 2.3 3.2V6.6Zm14.4 0v9c1.4-.4 2.3-1.6 2.3-3.2V10c0-1.7-.9-3-2.3-3.4ZM9.3 10.2a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm5.4 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM12 14.6c-1.1 0-2 .6-2 1.3 0 .8.9 1.7 2 1.7s2-.9 2-1.7c0-.7-.9-1.3-2-1.3Z',
    gear:    'M12 8.1a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8Zm-1.1-6.5h2.2l.5 2.6a8.4 8.4 0 0 1 2 .83l2.1-1.6 1.6 1.6-1.6 2.1a8.4 8.4 0 0 1 .83 2l2.6.5v2.2l-2.6.5a8.4 8.4 0 0 1-.83 2l1.6 2.1-1.6 1.6-2.1-1.6a8.4 8.4 0 0 1-2 .83l-.5 2.6h-2.2l-.5-2.6a8.4 8.4 0 0 1-2-.83l-2.1 1.6-1.6-1.6 1.6-2.1a8.4 8.4 0 0 1-.83-2l-2.6-.5v-2.2l2.6-.5a8.4 8.4 0 0 1 .83-2l-1.6-2.1 1.6-1.6 2.1 1.6a8.4 8.4 0 0 1 2-.83l.5-2.6Z',
    rotL:    'M12 4.2V1.4L6.6 5.1 12 8.8V6.4a5.6 5.6 0 1 1-5.6 5.6H4.2A7.8 7.8 0 1 0 12 4.2Z',
    rotR:    'M12 4.2V1.4l5.4 3.7L12 8.8V6.4a5.6 5.6 0 1 0 5.6 5.6h2.2A7.8 7.8 0 1 1 12 4.2Z',
    eye:     'M12 4.6c4.6 0 8.4 3 9.9 7.4-1.5 4.4-5.3 7.4-9.9 7.4S3.6 16.4 2.1 12C3.6 7.6 7.4 4.6 12 4.6Zm0 2.4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z',
    cal:     'M7 2.2h2.4v2.2h5.2V2.2H17v2.2h1.6A2.4 2.4 0 0 1 21 6.8v12A2.4 2.4 0 0 1 18.6 21H5.4A2.4 2.4 0 0 1 3 18.6v-12a2.4 2.4 0 0 1 2.4-2.4H7V2.2ZM5.4 9.6v9h13.2v-9H5.4Zm2.2 2h3v3h-3v-3Z',
    board:   'M4 3.4h16a1.6 1.6 0 0 1 1.6 1.6v12a1.6 1.6 0 0 1-1.6 1.6h-6.4l1.9 3.2h-2.6L11 18.6H4A1.6 1.6 0 0 1 2.4 17V5A1.6 1.6 0 0 1 4 3.4Zm2.2 3.2v3.4h5V6.6h-5Zm7.2 0v1.8h4.4V6.6h-4.4Zm0 3.2v1.8h4.4V9.8h-4.4Zm-7.2 2.6v1.8h11.6v-1.8H6.2Z',
    note:    'M20.2 2.2a1 1 0 0 1 1.4 1v12.4a4 4 0 1 1-2.2-3.6V6.9L10 9v9.2a4 4 0 1 1-2.2-3.6V6.2a1 1 0 0 1 .8-1l11.6-3Z',
    wave:    'M2.4 12c1.6-3.2 3-4.8 4.4-4.8S9 8.8 10.6 12s3 4.8 4.4 4.8 2.8-1.6 4.4-4.8l2.2 1c-1.9 3.9-3.7 6-6.6 6s-4.7-2.1-6.6-6C6.6 10.6 5.6 9.6 4.6 13L2.4 12Z',
    loop:    'M7.4 3.6h9.2l-2.6-2.6L15.6.4l4.8 4.8-4.8 4.8-1.6-1.6 2.6-2.6H7.4a3.4 3.4 0 0 0-3.4 3.4v2.6H1.8v-2.6A5.6 5.6 0 0 1 7.4 3.6Zm9.2 8.2h2.2v2.6a5.6 5.6 0 0 1-5.6 5.6H4l2.6 2.6L5 24.2.2 19.4 5 14.6l1.6 1.6L4 18.8h9.2a3.4 3.4 0 0 0 3.4-3.4v-3.6Z',
    mute:    'M11.2 3.4a.8.8 0 0 1 1.3.7v15.8a.8.8 0 0 1-1.3.6L6 16.4H3.2a1 1 0 0 1-1-1V8.6a1 1 0 0 1 1-1H6l5.2-4.2Zm4.4 5 1.6-1.6 2.6 2.6 2.6-2.6 1.6 1.6-2.6 2.6 2.6 2.6-1.6 1.6-2.6-2.6-2.6 2.6-1.6-1.6 2.6-2.6-2.6-2.6Z',
    trash:   'M9.4 1.8h5.2a1.4 1.4 0 0 1 1.4 1.4v1.2h4.2v2.2H3.8V4.4H8V3.2a1.4 1.4 0 0 1 1.4-1.4Zm.8 2.6v.8h3.6v-.8h-3.6ZM5.4 8.8h13.2l-.9 11.8A1.8 1.8 0 0 1 15.9 22.2H8.1a1.8 1.8 0 0 1-1.8-1.6L5.4 8.8Zm3.4 2.4v8.2h1.9v-8.2H8.8Zm4.4 0v8.2h1.9v-8.2h-1.9Z',
    flag:    'M5.4 2.2h2.2v1.5c3.4-1.6 6.6.9 9.4-.4a1 1 0 0 1 1.4.9v8.2a1 1 0 0 1-.6.9c-3.2 1.4-6.4-1.1-10.2.6v7.9H5.4V2.2Z',
    close:   'M6.4 4.8 12 10.4l5.6-5.6 1.6 1.6L13.6 12l5.6 5.6-1.6 1.6L12 13.6l-5.6 5.6-1.6-1.6L10.4 12 4.8 6.4l1.6-1.6Z',
    chevL:   'M15.4 3.6 7 12l8.4 8.4 1.7-1.7L10.4 12l6.7-6.7-1.7-1.7Z',
    chevR:   'M8.6 3.6 17 12l-8.4 8.4-1.7-1.7L13.6 12 6.9 5.3l1.7-1.7Z',
    /* 위·아래는 좌우를 90° 돌린 것이다 — 같은 선 굵기, 같은 꺾임이라야 넷이 한 벌로 읽힌다 */
    chevU:   'M3.6 15.4 12 7l8.4 8.4-1.7 1.7L12 10.4l-6.7 6.7-1.7-1.7Z',
    chevD:   'M3.6 8.6 12 17l8.4-8.4-1.7-1.7L12 13.6 5.3 6.9 3.6 8.6Z',
    /* (뽑기 기계·뽑기권 아이콘이 여기 있었다 — 가챠를 내리면서 같이 걷었다. 2026-09-02) */
    dice:    'M4.6 4.6h14.8v14.8H4.6V4.6Zm3.1 2.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8.6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-4.3 3.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8.6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    lock:    'M12 1.6a5.2 5.2 0 0 1 5.2 5.2v2.6h.9A1.9 1.9 0 0 1 20 11.3v8.8a1.9 1.9 0 0 1-1.9 1.9H5.9A1.9 1.9 0 0 1 4 20.1v-8.8a1.9 1.9 0 0 1 1.9-1.9h.9V6.8A5.2 5.2 0 0 1 12 1.6Zm0 2.2a3 3 0 0 0-3 3v2.6h6V6.8a3 3 0 0 0-3-3Zm0 9.1a1.9 1.9 0 0 0-.9 3.6v1.8h1.8v-1.8a1.9 1.9 0 0 0-.9-3.6Z',
    disc:    'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6Zm0 5.4a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z',
    /* ── 이모지를 대신하는 그림들 ──
       기기마다 다르게 생기고 색을 못 바꾸는 것이 이모지의 두 문제다. 게임의 목록·모달이
       쓰는 것들을 한 벌로 그려 둔다. 이름은 게임이 쓰던 이모지의 뜻을 따른다. */
    coffee:  'M4.6 4.2h11.8v2.6h1.6a3.6 3.6 0 0 1 0 7.2h-1.8a6 6 0 0 1-5.9 5H10a6 6 0 0 1-5.4-5.9V4.2Zm11.8 4.8v3.2h1.6a1.6 1.6 0 0 0 0-3.2h-1.6ZM3.4 20.4h14.2v2.2H3.4v-2.2Z',
    bowl:    'M2.6 10.2h18.8a1 1 0 0 1 1 1.1 9.6 9.6 0 0 1-4.3 7.2v1.9a1 1 0 0 1-1 1H7.9a1 1 0 0 1-1-1v-1.9A9.6 9.6 0 0 1 2.6 11.3a1 1 0 0 1 1-1.1Zm4.2-6.6c2.6 0 3 1.3 3 2.2 0 .9-.5 1.5-1.2 2.2H6.4c.7-.8 1.2-1.2 1.2-1.8 0-.7-.6-.9-1.6-.9V3.6Zm5.6 0c2.6 0 3 1.3 3 2.2 0 .9-.5 1.5-1.2 2.2H12c.7-.8 1.2-1.2 1.2-1.8 0-.7-.6-.9-1.6-.9V3.6Z',
    cookie:  'M12 2.4a9.6 9.6 0 1 1 0 19.2 9.6 9.6 0 0 1 0-19.2Zm-3.4 4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Zm6.6 1.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm-5.4 6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm5.8.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z',
    dumbbell:'M2 9.4h2.6v5.2H2V9.4Zm3.8-1.6h2.6v8.4H5.8V7.8Zm3.8 2.8h4.8v2.8H9.6v-2.8Zm6 -2.8h2.6v8.4h-2.6V7.8Zm3.8 1.6H22v5.2h-2.6V9.4Z',
    book:    'M5 2.6h11.4a2.6 2.6 0 0 1 2.6 2.6v16.2H7.6A2.6 2.6 0 0 1 5 18.8V2.6Zm2.4 2.2v13a1 1 0 0 0 1 1h8.2V4.8H7.4Zm2 2.2h6.2V9H9.4V7Z',
    micro:   'M13.4 2.2 19 5.4l-4.4 7.6-2.2-1.2-1 1.8 3.6 2.1-1.1 1.9-1.5-.9-1.5 2.5h7.9v2.2H4.2v-2.2h3l4.9-8.4-2.2-1.3 5.5-9.5Z',
    joystick:'M12 2.4a4.2 4.2 0 0 1 1.1 8.2v3.2h3.3a4 4 0 0 1 4 4v2.6a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1v-2.6a4 4 0 0 1 4-4h3.3v-3.2A4.2 4.2 0 0 1 12 2.4Zm0 2.2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
    monitor: 'M3.4 3.4h17.2a1.4 1.4 0 0 1 1.4 1.4v10.8a1.4 1.4 0 0 1-1.4 1.4h-6.9v2.2h3.5v2.2H6.8v-2.2h3.5v-2.2H3.4A1.4 1.4 0 0 1 2 15.6V4.8a1.4 1.4 0 0 1 1.4-1.4Zm1 2.4v9h15.2v-9H4.4Z',
    printer: 'M6.6 2.6h10.8v4.8H6.6V2.6ZM3.4 9h17.2a1.4 1.4 0 0 1 1.4 1.4v6a1.4 1.4 0 0 1-1.4 1.4h-2.2v3.6H5.6v-3.6H3.4A1.4 1.4 0 0 1 2 16.4v-6A1.4 1.4 0 0 1 3.4 9Zm4.4 7.4v3.4h8.4v-3.4H7.8Zm9.4-5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
    tower:   'M10.6 1.6h2.8v3.2h3.4l1 3.2h-4.4v3.4h3.4l1 3.4h-4.4v3.6h4.6v3.2H6v-3.2h4.6v-3.6H6.2l1-3.4h3.4V8h-4.4l1-3.2h3.4V1.6Z',
    rocket:  'M12 1.8c3.4 2.4 5.2 6 5.2 10.2v3.4H6.8V12c0-4.2 1.8-7.8 5.2-10.2Zm0 4.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.6 16.8h3v2.4l-2.8 2.6a.8.8 0 0 1-1.3-.7l1.1-4.3Zm10.8 0 1.1 4.3a.8.8 0 0 1-1.3.7l-2.8-2.6v-2.4h3Z',
    bed:     'M2.4 6.4h2.4v5.2h6V8.2h7.4a3.4 3.4 0 0 1 3.4 3.4v6.2h-2.4v-2.4H4.8v2.4H2.4V6.4Zm5 1.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Z',
    climb:   'M6 2.4h12a2 2 0 0 1 2 2v15.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4.4a2 2 0 0 1 2-2Zm2.6 3.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6.6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-6.6 5.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6.6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-6.6 5.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6.6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    yarn:    'M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6Zm-6.6 6.2a7.6 7.6 0 0 0-.9 4.5l6.4-6.4a7.6 7.6 0 0 0-5.5 1.9Zm8.1-1.4L6 14.7a7.7 7.7 0 0 0 1.9 2.7l8.6-8.6a7.7 7.7 0 0 0-2.4-1.8Zm4.2 4-8.3 8.3a7.6 7.6 0 0 0 4.9-.4l3.8-3.8a7.6 7.6 0 0 0-.4-4.1Z',
    wood:    'M6.6 4.6h10.8a4.4 4.4 0 0 1 0 8.8H6.6a4.4 4.4 0 0 1 0-8.8Zm10.8 2.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM4.6 15h12.8a4.4 4.4 0 0 1 0 8.8H4.6a4.4 4.4 0 0 1 0-8.8Z',
    feather: 'M19.4 2.6a1 1 0 0 1 .3 1.4L9.9 18.8h3.5v2.2H4.2l-1.5 1.5-1.6-1.6 1.6-1.5V11h2.2v3.4L17.9 2.9a1 1 0 0 1 1.5-.3Z',
    globe:   'M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6Zm0 2.2c-1 0-2.3 1.9-2.9 5h5.8c-.6-3.1-1.9-5-2.9-5ZM8.7 11.6a20 20 0 0 0 0 2.8h6.6a20 20 0 0 0 0-2.8H8.7Zm-2.2 0H4.4a7.6 7.6 0 0 0 0 2.8h2.1a22 22 0 0 1 0-2.8Zm11 0a22 22 0 0 1 0 2.8h2.1a7.6 7.6 0 0 0 0-2.8h-2.1ZM9.1 16.6c.6 3.1 1.9 5 2.9 5s2.3-1.9 2.9-5H9.1Z',
    gift:    'M9.4 2.4c1.5 0 2.4 1.2 2.6 2.4.2-1.2 1.1-2.4 2.6-2.4a2.6 2.6 0 0 1 1 5h4a1 1 0 0 1 1 1v3.2H3.4V8.4a1 1 0 0 1 1-1h4a2.6 2.6 0 0 1 1-5Zm1.5 11v8.2H5.4a1 1 0 0 1-1-1v-7.2h6.5Zm2.2 0h6.5v7.2a1 1 0 0 1-1 1h-5.5v-8.2Z',
    film:    'M3 3.4h18a1 1 0 0 1 1 1v15.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1Zm1.4 2.2v2.6H7V5.6H4.4Zm12.6 0v2.6h2.6V5.6H17Zm-8 0v12.8h6V5.6H9ZM4.4 10.6v2.8H7v-2.8H4.4Zm12.6 0v2.8h2.6v-2.8H17ZM4.4 15.8v2.6H7v-2.6H4.4Zm12.6 0v2.6h2.6v-2.6H17Z',
    bell:    'M12 1.8a6.6 6.6 0 0 1 6.6 6.6v4.2l2 3.4a1 1 0 0 1-.9 1.5H4.3a1 1 0 0 1-.9-1.5l2-3.4V8.4A6.6 6.6 0 0 1 12 1.8Zm-2.6 17.4h5.2a2.6 2.6 0 0 1-5.2 0Z',
    scope:   'M17.4 1.9a1 1 0 0 1 1.3.5l3 6.4a1 1 0 0 1-.5 1.3l-3.6 1.7-3.5-7.4 3.3-2.5Zm-4.8 3.9 3.5 7.4-9.5 4.5a1 1 0 0 1-1.3-.5l-2.4-5a1 1 0 0 1 .5-1.3l9.2-5.1ZM7 19.4l2 1-1.3 2.2-2-1L7 19.4Zm6.6-3.2 2 1-1.3 2.2-2-1 1.3-2.2Z',
    clock9:  'M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6Zm0 2.2a7.6 7.6 0 1 0 0 15.2 7.6 7.6 0 0 0 0-15.2Zm1.1 2.6v5.1l3.6 2.1-1.1 1.9-4.7-2.7V7h2.2Z',
    police:  'M4 9.4 6.2 4.6A2 2 0 0 1 8 3.4h8a2 2 0 0 1 1.8 1.2L20 9.4h1.4a1 1 0 0 1 1 1v5.2a1 1 0 0 1-1 1H20a2.4 2.4 0 0 1-4.8 0H8.8a2.4 2.4 0 0 1-4.8 0H2.6a1 1 0 0 1-1-1v-5.2a1 1 0 0 1 1-1H4Zm2.6 0h10.8l-1.6-3.6H8.2L6.6 9.4Zm-.2 6.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm11.2 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
    compass: 'M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6Zm0 2.2a7.6 7.6 0 1 0 0 15.2 7.6 7.6 0 0 0 0-15.2Zm4.4 3.2-2.6 6.2-6.2 2.6 2.6-6.2 6.2-2.6ZM12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z',
    badge:   'M3.4 4.4h17.2a1.4 1.4 0 0 1 1.4 1.4v12.4a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 18.2V5.8a1.4 1.4 0 0 1 1.4-1.4Zm5.2 3.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Zm5.4.6v2.2h5.2V8.4H14Zm0 4v2.2h5.2v-2.2H14ZM4.8 16.4c.9-2 6.7-2 7.6 0H4.8Z',
    plus:    'M10.8 3.4h2.4v7.4h7.4v2.4h-7.4v7.4h-2.4v-7.4H3.4v-2.4h7.4V3.4Z',
    alarm:   'M12 3.8a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8Zm1.1 3.2v5.2l3.4 2-1.1 1.9-4.5-2.6V7h2.2ZM4.6 1.4 7 3.8 5.4 5.4 3 3ZM19.4 1.4 21.8 3 19.4 5.4 17.8 3.8Z',
    /* 배치·인테리어 — 레퍼런스의 그 망치와 갈래 셋 */
    hammer:  'M13.4 2.2a1 1 0 0 1 1.4 0l7 7a1 1 0 0 1 0 1.4l-2.5 2.5a1 1 0 0 1-1.4 0l-2.1-2.1-2 2 .9.9a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.6 1.6 0 0 1-2.3 0l-2.3-2.3a1.6 1.6 0 0 1 0-2.3l6.6-6.6a1.4 1.4 0 0 1 2 0l.9.9 2-2-2.1-2.1a1 1 0 0 1 0-1.4l2.5-2.5Z',
    brush:   'M5.4 2.6h13.2a1.6 1.6 0 0 1 1.6 1.6v5.4a1.6 1.6 0 0 1-1.6 1.6H13.4v2.2a1.6 1.6 0 0 1 1.6 1.6v2.4a3 3 0 0 1-3 3h-.8a3 3 0 0 1-3-3V15a1.6 1.6 0 0 1 1.6-1.6v-2.2H5.4A1.6 1.6 0 0 1 3.8 9.6V4.2a1.6 1.6 0 0 1 1.6-1.6Zm5.2 14v2.4a1.4 1.4 0 0 0 1.4 1.4h.8a1.4 1.4 0 0 0 1.4-1.4V16.6h-3.6Z',
    floor:   'M2.6 6.4 12 2.2l9.4 4.2v1.9L12 12.5 2.6 8.3V6.4Zm0 4.9L12 15.5l9.4-4.2v2.1L12 17.6l-9.4-4.2v-2.1Zm0 5L12 20.5l9.4-4.2v2.1L12 22.6l-9.4-4.2v-2.1Z',
    rug:     'M3.4 6.2h17.2a1 1 0 0 1 1 1.2l-1.5 9A1.6 1.6 0 0 1 18.5 17.8h-13A1.6 1.6 0 0 1 3.9 16.4l-1.5-9a1 1 0 0 1 1-1.2Zm2.3 3.4.5 3h11.6l.5-3H5.7Zm-.6 5 .3 1.8h13.2l.3-1.8H5.1Z',
  };
  const svg = n => {
    const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', P[n]);
    s.appendChild(path);
    return s;
  };
  /* 이모지가 글자로 들어 있던 자리를 SVG 로 갈아 끼운다. 한 번만 한다 — 게임은
     이 노드들을 다시 안 쓴다(숫자만 갈아 끼운다). */
  function swap(el, name) {
    if (!el || !P[name] || el.dataset.icon) return;
    el.dataset.icon = name;
    el.textContent = '';
    el.appendChild(svg(name));
  }
  /* 게임 쪽 화면이 이 그림들을 빌려 쓰는 손잡이. 그림을 두 벌 갖지 않으려고 하나만
     내놓는다 — 이모지로 내려가면 그 화면만 혼자 다른 그림체가 된다.
     (가챠가 쓰다가 갔고, 지금은 비어 있다 — TODO 57 택배가 다시 쓸 자리다.) */
  window.CCIcon = (el, name) => swap(el, name);

  /* 바닥줄은 이모지가 **맨 앞 텍스트 조각**으로 들어 있다(<span class="kv">🪑 근무 …</span>).
     통째로 비우면 숫자를 담은 자식까지 날아가므로 그 조각만 도려낸다. */
  function swapLead(kv, name) {
    if (!kv || kv.dataset.icon) return;
    const first = kv.firstChild;
    if (!first || first.nodeType !== 3) return;
    kv.dataset.icon = name;
    first.textContent = first.textContent.replace(/^\s*\S+\s*/, '');
    kv.insertBefore(svg(name), first);
  }
  /* 사보 — 왼쪽 색 막대만 있던 줄에 **아이콘 한 칸**을 붙인다. 막대는 종류를 색으로만
     말해서 무슨 소식인지 읽기 전까지 모른다. 아이콘이 있으면 줄을 안 읽고도 갈린다.
     renderRight 가 이 줄들을 다시 쓰므로 그때마다 다시 붙인다(이미 있으면 지나간다). */
  function paintLog() {
    doc.querySelectorAll('#rightBody .chatline').forEach(el => {
      if (el.dataset.ico) return;
      el.dataset.ico = '1';
      const kind = el.classList.contains('bad') ? 'heat'
                 : el.classList.contains('big') ? 'disc' : 'doc';
      /* 글을 **한 칸으로 묶고** 나서 아이콘을 앞에 둔다. 그냥 앞에 끼웠더니
         줄이 flex 라 글 안의 <b> 까지 각자 칸이 되어 문장이 조각났다
         ("Copycat / 을 넘겨받았습니다. 직원은 / 치즈 / 대표 하나…").

         그리고 **첫 문장을 제목 줄로** 올린다(레퍼런스가 두 줄이다). 태그를 살려야
         하므로 글자만 자르지 않고 HTML 을 훑어 **태그 밖에 있는 첫 마침표**에서 나눈다 —
         textContent 로 자르면 문장 안의 <b>(고양이 이름 등)이 통째로 날아간다. */
      const tx = doc.createElement('span');
      tx.className = 'logtx';
      const html = el.innerHTML;
      let cut = -1, depth = 0;
      for (let i = 0; i < html.length; i++) {
        const ch = html[i];
        if (ch === '<') depth++;
        else if (ch === '>') depth--;
        else if (depth === 0 && ch === '.') {
          const nxt = html[i + 1];
          if (nxt === undefined || nxt === ' ' || nxt === '<') { cut = i + 1; break; }
        }
      }
      if (cut > 0 && cut < html.length - 1)
        tx.innerHTML = `<span class="logh">${html.slice(0, cut)}</span>`
                     + `<span class="logd">${html.slice(cut).trim()}</span>`;
      else tx.innerHTML = `<span class="logh">${html}</span>`;
      el.innerHTML = '';
      const box = doc.createElement('span');
      box.className = 'logicon';
      box.appendChild(svg(kind));
      el.appendChild(box);
      el.appendChild(tx);
    });
  }

  /* ---------- 하단 다섯 칸 ----------
       사무실 · 결재함 · 직원 · 상점 · 사보          (게임의 원래 순서 그대로)

     한동안 상점을 배치 모드 안으로 넣고 그 칸을 사보·설정에 줬는데 되돌렸다.
     **사는 것과 놓는 것은 다른 일**이고, 사는 일은 목록이 길어서 화면 하나가 필요하다.
     배치 모드의 「가구」 갈래는 이제 **가진 것**을 보여 준다(아래 furnList) — 상점이
     파는 곳, 배치가 놓는 곳이다.

     설정은 오른쪽 위 톱니로 올라갔다(아래 gearBtn) — 다섯 칸은 「화면」이고 설정은
     「열리는 것」이라 같은 줄에 두면 하나는 늘 상태가 없는 칸이 된다.

     직원은 **발바닥**이다 — 고양이 얼굴은 이 게임에서 너무 많이 쓰여서(사기 지표·
     사건 카드·초상) 하단에서 또 쓰면 어느 것이 어느 것인지 흐려진다. */
  const NAV_ICON = { stage:'office', inbox:'inbox', staff:'paw', shop:'shop', log:'log' };
  function navRewire() {
    /* 게임이 그린 그대로 쓴다 — 이름표·data-col 을 건드리지 않는다.
       (예전 판이 넷째를 사보로, 다섯째를 설정으로 바꿔 뒀으므로 되돌려 준다.) */
    const tabs = doc.querySelectorAll('#colTabs button');
    if (tabs.length < 5) return;
    const t4 = tabs[3], t5 = tabs[4];
    if (t4.dataset.nav || t5.dataset.nav) {
      t4.dataset.col = 'shop'; t4.querySelector('b').textContent = '상점';
      t5.dataset.col = 'log';  t5.querySelector('b').textContent = '사보';
      [t4, t5].forEach(b => { delete b.dataset.nav; const sp = b.querySelector('span'); if (sp) delete sp.dataset.icon; });
      swap(t4.querySelector('span'), 'shop');
      swap(t5.querySelector('span'), 'log');
    }
  }

  /* ── 이모지 훑기 ──
     게임의 목록·모달은 아이콘을 이모지로 들고 있다. 기기마다 다르게 생기고 색을 못
     바꾸는 게 이모지의 두 문제다(어두운 칸에서 흰색이 안 된다). 그래서 **글자가
     이모지 하나뿐인 칸**을 찾아 그림으로 갈아 끼운다 — 문장 속 이모지는 건드리지
     않는다(자르면 글이 깨진다).

     값 표시의 🐟 는 남겨 둔다: 그건 「🐟320」처럼 숫자와 붙어 있어서, 떼면 게임이
     그 글자를 읽는 자리(shopRead 의 cost)가 같이 깨진다. */
  const EMOJI = {
    '☕':'coffee','🍚':'bowl','🍪':'cookie','🏋':'dumbbell','📕':'book','🔬':'micro',
    '🕹':'joystick','🖥':'monitor','🖨':'printer','🗼':'tower','🚀':'rocket','🛏':'bed',
    '🧗':'climb','🧶':'yarn','🪑':'chair','🪵':'wood','🪶':'feather',
    '🌐':'globe','🎁':'gift','🎬':'film','🔔':'bell','🔭':'scope','🕘':'clock9',
    '🚔':'police','🧭':'compass','🪪':'badge','🔒':'lock','🔍':'heat','🐶':'dog',
    '🐾':'paw','➕':'plus','⏰':'alarm','🧾':'inbox','📰':'log','📋':'inbox',
    '🎥':'cam','🛋':'hammer','⚙':'gear','🏢':'office','🐈':'staff','🛒':'shop',
    /* 쥬크박스의 곡들 — 이모지로는 「밤」과 「비」가 기기마다 다른 그림이 된다 */
    '🎼':'note','▶':'note','🌙':'clock9','🌧':'wave','🐠':'fish','💾':'disc','🪈':'note',
    '📼':'disc','💿':'disc','📅':'cal','📌':'board','🎲':'dice','🔁':'loop','🔊':'wave','🔉':'wave','🔈':'wave','🔇':'mute',
  };
  /* 변형 선택자(U+FE0F)와 이형 붙임을 떼고 본 글자만 본다 */
  const bare = t => (t || '').trim().replace(/[\uFE0E\uFE0F\u200D]/g, '');
  function iconizeEmoji(root) {
    root.querySelectorAll('.em,.ico,.shopem,.pickem,button,span,b').forEach(el => {
      if (el.dataset.icon || el.children.length) return;
      const name = EMOJI[bare(el.textContent)];
      if (!name || !P[name]) return;
      el.dataset.icon = name;
      el.textContent = '';
      el.appendChild(svg(name));
      el.classList.add('emico');
    });
    /* **글자와 붙어 있는 이모지**도 있다(「🔁 루틴」). 글자 전체가 이모지 하나일 때만
       갈면 이런 것들이 남는다. 앞의 한 글자만 떼어 내고 나머지 글은 그대로 둔다 —
       문장 중간의 이모지는 여기서도 안 건드린다(자르면 글이 깨진다). */
    root.querySelectorAll('.modal b,.modal .dot,.calrow .dot,.modal .rtline b').forEach(el => {
      if (el.dataset.icon || el.children.length) return;
      const t = el.textContent || '';
      const m = t.match(/^\s*(\S+)\s+(.+)$/);
      if (!m) return;
      const name = EMOJI[bare(m[1])];
      if (!name || !P[name]) return;
      el.dataset.icon = name;
      el.textContent = '';
      const box = doc.createElement('span');
      box.className = 'emico lead';
      box.appendChild(svg(name));
      el.appendChild(box);
      el.appendChild(doc.createTextNode(m[2]));
    });
  }

  function paintIcons() {
    navRewire();
    iconizeEmoji(app);
    doc.querySelectorAll('#colTabs button[data-col]').forEach(b =>
      swap(b.querySelector('span'), NAV_ICON[b.dataset.col] || b.dataset.col));
    const stats = doc.querySelectorAll('#topbar .stat .ico');
    ['fish', 'paw', 'heat'].forEach((n, i) => swap(stats[i], n));
    const kvs = doc.querySelectorAll('.stagefoot .kv');
    ['chair', 'staff', 'doc', 'check'].forEach((n, i) => swapLead(kvs[i], n));
    swap($('.cambtn'), 'cam');
    swap($('#btnMore'), 'dots');
  }

  /* ---------- ⋯ 를 없애고 그 안의 것들을 설정으로 ----------
     상단의 ⋯ 팝오버에는 다섯이 있었다: 기록증 · 배치 모드 · 설정 · 사규 · 처음부터.
     그 중 셋은 이미 화면에 나왔다(배치=망치, 설정=하단 탭). 남은 셋이 갈 곳이 없어서
     ⋯ 가 남아 있었는데, **설정 맨 아래**가 그 자리다 — 사규도 기록증도 처음부터도
     「자주 안 여는 것」이고, 설정이 그런 것들의 방이다.

     설정 창은 게임이 그린다(ui.js). 우리는 뜨는 순간 **맨 아래에 줄 셋을 얹고**,
     누르면 게임의 그 단추를 대신 누른다. 창을 먼저 닫는 이유: 셋 다 자기 창을 여는
     것들이라(사규·기록증·되돌릴 수 없는 확인) 창 위에 창이 쌓이면 어느 것이 무엇인지
     모른다. */
  /* 한 줄만 남았다. 사규와 근무 기록증도 여기 뒀었는데 **버렸다** — 설정 맨 아래는
     「자주 안 여는 것」의 방이지 「안 열게 된 것」의 창고가 아니다. 둘 다 폰에서
     들어가는 길이 없어졌다(데스크톱의 ⋯ 에는 그대로 있다). */
  const EXTRA = [
    { sel:'#btnReset', icon:'trash', t:'처음부터 다시 시작하기',
      d:'저장을 지우고 전단을 보던 그 밤부터 다시 — 되돌릴 수 없습니다', bad:true },
  ];
  function dressSettings(veil) {
    const q = veil.querySelector('.mhead .q');
    if (!q || !/SETTINGS|설정|設定/i.test(q.textContent)) return;
    const body = veil.querySelector('.mbody');
    if (!body || body.querySelector('.cozyextra')) return;
    const box = doc.createElement('div');
    box.className = 'cozyextra';
    box.innerHTML = EXTRA.map(x => `<button class="card exrow${x.bad ? ' bad' : ''}" data-go="${x.sel}">
        <span class="em" data-ic="${x.icon}"></span>
        <span class="info"><b>${x.t}</b><span>${x.d}</span></span>
      </button>`).join('');
    body.appendChild(box);
    box.querySelectorAll('[data-ic]').forEach(el => swap(el, el.dataset.ic));
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      const target = $(b.dataset.go);
      /* 창을 먼저 닫는다 — 그 다음에 저쪽 창이 뜬다 */
      const close = veil.querySelector('.mfoot button, .mfoot .buy');
      if (close) close.click(); else veil.remove();
      setTimeout(() => { if (target) target.click(); }, 220);
    });
  }

  /* 모달은 #app 밖(body 직속)에 붙는다 — 그래서 우리 선택자도, 훑기도 따로 걸어야
     한다. 뜨는 순간 아이콘을 갈고, body 에 도장을 찍어 CSS 가 폰인지 알게 한다. */
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes)
      if (n.nodeType === 1 && n.classList && n.classList.contains('veil')) {
        dressSettings(n);
        iconizeEmoji(n);
      }
  }).observe(doc.body, { childList: true });

  /* 설정은 **오른쪽 위 톱니** 하나다. ⋯ 가 있던 자리다 — 그 팝오버를 없애면서
     설정만 밖으로 꺼냈다(나머지는 각자 자리를 찾았다). */
  const gearBtn = doc.createElement('button');
  gearBtn.className = 'iconbtn gearbtn';
  gearBtn.title = '설정';
  swap(gearBtn, 'gear');
  {
    const more = $('#btnMore');
    if (more && more.parentElement) more.parentElement.insertBefore(gearBtn, more);
  }
  gearBtn.addEventListener('click', () => { const g = $('#btnSettings'); if (g) g.click(); });

  /* (왼쪽 아래에 가챠 공이 떠 있었다 — 가챠를 내리면서 같이 걷었다. 2026-09-02) */

  /* ---------- 2. 사건 카드 ---------- */
  /* ── 왼쪽 아래는 **쌓는 자리**다 ──
     택배 단추와 이 카드는 둘 다 왼쪽 아래에 산다. 전에는 각자 화면 바닥에서 몇 px 이라고
     정해 두고(단추는 94px) 서로 안 겹치기를 바랐는데, 그 94 는 **카드가 두 줄일 때의 높이**
     였다. 수사(혐의) 카드가 뜨면 카드가 더 높아져서 단추를 덮었다.

     그래서 자리를 숫자로 정하지 않는다. 둘을 한 상자에 세로로 넣고 바닥에 붙인다 —
     카드가 커지면 단추가 그만큼 위로 밀린다. 카드가 없으면 단추가 내려온다.
     (상자는 클릭을 안 먹는다 — 방을 가리면 안 되므로 pointer-events 는 자식만 켠다.) */
  const stack = doc.createElement('div');
  stack.className = 'stagestack';
  app.appendChild(stack);

  const card = doc.createElement('div');
  card.className = 'stagecard';
  card.id = 'stageCard';
  stack.appendChild(card);

  let lastKey = '';
  function fillCard() {
    if (!app.classList.contains('tabbar')) return;

    /* ── 무엇을 띄우나 ──
       수사(혐의)가 있으면 그것이 먼저다 — 손을 대야 하는 일이고 무마 단추가 붙는다.
       없으면 **분기**를 띄운다. 멍멍파 점유율을 띄우던 자리인데 바꿨다: 점유율은
       「지금 나쁜 정도」이고 분기는 「다음이 언제 오나」다. 사무실을 보고 있는 사람이
       알고 싶은 것은 뒤쪽이다 — 분기를 넘기면 자리가 늘고 등급이 오른다.

       분기 숫자는 상단의 분기 막대에서 온다(#qLabel · #qNum · #qFill). 폰에서 그 막대를
       감췄으므로(줄이 하나 더 생긴다) 여기가 그 숫자가 사는 유일한 자리다. */
    const legal = $('#rightBody .legalcard');
    if (!legal) return fillQuarter();

    const src = legal;
    const crow = src.querySelector('.crow');
    if (!crow) return;
    const key = crow.textContent;
    if (key === lastKey) return;      // 매초 innerHTML 을 새로 쓰면 막대가 계속 처음부터 찬다
    lastKey = key;
    card.innerHTML = '';
    /* **베낀 줄에서 단추를 먼저 뺀다.** `.buy[data-act]` 는 `.crow` 안에 들어 있어서
       줄을 통째로 복제하면 단추도 같이 온다 — 그런데 그건 리스너가 없는 사본이라
       눌러도 아무 일이 없다. 아래에서 제대로 배선한 사본을 하나 더 붙이므로,
       빼지 않으면 **「무마」가 둘이 뜨고 왼쪽 것이 죽어 있다.** */
    const line = crow.cloneNode(true);
    line.querySelectorAll('.buy[data-act]').forEach(b => b.remove());
    card.appendChild(line);
    swap(card.querySelector('.em'), src.classList.contains('legalcard') ? 'heat' : 'dog');
    /* ── 행동 단추를 같이 데려온다 ──
       수사 카드에는 「무마」가 붙어 있다(data-act="lobby"). 직원 화면을 도감으로 다시
       지으면서 원본 카드를 통째로 감췄더니, **그 단추에 닿을 길이 사라졌다** —
       눌러도 아무 일이 없다는 신고가 그것이었다.

       숫자를 보여 주는 자리와 손대는 자리가 갈리면 안 되므로 사건 카드에 얹는다.
       누르면 게임의 그 단추를 대신 누른다 — 경영 패널을 잠깐 그려서 찾는다
       (지금 화면은 사무실이라 그 그림은 눈에 안 보인다). */
    const act = crow.querySelector('.buy[data-act]');
    if (act) {
      const b = act.cloneNode(true);
      b.classList.add('cardact');
      b.disabled = act.disabled;
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        withTab('staff', () => {
          const real = doc.querySelector(`#rightBody .buy[data-act="${act.dataset.act}"]`);
          if (real && !real.disabled) real.click();
        });
        lastKey = '';                     // 값이 바뀌었으니 다음 훑기에서 다시 그린다
      });
      card.querySelector('.crow').appendChild(b);
    }
    /* 진행 막대 — "0/3건" 같은 조각에서 뽑는다. 진짜 판에서는 rivalPar() 이 준다. */
    const m = key.match(/(\d+)\s*\/\s*(\d+)/);
    const bar = doc.createElement('div');
    bar.className = 'bar';
    const pct = m ? Math.min(100, +m[1] / Math.max(1, +m[2]) * 100) : 0;
    bar.innerHTML = `<i style="width:${pct.toFixed(0)}%${src.classList.contains('legalcard') ? ';background:#D98A8A' : ''}"></i>`;
    card.querySelector('.info').appendChild(bar);
    card.classList.add('show');
  }

  /* 분기 카드. 게임이 이미 계산해 둔 세 값을 읽어 옮긴다 — 목표·성과·비율을 여기서
     다시 세면 상단과 다른 수를 말하게 된다(qTarget 은 분기마다 커진다). */
  function fillQuarter() {
    const lab = ($('#qLabel') || {}).textContent || '';
    const num = ($('#qNum') || {}).textContent || '';
    const fill = $('#qFill');
    if (!num) return;
    const key = 'q:' + lab + num;
    if (key === lastKey) return;
    lastKey = key;

    /* 「0 / 6 성과」 에서 남은 수를 뽑는다. 못 뽑으면 그 줄을 그대로 보여 준다 —
       숫자를 지어내지 않는다(언어가 셋이라 문장 모양이 다르다). */
    const m = num.match(/(\d+)\s*\/\s*(\d+)/);
    const left = m ? Math.max(0, +m[2] - +m[1]) : null;
    const pct = fill && fill.style.width ? fill.style.width : (m ? (+m[1] / Math.max(1, +m[2]) * 100) + '%' : '0%');

    card.innerHTML = `<div class="crow">
        <span class="em" data-q="1"></span>
        <div class="info">
          <b>${left === null ? num : '분기까지 성과 ' + left}</b>
          <span>${lab}${lab && num ? ' · ' : ''}${num}</span>
          <div class="bar"><i style="width:${pct}"></i></div>
        </div>
      </div>`;
    swap(card.querySelector('[data-q]'), 'flag');
    card.classList.add('show');
  }

  /* ---------- 4. 직원 탭을 도감으로 ----------
     목록이던 것을 **선택된 직원 하나 + 인사 게시판**으로 바꾼다. 세로 한 줄짜리
     목록에서는 직원이 늘수록 아무도 안 보인다(카드 하나가 화면을 가로로 다 먹는다).

     ── 원본을 안 옮긴다 ──
     카드를 통째로 감추고(.dexsrc) 그 옆에 새 화면을 짓는다. 우리 버튼은 원본 버튼을
     `.click()` 으로 대신 누른다 — 원본 노드를 움직이면 게임의 이벤트 위임이 끊길 수
     있고, 시안은 원본을 최대한 안 건드리는 쪽이 맞다.

     renderRight 가 1.2초마다 #rightBody 를 통째로 다시 쓰므로 관찰자로 그때마다 다시
     짓는다. 우리가 쓴 것에 다시 반응하지 않게 `.dex` 가 이미 있으면 돌아선다. */
  let pick = null;                      /* 지금 크게 보고 있는 직원 (id) */

  function renderStaff() {
    const body = $('#rightBody');
    if (!body || app.dataset.col !== 'staff') return;
    if (body.querySelector('.dex')) return;             // 이미 지었다
    const cards = [...body.querySelectorAll('.catcard')];
    if (!cards.length) return;                          // 아직 안 그려졌다

    const read = c => ({
      id: c.dataset.cat,
      pic: c.querySelector('.pix'),
      name: (c.querySelector('.nm b') || {}).textContent || '',
      rank: (c.querySelector('.nm .rk') || {}).textContent || '',
      tr: (c.querySelector('.nm .tr') || {}).textContent || '',
      rate: (c.querySelector('.rate') || {}).textContent || '',
      needs: c.querySelector('.needs'),
      stats: (c.querySelector('.cfoot .tiny') || {}).textContent || '',
      act: c.querySelector('.cfoot .buy'),
      max: c.querySelector('.cfoot .maxrank'),
    });
    const list = cards.map(read);
    if (!list.some(c => c.id === pick)) pick = list[0].id;
    const cur = list.find(c => c.id === pick);

    /* 자리 수는 상단 칩이 이미 들고 있다(1/2). 세는 곳을 둘로 만들지 않는다. */
    const seats = ($('#sCats') || {}).textContent || '';
    const total = +(seats.split('/')[1] || list.length);
    const empty = Math.max(0, total - list.length);
    const hire = body.querySelector('.hirecard [data-act="hire"]');
    /* 레퍼런스의 자리 확장 칸에는 값(🐟300)이 붙어 있는데, 이 게임에는 **자리를 사는
       길이 없다** — 분기 성과를 채워 등급이 오르면 늘어난다. 없는 값을 그리는 대신
       진짜 조건을 같은 자리에 넣는다. 상단에서 감춰 둔 분기 숫자가 여기서 되살아난다. */
    const qn = (($('#qNum') || {}).textContent || '').trim() || '분기 결산';

    const sized = (el, px) => {
      if (!el) return '<span class="pix"></span>';
      const c = el.cloneNode(true);
      c.style.width = c.style.height = px + 'px';
      return c.outerHTML;
    };

    /* 옆에는 능력치 셋만. 욕구·수입·버튼은 아래 카드가 이미 들고 있다. */
    const chips = cur.stats.split(' · ').map(t => {
      const i = t.lastIndexOf(' ');
      return `<span class="dexchip"><b>${t.slice(0, i)}</b>${t.slice(i + 1)}</span>`;
    }).join('');

    /* ── 사원증 사진 ──
       큰 초상은 목록의 3/4 컷을 그대로 키우지 않는다 — 그건 증명사진이 아니라
       서 있는 전신이다. **정면·뜬 눈**으로 한 장 더 굽고(R3.portrait 의 front —
       목록 캐시와 키가 달라 서로 안 섞인다) 얼굴만 나오게 배경 확대로 자른다.
       조형이 아직 안 섰거나 손그림이면 목록의 그 그림으로 내려간다(크롭은 같다 —
       손그림도 머리가 위쪽 가운데라 같은 창이 얼굴을 잡는다). */
    const catRef = (typeof S !== 'undefined' && S.cats || []).find(x => x.id === pick);
    let facePix = null;
    try {
      if (catRef && typeof is3d === 'function' && is3d() && window.R3 && R3.portrait) {
        /* 표정을 고정해 둔 냥은 **사원증에서도 그 얼굴**이어야 한다 — 여기만 뜬 눈으로
           못 박으면 사무실의 그 고양이와 사진이 다른 고양이가 된다. 안 고른 냥에게만
           뜬 눈을 준다(증명사진에서 눈을 감고 있으면 그건 사진이 아니라 사고다). */
        const fx = (typeof faceOf === 'function') ? faceOf(catRef) : null;
        const idOpt = (fx && fx.e >= 0) ? { front: true } : { front: true, eyeMode: 0 };
        const u = R3.portrait(catRef, 220, idOpt);
        if (u && typeof u === 'string') facePix = `<span class="idface" style="background-image:url(${u})"></span>`;
      }
    } catch (e) {}
    if (!facePix && cur.pic) {
      const c = cur.pic.cloneNode(true);
      c.classList.add('idface');
      /* 원본의 인라인 크기·배경 확대를 지워야 사진 칸의 크롭이 이긴다 (.idface 와 같은 값) */
      c.style.width = c.style.height = '';
      c.style.backgroundSize = '150% 150%';
      c.style.backgroundPosition = '50% 10%';
      facePix = c.outerHTML;
    }
    const empNo = String(list.findIndex(c => c.id === pick) + 1).padStart(3, '0');

    const dex = doc.createElement('div');
    dex.className = 'dex';
    dex.innerHTML = `
      <div class="dexhero">
        <div class="dexid">
          <i class="idslot"></i>
          <div class="idphoto">${facePix || ''}</div>
          <span class="idno">EMPLOYEE NO.${empNo}</span>
        </div>
        <div class="dexinfo">
          <div class="dextop"><span class="dextrait"><i data-ic="paw"></i>${cur.tr.split(' · ')[0] || ''}</span>
            <span class="dexrank">${cur.rank}</span></div>
          <div class="dexname">${cur.name}</div>
          <div class="dexdesc">${cur.tr.split(' · ')[1] || ''} · ${cur.rate}</div>
          <div class="dexchips">${chips}</div>
          ${/* 폰에서는 인사 파일 모달이 안 열린다 — 카드를 누르면 고르기만 한다.
                그래서 꾸미기 입구가 여기 사원증 옆에 선다. 여는 창은 넓은 화면의
                인사 파일이 여는 그 창과 같은 것이다(js/ui.js customizeCat). */''}
          <button class="dexdeco" data-deco="1"><i data-ic="paw"></i>커스터마이징</button>
        </div>
      </div>
      <div class="dexbhead">
        <span class="dexlabel"><i data-ic="paw"></i>인사</span>
        <span class="dexplaque"><i data-ic="chair"></i><b>자리</b><span>${list.length} / ${total}</span></span>
      </div>
      <div class="dexboard">
        <div class="dexlist">
        ${list.map(c => `<div class="dexcard${c.id === pick ? ' on' : ''}" data-pick="${c.id}">
            <span class="pin"></span>
            <div class="dexcpic">${sized(c.pic, 46)}</div>
            <div class="dexcname"><b>${c.name}</b><span>${c.rank}</span></div>
            <div class="dexcneeds" data-needs="${c.id}"></div>
            <div class="dexcfoot"><span class="dexcrate">${c.rate}</span><span class="dexcact" data-act="${c.id}"></span></div>
          </div>`).join('')}
        ${hire ? `<div class="dexcard hire${hire.disabled ? ' dim' : ''}" data-hire="1">
            <span class="plus">+</span><b>${hire.textContent.trim()}</b></div>` : ''}
        <div class="dexcard grow"><span class="lock"></span><b>자리 확장</b>
          <span class="growchip">${qn}</span></div>
        </div>
      </div>`;

    /* 욕구 막대와 버튼은 **원본을 복제**한다 — 색·너비를 여기서 다시 계산하면
       게임과 시안이 다른 수를 말하게 된다. 버튼은 원본을 대신 눌러 준다. */
    list.forEach(c => {
      const nslot = dex.querySelector(`[data-needs="${c.id}"]`);
      if (nslot && c.needs) nslot.appendChild(c.needs.cloneNode(true));
      const aslot = dex.querySelector(`[data-act="${c.id}"]`);
      if (!aslot) return;
      if (c.act) {
        const b = c.act.cloneNode(true);
        b.addEventListener('click', ev => { ev.stopPropagation(); c.act.click(); });
        aslot.appendChild(b);
      } else if (c.max) aslot.appendChild(c.max.cloneNode(true));
    });

    dex.addEventListener('click', e => {
      if (e.target.closest('[data-deco]')) {
        if (typeof customizeCat === 'function')
          customizeCat(pick, () => { dex.remove(); renderStaff(); });
        return;
      }
      const t = e.target.closest('[data-pick]');
      if (t) { pick = t.dataset.pick; dex.remove(); renderStaff(); return; }
      if (e.target.closest('[data-hire]') && hire) hire.click();
    });

    const lk = dex.querySelector('.dexcard.grow .lock');
    if (lk) swap(lk, 'lock');
    dex.querySelectorAll('[data-ic]').forEach(el => swap(el, el.dataset.ic));
    [...body.children].forEach(el => el.classList.add('dexsrc'));
    body.appendChild(dex);
  }
  /* #rightBody 가 다시 그려지면 **바로** 손을 본다. 700ms 폴링에 맡겨 뒀더니 사보가
     아이콘 붙은 판과 안 붙은 판 사이에서 반짝였다 — 관찰자는 그려지기 전(마이크로태스크)에
     도므로 중간 판이 화면에 안 나온다. */
  new MutationObserver(() => {
    renderStaff();
    paintLog();
    /* **아이콘도 여기서 간다.** 사보만 관찰자에 걸고 비품실은 700ms 폴링에 뒀더니
       거기서 같은 반짝임이 났다 — 이모지가 붙은 판이 한 번 보이고 다음 틱에 아이콘이
       덮는다. 다시 그려지는 곳은 하나(#rightBody)이므로 손보는 곳도 하나여야 한다. */
    iconizeEmoji($('#rightBody'));
  }).observe($('#rightBody'), { childList: true });

  /* ---------- 5. 배치 · 인테리어 시트 ----------
     레퍼런스(방 꾸미기 게임)의 구조를 폰 크기로 옮긴 것. 오른쪽 위 **망치** 하나가
     문이고, 열면 사무실 위로 시트가 올라온다 — 방이 안 가려져야 고르는 즉시 보인다.

     ── 왜 문이 하나인가 ──
     지금 이 게임에서 방을 바꾸는 길은 둘로 갈려 있다: 가구를 옮기는 **배치 모드**
     (상단 🛋️)와 벽지·바닥·러그를 고르는 **견본책**(벽에 걸린 물건). 둘 다 「방이
     어떻게 생겼나」인데 들어가는 곳이 다르면 어디서 뭘 하는지를 먼저 외워야 한다.
     갈래 넷을 왼쪽 레일에 세우고 문을 하나로 합친다.

     ── 진짜로 동작하는 것 ──
     벽지·바닥은 `DECOR.set()` — 3D 렌더러가 쓰는 바로 그 함수다. 견본 그림도
     `DECOR.swatch()` 라 「고른 것과 다른 게 온다」가 없다.
     **가구는 비품 목록 그대로다.** 하단 「비품」 탭에 있던 것을 여기로 옮겼다 —
     사는 곳과 놓는 곳이 갈려 있으면 산 다음 어디로 가야 하는지를 외워야 한다.
     사고 놓는 것 둘 다 게임의 손을 쓴다(아래 shopRead / shopBuy).
     러그는 고르기까지만 — 러그는 바닥에 **까는 자리**가 있어서 배치 모드를 거친다. */
  const DEC = () => window.DECOR;
  /* 가구 톤은 견본책(binder.js)의 넷째 칸인데 폰에서는 이 시트가 견본책의 문이라
     여기 없으면 폰에서 벌을 갈 길이 없다 — 갈래 순서도 견본책과 같게 맨 뒤다. */
  const TABS = [
    { k: 'shop',  icon: 'hammer', t: '가구' },
    { k: 'wall',  icon: 'brush',  t: '벽지' },
    { k: 'floor', icon: 'floor',  t: '바닥' },
    { k: 'rug',   icon: 'rug',    t: '러그' },
    { k: 'tone',  icon: 'chair',  t: '가구 톤' },
  ];
  /* 견본은 **낮 하나로만** 보여 준다 — 고르는 사람에게 필요한 건 「이 벽지가 어떤
     색인가」 하나다. binder.js 의 BINDER_LIGHT 와 같은 값을 쓴다. */
  const LIGHT = { bg: '#A99C8B', tint: 'rgba(240,236,226,.06)' };
  let decoTab = 'shop', decoSel = null;

  /* ── 비품 목록을 게임에서 빌려 온다 ──
     SHOP 표는 모듈 안에 있어서 못 읽는다. 대신 게임에게 **한 번 그리게 하고** 그
     결과를 읽는다: uiTab 을 shop 으로 돌리고 renderRight() 를 부르면 #rightBody 에
     비품 목록이 그려진다. 지금 화면은 사무실이라 그게 눈에 보이지 않는다 —
     그려 놓고 읽고 되돌린다. 사는 것도 같은 손을 쓴다(진짜 구매 경로 그대로).

     왜 이렇게까지 하나: 값·이름·설명·구매 가능 여부를 여기서 다시 계산하면 게임과
     시안이 서로 다른 수를 말하게 된다. 한 곳에서만 나와야 한다. */
  function withTab(tab, fn) {
    if (typeof uiTab === 'undefined' || typeof renderRight !== 'function') return null;
    const prev = uiTab;
    uiTab = tab;
    try { renderRight(); return fn(); }
    finally { uiTab = prev; try { renderRight(); } catch (e) {} }
  }
  const withShop = fn => withTab('shop', fn);
  /* **읽는 곳이 하나다.** 한동안 둘이었다 — 비품은 카드(.card), 가구 카탈로그는 격자
     칸(.fcell)이었고, 카드만 읽던 시절에는 화분·소파·서랍장이 이 목록에 아예 없어서
     사도 배치 시트에 안 떴다. 2026-09-02 에 상점이 격자 하나로 통일되면서
     읽는 곳도 하나가 됐다(ui.js shopHTML). */
  const shopRead = () => withShop(() =>
    [...doc.querySelectorAll('#rightBody .fcell')].map(c => ({
      id: c.dataset.id || null,
      em: (c.querySelector('.fem') || {}).textContent || '',
      n: (c.querySelector('b') || {}).textContent || '',
      d: (c.querySelector('.fdesc') || {}).textContent || '',
      cost: ((c.querySelector('.fcost') || {}).textContent || '').trim(),
      owned: c.classList.contains('has'),
      locked: false,
      off: !!c.disabled,
    })).filter(it => it.n)) || [];
  /* ── 목록에 **모형**을 놓는다 ──
     아이콘이 아니라 실제 그 물건이어야 한다. 게임이 칸에 세우는 그 물건을 한 장 구워
     준다(R3.furnPortrait — render3d.js). 어느 물건인지는 world.js 의 SHOP_TILE 가
     알고 있다(비품 id → 칸 종류). 굽지 못하는 것(견본책처럼 칸이 없는 물건)은
     그려 둔 아이콘으로 내려간다. */
  const furnImg = (id, size) => {
    try {
      if (typeof SHOP_TILE === 'undefined' || !window.R3 || !R3.furnPortrait) return null;
      const t = SHOP_TILE[id];
      if (t === undefined) return null;
      return R3.furnPortrait(t, size) || null;
    } catch (e) { return null; }
  };
  const furnCell = (it, size, cls) => {
    const url = furnImg(it.id, size);
    return url ? `<img class="${cls}" src="${url}" alt="">`
               : `<span class="${cls} ${cls}--em">${it.em}</span>`;
  };

  /* ── 가진 가구 ──
     상점이 하단으로 돌아갔으므로 여기서는 **사지 않는다.** 대신 가진 것을 보여 주고,
     방에 없는 것(치운 것)을 다시 놓는다.

       방에 있는 수  = 격자에서 그 칸을 센다
       창고에 있는 수 = 가진 수 − 방에 있는 수

     창고라는 저장 항목이 따로 없다. 그럴 필요도 없다 — 「가진 수」는 이미 저장돼 있고
     「방에 있는 수」는 격자가 답한다. 없는 상태를 새로 만들지 않고 두 값의 차로 읽는다. */
  function furnList() {
    if (typeof SHOP_TILE === 'undefined' || typeof W === 'undefined' || !W) return [];
    const meta = shopRead();                       // 이름·그림은 게임의 목록에서 빌린다
    /* 상점 목록은 **열린 등급만** 그린다(ui.js furnHTML). 그쪽도 「가진 것은 보인다」로
       고쳤지만, 이 목록이 상점 DOM 한 곳만 믿고 있으면 그 규칙이 두 곳에 걸린다.
       그래서 여기서도 카탈로그를 한 번 훑어 **가졌는데 빠진 것**을 채운다 —
       가진 물건이 안 보이는 것은 없어진 것과 같다. */
    if (typeof SHOP !== 'undefined' && typeof shopCount === 'function'){
      const seen = new Set(meta.map(m => m.id));
      for (const it of SHOP){
        if (!it.furn || it.furn === 'wall' || seen.has(it.id)) continue;
        if (shopCount(it.id) > 0)
          meta.push({ id: it.id, em: it.em, n: it.n, d: '', cost: '', owned: true, locked: true, off: true });
      }
    }
    /* 「방에 있는 수」는 격자만 세면 안 된다 — **가구 위에 얹힌 것**(W.tops)도 방에 있다.
       빼먹으면 책상 위의 초가 창고에 있는 것으로 뜨고, 놓기를 누르면 하나가 더 생긴다. */
    const placedOf = tile => {
      let n = 0;
      for (let i = 0; i < W.grid.length; i++) if (W.grid[i] === tile) n++;
      for (const p of (W.tops || [])) if (p.tile === tile) n++;
      return n;
    };
    return meta.filter(it => it.id && SHOP_TILE[it.id] !== undefined).map(it => {
      const tile = SHOP_TILE[it.id];
      const owned = (typeof shopCount === 'function' ? shopCount(it.id) : 0) | 0;
      const placed = placedOf(tile);
      return { ...it, tile, owned, placed, stored: Math.max(0, owned - placed) };
    }).filter(it => it.owned > 0);
  }

  /* 창고에 있는 것을 방에 놓는다. 자리는 **절차 생성이 쓰는 그 함수**가 고른다
     (world.js 의 placeFurniture) — 접근 칸·자리·문에서의 거리 규칙이 거기 다 있고,
     여기서 자리를 새로 고르면 그 규칙을 두 벌 갖게 된다. */
  function furnPlace(tile) {
    if (typeof placeFurniture !== 'function' || typeof W === 'undefined' || !W) return false;
    const before = W.grid.filter(v => v === tile).length;
    try {
      placeFurniture({ W: W.W, H: W.H, grid: W.grid, zone: W.zone, desks: W.desks,
                       facilities: W.facilities, inbox: W.inbox, door: W.door }, tile);
    } catch (e) { return false; }
    const after = W.grid.filter(v => v === tile).length;
    if (after <= before) return false;             // 놓을 자리가 없었다
    /* **스냅샷이 먼저다.** buildWorld 는 저장된 배치(S.layout)에서 세우므로, 격자만
       고치고 부르면 방금 놓은 것이 그대로 버려진다 — 처음에 그렇게 만들어서 「놓기를
       눌러도 안 놓인다」가 됐다. edit.js 의 옮기기도 이 순서다(snapshot → build). */
    try {
      if (typeof snapshotWorld === 'function') snapshotWorld();
      if (typeof buildWorld === 'function') buildWorld();
      save();
    } catch (e) {}
    return true;
  }

  const shopBuy = id => withShop(() => {
    const b = doc.querySelector(`#rightBody [data-act="buy"][data-id="${id}"]`);
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  });

  const sheet = doc.createElement('div');
  sheet.className = 'deco';
  sheet.innerHTML = `<div class="decohead">
      <div class="decorail">${TABS.map(t => `<button data-tab="${t.k}"><span></span><b>${t.t}</b></button>`).join('')}</div>
      <button class="decox" data-close="1">✕</button>
    </div>
    <div class="decobody"></div>
    <div class="decopick"></div>`;
  app.appendChild(sheet);
  TABS.forEach(t => swap(sheet.querySelector(`[data-tab="${t.k}"] span`), t.icon));

  /* ── 문은 **망치 하나** ──
     한 번 걷었다가 되살렸다(레퍼런스 상단에는 ⋯ 하나뿐이었다). 되살린 이유는 자리다:
     배치 모드는 이 게임에서 방을 만지는 유일한 조작인데, ⋯ 팝오버 안에 있으면 두 번
     눌러야 닿고 **화면에 그 문이 안 보인다** — 방을 보는 화면에서 방을 만지는 문은
     보이는 자리에 있어야 한다.

     대신 문을 **둘로 늘리지 않는다.** 게임의 배치 모드 단추(⋯ → 🛋️)를 가로채서
     망치와 같은 일을 하게 만든다 — 어느 쪽을 눌러도 결과가 같다.

     가로채기는 **document 의 캡처 단계**에 건다. 버튼 자신에게 걸면 edit.js 가 먼저
     등록한 onclick 이 먼저 돌아서(같은 요소에서는 등록 순서대로 불린다) 이미 배치
     모드가 켜진 뒤에 우리 차례가 온다. 우리가 그 버튼을 눌러야 할 때는 bypass 로 빠진다. */
  let bypass = false;
  const editOn = () => $('#viewport').classList.contains('editmode');
  const editSet = want => {
    if (editOn() === want) return;
    const b = $('#btnEdit');
    if (!b) return;
    bypass = true; b.click(); bypass = false;
  };
  /* 망치 = 배치 모드 자체다. 열면 배치 모드가 켜지고 시트가 「가구」로 열린다.
     닫으면 배치 모드도 같이 꺼진다 — 시트를 닫았는데 가구가 계속 들려 있으면
     「지금 무슨 모드인가」를 화면이 말해 주지 않는다. */
  function decoToggle(open) {
    const want = open === undefined ? !app.classList.contains('decoon') : open;
    app.classList.toggle('decoon', want);
    if (want) {
      if (typeof setCol === 'function') setCol('stage');   // 방을 안 보여주면 고를 이유가 없다
      /* 「가구」로 연다. 여기 'move' 라는 옛 갈래 이름이 남아 있었는데, 그건 어느
         갈래도 아니라서 listOf 의 기본값(러그)으로 떨어졌다 — 망치를 누르면 레일에
         아무것도 안 켜진 채 러그 목록이 뜨고 있었다. */
      decoTab = 'shop';
      decoRender();
      editSet(true);
      /* 시트가 올라오는 애니메이션(.26s) 이 끝난 뒤 높이가 맞는다 */
      peekAnchor(); setTimeout(peekAnchor, 300);
    } else editSet(false);
    decoBtn.classList.toggle('on', want);
  }
  doc.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#btnEdit');
    if (!b || bypass) return;
    e.preventDefault();
    e.stopPropagation();
    decoToggle();
  }, true);

  /* 망치는 **달력·게시판·음악과 같은 줄**에 선다(아래 doorrail 의 첫 칸).
     상단에 혼자 떠 있던 것을 내렸다 — 넷 다 「방을 만지는 문」이라 위계가 같고,
     같은 위계는 같은 자리에 있어야 어느 것이 어느 것인지 외울 필요가 없다. */
  const decoBtn = doc.createElement('button');
  decoBtn.className = 'decobtn';
  decoBtn.title = '배치 · 인테리어';
  decoBtn.innerHTML = '<span></span><b>배치</b>';
  swap(decoBtn.querySelector('span'), 'hammer');
  decoBtn.addEventListener('click', () => decoToggle());

  /* ── 방 안의 물건 셋을 **문으로도** 연다 ──
     달력 · 게시판 · CD 플레이어는 지금 사무실에서 그 가구를 찾아 눌러야 열린다.
     방이 커지고 가구가 늘면 그게 **숨은 기능**이 된다 — 어디 있는지 아는 사람만 쓴다.
     망치 밑에 세로로 세 칸을 두고 같은 화면을 연다. 가구는 그대로 둔다(둘 다 문이다) —
     「조작은 세계 안에」를 지키면서 처음 오는 사람에게도 길을 준다. */
  const DOORS = [
    { icon:'cal',   t:'달력',   fn:'showCalendar' },
    { icon:'board', t:'게시판', fn:'showBoard' },
    { icon:'disc',  t:'음악',   fn:'showJuke' },
  ];
  const rail = doc.createElement('div');
  rail.className = 'doorrail';
  rail.innerHTML = DOORS.map(d => `<button data-fn="${d.fn}"><span></span><b>${d.t}</b></button>`).join('');
  rail.insertBefore(decoBtn, rail.firstChild);
  app.appendChild(rail);
  DOORS.forEach(d => swap(rail.querySelector(`[data-fn="${d.fn}"] span`), d.icon));

  /* ── 택배는 문 줄에서 뺐다 ── (TODO 57)
     문 셋(달력·게시판·음악)은 **방을 만지는 문**이고 택배는 **도착하는 것**이라 위계가
     다르다. 같은 줄에 끼워 두니 「방 안의 물건 넷」으로 읽혔다.
     왼쪽 아래, 분기 안내 카드 바로 위에 따로 선다 — 그 자리는 「지금 온 것」의 자리다. */
  const boxBtn = doc.createElement('button');
  boxBtn.className = 'parcelbtn';
  boxBtn.title = '본사 택배';
  boxBtn.innerHTML = '<span class="em">📦</span><b>택배</b>';
  /* 카드 **위**에 선다 — 위 stagestack 의 세로 줄에서 첫 칸이다. */
  stack.insertBefore(boxBtn, stack.firstChild);
  const doorBadge = () => {
    /* 상자가 있을 때만 점. 없는데 붙으면 그건 알림이 아니라 광고다. */
    const n = (window.GACHA && GACHA.tix) ? GACHA.tix() : 0;
    boxBtn.classList.toggle('has', n > 0);
  };
  doorBadge();
  boxBtn.addEventListener('click', () => {
    if (typeof showGacha !== 'function') return;
    try { sfx.add(); } catch (e) {}
    showGacha();
    doorBadge();
  });
  if (typeof bus !== 'undefined' && bus.on) bus.on('reward', () => setTimeout(doorBadge, 60));
  setInterval(doorBadge, 4000);
  rail.addEventListener('click', e => {
    const b = e.target.closest('[data-fn]');
    if (!b) return;
    const f = window[b.dataset.fn];
    if (typeof f === 'function') { try { sfx.add(); } catch (er) {} f(); doorBadge(); }
  });

  /* ── 카메라 모드 ──
     UI 를 전부 걷고 방만 남긴다 — OS 스크린샷으로 사진을 찍는 화면이다.
     배치 모드의 「미리보기」와 같은 원리인데, 그건 배치 시트 안에서만 열린다.
     따라다니기 단추(.cambtn)와 같은 줄, 같은 크기 — 카메라 일가는 한 자리에 산다.
     이 단추만은 카메라 모드에서도 남는다(반투명) — 나가는 문까지 걷으면 못 나온다.
     시점 조작(드래그·회전·줌)은 그대로 살아 있어서 구도를 잡고 찍는다. */
  const photoBtn = doc.createElement('button');
  photoBtn.className = 'photobtn';
  photoBtn.title = '카메라 모드 — UI를 걷고 방만 남깁니다';
  swap(photoBtn, 'photo');
  app.appendChild(photoBtn);
  photoBtn.addEventListener('click', () => {
    const on = app.classList.toggle('photo');
    photoBtn.classList.toggle('on', on);
    if (on && typeof setCol === 'function') setCol('stage');   // 방을 찍는 모드다
    if (on && typeof toast === 'function')
      toast('카메라 모드 — 스크린샷을 찍으세요. 다시 누르면 돌아옵니다');
    try { sfx.add(); } catch (e) {}
  });

  const listOf = k => k === 'wall' ? DEC().WALLS : k === 'floor' ? DEC().FLOORS
    : k === 'tone' ? DEC().TONES : DEC().RUGS;

  /* ── 바르기는 **게임의 손**으로 ──
     한동안 `DECOR.set()` 을 직접 불렀다. 그러면 값은 바뀌는데 **방은 안 바뀐다** —
     진짜 경로는 game.js 의 `decorPick()` 이고, 거기서 `DECOR.clearCache()` 와
     `renderTiles()` 가 같이 돈다(그 둘이 빠지면 구운 그림이 그대로 남는다).
     그리고 안 산 것은 못 바른다(decorOwns) — 그래서 없으면 먼저 산다.
     견본책(binder.js)이 하는 것과 **정확히 같은 순서**다. */
  function decorApply(id) {
    if (typeof decorPick !== 'function') return false;
    try {
      if (typeof decorOwns === 'function' && !decorOwns(id)) {
        if (typeof decorBuy !== 'function' || !decorBuy(id)) return false;   // 멸치가 모자란다
      }
      return decorPick(id);        // 러그면 깔거나 걷는다(rugToggle)
    } catch (e) { return false; }
  }
  const owns = id => { try { return typeof decorOwns === 'function' ? !!decorOwns(id) : true; } catch (e) { return true; } };

  function paintSwatch(cv, k, id) {
    const cur = DEC().cur();
    if (k === 'rug') DEC().rugSwatch(cv, id, { tint: LIGHT.tint });
    else if (k === 'tone') DEC().toneSwatch(cv, id, { tint: LIGHT.tint });
    else DEC().swatch(cv, k === 'wall' ? id : cur.wall, k === 'floor' ? id : cur.floor,
                      { bg: LIGHT.bg, tint: LIGHT.tint, low: k === 'floor' });
  }

  function decoRender() {
    if (!DEC()) return;
    /* 시트가 지금 어느 갈래인지 — 이름이 **pane** 이어야 한다. 한동안 `data-tab` 으로
       달아 뒀는데, 그러면 시트가 레일 버튼과 같은 속성을 갖게 되고 아래 클릭 처리의
       `closest('[data-tab]')` 이 **시트까지 거슬러 올라가 잡는다.** 그 결과 타일을
       누를 때마다 「레일을 눌렀다」로 처리돼 선택이 매번 지워졌다 —
       벽지·바닥이 안 바뀐 이유가 이것이었다(고른 것이 없으니 바르기 줄도 안 떴다). */
    sheet.dataset.pane = decoTab;
    /* 견본책이 없으면 **그 칸들을 안 보여준다.** 예전에는 다섯 칸을 다 띄우고 눌렀을 때
       「견본책이 있어야 합니다」를 말했는데, 그건 네 칸이 **눌러 봐야 아는 잠긴 문**이라는
       뜻이다. 없는 것은 안 보이는 게 맞다 — 대신 가구 칸 아래에 한 줄로 알려 준다.
       (실제로 여는 순간 견본책을 살 수도 있으므로 매번 다시 판단한다.) */
    const locked = (typeof shopHas === 'function') && !shopHas('binder');
    sheet.querySelectorAll('[data-tab]').forEach(b => {
      const hide = locked && b.dataset.tab !== 'shop';
      b.hidden = hide;
      b.classList.toggle('on', b.dataset.tab === decoTab);
    });
    /* 잠긴 칸에 머물러 있었으면 가구 칸으로 데려온다 — 안 그러면 빈 시트가 뜬다 */
    if (locked && decoTab !== 'shop'){ decoTab = 'shop'; decoSel = null; sheet.dataset.pane = 'shop'; }
    const body = sheet.querySelector('.decobody');
    const bar = sheet.querySelector('.decopick');

    if (decoTab === 'shop') {
      const items = furnList();
      /* **한 줄로 옆으로 넘긴다.** 격자 셋으로 놓았더니 목록이 화면을 반쯤 먹고
         방이 안 보였다 — 배치 중에 방이 안 보이면 고를 이유가 없다.
         한 줄이면 시트가 낮아지고, 물건 수가 늘어도 높이가 그대로다. */
      if (!items.length) {
        body.innerHTML = `<div class="decomove">
          <p>아직 가진 가구가 없습니다. <b>상점</b>에서 들이면 여기에 쌓입니다 —
          치운 가구도 여기로 돌아옵니다.</p></div>`;
        bar.className = 'decopick'; bar.innerHTML = '';
        return;
      }
      body.innerHTML = `<div class="shoprow">${items.map(it => `
        <button class="shoptile${it.id === decoSel ? ' sel' : ''}${it.stored ? ' stored' : ''}" data-id="${it.id}">
          ${it.stored ? `<span class="storedot">${it.stored}</span>` : ''}
          <span class="shopbox">${furnCell(it, 128, 'shopimg')}</span>
          <b>${it.n}</b>
          <span class="shopcost">${it.stored ? '창고 ' + it.stored : '방 ' + it.placed}</span>
        </button>`).join('')}</div>`;
      /* 잠긴 칸은 그냥 **없다.** 안내 한 줄도 안 붙인다 — 배치 시트는 지금 놓을 것을
         고르는 자리고, 아직 없는 물건 설명은 상점의 일이다(견본책은 거기서 산다). */
      const it = items.find(x => x.id === decoSel);
      if (!it) { bar.className = 'decopick'; bar.innerHTML = ''; return; }
      bar.className = 'decopick show';
      bar.innerHTML = `<span class="pickbox">${furnCell(it, 96, 'pickimg')}</span>
        <div class="decoinfo"><b>${it.n}</b><span>방 ${it.placed} · 창고 ${it.stored}</span></div>
        <button class="decoapply big${it.stored ? '' : ' off'}" data-put="${it.tile}" ${it.stored ? '' : 'disabled'}>
          <em>놓기</em><small>${it.stored ? '창고 ' + it.stored : '다 놓여 있음'}</small></button>`;
      return;
    }

    /* 가구와 **같은 줄**이다. 갈래마다 목록 모양이 다르면 시트 안에서 또 배워야 한다. */
    const items = listOf(decoTab);
    const cur = DEC().cur();
    body.innerHTML = `<div class="shoprow">${items.map(it => {
      const on = decoTab === 'rug' ? false : cur[decoTab] === it.id;
      const mine = owns(it.id);
      return `<button class="shoptile decotile${on ? ' on' : ''}${it.id === decoSel ? ' sel' : ''}${mine ? ' owned' : ''}" data-id="${it.id}">
        <span class="shopbox"><canvas width="128" height="86"></canvas></span>
        <b>${it.n}</b>
        <span class="shopcost">${mine ? (it.cost ? '보유' : '기본') : '🐟' + it.cost}</span>
      </button>`;
    }).join('')}</div>`;
    body.querySelectorAll('.decotile').forEach((el, i) => paintSwatch(el.querySelector('canvas'), decoTab, items[i].id));

    /* 고른 것 한 장 — 레퍼런스의 「PLACE ITEM」 말풍선 자리 */
    const it = items.find(x => x.id === decoSel) || null;
    if (!it) { bar.className = 'decopick'; bar.innerHTML = ''; return; }
    bar.className = 'decopick show';
    const mine = owns(it.id);
    bar.innerHTML = `<span class="pickbox"><canvas width="128" height="86"></canvas></span>
      <div class="decoinfo"><b>${it.n}</b><span>${it.note || ''}</span></div>
      <button class="decoapply big" data-apply="${it.id}">
        <em>${decoTab === 'rug' ? '깔기' : decoTab === 'tone' ? '입히기' : '바르기'}</em>
        <small>${mine ? (it.cost ? '보유 중' : '기본') : '🐟' + it.cost}</small></button>`;
    paintSwatch(bar.querySelector('canvas'), decoTab, it.id);
  }

  sheet.addEventListener('click', e => {
    const tab = e.target.closest('.decorail [data-tab]');
    if (tab) { decoTab = tab.dataset.tab; decoSel = null; decoRender(); return; }
    if (e.target.closest('[data-close]')) { decoToggle(false); return; }
    const put = e.target.closest('[data-put]');
    if (put) {
      const ok = furnPlace(+put.dataset.put);
      if (typeof toast === 'function') toast(ok ? '놓았습니다' : '놓을 자리가 없습니다');
      try { ok ? sfx.add() : sfx.err(); } catch (er) {}
      decoRender(); return;
    }
    const sp = e.target.closest('[data-shop]');
    if (sp) { if (shopBuy(sp.dataset.shop)) decoRender(); return; }
    const tile = e.target.closest('[data-id]');
    /* **한 번 더 누르면 놓는다.** 고른 칸에는 주황 테두리가 걸리는데, 그걸 되돌릴 길이
       없어서 한 번 고르면 화면에 계속 남아 있었다. 같은 칸을 다시 누르면 선택이 풀리고
       아래 「고른 것 한 장」 줄도 같이 접힌다 — 고르기와 풀기가 같은 손이다. */
    if (tile) { decoSel = (decoSel === tile.dataset.id) ? null : tile.dataset.id; decoRender(); return; }
    const ap = e.target.closest('[data-apply]');
    if (ap) {
      /* 못 바르는 이유는 하나뿐이다 — 멸치가 모자라다. **말해 준다.**
         조용히 실패하면 「눌러도 아무 일이 없다」가 되고, 그건 고장으로 읽힌다. */
      const okk = decorApply(ap.dataset.apply);
      if (!okk && typeof toast === 'function')
        toast(typeof shopHas === 'function' && !shopHas('binder')
          ? '인테리어 견본책이 있어야 합니다' : '멸치가 모자랍니다');
      try { okk ? sfx.buy() : sfx.err(); } catch (e) {}
      decoRender();
    }
  });

  /* ---------- 6. 배치 HUD ----------
     레퍼런스처럼 **고른 가구 위에 손잡이가 뜬다.** 지금 게임은 배치 모드에서
     안내 문구 한 줄(#editHint)로만 말하는데, 폰에서는 R 키가 없어서
     **돌리기에 닿을 길이 아예 없었다.**

     게임 안을 안 건드리고 손잡이를 만드는 방법: edit.js 가 이미 고른 칸에
     `#editSel` 을 띄워 두므로 그 사각형을 따라다니고, 눌리면 **키를 대신 보낸다** —
     Escape(선택 해제) · r(오른쪽) · Shift+R(왼쪽). 게임의 손이 그대로 돈다.

     격자 단추는 안 만들었다: 이 게임에는 칸을 보여 주는 판이 없고(선택·유령만 있다)
     3D 에 격자를 새로 그리는 건 시안의 일이 아니다. 대신 **미리보기**를 넣었다 —
     UI 를 잠깐 걷어 방만 보는 것. 배치 중에는 그게 격자보다 자주 쓰인다. */
  /* 말풍선은 셋이다 — **체크 · 돌리기 · 취소.** 레퍼런스와 같은 순서다.
       체크   여기 두고 손을 뗀다(선택 해제 · 자리 유지)
       돌리기 90°
       취소   배치 모드를 끝낸다
     게임에는 「되돌리기」가 따로 없다(옮기는 순간 검증하고 저장한다). 그래서 취소는
     「이 물건을 원래대로」가 아니라 「배치를 그만」이다 — 있는 것을 있는 대로 적는다. */
  const key = (k, shift) => doc.dispatchEvent(new KeyboardEvent('keydown',
    { key: k, shiftKey: !!shift, bubbles: true, cancelable: true }));
  const hud = doc.createElement('div');
  hud.className = 'edithud';
  hud.innerHTML = `<button data-k="ok"><span></span></button>
    <button data-k="rot"><span></span></button>
    <button data-k="off"><span></span></button>`;
  app.appendChild(hud);
  swap(hud.querySelector('[data-k="ok"] span'), 'check');
  swap(hud.querySelector('[data-k="rot"] span'), 'rotR');
  swap(hud.querySelector('[data-k="off"] span'), 'close');
  hud.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    if (b.dataset.k === 'rot') key('r');
    else if (b.dataset.k === 'ok') key('Escape');          // 여기 두고 손을 뗀다
    else {
      /* ✕ 는 **치운다.** 「선택 해제」였는데 그건 ✓ 와 같은 일이라 단추 둘이 한 일을
         하고 있었다. 치우기는 게임 쪽에 새로 낸 문이다(edit.js 의 editRemove) —
         돌아오지 않는 조작이므로 무엇을 했는지 말해 준다. */
      if (typeof editRemove === 'function' && editRemove()) {
        /* 치운 것은 창고로 간다(js/edit.js editToStorage). **목록을 그 자리에서 다시
           그린다** — 안 그리면 「치웠는데 창고에 없다」로 보이고, 그러면 사람은 그것이
           사라진 줄 안다. 시트가 안 열려 있으면 아무 일도 안 한다. */
        try { if (app.classList.contains('decoon')) decoRender(); } catch (er) {}
        if (typeof toast === 'function') toast('창고로 보냈습니다 — 「가구」 칸에서 다시 놓을 수 있습니다');
        try { sfx.add(); } catch (er) {}
      } else key('Escape');
    }
    setTimeout(hudFollow, 60);
  });

  /* 화살표 넷 — **미는 것**이다. 한때 좌우 둘이었고 그건 돌리기였는데(폰에 Shift 가
     없어서 반시계로 돌릴 길이 없었다), 돌리기는 HUD 의 ↻ 하나로 충분하고 화살표는
     방향이 그려져 있으니 **그 방향으로 가는 것**으로 읽힌다 — 화살표를 눌렀는데 물건이
     제자리에서 도는 건 그림과 다른 일이다.
     한 칸씩 미는 조작이 필요한 이유: 놓을 자리를 손가락으로 정확히 찍기가 어렵다.
     게임 쪽에 새로 낸 문(edit.js 의 editNudge)을 **키로** 두드린다 — 조작은 한 벌이다. */
  const ARROW = { l:['ArrowLeft','chevL'], r:['ArrowRight','chevR'],
                  u:['ArrowUp','chevU'],   d:['ArrowDown','chevD'] };
  const arrs = Object.keys(ARROW).map(side => {
    const a = doc.createElement('button');
    a.className = 'editarr ' + side;
    a.innerHTML = '<span></span>';
    app.appendChild(a);
    swap(a.querySelector('span'), ARROW[side][1]);
    a.addEventListener('click', () => { key(ARROW[side][0]); setTimeout(hudFollow, 60); });
    return a;
  });

  const peek = doc.createElement('button');
  peek.className = 'peekbtn';
  peek.innerHTML = '<span></span><b>미리보기</b>';
  app.appendChild(peek);
  swap(peek.querySelector('span'), 'eye');
  peek.addEventListener('click', () => {
    app.classList.toggle('peek');
    peek.classList.toggle('on', app.classList.contains('peek'));
  });

  /* ── 고른 가구를 따라다닌다 ──
     처음엔 `#editSel`(DOM 사각형)을 따라갔는데 **3D 에서는 그게 안 뜬다** — 3D 일 때
     edit.js 는 선택을 `R3.marker('sel', …)` 로 **씬 안에** 그리고 DOM 은 감춘다.
     그래서 HUD 가 영영 안 보였다(눌러도 아무 일도 안 일어난 이유).

     지금은 **격자 좌표를 화면에 투영해서** 따라간다: 무엇을 골랐는지는 `EDIT.sel` 이,
     그 칸이 화면 어디인지는 `R3.project(x, y, 높이)` 가 안다. 둘 다 게임이 이미
     들고 있는 값이라 우리가 계산하는 것은 없다.
     도트 폴백에서는 project 가 없으므로 예전처럼 DOM 사각형으로 내려간다. */
  /* 미리보기 단추를 **시트 바로 위에** 붙인다.
     시트는 내용만큼만 높은데(style.css 의 .deco height:auto) 단추 자리는 56vh 로
     박혀 있었다. 그래서 시트에서 한참 뜬 자리 — 하필 게시판이 걸린 그 자리 — 에
     떠서, 배치 UI 의 일원이 아니라 「게시판 대신 뜬 것」으로 읽혔다.
     CSS 는 형제의 높이를 읽을 수 없으므로 여기서 재서 넘긴다. */
  function peekAnchor() {
    /* 시트가 열려 있는 표시는 **app 의 decoon** 이다(decoToggle) — 시트 자신에는 없다. */
    const h = app.classList.contains('decoon') ? sheet.getBoundingClientRect().height : 0;
    app.style.setProperty('--decoh', Math.round(h) + 'px');
  }

  /* 손잡이와 화살표는 **고른 가구에 붙는다.** 한 번 오른쪽 아래로 옮겼다가 되물렸다 —
     멀리 있으면 무엇을 잡고 있는지가 화면에서 사라진다(레퍼런스가 물건 위에 띄운 이유다). */
  function hudFollow() {
    const sel = (typeof EDIT !== 'undefined' && EDIT) ? EDIT.sel : null;
    const on = editOn() && !!sel;
    hud.classList.toggle('show', on);
    arrs.forEach(a => a.classList.toggle('show', on));
    peek.classList.toggle('show', editOn());
    peekAnchor();
    if (!on) return;

    const vp = $('#viewport');
    const vb = vp.getBoundingClientRect();
    const cx = sel.x + ((sel.span || 1) - 1) / 2;      // 두 칸짜리는 가운데를 잡는다
    let top = null, mid = null;
    try {
      if (window.R3 && R3.project) {
        top = R3.project(cx, sel.y, 1.9);              // 말풍선은 물건 위
        mid = R3.project(cx, sel.y, 0.6);              // 화살표는 물건 옆
      }
    } catch (e) {}
    if (!top || !mid) {
      const d = $('#editSel');
      if (!d || !d.offsetWidth) { hud.classList.remove('show'); arrs.forEach(a => a.classList.remove('show')); return; }
      const r = d.getBoundingClientRect();
      top = { x: r.left + r.width / 2 - vb.left, y: r.top - vb.top };
      mid = { x: top.x, y: r.top + r.height * 0.55 - vb.top };
    }
    hud.style.left = Math.round(vb.left + top.x) + 'px';
    hud.style.top = Math.round(vb.top + top.y) + 'px';
    /* 화살표는 **고른 물건에 붙는다.** 한 번 오른쪽 아래 고정 D패드로 옮겼다가 되물렸다 —
       멀리 있으면 무엇을 밀고 있는지가 안 보인다. 대신 작게 만들어서 물건을 덜 가린다.
       (한 칸 밀 때마다 같이 옮겨 가는 것은 이 배치의 성질이다. 그게 불편하게 느껴졌던
       진짜 원인은 따로 있었다 — 방향키가 카메라까지 같이 팬하고 있었다. render3d.js) */
    const ax = Math.round(vb.left + mid.x), ay = Math.round(vb.top + mid.y);
    const put = (i, dx, dy) => { arrs[i].style.left = (ax + dx) + 'px'; arrs[i].style.top = (ay + dy) + 'px'; };
    put(0, -46, 0); put(1, 46, 0); put(2, 0, -44); put(3, 0, 44);
  }

  /* 경영 패널을 **한 번** 그리게 한다. 그래야 베낄 카드가 생긴다.
     보기 전에 끝내야 하므로 게임이 뜨자마자, 사무실로 되돌리는 것까지 한 묶음이다. */
  function prime() {
    const staff = $('#colTabs button[data-col="staff"]');
    const stage = $('#colTabs button[data-col="stage"]');
    if (!staff || !stage) return;
    staff.click();
    setTimeout(() => { stage.click(); setTimeout(fillCard, 120); }, 60);
  }

  const boot = setInterval(() => {
    if (!$('#colTabs button') || !clock.textContent) return;
    clearInterval(boot);
    prime();
    twoLine();
    paintIcons();
    setInterval(() => {
      paintIcons(); paintLog(); fillCard(); renderStaff();
      /* **열려 있는 창도 매번 훑는다.** 쥬크박스는 재생을 누르면 자기 줄을 다시 그리는데,
         그때 새로 생긴 이모지는 창을 열 때 한 번 돌린 훑기를 못 만난다 —
         아이콘이 이모지로 돌아온 것처럼 보인 이유가 이것이다. */
      doc.querySelectorAll('.veil').forEach(iconizeEmoji);
    }, 700);
    setInterval(hudFollow, 120);
    /* 모달 스킨은 #app 밖이라 클래스 하나로 켠다 */
    setInterval(() => {
      doc.body.classList.toggle('cozyskin', app.classList.contains('tabbar'));
    }, 700);
    doc.body.classList.toggle('cozyskin', app.classList.contains('tabbar'));
  }, 200);
})(document);
