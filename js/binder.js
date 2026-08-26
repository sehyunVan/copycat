/* ============================================================
   binder.js — 견본책. 벽지 · 바닥 · 러그 · 가구 톤을 고르는 문 하나.

   왜 설정이 아니고 상점도 아닌가: 13번 규칙(다시 안 여는 선택지는 설정이 아니다)과
   「조작은 세계 안의 물건에」가 같은 답을 가리킨다. 그리고 이건 이 게임에서
   **생산 효과가 없는데 돈을 쓰는 두 번째 물건**이라(첫째가 음반) 상점 목록에
   서른 몇 줄을 붓지 않고 음반처럼 자기 물건을 얻었다 — 벽에 걸린 바인더.

   ── 넷이 된 이유 ──

   처음에는 벽지·바닥 둘이었다. 34번의 뒷 절반(가구 톤)과 49번(러그)이 오면서
   갈래가 넷이 됐는데, **문을 더 만들지 않았다.** 인테리어에 문이 넷이면 어디서
   뭘 고르는지를 먼저 외워야 한다. 여기 있는 것은 전부 「방이 어떻게 생겼나」이고,
   그건 한 권으로 넘겨 보는 물건이다.

   화면에서 지키는 것 셋:
     · 안 산 것도 **보여 준다.** 값이 붙어 있고 누르면 산다 (안 보이면 살 이유가 없다)
     · 잠긴 둘(전단 도배·첫 사무실 바닥)은 **가진 뒤에만 목록에 있다.** 값이 안 붙는다
     · 견본은 실물이다 — 벽지·바닥·러그는 3D 렌더러와 **같은 그림 함수**(decor.js)를
       쓰고, 가구 톤만은 그럴 수가 없어서(가구는 캔버스가 아니라 상자다) 대신
       **색을 같은 값으로** 못박았다. 모양은 근사지만 색은 근사가 아니다

   「한 벌로 사기」(추천 조합 일곱)가 있었다. 벽지와 바닥을 각각 고르는 화면에서
   묶음이 셋째 목록으로 붙으니 **고르는 축이 셋**이 됐다 — 둘이면 충분한 자리다.
   ============================================================ */

/* 견본은 **낮 하나로만** 보여 준다. 한동안 아침·낮·저녁·밤 넷을 눌러 볼 수 있었는데,
   고르는 사람에게 필요한 건 「이 벽지가 어떤 색인가」 하나이고 나머지 셋은 그 질문에
   답하지 않는다 — 손잡이가 넷이면 고르기 전에 먼저 고를 것이 생긴다.
   시간대가 어떻게 얹히는지는 사무실에서 하루를 보내면 그대로 보인다. */
const BINDER_LIGHT = { bg:'#A99C8B', tint:'rgba(240,236,226,.06)' };

/* 지금 이 물건이 방에 나와 있는가.
   벽지·바닥·톤은 「바른 것」이 하나뿐이라 CUR 과 비교하면 되고,
   러그는 여러 장이 동시에 깔리므로 깔린 목록을 본다. */
function binderOn(it, kind){
  if (kind === 'rug') return rugLaid(it.id);
  return DECOR.cur()[kind] === it.id;
}

/* 이미 가진 물건을 눌렀을 때 뭐라고 적을까 — 러그만 다르다.
   벽지는 「바른 것」이고, 러그는 깔거나 마는 것이다. */
function binderState(it, kind, on){
  if (kind === 'rug')
    return on ? L({ ko:'깔린 것 — 누르면 만다', en:'Laid — click to roll up', ja:'敷いてある——押すと片づける' })
              : L({ ko:'말아 둔 것 — 누르면 깐다', en:'Rolled up — click to lay', ja:'片づけてある——押すと敷く' });
  return on ? L({ ko:'바른 것', en:'In use', ja:'使用中' }) : it.note;
}

/* ---------- 어울리는 벽지·바닥 ----------
   가구 톤은 방의 절반만 바꾼다. 벌만 갈고 벽을 그대로 두면 **나머지 절반이 옛 벌**이라
   화면이 두 장으로 갈린다. 그래서 벌마다 짝을 적어 두고, 둘 다 가진 사람에게는
   **한 번에 맞추는 손잡이**를 준다.

   목록을 셋째로 늘리지 않는 것이 요점이다(그건 예전에 「한 벌로 사기」로 한 번 해 봤고,
   고르는 축이 하나 늘어서 뺐다). 여기 있는 것은 새 목록이 아니라 **이 카드의 동작**이다.
   안 가진 것은 사라고 말하지 않는다 — 어느 것이 짝인지만 알려 준다. */
function tonePairHTML(it){
  const p = it.pair;
  if (!p) return '';
  const w = DECOR.wallById[p.wall], f = DECOR.floorById[p.floor];
  if (!w || !f) return '';
  const cur = DECOR.cur();
  const already = cur.wall === p.wall && cur.floor === p.floor;
  const have = decorOwns(p.wall) && decorOwns(p.floor);
  /* 한 줄에 이름 둘이 들어가야 해서 「맞추기」 같은 동사를 뒤에 붙일 자리가 없다 —
     붙이면 좁은 카드에서 이름이 잘리고, 이름이 잘리면 짝을 알려 주는 목적이 사라진다.
     그래서 **줄 전체가 손잡이**다. 밑줄이 그어져 있으면 누를 수 있다는 뜻이고,
     이미 발라 뒀거나 아직 안 산 짝은 밑줄 없이 흐리게 둔다. */
  const label = `↳ ${w.n} <i>／</i> ${f.n}`;
  const tip = L({ ko:'이 벌에 어울리는 벽지·바닥으로 맞춥니다',
                  en:'Switch the wallpaper and flooring to match this set',
                  ja:'この組に合う壁紙・床に切り替えます' });
  if (already) return `<small class="dpair on">${label}</small>`;
  if (!have)   return `<small class="dpair">${label}</small>`;
  return `<small class="dpair"><b data-pair="${it.id}" title="${tip}">${label}</b></small>`;
}

