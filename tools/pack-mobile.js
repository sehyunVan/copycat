/* ============================================================
   pack-mobile.js — 폰에 **설치되는** 배포본을 두 벌 만든다.

     dist/android/   안드로이드 (크롬 「앱 설치」)
     dist/iphone/    아이폰 (사파리 「홈 화면에 추가」)

   ── 왜 두 벌인가 ──
   같은 게임이지만 두 플랫폼이 요구하는 것이 실제로 다르다. 한 벌로 합치면
   양쪽 다 어중간해진다:

     · 아이콘  안드로이드 런처는 아이콘을 **깎는다**(원·둥근네모·물방울). 그래서
               maskable 아이콘(내용을 안쪽 66% 안에 넣은 것)을 따로 줘야 한다.
               반대로 iOS 는 **자기가 모서리를 깎으므로** 각진 정사각형을 줘야 하고,
               미리 깎아 두면 그 자리에 흰 삼각형이 남는다.
     · 시작 화면  iOS 는 apple-touch-startup-image 가 없으면 켤 때마다 **흰 화면이
               번쩍인다.** 기기 크기마다 정확한 media 를 요구한다. 안드로이드는
               manifest 의 background_color 하나로 끝난다.
     · 설치 안내  안드로이드는 브라우저가 스스로 「앱 설치」를 띄운다(beforeinstallprompt).
               iOS 는 그런 게 없어서 **공유 → 홈 화면에 추가**를 사람에게 말해 줘야 한다.

   ── 서비스 워커 ──
   둘 다 오프라인으로 돈다. 다만 서비스 워커는 **HTTPS(또는 localhost)에서만** 등록된다 —
   파일로 열면 조용히 실패하고 게임은 그냥 돈다. 설치까지 가려면 어딘가에 올려야 한다.

   실행: node tools/pack-mobile.js [--heavy-audio]
     기본은 BGM 경량화(모노 22.05kHz). 폰은 첫 다운로드가 곧 설치라서 기본을 가볍게 둔다.
   ============================================================ */
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { collect, credits, audit, ROOT } = require('./collect.js');

const HEAVY = process.argv.includes('--heavy-audio');
/* 캐시 이름이자 에셋 쿼리. **분까지 넣는다** — 날짜만 쓰면 같은 날 두 번 빌드했을 때
   캐시 이름이 같아서 activate 의 청소가 아무것도 지우지 않고, 고친 것이 폰에 안 내려간다. */
/* 시각은 **이 기계의 시각**이다. 예전엔 toISOString(UTC)이라 저녁에 구운 판이
   오전으로 찍혀서, 폰의 도장을 보고도 어느 판인지 못 알아봤다(9시간 차이). */
const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
const VER = 'v' + stamp.toISOString().slice(0, 16).replace(/[-:T]/g, '');

/* 폰에 깔린 것이 **플레이의 몇 번 판인지**도 같이 찍는다. 스토어·폰 설정에 뜨는
   이름은 versionName 이라, 그 값과 도장이 한 줄에 있어야 「내부 테스트 4번이
   내려온 것인가」를 폰만 보고 답할 수 있다. 없으면 도장만 찍는다(웹 배포). */
const APPVER = (() => {
  try {
    const g = fs.readFileSync(path.join(ROOT, 'mobile/android/app/build.gradle'), 'utf8');
    const name = (g.match(/versionName\s+"([^"]+)"/) || [])[1] || '';
    const code = (g.match(/versionCode\s+(\d+)/) || [])[1] || '';
    return name && code ? name + ' (' + code + ')' : name;
  } catch (e){ return ''; }
})();
const BUILD_LABEL = (APPVER ? APPVER + ' · ' : '') + VER;

/* 아이콘·시작화면을 먼저 만든다. 목록에 넣을 파일이라 순서가 중요하다. */
console.log('아이콘과 시작 화면부터 만든다');
execFileSync(process.execPath, [path.join(__dirname, 'logo.js')], { stdio: 'inherit' });

const ICON = rel => ({ name: rel, data: fs.readFileSync(ROOT + 'assets/icons/' + path.basename(rel)) });

/* ---------- 서비스 워커 ----------
   전부 정적이라 **캐시 우선**이 맞다. 새 배포본은 캐시 이름을 바꿔서 갈아탄다 —
   버전을 안 바꾸면 고친 것이 영원히 안 내려간다. */
