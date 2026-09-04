/* ============================================================
   facepaint.js — 이목구비를 **붙이지 않고 칠한다.**

   sculpt.js 는 껍질 하나를 뽑는다. 거기에 눈을 달려면 보통 두 가지 중 하나를 한다:
   구를 두 개 더 놓거나(cat3.js 가 그렇게 한다), 텍스처를 감거나.

   둘 다 여기서는 손해다.
     · 도형을 더하면 부품이 생기고, 부품이 생기면 이 방식의 유일한 소득인
       "메시 하나 = 드로우콜 하나" 가 깨진다
     · 텍스처를 감으려면 UV 가 있어야 하는데, 격자에서 뽑은 껍질에는 UV 가 없다.
       매번 다시 깎을 때마다 UV 도 다시 펴야 한다

   그래서 세 번째 길로 간다 — **오브젝트 공간에서 바로 칠한다.**

   머리를 단위구로 되돌려 놓으면(중심을 빼고 반지름으로 나누면) 얼굴 위의 자리는
   방향 벡터 하나로 정해진다. 눈은 "정면에서 좌우로 몇 도, 아래로 몇 도" 인 방향이고,
   그 방향 주위의 접평면에서 타원 하나를 그리면 그게 눈이다.

   딸려 오는 성질:
     · **정점이 하나도 안 는다.** 삼각형 수도 드로우콜도 그대로 1
     · **면 크기와 무관하게 선명하다.** res 24 로 깎아도 눈매는 안 뭉갠다
       (조형으로 붙였다면 눈이 셀보다 작아져서 사라졌을 것이다 — 발바닥 젤리처럼)
     · **표정이 uniform 하나다.** 다시 깎지도, 지오메트리를 건드리지도 않는다.
       k8 이 정해 둔 상태 연동 표정(idle=^ ^ · sit=뜬 눈 · sleep=감은 눈)이
       여기서는 숫자 하나 바꾸는 일이 된다
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

/* 이 회사 고양이들의 바탕색. cat/16x16-*.png 넷과 같은 항목이다.
   검정을 순검정으로 두지 않는 건 cat3.js 와 같은 이유다 — 순검정은 형태가 아니라 구멍으로 읽힌다. */
export const FUR = {
  '주황': 0xE8A657,
  '검정': 0x4A4550,
  '갈색': 0xA0714E,
  '흰색': 0xF0E9DE,
};

/* 바탕이 어두우면 잉크가 안 보인다 — 검정 고양이를 칠해 보자마자 드러났다.
   도트 시절엔 색을 손으로 골랐으니 없던 문제고, 바탕을 슬라이더로 바꾸는 순간 생긴다.
   그래서 밝기를 재서 뒤집는다: 어두운 바탕에는 밝은 획 + 어두운 하이라이트.
   검정 고양이의 눈이 밝게 그려지는 건 실제 만화에서도 하는 일이다. */
export function inkFor(hex){
  const c = new THREE.Color(hex);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lum < 0.30 ? { ink: 0xEFE8DC, shine: 0x2E2A31 }
                    : { ink: 0x3A3038, shine: 0xFFFFFF };
}

