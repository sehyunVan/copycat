/* ============================================================
   story.js — 가구를 눌러 조사한다. 그리고 거기서 이야기가 샌다.

   ── 왜 이게 필요했나 ──

   [`STORY.md`](../STORY.md) 의 설계 원칙은 하나다: **새 UI 를 만들지 않고 이미 있는
   시스템의 표시 문구에 단서를 얹는다.** 분기 결산·사보·인사 기록이 그 자리였다.

   그런데 그 방식으로는 못 하는 게 하나 있었다 — **찾는 것.** 결산에 실리는 단서는
   배달되는 것이고, 배달된 이야기는 읽히긴 해도 발견되지는 않는다. 프롤로그의
   마지막 문장이 "**서랍은 아직 열지 마십시오**"인 게임에서, 서랍을 여는 행위가
   없다는 건 이야기의 절반이 비어 있다는 뜻이다.

   그래서 조사를 붙인다. 원칙은 그대로 지킨다:

   · **새 시스템이 아니다.** 격자는 이미 있고, 칸을 집는 것도 이미 있다
     (배치 모드가 쓰는 unitAt · editTileFromEvent 를 그대로 쓴다).
   · **대부분은 한 줄 관찰이다.** 전부에 이야기를 붙이면 사무실이 위키가 된다.
     스물 몇 개 중 여덟 개만 무언가를 갖고 있고, 나머지는 그냥 사무실이다.
   · **단서는 분기로 열리고 한 번만 나온다.** 반복 클릭이 뽑기가 되면 사무실이 슬롯머신이다.
   · **말은 안 한다, 흘린다.** 발견 문구는 사실만 적는다. 뜻은 나중에 알게 된다
     (STORY.md 톤 규칙 3).

   그리고 조사에서 나오는 물건이 하나 더 있다 — **테이프.** 살 수 없고, 목록에 있는
   줄도 모른다. 주우면 쥬크박스에 한 곡이 는다 (juke.js · music.js).
   ============================================================ */

/* ---------- 한 줄 관찰 ----------
   난수를 안 쓴다. 같은 가구를 두 번 눌렀는데 다른 말이 나오면 그건 관찰이 아니라 뽑기다.
   여러 줄인 것은 **격자 좌표로** 고른다 — 사무실에 커피머신이 둘이면 서로 다른 말을 한다. */
