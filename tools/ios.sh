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
# 스킴 이름은 **물어봐서** 정한다. Capacitor 가 만드는 프로젝트에는 공유 스킴이 없을
# 때가 있고(Xcode 가 제 사용자 폴더에만 만든다), 그러면 xcodebuild 는
# "does not contain a scheme named …" 만 뱉는다 — 이름을 지어 부르면 또 틀린다.
SCHEME="${SCHEME:-}"
if [ -z "$SCHEME" ]; then
  SCHEME=$(xcodebuild -project "$PROJ" -list 2>/dev/null     | awk '/Schemes:/{f=1;next} f && NF {print $1; exit}')
fi
SCHEME="${SCHEME:-App}"

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

# ── 게임을 먼저 굽는다 ─────────────────────────────────────────────────
#  Xcode 는 `mobile/ios/App/App/public` 만 본다. 그건 `cap sync` 가 채우는 자리이고,
#  `cap sync` 는 `dist/android` 를 옮길 뿐이다. 굽기를 건너뛰면 **고친 것이 안 실린
#  채로 빌드가 성공한다** — 그게 제일 나쁘다. 화면에는 옛 게임이 그대로 뜨는데
#  빌드는 초록이라, 코드를 의심하게 된다(2026-09-08 실제로 그랬다).
#  건너뛰려면: SKIP_WEB=1 ./tools/ios.sh run
web() {
  [ "${SKIP_WEB:-}" = "1" ] && { echo "── 굽기 건너뜀 (SKIP_WEB=1) ──"; return 0; }
  echo "── 게임 굽기 ──"
  node tools/pack-mobile.js > /dev/null || { echo "pack-mobile 실패"; exit 1; }
  ( cd mobile && npm run sync > /dev/null ) || { echo "cap sync 실패"; exit 1; }
  echo "   $(grep -o 'copycat-v[0-9]*' dist/iphone/sw.js | head -1)"
}

case "${1:-run}" in
devices)
  echo "── 연결된 기기 ──"
  xcrun devicectl list devices 2>/dev/null || xcrun xctrace list devices 2>&1 | sed -n '1,30p'
  ;;

run)
  # UDID 를 인자로 줄 수 있다: ./tools/ios.sh run 00008110-XXXX
  UDID="${2:-}"
  if [ -z "$UDID" ]; then
    # **xcodebuild 에게 직접 물어본다.** 기기 목록을 devicectl 로 읽어 열을 세면
    # 형식이 조금만 달라도 엉뚱한 값을 집는다 — 실제로 그래서
    # "unable to find a device matching the provided destination specifier" 가 났다.
    # 목적지를 쓸 그 도구가 아는 이름을 그대로 받아 오는 쪽이 안 틀린다.
    UDID=$(xcodebuild -project "$PROJ" -scheme "$SCHEME" -showdestinations 2>/dev/null \
      | grep "platform:iOS," | grep -v "Simulator" | grep -vi "placeholder" \
      | sed -E "s/.*id:([0-9A-Fa-f-]{8,}).*/\1/" | head -1)
  fi
  if [ -z "$UDID" ]; then
    echo "폰을 못 찾았다. 케이블로 연결하고 **화면 잠금을 풀어** 둔 뒤 다시."
    echo ""
    echo "── xcodebuild 가 보는 목적지 ──"
    xcodebuild -project "$PROJ" -scheme "$SCHEME" -showdestinations 2>&1       | grep -E "platform:iOS|Available destinations|Ineligible" | sed 's/^/  /' | head -20
    echo ""
    echo "위 목록에 폰이 있으면 그 id 를 그대로 넘겨라:"
    echo "  ./tools/ios.sh run <id>"
    exit 1
  fi
  web
  echo "── 기기 $UDID 로 빌드 (스킴 $SCHEME) ──"
  # -allowProvisioningUpdates: 서명 파일이 없으면 애플에서 받아 온다(팀이 있어야 한다)
  #
  # **파이프로 걸러 내지 않는다.** `xcodebuild | tail` 로 두면 실패해도 종료 코드가
  # tail 것이라 성공처럼 지나가고, 다음 줄의 find 가 "그런 폴더 없다"로 죽는다 —
  # 사람이 보는 것은 find 의 불평이고 진짜 이유는 위로 흘러가 버린 뒤다.
  LOG=mobile/ios/build.log
  xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Debug     -destination "id=$UDID" -allowProvisioningUpdates     -derivedDataPath mobile/ios/build build > "$LOG" 2>&1
  rc=$?
  if [ $rc -ne 0 ]; then
    echo ""
    echo "── 빌드 실패 · 오류 줄만 ──"
    grep -E "error:" "$LOG" | sed 's/^/  /' | tail -20
    echo ""
    echo "오류 줄이 안 보이면 전문을 보라:  tail -60 $LOG"
    exit 1
  fi
  APP=$(find mobile/ios/build/Build/Products/Debug-iphoneos -maxdepth 1 -name '*.app' 2>/dev/null | head -1)
  [ -n "$APP" ] || { echo "빌드는 됐는데 .app 이 없다 — tail -60 $LOG"; exit 1; }
  echo "── 설치: $APP ──"
  xcrun devicectl device install app --device "$UDID" "$APP" 2>&1 | tail -20
  ;;

archive)
  OUT="mobile/ios/build/App.xcarchive"
  web
  echo "── 아카이브 (스킴 $SCHEME) ──"
  LOG=mobile/ios/archive.log
  xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Release     -destination "generic/platform=iOS" -allowProvisioningUpdates     -archivePath "$OUT" archive > "$LOG" 2>&1
  rc=$?
  if [ $rc -ne 0 ] || [ ! -d "$OUT" ]; then
    echo "── 아카이브 실패 · 오류 줄만 ──"
    grep -E "error:" "$LOG" | sed 's/^/  /' | tail -20
    echo "전문:  tail -60 $LOG"
    exit 1
  fi
  echo "→ $OUT"
  echo "올리기: Xcode 의 Organizer 를 쓰거나, Transporter 앱에 끌어다 놓는다." 
  ;;

log)
  # 기기 로그를 흘려 보낸다. 게임이 남기는 [CC-AUTH] 줄만 걸러 본다 —
  # 창이 안 뜨는 것이 증상일 때, 그 자취를 밖에서 받는 유일한 길이다.
  UDID="${2:-}"
  if [ -z "$UDID" ]; then
    UDID=$(xcodebuild -project "$PROJ" -scheme "$SCHEME" -showdestinations 2>/dev/null       | grep "platform:iOS," | grep -v "Simulator" | grep -vi "placeholder"       | sed -E "s/.*id:([0-9A-Fa-f-]{8,}).*/\1/" | head -1)
  fi
  [ -n "$UDID" ] || { echo "폰을 못 찾았다"; exit 1; }
  echo "── 로그 (Ctrl+C 로 멈춤) · 앱에서 로그인을 눌러 보라 ──"
  xcrun devicectl device console --device "$UDID" 2>/dev/null     | grep --line-buffered -E "CC-AUTH|Copycat|copycat"     || echo "devicectl console 을 못 쓴다 — Xcode 의 Devices and Simulators 에서 Open Console"
  ;;

*) echo "쓸 수 있는 것: devices · run · archive · log" ;;
esac
