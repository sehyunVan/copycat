# App Review 답변 — Guideline 2.1 Information Needed

2026-09-30 첫 제출에서 받은 것. **반려가 아니다** — 편지 첫 문장이 이유를 말한다:
「submitted by a developer account that has a limited App Review history」.
심사 이력이 없는 계정의 첫 앱에 붙는 정보 요청이고, 앱에서 무엇을 발견해서 보낸 게 아니다.

빌드를 다시 올리지 않는다. App Store Connect 의 그 심사 메시지에 **답글**로 아래를
붙이고, **같은 내용을 App Review Information 의 Notes 칸에도** 넣는다(다음 제출부터
다시 안 묻게 하려는 것이 저쪽의 요구다).

**아래 블록 하나가 답변 전부다.** 4000자 제한에 맞춰 줄였다 — 일곱 항목이 다 들어 있다.
심사자는 한국어를 안 읽으므로 그대로 붙인다.

---

## 붙여넣을 전문

```
1. SCREEN RECORDING
Attached; iPhone, latest iOS, from launch.
0:00 Launch - office starts, no sign-in required
0:10 Inbox: add a task; a cat files it when checked off
0:25 Staff: hire a cat
0:35 Settings > Account > Google sign-in (account creation)
1:40 Board: exchange a branch code, visit another player's office
     (user-generated content), and Block it
2:30 Parcel: odds and pre-purchase notice
2:40 Buy a box, balance arrives, open it
3:00 Restore purchases
3:10 Settings > Account > Delete account

2. PURPOSE AND AUDIENCE
Copycat Co. is an idle office simulation built around your own to-do list. Add a
task and a cat carries the paper to the approval box; check it off and it is
filed. The office runs on the device clock and the work hours you set.
Most task apps answer working alone with pressure - streaks, completion rates,
push reminders. This app has none of those and sends no notifications; it offers
company during work hours.
Audience: adults who work or study alone. Rated 12+ for a dark abandoned-office
opening and a light parody of a narcotics raid involving catnip, a cat toy.

3. SETUP AND ACCESS
No account, credentials or sample files are needed: launching creates an
anonymous account and the office starts at once, In-App Purchase included. The main screen has four tabs - Office, Inbox (add
and check off tasks), Staff (hire cats with anchovies, the in-game currency) and
News. Board exchanges a branch code to visit another player's office; Parcel
("Head Office Delivery") sells and opens boxes.
Sign-in (Settings > Account - Apple, Google or an email link) is optional and only
preserves the office across devices. Once signed in, "Delete account" in that
panel erases the account and its server data in-app
(guide: https://copycat.sarl/delete.html).

4. EXTERNAL SERVICES
Supabase - authentication (anonymous, Google, email link), storage for saves,
connected branches and the purchase ledger, and the purchase webhook function. RevenueCat - In-App Purchase handling and receipt validation;
its webhook tells our server which purchase to credit. Apple In-App Purchase
(StoreKit) - the only payment path. Google Sign-In, brokered by Supabase.
Resend - email for the sign-in link only. jsDelivr - CDN for three.js.
copycat.sarl - our own site (privacy policy, deletion guide).
No AI service, analytics or attribution SDK, ad network or third-party data
provider, and no cross-app or cross-site tracking.

5. REGIONAL DIFFERENCES
None. The same features, content and three products everywhere; nothing is
country-gated. Korean, English and Japanese follow the device
language. Prices follow each territory's price tier.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not a regulated industry: a single-player simulation game with no financial,
medical, gambling or government function. Licensed material, credited in the
app's CREDITS file: "16-bit Kitties" by Maze.Bit.Boutique (CC BY 4.0); "Modern
Office - Revamped" by LimeZu (commercial license); three.js (MIT);
Galmuri11 font (SIL OFL 1.1); cat voices (CC0). Music, furniture and cat art are
ours; no third-party brand or licensed character appears.

7. IN-APP PURCHASE
Three consumables, nothing else: box_05 (5 boxes, KRW 3,300), box_12 (12,
6,600), box_30 (30, 14,000). A box is opened in-game and yields furniture,
anchovies (the in-game currency), or a blank. Furniture is decoration
; boxes never unlock progression, which is earned by playing.
Open Parcel from the office; "Buy boxes" lists the three products at App Store
prices. "Odds" shows 3-star 2.50%, 2-star 20.00%, 1-star 77.50%, and one 2-star
or better in every ten-box open.
"Please read before paying" covers consumables, App Store refunds, minors, and
our contact copycat@copycat.sarl. "Restore purchases" is on the same screen.
Boxes are credited by our server once RevenueCat confirms the purchase, so the
balance can take a few seconds.
```

---

## 줄이면서 뺀 것

항목은 일곱 개 다 남았다. 뺀 것은 설명의 군더더기다:

- 2번의 「Close the app and the office keeps its own time」 — 앞 문장이 이미 말한다
- 3번의 「The attached recording shows the exact taps」 — 1번이 타임라인으로 말한다
- 4번의 서비스별 URL — 이름만으로 심사자가 찾는다
- 6번의 목록을 줄글로 합침
- 7번의 번호 목록을 줄글로 합침

