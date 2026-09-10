/* ============================================================
   title.js — 시작화면

   앱을 열면 제일 먼저 이 화면이다. 사무실 전경 위에 로고가 놓이고, 아래에
   「탭하여 시작」. 누르기 전에는 **아무것도 시작하지 않는다** — 프롤로그도,
   출근 보고도, 음악도. 부팅 마지막에서 main.js 가 이 문을 기다린다.

   ── 왜 문이 필요한가 ──
   화면 하나를 더 만드는 데에는 이유가 셋 있다.
     1. 이 게임은 **매일 켜는 게임**이다. 열 때마다 같은 자리에서 시작하는 화면이
        있으면 「켰다」가 하나의 동작이 된다 — 앱을 연 것과 일을 시작한 것이 갈린다.
     2. 브라우저는 **사용자가 한 번 누르기 전에는 소리를 못 낸다.** 여태 그 첫 입력을
        어디서 받을지가 정해져 있지 않아서, 프롤로그의 빗소리가 늦게 들어오는 일이
        있었다. 여기서 받으면 그 뒤로는 전부 확실하다.
     3. 3D 사무실이 서는 데 시간이 걸린다. 그동안 검은 화면을 보여 주는 대신
        전경 사진을 깔아 둔다 — 기다림이 화면의 일부가 된다.

   ── 로고 ──
   그림 파일이 아니라 **SVG 로 그렸다.** 이유는 크기다: 시작화면은 폰에서도
   데스크톱에서도 뜨는데, 래스터로 넣으면 큰 쪽에서 흐려지고 작은 쪽에서 무겁다.
   그리고 이 게임은 한 파일로도 배포되므로(dist/copycat.html) 그림 하나가 통째로
   base64 로 실린다 — 벡터는 2KB 다.

   자는 고양이는 이 게임의 로고다: 회사가 돌아가는 동안 고양이는 잔다.
   ============================================================ */