const LOOK = {
  [TILE.DESK]: [
    L({ ko:'모서리에 잔 자국이 겹쳐 있다. 늘 같은 자리에 놓는 모양이다.',
        en:'Overlapping mug rings on one corner. Somebody always puts it down in the same place.',
        ja:'角にカップの輪染みが重なっている。いつも同じ場所に置くらしい。' }),
    L({ ko:'서랍이 하나 있다. 잘 안 열린다.',
        en:'There is a drawer. It does not open easily.',
        ja:'引き出しがひとつ。うまく開かない。' }),
  ],
  [TILE.INBOX]: [
    L({ ko:'바닥에 도장밥이 말라붙어 있다. 색이 지금 쓰는 것보다 진하다.',
        en:'Dried ink pad at the bottom. Darker than the one in use now.',
        ja:'底に朱肉が乾いてこびりついている。今使っているものより濃い。' }),
  ],
  [TILE.BED]: [
    L({ ko:'안쪽에 털이 눌린 자국. 크기가 우리 직원 누구와도 안 맞는다.',
        en:'A pressed-down patch of fur inside. It doesn’t match the size of anyone here.',
        ja:'内側に毛の押しつぶされた跡。うちの誰のサイズとも合わない。' }),
  ],
  [TILE.LITTER]: [
    L({ ko:'모래가 새것이다. 아무도 안 챙겼는데 새것이다.',
        en:'The litter is fresh. Nobody topped it up, and it is fresh.',
        ja:'砂が新しい。誰も入れていないのに新しい。' }),
  ],
  [TILE.COOLER]: [
    L({ ko:'물통 옆면에 유성펜으로 그은 눈금. 회사 비품에 눈금을 긋는 사람이 있었다.',
        en:'Marker lines up the side of the bottle. Somebody used to gauge the water.',
        ja:'ボトルの側面に油性ペンの目盛り。水位を測っていた誰かがいる。' }),
    L({ ko:'컵이 하나 더 있다. 쓰는 사람을 본 적은 없다.',
        en:'There is one extra cup. Nobody has ever been seen using it.',
        ja:'コップがひとつ余っている。使っている者を見たことがない。' }),
  ],
  [TILE.PLANT]: [
    L({ ko:'물을 준 기억이 없는데 살아 있다.',
        en:'No record of anyone watering it. It is alive anyway.',
        ja:'水をやった覚えがないのに生きている。' }),
  ],
  [TILE.COFFEE]: [
    L({ ko:'세척 알림이 12년 밀려 있다. 그래도 나온다.',
        en:'The cleaning reminder is twelve years overdue. It still brews.',
        ja:'洗浄アラートが12年滞っている。それでも出る。' }),
    L({ ko:'컵 놓는 자리에 딱 한 곳만 색이 바랬다.',
        en:'One spot on the drip tray is bleached paler than the rest.',
        ja:'カップ受けの一箇所だけ色が抜けている。' }),
  ],
  [TILE.COPIER]: [
    L({ ko:'급지함에 종이가 한 장 끼어 있다. 뒷면이 인쇄된 이면지다.',
        en:'One sheet jammed in the tray — scrap paper, already printed on the back.',
        ja:'給紙トレイに一枚挟まっている。裏面に印刷済みの反故紙だ。' }),
  ],
  [TILE.TOWER]: [
    L({ ko:'꼭대기 판자만 유난히 반들거린다. 오래 앉은 자리다.',
        en:'The top board alone is worn smooth. Someone sat there a long time.',
        ja:'一番上の板だけがつるつるだ。長く座っていた場所。' }),
  ],
  [TILE.SCRATCH]: [
    L({ ko:'왼쪽만 닳았다. 다들 오른쪽에서 긁는데.',
        en:'Only the left side is worn down. Everyone here scratches on the right.',
        ja:'左側だけ擦り減っている。みんな右で研ぐのに。' }),
  ],
  [TILE.SERVER]: [
    L({ ko:'제일 따뜻한 자리에 아무도 없다. 늘 비어 있다.',
        en:'The warmest spot is empty. It is always empty.',
        ja:'一番暖かい場所が空いている。いつも空いている。' }),
  ],
  [TILE.FEEDER]: [
    L({ ko:'예약 시각이 하나 더 걸려 있다. 22시 40분. 아무도 안 걸었다.',
        en:'There is an extra feeding time programmed. 22:40. Nobody set it.',
        ja:'給餌時刻がもうひとつ設定されている。22:40。誰も設定していない。' }),
  ],
  [TILE.MEETING]: [
    L({ ko:'의자가 자리 수보다 하나 많다.',
        en:'One more chair than there are seats.',
        ja:'椅子が席の数より一脚多い。' }),
  ],
  [TILE.GYM]: [
    L({ ko:'중량 핀이 제일 무거운 칸에 꽂혀 있다. 우리 중엔 그걸 드는 냥이 없다.',
        en:'The pin is in the heaviest slot. Nobody here lifts that.',
        ja:'ピンが一番重い段に挿さっている。うちに持ち上げられる者はいない。' }),
  ],
  [TILE.LAB]: [
    L({ ko:'수율 기록장 첫 장이 뜯겨 있다. 둘째 장은 2쪽부터 시작한다.',
        en:'The first page of the yield log is torn out. The second page starts at “2”.',
        ja:'収率記録の1枚目が破り取られている。2枚目は「2」から始まる。' }),
  ],
  [TILE.ROCKET]: [
    L({ ko:'좌석이 하나다. 사보에는 늘 「전 직원」이라고 적혀 있었다.',
        en:'One seat. The newsletter always said “all staff”.',
        ja:'座席はひとつ。社報にはいつも「全社員」と書いてあった。' }),
  ],
  [TILE.WHITEBOARD]: [
    L({ ko:'지워도 안 지워지는 글씨가 한 줄 남아 있다. 날짜만 읽힌다.',
        en:'One line refuses to wipe off. Only a date is legible.',
        ja:'消しても消えない一行が残っている。日付だけが読める。' }),
  ],
  [TILE.LEGAL]: [
    L({ ko:'명함꽂이가 비어 있다. 청구서는 매번 정확히 온다.',
        en:'The card holder is empty. The invoices arrive on time regardless.',
        ja:'名刺入れは空だ。請求書は毎回きっちり届く。' }),
  ],
  [TILE.DECOR]: [
    L({ ko:'액자 뒤 벽지만 색이 안 바랬다. 오래 걸려 있었다.',
        en:'The wallpaper behind it hasn’t faded. It has hung here a long time.',
        ja:'額の裏の壁紙だけ色あせていない。長く掛かっていた。' }),
  ],
  [TILE.SHELF]: [
    L({ ko:'분류 라벨이 우리 서식과 다르다. 더 옛날 서식이다.',
        en:'The filing labels don’t match our forms. They are an older format.',
        ja:'分類ラベルがうちの書式と違う。もっと古い書式だ。' }),
  ],
  [TILE.PERCH]: [
    L({ ko:'제일 위 칸에는 아무것도 안 올려져 있다. 손이 안 닿는 높이도 아닌데.',
        en:'Nothing on the top shelf. It isn’t out of reach either.',
        ja:'一番上の棚には何も載っていない。手が届かない高さでもないのに。' }),
  ],
  [TILE.HAMMOCK]: [
    L({ ko:'천이 한쪽으로만 늘어나 있다. 늘 같은 방향으로 누웠다는 뜻이다.',
        en:'The fabric has stretched to one side only — always lain in the same direction.',
        ja:'布が片側にだけ伸びている。いつも同じ向きで寝ていたということだ。' }),
  ],
  [TILE.SNACK]: [
    L({ ko:'맨 아래 칸 하나만 늘 비어 있다. 채워 놔도 다음 날 비어 있다.',
        en:'The bottom slot is always empty. Refill it and it is empty again next day.',
        ja:'一番下の段だけいつも空だ。補充しても翌日には空になっている。' }),
  ],
  [TILE.YARN]: [
    L({ ko:'실 끝이 깔끔하게 잘려 있다. 물어뜯은 게 아니다.',
        en:'The yarn end is cut clean. Not bitten.',
        ja:'糸の端がきれいに切れている。噛みちぎった跡ではない。' }),
  ],
  [TILE.TOY]: [
    L({ ko:'깃털이 한 가닥 짧다. 누가 뽑아서 어딘가에 꽂아 뒀다는 뜻이다.',
        en:'One feather is missing. Somebody pulled it and put it somewhere.',
        ja:'羽が一本足りない。誰かが抜いてどこかに挿したということだ。' }),
  ],
  [TILE.GAME]: [
    L({ ko:'최고 점수 칸에 세 글자가 남아 있다. 우리 중에 그 이름은 없다.',
        en:'Three initials sit in the high-score slot. Nobody here has that name.',
        ja:'ハイスコア欄に三文字が残っている。うちにその名前の者はいない。' }),
  ],
  [TILE.WINDOW]: [
    L({ ko:'안쪽 유리에 코 자국이 있다. 우리 키보다 높다.',
        en:'A nose print on the inside of the glass. Higher than any of us.',
        ja:'内側のガラスに鼻の跡。うちの誰より高い位置だ。' }),
  ],
  [TILE.CLOCK]: [
    L({ ko:'건전지가 안 들어 있다. 그런데 맞는 시각을 가리키고 있다.',
        en:'No battery in it. It shows the correct time anyway.',
        ja:'電池が入っていない。それでも正しい時刻を指している。' }),
  ],
  [TILE.WALLSHELF]: [
    L({ ko:'먼지가 안 앉은 사각형이 하나 있다. 뭔가 치웠다.',
        en:'A dust-free rectangle. Something was taken off this shelf.',
        ja:'埃のない四角がひとつ。何かがどけられている。' }),
  ],
  [TILE.CATWALK]: [
    L({ ko:'못 자국이 두 배로 많다. 한 번 떼었다가 다시 달았다.',
        en:'Twice as many nail holes as nails. It came down once and went back up.',
        ja:'釘穴が釘の倍ある。一度外して、また付け直している。' }),
  ],
};

