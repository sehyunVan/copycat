/* ============================================================
   eerie.js — 파스텔 사무실을 안개 낀 어두운 로우폴리로 갈아입힌다.

   레퍼런스는 "eerie low poly delivery game" 계열(Silent Hill × Animal Crossing).
   그 화면을 뜯어보면 네 가지가 같이 걸려 있다:

     1) 색이 빠져 있다 — 한 벌로 묶인 팔레트, 채도가 낮다
     2) 안개가 두껍다 — 방 저쪽이 배경색으로 녹아 없어진다
     3) 어둡고, 빛이 웅덩이로만 있다 — 전역광이 아니라 등 하나
     4) 해상도가 낮다 — 내부를 1/3 로 그리고 정수배로 늘려 픽셀이 각져 있다

   넷 다 쓴다. 다만 2(안개)는 한 번 뺐다가 **다시 넣었다** — 그 왕복을 적어 둔다.

   ── 안개: 뺐다가 다시 넣은 축 ──
   레퍼런스의 안개는 골목을 걷는 1인칭 게임의 것이고, 이 게임은 사무실 하나를 위에서
   내려다본다. 세게 걸면 뒤쪽 자리가 사라지고, 고양이가 20마리까지 늘어나는데 절반이
   안 보이면 그건 분위기가 아니라 정보 손실이다 — 그래서 한동안 없음으로 뒀다
   (spike/README "걸린 것 — 안개를 어디에 거는가", dist/shots/_fog3-*.png).

   2026-08-20 에 **기본으로 다시 켰다.** 없앤 판단이 틀렸다기보다, 그때 잰 것은 "세게"
   였고 지금 켜는 것은 시간대표의 fog 값(near 0.35~0.55 / far 1.45~1.60 화면 높이)이다.
   그 사이의 세기다. 정보 손실 여부는 **큰 사무실로 확인해야 하는 값**이고
   (spike/verify-fog.js), 세지면 그 시험이 먼저 걸린다.

   설정으로 열지 않는다 — 다시 안 여는 선택지는 설정이 아니라 기본값이다.
   비교는 콘솔에서 R3E.fog(false).

   render3d.js 를 갈아엎지 않는다. 켜는 곳은 네 군데뿐이고(init·night·fit·draw),
   끄면 원래 파스텔로 그대로 돌아온다 — 그림체는 되돌릴 수 있어야 실험이다.

   ── 이름에 대하여 ──
   실험은 "eerie(Silent Hill 계열)" 로 시작했고 파일 이름이 거기서 왔다. 두 번째 판에서
   값을 전부 따뜻한 쪽으로 옮겨서 **지금 이 그림체는 음산하지 않다** — 안개 낀 저녁 사무실이다.
   이름을 안 바꾼 이유는 spike/README 의 기록이 이 이름으로 두 판을 다 설명하고 있어서다.
   여기 값을 만질 사람은 "어두운 룩" 을 기대하고 오면 안 된다.

     기본값이 이것이다. 파스텔로 돌아가려면:
       ?style=pastel                          한 번만
       localStorage['copycat.style']='pastel'  계속 (설정창의 "사무실 톤")
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';
import { applyTone } from './tone.js';

/* **이 그림체로 고정.** 설정의 "사무실 톤" 스위치를 뺐으므로 저장값도 안 읽는다 —
   스위치 없이 저장값을 읽으면 예전에 파스텔로 바꿔 둔 사람이 갇힌다.
   ?style=pastel 은 개발용 비상구로 남긴다(팔레트 비교는 여전히 필요하다). */
export const ON = !/[?&]style=pastel/.test(location.search);

/* ---------- 그림체 ----------
   각진 상자에 모서리만 아주 얇게 깎는다(0.035). 완전히 각지면 딱딱하고,
   파스텔판(0.055 + smooth)만큼 깎으면 로우폴리가 아니라 그냥 둥근 장난감이 된다.
   면은 계속 flat 이라 각 면이 또렷하게 나뉜다 — 깎은 건 실루엣뿐이다. */
export const KIT = { prim:'round', bevel:0.035, voxel:0, shading:'flat', detail:1 };

/* ---------- 색 ----------
   회청색 한 벌이었다가 **따뜻한 중간톤 한 벌**로 옮겼다. 첫 판은 분위기는 났는데
   같이 있어 주는 방이 아니라 혼자 남은 방이었다 — 차가운 회색은 그 자체로 사람을 밀어낸다.

   기준 셋:
     · 바탕은 따뜻한 오트밀·크림. 회색이되 파란 쪽이 아니라 노란 쪽 회색이다
     · 색을 다 빼지 않는다. 천·화분·머그는 물이 빠진 채로 **자기 색을 갖고 있다**
       (완전 무채색 + 등불만 유채색 = 공포물의 문법이다)
     · 그래도 채도는 파스텔판보다 한참 낮다. 안개에 녹아야 하기 때문이다 */
export const PALETTE = {
  floor:    0xC7BAA7,   // 따뜻한 오트밀
  floorAlt: 0xBBAD99,
  lounge:   0xC59B95,
  wall:     0xD7CDBD,   // 크림 도는 회색 — 배경 안개와 같은 계열이라 멀수록 녹는다
  wallTrim: 0xBFB3A2,
  wood:     0xC79A6C,
  woodDark: 0x9A7350,
  metal:    0x9EA9BA,   // 의자·집기. 바닥이 따뜻하므로 이쪽은 찬 쪽으로 밀어 둔다
  metalDark:0x73808F,
  screen:   0x4B5661,   // 꺼진 CRT — 새까맣지 않다
  screenOn: 0xBCDCC0,   // 켜진 화면은 연한 민트. 병든 연두에서 여기까지가 이번 수정이다
  fabric:   0x8894B4,
  fabric2:  0xD09284,
  leaf:     0x8DB584,
  leafDark: 0x6D9569,
  pot:      0xC18B71,
  paper:    0xF2ECE0,
  ink:      0x4A423C,
  catnip:   0xA9CF87,
  /* 백열등. **2026-08-28 에 한 단계 데웠다**(0xFFD9A0 → 0xFFC87E). 방에 등을
     일곱 종류로 늘리고 나니 크림빛이 「따뜻한 흰빛」으로 읽혔다 — 등이 하나둘일 때는
     그게 은은한 것이었는데, 여럿이 모이면 은은한 게 아니라 **색이 없는 것**이 된다. */
  glow:     0xFFB65C,
  sky:      0xBDC9D3,
};

