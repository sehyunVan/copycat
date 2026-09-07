# 상자 결제 켜기 — 순서대로

택배 상자를 **돈으로 파는** 길을 켜는 절차. 게임 코드는 이미 다 서 있다
(`spike/verify-store.js` 34/34 통과 — 결제·복원·취소·고지·구매내역까지 가짜 플러그인으로 확인).
**막힌 것은 코드가 아니라 계정·상품·키 셋이다.**

```
   스토어(Play·App Store)에 상품 등록
              ↓
   RevenueCat 이 그 상품을 알아보고 키를 준다
              ↓
   게임에 키를 넣는다        ← 내가 하는 한 줄
              ↓
   서버(Supabase)가 웹훅을 받아 상자를 넣는다
```

세 축이 **같은 상품 코드**를 써야 한다. 기본값은 `spike/supabase-purchase.sql` 에 있는 셋:

    box_05  상자 5개   ← box_5 는 Play 에서 지워져 못 쓴다(아래 함정 4)
    box_12  상자 12개
    box_30  상자 30개

하나라도 어긋나면 **상점 칸이 통째로 안 뜬다.** 그게 맞는 동작이다 — 살 수 없는 단추를
그려 두면 심사에서도 걸리고 눌러 본 사람도 속는다(`js/store.js` 머리말).

---

## 0. 지금 어디까지 돼 있나

- [x] 결제 코드 (`js/store.js` · RevenueCat 플러그인 13.5)
- [x] 서버 장부·웹훅 (`js/parcel.js` · `supabase/functions/parcel-purchase` · `spike/supabase-purchase.sql`)
- [x] 상점 화면 (`js/gacha.js` — 상자 사기 · 구매 복원 · 결제 전 고지)
- [x] iOS 키 `appl_…` (`js/store.js` KEYS.ios)
- [x] Play 신원 인증 · App Store 병목 없음  ← 2026-09-07 사장님 확인
- [x] **AAB 구움·서명 확인** (2026-09-07 — 1-1)
- [x] **폰 스크린샷 6장** 도트 판으로 새로 찍음 (`dist/store/ios`, 1290×2796)
- [x] **안드로이드 키 `goog_…`** (2026-09-07 · js/store.js) — AAB 다시 구움(versionCode 2)
- [ ] 스토어 상품 등록 · RevenueCat 상품 연결 · 웹훅 주소

---

## 1. Play 콘솔 — 앱을 한 번 올린다  (안 올리면 상품 탭이 안 열린다)

인앱 상품 화면은 **앱이 릴리스 트랙에 한 번이라도 올라간 뒤**에 열린다. 내부 테스트로 충분하다.

### 1-1. 굽는 것은 끝나 있다 ✅ (2026-09-07 실행)

    node tools/pack-mobile.js          # 게임 → dist/android · dist/iphone
    cd mobile && npx cap sync android  # dist → android/
    cd android && ./gradlew.bat bundleRelease      # JAVA_HOME = Android Studio jbr
    jarsigner -verify -certs app/build/outputs/bundle/release/app-release.aab

    → mobile/android/app/build/outputs/bundle/release/app-release.aab   28.2MB
      jar verified.        (self-signed·timestamp 경고는 업로드 키에 정상이다)
      안에 든 것 확인: js/dot.js 있음 · music.js 에 youtube 0건 · Galmuri 2벌 · sarl.copycat.app

**다시 구울 때**: `versionCode` 를 올려야 같은 트랙에 다시 올라간다
(`mobile/android/app/build.gradle` — 지금 1). Play 는 같은 번호를 두 번 안 받는다.

### 1-2. 앱 만들기

play.google.com/console → **모든 앱 → 앱 만들기**

| 칸 | 값 |
|---|---|
| 앱 이름 | `Copycat Co.` (App Store 에 Copycat 이 이미 있다 — 양쪽을 맞춘다) |
| 기본 언어 | 한국어 |
| 앱 또는 게임 | **게임** |
| 유료 또는 무료 | **무료** — 한 번 정하면 유료로 못 바꾼다. 인앱 결제는 무료 앱에서 한다 |

### 1-3. AAB 를 올리는 자리

