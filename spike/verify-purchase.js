/* 결제 한 바퀴를 **진짜 서버로** 돈다. 웹훅이 오면 상자가 정말 들어오는가,
   같은 영수증이 두 번 와도 한 번만 주는가, 환불하면 거둬 가는가.

   왜 이걸 자동으로 봐야 하나: 이 길에서 나는 사고는 전부 **돈을 받고 안 주거나,
   한 번 받고 두 번 주는** 종류다. 눈으로 보기 어렵고, 틀려도 조용하다.

     node spike/verify-purchase.js

   RC_SECRET 은 RevenueCat 웹훅에 넣은 그 문자열이다. **저장소에 안 적는다** —
   이걸 아는 사람은 남의 계정에 상자를 넣을 수 있다.
     RC_SECRET=... node spike/verify-purchase.js
*/
const U = process.env.SB_URL || 'https://uezoijircckenbvqgokp.supabase.co';
const K = process.env.SB_KEY || 'sb_publishable_gprIG9Og02bWxZMVTzDvvA_18nGaegX';
const SECRET = process.env.RC_SECRET || '';
if (!SECRET){ console.log('RC_SECRET 이 없다 — 웹훅을 두드릴 수 없다.'); process.exit(2); }

const rows = []; const ok = (n, p, note) => rows.push({ name:n, pass:!!p, note });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const hook = (body) => fetch(`${U}/functions/v1/parcel-purchase`, {
  method:'POST', headers:{ 'Content-Type':'application/json',
    Authorization:`Bearer ${SECRET}` }, body: JSON.stringify(body) });

(async () => {
  /* ── 진짜 계정 하나를 만든다(익명). 게임이 하는 것과 같은 길이다. ── */
  const su = await fetch(`${U}/auth/v1/signup`, { method:'POST',
    headers:{ apikey:K, 'Content-Type':'application/json' }, body:'{}' });
  const acct = await su.json();
  const jwt = acct.access_token;
  const uid = acct.user && acct.user.id;
  if (!jwt || !uid){ console.log('익명 계정을 못 만들었다:', JSON.stringify(acct).slice(0,200)); process.exit(1); }

  const rpc = async (fn, args) => {
    const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method:'POST',
      headers:{ apikey:K, Authorization:`Bearer ${jwt}`, 'Content-Type':'application/json' },
      body: JSON.stringify(args || {}) });
    return r.json();
  };
  const bal = async () => { const s = await rpc('ticket_state'); return s && s.ok ? (s.balance|0) : null; };

  const start = await bal();
  ok('새 계정에 장부가 선다', start !== null, '처음 잔액 ' + start);

  /* ── 1. 산다 ── */
  const txn = 'test-' + Date.now();
  const ev = t => ({ event:{ type:t, app_user_id:uid, transaction_id:txn,
                             product_id:'box_12', store:'TEST' } });
  const r1 = await hook(ev('NON_RENEWING_PURCHASE'));
  const j1 = await r1.json().catch(() => ({}));
  ok('웹훅이 200 으로 답한다', r1.status === 200, `${r1.status} ${JSON.stringify(j1).slice(0,90)}`);
  let after = null;
  for (let i = 0; i < 8 && after === null; i++){ await sleep(500); const b = await bal(); if (b > start) after = b; }
  ok('**상자가 실제로 들어온다**', after === start + 12, `${start} → ${after === null ? await bal() : after} (box_12)`);

  /* ── 2. 같은 영수증이 또 온다 (스토어 웹훅은 재시도한다) ── */
  const r2 = await hook(ev('NON_RENEWING_PURCHASE'));
  const j2 = await r2.json().catch(() => ({}));
  await sleep(700);
  const dup = await bal();
  ok('두 번 와도 한 번만 준다', dup === after,
     `${after} → ${dup} · 서버 답 ${JSON.stringify(j2.applied || j2).slice(0,60)}`);

  /* ── 3. 모르는 상품은 **알린다** (조용히 넘기면 돈만 받고 끝난다) ── */
  const r3 = await hook({ event:{ type:'NON_RENEWING_PURCHASE', app_user_id:uid,
    transaction_id:'test-unknown-'+Date.now(), product_id:'box_9999', store:'TEST' } });
  ok('모르는 상품은 실패로 답한다', r3.status === 500, String(r3.status));

  /* ── 4. 우리가 안 쓰는 사건은 조용히 넘긴다 (아니면 며칠 재시도가 쌓인다) ── */
  const r4 = await hook({ event:{ type:'SUBSCRIBER_ALIAS', app_user_id:uid, transaction_id:'x' } });
  ok('모르는 사건은 200 으로 넘긴다', r4.status === 200, String(r4.status));

  /* ── 5. 환불 ── */
  const r5 = await hook(ev('REFUND'));
  const j5 = await r5.json().catch(() => ({}));
  await sleep(700);
  const back = await bal();
  /* **줄 것이 없었으면 거둬 간 것도 아니다.** 앞의 지급이 실패한 판에서 `back === start`
     는 저절로 참이 된다 — 아무 일도 안 일어났는데 통과하는 검사는 검사가 아니다. */
  ok('환불하면 거둬 간다', after !== null && back === start,
     after === null ? '앞에서 지급이 안 됐다 — 볼 것이 없다'
                    : `${dup} → ${back} · ${JSON.stringify(j5.refund || j5).slice(0,70)}`);

  /* ── 6. 문지기 ── */
  const bad = await fetch(`${U}/functions/v1/parcel-purchase`, { method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:'Bearer nope' }, body:'{}' });
  ok('틀린 비밀은 못 들어온다', bad.status === 401, String(bad.status));

  /* ── 7. 게임의 열쇠로는 장부를 못 고친다 ── */
  const hack = await fetch(`${U}/rest/v1/tickets?user_id=eq.${uid}`, { method:'PATCH',
    headers:{ apikey:K, Authorization:`Bearer ${jwt}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ balance: 9999 }) });
  ok('**클라이언트가 잔액을 못 고친다**', hack.status >= 400, String(hack.status));

  /* ── 뒷정리. 남의 데이터베이스에 시험 계정을 쌓아 두지 않는다. ── */
  const del = await rpc('account_delete');
  ok('시험 계정을 지웠다', del && (del.ok || del === true), JSON.stringify(del).slice(0,60));

  const nbad = rows.filter(r => !r.pass).length;
  console.log('');
  rows.forEach(r => console.log(` ${r.pass ? 'OK ' : 'X  '} ${r.name}${r.note ? '   — ' + r.note : ''}`));
  console.log(`\n ${rows.length - nbad}/${rows.length} 통과`);
  process.exit(nbad ? 1 : 0);
})();
