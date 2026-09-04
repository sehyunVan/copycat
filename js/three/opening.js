/* ============================================================
   opening.js — 프롤로그. 영상 파일이 아니라 실시간 폴리곤이다.

   왜 영상이 아닌가: 이 게임은 **파일 한 장으로 보내는 것**이 배포 방식이다
   (tools/pack-single.js). 60초짜리 영상을 base64 로 실으면 그 파일이 20MB 를 넘고,
   그러면 "그대로 보내면 되는 파일"이 아니게 된다. 그리고 사무실 가구가 전부 코드인
   프로젝트에서 골목만 렌더팜을 거칠 이유가 없다 — lowpoly.js 를 그대로 쓴다.

   렌더러도 씬도 이 파일이 따로 갖는다. 게임의 3D(render3d.js)와 캔버스를 공유하지
   않는 이유는 컷신이 격자와 아무 상관이 없기 때문이다. 대신 **그림체는 공유한다**
   (KIT · PAL · 후처리) — 프롤로그와 본편이 다른 그림처럼 보이면 프롤로그가 광고로 읽힌다.
   후처리는 eerie.cutscenePass() 로 같은 패스를 한 벌 더 만들어 얹는다. 파스텔로 돌려
   놓으면 null 이 와서 예전처럼 그냥 그린다 — 그림체가 갈리는 곳은 한 군데뿐이어야 한다.

   주의: LP 의 지오메트리·재질 캐시는 render3d 와 공유된다. 그래서 이 파일은
   setPalette 를 부르지 않고, setKit 은 아직 아무도 안 정했을 때만 부른다.
   색은 전부 인자로 넘긴다.

   대본과 떡밥 설계는 ../../STORY.md 에 있다.
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';
import * as LP from './lowpoly.js';
import * as EERIE from './eerie.js';
import { collapse } from './merge.js';

/* i18n · 음소거는 클래식 스크립트의 전역을 그대로 본다. 없어도 돌아가야 한다. */
const T = o => (typeof L === 'function' ? L(o) : (o && o.ko) || '');
const sndOK = () => (typeof soundOn === 'undefined' ? true : !!soundOn);

/* ============================================================
   대본 — 자막. [초, {ko,en,ja}] · 초는 그 장의 시작 기준.
   단서는 딱 한 번만 말한다 (STORY.md 톤 규칙 4).
   ============================================================ */
const LINES = {
  rain: [
    [1.6, { ko:'사흘 동안 아무것도 못 먹었다.', en:'Three days without a meal.', ja:'三日、何も食べていない。' }],
    [6.4, { ko:'주머니에는 멸치 두 개뿐.', en:'Two anchovies in my pocket. That was all.', ja:'ポケットには煮干しが二匹だけ。' }],
  ],
  flyer: [
    [1.2, { ko:'“인재를 찾습니다 — 경력 무관, 식사 제공.”',
            en:'“TALENT WANTED — no experience, meals provided.”',
            ja:'「人材募集 — 経験不問、食事あり。」' }],
    [6.2, { ko:'…식사 제공.', en:'…meals provided.', ja:'…食事あり。' }],
    [10.4,{ ko:'전화번호 탭 하나가 이미 뜯겨 있었다.',
            en:'One of the tear-off tabs was already gone.',
            ja:'電話番号の切り取りが、ひとつだけ無くなっていた。' }],
  ],
  call: [
    [4.6, { ko:'— 네, Copycat 입니다.', en:'— Copycat, go ahead.', ja:'——はい、Copycatです。' }, 'them'],
    [7.4, { ko:'저, 전단을 보고 전화드렸는데요…', en:'I, uh, I’m calling about the flyer…', ja:'あの、チラシを見て電話したんですが…' }],
    [10.6,{ ko:'합격입니다.', en:'You’re hired.', ja:'合格です。' }, 'them'],
    [12.6,{ ko:'…네?', en:'…sorry?', ja:'…え？' }],
    [14.2,{ ko:'기다리시면 저희가 찾아가겠습니다.', en:'Stay where you are. We’ll come to you.', ja:'そのままお待ちください。こちらから伺います。' }, 'them'],
    [17.0,{ ko:'(뚝.)', en:'(click.)', ja:'（ツーッ。）' }],
  ],
  dark: [
    [3.4, { ko:'(발소리는 하나가 아니었다.)', en:'(There was more than one set of footsteps.)', ja:'（足音は、ひとつではなかった。）' }],
  ],
  desk: [
    [1.8, { ko:'눈을 떴을 때 나는 이미 채용되어 있었다.', en:'When I opened my eyes, I had already been hired.', ja:'目を開けたとき、私はもう採用されていた。' }],
    [7.0, { ko:'책상 하나, 의자 하나, 모니터 하나.', en:'One desk. One chair. One monitor.', ja:'机がひとつ、椅子がひとつ、モニターがひとつ。' }],
    [12.4,{ ko:'책상은 새것이 아니었다.', en:'The desk was not new.', ja:'机は、新しくなかった。' }],
  ],
};

/* 전단에 인쇄되는 글자 — 회사 이름은 없다. 이름은 전화를 걸어야 나온다. */
const FLYER = {
  ko: { head:'인재를 찾습니다', sub:['경력 무관 · 나이 무관', '식사 제공 · 숙소 있음'],
        body:['기획 · 실행 · 채용', '전부 맡길 한 명을 찾습니다'], note:'※ 합격 여부는 즉시 통보',
        tab:'0000-냥냥' },
  en: { head:'TALENT WANTED', sub:['No experience · Any age', 'Meals provided · Room included'],
        body:['Plan · Execute · Hire', 'Looking for one who takes all of it'], note:'※ You will be notified immediately',
        tab:'0000-MEOW' },
  ja: { head:'人材募集', sub:['経験不問 · 年齢不問', '食事あり · 寮あり'],
        body:['企画 · 実行 · 採用', 'すべて任せられる一名を'], note:'※ 合否は即時通知',
        tab:'0000-ニャン' },
};

/* 총무의 인수인계 편지 = 상황 설명 + 게임 인스트럭션.
   사규(❓)가 따로 있으므로 여기서는 짧게 끝낸다. */
const LETTER = {
  ko: { to:'수신: 신입 (유일)', from:'발신: 총무',
    lead:'합격을 축하합니다. 인수인계는 이 문서 한 장으로 끝냅니다.',
    items:[
      '우리 품목은 <b>캣닢</b>입니다. 냥법상 마약류입니다.',
      '등기부상 업종은 허브 유통업. 그 서류 한 장이 우리를 지켜주는 전부입니다.',
      '기획도 실행도 채용도 전부 당신 손에 있습니다. <b>당신이 이 회사의 유일한 인재입니다.</b>',
      '결재함에 올린 일을 끝내면 서류가 떨어집니다. 직원이 물고 가 도장을 찍으면 돈이 됩니다.',
      '못 끝낸 서류는 밖으로 샙니다. 혐의가 쌓이고, 넘치면 <b>냥찰</b>이 옵니다.',
      '사무실 시계는 <b>당신의 시계</b>입니다. 12시엔 식사하시고, 18시엔 퇴근하십시오.',
      '<b>서랍은 아직 열지 마십시오.</b>',
    ],
    out:'우리는 이 회사를 당신에게 넘기고 떠납니다. 화이팅.', sign:'— 총무',
    foot:'사규 전문은 상단 ❓ 에 있습니다.', go:'근로계약서를 쓴다', close:'닫기' },
  en: { to:'To: the new hire (the only one)', from:'From: Admin',
    lead:'Congratulations. This one page is the entire handover.',
    items:[
      'Our product is <b>catnip</b>. It is a controlled substance under feline law.',
      'On paper we are an herb wholesaler. That one document is all that protects us.',
      'Planning, execution, hiring — all yours. <b>You are the only talent this company has.</b>',
      'Finish a task in the inbox and a paper drops. An employee carries it off and stamps it; that is money.',
      'Unfinished papers leak out. Suspicion builds, and when it overflows the <b>Pawlice</b> come.',
      'The office clock is <b>your clock</b>. Eat at noon. Go home at six.',
      '<b>Do not open the drawer yet.</b>',
    ],
    out:'We are handing the company to you and leaving. Good luck.', sign:'— Admin',
    foot:'The full company rules are under ❓ at the top.', go:'Sign the contract', close:'Close' },
  ja: { to:'宛：新入社員（唯一）', from:'差出：総務',
    lead:'合格おめでとうございます。引き継ぎはこの一枚で終わりです。',
    items:[
      '商品は<b>マタタビ</b>です。ニャン法上の麻薬類です。',
      '登記上の業種はハーブ卸売。その書類一枚が我々を守る全てです。',
      '企画も実行も採用も全てあなたの手にあります。<b>あなたがこの会社の唯一の人材です。</b>',
      '決裁箱の仕事を終えると書類が落ちます。社員が運んで判を押せば、お金になります。',
      '終わらなかった書類は外に漏れます。疑いが溜まり、溢れると<b>ニャン察</b>が来ます。',
      'オフィスの時計は<b>あなたの時計</b>です。12時には食事を、18時には退勤を。',
      '<b>引き出しはまだ開けないでください。</b>',
    ],
    out:'我々はこの会社をあなたに渡して去ります。ファイト。', sign:'— 総務',
    foot:'社則の全文は上の ❓ にあります。', go:'雇用契約書を書く', close:'閉じる' },
};

const UI = {
  gate:  { ko:'▶ 재생', en:'▶ Play', ja:'▶ 再生' },
  gate2: { ko:'소리를 켜고 보는 편이 좋습니다', en:'Best with sound on', ja:'音を出して見るのがおすすめです' },
  skip:  { ko:'건너뛰기 ⏭', en:'Skip ⏭', ja:'スキップ ⏭' },
  next:  { ko:'화면을 누르면 다음 장면', en:'Click to advance', ja:'クリックで次の場面' },
};

/* ============================================================
   소리 — 파일 없음. 비·다이얼톤·신호음·발소리 전부 WebAudio 로 만든다.
   ============================================================ */