/* ---------- 시간대 ----------
   render3d.js 의 TIME 과 같은 모양이라 그대로 갈아 끼운다.
   더한 것은 셋: fog(가까운·먼 배율), lampColor, tint.

   `bg` 는 배경색이다. 안개를 켜면(R3E.fog(true)) 안개 색으로도 같이 쓰인다 —
   그때는 같은 안개라도 색이 어두우면 "저쪽에 뭐가 있다", 밝으면 "저쪽이 흐리다" 가 된다.
   앞의 것이 공포이고 뒤의 것이 아침이라, 밤 말고는 밝은 쪽(크림·살구)으로 올려 두었다.

   `fog` 값은 [near, far] 를 **화면 높이의 배수**로 말한다(카메라 거리 기준). 지금 쓰인다 —
   숫자는 세 단계를 비교해서 고른 절충안이다 — 앞 2/3 맑고 벽 근처만 녹는 값.

   밤도 검정이 아니라 **깊은 남색**이다. 검정은 방이 없어진 것이고
   남색은 방이 어두운 것이다 — 야근하는 고양이가 혼자 있으면 안 된다. */
/* ============================================================
   시간대 다섯 벌. 각 칸이 **빛과 필름을 같이** 들고 있다.

   ── 세 판을 헤매고 알아낸 것 ──
   레퍼런스 아홉 장은 한 장의 렌더를 그레이드한 것이다. 그래서 프레임 전체에 색이
   하나 덮여 있다. 그걸 조명으로 흉내 내려 하면 알베도(베이지 바닥·벽)가 계속
   비쳐 나와서 「○○ 기가 도는 베이지 사무실」이 된다. 그래서 듀오톤 단계를 만들었고
   (FRAG 의 uTint), 거기서 두 번째로 헤맸다:

     **듀오톤을 세게 걸어도 고르게 발리면 「색칠한 사무실」이다.**

   듀오톤은 어두운 데 세게, 밝은 데 약하게 걸리도록 짜여 있다. 그런데 전역광이 방을
   고르게 들어 올리고 있으면 화면 전체가 중간 밝기라 **그 반비례가 아무 일도 안 한다.**
   그래서 순서가 이렇게 된다:

     1) 먼저 어둡게 만든다 (hemi·sun 을 내린다)
     2) 그 다음 물들인다   (tintAmt)
     3) 밝은 것은 몇 개만 남긴다 (책상등 웅덩이 · 모니터 · 창)

   ── 넷째: 방과 창은 **반대로** 민다 ──
   방 전체를 물들이는 양(tintAmt)을 올리면 금세 「색칠한 사무실」이 된다. 눈은
   넓은 면의 채도에 민감하기 때문이다. 그래서 방은 거의 무채색까지 눌러 두고,
   **채도는 창 하나에 몰아준다**(pane). 화면에서 색이 살아 있는 것이 하나뿐이면
   그게 시간대를 말하고, 방은 그 색에 「물든」 것으로 읽힌다.
   양쪽 다 세게 걸면 서로를 지운다 — 창이 안 튀고 방만 쨍해진다.

   그리고 셋째로 알아낸 것: **창이 그 시간대를 제일 세게 말한다.** 밤은 밝은 파랑,
   노을은 타오르는 주황, 새벽은 날아간 흰색. 창까지 어두우면 그건 시간대가 아니라
   지하실이다. pane 값이 다른 어떤 값보다 크게 그림을 바꾼다.
   ============================================================ */
