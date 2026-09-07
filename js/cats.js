/* ============================================================
   cats.js — 고양이 = 자율 에이전트
   OpenMMO의 "agent-human parity"를 빌려왔다.
   고양이는 특권 API를 쓰지 않는다. 플레이어의 결재도, 고양이의 행동도
   전부 같은 월드 이벤트로 처리된다(bus.emit). 고양이는 그저
   "욕구 → 시설 탐색 → 길찾기 → 행동" 루프를 자기 힘으로 돈다.
   ============================================================ */

const NAMES = L({
  ko: ['치즈','나비','까망','두부','모카','호두','참치','간장','미역','설탕','양말','단추','뭉치','보리',
    '감자','콩이','루비','코코','바닐라','쿠키','젤리','반달','구름','초코','밤톨','수리','포도','시루','만두','댕구',
    '유자','팥죽','호박','땅콩','마요','깨비','흑임자','라떼','참깨','도토리'],
  en: ['Cheese','Whiskers','Sooty','Tofu','Mocha','Walnut','Tuna','Soy','Kelp','Sugar','Socks','Button','Fluffy','Barley',
    'Spud','Beans','Ruby','Coco','Vanilla','Cookie','Jelly','Luna','Cloudy','Choco','Chestnut','Scout','Grape','Crumpet','Dumpling','Waffles',
    'Yuzu','Azuki','Pumpkin','Peanut','Mayo','Pixie','Oreo','Latte','Sesame','Acorn'],
  ja: ['チーズ','たま','くろ','とうふ','モカ','くるみ','まぐろ','しょうゆ','わかめ','さとう','くつした','ぼたん','もこ','むぎ',
    'いも','まめ','ルビー','ココ','バニラ','クッキー','ゼリー','みかづき','くも','チョコ','くり','すばる','ぶどう','だんご','ぎょうざ','こむぎ',
    'ゆず','あずき','かぼちゃ','ピーナッツ','マヨ','おはぎ','ごま','ラテ','きなこ','どんぐり'],
});

/* 시트 색상 4종. 검정은 화면에서 존재감이 커서 덜 나오게 가중치를 준다. */
const FURS = [
  { n: L({ ko:'검정', en:'Black',  ja:'くろ'   }) },
  { n: L({ ko:'갈색', en:'Brown',  ja:'ちゃとら' }) },
  { n: L({ ko:'치즈', en:'Orange', ja:'チーズ' }) },
  { n: L({ ko:'백묘', en:'White',  ja:'しろ'   }) },
];
const FUR_POOL = [0, 1, 1, 1, 2, 2, 2, 3, 3];
/* 4색만으로는 20마리를 구분 못 하므로 CSS 색조 회전을 곁들인다.
   크게 돌리면 초록·분홍 고양이가 나오니 고양이로 읽히는 범위만 쓴다.
   190도는 회청색(러시안블루처럼)이 된다. 검정·백묘는 채도가 낮아 거의 안 변한다. */
const HUES = [0, 0, 0, 18, -18, 30, -28, 190];
/* 채용 화면에서 고를 수 있는 색조. HUES는 무작위 생성용이라 0이 중복 가중치로
   들어 있어서, 사람이 고를 목록은 중복을 뺀 6종으로 따로 둔다. */
const HUE_CHOICES = [
  { h:0,    n: L({ ko:'기본',   en:'Original', ja:'標準'   }) },
  { h:18,   n: L({ ko:'노란끼', en:'Warm',     ja:'黄み'   }) },
  { h:-18,  n: L({ ko:'붉은끼', en:'Rosy',     ja:'赤み'   }) },
  { h:30,   n: L({ ko:'금빛',   en:'Golden',   ja:'金色'   }) },
  { h:-28,  n: L({ ko:'적갈',   en:'Rust',     ja:'赤茶'   }) },
  { h:190,  n: L({ ko:'회청',   en:'Blue-grey',ja:'青灰'   }) },
];

/* ---------- 무늬 (TODO 73) ----------
   무늬는 **획 목록**이다. 획 하나 = { c: 색번호, r: 굵기, e: 지우개인가, p: [x,y,z, x,y,z, …] }
   이고 xyz 는 몸을 공 하나로 편 좌표계 위의 방향이다(js/three/facepaint.js).

   처음엔 동그라미 목록이었다(무늬 하나 = 방향 + 크기 + 색, 스물넷까지). 그건 그리는 게
   아니라 도장을 찍는 것이었고, 개수 상한이 곧 「몇 번 그릴 수 있나」였다. 이제 상한은
   셰이더에 없다 — 남은 상한은 **저장 크기** 하나뿐이고, 그건 아래 POINT_CAP 이다.

   색은 세 칸. 잉크 색이지 털색이 아니다 — 바탕은 그 고양이가 이미 가진 색 그대로다. */
