/* ============================================================
   ui.js — 렌더링과 입력
   ============================================================ */

/* 렌더 대상 문서. 보통은 이 탭이지만, 🪟 로 떠 있는 창(Document PiP)에
   나가면 #app 이 그 문서로 옮겨 가므로 여기가 갈아끼워진다 (js/widget.js).
   $ 를 document 에 직접 묶어 두면 그 순간 전부 null 이 된다. */
let DOC = document;
const $  = s => DOC.querySelector(s);
const $$ = s => Array.from(DOC.querySelectorAll(s));

/* ---------- 글을 다 쓴 순간 ----------
   한글·일본어는 **조합**을 거쳐 글자가 된다. 조합 중에 누른 엔터는 "보내기"가 아니라
   "이 글자로 확정" 이고, 그때 input.value 에 마지막 음절이 들어와 있는지는 브라우저와
   입력기마다 다르다. keydown 에서 바로 올리면 「대청소 빨래하」가 올라가고 입력칸에는
   확정된 「기」가 남는다 — 다음 엔터에 그게 업무 한 줄이 된다. 실제로 그 신고가 왔다.

   그래서 엔터는 **조합이 끝난 뒤에만** 처리한다. 확정이 keyup 보다 늦게 오는 입력기도
   있어서(안드로이드), compositionend 와 keyup 중 **먼저 온 쪽**이 한 번만 실행한다.
   버튼으로 올리는 길은 press() 로 같이 지나가야 한다 — 사파리는 버튼을 눌러도
   입력칸에서 포커스가 안 빠져서 조합이 그대로 살아 있다. */
function onTextSubmit(el, fn){
  if (!el) return { press(){}, composing: () => false };
  /* **일본어는 다르다.** 그쪽에서 조합 중의 엔터는 보내기가 아니라 **변환 확정**이다
     (そうじ → 掃除를 고르는 그 엔터). 그걸 올리기로 받으면 한자를 고르는 순간 서류가
     올라간다 — 한국어의 버그를 고치면서 일본어에 같은 급의 버그를 만드는 셈이다.
     그래서 ja 에서는 조합 중 엔터를 확정으로만 두고, 올리는 건 그 다음 엔터가 한다.
     그 화면을 쓰는 사람의 입력기 규약이 그렇다. */
  const commitOnly = LANG === 'ja';
  let composing = false;      // 지금 조합 중
  let pending = false;        // 조합 중에 엔터를 받았다 — 확정되면 올린다
  let seen = false;           // 이 줄에 조합이 한 번이라도 있었다 (아래 keyup 판단용)
  const run = () => { pending = false; seen = false; fn(); };
  const flush = () => { if (pending) run(); };

  el.addEventListener('compositionstart', () => { composing = true; seen = true; });
  el.addEventListener('compositionend', () => {
    composing = false;
    /* 확정된 글자가 value 에 들어오는 건 이 이벤트 **다음**이다 — 한 틱 넘긴다. */
    if (pending) setTimeout(flush, 0);
  });
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.repeat) return;
    /* 표시가 셋인 이유: isComposing 을 안 주는 브라우저가 있고, 안드로이드 입력기는
       조합 중인 키를 keyCode 229 로만 말한다. 하나만 보면 그 기계에서 새어 나간다. */
    if (composing || e.isComposing || e.keyCode === 229){ pending = !commitOnly; return; }
    run();
  });
  el.addEventListener('keyup', e => {
    if (e.key !== 'Enter' || composing || e.isComposing) return;
    if (pending){ run(); return; }
    /* keydown 이 아예 안 온 경우 — **입력기가 그 엔터를 먹고** 조합만 확정시켰다
       (실측: CDP 의 진짜 IME 가 그랬고, 윈도 한글 입력기도 상태에 따라 그렇다).
       그러면 사람은 엔터를 눌렀는데 아무 일도 안 일어난 것으로 보인다. 조합이 있었던
       줄에서만, 그 엔터 한 번으로 올린다. 두 번 누르게 만들지 않는다. */
    if (!commitOnly && seen && el.value.trim()) run();
  });
  /* 칸에서 손을 떼면 대기 중인 엔터는 버린다 — 나중에 저절로 올라가면 유령이다. */
  el.addEventListener('blur', () => { pending = false; });
  return {
    /* 버튼처럼 바깥에서 누르는 길. 조합 중이면 blur 로 확정을 강제하고 한 틱 뒤에 올린다.
       (사파리는 버튼을 눌러도 입력칸에서 포커스가 안 빠져서 조합이 그대로 살아 있다.
       그리고 blur 가 pending 을 지우므로 세우는 건 그 **뒤**여야 한다.) */
    press(){
      if (!composing){ run(); return; }
      el.blur();
      pending = true;
      setTimeout(flush, 0);
    },
    composing: () => composing,
  };
}

/* ---------- 렌더러 ----------
   **하나뿐이다.** 도트 렌더러는 2026-08-24 에 지웠다.

   남겨 둔 유일한 이유가 「WebGL 캔버스가 Document PiP 창을 건너가서도 사는가」였고,
   그게 미확인이라 위젯 모드를 도트로 돌렸다. 실제로 재 보니 **산다** —
   spike/pipcv.html (다른 문서로 adoptNode 한 뒤 isContextLost=false, 그린 색이 읽힌다).
   그래서 위젯도 3D 로 돌고, is3d() 에서 __pip 조각이 빠졌다.

   ?3d=0 도 같이 없앴다. 떨어질 데가 없는 비상구는 비상구가 아니다.

   is3d() 를 함수로 남겨 두는 이유: 아직 R3 가 안 올라온 몇 초가 있고(모듈은 항상
   지연된다) 그때는 그릴 것이 없다. 「3D 인가」가 아니라 「무대가 섰는가」를 묻는 함수다. */
const is3d = () => typeof R3 !== 'undefined' && R3 && R3.ready;

/* ---------- 무대가 **올 예정**인 상태 ----------
   클래식 스크립트는 동기로 돌고 render3d.js 는 모듈이라 그 뒤에 평가된다(모듈은 항상
   지연된다). 그래서 boot() 이 처음 그리는 순간에는 R3 가 없다.

   그 몇 초는 **빈 무대**로 둔다. 잘못 그린 사무실보다 아직 안 그린 사무실이 낫다:
   전자는 사고로 읽히고 후자는 로딩으로 읽힌다.

   포기하는 조건 둘. 이게 없으면 영영 빈 화면이 된다:
     · window.__r3fail  — 모듈을 못 불러왔거나(index.html 의 onerror)
                          init 이 던졌다(render3d.js autostart)
     · R3_WAIT 초과     — 위 둘에 안 걸리는 이상한 경우의 최후 보험
   포기한 뒤에는 이제 떨어질 도트판이 없으므로 **왜 못 그렸는지 말해 준다**
   (renderTiles 의 stageFail). 빈 화면은 사고이고, 문장 하나는 사고 보고다. */
const R3_WAIT = 12000;
const pending3d = () => !window.__r3fail
  && !(typeof R3 !== 'undefined' && R3 && R3.ready)
  && performance.now() < R3_WAIT;
/* 고양이가 **깎은 조형**인가. 조형이면 색이 uniform 이라 털색·색조가 그대로 의미를 갖고,
   손그림이면 그림 파일 자체가 그 고양이라 색을 고르는 게 아무 일도 안 한다.
   채용창·계약서가 무엇을 고르게 할지는 이 하나로 갈린다. */
const sculptCats = () => is3d() && (!R3.getCatLook || R3.getCatLook() === 'sculpt');

/* 말풍선·숫자가 붙는 레이어. 무대가 캔버스 하나라 글자는 그 위에 얹는 DOM 이다 —
   3D 안에 글자를 넣으면 글꼴도 i18n 도 잃는다. */
function fxLayer(){
  let el = $('#fx3d');
  if (!el){
    el = DOC.createElement('div');
    el.id = 'fx3d';
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:40';
    $('#viewport').appendChild(el);
  }
  return el;
}

/* setRender3d · officeToneLabel · catLookLabel 은 설정 스위치와 함께 지웠다.
   그림체 전환(body.eerie)은 이제 js/three/eerie.js 가 모듈을 올릴 때 한 번 건다. */

/* ---------- 카메라 ----------
   시뮬레이션은 벽으로 둘러싼 격자를 그대로 쓰지만, 화면에는 그 전부를 보여주지 않는다.
   사방이 벽으로 닫힌 상자는 답답하다.

   - 양옆 벽(x=0, W-1)은 안 그린다 → 좌우가 트여서 사무실이 넓어 보인다
   - 아래 벽줄(y=H-1)은 안 그린다 → 그 줄에 있는 출입문도 화면 밖으로 나간다
     (문은 NPC의 등·퇴장 지점으로 여전히 살아 있다. 화면에만 안 보인다)
   - 대신 위쪽에 벽을 한 줄 더 얹어 **상단 벽을 두 칸 높이로** 보여준다.
     한 줄만 있으면 벽이 종이처럼 얇아서 방으로 안 읽힌다. */
let uiSize = 's', uiTab = 'staff', selCat = null;
/* 소리는 **손잡이 하나**다 — 0 이면 음소거고, 그 위는 크기다.
   전에는 툴바의 🔊 토글(켜짐/꺼짐)뿐이었다. 켜고 끄는 것과 크기를 줄이는 것이 따로 있으면
   "껐는데 왜 소리가 나지"(볼륨만 0)나 "켰는데 왜 조용하지"(볼륨이 0)가 생기므로,
   슬라이더 하나로 합치고 0 을 음소거 자리로 쓴다. 만지는 곳은 사무실의 CD 플레이어다.

   soundOn 은 남겨 둔다 — 효과음마다 걸려 있는 문지기라 지우면 스무 군데를 고쳐야 하고,
   지금은 "음량이 0 이 아니다"와 같은 말이다. */
let soundVol = 0.7;
try {
  const v = localStorage.getItem('copycat.vol');
  if (v !== null) soundVol = Math.max(0, Math.min(1, Number(v) || 0));
  else if (localStorage.getItem('copycat.sound') === '0') soundVol = 0;   // 옛 저장의 음소거를 잇는다
} catch(e){}
let soundOn = soundVol > 0;
/* 0~1. 0 이면 음소거. 효과음·BGM·유튜브가 전부 이 값을 곱한다. */
function setVolume(v){
  soundVol = Math.max(0, Math.min(1, v));
  soundOn = soundVol > 0;
  try {
    localStorage.setItem('copycat.vol', String(soundVol));
    localStorage.setItem('copycat.sound', soundOn ? '1' : '0');
  } catch(e){}
  try { music.sync(); music.volumeChanged && music.volumeChanged(); } catch(e){}
  return soundVol;
}

/* ---------- 사운드 (WebAudio, 외부 파일 없음) ---------- */
let actx = null;
function beep(freq, dur, type, gain, slide){
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    /* 첫 입력 전에 만들어진 컨텍스트는 자동재생 정책에 걸려 정지 상태로 태어난다.
       그대로 두면 효과음이 영원히 안 들린다 — 소리를 낼 때마다 깨워 준다. */
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, actx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    /* 음량 손잡이는 효과음에도 걸린다 — 음악만 줄어들면 그건 음량이 아니라 BGM 볼륨이다.
       0 은 위 soundOn 문지기가 이미 막았으므로 여기서 0 이 되는 일은 없다. */
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (gain || 0.05) * soundVol), actx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur + 0.02);
  } catch(e){}
}
/* ---------- 고양이 소리 ----------
   삑 소리로는 고양이가 안 된다. 야옹은 톤이 아니라 **모음 변화**다 —
   "냐"(열린 입)에서 "옹"(닫힌 입)으로 가는 동안 포르만트 두 개가 같이 내려간다.
   그래서 톱니파(성대) 하나를 밴드패스 두 개(입 모양)에 통과시키고,
   그 두 필터의 주파수를 소리 내는 동안 함께 끌어내린다. 음정도 살짝 올랐다 내려온다.

   같은 소리가 계속 나면 그건 기계다. 그래서 음정과 길이를 **매번** 흔든다 —
   고양이마다 고정하지 않는다(그러면 두 번째 클릭부터는 아무 일도 안 일어난다). */
const tone = () => Math.random();
let lastVoice = 0;
/* 합성 야옹 — 이제는 **폴백**이다. 아래 clip() 이 실패할 때만 쓴다. */
function meowSynth(opt){
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = opt || {};
    const v = tone();
    const t = actx.currentTime;
    const dur = (o.dur || 0.42) * (0.85 + v * 0.35);
    const f0  = (o.f0 || 500) * (0.82 + v * 0.42);      // 새끼일수록 높다

    const src = actx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * 0.86, t);
    src.frequency.linearRampToValueAtTime(f0 * 1.10, t + dur * 0.22);   // 냐— 하고 올라갔다
    src.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + dur);     // 옹— 하고 내려온다

    /* 떨림. 이게 없으면 사람이 낸 소리처럼 밋밋하다 */
    const lfo = actx.createOscillator(), lfoG = actx.createGain();
    lfo.frequency.value = 15 + v * 9;
    lfoG.gain.value = f0 * 0.035;
    lfo.connect(lfoG); lfoG.connect(src.frequency);

    /* 포르만트 둘 — 입 모양. 열린 "아"(F1 높음)에서 닫힌 "오/옹"(F1 낮음)으로.
       Q 를 좁게 잡으면 안 된다 — 통과대역이 배음 사이에 끼어서 소리가 거의 안 나온다.
       처음에 Q 7/9 로 만들었다가 BGM 밑에 완전히 묻혔다(측정: RMS 0.005). 넓게 잡고 세게 낸다. */
    const mk = (f1, f2, q, g) => {
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f1, t);
      bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const gg = actx.createGain(); gg.gain.value = g;
      bp.connect(gg);
      return { bp, gg };
    };
    const F1 = mk(o.mouth ? 980 : 820, 380, 3.2, 1.0);
    const F2 = mk(o.mouth ? 2300 : 1950, 1150, 4.0, 0.6);
    /* 몸통 — 원음을 저역만 남겨 살짝 섞는다. 포르만트만 쓰면 소리가 얇아서
       "고양이"보다 "필터"로 들린다. */
    const body = actx.createBiquadFilter();
    body.type = 'lowpass'; body.frequency.value = 1400; body.Q.value = 0.7;
    const bodyG = actx.createGain(); bodyG.gain.value = 0.32;
    body.connect(bodyG);

    const amp = actx.createGain();
    const peak = (o.gain || 0.5);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.05);
    amp.gain.setValueAtTime(peak, t + dur * 0.55);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(F1.bp); src.connect(F2.bp); src.connect(body);
    F1.gg.connect(amp);  F2.gg.connect(amp);  bodyG.connect(amp);
    amp.connect(actx.destination);
    src.start(t); lfo.start(t);
    src.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
  } catch(e){}
}
/* 짧게 굴리는 소리 — 고양이가 일하다가 내는 "브릅". 야옹보다 덜 부담스러워서
   자주 나도 성가시지 않다. 결재·가구 사용처럼 반복되는 순간은 전부 이쪽이다. */
function trillSynth(){
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const v = tone(), t = actx.currentTime, dur = 0.20 + v * 0.06;
    const f0 = 420 * (0.9 + v * 0.4);
    const src = actx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * 0.9, t);
    src.frequency.linearRampToValueAtTime(f0 * 1.35, t + dur);   // 끝이 올라간다 = 물음표 느낌
    const lfo = actx.createOscillator(), lfoG = actx.createGain();
    lfo.frequency.value = 33;                                     // 이 떨림이 "구르는" 소리를 만든다
    lfoG.gain.value = f0 * 0.22;
    lfo.connect(lfoG); lfoG.connect(src.frequency);
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 2.2;
    const amp = actx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.6, t + 0.03);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(amp); amp.connect(actx.destination);
    src.start(t); lfo.start(t);
    src.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
  } catch(e){}
}
/* ---------- 진짜 고양이 소리 ----------
   합성으로는 야옹이 안 된다. 포르만트를 맞춰도 "필터를 지난 톱니파"로 들린다 —
   울음은 성대와 성도가 매 순간 같이 움직이는 소리라 오실레이터 하나로 그 궤적이 안 나온다.
   그래서 **실제 녹음**을 쓴다. 라이선스는 CC0·퍼블릭 도메인만 골랐다 (출처는 CREDITS.txt).

   재생은 <audio> 다. 정석은 fetch + decodeAudioData 지만 그건 file:// 에서 CORS 로 막히고,
   이 게임은 파일을 더블클릭해 여는 것이 기본 경로다 — 배경음악이 같은 이유로 <audio> 를 쓴다.
   음정은 playbackRate 로 흔든다. 단, 브라우저는 기본적으로 속도를 바꿔도 **음정을 유지하므로**
   preservesPitch 를 꺼야 한다. 안 끄면 빠르기만 달라지고 목소리는 스무 마리가 똑같다.

   파일이 없으면(배포본에서 빠졌거나 경로가 어긋났거나) 위 합성으로 돌아간다.
   소리가 나는 것이 소리가 고운 것보다 먼저다. */
const MEOWS = ['assets/cat_voice/meow-1.wav', 'assets/cat_voice/meow-2.wav',
               'assets/cat_voice/meow-3.wav', 'assets/cat_voice/meow-4.wav'];
/* 짧은 울음 — 결재·가구 사용처럼 자주 나는 자리에 쓴다. 0.3초짜리라 반복돼도 덜 지친다. */
const CHIRPS = ['assets/cat_voice/chirp-1.wav', 'assets/cat_voice/chirp-2.wav'];
const _voice = new Map();          // 경로 → <audio> 몇 개. 여러 마리가 겹쳐 울 수 있어야 한다
let voiceBroken = false;
function voiceEl(src){
  const a = new Audio(assetURL(src));
  a.preload = 'auto';
  a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false;
  a.addEventListener('error', () => { voiceBroken = true; });
  return a;
}
/* 미리 하나씩 물려 둔다 — 첫 클릭에서 파일을 받기 시작하면 그 한 번이 늦게 운다 */
try { MEOWS.concat(CHIRPS).forEach(s => _voice.set(s, [voiceEl(s)])); } catch(e){ voiceBroken = true; }

function clip(src, rate, vol){
  if (voiceBroken) return false;
  try {
    let pool = _voice.get(src);
    if (!pool){ pool = [voiceEl(src)]; _voice.set(src, pool); }
    let a = pool.find(x => x.paused || x.ended);
    if (!a){
      if (pool.length >= 3) a = pool[0];       // 너무 겹치면 제일 오래된 것을 뺏는다
      else { a = voiceEl(src); pool.push(a); }
    }
    try { a.currentTime = 0; } catch(e){}
    a.playbackRate = rate;
    a.volume = vol;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch(e){ return false; }
}

/* 어느 울음이 나올지는 **누를 때마다 새로 뽑는다.**
   한동안은 고양이마다 목소리를 고정해 뒀는데, 그러면 같은 고양이는 늘 같은 소리로 울고
   그 고양이를 두 번째 누르는 순간부터는 아무 일도 안 일어난다. 무작위가 낫다.

   다만 방금 쓴 것은 다시 안 뽑는다 — 진짜 무작위는 같은 게 연달아 나오는 일이 잦고,
   사람은 그걸 무작위가 아니라 고장으로 읽는다. */
/* 목소리 크기 배수. 사람이 **직접 누른** 고양이는 또렷하게 답해야 하고,
   저 혼자 결재하다 우는 주변음은 훨씬 작아야 한다. 같은 소리를 두 세기로 쓴다. */
let voiceGain = 1;

let lastClip = '';
function pickClip(list){
  if (list.length < 2) return list[0];
  let i = Math.floor(Math.random() * list.length);
  if (list[i] === lastClip) i = (i + 1) % list.length;
  lastClip = list[i];
  return list[i];
}
/* 야옹 — 녹음 우선, 안 되면 합성. 음정도 매번 조금씩 흔든다. */
function meow(opt){
  if (!soundOn) return;
  const now = performance.now();
  /* 여러 마리가 동시에 울면 뭉개진다. 아주 짧은 간격은 잘라낸다. */
  if (now - lastVoice < 90) return;
  lastVoice = now;
  if (clip(pickClip(MEOWS), 0.88 + Math.random() * 0.30, 0.46 * voiceGain)) return;
  meowSynth(opt);
}
/* 짧게 굴리는 소리 — 결재·가구 사용처럼 자주 나는 순간용. 야옹보다 덜 부담스럽다. */
function trill(){
  if (!soundOn) return;
  const now = performance.now();
  if (now - lastVoice < 90) return;
  lastVoice = now;
  if (clip(pickClip(CHIRPS), 0.90 + Math.random() * 0.30, 0.32 * voiceGain)) return;
  trillSynth();
}

/* 골골 — 자는 고양이를 만졌을 때. 깨워서 울리는 것보다 이게 맞다.
   저주파 잡음을 25Hz 로 끊어 주면 그르렁이 된다. */
function purr(){
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime, dur = 1.1, v = tone();
    const n = actx.createBufferSource();
    const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * dur), actx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++){                 // 갈색 잡음 — 낮고 두툼하다
      last = (last + (Math.random() * 2 - 1) * 0.06) * 0.985;
      d[i] = last * 3.2;
    }
    n.buffer = buf;
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 340 + v * 90;
    const amp = actx.createGain();
    amp.gain.value = 0.0001;
    const mod = actx.createOscillator(), modG = actx.createGain();
    mod.frequency.value = 24 + v * 5;                   // 골골 주기
    modG.gain.value = 0.11;
    mod.connect(modG); modG.connect(amp.gain);
    amp.gain.setValueAtTime(0.001, t);
    amp.gain.linearRampToValueAtTime(0.075 * voiceGain, t + 0.18);
    amp.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(lp); lp.connect(amp); amp.connect(actx.destination);
    n.start(t); mod.start(t);
    n.stop(t + dur); mod.stop(t + dur);
  } catch(e){}
}

const sfx = {
  stamp: () => { beep(660,.09,'square',.06); setTimeout(()=>beep(990,.13,'square',.05),80); },
  coin:  () => beep(880,.08,'square',.03,1400),
  meow,
  trill,
  purr,
  /* 주변음은 0.5 안팎, 직접 누른 것은 1. main.js 의 catVoice 가 정한다 */
  voice: g => { voiceGain = g; },
  buy:   () => { beep(520,.08,'square',.045); setTimeout(()=>beep(780,.1,'square',.04),70); },
  quarter:()=> [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.18,'square',.05),i*110)),
  add:   () => beep(520,.06,'square',.03,700),
  err:   () => beep(180,.12,'square',.035),
  legal: () => { beep(300,.18,'sawtooth',.045); setTimeout(()=>beep(220,.28,'sawtooth',.045),190); },
  siren: () => { for (let i=0;i<4;i++) setTimeout(()=>beep(880,.22,'square',.05,1180), i*430); },
  chime: () => { beep(660,.22,'sine',.03); setTimeout(()=>beep(880,.3,'sine',.024),170); },   // 케어 알림 — 부드럽게
};

