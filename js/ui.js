/* ============================================================
   ui.js — 렌더링과 입력
   ============================================================ */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const TS = 32;                       // 타일 픽셀 (style.css의 --ts, 가구 스프라이트 크기와 동일)

/* ---------- 카메라 ----------
   시뮬레이션은 벽으로 둘러싼 격자를 그대로 쓰지만, 화면에는 그 전부를 보여주지 않는다.
   사방이 벽으로 닫힌 상자는 답답하다.

   - 양옆 벽(x=0, W-1)은 안 그린다 → 좌우가 트여서 사무실이 넓어 보인다
   - 아래 벽줄(y=H-1)은 안 그린다 → 그 줄에 있는 출입문도 화면 밖으로 나간다
     (문은 NPC의 등·퇴장 지점으로 여전히 살아 있다. 화면에만 안 보인다)
   - 대신 위쪽에 벽을 한 줄 더 얹어 **상단 벽을 두 칸 높이로** 보여준다.
     한 줄만 있으면 벽이 종이처럼 얇아서 방으로 안 읽힌다.

   그래서 월드 좌표 (x,y) → 화면 타일 (x-1, y+1). 화면 크기는 (W-2) × H 칸.
   렌더·액터·서류·이펙트·배치 모드가 전부 이 변환을 지난다. */
const VIEW = { ox:-1, oy:1 };
const viewW = () => W.W - 2;
const viewH = () => W.H;             // 벽 한 줄 추가 − 아래 벽줄 제거 = 높이 그대로
const vpx = x => (x + VIEW.ox) * TS;
const vpy = y => (y + VIEW.oy) * TS;

let uiSize = 's', uiTab = 'staff', selCat = null;
/* 🔊 는 마스터 음소거다 — 끄면 효과음도 BGM도 전부 멈춘다 (일하다 상사가 지나갈 때). */
let soundOn = true;
try { soundOn = localStorage.getItem('copycat.sound') !== '0'; } catch(e){}
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
  chime: () => { beep(660,.22,'sine',.03); setTimeout(()=>beep(880,.3,'sine',.024),170); },   // 케어 알림 — 부드럽게
};

/* ---------- 자주 쓰는 라벨 ---------- */
const PER_SEC = L({ ko:'/초', en:'/s', ja:'/秒' });
const PHASE_LBL = {
  day:     L({ ko:'근무', en:'Work',        ja:'勤務' }),
  lunch:   L({ ko:'점심', en:'Lunch',       ja:'昼休み' }),
  evening: L({ ko:'야근', en:'After hours', ja:'定時後' }),
  night:   L({ ko:'취침', en:'Night',       ja:'夜' }),
};
const STATE_KR = {
  idle:  L({ ko:'대기',    en:'Idle',      ja:'待機' }),
  walk:  L({ ko:'이동 중', en:'Moving',    ja:'移動中' }),
  work:  L({ ko:'근무 중', en:'Working',   ja:'勤務中' }),
  stamp: L({ ko:'결재 중', en:'Stamping',  ja:'決裁中' }),
  sleep: L({ ko:'취침',    en:'Sleeping',  ja:'就寝' }),
  use:   L({ ko:'휴식',    en:'On break',  ja:'休憩' }),
};

/* ---------- index.html의 고정 문구 (부팅 때 한 번) ---------- */
function applyStatic(){
  document.documentElement.lang = LANG;
  document.title = L({ ko:'Copycat — 캣닢 만드는 고양이 조직',
                       en:'Copycat — the catnip cat syndicate',
                       ja:'Copycat — マタタビをつくる猫組織' });
  $('#todoInput').placeholder = L({ ko:'할 일을 올리면 고양이가 가지러 옵니다…',
                                    en:'Post a task — a cat will come fetch it…',
                                    ja:'タスクを上げると猫が取りに来ます…' });
  const kpiWord = L({ ko:'성과', en:'KPI', ja:'成果' });
  $$('#sizes .size').forEach(b => {
    const si = SIZE_INFO[b.dataset.size];
    b.innerHTML = `<b>${si.label}</b>+${si.kpi} ${kpiWord}`;
  });
  $('#btnAdd').textContent = L({ ko:'결재 상신', en:'Submit', ja:'決裁申請' });
  $('#phInbox').textContent = L({ ko:'결재함', en:'Inbox', ja:'決裁箱' });
  $('#lblCats').textContent = L({ ko:'냥', en:'cats', ja:'匹' });
  $('#lblPen').textContent  = L({ ko:'혐의', en:'heat', ja:'容疑' });
  $('#lblWork').textContent = L({ ko:'근무', en:'working', ja:'勤務' });
  $('#lblMood').textContent = L({ ko:'사기', en:'morale', ja:'士気' });
  $('#lblDocs').textContent = L({ ko:'대기', en:'waiting', ja:'待機' });
  $('#lblDone').textContent = L({ ko:'누적', en:'total', ja:'累計' });
  $('[data-tab="staff"]').textContent = '🐈 ' + L({ ko:'직원', en:'Staff', ja:'スタッフ' });
  $('[data-tab="shop"]').textContent  = '🛒 ' + L({ ko:'비품', en:'Supplies', ja:'備品' });
  $('[data-tab="log"]').textContent   = '📰 ' + L({ ko:'사보', en:'News', ja:'社報' });
  $('#btnEdit').title     = L({ ko:'배치 모드 — 가구 옮기기', en:'Decorate — move furniture', ja:'模様替え——家具を動かす' });
  $('#btnSound').title    = L({ ko:'소리 (효과음+음악)', en:'Sound (sfx + music)', ja:'サウンド（効果音＋音楽）' });
  $('#btnSettings').title = L({ ko:'설정', en:'Settings', ja:'設定' });
  $('#btnHelp').title     = L({ ko:'사규', en:'Company rules', ja:'社則' });
  $('#btnReset').title    = L({ ko:'처음부터', en:'Start over', ja:'最初から' });
}

/* ---------- 상단 ---------- */
const cdStr = m => { m = Math.max(0, Math.round(m)); return Math.floor(m/60) + ':' + String(m%60).padStart(2,'0'); };

function clockChipHTML(){
  const p = phaseOf(S.clock);
  let extra = '';
  if (p === 'lunch')
    extra = L({ ko:`오후까지 ${cdStr(WORK.lunchEnd - S.clock)}`, en:`${cdStr(WORK.lunchEnd - S.clock)} till afternoon`, ja:`午後まで${cdStr(WORK.lunchEnd - S.clock)}` });
  else if (p === 'day' && S.clock < WORK.lunch)
    extra = L({ ko:`점심까지 ${cdStr(WORK.lunch - S.clock)}`, en:`${cdStr(WORK.lunch - S.clock)} to lunch`, ja:`昼まで${cdStr(WORK.lunch - S.clock)}` });
  else if (p === 'day')
    extra = L({ ko:`퇴근까지 ${cdStr(WORK.end - S.clock)}`, en:`${cdStr(WORK.end - S.clock)} to clock-out`, ja:`退勤まで${cdStr(WORK.end - S.clock)}` });
  // 오늘 하루를 얼마나 통과했는지 — 견딘 시간이 눈에 보이게
  const pct = Math.max(0, Math.min(100, (S.clock - WORK.start) / (WORK.end - WORK.start) * 100));
  const bar = (S.clock >= WORK.start && S.clock < WORK.end) ? `<i style="width:${pct.toFixed(1)}%"></i>` : '';
  return `Day ${S.day} · ${clockStr()} · ${PHASE_LBL[p]}${extra ? ' · ' + extra : ''}${bar}`;
}