/* ---------- 무늬 ----------
   **손이 지나간 자리를 그대로 칠한다.** 처음에는 동그라미 몇 개를 uniform 배열로
   얹었는데(스물넷까지), 그건 그리는 게 아니라 도장을 찍는 것이었다 — 획을 그으면
   점이 이어 붙은 애벌레가 되고, 개수 상한이 곧 「몇 번 그릴 수 있나」가 된다.

   그래서 좌표계는 그대로 두고 저장하는 곳만 바꿨다: **텍스처 한 장**이다.

   ── UV 가 없는 껍질에 어떻게 텍스처를 감나 ──
   격자에서 뽑은 껍질에는 UV 가 없다(facepaint 머리말의 그 이유). 그런데 여기서는
   펼 필요가 없다 — 몸을 공 하나로 되돌려 놓은 **방향**이 이미 있고(uBody/uBodyR),
   방향 하나를 정사각형 하나에 펴는 사상이 있다: **옥타히드럴**.
   위경도(lat-long)로 폈더니 정수리와 배에서 붓이 늘어났다. 옥타히드럴은 극이 없다.

     · 정점도 드로우콜도 여전히 안 는다 (샘플러 하나가 늘 뿐)
     · **몇 번을 그리든 상관없다** — 상한은 셰이더가 아니라 저장 크기에만 있다
     · 자세가 바뀌어도 좌표가 오브젝트 공간이라 무늬가 몸에 붙어 따라간다
     · 초상도 같은 텍스처를 쓴다 (목록·사원증·기록증)

   ── 붓은 CPU 에서 찍는다 ──
   렌더 타깃에 그리는 게 빠르지만, 이 텍스처는 렌더러 **셋**이 나눠 쓴다
   (사무실 · 초상 굽기 · 꾸미기 작업대). 렌더 타깃은 자기 렌더러에 묶여 있어서
   그 셋을 못 건넌다. 픽셀 배열은 건넌다.

   텍셀마다 방향을 미리 구해 두고(DIRS), 붓 한 획이 오면 그 텍셀의 방향이 획에서
   얼마나 떨어졌는지를 잰다. **이음매를 따로 다룰 필요가 없다** — 정사각형에서
   멀리 떨어진 두 텍셀이라도 방향이 가까우면 둘 다 칠해진다. 사상의 이음매가
   계산에 아예 안 들어온다. */

/* 192 는 눈으로 정했다. 128 은 작업대(≈340px)에서 획 가장자리가 뭉개지고,
   256 은 한 장에 262KB 라 여러 마리를 들고 있기 부담스럽다. */
export const PAINT_RES = 192;
const PX = PAINT_RES * PAINT_RES;

/* 팔레트 셋. **바탕(털색)은 손대지 않는다** — 이미 산 고양이의 색이 바뀌면 그건
   커스터마이징이 아니라 압수다. 고르는 것은 그 위에 얹히는 잉크 색이다. */
export const MARK_INK = [
  0xF0E9DE,   // 하양 — 앞가슴 · 양말
  0x8E6242,   // 갈색 — 털색표의 갈(0x9A6B4A)보다 한 단 어둡게 둔다.
              //        갈색 고양이 위에 갈색으로 그었을 때 형태가 남아야 한다
  0x38323A,   // 검정 — 순검정은 형태가 아니라 구멍이 된다(FUR 표와 같은 이유)
];
/* 셰이더에 들어가는 색은 **선형**이다 — uFur 가 THREE.Color 를 거치면서 그렇게
   되므로(three 의 색 관리), 텍스처에도 같은 공간의 값을 넣어야 같은 색으로 보인다.
   sRGB 바이트를 그대로 넣었더니 잉크만 형광색으로 떴다. */
const INK_RGB = MARK_INK.map(h => {
  const c = new THREE.Color(h);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
});

/* 텍셀 하나가 어느 방향인가. 한 번만 구한다 — 모든 고양이가 나눠 쓴다. */
let DIRS = null;
function dirs(){
  if (DIRS) return DIRS;
  DIRS = new Float32Array(PX * 3);
  for (let j = 0; j < PAINT_RES; j++){
    for (let i = 0; i < PAINT_RES; i++){
      const u = ((i + 0.5) / PAINT_RES) * 2 - 1;
      const v = ((j + 0.5) / PAINT_RES) * 2 - 1;
      let x = u, z = v, y = 1 - Math.abs(u) - Math.abs(v);
      if (y < 0){
        x = (1 - Math.abs(v)) * (u >= 0 ? 1 : -1);
        z = (1 - Math.abs(u)) * (v >= 0 ? 1 : -1);
      }
      const l = Math.hypot(x, y, z) || 1;
      const k = (j * PAINT_RES + i) * 3;
      DIRS[k] = x / l; DIRS[k + 1] = y / l; DIRS[k + 2] = z / l;
    }
  }
  return DIRS;
}

/* 방향 → uv. 붓이 닿을 만한 칸만 훑으려고 쓴다(셰이더의 octUV 와 같은 식).
   가장자리에 걸리면 훑기를 포기하고 전체를 돈다 — 거기서는 정사각형이 접혀 있다. */