/* ---------- 자주 쓰는 라벨 ---------- */
const PER_SEC = L({ ko:'/초', en:'/s', ja:'/秒' });
const PHASE_LBL = {
  day:     L({ ko:'근무', en:'Work',        ja:'勤務' }),
  lunch:   L({ ko:'점심', en:'Lunch',       ja:'昼休み' }),
  evening: L({ ko:'야근', en:'After hours', ja:'定時後' }),
  night:   L({ ko:'취침', en:'Night',       ja:'夜' }),
};
const STATE_KR = {
  idle:  L({ ko:'대기',    en:'Idle',      ja:'待機' }),
  walk:  L({ ko:'이동 중', en:'Moving',    ja:'移動中' }),
  work:  L({ ko:'근무 중', en:'Working',   ja:'勤務中' }),
  stamp: L({ ko:'결재 중', en:'Stamping',  ja:'決裁中' }),
  sleep: L({ ko:'취침',    en:'Sleeping',  ja:'就寝' }),
  use:   L({ ko:'휴식',    en:'On break',  ja:'休憩' }),
};

/* ---------- index.html의 고정 문구 (부팅 때 한 번) ---------- */
function applyStatic(){
  document.documentElement.lang = LANG;
  document.title = L({ ko:'Copycat — 캣닢 만드는 고양이 조직',
                       en:'Copycat — the catnip cat syndicate',
                       ja:'Copycat — マタタビをつくる猫組織' });
  $('#todoInput').placeholder = L({ ko:'할 일을 올리면 고양이가 가지러 옵니다…',
                                    en:'Post a task — a cat will come fetch it…',
                                    ja:'タスクを上げると猫が取りに来ます…' });
  const kpiWord = L({ ko:'성과', en:'KPI', ja:'成果' });
  $$('#sizes .size').forEach(b => {
    const si = SIZE_INFO[b.dataset.size];
    b.innerHTML = `<b>${si.label}</b>+${si.kpi} ${kpiWord}`;
  });
  $('#btnAdd').textContent = L({ ko:'결재 상신', en:'Submit', ja:'決裁申請' });
  $('#phInbox').textContent = L({ ko:'결재함', en:'Inbox', ja:'決裁箱' });
  $('#lblCats').textContent = L({ ko:'냥', en:'cats', ja:'匹' });
  $('#lblPen').textContent  = L({ ko:'혐의', en:'heat', ja:'容疑' });
  $('#lblWork').textContent = L({ ko:'근무', en:'working', ja:'勤務' });
  $('#lblMood').textContent = L({ ko:'사기', en:'morale', ja:'士気' });
  $('#lblDocs').textContent = L({ ko:'대기', en:'waiting', ja:'待機' });
  $('#lblDone').textContent = L({ ko:'누적', en:'total', ja:'累計' });
  $('[data-tab="staff"]').textContent = '🐈 ' + L({ ko:'직원', en:'Staff', ja:'スタッフ' });
  $('[data-tab="shop"]').textContent  = '🛒 ' + L({ ko:'비품', en:'Supplies', ja:'備品' });
  $('[data-tab="log"]').textContent   = '📰 ' + L({ ko:'사보', en:'News', ja:'社報' });
  /* 한 기둥과 탭 바가 쓰는 줄. 아이콘·이름·점이 따로 있는 구조라
     textContent 로 통째로 갈면 점이 사라진다 — 이름 칸만 갈아 끼운다. */
  $('#ctStage').textContent = L({ ko:'사무실', en:'Office', ja:'オフィス' });
  $('#ctInbox').textContent = L({ ko:'결재함', en:'Inbox', ja:'決裁箱' });
  $('#ctStaff').textContent = L({ ko:'직원', en:'Staff', ja:'スタッフ' });
  $('#ctShop').textContent  = L({ ko:'비품', en:'Supplies', ja:'備品' });
  $('#ctLog').textContent   = L({ ko:'사보', en:'News', ja:'社報' });
  $('#btnCard').title     = L({ ko:'근무 기록증 — 함께한 시간', en:'Time card — how long we have been at it', ja:'勤務記録証——一緒にいた時間' });
  $('#btnEdit').title     = L({ ko:'배치 모드 — 가구 옮기기', en:'Decorate — move furniture', ja:'模様替え——家具を動かす' });
  $('#btnSettings').title = L({ ko:'설정', en:'Settings', ja:'設定' });
  $('#btnHelp').title     = L({ ko:'사규', en:'Company rules', ja:'社則' });
  $('#btnReset').title    = L({ ko:'처음부터', en:'Start over', ja:'最初から' });
  $('#btnCompact').title  = L({ ko:'위젯 모드 — 한 칸으로 접기', en:'Widget mode — fold into one column', ja:'ウィジェットモード——1列に畳む' });
  { const fb = $('#btnFloat'); if (fb) fb.title = L({ ko:'떠 있는 창 — 다른 창 위에 얹어 둔다', en:'Float out — keep it above your work', ja:'浮かせる——作業ウィンドウの上に置く' }); }
  $('#btnMore').title     = L({ ko:'더보기', en:'More', ja:'その他' });
  /* 3D 를 기다리는 동안 빈 무대에 놓는 한 줄(style.css 의 body.r3wait).
     CSS 의 content 로 넣으므로 번역은 여기서 속성에 실어 준다. */
  $('#viewport').dataset.wait = L({
    ko:'사무실을 세우는 중', en:'Setting up the office', ja:'オフィスを組み立て中' });
  $('#dkInbox').title     = L({ ko:'결재함', en:'Inbox', ja:'決裁箱' });
  $('#dkBiz').title       = L({ ko:'경영', en:'Management', ja:'経営' });
}

/* 디버그 풍경 고르개. 빈 id 가 "시계대로" 다 — 끄는 자리를 목록 안에 두면
   "어떻게 되돌리지" 가 안 생긴다. SKY_AT(sim.js)에 있는 넷을 그대로 쓴다. */
const SKY_PICKS = [
  ['',          L({ ko:'시계',   en:'Clock',     ja:'時計'   })],
  ['morning',   L({ ko:'아침',   en:'Morning',   ja:'朝'     })],
  ['day',       L({ ko:'오전',   en:'Forenoon',  ja:'午前'   })],
  ['afternoon', L({ ko:'오후',   en:'Afternoon', ja:'午後'   })],
  ['evening',   L({ ko:'저녁',   en:'Evening',   ja:'夕方'   })],
  ['night',     L({ ko:'밤',     en:'Night',     ja:'夜'     })],
];

/* 근무 시간 고르개. 0~23 시를 그대로 나열한다 — 분 단위까지 열면 "9시 7분 출근"이
   생기고, 그건 설정이 아니라 취조다. */
function shiftOpts(sel){
  let h = '';
  for (let i = 0; i < 24; i++)
    h += `<option value="${i}"${i === Math.round(sel) ? ' selected' : ''}>${String(i).padStart(2,'0')}:00</option>`;
  return h;
}
/* 고른 값이 실제로 무엇을 뜻하는지 그 자리에서 보여준다 — 자정을 넘는 근무는
   숫자 두 개만 보면 몇 시간인지 안 읽힌다. */
function shiftInfoText(){
  const s = shiftOf();
  const hh = m => String(Math.floor(m / 60)).padStart(2,'0') + ':' + String(m % 60).padStart(2,'0');
  const over = s.start + s.len > 1440;
  const lunch = s.lunch == null
    ? L({ ko:'점심 없음', en:'no lunch', ja:'昼休みなし' })
    : L({ ko:`점심 ${hh(s.lunch)}`, en:`lunch ${hh(s.lunch)}`, ja:`昼 ${hh(s.lunch)}` });
  return L({ ko:`${s.hours}시간 · ${lunch}${over ? ' · 자정 넘음' : ''}`,
             en:`${s.hours}h · ${lunch}${over ? ' · crosses midnight' : ''}`,
             ja:`${s.hours}時間 · ${lunch}${over ? ' · 日付をまたぐ' : ''}` });
}

/* ---------- 상단 ---------- */
const cdStr = m => { m = Math.max(0, Math.round(m)); return Math.floor(m/60) + ':' + String(m%60).padStart(2,'0'); };

function clockChipHTML(){
  const p = phaseOf(S.clock);
  /* 남은 시간은 **근무표에서** 나온다(sim.js shiftOf). 뺄셈으로 계산하던 걸
     untilMin 으로 바꾼 이유는 자정을 넘는 근무다 — 22–06 으로 일하는 사람의 화면에
     "퇴근까지 -19:00" 이 떠 있으면 그건 시계가 아니다. */
  const sh = shiftOf();
  let extra = '';
  if (p === 'lunch')
    extra = L({ ko:`오후까지 ${cdStr(untilMin(S.clock, sh.lunchEnd))}`, en:`${cdStr(untilMin(S.clock, sh.lunchEnd))} till afternoon`, ja:`午後まで${cdStr(untilMin(S.clock, sh.lunchEnd))}` });
  else if (p === 'day' && sh.lunch != null && untilMin(S.clock, sh.lunch) < untilMin(S.clock, sh.end))
    extra = L({ ko:`점심까지 ${cdStr(untilMin(S.clock, sh.lunch))}`, en:`${cdStr(untilMin(S.clock, sh.lunch))} to lunch`, ja:`昼まで${cdStr(untilMin(S.clock, sh.lunch))}` });
  else if (p === 'day')
    extra = L({ ko:`퇴근까지 ${cdStr(untilMin(S.clock, sh.end))}`, en:`${cdStr(untilMin(S.clock, sh.end))} to clock-out`, ja:`退勤まで${cdStr(untilMin(S.clock, sh.end))}` });
  // 오늘 하루를 얼마나 통과했는지 — 견딘 시간이 눈에 보이게
  const into = untilMin(sh.start, S.clock);            // 출근하고 몇 분 지났나
  const inShift = into < sh.len;
  const bar = inShift ? `<i style="width:${(into / sh.len * 100).toFixed(1)}%"></i>` : '';
  // 위젯 모드에서는 Day 와 근무 단계를 뺀다 — 칩이 사무실을 가리면 안 된다
  if (isCompact()) return `${clockStr()}${extra ? ' · ' + extra : ' · ' + PHASE_LBL[p]}${bar}`;
  return `Day ${S.day} · ${clockStr()} · ${PHASE_LBL[p]}${extra ? ' · ' + extra : ''}${bar}`;
}

function renderTop(){
  $('#coTier').textContent = TIERS[S.tier].name;
  $('#sAnchovy').textContent = fmt(S.anchovy);
  $('#sRate').textContent = '+' + fmt1(totalRate()) + PER_SEC;
  $('#sCats').textContent = S.cats.length + '/' + deskCount();

  const pen = S.penalty || 0;
  const chip = $('#penChip');
  $('#sPen').textContent = pen;
  chip.classList.toggle('warn', pen >= 3 && pen < RAID_THRESHOLD);
  chip.classList.toggle('danger', pen >= RAID_THRESHOLD);

  const tgt = qTarget(S.quarter);
  const yr = Math.floor((S.quarter - 1) / 4) + 1, qq = ((S.quarter - 1) % 4) + 1;
  $('#qLabel').textContent = L({ ko:`Q${S.quarter} · ${yr}년차 ${qq}분기`, en:`Q${S.quarter} · Year ${yr}, Q${qq}`, ja:`Q${S.quarter}・${yr}年目 第${qq}四半期` });
  $('#qNum').textContent = L({ ko:`${S.kpi} / ${tgt} 성과`, en:`${S.kpi} / ${tgt} KPI`, ja:`${S.kpi} / ${tgt} 成果` });
  $('#qFill').style.width = Math.max(0, Math.min(100, S.kpi / tgt * 100)) + '%';

  $('#fWork').textContent = (S.working || 0) + '/' + S.cats.length;
  $('#fMood').textContent = Math.round(avgMood());
  $('#fDone').textContent = S.stats.done;
  $('#fDocs').textContent = DOCS.length;
  $('#fDocs').parentElement.style.color = DOCS.length > 4 ? '#C4587A' : '';
  $('#clock').innerHTML = clockChipHTML();

  const banner = $('#raidBanner');
  if (RAID){
    banner.style.display = 'flex';
    banner.innerHTML = '🚨 ' + L({
      ko:`압수수색 진행 중 — 생산 40% · 남은 시간 <b>${Math.max(0, Math.ceil(RAID.dur - RAID.t))}초</b>`,
      en:`Raid in progress — output 40% · <b>${Math.max(0, Math.ceil(RAID.dur - RAID.t))}s</b> left`,
      ja:`家宅捜索中——生産40%・残り<b>${Math.max(0, Math.ceil(RAID.dur - RAID.t))}秒</b>`,
    });
  } else banner.style.display = 'none';
  $('#viewport').classList.toggle('raiding', !!RAID);
}

/* ---------- 결재함(할 일) ----------
   결재함은 **오늘 하루**다. 앞날에 미리 적어 둔 건은 그날이 되면 저절로 올라오고
   (main.js 의 biz:new), 지난 날은 벽에 걸린 📅 달력에서 본다 (js/cal.js).
   여기 보이는 것은 "지금 해야 하는 것" 하나뿐이어야 한다 — 오늘 화면에 다음 주가
   같이 떠 있으면 그건 목록이 아니라 계획표고, 계획표는 아침에 사람을 지치게 한다. */

/* 날짜 한 조각. 어제·오늘·내일은 이름으로, 나머지는 8/23 으로. */
function dayLabel(key){
  const t = bizKey();
  if (key === t) return L({ ko:'오늘', en:'today', ja:'今日' });
  if (key === addDays(t, 1)) return L({ ko:'내일', en:'tmrw', ja:'明日' });
  if (key === addDays(t, -1)) return L({ ko:'어제', en:'yest.', ja:'昨日' });
  const d = keyToDate(key);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function renderTodos(){
  const el = $('#todoList');
  const today = bizKey();
  const open = openTodos();
  const over = open.filter(isOverdue);
  /* 오늘 끝낸 것만 아래에 남긴다 — 어제 끝낸 것은 어제 칸의 일이다(달력에서 본다). */
  const done = S.todos.filter(t => t.done && (t.doneDay || t.due) === today).slice(-6).reverse();
  $('#todoSub').textContent = over.length
    ? L({ ko:`${open.length}건 · ⏰ 지남 ${over.length}`, en:`${open.length} open · ⏰ ${over.length} past due`, ja:`${open.length}件・⏰ 期限切れ${over.length}` })
    : L({ ko:`${open.length}건 대기`, en:`${open.length} waiting`, ja:`${open.length}件待機` });
  // 위젯 모드의 독 — 서랍이 닫혀 있어도 몇 건 남았는지는 보여야 한다
  $('#dkTodo').textContent = open.length;
  $('#dkInbox').classList.toggle('od', over.length > 0);
  /* 탭 줄도 같은 걸 알려야 한다 — 다른 화면에 가 있으면 결재함이 아예 안 보인다.
     여기서는 숫자가 아니라 점이다(자리가 없고, 알아야 할 건 "가야 하나" 뿐이다). */
  { const t = $('#colTabs [data-col="inbox"]'); if (t) t.classList.toggle('od', over.length > 0); }

  if (!open.length && !done.length){
    /* 달력이 **어디에** 있는지는 말하지 않는다. 판마다 다르고(폰은 오른쪽 세로 줄,
       넓은 판은 벽), 무엇보다 이 빈 화면은 첫 그림에서 한 번 그려지는데 그때는
       레이아웃 클래스가 아직 안 붙어 있다 — 자리를 말하면 첫 화면에서만 틀린 말을
       하게 된다. 실제로 그렇게 만들어 놓고 「벽에 걸린」이 찍히는 것을 봤다. */
    el.innerHTML = `<div class="empty">${L({
      /* 달력이 어디 있는지는 판마다 다르다 — 폰에서는 오른쪽 줄, 넓은 판에서는 벽.
         이모지는 뺐다(이 화면의 나머지가 전부 그린 아이콘이다). */
      ko:'오늘 결재함이 비었습니다.<br>고양이들이 창밖만 보고 있습니다<br><br><span class="tiny">올린 건은 고양이가 직접 물고 가서<br>자기 자리에서 도장을 찍습니다.<br><b>달력</b>에서 다른 날에 미리 적어 둘 수 있습니다.</span>',
      en:'Nothing in today’s inbox.<br>The cats are just staring out the window<br><br><span class="tiny">Posted items get carried off by a cat<br>and stamped at their own desk.<br>The <b>calendar</b> lets you write ahead on other days.</span>',
      ja:'今日の決裁箱は空です。<br>猫たちは窓の外ばかり見ています<br><br><span class="tiny">上げた案件は猫がくわえて運び、<br>自分の席でハンコを押します。<br><b>カレンダー</b>で別の日に先に書いておけます。</span>',
    })}</div>`;
    return;
  }

  /* 기한 칩. 누르면 날짜를 옮기거나 ⏰ 를 걸고 뗀다. 이미 샌 건은 잠긴다(무를 수 없다).
     안 건 기한은 이모지까지 흐리다 — 기한은 기본값이 아니라 **내가 건 것**이라서다. */
  const dueChip = t => {
    if (t.late) return `<span class="due late">⏰ ${L({ ko:'샜음', en:'leaked', ja:'流出' })}</span>`;
    const label = t.alarm ? '⏰ ' + dayLabel(t.due)
                          : (t.due === today ? '⏰' : dayLabel(t.due));
    const cls = t.alarm ? (isOverdue(t) ? 'due od' : 'due on') : 'due';
    return `<button class="${cls}" data-act="due" title="${L({ ko:'기한·날짜', en:'Deadline / date', ja:'期限・日付' })}">${label}</button>`;
  };
  /* 세부 업무를 붙이는 문. 잎에는 안 붙인다 — 두 층이면 목록이고 세 층이면 문서다. */
  const subChip = t => (t.parent || t.done) ? ''
    : `<button class="due sub" data-act="sub" title="${L({
        ko:'세부 업무 — 큰 건을 작은 줄로 나눕니다',
        en:'Subtasks — split a big one into small lines',
        ja:'サブ業務——大きい案件を小さい行に分けます' })}">＋</button>`;

  const row = (t, kid) => {
    const kids = kidsOf(t.id), left = kids.filter(k => !k.done).length;
    const parent = kids.length > 0;
    const r = todoReward(t.size);
    const od = isOverdue(t) || !!t.late;
    /* **부모에도 체크 칸이 있다** (2026-08-26). 원래는 접기 손잡이만 두고 「잎이 다
       끝나면 저절로 닫힌다」로 갔는데, 큰 건을 한 번에 끝내는 길이 없어서 잎을 하나씩
       눌러야 했다. 부모를 누르면 **열린 잎을 전부 끝낸다**(completeGroup) — 서류도
       보상도 잎에서 나오므로 도장은 잎 수만큼이고, 같은 일로 두 번 받지 않는다.
       접기 손잡이는 글줄 앞으로 옮겼다. 둘 다 왼쪽에 두면 체크 칸이 반으로 줄어든다. */
    const lead = `<button class="chk" data-act="toggle" title="${
      parent && !t.done
        ? L({ ko:'묶음 완료 — 밑의 줄을 한 번에 끝냅니다', en:'Finish the group — closes every line under it', ja:'まとめて完了——下の行を一度に終えます' })
        : L({ ko:'완료 처리 — 고양이가 서류를 가져갑니다', en:'Mark done — a cat fetches the papers', ja:'完了処理——猫が書類を取りに来ます' })}">✓</button>`;
    const foldChip = parent && !t.done
      ? `<button class="foldi" data-act="fold" title="${L({ ko:'접기·펼치기', en:'Fold', ja:'折りたたみ' })}">${t.fold ? '▸' : '▾'}</button>`
      : '';
    /* 부모 줄에는 보상을 안 적는다 — 그 몫은 잎이 낸다. 대신 뭐가 남았는지를 적는다. */
    const pay = parent
      ? `<span>${left ? L({ ko:`남은 ${left}건`, en:`${left} left`, ja:`残り${left}件` })
                       : L({ ko:'세부 업무 완료', en:'all subtasks done', ja:'サブ業務完了' })}</span>`
      : t.done ? `<span>${L({ ko:'전달됨', en:'Delivered', ja:'送達済み' })}</span>`
               : `<span>+${r.kpi} ${L({ ko:'성과', en:'KPI', ja:'成果' })} · 🐟${fmt(r.money)}</span>`;
    return `<div class="todo ${t.done?'done':''} ${od?'overdue':''} ${kid?'kid':''} ${parent?'group':''}" data-id="${t.id}">
      ${lead}
      <div class="txt">${foldChip}${esc(t.text)}
        <div class="meta">${kid ? '' : `<span class="tag ${t.size}">${SIZE_INFO[t.size].label}</span>`}
        ${t.rt ? `<span class="rt" title="${L({ ko:'루틴이 놓은 건', en:'placed by a routine', ja:'ルーティンが置いた件' })}">🔁</span>` : ''}
        ${pay}
        ${t.done ? '' : dueChip(t)}${t.done ? '' : subChip(t)}</div>
      </div>
      <button class="del" data-act="del">✕</button>
    </div>`;
  };
  // 아직 한 건도 처리 안 했으면 어디를 눌러야 하는지 알려준다
  const hint = (open.length && !S.stats.done)
    ? `<div class="chkhint">${L({
        ko:'👈 할 일이 끝나면 <b>체크</b> — 고양이가 서류를 가지러 옵니다',
        en:'👈 <b>Check it off</b> when it’s done — a cat comes for the papers',
        ja:'👈 終わったら<b>チェック</b>——猫が書類を取りに来ます',
      })}</div>` : '';

  /* 묶음을 세운다. 잎은 부모 밑에 들여쓰고, 부모가 목록에 없는 잎(있을 수 없지만)은
     제자리에 세운다 — 어디에도 안 걸린 줄이 조용히 사라지는 것보다 낫다. */
  const kidsMap = new Map();
  open.forEach(t => { if (!t.parent) return;
    if (!kidsMap.has(t.parent)) kidsMap.set(t.parent, []);
    kidsMap.get(t.parent).push(t); });
  const topIds = new Set(open.filter(t => !t.parent).map(t => t.id));
  const tops = open.filter(t => !t.parent || !topIds.has(t.parent));

  /* 순서: 지난 기한 → 오늘 기한 → 기한 없음. 값을 치러야 하는 것이 위로 온다.
     묶음은 **제일 급한 잎**의 순위를 따라간다 — 부모는 날짜를 안 갖고 잎이 갖는다. */
  const rankOne = t => (isOverdue(t) || t.late) ? 0 : t.alarm ? 1 : 2;
  const rank = t => Math.min(rankOne(t), ...(kidsMap.get(t.id) || []).map(rankOne));
  const sorted = tops.slice().sort((x, y) => rank(x) - rank(y));

  const block = t => {
    const kids = kidsMap.get(t.id) || [];
    if (!kids.length) return row(t);
    return row(t) + (t.fold ? '' : kids.map(k => row(k, true)).join(''));
  };
  el.innerHTML = hint + sorted.map(block).join('')
    + (done.length ? `<div class="sechead">${L({ ko:'오늘 처리', en:'Done today', ja:'今日の処理' })}</div>`
                     + done.map(t => row(t, !!t.parent)).join('') : '');
}

/* ---------- 기한 고르기 ----------
   날짜 줄과 ⏰ 줄, 그리고 한 문장. 이 창의 값어치는 **안 걸 수도 있다**는 걸 보여주는
   데 있다 — 기한이 기본값이면 그건 내가 정한 게 아니다. */
function showDuePicker(id){
  const t = S.todos.find(x => x.id === id);
  if (!t || t.done) return;
  if (t.late){
    toast(L({ ko:'이미 밖으로 샌 건은 날짜를 무를 수 없습니다. 늦게라도 내면 혐의가 지워집니다.',
              en:'A leaked item can’t be rescheduled. Filing it late still clears the heat.',
              ja:'流出した案件は日付を戻せません。遅れてでも出せば容疑は消えます。' }));
    return;
  }
  const today = bizKey();
  const days = [0, 1, 2, 7].map(n => addDays(today, n));
  const m = modal(`
    <div class="mhead"><div class="q">⏰ ${L({ ko:'기한', en:'DEADLINE', ja:'期限' })}</div>
      <h3>${esc(t.text)}</h3></div>
    <div class="mbody">
      <div class="jukesec">${L({ ko:'어느 날의 일인가', en:'Which day', ja:'どの日の仕事か' })}</div>
      <div class="daychips">
        ${days.map(k => `<button class="buy ${t.due === k ? '' : 'alt'}" data-day="${k}">${dayLabel(k)}</button>`).join('')}
      </div>
      <div class="jukesec">${L({ ko:'기한', en:'Deadline', ja:'期限' })}</div>
      <div class="daychips">
        <button class="buy ${t.alarm ? 'alt' : ''}" data-alarm="0">${L({ ko:'기한 없음', en:'None', ja:'なし' })}</button>
        <button class="buy ${t.alarm ? '' : 'alt'}" data-alarm="1">⏰ ${L({ ko:'그날까지', en:'By that day', ja:'その日まで' })}</button>
      </div>
      <div class="hint">${L({
        ko:'기한을 걸면 그날을 넘기는 순간 서류가 정리되지 못한 채 <b>밖으로 샙니다</b>(혐의 +1, 큰 건 +2). 늦게라도 내면 그만큼 지워집니다.<br>걸지 않으면 아무 일도 없습니다 — 언제 해도 됩니다.',
        en:'With a deadline, the paperwork <b>leaks out</b> the moment that day rolls over (heat +1, +2 for large). Filing it late clears that much again.<br>Without one, nothing happens — do it whenever.',
        ja:'期限を掛けると、その日を越えた瞬間に書類が整理されないまま<b>外に漏れます</b>（容疑+1、大きい案件は+2）。遅れてでも出せばその分は消えます。<br>掛けなければ何も起きません——いつやってもいいです。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);
  m.veil.querySelectorAll('[data-day]').forEach(b => b.onclick = () => {
    setDue(id, b.dataset.day, null); sfx.add(); m.close(); renderTodos();
  });
  m.veil.querySelectorAll('[data-alarm]').forEach(b => b.onclick = () => {
    setDue(id, null, b.dataset.alarm === '1'); sfx.add(); m.close(); renderTodos();
  });
  return m;
}

/* ---------- 세부 업무 ----------
   큰 건 하나를 작은 줄 여러 개로. 이 창의 일은 **줄을 계속 적을 수 있게** 하는 것뿐이라
   엔터로 이어 적고 창은 안 닫힌다 — 대청소를 나눌 때 사람은 세 줄을 연달아 적는다. */
function showSubs(id){
  const t = S.todos.find(x => x.id === id);
  if (!t || t.parent || t.done) return;
  let size = t.size;
  const m = modal(`
    <div class="mhead"><div class="q">＋ ${L({ ko:'세부 업무', en:'SUBTASKS', ja:'サブ業務' })}</div>
      <h3>${esc(t.text)}</h3>
      <p>${L({ ko:'큰 건 하나를 작은 줄로 나눕니다. 도장은 작은 줄에서 찍힙니다.',
               en:'Split one big item into small lines. The stamps happen on the small lines.',
               ja:'大きい案件を小さい行に分けます。ハンコは小さい行で押されます。' })}</p></div>
    <div class="mbody" id="subBody"></div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);
  const body = m.veil.querySelector('#subBody');

  const draw = () => {
    const kids = kidsOf(id);
    body.innerHTML = `${kids.length
      ? kids.map(k => `<div class="calrow ${k.done ? 'done' : ''}">
          ${k.done ? '<span class="ok">✓</span>' : '<span class="dot">·</span>'}
          <span class="tx">${esc(k.text)}</span>
          <span class="tiny">${SIZE_INFO[k.size].label}</span>
          <button class="del" data-del="${k.id}">✕</button></div>`).join('')
      : `<div class="hint">${L({
          ko:'아직 나눈 줄이 없습니다. 아래에 적으면 이 건은 <b>묶음</b>이 됩니다.',
          en:'Nothing split out yet. Write below and this becomes a <b>group</b>.',
          ja:'まだ分けた行がありません。下に書くとこの案件が<b>まとまり</b>になります。' })}</div>`}
      <div class="addbox calbox">
        <input id="subInput" maxlength="80" autocomplete="off" placeholder="${L({
          ko:'예: 빨래하기', en:'e.g. laundry', ja:'例：洗濯' })}">
        <div class="sizes" id="subSizes">
          ${['s','m','l'].map(k => `<button class="size ${k === size ? 'on' : ''}" data-size="${k}">${SIZE_INFO[k].label}</button>`).join('')}
        </div>
        <button class="addbtn" id="subAdd">${L({ ko:'줄 추가', en:'Add line', ja:'行を追加' })}</button>
      </div>
      <div class="hint">${L({
        ko:'묶음은 <b>하루의 일</b>입니다 — 부모를 미루면 밑의 줄도 같이 갑니다. 밑의 줄을 다 끝내면 묶음은 저절로 닫힙니다.',
        en:'A group is <b>one day’s work</b> — moving the parent moves its lines too. Finish them all and the group closes itself.',
        ja:'まとまりは<b>一日の仕事</b>です——親を動かすと下の行も一緒に動きます。全部終えるとまとまりは自分で閉じます。' })}</div>`;
    wire();
  };
  function wire(){
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      delTodo(b.dataset.del); draw(); renderTodos(); renderTop();
    });
    const sz = body.querySelector('#subSizes');
    if (sz) sz.onclick = e => {
      const b = e.target.closest('.size'); if (!b) return;
      size = b.dataset.size;
      sz.querySelectorAll('.size').forEach(x => x.classList.toggle('on', x === b));
    };
    const inp = body.querySelector('#subInput'), add = body.querySelector('#subAdd');
    const doAdd = () => {
      const txt = inp.value.trim();
      if (!txt){ inp.focus(); sfx.err(); return; }
      addTodo(txt, size, { parent: id });
      sfx.add();
      draw();
      const again = body.querySelector('#subInput');
      if (again) again.focus();
      renderTodos();
    };
    add.onclick = doAdd;
    onTextSubmit(inp, doAdd);     // 결재함과 같은 문 — 조합 중 엔터로 줄이 쪼개지지 않게
    inp.focus();
  }
  draw();
  return m;
}