/* ---------- 단서 ----------
   q     이 분기부터 나온다. **STORY.md 배치표의 박자를 따라간다** —
         Q1(서랍)과 Q3(상자)은 그 표의 두 줄을 그대로 구현한 것이고, 나머지는 표가
         이미 예약해 둔 분기(Q6·Q10·Q15·Q21·Q28)와 안 겹치는 자리에 둔다.
         한 분기에 둘이 열리면 그건 떡밥이 아니라 배급이다
   tiles 어느 가구에 들어 있나. 사무실마다 가구가 다르므로 여러 개를 허용한다
   track 같이 딸려 오는 곡 (music.js) — **테이프**는 이 필드가 있는 항목이다
   in    발견 문구. 사실만 적는다. 뜻은 나중에 알게 된다 */
const CLUES = [
  { id:'drawer', q:1, em:'🪪', tiles:[TILE.DESK, TILE.DESK_R],
    where: L({ ko:'책상 서랍', en:'The desk drawer', ja:'デスクの引き出し' }),
    n: L({ ko:'찢어진 근무 기록증 반쪽', en:'Half a torn time card', ja:'破れた勤務記録証の片割れ' }),
    in: L({
      ko:'서랍은 잠겨 있지 않았다. 걸려 있었을 뿐이다.<br><br>'
       + '안에는 <b>근무 기록증 반쪽</b>이 있다. 세로로 찢겼고, 이름이 적혀 있던 쪽이 없다. '
       + '남은 쪽에는 숫자만 찍혀 있다 — <b>412일</b>.<br><br>'
       + '우리 회사 서식이다. 지금 쓰는 것과 글자체까지 같다.',
      en:'The drawer wasn’t locked. It was just stuck.<br><br>'
       + 'Inside is <b>half a time card</b>, torn lengthways. The half with the name is gone. '
       + 'What is left carries only a number — <b>412 days</b>.<br><br>'
       + 'It is our form. Same typeface as the ones we print now.',
      ja:'引き出しは施錠されていなかった。引っかかっていただけだ。<br><br>'
       + '中には<b>勤務記録証の片割れ</b>。縦に破れていて、名前の側がない。'
       + '残った側にあるのは数字だけ——<b>412日</b>。<br><br>'
       + 'うちの書式だ。今使っているものと字体まで同じ。' }) },

  { id:'tape1', q:2, em:'📼', tiles:[TILE.SHELF, TILE.WALLSHELF, TILE.COPIER], track:'boot',
    where: L({ ko:'선반 뒤쪽', en:'Behind the shelf', ja:'棚の奥' }),
    n: L({ ko:'라벨 없는 카세트', en:'An unlabelled cassette', ja:'ラベルのないカセット' }),
    in: L({
      ko:'서류 뒤에 <b>카세트</b>가 한 개 세워져 있다. 라벨 자리는 비어 있고, 대신 '
       + '테이프 몸통에 볼펜으로 「<b>야근용</b>」이라고 적혀 있다.<br><br>'
       + '틀어 보니 박자가 있는 칩튠이다. 앰비언트가 아니다.',
      en:'A <b>cassette</b> stood upright behind the files. The label is blank; instead, '
       + '“<b>for overtime</b>” is written on the shell in ballpoint.<br><br>'
       + 'Played back, it is chiptune with an actual clock in it. Not ambient.',
      ja:'書類の裏に<b>カセット</b>が一本立ててある。ラベルは空白で、代わりに'
       + '本体にボールペンで「<b>残業用</b>」と書いてある。<br><br>'
       + 'かけてみると拍のあるチップチューンだ。アンビエントではない。' }) },

  { id:'bell', q:8, em:'🔔', tiles:[TILE.PLANT],
    where: L({ ko:'화분 흙 속', en:'In the soil', ja:'鉢の土の中' }),
    n: L({ ko:'묻혀 있던 방울', en:'A buried bell', ja:'埋まっていた鈴' }),
    in: L({
      ko:'흙에 반쯤 묻혀 <b>방울</b>이 하나 있다. 목줄은 없고 방울만이다.<br><br>'
       + '집어 들자 소리가 났다. 어디서 들어 본 소리다 — 그런데 <b>언제</b> 들었는지가 안 떠오른다.',
      en:'Half-buried in the soil, a single <b>bell</b>. No collar, just the bell.<br><br>'
       + 'It rang when picked up. A familiar sound — though <b>when</b> it was heard won’t come back.',
      ja:'土に半分埋まって<b>鈴</b>がひとつ。首輪はなく、鈴だけだ。<br><br>'
       + '拾い上げると鳴った。聞き覚えのある音だ——ただ、<b>いつ</b>聞いたのかが思い出せない。' }) },

  { id:'tape2', q:5, em:'📼', tiles:[TILE.BED, TILE.TOWER, TILE.HAMMOCK], track:'squeak',
    where: L({ ko:'쿠션 밑', en:'Under the cushion', ja:'クッションの下' }),
    n: L({ ko:'씹힌 자국이 있는 테이프', en:'A chewed-up tape', ja:'噛み跡のあるテープ' }),
    in: L({
      ko:'쿠션을 들추자 <b>테이프</b>가 나온다. 모서리에 이빨 자국이 있다.<br><br>'
       + '녹음된 건 리코더 연습이다. 계속 삑사리가 나는데, 끝까지 안 멈춘다.',
      en:'Lifting the cushion turns up a <b>tape</b>, tooth marks along one edge.<br><br>'
       + 'What’s on it is recorder practice. It keeps squeaking, and it never once stops.',
      ja:'クッションをめくると<b>テープ</b>が出てくる。角に歯形がある。<br><br>'
       + '録音されているのはリコーダーの練習だ。ひっくり返り続けるのに、最後まで止めない。' }) },

  { id:'box', q:3, em:'📦', tiles:[TILE.LITTER, TILE.SHELF, TILE.SNACK],
    where: L({ ko:'아무도 안 싼 상자', en:'A box nobody packed', ja:'誰も詰めていない箱' }),
    n: L({ ko:'검게 지워진 라벨', en:'A blacked-out label', ja:'黒く塗られたラベル' }),
    in: L({
      ko:'이사 때마다 같이 오는 <b>상자</b>가 하나 있다. 아무도 싸지 않았고 아무도 안 풀었다.<br><br>'
       + '라벨의 이름 칸은 <b>유성펜으로 검게 지워져</b> 있다. 그 아래 부서 칸은 그대로다 — '
       + '「총무」.',
      en:'One <b>box</b> comes along with every move. Nobody packed it and nobody has opened it.<br><br>'
       + 'The name on the label is <b>blacked out in marker</b>. The line under it is untouched — '
       + '“Admin”.',
      ja:'引っ越しのたびに一緒に来る<b>箱</b>がひとつある。誰も詰めておらず、誰も開けていない。<br><br>'
       + 'ラベルの名前欄は<b>油性ペンで黒く塗りつぶされて</b>いる。その下の部署欄はそのままだ——'
       + '「総務」。' }) },

  { id:'stamp', q:12, em:'📥', tiles:[TILE.INBOX],
    where: L({ ko:'결재함 바닥', en:'The bottom of the inbox', ja:'決裁箱の底' }),
    n: L({ ko:'처리자가 없는 결재', en:'An approval with no approver', ja:'処理者のいない決裁' }),
    in: L({
      ko:'바닥에 눌어붙은 <b>옛 서류</b>가 한 장 있다. 우리가 쓰는 서식이다.<br><br>'
       + '처리자 서명란은 <b>비어 있는데 도장은 찍혀 있다.</b> 도장 글자는 「승인」이 아니라 '
       + '「<b>보류</b>」다. 날짜는 안 적혀 있다.',
      en:'One <b>old sheet</b> stuck to the bottom. Our form.<br><br>'
       + 'The approver line is <b>blank, but it has been stamped.</b> The stamp does not read '
       + '“Approved” — it reads “<b>Held</b>”. There is no date.',
      ja:'底に<b>古い書類</b>が一枚こびりついている。うちの書式だ。<br><br>'
       + '処理者の署名欄は<b>空なのに判が押されている。</b>判の文字は「承認」ではなく'
       + '「<b>保留</b>」。日付は書かれていない。' }) },

  { id:'tally', q:17, em:'✏️', tiles:[TILE.TOWER, TILE.PERCH, TILE.CATWALK, TILE.HAMMOCK],
    where: L({ ko:'판자 밑면', en:'The underside of the board', ja:'板の裏側' }),
    n: L({ ko:'세다 만 정(正)자', en:'Tally marks, abandoned', ja:'途中でやめた正の字' }),
    in: L({
      ko:'올라앉는 판자 <b>밑면</b>에 손톱으로 그은 <b>정(正)자</b>가 줄줄이 있다. '
       + '거기 앉은 냥만 볼 수 있는 자리다.<br><br>'
       + '중간부터 간격이 넓어지고, 마지막 한 획은 그어지다 말았다.',
      en:'On the <b>underside</b> of the perch board, rows of <b>tally marks</b> scratched in with a claw. '
       + 'Only whoever sits there can see them.<br><br>'
       + 'Partway through, the spacing widens. The last stroke stops halfway.',
      ja:'座る板の<b>裏側</b>に、爪で刻んだ<b>正の字</b>がずらりと並んでいる。'
       + 'そこに座った者にしか見えない場所だ。<br><br>'
       + '途中から間隔が広くなり、最後の一画は引きかけで止まっている。' }) },

  { id:'note', q:22, em:'🕐', tiles:[TILE.CLOCK, TILE.DECOR, TILE.WHITEBOARD],
    where: L({ ko:'벽에 걸린 것 뒤', en:'Behind the thing on the wall', ja:'壁掛けの裏' }),
    n: L({ ko:'다음 사람에게', en:'For whoever comes next', ja:'次の人へ' }),
    in: L({
      ko:'벽에서 떼어 뒤집자 연필로 한 줄이 적혀 있다.<br><br>'
       + '「<b>다음 사람에게 — 이건 그냥 두세요. 시각은 맞습니다.</b>」<br><br>'
       + '글씨가 낡았다. 잉크가 아니라 연필이라 번지지도 않았다.',
      en:'Taken off the wall and turned over, one line in pencil.<br><br>'
       + '“<b>For whoever comes next — leave this one alone. The time is right.</b>”<br><br>'
       + 'The writing is old. Pencil, not ink, so nothing has bled.',
      ja:'壁から外して裏返すと、鉛筆で一行。<br><br>'
       + '「<b>次の人へ——これはそのままにしておいてください。時刻は合っています。</b>」<br><br>'
       + '字が古い。インクではなく鉛筆なので、にじんでもいない。' }) },
];

