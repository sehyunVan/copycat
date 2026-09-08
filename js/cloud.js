/* ============================================================
   cloud.js — 계정과 저장 동기화 (Supabase)

   **게임 파일을 한 줄도 안 고친다.** cozy.js 와 같은 방식으로 밖에서 얹는다 —
   S 가 생기기를 기다렸다가 붙고, save() 를 감싼다. index.html 에서 이 줄을 빼면
   게임은 이 파일이 없던 때와 **완전히 같이** 돈다.

   ── 꺼져 있는 것이 기본이다 ──

   설정이 비었거나 · file:// 로 열렸거나 · CDN 이 막혔거나 · 네트워크가 없으면
   **아무 일도 안 한다.** 단일 파일 배포본(file://)과 사내망이 그래서 그대로 산다.
   실패는 전부 조용히 삼킨다 — 저장은 로컬이 진실이고 서버는 사본이라, 사본을 못
   올린 것이 게임을 멈출 이유가 되면 안 된다.

   ── 지금 하는 일과 **일부러 안 하는 일** ──

   하는 일: 익명 계정으로 서버에 저장 사본을 올린다(몇 분에 한 번 · 화면을 덮을 때).
   안 하는 일: **자동 복원.** 서버가 앞서 있어도 로컬을 덮어쓰지 않는다.

   안 하는 이유가 중요하다. 익명 계정의 신원은 이 브라우저의 localStorage 에 있다 —
   즉 **캐시를 지우면 익명 계정도 같이 사라진다.** 그러면 서버의 그 줄은 주인이
   없어져서 영영 못 찾는다. 진짜 복원은 구글·이메일을 **연결한 다음**의 이야기이고,
   그 전에 자동 복원을 켜면 얻는 것 없이 덮어쓰기 사고만 생긴다.
   지금 이 파일이 버는 것은 하나다: **그날부터 서버에 사본이 쌓이기 시작한다.**

   ── 충돌 규칙 ──
   TODO 58 이 정한 그대로 **날 수(together.days)가 큰 쪽**이 진짜다. 마지막 저장
   승리로 하면 하나가 조용히 사라진다. 지금은 판정만 하고 알리기까지만 한다.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 설정 ----------
     publishable(anon) 키는 **공개되는 값이다.** 클라이언트에 박히는 것이 정상이고,
     방어선은 이 키가 아니라 서버의 RLS 다(saves 표의 정책 셋). 그래서 여기 적어 둔다.
     비우면 이 파일은 통째로 잠든다 — 계정 없이 내보내고 싶을 때의 스위치다. */
  const CFG = {
    url: 'https://uezoijircckenbvqgokp.supabase.co',
    key: 'sb_publishable_gprIG9Og02bWxZMVTzDvvA_18nGaegX',
  };
  const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  /* 개인정보처리방침과 계정 삭제 안내가 사는 곳(site/privacy.html · delete.html).
     구글 콘솔과 두 스토어가 **주소로** 요구하는 문서라 게임 밖에 있어야 하고,
     게임 안에서도 그 주소로 간다 — 문서를 두 벌 두면 언젠가 둘이 다른 말을 한다.

     루트다(`/site` 아니라). 스토어 서식에 그대로 붙일 주소라 짧을수록 좋고, 서버는
     옛 `/site/...` 도 같은 파일로 보내 준다 — 이미 나간 빌드가 404 를 보면 안 된다
     (home/deploy/Caddyfile 의 copycat.sarl 블록). */
  const SITE = 'https://copycat.sarl';

  /* 얼마나 자주 올리나. 카피캣은 켜 두는 게임이라 틱마다 올리면 무료 한도를 태우고
     배터리도 먹는다. 로컬 저장은 지금처럼 8초마다 돌고, 서버는 이 간격으로만 간다. */
  const PUSH_MS = 3 * 60 * 1000;

  /* ---------- 앱은 **자기 주소로** 돌아온다 ----------
     웹에서는 redirectTo 가 지금 페이지(location.href)라 구글이 끝나면 그 페이지가
     다시 열린다 — 사람 눈에는 게임으로 돌아온 것이다. 앱에서 그 주소는
     https://localhost/index.html, 즉 **앱 안에서만 뜻이 있는 주소**여서 바깥
     브라우저가 갈 수 없다. 그래서 로그인이 끝나고 낯선 페이지가 남고 게임은
     아무것도 못 받았다(「새로운 링크로 디렉션된다」의 정체).

     앱은 대신 자기 스킴으로 돌아온다 — copycat.sarl://login. 안드로이드·iOS 가 그
     주소를 보면 **앱을 깨우고**, 아래 finishLogin() 이 실려 온 것으로 세션을 세운다.
     로그인 창은 시스템 브라우저(Custom Tab)로 띄운다: 구글이 앱 안 웹뷰에서의
     OAuth 를 거절한다(disallowed_useragent).

     스킴은 네이티브 쪽 custom_url_scheme 과 **같은 값이어야 한다**
     (mobile/android/.../values/strings.xml · ios/App/App/Info.plist). */
  const APP_SCHEME = 'copycat.sarl';
  const NATIVE = (() => { try { const c = window.Capacitor;
      return !!(c && (c.isNativePlatform ? c.isNativePlatform()
                                         : (c.getPlatform && c.getPlatform() !== 'web')));
    } catch (e){ return false; } })();
  const plug = n => { try { return (window.Capacitor.Plugins || {})[n] || null; } catch (e){ return null; } };
  const backTo = () => (NATIVE ? APP_SCHEME + '://login' : location.href);

  async function openOutside(url){
    const B = plug('Browser');
    if (B && B.open) return B.open({ url });
    window.open(url, '_system');       /* 플러그인이 없으면 브릿지에 맡긴다 */
  }

  /* 딥링크로 돌아왔다. 두 갈래를 **다 받는다**: code(PKCE)와 토큰(implicit).
     지금 SDK 기본은 implicit 이지만 나중에 flowType 을 바꿔도 이 손은 그대로 돈다.
     신원 연결(linkIdentity)은 토큰을 안 실어 보내므로 그때는 세션을 새로 받아 온다. */
  let landing = false;
  async function finishLogin(raw){
    const url = String(raw || '');
    if (!sb || landing || url.indexOf(APP_SCHEME + '://') !== 0) return;
    landing = true;
    try { const B = plug('Browser'); if (B && B.close) B.close(); } catch (e){}
    const say = t => { try { if (typeof toast === 'function') toast(t); } catch (e){} };
    /* 말풍선만으로는 부족하다 — 시작 화면이 그 위를 덮는다. 창으로도 말한다. */
    const fail = t => { say('로그인하지 못했습니다 — ' + t); landing = false; sayLinked(t); };
    try {
      /* URL 은 스킴을 https 로 바꿔서 읽는다 — 커스텀 스킴은 브라우저의 URL 파서가
         searchParams 를 안 채워 주는 일이 있다. */
      const u = new URL(url.replace(APP_SCHEME + '://', 'https://app.local/'));
      const q = u.searchParams, h = new URLSearchParams(String(u.hash || '').replace(/^#/, ''));
      const pick = k => q.get(k) || h.get(k);
      const bad = pick('error_description') || pick('error');
      if (bad) return fail(bad);
      const code = pick('code'), at = pick('access_token'), rt = pick('refresh_token');
      let error = null;
      if (code && sb.auth.exchangeCodeForSession) ({ error } = await sb.auth.exchangeCodeForSession(code));
      else if (at && rt) ({ error } = await sb.auth.setSession({ access_token: at, refresh_token: rt }));
      else ({ error } = await sb.auth.refreshSession());
      if (error) return fail(error.message);
      /* **새로 고친다.** 이 파일은 부팅 때 한 번 계정을 읽고(start) 그 값으로 화면을
         꾸민다 — 세션이 도중에 바뀌면 그 값들이 옛것이다. 웹에서는 구글이 페이지를
         다시 열어 주어 공짜로 얻던 일을, 앱에서는 직접 한다(restore 와 같은 이유).
         사무실은 로컬 저장이 진실이라 새로 고쳐도 그대로다. */
      /* **새로고침 너머로 표시를 넘긴다.** 앱에서는 돌아온 흔적이 주소에 안 남는다 —
         우리가 우리 주소로 다시 여는 것이라 `?code=` 같은 게 없다. 그래서 웹에서
         주소를 보고 하던 「묶었습니다」가 앱에서만 조용히 지나갔다.
         sessionStorage 를 쓰는 이유: 새로고침은 넘고 앱을 껐다 켜면 사라진다. */
      try { sessionStorage.setItem('copycat.justlinked', '1'); } catch (e){}
      location.reload();
    } catch (e){ fail((e && e.message) || '주소를 읽지 못했다'); }
  }

  function nativeHooks(){
    if (!NATIVE) return;
    const A = plug('App');
    if (!A) return;
    if (A.addListener) A.addListener('appUrlOpen', ev => finishLogin(ev && ev.url));
    /* 앱이 **꺼져 있다가** 그 주소로 깨어난 경우 — 첫 이벤트는 이미 지나갔다 */
    if (A.getLaunchUrl) { try { A.getLaunchUrl().then(r => finishLogin(r && r.url), () => {}); } catch (e){} }
  }

  const ST = {
    on: false,          // 이 판에서 동기화가 도는가
    why: 'init',        // 안 돌면 왜
    uid: null,
    anon: true,         // 익명인가 (구글을 연결하면 false)
    who: '',            // 연결된 계정 표시용 (이메일)
    pushed: 0,          // 올린 횟수
    lastPush: 0,
    behind: false,      // 서버가 나보다 앞서 있다 (날 수 기준)
    serverDays: null,
  };
  window.CLOUD = {
    state: () => ({ ...ST }),
    /* 서버 손잡이를 하나만 내놓는다 — 제휴 지점(js/friends.js)이 같은 계정·같은 연결로
       붙어야 하고, 클라이언트를 두 벌 만들면 세션도 두 벌이 된다. */
    sb: () => (ST.on ? sb : null),
    push: () => flush(true),
    google: () => linkGoogle(),
    email: (addr) => linkEmail(addr),
    restore: () => restore(),
    out: () => signOut(),
    erase: () => eraseAccount(),
  };

  /* ── 로그인하고 **돌아온 판인가** ──
     구글로 넘어갔다 오면 주소에 표시가 붙어 온다(`#access_token=…` 또는 `?code=…`).
     Supabase 클라이언트가 그걸 먹고 지우므로 **만들기 전에** 여기서 봐 둔다.

     왜 필요한가: 돌아오면 페이지가 처음부터 다시 뜨고, 시작 화면도 그대로 다시 뜬다 —
     눌렀던 그 자리로 돌아온 것처럼 보인다. 됐는지 안 됐는지를 말해 주지 않으면
     사람은 한 번 더 누른다. */
  const CAME_BACK = (() => {
    try {
      const h = location.hash || '', q = location.search || '';
      if (/access_token=|provider_token=/.test(h)) return 'ok';
      if (/[?&]code=/.test(q)) return 'ok';
      /* 실패도 주소에 실려 온다. 「아무 일도 없었다」로 보이면 안 된다. */
      if (/error=|error_description=/.test(h + q)){
        const m = (h + q).match(/error_description=([^&]*)/);
        return 'fail:' + (m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '');
      }
      /* 앱이 남긴 표시(위 finishLogin). **한 번만 쓰고 지운다.** */
      try {
        if (sessionStorage.getItem('copycat.justlinked')){
          sessionStorage.removeItem('copycat.justlinked');
          return 'ok';
        }
      } catch (e){}
      return '';
    } catch (e){ return ''; }
  })();

  const off = why => { ST.on = false; ST.why = why; return false; };

  /* 돌 수 있는 자리인가 — 하나라도 아니면 조용히 잠든다 */
  function usable(){
    if (!CFG.url || !CFG.key) return off('설정 없음');
    if (location.protocol === 'file:') return off('file:// — 출처가 없어 로그인이 안 된다');
    if (navigator.onLine === false) return off('오프라인');
    return true;
  }

  const loadSDK = () => new Promise((ok, no) => {
    if (window.supabase && window.supabase.createClient) return ok();
    const s = document.createElement('script');
    s.src = SDK;
    s.onload = ok;
    s.onerror = () => no(new Error('SDK 를 못 받았다'));
    document.head.appendChild(s);
  });

  /* 게임의 저장은 `let S` 라 **window 의 속성이 아니다**(전역 렉시컬 스코프에 산다).
     그래서 `window.S` 로는 영영 안 보인다 — 처음에 그렇게 썼다가 이 파일이 통째로
     잠들어 있었다. 클래식 스크립트끼리는 그 스코프를 같이 쓰므로 **맨이름으로** 본다. */
  const game = () => (typeof S !== 'undefined' ? S : null);

  /* 지금 저장을 그대로 한 덩어리로. path 는 매 틱 바뀌는 임시값이라 뺀다
     (game.js 의 save() 와 **같은 규칙**이다 — 두 곳이 다르면 서버 사본이 로컬과 달라진다). */
  const snapshot = () => JSON.stringify(game(), (k, v) => k === 'path' ? undefined : v);
  const dayCount = () => { const g = game(); return ((g && g.together && g.together.days) | 0); };

  let sb = null, dirty = false, sending = false, lastSent = '', origSave = null;

  async function start(){
    if (!usable()) return;
    try { await loadSDK(); } catch (e){ return off('SDK 없음'); }
    try {
      sb = window.supabase.createClient(CFG.url, CFG.key, {
        /* 게임의 저장(copycat.save.v1)과 **다른 칸**을 쓴다. 한 칸에 섞으면
           로그아웃이 저장을 지우는 사고가 난다. */
        auth: { persistSession: true, storageKey: 'copycat.auth', autoRefreshToken: true },
      });
      /* 이미 이 브라우저에 세션이 있으면 그대로 쓴다 — 열 때마다 익명 계정을
         새로 만들면 서버에 주인 없는 줄이 쌓인다. */
      let { data: { session } } = await sb.auth.getSession();
      if (!session){
        const { data, error } = await sb.auth.signInAnonymously();
        if (error) return off('로그인 실패: ' + error.message);
        session = data.session;
      }
      who(session.user);
      ST.on = true; ST.why = '';
      nativeHooks();

      /* ── 익명에서 **벗어나는 순간**을 직접 듣는다 ──
         주소(웹)와 sessionStorage(앱)로 두 번 만들었는데 둘 다 경로에 기대는 방법이라,
         경로가 하나 더 생기면 또 조용해진다. 계정이 바뀌었다는 것은 **계정층이 안다** —
         그걸 물어보는 쪽이 짧고, 웹·앱·같은 자리에서 연결하는 경우까지 한 번에 덮는다. */
      try {
        sb.auth.onAuthStateChange((_evt, sess) => {
          const wasAnon = ST.anon;
          if (sess && sess.user) who(sess.user);
          if (wasAnon && !ST.anon) sayLinked();
        });
      } catch (e){}

      /* 위 신호를 놓치는 판을 위한 그물 — 돌아오면서 페이지가 새로 뜬 경우,
         세션은 이미 서 있어서 「바뀌는 순간」이 지나갔다. */
      if (CAME_BACK){
        /* 성패는 `sayLinked` 가 계정을 보고 가른다 — 돌아왔는데 익명이면 그것도 말한다.
           조용히 넘기면 사람은 됐는지 안 됐는지를 모른 채 한 번 더 누른다. */
        sayLinked(/^fail/.test(CAME_BACK) ? CAME_BACK.slice(5) : '');
      }
    } catch (e){ return off('시작 실패: ' + (e && e.message)); }

    await pull();
    hooks();
    /* 서버가 앞서 있으면 **묻는다.** 이 물음이 이 파일의 이유다 — 새 기기에서
       로그인한 사람이 사무실을 되찾는 유일한 길이고, 자동으로 하면 반대편(이 기기가
       진짜인 경우)을 조용히 지운다.
       단 **화면이 실제로 보일 때까지 기다린다**: 시작화면(z-index 9999)과 프롤로그가
       모달(100)을 덮으므로, 그 사이에 물으면 아무도 못 보는 창이 떴다 사라진다. */
    if (ST.behind) whenVisible(askRestore);
    else flush(true);                 // 내가 앞서거나 같으면 바로 사본을 남긴다
    setInterval(() => flush(false), 20 * 1000);
  }

  function who(user){
    ST.uid = user.id;
    ST.anon = !!user.is_anonymous;
    ST.who = (!ST.anon && (user.email || (user.user_metadata || {}).email)) || '';
  }

  /* 서버에 뭐가 있나 — **혼자 덮어쓰지 않는다.** 가져온 저장은 손에 들고만 있고,
     실제로 갈아 끼우는 것은 사람이 「되돌리기」를 눌렀을 때뿐이다(restore). */
  let serverSave = null;
  async function pull(){
    try {
      const { data, error } = await sb.from('saves')
        .select('save,days,save_version,updated_at').eq('user_id', ST.uid).maybeSingle();
      if (error || !data) return;
      serverSave = data.save || null;
      ST.serverDays = data.days | 0;
      ST.behind = ST.serverDays > dayCount();
    } catch (e){}
  }

  /* ---------- 구글 연결 ----------
     익명 계정에 신원을 **얹는다**(linkIdentity) — uid 가 그대로라 지금까지 쌓인 사본이
     그 계정 것이 된다. 프로젝트에서 수동 연결을 안 켰으면 그 길이 막히는데, 그때는
     그냥 로그인으로 내려간다: 로컬 저장이 진실이므로 새 계정으로 들어가도 다음 전송에
     이 사무실이 그대로 올라간다(익명 줄은 주인 없이 남지만 아무 해가 없다). */
  async function linkGoogle(){
    if (!ST.on) return { error: '동기화가 꺼져 있습니다' };
    /* 웹은 SDK 가 페이지를 그대로 넘긴다. 앱은 skipBrowserRedirect 로 **주소만**
       받아서(웹뷰가 구글 화면으로 가면 안 된다) 시스템 브라우저로 띄운다. */
    const opt = { provider: 'google', options: { redirectTo: backTo(), skipBrowserRedirect: NATIVE } };
    const go = async call => {
      const { data, error } = await call(opt);
      if (error) return { error: error.message };
      if (!NATIVE) return { ok: true };          /* 이 줄 다음은 없다 — 페이지가 넘어갔다 */
      const url = data && data.url;
      if (!url) return { error: '로그인 주소를 받지 못했습니다' };
      await openOutside(url);
      return { ok: true };
    };
    try {
      if (ST.anon && sb.auth.linkIdentity){
        const r = await go(o => sb.auth.linkIdentity(o));
        if (!r.error) return r;
      }
      return await go(o => sb.auth.signInWithOAuth(o));
    } catch (e){ return { error: (e && e.message) || '연결 실패' }; }
  }

  /* ---------- 되돌리기 ----------
     서버 저장을 **저장 칸에 그대로 써 넣고 새로 고친다.** 돌아가는 게임의 상태를
     안에서 갈아 끼우지 않는 이유: S 를 참조하는 곳이 사무실·고양이·렌더러까지
     널려 있어서, 한 곳이라도 옛 객체를 들고 있으면 그때부터 두 세계가 된다.
     새로 고치면 부팅 경로가 통째로 다시 돌아 그런 틈이 없다. */
  function restore(){
    if (!serverSave) return false;
    try {
      /* **게임의 저장을 먼저 떼어 낸다.** main.js 가 beforeunload 에 save() 를 걸어
         두었는데(그건 정상이다 — 창을 닫아도 사무실이 남아야 하니까), 새로 고치는
         순간 그 손이 **지금 화면의 사무실**을 방금 써 넣은 복원본 위에 덮어쓴다.
         처음에 이 줄이 없어서 「되돌렸는데 그대로였다」가 났다.
         등록할 때 쓴 그 함수 참조로만 뗄 수 있어서 hooks() 가 원본을 들고 있다. */
      /* 원본과 **지금의 window.save 둘 다** 뗀다. main.js 가 그 손을 거는 시점이
         우리가 감싸는 시점보다 늦을 수 있어서(둘 다 부팅 중이다), 그때는 등록된 것이
         감싼 쪽이라 원본만 떼면 안 떨어진다 — 실제로 그래서 한 번 안 떨어졌다. */
      if (origSave) window.removeEventListener('beforeunload', origSave);
      if (typeof window.save === 'function') window.removeEventListener('beforeunload', window.save);
      ST.on = false;                       // 우리 쪽 전송도 멈춘다

      const key = (typeof SAVE_KEY !== 'undefined') ? SAVE_KEY : 'copycat.save.v1';
      localStorage.setItem(key, JSON.stringify(serverSave));

      /* **그래도 한 번 더 막는다.** 손을 떼는 것만으로는 안 됐다 — 새로 고치는 동안
         저장을 부르는 길이 하나가 아니고(언로드·감춤·자동 저장), 그중 하나라도 남아
         있으면 방금 써 넣은 복원본 위에 지금 화면의 사무실이 덮인다.
         그래서 **지금 화면의 사무실 자체를 복원본으로 바꾼다.** 이제 누가 저장을
         불러도 써지는 것은 같은 내용이다. 몇 밀리초 뒤에 새로 고치므로 이 상태로
         게임이 도는 시간은 없다. */
      try { if (typeof S !== 'undefined') S = serverSave; } catch (e){}
      location.reload();
      return true;
    } catch (e){ return false; }
  }

  /* ---------- 이메일 (매직 링크) ----------
     비밀번호는 만들지 않는다 — 들고 있으면 유출 책임이 생기고, 그건 이 게임이
     감당할 종류의 책임이 아니다.

     **지금 계정에 메일을 얹는다**(updateUser) — 구글이 linkIdentity 로 하는 것과
     같은 일이다. 여기서 signInWithOtp 를 쓰면 그건 「연결」이 아니라 **다른 계정으로
     갈아타기**라서, 익명으로 쌓아 둔 서버 줄이 주인 없이 남는다(로컬이 진실이라
     사무실 자체는 안 사라지지만, 약속한 것과 다른 일이 일어난다).
     이미 신원이 있는 계정이면 그때는 로그인이 맞다 — 다른 기기에서 돌아오는 길이다.

     ※ 메일이 실제로 도착하려면 프로젝트에 **내 도메인 SMTP** 를 붙여야 한다.
        기본 발송기는 개발용이라 시간당 몇 통에서 막힌다. */
  async function linkEmail(addr){
    if (!ST.on) return { error: '동기화가 꺼져 있습니다' };
    const a = String(addr || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) return { error: '메일 주소 형식이 아닙니다' };
    try {
      if (ST.anon){
        const { error } = await sb.auth.updateUser({ email: a },
          { emailRedirectTo: backTo() });
        if (error) return { error: error.message };
        return { ok: true, linked: true };
      }
      const { error } = await sb.auth.signInWithOtp({
        email: a, options: { emailRedirectTo: backTo() } });
      if (error) return { error: error.message };
      return { ok: true, linked: false };
    } catch (e){ return { error: (e && e.message) || '보내지 못했습니다' }; }
  }

  async function signOut(){
    try { await sb.auth.signOut(); } catch (e){}
    location.reload();
  }

  /* ---------- 계정 삭제 ----------
     스토어의 필수 요건이다(App Store 5.1.1(v) · Google Play). 서버 함수 하나가
     저장·지점·친구·요청·차단·인사와 계정 자체를 지운다 — 여기서 표를 하나씩 지우면
     언젠가 목록이 낡아서 뭔가 남는다.

     **로컬 저장은 남긴다.** 지우는 것은 「서버에 있는 나」이고, 이 기계의 사무실까지
     같이 지우면 그건 계정 삭제가 아니라 게임 삭제다(그 문은 설정에 따로 있다). */
  async function eraseAccount(){
    if (!ST.on) return { error: '동기화가 꺼져 있습니다' };
    try {
      const { data, error } = await sb.rpc('account_delete');
      if (error) return { error: error.message };
      if (!data || !data.ok) return { error: (data && data.why) || '지우지 못했습니다' };
      try { await sb.auth.signOut(); } catch (e){}
      ST.on = false; ST.why = '계정을 지웠습니다';
      return { ok: true };
    } catch (e){ return { error: (e && e.message) || '지우지 못했습니다' }; }
  }

  /* 방이 화면에 나올 때까지 기다린다 — 시작화면 · 프롤로그 · 근로계약서가 다 지나간 뒤.
     30초를 넘기면 그냥 포기한다(그 사람은 지금 게임을 보고 있지 않다). */
  /* 돌아왔다고 말한다. 게임의 modal 을 쓴다 — 시작 화면 위로 뜨는 규칙이 이미 있다
     (style 의 `body.titleon .veil{z-index:10000}`). 말풍선(toast)은 시작 화면 뒤로
     숨어서 **돌아온 바로 그 순간에는 안 보인다.**

     시작 화면이 아직 안 그려졌을 수 있어(스크립트 순서) 조금 기다렸다 띄운다. */
  let said = false;
  function sayLinked(reason){
    /* 신호가 둘(위 onAuthStateChange · 아래 그물)이라 한 판에 한 번만 말한다. */
    if (said) return; said = true;
    /* **묶였는지는 주소가 아니라 계정을 보고 판단한다.** 돌아왔다는 표시가 붙어 있어도
       익명 그대로일 수 있고(중간에 취소·거절), 그때 「묶었습니다」라고 하면 거짓말이다.
       `reason` 은 앱 쪽에서 실패를 들고 바로 부를 때 온다(finishLogin 의 fail). */
    const fail = !!reason || /^fail/.test(CAME_BACK) || ST.anon;
    const why = reason || (/^fail/.test(CAME_BACK) ? CAME_BACK.slice(5) : '');
    let n = 0;
    const t = setInterval(() => {
      if (typeof modal !== 'function'){ if (++n > 40) clearInterval(t); return; }
      clearInterval(t);
      const m = modal(`
        <div class="mhead"><div class="q">ACCOUNT</div>
          <h3>${fail ? '연동하지 못했습니다' : '사무실을 계정에 연동했습니다'}</h3>
          <p>${fail
            ? (esc(why) || '다시 시도해 주세요.')
            : (ST.who ? esc(ST.who) + ' 로 들어왔습니다. ' : '')
              + '연동했으니 고양이들이 따라옵니다.'}</p></div>
        <div class="mfoot"><button class="okbtn" data-close>${
          fail ? '닫기' : '좋아요'}</button></div>`);
      /* 주소에 남은 표시를 지운다 — 새로 고칠 때마다 같은 창이 또 뜨면 안 된다.
         **해시까지** 지운다: 구글은 대개 그쪽에 실어 보낸다. */
      try {
        const q = location.search.replace(/([?&])code=[^&]*&?/, '$1').replace(/[?&]$/, '');
        history.replaceState(null, '', location.pathname + q);
      } catch (e){}
      return m;
    }, 250);
  }

  function whenVisible(fn){
    let n = 0;
    const t = setInterval(() => {
      const busy = document.querySelector('#cctitle, .opening, .veil, .coach');
      if (!busy){ clearInterval(t); fn(); return; }
      if (++n > 60){ clearInterval(t); }
    }, 500);
  }

  /* 서버가 앞설 때 묻는 창. 게임의 modal() 을 그대로 쓴다 — 창을 새로 그리면
     이 파일만 다른 그림체가 된다. */
  function askRestore(){
    if (typeof modal !== 'function') return;
    const mine = dayCount(), there = ST.serverDays | 0;
    const m = modal(`
      <div class="mhead"><div class="q">CLOUD</div>
        <h3>다른 기기의 사무실이 더 오래되었습니다</h3>
        <p>계정에 저장된 사무실은 <b>${there}일째</b>, 이 기기의 사무실은 <b>${mine}일째</b>입니다.</p></div>
      <div class="mbody">
        <div class="card"><div class="crow"><span class="em">☁️</span>
          <div class="info"><b>되돌리면</b><span>계정에 저장된 ${there}일째 사무실로 돌아갑니다.
            이 기기에서 지금 보고 있는 ${mine}일째 사무실은 사라집니다.</span></div></div></div>
        <div class="card"><div class="crow"><span class="em">🏢</span>
          <div class="info"><b>이대로 두면</b><span>지금 이 사무실을 계속 쓰고, 잠시 뒤
            계정에도 이 사무실이 올라갑니다.</span></div></div></div>
      </div>
      <div class="mfoot" style="display:flex;gap:8px">
        <button class="okbtn" id="cloudKeep" style="flex:1">이대로 둔다</button>
        <button class="okbtn" id="cloudBack" style="flex:1">되돌린다</button>
      </div>`);
    /* 「이대로 둔다」가 곧 **올려도 된다는 허락**이다 — 그 전까지 전송은 잠겨 있다(flush). */
    m.veil.querySelector('#cloudKeep').onclick = () => { ST.behind = false; m.close(); flush(true); };
    m.veil.querySelector('#cloudBack').onclick = () => restore();
  }

  /* 저장이 일어났다는 표시만 남긴다. 진짜 전송은 flush 가 간격을 보고 한다.
     game.js 의 save() 를 **감싼다** — 저쪽을 고치지 않는 것이 이 파일의 규칙이다. */
  function hooks(){
    const orig = window.save;
    if (typeof orig === 'function' && !orig.__cloud){
      origSave = orig;                    // 되돌릴 때 이 참조가 필요하다 (아래 restore)
      const wrapped = function (){ const r = orig.apply(this, arguments); dirty = true; return r; };
      wrapped.__cloud = true;
      window.save = wrapped;
    }
    /* 화면을 덮거나 끄는 순간은 **간격을 무시하고** 올린다. 사람이 앱을 접는
       그 순간이 사본을 남길 마지막 기회다. */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('pagehide', () => flush(true));
  }

  async function flush(now){
    if (!ST.on || sending || !game()) return;
    /* **서버가 앞서 있으면 한 글자도 안 올린다.** 사람이 「되돌릴까 이대로 둘까」를
       정하기 전에 올리면, 그 순간 더 오래된 사무실이 새 사무실을 덮는다 —
       창을 닫는 것만으로 그렇게 됐다(화면을 덮을 때 올리는 손이 여기로 온다).
       지키려고 만든 기능이 지키려던 것을 지우는 자리였다. */
    if (ST.behind) return;
    if (!now && (!dirty || Date.now() - ST.lastPush < PUSH_MS)) return;
    const body = snapshot();
    if (body === lastSent){ dirty = false; return; }   // 바뀐 것이 없으면 안 보낸다
    sending = true;
    try {
      const { error } = await sb.from('saves').upsert({
        user_id: ST.uid,
        save: JSON.parse(body),
        save_version: ((game() || {}).v | 0) || 2,
        days: dayCount(),
        updated_at: new Date().toISOString(),
      });
      if (!error){ lastSent = body; dirty = false; ST.pushed++; ST.lastPush = Date.now(); }
      else ST.why = '올리기 실패: ' + error.message;
    } catch (e){ ST.why = '올리기 실패'; }
    finally { sending = false; }
  }

  /* ---------- 설정 창에 한 줄 ----------
     게임의 설정 창(ui.js)을 고치지 않고, **뜨는 순간 밑에 얹는다**(cozy.js 가 「처음부터
     다시 시작」을 얹는 것과 같은 방법). 그래서 이 파일을 빼면 그 줄도 같이 사라진다. */
  function dress(veil){
    const q = veil.querySelector('.mhead .q');
    if (!q || !/SETTINGS|설정|設定/i.test(q.textContent)) return;
    const body = veil.querySelector('.mbody');
    if (!body || body.querySelector('.cloudrow')) return;

    const box = document.createElement('div');
    box.className = 'card cloudrow';
    /* **마지막으로 성공한 전송**을 적는다. 「저장되고 있습니다」만 띄우면 서버가
       하루 종일 안 받아 줘도 같은 문구가 떠 있다 — 그건 안심시키는 거짓말이다. */
    const agoTxt = () => {
      if (!ST.lastPush) return '아직 안 올렸습니다';
      const m = Math.round((Date.now() - ST.lastPush) / 60000);
      return m < 1 ? '방금 저장했습니다'
           : m < 60 ? m + '분 전에 저장했습니다'
           : Math.round(m / 60) + '시간 전에 저장했습니다';
    };
    const paint = () => {
      const linked = ST.on && !ST.anon;
      const bad = ST.on && /실패/.test(ST.why || '');
      box.innerHTML = `<div class="crow"><span class="em">${!ST.on ? '⚠️' : linked ? '🔒' : '☁️'}</span>
        <div class="info"><b>${!ST.on ? '서버에 안 올라가고 있습니다'
            : linked ? '계정에 저장되고 있습니다' : '이 기기에만 저장됩니다'}</b>
          <span>${!ST.on
            ? (ST.why || '꺼짐')
            : bad
              ? ST.why + ' · ' + agoTxt()
              : linked
                ? (ST.who || '연결됨') + ' · ' + agoTxt()
                : '구글이나 메일을 연결해 두면 기기를 바꾸거나 앱을 지워도 사무실이 남습니다.'}</span></div>
        ${ST.on && !linked ? '<button class="buy" data-cloud="google">구글로 지키기</button>' : ''}
      </div>
      ${ST.on && !linked ? `<div class="codebox" style="margin-top:9px">
          <input class="mail" data-cloud-mail maxlength="80" autocomplete="email" placeholder="메일 주소로 받기">
          <button class="buy alt" data-cloud="email">보내기</button></div>` : ''}
      ${ST.on && linked ? `<div class="codebox" style="margin-top:9px">
          <button class="buy alt" data-cloud="out">로그아웃</button>
          <button class="buy alt" data-cloud="erase">계정 삭제</button></div>
        <div class="hint">계정 삭제는 서버에 있는 사무실·지점·친구를 지웁니다.
          이 기기의 사무실은 남습니다.</div>` : ''}
      ${ST.on ? `<div class="hint" style="margin-top:8px">
          <a href="${SITE}/privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>
          · <a href="${SITE}/delete.html" target="_blank" rel="noopener">계정 삭제 안내</a>
        </div>` : ''}`;
    };
    paint();
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-cloud]');
      if (!b) return;
      const kind = b.dataset.cloud;
      const say = t => { if (typeof toast === 'function') toast(t); };

      if (kind === 'google'){
        b.disabled = true;
        const r = await linkGoogle();
        if (r && r.error){ b.disabled = false; say('연결하지 못했습니다 — ' + r.error); }
        else if (NATIVE) b.disabled = false;   /* 앱은 페이지가 안 넘어간다 — 취소하고 돌아올 수 있으니 다시 누를 길을 남긴다 */
        return;   /* 웹은 구글로 넘어갔다가 이 페이지로 돌아온다(redirectTo) · 앱은 딥링크로 돌아온다 */
      }
      if (kind === 'email'){
        const inp = box.querySelector('[data-cloud-mail]');
        b.disabled = true;
        const r = await linkEmail(inp ? inp.value : '');
        b.disabled = false;
        say(r && r.ok ? '메일을 보냈습니다 — 링크를 누르면 이 계정이 됩니다.'
                      : '보내지 못했습니다 — ' + ((r && r.error) || ''));
        return;
      }
      if (kind === 'out'){
        if (!confirm('로그아웃할까요? 이 기기의 사무실은 그대로 남습니다.')) return;
        signOut();
        return;
      }
      if (kind === 'erase'){
        /* 되돌릴 수 없는 조작이라 **두 번 묻는다.** 이 게임에서 두 번 묻는 것은
           여기와 「처음부터 다시 시작」뿐이다. */
        if (!confirm('계정을 지울까요? 서버의 사무실·지점·친구가 사라집니다.')) return;
        if (!confirm('되돌릴 수 없습니다. 정말 지울까요?')) return;
        b.disabled = true;
        const r = await eraseAccount();
        if (r && r.ok){ say('계정을 지웠습니다.'); setTimeout(() => location.reload(), 800); }
        else { b.disabled = false; say('지우지 못했습니다 — ' + ((r && r.error) || '')); }
      }
    });
    body.appendChild(box);
  }
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes)
      if (n.nodeType === 1 && n.classList && n.classList.contains('veil')) dress(n);
  }).observe(document.body, { childList: true });

  /* S 가 생길 때까지 기다린다 — 게임의 부팅 순서를 건드리지 않으려는 것이다.
     컷신이 도는 동안에도 S 는 이미 있으므로 그때부터 사본이 쌓인다. */
  const wait = setInterval(() => {
    if (!game() || typeof window.save !== 'function') return;
    clearInterval(wait);
    start();
  }, 500);
})();