const SW = names => `/* copycat 서비스 워커 — 오프라인. 배포마다 CACHE 이름이 바뀐다. */
const CACHE = 'copycat-${VER}';
const FILES = ${JSON.stringify(names, null, 0)};

/* **급한 것과 나중 것을 나눈다.** 전부를 기다리면 21MB(음악·고양이 목소리)를 받는
   동안 서비스 워커가 활성화되지 않고, 그러면 그 방문에는 오프라인이 아예 안 켜진다 —
   실측: 같은 서버에서 android 빌드가 그래서 페이지를 못 잡았다(iphone 은 연결이
   더워진 뒤라 통과했고, 그 비대칭이 원인을 가리켰다).

   음악을 뒤로 미뤄도 게임은 온전하다: 파일이 없으면 절차 생성 오르골로 내려간다.
   그리고 아래 fetch 핸들러가 받아 오는 것을 그때그때 캐시에 넣으므로,
   한 곡을 한 번 들으면 그 곡은 그때부터 오프라인이다. */
/* 정규식을 쓰지 않는다. 이 파일은 sw.js 를 **템플릿 리터럴 안에서** 써 내는데,
   그 안의 \/ 는 리터럴이 먹어 버려서 /\/assets\// 가 //assets// 로 나온다 —
   즉 **줄 주석**이 되고 sw.js 가 통째로 깨진다(실측: 그래서 서비스 워커가 등록조차
   안 됐고, 원인을 세 번 헛짚었다). 문자열 검사면 이스케이프가 아예 없다. */
const heavy = f => f.indexOf('/assets/music/') >= 0 || f.indexOf('/assets/cat_voice/') >= 0;
const CORE = FILES.filter(f => !heavy(f));
const REST = FILES.filter(heavy);

self.addEventListener('install', e => {
  /* 기다리지 않고 바로 갈아탄다 — 새 배포본을 켠 그 방문에서 오프라인이 켜져야 한다 */
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c =>
    /* 앱이 뜨는 데 필요한 것만 기다린다. 하나라도 실패하면 삼키고 다음 방문에 다시 시도한다 —
       반쯤 깔린 오프라인보다 안 깔린 오프라인이 낫고, 그 판단은 다음 방문이 한다. */
    c.addAll(CORE).catch(err => console.warn('core precache 일부 실패', err))
      .then(() => { for (const f of REST) c.add(f).catch(() => {}); })
  ));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  /* 유튜브·폰트 같은 바깥 요청은 건드리지 않는다 — 캐시에 넣으면 조용히 낡는다 */
  if (new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true })
    .then(hit => hit || fetch(r).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(r, res.clone()));
      return res;
    /* 네트워크도 캐시도 없을 때 — 주소가 '/' 나 '/?x' 라도 앱은 떠야 한다.
       디렉터리 색인에 기대지 않고 index.html 을 직접 돌려준다. */
    }).catch(() => caches.match('./index.html'))));
});
`;

