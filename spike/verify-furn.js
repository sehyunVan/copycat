/* 가구 카탈로그가 **사고 · 놓이고 · 저장되고 · 되살아나는지** 잰다.
   node spike/serve.js 먼저.   node spike/verify-furn.js

   ── 왜 이 넷인가 ──

   목록에 뜨는 것과 방에 서는 것은 다른 일이고, 방에 서는 것과 내일 다시 서 있는 것은
   또 다른 일이다. 이 게임에서 제일 나쁜 버그는 「돈은 나갔는데 아무것도 안 나타난다」와
   「어제 꾸민 사무실이 오늘 없다」이며, 둘 다 조용히 일어난다.

     1 산다        스물다섯 종을 전부 한 번씩 — 하나라도 실패하면 그 종은 못 사는 물건이다
     2 놓인다      격자에서 그 칸이 실제로 늘었는가(벽 물건은 wallDecor 에서)
     3 저장된다    새로고침 뒤에도 보유 수와 격자가 그대로인가
     4 안 샌다     조명 가구를 열 개 사도 점광원이 상한을 안 넘는가(TODO 52 의 그 사고)

   4번이 여기 있는 이유: 스탠드와 랜턴은 **진짜 광원을 받는** 유일한 가구다(furnTable 의
   lit). 상한을 안 두면 사무실을 꾸밀수록 프레임이 떨어지는데, 그건 꾸미기에 대한 벌이다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9744, W = 1280, H = 860;
const OUT = 'C:/tmp/copycat-furn/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 프롤로그·타이틀·코치마크를 지나 게임 화면까지. 여섯 번 두드리는 이유는 단계마다
   애니메이션이 있어서다 — 한 번에 다 눌리지 않는다. */