function octUV(x, y, z){
  const n = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  x /= n; y /= n; z /= n;
  let u = x, v = z;
  if (y < 0){
    u = (1 - Math.abs(z)) * (x >= 0 ? 1 : -1);
    v = (1 - Math.abs(x)) * (z >= 0 ? 1 : -1);
  }
  return [u * 0.5 + 0.5, v * 0.5 + 0.5];
}

let BLANK = null;
function blank(){
  if (!BLANK){
    BLANK = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    BLANK.needsUpdate = true;
  }
  return BLANK;
}

function newTex(buf){
  const t = new THREE.DataTexture(buf, PAINT_RES, PAINT_RES);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/* 그릴 수 있는 판 하나. 작업대가 이걸 들고 손을 따라간다. */
export function makePaint(buf){
  const b = buf ? buf.slice() : new Uint8Array(PX * 4);
  const tex = newTex(b);
  const D = dirs();

  /* 획 한 토막 — 방향 a 에서 방향 b 까지. 점이 아니라 **선분**이라, 손가락이 빨리
     지나가도 점선이 안 된다(끊긴 자리를 메우려고 점을 더 찍을 필요가 없다). */
  function seg(a, c, r, ink, erase){
    const ax = a[0], ay = a[1], az = a[2];
    const bx = c[0], by = c[1], bz = c[2];
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const ee = ex * ex + ey * ey + ez * ez;
    const soft = 0.9 / PAINT_RES * 2;             // 텍셀 한 칸쯤 풀어 준다
    const rgb = INK_RGB[((ink % 3) + 3) % 3];

    /* 붓이 닿을 칸만 훑는다. 가장자리에 걸치면 전체를 돈다 —
       거기서는 정사각형이 접혀 있어서 상자가 뜻을 잃는다. */
    let i0 = 0, i1 = PAINT_RES - 1, j0 = 0, j1 = PAINT_RES - 1;
    const p = r * 0.6 + 0.04;
    const ua = octUV(ax, ay, az), ub = octUV(bx, by, bz);
    const lo0 = Math.min(ua[0], ub[0]) - p, hi0 = Math.max(ua[0], ub[0]) + p;
    const lo1 = Math.min(ua[1], ub[1]) - p, hi1 = Math.max(ua[1], ub[1]) + p;
    if (lo0 > 0.015 && hi0 < 0.985 && lo1 > 0.015 && hi1 < 0.985){
      i0 = Math.max(0, Math.floor(lo0 * PAINT_RES));
      i1 = Math.min(PAINT_RES - 1, Math.ceil(hi0 * PAINT_RES));
      j0 = Math.max(0, Math.floor(lo1 * PAINT_RES));
      j1 = Math.min(PAINT_RES - 1, Math.ceil(hi1 * PAINT_RES));
    }

    for (let j = j0; j <= j1; j++){
      for (let i = i0; i <= i1; i++){
        const k = j * PAINT_RES + i, k3 = k * 3;
        const px = D[k3], py = D[k3 + 1], pz = D[k3 + 2];
        let t = ee > 1e-9
          ? ((px - ax) * ex + (py - ay) * ey + (pz - az) * ez) / ee : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - (ax + ex * t), dy = py - (ay + ey * t), dz = pz - (az + ez * t);
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        let na = (r + soft - d) / (2 * soft);
        if (na <= 0) continue;
        if (na > 1) na = 1;
        const k4 = k * 4;
        const cur = b[k4 + 3] / 255;
        if (erase){
          b[k4 + 3] = Math.round(cur * (1 - na) * 255);
          continue;
        }
        const out = na + cur * (1 - na);
        const w = out > 0 ? 1 / out : 0;
        b[k4]     = Math.round((rgb[0] * na + b[k4]     * cur * (1 - na)) * w);
        b[k4 + 1] = Math.round((rgb[1] * na + b[k4 + 1] * cur * (1 - na)) * w);
        b[k4 + 2] = Math.round((rgb[2] * na + b[k4 + 2] * cur * (1 - na)) * w);
        b[k4 + 3] = Math.round(out * 255);
      }
    }
    tex.needsUpdate = true;
  }

  return {
    buf: b,
    tex,
    /* 획 하나(점 여럿)를 통째로. 점이 하나뿐이면 제자리 한 점을 찍는다 */
    draw(s){
      const p = s.p || [], r = Math.max(0.02, +s.r || 0.15);
      const ink = s.e ? -1 : (s.c | 0), erase = !!s.e;
      if (p.length < 3) return;
      if (p.length === 3){ seg(p, p, r, ink, erase); return; }
      for (let i = 0; i + 5 < p.length; i += 3)
        seg([p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], r, ink, erase);
    },
    /* 그리는 중에는 토막 하나씩 온다 */
    seg,
    snapshot(){ return b.slice(); },
    restore(s){ b.set(s); tex.needsUpdate = true; },
    dispose(){ tex.dispose(); },
  };
}

/* 획 목록을 짧은 문자열 하나로. 캐시 열쇠이자 「바뀌었나」 판정이다 —
   초상과 화면이 같은 식을 써야 목록의 얼굴만 안 바뀌는 일이 안 생긴다. */
export function markKey(list){
  if (!list || !list.length) return '';
  return list.map(s => (s.e ? 'e' : (s.c | 0)) + ':' + (+s.r || 0).toFixed(2)
                       + ':' + (s.p || []).length + ':' + (s.p || []).slice(0, 6).join(',')
                       + (s.p && s.p.length > 6 ? ',' + s.p.slice(-3).join(',') : '')).join(';');
}

/* 같은 그림을 두 번 굽지 않는다. 열여섯 장까지 — 한 장에 147KB 이고, 실제로 칠해진
   고양이가 열여섯을 넘는 판은 없다(자리가 스물이고 대부분은 맨 몸이다). */
const paintCache = new Map();
const PAINT_CACHE_MAX = 16;
function put(key, tex){
  paintCache.set(key, tex);
  while (paintCache.size > PAINT_CACHE_MAX){
    const k = paintCache.keys().next().value;
    const t = paintCache.get(k);
    paintCache.delete(k);
    if (t) t.dispose();
  }
  return tex;
}
/* 이미 칠해 둔 판을 그대로 캐시에 넣는다. 작업대가 한 획을 마칠 때마다 부른다 —
   안 그러면 초상 쪽이 같은 그림을 처음부터 다시 그린다(획이 늘수록 제곱으로 는다). */
export function adoptPaint(key, buf){
  if (!key) return null;
  const hit = paintCache.get(key);
  if (hit) return hit;
  return put(key, newTex(buf.slice()));
}
export function paintFor(list){
  const key = markKey(list);
  if (!key) return null;
  const hit = paintCache.get(key);
  if (hit) return hit;
  const p = makePaint();
  for (const s of list) p.draw(s);
  return put(key, p.tex);
}

export const FACE = {
  fur:   0xE8A657,
  autoInk: 1,           // 바탕 밝기에 따라 획 색을 뒤집는다
  ink:   0x3A3038,      // 순검정은 눈이 아니라 구멍이 된다
  shine: 0xFFFFFF,

  eyeMode: 0,           // EYE_SET 의 번호
  mouthMode: 0,         // MOUTH_SET 의 번호
  /* 눈 자리는 각도다. 단위구로 되돌린 얼굴에서 "옆으로 얼마 · 위아래로 얼마".
     간격은 넓은 쪽이 안전하다 — 좁으면 시선이 한 점에 몰려 노려보는 얼굴이 된다 */
  eyeGap: 0.68, eyeUp: -0.15,
  /* 작게. 큰 눈은 즉시 마스코트가 되는데, 이 실루엣은 피규어 쪽이라
     이목구비가 작아야 조형이 주인공으로 남는다 */
  eyeW: 0.115, eyeH: 0.140,
  /* 안광은 **끈다.** k7 은 "구멍을 눈으로 만드는 제일 싼 레버" 라고 적었는데
     그건 눈이 클 때 얘기다. 이 크기에서는 점 하나가 이미 눈으로 읽히고,
     하이라이트를 넣으면 점 안에 점이 생겨서 오히려 지저분해진다 */
  shineOn: 0,

  mouthUp: -0.50,       // 눈보다 아래. 위로 올리면 즉시 어른 얼굴이 된다
  mouthR: 0.072, mouthW: 0.021,
};

/* GLSL — 얼굴 하나를 칠하는 데 필요한 전부. */
const CHUNK = /* glsl */`
uniform vec3  uFur, uInk, uShine;
uniform vec3  uBody, uBodyR;
uniform sampler2D uPaint;        // 손이 지나간 자리. 옥타히드럴로 편 방향 한 장
uniform float uPaintOn;
uniform vec3  uHead, uHeadR;
uniform vec2  uEye, uEyeR;
uniform float uEyeMode, uShineOn;
uniform vec2  uMouth;      // x = 반지름, y = 높이
uniform float uMouthW, uMouthMode;
/* 시간대 빛깔. 저녁이면 주황이, 밤이면 푸른빛이 곱해진다 —
   diffuseColor 를 통째로 우리가 쓰므로 material.color 는 무시된다. 여기서 곱해야 한다 */
uniform vec3  uTint;
varying vec3  vObjPos;

/* 마크 하나를 얹는다. m 이 0보다 작으면 안쪽.
   fwidth 로 가장자리를 한 픽셀만 풀어 준다 — 안 하면 계단이 진다 */
vec3 lay(vec3 base, float m, vec3 col){
  float aa = fwidth(m) * 0.85 + 1e-6;
  return mix(base, col, 1.0 - smoothstep(-aa, aa, m));
}

/* 방향 e 를 바라보는 접평면 좌표. u 는 가로, v 는 세로. */
vec2 faceUV(vec3 d, vec3 e, out float front){
  front = dot(d, e);
  vec3 uA = normalize(cross(vec3(0.0, 1.0, 0.0), e));
  vec3 vA = cross(e, uA);
  vec3 t = d - e * front;
  return vec2(dot(t, uA), dot(t, vA));
}

vec3 markEye(vec3 col, vec3 d, float s){
  vec3 e = normalize(vec3(s * uEye.x, uEye.y, 1.0));
  float front;
  vec2 uv = faceUV(d, e, front);
  if (front <= 0.05) return col;

  /* 찡긋은 **한쪽만** 감는다 — 좌우가 다른 것이 이 표정의 전부다.
     markEye 는 눈마다 한 번씩 불리고 s 로 어느 쪽인지 알고 있으므로, 여기서 갈아 끼운다. */
  float mode = uEyeMode;
  if (mode > 7.5) mode = (s > 0.0) ? 1.0 : 0.0;

  float m;
  if (mode < 0.5){                           // 기본 — 납작한 콩
    m = length(uv / uEyeR) - 1.0;
  } else if (mode < 1.5){                    // 반달 눈 ^ ^ — 위로 휜 획
    float r = uEyeR.x * 0.95;
    m = abs(length(uv - vec2(0.0, -r * 0.60)) - r) - uEyeR.y * 0.20;
    if (uv.y < -r * 0.55) m = 1.0;           // 아래쪽 반은 버린다
  } else if (mode < 2.5){                    // 졸린 눈 — 끝이 둥근 가로 획
    m = length(vec2(max(abs(uv.x) - uEyeR.x * 0.72, 0.0), uv.y)) - uEyeR.y * 0.20;
  } else if (mode < 3.5){                    // 시무룩 — 반달을 위아래로 뒤집은 획
    float r = uEyeR.x * 0.95;
    m = abs(length(uv - vec2(0.0, r * 0.60)) - r) - uEyeR.y * 0.20;
    if (uv.y > r * 0.55) m = 1.0;
  } else if (mode < 4.5){                    // 동그란 눈 — 놀란 얼굴
    m = length(uv / (uEyeR * 1.55)) - 1.0;
  } else if (mode < 5.5){                    // 초롱초롱 — 큰 눈 + 안광 둘
    m = length(uv / (uEyeR * 1.60)) - 1.0;
    col = lay(col, m, uInk);
    col = lay(col, length((uv - vec2(s * uEyeR.x * 0.42, uEyeR.y * 0.50)) / (uEyeR * 0.62)) - 1.0, uShine);
    col = lay(col, length((uv + vec2(s * uEyeR.x * 0.36, uEyeR.y * 0.62)) / (uEyeR * 0.30)) - 1.0, uShine);
    return col;
  } else if (mode < 6.5){                    // 별 눈 — 애스트로이드(네 갈래)
    vec2 q = abs(uv) / (uEyeR * 1.95);
    float a = sqrt(q.x) + sqrt(q.y);
    m = a * a - 1.0;
  } else {                                   // X 눈 — 획 둘이 엇갈린다
    vec2 q = uv / uEyeR;
    vec2 r1 = vec2(q.x + q.y, q.x - q.y) * 0.7071;
    m = min(length(vec2(max(abs(r1.x) - 0.95, 0.0), r1.y)),
            length(vec2(max(abs(r1.y) - 0.95, 0.0), r1.x))) - 0.26;
  }
  col = lay(col, m, uInk);

  /* 안광 — 기본 눈에서만, 그리고 꺼져 있다. 눈을 크게 키울 때만 켤 값이다 */
  if (mode < 0.5 && uShineOn > 0.5)
    col = lay(col, length((uv - vec2(s * uEyeR.x * 0.30, uEyeR.y * 0.34)) / uEyeR)
                   - 0.30, uShine);
  return col;
}

/* 입 — 여덟 벌. 전부 uMouth.x 를 기준 크기로 쓰므로 얼굴 비율이 바뀌어도 같이 따라간다. */
vec3 markMouth(vec3 col, vec3 d){
  if (uMouth.x <= 0.0 || uMouthMode > 6.5) return col;   // 7 = 입 없음
  vec3 e = normalize(vec3(0.0, uMouth.y, 1.0));
  float front;
  vec2 uv = faceUV(d, e, front);
  if (front <= 0.05) return col;

  float r = uMouth.x, w = uMouthW, m;
  if (uMouthMode < 0.5){                     // 기본 ω — 원 둘의 아래쪽 반
    m = min(abs(length(uv - vec2(-r, 0.0)) - r),
            abs(length(uv - vec2( r, 0.0)) - r)) - w;
    if (uv.y > w) m = 1.0;
  } else if (uMouthMode < 1.5){              // 미소 — 아래로 휜 획 하나
    float k = r * 1.5;
    m = abs(length(uv - vec2(0.0, k * 0.55)) - k) - w;
    if (uv.y > 0.0) m = 1.0;
  } else if (uMouthMode < 2.5){              // 활짝 웃음 — 채운 아래 반원
    m = length(uv / vec2(r * 1.7, r * 1.5)) - 1.0;
    if (uv.y > 0.0) m = max(m, length(vec2(uv.x, uv.y * 6.0) / vec2(r * 1.7, r * 1.5)) - 1.0);
  } else if (uMouthMode < 3.5){              // 놀람 — 작고 동그란 입(테두리)
    m = abs(length(uv / vec2(1.0, 1.25)) - r * 0.62) - w * 0.9;
  } else if (uMouthMode < 4.5){              // 동글 입 — 채운 동그라미
    m = length(uv / vec2(1.0, 1.22)) - r * 0.80;
  } else if (uMouthMode < 5.5){              // 화남 — 위로 휜 획 하나
    float k = r * 1.5;
    m = abs(length(uv - vec2(0.0, -k * 0.55)) - k) - w;
    if (uv.y < 0.0) m = 1.0;
  } else {                                   // 무표정 — 짧은 가로 획
    m = length(vec2(max(abs(uv.x) - r * 0.75, 0.0), uv.y)) - w * 0.85;
  }
  return lay(col, m, uInk);
}

/* 방향 하나를 정사각형 하나에 편다 (옥타히드럴).
   위쪽 반구는 가운데 마름모, 아래쪽 반구는 네 귀퉁이로 접힌다 — 극이 없다.
   칠하는 쪽(JS)이 같은 식의 역을 쓴다. */
vec2 octUV(vec3 d){
  d /= (abs(d.x) + abs(d.y) + abs(d.z));
  vec2 uv = (d.y >= 0.0) ? d.xz : (1.0 - abs(d.zx)) * sign(d.xz);
  return uv * 0.5 + 0.5;
}

/* 무늬 — 몸 전체를 공 하나로 되돌려 놓고, 그 방향으로 텍스처를 읽는다.
   상한이 없다: 몇 획을 긋든 읽는 값은 하나다. */
vec3 paintMarks(vec3 col, vec3 p){
  if (uPaintOn < 0.5) return col;
  vec4 m = texture2D(uPaint, octUV(normalize((p - uBody) / uBodyR)));
  return mix(col, m.rgb, m.a);
}

/* 머리를 단위구로 되돌려 놓고 그 위에만 그린다.
   몸통·다리·꼬리는 얼굴이 안 걸리므로 바탕색(+무늬) 그대로 나간다.
   **무늬가 먼저, 이목구비가 나중**이다 — 얼굴에 얼룩을 찍어도 눈은 안 지워진다. */
vec3 paintFur(vec3 p){
  vec3 col = paintMarks(uFur, p);
  vec3 q = (p - uHead) / uHeadR;
  float dl = length(q);
  if (dl > 1.45) return col;
  vec3 d = q / dl;
  col = markEye(col, d,  1.0);
  col = markEye(col, d, -1.0);
  col = markMouth(col, d);
  return col;
}
`;

/* MeshStandardMaterial 을 그대로 쓰고 diffuse 한 줄만 가로챈다.
   그림자·조명·flat 셰이딩은 three 것을 그대로 받는다 — 칠하는 일만 우리 몫이다. */
export function furMaterial(opts = {}){
  const F = { ...FACE, ...opts };
  const U = {
    uFur:   { value: new THREE.Color(F.fur) },
    uInk:   { value: new THREE.Color(F.ink) },
    uShine: { value: new THREE.Color(F.shine) },
    uHead:  { value: new THREE.Vector3(0, 0.6, 0.35) },
    uHeadR: { value: new THREE.Vector3(0.33, 0.25, 0.22) },
    uBody:  { value: new THREE.Vector3(0, 0.45, 0) },
    uBodyR: { value: new THREE.Vector3(0.35, 0.45, 0.55) },
    uPaint:  { value: blank() },
    uPaintOn:{ value: 0 },
    uEye:   { value: new THREE.Vector2(F.eyeGap, F.eyeUp) },
    uEyeR:  { value: new THREE.Vector2(F.eyeW, F.eyeH) },
    uEyeMode:{ value: F.eyeMode },
    uShineOn:{ value: F.shineOn },
    uMouth: { value: new THREE.Vector2(F.mouthR, F.mouthUp) },
    uMouthW:{ value: F.mouthW },
    uMouthMode:{ value: F.mouthMode },
    uTint:  { value: new THREE.Color(0xFFFFFF) },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF, roughness: 0.90, metalness: 0, flatShading: true });

  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'varying vec3 vObjPos;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = transformed;');
    shader.fragmentShader = CHUNK + shader.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
               'vec4 diffuseColor = vec4( paintFur( vObjPos ) * uTint, opacity );');
  };

  mat.userData.U = U;
  mat.userData.face = F;

  /* 다시 깎을 때마다 머리 기준점이 바뀐다 (비율 슬라이더가 머리를 옮기므로).
     몸 기준점도 같이 온다 — 자세가 바뀌면 상자도 바뀌고, 안 넣으면 앉은 고양이에
     서 있는 고양이의 무늬 좌표가 찍힌다(얼굴에서 이미 한 번 밟은 자리다). */
  mat.userData.setAnchor = a => {
    U.uHead.value.fromArray(a.head);
    U.uHeadR.value.fromArray(a.headR);
    if (a.body)  U.uBody.value.fromArray(a.body);
    if (a.bodyR) U.uBodyR.value.fromArray(a.bodyR);
  };

  /* 무늬 — 획 목록을 넘기면 그 그림의 텍스처를 물린다(같은 그림은 한 번만 굽는다).
     작업대는 그리는 중이라 캐시를 못 쓰므로 텍스처를 직접 물린다. */
  mat.userData.setMarks = list => {
    const t = paintFor(list);
    U.uPaint.value = t || blank();
    U.uPaintOn.value = t ? 1 : 0;
  };
  mat.userData.setPaintTex = tex => {
    U.uPaint.value = tex || blank();
    U.uPaintOn.value = tex ? 1 : 0;
  };

  mat.userData.set = (k, v) => {
    F[k] = v;
    if (k === 'fur'){
      U.uFur.value.set(v);
      if (F.autoInk){
        const t = inkFor(v);
        F.ink = t.ink; F.shine = t.shine;
        U.uInk.value.set(t.ink); U.uShine.value.set(t.shine);
      }
    }
    else if (k === 'ink')     U.uInk.value.set(v);
    else if (k === 'shine')   U.uShine.value.set(v);
    else if (k === 'eyeGap' || k === 'eyeUp') U.uEye.value.set(F.eyeGap, F.eyeUp);
    else if (k === 'eyeW' || k === 'eyeH')    U.uEyeR.value.set(F.eyeW, F.eyeH);
    else if (k === 'mouthR' || k === 'mouthUp') U.uMouth.value.set(F.mouthR, F.mouthUp);
    else if (k === 'mouthW')  U.uMouthW.value = v;
    else if (k === 'eyeMode') U.uEyeMode.value = v;
    else if (k === 'mouthMode') U.uMouthMode.value = v;
    else if (k === 'shineOn') U.uShineOn.value = v;
    else if (k === 'tint')    U.uTint.value.set(v);
    else if (k === 'marks')   mat.userData.setMarks(v);
  };
  if (opts.marks) mat.userData.setMarks(opts.marks);
  return mat;
}

