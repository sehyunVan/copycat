# 폰 배포본

## 지금 폰에서 열 수 있는 주소

```
https://cc.165-227-196-68.sslip.io/n-S_SvLeaA4t/
```

열면 기기에 맞는 쪽이 위에 온다. **경로가 비밀이다** — 링크를 흘리면 그게 공개다
(호스트 이름은 Let's Encrypt 인증서가 발급되는 순간 Certificate Transparency 로그에
공개되므로 감춰지지 않는다. 그래서 토큰을 경로에 뒀다).

고친 것을 다시 올리려면:

```bash
node tools/pack-mobile.js
bash tools/deploy-mobile.sh          # 주소는 그대로 유지된다
node spike/verify-live.js            # 실제 주소에서 설치 조건·오프라인 검증
```

주소를 새로 발급하려면 `--new-token`. **폰 홈 화면에 얹어 둔 아이콘은 그때 죽는다**
(PWA 는 start_url 이 주소다) — 지우고 다시 추가해야 한다.

서버 쪽 설정은 `home/deploy/Caddyfile` 의 `cc.` 블록 하나다. 그 파일이 그 박스
Caddy 설정의 유일한 원본이라 거기에 뒀다 — 두 벌이 되면 다음에 사이트 쪽
`--caddy` 를 돌리는 순간 이 블록이 사라진다. **릴리스 뒤에는 그 블록을 지운다.**

세 가지가 나온다. 앞의 둘은 이 폴더 밖(`dist/`)이고, 셋째가 이 폴더의 일이다.

| 무엇 | 어디 | 어떻게 깐다 |
|---|---|---|
| 안드로이드 PWA | `dist/android/` | HTTPS 로 올린 뒤 크롬에서 **앱 설치** |
| 아이폰 PWA | `dist/iphone/` | HTTPS 로 올린 뒤 사파리에서 **공유 → 홈 화면에 추가** |
| 안드로이드 APK | `dist/copycat-android-debug.apk` | 파일 그대로 설치 (itch.io 에 올려도 된다) |

## 만드는 순서

```
node tools/pack-mobile.js          # dist/android · dist/iphone (아이콘·시작화면·SW 포함)
npx cap sync android               # 그 중 android 를 APK 껍데기에 복사
node tools/android-icons.js        # 런처 아이콘·시작 배경색·세로 고정 (Capacitor 기본값을 덮는다)
cd android && gradlew.bat assembleDebug
```

`cap sync` 뒤에 `android-icons.js` 를 **다시** 돌려야 한다 — sync 가 Capacitor 기본
리소스를 되돌려 놓는 경우가 있다. 순서를 바꾸면 홈 화면에 Capacitor 로고가 뜬다.

필요한 환경변수(이 기계 기준):

```
JAVA_HOME=C:\Program Files\Android\Android Studio\jbr      (JDK 21)
ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
```

