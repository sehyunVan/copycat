/* ============================================================
   collect.js — 배포본에 **무엇을 담을지** 한 군데서 정한다.

   pack-release.js(itch.io zip)와 pack-mobile.js(폰 PWA)가 같은 목록을 봐야 한다.
   화이트리스트를 두 벌 두면 언젠가 한쪽만 고치게 되고, 그 한쪽이 유료 타일셋 원본을
   흘리는 쪽일 수 있다 — 그건 버그가 아니라 라이선스 위반이다.
   (tools/png.js 를 한 벌만 둔 것과 같은 규칙이다)

   collect({ light })  담을 파일 목록을 만든다. light=true 면 BGM을 모노 22.05kHz로 줄인다.
                       3D 모듈은 index.html 안으로 접히고, 손그림은 assets.js 표에 실린다.
   credits(tail)       CREDITS.txt 본문. 라이선스 표기가 조건인 에셋이 있어서 배포본마다 들어간다.
   audit(entries)      나가면 안 되는 것과, 부르는데 없는 것을 잡는다. 쓰기 **직전**에 부른다.
   ============================================================ */
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const wav = require('./wav.js');
const { inlineModules } = require('./inline-modules.js');

const ROOT = path.join(__dirname, '..') + path.sep;

function collect({ light = false } = {}){
  const LIGHT = light;
  const entries = [];
/* ---------- 담을 것 ---------- */
const JS = fs.readdirSync(ROOT + 'js').filter(f => f.endsWith('.js')).sort();

/* 3D 렌더러가 쓰는 것들. three.js 는 MIT 라 재배포에 문제가 없다.
   이 파일들은 zip 에 낱개로 들어가지 않는다 — 아래에서 index.html 안으로 접어 넣는다.
   itch.io(HTTPS)에서는 모듈이 그냥 돌지만, zip 을 풀어 더블클릭하는 사람에게는
   file:// 이고 거기서는 ES 모듈 import 가 막힌다. 배포본은 양쪽에서 같아야 한다. */
const walk = (rel) => fs.readdirSync(ROOT + rel, { withFileTypes:true })
  .flatMap(d => d.isDirectory() ? walk(rel + '/' + d.name) : [rel + '/' + d.name]);
const THREE_FILES = fs.existsSync(ROOT + 'js/three') ? walk('js/three').sort() : [];

/* 고양이는 손그림이다. 원본 시트(cat.png)는 안 넣는다 —
   게임이 읽는 건 잘라 놓은 낱장과 목록뿐이다.
   낱장 PNG 도 낱개로는 안 들어간다. assets.js 의 표에 data: URI 로 실린다 —
   크기 때문이 아니라 캔버스 오염 때문이다. file:// 에서 불러온 그림을 캔버스에 그리면
   getImageData 가 막히고, 손그림은 그 단계에서 밝기를 올린다(js/three/doodle.js). */
const DRAWN = fs.existsSync(ROOT + 'assets/cats_drawn')
  ? fs.readdirSync(ROOT + 'assets/cats_drawn')
      .filter(f => /^cat-\d+\.png$/.test(f) || f === 'index.json' || f === 'list.js')
      .map(f => 'assets/cats_drawn/' + f).sort()
  : [];

const DRAWN_PNG = DRAWN.filter(f => f.endsWith('.png'));

const FILES = [
  'index.html', 'style.css',
  ...JS.map(f => 'js/' + f),
  /* 쥬크박스가 생기면서 곡이 여럿이다(music.js TRACKS). 한 개를 이름으로 박아 두면
     곡을 추가할 때마다 배포본에서만 조용히 빠진다 — 폴더를 그대로 싣는다. */
  ...fs.readdirSync(ROOT + 'assets/music').filter(f => f.endsWith('.wav'))
       .map(f => 'assets/music/' + f).sort(),
  ...fs.readdirSync(ROOT + 'assets/cat_voice').filter(f => f.endsWith('.wav'))
       .map(f => 'assets/cat_voice/' + f).sort(),
  /* 가구 톤 카드 그림 — 견본책의 가구 톤 칸이 이걸 읽는다(js/decor.js).
     폴더를 그대로 싣는다: 벌을 하나 더 만들 때마다 여기 이름을 적으러 오지 않게. */
  ...(fs.existsSync(ROOT + 'assets/tones')
      ? fs.readdirSync(ROOT + 'assets/tones').filter(f => f.endsWith('.jpg'))
          .map(f => 'assets/tones/' + f).sort()
      : []),
];
for (const rel of FILES){
  if (!fs.existsSync(ROOT + rel)) throw new Error('빠진 파일: ' + rel);
  let data = fs.readFileSync(ROOT + rel);
  if (LIGHT && rel.startsWith('assets/music/')){
    const was = data.length;
    data = wav.lighten(data);
    console.log(`BGM 경량화 ${(was/1048576).toFixed(1)}MB → ${(data.length/1048576).toFixed(1)}MB (모노 22.05kHz)`);
  }
  entries.push({ name: rel, data });
}

/* ---------- 3D 를 배포본 안으로 접어 넣기 ----------
   ES 모듈은 file:// 에서 import 가 막힌다. zip 을 풀어 index.html 을 더블클릭하면
   3D 가 안 올라와서 도트로 돌았다 — itch.io 에서는 멀쩡한데 받아서 여는 사람에게는
   그게 배포본의 전부다. 그래서 모듈을 HTML 안에 접어 넣고 blob: URL 로 올린다.

   손그림은 표(assets.js)에 data: URI 로 싣는다. 크기 때문이 아니라 캔버스 오염 때문이다 —
   file:// 에서 불러온 그림은 캔버스를 오염시켜 getImageData 가 막히고,
   손그림은 그 단계에서 밝기를 올린다. data: 는 오염시키지 않는다. */
{
  const idx = entries.find(e => e.name === 'index.html');
  const res = inlineModules(idx.data.toString('utf8'), ROOT);
  if (!res.files.length) throw new Error('index.html 에 type="module" 스크립트가 없다 — 3D 가 빠진다');
  idx.data = Buffer.from(res.html, 'utf8');

  /* 접어 넣은 파일은 낱개로 또 담지 않는다 — 같은 코드가 두 벌 들어간다 */
  const got = new Set(res.files);
  for (let i = entries.length - 1; i >= 0; i--)
    if (got.has(entries[i].name)) entries.splice(i, 1);

  /* 접어 넣은 것과 js/three 에 실제로 있는 것이 같아야 한다.
     import 로 안 닿는 파일이 생기면 그건 죽은 파일이거나 빠뜨린 파일이다. */
  const orphan = THREE_FILES.filter(f => !got.has(f));
  if (orphan.length) console.log('  (import 로 안 닿는 파일: ' + orphan.join(', ') + ')');

  /* 손그림 → 표. assets.js 뒤에 붙인다 — 나머지 파일이 전부 채워진 표를 보게. */
  const table = {};
  for (const rel of DRAWN_PNG)
    table[rel] = 'data:image/png;base64,' + fs.readFileSync(ROOT + rel).toString('base64');
  const av = entries.find(e => e.name === 'js/assets.js');
  av.data = Buffer.concat([av.data,
    Buffer.from('\nObject.assign(ASSETS, ' + JSON.stringify(table) + ');\n', 'utf8')]);

  console.log(`3D 를 index.html 안으로 접었다 — 모듈 ${res.files.length}개 · 손그림 ${DRAWN_PNG.length}장`);
}

  return entries;
}

