/* ============================================================
   friends.js — 제휴 지점(친구)의 사무실과 결재함을 구경하는 층.

   **아직 서버가 없다.** 이 파일은 서버가 왔을 때 갈아끼울 자리를 미리 만들어 둔 것이다.
   그래서 화면(js/board.js)은 이 함수들만 부르고, 자료가 어디서 오는지는 모른다 —
   지금은 이 기계 안에서 만든 흉내(mock)고, 나중에는 같은 함수가 서버를 부른다.

   ── 왜 자료층을 먼저 만드나 ──

   이 기능의 어려운 부분은 통신이 아니라 **무엇을 주고받을지 정하는 것**이다.
   남의 할 일 목록은 민감한 물건이고, 한 번 형식을 잘못 잡으면 서버를 세운 뒤에는
   못 바꾼다. 그래서 `mine()` 이 이 파일의 핵심이다 — 내가 남에게 보여 주는 것의
   **전부**를 한 함수에 모아 뒀다. 여기 없는 것은 서버에 올라가지 않는다.

   ── 톤에서 지킬 선 (js/board.js 가 이걸 화면에서 지킨다) ──

   1. **남의 진도를 숫자로 만들지 않는다.** 달성률·연속 일수·순위 없음.
      친구 칸에 보이는 건 "지금 켜 두고 있다" 정도다 — 같이 있다는 신호가 이 게임이
      파는 것이고, 비교는 그 반대다.
   2. **선물은 경제를 건드리지 않는다.** 🐟 는 인사고 멸치가 아니다. 받는 쪽 벌이는
      1도 안 변한다. 경제에 손을 대면 벌이가 사교로 새 나가고, 그때부터 친구는 자원이 된다.
   3. **하루에 한 번.** 반응을 무한히 보낼 수 있으면 그건 인사가 아니라 알림이다.
   ============================================================ */

