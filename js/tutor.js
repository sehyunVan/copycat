/* ============================================================
   tutor.js — 첫 출근 안내.

   ── 왜 필요했나 ──

   조작 설명은 원래 사규(❓) 안에 텍스트로 있었다. **아무도 안 읽는다.**
   그리고 이 게임에는 읽지 않으면 억울해지는 규칙이 하나 있다 —
   **밀린 서류는 밖으로 새고, 새면 냥찰이 온다.** 경고 없이 당하면 그건 난이도가
   아니라 함정이고, 미리 알면 압박이 아니라 규칙이 된다.

   ── 어떻게 가르치나 ──

   읽히지 않는다는 걸 전제로 만든다. 그래서 **읽는 게 아니라 시키는** 안내다:

     1. 할 일을 하나 올린다        → 실제로 올려야 다음으로 간다
     2. 체크한다                   → 서류가 결재함에 떨어지는 걸 눈으로 본다
     3. 그 사이에 시점을 익힌다     → 고양이가 걸어오는 몇 초를 그냥 버리지 않는다
     4. 도장이 찍히고 멸치가 들어온다 → 이 게임의 사업 방식 전부
     5~8. 이 방에 만질 수 있는 것 넷 → 카메라가 하나씩 클로즈업한다 (아래 주석)
     9. 그리고 경고 한 장

   각 단계는 **진짜 이벤트**로 넘어간다(bus). 「다음」을 눌러서 넘기는 안내는
   결국 아무도 아무것도 안 한 채로 끝난다.

   문구는 **사규·총무 편지와 같은 톤**이다. 튜토리얼도 사내 문서여야 한다 —
   갑자기 게임이 말을 걸면 프롤로그가 세워 둔 것이 그 자리에서 무너진다.
   그리고 생산성으로 협박하지 않는다 (STORY.md 톤 규칙 1).
   ============================================================ */

/* ---------- 이 방에 만질 수 있는 것 넷 ----------
   프롤로그가 끝나면 사람은 결재함만 본다. 사무실은 배경이 되고, 벽에 걸린 달력과 게시판은
   **끝까지 그림으로 남는다** — 실제로 그랬다. 그래서 안내가 하나씩 **클로즈업**해 준다:
   카메라를 그 앞으로 데려가고, 그 자리에 고리를 씌우고, 한 문장으로 말한다.

   각 걸음은 **진짜로 열어야** 넘어간다(`juke:open` · `cal:open` · `board:open` · `edit:on`).
   「나중에」로 넘길 수도 있지만, 그때는 적어도 그것이 어디 있는지는 보고 지나간다.

   3D 가 없는 화면(단일 파일 배포본)에서는 카메라가 없으므로 클로즈업을 건너뛴다 —
   고리는 무대 전체에 두르고 문구가 어디를 보라고 말한다. 없는 것을 가리키지 않는다. */
const tutCell = {
  juke(){ return tutFindTile(TILE.JUKE); },
  cal(){ return tutWallItem(TILE.CAL); },
  board(){ return tutWallItem(TILE.BOARD); },
  desk(){ const d = (W && W.desks && W.desks[0]); return d ? { x:d.x, y:d.y } : null; },
};
function tutFindTile(t){
  if (!W || !W.grid) return null;
  for (let y = 0; y < W.H; y++)
    for (let x = 0; x < W.W; x++)
      if (W.grid[y * W.W + x] === t) return { x, y };
  return null;
}
function tutWallItem(t){
  const d = ((W && W.wallDecor) || []).find(z => z.tile === t);
  return d ? { x:d.x, y:d.y, face:d.face || 'n' } : null;
}

/* 화면 위의 그 자리. 3D 좌표를 투사해서 **보이지 않는 손잡이**를 그 위에 놓고,
   고리와 안내판은 원래대로 그 손잡이를 따라간다 — 배치 로직은 한 줄도 안 바뀐다. */