/* 분기 순으로 세운다. clueAt 도 clueNudge 도 **첫 번째로 맞는 것**을 고르므로
   배열 순서가 곧 "무엇이 먼저 나오는가"다. 표를 손으로 정렬해 두는 것보다 한 줄이 낫다 —
   나중에 항목을 아무 데나 끼워 넣어도 순서가 안 어긋난다. */
CLUES.sort((a, b) => a.q - b.q);

/* ---------- 저장 ---------- */
function foundIds(){
  if (!S) return [];
  if (!Array.isArray(S.found)) S.found = [];
  return S.found.map(f => f.id);
}
const clueFound = id => foundIds().includes(id);
const clueOf = id => CLUES.find(c => c.id === id);

/* 지금 이 칸에서 나올 단서. 분기가 찼고, 아직 안 나왔고, 이 가구에 들어 있는 것 중 첫 번째. */
function clueAt(tile){
  if (!S) return null;
  return CLUES.find(c => S.quarter >= c.q && !clueFound(c.id) && c.tiles.includes(tile)) || null;
}
/* 지금 사무실에서 **찾을 수 있는** 단서가 있나 — 없는 가구를 가리키면 안내가 아니라 거짓말이다. */
function clueReachable(c){
  if (!W || !W.grid) return false;
  for (let i = 0; i < W.grid.length; i++) if (c.tiles.includes(W.grid[i])) return true;
  return (W.wallDecor || []).some(d => c.tiles.includes(d.tile));
}

