/* 한 바퀴 — **새 기기에서 사무실이 따라오는가**. 진짜 서버로 돈다.

   왜 이게 따로 필요한가: 조각은 전부 검사가 있는데(저장·친구·상자), **이어서** 밟아
   본 적이 없었다. 그리고 이 게임에서 사람이 제일 무서워하는 순간은 조각이 아니라
   이음매다 — 폰을 바꿨는데 고양이들이 안 따라오면, 그건 버그가 아니라 **사무실을
   잃은 것**이다.

   기기 둘을 진짜로 띄운다(프로필이 다르면 localStorage 도 다르다 — 그게 「새 폰」이다).

     기기 A   익명 계정 · 며칠 지냄 · 서버에 올림
     기기 B   같은 계정으로 처음 켬 · 서버가 앞선 걸 알아챔 · 되돌리면 따라옴
     기기 B   저장을 비우고 **다른 계정** · 코드로 A 에게 신청 · A 가 수락 · 서로 보임

   ── 실제 데이터베이스에 쓴다 ──
   만든 계정은 끝에 전부 지운다. 남의 서버에 시험 계정을 쌓아 두지 않는다.

     node spike/serve.js      (다른 창에서)
     node spike/verify-journey.js
*/
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const BASE=process.env.COPYCAT_BASE||'http://localhost:8123';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});

/* 기기 하나 = 크롬 하나 = 프로필 하나. 프로필을 나누는 것이 이 검사의 전부다 —
   같은 프로필에서 탭만 나누면 localStorage 를 같이 쓰므로 「새 폰」이 아니다. */
async function device(port, tag){
  const dir=path.join(process.env.TEMP,'cdp-journey-'+tag);
  try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
  const proc=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+port,
    '--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
  let page;
  for(let i=0;i<160&&!page;i++){
    try{page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');}catch{}
    if(!page)await sleep(250);
  }
  /* 안 뜨면 **여기서 말한다.** 밑에서 undefined 를 붙잡고 죽으면 제품이 깨진 것처럼
     보이는데, 실제로는 앞 실행의 크롬이 이 포트를 아직 쥐고 있는 것뿐이다. */
  if(!page){ proc.kill(); throw new Error(`크롬이 ${port} 에서 안 떴다 (기기 ${tag}) — 남은 크롬을 닫고 다시`); }
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const errs=[];
  const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
    if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,160));});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  const ev=async e=>{
    const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
    if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,300));
    return r?.result?.value;
  };
  /* 게임이 뜨고 **로그인이 붙을 때까지** 기다린다. 시계로 재면 느린 판에서 깜빡인다. */
  const boot=async()=>{
    await send('Page.navigate',{url:BASE+'/index.html?3d=1'});
    for(let i=0;i<60;i++){
      await sleep(700);
      /* **둘 다** 기다린다 — 로그인이 붙는 것과 게임이 서는 것은 다른 시각이고,
         로그인만 보고 넘어가면 그다음 줄에서 `S is not defined` 로 죽는다. */
      const st=await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();
        document.body.classList.remove('titleon');
        return window.CLOUD ? {on:CLOUD.state().on, why:CLOUD.state().why, uid:CLOUD.state().uid,
                               ready: typeof S !== 'undefined' && !!S} : null})()`)
        .catch(()=>null);
      if(st&&st.on&&st.ready)return st;
    }
    return await ev(`window.CLOUD?CLOUD.state():null`).catch(()=>null);
  };
  /* 페이지 스크립트보다 **먼저** 도는 자리. 여기에 세션을 심으면 게임이 뜨기 전에
     로그인이 이미 있는 상태가 된다 — 「같은 계정으로 새 폰에서 처음 켠다」가 그것이다.
     한 번 열었다가 심고 다시 여는 방식은 그 사이에 **버려질 익명 계정을 하나 만든다.** */
  const seed=async src=>(await send('Page.addScriptToEvaluateOnNewDocument',{source:src})).identifier;
  const unseed=id=>send('Page.removeScriptToEvaluateOnNewDocument',{identifier:id});
  return {ev,send,boot,seed,unseed,errs,kill:()=>{try{ws.close();}catch(e){}proc.kill();}};
}

/* 포트를 이 실행에 맞춰 고른다 — 앞 실행의 크롬이 아직 안 죽었을 때 같은 포트를
   다시 잡으면, 남의 브라우저에 붙어서 이상한 것을 본다. */
const P0 = 9400 + (process.pid % 120) * 2;

(async()=>{
/* 서버가 떠 있는지 **먼저** 본다. 안 떠 있으면 아래는 전부 「로그인이 안 붙는다」로
   보이는데, 그건 제품 이야기가 아니라 `node spike/serve.js` 를 안 켠 이야기다. */
try {
  const r = await fetch(BASE + '/index.html');
  if (!r.ok) throw new Error('HTTP ' + r.status);
} catch (e) {
  console.log(`
  ${BASE} 가 안 열린다 — 다른 창에서 \`node spike/serve.js\` 를 먼저 켠다.`);
  console.log(`  (${e.message})`);
  process.exit(2);
}

