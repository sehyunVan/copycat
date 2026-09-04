/* ============================================================
   chibi.js — 고양이를 **캐릭터로** 깎는다.

   sculpt.js 의 고양이는 네 발 짐승이다. 그건 실수가 아니라 목표였다 —
   레퍼런스 ①이 프린트 피규어였고, 피규어는 옆에서 봤을 때 완성된다.

   이번 레퍼런스는 반대쪽에 있다. **정면에서 완성되는 물건**이다.
   그래서 조형을 고치는 게 아니라 다시 적는다. 파이프라인(거리장 → 녹임 →
   surface nets → flat)은 통째로 sculpt.js 것을 빌린다. 바뀌는 건 뼈대뿐이다.

   ── 레퍼런스에서 읽은 것 다섯 ──

   ① **머리가 전부다.** 귀까지 넣으면 키의 2/3. sculpt.js 의 FIG 는 40%다
   ② **귀가 머리에 얹힌 게 아니라 머리의 일부다.** 실루엣이 왕관 하나로 읽힌다
   ③ **다리가 없다.** 발은 몸에서 자라지 않고 **떠 있는 공**이다.
      다리를 지우는 순간 3D 인데도 2D 도형처럼 읽힌다 — 캐릭터화의 제일 큰 한 수였다
   ④ **눈이 얼굴의 주인공이다.** 피규어 규칙("이목구비가 작아야 조형이 주인공")의 정반대
   ⑤ **같은 캐릭터가 둥글기도 하고 뾰족하기도 하다.** 표정이 아니라 **실루엣이 감정이다**

   ⑤가 이 파일의 유일한 손잡이다: `mood` 0 → 1.
   녹임(k)을 줄이고, 귀를 늘이고, 머리에서 가시를 꺼낸다. 얼굴은 손대지 않는다.

   좌표 규약은 sculpt.js 와 같다 — 1 타일 = 1 유닛, Y 위, +Z 를 본다, 발바닥이 y=0.
   ============================================================ */

import { mesh } from './sculpt.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* 기준형 — 둥근 쪽(mood 0). 뾰족한 쪽은 이 값에서 mood 가 끌고 간다. */
export const CHAR = {
  scale: 1,
  res: 44,          // 캐릭터는 면이 커도 되지만 귀 끝이 셀보다 얇아지면 톱니가 된다
  relax: 1,
  k: 0.042,          // 둥근 끝. mood 가 이걸 0.006 까지 끌어내린다

  /* 0 둥근 것 ↔ 1 뾰족한 것. 이 파일이 하는 얘기의 전부 */
  mood: 0,

  /* 머리 — 몸이 아니라 이게 캐릭터다.
     앞뒤로 눌러야(headSz) 이목구비가 얹힐 면이 생기는 건 sculpt.js 와 같다.
     다른 건 headZ 다: 네 발 고양이는 머리를 몸 앞에 내밀지만 정면 캐릭터는 몸 위에 얹는다 */
  headR: 0.340, headSx: 1.30, headSy: 0.80, headSz: 0.62,
  headY: 0.620, headZ: 0.010,

  /* 볼 — 턱을 넓혀 얼굴을 사다리꼴로 만든다. 원이면 캐릭터가 아니라 이모지가 된다 */
  cheek: 0.125, cheekY: -0.055, cheekZ: 0.0, cheekK: 0.070,
  /* 턱 — 아래를 좁혀 하트/왕관 실루엣을 만든다. 0 이면 그냥 공 */
  chin: 0.062, chinY: -0.80, chinK: 0.070,

  /* 귀 — 머리와 **한 덩어리로 녹인다**(earK 가 크다). 이게 ②다.
     sculpt.js 는 earK 0.05 로 얹었고 여기는 0.11 로 녹인다 */
  earH: 0.400, earR: 0.195, earTip: 0.032,
  earSpread: 0.305, earTilt: 0.140, earLean: -0.010,
  earFlat: 1.95,          // 앞뒤로 누르기. 클수록 얇다
  earSink: 0.14,          // 귀 밑동이 머리 안으로 얼마나 들어가는가
  earK: 0.105,

  /* 몸 — 머리 밑의 받침. 레퍼런스에서 몸은 거의 안 보인다.
     굵기를 올리면 즉시 눈사람이 된다 */
  bodyR: 0.135, bodySx: 1.05, bodySy: 1.0, bodySz: 0.92,
  bodyH: 0.115, bodyY: 0.245, bodyZ: -0.010, neckK: 0.062,

  /* 발 — ③. 몸에 붙지 않은 공 두 개(또는 넷).
     arm 을 켜면 팔이 자라고, 그 순간 캐릭터가 인형에서 동물로 반쯤 돌아간다 */
  mittR: 0.112, mittSpread: 0.185, mittY: 0.108, mittZ: 0.105,
  mittSq: [1, 1.10, 0.94], mittK: 0.018,
  arm: 0,                 // 0 = 떠 있음 · >0 = 몸에서 팔이 자란다 (굵기)
  armK: 0.045,
  hind: 0,                // >0 이면 뒷발 두 개를 더 놓는다 (네 발 흉내)
  hindZ: -0.145,

  /* 꼬리 — 정면 컷에서는 안 보이고 옆 컷에서만 산다 */
  tail: 1, tailLen: 0.36, tailR: 0.052, tailTip: 0.034, tailBulb: 1.30,
  tailUp: 0.55, tailCurl: 0.30, tailSeg: 3, tailK: 0.038,
  tailY: 0.200, tailZ: -0.150,

  /* 가시 — mood 가 켜는 것. [머리 위에서 잰 각도(도), 길이 배율, 밑동 배율].
     각도는 +Y 에서 바깥으로 돌린 값이고 좌우 대칭으로 두 개씩 난다.
     귀(0°대) 자리는 비워 둔다 — 거기는 귀가 이미 있다 */
  spikes: [[70, 0.85, 1.00], [118, 0.60, 0.80]],
  spikeR: 0.145,          // 밑동 굵기 기준. 셀보다 확실히 굵어야 격자가 잡는다
  spikeTip: 0.014,        // 끝 굵기 — 0 으로 두면 셀보다 얇아져 톱니가 된다
  spikeFlat: 2.35,        // 앞뒤로 눌러 **바늘이 아니라 날**로 만든다
  spikeK: 0.020,
  spikeOn: 0.10,          // mood 가 이 값을 넘어야 가시가 나온다
};