`android/local.properties` 에 `sdk.dir` 이 있어야 한다. 백슬래시를 두 번 써야 한다
(`.properties` 에서 `\` 는 이스케이프 문자다) — 안 하면 경로가 조용히 깨진다.

## 왜 PWA 가 먼저인가

이 게임은 웹이 원본이다. 껍데기(Capacitor)는 그 웹을 WebView 에 담은 것이고,
**게임 파일은 `dist/android` 와 APK 안이 완전히 같다.** 그래서 고칠 곳이 하나다.
PWA 로 먼저 내면 링크 하나로 양쪽 폰에 깔리고, 스토어 심사도 계정도 필요 없다.

## 아이폰 `.ipa` 는 이 기계에서 못 만든다

도구가 없어서가 아니라 애플의 제약이다. `.ipa` 는 **macOS + Xcode** 로만 서명·빌드된다.
그리고 App Store 에 올리려면 애플 개발자 계정(연 $99)이 있어야 한다.

Mac 이 생기면 이어받는 길은 짧다 — 이 폴더를 그대로 들고 가서:

```
npx cap add ios
node tools/make-icons.js           # apple-touch-icon-1024.png 가 App Store 아이콘이다
npx cap sync ios
npx cap open ios                   # Xcode 에서 서명 팀만 고르면 빌드된다
```

그때까지 아이폰 쪽은 `dist/iphone/` (홈 화면에 추가)로 충분하다. 전체화면으로 뜨고,
아이콘이 붙고, 인터넷 없이 돌고, 저장도 남는다 — 다른 점은 App Store 에 없다는 것뿐이다.

## 릴리스 서명은 일부러 안 했다

지금 나오는 것은 **debug 서명** APK 다. 사이드로드와 itch.io 에는 그대로 쓸 수 있다.
릴리스 키스토어를 여기서 만들지 않은 이유: 그 키는 **앱의 신원**이고, 잃으면 Play 스토어에서
같은 앱을 다시는 업데이트할 수 없다. 남이 만들어 리포지토리에 넣어 둘 물건이 아니다.

Play 스토어에 올릴 때가 되면:

```
keytool -genkey -v -keystore copycat.jks -alias copycat -keyalg RSA -keysize 2048 -validity 10000
# android/key.properties 에 경로·비밀번호를 적고 (버전 관리에 넣지 않는다)
cd android && gradlew.bat bundleRelease      # .aab — Play 는 apk 가 아니라 aab 를 받는다
```

## 확인한 것 / 안 한 것

**확인:** 두 PWA 가 폰 크기에서 뜨고, 서비스 워커가 페이지를 장악하고,
**네트워크를 끊고 새로 고쳐도 3D 까지 올라온다**(`node spike/verify-mobile.js`).
APK 는 빌드·설치·실행되고 Capacitor 가 게임 파일 전부를 서빙한다(JS 오류 0).

**안 한 것:** 실기기 테스트. 에뮬레이터는 소프트웨어 렌더링으로 3D 를 돌리다
자기 시스템 프로세스가 ANR 났다 — 게임은 그 뒤에서 정상으로 떠 있었지만
(`spike/ui/apk-2.png`), 손가락으로 만져 본 것은 아니다. 안전 영역(홈 인디케이터)과
터치 치수는 실기기에서 한 번 봐야 한다.

## 올려 놓고 실제 HTTPS 에서 잡은 것 둘

localhost 에서 전부 통과한 뒤에도 실제 서버에서 두 번 실패했다. 둘 다 **조용한 실패**였다 —
게임은 멀쩡히 돌고 오프라인만 안 켜지는 종류라, 폰에서 눈으로는 절대 못 잡는다.

1. **sw.js 가 문법적으로 깨져 나갔다.** `pack-mobile.js` 가 sw.js 를 **템플릿 리터럴 안에서**
   써 내는데, 그 안의 `\/` 를 리터럴이 먹어서 `/\/assets\//` 가 `//assets//` 가 됐다 —
   즉 **줄 주석**. 서비스 워커 등록이 거부됐고, 등록 실패를 `.catch(() => {})` 로 삼키고
   있었기 때문에 원인을 세 번 헛짚었다.
   고친 것 셋: 정규식을 `indexOf` 로 바꿨고(이스케이프가 아예 없다), 등록 실패를
   `console.warn` 으로 내보내고, **빌드가 sw.js 를 파싱해 본다**(`vm.Script`) —
   깨진 서비스 워커는 다시는 나갈 수 없다.

2. **등록을 `load` 이벤트에 걸어 뒀다.** 이 게임은 `<audio>` 에 몇 MB 짜리 파일을 걸어 두므로
   실제 서버에서는 `load` 가 한참 안 오거나 아예 안 온다. localhost 에서는 그 다운로드가
   몇 초라 통과했고, 그 차이가 첫 실패의 비대칭(android 만 실패)을 만들었다.
   지금은 **기다리지 않고 바로 등록**하고, 무거운 파일(음악·목소리 21MB)은 프리캐시에서
   빼서 뒤로 미룬다 — 그것들은 `fetch` 핸들러가 들을 때 캐시에 들어간다.

그 밖에 서버 쪽에서 고친 것: `.webmanifest` 의 Content-Type 이 **아예 없었다**(Go 의 mime
표에 없다). Caddy 의 인라인 경로 매처(`header /*.webmanifest ...`)는 조용히 아무것도
안 잡아서, 같은 파일의 사이트 블록이 이미 쓰던 **명명 매처**(`@manifest path *.webmanifest`)
형식으로 바꿔야 했다.
