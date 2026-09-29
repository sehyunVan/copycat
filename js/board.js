/* ============================================================
   board.js — 제휴 게시판 화면. 남의 사무실을 구경한다.

   자료는 js/friends.js 가 준다(지금은 흉내, 나중엔 서버). 이 파일은 **그것을 어떻게
   보여줄지**만 정하고, 그게 이 기능에서 제일 위험한 부분이다.

   ── 이 화면이 안 하는 것 ──

   달성률 · 연속 일수 · 순위 · "누가 더 많이 했나". 남의 진도가 내 화면에 숫자로 뜨면
   그건 구경이 아니라 비교고, 비교는 이 게임이 파는 것(같이 있다는 신호)의 정반대다.
   그래서 지점 칸에서 실시간으로 움직이는 값은 **불이 켜져 있나** 하나뿐이다.

   ── 사무실은 평면도로 보여준다 ──

   남의 사무실을 3D 로 들어가려면 지금 돌고 있는 사무실(W)과 고양이들을 갈아치워야 하고,
   그 사이 시뮬레이션은 남의 격자 위에서 길을 찾는다. 구경 한 번에 내 회사가 깨질 수 있는
   거래는 안 한다. 대신 **같은 생성기**(genOffice)에 그쪽 seed 를 넣어 평면도를 그린다 —
   흉내가 아니라 그 사람의 실제 배치이고, 서버가 보내는 것도 seed 하나면 된다.
   ============================================================ */

/* 평면도 색. 가구를 하나하나 그리지 않는다 — 도면은 "어디에 무엇이 몰려 있나"만 말하면 된다. */
const PLAN_COL = {
  wall:'#6B625A', floor:'#F6EFE2', door:'#3E9E82', desk:'#C69A6D',
  machine:'#98A3AE', rest:'#E0B48A', green:'#86BC8A', inbox:'#E8A33D', cat:'#E2705C',
};
function planKind(t){
  if (t === TILE.WALL) return 'wall';
  if (t === TILE.DOOR) return 'door';
  if (t === TILE.INBOX) return 'inbox';
  if (t === TILE.DESK || t === TILE.DESK_R || t === TILE.LEGAL || t === TILE.MEETING) return 'desk';
  if (t === TILE.PLANT || t === TILE.SCRATCH) return 'green';
  if (t === TILE.BED || t === TILE.TOWER || t === TILE.HAMMOCK || t === TILE.PERCH) return 'rest';
  if (t === TILE.FLOOR || t === TILE.FILLER) return 'floor';
  return 'machine';
}

/* 그 지점의 평면도 한 장. 캔버스로 그려서 data URI 로 돌려준다 —
   모달을 다시 그릴 때마다 캔버스가 날아가지 않게 <img> 로 박아 두려는 것이다. */
function branchPlanURL(snap, px){
  px = px || 11;
  const w = genOffice(snap.tier, snap.shop || {}, snap.seed);
  const cv = document.createElement('canvas');
  cv.width = w.W * px; cv.height = w.H * px;
  const g = cv.getContext('2d');
  g.fillStyle = PLAN_COL.floor; g.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < w.H; y++)
    for (let x = 0; x < w.W; x++){
      const k = planKind(w.grid[y * w.W + x]);
      if (k === 'floor') continue;
      g.fillStyle = PLAN_COL[k];
      g.fillRect(x * px, y * px, px, px);
    }
  /* 고양이는 자리에 앉혀 둔다. 남의 사무실에서 고양이가 걸어다니는 건 서버가 온 뒤의 일이고,
     지금 필요한 건 "몇 마리가 어디에 있나"다. */
  (snap.cats || []).forEach((c, i) => {
    const d = w.desks[i % Math.max(1, w.desks.length)];
    if (!d) return;
    const cx = d.seat.x * px + px / 2, cy = d.seat.y * px + px / 2;
    g.fillStyle = PLAN_COL.cat;
    g.beginPath(); g.arc(cx, cy, px * 0.34, 0, Math.PI * 2); g.fill();
  });
  return cv.toDataURL();
}

