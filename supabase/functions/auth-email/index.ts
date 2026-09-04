/* ============================================================
   auth-email — Supabase 가 보내지 못하는 메일을 대신 보낸다

   ── 왜 있나 ──
   Supabase 의 기본 경로는 **SMTP** 다. 프로젝트가 Resend 로 SMTP 를 물려 놨는데
   `/auth/v1/otp` 와 `/auth/v1/signup` 이 둘 다 500 을 냈고(`Error sending
   confirmation email`), Resend 쪽 `Emails`/`Logs` 에는 **시도조차 안 남았다.**
   메일이 거절당한 게 아니라 **말을 걸지도 못한 것**이다 — 그 구간은 대시보드
   밖에서 손댈 방법이 없다.

   그래서 SMTP 를 안 쓴다. Supabase Auth 의 **Send Email Hook** 은 메일을 보낼
   때가 되면 SMTP 대신 이 주소를 HTTPS 로 부른다. 여기서 Resend 의 HTTP API 로
   보낸다. 25/465/587 이 통하든 말든 상관이 없어진다.

   ── 이 함수가 안 하는 것 ──
   본문을 짓지 않는다(`supabase/emails/*.html` 이 원본이고 `templates.js` 로
   굽는다). 판단도 거의 안 한다 — 조립은 `mail.js` 에 있고 여기 남은 것은
   「받아서 · 확인하고 · 던지는」 세 줄이다. 이렇게 갈라 둔 덕에 조립 규칙은
   서버 없이 노트북에서 본다: `node spike/verify-email.js`.

   ── 배포 ──
     node tools/bake-emails.js
     supabase functions deploy auth-email --no-verify-jwt
     supabase secrets set RESEND_API_KEY=re_...
     supabase secrets set SEND_EMAIL_HOOK_SECRET=v1,whsec_...   ← 대시보드가 준 값 그대로
     supabase secrets set MAIL_FROM="Copycat <noreply@copycat.sarl>"

   그리고 대시보드 → Authentication → Hooks → **Send Email Hook** 을
     HTTPS  https://<프로젝트>.supabase.co/functions/v1/auth-email
   로 켠다. 켜는 순간부터 커스텀 SMTP 는 이 길에 안 쓰인다.

   `--no-verify-jwt` 인 이유: 부르는 쪽은 사람이 아니라 Auth 서버이고 JWT 를
   들고 오지 않는다. 문은 위의 webhook 비밀이 지킨다(parcel-purchase 와 같은 꼴).
   ============================================================ */
import { compose, verify } from './mail.js';

const RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '';
const FROM   = Deno.env.get('MAIL_FROM') ?? 'Copycat <noreply@copycat.sarl>';
/* 링크의 `/auth/v1/verify` 가 사는 곳. 엣지 함수에는 SUPABASE_URL 이 이미 들어 있다. */
const BASE   = Deno.env.get('AUTH_VERIFY_BASE') ?? Deno.env.get('SUPABASE_URL') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  /* 서명은 **글자 그대로의 본문**에 걸려 있다. 여기서 JSON 으로 풀었다가 다시
     문자열로 만들면 공백 하나가 달라져서 영영 안 맞는다. */
  const raw = await req.text();

  if (!SECRET || !RESEND){
    /* 비밀이 없으면 문을 열어 두는 대신 **큰 소리로** 죽는다. 조용히 200 을
       주면 Auth 는 보냈다고 믿고, 아무한테도 메일이 안 간다. */
    console.error('auth-email: RESEND_API_KEY / SEND_EMAIL_HOOK_SECRET 이 비었다');
    return fail('메일 설정이 비어 있습니다', 500);
  }

  const v = await verify(SECRET, req.headers, raw);
  if (!v.ok){
    console.error('auth-email: 서명이 안 맞는다 —', v.why);
    return new Response('no', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); }
  catch { return fail('본문을 못 읽었습니다', 400); }

  const mail = compose(payload, { from: FROM, verifyBase: BASE });
  if ((mail as any).error){
    console.error('auth-email: 조립 실패 —', (mail as any).error);
    return fail((mail as any).error, 400);
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mail),
  });
  const text = await r.text();

  if (!r.ok){
    /* Auth 에 실패를 **그대로 돌려준다.** 여기서 삼키면 게임 화면은 「보냈습니다」를
       띄우고 사람은 오지 않는 메일을 기다린다. 지금 고치려는 것이 바로 그 상황이다. */
    console.error('auth-email: resend', r.status, text.slice(0, 300));
    return fail(`메일을 보내지 못했습니다 (${r.status})`, 500);
  }

  return json({}, 200);
});

/* Auth 가 알아듣는 실패 모양은 정해져 있다 — `{ error: { http_code, message } }`.
   여기서 message 를 채워 두면 게임 화면에 그 문장이 그대로 뜬다. */
function json(body: unknown, status: number){
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
function fail(message: string, status: number){
  return json({ error: { http_code: status, message } }, status);
}
