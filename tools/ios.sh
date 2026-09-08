#!/usr/bin/env bash
# ============================================================
#  ios.sh — 맥 터미널에서 아이폰에 넣고, 올린다.
#
#  왜 터미널인가: Xcode 의 화면은 버전마다 메뉴 이름과 자리가 바뀐다. 화면을 못 보는
#  쪽에서 「어느 탭의 무엇을 누르세요」로 안내하면 서로 다른 것을 보게 된다.
#  명령은 안 바뀌고, **실패하면 이유를 글자로 뱉는다** — 그게 지금 필요한 것이다.
#
#    ./tools/ios.sh devices     연결된 아이폰 목록
#    ./tools/ios.sh run         빌드해서 폰에 설치
#    ./tools/ios.sh archive     아카이브 (TestFlight 에 올릴 파일)
#
#  먼저 게임을 굽고 껍데기에 담아야 한다:
#    node tools/pack-mobile.js && (cd mobile && npm run sync)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
PROJ="mobile/ios/App/App.xcodeproj"
SCHEME="App"

[ -d "$PROJ" ] || { echo "iOS 프로젝트가 없다: $PROJ"; exit 1; }

# ── 플러그인 폴더가 실제로 있는가 ─────────────────────────────────────
# Package.swift 는 `../../../node_modules/@capacitor/app` 같은 **경로**로 플러그인을
# 가리킨다. 그 폴더가 없으면 Xcode 는 "the package at … cannot be accessed" 만 뱉고,
# 그 문장은 **무엇이 없는지 말해 주지 않는다.** 여기서 먼저 이름을 대고 멈춘다.
#
# 제일 흔한 경우: 플러그인이 나중에 추가됐는데 이 기계에서는 `npm install` 을 그 전에
# 한 번만 돌린 것이다(node_modules 는 저장소에 없다).
preflight() {
  local pkg="mobile/ios/App/CapApp-SPM/Package.swift" miss=0
  [ -f "$pkg" ] || return 0
  while IFS= read -r rel; do
    local dir="mobile/ios/App/CapApp-SPM/$rel"
    if [ ! -d "$dir" ]; then
      echo "  ✗ 없다: $rel"
      miss=1
    fi
  done < <(grep -o 'path: "[^"]*"' "$pkg" | sed 's/path: "//;s/"$//')
  if [ "$miss" = 1 ]; then
    echo ""
    echo "플러그인 폴더가 없다. 이 기계에서 받은 적이 없거나, 나중에 추가된 것이다:"
    echo "  cd mobile && npm install"
    echo "그다음 다시:"
    echo "  node tools/pack-mobile.js && (cd mobile && npm run sync)"
    exit 1
  fi
}
preflight

case "${1:-run}" in
devices)
  echo "── 연결된 기기 ──"
  xcrun devicectl list devices 2>/dev/null || xcrun xctrace list devices 2>&1 | sed -n '1,30p'
  ;;

run)
  # UDID 를 인자로 줄 수 있다: ./tools/ios.sh run 00008110-XXXX
  UDID="${2:-}"
  if [ -z "$UDID" ]; then
    UDID=$(xcrun devicectl list devices 2>/dev/null \
      | awk '/connected/ && /iPhone|iPad/ {print $(NF-1); exit}')
  fi
  if [ -z "$UDID" ]; then
    echo "폰을 못 찾았다. 케이블로 연결하고 화면 잠금을 풀어 둔 뒤:"
    echo "  ./tools/ios.sh devices     ← 여기 나오는 UDID 를 보고"
    echo "  ./tools/ios.sh run <UDID>"
    exit 1
  fi
  echo "── 기기 $UDID 로 빌드 ──"
  # -allowProvisioningUpdates: 서명 파일이 없으면 애플에서 받아 온다(팀이 있어야 한다)
  xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Debug \
    -destination "id=$UDID" -allowProvisioningUpdates \
    -derivedDataPath mobile/ios/build build 2>&1 | tail -40
  APP=$(find mobile/ios/build/Build/Products/Debug-iphoneos -maxdepth 1 -name '*.app' | head -1)
  [ -n "$APP" ] || { echo "빌드 결과(.app)를 못 찾았다 — 위 오류를 보라"; exit 1; }
  echo "── 설치: $APP ──"
  xcrun devicectl device install app --device "$UDID" "$APP" 2>&1 | tail -20
  ;;

archive)
  OUT="mobile/ios/build/App.xcarchive"
  echo "── 아카이브 ──"
  xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Release \
    -destination "generic/platform=iOS" -allowProvisioningUpdates \
    -archivePath "$OUT" archive 2>&1 | tail -40
  [ -d "$OUT" ] && echo "→ $OUT" \
    && echo "올리기: Xcode 의 Organizer 를 쓰거나, 아래로 내보낸 뒤 Transporter 앱에 끌어다 놓는다." \
    || echo "아카이브 실패 — 위 오류를 보라"
  ;;

*) echo "쓸 수 있는 것: devices · run · archive" ;;
esac
