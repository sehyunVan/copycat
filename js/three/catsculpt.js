/* ============================================================
   catsculpt.js — 깎아서 만든 고양이를 사무실에 세운다.

   render3d.js 는 지금까지 고양이를 **손그림 판**(doodle.js 의 cutout)으로 세웠다.
   그건 그대로 둔다 — 설정에서 고를 수 있고, 기본값만 이쪽으로 옮긴다.
   손그림은 위젯·PiP 처럼 아직 미확인인 경로가 남아 있는 한 보험이다.

   여기서 지키는 계약은 doodle.js 의 build() 와 같다:
     { root, plane, kind, baseY, billboard, setState, setFacing, update(dt, camera) }
   그래야 sync() 가 어느 쪽인지 몰라도 된다.

   ── 20마리를 어떻게 감당하는가 ──

   한 마리를 깎는 데 40~70 ms 다. 20마리를 따로 깎으면 부팅이 1초 넘게 멈춘다.
   그럴 필요가 없다 — **몸은 다 같고 색만 다르다.**

     · 지오메트리는 자세마다 하나씩만 깎아서 **전부가 공유한다** (서 있는 것 · 웅크린 것)
     · 색·표정은 재질의 uniform 이라 마리마다 따로 둬도 공짜다
     · 자세가 바뀌면 다시 깎는 게 아니라 **지오메트리를 갈아 끼운다**

   그래서 부팅에 두 번 깎고 끝이다. 고양이가 100마리로 늘어도 그대로다.
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';
import { build, PRESETS } from './sculpt.js';
import { furMaterial, EYE_BY_STATE } from './facepaint.js';
import * as GEAR from './gear.js';
import { collapse } from './merge.js';
import * as EERIE from './eerie.js';

/* 손그림 판과 같은 키. 나란히 놓아도 덩치가 안 튀어야 한다. */
const H = 0.74;

/* 게임에서는 시트(res 36)보다 조금 성글게 깎는다.
   화면에서 한 마리가 차지하는 게 100px 남짓이라 면이 커야 로우폴리로 읽히고,
   삼각형도 절반이 된다. 6면도에서 재 둔 값이 여기서 그대로 예산이 된다. */
const RES = 30;

/* 자세 셋. 전부 m1 의 프리셋 그대로다 — 시트에서 눈으로 정한 값이 여기 값이다.
   다리를 접는 손잡이(legFold)가 있어서 자세마다 모델을 따로 만들 필요가 없다. */
const POSE = {
  stand: {},                   // 서 있는 것 · 걷는 것
  sit:   PRESETS['앉음'],       // 의자 위. 뒷다리만 접고 가슴을 세운다
  loaf:  PRESETS['식빵'],       // 자는 것. 옆으로 눕히는 것보다 식빵이 낫다
};

const shared = new Map();          // pose → { geometry, scale, anchor, tris }
let budget = { ms: 0, tris: 0 };

function poseOf(name){
  let g = shared.get(name);
  if (g) return g;
  const r = build({ ...POSE[name], res: RES, pads: false });   // 발바닥은 사무실에서 안 보인다
  r.geometry.computeBoundingBox();
  const h = r.geometry.boundingBox.max.y || 1;
  g = { geometry: r.geometry, scale: H / h, anchor: r.anchor, tris: r.tris };
  budget.ms += r.ms; budget.tris = Math.max(budget.tris, r.tris);
  shared.set(name, g);
  return g;
}

/* 부팅에서 미리 깎아 둔다. 첫 프레임에 깎으면 그 프레임만 60ms 튄다. */
export function warm(){
  for (const k in POSE) poseOf(k);
  /* 걸음은 첫 화면에 필요 없다. 한 장씩 따로 미뤄서 굽는다 —
     넷을 한 번에 구우면 그 프레임 하나가 통째로 멈춘다. */
  if (!walkWarmed){
    walkWarmed = true;
    let i = 0;
    const next = () => { if (i < GAIT_N / 2){ walkGeom(i++); setTimeout(next, 0); } };
    setTimeout(next, 150);
  }
  warmExtras();                 // 꼬리 · 귀 (TODO 39). 걸음보다 더 뒤로 미룬다
  return stats();
}