/* ---------- 조사 화면 ---------- */
function lookLine(u){
  const lines = LOOK[u.tile];
  if (!lines || !lines.length) return null;
  return lines[((u.x * 7 + u.y * 13) % lines.length + lines.length) % lines.length];
}

function showInspect(u){
  const inf = TILE_INFO[u.kind === 'desk' ? TILE.DESK : u.tile] || {};
  const c = clueAt(u.kind === 'desk' ? TILE.DESK : u.tile);
  const obs = lookLine(u);

  /* 단서를 찾았으면 그 자리에서 기록한다. 모달을 닫아야 확정되는 발견은
     닫는 방법이 여러 개(바깥 클릭·닫기·Esc)라 한 군데서 새면 영영 못 찾는다. */
  let got = null;
  if (c){
    S.found.push({ id: c.id, q: S.quarter, at: [u.x, u.y], t: Date.now() });
    got = c;
    if (c.track && typeof music !== 'undefined' && music.grant) music.grant(c.track);
    save();
  }

  const m = modal(`
    <div class="mhead ${got ? 'found' : ''}">
      <div class="q">${got ? L({ ko:'발견', en:'FOUND', ja:'発見' }) : L({ ko:'조사', en:'A LOOK', ja:'調べる' })}</div>
      <h3>${inf.em || ''} ${inf.n || ''}</h3>
      ${got ? `<p>${got.where}</p>` : ''}
    </div>
    <div class="mbody">
      ${obs ? `<p class="observe">${obs}</p>` : `<p class="observe">${L({
        ko:'특별한 건 없다.', en:'Nothing in particular.', ja:'特に何もない。' })}</p>`}
      ${got ? `<div class="cluebox">
          <div class="cluehead"><span class="em">${got.em}</span><b>${got.n}</b></div>
          <div class="cluebody">${got.in}</div>
          ${got.track ? `<div class="cluegain">💿 ${L({
            ko:`쥬크박스에 <b>${music.track(got.track).n}</b>이(가) 들어왔습니다.`,
            en:`<b>${music.track(got.track).n}</b> was added to the jukebox.`,
            ja:`ジュークボックスに<b>${music.track(got.track).n}</b>が入りました。` })}</div>` : ''}
          <div class="hint">${L({
            ko:'🪪 근무 기록증에 남습니다.', en:'Kept on the 🪪 time card.', ja:'🪪 勤務記録証に残ります。' })}</div>
        </div>` : ''}
    </div>
    <div class="mfoot"><button class="okbtn" data-close>${
      got ? L({ ko:'주머니에 넣는다', en:'Pocket it', ja:'ポケットに入れる' })
          : L({ ko:'닫기', en:'Close', ja:'閉じる' })}</button></div>`);

  if (got){
    sfx.chime();
    pushLog(L({
      ko:`${got.em} <b>${got.n}</b> — ${got.where}에서 나왔습니다.`,
      en:`${got.em} <b>${got.n}</b> — turned up in ${got.where.toLowerCase()}.`,
      ja:`${got.em} <b>${got.n}</b>——${got.where}から出てきました。`,
    }), 'big');
    if (got.track) renderTop();
  } else sfx.add();
  return m;
}

