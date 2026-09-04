/* ============================================================
   main.js — 부팅 · 루프 · 입력 배선
   ============================================================ */

/* ---------- 월드 이벤트 → 화면 ---------- */
bus.on('cat:say', ({ cat, text }) => sayAt(cat.id, text));

bus.on('cat:found', ({ cat, amount }) => {
  floatAt(cat.x, cat.y, '🐟 +' + fmt(amount));
  sayAt(cat.id, L({ ko:'주웠다냥!', en:'Found one, nya!', ja:'拾ったにゃ！' }));
  sfx.coin();
});

/* ---------- 고양이 목소리 ----------
   소리 나는 순간은 많은데 귀는 하나다. 스무 마리가 각자 결재하고 물 마시는 사무실에서
   전부 울리면 그건 사무실이 아니라 경보음이다. 그래서 **주변음은 간격을 두고 하나씩만**
   낸다 — 대신 사람이 직접 만졌을 때(클릭)는 이 문을 통과시킨다. 부른 쪽이 답을 받아야 한다. */
/* 간격을 1.5초로 두고 한동안 돌려 봤는데, 스무 마리 사무실에서는 그게 **거의 끊이지 않는
   소리**였다. 이 게임은 근무 시간 내내 옆에 띄워 두는 물건이라 소리는 가끔 들려야 한다.
   4초로 벌리고, 주변음은 볼륨도 절반으로 내렸다. 직접 누른 고양이만 또렷하게 답한다. */
const VOICE = { t:0, gap:4200 };
function catVoice(cat, kind, force){
  const now = performance.now();
  if (!force && now - VOICE.t < VOICE.gap) return;
  VOICE.t = now;
  if (sfx.voice) sfx.voice(force ? 1 : 0.5);
  /* 어느 울음이 나올지는 소리 쪽이 매번 새로 뽑는다 — 여기서는 종류만 고른다 */
  if (kind === 'purr') sfx.purr();
  else if (kind === 'meow') sfx.meow();
  else sfx.trill();
}

/* ---------- 쓰다듬기 ----------
   두 곳에서 부른다 — 도트판의 DOM 클릭과 3D 의 광선. 같은 일이므로 한 함수다.
   (전에는 같은 세 줄이 두 군데 적혀 있었고, 그러면 한쪽만 고치게 된다.)

   **하고 있는 일을 먼저 말한다.** 커피를 마시고 있는 고양이를 눌렀는데
   「창밖에 새가 있다」 라고 답하면, 눌러서 확인하는 길이 막힌 것이다. */
function petCat(c){
  c.needs.fun = Math.min(100, c.needs.fun + 6);
  const asleep = c.act.s === 'sleep';
  catVoice(c, asleep ? 'purr' : 'meow', true);
  /* 자는 고양이는 깨우지 않는다 — 잠꼬대로 답한다(DOING.sleep 이 골골골이라
     여기까지 그걸로 답하면 「눌렀는데 반응이 없다」 가 된다). */
  if (asleep){
    sayAt(c.id, L({ ko:['zzz…','5분만 더…','냥…?'], en:['zzz…','five more minutes…','nya…?'],
                    ja:['zzz…','あと5分…','にゃ…？'] })[Math.floor(Math.random()*3)]);
    return;
  }
  if (sayDoing(c)) return;
  sayAt(c.id, CHAT.idle[Math.floor(Math.random()*CHAT.idle.length)]);
}

bus.on('reward', ({ cat, money, kpi }) => {
  sfx.stamp(); setTimeout(sfx.coin, 140);
  /* 도장을 찍었으면 한마디 한다. 짧은 트릴이라 반복돼도 덜 지친다. */
  setTimeout(() => catVoice(cat, 'trill'), 180);
  floatAt(cat.x, cat.y, '+' + kpi + ' ' + L({ ko:'성과', en:'KPI', ja:'成果' }), 'kpi');
  setTimeout(() => floatAt(cat.x, cat.y - 0.4, '🐟 +' + fmt(money)), 220);
  sayAt(cat.id, CHAT.stamp[Math.floor(Math.random() * CHAT.stamp.length)]);
  renderTodos();
});

bus.on('doc:spawn', () => { sfx.add(); });

/* 가구를 쓰기 시작하는 순간 — 무엇을 쓰느냐에 따라 다른 소리가 난다.
   자러 들어가면 골골, 놀거나 어울리면 야옹, 밥·커피·기계 앞에서는 짧은 트릴. */
bus.on('cat:use', ({ cat, tile }) => {
  const use = (TILE_INFO[tile] || {}).use;
  catVoice(cat, use === 'sleep' ? 'purr' : (use === 'play' || use === 'social') ? 'meow' : 'trill');
});

bus.on('quarter:closed', d => {
  sfx.quarter();
  if (d.moved) confetti();
  showQuarter(d);
  renderRight(); renderTodos();
});

bus.on('world:rebuilt', () => { renderTiles(); });

