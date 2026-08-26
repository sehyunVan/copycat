/* ============================================================
   cat3.js — 데포르메 고양이.

   레퍼런스가 둘이고, 둘이 성격이 다르다.

   ① 로우폴리 프린트 피규어 — 네 발. 각진 구 머리가 몸통보다 크고 목이 없다.
   ② 치비 마스코트 그리드 — 두 발로 서고 2등신에 가깝다. 모자·목도리·망토를 입는다.

   ②가 copycat 에 더 맞을 가능성이 있다. 이 고양이들은 *직원*이고,
   게임에는 이미 장비 3슬롯(머리/목/발)이 있는데 지금은 능력치에만 반영되고
   겉모습에는 안 나온다 — README 가 "분명한 손실"이라고 적어둔 그 항목이다.
   두 발로 서면 그 슬롯이 그대로 보이는 자리가 된다.

   그래서 stance 로 둘 다 지원한다. 조형은 전부 params 가 정하고,
   얼굴 하나 더 만들어보는 비용은 객체 리터럴 한 줄이다.
   ============================================================ */

import * as THREE from 'three';
import * as LP from './lowpoly.js';
import { collapse } from './merge.js';

/* 기준 = 2등신 마스코트.
     · 머리가 전체 키의 절반
     · 귀는 크게 — 이 실루엣에서 "고양이"라고 말해주는 건 사실상 귀뿐이다
     · 주둥이 없음 — 빼면 얼굴이 평면이 되고, 평면이라야 이목구비가 읽힌다
     · 이목구비는 얼굴 아래쪽에 몰아둔다. 위로 올리면 어른 얼굴이 된다
     · 몸은 작게 — 머리를 받치는 받침에 가깝게 */
export const BASE = {
  fur: 0xE8A657,
  stance: 'quad',                    // quad 네 발 · biped 두 발
  crude: true,                       // 면을 줄인다. 각이 굵어지고 부품 수도 준다

  headR: 0.235,
  /* 가로로 넓고 앞뒤로 납작하게. 정구면은 얼굴이 아니라 공이고,
     앞뒤가 두꺼우면 정면에서 이목구비가 곡면을 타고 흘러내려 안 읽힌다. */
  headSx: 1.16, headSy: 0.90, headSz: 0.76,
  headFwd: 0.85,                     // 머리를 몸 앞으로. 네 발일 때 목 위치를 대신한다
  headDetail: 0,                     // 0 이면 20면(더 각짐) · 1 이면 80면
  cheek: 0,                          // 볼살
  brow: 0,                           // 이마를 눌러 넓적하게
  muzzle: 0, muzzleW: 0.54,          // 0 = 없음. 빼는 게 기본이다
  nose: 'dot', noseY: -0.42,         // dot | none
  mouth: 'none',                     // none | w | line
  eyes: 'bean',                      // bean | dot | wide | happy | closed | sleepy | slit | none
  /* 눈 간격은 넓은 쪽이 안전하다. 좁으면 시선이 한 점에 몰려서 노려보는 얼굴이 된다. */
  eyeGap: 0.44, eyeUp: -0.16, eyeR: 0.042,
  eyeColor: 0x3A3038,                // 순검정은 눈이 아니라 구멍으로 읽힌다
  shine: true,                       // 하이라이트 — 구멍을 눈으로 만드는 가장 싼 레버
  /* 표정을 상태에 묶는다. 노는 중엔 웃고, 일할 땐 뜨고, 잘 땐 감는다.
     도형 두 개 갈아끼우는 비용으로 화면이 게임 상태를 말해준다. */
  eyeByState: { idle:'happy', walk:'bean', sit:'bean', sleep:'closed' },
  ears: 'wedge',                     // wedge | wedgeBig | small | big | huge | max | round | fold | tuft | none
  earTilt: 0.30, earSpread: 0.56, earSink: 0.60, earInner: true, earScale: 1,

  /* 몸은 둥근 덩어리가 아니라 좁고 긴 기둥이다.
     머리가 이미 큰 구라서, 몸까지 둥글면 눈사람이 되고 고양이가 안 된다.
     얇게 세워야 큰 머리와 큰 귀가 더 커 보인다 — 대비로 버는 것이다. */
  bodyR: 0.145, bodySx: 0.98, bodySy: 1.02, bodySz: 1.22, hips: 0,
  neck: -0.04,                       // 음수면 머리가 몸에 파묻힌다 (목 없음)
  noseR: 0.75,                       // 코 크기 배율

  legR: 0.068, legH: 0.075, legSpread: 0.62, legZ: 0.60,   // k8 8번 — 다리를 짧고 뭉툭하게
  armR: 0.034, armH: 0.125, armDrop: 0.22,    // biped 전용

  tailR: 0.050, tailH: 0.14, tailUp: 1.15, tailCurl: -0.20, tailSeg: 2,
  merge: true,                       // 리그 묶음 단위로 합쳐 드로우콜을 줄인다
  gear: [],                          // beanie | cap | party | bow | scarf | collar | cape | headphone
  gearColor: 0xA8B8E0,
  scale: 1,
};

