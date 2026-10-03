/* ============================================================
   store.js — 상자를 **사는** 자리. 파일이 또 하나인 이유가 있다.

     js/gacha.js   화면과 연출      — 고쳐도 게임이 덜 예뻐질 뿐
     js/parcel.js  장부(서버 잔액)  — 고치면 산 사람과 안 산 사람이 같아진다
     js/store.js   결제             — 고치면 **돈이 오간다**

   ── 이 파일은 지급을 하지 않는다 ──
   여기가 하는 일은 스토어 결제창을 띄우는 것까지다. 상자는 **RevenueCat 이 영수증을
   검증한 뒤 웹훅으로** 들어온다(supabase/functions/parcel-purchase). 게임이 「샀다」고
   말해서 잔액이 오르는 길은 한 줄도 없다 — 그 길이 있으면 그건 결제가 아니라 신고다.

   그래서 산 직후에 잔액이 **바로 안 오를 수 있다.** 영수증이 스토어 → RevenueCat →
   우리 서버를 거치는 몇 초가 있다. 아래 `settle()` 이 그 몇 초를 기다린다.

   ── appUserID 가 곧 계정이다 ──
   Supabase uid 를 그대로 넘긴다. 안 넘기면 RevenueCat 이 자기 익명 id 를 만들고,
   웹훅은 **이 데이터베이스에 없는 사람**에게 상자를 주려다 실패한다.

   ── 값과 개수를 여기 적지 않는다 ──
   무엇을 파는지는 서버 표(`parcel_products`)가, 얼마인지는 스토어가 안다. 게임 안에
   또 적으면 셋이 갈리고, 그때 화면은 있는데 결제가 안 되는 칸이 생긴다.
   ============================================================ */
