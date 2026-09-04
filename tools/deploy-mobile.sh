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

# 폰에서 열 첫 화면. **고르게 하지 않는다** — 기기를 알아보고 바로 넘긴다.
#
# 전에는 카드 둘(안드로이드·아이폰)을 놓고 맞는 쪽을 위에 뒀다. 그런데 이 주소를 여는
# 사람은 「어느 배포본인가」를 궁금해하지 않는다 — 게임을 열려고 온다. 화면 하나를
# 더 만들어서 한 번 더 누르게 할 이유가 없다.
#
# 두 배포본은 그대로 있다(.../android/ · .../iphone/). 직접 주소로 들어가면 되고,
# 홈 화면에 얹은 아이콘도 그 주소를 가리키므로 이 바뀜에 안 흔들린다.
#
# `<script>` 로 넘긴다(meta refresh 가 아니라): 기기를 봐야 하고, replace 로 넘겨야
# 뒤로 가기가 이 빈 화면으로 돌아오지 않는다.
cat > "$STAGE/$TOKEN/index.html" <<'HTML'
<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Copycat</title>
<link rel="icon" href="./android/icon-192.png">
<style>
  html,body{height:100%;margin:0;background:#171310;color:#8B7A68;
    font:13px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
  /* 넘어가는 사이에 보이는 화면. 대개 한 순간이라 글자 하나면 충분하다 —
     자바스크립트가 꺼져 있는 사람에게만 이 줄이 오래 남는다. */
  .w{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
  a{color:#E2A25C}
</style>
</head><body>
<div class="w"><div>
  사무실을 여는 중…
  <noscript><br><br><a href="./android/index.html">안드로이드</a> ·
    <a href="./iphone/index.html">아이폰</a></noscript>
</div></div>
<script>
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  location.replace(ios ? './iphone/index.html' : './android/index.html');
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