/* ---------- 안내 ----------
   단서가 열려도 아무도 말을 안 하면 그건 없는 거나 같다. 그렇다고 어디에 있는지
   찍어 주면 발견이 아니라 심부름이다. **어디쯤인지만** 말한다. */
function clueNudge(){
  if (!S) return;
  if (!Array.isArray(S.nudged)) S.nudged = [];
  const c = CLUES.find(x => S.quarter >= x.q && !clueFound(x.id)
                            && !S.nudged.includes(x.id) && clueReachable(x));
  if (!c) return;
  S.nudged.push(c.id);
  pushLog(L({
    ko:`총무가 쪽지를 남겼습니다 — 「<b>${c.where}</b>, 한 번 들여다보십시오.」`,
    en:`Admin left a note — “<b>${c.where}</b>. Take a look sometime.”`,
    ja:`総務がメモを残しました——「<b>${c.where}</b>、一度見てみてください。」`,
  }), '');
  save();
}

/* ---------- 첫 결재 ----------
   이 게임에서 처음으로 "일이 돌아간다"고 느끼는 순간이다. 그 순간에 첫 떡밥을 붙이면
   유저는 축하를 받은 게 아니라 **뭔가를 알아버린 게** 된다. 그게 목적이다.

   그리고 여기서만 프롤로그의 마지막 문장을 회수한다 — 「서랍은 아직 열지 마십시오」의
   **아직**이 끝나는 지점이 있어야 그 문장이 금지가 아니라 약속이 된다.
   서랍을 대신 열어 주지는 않는다. 열어도 된다고만 말하고 손은 유저가 댄다. */