/* ── 기기 A — 여기서 사무실을 키운다 ─────────────────────────────────── */
const A=await device(P0,'a');
const a0=await A.boot();
ok('기기 A 에 계정이 선다', a0&&a0.on, a0?('uid '+String(a0.uid).slice(0,8)+'…'):'못 붙었다');
if(!a0||!a0.on){ console.log('  로그인이 안 붙어 더 못 간다:',JSON.stringify(a0)); A.kill(); process.exit(1); }

/* `CLOUD.push()` 를 한 번 부르고 끝내지 않는다 — 다른 전송이 돌고 있으면 그 부름은
   **조용히 아무것도 안 한다**(cloud.js flush 의 `sending` 빗장). 횟수 대신 서버에
   실제로 42일이 적혔는지를 본다. */
const grown=await A.ev(`(async()=>{
  S.together = S.together || {}; S.together.days = 42;    // 며칠 지낸 사무실
  S.cats[0].name = '증인';                                 // 따라왔는지 볼 표식
  save();
  let landed = 0;
  for (let i = 0; i < 30; i++){
    await CLOUD.push();
    const sb = CLOUD.sb();
    if (sb){
      const { data } = await sb.from('saves')
        .select('days').eq('user_id', CLOUD.state().uid).maybeSingle();
      if (data && (data.days|0) === 42){ landed = data.days|0; break; }
    }
    await new Promise(r=>setTimeout(r,500));
  }
  return { days:S.together.days, cat:S.cats[0].name, cats:S.cats.length,
           code:FRIENDS.code(), landed };
})()`);
ok('A 의 사무실이 서버로 올라간다', grown.landed===42, `서버에 적힌 날 수 ${grown.landed}`);

/* **게시판을 한 번도 안 열었다.** 예전에는 지점 줄이 게시판 안에서만 올라가서, 코드를
   받아 적은 친구가 「없는 코드」를 봤다. 이제 로그인만으로 올라간다(FRIENDS.beat). */
const reg=await A.ev(`(async()=>{
  for(let i=0;i<20;i++){
    const sb = CLOUD.sb();
    if (sb){
      const { data } = await sb.from('branches')
        .select('code,updated_at').eq('user_id', CLOUD.state().uid).maybeSingle();
      if (data) return { code:data.code, at:data.updated_at,
                         board: !!document.querySelector('.bdwrap, #board') };
    }
    await new Promise(r=>setTimeout(r,700));
  }
  return null;
})()`);
ok('**게시판을 안 열어도 지점이 등록된다**', reg && reg.code === grown.code,
   reg ? `코드 ${reg.code}` : '서버에 지점 줄이 없다');

/* 로그인 상태를 통째로 꺼낸다 — 이게 「같은 계정으로 로그인했다」의 실체다. */
const sess=await A.ev(`localStorage.getItem('copycat.auth')`);
ok('로그인 상태를 꺼낼 수 있다', !!sess&&sess.length>50, sess?`${sess.length}자`:'없다');

/* ── 기기 B — 새 폰. 같은 계정으로 처음 켠다 ────────────────────────── */
const B=await device(P0+1,'b');
/* 출처를 한 번 연 뒤에 세션을 심고 다시 연다.

   `Page.addScriptToEvaluateOnNewDocument` 로 미리 심는 편이 깔끔하고 버려지는 계정도
   안 생기지만, **실제로 안 먹었다**(기기 B 가 제 계정을 새로 만들어 버렸다).
   검사가 틀리면 제품이 틀린 것처럼 보이므로, 확실히 되는 쪽을 쓴다. */
await B.send('Page.navigate',{url:BASE+'/index.html'});
/* **시계로 재지 않는다.** about:blank 위에서 localStorage 를 만지면 SecurityError 고,
   그게 얼마나 걸리는지는 기계 사정이다. 그 출처가 실제로 열릴 때까지 기다린다. */
for(let i=0;i<60;i++){
  const here=await B.ev(`location.origin`).catch(()=>null);
  if(here && BASE.startsWith(here)) break;
  await sleep(500);
}
await B.ev(`(()=>{ localStorage.clear();
  localStorage.setItem('copycat.auth', ${JSON.stringify(sess)}); return 1 })()`);
const b0=await B.boot();
ok('기기 B 가 같은 계정으로 붙는다', b0&&b0.on&&b0.uid===a0.uid,
   b0? (b0.uid===a0.uid?'같은 uid':'다른 uid '+String(b0.uid).slice(0,8)) : '못 붙었다');