function renderTop(){
  $('#coTier').textContent = TIERS[S.tier].name;
  $('#sAnchovy').textContent = fmt(S.anchovy);
  $('#sRate').textContent = '+' + fmt1(totalRate()) + PER_SEC;
  $('#sCats').textContent = S.cats.length + '/' + deskCount();

  const pen = S.penalty || 0;
  const chip = $('#penChip');
  $('#sPen').textContent = pen;
  chip.classList.toggle('warn', pen >= 3 && pen < RAID_THRESHOLD);
  chip.classList.toggle('danger', pen >= RAID_THRESHOLD);

  const tgt = qTarget(S.quarter);
  const yr = Math.floor((S.quarter - 1) / 4) + 1, qq = ((S.quarter - 1) % 4) + 1;
  $('#qLabel').textContent = L({ ko:`Q${S.quarter} · ${yr}년차 ${qq}분기`, en:`Q${S.quarter} · Year ${yr}, Q${qq}`, ja:`Q${S.quarter}・${yr}年目 第${qq}四半期` });
  $('#qNum').textContent = L({ ko:`${S.kpi} / ${tgt} 성과`, en:`${S.kpi} / ${tgt} KPI`, ja:`${S.kpi} / ${tgt} 成果` });
  $('#qFill').style.width = Math.max(0, Math.min(100, S.kpi / tgt * 100)) + '%';

  $('#fWork').textContent = (S.working || 0) + '/' + S.cats.length;
  $('#fMood').textContent = Math.round(avgMood());
  $('#fDone').textContent = S.stats.done;
  $('#fDocs').textContent = DOCS.length;
  $('#fDocs').parentElement.style.color = DOCS.length > 4 ? '#C4587A' : '';
  $('#clock').innerHTML = clockChipHTML();

  const banner = $('#raidBanner');
  if (RAID){
    banner.style.display = 'flex';
    banner.innerHTML = '🚨 ' + L({
      ko:`압수수색 진행 중 — 생산 40% · 남은 시간 <b>${Math.max(0, Math.ceil(RAID.dur - RAID.t))}초</b>`,
      en:`Raid in progress — output 40% · <b>${Math.max(0, Math.ceil(RAID.dur - RAID.t))}s</b> left`,
      ja:`家宅捜索中——生産40%・残り<b>${Math.max(0, Math.ceil(RAID.dur - RAID.t))}秒</b>`,
    });
  } else banner.style.display = 'none';
  $('#viewport').classList.toggle('raiding', !!RAID);
}

/* ---------- 결재함(할 일) ---------- */
function renderTodos(){
  const el = $('#todoList');
  const open = S.todos.filter(t => !t.done);
  const done = S.todos.filter(t => t.done).slice(-6).reverse();
  const over = open.filter(isOverdue).length;
  $('#todoSub').textContent = over
    ? L({ ko:`${open.length}건 · ⚠ 이월 ${over}`, en:`${open.length} open · ⚠ ${over} overdue`, ja:`${open.length}件・⚠ 繰越${over}` })
    : L({ ko:`${open.length}건 대기`, en:`${open.length} waiting`, ja:`${open.length}件待機` });

  if (!S.todos.length){
    el.innerHTML = `<div class="empty">${L({
      ko:'결재함이 비었습니다.<br>고양이들이 창밖만 보고 있습니다 🐈<br><br><span class="tiny">올린 건은 고양이가 직접 물고 가서<br>자기 자리에서 도장을 찍습니다.</span>',
      en:'The inbox is empty.<br>The cats are just staring out the window 🐈<br><br><span class="tiny">Posted items get carried off by a cat<br>and stamped at their own desk.</span>',
      ja:'決裁箱は空です。<br>猫たちは窓の外ばかり見ています 🐈<br><br><span class="tiny">上げた案件は猫がくわえて運び、<br>自分の席でハンコを押します。</span>',
    })}</div>`;
    return;
  }
  const row = t => {
    const r = todoReward(t.size);
    const od = isOverdue(t);
    return `<div class="todo ${t.done?'done':''} ${od?'overdue':''}" data-id="${t.id}">
      <button class="chk" data-act="toggle" title="${L({ ko:'완료 처리 — 고양이가 서류를 가져갑니다', en:'Mark done — a cat fetches the papers', ja:'完了処理——猫が書類を取りに来ます' })}">✓</button>
      <div class="txt">${esc(t.text)}
        <div class="meta"><span class="tag ${t.size}">${SIZE_INFO[t.size].label}</span>
        ${t.done ? `<span>${L({ ko:'전달됨', en:'Delivered', ja:'送達済み' })}</span>`
                 : `<span>+${r.kpi} ${L({ ko:'성과', en:'KPI', ja:'成果' })} · 🐟${fmt(r.money)}</span>`}
        ${od ? `<span class="od">${L({ ko:'⚠ 이월 · 마감 시 밖으로 샙니다', en:'⚠ Overdue · leaks at quarter close', ja:'⚠ 繰越・締めで外部に漏れます' })}</span>` : ''}</div>
      </div>
      <button class="del" data-act="del">✕</button>
    </div>`;
  };
  // 아직 한 건도 처리 안 했으면 어디를 눌러야 하는지 알려준다
  const hint = (open.length && !S.stats.done)
    ? `<div class="chkhint">${L({
        ko:'👈 왼쪽 <b>네모 칸</b>을 누르면 완료 — 고양이가 서류를 가지러 옵니다',
        en:'👈 Press the <b>square</b> on the left to finish — a cat comes for the papers',
        ja:'👈 左の<b>四角</b>を押すと完了——猫が書類を取りに来ます',
      })}</div>` : '';
  el.innerHTML = hint + open.map(row).join('')
    + (done.length ? `<div class="sechead">${L({ ko:'최근 처리', en:'Recently done', ja:'最近の処理' })}</div>` + done.map(row).join('') : '');
}

/* ---------- 사무실 타일 ---------- */
function renderTiles(){
  const w = W, box = $('#tiles');
  let html = '';
  // 상단 벽 한 줄 추가 (화면 y=0). 윗면 마감이 있는 타일로 깔고,
  // 원래 벽줄(월드 y=0)은 벽면 타일이 되어 둘이 합쳐 두 칸 높이 벽이 된다.
  for (let x = 1; x <= w.W - 2; x++)
    html += `<div class="t wall" style="left:${vpx(x)}px;top:${vpy(-1)}px;${roomStyle('wallTop')}"></div>`;

  for (let y = 0; y <= w.H - 2; y++){           // 아래 벽줄(H-1)은 그리지 않는다
    for (let x = 1; x <= w.W - 2; x++){         // 양옆 벽(0, W-1)도 그리지 않는다
      const t = tileAt(w, x, y);
      const st = `left:${vpx(x)}px;top:${vpy(y)}px`;
      const zn = w.zone ? w.zone[y*w.W + x] : 0;
      const floorCss = roomStyle(zn === 1 ? 'floor2' : zn === 2 ? 'floor3' : zn === 3 ? 'floor4' : 'floor');
      // 가구도 액터와 같은 축으로 깊이를 매긴다. 안 그러면 2칸짜리 가구의
      // 윗부분을 고양이가 뚫고 지나가는 것처럼 보인다.
      const z = 10 + y * 4 - 2;
      // 위쪽 벽은 이제 윗줄이 따로 있으니 여기선 전부 벽면 타일로 그린다
      if (t === TILE.WALL)        html += `<div class="t wall" style="${st};${roomStyle('wall')}"></div>`;
      else if (t === TILE.DOOR)   html += `<div class="t door" style="${st}"></div>`;
      else if (t === TILE.FLOOR)  html += `<div class="t floor" style="${st};${floorCss}"></div>`;
      else if (t === TILE.FILLER) html += `<div class="t floor" style="${st};${floorCss}"></div>`;
      else if (t === TILE.DESK_R) {
        // 2칸 책상의 오른쪽 절반 — 책상 그림은 왼쪽 칸이 통째로 그린다. 소품만 얹는다.
        html += `<div class="t floor" style="${st};${floorCss}"></div>` + deskProps(x, y, z);
      }
      else {
        const inf = TILE_INFO[t] || { n:'' };
        html += `<div class="t floor" style="${st};${floorCss}"></div>`
             +  `<div class="t obj" style="${st};z-index:${z};${furnStyle(t)}" title="${inf.n}"></div>`;
        // 책상에는 모니터를 얹고, 옆에 작은 소품을 하나 더 비켜 놓는다
        if (t === TILE.DESK) html += deskProps(x, y, z);
      }
    }
  }
  // 벽에 거는 것 — 벽 타일 위에 한 겹 더
  (w.wallDecor || []).forEach(d => {
    html += `<div class="t obj" style="left:${vpx(d.x)}px;top:${vpy(d.y)}px;z-index:${10 + d.y*4 - 2};`
         +  `${furnStyle(d.tile)}" title="${(TILE_INFO[d.tile]||{}).n || ''}"></div>`;
  });
  // 자리마다 의자 — 그림만 얹는다. 고양이가 그 위에 앉는다.
  w.desks.forEach(d => {
    const sy = d.seat.y;
    // 책상(z = 10+4(sy-1)-2)보다 뒤, 고양이(z = 10+4sy)보다 앞
    html += `<div class="t obj" style="left:${vpx(d.seat.x)}px;top:${vpy(sy)}px;`
         +  `z-index:${10 + sy*4 - 7};${chairStyle(d.seat.x, sy)}"></div>`;
  });
  // 바닥 잡동사니
  (w.clutter || []).forEach(c => {
    html += `<div class="t obj" style="left:${vpx(c.x)}px;top:${vpy(c.y)}px;`
         +  `z-index:${10 + c.y*4 - 2};${clutterStyle(c.i)}"></div>`;
  });
  box.innerHTML = html;
  const pw = viewW() * TS, ph = viewH() * TS;
  ['#tiles','#world','#night','#warm'].forEach(sel => {
    $(sel).style.width = pw + 'px'; $(sel).style.height = ph + 'px';
  });
  actors.forEach(a => a.el.remove()); actors.clear();
  docEls.forEach(e => e.remove()); docEls.clear();
  fitWorld();
}

