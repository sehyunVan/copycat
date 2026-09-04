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
const wav = require('./wav.js');
const { inlineModules } = require('./inline-modules.js');   // BGM 경량화 — pack-release.js 와 같은 것을 쓴다

const ROOT = path.join(__dirname, '..') + path.sep;
/* --with-music 은 **기본 곡 하나**만, --all-music 이라야 쥬크박스의 곡을 전부 싣는다.
   전부 실으면 30MB 가 넘고, 그건 이 파일의 존재 이유("보내기 좋은 파일 하나")를 그 자리에서 부순다.
   다운로드로 받는 사람에게는 zip 쪽(tools/pack-release.js)이 전곡을 들고 간다. */
const MUSIC_ALL = process.argv.includes('--all-music');
const WITH_MUSIC = process.argv.includes('--with-music') || MUSIC_ALL;

const MIME = { '.png':'image/png', '.wav':'audio/wav', '.jpg':'image/jpeg', '.gif':'image/gif' };
const dataURI = rel => {
  let b = fs.readFileSync(ROOT + rel);
  // base64는 크기를 4/3로 불린다. 21MB 원본을 그대로 실으면 28MB짜리 HTML이 나오는데,
  // 그건 더 이상 "보내기 좋은 파일 하나"가 아니다. 음악은 항상 줄여서 싣는다.
  /* 줄이는 건 **배경음악만**이다. 짧은 효과음까지 반으로 깎으면(11kHz) 고양이 소리가
     전화기 너머 소리가 된다 — 크기도 몇십 KB라 줄일 이유가 없다. */
  if (rel.startsWith('assets/music/')){
    const was = b.length;
    b = wav.lighten(b);
    console.log(`BGM ${(was/1048576).toFixed(1)}MB → ${(b.length/1048576).toFixed(1)}MB (모노 22.05kHz)`);
  }
  return 'data:' + (MIME[path.extname(rel)] || 'application/octet-stream') + ';base64,' + b.toString('base64');
};

/* 게임이 실행 중에 부르는 경로를 그대로 키로 쓴다 — assets.js 의 표가 그 규약이다. */
/* 도트 아틀라스(assets/atlas.png)와 16비트 고양이 시트가 여기 있었다.
   도트 렌더러를 지운 2026-08-24 에 같이 빠졌다 — 배포본이 그만큼 가벼워졌다. */
const paths = [
  /* 손그림 고양이. 크기 때문이 아니라 캔버스 오염 때문에 표를 지나야 한다 —
     file:// 에서 불러온 그림은 getImageData 가 막히고, 손그림은 거기서 밝기를 올린다. */
  ...(fs.existsSync(ROOT + 'assets/cats_drawn')
      ? fs.readdirSync(ROOT + 'assets/cats_drawn').filter(f => /^cat-\d+\.png$/.test(f))
          .map(f => 'assets/cats_drawn/' + f).sort()
      : []),
  /* 고양이 목소리. 음악과 달리 **항상** 싣는다 — 파일 한 장으로 보낸 사람에게
     고양이가 안 우는 건 기능이 하나 빠진 것이다(합성 폴백은 있지만 그건 폴백이다). */
  ...fs.readdirSync(ROOT + 'assets/cat_voice').filter(f => f.endsWith('.wav'))
       .map(f => 'assets/cat_voice/' + f).sort(),
  /* 가구 톤 카드 그림 아홉 장(spike/shot-tones.js 가 실제 게임을 찍어 낸 것).
     아홉 장 합쳐 108KB 라 항상 싣는다 — 이게 없으면 견본책의 가구 톤 칸이
     약도로 떨어지고, 그건 고르는 화면에서 색표로 돌아가는 것이다. */
  ...(fs.existsSync(ROOT + 'assets/tones')
      ? fs.readdirSync(ROOT + 'assets/tones').filter(f => f.endsWith('.jpg'))
          .map(f => 'assets/tones/' + f).sort()
      : []),
  /* 로딩 화면의 그 고양이(26KB). 택배를 뜯는 장면이 쓴다 — js/gacha.js 의 gaOpening.
     로고의 고양이와 같은 고양이이고, 머리만 잘린 로고 컷과 달리 앉은 몸이 다 들어 있다. */
  'assets/loading-cat.png',
  /* 지점 간판 마흔넷(TODO 59 · tools/split-logos.js 가 시안 시트를 자른 것).
     검은 잉크에 투명 배경이라 잘 눌려서 합쳐 138KB 다 — 항상 싣는다.
     이게 없으면 지점 등록 창이 아예 안 뜨고(ui.js showBranch 가 목록이 비면 건너뛴다),
     시작화면은 박아 둔 글자 로고로 돌아간다. 즉 조용히 기능 하나가 빠진다. */
  ...(fs.existsSync(ROOT + 'assets/logos')
      ? fs.readdirSync(ROOT + 'assets/logos').filter(f => f.endsWith('.png'))
          .map(f => 'assets/logos/' + f).sort()
      : []),
];
/* 안 실린 곡을 고르면 music.js 가 오르골로 내려가면서 **그렇다고 말해 준다** —
   그래서 기본 곡만 실어도 조용히 무음이 되지는 않는다. */
