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

import * as THREE from 'three';

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

export const FACE = {
  fur:   0xE8A657,
  autoInk: 1,           // 바탕 밝기에 따라 획 색을 뒤집는다
  ink:   0x3A3038,      // 순검정은 눈이 아니라 구멍이 된다
  shine: 0xFFFFFF,

  eyeMode: 0,           // 0 뜬 눈 · 1 웃는 눈 ^ ^ · 2 감은 눈
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
uniform vec3  uHead, uHeadR;
uniform vec2  uEye, uEyeR;
uniform float uEyeMode, uShineOn;
uniform vec2  uMouth;      // x = 반지름, y = 높이
uniform float uMouthW;
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

  float m;
  if (uEyeMode < 0.5){                       // 뜬 눈 — 납작한 콩
    m = length(uv / uEyeR) - 1.0;
  } else if (uEyeMode < 1.5){                // 웃는 눈 ^ ^ — 위로 휜 획
    float r = uEyeR.x * 0.95;
    m = abs(length(uv - vec2(0.0, -r * 0.60)) - r) - uEyeR.y * 0.20;
    if (uv.y < -r * 0.55) m = 1.0;           // 아래쪽 반은 버린다
  } else {                                   // 감은 눈 — 끝이 둥근 가로 획
    m = length(vec2(max(abs(uv.x) - uEyeR.x * 0.72, 0.0), uv.y)) - uEyeR.y * 0.20;
  }
  col = lay(col, m, uInk);

  /* 하이라이트 — 기본은 꺼져 있다. 눈을 크게 키울 때만 켤 값이다 */
  if (uEyeMode < 0.5 && uShineOn > 0.5)
    col = lay(col, length((uv - vec2(s * uEyeR.x * 0.30, uEyeR.y * 0.34)) / uEyeR)
                   - 0.30, uShine);
  return col;
}

/* 입 — ω. 원 두 개의 아래쪽 반만 남기면 두 획이 가운데서 만난다. */
vec3 markMouth(vec3 col, vec3 d){
  if (uMouth.x <= 0.0) return col;
  vec3 e = normalize(vec3(0.0, uMouth.y, 1.0));
  float front;
  vec2 uv = faceUV(d, e, front);
  if (front <= 0.05) return col;

  float r = uMouth.x;
  float m = min(abs(length(uv - vec2(-r, 0.0)) - r),
                abs(length(uv - vec2( r, 0.0)) - r)) - uMouthW;
  if (uv.y > uMouthW) m = 1.0;
  return lay(col, m, uInk);
}

/* 머리를 단위구로 되돌려 놓고 그 위에만 그린다.
   몸통·다리·꼬리는 여기 안 들어오므로 바탕색 그대로 나간다. */
vec3 paintFur(vec3 p){
  vec3 col = uFur;
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
    uEye:   { value: new THREE.Vector2(F.eyeGap, F.eyeUp) },
    uEyeR:  { value: new THREE.Vector2(F.eyeW, F.eyeH) },
    uEyeMode:{ value: F.eyeMode },
    uShineOn:{ value: F.shineOn },
    uMouth: { value: new THREE.Vector2(F.mouthR, F.mouthUp) },
    uMouthW:{ value: F.mouthW },
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

  /* 다시 깎을 때마다 머리 기준점이 바뀐다 (비율 슬라이더가 머리를 옮기므로) */
  mat.userData.setAnchor = a => {
    U.uHead.value.fromArray(a.head);
    U.uHeadR.value.fromArray(a.headR);
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
    else if (k === 'shineOn') U.uShineOn.value = v;
    else if (k === 'tint')    U.uTint.value.set(v);
  };
  return mat;
}

/* k8 이 정해 둔 상태 연동 표정. 여기서는 uniform 하나다 — 다시 깎지 않는다. */
export const EYE_BY_STATE = { idle: 1, walk: 0, sit: 0, sleep: 2 };
export const EYE_NAMES = ['뜬 눈', '웃는 눈', '감은 눈'];