const BOOT = `(() => {
  if (window.CCTitle && CCTitle.close) CCTitle.close();
  if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter');
  const b = document.querySelector('#oLetterGo'); if (b) b.click();
  const g = document.querySelector('#cnGo'); if (g) g.click();
  const sk = document.querySelector('.coach [data-tut="skip"]'); if (sk) sk.click();
  document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  /* 프로필을 **남긴다** — 새로고침 뒤 저장이 살아 있는지가 3번 항목이다 */
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-vfurn');
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text
      || (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const boot = async () => {
    await sleep(9000);
    for (let i = 0; i < 6; i++){ await ev(BOOT); await sleep(1300); }
  };

  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1&debug=1' });
  await boot();

  const R = [];
  const ok = (name, pass, note = '') => { R.push([pass, name, note]); };

  /* ---------- 1·2 사고 놓인다 ----------
     **종마다 방을 새로 세우고 하나씩 산다.** 처음엔 한 방에 스물다섯을 몰아넣고
     쟀는데 뒤쪽 여섯이 「살 수 없음」으로 떨어졌다 — 버그가 아니라 **자리가 없었던
     것**이다(placeFurniture 는 이미 놓인 가구의 진입로를 막지 않는 자리만 고른다).
     그건 정상 동작이고 buyItem 이 돈도 안 받고 사람에게 말해 준다. 여기서 재려는 것은
     「이 종이 놓일 수 있는가」이므로 방을 매번 비워서 종만 본다. 방이 찼을 때의 행동은
     아래 「가득 찬 방」 항목이 따로 본다. */
  const buy = JSON.parse(await ev(`JSON.stringify((() => {
    S.anchovy = 99999999; S.tier = 4; S.seed = 4242;
    const list = SHOP.filter(i => i.furn);
    const fail = [];
    let floor = 0, wall = 0;
    const count = t => { let n = 0; for (const v of W.grid) if (v === t) n++; return n; };
    const wcount = t => (W.wallDecor || []).filter(d => d.tile === t).length;
    for (const it of list){
      S.shop = {}; buildWorld(true); renderTiles();     // 빈 방으로 되돌린다
      const tile = SHOP_TILE[it.id];
      const wt = it.wallTile ? TILE[it.wallTile] : undefined;
      const b0 = tile !== undefined ? count(tile) : (wt !== undefined ? wcount(wt) : 0);
      if (!buyItem(it.id)){ fail.push(it.id + ':살수없음'); continue; }
      const b1 = tile !== undefined ? count(tile) : (wt !== undefined ? wcount(wt) : 0);
      if (b1 <= b0) fail.push(it.id + ':안놓임');
      if (tile !== undefined) floor++; else if (wt !== undefined) wall++;
    }
    return { 종:list.length, 실패:fail, 바닥:floor, 벽:wall };
  })())`));
  ok('스물다섯 종이 전부 사지고 놓인다', buy.실패.length === 0,
     buy.실패.length ? buy.실패.join(' ') : `${buy.종}종 · 바닥 ${buy.바닥} · 벽 ${buy.벽}`);

  /* 가득 찬 방 — 못 놓으면 **돈을 안 받아야** 한다. 이 게임에서 제일 나쁜 결과가
     「돈은 나갔는데 아무것도 안 나타난다」이고, 그 자리는 buyItem 에 이미 적혀 있다. */
  const full = JSON.parse(await ev(`JSON.stringify((() => {
    S.shop = {}; S.anchovy = 99999999; S.tier = 0; S.seed = 7;
    buildWorld(true); renderTiles();
    let n = 0;
    while (buyItem('f_box') && n < 200) n++;            // 제일 작은 것으로 방을 채운다
    const money = S.anchovy;
    const before = shopCount('f_box');
    const again = buyItem('f_box');                     // 자리가 없는 상태에서 한 번 더
    return { 넣은수:n, 거절:!again, 돈그대로: S.anchovy === money, 보유그대로: shopCount('f_box') === before };
  })())`));
  ok('방이 차면 더 안 놓인다', full.거절, `${full.넣은수}개까지 들어갔다`);
  ok('못 놓으면 돈을 안 받는다', full.돈그대로 && full.보유그대로);

  /* 쾌적도는 다시 사서 잰다(위에서 S.shop 을 비웠다) */
  const cf = JSON.parse(await ev(`JSON.stringify((() => {
    S.shop = {}; S.anchovy = 99999999; S.tier = 4; S.seed = 4242;
    buildWorld(true); renderTiles();
    const list = SHOP.filter(i => i.furn);
    let got = 0;
    for (const it of list) if (buyItem(it.id)) got++;
    return { 보유: list.reduce((n,i)=>n+shopCount(i.id),0), 산것:got, 쾌적도:+(comfort()*100).toFixed(1) };
  })())`));
  ok('쾌적도가 개수를 따라 오른다', cf.쾌적도 > 5, `보유 ${cf.보유}개 → +${cf.쾌적도}%`);

  /* ---------- 4 광원이 안 샌다 ---------- */
  const lit = JSON.parse(await ev(`JSON.stringify((() => {
    for (let i = 0; i < 10; i++){ buyItem('f_floorlamp'); buyItem('f_lantern'); }
    renderTiles(); renderNight(); R3.draw();
    const a = R3.skyInfo();
    /* 다시 세워도 안 쌓이는지까지 같이 본다 — 두 사고가 같은 뿌리다 */
    for (let i = 0; i < 5; i++){ renderTiles(); renderNight(); R3.draw(); }
    const b = R3.skyInfo();
    return { 새등:a.새등, 새등수:a.새등수, 다시:b.새등수 };
  })())`));
  ok('조명 가구를 스무 개 더 사도 점광원이 상한 안', lit.새등수 <= 13,
     `${lit.새등수}개 · ${JSON.stringify(lit.새등)}`);
  ok('다시 세워도 광원이 안 쌓인다', lit.다시 === lit.새등수, `${lit.새등수} → ${lit.다시}`);

  /* ---------- 3 저장되고 되살아난다 ---------- */
  const before = JSON.parse(await ev(`JSON.stringify((() => {
    save();
    const list = SHOP.filter(i => i.furn);
    const c = {}; for (const v of W.grid) c[v] = (c[v]|0) + 1;
    return { 보유: list.reduce((n,i)=>n+shopCount(i.id),0),
             격자: JSON.stringify(c), 벽: (W.wallDecor||[]).length };
  })())`));
  await send('Page.reload');
  await boot();
  const after = JSON.parse(await ev(`JSON.stringify((() => {
    const list = SHOP.filter(i => i.furn);
    const c = {}; for (const v of W.grid) c[v] = (c[v]|0) + 1;
    return { 보유: list.reduce((n,i)=>n+shopCount(i.id),0),
             격자: JSON.stringify(c), 벽: (W.wallDecor||[]).length };
  })())`));
  ok('새로고침 뒤에도 보유 수가 같다', before.보유 === after.보유, `${before.보유} → ${after.보유}`);
  ok('새로고침 뒤에도 격자가 같다', before.격자 === after.격자,
     before.격자 === after.격자 ? '' : '배치가 달라졌다');
  ok('새로고침 뒤에도 벽 장식 수가 같다', before.벽 === after.벽, `${before.벽} → ${after.벽}`);

  /* ---------- 목록 모형 ---------- */
  const pics = JSON.parse(await ev(`JSON.stringify((() => {
    const list = SHOP.filter(i => i.furn);
    let n = 0, miss = [];
    list.forEach(it => {
      const t = SHOP_TILE[it.id] ?? (it.wallTile ? TILE[it.wallTile] : undefined);
      const u = t !== undefined && R3.furnPortrait ? R3.furnPortrait(t, 72) : null;
      if (u) n++; else miss.push(it.id);
    });
    return { n, miss };
  })())`));
  ok('목록 칸마다 진짜 모형이 구워진다', pics.miss.length === 0,
     pics.miss.length ? ('못 구움: ' + pics.miss.join(' ')) : `${pics.n}종`);

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));

  /* 사진 한 장 — 숫자가 다 맞아도 방이 이상할 수 있다. UI 를 걷고 무대만 남긴다. */
  await ev(`(() => {
    document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn,.veil,.coach')
      .forEach(e => e.remove());
    const vp = document.getElementById('viewport');
    if (vp){ vp.style.position='fixed'; vp.style.inset='0'; vp.style.zIndex='9999'; }
    setSkyAt(15.5); renderNight();
    R3.followOn(false); R3.camReset(false); R3.camSet({ zoom:0.34 }); R3.fit(); R3.draw();
  })()`);
  await sleep(2500);
  await ev('R3.draw()');
  const p = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:W,height:H,scale:1} });
  fs.writeFileSync(OUT + 'verify-room.png', Buffer.from(p.data,'base64'));

  console.log('');
  R.forEach(([pass, name, note]) => console.log(`  ${pass ? 'OK ' : 'X  '} ${name}${note ? '   ' + note : ''}`));
  const bad = R.filter(r => !r[0]).length;
  console.log(bad ? `\n  ${R.length - bad}/${R.length} 통과 — ${bad}개 실패` : `\n  ${R.length}/${R.length} 통과`);
  ws.close(); chrome.kill(); process.exit(bad ? 1 : 0);
})();