/* ---------- 사무실 타일 ---------- */
function renderTiles(){
  /* 무대가 오는 중이면 **아무것도 그리지 않는다.** 잘못 그린 사무실보다 아직 안 그린
     사무실이 낫다(위 pending3d 주석). */
  if (pending3d()){
    const g = $('#gl'); if (g) g.style.display = 'none';
    document.body.classList.add('r3wait');
    return;
  }
  document.body.classList.remove('r3wait');
  /* 로딩 화면을 걷는다(#loadgate — index.html 끝, style.css 의 그 절).
     **여기 하나로 충분한 이유**: 무대가 안 오는 세 갈래가 전부 pending3d 를 거쳐
     이 함수로 돌아온다(모듈 못 불러옴 · init 던짐 · 12초 초과 — 20번).
     로딩 화면에 갇히는 건 못 그렸다고 말해 주는 것보다 나쁘다. */
  document.body.classList.add('r3ready');
  const gl = $('#gl');
  if (gl) gl.style.display = is3d() ? '' : 'none';
  if (is3d()){
    const f = $('#viewport').querySelector('.nogl'); if (f) f.remove();
    bubbles.forEach((b, id) => dropBubble(id));   // 레이어가 새로 서면 같이 다시 붙는다
    /* 배치 로직(world.js)은 한 줄도 안 바뀐다 — 렌더러가 격자를 읽어 세울 뿐이다. */
    R3.build(W, TILE);
    return;
  }
  stageFail();
}

/* 무대를 못 세웠다. 예전에는 도트로 떨어졌는데 그 판을 지웠으므로 여기서 말해 준다 —
   WebGL 이 없는 기계에서 빈 화면만 남으면 그건 고장으로 읽힌다. */
function stageFail(){
  const vp = $('#viewport');
  if (vp.querySelector('.nogl')) return;
  const d = DOC.createElement('div');
  d.className = 'nogl';
  d.innerHTML = `<b>${L({ ko:'사무실을 세우지 못했습니다',
                          en:'Could not build the office',
                          ja:'オフィスを建てられませんでした' })}</b>`
    + `<span>${L({ ko:'이 브라우저에서 3D(WebGL)를 못 켰습니다. 하드웨어 가속을 켜거나 다른 브라우저에서 열어 주세요 — 고양이들은 그동안에도 일하고 있습니다.',
                   en:'This browser could not start 3D (WebGL). Turn on hardware acceleration or open it in another browser — the cats keep working meanwhile.',
                   ja:'このブラウザで3D(WebGL)を起動できませんでした。ハードウェアアクセラレーションを有効にするか、別のブラウザで開いてください——その間も猫たちは働いています。' })}</span>`;
  vp.appendChild(d);
}

/* 무대 맞추기. 도트판에서는 여기가 픽셀 배율·중앙정렬·서랍 높이를 다 계산했다 —
   전부 카메라가 하는 일이 되었으므로 한 줄로 줄었다(render3d.js fit). */
function fitWorld(){
  if (!W || pending3d()) return;
  if (is3d()) R3.fit();
}

/* ---------- 액터 ---------- */
function syncActors(dt){
  if (!is3d()) return;
  /* 남의 사무실을 구경하는 중(js/visit.js). 렌더러에는 저쪽 방이 서 있으므로
     내 고양이를 그리면 남의 방에서 내 직원이 일하는 화면이 된다.
     시뮬레이션은 그대로 돈다 — 내 방은 내 격자(W) 위에서 계속 돌아간다. */
  if (typeof visitBusy === 'function' && visitBusy()){
    if (typeof visiting === 'function' && visiting()){
      R3.sync(VISIT.cats, [], Math.min(0.05, dt || 0.016));
      if (!stageCovered()) R3.draw();
    }
    return;      // 사진 찍는 중이면 한 프레임도 건드리지 않는다
  }
  R3.sync(S.cats.concat(NPCS), DOCS, Math.min(0.05, dt || 0.016));
  syncBubbles();
  /* 폰에서 다른 탭에 가 있으면 무대가 통째로 덮여 있다. 그 프레임을 GPU 로
     그려도 아무도 못 본다 — 하루 종일 켜 두는 물건에서 그건 그냥 배터리다.
     sync 는 계속 돌린다(위치를 놓치면 돌아올 때 고양이가 미끄러진다). */
  if (!stageCovered()) R3.draw();
}

/* 창밖과 실내 빛. **근무표가 아니라 시계를 본다**(sim.js 의 skyMix) —
   근무를 22–06 으로 바꿨다고 새벽 3시가 대낮이 되면 안 된다. */
/* 기다리는 상태에서 **빠져나온 순간**을 한 곳에서 잡는다.
   빠져나오는 길이 셋이다 — 모듈을 못 불러옴(index.html 의 onerror) · init 이 던짐
   (render3d.js) · 시간 초과. 각자 "다시 그려라" 를 부르게 하면 하나를 빼먹는데,
   실제로 onerror 쪽을 빼먹어서 file:// 로 열면 빈 무대에 갇혔다(spike/verify-fallback.js 가 잡았다).
   renderNight 은 매 프레임 불리므로 여기서 한 번만 걸러 내면 셋 다 덮인다. */
let wasPending = false;
function renderNight(){
  if (pending3d()){ wasPending = true; return; }   // 아직 그릴 무대가 없다
  if (wasPending){ wasPending = false; renderTiles(); }
  if (!is3d()) return;
  const sk = skyMix(S.clock);
  /* 이름 하나가 아니라 **양쪽과 비율**을 넘긴다 — 그래야 노을이 계단이 아니라
     기울기가 된다. R3.night 은 안 바뀌면 아무것도 안 하고 돌아온다. */
  R3.night(sk.a, sk.b, sk.t);
}

/* ---------- 이펙트 ---------- */
function floatAt(x, y, text, cls){
  const d = document.createElement('div');
  d.className = 'float ' + (cls || '');
  d.textContent = text;
  /* 글자는 계속 DOM 이다 — 무대 안에 넣으면 글꼴도 i18n 도 잃는다.
     월드 좌표를 화면 좌표로 투영해서 그 자리에 얹기만 한다. */
  if (!is3d()) return;
  const p = R3.project(x, y, 0.9);
  if (!p) return;
  d.style.left = p.x + 'px';
  d.style.top  = p.y + 'px';
  fxLayer().appendChild(d);
  setTimeout(() => d.remove(), 1650);
}
/* ---------- 말풍선 ----------
   **한 고양이에 하나.** 그 하나가 두 가지를 담는다.

     · 가구를 쓰는 동안   → **아이콘**(js/icons.js) 이 계속 떠 있는다
     · 말할 때            → 지금까지처럼 **문장**이 2.6초 떴다가, 다시 아이콘으로 돌아온다

   여태는 그 자리에 문장만 있었다. 50번이 「가구를 쓰는 동안 계속 떠 있게」 하면서
   문장이 상주하게 됐는데, 스무 마리가 있는 사무실에서 그건 자막 판이었다 —
   폰에서는 서로 겹쳐서 아무것도 안 읽힌다. 그래서 상주하는 쪽만 그림으로 바꿨다.
   **판을 새로 만들지 않는다**: 같은 .bubble 이고, 같은 크림 바탕·같은 잉크 테두리·
   같은 꼬리다. 머리 위에 두 가지 그림체가 번갈아 뜨면 그게 더 시끄럽다.

   자리는 매 프레임 다시 투영한다. 따라 그리면 카메라를 돌려도 머리 위에 남고,
   걸어가도 따라간다. 부를 때마다 새로 만들어 지우던 옛 방식은 지울 옛 것을 몰라서
   두 줄이 같은 자리에 겹치는 문제가 있었다. */
const bubbles = new Map();          // catId → { el, until, kind }

function bubbleEl(catId){
  let b = bubbles.get(catId);
  if (!b){
    const el = DOC.createElement('div');
    el.className = 'bubble hold';
    el.style.cssText = 'bottom:auto;transform:translate(-50%,-100%)';
    fxLayer().appendChild(el);
    b = { el, until: 0, kind: null };
    bubbles.set(catId, b);
  }
  return b;
}
function dropBubble(catId){
  const b = bubbles.get(catId);
  if (b){ b.el.remove(); bubbles.delete(catId); }
}
/* 문장을 띄운다. 아이콘이 떠 있었으면 그 위에 덮이고, 2.6초 뒤 syncBubbles 가
   원래 아이콘으로 되돌린다(kind 를 비워 두면 다음 프레임이 다시 그린다). */
function sayAt(catId, text){
  if (!is3d()) return;
  const b = bubbleEl(catId);
  b.el.classList.remove('ico', 'ic-rise', 'ic-beat', 'ic-sway');
  b.kind = null;
  if (b.el.textContent !== text) b.el.textContent = text;
  b.until = performance.now() + 2650;
  /* 말이 뜨는 순간 귀가 한 번 튕긴다(TODO 39). 말풍선만 뜨고 몸이 가만히 있으면
     그 말은 고양이가 한 게 아니라 화면에 얹힌 자막이 된다. */
  if (typeof R3 !== 'undefined' && R3 && R3.flick) R3.flick(catId);
  syncBubbles();                     // 만든 프레임에 바로 자리를 잡는다
}

/* 어느 그림을 띄우나. 하는 일은 시뮬이 이미 갈래로 갖고 있다(sim.js doingKind) —
   여기서 갈리는 건 하나뿐이다: **잡담은 혼자냐 둘이냐로 그림이 다르다**(TODO 60).
   짝이 있으면 하트고, 혼자면 말풍선 아이콘이다. */
function iconKind(c){
  const k = (typeof doingKind === 'function') ? doingKind(c) : null;
  if (!k) return null;
  if (k === 'social') return c._with ? 'heart' : 'social';
  return (typeof ICON_SVG !== 'undefined' && ICON_SVG[k]) ? k : null;
}
/* 풍선 하나를 아이콘 판으로 만든다. 갈래가 그대로면 아무것도 안 건드린다 —
   매 프레임 innerHTML 을 다시 쓰면 SVG 가 새로 만들어져서 움직임이 첫 칸에 갇힌다. */
function setIcon(b, kind){
  if (b.kind === kind) return;
  b.kind = kind;
  b.el.textContent = '';
  b.el.innerHTML = iconSVG(kind);
  b.el.className = 'bubble hold ico ic-' + ((typeof ICON_ANIM !== 'undefined' && ICON_ANIM[kind]) || 'sway');
}

/* 매 프레임. 자리를 다시 잡고, 수명이 다한 문장을 아이콘으로 되돌리고,
   하는 일이 없어진 고양이의 풍선을 걷는다. */
function syncBubbles(){
  if (!is3d() || !S) return;
  const all = S.cats.concat(NPCS);
  const now = performance.now();
  const alive = new Set();
  for (const c of all){
    const kind = iconKind(c);
    const talking = (() => { const b = bubbles.get(c.id); return !!b && b.until > now; })();
    if (!kind && !talking){ dropBubble(c.id); continue; }
    const b = bubbleEl(c.id);
    /* 말이 끝났으면 하던 일로 돌아온다. 할 일이 없으면 위에서 이미 걷혔다. */
    if (!talking) setIcon(b, kind);
    alive.add(c.id);
    /* 화면 밖으로 나간 고양이의 풍선은 감춘다 — 지우면 돌아왔을 때 말이 끊긴다 */
    const p = R3.project(c.x, c.y, 1.0);
    if (!p){ b.el.style.visibility = 'hidden'; continue; }
    b.el.style.visibility = '';
    b.el.style.left = p.x + 'px';
    b.el.style.top  = p.y + 'px';
  }
  /* 퇴사·구금으로 목록에서 빠진 고양이의 풍선 */
  bubbles.forEach((b, id) => { if (!alive.has(id)) dropBubble(id); });
}
function toast(msg, kind, ms){
  const d = DOC.createElement('div');
  d.className = 'toast ' + (kind || ''); d.textContent = msg;
  DOC.body.appendChild(d);
  setTimeout(() => { d.style.transition='opacity .3s'; d.style.opacity='0'; setTimeout(()=>d.remove(),300); }, ms || 2200);
}
function confetti(){
  const w = DOC.createElement('div'); w.className = 'confetti';
  const cols = ['#FF9F6B','#7FCDB8','#FFB7C5','#F5C451','#9EC5F5','#FFFDF8'];
  for (let i = 0; i < 90; i++){
    const c = DOC.createElement('div'); c.className = 'conf';
    c.style.left = Math.random()*100 + '%';
    c.style.top = (-12 - Math.random()*30) + 'vh';
    c.style.background = cols[Math.floor(Math.random()*cols.length)];
    c.style.animationDuration = (1.6 + Math.random()*1.6) + 's';
    c.style.animationDelay = (Math.random()*.5) + 's';
    w.appendChild(c);
  }
  DOC.body.appendChild(w);
  setTimeout(() => w.remove(), 3800);
}

/* ---------- 오른쪽 패널 ---------- */
function renderRight(){
  const b = $('#rightBody');
  b.innerHTML = uiTab === 'staff' ? staffHTML() : uiTab === 'shop' ? shopHTML() : logHTML();
}



function portrait(c, size, opt){
  /* 3D 일 때는 같은 3D 고양이를 구운 그림을 쓴다. 목록만 도트로 남으면
     한 화면 안에서 두 그림체가 싸운다.
     opt 는 렌더러의 초상 손잡이를 그대로 넘긴다(표정·정면·얼굴 컷). 안 주면 지금까지 그대로다. */
  if (is3d() && R3.portrait){
    const url = R3.portrait(c, Math.max(64, size), opt);
    const eerie = document.body.classList.contains('eerie');
    /* 조형 초상은 구울 때 이미 색을 입힌다(three/eerie.js 의 bakePortrait).
       손그림은 그림 파일 그대로라 손댈 자리가 없어서 여기서 필터로 맞춘다 —
       한 화면에 두 그림체가 있는 것보다 필터 한 줄이 낫다. */
    const dood = eerie && R3.getCatLook && R3.getCatLook() === 'doodle';
    if (url) return `<span class="pix" style="width:${size}px;height:${size}px;`
      + `background-image:url(${url});background-size:100% 100%;`
      + `image-rendering:${eerie ? 'pixelated' : 'auto'};`
      + `${dood ? 'filter:saturate(.72) brightness(.94) contrast(1.1)' : ''}"></span>`;
  }
  /* 무대가 아직 안 섰거나 못 섰다. 예전에는 도트 시트에서 앉은 프레임을 잘라 썼는데
     그 시트를 지웠으므로 **자리만 지킨다** — 목록의 칸이 무너지면 그건 초상이 없는
     것보다 나쁘다. 무대가 서면 renderAll 이 다시 그린다. */
  return `<span class="pix catpix" style="width:${size}px;height:${size}px"></span>`;
}
/* 욕구 막대 넷. **막대 위에 이름을 적는다.**
   한동안 이름이 `title` 속성에만 있었다 — 데스크톱에서 마우스를 올리면 나오고,
   **폰에는 hover 가 없으니 거기서는 이름이 아예 없었다.** 색만 다른 막대 넷은
   아는 사람만 아는 계기판이고, 이 게임의 절반이 모니터링인데 그러면 안 된다.

   이모지(⚡🎈🚽☕)로 갈까 했는데 낱말로 갔다 — 이모지는 「무엇을 뜻하는지」를
   또 한 번 배워야 하고, 그 배움을 어디서 주느냐는 문제가 남는다.

   **기준선 아래로 내려간 것은 이름까지 붉어진다.** 막대만 붉으면 「뭐가 급한지」를
   알려면 다시 순서를 세어야 한다 — 급할 때 세게 만들면 그건 계기판이 아니다. */
