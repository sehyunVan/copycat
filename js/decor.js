/* ============================================================
   decor.js — 벽지와 바닥. 34번(인테리어)의 앞쪽 절반.

   여기 있는 것은 **색이 아니라 그림**이다. 원래 계획은 팔레트를 한 벌 더 만드는
   것이었는데(TODO 34 「벌 셋」), 그러면 고를 수 있는 게 셋뿐이고 줄무늬·격자·
   다다미처럼 「무늬」인 것은 아예 못 만든다. 그래서 색 대신 **캔버스 한 장**을 굽는다:
   바닥은 방 크기 판 하나에 텍스처로 깔고, 벽은 덩어리마다 제 길이로 굽는다.

   견본책 UI(js/binder.js)도 **같은 그림 함수**로 견본을 그린다 —
   화면에서 고른 것과 방에 깔린 것이 다를 수 없어야 하기 때문이다.

   좌표 규약은 격자와 같다: **1 = 한 칸**. 그림 함수는 (g, w, h, u) 를 받는데
   w·h 는 칸 수고 u 는 칸당 픽셀이다. 벽은 캔버스 위쪽이 벽 위쪽이다.

   난수는 전부 씨앗을 박았다. 사무실을 다시 그릴 때마다 나뭇결이 이사하면
   그건 무늬가 아니라 노이즈다(render3d.js deskProps 와 같은 판단).

   (여기 「2D 는 같은 캔버스를 타일마다 옮겨 쓴다」는 절이 있었다. 도트 렌더러를
    2026-08-24 에 지우면서 같이 빠졌다.)
   ============================================================ */