function tutSpot(cell, up){
  const vp = $('#viewport');
  /* 폰에서는 화면이 한 번에 하나다 — 무대가 다른 탭에 가 있으면 가구를 가리켜도
     결재함 위에 고리가 떠 있을 뿐이다. 무대 탭으로 데려간다(js/col.js).
     손잡이는 body 에 붙어 있어서 colFor 가 알아볼 수 없으므로 무대를 대신 준다. */
  if (typeof colReveal === 'function' && vp) colReveal(vp);
  if (!cell || !TUT || !TUT.spot) return vp;
  if (!(typeof is3d === 'function' && is3d() && typeof R3 !== 'undefined' && R3 && R3.ready)) return vp;
  const p = R3.project(cell.x, cell.y, up);
  if (!p) return vp;
  const b = vp.getBoundingClientRect();
  const el = TUT.spot;
  el.style.display = 'block';
  /* 48 = 손잡이의 절반(style.css .tutspot). 투사한 점은 **칸의 중심**이고 가구 메시는
     벽에 붙어 조금 밀려 있어서, 고리가 작으면 물건 옆의 빈 바닥을 두른다. */
  el.style.left = (b.left + p.x - 48) + 'px';
  el.style.top  = (b.top + p.y - 48) + 'px';
  return el;
}

