/* ============================================================
   parcel-purchase — 스토어 결제를 받아 상자를 넣는 문 하나

   RevenueCat 이 결제를 검증하고(애플·구글 영수증), 그 결과를 여기로 보낸다.
   이 함수는 **판단을 거의 안 한다** — 보낸 사람이 맞는지 확인하고, 데이터베이스의
   `purchase_apply()` 를 부르는 것이 전부다. 지급과 중복 방지는 거기 있다
   (동시에 두 번 와도 안전하려면 판정이 데이터베이스 안에 있어야 한다).

   ── 왜 게임이 직접 안 넣나 ──
   게임에 실리는 열쇠는 publishable 이고, 그 열쇠로는 `tickets` 를 못 고친다.
   「샀다」고 말할 권한이 클라이언트에 있으면 그건 결제가 아니라 신고다.

   ── 배포 ──
     supabase functions deploy parcel-purchase --no-verify-jwt
     supabase secrets set RC_WEBHOOK_SECRET=아무거나_긴_문자열
   그리고 RevenueCat 대시보드 → Integrations → Webhooks 에
     URL     https://<프로젝트>.supabase.co/functions/v1/parcel-purchase
     Header  Authorization: Bearer 같은_문자열
   를 넣는다. `--no-verify-jwt` 인 이유: 부르는 쪽이 사람이 아니라 RevenueCat 이고,
   그쪽은 Supabase 토큰을 갖고 있지 않다. 대신 위의 비밀 문자열로 문을 지킨다.

   ── app_user_id 가 곧 계정이다 ──
   게임에서 RevenueCat 을 시작할 때 **Supabase 사용자 id 를 appUserID 로 넘겨야**
   여기서 누구에게 줄지 알 수 있다. 그걸 안 넘기면 RevenueCat 이 만든 익명 id 가
   오고, 그 id 는 이 데이터베이스에 없는 사람이다.
   ============================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET       = Deno.env.get('RC_WEBHOOK_SECRET') ?? '';

/* 지급하는 사건과 되돌리는 사건. 상자는 **소모품**이라 구독 갱신은 오지 않는다 —
   그래도 목록으로 두는 이유는, 모르는 종류가 왔을 때 조용히 무시하고 200 을 돌려주기
   위해서다(2xx 가 아니면 RevenueCat 이 계속 다시 보낸다). */
const GRANT  = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION']);
const REVOKE = new Set(['REFUND', 'CANCELLATION']);

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  /* 문지기. 이 한 줄이 「아무나 상자를 넣는 주소」와 「결제 수신함」을 가른다. */
  const auth = req.headers.get('Authorization') ?? '';
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return new Response('no', { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const e = body?.event ?? {};
  const type = String(e.type ?? '');
  const user = String(e.app_user_id ?? '');
  const txn  = String(e.transaction_id ?? e.id ?? '');
  const prod = String(e.product_id ?? '');
  const store = String(e.store ?? '');

  /* 모르는 사건은 **성공으로 답한다.** 여기서 실패를 돌려주면 RevenueCat 이
     같은 것을 며칠 동안 다시 보낸다 — 우리가 안 쓰는 사건까지 재시도로 쌓인다. */
  if (!GRANT.has(type) && !REVOKE.has(type)) {
    return Response.json({ ok: true, skipped: type });
  }
  if (!user || !txn) return Response.json({ ok: true, skipped: 'no ids' });

  try {
    if (REVOKE.has(type)) {
      const out = await rpc('purchase_refund', { p_txn: txn });
      return Response.json({ ok: true, refund: out });
    }
    if (!prod) return Response.json({ ok: true, skipped: 'no product' });
    const out = await rpc('purchase_apply', {
      p_user: user, p_txn: txn, p_product: prod, p_store: store || null,
    });
    /* 모르는 상품 코드는 **알려야 한다** — 스토어에는 등록했는데 표에 안 넣은 경우이고,
       조용히 넘기면 돈은 받고 상자는 안 준 채로 지나간다. 실패를 돌려주면 RevenueCat 이
       다시 보내므로, 표를 고치는 순간 밀린 것이 저절로 들어온다. */
    if (out && out.ok === false && out.why === 'unknown_product') {
      return new Response(JSON.stringify(out), { status: 500 });
    }
    return Response.json({ ok: true, applied: out });
  } catch (err) {
    /* 진짜 실패는 실패로 답한다 — 그래야 다시 온다. 돈을 받고 상자를 안 준 채로
       끝나는 것이 이 함수에서 제일 나쁜 결말이다. */
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
