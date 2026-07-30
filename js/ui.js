/* ============================================================
   ui.js — 렌더링과 입력
   ============================================================ */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const TS = 32;                       // 타일 픽셀 (style.css의 --ts, 가구 스프라이트 크기와 동일)

let uiSize = 's', uiTab = 'staff', soundOn = true, selCat = null;
const actors = new Map();
let docEls = new Map();

/* ---------- 사운드 (WebAudio, 외부 파일 없음) ---------- */
let actx = null;
function beep(freq, dur, type, gain, slide){
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.05, actx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur + 0.02);
  } catch(e){}
}
const sfx = {
  stamp: () => { beep(660,.09,'square',.06); setTimeout(()=>beep(990,.13,'square',.05),80); },
  coin:  () => beep(880,.08,'square',.03,1400),
  meow:  () => beep(700,.16,'sawtooth',.028,430),
  buy:   () => { beep(520,.08,'square',.045); setTimeout(()=>beep(780,.1,'square',.04),70); },
  quarter:()=> [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.18,'square',.05),i*110)),
  add:   () => beep(520,.06,'square',.03,700),
  err:   () => beep(180,.12,'square',.035),
  legal: () => { beep(300,.18,'sawtooth',.045); setTimeout(()=>beep(220,.28,'sawtooth',.045),190); },
  siren: () => { for (let i=0;i<4;i++) setTimeout(()=>beep(880,.22,'square',.05,1180), i*430); },
};

/* ---------- 상단 ---------- */
function renderTop(){
  $('#coTier').textContent = TIERS[S.tier].name;
  $('#sAnchovy').textContent = fmt(S.anchovy);
  $('#sRate').textContent = '+' + fmt1(totalRate()) + '/초';
  $('#sCats').textContent = S.cats.length + '/' + deskCount();

  const pen = S.penalty || 0;
  const chip = $('#penChip');
  $('#sPen').textContent = pen;
  chip.classList.toggle('warn', pen >= 3 && pen < RAID_THRESHOLD);
  chip.classList.toggle('danger', pen >= RAID_THRESHOLD);

  const tgt = qTarget(S.quarter);
  const yr = Math.floor((S.quarter - 1) / 4) + 1, qq = ((S.quarter - 1) % 4) + 1;
  $('#qLabel').textContent = `Q${S.quarter} · ${yr}년차 ${qq}분기`;
  $('#qNum').textContent = `${S.kpi} / ${tgt} 성과`;
  $('#qFill').style.width = Math.max(0, Math.min(100, S.kpi / tgt * 100)) + '%';

  $('#fWork').textContent = (S.working || 0) + '/' + S.cats.length;
  $('#fMood').textContent = Math.round(avgMood());
  $('#fDone').textContent = S.stats.done;
  $('#fDocs').textContent = DOCS.length;
  $('#fDocs').parentElement.style.color = DOCS.length > 4 ? '#C4587A' : '';
  $('#clock').textContent = `Day ${S.day} · ${clockStr()} · ${{day:'근무',evening:'야근',night:'취침'}[phaseOf(S.clock)]}`;

  const banner = $('#raidBanner');
  if (RAID){
    banner.style.display = 'flex';
    banner.querySelector('b').textContent = Math.max(0, Math.ceil(RAID.dur - RAID.t)) + '초';
  } else banner.style.display = 'none';
  $('#viewport').classList.toggle('raiding', !!RAID);
}

