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
  /* 지금 자료가 어디서 오는가. 서버가 붙으면 'server' 가 되고, 화면은 이 값을 보고
     「미리보기」 띠를 뗀다 — 흉내를 진짜처럼 보여주지 않는 게 이 값의 유일한 일이다. */
  const SOURCE = 'mock';

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

  const snapOf = f => ({
    v:1, id:f.id, name:f.name, room:f.room, tier:f.tier, seed:f.seed, shop:{},
    shift:f.shift, days:f.days,
    cats: f.cats.map(([name, fur, hue]) => ({ name, fur, hue })),
    todos: f.todos.map(([text, done, alarm]) => ({ text, done, alarm, late:false })),
    day: bizKey(),
  });

  /* ---------- 화면이 쓰는 문 ---------- */
  function list(){
    return MOCK.map(f => ({ id:f.id, name:f.name, room:f.room, tier:f.tier,
                            working: working(f.shift), days:f.days,
                            reacted: !!reacted(f.id) }));
  }
  function snapshot(id){
    const f = MOCK.find(x => x.id === id);
    return f ? snapOf(f) : null;
  }
  /* 오늘 이 지점에 인사를 보냈나. 하루가 지나면 다시 보낼 수 있다(업무일 기준). */
  function reacted(id){
    const r = st().sent[id];
    return r && r.day === bizKey() ? r : null;
  }
  function react(id, kind, note){
    if (!snapshot(id)) return false;
    const today = bizKey();
    if (reacted(id)) return false;                     // 하루에 한 번
    st().sent[id] = { day: today, kind, note: (note || '').slice(0, 40) };
    try { save(); } catch(e){}
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

  return { source: () => SOURCE, code, mine, list, snapshot, react, reacted, seen, seenOn };
})();