let ac = null;
function ctx(){
  if (!ac){
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
let noiseBuf = null;
function noise(){
  const c = ctx(); if (!c) return null;
  if (!noiseBuf){
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  return s;
}
function tone(f, dur, type = 'sine', gain = 0.05, at = 0, slide = 0){
  const c = ctx(); if (!c || !sndOK()) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
/* 한 방울씩 만들 수는 없다 — 비는 대역을 깎은 잡음이다. 실내로 들어가면 저역만 남긴다. */
function rainBed(){
  const c = ctx(); if (!c) return { set(){}, stop(){} };
  const src = noise(); if (!src) return { set(){}, stop(){} };
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
  const g = c.createGain(); g.gain.value = 0.0001;
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(c.destination);
  src.start();
  return {
    set(level, cut, ramp = 1.2){
      if (!sndOK()) level = 0;
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(Math.max(0.0001, level), t, ramp / 3);
      if (cut) lp.frequency.setTargetAtTime(cut, t, ramp / 3);
    },
    stop(){ try { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.25); setTimeout(() => src.stop(), 900); } catch(e){} },
  };
}
function burst(dur, freq, gain, q = 0.7, at = 0){
  const c = ctx(); if (!c || !sndOK()) return;
  const src = noise(); if (!src) return;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  const t0 = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + dur + 0.05);
}
const SND = {
  paper: () => { burst(0.16, 2200, 0.035, 0.5); burst(0.12, 3400, 0.025, 0.5, 0.13); },
  hook:  () => { burst(0.05, 1200, 0.05, 2); tone(180, 0.06, 'square', 0.03, 0.04); },
  dtmf:  () => {                                   // 번호 7개. 실제 DTMF 주파수 짝.
    const row = [697, 770, 852, 941], col = [1209, 1336, 1477];
    for (let i = 0; i < 7; i++){
      const at = 0.25 + i * 0.28;
      tone(row[i % 4], 0.13, 'sine', 0.035, at);
      tone(col[i % 3], 0.13, 'sine', 0.035, at);
    }
  },
  ring:  n => { for (let i = 0; i < n; i++){ tone(440, 0.95, 'sine', 0.028, i * 2.4); tone(480, 0.95, 'sine', 0.024, i * 2.4); } },
  them:  () => { tone(300, 0.10, 'sawtooth', 0.028); tone(240, 0.08, 'sawtooth', 0.020, 0.09); },
  me:    () => { tone(520, 0.07, 'triangle', 0.020); },
  hang:  () => { burst(0.06, 900, 0.05, 2); tone(420, 0.5, 'sine', 0.02, 0.1, 300); },
  step:  at => burst(0.09, 260 + Math.random() * 120, 0.05, 1.4, at),
  /* 발바닥 — 구두가 아니라 젤리다. 짧고 높고 작게. 여러 마리를 겹쳐야 소란이 된다. */
  paw:   (at, g = 0.022) => burst(0.05, 480 + Math.random() * 520, g, 2.4, at),
  /* 울음 — 내려긋는 활톱니. 개체차를 주려고 기준음을 인자로 받는다. */
  meow:  (at, f = 660) => {
    tone(f, 0.17, 'sawtooth', 0.026, at, f * 0.62);
    tone(f * 1.5, 0.12, 'triangle', 0.010, at + 0.02, f * 0.95);
  },
  /* 뒷배경의 웅성거림 — 무슨 말인지 안 들리는 게 중요하다. 짧은 음절 두세 개. */
  chat:  (at, f = 380) => {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) tone(f + Math.random() * 140, 0.07, 'sawtooth', 0.013, at + i * 0.11);
  },
  clank: at => { burst(0.12, 1500, 0.032, 3.2, at); tone(190, 0.22, 'square', 0.016, at + 0.01); },
  drag:  (at = 0) => burst(1.1, 520, 0.030, 0.4, at),
  bell:  (at = 0) => { tone(1180, 0.24, 'sine', 0.030, at); tone(1760, 0.20, 'sine', 0.018, at + 0.02); },
  power: () => { tone(220, 0.10, 'square', 0.022); tone(660, 0.16, 'square', 0.020, 0.09); },
  /* 물방울 — 짧은 잡음 하나로는 "톡" 이 안 된다. 잡음 뒤에 내려긋는 사인을 붙이면
     떨어진 뒤의 울림이 생기고, 그 울림 때문에 **양동이에 이미 고인 물**이 들린다.
     첫 사무실의 시계는 멈춰 있으므로(officeSet) 이 방의 박자는 이것이 맡는다. */
  drip:  (at = 0) => { burst(0.03, 2600, 0.030, 3, at); tone(1400, 0.16, 'sine', 0.016, at + 0.01, 620); },
  /* 형광등이 끊길 때 나는 전기 소리. 빛이 죽는 그 프레임에 같이 낸다 —
     소리와 빛이 어긋나면 둘 다 연출이 아니라 잡음이 된다. */
  buzz:  (at = 0) => { burst(0.13, 140, 0.028, 0.9, at); tone(120, 0.12, 'square', 0.012, at + 0.01); },
};

/* ============================================================
   전단 — 캔버스에 코드로 인쇄한다. 절취선 탭 8개 중 하나는 이미 없다(떡밥 1).
   투명 알파로 뜯긴 자리를 비워서 실루엣까지 뜯긴 모양이 되게 한다.
   ============================================================ */
const FONT = `"Malgun Gothic","Apple SD Gothic Neo","Yu Gothic","Hiragino Sans",system-ui,sans-serif`;
function flyerTexture(){
  const W = 480, H = 660, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const t = FLYER[typeof LANG !== 'undefined' && FLYER[LANG] ? LANG : 'ko'];

  const TAB_TOP = H * 0.76;                     // 여기부터 아래가 절취선 구역
  x.fillStyle = '#F7F0DF';
  x.fillRect(0, 0, W, TAB_TOP);
  const tabs = 8, tw = W / tabs, MISSING = 2;   // 세 번째 탭이 없다
  for (let i = 0; i < tabs; i++){
    if (i === MISSING) continue;
    x.fillRect(i * tw + 1, TAB_TOP, tw - 2, H - TAB_TOP - (i % 2 ? 6 : 0));
  }
  /* 얼룩 — 비 오는 골목에 며칠 붙어 있던 종이다 */
  for (let i = 0; i < 22; i++){
    x.fillStyle = `rgba(150,128,96,${0.03 + Math.random() * 0.05})`;
    x.beginPath();
    x.ellipse(Math.random() * W, Math.random() * TAB_TOP, 14 + Math.random() * 50, 10 + Math.random() * 34, 0, 0, 7);
    x.fill();
  }
  x.strokeStyle = '#2E2A26'; x.lineWidth = 4;
  x.strokeRect(14, 14, W - 28, TAB_TOP - 28);

  x.fillStyle = '#22201D';
  x.textAlign = 'center';
  x.font = `700 ${t.head.length > 9 ? 52 : 62}px ${FONT}`;
  x.fillText(t.head, W / 2, 118);
  x.font = `500 27px ${FONT}`;
  t.sub.forEach((s, i) => x.fillText(s, W / 2, 176 + i * 38));

  /* 발바닥 도장 — 이 회사가 남기는 유일한 표식 */
  x.fillStyle = '#8C4A3C';
  const px = W / 2, py = 300;
  x.beginPath(); x.ellipse(px, py + 22, 38, 30, 0, 0, 7); x.fill();
  [[-40, -14, 12], [-15, -30, 13], [15, -30, 13], [40, -14, 12]].forEach(([dx, dy, r]) => {
    x.beginPath(); x.ellipse(px + dx, py + dy, r, r * 1.15, 0, 0, 7); x.fill();
  });

  x.fillStyle = '#22201D';
  x.font = `600 29px ${FONT}`;
  t.body.forEach((s, i) => x.fillText(s, W / 2, 392 + i * 40));
  x.font = `400 21px ${FONT}`;
  x.fillStyle = '#5A534C';
  x.fillText(t.note, W / 2, 470);

  /* 절취선과 탭의 번호 */
  x.setLineDash([7, 6]); x.strokeStyle = '#8A8178'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(18, TAB_TOP - 4); x.lineTo(W - 18, TAB_TOP - 4); x.stroke();
  x.setLineDash([]);
  x.fillStyle = '#33302C';
  x.font = `600 19px ${FONT}`;
  for (let i = 0; i < tabs; i++){
    if (i === MISSING) continue;
    x.save();
    x.translate(i * tw + tw / 2, TAB_TOP + 26);
    x.rotate(Math.PI / 2);
    x.textAlign = 'left';
    x.fillText('☎ ' + t.tab, 0, 6);
    x.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* 창밖의 비 — 사무실 안에서는 창이 곧 날씨다. 작은 캔버스에 줄을 다시 그린다.

   색을 한 번 확 내렸다. 처음 값은 #3F4A66 에 흰 줄(0.62)이었는데, 이 판은 이 재질이
   **조명을 안 받는다**(MeshBasicMaterial)는 것이 문제가 됐다: 방을 청록으로 어둡게
   깔아 놓으니 창이 화면에서 제일 밝은 것이 되어 버렸고, 그러면 스탠드가 무게중심을
   빼앗긴다. 그리고 창 앞에 선 모니터가 역광에 먹혀서 책상이 안 읽혔다.
   지금은 창이 스탠드보다 어둡다 — 비는 보이지만 빛나지는 않는다. */
function windowRainTexture(){
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 128;
  const x = cv.getContext('2d');
  const drops = Array.from({ length: 46 }, () => ({
    x: Math.random() * 96, y: Math.random() * 128, l: 8 + Math.random() * 16, v: 90 + Math.random() * 120,
  }));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return {
    tex,
    update(dt){
      x.fillStyle = '#14262E';
      x.fillRect(0, 0, 96, 128);
      x.fillStyle = 'rgba(126,196,204,0.13)';
      x.fillRect(0, 96, 96, 32);                       // 아래쪽은 건물 실루엣이 아니라 젖은 유리
      x.strokeStyle = 'rgba(158,220,224,0.34)';
      x.lineWidth = 1.4;
      x.beginPath();
      for (const d of drops){
        d.y += d.v * dt;
        if (d.y > 128 + d.l){ d.y = -d.l; d.x = Math.random() * 96; }
        x.moveTo(d.x, d.y); x.lineTo(d.x - 1.6, d.y - d.l);
      }
      x.stroke();
      tex.needsUpdate = true;
    },
  };
}

/* 비 — 선분 한 쌍이 한 방울. 점보다 선이 비로 읽힌다. */
function rainRig(count, w, h, d, color = 0xBBD4EA){
  const pos = new Float32Array(count * 6);
  const spd = new Float32Array(count);
  const reset = (i, top) => {
    const x = (Math.random() - 0.5) * w, z = (Math.random() - 0.5) * d;
    const y = top ? h : Math.random() * h;
    const len = 0.22 + Math.random() * 0.3;
    pos[i*6+0] = x;        pos[i*6+1] = y;        pos[i*6+2] = z;
    pos[i*6+3] = x - 0.04; pos[i*6+4] = y - len;  pos[i*6+5] = z;
    spd[i] = 7 + Math.random() * 7;
  };
  for (let i = 0; i < count; i++) reset(i, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.5 });
  const obj = new THREE.LineSegments(g, m);
  return {
    obj, geo:g, mat:m,
    update(dt){
      for (let i = 0; i < count; i++){
        const dy = spd[i] * dt;
        pos[i*6+1] -= dy; pos[i*6+4] -= dy;
        if (pos[i*6+4] < 0) reset(i, true);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

/* LP.stub 은 위치 인자를 받지 않는다(가구는 자기 칸 중심에 서는 규약).
   그걸 잊고 x,y,z 를 넘기면 마지막 인자가 seg 로 들어가서 원기둥이 NaN 이 되고,
   그 물건만 조용히 사라진다 — 실제로 가로등과 전봇대가 그렇게 없어졌다. */
function pipe(rTop, rBot, h, color, x = 0, y = 0, z = 0){
  const m = LP.stub(rTop, rBot, h, color);
  m.position.set(x, y, z);
  return m;
}

/* ============================================================
   빛의 두 편 — 두 세트가 **같은 표를 본다**.

   이 컷신에는 방이 둘(골목·사무실)이고 각각 자기 조명을 갖는데, 그 둘이 서로 다른
   색으로 밤을 만들면 프롤로그가 한 편이 아니라 두 편이 된다. 그래서 광원 색은
   세트가 아니라 **여기**서 정한다.

     WARM  나트륨 가로등 · 스탠드. 이미 두 세트가 같은 값(0xFFD9A0)을 쓰고 있었다
     FLUO  형광 — 자판기 유리 · 문 너머 관 · 천장 등 · 안 끈 CRT

   찬 쪽이 갈려 있었다. 사무실은 청록(0x86E6DE)인데 골목의 자판기는 회청(0x8FB4C2)
   이어서, 같은 「형광등 불빛」인데 한쪽은 초록이고 한쪽은 파랬다. 지금은 한 벌이다.

   칸이 다섯인 이유는 형광등이 **어디서 보이느냐에 따라 다른 색**이기 때문이다.
   관을 직접 보면 하얗게 타고(tube), 갓이나 유리를 통과하면 한 단계 앉고(panel·face),
   그것이 방으로 흘러 물건에 닿을 때는 더 묽다(spill·wash). 한 색으로 다 쓰면
   광원이 스티커처럼 붙어 보인다 — 그 다섯 단계가 곧 「켜져 있다」이다.

   따뜻한 쪽은 손대지 않았다. 이미 맞아 있었고, 두 편이 갈려 있어야 이 그림이 산다 —
   골목의 가로등과 사무실의 스탠드가 같은 전구이고, 자판기와 문 너머 형광등이
   같은 관이다. 방이 바뀌어도 빛은 같은 두 편으로 남는다.
   ============================================================ */
const WARM = 0xFFD9A0;                 // 백열·나트륨. 가로등(34) · 스탠드(15)
const FLUO = {
  tube:  0x9FF2E6,   // 관을 직접 본다 — 제일 밝고 제일 하얗다
  panel: 0xC8F4EC,   // 갓을 씌운 면
  face:  0x86E2E0,   // 빛을 담고 있는 면 — 자판기 유리 · CRT 화면
  spill: 0x86E6DE,   // 그 면이 흘리는 빛 (광원 색)
  wash:  0xA6DCD4,   // 멀리서 넓게 깔리는 빛
};

/* ============================================================
   세트 1 — 뒷골목. 골목은 z 축으로 뻗고, 카메라는 고양이 눈높이(0.4)에 있다.
   올려다보는 각도가 "돈이 없는 밤"을 가장 싸게 만든다.
   ============================================================ */
function alleySet(dead){
  /* ── 색 ──
     "어두컴컴하고 우울한" 쪽으로 한 단계 더 내렸다. 기준 셋:
       · 회청색은 유지하되 값을 내린다 (벽 0x4B4F6B → 0x2E3345)
       · 원색은 등불·자판기 유리에만 남긴다. 상품 색까지 쨍하면
         골목이 아니라 편의점 앞이 된다 — 물 빠진 색으로 바꿨다
       · **낡은 색**(녹·이끼·때)을 따로 넣었다. 어두운 것과 우울한 것은 다르다.
         어두운 건 밝기고 우울한 건 낡음이다 — 밝기만 내리면 안 보이는 골목이 될 뿐이다

     ── 보라를 뺐다 (톤 통일) ──
     회청이 **파랑-보라**(색상환 230° 언저리)였고 사무실은 청록(180°)이었다. 50° 차이는
     같은 밤으로 안 읽힌다 — 컷이 넘어가는 순간 필름이 바뀐 것처럼 보였다.
     지금은 파랑-청록(200° 언저리)이다. 여전히 사무실보다 파랗고 차갑지만, 사무실의
     청록이 **여기 있던 색에서 이어진 것**으로 읽힌다.

     길만 안 옮기면 안 된다. 벽을 옮기고 길을 두고 봤더니 젖은 아스팔트만 혼자
     보라로 남아서, 화면에서 제일 넓은 면이 딴 데를 보고 있었다. 길·연석·건물을
     같이 옮겼다. 녹·이끼·나무·천은 안 건드린다 — 그것들은 원래 따뜻한 쪽이고,
     찬 배경 위의 따뜻한 얼룩이 「낡음」을 만든다. */
  const C = {
    road:0x262F3C, wet:0x304351, kerb:0x2D383E,
    blockA:0x333C46, blockB:0x39434D, blockC:0x262E34,
    pole:0x474338, metal:0x555D6A, lit:0xCBA871, cool:0x7FA7B6,
    box:0x6E583D, bin:0x353B47,
    rust:0x5E4131, grime:0x1B1F2B, moss:0x333B2C, sign:0x6B3A3E, cloth:0x4E4E5C,
  };
  const g = new THREE.Group();
  const add = (...o) => o.forEach(x => g.add(x));
  /* 골목은 매번 같아야 한다. Math.random 을 쓰면 다시 볼 때마다 창이 이사하고,
     "그날 밤 그 골목"이 아니라 "비슷한 골목"이 된다. 씨앗 고정 난수를 쓴다. */
  let seed = 20260819;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  add(LP.box(30, 0.4, 40, C.road, 0, -0.2, -9));
  /* 젖은 자리 — 반사 대신 밝은 판을 깐다. 로우폴리에서는 이게 물로 읽힌다.
     웅덩이를 늘렸다: 비 오는 골목의 바닥은 마른 데가 더 적다. */
  [[-0.6, 3.1, 2.4, 1.6], [1.3, -1.2, 1.7, 2.6], [-1.5, -4.6, 2.2, 1.8],
   [1.9, 5.6, 1.4, 1.2], [-2.0, 0.4, 1.1, 2.0], [0.4, -7.4, 2.6, 1.5],
   [2.1, 2.2, 0.9, 1.4]].forEach(([x, z, w, d]) => {
    const p = LP.box(w, 0.06, d, C.wet, x, 0.0, z);
    p.material = LP.matGlow(C.wet, 0.18); p.castShadow = false;
    p.userData.dynamic = true;                 // 발광이라 합치면 죽는다
    add(p);
  });
  add(LP.box(0.5, 0.22, 40, C.kerb, -2.55, 0.11, -9), LP.box(0.5, 0.22, 40, C.kerb, 2.55, 0.11, -9));

  /* 맨홀과 배수구 — 바닥이 통짜 판으로 남으면 골목이 무대 세트로 보인다 */
  add(pipe(0.34, 0.34, 0.04, C.metal, 0.9, 0.02, 5.4));
  add(pipe(0.26, 0.26, 0.04, C.metal, -0.7, 0.02, -6.2));
  for (let i = 0; i < 6; i++)
    add(LP.box(0.42, 0.03, 0.07, C.metal, 2.28, 0.02, -3.4 + i * 0.13));
  for (let i = 0; i < 6; i++)
    add(LP.box(0.42, 0.03, 0.07, C.metal, -2.28, 0.02, 1.2 + i * 0.13));

  /* ── 벽 ──
     이 골목의 "오밀조밀"은 대부분 벽에서 나온다. 창을 촘촘히 하고 그 사이에
     실외기·배수관·간판을 건다. 바닥에 물건을 더 놓는 것보다 벽을 채우는 쪽이 싸다 —
     카메라가 고양이 눈높이(0.4)라 화면의 대부분이 벽이기 때문이다. */
  const facade = (bx, bw, bh, bz, bd, col, side) => {
    add(LP.box(bw, bh, bd, col, bx, bh / 2, bz));
    /* side 는 **골목을 향한 면**이다. 왼쪽 건물은 +x 쪽이 골목이고 오른쪽 건물은 -x 쪽이다.
       이걸 뒤집어 놓으면 창이 전부 건물 뒤편에 붙어서 골목이 그냥 검은 벽이 된다. */
    const face = bx + side * (bw / 2 + 0.03);
    const z0 = bz - bd / 2 + 1.0, z1 = bz + bd / 2 - 0.8;

    /* 기초 띠 — 벽 아래쪽 한 겹. 물때가 올라온 자리다 */
    add(LP.box(0.07, 0.5, bd - 1.0, C.grime, face - side * 0.01, 0.25, bz));

    /* 창 — 예전엔 1.5 × 2.1 간격이었다. 창 하나가 크고 드물면 벽이 판때기로 보인다.
       작게, 촘촘히. 켜진 것은 다섯에 하나쯤이라야 밤이다. */
    for (let fy = 1.15; fy < bh - 0.5; fy += 1.05){
      for (let fz = z0; fz < z1; fz += 1.35){
        const on = rnd() < 0.22;
        /* 밝은 판만 붙이면 벽에 붙은 포스트잇처럼 보인다. 뒤에 어두운 틀을 한 겹 대야
           "안이 켜진 구멍"으로 읽힌다 — 창은 면이 아니라 깊이다. */
        const frame = LP.box(0.05, 0.62, 0.82, 0x1C2030, face - side * 0.02, fy, fz);
        frame.castShadow = false;
        add(frame);
        const wnd = LP.box(0.06, 0.48, 0.66, on ? C.lit : 0x252A3A, face, fy, fz);
        if (on){
          wnd.material = LP.matGlow(C.lit, 0.24 + rnd() * 0.20);
          wnd.userData.dynamic = true;
        }
        wnd.castShadow = false;
        add(wnd);
        /* 가운데 세로살 — 한 줄이 들어가면 창이 두 짝이 된다 */
        add(LP.box(0.07, 0.5, 0.04, C.grime, face + side * 0.01, fy, fz));
        /* 가끔 창 밑에 실외기가 매달린다 */
        if (rnd() < 0.16 && fy > 1.6){
          const ac = new THREE.Group();
          ac.add(LP.box(0.34, 0.4, 0.5, C.metal, side * 0.17, 0, 0));
          for (let s = 0; s < 3; s++)
            ac.add(LP.box(0.02, 0.05, 0.42, C.grime, side * 0.345, -0.1 + s * 0.1, 0));
          ac.add(LP.box(0.3, 0.03, 0.03, C.rust, side * 0.15, -0.22, -0.2),
                 LP.box(0.3, 0.03, 0.03, C.rust, side * 0.15, -0.22, 0.2));
          ac.position.set(face, fy - 0.62, fz);
          add(ac);
        }
      }
    }

    /* 배수관 — 벽을 타고 내려오는 세로선. 창이 가로로 반복되므로
       세로선이 하나 지나가야 벽이 격자로 굳지 않는다 */
    for (let pz = z0 + 1.4; pz < z1; pz += 5.6){
      const h = bh - 0.8;
      add(pipe(0.07, 0.08, h, C.rust, face + side * 0.09, h / 2 + 0.3, pz));
      for (let by = 1.1; by < h; by += 1.9)
        add(LP.box(0.16, 0.05, 0.05, C.metal, face + side * 0.05, by, pz));
      /* 아래 끝은 골목 쪽으로 꺾인다 — 물이 벽을 타지 않고 바닥으로 떨어진다 */
      add(LP.box(0.24, 0.07, 0.07, C.rust, face + side * 0.17, 0.3, pz));
    }

    /* 돌출 간판 — 둘. 하나만 켜져 있다 */
    const signAt = (sz, lit2, col) => {
      const s = new THREE.Group();
      s.add(LP.box(0.26, 0.04, 0.04, C.metal, side * 0.13, 0, 0));
      const plate = LP.box(0.06, 0.62, 0.46, col, side * 0.3, -0.32, 0);
      if (lit2){ plate.material = LP.matGlow(col, 0.5); plate.userData.dynamic = true; }
      s.add(plate);
      s.add(LP.box(0.08, 0.05, 0.5, C.grime, side * 0.3, -0.03, 0));
      s.position.set(face, 2.5, sz);
      add(s);
    };
    signAt(z0 + (side > 0 ? 22.0 : 16.0), true, C.sign);
    signAt(z0 + (side > 0 ? 11.0 : 26.5), false, C.moss);

    /* 벽에 붙은 잔것 — 낡은 포스터 조각과 얼룩. 아홉 개는 28유닛 벽에서 아무것도 아니다 */
    for (let i = 0; i < 24; i++){
      const py = 0.6 + rnd() * 1.9, pz = z0 + rnd() * (z1 - z0);
      const w = 0.14 + rnd() * 0.18, h = 0.18 + rnd() * 0.24;
      const m = LP.box(0.02, h, w, rnd() < 0.5 ? C.grime : C.cloth, face + side * 0.02, py, pz);
      m.castShadow = false; add(m);
    }
    /* 계량기·배전함 — 벽에 "붙어 있는 물건"이 있어야 벽이 건물이 된다 */
    for (let mz = z0 + 3.0; mz < z1; mz += 6.4){
      add(LP.box(0.14, 0.34, 0.26, C.metal, face + side * 0.07, 1.35, mz));
      add(LP.box(0.16, 0.06, 0.28, C.grime, face + side * 0.08, 1.55, mz));
      add(pipe(0.03, 0.03, 1.05, C.rust, face + side * 0.05, 0.62, mz + 0.18));
    }
  };
  facade(-6.0, 7.0, 9.0, -6, 30, C.blockA, +1);
  facade( 6.2, 7.4, 12.0, -6, 30, C.blockB, -1);
  add(LP.box(26, 15, 6, C.blockC, 0, 7.5, -25));

  /* 비상계단 — 오른쪽 벽에만. 양쪽에 걸면 골목이 아니라 공장이 된다.
     올려다보는 각도에서 이게 하늘을 잘라 주고, 그 조각들이 "오밀조밀"의 절반이다. */
  {
    const fe = new THREE.Group();
    const wall = 2.5;
    [2.4, 4.3, 6.2].forEach((y, li) => {
      fe.add(LP.box(1.0, 0.06, 2.2, C.rust, wall - 0.5, y, 0));            // 발판
      fe.add(LP.box(0.05, 0.5, 2.2, C.rust, wall - 0.98, y + 0.28, 0));    // 난간(바깥)
      for (let r = 0; r < 6; r++)
        fe.add(LP.box(0.04, 0.5, 0.04, C.rust, wall - 0.98, y + 0.28, -1.0 + r * 0.4));
      fe.add(LP.box(1.0, 0.04, 0.04, C.rust, wall - 0.5, y + 0.52, -1.1),
             LP.box(1.0, 0.04, 0.04, C.rust, wall - 0.5, y + 0.52, 1.1));
      if (li < 2)                                                          // 사다리
        for (let s = 0; s < 7; s++)
          fe.add(LP.box(0.5, 0.04, 0.04, C.rust, wall - 0.75, y + 0.2 + s * 0.25, 0.95));
    });
    fe.position.set(0, 0, -3.4);
    add(fe);
  }

  /* 전선 — 골목 위를 가로지른다. 하늘이 통째로 비어 있으면 올려다보는 각도가 아깝다.
     처짐은 세 도막으로 흉내 낸다 (곡선을 진짜로 만들 만한 화면 크기가 아니다). */
  const wire = (y, z, sag, col) => {
    const w = new THREE.Group();
    const l = LP.box(2.1, 0.035, 0.035, col, -1.28, 0, 0);
    const r = LP.box(2.1, 0.035, 0.035, col, 1.28, 0, 0);
    l.rotation.z = -sag * 0.9; r.rotation.z = sag * 0.9;
    w.add(l, r, LP.box(0.9, 0.035, 0.035, col, 0, -sag, 0));
    w.position.set(0, y, z);
    add(w);
  };
  wire(4.6, 1.2, 0.22, C.grime);
  wire(5.1, -2.6, 0.26, C.grime);
  wire(4.2, 6.4, 0.18, C.grime);
  /* 빨랫줄 — 천 조각 넷. 사람이 사는 골목이라는 표시는 이거면 충분하다 */
  {
    const line = new THREE.Group();
    line.add(LP.box(4.6, 0.03, 0.03, C.grime, 0, 0, 0));
    [[-1.4, 0.42, 0.30], [-0.4, 0.50, 0.26], [0.7, 0.38, 0.34], [1.7, 0.46, 0.28]]
      .forEach(([x, h, w], i) => {
        const cl = LP.box(0.03, h, w, i % 2 ? C.cloth : C.moss, x, -h / 2 - 0.02, 0);
        cl.castShadow = false; line.add(cl);
      });
    line.position.set(0, 3.5, 8.2);
    add(line);
  }

  /* 가로등 — 이 장면의 주광. 빛이 하나뿐이라 골목이 골목이 된다. */
  const lampY = 3.0;
  const head = LP.box(0.44, 0.16, 0.3, C.lit, -0.58, lampY - 0.14, 0);
  head.material = LP.matGlow(C.lit, 1.0);
  head.userData.dynamic = true;
  const lamp = new THREE.Group();
  lamp.add(pipe(0.07, 0.09, lampY, C.metal, 0, lampY / 2, 0),
           LP.box(0.7, 0.09, 0.09, C.metal, -0.3, lampY, 0), head);
  /* 갓·브래킷·점검함 한 겹 — 기둥 하나만 서 있으면 가로등이 아니라 막대다 */
  lamp.add(LP.box(0.52, 0.06, 0.38, C.metal, -0.58, lampY - 0.03, 0),
           LP.box(0.3, 0.04, 0.04, C.rust, -0.16, lampY - 0.22, 0),
           LP.box(0.16, 0.3, 0.16, C.grime, 0, 1.05, 0));
  const lampLight = new THREE.PointLight(WARM, 34, 20, 2);
  lampLight.position.set(-0.6, lampY - 0.3, 0);
  lamp.add(lampLight);
  lamp.position.set(2.2, 0, 3.4);
  add(lamp);

  /* 자판기 — 젖은 골목에서 가장 먼저 눈에 들어오는 밝은 면.
     상품 색은 물을 뺐다. 쨍한 빨강·노랑이 남아 있으면 이 골목만 안 우울하다.

     **이 골목의 찬 광원은 이것 하나다.** 그래서 사무실의 형광등과 같은 표를 본다
     (FLUO — 이 파일 위쪽). 앞판은 회청(0x8FB4C2)이었고 사무실은 청록이었는데,
     둘 다 「형광등 불빛」인데 한쪽은 파랗고 한쪽은 초록이면 두 방이 다른 밤이 된다.

     골목에도 사무실과 같은 두 편이 선다: 나트륨 가로등(따뜻함) 대 자판기(청록).
     같은 대비가 두 번 나오니까 사무실이 새 화면이 아니라 **아까 본 색으로 채워진
     방**이 된다 — 그게 톤을 맞춘다는 말의 실제 내용이다.

     유리 안에 관을 하나 넣었다. 판 하나만 고르게 빛나면 그건 형광등이 아니라
     빛나는 스티커다. 위쪽에 더 밝은 관이 있고 그 아래로 앉는 것이 형광 진열장이고,
     문 너머 형광등(officeSet)이 같은 짜임이다 — 같은 색이 아니라 **같은 기구**다. */
  const vend = new THREE.Group();
  vend.add(LP.box(1.05, 1.9, 0.68, 0x36525C, 0, 0.95, 0));
  vend.add(LP.box(1.09, 0.14, 0.72, C.grime, 0, 1.83, 0));       // 상단 띠
  vend.add(LP.box(1.09, 0.10, 0.72, C.rust, 0, 0.06, 0));        // 밑단(녹)
  /* 유리는 **한 판이 아니라 세 단**이다. 한 색으로 고르게 빛나는 큰 면은 형광 진열장이
     아니라 빛나는 스티커고, 여기서는 그게 두 가지를 같이 죽였다: 안에 든 관이 판에
     묻히고, 청록이 통째로 세서 화면 왼쪽의 전단보다 자판기가 이겼다 — 이 장에서 봐야
     하는 것은 전단이다.

     위가 밝고 아래로 앉는다. 관이 위에 걸려 있으니 그래야 하고, **문 너머 형광등이
     쓰는 것과 같은 짜임이다**(officeSet 의 door — 거기서도 한 색으로 칠했다가 세 단으로
     갈랐다). 색을 맞추는 것보다 이쪽이 「같은 기구」를 더 세게 말한다. */
  [[0.46, 1.44, FLUO.face, 0.30], [0.44, 1.00, 0x5E9C9C, 0.20], [0.44, 0.60, 0x3E6E70, 0.12]]
    .forEach(([h, y, col, k]) => {
      const pane = LP.box(0.78, h, 0.06, col, -0.06, y, 0.34);
      pane.material = LP.matGlow(col, k);
      pane.userData.dynamic = true;
      vend.add(pane);
    });
  const vtube = LP.box(0.72, 0.08, 0.03, FLUO.tube, -0.06, 1.64, 0.39);
  vtube.material = LP.matGlow(FLUO.tube, 1.4);
  vtube.userData.dynamic = true;
  vtube.castShadow = false;
  vend.add(vtube);
  for (let r = 0; r < 4; r++) for (let cIdx = 0; cIdx < 3; cIdx++)
    vend.add(LP.box(0.16, 0.22, 0.02, [0x6F473F, 0x77653D, 0x475F4B][(r + cIdx) % 3],
                    -0.32 + cIdx * 0.26, 0.56 + r * 0.32, 0.38));
  vend.add(LP.box(0.20, 0.12, 0.04, C.grime, 0.34, 0.5, 0.36),    // 반환구
           LP.box(0.12, 0.30, 0.04, C.metal, 0.34, 1.2, 0.36));   // 투입구 판
  const vl = new THREE.PointLight(FLUO.spill, 8, 6.5, 2);
  vl.position.set(0, 1.2, 0.9);
  vend.add(vl);
  vend.position.set(2.05, 0, -1.4);
  vend.rotation.y = -0.5;
  add(vend);

  /* 전봇대와 전단 (떡밥 1) */
  const pole = new THREE.Group();
  pole.add(pipe(0.11, 0.14, 4.2, C.pole, 0, 2.1, 0));
  pole.add(LP.box(0.9, 0.07, 0.07, C.pole, 0, 3.5, 0));
  pole.add(LP.box(0.7, 0.06, 0.06, C.pole, 0, 3.16, 0));
  /* 전봇대에 매달린 것들 — 변압기·애자·묶인 전선 뭉치 */
  pole.add(LP.box(0.22, 0.34, 0.22, C.grime, 0, 2.72, 0),
           pipe(0.05, 0.05, 0.12, C.cool, -0.34, 3.56, 0),
           pipe(0.05, 0.05, 0.12, C.cool, 0.34, 3.56, 0),
           LP.box(0.18, 0.18, 0.18, C.rust, 0.02, 1.98, 0.12));
  /* 오래된 전단 조각들 — 이 자리에 전단이 여러 번 붙었다 */
  [[0.16, 1.52, 0.25], [-0.14, 1.72, -0.4], [0.19, 2.14, 0.1],
   [-0.17, 1.28, 0.55], [0.05, 2.42, -0.2]].forEach(([px, py, rot]) => {
    const sc = LP.box(0.16, 0.12, 0.02, 0x8E877A, px, py, 0.16);
    sc.rotation.z = rot; sc.castShadow = false; pole.add(sc);
  });
  const ftex = flyerTexture();
  dead.push(ftex);
  const fgeo = new THREE.PlaneGeometry(0.62, 0.85);
  dead.push(fgeo);
  const flyer = new THREE.Mesh(fgeo, new THREE.MeshLambertMaterial({
    map: ftex, transparent:true, alphaTest:0.5, side: THREE.DoubleSide,
  }));
  dead.push(flyer.material);
  flyer.position.set(0.02, 0.98, 0.17);
  flyer.rotation.y = 0.06;
  flyer.userData.dynamic = true;               // 그림이 붙은 판이라 합치면 그림이 사라진다
  pole.add(flyer);
  /* 전단만 따로 비추는 작은 빛. 골목이 어두운 건 좋지만 글자가 안 읽히면
     떡밥(뜯긴 탭)이 사라진다 — 카메라가 붙는 물건에는 전용 광원을 준다. */
  const fl = new THREE.PointLight(0xFFE2B0, 4.6, 3.4, 2);
  fl.position.set(0.16, 1.15, 0.8);
  pole.add(fl);
  pole.position.set(-1.75, 0, 2.0);
  pole.rotation.y = 0.22;
  add(pole);

  /* 공중전화 부스 — 밤의 골목에서 **초록으로 빛나는 부스 하나.**
     어두운 틀(기둥 넷·지붕) 안에 초록 공중전화가 서 있고, 전화기가 스스로 빛나서
     그 초록이 디딤돌까지 고인다 — 골목 전체가 차가운 남색이라 이 초록 웅덩이
     하나가 장면의 주인공이 된다(가로등의 주황과 마주 보는 색).
     전화기는 옛 초록 공중전화의 그 모양이다: 세로 몸통, **가로로 눕는 수화기**,
     아이보리 다이얼. 수화기는 통화 장에서 step() 이 들어 올린다.
     자판기·가로등과 같은 쪽에 세우면 카메라에서 겹치므로 전단(왼쪽 앞)과 대각,
     왼쪽 뒤에 세운다. */
  const PH = { frame:0x111518, step:0x7E8681, step2:0x6A716B,
               body:0x2FA648, panel:0x14602C, hs:0x1B5A31, cup:0x134022,
               dial:0xDFF0DC, dark:0x0E2A18 };
  const phone = new THREE.Group();
  /* 디딤돌 둘 — 밝은 콘크리트. 초록 빛이 고이는 자리라 일부러 밝은 돌이다 */
  phone.add(LP.box(0.84, 0.07, 0.62, PH.step,  0, 0.035, 0.05));
  phone.add(LP.box(0.62, 0.07, 0.44, PH.step2, 0, 0.105, 0.02));
  /* 틀 — 기둥 넷 + 지붕. 빛나는 것들 사이의 검은 뼈대 */
  [[-0.34, -0.24], [0.34, -0.24], [-0.34, 0.24], [0.34, 0.24]]
    .forEach(([x, z]) => phone.add(LP.box(0.07, 1.62, 0.07, PH.frame, x, 0.95, z)));
  phone.add(LP.box(0.88, 0.10, 0.66, PH.frame, 0, 1.80, 0));
  /* 간판 — 지붕 앞의 흰 판. 글자는 없어도 이 판이 「전화」라고 말한다 */
  const sign = LP.box(0.46, 0.13, 0.03, 0xE9F2E4, 0, 1.71, 0.33);
  sign.material = LP.matGlow(0xE9F2E4, 0.55);
  sign.userData.dynamic = true;
  phone.add(sign);
  /* 천장 등 — 부스 안쪽이 스스로 밝다 */
  const strip = LP.box(0.55, 0.03, 0.36, 0xBFF0C4, 0, 1.70, 0);
  strip.material = LP.matGlow(0xBFF0C4, 0.9);
  strip.userData.dynamic = true;
  phone.add(strip);
  /* 받침 + 전화기 몸통 — 이 부스의 광원 */
  phone.add(LP.box(0.30, 0.52, 0.18, PH.frame, 0, 0.36, -0.10));
  const body = LP.box(0.36, 0.74, 0.26, PH.body, 0, 0.99, -0.08);
  body.material = LP.matGlow(PH.body, 0.42);
  body.userData.dynamic = true;
  phone.add(body);
  /* 앞판 — 안내판(위) · 다이얼(아래) · 동전 구멍 */
  const panel = LP.box(0.24, 0.20, 0.02, PH.panel, 0, 1.16, 0.055);
  panel.material = LP.matGlow(PH.panel, 0.2);
  panel.userData.dynamic = true;
  phone.add(panel);
  const dialG = new THREE.Group();
  const dialFace = pipe(0.085, 0.085, 0.024, PH.dial);
  dialFace.material = LP.matGlow(PH.dial, 0.3);
  dialFace.userData.dynamic = true;
  dialG.add(dialFace);
  dialG.add(pipe(0.032, 0.032, 0.03, PH.dark, 0, 0.004, 0));       // 가운데 꼭지
  for (let i = 0; i < 6; i++){                                     // 손가락 구멍
    const a = -0.5 + i * 0.62;
    dialG.add(LP.box(0.02, 0.028, 0.02, PH.dark, Math.cos(a) * 0.06, 0.005, Math.sin(a) * 0.06));
  }
  dialG.position.set(0, 0.88, 0.065);
  dialG.rotation.x = 1.35;                                         // 거의 정면을 본다
  phone.add(dialG);
  phone.add(LP.box(0.05, 0.03, 0.02, PH.dark, 0.10, 1.30, 0.06));  // 동전 구멍
  /* 가로 수화기 — 전화기 머리의 거치대에 눕는다. 통화 장에서 step() 이 들어 올린다.
     묶음이라 keep 으로 뺀다(merge.js) — 합치면 굳는다. */
  phone.add(LP.box(0.04, 0.07, 0.11, PH.hs, -0.09, 1.395, -0.07));
  phone.add(LP.box(0.04, 0.07, 0.11, PH.hs,  0.09, 1.395, -0.07));
  const handset = new THREE.Group();
  handset.add(LP.box(0.24, 0.05, 0.07, PH.hs, 0, 0.045, 0));       // 가로대
  const cupL = LP.box(0.09, 0.12, 0.10, PH.cup, -0.15, 0, 0);      // 귀·입 컵 — 살짝 안으로
  cupL.rotation.z = 0.26;
  const cupR = LP.box(0.09, 0.12, 0.10, PH.cup, 0.15, 0, 0);
  cupR.rotation.z = -0.26;
  handset.add(cupL, cupR);
  handset.userData.keep = true;
  handset.position.set(0, 1.43, -0.07);
  handset.userData.restY = 1.43;             // step() 이 여기서부터 들어 올린다
  phone.add(handset);
  /* 꼬인 선 — 몸통 옆으로 흘러내린다 */
  phone.add(LP.box(0.025, 0.14, 0.025, PH.dark, 0.20, 1.18, -0.03));
  /* 초록 빛 — 부스 안에서 디딤돌까지 고인다. 이 장면의 웅덩이다.
     거리를 부스 폭에 맞춰 짧게 끊는다 — 길게 주면 뒷벽까지 초록으로 물들어서
     웅덩이가 아니라 초록 방이 된다. */
  const pk = new THREE.PointLight(0x4FE070, 5, 2.5, 2);
  pk.position.set(0, 1.30, 0.24);
  phone.add(pk);
  phone.userData.handset = handset;
  phone.position.set(-1.92, 0, -1.1);
  phone.rotation.y = 1.15;
  add(phone);

  /* 종이상자 — 사보 첫 줄("뒷골목 종이상자에서 창업했습니다")이 가리키는 그 상자다 */
  const cb = LP.cardboard(true);
  cb.position.set(1.75, 0, 4.25); cb.rotation.y = 0.5; cb.scale.setScalar(0.95);
  add(cb);
  /* 쓰레기통은 오른쪽 벽에 붙인다 — 왼쪽에 두면 공중전화 앞을 가린다 */
  add(pipe(0.34, 0.3, 0.8, C.bin, 2.25, 0.4, 1.2), pipe(0.34, 0.3, 0.8, C.bin, 2.3, 0.4, 0.5));
  add(LP.box(0.36, 0.05, 0.34, C.grime, 2.25, 0.82, 1.2));        // 뚜껑은 하나만 덮여 있다
  add(LP.box(0.5, 0.06, 0.36, C.box, -1.55, 0.03, 3.2));

  /* ── 바닥 잔것 ──
     벽 쪽에만 놓는다. 골목 한가운데는 카메라가 지나가는 길이다 (CH 의 from/to). */
  [[-2.20, 5.6, 0.50], [-2.32, 5.4, 0.90], [-2.10, 5.9, 1.35]].forEach(([x, z, y], i) => {
    const b = LP.box(0.5, 0.4, 0.42, i % 2 ? C.box : 0x5E4C34, x, y - 0.2, z);
    b.rotation.y = 0.3 + i * 0.4; add(b);
  });
  [[2.30, 6.40], [2.28, 6.85]].forEach(([x, z], i) => {
    const cr = new THREE.Group();
    cr.add(LP.box(0.44, 0.26, 0.44, C.moss, 0, 0.13, 0));
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++)
      cr.add(LP.box(0.16, 0.06, 0.16, C.grime, -0.1 + a * 0.2, 0.27, -0.1 + b * 0.2));
    cr.position.set(x, i * 0.28, z); cr.rotation.y = 0.4 - i * 0.7;
    add(cr);
  });
  add(pipe(0.3, 0.32, 0.9, C.rust, -2.3, 0.45, -3.4));
  add(LP.box(0.36, 0.05, 0.36, C.grime, -2.3, 0.92, -3.4));
  for (let i = 0; i < 5; i++)
    add(LP.box(0.9, 0.05, 0.1, C.box, 2.3, 0.06 + (i === 4 ? 0.07 : 0), -5.2 + i * 0.22));
  [[-2.35, -0.40, 0.30], [-2.15, -0.75, 0.24], [-2.42, -1.10, 0.27]].forEach(([x, z, r]) => {
    const bag = LP.ellip(r * 2, r * 1.7, r * 2, C.grime, 0);
    bag.position.set(x, r * 0.8, z); add(bag);
  });
  /* 접힌 우산 하나 — 누가 버리고 간 것 */
  const umb = LP.box(0.08, 0.72, 0.08, C.cloth, 0, 0, 0);
  umb.position.set(2.34, 0.34, 2.9); umb.rotation.z = 0.42; add(umb);
  add(LP.box(0.04, 0.20, 0.04, C.grime, 2.42, 0.72, 2.9));

  const rain = rainRig(1800, 16, 9, 26);
  rain.obj.position.set(0, 0, -5);
  dead.push(rain.geo, rain.mat);
  g.add(rain.obj);

  /* 물건이 늘어난 만큼 드로우콜도 늘었다 — 정적인 것은 정점 색으로 구워 하나로 합친다
     (three/merge.js, 게임의 사무실이 쓰는 것과 같은 것).
     발광(창·간판·유리·웅덩이)·움직이는 것(수화기)·그림 붙은 판(전단)은
     userData.dynamic 으로 빼 두었고 collapse 가 그것들을 건너뛴다. */
  collapse(g, { flatShading: true });

  g.userData = { rain, lamp: lampLight, phone, flyer, pole };
  return g;
}

/* ============================================================
   세트 2 — 첫 사무실. 12×10, 책상 하나. 게임이 실제로 쓰는 방 크기다.

   ── 이 방이 무슨 방인가: 「야반도주한 사무실」 ──
   편지의 마지막 줄은 "우리는 이 회사를 당신에게 넘기고 떠납니다" 다. 그 문장이
   화면에 **이미 적혀 있어야** 자막이 설명이 아니라 확인이 된다. 그래서 이 방은
   비어 있는 방이 아니라 **비워진 방**이다.

   「아직 안 들어온 방」과 「밤에 도망친 방」의 차이는 물건 수가 아니라 **어느 물건이
   없는가**에 있다. 그래서 놓는 것보다 빼는 것을 먼저 정했다:

     · 서류함 서랍이 다 빠져 있다 — 하나는 아예 바닥에 뒤집혀 있다
     · 벽에 걸려 있던 것들의 **네모난 자리**만 남았다 (안 탄 벽지 + 못 구멍)
     · 문이 경첩에서 빠져 벽에 기대 있다 — 잠글 생각이 없었다는 뜻이다
     · 게시판은 뜯긴 종이 네 귀퉁이만 압정에 남아 있다
     · 천장이 새고, 받쳐 둔 양동이는 이미 넘쳤다 — 며칠 됐다

   책상 주변만은 깨끗하게 둔다. 이 장의 자막이 "책상 하나, 의자 하나, 모니터 하나"
   이므로 거기에 잡동사니를 얹으면 자막과 화면이 다른 말을 한다. 난장판은 **주변**에
   두고 가운데는 비운다 — 그림으로도 그게 낫다: 빛 웅덩이 안은 정리되어 있고
   그 밖이 무너져 있으면 시선이 웅덩이에 머문다.

   ── 빛: 온도 두 개로만 짠다 ──
   레퍼런스(음습한 실내 페인토버)를 뜯어보면 광원이 색으로 두 편으로 갈려 있다.

     따뜻한 편 — 스탠드 **하나**. 갓이 하얗게 타 있고 그 밑만 밝다
     차가운 편 — 문 너머 형광등 · 천장 형광등 · 안 끈 CRT. 전부 청록이다

   핵심은 **그늘을 검정으로 두지 않는 것**이다. 그늘은 청록이고, 그 청록이 방 전체를
   덮고 있어서 스탠드 밑 한 웅덩이만 사람이 있을 수 있는 색이 된다. 어두워서 음습한
   게 아니라 **색이 두 편이라** 음습하다 — 어둡게만 하면 그냥 안 보이는 방이 되고,
   앞판이 그걸로 한 번 갈렸다: 전역광을 올려 "비어 있는 게 보이는 방"을 만들었는데,
   색이 하나라 그냥 밝고 휑한 방이었다. 그래서 hemi 는 **그대로 올려 두고 색을 넣었다.**
   MOOD.office 와 현상액(LOOK · play 안)이 같이 움직인다.

   그림자를 던지는 것은 방향광 하나뿐이다(점광원 그림자는 큐브맵 6장 — 소프트웨어
   렌더에서 2fps 까지 떨어진다). 그 방향광은 **스탠드 쪽에서** 온다: 그림자가 스탠드
   반대편으로 눕기 때문에 방향광 하나가 스탠드의 대역을 뛴다.

   색은 이 함수가 D 로 따로 들고 있는다. LP.PAL 은 게임과 캐시를 공유하므로 만지지
   않는다(이 파일 머리말) — 청록으로 죽은 회색이 필요한 건 이 방 하나다.
   ============================================================ */
function officeSet(dead){
  const g = new THREE.Group();
  const P = LP.PAL;

  /* 이 방만의 색. 회색을 그냥 쓰지 않는다 — 전부 청록으로 한 단계 죽인 회색이다.
     밝은 것은 딱 둘: 뜯긴 석고 단면(plaster)과 안 탄 벽지 자리(ghost). 그 둘만
     밝아야 "부서진 곳"과 "떼어 간 곳"이 화면에서 먼저 읽힌다. */
  const D = {
    grime:   0x3C4442,   // 먼지·얼룩
    mold:    0x2A3630,   // 곰팡이 — 벽 밑동
    metal:   0x6C7A7E,
    metalD:  0x465052,
    wood:    0x876A4E,
    woodD:   0x5A4634,
    pale:    0x939C98,   // 회벽·라디에이터
    plaster: 0xC8C6BA,   // 뜯긴 석고 단면 — 이 방에서 제일 밝은 것
    dark:    0x161E20,   // 구멍 속·문 너머 그늘
    ghost:   0xC0B9A9,   // 걸려 있던 것의 자리 (안 탄 벽지)
    paper:   0xD6D0C0,
    tile:    0x6E9A94,   // 문 너머 타일벽 — 형광등을 정면으로 받는 면이라 밝다
    cyan:    FLUO.tube,  // 형광등·CRT — 값은 이 파일 위쪽 FLUO 표에서 온다
    warm:    0xFFF2D8,
    floor:   0x5E6660,   // 닳은 장판
    floorAlt:0x4E5650,
    wall:    0x66706C,
    trim:    0x49514E,
    ceil:    0x5C6462,
    ceilAlt: 0x525A58,
    plenum:  0x0E1618,   // 빠진 천장판 안쪽
  };

  /* ---------- 방을 다시 칠한다 ----------
     LP.room 은 게임의 사무실 색(따뜻한 오트밀·크림)으로 칠해서 내려준다. 이 방은
     **다른 건물**이어야 한다 — 같은 색이면 프롤로그의 사무실과 본편의 사무실이 같은
     방으로 읽히고, 그러면 "회사를 넘겨받았다"가 아니라 "같은 방인데 어두워졌다"가 된다.
     첫 판이 실제로 그랬다: 청록 조명 아래 크림색 벽·바닥이 화면에서 제일 밝은 것이 되어
     난장판이 오히려 안 보였다.

     PAL 은 만지지 않는다(게임과 공유하는 캐시다). 대신 **메시가 가리키는 재질만**
     갈아 끼운다 — LP.mat 은 색으로 캐시되므로 다른 색을 꺼내 끼우는 것은 캐시를
     오염시키지 않는다. 그게 이 방법이 되는 이유다.

     바닥은 두 색을 섞는다. 한 색으로 깔면 12×10 이 통째로 한 판이 되고, 그 큰 면이
     화면 절반을 차지하면 방이 아니라 무대 바닥이 된다.

     찾는 방법은 **이름**이다. 색으로 찾으면 안 된다 — three 의 색공간 변환을 한 번
     왕복한 값이라 getHex() 가 원래 상수와 딱 맞는다는 보장이 없다. */
  const room = LP.room(12, 10);
  const floorG = room.getObjectByName('floor');
  if (floorG) floorG.children.forEach((t, i) => {
    /* (i*7)%5 는 12칸 줄에서 대각 줄무늬가 되어 바닥이 체스판으로 읽혔다.
       규칙이 안 보이려면 곱셈 해시가 필요하다. */
    t.material = LP.mat(((i * 2654435761) >>> 0) % 7 < 2 ? D.floorAlt : D.floor);
  });
  (room.userData.walls || []).forEach(w => {
    if (!w) return;
    w.children.forEach((m, i) => { if (m.isMesh && i < 3) m.material = LP.mat(i === 0 ? D.wall : D.trim); });
  });
  g.add(room);

  /* junk — 새로 얹은 정적인 잡동사니는 전부 여기 담고 마지막에 하나로 굽는다.
     방 하나에 상자가 150개쯤 늘었고 그걸 그대로 두면 드로우콜이 그만큼 늘어난다
     (three/merge.js — 골목이 쓰는 것과 같은 것). 발광·움직이는 것은 여기 넣지 않는다. */
  const junk = new THREE.Group();

  /* 북쪽 벽(z=0)에 붙이는 판. 이 방에서 카메라가 보는 벽은 이 면 하나다. */
  const wall = (w, h, col, x, y, z = 0.11) => {
    const b = LP.box(w, h, 0.04, col, x, y, z);
    junk.add(b);
    return b;
  };

  /* LP 의 기성품(의자·상자·결재함)을 이 방 색으로 갈아입힌다. 게임 색 그대로 쓰면
     따뜻한 나무·희끄무레한 천이 청록 위에 얹혀서 **화면에서 제일 밝은 것**이 되고,
     그러면 스탠드가 무게중심을 빼앗긴다. 첫 렌더에서 흰 의자와 주황 상자가 그랬다.

     색 비교는 THREE.Color 로 한다. material.color.r 같은 성분을 문턱값으로 나누면
     three 의 색공간 설정(선형/sRGB)에 따라 값이 달라져서 어떤 판에서는 두 색이 같은
     쪽으로 몰린다 — 같은 setHex 를 거친 Color 끼리 비교하면 그 문제가 없다.
     to 가 null 이면 그 메시를 지운다(결재함의 흰 서류). */
  const _c = new THREE.Color();
  const recolor = (node, map) => {
    const drop = [];
    node.traverse(o => {
      if (!o.isMesh) return;
      for (const [from, to] of map){
        if (!o.material.color.equals(_c.setHex(from))) continue;
        if (to === null) drop.push(o); else o.material = LP.mat(to);
        break;
      }
    });
    drop.forEach(o => o.parent && o.parent.remove(o));
    return node;
  };
  const grimyBox = open => recolor(LP.cardboard(open), [[P.wood, 0x7A6850], [P.woodDark, 0x5A4C3A]]);

  /* ---------- 1인용 책상 ----------
     게임의 desk() 는 2인용 2칸이라 여기서는 따로 짠다.
     "1인용 책상만 있는 휑한 사무실"이 이 장면의 전부다. */
  const desk = new THREE.Group();
  desk.add(LP.box(1.30, 0.08, 0.72, P.wood, 0, 0.61, 0));
  [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]].forEach(([dx, dz]) =>
    desk.add(LP.box(0.07, 0.60, 0.07, P.metalDark, dx, 0.30, dz)));
  /* 서랍 — 편지의 마지막 줄이 가리키는 물건 (떡밥 3).
     이 방의 다른 서랍은 **전부 빠져 있다**(서류함). 그래서 닫혀 있는 서랍이 하나뿐이고,
     "열지 마십시오" 가 그 하나를 가리킨다 — 문장보다 화면이 먼저 지목한다. */
  desk.add(LP.box(0.46, 0.34, 0.6, P.wood, 0.38, 0.38, 0));
  desk.add(LP.box(0.42, 0.02, 0.02, P.metalDark, 0.38, 0.46, 0.31));
  desk.add(LP.box(0.05, 0.05, 0.02, P.metalDark, 0.38, 0.30, 0.31));

  /* 모니터 — 편지 장에서 켜야 하므로 화면 판을 따로 들고 있는다 */
  const screen = LP.box(0.44, 0.26, 0.02, P.screen, 0, 0.98, 0.035);
  const mon = new THREE.Group();
  mon.add(LP.box(0.26, 0.03, 0.18, P.metalDark, 0, 0.66, 0),
          LP.box(0.06, 0.14, 0.06, P.metalDark, 0, 0.74, 0),
          LP.box(0.52, 0.34, 0.05, P.metalDark, 0, 0.98, 0),
          screen);
  mon.position.set(-0.16, 0, -0.12);
  mon.rotation.y = 0.12;
  desk.add(mon);
  const monLight = new THREE.PointLight(FLUO.spill, 0, 3.2, 2);
  monLight.position.set(-0.16, 1.0, 0.5);
  desk.add(monLight);

  desk.add(LP.papers(0.16, 0.2));

  /* 뒤집힌 이름표 (떡밥 2) — 아무 글자도 안 보이는 나무판 한 장 */
  const plate = LP.box(0.3, 0.045, 0.1, P.woodDark, -0.42, 0.665, 0.2);
  plate.rotation.set(Math.PI, 0.24, 0);
  desk.add(plate);
  desk.add(LP.box(0.2, 0.01, 0.04, 0x8A8078, -0.42, 0.688, 0.2));

  /* 커피 자국 — 이 책상은 새것이 아니다 */
  const ring = new THREE.RingGeometry(0.045, 0.063, 20);
  dead.push(ring);
  const rmat = new THREE.MeshBasicMaterial({ color:0x9A6B4A, transparent:true, opacity:0.45, side:THREE.DoubleSide });
  dead.push(rmat);
  const rm = new THREE.Mesh(ring, rmat);
  rm.rotation.x = -Math.PI / 2;
  rm.position.set(0.3, 0.652, 0.24);
  desk.add(rm);

  desk.position.set(6, 0, 4);
  /* 벽과 직각이 아니다. 두 가지를 같이 해결한다:
       · 이 방에 각 맞춰 놓인 물건이 하나도 없어야 「밀어 놓고 나갔다」가 된다
       · 모니터 앞면이 스탠드 쪽(오른쪽)을 보게 된다 — 정면으로 두면 스탠드가 모니터
         뒤에 서서 화면이 역광으로 검게 죽는다. 카메라에서 25° 어긋난 3/4 각도다. */
  desk.rotation.y = 0.72;
  g.add(desk);

  /* 의자는 비스듬히 빼 놓는다. 책상 정면에 밀어 넣으면 카메라가 책상 위(이름표·서랍)를
     못 본다 — 그리고 아무도 앉아 본 적 없는 자리처럼 읽힌다. */
  const chair = recolor(LP.chair(2.62), [[P.fabric, 0x56605C], [P.metalDark, 0x3A4244]]);
  /* LP.chair 는 게임 색(PAL.fabric — 파르스름한 회청)으로 나온다. 이 방에서는 그 색이
     스탠드 빛을 받아 **화면에서 제일 밝은 천**이 되어 버렸다(첫 렌더에서 화면 가운데에
     흰 의자가 떠 있었다). 방과 같은 방식으로 재질만 갈아 끼운다. */
  chair.position.set(5.10, 0, 4.90);
  g.add(chair);

  /* 결재함은 **비어 있고 책상 위에 있다.**
     비어 있는 이유: 아직 아무 일도 맡지 않았다. LP.inbox 가 얹어 주는 흰 서류
     (PAL.paper)는 이야기에 안 맞고, 그 흰색이 스탠드 빛을 받아 화면에서 제일 밝은
     것 중 하나가 되기도 했다. 그래서 지운다 — 빈 함이 "일이 아직 안 왔다"를 말한다.
     책상 위인 이유: 바닥에 두니 오른쪽 아래에 정체 불명의 밝은 판으로 떴다.
     결재함은 책상 물건이고, 책상 위에 있으면 그냥 결재함으로 읽힌다. */
  const inbox = recolor(LP.inbox(), [[P.metalDark, 0x424C4E], [P.paper, null]]);
  inbox.position.set(0.40, 0.65, -0.08);
  desk.add(inbox);

  /* ---------- 스탠드 — 이 방에서 유일하게 따뜻한 것 ----------
     레퍼런스의 중심이 이것이고 여기서도 그렇다. 갓을 **광원이 아니라 타 있는 면**으로
     세우는 것이 요령이다: 점광원만 두면 바닥만 밝고 스탠드 자체는 어두운 막대로 남는다.
     발광 재질로 갓을 세우고 그 안에 점광원을 넣으면 화면에 **흰 덩어리 하나가 서 있게**
     된다 — 그게 이 그림의 무게중심이다.

     자리를 한 번 옮겼다. 처음에 책상보다 **뒤**(z=3.05, 책상은 z=4)에 뒀는데, 그러면
     책상 위의 물건들이 전부 역광이 되어 모니터가 검은 판으로만 남았다 — 이 장의 자막이
     "책상 하나, 의자 하나, 모니터 하나" 인데 모니터가 안 읽히면 자막이 헛말이 된다.
     지금은 책상 오른쪽 옆·살짝 앞(8.15, 4.65)이다: 화면 오른쪽 70% 자리에 갓이 서고,
     빛이 모니터 앞면을 스치듯 때린다. 더 앞으로 빼면 갓이 책상을 가린다. */
  const stand = new THREE.Group();
  stand.add(LP.box(0.32, 0.04, 0.32, D.metalD, 0, 0.02, 0));
  stand.add(LP.box(0.05, 1.36, 0.05, D.metalD, 0, 0.70, 0));
  const shade = LP.stub(0.26, 0.33, 0.40, D.warm, 8);
  shade.material = LP.matGlow(D.warm, 0.95);
  shade.position.set(0, 1.47, 0);
  shade.castShadow = false;
  stand.add(shade);
  /* 갓 아래 원판 — 갓보다 한 단계 더 타 있다. 이 판이 없으면 갓이 통째로 고르게
     밝아서 "켜진 등"이 아니라 "흰 통"이 된다. */
  const bulbPlate = LP.box(0.40, 0.03, 0.40, 0xFFFAF0, 0, 1.29, 0);
  bulbPlate.material = LP.matGlow(0xFFFAF0, 1.6);
  bulbPlate.castShadow = false;
  stand.add(bulbPlate);
  stand.position.set(7.60, 0, 3.30);
  g.add(stand);

  /* 거리 7.2 → 5.4. 첫 렌더에서 바닥의 오른쪽 절반이 통째로 따뜻해졌고, 그러면
     "등 하나"가 아니라 "천장등이 켜진 방"이 된다. 웅덩이는 좁아야 웅덩이다. */
  const lampLight = new THREE.PointLight(WARM, 15, 6.2, 2);
  lampLight.position.set(7.60, 1.38, 3.30);
  g.add(lampLight);

  /* ---------- 문 — 경첩에서 빠져 있다 ----------
     벽을 뚫지 않는다(lowpoly.js 의 규약). 대신 **판을 겹쳐서 깊이를 위조한다**:
     제일 뒤에 문 너머의 타일벽, 그 위에 형광등, 그 위에 문틀, 문틀 안쪽에 그늘 선.
     디오라마에서는 이걸로 충분히 읽히고, 무엇보다 벽을 조각내지 않아도 된다.

     이 문이 이 방에서 **두 번째로 밝은 것**이고 색은 정반대다. 화면 왼쪽 위에
     청록 사각형이 하나 떠 있어서 오른쪽의 따뜻한 웅덩이와 대각으로 마주 본다. */
  const DOOR_X = 1.5;
  const door = new THREE.Group();
  door.add(LP.box(1.14, 1.74, 0.03, D.dark,  0, 0.87, 0.075));   // 문 너머 그늘
  /* 저쪽 벽은 **위가 밝고 아래가 어둡다.** 등이 위에 걸려 있으니 그래야 하고,
     한 색으로 칠했던 첫 판은 그래서 문이 아니라 「청록색 문짝」으로 읽혔다 —
     열린 문은 판이 아니라 **그라데이션**이다. */
  door.add(LP.box(1.04, 0.62, 0.03, D.tile,   0, 1.30, 0.085));
  door.add(LP.box(1.04, 0.50, 0.03, 0x4E706C, 0, 0.74, 0.085));
  door.add(LP.box(1.04, 0.42, 0.03, 0x33514F, 0, 0.28, 0.085));
  /* 타일 줄 — 판 하나면 벽이 종이로 보인다. 가로로 세 줄만 그으면 타일이 된다 */
  [0.50, 0.98, 1.46].forEach(y => door.add(LP.box(1.04, 0.025, 0.01, 0x22403E, 0, y, 0.10)));
  /* 저쪽 바닥에 떨어진 빛 — 이 밝은 가로 띠 하나가 "저 안에 방이 있다"를 말한다.
     띠 없이 벽만 밝히면 저쪽이 방이 아니라 그림이 된다. */
  const sill = LP.box(1.04, 0.11, 0.03, FLUO.panel, 0, 0.07, 0.09);
  sill.material = LP.matGlow(FLUO.panel, 0.55);
  sill.castShadow = false;
  sill.userData.dynamic = true;   // 발광이라 굽지 않는다 (collapse 는 dynamic 을 건너뛴다)
  door.add(sill);
  /* 문틀 — 벽 쪽으로 튀어나와야 빛을 받아 선이 생긴다 */
  door.add(LP.box(0.11, 1.88, 0.11, D.woodD, -0.62, 0.94, 0.13),
           LP.box(0.11, 1.88, 0.11, D.woodD,  0.62, 0.94, 0.13),
           LP.box(1.35, 0.11, 0.11, D.woodD,  0,    1.88, 0.13));
  /* 문틀 안쪽 그늘 선 — 이 두 줄이 없으면 문이 벽에 붙인 스티커로 보인다 */
  door.add(LP.box(0.04, 1.72, 0.03, 0x0A1012, -0.53, 0.90, 0.115),
           LP.box(0.04, 1.72, 0.03, 0x0A1012,  0.53, 0.90, 0.115));
  door.position.set(DOOR_X, 0, 0);
  junk.add(door);

  /* 문 너머 형광등. 발광이라 junk 에 넣지 않는다 — 그리고 깜빡여야 하므로
     userData 로 내보낸다(step 이 세기를 흔든다).

     재질은 **복제한다.** LP.matGlow 는 색+세기로 캐시되고 그 캐시를 게임과 공유하므로
     (이 파일 머리말) 여기서 emissiveIntensity 를 매 프레임 쓰면 게임 쪽에서 같은 키로
     꺼내 쓰는 재질까지 같이 흔들린다. 복제본은 dead 에 넣어 컷신이 끝날 때 버린다. */
  const tube = LP.box(0.74, 0.10, 0.02, D.cyan, DOOR_X, 1.42, 0.115);
  tube.material = LP.matGlow(D.cyan, 2.2).clone();
  dead.push(tube.material);
  tube.castShadow = false;
  g.add(tube);
  junk.add(LP.box(0.82, 0.07, 0.09, D.pale, DOOR_X, 1.53, 0.12));   // 등 커버
  const doorLight = new THREE.PointLight(FLUO.spill, 9, 9.5, 2);
  doorLight.position.set(DOOR_X, 1.15, 0.85);
  g.add(doorLight);

  /* 빠진 문짝 — 벽에 기대 세워 뒀다. 잠글 생각이 없었다는 뜻이고,
     이 방에서 「야반도주」를 한 물건으로 말하는 것이 이것이다. */
  {
    const slab = new THREE.Group();
    slab.add(LP.box(0.86, 1.82, 0.06, 0x3E3228, 0, 0.91, 0));
    slab.add(LP.box(0.66, 0.62, 0.02, 0x2E241C, 0, 1.22, 0.04));     // 패널 홈
    slab.add(LP.box(0.07, 0.07, 0.05, D.metal, 0.32, 0.86, 0.05));   // 손잡이
    slab.add(LP.box(0.05, 0.14, 0.03, D.metal, -0.42, 1.52, 0));     // 뽑힌 경첩
    slab.add(LP.box(0.05, 0.14, 0.03, D.metal, -0.42, 0.42, 0));
    slab.position.set(0.24, 0, 1.95);
    slab.rotation.set(-0.16, Math.PI / 2 + 0.14, 0.05);
    junk.add(slab);
  }

  /* ---------- 뜯긴 벽 ----------
     레퍼런스에서 제일 세게 말하는 것이 이것이다. 어두운 구멍 하나로는 안 되고
     **밝은 단면**이 있어야 "부서졌다"가 된다: 구멍은 검고, 뜯긴 석고 조각은 이 방에서
     제일 밝다. 그 명암 차가 곧 파손이다. 안쪽에 세로 각재(스터드) 둘을 세우면
     벽이 두께를 갖는다 — 구멍이 그림이 아니라 구멍이 된다. */
  {
    const hx = 3.25, hy = 1.06;
    wall(0.82, 0.74, D.dark, hx, hy, 0.10);
    junk.add(LP.box(0.06, 0.70, 0.06, D.woodD, hx - 0.22, hy, 0.06));
    junk.add(LP.box(0.06, 0.70, 0.06, D.woodD, hx + 0.20, hy, 0.06));
    junk.add(LP.box(0.72, 0.04, 0.04, D.metalD, hx, hy + 0.12, 0.05));   // 드러난 전선 한 줄
    /* 깨진 가장자리 — 각도**와 깊이**를 다 흔들어야 톱니가 된다. 첫 판은 윗변의 조각들이
       전부 비슷한 높이(0.34~0.44)에 있어서 빗살처럼 가지런한 이빨 한 줄로 보였다.
       부서진 자리는 안쪽으로 파고든 데와 덜 뜯긴 데가 섞여 있어야 한다. */
    [[-0.40, 0.30, 0.5], [-0.26, 0.39, -0.7], [-0.12, 0.27, 0.3], [0.02, 0.40, -0.4],
     [0.18, 0.25, 0.9], [0.33, 0.36, -0.2], [0.41, 0.14, 0.6], [0.38, -0.06, -0.5],
     [0.42, -0.24, 0.35], [0.26, -0.34, -0.8], [0.06, -0.29, 0.5], [-0.14, -0.38, -0.3],
     [-0.32, -0.27, 0.7], [-0.42, -0.10, -0.6], [-0.39, 0.11, 0.25]]
      .forEach(([dx, dy, rot], i) => {
        const chip = LP.box(0.08 + ((i * 5) % 4) * 0.045, 0.07 + ((i * 3) % 5) * 0.035, 0.05,
                            D.plaster, hx + dx, hy + dy, 0.12);
        chip.rotation.z = rot;
        junk.add(chip);
      });
    /* 떨어진 조각은 밑에 쌓여 있다. 위만 부서지고 바닥이 깨끗하면 거짓말이다 */
    [[-0.5, 0.22, 0.3], [-0.1, 0.34, -0.8], [0.3, 0.16, 0.5], [0.6, 0.40, 1.1], [-0.8, 0.5, 0.2]]
      .forEach(([dx, dz, rot]) => {
        const p = LP.box(0.16, 0.035, 0.13, D.plaster, hx + dx, 0.02, 0.3 + dz);
        p.rotation.y = rot; p.castShadow = false; junk.add(p);
      });
  }

  /* ---------- 창 — 창밖의 비는 캔버스로 그린다 ---------- */
  const wr = windowRainTexture();
  dead.push(wr.tex);
  const wgeo = new THREE.PlaneGeometry(1.5, 1.15);
  dead.push(wgeo);
  const wmat = new THREE.MeshBasicMaterial({ map: wr.tex });
  dead.push(wmat);
  const glass = new THREE.Mesh(wgeo, wmat);
  const win = new THREE.Group();
  win.add(LP.box(1.72, 1.36, 0.08, P.wall, 0, 0, -0.02),
          LP.box(0.06, 1.15, 0.05, P.wall, 0, 0, 0.06),
          LP.box(1.5, 0.06, 0.05, P.wall, 0, 0, 0.06),
          LP.box(1.9, 0.08, 0.22, P.wood, 0, -0.7, 0.06));
  glass.position.z = 0.03;
  win.add(glass);
  win.position.set(4.6, 1.25, 0.14);
  g.add(win);

  const win2 = win.clone();
  win2.position.set(8.4, 1.25, 0.14);
  g.add(win2);
  /* 깨진 창은 둘 중 하나만. 둘 다 깨면 폐가가 되고, 폐가는 출근할 곳이 아니다.
     판지로 막은 자리 하나와 붙인 테이프 두 줄로 끝낸다. */
  junk.add(LP.box(0.52, 0.44, 0.02, D.wood, 8.62, 1.34, 0.19));
  junk.add(LP.box(0.60, 0.04, 0.01, 0xB8B0A0, 8.62, 1.55, 0.21));
  junk.add(LP.box(0.04, 0.50, 0.01, 0xB8B0A0, 8.40, 1.34, 0.21));

  /* ---------- 천장 ----------
     앞판에는 천장이 없었다. LP.room 이 안 만들어 주고, 게임은 방을 위에서 내려다보므로
     필요가 없다. 그런데 **이 장면은 방 안에 서서 본다**(카메라 y=1.32, 벽 높이 1.9).
     천장이 없으면 화면 위쪽 1/3 이 배경색으로 남고, 그 빈 자리 때문에 방이 아니라
     세트로 읽혔다 — 첫 렌더에서 제일 크게 걸린 것이 이것이다.

     천장을 덮으면 셋이 같이 온다:
       · 방이 낮아진다 — 1.9m 천장 밑에서 보는 화면은 그 자체로 답답하다
       · 배관과 형광등이 붙을 면이 생긴다 — 매달린 것이 허공에 안 뜬다
       · 등불이 천장에도 웅덩이를 만든다 — 화면 위아래에 빛이 생겨 그림이 두 겹이 된다

     그림자는 안 던진다(castShadow=false). 방향광은 천장 **위**에서 오므로 천장이
     그림자를 던지면 방이 통째로 검어진다. 방을 밝히는 건 스탠드고 방향광은 그림자만
     만드는 물건이다(mood 참고) — 그 분업이 여기서 값으로 나타난다. */
  const CEIL_Y = 1.98;
  for (let cz = 0; cz < 10; cz += 2){
    for (let cx = 0; cx < 12; cx += 2){
      /* 판 둘이 빠져 있다. 같은 높이에 검은 판을 깔면 그냥 검은 타일이라, **위로 밀어**
         움푹 들어가게 만든다 — 그 단차가 곧 "빠졌다"다. */
      const gone = (cx === 2 && cz === 2) || (cx === 8 && cz === 0);
      const t = LP.box(2, 0.08, 2, gone ? D.plenum : ((cx + cz) % 4 === 0 ? D.ceilAlt : D.ceil),
                       cx + 1, CEIL_Y + (gone ? 0.16 : 0), cz + 1);
      t.castShadow = false;
      junk.add(t);
    }
  }
  /* 판 사이 이음선 — 이게 없으면 천장이 한 장의 종이가 된다 */
  for (let cx = 2; cx < 12; cx += 2) junk.add(LP.box(0.05, 0.05, 10, D.trim, cx, CEIL_Y - 0.05, 5));
  for (let cz = 2; cz < 10; cz += 2) junk.add(LP.box(12, 0.05, 0.05, D.trim, 6, CEIL_Y - 0.05, cz));
  /* 빠진 자리에서 늘어진 선 한 줄 — 구멍이 구멍으로 읽히게 하는 마지막 한 획 */
  junk.add(LP.box(0.03, 0.34, 0.03, 0x23282A, 2.7, 1.84, 2.4));
  /* 천장 물 자국 — 새는 자리 주변이 번져 있다 */
  [[7.5, 2.4, 1.5], [7.5, 3.4, 0.9], [6.6, 2.6, 0.7]].forEach(([x, z, r]) => {
    const s = LP.box(r, 0.02, r * 0.8, 0x3E4844, x, CEIL_Y - 0.05, z);
    s.castShadow = false; junk.add(s);
  });

  /* 배관 — 천장 밑으로 지나간다. 이 방의 습기는 전부 위에서 오므로
     배관 · 새는 이음쇠 · 받쳐 둔 양동이가 **한 줄로 이어져야** 천장이 샌다가 읽힌다. */
  [[1.78, 1.15], [1.72, 2.35]].forEach(([y, z]) => {
    junk.add(LP.box(11.0, 0.11, 0.11, D.metalD, 6, y, z));
    for (let x = 1.4; x < 11; x += 2.6)
      junk.add(LP.box(0.05, 0.20, 0.05, D.metalD, x, y + 0.14, z));
  });
  /* 이음쇠에서 새고 있다 — 여기가 물의 출발점이다 */
  const DRIP_X = 7.5, DRIP_Z = 2.35;
  junk.add(LP.box(0.16, 0.16, 0.16, D.metal, DRIP_X, 1.72, DRIP_Z));
  junk.add(LP.box(0.05, 0.22, 0.05, D.metalD, DRIP_X, 1.56, DRIP_Z));
  /* 천장 형광등 — 반쯤 죽어 깜빡인다. 한쪽이 처져 관이 드러나 있다.
     레퍼런스의 천장 등이 이 역할이다: 화면 위쪽을 아픈 색으로 덮는다. */
  const pan = new THREE.Group();
  pan.add(LP.box(1.84, 0.10, 0.42, D.pale, 0, 0, 0));
  pan.add(LP.box(0.06, 0.14, 0.06, D.metalD, -0.76, 0.11, 0), LP.box(0.06, 0.14, 0.06, D.metalD, 0.76, 0.11, 0));
  pan.position.set(3.40, 1.86, 1.50);
  pan.rotation.z = 0.09;
  junk.add(pan);
  const ceil = LP.box(1.66, 0.06, 0.30, D.cyan, 3.40, 1.79, 1.50);
  ceil.material = LP.matGlow(FLUO.panel, 1.1).clone();   // 깜빡이므로 복제 (tube 와 같은 이유)
  dead.push(ceil.material);
  ceil.castShadow = false;
  ceil.rotation.z = 0.09;
  g.add(ceil);
  const ceilLight = new THREE.PointLight(FLUO.wash, 6, 8.0, 2);
  ceilLight.position.set(3.40, 1.62, 1.50);
  g.add(ceilLight);

  /* 죽은 전구 하나. 갓도 없이 전선에 매달려 있고 **켜져 있지 않다** — 흔들리기만 한다.
     따뜻한 광원이 둘이면 스탠드가 특별하지 않게 되고, 그러면 이 그림의 무게중심이
     사라진다. 그래서 이건 빛이 아니라 **움직임**으로만 쓴다(step 이 흔든다).
     눈높이(1.32)보다 살짝 아래까지 내려온다 — 화면 가운데를 지나가야 흔들림이 보인다. */
  const pend = new THREE.Group();
  pend.add(LP.box(0.02, 0.50, 0.02, 0x2A2E30, 0, -0.25, 0));
  pend.add(LP.box(0.07, 0.05, 0.07, 0x3A3E40, 0, -0.52, 0));
  const bulb = LP.ellip(0.13, 0.17, 0.13, 0x6E7468, 0);
  bulb.position.y = -0.62;
  pend.add(bulb);
  pend.position.set(6.15, 1.94, 3.3);
  g.add(pend);

  /* ---------- 벽에 걸려 있던 것들의 자리 ----------
     떼어 간 것을 그리는 방법은 **자리를 그리는 것**이다. 걸려 있던 자리만 벽지가
     안 탔으니 그 사각형이 주변보다 밝다. 그리고 못은 남아 있다 — 못까지 빼 갔으면
     이사고, 못이 남아 있으면 도주다. */
  [[5.75, 1.46, 0.44, 0.34, 0.06], [6.35, 1.62, 0.30, 0.40, -0.09],
   [6.85, 1.34, 0.52, 0.36, 0.04], [2.30, 0.95, 0.36, 0.46, -0.05]]
    .forEach(([x, y, w, h, rot]) => {
      const gh = wall(w, h, D.ghost, x, y, 0.105);
      gh.rotation.z = rot * 0.3;
      wall(0.028, 0.028, 0x22282A, x, y + h / 2 - 0.05, 0.12);        // 못
      /* 자리 밑에 흘러내린 먼지 자락 — 이게 있으면 사각형이 벽지가 아니라 시간이 된다 */
      wall(w * 0.9, 0.03, D.grime, x, y - h / 2, 0.115);
    });
  /* 삐뚤어진 채 남은 시계 하나. 안 떼어 간 게 아니라 **볼 이유가 없어진 것**이다 */
  {
    const clk = new THREE.Group();
    clk.add(LP.box(0.3, 0.3, 0.05, D.pale, 0, 0, 0), LP.box(0.22, 0.22, 0.02, 0x2A3234, 0, 0, 0.035),
            LP.box(0.02, 0.09, 0.01, 0xB8BCB4, 0, 0.04, 0.05),
            LP.box(0.07, 0.02, 0.01, 0xB8BCB4, 0.03, 0, 0.05));
    clk.position.set(2.35, 1.66, 0.11);        // 2.1 은 천장 그늘에 먹혔다
    clk.rotation.z = -0.28;
    junk.add(clk);
  }
  /* 게시판이 걸려 있던 자리 — 게시판은 떼어 갔는데 **압정과 찢긴 종이 귀퉁이는
     남았다.** 위 목록의 셋째 자리(6.85) 위에 얹는다: 사각형 하나에 이야기를 두 겹으로
     얹는 게, 벽에 판을 하나 더 붙이는 것보다 싸고 세다. */
  [[-0.18, 0.11], [0.04, 0.13], [0.19, 0.02], [-0.10, -0.10]].forEach(([dx, dy], i) => {
    const c = wall(0.09, 0.10, D.paper, 6.85 + dx, 1.34 + dy, 0.13);
    c.rotation.z = 0.4 + i * 0.7;
    wall(0.02, 0.02, 0xC05A48, 6.85 + dx, 1.34 + dy + 0.03, 0.15);
  });
  /* 달력 — 뜯다 말았다. 한 장이 반쯤 찢겨 매달려 있다 */
  {
    const cal = new THREE.Group();
    cal.add(LP.box(0.42, 0.56, 0.04, D.paper, 0, 0, 0));
    cal.add(LP.box(0.42, 0.16, 0.02, 0x7A4A3C, 0, 0.20, 0.025));
    const torn = LP.box(0.34, 0.30, 0.01, 0xB0AA9A, -0.02, -0.34, 0.03);
    torn.rotation.z = 0.5;
    cal.add(torn);
    cal.position.set(0.62, 1.40, 0.11);
    cal.rotation.z = 0.13;
    junk.add(cal);
  }

  /* ---------- 물 ----------
     「음습」은 어둠이 아니라 **물기**다. 그래서 물을 한 줄로 잇는다:
     새는 이음쇠 → 벽을 타고 내린 자국 → 밑동 곰팡이 → 넘친 양동이 → 바닥 웅덩이.
     웅덩이는 살짝 발광시킨다 — 젖은 바닥은 빛을 되쏘고, 되쏘는 색이 청록이라
     방 전체가 젖어 보인다. 광원을 하나 더 두는 것보다 이게 싸고 세다. */
  {
    /* 벽 자국 — 위가 넓고 아래로 갈수록 좁아진다. 반대로 하면 물이 올라간 모양이 된다 */
    [[0.74, 0.30, 1.62], [0.52, 0.34, 1.28], [0.34, 0.32, 0.96], [0.20, 0.30, 0.66]]
      .forEach(([w, h, y]) => wall(w, h, 0x384440, 7.50, y, 0.105));
    [[-0.10, 0.9], [0.08, 0.7]].forEach(([dx, h]) =>
      wall(0.05, h, 0x2C3634, 7.50 + dx, 0.5 + h / 2, 0.112));
    /* 밑동 곰팡이 — 벽과 바닥이 만나는 선을 따라 번진다 */
    [[7.1, 0.30], [7.5, 0.42], [7.9, 0.26], [8.3, 0.18], [6.8, 0.16]].forEach(([x, w]) =>
      wall(w, 0.22, D.mold, x, 0.11, 0.115));
    /* 양동이 — 이미 넘쳤다. 며칠 됐다는 뜻이다 */
    junk.add(pipe(0.15, 0.17, 0.32, D.metal, DRIP_X, 0.16, DRIP_Z));
    junk.add(LP.box(0.04, 0.22, 0.04, D.metal, DRIP_X, 0.36, DRIP_Z));
  }

  /* 웅덩이 — 문에서 나오는 청록을 받는 자리에 큰 것 하나, 양동이 밑에 하나.
     발광이라 junk 에 안 들어간다. */
  const pool = (w, d, x, z, k) => {
    const p = LP.box(w, 0.015, d, 0x7EC8C6, x, 0.008, z);
    p.material = LP.matGlow(0x7EC8C6, k);
    p.castShadow = false; p.receiveShadow = false;
    g.add(p);
  };
  pool(1.30, 0.90, 2.30, 1.35, 0.40);
  pool(0.74, 0.56, DRIP_X, DRIP_Z + 0.05, 0.30);
  pool(0.44, 0.34, 5.10, 1.05, 0.22);

  /* ---------- 서류함 — 서랍이 다 빠져 있다 ----------
     처음에 화면 왼쪽 앞(레퍼런스의 왼쪽 찬장 자리)에 세웠는데, 거기는 청록 그늘이라
     **서랍이 빠진 게 안 보였다.** 검은 상자 하나가 서 있을 뿐이었다. 이 방의 주제를
     말하는 물건이 안 읽히면 그 물건은 없는 것과 같다.

     그래서 스탠드 빛이 닿는 자리(6.65, 1.85)로 옮겼다 — 벽 쪽, 책상 뒤. 왼쪽 프레임은
     기대 세운 문짝·접은 의자·사다리·러그가 이미 잡아 준다. 각은 살짝 틀어 둔다.
     가져갈 것은 서류였다. */
  {
    const cab = new THREE.Group();
    cab.add(LP.box(0.62, 1.32, 0.68, 0x525C5A, 0, 0.66, 0));
    cab.add(LP.box(0.66, 0.05, 0.72, 0x606A66, 0, 1.33, 0));
    /* 칸 넷: 위 둘은 서랍이 빠져 검은 구멍, 셋째는 반쯤 튀어나와 있고, 넷째는 닫혀 있다 */
    cab.add(LP.box(0.56, 0.26, 0.03, 0x101618, 0, 1.14, 0.34));
    cab.add(LP.box(0.56, 0.26, 0.03, 0x101618, 0, 0.84, 0.34));
    const open = new THREE.Group();
    open.add(LP.box(0.56, 0.26, 0.52, 0x525C5A, 0, 0, 0));
    open.add(LP.box(0.58, 0.28, 0.03, 0x5E6866, 0, 0, 0.26));
    open.add(LP.box(0.16, 0.03, 0.03, D.pale, 0, 0.02, 0.28));
    open.position.set(0, 0.54, 0.32);
    open.rotation.x = -0.06;
    cab.add(open);
    cab.add(LP.box(0.58, 0.26, 0.04, 0x5E6866, 0, 0.24, 0.355),
            LP.box(0.16, 0.03, 0.03, D.pale, 0, 0.26, 0.38));
    cab.position.set(6.65, 0, 1.85);
    cab.rotation.y = 0.28;
    junk.add(cab);
    /* 빠진 서랍 하나는 바닥에 뒤집혀 있다 */
    const drw = new THREE.Group();
    drw.add(LP.box(0.56, 0.26, 0.52, D.metal, 0, 0.13, 0));
    drw.add(LP.box(0.58, 0.04, 0.54, D.metalD, 0, 0.27, 0));
    drw.position.set(5.55, 0, 2.85);
    drw.rotation.set(0, -0.7, Math.PI * 0.03);
    junk.add(drw);
  }

  /* 쏟아진 서류 — 서류함에서 문 쪽으로 흘러간다. 골고루 뿌리면 쓰레기가 되고,
     **한 방향으로 흐르면** 누가 안고 나가다 흘린 것이 된다. 그 방향이 문 쪽이다.

     자리는 난수로 잡는데 Math.random 을 안 쓴다 — 매번 다르면 스크린샷 비교
     (spike/verify-open.js)에서 이 방이 늘 바뀌어서 회귀를 못 본다. */
  {
    let s = 7;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 34; i++){
      const t = i / 33;
      const x = 6.2 - t * 4.4 + (rnd() - 0.5) * 1.5;
      const z = 2.5 - t * 1.5 + (rnd() - 0.5) * 1.3;
      const p = LP.box(0.24 + rnd() * 0.08, 0.012, 0.19 + rnd() * 0.06, D.paper, x, 0.007 + i * 0.0004, z);
      p.rotation.y = rnd() * Math.PI;
      p.castShadow = false;
      junk.add(p);
      /* 몇 장은 겹쳐 있다 — 한 장씩 고르게 떨어진 종이는 없다 */
      if (i % 5 === 0){
        const q = LP.box(0.22, 0.012, 0.17, 0xC2BCAC, x + 0.08, 0.020, z - 0.06);
        q.rotation.y = rnd() * Math.PI; q.castShadow = false; junk.add(q);
      }
    }
  }

  /* ---------- 넘어진 의자 · 뽑힌 선 · 걷힌 러그 ----------
     셋 다 「급하게 나갔다」를 말한다. 의자는 밀려 넘어져 있고, 선은 벽에서 뽑혀
     감기지도 않은 채 늘어져 있고, 러그는 한쪽이 걷혀 접혀 있다. */
  {
    /* 뒤로 넘어가 등받이가 바닥에 붙은 자세. 옆으로 눕히면 로우폴리에서는 저게 뭔지
       안 읽힌다 — 다리 넷이 X 자로 겹쳐서 막대 뭉치가 된다. turn 인자는 안 쓴다,
       아래에서 세 축을 다 다시 잡기 때문이다. */
    const fc = recolor(LP.chair(0), [[P.fabric, 0x4C5652], [P.metalDark, 0x343C3E]]);
    fc.position.set(3.05, 0.28, 3.45);
    fc.rotation.set(-Math.PI / 2, 1.15, 0.10);
    junk.add(fc);

    /* 선 — 벽 콘센트에서 나와 바닥을 지나 아무 데도 안 닿는다 */
    const cord = [[1.60, 0.32], [1.30, 0.95], [1.50, 1.80], [2.20, 2.60], [3.10, 3.10], [4.00, 3.60], [4.80, 4.10]];
    cord.forEach(([x, z], i) => {
      if (i === 0) return;
      const [px, pz] = cord[i - 1];
      const dx = x - px, dz = z - pz, len = Math.hypot(dx, dz);
      const seg = LP.box(len, 0.035, 0.035, 0x23282A, (x + px) / 2, 0.02, (z + pz) / 2);
      seg.rotation.y = -Math.atan2(dz, dx);
      seg.castShadow = false;
      junk.add(seg);
    });
    junk.add(LP.box(0.10, 0.07, 0.05, 0x23282A, 1.60, 0.22, 0.16));    // 뽑혀 나온 플러그

    /* 러그 — 한쪽 끝이 걷혀 접혀 있다. 접힌 면이 위를 향하므로 빛을 받아 선이 생긴다 */
    const rug = LP.box(1.90, 0.03, 1.34, 0x5A403C, 6.6, 0.016, 6.25);
    rug.castShadow = false;
    junk.add(rug);
    const fold = LP.box(1.90, 0.04, 0.32, 0x4A3432, 6.6, 0.10, 5.70);
    fold.rotation.x = -0.60;
    junk.add(fold);
  }

  /* ---------- 안 끈 CRT ----------
     상자 위에 얹힌 채 켜져 있다. 아무것도 안 띄운 청록 화면 — 신호가 없다는 뜻이고,
     끄지 않고 갔다는 뜻이다. 책상 모니터는 편지 장에서 켜야 하므로(스토리 순서)
     "이미 켜져 있는 화면"은 **이쪽**이 맡는다. */
  {
    const b1 = grimyBox(false); b1.position.set(8.20, 0, 1.50); b1.scale.setScalar(0.95); junk.add(b1);
    const crtBody = new THREE.Group();
    crtBody.add(LP.box(0.52, 0.44, 0.46, 0x5A5E58, 0, 0.22, 0));
    crtBody.add(LP.box(0.46, 0.36, 0.03, 0x2A3234, 0, 0.24, 0.235));
    crtBody.position.set(8.20, 0.40, 1.45);
    crtBody.rotation.y = -0.55;
    junk.add(crtBody);
    /* 화면과 주사선은 발광이라 junk 밖. 상자 위에 얹혀 있으니 회전을 먼저 주고
       translateZ 로 제 앞면까지 밀어낸다 — 각도를 바꿀 때 좌표를 다시 안 풀어도 된다 */
    const crtGlow = (w, h, col, k, dy, dz) => {
      const m = LP.box(w, h, 0.02, col, 0, 0, 0);
      m.material = LP.matGlow(col, k);
      m.castShadow = false;
      m.position.set(8.20, 0.64 + dy, 1.45);
      m.rotation.y = -0.55;
      m.translateZ(dz);
      g.add(m);
      return m;
    };
    crtGlow(0.40, 0.30, FLUO.face, 1.0, 0, 0.25);
    crtGlow(0.36, 0.025, FLUO.panel, 1.8, 0.06, 0.26);
    crtGlow(0.36, 0.025, FLUO.panel, 1.8, -0.05, 0.26);
    const crtLight = new THREE.PointLight(FLUO.spill, 2.6, 3.4, 2);
    crtLight.position.set(8.02, 0.66, 1.80);
    g.add(crtLight);
  }

  /* ---------- 나머지 잔것 ----------
     하나하나는 아무 말도 안 하는데, 없으면 방이 무대 세트가 된다. */
  {
    /* 싸다 만 상자 — 하나는 문 앞에 놓고 갔다. 청록을 등지고 검게 실루엣이 된다 */
    [[2.05, 1.15, 0, 0.3, true], [2.95, 1.05, 0, -0.5, false], [2.45, 1.78, 0.42, 0.15, true]]
      .forEach(([x, z, y, ry, open]) => {
        const b = grimyBox(open);
        b.position.set(x, y, z); b.rotation.y = ry; b.scale.setScalar(0.9);
        junk.add(b);
      });
    junk.add(LP.box(0.34, 0.03, 0.26, 0xB8B0A0, 2.05, 0.36, 1.15));    // 뜯긴 테이프
    /* 접어 세운 의자 둘 — 아무도 안 앉는다 */
    [[1.90, 2.60, -0.22], [2.20, 3.05, -0.3]].forEach(([x, z, tilt], i) => {
      const c = new THREE.Group();
      c.add(LP.box(0.42, 0.9, 0.06, D.metalD, 0, 0.45, 0),
            LP.box(0.42, 0.06, 0.34, D.metalD, 0, 0.42, 0.16),
            LP.box(0.04, 0.9, 0.04, D.metalD, -0.19, 0.45, 0.14),
            LP.box(0.04, 0.9, 0.04, D.metalD, 0.19, 0.45, 0.14));
      c.position.set(x, 0, z); c.rotation.z = tilt; c.rotation.y = 0.3 + i * 0.2;
      junk.add(c);
    });
    /* 창 밑 라디에이터 둘 — 방이 추워 보여야 한다. 하나는 밸브가 빠져 있다 */
    [4.6, 8.4].forEach((x, i) => {
      const rad = new THREE.Group();
      for (let j = 0; j < 9; j++) rad.add(LP.box(0.07, 0.42, 0.16, D.pale, -0.36 + j * 0.09, 0.26, 0));
      rad.add(LP.box(0.9, 0.05, 0.18, D.metalD, 0, 0.5, 0));
      if (i === 0) rad.add(LP.box(0.07, 0.07, 0.07, D.metal, 0.44, 0.30, 0));
      rad.position.set(x, 0, 0.32);
      junk.add(rad);
    });
    /* 죽은 화분 — 잎은 없고 마른 줄기만 남았다. 물을 줄 사람이 없었다 */
    {
      const dp = new THREE.Group();
      dp.add(LP.box(0.40, 0.32, 0.40, 0x7A5A4A, 0, 0.16, 0));
      dp.add(LP.box(0.46, 0.06, 0.46, 0x6A4E40, 0, 0.34, 0));
      dp.add(LP.box(0.34, 0.04, 0.34, 0x3A342C, 0, 0.36, 0));
      [[0.05, 0.5, 0.4], [-0.04, 0.42, -0.6], [0.01, 0.34, 1.1]].forEach(([dx, h, rot]) => {
        const stem = LP.box(0.03, h, 0.03, 0x6E5A42, dx, 0.36 + h / 2, 0);
        stem.rotation.z = rot * 0.4;
        dp.add(stem);
      });
      dp.position.set(0.80, 0, 1.20);
      junk.add(dp);
    }
    /* 페인트 통 · 사다리 · 빗자루 — 고치다 만 것들 */
    junk.add(pipe(0.13, 0.15, 0.28, D.pale, 3.00, 0.14, 4.40));
    junk.add(LP.box(0.30, 0.03, 0.30, D.grime, 3.34, 0.06, 4.62));     // 뚜껑은 옆에 떨어져 있다
    {
      const lad = new THREE.Group();
      lad.add(LP.box(0.05, 1.9, 0.05, D.woodD, -0.19, 0.95, 0), LP.box(0.05, 1.9, 0.05, D.woodD, 0.19, 0.95, 0));
      for (let i = 0; i < 6; i++) lad.add(LP.box(0.42, 0.04, 0.04, D.woodD, 0, 0.3 + i * 0.3, 0));
      lad.position.set(0.42, 0, 2.40); lad.rotation.z = 0.14; lad.rotation.y = Math.PI / 2 - 0.3;
      junk.add(lad);
    }
    const broom = LP.box(0.045, 1.15, 0.045, D.woodD, 0, 0, 0);
    broom.position.set(1.15, 0.6, 2.15); broom.rotation.z = -0.2; junk.add(broom);
    junk.add(LP.box(0.26, 0.12, 0.10, D.grime, 1.31, 0.06, 2.15));
    /* 바닥 얼룩 — 젖은 자리와 마른 자리가 섞여 있어야 바닥이 오래돼 보인다 */
    [[3.6, 3.4, 0.9], [6.2, 1.5, 0.6], [4.4, 2.2, 0.5], [6.9, 5.4, 0.8],
     [8.2, 3.4, 0.7], [2.6, 4.6, 1.1], [6.4, 7.6, 0.9]].forEach(([x, z, r]) => {
      const st2 = LP.box(r, 0.012, r * 0.8, D.grime, x, 0.008, z);
      st2.castShadow = false; junk.add(st2);
    });
    /* 콘센트와 스위치 — 벽에 아무 구멍도 없으면 벽이 종이로 보인다.
       하나는 커버가 빠져 구멍만 남았다(늘어진 선이 거기서 나온다) */
    [[3.9, 0.34], [6.4, 0.34], [8.7, 0.34], [5.9, 1.15]].forEach(([x, y]) =>
      wall(0.11, 0.13, D.pale, x, y, 0.12));
    wall(0.12, 0.14, 0x101618, 1.60, 0.34, 0.121);
  }

  /* ---------- 앞자락 ----------
     카메라 바로 앞(화면 아래 오른쪽)이 비어 있으면 방이 저 멀리 있는 그림이 된다.
     앞·중간·뒤가 다 채워져야 화면에 깊이가 생기고, 앞자락은 **알아볼 필요가 없는 것**
     이어야 한다 — 뭔지 알아보려고 눈이 멈추면 그건 앞자락이 아니라 주인공이다.
     그래서 종이 몇 장과 구겨진 덩이 둘. 스탠드 빛을 받아 밝게 튄다. */
  {
    /* 자리는 눈으로 못 잡는다 — 카메라에 가까울수록 화각이 확 벌어져서 "화면 아래
       오른쪽"이라고 짐작해 놓은 곳이 실제로는 프레임 밖이었다(첫 판이 그랬다).
       카메라 시작 자리(8.70, 9.20)에서 바닥이 화면 아래 모서리에 닿는 거리가 3.3 이고,
       거기부터가 앞자락이 보이는 띠다. 밀고 들어가면서 이것들은 화면 밖으로 빠진다 —
       앞자락이 화면을 스쳐 나가는 것이 곧 "들어가고 있다"는 신호다. */
    let s2 = 19;
    const r2 = () => (s2 = (s2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    [[5.85, 7.15], [6.45, 6.85], [7.15, 6.55], [7.85, 6.15], [8.40, 5.80], [6.85, 7.35], [7.55, 7.00]]
      .forEach(([x, z], i) => {
        const p = LP.box(0.26 + r2() * 0.10, 0.012, 0.20 + r2() * 0.07, i % 3 ? D.paper : 0xBEB8A8,
                         x, 0.024 + i * 0.0005, z);
        p.rotation.y = r2() * Math.PI;
        p.castShadow = false;
        junk.add(p);
      });
    /* 구겨서 던진 것 둘. 편 종이만 있으면 흘린 것이고, 구긴 것이 섞이면 **버린 것**이다 */
    [[6.20, 7.05, 0.09], [7.40, 6.70, 0.07]].forEach(([x, z, r]) => {
      const b = LP.ellip(r * 2, r * 1.7, r * 2, D.paper, 0);
      b.position.set(x, r * 0.85, z);
      junk.add(b);
    });
  }

  /* 굽는다 — 여기까지가 정적인 것 전부다. 드로우콜은 CCOpen.debug() 로 확인한다.
     발광(형광등·CRT·웅덩이·스탠드 갓)·움직이는 것(전구·넘어진 의자)·그림 붙은 판(창)은
     junk 밖에 있으므로 이 호출이 건드리지 않는다. */
  collapse(junk, { flatShading: true });
  g.add(junk);

  g.userData = { desk, screen, monLight, pend, win: wr, plate, tube, ceil, lampLight, doorLight, ceilLight };
  g.visible = false;
  return g;
}

/* ============================================================
   연출 — 장(章) 목록. 각 장은 카메라 두 지점과 시간만 갖는다.
   ============================================================ */
const smooth = k => k * k * (3 - 2 * k);

/* 죽어가는 형광등의 세기 배율 [0.22, 1].

   사인파로 흔들면 "숨 쉬는 등"이 되는데 그건 **살아 있는 등**이다. 죽어가는 등은
   거의 안 변하다가 갑자기 뚝 끊긴다. 그래서 기본값을 1 에 붙여 두고, 주기가 서로
   안 맞아떨어지는 파동 둘로 문턱(0.86)을 넘는 짧은 구간에만 떨어뜨린다 —
   10초에 한 번, 0.5초쯤. 그 정도라야 "고장" 이고, 더 자주면 나이트클럽이 된다.

   난수를 안 쓴다: 스크린샷 회귀(spike/verify-open.js)는 같은 시각에 같은 밝기가
   나와야 비교가 되고, jump(id, at) 도 시간만으로 그 장을 되돌릴 수 있어야 한다.
   그래서 부르는 쪽도 **장 기준 시각(chT)** 을 넘긴다.

   덤: chT=0 이 마침 문턱 안이라 장이 열릴 때 등이 한 번 꺼졌다 들어온다. 그 구간이
   페이드(2.4초)와 겹쳐서, 화면이 밝아지는 것과 등이 돌아오는 것이 같이 온다. */
function flick(t){
  if (Math.sin(t * 0.61 + 1.3) > 0.86) return 0.22 + 0.30 * Math.abs(Math.sin(t * 9.7));
  return 0.92 + 0.08 * Math.sin(t * 9.7) * Math.sin(t * 2.31);
}

const CH = [
  { id:'rain',  dur:12,   set:'alley',
    from:[1.5, 0.42, 8.2,  0.1, 1.0, 1.2], to:[0.7, 0.40, 5.0, -0.3, 1.1, 0.6], fadeIn:1.6 },
  /* 전단은 끝까지 다 보여야 한다 — 더 붙으면 제목이 잘리고, 잘린 전단은 단서가 아니다.
     그래서 붙는 대신 **아래로 기울인다**(target y 가 내려간다): 시선이 탭으로 간다. */
  { id:'flyer', dur:15,   set:'alley',
    from:[-1.01, 0.72, 4.67, -1.70, 1.00, 2.17], to:[-1.25, 0.94, 3.85, -1.73, 0.92, 2.17] },
  /* 통화는 물건이 아니라 장면이다 — 전화기에 붙으면 초록 판만 남는다.
     부스 전체(디딤돌·지붕·간판)와 뒤의 비, 그리고 디딤돌에 고인 초록 빛이
     같이 보이는 거리(2.9→2.2)에서 잡는다. 과녁은 부스의 가슴 높이. */
  { id:'call',  dur:18,   set:'alley',
    from:[1.36, 1.14, 0.66, -1.90, 0.94, -1.08], to:[0.65, 1.00, 0.28, -1.92, 0.96, -1.08], fadeOut:1.4 },
  { id:'dark',  dur:7.6,  set:'none', from:[0,1,0, 0,1,-1], to:[0,1,0, 0,1,-1] },
  /* 사무실은 **대각선으로** 잡는다. 정면(x=6에서 z 축을 따라 들어가는 것)이 앞판이었고,
     그때는 방이 좌우 대칭인 상자로 보였다 — 대칭인 방은 어질러져도 어질러져 보이지 않는다.
     남동쪽 구석(8.9, 9.6)에서 서북쪽(5.2, 3.2)을 보면 화면이 세 겹으로 갈린다:

       왼쪽 위  청록 문 (x=1.5) — 화면 22% 왼쪽, 28% 위
       가운데   책상 (x=6, z=4)
       오른쪽   스탠드 (x=7.7, z=3.05) — 화면 60% 오른쪽

     따뜻한 것과 차가운 것이 대각으로 마주 보고, 그 사이를 책상이 가른다.
     아래쪽 프레임에는 넘어진 의자와 흘린 서류가 걸린다 — 앞·중간·뒤가 다 채워진다.
     방 높이가 1.9 인데 카메라가 1.32 이므로 천장 배관(y 2.7)이 화면 위쪽 절반에 들어온다. */
  { id:'desk',  dur:17,   set:'office',
    from:[8.70, 1.38, 9.20, 5.10, 0.94, 3.00], to:[8.00, 1.24, 7.60, 5.30, 0.88, 3.20], fadeIn:2.4 },
  /* 편지는 책상 쪽으로 붙되 정면으로 돌지 않는다 — 스탠드 갓이 오른쪽 위에 남아야
     편지를 읽는 동안에도 이 방이 어떤 방인지 계속 보인다. */
  { id:'letter', dur:Infinity, set:'office',
    from:[7.30, 1.10, 6.90, 6.00, 0.86, 4.10], to:[7.05, 1.05, 6.40, 6.02, 0.86, 4.14] },
];

/* ============================================================
   재생
   ============================================================ */
let st = null;             // 재생 중 상태 (하나만 돈다)

/* 지금 돌고 있는 컷신의 비용. 물건을 늘릴 때 숫자로 확인할 자리다 —
   CCOpen.debug() 로 콘솔에서 바로 본다. */
export function debug(){
  if (!st) return null;
  let meshes = 0, lights = 0;
  st.scene.traverse(o => { if (o.isMesh) meshes++; else if (o.isLight) lights++; });
  return { meshes, lights, ch: CH[st.ci] && CH[st.ci].id };
}

function el(tag, cls, parent, html){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  (parent || document.body).appendChild(e);
  return e;
}

function letterHTML(replay){
  const t = LETTER[typeof LANG !== 'undefined' && LETTER[LANG] ? LANG : 'ko'];
  return `<div class="oletterbox">
    <div class="olhead"><span>${t.to}</span><span>${t.from}</span></div>
    <p class="ollead">${t.lead}</p>
    <ol class="olist">${t.items.map(s => `<li>${s}</li>`).join('')}</ol>
    <p class="olout">${t.out}</p>
    <p class="olsign">${t.sign}</p>
    <div class="olfoot">${t.foot}</div>
    <button class="olgo" id="oLetterGo">${replay ? t.close : t.go}</button>
  </div>`;
}

export function play(opt = {}){
  if (st) return st.done;                      // 두 번 겹쳐 돌리지 않는다
  const replay = !!opt.replay;

  /* 그림체는 게임과 같은 것을 쓴다. render3d 가 이미 정해 놨으면 손대지 않는다 —
     setKit 은 캐시를 비우므로 이유 없이 부르면 게임 쪽 캐시까지 날린다.
     3D 를 꺼 둔 사람은 render3d 가 아예 안 돌아서 KIT 이 초기값(sharp)으로 남는다.
     그때는 지금 그림체에 맞는 것을 여기서 세운다. */
  if (LP.KIT.prim !== 'round')
    LP.setKit(EERIE.ON ? EERIE.KIT : { prim:'round', bevel:0.055, shading:'smooth', detail:1 });

  const dead = [];                             // 이 컷신이 만든 것만 나중에 버린다
  const root = el('div', 'opening', document.body);
  const canvas = el('canvas', 'ocanvas', root);
  el('div', 'obar top', root);
  el('div', 'obar bot', root);
  const sub = el('div', 'osub', root, '<span></span>');
  const fade = el('div', 'ofade', root);
  const skip = el('div', 'oskip', root, T(UI.skip));
  const hint = el('div', 'ohint', root, T(UI.next));
  const gate = el('div', 'ogate', root,
    `<button class="ogo">${T(UI.gate)}</button><div class="ogate2">${T(UI.gate2)}</div>`);
  const letter = el('div', 'oletter', root, letterHTML(replay));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'low-power' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x101426, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101426, 8, 32);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 120);

  /* ---------- 현상액 한 벌 ----------
     후처리는 게임과 같은 패스를 한 벌 더 얹는다(질감 — 저해상도·디더·색보정·비네트).

     **값은 게임과 반대 방향이다.** 게임의 사무실은 "같이 있어 주는 방" 이라 그늘을
     들어 올렸는데, 프롤로그는 혼자인 밤이라 그늘이 그늘로 남아야 한다. 같은 패스,
     다른 값 — 그게 이 파일이 패스를 인스턴스로 만든 이유이기도 하다.

     ── 세트별 두 벌이었다가 한 벌로 합쳤다 ──
     골목과 사무실이 각각 자기 색보정을 갖고 있었고, 그 둘의 스플릿 톤이 **정반대**였다:

       골목  lift(.018 .020 .034) 파란 그늘 · gain(.945 .96 1.00) **찬 하이라이트**
       사무실 lift(.010 .042 .044) 청록 그늘 · gain(1.00 .965 .905) 호박 하이라이트

     그러면 두 장면이 다른 필름으로 찍힌 것이 되고, 컷이 넘어가는 순간 관객이 그걸 안다.
     그리고 골목 쪽은 그 자체로 앞뒤가 안 맞았다 — 골목의 주광은 **나트륨 가로등**인데
     gain 이 하이라이트를 파란 쪽으로 밀고 있었다. 자기 등불을 자기가 식히고 있었던 셈이다.

     지금은 사무실 쪽 방향으로 한 벌이다(청록 그늘 + 호박 하이라이트). 두 세트 다
     조명이 이미 그 짜임이라서 — 따뜻한 등 하나 대 청록 형광 — 현상액이 그걸 따라간다.

     **장면이 달라지는 것은 노출뿐이다**(EXPO). 그건 룩이 아니라 밝기다: 골목은 등
     하나로 버티는 밤 외부고 사무실은 벽이 빛을 되받는 실내라, 같은 값으로 두면
     골목이 어둡다. 색은 안 건드린다 — 색을 건드리는 순간 다시 두 벌이 된다. */
  const post = EERIE.cutscenePass(renderer, scene, camera);
  const LOOK = {
    uSat:      0.62,                    // 골목 .54 / 사무실 .66 의 사이. 청록은 빼면 회색이 된다
    uContrast: 1.22,
    uGrain:    0.052,
    uVig:      0.58,
    uLift: [0.012, 0.038, 0.042],       // 그늘은 청록
    uGain: [1.00, 0.970, 0.920],        // 밝은 데는 호박
  };
  if (post) for (const k in LOOK) post.set(k, LOOK[k]);
  /* 노출만 장면마다. mood() 가 갈아 끼운다. */
  const EXPO = { alley: 1.04, office: 0.94 };

  /* 두 세트의 빛은 성격이 반대다. 골목은 **광원 하나(가로등)** 로 버티고,
     사무실은 방이 비어 있다는 게 보여야 하므로 전체를 조금 올린다.
     같은 씬을 쓰니 장이 바뀔 때 이 둘을 갈아 끼운다. */
  const hemi = new THREE.HemisphereLight(0x44506E, 0x1D2130, 0.58);
  const moon = new THREE.DirectionalLight(0x8494B2, 0.42);
  moon.position.set(-6, 12, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left:-14, right:14, top:14, bottom:-14, near:0.5, far:60 });
  scene.add(hemi, moon);
  const MOOD = {
    /* 골목: 전역광을 더 내리고 안개를 당겼다. 빛은 가로등 하나가 거의 전부여야 하고,
       안개가 가까울수록 골목 끝이 "어딘가로 이어진 길" 이 아니라 "안 보이는 곳" 이 된다.
       달빛도 푸른 흰색에서 납빛으로 — 하늘이 맑으면 이 밤이 안 우울하다.
       그 납빛을 청록 쪽으로 한 번 더 돌렸다(0x8494B2 → 0x8CA8B0). 배경색도 같이
       (0x101426 → 0x0C1A20) — 골목 끝이 녹아드는 색이 사무실의 안개 색과 같은 계열이라야
       두 방이 같은 밤이 된다. 색상은 옮겼고 **밝기와 채도는 그대로**다. */
    alley:  { sky:0x3C5866, ground:0x18242A, hemi:0.58, sun:0x8CA8B0, dir:0.42, bg:0x0C1A20, fog:[8, 32] },
    /* 사무실: **밝기가 아니라 색으로** 음습하게 만든다.
       앞판은 sky 0xE8D4B6(따뜻한 크림) · hemi 0.30 이었다. 방이 비어 있는 게 보이긴 했는데
       색이 하나라 그냥 어둑한 사무실이었다. 지금은 hemi 를 **올리고**(0.30 → 0.46)
       그 전역광을 청록으로 바꿨다 — 밝아졌는데 더 음습하다. 그늘이 검정이 아니라
       청록이면 그늘 자체가 색을 갖고, 스탠드 밑 한 웅덩이만 다른 편이 된다.

       dir(방향광)은 **스탠드 쪽에서 온다**: 점광원은 그림자를 못 던지므로(큐브맵 6장)
       그림자를 스탠드 반대편으로 눕히려면 방향광이 그 자리를 대신해야 한다. 색도 따뜻하다.
       세기는 낮게 — 방을 밝히는 게 아니라 그림자를 만드는 게 일이다.

       안개는 확 당겼다(22→4). 12×10 방에서 far 52 는 아무 일도 안 하는 값이었다.
       카메라에서 북쪽 벽까지가 9.7 이므로 [4, 20] 이면 벽에 36% 쯤 걸린다 —
       뒤쪽이 청록으로 녹아서 방 깊이가 생기고, 문에서 나오는 빛이 공기에 뜬다. */
    office: { sky:0x2C6A66, ground:0x0E2422, hemi:0.46, sun:WARM, dir:0.15, bg:0x081C1E, fog:[4, 20] },
  };
  function mood(which){
    const m = MOOD[which] || MOOD.alley;
    hemi.color.setHex(m.sky); hemi.groundColor.setHex(m.ground); hemi.intensity = m.hemi;
    moon.color.setHex(m.sun); moon.intensity = m.dir;
    /* 사무실의 방향광은 스탠드(7.7, 3.05) 위에서 책상 쪽으로. 그림자가 왼쪽 앞으로 눕는다 */
    if (which === 'office'){ moon.position.set(9.6, 5.2, 2.2); moon.target.position.set(5.4, 0, 5.2); }
    else { moon.position.set(-6, 12, 6); moon.target.position.set(0, 0, 0); }
    moon.target.updateMatrixWorld();
    renderer.setClearColor(m.bg, 1);
    scene.fog.color.setHex(m.bg);
    scene.fog.near = m.fog[0]; scene.fog.far = m.fog[1];
    if (post) post.set('uExposure', EXPO[which] || 1.0);   // 색은 LOOK 이 쥔다
  }
  scene.add(moon.target);

  const alley = alleySet(dead);
  const office = officeSet(dead);
  scene.add(alley, office);

  const target = new THREE.Vector3();
  st = {
    ci: -1, t: 0, chT: 0, raf: 0, started: false, ended: false,
    line: '', bed: null, replay,
    root, renderer, scene, camera, post, dead, alley, office, letter, sub, fade, skip, hint,
  };
  st.done = new Promise(res => { st.resolve = res; });

  const fit = () => {
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    if (post) post.resize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  fit();
  addEventListener('resize', fit);
  st.fit = fit;

  /* ---------- 장 전환 ---------- */
  function enter(i){
    st.ci = i; st.chT = 0;
    const ch = CH[i];
    alley.visible = ch.set === 'alley';
    office.visible = ch.set === 'office';
    if (ch.set !== 'none') mood(ch.set);
    st.line = ''; sub.firstChild.textContent = ''; sub.classList.remove('on');
    st.cue = -1;

    if (ch.id === 'rain'){
      st.bed = st.bed || rainBed();
      st.bed.set(0.09, 2600, 2.2);
    }
    if (ch.id === 'flyer') SND.paper();
    if (ch.id === 'call'){
      SND.hook();
      SND.dtmf();
      setTimeout(() => SND.ring(2), 2450);
    }
    /* 암전 — 화면이 검으니 이 장의 내용은 전부 소리다. 그래서 한 마리가 아니라
       **여러 마리가 몰려온 소리**를 깐다: 젤리 발소리가 겹치고, 울음이 네 번 다른
       음으로 나고, 알아들을 수 없는 웅성거림이 뒤에 깔리고, 뭔가 끌리고 부딪힌다.
       마지막에 방울 하나만 남기고 조용해진다 — 그 방울이 총무다. */
    if (ch.id === 'dark'){
      if (st.bed) st.bed.set(0.02, 500, 0.6);
      [0.7, 1.05, 1.3, 1.55, 1.9, 2.2, 2.45, 2.7, 3.0, 3.3, 3.55, 3.9, 4.2, 4.5]
        .forEach(t => SND.paw(t + Math.random() * 0.08));
      [0.55, 1.15, 1.8, 2.35, 3.1, 3.8].forEach(t => SND.step(t));
      SND.meow(0.9, 700); SND.meow(1.85, 520); SND.meow(2.9, 880); SND.meow(4.1, 610);
      SND.chat(1.4, 360); SND.chat(2.6, 430); SND.chat(3.4, 320); SND.chat(4.6, 400);
      SND.clank(2.15); SND.clank(4.35);
      SND.drag(3.2);
      SND.bell(6.1);
    }
    if (ch.id === 'desk'){
      if (st.bed) st.bed.set(0.045, 700, 1.8);       // 실내 — 창 너머로만 들린다
      /* 첫 물방울은 페이드가 걷힌 다음에 떨어뜨린다(fadeIn 2.4). 검은 화면에서
         물이 떨어지면 그건 앞 장(암전)의 소리로 들린다. */
      st.dripAt = 2.8;
      st.buzzed = false;
    }
    if (ch.id === 'letter'){
      /* 화면 색도 표에서. 앞판은 0xCDEAF2(푸르스름한 흰빛)이라 같은 방의 CRT 와
         다른 인광이었다 — 한 사무실에 화면이 둘인데 색이 다르면 그건 두 건물이다. */
      office.userData.screen.material = LP.matGlow(FLUO.face, 0.95);
      office.userData.monLight.intensity = 5;
      SND.power();
      letter.classList.add('on');
      skip.style.display = 'none';
      hint.style.display = 'none';
      /* 여기서부터는 게임의 음악이다 — 컷신 동안 눌러 뒀던 BGM 을 이제 풀어준다 */
      try { window.__introAudio = false; if (typeof music !== 'undefined') music.sync(); } catch(e){}
      const go = letter.querySelector('#oLetterGo');
      if (go) go.onclick = () => finish();
    }
  }

  function next(){
    if (st.ci + 1 < CH.length) enter(st.ci + 1);
    else finish();
  }
  /* at 을 주면 그 장의 그 시각으로 바로 간다. 검사에서 쓴다 —
     소프트웨어 렌더(headless)는 초당 두 프레임이라 실시간으로 기다리면
     12초짜리 장의 자막이 영원히 안 뜬다. */
  function jump(id, at){
    const i = CH.findIndex(c => c.id === id);
    if (i < 0) return;
    enter(i);
    if (at) st.chT = at;
    if (st.started) step(0);
  }
  st.jump = jump;

  /* ---------- 자막 ---------- */
  function cues(ch, t){
    const list = LINES[ch.id] || [];
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (t >= list[i][0]) idx = i;
    if (idx === st.cue) return;
    st.cue = idx;
    if (idx < 0){ sub.classList.remove('on'); return; }
    const [, text, who] = list[idx];
    sub.firstChild.textContent = T(text);
    sub.classList.add('on');
    sub.classList.toggle('them', who === 'them');
    if (ch.id === 'call'){
      if (who === 'them') SND.them();
      else if (/뚝|click|ツーッ/.test(T(text))) SND.hang();
      else SND.me();
    }
  }

  /* ---------- 프레임 ----------
     시간 전진(step)과 프레임 호출(frame)을 나눠 둔다. jump(id, at) 가 같은 step 을
     dt=0 으로 불러서 "그 시각의 한 장"을 만들 수 있어야 하기 때문이다. */
  function step(dt){
    st.t += dt; st.chT += dt;
    const ch = CH[st.ci];
    const k = ch.dur === Infinity ? Math.min(1, st.chT / 6) : Math.min(1, st.chT / ch.dur);
    const e = smooth(k);
    const f = ch.from, o = ch.to;
    camera.position.set(f[0] + (o[0]-f[0])*e, f[1] + (o[1]-f[1])*e, f[2] + (o[2]-f[2])*e);
    target.set(f[3] + (o[3]-f[3])*e, f[4] + (o[4]-f[4])*e, f[5] + (o[5]-f[5])*e);
    camera.lookAt(target);

    cues(ch, st.chT);

    /* 검은 막 — 장의 앞뒤로만 쓴다. 암전 장은 통째로 검다. */
    let op = 0;
    if (ch.id === 'dark') op = 1;
    else {
      if (ch.fadeIn && st.chT < ch.fadeIn) op = 1 - st.chT / ch.fadeIn;
      if (ch.fadeOut && ch.dur !== Infinity && st.chT > ch.dur - ch.fadeOut)
        op = (st.chT - (ch.dur - ch.fadeOut)) / ch.fadeOut;
    }
    fade.style.opacity = op.toFixed(3);

    if (alley.visible){
      alley.userData.rain.update(dt);
      /* 가로등이 아주 조금 흔들린다 — 정지 화면이 아니라는 신호 */
      /* 배경을 어둡게 내린 만큼 등불은 올린다. 우울함은 "고른 어둠" 이 아니라
         **빛 하나와 그 밖**에서 온다 — 배경만 내리면 그냥 안 보이는 골목이 된다. */
      alley.userData.lamp.intensity = 26 + Math.sin(st.t * 2.3) * 1.8;
      if (ch.id === 'call'){
        /* 수화기가 거치대에서 떠올라 기운다 — 가로 수화기라 z 회전이 곧 「들었다」다.
           제자리 높이는 수화기가 스스로 들고 있다(userData.restY) — 여기 상수를 박아
           두면 전화기를 고칠 때마다 이 줄이 같이 낡는다. */
        const h = alley.userData.phone.userData.handset;
        h.position.y = (h.userData.restY || 0.92) + Math.min(0.09, st.chT * 0.05);
        h.rotation.z = Math.min(0.35, st.chT * 0.2);
      }
    }
    if (office.visible){
      const U = office.userData;
      U.win.update(dt);
      /* 갓 없는 알전구가 전선에 매달려 흔들린다. 진폭을 앞판(0.012)보다 네 배 크게 준다 —
         갓이 있는 펜던트는 무거워서 안 흔들리지만 알전구는 흔들리고, 이 방에서 스스로
         움직이는 것이 이것 하나뿐이라 "정지 화면이 아니다" 를 혼자 맡고 있다.
         주기를 둘 겹쳐서 왕복이 딱 맞아떨어지지 않게 한다. */
      U.pend.rotation.z = Math.sin(st.t * 0.9) * 0.05 + Math.sin(st.t * 1.37) * 0.018;
      U.pend.rotation.x = Math.sin(st.t * 0.74 + 1.1) * 0.03;

      /* 형광등 둘 — 위상을 어긋나게 준다. 같이 깜빡이면 조명 고장이 아니라
         누가 스위치를 누르는 것으로 보인다. 발광 면과 광원을 **같은 값으로** 움직여야
         한다: 광원만 흔들면 관은 계속 켜져 있고, 관만 흔들면 방이 안 어두워진다. */
      /* 장 기준 시각(chT)으로 흔든다. 전체 경과(st.t)로 하면 같은 장의 같은 시각인데도
         앞 장들을 얼마나 빨리 넘겼느냐에 따라 밝기가 달라져서, 스크린샷 회귀도
         jump(id, at) 도 재현이 안 된다. */
      const f1 = flick(st.chT), f2 = flick(st.chT * 0.83 + 4.7);
      U.doorLight.intensity = 9 * f1;
      U.tube.material.emissiveIntensity = 2.2 * f1;
      U.ceilLight.intensity = 6 * f2;
      U.ceil.material.emissiveIntensity = 1.1 * f2;
      if (f1 < 0.6){ if (!st.buzzed){ st.buzzed = true; SND.buzz(); } }
      else if (f1 > 0.8) st.buzzed = false;

      /* 물방울 — 2초쯤에 한 번. 정확히 2초면 메트로놈이 되므로 간격을 흔든다 */
      st.dripAt = (st.dripAt || 0) - dt;
      if (st.dripAt <= 0){ st.dripAt = 1.9 + Math.random() * 1.6; SND.drip(); }
    }

    if (post) post.render();
    else renderer.render(scene, camera);
    if (k >= 1 && ch.dur !== Infinity) next();
  }

  let last = 0;
  function frame(now){
    if (st.ended) return;
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (st.started) step(dt);
  }

  /* ---------- 조작 ---------- */
  const onKey = e => {
    if (st.ended) return;
    if (e.key === 'Escape'){ e.preventDefault(); jump('letter'); }
    else if (e.key === ' ' && st.started && CH[st.ci].id !== 'letter'){ e.preventDefault(); next(); }
  };
  addEventListener('keydown', onKey);
  st.onKey = onKey;

  skip.onclick = e => { e.stopPropagation(); jump('letter'); };
  canvas.onclick = () => { if (st.started && CH[st.ci].id !== 'letter') next(); };

  gate.querySelector('.ogo').onclick = () => {
    gate.remove();
    ctx();                                     // 사용자 제스처 안에서 오디오를 깨운다
    st.started = true;
    enter(0);
  };

  /* ---------- 정리 ---------- */
  function finish(){
    if (st.ended) return;
    const s = st;
    s.ended = true;
    cancelAnimationFrame(s.raf);
    removeEventListener('resize', s.fit);
    removeEventListener('keydown', s.onKey);
    if (s.bed) s.bed.stop();
    s.root.classList.add('out');
    setTimeout(() => {
      s.root.remove();
      /* LP 캐시(지오메트리·재질)는 게임의 렌더러와 공유한다 — 버리면 안 된다.
         여기서 버리는 것은 이 컷신이 직접 만든 것뿐이다. */
      s.dead.forEach(d => { try { d.dispose(); } catch(e){} });
      try { if (s.post) s.post.dispose(); } catch(e){}
      try { s.renderer.dispose(); } catch(e){}
    }, 520);
    st = null;
    try { window.__introAudio = false; if (typeof music !== 'undefined') music.sync(); } catch(e){}
    s.resolve({ replay: s.replay });
  }
  st.finish = finish;

  requestAnimationFrame(frame);
  return st.done;
}

export function playing(){ return !!st; }
/* 검사용 — spike/verify-open.js 가 장·시간·자막을 이걸로 확인한다 */
export function state(){
  return st ? { ch: CH[st.ci] && CH[st.ci].id, chT: +st.chT.toFixed(2), cue: st.cue,
                started: st.started, sub: st.sub.firstChild.textContent } : null;
}
export function jump(id, at){ if (st && st.jump) st.jump(id, at); }
export function finish(){ if (st && st.finish) st.finish(); }

/* 게임 나머지는 클래식 스크립트라 전역으로 부른다 (render3d.js 와 같은 규약). */
window.CCOpen = { play, playing, jump, finish, state, debug, ready:true };