/* mood 가 실제로 무엇을 바꾸는가 — 한 곳에 모아 둔다.
   여기 흩어져 있으면 "감정이 실루엣이다" 가 코드에서 안 보인다. */
export function morph(P){
  const m = clamp01(P.mood);
  return {
    ...P,
    /* 녹임을 끈다. 이게 제일 크다 — 같은 캡슐이라도 k 가 0 에 가까우면
       이음매가 각지고, 각진 이음매는 "붙인 것"으로 읽힌다 */
    k:      lerp(P.k,      0.006, m),
    neckK:  lerp(P.neckK,  0.030, m),
    earK:   lerp(P.earK,   0.022, m),
    cheekK: lerp(P.cheekK, 0.025, m),
    chinK:  lerp(P.chinK,  0.030, m),
    relax:  m > 0.55 ? 0 : P.relax,       // 완화까지 끄면 격자 계단이 각으로 남는다
    /* 뾰족한 쪽은 **면을 더 잘게 깎아야 한다.** 날이 셀보다 얇아지면 가장자리가
       톱니가 되는데, 그건 로우폴리가 아니라 그냥 깨진 것으로 보인다.
       그래서 기분이 나쁠수록 삼각형이 는다 — 이 방식이 무는 값이다 */
    res:    Math.round(P.res * lerp(1, 1.35, m)),
    /* 귀 — 뭉툭하고 둥근 것에서 길고 얇은 것으로.
       끝(earTip)을 같이 흔드는 게 크다. 길이만 늘이면 "긴 귀"지 "날"이 아니다 */
    earH:     P.earH     * lerp(0.92, 1.62, m),
    earR:     P.earR     * lerp(1.12, 0.84, m),
    earTip:   P.earTip   * lerp(1.55, 0.58, m),
    earTilt:  lerp(P.earTilt, P.earTilt + 0.16, m),
    earFlat:  lerp(P.earFlat, P.earFlat + 0.45, m),
    /* 머리 — 세로로 조금 서고 볼이 빠진다. 둥근 살이 빠져야 각이 보인다 */
    headR:  P.headR  * lerp(1, 0.88, m),
    headSx: P.headSx * lerp(1, 0.95, m),      // 얼굴이 좁아진다
    headSy: P.headSy * lerp(1, 1.10, m),
    cheek:  P.cheek  * lerp(1, 0.55, m),
    chin:   P.chin   * lerp(1, 0.70, m),
    /* 발 — 벌어지고 들린다. 화난 것은 발이 바닥에서 뜬다 */
    mittSpread: P.mittSpread * lerp(1, 1.16, m),
    mittY:      P.mittY      * lerp(1, 1.30, m),
    _m: m,
  };
}

/* ============================================================
   뼈대 — sculpt.js 의 skeleton() 과 같은 계약을 지킨다.
   캡슐 하나는 { a, b, r1, r2, k, sq }. 마지막에 bb 를 붙여 돌려준다.
   ============================================================ */