/* val:true 면 이름 옆에 숫자까지. **목록에는 안 붙이고 기록증(🪪)에만 붙인다** —
   스무 마리 목록에 숫자 여든 개가 뜨면 그건 계기판이 아니라 표고, 이 넷은
   「기력 62」 를 보고 판단할 값이 아니라 「빨개졌다」 를 보는 값이다. */
function needBars(c, val){
  const hc = !!(W && W.facilities.coffee);
  const ns = [
    ['energy','#9EC5F5', L({ ko:'기력',   en:'Energy',   ja:'気力' })],
    ['fun','#FFB7C5',    L({ ko:'재미',   en:'Fun',      ja:'楽しさ' })],
    ['bladder','#C9B8E8',L({ ko:'화장실', en:'Bladder',  ja:'トイレ' })],
  ];
  if (hc) ns.push(['caffeine','#C99A6B', L({ ko:'카페인', en:'Caffeine', ja:'カフェイン' })]);
  return `<div class="needs">${ns.map(([k,col,label]) => {
    const v = Math.round(c.needs[k]), low = c.needs[k] < 30;
    return `<div class="nb${low ? ' low' : ''}" title="${label} ${v}">
      <span class="nbl">${label}${val ? ` <b>${v}</b>` : ''}</span>
      <span class="nbt"><i style="width:${v}%;background:${low ? '#F09999' : col}"></i></span>
    </div>`;
  }).join('')}</div>`;
}

function staffHTML(){
  const free = deskCount() - S.cats.length;
  const hc = hireCost();
  let h = '';

  {
    const pct = Math.round((S.rival || 0) * 100);
    const par = rivalPar();
    h += `<div class="card rivalcard"><div class="crow"><span class="em">🐶</span>
      <div class="info"><b>${L({ ko:`멍멍파 점유율 ${pct}%`, en:`Woof Gang share ${pct}%`, ja:`ワンワン組シェア${pct}%` })}</b><span>${L({
        ko:`마약 개껌으로 우리 거래처를 노립니다<br>전 직원 생산 ${Math.round((1-rivalDrag())*100)}% 감소 · 이번 분기 ${S.stats.qDone}/${par}건 처리`,
        en:`They’re after our clients with narcotic chews<br>All staff output −${Math.round((1-rivalDrag())*100)}% · this quarter ${S.stats.qDone}/${par} done`,
        ja:`麻薬ガムでうちの取引先を狙っています<br>全員の生産−${Math.round((1-rivalDrag())*100)}%・今期 ${S.stats.qDone}/${par}件処理`,
      })}</span></div>
    </div>
    <div class="hint" style="margin:7px 2px 0">${L({
      ko:`분기에 ${par}건 넘게 처리하면 거래처를 되찾습니다.`,
      en:`Clear more than ${par} per quarter to win clients back.`,
      ja:`四半期に${par}件以上処理すれば取引先を取り戻せます。`,
    })}</div></div>`;
  }
  if (S.penalty > 0){
    h += `<div class="card legalcard"><div class="crow"><span class="em">🔍</span>
      <div class="info"><b>${L({ ko:`수사 혐의 ${S.penalty}점`, en:`Heat: ${S.penalty} pt`, ja:`捜査容疑${S.penalty}点` })}</b><span>${L({
        ko:`전 직원 생산 ${Math.round((1-legalDrag())*100)}% 감소 — 다들 몸을 사립니다<br>${RAID_THRESHOLD}점을 넘기면 냥찰청이 들이닥칩니다`,
        en:`All staff output −${Math.round((1-legalDrag())*100)}% — everyone’s lying low<br>Cross ${RAID_THRESHOLD} points and the Pawlice storm in`,
        ja:`全員の生産−${Math.round((1-legalDrag())*100)}%——みんな萎縮しています<br>${RAID_THRESHOLD}点を超えるとニャン察が踏み込んできます`,
      })}</span></div>
      <button class="buy" data-act="lobby" ${S.anchovy<lobbyCost()||RAID?'disabled':''}>${L({ ko:'무마', en:'Hush', ja:'もみ消し' })} 🐟${fmt(lobbyCost())}</button>
    </div>
    <div class="hintbad" style="margin-top:7px">${L({
      ko:'법무법인을 통해 혐의 1점을 지웁니다. 회사가 클수록 비쌉니다.',
      en:'The law firm erases one point of heat. Pricier as the company grows.',
      ja:'法律事務所が容疑1点を消します。会社が大きいほど高くつきます。',
    })}</div></div>`;
  }
  if (S.jail.length){
    h += `<div class="card legalcard">${S.jail.map(j =>
      `<div class="crow"><span class="em">🚔</span><div class="info"><b>${esc(j.cat.name)}</b>
        <span>${L({
          ko:`조사 받는 중 · Q${j.returnQ} 복귀 예정 · 아무 말도 안 했다고 한다`,
          en:`Under questioning · back in Q${j.returnQ} · says they said nothing`,
          ja:`取り調べ中・Q${j.returnQ}復帰予定・何も言ってないらしい`,
        })}</span></div></div>`).join('')}</div>`;
  }

  {
    // 지원자가 이미 기다리고 있으면 그 냥이를 보여준다 (면접창을 닫아도 그대로 남는다)
    const cd = S.candidate;
    h += `<div class="card hirecard">
    <div class="crow"><span class="em">${cd ? portrait(cd, 30) : '🐾'}</span>
      <div class="info"><b>${cd
        ? L({ ko:`${esc(cd.name)} 냥이 면접을 기다립니다`, en:`${esc(cd.name)} is waiting for the interview`, ja:`${esc(cd.name)}が面接を待っています` })
        : L({ ko:'신입 채용', en:'Hire', ja:'新規採用' })}</b><span>${L({
        ko:`남은 자리 ${free}석 · 능력치는 4d6, 이름과 색은 직접 정합니다`,
        en:`${free} desk(s) left · 4d6 stats, you pick the name and colour`,
        ja:`残り${free}席・能力値は4d6、名前と色はあなたが決めます`,
      })}</span></div>
      <button class="buy" data-act="hire" ${free<=0||S.anchovy<hc?'disabled':''}>${L({ ko:'면접', en:'Interview', ja:'面接' })} 🐟${fmt(hc)}</button>
    </div>
    ${free<=0?`<div class="hintbad">${L({
      ko:'자리가 없습니다. 분기를 넘겨 사무실을 넓히세요.',
      en:'No desks left. Advance quarters to expand the office.',
      ja:'席がありません。四半期を進めてオフィスを広げましょう。',
    })}</div>`:''}
  </div>`;
  }

  h += S.cats.map(c => {
    const tr = traitOf(c), rn = rankName(c), nx = nextRank(c);
    const pc = promoCost(c);
    const working = c.act.s === 'work' || c.act.s === 'stamp';
    return `<div class="card catcard" data-cat="${c.id}">
      <div class="head">
        ${portrait(c, 40)}
        <div class="nm"><b>${esc(c.name)}</b> <span class="rk">${rn}</span>
          <span class="tr">${tr.n} · ${STATE_KR[c.act.s] || '…'}</span></div>
        <div class="rate"><b style="${working?'':'opacity:.45'}">🐟${fmt1(catRate(c))}</b>${PER_SEC}</div>
      </div>
      ${needBars(c)}
      <div class="cfoot">
        <span class="tiny">${STAT_NAME.int} ${statOf(c,'int')} · ${STAT_NAME.wis} ${statOf(c,'wis')} · ${STAT_NAME.dex} ${statOf(c,'dex')}</span>
        <span style="flex:1"></span>
        ${nx ? `<button class="buy alt" data-act="promo" data-id="${c.id}" ${S.anchovy<pc?'disabled':''}>${c.founder ? BOSS_RAISE : nx.n} 🐟${fmt(pc)}</button>`
             : `<span class="maxrank">${L({ ko:'최고 직급', en:'Top rank', ja:'最高職級' })}</span>`}
      </div>
    </div>`;
  }).join('');
  return h;
}

/* 아직 안 열린 비품은 **목록에 아예 없다.**
   전에는 🔒 를 달고 이름·설명·효과까지 다 보여줬다. 그러면 상점이 "지금 살 것"이 아니라
   "언젠가 살 것들의 목록"이 되고, 사무실을 넓히는 일이 **이미 본 걸 받으러 가는 심부름**이 된다.
   이 게임은 떡밥으로 굴러가는 게임이다. 떡밥이 있는 쪽에서는 미리 보여주는 게 손해다.

   대신 잠긴 **개수**는 남긴다 — 아무것도 없는 것과 아직인 것은 다르고,
   그 차이를 안 알려주면 등급을 올릴 이유가 사라진다. 개수만, 이름은 말고. */
/* 상점은 **격자 하나**다 (2026-09-02).
   한동안 비품은 세로 한 줄짜리 카드, 가구는 격자였다. 한 화면에 목록 모양이 둘이면
   그 둘이 다른 종류의 물건으로 보이는데, 사는 사람에게는 둘 다 「사무실에 들어오는
   물건」 하나다. 그래서 같은 칸으로 통일한다 — 비품은 설명이 필요해서 두 칸 폭,
   가구는 이름과 값이면 되어서 세 칸 폭. 칸의 생김새는 같다.

   잠긴 것은 **아예 안 보인다**(4번 규칙). 이제 가구도 등급을 타므로(game.js
   furnCatalog) 그 규칙이 화면 전체에 하나로 걸린다 — 맨 아래 줄이 몇 개가 잠겨
   있는지만 알린다. 개수만, 이름은 말고. */
function shopHTML(){
  const goods = SHOP.filter(it => !it.furn);
  const open = goods.filter(it => S.tier >= it.tier);
  const head = `<div class="furnhead"><b>${L({ ko:'비품', en:'Equipment', ja:'備品' })}</b>
      <span>${L({ ko:`${open.filter(it => shopCount(it.id) > 0).length}/${open.length}종 · 저마다 다른 효과`,
                  en:`${open.filter(it => shopCount(it.id) > 0).length}/${open.length} kinds · each does its own thing`,
                  ja:`${open.filter(it => shopCount(it.id) > 0).length}/${open.length}種・それぞれ別の効果` })}</span>
    </div>`;
  const grid = `<div class="furngrid g2">${open.map(it => {
    const n = shopCount(it.id);
    /* 가구가 있는 비품은 몇 번이고 더 살 수 있다 — 효과는 그대로고 가구만 늘어난다.
       두 대째 커피머신의 값어치는 "생산 두 배" 가 아니라 "줄을 안 선다" 이고,
       그건 이 게임에서 눈에 보이는 차이다. 대신 값이 사본마다 오른다. */
    const again = n > 0 && !!SHOP_TILE[it.id];
    const done = n > 0 && !again;                 // 견본책처럼 한 번만 사는 것
    const cost = shopCost(it);
    const off = done || S.anchovy < cost;
    return `<button class="fcell wide${n ? ' has' : ''}" data-act="buy" data-id="${it.id}"
        ${off ? 'disabled' : ''} title="${esc(it.n)}">
      ${furnPic(it)}
      <b>${it.n}</b>
      <span class="fdesc">${it.d}</span>
      <span class="fcost">${done
        ? L({ ko:'설치됨 ✓', en:'Installed ✓', ja:'設置済み ✓' })
        : (again ? '+1 ' : '') + '🐟' + fmt(cost)}</span>
      ${n ? `<i class="fn">${n}</i>` : ''}
    </button>`;
  }).join('')}</div>`;
  return head + grid + furnHTML() + shopLockedHTML();
}

/* 잠긴 것 — 비품과 가구를 **합쳐서** 한 줄로 센다. 규칙이 하나이므로 알림도 하나다. */
function shopLockedHTML(){
  const hidden = SHOP.filter(it => S.tier < it.tier).length;
  if (!hidden) return '';
  const soon = SHOP.filter(it => it.tier === S.tier + 1).length;
  return `<div class="card lockedrow"><div class="crow">
      <span class="em">🔒</span>
      <div class="info"><b>${soon ? L({
        ko:`다음 등급에서 ${soon}개가 더 열립니다`,
        en:`${soon} more open at the next grade`,
        ja:`次の等級であと${soon}個開きます`,
      }) : L({
        ko:`아직 열리지 않은 물건이 ${hidden}개 있습니다`,
        en:`${hidden} items are still sealed`,
        ja:`まだ開いていない品が${hidden}個あります`,
      })}</b><span>${L({
        ko:'사무실을 넓히면 총무가 목록을 갱신합니다.',
        en:'Move to a bigger office and Admin will update the list.',
        ja:'オフィスを広げれば総務が目録を更新します。',
      })}</span></div>
    </div></div>`;
}

/* ---------- 가구 카탈로그 ----------
   레퍼런스 「사무실 가구 목록」의 구조를 그대로 옮겼다: 다섯 분류 · 격자 · 보유 개수.
   비품이 **한 줄에 하나**인 것과 반대로 가구는 **한 칸에 하나**다. 이유는 두 가지다.

     · 스물넷이 전부 같은 일을 한다(쾌적도 +1). 그래서 읽을 것은 이름과 값뿐이고,
       설명 줄을 스물네 번 반복하면 그건 정보가 아니라 소음이다.
     · 고르는 기준이 **생김새**다. 글자보다 그림이 커야 하는 목록이고,
       그래서 칸마다 그 물건을 실제로 구운 모형이 들어간다(R3.furnPortrait).

   모형은 render3d 가 캐시한다(furnShots) — 첫 그리기에서 스물넷을 굽고 그 뒤로는
   같은 URL 을 돌려준다. 그래서 여기서 따로 캐시를 두지 않는다. 굽지 못하면
   (WebGL 이 아직 안 섰거나 벽에 거는 물건이거나) 이모지로 조용히 내려간다. */
const FURN_CATS = [
  ['work',  L({ ko:'업무 가구',    en:'Work',    ja:'業務家具' })],
  ['store', L({ ko:'수납 가구',    en:'Storage', ja:'収納家具' })],
  ['deco',  L({ ko:'데코 가구',    en:'Decor',   ja:'デコ家具' })],
  ['rest',  L({ ko:'휴식 가구',    en:'Lounge',  ja:'休憩家具' })],
  ['wall',  L({ ko:'벽 장식',      en:'Wall',    ja:'壁の装飾' })],
];
function furnPic(it){
  try {
    /* 바닥 가구는 SHOP_TILE 이, 벽에 거는 것은 wallTile 이 어느 칸인지 안다.
       둘 다 안 보면 커튼·메모만 이모지로 남아서 격자에서 그 둘만 다른 물건처럼 보인다. */
    const t = (typeof SHOP_TILE !== 'undefined' ? SHOP_TILE[it.id] : undefined)
           ?? (it.wallTile && typeof TILE !== 'undefined' ? TILE[it.wallTile] : undefined);
    const u = (t !== undefined && window.R3 && R3.furnPortrait) ? R3.furnPortrait(t, 72) : null;
    return u ? `<img class="fpic" src="${u}" alt="">` : `<span class="fpic fem">${it.em}</span>`;
  } catch (e){ return `<span class="fpic fem">${it.em}</span>`; }
}
function furnHTML(){
  /* 잠긴 가구는 목록에 없다 — 비품과 **같은 규칙**이다(2026-09-02).
     세는 것도 열린 것만 센다: 「0/25종」은 아직 못 사는 것까지 세어서, 첫 사무실에서
     영원히 못 채울 분모를 보여 주고 있었다.

     **다만 가진 것은 보인다.** 본사 택배는 등급을 안 보고 주므로(js/gacha.js gaFurn)
     아직 못 사는 가구가 창고에 들어올 수 있는데, 그때 목록에서 빠지면 **가진 채로
     안 보인다** — 그게 「10연에서 나온 게 창고로 안 간다」의 정체였다. */
  const list = SHOP.filter(it => it.furn && (S.tier >= it.tier || shopCount(it.id) > 0));
  if (!list.length) return '';
  const kinds = list.filter(it => shopCount(it.id) > 0).length;
  const pieces = list.reduce((n, it) => n + shopCount(it.id), 0);
  /* 쾌적도 수치를 여기 적어 뒀었다(「+0.0% — 생산이 오르고…」). 뺐다 —
     가구를 고르는 이유는 취향이지 퍼센트가 아니고, 0개일 때 +0.0% 는 특히
     아무 말도 안 한다. 효과는 칸마다 붙은 설명 한 줄이 이미 말한다. */
  const head = `<div class="furnhead">
      <b>${L({ ko:'사무실 가구', en:'Office Furniture', ja:'オフィス家具' })}</b>
      <span>${L({ ko:`${kinds}/${list.length}종 · ${pieces}개`,
                  en:`${kinds}/${list.length} kinds · ${pieces} pcs`,
                  ja:`${kinds}/${list.length}種 · ${pieces}個` })}</span>
    </div>`;
  const body = FURN_CATS.map(([cat, label]) => {
    const items = list.filter(it => it.furn === cat);
    if (!items.length) return '';
    return `<div class="furncat">${label}</div><div class="furngrid">` + items.map(it => {
      const n = shopCount(it.id);
      const cost = shopCost(it);
      const off = S.anchovy < cost;
      return `<button class="fcell${n ? ' has' : ''}" data-act="buy" data-id="${it.id}"
          ${off ? 'disabled' : ''} title="${it.n}">
        ${furnPic(it)}
        <b>${it.n}</b>
        <span class="fcost">🐟${fmt(cost)}</span>
        ${n ? `<i class="fn">${n}</i>` : ''}
      </button>`;
    }).join('') + '</div>';
  }).join('');
  return head + body;
}

function logHTML(){
  if (!S.log.length) return `<div class="empty">${L({
    ko:'아직 사보에 실릴 소식이 없습니다.',
    en:'Nothing newsworthy yet.',
    ja:'まだ社報に載る話はありません。',
  })}</div>`;
  return S.log.slice().reverse().map(l => `<div class="chatline ${l.k||''}">${l.t}</div>`).join('');
}

/* ---------- 모달 ---------- */
function modal(html, onClose){
  const veil = DOC.createElement('div');
  veil.className = 'veil';
  veil.innerHTML = `<div class="modal">${html}</div>`;
  DOC.body.appendChild(veil);
  const close = () => { veil.remove(); if (onClose) onClose(); };
  veil.addEventListener('click', e => {
    if (e.target === veil || e.target.closest('[data-close]')) close();
  });
  return { veil, close };
}

function showCat(id){
  const c = S.cats.find(x => x.id === id);
  if (!c) return;
  selCat = id;
  const tr = traitOf(c), r = { n: rankName(c) };
  /* 굴린 값이 곧 그 냥이의 값이다 — 위에 얹는 층(장비)을 없앴다(js/cats.js 머리말).
     빈 <small> 은 남긴다: 칸 높이를 그게 잡고 있어서 지우면 표가 들쭉날쭉해진다. */
  const statCell = k => {
    const v = statOf(c, k);
    const cls = v >= 15 ? 'hi' : v <= 8 ? 'lo' : '';
    return `<div class="st ${cls}" title="${STAT_DESC[k]}"><small>${STAT_NAME[k]}</small><b>${v}</b>
      <small>&nbsp;</small></div>`;
  };

  const m = modal(`
    <div class="mhead"><div class="q">EMPLOYEE FILE</div><h3>${esc(c.name)} ${r.n}</h3>
      <p>${tr.n} — ${tr.d}</p></div>
    <div class="mbody">
      <div class="resume">
        ${portrait(c, 84)}
        <div style="flex:1">
          <div class="tiny" style="margin-bottom:5px">${L({ ko:'현재 상태', en:'Status', ja:'現在の状態' })} <b>${STATE_KR[c.act.s]||'…'}</b>
            · ${L({ ko:'생산', en:'Output', ja:'生産' })} <b>🐟${fmt1(catRate(c))}${PER_SEC}</b></div>
          ${/* 막대에 이름과 숫자가 다 있으므로 아래 「기력 62 · 재미 44 …」 줄은
                지웠다 — 같은 낱말 셋이 바로 위아래에 두 번 적혀 있었다. */''}
          ${needBars(c, true)}
        </div>
      </div>
      <div class="statgrid">${STAT_KEYS.map(statCell).join('')}</div>
      <div class="tiny">${L({
        ko:'입사 시 4d6 중 최저값 1개를 버려 굴린 값입니다.',
        en:'Rolled at hiring with 4d6, dropping the lowest.',
        ja:'入社時に4d6の最低値1つを捨てて振った値です。',
      })}</div>
      ${/* 무늬는 **입사 뒤에도** 바꿀 수 있다. 되돌릴 수 없는 소비를 벌로 취급하지
            않는다는 그 규칙 안에 무늬도 둔다 — 무늬는 몸이 아니라 내가 고른 것이다. */''}
      ${sculptCats() ? markRowHTML(c, 'catMark') : ''}
      ${recordHTML(c)}
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`,
    () => { selCat = null; });

  /* 찍는 즉시 그 냥에게 들어간다. 사무실의 배우는 다음 프레임에 저절로 따라오고
     (render3d sync), 오른쪽 목록의 얼굴만 여기서 다시 그려 준다. */
  bindMarkRow(m.veil, 'catMark', c, {
    marks: v => { setCatMarks(c, v); renderRight(); },
    face:  v => { setCatFace(c, v);  renderRight(); },
  });
}

/* 인사 파일의 <기록> 칸.
   회사가 직원에 대해 실제로 적어 둔 것만 나열한다. 문장을 붙이지 않는 게 핵심이다 —
   건조한 표 위에 "구금 1회, 마지막 Q7"이 한 줄로 놓여 있는 게 농담이자 그 냥이의 인생이다. */
function recordHTML(c){
  const rec = normRecord(c.rec);
  const none  = L({ ko:'기록 없음', en:'Not on file', ja:'記録なし' });
  const row = (label, val) => `<div class="rrow"><span>${label}</span><b>${val}</b></div>`;
  const total = rec.docs.s + rec.docs.m + rec.docs.l;
  const cnt = n => L({ ko:`${n}건`, en:`${n}`, ja:`${n}件` });
  const top = recTopFac(c), ti = top && TILE_INFO[top.tile];

  return `<div class="evt reclog"><span class="lbl">${L({ ko:'기록', en:'RECORD', ja:'記録' })}</span>
    ${row(L({ ko:'입사', en:'Joined', ja:'入社' }), rec.q ? 'Q' + rec.q : none)}
    ${row(L({ ko:'처리 서류', en:'Documents stamped', ja:'処理書類' }), cnt(total))}
    ${total ? row(L({ ko:'크기별', en:'By size', ja:'サイズ別' }),
        `${SIZE_INFO.s.label} ${rec.docs.s} · ${SIZE_INFO.m.label} ${rec.docs.m} · ${SIZE_INFO.l.label} ${rec.docs.l}`) : ''}
    ${row(L({ ko:'자주 가는 곳', en:'Most-visited', ja:'よく行く場所' }),
        ti ? `${ti.em} ${ti.n} · ${L({ ko:`${top.n}회`, en:`${top.n}×`, ja:`${top.n}回` })}` : none)}
    ${row(L({ ko:'구금', en:'Detained', ja:'拘留' }),
        rec.det
          ? L({ ko:`${rec.det}회 · 마지막 Q${rec.detQ}`, en:`${rec.det}× · last Q${rec.detQ}`, ja:`${rec.det}回・最後はQ${rec.detQ}` })
          : L({ ko:'없음', en:'None', ja:'なし' }))}
    ${row(L({ ko:'첫 결재', en:'First stamp', ja:'初決裁' }),
        rec.first ? `Q${rec.first.q}${rec.first.t ? ' · “' + esc(rec.first.t) + '”' : ''}` : none)}
  </div>`;
}