/* ---------- 결재함(할 일) ---------- */
function renderTodos(){
  const el = $('#todoList');
  const open = S.todos.filter(t => !t.done);
  const done = S.todos.filter(t => t.done).slice(-6).reverse();
  const over = open.filter(isOverdue).length;
  $('#todoSub').textContent = over ? `${open.length}건 · ⚠ 이월 ${over}` : `${open.length}건 대기`;

  if (!S.todos.length){
    el.innerHTML = `<div class="empty">결재함이 비었습니다.<br>고양이들이 창밖만 보고 있습니다 🐈<br><br>
      <span class="tiny">올린 건은 고양이가 직접 물고 가서<br>자기 자리에서 도장을 찍습니다.</span></div>`;
    return;
  }
  const row = t => {
    const r = todoReward(t.size);
    const od = isOverdue(t);
    return `<div class="todo ${t.done?'done':''} ${od?'overdue':''}" data-id="${t.id}">
      <button class="chk" data-act="toggle" title="완료 처리 — 고양이가 서류를 가져갑니다">✓</button>
      <div class="txt">${esc(t.text)}
        <div class="meta"><span class="tag ${t.size}">${SIZE_INFO[t.size].label}</span>
        ${t.done ? '<span>전달됨</span>' : `<span>+${r.kpi} 성과 · 🐟${fmt(r.money)}</span>`}
        ${od ? '<span class="od">⚠ 이월 · 마감 시 밖으로 샙니다</span>' : ''}</div>
      </div>
      <button class="del" data-act="del">✕</button>
    </div>`;
  };
  // 아직 한 건도 처리 안 했으면 어디를 눌러야 하는지 알려준다
  const hint = (open.length && !S.stats.done)
    ? `<div class="chkhint">👈 왼쪽 <b>네모 칸</b>을 누르면 완료 — 고양이가 서류를 가지러 옵니다</div>` : '';
  el.innerHTML = hint + open.map(row).join('')
    + (done.length ? `<div class="sechead">최근 처리</div>` + done.map(row).join('') : '');
}

/* ---------- 사무실 타일 ---------- */
function renderTiles(){
  const w = W, box = $('#tiles');
  let html = '';
  for (let y = 0; y < w.H; y++){
    for (let x = 0; x < w.W; x++){
      const t = tileAt(w, x, y);
      const st = `left:${x*TS}px;top:${y*TS}px`;
      const floorCss = roomStyle(w.zone && w.zone[y*w.W + x] ? 'floor2' : 'floor');
      if (t === TILE.WALL)        html += `<div class="t wall" style="${st};${roomStyle(y === 0 ? 'wallTop' : 'wall')}"></div>`;
      else if (t === TILE.WINDOW) html += `<div class="t window" style="${st}"></div>`;
      else if (t === TILE.DOOR)   html += `<div class="t door" style="${st}"></div>`;
      else if (t === TILE.FLOOR)  html += `<div class="t floor" style="${st};${floorCss}"></div>`;
      else {
        const inf = TILE_INFO[t] || { n:'' };
        html += `<div class="t floor obj" style="${st};${floorCss}"></div>`
             +  `<div class="t obj" style="${st};${furnStyle(t)}" title="${inf.n}"></div>`;
      }
    }
  }
  box.innerHTML = html;
  const pw = w.W * TS, ph = w.H * TS;
  ['#tiles','#world','#night'].forEach(sel => {
    $(sel).style.width = pw + 'px'; $(sel).style.height = ph + 'px';
  });
  actors.forEach(a => a.el.remove()); actors.clear();
  docEls.forEach(e => e.remove()); docEls.clear();
  fitWorld();
}

function fitWorld(){
  if (!W) return;
  const vp = $('#viewport');
  if (!vp.clientWidth || !vp.clientHeight){ requestAnimationFrame(fitWorld); return; }
  // 반드시 내림. 올리면 월드가 뷰포트를 넘어서 잘린다.
  const raw = Math.min(vp.clientWidth / (W.W * TS), vp.clientHeight / (W.H * TS), 2.5);
  const s = Math.max(0.4, Math.floor(raw * 8) / 8);      // 도트가 덜 뭉개지도록 계단식 배율
  const world = $('#world');
  world.style.transform = `scale(${s})`;
  world.style.left = Math.round((vp.clientWidth - W.W * TS * s) / 2) + 'px';
  world.style.top  = Math.round((vp.clientHeight - W.H * TS * s) / 2) + 'px';
}

/* ---------- 액터 ---------- */
const BADGE = { coffee:'☕', litter:'🚽', social:'💬', sleep:'💤', stamp:'🖋️' };

