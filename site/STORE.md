# itch.io 스토어 페이지 원고

itch.io **Create new project** 폼의 칸 순서 그대로다. 복사해서 붙이면 된다.
게임이 3개 국어라 원고도 3개 국어로 두되, **페이지 본문은 영어를 기본으로 하고 한국어를
그 아래 접어 넣는 구성**을 권한다 — itch.io 유입의 대부분이 영어권이고, 한국어 이용자는
스크롤을 내려서라도 읽는다. 일본어는 3순위지만 이 게임과 궁합이 좋아 남겨 둔다.

가격은 **무료 + Donation (pay what you want)** 으로 정해졌다 (SELLING.md 1단계).
아래 문구에는 금액을 쓰지 않았다 — 바꿀 때 고쳐야 할 자리를 늘리지 않으려고 일부러 뺐다.

---

## Title

```
Copycat
```

부제를 붙이고 싶으면 `Copycat — a to-do list that works for cats`. 다만 itch.io는
제목을 카드·검색·URL에 다 쓰므로 짧은 쪽이 낫다.

---

## Short description or tagline

> 링크로 공유될 때 뜨는 한 줄. 제목을 반복하지 말 것 (itch.io 자체 안내).
> 권장 130자 이내.

**English (기본)**
```
Tick off a to-do and a cat physically carries the paperwork away. Runs on your real clock, all day, beside you.
```

**한국어**
```
할 일을 체크하면 고양이가 서류를 물고 갑니다. 당신의 진짜 시계로 돌아가는, 하루 종일 옆에 있는 사무실.
```

**日本語**
```
やることにチェックを入れると、猫が書類をくわえて運びます。あなたの本物の時計で動く、一日じゅう隣にいるオフィス。
```

대안 (더 세게 가고 싶을 때):
- `A narcotics operation staffed entirely by cats. Also, it is your to-do list.`
- `근무 시간을 같이 견뎌주는 고양이들. 품목은 캣닢입니다.`

---

## Classification / Kind of project

| 칸 | 값 |
|---|---|
| Kind of project | **HTML** (브라우저 플레이) |
| Classification | Game |
| Release status | Released |
| Pricing | $0 or donate — pay what you want |
| Genre | Simulation |
| Tags | `idle`, `incremental`, `management`, `cats`, `pixel-art`, `cozy`, `to-do-list`, `productivity`, `singleplayer`, `no-install` |
| Average session | A few hours (하루 종일 켜 두는 게 의도다) |
| Languages | English, 한국어, 日本語 |
| Inputs | Mouse, Keyboard |
| Accessibility | One-handed / mouse only |

태그 중 **`cozy` 와 `cats` 가 itch.io에서 실제로 유입을 만드는 두 개**다.
`productivity` 는 게임 태그로는 약하지만 이 게임을 찾는 사람의 검색어라 넣는다.

---

## Cover image

**`dist/store/cover.gif` (630×500, 87KB)** — 고양이가 서류를 물고 사무실을 가로지르는
40프레임 애니메이션. itch.io 권장 규격이 정확히 630×500이고, 커버에 GIF를 허용한다.

이걸 커버로 쓰는 이유: 이 게임의 한 문장이 "체크하면 고양이가 서류를 가져간다"이고,
그 문장은 글로 읽는 것보다 움직이는 걸 보는 게 빠르다. 정지 이미지를 쓰면 그냥
픽셀아트 사무실 스크린샷 하나가 되고, 그건 itch.io에 이미 많다.

없으면 `node tools/capture-store.js` 로 다시 만든다.

---

## Screenshots

`dist/store/` 에 1440×900 다섯 장. **순서가 곧 설득 순서**라 이대로 올린다.

| # | 파일 | 보여주는 것 |
|---|---|---|
| 1 | `01-office.png` | 사무실 전경 — 무슨 게임인지 3초 안에 |
| 2 | `02-inbox.png` | 결재함과 서류를 나르는 고양이 — 핵심 루프 |
| 3 | `03-record.png` | 인사 파일의 〈기록〉 — 구금 2회, 첫 결재. 이 게임이 다른 이유 |
| 4 | `04-decorate.png` | 배치 모드 — 내 사무실이 된다 |
| 5 | `05-news.png` | 사보와 혐의 — 실패도 시스템이라는 것 |