const MARK_INKS = [
  L({ ko:'하양', en:'White', ja:'しろ' }),
  L({ ko:'갈색', en:'Brown', ja:'ちゃ' }),
  L({ ko:'검정', en:'Black', ja:'くろ' }),
];
/* 붓 굵기 셋. 제일 가는 것이 줄무늬 한 줄, 제일 굵은 것이 등의 얼룩 하나다.
   도장을 찍던 시절보다 전부 가늘다 — 이제 선을 긋는 붓이다. */
const MARK_SIZES = [0.085, 0.150, 0.260];
/* 한 마리가 들고 갈 수 있는 점의 총수. 사람이 만나는 벽이 아니라 **저장을 지키는 벽**이다
   (점 하나가 JSON 으로 20자 남짓이라 4000점이면 80KB, 스무 마리면 저장이 터진다).
   2분을 쉬지 않고 그어야 1000점쯤이므로 실제로는 안 닿는다. */
const MARK_POINT_CAP = 4000;

/* 저장에서 읽은 무늬를 믿지 않는다 — 남의 기기에서 온 저장·손으로 고친 저장이 있다.
   **옛 모양(동그라미 하나 = [x,y,z,크기,색])도 받는다**: 점 하나짜리 획으로 옮긴다. */
function normMarks(list){
  if (!Array.isArray(list)) return [];
  const out = [];
  let pts = 0;
  for (const m of list){
    let s = null;
    if (Array.isArray(m)){
      /* 옛 모양 — 도장 하나 */
      if (m.length < 5) continue;
      s = { c: m[4] | 0, r: +m[3] || 0.15, p: [+m[0] || 0, +m[1] || 0, +m[2] || 0] };
    } else if (m && Array.isArray(m.p)){
      s = { c: m.c | 0, r: +m.r || 0.15, p: m.p };
      if (m.e) s.e = 1;
    }
    if (!s) continue;
    const p = [];
    for (let i = 0; i + 2 < s.p.length; i += 3){
      const x = +s.p[i] || 0, y = +s.p[i + 1] || 0, z = +s.p[i + 2] || 0;
      const len = Math.hypot(x, y, z);
      if (!len) continue;
      p.push(+(x / len).toFixed(3), +(y / len).toFixed(3), +(z / len).toFixed(3));
    }
    if (!p.length) continue;
    pts += p.length / 3;
    if (pts > MARK_POINT_CAP) break;
    const o = { c: ((s.c % MARK_INKS.length) + MARK_INKS.length) % MARK_INKS.length,
                r: Math.max(0.02, Math.min(0.6, s.r)), p };
    if (s.e) o.e = 1;
    out.push(o);
  }
  return out;
}
const marksOf = c => (c && Array.isArray(c.marks)) ? c.marks : [];

/* ---------- 표정 ----------
   **눈과 입이 따로다.** 눈 열 × 입 여덟 = 여든 얼굴이고, 만든 사람도 못 본 조합이
   그 안에 있다 — 「얼굴 여섯 벌」을 목록으로 주는 것과 다른 물건이다.

   눈의 첫 칸 「그때그때」는 지금까지의 그것이다: 상태가 표정을 정한다(자면 감은 눈,
   놀면 반달, 일하면 뜬 눈). 그걸 고르면 한 글자도 안 달라진다 — 되돌릴 자리가 목록
   안에 있어야 고르는 것이 실험이 된다.

   모양(음함수·SDF)은 js/three/facepaint.js 가 들고 있고 여기는 이름만 있다.
   털색이 그런 것과 같은 나눔이다 — 색은 렌더러가, 이름은 여기가. */