const TUTOR_STEPS = [
  {
    id: 'add',
    at: () => $('#panelInbox .addbox'),
    on: 'todo:add',
    t: L({ ko:'1. 오늘 할 일을 하나 올리십시오', en:'1. File one thing you have to do today', ja:'1. 今日やることをひとつ出してください' }),
    b: L({
      ko:'이 회사의 입력은 <b>당신의 할 일</b>입니다. 진짜로 오늘 해야 하는 걸 적으십시오 — '
       + '크기(작음·보통·큼)는 성과에만 영향을 줍니다.',
      en:'This company’s input is <b>your own to-do list</b>. Write something you actually have to do today. '
       + 'The size (small / medium / large) only changes the payoff.',
      ja:'この会社の入力は<b>あなたのやること</b>です。本当に今日やるべきことを書いてください。'
       + 'サイズ（小・中・大）は成果にだけ影響します。' }),
  },
  {
    id: 'done',
    at: () => $('#todoList .todo') || $('#todoList'),
    on: 'todo:done',
    t: L({ ko:'2. 끝냈으면 체크하십시오', en:'2. Check it off when it’s done', ja:'2. 終わったらチェックしてください' }),
    b: L({
      ko:'체크하는 순간 <b>서류가 사무실 결재함에 실제로 떨어집니다.</b> '
       + '아직 돈이 되지는 않습니다 — 누군가 도장을 찍어야 합니다.',
      en:'The moment you check it, <b>a document physically drops into the office inbox.</b> '
       + 'It is not money yet — somebody has to stamp it.',
      ja:'チェックした瞬間、<b>書類がオフィスの決裁箱に実際に落ちます。</b>'
       + 'まだお金にはなりません——誰かが判を押す必要があります。' }),
  },
  {
    id: 'cam',
    at: () => $('#viewport'),
    only3d: true,
    wait: 9,                              // 고양이가 걸어오는 동안만 잡아 둔다
    t: L({ ko:'3. 걸어오는 동안 시점을 익히십시오', en:'3. Learn the camera while they walk over', ja:'3. 歩いてくる間に視点を覚えてください' }),
    b: L({
      ko:'<b>드래그</b>로 화면을 끌어 옮기고, <b>오른쪽 드래그</b>(또는 두 손가락)로 사무실을 돌립니다. '
       + '<b>휠</b>은 커서 아래를 확대하고, <b>0</b>을 누르면 전체가 보입니다. '
       + '<b>🎥</b>는 고양이 따라가기입니다.',
      en:'<b>Drag</b> to move the view, <b>right-drag</b> (or two fingers) to turn the office. '
       + 'The <b>wheel</b> zooms toward the cursor and <b>0</b> shows the whole floor. '
       + '<b>🎥</b> follows the cats.',
      ja:'<b>ドラッグ</b>で画面を動かし、<b>右ドラッグ</b>（または2本指）でオフィスを回します。'
       + '<b>ホイール</b>はカーソルの下を拡大、<b>0</b>で全体表示。'
       + '<b>🎥</b>は猫の追尾です。' }),
  },
  {
    id: 'stamp',
    at: () => $('#viewport'),
    on: 'reward',
    /* 3번(시점)에서 9초를 붙잡아 두는 사이에 고양이가 벌써 도장을 찍어 버릴 수 있다.
       그러면 이 걸음은 **오지 않을 이벤트**를 기다리며 영원히 멈춘다 — 실제로 그랬다.
       이미 찍혔으면 문장만 보여 주고 저절로 넘어간다. */
    already: () => !!(S && S.stats && S.stats.done),
    t: L({ ko:'4. 도장이 찍히면 멸치가 들어옵니다', en:'4. Anchovies arrive when it gets stamped', ja:'4. 判が押されると煮干しが入ります' }),
    b: L({
      ko:'가까운 고양이가 걸어와 서류를 물고, <b>자기 자리에 앉아</b> 도장을 찍습니다. '
       + '그때 멸치와 성과가 들어옵니다. 자리에 앉아 있어야 버는 회사입니다.',
      en:'The nearest cat walks over, takes the document, and stamps it <b>at their own desk</b>. '
       + 'That is when the anchovies and the KPI land. This company only earns while people are seated.',
      ja:'近くの猫が歩いてきて書類をくわえ、<b>自分の席で</b>判を押します。'
       + 'そのとき煮干しと成果が入ります。席に着いていないと稼げない会社です。' }),
  },
  /* ---- 이 방에 만질 수 있는 것 넷. 하나씩 클로즈업한다 ---- */
  {
    id: 'juke',
    at: () => tutSpot(tutCell.juke(), 0.5),
    cam: { cell: () => tutCell.juke(), up: 0.45, el: 0.5, zoom: 0.52 },
    on: 'juke:open',
    t: L({ ko:'5. 💿 CD 플레이어 — 오늘은 뭘 틀까요',
           en:'5. 💿 The CD player — what are we playing today',
           ja:'5. 💿 CDプレーヤー——今日は何をかけますか' }),
    b: L({
      ko:'문 옆에 있습니다. <b>누르면 배경음악을 고릅니다</b> — 갖고 있는 곡, 멸치로 사는 음반, '
       + '사무실에서 나오는 테이프, 그리고 <b>유튜브 링크</b>. 음량도 여기서 조절합니다.<br>'
       + '고양이들도 그 앞에 모입니다.',
      en:'It is by the door. <b>Click it to pick the background music</b> — what you own, records you can '
       + 'buy with anchovies, tapes that turn up in the office, and a <b>YouTube link</b>. The volume lives '
       + 'here too.<br>The cats gather in front of it.',
      ja:'ドアの横にあります。<b>押すとBGMを選べます</b>——持っている曲、煮干しで買うレコード、'
       + 'オフィスから出てくるテープ、そして<b>YouTubeのリンク</b>。音量もここです。<br>'
       + '猫たちもその前に集まります。' }),
  },
  {
    id: 'cal',
    at: () => tutSpot(tutCell.cal(), 1.5),
    cam: { cell: () => tutCell.cal(), up: 1.3, el: 0.36, zoom: 0.52 },
    on: 'cal:open',
    t: L({ ko:'6. 📅 벽걸이 달력 — 어느 날의 일인가',
           en:'6. 📅 The wall calendar — which day is it for',
           ja:'6. 📅 壁掛けカレンダー——どの日の仕事か' }),
    b: L({
      ko:'벽에 걸려 있습니다. <b>누르면 열립니다.</b> 지난 날짜를 누르면 그날 무엇을 냈는지 보이고, '
       + '<b>앞날에 미리 적어 두면 그날 아침에 결재함으로 올라옵니다.</b><br>'
       + '아래쪽 <b>🔁 루틴</b> 칸에 매일 하는 일을 정해 두면 그것도 매일 아침 올라와 있습니다.',
      en:'It hangs on the wall. <b>Click it.</b> A past day shows what you filed; <b>write ahead on a future '
       + 'day and it reaches the inbox that morning.</b><br>The <b>🔁 Routines</b> panel below holds the '
       + 'chores you do every day.',
      ja:'壁に掛かっています。<b>押すと開きます。</b>過去の日を押すとその日に何を出したかが見え、'
       + '<b>先の日に書いておくとその日の朝、決裁箱に上がります。</b><br>'
       + '下の<b>🔁 ルーティン</b>欄には毎日やることを入れておけます。' }),
  },
  {
    id: 'board',
    at: () => tutSpot(tutCell.board(), 1.5),
    cam: { cell: () => tutCell.board(), up: 1.3, el: 0.36, zoom: 0.52 },
    on: 'board:open',
    t: L({ ko:'7. 📌 제휴 게시판 — 다른 지점을 구경합니다',
           en:'7. 📌 The branch board — look in on another branch',
           ja:'7. 📌 提携掲示板——ほかの支店をのぞく' }),
    b: L({
      ko:'벽에 붙은 사진들입니다. <b>누르면 다른 지점의 오늘 결재함과 사무실을 구경할 수 있습니다</b> — '
       + '들어가면 끌어서 돌려 볼 수도 있습니다. 점수는 없습니다.<br>'
       + '<span class="tiny">아직 이 기계 안에서만 도는 미리보기입니다.</span>',
      en:'Those are the photos pinned to the wall. <b>Click it to look in on another branch’s inbox and '
       + 'office</b> — you can walk in and drag to look around. There are no scores.<br>'
       + '<span class="tiny">A preview that runs only on this machine for now.</span>',
      ja:'壁に留めた写真です。<b>押すとほかの支店の今日の決裁箱とオフィスをのぞけます</b>——'
       + '入ってドラッグで見回すこともできます。点数はありません。<br>'
       + '<span class="tiny">まだこの機械の中だけで動くプレビューです。</span>' }),
  },
  {
    id: 'edit',
    at: () => $('#btnEdit'),
    /* 여기만 클로즈업이 아니다. 배치는 방 전체의 이야기라 **한 걸음 물러서서** 보여준다 —
       기본 3/4 각(0.72)으로 되돌리고 방이 다 들어오는 거리에 세운다. */
    cam: { cell: () => ({ x: Math.floor((W ? W.W : 10) / 2), y: Math.floor((W ? W.H : 8) / 2) }),
           up: 0.5, el: 0.55, zoom: 0.78, az: 0.72 },
    on: 'edit:on',
    t: L({ ko:'8. 🛋️ 가구는 직접 옮깁니다',
           en:'8. 🛋️ You move the furniture yourself',
           ja:'8. 🛋️ 家具は自分で動かします' }),
    b: L({
      ko:'상단 <b>🛋️</b> 를 누르면 배치 모드입니다. <b>옮길 물건을 누르고, 놓을 자리를 누르면 끝입니다.</b> '
       + '한 칸짜리는 <b>R</b> 로 돌아갑니다. 길이 막히는 배치는 <b>빨간 칸으로 거부</b>됩니다 — '
       + '고양이가 구석에 갇히면 안 되기 때문입니다.<br>배치는 그대로 저장됩니다. 여기가 당신 사무실입니다.',
      en:'The <b>🛋️</b> up top opens decorate mode. <b>Click the piece, then click where it goes.</b> '
       + 'Single-tile pieces turn with <b>R</b>. Layouts that block the way are <b>refused in red</b> — '
       + 'no cat may end up trapped in a corner.<br>The layout is saved. This is your office.',
      ja:'上の<b>🛋️</b>で模様替えモードです。<b>動かす物を押して、置く場所を押すだけ。</b>'
       + '1マスのものは<b>R</b>で回ります。道をふさぐ配置は<b>赤いマスで拒否</b>されます——'
       + '猫が隅に閉じ込められてはいけないからです。<br>配置はそのまま保存されます。ここがあなたのオフィスです。' }),
  },
  {
    id: 'warn',
    at: () => $('#penChip'),
    t: L({ ko:'9. 그리고 이것만은 알고 계십시오', en:'9. And this one thing you must know', ja:'9. これだけは知っておいてください' }),
    b: L({
      ko:'줄마다 <b>⏰ 기한</b>을 걸 수 있습니다. <b>걸어 둔 건을 그날 안에 못 내면 서류가 밖으로 새고</b> '
       + '<b>혐의</b>가 쌓입니다. 혐의가 넘치면 <b>냥찰이 압수수색을 옵니다.</b><br><br>'
       + '<b>기한은 기본값이 아닙니다.</b> 안 걸면 아무 일도 없습니다 — 마감을 정하는 건 회사가 아니라 '
       + '당신입니다. 그리고 샌 건도 <b>늦게라도 처리하면 그 혐의는 지워집니다.</b>',
      en:'Each line can carry a <b>⏰ deadline</b>. <b>Miss it and the paperwork leaks out</b>, and '
       + '<b>suspicion</b> builds. Enough suspicion and <b>the Pawlice raid us.</b><br><br>'
       + '<b>Deadlines are not the default.</b> Without one, nothing happens — the due date is set by you, '
       + 'not by the company. And a leaked item still clears its suspicion <b>if you file it late.</b>',
      ja:'各行に<b>⏰ 期限</b>を掛けられます。<b>掛けた件をその日のうちに出せないと書類が外に漏れ</b>、'
       + '<b>容疑</b>が積み上がります。容疑が溢れると<b>ニャン察が家宅捜索に来ます。</b><br><br>'
       + '<b>期限は既定値ではありません。</b>掛けなければ何も起きません——締め切りを決めるのは会社ではなく'
       + 'あなたです。漏れた件も<b>遅れてでも処理すれば容疑は消えます。</b>' }),
  },
];

