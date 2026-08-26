#!/usr/bin/env bash
# 폰 배포본을 서버에 올려 **실기기에서 열 수 있게** 한다.
#
#   ./deploy-mobile.sh              # 두 빌드 업로드
#   ./deploy-mobile.sh --caddy      # + Caddyfile 설치 및 reload (처음 한 번만 필요)
#   ./deploy-mobile.sh --dry-run    # 로컬에 쌓아 놓고 목록만 보여준다
#   ./deploy-mobile.sh --new-token  # 주소를 새로 발급한다(옛 주소는 죽는다)
#
# 왜 이 스크립트가 따로 있나 — home/deploy/deploy.sh 를 쓰면 안 되는 이유 셋:
#   1. 그 스크립트는 /var/www/home 을 **통째로 지운다.** 거기 얹으면 다음 사이트
#      배포에 조용히 사라진다. 그래서 /var/www/copycat-test 라는 딴 루트를 쓴다.
#   2. 그 스크립트는 copycat 을 **일부러 제외**한다(릴리스 전 PayPal 페이지 때문).
#      이건 그 결정을 뒤집는 게 아니라, 사이트가 아닌 자리에 테스트용으로 두는 것이다.
#   3. 테스트 호스트는 캐시를 꺼야 한다. 사이트는 반대로 켜야 한다.
#
# 주소의 비밀은 **경로**에 있다. 호스트 이름은 Let's Encrypt 인증서가 발급되는 순간
# Certificate Transparency 로그에 공개되므로 감춰지지 않는다. 경로는 어디에도 안 남는다.
#
# Git Bash + ssh/scp/tar 만 쓴다. 서버에는 tar 만 있으면 된다.
set -euo pipefail

HOST="${HOST:-root@165.227.196.68}"
WEBROOT="${WEBROOT:-/var/www/copycat-test}"
VHOST="cc.165-227-196-68.sslip.io"

DO_CADDY=0; DRY=0; NEW_TOKEN=0
for a in "$@"; do
  case "$a" in
    --caddy)     DO_CADDY=1 ;;
    --dry-run)   DRY=1 ;;
    --new-token) NEW_TOKEN=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../copycat/tools
CC="$(dirname "$HERE")"                                # .../copycat
CADDYFILE="$(dirname "$CC")/home/deploy/Caddyfile"     # 그 박스 설정의 유일한 원본

say(){ printf '\033[36m▸\033[0m %s\n' "$*"; }

for d in android iphone; do
  [ -f "$CC/dist/$d/index.html" ] || { echo "dist/$d 가 없다 — node tools/pack-mobile.js 먼저" >&2; exit 1; }
done

# ── 주소 ──────────────────────────────────────────────────────────────────────
# 한 번 발급해서 파일에 둔다. 매번 새로 뽑으면 폰 홈 화면에 얹어 둔 아이콘이 매번 죽는다
# (PWA 는 start_url 이 주소다). --new-token 이 그걸 일부러 하는 스위치다.
TOKENFILE="$CC/dist/.deploy-token"
if [ "$NEW_TOKEN" = 1 ] || [ ! -f "$TOKENFILE" ]; then
  node -e 'process.stdout.write(require("crypto").randomBytes(9).toString("base64url"))' > "$TOKENFILE"
  say "새 주소를 발급했다"
fi
TOKEN="$(cat "$TOKENFILE")"
BASE="https://$VHOST/$TOKEN"

# ── 쌓기 ──────────────────────────────────────────────────────────────────────
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
say "staging into $STAGE"
mkdir -p "$STAGE/$TOKEN"
cp -r "$CC/dist/android" "$STAGE/$TOKEN/android"
cp -r "$CC/dist/iphone"  "$STAGE/$TOKEN/iphone"