(function(){
'use strict';

/* ---------- 잡동사니 ---------- */
function rng(s){ return function(){ s = (s*1664525 + 1013904223) | 0; return ((s>>>8) & 0xFFFFFF) / 0x1000000; }; }
function hx(c){ const n = parseInt(c.slice(1),16); return [n>>16 & 255, n>>8 & 255, n & 255]; }
function num(c){ return parseInt(c.slice(1),16); }
function shade(c,k){
  const p = hx(c), t = k < 0 ? 0 : 255, a = Math.abs(k);
  return 'rgb(' + p.map(v => Math.round(v + (t-v)*a)).join(',') + ')';
}
function mkc(w,h){ const c = document.createElement('canvas'); c.width = Math.max(1,Math.round(w)); c.height = Math.max(1,Math.round(h)); return c; }
/* 이음매 없는 얼룩 — 가장자리에 걸친 것은 반대쪽에도 한 번 더 찍는다.
   바닥은 방 하나를 통째로 굽지만 벽은 덩어리마다 이어 붙으므로 이게 필요하다. */
function wrap(g, W, H, x, y, r, fn){
  fn(x,y);
  if (x < r) fn(x+W,y); else if (x > W-r) fn(x-W,y);
}

/* ============================================================
   벽지
   base 밑색 · dado 허리 아래 색(없으면 안 나눔) · trim 걸레받이·몰딩색
   paint 는 밑색 위에 무늬만 얹는다. 몰딩은 3D 에선 따로 세운 상자다.
   ============================================================ */
const WALLS = [
{ id:'plain', cost:0, base:'#D7CDBD', trim:'#BFB3A2',
  n: L({ ko:'회벽', en:'Plain Wall', ja:'素の壁' }),
  note: L({ ko:'처음부터 있던 벽.', en:'The wall that was always here.', ja:'最初からあった壁。' }) },

{ id:'twotone', cost:240, base:'#DCD3C4', dado:'#B4A692', trim:'#A2947F',
  n: L({ ko:'사무용 투톤', en:'Office Two-Tone', ja:'オフィス2トーン' }),
  note: L({ ko:'아래를 눌러 두면 방이 낮고 단단해 보인다.', en:'A darker base makes the room sit lower.', ja:'下を締めると部屋が低く落ち着く。' }) },

{ id:'stripe', cost:640, base:'#E0D7C7', trim:'#C3B49C',
  n: L({ ko:'줄무늬 크림', en:'Cream Stripe', ja:'クリームストライプ' }),
  note: L({ ko:'가늘수록 비싸 보인다.', en:'The thinner the stripe, the pricier it looks.', ja:'細いほど高そうに見える。' }),
  paint(g,w,h,u){ g.fillStyle = '#D0C3AD';
    for (let x = 0; x < w; x += 0.25) g.fillRect(x*u, 0, Math.max(1,u*0.085), h*u); } },

{ id:'grid', cost:980, base:'#CBD6C8', trim:'#ABB8A8',
  n: L({ ko:'민트 격자', en:'Mint Grid', ja:'ミントの格子' }),
  note: L({ ko:'선이 있으면 방이 반듯해 보인다.', en:'Lines make the room look square.', ja:'線が入ると部屋がきちんと見える。' }),
  paint(g,w,h,u){ g.fillStyle = '#AEBDAA'; const t = Math.max(1,u*0.02);
    for (let x = 0; x < w; x += 0.5) g.fillRect(x*u, 0, t, h*u);
    for (let y = h; y > 0; y -= 0.5) g.fillRect(0, y*u, w*u, t); } },

{ id:'cork', cost:1400, base:'#C19A70', trim:'#8E6F4E',
  n: L({ ko:'코르크 벽', en:'Cork Wall', ja:'コルクの壁' }),
  note: L({ ko:'게시판이 벽을 다 먹었다.', en:'The pinboard ate the whole wall.', ja:'掲示板が壁を全部食べた。' }),
  paint(g,w,h,u){ const q = rng(7), W = w*u, H = h*u, n = Math.round(w*h*90);
    for (let i = 0; i < n; i++){ const s = u*(0.012+q()*0.032), c = q() > 0.5 ? 'rgba(118,88,54,.34)' : 'rgba(220,190,148,.42)';
      const x = q()*W, y = q()*H;
      g.fillStyle = c; wrap(g,W,H,x,y,s, (px,py) => g.fillRect(px,py,s,s*0.7)); }
    for (let i = 0; i < Math.round(w*0.9); i++){ const x = ((i*1.7+0.4)%w)*u, y = ((i*2.3+0.5)%h)*u;
      g.fillStyle = '#8C5B52'; g.beginPath(); g.arc(x,y,Math.max(1.2,u*0.028),0,7); g.fill(); } } },

{ id:'blue', cost:1900, base:'#B7C6CD', trim:'#E7E2D8',
  n: L({ ko:'하늘 페인트', en:'Sky Paint', ja:'空色ペイント' }),
  note: L({ ko:'여름에만 쓸 것 같은데 아니다.', en:'Looks like a summer-only wall. It is not.', ja:'夏だけの壁に見えるが、そうでもない。' }),
  paint(g,w,h,u){ const gr = g.createLinearGradient(0,0,0,h*u);
    gr.addColorStop(0,'rgba(255,255,255,.13)'); gr.addColorStop(1,'rgba(56,78,94,.13)');
    g.fillStyle = gr; g.fillRect(0,0,w*u,h*u); } },

{ id:'panel', cost:2200, base:'#A9805A', dado:'#8A6242', trim:'#6F4F33',
  n: L({ ko:'나무 판벽', en:'Wood Paneling', ja:'木の羽目板' }),
  note: L({ ko:'사장실은 이렇게 생겼다고 들었다.', en:'I hear this is what a boss office looks like.', ja:'社長室はこういう見た目らしい。' }),
  paint(g,w,h,u){ const q = rng(3);
    for (let x = 0; x < w; x += 0.4){
      g.fillStyle = 'rgba(255,238,214,' + (0.02+q()*0.07).toFixed(3) + ')'; g.fillRect(x*u,0,u*0.4,h*u);
      g.fillStyle = 'rgba(86,58,36,.55)'; g.fillRect(x*u,0,Math.max(1,u*0.024),h*u); } } },

{ id:'sand', cost:2600, base:'#C6B79C', trim:'#8E7454',
  n: L({ ko:'사벽', en:'Sand Plaster', ja:'砂壁' }),
  note: L({ ko:'회사가 아니라 자취방이 된다.', en:'Turns the company into a one-room flat.', ja:'会社ではなく下宿になる。' }),
  paint(g,w,h,u){ const q = rng(11), W = w*u, H = h*u, s = Math.max(1,u*0.015), n = Math.round(w*h*130);
    for (let i = 0; i < n; i++){ const x = q()*W, y = q()*H;
      g.fillStyle = q() > 0.5 ? 'rgba(148,130,102,.26)' : 'rgba(228,216,192,.3)';
      wrap(g,W,H,x,y,s, (px,py) => g.fillRect(px,py,s,s)); }
    /* 기둥 — 세 칸에 하나. 방 하나에 하나만 세우면 벽을 이어 붙였을 때 어디는 있고
       어디는 없는 벽이 된다. 규칙적으로 서 있어야 「목조 주택」이 된다 */
    g.fillStyle = '#8E7454';
    for (let x = 1.5; x < w; x += 3) g.fillRect(x*u - u*0.07, 0, Math.max(2,u*0.14), h*u);
    g.fillStyle = '#7D6446'; g.fillRect(0, h*u*0.05, w*u, Math.max(2,u*0.09)); } },

{ id:'catnip', cost:3200, base:'#CFCEB8', trim:'#A8A78E',
  n: L({ ko:'캣닢 잎', en:'Catnip Leaf', ja:'キャットニップの葉' }),
  note: L({ ko:'우리 품목이다.', en:'Our product line.', ja:'うちの品目だ。' }),
  paint(g,w,h,u){ const st = 0.55; let j = 0;
    for (let y = st*0.4; y < h; y += st, j++)
      for (let x = (j%2 ? st*0.5 : 0); x < w; x += st){
        g.save(); g.translate(x*u, y*u); g.rotate(-0.5);
        g.fillStyle = '#A9CF87'; g.beginPath(); g.ellipse(0,0,u*0.1,u*0.045,0,0,7); g.fill();
        g.rotate(1.15); g.fillStyle = '#8DB86A'; g.beginPath(); g.ellipse(u*0.055,0,u*0.085,u*0.04,0,0,7); g.fill();
        g.restore(); } } },

{ id:'flower', cost:3600, base:'#D9CFC6', trim:'#B39C93',
  n: L({ ko:'꽃무늬', en:'Faded Roses', ja:'花柄' }),
  note: L({ ko:'누구 집에나 있던 벽.', en:'The wall every house used to have.', ja:'どの家にもあった壁。' }),
  paint(g,w,h,u){ const st = 0.5; let j = 0;
    for (let y = st*0.35; y < h; y += st, j++)
      for (let x = (j%2 ? st*0.5 : 0); x < w; x += st){
        const px = x*u, py = y*u;
        g.fillStyle = '#93A183'; g.beginPath(); g.ellipse(px+u*0.1,py+u*0.08,u*0.06,u*0.026,0.6,0,7); g.fill();
        g.fillStyle = '#C08E8A';
        for (let k = 0; k < 5; k++){ const a = k*1.2566;
          g.beginPath(); g.arc(px+Math.cos(a)*u*0.048, py+Math.sin(a)*u*0.048, u*0.035,0,7); g.fill(); }
        g.fillStyle = '#E2CBA2'; g.beginPath(); g.arc(px,py,u*0.026,0,7); g.fill(); } } },

{ id:'pegboard', cost:4800, base:'#A9AEB0', trim:'#7E858A',
  n: L({ ko:'타공판', en:'Pegboard', ja:'有孔ボード' }),
  note: L({ ko:'전산실에서 뜯어 왔다.', en:'Pried off the server room wall.', ja:'サーバ室から剥がしてきた。' }),
  paint(g,w,h,u){ const st = 0.125, r = Math.max(0.7,u*0.022); g.fillStyle = '#7B8288';
    for (let y = st*0.6; y < h; y += st) for (let x = st*0.6; x < w; x += st){
      g.beginPath(); g.arc(x*u,y*u,r,0,7); g.fill(); } } },

/* 개그 한 장. 무늬는 사진의 그 화살 깃털이고, 색은 형광등에 오래 눌린 크림이다.
   설명 한 줄이 이 아이템의 전부다 — 무섭게 만들면 케어 톤을 배반한다(copycat-direction). */
{ id:'backroom', cost:5600, base:'#D9D3A4', trim:'#C0B981',
  n: L({ ko:'백룸 벽지', en:'Backroom Print', ja:'バックルーム柄' }),
  note: L({ ko:'왠지 못 나갈 것 같다.', en:'You get the feeling you cannot leave.', ja:'なぜか出られない気がする。' }),
  paint(g,w,h,u){
    const gr = g.createLinearGradient(0,0,0,h*u);
    gr.addColorStop(0,'rgba(255,250,190,.16)'); gr.addColorStop(1,'rgba(120,112,60,.14)');
    g.fillStyle = gr; g.fillRect(0,0,w*u,h*u);
    g.strokeStyle = 'rgba(122,124,110,.45)'; g.lineWidth = Math.max(1,u*0.012);
    for (let x = 0; x < w; x += 0.19){                 // 화살 깃털 기둥
      const cx = x*u, hw = u*0.062;
      for (let y = 0; y < h; y += 0.085){
        const cy = y*u;
        g.beginPath(); g.moveTo(cx-hw, cy+u*0.05); g.lineTo(cx, cy); g.lineTo(cx+hw, cy+u*0.05); g.stroke();
      }
      g.strokeStyle = 'rgba(150,150,132,.3)'; g.beginPath(); g.moveTo(cx+hw*1.5,0); g.lineTo(cx+hw*1.5,h*u); g.stroke();
      g.strokeStyle = 'rgba(122,124,110,.45)';
    } } },

/* ---------- 아홉 벌에 맞춘 벽지 여섯 ----------
   가구 톤 아홉을 넣으면서 같이 들어왔다. 벽지는 가구보다 면적이 넓어서, 벌만 갈고
   벽을 그대로 두면 **방의 절반이 옛 벌**이다. 이미 있는 것으로 되는 자리는 안 만들었다:
   다크 우드는 「나무 판벽」, 빈티지 민트는 「민트 격자」가 그대로 맞는다. */
{ id:'coolgrey', cost:900, base:'#D6D9DC', trim:'#B4B8BC',
  n: L({ ko:'식은 회색', en:'Cooled Grey', ja:'冷めたグレー' }),
  note: L({ ko:'차가운 회색 가구와 같은 온도.', en:'The same temperature as the cool grey set.', ja:'クールグレーの家具と同じ温度。' }),
  paint(g,w,h,u){ const q = rng(31);
    /* 롤러 자국 — 회색 한 판은 벽이 아니라 배경이 된다 */
    for (let x = 0; x < w; x += 0.34){
      g.fillStyle = 'rgba(255,255,255,' + (0.02 + q()*0.05).toFixed(3) + ')';
      g.fillRect(x*u, 0, u*0.34, h*u);
    }
    g.fillStyle = 'rgba(120,128,138,.10)';
    for (let i = 0; i < w*h*40; i++) g.fillRect(q()*w*u, q()*h*u, u*0.02, u*0.02); } },

{ id:'cream', cost:1100, base:'#F3ECDE', trim:'#DACFBA',
  n: L({ ko:'연한 크림', en:'Soft Cream', ja:'淡いクリーム' }),
  note: L({ ko:'파스텔 가구를 눕히려면 벽이 먼저 조용해야 한다.', en:'Pastel furniture needs a quiet wall first.', ja:'パステルの家具を置くなら、まず壁が静かでないと。' }),
  paint(g,w,h,u){ const q = rng(53);
    const gr = g.createLinearGradient(0,0,0,h*u);
    gr.addColorStop(0,'rgba(255,255,255,.16)'); gr.addColorStop(1,'rgba(198,182,158,.12)');
    g.fillStyle = gr; g.fillRect(0,0,w*u,h*u);
    for (let i = 0; i < w*h*90; i++){ g.fillStyle = 'rgba(212,198,172,.20)';
      g.fillRect(q()*w*u, q()*h*u, u*0.016, u*0.016); } } },

{ id:'bluegrey', cost:1600, base:'#93A7B8', trim:'#6E8291',
  n: L({ ko:'블루 그레이 페인트', en:'Blue-Grey Paint', ja:'ブルーグレーペイント' }),
  note: L({ ko:'창밖이 흐린 날과 같은 색이다.', en:'The colour of an overcast window.', ja:'曇りの窓と同じ色。' }),
  paint(g,w,h,u){
    const gr = g.createLinearGradient(0,0,0,h*u);
    gr.addColorStop(0,'rgba(255,255,255,.14)'); gr.addColorStop(1,'rgba(58,76,92,.16)');
    g.fillStyle = gr; g.fillRect(0,0,w*u,h*u);
    /* 허리 높이 가로줄 하나 — 파랑 한 판은 하늘로 읽힌다 */
    g.fillStyle = 'rgba(70,88,104,.22)'; g.fillRect(0, h*u*0.62, w*u, Math.max(2,u*0.05)); } },

{ id:'whitepaint', cost:2000, base:'#EFEFEC', trim:'#CFCFCB',
  n: L({ ko:'백색 도장', en:'White Coat', ja:'白の塗装' }),
  note: L({ ko:'검은 가구를 세우면 그때부터 이 벽이 일한다.', en:'Put black furniture on it and the wall starts working.', ja:'黒い家具を置いた瞬間、この壁が働きはじめる。' }),
  paint(g,w,h,u){ const q = rng(17);
    for (let i = 0; i < w*h*70; i++){ g.fillStyle = q() > 0.5 ? 'rgba(255,255,255,.30)' : 'rgba(180,180,176,.16)';
      g.fillRect(q()*w*u, q()*h*u, u*0.02, u*0.02); }
    /* 이음매 두 줄. 완전히 매끈한 흰 벽은 벽이 아니라 여백이다 */
    g.fillStyle = 'rgba(160,160,156,.30)';
    for (let x = 2; x < w; x += 4) g.fillRect(x*u, 0, Math.max(1,u*0.012), h*u); } },

{ id:'khakiwall', cost:2400, base:'#B5B384', trim:'#85835A',
  n: L({ ko:'카키 사벽', en:'Khaki Plaster', ja:'カーキの砂壁' }),
  note: L({ ko:'거친 면이라 카키가 색으로 안 뜬다.', en:'The rough face keeps the khaki from shouting.', ja:'ざらついた面のおかげでカーキが浮かない。' }),
  paint(g,w,h,u){ const q = rng(23), W = w*u, H = h*u, s = Math.max(1,u*0.016);
    for (let i = 0; i < w*h*160; i++){ const x = q()*W, y = q()*H;
      g.fillStyle = q() > 0.5 ? 'rgba(140,138,110,.26)' : 'rgba(228,226,204,.24)';
      wrap(g,W,H,x,y,s, (px,py) => g.fillRect(px,py,s,s)); }
    g.fillStyle = 'rgba(120,118,92,.30)'; g.fillRect(0, H*0.06, W, Math.max(2,u*0.05)); } },

{ id:'rawconcrete', cost:3000, base:'#9EA09E', trim:'#787B79',
  n: L({ ko:'노출 콘크리트', en:'Raw Concrete', ja:'打ちっぱなし' }),
  note: L({ ko:'마감을 안 한 게 아니라 이게 마감이다.', en:'It is not unfinished. This is the finish.', ja:'未完成ではない。これが仕上げだ。' }),
  paint(g,w,h,u){ const q = rng(11), W = w*u, H = h*u;
    for (let i = 0; i < w*h*220; i++){ const x = q()*W, y = q()*H, s = u*(0.01+q()*0.03);
      g.fillStyle = q() > 0.5 ? 'rgba(150,152,151,.22)' : 'rgba(206,208,207,.20)';
      wrap(g,W,H,x,y,s, (px,py) => g.fillRect(px,py,s,s*0.8)); }
    /* 거푸집 자국 — 판 이음매와 콘 구멍. 이게 없으면 그냥 회색이다 */
    g.fillStyle = 'rgba(120,124,123,.30)';
    for (let x = 1.5; x < w; x += 3) g.fillRect(x*u, 0, Math.max(1,u*0.014), H);
    for (let y = 0.5; y < h; y += 0.9) g.fillRect(0, y*u, W, Math.max(1,u*0.012));
    g.fillStyle = 'rgba(96,100,99,.45)';
    for (let y = 0.5; y < h; y += 0.9)
      for (let x = 1.5; x < w; x += 3){
        g.beginPath(); g.arc(x*u, y*u, Math.max(1.4,u*0.026), 0, 7); g.fill(); } } },

{ id:'flyer', cost:-1, base:'#DCD2BC', trim:'#9A8F78',
  n: L({ ko:'전단 도배', en:'Papered in Flyers', ja:'ビラ張り' }),
  note: L({ ko:'붙이지 않은 묶음이 있었다.', en:'There was a bundle nobody put up.', ja:'貼らなかった束があった。' }),
  paint(g,w,h,u){ const pw = 0.8, ph = 1.06, q = rng(5); let j = 0;
    for (let y = -0.15; y < h; y += ph*0.99, j++){ let i = 0;
      for (let x = (j%2 ? -pw*0.42 : -pw*0.06); x < w; x += pw*0.99, i++){
        g.save(); g.translate(x*u, y*u); g.rotate((q()-0.5)*0.05);
        const W2 = pw*u, H2 = ph*u;
        g.fillStyle = '#E6DCC6'; g.fillRect(0,0,W2*0.94,H2*0.94);
        g.fillStyle = 'rgba(107,97,82,.9)'; g.fillRect(W2*0.11,H2*0.1,W2*0.72,H2*0.05);
        for (let k = 0; k < 3; k++) g.fillRect(W2*0.11, H2*0.24+k*H2*0.075, W2*(0.6-k*0.13), H2*0.022);
        for (let k = 0; k < 6; k++){
          if ((i*3+j*5+k)%9 !== 4){ g.fillStyle = '#CFC4AA'; g.fillRect(W2*0.1+k*W2*0.132, H2*0.58, W2*0.115, H2*0.33); }
          g.fillStyle = 'rgba(107,97,82,.45)'; g.fillRect(W2*0.1+k*W2*0.132, H2*0.58, Math.max(0.6,u*0.01), H2*0.33); }
        g.restore(); } } } },

{ id:'nametag', cost:-1, base:'#CFC6B4', trim:'#A2977F',
  n: L({ ko:'이름표 벽', en:'Wall of Nametags', ja:'名札の壁' }),
  note: L({ ko:'지나간 이름들. 하나는 비어 있다.', en:'Names that passed through. One is blank.', ja:'通り過ぎた名前たち。一つは空だ。' }),
  paint(g,w,h,u){ const tw = 0.48, th = 0.19, gx = tw*1.28, gy = th*2.1; let j = 0;
    for (let y = gy*0.4; y < h; y += gy, j++){ let i = 0;
      for (let x = (j%2 ? gx*0.5 : 0) + gx*0.08; x < w; x += gx, i++){
        const px = x*u, py = y*u, W2 = tw*u, H2 = th*u;
        g.fillStyle = 'rgba(40,32,24,.15)'; g.fillRect(px+1.5,py+1.5,W2,H2);
        g.fillStyle = '#EAE3D3'; g.fillRect(px,py,W2,H2);
        g.fillStyle = '#B6A98F'; g.fillRect(px,py+H2*0.76,W2,H2*0.24);
        if ((i*3+j*5)%11 !== 4){ g.fillStyle = '#6B6152'; g.fillRect(px+W2*0.16,py+H2*0.28,W2*0.6,Math.max(1,H2*0.16)); } } } } }
];

/* ============================================================
   바닥 — 방 하나를 통째로 굽는다. 그래서 이음매 규칙이 없다.
   눈금은 격자와 같으므로 체커·다다미가 칸에 정확히 맞는다.
   ============================================================ */
const FLOORS = [
{ id:'carpet', cost:0, base:'#C7BAA7', alt:'#BBAD99',
  n: L({ ko:'사무용 카펫타일', en:'Office Carpet Tile', ja:'オフィスカーペット' }),
  note: L({ ko:'지금 밟고 있는 것.', en:'What you are standing on.', ja:'いま踏んでいるもの。' }),
  paint(g,w,h,u){ const q = rng(2);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++){
      g.fillStyle = ((x+z)%2) ? '#C7BAA7' : '#BBAD99'; g.fillRect(x*u,z*u,u+1,u+1);
      for (let i = 0; i < 60; i++){ g.fillStyle = q() > 0.5 ? 'rgba(255,250,240,.12)' : 'rgba(90,78,62,.10)';
        g.fillRect(x*u+q()*u, z*u+q()*u, u*0.05, u*0.05); } } } },

{ id:'vinyl', cost:200, base:'#BEBAB2', alt:'#B6B2AA',
  n: L({ ko:'회색 장판', en:'Grey Vinyl', ja:'グレーの床材' }),
  note: L({ ko:'제일 싸고 제일 조용하다.', en:'Cheapest, quietest.', ja:'一番安くて一番静か。' }),
  paint(g,w,h,u){ g.fillStyle='#BEBAB2'; g.fillRect(0,0,w*u,h*u); const q = rng(4), n = Math.round(w*h*36);
    for (let i = 0; i < n; i++){ g.fillStyle = q() > 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(88,88,84,.07)';
      const s = u*(0.04+q()*0.12); g.fillRect(q()*w*u, q()*h*u, s, s*0.5); } } },

{ id:'tape', cost:300, base:'#C2A47E', alt:'#B79972',
  n: L({ ko:'박스테이프 바닥', en:'Packing Tape Floor', ja:'ガムテープの床' }),
  note: L({ ko:'이사 온 날 그대로 살기.', en:'Living in moving-day condition.', ja:'引っ越した日のまま暮らす。' }),
  paint(g,w,h,u){ g.fillStyle='#C2A47E'; g.fillRect(0,0,w*u,h*u); const q = rng(41), n = Math.round(w*h*80);
    for (let i = 0; i < n; i++){ g.fillStyle='rgba(150,120,86,.13)'; g.fillRect(q()*w*u,q()*h*u,u*0.08,u*0.02); }
    g.fillStyle='rgba(138,110,78,.45)';
    for (let z = 0; z <= h; z += 1.5) g.fillRect(0, z*u, w*u, Math.max(1,u*0.033));
    for (let x = 0; x <= w; x += 2.5) g.fillRect(x*u, 0, Math.max(1,u*0.033), h*u);
    for (let z = 0.7; z < h; z += 3){
      g.fillStyle='rgba(228,216,188,.5)'; g.fillRect(0, z*u, w*u, u*0.28);
      g.fillStyle='rgba(255,250,235,.22)'; g.fillRect(0, z*u, w*u, u*0.06); } } },

{ id:'lino', cost:700, base:'#9FAE86', alt:'#96A47E',
  n: L({ ko:'초록 리놀륨', en:'Green Linoleum', ja:'緑のリノリウム' }),
  note: L({ ko:'학교 복도 냄새.', en:'Smells like a school hallway.', ja:'学校の廊下のにおい。' }),
  paint(g,w,h,u){ g.fillStyle='#9FAE86'; g.fillRect(0,0,w*u,h*u); const q = rng(21), n = Math.round(w*h*130);
    for (let i = 0; i < n; i++){ g.fillStyle = q() > 0.5 ? 'rgba(240,244,220,.28)' : 'rgba(68,84,54,.22)';
      g.fillRect(q()*w*u, q()*h*u, u*0.045, u*0.045); } } },

{ id:'oak', cost:900, base:'#C79A6C', alt:'#B98C60',
  n: L({ ko:'원목 마루', en:'Oak Boards', ja:'オーク材の床' }),
  note: L({ ko:'여기서부터 집 냄새가 난다.', en:'From here on it smells like a home.', ja:'ここから家のにおいがする。' }),
  paint(g,w,h,u){ const q = rng(9), bh = 0.34;
    g.fillStyle='#9A7350'; g.fillRect(0,0,w*u,h*u);
    let row = 0;
    for (let y = 0; y < h; y += bh, row++){
      let x = -(row%3)*0.9;
      while (x < w){
        const len = 1.4+q()*1.7;
        g.fillStyle = shade('#C79A6C',(q()-0.5)*0.18); g.fillRect(x*u, y*u, len*u-1.6, bh*u-1.4);
        g.fillStyle='rgba(120,88,56,.3)';
        for (let k = 0; k < 3; k++) g.fillRect(x*u+u*0.12, y*u+bh*u*(0.26+k*0.24), len*u*(0.3+q()*0.5), 1);
        x += len; } } } },

{ id:'concrete', cost:1200, base:'#B4B0AA', alt:'#ACA8A2',
  n: L({ ko:'노출 콘크리트', en:'Bare Concrete', ja:'打ちっぱなし' }),
  note: L({ ko:'공사 중인 척.', en:'Pretending to be under construction.', ja:'工事中のふり。' }),
  paint(g,w,h,u){ g.fillStyle='#B4B0AA'; g.fillRect(0,0,w*u,h*u); const q = rng(13);
    for (let i = 0; i < Math.round(w*h*3.5); i++){ g.fillStyle = q() > 0.5 ? 'rgba(255,255,255,.055)' : 'rgba(68,66,62,.05)';
      g.beginPath(); g.arc(q()*w*u, q()*h*u, u*(0.3+q()*1.5), 0, 7); g.fill(); }
    for (let i = 0; i < Math.round(w*h*55); i++){ g.fillStyle='rgba(58,56,52,.06)'; g.fillRect(q()*w*u,q()*h*u,u*0.045,u*0.045); }
    g.fillStyle='rgba(78,76,72,.3)';
    for (let x = 0; x <= w; x += 3) g.fillRect(x*u,0,Math.max(1,u*0.033),h*u);
    for (let z = 0; z <= h; z += 3) g.fillRect(0,z*u,w*u,Math.max(1,u*0.033)); } },

/* 백룸의 나머지 절반. 축축한 베이지 카펫에 얼룩과 희미한 이음매 */
{ id:'dampcarpet', cost:1600, base:'#B9A87C', alt:'#B1A074',
  n: L({ ko:'축축한 카펫', en:'Damp Carpet', ja:'湿ったカーペット' }),
  note: L({ ko:'밟아도 소리가 안 난다.', en:'It makes no sound underfoot.', ja:'踏んでも音がしない。' }),
  paint(g,w,h,u){ g.fillStyle='#B9A87C'; g.fillRect(0,0,w*u,h*u); const q = rng(67);
    for (let i = 0; i < Math.round(w*h*4); i++){ g.fillStyle = q() > 0.55 ? 'rgba(150,132,86,.14)' : 'rgba(214,202,158,.12)';
      g.beginPath(); g.arc(q()*w*u, q()*h*u, u*(0.25+q()*1.3), 0, 7); g.fill(); }
    for (let i = 0; i < Math.round(w*h*150); i++){ g.fillStyle = q() > 0.5 ? 'rgba(224,212,170,.16)' : 'rgba(126,112,74,.14)';
      g.fillRect(q()*w*u, q()*h*u, u*0.06, u*0.03); }
    g.fillStyle='rgba(140,126,88,.22)';
    for (let x = 0; x <= w; x += 2) g.fillRect(x*u,0,Math.max(1,u*0.025),h*u);
    for (let z = 0; z <= h; z += 2) g.fillRect(0,z*u,w*u,Math.max(1,u*0.025)); } },

{ id:'checker', cost:1800, base:'#DCD5C6', alt:'#514C46',
  n: L({ ko:'흑백 체커', en:'Checkerboard', ja:'市松模様' }),
  note: L({ ko:'사무실이 갑자기 다이너가 된다.', en:'The office becomes a diner.', ja:'オフィスが急にダイナーになる。' }),
  paint(g,w,h,u){ const q = rng(23);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++){
      const d = (x+z)%2; g.fillStyle = d ? '#DCD5C6' : '#514C46'; g.fillRect(x*u,z*u,u+1,u+1);
      for (let i = 0; i < 26; i++){ g.fillStyle = d ? 'rgba(120,112,100,.10)' : 'rgba(220,214,200,.06)';
        g.fillRect(x*u+q()*u, z*u+q()*u, u*0.06, u*0.06); } } } },

{ id:'rugall', cost:2000, base:'#C59B95', alt:'#BC9289',
  n: L({ ko:'붉은 러그', en:'Red Rug', ja:'赤いラグ' }),
  note: L({ ko:'라운지를 방 전체로.', en:'The lounge, extended to the whole room.', ja:'ラウンジを部屋全体に。' }),
  paint(g,w,h,u){ g.fillStyle='#C59B95'; g.fillRect(0,0,w*u,h*u); const q = rng(17), n = Math.round(w*h*160);
    for (let i = 0; i < n; i++){ g.fillStyle = q() > 0.5 ? 'rgba(255,236,230,.10)' : 'rgba(118,76,72,.10)';
      g.fillRect(q()*w*u, q()*h*u, u*0.07, u*0.035); }
    g.strokeStyle='rgba(146,96,92,.55)'; g.lineWidth=u*0.1;
    g.strokeRect(u*0.55, u*0.55, w*u-u*1.1, h*u-u*1.1);
    g.strokeStyle='rgba(232,204,194,.3)'; g.lineWidth=u*0.03;
    g.strokeRect(u*0.75, u*0.75, w*u-u*1.5, h*u-u*1.5); } },

{ id:'tatami', cost:2600, base:'#B7B584', alt:'#6E6A50',
  n: L({ ko:'다다미', en:'Tatami', ja:'畳' }),
  note: L({ ko:'두 칸이 한 장이다.', en:'Two tiles make one mat.', ja:'二マスで一畳。' }),
  paint(g,w,h,u){ g.fillStyle='#6E6A50'; g.fillRect(0,0,w*u,h*u);
    const e = u*0.045;
    function mat(x,y,mw,mh,horiz){
      g.fillStyle='#B7B584'; g.fillRect(x+e,y+e,mw-e*2,mh-e*2);
      g.fillStyle='rgba(122,120,88,.32)';
      if (horiz){ for (let i = y+e*2; i < y+mh-e; i += u*0.06) g.fillRect(x+e*1.5,i,mw-e*3,1); }
      else { for (let i = x+e*2; i < x+mw-e; i += u*0.06) g.fillRect(i,y+e*1.5,1,mh-e*3); }
      g.fillStyle='#3E4436';
      if (horiz){ g.fillRect(x+e,y+e,mw-e*2,e*1.3); g.fillRect(x+e,y+mh-e*2.3,mw-e*2,e*1.3); }
      else { g.fillRect(x+e,y+e,e*1.3,mh-e*2); g.fillRect(x+mw-e*2.3,y+e,e*1.3,mh-e*2); }
    }
    for (let z = 0; z < h; z += 2) for (let x = 0; x < w; x += 2){
      if (((x/2)+(z/2))%2){ mat(x*u,z*u,2*u,u,true); mat(x*u,(z+1)*u,2*u,u,true); }
      else { mat(x*u,z*u,u,2*u,false); mat((x+1)*u,z*u,u,2*u,false); } } } },

{ id:'herring', cost:3000, base:'#8B6644', alt:'#7A5738',
  n: L({ ko:'헤링본', en:'Herringbone', ja:'ヘリンボーン' }),
  note: L({ ko:'어둡다. 밤에 검은 고양이가 사라지는지 볼 것.', en:'Dark. Check whether black cats vanish at night.', ja:'暗い。夜に黒猫が消えないか確認。' }),
  paint(g,w,h,u){ g.fillStyle='#5F4530'; g.fillRect(0,0,w*u,h*u);
    const q = rng(6), pl = u*0.62, pw = u*0.19, step = pl*0.7071;
    let col = 0;
    for (let x = -u*2; x < w*u+u*2; x += step, col++){
      const dir = (col%2) ? -1 : 1;
      for (let y = -u*3; y < h*u+u*3; y += pw*1.415){
        g.save(); g.translate(x, y + (col%2 ? step*0.5 : 0)); g.rotate(dir*Math.PI/4);
        g.fillStyle = shade('#8B6644',(q()-0.5)*0.2); g.fillRect(0,0,pl-2,pw-2);
        g.fillStyle='rgba(70,48,30,.18)';
        for (let k = 0; k < 2; k++) g.fillRect(pl*0.1, pw*(0.3+k*0.3), pl*0.7, 1);
        g.restore(); } } } },

{ id:'terrazzo', cost:4200, base:'#DAD3C6', alt:'#D2CBBE',
  n: L({ ko:'테라조', en:'Terrazzo', ja:'テラゾー' }),
  note: L({ ko:'요즘 카페 바닥.', en:'The floor every new cafe has.', ja:'いまどきのカフェの床。' }),
  paint(g,w,h,u){ g.fillStyle='#DAD3C6'; g.fillRect(0,0,w*u,h*u); const q = rng(29);
    const cols = ['#8E8477','#B2705F','#7E8E76','#C7B48A','#5B5A58'];
    const n = Math.round(w*h*150);
    for (let i = 0; i < n; i++){ g.save(); g.translate(q()*w*u, q()*h*u); g.rotate(q()*6.3);
      g.fillStyle = cols[(q()*cols.length)|0]; const s = u*(0.03+q()*0.07);
      g.fillRect(0,0,s,s*(0.45+q()*0.55)); g.restore(); } } },

{ id:'grass', cost:5000, base:'#6E9868', alt:'#658F60',
  n: L({ ko:'잔디', en:'Lawn', ja:'芝生' }),
  note: L({ ko:'실내에 왜.', en:'Indoors. Why.', ja:'屋内に、なぜ。' }),
  paint(g,w,h,u){ g.fillStyle='#6E9868'; g.fillRect(0,0,w*u,h*u); const q = rng(33);
    for (let i = 0; i < Math.round(w*h*3); i++){ g.fillStyle = q() > 0.5 ? 'rgba(150,190,140,.16)' : 'rgba(70,102,68,.16)';
      g.beginPath(); g.arc(q()*w*u,q()*h*u,u*(0.4+q()*1.6),0,7); g.fill(); }
    g.lineWidth = Math.max(1,u*0.03);
    const n = Math.round(w*h*260);
    for (let i = 0; i < n; i++){ const x = q()*w*u, y = q()*h*u, r = q();
      g.strokeStyle = r > 0.66 ? 'rgba(163,203,150,.95)' : r > 0.33 ? 'rgba(120,160,114,.95)' : 'rgba(80,112,76,.95)';
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+(q()-0.5)*u*0.1, y-u*(0.08+q()*0.12)); g.stroke(); } } },

