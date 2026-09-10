/* ============================================================
   ios-icons.js — 아이폰 앱 아이콘을 우리 것으로 바꾼다.

   ── 왜 따로 있나 ──
   Capacitor 가 깔아 주는 iOS 프로젝트에는 **Capacitor 로고**가 들어 있다(파란 X).
   안드로이드는 tools/android-icons.js 가 갈아 끼우고 있었는데 iOS 쪽은 아무도 안
   건드려서, 그대로 두면 홈 화면과 App Store 목록에 남의 로고가 뜬다
   (2026-09-10 에 실제로 그 상태였다 — 심사에 그대로 갈 뻔했다).

   ── iOS 아이콘의 규칙 두 개 ──
   1. **알파가 없어야 한다.** 투명을 넣으면 심사에서 걸리고, 넣더라도 애플이 검정으로
      깔아 버려서 어두운 고양이가 통째로 사라진다. 그래서 판(plate)을 깔고 굽는다.
   2. **모서리를 미리 깎지 않는다.** iOS 가 직접 깎으므로 각진 정사각형을 줘야 한다
      (round:0). 미리 깎으면 그 자리에 흰 삼각형이 남는다.

   최근 Xcode 는 1024 한 장만 받는다(Contents.json 의 single size) — 나머지 크기는
   Xcode 가 만든다. 그래서 여기서도 한 장만 쓴다.

   실행: node tools/ios-icons.js      (tools/logo.js 로 아이콘을 구운 뒤)
   ============================================================ */
const fs = require('fs'), path = require('path');
const { encodePNG } = require('./png.js');
const { drawRGBA } = require('./logo.js');

const ROOT = path.join(__dirname, '..');
const SET = path.join(ROOT, 'mobile', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

if (!fs.existsSync(SET)) {
  console.log('iOS 프로젝트가 없다 — 건너뛴다 (' + path.relative(ROOT, SET) + ')');
  process.exit(0);
}

/* 여백 0.10 은 안드로이드 런처 아이콘과 같은 값이다 — 두 스토어의 아이콘이 같은
   그림이어야 하고, 여백이 다르면 나란히 놓았을 때 다른 고양이로 보인다. */
const rgba = drawRGBA(1024, { pad: 0.10, round: 0 });

/* **알파를 확인하고 쓴다.** 규칙 1 을 어기면 업로드가 아니라 심사에서 튕기는데,
   그때는 이 자리를 다시 찾기까지 하루가 걸린다. 여기서 세고 지나간다. */
let clear = 0;
for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) clear++;
if (clear) {
  console.error('투명한 점이 ' + clear + '개 있다 — iOS 아이콘은 알파가 없어야 한다');
  process.exit(1);
}

const out = path.join(SET, 'AppIcon-512@2x.png');
const buf = encodePNG(1024, 1024, rgba);
fs.writeFileSync(out, buf);
console.log('  AppIcon-512@2x.png  1024×1024  ' + (buf.length / 1024).toFixed(1) + 'KB  (알파 없음)');
console.log('→ ' + path.relative(ROOT, out));