bus.on('npc:arrive', ({ kind }) => {
  if (kind === 'police'){
    sfx.siren();
    toast(L({ ko:'🚨 냥찰청 특별사법경찰이 도착했습니다', en:'🚨 The Pawlice Special Investigation Unit has arrived', ja:'🚨 ニャン察庁特別司法警察が到着しました' }), 'bad');
  } else if (kind === 'legal'){
    sfx.legal();
    toast(L({ ko:'💼 법무팀이 방문했습니다', en:'💼 The legal team is here', ja:'💼 法務チームが来ました' }), 'bad');
  }
});
bus.on('raid:start', () => {
  pushLog(L({ ko:'압수수색이 시작되었습니다. 전 직원 업무 중단.', en:'The raid has begun. All work stopped.', ja:'家宅捜索が始まりました。全員業務中断。' }), 'bad');
});
bus.on('raid:end', d => { sfx.legal(); showRaidEnd(d); renderRight(); });

bus.on('log', ({ text }) => { $('#ticker').textContent = text.replace(/<[^>]+>/g, ''); if (uiTab === 'log' && bizShown()) renderRight(); });

/* 실시간이라 하루는 자정에 넘어간다 */
bus.on('day:new', d => {
  pushLog(L({ ko:`<b>Day ${d}</b> — 새로운 하루입니다.`, en:`<b>Day ${d}</b> — a new day.`, ja:`<b>Day ${d}</b>——新しい一日です。` }), '');
});

/* ---------- 업무일이 바뀌었다 ----------
   결재함이 여기서 갱신된다: 앞날에 미리 적어 둔 건이 올라오고, 어제 기한이던 건이
   정산된다. 아침에 창을 여는 사람이 제일 먼저 보는 화면이라 **모달을 띄우지 않는다** —
   하루의 첫 화면이 벌점 보고서면 그건 동행이 아니다. 로그 한 줄과 토스트로 끝낸다. */
bus.on('biz:new', () => {
  const r = settleDue();
  runRoutines();
  pruneTodos();
  renderTodos(); renderRight(); renderTop();
  const up = S.todos.filter(t => !t.done && t.due === bizKey()).length;
  if (r.leaked) toast(L({
    ko:`기한을 넘긴 ${r.leaked.count}건이 밖으로 샜습니다 — 늦게라도 내면 지워집니다.`,
    en:`${r.leaked.count} past-due item(s) leaked — filing them late still clears it.`,
    ja:`期限を過ぎた${r.leaked.count}件が流出——遅れてでも出せば消えます。`,
  }), 'bad', 5200);
  else if (up) toast(L({
    ko:`오늘 결재함에 ${up}건이 올라왔습니다.`,
    en:`${up} item(s) came up for today.`,
    ja:`今日の決裁箱に${up}件が上がりました。`,
  }));
});

