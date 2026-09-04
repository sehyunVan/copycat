/* ============================================================
   cal.js — 벽에 걸린 달력.

   사무실 벽의 📅 를 누르면 열린다 (world.js TILE.CAL · story.js 의 클릭 라우팅).
   툴바 버튼이 아니라 가구인 이유는 CD 플레이어와 같다 — 날짜를 보는 일도
   설정이 아니라 그 방 안에서 하는 일이어야 한다.

   ── 이 화면이 하는 일 셋 ──

   1. **지난 날을 열어 본다.** 그날 뭘 냈고 무엇이 남았나. 점수가 아니라 서류다.
   2. **앞날에 미리 적어 둔다.** 그날이 되면 결재함에 저절로 올라온다.
   3. **기한(⏰)을 걸거나 뗀다.** 이 방에서 혐의를 만드는 유일한 시계가 이것이다.

   ── 안 하는 일 ──

   연속 일수 · 달성률 · 진해지는 색. 지난 날을 열 수 있게 만드는 순간 **빈 날이 눈에
   보이는데**, 거기에 점수를 붙이면 이 게임은 못 한 날을 세는 물건이 된다. 칸에는
   그날의 흔적만 점으로 남긴다 — 낸 것 · 남은 것 · 샌 것. 그 이상은 세지 않는다.
   ============================================================ */

const CAL_DOW = () => L({ ko:['일','월','화','수','목','금','토'],
                          en:['S','M','T','W','T','F','S'],
                          ja:['日','月','火','水','木','金','土'] });

const calKey = (y, m, d) => dayKey(new Date(y, m - 1, d));

/* ⏰ 를 켜 둔 채로 여러 줄 적는 일이 흔하므로 창이 열려 있는 동안은 기억한다.
   창을 닫으면 잊는다 — 기본값은 언제나 「기한 없음」이다. */
let calAlarm = false;
let calSize = 's';

/* 그 하루의 흔적. 넉 달이 지나 줄이 접힌 날은 숫자만 남아 있다(S.days). */
function calDay(key){
  let up = 0, done = 0, late = 0, alarm = 0, wait = 0;
  const rows = [];
  S.todos.forEach(t => {
    if (t.due !== key && t.doneDay !== key) return;
    rows.push(t);
    if (t.due === key) up++;
    if (t.done && (t.doneDay || t.due) === key) done++;
    else if (t.late && t.due === key) late++;
    else if (t.due === key) (t.alarm ? alarm++ : wait++);
  });
  const f = (S.days || {})[key];
  if (f && !rows.length){ up += f.up || 0; done += f.done || 0; late += f.late || 0; }
  return { up, done, late, alarm, wait, rows };
}

/* 칸 하나. 점은 최대 넷까지 — 다섯 개째부터는 세는 화면이 된다. */
function calCellHTML(key, d, sel, today){
  const st = calDay(key);
  /* 순서대로 넷까지: 샌 것 → 낸 것 → 기한이 걸린 대기 → 그냥 대기.
     한 날에 무엇이 있었는지만 알면 되므로 다섯 개째부터는 안 그린다. */
  const dots = [];
  const push = (cls, n) => { for (let i = 0; i < Math.min(n, 4 - dots.length); i++)
                               dots.push(`<i class="cd ${cls}"></i>`); };
  push('late', Math.min(st.late, 2));
  push('ok', st.done);
  push('alarm', st.alarm);
  push('wait', st.wait);
  const cls = ['ccell'];
  if (key === today) cls.push('today');
  if (key === sel) cls.push('sel');
  if (key > today) cls.push('ahead');
  return `<button class="${cls.join(' ')}" data-key="${key}">
    <span class="n">${d}</span><span class="dots">${dots.join('')}</span></button>`;
}

function calMonthHTML(y, m, sel, today){
  const first = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<span class="ccell pad"></span>');
  for (let d = 1; d <= last; d++) cells.push(calCellHTML(calKey(y, m, d), d, sel, today));
  const head = CAL_DOW().map((n, i) => `<span class="cdow ${i===0?'sun':''}">${n}</span>`).join('');
  return `<div class="calhead">
      <button class="calnav" data-mv="-1">‹</button>
      <b>${L({ ko:`${y}년 ${m}월`, en:`${y}-${String(m).padStart(2,'0')}`, ja:`${y}年${m}月` })}</b>
      <button class="calnav" data-mv="1">›</button>
    </div>
    <div class="calgrid">${head}${cells.join('')}</div>`;
}

/* 고른 날의 목록. 지난 날은 읽기 전용이다 — 어제 칸에 오늘 할 일을 적을 수는 없다.
   (이미 있는 건을 오늘로 미루는 건 결재함의 ⏰ 칩이 한다.) */
