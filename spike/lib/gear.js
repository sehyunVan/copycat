/* ============================================================
   gear.js — 고양이가 실제로 **쓰고 두르고 신는다.**

   게임에는 장비 3슬롯(머리·목·발)과 아이템 9개가 이미 있다. 그런데 README 에
   "능력치에만 반영되고 겉모습은 안 바뀐다 — 분명한 손실" 이라고 적혀 있었다.
   도트 시트로는 합성이 안 됐기 때문이다: 방향 4종 × 상태 5종 × 아이템 9개를
   손으로 그릴 수는 없다.

   조형으로 오면서 그 벽이 사라졌다. **머리가 어디 있는지 숫자로 알기 때문이다** —
   sculpt.js 가 자세마다 정수리·얼굴·목·가슴·발·엉덩이 좌표를 같이 내놓는다.
   모자는 정수리에 얹고, 넥타이는 목에 걸고, 신발은 발 넷에 신긴다. 그게 전부다.

   ── 치수의 기준 ──
   기준형 머리는 반지름 (0.33, 0.25, 0.22) 이고 발은 반지름 0.081 이다.
   여기 숫자는 전부 그 값을 재서 넣은 것이다. 눈대중으로 넣었더니 모자가 머리의 절반이 됐다 —
   lowpoly.ellip 은 반지름이 아니라 **지름**을 받는다(box 와 같은 규약). 한 번 걸리고 나서
   전부 다시 쟀다.

   ── 규약 ──
   · 각 함수는 **원점이 그 부위**인 그룹을 돌려준다. +z 를 보고 있고, y 는 위다
   · 그러면 붙이는 쪽이 좌표만 넣으면 되고, 자세가 바뀌면 좌표만 다시 넣는다
   · 색은 팔레트에서 가져온다 — 사무실과 같은 색이라야 얹힌 게 아니라 입은 것으로 읽힌다
   ============================================================ */

import * as THREE from 'three';
import { PAL, box, ellip, cone, stub, mat } from './lowpoly.js';

/* 원판 — 챙·테·목걸이 밴드가 전부 이걸로 나온다. 기둥을 눕히면 원판이다. */
function disc(r, d, color, seg = 12){
  const m = stub(r, r, d, color, seg);
  m.rotation.x = Math.PI / 2;
  return m;
}
/* 위아래가 다른 원통 — 모자 몸통·목도리 */
function drum(rTop, rBot, h, color, seg = 12){
  return stub(rTop, rBot, h, color, seg);
}
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/* ============================================================
   머리 — 원점은 anchor.crown (정수리) · anchor.face (얼굴 앞)
   ============================================================ */

/* 뿔테 안경은 뺐다. 이 얼굴은 눈이 점 두 개뿐이라 테를 씌우면 그 점을 가려 버린다 —
   안경을 쓴 게 아니라 눈이 사라진 그림이 됐다. 만들어서 붙여 보고 나서야 알았다.
   아이템 자체는 게임에 그대로 있고(능력치 +2), 겉모습만 안 바뀐다.
   대체 물건은 나중에 — 이 얼굴에 얹혀도 눈을 안 가리는 것이라야 한다. */

/* 사원 모자 — 야구모자. 귀는 뚫고 나온다(고양이 모자는 원래 그렇다) */
export function cap(color = 0x6C7FB8){
  const g = new THREE.Group();
  const dome = ellip(0.66, 0.46, 0.62, color, 1);
  g.add(at(dome, 0, 0.055, -0.010));
  g.add(at(disc(0.315, 0.055, color, 14), 0, 0.010, -0.010));   // 밑단
  const brim = box(0.46, 0.046, 0.30, color, 0, 0.040, 0.290);
  brim.rotation.x = -0.15;
  g.add(brim);
  g.add(box(0.075, 0.075, 0.075, PAL.woodDark, 0, 0.180, -0.010));  // 꼭지 단추
  g.add(box(0.170, 0.090, 0.030, PAL.paper, 0, 0.095, 0.235));      // 앞 로고 자리
  return g;
}

/* 경찰 정모 — 사원 모자와 실루엣이 달라야 한다. 위가 평평하고 챙이 크고 검다.
   copycat 의 경찰냥은 이 회사를 잡으러 오는 쪽이라, 한눈에 갈려야 농담이 선다. */
