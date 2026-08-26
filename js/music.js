/* ============================================================
   music.js — 배경 음악과 쥬크박스.

   ── 왜 한 곡이 아닌가 ──

   이 게임은 켜 두는 물건이다. 하루 여덟 시간 옆에 있는 창에서 같은 2분 루프가
   돌면, 그 곡이 아무리 좋아도 3주째에는 배경이 아니라 **소음**이 된다.
   그런데 곡을 늘리는 것만으로는 부족하다 — 늘어난 곡을 **고르는 행위**가 없으면
   그건 그냥 랜덤이고, 랜덤은 내가 튼 음악이 아니다.

   그래서 쥬크박스다. 값어치는 "곡이 많다"가 아니라 **"오늘은 이 곡"** 에 있다.

   ── 곡은 어디서 오나 ──

     · 기본 두 곡 — 절차 생성 오르골(파일 없이 도는 폴백)과 「장조 수족관」
     · 사는 곡  — 💿 에서 멸치로. 효과는 없다. 이 회사에서 유일하게 아무 효과도 없는 지출
     · **줍는 곡** — 가구를 조사하다 나온다(story.js). 살 수 없고, 목록에 있는 줄도 모른다
     · 유튜브   — 링크를 넣으면 그게 그대로 플레이리스트가 된다. 무한대로 늘어나는 문

   파일들은 자매 프로젝트 `playground/music/` 의 렌더다. 전부 라이브러리 없이
   Web Audio 로 합성된 생성 음악이라, 이 게임과 같은 종류의 물건이다.
   저장소에는 **모노 22.05kHz 로 줄여서** 넣었다 — 원본 그대로면 68MB다.

   ── 곡이 바뀌어도 안 바뀌는 것 ──

   - CD 플레이어의 음량(0 이면 음소거)과 설정의 BGM 토글이 둘 다 살아 있어야 재생 — 유튜브도 예외 없다
   - 밤(22시~)에는 절반 볼륨 — 유튜브도 예외 없다
   - 브라우저 자동재생 정책 때문에 첫 입력 후에 시작
   - 탭이 백그라운드여도 계속 흐른다 — 일하는 동안 들리는 게 존재 이유다
   - 곡을 갈아탈 때는 **크로스페이드**. 뚝 끊기면 옆에 띄워 둔 창에서 시선을 뺏는다
   ============================================================ */

const MUSIC_KEY = 'copycat.music';

/* 트랙표.
   src 가 없는 것은 파일이 아니다 — 'box' 는 아래 절차 생성 엔진이고,
   'yt' 는 유튜브다. 둘 다 파일이 없는 환경(단일 파일 배포본·오프라인)에서
   음악을 완전히 잃지 않게 하는 보험이기도 하다.

   own:true  처음부터 갖고 있다
   cost      💿 에서 살 수 있다 (멸치)
   find:true **줍는 곡.** 가구 조사에서만 나오고, 줍기 전에는 목록에 없다
             — 비품 목록에서 잠긴 걸 감춘 것과 같은 규칙이다(ui.js shopHTML) */
const TRACKS = [
  { id:'box', own:true, em:'🎼',
    n: L({ ko:'사내 오르골',   en:'Office Music Box',  ja:'社内オルゴール' }),
    d: L({ ko:'72 BPM 흰건반 네 마디. 같은 네 마디가 두 번 반복되지 않습니다. 파일 없이 도는 유일한 곡.',
           en:'Four white-key bars at 72 BPM, never repeating twice. The only track that needs no file.',
           ja:'72 BPMの白鍵4小節。同じ4小節は二度と繰り返しません。ファイルなしで鳴る唯一の曲。' }) },
  { id:'aquarium', own:true, em:'🐠', src:'assets/music/aquarium.wav',
    n: L({ ko:'장조 수족관',   en:'Major Aquarium',    ja:'長調アクアリウム' }),
    d: L({ ko:'C장조 펜타토닉 칼림바와 기포음. 밝고 잔잔합니다.',
           en:'C-major pentatonic kalimba and rising bubbles. Bright and calm.',
           ja:'ハ長調ペンタトニックのカリンバと気泡音。明るく穏やか。' }) },
  { id:'nocturne', cost:1800, em:'🌙', src:'assets/music/nocturne.wav',
    n: L({ ko:'단조 정원',     en:'Minor Garden',      ja:'短調の庭' }),
    d: L({ ko:'A단조 펜타토닉. 같은 문법에서 조성만 내렸습니다. 저녁에 맞습니다.',
           en:'A-minor pentatonic — the same grammar, one key down. It fits the evening.',
           ja:'イ短調ペンタトニック。同じ文法で調だけ下げたもの。夕方に合います。' }) },
  { id:'rainy', cost:4200, em:'🌧️', src:'assets/music/rainy.wav',
    n: L({ ko:'비 오는 창가',  en:'Rainy Window',      ja:'雨の窓辺' }),
    d: L({ ko:'로즈 피아노와 빗소리. 화성이 한 자리에 안 머물고 진행합니다.',
           en:'Rhodes piano and rain. The harmony actually moves instead of sitting still.',
           ja:'ローズピアノと雨音。和声が一箇所に留まらず進行します。' }) },
  { id:'boot', find:true, em:'💾', src:'assets/music/boot.wav',
    n: L({ ko:'부트 섹터',     en:'Boot Sector',       ja:'ブートセクタ' }),
    d: L({ ko:'칩튠. 앰비언트가 아니라 박자가 있습니다. 서류가 밀렸을 때 듣습니다.',
           en:'Chiptune — not ambient, it has a clock. For when the paperwork is piling up.',
           ja:'チップチューン。アンビエントではなく拍があります。書類が溜まった日に。' }) },
  { id:'squeak', find:true, em:'🪈', src:'assets/music/squeak.wav',
    n: L({ ko:'삑사리 언덕',   en:'Squeak Hill',       ja:'ひっくり返り丘' }),
    d: L({ ko:'리코더를 배우는 중인 누군가. 폐활량과 창피함까지 알고리즘입니다.',
           en:'Someone still learning the recorder. Lung capacity and embarrassment are both in the algorithm.',
           ja:'リコーダーを練習中の誰か。肺活量も恥ずかしさもアルゴリズムです。' }) },
  { id:'yt', em:'▶️', yt:true,
    n: L({ ko:'유튜브',        en:'YouTube',           ja:'YouTube' }),
    d: L({ ko:'링크를 넣으면 그게 배경음악이 됩니다. 플레이리스트도 됩니다.',
           en:'Paste a link and it becomes the background music. Playlists work too.',
           ja:'リンクを入れればそれが BGM になります。プレイリストも可。' }) },
];
const trackOf = id => TRACKS.find(t => t.id === id) || TRACKS[0];

