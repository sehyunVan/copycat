/* ============================================================
   music.js — 배경 음악.
   1순위: assets/music/aquarium.wav — 자매 프로젝트 「장조 수족관」의
   오프라인 렌더(2분 루프). C장조 펜타토닉 칼림바 + 기포음의 생성 앰비언트라
   사무실에 깔아두기 좋게 잔잔하고 밝다.
   2순위(폴백): 파일이 없으면(새 클론 등) 효과음과 같은 원칙으로
   WebAudio가 오르골 로파이를 절차 생성한다 — 아래 엔진.

   공통 규칙:
   - 🔊(마스터)와 설정의 BGM 토글이 둘 다 켜져 있어야 재생
   - 밤(22시~)에는 절반 볼륨
   - 브라우저 자동재생 정책 때문에 첫 입력 후에 시작
   - 탭이 백그라운드여도 계속 흐른다 — 일하는 동안 들리는 게 존재 이유다
   ============================================================ */

const MUSIC_KEY = 'copycat.music';
const MUSIC_FILE = 'assets/music/aquarium.wav';
let musicPref = true;
try { musicPref = localStorage.getItem(MUSIC_KEY) !== '0'; } catch(e){}

const music = (() => {
  /* 밤에는 소리를 죽인다 */
  function nightMul(){
    try { return phaseOf(S.clock) === 'night' ? 0.5 : 1; } catch(e){ return 1; }
  }

  /* ---------- 1순위: 파일 재생 ---------- */
  /* 0.45로 깔아 뒀더니 다른 창에서 일하는 동안엔 거의 안 들렸다.
     배경에 켜 두는 게 이 게임의 사용법이라 그 자리에서 들리는 크기여야 한다.
     밤에는 nightMul()이 절반으로 줄이고, 전체 음소거는 🔊 버튼이 따로 있다. */
  const FILE_VOL = 0.7;
  let audio = null;            // HTMLAudioElement
  let fileBroken = false;      // 파일이 없거나 못 읽으면 true → 생성 엔진으로
  let volTimer = null;

  function fileStart(){
    if (fileBroken) return false;
    if (!audio){
      try {
        audio = new Audio(assetURL(MUSIC_FILE));   // 한 파일로 묶은 배포본에선 data: URI 가 온다
        audio.loop = true;
        audio.addEventListener('error', () => { fileBroken = true; audio = null; sync(); });
      } catch(e){ fileBroken = true; return false; }
    }
    audio.volume = FILE_VOL * nightMul();
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});   // 자동재생 거부는 다음 입력 때 다시
    if (!volTimer) volTimer = setInterval(() => { if (audio && !audio.paused) audio.volume = FILE_VOL * nightMul(); }, 10000);
    return true;
  }
  function fileStop(){
    if (audio) audio.pause();
    if (volTimer){ clearInterval(volTimer); volTimer = null; }
  }
  function filePlaying(){ return !!(audio && !audio.paused); }

  /* ---------- 2순위: 생성 엔진 (오르골 로파이) ----------
     72 BPM · 4마디 흰건반 코드 루프(Cmaj7→Am7→Fmaj7→G6) 위에
     확률적 아르페지오 — 같은 4마디가 두 번 반복되지 않는다.
     백그라운드 탭에서 setInterval이 1초로 죽어도 끊기지 않도록
     미리 2.2초치 음표를 예약해 둔다. */
  const TEMPO = 72;
  const STEP = 60 / TEMPO / 2;         // 8분음표
  const LOOKAHEAD = 2.2, TICK = 420;
  const CHORDS = [
    [60, 64, 67, 71],   // Cmaj7
    [57, 60, 64, 67],   // Am7
    [53, 57, 60, 64],   // Fmaj7
    [55, 59, 62, 64],   // G6
  ];
  const F = n => 440 * Math.pow(2, (n - 69) / 12);

  let ctx = null, master = null, timer = null;
  let nextT = 0, step = 0;

  function ensureCtx(){
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
      master = ctx.createGain();
      // 파일 재생 쪽과 같은 비율로 올린다 — 폴백이 눈에 띄게 조용하면 다른 게임처럼 들린다.
      // 개별 음의 진폭이 0.05 언저리라 여기서 1.5를 곱해도 합이 1.0 근처에 못 간다.
      master.gain.value = 1.5;
      master.connect(lp); lp.connect(ctx.destination);
      hiss();
      return true;
    } catch(e){ return false; }
  }

  /* 테이프 히스 — 있는 줄 모르게 깔리는 온기 */
  function hiss(){
    const len = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.004;
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start();
  }

  /* 오르골 한 음: 사인파 + 살짝 어긋난 배음, 짧은 어택과 긴 잔향 */
  function box(midi, t, vel){
    const f = F(midi);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.4);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = f * 3.98;   // 종처럼 살짝 어긋난 배음
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(vel * 0.12, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o2.connect(g2); g2.connect(master);
    o2.start(t); o2.stop(t + 0.6);
  }

  function pad(chord, t, dur){
    for (const m of chord.slice(0, 3)){
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = F(m - 12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.013 * nightMul(), t + 0.7);
      g.gain.setValueAtTime(0.013 * nightMul(), t + dur - 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.5);
    }
  }

  function bass(chord, t, dur){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = F(chord[0] - 24);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * nightMul(), t + 0.05);
    g.gain.setTargetAtTime(0.028 * nightMul(), t + 0.3, 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.1);
  }

  function scheduleStep(s, t){
    const bar = Math.floor(s / 8) % CHORDS.length;
    const chord = CHORDS[bar];
    if (s % 8 === 0){
      pad(chord, t, STEP * 8);
      bass(chord, t, STEP * 8);
    }
    // 아르페지오 — 위로 걷다가, 가끔 쉬고, 가끔 반짝인다
    if (Math.random() < 0.72){
      const idx = s % 8;
      let m = chord[idx % 4] + 12;
      if (Math.random() < 0.18) m += 12;                    // 반짝
      const vel = 0.05 * (0.7 + 0.5 * Math.random()) * nightMul();
      const jitter = (Math.random() - 0.5) * 0.016;         // 사람 손맛
      box(m, Math.max(t + jitter, ctx.currentTime + 0.01), vel);
    }
  }

  function schedule(){
    if (!ctx) return;
    while (nextT < ctx.currentTime + LOOKAHEAD){
      scheduleStep(step, nextT);
      nextT += STEP;
      step++;
    }
  }

  function genStart(){
    if (timer) return;
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    nextT = Math.max(nextT, ctx.currentTime + 0.1);
    schedule();
    timer = setInterval(schedule, TICK);
  }
  function genStop(){
    if (timer){ clearInterval(timer); timer = null; }
    if (ctx) ctx.suspend();
  }
  function genPlaying(){ return !!timer; }

  /* ---------- 공통 ---------- */
  function playing(){ return filePlaying() || genPlaying(); }

  function start(){
    if (!fileBroken){
      if (fileStart()) return;
    }
    genStart();
  }
  function stop(){ fileStop(); genStop(); }

  /* soundOn(전체 음소거)과 musicPref(설정) 둘 다 켜져 있어야 재생 */
  function sync(){
    const want = musicPref && (typeof soundOn === 'undefined' || soundOn);
    if (want && !playing()) start();
    if (!want && playing()) stop();
  }
  function setPref(on){
    musicPref = on;
    try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0'); } catch(e){}
    sync();
  }

  /* 브라우저 자동재생 정책: 첫 입력 후에만 소리를 낼 수 있다 */
  function init(){
    const arm = () => { sync(); document.removeEventListener('pointerdown', arm); document.removeEventListener('keydown', arm); };
    document.addEventListener('pointerdown', arm);
    document.addEventListener('keydown', arm);
  }

  return { init, sync, setPref, pref: () => musicPref, playing };
})();
