# copycat/site/pay — PayPal 직접 결제

랜딩페이지에서 PayPal로 직접 받고, 결제가 확인되면 게임 zip 다운로드 링크를 내주는 백엔드.
Cloudflare Worker 한 개 + PayPal Orders v2.

```
브라우저                    Worker                      PayPal
   │  productId ─────────────▶│                            │
   │                          │─ 주문 생성 (금액은 서버) ──▶│
   │◀───────── orderID ───────│◀───────── id ──────────────│
   │                                                       │
   │────────── 사용자가 PayPal 창에서 승인 ─────────────────▶│
   │                                                       │
   │  capture(orderID) ──────▶│─ 캡처 + 금액·통화 대조 ───▶│
   │◀─ 서명된 다운로드 링크 ───│                            │
```

## 먼저 알아야 할 두 가지 — 둘 다 한국 판매자에게 치명적이다

**1. PayPal은 KRW를 거래 통화로 지원하지 않는다.**
그래서 청구는 **USD**로 한다. 페이지에는 `$4.99`를 띄우고 `약 ₩6,900`을 참고로 병기했다.
KRW로 청구하려면 PayPal이 아니라 국내 PG(토스페이먼츠·나이스페이 등)나
MoR(Lemon Squeezy·Paddle)을 써야 한다.

**2. PayPal은 한국 계정 ↔ 한국 계정 결제를 처리하지 않는다.**
한국에 등록된 PayPal 계정끼리는 결제를 주고받을 수 없다. 즉 **한국 구매자가 한국 판매자에게
PayPal로 결제하는 경로가 막혀 있다.** 해외 카드나 해외 계정은 된다.

이게 무슨 뜻이냐 — 페이지는 한국어이고 타깃은 한국 직장인인데, **PayPal만 붙이면
주 고객층이 결제를 못 한다.** 그래서 구매 박스는 PayPal과 itch.io를 나란히 두고,
국내 결제는 itch.io로 안내한다. 국내 직접 결제까지 원하면 아래 "국내 결제" 절을 본다.

## 설정 순서

### 1. PayPal 앱 만들기