function firstApproval(doc, cat){
  if (!S || S.firstDoc) return;
  S.firstDoc = { q: S.quarter, t: Date.now() };
  save();

  const drawerOpen = !clueFound('drawer');
  const show = () => {
    modal(`
      <div class="mhead found"><div class="q">${L({ ko:'첫 결재', en:'FIRST APPROVAL', ja:'初決裁' })}</div>
        <h3>${L({ ko:'도장이 찍혔습니다', en:'It has been stamped', ja:'判が押されました' })}</h3>
        <p>${L({
          ko:`<b>${esc(cat ? cat.name : '')}</b> 냥이 서류를 물고 가 자기 자리에서 처리했습니다. 이제 이 회사는 돌아갑니다.`,
          en:`<b>${esc(cat ? cat.name : '')}</b> carried the document to their desk and dealt with it. This company now runs.`,
          ja:`<b>${esc(cat ? cat.name : '')}</b>が書類をくわえて席まで運び、処理しました。これでこの会社は回ります。`,
        })}</p></div>
      <div class="mbody">
        <p class="observe">${L({
          ko:`처리한 서류: <b>${esc(String(doc && doc.text || '').slice(0, 40))}</b>`,
          en:`Document handled: <b>${esc(String(doc && doc.text || '').slice(0, 40))}</b>`,
          ja:`処理した書類: <b>${esc(String(doc && doc.text || '').slice(0, 40))}</b>`,
        })}</p>
        <div class="letter">
          <div class="lhead">${L({ ko:'총무 드림', en:'From Admin', ja:'総務より' })}</div>
          <p>${L({
            ko:'첫 도장 축하드립니다. 이걸로 이 회사의 사업 방식은 전부 보신 셈입니다 — '
             + '올리고, 끝내고, 누군가 도장을 찍습니다. 나머지는 전부 곁가지입니다.',
            en:'Congratulations on the first stamp. You have now seen the entire business model — '
             + 'you file it, you finish it, somebody stamps it. Everything else is decoration.',
            ja:'初めての判、おめでとうございます。これでこの会社の商売のやり方は全部ご覧になりました——'
             + '出して、終えて、誰かが判を押す。あとは全部おまけです。' })}</p>
          <p>${L({
            ko:'그리고 인수인계 편지에 <b>서랍은 아직 열지 마십시오</b>라고 적었었지요.<br>'
             + '<b>이제 열어 보셔도 됩니다.</b> 책상을 눌러 보십시오.',
            en:'Also — the handover letter said <b>do not open the drawer yet</b>.<br>'
             + '<b>You may open it now.</b> Click the desk.',
            ja:'それと、引き継ぎの手紙に<b>引き出しはまだ開けないでください</b>と書きました。<br>'
             + '<b>もう開けて構いません。</b>デスクを押してみてください。' })}</p>
          <p class="lsign">${L({ ko:'— 총무', en:'— Admin', ja:'— 総務' })}</p>
        </div>
        ${drawerOpen ? `<div class="hint center">${L({
          ko:'사무실의 물건은 대부분 눌러 볼 수 있습니다. 대개는 아무것도 안 나옵니다.',
          en:'Most things in this office can be clicked. Most of them turn up nothing.',
          ja:'オフィスの物はたいてい押せます。たいていは何も出てきません。',
        })}</div>` : ''}
      </div>
      <div class="mfoot"><button class="okbtn" data-close>${L({ ko:'알겠습니다', en:'Understood', ja:'わかりました' })}</button></div>`);
    sfx.quarter();
  };
  /* 첫 출근 안내가 돌고 있으면 그게 끝난 뒤다. 안내판 위에 창이 겹치면
     둘 다 안 읽히고, 무엇보다 안내의 마지막 장(경고)이 가려진다. */
  if (typeof tutorRunning === 'function' && tutorRunning())
    bus.on('tutor:done', () => setTimeout(show, 600));
  else setTimeout(show, 900);

  pushLog(L({
    ko:'<b>첫 결재</b>가 처리되었습니다. 회사가 돌아가기 시작했습니다.',
    en:'The <b>first approval</b> went through. The company has started running.',
    ja:'<b>初めての決裁</b>が通りました。会社が回り始めました。',
  }), 'big');
}

