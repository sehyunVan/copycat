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

/* 미리보기 띠 — 흉내를 진짜처럼 보여주지 않기 위한 한 줄. 서버가 붙으면 저절로 사라진다. */
const boardNote = () => FRIENDS.source() === 'mock'
  ? `<div class="prebadge">${L({
      ko:'미리보기 — 아직 이 기계 안에서만 돕니다. 지점 넷은 흉내고, 인사도 내 저장에만 남습니다.',
      en:'Preview — this runs only on this machine. The four branches are stand-ins; greetings stay in your own save.',
      ja:'プレビュー——まだこの機械の中だけで動きます。4支店は仮のもので、あいさつも自分のセーブにだけ残ります。' })}</div>`
  : '';

function showBoard(){
  bus.emit('board:open');     // 첫 출근 안내가 이 걸음을 기다린다 (js/tutor.js)
  const mo = modal(`
    <div class="mhead"><div class="q">📌 ${L({ ko:'제휴 게시판', en:'BRANCH BOARD', ja:'提携掲示板' })}</div>
      <h3>${L({ ko:'다른 지점을 구경합니다', en:'Look in on another branch', ja:'ほかの支店をのぞく' })}</h3>
      <p>${L({ ko:'오늘 그쪽 결재함과 사무실 도면을 볼 수 있습니다. 점수는 없습니다.',
               en:'Their inbox for today and the floor plan. No scores.',
               ja:'今日の決裁箱とオフィスの図面が見えます。点数はありません。' })}</p></div>
    <div class="mbody" id="boardBody"></div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);
  const body = mo.veil.querySelector('#boardBody');

  const draw = () => {
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
        <span class="lit-l">${f.working ? '●' : '○'} ${litLabel(f.working)}</span>
        ${f.reacted ? `<span class="sent">🐟 ${L({ ko:'오늘 인사함', en:'greeted today', ja:'今日あいさつ済み' })}</span>` : ''}
      </button>`).join('');
    body.innerHTML = boardNote() + `<div class="polas">${rows}</div>
      <div class="jukesec">${L({ ko:'내 지점 코드', en:'My branch code', ja:'自分の支店コード' })}</div>
      <div class="codebox"><code>${FRIENDS.code()}</code>
        <button class="buy alt" id="brCopy">${L({ ko:'복사', en:'Copy', ja:'コピー' })}</button></div>
      <div class="hint">${L({
        ko:'이 코드를 주고받아 지점을 묶는 건 서버가 온 뒤입니다. 코드 형식은 그때도 이대로입니다.',
        en:'Trading codes to link branches comes with the server. The format will stay exactly this.',
        ja:'コードを交換して支店をつなぐのはサーバーが来てからです。形式はそのままです。' })}</div>`;
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
  }
  draw();
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
    const photo = branchPhoto(snap, 420, 250);
    if (!visiting()) restoreOffice();
    body.innerHTML = boardNote() + `
      <div class="brlit ${f.working ? 'on' : ''}">${f.working ? '●' : '○'} ${litLabel(!!f.working)}</div>
      <img class="plan ${photo ? 'photo' : ''}" src="${photo || branchPlanURL(snap, 13)}" alt="">
      <button class="addbtn brenter" id="brEnter">🏢 ${L({
        ko:'사무실 구경하기', en:'Look around the office', ja:'オフィスを見て回る' })}</button>
      <div class="hint">${L({
        ko:'들어가면 <b>끌어서 돌려 볼 수 있습니다.</b> 그 사이에도 내 사무실은 그대로 돌아갑니다.',
        en:'Inside you can <b>drag to look around.</b> Your own office keeps running meanwhile.',
        ja:'入ると<b>ドラッグで見回せます。</b>その間も自分のオフィスは動き続けます。' })}</div>
      <div class="jukesec">${L({ ko:'오늘 저쪽 결재함', en:'Their inbox today', ja:'今日の決裁箱' })}</div>
      ${snap.todos.length
        ? snap.todos.map(t => `<div class="calrow ${t.done ? 'done' : ''}">${mark(t)}
            <span class="tx">${esc(t.text)}</span></div>`).join('')
        : `<div class="hint">${L({ ko:'아직 아무것도 올라오지 않았습니다.',
              en:'Nothing on it yet.', ja:'まだ何も上がっていません。' })}</div>`}
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
        ja:'🐟 はあいさつでお金ではありません——相手の稼ぎは1も変わりません。1日1回。' })}</div>`;
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
  }
  mo.veil.querySelector('#brBack').onclick = () => { mo.close(); showBoard(); };
  draw();
  return mo;
}
