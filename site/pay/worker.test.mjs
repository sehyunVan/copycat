/* 결제 백엔드 테스트 — 틀리면 돈이 새거나 파일이 공짜로 나가는 지점만 노린다.
   실행: node --test site/pay/                                             */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, verifyToken, verifyAndRecord, timingSafeEqual, PRODUCTS } from './worker.js';

const SECRET = 'a'.repeat(64);
const now = () => Math.floor(Date.now() / 1000);

/* KV 목 — get/put 만 쓴다. json 타입 조회도 지원. */
function kv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async get(k, type) {
      const v = store.get(k);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v) {
      store.set(k, v);
    },
  };
}

const envWith = (orders, extra = {}) => ({
  DOWNLOAD_SECRET: SECRET,
  PAYPAL_ENV: 'sandbox',
  PAYPAL_CLIENT_ID: 'id',
  PAYPAL_CLIENT_SECRET: 'secret',
  ORDERS: orders,
  ...extra,
});

/* PayPal 주문 조회 응답을 흉내낸다. */
function orderFixture({ productId = 'copycat-full', value = '4.99', currency = 'USD', status = 'COMPLETED' } = {}) {
  return {
    id: 'ORDER123',
    status,
    payer: { email_address: 'Buyer@Example.com' },
    purchase_units: [
      {
        custom_id: productId,
        payments: { captures: [{ id: 'CAP1', status, amount: { currency_code: currency, value } }] },
      },
    ],
  };
}

/* accessToken 을 KV 캐시로 미리 채워 두면 인증 fetch 가 발생하지 않는다.
   그 다음 주문 조회 fetch 만 스텁한다. */
function stubOrderFetch(order) {
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /\/v2\/checkout\/orders\/ORDER123$/, 'unexpected call: ' + url);
    assert.equal(init?.method ?? 'GET', 'GET');
    return new Response(JSON.stringify(order), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const seededKv = () => kv({ 'pp:token:sandbox': 'cached-access-token' });

/* ---------- 다운로드 토큰 ---------- */

test('유효한 토큰은 왕복한다', async () => {
  const env = envWith(kv());
  const t = await issueToken(env, 'ORDER123', 'copycat-full', now() + 600);
  const claim = await verifyToken(env, t);
  assert.equal(claim.orderId, 'ORDER123');
  assert.equal(claim.productId, 'copycat-full');
  assert.ok(!claim.expired);
});

test('서명을 건드린 토큰은 거부된다', async () => {
  const env = envWith(kv());
  const t = await issueToken(env, 'ORDER123', 'copycat-full', now() + 600);
  const [p, s] = t.split('.');
  const flipped = s[0] === 'A' ? 'B' + s.slice(1) : 'A' + s.slice(1);
  assert.equal(await verifyToken(env, `${p}.${flipped}`), null);
});

test('페이로드를 바꾸면 서명이 깨진다 — 주문번호 갈아끼우기 방어', async () => {
  const env = envWith(kv());
  const t = await issueToken(env, 'ORDER123', 'copycat-full', now() + 600);
  const sig = t.split('.')[1];
  const forged = Buffer.from('ORDER999|copycat-full|' + (now() + 600))
    .toString('base64url');
  assert.equal(await verifyToken(env, `${forged}.${sig}`), null);
});

test('만료된 토큰은 expired 로 표시된다', async () => {
  const env = envWith(kv());
  const t = await issueToken(env, 'ORDER123', 'copycat-full', now() - 1);
  assert.deepEqual(await verifyToken(env, t), { expired: true });
});

test('다른 키로 만든 토큰은 거부된다', async () => {
  const attacker = envWith(kv(), { DOWNLOAD_SECRET: 'b'.repeat(64) });
  const t = await issueToken(attacker, 'ORDER123', 'copycat-full', now() + 600);
  assert.equal(await verifyToken(envWith(kv()), t), null);
});

test('쓰레기 입력에 터지지 않는다', async () => {
  const env = envWith(kv());
  for (const bad of ['', null, undefined, 'x', 'a.b.c', '....', '!!!.???']) {
    assert.equal(await verifyToken(env, bad), null, `입력: ${JSON.stringify(bad)}`);
  }
});

test('timingSafeEqual 은 길이와 내용을 본다', () => {
  const a = new Uint8Array([1, 2, 3]);
  assert.ok(timingSafeEqual(a, new Uint8Array([1, 2, 3])));
  assert.ok(!timingSafeEqual(a, new Uint8Array([1, 2, 4])));
  assert.ok(!timingSafeEqual(a, new Uint8Array([1, 2])));
});

/* ---------- 금액 검증: 여기가 뚫리면 공짜로 나간다 ---------- */

test('정상 결제는 기록되고 이메일 역인덱스가 남는다', async () => {
  const orders = seededKv();
  stubOrderFetch(orderFixture());
  const res = await verifyAndRecord(envWith(orders), 'ORDER123');

  assert.deepEqual(res, { productId: 'copycat-full' });
  const rec = JSON.parse(orders.store.get('order:ORDER123'));
  assert.equal(rec.status, 'COMPLETED');
  assert.equal(rec.amount, '4.99');
  // 이메일은 소문자로 정규화돼야 대소문자가 달라도 영수증을 찾는다
  assert.equal(orders.store.get('email:buyer@example.com'), 'ORDER123');
});

test('덜 낸 결제는 거부된다', async () => {
  const orders = seededKv();
  stubOrderFetch(orderFixture({ value: '0.01' }));
  assert.equal(await verifyAndRecord(envWith(orders), 'ORDER123'), null);
  assert.equal(orders.store.get('order:ORDER123'), undefined);
});

test('통화가 다르면 거부된다 — 4.99 JPY 로 사는 것을 막는다', async () => {
  const orders = seededKv();
  stubOrderFetch(orderFixture({ currency: 'JPY' }));
  assert.equal(await verifyAndRecord(envWith(orders), 'ORDER123'), null);
});

test('미완료 상태는 거부된다', async () => {
  const orders = seededKv();
  stubOrderFetch(orderFixture({ status: 'PENDING' }));
  assert.equal(await verifyAndRecord(envWith(orders), 'ORDER123'), null);
});

test('모르는 상품 ID 는 거부된다', async () => {
  const orders = seededKv();
  stubOrderFetch(orderFixture({ productId: 'free-stuff' }));
  assert.equal(await verifyAndRecord(envWith(orders), 'ORDER123'), null);
});

test('더 낸 결제는 통과한다 — 팁을 받을 수 있어야 한다', async () => {
  const orders = seededKv();
  stubOrderFetch(orderFixture({ value: '10.00' }));
  assert.deepEqual(await verifyAndRecord(envWith(orders), 'ORDER123'), { productId: 'copycat-full' });
});

test('가격은 서버에만 있다 — 상품 정의가 통화·금액을 함께 고정한다', () => {
  for (const [id, p] of Object.entries(PRODUCTS)) {
    assert.match(p.amount, /^\d+\.\d{2}$/, `${id} 금액 형식`);
    assert.match(p.currency, /^[A-Z]{3}$/, `${id} 통화 형식`);
    assert.notEqual(p.currency, 'KRW', 'PayPal 은 KRW 를 거래 통화로 지원하지 않는다');
    assert.ok(p.r2Key && p.filename, `${id} 파일 지정`);
  }
});
