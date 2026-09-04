/* 택배 흐름 한 벌: 뜯기 → 뜯는 장면 → 결과. 그림이 맞는지는 shot-parcel.js 가 보고,
   여기서는 **흐름과 뼈대**를 본다 — 무엇이 뜨고, 단추가 무슨 일을 하는지. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9449,W=390,H=844;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-vparcel');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
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
await sleep(15000);
await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();document.body.classList.remove('titleon');return 1})()`);
await sleep(1500);

/* 1. 택배 화면에서 **진짜로** 뜯는다.
   잔액은 서버가 들고 있을 수 있으므로(gaOn) 내가 정해 넣지 않는다 — 그 자리에서
   눌리는 단추를 누른다. 눌 수 있는 것이 없으면 그건 이 검사가 볼 것이 아니다. */
const flow = await ev(`(async()=>{
  showGacha();
  const btns = [...document.querySelectorAll('[data-pull]')].filter(b=>!b.disabled);
  const free = document.querySelector('#gaFree');
  const btn = btns[btns.length-1] || (free && !free.disabled ? free : null);
  if (!btn) return { fail:'뜯을 수 있는 단추가 없다', tix: gaTix(), on: gaOn() };
  const want = +btn.dataset.pull || 1;
  btn.click();
  await new Promise(r=>setTimeout(r,1400));            // 서버가 굴린다 — 기다림이 있다
  const open = !!document.querySelector('.gaopen');
  if (!open) return { fail:'장면이 안 떴다', tix: gaTix(), on: gaOn() };
  const three = !!document.querySelector('.gaopen--3d') && !!(R3.parcelOn && R3.parcelOn());
  const say  = (document.querySelector('.gaosay')||{}).textContent || '';
  const dots = document.querySelectorAll('.gaodots i').length;
  const skip = !!document.querySelector('.gaoskip');
  document.querySelector('.gaopen').click();            // 건너뛴다
  await new Promise(r=>setTimeout(r,300));
  const win = document.querySelector('.gawin');
  return { want, open, three, say: say.trim().slice(0,40),
           dots, skip, win: !!win, stopped: !(R3.parcelOn && R3.parcelOn()),
           stage: !!document.querySelector('.rvstage'),
           cards: document.querySelectorAll('.rvcard').length,
           ribbon: (document.querySelector('.rvribbon')||{}).textContent || '',
           btns: [...document.querySelectorAll('.rvbtn')].map(b=>b.textContent.trim()) };
})()`);
if (flow.fail){ console.log('  진단:', JSON.stringify(flow)); }
ok('뜯기를 누르면 장면이 뜬다', flow.open, `${flow.want}상자 · .gaopen ${flow.open}`);
ok('3D 로 찍는다', flow.three, '.gaopen--3d · R3.parcelOn ' + flow.three);
ok('누가 뜯는지 말한다', /상자를 열고 있어요/.test(flow.say), flow.say);
ok('상자 개수만큼 점', flow.dots === (flow.want > 1 ? flow.want : 0), `${flow.dots}개 (뜯은 것 ${flow.want})`);
ok('건너뛰기가 있다', flow.skip, String(flow.skip));
ok('끝나면 카메라를 돌려준다', flow.stopped, '컷신 꺼짐 ' + flow.stopped);
ok('건너뛰면 결과로 간다', flow.win, `무대 ${flow.stage} · 격자칸 ${flow.cards}`);
ok('띠 제목이 걸린다', /개봉|결과/.test(flow.ribbon), flow.ribbon);
await ev(`(()=>{const r=document.querySelector('.gawin');if(r)r.remove();const v=document.querySelector('.veil');if(v)v.remove();return 1})()`);

/* 1-b. 여럿일 때는 격자다 — 열 상자는 잔액이 있어야 눌리므로 결과 화면만 따로 세운다 */
const many = await ev(`(()=>{
  const p = GACHA.pool();
  const f = p.filter(x=>!x.kind||x.kind==='furn').slice(0,8);
  showGachaResult(f.concat([p.find(x=>x.kind==='fish'), p.find(x=>x.kind==='brick')]));
  return { cards: document.querySelectorAll('.rvcard').length,
           stage: !!document.querySelector('.rvstage'),
           caps: document.querySelectorAll('.rvcard .cap').length,
           btns: [...document.querySelectorAll('.rvbtn')].map(b=>b.textContent.trim()) };
})()`);
ok('여럿이면 격자에 담는다', many.cards === 10 && !many.stage, `칸 ${many.cards}개`);
ok('그림 없는 칸엔 설명 한 줄', many.caps === 2, `${many.caps}줄 (멸치·벽돌)`);
ok('단추는 둘', many.btns.length === 2, many.btns.join(' · '));

/* 2. 「창고에서 확인하기」가 배치 창을 연다.
   (한때 「사무실에 배치」였고 아무 데나 놓았다 — 뽑은 것은 창고로 가고 놓는 자리는
    사람이 고른다가 이 게임의 규칙이라 되물렸다. 문구가 바뀌면 이 검사도 같이 바뀐다.) */
const place = await ev(`(async()=>{
  const b = [...document.querySelectorAll('.rvbtn')].find(x=>/창고|storage|倉庫/.test(x.textContent));
  if (!b) return { fail:'창고 단추가 없다',
                   단추: [...document.querySelectorAll('.rvbtn')].map(x=>x.textContent.trim()) };
  b.click();
  await new Promise(r => setTimeout(r, 450));
  const app = document.getElementById('app');
  return { opened: app.classList.contains('decoon') || (typeof EDIT !== 'undefined' && EDIT.on),
           gone: !document.querySelector('.gawin') };
})()`);
ok('창고 단추가 배치 창을 연다', place.opened && place.gone,
    place.fail ? `${place.fail} — ${(place.단추||[]).join(' · ')}` : `열림 ${place.opened} · 창 닫힘 ${place.gone}`);