function animState(c){
  if (c.act.s === 'walk') return 'walk';
  if (c.act.s === 'sleep') return 'sleep';
  if (c.act.s === 'work' || c.act.s === 'stamp') return 'sit';   // 책상 앞에서는 앉는다
  return 'idle';
}

function syncActors(){
  const layer = $('#actors');
  const all = S.cats.concat(NPCS);
  const seen = new Set();

  for (const c of all){
    seen.add(c.id);
    let a = actors.get(c.id);
    if (!a){
      const el = document.createElement('div');
      el.className = 'actor' + (c.npc ? ' npc npc-' + c.npc : '');
      el.dataset.cat = c.id;
      el.innerHTML = `<div class="sp"></div><div class="tagname">${esc(c.name)}</div>`;
      layer.appendChild(el);
      a = { el, sp: el.querySelector('.sp'), sig:'', badge:null };
      actors.set(c.id, a);
    }
    const st = animState(c);
    const sig = catKey(c, st);
    if (a.sig !== sig){
      a.sp.style.cssText = catStyle(c, st);
      a.sp.className = 'sp ' + catAnimClass(st);
      a.sig = sig;
    }
    a.el.style.transform = `translate(${(c.x * TS).toFixed(1)}px, ${(c.y * TS).toFixed(1)}px)`;
    a.el.style.zIndex = 10 + Math.round(c.y * 4);
    a.el.classList.toggle('sel', selCat === c.id);

    let badge = '';
    if (c.npc === 'police') badge = '🚨';
    else if (c.npc === 'legal') badge = '💼';
    else if (c.doc) badge = '📄';
    else if (c.act.s === 'stamp') badge = BADGE.stamp;
    else if (c.act.s === 'sleep') badge = BADGE.sleep;
    else if (c.act.s === 'use' && c.act.use){
      const inf = TILE_INFO[tileAt(W, c.act.use.x, c.act.use.y)];
      badge = (inf && BADGE[inf.use]) || '';
    }
    if (a.badge !== badge){
      a.badge = badge;
      const old = a.el.querySelector('.badge');
      if (old) old.remove();
      if (badge){
        const b = document.createElement('div');
        b.className = 'badge'; b.textContent = badge;
        a.el.appendChild(b);
      }
    }
  }
  actors.forEach((a, id) => { if (!seen.has(id)){ a.el.remove(); actors.delete(id); } });

  const dseen = new Set();
  for (const d of DOCS){
    dseen.add(d.id);
    let e = docEls.get(d.id);
    if (!e){
      e = document.createElement('div');
      e.className = 'doc';
      e.style.backgroundImage = `url(${docSprite()})`;
      $('#docs').appendChild(e);
      docEls.set(d.id, e);
    }
    const lift = d.state === 'carry' ? 0.55 : 0.3;
    e.style.transform = `translate(${(d.x*TS).toFixed(1)}px, ${((d.y-lift)*TS).toFixed(1)}px)`;
    e.style.zIndex = 11 + Math.round(d.y * 4);
  }
  docEls.forEach((e, id) => { if (!dseen.has(id)){ e.remove(); docEls.delete(id); } });
}

function renderNight(){
  const p = phaseOf(S.clock), h = S.clock / 60;
  let bg = 'transparent';
  if (p === 'evening'){
    const k = (h - 18) / 4;
    bg = `rgba(${Math.round(255-60*k)},${Math.round(150-60*k)},${Math.round(90+20*k)},${(0.10+0.20*k).toFixed(3)})`;
  } else if (p === 'night'){
    bg = 'rgba(22,28,66,.44)';
  } else if (h < 9){
    bg = `rgba(255,200,140,${(0.16*(9-h)).toFixed(3)})`;
  }
  $('#night').style.background = bg;
}

