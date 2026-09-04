/* 상자를 파는 칸(js/store.js). **결제 자체는 여기서 못 본다** — 네이티브 플러그인은
   앱 안에만 있다. 그래서 이 검사가 보는 것은 셋이다:

     1. 웹에서는 **아무 일도 안 일어난다** — 상점 칸이 없고, 조용히 잠든다
     2. 플러그인이 있으면 칸이 뜨고, 값은 **스토어가 준 문자열 그대로**다
     3. 취소는 사고가 아니다 — 빨간 말풍선이 안 뜬다

   2·3 은 가짜 플러그인(window.Capacitor)을 심어서 본다. 진짜 결제창은 기기에서만
   뜨지만, **우리 쪽 코드가 그 결과를 어떻게 다루는지**는 여기서 다 볼 수 있다. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9452,W=390,H=844;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-vstore');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
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

/* ── 1. 웹에서는 잠들어 있다 ────────────────────────────────────────────── */
const web = await ev(`(()=>{
  const st = window.STORE && STORE.state();
  showGacha();
  const shop = document.querySelectorAll('.gashop').length;
  const buy  = document.querySelectorAll('[data-buy]').length;
  const v = document.querySelector('.veil'); if (v) v.remove();
  return { has: !!window.STORE, on: st && st.on, why: st && st.why, shop, buy };
})()`);
ok('STORE 는 있다', web.has, String(web.has));
ok('웹에서는 꺼져 있다', web.on === false, '이유: ' + web.why);
ok('상점 칸이 아예 안 그려진다', web.shop === 0 && web.buy === 0, `.gashop ${web.shop} · 단추 ${web.buy}`);

/* ── 2. 플러그인이 있으면 — 가짜를 심는다 ──────────────────────────────────
   진짜 RevenueCat 이 주는 모양 그대로 돌려준다: `getProducts` 는 `priceString` 이
   붙은 목록, `purchaseStoreProduct` 는 성공하면 그냥 끝난다. */
const fake = await ev(`(async()=>{
  window.__log = [];
  window.Capacitor = { getPlatform: () => 'ios', Plugins: { Purchases: {
    configure: async a => { window.__log.push(['configure', a.apiKey, a.appUserID]); },
    /* 진짜 플러그인처럼 **구독을 기본값으로** 둔다. \`type\` 을 안 주면 안드로이드는
       일회성 상품을 하나도 안 돌려준다 — 그 자리를 여기서 그대로 재현한다. */
    getProducts: async a => {
      window.__log.push(['getProducts', a.type || 'SUBSCRIPTION']);
      if ((a.type || 'SUBSCRIPTION') !== 'NON_SUBSCRIPTION') return { products: [] };
      return { products: a.productIdentifiers.map(id => ({
        identifier: id, priceString: id === 'box_30' ? '₩19,000' : (id === 'box_12' ? '₩8,900' : '₩3,900') })) };
    },
    purchaseStoreProduct: async a => { window.__log.push(['buy', a.product.identifier]); },
    restorePurchases: async () => { window.__log.push(['restore']); },
  } } };
  /* 장부도 가짜로 — 서버 없이 「잔액이 올랐다」를 만들어야 settle 을 볼 수 있다. */
  let bal = 3;
  window.PARCEL = {
    state: () => ({ on:true, why:'', balance:bal, bricks:0, pulls:0, got:[], freeReady:true, rates:null }),
    refresh: async () => true,
    products: async () => ([
      { product_id:'box_5', boxes:5, label:'상자 5개', sort:1 },
      { product_id:'box_12', boxes:12, label:'상자 12개', sort:2 },
      { product_id:'box_30', boxes:30, label:'상자 30개', sort:3 } ]),
    open: async () => ({ ok:false }), work: async () => ({ ok:false }),
    history: async () => ([
      { txn_id:'t1', product_id:'box_12', boxes:12, store:'PLAY', created_at:'2026-09-01T00:00:00Z' },
      { txn_id:'t2', product_id:'box_5',  boxes:5,  store:'PLAY', created_at:'2026-08-20T00:00:00Z' } ]),
  };
  window.__pay = () => { bal += 12; };     // 웹훅이 들어온 셈 친다
  window.CLOUD = window.CLOUD || {};
  const prev = CLOUD.state;
  CLOUD.state = () => ({ ...(prev ? prev() : {}), uid: 'uid-1234' });
  const okBoot = await STORE.boot();
  const st = STORE.state();
  return { okBoot, on: st.on, why: st.why, n: st.items.length,
           ids: st.items.map(x => x.id), prices: st.items.map(x => x.price),
           cfg: window.__log.find(x => x[0] === 'configure'),
           kind: (window.__log.find(x => x[0] === 'getProducts') || [])[1] };
})()`);
ok('플러그인이 있으면 켜진다', fake.on === true, '이유: ' + (fake.why || '—'));
ok('**Supabase uid 로** 시작한다', fake.cfg && fake.cfg[2] === 'uid-1234',
   fake.cfg ? `키 ${String(fake.cfg[1]).slice(0,9)}… · id ${fake.cfg[2]}` : '안 불렸다');