/* ============================================================
   꾸미기 작업대 — 돌려서 보고, 연필로 그린다  (TODO 73)

   지금까지 고양이를 고르는 손은 **색 하나**뿐이었다. 그건 「내 고양이」가 아니라
   「그 색 고양이」다. 무늬는 색과 다르다 — 어디에 넣는지를 사람이 고르는 순간
   그 고양이는 자기가 만든 고양이가 된다. 그래서 돌려가면서 그린다:
   등에 넣은 얼룩이 앞에서 안 보이면 그건 무늬가 아니라 설정값이다.

   ── 손이 둘로 갈려 있다 ──
   **연필**과 **이동**은 따로다. 한 손가락에 「끌면 돌아가고 누르면 찍힌다」를 같이
   걸어 뒀더니, 등을 보려고 끄는 것과 등에 획을 긋는 것이 같은 동작이 된다 —
   폰에서는 그 둘을 손가락 이동 거리로 가를 수 없다. 그래서 단추로 가른다.

   ── 판을 새로 만들지 않는다 ──
   이미 있는 모달(.veil/.modal) 위에 얹는다. 면접창 위에서도 열리고 인사 파일
   위에서도 열리므로, 두 자리에 각각의 화면을 그리는 대신 같은 창 하나가 둘 다 맡는다.

   ── 획은 점이 아니다 ──
   손가락이 지나간 자리를 **선분으로 이어** 텍스처에 칠한다(js/three/facepaint.js).
   그래서 몇 획을 긋든 상한이 없다 — 셰이더가 읽는 것은 언제나 텍스처 한 장이다.
   저장에는 지나간 점만 남으므로, 되돌리기는 획 목록에서 마지막 하나를 빼면 된다.

   ── 취소가 없다 ──
   그리는 즉시 그 고양이에게 들어간다. 이 게임은 되돌릴 수 없는 소비를 벌로 취급하지
   않으므로 「확인/취소」로 가둘 이유가 없고, 대신 **되돌리기**가 있다(한 획이 한 번).
   ============================================================ */
/* 연필과 이동 — 이 창에서만 쓰는 그림 둘. cozy.js 의 그림표를 못 빌린다:
   그건 폰 스킨(#app.tabbar)에서만 돌아서 넓은 화면에서는 아예 없다.
   currentColor 라 켜진 단추에서는 강조색이 되고 꺼진 단추에서는 흐린 글자색이 된다. */
const ICON_PENCIL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"
  d="M17.3 2.5a1.6 1.6 0 0 1 2.3 0l1.9 1.9a1.6 1.6 0 0 1 0 2.3l-2.2 2.2-4.2-4.2 2.2-2.2Zm-3.5 3.5 4.2 4.2-8.6 8.6H5.2v-4.2L13.8 6Z"/></svg>`;
const ICON_MOVE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"
  d="M12 1.4 15.8 5.2h-2.6v5.6h5.6V8.2L22.6 12l-3.8 3.8v-2.6h-5.6v5.6h2.6L12 22.6 8.2 18.8h2.6v-5.6H5.2v2.6L1.4 12l3.8-3.8v2.6h5.6V5.2H8.2L12 1.4Z"/></svg>`;

function showMarks(c, api){
  if (!is3d() || !R3.studio){
    sfx.err();
    toast(L({ ko:'무대가 아직 안 섰습니다.', en:'The stage is not up yet.', ja:'ステージがまだです。' }));
    return;
  }
  let face = faceOf(c);                 // { e: 눈(-1 = 그때그때), m: 입 }
  const st = R3.studio({ fur: R3.catFur(c), marks: marksOf(c), face });
  if (!st){
    sfx.err();
    toast(L({ ko:'여기서는 꾸밀 수 없습니다.', en:'Not available here.', ja:'ここでは飾れません。' }));
    return;
  }
  const pal = R3.markPalette ? R3.markPalette() : [0xF0E9DE, 0x8E6242, 0x38323A];
  /* 획 목록. 깊은 사본이라 「완료」를 안 눌러도 원본이 안 흔들린다 — 실제 반영은
     획이 끝날 때 api.marks 로 한 번에 간다. */
  let marks = marksOf(c).map(k => ({ ...k, p: k.p.slice() }));
  /* 되돌리기는 **화면 한 장**을 통째로 되돌린다. 획 목록에서 하나 빼고 다시 그리면
     획이 서른이면 서른 번을 다시 그려야 한다(제곱으로 는다). 판 한 장이 147KB 이고,
     스무 걸음이면 3MB — 창을 닫을 때 같이 없어진다. */
  const undo = [];
  let mode = 'draw';
  /* 처음 잡히는 잉크는 **바탕에서 제일 잘 보이는 것**이다. 검정 고양이에 검정 연필을
     쥐여 주면 첫 획이 아무 일도 안 일어난 것처럼 보이고, 그러면 이 화면이 고장 난
     것으로 읽힌다. (facepaint.inkFor 가 눈 색을 뒤집는 것과 같은 이유다.) */
  const base = R3.catFur(c) | 0;
  const lum = ((base >> 16 & 255) * 0.2126 + (base >> 8 & 255) * 0.7152 + (base & 255) * 0.0722) / 255;
  let ink = lum < 0.42 ? 0 : 2, size = 1;

  const hex = i => '#' + pal[i].toString(16).padStart(6, '0');
  const T = (ko, en, ja) => L({ ko, en, ja });

  const m = modal(`
    <div class="mhead"><div class="q">CUSTOMISE</div>
      <h3>${T('꾸미기', 'Customise', 'かざる')}</h3>
      <p>${T('연필로 그리고, 이동으로 돌린다',
              'Pencil draws. Move turns it.',
              '鉛筆で描いて、移動で回す')}</p></div>
    <div class="mbody">
      <div class="mkstage" id="mkStage">
        <button class="mkspin" id="mkSpin" title="${T('정면으로', 'Reset view', '正面へ')}">↺</button>
      </div>
      ${/* 무늬와 표정을 한 화면에 다 세우면 폰에서 연필이 화면 밖으로 밀린다.
            둘은 서로 안 섞이는 일이므로 **칸을 나눈다** — 무대는 위에 그대로 남아서
            어느 칸에서 무엇을 만져도 같은 고양이가 바뀌는 것이 보인다. */''}
      <div class="mktabs" id="mkTabs">
        <button class="mktab" data-tab="mark">${T('무늬', 'Marks', 'もよう')}</button>
        <button class="mktab" data-tab="face">${T('표정', 'Face', 'かお')}</button>
      </div>

      <div class="mkpane" data-pane="mark">
        ${/* **손이 먼저다.** 색·굵기와 같은 줄에 세워 뒀더니 「무엇을 고르는가」와
              「무엇을 하는가」가 한 줄에서 섞였다 — 성질이 다른 단추다.
              제 줄로 올리고 아래에 선을 그어 갈라 둔다. 낱말은 title 로 남긴다:
              두 개뿐이고 하나는 늘 켜져 있으므로 그림으로 읽힌다. */''}
        <div class="mkhand" id="mkMode">
          <button class="mkmode" data-mode="draw"
            title="${T('연필 — 그린다', 'Pencil — draw', '鉛筆 — 描く')}"
            aria-label="${T('연필', 'Pencil', '鉛筆')}">${ICON_PENCIL}</button>
          <button class="mkmode" data-mode="move"
            title="${T('이동 — 돌려 본다', 'Move — turn it', '移動 — 回す')}"
            aria-label="${T('이동', 'Move', '移動')}">${ICON_MOVE}</button>
        </div>
        <div class="mkbar">
          <div class="mksizes" id="mkSize">
            ${MARK_SIZES.map((r, i) => `<button class="mksize" data-size="${i}">
               <i style="width:${5 + i * 5}px;height:${5 + i * 5}px"></i></button>`).join('')}
          </div>
          <div class="mkinks" id="mkInk">
            ${pal.map((_, i) => `<button class="mkink" data-ink="${i}" title="${MARK_INKS[i]}">
               <i style="background:${hex(i)}"></i></button>`).join('')}
            <button class="mkink erase" data-ink="-1"
              title="${T('지우개', 'Erase', 'けしゴム')}"><i></i></button>
          </div>
        </div>
      </div>

      <div class="mkpane" data-pane="face" hidden>
        <div class="hint">${T('눈', 'Eyes', 'め')}</div>
        <div class="swatches mkface" id="mkEye"></div>
        <div class="hint">${T('입', 'Mouth', 'くち')}</div>
        <div class="swatches mkface" id="mkMouth"></div>
      </div>
    </div>
    <div class="mfoot">
      ${/* 화살표 글리프(↶)는 글꼴에 따라 가는 갈고리로 떨어져서 무엇을 하는 단추인지
            안 읽힌다. 낱말 하나면 어느 글꼴에서도 같은 뜻이다. */''}
      <button class="okbtn alt" id="mkUndo">${T('되돌리기', 'Undo', 'もどす')}</button>
      <button class="okbtn" data-close>${T('완료', 'Done', 'かんりょう')}</button>
    </div>`, () => { removeEventListener('resize', fitStage); st.dispose(); });

  const stage = m.veil.querySelector('#mkStage');
  stage.insertBefore(st.canvas, stage.firstChild);
  /* 창이 방금 붙었을 때는 아직 폭이 0 인 판이 있다. 다음 프레임에 재서 그린다.
     WebGL 컨텍스트는 창을 닫을 때 반드시 버린다(onClose) — 안 버리면 창을 몇 번
     여닫는 것만으로 브라우저의 컨텍스트 한도에 걸리고, 그러면 **사무실이 안 뜬다.** */
  function fitStage(){
    const r = stage.getBoundingClientRect();
    if (r.width > 1) st.resize(r.width, r.height);
  }
  requestAnimationFrame(fitStage);
  addEventListener('resize', fitStage);

  let tab = 'mark';
  const chips = () => {
    m.veil.querySelectorAll('[data-ink]').forEach(b => b.classList.toggle('on', +b.dataset.ink === ink));
    m.veil.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', +b.dataset.size === size));
    m.veil.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    m.veil.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    m.veil.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    stage.classList.toggle('drawing', mode === 'draw');
    m.veil.querySelector('#mkUndo').disabled = !undo.length;
  };
  m.veil.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    /* 표정 칸에서는 연필을 쥐고 있을 이유가 없다 — 얼굴을 고르는 동안에도 고양이는
       돌려 볼 수 있어야 하고, 그 손이 무대를 긋고 있으면 사고가 된다. */
    mode = tab === 'face' ? 'move' : 'draw';
    sfx.add();
    chips();
  });

  /* 표정 — **실제 얼굴 컷으로** 보여 준다. 낱말만으로는 「시무룩」과 「졸린 눈」이
     무엇이 다른지 알 수 없고, 이 화면은 그걸 보러 오는 자리다.
     눈 줄은 지금 고른 입을 쓰고, 입 줄은 지금 고른 눈을 쓴다 — 두 줄이 각자 기본
     얼굴을 쓰면 고르는 동안 조합이 안 보인다. */
  const eyeRow = m.veil.querySelector('#mkEye');
  const mouthRow = m.veil.querySelector('#mkMouth');
  const drawFaces = () => {
    eyeRow.innerHTML = EYE_NAMES.map((n, i) => {
      const e = i - 1;                                  // 첫 칸이 「그때그때」(-1)
      /* 첫 칸은 **얼굴이 아니라 「안 고름」**이다. 무엇으로 그려도 나머지 열 중 하나와
         같은 그림이 되므로(정적인 한 장으로 「그때그때」를 그릴 방법은 없다),
         그림을 흐리고 테두리를 점선으로 둬서 다른 성질의 칸임을 표시한다. */
      return `<button class="swatch ${e < 0 ? 'auto ' : ''}${e === face.e ? 'on' : ''}" data-eye="${e}" title="${n}">
        ${portrait({ ...c, marks, face: { e: e < 0 ? 0 : e, m: face.m } }, 40, { frame:'head' })}
        <span>${n}</span></button>`;
    }).join('');
    mouthRow.innerHTML = MOUTH_NAMES.map((n, i) =>
      `<button class="swatch ${i === face.m ? 'on' : ''}" data-mouth="${i}" title="${n}">
        ${portrait({ ...c, marks, face: { e: face.e < 0 ? 0 : face.e, m: i } }, 40, { frame:'head' })}
        <span>${n}</span></button>`).join('');
    const pickFace = (k, v) => {
      face = { ...face, [k]: v };
      st.setFace(face);
      api.face(face);
      sfx.add();
      drawFaces();
    };
    eyeRow.querySelectorAll('[data-eye]').forEach(b =>
      b.onclick = () => pickFace('e', +b.dataset.eye));
    mouthRow.querySelectorAll('[data-mouth]').forEach(b =>
      b.onclick = () => pickFace('m', +b.dataset.mouth));
  };

  const push = () => { undo.push(st.snapshot()); if (undo.length > 20) undo.shift(); };
  /* 획이 끝났을 때만 부른다. 그리는 중에 부르면 초상 여섯 장을 매 프레임 다시 굽는다. */
  const commit = () => {
    st.adopt(R3.markKey(marks));      // 지금 판을 캐시로 — 초상이 다시 안 그린다
    api.marks(marks);
    drawFaces();
    chips();
  };

  m.veil.querySelectorAll('[data-ink]').forEach(b => b.onclick = () => {
    ink = +b.dataset.ink;
    mode = 'draw';                 // 색을 고르는 것은 그리겠다는 뜻이다
    chips();
  });
  m.veil.querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
    size = +b.dataset.size; mode = 'draw'; chips();
  });
  m.veil.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    mode = b.dataset.mode; sfx.add(); chips();
  });
  m.veil.querySelector('#mkSpin').onclick = () => st.reset();
  m.veil.querySelector('#mkUndo').onclick = () => {
    if (!undo.length) return;
    st.restore(undo.pop());
    marks.pop();
    sfx.add();
    commit();
  };

  /* ── 한 획 ──
     손가락이 지나간 점을 이어 붙인다. 점 사이는 **선분**으로 칠하므로 빨리 그어도
     점선이 안 되고, 천천히 그어도 같은 자리를 겹쳐 칠하지 않는다(EPS 로 거른다).

     지우개는 같은 붓으로 알파만 깎는다 — 「어느 무늬를 지울까」를 고를 필요가 없다.
     그 질문은 도장을 찍던 시절의 것이고, 그림에서는 지운 자리가 곧 답이다. */
  const EPS = 0.012;                  // 이만큼은 움직여야 다음 점이다
  let cur = null;                     // 지금 긋고 있는 획

  function startStroke(x, y){
    const d = st.pick(x, y);
    if (!d) return;
    push();
    cur = { c: Math.max(0, ink), r: MARK_SIZES[size], p: d.slice() };
    if (ink < 0) cur.e = 1;
    st.seg(d, d, cur.r, cur.c, !!cur.e);
  }
  function moveStroke(x, y){
    if (!cur) return;
    const d = st.pick(x, y);
    if (!d) return;
    const n = cur.p.length;
    const px = cur.p[n - 3], py = cur.p[n - 2], pz = cur.p[n - 1];
    if (Math.hypot(d[0] - px, d[1] - py, d[2] - pz) < EPS) return;
    st.seg([px, py, pz], d, cur.r, cur.c, !!cur.e);
    cur.p.push(d[0], d[1], d[2]);
  }
  function endStroke(){
    if (!cur) return;
    const drawn = cur;
    cur = null;
    /* 고양이를 스치지도 못한 획은 남기지 않는다 — 되돌리기를 눌렀는데 아무 일도
       안 일어나는 것이 제일 나쁘다 */
    marks.push(drawn);
    sfx.add();
    commit();
  }

  let drag = null;
  const at = e => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('#mkSpin')) return;
    try { stage.setPointerCapture(e.pointerId); } catch(err){}
    drag = { px: e.clientX, py: e.clientY, moved: 0 };
    e.preventDefault();
    if (mode === 'draw') startStroke(...at(e));
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    drag.px = e.clientX; drag.py = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'draw') moveStroke(...at(e));
    else if (drag.moved > 4) st.spin(dx, dy);
  });
  const end = () => {
    if (mode === 'draw'){
      if (cur) endStroke();
      else if (drag && undo.length) undo.pop();     // 허공을 그은 획
    }
    drag = null;
    chips();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  drawFaces();
  chips();
}

/* 꾸미기 창을 여는 단추. 면접창·계약서·인사 파일이 같은 줄을 쓴다 —
   세 자리에 다른 모양의 입구를 두면 같은 기능이 셋으로 보인다. */
function markRowHTML(c, id){
  return `<div class="markwrap" id="${id}">
    <div class="hint">${L({ ko:'꾸미기', en:'Customise', ja:'かざる' })}</div>
    <button class="markopen">${portrait(c, 30)}
      <b>${L({ ko:'커스터마이징 하기', en:'Customise', ja:'カスタマイズする' })}</b><i>›</i></button>
  </div>`;
}
/* 폰의 직원 탭(js/cozy.js)이 부르는 입구. 거기는 인사 파일 모달이 아예 안 열리므로
   — 카드를 누르면 고르기만 한다 — 사원증 옆에서 이 창을 바로 연다.
   저장·목록 갱신은 인사 파일에서 여는 것과 **같은 길**이다. */
function customizeCat(id, after){
  const c = (typeof S !== 'undefined' && S.cats || []).find(x => x.id === id);
  if (!c) return;
  const done = () => { renderRight(); if (after) after(); };
  showMarks(c, {
    marks: v => { setCatMarks(c, v); done(); },
    face:  v => { setCatFace(c, v);  done(); },
  });
}

function bindMarkRow(root, id, c, api){
  const wrap = root.querySelector('#' + id);
  if (!wrap) return;
  wrap.querySelector('.markopen').onclick = () => {
    sfx.add();
    showMarks(c, {
      marks: v => { api.marks(v); redrawMarkRow(root, id, c, api); },
      face:  v => { api.face(v);  redrawMarkRow(root, id, c, api); },
    });
  };
}
function redrawMarkRow(root, id, c, api){
  const wrap = root.querySelector('#' + id);
  if (!wrap) return;
  wrap.outerHTML = markRowHTML(c, id);
  bindMarkRow(root, id, c, api);
}

/* ---------- 면접 (신입 채용) ----------
   능력치·특성은 4d6이 정하고, 플레이어는 **이름과 색**을 정한다.
   지원자는 저장에 남아서, 창을 닫고 다시 열어도 같은 냥이다 —
   능력치를 다시 굴리려고 창을 여닫는 건 4d6의 의미를 없앤다. */
