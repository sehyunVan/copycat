/* ============================================================
   sculpt.js — 붙이는 대신 깎는다.

   lowpoly.js 와 cat3.js 는 도형을 **붙여서** 고양이를 만든다. 박스·정이십면체·원뿔을
   제자리에 놓으면 고양이로 읽힌다. 싸고, 드로우콜을 셀 수 있고, 부품을 갈아끼울 수 있다.

   그런데 참조 피규어(README 의 레퍼런스 ①)는 붙인 물건이 아니다.
   **목이 없는 게 아니라 목이 녹아 있다.** 다리가 몸에 꽂힌 게 아니라 몸에서 자라나 있다.
   이음매가 한 군데도 없다. 이건 부품을 아무리 잘 놓아도 안 나온다 — 표면이 하나여야 나온다.

   그래서 순서를 뒤집는다.

     1. 뼈대를 **거리장**으로 적는다 — 굵기가 변하는 캡슐 스무 몇 개. 이게 설계도다
     2. **부드러운 합집합**(smin)으로 녹인다 — k 가 곧 이음매의 반지름이다
     3. 격자에서 **surface nets** 로 껍질 하나를 뽑는다
     4. flat 으로 칠한다 — 면이 보여야 로우폴리다

   여기서 딸려 오는 성질 셋이 이 방식의 전부다.

   · **격자 해상도가 곧 면의 크기다.** 그림체 손잡이가 res 하나로 줄어든다.
     res 를 낮추면 "덜 만들어진 것"이 되는 게 아니라 **더 로우폴리가 된다**
   · **고양이 한 마리 = 메시 하나 = 드로우콜 하나.** cat3.js 의 리그가 병합 후 9콜인데
     여기는 1콜이다. 대신 부품이 없으니 귀를 따로 씰룩일 수 없다 (→ 스키닝은 m2)
   · **비율을 숫자로 흔들 수 있다.** 부품을 다시 붙이는 게 아니라 캡슐 좌표만 바뀐다

   좌표 규약은 게임과 같다 — 1 타일 = 1 유닛, Y 위쪽, 고양이는 +Z 를 본다.
   발바닥이 y=0 이다.
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

/* ============================================================
   1 — 거리 함수

   원시형이 하나뿐이다: **두 끝의 굵기가 다른 캡슐**(iq 의 round cone).
   a==b 면 구, 위가 굵으면 다리, 끝이 0 이면 귀, 이어 붙이면 꼬리다.
   박스 하나로 가구를 다 지은 lowpoly.js 와 같은 절약이다.
   ============================================================ */

function sdRoundCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2){
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  if (l2 < 1e-12) return Math.sqrt(pax * pax + pay * pay + paz * paz) - r1;

  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;

  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/* 부드러운 합집합. k 가 0 이면 그냥 min — 그러면 이음매가 각져서 "붙인 것"이 된다.
   k 를 키우면 살이 붙는다. 이 게임에서 목·어깨·엉덩이가 전부 이 한 줄로 만들어진다. */
function smin(a, b, k){
  if (k <= 1e-6) return a < b ? a : b;
  let h = 0.5 + 0.5 * (b - a) / k;
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  return b + (a - b) * h - k * h * (1 - h);
}
/* 부드러운 차집합 — 발바닥 젤리 사이 홈처럼 파낼 때. */
function smax(a, b, k){ return -smin(-a, -b, k); }

/* ============================================================
   2 — 뼈대

   캡슐 하나는 { a, b, r1, r2, k, sq }.

   sq 는 그 캡슐만 눌러 납작하게 만드는 배율이고 **1보다 크면 그 축으로 얇아진다.**
   귀는 앞뒤로 눌러야 귀로 읽히고, 얼굴은 앞뒤로 눌러야 이목구비가 얹힐 면이 생긴다
   (k1~k8 에서 이미 확인된 것 — 여기서도 같은 결론이 나온다).

   bone 이름은 지금은 라벨이지만 m2(스키닝)에서 그대로 뼈가 된다.
   ============================================================ */

/* 기준형 — 참조 피규어 쪽. 네 발, 큰 머리, 짧은 다리, 세운 꼬리. */
export const FIG = {
  scale: 1,
  /* 가장 긴 축의 셀 수 = 면의 크기. 이게 이 파일의 유일한 그림체 손잡이다.
     30 근처에서 참조 피규어의 면 크기가 나오고, 60 을 넘겨야 발바닥 젤리가 살아난다 */
  res: 36,
  k: 0.045,         // 기본 이음매 반지름
  relax: 1,         // 정점 완화 횟수. 0 이면 격자 계단이 그대로 남는다
  pads: true,       // 발바닥 젤리 (아래에서 볼 때만 보이는 것)

  /* 몸 — 뒤가 굵고 앞이 조금 가는 통.
     굵기를 올리면 다리가 통째로 잡아먹힌다. 여기가 이 방식의 첫 함정이었다 */
  bodyLen: 0.40, bodyR: 0.212, bodyRear: 1.10, bodyY: 0.405, bodyZ: -0.045,

  /* 머리 — 몸보다 크다. 이 실루엣의 절반은 여기서 나온다.
     앞뒤로 눌러야(headSz) 얼굴이 "면" 이 된다. 정구면이면 이목구비가 흘러내린다 */
  headR: 0.280, headY: 0.630, headZ: 0.345,
  headSx: 1.18, headSy: 0.90, headSz: 0.78,
  neckK: 0.075,     // 머리와 몸이 녹는 정도. "목이 없다"를 만드는 숫자

  /* 주둥이는 **기본이 0** 이다. k1~k8 이 이미 낸 결론을 여기서도 그대로 쓴다 —
     빼면 얼굴이 평면이 되고, 평면이라야 이목구비가 읽힌다.
     붙이면 그 순간 고양이가 아니라 동물이 된다. 손잡이만 남겨 둔다 */
  muzzle: 0, muzzleY: -0.090, muzzleZ: 0.195, muzzleK: 0.055,
  /* 대신 볼로 턱을 넓힌다. 주둥이 없이 얼굴을 만드는 건 이쪽 일이다 */
  cheek: 0.135, cheekY: -0.045, cheekK: 0.055,

  /* 귀 — 이 실루엣에서 "고양이"라고 말해주는 건 사실상 귀뿐이다.
     끝을 0 으로 뾰족하게 두면 셀보다 얇아져서 톱니가 된다. 살짝 뭉툭해야 한다 */
  earH: 0.290, earR: 0.155, earTip: 0.045, earSpread: 0.205, earTilt: 0.045,
  earLean: -0.020, earFlat: 1.75, earSink: 0.72, earK: 0.050,

  /* 다리 — 짧고 뭉툭하게. 길어지면 피규어가 아니라 동물이 된다 */
  legR: 0.088, legTaper: 0.92, legSpread: 0.145,
  legFront: 0.185, legBack: -0.195, legK: 0.045, legLean: 0.88,

  /* ── 자세를 만드는 손잡이 둘 ──
     고양이가 앉는다는 건 다리가 짧아지는 게 아니라 **접혀서 몸에 묻히는** 것이다.
     fold 가 1 이면 발이 엉덩이까지 올라와 캡슐이 몸 안으로 사라지고, 그 자리가 넓적다리가 된다.
     뒷다리만 접으면 앉은 자세, 넷 다 접으면 식빵이다. 자세마다 모델을 따로 만들 필요가 없다. */
  legFold: 0, legBackFold: 0,
  /* 몸을 앞뒤로 기울인다. 양수면 앞이 높다 — 앉으면 엉덩이가 바닥에 닿고 가슴이 선다 */
  bodyTilt: 0,

  /* 걸음 — 다리 넷의 **발끝만** 따로 옮긴다. { FR:[dz,dy], FL, BR, BL } 이고,
     엉덩이(캡슐의 윗끝)는 제자리라 다리가 고관절에서 흔들려 나간다.
     legFold 가 **자세**를 만드는 손잡이라면 이건 **한 장면**을 만드는 손잡이다 —
     catsculpt.js 가 이 값만 바꿔 걷는 장면 몇 장을 깎아 두고 돌려 쓴다.
     null 이면 넷 다 0 이고, 그게 지금까지의 서 있는 다리다. */
  legStep: null,

  /* 꼬리 — 세워야 실루엣이 산다. 끝은 뭉툭한 혹.
     너무 길면 정면 컷에서 머리 위로 솟아 뿔이 된다 */
  tailLen: 0.60, tailR: 0.078, tailTip: 0.052, tailBulb: 1.20,
  tailUp: 0.75, tailCurl: 0.20, tailSeg: 4, tailK: 0.045,
  /* 꼬리를 옆으로 흘린다. 앉은 자세에서 필요해진 값이다 —
     의자 위에서 꼬리를 곧게 뒤로 늘어뜨리면 등받이를 뚫는다.
     실제 고양이는 그럴 때 꼬리를 좌판 옆으로 늘어뜨린다. */
  tailSide: 0,

  /* 발바닥 젤리 — 발가락 젤리 반지름이 셀보다 작아지면 통째로 사라진다 */
  padR: 0.044, padOut: 0.34, padK: 0.012,
};

const lerp = (a, b, t) => a + (b - a) * t;

export function skeleton(P){
  const S = [];
  const add = o => (S.push(o), o);
  const K = P.k;

  /* 몸 */
  const bz0 = P.bodyZ - P.bodyLen / 2, bz1 = P.bodyZ + P.bodyLen / 2;
  const tilt = P.bodyTilt || 0;
  add({ bone:'body', a:[0, P.bodyY - 0.015 - tilt, bz0], b:[0, P.bodyY + 0.02 + tilt, bz1],
        r1: P.bodyR * P.bodyRear, r2: P.bodyR, k: K });

  /* 머리 */
  const hy = P.headY, hz = P.headZ;
  add({ bone:'head', a:[0, hy, hz], b:[0, hy, hz], r1: P.headR, r2: P.headR,
        k: P.neckK, sq:[1 / P.headSx, 1 / P.headSy, 1 / P.headSz] });

  /* 주둥이 — 가로로 넓고 위아래로 눌린 덩어리 */
  if (P.muzzle > 0)
    add({ bone:'head', a:[0, hy + P.muzzleY, hz + P.muzzleZ], b:[0, hy + P.muzzleY, hz + P.muzzleZ],
          r1: P.muzzle, r2: P.muzzle, k: P.muzzleK, sq:[0.82, 1.25, 1.05] });

  /* 볼 — 턱을 넓힌다. 이게 없으면 머리가 그냥 공이고, 공은 고양이가 아니다 */
  if (P.cheek > 0)
    for (const s of [1, -1])
      add({ bone:'head', a:[s * P.headR * 0.52, hy + P.cheekY, hz + 0.01],
            b:[s * P.headR * 0.52, hy + P.cheekY, hz + 0.01],
            r1: P.cheek, r2: P.cheek, k: P.cheekK, sq:[1, 1.05, 1.20] });

  /* 귀 — 앞뒤로 눌린 뿔. 끝이 셀보다 얇아지면 톱니가 되므로 조금 남긴다 */
  const ey = hy + P.headR * P.headSy * P.earSink;
  for (const s of [1, -1])
    add({ bone:'head',
          a:[s * P.earSpread, ey, hz + P.earLean],
          b:[s * (P.earSpread + P.earTilt), ey + P.earH, hz + P.earLean * 1.8],
          r1: P.earR, r2: P.earTip, k: P.earK, sq:[1, 1, P.earFlat] });

  /* 다리 넷 + 발 */
  const paws = [];
  for (const s of [1, -1])
    for (const [z, tag] of [[P.legFront, 'F'], [P.legBack, 'B']]){
      const bone = 'leg' + tag + (s > 0 ? 'R' : 'L');
      /* 기울인 몸에서는 앞다리가 붙는 자리도 같이 올라간다 */
      const topY = P.bodyY + (tag === 'F' ? tilt : -tilt) - 0.05;
      const fold = Math.max(0, Math.min(1,
        (P.legFold || 0) + (tag === 'B' ? (P.legBackFold || 0) : 0)));
      const ground = P.legR * P.legTaper * 0.80;
      const footY = ground + (topY - ground) * fold;
      /* 걸음 — 발끝만 옮긴다. 뿌리는 그대로라 다리가 몸에서 흔들려 나간다.
         앞뒤(dz)만 흔들면 바닥을 끄는 것처럼 보이므로, 흔드는 동안에는 살짝 든다(dy). */
      const st = (P.legStep && P.legStep[tag + (s > 0 ? 'R' : 'L')]) || null;
      const fz = z + (st ? st[0] : 0), fy = footY + (st ? st[1] : 0);
      add({ bone, a:[s * P.legSpread * P.legLean, topY, z * 1.02], b:[s * P.legSpread, fy, fz],
            r1: P.legR, r2: P.legR * P.legTaper, k: P.legK });
      /* 발 — 아래로 눌러야 바닥에 닿는 면이 생긴다 */
      add({ bone, a:[s * P.legSpread, fy, fz], b:[s * P.legSpread, fy, fz + 0.012],
            r1: P.legR * P.legTaper * 1.06, r2: P.legR * P.legTaper * 1.06,
            k: 0.030, sq:[1, 1.30, 0.96] });
      paws.push([s * P.legSpread, fy, fz, bone]);
    }

  /* 꼬리 — 뿌리에서 각도를 조금씩 더하며 올라간다 */
  {
    let py = P.bodyY - tilt + 0.055, pz = bz0 + 0.03, th = P.tailUp;
    const n = Math.max(1, P.tailSeg | 0), seg = P.tailLen / n;
    let px = 0;
    for (let i = 0; i < n; i++){
      const nx = px + (P.tailSide || 0) * seg;
      const ny = py + Math.sin(th) * seg, nz = pz - Math.cos(th) * seg;
      const r1 = lerp(P.tailR, P.tailTip, i / n);
      let r2 = lerp(P.tailR, P.tailTip, (i + 1) / n);
      if (i === n - 1) r2 *= P.tailBulb;      // 끝의 혹
      add({ bone:'tail' + i, a:[px, py, pz], b:[nx, ny, nz], r1, r2, k: P.tailK });
      px = nx; py = ny; pz = nz; th += P.tailCurl;
    }
  }

  /* 발바닥 젤리 — 아래에서 볼 때만 보이는 것.
     참조 시트의 여섯 컷 중 한 컷이 이걸 위해 존재한다. 격자가 이걸 잡아내는지가
     이 방식의 해상도 한계를 그대로 보여준다 (res 가 낮으면 통째로 사라진다). */
  if (P.pads)
    for (const [px, py, pz, bone] of paws){
      const r = P.padR, out = r * P.padOut;
      add({ bone, a:[px, py - r * 1.15 + out, pz - 0.008], b:[px, py - r * 1.15 + out, pz - 0.008],
            r1: r, r2: r, k: P.padK, sq:[0.92, 2.0, 0.80] });
      for (const [dx, dz] of [[-0.60, 0.52], [0, 0.80], [0.60, 0.52]])
        add({ bone, a:[px + dx * r, py - r * 1.05 + out * 0.9, pz + dz * r * 1.10],
              b:[px + dx * r, py - r * 1.05 + out * 0.9, pz + dz * r * 1.10],
              r1: r * 0.56, r2: r * 0.56, k: P.padK, sq:[1, 2.0, 1] });
    }

  /* 각 캡슐의 세계좌표 AABB — 샘플링에서 건너뛰는 데만 쓴다.
     sq 로 눌린 캡슐은 눌린 만큼 세계좌표에서 얇으므로 나누어 되돌린다. */
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
  return S;
}

/* 캡슐 하나의 거리. sq 가 있으면 눌린 공간에서 재고 최대 배율로 나눈다 —
   d==0 인 자리(곧 표면)는 나누기와 무관하므로 형태는 정확하고, 블렌딩만 근사가 된다. */
function distTo(p, x, y, z){
  if (p.sq){
    const c = p.c;
    x = c[0] + (x - c[0]) * p.sq[0];
    y = c[1] + (y - c[1]) * p.sq[1];
    z = c[2] + (z - c[2]) * p.sq[2];
  }
  const d = sdRoundCone(x, y, z, p.a[0], p.a[1], p.a[2], p.b[0], p.b[1], p.b[2], p.r1, p.r2);
  return p.sq ? d / p.sqMax : d;
}

/* ============================================================
   3 — 격자 샘플링

   전부를 전부에 대해 재면 27개 캡슐 × 15만 점 = 400만 번이다. 그럴 필요가 없다:
   z 슬랩 → y 행 순서로 후보를 걸러 두면 한 점이 실제로 재는 캡슐은 보통 두세 개다.
   (건너뛴 캡슐은 이음매 반지름 밖이라 smin 에 사실상 기여하지 않는다.)
   ============================================================ */

const FAR = 1e3;

function sampleField(prims, min, cell, nx, ny, nz){
  const f = new Float32Array(nx * ny * nz).fill(FAR);
  const pad = cell * 1.5;

  const zList = [], yList = [];
  for (let iz = 0; iz < nz; iz++){
    const wz = min[2] + iz * cell;
    zList.length = 0;
    for (const p of prims) if (wz >= p.bb[2] - p.k * 2 - pad && wz <= p.bb[5] + p.k * 2 + pad) zList.push(p);
    if (!zList.length) continue;

    for (let iy = 0; iy < ny; iy++){
      const wy = min[1] + iy * cell;
      yList.length = 0;
      for (const p of zList) if (wy >= p.bb[1] - p.k * 2 - pad && wy <= p.bb[4] + p.k * 2 + pad) yList.push(p);
      if (!yList.length) continue;

      const row = (iy + ny * iz) * nx;
      for (let ix = 0; ix < nx; ix++){
        const wx = min[0] + ix * cell;
        let d = FAR;
        for (let i = 0; i < yList.length; i++){
          const p = yList[i];
          if (wx < p.bb[0] - p.k * 2 - pad || wx > p.bb[3] + p.k * 2 + pad) continue;
          const dd = distTo(p, wx, wy, wz);
          d = p.sub ? smax(d, -dd, p.k) : smin(d, dd, p.k);
        }
        f[row + ix] = d;
      }
    }
  }
  return f;
}

/* ============================================================
   4 — surface nets

   마칭큐브 대신 이걸 쓰는 이유가 미학이다. 마칭큐브는 삼각형이 격자 대각선을 따라
   길쭉하게 찢어지는데, surface nets 는 셀마다 정점 하나를 놓고 사각형으로 잇는다.
   결과가 **크기가 고른 사각면**이라서, flat 으로 칠하면 참조 피규어의 그 면이 된다.
   테이블도 256줄짜리 삼각형표가 필요 없다 — 모서리 12개면 끝이다.
   ============================================================ */

/* 셀 모서리 12개. 꼭짓점 번호는 c = dx + 2·dy + 4·dz */
const EDGES = [
  [0,1],[2,3],[4,5],[6,7],   // x 방향
  [0,2],[1,3],[4,6],[5,7],   // y 방향
  [0,4],[1,5],[2,6],[3,7],   // z 방향
];

function surfaceNets(f, nx, ny, nz){
  const cellIdx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];               // 격자 좌표계의 정점
  const g = new Float64Array(8);
  const cxn = nx - 1, cyn = ny - 1;

  for (let z = 0; z < nz - 1; z++)
  for (let y = 0; y < ny - 1; y++)
  for (let x = 0; x < nx - 1; x++){
    let mask = 0, c = 0;
    for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++){
      const v = f[(x + dx) + nx * ((y + dy) + ny * (z + dz))];
      g[dx + 2 * dy + 4 * dz] = v;
      if (v < 0) mask |= 1 << (dx + 2 * dy + 4 * dz);
      c++;
    }
    if (mask === 0 || mask === 255) continue;

    /* 부호가 바뀌는 모서리들의 교차점 평균 = 이 셀의 정점 */
    let ex = 0, ey = 0, ez = 0, n = 0;
    for (let e = 0; e < 12; e++){
      const a = EDGES[e][0], b = EDGES[e][1];
      const va = g[a], vb = g[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      ex += (a & 1) + (((b & 1) - (a & 1))) * t;
      ey += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1))) * t;
      ez += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1))) * t;
      n++;
    }
    cellIdx[x + cxn * (y + cyn * z)] = pos.length / 3;
    pos.push(x + ex / n, y + ey / n, z + ez / n);
  }

  /* 격자 모서리마다 사각형 하나. 축 u 의 수직 두 축을 순환 순서 (v,w) 로 잡으면
     (v-1,w-1) → (v,w-1) → (v,w) → (v-1,w) 가 +u 를 도는 반시계 방향이 된다. */
  const quads = [];
  const cellAt = (x, y, z) => cellIdx[x + cxn * (y + cyn * z)];

  for (let z = 1; z < nz - 1; z++)
  for (let y = 1; y < ny - 1; y++)
  for (let x = 1; x < nx - 1; x++){
    const v0 = f[x + nx * (y + ny * z)];
    const in0 = v0 < 0;
    /* x 모서리 → (y,z) */
    if (x < nx - 1){
      const v1 = f[(x + 1) + nx * (y + ny * z)];
      if (in0 !== (v1 < 0)){
        const A = cellAt(x, y - 1, z - 1), B = cellAt(x, y, z - 1),
              C = cellAt(x, y, z),         D = cellAt(x, y - 1, z);
        if (A >= 0 && B >= 0 && C >= 0 && D >= 0) quads.push(in0 ? [A,B,C,D] : [A,D,C,B]);
      }
    }
    /* y 모서리 → (z,x) */
    if (y < ny - 1){
      const v1 = f[x + nx * ((y + 1) + ny * z)];
      if (in0 !== (v1 < 0)){
        const A = cellAt(x - 1, y, z - 1), B = cellAt(x - 1, y, z),
              C = cellAt(x, y, z),         D = cellAt(x, y, z - 1);
        if (A >= 0 && B >= 0 && C >= 0 && D >= 0) quads.push(in0 ? [A,B,C,D] : [A,D,C,B]);
      }
    }
    /* z 모서리 → (x,y) */
    if (z < nz - 1){
      const v1 = f[x + nx * (y + ny * (z + 1))];
      if (in0 !== (v1 < 0)){
        const A = cellAt(x - 1, y - 1, z), B = cellAt(x, y - 1, z),
              C = cellAt(x, y, z),         D = cellAt(x - 1, y, z);
        if (A >= 0 && B >= 0 && C >= 0 && D >= 0) quads.push(in0 ? [A,B,C,D] : [A,D,C,B]);
      }
    }
  }
  return { pos, quads };
}