const EYE_NAMES = [
  L({ ko:'그때그때', en:'By mood',   ja:'そのとき' }),   // -1
  L({ ko:'기본',     en:'Default',   ja:'ふつう'   }),   // 0
  L({ ko:'반달 눈',  en:'Happy',     ja:'にっこり' }),
  L({ ko:'졸린 눈',  en:'Sleepy',    ja:'うとうと' }),
  L({ ko:'시무룩',   en:'Glum',      ja:'しょんぼり' }),
  L({ ko:'동그란 눈',en:'Wide',      ja:'まんまる' }),
  L({ ko:'초롱초롱', en:'Sparkly',   ja:'きらきら' }),
  L({ ko:'별 눈',    en:'Star',      ja:'ほし'     }),
  L({ ko:'X 눈',     en:'X eyes',    ja:'ばたんきゅう' }),
  L({ ko:'찡긋',     en:'Wink',      ja:'ウインク' }),
];
const MOUTH_NAMES = [
  L({ ko:'기본',     en:'Default',   ja:'ふつう'   }),
  L({ ko:'미소',     en:'Smile',     ja:'ほほえみ' }),
  L({ ko:'활짝',     en:'Grin',      ja:'にぱー'   }),
  L({ ko:'놀람',     en:'Surprise',  ja:'おどろき' }),
  L({ ko:'동글 입',  en:'Round',     ja:'まるくち' }),
  L({ ko:'삐침',     en:'Pout',      ja:'ぶすっ'   }),
  L({ ko:'무표정',   en:'Blank',     ja:'むひょう' }),
  L({ ko:'없음',     en:'None',      ja:'なし'     }),
];
/* 저장에서 읽은 표정을 믿지 않는다. 옛 저장(얼굴 여섯 벌의 번호 하나)도 받아 옮긴다 —
   그 판정은 렌더러가 들고 있다(js/three/facepaint.js normFaceObj), 여기서 또 쓰지 않는다. */
function normFace(v){
  if (typeof R3 !== 'undefined' && R3 && R3.faceNorm) return R3.faceNorm(v);
  return (v && typeof v === 'object') ? { e: v.e | 0, m: v.m | 0 } : { e: -1, m: 0 };
}
const faceOf = c => normFace(c && c.face);
/* 「아무것도 안 고른 얼굴인가」 — 입구 문구가 이걸 읽는다 */
const faceSet = c => { const f = faceOf(c); return f.e >= 0 || f.m > 0; };

/* D&D식 6능력치. 이름만 사무직으로 갈아끼웠다. */
const STAT_KEYS = ['str','dex','con','int','wis','cha'];
const STAT_NAME = {
  str: L({ ko:'근성', en:'Grit',     ja:'根性' }),
  dex: L({ ko:'민첩', en:'Agility',  ja:'敏捷' }),
  con: L({ ko:'체력', en:'Stamina',  ja:'体力' }),
  int: L({ ko:'기획', en:'Planning', ja:'企画' }),
  wis: L({ ko:'눈치', en:'Tact',     ja:'察し' }),
  cha: L({ ko:'애교', en:'Charm',    ja:'愛嬌' }),
};
const STAT_DESC = {
  str: L({ ko:'서류를 많이 든다',   en:'Carries more documents',        ja:'書類をたくさん持てる' }),
  dex: L({ ko:'사무실을 빨리 돈다', en:'Gets around the office fast',   ja:'オフィスを速く回れる' }),
  con: L({ ko:'덜 지친다',          en:'Tires less',                    ja:'疲れにくい' }),
  int: L({ ko:'생산량의 핵심',      en:'The core of output',            ja:'生産量の要' }),
  wis: L({ ko:'욕구를 늦게 느낀다', en:'Feels needs later (patience)',  ja:'欲求を感じにくい（がまん強い）' }),
  cha: L({ ko:'동료 사기를 올린다', en:'Lifts coworker morale',         ja:'同僚の士気を上げる' }),
};

const RANKS = [
  { n: L({ ko:'인턴',   en:'Intern',       ja:'インターン' }), rate:0.30, cost:0      },
  { n: L({ ko:'사원',   en:'Staff',        ja:'社員'       }), rate:0.95, cost:90     },
  { n: L({ ko:'대리',   en:'Senior',       ja:'主任'       }), rate:3.0,  cost:290    },
  { n: L({ ko:'과장',   en:'Manager',      ja:'課長'       }), rate:9.5,  cost:950    },
  { n: L({ ko:'차장',   en:'Deputy Chief', ja:'次長'       }), rate:30,   cost:3100   },
  { n: L({ ko:'부장',   en:'Chief',        ja:'部長'       }), rate:96,   cost:10500  },
  { n: L({ ko:'이사',   en:'Executive',    ja:'取締役'     }), rate:310,  cost:36000  },
  { n: L({ ko:'대표냥', en:'CEO Cat',      ja:'代表ニャン' }), rate:1000, cost:130000 },
];

