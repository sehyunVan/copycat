/* ============================================================
   care.js — 실시간 근무 동행
   이 게임은 근무 시간을 같이 견뎌주는 동행이다. 게임 시계가 아니라
   진짜 데스크탑 시계를 직접 읽어서 점심·휴식·퇴근을 챙긴다.

   rAF 루프는 백그라운드 탭에서 멈추므로 여기는 자체 setInterval(1초)로
   돈다. 사용자가 다른 창에서 일하는 중(= 탭이 숨겨진 상태)이 오히려
   기본 상황이라, 원하면 데스크탑 알림으로도 알려준다(옵트인).
   ============================================================ */

const NOTIF_KEY = 'copycat.notif';
let notifOn = false;
try { notifOn = localStorage.getItem(NOTIF_KEY) === '1'; } catch(e){}

/* 근무 스케줄 관련 알림(출근·스트레칭·티타임·퇴근)은 평일에만,
   점심·밤 인사는 요일 없이 챙긴다. */
/* 기록증을 언급하는 날. 첫날은 빼 둔다 — 하루 만에 자랑거리를 내밀면 값이 싸 보인다. */
const CARD_MILESTONES = [3, 5, 10, 20, 30, 50, 100, 200, 365];

const CARE_BEATS = [
  { id:'morning', at: 8*60+50, span:100, weekday:true, msg: () => L({
      ko:'☀️ 출근 도장 찍었다냥. 오늘도 옆에서 같이 버텨줄게.',
      en:'☀️ Clocked in, nya. We’ll get through today together.',
      ja:'☀️ 出勤スタンプ完了にゃ。今日も一緒に乗り切ろうね。' }) },
  { id:'lunch', at: WORK.lunch, span:20, weekday:false, msg: () => L({
      ko:'🍚 12시! 점심시간이다냥. 밥은 거르지 말자 — 사무실은 우리가 지킨다.',
      en:'🍚 It’s noon — lunch time! Don’t skip your meal. We’ll hold down the office.',
      ja:'🍚 12時、お昼にゃ！ごはんは抜かないで——オフィスはうちらが守る。' }), bubble:'lunch' },
  { id:'lunchEnd', at: WORK.lunchEnd, span:15, weekday:true, msg: () => L({
      ko:'오후 시작이다냥. 급할 것 없어, 하나씩 하면 된다.',
      en:'Afternoon begins. No rush — one thing at a time.',
      ja:'午後スタートにゃ。焦らなくていい、ひとつずつで大丈夫。' }) },
  { id:'tea', at: 15*60, span:20, weekday:true, msg: () => L({
      ko:'🍵 오후 3시. 물 한 잔 마시고 창밖 한 번 보자냥.',
      en:'🍵 3 PM. Grab some water and look out the window for a bit.',
      ja:'🍵 15時。お水を一杯、窓の外もちょっと見ようにゃ。' }) },
  { id:'end', at: WORK.end, span:30, weekday:true, msg: () => {
      const n = (S.careDay && S.careDay.done) || 0;
      const base = L({
        ko:`🌆 18시, 퇴근 시간이다냥! 오늘 하루를 버텨냈다. 결재 ${n}건 — 나머지는 내일의 고양이가 맡는다.`,
        en:`🌆 6 PM — clock-out time! You made it through today. ${n} approvals done — tomorrow’s cats will take the rest.`,
        ja:`🌆 18時、退勤にゃ！今日も乗り切った。決裁${n}件——残りは明日の猫にまかせよう。` });
      // 마디가 되는 날에만 기록증 얘기를 꺼낸다. 매일 하면 그건 권유가 아니라 잔소리다.
      const d = normTogether(S.together).days;
      if (!CARD_MILESTONES.includes(d)) return base;
      return base + ' ' + L({
        ko:`그리고 오늘로 ${d}일째다냥. 🪪 에 적어 뒀어.`,
        en:`Also — that makes ${d} days. It’s written down under 🪪.`,
        ja:`それと、今日で${d}日目にゃ。🪪 に書いておいた。` });
    } },
  { id:'night', at: 22*60, span:30, weekday:false, msg: () => L({
      ko:'🌙 밤 10시. 오늘은 여기까지 하자냥. 잘 자.',
      en:'🌙 10 PM. Let’s call it a day. Sleep well.',
      ja:'🌙 22時。今日はここまでにしよにゃ。おやすみ。' }) },
];

/* 50분 버틸 때마다 하나씩 돌아가며 나온다 — 몸을 풀라는 잔소리 4종 */
const CARE_STRETCH = [
  () => L({ ko:'🙆 50분 버텼다냥. 일어나서 어깨 한 번 돌리고 오자.',
            en:'🙆 You’ve held on for 50 minutes. Stand up and roll those shoulders.',
            ja:'🙆 50分がんばったにゃ。立って肩を回してこよう。' }),
  () => L({ ko:'🫁 숨 고르기 — 4초 들이쉬고, 4초 참고, 8초 내쉬기. 세 번이면 충분하다냥.',
            en:'🫁 Breathe — in for 4, hold for 4, out for 8. Three rounds is plenty.',
            ja:'🫁 深呼吸——4秒吸って、4秒止めて、8秒吐く。3回で十分にゃ。' }),
  () => L({ ko:'🪟 눈이 뻑뻑하지 않냥? 20초만 먼 곳을 보자.',
            en:'🪟 Eyes feeling stiff? Look at something far away for 20 seconds.',
            ja:'🪟 目が疲れてないにゃ？20秒だけ遠くを見よう。' }),
  () => L({ ko:'🚶 잠깐 일어나서 물 한 잔. 고양이도 기지개는 업무의 일부다냥.',
            en:'🚶 Stand up, get some water. Even for cats, stretching is part of the job.',
            ja:'🚶 ちょっと立ってお水を一杯。猫だって伸びは業務のうちにゃ。' }),
];
const STRETCH_EVERY = 50 * 60;   // 초
let stretchAcc = 0;

