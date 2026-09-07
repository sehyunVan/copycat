/* ============================================================
   logo-dot-embed.js — 구운 도트 로고를 게임에 **박아 넣는다.**

     node tools/bake-logo-dot.js     먼저 (assets/logo-word-dot.png · logo-cat-dot.png)
     node tools/logo-dot-embed.js    → js/title.js 의 워드마크 · style.css 의 상단바 고양이

   ── 왜 파일 경로가 아니라 data URI 인가 ──
   둘 다 **부팅 첫 프레임에 뜨는 그림**이다. 시작화면 로고는 js/title.js 가 게임 코드보다
   먼저 도는 자리에서 그리고(그 파일 머리말), 상단바 고양이는 CSS 배경이다. 파일로 두면
   그 한 장을 받는 동안 로고 자리가 비고, 오프라인 첫 실행에서는 아예 안 뜬다.
   원래 판(tools/logo.js)이 같은 이유로 data URI 를 쓰고 있어서 방식을 맞춘다.

   ── 상단바는 왜 style.css 맨 끝에 따로 쓰나 ──
   LOGO:BEGIN ~ LOGO:END 사이는 tools/logo.js 의 자리다. 거기에 끼어들면 다음에 누가
   logo.js 를 돌리는 순간 조용히 덮인다. 도트 판은 자기 블록(DOTLOGO)에 적고, 파일
   맨 끝이라 순서로 이긴다 — logo.js 를 다시 돌려도 도트가 남는다.
   ============================================================ */
const fs = require('fs'), path = require('path');
const { decodePNG, encodePNG } = require('./png.js');

const ROOT = path.resolve(__dirname, '..') + '/';

/* 정수 배로 줄인다(N 픽셀 → 1). 부드러운 리샘플을 쓰면 도트가 뭉개져서 도트를 구운
   뜻이 없어진다 — 칸 하나에서 **한 점만 집는다**(니어리스트). */
function shrinkNearest(src, n){
  const w = Math.floor(src.w / n), h = Math.floor(src.h / n);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++){
      const si = ((y * n + (n >> 1)) * src.w + x * n + (n >> 1)) * 4, di = (y * w + x) * 4;
      out[di] = src.rgba[si]; out[di+1] = src.rgba[si+1];
      out[di+2] = src.rgba[si+2]; out[di+3] = src.rgba[si+3];
    }
  return { w, h, buf: encodePNG(w, h, out) };
}
const uri = buf => 'data:image/png;base64,' + buf.toString('base64');

/* ---- 1. 시작화면 워드마크 → js/title.js ---- */
{
  const p = ROOT + 'js/title.js';
  let s = fs.readFileSync(p, 'utf8');
  const png = fs.readFileSync(ROOT + 'assets/logo-word-dot.png');
  /* **찾았는지를 먼저 본다.** 「바뀐 게 없으면 못 찾은 것」으로 판단했더니 두 번째
     실행이(같은 그림이라 결과가 같다) 「못 찾았다」로 죽었다 — 다시 돌릴 수 있어야 도구다. */
  const re = /(const LOGO_SRC = ')[^']*(';)/;
  if (!re.test(s)) throw new Error('title.js 에서 LOGO_SRC 를 못 찾았다');
  fs.writeFileSync(p, s.replace(re, '$1' + uri(png) + '$2'));
  console.log('  js/title.js  워드마크 ' + (png.length / 1024).toFixed(1) + 'KB');
}

/* ---- 2. 상단바 고양이 → style.css 맨 끝(DOTLOGO 블록) ---- */
{
  const p = ROOT + 'style.css';
  let s = fs.readFileSync(p, 'utf8');
  const cat = decodePNG(ROOT + 'assets/logo-cat-dot.png');
  /* 상단바 상자는 36px 다. 288 을 4 로 줄이면 72px = 한 칸 2px 이고, 2배 화면에서
     한 칸이 정확히 4 물리 픽셀이 된다. 3배 화면에서는 6 이라 여전히 정수다. */
  const small = shrinkNearest(cat, 4);
  const block = `/* DOTLOGO:BEGIN 생성: node tools/logo-dot-embed.js */
/* 상단바 고양이 — 도트 판. tools/logo.js 가 낸 그림(위 LOGO 블록) 위에 얹는다:
   그쪽은 그대로 두고 여기서 갈아 끼운다(같은 자리에 두 벌을 쓰지 않는다).
   pixelated 가 없으면 브라우저가 부드럽게 늘려서 도트가 다시 사라진다. */
.brand .logo{background-image:url("${uri(small.buf)}");image-rendering:pixelated}
/* DOTLOGO:END */`;
  const i = s.indexOf('/* DOTLOGO:BEGIN'), j = s.indexOf('/* DOTLOGO:END */');
  s = (i >= 0 && j > i) ? s.slice(0, i) + block + s.slice(j + '/* DOTLOGO:END */'.length)
                        : s.replace(/\s*$/, '\n\n' + block + '\n');
  fs.writeFileSync(p, s);
  console.log('  style.css    상단바 ' + small.w + '×' + small.h + '  ' + (small.buf.length / 1024).toFixed(1) + 'KB');
}
console.log('\n확인: node spike/ui/pixel/serve-pixel.js → http://localhost:8130/index.html?mobile=1');