/* ---------- 이펙트 ---------- */
function floatAt(x, y, text, cls){
  const d = document.createElement('div');
  d.className = 'float ' + (cls || '');
  d.textContent = text;
  d.style.left = (x * TS + TS/2) + 'px';
  d.style.top  = (y * TS - 6) + 'px';
  $('#floaties').appendChild(d);
  setTimeout(() => d.remove(), 1650);
}
function sayAt(catId, text){
  const a = actors.get(catId);
  if (!a) return;
  const old = a.el.querySelector('.bubble');
  if (old) old.remove();
  const b = document.createElement('div');
  b.className = 'bubble'; b.textContent = text;
  a.el.appendChild(b);
  setTimeout(() => b.remove(), 2650);
}
function toast(msg, kind){
  const d = document.createElement('div');
  d.className = 'toast ' + (kind || ''); d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => { d.style.transition='opacity .3s'; d.style.opacity='0'; setTimeout(()=>d.remove(),300); }, 2200);
}
function confetti(){
  const w = document.createElement('div'); w.className = 'confetti';
  const cols = ['#FF9F6B','#7FCDB8','#FFB7C5','#F5C451','#9EC5F5','#FFFDF8'];
  for (let i = 0; i < 90; i++){
    const c = document.createElement('div'); c.className = 'conf';
    c.style.left = Math.random()*100 + '%';
    c.style.top = (-12 - Math.random()*30) + 'vh';
    c.style.background = cols[Math.floor(Math.random()*cols.length)];
    c.style.animationDuration = (1.6 + Math.random()*1.6) + 's';
    c.style.animationDelay = (Math.random()*.5) + 's';
    w.appendChild(c);
  }
  document.body.appendChild(w);
  setTimeout(() => w.remove(), 3800);
}

/* ---------- 오른쪽 패널 ---------- */
function renderRight(){
  const b = $('#rightBody');
  b.innerHTML = uiTab === 'staff' ? staffHTML() : uiTab === 'shop' ? shopHTML() : logHTML();
}

function portrait(c, size){
  // 시트에서 앉은 프레임 하나를 잘라 쓴다. 배경 크기가 시트 전체 기준이라 배율을 맞춰준다.
  const k = size / (CAT_SHEET.tile * CAT_SHEET.scale);
  return `<span class="pix catpix" style="width:${size}px;height:${size}px;
    ${catPortraitStyle(c)};background-size:${CAT_SHEET.cols*CAT_SHEET.tile*CAT_SHEET.scale*k}px `
    + `${CAT_SHEET.rows*CAT_SHEET.tile*CAT_SHEET.scale*k}px;`
    + `background-position:${-CAT_SHEET.tile*CAT_SHEET.scale*k}px ${-CAT_SHEET.tile*CAT_SHEET.scale*k}px"></span>`;
}
function needBars(c){
  const hc = !!(W && W.facilities.coffee);
  const ns = [['energy','#9EC5F5','기력'],['fun','#FFB7C5','재미'],['bladder','#C9B8E8','화장실']];
  if (hc) ns.push(['caffeine','#C99A6B','카페인']);
  return `<div class="needs">${ns.map(([k,col,label]) =>
    `<div class="nb" title="${label}"><i style="width:${Math.round(c.needs[k])}%;
      background:${c.needs[k]<30?'#F09999':col}"></i></div>`).join('')}</div>`;
}

const STATE_KR = { idle:'대기', walk:'이동 중', work:'근무 중', stamp:'결재 중', sleep:'취침', use:'휴식' };