const POSE_BY_STATE = { idle:'stand', walk:'stand', sit:'sit', sleep:'loaf' };

/* ============================================================
   걸음

   여기 있던 주석은 이렇게 자백하고 있었다: *"관절이 없으니 통째로 흔든다.
   다리가 안 움직여도 위아래로 튀면 걷는다."* 반은 맞다 — 위아래로 튀면 확실히
   걷는 것처럼 보인다. 그런데 옆에서 보면 **네 다리를 뻣뻣하게 붙인 채 미끄러지는**
   물건이고, 사무실을 가로지르는 20초 동안 그게 계속 보인다.

   스키닝(m2)이 오기 전에 할 수 있는 게 하나 있다. 이 방식에서는 자세를 바꾸는 게
   모델을 고치는 일이 아니라 **숫자를 바꿔 다시 깎는 일**이다(sculpt.js 의 legStep).
   그러면 걷는 장면을 몇 장 깎아 두고 돌려 쓰면 된다 — 스프라이트 시트와 같은 방식이고,
   실은 2D 고양이가 처음부터 그렇게 걷고 있었다(sprite.js 의 walk 3프레임).

   비용을 두 번 접는다:

   · **절반만 깎는다.** 대각 보행이라 반 주기 뒤의 자세는 **좌우를 뒤집은 같은 자세**다
     (앞오른쪽·뒤왼쪽 짝 ↔ 앞왼쪽·뒤오른쪽 짝). 고양이 몸은 x 대칭이므로
     x 를 뒤집고 삼각형 감는 순서를 되돌리면 그대로 나머지 반 주기가 된다. 깎을 필요가 없다
   · **부팅에서 안 깎는다.** 09시 전까지는 아무도 안 걷는다. 기본 자세 셋만 먼저 깎고
     걸음은 뒤로 미룬다 — 그 사이에 누가 걸으면 그 자리에서 깎이고, 그다음부터는 캐시다

   그리고 **위상을 시간이 아니라 이동 거리로 돌린다.** 시간으로 돌리면 빠른 고양이는
   발이 미끄러지고 느린 고양이는 종종거린다. 간 거리를 STRIDE 로 나누면 누가 얼마나
   빨리 걷든 발이 바닥을 짚는 자리에서 그대로 짚는다.
   ============================================================ */
const GAIT_N = 8;            // 한 주기를 몇 장으로 쪼갤 것인가 (뒤 절반은 좌우 반전이라 깎는 건 넷)
const STEP = 0.080;          // 발끝이 앞뒤로 흔들리는 폭
const LIFT = 0.030;          // 흔드는 동안 드는 높이. 이게 없으면 바닥을 끈다
const STRIDE = 1.30;         // 이 거리를 가면 한 주기. 발이 안 미끄러지는 값

const walkGeoms = new Array(GAIT_N).fill(null);

/* 위상 p 에서 다리 넷이 어디 있는가.
   한 짝(앞오른쪽·뒤왼쪽)은 앞뒤로 코사인, 드는 건 **뒤에서 앞으로 돌아오는 반 주기에만**.
   나머지 짝은 반 주기 어긋난 같은 운동이다. 그래서 늘 둘은 땅을 짚고 있다 —
   그 덕에 발밑(y=0)이 안 흔들려서 장면마다 고양이 키가 튀지 않는다. */
function gaitAt(p){
  const leg = ph => [Math.cos(ph) * STEP, Math.max(0, -Math.sin(ph)) * LIFT];
  const A = leg(p * Math.PI * 2), B = leg(p * Math.PI * 2 + Math.PI);
  return { FR:A, BL:A, FL:B, BR:B };
}