/* 책상 한 칸의 소품 두 겹 — 주 소품(모니터)과 곁들이는 작은 물건.
   작은 쪽은 살짝 비켜 놓아야 "정리된 진열"이 아니라 "쓰는 책상"으로 보인다. */
function deskProps(x, y, z){
  const top = vpy(y - 1);
  // 작은 물건은 책상 앞쪽 모서리에 비켜 놓는다. 모니터를 가리면 지저분해 보인다.
  const off = ((x * 3 + y * 5) % 3) - 1;
  return `<div class="t obj" style="left:${vpx(x)}px;top:${top}px;z-index:${z+1};${deskTopStyle(x,y)}"></div>`
       + `<div class="t obj" style="left:${vpx(x) + off*5}px;top:${top + TS - 10}px;z-index:${z+2};`
       + `transform:scale(.75);transform-origin:bottom center;${deskSideStyle(x,y)}"></div>`;
}

function fitWorld(){
  if (!W) return;
  const vp = $('#viewport');
  if (!vp.clientWidth || !vp.clientHeight){ requestAnimationFrame(fitWorld); return; }
  const pw = viewW() * TS, ph = viewH() * TS;
  // 반드시 내림. 올리면 월드가 뷰포트를 넘어서 잘린다.
  const raw = Math.min(vp.clientWidth / pw, vp.clientHeight / ph, 2.5);
  const s = Math.max(0.4, Math.floor(raw * 8) / 8);      // 도트가 덜 뭉개지도록 계단식 배율
  const world = $('#world');
  world.style.transform = `scale(${s})`;
  world.style.left = Math.round((vp.clientWidth - pw * s) / 2) + 'px';
  world.style.top  = Math.round((vp.clientHeight - ph * s) / 2) + 'px';
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
    const sig = (c.npc === 'rival' ? 'dog|' : '') + catKey(c, st);
    if (a.sig !== sig){
      if (c.npc === 'rival'){                 // 멍멍파는 개다
        a.sp.style.cssText = dogStyle();
        a.sp.className = 'sp an2dog';
      } else {
        a.sp.style.cssText = catStyle(c, st);
        a.sp.className = 'sp ' + catAnimClass(st);
      }
      a.sig = sig;
    }
    a.el.style.transform = `translate(${vpx(c.x).toFixed(1)}px, ${vpy(c.y).toFixed(1)}px)`;
    a.el.style.zIndex = 10 + Math.round(c.y * 4);
    a.el.classList.toggle('sel', selCat === c.id);

    let badge = '';
    if (c.npc === 'rival') badge = '🦴';
    else if (c.npc === 'police') badge = '🚨';
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
    e.style.transform = `translate(${vpx(d.x).toFixed(1)}px, ${vpy(d.y - lift).toFixed(1)}px)`;
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
  d.style.left = (vpx(x) + TS/2) + 'px';
  d.style.top  = (vpy(y) - 6) + 'px';
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
function toast(msg, kind, ms){
  const d = document.createElement('div');
  d.className = 'toast ' + (kind || ''); d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => { d.style.transition='opacity .3s'; d.style.opacity='0'; setTimeout(()=>d.remove(),300); }, ms || 2200);
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
  const ns = [
    ['energy','#9EC5F5', L({ ko:'기력',   en:'Energy',   ja:'気力' })],
    ['fun','#FFB7C5',    L({ ko:'재미',   en:'Fun',      ja:'楽しさ' })],
    ['bladder','#C9B8E8',L({ ko:'화장실', en:'Bladder',  ja:'トイレ' })],
  ];
  if (hc) ns.push(['caffeine','#C99A6B', L({ ko:'카페인', en:'Caffeine', ja:'カフェイン' })]);
  return `<div class="needs">${ns.map(([k,col,label]) =>
    `<div class="nb" title="${label}"><i style="width:${Math.round(c.needs[k])}%;
      background:${c.needs[k]<30?'#F09999':col}"></i></div>`).join('')}</div>`;
}