/* 라이선스 표기가 조건인 에셋이 있다(고양이 시트 CC BY 4.0). 게임 안 크레딧과 별개로
   배포본 루트에도 둔다 — 파일만 받아 간 사람에게도 보여야 한다.
   tail 은 배포본마다 다르다: zip 은 "index.html 을 열어라", 폰은 "홈 화면에 얹어라". */
const CREDITS_BODY = `Copycat
https://limezu.itch.io/modernoffice  ·  https://mxmaze.itch.io/16-bit-kitties-pack

[Art]
Cats (3D mode) — hand-drawn for this game.
Cats (pixel mode) — "16-bit Kitties" by Maze.Bit.Boutique
  Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
Office tiles — "Modern Office - Revamped" by LimeZu
  Used under the pack's commercial license. The original pack is NOT included
  in this build; only the subset of tiles this game draws, re-packed into
  the 3D renderer only (no pixel atlas since 2026-08-24).
Dogs, litter box and a few props are drawn in code.
All 3D furniture is generated in code — no modelling assets.

[Code]
three.js (r185) — MIT License, (c) 2010-2026 three.js authors
  https://github.com/mrdoob/three.js

[Audio]
The jukebox tracks are renders from the sister generative-music projects
("Major Aquarium", "Minor Garden", "Rainy Window", "Boot Sector", "Squeak Hill").
The music box track is synthesised at runtime with WebAudio.
UI sound effects are synthesised at runtime with WebAudio.
Cat voices (assets/cat_voice/) are real recordings, cut into single calls,
trimmed and normalised. All CC0 — no attribution is required, but here it is:
  meow-1, meow-2, chirp-1, chirp-2 — "Cat purr + meow" by kerzoven, CC0
    https://opengameart.org/content/cat-purr-meow
  meow-3 — "Kitten mew" by antumdeluge, CC0
    https://opengameart.org/content/kitten-mew
  meow-4 — "Meow" by ignasd, CC0
    https://opengameart.org/content/meow

`;