/* ---------- 입력 ---------- */
function bindInput(){
  /* 올리는 길이 둘(엔터·버튼)인데 **한 문을 지나야** 한다 — 조합이 끝난 뒤에 읽는
     문이다(ui.js onTextSubmit). 여기서 keydown 을 직접 듣던 것이 한글 조합 중의
     엔터에 업무를 두 줄로 쪼개던 자리다. */
  const todoSubmit = onTextSubmit($('#todoInput'), doAdd);
  $('#btnAdd').onclick = () => todoSubmit.press();

  $('#sizes').addEventListener('click', e => {
    const b = e.target.closest('.size'); if (!b) return;
    uiSize = b.dataset.size;
    $$('#sizes .size').forEach(x => x.classList.toggle('on', x === b));
  });

  $('#todoList').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const row = btn.closest('.todo'), id = row.dataset.id;
    if (btn.dataset.act === 'toggle'){
      /* 묶음이면 밑의 줄을 한 번에 끝낸다(completeGroup) — 잎마다 서류가 하나씩 나가고,
         마지막 잎이 부모를 닫는다. 잎이 없으면 보통 업무와 같은 길이다. */
      if (completeGroup(id)){
        row.classList.add('gone');
        toast(L({ ko:'서류가 결재함으로 갔습니다. 고양이가 가지러 옵니다.', en:'The papers went to the inbox. A cat is coming for them.', ja:'書類が決裁箱へ。猫が取りに来ます。' }));
        setTimeout(renderTodos, 420);
      }
    }
    if (btn.dataset.act === 'due'){ showDuePicker(id); return; }
    if (btn.dataset.act === 'sub'){ showSubs(id); return; }
    /* 접기 — 저장에 남긴다. 위젯 모드에서 접어 둔 묶음이 창을 옮길 때마다 펼쳐지면
       그건 접은 게 아니다. */
    if (btn.dataset.act === 'fold'){
      const t = S.todos.find(x => x.id === id);
      if (t){ t.fold = !t.fold; save(); renderTodos(); }
      return;
    }
    if (btn.dataset.act === 'del'){
      /* 묶음을 지우면 밑의 줄도 같이 간다. 네 줄이 한 번에 사라지는 일이라 먼저 묻는다 —
         이 게임에 되돌리기는 없다. */
      /* 남아 있는 잎이 있으면 먼저 묻는다. **끝난 잎만 남았어도 같이 지워지므로**
         그 수까지 세어서 말해 준다 — 「1건」이라고 하고 3건이 사라지면 그건 거짓말이다. */
      const kids = kidsOf(id).length;
      if (kids && !confirm(L({
        ko:`이 묶음과 밑의 ${kids}건을 같이 지울까요?`,
        en:`Delete this group and the ${kids} line(s) under it?`,
        ja:`このまとまりと下の${kids}件をまとめて消しますか？`,
      }))) return;
      row.classList.add('gone');
      setTimeout(() => { delTodo(id); renderTodos(); renderTop(); }, 380);
    }
  });

  $('#rightBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn && !btn.disabled){
      const a = btn.dataset.act;
      // 즉시 채용이 아니라 면접창을 연다 — 이름과 색을 정할 수 있다
      if (a === 'hire'){ showHire(); return; }
      if (a === 'promo'){ if (promote(btn.dataset.id)) sfx.buy(); else sfx.err(); }
      if (a === 'lobby'){
        if (lobby()){
          sfx.legal();
          toast(L({ ko:'혐의 1점이 조용히 사라졌습니다', en:'One point of heat quietly vanished', ja:'容疑1点が静かに消えました' }), 'bad');
        }
        else sfx.err();
      }
      if (a === 'buy'){
        const it = SHOP.find(x => x.id === btn.dataset.id);
        if (buyItem(btn.dataset.id)){
          sfx.buy();
          toast(L({ ko:`${it.n} 설치 완료`, en:`${it.n} installed`, ja:`${it.n} 設置完了` }));
        } else sfx.err();
      }
      renderRight(); renderTop();
      return;
    }
    const card = e.target.closest('.catcard');
    if (card) showCat(card.dataset.cat);
  });

  /* 오른쪽 패널의 탭과 한 기둥의 탭 줄이 **같은 상태**를 만진다(js/col.js 의 uiCol).
     두 줄이 서로 다른 걸 가리키는 화면은 어느 쪽을 믿어야 할지 알 수 없다. */
  $$('.tab').forEach(t => t.onclick = () => setCol(t.dataset.tab));

  /* 무대를 누르면 결재함 입력칸에서 **손을 뗀다.**
     부팅에서 그 칸에 커서를 넣어 두는데(아래 boot 끝), 그 상태로는 키보드가 전부
     그리로 간다 — 카메라의 방향키·WASD·Q·E·0 도, 배치 모드의 R 도 한 글자씩
     서류 제목에 박히고 아무 일도 안 일어난다. 실제로 그래서 R 이 안 먹었다.
     반대로 그 칸을 지키면 "할 일을 적는다"가 이 게임의 첫 동작이라는 것도 지켜진다 —
     그래서 자동 포커스는 그대로 두고, **무대를 누른 순간에만** 놓아준다. */
  $('#viewport').addEventListener('pointerdown', () => {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.blur();
  }, true);

  /* 고양이는 DOM 이 아니라 메시라서 상호작용을 광선으로 잡는다 —
     쓰다듬기(클릭)와 카드 열기(더블클릭). #actors 에 걸려 있던 같은 배선을
     도트판과 함께 지웠다. */
  const gl = $('#gl');
  if (gl){
    const catAt = e => (typeof R3 !== 'undefined' && R3 && R3.ready && !R3.justDragged()
                        && !(typeof EDIT !== 'undefined' && EDIT.on))
      ? R3.pickCat(e.clientX, e.clientY) : null;
    gl.addEventListener('click', e => {
      const id = catAt(e); if (!id) return;
      const c = S.cats.find(x => x.id === id); if (!c) return;
      petCat(c);
    });
    gl.addEventListener('dblclick', e => {
      const id = catAt(e); if (id) showCat(id);
    });
  }

  /* 소리는 이제 **사무실의 CD 플레이어** 안에 있다(juke.js 의 음량 손잡이).
     툴바의 🔊 는 뺐다 — 곡을 고르는 자리와 소리를 줄이는 자리가 따로면
     "음악을 만지려면 어디로 가야 하나"가 두 군데가 된다. */
  /* 좌우 패널 접기. 사무실을 넓게 보고 싶을 때가 있고, 3D 로 오면서 더 그렇다. */
  const fold = (side, on) => {
    const cls = side === 'L' ? 'foldL' : 'foldR';
    const el = $('#main');
    if (on == null) on = !el.classList.contains(cls);
    el.classList.toggle(cls, on);
    $('#btnFold' + side).textContent = side === 'L' ? (on ? '›' : '‹') : (on ? '‹' : '›');
    try { localStorage.setItem('copycat.fold' + side, on ? '1' : '0'); } catch(e){}
    fitWorld();
  };
  ['L','R'].forEach(side => {
    const b = $('#btnFold' + side);
    if (!b) return;
    b.onclick = () => fold(side);
    let saved = false;
    try { saved = localStorage.getItem('copycat.fold' + side) === '1'; } catch(e){}
    fold(side, saved);
  });

  /* 카메라 — 기본은 고양이 자동 추적. 손을 대면(돌리기·팬·줌) 그 자리에 고정되고,
     이 버튼으로 돌아온다. 돌아올 때는 **각도와 배율까지 처음으로 되돌린다** —
     팬이 생긴 뒤로는 "추적만 다시 켜기"로는 부족하다. 화면 밖으로 끌고 나가 있으면
     추적이 켜져도 고양이가 어디서 나타나는지 알 수 없다. 이 버튼은 길 잃음의 탈출구다. */
  const camBtn = $('#btnCam');
  if (camBtn){
    const syncCam = () => {
      const on = typeof R3 !== 'undefined' && R3 && R3.ready;
      camBtn.style.display = on ? '' : 'none';
      if (on){
        camBtn.classList.toggle('on', R3.following());
        camBtn.title = R3.following()
          ? L({ ko:'추적 끄기 — 드래그 이동 · 우클릭/두 손가락 회전 · 휠 줌 · 0 전체보기',
                en:'Stop following — drag to pan · right-drag/two fingers to turn · wheel to zoom · 0 to reset',
                ja:'追跡オフ——ドラッグで移動・右ドラッグ/2本指で回転・ホイールでズーム・0で全体' })
          : L({ ko:'고양이 따라가기 (시점도 처음으로)',
                en:'Follow the cats (and reset the view)',
                ja:'猫を追う（視点も初期化）' });
      }
    };
    camBtn.onclick = () => {
      if (typeof R3 === 'undefined' || !R3 || !R3.ready) return;
      if (R3.following()) R3.followOn(false);
      else R3.camReset(true);
      syncCam();
    };
    setInterval(syncCam, 600);
    syncCam();
  }

  $('#btnCard').onclick = showCard;
  $('#btnSettings').onclick = showSettings;
  $('#btnHelp').onclick = showHelp;
  $('#btnReset').onclick = () => {
    if (!confirm(L({
      ko:'회사를 정리하고 처음부터 시작할까요? 모든 기록이 사라집니다.',
      en:'Wind down the company and start over? All records will be lost.',
      ja:'会社をたたんで最初からやり直しますか？すべての記録が消えます。',
    }))) return;
    /* itch.io 는 게임을 다른 출처의 iframe 안에서 돌린다. 서드파티 저장소를 막아 둔
       브라우저에서는 localStorage 를 만지는 것만으로 예외가 난다 — 다른 곳은 전부
       감싸 뒀는데 여기만 맨몸이었다. 저장이 안 되는 브라우저에서도 새로 시작은 돼야 한다. */
    try { localStorage.removeItem(SAVE_KEY); } catch(e){}
    /* **음악을 먼저 누른다.** 컷신 동안 BGM 을 누르는 문은 playIntro 에 있는데(그쪽이
       __introAudio 를 세운다), 다시하기는 거기 닿기 전에 buildWorld·renderAll 을 지난다 —
       그 사이에 사무실 음악이 한 번 올라와서 프롤로그의 비·통화 위에 겹쳤다.
       여기서 미리 세우면 그 틈이 없다. */
    window.__introAudio = true;
    try { music.sync(); } catch(e){}
    S = newGame();
    DOCS.length = 0; NPCS.length = 0; RAID = null;
    DECOR.clearCache();
    buildWorld(); renderAll();
    /* 처음부터는 정말 처음부터다 — 전단을 보고 전화를 거는 그 밤부터 다시 시작한다.
       newGame() 이 intro=0 을 세우므로 부팅 경로와 같은 흐름을 그대로 태운다.
       (떠 있는 창에서는 컷신을 띄우지 않는다 — 380×470 짜리 창에 시네마틱을 넣으면
        그건 컷신이 아니라 우표다. 그때는 계약서만 띄운다. WebGL 자체는 그 창에서도
        돈다 — spike/pipcv.html 로 재 뒀다.) */
    if (typeof pipLive === 'function' && pipLive()) showContract(firstLog);
    else startIntro();
  };

  window.addEventListener('resize', fitWorld);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ save(); return; }
    /* 돌아왔다. 배경에서도 사무실이 돌고 있었으니 정산할 것이 없다 —
       절전 등으로 페이지가 멈춰 있던 구간이 있었다면 감시 타이머가 이미 정산해 두었고,
       그 보고만 여기서 꺼낸다. 탭으로 돌아온 것뿐이니 모달로 가로막지는 않는다. */
    if (pendingReport){ reportReturn(pendingReport, false); pendingReport = null; }
    renderAll();
  });
}

