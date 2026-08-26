/* ============================================================
   assets.js — 에셋 경로 한 겹.

   보통은 넘어온 경로를 그대로 돌려준다. 파일 하나로 묶은 배포본
   (tools/pack-single.js 가 만드는 copycat.html)에서만 이 표가 채워져서,
   같은 경로가 data: URI 로 바뀐다. 게임 코드는 자기가 어느 쪽으로 도는지 모른다.

   묶는 쪽에서 문자열을 찾아 바꾸게 두지 않은 이유: 고양이 시트 경로는
   'dir + 색 + .png' 로 실행 중에 조립된다. 소스를 정규식으로 주무르면 언젠가 어긋난다.
   ============================================================ */
/* 표에 없으면 절대 URL로 바꿔서 돌려준다. 상대 경로를 그대로 흘리면
   🪟 로 떠 있는 창(Document PiP, about:blank 문서)에 옮겨갔을 때 그림이
   그 문서 기준으로 풀려서 깨질 여지가 있다 — 기준을 이 페이지로 고정한다. */
const ASSETS = {};                        // 'assets/cats_drawn/cat-1.png' → 'data:image/png;base64,…'
/* 이 배포본이 **안 싣고 나간** 파일들. 묶는 쪽(tools/pack-single.js)이 채운다.
   여기 적힌 건 부르면 404 다 — 부르기 전에 알아야 하는 곳이 있다(music.js 의 쥬크박스는
   없는 음반을 팔면 안 된다). "표가 비어 있으면 다 있다"로 추측하면 틀린다:
   배포본은 손그림만 인라인하고 음악은 파일로 들고 가기도 하기 때문이다(pack-release). */
const ASSETS_ABSENT = new Set();
const assetShipped = p => !ASSETS_ABSENT.has(p);
const assetURL = p => ASSETS[p] || (() => {
  // baseURI 기준 — 브라우저가 상대 경로를 풀 때 쓰는 그 기준이다. 결과가 같아야 한다.
  try { return new URL(p, document.baseURI).href; } catch(e){ return p; }
})();

/* CSS 의 url() 로 감싼다.
   이 문자열은 대부분 인라인 style="…" 속성 안으로 들어가므로 큰따옴표를 쓰면
   속성이 그 자리에서 끊긴다 — 가구가 통째로 사라지는 방식으로 조용히 깨진다.
   그래서 작은따옴표로 감싸고, 경로에 있을 수 있는 작은따옴표만 인코딩한다.
   (공백·괄호가 든 폴더에서도 안전해야 한다: "…\copycat (1)\") */
const cssURL = u => `url('${String(u).replace(/'/g, '%27')}')`;