function showHire(){
  const free = deskCount() - S.cats.length;
  if (free <= 0){
    sfx.err();
    toast(L({ ko:'자리가 없습니다. 분기를 넘겨 사무실을 넓히세요.',
              en:'No desks left. Advance quarters to expand the office.',
              ja:'席がありません。四半期を進めてオフィスを広げましょう。' }));
    return;
  }
  const c = candidateCat();
  const cost = hireCost();
  const tr = traitOf(c);

  const statCell = k => {
    const v = c.stats[k];
    const cls = v >= 15 ? 'hi' : v <= 8 ? 'lo' : '';
    return `<div class="st ${cls}" title="${STAT_DESC[k]}"><small>${STAT_NAME[k]}</small><b>${v}</b><small>&nbsp;</small></div>`;
  };
  const swatch = (look, on, label) =>
    `<button class="swatch ${on?'on':''}" data-fur="${look.fur}" data-hue="${look.hue}" title="${label}">
       ${portrait({ fur:look.fur, hue:look.hue }, 34)}<span>${label}</span></button>`;

  /* 3D 에서는 고양이가 손그림이라 털색·색조가 아무 의미가 없다.
     대신 그려둔 그림 중에서 고른다 — 그림이 곧 그 고양이다. */
  const draws = () => (typeof CAT_DRAWS !== 'undefined' && CAT_DRAWS.length) ? CAT_DRAWS : [];
  const drawSwatch = (i, on) =>
    `<button class="swatch ${on?'on':''}" data-draw="${i}" title="${i + 1}">
       <span class="pix" style="width:38px;height:38px;background-size:contain;
         background-position:center;background-repeat:no-repeat;image-rendering:auto;
         background-image:${cssURL(assetURL('assets/cats_drawn/' + draws()[i]))}"></span><span>${i + 1}</span></button>`;
  const lookSection = () => is3d() && !sculptCats() && draws().length
    ? `<div class="hint">${L({ ko:'고양이 그림', en:'Drawing', ja:'絵' })}</div>
       <div class="swatches" id="hireDraw">
         ${draws().map((_, i) => drawSwatch(i, i === (c.draw ?? 0))).join('')}
       </div>`
    : `<div class="hint">${L({ ko:'털색', en:'Coat', ja:'毛色' })}</div>
       <div class="swatches" id="hireFur">
         ${FURS.map((f, i) => swatch({ fur:i, hue:c.hue }, i === c.fur, f.n)).join('')}
       </div>
       <div class="hint">${L({ ko:'색조', en:'Tint', ja:'色調' })}</div>
       <div class="swatches" id="hireHue">
         ${HUE_CHOICES.map(h => swatch({ fur:c.fur, hue:h.h }, h.h === c.hue, h.n)).join('')}
       </div>`;

  /* 색 고르기 **바로 밑**이 무늬 자리다. 색과 무늬는 같은 질문("어떻게 생겼나")의
     두 칸이라 떨어뜨려 놓으면 하나는 안 보인다. 손그림 판에서는 안 뜬다 —
     그쪽은 그림 파일이 곧 그 고양이라 얹을 자리가 없다. */
  const markSection = () => (is3d() && sculptCats()) ? markRowHTML(c, 'hireMark') : '';

  const m = modal(`
    <div class="mhead"><div class="q">JOB INTERVIEW</div>
      <h3>${L({ ko:'입사 지원서', en:'Job Application', ja:'入社応募書' })}</h3>
      <p>${L({ ko:'능력치는 4d6이 정합니다. 이름과 색은 당신이 정합니다.',
               en:'4d6 decides the stats. You decide the name and colour.',
               ja:'能力値は4d6が決めます。名前と色はあなたが決めます。' })}</p></div>
    <div class="mbody">
      <div class="resume">
        <span id="hirePic">${portrait(c, 84)}</span>
        <div style="flex:1">
          <div class="tiny" style="margin-bottom:5px">${L({ ko:'특성', en:'Trait', ja:'特性' })}
            <b>${tr.n}</b> — ${tr.d}</div>
          <label class="tiny" for="hireName">${L({ ko:'이름', en:'Name', ja:'名前' })}</label>
          <div class="namerow">
            <input id="hireName" maxlength="12" autocomplete="off" value="${esc(c.name)}">
            <button class="buy alt" id="hireDice" title="${L({ ko:'이름 다시 뽑기', en:'Roll a new name', ja:'名前を引き直す' })}">🎲</button>
          </div>
          <div class="tiny" id="hireNameHint">${L({ ko:'직접 적거나 🎲 를 누르세요',
            en:'Type one, or press 🎲', ja:'入力するか🎲を押してください' })}</div>
        </div>
      </div>

      ${lookSection()}
      ${markSection()}

      <div class="statgrid">${STAT_KEYS.map(statCell).join('')}</div>
      <div class="tiny">${L({
        ko:'4d6 중 최저값 1개를 버려 굴린 값입니다. 면접창을 닫아도 같은 지원자가 기다립니다.',
        en:'Rolled with 4d6, dropping the lowest. Close this and the same applicant waits for you.',
        ja:'4d6の最低値1つを捨てて振った値です。閉じても同じ応募者が待っています。',
      })}</div>
    </div>
    <div class="mfoot">
      <button class="okbtn alt" data-close>${L({ ko:'나중에', en:'Later', ja:'あとで' })}</button>
      <button class="okbtn" id="hireGo" ${S.anchovy < cost ? 'disabled' : ''}>
        ${L({ ko:'채용', en:'Hire', ja:'採用' })} 🐟${fmt(cost)}</button>
    </div>`);

  const nameEl = m.veil.querySelector('#hireName');
  const refresh = () => {
    m.veil.querySelector('#hirePic').innerHTML = portrait(c, 84);
    const dr = m.veil.querySelector('#hireDraw');
    if (dr){
      dr.innerHTML = draws().map((_, i) => drawSwatch(i, i === (c.draw ?? 0))).join('');
    } else {
      // 스와치는 현재 선택을 반영해 다시 그린다 — 털색을 바꾸면 색조 미리보기도 같이 바뀐다
      m.veil.querySelector('#hireFur').innerHTML =
        FURS.map((f, i) => swatch({ fur:i, hue:c.hue }, i === c.fur, f.n)).join('');
      m.veil.querySelector('#hireHue').innerHTML =
        HUE_CHOICES.map(h => swatch({ fur:c.fur, hue:h.h }, h.h === c.hue, h.n)).join('');
    }
    /* 무늬 줄의 얼굴도 같이 갈아 준다 — 털색을 바꿨는데 그 줄만 옛 색이면
       무늬가 색과 딴 물건으로 보인다. */
    redrawMarkRow(m.veil, 'hireMark', c, markApply);
    bindSwatches();
  };
  const markApply = {
    marks: v => { styleCandidate({ marks: v }); m.veil.querySelector('#hirePic').innerHTML = portrait(c, 84); },
    face:  v => { styleCandidate({ face: v });  m.veil.querySelector('#hirePic').innerHTML = portrait(c, 84); },
  };
  bindMarkRow(m.veil, 'hireMark', c, markApply);
  function bindSwatches(){
    m.veil.querySelectorAll('.swatch').forEach(b => b.onclick = () => {
      styleCandidate(b.dataset.draw != null
        ? { draw: +b.dataset.draw }
        : { fur:+b.dataset.fur, hue:+b.dataset.hue });
      sfx.add();
      refresh();
    });
  }
  bindSwatches();

  nameEl.addEventListener('input', () => styleCandidate({ name: nameEl.value }));
  m.veil.querySelector('#hireDice').onclick = () => {
    nameEl.value = rerollCandidateName();
    sfx.meow();
  };
  m.veil.querySelector('#hireGo').onclick = () => {
    const r = hire({ name: nameEl.value, fur: c.fur, hue: c.hue, draw: c.draw,
                    marks: c.marks, face: c.face });
    if (r.err){ sfx.err(); toast(r.err); return; }
    m.close();
    sfx.buy(); setTimeout(sfx.meow, 200);
    confetti();
    toast(L({ ko:`${r.cat.name} 냥 입사. 잘 부탁한다냥`,
              en:`${r.cat.name} joined. Pleased to meet you, nya`,
              ja:`${r.cat.name}が入社。よろしくにゃ` }));
    renderRight(); renderTop();
  };
  nameEl.focus();
  nameEl.select();
}

function showQuarter(d){
  const yr = Math.floor((d.q-1)/4)+1, qq = ((d.q-1)%4)+1;
  const nextMove = TIER_AT_QUARTER.find(x => x > S.quarter);
  modal(`
    <div class="mhead"><div class="q">QUARTERLY REPORT</div><h3>${L({ ko:`Q${d.q} 결산 보고`, en:`Q${d.q} Report`, ja:`Q${d.q}決算報告` })}</h3>
      <p>${L({ ko:`${yr}년차 ${qq}분기`, en:`Year ${yr}, Q${qq}`, ja:`${yr}年目 第${qq}四半期` })} · ${TIERS[d.oldTier].name}</p></div>
    <div class="mbody">
      <div class="rrow"><span>${L({ ko:'분기 매출', en:'Revenue', ja:'四半期売上' })}</span><b>🐟 ${fmt(d.earned)}</b></div>
      <div class="rrow"><span>${L({ ko:'결재 처리', en:'Approvals', ja:'決裁処理' })}</span><b>${L({ ko:`${d.done} 건`, en:`${d.done}`, ja:`${d.done}件` })}</b></div>
      <div class="rrow"><span>${L({ ko:'재직 직원', en:'Staff', ja:'在籍社員' })}</span><b>${L({ ko:`${S.cats.length} 냥`, en:`${S.cats.length} cats`, ja:`${S.cats.length}匹` })}</b></div>
      <div class="rrow"><span>${L({ ko:'평균 사기', en:'Avg morale', ja:'平均士気' })}</span><b>${Math.round(avgMood())}%</b></div>
      <div class="rrow"><span>${L({ ko:'분기 배당', en:'Dividend', ja:'四半期配当' })}</span><b class="good">+🐟 ${fmt(d.bonus)}</b></div>
      ${typeof beatQuarterRow === 'function' ? beatQuarterRow(d) : ''}
      ${d.rival ? `<div class="rrow"><span>${L({ ko:'멍멍파 점유율', en:'Woof Gang share', ja:'ワンワン組シェア' })}</span><b class="${d.rival.delta>0?'bad':'good'}">
        ${Math.round(d.rival.before*100)}% → ${Math.round(d.rival.after*100)}%
        (${L({ ko:`처리 ${d.done}/${d.rival.par}건`, en:`${d.done}/${d.rival.par} done`, ja:`処理${d.done}/${d.rival.par}件` })})</b></div>` : ''}
      ${d.rivalNews ? `<div class="rivalbox"><span class="lbl">${L({ ko:'멍멍파 근황', en:'Woof Gang watch', ja:'ワンワン組の近況' })}</span>${d.rivalNews}</div>` : ''}
      ${d.evGain?`<div class="rrow"><span>${L({ ko:'특별 손익', en:'One-off P&L', ja:'特別損益' })}</span><b class="${d.evGain>0?'good':'bad'}">${d.evGain>0?'+':'-'}🐟 ${fmt(Math.abs(d.evGain))}</b></div>`:''}
      ${d.raiding?`<div class="raidbox">
        <div class="siren">${L({ ko:'🚨 특별사법경찰 출동 통보', en:'🚨 Special Investigation Unit dispatched', ja:'🚨 特別司法警察 出動通知' })}</div>
        ${L({
          ko:'혐의가 한계치를 넘었습니다. 영장이 발부됐고 냥찰청이 오고 있습니다.',
          en:'Heat crossed the line. A warrant is out and the Pawlice are on their way.',
          ja:'容疑が限界を超えました。令状が出て、ニャン察が向かっています。',
        })}
        <div class="tiny" style="margin-top:6px">${L({
          ko:'조사 중 생산 40% · 종료 시 과징금 15% · 직원 연행 가능',
          en:'Output 40% during the raid · 15% fine at the end · staff may be taken in',
          ja:'調査中は生産40%・終了時に課徴金15%・連行の可能性あり',
        })}</div>
      </div>`:''}

      ${d.back && d.back.length?`<div class="okbox">${d.back.map(j=>L({
        ko:`${esc(j.cat.name)} 냥 복귀 (무혐의)`,
        en:`${esc(j.cat.name)} is back (cleared)`,
        ja:`${esc(j.cat.name)} 復帰（嫌疑なし）`,
      })).join('<br>')}</div>`:''}

      <div class="evt"><span class="lbl">${L({ ko:'이번 분기 사건', en:'This quarter’s incident', ja:'今期の事件' })}</span>${d.evText}
        ${d.evHire?`<div class="hireline">${portrait(d.evHire,34)}
          <span>${L({
            ko:`<b>${esc(d.evHire.name)}</b> 냥이 그대로 입사했습니다. (${traitOf(d.evHire).n})`,
            en:`<b>${esc(d.evHire.name)}</b> just joined on the spot. (${traitOf(d.evHire).n})`,
            ja:`<b>${esc(d.evHire.name)}</b>がそのまま入社しました。（${traitOf(d.evHire).n}）`,
          })}</span></div>`:''}
        ${d.evDrop?`<div class="tiny" style="margin-top:8px">${L({
          ko:`📦 <b>${d.evDrop.n}</b> 도착 — 뜯는 것은 택배 화면에서.`,
          en:`📦 <b>${d.evDrop.n}</b> arrived — open it on the parcel screen.`,
          ja:`📦 <b>${d.evDrop.n}</b>が届きました——開けるのは宅配画面で。`,
        })}</div>`:''}
      </div>

      ${d.moved?`<div class="promo">
          <div class="lbl2">${L({ ko:'사 무 실 이 전', en:'OFFICE MOVE', ja:'オフィス移転' })}</div>
          <div class="big">${TIERS[S.tier].name}</div>
          <div class="tiny2">${L({
            ko:`자리 ${TIERS[d.oldTier].desks}석 → <b>${deskCount()}석</b> · 전 직원 생산 +22%`,
            en:`Desks ${TIERS[d.oldTier].desks} → <b>${deskCount()}</b> · all staff +22%`,
            ja:`席 ${TIERS[d.oldTier].desks}→<b>${deskCount()}</b>・全員の生産+22%`,
          })}</div>
          <div class="flavor">“${TIERS[S.tier].flavor}”</div>
          <div class="tiny">${L({ ko:'평면도는 새로 생성되었습니다', en:'A fresh floor plan was generated', ja:'間取りは新しく生成されました' })}</div>
        </div>` : `<div class="tiny center" style="margin-top:14px">
          ${nextMove ? L({
            ko:`다음 이전까지 ${nextMove - S.quarter}분기`,
            en:`${nextMove - S.quarter} quarter(s) to the next move`,
            ja:`次の移転まで${nextMove - S.quarter}四半期`,
          }) : L({ ko:'— 최종 지사 도달', en:'— final branch reached', ja:'——最終支社に到達' })}</div>`}

      <div class="nextgoal">${L({
        ko:`<b>Q${S.quarter}</b> 목표: <b>${qTarget(S.quarter)} 성과</b>`,
        en:`<b>Q${S.quarter}</b> target: <b>${qTarget(S.quarter)} KPI</b>`,
        ja:`<b>Q${S.quarter}</b>目標：<b>${qTarget(S.quarter)}成果</b>`,
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'다음 분기 시작', en:'Start next quarter', ja:'次の四半期へ' })}</button></div>`);
}

function showRaidEnd(d){
  modal(`
    <div class="mhead police"><div class="q">SPECIAL INVESTIGATION</div>
      <h3>${L({ ko:'조사 결과 통지서', en:'Investigation Result Notice', ja:'調査結果通知書' })}</h3>
      <p>${L({ ko:'냥찰청 특별사법경찰 3팀', en:'Pawlice SIU, Squad 3', ja:'ニャン察庁特別司法警察 3班' })}</p></div>
    <div class="mbody">
      <div class="rrow"><span>${L({ ko:'혐의 내용', en:'Charges', ja:'容疑内容' })}</span><b>${L({
        ko:`마약류관리법 위반 (혐의 ${d.before}점)`,
        en:`Narcotics Control Act violation (heat ${d.before})`,
        ja:`麻薬類管理法違反（容疑${d.before}点）`,
      })}</b></div>
      <div class="rrow"><span>${L({ ko:'과징금', en:'Fine', ja:'課徴金' })}</span><b class="bad">-🐟 ${fmt(d.fine)}</b></div>
      <div class="rrow"><span>${L({ ko:'혐의 처리', en:'Heat', ja:'容疑処理' })}</span><b class="good">${d.before} → 0</b></div>
      ${d.taken?`<div class="raidbox"><div class="siren">${L({ ko:'🚔 참고인 연행', en:'🚔 Witness taken in', ja:'🚔 参考人連行' })}</div>
        ${L({
          ko:`<b>${esc(d.taken.name)}</b> 냥을 참고인 자격으로 연행합니다. 다음 분기 결산 시 복귀 예정입니다.`,
          en:`<b>${esc(d.taken.name)}</b> is being taken in as a witness. Back at next quarter’s close.`,
          ja:`<b>${esc(d.taken.name)}</b>を参考人として連行します。次の決算時に復帰予定です。`,
        })}
        <div class="hireline" style="margin-top:8px">${portrait(d.taken,34)}<span class="tiny">${L({ ko:'“저는 인턴인데요”', en:'“I’m just an intern”', ja:'「ただのインターンです」' })}</span></div>
      </div>`:`<div class="okbox">${L({ ko:'연행 인원 없음. 전 직원 귀가 조치.', en:'Nobody taken. All staff sent home.', ja:'連行なし。全員帰宅となりました。' })}</div>`}
      ${typeof beatRaidNote === 'function' ? beatRaidNote() : ''}
      <div class="tiny center" style="margin-top:12px">${L({
        ko:'재발 시 가중 처벌됩니다. 서류는 제때 정리하십시오.',
        en:'Repeat offenses are punished harder. File your papers on time.',
        ja:'再犯は加重処罰です。書類は期限内に整理してください。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'확인했습니다', en:'Acknowledged', ja:'確認しました' })}</button></div>`);
}

/* 부재중 보고 — 오래 비웠다 돌아왔을 때만 연다.
   숫자는 그대로 두고, 그 옆에 그사이 사무실 상황을 두세 줄 붙인다.
   자리를 비운 걸 나무라는 문서가 되면 안 된다. 인수인계지 근태 기록이 아니다. */
function showReturn(o){
  /* 닫혀 있던 시간엔 매출 칸을 아예 그리지 않는다. 0 을 적어 보여주는 건
     "이만큼 놓쳤다"는 말이고, 그건 마중이 아니라 잔소리다. */
  const money = o.gain > 0
    ? `<div class="rrow"><span>${L({ ko:'급식기가 돌린 매출', en:'Kept going by the feeder', ja:'給餌器が回した売上' })}</span><b class="good">+🐟 ${fmt(o.gain)}</b></div>`
    : '';
  modal(`
    <div class="mhead"><div class="q">RETURN BRIEF</div>
      <h3>${L({ ko:'부재중 보고', en:'While You Were Out', ja:'不在中の報告' })}</h3>
      <p>${L({ ko:`사무실이 닫혀 있던 ${o.timeStr} 동안`, en:`The ${o.timeStr} the office was closed`, ja:`オフィスが閉まっていた${o.timeStr}のあいだ` })}</p></div>
    <div class="mbody">
      ${money}
      <div class="evt"><span class="lbl">${L({ ko:'사무실 상황', en:'Office notes', ja:'オフィスの様子' })}</span>
        ${o.story.map(s => `<p class="storyline">${s}</p>`).join('')}</div>
      <div class="tiny center" style="margin-top:12px">${L({
        ko:'천천히 시작하면 됩니다.',
        en:'Take your time getting started.',
        ja:'ゆっくり始めて大丈夫です。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'확인', en:'OK', ja:'確認' })}</button></div>`);
}