/* 돌아왔을 때의 보고. 벌어둔 금액은 그대로 두고, 그사이 사무실에서
   실제로 있었던 일을 곁들인다. 오래 비웠을 때만 문서를 펴 준다 —
   잠깐 다녀온 사람 앞에 보고서를 들이미는 건 마중이 아니다. */
function reportReturn(o, modalOk){
  if (!o) return;
  // 닫혀 있던 시간에는 수익이 없다. 없는 걸 0으로 적어 보여주는 대신, 닫혀 있었다고 쓴다.
  const head = o.gain > 0
    ? L({ ko:`${o.timeStr} 동안 급식기가 🐟${fmt(o.gain)} 벌어놨다`,
          en:`The feeder kept things going — 🐟${fmt(o.gain)} over ${o.timeStr}`,
          ja:`${o.timeStr}のあいだ給餌器が🐟${fmt(o.gain)}稼いでおいた` })
    : L({ ko:`${o.timeStr} 동안 사무실은 닫혀 있었다`,
          en:`The office was closed for ${o.timeStr}`,
          ja:`${o.timeStr}のあいだオフィスは閉まっていた` });
  if (modalOk && o.mins >= 10) showReturn(o);
  else toast(head + ' · ' + o.story[0].replace(/<[^>]+>/g, ''), '', 4200);
  pushLog((o.gain > 0
    ? L({ ko:`닫혀 있던 ${o.timeStr} 동안 급식기가 돌려놓은 매출 🐟${fmt(o.gain)}.`,
          en:`The feeder brought in 🐟${fmt(o.gain)} while the office was closed (${o.timeStr}).`,
          ja:`閉まっていた${o.timeStr}のあいだ、給餌器が売上🐟${fmt(o.gain)}を回しておきました。` })
    : L({ ko:`사무실이 ${o.timeStr} 동안 닫혀 있었습니다.`,
          en:`The office was closed for ${o.timeStr}.`,
          ja:`オフィスは${o.timeStr}のあいだ閉まっていました。` })
  ) + ' ' + o.story.join(' '), o.gain > 0 ? 'good' : '');
}