/* 새 폰의 사무실은 1일째다. 서버는 42일째 — **묻지 않고 덮으면 안 되는 자리**다. */
const asked=await B.ev(`(async()=>{
  for(let i=0;i<40;i++){
    await new Promise(r=>setTimeout(r,400));
    if(document.querySelector('#cloudBack')) break;
  }
  const st=CLOUD.state();
  return { behind:st.behind, serverDays:st.serverDays, mine:(S.together&&S.together.days)|0,
           asked: !!document.querySelector('#cloudBack'),
           keep: !!document.querySelector('#cloudKeep') };
})()`);
ok('서버가 앞선 것을 알아챈다', asked.behind===true, `서버 ${asked.serverDays}일 · 이 기기 ${asked.mine}일`);
ok('**묻는다** (혼자 안 덮는다)', asked.asked&&asked.keep, `되돌린다 ${asked.asked} · 이대로 둔다 ${asked.keep}`);

/* 「되돌린다」는 페이지를 다시 읽는다(cloud.js restore). 그 뒤를 본다. */
await B.ev(`document.querySelector('#cloudBack').click()`).catch(()=>{});
/* 되돌리기는 페이지를 다시 읽는다 — 시계로 재지 말고 **게임이 다시 설 때까지** 기다린다. */
let came=null;
for(let i=0;i<40&&!came;i++){
  await sleep(700);
  came=await B.ev(`(()=>{ const el=document.querySelector('#cctitle'); if(el) el.remove();
    document.body.classList.remove('titleon');
    if(typeof S === 'undefined' || !S) return null;
    return { days:(S.together&&S.together.days)|0, cat:(S.cats[0]||{}).name, cats:S.cats.length } })()`)
    .catch(()=>null);
}
came = came || { days:0, cat:'(게임이 안 섰다)', cats:0 };
ok('**사무실이 따라온다**', came.days===42&&came.cat==='증인',
   `${came.days}일째 · 첫 고양이 ${came.cat} · ${came.cats}마리`);

/* ── 친구 — B 를 비우고 **다른 계정**으로 만든다 ─────────────────────── */
/* 저장을 **페이지가 없는 상태에서** 지운다.

   `localStorage.clear()` 를 페이지 안에서 부르면, 그 페이지가 떠날 때
   `beforeunload → save()` 가 방금 지운 자리에 **아까 그 사무실을 다시 써 넣는다**
   (js/main.js). 그러면 「새 계정」이 남의 코드를 들고 시작하고, 그건 검사가 아니라
   검사가 만든 상황이다. 먼저 빈 페이지로 옮겨 놓고(그때 쓰기가 끝난다) 지운다. */
await B.send('Page.navigate',{url:'about:blank'});
await sleep(1200);
await B.send('Storage.clearDataForOrigin',{origin:BASE,storageTypes:'local_storage'});
const c0=await B.boot();
ok('기기 B 가 새 계정을 만든다', c0&&c0.on&&c0.uid!==a0.uid,
   c0?('uid '+String(c0.uid).slice(0,8)+'…'):'못 붙었다');

/* A 의 지점 줄이 **아직 그대로 있는가.** 없으면 신청이 실패한 이유가 코드가 아니라
   줄이 사라진 것이고, 그 둘은 완전히 다른 고장이다. */
const still=await A.ev(`(async()=>{
  const sb = CLOUD.sb(); if(!sb) return null;
  const { data } = await sb.from('branches')
    .select('code,updated_at').eq('user_id', CLOUD.state().uid).maybeSingle();
  return { srv: data ? data.code : null, local: (S.friends||{}).code || null };
})()`);
ok('A 의 지점이 아직 살아 있다', still && still.srv === grown.code,
   still ? `서버 ${still.srv} · A 안 ${still.local} · 신청에 쓸 것 ${grown.code}`
         : '줄이 사라졌다');

const sent=await B.ev(`(async()=>{
  S.together = S.together || {}; S.together.days = 7;
  save(); await CLOUD.push();
  const r = await FRIENDS.add('${grown.code}');
  await FRIENDS.sync();
  /* 내 지점 줄이 실제로 섰는가 — A 쪽에서 안 보일 때, 줄이 없는 것과 못 읽는 것을
     가르는 유일한 방법이다. */
  const sb = CLOUD.sb();
  const { data: row, error: rowErr } = await sb.from('branches')
    .select('code,updated_at').eq('user_id', CLOUD.state().uid).maybeSingle();
  return { r, mine:FRIENDS.code(), src:FRIENDS.source(), list:FRIENDS.list().length,
           row: row ? row.code : null, rowErr: rowErr && rowErr.message };
})()`);
ok('코드로 신청이 간다', sent.r&&(sent.r.ok!==false), JSON.stringify(sent.r).slice(0,90));
ok('서버 자료를 쓰고 있다', sent.src==='server', sent.src);
ok('신청한 쪽 지점도 서버에 선다', sent.row === sent.mine,
   `내 코드 ${sent.mine} · 서버 줄 ${sent.row}${sent.rowErr ? ' · ' + sent.rowErr : ''}`);