export const TIME = {
  /* ── 아침 · 안개 낀 새벽 ──
     **여기만 어둡게 안 한다.** 레퍼런스 7번은 어두운 그림이 아니라 **흐린** 그림이다 —
     밝기는 오히려 높고, 읽히는 것은 빠진 색(0.26)과 눌린 대비(0.84)와 들린 그늘이다.
     그래서 듀오톤도 거의 안 걸린다(밝아서 반비례가 작동한다). 그게 맞다.

     대신 이 시간대의 주인공은 **안개**다. near 0.14 는 다섯 중 제일 두껍고,
     이 값에서만 방 저쪽이 실제로 배경색에 녹는다. 창은 하얗게 날아간다(0.88). */
  /* **조명을 늘리면서 세 값을 만졌다**(2026-08-28 · 앞 값은 sat 0.26 · hemi 0.66 ·
     tint [0.96,0.99,1.06]). 방에 등을 여럿 놓고 나서 이 칸만 회색으로 남았다 —
     따뜻한 화소가 화면의 0.67% 였다(spike/verify-cozy.js).

     안개 낀 새벽이라는 이 칸의 정체는 그대로 둔다: 밝기(exp 0.96)도 대비(con 0.84)도
     안개(fog 0.14)도 안 건드렸다. 바꾼 것은 **등불이 살아남을 자리**뿐이다.
       sat  0.26 → 0.52   0.26 은 전구색까지 회색으로 만든다. 0.38 까지 올려도
                          모자랐다 — 방이 여전히 「등이 켜진 회색 방」이었다.
                          0.52 에서 처음으로 등불 웅덩이가 색으로 읽힌다.
                          그래도 다른 칸(오후 0.76 · 노을 0.80)보다 확실히 낮아서
                          「바랜 아침」이라는 이 칸의 성격은 유지된다
       tint 푸른 쪽 → 중립  새벽의 서늘함을 등불 웅덩이에까지 칠하고 있었다
       hemi 0.66 → 0.58   전역광이 방을 고르게 들면 웅덩이가 안 생긴다.
                          어둡게 만드는 게 아니라 **등이 할 일을 남겨 두는** 것이다
       lift 0.148 → 0.112 들린 그늘이 이 칸의 서명이지만, 0.148 은 **웅덩이가 앉을
                          바닥까지** 들어 올린다. 검은 데가 하나도 없는 화면에서는
                          등을 아무리 밝혀도 밝은 데가 안 생긴다 — 밤 칸이 3판까지
                          가서 배운 것이 정확히 이것이다(아래 night 절).
                          0.112 는 여전히 들려 있고, 그늘이 남는다
       hemi 색 · bg  찬 회색 → 따뜻한 회색. **마지막까지 남은 회색이 여기였다.**
                          위 셋을 고치고도 이 칸만 「등이 켜진 회색 방」이었는데,
                          이유는 등이 아니라 전역광이 파랬기 때문이다(0xCED6DE).
                          안개는 그대로 둔다(near 0.14 · 이 칸의 주인공) — 바뀐 것은
                          안개의 **색**이고, 찬 안개가 더운 안개가 되면 같은 흐린
                          아침이 「추운 새벽」에서 「빛이 도는 아침」이 된다.
                          찬 새벽으로 돌리고 싶으면 이 두 줄만 되돌리면 된다 */
  /* **다시 한 번 데웠다**(같은 날 두 번째). 위 네 줄로 회색은 벗었는데 레퍼런스로
     받은 폰 화면과 나란히 놓으니 여전히 다른 그림이었다 — 그쪽은 「흐린 아침」이 아니라
     **불 켜 둔 방**이고, 차이는 색이 아니라 **어둠**에 있었다. 등불이 고이려면 고일
     데가 어두워야 한다. 그래서 노출과 전역광을 내리고(exp 0.96→0.86 · hemi 0.58→0.44)
     그늘의 색을 주황 쪽으로 세게 걸었다(tintAmt 0.20→0.30).

     안개는 여전히 이 칸의 주인공이다(near 0.14, 다섯 중 제일 두껍다). 다만 안개 색이
     밝은 회색에서 **더운 흙빛**으로 옮겨서, 방 저쪽이 하얗게 녹는 대신 노랗게 녹는다. */
  morning: {
    tint:0xF2E2CC, bg:0xB09880,
    hemi:[0xF0DCC0, 0x8A7458, 0.44], sun:[0xFFF0DA, 0.16, [9, 5, -2]],
    fill:[0xD2C4B0, 0.28], lamp:0.50, lampColor:0xFFC47C,
    pane:[0xCCE2FA, 0.92], screen:0xD6E4E0, glow:0.52,
    fog:[0.14, 0.98],
    grade:{ exp:0.86, sat:0.66, con:0.90, vig:0.20, grain:0.018,
            lift:[0.078, 0.070, 0.062], gain:[1.020, 0.955, 0.870],
            tint:[1.16, 0.99, 0.80], tintAmt:0.36 },
  },
  /* ── 오전 · 레트로 필름 ──
     낡은 필름. 이것도 어두운 그림이 아니다 — 대비가 낮고(0.82) 그레인이 눈에 보이고
     (0.085, 다른 시간대의 세 배) 색이 한 색으로 바래 있다.

     **채도만 내리면 회색 사진이 된다.** 낡은 필름은 색이 빠진 게 아니라 **한 색으로
     바랜** 것이라, 채도를 내린 자리에 누런 기를 도로 넣어야 「오래된 사진」이 된다.
     그 일을 듀오톤이 한다. 리프트를 따뜻한 쪽에 두는 것도 같은 이유 —
     차가운 리프트는 새벽이 되고 따뜻한 리프트는 오래된 사진이 된다. */
  /* 여기도 두 값(앞 값은 sat 0.48 · hemi 0.52). 낡은 필름이라는 정체는 그대로다 —
     그레인(0.085)도 눌린 대비(0.82)도 바랜 리프트도 안 건드렸다. 바랜 사진에도
     **켜진 전구는 노랗게 찍힌다**. 그 한 가지만 통과시킨다. */
  /* 아침과 같은 이유로 같은 방향(exp 0.90→0.80 · hemi 0.46→0.36 · tintAmt 0.24→0.32).
     **그레인(0.085)은 안 건드렸다** — 이 칸을 오후와 가르는 것이 그 알갱이라,
     밝기와 색이 오후 쪽으로 가도 화면은 여전히 「낡은 필름」으로 읽힌다. */
  day: {
    tint:0xF2DEC2, bg:0x8E7A5E,
    hemi:[0xF2E0C6, 0x8C7A60, 0.36], sun:[0xFFF2DE, 0.44, [6, 15, 0]],
    fill:[0xC6B49C, 0.14], lamp:0.34, lampColor:0xFFC069,
    pane:[0xA8D0F2, 0.66], screen:0xC8DCC8, glow:0.50,
    fog:[0.50, 1.55],
    grade:{ exp:0.80, sat:0.72, con:0.92, vig:0.36, grain:0.085,
            lift:[0.082, 0.068, 0.052], gain:[1.040, 0.956, 0.852],
            tint:[1.18, 0.99, 0.78], tintAmt:0.38 },
  },
  /* ── 오후 · 웜 라이트 ──
     여기서부터 **어둡게 먼저**가 걸린다. 레퍼런스 8번은 밝은 방이 아니라
     「작은 안식처」다 — 방은 가라앉아 있고 전구색 빛이 고여 있다.
     그래서 hemi 를 0.52 에서 0.34 로 내리고 책상등을 0.34 에서 1.00 으로 올렸다.
     낮의 밝기를 그대로 두고 색만 데우면 「노란 사무실」이 된다.

     하루의 이야기로 보면 여기가 전환점이다: 오전 내내 바래 있던 색이(0.46)
     오후에 돌아온다(0.88). */
  afternoon: {
    tint:0xF8DCB8, bg:0x8A6844,
    hemi:[0xFFDCB0, 0x8C6E4E, 0.34], sun:[0xFFCE96, 0.34, [7, 11, 1]],
    fill:[0xC0A490, 0.14], lamp:1.00, lampColor:0xFFB050,
    pane:[0xFFC46A, 0.76], screen:0xC8DCC4, glow:0.62,
    fog:[0.46, 1.52],
    grade:{ exp:0.76, sat:0.76, con:1.14, vig:0.38, grain:0.026,
            lift:[0.062, 0.048, 0.034], gain:[1.045, 0.970, 0.885],
            tint:[1.18, 0.98, 0.76], tintAmt:0.38 },
  },
  /* ── 더 오후 · 선셋 데스크 ──
     **창이 주인공이다.** 레퍼런스 2번에서 제일 밝은 것은 노을이 든 창이고, 방은
     그 빛에 물든 어두운 주황이다. 그래서 hemi 를 0.26 까지 내리고 pane 을 0.95 로
     태운다 — 앞판은 방 전체가 고르게 주황이라 「주황 사무실」이었다.

     (빛자락이 방 안쪽 1.9칸까지 뻗어서 「저녁」을 말하는 데 hemi 보다 크게 기여했다.
     2026-08-25 에 창에서 들어오는 빛을 없앴으므로 이제 그 몫은 pane 과 tint 가 나눠 진다.)

     "따뜻하면서도 쓸쓸한" 의 쓸쓸함은 fill 에 있다 — 그늘만 보랏빛이다. */
  evening: {
    tint:0xFFBE8C, bg:0x6E3620,
    hemi:[0xFFA870, 0x6E4030, 0.26], sun:[0xFF7A34, 0.55, [10, 3.0, 2]],
    fill:[0x9C7EB0, 0.12], lamp:1.15, lampColor:0xFFA742,
    pane:[0xFF5E10, 0.98], screen:0xCCE0C8, glow:0.72,
    fog:[0.40, 1.48],
    grade:{ exp:0.70, sat:0.80, con:1.20, vig:0.44, grain:0.028,
            lift:[0.078, 0.044, 0.034], gain:[1.075, 0.942, 0.838],
            tint:[1.24, 0.95, 0.72], tintAmt:0.40 },
  },
  /* ── 밤 · 딥 블루 나이트 ──
     레퍼런스를 세 번 고쳐 가며 맞춘 칸이다. 처음 두 판이 왜 틀렸는지 적어 둔다.

     1판: hemi 를 남색으로 걸었다 → 「파란 기가 도는 베이지 사무실」. 알베도가 비친다.
     2판: 듀오톤을 세게 걸었다(0.72) → 「파랗게 칠한 사무실」. 고르게 발렸다.
          듀오톤은 어두운 데 세게 걸리도록 짜 놨는데(밝기 반비례) **장면에 어두운 데가
          없었다.** 전역광이 방을 고르게 들어 올리고 있어서 전부가 중간 밝기였고,
          그러면 밝기 반비례는 아무 일도 안 한다.
     3판(지금): **먼저 어둡게 만들고** 듀오톤을 건다. 그래야 어두운 데는 깊은 남색,
          책상등 웅덩이는 따뜻한 흰빛으로 갈라진다. 그 갈라짐이 이 룩의 전부다.

     그리고 레퍼런스에서 제일 파랗고 밝은 것은 벽도 바닥도 아니라 **창**이다.
     pane 0.55 → 0.92, 색도 남색에서 밝은 파랑으로. 창이 빛나야 밤이 「바깥이 있는 밤」이
     된다 — 창까지 어두우면 그건 밤이 아니라 지하실이다.

     책상등은 주황에서 **따뜻한 흰빛**으로 옮겼다(0xFFE0BC → 0xFFF0DC). 주황 웅덩이는
     노을과 같은 색이라 저녁과 밤이 구별이 안 된다. */
  night: {
    tint:0x8C9CC4, bg:0x0E1424,
    hemi:[0x44569C, 0x0E1220, 0.13], sun:[0x5A6EAC, 0.05, [-3, 9, -6]],
    fill:[0x4A5CA0, 0.07], lamp:1.45, lampColor:0xFFCE8A,
    pane:[0x2A6EE0, 0.96], screen:0xD8F0F2, glow:0.94,
    fog:[0.32, 1.40],
    grade:{ exp:0.62, sat:0.66, con:1.30, vig:0.52, grain:0.032,
            lift:[0.016, 0.024, 0.046], gain:[0.958, 0.968, 1.032],
            /* 밤에만 검정 바닥을 깐다. 남색으로 깔아서 「어두운 곳도 이 방의 색」이
               되게 한다 — 회색으로 깔면 구석만 빛바랜 사진이 된다. */
            floor:[0.040, 0.052, 0.082],
            /* 어두운 데를 남색으로 물들인다. 밝은 쪽 문턱을 낮춰(0.30 → 0.22) 등불
               웅덩이가 더 일찍 물들기를 벗어나게 했다 — 웅덩이까지 파래지면
               「모니터와 작은 조명이 비추는 공간」이 아니라 그냥 파란 사진이다. */
            tint:[0.70, 0.80, 1.13], tintAmt:0.40 },
  },
};