/* x 를 뒤집는다. 뒤집으면 삼각형이 안팎으로 뒤집히므로 정점 순서도 되돌려야
   면이 계속 바깥을 본다 (flat 셰이딩이라 법선은 감는 순서가 전부다). */
function mirrorX(geom){
  const src = geom.getAttribute('position').array;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 9)
    for (let v = 0; v < 3; v++){
      const a = i + (2 - v) * 3, b = i + v * 3;
      out[b] = -src[a]; out[b + 1] = src[a + 1]; out[b + 2] = src[a + 2];
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function walkGeom(i){
  let g = walkGeoms[i];
  if (g) return g;
  const half = GAIT_N / 2;
  if (i >= half) g = mirrorX(walkGeom(i - half));
  else {
    const r = build({ ...POSE.stand, res: RES, pads: false, legStep: gaitAt(i / GAIT_N) });
    budget.ms += r.ms;
    g = r.geometry;
  }
  walkGeoms[i] = g;
  return g;
}
let walkWarmed = false;

/* ============================================================
   꼬리 · 귀 — TODO 39

   ── 왜 꼬리부터인가 ──

   먼저 쟀다(spike/measure-motion.js). 기본 배율에서 고양이는 화면에서 141px 이고
   발끝은 한 주기에 **22px** 움직인다 — 설계가 걱정한 「3~4px 이면 안 보인다」가
   아니었다. 발은 이미 충분히 보이고 있고, 그러면 요청의 뜻은 **안 움직이는 데가
   눈에 띈다**는 쪽이다. 서 있는 고양이·앉은 고양이는 지금 완전히 굳어 있다.

   ── 곱셈을 피한다 ──

   이 방식의 값어치는 스무 마리가 장면 몇 장을 나눠 쓴다는 것이다. 여기에 축을
   더할 때마다 장면 수가 곱해지므로, 겹치지 않게 나눈다:

     걷는 중   발 (지금 그대로) — 꼬리 위상을 **안 더한다.** 이미 볼 것이 있다
     서 있음·앉음  꼬리 — 여기가 굳어 있던 자리다
     자는 중   없음 — 자는 고양이는 굳어 있는 게 맞다
     사건      귀 — 한 번 튕기고 돌아온다. 주기가 아니라서 곱셈이 안 생긴다

   그래서 꼬리는 **자세당 위상 셋**이고, 가운데는 기본 자세 그대로다(굽지 않는다).
   서 있는 자세는 좌우 대칭이라 왼쪽이 오른쪽의 거울이다 — 걸음에서 반 주기를
   접었던 그 방법을 그대로 쓴다. 결국 새로 굽는 것은 **다섯 장**뿐이다:
   서기-오른쪽 · 앉기-왼쪽 · 앉기-오른쪽 · 서기-귀 · 앉기-귀.

   귀가 튕기는 동안에는 꼬리를 가운데로 둔다. 그래야 꼬리×귀 곱셈이 안 생기고,
   0.4초짜리라 아무도 못 알아챈다.
   ============================================================ */
/* 꼬리를 옆으로 흘리는 폭. 앉은 자세는 이미 0.95 로 흘려 둔 값이 있어서(등받이를
   피하려고) 그 언저리에서 흔든다. 서 있는 자세는 0 이 기준이라 좌우로 벌린다. */
const TAIL_SWING = { stand: 0.50, sit: 0.34 };
const tailGeoms = new Map();          // `pose|i` → geometry   (i: 0 왼 · 1 가운데 · 2 오른)

function tailGeom(pose, i){
  if (i === 1) return poseOf(pose).geometry;        // 가운데는 기본 자세 그대로다
  const key = pose + '|' + i;
  let g = tailGeoms.get(key);
  if (g) return g;
  const P = POSE[pose] || {};
  const base = P.tailSide || 0, sw = TAIL_SWING[pose] || 0.4;
  /* 서 있는 자세는 좌우 대칭이므로 왼쪽은 오른쪽의 거울이다 — 안 굽는다 */
  if (pose === 'stand' && i === 0) g = mirrorX(tailGeom('stand', 2));
  else {
    const r = build({ ...P, res: RES, pads: false, tailSide: base + (i === 2 ? sw : -sw) });
    budget.ms += r.ms;
    g = r.geometry;
  }
  tailGeoms.set(key, g);
  return g;
}

/* 귀 한 번 튕기기. 귀를 벌리고 앞으로 세운다 — 「무슨 소리 났냐」 하는 얼굴이다.
   **키는 안 건드린다**(earH 그대로): 배율은 기본 자세 것을 계속 쓰므로 높이가
   바뀌면 고양이가 순간 커진다. */
const EAR_PERK = { earTilt: 0.130, earLean: 0.035, earSpread: 0.222 };
const earGeoms = new Map();
function earGeom(pose){
  let g = earGeoms.get(pose);
  if (g) return g;
  const r = build({ ...(POSE[pose] || {}), ...EAR_PERK, res: RES, pads: false });
  budget.ms += r.ms;
  g = r.geometry;
  earGeoms.set(pose, g);
  return g;
}

/* 부팅에서 안 굽는다. 걸음과 같은 이유이고 같은 방식이다 — 한 장씩 미뤄서 굽는다.
   첫 화면에 필요한 건 기본 자세 셋뿐이고, 나머지는 그 뒤에 조용히 채워진다. */
let extraWarmed = false;
function warmExtras(){
  if (extraWarmed) return;
  extraWarmed = true;
  const jobs = [
    () => tailGeom('stand', 2), () => tailGeom('stand', 0),
    () => tailGeom('sit', 2),   () => tailGeom('sit', 0),
    () => earGeom('stand'),     () => earGeom('sit'),
  ];
  let i = 0;
  const next = () => { if (i < jobs.length){ jobs[i++](); setTimeout(next, 0); } };
  setTimeout(next, 420);        // 걸음(150ms)보다 뒤에. 부팅 프레임을 겹쳐 밟지 않는다
}

export function sculptActor(opt = {}){
  const stand = poseOf('stand');
  const mat = furMaterial({ fur: opt.fur ?? 0xE8A657 });
  mat.userData.setAnchor(stand.anchor);

  const mesh = new THREE.Mesh(stand.geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(stand.scale);

  const root = new THREE.Group();
  root.add(mesh);

  /* 장비 — 몸과 같은 배율의 묶음. 앵커가 깎기 전 좌표계라 여기서 같이 줄여야 맞는다.
     자세가 바뀌면 정수리도 목도 옮겨 가므로 **다시 만든다** — 세 조각짜리라 싸다. */
  const gearRoot = new THREE.Group();
  root.add(gearRoot);
  let gearKey = '', equipNow = null;

  let t = Math.random() * 6, state = 'idle', pose = 'stand';
  let yaw = 0, wantYaw = 0;
  /* 걸음의 위상과 지금 걸린 장면. 위상은 마리마다 다르게 시작한다 —
     스무 마리가 발을 맞춰 걸으면 사무실이 아니라 열병식이다. */
  let gait = Math.random(), frame = -1;
  /* 꼬리도 마리마다 다르게 시작하고 **주기까지 다르다.** 위상만 흩으면 한 바퀴 뒤에
     다시 모여서, 몇 초에 한 번씩 스무 마리가 같이 꼬리를 흔드는 순간이 온다. */
  let tailT = Math.random() * 9, tailP = 2.7 + Math.random() * 1.9;
  let earUntil = -1;                  // 귀를 튕기고 돌아올 시각(t 기준). 음수면 안 튕기는 중
  let shape = '';                     // 지금 걸린 지오메트리의 이름. 바뀔 때만 갈아 끼운다

  /* 이번 프레임에 어떤 장면이 걸려야 하는가 — **한 군데서만 정한다.**
     걸음·꼬리·귀가 각자 mesh.geometry 를 만지면 마지막에 쓴 쪽이 이기고,
     그건 「가끔 꼬리가 안 흔들리는 고양이」로 나타난다. */
  function applyShape(){
    let key, geom;
    if (state === 'walk'){
      const p = gait - Math.floor(gait);
      const i = Math.min(GAIT_N - 1, Math.floor(p * GAIT_N));
      frame = i; key = 'w' + i; geom = walkGeom(i);
    } else if (t < earUntil && (pose === 'stand' || pose === 'sit')){
      frame = -1; key = 'e' + pose; geom = earGeom(pose);
    } else if (state === 'sleep' || (pose !== 'stand' && pose !== 'sit')){
      /* 자는 고양이는 굳어 있는 게 맞다 */
      frame = -1; key = 'p' + pose; geom = poseOf(pose).geometry;
    } else {
      const s = Math.sin(tailT / tailP * Math.PI * 2);
      const i = s < -0.34 ? 0 : s > 0.34 ? 2 : 1;
      frame = -1; key = 't' + pose + i; geom = tailGeom(pose, i);
    }
    if (key !== shape){ shape = key; mesh.geometry = geom; }
  }

  function dress(){
    gearRoot.clear();
    if (!equipNow) return;
    const g = poseOf(pose);
    gearRoot.scale.setScalar(g.scale);
    const o = GEAR.dress(equipNow, g.anchor);
    o.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; } });
    gearRoot.add(o);
    /* 모자 하나에 조각이 예닐곱 개다. 스무 마리가 각자 걸치면 드로우콜이 300을 넘는다.
       장비는 따로 움직이지 않으므로 **한 마리치를 통째로 구워** 1콜로 만든다. */
    collapse(gearRoot, { flatShading: true });
  }

  const api = {
    root, plane: null, mesh, kind: 'sculpt',
    baseY: 0,
    /* 빌보드가 아니다 — 진짜 3D 라서 제 방향을 본다.
       손그림 판은 늘 카메라를 봐야 했는데, 여기서는 그러면 오히려 이상하다. */
    billboard: false,

    setState(s){
      if (s === state) return;
      /* 서 있다 앉는 것도 사건이다 — 자리에 앉는 순간·일어서는 순간 귀가 한 번 튕긴다.
         걷기 시작하고 멈추는 것은 이미 발이 말하고 있으므로 뺀다. */
      const wasIdleish = state !== 'walk', nowIdleish = s !== 'walk';
      state = s;
      const want = POSE_BY_STATE[s] || 'stand';
      if (want !== pose){
        pose = want;
        const g = poseOf(pose);
        mesh.scale.setScalar(g.scale);
        mat.userData.setAnchor(g.anchor);
        dress();                    // 앉으면 정수리도 목도 옮겨 간다
        if (wasIdleish && nowIdleish && s !== 'sleep') api.flick();
      }
      /* 걷다 멈추면 마지막 장면 그대로 굳는다 — 한 발 내민 채 서 있는 고양이가 된다.
         이제 그 되돌리기는 applyShape 하나가 맡는다: 상태가 바뀌었으니 다음 프레임에
         저절로 꼬리 장면으로 갈아 끼워진다. */
      applyShape();
      /* 표정 — k8 이 정한 상태 연동. 다시 깎지 않는다, 숫자 하나다. */
      mat.userData.set('eyeMode', EYE_BY_STATE[s] ?? 0);
    },

    /* 귀를 한 번 튕긴다. **주기가 아니라 사건이다** — 상시로 돌리면 스무 마리의 귀가
       계속 떨리고 그건 생기가 아니라 노이즈고, 위상 축이 하나 더 늘어난다.
       자는 고양이는 안 튕긴다(깨우지 않는다). */
    flick(){
      if (state === 'sleep') return;
      earUntil = t + 0.42;
    },

    /* 렌더러가 이번 프레임에 이 고양이를 얼마나 옮겼는지 알려준다.
       시뮬은 10Hz 로 뛰므로 대부분의 프레임에서 0 이고 가끔 한 뭉치가 온다 —
       거리를 그대로 쌓으면 그래도 총량은 맞는다. 순간이동(월드 재구성·의자 위로
       올려놓기)은 한 걸음보다 클 수 없게 잘라 낸다. */
    setStep(d){ gait += Math.min(0.35, d) / STRIDE; },

    /* equip 은 { head, neck, paw }. 매 프레임 불려도 되게 열쇠로 걸러 낸다 */
    setGear(equip){
      const key = equip ? [equip.head, equip.neck, equip.paw].join('|') : '';
      if (key === gearKey) return;
      gearKey = key;
      equipNow = equip;
      dress();
    },

    /* 손그림은 ±1 좌우 반전이었다. 여기서는 진짜 각도를 받는다. */
    setFacing(f){ wantYaw = f < 0 ? -Math.PI / 2 : Math.PI / 2; },
    setHeading(rad){ wantYaw = rad; },
    pose(){ return pose; },
    frame(){ return frame; },          // 지금 걸린 걸음 장면. -1 이면 안 걷는 중 (debug 가 읽는다)
    shape(){ return shape; },          // 지금 걸린 지오메트리의 이름 (검사가 읽는다 — TODO 39)
    setFur(hex){ mat.userData.set('fur', hex); },
    setTint(hex){ mat.userData.set('tint', hex); },

    update(dt){
      t += dt;
      tailT += dt;
      /* 방향은 부드럽게 따라간다. 즉시 돌리면 길 모퉁이마다 팽이가 된다. */
      let d = wantYaw - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw += d * Math.min(1, dt * 9);
      root.rotation.y = yaw;

      /* 걸음·꼬리·귀 — 어느 장면이 걸릴지는 여기 한 군데서 정해진다 */
      applyShape();

      if (state === 'walk'){
        /* 몸통은 계속 흔든다. 다만 **걸음과 같은 위상**이다 —
           한 짝이 흔들려 나가는 순간(p=0.25·0.75)에 몸이 제일 높다.
           따로 놀면 다리는 걷는데 몸은 다른 박자로 뛰는 물건이 된다. */
        const th = (gait - Math.floor(gait)) * Math.PI * 2;
        root.position.y = api.baseY + Math.abs(Math.sin(th)) * 0.022;
        root.rotation.z = Math.sin(th) * 0.036;
        root.rotation.x = 0;
        mesh.scale.setScalar(poseOf(pose).scale);
      } else if (state === 'sleep'){
        /* 눕히지 않는다. 식빵 자세 + 감은 눈이면 이미 자는 고양이고,
           옆으로 굴리면 발밑이 원점이라 바닥을 뚫거나 떠 있게 된다.
           숨만 아주 느리게 쉰다 — 그 느림이 자고 있다는 신호다. */
        root.position.y = api.baseY;
        root.rotation.z = 0;
        root.rotation.x = 0;
        mesh.scale.set(1, 1 + Math.sin(t * 0.7) * 0.018, 1).multiplyScalar(poseOf(pose).scale);
      } else {
        /* 숨 + 꼬리를 따라 몸이 아주 조금 실린다. 꼬리만 세 장면으로 툭툭 끊어 넘기면
           **꼬리만 따로 노는 물건**이 된다 — 몸이 같은 박자로 조금 기울면 그 세 장면이
           연속으로 읽힌다. 장면을 더 굽지 않고 위상 하나를 나눠 쓰는 것이다. */
        const s = Math.sin(tailT / tailP * Math.PI * 2);
        root.position.y = api.baseY;
        root.rotation.z = s * 0.016;
        root.rotation.x = Math.sin(t * 1.6) * 0.012;
        mesh.scale.set(1, 1 + Math.sin(t * 1.6) * 0.012, 1).multiplyScalar(poseOf(pose).scale);
      }
    },
  };
  api.setState('idle');
  return api;
}

