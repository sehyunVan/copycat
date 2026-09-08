/* ============================================================
   juke.js — 쥬크박스 화면.

   재생은 music.js 가 한다. 여기는 **고르는 화면**뿐이다 —
   그리고 이 기능의 값어치는 사실상 전부 이 화면에 있다.
   곡이 여섯 개인 게 좋은 게 아니라, 오늘 아침에 하나를 고른 게 좋은 거다.

   ── 규칙 셋 ──

   1. **줍는 곡은 줍기 전엔 목록에 없다.** 비품에서 잠긴 걸 감춘 것과 같은 규칙이다
      (ui.js shopHTML). 살 수 있는 곡은 값이 보여야 목표가 되지만, 줍는 곡은
      존재를 알면 줍는 게 아니라 수거가 된다.
   2. **사는 곡에는 아무 효과가 없다.** 이 회사에서 유일하게 생산성과 무관한 지출이고,
      그래서 상점(🛒)이 아니라 여기에 있다.
   3. **유튜브 실패는 정상 경로다.** 사내망에서 막히거나 파일로 연 배포본이면 안 뜬다.
      그때 조용히 무음이 되면 안 되고, 원래 곡으로 돌아가면서 한 줄로 말해 줘야 한다.
   ============================================================ */

function jukeModeLabel(m){
  return {
    loop:    L({ ko:'한 곡 반복', en:'Repeat one', ja:'1曲リピート' }),
    shuffle: L({ ko:'섞기',      en:'Shuffle',    ja:'シャッフル' }),
    auto:    L({ ko:'시간대 자동', en:'By time of day', ja:'時間帯おまかせ' }),
  }[m] || m;
}

function jukeRowHTML(t, state){
  const now = state.now === t.id;
  const em = `<span class="em">${t.em}</span>`;
  /* 곡 설명은 안 붙인다 — 여섯 줄이 각자 두 줄씩 설명을 달면 고르는 화면이
     읽는 화면이 된다. 여기서 필요한 건 이름과 "틀기" 뿐이다. */
  const info = `<div class="info"><b>${t.n}</b></div>`;
  let right;
  /* 이 배포본에 음원이 안 실린 곡. 갖고 있어도 틀면 오르골이 나오므로 그렇다고 적는다 —
     단일 파일로 받은 사람에게 "샀는데 안 나온다"는 버그로 읽힌다 (tools/pack-single.js). */
  if (!music.shipped(t))
    right = `<span class="tiny">${L({ ko:'이 배포본에 없음', en:'Not in this build', ja:'この配布版にはなし' })}</span>`;
  /* 고른 곡과 **실제로 나고 있는 곡**은 다를 수 있다(자동재생 정책에 막혀 멈춰 있을 때).
     둘을 같은 말로 적으면 머리 줄의 「멈춰 있음」과 이 줄이 서로 다른 말을 한다. */
  else if (now) right = `<span class="okmark">${music.playing()
    ? L({ ko:'재생 중 ♪', en:'Playing ♪', ja:'再生中 ♪' })
    : L({ ko:'고른 곡', en:'Selected', ja:'選んだ曲' })}</span>`;
  else if (state.owned.includes(t.id))
    right = `<button class="buy alt" data-play="${t.id}">${L({ ko:'틀기', en:'Play', ja:'かける' })}</button>`;
  else
    right = `<button class="buy" data-buy="${t.id}" ${state.anchovy < t.cost ? 'disabled' : ''}>🐟${fmt(t.cost)}</button>`;
  return `<div class="card ${now ? 'owned' : ''}"><div class="crow">${em}${info}${right}</div></div>`;
}

