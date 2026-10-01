/* 애플 로그인의 **클라이언트 비밀**을 굽는다 — Supabase 의 `Secret Key (for OAuth)` 칸에 넣는 값.

   헷갈리는 지점부터: **그 칸에 .p8 파일을 넣는 게 아니다.** 애플은 비밀을 파일로 주지
   않고, 우리가 .p8 로 **서명한 JWT** 를 비밀로 쓰라고 한다. 그리고 그 JWT 의 수명을
   애플이 **6개월로 못 박아 둔다**(exp 상한 15777000초). 그래서 6개월마다 이 도구를
   다시 돌려야 하고, 안 돌리면 어느 날 갑자기 `invalid_client` 로 로그인이 죽는다.
   .p8 자체는 안 만료된다 — 다시 받을 필요 없다.

   실행:
     node tools/apple-secret.js --p8 ~/keys/AuthKey_GW2H396F9N.p8 \
          --team <TEAM_ID> --kid GW2H396F9N --sub <SERVICES_ID>

   값이 사는 곳:
     team  developer.apple.com → Membership details → Team ID (10자)
     kid   키를 받을 때 나온 Key ID (지금은 GW2H396F9N)
     sub   **Services ID** 다 — 앱 번들(sarl.copycat.app)이 아니다. 브라우저로 도는
           로그인(우리가 쓰는 길)은 Services ID 를 client_id 로 삼는다.

   나온 한 줄을 Supabase → Authentication → Providers → Apple → Secret Key 에 붙인다.
   .p8 는 저장소에 넣지 않는다 — 이 도구는 경로만 받는다. */

const fs = require('fs');
const crypto = require('crypto');

const arg = n => {
  const i = process.argv.indexOf('--' + n);
  return i > 0 ? process.argv[i + 1] : '';
};
const b64u = b => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const p8 = arg('p8'), team = arg('team'), kid = arg('kid'), sub = arg('sub');
if (!p8 || !team || !kid || !sub){
  console.error('필요한 것 넷: --p8 <경로> --team <TEAM_ID> --kid <KEY_ID> --sub <SERVICES_ID>');
  process.exit(1);
}

let key;
try {
  key = crypto.createPrivateKey(fs.readFileSync(p8, 'utf8'));
} catch (e){
  console.error('.p8 을 못 읽었다: ' + (e && e.message));
  process.exit(1);
}
/* 애플 키는 P-256 타원곡선이다. 다른 게 들어오면 서명은 되고 애플이 거절한다 —
   그 거절은 로그인할 때에야 보이므로 여기서 먼저 막는다. */
if (key.asymmetricKeyType !== 'ec'){
  console.error('이 키는 EC 가 아니다(' + key.asymmetricKeyType + ') — 애플 .p8 이 맞나');
  process.exit(1);
}

const SIX_MONTHS = 15777000;            // 애플이 받는 exp 의 상한. 더 주면 거절한다
const iat = Math.floor(Date.now() / 1000);
const exp = iat + SIX_MONTHS;

const head = b64u(JSON.stringify({ alg: 'ES256', kid }));
const body = b64u(JSON.stringify({
  iss: team, iat, exp, aud: 'https://appleid.apple.com', sub,
}));
/* JOSE 의 ES256 서명은 r‖s 를 그대로 잇는 형식이다. Node 기본값은 DER 이라
   `dsaEncoding` 을 바꿔 줘야 한다 — 안 바꾸면 애플이 서명을 못 읽는다. */
const sig = crypto.sign('sha256', Buffer.from(head + '.' + body),
  { key, dsaEncoding: 'ieee-p1363' });

console.log(head + '.' + body + '.' + b64u(sig));
console.error('\n  만료: ' + new Date(exp * 1000).toISOString().slice(0, 10)
  + '  ← 이 날 전에 다시 구워 Supabase 에 갈아 끼운다');
