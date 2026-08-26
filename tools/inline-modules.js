/* ============================================================
   inline-modules.js — ES 모듈을 HTML 안으로 접어 넣는다.

   3D 렌더러는 ES 모듈이고, 모듈은 `file://` 에서 import 가 막힌다. 그래서 zip 을 풀어
   index.html 을 더블클릭하면 모듈이 안 올라오고 게임이 도트로 돌았다. itch.io 는 HTTPS
   라 그대로 돌지만, **받아서 여는 사람**에게는 그게 전부다.

   단순히 이어붙이면 안 된다 — three.js 는 두 조각이고 둘 다 최상위 식별자가 minify 되어
   있어서 `e`, `t` 가 충돌한다. 모듈은 모듈인 채로 두고 **specifier 만 blob: URL 로**
   갈아끼운다. blob 이 막힌 환경이면 data: URL 로 물러선다.

   (스파이크 spike/pack.js 에서 검증한 방식이다. 거기서 배운 것 둘을 그대로 지킨다:
    import 정규식은 문장 첫머리에 앵커할 것, replace 값은 반드시 함수로 넘길 것 —
    three 코드 안의 $& · $` · $' 가 치환 패턴으로 해석돼서 페이로드를 망친다.)
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* 문장 첫머리의 import/export 만. minify 된 three 안에는 "import" 라는 글자가
   문자열 속에도 있어서, 아무 데서나 잡으면 없는 파일을 찾다 실패한다. */
const SPEC_RE = /(?:^|[;\r\n])\s*(?:import|export)\b(?:[^;'"()]*?\bfrom\s*)?['"]([^'"\r\n]+)['"]/g;

/* html 안의 <script type="module" src="..."> 를 전부 찾아 인라인한다.
   반환: { html, files } — files 는 접어 넣은 모듈의 루트 상대 경로 목록.
   부른 쪽은 그 파일들을 배포본에서 빼면 된다(이미 HTML 안에 있다). */
function inlineModules(html, root){
  /* **modulepreload 를 먼저 지운다.** 이 함수가 하는 일이 곧 "모듈은 이제 바깥 파일이
     아니다" 이므로, 미리 내려받으라는 지시는 그 순간 가리킬 것이 없어진다.
     남겨 두면 배포본에서 404 가 나고, collect.js 의 "가리키는데 없는 파일" 검사가
     빌드를 세운다(실제로 세웠다 — 그래서 이 줄이 여기 있다).
     세 패커(single·release·mobile)가 전부 이 함수를 지나므로 여기 한 곳이면 된다. */
  html = html.replace(/ *<link[^>]*rel="modulepreload"[^>]*>/g, '');

  const TAG = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g;
  const tags = [...html.matchAll(TAG)];
  if (!tags.length) return { html, files: [] };

  const rel = abs => path.relative(root, abs).split(path.sep).join('/');
  const src = {}, deps = {}, order = [];
  const seen = new Set();

  const walk = absFile => {
    const k = rel(absFile);
    if (seen.has(k)) return k;
    seen.add(k);
    const code = fs.readFileSync(absFile, 'utf8');
    const d = {};
    SPEC_RE.lastIndex = 0;
    let m;
    while ((m = SPEC_RE.exec(code))){
      const spec = m[1];
      if (!/^[.\/]/.test(spec)) throw new Error(`모르는 specifier "${spec}" (${k}) — 상대경로만 접어 넣을 수 있다`);
      d[spec] = walk(path.resolve(path.dirname(absFile), spec.split('?')[0]));
    }
    src[k] = code;
    deps[k] = d;
    order.push(k);            // 의존이 먼저 들어간다 — 로더가 순서대로 blob 을 만든다
    return k;
  };

  const entries = tags.map(t => walk(path.join(root, t[1].split('?')[0])));

  const payload = JSON.stringify({ order, src, deps, entries })
    .replace(/<\/script/gi, '<\\/script');       // </script> 가 섞여 있어도 끊기지 않게

  const loader = `<script id="__mods" type="application/json">${payload}</script>
<script>
/* 모듈 로더 — 모듈을 모듈인 채로 두고 specifier 만 blob: URL 로 갈아끼운다.
   file:// 에서 ES 모듈 import 가 막히기 때문에 있는 물건이다. 실패해도 게임은
   도트로 돌아간다(R3 가 없으면 ui.js 가 알아서 그쪽으로 간다). */
(async () => {
  const M = JSON.parse(document.getElementById('__mods').textContent);
  const swap = (code, spec, url) =>
    code.split('"' + spec + '"').join('"' + url + '"').split("'" + spec + "'").join("'" + url + "'");
  const build = make => {
    const url = {};
    for (const p of M.order){
      let code = M.src[p];
      for (const spec in (M.deps[p] || {})) code = swap(code, spec, url[M.deps[p][spec]]);
      url[p] = make(code);
    }
    return M.entries.map(e => url[e]);
  };
  const blob = c => URL.createObjectURL(new Blob([c], { type:'text/javascript' }));
  const data = c => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(c);
  try {
    for (const u of build(blob)) await import(u);
  } catch (e1) {
    console.warn('[copycat] blob 모듈 실패 — data: 로 다시 시도', e1);
    try {
      for (const u of build(data)) await import(u);
    } catch (e2) {
      console.error('[copycat] 3D 모듈을 못 올렸다. 도트로 돕니다.', e1, e2);
    }
  }
})();
</script>`;

  /* 첫 태그 자리에 로더를 넣고 나머지 태그는 지운다.
     치환값은 반드시 함수 — 문자열로 넘기면 three 코드의 $& 가 치환 패턴이 된다. */
  let out = html.replace(tags[0][0], () => loader);
  for (const t of tags.slice(1)) out = out.replace(t[0], () => '');
  return { html: out, files: order };
}

module.exports = { inlineModules, SPEC_RE };