const TRAITS = [
  { id:'night',  n: L({ ko:'야근형',   en:'Night Owl',        ja:'夜勤型' }),
    d: L({ ko:'생산 +25%, 밤에도 일한다',      en:'Output +25%, works at night',            ja:'生産+25%、夜も働く' }),
    prod:1.25, decay:1.6, nocturnal:true },
  { id:'nap',    n: L({ ko:'낮잠형',   en:'Napper',           ja:'昼寝型' }),
    d: L({ ko:'생산 -12%, 욕구가 거의 안 준다', en:'Output −12%, needs barely drain',        ja:'生産−12%、欲求がほぼ減らない' }),
    prod:0.88, decay:0.40 },
  { id:'perf',   n: L({ ko:'완벽주의', en:'Perfectionist',    ja:'完璧主義' }),
    d: L({ ko:'결재 보상 +18%',                en:'Approval rewards +18%',                  ja:'決裁報酬+18%' }),
    prod:1.00, decay:1.0, bonusTodo:0.18 },
  { id:'social', n: L({ ko:'사교왕',   en:'Social Butterfly', ja:'社交家' }),
    d: L({ ko:'모든 동료 생산 +5%, 자주 논다',  en:'All coworkers +5%, plays often',         ja:'同僚全員の生産+5%、よく遊ぶ' }),
    prod:1.00, decay:1.2, teamProd:0.05, chatty:true },
  { id:'coffee', n: L({ ko:'커피중독', en:'Caffeine Fiend',   ja:'カフェイン中毒' }),
    d: L({ ko:'커피머신 있으면 생산 +40%',      en:'+40% output with a coffee machine',      ja:'コーヒーマシンがあれば生産+40%' }),
    prod:1.00, decay:1.1, needs:'coffee', ifOwned:0.40 },
  { id:'steady', n: L({ ko:'꾸준냥',   en:'Steady Paws',      ja:'コツコツ型' }),
    d: L({ ko:'생산 +8%, 욕구 감소 -20%',       en:'Output +8%, needs drain −20%',           ja:'生産+8%、欲求減少−20%' }),
    prod:1.08, decay:0.8 },
  { id:'lucky',  n: L({ ko:'행운냥',   en:'Lucky Cat',        ja:'招き猫' }),
    d: L({ ko:'가끔 어디선가 멸치를 주워온다',   en:'Sometimes finds anchovies somewhere',    ja:'たまにどこかで煮干しを拾ってくる' }),
    prod:1.00, decay:1.0, luck:true },
  { id:'boss',   n: L({ ko:'관리자냥', en:'Born Manager',     ja:'管理職ニャン' }),
    d: L({ ko:'전 직원 생산 +8%',               en:'All staff output +8%',                   ja:'全社員の生産+8%' }),
    prod:1.00, decay:1.0, teamProd:0.08 },
  { id:'sprint', n: L({ ko:'단거리형', en:'Sprinter',         ja:'短距離型' }),
    d: L({ ko:'이동 속도 +60%, 금방 지친다',     en:'Move speed +60%, tires fast',            ja:'移動速度+60%、すぐ疲れる' }),
    prod:1.00, decay:1.4, speed:1.6 },
];

const ACCS = ['tie','tie','glasses','headset','bow','none'];

/* ── 장비를 없앴다 (2026-09-03) ──
   머리·목·발 세 칸에 아홉 종을 끼우고 능력치가 오르는 체계가 있었다. 걷어냈다.

   왜: **아무도 안 열어 봤고, 열어 봐도 할 일이 없었다.** 아홉 종이 슬롯 셋에
   나뉘니 부위마다 셋이고, 그중 제일 좋은 것 하나가 정해져 있어서 고르는 순간이
   없었다. 고르는 게 아니면 그건 선택지가 아니라 **한 번 하고 마는 정리**다.
   그리고 이 게임의 능력치는 이미 입사 굴림(4d6)과 성격으로 갈리는데, 거기에
   +2 를 얹는 층을 하나 더 두면 두 층 다 흐릿해진다.

   겉모습도 안 바뀌게 만들어 뒀던 터라(「장비는 능력치에만 반영되고 겉모습은
   안 바뀝니다」) 눈에 보이지도 않았다. 보이지 않고, 고를 것도 없고, 열지도 않는
   체계다.

   남긴 것: **NPC 의 착용**(render3d.js 의 POLICE_EQUIP — 냥찰 모자). 그건 능력치가
   아니라 **누구인지**를 말하는 그림이라 성격이 다르다. 조형 쪽 setGear 도 그대로다. */