function binderCard(it, kind){
  const own = decorOwns(it.id);
  const on = binderOn(it, kind);
  const locked = it.cost < 0;
  const can = S.anchovy >= it.cost;
  return `<button class="dcard${on ? ' on' : ''}${own ? '' : ' off'}"
      data-kind="${kind}" data-id="${it.id}" ${own || can ? '' : 'data-poor="1"'}>
    <canvas width="132" height="86" data-sw="${it.id}" data-swkind="${kind}"></canvas>
    <b>${it.n}</b>
    <small>${own ? binderState(it, kind, on)
                 : locked ? '🔒'
                 : `<span class="${can ? 'ok' : 'no'}">🐟${fmt(it.cost)}</span>`}</small>
    ${kind === 'tone' && own ? tonePairHTML(it) : ''}
  </button>`;
}

function binderBodyHTML(){
  /* 잠긴 것은 가진 뒤에만 목록에 있다 — 4번 규칙: 안 산 것은 목록에 없다.
     여기서는 「못 사는 것」까지 안 보여야 값이 없는 이유를 설명할 필요가 없다. */
  const vis = arr => arr.filter(it => it.cost >= 0 || decorOwns(it.id));
  const sec = (title, arr, kind) =>
    `<div class="jukesec">${title}</div>
     <div class="dgrid">${vis(arr).map(it => binderCard(it, kind)).join('')}</div>`;
  const laid = decorState().rugs.length;

  return `
    <div class="dnow">
      <b>${DECOR.wall().n}</b><i>／</i><b>${DECOR.floor().n}</b><i>／</i><b>${DECOR.tone().n}</b>
    </div>
    ${sec(L({ ko:'벽지', en:'Wallpaper', ja:'壁紙' }), DECOR.WALLS, 'wall')}
    ${sec(L({ ko:'바닥', en:'Flooring', ja:'床' }), DECOR.FLOORS, 'floor')}
    ${sec(L({ ko:`러그 — 깔린 것 ${laid}장`, en:`Rugs — ${laid} laid`, ja:`ラグ——敷いてある ${laid}枚` }), DECOR.RUGS, 'rug')}
    ${sec(L({ ko:'가구 톤', en:'Furniture Tone', ja:'家具のトーン' }), DECOR.TONES, 'tone')}`;
}

function showBinder(){
  const m = modal(`
    <div class="mhead"><div class="q">📕 ${L({ ko:'견본책', en:'SAMPLE BINDER', ja:'見本帳' })}</div>
      <h3>${L({ ko:'인테리어 견본책', en:'The Sample Binder', ja:'内装の見本帳' })}</h3>
      <p>${L({ ko:'산 것은 계속 갖고 있고, 갈아 끼우기는 무료입니다. 러그는 깔고 나면 배치 모드에서 옮깁니다.',
               en:'What you buy stays yours. Switching is free. Once laid, rugs move in Decorate mode.',
               ja:'買ったものはずっと残り、替えるのは無料です。ラグは敷いたあと模様替えで動かせます。' })}</p></div>
    <div class="mbody" id="binderBody">${binderBodyHTML()}</div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  const body = m.veil.querySelector('#binderBody');

  function paint(){
    const t = BINDER_LIGHT, cur = DECOR.cur();
    body.querySelectorAll('canvas[data-sw]').forEach(cv => {
      const id = cv.dataset.sw, kind = cv.dataset.swkind;
      if (kind === 'rug'){ DECOR.rugSwatch(cv, id, { tint:t.tint }); return; }
      if (kind === 'tone'){ DECOR.toneSwatch(cv, id, { tint:t.tint }); return; }
      DECOR.swatch(cv,
        kind === 'wall' ? id : cur.wall,
        kind === 'wall' ? cur.floor : id,
        { bg:t.bg, tint:t.tint, low: kind === 'floor' });
    });
  }

  const redraw = () => { body.innerHTML = binderBodyHTML(); wire(); paint(); renderTop(); };

  function wire(){
    /* 「맞추기」는 카드 안에 있지만 카드와 **다른 일**을 한다 — 벌을 고르는 게 아니라
       벽지·바닥을 그 벌의 짝으로 돌린다. 그래서 카드 클릭보다 먼저 가로챈다. */
    body.querySelectorAll('[data-pair]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      const t = DECOR.byId(el.dataset.pair);
      if (!t || !t.pair) return;
      decorPick(t.pair.wall);
      decorPick(t.pair.floor);
      sfx.add();
      redraw();
    });
    body.querySelectorAll('.dcard').forEach(b => b.onclick = () => {
      const id = b.dataset.id, kind = b.dataset.kind;
      if (decorOwns(id)){
        /* 러그는 누를 때마다 깔고 만다 — 「이미 그거다」로 막을 것이 없다.
           나머지 셋은 이미 바른 것을 다시 누르면 아무 일도 안 일어난다. */
        if (kind !== 'rug' && DECOR.cur()[kind] === id) return;
        if (decorPick(id)) sfx.add(); else sfx.err();
        redraw(); return;
      }
      if (!decorBuy(id)){ sfx.err(); return; }
      sfx.buy();
      decorPick(id);            // 산 것은 바로 바른다. 사고 또 눌러야 하면 그건 두 걸음이다
      redraw();
    });
  }

  wire();
  paint();
}