const DEFAULT_TAIL = `[Running it]
Open index.html in a browser. There is no installer, no server and no network.
The 3D office works offline too — everything it needs is inside index.html.
Your progress is saved in the browser's local storage on this machine.

[Play]
9-18 work, 12-13 lunch. It runs on your own clock, so it does not
fast-forward. Leave it open beside your work.
`;

function credits(tail){
  return CREDITS_BODY + (tail || DEFAULT_TAIL);
}

function audit(entries){
/* ---------- 나가면 안 되는 것 ---------- */
const BANNED = [/modern_office/i, /Modern_Office_(Shadowless|Black|48x48|32x32|16x16)/i, /Room_Builder/i,
                /\.dev\.vars/, /^site\//, /^tools\//, /^\.git/];
for (const e of entries)
  for (const re of BANNED)
    if (re.test(e.name)) throw new Error('배포본에 들어가면 안 되는 파일: ' + e.name);

/* index.html 이 부르는 스크립트가 전부 들어갔는지 — 하나 빠지면 흰 화면이고,
   그건 업로드하고 나서야 알게 된다.
   원본이 아니라 **배포본에 들어갈 것**을 본다. 접어 넣은 모듈은 이미 파일이 아니다. */
const html = entries.find(e => e.name === 'index.html').data.toString('utf8');
const names = new Set(entries.map(e => e.name));
/* './x' 와 'x' 는 같은 파일이다. 폰 배포본은 상대 표기를 쓴다(하위 경로에 올려도 돌게) —
   정규화하지 않으면 감사가 멀쩡한 파일을 없다고 한다. */
const has = u => names.has(u.replace(/^\.\//, ''));
for (const m of html.matchAll(/<script[^>]*\ssrc="([^"?]+)/g))
  if (!has(m[1])) throw new Error('index.html 이 부르는데 배포본에 없다: ' + m[1]);
/* data: 나 https: 로 박아 넣은 것은 파일이 아니다 (탭 아이콘이 그렇다) — 파일만 본다 */
const isFile = u => !/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith('//');
for (const m of html.matchAll(/<link[^>]+href="([^"?]+)/g))
  if (isFile(m[1]) && !has(m[1])) throw new Error('index.html 이 부르는데 배포본에 없다: ' + m[1]);

/* 모듈은 이제 HTML 안에 있다. 바깥에서 부르는 스크립트 태그가 남아 있으면
   그건 접다 만 것이고, 그 상태로 올리면 file:// 에서 조용히 도트로 돈다. */
const inlinedHtml = entries.find(e => e.name === 'index.html').data.toString('utf8');
if (/<script[^>]*type="module"[^>]*src=/.test(inlinedHtml))
  throw new Error('아직 바깥 모듈을 부르는 태그가 남아 있다');
if (!inlinedHtml.includes('id="__mods"'))
  throw new Error('모듈 페이로드가 안 들어갔다');

/* 유료 타일셋 검사가 여기 있었다. 도트 렌더러를 지운 2026-08-24 부터 이 게임은
   남의 픽셀을 한 칸도 안 들고 있어서, 유출을 검사할 대상 자체가 없다. */

}

module.exports = { collect, credits, audit, ROOT };