/* ---------- 아홉 벌에 맞춘 바닥 넷 ----------
   이미 있는 것으로 되는 자리는 안 만들었다: 다크 우드는 「헤링본」, 모던 블랙&화이트는
   「흑백 체커」, 인더스트리얼은 「노출 콘크리트 바닥」, 소프트 카키는 「병원 리놀륨」이
   그대로 맞는다. 없던 넷만 만든다. */
{ id:'greytile', cost:1000, base:'#CACDCF', alt:'#BCBFC1',
  n: L({ ko:'회색 타일', en:'Grey Tile', ja:'グレータイル' }),
  note: L({ ko:'차가운 회색 가구가 서면 방이 한 덩어리가 된다.', en:'With the cool grey set the room becomes one block.', ja:'クールグレーの家具を置くと部屋がひと塊になる。' }),
  paint(g,w,h,u){ const q = rng(37);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++){
      g.fillStyle = ((x+z)%2) ? '#CFD2D4' : '#C2C5C7';
      g.fillRect(x*u, z*u, u+1, u+1);
      for (let i = 0; i < 30; i++){ g.fillStyle = 'rgba(150,154,156,.14)';
        g.fillRect(x*u+q()*u, z*u+q()*u, u*0.05, u*0.05); } }
    g.fillStyle = 'rgba(140,144,146,.55)';
    for (let x = 0; x <= w; x++) g.fillRect(x*u - 1, 0, 2, h*u);
    for (let z = 0; z <= h; z++) g.fillRect(0, z*u - 1, w*u, 2); } },