왼쪽 메뉴 **테스트 및 출시 → 테스트 → 내부 테스트** → 오른쪽 위 **새 버전 만들기**

1. 처음이면 **Play 앱 서명** 안내가 먼저 뜬다 → 계속(구글이 배포 키를 관리하고, 우리가
   업로드 키로 서명한 AAB 를 받는다. 그래서 위에서 `jarsigner` 로 서명을 확인한 것이다).
2. **App Bundle** 칸에 `app-release.aab` 를 끌어다 놓는다.
3. 출시명(자동으로 `1 (1.0)`) · 출시 노트 한 줄.
4. **저장 → 버전 검토 → 내부 테스트 트랙으로 출시 시작**.
5. 같은 화면 **테스터** 탭 → 이메일 목록 만들기(본인 Gmail 포함) → 저장.
   여기 없는 계정은 링크를 받아도 못 받는다.

### 1-4. 출시 버튼이 회색이면 — 대시보드가 요구하는 것들

왼쪽 **앱 설정 → 앱 콘텐츠** 에서 채운다. 하나라도 비면 출시가 안 눌린다.

| 항목 | 우리 값 |
|---|---|
| 개인정보처리방침 URL | `https://copycat.sarl/privacy.html` (살아 있음 · 확인함) |
| 광고 포함 | **아니요** (분석·추적 SDK 가 하나도 없다) |
| 앱 액세스 권한 | 전체 공개 — 로그인 없이도 게임이 다 돈다 |
| 콘텐츠 등급 | 설문. 어두운 분위기·캣닢 패러디를 **정직하게** 답한 원고가 `site/APPSTORE.md` 에 있다 |
| 타겟층 | 13세 이상 (아동 대상 아님) |
| 데이터 보안 | 수집: 이메일(로그인한 경우) · 게임 저장. 판매·공유 없음. 삭제 요청 `https://copycat.sarl/delete.html` |
| 정부 앱 · 금융 기능 | 아니요 |

### 1-5. 스토어 등록정보

**성장 → 스토어 등록정보 → 기본 등록정보**

| 칸 | 상태 |
|---|---|
| 앱 아이콘 512×512 | `assets/icons/icon-512.png` ✅ |
| 휴대전화 스크린샷 (2~8장) | `dist/store/ios/*.png` 1290×2796 **6장** — 도트 판으로 새로 찍음 ✅ |
| 그래픽 이미지 1024×500 | `dist/store/feature-1024x500.png` ✅ — `node tools/capture-feature.js` 로 굽는다 |
| 간단한 설명 (80자) · 자세한 설명 | `site/STORE.md` 의 원고를 줄여 쓰면 된다 |

## 2. Play 콘솔 — 인앱 상품 셋

**수익 창출 → 제품 → 인앱 상품 → 상품 만들기**

이 메뉴가 안 열리면 둘 중 하나다: ① 결제 프로필(판매자 계정)이 아직 없다 →
**수익 창출 → 결제 프로필 설정** ② AAB 가 아직 안 올라갔다 → 1-3.

| 칸 | 값 |
|---|---|
| 제품 ID | `box_05` · `box_12` · `box_30` — **한 번 만들면 못 바꾼다.** 서버 표와 같아야 한다 |
| 이름 / 설명 | 「상자 5개」처럼. 게임 화면은 이 이름을 안 쓴다(개수를 직접 그린다) |
| 가격 | 사장님이 정한다. **게임에는 값을 안 적는다** — 스토어가 말하는 문자열을 그대로 쓴다 |
| 상태 | 만든 뒤 **활성화**를 눌러야 산다 |

### 라이선스 테스터 — 이걸 먼저 해 두면 7번에서 돈이 안 나간다

Play 콘솔 **왼쪽 맨 아래 「모든 앱」(계정 수준) → 설정 → 라이선스 테스트** →
테스터 이메일 추가 → 라이선스 응답 `RESPOND_NORMALLY`.
이 목록에 있는 계정은 결제창이 뜨고 **실제 청구는 안 된다**(테스트 카드로 결제된다).

## 3. App Store Connect — 소모품 셋

### 3-1. 「앱 내 구입」은 **기능 탭에 없다** (2023 년 말에 옮겨졌다)