await ev(`(()=>{ const app=document.getElementById('app');
  if (app.classList.contains('decoon')){ const d=document.querySelector('.decobtn'); if (d) d.click(); }
  if (typeof EDIT!=='undefined' && EDIT.on) toggleEdit(false); return 1 })()`);
await sleep(400);

/* 3. 하나만 나왔을 때는 무대 */
const one = await ev(`(()=>{
  const it = GACHA.pool().find(x=>!x.kind||x.kind==='furn');
  showGachaResult([it]);
  const r = { stage: !!document.querySelector('.rvstage'), name:(document.querySelector('.rvname')||{}).textContent,
              rows: document.querySelectorAll('.rvrow').length, cards: document.querySelectorAll('.rvcard').length };
  document.querySelector('[data-ok]').click();
  r.closed = !document.querySelector('.gawin');
  return r;
})()`);
ok('하나면 무대에 세운다', one.stage && one.cards === 0, `${one.name} · 격자칸 ${one.cards}`);
ok('무엇이 달라지는지 적는다', one.rows === 3, one.rows + '줄');
ok('확인이 닫는다', one.closed, String(one.closed));

/* 4. 장비가 상자에서 안 나온다 */
const gear = await ev(`(()=>({ pool: GACHA.pool().filter(x=>x.kind==='gear').length, equip: typeof EQUIP }))()`);
ok('장비는 안 나온다', gear.pool === 0 && gear.equip === 'undefined', `gear ${gear.pool} · EQUIP ${gear.equip}`);

/* 5. 장비를 걷어낸 자리가 무너지지 않았나 — 인사 파일은 슬롯 줄과 가방 칸을 들고 있었다 */
const card = await ev(`(()=>{
  const c = S.cats[0]; showCat(c.id);
  const v = document.querySelector('.veil');
  const r = { open: !!v, stats: document.querySelectorAll('.statgrid .st').length,
              slots: document.querySelectorAll('.eslot').length,
              bag: !!document.querySelector('#bagList') };
  if (v) v.remove();
  return r;
})()`);
ok('인사 파일이 그대로 열린다', card.open && card.stats === 6 && !card.slots && !card.bag,
    `능력치 ${card.stats}칸 · 장비칸 ${card.slots} · 가방 ${card.bag}`);

/* 6. 의자가 고양이와 **같이** 물리는가 — 고양이만 물리면 의자 등받이 뒤 허공에 앉는다 */
const chair = await ev(`(()=>{
  R3.parcelBuild(S.cats);
  const i = R3.parcelInfo();
  const after = { ...i };
  R3.parcelStop();
  return { after, back: i.back };
})()`);
ok('의자도 같은 만큼 물린다',
    chair.after.chairZ !== null && Math.abs((chair.after.chairZ - chair.after.chairZ0) - chair.back) < 1e-6,
    `의자 ${chair.after.chairZ0} → ${chair.after.chairZ} (물린 거리 ${chair.back})`);

/* 6 — 뜯는 장면 동안에는 **게임 UI 가 하나도 안 보인다.**
   재는 법에 두 번 속았다: 클래스를 뗀 **뒤에** 읽으면 안 되고, opacity 에 transition 이
   걸려 있으므로 **끝난 뒤에** 읽어야 한다(붙이자마자 읽으면 아직 1 이다). */
const SELS = "['#topbar','.doorrail','.parcelbtn','.photobtn','#colTabs','.stagefoot','.clockchip']";
await ev(`(()=>{ document.body.classList.add('gacut'); return 1 })()`);
await sleep(400);
const hidden = await ev(`(()=>{
  const r = ${SELS}.map(s => { const e = document.querySelector(s);
    return e ? +getComputedStyle(e).opacity : null; });
  document.body.classList.remove('gacut');
  return r; })()`);
await sleep(400);
const back = await ev(`(()=>${SELS}.map(s => { const e = document.querySelector(s);
  return e ? +getComputedStyle(e).opacity : null; }))()`);
ok('컷신 동안 UI 가 전부 걷힌다',
    hidden.every(v => v === null || v === 0) && back.some(v => v === 1),
    `걷힘 ${hidden.join(',')} · 돌아옴 ${back.join(',')}`);

/* 그 옷을 **실제로 입고 벗는지** — 3D 길이 안 서는 기기에서는 건너뛴다 */
const worn = await ev(`(async()=>{
  gaOpening(new Array(3).fill({ kind:'brick' }), () => {});
  await new Promise(r => setTimeout(r, 400));
  const on = document.body.classList.contains('gacut');
  const three = !!document.querySelector('.gaopen--3d');
  const r = document.querySelector('.gaopen'); if (r) r.click();
  await new Promise(x => setTimeout(x, 400));
  return { three, on, off: !document.body.classList.contains('gacut') };
})()`);
ok('컷신이 그 옷을 입고 벗는다', !worn.three || (worn.on && worn.off),
    worn.three ? `켤 때 ${worn.on} · 끌 때 ${worn.off}` : '3D 가 안 서서 건너뜀(플랫 폴백)');

ok('콘솔 오류 없음', errs.length===0, errs.slice(0,2).join(' | ')||'0');
ws.close();chrome.kill();
for(const r of rows)console.log(`  ${r.pass?'OK ':'X  '} ${r.name.padEnd(24)} ${r.note||''}`);
console.log(`\n  ${rows.filter(r=>r.pass).length}/${rows.length}`);
process.exit(0);
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