/* 그레이드 기본값 — 표에 grade 가 없는 시간대(옛 값·tone.js 실험판)를 위한 자리.
   패스를 만들 때 쓰는 값과 같아야 한다(createPass 의 uniforms). */
export const GRADE0 = { exp:0.80, sat:0.82, con:1.14, vig:0.32, grain:0.028,
                        lift:[0.052, 0.046, 0.042], gain:[1.000, 0.988, 0.962],
                        tint:[1, 1, 1], tintAmt:0, floor:[0, 0, 0] };

/* 톤 실험판(three/tone.js). ?tone=navy · ?tone=teal 일 때만 위 두 표를 자리에서
   갈아 끼운다 — 붙는 곳이 여기여야 render3d.js 가 PALETTE·TIME 을 읽기 전이다.
   인자 없이 들어오면 아무 일도 안 한다(= 지금 화면 그대로). */
export const TONE = applyTone(PALETTE, TIME);

/* ============================================================
   후처리 — 낮은 해상도 · 색 눌러 담기 · 비네트 · 그레인
   ============================================================ */

/* 내부 해상도 나누기. 3 이하는 안 각지고 4 이상은 글자가 죽는다 —
   다만 그건 **큰 화면 기준**이다. 위젯 모드(380px)에서 3.4 로 나누면 112px 짜리가 되어
   고양이가 덩어리 세 개로 남는다. 화면이 작을수록 덜 나눈다 — 각진 정도는
   "몇 배로 확대되는가" 가 아니라 "한 픽셀이 화면에서 몇 mm 인가" 로 읽히기 때문이다. */