옛 안내문은 전부 `앱 → 기능(Features) → 앱 내 구입` 이라고 말한다. 지금은 다르다:

    appstoreconnect.apple.com → 앱 → (앱 선택)
      → 왼쪽 사이드바 맨 아래쯤 **수익 창출(Monetization)**
        → **앱 내 구입(In-App Purchases)**       ← 여기다
        → 구독(Subscriptions) 은 그 아래. 상자는 구독이 아니다

사이드바에 **수익 창출 자체가 안 보이면** 앱이 아직 없거나(3-2) 계약이 안 됐다(3-4).

### 3-2. 앱이 아직 없다면

앱 → **+** → 새로운 앱. 여기서 고르는 **번들 ID 는 목록에서만** 고를 수 있고, 그 목록은
developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** 에서
먼저 만들어야 채워진다.

우리 iOS 번들은 **`sarl.copycat.app`** 이다(안드로이드만 `copycat.sarl` 로 바꿨다 —
스토어가 다르면 이름이 달라도 되고, RevenueCat 도 둘을 각각 다른 앱으로 잡는다).
`mobile/ios` 의 Xcode 프로젝트도 그 값이라 **바꾸면 Xcode 쪽도 같이 고쳐야 한다.**

### 3-3. 소모품 만들기

앱 내 구입 → **+** → **소모품(Consumable)**

| 칸 | 값 |
|---|---|
| 참조 이름 | 내부용. 「상자 5개」처럼 |
| 제품 ID | `box_05` · `box_12` · `box_30` — Play·서버 표와 **같아야** 한다 |
| 가격 | 사장님이 정한다 |
| 현지화 | 표시 이름·설명. 한국어 하나만 있어도 저장은 된다 |
| 심사 정보 | **스크린샷 한 장이 필수다.** 상자 사기 칸이 보이는 사진을 쓴다 |

심사 스크린샷은 `dist/store/ios/03-parcel.png` 로 충분하다(택배 화면). 상점 칸까지 보이는
사진이 필요하면 키를 넣고 다시 찍어야 한다 — 그건 6번 뒤의 일이다.

### 3-4. 그래도 안 보이면 — 계약이다

**사용 계약, 세금 및 금융 거래(Agreements, Tax, and Banking)** 에서 **유료 앱 계약**이
「활성」이어야 한다. 안 되어 있으면 수익 창출 메뉴가 아예 안 뜨거나, 상품을 만들어도
「제출 준비 안 됨」에서 안 넘어간다. 세금 정보와 은행 계좌까지 채워야 활성이 된다.
이게 비면 RevenueCat 도 상품을 못 읽는다.

## 4. RevenueCat — 앱 둘을 붙이고 키를 받는다

1. Project → **Apps → + New → Google Play**
   - 패키지명 **`copycat.sarl`** (안드로이드는 이 이름이다 — iOS 만 `sarl.copycat.app`)
   - **Service Account JSON** 업로드 ← 받는 자리는 4-1
   - 저장하면 나오는 **Public SDK key `goog_…`** ← **이걸 나에게 주면 된다**

### 4-1. 서비스 계정 JSON 은 **Google Cloud 에서 받는다**

헷갈리는 지점: **Play 콘솔은 그 계정에 「권한만」 준다.** 파일은 Google Cloud 가 만든다.
순서가 Play → Cloud → Play 로 왔다 갔다 한다.

**① Play 콘솔 — 프로젝트를 잇는다**

    Play 콘솔 → (왼쪽 맨 아래) 설정 → **API 액세스**
      → 「새 프로젝트 만들기」 또는 기존 Google Cloud 프로젝트 연결
      → 화면 아래 **서비스 계정** 칸 → 「새 서비스 계정 만들기」
        → 뜨는 안내 상자의 **Google Cloud Platform 링크**를 누른다

**「API 액세스」가 사이드바에 없을 때** — 둘 중 하나다.

1. **앱 안에 들어가 있다.** 이 메뉴는 **계정 수준**에만 있다. 왼쪽 위 앱 이름 옆
   「**모든 앱**」을 눌러 앱 밖으로 나오면 사이드바가 계정 메뉴로 바뀐다
   (대시보드 · 통계 · 재무 · 사용자 및 권한 · **설정** · 다운로드 보고서).
   앱 안의 「설정」은 다른 물건이다(앱 무결성·고급 설정).
