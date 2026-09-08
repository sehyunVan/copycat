/* ============================================================
   fix-spm.js — iOS 의 Package.swift 경로를 슬래시로 되돌린다.

   왜 필요한가: `npx cap sync` 를 **윈도우에서** 돌리면 이 파일에 경로가
   역슬래시로 박힌다.

       path: "..\..\..\node_modules\@capacitor\app"      ← 맥에서 안 읽힌다

   맥의 Swift Package Manager 는 슬래시만 안다. 그런데 이 파일은 저장소에 들어 있어서
   **맥이 `git pull` 할 때마다 그 깨진 파일을 받는다** — 플러그인이 안 실리고,
   `@capacitor/app` 이 없으니 구글 로그인이 앱으로 돌아온 것을 아무도 모른다.
   화면에는 「로그인이 그냥 안 된다」로만 보인다(2026-09-08 실측).

   그래서 sync 뒤에 한 번 돌린다. 맥에서 돌리면 바꿀 것이 없으므로 그냥 지나간다.

     node tools/fix-spm.js
   ============================================================ */
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, '..', 'mobile', 'ios', 'App', 'CapApp-SPM', 'Package.swift');
if (!fs.existsSync(P)){ console.log('Package.swift 가 없다 — iOS 플랫폼을 안 넣은 판이다'); process.exit(0); }
const BS = String.fromCharCode(92);
let s = fs.readFileSync(P, 'utf8');
let n = 0;
/* **경로 문자열 안에서만** 바꾼다. 스위프트 코드의 다른 역슬래시(문자열 이스케이프)까지
   건드리면 고치려던 파일을 깨뜨린다. */
const out = s.replace(/path: "([^"]*)"/g, (m, g) => {
  if (g.indexOf(BS) < 0) return m;
  n += g.split(BS).length - 1;
  return 'path: "' + g.split(BS).join('/') + '"';
});
if (!n){ console.log('Package.swift — 고칠 것 없음'); process.exit(0); }
fs.writeFileSync(P, out);
console.log('Package.swift — 경로 구분자 ' + n + '개를 슬래시로 되돌렸다');