function doAdd(){
  const inp = $('#todoInput');
  const txt = inp.value.trim();
  if (!txt){ inp.focus(); sfx.err(); return; }
  addTodo(txt, uiSize);
  inp.value = '';
  renderTodos();
  sfx.add();
}

function renderAll(){ renderTop(); renderTodos(); renderRight(); renderNight(); }

/* ---------- 루프 ---------- */
const SIM_HZ = 20, SIM_DT = 1 / SIM_HZ;
let acc = 0, lastT = 0, panelT = 0;

/* 루프는 게임이 지금 살고 있는 창에서 돌려야 한다 (HOST — js/widget.js).
   떠 있는 창으로 나갔는데 rAF 를 원래 탭에 걸어 두면, 다른 탭으로 옮기는
   순간 그 탭이 숨어서 프레임이 멈추고 위젯이 얼어붙는다. */
function frame(now){
  // 창을 옮기면 타임스탬프 기준점도 바뀐다 — 음수 dt 로 시뮬이 뒤로 가지 않게 막는다
  const dt = Math.max(0, Math.min(0.25, (now - lastT) / 1000 || 0));
  lastT = now;

  acc += dt;
  let guard = 0;
  while (acc >= SIM_DT && guard++ < 8){ simTick(SIM_DT); acc -= SIM_DT; }
  markLive();

  syncActors(dt);
  renderTop();
  renderNight();

  panelT += dt;
  if (panelT > 1.2){
    panelT = 0;
    /* 화면에 없는 패널을 1.2초마다 다시 짜지 않는다 — 한 기둥과 탭 바에서는
       경영 패널이 다른 탭에 가 있을 때가 대부분이고, 폰에서 그건 그냥 배터리다. */
    if (!$('.veil') && bizShown()){
      const box = $('#rightBody'), sc = box.scrollTop;
      renderRight();
      box.scrollTop = sc;
    }
  }
}

