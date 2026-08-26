/* ============================================================
   tone.js — 사무실 톤앤매너 실험판. **기본값을 바꾸지 않는다.**

   왜 있나: 낮 사무실의 밝기 폭이 너무 좁다. 실제 화면(index-fog-mid-day.png)을
   재 보면 p10~p90 이 L 35.9~57.8, 폭이 **22밖에 안 된다.** 화면의 88%가 같은
   주황 계열이고 L 70 넘는 픽셀이 0.1%다. 그러면 민트 모니터·회청 의자·빨간 고양이가
   각자 다른 색인데 **밝기가 같아서** 액센트가 아니라 얼룩으로 읽힌다.
   색이 많아서 중구난방인 게 아니라, 색을 서열 지어 줄 밝기 구조가 없어서다.

   후처리(uSat·uLift·uGain)로 먼저 고쳐 봤고 **안 됐다.** 렌더 결과에 어두운 영역이
   아예 없으면 어떤 그레이드도 대비를 못 만든다. 탁해지기만 한다. 그래서 조명이다.

   게임은 이미 답을 두 군데서 갖고 있다:
     · 밤(eerie.TIME.night)  — hemi 0x7A88B0 찬 남색 + 등불 웅덩이. 낮보다 낫다
     · 프롤로그(opening.js)  — sky 0x2C6A66 청록 ambient + 약한 따뜻한 dir + 포인트라이트
   둘 다 「찬 배경 · 따뜻한 등불」이고, 이 파일은 그걸 낮에도 적용해 보는 것뿐이다.

   규칙 하나:  **넓은 면은 차갑고 어둡게, 빛과 작은 물건만 따뜻하게.**
     바닥·벽이 화면의 70%다. 그게 따뜻하고 밝으면 나무 책상이 배경과 같은 편이 되어
     아무것도 안 뜬다. 찬 빛 아래 두면 책상만 따뜻한 큰 물건이 되고 시선이 거기로 간다.

   **벽지·바닥 카탈로그(decor.js 벽 14종 · 바닥 14종)는 손대지 않는다.** 전부 따뜻한
   L 50~80 이지만, 찬 빛 아래 두면 알아서 식는다. 카탈로그를 다시 잡으면 이미 산
   사람의 사무실이 바뀐다 — 조명은 되돌릴 수 있고 그건 못 되돌린다.

   쓰는 법(개발용 비상구. 저장하지 않는다 — ?style=pastel 과 같은 규칙):
     ?tone=navy    남색/슬레이트. 첨부 레퍼런스 계열. 나무와 보색에 가까워 대비가 세다
     ?tone=teal    청록. 프롤로그와 같은 계열이라 게임 전체가 한 벌로 묶인다
     (없음)        지금 그대로
   ============================================================ */

export const TONE = (() => {
  const m = /[?&]tone=(navy|teal)/.exec(location.search);
  return m ? m[1] : '';
})();

/* ---------- 남색 ----------
   hemi 의 **하늘색이 바닥 윗면을 칠한다**(땅색은 밑면이다). 그래서 찬 방을 만드는
   손잡이는 hemi[0] 하나다. 세기는 같이 내린다 — 색만 바꾸고 세기를 두면
   파랗고 밝은 방이 되는데, 그건 「찬 배경」이 아니라 그냥 다른 색 형광등이다.

   fill 을 **따뜻하게 뒤집었다.** 원래는 그늘을 파랗게 하려고 파란 fill 을 넣었는데,
   hemi 가 이미 차면 그늘은 저절로 파랗다. 그 자리에 남는 일은 반대다 —
   나무 책상에서 튀는 따뜻한 반사. 그늘이 파란 게 아니라 등불이 되받는 것이다.

   lamp 를 낮에도 올린다(0.28 → 0.62). 웅덩이가 화면에서 유일하게 밝은 것이 되어야
   L 70 이상 픽셀이 생긴다. 지금은 그게 0.1% 다. */