/* 정점 완화. surface nets 의 날것은 격자 계단이 살짝 남는다.
   한 번이면 계단만 지워지고 면은 그대로다. 세 번 넘기면 로우폴리가 아니라 비누가 된다. */
function relax(pos, quads, times, amount = 0.55){
  const n = pos.length / 3;
  for (let t = 0; t < times; t++){
    const acc = new Float64Array(n * 3), cnt = new Uint16Array(n);
    for (const q of quads)
      for (let i = 0; i < 4; i++){
        const a = q[i], b = q[(i + 1) & 3];
        acc[a*3] += pos[b*3]; acc[a*3+1] += pos[b*3+1]; acc[a*3+2] += pos[b*3+2]; cnt[a]++;
        acc[b*3] += pos[a*3]; acc[b*3+1] += pos[a*3+1]; acc[b*3+2] += pos[a*3+2]; cnt[b]++;
      }
    for (let i = 0; i < n; i++){
      if (!cnt[i]) continue;
      for (let k = 0; k < 3; k++)
        pos[i*3+k] += (acc[i*3+k] / cnt[i] - pos[i*3+k]) * amount;
    }
  }
}

/* ============================================================
   5 — 껍질 하나

   build(P) → { geometry, tris, verts, ms, bounds, prims }
   ============================================================ */

