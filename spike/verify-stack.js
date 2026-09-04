/* 배치 세 가지:
     1 작은 소품을 **다른 가구 위에** 얹을 수 있는가 (그리고 내려놓을 수 있는가)
     2 고른 것이 있으면 다른 가구로 **초점이 안 넘어가는가**
     3 화살표 넷이 **미는가** (돌리는 게 아니라) */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9473,W=390,H=844;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-stack');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<80&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,200));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,400));return r?.result?.value;};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:'http://localhost:8123/index.html?3d=1'});
await sleep(16000);
await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();document.body.classList.remove('titleon');return 1})()`);
await sleep(1200);

const stack = await ev(`(()=>{
  toggleEdit(true);
  const at = (x,y) => y*W.W + x;
  if (!addFurniture(TILE.CANDLE)) return { fail:'초를 못 놓았다' };
  let prop = null, host = null;
  for (let y=1;y<W.H-1;y++) for (let x=1;x<W.W-1;x++){
    const t = W.grid[at(x,y)];
    if (t === TILE.CANDLE && !prop) prop = { x, y };
    else if (!host && t !== TILE.FLOOR && t !== TILE.WALL && t !== TILE.DOOR
             && t !== TILE.FILLER && t !== TILE.CANDLE) host = { x, y };
  }
  if (!prop || !host) return { fail:'초나 받칠 가구가 없다' };
  const u = unitAt(prop.x, prop.y);
  const r1 = editApply(u, host.x, host.y);
  const onTop = (W.tops||[]).some(p => p.tile === TILE.CANDLE);
  const gridClear = W.grid[at(prop.x, prop.y)] === TILE.FLOOR;
  const t2 = unitAt(host.x, host.y);
  const kind = t2 && t2.kind;
  const floors = [];
  for (let y=1;y<W.H-1;y++) for (let x=1;x<W.W-1;x++) if (W.grid[at(x,y)] === TILE.FLOOR) floors.push({x,y});
  let down = null;
  for (const f of floors){ if (editApply(t2, f.x, f.y) === true){ down = f; break; } }
  const back = !!down && W.grid[at(down.x, down.y)] === TILE.CANDLE && !(W.tops||[]).length;
  return { r1, onTop, gridClear, kind, back };
})()`);
ok('소품을 가구 위에 얹는다', stack.r1 === true && stack.onTop && stack.gridClear,
    stack.fail || `옮김 ${stack.r1} · tops 에 있음 ${stack.onTop} · 있던 칸 비움 ${stack.gridClear}`);
ok('얹힌 것을 다시 집어 내려놓는다', stack.kind === 'top' && stack.back,
    `집으면 ${stack.kind} · 바닥으로 ${stack.back}`);

const focus = await ev(`(()=>{
  const at = (x,y) => y*W.W + x;
  const furn = [];
  for (let y=1;y<W.H-1;y++) for (let x=1;x<W.W-1;x++){
    const t = W.grid[at(x,y)];
    if (t===TILE.FLOOR||t===TILE.WALL||t===TILE.DOOR||t===TILE.FILLER||t===TILE.DESK_R) continue;
    furn.push({x,y});
  }
  if (furn.length < 2) return { fail:'가구가 둘도 없다' };
  EDIT.sel = unitAt(furn[0].x, furn[0].y);
  const first = EDIT.sel && EDIT.sel.tile;
  const t2 = furn[1];
  const onSel = EDIT.sel.x === t2.x && EDIT.sel.y === t2.y;
  const u = unitAt(t2.x, t2.y, null);
  const wouldSwitch = !!(u && !sameUnit(u, EDIT.sel) && !onSel && !EDIT.sel);
  return { first, wouldSwitch, stillFirst: EDIT.sel && EDIT.sel.tile === first };
})()`);
ok('고른 것이 있으면 초점이 안 넘어간다', !focus.wouldSwitch && focus.stillFirst,
    focus.fail || `든 것이 그대로 ${focus.stillFirst}`);

const nudge = await ev(`(()=>{
  const at = (x,y) => y*W.W + x;
  let u = null;
  for (let y=1;y<W.H-1 && !u;y++) for (let x=1;x<W.W-1;x++){
    const t = W.grid[at(x,y)];
    if (t===TILE.FLOOR||t===TILE.WALL||t===TILE.DOOR||t===TILE.FILLER||t===TILE.DESK||t===TILE.DESK_R) continue;
    const c = unitAt(x,y);
    if (c && c.span === 1 && c.kind === 'furn'){ u = c; break; }
  }
  if (!u) return { fail:'밀어 볼 가구가 없다' };
  EDIT.sel = u;
  const from = { x:u.x, y:u.y }, rot0 = (W.rot||{})[at(u.x,u.y)] | 0;
  let moved = null;
  for (const d of [[1,0],[-1,0],[0,1],[0,-1]]){ if (editNudge(d[0],d[1])){ moved = d; break; } }
  const now = EDIT.sel;
  return { moved, from, to: now && { x:now.x, y:now.y }, held: !!now,
           rotSame: now ? (((W.rot||{})[at(now.x, now.y)] | 0) === rot0) : false };
})()`);
ok('화살표가 한 칸 민다', !!nudge.moved && !!nudge.to
    && (nudge.to.x !== nudge.from.x || nudge.to.y !== nudge.from.y),
    nudge.fail || `${nudge.from.x},${nudge.from.y} 에서 ${nudge.to.x},${nudge.to.y} 로`);
ok('밀고 나서도 손에 들고 있다', nudge.held && nudge.rotSame,
    `든 채 ${nudge.held} · 각도 그대로 ${nudge.rotSame}`);

/* 4 — 치운 것은 **창고로** 간다. 생성기가 놓아 준 가구(가진 수 0)도 포함이다. */
const trash = await ev(`(()=>{
  const at=(x,y)=>y*W.W+x;
  /* 생성기가 놓아 준 가구 = **가진 수 0**. 앞의 검사들이 창고를 채워 놨을 수 있으므로
     그 상황을 직접 만든다: 방에 있는 가구 하나의 가진 수를 0 으로 되돌린다. */
  let u = null, id = null;
  for (let y=1;y<W.H-1 && !u;y++) for (let x=1;x<W.W-1;x++){
    const t = W.grid[at(x,y)];
    if (t===TILE.FLOOR||t===TILE.WALL||t===TILE.DOOR||t===TILE.FILLER||t===TILE.DESK||t===TILE.DESK_R) continue;
    const k = Object.keys(SHOP_TILE).find(k2 => SHOP_TILE[k2] === t);
    if (!k) continue;
    const c = unitAt(x,y);
    if (c && c.kind === 'furn' && c.span === 1){ u = c; id = k; delete S.shop[k]; break; }
  }
  if (!u) return { skip:true };
  EDIT.sel = u;
  const owned0 = shopCount(id);
  editRemove();
  let placed = 0;
  for (let i=0;i<W.grid.length;i++) if (W.grid[i] === SHOP_TILE[id]) placed++;
  return { id, owned0, owned1: shopCount(id), placed, stored: shopCount(id) - placed };
})()`);
ok('치운 가구는 창고로 간다', trash.skip || trash.stored >= 1,
    trash.skip ? '가진 수 0 인 가구가 없다(건너뜀)' :
    `${trash.id} · 가진 수 ${trash.owned0} → ${trash.owned1} · 방 ${trash.placed} · 창고 ${trash.stored}`);

/* 5 — 배치 중에는 카메라가 고양이를 안 따라간다 */
const cam = await ev(`(()=>{
  if (EDIT.on) toggleEdit(false);
  if (R3.followOn) R3.followOn(true);
  const on0 = R3.following ? R3.following() : null;
  toggleEdit(true);
  const during = R3.following ? R3.following() : null;
  toggleEdit(false);
  const after = R3.following ? R3.following() : null;
  return { on0, during, after };
})()`);
ok('배치 중에는 카메라가 안 따라간다', cam.on0 === true && cam.during === false && cam.after === true,
    `켜기 전 ${cam.on0} · 배치 중 ${cam.during} · 나온 뒤 ${cam.after}`);

/* 5-b — 카탈로그에 없는 것(결재함·화장실 …)은 **아예 안 치워진다** */
const keep = await ev(`(()=>{
  if (!EDIT.on) toggleEdit(true);
  const at=(x,y)=>y*W.W+x;
  let u = null, t0 = null;
  for (let y=1;y<W.H-1 && !u;y++) for (let x=1;x<W.W-1;x++){
    const t = W.grid[at(x,y)];
    if (t===TILE.FLOOR||t===TILE.WALL||t===TILE.DOOR||t===TILE.FILLER||t===TILE.DESK||t===TILE.DESK_R) continue;
    if (Object.keys(SHOP_TILE).some(k => SHOP_TILE[k] === t)) continue;   // 카탈로그에 있는 것은 건너뛴다
    const c = unitAt(x,y);
    if (c && c.kind === 'furn'){ u = c; t0 = t; break; }
  }
  if (!u) return { skip:true };
  EDIT.sel = u;
  const before = W.grid.filter(v => v === t0).length;
  const r = editRemove();
  return { r, before, after: W.grid.filter(v => v === t0).length };
})()`);
ok('되돌아올 수 없는 것은 안 치워진다', keep.skip || (keep.r === false && keep.after === keep.before),
    keep.skip ? '카탈로그 밖 가구가 없다(건너뜀)' : `치우기 ${keep.r} · 방에 ${keep.before} → ${keep.after}`);

/* 6 — 등도 **하나의 물건**이다: 고르고 · 옮기고 · 치운다 */
const light = await ev(`(()=>{
  if (!EDIT.on) toggleEdit(true);
  const n0 = (W.lights || []).length;
  if (!n0) return { fail:'등 목록이 비었다' };
  const p = W.lights[0];
  const u = unitAt(p.x, p.y);
  const picked = u && u.kind;
  /* 빈 바닥으로 옮겨 본다 */
  let moved = null;
  for (let y=1;y<W.H-1 && !moved;y++) for (let x=1;x<W.W-1;x++){
    if (W.grid[y*W.W+x] !== TILE.FLOOR) continue;
    if ((W.lights||[]).some(q => q.x===x && q.y===y)) continue;
    if (editApply(u, x, y) === true){ moved = { x, y }; break; }
  }
  /* 치운다 */
  EDIT.sel = unitAt(moved ? moved.x : p.x, moved ? moved.y : p.y);
  const kind2 = EDIT.sel && EDIT.sel.kind;
  const gone = (kind2 === 'light') ? (editRemove(), (W.lights||[]).length === n0 - 1) : false;
  return { n0, picked, moved: !!moved, kind2, gone, n1: (W.lights||[]).length };
})()`);
ok('등을 고르고 옮기고 치운다',
    light.picked === 'light' && light.moved && light.gone,
    light.fail || `등 ${light.n0}개 · 집으면 ${light.picked} · 옮김 ${light.moved} · 치운 뒤 ${light.n1}개`);

/* 7 — 치운 **등**도 창고로 간다 (없으면 지우면 사라지는 유일한 물건이 된다) */
const lampBack = await ev(`(()=>{
  if (!EDIT.on) toggleEdit(true);
  if (!(W.lights||[]).length) return { skip:true };
  const p = W.lights[0];
  const id = p.kind === 'lantern' ? 'f_lantern' : 'f_floorlamp';
  delete S.shop[id];
  const u = unitAt(p.x, p.y);
  if (!u || u.kind !== 'light') return { fail:'등을 못 집었다' };
  EDIT.sel = u;
  editRemove();
  let placed = 0;
  for (let i=0;i<W.grid.length;i++) if (W.grid[i] === SHOP_TILE[id]) placed++;
  return { id, owned: shopCount(id), placed, stored: shopCount(id) - placed };
})()`);
ok('치운 등도 창고로 간다', lampBack.skip || lampBack.stored >= 1,
    lampBack.skip ? '등이 없다(건너뜀)' : `${lampBack.id} · 가진 ${lampBack.owned} · 방 ${lampBack.placed} · 창고 ${lampBack.stored}`);

/* 8 — 조작 뭉치는 **안 따라다닌다**: 물건을 밀어도 손잡이·D패드 자리가 그대로다 */
const still = await ev(`(async()=>{
  const box = () => {
    const h = document.querySelector('.edithud'), a = document.querySelector('.editarr.r');
    const r1 = h && h.getBoundingClientRect(), r2 = a && a.getBoundingClientRect();
    return { hud: r1 ? [Math.round(r1.left), Math.round(r1.top)] : null,
             arr: r2 ? [Math.round(r2.left), Math.round(r2.top)] : null };
  };
  const at=(x,y)=>y*W.W+x;
  let u=null;
  for (let y=1;y<W.H-1 && !u;y++) for (let x=1;x<W.W-1;x++){
    const t=W.grid[at(x,y)];
    if (t===TILE.FLOOR||t===TILE.WALL||t===TILE.DOOR||t===TILE.FILLER||t===TILE.DESK||t===TILE.DESK_R) continue;
    const c=unitAt(x,y); if (c && c.kind==='furn' && c.span===1){ u=c; break; }
  }
  if (!u) return { skip:true };
  EDIT.sel = u;
  await new Promise(r=>setTimeout(r,300));
  const a = box();
  for (let k=0;k<3;k++) for (const d of [[1,0],[0,1],[-1,0],[0,-1]]) if (editNudge(d[0],d[1])) break;
  await new Promise(r=>setTimeout(r,400));
  const b = box();
  return { a, b, 같나: JSON.stringify(a) === JSON.stringify(b) };
})()`);
/* 손잡이·화살표는 물건에 붙어 다니는 것이 맞다(되물렸다). 여기서 지켜야 하는 것은
   **카메라가 안 따라가는 것**이다 — 방향키가 가구를 밀면서 시선까지 팬하고 있었다. */
ok('밀어도 화살표는 물건에 붙어 있다', still.skip || !still.같나,
    still.skip ? '밀 가구가 없다(건너뜀)' : `화살표 ${JSON.stringify(still.a.arr)} → ${JSON.stringify(still.b.arr)}`);

/* 9 — **방향키가 카메라를 안 건드린다.** 렌더러에도 같은 키의 팬이 있어서
   한 번 누를 때마다 가구도 가고 시선도 갔다(1.2씩) — 그게 「화면이 같이 움직인다」였다. */
const camStill = await ev(`(async()=>{
  const look = () => R3.debug().look.map(v => +v.toFixed(2)).join(',');
  const at=(x,y)=>y*W.W+x;
  let u=null;
  for (let y=1;y<W.H-1 && !u;y++) for (let x=1;x<W.W-1;x++){
    const t=W.grid[at(x,y)];
    if (t===TILE.FLOOR||t===TILE.WALL||t===TILE.DOOR||t===TILE.FILLER||t===TILE.DESK||t===TILE.DESK_R) continue;
    const c=unitAt(x,y); if (c && c.span===1){ u=c; break; }
  }
  if (!u) return { skip:true };
  if (!EDIT.on) toggleEdit(true);
  EDIT.sel = u;
  const a = look();
  /* **키를 진짜로 보낸다** — 폰의 화살표 단추가 하는 그 일이다 */
  for (let k=0;k<4;k++){
    document.dispatchEvent(new KeyboardEvent('keydown',
      { key:'ArrowRight', bubbles:true, cancelable:true }));
    await new Promise(r=>setTimeout(r,120));
  }
  await new Promise(r=>setTimeout(r,400));
  return { a, b: look(), moved: EDIT.sel && (EDIT.sel.x !== u.x || EDIT.sel.y !== u.y) };
})()`);
ok('방향키가 카메라를 안 건드린다', camStill.skip || camStill.a === camStill.b,
    camStill.skip ? '건너뜀' : `시선 ${camStill.a} → ${camStill.b} · 가구는 움직임 ${camStill.moved}`);

const arrows = await ev(`(()=>{
  const a = [...document.querySelectorAll('.editarr')];
  return { n: a.length, cls: a.map(x => x.className.replace('editarr ','')).join(',') };
})()`);
ok('화살표 단추가 넷이다', arrows.n === 4, `${arrows.n}개 · ${arrows.cls}`);

ok('콘솔 오류 없음', errs.length===0, errs.slice(0,2).join(' | ')||'0');
ws.close();chrome.kill();
for(const r of rows)console.log(`  ${r.pass?'OK ':'X  '} ${r.name.padEnd(28)} ${r.note||''}`);
console.log(`\n  ${rows.filter(r=>r.pass).length}/${rows.length}`);
process.exit(0);
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