function calDayHTML(key, today){
  const st = calDay(key);
  const past = key < today;
  const rows = st.rows.filter(t => t.due === key || (t.done && t.doneDay === key));
  const line = t => {
    const mark = t.done ? '<span class="ok">✓</span>'
               : t.late ? '<span class="bad">⏰</span>'
               : t.alarm ? '<span class="alm">⏰</span>' : '<span class="dot">·</span>';
    return `<div class="calrow ${t.done ? 'done' : ''} ${t.parent ? 'kid' : ''}">${mark}<span class="tx">${esc(t.text)}</span>
      ${past || t.done ? '' : `<button class="del" data-del="${t.id}">✕</button>`}</div>`;
  };
  const folded = !rows.length && (S.days || {})[key];
  const dt = keyToDate(key);
  const dow = CAL_DOW()[dt.getDay()];
  const when = key === today ? L({ ko:'오늘', en:'today', ja:'今日' })
             : past ? L({ ko:'지난 날', en:'past', ja:'過去' })
             : L({ ko:'앞날', en:'ahead', ja:'先の日' });
  const empty = folded
    ? `<div class="hint">${L({
        ko:`올림 ${folded.up} · 처리 ${folded.done}${folded.late ? ` · 샌 것 ${folded.late}` : ''}<br><span class="tiny">넉 달이 지난 줄은 숫자로 접힙니다.</span>`,
        en:`${folded.up} posted · ${folded.done} done${folded.late ? ` · ${folded.late} leaked` : ''}<br><span class="tiny">Rows older than four months fold into counts.</span>`,
        ja:`提出${folded.up}・処理${folded.done}${folded.late ? `・流出${folded.late}` : ''}<br><span class="tiny">4か月を過ぎた行は数字に畳まれます。</span>` })}</div>`
    : `<div class="hint">${past
        ? L({ ko:'이 날에는 아무것도 없었습니다.', en:'Nothing on this day.', ja:'この日は何もありませんでした。' })
        : L({ ko:'이 날에 미리 적어 둘 수 있습니다.', en:'You can write ahead for this day.', ja:'この日の分を先に書いておけます。' })}</div>`;
  const box = past ? '' : `<div class="addbox calbox">
      <input id="calInput" placeholder="${key === today
        ? L({ ko:'오늘 할 일…', en:'For today…', ja:'今日やること…' })
        : L({ ko:'이 날에 할 일…', en:'For this day…', ja:'この日にやること…' })}" maxlength="80" autocomplete="off">
      <div class="sizes" id="calSizes">
        ${['s','m','l'].map(k => `<button class="size ${k === calSize ? 'on' : ''}" data-size="${k}">${SIZE_INFO[k].label}</button>`).join('')}
        <button class="size alarm ${calAlarm ? 'on' : ''}" id="calAlarm" title="${L({
          ko:'기한 — 이 날을 넘기면 서류가 밖으로 샙니다',
          en:'Deadline — the papers leak once this day rolls over',
          ja:'期限——この日を越えると書類が外に漏れます' })}">⏰</button>
      </div>
      <button class="addbtn" id="calAdd">${L({ ko:'올리기', en:'Add', ja:'追加' })}</button>
    </div>`;
  return `<div class="calsec"><b>${L({
      ko:`${dt.getMonth()+1}월 ${dt.getDate()}일 (${dow})`,
      en:`${dt.getMonth()+1}/${dt.getDate()} (${dow})`,
      ja:`${dt.getMonth()+1}月${dt.getDate()}日 (${dow})` })}</b>
      <span class="tiny">${when}</span></div>
    ${rows.length ? rows.map(line).join('') : empty}
    ${box}`;
}

/* ---------- 루틴 ----------
   달력에 두는 이유: 루틴은 **날짜 규칙**이고, 이 방에서 날짜를 보는 곳이 여기다.
   요일 칩 일곱 개가 곧 자료 구조다(`dows`) — 「매일」·「평일」은 그 칩을 대신 눌러 주는
   손잡이일 뿐이라, 화면과 저장이 서로 다른 말을 할 자리가 없다. */
let calDows = null;      // null = 아직 안 건드림 → 매일
/* 루틴 칸은 접어 둔다. 이 창의 본업은 날짜고, 루틴은 한 번 정하면 몇 주를 안 여는
   물건이다 — 매번 펼쳐 두면 아래 절반이 늘 설정 화면이 된다. */
let calRtOpen = false;

const dowLabel = list => {
  const d = CAL_DOW();
  if (!list || list.length === 7) return L({ ko:'매일', en:'every day', ja:'毎日' });
  if (list.length === 5 && [1,2,3,4,5].every(x => list.includes(x)))
    return L({ ko:'평일', en:'weekdays', ja:'平日' });
  if (list.length === 2 && list.includes(0) && list.includes(6))
    return L({ ko:'주말', en:'weekends', ja:'週末' });
  return list.slice().sort().map(i => d[i]).join('·');
};