/* ---------- 기록증에 붙는 목록 ---------- */
function foundListHTML(){
  const got = (S && S.found) || [];
  if (!got.length) return '';
  const rows = got.map(f => {
    const c = clueOf(f.id);
    if (!c) return '';
    return `<li><span class="em">${c.em}</span><b>${c.n}</b>
              <span class="tiny">Q${f.q} · ${c.where}</span></li>`;
  }).join('');
  const left = CLUES.filter(c => !clueFound(c.id)).length;
  return `<div class="foundbox">
    <div class="foundhead">${L({ ko:'사무실에서 나온 것', en:'Turned up in the office', ja:'オフィスから出てきたもの' })}
      <span class="tiny">${got.length}/${CLUES.length}</span></div>
    <ul class="foundlist">${rows}</ul>
    ${left ? `<div class="hint">${L({
      ko:'가구를 눌러 조사할 수 있습니다. 대부분은 아무것도 안 나옵니다.',
      en:'Furniture can be clicked and looked at. Most of it turns up nothing.',
      ja:'家具は押して調べられます。たいていは何も出てきません。' })}</div>` : ''}
  </div>`;
}

/* ---------- 배선 ---------- */
function storyInit(){
  $('#viewport').addEventListener('click', e => {
    if (typeof EDIT !== 'undefined' && EDIT.on) return;        // 배치 모드는 배치 모드의 것이다
    /* 남의 사무실을 구경하는 중이면 이 방의 가구는 내 것이 아니다 (js/visit.js).
       그대로 두면 저쪽 책상을 눌러 내 서랍이 열린다. */
    if (typeof visiting === 'function' && visiting()) return;
    if ($('.veil')) return;                                    // 창이 떠 있으면 무대는 잠긴다
    if (e.target.closest('.actor')) return;                    // 도트판의 고양이 — main.js 가 쓰다듬는다
    if (typeof R3 !== 'undefined' && R3 && R3.justDragged && R3.justDragged()) return;
    if (typeof is3d === 'function' && is3d() && R3.pickCat(e.clientX, e.clientY)) return;
    /* 벽 스위치 — 천장등을 끄고 켠다. 타일 집기보다 **먼저** 본다: 스위치는 벽 면에
       붙어 있어서 그냥 두면 벽 칸이 잡히고, 벽 칸은 조사 대상이 아니라 아무것도 아니다.
       설정창이 아니라 벽에 있는 이유는 lowpoly.js 의 lightSwitch 머리말에 적었다. */
    if (typeof is3d === 'function' && is3d() && R3.pickSwitch && R3.pickSwitch(e.clientX, e.clientY)){
      sfx.add();
      S.ceil = R3.setCeiling(!R3.ceiling()) ? 1 : 0;
      save();
      return;
    }
    const t = editTileFromEvent(e);                            // 배치 모드와 같은 집기 (edit.js)
    if (!t) return;
    const u = unitAt(t.x, t.y);
    if (!u) return;
    /* CD 플레이어는 조사 대상이 아니라 **조작 대상**이다. 눌러서 나오는 게
       "먼지가 앉아 있다" 한 줄이면, 그건 이 방에서 유일하게 만질 수 있는 물건을
       설명문으로 바꿔 버리는 것이다 (juke.js). */
    if (u.tile === TILE.JUKE && typeof showJuke === 'function'){ sfx.add(); showJuke(); return; }
    if (u.tile === TILE.BINDER && typeof showBinder === 'function'){ sfx.add(); showBinder(); return; }
    /* 벽걸이 달력도 같다 — 날짜를 보고 기한을 거는 물건이라 "먼지가 앉아 있다" 로
       바꿔 버리면 이 방에서 날짜를 볼 방법이 없어진다 (js/cal.js). */
    if (u.tile === TILE.CAL && typeof showCalendar === 'function'){ sfx.add(); showCalendar(); return; }
    if (u.tile === TILE.BOARD && typeof showBoard === 'function'){ sfx.add(); showBoard(); return; }
    showInspect(u);
  });

  /* 첫 결재. doc:stamped 가 아니라 reward 를 듣는다 — 보상이 실제로 들어간 뒤여야
     "돌아간다"는 말이 참이 된다 (game.js 가 그 순서로 쏜다). */
  bus.on('reward', ({ cat, doc }) => firstApproval(doc, cat));
  /* 분기가 넘어가면 새로 열린 단서가 있는지 본다. 사무실이 바뀌면 가구도 바뀐다. */
  bus.on('quarter:closed', () => setTimeout(clueNudge, 2600));
  bus.on('world:rebuilt', () => setTimeout(clueNudge, 400));
}