function staffHTML(){
  const free = deskCount() - S.cats.length;
  const hc = hireCost();
  let h = '';

  {
    const pct = Math.round((S.rival || 0) * 100);
    const par = rivalPar();
    h += `<div class="card rivalcard"><div class="crow"><span class="em">🐶</span>
      <div class="info"><b>${L({ ko:`멍멍파 점유율 ${pct}%`, en:`Woof Gang share ${pct}%`, ja:`ワンワン組シェア${pct}%` })}</b><span>${L({
        ko:`마약 개껌으로 우리 거래처를 노립니다<br>전 직원 생산 ${Math.round((1-rivalDrag())*100)}% 감소 · 이번 분기 ${S.stats.qDone}/${par}건 처리`,
        en:`They’re after our clients with narcotic chews<br>All staff output −${Math.round((1-rivalDrag())*100)}% · this quarter ${S.stats.qDone}/${par} done`,
        ja:`麻薬ガムでうちの取引先を狙っています<br>全員の生産−${Math.round((1-rivalDrag())*100)}%・今期 ${S.stats.qDone}/${par}件処理`,
      })}</span></div>
    </div>
    <div class="hint" style="margin:7px 2px 0">${L({
      ko:`분기에 ${par}건 넘게 처리하면 거래처를 되찾습니다.`,
      en:`Clear more than ${par} per quarter to win clients back.`,
      ja:`四半期に${par}件以上処理すれば取引先を取り戻せます。`,
    })}</div></div>`;
  }
  if (S.penalty > 0){
    h += `<div class="card legalcard"><div class="crow"><span class="em">🔍</span>
      <div class="info"><b>${L({ ko:`수사 혐의 ${S.penalty}점`, en:`Heat: ${S.penalty} pt`, ja:`捜査容疑${S.penalty}点` })}</b><span>${L({
        ko:`전 직원 생산 ${Math.round((1-legalDrag())*100)}% 감소 — 다들 몸을 사립니다<br>${RAID_THRESHOLD}점을 넘기면 냥찰청이 들이닥칩니다`,
        en:`All staff output −${Math.round((1-legalDrag())*100)}% — everyone’s lying low<br>Cross ${RAID_THRESHOLD} points and the Pawlice storm in`,
        ja:`全員の生産−${Math.round((1-legalDrag())*100)}%——みんな萎縮しています<br>${RAID_THRESHOLD}点を超えるとニャン察が踏み込んできます`,
      })}</span></div>
      <button class="buy" data-act="lobby" ${S.anchovy<lobbyCost()||RAID?'disabled':''}>${L({ ko:'무마', en:'Hush', ja:'もみ消し' })} 🐟${fmt(lobbyCost())}</button>
    </div>
    <div class="hintbad" style="margin-top:7px">${L({
      ko:'법무법인을 통해 혐의 1점을 지웁니다. 회사가 클수록 비쌉니다.',
      en:'The law firm erases one point of heat. Pricier as the company grows.',
      ja:'法律事務所が容疑1点を消します。会社が大きいほど高くつきます。',
    })}</div></div>`;
  }
  if (S.jail.length){
    h += `<div class="card legalcard">${S.jail.map(j =>
      `<div class="crow"><span class="em">🚔</span><div class="info"><b>${esc(j.cat.name)}</b>
        <span>${L({
          ko:`조사 받는 중 · Q${j.returnQ} 복귀 예정 · 아무 말도 안 했다고 한다`,
          en:`Under questioning · back in Q${j.returnQ} · says they said nothing`,
          ja:`取り調べ中・Q${j.returnQ}復帰予定・何も言ってないらしい`,
        })}</span></div></div>`).join('')}</div>`;
  }

  {
    // 지원자가 이미 기다리고 있으면 그 냥이를 보여준다 (면접창을 닫아도 그대로 남는다)
    const cd = S.candidate;
    h += `<div class="card" style="background:#FFF9EF">
    <div class="crow"><span class="em">${cd ? portrait(cd, 30) : '🐾'}</span>
      <div class="info"><b>${cd
        ? L({ ko:`${esc(cd.name)} 냥이 면접을 기다립니다`, en:`${esc(cd.name)} is waiting for the interview`, ja:`${esc(cd.name)}が面接を待っています` })
        : L({ ko:'신입 채용', en:'Hire', ja:'新規採用' })}</b><span>${L({
        ko:`남은 자리 ${free}석 · 능력치는 4d6, 이름과 색은 직접 정합니다`,
        en:`${free} desk(s) left · 4d6 stats, you pick the name and colour`,
        ja:`残り${free}席・能力値は4d6、名前と色はあなたが決めます`,
      })}</span></div>
      <button class="buy" data-act="hire" ${free<=0||S.anchovy<hc?'disabled':''}>${L({ ko:'면접', en:'Interview', ja:'面接' })} 🐟${fmt(hc)}</button>
    </div>
    ${free<=0?`<div class="hintbad">${L({
      ko:'자리가 없습니다. 분기를 넘겨 사무실을 넓히세요.',
      en:'No desks left. Advance quarters to expand the office.',
      ja:'席がありません。四半期を進めてオフィスを広げましょう。',
    })}</div>`:''}
  </div>`;
  }

  if (S.bag.length){
    h += `<div class="card" style="background:#FFFBF3"><div class="crow"><span class="em">🎁</span>
      <div class="info"><b>${L({ ko:'창고', en:'Storage', ja:'倉庫' })}</b><span>${S.bag.map(id=>{const e=EQUIP.find(x=>x.id===id);return e?e.em+e.n:'';}).join(' · ')}</span></div>
    </div></div><div class="hint">${L({
      ko:'고양이 카드를 누르면 장비를 채울 수 있습니다',
      en:'Click a cat card to equip gear',
      ja:'猫のカードを押すと装備できます',
    })}</div>`;
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
        <div class="rate"><b style="${working?'':'opacity:.45'}">🐟${fmt1(catRate(c))}</b>${PER_SEC}</div>
      </div>
      ${needBars(c)}
      <div class="cfoot">
        <span class="tiny">${STAT_NAME.int} ${statOf(c,'int')} · ${STAT_NAME.wis} ${statOf(c,'wis')} · ${STAT_NAME.dex} ${statOf(c,'dex')}</span>
        <span style="flex:1"></span>
        ${nx ? `<button class="buy alt" data-act="promo" data-id="${c.id}" ${S.anchovy<pc?'disabled':''}>${nx.n} 🐟${fmt(pc)}</button>`
             : `<span class="maxrank">${L({ ko:'최고 직급', en:'Top rank', ja:'最高職級' })}</span>`}
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
        ${owned ? `<span class="okmark">${L({ ko:'설치됨 ✓', en:'Installed ✓', ja:'設置済み ✓' })}</span>`
          : locked ? `<span class="tiny">🔒 ${TIERS[it.tier].name}</span>`
          : `<button class="buy" data-act="buy" data-id="${it.id}" ${S.anchovy<it.cost?'disabled':''}>🐟${fmt(it.cost)}</button>`}
      </div></div>`;
  }).join('');
}

function logHTML(){
  if (!S.log.length) return `<div class="empty">${L({
    ko:'아직 사보에 실릴 소식이 없습니다.',
    en:'Nothing newsworthy yet.',
    ja:'まだ社報に載る話はありません。',
  })}</div>`;
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
          <div class="tiny" style="margin-bottom:5px">${L({ ko:'현재 상태', en:'Status', ja:'現在の状態' })} <b>${STATE_KR[c.act.s]||'…'}</b>
            · ${L({ ko:'생산', en:'Output', ja:'生産' })} <b>🐟${fmt1(catRate(c))}${PER_SEC}</b></div>
          ${needBars(c)}
          <div class="tiny">${L({
            ko:`기력 ${Math.round(c.needs.energy)} · 재미 ${Math.round(c.needs.fun)} · 화장실 ${Math.round(c.needs.bladder)}`,
            en:`Energy ${Math.round(c.needs.energy)} · Fun ${Math.round(c.needs.fun)} · Bladder ${Math.round(c.needs.bladder)}`,
            ja:`気力 ${Math.round(c.needs.energy)}・楽しさ ${Math.round(c.needs.fun)}・トイレ ${Math.round(c.needs.bladder)}`,
          })}</div>
        </div>
      </div>
      <div class="statgrid">${STAT_KEYS.map(statCell).join('')}</div>
      <div class="tiny">${L({
        ko:'입사 시 4d6 중 최저값 1개를 버려 굴린 값입니다. 장비는 능력치에만 반영되고 겉모습은 안 바뀝니다.',
        en:'Rolled at hiring with 4d6, dropping the lowest. Gear affects stats only, not looks.',
        ja:'入社時に4d6の最低値1つを捨てて振った値です。装備は能力値のみで、見た目は変わりません。',
      })}</div>
      ${recordHTML(c)}
      <div class="slotrow">${SLOTS.map(slotHTML).join('')}</div>
      <div id="bagList"></div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`,
    () => { selCat = null; });

  const bagBox = m.veil.querySelector('#bagList');
  m.veil.querySelectorAll('.eslot').forEach(el => el.onclick = () => {
    const sl = el.dataset.slot;
    if (c.equip[sl]){ unequip(c.id, sl); m.close(); showCat(id); renderRight(); return; }
    const items = bagFor(sl);
    bagBox.innerHTML = items.length
      ? `<div class="hint">${L({ ko:'창고에서 고르기', en:'Pick from storage', ja:'倉庫から選ぶ' })}</div>` + items.map(it =>
          `<button class="card bagitem" data-eq="${it.id}"><div class="crow"><span class="em">${it.em}</span>
           <div class="info"><b>${it.n}</b><span>${Object.entries(it.s).map(([k,v])=>STAT_NAME[k]+' +'+v).join(' · ')}</span>
           </div></div></button>`).join('')
      : `<div class="hint center">${L({
          ko:'이 부위에 맞는 장비가 창고에 없습니다.<br>분기 결산에서 가끔 나옵니다.',
          en:'No gear for this slot in storage.<br>Drops sometimes at quarter close.',
          ja:'この部位に合う装備が倉庫にありません。<br>決算でたまに出ます。',
        })}</div>`;
    bagBox.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => {
      equipItem(c.id, b.dataset.eq); m.close(); showCat(id); renderRight();
    });
  });
}

/* 인사 파일의 <기록> 칸.
   회사가 직원에 대해 실제로 적어 둔 것만 나열한다. 문장을 붙이지 않는 게 핵심이다 —
   건조한 표 위에 "구금 1회, 마지막 Q7"이 한 줄로 놓여 있는 게 농담이자 그 냥이의 인생이다. */
function recordHTML(c){
  const rec = normRecord(c.rec);
  const none  = L({ ko:'기록 없음', en:'Not on file', ja:'記録なし' });
  const row = (label, val) => `<div class="rrow"><span>${label}</span><b>${val}</b></div>`;
  const total = rec.docs.s + rec.docs.m + rec.docs.l;
  const cnt = n => L({ ko:`${n}건`, en:`${n}`, ja:`${n}件` });
  const top = recTopFac(c), ti = top && TILE_INFO[top.tile];

  return `<div class="evt reclog"><span class="lbl">${L({ ko:'기록', en:'RECORD', ja:'記録' })}</span>
    ${row(L({ ko:'입사', en:'Joined', ja:'入社' }), rec.q ? 'Q' + rec.q : none)}
    ${row(L({ ko:'처리 서류', en:'Documents stamped', ja:'処理書類' }), cnt(total))}
    ${total ? row(L({ ko:'크기별', en:'By size', ja:'サイズ別' }),
        `${SIZE_INFO.s.label} ${rec.docs.s} · ${SIZE_INFO.m.label} ${rec.docs.m} · ${SIZE_INFO.l.label} ${rec.docs.l}`) : ''}
    ${row(L({ ko:'자주 가는 곳', en:'Most-visited', ja:'よく行く場所' }),
        ti ? `${ti.em} ${ti.n} · ${L({ ko:`${top.n}회`, en:`${top.n}×`, ja:`${top.n}回` })}` : none)}
    ${row(L({ ko:'구금', en:'Detained', ja:'拘留' }),
        rec.det
          ? L({ ko:`${rec.det}회 · 마지막 Q${rec.detQ}`, en:`${rec.det}× · last Q${rec.detQ}`, ja:`${rec.det}回・最後はQ${rec.detQ}` })
          : L({ ko:'없음', en:'None', ja:'なし' }))}
    ${row(L({ ko:'첫 결재', en:'First stamp', ja:'初決裁' }),
        rec.first ? `Q${rec.first.q}${rec.first.t ? ' · “' + esc(rec.first.t) + '”' : ''}` : none)}
  </div>`;
}

/* ---------- 면접 (신입 채용) ----------
   능력치·특성은 4d6이 정하고, 플레이어는 **이름과 색**을 정한다.
   지원자는 저장에 남아서, 창을 닫고 다시 열어도 같은 냥이다 —
   능력치를 다시 굴리려고 창을 여닫는 건 4d6의 의미를 없앤다. */