const CHAT = L({
  ko: {
    coffee:  ['커피 한 잔 하고 오겠다냥','카페인 없이는 못 산다','아메리카노 세 잔째'],
    sleep:   ['5분만 잔다냥','상자가 부른다','충전 중…zzz'],
    litter:  ['잠깐 다녀오겠다','실례 좀'],
    social:  ['어제 그 참치캔 봤어?','옆 팀 소문 들었냥?','정수기 앞에서 잠깐만','골골골'],
    lunch:   ['밥 먹으러 가자냥','오늘 급식은 참치라던데','12시는 못 참는다','점심 같이 갈 사람!','후식은 츄르다냥'],
    work:    ['일한다냥','키보드 따뜻해','이번 건은 내가 맡지'],
    stamp:   ['결재 완료!','도장 쾅','처리했다냥','한 건 끝'],
    idle:    ['냐앙…','창밖에 새가 있다','월급날 언제냥'],
    night:   ['야근이다…','다들 갔네','밤이 조용해서 좋다'],
    care:    ['쉬엄쉬엄 하자냥','기지개 쭉—','물 마시러 gogo','오늘도 잘하고 있다냥'],
    legal:   ['미처리 건 확인차 나왔습니다','소명 자료를 요청드립니다','이 건은 반려 처리하겠습니다','기한이 지났습니다'],
    police:  ['냥찰청 특별사법경찰입니다','협조 부탁드립니다','장부 좀 보겠습니다','발자국을 채증하겠습니다','상자 안도 확인하겠습니다'],
    scared:  ['저는 인턴인데요','아무것도 몰라요','캣닢은 제 게 아닙니다','저 그날 야근했는데요'],
  },
  en: {
    coffee:  ['Coffee run, be right back','Can’t live without caffeine','Third americano today'],
    sleep:   ['Just five minutes, nya','The box is calling','Recharging…zzz'],
    litter:  ['Be right back','Excuse me a sec'],
    social:  ['Did you see that tuna can?','Heard the rumor next team?','Quick chat by the cooler','Purrrr'],
    lunch:   ['Lunch time, let’s go','Heard it’s tuna today','No cat resists noon','Who’s in for lunch!','Churu for dessert, nya'],
    work:    ['Working, nya','Keyboard’s warm','I’ll take this one'],
    stamp:   ['Approved!','Stamp goes bam','Handled it','One down'],
    idle:    ['Nyaa…','There’s a bird outside','When’s payday, nya'],
    night:   ['Overtime again…','Everyone’s gone','The night is nice and quiet'],
    care:    ['Take it easy, nya','Biiig stretch—','Water break, go go','You’re doing fine today'],
    legal:   ['Here about the unresolved items','We request your written explanation','This one is being returned','The deadline has passed'],
    police:  ['Pawlice, Special Investigation Unit','Your cooperation, please','We’ll see the books now','Collecting pawprint evidence','We’ll check inside the boxes too'],
    scared:  ['I’m just an intern','I know nothing','The catnip isn’t mine','I was on overtime that day'],
  },
  ja: {
    coffee:  ['コーヒー飲んでくるにゃ','カフェインなしでは無理','アメリカーノ3杯目'],
    sleep:   ['5分だけ寝るにゃ','箱が呼んでいる','充電中…zzz'],
    litter:  ['ちょっと失礼','すぐ戻るにゃ'],
    social:  ['昨日のツナ缶見た？','隣のチームの噂、聞いた？','ウォーターサーバー前でちょっとだけ','ゴロゴロゴロ'],
    lunch:   ['ごはん行こうにゃ','今日はまぐろらしい','12時は我慢できない','ランチ行く人ー！','デザートはちゅーるにゃ'],
    work:    ['仕事するにゃ','キーボードがあったかい','この案件はもらった'],
    stamp:   ['決裁完了！','ハンコ、ドン','処理したにゃ','一件落着'],
    idle:    ['にゃーん…','窓の外に鳥がいる','給料日はまだかにゃ'],
    night:   ['残業だ…','みんな帰ったな','夜は静かでいい'],
    care:    ['ぼちぼちいこうにゃ','のび〜っ','お水タイム','今日もえらいにゃ'],
    legal:   ['未処理案件の確認に参りました','釈明資料をお願いします','この件は差し戻します','期限が過ぎています'],
    police:  ['ニャン察庁特別司法警察です','ご協力お願いします','帳簿を拝見します','足跡を採取します','箱の中も確認します'],
    scared:  ['ただのインターンです','何も知りません','マタタビは私のじゃない','あの日は残業でした'],
  },
});