캡션(선택, 영어):
1. `Your office. It runs on your clock — 9 to 18, lunch at 12.`
2. `Tick a box, and a cat decides on its own to come get the paperwork.`
3. `Every cat keeps a personnel record. Including the times they were taken in.`
4. `Move the furniture. The game only stops you from trapping a cat in a corner.`
5. `Paperwork you left behind leaks. Suspicion accumulates. You can also just pay.`

---

## Gameplay video or trailer

**지금은 비워 두는 걸 권한다.** itch.io는 트레일러 없이도 정상 동작하고, 커버 GIF가
그 자리를 상당 부분 메운다. 없는 채로 올리고, 반응이 오면 그때 만드는 게 맞다.

만들게 되면 — **40~60초, 무음, 자막만.** 이 게임은 소리로 파는 물건이 아니다.

```
0:00  결재함에 할 일을 입력한다 → 서류가 툭 떨어진다
0:06  고양이가 스스로 걸어와 서류를 물고 자기 책상으로 간다 → 도장
0:14  시계 칩 클로즈업 — "점심까지 1:12" (자막: it runs on your clock, not a game clock)
0:20  12:00 — 고양이들이 다 같이 탕비실로 이동 (자막: at your noon, they go to lunch)
0:28  50분 스트레칭 알림이 뜬다 (자막: it reminds you, never nags you)
0:34  분기 마감 → 혐의 누적 → 경찰 급습 (자막: paperwork you skipped becomes evidence)
0:44  인사 파일 〈기록〉 — 구금 2회 (자막: the file remembers)
0:52  근무 기록증 "47일째" (자막: how long have you two been at this?)
```

녹화는 `tools/capture-store.js` 와 같은 방식(CDP)으로 프레임을 뽑아도 되고,
화면 녹화 후 잘라도 된다. 업로드는 YouTube 미등재(Unlisted)로 충분하다.

---

## Details / Description (페이지 본문)

> itch.io 본문 편집기는 서식 있는 텍스트다. 아래는 마크다운으로 적었으니
> 붙여 넣고 제목·굵게만 다시 잡으면 된다.

### English

**A to-do list where finishing something makes a cat get up and walk across the office.**

Most to-do apps go: check the box → +10 points. Here, checking the box drops a physical
document into the office inbox. A cat notices it, decides on its own to walk over, picks
it up, carries it to its desk, and stamps it — and only then do you get paid. If every
cat happens to be in the litter box, the paperwork just piles up.

**And the office runs on your clock.**

Not a compressed game clock. At your 9 AM the cats clock in, at your noon they physically
walk to the break room, and at 6 PM they see you off with today's count. Every 50 minutes
one of them reminds you to roll your shoulders. This game was built for people who find
the working day very long, and instead of fast-forwarding through it, it walks the actual
hours beside you. Leave it open in another tab; it keeps working, and it will tap you on
the shoulder when it matters.

It never nags. That is the one rule the whole thing is built around.

---

**The company sells catnip. This is relevant.**

Catnip is a controlled substance here, and the business is registered as a herbal
wholesaler — that registration is the only thing protecting anyone. So work you *didn't*
do also creates events. Paperwork left unfinished at quarter close leaks, and it becomes
evidence. Suspicion accumulates. Cross the line and the Cat Police raid the office, and
sometimes they take an employee with them.

You can pay a law firm to make suspicion go away, which is exactly the kind of company
this is.

---

**Cats are individuals, not stat blocks.**

New hires roll six stats on 4d6-drop-lowest. You pick their name and their coat; the dice
pick everything else. From then on each cat keeps a personnel record — quarter joined,
documents stamped, the facility they keep going back to, and how many times they have been
detained. A cat comes back from detention cleared of all charges and the file says nothing
else about it.

They run on utility AI, seek out coffee and naps on their own, and only earn while actually
sitting at their desk. When one goes for a coffee, revenue really does drop.

---

**Also in the box**

