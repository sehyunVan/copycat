# auth-email — 메일을 보내는 길

Supabase Auth 가 메일을 보낼 때가 되면 **SMTP 대신 이 함수를 HTTPS 로 부른다**
(Send Email Hook). 여기서 Resend 의 HTTP API 로 보낸다.

## 왜 SMTP 를 버렸나

2026-09-03~04, 보내는 경로가 **전부** 500 을 냈다.

    POST /auth/v1/otp     → 500  "Error sending confirmation email"
    POST /auth/v1/signup  → 500  같은 오류
    error_id  01a06a2a-47b9-79c2-bc9c-d6e5c70262c7

며칠에 걸쳐 하나씩 지웠다 — 템플릿도 아니고(회원가입과 매직링크가 같이 죽는다),
DNS 도 아니고(DKIM·SPF 둘 다 밖에서 보이고 도메인은 verified), 설정값을 다시
밟아도 그대로였다.

**남은 단서 하나가 방향을 정했다**: Resend 의 `Emails`/`Logs` 에 **시도 자체가
안 남는다.** 메일이 거절당한 것이 아니라 말을 걸지도 못한 것이다. 그 구간
— Supabase 의 auth 컨테이너에서 `smtp.resend.com` 까지 — 은 대시보드 밖에서
손댈 수 있는 것이 하나도 없다. 로그를 볼 수도, 포트를 바꿀 수도, 재시도를
붙일 수도 없다. **고칠 수 없는 자리에서 며칠을 더 쓰는 대신 그 자리를 없앴다.**

HTTPS 는 그 프로젝트에서 이미 도는 것이 증명돼 있다 — `parcel-purchase` 가
같은 방식으로 왕복 10/10 을 통과한다. 25/465/587 이 통하든 말든 상관이 없어진다.

> SMTP 를 되살리고 싶어지면 그때 이 훅을 끄면 된다. 두 길은 배타적이다 —
> 훅이 켜져 있는 동안 커스텀 SMTP 는 이 경로에 안 쓰인다.

## 어떻게 생겼나

    index.ts       받아서 · 확인하고 · Resend 에 던진다. 그게 전부다
    mail.js        조립 규칙 — 서명 검사 · 주소 만들기 · 본문 고르기 (순수 함수)
    templates.js   자동 생성. 원본은 ../../emails/*.html

`mail.js` 가 `.ts` 가 아닌 이유: **노트북에서 그대로 돌려 보려고.** Deno 도 Node 도
같은 파일을 읽는다(웹 표준만 쓴다). 덕분에 서버 없이 29 가지를 본다 —

    node spike/verify-email.js

이 길의 사고는 전부 조용하다. 서명을 헐겁게 보면 아무나 우리 이름으로 메일을
뿌리고, 주소를 한 글자 잘못 만들면 링크는 오는데 눌러도 안 들어와진다.
둘 다 「보냈습니다」까지는 똑같이 보인다.

## 켜는 절차

1. 본문을 굽는다 — `node tools/bake-emails.js`

2. Resend 에서 **API 키**를 만든다 (Full access 또는 `copycat.sarl` Sending access).
   `re_` 로 시작한다.

3. 대시보드 → **Authentication → Hooks → Send Email Hook** → `HTTPS` 로 켜고

       URL  https://uezoijircckenbvqgokp.supabase.co/functions/v1/auth-email

   저장하면 **비밀 문자열**을 준다 (`v1,whsec_…`). 그 값을 그대로 복사한다.

4. 비밀 셋을 넣는다.

       supabase secrets set RESEND_API_KEY=re_...
       supabase secrets set SEND_EMAIL_HOOK_SECRET=v1,whsec_...
       supabase secrets set MAIL_FROM="Copycat <noreply@copycat.sarl>"

   `MAIL_FROM` 의 도메인은 Resend 에서 **verified 인 그 도메인**이어야 한다.
   아니면 Resend 가 403 을 낸다 — 이번엔 로그에 남는다.

5. 올린다.

       supabase functions deploy auth-email --no-verify-jwt

   `--no-verify-jwt` 인 이유: 부르는 쪽이 사람이 아니라 Auth 서버이고 JWT 를
   들고 오지 않는다. 문은 3번의 비밀이 지킨다.

6. 게임에서 이메일로 로그인해 본다. 안 오면 **함수 로그**를 본다 —
   대시보드 → Edge Functions → `auth-email` → Logs. 이제 진짜 문장이 남는다.
   그게 이 갈아엎기로 얻은 것이다.

## 함께 볼 것 — 메일이 안 와 보이는 다른 이유

- **Auth → Rate Limits → 「Rate limit for sending emails」.** 기본값이 낮다.
  넘으면 `over_email_send_rate_limit` 이 뜨고, 화면에서는 그냥 안 오는 것과
  같아 보인다. 시험하다 보면 금방 걸린다.
- **Auth → URL Configuration → Redirect URLs.** `https://copycat.sarl/**` ·
  `https://localhost/**` · `capacitor://localhost/**` 가 있어야 한다.
  없으면 **링크는 오는데 눌러도 안 들어와진다** — 메일 문제로 보이지만 아니다.