{ id:'pastelcheck', cost:1900, base:'#EDE6D8', alt:'#D9E3DC',
  n: L({ ko:'파스텔 체커', en:'Pastel Check', ja:'パステルチェック' }),
  note: L({ ko:'체커인데 안 시끄럽다. 두 색의 밝기가 거의 같아서.', en:'A check that stays quiet — the two tones sit at the same brightness.', ja:'チェックなのにうるさくない。二色の明るさがほぼ同じだから。' }),
  paint(g,w,h,u){ const q = rng(43);
    const c = ['#EFE8DA','#DCE6DF','#EFE8DA','#EADCDE'];
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++){
      g.fillStyle = c[(x + z*2) % c.length];
      g.fillRect(x*u, z*u, u+1, u+1);
      for (let i = 0; i < 26; i++){ g.fillStyle = 'rgba(190,180,168,.10)';
        g.fillRect(x*u+q()*u, z*u+q()*u, u*0.06, u*0.03); } }
    g.fillStyle = 'rgba(196,186,172,.35)';
    for (let x = 0; x <= w; x++) g.fillRect(x*u - 0.5, 0, 1, h*u);
    for (let z = 0; z <= h; z++) g.fillRect(0, z*u - 0.5, w*u, 1); } },

{ id:'bluetile', cost:2400, base:'#8FA2B1', alt:'#8195A5',
  n: L({ ko:'블루 그레이 타일', en:'Blue-Grey Tile', ja:'ブルーグレータイル' }),
  note: L({ ko:'바닥까지 같은 색이면 방이 아니라 하나의 물건이 된다.', en:'Same colour underfoot and the room stops being a room — it becomes an object.', ja:'床まで同じ色だと、部屋ではなくひとつの物になる。' }),
  paint(g,w,h,u){ const q = rng(61);
    /* 큰 판 — 한 칸에 두 줄. 작은 타일은 이 색에서 격자만 남는다 */
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++){
      for (let k = 0; k < 2; k++){
        g.fillStyle = ((x + z + k) % 2) ? '#95A8B7' : '#8798A8';
        g.fillRect(x*u, (z + k*0.5)*u, u+1, u*0.5+1);
      }
      for (let i = 0; i < 24; i++){ g.fillStyle = 'rgba(255,255,255,.07)';
        g.fillRect(x*u+q()*u, z*u+q()*u, u*0.07, u*0.02); } }
    g.fillStyle = 'rgba(120,134,146,.40)';
    for (let x = 0; x <= w; x++) g.fillRect(x*u - 0.5, 0, 1, h*u);
    for (let z = 0; z <= h*2; z++) g.fillRect(0, z*u*0.5 - 0.5, w*u, 1); } },

