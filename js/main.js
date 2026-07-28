/* ============================================================
   main.js — 부팅 · 루프 · 입력 배선
   ============================================================ */

/* ---------- 월드 이벤트 → 화면 ---------- */
bus.on('cat:say', ({ cat, text }) => sayAt(cat.id, text));

bus.on('cat:found', ({ cat, amount }) => {
  floatAt(cat.x, cat.y, '🐟 +' + fmt(amount));
  sayAt(cat.id, '주웠다냥!');
  sfx.coin();
});

bus.on('reward', ({ cat, money, kpi }) => {
  sfx.stamp(); setTimeout(sfx.coin, 140);
  floatAt(cat.x, cat.y, '+' + kpi + ' 성과', 'kpi');
  setTimeout(() => floatAt(cat.x, cat.y - 0.4, '🐟 +' + fmt(money)), 220);
  sayAt(cat.id, ['결재 완료!','도장 쾅','처리했다냥','한 건 끝'][Math.floor(Math.random()*4)]);
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
  if (kind === 'police'){ sfx.siren(); toast('🚨 냥찰청 특별사법경찰이 도착했습니다', 'bad'); }
  else { sfx.legal(); toast('💼 법무팀이 방문했습니다', 'bad'); }
});
bus.on('raid:start', () => { pushLog('압수수색이 시작되었습니다. 전 직원 업무 중단.', 'bad'); });
bus.on('raid:end', d => { sfx.legal(); showRaidEnd(d); renderRight(); });

bus.on('log', ({ text }) => { $('#ticker').textContent = text.replace(/<[^>]+>/g, ''); if (uiTab === 'log') renderRight(); });

bus.on('day:new', d => {
  pushLog(`<b>Day ${d}</b> — 업무 시작.`, '');
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
        toast('서류가 결재함으로 갔습니다. 고양이가 가지러 옵니다.');
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
      if (a === 'hire'){
        const r = hire();
        if (r.err){ sfx.err(); toast(r.err); }
        else { sfx.buy(); setTimeout(sfx.meow, 200); toast(`${r.cat.name} 냥 입사. 잘 부탁한다냥`); }
      }
      if (a === 'promo'){ if (promote(btn.dataset.id)) sfx.buy(); else sfx.err(); }
      if (a === 'buy'){
        const it = SHOP.find(x => x.id === btn.dataset.id);
        if (buyItem(btn.dataset.id)){ sfx.buy(); toast(`${it.n} 설치 완료`); } else sfx.err();
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
    sayAt(c.id, c.act.s === 'sleep' ? ['zzz…','5분만 더…','냥…?'][Math.floor(Math.random()*3)]
                                    : CHAT.idle[Math.floor(Math.random()*CHAT.idle.length)]);
  });
  $('#actors').addEventListener('dblclick', e => {
    const a = e.target.closest('.actor'); if (a) showCat(a.dataset.cat);
  });

  $('#btnSound').onclick = () => {
    soundOn = !soundOn;
    $('#btnSound').textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) sfx.meow();
  };
  $('#btnHelp').onclick = showHelp;
  $('#btnReset').onclick = () => {
    if (!confirm('회사를 정리하고 처음부터 시작할까요? 모든 기록이 사라집니다.')) return;
    localStorage.removeItem(SAVE_KEY);
    S = newGame();
    DOCS.length = 0; NPCS.length = 0; RAID = null;
    clearSpriteCache();
    buildWorld(); renderAll();
    toast('새 회사를 차렸습니다');
  };

  window.addEventListener('resize', fitWorld);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    else { const o = applyOffline(); if (o && o.gain > 0) toast(`${o.timeStr} 동안 🐟${fmt(o.gain)} 벌어놨다`); renderAll(); }
  });
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
  const loaded = loadSave();
  const isNew = !loaded;
  S = loaded || newGame();

  buildWorld();
  renderTiles();

  const off = applyOffline();
  bindInput();
  renderAll();

  if (isNew){
    pushLog('종이상자 하나로 <b>Copycat</b>을 창업했습니다. 직원은 치즈 하나.', 'big');
    setTimeout(showHelp, 450);
  } else {
    pushLog('출근했습니다. 고양이들이 기지개를 켭니다.', '');
    if (off && off.gain > 0){
      setTimeout(() => {
        toast(`${off.timeStr} 동안 고양이들이 🐟${fmt(off.gain)} 벌어놨습니다`);
        pushLog(`자리 비운 ${off.timeStr} 동안 매출 🐟${fmt(off.gain)}.`, 'good');
      }, 500);
    }
  }

  setInterval(save, 8000);
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
  $('#todoInput').focus();
}

boot();