function calRoutineHTML(){
  const rs = S.routines || [];
  const dows = calDows || DOW_ALL;
  const d = CAL_DOW();
  const head = `<button class="calsec rtsec" id="rtFold">
      <b>🔁 ${L({ ko:'루틴', en:'Routines', ja:'ルーティン' })}</b>
      <span class="tiny">${rs.length
        ? L({ ko:`${rs.length}개 · 그날이 되면 저절로 올라옵니다`,
              en:`${rs.length} · they come up on their own`,
              ja:`${rs.length}件・その日になると自動で上がります` })
        : L({ ko:'매일 하는 일을 정해 둘 수 있습니다', en:'Set something you do daily',
              ja:'毎日やることを決めておけます' })}</span>
      <span class="caret">${calRtOpen ? '▾' : '▸'}</span></button>`;
  if (!calRtOpen) return head;
  return head + `
    ${rs.length ? rs.map(r => `<div class="calrow">
        <span class="dot">🔁</span><span class="tx">${esc(r.text)}</span>
        <span class="tiny">${dowLabel(r.dows)} · ${SIZE_INFO[r.size || 's'].label}</span>
        <button class="del" data-rtdel="${r.id}">✕</button></div>`).join('')
      : `<div class="hint">${L({
          ko:'매일 하는 일을 여기 적어 두면 아침마다 결재함에 미리 놓여 있습니다.',
          en:'Put a daily chore here and it will be waiting in the inbox each morning.',
          ja:'毎日やることをここに書いておくと、毎朝決裁箱に用意されています。' })}</div>`}
    <div class="addbox calbox">
      <input id="rtInput" maxlength="80" autocomplete="off" placeholder="${L({
        ko:'매일 하는 일…', en:'Something you do daily…', ja:'毎日やること…' })}">
      <div class="dows" id="rtDows">
        ${d.map((n, i) => `<button class="size ${dows.includes(i) ? 'on' : ''}" data-dow="${i}">${n}</button>`).join('')}
      </div>
      <div class="sizes" id="rtSizes">
        ${['s','m','l'].map(k => `<button class="size ${k === calSize ? 'on' : ''}" data-rsize="${k}">${SIZE_INFO[k].label}</button>`).join('')}
        <button class="size" data-preset="all">${L({ ko:'매일', en:'daily', ja:'毎日' })}</button>
        <button class="size" data-preset="week">${L({ ko:'평일', en:'weekdays', ja:'平日' })}</button>
      </div>
      <button class="addbtn" id="rtAdd">${L({ ko:'루틴 추가', en:'Add routine', ja:'ルーティン追加' })}</button>
    </div>
    <div class="hint">${L({
      ko:'루틴에는 <b>기한(⏰)을 걸 수 없습니다</b> — 한 번 걸면 매일 새기 때문입니다. 오늘 것만 급하면 결재함에서 그 줄에 ⏰ 를 거세요.<br>지난 날 몫은 <b>소급해서 올라오지 않습니다.</b> 사흘 만에 켜도 오늘 것만 놓입니다.',
      en:'Routines <b>can’t carry a deadline</b> — set once, it would leak every day. If today’s is urgent, put ⏰ on that line in the inbox.<br>Missed days are <b>never back-filled.</b> Come back after three days and only today’s appear.',
      ja:'ルーティンには<b>期限（⏰）を掛けられません</b>——一度掛けると毎日漏れるからです。今日の分だけ急ぐなら決裁箱でその行に⏰を掛けてください。<br>過去の分は<b>遡って上がりません。</b>3日ぶりに開いても今日の分だけです。' })}</div>`;
}