# 폰에서 열 첫 화면. 기기를 알아보고 맞는 쪽을 위에 놓는다 —
# 폰 화면에서 둘 중 뭘 눌러야 하는지 고민하게 만들 이유가 없다.
cat > "$STAGE/$TOKEN/index.html" <<'HTML'
<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Copycat — 폰 테스트</title>
<link rel="icon" href="./android/icon-192.png">
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100dvh;display:flex;flex-direction:column;justify-content:center;
    gap:14px;padding:28px 20px calc(28px + env(safe-area-inset-bottom,0px));
    background:#171310;color:#EFE4D6;
    font:15px/1.6 "Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
    -webkit-user-select:none;user-select:none}
  h1{margin:0 0 2px;font-size:19px;letter-spacing:-.01em}
  .sub{margin:0 0 10px;font-size:13px;color:#9C8D7C}
  a.card{display:block;text-decoration:none;color:inherit;padding:16px 17px;
    border:2px solid #3B3229;background:#231D18}
  a.card:active{border-color:#E9A85C}
  a.card.first{border-color:#E9A85C}
  a.card b{display:block;font-size:16px;margin-bottom:3px}
  a.card span{font-size:12.5px;color:#9C8D7C}
  .foot{font-size:12px;color:#6F6459;margin-top:6px}
  .foot code{color:#9C8D7C}
</style></head><body>
  <div>
    <h1>Copycat</h1>
    <p class="sub">폰 테스트 빌드</p>
  </div>
  <a class="card" id="a" href="./android/index.html">
    <b>안드로이드</b><span>열고 → 메뉴에서 <b style="display:inline">앱 설치</b></span></a>
  <a class="card" id="i" href="./iphone/index.html">
    <b>아이폰</b><span>열고 → 공유 → <b style="display:inline">홈 화면에 추가</b></span></a>
  <p class="foot">첫 실행 뒤에는 인터넷 없이 돕니다. 저장은 이 기기에만 남습니다.<br>
    고친 게 안 보이면 홈 화면 아이콘을 지우고 다시 추가하세요.</p>
<script>
  /* 기기에 맞는 쪽을 위로. 아이폰 사파리에는 설치 프롬프트가 없어서 안내가 다르고,
     그 둘을 나란히 보여 주면 폰 화면에서 잘못 누르기 쉽다. */
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var a = document.getElementById('a'), i = document.getElementById('i');
  (ios ? i : a).classList.add('first');
  if (ios) i.parentNode.insertBefore(i, a);
</script>
</body></html>
HTML

say "staged ($(du -sh "$STAGE" | cut -f1)):"
(cd "$STAGE" && find . -maxdepth 3 -type d | sort | sed 's/^\./    /')
echo "    ... $(cd "$STAGE" && find . -type f | wc -l) files"

if [ "$DRY" = 1 ]; then say "dry run — nothing uploaded"; echo "  would be: $BASE/"; exit 0; fi

# ── 올리기 ────────────────────────────────────────────────────────────────────
TARBALL="$(mktemp -t cc-mobile-XXXXXX.tgz)"
trap 'rm -rf "$STAGE" "$TARBALL"' EXIT
tar czf "$TARBALL" -C "$STAGE" .
say "uploading $(du -h "$TARBALL" | cut -f1) to $HOST:$WEBROOT"
scp -q "$TARBALL" "$HOST:/tmp/cc-mobile.tgz"
rm -f "$TARBALL"

ssh "$HOST" bash -s <<EOF
set -euo pipefail
# 다음 줄이 재귀 삭제다 — /var/www 밖은 절대 건드리지 않게 막아 둔다
case "$WEBROOT" in /var/www/?*) ;; *) echo "refusing to clear $WEBROOT" >&2; exit 1 ;; esac
mkdir -p "$WEBROOT"
find "$WEBROOT" -mindepth 1 -delete
tar xzf /tmp/cc-mobile.tgz -C "$WEBROOT"
rm -f /tmp/cc-mobile.tgz
chown -R caddy:caddy "$WEBROOT" 2>/dev/null || true
echo "  server: \$(find "$WEBROOT" -type f | wc -l) files, \$(du -sh "$WEBROOT" | cut -f1)"
EOF
say "uploaded"

# ── Caddy ─────────────────────────────────────────────────────────────────────
# 설정은 home/deploy/Caddyfile 한 장이 원본이다. 여기서 따로 쓰면 두 벌이 되고,
# 다음에 home 쪽 --caddy 를 돌리는 순간 이 블록이 사라진다.
if [ "$DO_CADDY" = 1 ]; then
  [ -f "$CADDYFILE" ] || { echo "Caddyfile 을 못 찾았다: $CADDYFILE" >&2; exit 1; }
  grep -q "$VHOST" "$CADDYFILE" || { echo "Caddyfile 에 $VHOST 블록이 없다" >&2; exit 1; }
  say "installing $CADDYFILE (timestamped .bak kept)"
  scp -q "$CADDYFILE" "$HOST:/tmp/Caddyfile.new"
  ssh "$HOST" bash -s <<'EOF'
set -euo pipefail
# 갈아 끼우기 **전에** 검사한다 — 이 박스는 트레이딩 루프도 돌린다
caddy validate --config /tmp/Caddyfile.new --adapter caddyfile
if [ -f /etc/caddy/Caddyfile ]; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%Y%m%d-%H%M%S)"
  echo "  backup: $(ls -1t /etc/caddy/Caddyfile.bak.* | head -1)"
fi
cp /tmp/Caddyfile.new /etc/caddy/Caddyfile
rm -f /tmp/Caddyfile.new
systemctl reload caddy
systemctl is-active --quiet caddy && echo "  caddy reloaded and active"
EOF
fi

printf '%s\n' "$BASE/" > "$CC/dist/DEPLOY-URL.txt"
cat <<DONE

  폰에서 이 주소를 연다:

    $BASE/

  안드로이드   $BASE/android/
  아이폰       $BASE/iphone/

  주소는 dist/DEPLOY-URL.txt 에도 적어 뒀다. 경로가 비밀이라 링크를 흘리면 그게 공개다.
  첫 접속은 인증서를 받는 몇 초가 걸린다.
DONE
