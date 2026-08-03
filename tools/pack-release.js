/* ============================================================
   pack-release.js — itch.io 에 올릴 zip 을 만든다.

   itch.io 의 HTML5 게임은 "zip 루트에 index.html" 이면 브라우저에서 바로 돈다.
   빌드가 없는 게임이라 압축이 곧 빌드다.

   이 도구가 실제로 하는 일은 압축보다 **걸러내는 것**에 가깝다. 유료 타일셋 원본이
   배포본에 섞여 들어가면 라이선스 위반이고, 그건 파일 목록을 손으로 관리하는 한
   언젠가 반드시 일어난다. 그래서 넣을 파일을 화이트리스트로 적고, 마지막에
   금지 목록을 한 번 더 훑는다.

   실행: node tools/pack-release.js [--light-audio]
     --light-audio  BGM을 모노 22.05kHz로 줄여 넣는다 (21MB → 5MB).
                    웹에서 처음 여는 사람에겐 이 차이가 크다. 원본 파일은 안 건드린다.
   출력: dist/copycat-web.zip
   ============================================================ */
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const { execFileSync } = require('child_process');
const wav = require('./wav.js');   // BGM 경량화 — pack-single.js 와 같은 것을 쓴다

const ROOT = path.join(__dirname, '..') + path.sep;
const LIGHT = process.argv.includes('--light-audio');

/* ---------- zip 쓰기 ---------- */
const CRC_TBL = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function dosStamp(d){
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
function zip(entries){
  const { time, date } = dosStamp(new Date());
  const locals = [], central = [];
  let offset = 0;
  for (const e of entries){
    const name = Buffer.from(e.name, 'utf8');
    const deflated = zlib.deflateRawSync(e.data, { level: 9 });
    // PNG·WAV처럼 이미 압축됐거나 압축이 안 먹는 건 그냥 담는다. 커지면 담는 의미가 없다.
    const store = deflated.length >= e.data.length;
    const body = store ? e.data : deflated;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0, 6);
    head.writeUInt16LE(store ? 0 : 8, 8); head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc32(e.data), 14); head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(e.data.length, 22); head.writeUInt16LE(name.length, 26);
    locals.push(head, name, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(store ? 0 : 8, 10);
    cd.writeUInt16LE(time, 12); cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc32(e.data), 16); cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(e.data.length, 24); cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(0, 38);                       // 외부 속성
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(locals), cdBuf, end]);
}

/* ---------- 담을 것 ---------- */
console.log('아틀라스부터 다시 만든다 (좌표가 바뀌었을 수 있으니 항상 새로 만든다)');
execFileSync(process.execPath, [path.join(__dirname, 'build-atlas.js')], { stdio: 'inherit' });

const JS = fs.readdirSync(ROOT + 'js').filter(f => f.endsWith('.js')).sort();
const FILES = [
  'index.html', 'style.css',
  ...JS.map(f => 'js/' + f),
  'assets/atlas.png',
  ...fs.readdirSync(ROOT + 'assets/cats_16bit').map(f => 'assets/cats_16bit/' + f),
  'assets/music/aquarium.wav',
];

const entries = [];
for (const rel of FILES){
  if (!fs.existsSync(ROOT + rel)) throw new Error('빠진 파일: ' + rel);
  let data = fs.readFileSync(ROOT + rel);
  if (LIGHT && rel.endsWith('.wav')){
    const was = data.length;
    data = wav.lighten(data);
    console.log(`BGM 경량화 ${(was/1048576).toFixed(1)}MB → ${(data.length/1048576).toFixed(1)}MB (모노 22.05kHz)`);
  }
  entries.push({ name: rel, data });
}

/* 고양이 시트는 CC BY 4.0 이라 표기가 라이선스 조건이다. 게임 안 크레딧과 별개로
   배포본 루트에도 둔다 — zip만 받아 간 사람에게도 보여야 한다. */
entries.push({ name: 'CREDITS.txt', data: Buffer.from(
`Copycat
https://limezu.itch.io/modernoffice  ·  https://mxmaze.itch.io/16-bit-kitties-pack

[Art]
Cats — "16-bit Kitties" by Maze.Bit.Boutique
  Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
Office tiles — "Modern Office - Revamped" by LimeZu
  Used under the pack's commercial license. The original pack is NOT included
  in this build; only the subset of tiles this game draws, re-packed into
  a single atlas (assets/atlas.png).
Dogs, litter box and a few props are drawn in code.

[Audio]
Background music is a render from the sister project "Major Aquarium".
Sound effects are synthesised at runtime with WebAudio.

[Running it]
Open index.html in a browser. There is no installer and no server.
Your progress is saved in the browser's local storage on this machine.

[Play]
9-18 work, 12-13 lunch. It runs on your own clock, so it does not
fast-forward. Leave it open beside your work.
`, 'utf8') });

/* ---------- 나가면 안 되는 것 ---------- */
const BANNED = [/modern_office/i, /Modern_Office_(Shadowless|Black|48x48|32x32|16x16)/i, /Room_Builder/i,
                /\.dev\.vars/, /^site\//, /^tools\//, /^\.git/];
for (const e of entries)
  for (const re of BANNED)
    if (re.test(e.name)) throw new Error('배포본에 들어가면 안 되는 파일: ' + e.name);

/* index.html 이 부르는 스크립트가 전부 들어갔는지 — 하나 빠지면 흰 화면이고,
   그건 업로드하고 나서야 알게 된다. */
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const names = new Set(entries.map(e => e.name));
for (const m of html.matchAll(/<script src="([^"?]+)/g))
  if (!names.has(m[1])) throw new Error('index.html 이 부르는데 zip 에 없다: ' + m[1]);
for (const m of html.matchAll(/<link[^>]+href="([^"?]+)/g))
  if (!names.has(m[1])) throw new Error('index.html 이 부르는데 zip 에 없다: ' + m[1]);
if (!html.includes('js/atlas.js')) throw new Error('index.html 이 js/atlas.js 를 안 부른다');

/* sprite.js 에 원본 시트 경로가 문자열로 남아 있는 건 괜찮다 — 아틀라스에 칸이 없을 때만
   타는 폴백이고, 그 아틀라스를 방금 같은 좌표표로 새로 만들었으니 빠진 칸이 있을 수 없다.
   좌표표가 유일한 원본이라는 게 이 구조의 요점이다. */

fs.mkdirSync(ROOT + 'dist', { recursive: true });
const outPath = ROOT + 'dist/copycat-web.zip';
fs.writeFileSync(outPath, zip(entries));

const total = entries.reduce((n, e) => n + e.data.length, 0);
console.log('\n담긴 파일 ' + entries.length + '개');
for (const e of entries.slice().sort((a, b) => b.data.length - a.data.length).slice(0, 6))
  console.log('   ' + (e.data.length / 1024).toFixed(0).padStart(7) + ' KB  ' + e.name);
console.log(`   원본 합계 ${(total/1048576).toFixed(1)}MB → zip ${(fs.statSync(outPath).size/1048576).toFixed(1)}MB`);
console.log('\n' + outPath);
console.log('itch.io: Kind of project = HTML, 업로드 후 "This file will be played in the browser" 체크');
if (!LIGHT) console.log('BGM이 21MB라 웹에서 처음 여는 사람에겐 무겁다. --light-audio 로 5MB까지 줄어든다.');