/* ---------- 지금 하고 있는 일 ----------
   CHAT 은 **떠나면서** 하는 말이다("커피 한 잔 하고 오겠다냥"). 그래서 도착한 뒤로는
   화면이 조용해지고, 정수기 앞에 모인 다섯 마리가 수다를 떠는 건지 그냥 서 있는 건지
   알 방법이 없었다. 이 표는 **도착한 뒤**의 말이다 — 진행형이고, 끝에 「…」가 붙는다.

   새 장치를 만들지 않았다. 같은 말풍선(bus 의 cat:say → sayAt)을 그대로 쓴다 —
   머리 위에 글자가 뜨는 자리가 이미 하나 있는데 상태 표시를 위해 둘로 만들 이유가 없다.

   **social 이 둘이다.** 혼자 정수기 앞에 서 있는 것과 짝과 마주 보고 있는 것은 다른
   일이다(TODO 60). 혼자일 때 「그래서 말이야…」 라고 하면 그건 수다가 아니라 혼잣말이고,
   둘일 때 「잠깐 쉬는 중…」 이라고 하면 옆에 있는 냥이 안 보인다.
   어느 쪽을 쓸지는 짝이 있나(c._with)로 갈린다 — sim.js 의 chatKind.

   **가구별로 갈라 둔 칸이 있다.** 쓰임(use)만 보면 자동급식기 앞의 고양이가
   「커피 마시는 중」이라고 말하고(급식기의 use 가 coffee 다) CD 플레이어 앞에서
   「수다 중」이라고 말한다(use 가 social 이다). 쓰임은 시뮬레이션의 분류이고
   말풍선은 그 물건 앞에서 실제로 하는 일이라, 어긋나는 자리만 따로 적었다. */
const DOING = L({
  ko: {
    coffee:  ['커피 마시는 중…','한 모금 더…','카페인 충전 중…'],
    snack:   ['밥 먹는 중…','오물오물…','한 입만 더…'],
    sleep:   ['낮잠 자는 중…','골골골…','zzz…'],
    litter:  ['…잠깐만','볼일 보는 중…'],
    social:  ['한숨 돌리는 중…','골골골…','잠깐 쉬는 중…'],
    social2: ['그래서 말이야…','응, 응…','진짜? 그랬다냥?','우리끼리 하는 말인데…'],
    play:    ['노는 중…','한 번 더…','이게 제일 재밌다냥'],
    juke:    ['음악 듣는 중…','골골골…','이 곡 좋다냥'],
    game:    ['게임 중…','한 판만 더…','아, 졌다냥'],
    scratch: ['긁는 중…','발톱 다듬는 중…','여기가 제일 잘 긁힌다'],
    gym:     ['운동 중…','한 세트 더…','근육이 붙는 기분이다냥'],
    meeting: ['회의 중…','그건 다음 분기에…','일단 적어 두겠다냥'],
    plant:   ['냄새 맡는 중…','잎사귀 씹는 중…','흙 파는 중…'],
  },
  en: {
    coffee:  ['sipping coffee…','one more sip…','recharging caffeine…'],
    snack:   ['eating…','nom nom…','one more bite…'],
    sleep:   ['napping…','purrrr…','zzz…'],
    litter:  ['…just a sec','occupied…'],
    social:  ['taking a breather…','purrrr…','resting a moment…'],
    social2: ['so anyway…','mhm, mhm…','really? no way','just between us…'],
    play:    ['playing…','one more go…','this is the best, nya'],
    juke:    ['listening…','purrrr…','good track, nya'],
    game:    ['gaming…','one more round…','ah, lost again'],
    scratch: ['scratching…','filing my claws…','best spot in the office'],
    gym:     ['working out…','one more set…','feeling the gains, nya'],
    meeting: ['in a meeting…','let’s table that…','noting it down, nya'],
    plant:   ['sniffing…','chewing a leaf…','digging the soil…'],
  },
  ja: {
    coffee:  ['コーヒー飲んでる…','もう一口…','カフェイン充填中…'],
    snack:   ['ごはん中…','もぐもぐ…','もう一口だけ…'],
    sleep:   ['お昼寝中…','ゴロゴロゴロ…','zzz…'],
    litter:  ['…ちょっと待って','用を足し中…'],
    social:  ['ひと息ついてる…','ゴロゴロゴロ…','ちょっと休憩中…'],
    social2: ['それでね…','うん、うん…','ほんとに？','ここだけの話…'],
    play:    ['遊んでる…','もう一回…','これが一番楽しいにゃ'],
    juke:    ['音楽聴いてる…','ゴロゴロゴロ…','この曲いいにゃ'],
    game:    ['ゲーム中…','あと一回だけ…','あー、負けたにゃ'],
    scratch: ['爪とぎ中…','爪を整えてる…','ここが一番とぎやすい'],
    gym:     ['筋トレ中…','あと1セット…','筋肉がつく気がするにゃ'],
    meeting: ['会議中…','それは来期に…','とりあえずメモするにゃ'],
    plant:   ['匂いを嗅いでる…','葉っぱを噛んでる…','土を掘ってる…'],
  },
});
/* ---------- 올린 결재를 맡아서 하는 말 ----------
   `{t}` 자리에 **사람이 적은 그 글**이 들어간다(「빨래개기」 하는 중…). 다른 말풍선과
   다른 점이 하나 있다: 이 줄만 플레이어가 쓴 문장을 되읽는다. 그래서 「일한다냥」이
   백 번 도는 것과 달리, 이 말은 **내가 올린 것을 저 고양이가 지금 하고 있다**가 된다.

   맡는 순간(TASK_TAKE)과 하는 중(TASK)을 나눈다 — 올리자마자 「하는 중…」이 뜨면
   가지러 오는 장면이 없어지고, 결재함이 그냥 진행바가 된다. */