function staffHTML(){
  const free = deskCount() - S.cats.length;
  const hc = hireCost();
  let h = '';

  if (S.penalty > 0){
    h += `<div class="card legalcard"><div class="crow"><span class="em">🔍</span>
      <div class="info"><b>수사 혐의 ${S.penalty}점</b><span>전 직원 생산
        ${Math.round((1-legalDrag())*100)}% 감소 — 다들 몸을 사립니다<br>
        ${RAID_THRESHOLD}점을 넘기면 냥찰청이 들이닥칩니다</span></div>
      <button class="buy" data-act="lobby" ${S.anchovy<lobbyCost()||RAID?'disabled':''}>무마 🐟${fmt(lobbyCost())}</button>
    </div>
    <div class="hintbad" style="margin-top:7px">법무법인을 통해 혐의 1점을 지웁니다. 회사가 클수록 비쌉니다.</div></div>`;
  }
  if (S.jail.length){
    h += `<div class="card legalcard">${S.jail.map(j =>
      `<div class="crow"><span class="em">🚔</span><div class="info"><b>${esc(j.cat.name)}</b>
        <span>조사 받는 중 · Q${j.returnQ} 복귀 예정 · 아무 말도 안 했다고 한다</span></div></div>`).join('')}</div>`;
  }

  h += `<div class="card" style="background:#FFF9EF">
    <div class="crow"><span class="em">🐾</span>
      <div class="info"><b>신입 채용</b><span>남은 자리 ${free}석 · 능력치는 4d6로 굴립니다</span></div>
      <button class="buy" data-act="hire" ${free<=0||S.anchovy<hc?'disabled':''}>🐟${fmt(hc)}</button>
    </div>
    ${free<=0?`<div class="hintbad">자리가 없습니다. 분기를 넘겨 사무실을 넓히세요.</div>`:''}
  </div>`;

  if (S.bag.length){
    h += `<div class="card" style="background:#FFFBF3"><div class="crow"><span class="em">🎁</span>
      <div class="info"><b>창고</b><span>${S.bag.map(id=>{const e=EQUIP.find(x=>x.id===id);return e?e.em+e.n:'';}).join(' · ')}</span></div>
    </div></div><div class="hint">고양이 카드를 누르면 장비를 채울 수 있습니다</div>`;
  }

  h += S.cats.map(c => {
    const tr = traitOf(c), r = RANKS[Math.min(c.rank, RANKS.length-1)], nx = RANKS[c.rank+1];
    const pc = promoCost(c);
    const working = c.act.s === 'work' || c.act.s === 'stamp';
    return `<div class="card catcard" data-cat="${c.id}">
      <div class="head">
        ${portrait(c, 40)}
        <div class="nm"><b>${esc(c.name)}</b> <span class="rk">${r.n}</span>
          <span class="tr">${tr.n} · ${STATE_KR[c.act.s] || '…'}</span></div>
        <div class="rate"><b style="${working?'':'opacity:.45'}">🐟${fmt1(catRate(c))}</b>/초</div>
      </div>
      ${needBars(c)}
      <div class="cfoot">
        <span class="tiny">기획 ${statOf(c,'int')} · 눈치 ${statOf(c,'wis')} · 민첩 ${statOf(c,'dex')}</span>
        <span style="flex:1"></span>
        ${nx ? `<button class="buy alt" data-act="promo" data-id="${c.id}" ${S.anchovy<pc?'disabled':''}>${nx.n} 🐟${fmt(pc)}</button>`
             : `<span class="maxrank">최고 직급</span>`}
      </div>
    </div>`;
  }).join('');
  return h;
}

function shopHTML(){
  return SHOP.map(it => {
    const owned = shopHas(it.id), locked = S.tier < it.tier;
    return `<div class="card ${owned?'owned':''} ${locked?'locked':''}">
      <div class="crow"><span class="em">${it.em}</span>
        <div class="info"><b>${it.n}</b><span>${it.d}</span></div>
        ${owned ? `<span class="okmark">설치됨 ✓</span>`
          : locked ? `<span class="tiny">🔒 ${TIERS[it.tier].name}</span>`
          : `<button class="buy" data-act="buy" data-id="${it.id}" ${S.anchovy<it.cost?'disabled':''}>🐟${fmt(it.cost)}</button>`}
      </div></div>`;
  }).join('');
}

function logHTML(){
  if (!S.log.length) return `<div class="empty">아직 사보에 실릴 소식이 없습니다.</div>`;
  return S.log.slice().reverse().map(l => `<div class="chatline ${l.k||''}">${l.t}</div>`).join('');
}

/* ---------- 모달 ---------- */
function modal(html, onClose){
  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(veil);
  const close = () => { veil.remove(); if (onClose) onClose(); };
  veil.addEventListener('click', e => {
    if (e.target === veil || e.target.closest('[data-close]')) close();
  });
  return { veil, close };
}