/* 키는 **그 플랫폼 것**이어야 한다. 남의 것을 넣으면 configure 가 그 자리에서 죽는다. */
ok('아이폰에서는 appl_ 키를 쓴다', /^appl_/.test(String(fake.cfg && fake.cfg[1])),
   String(fake.cfg && fake.cfg[1]).slice(0, 12));

/* 키가 없는 플랫폼에서는 **상점이 아예 안 뜬다** — 살 수 있는 척하는 칸이 있으면 안 된다. */
const noKey = await ev(`(async()=>{
  const p = Capacitor.getPlatform;
  Capacitor.getPlatform = () => 'android';        // 아직 goog_ 키가 없다
  const before = STORE.state();
  const r = await STORE.boot();
  const st = STORE.state();
  Capacitor.getPlatform = p;
  await STORE.boot();                              // 되돌린다
  return { r, on: st.on, why: st.why, back: STORE.state().on };
})()`);
ok('**키 없는 플랫폼에서는 안 판다**', noKey.on === false && /키가 아직 없/.test(noKey.why || ''),
   noKey.why);
ok('키가 있으면 다시 켜진다', noKey.back === true, String(noKey.back));
ok('**일회성 상품으로 묻는다** (안 그러면 안드로이드가 빈손)',
   fake.kind === 'NON_SUBSCRIPTION', 'type=' + fake.kind);
ok('파는 목록은 서버 표에서 온다', fake.n === 3, fake.ids.join(' · '));
ok('값은 스토어가 준 문자열 그대로', fake.prices.every(p => /₩/.test(p)), fake.prices.join(' · '));

/* ── 3. 화면에 칸이 뜨고, 사면 잔액이 다시 그려진다 ────────────────────── */
const shown = await ev(`(async()=>{
  showGacha();
  const before = (document.querySelector('.gatix b')||{}).textContent;
  const btns = [...document.querySelectorAll('[data-buy]')];
  const labels = btns.map(b => b.textContent.replace(/\\s+/g,' ').trim());
  const b12 = btns.find(b => b.dataset.buy === 'box_12');
  if (!b12) return { fail:'box_12 단추가 없다', labels };
  /* 복원 단추는 **창을 지우기 전에** 본다. 지운 뒤에 물으면 늘 없다. */
  const restore = !!document.querySelector('[data-restore]');
  b12.click();
  /* 결제가 끝난 **뒤에** 웹훅이 닿는다 — 그 순서를 그대로 흉내 낸다. 먼저 올려 두면
     settle 이 「이미 올라 있는 값」을 기준으로 잡아 영원히 못 기다린다. */
  await new Promise(r => setTimeout(r, 900));
  const waiting = (b12.textContent || '').replace(/\s+/g,' ').trim();
  window.__pay();
  await new Promise(r => setTimeout(r, 3500));
  const after = (document.querySelector('.gatix b')||{}).textContent;
  const bought = window.__log.find(x => x[0] === 'buy');
  const v = document.querySelector('.veil'); if (v) v.remove();
  return { before, after, labels, waiting, restore, bought: bought && bought[1] };
})()`);
if (shown.fail) console.log('  진단:', JSON.stringify(shown));
ok('상점 칸이 세 개 뜬다', shown.labels && shown.labels.length === 3, (shown.labels||[]).join(' | '));
ok('누르면 그 상품으로 결제한다', shown.bought === 'box_12', String(shown.bought));
ok('기다리는 동안 그 단추가 말한다', /받는 중/.test(shown.waiting || ''), shown.waiting);
ok('산 뒤 잔액을 다시 그린다', shown.before === '3' && shown.after === '15',
   `${shown.before} → ${shown.after}`);
ok('복원 단추가 있다 (심사 필수)', shown.restore, String(shown.restore));