function showCalendar(startKey){
  bus.emit('cal:open');       // 열렸다는 신호. 첫 출근 안내가 쓰던 것 — 지금은 안 듣는다
  const today = bizKey();
  let sel = startKey || today;
  const d0 = keyToDate(sel);
  let y = d0.getFullYear(), m = d0.getMonth() + 1;
  calAlarm = false; calSize = 's';

  const mo = modal(`
    <div class="mhead"><div class="q">📅 ${L({ ko:'달력', en:'CALENDAR', ja:'カレンダー' })}</div>
      <h3>${L({ ko:'어느 날의 일인가', en:'Which day', ja:'どの日の仕事か' })}</h3>
      <p>${L({ ko:'지난 날은 그날의 결과가, 앞날은 미리 적어 두는 칸이 됩니다.',
               en:'Past days show what happened. Days ahead are where you write early.',
               ja:'過去の日はその日の結果、先の日は先に書いておく欄になります。' })}</p></div>
    <div class="mbody" id="calBody"></div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  const body = mo.veil.querySelector('#calBody');
  const draw = () => { body.innerHTML = calMonthHTML(y, m, sel, today) + calDayHTML(sel, today) + calRoutineHTML(); wire(); };

  function wire(){
    body.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
      m += Number(b.dataset.mv);
      if (m < 1){ m = 12; y--; } else if (m > 12){ m = 1; y++; }
      draw();
    });
    body.querySelectorAll('[data-key]').forEach(b => b.onclick = () => {
      sel = b.dataset.key; sfx.add(); draw();
      /* 폰에서는 고른 날의 목록이 화면 아래에 있다 — 누른 사람은 그걸 보려고 누른 것이다. */
      const sec = body.querySelector('.calsec');
      if (sec) sec.scrollIntoView({ block:'nearest' });
    });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      delTodo(b.dataset.del); draw(); renderTodos(); renderTop(); renderRight();
    });
    const sz = body.querySelector('#calSizes');
    if (sz) sz.onclick = e => {
      const b = e.target.closest('.size[data-size]'); if (!b) return;
      calSize = b.dataset.size;
      sz.querySelectorAll('.size[data-size]').forEach(x => x.classList.toggle('on', x === b));
    };
    const al = body.querySelector('#calAlarm');
    if (al) al.onclick = () => { calAlarm = !calAlarm; al.classList.toggle('on', calAlarm); sfx.add(); };
    /* ---- 루틴 ---- */
    const rf = body.querySelector('#rtFold');
    if (rf) rf.onclick = () => { calRtOpen = !calRtOpen; sfx.add(); draw();
      const s2 = body.querySelector('#rtFold'); if (s2) s2.scrollIntoView({ block:'nearest' }); };
    body.querySelectorAll('[data-rtdel]').forEach(b => b.onclick = () => {
      delRoutine(b.dataset.rtdel); sfx.add(); draw();
    });
    body.querySelectorAll('[data-dow]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.dow);
      const cur = (calDows || DOW_ALL).slice();
      const at = cur.indexOf(i);
      if (at >= 0) cur.splice(at, 1); else cur.push(i);
      calDows = cur;
      b.classList.toggle('on', at < 0);
    });
    body.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      calDows = b.dataset.preset === 'week' ? DOW_WEEK.slice() : DOW_ALL.slice();
      const keep = body.querySelector('#rtInput').value;
      draw();
      body.querySelector('#rtInput').value = keep;
    });
    body.querySelectorAll('[data-rsize]').forEach(b => b.onclick = () => {
      calSize = b.dataset.rsize;
      body.querySelectorAll('[data-rsize]').forEach(x => x.classList.toggle('on', x === b));
    });
    const rin = body.querySelector('#rtInput'), radd = body.querySelector('#rtAdd');
    if (rin && radd){
      const doRt = () => {
        const txt = rin.value.trim();
        if (!txt){ rin.focus(); sfx.err(); return; }
        const dows = calDows || DOW_ALL;
        if (!dows.length){
          sfx.err();
          toast(L({ ko:'요일을 하나는 골라야 합니다.', en:'Pick at least one day.', ja:'曜日をひとつは選んでください。' }));
          return;
        }
        addRoutine(txt, calSize, dows);
        /* 오늘이 그 요일이면 지금 바로 올려 준다 — 정해 두고 내일까지 기다리게 하면
           방금 한 일이 화면에 없다. */
        const n = runRoutines();
        sfx.add();
        draw();
        const again = body.querySelector('#rtInput');
        if (again) again.focus();
        renderTodos();
        if (n) toast(L({ ko:'오늘 몫이 결재함에 올라왔습니다.',
                         en:'Today’s copy is in the inbox.',
                         ja:'今日の分が決裁箱に上がりました。' }));
      };
      radd.onclick = doRt;
      onTextSubmit(rin, doRt);
    }

    const inp = body.querySelector('#calInput'), add = body.querySelector('#calAdd');
    if (!add || !inp) return;
    const doAdd = () => {
      const txt = inp.value.trim();
      if (!txt){ inp.focus(); sfx.err(); return; }
      addTodo(txt, calSize, { due: sel, alarm: calAlarm });
      sfx.add();
      draw();
      const again = body.querySelector('#calInput');
      if (again) again.focus();
      renderTodos();
    };
    add.onclick = doAdd;
    /* 결재함과 같은 문을 쓴다 — 한글 조합 중의 엔터로 줄이 쪼개지지 않게 (ui.js) */
    onTextSubmit(inp, doAdd);
  }
  draw();
  return mo;
}