export function build(params = {}){
  const P = { ...FIG, ...params };
  const t0 = performance.now();

  const prims = skeleton(P);

  /* 경계 상자 — 이음매만큼 부풀린다. 여유가 없으면 껍질이 상자에 잘려 구멍이 난다 */
  const lo = [ Infinity,  Infinity,  Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of prims)
    for (let i = 0; i < 3; i++){
      lo[i] = Math.min(lo[i], p.bb[i] - p.k);
      hi[i] = Math.max(hi[i], p.bb[i + 3] + p.k);
    }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const cell = span / Math.max(8, P.res | 0);
  const min = lo.map(v => v - cell * 2);
  const max = hi.map(v => v + cell * 2);
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;

  const tSample = performance.now();
  const f = sampleField(prims, min, cell, nx, ny, nz);
  const msSample = performance.now() - tSample;

  const tMesh = performance.now();
  const { pos, quads } = surfaceNets(f, nx, ny, nz);
  if (P.relax > 0) relax(pos, quads, P.relax | 0);
  const msMesh = performance.now() - tMesh;

  /* 격자 좌표 → 세계 좌표. 발바닥이 y=0 에 오도록 내린다 */
  let minY = Infinity;
  for (let i = 0; i < pos.length; i += 3){
    pos[i]     = min[0] + pos[i]     * cell;
    pos[i + 1] = min[1] + pos[i + 1] * cell;
    pos[i + 2] = min[2] + pos[i + 2] * cell;
    if (pos[i + 1] < minY) minY = pos[i + 1];
  }
  const s = P.scale;
  /* 무늬가 앉는 좌표계 — 껍질을 통째로 감싸는 상자.
     얼굴은 머리를 단위구로 되돌려 놓고 칠하는데(facepaint.js), 무늬는 몸 전체가
     바탕이라 기준이 더 커야 한다. 매개변수로 짐작해서 적어 두면 자세마다·프리셋마다
     어긋나므로, **깎고 난 뒤의 실제 껍질을 재서** 그대로 쓴다. */
  const bLo = [ Infinity,  Infinity,  Infinity];
  const bHi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3){
    pos[i] *= s; pos[i + 1] = (pos[i + 1] - minY) * s; pos[i + 2] *= s;
    for (let k = 0; k < 3; k++){
      const v = pos[i + k];
      if (v < bLo[k]) bLo[k] = v;
      if (v > bHi[k]) bHi[k] = v;
    }
  }

  /* flat 셰이딩이라 인덱스를 쓰지 않는다 — 면마다 법선이 하나여야 면이 보인다 */
  const tri = new Float32Array(quads.length * 6 * 3);
  let w = 0;
  const put = i => { tri[w++] = pos[i*3]; tri[w++] = pos[i*3+1]; tri[w++] = pos[i*3+2]; };
  for (const q of quads){ put(q[0]); put(q[1]); put(q[2]); put(q[0]); put(q[2]); put(q[3]); }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(tri, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return {
    geometry, prims, params: P,
    tris: quads.length * 2,
    verts: pos.length / 3,
    grid: [nx, ny, nz],
    cell,
    /* 뼈대를 겹쳐 그리려면 껍질과 같은 만큼 내려야 한다 */
    dropY: minY, scale: s,
    /* 얼굴을 **칠하는** 쪽(facepaint.js)이 읽는 기준점.
       칠은 오브젝트 공간에서 머리를 단위구로 되돌려 놓고 그리므로
       발밑 정렬까지 끝난 최종 좌표의 중심과 반지름이 필요하다. */
    anchor: (() => {
      const at = (x, y, z) => [x * s, (y - minY) * s, z * s];
      const tilt = P.bodyTilt || 0;
      const bz0 = P.bodyZ - P.bodyLen / 2;
      /* 악세사리가 붙는 자리들. 자세마다 머리와 엉덩이가 옮겨 다니므로
         **자세마다 따로** 뽑아 둔다 — 모자가 앉으면 공중에 뜨는 걸 막는 값이다. */
      const paws = [];
      for (const sx of [1, -1])
        for (const [z, tag] of [[P.legFront, 'F'], [P.legBack, 'B']]){
          const fold = Math.max(0, Math.min(1,
            (P.legFold || 0) + (tag === 'B' ? (P.legBackFold || 0) : 0)));
          const topY = P.bodyY + (tag === 'F' ? tilt : -tilt) - 0.05;
          const ground = P.legR * P.legTaper * 0.80;
          const st = (P.legStep && P.legStep[tag + (sx > 0 ? 'R' : 'L')]) || null;
          paws.push({ tag, side: sx > 0 ? 'R' : 'L', fold,
                      p: at(sx * P.legSpread,
                            ground + (topY - ground) * fold + (st ? st[1] : 0),
                            z + (st ? st[0] : 0)),
                      r: P.legR * P.legTaper * s });
        }
      return {
        /* 무늬 좌표계. 껍질 상자의 한가운데와 반지름 셋 — 여기로 나누면 고양이가
           공 하나로 펴지고, 무늬 하나는 그 공 위의 **방향 + 크기**가 된다.
           자세가 바뀌면 상자도 같이 바뀌므로 무늬가 몸에 붙어 따라간다.

           **가로 한가운데는 재지 않고 0 으로 못 박는다.** 고양이 몸은 x 대칭인데
           꼬리만 안 그렇다 — 앉은 자세는 꼬리를 옆으로 흘리므로(tailSide) 상자의
           한가운데가 0.086 만큼 옆으로 밀린다. 그대로 쓰면 **앉는 순간 양말 넷 중
           오른쪽이 발에서 벗겨진다**. 재서 나온 값이라도 몸이 대칭이라는 사실보다
           믿을 만하지는 않다. */
        body:  [0, (bLo[1] + bHi[1]) / 2, (bLo[2] + bHi[2]) / 2],
        bodyR: [Math.max(1e-3, (bHi[0] - bLo[0]) / 2),
                Math.max(1e-3, (bHi[1] - bLo[1]) / 2),
                Math.max(1e-3, (bHi[2] - bLo[2]) / 2)],
        head:  at(0, P.headY, P.headZ),
        headR: [P.headR * P.headSx * s, P.headR * P.headSy * s, P.headR * P.headSz * s],
        /* 정수리 — 모자가 앉는 자리.
           머리 꼭대기(1.0)에 두면 모자가 **얹힌 게 아니라 올려놓은 것**이 된다. 옆에서 보면
           머리와 모자 사이가 벌어져서 바로 티가 난다. 모자는 머리에 파묻혀야 쓴 것이 된다. */
        crown: at(0, P.headY + P.headR * P.headSy * 0.56, P.headZ - 0.015),
        /* 얼굴 앞 — 안경이 걸리는 자리. 눈 높이(facepaint 의 eyeUp)와 맞춰 둔다 */
        face:  at(0, P.headY - P.headR * P.headSy * 0.14, P.headZ + P.headR * P.headSz * 0.92),
        faceR: P.headR * P.headSx * s,
        /* 목 — 머리와 몸이 녹아 붙은 자리. 목걸이·넥타이가 여기 걸린다.
           **머리 반지름 바로 바깥**이어야 한다. 0.72 로 뒀더니 앵커가 머리 안쪽이라
           셔츠 깃이 통째로 얼굴에 파묻혔다 — 넥타이만 턱 밑에 떠 있던 이유가 이거였다. */
        neck:  at(0, P.headY - P.headR * P.headSy * 1.00, P.headZ - P.headR * P.headSz * 0.18),
        neckR: P.headR * P.headSx * 0.66 * s,
        /* 목도리가 **감기는 원의 중심**. neck 은 물건이 걸리는 표면 한 점이라 링을 두르면
           머리 안에 박힌다 — 목이 없는 고양이라 "목 높이"에는 링이 들어갈 자리가 없다.
           머리 바로 아래, 몸통 앞 끝이 그 자리다. 거기서는 머리보다 몸이 굵어서 링이 보인다. */
        /* 뒤로 더 물리면 링의 뒷호가 꼬리 뿌리와 겹친다. 앞으로 조금 당겨 둔다 */
        collar: at(0, P.bodyY + (P.bodyTilt || 0) + 0.045, P.bodyZ + P.bodyLen / 2 + 0.02),
        /* 가슴 앞 — 넥타이 날이 늘어지는 면 */
        chest: at(0, P.headY - P.headR * P.headSy * 1.15,
                  P.headZ - P.headR * P.headSz * 0.10 + (P.bodyR * 0.35)),
        /* 엉덩이 밑 — 방석이 깔리는 자리 */
        hip:   at(0, 0, bz0 + P.bodyLen * 0.30),
        paws,
      };
    })(),
    ms: performance.now() - t0,
    msSample, msMesh,
  };
}

