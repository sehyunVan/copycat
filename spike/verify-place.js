/* 배치 쪽 다섯 가지:
     1 「사무실에 배치」가 진짜로 놓는가
     2 작은 소품(초·펜 홀더)이 방이 좀 차도 놓이는가
     3 견본책 전에는 벽지·바닥·러그·가구 톤 칸이 안 보이는가
     4 미리보기 단추가 시트 바로 위에 붙는가
     5 등급이 안 열린 가구도 **가졌으면** 목록에 보이는가 */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9463,W=390,H=844;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-place');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<80&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,200));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,400));return r?.result?.value;};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:'http://localhost:8123/index.html?3d=1&boxes=50'});
await sleep(17000);
await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();document.body.classList.remove('titleon');return 1})()`);
await sleep(1200);

/* 1 — 결과 화면의 「창고에서 확인하기」. **1연과 10연 둘 다** 본다:
   문구가 바뀌었는지 · 누르면 배치 창(창고)이 열리는지 · 방에 멋대로 놓지 않는지. */
const storage = await ev(`(async()=>{
  const app = document.getElementById('app');
  const pool = GACHA.pool().filter(x=>!x.kind||x.kind==='furn');
  const placedAll = list => list.reduce((a,it)=>{
    const tl = SHOP_TILE[it.id]; let n=0;
    for (let i=0;i<W.grid.length;i++) if (W.grid[i]===tl) n++;
    return a+n; }, 0);
  const run = async list => {
    if (app.classList.contains('decoon')) document.querySelector('.decobtn').click();
    await new Promise(r=>setTimeout(r,350));
    list.forEach(it => { S.shop[it.id] = (shopCount(it.id)|0) + 1; });   // 창고로
    const before = placedAll(list);
    showGachaResult(list);
    const b = [...document.querySelectorAll('.rvbtn')].find(x=>/창고|storage|倉庫/.test(x.textContent));
    const label = b ? b.textContent.trim() : null;
    if (!b) return { label, fail:'단추가 없다' };
    b.click();
    await new Promise(r=>setTimeout(r,450));
    return { label, opened: app.classList.contains('decoon'),
             pane: (document.querySelector('.deco')||{}).dataset && document.querySelector('.deco').dataset.pane,
             put: placedAll(list) - before, gone: !document.querySelector('.gawin') };
  };
  const one = await run([pool[0]]);
  const ten = await run(pool.slice(1, 11));
  return { one, ten };
})()`);
ok('1연 — 창고에서 확인하기가 배치 창을 연다',
    /창고/.test(storage.one.label || '') && storage.one.opened && storage.one.pane === 'shop'
      && storage.one.put === 0 && storage.one.gone,
    `「${storage.one.label}」 · 열림 ${storage.one.opened} · 칸 ${storage.one.pane} · 방에 놓은 수 ${storage.one.put}`);
ok('10연 — 같은 단추가 같은 일을 한다',
    /창고/.test(storage.ten.label || '') && storage.ten.opened && storage.ten.pane === 'shop'
      && storage.ten.put === 0,
    `「${storage.ten.label}」 · 열림 ${storage.ten.opened} · 칸 ${storage.ten.pane} · 방에 놓은 수 ${storage.ten.put}`);
await ev(`(()=>{ const app=document.getElementById('app');
  if (app.classList.contains('decoon')) document.querySelector('.decobtn').click();
  if (typeof EDIT!=='undefined' && EDIT.on) toggleEdit(false); return 1 })()`);
await sleep(400);

/* 2 — 작은 소품. **평소 사무실**에서 놓인다: 절차 생성이 꾸며 놓은 방 + 위에서 놓은 가구.
   불만은 「배치할 곳이 없다고 뜬다」였고, 그 방은 꽉 찬 방이 아니라 평소 방이었다.
   (통로만 남을 만큼 채운 방에서 못 놓는 건 규칙대로다 — 길을 막는 자리는 거부한다.) */
const small = await ev(`(()=>{
  const free0 = W.grid.filter(v => v === TILE.FLOOR).length;
  const cand = !!addFurniture(TILE.CANDLE);
  const pen  = !!addFurniture(TILE.PENHOLDER);
  const lamp = !!addFurniture(TILE.LANTERN);
  /* 몇 개까지 들어가나 — 통과 조건은 아니고 눈금이다 */
  let more = 0;
  for (let i = 0; i < 12; i++) if (addFurniture(TILE.CANDLE)) more++; else break;
  return { free0, cand, pen, lamp, more,
           free1: W.grid.filter(v => v === TILE.FLOOR).length };
})()`);
ok('소품이 사무실에 놓인다', small.cand && small.pen && small.lamp,
    `빈 바닥 ${small.free0}칸 · 초 ${small.cand} · 펜홀더 ${small.pen} · 랜턴 ${small.lamp}`
    + ` · 더 넣으면 ${small.more}개까지 (남은 ${small.free1}칸)`);

/* 3 — 견본책 전에는 그 칸들이 안 보인다 */
const tabs = await ev(`(()=>{
  delete S.shop['binder'];
  const btn = document.querySelector('.decobtn') || document.querySelector('#btnEdit');
  if (btn) btn.click();
  const rail = [...document.querySelectorAll('.decorail [data-tab]')];
  /* **화면에서** 사라졌는지 본다. hidden 속성만 보면 통과하는데 CSS 의 display 가
     [hidden] 을 이겨서 실제로는 보이고 있었다 — 그렇게 한 번 속았다. */
  const shown = rail.filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.tab);
  const lock = !!document.querySelector('.decolock');
  return { rail: rail.map(b=>b.dataset.tab), shown, lock };
})()`);
ok('견본책 전에는 가구 칸만 보인다',
    tabs.shown.length === 1 && tabs.shown[0] === 'shop' && !tabs.lock,
    `보이는 칸 ${tabs.shown.join(',')} / 전체 ${tabs.rail.join(',')} · 안내줄 ${tabs.lock}`);

/* 4 — 미리보기 단추가 시트 바로 위.
   시트는 올라오는 애니메이션(.26s)이 있으므로 **끝난 뒤에 잰다** — 중간에 재면
   시트가 아직 화면 밖에 있어서 「틈 326px」 같은 값이 나온다(그렇게 한 번 헷갈렸다). */
/* 시트가 **열려 있는지** 먼저 못 박는다 — 앞의 검사가 토글을 건드렸을 수 있다.
   닫힌 시트를 재면 화면 밖 좌표가 나와서 「틈 855px」 같은 값이 된다. */
await ev(`(()=>{ const app=document.getElementById('app');
  if (!app.classList.contains('decoon')){ const b=document.querySelector('.decobtn'); if (b) b.click(); }
  return app.classList.contains('decoon'); })()`);
await sleep(600);
/* 단추 자리는 hudFollow 가 120ms 마다 다시 잡는다(시트 높이가 바뀌므로).
   한 번만 재면 그 사이의 값을 잡을 수 있어서, 한 박자 더 기다린 뒤 잰다. */
await sleep(400);
const peek = await ev(`(()=>{
  const sheet = document.querySelector('.deco'), btn = document.querySelector('.peekbtn');
  if (!sheet || !btn) return { fail:'시트나 단추가 없다' };
  const sb = sheet.getBoundingClientRect(), bb = btn.getBoundingClientRect();
  const app = document.getElementById('app');
  return { gap: Math.round(sb.top - bb.bottom), sheetTop: Math.round(sb.top),
           btnBottom: Math.round(bb.bottom), h: Math.round(sb.height),
           decoh: app.style.getPropertyValue('--decoh'),
           bottom: getComputedStyle(btn).bottom,
           left: Math.round(bb.left),
           decoon: app.classList.contains('decoon'), show: btn.classList.contains('show') };
})()`);
ok('미리보기가 시트 바로 위 왼쪽에 붙는다', peek.gap >= 0 && peek.gap <= 24 && peek.left <= 24,
    `틈 ${peek.gap}px · 왼쪽에서 ${peek.left}px · 시트 ${peek.h}`);

/* 5 — 등급이 안 열린 가구도 가졌으면 보인다 */
const locked = await ev(`(()=>{
  const hi = SHOP.filter(it => it.furn && it.furn !== 'wall' && it.tier > S.tier)[0];
  if (!hi) return { skip:true };
  S.shop[hi.id] = 1;
  const inShop = (() => { const prev = uiTab; uiTab='shop'; renderRight();
    const has = !!document.querySelector('#rightBody [data-id="'+hi.id+'"]');
    uiTab = prev; renderRight(); return has; })();
  return { id: hi.id, tier: hi.tier, mine: S.tier, inShop };
})()`);
/* 6 — 창고 칸은 평소에 조용하다: 테두리도 숫자도 고른 칸에만 */
const quiet = await ev(`(()=>{
  const tiles = [...document.querySelectorAll('.decobody .shoptile')];
  const dots = tiles.filter(el => {
    const d = el.querySelector('.storedot');
    return d && getComputedStyle(d).display !== 'none';
  }).length;
  const ring = tiles.filter(el => /0px 0px 0px 2px inset/.test(getComputedStyle(el).boxShadow)).length;
  /* 하나 고르면 그 칸만 옷을 입는다 */
  const first = tiles.find(el => el.classList.contains('stored')) || tiles[0];
  if (first) first.click();
  return { tiles: tiles.length, dots, ring };
})()`);
ok('창고 칸은 고른 것만 표시된다', quiet.tiles > 0 && quiet.dots === 0 && quiet.ring === 0,
    `칸 ${quiet.tiles}개 · 숫자 ${quiet.dots} · 테두리 ${quiet.ring}`);
await sleep(200);
const picked = await ev(`(()=>{
  const sel = document.querySelector('.decobody .shoptile.sel');
  if (!sel) return { fail:'고른 칸이 없다' };
  const d = sel.querySelector('.storedot');
  return { dot: !!d && getComputedStyle(d).display !== 'none',
           ring: /0px 0px 0px 2px inset/.test(getComputedStyle(sel).boxShadow),
           stored: sel.classList.contains('stored') };
})()`);
/* 고르기는 **토글**이다 — 같은 칸을 다시 누르면 선택이 풀린다.
   풀 길이 없으면 주황 테두리가 화면에 계속 남는다. */
const toggle = await ev(`(()=>{
  /* **다시 그린 뒤에는 요소가 새것이다**(decoRender 가 innerHTML 을 갈아 끼운다).
     잡아 둔 참조를 다시 누르면 떨어져 나간 노드를 누르는 것이라 아무 일도 안 난다. */
  const pick = () => document.querySelector('.decobody .shoptile');
  const id = pick() && pick().dataset.id;
  if (!id) return { fail:'칸이 없다' };
  /* 앞 검사가 골라 놓았을 수 있으므로 **선택을 비우고** 시작한다 */
  const cur = document.querySelector('.decobody .shoptile.sel');
  if (cur) cur.click();
  const byId = () => document.querySelector('.decobody [data-id=\"' + id + '\"]');
  byId().click();
  const on = !!document.querySelector('.decobody .shoptile.sel');
  byId().click();
  const off = !document.querySelector('.decobody .shoptile.sel');
  const bar = document.querySelector('.decopick');
  return { on, off, barGone: !(bar && bar.classList.contains('show')) };
})()`);
ok('같은 칸을 다시 누르면 선택이 풀린다', toggle.on && toggle.off && toggle.barGone,
    `골랐을 때 ${toggle.on} · 다시 누르면 ${toggle.off} · 고른 줄도 접힘 ${toggle.barGone}`);

ok('고른 칸에는 표시가 뜬다', !picked.fail && picked.ring && (!picked.stored || picked.dot),
    `테두리 ${picked.ring} · 숫자 ${picked.dot} · 창고칸 ${picked.stored}`);

ok('안 열린 등급도 가졌으면 목록에 보인다', locked.skip || locked.inShop,
    locked.skip ? '더 높은 등급 가구가 없다' : `${locked.id} (등급 ${locked.tier} > 내 ${locked.mine}) · 목록 ${locked.inShop}`);

/* 8 — 배치 모드의 「길막」 판정.

   가둔 방을 만들어 시험하려다 한 번 헛짚었다: 화분 넷으로 더하기 모양을 만들면
   그게 **통로를 끊는다.** 그러면 모든 이동이 거부되는 게 맞고, 고친 규칙과 무관하다.
   그래서 규칙 자체와 **평소 방에서의 결과**를 본다.
     (a) 진입로가 필요한 물건은 「쓰는 것」뿐인가
     (b) 평소 방에서 이웃 칸으로 옮기는 것이 되는가 (예전에는 방 하나가 잠기면 전부 막혔다)
     (c) 쓰는 설비를 가두는 이동은 여전히 거부되는가 (아래)
     (d) 바닥을 끊는 이동은 여전히 거부되는가 (아래) */
const rule = await ev(`(()=>({
  장식: [TILE.BOX, TILE.PLANT_S, TILE.CANDLE, TILE.LOCKER].map(editNeedsAccess),
  쓰는것: [TILE.COFFEE, TILE.LITTER, TILE.INBOX].map(editNeedsAccess),
}))()`);
ok('진입로는 「쓰는 물건」만 요구한다',
    rule.장식.every(v => v === false) && rule.쓰는것.every(v => v === true),
    `장식 ${rule.장식.join(',')} · 쓰는것 ${rule.쓰는것.join(',')}`);

const moves = await ev(`(()=>{
  /* **정해진 방**에서 잰다. 앞의 검사들이 창고를 채워 놓으므로 그대로 다시 생성하면
     가구 수가 매번 달라지고, 통과율이 규칙이 아니라 방 사정을 말하게 된다
     (실측으로 86% · 80% · 60% 로 흔들렸다). 씨앗과 가진 목록을 고정해서 생성하고,
     끝나면 원래대로 돌려 놓는다. */
  const shop0 = S.shop, seed0 = S.seed;
  S.shop = {}; S.seed = 20260903;
  buildWorld(true);
  const WW = W.W, HH = W.H, at = (x,y) => y*WW + x;
  let tried = 0, okk = 0, blocked = 0, bad = 0;
  for (let y=1;y<HH-1;y++) for (let x=1;x<WW-1;x++){
    const tt = W.grid[at(x,y)];
    if (tt===TILE.FLOOR||tt===TILE.WALL||tt===TILE.DOOR||tt===TILE.FILLER) continue;
    if (tt===TILE.DESK||tt===TILE.DESK_R) continue;
    const u = unitAt(x,y);
    if (!u || u.span > 1) continue;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x+dx, ny = y+dy;
      if (W.grid[at(nx,ny)] !== TILE.FLOOR) continue;
      tried++;
      const r = editTryMove(u, nx, ny);
      if (r === 'block') blocked++; else if (r === 'bad') bad++; else okk++;
    }
  }
  S.shop = shop0; S.seed = seed0; buildWorld(true);
  return { tried, okk, blocked, bad, 방: WW + 'x' + HH };
})()`);
/* 갓 생성한 방에서는 **대부분 되어야** 한다. 고치기 전에는 통과 17 / 길막 6 이었고
   그 6 중 5 가 「아무도 못 들어가는 빈 칸이 생긴다」였다. 지금은 19 / 3 이고
   막히는 셋은 문 앞·책상 자리·설비 가둠 — 전부 막아야 하는 것들이다. */
ok('갓 생성한 방에서는 대부분 옮겨진다',
    moves.tried > 0 && moves.okk >= moves.tried * 0.7,
    `${moves.방} 기본 사무실 · 한 칸 이동 ${moves.tried}번 · 됨 ${moves.okk} · 길막 ${moves.blocked}`);

const guard = await ev(`(()=>{
  const WW = W.W, HH = W.H, at = (x,y) => y*WW + x;
  /* 쓰는 설비를 찾는다 — 없으면 하나 놓는다 */
  let f = null;
  for (let y=1;y<HH-1 && !f;y++) for (let x=1;x<WW-1;x++){
    const tt = W.grid[at(x,y)];
    if (TILE_INFO[tt] && TILE_INFO[tt].use){ f = {x,y,tile:tt}; break; }
  }
  if (!f && addFurniture(TILE.COFFEE)){
    for (let y=1;y<HH-1 && !f;y++) for (let x=1;x<WW-1;x++)
      if (W.grid[at(x,y)] === TILE.COFFEE){ f = {x,y,tile:TILE.COFFEE}; break; }
  }
  if (!f) return { skip:true };
  /* 그 설비의 **마지막 열린 이웃**을 막아 본다 */
  const nb = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({x:f.x+dx, y:f.y+dy}))
    .filter(p => W.grid[at(p.x,p.y)] === TILE.FLOOR);
  if (nb.length !== 1) return { skip:true, nb: nb.length };
  /* 옮길 가구 하나를 골라 그 칸으로 */
  let verdict = null;
  for (let y=1;y<HH-1 && !verdict;y++) for (let x=1;x<WW-1;x++){
    const tt = W.grid[at(x,y)];
    if (tt===TILE.FLOOR||tt===TILE.WALL||tt===TILE.DOOR||tt===TILE.FILLER) continue;
    if (tt===TILE.DESK||tt===TILE.DESK_R||(x===f.x&&y===f.y)) continue;
    const u = unitAt(x,y);
    if (!u || u.span > 1) continue;
    const r = editTryMove(u, nb[0].x, nb[0].y);
    verdict = (r === 'block') ? 'block' : (r === 'bad' ? 'bad' : 'ok');
    break;
  }
  return { verdict, use: !!(TILE_INFO[f.tile]||{}).use };
})()`);
ok('쓰는 설비를 가두는 이동은 거부된다', guard.skip || guard.verdict !== 'ok',
    guard.skip ? `건너뜀 (열린 이웃 ${guard.nb})` : `판정 ${guard.verdict}`);

ok('콘솔 오류 없음', errs.length===0, errs.slice(0,2).join(' | ')||'0');
ws.close();chrome.kill();
for(const r of rows)console.log(`  ${r.pass?'OK ':'X  '} ${r.name.padEnd(28)} ${r.note||''}`);
console.log(`\n  ${rows.filter(r=>r.pass).length}/${rows.length}`);
process.exit(0);
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
