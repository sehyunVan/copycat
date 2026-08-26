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
const { collect, credits, audit } = require('./collect.js');   // 무엇을 담을지 — pack-mobile.js 와 같은 것을 쓴다

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

/* ---------- 담을 것 ----------
   목록·모듈 접기·감사는 tools/collect.js 가 갖고 있다. 폰 배포본(pack-mobile.js)과
   **같은 목록**을 봐야 하기 때문이다 — 두 벌이 되면 언젠가 한쪽만 고치게 되고,
   그 한쪽이 유료 타일셋을 흘리는 쪽일 수 있다. 이 파일에 남은 일은 zip 으로 묶는 것뿐이다. */
const entries = collect({ light: LIGHT });
entries.push({ name: 'CREDITS.txt', data: Buffer.from(credits(), 'utf8') });
audit(entries);

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