function pxFor(w){
  if (w < 460) return 2.0;      // 위젯
  if (w < 820) return 2.6;      // 좁은 창 · 태블릿
  return 3.4;                   // 보통
}
/* 게임 쪽 씬. 시간대(night)가 안개를 여기에 넣는다. 컷신은 자기 것을 쓴다. */
let scene, camera;

/* 4x4 Bayer. GLSL ES 1.0 에서 mat4 를 변수로 인덱싱할 수 없어서 텍스처로 넘긴다 —
   상수 접기 트릭보다 이쪽이 짧고, 무엇보다 확실히 돈다.
   패스가 둘이어도 표는 하나면 된다 — 처음 부를 때 한 번 만들고 나눠 쓴다. */
let ditherTex = null;
function dither(){
  if (ditherTex) return ditherTex;
  const M = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
  const d = new Uint8Array(16 * 4);
  for (let i = 0; i < 16; i++){
    const v = Math.round(M[i] / 16 * 255);
    d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255;
  }
  const t = new THREE.DataTexture(d, 4, 4);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return (ditherTex = t);
}

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/* 렌더 타깃은 선형광이 그대로 담긴 상태다(타깃에 그릴 때 three 는 톤매핑·색공간 변환을
   건너뛴다). 그래서 노출·톤매핑·감마를 여기서 직접 한다 — 그 편이 단계 순서를 쥘 수 있다:
   톤매핑 → 감마 → 색보정 → 계단(디더) 순서라야 계단이 최종 화면 밝기 위에 얹힌다. */
const FRAG = `
precision highp float;
uniform sampler2D tSrc;
uniform sampler2D tDither;
uniform vec2  uRes;
uniform float uTime;
uniform float uExposure;
uniform float uLevels;
uniform float uSat;
uniform float uContrast;
uniform vec3  uLift;
uniform vec3  uGain;
uniform vec3  uTint;
uniform float uTintAmt;
uniform vec3  uFloor;
uniform float uVig;
uniform float uGrain;
varying vec2 vUv;

void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;

  /* 톤매핑 — 등불 웅덩이가 하얗게 타지 않게 어깨를 눕힌다 */
  c *= uExposure;
  c = c / (c + vec3(0.82));
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));

  /* 채도를 조금만 뺀다. 처음엔 0.34 까지 빼고 밝은 데만 색을 남겼는데,
     그러면 그늘에 들어간 물건이 전부 회색 덩어리가 된다 — 그게 음산함의 정체였다.
     지금은 전체를 살짝 빼고, 밝은 쪽을 오히려 더 살린다. */
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(y), c, uSat + (1.0 - uSat) * 0.55 * smoothstep(0.40, 0.92, y));

  /* ---------- 색 입히기(듀오톤) ----------
     **이 단계가 없어서 레퍼런스와 멀었다.** 앞의 리프트/게인은 이미 있는 색을 밀고 당길
     뿐이라, 베이지 바닥을 남색으로 만들지 못한다 — 조명을 파랗게 걸어도 알베도가
     계속 비쳐 나와서 「파란 기가 도는 베이지 방」이 된다. 레퍼런스의 아홉 장은
     한 장의 렌더를 통째로 물들인 것이고, 그 일을 하는 자리가 여기다.

     밝기(y)로 칠한 색과 원본을 섞는다. 밝기를 곱하므로 명암 구조는 안 무너지고
     색만 갈린다.

     **섞는 양이 밝기에 반비례한다.** 이게 요점이다 — 어두운 데는 세게 물들이고
     밝은 데는 놔둔다. 그래야 「남색 방에 뜬 따뜻한 등불 웅덩이」가 되고,
     고르게 섞으면 등불까지 파래져서 그냥 파란 사진이 된다. */
  vec3 duo = uTint * y;
  float tw = uTintAmt * (1.0 - smoothstep(0.22, 0.80, y));
  c = mix(c, duo, tw);

  /* 스플릿 톤 — 그늘은 푸르게, 밝은 데는 누렇게. 색이 두 개면 화면이 "밤" 이 된다 */
  c = uLift + c * (uGain - uLift);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);

  /* 비네트. 가장자리를 눌러 시야를 좁힌다 — 안개와 같은 일을 화면 밖에서 한 번 더 */
  float r = length((vUv - 0.5) * vec2(1.06, 1.0));
  c *= 1.0 - uVig * smoothstep(0.42, 0.86, r);

  /* ---------- 검정 바닥 ----------
     화면이 내려갈 수 있는 **가장 어두운 값**. 0 이면 아무 일도 안 한다.

     **왜 여기인가** — 위의 uLift 로 같은 일을 하려다 실패했다. 리프트는 대비보다
     앞에 있어서, 대비 1.30 을 지나면 (0.034-0.5)*1.3+0.5 = 0 으로 도로 뭉개진다.
     비네트까지 곱해지면 구석은 더 확실히 0 이다. 그래서 **전부 지난 뒤에** 깔아야 한다.

     이게 필요한 이유는 취향이 아니라 판정이다: 밤 사무실 구석에서 바닥과 고양이가
     둘 다 0 으로 눌리면 같은 색 단계에 들어가고, 고양이가 화면에서 사라진다
     (spike/verify-lamp.js). 어둠은 남기고 **뭉갬만** 없앤다 — 그 둘은 다른 것이다. */
  c = uFloor + c * (1.0 - uFloor);

  /* 그레인 — 어두운 데만. 밝은 데까지 뿌리면 지저분하기만 하다 */
  float n = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uGrain * (1.0 - smoothstep(0.0, 0.6, y));

  /* 색 단계 낮추기 + 오더드 디더. PS1 의 15비트 색이 이 계단에서 온다 */
  float d = texture2D(tDither, gl_FragCoord.xy / 4.0).r;
  c = floor(clamp(c, 0.0, 1.0) * (uLevels - 1.0) + d) / (uLevels - 1.0);

  gl_FragColor = vec4(c, 1.0);
}
`;