function showCat(id){
  const c = S.cats.find(x => x.id === id);
  if (!c) return;
  selCat = id;
  const tr = traitOf(c), r = RANKS[Math.min(c.rank, RANKS.length-1)];
  const statCell = k => {
    const v = statOf(c, k), base = c.stats[k];
    const cls = v >= 15 ? 'hi' : v <= 8 ? 'lo' : '';
    return `<div class="st ${cls}" title="${STAT_DESC[k]}"><small>${STAT_NAME[k]}</small><b>${v}</b>
      ${v!==base?`<small class="plus">+${v-base}</small>`:'<small>&nbsp;</small>'}</div>`;
  };
  const slotHTML = ([sl, kr]) => {
    const cur = c.equip[sl];
    const it = cur && EQUIP.find(x => x.id === cur);
    return `<div class="eslot ${it?'filled':''}" data-slot="${sl}">
      <span class="em">${it ? it.em : '➕'}</span>${it ? esc(it.n) : kr}</div>`;
  };
  const bagFor = sl => S.bag.map(id => EQUIP.find(x=>x.id===id)).filter(e => e && e.slot === sl);

  const m = modal(`
    <div class="mhead"><div class="q">EMPLOYEE FILE</div><h3>${esc(c.name)} ${r.n}</h3>
      <p>${tr.n} — ${tr.d}</p></div>
    <div class="mbody">
      <div class="resume">
        ${portrait(c, 84)}
        <div style="flex:1">
          <div class="tiny" style="margin-bottom:5px">현재 상태 <b>${STATE_KR[c.act.s]||'…'}</b>
            · 생산 <b>🐟${fmt1(catRate(c))}/초</b></div>
          ${needBars(c)}
          <div class="tiny">기력 ${Math.round(c.needs.energy)} · 재미 ${Math.round(c.needs.fun)} · 화장실 ${Math.round(c.needs.bladder)}</div>
        </div>
      </div>
      <div class="statgrid">${STAT_KEYS.map(statCell).join('')}</div>
      <div class="tiny">입사 시 4d6 중 최저값 1개를 버려 굴린 값입니다. 장비는 능력치에만 반영되고 겉모습은 안 바뀝니다.</div>
      <div class="slotrow">${SLOTS.map(slotHTML).join('')}</div>
      <div id="bagList"></div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>닫기</button></div>`,
    () => { selCat = null; });

  const bagBox = m.veil.querySelector('#bagList');
  m.veil.querySelectorAll('.eslot').forEach(el => el.onclick = () => {
    const sl = el.dataset.slot;
    if (c.equip[sl]){ unequip(c.id, sl); m.close(); showCat(id); renderRight(); return; }
    const items = bagFor(sl);
    bagBox.innerHTML = items.length
      ? `<div class="hint">창고에서 고르기</div>` + items.map(it =>
          `<button class="card bagitem" data-eq="${it.id}"><div class="crow"><span class="em">${it.em}</span>
           <div class="info"><b>${it.n}</b><span>${Object.entries(it.s).map(([k,v])=>STAT_NAME[k]+' +'+v).join(' · ')}</span>
           </div></div></button>`).join('')
      : `<div class="hint center">이 부위에 맞는 장비가 창고에 없습니다.<br>분기 결산에서 가끔 나옵니다.</div>`;
    bagBox.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => {
      equipItem(c.id, b.dataset.eq); m.close(); showCat(id); renderRight();
    });
  });
}