function showHire(){
  const free = deskCount() - S.cats.length;
  if (free <= 0){
    sfx.err();
    toast(L({ ko:'자리가 없습니다. 분기를 넘겨 사무실을 넓히세요.',
              en:'No desks left. Advance quarters to expand the office.',
              ja:'席がありません。四半期を進めてオフィスを広げましょう。' }));
    return;
  }
  const c = candidateCat();
  const cost = hireCost();
  const tr = traitOf(c);

  const statCell = k => {
    const v = c.stats[k];
    const cls = v >= 15 ? 'hi' : v <= 8 ? 'lo' : '';
    return `<div class="st ${cls}" title="${STAT_DESC[k]}"><small>${STAT_NAME[k]}</small><b>${v}</b><small>&nbsp;</small></div>`;
  };
  const swatch = (look, on, label) =>
    `<button class="swatch ${on?'on':''}" data-fur="${look.fur}" data-hue="${look.hue}" title="${label}">
       ${portrait({ fur:look.fur, hue:look.hue }, 34)}<span>${label}</span></button>`;

  const m = modal(`
    <div class="mhead"><div class="q">JOB INTERVIEW</div>
      <h3>${L({ ko:'입사 지원서', en:'Job Application', ja:'入社応募書' })}</h3>
      <p>${L({ ko:'능력치는 4d6이 정합니다. 이름과 색은 당신이 정합니다.',
               en:'4d6 decides the stats. You decide the name and colour.',
               ja:'能力値は4d6が決めます。名前と色はあなたが決めます。' })}</p></div>
    <div class="mbody">
      <div class="resume">
        <span id="hirePic">${portrait(c, 84)}</span>
        <div style="flex:1">
          <div class="tiny" style="margin-bottom:5px">${L({ ko:'특성', en:'Trait', ja:'特性' })}
            <b>${tr.n}</b> — ${tr.d}</div>
          <label class="tiny" for="hireName">${L({ ko:'이름', en:'Name', ja:'名前' })}</label>
          <div class="namerow">
            <input id="hireName" maxlength="12" autocomplete="off" value="${esc(c.name)}">
            <button class="buy alt" id="hireDice" title="${L({ ko:'이름 다시 뽑기', en:'Roll a new name', ja:'名前を引き直す' })}">🎲</button>
          </div>
          <div class="tiny" id="hireNameHint">${L({ ko:'직접 적거나 🎲 를 누르세요',
            en:'Type one, or press 🎲', ja:'入力するか🎲を押してください' })}</div>
        </div>
      </div>

      <div class="hint">${L({ ko:'털색', en:'Coat', ja:'毛色' })}</div>
      <div class="swatches" id="hireFur">
        ${FURS.map((f, i) => swatch({ fur:i, hue:c.hue }, i === c.fur, f.n)).join('')}
      </div>

      <div class="hint">${L({ ko:'색조', en:'Tint', ja:'色調' })}</div>
      <div class="swatches" id="hireHue">
        ${HUE_CHOICES.map(h => swatch({ fur:c.fur, hue:h.h }, h.h === c.hue, h.n)).join('')}
      </div>

      <div class="statgrid">${STAT_KEYS.map(statCell).join('')}</div>
      <div class="tiny">${L({
        ko:'4d6 중 최저값 1개를 버려 굴린 값입니다. 면접창을 닫아도 같은 지원자가 기다립니다.',
        en:'Rolled with 4d6, dropping the lowest. Close this and the same applicant waits for you.',
        ja:'4d6の最低値1つを捨てて振った値です。閉じても同じ応募者が待っています。',
      })}</div>
    </div>
    <div class="mfoot">
      <button class="okbtn alt" data-close>${L({ ko:'나중에', en:'Later', ja:'あとで' })}</button>
      <button class="okbtn" id="hireGo" ${S.anchovy < cost ? 'disabled' : ''}>
        ${L({ ko:'채용', en:'Hire', ja:'採用' })} 🐟${fmt(cost)}</button>
    </div>`);

  const nameEl = m.veil.querySelector('#hireName');
  const refresh = () => {
    m.veil.querySelector('#hirePic').innerHTML = portrait(c, 84);
    // 스와치는 현재 선택을 반영해 다시 그린다 — 털색을 바꾸면 색조 미리보기도 같이 바뀐다
    m.veil.querySelector('#hireFur').innerHTML =
      FURS.map((f, i) => swatch({ fur:i, hue:c.hue }, i === c.fur, f.n)).join('');
    m.veil.querySelector('#hireHue').innerHTML =
      HUE_CHOICES.map(h => swatch({ fur:c.fur, hue:h.h }, h.h === c.hue, h.n)).join('');
    bindSwatches();
  };
  function bindSwatches(){
    m.veil.querySelectorAll('.swatch').forEach(b => b.onclick = () => {
      styleCandidate({ fur:+b.dataset.fur, hue:+b.dataset.hue });
      sfx.add();
      refresh();
    });
  }
  bindSwatches();

  nameEl.addEventListener('input', () => styleCandidate({ name: nameEl.value }));
  m.veil.querySelector('#hireDice').onclick = () => {
    nameEl.value = rerollCandidateName();
    sfx.meow();
  };
  m.veil.querySelector('#hireGo').onclick = () => {
    const r = hire({ name: nameEl.value, fur: c.fur, hue: c.hue });
    if (r.err){ sfx.err(); toast(r.err); return; }
    m.close();
    sfx.buy(); setTimeout(sfx.meow, 200);
    confetti();
    toast(L({ ko:`${r.cat.name} 냥 입사. 잘 부탁한다냥`,
              en:`${r.cat.name} joined. Pleased to meet you, nya`,
              ja:`${r.cat.name}が入社。よろしくにゃ` }));
    renderRight(); renderTop();
  };
  nameEl.focus();
  nameEl.select();
}