/* ---------- 부팅 ---------- */
function boot(){
  applyStatic();

  const loaded = loadSave();
  const isNew = !loaded;
  S = loaded || newGame();
  decorSync();      // 저장의 벽지·바닥을 decor.js 에 맞춘다 (buildWorld 보다 먼저)

  buildWorld();
  renderTiles();

  /* 저장된 "마지막으로 돈 시각"과 지금 사이가 벌어져 있으면 그동안 사무실은 닫혀 있었다.
     페이지를 새로 고치는 데 걸린 몇 초는 그냥 넘긴다. */
  const gap = (Date.now() - (S.last || Date.now())) / 1000;
  const off = gap > CLOSED_GAP ? settleClosed(gap) : (S.last = Date.now(), null);
  /* 닫아 둔 사이에 지나간 기한도 정산한다. 안 하면 기한은 "창을 켜 두면 걸리는 벌"이
     되고, 그러면 사람들은 창을 안 켠다 — 이 게임에서 제일 하지 말아야 할 것이다. */
  settleDue();
  runRoutines();      // 오늘 몫 루틴을 놓는다 (지난 날은 소급하지 않는다)
  pruneTodos();
  bindInput();
  renderAll();

  editInit();      // 배치 모드 — 가구를 직접 옮긴다
  careInit();      // 실시간 케어 — 점심·휴식·퇴근을 챙긴다
  widgetInit();    // 위젯 모드 · 떠 있는 창
  colInit();       // 한 기둥(D3) · 폰 탭 바(M4) — 위젯 판단 뒤에 온다
  music.init();    // 첫 입력 후 BGM 시작 (자동재생 정책)
  jukeInit();      // 💿 쥬크박스 — 곡 고르기 · 음반 · 유튜브
  storyInit();     // 가구 조사 · 단서 · 첫 결재 (STORY.md)
  tutorInit();     // 첫 출근 안내

  /* ── 시작화면이 먼저다 ──
     탭이 오기 전에는 아무것도 시작하지 않는다 — 프롤로그도, 출근 보고도. 브라우저가
     첫 입력 전에는 소리를 못 내므로 그 문을 여기서 받는 것이기도 하다(js/title.js).
     그 파일이 없으면 기다리지 않고 그대로 간다. */
  const afterTitle = () => {
    if (!S.intro){
      startIntro();                 // 프롤로그 → 총무의 편지 → 근로계약서
    } else if (isNew){
      firstLog();
      setTimeout(showHelp, 450);
    } else {
      pushLog(L({
        ko:'출근했습니다. 고양이들이 기지개를 켭니다.',
        en:'Clocked in. The cats are stretching.',
        ja:'出勤しました。猫たちが伸びをしています。',
      }), '');
      setTimeout(() => reportReturn(off, true), 500);
    }
  };
  if (window.CCTitle) window.CCTitle.wait().then(afterTitle);
  else afterTitle();

  /* 옛 저장에 CD 플레이어를 끼워 넣었으면 그렇다고 말한다(sim.js ensureJuke).
     가구가 말없이 하나 늘어나면 그건 선물이 아니라 못 보고 지나가는 것이다. */
  /* 「문 옆에 있습니다」는 폰에서 거짓이다 — 거기서는 음악이 오른쪽 세로 열에 있다.
     안내가 없는 것보다 틀린 안내가 나쁘므로 판에 따라 가리키는 곳을 바꾼다. */
  const inRail = () => { const a = $('#app'); return a && a.classList.contains('tabbar'); };
  if (newJuke) setTimeout(() => pushLog(inRail() ? L({
    ko:'총무가 <b>CD 플레이어</b>를 들여놓았습니다. 오른쪽 <b>음악</b> 단추로 틀 곡을 고릅니다.',
    en:'Admin brought in a <b>CD player</b>. Pick the music from the <b>music</b> button on the right.',
    ja:'総務が<b>CDプレーヤー</b>を入れました。右の<b>音楽</b>ボタンで曲を選べます。',
  }) : L({
    ko:'총무가 <b>CD 플레이어</b>를 들여놓았습니다. 문 옆에 있습니다 — 누르면 틀 곡을 고릅니다.',
    en:'Admin brought in a <b>CD player</b>. It is by the door — click it to pick the music.',
    ja:'総務が<b>CDプレーヤー</b>を入れました。ドアの横にあります——押すと曲を選べます。',
  }), 'good'), 1200);
  /* 달력도 같다. 벽에 걸린 그림 하나가 조작 대상이 된 것이므로, 말 안 해 주면
     아무도 그게 눌린다는 걸 모른다 (world.js ensureCal). */
  if (newCal) setTimeout(() => pushLog(inRail() ? L({
    ko:'<b>달력</b>이 열렸습니다 — 오른쪽 달력 단추로 지난 날의 결과를 보고, 앞날에 미리 적어 두고, 기한을 겁니다.',
    en:'The <b>calendar</b> is open — use the calendar button on the right for past days, days ahead and deadlines.',
    ja:'<b>カレンダー</b>が開きました——右のカレンダーボタンで過去の日、先の日、期限。',
  }) : L({
    ko:'벽에 걸린 <b>달력</b>이 이제 눌립니다 — 지난 날의 결과를 보고, 앞날에 미리 적어 두고, 기한을 겁니다.',
    en:'The <b>calendar</b> on the wall is now clickable — past days, days ahead, and deadlines.',
    ja:'壁の<b>カレンダー</b>が押せるようになりました——過去の日、先の日、そして期限。',
  }), 'good'), 1800);
  if (newBoard) setTimeout(() => pushLog(inRail() ? L({
    ko:'<b>제휴 게시판</b>이 열렸습니다 — 오른쪽 게시판 단추로 다른 지점의 오늘 결재함을 구경할 수 있습니다.',
    en:'The <b>branch board</b> is open — use the board button on the right to look in on another branch.',
    ja:'<b>提携掲示板</b>が開きました——右の掲示板ボタンでほかの支店をのぞけます。',
  }) : L({
    ko:'벽에 <b>제휴 게시판</b>이 붙었습니다 — 다른 지점의 오늘 결재함을 구경할 수 있습니다.',
    en:'A <b>branch board</b> went up on the wall — look in on another branch’s inbox.',
    ja:'壁に<b>提携掲示板</b>が付きました——ほかの支店の決裁箱をのぞけます。',
  }), 'good'), 2400);

  setInterval(save, 8000);
  setInterval(watchdog, 1000);      // 숨어 있는 동안에도 사무실은 돌아간다
  resumeLoop();
  $('#todoInput').focus();
}