const litLabel = on => on
  ? L({ ko:'불이 켜져 있습니다', en:'The lights are on', ja:'灯りがついています' })
  : L({ ko:'문이 닫혀 있습니다', en:'The door is closed', ja:'ドアが閉まっています' });

/* ---------- 저쪽 결재함의 **날짜** ----------
   남의 자료는 그 사람이 게임을 켰을 때만 올라온다. 그런데 화면은 「오늘 저쪽 결재함」
   이라고 못박아 두었어서, 사흘 전에 마지막으로 켠 사람의 목록이 **오늘 것처럼** 보였다.
   자료에는 그날(snap.day)이 실려 있었는데 화면이 안 읽고 있었을 뿐이다.

   오늘이면 「오늘」, 아니면 며칠 전인지 적는다 — 남의 근황을 실제보다 새것으로
   보여주지 않는 것이 이 기능의 정직함이다. */
function inboxAge(day){
  if (!day) return null;
  const today = bizKey();
  if (day === today) return 0;
  /* 날짜 키(YYYY-MM-DD)를 날로 센다. 문자열 비교가 아니라 진짜 날 수여야
     월이 바뀌는 자리에서도 맞는다. */
  const d = Math.round((keyToDate(today) - keyToDate(day)) / 86400000);
  return d > 0 ? d : 0;
}
/* 저쪽이 **나에게** 두고 간 인사. 여태 인사는 내 저장에만 남아서, 보내는 쪽만 있고
   받는 쪽이 없었다 — 그건 인사가 아니라 혼잣말이다. 서버가 붙으면서 받는 쪽이 생겼고,
   그게 이 기능이 실제로 파는 것이라 보낼 칸보다 **위에** 둔다. */
function gotHTML(id){
  const g = (typeof FRIENDS.got === 'function' ? FRIENDS.got() : {})[id];
  if (!g) return '';
  return `<div class="jukesec">${L({
      ko:'오늘 다녀갔습니다', en:'They stopped by today', ja:'今日、来ていきました' })}</div>
    <div class="okbox">🐟 ${g.note
      ? `“${esc(g.note)}”`
      : L({ ko:'멸치 한 마리를 두고 갔습니다.', en:'Left you an anchovy.', ja:'いりこを一匹置いていきました。' })}</div>`;
}

function inboxHead(snap){
  const n = inboxAge(snap.day);
  const label = !n
    ? L({ ko:'오늘 저쪽 결재함', en:'Their inbox today', ja:'今日の決裁箱' })
    : n === 1
      ? L({ ko:'어제 저쪽 결재함', en:'Their inbox yesterday', ja:'昨日の決裁箱' })
      : L({ ko:`${n}일 전 저쪽 결재함`, en:`Their inbox, ${n} days ago`, ja:`${n}日前の決裁箱` });
  return `<div class="jukesec">${label}</div>` + (n ? `<div class="hint">${L({
    ko:'그 뒤로 사무실을 안 열었습니다 — 켜면 그때 다시 올라옵니다.',
    en:'They haven’t opened the office since — it refreshes when they do.',
    ja:'それ以来オフィスを開いていません——開けばまた上がってきます。' })}</div>` : '');
}

/* 미리보기 띠 — 흉내를 진짜처럼 보여주지 않기 위한 한 줄. 서버가 붙으면 저절로 사라진다. */
const boardNote = () => FRIENDS.source() === 'mock'
  ? `<div class="prebadge">${L({
      ko:'미리보기 — 아직 이 기계 안에서만 돕니다. 지점 넷은 흉내고, 인사도 내 저장에만 남습니다.',
      en:'Preview — this runs only on this machine. The four branches are stand-ins; greetings stay in your own save.',
      ja:'プレビュー——まだこの機械の中だけで動きます。4支店は仮のもので、あいさつも自分のセーブにだけ残ります。' })}</div>`
  : '';