function careDayOf(){
  const dk = dayKey();
  if (!S.careDay || S.careDay.date !== dk){
    S.careDay = { date: dk, fired: {}, done: 0, stretchIdx: 0 };
    // 날짜가 바뀐 걸 여기서 처음 안다 → 함께한 날 +1. 하루에 몇 번을 열든 한 번만 는다.
    const t = S.together || (S.together = newTogether());
    t.days++;
    if (!t.since) t.since = dk;
  }
  return S.careDay;
}

/* 창이 열려 있던 실제 시간. 틱을 세지 않고 벽시계 차이를 더한다 — 배경 탭에서는
   1초 타이머가 분 단위까지 늦춰지므로, 틱을 세면 배경에 켜 둔 사람의 시간이 사라진다.
   반대로 노트북을 덮어 둔 8시간까지 "함께"로 칠 수는 없으니 큰 구멍은 버린다. */
let lastBeat = 0;
const BEAT_GAP_MAX = 5 * 60 * 1000;   // 이보다 벌어졌으면 자거나 닫혀 있었던 것
function togetherTick(working){
  const now = Date.now();
  const gap = lastBeat ? now - lastBeat : 0;
  lastBeat = now;
  if (gap <= 0 || gap > BEAT_GAP_MAX) return;
  const t = S.together || (S.together = newTogether());
  t.sec += gap / 1000;
  if (working) t.work += gap / 1000;
}

/* 오늘 도장 찍은 건수 — 퇴근 인사에 쓴다 */
bus.on('doc:stamped', () => { if (S) careDayOf().done++; });

function careSay(text, bubbleKind){
  toast(text, 'care', 5200);
  pushLog(text, 'good');
  if (typeof sfx !== 'undefined' && sfx.chime) sfx.chime();
  // 고양이 하나가 옆에서 거든다
  const awake = S.cats.filter(c => c.act && c.act.s !== 'sleep');
  if (awake.length){
    const c = awake[Math.floor(Math.random() * awake.length)];
    const pool = CHAT[bubbleKind] || CHAT.care;
    bus.emit('cat:say', { cat:c, text: pool[Math.floor(Math.random() * pool.length)] });
  }
  // 다른 창에서 일하는 중이면 데스크탑 알림으로
  if (notifOn && document.hidden && typeof Notification !== 'undefined'
      && Notification.permission === 'granted'){
    try { new Notification('Copycat 🐈', { body: text }); } catch(e){}
  }
  save();
}

function careTick(){
  if (!S) return;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const weekday = now.getDay() >= 1 && now.getDay() <= 5;
  const day = careDayOf();

  for (const b of CARE_BEATS){
    if (b.weekday && !weekday) continue;
    if (day.fired[b.id]) continue;
    if (mins >= b.at && mins < b.at + b.span){
      day.fired[b.id] = true;
      careSay(b.msg(), b.bubble);
    }
  }

  // 스트레칭 타이머 — 평일 근무 시간(점심 제외)에만 흐른다
  const working = weekday && mins >= WORK.start && mins < WORK.end
    && !(mins >= WORK.lunch && mins < WORK.lunchEnd);
  togetherTick(working);
  if (working){
    stretchAcc += 1;
    if (stretchAcc >= STRETCH_EVERY){
      stretchAcc = 0;
      const i = day.stretchIdx || 0;
      day.stretchIdx = (i + 1) % CARE_STRETCH.length;
      careSay(CARE_STRETCH[i]());
    }
  } else {
    stretchAcc = 0;
  }
}

/* ---------- 데스크탑 알림 (설정 모달에서 켠다) ---------- */
function notifEnabled(){ return notifOn; }
function setNotif(on, done){
  if (!on){
    notifOn = false;
    try { localStorage.setItem(NOTIF_KEY, '0'); } catch(e){}
    if (done) done(false);
    return;
  }
  if (typeof Notification === 'undefined'){
    toast(L({ ko:'이 브라우저는 알림을 지원하지 않습니다', en:'This browser does not support notifications', ja:'このブラウザは通知に対応していません' }));
    if (done) done(false);
    return;
  }
  Notification.requestPermission().then(p => {
    if (p === 'granted'){
      notifOn = true;
      try { localStorage.setItem(NOTIF_KEY, '1'); } catch(e){}
      toast(L({ ko:'🔔 창이 백그라운드일 때도 점심·휴식·퇴근을 알려드립니다',
                en:'🔔 You’ll get lunch, break and clock-out nudges even in the background',
                ja:'🔔 バックグラウンドでも昼休み・休憩・退勤をお知らせします' }), 'care', 4200);
    } else {
      notifOn = false;
      toast(L({ ko:'브라우저에서 알림이 차단되어 있습니다', en:'Notifications are blocked by the browser', ja:'ブラウザで通知がブロックされています' }));
    }
    if (done) done(notifOn);
  });
}

function careInit(){
  setInterval(careTick, 1000);
}