/* ---------- 프롤로그 ----------
   왜 여기서 기다리는가: opening.js 는 ES 모듈이고, 모듈은 클래식 스크립트가 전부 돈
   뒤에 실행된다. boot() 는 클래식이라 그 시점에 window.CCOpen 이 아직 없다.
   그래서 잠깐 기다렸다가, 그래도 없으면(file:// 로 소스 트리를 그냥 연 경우)
   컷신 없이 계약서로 넘어간다 — 이름을 정하는 단계는 프롤로그보다 더 중요하다.

   기다리는 시간이 넉넉한 이유: 단일 파일 배포본은 모듈을 blob 으로 다시 올리므로
   느린 기기에서 몇 초가 걸린다. 짧게 잡으면 배포본에서만 오프닝이 조용히 사라진다
   (헤드리스 소프트웨어 렌더에서 실제로 그랬다). 서버로 열면 보통 0.2초 안에 온다. */
function introReady(ms = 8000){
  return new Promise(res => {
    if (window.CCOpen) return res(true);
    const t0 = performance.now();
    const iv = setInterval(() => {
      if (window.CCOpen){ clearInterval(iv); res(true); }
      else if (performance.now() - t0 > ms){ clearInterval(iv); res(false); }
    }, 40);
  });
}

function firstLog(){
  const who = (S.cats[0] && S.cats[0].name) || '';
  pushLog(L({
    ko:`<b>Copycat</b>을 넘겨받았습니다. 직원은 <b>${esc(who)}</b> 대표 하나, 품목은 캣닢.`,
    en:`Took over <b>Copycat</b>. One employee — <b>${esc(who)}</b>, the boss — and the product is catnip.`,
    ja:`<b>Copycat</b>を引き継ぎました。社員は<b>${esc(who)}</b>社長ひとり、商品はマタタビ。`,
  }), 'big');
  /* 음악이 툴바에서 사무실로 옮겨 갔다(CD 플레이어). 아무도 안 알려주면 그건 없는 기능이다 —
     사규에 적어 두긴 했지만 사규는 안 읽힌다는 게 첫 출근 안내를 만든 이유였다. */
  pushLog($('#app') && $('#app').classList.contains('tabbar') ? L({
    ko:'오른쪽 <b>음악</b> 단추로 틀 곡을 고릅니다.',
    en:'Pick the music from the <b>music</b> button on the right.',
    ja:'右の<b>音楽</b>ボタンで曲を選べます。',
  }) : L({
    ko:'문 옆에 <b>CD 플레이어</b>가 있습니다. 누르면 틀 곡을 고릅니다.',
    en:'There is a <b>CD player</b> by the door. Click it to pick the music.',
    ja:'ドアの横に<b>CDプレーヤー</b>があります。押すと曲を選べます。',
  }), '');
}

/* 컷신 동안 BGM 은 누른다 — 비와 통화 소리 위에 오르골이 겹치면 둘 다 죽는다.
   opening.js 가 편지 장면에서 이 문을 열고 music.sync() 를 부른다. */
async function playIntro(opt = {}){
  window.__introAudio = true;
  try { music.sync(); } catch(e){}      // 이미 울리고 있으면 여기서 눌린다
  /* 기다리는 동안은 검은 화면이다. 사무실 UI 를 잠깐 보여주고 컷신으로 덮으면
     스포일러이자 깜빡임이다. #app 을 숨기지 않고 투명하게만 두는 이유는,
     display:none 이면 뷰포트 크기가 0 이 되어 3D 캔버스가 헛돈다는 것. */
  document.body.classList.add('introwait');
  const ok = await introReady();
  document.body.classList.remove('introwait');
  if (ok){
    try { await window.CCOpen.play(opt); } catch(e){ console.warn('opening:', e); }
  }
  window.__introAudio = false;
  try { music.sync(); } catch(e){}
  if (typeof R3 !== 'undefined' && R3 && R3.ready) R3.fit();
  return ok;
}