/* k8 이 정해 둔 상태 연동 표정. 여기서는 uniform 하나다 — 다시 깎지 않는다. */
export const EYE_BY_STATE = { idle: 1, walk: 0, sit: 0, sleep: 2 };

/* ---------- 표정 ----------
   **눈과 입이 따로다.** 처음엔 「얼굴 여섯 벌」을 표로 들고 있었는데, 그러면 고를 수
   있는 것이 여섯이고 그건 커스터마이징이 아니라 목록이다. 눈 열 × 입 여덟이면 여든이고,
   만든 사람도 못 본 얼굴이 그 안에 있다 — 그게 이 화면이 파는 것이다.

   전부 uniform 두 개(uEyeMode · uMouthMode)라 정점도 드로우콜도 안 는다.

   눈의 **-1** 은 「그때그때」다: 상태가 표정을 정한다(자면 감은 눈, 놀면 반달).
   그게 이 게임의 기본이고, 하루 종일 같은 얼굴이면 그건 인형이지 직원이 아니다.
   되돌릴 자리가 목록 안에 있어야 고르는 것이 실험이 된다. */
/* 하트 눈이 6번에 있었다. 뺐다 — 그 얼굴 하나가 이 사무실의 톤에서 혼자 다른 게임이었다.
   뒤 번호를 당겨 붙였다(별·X·찡긋이 6·7·8). 옛 저장의 6은 별 눈이 된다. */
export const EYE_SET   = [0, 1, 2, 3, 4, 5, 6, 7, 8];      // 셰이더의 mode 번호와 같다
export const MOUTH_SET = [0, 1, 2, 3, 4, 5, 6, 7];

/* 안 고른 상태. `c.face` 가 없으면 이것이고, 그러면 지금까지와 한 글자도 안 달라진다. */
export const FACE_NONE = { e: -1, m: 0 };
export function normFaceObj(v){
  if (v && typeof v === 'object')
    return { e: Math.max(-1, Math.min(EYE_SET.length - 1, v.e | 0)),
             m: Math.max(0, Math.min(MOUTH_SET.length - 1, v.m | 0)) };
  /* 옛 저장 — 「얼굴 여섯 벌」의 번호 하나였다. 같은 얼굴로 옮겨 준다. */
  const old = [FACE_NONE, { e:0, m:0 }, { e:1, m:0 }, { e:4, m:0 }, { e:3, m:0 }, { e:2, m:7 }];
  return old[(v | 0)] || FACE_NONE;
}
export function faceKey(f){
  const o = normFaceObj(f);
  return o.e + ':' + o.m;
}