---

# 둘째 라운드 — Guideline 4.8 (Login Services)

2026-10-01 에 온 것. 구글 로그인을 쓰면서 조건을 갖춘 **동등한 수단**이 없다는 지적이다.
메일 매직링크로는 조건 셋 중 **둘째**가 안 맞는다 — 「계정을 만들 때 모든 상대로부터
메일 주소를 숨길 수 있어야 한다」인데, 매직링크는 우리에게 진짜 주소를 줘야 성립한다.
그래서 「이미 있다」고 답하지 않고 **Sign in with Apple 을 넣었다**(1.0.26).

이 답변은 **새 빌드와 함께** 보낸다. 고친 앱이 올라가 있지 않으면 같은 지적이 다시 온다.

```
We have added Sign in with Apple, available in build 1.0.26 (26).

It is offered as an equivalent option, not a secondary one. On the first-run
account screen "Continue with Apple" sits directly below "Continue with Google"
as the same control at the same size (330x46), and in Settings > Account the
two buttons are stacked at equal width. Neither is hidden behind a menu or a
disclosure.

Sign in with Apple meets the three requirements in 4.8: it limits collection to
name and email, it lets the user keep the address private with Hide My Email
(we accept @privaterelay.appleid.com addresses and the account works normally
with one), and it collects no in-app interactions for advertising - the app has
no analytics, attribution or advertising SDK of any kind.

Signing in remains optional in every case. Launching the app creates an
anonymous account and all features, including In-App Purchase, work without any
sign-in. Signing in only preserves the office across devices, and "Delete
account" appears in the same Settings > Account panel once an account is linked.

The app's screenshots show gameplay only and contain no login screen, so no
metadata change was needed.
```

---

# 셋째 라운드 — Guideline 3.1.1 (소모품에 스토어 복원)

2026-10-03, 1.0.26 심사에서. **「구매 복원」 단추가 틀렸다는 지적이다** — 소모품은
스토어가 돌려줄 것을 아예 안 들고 있어서, 그 단추는 애플 계정 비밀번호만 묻고 끝난다.

우리가 알고 있던 「복원 단추는 심사 필수」는 **비소모품·구독** 이야기였다. 그 오해가
`js/store.js` 주석에 그대로 적혀 있었고(이제 고쳤다), 검사도 「복원 단추가 있다」를
통과 조건으로 못 박아 두고 있었다 — 틀린 것을 지켜 주는 검사였다.

**우리에겐 우리 복원 수단이 이미 있다.** 상자는 기기가 아니라 계정에 쌓인다(웹훅 →
서버 장부 → 잔액). 그래서 스토어 복원을 떼고, 그 자리에 서버 장부를 다시 읽는
「상자가 안 왔나요」를 뒀다. 1.0.27 에 들어 있다.

```
Fixed in build 1.0.27 (27).

We removed the StoreKit restore call. You are right that it could not work
here: all three products are consumables, so there is nothing for the store to
return, and the button only asked for an Apple Account password.

The app already has its own restore mechanism, and we have made it the only
one. Boxes are not held on the device. A purchase is confirmed by RevenueCat,
delivered to our server by webhook, and written to the account's ledger; the
balance shown in the app is always read back from that ledger. So a player who
changes phone or reinstalls signs in and the boxes are already there - no
restore step is involved.

What replaced the button, in the same place on the Parcel screen, is "Boxes
missing?" It re-reads our server ledger and never calls StoreKit. Its only real
use is the few seconds between a successful payment and the webhook arriving.

We also added a line to the pre-purchase notice stating that boxes are kept on
the account and survive a new device or a reinstall, so the behaviour is stated
before any payment is made.
```

## 아직 남은 두 가지

**① 3번의 이동 경로를 실제 빌드와 맞춘다.** 화면 이름(Office · Inbox · Staff ·
News · Board · Parcel)은 코드의 i18n 문자열이라 맞지만, **어디를 눌러 들어가는지**는
폰에서 한 번 보고 고치는 게 안전하다. 심사자가 따라 하다 막히면 그게 다음 반려다.

**② 신고 수단이 없다.** 애플이 녹화에 담으라는 것은
「content reporting **and** blocking mechanisms」인데 지금은 차단만 있다
(`js/board.js` 의 「차단」). 남의 화면에 그 사람이 직접 친 **할 일 텍스트와 고양이
이름**이 보이므로(`js/friends.js` 의 `mine()`) 애플 기준으로 사용자 생성 콘텐츠다.
공개 피드가 아니라 서로 코드를 교환한 사이에만 보이는 구조라는 점은 유리하지만,
신고 단추가 없는 것은 1.2 로 다음 라운드에 잡히기 쉽다.
**차단 옆에 하나 붙이는 것이 제일 싸다** — 새 판을 만들지 않고 그 줄에 더한다.
