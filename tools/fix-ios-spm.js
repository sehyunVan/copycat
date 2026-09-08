/* ============================================================
   fix-ios-spm.js — 윈도우에서 만든 iOS 패키지 경로를 맥이 읽을 수 있게 고친다.

   `npx cap sync ios` 를 **윈도우에서** 돌리면 Package.swift 의 플러그인 경로가
   역슬래시로 적힌다:

       .package(name: "CapacitorApp", path: "..\..\..\node_modules\@capacitor\app")

   Swift Package Manager 는 이걸 경로로 안 읽는다 — 맥에서 열면 의존성을 못 찾고
   빌드가 그 자리에서 선다. 파일 머리에 「고치지 마라(CLI 가 관리한다)」고 적혀 있지만,
   그 CLI 가 윈도우에서 잘못 쓴 것이라 여기서 되돌린다.

   **cap sync 를 돌릴 때마다 다시 깨지므로 그 뒤에 같이 돌린다.**

   실행: node tools/fix-ios-spm.js
   ============================================================ */
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, '..', 'mobile', 'ios', 'App', 'CapApp-SPM', 'Package.swift');

if (!fs.existsSync(P)) { console.log('iOS 패키지가 없다 — 건너뛴다'); process.exit(0); }
const before = fs.readFileSync(P, 'utf8');
/* path: "..." 안의 역슬래시만 바꾼다. 다른 곳(문자열 이스케이프)은 건드리지 않는다. */
const BS = String.fromCharCode(92);   /* 역슬래시. 이 파일 안에서 이스케이프를 안 쓰려는 것이다 */
const after = before.replace(/path:\s*"([^"]*)"/g, (m, p) => 'path: "' + p.split(BS).join('/') + '"');
if (after === before) { console.log('고칠 것 없음 (경로가 이미 슬래시다)'); process.exit(0); }
fs.writeFileSync(P, after);
const n = (before.match(new RegExp('path:\\s*"[^"]*' + BS + BS + '[^"]*"', 'g')) || []).length;
console.log('경로 ' + n + '개를 슬래시로 고쳤다: ' + path.relative(process.cwd(), P));
