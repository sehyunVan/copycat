/* ============================================================
   serve-release.js — dist/copycat-web.zip 을 풀어서 그 자리를 서버로 띄운다.

   배포본을 확인할 때 소스 트리를 띄우면 아무것도 검사하지 않은 것이 된다 —
   zip 에 안 담긴 파일까지 같이 열리기 때문이다. 흰 화면은 업로드하고 나서야 보인다.
   itch.io 가 하는 일과 똑같이, **zip 루트를 사이트 루트로** 놓고 연다.

   node tools/pack-release.js --light-audio
   node tools/serve-release.js            → http://localhost:8199/index.html
   COPYCAT_BASE=http://localhost:8199 node spike/verify-game.js ""

   404 는 콘솔에 찍는다. 배포본에서 빠진 파일은 대개 그렇게 처음 드러난다.
   ============================================================ */

const fs = require('fs'), path = require('path'), zlib = require('zlib'), http = require('http');

const ROOT = path.join(__dirname, '..');
const ZIP  = process.argv[3] || path.join(ROOT, 'dist', 'copycat-web.zip');
const OUT  = path.join(ROOT, 'dist', 'unzipped');
const PORT = Number(process.argv[2]) || 8199;

if (!fs.existsSync(ZIP)) throw new Error('먼저 만들어야 한다: node tools/pack-release.js');

/* 중앙 디렉터리를 읽어서 푼다. 압축은 pack-release.js 가 deflate 로 넣는다. */
fs.rmSync(OUT, { recursive: true, force: true });
const b = fs.readFileSync(ZIP);
let i = b.length - 22;
while (i >= 0 && b.readUInt32LE(i) !== 0x06054b50) i--;
if (i < 0) throw new Error('zip 끝을 못 찾았다');
const n = b.readUInt16LE(i + 10);
let off = b.readUInt32LE(i + 16), count = 0;
for (let k = 0; k < n; k++){
  const method = b.readUInt16LE(off + 10);
  const csize  = b.readUInt32LE(off + 20);
  const nl = b.readUInt16LE(off + 28), el = b.readUInt16LE(off + 30), cl = b.readUInt16LE(off + 32);
  const lho = b.readUInt32LE(off + 42);
  const name = b.toString('utf8', off + 46, off + 46 + nl);
  const start = lho + 30 + b.readUInt16LE(lho + 26) + b.readUInt16LE(lho + 28);
  const raw = b.subarray(start, start + csize);
  const dest = path.join(OUT, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, method === 0 ? raw : zlib.inflateRawSync(raw));
  count++;
  off += 46 + nl + el + cl;
}
console.log(`푼 파일 ${count}개 → ${path.relative(ROOT, OUT)}`);

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.txt':'text/plain; charset=utf-8', '.png':'image/png', '.wav':'audio/wav',
};

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(OUT, rel);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
    console.log('404  ' + rel);
    res.writeHead(404); res.end('404 ' + rel);
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(fs.readFileSync(file));
}).listen(PORT, () => console.log(`http://localhost:${PORT}/index.html`));