const POSE = {
  idle:  { bodyY:0.00, pitch: 0.00, head: 0.00, swing:0.00, tuck:0.00, tail:0.00, ear:0.00 },
  walk:  { bodyY:0.00, pitch: 0.00, head:-0.05, swing:0.55, tuck:0.00, tail:-0.18, ear:0.00 },
  sit:   { bodyY:-0.045, pitch:-0.26, head: 0.04, swing:0.00, tuck:1.15, tail: 0.55, ear:0.08 },
  sleep: { bodyY:-0.10, pitch: 0.05, head: 0.50, swing:0.00, tuck:1.50, tail: 0.95, ear:-0.30 },
};

const mix = (c, k) => new THREE.Color(c)
  .lerp(new THREE.Color(k > 0 ? 0x000000 : 0xffffff), Math.abs(k)).getHex();

/* 다리 · 주둥이 · 꼬리 끝은 몸색에서 살짝만 벗어난다. 대비를 세게 주면
   파스텔에서 부위마다 따로 노는 조각처럼 보인다. */
const LIGHT = -0.10, DARK = 0.11;

export function cat3(params = {}){
  const P = { ...BASE, ...params };
  /* 가구는 smooth, 캐릭터는 flat 이다. 전역 KIT 하나를 두 용도가 나눠 쓰므로
     이 함수가 도는 동안만 바꿔 끼우고 끝나면 되돌린다. */
  const prevShading = LP.KIT.shading;
  LP.setShading(P.shading ?? 'flat');
  const biped = P.stance === 'biped';
  const fur = P.fur, furD = mix(fur, DARK), furL = mix(fur, LIGHT);
  const INK = 0x39332E;
  const root = new THREE.Group();

  /* 조잡하게 = 면을 줄이고 부품을 줄인다. 미학만의 문제가 아니다 —
     고양이 한 마리가 드로우콜 40개를 쓰는데 사무실에 20마리가 들어간다.
     부품 수를 줄이는 게 곧 예산을 줄이는 것이다. */
  const ICO = P.crude ? 0 : 1;
  const CSEG = P.crude ? 4 : 6;
  const SSEG = P.crude ? 5 : 6;

  /* ---------- 몸통 ---------- */
  const hipY = P.legH;
  const bodyR = P.bodyR;
  const bSy = biped ? P.bodySy * 1.30 : P.bodySy;
  const bSz = biped ? P.bodySz * 0.78 : P.bodySz;
  const bodyY = hipY + bodyR * bSy;
  const body = new THREE.Group();
  body.add(LP.ellip(bodyR * 2 * P.bodySx, bodyR * 2 * bSy, bodyR * 2 * bSz, fur, ICO));
  /* 아래를 넓히면 캡슐이 아니라 몸이 된다. 위아래가 같은 굵기면 볼링핀으로 보인다. */
  if (P.hips > 0){
    const h = LP.ellip(bodyR * 2 * P.bodySx * (1 + P.hips), bodyR * 2 * bSy * 0.62,
                       bodyR * 2 * bSz * (1 + P.hips * 0.8), fur, ICO);
    h.position.y = -bodyR * bSy * 0.44;
    body.add(h);
  }
  body.position.y = bodyY;
  root.add(body);

  /* ---------- 머리 ----------
     목이 없다. 머리를 몸에 얹는 게 아니라 살짝 파묻는다 — 데포르메의 핵심이 여기다. */
  const headY = bodyY + bodyR * bSy + P.headR * P.headSy + P.neck;
  const headZ = biped ? 0 : bodyR * bSz * P.headFwd;
  const head = new THREE.Group();
  head.position.set(0, headY, headZ);
  root.add(head);

  head.add(LP.ellip(
    P.headR * 2 * P.headSx,
    P.headR * 2 * P.headSy * (1 - P.brow * 0.22),
    P.headR * 2 * P.headSz, fur, P.headDetail));

  if (P.cheek > 0){
    const cw = P.headR * P.cheek;
    [-1, 1].forEach(s => {
      const c = LP.ellip(cw * 1.5, cw * 1.2, cw * 1.4, fur, 0);
      c.position.set(s * P.headR * P.headSx * 0.82, -P.headR * 0.22, P.headR * 0.20);
      head.add(c);
    });
  }

  if (P.muzzle > 0){
    const mz = LP.ellip(P.headR * 2 * P.muzzleW, P.headR * 2 * P.muzzleW * 0.66,
                        P.headR * 2 * P.muzzle * 0.9, furL, 0);
    mz.position.set(0, -P.headR * 0.30, P.headR * P.headSz * 0.86);
    head.add(mz);
  }
  /* 이목구비를 아래로 내리면 구의 앞면도 그만큼 뒤로 물러난다.
     z 를 고정해 두면 눈코가 얼굴 속으로 파묻히므로 높이에 맞춰 표면을 따라간다. */
  const surfZ = (yRel, k = 0.94) =>
    P.headR * P.headSz * Math.sqrt(Math.max(0.12, 1 - yRel * yRel)) * k + P.headR * P.muzzle * 0.9;

  if (P.nose === 'dot'){
    const k = P.noseR;
    const n = LP.ellip(0.050 * k, 0.036 * k, 0.034 * k, 0xE59BA8, 0);
    n.position.set(0, P.noseY * P.headR, surfZ(P.noseY / P.headSy, 0.99));
    head.add(n);
  }
  if (P.mouth !== 'none'){
    const w = P.mouth === 'w' ? 0.055 : 0.075;
    const my = (P.noseY - 0.16);
    [-1, 1].forEach(s => {
      const m = LP.ellip(w, 0.016, 0.02, INK, 0);
      m.position.set(s * w * 0.55, my * P.headR, surfZ(my / P.headSy, 0.99));
      m.rotation.z = P.mouth === 'w' ? -s * 0.5 : 0;
      head.add(m);
    });
  }

  /* ---------- 눈 ----------
     큰 눈이 무서워지는 건 크기 때문이 아니다. 새까만 구가 얼굴 밖으로 튀어나오고,
     하이라이트도 눈꺼풀도 없이 완벽한 원 두 개가 대칭으로 박혀 있기 때문이다.
     인형 눈이 무서운 조건과 똑같다. 그래서 셋을 지킨다:
       · 납작하게 — 구가 아니라 얼굴에 붙은 판. 튀어나오면 벌레눈이 된다
       · 하이라이트 — 이거 하나로 "구멍"이 "눈"이 된다. 가장 싼 레버다
       · 순검정 금지 — 따뜻한 먹빛으로. 순검정은 구멍으로 읽힌다 */
  const eyeY = P.eyeUp * P.headR;
  const eyeZ = surfZ(P.eyeUp / P.headSy, 0.93);
  const eyeX = P.headR * P.headSx * P.eyeGap;
  const EC = P.eyeColor;
  const R = P.eyeR;

  const shine = (g, s, k = 1) => {
    if (!P.shine) return;
    const h = LP.ellip(R * 0.60 * k, R * 0.70 * k, R * 0.30, 0xFFFDF8, 0);
    h.position.set(-s * R * 0.42 * k, R * 0.62 * k, R * 0.30);
    g.add(h);
  };

  /* 표정은 한 벌만 그리는 게 아니라 여러 벌을 만들어 두고 보이는 것만 바꾼다.
     안 보이는 건 드로우콜을 안 쓰므로 예산은 그대로고, 상태 전환은 공짜가 된다. */
  function buildEyeSet(type){
    const set = [];
    if (!type || type === 'none') return set;
    [-1, 1].forEach(s => {
      const g = new THREE.Group();
      if (type === 'closed' || type === 'happy'){
        // ^ ^ — 안전패다. 표정이 있는 쪽이 늘 덜 무섭다
        [-1, 1].forEach(d => {
          const a = LP.ellip(R * 1.5, R * 0.42, R * 0.35, EC, 0);
          a.position.set(d * R * 0.62, -R * 0.30, 0);
          a.rotation.z = (type === 'happy' ? -d : d) * 0.62;
          g.add(a);
        });
      } else if (type === 'sleepy'){
        g.add(LP.ellip(R * 2.0, R * 2.2, R * 0.7, EC, ICO));
        shine(g, s, 0.8);
        const lid = LP.ellip(R * 2.3, R * 1.5, R * 0.9, fur, 0);
        lid.position.set(0, R * 1.5, R * 0.05);
        g.add(lid);
      } else if (type === 'slit'){
        g.add(LP.ellip(R * 0.8, R * 2.2, R * 0.6, EC, 0));
      } else if (type === 'wide'){
        g.add(LP.ellip(R * 2.4, R * 2.6, R * 0.7, 0xFFFDF8, ICO));
        const pu = LP.ellip(R * 1.3, R * 1.7, R * 0.6, EC, ICO);
        pu.position.z = R * 0.25;
        g.add(pu);
        shine(g, s, 0.7);
      } else if (type === 'dot'){
        g.add(LP.ellip(R * 1.2, R * 1.4, R * 0.6, EC, 0));
        shine(g, s, 0.55);
      } else {                                   // bean — 기본. 세로로 살짝 긴 납작한 콩
        g.add(LP.ellip(R * 1.8, R * 2.3, R * 0.7, EC, ICO));
        shine(g, s);
      }
      g.position.set(s * eyeX, eyeY, eyeZ);
      g.rotation.y = -s * 0.18;                  // 둥근 얼굴을 따라 살짝 바깥을 보게
      g.userData.keep = true;                    // 머리와 함께 합쳐지면 표정을 못 바꾼다
      head.add(g);
      set.push(g);
    });
    return set;
  }

  const eyeSets = {};
  new Set([P.eyes, ...Object.values(P.eyeByState || {})])
    .forEach(t => { eyeSets[t] = buildEyeSet(t); });
  const showEyes = type => {
    const t = eyeSets[type] ? type : P.eyes;
    for (const k in eyeSets) eyeSets[k].forEach(g => { g.visible = (k === t); });
  };
  // 처음 상태(idle)의 표정을 여기서 한 번 걸어준다.
  // setState 는 상태가 '바뀔 때만' 도는데 초기 상태가 이미 idle 이라 안 걸린다.
  showEyes((P.eyeByState && P.eyeByState.idle) || P.eyes);

  /* ---------- 귀 ---------- */
  const ears = [];
  if (P.ears !== 'none') [-1, 1].forEach(s => {
    const g = new THREE.Group();
    const r = P.headR * P.earScale;
    const inner = (w, h, z) => {
      if (!P.earInner) return;
      const i = LP.cone(w, h, 0xE9B6BC, CSEG);
      i.position.set(0, -r * 0.10, z);
      g.add(i);
    };
    /* 지느러미형 귀 — 원뿔을 앞뒤로 납작하게 눌러 삼각 판으로 만든다.
       원뿔 그대로 두면 공에 꽂힌 뿔이 되고, 납작하게 눌러 머리에 파묻으면
       머리 실루엣에서 자라난 것처럼 읽힌다. 이게 "붙여놓은 것" 과 "달린 것" 의 차이다. */
    if (P.ears === 'wedge' || P.ears === 'wedgeBig'){
      const big = P.ears === 'wedgeBig';
      const e = LP.cone(r * (big ? 0.86 : 0.70), r * (big ? 1.70 : 1.30), furD, SSEG);
      e.scale.z = 0.34;
      g.add(e);
      if (P.earInner){
        const i = LP.cone(r * (big ? 0.52 : 0.42), r * (big ? 1.10 : 0.84), 0xE9B6BC, 6);
        i.scale.z = 0.30;
        i.position.set(0, -r * 0.12, r * 0.06);
        g.add(i);
      }
    } else if (P.ears === 'round'){
      g.add(LP.ellip(r * 0.80, r * 0.80, r * 0.34, furD, 0));
    } else if (P.ears === 'fold'){
      const e = LP.cone(r * 0.50, r * 0.62, furD, CSEG);
      e.rotation.x = 1.5;
      g.add(e);
    } else if (P.ears === 'huge'){
      g.add(LP.cone(r * 0.74, r * 1.80, furD, CSEG));
      inner(r * 0.44, r * 1.14, r * 0.13);
    } else if (P.ears === 'max'){
      g.add(LP.cone(r * 0.92, r * 2.35, furD, CSEG));
      inner(r * 0.56, r * 1.52, r * 0.15);
    } else if (P.ears === 'tuft'){
      g.add(LP.cone(r * 0.46, r * 1.10, furD, CSEG));
      const t = LP.cone(r * 0.14, r * 0.40, furL, CSEG);
      t.position.y = r * 0.72;
      g.add(t);
    } else if (P.ears === 'small'){
      g.add(LP.cone(r * 0.42, r * 0.72, furD, CSEG));
      inner(r * 0.24, r * 0.42, r * 0.10);
    } else {                                   // big — 기본
      g.add(LP.cone(r * 0.56, r * 1.24, furD, CSEG));
      inner(r * 0.33, r * 0.78, r * 0.11);
    }
    /* 귀 밑동을 머리 안으로 넣는다. 표면에 얹으면 접합선이 보이고 따로 논다. */
    g.position.set(s * P.headR * P.headSx * P.earSpread,
                   P.headR * P.headSy * (P.earSink ?? 0.60),
                   -P.headR * 0.04);
    g.rotation.z = -s * P.earTilt;
    head.add(g);
    ears.push(g);
  });

  /* ---------- 다리 · 팔 ---------- */
  const legs = [], arms = [];
  if (biped){
    for (const sx of [-1, 1]){
      const hip = new THREE.Group();
      hip.position.set(sx * bodyR * P.bodySx * 0.44, hipY, 0);
      const l = LP.stub(P.legR * 1.05, P.legR * 1.15, P.legH, furD, SSEG);
      l.position.y = -P.legH / 2;
      hip.add(l);
      const foot = LP.ellip(P.legR * 2.4, P.legR * 1.5, P.legR * 3.2, furD, 0);
      foot.position.set(0, -P.legH + P.legR * 0.5, P.legR * 0.6);
      hip.add(foot);
      root.add(hip);
      legs.push(hip);
    }
    // 팔 — 두 발로 서면 장비 슬롯이 보이는 자리가 여기서 생긴다
    for (const sx of [-1, 1]){
      const sh = new THREE.Group();
      sh.position.set(sx * bodyR * P.bodySx * 0.94, bodyY + bodyR * bSy * 0.25, 0);
      const a = LP.stub(P.armR * 0.85, P.armR, P.armH, furD, SSEG);
      a.position.y = -P.armH / 2;
      sh.add(a);
      const paw = LP.ellip(P.armR * 2.2, P.armR * 2.0, P.armR * 2.0, furD, 0);
      paw.position.y = -P.armH;
      sh.add(paw);
      sh.rotation.z = sx * P.armDrop;
      root.add(sh);
      arms.push(sh);
    }
  } else {
    const lx = bodyR * P.bodySx * P.legSpread, lz = bodyR * bSz * P.legZ;
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]){
      const hip = new THREE.Group();
      hip.position.set(sx * lx, hipY, sz * lz);
      const l = LP.stub(P.legR, P.legR * 1.12, P.legH, furD, SSEG);
      l.position.y = -P.legH / 2;
      hip.add(l);
      root.add(hip);
      legs.push(hip);
    }
  }

  /* ---------- 꼬리 ---------- */
  const tailSegs = [];
  const tailBaseY = bodyY + bodyR * bSy * (biped ? -0.35 : 0.2);
  let parent = root;
  for (let i = 0; i < P.tailSeg; i++){
    const g = new THREE.Group();
    const k = 1 - i * 0.16;
    if (i === 0) g.position.set(0, tailBaseY, -bodyR * bSz * 0.92);
    else g.position.set(0, P.tailH * (1 - (i - 1) * 0.16), 0);
    const s = LP.stub(P.tailR * (k - 0.12), P.tailR * k, P.tailH * k,
                      i === P.tailSeg - 1 ? furL : furD, SSEG);
    s.position.y = P.tailH * k / 2;
    g.add(s);
    parent.add(g);
    parent = g;
    tailSegs.push(g);
  }

  /* ---------- 장비 ----------
     지금 게임에서 장비는 능력치에만 붙고 겉모습에는 안 나온다. 여기선 붙는다. */
  const GC = P.gearColor;
  const gearFns = {
    beanie(){
      const g = LP.group(
        LP.ellip(P.headR * 2.10, P.headR * 1.30, P.headR * 2.05, GC, 1),
        LP.ellip(P.headR * 2.16, P.headR * 0.34, P.headR * 2.12, mix(GC, 0.15), 0),
      );
      g.children[1].position.y = -P.headR * 0.42;
      const pom = LP.ellip(P.headR * 0.46, P.headR * 0.46, P.headR * 0.46, mix(GC, -0.3), 0);
      pom.position.y = P.headR * 0.72;
      g.add(pom);
      g.position.y = P.headR * P.headSy * 0.60;
      return g;
    },
    cap(){
      const g = LP.group(LP.ellip(P.headR * 2.06, P.headR * 1.20, P.headR * 2.02, GC, 1));
      /* 챙은 눈보다 확실히 위에 둔다. 조금만 내려도 정면에서 눈을 덮어
         표정이 통째로 사라진다 — 32px 로 보일 캐릭터에서는 치명적이다. */
      const brim = LP.ellip(P.headR * 1.34, P.headR * 0.16, P.headR * 1.12, mix(GC, 0.18), 0);
      brim.position.set(0, -P.headR * 0.20, P.headR * 1.02);
      g.add(brim);
      g.position.y = P.headR * P.headSy * 0.70;
      return g;
    },
    party(){
      const g = LP.group(LP.cone(P.headR * 0.72, P.headR * 1.60, GC, 6));
      const pom = LP.ellip(P.headR * 0.34, P.headR * 0.34, P.headR * 0.34, mix(GC, -0.3), 0);
      pom.position.y = P.headR * 0.86;
      g.add(pom);
      g.position.y = P.headR * P.headSy * 1.20;
      g.rotation.z = -0.12;
      return g;
    },
    bow(){
      const g = new THREE.Group();
      [-1, 1].forEach(s => {
        const w = LP.ellip(P.headR * 0.56, P.headR * 0.40, P.headR * 0.22, GC, 0);
        w.position.x = s * P.headR * 0.36;
        w.rotation.z = s * 0.4;
        g.add(w);
      });
      g.add(LP.ellip(P.headR * 0.22, P.headR * 0.22, P.headR * 0.24, mix(GC, 0.2), 0));
      g.position.set(P.headR * 0.72, P.headR * P.headSy * 0.72, P.headR * 0.20);
      return g;
    },
    headphone(){
      const g = new THREE.Group();
      const band = LP.ellip(P.headR * 2.20, P.headR * 2.10, P.headR * 0.30, mix(GC, 0.25), 1);
      band.position.y = P.headR * 0.10;
      g.add(band);
      [-1, 1].forEach(s => {
        const cup = LP.ellip(P.headR * 0.46, P.headR * 0.70, P.headR * 0.62, GC, 0);
        cup.position.set(s * P.headR * 1.02, -P.headR * 0.10, 0);
        g.add(cup);
      });
      return g;
    },
    scarf(){
      const g = LP.group(
        LP.ellip(bodyR * 1.75, bodyR * 0.55, bodyR * 1.60, GC, 1),
        LP.ellip(bodyR * 0.60, bodyR * 1.30, bodyR * 0.45, GC, 0),
      );
      g.children[1].position.set(bodyR * 0.42, -bodyR * 0.80, bodyR * 0.72);
      g.children[1].rotation.z = 0.18;
      g.position.y = bodyY + bodyR * bSy * 0.86;
      return g;
    },
    collar(){
      const g = LP.group(LP.ellip(bodyR * 1.62, bodyR * 0.34, bodyR * 1.50, GC, 1));
      const bell = LP.ellip(bodyR * 0.36, bodyR * 0.36, bodyR * 0.36, 0xF3D08A, 0);
      bell.position.set(0, -bodyR * 0.20, bodyR * 0.78);
      g.add(bell);
      g.position.y = bodyY + bodyR * bSy * 0.88;
      return g;
    },
    cape(){
      const g = LP.group(LP.ellip(bodyR * 2.30, bodyR * 2.60, bodyR * 0.30, GC, 0));
      g.position.set(0, bodyY + bodyR * bSy * 0.10, -bodyR * bSz * 1.05);
      g.rotation.x = -0.12;
      return g;
    },
  };
  const gearParts = [];
  (P.gear || []).forEach(name => {
    const fn = gearFns[name];
    if (!fn) return;
    const g = fn();
    const onHead = ['beanie','cap','party','bow','headphone'].includes(name);
    (onHead ? head : root).add(g);
    gearParts.push(g);
  });

  /* ---------- 구동 ---------- */
  const cur = { ...POSE.idle };
  let target = POSE.idle, state = 'idle', t = 0;
  const phase = ((fur * 7919) % 1000) / 1000 * 100;

  const api = {
    root, params: P, state,
    setState(s){
      if (!POSE[s] || s === state) return;
      state = api.state = s;
      target = POSE[s];
      showEyes((P.eyeByState && P.eyeByState[s]) || P.eyes);
    },
    update(dt){
      t += dt;
      const k = Math.min(1, dt * 7);
      for (const key in cur) cur[key] += (target[key] - cur[key]) * k;

      const breathe = Math.sin((t + phase) * (state === 'sleep' ? 1.1 : 2.3)) * (state === 'sleep' ? 0.010 : 0.005);
      body.position.y = bodyY + cur.bodyY + breathe;
      body.rotation.x = cur.pitch;
      head.position.y = headY + cur.bodyY * 1.25 + breathe;
      head.position.z = headZ - cur.pitch * 0.09;
      head.rotation.x = cur.head + cur.pitch * 0.45;

      const gait = Math.sin((t + phase) * 8.5);
      legs.forEach((hip, i) => {
        const dir = biped ? (i ? -1 : 1) : ((i === 0 || i === 3) ? 1 : -1);
        hip.rotation.x = gait * cur.swing * dir - cur.tuck * (biped ? 0.55 : 0.85);
        hip.position.y = hipY + cur.bodyY - cur.tuck * 0.05;
      });
      arms.forEach((sh, i) => {
        const s = i ? 1 : -1;
        sh.rotation.z = s * P.armDrop;
        sh.rotation.x = -gait * cur.swing * s * 0.8;
        sh.position.y = bodyY + bodyR * bSy * 0.25 + cur.bodyY + breathe;
      });

      const sway = Math.sin((t + phase) * (state === 'walk' ? 4.5 : 1.5));
      tailSegs.forEach((g, i) => {
        if (i === 0){
          g.position.y = tailBaseY + cur.bodyY;
          g.rotation.x = -P.tailUp + cur.tail;
          g.rotation.z = sway * 0.10;
        } else {
          g.rotation.x = P.tailCurl + cur.tail * 0.35;
          g.rotation.z = sway * 0.07;
        }
      });

      ears.forEach((g, i) => {
        const s = i ? 1 : -1;
        g.rotation.z = -s * P.earTilt;
        g.rotation.x = cur.ear + (Math.sin((t + phase) * 0.7) > 0.985 ? 0.35 : 0);
      });
    },
  };
  void gearParts;
  /* 드로우콜 줄이기. 따로 움직이는 묶음(머리 · 몸 · 다리 넷 · 꼬리 마디 · 눈 한 벌)
     안에서만 합친다. 귀 씰룩임은 여기서 포기했다 — 귀를 머리에 구워 넣는 대신
     머리 하나가 드로우콜 하나가 된다. 20마리 규모에서는 그 거래가 맞다. */
  if (P.merge){
    tailSegs.forEach((g, i) => { if (i > 0) g.userData.keep = true; });
    collapse(body);
    collapse(head);
    legs.forEach(l => collapse(l));
    tailSegs.forEach(t => collapse(t));
    for (const k in eyeSets){
      const set = eyeSets[k];
      if (!set.length) continue;
      set.forEach(g => { g.userData.keep = false; });
      const holder = new THREE.Group();
      head.add(holder);
      set.forEach(g => holder.add(g));
      collapse(holder);
      holder.userData.keep = true;
      eyeSets[k] = [holder];
    }
    showEyes((P.eyeByState && P.eyeByState.idle) || P.eyes);
  }

  root.scale.setScalar(P.scale);
  LP.setShading(prevShading);
  return api;
}