export function policeCap(){
  const navy = 0x3E4870, dark = 0x252A44;
  const g = new THREE.Group();
  g.add(at(drum(0.330, 0.272, 0.170, navy, 16), 0, 0.130, -0.010));   // 위가 넓은 통
  g.add(at(disc(0.345, 0.048, navy, 16), 0, 0.215, -0.010));          // 평평한 윗판
  g.add(at(drum(0.268, 0.268, 0.085, dark, 16), 0, 0.038, -0.010));   // 검은 띠
  const brim = box(0.58, 0.048, 0.34, dark, 0, 0.020, 0.300);
  brim.rotation.x = -0.19;
  g.add(brim);
  /* 배지 — 이 모자에서 제일 중요한 한 조각. 없으면 그냥 남색 모자다 */
  const badge = box(0.135, 0.150, 0.032, PAL.glow, 0, 0.115, 0.268);
  badge.rotation.z = Math.PI / 4;
  g.add(badge);
  g.add(box(0.058, 0.058, 0.024, dark, 0, 0.115, 0.292));
  return g;
}

/* 대표 왕관 — 뿔 다섯 개. 크게 만들면 우스워지고, 작으면 머리띠가 된다 */
export function crown(){
  const g = new THREE.Group();
  g.add(at(drum(0.290, 0.310, 0.090, PAL.glow, 14), 0, 0.045, -0.010));
  for (let i = 0; i < 5; i++){
    const a = i / 5 * Math.PI * 2 + 0.3;
    g.add(at(cone(0.085, 0.185, PAL.glow, 4),
             Math.sin(a) * 0.255, 0.180, Math.cos(a) * 0.255 - 0.010));
    const jew = box(0.058, 0.058, 0.030, 0xC0392B,
                    Math.sin(a) * 0.290, 0.068, Math.cos(a) * 0.290 - 0.010);
    jew.rotation.y = a;
    g.add(jew);
  }
  return g;
}

/* ============================================================
   목 — 원점은 anchor.neck. 그 자리의 몸 굵기가 반지름 0.20 쯤 된다
   ============================================================ */

/* 실크 넥타이 — 매듭과 날. 회사원 고양이의 농담이 여기서 제일 세다 */
export function tie(color = 0xB6455A){
  const g = new THREE.Group();
  /* 깃은 뺐다. 흰 띠를 둘러 봤는데 목이 없는 고양이라 **띠가 목이 아니라 턱을 감았다** —
     넥타이 매고 있는 게 아니라 붕대 감은 그림이 된다. 넥타이만 남기는 쪽이 낫다. */
  const knot = box(0.120, 0.115, 0.080, color, 0, 0.010, 0.098);
  knot.rotation.x = 0.16;
  g.add(knot);
  /* 날은 **가슴에 붙어서** 내려간다. 앞으로 띄우면 목에 널빤지가 매달린 그림이 된다 */
  const blade = box(0.140, 0.245, 0.055, color, 0, -0.155, 0.108);
  blade.rotation.x = -0.10;
  g.add(blade);
  const tip = box(0.140, 0.075, 0.055, color, 0, -0.276, 0.088);
  tip.rotation.x = 0.36;
  g.add(tip);
  return g;
}

/* 황금 방울 — 목걸이 띠 + 방울. 고양이 하면 이것이다 */
export function bell(){
  /* 목걸이 띠도 뺐다. 넥타이와 같은 이유다 — 이 목에 두르면 목이 아니라 턱을 감는다.
     방울만 남긴다. 목에 방울 하나가 달려 있는 그림이 오히려 고양이답다. */
  const g = new THREE.Group();
  g.add(at(ellip(0.170, 0.170, 0.170, PAL.glow, 1), 0, -0.070, 0.115));
  g.add(box(0.098, 0.024, 0.028, 0x8A6A20, 0, -0.094, 0.188));   // 방울 틈
  g.add(box(0.042, 0.055, 0.042, 0x8A6A20, 0, 0.006, 0.104));    // 고리
  return g;
}

/* 목도리 — **목을 빙 둘러야 한다.**

   두 번 틀렸다.
   ① 원통 하나를 목에 끼웠더니 위쪽이 턱에 먹혀서 앞면만 남았다 — 두른 게 아니라
      가슴에 띠를 붙인 그림.
   ② 박스 열둘로 링을 짰더니 뒤에서 봤을 때 **조각조각 끊겨** 목걸이 구슬이 됐다.

   그래서 닫힌 곡선을 따라 **관 하나**를 뽑는다. 이음매가 없으니 한 줄로 넘어가고,
   단면을 6각으로 두면 로우폴리 결도 그대로다. 곡선은 앞이 낮고 뒤로 갈수록 올라간다 —
   앞뒤가 같은 높이면 어깨에 얹은 도넛이지, 목을 감아 올라간 것이 아니다.
   원점은 anchor.collar — 머리 아래, 몸통 앞 끝이다. */
