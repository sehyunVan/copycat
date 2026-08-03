/* ============================================================
   card.js — 근무 기록증. 함께한 시간을 그림 한 장으로 뽑는다.

   이 게임은 리텐션이 곧 상품성인데, 오프라인 게임이라 그걸 볼 방법이 없다.
   텔레메트리를 붙이는 건 "옆에서 같이 버텨 주는 것"이라는 전제를 배반한다 —
   지켜보는 쪽이 되는 순간 다른 물건이 된다.

   그래서 반대로 간다. 함께한 시간을 **플레이어에게 자랑거리로** 돌려준다.
   올라온 카드의 "N일째"가 곧 리텐션 데이터이자 홍보물이고, 무엇을 내보낼지는
   플레이어가 정한다. 이쪽이 계기판을 얻는 유일하게 정직한 방법이다.

   1200x630 — X·스레드·디스코드가 미리보기로 자르지 않는 비율.
   ============================================================ */

const CARD_W = 1200, CARD_H = 630;
const CARD_FONT = '"Apple SD Gothic Neo","Malgun Gothic","맑은 고딕",Pretendard,system-ui,sans-serif';
const CC = {                       // style.css 의 토큰과 같은 값이어야 한 물건으로 보인다
  cream:'#FFF6E9', ink:'#3A2E28', soft:'#8B7466', line:'#E7D3B9',
  accent:'#FF9F6B', accentD:'#E4753C', mint:'#6FC3AC', card:'#FFFDF8', shadow:'#E4CFB4',
};

/* ---------- 숫자 다듬기 ---------- */
function durText(sec){
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  if (h >= 1 && m) return L({ ko:`${h}시간 ${m}분`, en:`${h}h ${m}m`, ja:`${h}時間${m}分` });
  if (h >= 1)      return L({ ko:`${h}시간`, en:`${h}h`, ja:`${h}時間` });   // "36시간 0분"은 사람 말이 아니다
  return L({ ko:`${m}분`, en:`${m}m`, ja:`${m}分` });
}
const cnt = n => L({ ko:`${n}건`, en:`${n}`, ja:`${n}件` });

/* 카드에 올릴 값. 전부 이미 세고 있던 것들이고, 없는 숫자는 지어내지 않는다. */
function cardData(){
  const t = normTogether(S.together);
  // 대표로 세울 한 마리 = 서류를 제일 많이 처리한 냥. 회사가 실제로 기대고 있는 쪽이다.
  let star = null, best = -1;
  for (const c of S.cats){
    const r = normRecord(c.rec), n = r.docs.s + r.docs.m + r.docs.l;
    if (n > best){ best = n; star = c; }
  }
  const sr = star ? normRecord(star.rec) : null;
  return {
    days: Math.max(t.days, 1),        // 지금 보고 있으니 최소 하루째다
    sec: t.sec, work: t.work, since: t.since,
    docs: (S.stats && S.stats.done) || 0,
    cats: S.cats.length, quarter: S.quarter,
    tier: (TIERS[S.tier] || {}).name || '',
    star, starDocs: best > 0 ? best : 0, starRec: sr,
  };
}

/* ---------- 캔버스 헬퍼 ---------- */
function cardText(g, s, x, y, o){
  o = o || {};
  g.font = `${o.w || 400} ${o.size || 24}px ${CARD_FONT}`;
  g.fillStyle = o.color || CC.ink;
  g.textAlign = o.align || 'left';
  g.textBaseline = o.base || 'alphabetic';
  g.fillText(s, x, y);
  return g.measureText(s).width;
}
function cardRect(g, x, y, w, h, fill, border){
  if (border){ g.fillStyle = CC.shadow; g.fillRect(x + 8, y + 8, w, h); }
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  if (border){ g.strokeStyle = CC.ink; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4); }
}

/* 고양이 시트를 캔버스에 올려도 되는지.
   file:// 에서 외부 이미지를 그리면 캔버스가 오염돼 toDataURL()이 막힌다. 한 장짜리
   배포본과 웹에 올린 판에서는 data:/같은 출처라 문제가 없다. 되는 데서는 진짜 스프라이트를
   쓰고, 안 되는 데서는 그림을 바꾸는 대신 이모지로 간다 — 게임 UI가 이미 이모지를 쓴다. */
function sheetUsable(img){
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    c.getContext('2d').drawImage(img, 0, 0, 1, 1);
    c.toDataURL();
    return true;
  } catch(e){ return false; }
}
function loadImg(src){
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = src;
  });
}