const FRIENDS = (() => {
  /* 지금 자료가 어디서 오는가. **서버가 붙으면 'server' 로 바뀐다**(2026-09-02) —
     화면은 이 값을 보고 「미리보기」 띠를 뗀다. 흉내를 진짜처럼 보여주지 않는 게
     이 값의 유일한 일이다.

     서버 자료는 **받아 놓고 쓴다**(아래 CACHE). 화면(board.js)이 list()·snapshot() 을
     그 자리에서 부르기 때문이다 — 여기서 async 로 바꾸면 화면 쪽을 다 고쳐야 하고,
     그건 「자료가 어디서 오는지 화면은 모른다」는 이 파일의 약속을 깨는 일이다. */
  const CACHE = { on:false, list:[], snaps:{}, reqs:[], got:{} };
  const sbOf = () => { try { return window.CLOUD ? CLOUD.sb() : null; } catch(e){ return null; } };

  /* ── 서버가 올 판인가, 정말 이 기계 안에서만 도는 판인가 ──
     이 구분이 없어서 게시판이 **없는 지점 넷을 먼저 보여 주고** 서버 대답이 온
     순간 지웠다(2026-09-21 제보). 흉내는 서버가 없는 판을 위한 것이지 **서버를
     기다리는 동안**을 위한 것이 아니다 — 잠깐 떴다 사라지는 사람 넷은 구경거리가
     아니라 고장으로 읽힌다.

     `why === 'init'` 인 동안은 **아직 모르는 것**이다. 로그인은 게임보다 늦게 붙고
     (js/cloud.js 는 저장이 생긴 뒤에야 start 한다), 게시판은 그보다 먼저 열릴 수
     있다. 그 사이를 「서버 없음」으로 읽으면 같은 깜빡임이 그대로 돌아온다. */
  function coming(){
    try {
      if (!window.CLOUD) return false;
      const c = CLOUD.state();
      return !!c.on || c.why === 'init';
    } catch(e){ return false; }
  }
  /* 'server' 받아 왔다 · 'wait' 서버는 올 텐데 아직 없다 · 'mock' 이 기계 안에서만 돈다.
     **화면이 「불러오는 중」과 「못 받아 왔다」를 가른다**(js/board.js) — 몇 번
     두드려 봤는지는 그 창이 알지 이 파일이 알 일이 아니다. */
  const SOURCE = () => (CACHE.on ? 'server' : (coming() ? 'wait' : 'mock'));

  /* ---------- 내 쪽 상태 (저장에 실린다) ---------- */
  function st(){
    if (!S.friends) S.friends = { code:'', sent:{}, seen:{} };
    const f = S.friends;
    f.sent = f.sent || {}; f.seen = f.seen || {};
    return f;
  }
  /* 초대 코드. 서버가 없으므로 지금은 이 기계에서 만든 글자일 뿐이지만, **형식이 규약이다** —
     사람이 입으로 옮길 수 있어야 하고(짧게), 남의 것을 찍어 맞힐 수 없어야 한다(길게).
     읽어 주기 어려운 글자(0/O/1/I)는 뺀다. */
  const ALPHA = 'ACDEFGHJKMNPQRTUVWXY34679';
  function code(){
    const f = st();
    if (!f.code){
      let c = '';
      for (let i = 0; i < 8; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
      f.code = c.slice(0, 4) + '-' + c.slice(4);
      try { save(); } catch(e){}
    }
    return f.code;
  }

  /* ---------- 내가 남에게 보이는 모양 ----------
     서버가 오면 이 객체를 그대로 올린다. **여기 없는 것은 안 올라간다** —
     고양이 이름과 오늘 결재함까지고, 멸치·성과·혐의는 안 보낸다. 남의 사무실을
     구경하는 일이 남의 실적을 보는 일이 되면 그건 다른 게임이다. */
  function mine(){
    const today = bizKey();
    return {
      v: 1,
      id: 'me',
      name: (S.cats[0] && S.cats[0].name) || '?',
      room: TIERS[S.tier].name,
      tier: S.tier, seed: S.seed, shop: S.shop,
      shift: S.shift || { start:9, end:18 },
      cats: S.cats.slice(0, 20).map(c => ({ name:c.name, fur:c.fur, hue:c.hue })),
      /* 오늘 것만. 지난 날까지 열어 두면 남의 캘린더를 뒤지는 화면이 된다. */
      todos: S.todos.filter(t => t.due === today)
                    .map(t => ({ text:t.text, done:!!t.done, alarm:!!t.alarm, late:!!t.late })),
      day: today,
      /* 함께한 날은 숫자지만 성과가 아니라 **근속**이다 — 이건 비교가 아니라 인사다. */
      days: (S.together && S.together.days) || 1,
    };
  }

  /* ---------- 흉내 자료 ----------
     seed 로 고정한다. 새로 고칠 때마다 다른 사람이 나오면 그건 친구가 아니라 목록이다. */
  const MOCK = [
    { id:'f1', name:L({ ko:'보리', en:'Barley', ja:'ボリ' }), room:L({ ko:'반지하 원룸 오피스', en:'Semi-basement Studio', ja:'半地下ワンルーム' }),
      tier:1, seed:20260811, shift:{ start:9, end:18 }, days:23,
      cats:[['보리',1,0],['참깨',3,12],['두부',0,-8]],
      todos:[[L({ ko:'세금계산서 정리', en:'Sort invoices', ja:'請求書の整理' }), true, true],
             [L({ ko:'창고 재고 세기', en:'Count the stock', ja:'在庫を数える' }), false, true],
             [L({ ko:'화분에 물', en:'Water the plants', ja:'鉢に水' }), false, false]] },
    { id:'f2', name:L({ ko:'흑임자', en:'Sesame', ja:'クロゴマ' }), room:L({ ko:'상가 2층 사무실', en:'2nd-floor Walk-up', ja:'商店街2階' }),
      tier:2, seed:20260726, shift:{ start:22, end:6 }, days:61,
      cats:[['흑임자',4,0],['까망',4,-20],['미역',2,9],['마요',1,14]],
      todos:[[L({ ko:'야간 배송 확인', en:'Check the night run', ja:'夜間配送の確認' }), true, false],
             [L({ ko:'정제실 청소', en:'Clean the refinery', ja:'精製室の掃除' }), false, false]] },
    { id:'f3', name:L({ ko:'감자', en:'Potato', ja:'ポテト' }), room:L({ ko:'골목 종이상자 지점', en:'Alley Cardboard Branch', ja:'路地裏ダンボール支店' }),
      tier:0, seed:20260803, shift:{ start:13, end:19 }, days:4,
      cats:[['감자',2,6]],
      todos:[[L({ ko:'첫 서류 올리기', en:'File the first paper', ja:'最初の書類を出す' }), true, false]] },
    { id:'f4', name:L({ ko:'만두', en:'Dumpling', ja:'マンドゥ' }), room:L({ ko:'냥코 소형 빌딩', en:'Nyanco Small Building', ja:'ニャンコ小型ビル' }),
      tier:3, seed:20260615, shift:{ start:8, end:17 }, days:112,
      cats:[['만두',0,0],['치즈',2,4],['호두',3,-6],['땅콩',1,18],['반달',4,-14],['도토리',3,7]],
      todos:[[L({ ko:'지점 회의 자료', en:'Branch meeting deck', ja:'支店会議の資料' }), true, true],
             [L({ ko:'신입 면접', en:'Interview a rookie', ja:'新人の面接' }), true, false],
             [L({ ko:'월말 정산', en:'Month-end books', ja:'月末の精算' }), false, true],
             [L({ ko:'캣타워 수리', en:'Fix the cat tower', ja:'キャットタワー修理' }), false, false]] },
  ];

  /* 지금 그 사무실은 근무 중인가. 이건 진도가 아니라 **켜 두었는가**다 —
     친구 칸에서 유일하게 실시간으로 움직이는 값이고, 그게 이 기능의 전부다. */
  function working(shift){
    const m = nowMin();
    const s = ((shift.start % 24) + 24) % 24 * 60;
    const len = (((shift.end - shift.start + 24) % 24) || 24) * 60;
    const d = ((m - s) % 1440 + 1440) % 1440;
    return d < len;
  }

  /* 마지막으로 올린 시각으로 「지금 켜 두었나」를 본다. 전송은 3분에 한 번 + 화면을
     덮을 때라(js/cloud.js), 6분을 넘겼으면 그 사람은 지금 이 게임을 보고 있지 않다. */
  const FRESH_MS = 6 * 60 * 1000;
  const fresh = at => { const t = Date.parse(at || ''); return !!t && (Date.now() - t) < FRESH_MS; };
  /* 언제 다녀갔나 — 화면에 적을 짧은 말. 분·시간·날까지만 센다(그 위는 「한참 전」이다). */
  function agoOf(at){
    const t = Date.parse(at || '');
    if (!t) return '';
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 6) return '';
    if (m < 60) return L({ ko:`${m}분 전`, en:`${m}m ago`, ja:`${m}分前` });
    const h = Math.round(m / 60);
    if (h < 24) return L({ ko:`${h}시간 전`, en:`${h}h ago`, ja:`${h}時間前` });
    const d = Math.round(h / 24);
    return d < 30 ? L({ ko:`${d}일 전`, en:`${d}d ago`, ja:`${d}日前` })
                  : L({ ko:'한참 전', en:'a while ago', ja:'ずっと前' });
  }

  const snapOf = f => ({
    v:1, id:f.id, name:f.name, room:f.room, tier:f.tier, seed:f.seed, shop:{},
    shift:f.shift, days:f.days,
    cats: f.cats.map(([name, fur, hue]) => ({ name, fur, hue })),
    todos: f.todos.map(([text, done, alarm]) => ({ text, done, alarm, late:false })),
    day: bizKey(),
  });

  /* ---------- 서버 ----------
     내 지점 한 줄을 올리고(branches), 친구들의 줄을 받아 온다. **올리는 것은
     mine() 이 만든 그 객체뿐이다** — 이 파일 맨 위의 약속이 서버에서도 그대로 규약이다.

     친구 맺기는 `friend_add(코드)` 한 함수로 한다. 코드로 남의 줄을 찾아야 하는데,
     그건 「아직 친구가 아닌 사람의 줄을 읽는다」라서 평소 규칙(친구만 읽는다)으로는
     막힌다. 그래서 그 한 걸음만 서버 함수 안에서 열어 둔다 — 코드를 정확히 맞힌
     사람에게만, 그 사람과 나를 서로의 친구로 넣는 일까지만. */
  /* 내 지점 한 줄만 올린다. **게시판과 상관없이** 돈다 — 아래 sync 는 게시판을 열 때만
     불리는데, 「불이 켜졌나」는 이 줄의 `updated_at` 하나로 판정한다(fresh). 그 줄을
     게시판을 열 때만 갱신하면 **하루 종일 켜 둔 사람이 친구에게는 「3시간 전」으로
     보인다** — 그건 이 기능이 파는 신호가 거짓이라는 뜻이다(sync 안의 주석).

     지점 등록도 여기서 같이 된다. 코드를 알려 주려면 게시판을 열어야 했고, 안 열어
     본 사람의 코드는 서버에 없어서 **상대가 「없는 코드」를 봤다.** */
  let adopted = false;
  async function doBeat(){
    const sb = sbOf();
    if (!sb) return false;
    try {
      const { data:{ session } } = await sb.auth.getSession();
      if (!session) return false;
      const me = session.user.id;

      /* 코드는 **한 번 정해지면 안 바뀐다.** 이 판에 처음 올릴 때 서버에 이미 줄이
         있으면 그쪽 코드를 따른다.

         왜 필요한가: 저장을 되돌린 기기(js/cloud.js restore)가 코드 없는 저장을
         받으면 `code()` 가 새로 하나 만들고, 그게 올라가면서 **친구에게 적어 준 코드가
         조용히 죽는다.** 먼저 정해진 쪽이 진짜다 — 코드는 남에게 건네는 물건이라
         이 기계의 사정으로 바뀌면 안 된다. 판마다 한 번만 물어본다. */
      if (!adopted){
        adopted = true;
        const { data: had } = await sb.from('branches')
          .select('code').eq('user_id', me).maybeSingle();
        if (had && had.code && had.code !== st().code){
          st().code = had.code;
          try { save(); } catch(e){}
        }
      }

      const put = () => sb.from('branches').upsert({
        user_id: me, code: code(), snap: mine(),
        updated_at: new Date().toISOString(),
      });
      let { error } = await put();
      /* **이 코드가 남의 것일 수 있다.** 저장은 이 기계에 남고 계정은 갈릴 수 있어서
         (로그아웃 뒤 새 익명 계정 · 남의 저장을 되돌린 기기), 저장에 실려 온 코드가
         이미 다른 계정에 붙어 있는 경우가 생긴다. `code` 는 unique 라 그때 이 줄은
         **아무 말 없이 안 써진다** — 그러면 남이 나를 못 찾고, 친구 목록에서도 내
         사무실만 빈칸으로 남는다. 오류도 없이.
         코드는 기계가 아니라 **계정에 붙는 물건**이라, 이럴 때는 이쪽이 새로 받는다. */
      if (error && /duplicate|already exists|23505/i.test(
            (error.message || '') + ' ' + (error.code || ''))){
        st().code = '';
        code();                       // 새로 하나 만든다(만들면서 저장까지 한다)
        ({ error } = await put());
      }
      if (error) return false;
      return true;
    } catch (e){ return false; }
  }

  /* 겹쳐 부르면 **같은 것을 기다린다** — 버리지 않는다.

     겹치면 안 되는 이유: 위에 코드를 새로 만드는 자리가 있어서, 두 번이 나란히
     들어오면 각자 다른 코드를 만들고 나중 것이 먼저 것을 덮는다(친구에게 적어 준
     코드가 그 순간 죽는다).

     그렇다고 **버리면 더 나쁘다.** 뒤에 온 쪽을 false 로 돌려보냈더니, 친구를 맺은
     직후 sync 가 올리기를 건너뛰어 **내 지점 줄이 아예 안 생겼다** — 상대 화면에서는
     관계는 있는데 사무실이 안 보이는, 오류 한 줄 없는 빈칸이 됐다.
     그래서 도는 약속을 그대로 돌려준다: 부른 쪽은 전부 끝난 것을 본다. */
  let inflight = null;
  function beat(){
    if (inflight) return inflight;
    inflight = doBeat().finally(() => { inflight = null; });
    return inflight;
  }

  async function sync(){
    const sb = sbOf();
    if (!sb) return false;
    try {
      const { data:{ session } } = await sb.auth.getSession();
      if (!session) return false;
      const me = session.user.id;
      /* 내 지점을 올린다. 코드는 이 기계가 만든 그것을 그대로 쓴다(형식이 규약이다).

         **결과를 보지 않는다.** 3분 타이머가 부르는 beat 와 겹치면 저쪽이 빗장에 걸려
         false 를 돌려주는데, 그걸 실패로 읽고 여기서 돌아서면 **목록을 안 받아 온다** —
         화면에서는 「수락했는데 아무도 없다」로 보인다. 올리는 일과 받아 오는 일은
         다른 일이고, 하나가 쉬었다고 다른 하나가 멈출 이유가 없다. */
      try { await beat(); } catch(e){}
      /* 친구 목록 → 그들의 지점. 두 번 물어본다(관계와 내용은 다른 표다). */
      const { data: rel, error: e1 } = await sb.from('friends')
        .select('friend_id').eq('owner_id', me);
      if (e1) return false;
      const ids = (rel || []).map(r => r.friend_id);
      let rows = [];
      if (ids.length){
        const { data, error } = await sb.from('branches')
          .select('user_id,snap,updated_at').in('user_id', ids);
        if (error) return false;
        rows = data || [];
      }
      CACHE.snaps = {};
      CACHE.list = rows.map(r => {
        const s = r.snap || {};
        CACHE.snaps[r.user_id] = { ...s, id: r.user_id, at: r.updated_at };
        /* **불이 켜졌는가는 이제 추측이 아니다.** 흉내였을 때는 저쪽 근무표로
           「지금 근무 시간인가」를 계산했는데, 그건 그 사람이 일주일을 안 켜도
           켜져 있다고 말한다. 서버에는 마지막으로 올린 시각이 있으므로 그걸 쓴다 —
           같이 있다는 신호가 이 기능이 파는 전부이고, 그 신호는 진짜여야 한다. */
        return { id:r.user_id, name:s.name || '?', room:s.room || '',
                 tier:s.tier | 0, days:s.days | 0,
                 working: fresh(r.updated_at), ago: agoOf(r.updated_at),
                 reacted: !!reacted(r.user_id) };
      });
      /* 받은 요청 — 아직 친구가 아니라서 저쪽 지점을 못 읽는다. 이름 한 줄만
         서버 함수가 꺼내 준다(사무실도 결재함도 안 넘어온다). */
      try {
        const { data: rq } = await sb.rpc('friend_reqs_in');
        CACHE.reqs = (rq || []).map(r => ({ id:r.from_id, name:r.name || '?', at:r.created_at }));
      } catch (e){ CACHE.reqs = []; }
      /* 받은 인사 — 오늘 누가 다녀갔나. 이게 이 기능이 실제로 파는 것이라
         목록보다 먼저 눈에 들어와야 한다(화면은 js/board.js). */
      try {
        const { data: gs } = await sb.from('greets')
          .select('from_id,kind,note,day').eq('to_id', me).eq('day', bizKey());
        CACHE.got = {};
        (gs || []).forEach(g => { CACHE.got[g.from_id] = { kind:g.kind, note:g.note || '' }; });
      } catch (e){ CACHE.got = {}; }
      CACHE.on = true;
      return true;
    } catch (e){ return false; }
  }

  /* 코드로 친구 맺기. 서버가 서로를 친구로 넣어 준다 — 한쪽만 넣으면 저쪽 화면에는
     내가 안 보이고, 그건 「제휴」가 아니라 구독이다. */
  async function add(codeText){
    const sb = sbOf();
    if (!sb) return { ok:false, why:'offline' };
    const t = String(codeText || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(t)) return { ok:false, why:'form' };
    try {
      const { data, error } = await sb.rpc('friend_add', {
        p_code: t.length === 8 ? t.slice(0, 4) + '-' + t.slice(4) : t });
      if (error) return { ok:false, why:'error', msg:error.message };
      if (!data || !data.ok) return { ok:false, why:(data && data.why) || 'notfound' };
      await sync();
      /* `linked` 를 **그대로 흘려보낸다**. 서버는 「그 자리에서 걸렸다(true)」와
         「요청만 갔다(false)」를 이 칸으로 말하는데, 여기서 지워 버리면 화면이
         둘을 구분 못 해서 걸렸는데도 「요청을 보냈습니다」라고 한다.
         칸이 없는 옛 서버에서는 undefined 로 남고, 그때는 화면이 걸린 것으로 읽는다. */
      return { ok:true, name:data.name, linked:data.linked };
    } catch (e){ return { ok:false, why:'error', msg:(e && e.message) }; }
  }

  async function drop(id){
    const sb = sbOf();
    if (!sb) return false;
    try {
      const { data:{ session } } = await sb.auth.getSession();
      await sb.from('friends').delete().eq('owner_id', session.user.id).eq('friend_id', id);
      await sync();
      return true;
    } catch (e){ return false; }
  }

  /* 수락 · 거절 · 차단. 셋 다 서버 함수를 지난다 — 관계는 **양쪽**을 건드리는 일이라
     한 자리에서만 일어나야 한다(표를 직접 쓰게 두면 한쪽만 걸린 상태가 생긴다). */
  const call = async (fn, args) => {
    const sb = sbOf();
    if (!sb) return { ok:false, why:'offline' };
    try {
      const { data, error } = await sb.rpc(fn, args || {});
      if (error) return { ok:false, why:'error', msg:error.message };
      await sync();
      return data || { ok:false, why:'error' };
    } catch (e){ return { ok:false, why:'error', msg:(e && e.message) }; }
  };
  const accept = id => call('friend_accept', { p_from: id });
  const reject = id => call('friend_reject', { p_from: id });
  const block  = id => call('friend_block',  { p_id: id });
  const reqs   = () => (CACHE.on ? CACHE.reqs : []);
  /* 오늘 나에게 온 인사. 없으면 빈 객체다 — 화면은 이걸로 「누가 다녀갔다」를 그린다. */
  const got    = () => (CACHE.on ? CACHE.got : {});

  /* ---------- 화면이 쓰는 문 ---------- */
  function list(){
    if (CACHE.on) return CACHE.list.map(f => ({ ...f, reacted: !!reacted(f.id) }));
    if (coming()) return [];          // 아직 모른다 — 흉내를 대신 내놓지 않는다
    return MOCK.map(f => ({ id:f.id, name:f.name, room:f.room, tier:f.tier,
                            working: working(f.shift), days:f.days,
                            reacted: !!reacted(f.id) }));
  }
  function snapshot(id){
    if (CACHE.on) return CACHE.snaps[id] || null;
    if (coming()) return null;
    const f = MOCK.find(x => x.id === id);
    return f ? snapOf(f) : null;
  }
  /* 오늘 이 지점에 인사를 보냈나. 하루가 지나면 다시 보낼 수 있다(업무일 기준). */
  function reacted(id){
    const r = st().sent[id];
    return r && r.day === bizKey() ? r : null;
  }
  /* 인사는 이제 **저쪽 화면까지 간다**(greets). 내 저장에도 그대로 적는다 —
     보낸 표시는 서버 대답을 기다리지 않고 바로 떠야 하고(눌렀는데 아무 일도 안 나면
     그건 고장이다), 서버가 안 되는 판에서도 「오늘 인사했다」는 남아야 한다.
     하루에 한 번이라는 규칙은 양쪽이 같이 지킨다: 여기서 한 번 막고,
     서버는 (to_id, from_id, day) 를 기본키로 두어 두 번째를 아예 못 받게 한다. */
  function react(id, kind, note){
    if (!snapshot(id)) return false;
    const today = bizKey();
    if (reacted(id)) return false;                     // 하루에 한 번
    const n = (note || '').slice(0, 40);
    st().sent[id] = { day: today, kind, note: n };
    try { save(); } catch(e){}
    const sb = sbOf();
    if (sb && CACHE.on){
      (async () => {
        try {
          const { data:{ session } } = await sb.auth.getSession();
          await sb.from('greets').insert({
            to_id: id, from_id: session.user.id, day: today, kind, note: n });
        } catch (e){}
      })();
    }
    return true;
  }
  /* 구경한 날 — 「오늘 다녀갔다」 표시에 쓴다. 남의 화면에 내 발자국을 남기는 건
     서버가 생긴 뒤의 일이고, 지금은 내 쪽 기록일 뿐이다. */
  function seen(id){
    if (!snapshot(id)) return;
    st().seen[id] = bizKey();
    try { save(); } catch(e){}
  }
  const seenOn = id => st().seen[id] || '';

  /* 3분마다 한 줄. 저장을 올리는 간격과 같다(js/cloud.js PUSH_MS) — 「불이 켜졌다」의
     창이 6분이라 3분이면 늘 그 안에 든다. 로그인이 게임보다 늦게 붙으므로 붙을 때까지
     몇 번 두드리고, 붙으면 바로 한 번 올린다(첫 신호를 3분 미루지 않는다). */
  const BEAT_MS = 3 * 60 * 1000;
  let woke = false;
  const wake = setInterval(async () => {
    if (woke) return;
    if (await beat()){ woke = true; clearInterval(wake); setInterval(beat, BEAT_MS); }
  }, 2000);
  setTimeout(() => clearInterval(wake), 90 * 1000);   // 안 붙으면 그만 두드린다

  return { source: SOURCE, code, mine, list, snapshot, react, reacted, seen, seenOn,
           sync, beat, add, drop, reqs, accept, reject, block, got };
})();