const NAVY = {
  PALETTE: {},
  TIME: {
    morning: { tint:0xCBD2E2, bg:0x59617A, hemi:[0xA8B8DC, 0x474F66, 0.34], sun:[0xFFDCB4, 0.26, [9, 6, -2]],
               fill:[0xFFD2A4, 0.18], lamp:1.05, lampR:5.5, lampColor:0xFFD9A8, pane:[0xE8B98E, 0.32],
               screen:0xCFE4E8, glow:0.68, fog:[0.36, 1.50], win:[0.38, 1.80, 1.60] },
    day:     { tint:0xDCE2F0, bg:0x6C7794, hemi:[0x9DB2D8, 0x424B60, 0.44], sun:[0xFFE7C4, 0.52, [6, 15, 0]],
               fill:[0xFFD8B0, 0.14], lamp:0.62, lampR:5.5, lampColor:0xFFD2A0, pane:[0xC6D8EE, 0.34],
               screen:0xCFE4E8, glow:0.50, fog:[0.55, 1.55], win:[0.32, 0.85, 0.30] },
    afternoon:{ tint:0xE2DCE8, bg:0x746A84, hemi:[0xA6AAD0, 0x484A60, 0.42], sun:[0xFFDDB0, 0.50, [7, 11, 1]],
               fill:[0xFFD0A0, 0.14], lamp:0.85, lampColor:0xFFCE92, pane:[0xDCCCE0, 0.34],
               screen:0xCFE4E8, glow:0.58, fog:[0.50, 1.55], win:[0.36, 1.15, 0.70] },
    evening: { tint:0xE6C6C0, bg:0x6E5A72, hemi:[0xB09CC8, 0x4E4458, 0.32], sun:[0xFFA868, 0.58, [10, 3.5, 2]],
               fill:[0xFFC08C, 0.16], lamp:1.20, lampR:5.5, lampColor:0xFFC98A, pane:[0xFF9F60, 0.48],
               screen:0xD2E6E8, glow:0.70, fog:[0.45, 1.55], win:[0.64, 1.85, 1.70] },
    night:   { tint:0x9EA9CA, bg:0x232B3E, hemi:[0x6C7CAC, 0x2A3044, 0.26], sun:[0x7284B8, 0.16, [-3, 9, -6]],
               fill:[0xFFC48C, 0.10], lamp:1.60, lampR:5.5, lampColor:0xFFD09A,
               screen:0xD8ECEC, glow:0.90, pane:[0x252E4C, 0.44], fog:[0.35, 1.45], win:[0.24, 1.20, 0.85] },
  },
};

/* ---------- 청록 ----------
   프롤로그(opening.js office: sky 0x2C6A66)와 같은 계열. 다만 **그쪽보다 파란 쪽으로
   밀었다.** 벽지 밑색이 전부 노란 기 도는 베이지(#D7CDBD 등)라, 초록에 가까운 청록을
   걸면 벽이 완두콩색이 된다 — 폐건물엔 맞고 굴러가는 사무실엔 안 맞는다.
   그래서 hue 를 시안 쪽(0x8FBCC4 계열)으로 잡았다. */
const TEAL = {
  PALETTE: {},
  TIME: {
    morning: { tint:0xC6D4D4, bg:0x546A6C, hemi:[0x9CC0C6, 0x445658, 0.34], sun:[0xFFDCB4, 0.26, [9, 6, -2]],
               fill:[0xFFD2A4, 0.18], lamp:1.05, lampR:5.5, lampColor:0xFFD9A8, pane:[0xE8B98E, 0.32],
               screen:0xE2E0CE, glow:0.68, fog:[0.36, 1.50], win:[0.38, 1.80, 1.60] },
    day:     { tint:0xD8E4E2, bg:0x668084, hemi:[0x92BAC2, 0x3E5254, 0.44], sun:[0xFFE7C4, 0.52, [6, 15, 0]],
               fill:[0xFFD8B0, 0.14], lamp:0.62, lampR:5.5, lampColor:0xFFD2A0, pane:[0xC6DCE4, 0.34],
               screen:0xE2E0CE, glow:0.50, fog:[0.55, 1.55], win:[0.32, 0.85, 0.30] },
    afternoon:{ tint:0xDCE2DA, bg:0x6E7C78, hemi:[0x9CBCB2, 0x445250, 0.42], sun:[0xFFDDB0, 0.50, [7, 11, 1]],
               fill:[0xFFD0A0, 0.14], lamp:0.85, lampColor:0xFFCE92, pane:[0xCEDCD4, 0.34],
               screen:0xE2E0CE, glow:0.58, fog:[0.50, 1.55], win:[0.36, 1.15, 0.70] },
    evening: { tint:0xE4CCC0, bg:0x6C5E60, hemi:[0xAAA8B4, 0x4A4A4E, 0.32], sun:[0xFFA868, 0.58, [10, 3.5, 2]],
               fill:[0xFFC08C, 0.16], lamp:1.20, lampR:5.5, lampColor:0xFFC98A, pane:[0xFF9F60, 0.48],
               screen:0xE6E2CC, glow:0.70, fog:[0.45, 1.55], win:[0.64, 1.85, 1.70] },
    night:   { tint:0x94AEB0, bg:0x1E2E32, hemi:[0x5E8A90, 0x243438, 0.26], sun:[0x6E9298, 0.16, [-3, 9, -6]],
               fill:[0xFFC48C, 0.10], lamp:1.60, lampR:5.5, lampColor:0xFFD09A,
               screen:0xECE8D2, glow:0.90, pane:[0x20343A, 0.44], fog:[0.35, 1.45], win:[0.24, 1.20, 0.85] },
  },
};

const TABLE = { navy: NAVY, teal: TEAL };

