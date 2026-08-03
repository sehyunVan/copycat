# 첫 공개 — Reddit 게시 안내서

한 번만 올리고 손 떼는 실험이다. 캠페인이 아니다.
목표는 판매도 화제성도 아니고 **"남이 둘째 날에도 켜 두는가"** 하나다.

---

## 0. Reddit 기본 — 이것만 알면 된다

**서브레딧** — 주제별 게시판. `r/이름` 이 주소다. 우리가 갈 곳은
`reddit.com/r/incremental_games` (방치형·증분형 게임, 구독자 30만 규모).

**카르마** — 받은 추천 수의 누적. 서브레딧마다 "카르마 N 이상, 계정 나이 N일 이상"
같은 자동 필터가 걸려 있고, **걸리면 글이 조용히 사라진다. 알림도 없다.**
내 글이 실제로 보이는지 확인하는 법: 로그아웃한 브라우저(시크릿 창)에서
서브레딧 New 탭을 열어 내 글이 있는지 본다. 없으면 필터에 걸린 것이다.

**플레어(flair)** — 글머리 분류 태그. 많은 서브레딧이 필수로 걸어 둔다.
안 달면 자동 삭제되는 곳도 있다. 게시 화면에서 고르게 되어 있다.

**게시 형식** — 링크 포스트 / 텍스트 포스트 / 이미지·비디오 포스트가 있다.
**우리는 이미지(GIF) 포스트로 올리고 링크는 본문에 넣는다.**
Reddit이 외부 링크 포스트의 노출을 눌러서, 링크 포스트로 올리면 커버 GIF가
피드에서 안 움직이고 이 게임의 가장 강한 무기가 통째로 사라진다.

**제목은 수정이 안 된다.** 본문은 나중에 고칠 수 있지만 제목은 영영 그대로다.
올리기 전에 두 번 읽자.

**지우고 다시 올리지 않는다.** 반응이 시원찮다고 삭제 후 재게시하면 스팸으로 잡힌다.

---

## 1. 올리기 전 5분 점검

- [ ] 서브레딧 사이드바의 **Rules 를 직접 읽는다** (자기 게임 게시 관련 조항, 요일 규칙, 플레어)
- [ ] 내 계정 카르마와 나이를 확인한다 (프로필에서 보인다)
- [ ] `dist/store/cover.gif` 를 손에 준비 (630×500, 87KB)
- [ ] itch 페이지가 **Public** 인지 확인 — Draft 면 남이 못 연다
- [ ] itch 페이지 **코멘트를 켜 둔다** — 텔레메트리가 없으니 여기가 유일한 회신 경로다
- [ ] 게임을 시크릿 창에서 한 번 열어 본다 (내 브라우저 저장 상태 말고 남이 보는 첫 화면)

**올리는 시각** — 미국 동부 평일 오전이 이 서브레딧 트래픽의 정점이다.
**한국 시각으로 밤 10시~새벽 1시(평일)**. 그 뒤 서너 시간은 댓글에 붙어 있어야 하므로,
그럴 수 있는 날 밤을 고른다.

---

## 2. 제목

Reddit 제목은 최대 300자다. 후보 둘:

**A (권장)**
```
I made an idle game where ticking off a to-do makes a cat physically walk over and carry the paperwork to its desk
```

**B (더 정확하지만 모험)**
```
My idle office game refuses to fast-forward — it runs on your real clock, 9 to 18, lunch at noon
```

A로 걸고 실시간 시계는 본문의 반전으로 두는 걸 권한다. 이 커뮤니티는 **메커닉을 먼저 본다.**
B는 이 게임을 더 정확히 설명하지만, "그래서 이게 게임이야?"라는 반응을 첫 줄에서 부른다.

---

## 3. 본문 (영어 원문 — 그대로 붙여 넣으면 된다)

> 링크의 `sehyunvan.itch.io/copycat` 부분만 확인하고 사용.