- **Procedurally generated offices** that grow from a cardboard box in an alley to a branch on the Moon, seven tiers, every floor plan verified reachable
- **Decorate mode** — move the furniture yourself; the only thing the game forbids is walling a cat into a corner
- **A rival** — a dog outfit selling drug-laced chews, taking your clients while you idle
- **A time card** you can save as an image: how many days the two of you have been clocking in together
- **Offline earnings**, quarterly reports, 20 events, 9 traits, 8 ranks
- **English · 한국어 · 日本語**

---

**No install, no account, no server.** It runs in the browser, saves to your own machine,
and the downloadable version is a single HTML file you can double-click. It works offline.

---

### 한국어

**할 일을 하나 끝내면, 고양이가 자리에서 일어나 사무실을 가로지릅니다.**

보통의 할 일 앱은 체크박스 → +10점입니다. 여기서는 체크하는 순간 결재함에 서류가 실제로
떨어집니다. 고양이가 그걸 발견하고, 스스로 걸어와서, 물고, 자기 책상으로 가서 도장을 찍고 —
그제서야 돈이 들어옵니다. 하필 다들 화장실에 가 있으면 서류는 그냥 쌓입니다.

**그리고 이 사무실은 당신의 시계로 돌아갑니다.**

압축된 게임 시간이 아닙니다. 당신의 9시에 고양이들이 출근하고, 당신의 12시에 다 같이
탕비실로 걸어가고, 18시에는 오늘 결재 건수를 세어 배웅합니다. 50분마다 한 마리가 어깨 좀
돌리라고 알려 줍니다. 이 게임은 근무 시간이 유난히 길게 느껴지는 사람을 위해 만들었고,
그 시간을 건너뛰는 대신 옆에서 같이 걷습니다. 다른 탭에 켜 두세요. 계속 일하고 있다가
필요할 때 어깨를 두드립니다.

절대 재촉하지 않습니다. 이 게임 전체가 그 하나를 중심으로 만들어졌습니다.

---

**회사는 캣닢을 팝니다. 이게 중요합니다.**

여기서 캣닢은 규제 품목이고, 회사는 약초 도매상으로 등록되어 있습니다 — 그 등록증 하나가
전 직원을 지키고 있습니다. 그래서 **하지 않은 일도 사건이 됩니다.** 분기 마감까지 처리 못 한
서류는 새어 나가 증거가 되고, 혐의가 쌓입니다. 선을 넘으면 영장이 나오고 고양이 경찰이
들이닥칩니다. 가끔은 직원을 하나 데려갑니다.

돈을 내고 혐의를 지울 수도 있습니다. 그런 회사입니다.

---

**고양이는 능력치 뭉치가 아니라 개체입니다.**

신입은 4d6 최하위 버림으로 여섯 능력치를 굴립니다. 이름과 털색은 당신이 정하고, 나머지는
주사위가 정합니다. 그때부터 한 마리마다 인사 기록이 쌓입니다 — 입사 분기, 처리한 서류,
자주 가는 시설, 그리고 구금된 횟수. 구금됐던 고양이는 무혐의로 돌아오고, 기록부에는 그
이상 아무것도 적혀 있지 않습니다.

고양이들은 유틸리티 AI로 스스로 커피와 낮잠을 찾아가고, **자기 자리에 실제로 앉아 있을
때만** 돈을 법니다. 한 마리가 커피 마시러 가면 매출이 정말로 떨어집니다.

---

**그 밖에**

- **절차적으로 생성되는 사무실** — 골목 종이상자에서 달 지사까지 7단계, 모든 평면도 도달 가능 검증 완료
- **배치 모드** — 가구를 직접 옮깁니다. 게임이 막는 건 고양이를 구석에 가두는 배치뿐입니다
- **경쟁사** — 약 탄 개껌을 파는 멍멍파가 놀고 있는 사이 거래처를 가져갑니다
- **근무 기록증** — 며칠째 같이 출근하고 있는지, 이미지로 저장됩니다
- **오프라인 수익**, 분기 보고서, 이벤트 20종, 특성 9종, 직급 8단계
- **한국어 · English · 日本語**

---

