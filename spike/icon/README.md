# 앱 아이콘 연구 — 사무실 배경 + 고양이 얼굴 (2026-09-27)

**질문.** 지금 아이콘(오트밀 판 + 검은 고양이 머리)은 단조롭다. 사무실을 배경으로
깔면서 고양이 얼굴이 48px 에서도 읽히려면 어떤 구도·조명이 맞나.

**규칙.** 게임 파일은 한 줄도 안 건드린다. 고양이는 게임이 구운 것(`assets/logo-cat.png`),
사무실은 게임 렌더러가 찍은 것(`bg/`), 합성만 여기서 한다. 넣는 것은 고른 뒤다.

## 만든 것

| 파일 | 하는 일 |
|---|---|
| `shoot-bg.js` | 게임을 헤드리스로 띄워 시간대 4 × 카메라 5 = 20장의 사무실 사진을 찍는다 → `bg/` |
| `studio.html` | 캔버스 합성기. 안(direction)마다 크롭·블러·워시·불빛·림·그늘·비네트 값을 들고 1024 로 굽는다. 브라우저로 열면 대조표까지 보인다 |
| `render.js` | `studio.html` 을 헤드리스로 열어 `out/<안>-1024.png` 와 `out/sheet.png`(크기 사다리) 저장 |
| `shoot-furn.js` | 가구 초상(`R3.furnPortrait`) 굽기 — **안 쓴다.** 색보정 없는 날것이라 사무실과 안 닮는다. 기록용 |

```
node spike/serve.js
node spike/icon/shoot-bg.js      # bg/ 가 없을 때만
node spike/icon/render.js        # → out/
```

## 조사한 것

- **스토어 규칙.** iOS 는 1024 정사각·알파 없음·모서리는 시스템이 깎음(iOS 26 은 Liquid Glass 로 유리 질감까지 얹음). Google Play 는 2026-03-31 부터 30% 모서리 자동 적용, 안쪽 15~18% 는 여백. 안드로이드 adaptive 는 가운데 67% 만 안전.
  ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons) ·
  [iOS 26 variants](https://www.applaunchflow.com/blog/ios-26-app-icon-sizes-variants) ·
  [Google Play 2026](https://theapplaunchpad.com/blog/google-play-app-icon-guidelines/))
- **게임 아이콘 관행.** 지배 요소 하나(캐릭터의 **얼굴**), 색 2~3, 밝은 홈·어두운 홈 양쪽에서 가장자리가 살아야 한다.
  ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-design-an-app-icon) ·
  [App Radar](https://appradar.com/blog/how-to-design-app-icons-for-your-game) ·
  [ASOMobile](https://asomobile.net/en/blog/app-icon-trends-and-best-practices-2025/))
- **GPT 디자인 답 2회**(`ask_gpt_about_image`). 1차: 안 4개를 수치로 받음. 2차 비평: 고른 림은 스티커, 턱 직선은 그늘로 가라앉혀라, D 를 밀어라.

## 안 다섯

| | 하늘 | 카메라 | 무엇을 노리나 |
|---|---|---|---|
| **A · Night Shift Window** | 오후 | 책상 높이 | 따뜻한 전구 사무실, 일하다 돌아본 얼굴 |
| B · Cubicle Eclipse | 낮 | 눈높이 | 형광등을 가린 실루엣 — 분리가 약해 탈락 |
| C · Desk Witness | 오후 | 게임의 높은 시점 | 사무실이 더 시끄럽다 — 탈락 |
| **D · After Hours Glass** | 밤 | 책상 높이 | 파란 창 + 스탠드 하나, 야근. 가장 개성 있음 |
| **E · Close-up** | 밤 | (D 와 같음) | 턱을 프레임 밖으로 — 얼굴이 아이콘을 채운다 |

## 알아낸 것 (숫자로)

1. **블러 22~40px(1024)은 사무실을 죽으로 만든다.** 6~14 로 내리고 대신 크롭을 1.25~1.7배 당겨 와야 책상·스탠드·창이 읽힌다.
2. **잘린 턱**(`bake-logo.js` BELOW=44 의 직선)은 밝은 배경 위에서 종이 인형이 된다. 고양이만 어둡히면 검은 네모가 회색 띠 위에 남는다(실측 턱 10 vs 옆 35). **고양이와 배경을 같은 덮개로** 턱선에서 α≈0.86 까지 가라앉혀야 사라진다(`dusk.stops`).
3. **림 라이트는 위쪽만, 약하게.** 고르게 두르면 스티커. D 는 찬 림 18% + 왼쪽 볼에만 따뜻한 빛 20%.
4. 눈의 반사점(크림 18~25px)은 32px 에서 살아남는 유일한 얼굴 정보다. 오른쪽 것을 2px 내리면 마스코트 대칭이 깨진다.
5. **어두운 홈 화면에서 D 는 32·24px 에서 가라앉는다**(대조표 가운데 줄). A 는 어디서나 뜬다. 밤이 개성이고 오후가 안전이다.

## 추천

**D** — 게임의 정체(같이 야근하는 고양이)를 아이콘 하나가 말한다. 어두운 배경 걱정이면 **A**.
E 는 D 의 색으로 얼굴을 더 키운 것 — 스토어 목록에서 제일 크게 보이지만 안드로이드 원형에서 입이 잘린다.

## 넣으려면

`tools/logo.js` 의 `drawRGBA` 가 판+고양이를 그리는 자리에 「합성본 1024 를 원본으로 쓰는 길」을 하나 더 두면 된다
(`--from spike/icon/out/D-afterhours-1024.png`). 웹 아이콘(icon-192/512)은 지금 투명인데 합성본은 불투명이라 그 둘만 판단이 필요하다.
iOS 는 알파 없음 그대로 통과, maskable 은 D·A 의 고양이가 67% 안에 있다.

## 다음

- 32·24px 전용 굽기(블러·워시를 크기마다 달리) — GPT 가 준 값이 `studio.html` 주석에 있다
- iOS 26 dark/tinted 변형: 배경 없이 고양이만(회색조) 한 벌
- 계절·시간대 아이콘(iOS alternate icon): 낮에는 A, 밤에는 D