function jukeBodyHTML(){
  const own = music.owned();
  const state = { owned: own, now: music.now().id, anchovy: (S && S.anchovy) || 0 };
  const all = music.tracks();

  /* 갖고 있는 곡 → 살 수 있는 곡. 못 찾은 「줍는 곡」은 여기 없다. */
  const mine = all.filter(t => own.includes(t.id));
  /* **없는 걸 팔지 않는다.** 음원이 안 실린 배포본에서는 그 음반이 목록에 아예 없다 */
  const sale = all.filter(t => !own.includes(t.id) && t.cost && music.shipped(t));
  const lost = all.filter(t => !own.includes(t.id) && t.find && music.shipped(t)).length;

  const modeBtns = ['loop', 'shuffle', 'auto'].map(m =>
    `<button class="buy ${music.mode() === m ? '' : 'alt'}" data-mode="${m}">${jukeModeLabel(m)}</button>`).join('');


  const on = music.playing();

  /* 멈춰 있을 때 「화면을 한 번 누르면 시작합니다」라고만 적어 뒀다. 두 가지가 틀렸다:
     어디를 누르라는 것인지 알 수 없고, 그 말을 듣는 리스너가 이미 떼어진 경우가
     있었다(js/music.js 의 disarm — 지금은 안 뗀다). **누를 곳을 화면에 둔다.**

     음소거(음량 0)일 때는 그 버튼을 안 내놓는다 — 눌러도 소리가 안 나는 게 맞는 상태이고,
     아래 손잡이가 이미 그렇다고 말한다. 눌러도 아무 일이 없는 버튼은 또 다른 거짓말이다. */
  return `
    <div class="jukenow">
      <span class="em">${music.now().em}</span>
      <div>
        <b>${music.now().n}</b>
        <span>${on
          ? L({ ko:'나오는 중', en:'Now playing', ja:'再生中' })
          : L({ ko:'멈춰 있음', en:'Paused', ja:'停止中' })}</span>
      </div>
      ${on || soundVol === 0 ? '' : `<button class="buy kick" id="jukeKick">▶︎ ${
        L({ ko:'지금 틀기', en:'Play now', ja:'いま流す' })}</button>`}
    </div>
    <div class="jukevol">
      <button class="volem" id="volMute" title="${L({ ko:'음소거', en:'Mute', ja:'ミュート' })}">${
        soundVol === 0 ? '🔇' : soundVol < 0.34 ? '🔈' : soundVol < 0.7 ? '🔉' : '🔊'}</button>
      <input type="range" id="volRange" min="0" max="100" step="1" value="${Math.round(soundVol * 100)}"
             aria-label="${L({ ko:'음량', en:'Volume', ja:'音量' })}">
      <span class="volnum">${Math.round(soundVol * 100)}</span>
    </div>
    <div class="hint center">${soundVol === 0
      ? L({ ko:'음소거 중입니다 — 효과음도 음악도 나지 않습니다.',
            en:'Muted — no sound effects, no music.',
            ja:'ミュート中——効果音も音楽も鳴りません。' })
      : L({ ko:'효과음과 음악을 같이 조절합니다. 0 으로 내리면 전체 음소거입니다.',
            en:'Moves sound effects and music together. Drag to 0 for the master mute.',
            ja:'効果音と音楽をまとめて調整します。0にすると全体ミュートです。' })}</div>

    <div class="jukemode">${modeBtns}</div>
    ${music.mode() === 'auto' ? `<div class="hint center">${L({
      ko:'아침·낮은 밝게, 저녁은 가라앉고, 밤에는 비 오는 창가로 — 갖고 있는 곡 중에서만 고릅니다.',
      en:'Bright by day, lower in the evening, rain at night — chosen only from what you own.',
      ja:'昼は明るく、夕方は落ち着き、夜は雨の窓辺へ——持っている曲の中からだけ選びます。',
    })}</div>` : ''}

    <div class="jukesec">${L({ ko:'보유', en:'Yours', ja:'所持' })}</div>
    ${mine.map(t => jukeRowHTML(t, state)).join('')}

    ${sale.length ? `<div class="jukesec">${L({ ko:'음반', en:'Records', ja:'レコード' })}</div>
      ${sale.map(t => jukeRowHTML(t, state)).join('')}
      <div class="hint center">${L({
        ko:'음반은 생산에 아무 영향이 없습니다. 이 회사에서 유일하게 그렇습니다.',
        en:'Records do nothing for output. They are the only thing here that doesn’t.',
        ja:'レコードは生産に何の影響もありません。この会社で唯一そうです。',
      })}</div>` : ''}

    ${lost ? `<div class="card lockedrow"><div class="crow"><span class="em">📼</span>
      <div class="info"><b>${L({
        ko:'사무실 어딘가에 아직 안 나온 테이프가 있습니다',
        en:'There are tapes in this office you haven’t turned up yet',
        ja:'このオフィスにはまだ出てきていないテープがあります',
      })}</b><span>${L({
        ko:'살 수 있는 물건이 아닙니다. 가구를 눌러 조사하세요.',
        en:'They are not for sale. Click furniture to look at it.',
        ja:'買える物ではありません。家具を押して調べてください。',
      })}</span></div></div></div>` : ''}
`;
}