/* **켜짐 고정.** 설정의 "배경 음악" 스위치를 뺐다 — 끄는 자리는 CD 플레이어의
   음량 0(전체 음소거)이고, 같은 일을 하는 스위치가 두 군데 있는 게 원래 문제였다.
   저장값을 안 읽는 이유: 스위치 없이 읽으면 예전에 껐던 사람은 영원히 무음이 된다.
   setPref 는 남긴다 — 프롤로그가 컷신 동안 음악을 눌러 두는 데 쓴다. */
let musicPref = true;

const music = (() => {
  /* 밤에는 소리를 죽인다 */
  /* 밤에는 절반. 이것도 **시계**다 — 야근하는 사람의 창밖도 어둡고, 그 방이
     조용한 게 맞다(TODO 11 에 그렇게 적어 두고 코드는 근무표를 보고 있었다). */
  function nightMul(){
    try { return skyOf(S.clock) === 'night' ? 0.5 : 1; } catch(e){ return 1; }
  }
  /* 사무실 CD 플레이어의 음량 손잡이(ui.js soundVol). 파일·오르골·유튜브가 전부 곱한다 —
     하나라도 빠지면 "슬라이더를 내렸는데 저것만 그대로"가 된다. */
  const masterVol = () => (typeof soundVol === 'number' ? soundVol : 1);

  /* ---------- 무엇을 갖고 있고 무엇을 트나 ----------
     저장(S.music)에 산다. 프롤로그 전에는 S 가 아직 없으므로 그때는 기본값으로 답한다 —
     그 시점에도 sync() 는 불리고, 컷신 뒤 편지 장면에서 음악이 켜져야 한다. */
  const BOOTSTRAP = { owned:['box', 'aquarium'], cur:'aquarium', mode:'loop', yt:'' };
  function st(){
    if (typeof S === 'undefined' || !S) return BOOTSTRAP;
    if (!S.music) S.music = { owned:['box', 'aquarium'], cur:'aquarium', mode:'loop', yt:'' };
    const m = S.music;
    if (!Array.isArray(m.owned) || !m.owned.length) m.owned = ['box', 'aquarium'];
    /* 기본 두 곡은 뺏길 수 없다. 옛 저장에도 없으니 여기서 채운다. */
    for (const id of ['box', 'aquarium']) if (!m.owned.includes(id)) m.owned.push(id);
    if (!m.cur || !trackOf(m.cur)) m.cur = 'aquarium';
    if (!['loop', 'shuffle', 'auto'].includes(m.mode)) m.mode = 'loop';
    if (typeof m.yt !== 'string') m.yt = '';
    return m;
  }
  const ownedIds = () => st().owned.filter(id => TRACKS.some(t => t.id === id));
  const has = id => st().owned.includes(id) || (id === 'yt' && !!st().yt);

  /* 이 배포본에 음원이 **실제로 실렸는가.** 묶는 쪽이 안 실은 파일을 이름으로 적어 준다
     (assets.js 의 ASSETS_ABSENT · tools/pack-single.js).

     처음에는 "ASSETS 표가 비어 있지 않으면 묶은 판이고, 표에 없으면 안 실린 것"으로
     **추측**했다. 틀린다 — 배포용 zip 은 손그림만 표에 넣고 음악은 파일로 들고 간다.
     그 판에서 쥬크박스가 곡을 전부 감춰 버렸다. 추측하지 말고 받아 적은 걸 본다.

     이걸 안 보면 두 가지가 같이 나빠진다 — 없는 파일을 불러 콘솔에 404 를 남기고,
     쥬크박스가 **살 수 없는 것을 팔려고 한다.** 사면 오르골이 나온다. */
  const shipped = t => !t || !t.src ||
    (typeof assetShipped === 'function' ? assetShipped(t.src) : true);

  /* 시간대 자동 선곡. 「BGM 무드」 — 저녁엔 가라앉고, 밤엔 비나 오르골.
     갖고 있는 곡 중에서만 고른다. 하나도 없으면 지금 곡을 그대로 둔다. */
  /* **근무표가 아니라 시계를 본다**(sim.js 의 skyOf). 「아침·낮은 밝게, 저녁은
     가라앉고, 밤에는 비 오는 창가로」 는 세상이 몇 시인지에 대한 말이고,
     내가 몇 시에 출근하는지와는 상관이 없다. lunch 칸이 morning 으로 바뀐 이유도
     그것이다 — 점심은 근무의 사건이지 시간대가 아니다. */
  /* 시간대가 다섯이 되었다(sim.js SKY_AT). afternoon 이 빠지면 AUTO[p] 가 undefined 라
     오후 내내 자동 선곡이 조용히 멈춘다 — 고장인지도 모르게. */
  const AUTO = {
    morning:   ['aquarium', 'squeak', 'boot'],
    day:       ['aquarium', 'squeak', 'boot'],
    afternoon: ['aquarium', 'boot', 'squeak'],
    evening:   ['nocturne', 'rainy', 'aquarium'],
    night:     ['rainy', 'nocturne', 'box'],
  };
  function autoPick(){
    let p = 'day';
    try { p = skyOf(S.clock); } catch(e){}
    const own = ownedIds();
    const hit = (AUTO[p] || []).find(id => own.includes(id) && shipped(trackOf(id)));
    return hit || null;
  }

  /* 지금 나와야 하는 트랙. 모드가 정한다. */
  function wantTrack(){
    const m = st();
    if (m.mode === 'auto'){ const a = autoPick(); if (a) return trackOf(a); }
    return trackOf(m.cur);
  }

  /* ---------- 1순위: 파일 재생 (크로스페이드) ---------- */
  /* 0.45로 깔아 뒀더니 다른 창에서 일하는 동안엔 거의 안 들렸다.
     배경에 켜 두는 게 이 게임의 사용법이라 그 자리에서 들리는 크기여야 한다.
     밤에는 nightMul()이 절반으로 줄이고, 그 위에 CD 플레이어의 음량(masterVol)이 한 번 더 곱해진다. */
  const FILE_VOL = 0.7;
  const FADE = 900;                   // 갈아탈 때 겹치는 시간(ms)
  let deck = null;                    // 지금 나오는 <audio>
  let deckSrc = '';
  const broken = new Set();           // 못 읽은 파일 — 다시 시도하지 않는다
  let volTimer = null;
  const wantVol = () => FILE_VOL * nightMul() * masterVol();

  /* 볼륨 램프 하나로 페이드인·페이드아웃·밤 감쇠를 전부 처리한다.
     타이머는 램프가 남아 있을 때만 돈다 — 배경 탭에서 빈 인터벌을 돌릴 이유가 없다. */
  let ramps = [], rampTimer = null;
  function ramp(el, to, dur, stopAfter){
    if (!el) return;
    ramps = ramps.filter(r => r.el !== el);
    ramps.push({ el, from: el.volume, to, t0: performance.now(), dur: dur || FADE, stop: !!stopAfter });
    if (!rampTimer) rampTimer = setInterval(rampTick, 50);
  }
  function rampTick(){
    const now = performance.now();
    ramps = ramps.filter(r => {
      const k = r.dur > 0 ? Math.min(1, (now - r.t0) / r.dur) : 1;
      try { r.el.volume = Math.max(0, Math.min(1, r.from + (r.to - r.from) * k)); } catch(e){}
      if (k < 1) return true;
      if (r.stop){ try { r.el.pause(); r.el.removeAttribute('src'); r.el.load(); } catch(e){} }
      return false;
    });
    if (!ramps.length){ clearInterval(rampTimer); rampTimer = null; }
  }

  function fileStart(src){
    if (!src || broken.has(src)) return false;
    if (deck && deckSrc === src){
      const p = deck.play();
      if (p && p.catch) p.catch(() => {});
      ramp(deck, wantVol(), 300);
      startVolTimer();
      return true;
    }
    let a;
    try {
      a = new Audio(assetURL(src));    // 한 파일로 묶은 배포본에선 data: URI 가 온다
      a.loop = true;
      a.volume = 0;
      a.addEventListener('error', () => {
        broken.add(src);
        if (deck === a){ deck = null; deckSrc = ''; }
        sync();                        // 파일이 없으면 오르골로 내려간다
      });
    } catch(e){ broken.add(src); return false; }
    /* 옛 곡은 **끄지 않고 흘려보낸다.** 이게 크로스페이드의 전부다 —
       두 판을 동시에 돌리고 한쪽만 내리면 이음매가 안 들린다. */
    if (deck) ramp(deck, 0, FADE, true);
    deck = a; deckSrc = src;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    ramp(a, wantVol(), FADE);
    startVolTimer();
    return true;
  }
  function startVolTimer(){
    if (volTimer) return;
    /* 밤이 되는 순간을 실시간으로 좇을 필요는 없다. 10초면 충분히 부드럽다.
       램프가 걸려 있는 판은 건드리지 않는다 — 두 개가 같은 값을 두고 싸운다. */
    volTimer = setInterval(() => {
      if (deck && !deck.paused && !ramps.some(r => r.el === deck)) deck.volume = wantVol();
    }, 10000);
  }
  function fileStop(){
    if (deck) ramp(deck, 0, 400, true);
    deck = null; deckSrc = '';
    if (volTimer){ clearInterval(volTimer); volTimer = null; }
  }
  function filePlaying(){ return !!(deck && !deck.paused); }

  /* ---------- 유튜브 ----------
     소리만 쓴다. 화면은 1px 짜리로 숨겨 두는데, display:none 으로 지우면
     플레이어가 아예 안 도는 브라우저가 있어서 **보이지 않게 밀어 두기만** 한다.

     이 게임은 근무 중에 켜 두는 물건이라 사내망에서 유튜브가 막혀 있을 수 있다.
     그리고 단일 파일 배포본은 file:// 라 origin 이 null 이다. 둘 다 흔한 경우이므로
     **실패가 정상 경로**다 — 못 뜨면 조용히 원래 곡으로 돌아가고 한 번만 알린다. */
  const YT_SRC = 'https://www.youtube.com/iframe_api';
  let ytPlayer = null, ytLoading = false, ytFailed = false, ytOn = false, ytCur = '';
  /* 왜 실패했는지. "사내망에서 막혔다"와 "게시자가 퍼가기를 막았다"는 사용자가
     할 일이 완전히 다르다(포기 / 다른 링크). 하나로 뭉치면 안내가 거짓말이 된다. */
  let ytWhy = '';
  /* 목록이 거절당해서 그 안의 영상 하나로 내려앉았다. 한 번만 내려앉는다 —
     안 그러면 목록↔영상 사이를 오가며 계속 다시 싣는다. */
  let ytOnlyVid = false;
  /* 유튜브가 준 마지막 오류 코드. 안내 문구는 사람 말로 하고, 이건 진단용으로 남긴다 —
     "안 나온다" 를 고치려면 2 인지 150 인지가 전부다. */
  let ytCode = 0;
  let ytMaking = false;         // 재생기를 만드는 중 — 두 번 만들면 소리가 두 겹이 된다
  let ytMuted = false;          // 음소거로 시작했고 아직 소리를 안 켰다
  let ytSkips = 0;              // 플레이리스트에서 건너뛴 항목 수
  /* 실패를 듣는 쪽이 둘이다 — 열려 있는 쥬크박스 화면과, 닫혀 있을 때의 토스트.
     하나짜리 슬롯으로 두면 화면을 한 번 열었다 닫는 순간 토스트가 사라진다. */
  const ytWatch = [];

  /* 주소에서 목록과 영상을 **둘 다** 뽑는다. 하나만 뽑던 게 문제였다:
     유튜브에서 재생 중에 주소창을 복사하면 `watch?v=X&list=RD…` 가 나오는데,
     RD(믹스·자동 목록)는 iframe API 로 실을 수 없다. 목록만 보고 포기하면
     **틀 수 있는 영상 X 를 두고 무음이 된다** — 그게 "링크를 걸었는데 안 나온다"의
     제일 그럴듯한 경로다. 둘 다 들고 오면 아래에서 되는 쪽을 고를 수 있다. */
  function parseYT(url){
    const s = String(url || '').trim();
    if (!s) return null;
    const list = (s.match(/[?&]list=([A-Za-z0-9_-]{12,})/) || [])[1]
      || (/^(PL|UU|LL|RD|OL|FL)[A-Za-z0-9_-]{10,}$/.test(s) ? s : null);
    const video = (s.match(/[?&]v=([A-Za-z0-9_-]{11})/) || [])[1]
      || (s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || [])[1]
      || (s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/) || [])[1]
      || (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : null);
    if (!list && !video) return null;
    const p = {};
    if (list) p.list = list;
    if (video) p.video = video;
    return p;
  }

  /* 믹스·자동 생성 목록(RD…). 유튜브가 즉석에서 만드는 것이라 API 의 loadPlaylist 로는
     못 싣는다 — 실측: 코드 2 로 거절당한다. 영상이 같이 왔으면 그쪽을 쓴다. */
  const ytMix = p => !!(p && p.list && /^RD/.test(p.list));
  /* 이번에 무엇을 실을지. 목록이 우선이지만 믹스는 영상에 양보한다. */
  function ytPick(p){
    if (!p) return null;
    if (p.list && !(ytMix(p) && p.video) && !ytOnlyVid) return { list: p.list };
    if (p.video) return { video: p.video };
    return p.list ? { list: p.list } : null;
  }

  function ytFail(why){
    ytFailed = true; ytOn = false; ytWhy = why || 'error';
    ytWatch.forEach(f => { try { f(why); } catch(e){} });
    /* 유튜브가 안 되면 갖고 있는 곡으로 내려간다. 조용히 무음이 되는 게 제일 나쁘다. */
    const m = st();
    if (m.cur === 'yt'){ m.cur = ownedIds().includes('aquarium') ? 'aquarium' : 'box'; }
    sync();
  }

  function ytLoad(cb){
    if (window.YT && window.YT.Player) return cb(true);
    if (ytFailed) return cb(false);
    if (!ytLoading){
      ytLoading = true;
      try {
        const s = document.createElement('script');
        s.src = YT_SRC;
        s.onerror = () => { ytFailed = true; };
        document.head.appendChild(s);
      } catch(e){ ytFailed = true; }
    }
    const t0 = performance.now();
    const iv = setInterval(() => {
      if (window.YT && window.YT.Player){ clearInterval(iv); cb(true); }
      else if (ytFailed || performance.now() - t0 > 7000){ clearInterval(iv); ytFailed = true; cb(false); }
    }, 150);
  }

  /* 재생기 상자. 소리만 쓰지만 **200×200 보다 작게 만들면 안 된다** —
     유튜브가 문서로 못 박아 둔 최소 크기고, 그보다 작으면 재생을 거부하거나
     "플레이어가 너무 작습니다" 로 죽는다. 200×120 이었고, 그게 원인 하나였다.

     그리고 화면 **밖으로 밀지 않는다.** left:-9999px 는 브라우저가 "안 보이는
     미디어" 로 보고 재생을 늦추거나 멈출 수 있는 자리다. 화면 안에 두고
     opacity 로 지운다 — 크기와 위치는 진짜고 보이지만 않는다. */
  function ytBox(){
    let d = document.getElementById('ytbox');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'ytbox';
    d.style.cssText = 'position:fixed;left:0;bottom:0;width:200px;height:200px;'
      + 'opacity:0;pointer-events:none;z-index:0;border:0';
    document.body.appendChild(d);
    return d;
  }

  /* 쥬크박스를 열 때 **스크립트만** 미리 내려받는다. 재생기는 안 만든다.
     이유: 「걸기」를 누른 뒤에 스크립트를 받으면 그 사이에 클릭 제스처가 식고,
     그러면 자동재생 정책이 소리를 막는다. 미리 받아 두면 new YT.Player 가
     누른 손 안에서 바로 만들어져 소리가 그냥 난다. */
  function ytWarm(){
    if (window.YT && window.YT.Player) return;
    if (ytFailed || ytLoading) return;
    ytLoad(() => {});
  }

  function ytApply(){
    if (!ytPlayer) return;
    const p = ytPick(parseYT(st().yt));
    if (!p) return;
    const key = p.list ? 'L' + p.list : 'V' + p.video;
    try {
      if (key !== ytCur){
        ytCur = key; ytSkips = 0;
        if (p.list) ytPlayer.loadPlaylist({ list: p.list, listType:'playlist', index:0 });
        else ytPlayer.loadVideoById(p.video);
        /* 한 곡짜리는 끝나면 멈춘다. 배경음악은 끝나면 안 된다. */
        if (!p.list && ytPlayer.setLoop) ytPlayer.setLoop(true);
        /* 섞기·반복은 여기서도 뜻이 있어야 한다 — 모드 버튼을 눌러 놓고
           유튜브만 순서대로 도는 건 버튼이 거짓말을 하는 것이다. */
        if (p.list){
          try { if (ytPlayer.setShuffle) ytPlayer.setShuffle(st().mode === 'shuffle'); } catch(e){}
          try { if (ytPlayer.setLoop) ytPlayer.setLoop(true); } catch(e){}
        }
      } else ytPlayer.playVideo();
      ytVol();
    } catch(e){}
  }

  /* 음소거로 시작해 놓고 **재생이 실제로 시작된 뒤** 소리를 켠다.
     크롬은 소리 나는 자동재생을 사용자 입력 없이 막지만 음소거 재생은 허용하고,
     이미 시작된 재생을 나중에 unMute 하는 것은 막지 않는다. 이게
     "링크를 넣었는데 아무 일도 안 일어난다" 의 진짜 원인이었다. */
  function ytVol(){
    if (!ytPlayer) return;
    const v = Math.round(100 * wantVol());
    try { ytPlayer.setVolume(v); } catch(e){}
    if (ytMuted && ytPlayer.unMute){
      try { ytPlayer.unMute(); ytMuted = false; } catch(e){}
    }
    /* 전체 음소거(음량 0)면 다시 눌러 둔다 — setVolume(0) 만으로는
       모바일 사파리처럼 볼륨을 못 바꾸는 기계에서 소리가 계속 난다. */
    if (v === 0 && ytPlayer.mute) try { ytPlayer.mute(); } catch(e){}
  }

  function ytStart(){
    const p = parseYT(st().yt);
    if (!p){ ytFail('empty'); return; }
    ytOn = true;
    if (ytPlayer){ ytApply(); return; }
    if (ytMaking) return;
    ytMaking = true;
    ytLoad(ok => {
      if (!ok){ ytMaking = false; ytFail('blocked'); return; }
      try {
        ytMuted = true;
        ytPlayer = new YT.Player(ytBox(), {
          height:'200', width:'200',
          /* origin 은 http(s) 일 때만 준다. file:// 에서는 "null" 이 가서 오히려 거절당한다 —
             어차피 그 환경에서는 안 뜨는 게 정상이고, 거짓 origin 으로 실패 원인만 흐려진다. */
          playerVars: Object.assign({ autoplay:1, controls:0, disablekb:1, playsinline:1, mute:1 },
                                    /^https?:$/.test(location.protocol) ? { origin: location.origin } : {}),
          events: {
            onReady: () => { ytMaking = false; if (ytOn) ytApply(); else try { ytPlayer.pauseVideo(); } catch(e){} },
            onError: e => ytError(e && e.data),
            onStateChange: e => ytState(e && e.data),
          },
        });
      } catch(e){ ytMaking = false; ytFail('error'); }
    });
  }

  /* 유튜브 오류 코드. 2 잘못된 인자 · 5 재생기 오류 · 100 없는 영상 ·
     101/150 **게시자가 퍼가기를 막았다.** 마지막 것이 제일 흔한데 지금까지
     "사내망에서 막혀 있습니다" 로 안내하고 있었다 — 그 사람은 네트워크를
     쳐다보며 시간을 버린다. 할 일이 다르면 다르게 말해야 한다. */
  function ytError(code){
    ytCode = code || 0;
    const p = parseYT(st().yt) || {};
    const onList = !!(ytPick(p) || {}).list;
    /* 목록 안에서 한 곡이 막힌 것뿐이면 **다음 곡으로 넘어간다.**
       퍼가기 금지 영상 하나 때문에 목록 전체를 포기할 이유가 없다. */
    if (onList && (code === 101 || code === 150 || code === 100) && ytSkips < 12){
      ytSkips++;
      try { ytPlayer.nextVideo(); return; } catch(e){}
    }
    /* 목록 자체가 거절당했는데(비공개·믹스) **주소에 영상이 같이 있으면** 그것만 튼다.
       주소창을 복사하면 목록이 딸려 오는 게 흔한데, 그때 무음이 되는 건 억울하다. */
    if (onList && p.video && !ytOnlyVid){
      ytOnlyVid = true; ytCur = '';
      try { ytApply(); return; } catch(e){}
    }
    ytFail(code === 101 || code === 150 ? 'embed'
         : code === 100 ? 'notfound'
         : code === 2 ? 'badlink' : 'error');
  }

  function ytState(code){
    if (!ytOn) return;
    if (code === 1){ ytSkips = 0; ytVol(); return; }        // 재생 시작 — 여기서 소리를 켠다
    if (code !== 0) return;                                 // 0 = 끝
    /* 끝나면 처음으로 되돌린다 — 배경음악은 끝나면 안 된다.
       플레이리스트는 playVideo() 로는 마지막 곡만 다시 나므로 0번으로 감는다. */
    try {
      if ((ytPick(parseYT(st().yt)) || {}).list && ytPlayer.playVideoAt) ytPlayer.playVideoAt(0);
      else ytPlayer.playVideo();
    } catch(e){}
  }
  function ytStop(){
    ytOn = false;
    if (ytPlayer){ try { ytPlayer.pauseVideo(); } catch(e){} }
  }
  function ytPlaying(){
    if (!ytOn || !ytPlayer || !ytPlayer.getPlayerState) return false;
    try { return ytPlayer.getPlayerState() === 1 || ytPlayer.getPlayerState() === 3; } catch(e){ return false; }
  }

  /* ---------- 2순위: 생성 엔진 (오르골 로파이) ----------
     72 BPM · 4마디 흰건반 코드 루프(Cmaj7→Am7→Fmaj7→G6) 위에
     확률적 아르페지오 — 같은 4마디가 두 번 반복되지 않는다.
     백그라운드 탭에서 setInterval이 1초로 죽어도 끊기지 않도록
     미리 2.2초치 음표를 예약해 둔다.

     쥬크박스에서는 이게 폴백이 아니라 **한 곡**(「사내 오르골」)이기도 하다.
     파일이 하나도 없는 환경에서 음악이 통째로 사라지지 않는 이유가 여기 있다. */
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

  let ctx = null, master = null, timer = null, genGain = null;
  let nextT = 0, step = 0;

  function ensureCtx(){
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
      master = ctx.createGain();
      genGain = master;
      // 파일 재생 쪽과 같은 비율로 올린다 — 폴백이 눈에 띄게 조용하면 다른 게임처럼 들린다.
      // 개별 음의 진폭이 0.05 언저리라 여기서 1.5를 곱해도 합이 1.0 근처에 못 간다.
      master.gain.value = 1.5 * masterVol();
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
    if (!ensureCtx()) return;
    // resume 을 타이머 확인보다 먼저 한다 — 자동재생 정책으로 정지된 채 예약만 돌던
    // 컨텍스트를 이번 입력에서 되살려야 한다. 뒤에 두면 타이머가 있다는 이유로 그냥 나가서
    // "돌고는 있는데 소리는 없는" 상태에 갇힌다.
    if (ctx.state === 'suspended') ctx.resume();
    if (timer) return;
    nextT = Math.max(nextT, ctx.currentTime + 0.1);
    schedule();
    timer = setInterval(schedule, TICK);
  }
  function genStop(){
    if (timer){ clearInterval(timer); timer = null; }
    if (ctx) ctx.suspend();
  }
  /* 예약 타이머가 도는 것만으로는 소리가 난다고 할 수 없다 — 컨텍스트가 실제로
     돌고 있어야 한다. 이걸 구분해야 위의 재시도가 막힌 상태를 알아본다. */
  function genPlaying(){ return !!timer && !!ctx && ctx.state === 'running'; }

  /* ---------- 공통 ---------- */
  function playing(){ return filePlaying() || genPlaying() || ytPlaying(); }

  /* 지금 트랙이 요구하는 재생기 하나만 남기고 나머지는 끈다.
     세 재생기(파일·오르골·유튜브)가 동시에 도는 순간이 이 파일의 유일한 진짜 버그원이라
     **켜기 전에 끄는** 순서를 지킨다. */
  function start(){
    const t = wantTrack();
    if (t.yt){
      fileStop(); genStop();
      ytStart();
      return;
    }
    ytStop();
    if (t.src && !shipped(t)) broken.add(t.src);   // 부르지도 않는다 — 404 는 진단을 흐린다
    if (t.src && !broken.has(t.src)){
      genStop();
      if (fileStart(t.src)) return;
    }
    /* 파일이 없거나(배포본·오프라인) 읽기에 실패했다 — 오르골이 그 자리를 메운다.
       원래 그러라고 있는 폴백이고, 이제는 목록에 이름도 있는 한 곡이다. */
    fileStop();
    genStart();
  }
  function stop(){ fileStop(); genStop(); ytStop(); }

  /* soundOn(전체 음소거)과 musicPref(설정) 둘 다 켜져 있어야 재생.
     프롤로그가 돌고 있으면(__introAudio) 그동안은 눌러 둔다 — 비·통화 소리 위에
     오르골이 겹치면 둘 다 안 들린다. 컷신이 편지 장면에서 이 문을 열고 다시 부른다. */
  let lastKey = '';
  function sync(){
    const want = musicPref && (typeof soundOn === 'undefined' || soundOn) && !window.__introAudio;
    const key = want ? wantTrack().id + '|' + (st().yt || '') : '';
    if (!want){ if (playing()) stop(); lastKey = ''; return; }
    /* 곡이 바뀌었으면 돌고 있어도 다시 건다 — 그게 갈아타기다. */
    if (key !== lastKey){ lastKey = key; start(); return; }
    if (!playing()) start();
  }
  /* 슬라이더를 움직이면 **지금 나고 있는 소리**가 바로 따라와야 한다.
     다음 곡부터 반영되는 음량은 음량이 아니다. */
  function volumeChanged(){
    if (deck && !deck.paused && !ramps.some(r => r.el === deck)) deck.volume = wantVol();
    if (genGain) try { genGain.gain.value = 1.5 * masterVol(); } catch(e){}
    if (ytPlayer && !ytMuted) ytVol();
  }

  function setPref(on){
    musicPref = on;
    try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0'); } catch(e){}
    sync();
  }

  /* ---------- 사람이 직접 누른 재생 ----------
     쥬크박스의 ▶︎ 가 부른다. 자동재생 정책은 **이 입력에서 시작한 재생**만 허락하므로
     여기서 미루면 안 된다 — 누른 손 안에서 할 수 있는 것을 다 한다.

     유튜브 재생기는 음소거로 시작해 둔다(그게 정책을 통과하는 유일한 길이었다).
     상태 1 이 끝내 안 오면 음소거로 남아 있으므로, 사람이 직접 누른 이 자리에서는
     소리도 지금 켠다 — 이미 시작된 재생의 unMute 는 정책이 막지 않는다.

     lastKey 를 비우는 이유: sync() 는 "같은 곡이니 됐다"로 빠져나갈 수 있고,
     그러면 버튼을 눌러도 아무 일이 안 일어난다. 버튼은 그러면 안 된다. */
  function kick(){
    if (ctx && ctx.state === 'suspended'){ try { ctx.resume(); } catch(e){} }
    if (wantTrack().yt && ytPlayer){
      ytOn = true;
      try { ytPlayer.unMute(); ytMuted = false; } catch(e){}
      try { ytPlayer.playVideo(); } catch(e){}
      ytVol();
    }
    lastKey = '';
    sync();
    /* 유튜브는 눌러도 소리가 몇 초 뒤에 온다(버퍼링 = 상태 3). 여기서 false 가
       나왔다고 실패는 아니라서, 화면은 조금 뒤에 한 번 더 본다(juke.js). */
    return playing();
  }

  /* ---------- 쥬크박스 조작 ---------- */
  function play(id){
    const t = trackOf(id);
    if (!t) return false;
    if (t.yt){ if (!parseYT(st().yt)) return false; }
    else if (!has(t.id)) return false;
    const m = st();
    m.cur = t.id;
    if (m.mode === 'auto') m.mode = 'loop';   // 손으로 고르는 순간 자동은 끝난다
    ytFailed = false;
    try { save(); } catch(e){}
    sync();
    return true;
  }
  function next(){
    const own = ownedIds();
    if (!own.length) return;
    const m = st();
    const i = own.indexOf(m.cur);
    const j = m.mode === 'shuffle' && own.length > 1
      ? (i + 1 + Math.floor(Math.random() * (own.length - 1))) % own.length
      : (i + 1) % own.length;
    play(own[j]);
  }
  /* 줍는다(가구 조사) · 산다(💿). 둘 다 결국 같은 목록에 한 줄이 늘어난다. */
  function grant(id){
    const t = trackOf(id);
    if (!t || t.yt || has(id)) return false;
    st().owned.push(id);
    try { save(); } catch(e){}
    return true;
  }
  function buy(id){
    const t = TRACKS.find(x => x.id === id);
    if (!t || !t.cost || has(id)) return false;
    if (typeof S === 'undefined' || !S || S.anchovy < t.cost) return false;
    S.anchovy -= t.cost;
    grant(id);
    return true;
  }
  function setMode(mode){
    if (!['loop', 'shuffle', 'auto'].includes(mode)) return;
    st().mode = mode;
    try { save(); } catch(e){}
    /* 유튜브가 돌고 있으면 그쪽 섞기도 지금 바꾼다 — 다음 곡부터 반영되는
       섞기는 눌러도 아무 일이 안 일어난 것으로 보인다. */
    if (ytPlayer && ytOn && (ytPick(parseYT(st().yt)) || {}).list){
      try { if (ytPlayer.setShuffle) ytPlayer.setShuffle(mode === 'shuffle'); } catch(e){}
    }
    sync();
  }
  function setYT(url){
    const p = parseYT(url);
    st().yt = p ? String(url).trim() : '';
    ytCur = ''; ytFailed = false; ytWhy = ''; ytSkips = 0; ytOnlyVid = false; ytCode = 0;
    try { save(); } catch(e){}
    if (!p) return false;
    return play('yt');
  }
  function ytStatus(){
    return { url: st().yt, parsed: parseYT(st().yt), picked: ytPick(parseYT(st().yt)),
             failed: ytFailed, why: ytWhy, playing: ytPlaying(),
             skipped: ytSkips, onlyVideo: ytOnlyVid, code: ytCode };
  }

  /* 브라우저 자동재생 정책: 첫 입력 후에만 소리를 낼 수 있다.

     한 번만 시도하면 안 된다. 마우스에서는 pointerdown 시점에 아직 "사용자 활성화"가
     없는 브라우저가 있고(명세상 활성화를 주는 건 mousedown·pointerup 부터다),
     그러면 그 한 번의 play() 가 거부되면서 음악이 영원히 안 나온다 — 처음엔 조용하고
     소리를 껐다 켜야 나오던 증상이 이것이었다. 그 토글이 sync() 를 한 번 더 부르는
     유일한 통로였을 뿐이다.

     그래서 click·pointerup·touchend 까지 같이 듣는다.

     그리고 **리스너를 떼지 않는다.** 전에는 재생이 시작된 것을 확인하면 disarm() 으로
     영구히 뗐다. 부팅 때 WAV 가 잘 돌고 있으면 그 시점에 떼어지고, 그 뒤 유튜브로
     갈아탔다가 막히면 **화면을 아무리 눌러도 듣는 사람이 없다** —
     「멈춰 있음 — 화면을 한 번 누르면 시작합니다」가 거짓이 되는 자리였다.
     소리는 근무 시간 내내 여러 번 갈아타는데, 한 번의 성공으로 문을 닫아 둘 이유가 없다.

     대신 값싸게 만든다: 이미 나고 있으면 그냥 나가고(그게 거의 모든 입력이다),
     한 번의 탭이 세 이벤트로 오므로 0.4초에 한 번만 실제로 본다. */
  const EV = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend'];
  const armedDocs = new Set();
  let armT = -1e9;

  function arm(){
    const now = performance.now();
    if (now - armT < 400) return;      // 한 번의 탭 = pointerdown · pointerup · click
    armT = now;
    if (playing()) return;             // 잘 돌고 있으면 이 입력은 우리 것이 아니다
    sync();
  }

  /* 🪟 로 떠 있는 창에 나가면 입력은 그 창의 문서로 간다. 그 문서에도 직접 붙어야
     한다 — 옮겨 준 합성 이벤트는 isTrusted 가 false 라서 자동재생 정책을 못 넘는다.
     그래서 init 은 문서를 받고, 여러 번 불러도 된다. */
  let autoTimer = null;
  function init(doc){
    const d = doc || document;
    /* 「시간대 자동」은 시계가 넘어가는 순간을 스스로 알아야 한다. sync() 는 이벤트로만
       불리므로, 저녁이 되어도 아무도 안 물어보면 낮 곡이 계속 돈다.
       자동일 때만 도는 게으른 타이머 하나로 충분하다 — 30초면 사람 귀에는 즉시다. */
    if (!autoTimer) autoTimer = setInterval(() => { if (st().mode === 'auto') sync(); }, 30000);
    /* 재생 중이어도 붙는다 — 지금 잘 나는 것과 30분 뒤에 막히는 것은 다른 일이다. */
    if (armedDocs.has(d)) return;
    armedDocs.add(d);
    EV.forEach(t => d.addEventListener(t, arm));
  }

  return {
    init, sync, setPref, pref: () => musicPref, playing,
    /* 쥬크박스 — juke.js(화면)와 story.js(줍기)가 쓴다 */
    tracks: () => TRACKS, track: trackOf, owned: ownedIds, has,
    now: () => wantTrack(), curId: () => st().cur, mode: () => st().mode,
    shipped,                                     // juke.js 가 목록에서 걸러 낸다
    play, next, grant, buy, setMode, setYT, ytStatus, ytWarm, volumeChanged, kick,
    /* 등록하면 떼는 함수를 돌려준다 — 모달은 닫힐 때 자기 것을 떼야 한다 */
    onYTFail: fn => { ytWatch.push(fn); return () => { const i = ytWatch.indexOf(fn); if (i >= 0) ytWatch.splice(i, 1); }; },
  };
})();