{ id:'ivorylino', cost:2800, base:'#E2D9B6', alt:'#D5CBA4',
  n: L({ ko:'아이보리 리놀륨', en:'Ivory Lino', ja:'アイボリーリノリウム' }),
  note: L({ ko:'민트 가구 밑에 깔면 그때가 1970년이다.', en:'Put mint furniture on it and it is 1970 again.', ja:'ミントの家具を置けば、そこは1970年だ。' }),
  paint(g,w,h,u){ const q = rng(29), W = w*u, H = h*u;
    for (let i = 0; i < w*h*420; i++){
      const x = q()*W, y = q()*H, s = u*(0.012+q()*0.026);
      g.fillStyle = q() > 0.6 ? 'rgba(178,166,134,.22)'
                  : q() > 0.3 ? 'rgba(246,240,222,.26)' : 'rgba(150,158,132,.14)';
      g.fillRect(x, y, s, s*0.62);
    }
    /* 장판 이음매 — 두 칸에 한 줄. 리놀륨은 롤로 깐다 */
    g.fillStyle = 'rgba(160,150,120,.30)';
    for (let x = 2; x <= w; x += 2) g.fillRect(x*u - 0.5, 0, 1.5, H); } },

{ id:'first', cost:-1, base:'#C3B394', alt:'#B4A385',
  n: L({ ko:'첫 사무실 바닥', en:'The First Office Floor', ja:'最初の事務所の床' }),
  note: L({ ko:'잠긴 방의 그 바닥. 책상 자국이 남아 있다.', en:'The floor from the locked room. The desk left a mark.', ja:'鍵の部屋のあの床。机の跡が残っている。' }),
  paint(g,w,h,u){ const q = rng(53);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++){
      g.fillStyle = ((x+z)%2) ? '#C3B394' : '#B4A385'; g.fillRect(x*u,z*u,u+1,u+1); }
    for (let i = 0; i < Math.round(w*h*130); i++){ g.fillStyle='rgba(220,206,178,.12)'; g.fillRect(q()*w*u,q()*h*u,u*0.06,u*0.06); }
    for (let i = 0; i < Math.round(w*h*1.7); i++){ g.fillStyle='rgba(150,128,96,.10)';
      g.beginPath(); g.arc(q()*w*u,q()*h*u,u*(0.3+q()*1.2),0,7); g.fill(); }
    /* 오래 밟은 길 — 문에서 방 안쪽으로. 문은 아래쪽 가운데다 */
    const cx = w*u/2, gr = g.createLinearGradient(cx-u*1.3,0,cx+u*1.3,0);
    gr.addColorStop(0,'rgba(236,228,206,0)'); gr.addColorStop(0.5,'rgba(238,230,208,.5)'); gr.addColorStop(1,'rgba(236,228,206,0)');
    g.fillStyle = gr; g.fillRect(cx-u*1.3,0,u*2.6,h*u);
    /* 책상과 의자가 있던 자리. 격자에 박아 두어야 방을 다시 그려도 같은 데 남는다 */
    g.fillStyle='rgba(104,88,66,.3)';  g.fillRect(u*2.1, u*(h*0.42), u*2.4, u*1.35);
    g.fillStyle='rgba(104,88,66,.3)';  g.fillRect(u*2.5, u*(h*0.42)+u*1.4, u*0.8, u*0.8);
    g.fillStyle='rgba(126,108,84,.26)'; g.fillRect(u*(w-2.6), u*1.4, u*0.9, u*0.9); } }
];

/* ============================================================
   러그 — 낱개로 깔 수 있는 물건 (TODO 49)

   벽지·바닥과 **다른 종류**다. 그 둘은 방 전체를 한 장으로 덮지만 러그는 소파 앞
   한 장이고, 여러 장을 동시에 깔 수 있고, **놓인 자리가 있다.**

   그래서 러그는 격자에 안 들어간다. 지금 격자에서 가구가 있는 칸은 못 걷는 칸인데
   (WALKABLE 은 바닥과 문뿐), 러그를 타일로 만들면 고양이가 러그를 피해 돌아간다.
   벽에 거는 것들이 wallDecor 목록으로만 사는 것과 정확히 같은 이유로
   러그는 W.rugs 목록으로 산다 — 길찾기가 한 줄도 안 흔들린다.

   w·h 는 칸 수다. rot 이 홀수면 가로세로가 바뀐다 — 아무 칸도 안 막으므로
   **회전에 검증이 없다**(1번이 두 칸짜리 회전을 자른 이유가 여기서는 안 생긴다).
   round 는 원형. 3D 에서 원기둥으로 서고 무늬는 그 정사각형 캔버스가 잘려 들어간다.
   ============================================================ */
const RUGS = [
{ id:'rugmat', cost:260, w:2, h:1, base:'#4E4A46',
  n: L({ ko:'현관 매트', en:'Door Mat', ja:'玄関マット' }),
  note: L({ ko:'문 앞에 두면 사무실이 시작된다.', en:'Put it at the door and the office begins.', ja:'ドアの前に置くとオフィスが始まる。' }),
  paint(g,w,h,u){
    g.fillStyle = '#4E4A46'; g.fillRect(0,0,w*u,h*u);
    const q = rng(41);
    for (let i = 0; i < w*h*900; i++){                       // 거친 코이어 결
      g.fillStyle = q() > 0.5 ? 'rgba(120,112,102,.30)' : 'rgba(28,26,24,.34)';
      g.fillRect(q()*w*u, q()*h*u, u*0.05, u*0.014);
    }
    g.strokeStyle = '#6E675E'; g.lineWidth = u*0.055;
    g.strokeRect(u*0.09, u*0.09, w*u-u*0.18, h*u-u*0.18);
  } },

{ id:'rugstripe', cost:780, w:3, h:2, base:'#D9CFBC',
  n: L({ ko:'줄무늬 러그', en:'Striped Rug', ja:'ストライプのラグ' }),
  note: L({ ko:'싼데 방이 정리돼 보인다.', en:'Cheap, and the room looks tidier.', ja:'安いのに部屋が片づいて見える。' }),
  paint(g,w,h,u){
    g.fillStyle = '#D9CFBC'; g.fillRect(0,0,w*u,h*u);
    const col = ['#8FA79C','#D9CFBC','#C2B59E','#D9CFBC'];
    for (let i = 0, y = 0; y < h; y += 0.22, i++){
      g.fillStyle = col[i % col.length];
      g.fillRect(0, y*u, w*u, u*0.22 + 1);
    }
    /* 술 — 짧은 변 양쪽. 이게 없으면 그냥 색칠한 바닥이다 */
    g.fillStyle = '#EDE6D6';
    for (let x = 0.06; x < w; x += 0.10){
      g.fillRect(x*u, 0, u*0.035, u*0.10);
      g.fillRect(x*u, h*u - u*0.10, u*0.035, u*0.10);
    }
  } },

{ id:'ruground', cost:1100, w:2, h:2, round:true, base:'#9FBBB2',
  n: L({ ko:'동그란 러그', en:'Round Rug', ja:'丸いラグ' }),
  note: L({ ko:'고양이는 동그란 것 위에 앉는다.', en:'Cats sit on round things.', ja:'猫は丸いものの上に座る。' }),
  paint(g,w,h,u){
    const cx = w*u/2, cy = h*u/2, R = Math.min(w,h)*u/2;
    const ring = ['#9FBBB2','#B6CCC3','#8AAAA0','#C6D8D0'];
    for (let i = 0; i < 9; i++){
      g.fillStyle = ring[i % ring.length];
      g.beginPath(); g.arc(cx, cy, R*(1 - i/9), 0, 7); g.fill();
    }
    const q = rng(19);
    for (let i = 0; i < w*h*700; i++){
      g.fillStyle = q() > 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(70,96,88,.10)';
      g.fillRect(q()*w*u, q()*h*u, u*0.045, u*0.02);
    }
  } },

{ id:'rugpaw', cost:1500, w:2, h:2, base:'#C9A96E',
  n: L({ ko:'발자국 러그', en:'Paw-print Rug', ja:'足あとのラグ' }),
  note: L({ ko:'누가 밟고 지나간 자국이 아니라 무늬다. 아마도.', en:'It is a pattern, not actual prints. Probably.', ja:'踏んだ跡ではなく模様だ。たぶん。' }),
  paint(g,w,h,u){
    g.fillStyle = '#C9A96E'; g.fillRect(0,0,w*u,h*u);
    g.fillStyle = '#BC9C61'; g.fillRect(0,0,w*u,h*u*0.5);
    const paw = (x,y,r,a) => {
      g.save(); g.translate(x,y); g.rotate(a);
      g.fillStyle = 'rgba(88,66,44,.55)';
      g.beginPath(); g.ellipse(0,0,r*0.62,r*0.50,0,0,7); g.fill();
      for (const [dx,dy,s] of [[-0.62,-0.66,0.30],[-0.20,-0.86,0.32],[0.24,-0.84,0.32],[0.64,-0.60,0.28]]){
        g.beginPath(); g.ellipse(dx*r, dy*r, r*s, r*s*0.86, 0, 0, 7); g.fill();
      }
      g.restore();
    };
    const q = rng(29);
    for (let j = 0; j < h*3; j++)
      for (let i = 0; i < w*3; i++)
        paw((i + 0.5 + (j%2?0.5:0)) * u/3 + u*0.1, (j + 0.55) * u/3, u*0.12, q()*0.8 - 0.4);
    g.strokeStyle = 'rgba(96,72,48,.5)'; g.lineWidth = u*0.06;
    g.strokeRect(u*0.12, u*0.12, w*u-u*0.24, h*u-u*0.24);
  } },

{ id:'rugshag', cost:1700, w:3, h:3, base:'#DED5C4',
  n: L({ ko:'털 러그', en:'Shag Rug', ja:'シャギーラグ' }),
  note: L({ ko:'털이 빠진 건지 원래 그런 건지 모른다.', en:'Shedding, or is it just like that?', ja:'抜け毛か元からか分からない。' }),
  paint(g,w,h,u){
    g.fillStyle = '#DED5C4'; g.fillRect(0,0,w*u,h*u);
    const q = rng(13);
    for (let i = 0; i < w*h*2200; i++){
      const x = q()*w*u, y = q()*h*u, a = q()*6.3, l = u*(0.03 + q()*0.05);
      g.strokeStyle = q() > 0.5 ? 'rgba(255,252,244,.42)' : 'rgba(170,158,138,.30)';
      g.lineWidth = u*0.012;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x + Math.cos(a)*l, y + Math.sin(a)*l); g.stroke();
    }
  } },