function showJuke(){
  bus.emit('juke:open');      // 열렸다는 신호. 첫 출근 안내가 쓰던 것 — 지금은 안 듣는다
  const m = modal(`
    <div class="mhead"><div class="q">💿 ${L({ ko:'쥬크박스', en:'JUKEBOX', ja:'ジュークボックス' })}</div>
      <h3>${L({ ko:'오늘은 뭘 틀까요', en:'What are we playing today', ja:'今日は何をかけますか' })}</h3>
      <p>${L({
        ko:'사무실의 배경음악',
        en:'Office background music',
        ja:'オフィスのBGM',
      })}</p></div>
    <div class="mbody" id="jukeBody">${jukeBodyHTML()}</div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  const body = m.veil.querySelector('#jukeBody');
  const redraw = () => { body.innerHTML = jukeBodyHTML(); wire(); renderTop(); };

  function wire(){
    body.querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
      music.play(b.dataset.play); sfx.add(); redraw();
    });
    body.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      music.setMode(b.dataset.mode); sfx.add(); redraw();
    });
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const id = b.dataset.buy;
      if (!music.buy(id)){ sfx.err(); return; }
      sfx.buy();
      const t = music.track(id);
      pushLog(L({
        ko:`음반 <b>${t.n}</b>을(를) 들였습니다. 아무 효과도 없습니다.`,
        en:`Picked up the record <b>${t.n}</b>. It does nothing at all.`,
        ja:`レコード<b>${t.n}</b>を入れました。何の効果もありません。`,
      }), 'good');
      music.play(id);
      redraw();
    });
    /* 음량 — 끄는 것과 크기가 한 손잡이다. 슬라이더는 **끌면서** 바로 들려야 하므로
       input(연속)으로 값을 먹이고, 화면 전체를 다시 그리지는 않는다(끌던 손이 튄다). */
    const vr = body.querySelector('#volRange'), vn = body.querySelector('.volnum'),
          vm = body.querySelector('#volMute');
    const paintVol = () => {
      const v = Math.round(soundVol * 100);
      if (vr && Number(vr.value) !== v) vr.value = v;
      if (vn) vn.textContent = v;
      /* **다시 그린 아이콘으로 돌려놓는다.** 폰 스킨(js/cozy.js)이 처음 한 번 이모지를
         그린 아이콘으로 바꿔 두는데, 여기서 textContent 로 덮으면 그 그림이 날아가고
         그 자리만 혼자 이모지가 된다 — 손잡이를 움직이는 순간 그림체가 바뀐다. */
      if (vm){
        const em = soundVol === 0 ? '🔇' : soundVol < 0.34 ? '🔈'
                 : soundVol < 0.7 ? '🔉' : '🔊';
        vm.textContent = em;
        delete vm.dataset.icon;              // 다시 바꿔도 되는 상태로 되돌린다
        if (typeof CCIcon === 'function') CCIcon(vm, em === '🔇' ? 'mute' : 'wave');
      }
    };
    let lastOn = soundVol || 0.7;
    if (vr) vr.oninput = () => {
      setVolume(Number(vr.value) / 100);
      if (soundVol > 0) lastOn = soundVol;
      paintVol();
    };
    if (vm) vm.onclick = () => {
      setVolume(soundVol > 0 ? 0 : lastOn);
      paintVol();
      if (soundVol > 0) sfx.add();
    };

    /* 누른 **그 손 안에서** 재생을 시작해야 한다(music.kick). 여기서 setTimeout 을
       거치면 자동재생 정책이 다시 막는다. */
    const kickBtn = body.querySelector('#jukeKick');
    if (kickBtn) kickBtn.onclick = () => {
      music.kick();
      redraw();
    };

  }
  wire();

  return m;
}

/* 여는 문은 **사무실의 CD 플레이어**다(story.js 의 클릭 라우팅). 툴바에 💿 버튼이
   따로 있었는데 뗐다 — 툴바 버튼은 설정이고, 가구는 사무실이다. 이 게임에서 곡을
   고르는 일은 설정이 아니라 오늘 아침에 사무실에서 하는 일이어야 한다.
   여기 있던 그물(유튜브가 조용히 죽는 걸 화면으로 끌어내던 것)은 노동요를 걷으면서
   같이 나갔다. 부르는 자리가 남아 있어 함수는 둔다 — 지금은 아무 일도 안 한다. */
function jukeInit(){
}