if (WITH_MUSIC) paths.push(...(MUSIC_ALL
  ? fs.readdirSync(ROOT + 'assets/music').filter(f => f.endsWith('.wav')).map(f => 'assets/music/' + f).sort()
  : ['assets/music/aquarium.wav']));

const table = {};
for (const p of paths) table[p] = dataURI(p);

/* 안 싣고 나가는 음원. 게임이 **부르기 전에** 알아야 한다 —
   쥬크박스가 없는 음반을 팔지 않게(js/music.js shipped). */
const absent = fs.readdirSync(ROOT + 'assets/music').filter(f => f.endsWith('.wav'))
  .map(f => 'assets/music/' + f).filter(q => !table[q]).sort();

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
    js += 'for (const q of ' + JSON.stringify(absent) + ') ASSETS_ABSENT.add(q);\n';
    injected = true;
  }
  return '<script>\n' + safe(js) + '\n</script>';
});
if (!injected) throw new Error('index.html 에서 js/assets.js 를 못 찾았다 — 경로 표를 넣을 자리가 없다');

/* 3D 렌더러는 ES 모듈이라 위 정규식(<script src=)에 안 걸린다. 모듈은 모듈인 채로
   접어 넣고 blob: URL 로 올린다 — 이어붙이면 minify 된 three 의 최상위 이름이 충돌한다. */
const mods = inlineModules(html, ROOT);
html = mods.html;
if (!mods.files.length) throw new Error('type="module" 스크립트를 못 찾았다 — 3D 가 빠진다');
if (/<script[^>]*type="module"[^>]*src=/.test(html)) throw new Error('아직 바깥 모듈을 부르는 태그가 남아 있다');
console.log(`모듈 ${mods.files.length}개를 HTML 안으로 접었다`);

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
/* 셋이 서로 다른 파일이어야 한다. 같은 이름으로 떨구면 --with-music 으로 구운 걸
   --all-music 이 덮어써서, 어느 쪽을 보냈는지 파일만 봐서는 알 수 없게 된다. */
const out = ROOT + 'dist/copycat' + (MUSIC_ALL ? '-music-all' : WITH_MUSIC ? '-music' : '') + '.html';
fs.writeFileSync(out, html);

console.log(`\n에셋 ${paths.length}개 인라인 · ${MUSIC_ALL ? '쥬크박스 전곡 포함' : WITH_MUSIC ? '기본곡만 포함' : 'BGM 제외 (절차 생성 오르골로 폴백)'}`);
console.log(`${out}  ${(fs.statSync(out).size / 1048576).toFixed(2)} MB`);
if (absent.length) console.log(`안 실은 음원 ${absent.length}개 — 쥬크박스가 목록에서 뺀다: ${absent.map(q => q.split('/').pop()).join(', ')}`);
if (!WITH_MUSIC) console.log('음악 파일까지 넣으려면: node tools/pack-single.js --with-music');
else if (!MUSIC_ALL) console.log('쥬크박스의 나머지 곡까지 넣으려면: --all-music (30MB 를 넘는다)');
