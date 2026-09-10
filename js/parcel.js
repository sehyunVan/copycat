/* ============================================================
   parcel.js — 상자(택배)를 **서버에서** 세고 굴리는 층

   왜 파일을 따로 두나: `gacha.js` 는 화면과 연출이 사는 곳이고, 여기는 **장부**다.
   상자를 돈으로 팔기로 한 순간 그 둘은 성격이 달라졌다 — 하나는 고쳐도 게임이
   덜 예뻐질 뿐이고, 하나는 고치면 결제한 사람과 안 한 사람이 같아진다.

   ── 서버가 없으면 ──
   상자를 **까지 않는다**. 로컬로 흉내 내면 그건 다른 잔액이고, 나중에 둘을 합치는
   순간 반드시 구멍이 생긴다. 대신 화면이 「지금은 못 뜯는다」고 말한다 —
   게임의 나머지는 그대로 돈다(사무실도 결재도 서버를 안 쓴다).

   ── 확률표도 서버에서 읽는다 ──
   확률을 공시해 놓고 클라이언트가 자기 숫자를 그리면, 그 표는 **증명할 수 없는
   숫자**다. `parcel_rates()` 가 돌려주는 값이 곧 추첨이 쓰는 값이라, 표시와 실제가
   구조적으로 같아진다.
   ============================================================ */