/* ---------- 설정 ---------- */
function showSettings(){
  const onOff = v => v ? L({ ko:'켜짐', en:'On', ja:'オン' }) : L({ ko:'꺼짐', en:'Off', ja:'オフ' });
  const m = modal(`
    <div class="mhead"><div class="q">SETTINGS</div><h3>${L({ ko:'설정', en:'Settings', ja:'設定' })}</h3>
      <p>${L({ ko:'언어 · 알림 · 근무 시간', en:'Language · notifications · work hours', ja:'言語・通知・勤務時間' })}</p></div>
    <div class="mbody">
      ${!DEBUG ? '' : `<div class="card">
        <div class="crow"><span class="em">🔭</span>
          <div class="info"><b>${L({ ko:'풍경 고정 (디버그)', en:'Pin the sky (debug)', ja:'風景を固定（デバッグ）' })}</b>
            <span>${L({
              ko:'창밖·햇빛·빛 자락·밤 볼륨·자동 재생이 전부 따라옵니다. 저장되지 않습니다.',
              en:'Windows, sunlight, light shafts, night volume and auto music all follow. Not saved.',
              ja:'窓の外・日差し・光の帯・夜の音量・おまかせ再生が全部ついてきます。保存されません。',
            })}</span></div>
        </div>
        <div class="sizes skyrow">${SKY_PICKS.map(([id, label]) =>
          `<button class="size ${skyForced() === id ? 'on' : (!skyForced() && !id ? 'on' : '')}" data-sky="${id}"><b>${label}</b></button>`).join('')}</div>
      </div>`}
      <div class="card">
        <div class="crow"><span class="em">🌐</span>
          <div class="info"><b>${L({ ko:'언어', en:'Language', ja:'言語' })}</b>
            <span>${L({ ko:'바꾸면 새로고침됩니다. 진행 상황은 저장됩니다.', en:'Changing reloads the page. Progress is saved.', ja:'変更するとページを再読み込みします。進行状況は保存されます。' })}</span></div>
        </div>
        <div class="sizes langrow">${LANGS.map(([code, label]) =>
          `<button class="size ${code===LANG?'on':''}" data-lang="${code}"><b>${label}</b></button>`).join('')}</div>
      </div>
      <div class="card">
        <div class="crow"><span class="em">🔔</span>
          <div class="info"><b>${L({ ko:'데스크탑 알림', en:'Desktop notifications', ja:'デスクトップ通知' })}</b>
            <span>${L({
              ko:'창이 백그라운드일 때 점심·휴식·퇴근을 알려줍니다',
              en:'Lunch, break and clock-out nudges while the tab is in the background',
              ja:'タブが背面のとき、昼休み・休憩・退勤をお知らせします',
            })}</span></div>
          <button class="buy alt" data-set="notif">${onOff(notifEnabled())}</button>
        </div>
      </div>
      <div class="card">
        <div class="crow"><span class="em">🕘</span>
          <div class="info"><b>${L({ ko:'근무 시간', en:'Work hours', ja:'勤務時間' })}</b>
            <span>${L({
              ko:'사무실이 이 시간에 맞춰 돕니다 — 단계·수당·케어 방송·「퇴근까지」가 전부 여기서 나옵니다. 자정을 넘겨도 됩니다.',
              en:'The office runs on these — phases, pay rate, the care broadcasts and the countdown all come from here. It may cross midnight.',
              ja:'オフィスはこの時間で回ります——段階・手当・ケア放送・「退勤まで」が全部ここから出ます。日付をまたいでも構いません。',
            })}</span></div>
        </div>
        <div class="shiftrow">
          <select data-set="shiftStart">${shiftOpts(shiftOf().start / 60)}</select>
          <span class="sharrow">→</span>
          <select data-set="shiftEnd">${shiftOpts(shiftOf().end / 60)}</select>
          <span class="shiftinfo" id="shiftInfo">${shiftInfoText()}</span>
        </div>
      </div>
      <div class="card">
        <div class="crow"><span class="em">🧭</span>
          <div class="info"><b>${L({ ko:'첫 출근 안내', en:'First-day walkthrough', ja:'初出勤の案内' })}</b>
            <span>${L({
              ko:'올리고 · 체크하고 · 도장이 찍히기까지. 밀린 서류가 어떻게 되는지도 여기서 말합니다.',
              en:'File it, check it, watch it get stamped — and what happens to the ones you don’t finish.',
              ja:'出して・チェックして・判が押されるまで。終わらなかった書類がどうなるかもここで話します。',
            })}</span></div>
          <button class="buy alt" data-set="tutor">${L({ ko:'다시 보기', en:'Replay', ja:'もう一度' })}</button>
        </div>
      </div>
      <div class="card">
        <div class="crow"><span class="em">🎬</span>
          <div class="info"><b>${L({ ko:'오프닝', en:'Opening', ja:'オープニング' })}</b>
            <span>${L({
              ko:'전단을 보고 전화를 걸던 그 밤. 실시간으로 다시 그립니다.',
              en:'The night of the flyer and the phone call — rendered again, live.',
              ja:'チラシを見て電話をかけたあの夜。もう一度、実時間で。',
            })}</span></div>
          <button class="buy alt" data-set="intro">${L({ ko:'다시 보기', en:'Replay', ja:'もう一度' })}</button>
        </div>
      </div>
      <div class="card" data-card="outro">
        <div class="crow"><span class="em">🌃</span>
          <div class="info"><b>${L({ ko:'마지막 장면', en:'The last scene', ja:'最後の場面' })}</b>
            <span>${L({
              ko:'줌아웃하면 지점들이 깔리고, 그 위에서 누군가 내려다보고 있습니다.',
              en:'Pull back far enough and the branches spread out — with someone watching from above.',
              ja:'ズームアウトすると支店が広がり、その上から誰かが見下ろしています。',
            })}</span></div>
          <button class="buy alt" data-set="outro">${L({ ko:'다시 보기', en:'Replay', ja:'もう一度' })}</button>
        </div>
      </div>
      <div class="hint center" style="margin-top:8px">${L({
        ko:'음악과 음량은 <b>사무실의 CD 플레이어</b>에서 만집니다. 음량 0 이 곧 전체 음소거입니다.',
        en:'Music and volume are both handled at the <b>CD player in the office</b>. Volume 0 is the master mute.',
        ja:'音楽も音量も<b>オフィスのCDプレーヤー</b>で扱います。音量0が全体ミュートです。',
      })}</div>
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  m.veil.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => setLang(b.dataset.lang));
  /* 배경 음악 · 3D 사무실 · 사무실 톤 · 고양이 그림체는 **설정에서 뺐다.**
     넷 다 "한 번 고르고 다시 안 여는" 항목이었고, 그런 건 설정이 아니라 기본값이다.
     음악을 끄는 자리는 사무실의 CD 플레이어(음량 0 = 전체 음소거)로 이미 하나 있다 —
     같은 일을 하는 스위치가 두 군데 있는 게 원래 문제였다. */
  const notifBtn = m.veil.querySelector('[data-set="notif"]');
  notifBtn.onclick = () => {
    if (notifEnabled()) setNotif(false, on => notifBtn.textContent = onOff(on));
    else setNotif(true, on => notifBtn.textContent = onOff(on));
  };
  /* 오프닝은 모듈이라 file:// 에서 소스 트리를 그냥 열면 없다 — 그때는 줄을 숨긴다 */
  /* 근무 시간 — 고르는 즉시 반영된다. 저장하고 다시 열어야 적용되는 설정은
     "내 시계로 돈다"는 말과 안 맞는다. 시계 칩과 케어 타이머가 다음 틱에 따라온다. */
  const shStart = m.veil.querySelector('[data-set="shiftStart"]');
  const shEnd = m.veil.querySelector('[data-set="shiftEnd"]');
  if (shStart && shEnd){
    const apply = () => {
      if (!S.shift) S.shift = { start: 9, end: 18 };
      S.shift.start = Number(shStart.value);
      S.shift.end = Number(shEnd.value);
      save();
      const info = m.veil.querySelector('#shiftInfo');
      if (info) info.textContent = shiftInfoText();
      renderTop();
      sfx.add();
    };
    shStart.onchange = apply;
    shEnd.onchange = apply;
  }
  const tutBtn = m.veil.querySelector('[data-set="tutor"]');
  if (tutBtn) tutBtn.onclick = () => { m.close(); setTimeout(startTutor, 250); };
  const introBtn = m.veil.querySelector('[data-set="intro"]');
  if (!window.CCOpen) introBtn.closest('.card').style.display = 'none';
  else introBtn.onclick = () => { m.close(); playIntro({ replay:true }); };
  /* 마지막 장면 — **본 사람에게만 보인다.** 안 본 사람에게 목록으로 걸어 두면
     그건 다시 보기가 아니라 결말을 미리 알려 주는 것이다. */
  const outBtn = m.veil.querySelector('[data-set="outro"]');
  if (outBtn){
    const can = typeof endingSeen === 'function' && endingSeen() && typeof playOutro === 'function';
    if (!can) outBtn.closest('.card').style.display = 'none';
    else outBtn.onclick = () => { m.close(); setTimeout(playOutro, 260); };
  }
  /* 풍경 고정 — 누르는 즉시 반영된다(setSkyForce 가 renderNight 을 부른다).
     창을 닫고 다시 열 필요가 없어야 한다: 이건 눈으로 비교하려고 만든 것이다. */
  m.veil.querySelectorAll('[data-sky]').forEach(b => b.onclick = () => {
    setSkyForce(b.dataset.sky);
    m.veil.querySelectorAll('[data-sky]').forEach(x =>
      x.classList.toggle('on', (skyForced() || '') === x.dataset.sky));
    sfx.add();
  });
}

/* ============================================================
   근로계약서 — 프롤로그가 끝나면 첫 고양이의 이름과 겉모습을 정한다.

   왜 1번 사원만 이런 창을 갖는가: 프롤로그의 "나"가 곧 이 고양이다. 남이 붙인
   이름(「치즈」)을 단 고양이가 화면의 유일한 직원이면 그 회사는 내 회사로 안 읽힌다.
   능력치는 채용창과 달리 굴리지 않는다 — 창업 멤버는 지원자가 아니라 당신이다.
   닫기 버튼이 없는 유일한 모달이다.
   ============================================================ */
function showContract(onDone){
  const c = S.cats[0];
  if (!c){ if (onDone) onDone(); return; }
  const tr = traitOf(c);
  const draws = () => (typeof CAT_DRAWS !== 'undefined' && CAT_DRAWS.length) ? CAT_DRAWS : [];

  const swatch = (look, on, label) =>
    `<button class="swatch ${on?'on':''}" data-fur="${look.fur}" data-hue="${look.hue}" title="${label}">
       ${portrait({ fur:look.fur, hue:look.hue }, 34)}<span>${label}</span></button>`;
  const drawSwatch = (i, on) =>
    `<button class="swatch ${on?'on':''}" data-draw="${i}" title="${i + 1}">
       <span class="pix" style="width:38px;height:38px;background-size:contain;
         background-position:center;background-repeat:no-repeat;image-rendering:auto;
         background-image:${cssURL(assetURL('assets/cats_drawn/' + draws()[i]))}"></span><span>${i + 1}</span></button>`;
  const lookSection = () => is3d() && !sculptCats() && draws().length
    ? `<div class="hint">${L({ ko:'고양이 그림', en:'Drawing', ja:'絵' })}</div>
       <div class="swatches" id="cnDraw">${draws().map((_, i) => drawSwatch(i, i === (c.draw ?? 0))).join('')}</div>`
    : `<div class="hint">${L({ ko:'털색', en:'Coat', ja:'毛色' })}</div>
       <div class="swatches" id="cnFur">${FURS.map((f, i) => swatch({ fur:i, hue:c.hue }, i === c.fur, f.n)).join('')}</div>
       <div class="hint">${L({ ko:'색조', en:'Tint', ja:'色調' })}</div>
       <div class="swatches" id="cnHue">${HUE_CHOICES.map(h => swatch({ fur:c.fur, hue:h.h }, h.h === c.hue, h.n)).join('')}</div>`;

  const m = modal(`
    <div class="mhead contract"><div class="q">EMPLOYMENT CONTRACT</div>
      <h3>${L({ ko:'근로계약서', en:'Employment Contract', ja:'雇用契約書' })}</h3>
      <p>${L({ ko:'사원번호 001 · 직위: 대표 (고정)',
               en:'Employee #001 · Title: Boss (permanent)',
               ja:'社員番号001・役職：社長（固定）' })}</p></div>
    <div class="mbody">
      <div class="sigrow"><span class="em">🪪</span>
        <b>${L({ ko:'이 고양이가 당신입니다.', en:'This cat is you.', ja:'この猫があなたです。' })}</b></div>
      <div class="resume">
        <span id="cnPic">${portrait(c, 84)}</span>
        <div style="flex:1">
          <div class="tiny" style="margin-bottom:5px">${L({ ko:'특성', en:'Trait', ja:'特性' })}
            <b>${tr.n}</b> — ${tr.d}</div>
          <label class="tiny" for="cnName">${L({ ko:'이름', en:'Name', ja:'名前' })}</label>
          <div class="namerow">
            <input id="cnName" maxlength="12" autocomplete="off" value="${esc(c.name)}">
            <button class="buy alt" id="cnDice" title="${L({ ko:'이름 다시 뽑기', en:'Roll a new name', ja:'名前を引き直す' })}">🎲</button>
          </div>
          <div class="tiny">${L({ ko:'책상 위 이름표는 아직 뒤집혀 있습니다.',
                                  en:'The nameplate on the desk is still face-down.',
                                  ja:'机の名札は、まだ裏返しのままです。' })}</div>
        </div>
      </div>
      ${lookSection()}
      ${sculptCats() ? markRowHTML(c, 'cnMark') : ''}
      <div class="statgrid">${STAT_KEYS.map(k => {
        const v = c.stats[k], cls = v >= 15 ? 'hi' : v <= 8 ? 'lo' : '';
        return `<div class="st ${cls}" title="${STAT_DESC[k]}"><small>${STAT_NAME[k]}</small><b>${v}</b><small>&nbsp;</small></div>`;
      }).join('')}</div>
      <div class="tiny">${L({
        ko:'창업 멤버라 능력치는 이미 굴려져 있습니다. 이름과 겉모습만 정하면 됩니다. 직급은 <b>대표</b>로 고정이고, 승진 대신 몫이 오릅니다.',
        en:'As a founder your stats are already rolled — you only choose the name and the look. Your title stays <b>Boss</b>; instead of promotions you raise your own cut.',
        ja:'創業メンバーなので能力値はすでに振られています。名前と見た目だけ決めてください。役職は<b>社長</b>で固定、昇進の代わりに取り分が上がります。',
      })}</div>
    </div>
    <div class="mfoot">
      <button class="okbtn" id="cnGo">${L({ ko:'서명하고 출근한다', en:'Sign and clock in', ja:'署名して出勤する' })}</button>
    </div>`);

  const nameEl = m.veil.querySelector('#cnName');
  /* 1번 사원은 이미 S.cats 에 있다(지원자가 아니다) — 그래서 무늬는 바로 그 냥에게 들어간다 */
  const cnMarks = {
    marks: v => { setCatMarks(c, v); m.veil.querySelector('#cnPic').innerHTML = portrait(c, 84); },
    face:  v => { setCatFace(c, v);  m.veil.querySelector('#cnPic').innerHTML = portrait(c, 84); },
  };
  bindMarkRow(m.veil, 'cnMark', c, cnMarks);
  const refresh = () => {
    m.veil.querySelector('#cnPic').innerHTML = portrait(c, 84);
    const dr = m.veil.querySelector('#cnDraw');
    if (dr) dr.innerHTML = draws().map((_, i) => drawSwatch(i, i === (c.draw ?? 0))).join('');
    else {
      m.veil.querySelector('#cnFur').innerHTML =
        FURS.map((f, i) => swatch({ fur:i, hue:c.hue }, i === c.fur, f.n)).join('');
      m.veil.querySelector('#cnHue').innerHTML =
        HUE_CHOICES.map(h => swatch({ fur:c.fur, hue:h.h }, h.h === c.hue, h.n)).join('');
    }
    redrawMarkRow(m.veil, 'cnMark', c, cnMarks);
    bind();
  };
  function bind(){
    m.veil.querySelectorAll('.swatch').forEach(b => b.onclick = () => {
      if (b.dataset.draw != null) c.draw = +b.dataset.draw;
      else { c.fur = +b.dataset.fur; c.hue = +b.dataset.hue; }
      sfx.add();
      refresh();
    });
  }
  bind();

  m.veil.querySelector('#cnDice').onclick = () => {
    nameEl.value = uniqueName();
    sfx.meow();
  };
  m.veil.querySelector('#cnGo').onclick = () => {
    signContract({ name: nameEl.value, fur: c.fur, hue: c.hue, draw: c.draw });
    m.close();
    sfx.stamp(); setTimeout(sfx.meow, 220);
    confetti();
    renderTiles(); renderRight(); renderTop();
    /* 서명 다음이 지점 등록이다(TODO 59). 여기서 이어 붙이는 이유: 이 둘은
       **첫 부팅에 한 번 지나가는 한 줄**이고, 그 순서를 부르는 쪽(main.js)이
       알아야 할 이유가 없다. 계약서가 끝나면 다음 문이 열린다. */
    if (typeof showBranchSetup === 'function') showBranchSetup(onDone);
    else if (onDone) onDone();
  };
  nameEl.focus();
  nameEl.select();
}

/* ---------- 지점 등록 (TODO 59) ----------
   이름이 showBranch 가 아닌 이유: **그 이름은 이미 쓰인다** — js/board.js 의
   showBranch(id) 는 제휴 지점 **구경하기**다. 게다가 board.js 가 ui.js 보다 뒤에
   실리므로, 같은 이름으로 두면 이쪽이 조용히 덮인다(실제로 한 번 덮였고,
   창이 안 뜨는데 예외도 안 나는 모양으로 나타났다).
   계약서에 서명한 **바로 다음**이다. 순서에 이유가 있다: 계약서에서 정하는 것은
   「내가 누구인가」(이름·겉모습)이고, 여기서 정하는 것은 「이 지점이 어디인가」다.
   같은 창에 합치면 폼이 길어지는데, 그 창은 이 게임에서 **닫을 수 없는 유일한 창**이라
   길어지는 만큼 도망갈 데가 없다. 그리고 로고가 마흔넷이라 한 화면이 필요하다.

   ── 왜 설정이 아닌가 ──
   「설정은 기본값」이다 — 한 번 정하고 다시 안 여는 것을 설정 창에 넣으면 아무도
   다시 안 연다. 그리고 이건 기본값이 아니다: 시작화면에 뜨는 간판은 **고른 사람의
   것**이어야 하고, 아무도 안 고른 간판은 남의 사무실이다.

   ── 왜 여기서 강제하지 않나 ──
   건너뛸 수 있다. 이름을 비워 두면 지점 이름이 없는 것이고(회사 이름이 그 자리를
   채운다), 로고를 안 고르면 시작화면은 박아 둔 글자 로고를 쓴다. 첫 화면에서
   마흔네 개를 들여다보게 만들면 그건 등록이 아니라 시험이다. */
function showBranchSetup(onDone){
  const done = () => { if (onDone) onDone(); };
  const files = (typeof LOGO_FILES !== 'undefined' && LOGO_FILES.length) ? LOGO_FILES : [];
  /* 그림이 없으면(도구를 안 돌린 배포본) 이 창을 아예 안 띄운다 —
     고를 것이 없는 고르기 창은 사고 보고다. */
  if (!files.length){ done(); return; }

  let pick = (S.branch && S.branch.logo) || '';
  const cell = f =>
    `<button class="logocell ${f === pick ? 'on' : ''}" data-logo="${f}">
       <span style="background-image:${cssURL(assetURL(LOGO_PATH(f)))}"></span></button>`;

  const m = modal(`
    <div class="mhead contract"><div class="q">BRANCH REGISTRATION</div>
      <h3>${L({ ko:'지점 등록', en:'Branch Registration', ja:'支店登録' })}</h3>
      <p>${L({ ko:'간판과 지점명 · 나중에 벽의 액자에서 바꿉니다',
               en:'Sign and branch name · change it later at the wall frame',
               ja:'看板と支店名・あとで壁の額縁から変えられます' })}</p></div>
    <div class="mbody">
      <div class="sigrow"><span class="em">🏢</span>
        <b>${L({ ko:'이 사무실은 본사의 한 지점입니다.',
                 en:'This office is one branch of the company.',
                 ja:'この事務所は本社の一支店です。' })}</b></div>
      <label class="tiny" for="brName">${L({ ko:'지점 이름', en:'Branch name', ja:'支店名' })}</label>
      <div class="namerow">
        <input id="brName" maxlength="10" autocomplete="off" placeholder="${L({ ko:'예: 골목', en:'e.g. Alley', ja:'例：路地' })}"
               value="${esc((S.branch && S.branch.name) || '')}">
        <span class="brsuf" id="brSuf">${L({ ko:'점', en:'Br.', ja:'店' })}</span>
      </div>
      <div class="tiny">${L({
        ko:'친구가 방문하면 이 이름으로 보입니다. 비워 두면 이름 없이 갑니다.',
        en:'Visitors will see this name. Leave it blank to go without one.',
        ja:'訪ねてきた人にはこの名前で見えます。空欄なら名前なしです。' })}</div>
      <div class="hint">${L({ ko:'간판', en:'Sign', ja:'看板' })}</div>
      <div class="logogrid" id="brGrid">${files.map(cell).join('')}</div>
    </div>
    <div class="mfoot">
      <button class="okbtn" id="brGo">${L({ ko:'등록한다', en:'Register', ja:'登録する' })}</button>
    </div>`);

  const grid = m.veil.querySelector('#brGrid');
  grid.querySelectorAll('.logocell').forEach(b => b.onclick = () => {
    /* 같은 것을 다시 누르면 고르기를 **푼다**. 마흔넷 중 하나를 눌러 본 사람이
       「글자 로고로 돌아가려면 어떻게 하나」에서 막히지 않게. */
    pick = (pick === b.dataset.logo) ? '' : b.dataset.logo;
    grid.querySelectorAll('.logocell').forEach(x => x.classList.toggle('on', x.dataset.logo === pick));
    sfx.add();
  });
  m.veil.querySelector('#brGo').onclick = () => {
    setBranch({ logo: pick, name: m.veil.querySelector('#brName').value });
    m.close();
    sfx.stamp();
    renderTop();
    done();
  };
}

function showHelp(){
  const body = L({
    ko: `
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>회사 소개</b> — 캣닢은 <b>냥법상 마약류</b>입니다. Copycat은 그걸
         <b>재배하고 정제해서 유통하는 회사</b>입니다. 등기부상 업종은 허브 유통업이고,
         그 서류가 우리를 지켜주는 유일한 것입니다. 그래서 <b>냥찰이 우리를 찾아옵니다.</b></p>
      <p><b>0. 시계가 진짜입니다</b> — 이 사무실은 <b>당신의 데스크탑 시계</b>로 돌아갑니다.
         당신의 12시에 고양이들도 밥을 먹으러 가고, 18시에는 퇴근 인사를 합니다.
         50분마다 스트레칭도 챙겨줍니다. 근무 시간을 <b>같이 견뎌주는 게임</b>입니다.</p>
      <p><b>1. 결재함</b> — 할 일을 올리고 완료 체크를 하면 <b>서류가 사무실 결재함에 실제로 떨어집니다</b>.
         가까운 고양이가 걸어와 물고 가서, 자기 자리에서 도장을 찍어야 보상이 들어옵니다.</p>
      <p><b>2. 고양이는 에이전트입니다</b> — 기력·재미·화장실·카페인 욕구가 있고, 스스로 커피머신·낮잠상자·정수기를 찾아갑니다.
         자리에 앉아 있을 때만 멸치를 법니다. 놀러 다니면 수입이 줍니다. 정상입니다.</p>
      <p><b>3. 분기</b> — 성과 게이지를 채우면 결산이 열립니다. 사건이 터지고, 배당과 장비가 나오고,
         특정 분기(3·6·10·15·21·28)마다 <b>사무실을 이전</b>합니다. 평면도는 그때마다 새로 생성됩니다.</p>
      <p><b>4. 기한과 흔적</b> — 할 일에 <b>⏰ 기한</b>을 걸 수 있습니다. 걸어 둔 건을 <b>그날 안에</b>
         못 내면, 하루가 넘어가는 순간 그 서류는 정리되지 못한 채 밖으로 샙니다 —
         뒷수습 비용이 나가고 <b>혐의</b>가 쌓입니다(작은 건 1점, 큰 건 2점, 하루 최대 3점).
         혐의 1점당 전 직원 생산이 6% 떨어집니다. 급하면 <b>무마</b>로 돈을 써서 1점씩 지울 수 있습니다.<br>
         <b>기한은 기본값이 아닙니다.</b> 안 걸면 아무 일도 없습니다 — 언제 해도 됩니다.
         이 회사에서 마감을 정하는 건 회사가 아니라 당신입니다.<br>
         샌 건은 <b>목록에서 사라지지 않습니다.</b> <b>늦게라도 도장을 찍으면 그 혐의는 지워집니다</b> —
         늦어도 하는 게 낫기 때문입니다. 어제 기한을 하나도 안 놓친 날은 혐의가 1점 소멸합니다.</p>
      <p><b>4-1. 달력</b> — 사무실 벽에 <b>📅 달력</b>이 걸려 있습니다. <b>누르면 열립니다.</b>
         지난 날짜를 누르면 그날 뭘 냈고 무엇이 남았는지 보이고, <b>앞날에 미리 적어 두면
         그날이 되어야 결재함에 올라옵니다.</b> 결재함은 <b>오늘</b>만 보여줍니다 —
         하루가 넘어가면 저절로 갱신됩니다. 하루의 경계는 자정이 아니라
         <b>근무 시간의 반대편</b>(9–18 근무면 새벽 1시 30분)입니다. 밤에 적은 할 일이
         남의 날짜로 넘어가지 않게 하려는 것입니다.</p>
      <p><b>4-1-1. 세부 업무</b> — 줄 오른쪽의 <b>＋</b> 를 누르면 그 건을 <b>작은 줄로 나눌 수 있습니다</b>
         (대청소 → 빨래 · 거실 물청소 · 화장실). 도장은 <b>작은 줄에서만</b> 찍히고, 밑의 줄을 다 끝내면
         묶음은 저절로 닫힙니다. 묶음은 하루의 일이라 <b>부모를 미루면 밑의 줄도 같이 갑니다.</b>
         고양이는 작은 줄 하나를 서류 하나로 물고 갑니다.</p>
      <p><b>4-1-2. 루틴</b> — 📅 달력 아래 <b>🔁 루틴</b> 칸에서 <b>매일 하는 일</b>을 요일과 함께 정해 두면,
         그날 아침 결재함에 <b>미리 놓여 있습니다.</b> 루틴에는 <b>기한을 걸 수 없습니다</b> —
         한 번 걸면 매일 새기 때문입니다. 오늘 것만 급하면 결재함에서 그 줄에 ⏰ 를 거세요.
         며칠 안 켰어도 <b>지난 날 몫은 소급해서 올라오지 않습니다.</b></p>
      <p><b>4-2. 제휴 게시판</b> — 벽에 <b>📌 제휴 게시판</b>이 걸려 있습니다. <b>누르면</b> 다른 지점의
         <b>오늘 결재함과 사무실 도면</b>을 구경할 수 있고, 🐟 인사를 하루에 한 번 두고 올 수 있습니다.
         <b>「사무실 구경하기」를 누르면 그 방에 들어가 끌어서 돌려 볼 수 있습니다</b> —
         그 사이에도 내 사무실은 그대로 돌아갑니다(구경 중에는 배치 모드가 잠깁니다).
         점수는 없습니다 — 목록에서 실시간으로 움직이는 건 <b>불이 켜져 있나</b> 하나입니다.
         🐟 는 인사고 멸치가 아니라서 저쪽 벌이는 변하지 않습니다.
         <b>아직 이 기계 안에서만 도는 미리보기입니다</b>(지점 넷은 흉내). 서버는 그 다음입니다.</p>
      <p><b>5. 멍멍파</b> — 마약 개껌을 만드는 강아지 조직입니다. 분기마다 우리가 처리한 건수가
         기준치에 못 미치면 그 사이에 <b>거래처를 가져갑니다.</b> 뺏긴 점유율만큼 전 직원 생산이
         줄어듭니다. 가만히 두면 계속 밀립니다.</p>
      <p><b>6. 냥찰</b> — 혐의가 <b>${RAID_THRESHOLD}점</b>을 넘으면 영장이 나오고 압수수색이 들어옵니다.
         조사 중 생산 40%, 종료 시 과징금 15%, 확률적으로 직원 1명이 연행됩니다(다음 분기 복귀).
         혐의는 <b>기한을 넘긴 서류에서만</b> 나옵니다 — 분기 마감은 혐의를 건드리지 않습니다.</p>
      <p><b>7. 배치 모드</b> — 상단 <b>🛋️</b> 를 누르면 <b>가구를 직접 옮길 수 있습니다.</b>
         옮길 물건을 클릭하고, 놓을 자리를 클릭하면 끝입니다. 책상은 2칸이 한 짝이고
         바로 아래 칸이 자리라 네 칸이 필요합니다. 벽의 액자·화이트보드도 옮겨집니다.
         길이 막히거나 어떤 가구의 진입로가 사라지는 배치는 <b>빨간 칸으로 거부</b>됩니다 —
         고양이가 구석에 갇히면 안 되기 때문입니다. 배치는 그대로 저장됩니다.<br>
         고른 가구는 <b>R</b> 키나 힌트 막대의 <b>↻</b> 로 <b>90°씩 돌릴 수 있습니다</b>
         (Shift+R 은 반대 방향). 한 칸짜리만 돌아갑니다 — 두 칸짜리와 벽에 건 것은
         돌리면 차지하는 칸이 바뀌어서 안 됩니다.</p>
      <p><b>7-1. 카메라</b> — <b>드래그</b>로 <b>화면을 끌어 옮기고</b>, <b>오른쪽 드래그</b>(또는
         Shift+드래그, 터치는 두 손가락)로 <b>시점을 돌립니다</b>. <b>휠</b>은 커서 아래를 기준으로 확대하고,
         <b>더블클릭</b>하면 그 자리가 화면 한가운데로 옵니다.
         키보드로는 <b>방향키·WASD</b> 이동, <b>Q·E</b> 45° 회전, <b>0</b> 전체 보기입니다.
         <b>🎥</b> 를 누르면 고양이 자동 추적으로 돌아갑니다.</p>
      <p><b>8. 화면은 셋 중 하나입니다</b> — 폭에 따라 저절로 갈립니다.<br>
         <b>넓은 화면</b>: 사무실이 화면을 통째로 갖고, 왼쪽에 <b>기둥 하나</b>가 섭니다 —
         결재함·직원·비품·사보가 그 위의 <b>탭 넷</b>입니다. <b>‹</b> 로 기둥을 접으면 사무실만 남습니다.<br>
         <b>폰</b>: 아래에 <b>탭 다섯</b>(사무실·결재함·직원·비품·사보)이 붙고 한 번에 한 화면을
         통으로 씁니다. 결재함 탭에 <b>붉은 점</b>이 뜨면 기한을 넘긴 서류가 있다는 뜻입니다.<br>
         <b>작은 창</b>: 상단 <b>🔳</b> 를 누르거나 창을 작게 줄이면 <b>위젯 모드</b>로 접힙니다 —
         사무실만 남고 결재함·경영은 아래에서 올라오는 서랍이 됩니다.
         작은 화면이 이 게임의 제자리입니다.</p>
      <p><b>9. 조사</b> — 배치 모드가 아닐 때 <b>가구를 누르면 들여다볼 수 있습니다.</b>
         대부분은 한 줄짜리 관찰이고 아무것도 안 나옵니다. 그런데 <b>몇 개에는 뭔가가 들어 있습니다</b> —
         분기가 지나야 나오고, 한 번만 나옵니다. 나온 것은 🪪 근무 기록증에 남습니다.
         총무가 사보에 어디쯤인지 흘릴 때가 있습니다.</p>
      <p><b>10. CD 플레이어</b> — 사무실에 <b>💿 CD 플레이어</b>가 놓여 있습니다. <b>누르면 배경음악을 고릅니다.</b>
         기본 두 곡이 있고, 음반은 멸치로 살 수 있으며, <b>사무실 어딘가에서 나오는 테이프</b>도 있습니다.
         유튜브 링크를 넣으면 그게 배경음악이 됩니다. 밤에는 소리가 절반이 되고,
         <b>음량도 여기서 조절합니다</b> — 0 으로 내리면 효과음까지 전부 멈춥니다(전체 음소거).
         배치 모드에서 옮기고 돌릴 수 있고, 고양이들도 그 앞에 모입니다.</p>
      <ul>
        <li>당신의 시계 기준 — 기본 09–18시 근무(점심 12시). <b>⚙️ 에서 근무 시간을 바꿀 수 있고
            자정을 넘겨도 됩니다</b>(22–06 등). 단계·수당·케어 방송·「퇴근까지」가 전부 그 시간에서 나옵니다</li>
        <li>고양이는 <b>시각이 아니라 기력으로 잡니다</b> — 근무 밖이라고 다 눕지 않고,
            <b>올린 서류는 새벽에도 처리됩니다</b></li>
        <li>⚙️ 설정에서 언어(한국어/English/日本語)·데스크탑 알림·근무 시간을 정합니다.
            <b>음악과 음량은 사무실의 CD 플레이어에 있습니다</b></li>
        <li>채용은 <b>면접창</b>에서 — 이름(🎲 또는 직접 입력)과 털색·색조를 정합니다.
            능력치는 4d6이 정하고, 지원자는 창을 닫아도 그대로 기다립니다</li>
        <li>비품은 사무실 안에 실제로 배치되고 고양이가 이용합니다</li>
        <li><b>켜 둔 동안만 멸치가 쌓입니다</b> — 배경 탭이어도 사무실은 돕니다.
            창을 닫으면 사무실도 닫힙니다(🍚 자동급식기를 사면 근무시간엔 25%로 돌아갑니다)</li>
        <li>고양이를 클릭하면 인사 기록이 열립니다</li>
      </ul>
      <p class="tiny">목표는 <b>달 지사</b>. 지구 밖에는 아직 단속 기관이 없습니다.</p>`,
    en: `
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>About the company</b> — Catnip is a <b>controlled substance under feline law</b>. Copycat
         <b>grows, refines and distributes it</b>. On paper we’re an herb wholesaler, and that one
         document is the only thing protecting us. Which is why <b>the Pawlice keep visiting.</b></p>
      <p><b>0. The clock is real</b> — this office runs on <b>your desktop clock</b>.
         At your noon the cats go to lunch; at 6 PM they see you off. Every 50 minutes they
         remind you to stretch. It’s a game that <b>endures the workday with you</b>.</p>
      <p><b>1. The inbox</b> — post a task and check it off, and <b>a paper physically drops into the office inbox</b>.
         The nearest cat walks over, carries it off, and must stamp it at their own desk before you get paid.</p>
      <p><b>2. Cats are agents</b> — they have energy, fun, bladder and caffeine needs, and find the coffee machine,
         nap box and water cooler on their own. They only earn anchovies while seated. Wandering costs revenue. That’s normal.</p>
      <p><b>3. Quarters</b> — fill the KPI gauge to close the books. Incidents happen, dividends and gear drop,
         and at certain quarters (3·6·10·15·21·28) the office <b>moves</b> to a freshly generated floor plan.</p>
      <p><b>4. Deadlines and traces</b> — you can put a <b>⏰ deadline</b> on an item. Miss it, and the
         moment that day rolls over the paperwork leaks out uncleaned: cleanup costs, and <b>heat</b>
         builds (1 point, 2 for a large item, at most 3 a day). Each point of heat cuts all output by 6%.
         In a pinch, <b>hush money</b> erases one point at a time.<br>
         <b>Deadlines are not the default.</b> Without one, nothing happens — do it whenever.
         In this company the due date is set by you, not by the company.<br>
         A leaked item <b>stays on the list</b>, and <b>filing it late clears that heat again</b> —
         late is better than never. A day with no missed deadline expires one point of heat.</p>
      <p><b>4-1. The calendar</b> — a <b>📅 calendar</b> hangs on the office wall. <b>Click it.</b>
         Past days show what you filed and what was left; on days ahead you can <b>write early</b>,
         and those items only reach the inbox when that day arrives. The inbox shows <b>today</b> —
         it refreshes on its own when the day turns. The day turns not at midnight but on the
         <b>far side of your shift</b> (01:30 for a 9–18 shift), so what you write at night
         doesn’t land on somebody else’s date.</p>
      <p><b>4-1-1. Subtasks</b> — the <b>＋</b> on a row <b>splits that item into small lines</b>
         (spring cleaning → laundry · mop the floor · bathroom). Stamps happen <b>only on the small
         lines</b>, and the group closes itself once they are all done. A group is one day's work, so
         <b>moving the parent moves its lines too.</b> A cat carries one small line as one document.</p>
      <p><b>4-1-2. Routines</b> — under the 📅 calendar, the <b>🔁 Routines</b> panel lets you set
         <b>something you do daily</b> with its weekdays, and it is <b>waiting in the inbox</b> that
         morning. Routines <b>can’t carry a deadline</b> — set once, it would leak every day. If today’s
         is urgent, put ⏰ on that line in the inbox. Missed days are <b>never back-filled.</b></p>
      <p><b>4-2. The branch board</b> — a <b>📌 board</b> hangs on the wall. <b>Click it</b> to look in on
         another branch’s <b>inbox for today and floor plan</b>, and to leave a 🐟 hello once a day.
         <b>"Look around the office" walks you into that room — drag to look around</b>, while your own
         office keeps running (decorate mode is locked while visiting).
         There are no scores — the only thing that moves in that list is <b>whether their lights are on</b>.
         The 🐟 is a greeting, not currency; their earnings don’t change.
         <b>This is a preview that runs only on this machine</b> (the four branches are stand-ins).
         The server comes after.</p>
      <p><b>5. The Woof Gang</b> — a dog syndicate making narcotic chews. Each quarter you fall short of par,
         they <b>take clients</b>, and their share cuts everyone’s output. Do nothing and you keep losing ground.</p>
      <p><b>6. The Pawlice</b> — cross <b>${RAID_THRESHOLD} points</b> of heat and a warrant drops: raid time.
         Output 40% during the raid, a 15% fine at the end, and sometimes one cat is taken in
         (back next quarter). Heat comes <b>only from missed deadlines</b> — quarter close no longer touches it.</p>
      <p><b>7. Decorate mode</b> — hit <b>🛋️</b> in the top bar to <b>move furniture yourself.</b>
         Click a piece, then click where it goes. Desks are two tiles wide with the seats
         directly below, so they need four tiles. Wall art and whiteboards move too.
         Any placement that would block a path or strand a piece with no way in is
         <b>refused with a red highlight</b> — cats must never get walled into a corner.
         Your layout is saved as-is.<br>
         A selected piece <b>turns 90° with <b>R</b></b> or the <b>↻</b> on the hint bar
         (Shift+R goes the other way). One-tile pieces only — two-tile furniture and
         wall-mounted things would change their footprint.</p>
      <p><b>7-1. Camera</b> — <b>drag</b> to <b>pan the view</b>, <b>right-drag</b> (or Shift+drag,
         or two fingers) to <b>turn</b>. The <b>wheel</b> zooms toward the cursor, and a
         <b>double-click</b> centers that spot. On the keyboard: <b>arrows/WASD</b> to pan,
         <b>Q·E</b> to turn 45°, <b>0</b> for the whole office.
         <b>🎥</b> goes back to following the cats.</p>
      <p><b>8. Three layouts, picked by width</b><br>
         <b>Wide</b>: the office owns the screen and <b>one column</b> stands on the left —
         inbox, staff, supplies and news are <b>four tabs</b> above it. <b>‹</b> folds the column away.<br>
         <b>Phone</b>: <b>five tabs</b> along the bottom (office, inbox, staff, supplies, news), one
         whole screen at a time. A <b>red dot</b> on the inbox tab means a deadline was missed.<br>
         <b>Small window</b>: <b>🔳</b> — or just shrinking the window — folds it into
         <b>widget mode</b>: the office stays, the inbox and management slide up as drawers.
         A small window is this game’s natural size.</p>
      <p><b>9. Looking at things</b> — outside decorate mode, <b>click a piece of furniture to look
         at it.</b> Most of it is one line of observation and nothing more. But <b>a few of them hold
         something</b> — gated by quarter, and available once. What turns up is kept on the 🪪 time
         card. Admin sometimes drops a note in the newsletter about roughly where to look.</p>
      <p><b>10. The CD player</b> — there is a <b>💿 CD player</b> standing in the office. <b>Click it to pick
         the music.</b> Two tracks to start, records you can buy with anchovies, and <b>tapes that only turn
         up somewhere in the office</b>. Paste a YouTube link and that becomes the background music.
         Everything halves in volume at night. <b>The volume lives here too</b> — drag it to 0 and the sound
         effects stop as well (that is the master mute). You can move and rotate it in decorate mode, and the
         cats gather in front of it.</p>
      <ul>
        <li>On your clock — 9–18 by default (lunch at 12). <b>The work hours are settable in ⚙️ and may
            cross midnight</b> (22–06 and so on). Phases, pay rate, the care broadcasts and the countdown all follow them</li>
        <li>Cats sleep on <b>energy, not the hour</b> — being off-shift doesn't put them all to bed, and
            <b>a document filed at 3 AM still gets stamped</b></li>
        <li>⚙️ Settings: language (한국어/English/日本語), desktop notifications, work hours.
            <b>Music and volume live at the CD player in the office.</b></li>
        <li>Hiring happens in an <b>interview window</b> — you pick the name (🎲 or type it)
            and the coat and tint. 4d6 sets the stats, and the applicant waits even if you close it</li>
        <li>Supplies are physically placed in the office and used by the cats</li>
        <li><b>Anchovies pile up only while it’s open</b> — a background tab still counts;
            close it and the office closes too (🍚 the Auto Feeder keeps it at 25% during work hours)</li>
        <li>Click a cat to open their employee file</li>
      </ul>
      <p class="tiny">The goal is the <b>Moon Branch</b>. There are no enforcement agencies off-planet yet.</p>`,
    ja: `
      <p style="background:#FFF6F7;border:2px solid #F0BCC4;padding:9px;line-height:1.7;margin-bottom:11px">
         <b>会社紹介</b> — マタタビは<b>ニャン法上の薬物</b>です。Copycatはそれを
         <b>栽培・精製・流通させる会社</b>。登記上はハーブ卸で、その書類一枚だけが
         うちを守っています。だから<b>ニャン察がやって来ます。</b></p>
      <p><b>0. 時計は本物です</b> — このオフィスは<b>あなたのデスクトップ時計</b>で動きます。
         あなたの12時に猫たちも昼ごはんへ行き、18時には退勤の挨拶をします。
         50分ごとにストレッチも促してくれます。勤務時間を<b>一緒に乗り切るゲーム</b>です。</p>
      <p><b>1. 決裁箱</b> — タスクを上げて完了チェックすると、<b>書類が実際にオフィスの決裁箱に落ちます</b>。
         近くの猫が歩いてきてくわえ、自分の席でハンコを押して初めて報酬が入ります。</p>
      <p><b>2. 猫はエージェント</b> — 気力・楽しさ・トイレ・カフェインの欲求を持ち、コーヒーマシンや昼寝箱を
         自分で探して行きます。席に座っている間だけ煮干しを稼ぎます。遊びに行けば収入は減ります。正常です。</p>
      <p><b>3. 四半期</b> — 成果ゲージを満たすと決算です。事件が起き、配当と装備が出て、
         特定の四半期（3・6・10・15・21・28）に<b>オフィスを移転</b>。間取りは毎回新しく生成されます。</p>
      <p><b>4. 期限と痕跡</b> — やることに<b>⏰ 期限</b>を掛けられます。掛けた案件をその日のうちに
         出せないと、一日が変わる瞬間に書類が整理されないまま外に漏れます——後始末費用がかかり、
         <b>容疑</b>が溜まります（小1点・大2点、1日最大3点）。容疑1点ごとに全員の生産が6%下がります。
         急ぎなら<b>もみ消し</b>で1点ずつ消せます。<br>
         <b>期限は既定値ではありません。</b>掛けなければ何も起きません——いつやってもいいです。
         この会社で締め切りを決めるのは会社ではなく、あなたです。<br>
         漏れた案件は<b>リストから消えません</b>。<b>遅れてでもハンコを押せばその容疑は消えます</b>——
         遅れてもやる方がいいからです。期限をひとつも落とさなかった日は容疑が1点消滅します。</p>
      <p><b>4-1. カレンダー</b> — オフィスの壁に<b>📅 カレンダー</b>が掛かっています。<b>押すと開きます。</b>
         過去の日を押すとその日に何を出して何が残ったかが見え、<b>先の日には先に書いておけます</b>——
         その案件はその日になってから決裁箱に上がります。決裁箱は<b>今日</b>だけを見せ、
         一日が変わると自分で更新されます。一日の境目は真夜中ではなく
         <b>勤務の反対側</b>（9–18 なら午前1時30分）です。夜に書いたやることが
         別の日付に飛ばないようにするためです。</p>
      <p><b>4-1-1. サブ業務</b> — 行の右の<b>＋</b>を押すとその案件を<b>小さい行に分けられます</b>
         （大掃除 → 洗濯・床拭き・トイレ）。ハンコは<b>小さい行だけ</b>で押され、下の行を全部終えると
         まとまりは自分で閉じます。まとまりは一日の仕事なので<b>親を動かすと下の行も一緒に動きます。</b>
         猫は小さい行ひとつを書類ひとつとして運びます。</p>
      <p><b>4-1-2. ルーティン</b> — 📅 カレンダーの下の<b>🔁 ルーティン</b>欄で<b>毎日やること</b>を
         曜日と一緒に決めておくと、その日の朝、決裁箱に<b>先に置かれています。</b>
         ルーティンには<b>期限を掛けられません</b>——一度掛けると毎日漏れるからです。今日の分だけ急ぐなら
         決裁箱でその行に⏰を掛けてください。過去の分は<b>遡って上がりません。</b></p>
      <p><b>4-2. 提携掲示板</b> — 壁に<b>📌 提携掲示板</b>が掛かっています。<b>押すと</b>ほかの支店の
         <b>今日の決裁箱とオフィスの図面</b>をのぞけて、🐟 のあいさつを1日1回置いていけます。
         <b>「オフィスを見て回る」を押すとその部屋に入ってドラッグで見回せます</b>——
         その間も自分のオフィスは動き続けます（見学中は模様替えがロックされます）。
         点数はありません——リストで動くのは<b>灯りがついているか</b>だけです。
         🐟 はあいさつでお金ではないので、相手の稼ぎは変わりません。
         <b>まだこの機械の中だけで動くプレビューです</b>（4支店は仮）。サーバーはそのあとです。</p>
      <p><b>5. ワンワン組</b> — 麻薬ガムをつくる犬の組織。四半期の処理数が基準に届かないと
         <b>取引先を奪われ</b>、奪われたシェアの分だけ全員の生産が落ちます。放っておくと押され続けます。</p>
      <p><b>6. ニャン察</b> — 容疑が<b>${RAID_THRESHOLD}点</b>を超えると令状が出て家宅捜索。
         調査中は生産40%、終了時に課徴金15%、確率で社員1匹が連行されます（翌期復帰）。
         容疑は<b>期限を過ぎた書類からだけ</b>出ます——四半期の締めは容疑に触れません。</p>
      <p><b>7. 模様替えモード</b> — 上部の<b>🛋️</b>を押すと<b>家具を自分で動かせます。</b>
         動かすものをクリックし、置く場所をクリックするだけ。デスクは横2マスで
         真下が座席なので4マス必要です。壁の額やホワイトボードも動かせます。
         道をふさいだり、どれかの家具の入口をなくす配置は<b>赤いマスで拒否</b>されます——
         猫が隅に閉じ込められてはいけないからです。配置はそのまま保存されます。<br>
         選んだ家具は<b>R</b>キーかヒント欄の<b>↻</b>で<b>90°ずつ回せます</b>
         （Shift+R は逆回り）。回せるのは1マスのものだけです——2マスのものと壁掛けは
         占めるマスが変わってしまうためです。</p>
      <p><b>7-1. カメラ</b> — <b>ドラッグ</b>で<b>画面を掴んで動かし</b>、<b>右ドラッグ</b>（または
         Shift+ドラッグ、タッチは2本指）で<b>視点を回します</b>。<b>ホイール</b>はカーソルの下を基準に拡大し、
         <b>ダブルクリック</b>でその場所が画面中央に来ます。
         キーボードでは<b>方向キー・WASD</b>で移動、<b>Q・E</b>で45°回転、<b>0</b>で全体表示。
         <b>🎥</b>を押すと猫の自動追尾に戻ります。</p>
      <p><b>8. 画面は三つのどれかです</b>——幅で自動的に分かれます。<br>
         <b>広い画面</b>：オフィスが画面を丸ごと持ち、左に<b>柱がひとつ</b>立ちます——
         決裁箱・スタッフ・備品・社報がその上の<b>4つのタブ</b>です。<b>‹</b>で柱を畳めます。<br>
         <b>スマホ</b>：下に<b>5つのタブ</b>（オフィス・決裁箱・スタッフ・備品・社報）が付き、
         一度に一画面を丸ごと使います。決裁箱タブに<b>赤い点</b>が出たら繰越の書類があります。<br>
         <b>小さいウィンドウ</b>：上部の<b>🔳</b>、またはウィンドウを小さくすると
         <b>ウィジェットモード</b>に畳まれます——オフィスだけが残り、決裁箱と経営は
         下から上がってくる引き出しになります。小さい画面がこのゲームの定位置です。</p>
      <p><b>9. 調べる</b> — 模様替えモードでないとき、<b>家具を押すと調べられます。</b>
         たいていは一行の観察で、何も出てきません。ただし<b>いくつかには何かが入っています</b>——
         四半期が来ると出るようになり、一度だけ出ます。出たものは🪪勤務記録証に残ります。
         総務が社報にだいたいの場所を漏らすことがあります。</p>
      <p><b>10. CDプレーヤー</b> — オフィスに<b>💿 CDプレーヤー</b>が置いてあります。<b>押すとBGMを選べます。</b>
         最初から2曲あり、レコードは煮干しで買え、<b>オフィスのどこかから出てくるテープ</b>もあります。
         YouTubeのリンクを入れればそれがBGMになります。夜は音量が半分になり、
         <b>音量もここで調整します</b>——0にすると効果音まで全部止まります（全体ミュート）。
         模様替えモードで動かして回せますし、猫たちもその前に集まります。</p>
      <ul>
        <li>あなたの時計基準——既定は9–18時勤務（昼は12時）。<b>⚙️で勤務時間を変えられ、日付をまたいでも構いません</b>
            （22–06など）。段階・手当・ケア放送・「退勤まで」が全部その時間から出ます</li>
        <li>猫は<b>時刻ではなく気力で寝ます</b>——勤務外だからと全員が横になることはなく、
            <b>出した書類は深夜でも処理されます</b></li>
        <li>⚙️ 設定で言語（한국어/English/日本語）・デスクトップ通知・勤務時間を決めます。
            <b>音楽と音量はオフィスのCDプレーヤーにあります。</b></li>
        <li>採用は<b>面接ウィンドウ</b>で——名前（🎲か直接入力）と毛色・色調を決めます。
            能力値は4d6が決め、閉じても同じ応募者が待っています</li>
        <li>備品はオフィス内に実際に配置され、猫が利用します</li>
        <li><b>開いている間だけ煮干しが貯まります</b>——背面タブでもオフィスは回ります。
            閉じればオフィスも閉まります（🍚自動給餌器があれば勤務時間は25%で稼働）</li>
        <li>猫をクリックすると人事ファイルが開きます</li>
      </ul>
      <p class="tiny">目標は<b>月支社</b>。地球の外にはまだ取締機関がありません。</p>`,
  });
  modal(`
    <div class="mhead"><div class="q">INTERNAL — DO NOT DISTRIBUTE</div><h3>${L({ ko:'Copycat 영업 지침', en:'Copycat Field Manual', ja:'Copycat 営業指針' })}</h3>
      <p>${L({ ko:'등기부상 업종은 허브 유통업입니다', en:'On paper, we are an herb wholesaler', ja:'登記上の業種はハーブ卸です' })}</p></div>
    <div class="mbody helpwrap">${body}</div>
    <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'숙지했습니다', en:'Understood', ja:'承知しました' })}</button></div>`);
}