function showQuarter(d){
  const yr = Math.floor((d.q-1)/4)+1, qq = ((d.q-1)%4)+1;
  const nextMove = TIER_AT_QUARTER.find(x => x > S.quarter);
  modal(`
    <div class="mhead"><div class="q">QUARTERLY REPORT</div><h3>${L({ ko:`Q${d.q} 결산 보고`, en:`Q${d.q} Report`, ja:`Q${d.q}決算報告` })}</h3>
      <p>${L({ ko:`${yr}년차 ${qq}분기`, en:`Year ${yr}, Q${qq}`, ja:`${yr}年目 第${qq}四半期` })} · ${TIERS[d.oldTier].name}</p></div>
    <div class="mbody">
      <div class="rrow"><span>${L({ ko:'분기 매출', en:'Revenue', ja:'四半期売上' })}</span><b>🐟 ${fmt(d.earned)}</b></div>
      <div class="rrow"><span>${L({ ko:'결재 처리', en:'Approvals', ja:'決裁処理' })}</span><b>${L({ ko:`${d.done} 건`, en:`${d.done}`, ja:`${d.done}件` })}</b></div>
      <div class="rrow"><span>${L({ ko:'재직 직원', en:'Staff', ja:'在籍社員' })}</span><b>${L({ ko:`${S.cats.length} 냥`, en:`${S.cats.length} cats`, ja:`${S.cats.length}匹` })}</b></div>
      <div class="rrow"><span>${L({ ko:'평균 사기', en:'Avg morale', ja:'平均士気' })}</span><b>${Math.round(avgMood())}%</b></div>
      <div class="rrow"><span>${L({ ko:'분기 배당', en:'Dividend', ja:'四半期配当' })}</span><b class="good">+🐟 ${fmt(d.bonus)}</b></div>
      ${d.rival ? `<div class="rrow"><span>${L({ ko:'멍멍파 점유율', en:'Woof Gang share', ja:'ワンワン組シェア' })}</span><b class="${d.rival.delta>0?'bad':'good'}">
        ${Math.round(d.rival.before*100)}% → ${Math.round(d.rival.after*100)}%
        (${L({ ko:`처리 ${d.done}/${d.rival.par}건`, en:`${d.done}/${d.rival.par} done`, ja:`処理${d.done}/${d.rival.par}件` })})</b></div>` : ''}
      ${d.rivalNews ? `<div class="rivalbox"><span class="lbl">${L({ ko:'멍멍파 근황', en:'Woof Gang watch', ja:'ワンワン組の近況' })}</span>${d.rivalNews}</div>` : ''}
      ${d.evGain?`<div class="rrow"><span>${L({ ko:'특별 손익', en:'One-off P&L', ja:'特別損益' })}</span><b class="${d.evGain>0?'good':'bad'}">${d.evGain>0?'+':'-'}🐟 ${fmt(Math.abs(d.evGain))}</b></div>`:''}
      ${d.legal?`<div class="rrow"><span>${L({ ko:'뒷수습 비용', en:'Cleanup cost', ja:'後始末費用' })}</span><b class="bad">-🐟 ${fmt(d.legal.fee)}</b></div>`:''}

      ${d.legal?`<div class="legalbox">
        <span class="lbl">${L({ ko:'미처리 건 유출', en:'Unresolved leak', ja:'未処理案件の流出' })}</span>
        ${L({
          ko:`전 분기에 정리하지 못한 <b>${d.legal.count}건</b>이 그대로 밖으로 나갔습니다.`,
          en:`<b>${d.legal.count} item(s)</b> from last quarter leaked out uncleaned.`,
          ja:`前期に整理できなかった<b>${d.legal.count}件</b>がそのまま外に出ました。`,
        })}
        <div class="items">${d.legal.items.slice(0,5).map(t=>'· '+esc(t)).join('<br>')}
          ${d.legal.items.length>5?`<br>${L({ ko:`외 ${d.legal.items.length-5}건`, en:`+${d.legal.items.length-5} more`, ja:`ほか${d.legal.items.length-5}件` })}`:''}</div>
        <div class="pen">${L({
          ko:`혐의 +${d.legal.points} → 누적 <b>${d.penalty}점</b>${d.raiding?'':` (${RAID_THRESHOLD}점 초과 시 압수수색)`}`,
          en:`Heat +${d.legal.points} → total <b>${d.penalty}</b>${d.raiding?'':` (raid above ${RAID_THRESHOLD})`}`,
          ja:`容疑+${d.legal.points}→累計<b>${d.penalty}点</b>${d.raiding?'':`（${RAID_THRESHOLD}点超で家宅捜索）`}`,
        })}</div>
      </div>`:''}

      ${d.raiding?`<div class="raidbox">
        <div class="siren">${L({ ko:'🚨 특별사법경찰 출동 통보', en:'🚨 Special Investigation Unit dispatched', ja:'🚨 特別司法警察 出動通知' })}</div>
        ${L({
          ko:'혐의가 한계치를 넘었습니다. 영장이 발부됐고 냥찰청이 오고 있습니다.',
          en:'Heat crossed the line. A warrant is out and the Pawlice are on their way.',
          ja:'容疑が限界を超えました。令状が出て、ニャン察が向かっています。',
        })}
        <div class="tiny" style="margin-top:6px">${L({
          ko:'조사 중 생산 40% · 종료 시 과징금 15% · 직원 연행 가능',
          en:'Output 40% during the raid · 15% fine at the end · staff may be taken in',
          ja:'調査中は生産40%・終了時に課徴金15%・連行の可能性あり',
        })}</div>
      </div>`:''}

      ${d.back && d.back.length?`<div class="okbox">${d.back.map(j=>L({
        ko:`${esc(j.cat.name)} 냥 복귀 (무혐의)`,
        en:`${esc(j.cat.name)} is back (cleared)`,
        ja:`${esc(j.cat.name)} 復帰（嫌疑なし）`,
      })).join('<br>')}</div>`:''}

      <div class="evt"><span class="lbl">${L({ ko:'이번 분기 사건', en:'This quarter’s incident', ja:'今期の事件' })}</span>${d.evText}
        ${d.evHire?`<div class="hireline">${portrait(d.evHire,34)}
          <span>${L({
            ko:`<b>${esc(d.evHire.name)}</b> 냥이 그대로 입사했습니다. (${traitOf(d.evHire).n})`,
            en:`<b>${esc(d.evHire.name)}</b> just joined on the spot. (${traitOf(d.evHire).n})`,
            ja:`<b>${esc(d.evHire.name)}</b>がそのまま入社しました。（${traitOf(d.evHire).n}）`,
          })}</span></div>`:''}
        ${d.evDrop?`<div class="tiny" style="margin-top:8px">${L({
          ko:`📦 창고에 <b>${d.evDrop.em} ${d.evDrop.n}</b> 획득 — ${Object.entries(d.evDrop.s).map(([k,v])=>STAT_NAME[k]+' +'+v).join(', ')}`,
          en:`📦 Got <b>${d.evDrop.em} ${d.evDrop.n}</b> — ${Object.entries(d.evDrop.s).map(([k,v])=>STAT_NAME[k]+' +'+v).join(', ')}`,
          ja:`📦 倉庫に<b>${d.evDrop.em} ${d.evDrop.n}</b>を獲得——${Object.entries(d.evDrop.s).map(([k,v])=>STAT_NAME[k]+' +'+v).join('、')}`,
        })}</div>`:''}
      </div>

      ${d.moved?`<div class="promo">
          <div class="lbl2">${L({ ko:'사 무 실 이 전', en:'OFFICE MOVE', ja:'オフィス移転' })}</div>
          <div class="big">${TIERS[S.tier].name}</div>
          <div class="tiny2">${L({
            ko:`자리 ${TIERS[d.oldTier].desks}석 → <b>${deskCount()}석</b> · 전 직원 생산 +22%`,
            en:`Desks ${TIERS[d.oldTier].desks} → <b>${deskCount()}</b> · all staff +22%`,
            ja:`席 ${TIERS[d.oldTier].desks}→<b>${deskCount()}</b>・全員の生産+22%`,
          })}</div>
          <div class="flavor">“${TIERS[S.tier].flavor}”</div>
          <div class="tiny">${L({ ko:'평면도는 새로 생성되었습니다', en:'A fresh floor plan was generated', ja:'間取りは新しく生成されました' })}</div>
        </div>` : `<div class="tiny center" style="margin-top:14px">
          ${nextMove ? L({
            ko:`다음 이전까지 ${nextMove - S.quarter}분기`,
            en:`${nextMove - S.quarter} quarter(s) to the next move`,
            ja:`次の移転まで${nextMove - S.quarter}四半期`,
          }) : L({ ko:'— 최종 지사 도달', en:'— final branch reached', ja:'——最終支社に到達' })}</div>`}

      <div class="nextgoal">${L({
        ko:`<b>Q${S.quarter}</b> 목표: <b>${qTarget(S.quarter)} 성과</b>`,
        en:`<b>Q${S.quarter}</b> target: <b>${qTarget(S.quarter)} KPI</b>`,
        ja:`<b>Q${S.quarter}</b>目標：<b>${qTarget(S.quarter)}成果</b>`,
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'다음 분기 시작', en:'Start next quarter', ja:'次の四半期へ' })}</button></div>`);
}

function showRaidEnd(d){
  modal(`
    <div class="mhead police"><div class="q">SPECIAL INVESTIGATION</div>
      <h3>${L({ ko:'조사 결과 통지서', en:'Investigation Result Notice', ja:'調査結果通知書' })}</h3>
      <p>${L({ ko:'냥찰청 특별사법경찰 3팀', en:'Pawlice SIU, Squad 3', ja:'ニャン察庁特別司法警察 3班' })}</p></div>
    <div class="mbody">
      <div class="rrow"><span>${L({ ko:'혐의 내용', en:'Charges', ja:'容疑内容' })}</span><b>${L({
        ko:`마약류관리법 위반 (혐의 ${d.before}점)`,
        en:`Narcotics Control Act violation (heat ${d.before})`,
        ja:`麻薬類管理法違反（容疑${d.before}点）`,
      })}</b></div>
      <div class="rrow"><span>${L({ ko:'과징금', en:'Fine', ja:'課徴金' })}</span><b class="bad">-🐟 ${fmt(d.fine)}</b></div>
      <div class="rrow"><span>${L({ ko:'혐의 처리', en:'Heat', ja:'容疑処理' })}</span><b class="good">${d.before} → 0</b></div>
      ${d.taken?`<div class="raidbox"><div class="siren">${L({ ko:'🚔 참고인 연행', en:'🚔 Witness taken in', ja:'🚔 参考人連行' })}</div>
        ${L({
          ko:`<b>${esc(d.taken.name)}</b> 냥을 참고인 자격으로 연행합니다. 다음 분기 결산 시 복귀 예정입니다.`,
          en:`<b>${esc(d.taken.name)}</b> is being taken in as a witness. Back at next quarter’s close.`,
          ja:`<b>${esc(d.taken.name)}</b>を参考人として連行します。次の決算時に復帰予定です。`,
        })}
        <div class="hireline" style="margin-top:8px">${portrait(d.taken,34)}<span class="tiny">${L({ ko:'“저는 인턴인데요”', en:'“I’m just an intern”', ja:'「ただのインターンです」' })}</span></div>
      </div>`:`<div class="okbox">${L({ ko:'연행 인원 없음. 전 직원 귀가 조치.', en:'Nobody taken. All staff sent home.', ja:'連行なし。全員帰宅となりました。' })}</div>`}
      <div class="tiny center" style="margin-top:12px">${L({
        ko:'재발 시 가중 처벌됩니다. 서류는 제때 정리하십시오.',
        en:'Repeat offenses are punished harder. File your papers on time.',
        ja:'再犯は加重処罰です。書類は期限内に整理してください。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'확인했습니다', en:'Acknowledged', ja:'確認しました' })}</button></div>`);
}

