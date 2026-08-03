/* ============================================================
   Copycat 결제 백엔드 — Cloudflare Worker + PayPal Orders v2

   왜 서버가 필요한가: 브라우저에서 결제를 "완료"했다는 말은 신뢰할 수 없다.
   금액도 브라우저가 정하게 두면 안 된다. 그래서
     · 가격은 이 파일의 PRODUCTS 에만 존재한다 (클라이언트는 productId만 보낸다)
     · 캡처 결과를 PayPal에 직접 물어보고 금액·통화·상태를 대조한 뒤에만 다운로드를 내준다
     · 다운로드 링크는 HMAC 서명 + 만료 + 횟수 제한

   엔드포인트
     POST /api/orders                  주문 생성      → { id }
     POST /api/orders/:id/capture      결제 확정      → { status, download, expiresAt }
     GET  /api/download?t=TOKEN        파일 전송
     POST /api/orders/recover          영수증 재발급  → { download }
     POST /api/paypal/webhook          PayPal 웹훅 (브라우저가 닫혔을 때의 안전망)
     GET  /api/health
   ============================================================ */

/* 가격의 유일한 원본. 클라이언트는 절대 금액을 보내지 않는다.
   PayPal은 KRW를 거래 통화로 지원하지 않으므로 USD로 청구한다. README 참고. */
const PRODUCTS = {
  'copycat-full': {
    name: 'Copycat 정식판',
    description: 'Copycat — 근무 시간을 같이 견뎌주는 고양이 사무실 (DRM-free)',
    amount: '4.99',
    currency: 'USD',
    r2Key: 'copycat-full.zip',
    filename: 'copycat-1.0.zip',
  },
};

const DOWNLOAD_TTL_SEC = 72 * 3600; // 링크 유효기간
const MAX_DOWNLOADS = 5;            // 같은 주문으로 받을 수 있는 횟수
const ORDER_TTL_SEC = 400 * 24 * 3600;

/* ---------- 작은 유틸 ---------- */

const enc = new TextEncoder();

const json = (data, status = 200, origin = '*') =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(origin),
    },
  });

const corsHeaders = origin => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  vary: 'origin',
});

/* 설정된 허용 오리진과 대조. 미설정이면 * (개발용). */
function pickOrigin(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.length) return '*';
  const origin = request.headers.get('origin') || '';
  return allowed.includes(origin) ? origin : allowed[0];
}

const b64url = bytes =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = str => {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

/* 타이밍 공격을 피하려고 길이·바이트를 상수시간에 비교한다. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(message));
}

/* 다운로드 토큰: base64url(payload).base64url(hmac) — 서버 상태 없이 검증된다.
   횟수 제한만 KV를 본다. */
async function issueToken(env, orderId, productId, expSec) {
  const payload = `${orderId}|${productId}|${expSec}`;
  const sig = await hmac(env.DOWNLOAD_SECRET, payload);
  return `${b64url(enc.encode(payload))}.${b64url(sig)}`;
}

async function verifyToken(env, token) {
  const [p, s] = String(token || '').split('.');
  if (!p || !s) return null;
  let payload;
  try {
    payload = new TextDecoder().decode(b64urlDecode(p));
  } catch {
    return null;
  }
  const expected = await hmac(env.DOWNLOAD_SECRET, payload);
  if (!timingSafeEqual(b64urlDecode(s), new Uint8Array(expected))) return null;

  const [orderId, productId, expSec] = payload.split('|');
  if (!orderId || !productId || !expSec) return null;
  if (Number(expSec) < Math.floor(Date.now() / 1000)) return { expired: true };
  return { orderId, productId, exp: Number(expSec) };
}

/* ---------- PayPal REST ---------- */

const apiBase = env =>
  env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

/* 액세스 토큰은 9시간쯤 유효하다. 매 요청마다 재발급하면 느리고 레이트리밋에 걸린다. */
async function accessToken(env) {
  const cacheKey = `pp:token:${env.PAYPAL_ENV || 'sandbox'}`;
  const cached = await env.ORDERS.get(cacheKey);
  if (cached) return cached;

  const basic = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${apiBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`paypal auth ${res.status}: ${await res.text()}`);

  const data = await res.json();
  // 만료 5분 전에 버린다. KV 최소 TTL은 60초.
  await env.ORDERS.put(cacheKey, data.access_token, {
    expirationTtl: Math.max(60, (data.expires_in || 32000) - 300),
  });
  return data.access_token;
}

async function paypal(env, path, { method = 'GET', body, requestId } = {}) {
  const res = await fetch(`${apiBase(env)}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await accessToken(env)}`,
      'content-type': 'application/json',
      ...(requestId ? { 'paypal-request-id': requestId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* PayPal이 JSON이 아닌 걸 준 경우 — 아래에서 raw로 처리 */
  }
  return { ok: res.ok, status: res.status, data, raw: text };
}

/* ---------- 핸들러 ---------- */

async function createOrder(request, env, origin) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* 빈 본문 허용 — 아래에서 productId 검증에 걸린다 */
  }
  const product = PRODUCTS[body.productId];
  if (!product) return json({ error: 'unknown_product' }, 400, origin);

  const res = await paypal(env, '/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: body.productId,
          description: product.description.slice(0, 127),
          amount: { currency_code: product.currency, value: product.amount },
        },
      ],
      application_context: {
        brand_name: 'Copycat',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING', // 디지털 상품 — 주소를 받지 않는다
      },
    },
  });

  if (!res.ok) {
    console.error('create order failed', res.status, res.raw);
    return json({ error: 'create_failed' }, 502, origin);
  }
  return json({ id: res.data.id }, 200, origin);
}