function showBoard(){
  bus.emit('board:open');     // 열렸다는 신호. 첫 출근 안내가 쓰던 것 — 지금은 안 듣는다
  const mo = modal(`
    <div class="mhead"><div class="q">📌 ${L({ ko:'제휴 게시판', en:'BRANCH BOARD', ja:'提携掲示板' })}</div>
      <h3>${L({ ko:'다른 지점을 구경합니다', en:'Look in on another branch', ja:'ほかの支店をのぞく' })}</h3></div>
    <div class="mbody" id="boardBody"></div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);
  const body = mo.veil.querySelector('#boardBody');

  /* 서버를 몇 번 두드려 봤나. **「불러오는 중」과 「못 받아 왔다」를 가르는 건
     이 숫자다** — 자료층(js/friends.js)은 자기가 무엇을 들고 있는지만 알지,
     이 창이 얼마나 기다려 줬는지는 모른다. */
  let tries = 0;
  const TRIES = 6;

  const draw = () => {
    const src = FRIENDS.source();
    /* 사진을 먼저 다 찍고(내 방으로 되돌리는 것까지 branchPhotos 가 한다) 그 다음에 그린다.
       한 장씩 찍으면서 그리면 그 사이 프레임에 남의 방이 무대에 남는다. */
    const list = FRIENDS.list();
    const shots = branchPhotos(list.map(f => FRIENDS.snapshot(f.id)), 260, 168);
    const rows = list.map((f, i) => `
      <button class="pola ${f.working ? 'lit' : ''}" data-go="${f.id}">
        <span class="pin"></span>
        <img class="shot ${shots[i] ? 'photo' : ''}" src="${shots[i] || branchPlanURL(FRIENDS.snapshot(f.id), 7)}" alt="">
        <b>${esc(f.name)}</b>
        <span class="where">${esc(f.room)}</span>
        <span class="lit-l">${f.working ? '●' : '○'} ${f.working ? litLabel(true)
          : (f.ago || litLabel(false))}</span>
        ${f.reacted ? `<span class="sent">🐟 ${L({ ko:'오늘 인사함', en:'greeted today', ja:'今日あいさつ済み' })}</span>` : ''}
      </button>`).join('');
    const live = src === 'server';
    /* ── 받은 요청 ──
       코드를 아는 것만으로 서로 보이던 것을 고쳤다(2026-09-03). 이제 코드를 넣으면
       **요청**이 가고, 받은 쪽이 수락해야 걸린다. 그래서 이 줄이 목록보다 위에 있다 —
       기다리는 사람이 있는데 아래에 두면 그건 안 보이는 것과 같다. */
    const reqs = live ? FRIENDS.reqs() : [];
    const reqRows = reqs.length ? `<div class="jukesec">${L({
        ko:`받은 요청 ${reqs.length}건`, en:`${reqs.length} pending`, ja:`届いた申請 ${reqs.length}件` })}</div>`
      + reqs.map(r => `<div class="card reqrow"><div class="crow">
          <span class="em">🏢</span>
          <div class="info"><b>${esc(r.name)}</b><span>${L({
            ko:'지점을 묶자고 합니다', en:'wants to link branches', ja:'支店をつなごうと言っています' })}</span></div>
          <button class="buy" data-yes="${r.id}">${L({ ko:'수락', en:'Accept', ja:'承認' })}</button>
          <button class="buy alt" data-no="${r.id}">${L({ ko:'거절', en:'Decline', ja:'拒否' })}</button>
        </div></div>`).join('') : '';
    /* 지점 칸에 뭘 놓나 — **네 갈래고, 넷이 서로 다른 말을 한다.**
       목록이 있으면 목록. 없으면: 서버가 대답했는데 비었으면 「아직 없다」,
       아직 두드리는 중이면 「불러오는 중」, 다 두드려 봤는데 못 받았으면 그렇게 말한다.
       마지막 둘을 「아직 없다」로 뭉뚱그리면 **친구가 있는데 없다고 말하는 화면**이 된다. */
    const wait = src === 'wait';
    const gap = rows ? `<div class="polas">${rows}</div>`
      : live ? `<div class="empty">${L({
          ko:'아직 묶인 지점이 없습니다. 코드를 주고받으면 여기에 걸립니다.',
          en:'No branches linked yet. Trade codes and they show up here.',
          ja:'まだつながった支店がありません。コードを交換するとここに並びます。' })}</div>`
      : wait && tries < TRIES ? `<div class="empty">${L({
          ko:'지점을 불러오는 중입니다…', en:'Loading branches…', ja:'支店を読み込んでいます…' })}</div>`
      : wait ? `<div class="empty">${L({
          ko:'지금은 목록을 못 받아 왔습니다. 잠시 뒤에 다시 열어 주세요.',
          en:'Couldn’t fetch the list right now. Try opening it again in a moment.',
          ja:'いまは一覧を受け取れませんでした。少しあとでもう一度開いてください。' })}</div>`
      : '';
    body.innerHTML = boardNote() + reqRows + gap
      + `<div class="jukesec">${L({ ko:'내 지점 코드', en:'My branch code', ja:'自分の支店コード' })}</div>
      <div class="codebox"><code>${FRIENDS.code()}</code>
        <button class="buy alt" id="brCopy">${L({ ko:'복사', en:'Copy', ja:'コピー' })}</button></div>`
      + (live
        /* 서버가 붙었으므로 **코드를 받는 칸**이 생긴다. 여기가 「친구 추가」다 —
           이름으로 찾는 길은 두지 않는다(남을 검색할 수 있으면 그건 다른 물건이다). */
        ? `<div class="codebox"><input id="brCode" maxlength="9" autocomplete="off"
             placeholder="${L({ ko:'받은 코드', en:'Their code', ja:'もらったコード' })}">
             <button class="buy" id="brAdd">${L({ ko:'묶기', en:'Link', ja:'つなぐ' })}</button></div>`
        /* **기다리는 동안에는 이 줄을 안 적는다.** 「서버가 온 뒤입니다」는 서버가
           없는 판에서만 맞는 말이고, 대답을 기다리는 중에 이게 떠 있으면 조금 뒤
           나타날 묶기 칸과 서로 다른 말을 하게 된다. */
        : src === 'mock' ? `<div class="hint">${L({
             ko:'이 코드를 주고받아 지점을 묶는 건 서버가 온 뒤입니다. 코드 형식은 그때도 이대로입니다.',
             en:'Trading codes to link branches comes with the server. The format will stay exactly this.',
             ja:'コードを交換して支店をつなぐのはサーバーが来てからです。形式はそのままです。' })}</div>`
        : '');
    wire();
  };
  function wire(){
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
      sfx.add(); mo.close(); showBranch(b.dataset.go);
    });
    const cp = body.querySelector('#brCopy');
    if (cp) cp.onclick = () => {
      const t = FRIENDS.code();
      try { navigator.clipboard.writeText(t); } catch(e){}
      sfx.add();
      toast(L({ ko:`코드 ${t} 를 복사했습니다.`, en:`Copied ${t}.`, ja:`コード ${t} をコピーしました。` }));
    };
    /* 코드로 묶기. 실패한 이유를 **그대로 말해 준다** — 조용히 아무 일도 안 하면
       그건 고장으로 읽힌다(견본책에서 배운 것과 같은 규칙). */
    const ad = body.querySelector('#brAdd'), inp = body.querySelector('#brCode');
    if (ad && inp) ad.onclick = async () => {
      ad.disabled = true;
      const r = await FRIENDS.add(inp.value);
      ad.disabled = false;
      if (r.ok){
        sfx.buy(); inp.value = '';
        /* 저쪽이 이미 나에게 보내 뒀으면 그 자리에서 걸린다(linked). 아니면 요청만 간다 —
           그 차이를 말해 주지 않으면 「눌렀는데 목록에 없다」가 된다.
           `!== false` 인 이유: 수락 절차가 없던 시절의 서버는 이 칸을 안 보낸다(그때는
           넣는 즉시 걸렸다). 칸이 없으면 걸린 것으로 읽어야 옛 서버에서도 안 틀린다. */
        toast(r.linked !== false
          ? L({ ko:`${r.name} 지점과 묶었습니다.`, en:`Linked with ${r.name}.`, ja:`${r.name}支店とつながりました。` })
          : L({ ko:`${r.name} 지점에 요청을 보냈습니다. 저쪽이 수락하면 걸립니다.`,
                en:`Request sent to ${r.name}. It links when they accept.`,
                ja:`${r.name}支店に申請しました。相手が承認するとつながります。` }));
        draw();
        return;
      }
      sfx.err();
      toast(r.why === 'form' ? L({ ko:'코드 형식이 아닙니다 (예: ACDE-FGHJ)', en:'That isn’t a code (e.g. ACDE-FGHJ)', ja:'コードの形式ではありません（例: ACDE-FGHJ）' })
          : r.why === 'self' ? L({ ko:'내 코드입니다.', en:'That’s your own code.', ja:'自分のコードです。' })
          : r.why === 'already' ? L({ ko:'이미 묶인 지점입니다.', en:'Already linked.', ja:'すでにつながっています。' })
          : r.why === 'blocked' ? L({ ko:'차단해 둔 지점입니다.', en:'You blocked that branch.', ja:'ブロックした支店です。' })
          : r.why === 'offline' ? L({ ko:'서버에 연결되지 않았습니다.', en:'Not connected.', ja:'サーバーにつながっていません。' })
          : L({ ko:'그런 코드의 지점이 없습니다.', en:'No branch with that code.', ja:'そのコードの支店はありません。' }));
    };
    /* 수락 · 거절 */
    body.querySelectorAll('[data-yes]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const r = await FRIENDS.accept(b.dataset.yes);
      if (r && r.ok){ sfx.buy(); draw(); } else { sfx.err(); b.disabled = false; }
    });
    body.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const r = await FRIENDS.reject(b.dataset.no);
      if (r && r.ok){ sfx.add(); draw(); } else { sfx.err(); b.disabled = false; }
    });
  }
  draw();
  /* 서버 자료는 **뒤늦게** 온다(받아 놓고 쓰는 구조 — js/friends.js). 오면 다시 그린다:
     처음 한 판은 지난번 목록이고, 그걸 그대로 두면 남의 어제를 보여주게 된다.

     **한 번만 두드리면 안 된다.** 로그인은 게임보다 늦게 붙는데(js/cloud.js 는 저장이
     생긴 뒤에야 start 한다) 게시판은 그보다 먼저 열릴 수 있고, 그때 sync 는 서버
     손잡이가 없어서 그냥 false 를 돌려준다 — 한 번으로 끝내면 그 판의 게시판은
     창을 닫았다 다시 열 때까지 영영 비어 있다.
     창이 열려 있는 동안만, 정해진 횟수만 두드린다. */
  const pull = () => {
    let p;
    try { p = FRIENDS.sync(); } catch(e){ return; }
    p.then(ok => {
      if (!mo.veil.isConnected) return;          // 닫혔으면 그만둔다
      if (!ok) tries++;
      draw();
      if (!ok && tries < TRIES) setTimeout(pull, 1200);
    }, () => {});
  };
  pull();
  return mo;
}

/* ---------- 한 지점 ----------
   보이는 것: 도면 · 오늘 결재함 · 인사 하나. 그 이상은 안 보여준다.
   특히 **몇 건 중 몇 건**을 안 적는다 — 목록에 ✓ 가 있으면 사람은 이미 다 안다.
   숫자로 만드는 순간 그건 남의 하루에 붙은 점수가 된다. */
function showBranch(id){
  const snap = FRIENDS.snapshot(id);
  if (!snap) return;
  const f = FRIENDS.list().find(x => x.id === id) || {};
  FRIENDS.seen(id);

  const mark = t => t.done ? '<span class="ok">✓</span>'
                  : t.alarm ? '<span class="alm">⏰</span>' : '<span class="dot">·</span>';
  const mo = modal(`
    <div class="mhead"><div class="q">🏢 ${L({ ko:'제휴 지점', en:'BRANCH', ja:'提携支店' })}</div>
      <h3>${esc(snap.name)}</h3>
      <p>${esc(snap.room)} · ${L({ ko:`${snap.days}일째`, en:`day ${snap.days}`, ja:`${snap.days}日目` })}</p></div>
    <div class="mbody" id="brBody"></div>
    <div class="mfoot">
      <button class="okbtn alt" id="brBack">${L({ ko:'게시판으로', en:'Back to board', ja:'掲示板へ' })}</button>
      <button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button>
    </div>`);
  const body = mo.veil.querySelector('#brBody');

  const draw = () => {
    const sent = FRIENDS.reacted(id);
    /* 한 장짜리도 branchPhotos 를 지난다 — 되돌리는 규칙(무대를 건드렸을 때만)이
       거기 한 곳에만 적혀 있어야 한다. 여기 한 벌 더 적으면 그 둘이 갈린다. */
    const photo = branchPhotos([snap], 420, 250)[0];
    body.innerHTML = boardNote() + `
      <div class="brlit ${f.working ? 'on' : ''}">${f.working ? '●' : '○'} ${litLabel(!!f.working)}</div>
      <img class="plan ${photo ? 'photo' : ''}" src="${photo || branchPlanURL(snap, 13)}" alt="">
      <button class="addbtn brenter" id="brEnter">🏢 ${L({
        ko:'사무실 구경하기', en:'Look around the office', ja:'オフィスを見て回る' })}</button>
      <div class="hint">${L({
        ko:'들어가면 <b>끌어서 돌려 볼 수 있습니다.</b> 그 사이에도 내 사무실은 그대로 돌아갑니다.',
        en:'Inside you can <b>drag to look around.</b> Your own office keeps running meanwhile.',
        ja:'入ると<b>ドラッグで見回せます。</b>その間も自分のオフィスは動き続けます。' })}</div>
      ${inboxHead(snap)}
      ${snap.todos.length
        ? snap.todos.map(t => `<div class="calrow ${t.done ? 'done' : ''}">${mark(t)}
            <span class="tx">${esc(t.text)}</span></div>`).join('')
        : `<div class="hint">${L({ ko:'아직 아무것도 올라오지 않았습니다.',
              en:'Nothing on it yet.', ja:'まだ何も上がっていません。' })}</div>`}
      ${gotHTML(id)}
      <div class="jukesec">${L({ ko:'인사', en:'Say hello', ja:'あいさつ' })}</div>
      ${sent
        ? `<div class="okbox">${L({
             ko:`오늘 인사를 보냈습니다. ${sent.note ? `— “${esc(sent.note)}”` : ''}`,
             en:`You said hello today. ${sent.note ? `— “${esc(sent.note)}”` : ''}`,
             ja:`今日あいさつを送りました。${sent.note ? `——「${esc(sent.note)}」` : ''}` })}</div>`
        : `<div class="addbox notebox">
             <input id="brNote" maxlength="40" autocomplete="off" placeholder="${L({
               ko:'쪽지 한 줄 (안 써도 됩니다)', en:'One line (optional)', ja:'ひとこと（任意）' })}">
             <button class="addbtn" id="brSend">🐟 ${L({ ko:'멸치 한 마리 두고 가기', en:'Leave an anchovy', ja:'いりこを置いていく' })}</button>
           </div>`}
      <div class="hint">${L({
        ko:'🐟 는 인사고 멸치가 아닙니다 — 저쪽 벌이는 1도 변하지 않습니다. 하루에 한 번.',
        en:'The 🐟 is a greeting, not currency — their earnings do not change at all. Once a day.',
        ja:'🐟 はあいさつでお金ではありません——相手の稼ぎは1も変わりません。1日1回。' })}</div>`
      /* 끊기와 차단 — **맨 아래, 조용히.** 자주 쓸 것이 아니고, 위에 두면 남의 사무실을
         보러 온 화면이 관리 화면이 된다. 차단은 되돌리기가 번거로우므로 한 번 묻는다. */
      + (FRIENDS.source() === 'server' ? `
      <div class="jukesec">${L({ ko:'이 지점과', en:'This branch', ja:'この支店と' })}</div>
      <div class="codebox">
        <button class="buy alt" id="brDrop">${L({ ko:'끊기', en:'Unlink', ja:'解除' })}</button>
        <button class="buy alt" id="brBlock">${L({ ko:'차단', en:'Block', ja:'ブロック' })}</button>
      </div>
      <div class="hint">${L({
        ko:'끊으면 서로의 목록에서 빠집니다. 차단하면 그 지점은 다시 코드를 넣어도 못 겁니다.',
        en:'Unlinking removes you from each other’s lists. Blocking also stops them re-adding you by code.',
        ja:'解除すると互いの一覧から外れます。ブロックするとコードを入れても再びつなげません。' })}</div>` : '');
    wire();
  };
  function wire(){
    const go = body.querySelector('#brEnter');
    if (go) go.onclick = () => {
      /* 창을 먼저 닫는다 — 방을 보러 들어가는데 창이 그 방을 덮고 있으면 안 된다.
         나올 때 게시판으로 되돌려 준다(visitEnd 의 back). */
      if (visitStart(id)) mo.close();
    };
    const b = body.querySelector('#brSend');
    if (b) b.onclick = () => {
      const note = body.querySelector('#brNote');
      if (FRIENDS.react(id, 'fish', note ? note.value : '')){
        sfx.coin();
        toast(L({ ko:`${snap.name} 지점에 멸치 한 마리를 두고 왔습니다.`,
                  en:`Left an anchovy at ${snap.name}.`,
                  ja:`${snap.name}にいりこを1匹置いてきました。` }));
      } else sfx.err();
      draw();
    };
    const dp = body.querySelector('#brDrop');
    if (dp) dp.onclick = async () => {
      dp.disabled = true;
      await FRIENDS.drop(id);
      sfx.add();
      toast(L({ ko:'끊었습니다.', en:'Unlinked.', ja:'解除しました。' }));
      mo.close(); showBoard();
    };
    const bl = body.querySelector('#brBlock');
    if (bl) bl.onclick = async () => {
      /* 되돌리기가 번거로운 조작이라 한 번 묻는다 — 이 게임에서 확인을 받는 것은
         「처음부터 다시 시작」과 여기뿐이다. */
      if (!confirm(L({ ko:`${snap.name} 지점을 차단할까요? 다시 걸 수 없게 됩니다.`,
                       en:`Block ${snap.name}? They won’t be able to link again.`,
                       ja:`${snap.name}をブロックしますか？再びつなげなくなります。` }))) return;
      bl.disabled = true;
      await FRIENDS.block(id);
      sfx.err();
      toast(L({ ko:'차단했습니다.', en:'Blocked.', ja:'ブロックしました。' }));
      mo.close(); showBoard();
    };
  }
  mo.veil.querySelector('#brBack').onclick = () => { mo.close(); showBoard(); };
  draw();
  return mo;
}
