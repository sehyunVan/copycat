# mobile — 스토어에 올릴 껍데기

게임은 여기 없다. `../dist/android` 를 통째로 담는 **Capacitor 껍데기**다 —
웹 배포본과 앱이 같은 파일이어야 「폰에서만 나는 버그」가 안 생긴다.

 안드로이드 패키지  copycat.sarl        ← Play 앱 항목이 이 이름을 요구했다(2026-09-07).
                                        applicationId 만 바꾸고 자바 패키지(namespace)는
                                        sarl.copycat.app 그대로 뒀다 — AGP 는 둘을 따로 본다.
    iOS 번들        sarl.copycat.app    ← App Store 쪽은 그대로. 스토어가 다르면 달라도 된다
                                        올린 뒤에는 양쪽 다 못 바꾼다
    스토어명   Copycat Co.             ← App Store 에서 Copycat 이 이미 쓰이고 있다
    홈 화면명  Copycat                 ← 아이콘 밑은 11~12자에서 잘린다

## 고칠 때 순서

    node ../tools/pack-mobile.js     # 게임 → dist/android · dist/iphone
    npx cap sync                     # dist → android/ 와 ios/ 안으로

**`pack-mobile` 을 건너뛰면 옛 게임이 담긴다.** `cap sync` 는 이미 만들어진 것을
옮길 뿐이고, 그 사실을 말해 주지 않는다.

### webDir 이 왜 `dist/android` 인가 (iOS 도 이걸 쓴다)

Capacitor 는 플랫폼별 webDir 을 지원하지 않는다. `dist/iphone` 과의 차이는
**PWA 용 아이콘·스플래시뿐**이고(홈 화면에 추가하는 경로), 네이티브 껍데기는 아이콘도
스플래시도 Xcode·Android 애셋에서 가져간다. 그래서 한 벌만 쓴다.

---

## 안드로이드

### 명령줄 빌드는 JDK 를 골라 줘야 한다

기본 PATH 에 Java 8 이 있으면 Gradle 이 `Could not resolve com.android.tools.build`
로 죽는다. **Android Studio 안에서는 안 나는 오류라 한참 헤맨다.**

    export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"   # JDK 21

### 만들기

    cd android
    ./gradlew.bat assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
    ./gradlew.bat bundleRelease     # app/build/outputs/bundle/release/app-release.aab  ← Play 에 올리는 것

### 서명

`android/keystore.properties` 가 있을 때만 release 에 서명이 붙는다(없으면 서명 없이
그냥 만들어진다 — 열쇠 없는 기계에서도 빌드는 돌아야 한다). 형식은
`keystore.properties.example` 참고.

**열쇠는 `~/keys/copycat-upload.jks` 에 있고 저장소에 없다.** 잃으면 같은 앱을
업데이트할 수 없다 — `~/keys/README.txt` 를 읽을 것.

서명이 실제로 붙었는지는 **반드시 확인한다.** 설정을 적어 두고도 조건이 안 맞아
서명 없이 나가는 일이 흔하다:

    jarsigner -verify -certs app-release.aab      # "jar verified." 가 나와야 한다

---

## 아이폰 (맥에서)

윈도우에서는 프로젝트를 **만들어 둘 수만** 있다. Xcode 가 맥 전용이라 빌드·서명·업로드는
맥에서 한다. `ios/` 는 이미 만들어져 있으니 맥에서는 열기만 하면 된다.

    cd mobile
    npm install
    npx cap sync ios
    npx cap open ios          # Xcode 가 열린다

의존성은 CocoaPods 가 아니라 **Swift Package Manager** 로 들어간다(Capacitor 8).
Xcode 가 처음 열릴 때 패키지를 받으니 잠깐 기다린다.

### 윈도우에서 sync 를 돌렸다면 — 경로부터 고친다

의존성 목록(`ios/App/CapApp-SPM/Package.swift`)은 `cap sync` 가 쓴다. 그런데
**윈도우에서 돌리면 경로를 역슬래시로 적는다**:

    .package(name: "CapacitorApp", path: "..\..\..\node_modules\@capacitor\app")