```markdown
Free, runs in the browser, no account, no install: https://sehyunvan.itch.io/copycat

**The loop.** You add a real to-do. When you tick it off, a document physically drops
into the office inbox. A cat notices it, decides on its own to walk over, picks it up,
carries it to its desk, and stamps it — and you only get paid at the stamp. If every cat
happens to be in the litter box or off getting coffee, the paperwork just piles up.

Cats run on utility AI with energy / fun / bladder / caffeine needs and seek out
facilities on their own. They only earn while actually seated at a desk, so when one
gets up for coffee your income really does drop.

**The part that makes it odd.** There is no compressed game clock. The office runs on
your system clock — 9 to 18, lunch 12 to 13. At your noon the cats walk to the break
room. At 18:00 they clock out and tell you how many approvals you got through today.

Quarters advance on KPI rather than on time, so progression is *not* gated behind real
hours — you can push as fast as you like. What is real-time is the **day**, not the
grind. I built it to sit in a second tab while I work, so it is designed around that:
offline earnings while the tab is hidden, and a stretch reminder every 50 minutes.

**Failure is a system too.** The company sells catnip, which is a controlled substance
here, and it is registered as a herbal wholesaler. Paperwork you did not finish by
quarter close leaks and becomes evidence. Suspicion accumulates, everyone's output
drops, and past a threshold the Cat Police raid the office — sometimes they take an
employee with them. You can pay a law firm to erase a point of suspicion, which is
faster, and is unmistakably a bribe.

There is also a rival dog outfit selling drug-laced chews that takes your clients while
you idle, so doing nothing costs you rather than merely earning nothing.

**Other bits:** new hires roll 4d6-drop-lowest across six stats and you pick their name
and coat. Every cat keeps a personnel record — documents stamped, the facility they keep
going back to, and how many times they have been detained. Seven procedurally generated
office tiers, from a cardboard box in an alley to a branch on the Moon. You can rearrange
the furniture yourself. English / 한국어 / 日本語.

Saves to localStorage. There is also a single-file HTML download that works fully offline.

**What I would genuinely like to know:** does it survive a second day? It is built to be
left open next to your work, and that is the one thing I cannot tell from my own machine.
The game has no analytics of any kind — comments here are literally my only feedback.
```

### 한국어 요약 (무슨 말인지 확인용, 올리지 않음)

무료·브라우저·설치 없음 → 링크 / 핵심 루프(체크 → 서류 → 고양이가 물고 감 → 도장에서
보상) / 유틸리티 AI와 자리에 앉아야 번다는 점 / 반전: 실시간 시계인데 **진행은 시간이
아니라 KPI로 풀린다**(이게 방치형 유저의 첫 번째 걱정이라 먼저 막아 둔다) / 실패도
시스템(혐의·압수수색·뇌물) / 라이벌 / 4d6·기록부·7단계 사무실·3개 국어 /
마지막에 질문 하나 — **둘째 날에도 켜 두게 되는가.**

---

## 4. 올리는 절차

1. `reddit.com/r/incremental_games` 접속 → 로그인
2. **사이드바 Rules 를 읽는다** (여기서 요일 규칙이나 플레어 필수를 확인)
3. **Create Post** → **Images & Video** 탭 선택
4. `cover.gif` 업로드
5. 제목 붙여넣기 → 본문 붙여넣기
6. **Flair 선택** (있으면 반드시. 보통 `Game Completed` / `Update` / `HTML` 류)
7. 게시
8. **시크릿 창으로 New 탭에서 내 글이 보이는지 확인** — 안 보이면 자동 필터다.
   그때는 삭제하지 말고 모더레이터에게 modmail 을 보낸다
9. 게시 직후 본인 댓글로 한 줄 덧붙인다 (선택):
   `Single-file offline build is on the same page if you'd rather not play in a tab.`

---