/* ============================================================
   패스 한 벌 = 인스턴스 하나.

   게임(render3d.js)과 프롤로그(three/opening.js)는 **렌더러를 따로 갖는다.**
   컷신이 격자와 아무 상관이 없어서 캔버스를 공유하지 않기 때문이다(opening.js 머리말).
   그래서 후처리도 모듈 전역이 아니라 인스턴스여야 한다 — 처음엔 전역 하나로 짰다가
   프롤로그를 붙이면서 갈랐다.

   opt.fog   'auto' 면 안개 거리를 카메라에서 매 프레임 계산한다(게임).
             false 면 씬이 이미 가진 안개를 그대로 둔다(컷신 — 장마다 값이 다르다).
   opt.flicker  등불 흔들기. 컷신은 자기가 빛을 애니메이션하므로 끈다.
   ============================================================ */
function createPass(renderer, scene, camera, opt = {}){
  const rt = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tSrc:{ value: rt.texture }, tDither:{ value: dither() },
      uRes:{ value: new THREE.Vector2(1, 1) }, uTime:{ value: 0 },
      /* 첫 판(어두운 eerie)의 값은 주석에 남긴다 — 되돌릴 수 있어야 실험이다.
         exposure .55 / denom .62 / sat .34 / contrast 1.18 / vig .70 / grain .06
         lift(.026,.036,.060) gain(.965,.985,1.00) */
      uExposure:{ value: 0.80 }, uLevels:{ value: 22 },
      uSat:{ value: 0.82 }, uContrast:{ value: 1.14 },
      /* 그늘을 살짝 들어 올린다 — 새까만 구석이 없으면 방이 무섭지 않다 */
      uLift:{ value: new THREE.Vector3(0.052, 0.046, 0.042) },
      uGain:{ value: new THREE.Vector3(1.00, 0.988, 0.962) },
      /* 비네트는 시야를 좁히는 장치다. 0.70 은 "누가 보고 있다" 가 되고
         0.32 는 "책상 스탠드 아래" 가 된다. */
      uVig:{ value: 0.32 }, uGrain:{ value: 0.028 },
      /* 색 입히기 — 시간대표가 써 넣는다(phase). 0 이면 아무 일도 안 한다. */
      uTint:{ value: new THREE.Vector3(1, 1, 1) }, uTintAmt:{ value: 0 },
      /* 검정 바닥 — 0 이면 지금까지와 같다 */
      uFloor:{ value: new THREE.Vector3(0, 0, 0) },
      ...(opt.uniforms || {}),
    },
  });
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quadScene.add(quad);
  const quadCam = new THREE.Camera();
  let frame = 0;

  /* 등불은 살짝 떨어야 한다. 완전히 고른 빛은 "조명" 이 아니라 "설정값" 으로 보인다.
     render3d.js 가 night() 에서 세기를 다시 쓰므로, 우리가 만진 값과 다르면
     그건 새 기준값이라고 보고 다시 잡는다. */
  function flicker(t){
    for (const o of scene.children){
      if (!o.isPointLight) continue;
      if (o.userData.eApplied === undefined || Math.abs(o.intensity - o.userData.eApplied) > 1e-4)
        o.userData.eBase = o.intensity;
      const ph = o.position.x * 1.7 + o.position.z * 2.3;
      /* 늙은 형광등처럼 툭 꺼지던 것을 뺐다. 지금은 백열등이 아주 느리게 숨쉬는 정도다 —
         깜빡임은 "고장" 이 아니라 "켜져 있다" 를 말해야 한다. */
      const k = 1 + 0.028 * Math.sin(t * 1.9 + ph) + 0.014 * Math.sin(t * 4.3 + ph * 2.1);
      o.intensity = o.userData.eBase * k;
      o.userData.eApplied = o.intensity;
    }
  }

  return {
    resize(w, h){
      const px = pxFor(w);
      const rw = Math.max(140, Math.round(w / px)), rh = Math.max(90, Math.round(h / px));
      rt.setSize(rw, rh);
      mat.uniforms.uRes.value.set(rw, rh);
    },
    render(){
      const t = frame++ / 60;
      mat.uniforms.uTime.value = t;

      /* 안개는 카메라 거리가 아니라 **화면에 담긴 넓이**를 따라간다.
         거리에만 비례시켰더니 다 당겨 보면 안개가 걷히고(near 가 같이 멀어진다)
         확대하면 코앞이 잠겼다 — 줌이 날씨를 바꾸면 안 된다.
         화면 세로 절반이 월드에서 몇 유닛인지(h)를 재고, 그 배수로 건다.

         기준점은 카메라가 아니라 **보고 있는 지점**(= 화면 한가운데 = dist)이다.
         fogK 는 거기서 화면 몇 장 앞뒤인지를 말한다. 0 이면 화면 한가운데부터 끼고,
         양수면 그보다 뒤에서 시작한다 — 앞쪽 절반이 맑아야 안개가 "분위기" 로 읽힌다.
         (카메라 기준으로 걸었더니 화면 전체가 안개에 잠겨 우유가 됐다.)

         시작점을 음수(-0.35)로 두었다가 양수(+0.55)로 옮겼다. 음수면 중간 책상부터
         흐려져서 **뒤쪽 절반이 없는 방**이 된다 — 고양이가 20마리까지 늘어나는 게임에서
         그건 분위기가 아니라 정보 손실이다. 지금은 앞 2/3가 맑고 벽 근처만 녹는다.
         안개를 아예 끈 것과 나란히 놓고 정했다(R3E.fog(false) · dist/shots/_fog-*.png). */
      if (opt.fog === 'auto' && scene.fog){
        const d = camera.userData.dist || 24;
        const h = d * Math.tan(camera.fov * Math.PI / 360);
        const k = scene.userData.fogK || [0.55, 1.55];
        scene.fog.near = Math.max(0.5, d + h * k[0]);
        scene.fog.far  = Math.max(scene.fog.near + 1, d + h * k[1]);
      }
      if (opt.flicker !== false) flicker(t);

      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
    set(k, v){
      if (!mat.uniforms[k]) return null;
      const u = mat.uniforms[k].value;
      if (u && u.isVector3 && Array.isArray(v)) u.set(v[0], v[1], v[2]);
      else mat.uniforms[k].value = v;
      return v;
    },
    stats(){
      return { rt:[rt.width, rt.height],
               fog: scene.fog ? [+scene.fog.near.toFixed(1), +scene.fog.far.toFixed(1)] : null };
    },
    dispose(){ rt.dispose(); mat.dispose(); quad.geometry.dispose(); },
  };
}