function showQuarter(d){
  const yr = Math.floor((d.q-1)/4)+1, qq = ((d.q-1)%4)+1;
  const nextMove = TIER_AT_QUARTER.find(x => x > S.quarter);
  modal(`
    <div class="mhead"><div class="q">QUARTERLY REPORT</div><h3>Q${d.q} 결산 보고</h3>
      <p>${yr}년차 ${qq}분기 · ${TIERS[d.oldTier].name}</p></div>
    <div class="mbody">
      <div class="rrow"><span>분기 매출</span><b>🐟 ${fmt(d.earned)}</b></div>
      <div class="rrow"><span>결재 처리</span><b>${d.done} 건</b></div>
      <div class="rrow"><span>재직 직원</span><b>${S.cats.length} 냥</b></div>
      <div class="rrow"><span>평균 사기</span><b>${Math.round(avgMood())}%</b></div>
      <div class="rrow"><span>분기 배당</span><b class="good">+🐟 ${fmt(d.bonus)}</b></div>
      ${d.evGain?`<div class="rrow"><span>특별 손익</span><b class="${d.evGain>0?'good':'bad'}">${d.evGain>0?'+':'-'}🐟 ${fmt(Math.abs(d.evGain))}</b></div>`:''}
      ${d.legal?`<div class="rrow"><span>뒷수습 비용</span><b class="bad">-🐟 ${fmt(d.legal.fee)}</b></div>`:''}

      ${d.legal?`<div class="legalbox">
        <span class="lbl">미처리 건 유출</span>
        전 분기에 정리하지 못한 <b>${d.legal.count}건</b>이 그대로 밖으로 나갔습니다.
        <div class="items">${d.legal.items.slice(0,5).map(t=>'· '+esc(t)).join('<br>')}
          ${d.legal.items.length>5?`<br>외 ${d.legal.items.length-5}건`:''}</div>
        <div class="pen">혐의 +${d.legal.points} → 누적 <b>${d.penalty}점</b>${d.raiding?'':` (${RAID_THRESHOLD}점 초과 시 압수수색)`}</div>
      </div>`:''}

      ${d.raiding?`<div class="raidbox">
        <div class="siren">🚨 특별사법경찰 출동 통보</div>
        혐의가 한계치를 넘었습니다. 영장이 발부됐고 냥찰청이 오고 있습니다.
        <div class="tiny" style="margin-top:6px">조사 중 생산 40% · 종료 시 과징금 15% · 직원 연행 가능</div>
      </div>`:''}

      ${d.back && d.back.length?`<div class="okbox">${d.back.map(j=>`${esc(j.cat.name)} 냥 복귀 (무혐의)`).join('<br>')}</div>`:''}

      <div class="evt"><span class="lbl">이번 분기 사건</span>${d.evText}
        ${d.evHire?`<div class="hireline">${portrait(d.evHire,34)}
          <span><b>${esc(d.evHire.name)}</b> 냥이 그대로 입사했습니다. (${traitOf(d.evHire).n})</span></div>`:''}
        ${d.evDrop?`<div class="tiny" style="margin-top:8px">📦 창고에 <b>${d.evDrop.em} ${d.evDrop.n}</b> 획득 —
          ${Object.entries(d.evDrop.s).map(([k,v])=>STAT_NAME[k]+' +'+v).join(', ')}</div>`:''}
      </div>

      ${d.moved?`<div class="promo">
          <div class="lbl2">사 무 실 이 전</div>
          <div class="big">${TIERS[S.tier].name}</div>
          <div class="tiny2">자리 ${TIERS[d.oldTier].desks}석 → <b>${deskCount()}석</b> · 전 직원 생산 +22%</div>
          <div class="flavor">“${TIERS[S.tier].flavor}”</div>
          <div class="tiny">평면도는 새로 생성되었습니다</div>
        </div>` : `<div class="tiny center" style="margin-top:14px">
          다음 이전까지 ${nextMove ? (nextMove - S.quarter) + '분기' : '— 최종 지사 도달'}</div>`}

      <div class="nextgoal"><b>Q${S.quarter}</b> 목표: <b>${qTarget(S.quarter)} 성과</b></div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>다음 분기 시작</button></div>`);
}

