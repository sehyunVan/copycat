/* 메일 한 통이 제대로 조립되는가. **서버도 계정도 안 쓴다** — 엣지 함수의
   조립 규칙(supabase/functions/auth-email/mail.js)을 그대로 불러서 본다.

     node spike/verify-email.js

   왜 이걸 자동으로 봐야 하나: 이 길의 사고는 전부 조용하다. 서명을 헐겁게
   확인하면 아무나 우리 이름으로 메일을 뿌릴 수 있고, 주소를 한 글자 잘못
   만들면 링크는 오는데 눌러도 안 들어와진다. 둘 다 「보냈습니다」까지는
   똑같이 보인다.

   굽는 것도 여기서 같이 본다 — 본문을 고치고 `node tools/bake-emails.js` 를
   안 돌리면 배포된 메일만 옛 문장을 말한다. 그건 아무도 눈치 못 챈다. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FN   = path.join(ROOT, 'supabase', 'functions', 'auth-email');

const rows = []; const ok = (n, p, note) => rows.push({ name: n, pass: !!p, note });

/* 대시보드가 주는 모양 그대로의 가짜 비밀. */
const RAWKEY = crypto.randomBytes(24);
const SECRET = 'v1,whsec_' + RAWKEY.toString('base64');

function sign(id, ts, body, key){
  return crypto.createHmac('sha256', key === undefined ? RAWKEY : key)
               .update(id + '.' + ts + '.' + body).digest('base64');
}
/* fetch 의 Headers 를 그대로 쓴다 — 함수가 실제로 받는 물건과 같아야 한다. */
function hdrs(id, ts, sig){
  const h = new Headers();
  if (id)  h.set('webhook-id', id);
  if (ts)  h.set('webhook-timestamp', String(ts));
  if (sig) h.set('webhook-signature', 'v1,' + sig);
  return h;
}

const BASEPAY = {
  user: { id: 'u-1', email: 'nabi@example.com' },
  email_data: {
    token: '123456',
    token_hash: 'hash-abc',
    redirect_to: 'https://copycat.sarl/',
    email_action_type: 'magiclink',
    site_url: 'https://copycat.sarl',
  },
};
const pay = () => JSON.parse(JSON.stringify(BASEPAY));

const OPTS = { from: 'Copycat <noreply@copycat.sarl>',
               verifyBase: 'https://uezoijircckenbvqgokp.supabase.co' };

