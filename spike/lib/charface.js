/* ============================================================
   charface.js — facepaint.js 에 **초승달 눈**을 하나 더 붙인 것.

   facepaint.js 의 결론은 "이목구비가 작아야 조형이 주인공으로 남는다" 였다.
   그건 피규어의 규칙이다. 캐릭터는 정반대다 — 눈이 얼굴의 주인공이고,
   조형은 눈을 얹는 판이 된다.

   그래서 바뀌는 건 눈 하나와 기본값 몇 개뿐이다. 칠하는 방식은 그대로다:
   머리를 단위구로 되돌려 놓고 방향 벡터로 자리를 잡는다. 정점 0개, 드로우콜 그대로.

   ── 초승달을 어떻게 그리는가 ──

   원 하나에서 원 하나를 뺀다. 그게 전부다.
     m = max(안쪽 원, -(빼는 원))
   빼는 원을 옆으로 밀면 초승달이 되고, 밀어낸 방향이 초승달이 등지는 쪽이다.
   호(arc)로 그리지 않는 이유: 호는 굵기가 일정해서 양 끝이 뭉툭하다.
   레퍼런스의 눈은 **가운데가 두껍고 끝이 뾰족하다** — 그건 원의 차집합에서만 나온다.
   ============================================================ */

import * as THREE from 'three';
export { FUR, inkFor } from './facepaint.js';

import { inkFor } from './facepaint.js';

export const FACE = {
  fur:   0x2C2A33,      // 레퍼런스는 검정이다. 순검정은 구멍이 되므로 살짝 띄운다
  autoInk: 1,           // 어두운 바탕에서는 획이 밝아진다 (facepaint.js 와 같은 규칙)
  ink:   0xF2ECE1,
  shine: 0x2E2A31,

  /* 0 콩 · 1 웃는 눈 · 2 감은 눈 · 3 초승달 */
  eyeMode: 3,
  eyeGap: 0.62, eyeUp: -0.10,
  /* 크게. facepaint.js 의 기본값(0.115 × 0.140)의 두 배가 넘는다 —
     이 한 줄이 "피규어 → 캐릭터" 에서 조형만큼이나 크게 먹는다 */
  eyeW: 0.255, eyeH: 0.295,
  shineOn: 0,

  /* 초승달 — 빼는 원의 중심(눈 반지름 단위)과 반지름.
     x 를 키우면 초승달이 얇아지고, y 를 흔들면 위아래로 기운다 */
  cutX: 0.60, cutY: 0.06, cutR: 1.02,
  /* 초승달을 통째로 돌린다. 안쪽 끝이 내려오면 화난 얼굴이 된다 —
     조형(mood)이 뾰족해질 때 같이 돌리면 한 캐릭터의 두 상태로 읽힌다 */
  eyeRot: -0.30,

  mouthUp: -0.62, mouthR: 0, mouthW: 0.020,   // 입은 기본으로 끈다
};

const CHUNK = /* glsl */`
uniform vec3  uFur, uInk, uShine;
uniform vec3  uHead, uHeadR;
uniform vec2  uEye, uEyeR;
uniform float uEyeMode, uShineOn, uEyeRot;
uniform vec3  uCut;        // xy = 빼는 원의 중심 · z = 반지름
uniform vec2  uMouth;
uniform float uMouthW;
uniform vec3  uTint;
varying vec3  vObjPos;

vec3 lay(vec3 base, float m, vec3 col){
  float aa = fwidth(m) * 0.85 + 1e-6;
  return mix(base, col, 1.0 - smoothstep(-aa, aa, m));
}

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
  if (uEyeMode < 0.5){                       // 콩 — facepaint.js 의 뜬 눈
    m = length(uv / uEyeR) - 1.0;
  } else if (uEyeMode < 1.5){                // 웃는 눈 ^ ^
    float r = uEyeR.x * 0.95;
    m = abs(length(uv - vec2(0.0, -r * 0.60)) - r) - uEyeR.y * 0.20;
    if (uv.y < -r * 0.55) m = 1.0;
  } else if (uEyeMode < 2.5){                // 감은 눈
    m = length(vec2(max(abs(uv.x) - uEyeR.x * 0.72, 0.0), uv.y)) - uEyeR.y * 0.20;
  } else {                                   // 초승달 — 원에서 원을 뺀다
    vec2 q = uv / uEyeR;
    /* 좌우 대칭이라 도는 방향도 뒤집어야 한다.
       안 뒤집으면 한쪽은 화나고 한쪽은 웃는 얼굴이 된다 (처음에 그렇게 나왔다) */
    float a = uEyeRot * s;
    q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
    float d1 = length(q) - 1.0;
    float d2 = length(q - vec2(uCut.x * s, uCut.y)) - uCut.z;
    m = max(d1, -d2);
  }
  col = lay(col, m, uInk);

  if (uEyeMode < 0.5 && uShineOn > 0.5)
    col = lay(col, length((uv - vec2(s * uEyeR.x * 0.30, uEyeR.y * 0.34)) / uEyeR)
                   - 0.30, uShine);
  return col;
}

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

vec3 paintFur(vec3 p){
  vec3 col = uFur;
  vec3 q = (p - uHead) / uHeadR;
  float dl = length(q);
  if (dl > 1.45) return col;                 // 가시·귀 끝은 여기 안 들어온다
  vec3 d = q / dl;
  col = markEye(col, d,  1.0);
  col = markEye(col, d, -1.0);
  col = markMouth(col, d);
  return col;
}
`;

export function furMaterial(opts = {}){
  const F = { ...FACE, ...opts };
  const U = {
    uFur:    { value: new THREE.Color(F.fur) },
    uInk:    { value: new THREE.Color(F.ink) },
    uShine:  { value: new THREE.Color(F.shine) },
    uHead:   { value: new THREE.Vector3(0, 0.6, 0) },
    uHeadR:  { value: new THREE.Vector3(0.39, 0.31, 0.25) },
    uEye:    { value: new THREE.Vector2(F.eyeGap, F.eyeUp) },
    uEyeR:   { value: new THREE.Vector2(F.eyeW, F.eyeH) },
    uEyeMode:{ value: F.eyeMode },
    uShineOn:{ value: F.shineOn },
    uEyeRot: { value: F.eyeRot },
    uCut:    { value: new THREE.Vector3(F.cutX, F.cutY, F.cutR) },
    uMouth:  { value: new THREE.Vector2(F.mouthR, F.mouthUp) },
    uMouthW: { value: F.mouthW },
    uTint:   { value: new THREE.Color(0xFFFFFF) },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF, roughness: 0.92, metalness: 0, flatShading: true });

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
    else if (k === 'cutX' || k === 'cutY' || k === 'cutR')
      U.uCut.value.set(F.cutX, F.cutY, F.cutR);
    else if (k === 'mouthR' || k === 'mouthUp') U.uMouth.value.set(F.mouthR, F.mouthUp);
    else if (k === 'mouthW')  U.uMouthW.value = v;
    else if (k === 'eyeMode') U.uEyeMode.value = v;
    else if (k === 'eyeRot')  U.uEyeRot.value = v;
    else if (k === 'shineOn') U.uShineOn.value = v;
    else if (k === 'tint')    U.uTint.value.set(v);
  };
  return mat;
}

export const EYE_NAMES = ['콩', '웃는 눈', '감은 눈', '초승달'];