2. **계정 소유자가 아니다.** API 액세스는 소유자에게만 보인다.

### 4-1-2. 그래도 안 보이면 — Play 를 거치지 않는 길

Play 쪽 마법사는 **편의**일 뿐이다. 서비스 계정은 Google Cloud 에서 직접 만들고,
권한만 Play 에서 주면 결과가 같다.

**Cloud 에서 직접**

    console.cloud.google.com → 프로젝트 만들기 (이름 아무거나)
      → API 및 서비스 → 라이브러리 → **Google Play Android Developer API** → 사용 설정
      → IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기 (역할 없이)
      → 그 계정 → 키(KEYS) → 키 추가 → 새 키 만들기 → **JSON**

**Play 에서 권한만**

    Play 콘솔 (계정 수준) → **사용자 및 권한** → 사용자 초대
      이메일: 그 서비스 계정 주소 (…@….iam.gserviceaccount.com)
      계정 권한: 재무 데이터, 주문 및 취소 설문지 보기 · 주문 및 구독 관리
      앱 권한: Copycat
      → 초대

서비스 계정도 「사용자」로 초대된다 — 사람 계정과 같은 자리에서 권한을 준다.

**② Google Cloud — 여기서 JSON 이 나온다**

    (링크로 넘어간 화면) IAM 및 관리자 → **서비스 계정** → **서비스 계정 만들기**
      이름: revenuecat  (아무거나)
      역할: **주지 않아도 된다** — 권한은 ③ 에서 Play 가 준다
      만든 뒤 그 계정을 눌러 → **키(KEYS)** 탭
        → 키 추가 → 새 키 만들기 → **JSON** → 만들기
        → 파일이 **자동으로 내려받아진다.** 이게 그 JSON 이다

    ⚠ 이 파일은 **다시 못 받는다.** 잃으면 키를 새로 만들어야 한다.
      비밀 열쇠다 — 저장소에 넣지 않는다.

**③ 다시 Play 콘솔 — 그 계정에 권한을 준다**

    설정 → API 액세스 → 새로고침하면 목록에 그 계정이 보인다
      → 「액세스 권한 부여」
      계정 권한:  **재무 데이터, 주문 및 취소 설문지 보기**
                 **주문 및 구독 관리**
      앱 권한:    Copycat 선택
      → 초대 / 적용

**④ RevenueCat 에 올린다** — 4번의 그 칸에 ②의 JSON 파일을 넣는다.
검증에 몇 분~몇 시간 걸린다(구글 쪽 권한이 퍼지는 시간이다). 바로 안 되면 기다렸다 다시 본다.

### 4-1-3. RevenueCat 이 「Credentials need attention」이라고 할 때

2026-09-07 에 실제로 이렇게 떴다. 자격 증명은 붙었는데 **권한이 모자란 상태**다:

    ✅ Can validate Google Play subscription purchases
    ❓ Could not validate access to the Google Play in-app product catalog
    ❓ Could not validate access to the Google Play subscription catalog and base plans

셋을 따로 읽으면 이렇다 — **JSON 은 맞다**(첫 줄이 통과했다). 서비스 계정에게 **읽을 권한**을
안 준 것이다. Play 콘솔에서 준다:

    Play 콘솔 (계정 수준) → **사용자 및 권한** → 그 서비스 계정 줄
      (…@….iam.gserviceaccount.com) → 권한 수정 → **계정 권한** 탭

    [v] 앱 정보 보기 및 일괄 보고서 다운로드(읽기 전용)
        → in-app product catalog 를 읽는 권한이다
    [v] 재무 데이터, 주문, 취소 설문조사 응답 보기
        → subscription catalog · 결제 조회
    [v] 주문 및 구독 관리
        → 환불 처리에 필요하다(RevenueCat 이 환불 웹훅을 보내려면)

    → 변경사항 적용

그리고 Google Cloud 에서 **Google Play Android Developer API** 가 그 프로젝트에
사용 설정되어 있는지 본다(콘솔 → API 및 서비스 → 사용 설정된 API).

