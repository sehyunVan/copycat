/* ============================================================
   pack-single.js — 게임 전체를 HTML 한 장으로 묶는다.

   zip은 "압축을 풀고, 폴더를 열고, index.html 을 찾아 더블클릭"이다. 세 단계고,
   보내 준 사람 앞에서 세 단계를 요구하면 대개 안 열어본다. 파일 하나면 더블클릭 한 번이다.

   묶는 것: index.html + style.css + js/*.js + 아틀라스 + 고양이 시트.
   기본값에서 BGM 파일은 빼는데, 21MB짜리 WAV를 base64로 실으면 7MB가 되기 때문이다.
   그 자리는 music.js 의 절차 생성 오르골이 알아서 메운다 — 원래 그러라고 있는 폴백이다.
   음악까지 넣고 싶으면 --with-music.

   실행: node tools/pack-single.js [--with-music]
   출력: dist/copycat.html
   ============================================================ */
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const wav = require('./wav.js');   // BGM 경량화 — pack-release.js 와 같은 것을 쓴다

const ROOT = path.join(__dirname, '..') + path.sep;
const WITH_MUSIC = process.argv.includes('--with-music');

execFileSync(process.execPath, [path.join(__dirname, 'build-atlas.js')], { stdio: 'inherit' });

const MIME = { '.png':'image/png', '.wav':'audio/wav', '.jpg':'image/jpeg', '.gif':'image/gif' };
const dataURI = rel => {
  let b = fs.readFileSync(ROOT + rel);
  // base64는 크기를 4/3로 불린다. 21MB 원본을 그대로 실으면 28MB짜리 HTML이 나오는데,
  // 그건 더 이상 "보내기 좋은 파일 하나"가 아니다. 음악은 항상 줄여서 싣는다.
  if (rel.endsWith('.wav')){
    const was = b.length;
    b = wav.lighten(b);
    console.log(`BGM ${(was/1048576).toFixed(1)}MB → ${(b.length/1048576).toFixed(1)}MB (모노 22.05kHz)`);
  }
  return 'data:' + (MIME[path.extname(rel)] || 'application/octet-stream') + ';base64,' + b.toString('base64');
};

/* 게임이 실행 중에 부르는 경로를 그대로 키로 쓴다 — assets.js 의 표가 그 규약이다. */
const paths = [
  'assets/atlas.png',
  ...fs.readdirSync(ROOT + 'assets/cats_16bit').filter(f => f.endsWith('.png')).map(f => 'assets/cats_16bit/' + f),
];
if (WITH_MUSIC) paths.push('assets/music/aquarium.wav');

const table = {};
for (const p of paths) table[p] = dataURI(p);

/* </script> 가 문자열 안에 들어 있으면 거기서 스크립트가 끊긴다. 지금은 없지만
   나중에 누가 넣어도 조용히 깨지지 않게 막아 둔다. */
const safe = s => s.replace(/<\/script/gi, '<\\/script');

let html = fs.readFileSync(ROOT + 'index.html', 'utf8');

html = html.replace(/<link[^>]+href="([^"?]+)[^>]*>/g, (m, href) => {
  if (!href.endsWith('.css')) return m;
  return '<style>\n' + fs.readFileSync(ROOT + href, 'utf8') + '\n</style>';
});

let injected = false;
html = html.replace(/<script src="([^"?]+)[^>]*><\/script>/g, (m, src) => {
  let js = fs.readFileSync(ROOT + src, 'utf8');
  // 경로 표는 assets.js 바로 뒤에 붙인다. 그래야 나머지 파일이 전부 채워진 표를 본다.
  if (src.endsWith('assets.js')){
    js += '\nObject.assign(ASSETS, ' + JSON.stringify(table) + ');\n';
    injected = true;
  }
  return '<script>\n' + safe(js) + '\n</script>';
});
if (!injected) throw new Error('index.html 에서 js/assets.js 를 못 찾았다 — 경로 표를 넣을 자리가 없다');
if (/<script src=|<link[^>]+\.css/.test(html)) throw new Error('아직 바깥 파일을 부르는 태그가 남아 있다');
if (/(src|href)="assets\//.test(html)) throw new Error('마크업이 아직 바깥 에셋을 가리킨다');
// 경로 문자열 자체는 남아 있어야 정상이다 — 그게 표를 찾는 키다. 확인할 건 표가 다 찼는가.
for (const p of paths)
  if (!html.includes(JSON.stringify(p) + ':"data:')) throw new Error('표에서 빠진 에셋: ' + p);
// 진짜 검증은 열어 보는 것이다. 인라인이 하나라도 빠지면 dist/ 에는 assets/ 가 없으므로
// 브라우저가 404를 내고, tools/capture-store.js 나 스모크 테스트가 그걸 잡는다.

/* 한 장짜리라는 걸 파일을 열어 본 사람이 알 수 있게 */
html = html.replace('<head>', `<head>
<!-- Copycat — 한 파일 안에 게임 전체가 들어 있습니다. 더블클릭하면 브라우저에서 바로 돌아갑니다.
     설치도 인터넷 연결도 필요 없고, 진행 상황은 이 컴퓨터의 브라우저에 저장됩니다.
     This single file is the whole game. Double-click it. No install, no server, no network. -->`);

fs.mkdirSync(ROOT + 'dist', { recursive: true });
const out = ROOT + 'dist/copycat' + (WITH_MUSIC ? '-music' : '') + '.html';
fs.writeFileSync(out, html);

console.log(`\n에셋 ${paths.length}개 인라인 · ${WITH_MUSIC ? 'BGM 포함' : 'BGM 제외 (절차 생성 오르골로 폴백)'}`);
console.log(`${out}  ${(fs.statSync(out).size / 1048576).toFixed(2)} MB`);
if (!WITH_MUSIC) console.log('음악 파일까지 넣으려면: node tools/pack-single.js --with-music');