/* ---------- 초상 ----------
   오른쪽 직원 목록이 도트인 채로 남으면 한 화면 안에서 두 그림체가 싸운다.
   털색마다 한 번씩만 구우면 되므로 20마리여도 굽는 건 색 가짓수만큼이다. */
let pr = null, ps = null, pc = null, pmesh = null, pmat = null, pgear = null;
const pCache = new Map();

export function sculptPortrait(furHex, size = 96, equip = null, opt = {}){
  /* opt.eyeMode  0 뜬 눈 · 1 웃는 눈 · 2 감은 눈(목록의 기본)
     opt.front    참이면 **정면**. 목록·기록증은 3/4 컷이 낫지만 로고는 정면이어야 한다 —
                  작게 줄이면 3/4 는 얼굴이 한쪽으로 쏠린 덩어리로 읽힌다.
     opt.pose     'stand'(기본) · 'sit' · 'loaf'. POSE 표에 이미 있는 것을 고르는 것이다.
                  **로딩 화면**이 이 손잡이를 열게 했다 — 앉아서 3/4 로 본 컷이 필요하다
                  (tools/bake-loading-cat.js). 기존 호출은 한 줄도 안 바뀐다. */
  const eyeMode = opt.eyeMode == null ? 2 : opt.eyeMode;
  const front = !!opt.front;
  const pose = POSE[opt.pose] ? opt.pose : 'stand';
  const ek = equip ? [equip.head, equip.neck, equip.paw].join('|') : '';
  const key = furHex + '@' + size + '@' + ek + '@' + eyeMode + (front ? '@f' : '') + '@' + pose;
  const hit = pCache.get(key);
  if (hit) return hit;

  if (!pr){
    try {
      /* eerie 는 가장자리가 각져야 한다. 화면 쪽은 저해상도로 그려서 자연히 각지는데
         초상만 안티에일리어싱이 걸려 있으면 그 매끈함이 오히려 더 튄다. */
      pr = new THREE.WebGLRenderer({ antialias: !EERIE.ON, alpha: true, preserveDrawingBuffer: true });
    } catch(e){ return null; }
    pr.setPixelRatio(1);
    ps = new THREE.Scene();
    /* 조명은 그림체를 따라간다. 흰 반구 1.25 + 흰 키 1.7 은 **스튜디오 조명**이고,
       그렇게 구운 그림은 안개 낀 사무실 UI 위에서 혼자 형광색으로 뜬다.
       eerie 에서는 스탠드(따뜻한 키) + 창(찬 필)로 바꿔 "그 방에서 찍은 사진" 으로 만든다. */
    if (EERIE.ON){
      const P = EERIE.PORTRAIT;
      ps.add(new THREE.HemisphereLight(P.hemi[0], P.hemi[1], P.hemi[2]));
      const key = new THREE.DirectionalLight(P.key[0], P.key[1]);
      key.position.set(...P.key[2]);
      const fill = new THREE.DirectionalLight(P.fill[0], P.fill[1]);
      fill.position.set(...P.fill[2]);
      ps.add(key, fill);
    } else {
      ps.add(new THREE.HemisphereLight(0xFFFFFF, 0xC6C3BF, 1.25));
      const sun = new THREE.DirectionalLight(0xFFFBF4, 1.7);
      sun.position.set(-2, 3.4, 3);
      ps.add(sun);
    }
    pc = new THREE.PerspectiveCamera(24, 1, 0.05, 20);

    const g = poseOf('stand');
    pmat = furMaterial({ fur: furHex });
    pmat.userData.setAnchor(g.anchor);
    pmesh = new THREE.Mesh(g.geometry, pmat);
    pmesh.scale.setScalar(g.scale);
    ps.add(pmesh);
  }

  /* 목록·기록증의 초상에도 걸친 것이 나와야 한다 — 화면의 고양이와 다르면 딴 고양이다 */
  if (pgear){ ps.remove(pgear); pgear = null; }
  if (equip && (equip.head || equip.neck || equip.paw)){
    const g = poseOf('stand');
    pgear = new THREE.Group();
    pgear.scale.setScalar(g.scale);
    pgear.add(GEAR.dress(equip, g.anchor));
    ps.add(pgear);
  }
  pmat.userData.set('fur', furHex);
  /* 목록에서는 **감은 눈**(2)이 기본이다. 웃는 눈(^ ^)은 놀고 있다는 뜻이라 근무 중인
     직원 목록에 줄지어 있으면 뜻이 어긋나고, 작게 줄이면 획 두 개가 눈썹처럼 보인다.
     감은 눈은 한 획이라 34px 에서도 안 뭉개진다.
     인자로 열어 둔 이유는 **로고**다 — 로고는 눈이 보여야 고양이로 읽힌다(tools/bake-logo.js). */
  pmat.userData.set('eyeMode', eyeMode);
  /* 자세를 갈아 끼운다. 지오메트리는 poseOf 가 캐시해 두고 전부가 나눠 쓰므로
     참조 하나 바꾸는 값이다(사무실의 고양이가 자세를 바꾸는 것과 같은 방식). */
  {
    const pg = poseOf(pose);
    if (pmesh.geometry !== pg.geometry){
      pmesh.geometry = pg.geometry;
      pmesh.scale.setScalar(pg.scale);
    }
    /* 앵커는 자세마다 다르다 — 머티리얼이 하나라서 **매번 다시 넣어야** 한다.
       안 넣으면 앉은 고양이에 서 있는 고양이의 얼굴 좌표가 찍힌다. */
    pmat.userData.setAnchor(pg.anchor);
  }
  /* eerie 는 화면과 같은 질감이어야 한다 — 낮은 해상도로 굽고 정수배로 늘린다.
     늘리는 것과 색 입히는 것은 eerie.bakePortrait 가 한다(식이 셰이더와 같아야 하므로
     그쪽 표에서 같이 읽는다). */
  const inner = EERIE.ON ? Math.max(24, Math.round(size / EERIE.PORTRAIT.px)) : size;
  pr.setSize(inner, inner, false);
  if (front){
    /* 정면. 완전히 눈높이로 맞추면 로우폴리 머리가 납작한 판으로 보이므로
       아주 조금만 위에서 본다 — 코와 턱의 면이 한 겹 남는다. */
    pc.position.set(0, H * 0.66, H * 2.52);
    pc.lookAt(0, H * 0.48, 0);
  } else {
    /* 얼굴이 주인공이라 살짝 위에서 앞으로 — 6면도의 3/4 컷과 같은 각이다 */
    pc.position.set(H * 1.10, H * 1.05, H * 2.70);
    pc.lookAt(0, H * 0.46, 0);
  }
  pc.updateProjectionMatrix();
  pr.render(ps, pc);

  let url = null;
  if (EERIE.ON) url = EERIE.bakePortrait(pr.domElement, size);
  /* 그림체가 파스텔이거나 2D 캔버스가 막힌 경우(구운 그림을 못 읽는 브라우저) 원본 그대로 */
  if (!url){ try { url = pr.domElement.toDataURL('image/png'); } catch(e){ url = null; } }
  if (url) pCache.set(key, url);
  return url;
}

/* 굽힌 것을 전부 센다. **곱셈이 일어났는지 여기서 잡힌다** — TODO 39 가
   "지오메트리 수가 몇 개 늘었는지"를 실측 항목으로 적어 둔 자리다.
   자세 3 + 걸음 8 + 꼬리 4 + 귀 2 = 17 이 지금의 상한이고, 마리가 늘어도 그대로다. */
export function stats(){
  return { ...budget, poses: shared.size,
           walk: walkGeoms.filter(Boolean).length, tail: tailGeoms.size, ear: earGeoms.size,
           geoms: shared.size + walkGeoms.filter(Boolean).length + tailGeoms.size + earGeoms.size };
}
