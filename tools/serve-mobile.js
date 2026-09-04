/* ============================================================
   serve-mobile.js — 폰 배포본을 그 자리에서 띄운다.

     node tools/pack-mobile.js          먼저 굽는다 (dist/android · dist/iphone)
     node tools/serve-mobile.js         → dist/android 를 8188 로
     node tools/serve-mobile.js iphone  → dist/iphone
     node tools/serve-mobile.js android 9000

   ── 왜 소스 트리를 안 띄우나 ──
   serve-release.js 와 같은 이유다: 소스를 띄우면 **zip 에 안 담긴 파일까지 같이 열린다.**
   빠진 파일은 배포하고 나서야 흰 화면으로 드러난다. 그래서 구운 폴더를 사이트 루트로 놓는다.

   ── 폰에서 열기 ──
   같은 와이파이면 아래에 찍히는 **192.168.x.x 주소**를 폰 브라우저에 그대로 친다.
   PC 에서 봐도 폰 UI 그대로다 — 이 배포본에는 `<meta name="copycat-dist" content="mobile">`
   이 박혀 있어서 폭을 안 보고 언제나 폰 배치로 뜬다(js/col.js 의 PHONE_DIST).
   넓은 화면에서는 420px 상자에 담긴다.

   ── 서비스 워커는 안 걸린다(HTTP 라서) ──
   브라우저는 **HTTPS 나 localhost 에서만** 서비스 워커를 등록한다. 폰에서 192.168 주소로
   열면 등록이 조용히 실패하고, 게임은 그대로 돈다(오프라인만 안 된다).
   「홈 화면에 추가」와 오프라인까지 보려면 HTTPS 로 올려야 한다 — 그건 배포다.
   ============================================================ */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');
const WHICH = (process.argv[2] === 'iphone') ? 'iphone' : 'android';
const PORT = Number(process.argv[3] || (process.argv[2] === 'iphone' ? process.argv[3] : process.argv[2])) || 8188;
const DIR = path.join(ROOT, 'dist', WHICH);

if (!fs.existsSync(path.join(DIR, 'index.html')))
  throw new Error(`먼저 구워야 한다: node tools/pack-mobile.js   (없는 폴더: dist/${WHICH})`);

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif',
  '.wav':'audio/wav', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8',
};

/* 이 기계의 랜 주소. 폰이 칠 수 있는 것만 — 127.x 와 IPv6 는 뺀다. */
function lanIPs(){
  const out = [];
  const nets = os.networkInterfaces();
  for (const name in nets)
    for (const n of nets[name] || [])
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  let file = path.join(DIR, rel);
  if (!file.startsWith(DIR)){ res.writeHead(403).end('nope'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err){
      /* 404 는 찍는다. 배포본에서 빠진 파일은 대개 그렇게 처음 드러난다. */
      console.log('  404  ' + rel);
      res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' }).end('404 ' + rel);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      /* 고치고 새로고침하면 바로 보여야 한다. 캐시는 진짜 배포에서만 뜻이 있다. */
      'cache-control': 'no-store',
      'service-worker-allowed': '/',
    }).end(buf);
  });
}).listen(PORT, () => {
  const size = (function du(d){
    return fs.readdirSync(d, { withFileTypes:true }).reduce((a, e) => a +
      (e.isDirectory() ? du(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
  })(DIR);
  console.log(`\n  dist/${WHICH}  ${(size / 1048576).toFixed(1)}MB`);
  console.log(`  이 기계에서 →  http://localhost:${PORT}/`);
  const ips = lanIPs();
  if (ips.length){
    console.log(`  폰에서     →  ` + ips.map(ip => `http://${ip}:${PORT}/`).join('\n                 '));
    console.log(`  (같은 와이파이여야 한다. 서비스 워커는 HTTP 라 안 걸린다 — 위 머리말)`);
  } else {
    console.log('  랜 주소를 못 찾았다 — 이 기계에서만 열린다');
  }
  console.log('  Ctrl+C 로 끈다\n');
});
