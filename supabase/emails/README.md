# 메일 본문

이 세 장이 **원본**이다. 브라우저로 열어 보면서 고친다.
저장소에 두는 이유는 하나다 — 대시보드 안에만 있으면 **아무도 못 읽고 아무도 못 고친다.**

> **보내는 길이 바뀌었다.** 이제 대시보드의 템플릿 칸이 아니라
> `supabase/functions/auth-email` 이 이 파일들을 들고 보낸다. 고친 뒤에는
> `node tools/bake-emails.js` → 함수 재배포. 아래 「누가 보내나」를 볼 것.

| 파일 | Auth 가 부르는 이름 | 제목 | 언제 나가나 |
|---|---|---|---|
| `magic.html` | `magiclink` · `recovery` | 사무실 문 열쇠 | 이미 계정이 있는 사람이 이메일로 들어올 때 (`signInWithOtp`) |
| `confirm.html` | `signup` · `invite` | 이 주소로 사무실을 묶습니다 | 익명으로 놀던 사람이 이메일을 붙일 때 (`updateUser({email})`) |
| `change.html` | `email_change*` | 새 주소로 바꿉니다 | 붙여 둔 주소를 바꿀 때 |

이 표의 짝은 코드에도 그대로 있다 — `supabase/functions/auth-email/mail.js` 의
`LETTERS`. 둘이 갈라지면 그때부터 아무도 어느 쪽이 진짜인지 모르므로,
`spike/verify-email.js` 가 세 줄을 못 박아 두었다.

## 누가 보내나

`supabase/functions/auth-email` 이다. 대시보드의 템플릿 칸이 아니다.

Supabase 의 기본 경로(SMTP)가 Resend 에 **말을 걸지도 못한 채** 500 을 냈고,
그 구간은 대시보드 밖에서 손댈 것이 하나도 없었다. 그래서 SMTP 를 안 쓴다 —
Auth 가 메일을 보낼 때가 되면 HTTPS 로 함수를 부르고, 함수가 Resend 의 HTTP
API 로 보낸다. 내력과 켜는 절차는 [`../functions/auth-email/README.md`](../functions/auth-email/README.md).

본문을 고쳤으면 **두 걸음**이다:

    node tools/bake-emails.js
    supabase functions deploy auth-email --no-verify-jwt

굽기를 잊으면 배포된 메일만 옛 문장을 말한다. 그건 아무도 눈치 못 채므로
`spike/verify-email.js` 가 대신 잡는다.

## 왜 이렇게 짧은가

메일은 **읽는 물건이 아니라 누르는 물건**이다. 안내를 늘리면 단추가 밀려 내려가고,
스팸함에서 건져 온 사람은 그 안내를 안 읽는다. 한 줄과 단추 하나가 전부다.

## 손대면 안 되는 것

`{{ .ConfirmationURL }}` — Supabase 가 채운다. 지우면 **아무도 못 들어온다.**

## 링크가 어디로 돌아오나

게임이 `emailRedirectTo` 로 지금 열려 있는 주소를 준다(js/cloud.js). 그래서 이 메일은
웹에서 눌렀으면 웹으로, 앱에서 시작했으면 앱으로 돌아온다 — 메일 안에 주소를 적어
두지 않는 이유다. 적어 두면 앱에서 시작한 사람이 웹으로 떨어진다.

Supabase → Authentication → URL Configuration 의 **Redirect URLs** 에 그 주소들이
등록돼 있어야 한다(`https://copycat.sarl/**` · `https://localhost/**` ·
`capacitor://localhost/**`). 없으면 링크는 오는데 눌러도 안 들어와진다.