{ id:'rugpersian', cost:2900, w:4, h:3, base:'#8E3A34',
  n: L({ ko:'페르시안 러그', en:'Persian Rug', ja:'ペルシャ絨毯' }),
  note: L({ ko:'대표실에 깔 물건인데 대표실이 없다.', en:'Belongs in the CEO office. There is no CEO office.', ja:'社長室に敷くものだが、社長室がない。' }),
  paint(g,w,h,u){
    const W = w*u, H = h*u;
    g.fillStyle = '#8E3A34'; g.fillRect(0,0,W,H);
    g.strokeStyle = '#D8B45E'; g.lineWidth = u*0.10;
    g.strokeRect(u*0.16, u*0.16, W-u*0.32, H-u*0.32);
    g.strokeStyle = '#2F4F52'; g.lineWidth = u*0.20;
    g.strokeRect(u*0.42, u*0.42, W-u*0.84, H-u*0.84);
    g.strokeStyle = '#D8B45E'; g.lineWidth = u*0.05;
    g.strokeRect(u*0.62, u*0.62, W-u*1.24, H-u*1.24);
    /* 가운데 메달리온 — 열여섯 갈래 별을 네 겹 겹친다 */
    g.save(); g.translate(W/2, H/2);
    for (const [r, c] of [[0.98,'#2F4F52'],[0.80,'#D8B45E'],[0.62,'#8E3A34'],[0.36,'#D8B45E']]){
      g.fillStyle = c; g.beginPath();
      for (let i = 0; i < 16; i++){
        const a = i / 16 * Math.PI * 2, rr = u * r * (i % 2 ? 0.62 : 1);
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a)*rr*1.35, Math.sin(a)*rr);
      }
      g.closePath(); g.fill();
    }
    g.restore();
    const q = rng(7);
    g.fillStyle = 'rgba(216,180,94,.55)';
    for (let i = 0; i < 90; i++){
      const x = u*0.75 + q()*(W-u*1.5), y = u*0.75 + q()*(H-u*1.5);
      if (Math.hypot((x-W/2)/1.35, y-H/2) < u*1.1) continue;
      g.fillRect(x, y, u*0.05, u*0.05);
    }
    g.fillStyle = '#E8DCC0';
    for (let y = 0.1; y < h; y += 0.10){
      g.fillRect(0, y*u, u*0.09, u*0.035);
      g.fillRect(W - u*0.09, y*u, u*0.09, u*0.035);
    }
  } },
];

/* ============================================================
   가구 톤 — 34번의 뒷 절반

   벽지·바닥과 달리 여기는 **캔버스가 아니라 색이다.** 모든 가구가 PAL.wood ·
   PAL.metal · PAL.fabric 같은 **역할 이름**으로 색을 집으므로(lowpoly.js),
   표를 한 벌 더 만들면 사무실 한 채가 바뀐다 — 가구마다 색을 고르게 만들 이유가 없다.
   34번 설계가 처음부터 이렇게 적혀 있었고, 그 앞 절반(벽지·바닥)만 무늬로 뒤집혔다.
   여기는 뒤집을 이유가 없다 — 고르고 싶은 것이 실제로 색이기 때문이다
   (줄무늬 소파를 고르고 싶은 사람은 없다. 흰 소파를 고르고 싶은 것이다).

   ── 벌은 아홉이다 ──

   레퍼런스 아홉 장에서 그대로 옮겼다. **색상환은 안 연다** — 아홉은 만든 것이지
   만들게 하는 것이 아니다(7번의 그 판단).

   ── 무엇이 바뀌고 무엇이 안 바뀌나 ──

   바뀌는 것은 **일곱 칸뿐**이다: wood · woodDark · metal · metalDark · fabric ·
   fabric2 · pot. 이 일곱이 사무실의 가구를 거의 다 칠한다(lowpoly.js 에서
   metalDark 64회 · wood 36 · fabric2 30 · woodDark 29 · fabric 21 · metal 19 · pot 9).

   **안 바뀌는 것이 더 중요하다:**
     · **고양이** — 털색은 cats.js 가 정하고 render3d 의 FUR_BASE 가 칠한다.
       이 표와 아무 관계가 없다. 벌을 갈았는데 검은 고양이가 회색이 되면 그건
       인테리어가 아니라 직원이 바뀐 것이다
     · **잎** leaf · leafDark · catnip — 화분은 벌과 무관하게 초록이다
     · **장난감** toy — 빨간 털뭉치는 회색 사무실의 유일한 색이다(lowpoly.js PAL.toy)
     · **종이·잉크·화면·빛** paper · ink · screen · glow · sky
     · **벽지·바닥** wall · floor — 그건 위의 두 목록이 정한다.
       시간대 표(TIME)도 안 건드린다: 벌은 물건의 색이고 시간대는 빛이다
   ============================================================ */
const TONES = [
/* 1 — 기본이자 「우드 & 베이지」. 값이 0 이라 처음부터 갖고 있다.
   레퍼런스 두 번째 장이 이 사무실이다: 따뜻한 원목 책상, 베이지 수납, 차분한 천. */
{ id:'tone_std', cost:0, pair:{ wall:'plain', floor:'carpet' }, chips:['#C08A55','#8B5E3C','#A8AFBA','#6C7FB8','#C2705F'],
  n: L({ ko:'우드 & 베이지', en:'Wood & Beige', ja:'ウッド＆ベージュ' }),
  note: L({ ko:'처음부터 있던 가구. 원목과 베이지로 안정감 있게.',
            en:'The furniture that was always here — warm wood and beige.',
            ja:'最初からあった家具。原木とベージュで落ち着いて。' }),
  pal:{ wood:0xC08A55, woodDark:0x8B5E3C, metal:0xA8AFBA, metalDark:0x6E7684,
        fabric:0x6C7FB8, fabric2:0xC2705F, pot:0xC4795A } },

{ id:'tone_cool', cost:1400, pair:{ wall:'coolgrey', floor:'greytile' }, chips:['#D4D8DC','#C2C6CA','#8E9298','#929BA4','#717A82'],
  n: L({ ko:'차가운 회색', en:'Cool Grey', ja:'クールグレー' }),
  note: L({ ko:'모노톤의 회색과 낮은 채도의 블루로 차갑고 정적인 분위기.',
            en:'Monotone greys and low-saturation blue — cold and still.',
            ja:'モノトーンのグレーと低彩度のブルーで、冷たく静かに。' }),
  pal:{ wood:0xC2C6CA, woodDark:0x8E9298, metal:0xD4D8DC, metalDark:0x7C8288,
        fabric:0x929BA4, fabric2:0x717A82, pot:0xA0A5AA } },

{ id:'tone_darkwood', cost:2200, pair:{ wall:'panel', floor:'herring' }, chips:['#543826','#8A5F3C','#B98F63','#7A5A42','#8E8578'],
  n: L({ ko:'다크 우드 & 브라운', en:'Dark Wood & Brown', ja:'ダークウッド＆ブラウン' }),
  note: L({ ko:'짙은 목재와 브라운 계열로 묵직하고 올드한 분위기.',
            en:'Dark timber and browns — heavy, and old.',
            ja:'濃い木材とブラウン系で、重く古めかしく。' }),
  pal:{ wood:0x8A5F3C, woodDark:0x543826, metal:0x8E8578, metalDark:0x5A5348,
        fabric:0x7A5A42, fabric2:0x9A6B4E, pot:0x7B5B44 } },

{ id:'tone_pastel', cost:2800, pair:{ wall:'cream', floor:'pastelcheck' }, chips:['#F2E7D0','#DCCBAC','#A8DACA','#F0AEB6','#EFC7A0'],
  n: L({ ko:'파스텔 톤 라이트', en:'Pastel Light', ja:'パステルライト' }),
  note: L({ ko:'연한 파스텔 가구톤과 화이트의 조합으로 담담하고 소프트한 분위기.',
            en:'Pale pastels against white — plain and soft.',
            ja:'淡いパステルとホワイトで、あっさりと柔らかく。' }),
  pal:{ wood:0xF2E7D0, woodDark:0xDCCBAC, metal:0xEDEAE4, metalDark:0xBEB9B0,
        fabric:0xA8DACA, fabric2:0xF0AEB6, pot:0xEFC7A0 } },

{ id:'tone_bluegrey', cost:3200, pair:{ wall:'bluegrey', floor:'bluetile' }, chips:['#9CADBC','#7E93A6','#5E7488','#51647A','#415466'],
  n: L({ ko:'블루 그레이', en:'Blue Grey', ja:'ブルーグレー' }),
  note: L({ ko:'블루 그레이 톤의 가구로 차분하고 집중되는 분위기.',
            en:'Blue-grey furniture — calm, and easy to focus in.',
            ja:'ブルーグレーの家具で、落ち着いて集中できる雰囲気。' }),
  pal:{ wood:0x7E93A6, woodDark:0x51647A, metal:0x9CADBC, metalDark:0x4A5C70,
        fabric:0x5E7488, fabric2:0x415466, pot:0x6B8094 } },

{ id:'tone_mint', cost:3600, pair:{ wall:'grid', floor:'ivorylino' }, chips:['#86AE81','#DBD1A6','#C4A263','#93AD86','#66795C'],
  n: L({ ko:'빈티지 민트', en:'Vintage Mint', ja:'ヴィンテージミント' }),
  note: L({ ko:'낡은 듯한 민트와 아이보리 조합으로 레트로하고 독특한 분위기.',
            en:'Faded mint with ivory — retro, and a little odd.',
            ja:'くすんだミントとアイボリーで、レトロで独特に。' }),
  pal:{ wood:0xDBD1A6, woodDark:0xA79A63, metal:0xAEC3A2, metalDark:0x66795C,
        fabric:0x86AE81, fabric2:0xC4A263, pot:0x93AD86 } },

{ id:'tone_mono', cost:4200, pair:{ wall:'whitepaint', floor:'checker' }, chips:['#141416','#27272A','#3C3C3E','#DADADA','#EDEDED'],
  n: L({ ko:'모던 블랙 & 화이트', en:'Modern Black & White', ja:'モダンブラック＆ホワイト' }),
  note: L({ ko:'블랙과 화이트의 대비로 도시적이고 미니멀한 분위기.',
            en:'Black against white — urban, minimal.',
            ja:'黒と白の対比で、都会的でミニマルに。' }),
  pal:{ wood:0x27272A, woodDark:0x141416, metal:0xEDEDED, metalDark:0x3C3C3E,
        fabric:0x303032, fabric2:0xDADADA, pot:0x323234 } },

{ id:'tone_khaki', cost:4600, pair:{ wall:'khakiwall', floor:'lino' }, chips:['#BCA968','#7C8C4E','#5F5D42','#A37E42','#7E9058'],
  n: L({ ko:'소프트 카키', en:'Soft Khaki', ja:'ソフトカーキ' }),
  note: L({ ko:'카키와 브라운의 자연스러운 조합으로 차분하고 내추럴한 분위기.',
            en:'Khaki and brown, side by side — calm and natural.',
            ja:'カーキとブラウンの自然な組み合わせで、落ち着いてナチュラルに。' }),
  pal:{ wood:0xBCA968, woodDark:0x82703F, metal:0xA3A184, metalDark:0x5F5D42,
        fabric:0x7C8C4E, fabric2:0xA37E42, pot:0x7E9058 } },

{ id:'tone_industrial', cost:5200, pair:{ wall:'rawconcrete', floor:'concrete' }, chips:['#A6ACAE','#82847F','#545650','#43484A','#646A6C'],
  n: L({ ko:'인더스트리얼 그레이', en:'Industrial Grey', ja:'インダストリアルグレー' }),
  note: L({ ko:'메탈릭한 회색 가구와 콘크리트 톤으로 차가우면서 거친 분위기.',
            en:'Metallic grey and concrete — cold, and rough with it.',
            ja:'メタリックなグレーとコンクリートで、冷たく荒く。' }),
  pal:{ wood:0x82847F, woodDark:0x545650, metal:0xA6ACAE, metalDark:0x43484A,
        fabric:0x646A6C, fabric2:0x757B7E, pot:0x6A6E6C } },
];