let TUT = null;              // { i, ring, panel, raf, timer }
const TUT_ARMED = new Set();  // bus 에 이미 핸들러를 걸어 둔 이벤트 이름

const tutorRunning = () => !!TUT;

function tutorSteps(){
  const on3d = typeof is3d === 'function' && is3d();
  return TUTOR_STEPS.filter(s => !s.only3d || on3d);
}

function tutorEnd(done){
  if (!TUT) return;
  cancelAnimationFrame(TUT.raf);
  if (TUT.timer) clearTimeout(TUT.timer);
  TUT.ring.remove(); TUT.panel.remove();
  if (TUT.spot) TUT.spot.remove();
  /* 클로즈업으로 데려간 카메라는 되돌려 놓고 나간다 — 안내가 끝났는데 벽만 보이면
     그건 안내가 남긴 사고다. */
  if (TUT.aimed && typeof R3 !== 'undefined' && R3 && R3.ready) R3.camReset(true);
  TUT = null;
  if (S){ S.tutor = 1; save(); }
  bus.emit('tutor:done', { done: !!done });
}

/* 고리와 안내판을 대상 옆에 붙인다. 대상은 화면이 바뀌면 움직인다(패널 접기·리사이즈·
   결재함에 줄이 늘어나기) — 그래서 좌표를 기억하지 않고 매 프레임 다시 읽는다. */