**권한은 바로 안 퍼진다.** 구글 쪽 전파에 보통 몇 분, 길면 하루가 걸린다 —
RevenueCat 의 「Check credentials」를 눌러 초록이 될 때까지 기다린다.
초록이 아니어도 **Public SDK key(`goog_…`)는 이미 보인다** — 그건 먼저 줘도 된다.
2. Apps → App Store 쪽에는 **App-Specific Shared Secret** 을 넣는다(영수증 검증용).
3. Products → 세 상품 코드를 양쪽에서 import.
4. Integrations → **Webhooks**
   - URL `https://<프로젝트>.supabase.co/functions/v1/parcel-purchase`
   - Header `Authorization: Bearer <아무거나 긴 문자열>`

## 5. Supabase — 표와 문

SQL 편집기에서 순서대로(이미 돌렸으면 건너뛴다):

    spike/supabase-parcel-pool.sql
    spike/supabase-parcel.sql
    spike/supabase-purchase.sql        -- parcel_products · purchases · purchase_apply()

`parcel_products` 의 세 행이 **스토어에 등록한 코드와 같은지** 확인한다(`live = true`).

웹훅을 받는 문:

    supabase functions deploy parcel-purchase --no-verify-jwt
    supabase secrets set RC_WEBHOOK_SECRET=<4-4 의 그 문자열>

`--no-verify-jwt` 인 이유: 부르는 쪽이 사람이 아니라 RevenueCat 이라 Supabase 토큰이 없다.
대신 그 비밀 문자열이 문을 지킨다.

## 5-2. 화면만 먼저 보고 싶을 때 — `?store=demo`

웹에서는 상점이 안 뜬다(플러그인이 없다). 틀만 보려면:

    http://localhost:8130/index.html?mobile=1&store=demo

값은 예시다(js/store.js 의 DEMO_ITEMS). **사는 것은 막혀 있다** — 눌러도 「데모 진열입니다」.

## 6. 나(코드) — 키 한 줄과 다시 굽기

`goog_…` 를 주면:

    js/store.js  KEYS.android = 'goog_…'
    node tools/pack-mobile.js && cd mobile && npx cap sync
    node spike/verify-store.js          # 34/34 유지되는지

## 7. 실제 결제 시험 — 내부 테스트에서

라이선스 테스터 계정으로 앱을 받아서:

1. 로그인한다(**appUserID = Supabase uid** 라 로그인 전에는 상점이 안 뜬다)
2. 택배 화면에 **상자 사기** 칸이 뜨는지
3. 한 묶음 사 보고 — 결제창 → 「결제됐습니다」 → **몇 초 뒤 잔액이 오르는지**
   (스토어 → RevenueCat → 웹훅 → `tickets` 를 도는 시간이다. `store.js settle()` 이 그동안 기다린다)
4. Supabase `purchases` 에 줄이 하나 늘었는지
5. 앱을 지웠다 깔고 **구매 복원**

iOS 는 TestFlight + Sandbox 계정으로 같은 순서.

## 8. 심사 전에 확인할 것 (이미 코드에 있다)

- 결제 전 고지 — 「결제 전에 읽어 주세요」(소모품·환불은 스토어·미성년자 안내·문의처)
- 구매 복원 단추 (애플 필수)
- 확률 공시 — 등급 확률 · 10연 확정 · 누적 보상 (`gaOddsHTML`)

---

## 함정 셋 (전에 실제로 겪었거나, 코드에 못 박아 둔 것)

1. **`getProducts` 의 `type` 기본값이 안드로이드에서는 구독**이다. 일회성 상품은 하나도
   안 오고 **오류 없이 상점 칸만 조용히 안 뜬다.** `NON_SUBSCRIPTION` 을 준다(코드에 있음,
   `verify-store.js` 가 지킨다).
2. **`pack-mobile` 을 건너뛰고 `cap sync`** 하면 옛 게임이 담긴다. `cap sync` 는 그 사실을
   말해 주지 않는다.
3. **appUserID 를 안 넘기면** RevenueCat 이 익명 id 를 만들고, 웹훅은 이 데이터베이스에
   없는 사람에게 상자를 주려다 실패한다. 게임은 Supabase uid 를 그대로 넘긴다(코드에 있음).