async function captureOrder(orderId, env, origin) {
  if (!/^[A-Z0-9]{6,32}$/i.test(orderId)) return json({ error: 'bad_order_id' }, 400, origin);

  // 이미 처리한 주문이면 결제를 다시 긁지 않고 링크만 다시 준다.
  const existing = await env.ORDERS.get(`order:${orderId}`, 'json');
  if (existing?.status === 'COMPLETED') {
    return json(await fulfil(env, orderId, existing.productId), 200, origin);
  }

  // paypal-request-id 로 중복 캡처를 막는다 (네트워크 재시도 시 이중 청구 방지).
  const res = await paypal(env, `/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    requestId: `capture-${orderId}`,
  });

  if (!res.ok) {
    const issue = res.data?.details?.[0]?.issue;
    if (issue === 'ORDER_ALREADY_CAPTURED') {
      const verified = await verifyAndRecord(env, orderId);
      if (verified) return json(await fulfil(env, orderId, verified.productId), 200, origin);
    }
    console.error('capture failed', res.status, res.raw);
    return json({ error: 'capture_failed', issue: issue || null }, 502, origin);
  }

  const verified = await verifyAndRecord(env, orderId, res.data);
  if (!verified) return json({ error: 'verification_failed' }, 502, origin);

  return json(await fulfil(env, orderId, verified.productId), 200, origin);
}

/* 캡처 응답을 그대로 믿지 않고 금액·통화·상태를 상품 정의와 대조한다.
   이 검증이 없으면 클라이언트가 조작한 주문도 다운로드를 받아간다. */
async function verifyAndRecord(env, orderId, captureData) {
  let order = captureData;
  if (!order) {
    const res = await paypal(env, `/v2/checkout/orders/${orderId}`);
    if (!res.ok) return null;
    order = res.data;
  }

  const unit = order.purchase_units?.[0];
  const productId = unit?.custom_id;
  const product = PRODUCTS[productId];
  if (!product) {
    console.error('unknown custom_id on order', orderId, productId);
    return null;
  }

  const capture = unit?.payments?.captures?.[0];
  const paid = capture?.amount;
  const amountOk = paid && paid.currency_code === product.currency && Number(paid.value) >= Number(product.amount);
  const statusOk = capture?.status === 'COMPLETED' || order.status === 'COMPLETED';

  if (!amountOk || !statusOk) {
    console.error('order verification failed', orderId, JSON.stringify({ paid, status: capture?.status }));
    return null;
  }

  await env.ORDERS.put(
    `order:${orderId}`,
    JSON.stringify({
      status: 'COMPLETED',
      productId,
      amount: paid.value,
      currency: paid.currency_code,
      captureId: capture?.id || null,
      payerEmail: order.payer?.email_address || null,
      capturedAt: new Date().toISOString(),
    }),
    { expirationTtl: ORDER_TTL_SEC },
  );

  // 영수증 조회용 역인덱스 (이메일로 링크 재발급).
  const email = order.payer?.email_address?.toLowerCase();
  if (email) await env.ORDERS.put(`email:${email}`, orderId, { expirationTtl: ORDER_TTL_SEC });

  return { productId };
}

async function fulfil(env, orderId, productId) {
  const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SEC;
  const token = await issueToken(env, orderId, productId, exp);
  return {
    status: 'COMPLETED',
    orderId,
    download: `${env.PUBLIC_BASE_URL || ''}/api/download?t=${token}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    maxDownloads: MAX_DOWNLOADS,
  };
}