[developer.paypal.com/dashboard](https://developer.paypal.com/dashboard) → Apps & Credentials.
**Sandbox 탭에서 시작한다.** Client ID(공개값)와 Secret(비밀값)을 받는다.
실서비스로 넘어갈 때 Live 탭에서 같은 걸 다시 발급받고 `PAYPAL_ENV`를 `live`로 바꾼다.

Live 자격증명을 받으려면 **PayPal 비즈니스 계정**이 필요하다.

### 2. Cloudflare 리소스 만들기

```bash
npm install -g wrangler
wrangler login

wrangler kv namespace create ORDERS      # 출력된 id 를 wrangler.toml 에 붙인다
wrangler r2 bucket create copycat-builds
```

판매할 zip을 올린다. **키 이름이 `worker.js`의 `PRODUCTS[].r2Key`와 같아야 한다.**

```bash
wrangler r2 object put copycat-builds/copycat-full.zip --file=./copycat-1.0.zip
```

> ⚠️ 이 zip 을 만들기 전에 [../SELLING.md](../SELLING.md) 0단계를 반드시 읽는다.
> 유료 타일셋 원본을 그대로 넣으면 라이선스 위반 소지가 있다.

### 3. 시크릿 넣기

```bash
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put DOWNLOAD_SECRET      # openssl rand -hex 32
wrangler secret put PAYPAL_WEBHOOK_ID    # 5단계에서 받은 값
```

`DOWNLOAD_SECRET`이 새면 **누구나 유효한 다운로드 링크를 만들 수 있다.** 저장소에 넣지 않는다.

### 4. 배포

```bash
wrangler deploy
curl https://copycat-pay.<계정>.workers.dev/api/health
# {"ok":true,"env":"sandbox","products":["copycat-full"]}
```

`wrangler.toml`의 `ALLOWED_ORIGINS`를 실제 사이트 주소로, `PUBLIC_BASE_URL`을 Worker 주소로
바꾼 뒤 다시 배포한다.

### 5. 웹훅 등록 (선택이지만 권장)

PayPal 대시보드 → 앱 → Webhooks → Add.
URL은 `https://<worker>/api/paypal/webhook`, 이벤트는 **`PAYMENT.CAPTURE.COMPLETED`**.
발급된 Webhook ID를 `PAYPAL_WEBHOOK_ID` 시크릿에 넣는다.

없어도 결제는 되지만, **결제 직후 브라우저가 닫히면 주문이 기록되지 않아** 구매자가
"링크 재발급"으로도 못 찾는다. 웹훅이 그 구멍을 막는다.

### 6. 프론트엔드 연결

`../index.html`은 두 전역값을 읽는다. 페이지에 이 한 줄을 추가하면 결제 버튼이 살아난다.

```html
<script>
  window.COPYCAT_PAY_API   = 'https://copycat-pay.<계정>.workers.dev';
  window.COPYCAT_PAYPAL_ID = '<PayPal Client ID>';
</script>
```

둘 중 하나라도 없으면 페이지는 **조용히 itch.io 버튼으로 폴백한다.** 빈 자리를 남기지 않는다.

### 7. 샌드박스로 실제 구매해 보기

[Sandbox accounts](https://developer.paypal.com/dashboard/accounts)에서 개인 테스트 계정을
만들고 그 계정으로 결제한다. 확인할 것:

- [ ] 결제 완료 후 다운로드 링크가 나오고 zip이 정상으로 받아진다
- [ ] 같은 링크를 6번 쓰면 `download_limit_reached`
- [ ] 결제 취소 시 안내가 뜨고 링크는 안 나온다
- [ ] "링크를 잃어버렸어요"에 결제한 이메일을 넣으면 재발급된다
- [ ] KV에 `order:<id>` 기록이 남는다 (`wrangler kv key list --binding ORDERS`)

## 로컬 개발

```bash
cp .dev.vars.example .dev.vars   # 값을 채운다
wrangler dev
node --test                      # 결제 검증 로직 테스트 14개
```

## 설계 — 왜 이렇게 했나

**가격은 서버에만 있다.** 클라이언트는 `productId`만 보낸다. 브라우저가 금액을 정하게 두면
개발자 도구로 `$0.01`이 된다. `worker.js`의 `PRODUCTS`가 유일한 원본이고, 페이지의 `$4.99`는
표시용 문자열일 뿐이다. **가격을 바꿀 때는 둘 다 바꿔야 한다.**

**캡처 응답을 그대로 믿지 않는다.** 캡처 후 금액·통화·상태를 상품 정의와 대조하고,
통과한 것만 다운로드를 받는다. 통화 검증이 없으면 `4.99 JPY`(약 ₩45)로 살 수 있다 —
테스트에 그 케이스가 있다.

**다운로드 링크는 HMAC 서명 + 만료 + 횟수 제한이다.** `base64url(orderId|productId|exp).base64url(sig)`
형태라 서버가 상태를 안 들고도 검증된다. 추측이 불가능하고, 유출돼도 72시간·5회로 손해가 갇힌다.
서명 비교는 상수시간이다.

**중복 캡처를 막는다.** 캡처에 `PayPal-Request-Id`를 붙이고, 이미 `COMPLETED`인 주문은
결제를 다시 긁지 않고 링크만 재발급한다. 네트워크 재시도로 이중 청구가 나지 않는다.

**웹훅은 PayPal에 서명 검증을 위임한다.** `verify-webhook-signature`가 `SUCCESS`가 아니면
버린다. 검증 없이 신뢰하면 누구나 "결제 완료" 이벤트를 위조해 게임을 받아 간다.

**실패해도 구매자를 막지 않는다.** 캡처는 성공했는데 응답이 유실된 경우에도 대금은 안전하고,
주문번호와 이메일 양쪽으로 복구 경로가 있다. 결제 UI가 아예 안 뜨면 itch.io로 폴백한다.

## 직접 판매를 시작하면 생기는 의무

플랫폼(itch.io)을 쓸 때는 플랫폼이 판매자였다. 직접 받으면 **내가 판매자**가 된다.

- **통신판매업 신고** — 이제 대상이다. 단 직전연도 거래 50회 미만이거나 간이과세자면 면제
- **전자상거래법 표시 의무** — 상호·대표자명·사업자등록번호·주소·연락처를 페이지에 표기해야
  한다. `index.html` 푸터에 자리를 주석으로 남겨 뒀다
- **청약철회 고지** — 디지털 콘텐츠는 제한할 수 있지만 **사전 고지가 조건**이다.
  구매 박스에 환불 정책을 명시해 뒀으니 문구만 확정하면 된다
- **부가세·소득세** — 해외 매출은 영세율 적용이 가능하다(증빙 필요)

자세한 건 [../SELLING.md](../SELLING.md) 4단계.

## 국내 결제까지 원한다면

PayPal로는 한국 구매자를 받을 수 없으니 선택지는 셋이다.

| | 국내 카드 | KRW | 수수료 | 사업자등록 |
|---|---|---|---|---|
| **itch.io** | ✅ (플랫폼이 처리) | 환산 | 내가 정한 %+ 결제 | 불필요 |
| **Lemon Squeezy / Paddle** (MoR) | ✅ | ✅ | 5% + 결제 | 불필요 (MoR이 판매자) |
| **토스페이먼츠 등 국내 PG** | ✅ | ✅ | 약 2~3% | **필요** (심사 있음) |

**MoR(Merchant of Record)이 현실적인 답이다.** 판매자·세금·환불을 대신 지므로 사업자등록 없이
전 세계에 KRW로 팔 수 있다. 수수료는 PG보다 비싸지만 이 규모에서는 그 차액이 사업자등록·
세무·환불 응대 비용보다 싸다. 지금 구조는 그대로 두고 `PRODUCTS`만 공유하면 붙는다.

## 참고

- [PayPal Orders v2](https://developer.paypal.com/docs/api/orders/v2/) ·
  [표준 결제 통합](https://developer.paypal.com/docs/checkout/standard/integrate/) ·
  [웹훅 서명 검증](https://developer.paypal.com/api/rest/webhooks/rest/) ·
  [지원 통화](https://developer.paypal.com/docs/reports/reference/paypal-supported-currencies/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) ·
  [KV](https://developers.cloudflare.com/kv/) · [R2](https://developers.cloudflare.com/r2/)
