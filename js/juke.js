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

/* 실패 이유별 안내. **할 일이 다르면 다르게 말해야 한다** —
   "사내망에서 막혔다"(포기)와 "게시자가 퍼가기를 막았다"(다른 링크)를 한 문장으로
   뭉쳐 놓으면, 링크만 바꾸면 될 사람이 네트워크를 쳐다보며 시간을 버린다. */
function ytWhyText(why){
  if (why === 'embed') return L({
    ko:'이 영상은 <b>다른 사이트에서 재생하지 못하게</b> 게시자가 막아 둔 것입니다. 다른 링크를 넣어 보세요 — 플레이리스트라면 막힌 곡만 건너뜁니다.',
    en:'The owner has <b>disabled playback on other sites</b> for this one. Try another link — in a playlist, only the blocked tracks are skipped.',
    ja:'この動画は<b>他サイトでの再生を禁止</b>されています。別のリンクを試してください——プレイリストなら禁止された曲だけ飛ばします。' });
  if (why === 'notfound') return L({
    ko:'그 주소에 영상이 없습니다 — 삭제되었거나 비공개입니다.',
    en:'Nothing at that address — deleted or private.',
    ja:'その住所に動画がありません——削除か非公開です。' });
  if (why === 'badlink'){
    /* 플레이리스트일 때는 거의 항상 **비공개**다. 자기 목록을 붙여넣은 사람에게
       "주소를 다시 붙여넣으세요" 라고 하면 열 번을 다시 붙여넣게 된다 —
       고칠 곳은 주소가 아니라 유튜브의 공개 설정이다. */
    const list = !!(music.ytStatus().parsed || {}).list;
    if (list) return L({
      ko:'그 플레이리스트를 열지 못했습니다 — 없는 목록이거나 <b>비공개</b>입니다. 유튜브에서 목록 공개 범위를 <b>일부 공개</b> 이상으로 바꾸면 됩니다.',
      en:'Couldn’t open that playlist — it doesn’t exist, or it’s <b>private</b>. Setting it to <b>Unlisted</b> or Public on YouTube is enough.',
      ja:'そのプレイリストを開けませんでした——存在しないか<b>非公開</b>です。YouTube側で<b>限定公開</b>以上にすれば通ります。' });
    /* 코드 2 는 "주소가 틀렸다" 뿐 아니라 **유튜브가 지금 이 클라이언트를 거절했다**
       일 수도 있다(실측: 같은 주소가 몇 분 전엔 됐다). 그래서 다시 눌러 보라고 한다 —
       주소는 그대로 남아 있으니 「걸기」 한 번이면 된다. */
    return L({
      ko:'유튜브가 그 주소를 거절했습니다. 주소를 다시 확인하거나, <b>잠시 뒤 「걸기」를 한 번 더</b> 눌러 보세요.',
      en:'YouTube refused that address. Check it, or just <b>press Set again in a moment</b>.',
      ja:'YouTubeがその住所を拒否しました。住所を確認するか、<b>少し後にもう一度「かける」</b>を押してください。' });
  }
  return L({
    ko:'유튜브가 안 열립니다 — 사내망에서 막혀 있거나 파일로 연 배포본입니다. 내장 곡으로 돌아갑니다.',
    en:'YouTube won’t open here — blocked on this network, or this is the offline single-file build. Falling back to the built-in tracks.',
    ja:'YouTubeが開けません——社内網でブロックされているか、ファイルで開いた単体版です。内蔵曲に戻ります。' });
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
  if (!music.shipped(t) && !t.yt)
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
  const mine = all.filter(t => !t.yt && own.includes(t.id));
  /* **없는 걸 팔지 않는다.** 음원이 안 실린 배포본에서는 그 음반이 목록에 아예 없다 */
  const sale = all.filter(t => !t.yt && !own.includes(t.id) && t.cost && music.shipped(t));
  const lost = all.filter(t => !t.yt && !own.includes(t.id) && t.find && music.shipped(t)).length;

  const modeBtns = ['loop', 'shuffle', 'auto'].map(m =>
    `<button class="buy ${music.mode() === m ? '' : 'alt'}" data-mode="${m}">${jukeModeLabel(m)}</button>`).join('');

  const yt = music.ytStatus();
  const ytNow = state.now === 'yt';

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

    ${!music.ytAllowed() ? '' : `
    <div class="jukesec">${music.track('yt').em} ${music.track('yt').n}</div>
    <div class="card ${ytNow ? 'owned' : ''}">
      <div class="ytrow">
        <input id="ytUrl" placeholder="https://www.youtube.com/playlist?list=…" value="${esc(yt.url || '')}" autocomplete="off" spellcheck="false">
        <button class="buy" id="ytGo">${L({ ko:'걸기', en:'Set', ja:'かける' })}</button>
        ${yt.url ? `<button class="buy alt" id="ytClear">${L({ ko:'해제', en:'Clear', ja:'解除' })}</button>` : ''}
      </div>
      <div class="hint">${yt.failed ? ytWhyText(yt.why) : yt.onlyVideo ? L({
          ko:'이 주소의 <b>목록</b>은 실을 수 없어서(믹스이거나 비공개) <b>영상 하나</b>만 반복하고 있습니다. 목록으로 틀려면 유튜브의 <b>플레이리스트 주소</b>를 넣으세요.',
          en:'The <b>list</b> in this address can’t be loaded (a mix, or private), so a <b>single video</b> is looping. Paste a real <b>playlist</b> URL to get the list.',
          ja:'この住所の<b>リスト</b>は読み込めないため（ミックスか非公開）、<b>動画1本</b>を繰り返しています。リストで流すには<b>プレイリストのURL</b>を入れてください。' })
        : L({
          ko:'유튜브 링크를 넣으면 노동요로 들을 수 있습니다. 위의 음량과 밤 절반 볼륨은 여기에도 걸립니다.',
          en:'Paste a YouTube link and it plays as your work tunes. The volume above and the night halving apply here too.',
          ja:'YouTubeのリンクを入れれば労働歌として流せます。上の音量と夜の半分音量はこちらにも効きます。' })
      }</div>
    </div>`}`;
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

  /* 유튜브 스크립트를 **지금** 받아 둔다. 「걸기」를 누른 뒤에 받으면 그 사이에
     클릭 제스처가 식어 자동재생 정책이 소리를 막는다 — 미리 받아 두면 재생기가
     누른 손 안에서 만들어져 첫 시도에 소리가 난다. */
  music.ytWarm();

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
      if (vm) vm.textContent = soundVol === 0 ? '🔇' : soundVol < 0.34 ? '🔈' : soundVol < 0.7 ? '🔉' : '🔊';
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
      /* 유튜브는 버퍼링을 거쳐 소리가 오므로 누른 직후의 화면은 아직 「멈춰 있음」이다.
         조금 뒤에 한 번 더 본다 — 모달이 닫혔으면 그만둔다. */
      setTimeout(() => { try { if (m.veil.isConnected) redraw(); } catch(e){} }, 1600);
    };

    const go = body.querySelector('#ytGo'), url = body.querySelector('#ytUrl');
    if (go) go.onclick = () => {
      if (!music.setYT(url.value)){
        sfx.err();
        toast(L({ ko:'유튜브 링크로 안 읽힙니다. 주소를 통째로 붙여넣어 보세요.',
                  en:'That doesn’t read as a YouTube link. Try pasting the whole address.',
                  ja:'YouTubeのリンクとして読めません。アドレスをそのまま貼ってみてください。' }));
        return;
      }
      sfx.add();
      redraw();
    };
    /* 이 칸에도 조합 중 엔터가 온다(일본어로 검색해 붙여넣는 경우). 결재함과 같은
       문을 쓴다 — ui.js onTextSubmit. */
    if (url) onTextSubmit(url, () => { if (go) go.click(); });
    const clr = body.querySelector('#ytClear');
    if (clr) clr.onclick = () => {
      music.setYT('');
      music.play(music.owned()[0] || 'box');
      redraw();
    };
  }
  wire();

  /* 유튜브가 실패하면 그 순간 화면도 같이 바뀌어야 한다 — 안 그러면
     "걸기를 눌렀는데 아무 일도 안 일어났다"가 된다. 닫을 때는 떼고 나간다. */
  const off = music.onYTFail(() => { try { if (m.veil.isConnected) redraw(); } catch(e){} });
  m.veil.addEventListener('click', e => {
    if (e.target === m.veil || e.target.closest('[data-close]')) off();
  });
  return m;
}

/* 여는 문은 **사무실의 CD 플레이어**다(story.js 의 클릭 라우팅). 툴바에 💿 버튼이
   따로 있었는데 뗐다 — 툴바 버튼은 설정이고, 가구는 사무실이다. 이 게임에서 곡을
   고르는 일은 설정이 아니라 오늘 아침에 사무실에서 하는 일이어야 한다.
   여기 남은 건 조용히 실패하는 것들을 화면으로 끌어내는 그물뿐이다. */
function jukeInit(){
  /* 유튜브가 조용히 죽는 걸 막는 마지막 그물. 모달이 닫혀 있어도 한 번은 말해 준다. */
  music.onYTFail(() => toast(L({
    ko:'유튜브를 열 수 없어 내장 곡으로 돌아갑니다.',
    en:'Couldn’t open YouTube — falling back to the built-in tracks.',
    ja:'YouTubeを開けないため内蔵曲に戻ります。',
  })));
}