const wallById = {}, floorById = {}, rugById = {}, toneById = {};
WALLS.forEach(w => wallById[w.id] = w);
FLOORS.forEach(f => floorById[f.id] = f);
RUGS.forEach(r => rugById[r.id] = r);
TONES.forEach(t => toneById[t.id] = t);
/* id 는 **네 목록을 합쳐** 유일해야 한다. kindOf 가 벽지부터 차례로 보므로 겹치면
   뒤에 오는 쪽이 고를 수도 살 수도 없는 유령이 된다 — 화면에는 있고 눌러도 벽지가 바뀐다.
   한 번 실제로 그랬다(백룸 벽지와 축축한 카펫이 둘 다 'backroom' 이었다).
   러그·톤을 붙이면서 목록이 둘에서 넷이 됐으니 검사도 같이 넓힌다. */
(function idClash(){
  const seen = {};
  for (const [kind, list] of [['wall',WALLS],['floor',FLOORS],['rug',RUGS],['tone',TONES]])
    for (const it of list){
      if (seen[it.id]) console.error('decor: id 충돌 —', it.id, seen[it.id], '↔', kind);
      seen[it.id] = kind;
    }
})();

/* ---------- 고른 것 ----------
   실제 값은 저장(S.decor)에 있고 여기 사본을 둔다. game.js 가 불러올 때 sync 한다.
   러그는 여기 없다 — 한 장을 고르는 게 아니라 여러 장이 **자리를 갖고** 깔리므로
   월드(W.rugs)에 산다. 이 표는 「방 전체가 한 벌인 것」만 들고 있다. */
let CUR = { wall:'plain', floor:'carpet', tone:'tone_std' };
const listeners = [];

function setCur(wall, floor, tone, quiet){
  const w = wallById[wall] ? wall : CUR.wall;
  const f = floorById[floor] ? floor : CUR.floor;
  const t = toneById[tone] ? tone : CUR.tone;
  if (w === CUR.wall && f === CUR.floor && t === CUR.tone) return false;
  CUR = { wall:w, floor:f, tone:t };
  if (!quiet) listeners.forEach(fn => { try { fn(CUR); } catch(e){} });
  return true;
}

/* ---------- 캔버스 굽기 ----------
   키에 크기까지 넣는다. 사무실을 넓히면(이사) 벽 길이가 바뀌므로 다시 구워야 한다. */
const _cv = new Map();
function cached(key, make){
  let c = _cv.get(key);
  if (!c){ c = make(); _cv.set(key, c); }
  return c;
}
function clearCache(){ _cv.clear(); }

/* 벽 한 덩어리. dado(허리 아래 색)는 몰딩 높이에 맞춰 자른다 —
   3D 는 그 높이에 상자를 하나 두르고 있으므로 경계가 몰딩 뒤로 숨는다. */
function wallCanvas(id, wUnits, hUnits, ppu, opt){
  opt = opt || {};
  const dadoH = opt.dadoH != null ? opt.dadoH : 0.95;
  const key = `w|${id}|${wUnits.toFixed(2)}|${hUnits.toFixed(2)}|${ppu}|${dadoH}|${opt.trim?1:0}`;
  return cached(key, () => {
    const it = wallById[id] || wallById.plain;
    const c = mkc(wUnits*ppu, hUnits*ppu), g = c.getContext('2d');
    g.fillStyle = it.base; g.fillRect(0,0,c.width,c.height);
    if (it.dado && dadoH > 0.01){ g.fillStyle = it.dado; g.fillRect(0, c.height - dadoH*ppu, c.width, dadoH*ppu + 1); }
    if (it.paint) it.paint(g, wUnits, hUnits, ppu);
    /* 도트판은 몰딩이 따로 없다. 그림 안에 그려 넣는다 */
    if (opt.trim){
      g.fillStyle = it.trim;
      g.fillRect(0, c.height - Math.max(2,ppu*0.13), c.width, Math.max(2,ppu*0.13));
      g.fillRect(0, c.height - dadoH*ppu - Math.max(1,ppu*0.05), c.width, Math.max(2,ppu*0.075));
    }
    return c;
  });
}

function floorCanvas(id, wUnits, hUnits, ppu){
  const key = `f|${id}|${wUnits}|${hUnits}|${ppu}`;
  return cached(key, () => {
    const it = floorById[id] || floorById.carpet;
    const c = mkc(wUnits*ppu, hUnits*ppu), g = c.getContext('2d');
    g.fillStyle = it.base; g.fillRect(0,0,c.width,c.height);
    if (it.paint) it.paint(g, wUnits, hUnits, ppu);
    return c;
  });
}

/* 러그 한 장. 바닥과 같은 규약(1 = 한 칸)이고, 원형은 정사각 캔버스를 굽고
   3D 쪽 원기둥이 그걸 동그랗게 잘라 쓴다 — 여기서 알파를 쓰지 않는 이유다
   (투명한 판은 그림자·정렬에서 늘 한 가지씩 더 챙겨야 한다). */
function rugCanvas(id, ppu){
  const it = rugById[id];
  if (!it) return null;
  return cached(`r|${id}|${ppu}`, () => {
    const c = mkc(it.w*ppu, it.h*ppu), g = c.getContext('2d');
    g.fillStyle = it.base; g.fillRect(0,0,c.width,c.height);
    if (it.paint) it.paint(g, it.w, it.h, ppu);
    return c;
  });
}
/* 러그가 놓인 발자국 — rot 이 홀수면 가로세로가 바뀐다. 아무 칸도 안 막으므로
   이 값을 읽는 곳은 그리는 쪽과 배치 모드뿐이고, 길찾기는 이 함수를 모른다. */
function rugSize(r){
  const it = rugById[r && r.id];
  if (!it) return { w:1, h:1 };
  return ((r.rot | 0) % 2) ? { w:it.h, h:it.w } : { w:it.w, h:it.h };
}

/* 팔레트 한 겹. 텍스처를 못 쓰는 자리(액자 테두리·콘센트 등)가 이걸 읽는다 —
   벽지를 갈았는데 그 자리들만 옛 색이면 방이 두 장으로 갈린다.
   그리고 **가구 톤도 여기로 나간다**: 가구는 전부 PAL 의 역할 이름으로 색을 집으므로
   (lowpoly.js) 이 표에 여섯 칸을 얹으면 사무실 한 채가 바뀐다. */
function pal(){
  const w = wallById[CUR.wall] || wallById.plain;
  const f = floorById[CUR.floor] || floorById.carpet;
  const t = toneById[CUR.tone] || toneById.tone_std;
  return {
    floor: num(f.base), floorAlt: num(f.alt || f.base), lounge: num(f.alt || f.base),
    wall: num(w.base), wallTrim: num(w.trim),
    /* 기본 벌도 값을 **반드시** 실어 보낸다. setPalette 는 덮어쓰기만 하므로
       빼 두면 우드톤에서 사무용으로 되돌렸을 때 옛 색이 그대로 남는다. */
    ...t.pal,
  };
}

window.DECOR = {
  WALLS, FLOORS, RUGS, TONES, wallById, floorById, rugById, toneById,
  BINDER_COST: 480,
  cur(){ return CUR; },
  wall(){ return wallById[CUR.wall] || wallById.plain; },
  floor(){ return floorById[CUR.floor] || floorById.carpet; },
  tone(){ return toneById[CUR.tone] || toneById.tone_std; },
  byId(id){ return wallById[id] || floorById[id] || rugById[id] || toneById[id] || null; },
  kindOf(id){ return wallById[id] ? 'wall' : floorById[id] ? 'floor'
                   : rugById[id] ? 'rug' : toneById[id] ? 'tone' : null; },
  set: setCur,
  onChange(fn){ listeners.push(fn); },
  wallCanvas, floorCanvas, rugCanvas, rugSize, clearCache, pal,
  /* 견본에 쓰는 작은 그림 — 화면에서 고를 때 실물을 보여 준다.
     견본책 UI 와 3D 렌더러가 같은 그림 함수를 쓰므로 「산 것과 다른 게 온다」가 없다. */
  swatch, rugSwatch, toneSwatch,
};

/* ---------- 견본 한 장 ----------
   방 하나를 원근으로 그린다. 뒷벽 + 옆벽 + 바닥 + 몰딩. 도배 견본책이 쓴다. */
function swatch(cv, wallId, floorId, opt){
  opt = opt || {};
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  const wi = wallById[wallId] || wallById.plain, fi = floorById[floorId] || floorById.carpet;
  const ZN = opt.low ? 1.45 : 2.4, ZF = 8, FOV = 0.9, RW = 3, HZ = H*0.389;
  const C = ZN*(H-HZ);
  const yOf = Z => HZ + C/Z, sOf = Z => W/(Z*FOV), xOf = (x,Z) => W/2 + x*sOf(Z);
  const yBack = yOf(ZF), sBack = sOf(ZF), wallH = 1.9*sBack, yTop = yBack - wallH;
  const xBL = xOf(-RW,ZF), xBR = xOf(RW,ZF);
  const sNear = sOf(ZN), yNb = yOf(ZN), xNL = xOf(-RW,ZN), xNR = xOf(RW,ZN);
  const yNt = yNb - 1.9*sNear;
  const poly = pts => { g.beginPath(); g.moveTo(pts[0][0],pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0],pts[i][1]); g.closePath(); g.fill(); };

  g.clearRect(0,0,W,H);
  g.fillStyle = opt.bg || '#A99C8B'; g.fillRect(0,0,W,H);
  g.fillStyle = shade(wi.base,-0.15); poly([[xNL,yNt],[xBL,yTop],[xBL,yBack+1],[xNL,yNb+2]]);
  g.fillStyle = shade(wi.base, 0.06); poly([[xNR,yNt],[xBR,yTop],[xBR,yBack+1],[xNR,yNb+2]]);

  /* 뒷벽 — 굽는 게 아니라 바로 그린다. 견본은 크기가 매번 달라서 캐시가 안 먹는다 */
  g.save(); g.beginPath(); g.rect(xBL,yTop,xBR-xBL,wallH+1); g.clip();
  g.translate(xBL, yTop);
  const wu = (xBR-xBL)/sBack;                  // 뒷벽이 몇 칸인가
  g.fillStyle = wi.base; g.fillRect(0,0,xBR-xBL,wallH+1);
  if (wi.dado){ g.fillStyle = wi.dado; g.fillRect(0, wallH*0.516, xBR-xBL, wallH*0.484+1); }
  if (wi.paint) wi.paint(g, wu, 1.9, sBack);
  g.restore();

  /* 바닥 — 방 하나를 굽고 한 줄씩 원근으로 긁어 온다 */
  const FU = 32, FW = 8, FT = 12;
  const tex = floorCanvas(floorId, FW, FT, FU);
  for (let y = Math.floor(yBack); y < H; y++){
    const Z = C/(y-HZ);
    if (Z > FT-0.2) continue;
    const hw = RW*sOf(Z);
    g.drawImage(tex, (FW/2-RW)*FU, (FT-Z)*FU, RW*2*FU, 1, W/2-hw, y, hw*2, 1.02);
  }

  const band = (h0,h1,c) => {
    g.fillStyle = c; g.fillRect(xBL, yBack-h1*sBack, xBR-xBL, (h1-h0)*sBack);
    g.fillStyle = shade(c,-0.15);
    poly([[xBL,yBack-h1*sBack],[xNL,yNb-h1*sNear],[xNL,yNb-h0*sNear],[xBL,yBack-h0*sBack]]);
    g.fillStyle = shade(c,0.06);
    poly([[xBR,yBack-h1*sBack],[xNR,yNb-h1*sNear],[xNR,yNb-h0*sNear],[xBR,yBack-h0*sBack]]);
  };
  band(0,0.13, wi.trim); band(0.92,0.995, wi.trim);

  /* 시간대 한 겹. 밝은 벌에서 검은 고양이가 살고 어두운 벌에서 실루엣이 죽는다 —
     그래서 견본은 낮으로만 보여 주지 않는다(호출부가 tint 를 준다) */
  if (opt.tint){
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = opt.tint; g.fillRect(0,0,W,H);
    g.globalCompositeOperation = 'source-over';
  }
  const vg = g.createRadialGradient(W/2,H*0.45,W*0.22,W/2,H*0.5,W*0.72);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(20,16,12,.3)');
  g.fillStyle = vg; g.fillRect(0,0,W,H);
}