**설치도, 계정도, 서버도 없습니다.** 브라우저에서 돌고, 저장은 당신 컴퓨터에 하고,
다운로드판은 더블클릭하면 열리는 HTML 파일 한 장입니다. 인터넷 없이도 돌아갑니다.

---

### 日本語

**やることをひとつ終えると、猫が席を立ってオフィスを横切ります。**

ふつうのToDoアプリはチェック→+10ポイントです。ここではチェックした瞬間、決裁箱に書類が
実際に落ちます。猫がそれに気づき、自分の判断で歩いてきて、くわえて、自分の机まで運んで
判を押す——そこでようやくお金が入ります。全員トイレに行っていたら、書類はただ積まれます。

**そしてこのオフィスは、あなたの時計で動きます。**

圧縮されたゲーム内時間ではありません。あなたの9時に猫たちが出勤し、あなたの12時にみんなで
給湯室へ歩いていき、18時には今日の決裁件数を数えて見送ります。50分ごとに一匹が肩を回すよう
声をかけます。このゲームは勤務時間がやたら長く感じる人のために作りました。その時間を
早送りする代わりに、隣を一緒に歩きます。別のタブで開いたままにしてください。

決して急かしません。このゲーム全体がその一点を軸に作られています。

---

**会社はマタタビを扱っています。これが重要です。**

ここではマタタビは規制品目で、会社は薬草卸として登録されています——その登録証だけが全員を
守っています。だから**やらなかった仕事も事件になります。** 四半期末までに処理できなかった
書類は漏れ、証拠になります。嫌疑が積み上がり、線を越えると令状が出て猫警察が踏み込みます。
ときには社員を一匹連れていきます。

お金を払って嫌疑を消すこともできます。そういう会社です。

---

**猫は能力値の塊ではなく、一匹ずつの個体です。**

新入社員は4d6の最低値切り捨てで六つの能力値を振ります。名前と毛色はあなたが決め、残りは
サイコロが決めます。そこから一匹ごとに人事記録が溜まっていきます——入社四半期、処理した書類、
よく行く場所、そして拘留された回数。拘留された猫は嫌疑不十分で戻ってきて、記録にはそれ以上
何も書かれていません。

---

**そのほか**

- **手続き的に生成されるオフィス** — 路地裏のダンボールから月支社まで全7段階
- **模様替えモード** — 家具を自分で動かせます。禁じられているのは猫を隅に閉じ込める配置だけ
- **ライバル** — 薬入りのおやつを売る犬の組織が、放っておくと取引先を奪っていきます
- **勤務記録証** — 何日目まで一緒に出勤したか、画像として保存できます
- **日本語 · 한국어 · English**

---

**インストールもアカウントもサーバーも不要。** ブラウザで動き、保存はあなたのPCに、
ダウンロード版はダブルクリックで開くHTML1枚です。オフラインでも動きます。

---

## 첨부 안내 (Uploads 칸 옆 설명문)

```
Play in browser — no install.
Or download the single HTML file and double-click it. It works offline.
```

```
브라우저에서 바로 실행됩니다. 설치 없음.
또는 HTML 파일 하나를 받아 더블클릭하세요. 인터넷 없이도 됩니다.
```

---

## 안 쓴 것과 그 이유

- **"생산성" 을 전면에 내세우지 않았다.** 이 게임은 생산성 도구가 아니고, 그렇게 팔면
  받는 기대가 어긋난다. 검색용으로 태그에만 남겼다.
- **"중독성" · "무한 성장" 같은 아이들 게임 관용구를 안 썼다.** 이 게임의 약속은
  오래 붙잡아 두는 게 아니라 옆에 있어 주는 것이다.
- **마약을 농담의 중심에 두지 않았다.** 소재이지 훅이 아니다. 훅은 "고양이가 서류를
  물고 간다"와 "시계를 감지 않는다" 두 개다. 등급분류를 받게 될 경우에도
  이 배치가 유리하다 (SELLING.md 3단계).
- **정신건강을 언급하지 않았다.** 이 게임이 왜 만들어졌는지는 만든 사람의 사정이고,
  스토어 페이지에서 그걸 파는 건 다른 종류의 거래가 된다. 필요한 사람은 문장에서 알아본다.