const TASK = L({
  ko: ['「{t}」 하는 중…','「{t}」 처리 중…','「{t}」… 조금만 더','「{t}」 보고 있다냥','「{t}」 거의 다 됐다'],
  en: ['working on “{t}”…','handling “{t}”…','“{t}”… almost there','looking at “{t}”','“{t}” nearly done'],
  ja: ['「{t}」やってる中…','「{t}」処理中…','「{t}」…もう少し','「{t}」見てるにゃ','「{t}」もうすぐ終わる'],
});
const TASK_TAKE = L({
  ko: ['「{t}」… 내가 맡지','「{t}」 가져간다냥','「{t}」 이건 내 거다','「{t}」 접수'],
  en: ['“{t}”… I’ll take it','taking “{t}”, nya','“{t}” is mine','“{t}” received'],
  ja: ['「{t}」…引き受けるにゃ','「{t}」持っていくにゃ','「{t}」これは僕のだ','「{t}」受付'],
});

/* 쓰임이 거짓말을 하는 가구만. 나머지는 TILE_INFO 의 use 를 그대로 쓴다. */
const DOING_TILE = {
  [TILE.JUKE]:    'juke',
  [TILE.SCRATCH]: 'scratch',
  [TILE.GYM]:     'gym',
  [TILE.MEETING]: 'meeting',
  [TILE.PLANT]:   'plant',
  [TILE.FEEDER]:  'snack',
  [TILE.SNACK]:   'snack',
  [TILE.GAME]:    'game',
};

function d6(){ return 1 + Math.floor(Math.random()*6); }
/* 4d6 중 최저 1개 버리기 — OpenMMO(그리고 D&D)의 캐릭터 생성 규칙 */
function roll4d6(){
  const r = [d6(), d6(), d6(), d6()].sort((a,b)=>a-b);
  return r[1] + r[2] + r[3];
}
function rollStats(){
  const s = {};
  STAT_KEYS.forEach(k => s[k] = roll4d6());
  return s;
}

/* ---------- 개인 기록부 ----------
   고양이가 능력치 뭉치로만 남으면 정이 안 붙는다. 정이 붙는 건 이력이 있는 개체다.
   그래서 한 마리마다 이력을 쌓아 둔다. 다만 이건 저장에 매번 실리는 데이터라
   칸을 최소로 잡았다 — 숫자 몇 개와 짧은 문자열 하나가 전부다.
     q     입사 분기 (0 = 기록부가 생기기 전에 입사)
     docs  처리한 서류 수, 크기별
     det   구금 횟수 · detQ 마지막 구금 분기
     fac   시설 이용 횟수, 타일 번호를 키로 (이름은 TILE_INFO가 이미 3개 국어로 갖고 있다)
     first 첫 결재 { q, t } */
function normRecord(r){
  const d = (r && r.docs) || {};
  return {
    q:     (r && r.q)     || 0,
    docs:  { s: d.s || 0, m: d.m || 0, l: d.l || 0 },
    det:   (r && r.det)   || 0,
    detQ:  (r && r.detQ)  || 0,
    fac:   (r && r.fac)   || {},
    first: (r && r.first) || null,
  };
}
const newRecord = q => { const r = normRecord(null); r.q = q; return r; };
/* 기록부를 꺼낸다. 없으면 그 자리에서 만든다 — 옛 저장을 절대 터뜨리지 않는다.
   입사 분기는 모르는 채로 두는 게 맞다. 없던 이력을 지어내지 않는다. */