/* ---------- 깊이(?k=) ----------
   위 두 표는 "찬 배경 · 따뜻한 등불" 을 **한 지점**에 찍어 둔 것뿐이다. 진짜 물음은
   그 다음이다 — 얼마나 어둡게 갈 수 있나. 이 게임은 켜 두고 곁눈질하는 화면이고
   고양이가 스무 마리까지 늘어난다. 방이 예뻐지다가 어느 지점에서 **고양이가 안 보이기
   시작한다.** 그 선은 취향이 아니라 한계이므로, 다이얼로 만들어 눈으로 찾는다.

   k=1  위 표 그대로 · k>1  ambient 를 내리고 등불을 올리고 배경을 어둡게
   지수가 서로 다른 이유: 셋을 같은 비율로 움직이면 그냥 노출만 내린 화면이 된다.
   ambient 를 제일 세게 내리고(0.85) 등불은 그만큼 안 올린다(0.55) — 그래야 밝은 것과
   어두운 것의 **차이**가 벌어진다. 노출이 아니라 대비를 만드는 게 목적이다. */
/* ---------- 등불 반경(?lr=) ----------
   세 번째 손잡이다. 깊이(k)만 돌려 보고 알았다: ambient 를 아무리 내려도 **바닥이 안
   식는다.** 책상 등이 반경 5.5칸짜리 포인트라이트인데(render3d.js 의 PointLight 넷째
   인자) 그게 여섯 개면 11×9 방을 통째로 덮는다. 그러면 밝기 폭은 벌어지는데 밝은 쪽이
   화면의 절반이라, 「찬 배경 + 따뜻한 웅덩이」가 아니라 그냥 주황 방이 된다.

   레퍼런스의 구조는 등 하나가 제 밑만 밝히고 **통로는 식어 있는** 것이다.
   그러려면 세기가 아니라 반경을 줄여야 한다.

   **기본값이 3.2 가 됐다**(render3d.js 의 LAMP_R). 이 다이얼은 그 위에서 더 좁히거나
   넓혀 보는 용도로 남는다 — ?lr=5.5 를 주면 예전 화면으로 돌아간다. */
const LR = (() => {
  const m = /[?&]lr=([\d.]+)/.exec(location.search);
  const v = m ? parseFloat(m[1]) : 0;
  return (isFinite(v) && v > 0.5 && v < 12) ? v : 0;
})();

const K = (() => {
  const m = /[?&]k=([\d.]+)/.exec(location.search);
  const v = m ? parseFloat(m[1]) : 1;
  return (isFinite(v) && v > 0.2 && v < 6) ? v : 1;
})();

const scale = (hex, f) => {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return (c[0] << 16) | (c[1] << 8) | c[2];
};

function deepen(e, k){
  if (k === 1) return e;
  e.hemi = [e.hemi[0], e.hemi[1], e.hemi[2] * Math.pow(k, -0.85)];
  e.sun  = [e.sun[0],  e.sun[1] * Math.pow(k, -0.70), e.sun[2]];
  e.fill = [e.fill[0], e.fill[1] * Math.pow(k, -0.50)];
  e.lamp = e.lamp * Math.pow(k, 0.55);
  /* 배경색도 같이 내려야 안개가 「저쪽이 어둡다」가 된다. 밝은 채로 두면 멀리 있는 것이
     하얗게 날아가서, 어둡게 만들수록 방 뒤쪽만 우유가 된다 — 그건 깊이가 아니라 안개다. */
  e.bg = scale(e.bg, Math.pow(k, -0.75));
  return e;
}

/* eerie.js 가 PALETTE·TIME 을 정의한 **직후** 한 번 부른다. 자리에서 갈아 끼운다 —
   render3d.js 는 두 객체를 그대로 들고 다니므로 새 객체를 주면 안 된다. */
export function applyTone(PALETTE, TIME){
  /* 반경 다이얼은 **계열과 무관하게** 걸린다 — 기본 화면에서 예전 반경으로 되돌려
     비교하는 게 이 다이얼의 첫 용도라(?lr=5.5), tone 없이도 들어야 한다. */
  const t = TABLE[TONE];
  if (t){
    Object.assign(PALETTE, t.PALETTE);
    for (const key of Object.keys(t.TIME))
      Object.assign(TIME[key], deepen({ ...t.TIME[key] }, K));
  }
  if (LR){
    /* **세기 보정을 뺐다.** 처음엔 "반경을 줄이면 웅덩이도 어두워지니 그만큼 올린다" 고
       보고 sqrt(5.5/LR) 을 곱했는데, 재 보니 틀린 전제였다. three 의 거리 제한은
       감쇠 곡선의 **꼬리만** 자른다 — 등 바로 밑(0.44칸)은 5.5든 3.2든 0.1% 도 차이가
       없고, 두 칸 밖에서야 26% 어두워진다. 보정을 넣으면 통로만 식히는 게 아니라
       책상 위가 원래보다 밝아진다. 그건 반경 다이얼이 아니라 노출 다이얼이다. */
    for (const key of Object.keys(TIME)) TIME[key].lampR = LR;
  }
  return (TONE || (LR ? 'base' : '')) + (TONE && K !== 1 ? '/k' + K : '') + (LR ? '/lr' + LR : '');
}