/* ============================================================
   초상 — 목록·기록증·면접창에 붙는 고양이 그림.

   여기만 셰이더를 못 태운다. 초상은 작은 캔버스에 **한 번 굽고 끝**이라
   (catsculpt.sculptPortrait) 매 프레임 도는 패스를 걸 자리가 없다.
   그래서 같은 식을 JS 로 한 번 더 쓴다 — 값은 아래 표 하나에서 같이 읽으므로
   화면과 초상이 따로 놀지 않는다.

   왜 필요한가: 초상은 스튜디오 조명(흰 반구 1.25 + 흰 키 1.7)으로 굽고 있었다.
   그 그림이 어두운 패널 위에 얹히면 **다른 게임에서 가져온 스티커**로 보인다.
   실제로 목록에서 분홍 고양이만 형광색이었다.
   ============================================================ */

/* 사무실 안에서 찍은 사진이어야 한다 — 스탠드 불빛(따뜻한 키)과 창(찬 필).
   시간대는 안 따라간다. 초상은 털색별로 한 번 구워 캐시하는 물건이고,
   목록이 저녁마다 다시 구워지면 그건 UI 가 아니라 애니메이션이다. */
export const PORTRAIT = {
  px:       1.9,                              // 굽는 해상도 나누기. 화면(3.4)보다 덜 나눈다 — 얼굴이 뭉개진다
  hemi:     [0xFFF2E2, 0x8C8072, 0.82],
  key:      [0xFFE0B4, 1.05, [-2, 3.4, 3]],   // 책상 스탠드
  fill:     [0x9FB2D4, 0.42, [3.2, 1.4, -2]], // 창 쪽 찬 빛
  /* 초상은 화면보다 대비를 세게 준다. 목록의 목적은 분위기가 아니라 **누가 누군지**이고,
     그늘을 화면만큼 들어 올리면 얼굴이 전부 같은 톤이 된다. */
  exposure: 1.02, sat: 0.86, contrast: 1.18, levels: 22,
  lift:     [0.030, 0.028, 0.026],
  gain:     [1.00, 0.986, 0.960],
};

/* 셰이더의 4x4 Bayer 와 같은 표. 곱하는 자리가 같아야 계단이 같은 자리에 생긴다. */
const BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* FRAG 과 같은 순서로: 톤매핑 → 감마 → 채도 → 스플릿톤 → 대비 → 계단(디더).
   비네트와 그레인은 뺀다 — 30px 짜리 얼굴에 비네트를 걸면 그냥 어두워지기만 한다. */
export function gradePixels(px, w, h){
  const P = PORTRAIT;
  const inv = 1 / 2.2, n = P.levels - 1;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const i = (y * w + x) * 4;
      if (px[i + 3] === 0) continue;           // 배경은 투명하게 남긴다
      const c = [px[i] / 255, px[i + 1] / 255, px[i + 2] / 255];
      for (let k = 0; k < 3; k++){
        /* 캔버스 값은 이미 sRGB 다(렌더러가 변환해서 내놓는다). 톤매핑은 선형에서 해야
           하므로 한 번 풀었다가 다시 감마를 씌운다 — 순서를 안 지키면
           같은 숫자를 넣어도 화면과 다른 색이 나온다. */
        let v = Math.pow(c[k], 2.2) * P.exposure;
        v = v / (v + 0.82);
        c[k] = Math.pow(clamp01(v), inv);
      }
      const yl = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
      const sat = P.sat + (1 - P.sat) * 0.55 * smoothstep(0.40, 0.92, yl);
      const d = BAYER[(y % 4) * 4 + (x % 4)] / 16;
      for (let k = 0; k < 3; k++){
        let v = yl + (c[k] - yl) * sat;
        v = P.lift[k] + v * (P.gain[k] - P.lift[k]);
        v = clamp01((v - 0.5) * P.contrast + 0.5);
        px[i + k] = Math.round(Math.floor(v * n + d) / n * 255);
      }
    }
  }
}