(function () {
  'use strict';

  const ST = {
    on: false,        // 서버 잔액을 쓰고 있는가
    why: 'init',
    balance: 0,
    bricks: 0,
    pulls: 0,
    got: [],          // 받은 누적 보상 지점(서버가 아직 세는 값 — 게임은 안 쓴다)
    rates: null,      // parcel_rates() 그대로
  };

  const sbOf = () => { try { return window.CLOUD ? CLOUD.sb() : null; } catch (e){ return null; } };
  const off = why => { ST.on = false; ST.why = why; return false; };
  let gone = false;          // 서버에 표가 아예 없다 — 다시 두드릴 이유가 없다

  /* 업무일 기준이 아니라 **서버의 날짜**로 하루를 센다(서버 함수가 Asia/Seoul 로
     자른다). 무료 한 번을 기기 시계로 재면 시계를 돌려 여러 번 받는다. */
  async function refresh(){
    if (gone) return false;
    const sb = sbOf();
    if (!sb) return off(L({ ko:'로그인 전', en:'not signed in', ja:'ログイン前' }));
    try {
      const [{ data: st, error: e1 }, { data: rt, error: e2 }] =
        await Promise.all([sb.rpc('ticket_state'), sb.rpc('parcel_rates')]);
      /* **없는 함수는 기다려도 안 생긴다.** SQL 을 아직 안 돌린 판에서 1.5초마다
         다시 두드리면 404 가 40번 찍힌다 — 그건 재시도가 아니라 소음이다.
         로그인이 아직 안 붙은 것(그건 곧 붙는다)과 구분해서, 이쪽은 즉시 포기한다. */
      const missing = e => e && (/find the function|does not exist|schema cache/i).test(e.message || '');
      if (missing(e1) || missing(e2)){ gone = true; return off(L({ ko:'서버에 택배 표가 없습니다', en:'the server has no parcel table', ja:'サーバーに宅配の表がありません' })); }
      if (e1 || !st || !st.ok) return off((e1 && e1.message) || (st && st.why) || L({ ko:'잔액을 못 읽었다', en:'could not read the balance', ja:'残高を読めませんでした' }));
      if (e2 || !rt) return off((e2 && e2.message) || L({ ko:'확률표를 못 읽었다', en:'could not read the odds table', ja:'確率表を読めませんでした' }));
      ST.balance = st.balance | 0;
      ST.bricks = st.bricks | 0;
      ST.pulls = st.pulls | 0;
      ST.got = st.got || [];
      ST.rates = rt;
      ST.on = true; ST.why = '';
      return true;
    } catch (e){ return off((e && e.message) || L({ ko:'서버가 안 받는다', en:'the server refused', ja:'サーバーが受け付けません' })); }
  }

  /* 상자를 깐다. 서버가 굴려서 결과를 돌려주고, **적용은 게임이 한다** —
     가구는 창고로, 멸치는 잔고로, 장비는 가방으로 들어가는 자리가 전부 게임 안이라
     그쪽 규칙을 서버가 다시 알 이유가 없다(벽돌만 서버가 센다 — 세기만 한다,
     벽돌은 재화가 아니라 꽝 그 자체다: js/gacha.js 머리말). */
  async function open(n){
    const sb = sbOf();
    if (!sb || !ST.on) return { ok:false, why:'offline' };
    try {
      /* **공짜로 까는 길은 없다**(2026-09-10 · js/gacha.js 머리말). 서버 함수는
         아직 p_free 를 받으므로 false 를 또렷이 넘긴다 — 서버를 고치지 않아도
         게임 쪽에서 그 길이 닫힌다. */
      const { data, error } = await sb.rpc('parcel_open', { p_n: n, p_free: false });
      if (error) return { ok:false, why:'error', msg:error.message };
      if (!data || !data.ok) return { ok:false, why:(data && data.why) || 'error' };
      ST.balance = data.balance | 0;
      ST.bricks = data.bricks | 0;
      ST.pulls = data.pulls | 0;
      (data.granted || []).forEach(x => { if (x && x.at != null) ST.got.push(x.at | 0); });
      return { ok:true, items:data.items || [], granted:data.granted || [],
               balance:ST.balance, bricks:ST.bricks };
    } catch (e){ return { ok:false, why:'error', msg:(e && e.message) }; }
  }

  const call = async (fn) => {
    const sb = sbOf();
    if (!sb || !ST.on) return { ok:false, why:'offline' };
    try {
      const { data, error } = await sb.rpc(fn);
      if (error) return { ok:false, why:'error', msg:error.message };
      if (data && typeof data.balance === 'number') ST.balance = data.balance | 0;
      if (data && typeof data.bricks === 'number') ST.bricks = data.bricks | 0;
      return data || { ok:false, why:'error' };
    } catch (e){ return { ok:false, why:'error', msg:(e && e.message) }; }
  };

  /* 파는 목록. **서버가 들고 있다**(parcel_products) — 값과 개수를 게임 안에 적어 두면
     스토어에 등록한 상품과 갈리고, 그때 화면은 있는데 결제가 안 되는 칸이 생긴다.
     스토어 계정이 서기 전에는 빈 목록이라 상점 칸도 안 뜬다. */
  async function products(){
    const sb = sbOf();
    if (!sb) return [];
    try {
      const { data, error } = await sb.from('parcel_products')
        .select('product_id,boxes,label,sort').eq('live', true).order('sort');
      return error ? [] : (data || []);
    } catch (e){ return []; }
  }

  /* 내가 산 것. 서버의 `purchases` 를 그대로 읽는다 — 규칙이 「내 결제는 내가 본다」라
     남의 것은 애초에 안 온다(spike/supabase-purchase.sql).

     왜 화면에 필요한가: 결제 문의는 대개 「샀는데 안 들어왔다」이고, 그때 산 사람도
     받은 사람도 **같은 줄**을 봐야 이야기가 된다. 게임이 따로 세어 둔 숫자를 보여 주면
     그건 증거가 아니라 주장이다. */
  async function history(){
    const sb = sbOf();
    if (!sb) return [];
    try {
      const { data, error } = await sb.from('purchases')
        .select('txn_id,product_id,boxes,store,created_at')
        .order('created_at', { ascending: false }).limit(50);
      return error ? [] : (data || []);
    } catch (e){ return []; }
  }

  window.PARCEL = {
    state: () => ({ ...ST }),
    refresh,
    open,
    products,
    history,
    /* 결재 열 건마다 하나. 서버가 검증할 수 없는 길이라 하루 상한이 걸려 있다 —
       상한에 닿으면 조용히 실패한다(그건 사고가 아니라 규칙이다). */
    work: () => call('ticket_work'),
  };

  /* 로그인이 붙는 시점이 게임보다 늦으므로(js/cloud.js) 붙을 때까지 몇 번 두드린다. */
  let tries = 0;
  const t = setInterval(async () => {
    if (ST.on || gone || ++tries > 40){ clearInterval(t); return; }
    await refresh();
  }, 1500);
})();