async function download(url, env, origin) {
  const claim = await verifyToken(env, url.searchParams.get('t'));
  if (!claim) return json({ error: 'invalid_token' }, 403, origin);
  if (claim.expired) return json({ error: 'link_expired', hint: 'recover' }, 410, origin);

  const record = await env.ORDERS.get(`order:${claim.orderId}`, 'json');
  if (record?.status !== 'COMPLETED') return json({ error: 'order_not_paid' }, 403, origin);

  const countKey = `dl:${claim.orderId}`;
  const used = Number((await env.ORDERS.get(countKey)) || 0);
  if (used >= MAX_DOWNLOADS) return json({ error: 'download_limit_reached' }, 429, origin);

  const product = PRODUCTS[claim.productId];
  if (!product) return json({ error: 'unknown_product' }, 410, origin);

  const object = await env.BUILDS.get(product.r2Key);
  if (!object) {
    console.error('build missing in R2', product.r2Key);
    return json({ error: 'build_unavailable' }, 503, origin);
  }

  await env.ORDERS.put(countKey, String(used + 1), { expirationTtl: ORDER_TTL_SEC });

  return new Response(object.body, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${product.filename}"`,
      'content-length': String(object.size),
      'cache-control': 'no-store',
    },
  });
}

/* 브라우저가 결제 직후 닫혀서 링크를 못 받은 경우. 웹훅이 주문을 기록해 뒀으므로
   결제에 쓴 PayPal 이메일로 다시 발급한다. */
async function recover(request, env, origin) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* 아래 검증에서 걸린다 */
  }
  const email = String(body.email || '').trim().toLowerCase();
  const orderId = String(body.orderId || '').trim();

  const resolved = orderId || (email ? await env.ORDERS.get(`email:${email}`) : null);
  if (!resolved) return json({ error: 'not_found' }, 404, origin);

  const record = await env.ORDERS.get(`order:${resolved}`, 'json');
  if (record?.status !== 'COMPLETED') return json({ error: 'not_found' }, 404, origin);

  // 주문번호만으로 조회할 때는 이메일이 일치해야 한다 (주문번호 추측 방어).
  if (orderId && email && record.payerEmail && record.payerEmail.toLowerCase() !== email) {
    return json({ error: 'not_found' }, 404, origin);
  }

  return json(await fulfil(env, resolved, record.productId), 200, origin);
}

/* 웹훅은 PayPal에 서명 검증을 위임한다. 검증 없이 신뢰하면 누구나 주문을 위조할 수 있다. */
async function webhook(request, env) {
  const raw = await request.text();
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const h = n => request.headers.get(n);
  const verify = await paypal(env, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      transmission_id: h('paypal-transmission-id'),
      transmission_time: h('paypal-transmission-time'),
      cert_url: h('paypal-cert-url'),
      auth_algo: h('paypal-auth-algo'),
      transmission_sig: h('paypal-transmission-sig'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
  });

  if (!verify.ok || verify.data?.verification_status !== 'SUCCESS') {
    console.error('webhook signature rejected', verify.status, verify.raw);
    return new Response('invalid signature', { status: 401 });
  }

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    // 캡처 리소스에서 주문 ID를 되짚어 같은 검증 경로를 태운다.
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (orderId) await verifyAndRecord(env, orderId);
    else console.error('capture event without order_id', event.id);
  }

  return new Response('ok'); // 2xx 를 안 주면 PayPal이 계속 재시도한다
}

/* ---------- 라우팅 ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const origin = pickOrigin(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    try {
      if (path === '/api/health') {
        return json({ ok: true, env: env.PAYPAL_ENV || 'sandbox', products: Object.keys(PRODUCTS) }, 200, origin);
      }
      if (path === '/api/orders' && request.method === 'POST') return createOrder(request, env, origin);

      const cap = path.match(/^\/api\/orders\/([^/]+)\/capture$/);
      if (cap && request.method === 'POST') return captureOrder(cap[1], env, origin);

      if (path === '/api/orders/recover' && request.method === 'POST') return recover(request, env, origin);
      if (path === '/api/download' && request.method === 'GET') return download(url, env, origin);
      if (path === '/api/paypal/webhook' && request.method === 'POST') return webhook(request, env);

      return json({ error: 'not_found' }, 404, origin);
    } catch (err) {
      console.error('unhandled', err?.stack || String(err));
      return json({ error: 'internal' }, 500, origin);
    }
  },
};

export { PRODUCTS, issueToken, verifyToken, verifyAndRecord, timingSafeEqual };