const recOf = c => c.rec || (c.rec = newRecord(0));
/* 가장 자주 간 시설. 한 번도 안 갔으면 null */
function recTopFac(c){
  const f = recOf(c).fac;
  let tile = null, n = 0;
  for (const k in f) if (f[k] > n){ n = f[k]; tile = +k; }
  return tile == null ? null : { tile, n };
}

/* 사내에 같은 이름이 둘 있으면 헷갈리므로 안 쓰는 이름을 고른다 */
function uniqueName(){
  const roster = (typeof S !== 'undefined' && S)
    ? (S.cats || []).concat((S.jail || []).map(j => j.cat)) : [];
  const used = new Set(roster.map(c => c.name));
  const pool = NAMES.filter(n => !used.has(n));
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + (used.size + 1);
}

function newCat(seedName){
  const t = TRAITS[Math.floor(Math.random()*TRAITS.length)];
  return {
    id: 'c' + Math.random().toString(36).slice(2, 9),
    name: seedName || uniqueName(),
    fur: FUR_POOL[Math.floor(Math.random()*FUR_POOL.length)],
    hue: HUES[Math.floor(Math.random()*HUES.length)],
    acc: ACCS[Math.floor(Math.random()*ACCS.length)],
    trait: t.id,
    rank: 0,
    stats: rollStats(),
    equip: { head:null, neck:null, paw:null },
    needs: { energy:100, fun:100, caffeine:100, bladder:100 },
    // 입사 분기는 여기서 임시로 찍고, 실제 채용 시점에 hire()가 다시 찍는다
    // (지원자는 채용될 때까지 문 앞에서 몇 분기고 기다릴 수 있다)
    rec: newRecord(typeof S !== 'undefined' && S ? S.quarter : 1),
    // 시뮬 상태
    x: 1, y: 1, deskIdx: -1,
    act: { s:'idle', t:0, path:null, pi:0, target:null, use:null },
    doc: null,
    _bubble: 0,
  };
}

/* 1번 사원 = 프롤로그의 "나" = 플레이어다. 이 냥은 **처음부터 사장으로 고정**이다.
   직급 사다리(RANKS)를 타지 않으므로 표시는 늘 「대표」다. 경제는 그대로 RANKS 를
   쓰는데(대표라고 초당 1000마리를 벌면 게임이 끝난다), 올리는 행위의 이름만 다르다 —
   대표는 승진하는 게 아니라 자기 몫을 올린다. */
const BOSS_TITLE = L({ ko:'대표', en:'Boss', ja:'社長' });
const BOSS_RAISE = L({ ko:'내 몫 인상', en:'Raise own cut', ja:'自分の取り分' });
function rankName(c){
  if (c && c.founder) return BOSS_TITLE;
  return RANKS[Math.min((c && c.rank) || 0, RANKS.length - 1)].n;
}
/* 대표는 한 마리뿐이다. 다른 냥은 **이사까지**(마지막 직급 하나 아래) 올라간다 —
   플레이어 고양이를 사장으로 고정해 놓고 직원도 대표냥이 되면 그 고정이 무의미하다.
   상한을 여기 한 곳에 두고, 승진 버튼·비용·처리가 전부 nextRank 만 본다. */
const rankCap = c => (c && c.founder) ? RANKS.length - 1 : RANKS.length - 2;
const nextRank = c => {
  const i = ((c && c.rank) | 0) + 1;
  return i <= rankCap(c) ? RANKS[i] : null;
};

function traitOf(c){ return TRAITS.find(t => t.id === c.trait) || TRAITS[0]; }

/* 능력치는 **입사 때 굴린 값 그대로**다. 장비로 올리는 층은 없앴다(위 머리말).
   함수는 남긴다 — 부르는 데가 많고, 나중에 성격이나 직급이 여기 얹힐 자리다. */
function statOf(c, k){ return c.stats[k] || 10; }
const mod = v => (v - 10) / 2;   // D&D 능력 보정치

function moodOf(c, hasCoffee){
  const n = c.needs;
  return hasCoffee
    ? n.energy*0.34 + n.fun*0.27 + n.bladder*0.19 + n.caffeine*0.20
    : (n.energy*0.42 + n.fun*0.34 + n.bladder*0.24);
}

/* 렌더링은 sprite.js가 담당한다 (도트 스프라이트) */
