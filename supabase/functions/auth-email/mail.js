/* ============================================================
   mail.js — 메일 한 통을 조립하는 규칙. **네트워크를 안 탄다.**

   이 파일이 index.ts 와 갈라져 있는 이유는 하나다: 여기 있는 것은 전부
   순수 함수라 **노트북에서 그대로 돌려 볼 수 있다**(spike/verify-email.js).
   서명·주소 조립·본문 고르기는 틀려도 조용한 종류라, 배포한 뒤 메일함을
   들여다보며 고칠 일이 아니다.

   Deno 와 Node 가 같은 파일을 읽는다 — 타입도 import 도 웹 표준만 쓴다.
   ============================================================ */
import { TEMPLATES } from './templates.js';

/* ── 1. 보낸 사람이 Supabase 가 맞는가 ─────────────────────────────────

   Standard Webhooks 규격이다. 대시보드가 주는 비밀은 `v1,whsec_<base64>`
   모양이고, 서명은 `${id}.${timestamp}.${본문}` 을 HMAC-SHA256 한 값이다.

   본문을 **문자열 그대로** 받아야 한다. JSON.parse 를 거친 뒤 다시 stringify
   하면 공백 하나가 달라지고, 그 순간 서명은 영원히 안 맞는다. */
export function secretKey(raw){
  const s = String(raw || '').trim();
  const b64 = s.startsWith('v1,') ? s.slice(3) : s;
  const bare = b64.startsWith('whsec_') ? b64.slice(6) : b64;
  const bin = atob(bare);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* 시계가 5분 넘게 어긋나면 거절한다. 오래된 요청을 녹음해 두었다가 다시
   보내는 짓을 막는 유일한 장치다 — 서명만 봐서는 어제 것과 지금 것이 같다. */
export const SKEW_S = 5 * 60;

export async function verify(secret, headers, rawBody, now){
  const id   = headers.get('webhook-id') || '';
  const ts   = headers.get('webhook-timestamp') || '';
  const sigs = headers.get('webhook-signature') || '';
  if (!id || !ts || !sigs) return { ok: false, why: 'no-headers' };

  const t = Number(ts);
  if (!Number.isFinite(t)) return { ok: false, why: 'bad-timestamp' };
  const nowS = Math.floor((now === undefined ? Date.now() : now) / 1000);
  if (Math.abs(nowS - t) > SKEW_S) return { ok: false, why: 'stale' };

  const key = await crypto.subtle.importKey(
    'raw', secretKey(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${id}.${ts}.${rawBody}`));
  const want = btoa(String.fromCharCode(...new Uint8Array(mac)));

  /* 헤더에는 서명이 여러 개 올 수 있다(비밀을 갈아 끼우는 중이면 둘). */
  for (const part of sigs.split(' ')){
    const got = part.includes(',') ? part.split(',')[1] : part;
    if (eq(got, want)) return { ok: true };
  }
  return { ok: false, why: 'bad-signature' };
}

/* 길이와 내용이 같은지를 **끝까지 다 보고** 답한다. 먼저 틀린 자리에서
   빠져나오면 답하는 데 걸린 시간이 「몇 글자까지 맞았는지」를 알려 준다. */
function eq(a, b){
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ── 2. 어느 본문을 어떤 제목으로 ──────────────────────────────────────

   Supabase 가 주는 email_action_type 을 저장소의 세 장에 맞춘다.
   README 의 표와 같은 말을 해야 한다 — 둘이 갈라지면 그때부터 아무도
   어느 쪽이 진짜인지 모른다. */
const LETTERS = {
  magiclink:          { t: 'magic',   subject: '사무실 문 열쇠' },
  signup:             { t: 'confirm', subject: '이 주소로 사무실을 묶습니다' },
  invite:             { t: 'confirm', subject: '이 주소로 사무실을 묶습니다' },
  email_change:       { t: 'change',  subject: '새 주소로 바꿉니다' },
  email_change_new:   { t: 'change',  subject: '새 주소로 바꿉니다' },
  email_change_current:{ t: 'change', subject: '새 주소로 바꿉니다' },
  recovery:           { t: 'magic',   subject: '사무실 문 열쇠' },
};

export function letterFor(action){
  return LETTERS[String(action || '')] || null;
}

/* ── 3. 눌렀을 때 어디로 가는가 ────────────────────────────────────────

   `/auth/v1/verify` 는 **Supabase 프로젝트 주소**에 있다. copycat.sarl 에는
   그런 문이 없다 — site_url 을 여기 쓰면 링크는 오는데 눌러도 404 다.
   돌아갈 곳(redirect_to)만 게임이 준 주소이고, 그건 게임이 지금 열려 있는
   자리다(웹이면 웹, 앱이면 앱 — supabase/emails/README.md).

   token_hash 를 쓴다. token(여섯 자리)은 사람이 받아 치는 용도고, 링크에
   박는 것은 해시 쪽이다. */
export function confirmURL(base, d){
  const u = new URL('/auth/v1/verify', base);
  u.searchParams.set('token', d.token_hash || '');
  u.searchParams.set('type', d.email_action_type || '');
  const back = d.redirect_to || d.site_url || '';
  if (back) u.searchParams.set('redirect_to', back);
  return u.toString();
}

/* ── 4. 한 통 ──────────────────────────────────────────────────────── */
export function compose(payload, opts){
  const user = (payload && payload.user) || {};
  const d    = (payload && payload.email_data) || {};

  const letter = letterFor(d.email_action_type);
  if (!letter) return { error: `모르는 종류: ${d.email_action_type}` };

  /* 주소를 바꿀 때는 **새 주소로** 간다 — 옛 주소로 보내면 새 주소가 정말
     그 사람 것인지 확인이 안 된다.

     `email_change_current` 만 예외다. 「양쪽 다 확인」을 켜면 두 통이 나가는데,
     그중 옛 주소로 가는 한 통이 이것이다 — 남이 내 계정의 주소를 몰래 바꾸는
     것을 옛 주인이 알아채는 자리라, 여기까지 새 주소로 보내면 장치가 통째로
     의미를 잃는다. */
  const wantsNew = d.email_action_type === 'email_change_new'
                || d.email_action_type === 'email_change';
  const to = (wantsNew && user.new_email)
    ? user.new_email : (user.email || user.new_email || '');
  if (!to) return { error: '받을 주소가 없다' };

  const html = TEMPLATES[letter.t];
  if (!html) return { error: `본문이 없다: ${letter.t}` };

  const url = confirmURL(opts.verifyBase, d);
  return {
    from: opts.from,
    to: [to],
    subject: letter.subject,
    html: html.split('{{ .ConfirmationURL }}').join(esc(url)),
  };
}

/* 주소는 href 안에 들어간다. token_hash 는 우리가 만든 값이 아니라 받은
   값이라, 따옴표 하나가 섞이면 단추가 통째로 깨진다. */
function esc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
