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

bus.on('reward', ({ cat, money, kpi }) => {
  sfx.stamp(); setTimeout(sfx.coin, 140);
  floatAt(cat.x, cat.y, '+' + kpi + ' ' + L({ ko:'성과', en:'KPI', ja:'成果' }), 'kpi');
  setTimeout(() => floatAt(cat.x, cat.y - 0.4, '🐟 +' + fmt(money)), 220);
  sayAt(cat.id, CHAT.stamp[Math.floor(Math.random() * CHAT.stamp.length)]);
  renderTodos();
});

bus.on('doc:spawn', () => { sfx.add(); });

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

bus.on('log', ({ text }) => { $('#ticker').textContent = text.replace(/<[^>]+>/g, ''); if (uiTab === 'log') renderRight(); });

/* 실시간이라 하루는 자정에 넘어간다 */
bus.on('day:new', d => {
  pushLog(L({ ko:`<b>Day ${d}</b> — 새로운 하루입니다.`, en:`<b>Day ${d}</b> — a new day.`, ja:`<b>Day ${d}</b>——新しい一日です。` }), '');
});

/* ---------- 입력 ---------- */
function bindInput(){
  $('#btnAdd').onclick = doAdd;
  $('#todoInput').addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

  $('#sizes').addEventListener('click', e => {
    const b = e.target.closest('.size'); if (!b) return;
    uiSize = b.dataset.size;
    $$('#sizes .size').forEach(x => x.classList.toggle('on', x === b));
  });

  $('#todoList').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const row = btn.closest('.todo'), id = row.dataset.id;
    if (btn.dataset.act === 'toggle'){
      if (completeTodo(id)){
        row.classList.add('gone');
        toast(L({ ko:'서류가 결재함으로 갔습니다. 고양이가 가지러 옵니다.', en:'The papers went to the inbox. A cat is coming for them.', ja:'書類が決裁箱へ。猫が取りに来ます。' }));
        setTimeout(renderTodos, 420);
      }
    }
    if (btn.dataset.act === 'del'){
      row.classList.add('gone');
      setTimeout(() => { delTodo(id); renderTodos(); }, 380);
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

  $$('.tab').forEach(t => t.onclick = () => {
    uiTab = t.dataset.tab;
    $$('.tab').forEach(x => x.classList.toggle('on', x === t));
    renderRight();
  });

  $('#actors').addEventListener('click', e => {
    const a = e.target.closest('.actor'); if (!a) return;
    const c = S.cats.find(x => x.id === a.dataset.cat); if (!c) return;
    c.needs.fun = Math.min(100, c.needs.fun + 6);
    sfx.meow();
    sayAt(c.id, c.act.s === 'sleep'
      ? L({ ko:['zzz…','5분만 더…','냥…?'], en:['zzz…','five more minutes…','nya…?'], ja:['zzz…','あと5分…','にゃ…？'] })[Math.floor(Math.random()*3)]
      : CHAT.idle[Math.floor(Math.random()*CHAT.idle.length)]);
  });
  $('#actors').addEventListener('dblclick', e => {
    const a = e.target.closest('.actor'); if (a) showCat(a.dataset.cat);
  });

  /* 🔊 = 마스터 음소거 — 효과음과 음악을 한 번에 */
  const syncSoundBtn = () => { $('#btnSound').textContent = soundOn ? '🔊' : '🔇'; };
  syncSoundBtn();
  $('#btnSound').onclick = () => {
    soundOn = !soundOn;
    try { localStorage.setItem('copycat.sound', soundOn ? '1' : '0'); } catch(e){}
    syncSoundBtn();
    music.sync();
    if (soundOn) sfx.meow();
  };
  $('#btnCard').onclick = showCard;
  $('#btnSettings').onclick = showSettings;
  $('#btnHelp').onclick = showHelp;
  $('#btnReset').onclick = () => {
    if (!confirm(L({
      ko:'회사를 정리하고 처음부터 시작할까요? 모든 기록이 사라집니다.',
      en:'Wind down the company and start over? All records will be lost.',
      ja:'会社をたたんで最初からやり直しますか？すべての記録が消えます。',
    }))) return;
    localStorage.removeItem(SAVE_KEY);
    S = newGame();
    DOCS.length = 0; NPCS.length = 0; RAID = null;
    clearSpriteCache();
    buildWorld(); renderAll();
    toast(L({ ko:'새 회사를 차렸습니다', en:'A new company is born', ja:'新しい会社を立ち上げました' }));
  };

  window.addEventListener('resize', fitWorld);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    else {
      // 탭으로 돌아온 것뿐이니 모달로 가로막지 않는다 — 이 게임은 배경에 두고 쓰는 물건이다
      reportReturn(applyOffline(), false);
      renderAll();
    }
  });
}

/* 돌아왔을 때의 보고. 벌어둔 금액은 그대로 두고, 그사이 사무실에서
   실제로 있었던 일을 곁들인다. 오래 비웠을 때만 문서를 펴 준다 —
   잠깐 다녀온 사람 앞에 보고서를 들이미는 건 마중이 아니다. */
function reportReturn(o, modalOk){
  if (!o || o.gain <= 0) return;
  const head = L({
    ko:`${o.timeStr} 동안 🐟${fmt(o.gain)} 벌어놨다`,
    en:`Earned 🐟${fmt(o.gain)} over the last ${o.timeStr}`,
    ja:`${o.timeStr}のあいだに🐟${fmt(o.gain)}稼いでおいた`,
  });
  if (modalOk && o.mins >= 10) showReturn(o);
  else toast(head + ' · ' + o.story[0].replace(/<[^>]+>/g, ''), '', 4200);
  pushLog(L({
    ko:`자리 비운 ${o.timeStr} 동안 매출 🐟${fmt(o.gain)}.`,
    en:`Revenue of 🐟${fmt(o.gain)} while you were away (${o.timeStr}).`,
    ja:`不在の${o.timeStr}で売上🐟${fmt(o.gain)}。`,
  }) + ' ' + o.story.join(' '), 'good');
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

function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - lastT) / 1000 || 0);
  lastT = now;

  acc += dt;
  let guard = 0;
  while (acc >= SIM_DT && guard++ < 8){ simTick(SIM_DT); acc -= SIM_DT; }

  syncActors();
  renderTop();
  renderNight();

  panelT += dt;
  if (panelT > 1.2){
    panelT = 0;
    if (!document.querySelector('.veil')){
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

  buildWorld();
  renderTiles();

  const off = applyOffline();
  bindInput();
  renderAll();

  editInit();      // 배치 모드 — 가구를 직접 옮긴다
  careInit();      // 실시간 케어 — 점심·휴식·퇴근을 챙긴다
  music.init();    // 첫 입력 후 BGM 시작 (자동재생 정책)

  if (isNew){
    pushLog(L({
      ko:'뒷골목 종이상자에서 <b>Copycat</b>을 차렸습니다. 직원은 치즈 하나, 품목은 캣닢.',
      en:'Founded <b>Copycat</b> in a back-alley cardboard box. One employee named Cheese; the product is catnip.',
      ja:'裏路地のダンボールで<b>Copycat</b>を創業。社員はチーズ1匹、商品はマタタビ。',
    }), 'big');
    setTimeout(showHelp, 450);
  } else {
    pushLog(L({
      ko:'출근했습니다. 고양이들이 기지개를 켭니다.',
      en:'Clocked in. The cats are stretching.',
      ja:'出勤しました。猫たちが伸びをしています。',
    }), '');
    setTimeout(() => reportReturn(off, true), 500);
  }

  setInterval(save, 8000);
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
  $('#todoInput').focus();
}

boot();