/* 부재중 보고 — 오래 비웠다 돌아왔을 때만 연다.
   숫자는 그대로 두고, 그 옆에 그사이 사무실 상황을 두세 줄 붙인다.
   자리를 비운 걸 나무라는 문서가 되면 안 된다. 인수인계지 근태 기록이 아니다. */
function showReturn(o){
  modal(`
    <div class="mhead"><div class="q">RETURN BRIEF</div>
      <h3>${L({ ko:'부재중 보고', en:'While You Were Out', ja:'不在中の報告' })}</h3>
      <p>${L({ ko:`자리를 비운 ${o.timeStr} 동안`, en:`Over ${o.timeStr} away`, ja:`不在の${o.timeStr}のあいだ` })}</p></div>
    <div class="mbody">
      <div class="rrow"><span>${L({ ko:'그동안 매출', en:'Earned while away', ja:'その間の売上' })}</span><b class="good">+🐟 ${fmt(o.gain)}</b></div>
      <div class="evt"><span class="lbl">${L({ ko:'사무실 상황', en:'Office notes', ja:'オフィスの様子' })}</span>
        ${o.story.map(s => `<p class="storyline">${s}</p>`).join('')}</div>
      <div class="tiny center" style="margin-top:12px">${L({
        ko:'천천히 시작하면 됩니다.',
        en:'Take your time getting started.',
        ja:'ゆっくり始めて大丈夫です。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'확인', en:'OK', ja:'確認' })}</button></div>`);
}