Swift Package Manager 는 이걸 경로로 안 읽는다 — 맥에서 열면 의존성을 못 찾고 거기서
멈춘다. 파일에 「고치지 마라」고 적혀 있지만 그 CLI 가 윈도우에서 잘못 쓴 것이라 되돌린다:

    node tools/fix-ios-spm.js

**윈도우에서 `npx cap sync ios` 를 돌릴 때마다 다시 깨지므로 그 뒤에 같이 돌린다.**
맥에서 sync 를 돌렸으면 할 일이 없다(그쪽은 슬래시로 쓴다).

### 상자 사는 칸이 iOS 에서 뜨려면

코드는 플랫폼을 안 가린다 — `js/store.js` 에 `appl_…` 키가 이미 있고, 안드로이드
전용 분기는 한 줄도 없다. 화면이 뜨는 조건은 셋이며 **셋 다 스토어 쪽 일**이다:

1. App Store Connect 에 소모품 `box_05` · `box_12` · `box_30` (PAY.md 3)
2. **유료 앱 계약**이 활성 — 이게 비면 애플이 상품을 안 돌려준다 (PAY.md 3-4)
3. RevenueCat 의 App Store 앱에 번들 `sarl.copycat.app` 과 **App Store 공유 비밀**

셋 중 하나라도 비면 `getProducts` 가 빈 배열을 주고, 상점은 **일부러** 안 뜬다
(살 수 없는 단추를 그리지 않는다 — `js/store.js`).

### 스토어가 서기 전에 그 칸을 보려면 — StoreKit 테스트 파일

`mobile/ios/Copycat.storekit` 에 소모품 셋을 같은 코드(`box_05`·`box_12`·`box_30`)로
적어 뒀다. Xcode 가 이 파일을 보면 **App Store Connect 없이도** 상품을 돌려주므로,
개발 빌드에서 상자 사는 칸이 그대로 뜬다.

    Xcode → Product → Scheme → Edit Scheme… → Run → Options
      → StoreKit Configuration → **Copycat.storekit**

여기서 산 것은 **애플의 시험 거래**라 RevenueCat 웹훅이 안 울린다 — 즉 잔액은 안 오른다.
화면과 값·글자 길이를 보는 용도다. 진짜 결제 시험은 샌드박스 계정 + 실제 소모품으로 한다
(PAY.md 7). 웹에서 틀만 볼 때는 `?store=demo` 가 같은 일을 한다.

앱 버전은 안드로이드와 맞춰 둔다 — 지금 `MARKETING_VERSION 1.0.7` / 빌드 `7`.
게임 시작화면의 도장은 안드로이드 build.gradle 을 읽으므로, 두 쪽을 같이 올려야
도장과 스토어 표시가 어긋나지 않는다.

### Xcode 에서 한 번만 하는 것

1. 왼쪽에서 **App** 타깃 → **Signing & Capabilities**
2. **Team** 을 본인 계정으로
3. Bundle Identifier 가 `sarl.copycat.app` 인지 확인
4. `+ Capability` → **In-App Purchase** 추가

### 올리기

    Product → Archive → Distribute App → App Store Connect

---

## 결제

키와 흐름은 `../js/store.js` 머리말에 적혀 있다. 요약만:

- 게임에 실리는 것은 **공개 키**다. 이것만으로는 아무것도 못 산다
- 상자는 게임이 아니라 **RevenueCat 웹훅 → Supabase** 로 들어온다
- 지금 키는 `test_…` (RevenueCat 테스트 스토어). 스토어 계정이 붙으면
  `goog_…` / `appl_…` 로 바꾼다 — `js/store.js` 의 `KEY` 한 줄

상품 코드는 **서버 표(`parcel_products`)와 스토어 양쪽에 같은 값**이어야 한다:
`box_05` · `box_12` · `box_30`. 한 글자만 달라도 결제는 되고 상자는 안 들어온다.