/* WebGL 캔버스를 정수배로 늘려 2D 캔버스에 옮기고 색을 입힌다.
   늘릴 때 보간을 끄는 게 핵심이다 — 부드럽게 늘리면 화면만 각지고 초상만 매끈해서
   오히려 더 눈에 띈다. 돌려주는 것은 data URL 이고, 실패하면 null 이다. */
export function bakePortrait(srcCanvas, size){
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcCanvas, 0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    gradePixels(img.data, size, size);
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  } catch(e){ return null; }
}

/* ---------- 프롤로그용 ----------
   컷신은 자기 렌더러·자기 안개·자기 조명을 갖는다. 여기서는 **질감만** 얹는다 —
   장면 연출은 STORY.md 가 정한 것이고 그림체가 그걸 덮으면 안 된다.
   ON 이 아니면 null 을 돌려준다. 부르는 쪽은 null 이면 그냥 원래대로 그린다. */
export function cutscenePass(renderer, scene, camera){
  return ON ? createPass(renderer, scene, camera, { fog:false, flicker:false }) : null;
}

/* ---------- 게임용 (싱글턴) ---------- */
let pass = null;

let fogObj = null;

export function install(rnd, scn, cam){
  if (pass) return;
  scene = scn; camera = cam;
  /* **안개는 끄고 시작한다** (2026-08-26).

     두 번 켰다 두 번 껐다. 이번에 끄는 이유는 취향이 아니라 실측이다 — 35번에서 문 표시
     네 안을 재면서 나온 것이: 낮의 안개가 화면을 이미 흐릿하게 밝혀 놓아서
     **작은 것이 아무것도 안 읽힌다**. 발광 테두리가 픽셀 단위로 0 이었던 이유가 그것이고,
     34번에서 가구 톤 아홉을 벌릴 때도 안개가 절반을 먹었다. 분위기 한 겹을 얻고
     정보를 여러 겹 잃고 있었다.

     스위치는 그대로 둔다 — 콘솔에서 `R3E.fog(true)` 로 켜서 나란히 볼 수 있다.
     주장에는 그것을 반증할 손잡이가 붙어 있어야 한다(이 파일의 원래 규칙이다).
     `scene.fog` 가 없으면 패스도 phase() 도 그냥 건너뛴다. */
  fogObj = null;
  pass = createPass(rnd, scn, cam, { fog:'auto' });
  fog(false);
  skin(true);
}

/* 안개 스위치. **기본은 꺼짐**이다 — 이 스위치가 없었을 때는 "안개가 이 그림체의
   전부다" 라는 말을 검증할 자리가 없었고, 붙여서 켜고 끈 채로 나란히 찍어 보고 뺐다.
   주장에는 그것을 반증할 손잡이가 붙어 있어야 한다.

     R3E.fog()        지금 켜져 있나 (기본 false)
     R3E.fog(true)    켠다 · R3E.fog(false) 끈다

   켜면 색·거리는 night() 가 다음 프레임에 넣으므로 값을 따로 안 들고 있는다.
   패스 쪽(render)과 phase() 모두 scene.fog 가 없으면 그냥 건너뛴다. */
export function fog(on){
  if (!scene) return null;
  if (on === undefined) return !!scene.fog;
  scene.fog = on ? (fogObj || (fogObj = new THREE.Fog(0x99A1A9, 20, 60))) : null;
  return !!scene.fog;
}

/* UI 색을 켜고 끈다. 3D 를 끄면(설정창) 도트 렌더러가 나오는데 그건 밝은 파스텔 그림이라
   어두운 UI 만 남으면 화면이 두 벌이 된다 — 그래서 렌더러와 같이 움직인다. */
export function skin(on){
  document.body.classList.toggle('eerie', !!on && ON);
}

export function resize(w, h){ if (pass) pass.resize(w, h); }
export function render(){ if (pass) pass.render(); }
export function set(k, v){ return pass ? pass.set(k, v) : null; }
export function stats(){ return pass ? pass.stats() : null; }

/* 시간대가 바뀔 때 안개를 같이 옮긴다. 안개 색이 배경색과 다르면
   멀리 있는 것이 배경 위에 유령처럼 떠 보인다 — 같은 값이어야 한다. */
/* 시간대가 바뀌면 **후처리도 같이 바뀐다.**

   이게 이 파일에서 제일 늦게 붙은 배선이다. 그전까지 시간대표는 빛만 정했고
   그레이드(채도·대비·리프트·그레인)는 패스에 한 번 박아 둔 고정값이었다.
   그래서 아침도 밤도 같은 필름으로 찍혔다 — 「안개 낀 새벽」과 「레트로 필름」의
   차이는 조명이 아니라 **현상 방식**인데, 그걸 말할 자리가 없었던 것이다.

   조명만으로 만들 수 없는 것 셋:
     · 색이 빠진 느낌  — 빛을 회색으로 만들면 방이 회색이 되지 물이 빠지진 않는다
     · 대비가 낮은 느낌 — 그늘을 들어 올리는 일이고, 광원으로는 못 한다
     · 그레인          — 아예 후처리의 것이다

   night() 이 매 프레임 부르지만 시간대 서명이 안 바뀌면 그쪽에서 먼저 돌아간다
   (render3d.js lastSky). 그래서 여기서 유니폼 쓰기를 아까워하지 않아도 된다. */
export function phase(p){
  if (!pass || !p) return;
  if (scene && scene.fog){
    scene.fog.color.setHex(p.bg);
    scene.userData.fogK = p.fog || [0.55, 1.55];
  }
  const g = p.grade || GRADE0;
  pass.set('uExposure', g.exp);
  pass.set('uSat',      g.sat);
  pass.set('uContrast', g.con);
  pass.set('uVig',      g.vig);
  pass.set('uGrain',    g.grain);
  pass.set('uLift',     g.lift);
  pass.set('uGain',     g.gain);
  pass.set('uTint',     g.tint || [1, 1, 1]);
  pass.set('uTintAmt',  g.tintAmt || 0);
  pass.set('uFloor',    g.floor || [0, 0, 0]);
}