## 5. 나올 질문과 답 — 미리 정해 두면 3초 안에 답한다

**"이게 진짜 incremental 맞아? 실시간이면 기다리는 게임 아냐?"**
> Progression is on KPI, not on time — you can blow through quarters as fast as you can
> feed it work. The real-time part is only the *day* (when lunch is, when they clock out).
> Offline earnings cover up to 8 hours, 16 with the auto-feeder.

이게 **가장 확률 높은 질문**이다. 본문에서 이미 한 번 막아 뒀지만 또 나온다.

**"엔드게임은? 얼마나 길어?"**
> Seven office tiers, quarter targets curve 6 → 45 → 196. Per-document output scales with
> tier so documents-per-quarter stays roughly flat instead of exploding.

**"모바일 돼?"**
> Desktop-focused, 1280px and up. It runs on a phone but the office view is cramped.

정직하게 말한다. 안 되는 걸 된다고 하면 첫 리뷰가 나빠진다.

**"소스 공개돼 있어?"**
> No — the office tileset is a paid asset I can't redistribute, so the repo stays closed.
> The cat sprites are CC BY (16-bit Kitties by Maze.Bit.Boutique) and credited in-game.

**"AI로 만든 거야?"** — ⚠️ **미리 답을 정해 두어야 하는 질문이다.**
Reddit에서 이 질문은 반드시 나오고, 얼버무리면 그 스레드는 거기서 끝난다.
itch 에 붙인 `No generative AI was used` 태그는 보통 **에셋(그림·음악·글)** 기준으로
읽히지만, 넓게 해석하는 사람도 있다. 사실대로 한 줄로 답하는 게 유일하게 안전한 길이다.
에셋과 코드를 구분해서, 각각 실제로 어땠는지 본인 문장으로 미리 적어 두자.
**변명하지 말고 짧게.** 길어질수록 의심받는다.

**"밸런스가 이상한데 (수치 지적)"**
> 고맙다고 하고 적어 둔다. 그 자리에서 방어하지 않는다. 이 커뮤니티의 수치 지적은
> 대체로 정확하고, 이번 실험에서 얻는 가장 실용적인 산출물이다.

**"세이브 날아가?"**
> localStorage, per browser. Clearing site data wipes it. The offline single-file build
> keeps its own save.

---

## 6. 올린 뒤

- **서너 시간은 댓글에 붙어 있는다.** 초반 댓글 속도가 노출을 결정한다.
- 부정적인 댓글에 방어하지 않는다. `Fair — noted.` 한 줄이면 충분하다.
- **r/WebGames 는 최소 하루 뒤에, 문구를 바꿔서.** 같은 글을 동시에 여러 곳에 뿌리면
  스팸 필터에 걸린다.
- 일주일 뒤에 itch 분석(조회 / 브라우저 플레이 / 다운로드)과 코멘트만 본다.
  **매일 들여다보지 않는다** — 그게 실험을 캠페인으로 바꾸는 첫 단계다.

---

## 7. 이번 실험에서 볼 것

숫자 자체보다 **비율**을 본다.

| 보는 것 | 무슨 뜻인가 |
|---|---|
| 조회 → 브라우저 플레이 전환 | 문구와 GIF가 일한다 |
| 플레이 → 다운로드 | "계속 쓰고 싶다"는 신호. 이게 제일 강하다 |
| 코멘트에 "둘째 날" 언급 | 우리가 물은 것에 대한 직접 답 |
| 🪪 기록증 카드가 올라옴 | 최상의 신호. 거기 적힌 날짜 수가 곧 리텐션이다 |
| 후원 건수 | 금액이 아니라 **몇 %가 냈는지**를 본다 |

플레이가 수백인데 다운로드가 0이면 "재밌지만 곁에 두진 않는다"는 뜻이고,
그건 이 게임의 핵심 가설이 틀렸다는 신호다. 그때 방향을 다시 잡으면 된다.