function showRaidEnd(d){
  modal(`
    <div class="mhead police"><div class="q">SPECIAL INVESTIGATION</div>
      <h3>조사 결과 통지서</h3><p>냥찰청 특별사법경찰 3팀</p></div>
    <div class="mbody">
      <div class="rrow"><span>혐의 내용</span><b>부정경쟁방지법 위반 등 (혐의 ${d.before}점)</b></div>
      <div class="rrow"><span>과징금</span><b class="bad">-🐟 ${fmt(d.fine)}</b></div>
      <div class="rrow"><span>혐의 처리</span><b class="good">${d.before} → 0</b></div>
      ${d.taken?`<div class="raidbox"><div class="siren">🚔 참고인 연행</div>
        <b>${esc(d.taken.name)}</b> 냥을 참고인 자격으로 연행합니다. 다음 분기 결산 시 복귀 예정입니다.
        <div class="hireline" style="margin-top:8px">${portrait(d.taken,34)}<span class="tiny">“저는 인턴인데요”</span></div>
      </div>`:`<div class="okbox">연행 인원 없음. 전 직원 귀가 조치.</div>`}
      <div class="tiny center" style="margin-top:12px">재발 시 가중 처벌됩니다. 서류는 제때 정리하십시오.</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>확인했습니다</button></div>`);
}

function showHelp(){
  modal(`
    <div class="mhead"><div class="q">INTERNAL — DO NOT DISTRIBUTE</div><h3>Copycat 영업 지침</h3>
      <p>서류상으로는 허브 유통업입니다</p></div>
    <div class="mbody helpwrap">
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>회사 소개</b> — Copycat은 서류상 <b>허브 유통업체</b>입니다. 실제로는
         <b>캣닢을 재배하고 정제해서 파는 회사</b>입니다. 3급을 1급 봉지에 담는 것도 우리 일입니다.
         그래서 <b>냥찰이 우리를 찾아옵니다.</b></p>
      <p><b>1. 결재함</b> — 할 일을 올리고 완료 체크를 하면 <b>서류가 사무실 결재함에 실제로 떨어집니다</b>.
         가까운 고양이가 걸어와 물고 가서, 자기 자리에서 도장을 찍어야 보상이 들어옵니다.</p>
      <p><b>2. 고양이는 에이전트입니다</b> — 기력·재미·화장실·카페인 욕구가 있고, 스스로 커피머신·낮잠상자·정수기를 찾아갑니다.
         자리에 앉아 있을 때만 멸치를 법니다. 놀러 다니면 수입이 줍니다. 정상입니다.</p>
      <p><b>3. 분기</b> — 성과 게이지를 채우면 결산이 열립니다. 사건이 터지고, 배당과 장비가 나오고,
         특정 분기(3·6·10·15·21·28)마다 <b>사무실을 이전</b>합니다. 평면도는 그때마다 새로 생성됩니다.</p>
      <p><b>4. 흔적</b> — 분기 마감 시점에 <b>전 분기에 올려놓고 안 끝낸 건</b>은 정리되지 못한 채 밖으로 샙니다.
         뒷수습 비용이 나가고 <b>혐의</b>가 쌓입니다. 혐의 1점당 전 직원 생산이 6% 떨어집니다 —
         다들 몸을 사리기 때문입니다. 급하면 <b>무마</b>로 돈을 써서 1점씩 지울 수 있습니다.</p>
      <p><b>5. 냥찰</b> — 혐의가 <b>${RAID_THRESHOLD}점</b>을 넘으면 영장이 나오고 압수수색이 들어옵니다.
         조사 중 생산 40%, 종료 시 과징금 15%, 확률적으로 직원 1명이 연행됩니다(다음 분기 복귀).
         흔적 없이 넘긴 분기는 혐의가 1점씩 소멸합니다.</p>
      <ul>
        <li>낮 09–18시 근무, 18–22시 야근(야근형만), 22시 이후 취침(생산 35%)</li>
        <li>능력치는 입사 시 4d6 중 최저 1개를 버려 굴립니다</li>
        <li>비품은 사무실 안에 실제로 배치되고 고양이가 이용합니다</li>
        <li>꺼놔도 최대 8시간(자동급식기 16시간) 일합니다</li>
        <li>고양이를 클릭하면 인사 기록이 열립니다</li>
      </ul>
      <p class="tiny">목표는 <b>달 지사</b>. 지구 밖에는 아직 단속 기관이 없습니다.</p>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>숙지했습니다</button></div>`);
}