/* ── 4. 취소는 사고가 아니다 ──────────────────────────────────────────── */
const cancel = await ev(`(async()=>{
  /* 앞 결제가 아직 기다리고 있으면 새 결제는 **일부러** 거절된다(ST.busy). 그건
     맞는 동작이라 여기서 시비 걸 것이 아니고, 끝나기를 기다렸다가 본다. */
  for (let i = 0; i < 30 && STORE.state().busy; i++)
    await new Promise(r => setTimeout(r, 500));
  Capacitor.Plugins.Purchases.purchaseStoreProduct = async () => {
    const e = new Error('Purchase was cancelled'); e.userCancelled = true; throw e;
  };
  window.__toasts = [];
  const t = window.toast;
  window.toast = m => { window.__toasts.push(String(m)); };
  const r = await STORE.buy('box_5');
  showGacha();
  const b = [...document.querySelectorAll('[data-buy]')].find(x => x.dataset.buy === 'box_5');
  b.click();
  await new Promise(r => setTimeout(r, 700));
  const dis = [...document.querySelectorAll('[data-buy]')].map(x => x.disabled);
  window.toast = t;
  const v = document.querySelector('.veil'); if (v) v.remove();
  return { why: r.why, toasts: window.__toasts, dis };
})()`);
ok('취소를 취소로 안다', cancel.why === 'cancel', String(cancel.why));
ok('취소하면 말풍선이 안 뜬다', cancel.toasts.length === 0, JSON.stringify(cancel.toasts));
ok('취소해도 단추가 안 잠긴다', cancel.dis.every(d => d === false), JSON.stringify(cancel.dis));

/* ── 5. 결제는 됐는데 아직 안 들어온 자리 ────────────────────────────── */
const slow = await ev(`(async()=>{
  for (let i = 0; i < 40 && STORE.state().busy; i++)
    await new Promise(r => setTimeout(r, 500));
  Capacitor.Plugins.Purchases.purchaseStoreProduct = async () => {};   // 성공하되 잔액은 그대로
  window.__toasts = [];
  const t = window.toast; window.toast = m => { window.__toasts.push(String(m)); };
  showGacha();
  const b = [...document.querySelectorAll('[data-buy]')].find(x => x.dataset.buy === 'box_5');
  const before = (document.querySelector('.gatix b')||{}).textContent;
  b.click();
  /* **시계로 기다리지 않는다.** settle 의 초를 여기 또 적으면 둘이 갈리고, 그때 이
     검사는 제품이 아니라 자기 시계 때문에 깜빡인다. 말풍선이 뜨는 것을 기다린다. */
  for (let i = 0; i < 60 && !window.__toasts.length; i++)
    await new Promise(r => setTimeout(r, 300));
  const said = window.__toasts.slice();
  const stillDis = [...document.querySelectorAll('[data-buy]')].some(x => x.disabled);
  /* 뒤늦게 닿는다 — late() 가 5초마다 보고 있다. 창이 열려 있으니 다시 그려야 한다. */
  window.__pay();
  for (let i = 0; i < 40 && (document.querySelector('.gatix b')||{}).textContent === before; i++)
    await new Promise(r => setTimeout(r, 500));
  const after = (document.querySelector('.gatix b')||{}).textContent;
  window.toast = t;
  const v = document.querySelector('.veil'); if (v) v.remove();
  return { toasts: said, stillDis, before, after };
})()`);
ok('안 들어와도 실패라 안 한다', slow.toasts.some(m => /곧 도착|on the way|まもなく/.test(m)),
   JSON.stringify(slow.toasts));
ok('오래 안 잠근다', slow.stillDis === false, '말풍선 뜬 시점에 단추 잠김 ' + slow.stillDis);
ok('**늦게 닿아도 화면이 따라온다**', slow.before === '15' && slow.after === '27',
   `${slow.before} → ${slow.after}`);

/* ── 6. 결제 전에 알려야 하는 것들 ──────────────────────────────────
   상자는 소모품이라 뜯으면 되돌릴 수 없는데, **그 사실을 미리 알려야** 청약철회
   예외가 성립한다. 미성년자 안내와 문의처도 결제하는 자리 가까이 있어야 한다. */