/* ---------- 그리기 ---------- */
async function drawCard(cv){
  const d = cardData();
  const g = cv.getContext('2d');
  cv.width = CARD_W; cv.height = CARD_H;
  g.imageSmoothingEnabled = false;

  g.fillStyle = CC.cream; g.fillRect(0, 0, CARD_W, CARD_H);
  cardRect(g, 44, 40, CARD_W - 96, CARD_H - 96, CC.card, true);

  /* 머리 — 게임 로고와 같은 모양(주황 사각형에 눈 두 개)이라야 같은 물건으로 읽힌다 */
  const lx = 92, ly = 88;
  g.fillStyle = CC.accent; g.fillRect(lx, ly, 44, 44);
  g.strokeStyle = CC.ink; g.lineWidth = 4; g.strokeRect(lx + 2, ly + 2, 40, 40);
  g.fillStyle = CC.ink; g.fillRect(lx + 9, ly + 7, 8, 8); g.fillRect(lx + 27, ly + 7, 8, 8);
  cardText(g, 'Copycat', lx + 60, ly + 34, { size: 36, w: 800 });
  cardText(g, L({ ko:'근무 기록증', en:'TIME CARD', ja:'勤務記録証' }),
           CARD_W - 96, ly + 32, { size: 22, w: 700, color: CC.soft, align: 'right' });

  g.strokeStyle = CC.line; g.lineWidth = 3;
  g.beginPath(); g.moveTo(92, 160); g.lineTo(CARD_W - 96, 160); g.stroke();

  /* 큰 숫자 — 카드에서 유일하게 멀리서도 읽히는 것. 이게 이 카드의 전부다. */
  const nx = 96;
  g.font = `800 150px ${CARD_FONT}`;
  const nw = g.measureText(String(d.days)).width;
  cardText(g, String(d.days), nx, 320, { size: 150, w: 800, color: CC.accentD });
  cardText(g, L({ ko:'일째', en: d.days === 1 ? 'day' : 'days', ja:'日目' }),
           nx + nw + 14, 320, { size: 46, w: 800 });
  cardText(g, L({ ko:'같이 출근하는 중', en:'clocking in together', ja:'一緒に出勤中' }),
           nx + 4, 368, { size: 27, color: CC.soft });

  /* 오른쪽 — 나머지 숫자들. 라벨은 작게, 값은 굵게. */
  const rx = 640, rows = [
    [L({ ko:'함께한 시간',   en:'Time together',  ja:'一緒にいた時間' }), durText(d.sec)],
    [L({ ko:'같이 견딘 근무', en:'Hours endured',  ja:'一緒に耐えた勤務' }), durText(d.work)],
    [L({ ko:'결재한 서류',   en:'Documents',      ja:'決裁した書類' }), cnt(d.docs)],
    [L({ ko:'직원',         en:'Staff',          ja:'社員' }),
     L({ ko:`${d.cats}냥 · Q${d.quarter}`,
         en:`${d.cats} ${d.cats === 1 ? 'cat' : 'cats'} · Q${d.quarter}`,
         ja:`${d.cats}匹・Q${d.quarter}` })],
  ];
  rows.forEach(([k, v], i) => {
    const y = 214 + i * 62;
    cardText(g, k, rx, y, { size: 21, color: CC.soft });
    cardText(g, v, CARD_W - 96, y + 2, { size: 33, w: 800, align: 'right' });
  });

  /* 아래 — 대표 한 마리. 숫자만 있는 카드는 회사 보고서지 누구의 이야기도 아니다. */
  const by = 432;
  g.fillStyle = CC.cream; g.fillRect(92, by, CARD_W - 188, 92);
  g.strokeStyle = CC.line; g.lineWidth = 3; g.strokeRect(93, by + 1, CARD_W - 190, 90);

  let px = 112;
  if (d.star){
    const im = await loadImg(catSrc(d.star));
    if (im && sheetUsable(im)){
      g.save();
      if (d.star.hue) g.filter = `hue-rotate(${d.star.hue}deg)`;
      g.drawImage(im, 16, 16, 16, 16, px, by + 14, 64, 64);   // 앉은 프레임
      g.restore();
    } else {
      cardText(g, '🐈', px, by + 66, { size: 52 });
    }
    px += 82;
    cardText(g, d.star.name, px, by + 44, { size: 30, w: 800 });
    const bits = [];
    if (d.starDocs) bits.push(L({ ko:`서류 ${d.starDocs}건`, en:`${d.starDocs} stamped`, ja:`書類${d.starDocs}件` }));
    if (d.starRec && d.starRec.q) bits.push(L({ ko:`Q${d.starRec.q} 입사`, en:`joined Q${d.starRec.q}`, ja:`Q${d.starRec.q}入社` }));
    if (d.starRec && d.starRec.det)
      bits.push(L({ ko:`구금 ${d.starRec.det}회`, en:`detained ${d.starRec.det}×`, ja:`拘留${d.starRec.det}回` }));
    cardText(g, bits.join(' · '), px, by + 74, { size: 22, color: CC.soft });
  }
  if (d.tier)
    cardText(g, d.tier, CARD_W - 116, by + 58, { size: 24, w: 700, color: CC.soft, align: 'right' });

  /* 발 — 시작한 날. 이 카드가 증명하는 건 결국 이 한 줄이다. */
  cardText(g, d.since
    ? L({ ko:`${d.since}부터`, en:`since ${d.since}`, ja:`${d.since}から` })
    : L({ ko:'오늘부터', en:'starting today', ja:'今日から' }),
    92, CARD_H - 74, { size: 21, color: CC.soft });
  cardText(g, L({ ko:'시계를 감지 않는 게임', en:'a game that never fast-forwards', ja:'時計を早送りしないゲーム' }),
    CARD_W - 96, CARD_H - 74, { size: 21, color: CC.soft, align: 'right' });

  return d;
}