/* ---------- 러그 견본 ----------
   방을 원근으로 그리지 않는다. 러그는 **위에서 보는 물건**이고, 고르는 사람이 알고
   싶은 것은 「무늬가 뭔가 · 몇 칸인가」 둘이다. 지금 깔린 바닥 위에 얹어서
   보여 주므로 대비가 어떻게 되는지도 같이 온다 — 밝은 바닥 위의 밝은 러그는
   사고 나서야 안 보인다는 걸 알게 되는 물건이다. */
function rugSwatch(cv, rugId, opt){
  opt = opt || {};
  const it = rugById[rugId];
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  g.clearRect(0,0,W,H);
  if (!it) return;

  /* 바닥 — 지금 방에 깔린 것. 칸 격자가 보여야 러그가 몇 칸인지 읽힌다 */
  const cols = Math.max(it.w, it.h) + 2;
  const u = Math.min(W / cols, H / cols);
  const ft = floorCanvas(CUR.floor, cols, cols, 48);
  g.save();
  g.translate(W/2 - cols*u/2, H/2 - cols*u/2);
  g.drawImage(ft, 0, 0, cols*u, cols*u);
  g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1;
  for (let i = 1; i < cols; i++){
    g.beginPath(); g.moveTo(i*u, 0); g.lineTo(i*u, cols*u); g.stroke();
    g.beginPath(); g.moveTo(0, i*u); g.lineTo(cols*u, i*u); g.stroke();
  }

  /* 러그 — 가운데. 그림자를 한 겹 깔아야 바닥 위에 놓인 것으로 읽힌다 */
  const rw = it.w*u, rh = it.h*u, rx = (cols*u - rw)/2, ry = (cols*u - rh)/2;
  const rt = rugCanvas(rugId, 48);
  g.save();
  g.shadowColor = 'rgba(30,24,18,.45)'; g.shadowBlur = u*0.16; g.shadowOffsetY = u*0.05;
  if (it.round){
    g.beginPath(); g.arc(rx+rw/2, ry+rh/2, Math.min(rw,rh)/2, 0, 7); g.closePath();
    g.fillStyle = it.base; g.fill();
    g.save(); g.clip(); g.drawImage(rt, rx, ry, rw, rh); g.restore();
  } else {
    g.fillStyle = it.base; g.fillRect(rx, ry, rw, rh);
    g.drawImage(rt, rx, ry, rw, rh);
  }
  g.restore();
  g.restore();

  if (opt.tint){
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = opt.tint; g.fillRect(0,0,W,H);
    g.globalCompositeOperation = 'source-over';
  }
  /* 몇 칸짜리인지 — 이 값이 없으면 카드 넷이 다 같은 크기로 보인다 */
  g.font = '700 10px system-ui,sans-serif';
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.strokeStyle = 'rgba(20,16,12,.75)'; g.lineWidth = 2.4;
  const lab = it.round ? `${it.w}×${it.h} ○` : `${it.w}×${it.h}`;
  g.strokeText(lab, 6, H-6); g.fillText(lab, 6, H-6);
}

/* ---------- 가구 톤 견본 ----------
   **카드 그림은 실제 사무실 사진이다.** 처음에는 카드용으로 작은 장면을 따로 세워
   3D 로 구웠는데(책상 하나 · 그다음엔 방 한 구석), 아무리 손봐도 그건 「모형」이었다.
   카드에서 보고 싶은 것은 벌이 적용된 **이 게임의 사무실**이다.

   그래서 아홉 장을 미리 굽는다: `spike/shot-tones.js` 가 실제 게임을 아홉 번 띄워
   벌을 갈아 끼우며 찍고, 가운데를 카드 비율로 잘라 `assets/tones/<id>.jpg` 로 낸다.
   아홉 칸 대조 사진(spike/ui/tones-9.png)과 **같은 그림**이라 「산 것과 다른 게 온다」가
   원천적으로 없다. 벌을 고치면 그 도구를 다시 돌리는 것이 절차다.

   벽지·바닥은 그 사진에 박혀 있다(그 벌에 어울리는 짝으로 찍었다). 지금 방에 발린
   벽지가 뭐든 카드는 안 바뀐다 — 여기서 고르는 것은 **가구**이고, 벽지·바닥은
   위의 두 칸에서 따로 고른다. 어울리는 짝은 카드 아래 한 줄이 알려 준다.

   색 띠는 **언제나** 그린다. 그림은 사진이지만 띠는 값이다 —
   거기 있는 hex 가 실제로 PAL 로 실려 나가는 그 값이다. */
const _toneImg = new Map();

function toneSwatch(cv, toneId, opt){
  opt = opt || {};
  const t = toneById[toneId] || toneById.tone_std;
  const W = cv.width, H = cv.height, CH = Math.max(9, Math.round(H * 0.15)), RH = H - CH;
  const g = cv.getContext('2d');

  const src = (typeof assetURL === 'function')
    ? assetURL('assets/tones/' + t.id + '.jpg') : 'assets/tones/' + t.id + '.jpg';
  let img = _toneImg.get(src);
  if (img === undefined){
    img = new Image();
    _toneImg.set(src, img);
    /* 오면 그 자리에 다시 그린다. 카드가 그 사이에 다시 만들어졌으면 이 캔버스는
       문서에서 빠져 있고, 그때는 아무 일도 안 일어난다(그리고 버려진다). */
    img.onload = () => { try { toneSwatch(cv, toneId, opt); } catch(e){} };
    img.onerror = () => { _toneImg.set(src, null); try { toneSwatch(cv, toneId, opt); } catch(e){} };
    img.src = src;
  }
  const ready = img && img.complete && img.naturalWidth;

  g.clearRect(0,0,W,H);
  if (ready){
    /* 잘린 비율이 카드와 거의 같지만(264×146), 어긋나도 가운데가 남게 덮어 그린다 */
    const sc = Math.max(W / img.naturalWidth, RH / img.naturalHeight);
    const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
    g.save(); g.beginPath(); g.rect(0,0,W,RH); g.clip();
    g.drawImage(img, (W - dw)/2, (RH - dh)/2, dw, dh);
    g.restore();
  } else {
    toneSketch(g, t, W, RH);
  }

  if (opt.tint){
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = opt.tint; g.fillRect(0,0,W,RH);
    g.globalCompositeOperation = 'source-over';
  }

  const hex = v => '#' + v.toString(16).padStart(6,'0');
  const P = t.pal;
  const chips = t.chips && t.chips.length ? t.chips
    : [P.woodDark, P.wood, P.metal, P.fabric, P.fabric2].map(hex);
  const cw = W / chips.length;
  chips.forEach((c, k) => { g.fillStyle = c; g.fillRect(k*cw, RH, cw + 1, CH); });
  g.fillStyle = 'rgba(20,18,16,.4)'; g.fillRect(0, RH, W, 1);
}

/* 약도 — 사진이 아직 안 왔거나 못 읽는 자리의 폴백. 모양은 근사지만 **색은 근사가
   아니다**: 여기 찍는 hex 는 pal() 이 실어 보내는 그 일곱이다. */
function toneSketch(g, t, W, RH){
  const P = t.pal;
  const hex = v => '#' + v.toString(16).padStart(6,'0');
  const wi = wallById[CUR.wall] || wallById.plain;
  g.fillStyle = wi.base; g.fillRect(0,0,W,RH*0.62);
  g.drawImage(floorCanvas(CUR.floor, 4, 3, 40), 0, RH*0.62, W, RH*0.38);
  g.fillStyle = wi.trim; g.fillRect(0, RH*0.62 - RH*0.05, W, RH*0.05);
  const box = (x,y,w,h,c) => { g.fillStyle = c; g.fillRect(x*W, y*RH, w*W, h*RH); };
  box(0.05, 0.10, 0.24, 0.05, hex(P.woodDark));
  box(0.05, 0.31, 0.24, 0.05, hex(P.woodDark));
  box(0.05, 0.15, 0.024, 0.22, hex(P.metalDark));
  box(0.266, 0.15, 0.024, 0.22, hex(P.metalDark));
  box(0.34, 0.30, 0.09, 0.10, hex(P.pot != null ? P.pot : P.woodDark));
  g.fillStyle = '#6FA96A'; g.fillRect(0.355*W, 0.20*RH, 0.06*W, 0.11*RH);
  box(0.40, 0.46, 0.52, 0.06, hex(P.wood));
  box(0.42, 0.52, 0.032, 0.22, hex(P.metalDark));
  box(0.868, 0.52, 0.032, 0.22, hex(P.metalDark));
  box(0.56, 0.28, 0.23, 0.16, '#2C3A46');
  box(0.575, 0.295, 0.20, 0.13, '#5C7E94');
  box(0.18, 0.60, 0.21, 0.055, hex(P.fabric));
  box(0.18, 0.45, 0.21, 0.055, hex(P.fabric));
  box(0.27, 0.655, 0.045, 0.14, hex(P.metalDark));
  box(0.04, 0.66, 0.13, 0.11, hex(P.fabric2));
}


})();