async function startIntro(){
  const seen = await playIntro();
  showContract(() => {
    firstLog();
    /* 편지는 **이야기**를 했고, 안내는 **손**을 가르친다. 둘은 다른 일이다 —
       그리고 편지도 사규도 안 읽는 사람이 있다는 게 이 안내가 있는 이유다.
       사규(❓)는 그대로 있다. 여기서 자동으로 띄우지만 않는다. */
    setTimeout(startTutor, 800);
  });
}

/* ---------- 감시 타이머 ----------
   이 게임의 유인 구조가 여기에 있다. 사무실은 **페이지가 살아 있는 동안** 돌아간다.
   보이는 동안엔 rAF 가 그리면서 돌리고, 숨은 동안엔 이 타이머가 대신 돌린다 —
   숨은 문서에서 rAF 는 멈추지만 setInterval 은 (음악이 재생 중이면 특히) 계속 돈다.
   그래서 배경에 켜 둔 시간은 나중에 보정하는 숫자가 아니라 실제로 시뮬레이션된 시간이고,
   닫아둔 시간은 정말로 아무 일도 일어나지 않은 시간이다.

   배경 탭의 타이머는 최대 1분까지 늦춰질 수 있으므로, 그보다 넉넉한 90초를
   "페이지 자체가 안 돌던 시간"의 경계로 쓴다 (절전·최대화 해제·종료). */
const BG_GAP = 1.5, CLOSED_GAP = 90;
let pendingReport = null;         // 숨어 있는 동안 정산한 보고 — 돌아왔을 때 보여준다

function catchUp(sec){
  // 배경에서는 20Hz 로 잘게 돌 이유가 없다. 굵은 스텝으로 같은 시간을 따라잡는다.
  const STEP = 0.5;
  const n = Math.min(Math.ceil(sec / STEP), 400);
  const dt = sec / n;
  for (let i = 0; i < n; i++) simTick(dt);
}

/* 닫혀 있던 구간을 정산하고, 보고를 지금 보여줄지 나중에 보여줄지 정한다.
   떠 있는 창을 보고 있는 중이라면 이 탭이 숨어 있어도 그쪽에 바로 띄운다. */
function settleReturn(sec){
  const rep = settleClosed(sec);
  if (!rep) return;
  if (document.hidden && !pipLive()) pendingReport = rep;
  else reportReturn(rep, false);
}

/* "사무실이 방금 돌았다"는 표시. 표시하기 전에 경계를 먼저 본다 —
   rAF 와 감시 타이머가 둘 다 이 문을 지나야 한다. 한쪽이 표시만 하면 다른 쪽은
   구간을 볼 수 없다: 절전에서 깨어난 직후엔 rAF 가 먼저 도는데, 그때 그냥
   시각을 덮어쓰면 닫혀 있던 몇 시간이 정산도 보고도 없이 사라진다. */
/* rAF 가 방금 돈 직후에 부른다 — 이 프레임 몫은 이미 돌렸으니 큰 구멍만 본다. */
function markLive(){
  const now = Date.now();
  const el = (now - (S.last || now)) / 1000;
  if (el > CLOSED_GAP) settleReturn(el);      // 페이지가 안 돌던 시간 — 닫혀 있었다
  else if (el > BG_GAP) catchUp(el);          // 배경에서 밀려 있던 시간 — 실제로 돌린다
  S.last = now;
}

/* 숨어 있는 동안 rAF 를 대신한다. 이쪽은 아무것도 돌리지 않은 상태로 들어오므로
   벌어진 시간을 **그대로** 따라잡아야 한다 — 1초든, 타이머가 늦춰진 1분이든.
   (여기서 markLive 를 그대로 쓰면 1초 간격이 BG_GAP 문턱을 못 넘어서, 아무것도
    돌리지 않은 채 시각만 새로 찍는다. 그러면 배경에 켜 둔 시간이 조용히 사라진다.) */
function watchdog(){
  if (!S || !W) return;
  const now = Date.now();
  const el = (now - (S.last || now)) / 1000;
  if (el < 0.2) return;                       // rAF 가 방금 돌았다 — 건드리지 않는다
  if (el > CLOSED_GAP) settleReturn(el);
  else catchUp(el);
  S.last = now;
}

/* 루프를 지금 창(HOST)에서 다시 잇는다. 부팅 때 한 번, 떠 있던 창이 닫혔을 때 한 번.
   세대 번호로 옛 사슬을 끊는다 — 안 끊으면 창을 닫는 순간 떠 있던 창의 마지막
   콜백이 이 창으로 넘어와서 루프가 둘이 되고, 시뮬레이션이 두 배로 빨라진다. */
let loopGen = 0;
function resumeLoop(){
  const gen = ++loopGen;
  const tick = now => {
    if (gen !== loopGen) return;
    HOST.requestAnimationFrame(tick);
    frame(now);
  };
  HOST.requestAnimationFrame(t => { lastT = t; HOST.requestAnimationFrame(tick); });
}

boot();