(function () {
  'use strict';

  /* 공개 키다 — 앱에 실려 나가는 것이 정상이고, 이것만으로는 아무것도 못 산다.
     결제를 확정하는 열쇠는 RevenueCat 과 스토어 사이에 있다.

     **플랫폼마다 다른 키다.** RevenueCat 이 앱(스토어)별로 따로 발급하고, 남의 것을
     넣으면 `configure` 가 그 자리에서 죽는다 — 하나로 합칠 수 없다.
     비어 있으면 그 플랫폼에서는 상점이 아예 안 뜬다. 그게 맞는 상태다:
     스토어에 상품이 서기 전에 살 수 있는 척하는 칸이 있으면 안 된다. */
  const KEYS = {
    ios:     'appl_nlCqNqQcDSKnUnmLmoAbuUqzbxx',
    android: 'goog_viuGAiEsdMBQAvhpOuifBLBLWPu',   // 2026-09-07 — Play 신원 인증·서비스 계정 연결 후 발급
  };
  /* 웹은 여기 없다 — 카피캣은 앱으로만 판다(아래 RC() 가 먼저 걸러 낸다). */
  const keyOf = () => {
    try {
      const p = window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform();
      return (p && KEYS[p]) || '';
    } catch (e){ return ''; }
  };

  /* 결제 문의처. **여기 한 곳만 고친다** — 결제 안내가 이 값을 쓴다.
     같은 주소가 site/privacy.html 과 site/delete.html 에도 있다(스토어가 주소로
     요구하는 문서라 게임 밖에 있어야 한다). 도메인 메일을 파면 셋을 같이 바꾼다. */
  const CONTACT = 'copycat@copycat.sarl';

  const ST = {
    on: false,        // 살 수 있는 자리인가
    why: 'init',
    items: [],        // [{ id, boxes, label, price, product }]
    busy: false,
  };

  /* ---------- 데모 진열 (개발용) ----------
     `?store=demo` 로 열면 **화면만** 켠다. 웹에는 결제 플러그인이 없어서 상점 칸이
     아예 안 뜨는데(그게 맞다), 그러면 **틀을 볼 수가 없다** — 값이 몇 자리인지,
     세 칸이 한 줄에 들어가는지, 도트 글꼴에서 ₩ 가 어떻게 보이는지.

     ── 여기서도 파는 길은 없다 ──
     `buy()` 가 데모에서는 그 자리에서 돌아선다. 이 파일의 규칙은 그대로다:
     **게임이 「샀다」고 말해서 잔액이 오르는 길은 한 줄도 없다.**

     값은 예시다. 진짜 값은 스토어가 말하는 문자열이고(priceString), 여기 적은 것은
     그 자리에 몇 글자가 서는지 보려는 것뿐이다. */
  const DEMO = (() => {
    try { return new URLSearchParams(location.search).get('store') === 'demo'; }
    catch (e){ return false; }
  })();
  const DEMO_ITEMS = [
    { id: 'box_05', boxes: 5,  label: '상자 5개',  price: '₩3,300',  product: null },
    { id: 'box_12', boxes: 12, label: '상자 12개', price: '₩6,600',  product: null },
    { id: 'box_30', boxes: 30, label: '상자 30개', price: '₩14,000', product: null },
  ];

  /* Capacitor 가 네이티브 플러그인을 여기에 걸어 둔다. 웹에는 없다 —
     **웹에서는 이 파일이 통째로 잠든다**(카피캣은 앱으로 나간다). */
  const RC = () => {
    try { return (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Purchases) || null; }
    catch (e){ return null; }
  };
  const uid = () => { try { return window.CLOUD ? CLOUD.state().uid : null; } catch (e){ return null; } };
  const off = why => { ST.on = false; ST.why = why; return false; };

  let ready = false;

  /* 스토어에 물어볼 상품 코드는 **서버 표에서** 온다. 목록이 비면 상점도 안 뜬다 —
     스토어 계정이 서기 전에는 그게 맞는 상태다. */
  async function boot(){
    /* 데모는 **제일 먼저** 걸린다 — 플러그인도 로그인도 장부도 안 본다.
       틀을 보려고 켜는 것이라, 그 셋을 갖추라고 요구하면 볼 수가 없다. */
    if (DEMO){
      ST.items = DEMO_ITEMS.slice();
      ST.on = true; ST.why = 'demo';
      return true;
    }
    const rc = RC();
    if (!rc) return off('앱에서만 삽니다');
    const u = uid();
    if (!u) return off('로그인 전');
    if (!window.PARCEL) return off('장부가 없다');

    const key = keyOf();
    if (!key) return off('이 플랫폼의 결제 키가 아직 없습니다');

    try {
      if (!ready){
        await rc.configure({ apiKey: key, appUserID: u });
        ready = true;
      }

      const rows = await PARCEL.products();
      if (!rows.length) return off('파는 목록이 비었습니다');

      /* 값은 **스토어가 말하는 그대로** 쓴다(`priceString`). 통화도 자릿수도 나라마다
         다르고, 그걸 게임이 계산하면 반드시 어딘가 틀린다. */
      /* `type` 을 **반드시** 준다. 안 주면 안드로이드에서 기본값이 구독이라 일회성
         상품은 하나도 안 온다 — 상점 칸이 통째로 안 뜨는데 오류는 없는, 제일 찾기
         어려운 모양이다(iOS 는 이 값을 무시한다). */
      const got = await rc.getProducts({
        productIdentifiers: rows.map(r => r.product_id),
        type: 'NON_SUBSCRIPTION',
      });
      const list = (got && (got.products || got)) || [];
      const byId = {};
      list.forEach(p => { byId[p.identifier || p.productIdentifier] = p; });

      ST.items = rows
        .map(r => {
          const p = byId[r.product_id];
          return p ? { id: r.product_id, boxes: r.boxes | 0, label: r.label || '',
                       price: p.priceString || '', product: p } : null;
        })
        /* 스토어가 모르는 코드는 **뺀다.** 값 없는 칸을 그려 두면 누를 수는 있고
           살 수는 없는 단추가 된다 — 심사에서도 걸리고, 눌러 본 사람도 속는다. */
        .filter(Boolean);

      if (!ST.items.length) return off('스토어에 등록된 상품이 없습니다');
      ST.on = true; ST.why = '';
      return true;
    } catch (e){ return off((e && e.message) || '스토어가 안 받는다'); }
  }

  /* 영수증이 서버에 닿을 때까지 기다린다. 스토어 → RevenueCat → 웹훅 → `tickets` 는
     **비동기**라, 결제창이 닫힌 순간에는 아직 안 올라 있을 수 있다.
     못 기다렸다고 실패로 말하지는 않는다 — 결제는 이미 됐고, 잠시 뒤에 들어온다. */
  async function settle(was){
    /* 8초까지만 붙잡는다. 대개 1~3초면 닿고, 그보다 오래 걸리는 판에서 단추를 계속
       잠가 두는 것은 기다림이 아니라 **고장으로 보인다**. 못 기다린 뒤는 `late()` 가
       뒤에서 계속 본다 — 놓치는 게 아니라 앞에서 손을 뗄 뿐이다. */
    for (const ms of [600, 600, 900, 1200, 1500, 1500, 1700]){
      await new Promise(r => setTimeout(r, ms));
      await PARCEL.refresh();
      if ((PARCEL.state().balance | 0) > was) return true;
    }
    return false;
  }

  /* 늦게 닿는 영수증을 **화면 뒤에서** 계속 본다. 이게 없으면 상자는 서버에 들어와
     있는데 열린 창의 숫자만 옛것으로 남는다 — 산 사람이 제일 못 견디는 자리다.
     `onLand` 는 화면 쪽이 준다(js/gacha.js): 창이 아직 열려 있으면 다시 그린다. */
  async function late(was, onLand){
    for (let i = 0; i < 8; i++){
      await new Promise(r => setTimeout(r, 5000));
      await PARCEL.refresh();
      if ((PARCEL.state().balance | 0) > was){ if (onLand) onLand(); return true; }
    }
    return false;
  }

  async function buy(id, onLand){
    /* 데모에서는 **여기서 돌아선다.** 화면을 보려고 켠 것이지 사려고 켠 것이 아니다.
       'demo' 라는 이유를 돌려주면 화면이 그대로 말해 준다(js/gacha.js). */
    if (DEMO) return { ok: false, why: 'demo' };
    const rc = RC();
    if (!rc || !ST.on) return { ok: false, why: 'offline' };
    if (ST.busy) return { ok: false, why: 'busy' };
    const it = ST.items.find(x => x.id === id);
    if (!it) return { ok: false, why: 'unknown' };

    ST.busy = true;
    const was = PARCEL.state().balance | 0;
    try {
      await rc.purchaseStoreProduct({ product: it.product });
      const landed = await settle(was);
      /* 기다리다 놓친 것은 **여기서 손을 떼되 버리지는 않는다**(late 는 안 기다린다 —
         기다리면 단추가 40초 더 잠긴다). */
      if (!landed) late(was, onLand);
      return { ok: true, landed, boxes: it.boxes };
    } catch (e){
      /* 사용자가 그만둔 것은 **사고가 아니다.** 오류로 말하면 취소할 때마다
         빨간 말풍선이 뜬다 — 취소는 그냥 조용히 끝나야 한다. */
      const cancelled = !!(e && (e.userCancelled || e.code === '1' ||
        /cancel/i.test(e.message || '')));
      return { ok: false, why: cancelled ? 'cancel' : 'error', msg: (e && e.message) };
    } finally { ST.busy = false; }
  }

  /* ── 소모품에는 **스토어 복원이 없다** (App Store 3.1.1 · 2026-10-03 반려) ──
     전에는 여기서 `restorePurchases()` 를 불렀다. 「복원 단추는 필수」라고 알고 있었는데
     그건 **비소모품·구독** 이야기였다. 소모품은 스토어가 돌려줄 것을 아예 안 들고 있어서,
     그 단추는 애플 계정 비밀번호만 묻고 아무것도 못 준다 — 심사가 그걸 집었다.

     우리에게는 **우리 복원 수단이 따로 있다.** 상자는 기기가 아니라 **계정에 쌓인다**:
     결제는 RevenueCat 웹훅을 타고 서버 장부(purchases · tickets)로 들어가고 잔액은 늘
     거기서 읽는다. 그래서 기기를 바꾸거나 앱을 지웠다 깔아도 **같은 계정으로 들어오면
     상자는 이미 거기 있다.** 되찾는 일에 스토어가 낄 자리가 없다.

     이 함수가 하는 일은 그 장부를 **다시 읽는 것**뿐이다. 쓸 자리는 하나다: 결제는 됐는데
     웹훅이 늦어 잔액이 아직 안 오른 몇 초. 애플 계정은 묻지 않는다. */
  async function resync(){
    if (!window.PARCEL || !PARCEL.refresh) return { ok: false, why: 'offline' };
    try {
      await PARCEL.refresh();
      return { ok: true };
    } catch (e){ return { ok: false, why: 'error', msg: (e && e.message) }; }
  }

  window.STORE = { state: () => ({ ...ST, items: ST.items.slice() }),
                   contact: () => CONTACT, buy, resync, boot };

  /* 데모 진열은 **여기서 갈린다.** 아래 줄이 웹에서 이 파일을 통째로 재우기 때문에,
     boot() 안에만 데모를 넣어 두면 그 함수가 아예 안 불린다(처음에 그렇게 만들었다가
     상점이 안 떠서 찾았다). 플러그인도 로그인도 안 보고 화면만 켠다. */
  if (DEMO) { boot(); return; }

  /* 로그인이 게임보다 늦게 붙는다(js/cloud.js). 웹에서는 첫 판에 플러그인이 없다는 걸
     알고 바로 그만둔다 — 없는 것을 40번 두드리는 건 재시도가 아니라 소음이다. */
  if (!RC()) { off('앱에서만 삽니다'); return; }
  let tries = 0;
  const t = setInterval(async () => {
    if (ST.on || ++tries > 40){ clearInterval(t); return; }
    await boot();
  }, 1500);
})();