/* 무게추 — 이 조형이 게임에 들어갈 수 있는 숫자인가를 보는 데 쓴다.
   OBJ 로 뽑아 두면 블렌더에서 데시메이트 걸어 보거나 그대로 프린트할 수 있다. */
export function toOBJ(geometry, name = 'copycat'){
  const p = geometry.getAttribute('position').array;
  const out = [`# ${name} — sculpt.js`, `o ${name}`];
  for (let i = 0; i < p.length; i += 3)
    out.push(`v ${p[i].toFixed(5)} ${p[i+1].toFixed(5)} ${p[i+2].toFixed(5)}`);
  for (let i = 1; i <= p.length / 3; i += 3) out.push(`f ${i} ${i+1} ${i+2}`);
  return out.join('\n');
}

/* ============================================================
   변형들 — 같은 생성기에 숫자만 다르게 넣은 것.
   "이 방식이 한 마리만 만들 수 있는가" 에 대한 답이다.
   ============================================================ */
export const PRESETS = {
  '레퍼런스': {},
  '치비':   { headR: 0.330, headSy: 0.95, headZ: 0.30, bodyR: 0.190, bodyLen: 0.30,
             bodyY: 0.365, legR: 0.080, legFront: 0.155, legBack: -0.165,
             earR: 0.150, earH: 0.255, earSpread: 0.215, tailLen: 0.40, neckK: 0.095 },
  '길쭉':   { headR: 0.225, headSx: 1.06, headY: 0.660, headZ: 0.440, bodyLen: 0.60,
             bodyR: 0.180, bodyY: 0.470, legR: 0.068, legTaper: 0.74,
             legFront: 0.275, legBack: -0.290, earH: 0.230, earSpread: 0.160,
             tailLen: 0.62, tailUp: 0.62, tailCurl: 0.30, neckK: 0.060, cheek: 0.085 },
  '덩어리': { res: 24, relax: 0, k: 0.080, neckK: 0.150, pads: false, earTip: 0.060 },
  '아기':   { headR: 0.290, headSy: 0.95, bodyLen: 0.24, bodyR: 0.185, bodyY: 0.330,
             headY: 0.545, headZ: 0.270, legR: 0.076, legTaper: 0.96,
             legFront: 0.130, legBack: -0.140, earR: 0.115, earH: 0.185,
             earSpread: 0.170, tailLen: 0.28, tailUp: 1.10, scale: 0.82 },
  /* 의자에 앉은 것 — 뒷다리만 접어 엉덩이를 바닥에 붙이고 가슴을 세운다.
     게임에서 고양이가 하루 대부분을 보내는 자세라 이게 제일 많이 보인다 */
  '앉음': { bodyY: 0.375, bodyLen: 0.28, bodyR: 0.200, bodyRear: 1.26, bodyZ: -0.055,
           bodyTilt: 0.115, legBackFold: 0.95,
           legR: 0.082, legFront: 0.170, legBack: -0.165, legLean: 0.94,
           headY: 0.680, headZ: 0.285, neckK: 0.085,
           /* 꼬리는 옆으로 흘려 좌판 밖으로 늘어뜨린다. 곧게 뒤로 두면 등받이를 뚫는다 */
           tailUp: -0.45, tailCurl: 0.08, tailSide: 0.95, tailLen: 0.50, tailSeg: 4 },
  /* 식빵 — 넷 다 접는다. 자는 고양이는 옆으로 눕히는 것보다 이게 낫다 */
  '식빵': { bodyY: 0.250, bodyLen: 0.34, bodyR: 0.215, bodyRear: 1.12, bodyZ: -0.03,
           legFold: 0.90, legR: 0.084, legFront: 0.165, legBack: -0.175,
           headY: 0.455, headZ: 0.305, neckK: 0.105,
           tailUp: -0.55, tailCurl: 0.14, tailSide: 0.70, tailLen: 0.46, tailSeg: 4 },
};