/* ---------- 설정 ---------- */
function showSettings(){
  const onOff = v => v ? L({ ko:'켜짐', en:'On', ja:'オン' }) : L({ ko:'꺼짐', en:'Off', ja:'オフ' });
  const m = modal(`
    <div class="mhead"><div class="q">SETTINGS</div><h3>${L({ ko:'설정', en:'Settings', ja:'設定' })}</h3>
      <p>${L({ ko:'언어 · 음악 · 알림', en:'Language · music · notifications', ja:'言語・音楽・通知' })}</p></div>
    <div class="mbody">
      <div class="card">
        <div class="crow"><span class="em">🌐</span>
          <div class="info"><b>${L({ ko:'언어', en:'Language', ja:'言語' })}</b>
            <span>${L({ ko:'바꾸면 새로고침됩니다. 진행 상황은 저장됩니다.', en:'Changing reloads the page. Progress is saved.', ja:'変更するとページを再読み込みします。進行状況は保存されます。' })}</span></div>
        </div>
        <div class="sizes langrow">${LANGS.map(([code, label]) =>
          `<button class="size ${code===LANG?'on':''}" data-lang="${code}"><b>${label}</b></button>`).join('')}</div>
      </div>
      <div class="card">
        <div class="crow"><span class="em">🎶</span>
          <div class="info"><b>${L({ ko:'배경 음악', en:'Music', ja:'BGM' })}</b>
            <span>${L({ ko:'장조 수족관 — 잔잔한 생성 앰비언트. 일할 때 배경으로.', en:'Major Aquarium — a calm generative ambient to work to.', ja:'長調アクアリウム——穏やかな生成アンビエント。作業のお供に。' })}</span></div>
          <button class="buy alt" data-set="music">${onOff(music.pref())}</button>
        </div>
      </div>
      <div class="card">
        <div class="crow"><span class="em">🔔</span>
          <div class="info"><b>${L({ ko:'데스크탑 알림', en:'Desktop notifications', ja:'デスクトップ通知' })}</b>
            <span>${L({
              ko:'창이 백그라운드일 때 점심·휴식·퇴근을 알려줍니다',
              en:'Lunch, break and clock-out nudges while the tab is in the background',
              ja:'タブが背面のとき、昼休み・休憩・退勤をお知らせします',
            })}</span></div>
          <button class="buy alt" data-set="notif">${onOff(notifEnabled())}</button>
        </div>
      </div>
      <div class="hint center" style="margin-top:8px">${L({
        ko:'🔊 버튼은 전체 음소거입니다 — 효과음과 음악을 한 번에 끕니다.',
        en:'The 🔊 button is the master mute — it silences sfx and music at once.',
        ja:'🔊ボタンは全体ミュート——効果音と音楽を一度に止めます。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  m.veil.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => setLang(b.dataset.lang));
  const musicBtn = m.veil.querySelector('[data-set="music"]');
  musicBtn.onclick = () => { music.setPref(!music.pref()); musicBtn.textContent = onOff(music.pref()); };
  const notifBtn = m.veil.querySelector('[data-set="notif"]');
  notifBtn.onclick = () => {
    if (notifEnabled()) setNotif(false, on => notifBtn.textContent = onOff(on));
    else setNotif(true, on => notifBtn.textContent = onOff(on));
  };
}

function showHelp(){
  const body = L({
    ko: `
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>회사 소개</b> — 캣닢은 <b>냥법상 마약류</b>입니다. Copycat은 그걸
         <b>재배하고 정제해서 유통하는 회사</b>입니다. 등기부상 업종은 허브 유통업이고,
         그 서류가 우리를 지켜주는 유일한 것입니다. 그래서 <b>냥찰이 우리를 찾아옵니다.</b></p>
      <p><b>0. 시계가 진짜입니다</b> — 이 사무실은 <b>당신의 데스크탑 시계</b>로 돌아갑니다.
         당신의 12시에 고양이들도 밥을 먹으러 가고, 18시에는 퇴근 인사를 합니다.
         50분마다 스트레칭도 챙겨줍니다. 근무 시간을 <b>같이 견뎌주는 게임</b>입니다.</p>
      <p><b>1. 결재함</b> — 할 일을 올리고 완료 체크를 하면 <b>서류가 사무실 결재함에 실제로 떨어집니다</b>.
         가까운 고양이가 걸어와 물고 가서, 자기 자리에서 도장을 찍어야 보상이 들어옵니다.</p>
      <p><b>2. 고양이는 에이전트입니다</b> — 기력·재미·화장실·카페인 욕구가 있고, 스스로 커피머신·낮잠상자·정수기를 찾아갑니다.
         자리에 앉아 있을 때만 멸치를 법니다. 놀러 다니면 수입이 줍니다. 정상입니다.</p>
      <p><b>3. 분기</b> — 성과 게이지를 채우면 결산이 열립니다. 사건이 터지고, 배당과 장비가 나오고,
         특정 분기(3·6·10·15·21·28)마다 <b>사무실을 이전</b>합니다. 평면도는 그때마다 새로 생성됩니다.</p>
      <p><b>4. 흔적</b> — 분기 마감 시점에 <b>전 분기에 올려놓고 안 끝낸 건</b>은 정리되지 못한 채 밖으로 샙니다.
         뒷수습 비용이 나가고 <b>혐의</b>가 쌓입니다. 혐의 1점당 전 직원 생산이 6% 떨어집니다 —
         다들 몸을 사리기 때문입니다. 급하면 <b>무마</b>로 돈을 써서 1점씩 지울 수 있습니다.</p>
      <p><b>5. 멍멍파</b> — 마약 개껌을 만드는 강아지 조직입니다. 분기마다 우리가 처리한 건수가
         기준치에 못 미치면 그 사이에 <b>거래처를 가져갑니다.</b> 뺏긴 점유율만큼 전 직원 생산이
         줄어듭니다. 가만히 두면 계속 밀립니다.</p>
      <p><b>6. 냥찰</b> — 혐의가 <b>${RAID_THRESHOLD}점</b>을 넘으면 영장이 나오고 압수수색이 들어옵니다.
         조사 중 생산 40%, 종료 시 과징금 15%, 확률적으로 직원 1명이 연행됩니다(다음 분기 복귀).
         흔적 없이 넘긴 분기는 혐의가 1점씩 소멸합니다.</p>
      <p><b>7. 배치 모드</b> — 상단 <b>🛋️</b> 를 누르면 <b>가구를 직접 옮길 수 있습니다.</b>
         옮길 물건을 클릭하고, 놓을 자리를 클릭하면 끝입니다. 책상은 2칸이 한 짝이고
         바로 아래 칸이 자리라 네 칸이 필요합니다. 벽의 액자·화이트보드도 옮겨집니다.
         길이 막히거나 어떤 가구의 진입로가 사라지는 배치는 <b>빨간 칸으로 거부</b>됩니다 —
         고양이가 구석에 갇히면 안 되기 때문입니다. 배치는 그대로 저장됩니다.</p>
      <ul>
        <li>당신의 시계 기준 — 09–18시 근무, 12–13시 점심, 18–22시 야근(야근형만), 22시 이후 취침</li>
        <li>⚙️ 설정에서 언어(한국어/English/日本語)·배경 음악·데스크탑 알림을 켜고 끕니다</li>
        <li>채용은 <b>면접창</b>에서 — 이름(🎲 또는 직접 입력)과 털색·색조를 정합니다.
            능력치는 4d6이 정하고, 지원자는 창을 닫아도 그대로 기다립니다</li>
        <li>비품은 사무실 안에 실제로 배치되고 고양이가 이용합니다</li>
        <li>꺼놔도 최대 8시간(자동급식기 16시간) 일합니다</li>
        <li>고양이를 클릭하면 인사 기록이 열립니다</li>
      </ul>
      <p class="tiny">목표는 <b>달 지사</b>. 지구 밖에는 아직 단속 기관이 없습니다.</p>`,
    en: `
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>About the company</b> — Catnip is a <b>controlled substance under feline law</b>. Copycat
         <b>grows, refines and distributes it</b>. On paper we’re an herb wholesaler, and that one
         document is the only thing protecting us. Which is why <b>the Pawlice keep visiting.</b></p>
      <p><b>0. The clock is real</b> — this office runs on <b>your desktop clock</b>.
         At your noon the cats go to lunch; at 6 PM they see you off. Every 50 minutes they
         remind you to stretch. It’s a game that <b>endures the workday with you</b>.</p>
      <p><b>1. The inbox</b> — post a task and check it off, and <b>a paper physically drops into the office inbox</b>.
         The nearest cat walks over, carries it off, and must stamp it at their own desk before you get paid.</p>
      <p><b>2. Cats are agents</b> — they have energy, fun, bladder and caffeine needs, and find the coffee machine,
         nap box and water cooler on their own. They only earn anchovies while seated. Wandering costs revenue. That’s normal.</p>
      <p><b>3. Quarters</b> — fill the KPI gauge to close the books. Incidents happen, dividends and gear drop,
         and at certain quarters (3·6·10·15·21·28) the office <b>moves</b> to a freshly generated floor plan.</p>
      <p><b>4. Traces</b> — at quarter close, <b>items posted last quarter and left unfinished</b> leak out uncleaned.
         You pay cleanup costs and <b>heat</b> builds. Each point of heat cuts all output by 6% —
         everyone lies low. In a pinch, <b>hush money</b> erases one point at a time.</p>
      <p><b>5. The Woof Gang</b> — a dog syndicate making narcotic chews. Each quarter you fall short of par,
         they <b>take clients</b>, and their share cuts everyone’s output. Do nothing and you keep losing ground.</p>
      <p><b>6. The Pawlice</b> — cross <b>${RAID_THRESHOLD} points</b> of heat and a warrant drops: raid time.
         Output 40% during the search, a 15% fine at the end, and possibly one employee taken in (back next quarter).
         A clean quarter expires one point of heat.</p>
      <p><b>7. Decorate mode</b> — hit <b>🛋️</b> in the top bar to <b>move furniture yourself.</b>
         Click a piece, then click where it goes. Desks are two tiles wide with the seats
         directly below, so they need four tiles. Wall art and whiteboards move too.
         Any placement that would block a path or strand a piece with no way in is
         <b>refused with a red highlight</b> — cats must never get walled into a corner.
         Your layout is saved as-is.</p>
      <ul>
        <li>On your clock — work 9–18, lunch 12–13, overtime 18–22 (night owls only), sleep after 22</li>
        <li>⚙️ Settings: language (한국어/English/日本語), music, desktop notifications</li>
        <li>Hiring happens in an <b>interview window</b> — you pick the name (🎲 or type it)
            and the coat and tint. 4d6 sets the stats, and the applicant waits even if you close it</li>
        <li>Supplies are physically placed in the office and used by the cats</li>
        <li>They keep working up to 8h while you’re away (16h with the auto feeder)</li>
        <li>Click a cat to open their employee file</li>
      </ul>
      <p class="tiny">The goal is the <b>Moon Branch</b>. There are no enforcement agencies off-planet yet.</p>`,
    ja: `
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>会社紹介</b> — マタタビは<b>ニャン法上の薬物</b>です。Copycatはそれを
         <b>栽培・精製・流通させる会社</b>。登記上はハーブ卸で、その書類一枚だけが
         うちを守っています。だから<b>ニャン察がやって来ます。</b></p>
      <p><b>0. 時計は本物です</b> — このオフィスは<b>あなたのデスクトップ時計</b>で動きます。
         あなたの12時に猫たちも昼ごはんへ行き、18時には退勤の挨拶をします。
         50分ごとにストレッチも促してくれます。勤務時間を<b>一緒に乗り切るゲーム</b>です。</p>
      <p><b>1. 決裁箱</b> — タスクを上げて完了チェックすると、<b>書類が実際にオフィスの決裁箱に落ちます</b>。
         近くの猫が歩いてきてくわえ、自分の席でハンコを押して初めて報酬が入ります。</p>
      <p><b>2. 猫はエージェント</b> — 気力・楽しさ・トイレ・カフェインの欲求を持ち、コーヒーマシンや昼寝箱を
         自分で探して行きます。席に座っている間だけ煮干しを稼ぎます。遊びに行けば収入は減ります。正常です。</p>
      <p><b>3. 四半期</b> — 成果ゲージを満たすと決算です。事件が起き、配当と装備が出て、
         特定の四半期（3・6・10・15・21・28）に<b>オフィスを移転</b>。間取りは毎回新しく生成されます。</p>
      <p><b>4. 痕跡</b> — 締めの時点で<b>前期に上げて終わらなかった案件</b>は整理されないまま外に漏れます。
         後始末費用がかかり、<b>容疑</b>が溜まります。容疑1点ごとに全員の生産が6%下がります——
         みんな萎縮するからです。急ぎなら<b>もみ消し</b>で1点ずつ消せます。</p>
      <p><b>5. ワンワン組</b> — 麻薬ガムをつくる犬の組織。四半期の処理数が基準に届かないと
         <b>取引先を奪われ</b>、奪われたシェアの分だけ全員の生産が落ちます。放っておくと押され続けます。</p>
      <p><b>6. ニャン察</b> — 容疑が<b>${RAID_THRESHOLD}点</b>を超えると令状が出て家宅捜索。
         調査中は生産40%、終了時に課徴金15%、確率で社員1匹が連行されます（翌期復帰）。
         痕跡なしで乗り切った四半期は容疑が1点ずつ消えます。</p>
      <p><b>7. 模様替えモード</b> — 上部の<b>🛋️</b>を押すと<b>家具を自分で動かせます。</b>
         動かすものをクリックし、置く場所をクリックするだけ。デスクは横2マスで
         真下が座席なので4マス必要です。壁の額やホワイトボードも動かせます。
         道をふさいだり、どれかの家具の入口をなくす配置は<b>赤いマスで拒否</b>されます——
         猫が隅に閉じ込められてはいけないからです。配置はそのまま保存されます。</p>
      <ul>
        <li>あなたの時計基準——9–18時勤務、12–13時昼休み、18–22時残業（夜勤型のみ）、22時以降就寝</li>
        <li>⚙️ 設定で言語（한국어/English/日本語）・BGM・デスクトップ通知を切り替え</li>
        <li>採用は<b>面接ウィンドウ</b>で——名前（🎲か直接入力）と毛色・色調を決めます。
            能力値は4d6が決め、閉じても同じ応募者が待っています</li>
        <li>備品はオフィス内に実際に配置され、猫が利用します</li>
        <li>閉じていても最大8時間（自動給餌器で16時間）働きます</li>
        <li>猫をクリックすると人事ファイルが開きます</li>
      </ul>
      <p class="tiny">目標は<b>月支社</b>。地球の外にはまだ取締機関がありません。</p>`,
  });
  modal(`
    <div class="mhead"><div class="q">INTERNAL — DO NOT DISTRIBUTE</div><h3>${L({ ko:'Copycat 영업 지침', en:'Copycat Field Manual', ja:'Copycat 営業指針' })}</h3>
      <p>${L({ ko:'등기부상 업종은 허브 유통업입니다', en:'On paper, we are an herb wholesaler', ja:'登記上の業種はハーブ卸です' })}</p></div>
    <div class="mbody helpwrap">${body}</div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'숙지했습니다', en:'Understood', ja:'承知しました' })}</button></div>`);
}