let _scarfGeo = null;
function scarfRing(){
  if (_scarfGeo) return _scarfGeo;
  const R = 0.252, N = 16, pts = [];
  for (let i = 0; i < N; i++){
    const a = i / N * Math.PI * 2;
    const sz = Math.cos(a);
    pts.push(new THREE.Vector3(Math.sin(a) * R, 0.062 * (1 - sz), sz * R));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  _scarfGeo = new THREE.TubeGeometry(curve, 26, 0.090, 6, true);
  return _scarfGeo;
}

export function scarf(color = 0xC2705F){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(scarfRing(), mat(color));
  ring.castShadow = true; ring.receiveShadow = true;
  g.add(ring);
  /* 앞에서 겹치는 매듭 — 여기서 끝이 흘러내린다. 겹치는 자리가 있어야 감은 것이 된다 */
  const knot = box(0.200, 0.170, 0.150, color, 0.048, -0.020, 0.238);
  knot.rotation.y = -0.26;
  g.add(knot);
  const end = box(0.155, 0.330, 0.090, color, 0.140, -0.215, 0.208);
  end.rotation.set(0.10, 0, 0.20);
  g.add(end);
  g.add(box(0.155, 0.062, 0.090, PAL.wallTrim, 0.176, -0.375, 0.192));   // 술
  return g;
}

/* ============================================================
   발 — anchor.paws 넷을 받는다. 발 반지름은 0.081.
   접힌 뒷다리에는 안 신긴다 — 몸 안에 신발이 박힌다
   ============================================================ */

export function shoe(color = 0xE0605C){
  const g = new THREE.Group();
  g.add(box(0.205, 0.062, 0.265, PAL.paper, 0, 0.031, 0.020));     // 밑창
  g.add(box(0.185, 0.105, 0.225, color, 0, 0.112, 0.012));         // 갑피
  g.add(box(0.192, 0.030, 0.095, PAL.paper, 0, 0.108, 0.098));     // 흰 줄
  g.add(box(0.140, 0.048, 0.058, PAL.paper, 0, 0.168, -0.058));    // 발목
  return g;
}
export function guard(color = 0x5C6BA8){
  const g = new THREE.Group();
  g.add(at(drum(0.112, 0.120, 0.130, color, 12), 0, 0.150, 0));
  g.add(at(drum(0.126, 0.126, 0.034, PAL.wallTrim, 12), 0, 0.222, 0));
  return g;
}
/* 인체공학 방석 — 신는 게 아니라 깔고 앉는다. 원점은 anchor.hip */
export function cushion(color = 0x8E7BC0){
  const g = new THREE.Group();
  g.add(box(0.60, 0.085, 0.54, color, 0, 0.043, 0));
  g.add(box(0.52, 0.052, 0.46, PAL.wallTrim, 0, 0.094, 0));
  for (const sx of [1, -1])
    g.add(box(0.052, 0.062, 0.46, color, sx * 0.278, 0.080, 0));   // 옆 볼록
  g.add(box(0.115, 0.032, 0.115, PAL.metalDark, 0, 0.114, -0.19)); // 단추
  return g;
}

/* ============================================================
   붙이기 — 아이템 id 는 cats.js 의 것을 그대로 쓴다
   ============================================================ */
export const SLOT_OF = {
  cap:'head', crown:'head', police:'head',
  tie:'neck', bell:'neck', scarf:'neck',
  shoes:'paw', gloves:'paw', cushion:'paw',
};

/* 하나를 만들어 앵커에 얹어 돌려준다. 없는 id 면 null. */
export function make(id, A, opt = {}){
  const put = (o, p) => { o.position.fromArray(p); return o; };
  switch (id){
    case 'cap':     return put(cap(opt.color), A.crown);
    case 'police':  return put(policeCap(), A.crown);
    case 'crown':   return put(crown(), A.crown);
    case 'tie':     return put(tie(opt.color), A.neck);
    case 'bell':    return put(bell(), A.neck);
    case 'scarf':   return put(scarf(opt.color), A.collar);
    case 'cushion': return put(cushion(opt.color), A.hip);
    case 'shoes': {
      const g = new THREE.Group();
      A.paws.forEach(p => { if (p.fold < 0.5) g.add(put(shoe(opt.color), p.p)); });
      return g;
    }
    case 'gloves': {
      const g = new THREE.Group();
      A.paws.forEach(p => { if (p.tag === 'F' && p.fold < 0.5) g.add(put(guard(opt.color), p.p)); });
      return g;
    }
  }
  return null;
}

/* 한 마리가 걸친 것 전부. equip 은 { head, neck, paw } */
export function dress(equip, A, opt = {}){
  const g = new THREE.Group();
  for (const slot of ['head', 'neck', 'paw']){
    const id = equip && equip[slot];
    if (!id) continue;
    const o = make(id, A, opt[slot] || {});
    if (o) g.add(o);
  }
  return g;
}