export function skeleton(raw){
  const P = morph(raw);
  const S = [];
  const add = o => (S.push(o), o);
  const m = P._m;

  const hx = P.headR * P.headSx, hy = P.headR * P.headSy;

  /* 머리 */
  add({ bone:'head', a:[0, P.headY, P.headZ], b:[0, P.headY, P.headZ],
        r1: P.headR, r2: P.headR, k: P.neckK,
        sq:[1 / P.headSx, 1 / P.headSy, 1 / P.headSz] });

  /* 볼 — 좌우로 넓힌다 */
  if (P.cheek > 0)
    for (const s of [1, -1])
      add({ bone:'head', a:[s * hx * 0.60, P.headY + P.cheekY * P.headR, P.headZ + P.cheekZ],
            b:[s * hx * 0.60, P.headY + P.cheekY * P.headR, P.headZ + P.cheekZ],
            r1: P.cheek, r2: P.cheek, k: P.cheekK, sq:[1, 1.10, 1.25] });

  /* 턱 — 아래를 좁혀 실루엣을 사다리꼴로 */
  if (P.chin > 0)
    add({ bone:'head', a:[0, P.headY + P.chinY * hy, P.headZ + 0.010],
          b:[0, P.headY + P.chinY * hy, P.headZ + 0.010],
          r1: P.chin, r2: P.chin, k: P.chinK, sq:[0.86, 1.15, 1.05] });

  /* 귀 — 밑동을 머리 안쪽에 박고(earSink) 머리와 같은 k 로 녹인다 */
  const ey = P.headY + hy * P.earSink;
  for (const s of [1, -1])
    add({ bone:'ear' + (s > 0 ? 'R' : 'L'),
          a:[s * P.earSpread, ey, P.headZ + P.earLean],
          b:[s * (P.earSpread + P.earTilt), ey + P.earH, P.headZ + P.earLean * 1.8],
          r1: P.earR, r2: P.earTip, k: P.earK, sq:[1, 1, P.earFlat] });

  /* 몸 — 짧은 기둥. 머리에 절반쯤 파묻힌다 */
  add({ bone:'body',
        a:[0, P.bodyY - P.bodyH / 2, P.bodyZ], b:[0, P.bodyY + P.bodyH / 2, P.bodyZ],
        r1: P.bodyR, r2: P.bodyR * 0.94, k: P.neckK,
        sq:[1 / P.bodySx, 1 / P.bodySy, 1 / P.bodySz] });

  /* 발 — 떠 있는 공. arm 이 0 이면 몸과 안 만난다 */
  const mitts = [];
  const put = (x, y, z, tag) => {
    add({ bone:'mitt' + tag, a:[x, y, z], b:[x, y, z + 0.008],
          r1: P.mittR, r2: P.mittR, k: P.mittK, sq: P.mittSq });
    mitts.push({ tag, p:[x, y, z], r: P.mittR });
  };
  for (const s of [1, -1]) put(s * P.mittSpread, P.mittY, P.mittZ, s > 0 ? 'R' : 'L');
  if (P.hind > 0)
    for (const s of [1, -1])
      put(s * P.mittSpread * 1.05, P.mittR * 0.95, P.hindZ, s > 0 ? 'HR' : 'HL');

  /* 팔 — 켜면 발이 몸에 붙는다. 캐릭터가 인형에서 동물 쪽으로 반쯤 돌아간다 */
  if (P.arm > 0)
    for (const s of [1, -1])
      add({ bone:'arm' + (s > 0 ? 'R' : 'L'),
            a:[s * P.bodyR * 0.72, P.bodyY + P.bodyH * 0.30, P.bodyZ],
            b:[s * P.mittSpread, P.mittY, P.mittZ],
            r1: P.arm, r2: P.arm * 0.88, k: P.armK });

  /* 꼬리 — sculpt.js 와 같은 방식. 뿌리에서 각도를 조금씩 더하며 올라간다 */
  if (P.tail > 0){
    let py = P.tailY, pz = P.bodyZ + P.tailZ, th = P.tailUp;
    const n = Math.max(1, P.tailSeg | 0), seg = P.tailLen / n;
    for (let i = 0; i < n; i++){
      const ny = py + Math.sin(th) * seg, nz = pz - Math.cos(th) * seg;
      const r1 = lerp(P.tailR, P.tailTip, i / n);
      let r2 = lerp(P.tailR, P.tailTip, (i + 1) / n);
      if (i === n - 1) r2 *= P.tailBulb;
      add({ bone:'tail' + i, a:[0, py, pz], b:[0, ny, nz], r1, r2, k: P.tailK });
      py = ny; pz = nz; th += P.tailCurl;
    }
  }

  /* 가시 — 머리 중심에서 바깥으로 뻗는 얇은 뿔.
     밑동을 머리 **안쪽**에 두어야 뿔이 얹힌 게 아니라 머리가 찢어져 나온 것으로 읽힌다 */
  if (m > P.spikeOn && P.spikes && P.spikes.length){
    const t = (m - P.spikeOn) / (1 - P.spikeOn);
    for (const [deg, lenS, baseS] of P.spikes){
      const a = deg * Math.PI / 180;
      const ux = Math.sin(a), uy = Math.cos(a);
      const inR = 0.55, outR = lerp(0.55, 1.0 + lenS, t);
      for (const s of [1, -1])
        add({ bone:'spike',
              a:[s * ux * hx * inR,  P.headY + uy * hy * inR,  P.headZ],
              b:[s * ux * hx * outR, P.headY + uy * hy * outR, P.headZ],
              r1: P.spikeR * baseS, r2: P.spikeTip,
              k: P.spikeK, sq:[1, 1, P.spikeFlat] });
    }
  }

  /* 각 캡슐의 세계좌표 AABB — sculpt.js 의 sampleField 가 이걸로 건너뛴다.
     sq 로 눌린 캡슐은 눌린 만큼 얇으므로 나누어 되돌린다 (sculpt.js 와 같은 계산) */
  for (const p of S){
    const c = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2];
    p.c = c;
    p.sqMax = p.sq ? Math.max(p.sq[0], p.sq[1], p.sq[2]) : 1;
    const r = Math.max(p.r1, p.r2);
    const bb = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 3; i++){
      const lo = Math.min(p.a[i], p.b[i]) - r, hi = Math.max(p.a[i], p.b[i]) + r;
      const s = p.sq ? p.sq[i] : 1;
      bb[i]     = c[i] + (lo - c[i]) / s;
      bb[i + 3] = c[i] + (hi - c[i]) / s;
    }
    p.bb = bb;
  }
  return { prims: S, P, mitts };
}

