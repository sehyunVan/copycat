/* ============================================================
   android-icons.js — Capacitor 껍데기의 런처 아이콘·테마를 우리 것으로 바꾼다.

   Capacitor 가 깔아 주는 기본값은 **Capacitor 로고**와 **흰 배경**이다. 그대로 빌드하면
   홈 화면에 남의 로고가 뜨고, 앱을 켤 때 흰 화면이 한 번 번쩍인다(이 게임은 어두운 화면으로
   시작한다 — 프롤로그가 검은 극장이라 그 번쩍임이 유난히 튄다).

   안드로이드 아이콘이 두 겹인 이유:
     · mipmap-<밀도>/ic_launcher.png       옛 런처(안드로이드 7 이하)가 쓰는 통짜 그림
     · adaptive icon (v26+)           배경색 + **전경 그림**을 따로 준다. 런처가 그 둘을
                                      원·둥근네모·물방울로 깎으므로 전경은 108dp 중
                                      가운데 72dp 안에만 그려야 한다 — 그래서 여백이 크다.
   두 겹을 다 채워야 기기를 가리지 않는다.

   실행: node tools/android-icons.js   (pack-mobile 뒤, cap sync 뒤, gradle 앞)
   ============================================================ */
const fs = require('fs'), path = require('path');
const { encodePNG } = require('./png.js');
const { drawRGBA } = require('./logo.js');

const RES = path.join(__dirname, '..', 'mobile', 'android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(RES)) throw new Error('Capacitor 안드로이드 프로젝트가 없다 — npx cap add android 먼저');

/* 밀도별 크기. ic_launcher 는 48dp, 전경(adaptive)은 108dp 기준이다. */
const DENS = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];

let n = 0;
for (const [d, k] of DENS){
  const dir = path.join(RES, 'mipmap-' + d);
  fs.mkdirSync(dir, { recursive: true });

  /* 통짜 아이콘 — 둥근 모서리 그대로 */
  const s1 = Math.round(48 * k);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), encodePNG(s1, s1, drawRGBA(s1, { pad:0.10, round:0.22 })));
  /* 원형 런처용 — 원으로 깎이므로 내용을 더 물린다 */
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), encodePNG(s1, s1, drawRGBA(s1, { pad:0.20, round:0.5 })));

  /* adaptive 전경 — 108dp. 바탕은 XML 의 색이 깔리므로 여기서는 **투명 위에 귀만** 그린다.
     귀를 가운데 72dp(= 108 의 67%) 안에 두려면 pad 를 0.30 쯤 줘야 한다. */
  const s2 = Math.round(108 * k);
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'),
    encodePNG(s2, s2, drawRGBA(s2, { pad:0.32, round:0, bg:null })));
  n += 3;
}

/* adaptive 배경색 — 아이콘의 주황판. XML 한 줄이 다섯 밀도를 덮는다. */
fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F08C4B</color>
</resources>
`);

/* 켤 때의 배경. Capacitor 기본은 흰색이라 어두운 게임으로 들어가는 순간 번쩍인다. */
const styles = path.join(RES, 'values', 'styles.xml');
let s = fs.readFileSync(styles, 'utf8');
if (!s.includes('copycatWindowBg')){
  s = s.replace('</resources>',
`    <!-- 켤 때 보이는 색. 게임이 어두운 화면으로 시작하므로 흰색이면 번쩍인다. -->
    <color name="copycatWindowBg">#171310</color>
</resources>`);
  /* 모든 테마의 windowBackground 를 그 색으로 */
  s = s.replace(/(<style name="AppTheme[^"]*"[^>]*>)/g,
    '$1\n        <item name="android:windowBackground">@color/copycatWindowBg</item>');
  fs.writeFileSync(styles, s);
}

/* 세로 고정 + 켜 둔 채 회전해도 웹뷰가 다시 안 뜨게.
   이 게임은 세로로 쓰는 물건이고, 가로로 돌리면 탭 바가 화면의 3분의 1을 먹는다. */
const man = path.join(RES, '..', 'AndroidManifest.xml');
let m = fs.readFileSync(man, 'utf8');
if (!m.includes('screenOrientation')){
  m = m.replace(/(<activity\b[^>]*android:name="\.MainActivity")/,
    '$1\n            android:screenOrientation="portrait"');
  fs.writeFileSync(man, m);
}

console.log(`런처 아이콘 ${n}장 · adaptive 배경 · 시작 배경색 · 세로 고정`);