const info = await ev(`(async()=>{
  showGacha();
  const link = document.querySelector('[data-payinfo]');
  if (!link) return { fail:'안내 링크가 없다' };
  link.click();
  await new Promise(r=>setTimeout(r,900));
  const v = [...document.querySelectorAll('.veil')].pop();
  const t = v ? v.textContent : '';
  const items = v ? v.querySelectorAll('.payitem').length : 0;
  const first = v && v.querySelector('.payitem') ? v.querySelector('.payitem').textContent.replace(/\s+/g,' ').trim() : '';
  document.querySelectorAll('.veil').forEach(x=>x.remove());
  return { soso:/소모품/.test(t), refund:/스토어를 통해|환불/.test(t),
           minor:/법정대리인|미성년/.test(t), mail:!!(v && v.querySelector('a[href^="mailto:"]')),
           card:/카드 정보는 이 게임에 오지 않습니다/.test(t), items, first,
           mailHref:(v && v.querySelector('a[href^="mailto:"]')||{}).getAttribute
                     ? v.querySelector('a[href^="mailto:"]').getAttribute('href').slice(0,40) : '' };
})()`);
if (info.fail) console.log('  진단:', JSON.stringify(info));
ok('결제 안내를 여는 길이 있다', !info.fail, info.fail || '있다');
ok('**소모품이라고 미리 말한다**', info.soso, String(info.soso));
ok('환불은 스토어를 통한다고 말한다', info.refund, String(info.refund));
ok('**미성년자 안내가 있다**', info.minor, String(info.minor));
ok('카드 정보를 안 받는다고 말한다', info.card, String(info.card));
ok('문의처가 **눌러서 메일이 되는가**', info.mail, info.mailHref || String(info.mail));
ok('구매 내역이 **서버 줄**로 뜬다', info.items === 2, `${info.items}건 · ${info.first}`);

/* ── 7. 제일 큰 묶음은 한 번 더 묻는다 ──────────────────────────── */
const big = await ev(`(async()=>{
  Capacitor.Plugins.Purchases.purchaseStoreProduct = async a => { window.__log.push(['buy', a.product.identifier]); };
  window.__log = [];
  showGacha();
  document.querySelector('[data-buy="box_30"]').click();
  await new Promise(r=>setTimeout(r,700));
  const v = [...document.querySelectorAll('.veil')].pop();
  const asked = !!(v && v.querySelector('#pcYes'));
  const said = v ? v.textContent : '';
  if (v && v.querySelector('#pcNo')) v.querySelector('#pcNo').click();   // 그만둔다
  await new Promise(r=>setTimeout(r,500));
  const boughtAfterNo = window.__log.some(x=>x[0]==='buy');
  /* 작은 것은 안 묻는다 — 전부 물으면 확인이 아니라 방해다 */
  document.querySelector('[data-buy="box_5"]').click();
  await new Promise(r=>setTimeout(r,700));
  const askedSmall = !!document.querySelector('#pcYes');
  document.querySelectorAll('.veil').forEach(x=>x.remove());
  return { asked, said:/30/.test(said), boughtAfterNo, askedSmall };
})()`);
ok('**제일 큰 묶음은 한 번 더 묻는다**', big.asked, String(big.asked));
ok('무엇을 사는지 그 창이 말한다', big.said, String(big.said));
ok('그만두면 **결제가 안 일어난다**', big.boughtAfterNo === false, String(big.boughtAfterNo));
ok('작은 묶음은 안 묻는다 (방해가 안 된다)', big.askedSmall === false, String(big.askedSmall));

ok('콘솔 오류 0', errs.length === 0, errs.join(' / ').slice(0, 200));

/* 사진 한 장. 값이 세 칸에 들어가는지, 파는 칸이 뜯는 단추를 안 눌렀는지는
   눈으로만 보인다 — 통화 문자열이 긴 나라에서 제일 먼저 깨지는 자리다. */
await ev(`(()=>{ const v=document.querySelector('.veil'); if(v) v.remove(); showGacha(); return 1 })()`);
await sleep(700);
const shot = await send('Page.captureScreenshot', { format: 'png' });
const out = path.join(__dirname, 'dist', 'shots'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'store.png'), Buffer.from(shot.data, 'base64'));

/* 결제 안내도 한 장. 글이 많은 창이라 **넘치는지 잘리는지는 눈으로만 보인다.** */
await ev(`(async()=>{ document.querySelectorAll('.veil').forEach(x=>x.remove());
  showGacha(); document.querySelector('[data-payinfo]').click();
  await new Promise(r=>setTimeout(r,600)); return 1 })()`);
await sleep(700);
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(out, 'payinfo.png'), Buffer.from(shot2.data, 'base64'));
console.log('');
console.log('사진 → spike/dist/shots/store.png · payinfo.png');

const bad = rows.filter(r => !r.pass).length;
console.log('');
rows.forEach(r => console.log(` ${r.pass ? 'OK ' : 'X  '} ${r.name}${r.note ? '   — ' + r.note : ''}`));
console.log(`\n ${rows.length - bad}/${rows.length} 통과`);
try{ws.close();}catch(e){}
chrome.kill();
process.exit(bad ? 1 : 0);
})();