/* build(P) → sculpt.js 의 build 와 같은 모양을 돌려준다.
   catsculpt.js 가 이걸 그대로 받을 수 있어야 실험이 게임으로 넘어간다. */
export function build(params = {}){
  const t0 = performance.now();
  const raw = { ...CHAR, ...params };
  const { prims, P, mitts } = skeleton(raw);
  const R = mesh(prims, P);
  const s = R.scale, minY = R.dropY;
  const at = (x, y, z) => [x * s, (y - minY) * s, z * s];

  return {
    ...R, prims, params: P,
    anchor: {
      head:  at(0, P.headY, P.headZ),
      headR: [P.headR * P.headSx * s, P.headR * P.headSy * s, P.headR * P.headSz * s],
      crown: at(0, P.headY + P.headR * P.headSy * 0.58, P.headZ - 0.015),
      face:  at(0, P.headY - P.headR * P.headSy * 0.12, P.headZ + P.headR * P.headSz * 0.92),
      faceR: P.headR * P.headSx * s,
      /* 목 — 이 조형에서는 머리가 몸을 통째로 덮으므로 목걸이는 머리 밑동에 걸린다 */
      neck:  at(0, P.headY - P.headR * P.headSy * 0.98, P.headZ - P.headR * P.headSz * 0.16),
      neckR: P.headR * P.headSx * 0.60 * s,
      collar: at(0, P.bodyY + P.bodyH * 0.5, P.bodyZ + 0.01),
      chest:  at(0, P.bodyY, P.bodyZ + P.bodyR * 0.9),
      hip:    at(0, 0, P.bodyZ),
      paws: mitts.map(t => ({ tag: t.tag, p: at(t.p[0], t.p[1], t.p[2]), r: t.r * s })),
    },
    ms: performance.now() - t0,
  };
}

/* ============================================================
   사다리 — 한 계단에 한 가지만 바꾼다.
   "캐릭터로 갈 수 있는가" 는 계단을 나란히 놓아야 답이 된다.
   ============================================================ */
export const STEPS = {
  /* 두 발로 세운다. 아직 팔·뒷발이 있고 머리도 덜 크다 */
  '세움': { arm: 0.040, hind: 0.9, mittZ: 0.130, mittSpread: 0.155, mittR: 0.088,
           mittY: 0.082, headR: 0.290, headY: 0.610, headSx: 1.18, headSy: 0.88,
           bodyH: 0.230, bodyY: 0.255, bodyR: 0.140, earH: 0.290, earSpread: 0.240 },
  /* 팔·뒷발·꼬리를 지우고 발을 띄운다. 머리를 키운다 */
  '지움': {},
  /* 뾰족한 쪽 */
  '뾰족': { mood: 1, res: 60 },
};