/* ---------- 모달 ---------- */
async function showCard(){
  const cv = document.createElement('canvas');
  let d;
  try { d = await drawCard(cv); }
  catch(e){ toast(L({ ko:'기록증을 만들지 못했습니다.', en:'Could not build the card.', ja:'記録証を作れませんでした。' })); return; }

  let url = '';
  try { url = cv.toDataURL('image/png'); } catch(e){}   // 오염된 캔버스 — 저장만 막히고 보기는 된다

  const m = modal(`
    <div class="mhead"><div class="q">${L({ ko:'근무 기록증', en:'TIME CARD', ja:'勤務記録証' })}</div>
      <h3>${L({ ko:`${d.days}일째 같이 출근하는 중`,
                en:`${d.days} ${d.days === 1 ? 'day' : 'days'} clocking in together`,
                ja:`${d.days}日目、一緒に出勤中` })}</h3>
      <p>${L({ ko:'오늘까지 함께한 기록입니다. 자랑하고 싶으면 가져가세요.',
               en:'What the two of you have got through so far. Take it if you want to show it off.',
               ja:'今日までの記録です。自慢したくなったら持っていってください。' })}</p></div>
    <div class="mbody">
      <img class="cardimg" id="cardImg" alt="">
      <div class="cardacts">
        <button class="buy" id="cardSave">${L({ ko:'이미지로 저장', en:'Save as image', ja:'画像として保存' })}</button>
        <button class="buy alt" id="cardCopy">${L({ ko:'복사', en:'Copy', ja:'コピー' })}</button>
      </div>
      ${url ? '' : `<div class="hint center">${L({
        ko:'이 폴더에서 직접 연 경우 브라우저가 이미지 저장을 막습니다 — 배포본(copycat.html)이나 웹에서는 됩니다.',
        en:'Opened straight from this folder, the browser blocks saving — the single-file build and the web version can.',
        ja:'このフォルダから直接開くとブラウザが保存を止めます——単一ファイル版やウェブ版では保存できます。' })}</div>`}
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  const img = m.veil.querySelector('#cardImg');
  if (url) img.src = url; else { img.replaceWith(cv); cv.className = 'cardimg'; }

  m.veil.querySelector('#cardSave').onclick = () => {
    if (!url) return sfx.err();
    const a = document.createElement('a');
    a.href = url;
    a.download = `copycat-${d.days}${L({ ko:'일', en:'d', ja:'日' })}.png`;
    a.click();
    sfx.chime && sfx.chime();
  };
  m.veil.querySelector('#cardCopy').onclick = async () => {
    try {
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast(L({ ko:'복사했습니다. 붙여넣기 하세요.', en:'Copied — paste it anywhere.', ja:'コピーしました。貼り付けてください。' }));
    } catch(e){
      toast(L({ ko:'복사가 막혀 있습니다. 저장 쪽을 쓰세요.',
                en:'Copying is blocked here. Use save instead.',
                ja:'コピーが許可されていません。保存を使ってください。' }));
    }
  };
}
