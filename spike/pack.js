/* ============================================================
   pack.js — 스파이크 하나를 .html 한 장으로.

   이게 스파이크 0 이다. copycat 의 배포 모델은 "빌드 없음 + 단일 html + file://"
   세 개가 동시에 성립하는 것에 기대고 있는데, three.js 는 ESM 이고
   ESM 은 file:// 에서 import 가 막힌다. 그래서 인라인해야 하는데
   three.module.min.js 는 three.core.min.js 를 import 하는 두 조각짜리다.

   단순 이어붙이기는 안 된다 — 두 파일 다 최상위 식별자가 minify 되어 있어서
   `e`, `t` 같은 이름이 충돌한다. 그래서 모듈을 모듈인 채로 두고
   specifier 만 blob: URL 로 갈아끼운다. blob 이 막히면 data: URL 로 물러선다.
   어느 쪽이 통했는지는 콘솔과 화면 좌하단에 찍힌다.

   node spike/pack.js 3-lowpoly.html      → spike/dist/3-lowpoly.single.html
   node spike/pack.js all
   ============================================================ */

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, 'dist');

/* import 문의 specifier만 잡는다. 그냥 /from"..."/ 로 훑으면 minify 된 three 안의
   문자열 결합("...import"+r.width+"...")까지 걸려든다. 그래서 문장 시작을 요구한다:
   파일 맨 앞이거나 ; 또는 줄바꿈 뒤에 오는 import/export 만 본다. */
const SPEC_RE = /(?:^|[;\n])\s*(?:import|export)\b(?:[^;'"()]*?\bfrom\s*)?['"]([^'"\n]+)['"]/g;

function pack(name){
  const file = path.join(HERE, name);
  let html = fs.readFileSync(file, 'utf8');

  const imMatch = /<script type="importmap">([\s\S]*?)<\/script>\s*/.exec(html);
  const bare = imMatch ? (JSON.parse(imMatch[1]).imports || {}) : {};
  if (imMatch) html = html.replace(imMatch[0], '');

  const mainMatch = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
  if (!mainMatch) throw new Error(`${name}: 인라인 <script type="module"> 를 못 찾았다`);
  const mainSrc = mainMatch[1];

  const key = p => path.relative(HERE, p).split(path.sep).join('/');
  const resolve = (spec, fromFile) => {
    if (bare[spec]) return path.resolve(HERE, bare[spec]);
    if (spec.startsWith('.')) return path.resolve(path.dirname(fromFile), spec);
    throw new Error(`${name}: 모르는 specifier "${spec}" — importmap 에 넣거나 상대경로로 바꿀 것`);
  };
  const scan = src => {
    const out = [];
    let m;
    SPEC_RE.lastIndex = 0;
    while ((m = SPEC_RE.exec(src))) out.push(m[1]);
    return [...new Set(out)];
  };

  const src = {}, deps = {}, order = [];
  const seen = new Set();

  /* 의존을 먼저 order 에 넣는다 — 로더가 순서대로 blob 을 만들면서
     이미 만들어진 URL 로 specifier 를 갈아끼울 수 있어야 하기 때문. */
  const walk = (absFile) => {
    const k = key(absFile);
    if (seen.has(k)) return;
    seen.add(k);
    const code = fs.readFileSync(absFile, 'utf8');
    const d = {};
    for (const spec of scan(code)){
      const dep = resolve(spec, absFile);
      d[spec] = key(dep);
      walk(dep);
    }
    src[k] = code;
    deps[k] = d;
    order.push(k);
  };

  const mainDeps = {};
  for (const spec of scan(mainSrc)){
    const dep = resolve(spec, file);
    mainDeps[spec] = key(dep);
    walk(dep);
  }

  const payload = JSON.stringify({ order, src, deps, main: mainSrc, mainDeps })
    .replace(/<\/script/gi, '<\\/script');       // </script> 가 섞여 있어도 안전하게

  const loader = `
<script id="__mods" type="application/json">${payload}</script>
<script>
/* 단일 파일 로더 — 모듈을 모듈인 채로 두고 specifier 만 갈아끼운다. */
(async () => {
  const M = JSON.parse(document.getElementById('__mods').textContent);
  const swap = (code, spec, url) =>
    code.split('"' + spec + '"').join('"' + url + '"').split("'" + spec + "'").join("'" + url + "'");
  const build = (make) => {
    const url = {};
    for (const p of M.order){
      let code = M.src[p];
      for (const spec in (M.deps[p] || {})) code = swap(code, spec, url[M.deps[p][spec]]);
      url[p] = make(code);
    }
    let main = M.main;
    for (const spec in M.mainDeps) main = swap(main, spec, url[M.mainDeps[spec]]);
    return make(main);
  };
  const blob = c => URL.createObjectURL(new Blob([c], { type:'text/javascript' }));
  const data = c => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(c);
  const note = (t, bad) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;padding:4px 8px;border-radius:5px;'
      + 'font:11px ui-monospace,monospace;background:' + (bad ? '#5a1520' : '#123a24') + ';color:#fff';
    d.textContent = t;
    document.body.appendChild(d);
    console.log('[pack] ' + t);
  };
  try {
    await import(build(blob));
    note('단일 파일 · blob: 모듈 OK · ' + location.protocol);
  } catch (e1) {
    console.warn('[pack] blob 실패', e1);
    try {
      await import(build(data));
      note('단일 파일 · data: 모듈 OK (blob 은 막힘) · ' + location.protocol, false);
    } catch (e2) {
      note('단일 파일 실패 — ' + e2.message, true);
      console.error(e1, e2);
    }
  }
})();
</script>`;

  // 치환값은 반드시 함수로 넘긴다. 문자열로 넘기면 three 코드 안의 $& · $` · $' 가
  // 치환 패턴으로 해석돼서 페이로드 한가운데에 엉뚱한 HTML 조각이 박힌다.
  const out = html.replace(mainMatch[0], () => loader);
  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, name.replace(/\.html$/, '.single.html'));
  fs.writeFileSync(dest, out);

  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`${name}`);
  console.log(`  모듈 ${order.length}개 → ${path.relative(process.cwd(), dest)}  ${kb(Buffer.byteLength(out))}`);
  order.forEach(k => console.log(`    ${k.padEnd(30)} ${kb(Buffer.byteLength(src[k]))}`));
  return dest;
}

const arg = process.argv[2] || 'all';
const names = arg === 'all'
  ? fs.readdirSync(HERE).filter(f => /^[\dsfck]\d?[-.].*\.html$/.test(f)).sort()
  : [arg];

for (const n of names) pack(n);
console.log('\nfile:// 로 dist/ 의 파일을 직접 열어볼 것. 좌하단 배지가 어느 경로로 떴는지 알려준다.');
