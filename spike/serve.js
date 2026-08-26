/* 스파이크용 정적 서버. ES 모듈은 file:// 에서 import 가 막히므로 개발할 땐 이걸로 연다.
   (배포 경로 검증은 pack.js 가 만든 단일 파일로 따로 한다 — 그쪽이 진짜 file:// 테스트다.)
   node spike/serve.js  →  http://localhost:8123/spike/1-pip.html */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 8123;

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.wav':'audio/wav', '.svg':'image/svg+xml', '.glb':'model/gltf-binary',
};

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'spike/';
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('nope'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}).end('404 ' + rel); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(buf);
  });
}).listen(PORT, () => {
  console.log(`spike server  →  http://localhost:${PORT}/spike/1-pip.html`);
  console.log(`                  http://localhost:${PORT}/spike/2-power.html`);
  console.log(`                  http://localhost:${PORT}/spike/3-lowpoly.html`);
});