function tutorPlace(now){
  if (!TUT) return;
  /* 활강은 여기서 밀어 준다 — 안내판을 붙이는 루프가 이미 매 프레임 돌고 있다 */
  const t = now || performance.now();
  const dt = Math.min(0.05, Math.max(0, (t - (TUT.last || t)) / 1000));
  TUT.last = t;
  tutorGlide(dt);
  const s = tutorSteps()[TUT.i];
  let el = s && s.at && s.at();
  /* 한 기둥과 탭 바에서는 화면이 한 번에 하나다. 가리킬 것이 지금 안 보이는
     탭에 있으면 **그 탭으로 데려간다** — 없는 것을 동그라미 치는 안내판은
     안내가 아니다. 단계마다 탭 이름을 적어 두는 대신 그 요소가 어디 사는지
     묻는다(js/col.js 의 colReveal) — 단계가 늘어도 여기 손댈 일이 없다. */
  if (typeof colReveal === 'function' && el && colReveal(el)){
    el = (s && s.at && s.at()) || el;      // 탭이 바뀌면 요소가 새로 그려질 수 있다
  }
  const R = TUT.ring, P = TUT.panel;
  if (!el){ R.style.display = 'none'; }
  else {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height){ R.style.display = 'none'; }
    else {
      R.style.display = 'block';
      R.style.left = (b.left - 6) + 'px'; R.style.top = (b.top - 6) + 'px';
      R.style.width = (b.width + 12) + 'px'; R.style.height = (b.height + 12) + 'px';
    }
  }
  /* 안내판은 대상 옆 — 오른쪽에 자리가 있으면 오른쪽, 없으면 아래, 그것도 없으면 위.
     그리고 화면 밖으로는 절대 안 나간다. 나간 안내판은 없는 안내판이다. */
  const pw = P.offsetWidth || 320, ph = P.offsetHeight || 160;
  const vw = innerWidth, vh = innerHeight;
  let x, y;
  if (el){
    const b = el.getBoundingClientRect();
    /* 가구를 클로즈업한 걸음에서는 **아래를 먼저** 본다. 오른쪽에 붙이면 안내판이
       방금 클로즈업한 그 물건을 덮는다 — 가리키면서 가리는 셈이다. */
    if (s && s.cam && b.bottom + 14 + ph < vh){ x = Math.max(10, b.left - pw / 2 + 30); y = b.bottom + 14; }
    else if (b.right + 18 + pw < vw){ x = b.right + 18; y = b.top; }
    else if (b.bottom + 14 + ph < vh){ x = b.left; y = b.bottom + 14; }
    else if (b.left - 18 - pw > 0){ x = b.left - 18 - pw; y = b.top; }
    else { x = (vw - pw) / 2; y = vh - ph - 22; }
  } else { x = (vw - pw) / 2; y = vh - ph - 22; }
  P.style.left = Math.max(10, Math.min(vw - pw - 10, x)) + 'px';
  P.style.top  = Math.max(10, Math.min(vh - ph - 10, y)) + 'px';
  TUT.raf = requestAnimationFrame(tutorPlace);
}

