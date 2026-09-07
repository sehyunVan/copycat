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