/* **아직 친구가 아니다.** 신청만으로 남의 사무실이 보이면 그건 수락 절차가 아니다. */
ok('수락 전에는 안 보인다', sent.list===0, `목록 ${sent.list}`);

const accepted=await A.ev(`(async()=>{
  await FRIENDS.sync();
  const q = FRIENDS.reqs();
  if(!q.length) return { none:true };
  const r = await FRIENDS.accept(q[0].id);
  /* 몇 번 만에 뜨는가를 센다. 한 번 만에 안 뜨면 그건 화면에서 「수락했는데 목록이
     비어 있다」로 보이는 자리다 — 검사가 조용히 재시도해서 덮으면 안 된다. */
  let tries = 0, n = 0;
  for (; tries < 6 && !n; tries++){
    await FRIENDS.sync();
    n = FRIENDS.list().length;
    if (!n) await new Promise(x=>setTimeout(x,800));
  }
  /* 비어 있으면 **어느 조회가 비었는지** 직접 본다. 관계가 없는 것과, 관계는 있는데
     저쪽 지점 줄을 못 읽는 것은 완전히 다른 고장이다. */
  let why = null;
  if (!n){
    const sb = CLOUD.sb();
    const me = CLOUD.state().uid;
    const rel = await sb.from('friends').select('friend_id').eq('owner_id', me);
    const ids = (rel.data||[]).map(x=>x.friend_id);
    const br = ids.length ? await sb.from('branches').select('user_id,code').in('user_id', ids)
                          : { data:[], error:null };
    why = { rel: ids.length, relErr: rel.error && rel.error.message,
            br: (br.data||[]).length, brErr: br.error && br.error.message,
            cacheOn: FRIENDS.source() };
  }
  return { r, reqs:q.length, list:n, tries, why };
})()`);
ok('A 에게 신청이 도착한다', !accepted.none&&accepted.reqs>0,
   accepted.none?'신청함이 비었다':`${accepted.reqs}건`);
ok('수락하면 목록에 뜬다', accepted.list>0,
   `A 의 목록 ${accepted.list} · sync ${accepted.tries}번째에 · 수락 답 ${String(JSON.stringify(accepted.r)).slice(0,50)}`);
ok('**첫 sync 에 바로 뜬다** (수락하고 빈 화면을 보면 안 된다)',
   accepted.list>0 && accepted.tries===1,
   `${accepted.tries}번${accepted.why ? ' · 진단 ' + JSON.stringify(accepted.why) : ''}`);

const seen=await B.ev(`(async()=>{
  await FRIENDS.sync();
  const l = FRIENDS.list();
  const snap = l.length ? FRIENDS.snapshot(l[0].id) : null;
  /* cats 는 배열이다 — |0 을 씌우면 늘 0 이 나와서 「고양이 0마리」를 보고도
     통과한다. 세는 것과 비우는 것을 구분하려면 길이를 봐야 한다. */
  return { n:l.length, days: snap && (snap.days|0),
           cats: snap && (snap.cats||[]).length, name: snap && snap.name };
})()`);
ok('**상대 사무실이 보인다**', seen.n>0&&seen.days===42&&seen.cats>0,
   `${seen.n}곳 · ${seen.name} · 저쪽 ${seen.days}일째 · 고양이 ${seen.cats}마리`);

/* ── 뒷정리 — 만든 계정을 지운다 ──────────────────────────────────── */
const delB=await B.ev(`CLOUD.erase().then(r=>r||true).catch(e=>String(e))`).catch(e=>'err');
await sleep(1500);
const delA=await A.ev(`CLOUD.erase().then(r=>r||true).catch(e=>String(e))`).catch(e=>'err');
ok('시험 계정을 지웠다', !!delA&&!!delB, `A ${JSON.stringify(delA).slice(0,30)} · B ${JSON.stringify(delB).slice(0,30)}`);

const errs=[...A.errs,...B.errs].filter(e=>!/favicon|net::ERR_/.test(e));
ok('콘솔 오류 0', errs.length===0, errs.join(' / ').slice(0,180));

const bad=rows.filter(r=>!r.pass).length;
console.log('');
rows.forEach(r=>console.log(` ${r.pass?'OK ':'X  '} ${r.name}${r.note?'   — '+r.note:''}`));
console.log(`\n ${rows.length-bad}/${rows.length} 통과`);
A.kill(); B.kill();
process.exit(bad?1:0);
})();