(async () => {
const M = await import('file://' + path.join(FN, 'mail.js').replace(/\\/g, '/'));

/* ── 1. 서명 ─────────────────────────────────────────────────────────── */
const now = Date.now(), ts = Math.floor(now / 1000), body = JSON.stringify(BASEPAY);

const good = await M.verify(SECRET, hdrs('msg_1', ts, sign('msg_1', ts, body)), body, now);
ok('바른 서명을 통과시킨다', good.ok, good.why || '');

const bad = await M.verify(SECRET, hdrs('msg_1', ts, sign('msg_1', ts, body + ' ')), body, now);
ok('**본문이 한 글자라도 다르면 거절한다**', !bad.ok, bad.why);

const other = await M.verify(SECRET, hdrs('msg_1', ts, sign('msg_1', ts, body, crypto.randomBytes(24))), body, now);
ok('**남의 열쇠로 서명한 것을 거절한다**', !other.ok, other.why);

const swap = await M.verify(SECRET, hdrs('msg_2', ts, sign('msg_1', ts, body)), body, now);
ok('id 를 바꿔치기하면 거절한다', !swap.ok, swap.why);

const old = ts - (M.SKEW_S + 60);
const stale = await M.verify(SECRET, hdrs('msg_1', old, sign('msg_1', old, body)), body, now);
ok('**낡은 요청을 다시 보내면 거절한다**', !stale.ok && stale.why === 'stale', stale.why);

const naked = await M.verify(SECRET, hdrs('', '', ''), body, now);
ok('헤더가 없으면 거절한다', !naked.ok, naked.why);

/* 비밀을 갈아 끼우는 중에는 서명이 둘 온다 — 하나만 맞아도 통과해야 한다. */
const two = new Headers();
two.set('webhook-id', 'msg_1'); two.set('webhook-timestamp', String(ts));
two.set('webhook-signature',
  'v1,' + sign('msg_1', ts, body, crypto.randomBytes(24)) + ' v1,' + sign('msg_1', ts, body));
ok('서명이 여러 개면 하나만 맞아도 통과', (await M.verify(SECRET, two, body, now)).ok);

/* ── 2. 눌렀을 때 어디로 가나 ────────────────────────────────────────── */
const m = M.compose(pay(), OPTS);
ok('한 통이 조립된다', !m.error, m.error || (m.subject + ' → ' + m.to));

const href = (m.html.match(/href="(https:\/\/uezo[^"]*verify[^"]*)"/) || [])[1] || '';
const u = href ? new URL(href.replace(/&amp;/g, '&')) : null;
ok('**단추가 Supabase 의 verify 로 간다**',
   u && u.origin === OPTS.verifyBase && u.pathname === '/auth/v1/verify',
   u ? u.origin + u.pathname : '못 찾음');
ok('링크에 token_hash 가 실린다', u && u.searchParams.get('token') === 'hash-abc',
   u && u.searchParams.get('token'));
ok('링크에 종류가 실린다', u && u.searchParams.get('type') === 'magiclink',
   u && u.searchParams.get('type'));
ok('**게임이 준 자리로 돌아온다**', u && u.searchParams.get('redirect_to') === 'https://copycat.sarl/',
   u && u.searchParams.get('redirect_to'));

/* 앱에서 시작했으면 앱으로 — 메일 안에 주소를 안 적는 이유가 이것이다. */
const appP = pay(); appP.email_data.redirect_to = 'capacitor://localhost/';
const app = M.compose(appP, OPTS);
ok('앱에서 시작했으면 앱으로 돌아온다', app.html.includes('capacitor%3A%2F%2Flocalhost%2F'),
   (app.html.match(/redirect_to=[^"&]*/) || [''])[0]);

/* redirect_to 가 비면 site_url 로. 빈손으로 두면 아무 데도 안 간다. */
const backP = pay(); backP.email_data.redirect_to = '';
ok('돌아갈 곳이 비면 site_url 로',
   M.compose(backP, OPTS).html.includes('redirect_to=https%3A%2F%2Fcopycat.sarl'));

/* ── 3. 어느 본문이 나가나 ───────────────────────────────────────────── */
const WANT = [
  ['magiclink',        '사무실 문 열쇠',             '들어가기'],
  ['signup',           '이 주소로 사무실을 묶습니다', '묶기'],
  ['email_change_new', '새 주소로 바꿉니다',          '바꾸기'],
];
for (const w of WANT){
  const p = pay();
  p.email_data.email_action_type = w[0];
  if (w[0] === 'email_change_new') p.user.new_email = 'new@example.com';
  const r = M.compose(p, OPTS);
  ok(w[0] + ' → ' + w[1],
     !r.error && r.subject === w[1] && r.html.includes('>' + w[2] + '<'),
     r.error || r.subject);
}

const ch = pay();
ch.email_data.email_action_type = 'email_change_new';
ch.user.new_email = 'new@example.com';
ok('**주소를 바꿀 때는 새 주소로 간다**', M.compose(ch, OPTS).to[0] === 'new@example.com',
   M.compose(ch, OPTS).to[0]);

const one = pay();
one.email_data.email_action_type = 'email_change';
one.user.new_email = 'new@example.com';
ok('한 통짜리 주소 변경도 새 주소로 간다', M.compose(one, OPTS).to[0] === 'new@example.com',
   M.compose(one, OPTS).to[0]);

/* 「양쪽 다 확인」의 옛 주소 쪽. 여기까지 새 주소로 보내면 남이 내 주소를 몰래
   바꿔도 옛 주인이 못 알아챈다 — 그 장치가 통째로 의미를 잃는다. */
const cur = pay();
cur.email_data.email_action_type = 'email_change_current';
cur.user.new_email = 'new@example.com';
ok('**옛 주소에 알리는 한 통은 옛 주소로 간다**', M.compose(cur, OPTS).to[0] === 'nabi@example.com',
   M.compose(cur, OPTS).to[0]);

const un = pay(); un.email_data.email_action_type = 'reauthentication';
ok('모르는 종류는 조용히 보내지 않는다', !!M.compose(un, OPTS).error, M.compose(un, OPTS).error);

const no = pay(); no.user = {};
ok('받을 주소가 없으면 안 보낸다', !!M.compose(no, OPTS).error, M.compose(no, OPTS).error);

/* ── 4. 본문이 원본과 같은가 ─────────────────────────────────────────── */
const TPL = path.join(FN, 'templates.js');
const before = fs.readFileSync(TPL, 'utf8');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'bake-emails.js')], { stdio: 'ignore' });
const after = fs.readFileSync(TPL, 'utf8');
ok('**구운 본문이 supabase/emails 와 같다**', before === after,
   before === after ? '' : 'node tools/bake-emails.js 를 안 돌렸다');

ok('본문에 {{ }} 가 안 남는다', !m.html.includes('{{'),
   (m.html.match(/\{\{[^}]*\}\}/) || [''])[0]);
ok('개인정보처리방침 링크가 남아 있다', m.html.includes('copycat.sarl/privacy.html'));

/* ── 5. index.ts 가 이 규칙을 실제로 쓰는가 ──────────────────────────── */
const idx = fs.readFileSync(path.join(FN, 'index.ts'), 'utf8');
ok('함수가 본문을 글자 그대로 받아 서명을 본다',
   /const raw = await req\.text\(\)/.test(idx) && /verify\(SECRET, req\.headers, raw\)/.test(idx));
ok('**비밀이 비면 문을 열어 두지 않는다**', /if \(!SECRET \|\| !RESEND\)/.test(idx));
ok('Resend 가 거절하면 Auth 에 실패를 돌려준다', /if \(!r\.ok\)[\s\S]{0,600}fail\(`[^`]*`, 500\)/.test(idx));
/* Auth 는 `{ error: { http_code, message } }` 만 실패로 읽는다. 모양이 어긋나면
   500 을 줘도 저쪽은 「보냈다」로 넘어간다. */
ok('실패를 Auth 가 알아듣는 모양으로 돌려준다', /error: \{ http_code: status, message \}/.test(idx));

const nbad = rows.filter(r => !r.pass).length;
console.log('');
rows.forEach(r => console.log(' ' + (r.pass ? 'OK ' : 'X  ') + r.name + (r.note ? '   — ' + r.note : '')));
console.log('\n ' + (rows.length - nbad) + '/' + rows.length + ' 통과');
process.exit(nbad ? 1 : 0);
})();