(function () {
  const DOC = document;

  /* ── 배경은 **살아 있는 사무실**이다 ──
     사진(assets/tones/tone_std.jpg)을 한 판 깔았는데 걷었다. 사진은 **남의 사무실**이다 —
     내가 산 가구도, 바른 벽지도, 지금 걸어다니는 고양이도 없다. 그래서 배경을 그리지
     않고 **비운다**: 뒤에서 이미 돌고 있는 3D 사무실이 그대로 보인다.

     그러려면 셋이 필요하다.
       1. 게임 UI 를 감춘다(body.titleon) — 상단 칩·하단 단추·패널이 비치면 시작화면이
          아니라 「반투명하게 덮인 게임」이다.
       2. 카메라를 **멀리 뺀다**. 평소에는 고양이를 따라 가까이 붙어 있어서(FOLLOW)
          시작화면에는 책상 한 칸만 보인다 — 방 전체가 보여야 「내 사무실」이 된다.
       3. 3D 가 서기 전까지는 크림 바탕으로 기다린다. 검은 화면이 잠깐 보이는 것보다
          낫고, 서는 순간 배경만 사라지듯 열린다.

     탭하면 카메라를 원래대로 돌려준다(camReset(true) — 따라다니기 다시 켬).
     그러니까 이 화면은 게임의 상태를 **빌리기만** 하고 바꿔 두지 않는다. */
  let camTook = false;
  let prevZoom = null;      // 시작화면이 당겨 둔 추적 거리를 돌려주기 위해

  /* ---------- 로고 ----------
     보내 주신 워드마크(C·고양이머리·PYCAT + 밑줄)를 그대로 쓴다. 흰 바탕은 빼서
     투명으로 만들었고(원본은 스크린샷이라 불투명한 흰색이었다), **파일이 아니라
     data: URI** 로 여기 심는다.

     왜 심는가: `tools/collect.js` 는 담을 자산을 목록으로 들고 있어서(초상·음악·톤·
     아이콘) 새 그림 하나를 두면 폰 배포본에서 **조용히 빠진다**. 스크립트는 이미
     담기므로 그림을 그 안에 넣으면 담기는 곳이 한 군데로 줄어든다 — 손그림 고양이를
     assets.js 가 같은 방식으로 싣는다.

     원본은 223×69 다. 그래서 **크게 늘리지 않는다** — 늘리면 흐려진다.
     (더 크게 쓰려면 이 그림을 벡터로 다시 그려야 한다.) */
  const LOGO_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAN4AAABFCAYAAAAlxlg3AAAA3klEQVR42u3aMQ6DMBREQd//0tDSUFAY79ozEm2Ilf+sOGEMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOdj0uQHggPKge7rdr9ut/vVrWu2pDmbGutLXUb8rCE57whCc84e0bXtqgr3o/swdo1b1WhbfTvYQnPOEJT3jCE17s9/KTz3gJ5+f23wUS5lZ4whOe8IQnPOFtGd7swUoY1vYzz58bpfCEJzzhCU94wqvW8ndC+4eX8IRH+9M5whOe8IQnPOEJj5DgAeGB8AAAAAAAAAAAAAAAAAAAAAAAACDDDQ+zkpjBE/lwAAAAAElFTkSuQmCC';
  /* ── 고른 간판이 있으면 그것으로 ── (TODO 59)
     계약서 다음의 지점 등록에서 고른 그림이다(ui.js showBranchSetup). 원본은 저장에
     있는데(S.branch.logo) **이 파일은 저장을 읽을 수 없다** — title.js 는 부팅 맨 앞에서
     돌고 그 시점에는 게임 코드도, 파싱된 저장도 없다. 그래서 game.js 가 고를 때마다
     작은 키 하나(copycat.logo)에 그림 이름을 비춰 둔다.

     경로를 data: 로 바꾸는 것은 표(assets.js)가 한다 — 단일 파일 배포본에서는 표에
     들어 있고, 낱개 배포본에서는 경로 그대로다. 게임 코드는 어느 쪽인지 모른다.
     그 표가 이 파일보다 먼저 서야 하므로 index.html 에서 assets.js 를 위로 올렸다.

     그림이 없거나(안 골랐거나 이 배포본에 안 실렸거나) 이름이 목록에 없으면
     **박아 둔 글자 로고**로 내려간다. 시작화면이 빈 화면이 되는 길은 없어야 한다. */
  const pickedLogo = () => {
    let f = '';
    try { f = localStorage.getItem('copycat.logo') || ''; } catch (e) {}
    if (!f || !/^logo-\d+\.png$/.test(f)) return '';
    if (typeof LOGO_FILES !== 'undefined' && LOGO_FILES.length && LOGO_FILES.indexOf(f) < 0) return '';
    try {
      if (typeof assetURL === 'function') return assetURL('assets/logos/' + f);
    } catch (e) {}
    return 'assets/logos/' + f;
  };
  const LOGO_URL = pickedLogo() || LOGO_SRC;
  /* 고른 간판은 세로로 긴 것이 많다(마크 위 · 글자 아래). 글자 로고(223×69)에 맞춰
     둔 폭 그대로 쓰면 화면을 세로로 다 먹으므로, 고른 것일 때만 폭을 줄인다. */
  const LOGO = `<img src="${LOGO_URL}" alt="copycat" draggable="false"
    class="${LOGO_URL === LOGO_SRC ? 'word' : 'mark'}">`;

  const CSS = `
#cctitle{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:0;
  background:#E8DEC9;
  font:14px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  -webkit-tap-highlight-color:transparent;cursor:pointer;
  opacity:1;transition:opacity .45s ease}
#cctitle.out{opacity:0;pointer-events:none}
/* 방이 서면 바탕을 비운다 — 뒤의 3D 가 그대로 배경이 된다 */
#cctitle.live{background:transparent;transition:background-color .6s ease}
/* 시작화면이 떠 있는 동안 게임 UI 는 없다. 무대(.stagewrap)만 남는다 —
   important 를 쓰는 이유는 스킨이 같은 것들을 더 센 선택자로 칠하기 때문이다.
   (이 주석에 백틱을 쓰면 CSS 를 담은 템플릿 리터럴이 여기서 끊긴다 — 한 번 끊었다.) */
body.titleon #topbar,
body.titleon #colTabs,
body.titleon .panel,
body.titleon .clockchip,
body.titleon .stagefoot,
body.titleon .stagecard,
body.titleon .cambtn,
body.titleon .photobtn,
body.titleon .doorrail,
body.titleon .deco,
body.titleon .edithud,
body.titleon .editarr,
body.titleon .peekbtn,
body.titleon .parcelbtn,
body.titleon #editHint,
body.titleon .foldbtn,
/* 고양이 이름표(render3d.js 의 .tag3d)도 감춘다 — 이름이 떠 있으면 시작화면이 아니라
   게임 화면이다. 지우지 않고 감추기만 한다(매 프레임 다시 그려지는 것들이라). */
/* 말풍선도 같이 감춘다 — 이름표와 같은 이유다. 「잎사귀 씹는 중…」이 떠 있으면
   그건 시작화면이 아니라 게임 화면이고, 가운데 막을 걷고 나니 그게 그대로 보였다. */
body.titleon .bubble,
body.titleon .tag3d{opacity:0 !important;pointer-events:none !important}
/* ── 가운데 막을 **걷었다** (2026-09-02) ──
   로고가 앉는 자리에 크림 웅덩이를 한 겹 깔아 두었었다(글자를 띄우려고). 얇게 깔아도
   그건 화면 가운데의 **안개**로 보인다 — 방을 배경으로 쓰기로 해 놓고 그 방을 뿌옇게
   덮고 있었으니, 배경이 있으나 마나였던 그 문제가 옅어진 채로 남아 있던 셈이다.

   막이 하던 일(밝은 방·어두운 방 모두에서 글자가 뜨는 것)은 이제 **글자 쪽에서** 한다:
   로고는 그림자를 조금 더 깊게, 단추 둘과 한 줄 안내는 이미 제 판을 깔고 앉아 있다.
   그림자는 방을 안 가린다 — 글자에 붙어 있으니까. */
/* 정경(엔딩을 본 사람)은 로고를 밝게 뒤집는다. 어두운 밤 격자 위에서 검은 글자는
   그림자로도 못 띄운다 — 여기만 색을 뒤집고, 막은 여기서도 안 깐다. */
#cctitle.vista .logo{filter:invert(1) brightness(1.25) drop-shadow(0 4px 14px rgba(0,0,0,.7))}
#cctitle.vista .tap{color:#C9BBA6}
#cctitle.vista .ver{color:#8A7A68}
#cctitle .in{position:relative;display:flex;flex-direction:column;align-items:center;gap:26px;
  padding:24px;max-width:520px;width:100%}
/* 막을 걷었으므로 그림자가 그 몫까지 진다 — 밝은 바닥에서도 글자가 뜨게. */
#cctitle .logo{width:min(62vw,222px);
  filter:drop-shadow(0 2px 3px rgba(255,250,240,.55)) drop-shadow(0 4px 14px rgba(40,28,16,.45))}
/* 도트 워드마크(2026-09-06). 222 = 74칸 × 3px 이라 폭이 안 잘리면 도트가 정확히 3px 다.
   image-rendering 은 auto 가 아니라 pixelated — 좁은 화면에서 줄어들 때 흐려지느니
   도트가 조금 성기게 빠지는 쪽이 이 판에 맞다. */
#cctitle .logo img{display:block;width:100%;height:auto;image-rendering:pixelated}
/* 고른 간판(mark)은 세로로 긴 것이 많다(마크 위 · 글자 아래). 글자 로고(word)에 맞춰
   둔 폭을 그대로 쓰면 화면을 세로로 다 먹는다 — **높이로 재서** 줄인다.
   폭으로 재면 정사각형에 가까운 것과 옆으로 긴 것이 완전히 다른 크기로 보인다. */
/* 간판도 도트로 구워졌다(tools/bake-logo-dot.js --signs). 그래서 **높이를 강제하지 않는다** —
   구울 때 이미 이 상한(132×116) 안에 들어오게 칸 수를 잡았고, 여기서 높이를 못 박으면
   4.14 배 같은 어중간한 배율이 걸려 도트가 들쭉날쭉해진다. 상한만 둔다. */
#cctitle .logo img.mark{width:auto;max-width:min(38vw,132px);
  height:auto;max-height:min(17vh,116px);object-fit:contain;margin:0 auto;image-rendering:pixelated}
#cctitle .tap{font-size:14px;font-weight:700;letter-spacing:1px;color:#6B5B4B;
  animation:cctap 1.9s ease-in-out infinite}
@keyframes cctap{0%,100%{opacity:.45}50%{opacity:1}}
#cctitle .ver{position:absolute;right:14px;bottom:12px;font-size:10.5px;color:#8B7A68;opacity:.75}
@media (prefers-reduced-motion:reduce){#cctitle .tap{animation:none;opacity:.8}}
/* ── 문 둘 ──
   「탭하여 시작」 한 줄이던 자리다. 로그인은 **여기 말고는 둘 곳이 없다** — 켜자마자
   나오는 화면이고, 기기를 바꾼 사람이 사무실을 되찾으러 오는 자리가 정확히 여기다.
   그래도 시작이 주인공이라 크기와 무게를 갈라 둔다: 시작은 채운 알약, 로그인은 선.
   화면 아무 데나 눌러도 시작되는 것은 그대로다(단추는 그 클릭을 안 흘린다). */
/* 문 셋은 **같은 크기**다. 시작만 크게 뒀더니 나머지 둘이 딸린 것처럼 보였는데,
   셋 다 「여기서 할 수 있는 일」이라 크기가 다를 이유가 없다 — 무엇이 주인공인지는
   **색**이 말한다(짙은 갈색 하나 / 밝은 종이 둘).
   자리는 아래쪽이다: 위는 로고와 사무실이 쓰고, 손은 화면 아래에 있다. */
#cctitle .btns{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;
  margin-top:min(14vh,120px)}
#cctitle .go,
#cctitle .login,
#cctitle .cfg{border:0;border-radius:999px;padding:12px 28px;min-width:196px;
  font:inherit;font-size:13.5px;font-weight:800;letter-spacing:.5px;cursor:pointer}
#cctitle .go{background:#5A4636;color:#F4ECDC;box-shadow:0 4px 0 rgba(58,44,34,.35)}
#cctitle .go:active{transform:translateY(3px);box-shadow:none}
/* 로그인과 설정은 **선이 아니라 종이**다. 테두리만 두고 속을 비웠더니 방이 그대로
   비쳐서 단추가 아니라 글자에 동그라미를 친 것처럼 보였다 — 시작화면은 뒤에 3D
   사무실이 도는 화면이라, 비어 있는 것은 여기서 「투명」이 아니라 「어수선」이다. */
#cctitle .login,
#cctitle .cfg{background:#F4ECDC;color:#6B5B4B;box-shadow:0 3px 0 rgba(90,70,54,.22)}
#cctitle .login:active,
#cctitle .cfg:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(90,70,54,.22)}
#cctitle .login[disabled]{opacity:.6;box-shadow:none}
#cctitle .note{font-size:11.5px;color:#7A6857;background:rgba(244,236,220,.82);
  padding:5px 12px;border-radius:999px}
/* 배포본 도장. 폰에서 **어느 빌드를 보고 있는지**를 눈으로 확인하는 자리다 —
   고친 것이 안 내려온 것인지 안 고쳐진 것인지가 여기서 갈린다. 소스로 열면 안 뜬다. */
#cctitle .build{position:absolute;right:10px;bottom:8px;font-size:9.5px;
  color:rgba(122,104,87,.5);letter-spacing:.04em}
#cctitle [hidden]{display:none}
/* 설정 창은 시작화면 **위에** 떠야 한다. 창(.veil)은 z-index 100 이고 시작화면은
   9999 라, 그냥 열면 뒤에서 열려서 아무것도 안 보인다 — 열려 있는 동안만 올려 준다. */
body.titleon .veil{z-index:10000}
/* ── 로그인 창의 구글 단추 ──
   메일칸 **아래**에 두고 진하게 칠한다. 이 창에서 눈이 먼저 가야 하는 쪽이고,
   .buy 의 노란색은 게임 안에서 「사기」에 쓰는 색이라 여기서는 뜻이 어긋난다.
   로고는 **흰 바탕 위에** 올린다 — 구글 브랜드 규정이 색 로고를 어두운 면에
   직접 얹는 것을 막는다. */
.lgg{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
  padding:12px 14px;border:0;border-radius:12px;font:inherit;font-size:13.5px;
  font-weight:800;cursor:pointer;background:#3A2E28;color:#F4ECDC;
  box-shadow:0 3px 0 rgba(30,22,16,.45)}
.lgg:active{transform:translateY(3px);box-shadow:none}
.lgg[disabled]{background:#8C7C6D;color:#EBE2D4;box-shadow:none;cursor:default}
.lgg .gmark{flex:0 0 auto;display:flex;align-items:center;justify-content:center;
  width:22px;height:22px;border-radius:5px;background:#fff}
.lgg .gmark svg{display:block;width:14px;height:14px}`;

  let done = null;
  const gate = new Promise(res => { done = res; });
  /* 엔딩을 봤나. **저장이 아니라 작은 키**를 읽는다(위 waitRoom 의 주석). */
  const seenEnding = () => {
    try { return localStorage.getItem('copycat.ending') === '1'; } catch (e) { return false; }
  };
  let vista = false, sky0 = null;

  const style = DOC.createElement('style');
  style.textContent = CSS;
  DOC.head.appendChild(style);

  const el = DOC.createElement('div');
  el.id = 'cctitle';
  el.innerHTML = `<div class="in"><div class="logo">${LOGO}</div>
    <div class="btns">
      <button class="go" type="button">${L({ ko:'게임 시작', en:'Start', ja:'ゲーム開始' })}</button>
      <button class="login" type="button" hidden>${L({ ko:'로그인', en:'Sign in', ja:'ログイン' })}</button>
      <button class="cfg" type="button">${L({ ko:'설정', en:'Settings', ja:'設定' })}</button>
      <div class="note" hidden>계정에 저장되고 있습니다</div>
    </div>
    <div class="build"></div></div>`;
  /* 3D 가 설 때까지 기다린다. 서면 배경을 비우고 카메라를 멀리 뺀다. */
  DOC.body.classList.add('titleon');
  const waitRoom = setInterval(() => {
    if (!done) { clearInterval(waitRoom); return; }
    if (!(window.R3 && R3.ready && R3.camSet)) return;
    clearInterval(waitRoom);
    /* ── 카메라는 **건드리지 않는다** ──
       한동안 여기서 방 전체가 보이게 멀리 뺐다(camSet). 걷었다: 이 게임의 평소 카메라가
       이미 **고양이 하나를 골라 따라다니는** 모드고(FOLLOW), 시작화면에서 보고 싶은
       것이 정확히 그것이다 — 누가 지금 일하고 있는지. 멀리서 본 방은 도면이고,
       따라다니는 방은 사람이 있는 방이다.

       그리고 손대지 않으면 **탭한 뒤 화면이 이어진다** — 시작화면과 게임이 같은 카메라라
       끊기는 순간이 없다. 되돌릴 것도 없다(그래서 camTook 은 계속 false 다). */
    try {
      /* ── 엔딩을 본 사람의 첫 화면은 사무실이 아니다 ──
         무수한 사무실을 내려다보고 있는 그 정경이다(js/three/outro.js 의 마지막 장).
         한 번 본 사람에게 이 게임은 이미 다른 이야기이고, 그 사실을 첫 화면이 안다.

         저장을 읽어서 판단하지 않는다 — 이 파일은 부팅 맨 앞에서 돌고 그때는 게임
         코드도 파싱된 저장도 없다. story.js 가 볼 때 작은 키에 비춰 둔 것을 읽는다
         (간판 키와 같은 방식이다). 정경을 세우는 데 실패하면 그냥 평소 화면이다. */
      if (seenEnding() && R3.outroVista && R3.outroVista()){
        vista = true;
        /* **정경도 밤이다.** 컷신과 같은 규칙이다(js/story.js playOutro): 이 그림은
           「무수한 창이 켜져 있고 그 위에서 둘이 내려다본다」이고 대낮에는 성립하지 않는다.
           낮에 열었더니 베이지색 도면 한 장이 됐다. 탭할 때 돌려준다(아래 close). */
        try { sky0 = skyForced(); setSkyForce('night'); } catch (e) {}
      } else {
        R3.followOn(true);
        /* 시작화면에서는 **더 붙는다.** 평소 값(0.30)은 방이 같이 보이는 거리인데,
           여기서는 고양이가 주인공이라 얼굴이 보이는 편이 낫다. 탭하면 돌려준다 —
           게임의 시점을 시작화면이 바꿔 놓고 가지 않는다. */
        if (R3.followZoom) { prevZoom = R3.followZoom(); R3.followZoom(0.19); }
      }
    } catch (e) {}
    el.classList.add('live');
    if (vista) el.classList.add('vista');
  }, 250);

  function close() {
    if (!done) return;
    el.classList.add('out');
    setTimeout(() => { el.remove(); DOC.body.classList.remove('titleon'); }, 500);
    /* 정경을 세워 뒀으면 **여기서 걷는다** — 탭하면 자기 사무실로 돌아와야 한다.
       판을 남겨 두면 사무실 옆에 지점 스물넷이 그대로 서 있다. */
    if (vista){
      try { R3.outroStop(); R3.followOn(true); } catch (e) {}
      try { setSkyForce(sky0); } catch (e) {}          // 빌린 시각도 돌려준다
      vista = false;
    }
    /* 당겨 둔 추적 거리를 돌려준다. 시점 자체는 안 빌렸으므로(camTook) 그쪽은 그대로다. */
    if (prevZoom != null) { try { R3.followZoom(prevZoom); } catch (e) {} prevZoom = null; }
    if (camTook) { try { R3.camReset(true); } catch (e) {} }
    const f = done; done = null;
    f(true);
  }
  el.addEventListener('click', close);
  /* 키보드로도 — 데스크톱에서 탭이라는 말이 어색한 사람에게 아무 키나 열어 준다.
     비켜 주는 자리가 둘이다:
       · 아래 단추에 손이 가 있을 때 — 거기서 엔터를 친 사람은 시작하려던 게 아니다
       · **설정 창이 열려 있을 때** — 근무 시간을 고르다 누른 키에 게임이 시작되면
         그건 시작이 아니라 사고다 */
  DOC.addEventListener('keydown', function once(e) {
    if (!done || e.metaKey || e.ctrlKey || e.altKey) return;
    if (DOC.querySelector('.veil')) return;
    const f = DOC.activeElement;
    if (f && f.closest && f.closest('#cctitle .login, #cctitle .cfg')) return;
    DOC.removeEventListener('keydown', once);
    close();
  });

  /* ── 로그인 ──
     시작화면은 **게임보다 먼저** 뜨므로, 이 시점에는 계정이 붙었는지 아직 모른다
     (js/cloud.js 가 저장이 생기기를 기다렸다가 로그인한다). 그래서 단추를 미리
     보여주지 않고, 붙은 뒤에 상태를 보고 켠다 — 눌러도 아무 일이 없는 단추는
     고장 난 단추다. 동기화가 꺼진 판(file:// · 오프라인 · 설정 없음)에서는 영영 안 뜬다. */
  const btnGo = el.querySelector('.go');
  const btnIn = el.querySelector('.login');
  const btnCfg = el.querySelector('.cfg');
  const note = el.querySelector('.note');
  btnGo.addEventListener('click', e => { e.stopPropagation(); close(); });
  /* 설정은 **게임의 그 설정 창**이다 — 여기서 다시 그리지 않고 저쪽 단추를 대신 누른다.
     창을 두 벌 만들면 언젠가 둘이 다른 말을 한다(폰 스킨이 「처음부터 다시 시작」을
     그 창에 얹는 것도 그대로 따라온다). 닫으면 시작화면으로 돌아온다. */
  btnCfg.addEventListener('click', e => {
    e.stopPropagation();
    const g = DOC.querySelector('#btnSettings');
    if (g) g.click();
  });
  /* ── 돌아왔을 때 단추를 되살린다 ──
     구글로 넘어갈 때 단추를 잠그고 「넘어갑니다…」로 바꾼다. 그런데 사람이 **뒤로**
     돌아오면 브라우저가 이 페이지를 캐시(bfcache)에서 그대로 꺼내 오고, 그때 단추는
     잠긴 채 그 문구로 굳어 있다 — 다시 누를 수가 없다. 아래 cloudTick 도 disabled 를
     보고 그냥 나가므로 영영 안 풀린다.
     그래서 **화면이 다시 보일 때마다** 원래대로 돌린다. 로그인이 실제로 됐으면
     cloudTick 이 곧 이 단추를 감춘다(linked). */
  const LOGIN_LABEL = L({ ko:'로그인', en:'Sign in', ja:'ログイン' });
  const revive = () => {
    if (!btnIn || btnIn.hidden) return;
    btnIn.disabled = false;
    btnIn.textContent = LOGIN_LABEL;
  };
  window.addEventListener('pageshow', revive);
  DOC.addEventListener('visibilitychange', () => { if (!DOC.hidden) revive(); });

  /* ── 두 갈래를 **한 문 뒤에** 모은다 ──
     예전에는 이 단추가 곧장 구글로 넘어갔고 메일은 설정 안쪽 입력칸에만 있었다.
     그러면 두 수단이 같은 층에 서지 않는다 — 애플이 요구하는 「동등한 대안」(4.8)이
     동등해 보이지 않는다. 단추 개수를 늘리지 않고 층만 맞춘다.
     새 판을 짜지 않고 **이미 쓰는 창**(modal)을 그대로 쓴다 — 설정도 여기로 뜬다. */
  /* 구글 마크. 브랜드 규정이 **네 가지 색 그대로**를 요구하므로 게임 색으로 안 물들인다. */
  /* `data-dot="keep"` 은 **도트 변환에서 빼 달라**는 표시다(js/dot.js 의 dotify).
     이 게임의 그림은 전부 도트로 다시 그려지는데, **구글 마크만은 예외다** —
     브랜드 규정이 색과 모양을 바꾸는 것을 금지한다. 표시를 빼면 조용히 도트로 바뀌고,
     그건 남의 상표를 우리 마음대로 그린 것이 된다. */
  const G_MARK = `<svg viewBox="0 0 48 48" aria-hidden="true" data-dot="keep">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.8 6.6-9.5 6.6-16.2z"/>
    <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.8-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.6 2.1-8.8 2.1-6.4 0-11.7-3.7-13.6-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>`;

  const askLogin = () => {
    const m = modal(`
      <div class="mhead"><div class="q">ACCOUNT</div>
        <h3>${L({ ko:'사무실을 계정에 연동합니다', en:'Link the office to an account', ja:'事務所をアカウントにつなぎます' })}</h3>
        <p>${L({ ko:'연동하면 고양이들이 따라옵니다.',
                 en:'Link it and the cats come with you.',
                 ja:'つないでおけば猫たちもついてきます。' })}</p></div>
      <div class="mbody">
        <div class="codebox">
          <input id="lgMail" class="mail" maxlength="80" autocomplete="email" inputmode="email"
                 placeholder="${L({ ko:'메일 주소', en:'Email address', ja:'メールアドレス' })}">
          <button class="buy alt" id="lgSend">${L({ ko:'보내기', en:'Send', ja:'送信' })}</button></div>
        <div class="hint" id="lgNote" style="margin-top:9px"></div>
        <button class="lgg" id="lgGoogle" style="margin-top:14px">
          <span class="gmark">${G_MARK}</span><span class="lgl">${L({ ko:'구글로 계속하기', en:'Continue with Google', ja:'Googleで続ける' })}</span></button>
      </div>
      <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);
    const V = m.veil;
    const say = t => { const n = V.querySelector('#lgNote'); if (n) n.textContent = t; };

    V.querySelector('#lgGoogle').onclick = async () => {
      const b = V.querySelector('#lgGoogle');
      /* **글자만 갈아 끼운다.** 단추째로 `textContent` 를 쓰면 안에 있는 로고까지
         같이 지워진다 — 눌렀더니 구글 마크가 사라지는 단추가 된다. */
      const lab = b.querySelector('.lgl');
      b.disabled = true;
      lab.textContent = L({ ko:'구글로 넘어갑니다…', en:'Taking you to Google…', ja:'Googleへ移動します…' });
      const r = await CLOUD.google();
      /* 성공하면 이 페이지를 떠난다(구글 → 돌아오면 시작화면이 다시 뜬다).
         실패했을 때만 여기로 돌아온다 — 그때는 왜 안 됐는지 그 자리에 적는다. */
      if (r && r.error){ b.disabled = false;
        lab.textContent = L({ ko:'다시 시도', en:'Try again', ja:'もう一度' }); say(r.error); }
    };
    const send = async () => {
      const b = V.querySelector('#lgSend'), inp = V.querySelector('#lgMail');
      b.disabled = true;
      const r = await CLOUD.email(inp ? inp.value : '');
      b.disabled = false;
      /* 보냈다고 창을 닫지 않는다 — 주소를 잘못 적었을 때 다시 칠 자리가 없어진다. */
      say(r && r.error ? r.error : L({ ko:'보냈습니다. 메일함을 확인해 주세요.',
                                        en:'Sent — check your inbox.',
                                        ja:'送りました。メールをご確認ください。' }));
    };
    V.querySelector('#lgSend').onclick = send;
    const inp = V.querySelector('#lgMail');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    return m;
  };

  btnIn.addEventListener('click', async e => {
    e.stopPropagation();
    /* 계정층이 아직 안 붙었으면 **잠깐 기다렸다** 간다. 단추를 미리 내보내는 대신
       여기서 그 몇 백 밀리초를 받는다 — 눌렀는데 아무 일도 안 나는 것보다 낫다. */
    if (!window.CLOUD || typeof modal !== 'function'){
      btnIn.disabled = true;
      btnIn.textContent = L({ ko:'연결 중…', en:'Connecting…', ja:'接続中…' });
      for (let i = 0; i < 40 && (!window.CLOUD || typeof modal !== 'function'); i++)
        await new Promise(r => setTimeout(r, 100));
      btnIn.disabled = false;
      btnIn.textContent = LOGIN_LABEL;
      if (!window.CLOUD || typeof modal !== 'function'){
        note.hidden = false;
        note.textContent = L({ ko:'지금은 계정에 연결할 수 없습니다.',
                                en:'Cannot reach the account service right now.',
                                ja:'いまはアカウントにつなげません。' });
        return;
      }
    }
    askLogin();
  });
  /* ── 셋을 **같이** 내보낸다 ──
     예전에는 시작·설정이 먼저 뜨고 로그인만 나중에 끼어들었다: 계정층이 붙는 것을
     0.5초마다 물어보다가, 붙으면 그때 단추를 켰다. 그러면 화면이 두 번 바뀌고,
     사람이 이미 손가락을 올려 둔 자리에서 단추가 밀린다.

     기다렸다 한 번에 내보내는 길도 해 봤는데(「불러오는 중…」 한 줄), 계정층이 붙는 데
     실측 몇 초가 걸려서 **시작 단추까지 그만큼 늦어졌다.** 시작은 계정과 아무 상관이 없다.

     그래서 **기다리지 않는다.** 로그인했는지는 이미 이 기기에 적혀 있다 —
     Supabase 가 세션을 localStorage['copycat.auth'] 에 넣어 두고(js/cloud.js 의
     storageKey), 거기에 익명인지 아닌지가 들어 있다. 그걸 **바로** 읽어서 정하면
     기다릴 것이 없다. 틀릴 수 있는 추측이지만(다른 탭에서 방금 로그인했다든가)
     아래 tick 이 붙는 대로 고쳐 준다 — 처음 한 번을 맞히는 것이 요점이다. */
  const guessLinked = () => {
    try {
      const raw = localStorage.getItem('copycat.auth');
      if (!raw) return null;
      const u = (JSON.parse(raw) || {}).user;
      if (!u) return null;
      return { linked: !u.is_anonymous,
               who: u.email || (u.user_metadata || {}).email || '' };
    } catch (e) { return null; }
  };
  const showNote = who => {
    note.hidden = false;
    const saving = L({ ko:'계정에 저장되고 있습니다', en:'saving to your account', ja:'アカウントに保存しています' });
    note.textContent = who ? who + ' · ' + saving : saving;
  };
  {
    const g = guessLinked();
    /* **CLOUD 가 아직 없어도 보여준다.** 이 파일이 계정층보다 먼저 도는 판이 있어서
       `!!window.CLOUD` 로 걸었더니 첫 프레임에 로그인만 빠지고 한 박자 뒤에 끼어들었다 —
       고치려던 그 증상 그대로다. 못 가는 판은 file:// 하나뿐이고(리디렉션이 돌아올
       주소가 없다) 그건 지금 바로 알 수 있다. 계정층이 끝내 없으면 눌렀을 때 말해 준다. */
    const canLogin = location.protocol !== 'file:';
    if (g && g.linked) showNote(g.who);
    else btnIn.hidden = !canLogin;
  }

  const cloudTick = setInterval(() => {
    if (!done){ clearInterval(cloudTick); return; }
    const st = window.CLOUD && CLOUD.state ? CLOUD.state() : null;
    if (!st || !st.on || btnIn.disabled) return;
    /* 붙고 나서 **추측이 틀렸으면** 그때 고친다. 맞았으면 아무 일도 안 일어난다. */
    const linked = !st.anon;
    btnIn.hidden = linked;
    if (linked && note.hidden) showNote(st.who);
  }, 500);

  /* 배포본이면 도장을 찍는다(tools/pack-mobile.js 가 넣는 meta). 소스에서는 비어 있다. */
  {
    const m = DOC.querySelector('meta[name="copycat-build"]');
    const b = el.querySelector('.build');
    if (m && b) b.textContent = m.content;
  }

  const put = () => DOC.body.appendChild(el);
  if (DOC.body) put(); else DOC.addEventListener('DOMContentLoaded', put);

  /* main.js 가 부팅 끝에서 이것을 기다린다. 이 파일이 없으면 그쪽이 그냥 진행한다. */
  /* 워드마크를 **밖으로 내준다.** 엔딩의 마지막 화면도 이 그림으로 끝나는데(js/story.js),
     그쪽에서 `assets/logo-word-dot.png` 를 걸었더니 **폰 배포본에 그 파일이 없어서**
     깨진 그림 아이콘이 떴다(2026-09-10 · dist/android 에는 assets/logos/ 만 담긴다).
     여기 박혀 있는 것은 data URI 라 어느 배포본에서도 없을 수가 없다 —
     그림을 두 벌 두지 않고 **있는 한 벌을 빌려 준다**. */
  window.CCTitle = { wait: () => gate, close, wordmark: () => LOGO_SRC };
})();