/* 카메라를 그 앞으로 데려간다. 끊어 붙이지 않고 **미끄러뜨린다** — 클로즈업이 순간이동이면
   어디로 갔는지 알 수 없고, 사람은 자기가 뭘 보고 있는지 모른 채 다음 문장을 읽는다.
   0.5초면 눈이 따라온다. */
function tutorAim(s){
  if (!TUT) return;
  const on3d = typeof is3d === 'function' && is3d() && typeof R3 !== 'undefined' && R3 && R3.ready;
  if (!on3d) return;
  if (!s || !s.cam){
    /* 클로즈업이 아닌 걸음으로 돌아오면 사무실 전체 보기로 되돌린다(추적도 다시 켠다) */
    if (TUT.aimed){ TUT.aimed = false; TUT.glide = null; R3.camReset(true); }
    return;
  }
  const cell = s.cam.cell && s.cam.cell();
  if (!cell) return;
  const d = R3.debug();
  /* **방 안쪽에서 본다.** 각도를 그때의 각(사람이 돌려 놓은 각)에 맡기면 카메라가 벽
     뒤로 나가서 벽의 뒷면만 보인다 — 실제로 달력 앞에서 칸막이 뒷면을, 책상 앞에서
     갈색 판 하나를 봤다. 그래서 대상에서 **방 중심 쪽으로** 카메라를 놓는다:
     그 방향이 곧 az 다(카메라는 look + (cos az, ·, sin az) 에 선다).
     벽에 걸린 것도 이 규칙 하나로 정면이 된다 — 벽은 언제나 방의 바깥이니까. */
  const cx = (W ? W.W : 10) / 2, cz = (W ? W.H : 8) / 2;
  const az = s.cam.az != null ? s.cam.az
           : Math.atan2(cz - (cell.y + 0.5), cx - (cell.x + 0.5));
  TUT.aimed = true;
  TUT.glide = {
    t: 0,
    from: { az:d.cam.az, el:d.cam.el, zoom:d.cam.zoom, x:d.look[0] - 0.5, y:d.look[1], z:d.look[2] - 0.5 },
    to:   { az, el:s.cam.el, zoom:s.cam.zoom, x:cell.x, y:s.cam.up, z:cell.y },
  };
}
function tutorGlide(dt){
  if (!TUT || !TUT.glide) return;
  const g = TUT.glide;
  g.t = Math.min(1, g.t + dt / 0.5);
  /* 시작과 끝을 눌러 준다 — 등속으로 밀면 카메라가 기계처럼 보인다 */
  const k = g.t < 0.5 ? 2 * g.t * g.t : 1 - 2 * (1 - g.t) * (1 - g.t);
  const m = (a, b) => a + (b - a) * k;
  R3.camSet({ az: m(g.from.az, g.to.az), el: m(g.from.el, g.to.el),
              zoom: m(g.from.zoom, g.to.zoom), follow: false,
              at: { x: m(g.from.x, g.to.x), y: m(g.from.z, g.to.z), up: m(g.from.y, g.to.y) } });
  if (g.t >= 1) TUT.glide = null;
}