/* ---------- 안드로이드 manifest ---------- */
const MANIFEST = {
  id: 'copycat',
  name: 'Copycat — 캣닢 만드는 고양이 조직',
  short_name: 'Copycat',
  description: '체크한 할 일을 고양이들이 서류로 처리하는 사무실. 당신의 시계로 돕니다.',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  /* 세로 고정. 가로로 돌리면 탭 바가 화면의 3분의 1을 먹고, 이 게임은 세로로 쓰는 물건이다. */
  orientation: 'portrait',
  /* 켤 때의 바탕. **로딩 화면과 같은 크림**이다 — 다르면 실행 사슬 가운데가
     번쩍인다(스플래시 → 로딩 → 게임). theme_color 는 어둡게 둔다: 그건
     상태바 색이고 게임은 계속 어둡다. */
  background_color: '#FFF6E9',
  theme_color: '#171310',
  lang: 'ko',
  categories: ['games', 'productivity'],
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    /* maskable 은 따로 있어야 한다 — 같은 그림을 purpose 두 개로 쓰면
       런처가 깎을 때 귀가 잘린다 */
    { src: './icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/* ---------- 아이폰 시작 화면 ----------
   기기마다 정확한 media 를 요구한다. 안 맞으면 아무 일도 안 일어나므로(흰 화면 그대로)
   최근 기기를 넉넉히 적어 둔다. [논리 폭, 논리 높이, 배율] */
const IOS_SCREENS = [
  [375, 667, 2], [390, 844, 3], [393, 852, 3], [402, 874, 3],
  [428, 926, 3], [430, 932, 3], [440, 956, 3],
];

function build(platform){
  const dir = ROOT + 'dist/' + platform + '/';
  fs.rmSync(dir, { recursive: true, force: true });

  const entries = collect({ light: !HEAVY });

  /* ---- 아이콘 ---- */
  const icons = platform === 'android'
    ? ['icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png']
    : ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
  icons.forEach(f => entries.push(ICON(f)));

  /* ---- 아이폰 시작 화면 ---- */
  const splashLinks = [];
  if (platform === 'iphone'){
    const splash = require('./logo.js');         // splashPNG 를 내보낸다
    for (const [w, h, r] of IOS_SCREENS){
      const name = `splash-${w}x${h}@${r}.png`;
      entries.push({ name, data: splash.splashPNG(w * r, h * r, w) });
      splashLinks.push(`<link rel="apple-touch-startup-image" href="./${name}"`
        + ` media="(device-width:${w}px) and (device-height:${h}px)`
        + ` and (-webkit-device-pixel-ratio:${r})">`);
    }
  }

  /* ---- 머리에 넣을 것 ----
     `copycat-dist` 는 **이 배포본이 폰용이라는 도장**이다(js/col.js 가 읽는다).
     배치는 창 폭이 정하는데, 폰용 주소를 PC 브라우저로 열면 폭이 넓어서 데스크톱
     배치가 나온다 — 폰에 낼 화면을 확인하러 들어온 사람에게 그건 다른 게임이다.
     이 도장이 있으면 폭과 무관하게 탭 바로 가고, 무대·패널이 폰 폭으로 선다.

     **판별을 미디어 쿼리로 두지 않는다.** 7번에서 배운 것: 어느 배치인지는 JS 한 곳이
     정하고 CSS 는 클래스만 본다. 둘이 갈리면 화면을 보고도 원인을 못 찾는다. */
  const DIST_MARK = '<meta name="copycat-dist" content="mobile">'
    /* **어느 배포본을 보고 있는지** 폰에서 눈으로 알 수 있게 도장을 하나 더 찍는다.
       고친 것이 안 내려온 것인지 안 고쳐진 것인지를 구별하는 데 이만한 것이 없다 —
       실제로 「예전 2D 모션이 다시 나온다」의 정체가 캐시였다.
       시작화면 구석에 작게 뜬다(js/title.js 가 이 값을 읽는다). */
    + `
<meta name="copycat-build" content="${BUILD_LABEL}">`;
  const head = platform === 'android'
    ? `${DIST_MARK}
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" type="image/png" sizes="512x512" href="./icon-512.png">`
    : `${DIST_MARK}
<link rel="manifest" href="./manifest.webmanifest">
<!-- iOS 는 홈 화면 아이콘을 manifest 가 아니라 이걸로 읽는다(16.4+ 는 둘 다 보지만
     apple-touch-icon 이 확실한 길이다). 모서리는 iOS 가 깎으므로 각진 그림을 준다. -->
<link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png">
${splashLinks.join('\n')}`;

  /* ---- 설치 안내 ----
     안드로이드는 브라우저가 스스로 띄운다. 아이폰은 그런 게 없어서 말해 줘야 하고,
     이미 홈 화면에서 켠 사람에게는 보여선 안 된다(standalone 검사). */
  const installJS = platform === 'android'
    ? `
/* 크롬이 「설치할 수 있다」고 알려 오면 그때만 버튼을 띄운다.
   먼저 버튼을 만들어 두고 기다리면 설치할 수 없는 브라우저에서 죽은 버튼이 남는다. */
(function(){
/* **게임이 뜬 뒤에 말한다.** 로딩 화면(#loadgate — 40번)이 켤 때 몇 초 화면을 덮는데,
   그 위에 설치 안내가 올라오면 로딩 화면이 안내판에 가린다(실측: 폰 배포본 그림에서
   띠가 판 위에 떠 있었다). body.r3ready 가 걸리면 게임이 준비된 것이다.
   그게 안 걸리는 기계에서도 말은 해야 하므로 15초 뒤에는 그냥 한다. */
function afterReady(fn){
  const go = () => { try { fn(); } catch(e){} };
  if (document.body && document.body.classList.contains('r3ready')) return go();
  let done = false;
  const fire = () => { if (!done){ done = true; go(); } };
  const t = setInterval(() => {
    if (document.body && document.body.classList.contains('r3ready')){ clearInterval(t); fire(); }
  }, 200);
  setTimeout(() => { clearInterval(t); fire(); }, 15000);
}
  let ev = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; afterReady(show); });
  function show(){
    if (document.getElementById('pwaBar')) return;
    const b = document.createElement('button');
    b.id = 'pwaBar';
    b.textContent = '\\uD83D\\uDCF1 홈 화면에 설치';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);'
      + 'bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9500;'
      + 'font:600 13px/1 inherit;padding:11px 16px;border:2px solid #E9A85C;'
      + 'background:#231D18;color:#EFE4D6;box-shadow:0 4px 14px rgba(0,0,0,.5)';
    b.onclick = async () => { b.remove(); if (ev){ ev.prompt(); await ev.userChoice; ev = null; } };
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 14000);
  }
})();`
    : `
/* iOS 에는 설치 프롬프트가 없다 — 「공유 → 홈 화면에 추가」를 사람이 눌러야 한다.
   그래서 처음 온 사람에게 한 번만 말해 준다. 이미 홈 화면에서 켰으면 말할 필요가 없다. */
(function(){
  const standalone = navigator.standalone || matchMedia('(display-mode:standalone)').matches;
  let told = false;
  try { told = localStorage.getItem('copycat.a2hs') === '1'; } catch(e){}
  if (standalone || told) return;
/* **게임이 뜬 뒤에 말한다.** 로딩 화면(#loadgate — 40번)이 켤 때 몇 초 화면을 덮는데,
   그 위에 설치 안내가 올라오면 로딩 화면이 안내판에 가린다(실측: 폰 배포본 그림에서
   띠가 판 위에 떠 있었다). body.r3ready 가 걸리면 게임이 준비된 것이다.
   그게 안 걸리는 기계에서도 말은 해야 하므로 15초 뒤에는 그냥 한다. */
function afterReady(fn){
  const go = () => { try { fn(); } catch(e){} };
  if (document.body && document.body.classList.contains('r3ready')) return go();
  let done = false;
  const fire = () => { if (!done){ done = true; go(); } };
  const t = setInterval(() => {
    if (document.body && document.body.classList.contains('r3ready')){ clearInterval(t); fire(); }
  }, 200);
  setTimeout(() => { clearInterval(t); fire(); }, 15000);
}
  afterReady(() => setTimeout(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:10px;right:10px;'
      + 'bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9500;'
      + 'font:13px/1.6 inherit;padding:12px 14px;border:2px solid #E9A85C;'
      + 'background:#231D18;color:#EFE4D6;box-shadow:0 4px 14px rgba(0,0,0,.5)';
    d.innerHTML = '<b>아래 \\u2934\\uFE0F 공유 \\u2192 「홈 화면에 추가」</b><br>'
      + '<span style="opacity:.75">앱처럼 열리고, 인터넷 없이도 돕니다.</span>'
      + '<button style="float:right;margin-top:-2px;font:600 12px inherit;'
      + 'color:#E9A85C;background:none;border:0;padding:4px">닫기</button>';
    d.querySelector('button').onclick = () => {
      d.remove();
      try { localStorage.setItem('copycat.a2hs', '1'); } catch(e){}
    };
    document.body.appendChild(d);
  }, 2600));
})();`;

  /* ---- index.html 손보기 ---- */
  const idx = entries.find(e => e.name === 'index.html');
  let html = idx.data.toString('utf8');

  /* 파일로 열었을 때(서비스 워커 없음)도 게임은 그냥 돌아야 한다 —
     등록 실패를 삼키는 이유가 그것이다. */
  const swJS = `
/* 오프라인. HTTPS(또는 localhost)에서만 등록된다 — 파일로 열면 실패하고 게임은 그대로 돈다.

   **load 를 기다리지 않는다.** 처음엔 addEventListener('load', ...) 였는데, 이 게임은
   <audio> 에 몇 MB 짜리 파일을 걸어 두므로 그게 끝나기 전까지 load 가 오지 않는다 —
   실측: 실제 서버에서 서비스 워커가 **등록조차 안 됐다.** localhost 에서는 그 다운로드가
   몇 초라 통과했고, 그 차이가 원인을 세 번 가렸다.

   그리고 **실패를 삼키지 않는다.** 조용한 .catch(() => {}) 가 그 세 번 동안
   "왜 오프라인이 안 켜지지" 를 대답 불가능한 질문으로 만들었다. */
/* **앱에서는 서비스 워커를 안 쓴다.** 앱은 파일을 통째로 들고 있어서 캐시가 벌어 주는
   것이 없고, 대신 잃는 것이 크다: 스토어로 새 판을 받아도 웹 자산은 **캐시의 옛것**이
   한 번 더 뜬다. 실제로 1.0.6 에서 그 일이 났다 — 네이티브 고침(키보드)은 바로 먹었는데
   화면 고침(상단 바)은 안 먹어서, 「고쳤다는데 그대로다」가 또 됐다.
   이미 등록돼 있는 기기도 있으므로 **떼어내고 캐시도 지운다**(다음 실행부터 깨끗해진다). */
var CC_NATIVE = (function () {
  try {
    if (window.Capacitor && (Capacitor.isNativePlatform
      ? Capacitor.isNativePlatform() : (Capacitor.getPlatform && Capacitor.getPlatform() !== 'web'))) return true;
    if (location.protocol === 'capacitor:') return true;                 // iOS
    return location.hostname === 'localhost' && !location.port
        && location.protocol === 'https:';                              // 안드로이드
  } catch (e) { return false; }
})();

if (CC_NATIVE) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations)
    navigator.serviceWorker.getRegistrations()
      .then(function (rs) { rs.forEach(function (r) { r.unregister(); }); })
      .catch(function () {});
  if (window.caches && caches.keys)
    caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); })
      .catch(function () {});
} else if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js').catch(e =>
    console.warn('[copycat] 서비스 워커 등록 실패 — 오프라인은 안 켜집니다:', e));
${installJS}`;

  html = html.replace('</head>', head + '\n</head>');
  html = html.replace('</body>', '<script>' + swJS + '\n</script>\n</body>');
  /* 캐시 무효화 — ?v=13 이 그대로면 고친 파일이 폰에서 안 내려간다 */
  html = html.replace(/\?v=\d+"/g, '?' + VER + '"');
  idx.data = Buffer.from(html, 'utf8');

  entries.push({ name: 'manifest.webmanifest', data: Buffer.from(JSON.stringify(
    platform === 'android' ? MANIFEST
      /* iOS 는 아이콘을 apple-touch-icon 으로 읽고 세로 고정도 안 듣는다.
         manifest 를 두는 건 16.4+ 와 「홈 화면에 추가」의 이름·색 때문이다. */
      : { ...MANIFEST, orientation: undefined,
          icons: MANIFEST.icons.filter(i => i.purpose === 'any') },
    null, 2), 'utf8') });

  /* 서비스 워커는 **목록이 확정된 뒤에** 만든다 — 빠뜨린 파일은 오프라인에서 흰 화면이다 */
  const names = entries.map(e => e.name).filter(n => n !== 'sw.js').map(n => './' + n);
  const sw = SW(names);
  /* **문법을 검사한다.** 깨진 서비스 워커는 등록이 조용히 거부되고 게임은 멀쩡히 돌아서,
     오프라인만 안 켜진다 — 사람이 알아챌 방법이 없는 실패다. 실제로 한 번 그렇게 나갔다
     (템플릿 리터럴이 정규식의 \/ 를 먹어서 줄 주석이 됐다). 파싱만 하고 실행은 안 한다. */
  try { new (require('vm').Script)(sw, { filename: 'sw.js' }); }
  catch (e){ throw new Error('sw.js 가 문법적으로 깨졌다: ' + e.message); }
  entries.push({ name: 'sw.js', data: Buffer.from(sw, 'utf8') });

  entries.push({ name: 'CREDITS.txt', data: Buffer.from(credits(
    platform === 'android'
      ? `[Installing it]
Serve this folder over HTTPS and open it in Chrome, then use the
"Install app" prompt (or menu > Add to Home screen). It works offline
after the first load. Your progress is saved on the device.

[Play]
Your own work hours (set them in the gear menu). It runs on your own
clock, so it does not fast-forward. Leave it on the home screen.
`
      : `[Installing it]
Serve this folder over HTTPS and open it in Safari on iPhone, then
Share > "Add to Home Screen". It works offline after the first load
and opens without browser chrome. Your progress is saved on the device.

[Play]
Your own work hours (set them in the gear menu). It runs on your own
clock, so it does not fast-forward. Leave it on the home screen.
`), 'utf8') });

  audit(entries);

  /* ---- 쓴다 ---- */
  for (const e of entries){
    const out = dir + e.name;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, e.data);
  }
  const total = entries.reduce((n, e) => n + e.data.length, 0);
  return { dir, count: entries.length, total };
}

for (const p of ['android', 'iphone']){
  const r = build(p);
  console.log(`\n${p}  파일 ${r.count}개 · ${(r.total / 1048576).toFixed(1)}MB`);
  console.log('  ' + r.dir);
}
console.log(`\n캐시 이름: copycat-${VER}  (배포마다 바뀐다 — 안 바뀌면 고친 게 폰에 안 내려간다)`);
console.log('설치는 HTTPS 에서만 된다. 폴더를 올린 뒤 폰 브라우저로 열면 된다.');
if (!HEAVY) console.log('BGM 은 모노 22.05kHz 로 줄였다. 원본으로 넣으려면 --heavy-audio');