function tutorShow(){
  const steps = tutorSteps();
  const s = steps[TUT.i];
  if (!s) return tutorEnd(true);
  /* 클로즈업 걸음이 아니면 손잡이를 치운다 — 남겨 두면 지난 걸음의 자리에 고리가 떠 있다.

     **`cam` 이 있는지로 가르면 안 된다.** 배치 걸음(🛋️)은 카메라를 물리지만(한 걸음
     물러서서 방 전체를 보여준다) 가리키는 것은 툴바 버튼이다. 그래서 그 걸음에서
     지난 걸음(📌 게시판)의 손잡이가 그대로 남아, **고리가 빈 바닥을 두르고 있었다** —
     들어가는 문이 어디인지 말해야 하는 걸음에서 엉뚱한 데를 가리킨 것이다.
     가르는 기준은 하나뿐이다: 이 걸음이 가리키는 것이 그 손잡이인가. */
  if (TUT.spot && (s.at && s.at()) !== TUT.spot) TUT.spot.style.display = 'none';
  tutorAim(s);

  const last = TUT.i === steps.length - 1;
  TUT.panel.innerHTML = `
    <div class="cstep">${TUT.i + 1} / ${steps.length}</div>
    <b>${s.t}</b>
    <p>${s.b}</p>
    <div class="cacts">
      <button class="buy alt" data-tut="skip">${L({ ko:'건너뛰기', en:'Skip', ja:'スキップ' })}</button>
      <button class="buy" data-tut="next">${
        last ? L({ ko:'알겠습니다', en:'Understood', ja:'わかりました' })
        : s.on ? L({ ko:'나중에', en:'Later', ja:'あとで' })
        : L({ ko:'다음', en:'Next', ja:'次へ' })}</button>
    </div>`;
  TUT.panel.querySelector('[data-tut="skip"]').onclick = () => tutorEnd(false);
  TUT.panel.querySelector('[data-tut="next"]').onclick = () => tutorNext();

  /* 이벤트로 넘어가는 단계는 그 이벤트를 한 번만 듣는다.
     bus 에 once 도 off 도 없으므로 핸들러는 페이지가 살아 있는 내내 남는다 —
     그래서 자물쇠는 **안내 한 판이 아니라 페이지 단위**여야 한다. 안내를 다시 볼 때마다
     같은 이벤트에 핸들러가 하나씩 쌓이면, 열 번째 재생에서는 한 걸음에 열 칸이 넘어간다. */
  if (s.on && !TUT_ARMED.has(s.on)){
    TUT_ARMED.add(s.on);
    bus.on(s.on, () => {
      if (!TUT) return;
      const cur = tutorSteps()[TUT.i];
      if (cur && cur.id === s.id) setTimeout(tutorNext, s.id === 'stamp' ? 300 : 650);
    });
  }
  /* 기다리기만 하는 단계는 시간이 지나면 저절로 넘어간다 —
     고양이가 걸어오는 동안 붙잡아 두는 게 목적이지 붙잡는 게 목적이 아니다.
     이벤트를 기다리는 단계도, 그 일이 **이미 일어났으면** 같은 방식으로 넘어간다. */
  if (TUT.timer){ clearTimeout(TUT.timer); TUT.timer = null; }
  const hold = s.wait ? s.wait : (s.already && s.already() ? 3 : 0);
  if (hold) TUT.timer = setTimeout(() => { if (TUT && tutorSteps()[TUT.i] === s) tutorNext(); }, hold * 1000);
}

function tutorNext(){
  if (!TUT) return;
  TUT.i++;
  if (TUT.i >= tutorSteps().length) return tutorEnd(true);
  sfx.add();
  tutorShow();
}

function startTutor(){
  /* 판이 문서에서 떨어져 나갔는데 상태만 남아 있으면 "다시 보기"가 영원히 안 먹는다 —
     위젯 모드로 접었다 폈거나 누가 DOM 을 치웠을 때 실제로 그렇게 된다. 그때는 새로 세운다. */
  if (TUT && (!TUT.panel || !TUT.panel.isConnected)) tutorEnd(false);
  if (TUT) return;
  const ring = document.createElement('div'); ring.className = 'coachring';
  const panel = document.createElement('div'); panel.className = 'coach';
  /* 3D 가구를 가리킬 때 쓰는 **보이지 않는 손잡이.** 고리와 안내판은 DOM 을 따라가게
     되어 있으므로(tutorPlace), 투사한 자리에 이걸 놓으면 나머지가 그대로 돈다. */
  const spot = document.createElement('div'); spot.className = 'tutspot';
  document.body.appendChild(ring); document.body.appendChild(panel); document.body.appendChild(spot);
  TUT = { i:0, ring, panel, spot, raf:0, timer:null, glide:null, aimed:false, last:0 };
  tutorShow();
  tutorPlace();
}

/* 저장에 남는다. 두 번 보고 싶으면 ⚙️ 에서 부른다 — 이건 한 번만 봐야 하는 종류의 물건이다. */
function tutorInit(){
  bus.on('tutor:done', () => { if (S && !S.tutor){ S.tutor = 1; save(); } });
}
