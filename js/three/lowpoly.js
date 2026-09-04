/* ============================================================
   lowpoly.js — 박스로 짠 로우폴리.

   에셋 팩을 사지도, 내려받지도 않는다. 모든 형태가 코드다.
   sprite.js 가 개를 ASCII 맵으로 그린 것과 같은 방식을, 축 하나 더 붙여서.

   ── 그림체는 KIT 하나로 결정된다 ──
   가구도 고양이도 전부 box() 를 통과하므로, box() 가 무엇을 만드느냐만 바꾸면
   사무실 전체의 그림체가 통째로 바뀐다. 모서리를 깎으면 townscaper 계열이 되고,
   격자에 스냅하면 복셀이 되고, 부품을 빼면 미니멀이 된다. 가구 함수는 그대로 둔다.

   좌표 규약 — 1 타일 = 1 유닛, Y 위쪽, 고양이는 +Z 를 본다.
   가구는 발밑이 y=0 이고 자기 칸 (0,0) 을 중심으로 선다.
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

export const PAL = {
  floor:    0xE3D9C6,
  floorAlt: 0xD6CBB4,
  lounge:   0xB98F86,
  wall:     0xF0E8DC,
  wallTrim: 0xD8CDBE,
  wood:     0xC08A55,
  woodDark: 0x8B5E3C,
  metal:    0xA8AFBA,
  metalDark:0x6E7684,
  screen:   0x30465C,
  screenOn: 0x7FC8D8,
  fabric:   0x6C7FB8,
  fabric2:  0xC2705F,
  leaf:     0x6FA96A,
  leafDark: 0x4E8250,
  pot:      0xC4795A,
  paper:    0xFAF6EE,
  ink:      0x39332E,
  catnip:   0x7CC46A,     // 이 회사의 품목. 모노크롬 스타일에서 유일한 색이 된다
  /* 장난감 — **가구 톤을 안 탄다.** 털뭉치는 이 사무실에서 색으로 기억되는 물건이라
     (빨간 공 하나가 회색 사무실의 유일한 색이다) 벌을 갈 때 같이 회색이 되면 그 자리가
     비어 버린다. 화분의 잎이 벌과 무관하게 초록인 것과 같은 이유다. */
  toy:      0xC2705F,
  glow:     0xFFB65C,     // 밤에 켜지는 것들 — 2026-08-28 에 주황 쪽으로 두 단계
  sky:      0xBBD9F0,     // 창밖
};

export function setPalette(over){ Object.assign(PAL, over); }

/* ============================================================
   KIT — 그림체 손잡이.

   prim     'sharp'  각진 박스
            'round'  모서리를 깎은 박스 (bevel 만큼)
   voxel    0 이면 자유, 값이 있으면 그 격자에 치수·위치를 스냅한다 (복셀 계단)
   shading  'flat'   면마다 단색 (로우폴리 기본)
            'smooth' 부드러운 음영
            'toon'   2~3단계로 끊는 셀 셰이딩
   detail   0 부품을 뺀 최소 형태 · 1 표준
   cat      고양이 비율 { head, leg, body, ear, tail }
   ============================================================ */
export const KIT = {
  prim: 'sharp', bevel: 0.05, voxel: 0, shading: 'flat', detail: 1,
  cat: { head: 1, leg: 1, body: 1, ear: 1, tail: 1 },
};
export function setKit(o){
  Object.assign(KIT, o, { cat: { ...KIT.cat, ...(o.cat || {}) } });
  _geo.clear(); _mat.clear();      // 그림체가 바뀌면 캐시는 전부 무효다
}

/* 셰이딩만 갈아 끼운다. mat 캐시 키에 shading 이 들어 있어서 섞이지 않고,
   지오메트리는 셰이딩과 무관하므로 캐시를 비울 이유도 없다. */
export function setShading(s){ KIT.shading = s; }

const _geo = new Map(), _mat = new Map();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
/* 치수는 복셀 격자에, 위치는 그 절반 격자에 붙인다.
   위치까지 같은 격자에 붙이면 모니터 화면처럼 얇게 겹쳐 놓은 부품이
   부모와 같은 자리·같은 두께가 되어 z-fighting 으로 지직거린다. */
const snapDim = v => KIT.voxel ? Math.max(KIT.voxel, Math.round(v / KIT.voxel) * KIT.voxel) : v;
const snap = v => KIT.voxel ? Math.round(v / (KIT.voxel / 2)) * (KIT.voxel / 2) : v;

/* 모서리 깎은 박스. 정점을 안쪽 상자에 붙인 뒤 반지름만큼 밀어낸다.
   세그먼트를 3으로 두면 "둥근 공"이 아니라 "깎인 모서리"가 되어 로우폴리를 유지한다. */
function roundedBox(w, h, d, r, seg = 3){
  r = Math.min(r, Math.min(w, h, d) * 0.45);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position;
  const hx = w/2 - r, hy = h/2 - r, hz = d/2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++){
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    v.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function geo(w, h, d){
  w = snapDim(w); h = snapDim(h); d = snapDim(d);
  const k = `${KIT.prim}|${KIT.bevel}|${w}|${h}|${d}`;
  let g = _geo.get(k);
  if (!g){
    g = KIT.prim === 'round' ? roundedBox(w, h, d, KIT.bevel) : new THREE.BoxGeometry(w, h, d);
    _geo.set(k, g);
  }
  return g;
}

/* 셀 셰이딩용 계단 텍스처. 단계가 적을수록 그림책에 가까워진다. */
let _grad = null;
function gradient(steps = 3){
  if (_grad) return _grad;
  const d = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) d[i] = Math.round(90 + (165 * i) / (steps - 1));
  _grad = new THREE.DataTexture(d, steps, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.needsUpdate = true;
  return _grad;
}

export function mat(color){
  const k = `${KIT.shading}|${color}`;
  let m = _mat.get(k);
  if (!m){
    m = KIT.shading === 'toon'
      ? new THREE.MeshToonMaterial({ color, gradientMap: gradient() })
      : new THREE.MeshLambertMaterial({ color, flatShading: KIT.shading !== 'smooth' });
    _mat.set(k, m);
  }
  return m;
}

/* 스스로 빛나는 것 — 모니터·스탠드 전구·네온. 광원과는 다르다.
   광원만으로 밤을 만들면 "어두운 화면"이 되고, 발광 면이 있어야 "켜져 있는 화면"이 된다. */
export function matGlow(color, k = 0.8){
  const key = `g|${KIT.shading}|${color}|${k.toFixed(2)}`;
  let m = _mat.get(key);
  if (!m){
    const o = { color, emissive: color, emissiveIntensity: k };
    m = KIT.shading === 'toon'
      ? new THREE.MeshToonMaterial({ ...o, gradientMap: gradient() })
      : new THREE.MeshLambertMaterial({ ...o, flatShading: KIT.shading !== 'smooth' });
    _mat.set(key, m);
  }
  return m;
}
export function stats(){ return { geometries:_geo.size, materials:_mat.size }; }

/* 이 파일의 유일한 원시 도형. 나머지는 전부 이걸 쌓은 것이다. */
export function box(w, h, d, color, x = 0, y = 0, z = 0){
  const m = new THREE.Mesh(geo(w, h, d), mat(color));
  m.position.set(snap(x), snap(y), snap(z));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
/* ---------- 다면체 프리미티브 ----------
   박스만으로는 참조 피규어 같은 "각진 구" 가 안 나온다. 고양이 몸처럼 둥근데
   면이 보여야 하는 것에는 정이십면체를 쓴다 — detail 0 은 20면, 1 은 80면.
   가구는 계속 박스로 간다. 둥근 건 캐릭터에만. */
function polyGeo(key, make){
  let g = _geo.get(key);
  if (!g){ g = make(); _geo.set(key, g); }
  return g;
}
export function ellip(w, h, d, color, detail = 1){
  const g = polyGeo(`ico|${detail}`, () => new THREE.IcosahedronGeometry(0.5, detail));
  const m = new THREE.Mesh(g, mat(color));
  m.scale.set(w, h, d);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function cone(r, h, color, seg = 5){
  const g = polyGeo(`cone|${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/* 위아래 굵기가 다른 기둥 — 다리와 꼬리. 각을 남기려고 면을 6개만 쓴다. */
export function stub(rTop, rBot, h, color, seg = 6){
  const g = polyGeo(`cyl|${rTop}|${rBot}|${h}|${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg));
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function group(...kids){
  const g = new THREE.Group();
  kids.forEach(k => k && g.add(k));
  return g;
}
const rich = () => KIT.detail >= 1;

/* ---------- 가구 ----------
   전부 "발밑 y=0, 자기 칸 중심" 규약을 지킨다. 그래야 격자에 그냥 얹힌다. */

/* 2칸 책상 — world.js 의 DESK + DESK_R 한 짝에 대응 */
export function desk(){
  const g = group(
    box(2.00, 0.08, 0.86, PAL.wood,     0, 0.61, 0),
    box(0.08, 0.62, 0.08, PAL.metalDark,-0.92, 0.31, -0.36),
    box(0.08, 0.62, 0.08, PAL.metalDark, 0.92, 0.31, -0.36),
    box(0.08, 0.62, 0.08, PAL.metalDark,-0.92, 0.31,  0.36),
    box(0.08, 0.62, 0.08, PAL.metalDark, 0.92, 0.31,  0.36),
  );
  if (rich()){
    g.add(box(0.52, 0.34, 0.60, PAL.woodDark, 0.62, 0.40, -0.06));   // 서랍장
    g.add(box(0.30, 0.03, 0.03, PAL.metal,    0.62, 0.48,  0.25));
  }
  return g;
}

export function monitor(x = 0, z = 0, turn = 0){
  const g = group(
    box(0.26, 0.03, 0.18, PAL.metalDark, 0, 0.66, 0),
    box(0.06, 0.14, 0.06, PAL.metalDark, 0, 0.74, 0),
    box(0.52, 0.34, 0.05, PAL.metalDark, 0, 0.98, 0),
    box(0.44, 0.26, 0.02, PAL.screen,    0, 0.98, 0.035),
  );
  g.position.set(x, 0, z);
  g.rotation.y = turn;
  return g;
}

export function papers(x = 0, z = 0){
  const sp = Math.max(0.03, KIT.voxel);      // 복셀 격자보다 촘촘히 쌓으면 겹친다
  const g = group(
    box(0.26, 0.03, 0.20, PAL.paper, 0, 0.665, 0),
    box(0.26, 0.03, 0.20, PAL.paper, 0.02, 0.665 + sp, 0.015),
  );
  if (rich()) g.add(box(0.24, 0.02, 0.18, PAL.paper, -0.01, 0.665 + sp * 2, -0.01));
  g.rotation.y = 0.3;
  g.position.set(x, 0, z);
  return g;
}

export function chair(turn = 0){
  const g = group(
    box(0.44, 0.10, 0.42, PAL.fabric,    0, 0.42, 0),
    box(0.40, 0.44, 0.08, PAL.fabric,    0, 0.66, -0.19),
    box(0.10, 0.38, 0.10, PAL.metalDark, 0, 0.21, 0),
  );
  if (rich()){
    g.add(box(0.52, 0.06, 0.10, PAL.metalDark, 0, 0.04, 0));
    g.add(box(0.10, 0.06, 0.52, PAL.metalDark, 0, 0.04, 0));
  } else {
    g.add(box(0.40, 0.06, 0.40, PAL.metalDark, 0, 0.04, 0));
  }
  g.rotation.y = turn;
  return g;
}

export function plant(){
  const leaves = group(
    box(0.30, 0.07, 0.16, PAL.leaf,     0.10, 0.62, 0),
    box(0.16, 0.07, 0.30, PAL.leafDark, 0, 0.70, -0.10),
  );
  leaves.children[0].rotation.z = 0.28;
  leaves.children[1].rotation.x = -0.24;
  if (rich()){
    const l3 = box(0.28, 0.07, 0.14, PAL.leaf, -0.08, 0.78, 0.06);
    l3.rotation.z = -0.34;
    leaves.add(l3, box(0.10, 0.30, 0.10, PAL.leafDark, 0, 0.55, 0));
  }
  return group(
    box(0.42, 0.34, 0.42, PAL.pot, 0, 0.17, 0),
    box(0.48, 0.07, 0.48, PAL.pot, 0, 0.36, 0),
    leaves,
  );
}

export function shelf(){
  const g = group(
    box(0.07, 1.30, 0.44, PAL.woodDark, -0.42, 0.65, 0),
    box(0.07, 1.30, 0.44, PAL.woodDark,  0.42, 0.65, 0),
    box(0.90, 0.06, 0.44, PAL.wood, 0, 0.02, 0),
    box(0.90, 0.06, 0.44, PAL.wood, 0, 0.44, 0),
    box(0.90, 0.06, 0.44, PAL.wood, 0, 0.86, 0),
    box(0.90, 0.06, 0.44, PAL.wood, 0, 1.28, 0),
  );
  if (!rich()) return g;
  // 책 — 두께와 높이를 흔들어야 선반이 선반으로 보인다
  const spines = [PAL.fabric, PAL.fabric2, PAL.leafDark, PAL.pot, PAL.screen, PAL.ink];
  let x = -0.36;
  for (let i = 0; x < 0.34; i++){
    const w = 0.05 + (i % 3) * 0.015, h = 0.24 + (i % 4) * 0.03;
    g.add(box(w, h, 0.30, spines[i % spines.length], x, 0.46 + h/2, 0));
    if (i % 5 !== 4) g.add(box(w, h * 0.9, 0.30, spines[(i + 3) % spines.length], x, 0.88 + h * 0.45, 0));
    x += w + 0.01;
  }
  return g;
}

export function coffee(){
  const g = group(
    box(0.72, 1.50, 0.60, PAL.metal,     0, 0.75, 0),
    box(0.60, 0.70, 0.03, PAL.screen,    0, 1.05, 0.30),
  );
  if (rich()) g.add(
    box(0.50, 0.06, 0.04, PAL.screenOn,  0, 1.32, 0.31),
    box(0.44, 0.26, 0.10, PAL.metalDark, 0, 0.44, 0.28),
    box(0.10, 0.14, 0.10, PAL.paper,     0, 0.44, 0.30),
    box(0.72, 0.07, 0.60, PAL.metalDark, 0, 1.52, 0),
  );
  return g;
}

export function cooler(){
  const g = group(
    box(0.40, 0.86, 0.40, PAL.metal,   0, 0.43, 0),
    box(0.34, 0.52, 0.34, 0x9FD3DE,    0, 1.16, 0),
  );
  if (rich()) g.add(
    box(0.44, 0.07, 0.44, PAL.metalDark, 0, 0.88, 0),
    box(0.38, 0.07, 0.38, PAL.metalDark, 0, 1.44, 0),
    box(0.10, 0.10, 0.12, PAL.metalDark, 0, 0.74, 0.22),
  );
  return g;
}

/* 낮잠 상자 — 뚜껑 없는 상자. 고양이가 들어가 있는 그림이 이 게임의 얼굴이다. */
export function napBox(){
  const g = group(
    box(0.86, 0.07, 0.86, PAL.woodDark, 0, 0.03, 0),
    box(0.86, 0.34, 0.07, PAL.wood, 0, 0.20, -0.40),
    box(0.86, 0.34, 0.07, PAL.wood, 0, 0.20,  0.40),
    box(0.07, 0.34, 0.86, PAL.wood, -0.40, 0.20, 0),
    box(0.07, 0.34, 0.86, PAL.wood,  0.40, 0.20, 0),
  );
  if (rich()) g.add(box(0.74, 0.11, 0.74, PAL.fabric2, 0, 0.11, 0));
  return g;
}

export function inbox(){
  const g = group(
    box(0.60, 0.05, 0.44, PAL.metalDark, 0, 0.02, 0),
    box(0.60, 0.05, 0.44, PAL.metalDark, 0, 0.20, 0),
    box(0.05, 0.20, 0.05, PAL.metalDark, -0.28, 0.11, -0.20),
    box(0.05, 0.20, 0.05, PAL.metalDark,  0.28, 0.11, -0.20),
  );
  for (let i = 0; i < (rich() ? 4 : 2); i++)
    g.add(box(0.52, 0.03, 0.38, PAL.paper, i * 0.005, 0.05 + i * 0.03, 0));
  return g;
}

export function rug(w, d, color = PAL.lounge){
  const m = box(w, 0.03, d, color, 0, 0.015, 0);
  m.castShadow = false;
  return m;
}

/* 캣닢 상자 — 등기부상 업종은 허브 유통업이다. */
export function catnip(nipOut){
  const g = group(
    box(0.66, 0.46, 0.66, PAL.woodDark, 0, 0.23, 0),
    box(0.72, 0.07, 0.72, PAL.wood, 0, 0.49, 0),
  );
  if (rich()) g.add(box(0.60, 0.05, 0.10, PAL.wood, 0, 0.30, 0.34));
  const leaf = (x, z, r) => {
    const l = box(0.26, 0.06, 0.14, PAL.catnip, x, 0.56, z);
    l.rotation.set(0, r, 0.22);
    if (nipOut) nipOut.push(l);
    return l;
  };
  g.add(leaf(0.10, 0.02, 0.4));
  if (rich()) g.add(leaf(-0.12, -0.08, -0.9), leaf(0.02, 0.14, 2.1));
  return g;
}

/* 서류 뭉치 — 안 치우면 증거가 된다 */
export function docStack(n = 5){
  const g = new THREE.Group();
  const sp = Math.max(0.03, KIT.voxel);
  for (let i = 0; i < n; i++){
    const p = box(0.34, 0.03, 0.26, PAL.paper, (i % 3) * 0.012, 0.02 + i * sp, (i % 2) * 0.01);
    p.rotation.y = (i % 4) * 0.06;
    g.add(p);
  }
  return g;
}

/* 스탠드 — 밤 패널에서 유일하게 살아 있는 광원. userData.bulb 에 전구 위치를 남긴다. */
export function lamp(){
  const g = group(
    box(0.22, 0.04, 0.22, PAL.metalDark, 0, 0.02, 0),
    box(0.05, 0.46, 0.05, PAL.metalDark, 0, 0.25, 0),
    box(0.26, 0.15, 0.26, PAL.metal, 0.06, 0.52, 0),
    box(0.18, 0.04, 0.18, PAL.glow, 0.06, 0.45, 0),
  );
  g.children[2].rotation.z = -0.25;
  g.userData.bulb = new THREE.Vector3(0.06, 0.44, 0);
  return g;
}

/* ============================================================
   cozy 재료.

   "오밀조밀"은 가구를 더 놓는다고 되는 게 아니다. 바닥에 물건을 늘리면
   금방 창고가 된다. 실제로 아늑하게 만드는 건 세 가지다:
     · 높이 — 눈높이 위에 뭔가 있어야 공간이 감싸인다 (벽선반 · 펜던트 · 캣워크)
     · 구획 — 낮은 칸막이와 러그가 큰 방을 작은 방 여럿으로 쪼갠다
     · 생활의 흔적 — 컵 · 상자 · 담요. 정리된 전시장이 아니라 사는 곳으로 보이게
   ============================================================ */

/* 낮은 칸막이 — 벽을 세우지 않고 구역만 나눈다. 시야는 넘어가고 발은 못 넘는다. */
export function partition(w = 2, h = 0.8, color = PAL.fabric){
  const g = group(
    box(w, h, 0.10, color, 0, h / 2, 0),
    box(w + 0.06, 0.07, 0.16, PAL.metalDark, 0, h, 0),
    box(0.16, 0.06, 0.34, PAL.metalDark, -w / 2 + 0.1, 0.03, 0),
    box(0.16, 0.06, 0.34, PAL.metalDark,  w / 2 - 0.1, 0.03, 0),
  );
  return g;
}

/* 벽에 거는 것들. y 는 호출하는 쪽이 정한다 (벽면에 붙이므로 z 는 벽 두께만큼 띄운다). */

/* 액자 속 그림. 색만 다른 판때기를 걸어 두면 그건 액자가 아니라 색종이다.
   그림은 정규 좌표(-0.5~0.5)로 그리고 액자 안쪽 크기에 맞춰 늘린다 —
   액자 크기가 달라져도 구도가 그대로 간다. 모티프는 이 회사에 있을 법한 것들로만:
   생선(이 회사의 통화) · 고양이 · 언덕 · 실적 차트 · 달 · 발자국. */
const ART_N = 6;
export function wallArt(w = 0.5, h = 0.4, color = PAL.fabric2, motif = 0){
  const iw = w - 0.08, ih = h - 0.08;
  const g = group(
    box(w, h, 0.05, PAL.woodDark, 0, 0, 0),          // 액자 테
    box(iw, ih, 0.03, color, 0, 0, 0.02),            // 캔버스 바탕
  );
  const P = (bw, bh, c, bx, by, dz = 0) =>
    g.add(box(bw * iw, bh * ih, 0.015, c, bx * iw, by * ih, 0.035 + dz));
  const D = (bw, bh, c, bx, by, dz = 0) => {
    const e = ellip(bw * iw, bh * ih, 0.015, c, 1);
    e.position.set(bx * iw, by * ih, 0.035 + dz);
    g.add(e);
  };
  switch (((motif % ART_N) + ART_N) % ART_N){
    case 0:                                          // 생선
      D(0.44, 0.34, PAL.fabric,  -0.04, 0);
      P(0.18, 0.24, PAL.fabric,   0.28, 0);
      P(0.09, 0.09, PAL.ink,     -0.16, 0.06, 0.004);
      break;
    case 1:                                          // 고양이 얼굴
      P(0.44, 0.34, PAL.wood,     0,    -0.04);
      P(0.10, 0.14, PAL.wood,    -0.16,  0.19);
      P(0.10, 0.14, PAL.wood,     0.16,  0.19);
      P(0.07, 0.07, PAL.ink,     -0.11, -0.01, 0.004);
      P(0.07, 0.07, PAL.ink,      0.11, -0.01, 0.004);
      break;
    case 2:                                          // 언덕과 해
      D(0.24, 0.24, PAL.glow,     0.26,  0.24);
      P(0.34, 0.10, PAL.leafDark,-0.16, -0.30);
      P(0.24, 0.10, PAL.leafDark,-0.16, -0.20);
      P(0.12, 0.10, PAL.leafDark,-0.16, -0.10);
      P(0.26, 0.10, PAL.leaf,     0.22, -0.30);
      P(0.14, 0.10, PAL.leaf,     0.22, -0.20);
      break;
    case 3:                                          // 실적 차트 — 사무실에는 이런 것도 걸린다
      P(0.62, 0.05, PAL.ink,      0,    -0.34);
      P(0.14, 0.22, PAL.fabric,  -0.24, -0.20);
      P(0.14, 0.38, PAL.fabric,   0,    -0.12);
      P(0.14, 0.54, PAL.catnip,   0.24, -0.04);
      break;
    case 4:                                          // 달과 별
      D(0.32, 0.36, PAL.glow,    -0.10,  0.06);
      D(0.26, 0.30, color,        0.03,  0.11, 0.004);   // 바탕색으로 덮어 초승달을 만든다
      P(0.06, 0.06, PAL.paper,    0.28, -0.16, 0.008);
      P(0.05, 0.05, PAL.paper,    0.10, -0.28, 0.008);
      P(0.05, 0.05, PAL.paper,    0.30,  0.26, 0.008);
      break;
    default:                                         // 발자국
      D(0.34, 0.28, PAL.ink,      0,    -0.16);
      D(0.13, 0.14, PAL.ink,     -0.24,  0.12);
      D(0.13, 0.14, PAL.ink,     -0.08,  0.24);
      D(0.13, 0.14, PAL.ink,      0.08,  0.24);
      D(0.13, 0.14, PAL.ink,      0.24,  0.12);
  }
  return g;
}

export function wallShelf(w = 1.2, opt = {}){
  const g = group(
    box(w, 0.07, 0.28, PAL.wood, 0, 0, 0),
    box(0.07, 0.20, 0.24, PAL.woodDark, -w / 2 + 0.08, -0.13, -0.02),
    box(0.07, 0.20, 0.24, PAL.woodDark,  w / 2 - 0.08, -0.13, -0.02),
  );
  if (!rich()) return g;
  /* **오른쪽 끝을 비울 수 있다**(opt.free · 0~1). 선반 위에 등을 하나 올리려는데
     잡동사니 넷이 판을 꽉 채우고 있어서 놓을 자리가 없었다. 등을 잡동사니 위에
     겹쳐 놓는 길도 있었고 그건 선반이 아니라 사고로 보인다 — 자리를 비우는 게 맞다.
     비운 자리에 무엇을 올릴지는 render3d 가 정한다(랜턴 · 양초). */
  const free = Math.max(0, Math.min(0.6, opt.free || 0));
  const span = w * (1 - free);
  const x0 = -w / 2;
  const things = [PAL.pot, PAL.fabric, PAL.leaf, PAL.fabric2, PAL.screen];
  for (let i = 0; i < 4; i++){
    const x = x0 + 0.25 * (span / w) + i * (span - 0.5 * (span / w)) / 3;
    g.add(box(0.14, 0.16 + (i % 3) * 0.04, 0.14, things[i % things.length], x, 0.12 + (i % 3) * 0.02, 0));
  }
  /* 비운 자리의 중심 — 여기에 등이 온다. 밖에서 셈을 다시 하면 free 를 고칠 때마다
     두 곳이 어긋난다. */
  if (free > 0) g.userData.free = new THREE.Vector3(w / 2 - (w * free) / 2, 0.035, 0);
  return g;
}

/* 고양이 통로 — 벽을 따라 난 선반. 사무실을 위로 늘리는 가장 싼 방법이고,
   고양이 게임에서 이것만큼 "여기 고양이가 산다"고 말하는 물건이 없다. */
export function catwalk(len = 3){
  const g = group(box(len, 0.08, 0.34, PAL.wood, 0, 0, 0));
  for (let i = 0; i <= 2; i++)
    g.add(box(0.08, 0.22, 0.10, PAL.woodDark, -len / 2 + 0.2 + i * (len - 0.4) / 2, -0.15, -0.11));
  return g;
}

/* 펜던트 조명 — 천장에서 내려온다. userData.bulb 에 전구 위치. */
export function pendant(drop = 0.7){
  const g = group(
    box(0.05, drop, 0.05, PAL.metalDark, 0, -drop / 2, 0),
    box(0.42, 0.24, 0.42, PAL.fabric2, 0, -drop - 0.12, 0),
    box(0.30, 0.05, 0.30, PAL.glow, 0, -drop - 0.24, 0),
  );
  g.userData.bulb = new THREE.Vector3(0, -drop - 0.3, 0);
  return g;
}

/* ============================================================
   불 켜진 것들 — 조명 기구 한 벌 (2026-08-28)

   레퍼런스(아늑한 아이소메트릭 방)를 픽셀로 뜯어 보고 알게 된 것 하나:
   **아늑한 방은 밝은 방이 아니라 광원이 많은 방이다.** 그 그림에서 전역광을 걷어
   내고 보면 남는 것이 전구줄·양초 셋·탁상등·창 — 다섯 종류의 작은 불이고, 그것들이
   방 곳곳에 흩어져 **밝은 점을 열댓 개** 만든다. 밝기의 총합은 오히려 우리 사무실의
   낮 화면보다 낮다. 다른 것은 총합이 아니라 **분포**다.

   지금까지 이 방은 반대로 지어져 있었다 — 천장등 두엇이 방을 고르게 들고, 책상등이
   웅덩이를 만들고, 끝. 종류가 둘뿐이니 「빛이 여기저기 고여 있다」가 나올 수가 없다.
   그래서 기구를 늘린다. 아래 다섯이 그것이다:

     floorLamp    스탠딩 스탠드 — 바닥에 서는 키 큰 등. 구석과 쉼터에 선다
     stringLights 전구줄 — 벽 윗선을 따라 늘어진다. **작은 불 여럿**의 주력
     sconce       벽등 — 벽에 간간히. 벽면을 위아래로 씻는다
     candles      양초 — 선반·탁자 위. 진짜 광원은 아니고 떨리는 발광점이다
     lantern      랜턴 — 선반 위 유리등. 사방이 다 빛나서 어느 각도에서도 읽힌다

   ── 위에서 내려다보는 화면이라는 제약 ──

   이 게임의 카메라는 늘 위에 있다. 그래서 **갓이 아래를 향하는 조명은 켜졌는지 안
   보인다** — 빛나는 면이 갓에 통째로 가린다(천장 펜던트를 2026-08-25 에 없앤 이유가
   이것이었다). 아래 기구들은 전부 그 반대로 지었다: 빛나는 면이 **위나 옆**을 본다.
   토치에르는 사발이 하늘을 보고, 전구줄은 알맹이가 사방으로 빛나고, 벽등은 위로 씻고,
   양초와 랜턴은 애초에 갓이 없다. 「조명 기구를 놓았다」가 아니라 「불이 켜져 있다」로
   읽혀야 하고, 그 차이가 전부 여기서 갈린다.

   ── 발광면과 광원은 다른 물건이다 ──

   여기서 만드는 것은 **발광면**뿐이다(matGlow). 점광원은 render3d 가 붙인다 —
   기구마다 userData.bulb 에 「불이 있는 자리」를 로컬 좌표로 찍어 두면 그쪽에서 읽는다
   (pendant 가 쓰던 규약을 그대로 따른다). 나누는 이유는 값이 다르기 때문이다:
   발광면은 스무 개가 있어도 공짜지만 점광원은 셰이더가 픽셀마다 도는 루프라
   **개수를 세어 가며 써야 한다.** 양초에 광원을 안 주는 것이 그 판단이다.

   userData.lit 은 그 발광면의 기준 세기다. render3d 의 night() 이 시간대마다
   이 값을 배율로 다시 칠한다. userData.flame 이 찍힌 것은 매 프레임 떤다.
   ============================================================ */

/* 빛나는 부품. box/stub/cone 은 mat() 로 굽고 나오므로 재질만 갈아 끼운다.
   그림자는 안 만든다 — 스스로 빛나는 면이 제 그림자를 드리우면 그건 전구가 아니라
   전구 모양 돌이다. dynamic 을 찍어야 정적 병합에서 빠진다(merge.js): 병합은 색을
   정점에 구워 넣는 최적화라, 여기 딸려 들어가면 발광이 그냥 노란 페인트가 된다. */
function litOf(m, color, k){
  m.material = matGlow(color, k);
  m.castShadow = false;
  m.userData.dynamic = true;
  m.userData.lit = k;
  m.userData.litColor = color;
  return m;
}
function litBox(w, h, d, color, k, x = 0, y = 0, z = 0){
  return litOf(box(w, h, d, color, x, y, z), color, k);
}
function litBall(r, color, k, x = 0, y = 0, z = 0){
  const m = litOf(ellip(r * 2, r * 2, r * 2, color), color, k);
  m.position.set(x, y, z);
  return m;
}
function litDisc(r, h, color, k, x = 0, y = 0, z = 0){
  const m = litOf(stub(r, r, h, color, 10), color, k);
  m.position.set(x, y, z);
  return m;
}

/* ---------- 스탠딩 스탠드 ----------
   바닥에 서는 키 큰 등. 이 방에 없던 종류다 — 지금까지 바닥 광원은 책상에 붙은
   것뿐이라, 책상이 없는 자리(쉼터·구석·통로)에는 불을 놓을 방법이 아예 없었다.
   천장등을 밝혀 메우는 길이 있었고 그건 이미 해 봤다: 방이 고르게 밝아지면서
   웅덩이가 통째로 사라졌다. 구석에 필요한 것은 **그 구석의 등**이다.

   v=0 토치에르 — 사발이 하늘을 본다. 위에서 보는 화면에서 켜진 게 제일 잘 읽히는
        모양이고, 빛도 실제로 위로 나가 벽 윗부분을 데운다(방이 감싸이는 느낌은
        눈높이 **위**가 밝을 때 생긴다 — 이 파일 「cozy 재료」 절의 첫 줄이다).
   v=1 종이 등 — 기둥 위에 빛나는 공. 갓이 없으니 각도를 안 탄다.
        토치에르와 실루엣이 완전히 달라야 둘을 같이 놓았을 때 「같은 물건 두 개」로
        안 보인다. 그래서 하나는 각지고 위로 열린 것, 하나는 둥근 것으로 갈랐다. */
export function floorLamp(v = 0){
  const g = new THREE.Group();
  const H = v === 1 ? 1.30 : 1.54;
  /* 받침. 키가 큰 물건이라 받침이 작으면 넘어질 듯이 보인다 — 실제로 쓰러지지는
     않지만 「불안한 가구」는 아늑함의 반대말이다. */
  g.add(box(0.30, 0.035, 0.30, PAL.metalDark, 0, 0.018, 0));
  g.add(box(0.34, 0.02, 0.34, PAL.metalDark, 0, 0.006, 0));
  g.add(box(0.045, H - 0.1, 0.045, PAL.metalDark, 0, (H - 0.1) / 2 + 0.03, 0));

  if (v === 1){
    /* 종이 등 — 공 하나가 통째로 빛난다.

       **살의 크기가 공보다 크면 안 된다.** 처음엔 0.44·0.46 짜리 판을 위아래로 둘러서
       「등의 테」를 만들려고 했는데, 공의 지름이 0.42 라 판이 더 컸다. 위에서 내려다보는
       화면에서 그건 공을 가린 접시 두 장이고, 실제로 찍어 보니 등이 아니라 **햄버거**로
       보였다(spike/l1-lights.html). 조형을 방 안에서 판정할 수 없다는 걸 그때 알았고,
       그래서 그 페이지를 만들었다.

       지금은 살을 **구면에 맞춰** 자른다. 반지름 0.24 짜리 공의 y=±0.13 자리 폭이
       0.40 이라 그 값을 그대로 쓴다 — 살이 공의 실루엣 안에 들어가므로 가리지 않고
       띠로만 읽힌다. */
    const R = 0.24;
    g.add(litBall(R, PAL.glow, 1.0, 0, H, 0));
    /* 살은 **원반**이어야 한다. 네모 판으로 하면 폭을 구면에 맞춰도 **모서리**가
       0.283 까지 뻗어서(폭×√2÷2) 공 밖으로 삼각형 네 개가 튀어나온다.
       한 번 고치고 또 걸린 자리라 치수 대신 도형을 바꿨다. */
    const bandR = Math.sqrt(R * R - 0.13 * 0.13);
    [0.13, -0.13].forEach(dy => {
      const b = stub(bandR, bandR, 0.016, PAL.paper, 10);
      b.position.set(0, H + dy, 0);
      g.add(b);
    });
    /* 꼭지는 작게. 크면 그게 다시 공을 덮는다 — 위 실수의 축소판이다. */
    g.add(box(0.07, 0.035, 0.07, PAL.metalDark, 0, H + R + 0.02, 0));
    g.userData.bulb = new THREE.Vector3(0, H, 0);
  } else {
    /* 토치에르 — 위로 벌어진 사발. rTop > rBot 이라 위에서 보면 **안이 보인다**.
       거꾸로(rTop < rBot) 만들면 흔한 갓등이 되는데, 그 모양은 이 카메라에서
       빛나는 면이 통째로 가려서 「꺼진 등」과 구별이 안 된다. */
    const bowl = stub(0.30, 0.13, 0.20, PAL.metal, 8);
    bowl.position.set(0, H - 0.02, 0);
    g.add(bowl);
    /* 사발 안의 빛. 테두리보다 살짝 낮게 앉혀야 「사발에 고인 빛」이 된다 —
       테두리 위로 올리면 사발에 얹힌 원판이다. */
    g.add(litDisc(0.255, 0.03, PAL.glow, 1.0, 0, H + 0.045, 0));
    /* 테두리 한 겹. 안쪽 빛이 벌어진 면을 타고 나오는 것처럼 보이게 하는 값싼 수법이다. */
    g.add(litDisc(0.30, 0.022, PAL.glow, 0.55, 0, H + 0.075, 0));
    g.userData.bulb = new THREE.Vector3(0, H + 0.10, 0);
  }
  /* 스탠드 발치의 전선. 손톱만 한 물건인데 이게 있으면 등이 방에 **꽂혀 있는** 것이
     된다(벽의 콘센트를 세 칸마다 박아 둔 것과 같은 판단이다). */
  g.add(box(0.03, 0.02, 0.26, PAL.ink, 0.06, 0.012, 0.22));
  return g;
}

/* ---------- 전구줄 ----------
   이 한 벌에서 **주력**이다. 레퍼런스가 아늑한 이유의 절반이 여기 있다 — 작은 불
   열댓 개가 눈높이 위를 가로지르면 방이 그 선 아래로 감싸인다.

   **매듭져 늘어뜨린다**(festoon). 한 줄을 양 끝에서만 잡으면 8칸짜리 벽에서
   한가운데가 바닥까지 처지는데, 그건 전구줄이 아니라 빨랫줄이다. 2.2칸쯤마다 못을
   박고 그 사이만 처지게 한다 — 실제로 이렇게 다는 물건이기도 하고, 무엇보다
   **처짐이 반복되면 그게 리듬이 된다.** 벽 하나에 같은 곡선이 서너 번 반복되는 것이
   이 물건의 그림이다.

   알맹이는 **점광원이 아니다.** 열여섯 개를 진짜 광원으로 달면 셰이더가 픽셀마다
   열여섯 번 도는데, 그 값을 치르고 얻는 것은 「고르게 데워진 벽」이다 — 알맹이가
   촘촘해서 웅덩이가 안 생긴다. render3d 가 이 줄에 **띄엄띄엄** 광원을 얹는다. */
export function stringLights(len = 4, opt = {}){
  const g = new THREE.Group();
  const SAG = opt.sag ?? 0.17;
  const gap = opt.gap ?? 0.34;
  const n = Math.max(4, Math.round(len / gap) + 1);
  const seg = Math.max(1, Math.round(len / 2.2));      // 못 사이 칸 수
  const yAt = u => -Math.sin(((u * seg) % 1) * Math.PI) * SAG;
  const pts = [];
  for (let i = 0; i < n; i++){
    const u = i / (n - 1);
    pts.push([-len / 2 + u * len, yAt(u), 0]);
  }
  /* 줄. 점 사이를 잇는 얇은 막대를 눕힌다 — 곡선을 진짜로 굽히는 것보다 싸고,
     로우폴리에서는 꺾인 선이 오히려 어울린다. */
  for (let i = 0; i < n - 1; i++){
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const w = box(L + 0.01, 0.014, 0.014, PAL.ink, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    w.rotation.z = Math.atan2(dy, dx);
    w.castShadow = false;
    g.add(w);
  }
  /* 알맹이. 하나씩 걸린 소켓이 있어야 「줄에 달린 전구」가 된다 — 빛나는 공만
     늘어놓으면 공중에 뜬 점이 된다.

     **소켓은 알맹이보다 확실히 작아야 한다.** 처음엔 0.026 짜리 어두운 상자를 알맹이
     바로 위에 얹었는데, 게임 화면에서 알맹이가 5px 도 안 되다 보니 그 위의 검은 점과
     뭉쳐서 **줄 전체가 검은 점선**으로 보였다(밤 스크린샷 확대). 소켓을 0.02 로 줄이고
     밝은 쪽 금속으로 바꾸고 알맹이를 0.052 로 키웠다 — 이제 폭이 다섯 배 차이다. */
  const bulbs = [];
  for (let i = 0; i < n; i++){
    const [x, y] = pts[i];
    g.add(box(0.02, 0.022, 0.02, PAL.metal, x, y - 0.016, 0));
    const b = litBall(0.052, PAL.glow, 1.0, x, y - 0.058, 0);
    g.add(b);
    bulbs.push(b);
  }
  /* 못. 처짐이 시작되는 자리마다 하나 — 줄이 벽에 **붙어 있다**를 말한다. */
  for (let s = 0; s <= seg; s++){
    const x = -len / 2 + (len * s) / seg;
    g.add(box(0.03, 0.05, 0.05, PAL.wallTrim, x, 0.012, -0.012));
  }
  g.userData.bulbs = bulbs;
  /* 광원을 얹을 자리 몇 곳 — 처진 골의 제일 낮은 데다. 골마다 하나면 벽을 따라
     빛이 **일정한 간격으로 고인다**(줄 전체를 하나로 데우는 것과 다르다). */
  g.userData.hooks = Array.from({ length: seg }, (_, s) =>
    new THREE.Vector3(-len / 2 + (len * (s + 0.5)) / seg, -SAG - 0.06, 0));
  return g;
}

/* ---------- 벽등 ----------
   벽에 간간히 걸리는 등. 전구줄이 벽 **윗선**을 지나간다면 이쪽은 벽 **면**을 씻는다 —
   빛이 위아래로 부챗살처럼 번지는 그 자국이 벽을 평평한 판에서 벽으로 만든다.

   반쪽 갓이 위로 열려 있다. 아래로 닫으면 이 카메라에서 안 읽히고(위 머리말),
   위로 열면 갓 안의 빛이 그대로 보이면서 벽 윗부분이 같이 밝아진다. */
export function sconce(v = 0){
  const g = new THREE.Group();
  /* 벽에 대는 판 */
  g.add(box(0.16, 0.20, 0.05, PAL.metalDark, 0, -0.10, 0.02));
  g.add(box(0.07, 0.07, 0.13, PAL.metalDark, 0, 0.0, 0.07));
  if (v === 1){
    /* 유리 관 — 세로로 긴 등. 갓등과 실루엣이 달라야 벽에 둘이 걸렸을 때 다른
       물건으로 보인다. */
    g.add(litBox(0.12, 0.38, 0.12, PAL.glow, 1.0, 0, 0.02, 0.12));
    /* 캡은 얇고 **관보다 넓지 않게**. 0.16 짜리를 얹었더니 위에서 내려다보는 화면에서
       그 윗면이 통째로 보여서 「빛나는 관에 얹힌 검은 판」이 됐다(파스텔 판에서 잡혔다).
       종이 등의 살에서 한 번, 여기서 또 한 번 — 이 카메라에서 **가로 판은 늘 정면**이다. */
    g.add(box(0.13, 0.022, 0.13, PAL.metal, 0, 0.218, 0.12));
    g.add(box(0.13, 0.022, 0.13, PAL.metal, 0, -0.178, 0.12));
    g.userData.bulb = new THREE.Vector3(0, 0.02, 0.20);
  } else {
    /* 위로 열린 반쪽 갓 */
    const bowl = stub(0.19, 0.10, 0.15, PAL.paper, 8);
    bowl.position.set(0, 0.06, 0.15);
    g.add(bowl);
    g.add(litDisc(0.155, 0.028, PAL.glow, 1.0, 0, 0.125, 0.15));
    g.userData.bulb = new THREE.Vector3(0, 0.16, 0.20);
  }
  return g;
}

/* ---------- 양초 ----------
   **광원을 안 준다.** 촛불 하나가 실제로 방을 밝히지는 않고, 이 방에서 촛불이 하는
   일은 밝히는 것이 아니라 **떠는 것**이다 — 가만한 빛만 있는 방은 조명이 잘 된 방이고,
   떠는 점이 하나 있어야 「불이 켜져 있다」가 된다. 그 일에 셰이더 루프를 한 칸 쓰는
   것은 비싸다. 대신 발광면을 매 프레임 흔든다(render3d 의 tickFlames).

   키가 다른 셋. 같은 키로 늘어놓으면 초가 아니라 울타리다. */
export function candles(n = 3){
  const g = new THREE.Group();
  g.add(box(0.30, 0.022, 0.22, PAL.woodDark, 0, 0.011, 0));
  const HS = [0.15, 0.095, 0.125, 0.075];
  const flames = [];
  for (let i = 0; i < n; i++){
    const h = HS[i % HS.length];
    const x = (i - (n - 1) / 2) * 0.085;
    const z = (i % 2) * 0.05 - 0.025;
    const wax = stub(0.031, 0.034, h, PAL.paper, 7);
    wax.position.set(x, 0.022 + h / 2, z);
    g.add(wax);
    /* 불꽃. 심지가 없으면 초 위에 뜬 노란 조각이라, 어두운 꼭지를 한 칸 끼운다. */
    g.add(box(0.012, 0.022, 0.012, PAL.ink, x, 0.022 + h + 0.011, z));
    const f = litOf(cone(0.038, 0.095, PAL.glow, 6), PAL.glow, 1.2);
    f.position.set(x, 0.022 + h + 0.068, z);
    f.userData.flame = 1;
    g.add(f);
    flames.push(f);
  }
  g.userData.flames = flames;
  return g;
}

/* ---------- 랜턴 ----------
   선반과 탁자에 놓는 유리등. 네 면이 다 빛나서 **각도를 안 탄다** — 벽 선반은
   높은 데 있어서 카메라가 옆에서 보게 되는데, 거기에 갓 달린 등을 올려 두면
   빛나는 면이 안 보인다. 손잡이 고리가 이 물건을 「등」으로 만든다. */
export function lantern(){
  const g = new THREE.Group();
  g.add(box(0.20, 0.03, 0.20, PAL.metalDark, 0, 0.015, 0));
  g.add(litBox(0.145, 0.19, 0.145, PAL.glow, 0.92, 0, 0.13, 0));
  /* 기둥 넷. 이게 없으면 빛나는 상자다. */
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    g.add(box(0.022, 0.20, 0.022, PAL.metalDark, sx * 0.076, 0.13, sz * 0.076));
  g.add(box(0.21, 0.028, 0.21, PAL.metalDark, 0, 0.24, 0));
  g.add(box(0.03, 0.055, 0.03, PAL.metalDark, 0, 0.28, 0));
  g.userData.bulb = new THREE.Vector3(0, 0.14, 0);
  return g;
}

/* 창 — 벽에 구멍을 뚫는 대신 밝은 판을 붙인다. 디오라마에서는 이걸로 충분히 읽히고,
   벽을 조각내지 않아도 된다.

   **블라인드를 달았다.** 맨 판은 「창」이 아니라 「빛나는 사각형」으로 읽힌다 —
   가로줄이 몇 개 그어져야 그게 창이 된다. 사무실에 블라인드가 없는 편이 오히려 이상하고,
   무엇보다 이 게임에서 창은 시간대를 말하는 유일한 물건이라(pane 색이 시각을 말한다)
   그 판이 무엇인지가 한눈에 읽혀야 한다.

   **다 내려 둔다**(2026-08-25). 예전에는 위쪽 2/3 만 내린 「반쯤」이었다.
   창은 여전히 시계다 — 살 사이를 비워 두므로 그 틈으로 pane 색이 그대로 보인다.
   저녁이면 주황, 야근이면 남색. 바뀐 것은 살이 바닥까지 내려온다는 것뿐이다.

   pane 은 **children[1] 이어야 한다** — render3d 가 그 자리로 찾아서 시간대 색을 입힌다
   (put 의 pane:1). 그래서 살은 뒤에 붙인다. */
export function windowUnit(w = 1.4, h = 1.1){
  const g = group(
    box(w + 0.16, h + 0.16, 0.08, PAL.wall, 0, 0, 0.02),
    box(w, h, 0.04, PAL.sky, 0, 0, 0.05),      // ← children[1] · 시간대 색이 여기 붙는다
    box(0.06, h, 0.05, PAL.wall, 0, 0, 0.07),
    box(w, 0.06, 0.05, PAL.wall, 0, 0, 0.07),
    box(w + 0.26, 0.08, 0.22, PAL.wood, 0, -h / 2 - 0.12, 0.08),
  );
  /* 날. **아래까지 내린다.** 간격 0.115 는 살 두께(0.045)의 두 배 반쯤이라 살과 틈이
     비슷하게 보인다. 더 촘촘히 하면 판 하나가 되고, 더 벌리면 사다리가 된다. */
  const top = h / 2 - 0.10, GAP = 0.115, n = Math.max(3, Math.floor((h - 0.14) / GAP));
  for (let i = 0; i < n; i++)
    g.add(box(w - 0.04, 0.045, 0.03, PAL.paper, 0, top - i * GAP, 0.075));
  /* 헤드박스와 당김줄. 이 둘이 없으면 살이 공중에 뜬 선으로 보인다.
     줄은 다 내린 블라인드에서 **끝까지 늘어져 있다** — 걷어 올린 줄은 짧게 감겨 있다. */
  g.add(box(w + 0.02, 0.10, 0.07, PAL.wallTrim, 0, h / 2 - 0.02, 0.085));
  g.add(box(0.022, h * 0.5, 0.022, PAL.metalDark, w / 2 - 0.12, h / 2 - 0.06 - h * 0.25, 0.09));
  return g;
}

/* 전등 스위치 — 천장등을 끄고 켜는 물건. **눌러야 할 유일한 이유가 있는 벽 물건이다.**

   설정창에 「천장등」체크박스를 두는 길도 있었고 그게 훨씬 싸다. 안 한 이유: 이 방에서
   불을 끄는 일은 설정이 아니라 행동이다. 야근하는 고양이 옆에서 큰 불을 끄고 책상등만
   남기는 건 이 게임이 하려는 이야기 그 자체라, 그 동작이 메뉴 안에 있으면 안 된다.

   on 이면 손잡이가 위로 올라가고 표시등이 켜진다 — 벽에서 상태가 보여야 스위치다.
   collapse(정적 병합)에서 빠져야 한다: 색이 바뀌는 물건이다. */
export function lightSwitch(on = true){
  const g = new THREE.Group();
  /* 콘센트(outlet)보다 크다. 콘센트는 벽을 건물처럼 보이게 하는 **무늬**라 손톱만 해도
     되지만, 이건 **눌러야 하는 것**이다. 한 칸의 1/3 쯤 — 벽에서 눈에 띄되
     가구처럼 커지지는 않는 크기. */
  g.add(box(0.26, 0.34, 0.04, PAL.paper, 0, 0, 0.02));               // 커버
  const rock = box(0.15, 0.16, 0.035, PAL.wallTrim, 0, on ? 0.055 : -0.055, 0.048);
  g.add(rock);
  /* 표시등은 **꺼졌을 때 켜진다.** 실제 전등 스위치의 야광 표시등과 같은 규칙이고,
     여기서는 그게 안전장치다: 불을 끄면 그 구석이 새까매져서 스위치가 화면에서
     사라진다 — 켜졌을 때만 빛나게 두면 한 번 끄고 나서 다시 켤 방법이 없다.
     (실제로 그렇게 만들었다가 밤 스크린샷에서 잡혔다.) */
  const led = box(0.055, 0.055, 0.025, on ? PAL.metalDark : PAL.glow, 0, -0.12, 0.048);
  g.add(led);
  /* 집기용 상자. 보이지는 않고 광선만 맞는다 — 스위치 실물만 한 크기로 두면
     "눌렀는데 안 눌린다" 가 된다. 벽 물건은 화면에서 작게 찍히기 때문이다. */
  const hit = box(0.62, 0.62, 0.10, PAL.paper, 0, 0, 0.05);
  hit.visible = false;
  g.add(hit);
  g.userData.rock = rock;
  g.userData.led = led;
  return g;
}

/* 바닥의 빛 자국(sunPatch)이 여기 있었다. 창에서 들어오는 빛을 없앤 2026-08-25 에
   같이 지웠다 — 아무도 안 부르는 채로 오래 남아 있던 함수이기도 했다. */

export function catTower(){
  return group(
    box(0.80, 0.10, 0.80, PAL.woodDark, 0, 0.05, 0),
    box(0.16, 0.60, 0.16, PAL.wood, -0.18, 0.38, 0),
    box(0.60, 0.10, 0.60, PAL.fabric, -0.18, 0.72, 0),
    box(0.16, 0.50, 0.16, PAL.wood, 0.16, 0.99, 0.10),
    box(0.66, 0.12, 0.66, PAL.fabric2, 0.16, 1.28, 0.10),
    box(0.14, 0.22, 0.14, PAL.fabric, -0.30, 0.85, 0.22),
  );
}

export function whiteboard(w = 1.6){
  const g = group(
    box(w, 1.0, 0.07, PAL.metal, 0, 0, 0),
    box(w - 0.10, 0.90, 0.03, PAL.paper, 0, 0, 0.04),
  );
  if (rich()) for (let i = 0; i < 3; i++)
    g.add(box(0.30 + i * 0.12, 0.05, 0.02, [PAL.fabric, PAL.fabric2, PAL.leafDark][i],
              -w / 4 + i * 0.18, 0.24 - i * 0.20, 0.055));
  return g;
}

/* 벽시계 — 이 게임에서 시계는 장식이 아니다.

   copycat 은 **당신의 데스크톱 시계로 돈다.** 당신의 정오에 고양이들이 점심을 먹으러 가고
   6시에 배웅한다. 그런데 정작 벽에 걸린 시계는 네모난 판에 막대 두 개였다 —
   게임의 전제를 말해 줄 수 있는 물건이 아무 말도 안 하고 있었다.

   그래서 둥글게 다시 만들고 **바늘이 진짜 시각을 가리키게 한다**(render3d 가 돌린다).
   바늘 묶음에 keep 을 달아 두면 정적 병합에서 살아남는다 — 드로우콜 두 개를 이것에 쓴다. */
export function wallClock(){
  const g = new THREE.Group();
  const disc = (r, d, color, z) => {
    const m = stub(r, r, d, color, 14);
    m.rotation.x = Math.PI / 2;                    // 기둥을 눕혀 원판으로
    m.position.z = z;
    return m;
  };
  g.add(disc(0.19, 0.07, PAL.woodDark, 0));        // 테
  g.add(disc(0.155, 0.05, PAL.paper, 0.025));      // 문자판

  /* 눈금 12개. 12·3·6·9 만 굵게 — 전부 같으면 원판에 점을 찍은 것으로 보인다 */
  for (let i = 0; i < 12; i++){
    const a = i * Math.PI / 6, big = i % 3 === 0;
    const t = box(big ? 0.024 : 0.012, big ? 0.042 : 0.026, 0.012, PAL.ink,
                  Math.sin(a) * 0.118, Math.cos(a) * 0.118, 0.052);
    t.rotation.z = -a;
    g.add(t);
  }

  /* 바늘 — 회전축이 한가운데여야 하므로 그룹으로 감싸고 막대만 위로 올린다 */
  const hand = (len, w, color, z) => {
    const h = new THREE.Group();
    h.add(box(w, len, 0.012, color, 0, len / 2 - w * 0.5, z));
    h.userData.keep = true;                        // 병합에서 빼 둔다. 돌아야 하니까
    return h;
  };
  const hour = hand(0.082, 0.022, PAL.ink, 0.056);
  const min  = hand(0.125, 0.014, PAL.ink, 0.060);
  g.add(hour, min);
  g.add(disc(0.022, 0.02, PAL.fabric2, 0.066));    // 가운데 못

  g.userData.clock = { hour, min };
  return g;
}

/* ---------- 벽에 붙는 잔것들 ----------
   벽이 큰 판 하나로 남아 있으면 로우폴리가 아니라 그냥 빈 벽이다.
   액자 하나를 크게 거는 것보다 **작은 것을 여러 개** 붙이는 쪽이 사무실로 읽힌다. */

/* 코르크 게시판 — 메모가 겹쳐 붙어 있는 것만으로 "일이 도는 곳" 이 된다 */
export function corkBoard(w = 0.8){
  const h = w * 0.72;
  const g = group(
    box(w, h, 0.05, PAL.woodDark, 0, 0, 0),
    box(w - 0.07, h - 0.07, 0.03, PAL.pot, 0, 0, 0.02),
  );
  if (!rich()) return g;
  const notes = [[-0.26, 0.16, PAL.glow], [0.02, 0.20, PAL.paper], [0.27, 0.10, PAL.fabric],
                 [-0.18, -0.14, PAL.paper], [0.16, -0.18, PAL.catnip]];
  notes.forEach(([x, y, c], i) => {
    const nx = x * w, ny = y * h * 1.4;
    const n = box(0.15 + (i % 2) * 0.03, 0.13, 0.012, c, nx, ny, 0.038);
    n.rotation.z = ((i % 3) - 1) * 0.09;           // 손으로 붙인 것은 안 반듯하다
    g.add(n);
    g.add(box(0.024, 0.024, 0.012, PAL.fabric2, nx, ny + 0.05, 0.048));   // 압정
  });
  return g;
}

/* 도배 견본책 — 벽에 걸린 두꺼운 바인더. 안쪽에 색 견본이 끼워져 있고
   아래로 몇 장이 삐져나와 있다. 그 삐져나온 조각이 이게 「샘플」이라고 말한다 —
   두께만 있는 상자는 그냥 책이 되고, 책은 눌러 볼 물건으로 안 보인다. */
export function sampleBinder(){
  const g = group(
    box(0.34, 0.44, 0.09, PAL.woodDark, 0, 0, 0),          // 뒷판
    box(0.31, 0.41, 0.05, PAL.paper, 0, 0, 0.045),         // 종이 뭉치
    box(0.06, 0.44, 0.10, PAL.fabric2, -0.15, 0, 0.005),   // 등
    box(0.05, 0.04, 0.06, PAL.metalDark, 0, 0.24, 0.02),   // 걸이
  );
  if (!rich()) return g;
  /* 삐져나온 견본 조각 다섯. 색은 팔레트에서 골라 두었다 —
     벽지를 갈면 PAL 도 같이 갈리므로 이 조각들도 방을 따라간다. */
  const chips = [PAL.lounge, PAL.leaf, PAL.fabric, PAL.wood, PAL.catnip];
  chips.forEach((c, i) => {
    const t = box(0.05, 0.16, 0.02, c, -0.10 + i * 0.055, -0.27, 0.04);
    t.rotation.z = ((i % 3) - 1) * 0.06;
    g.add(t);
  });
  g.add(box(0.30, 0.03, 0.06, PAL.wallTrim, 0, -0.20, 0.03));   // 아래 물림쇠
  return g;
}

/* 달력 — 분기로 굴러가는 게임이라 벽에 하나쯤 걸려 있어야 한다 */
export function calendar(){
  const g = group(
    box(0.44, 0.56, 0.04, PAL.paper, 0, 0, 0),
    box(0.44, 0.14, 0.03, PAL.fabric2, 0, 0.21, 0.02),   // 달 이름 띠
    box(0.06, 0.05, 0.03, PAL.metalDark, 0, 0.31, 0.02), // 걸이
  );
  if (!rich()) return g;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++){
      const on = (r * 5 + c) % 7 === 3;                  // 며칠은 표시가 되어 있다
      g.add(box(0.055, 0.045, 0.012, on ? PAL.catnip : PAL.wallTrim,
                -0.16 + c * 0.08, 0.08 - r * 0.085, 0.03));
    }
  return g;
}

/* 약초 도매업 등록증 — 이 회사를 지키는 유일한 종이.
   벽에 걸어 두면 농담이 한 겹 는다: 사무실에서 제일 격식 있는 물건이 제일 거짓말이다. */
export function certificate(){
  const g = group(
    box(0.42, 0.54, 0.05, PAL.glow, 0, 0, 0),            // 금테
    box(0.35, 0.47, 0.03, PAL.paper, 0, 0, 0.03),
  );
  if (!rich()) return g;
  g.add(box(0.22, 0.035, 0.012, PAL.ink, 0, 0.17, 0.045));
  for (let i = 0; i < 4; i++)
    g.add(box(0.24 - (i % 2) * 0.06, 0.016, 0.012, PAL.metalDark, 0, 0.07 - i * 0.05, 0.045));
  const seal = stub(0.048, 0.048, 0.014, PAL.fabric2, 10);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0.09, -0.15, 0.048);
  g.add(seal);
  return g;
}

/* 포스터 — 액자가 없다. 테이프로 붙인 종이라 사무실이 조금 허름해진다 */
export function poster(v = 0){
  const g = group(box(0.40, 0.56, 0.02, PAL.paper, 0, 0, 0));
  const c = [PAL.fabric, PAL.leaf, PAL.fabric2, PAL.screen][v % 4];
  g.add(box(0.40, 0.20, 0.012, c, 0, 0.17, 0.012));
  if (rich()){
    g.add(box(0.26, 0.026, 0.012, PAL.ink, 0, -0.02, 0.012));
    g.add(box(0.19, 0.020, 0.012, PAL.metalDark, -0.03, -0.08, 0.012));
    for (const sx of [-1, 1])                            // 모서리 테이프
      for (const sy of [-1, 1])
        g.add(box(0.07, 0.05, 0.010, PAL.wallTrim, sx * 0.17, sy * 0.26, 0.018));
  }
  return g;
}

/* 환풍구 — 아무 뜻도 없지만 있으면 벽이 건물이 된다 */
export function vent(){
  const g = group(box(0.36, 0.26, 0.05, PAL.metalDark, 0, 0, 0),
                  box(0.30, 0.20, 0.03, PAL.metal, 0, 0, 0.02));
  for (let i = 0; i < 4; i++)
    g.add(box(0.28, 0.022, 0.02, PAL.metalDark, 0, 0.07 - i * 0.045, 0.036));
  return g;
}

/* 벽 배관 — 정제실이 있는 회사다. 사무실 벽에 파이프가 지나가는 게 어울린다.
   y=1.5 에 걸리는 것을 전제로 안에서 내려 둔다(바닥부터 벽 위까지). */
export function pipes(){
  const g = new THREE.Group();
  const H = 1.70, y0 = -1.35;          // y=1.5 에 걸리는 것을 전제로 바닥 근처까지 내린다
  for (const [x, r, c] of [[-0.10, 0.045, PAL.metalDark], [0.06, 0.032, PAL.metal]]){
    const p = stub(r, r, H, c, 8);
    p.position.set(x, y0 + H / 2, 0.05);
    g.add(p);
    for (let i = 0; i < 3; i++)                          // 브래킷
      g.add(box(r * 3.4, 0.05, 0.10, PAL.wallTrim, x, y0 + 0.28 + i * 0.62, 0.03));
  }
  const valve = stub(0.075, 0.075, 0.035, PAL.fabric2, 8);
  valve.rotation.x = Math.PI / 2;
  valve.position.set(-0.10, y0 + 1.02, 0.10);
  g.add(valve);
  return g;
}

/* 소화기 — 벽에 걸린 표지 + 통. 사무실이라는 말을 가장 싸게 하는 물건 */
export function fireExt(){
  const g = new THREE.Group();
  g.add(box(0.22, 0.22, 0.03, PAL.fabric2, 0, 0.34, 0.02));      // 표지판
  g.add(box(0.14, 0.14, 0.012, PAL.paper, 0, 0.34, 0.038));
  const body = stub(0.075, 0.085, 0.34, PAL.fabric2, 9);
  body.position.set(0, 0.02, 0.11);
  g.add(body);
  g.add(box(0.06, 0.09, 0.06, PAL.metalDark, 0, 0.22, 0.11));    // 목
  g.add(box(0.13, 0.03, 0.04, PAL.ink, 0.02, 0.25, 0.11));       // 손잡이
  g.add(box(0.19, 0.04, 0.09, PAL.wallTrim, 0, -0.15, 0.09));    // 받침
  return g;
}

/* 콘센트·스위치 — 손톱만 한 것들. 한 칸에 하나씩 깔면 벽이 벽지에서 벽이 된다 */
export function outlet(kind = 0){
  const c = kind ? PAL.paper : PAL.wallTrim;
  const g = group(box(0.13, 0.17, 0.03, c, 0, 0, 0));
  if (kind) g.add(box(0.07, 0.09, 0.02, PAL.wallTrim, 0, 0, 0.02));
  else {
    g.add(box(0.028, 0.028, 0.02, PAL.ink, -0.028, 0.015, 0.02));
    g.add(box(0.028, 0.028, 0.02, PAL.ink,  0.028, 0.015, 0.02));
  }
  return g;
}

/* ---------- 생활의 흔적 ---------- */
export function mug(color = PAL.fabric2){
  return group(
    box(0.12, 0.14, 0.12, color, 0, 0.07, 0),
    box(0.04, 0.07, 0.03, color, 0.08, 0.08, 0),
    box(0.09, 0.02, 0.09, PAL.woodDark, 0, 0.13, 0),
  );
}
export function cardboard(open = true){
  const g = group(box(0.56, 0.06, 0.56, PAL.wood, 0, 0.03, 0));
  const h = 0.34;
  g.add(
    box(0.56, h, 0.06, PAL.wood, 0, h / 2, -0.25),
    box(0.56, h, 0.06, PAL.wood, 0, h / 2,  0.25),
    box(0.06, h, 0.56, PAL.wood, -0.25, h / 2, 0),
    box(0.06, h, 0.56, PAL.wood,  0.25, h / 2, 0),
  );
  if (!open) g.add(box(0.58, 0.05, 0.58, PAL.woodDark, 0, h + 0.02, 0));
  return g;
}
export function cushion(color = PAL.fabric){
  const c = box(0.52, 0.14, 0.52, color, 0, 0.07, 0);
  return group(c);
}
export function blanket(color = PAL.fabric2){
  return group(
    box(0.60, 0.10, 0.46, color, 0, 0.05, 0),
    box(0.50, 0.09, 0.38, color, 0.04, 0.14, 0.02),
    box(0.38, 0.08, 0.30, color, -0.02, 0.22, -0.02),
  );
}
export function snackBowl(){
  return group(
    box(0.30, 0.10, 0.30, PAL.metal, 0, 0.05, 0),
    box(0.22, 0.06, 0.22, PAL.pot, 0, 0.10, 0),
  );
}

/* ============================================================
   비품 — 하나씩 다른 물건으로.

   전에는 복합기·건조실·헬스장·정제실이 전부 자판기 하나로 그려졌다.
   격자에서는 다른 타일이고 게임에서도 효과가 다른데 화면에서는 같은 물건이라,
   사무실을 꾸며도 꾸민 티가 안 났다. 비품은 사서 놓는 게 전부인 축이므로
   **눈에 달라 보이는 것이 곧 그 축의 재미**다.
   ============================================================ */

/* 복합기 — 납작하고 넓다. 급지 트레이와 배출구가 얼굴이다. */
export function copier(){
  const g = group(
    box(0.78, 0.62, 0.62, PAL.metal,     0, 0.31, 0),
    box(0.82, 0.07, 0.66, PAL.metalDark, 0, 0.66, 0),
    box(0.50, 0.05, 0.30, PAL.paper,     0, 0.71, 0.06),
    box(0.62, 0.04, 0.34, PAL.metalDark, 0, 0.44, 0.34),
  );
  if (rich()) g.add(
    box(0.24, 0.10, 0.05, PAL.screen,    0.22, 0.58, 0.32),
    box(0.66, 0.10, 0.36, PAL.metalDark, 0, 0.12, 0.36),
    box(0.58, 0.03, 0.30, PAL.paper,     0, 0.18, 0.38),
  );
  return g;
}

/* CD 플레이어 — 낮은 받침 위의 소형 하이파이.
   위에서 내려다보는 카메라라 **상판이 이 물건의 얼굴**이다. 그래서 뚜껑의 은색 원반과
   가운데 구멍을 제일 크게 두고, 앞면에는 켜져 있다는 표시(표시창)와 스피커 둘만 남겼다.
   벽에 등을 대고 서므로(render3d 의 toWall) 뒷면은 아무것도 없다. */
export function cdPlayer(){
  const g = group(
    box(0.68, 0.09, 0.46, PAL.woodDark,  0, 0.045, 0),      // 받침
    box(0.60, 0.32, 0.40, PAL.metal,     0, 0.25,  0),      // 본체
    box(0.66, 0.05, 0.46, PAL.metalDark, 0, 0.43,  0),      // 상판
  );
  /* 뚜껑 — 은색 원반. 이 각도에서 제일 잘 보이는 면이다 */
  const lid = ellip(0.30, 0.05, 0.30, PAL.paper, 1);
  lid.position.set(0, 0.47, -0.02);
  const hub = ellip(0.08, 0.05, 0.08, PAL.metalDark, 1);
  hub.position.set(0, 0.49, -0.02);
  g.add(lid, hub);
  /* 앞면 — 켜져 있다는 표시 하나. 없으면 그냥 상자다 */
  g.add(box(0.30, 0.06, 0.03, PAL.glow, 0, 0.33, 0.205));
  if (rich()){
    for (const x of [-0.17, 0.17]){
      const sp = ellip(0.13, 0.13, 0.04, PAL.metalDark, 1);
      sp.position.set(x, 0.19, 0.205);
      g.add(sp);
    }
    g.add(box(0.08, 0.02, 0.03, PAL.metalDark, 0, 0.24, 0.205));   // 재생 버튼
  }
  return g;
}

/* 사내 오락기 — 세로형 아케이드 기체.
   낮은 TV + 콘솔로도 만들 수 있었지만, 위에서 내려다보는 카메라에서 낮은 물건은
   **상자 하나**로 읽힌다(CD 플레이어가 원반 하나로 버티는 이유가 그것이다).
   세로형은 마퀴·화면·조작판이 세 층으로 겹쳐서, 이 각도에서도 「게임기」로 읽힌다.

   키를 1.52 로 잘랐다 — 건조실(1.63)보다 낮게. 이보다 높으면 뒤쪽 고양이를 가리고,
   그건 분위기가 아니라 정보 손실이다(22번에서 안개를 재던 것과 같은 기준).

   화면에 userData.screen 을 찍어 둔다. render3d 가 그걸 보고 시간대 발광을 맡는다 —
   밤에 혼자 켜져 있는 화면이 이 물건의 전부이고, 그걸 플랫한 색으로 두면 꺼진 기계다. */
export function arcade(){
  const g = group(
    box(0.66, 0.08, 0.54, PAL.metalDark, 0, 0.04, 0),        // 받침
    box(0.60, 0.72, 0.48, PAL.fabric,    0, 0.44, 0),        // 하부 캐비닛
    box(0.62, 0.56, 0.36, PAL.fabric,    0, 1.10, -0.06),    // 상체
    box(0.64, 0.14, 0.38, PAL.glow,      0, 1.45, -0.06),    // 마퀴 — 켜져 있다
  );
  /* 조작판 — 앞으로 튀어나온 비스듬한 판. 이 한 조각이 캐비닛과 냉장고를 가른다. */
  const panel = box(0.62, 0.09, 0.30, PAL.metalDark, 0, 0.82, 0.20);
  panel.rotation.x = -0.28;
  g.add(panel);
  /* 화면 — 상체 앞면에 얹는다(상체 앞면이 z = -0.06 + 0.18 = 0.12) */
  const scr = box(0.44, 0.38, 0.03, PAL.screenOn, 0, 1.12, 0.125);
  scr.userData.screen = true;
  g.add(scr);
  if (rich()){
    /* 조이스틱 둘 — 두 마리가 같이 붙는다는 뜻이고, 이 가구를 산 이유가 그것이다 */
    for (const x of [-0.15, 0.15]){
      g.add(box(0.03, 0.11, 0.03, PAL.metalDark, x, 0.90, 0.17));
      const kn = ellip(0.05, 0.05, 0.05, PAL.fabric2, 1);
      kn.position.set(x, 0.96, 0.16);
      g.add(kn);
    }
    /* 버튼 넷과 동전 투입구 */
    for (const [x, z] of [[-0.06, 0.24], [0.03, 0.25], [0.24, 0.22], [-0.27, 0.22]])
      g.add(box(0.05, 0.03, 0.05, PAL.fabric2, x, 0.86, z));
    g.add(box(0.10, 0.02, 0.03, PAL.paper, 0, 0.62, 0.245));
  }
  return g;
}

/* 건조실 — 세로로 긴 통에 둥근 문. 따뜻해서 인기라는 설정이라 창이 빛난다. */
export function dryer(){
  const g = group(
    box(0.68, 1.55, 0.60, PAL.metal,     0, 0.78, 0),
    box(0.72, 0.08, 0.64, PAL.metalDark, 0, 1.57, 0),
  );
  const glass = ellip(0.44, 0.44, 0.10, PAL.metalDark, 1);
  glass.position.set(0, 0.92, 0.30);
  const lit = ellip(0.34, 0.34, 0.08, PAL.glow, 1);
  lit.position.set(0, 0.92, 0.33);
  g.add(glass, lit);
  if (rich()) for (let i = 0; i < 3; i++)
    g.add(box(0.46, 0.04, 0.03, PAL.metalDark, 0, 0.30 + i * 0.09, 0.31));
  return g;
}

/* 정제실 — 통 두 개와 파이프. 이 회사가 실제로 하는 일이다. */
export function refinery(){
  const g = group(box(0.80, 0.24, 0.66, PAL.metalDark, 0, 0.12, 0));
  const tankA = stub(0.20, 0.22, 0.90, PAL.metal, 8);
  tankA.position.set(-0.20, 0.69, 0);
  const tankB = stub(0.15, 0.17, 0.66, PAL.metal, 8);
  tankB.position.set(0.22, 0.57, 0.04);
  const nip = ellip(0.30, 0.16, 0.30, PAL.catnip, 1);
  nip.position.set(-0.20, 1.16, 0);
  g.add(tankA, tankB, nip, box(0.40, 0.06, 0.06, PAL.metalDark, 0.01, 0.98, 0));
  if (rich()) g.add(
    box(0.10, 0.10, 0.10, PAL.fabric2, 0.22, 0.92, 0),
    box(0.52, 0.05, 0.05, PAL.metalDark, 0, 0.34, 0.30),
  );
  return g;
}

/* 헬스장 — 벤치와 원판. 고양이가 쓸 리 없지만 사무실에는 늘 있다. */
export function gymRig(){
  const g = group(
    box(0.86, 0.10, 0.34, PAL.fabric,    0, 0.44, 0),
    box(0.12, 0.42, 0.12, PAL.metalDark, -0.32, 0.21, 0),
    box(0.12, 0.42, 0.12, PAL.metalDark,  0.32, 0.21, 0),
    box(0.06, 0.72, 0.06, PAL.metalDark, -0.44, 0.36, -0.28),
    box(0.06, 0.72, 0.06, PAL.metalDark,  0.44, 0.36, -0.28),
    box(0.96, 0.06, 0.06, PAL.metal,     0, 0.70, -0.28),
  );
  if (rich()) [-0.40, 0.40].forEach(x => {
    const d = ellip(0.26, 0.26, 0.08, PAL.metalDark, 1);
    d.position.set(x, 0.70, -0.28);
    d.rotation.y = Math.PI / 2;
    g.add(d);
  });
  return g;
}

/* 사내 로켓 — 진지하게 만들면 농담이 죽는다. 고깔에 지느러미 셋. */
export function rocket(){
  const body = stub(0.20, 0.30, 1.30, PAL.paper, 8);
  body.position.y = 0.65;
  const tip = cone(0.30, 0.46, PAL.fabric2, 8);
  tip.position.y = 1.53;
  const g = group(body, tip);
  for (let i = 0; i < 3; i++){
    const a = i * (Math.PI * 2 / 3);
    const f = box(0.06, 0.34, 0.30, PAL.fabric2, Math.sin(a) * 0.24, 0.20, Math.cos(a) * 0.24);
    f.rotation.y = a;
    g.add(f);
  }
  if (rich()){
    const port = ellip(0.18, 0.18, 0.06, PAL.sky, 1);
    port.position.set(0, 1.05, 0.28);
    g.add(port);
  }
  return g;
}

/* 자동급식기 — 위에 사료통, 아래에 그릇. 정수기와 헷갈리면 안 된다. */
export function feeder(){
  const hopper = stub(0.16, 0.22, 0.60, 0xE8CBA0, 8);
  hopper.position.y = 0.72;
  const g = group(
    box(0.46, 0.30, 0.42, PAL.metalDark, 0, 0.15, 0),
    hopper,
    box(0.40, 0.08, 0.36, PAL.metal, 0, 0.34, 0.02),
    box(0.34, 0.10, 0.28, PAL.metal, 0, 0.06, 0.26),
    box(0.26, 0.05, 0.20, PAL.pot,   0, 0.10, 0.27),
  );
  if (rich()) g.add(box(0.30, 0.04, 0.04, PAL.screenOn, 0, 0.30, 0.22));
  return g;
}

/* 스크래처 — 기둥에 감은 노끈. 밑동에 부스러기. */
export function scratcher(){
  const post = stub(0.15, 0.17, 0.92, 0xD9C08A, 8);
  post.position.y = 0.54;
  const g = group(box(0.60, 0.08, 0.60, PAL.woodDark, 0, 0.04, 0), post);
  if (rich()){
    for (let i = 0; i < 5; i++)
      g.add(box(0.36, 0.03, 0.36, PAL.wood, 0, 0.20 + i * 0.16, 0));
    const ball = ellip(0.16, 0.16, 0.16, PAL.fabric2, 0);
    ball.position.set(0.22, 0.12, 0.18);
    g.add(ball);
  }
  return g;
}

/* 회의 테이블 — 둥근 상판에 다리 하나. 책상과 실루엣이 달라야 한다. */
export function meetingTable(){
  const top = ellip(1.50, 0.10, 1.10, PAL.wood, 1);
  top.position.y = 0.66;
  const leg = stub(0.12, 0.22, 0.62, PAL.metalDark, 8);
  leg.position.y = 0.33;
  const foot = ellip(0.70, 0.08, 0.60, PAL.metalDark, 1);
  foot.position.y = 0.04;
  const g = group(top, leg, foot);
  if (rich()) g.add(
    box(0.26, 0.03, 0.20, PAL.paper, -0.34, 0.72, 0.10),
    box(0.12, 0.14, 0.12, PAL.fabric2, 0.36, 0.78, -0.06),
  );
  return g;
}

/* 간식바 — 유리병 몇 개 올린 낮은 선반. 탕비실 물건. */
export function snackBar(){
  const g = group(
    box(0.92, 0.08, 0.44, PAL.wood, 0, 0.60, 0),
    box(0.08, 0.60, 0.40, PAL.woodDark, -0.42, 0.30, 0),
    box(0.08, 0.60, 0.40, PAL.woodDark,  0.42, 0.30, 0),
    box(0.86, 0.06, 0.40, PAL.wood, 0, 0.30, 0),
  );
  if (!rich()) return g;
  [PAL.pot, PAL.catnip, PAL.fabric2, 0xE8CBA0].forEach((c, i) => {
    const x = -0.30 + i * 0.20;
    const jar = stub(0.10, 0.12, 0.22, c, 7);
    jar.position.set(x, 0.75, 0);
    g.add(jar, box(0.16, 0.04, 0.16, PAL.metalDark, x, 0.87, 0));
  });
  return g;
}

/* 해먹 — 기둥 둘 사이에 늘어진 천. 자는 자리다.
   천은 판 세 장으로 흉내낸다. 곡면을 만들면 로우폴리에서 혼자 겉돈다. */
export function hammock(){
  const g = group(
    box(0.14, 0.86, 0.14, PAL.woodDark, -0.40, 0.43, 0),
    box(0.14, 0.86, 0.14, PAL.woodDark,  0.40, 0.43, 0),
    box(0.16, 0.06, 0.52, PAL.woodDark, -0.40, 0.02, 0),
    box(0.16, 0.06, 0.52, PAL.woodDark,  0.40, 0.02, 0),
  );
  [[-0.26, 0.62, 0.20], [0, 0.50, 0], [0.26, 0.62, -0.20]].forEach(([x, y, r], i) => {
    const c = box(0.34, 0.07, 0.46, i === 1 ? PAL.fabric2 : PAL.fabric, x, y, 0);
    c.rotation.z = r;
    g.add(c);
  });
  g.userData.perchY = 0.56;
  return g;
}

/* ============================================================
   벽 쉼터 — 고양이가 벽을 타고 올라가 쉬는 자리.

   고양이 회사인데 고양이가 바닥으로만 다니는 건 이상하다. 실용적인 이득도 있다:
   바닥이 가구로 꽉 차도 벽 위는 비어 있고, 위에 앉은 고양이는 책상·의자에 안 가린다.

   격자에서는 벽에 붙은 **바닥 한 칸**을 차지한다. 그래야 길찾기가 그대로 돌고
   (고양이는 그 칸까지 걸어가기만 하면 된다), 렌더러가 그 칸의 고양이를 선반 위로 올린다.
   2D 격자에 없던 축을 렌더러가 격자에서 유도하는 것 — 캣타워와 같은 방식이다.
   ============================================================ */
export function wallPerch(){
  const g = group(
    box(0.20, 1.30, 0.24, PAL.woodDark, 0, 0.65, -0.34),
    box(0.76, 0.09, 0.46, PAL.wood, 0, 1.02, -0.02),
    box(0.60, 0.09, 0.40, PAL.wood, 0.10, 0.62, -0.06),
    box(0.44, 0.09, 0.36, PAL.wood, -0.14, 0.30, -0.08),
  );
  if (rich()) g.add(
    box(0.56, 0.10, 0.34, PAL.fabric2, 0, 1.11, -0.02),
    box(0.80, 0.05, 0.05, PAL.woodDark, 0, 1.09, 0.20),
  );
  g.userData.perchY = 1.16;
  return g;
}

/* ---------- 놀잇감 ----------
   작고 값싸고, 무엇보다 **고양이가 자리를 뜰 이유**다. 바닥에 굴러다니는 물건이라
   다른 가구처럼 세우지 않고 낮게 깐다 — 시야를 안 가려야 그 위에서 노는 게 보인다. */
export function yarnBall(){
  const g = new THREE.Group();
  const b = ellip(0.34, 0.34, 0.34, PAL.toy, 1);
  b.position.set(0, 0.18, 0);
  g.add(b,
    box(0.40, 0.03, 0.03, 0xE0707F, 0, 0.23, 0.02),
    box(0.03, 0.03, 0.40, 0xE0707F, 0.02, 0.27, 0));
  if (rich()) g.add(
    box(0.28, 0.02, 0.02, 0xF6C6CE, 0, 0.31, -0.06),
    /* 풀린 실 한 가닥 — 이게 있어야 "굴리던 것" 으로 읽힌다 */
    box(0.34, 0.02, 0.02, 0xE0707F, 0.30, 0.02, 0.10),
    box(0.02, 0.02, 0.26, 0xE0707F, 0.46, 0.02, 0.22));
  return g;
}

export function featherToy(){
  const base = stub(0.13, 0.15, 0.05, PAL.woodDark);
  base.position.set(0, 0.025, 0);
  const g = group(base, box(0.045, 0.86, 0.045, PAL.wood, 0, 0.45, 0));
  /* 깃털은 끝에서 살짝 늘어뜨린다. 똑바로 서 있으면 막대기지 장난감이 아니다. */
  const head = ellip(0.14, 0.12, 0.14, PAL.leaf, 0);
  head.position.set(0, -0.02, 0.26);
  const tip = group(box(0.03, 0.03, 0.24, PAL.woodDark, 0, 0, 0.12), head);
  tip.position.set(0, 0.86, 0);
  tip.rotation.x = -0.35;
  g.add(tip);
  if (rich()){
    const f = group(
      box(0.18, 0.02, 0.10, PAL.leafDark, 0, 0, 0.06),
      box(0.12, 0.02, 0.08, PAL.leaf, 0.02, 0.03, 0.14));
    f.position.set(0, 0.80, 0.24);
    f.rotation.z = 0.4;
    g.add(f);
  }
  return g;
}

/* ---------- 책상 위 소품 ----------
   책상이 휑하면 사무실이 "가구를 배치한 곳"으로만 보인다. 잔물건이 얹혀야
   "쓰는 책상"이 된다. 전부 작고 값싸다 — 어차피 정적 병합으로 한 덩어리가 된다. */
export function keyboard(){
  const g = group(box(0.46, 0.03, 0.17, PAL.metal, 0, 0.015, 0));
  if (rich()) for (let i = 0; i < 3; i++)
    g.add(box(0.40, 0.012, 0.035, PAL.metalDark, 0, 0.035, -0.05 + i * 0.05));
  return g;
}
/* 마우스 — 키보드는 있는데 마우스가 없었다. 자리마다 하나씩 늘 놓는다 */
export function mouse(){
  const g = group(box(0.10, 0.035, 0.15, PAL.metal, 0, 0.018, 0));
  g.add(box(0.09, 0.02, 0.13, PAL.wallTrim, 0, 0.04, 0));
  g.add(box(0.012, 0.008, 0.05, PAL.metalDark, 0, 0.05, -0.03));
  return g;
}

/* 탁상 액자 — 남의 책상에 놓인 사진만큼 "여기 누가 산다"고 말하는 물건이 없다 */
export function deskFrame(){
  const g = group(
    box(0.15, 0.19, 0.02, PAL.woodDark, 0, 0.10, 0),
    box(0.11, 0.145, 0.012, PAL.sky, 0, 0.105, 0.014),
  );
  g.add(box(0.055, 0.055, 0.01, PAL.wood, 0, 0.095, 0.021));   // 사진 속 고양이
  g.add(box(0.018, 0.03, 0.01, PAL.wood, -0.019, 0.128, 0.021));
  g.add(box(0.018, 0.03, 0.01, PAL.wood,  0.019, 0.128, 0.021));
  const leg = box(0.03, 0.11, 0.02, PAL.woodDark, 0, 0.055, -0.045);
  leg.rotation.x = -0.35;
  g.add(leg);
  return g;
}

/* 스테이플러 — 도장을 찍는 회사에 스테이플러가 없을 수 없다 */
export function stapler(){
  return group(
    box(0.07, 0.035, 0.20, PAL.metalDark, 0, 0.018, 0),
    box(0.06, 0.04, 0.17, PAL.fabric2, 0, 0.052, 0.012),
    box(0.05, 0.018, 0.05, PAL.metal, 0, 0.075, -0.055),
  );
}

export function penCup(){
  const g = group(stub(0.055, 0.05, 0.13, PAL.fabric, 7));
  g.children[0].position.y = 0.065;
  if (rich()) [[0.015, 0.02, 0xE06A6A], [-0.02, -0.01, 0x4C6EF5], [0.005, -0.02, 0x3A342E]]
    .forEach(([dx, dz, c], i) => {
      const pen = box(0.014, 0.16, 0.014, c, dx, 0.15, dz);
      pen.rotation.z = (i - 1) * 0.16;
      g.add(pen);
    });
  return g;
}
export function sticky(n = 3){
  const g = new THREE.Group();
  const cols = [0xFFE9A8, 0xFFC7C7, 0xC9E8FF];
  for (let i = 0; i < n; i++){
    const s = box(0.085, 0.006, 0.085, cols[i % cols.length], (i % 2) * 0.02, 0.004 + i * 0.008, (i % 3) * 0.015);
    s.rotation.y = (i % 4) * 0.25;
    g.add(s);
  }
  return g;
}
export function succulent(){
  const g = group(box(0.11, 0.10, 0.11, PAL.pot, 0, 0.05, 0));
  const leaf = (x, z, r) => {
    const l = box(0.09, 0.035, 0.05, PAL.leaf, x, 0.115, z);
    l.rotation.set(0, r, 0.3);
    return l;
  };
  g.add(leaf(0.02, 0, 0.4), leaf(-0.02, 0.01, -1.1));
  if (rich()) g.add(leaf(0, -0.02, 2.2));
  return g;
}

/* ---------- 방 ----------
   벽을 네 덩어리로 따로 만든다. 카메라를 돌리면 앞벽이 씬을 가리기 때문에
   면마다 통째로 껐다 켤 수 있어야 한다 (2D 에서 "양옆 벽을 안 그리던" 트릭의 3D 판). */
/* ============================================================
   가구 카탈로그 (2026-09-01)

   레퍼런스로 받은 「사무실 가구 목록」 한 장을 그대로 구현한 것들이다. 다섯 분류
   ― 업무 · 수납 · 데코 · 휴식 · 바닥/벽 ― 인데, 절반은 이미 이 파일에 있었다
   (책상 · 의자 · 책장 · 화이트보드 · 화분 · 시계 · 액자 · 정수기 · 커피머신 ·
   러그 · 블라인드 · 벽 선반 · 스탠드 조명 · 탁상 조명 · 캔들 · 포스터 · 박스 · 펜 홀더).
   여기 있는 것은 **없던 것들**이다.

   ── 이 한 벌을 관통하는 규칙 셋 ──

   1. **위에서 내려다보는 화면이다.** 조명 한 벌에서 세 번 걸린 그 규칙이 가구에도
      그대로 걸린다 — 뚜껑이 몸통보다 넓으면 위에서 그 뚜껑만 보인다. 서랍장의 상판,
      락커의 천장, 소파의 등받이가 전부 이 문제를 갖고 있어서 넓이를 몸통에 맞췄다.

   2. **정면에 선이 하나는 있어야 한다.** 로우폴리에서 상자 하나는 상자로 보인다.
      서랍 손잡이 · 문틈 · 쿠션 이음새 — 면을 가르는 선이 하나 들어가야 그게 가구가 된다.
      rich() 가 꺼진 판(저사양)에서는 그 선들만 빠지고 덩치는 남는다.

   3. **색은 팔레트에서만 가져온다.** 벽지·바닥 톤을 갈면 가구도 같이 가야 하는데
      (decor.js 의 pal()), 여기서 색을 직접 쓰면 그 가구만 옛 톤으로 남는다.
      예외는 잎(leaf)과 장난감(toy) 둘뿐이고 그건 팔레트가 이미 그렇게 정해 뒀다.
   ============================================================ */

/* ---------- 업무 ---------- */

/* 서랍장 — 책상 옆에 붙는 낮은 3단. 상판이 몸통보다 **한 뼘만** 넓다.
   많이 넓히면 위에서 상판만 보이고 서랍이 안 읽힌다(규칙 1). */
export function drawerUnit(){
  const g = group(
    box(0.62, 0.06, 0.50, PAL.wood,     0, 0.69, 0),      // 상판
    box(0.58, 0.66, 0.46, PAL.woodDark, 0, 0.33, 0),
    box(0.50, 0.05, 0.44, PAL.woodDark, 0, 0.03, 0),      // 굽
  );
  if (!rich()) return g;
  for (let i = 0; i < 3; i++){
    const y = 0.16 + i * 0.21;
    g.add(box(0.50, 0.17, 0.03, PAL.wood, 0, y, 0.235));   // 서랍 앞판
    g.add(box(0.18, 0.03, 0.03, PAL.metal, 0, y, 0.255));  // 손잡이
  }
  return g;
}

/* 파일 캐비닛 — 서랍장의 키 큰 형제. 금속이고 4단이라 실루엣이 확실히 다르다.
   둘이 같은 나무 상자면 목록에서 두 줄을 쓸 이유가 없다. */
export function fileCabinet(){
  const g = group(
    box(0.54, 1.32, 0.48, PAL.metal,     0, 0.66, 0),
    box(0.58, 0.05, 0.52, PAL.metalDark, 0, 1.32, 0),      // 천장 테
    box(0.50, 0.04, 0.44, PAL.metalDark, 0, 0.02, 0),
  );
  if (!rich()) return g;
  for (let i = 0; i < 4; i++){
    const y = 0.22 + i * 0.30;
    g.add(box(0.46, 0.26, 0.02, PAL.metalDark, 0, y, 0.245));
    g.add(box(0.14, 0.035, 0.03, PAL.paper, 0, y + 0.06, 0.26));   // 라벨 홀더
  }
  return g;
}

/* 회의용 의자 — 사무 의자(chair)와 달리 바퀴가 없고 다리가 넷이다.
   회의탁자에 딸려 오는 물건이라 등받이가 낮고 팔걸이가 있다. */
export function meetChair(turn = 0){
  const g = group(
    box(0.42, 0.07, 0.42, PAL.fabric,    0, 0.44, 0),
    box(0.40, 0.36, 0.07, PAL.fabric,    0, 0.64, -0.18),
    box(0.06, 0.44, 0.06, PAL.metalDark, -0.16, 0.22, -0.14),
    box(0.06, 0.44, 0.06, PAL.metalDark,  0.16, 0.22, -0.14),
    box(0.06, 0.44, 0.06, PAL.metalDark, -0.16, 0.22,  0.14),
    box(0.06, 0.44, 0.06, PAL.metalDark,  0.16, 0.22,  0.14),
  );
  if (rich()){
    g.add(box(0.05, 0.05, 0.34, PAL.metalDark, -0.21, 0.60, -0.02));
    g.add(box(0.05, 0.05, 0.34, PAL.metalDark,  0.21, 0.60, -0.02));
  }
  g.rotation.y = turn;
  return g;
}

/* ---------- 수납 ---------- */

/* 락커 — 세 짝. **문틈이 이 물건의 전부다**(규칙 2): 문틈이 없으면 회색 기둥이다. */
export function locker(){
  const g = group(
    box(0.92, 1.50, 0.44, PAL.metal,     0, 0.75, 0),
    box(0.96, 0.05, 0.48, PAL.metalDark, 0, 1.50, 0),
    box(0.88, 0.06, 0.40, PAL.metalDark, 0, 0.03, 0),
  );
  if (!rich()) return g;
  for (let i = 0; i < 3; i++){
    const x = -0.30 + i * 0.30;
    g.add(box(0.015, 1.36, 0.02, PAL.metalDark, x + 0.15, 0.78, 0.225));  // 문틈
    g.add(box(0.03, 0.10, 0.03, PAL.metalDark, x + 0.09, 0.86, 0.235));   // 손잡이
    g.add(box(0.12, 0.02, 0.02, PAL.metalDark, x, 1.34, 0.235));          // 통풍구
  }
  return g;
}

/* 수납장 — 미닫이 두 짝짜리 낮은 장. 위에 물건을 올릴 수 있어 보여야 해서
   상판을 두껍게 뽑았다(락커와 실루엣을 가르는 것도 그 상판이다). */
export function cabinet(){
  const g = group(
    box(1.00, 0.08, 0.50, PAL.woodDark, 0, 0.86, 0),
    box(0.94, 0.78, 0.46, PAL.metal,    0, 0.43, 0),
    box(0.88, 0.06, 0.40, PAL.metalDark,0, 0.03, 0),
  );
  if (!rich()) return g;
  g.add(box(0.44, 0.62, 0.02, PAL.wood, -0.23, 0.44, 0.235));
  g.add(box(0.44, 0.62, 0.02, PAL.wood,  0.23, 0.44, 0.235));
  g.add(box(0.03, 0.20, 0.03, PAL.metalDark, -0.03, 0.44, 0.25));
  g.add(box(0.03, 0.20, 0.03, PAL.metalDark,  0.03, 0.44, 0.25));
  return g;
}

/* 오픈 선반 — 문이 없다. 그래서 **선반 사이가 비어 보여야** 하고, 그 빈 칸이
   이 가구의 그림이다. 뒤판을 안 대는 이유도 같다. */
export function openShelf(){
  const g = group(
    box(0.06, 1.10, 0.40, PAL.metalDark, -0.42, 0.55, 0),
    box(0.06, 1.10, 0.40, PAL.metalDark,  0.42, 0.55, 0),
  );
  for (let i = 0; i < 3; i++)
    g.add(box(0.90, 0.05, 0.40, PAL.wood, 0, 0.12 + i * 0.42, 0));
  if (!rich()) return g;
  /* 올려 둔 것들 — 상자와 서류철. 빈 선반은 「아직 안 쓰는 가구」로 보인다. */
  const cs = [PAL.pot, PAL.fabric2, PAL.leafDark, PAL.fabric];
  for (let i = 0; i < 5; i++){
    const s = i % 3, x = -0.28 + (i % 3) * 0.28 + (i > 2 ? 0.12 : 0);
    g.add(box(0.20, 0.20, 0.26, cs[i % cs.length], x, 0.25 + (i > 2 ? 0.42 : 0), 0));
  }
  return g;
}

/* 책꽂이 — 비스듬한 잡지꽂이. 선반과 겹치지 않는 유일한 길이 **기울기**였다.
   똑바로 세우면 오픈 선반의 축소판이 되고, 그러면 목록에서 두 줄이 같은 그림이다. */
export function bookRack(){
  const g = group(
    box(0.80, 0.06, 0.44, PAL.woodDark, 0, 0.03, 0),
    box(0.06, 0.62, 0.44, PAL.woodDark, -0.37, 0.34, 0),
    box(0.06, 0.62, 0.44, PAL.woodDark,  0.37, 0.34, 0),
  );
  const back = box(0.74, 0.60, 0.05, PAL.wood, 0, 0.36, -0.14);
  back.rotation.x = -0.30;
  g.add(back);
  if (!rich()) return g;
  const spines = [PAL.fabric, PAL.fabric2, PAL.leafDark, PAL.pot, PAL.screen];
  for (let i = 0; i < 5; i++){
    const b = box(0.13, 0.30, 0.04, spines[i % spines.length], -0.28 + i * 0.14, 0.32, 0.02);
    b.rotation.x = -0.30;
    g.add(b);
  }
  return g;
}

/* 서류 트레이 — 책상 위에 올리는 3단. 이 목록에서 제일 작은 물건이라
   칸을 통째로 먹으면 이상하고, **아래의 deskTop 이 책상에 얹는다.** */
export function paperTray(){
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++){
    const y = 0.03 + i * 0.075;
    g.add(box(0.30, 0.015, 0.24, PAL.metalDark, 0, y, 0));
    g.add(box(0.03, 0.06, 0.03, PAL.metalDark, -0.13, y + 0.035, -0.10));
    g.add(box(0.03, 0.06, 0.03, PAL.metalDark,  0.13, y + 0.035, -0.10));
    if (rich() && i < 2) g.add(box(0.26, 0.02, 0.20, PAL.paper, 0, y + 0.02, 0.01));
  }
  return g;
}

/* 휴지통 — 위로 벌어진 원통. 아래가 좁아야 「통」이고, 똑바르면 그건 파이프다. */
export function trashBin(){
  const g = new THREE.Group();
  const body = stub(0.17, 0.13, 0.36, PAL.metalDark, 8);
  body.position.y = 0.18;
  g.add(body);
  if (rich()){
    const rim = stub(0.18, 0.18, 0.03, PAL.metal, 8);
    rim.position.y = 0.36;
    g.add(rim, box(0.10, 0.10, 0.10, PAL.paper, 0.03, 0.38, 0.02));   // 삐져나온 종이
  }
  return g;
}

/* ---------- 데코 ---------- */

/* 화분 셋 — 크기만 다른 게 아니라 **잎이 다르다.** 같은 모양을 스케일만 바꿔 놓으면
   목록에서 세 줄이 한 물건이고, 방에 셋을 놓아도 하나를 세 번 놓은 것으로 보인다.
   plant() 가 이미 중간 것이므로 여기서는 작은 것과 큰 것만 만든다. */
export function plantSm(){
  const g = group(
    stubAt(0.11, 0.09, 0.16, PAL.pot, 0.08),
    box(0.24, 0.03, 0.24, PAL.pot, 0, 0.16, 0),
  );
  /* 다육식물 — 짧고 통통한 잎이 방사형. 큰 화분의 긴 잎과 정반대다. */
  for (let i = 0; i < 6; i++){
    const a = (i / 6) * Math.PI * 2;
    const l = box(0.06, 0.13, 0.06, i % 2 ? PAL.leaf : PAL.leafDark,
                  Math.cos(a) * 0.055, 0.24, Math.sin(a) * 0.055);
    l.rotation.z = Math.cos(a) * 0.5;
    l.rotation.x = -Math.sin(a) * 0.5;
    g.add(l);
  }
  return g;
}
export function plantLg(){
  const g = group(
    stubAt(0.26, 0.20, 0.42, PAL.pot, 0.21),
    box(0.56, 0.05, 0.56, PAL.pot, 0, 0.42, 0),
    box(0.09, 0.55, 0.09, PAL.leafDark, 0, 0.70, 0),      // 줄기
  );
  /* 긴 잎이 부채처럼. 여섯 장을 각각 다른 각으로 세워야 나무가 된다. */
  for (let i = 0; i < 6; i++){
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const l = box(0.12, 0.62, 0.05, i % 2 ? PAL.leaf : PAL.leafDark,
                  Math.cos(a) * 0.16, 0.98 + (i % 3) * 0.09, Math.sin(a) * 0.16);
    l.rotation.z = Math.cos(a) * 0.62;
    l.rotation.x = -Math.sin(a) * 0.62;
    g.add(l);
  }
  return g;
}
/* stub 은 원점 기준이라 위치를 따로 줘야 한다 — 화분마다 세 줄이 되므로 묶는다 */
function stubAt(rTop, rBot, h, color, y){
  const m = stub(rTop, rBot, h, color, 8);
  m.position.y = y;
  return m;
}

/* ---------- 휴식 ---------- */

/* 소파 — 1인과 2인. **쿠션 이음새가 정면의 선이다**(규칙 2).
   등받이를 좌판보다 살짝 뒤로 물려야 앉는 물건으로 보인다. */
function sofaBody(w){
  const g = group(
    box(w, 0.22, 0.72, PAL.woodDark, 0, 0.17, 0),                 // 몸통
    box(w, 0.34, 0.20, PAL.fabric,   0, 0.45, -0.26),             // 등받이
    box(0.18, 0.30, 0.68, PAL.fabric, -w / 2 + 0.09, 0.43, 0.02), // 팔걸이
    box(0.18, 0.30, 0.68, PAL.fabric,  w / 2 - 0.09, 0.43, 0.02),
  );
  const seatW = w - 0.36;
  if (!rich()){
    g.add(box(seatW, 0.14, 0.60, PAL.fabric, 0, 0.35, 0.04));
    return g;
  }
  const n = w > 1.1 ? 2 : 1;
  for (let i = 0; i < n; i++)
    g.add(box(seatW / n - 0.03, 0.15, 0.58, PAL.fabric,
              (i - (n - 1) / 2) * (seatW / n), 0.35, 0.04));
  for (let i = 0; i < 4; i++)
    g.add(box(0.07, 0.10, 0.07, PAL.woodDark,
              (i % 2 ? 1 : -1) * (w / 2 - 0.10), 0.05, (i < 2 ? -1 : 1) * 0.28));
  return g;
}
export function sofa1(){ return sofaBody(0.82); }
export function sofa2(){ return sofaBody(1.46); }

/* 안락 의자 — 소파 1인과 뭐가 다른가. **등받이가 높고 다리가 가늘다.**
   1인 소파가 「덩어리」라면 이쪽은 「의자」다. */
export function loungeChair(){
  const g = group(
    box(0.66, 0.14, 0.62, PAL.fabric2, 0, 0.44, 0.02),
    box(0.66, 0.58, 0.16, PAL.fabric2, 0, 0.72, -0.25),
    box(0.12, 0.24, 0.56, PAL.fabric2, -0.30, 0.56, 0.02),
    box(0.12, 0.24, 0.56, PAL.fabric2,  0.30, 0.56, 0.02),
  );
  for (let i = 0; i < 4; i++){
    const l = box(0.06, 0.40, 0.06, PAL.woodDark,
                  (i % 2 ? 1 : -1) * 0.24, 0.19, (i < 2 ? -1 : 1) * 0.22);
    l.rotation.z = (i % 2 ? -1 : 1) * 0.10;
    g.add(l);
  }
  return g;
}

/* 빈백 — 이 목록에서 유일하게 **모서리가 없는** 가구다. 상자로 만들면 그냥 상자라,
   정이십면체를 눌러서 쓴다. 위가 살짝 파여야 앉는 자리로 읽힌다. */
export function beanBag(){
  const g = new THREE.Group();
  const b = ellip(0.78, 0.52, 0.74, PAL.fabric, 1);
  b.position.y = 0.26;
  g.add(b);
  const top = ellip(0.52, 0.16, 0.50, PAL.fabric2, 1);
  top.position.set(0, 0.46, 0.04);
  g.add(top);
  return g;
}

/* 낮은 탁자 — 소파 앞. 상판이 얇고 다리가 짧아야 「낮은」 탁자다. */
export function lowTable(){
  const g = group(
    box(0.86, 0.06, 0.56, PAL.wood, 0, 0.36, 0),
    box(0.78, 0.04, 0.48, PAL.woodDark, 0, 0.14, 0),      // 아래 선반
  );
  for (let i = 0; i < 4; i++)
    g.add(box(0.06, 0.36, 0.06, PAL.woodDark,
              (i % 2 ? 1 : -1) * 0.36, 0.18, (i < 2 ? -1 : 1) * 0.22));
  if (rich()){
    const c = mug(PAL.fabric2);
    c.position.set(0.18, 0.39, 0.06);
    g.add(c);
  }
  return g;
}

/* 카페 테이블 — 다리가 하나(외다리)라 낮은 탁자와 실루엣이 확실히 갈린다.
   상판이 둥근 것도 같은 이유다 — 이 목록에서 유일한 원형 상판. */
export function cafeTable(){
  const g = new THREE.Group();
  const top = stub(0.36, 0.36, 0.05, PAL.wood, 12);
  top.position.y = 0.70;
  const pole = stub(0.05, 0.06, 0.68, PAL.metalDark, 8);
  pole.position.y = 0.34;
  const foot = stub(0.22, 0.24, 0.04, PAL.metalDark, 12);
  foot.position.y = 0.02;
  g.add(top, pole, foot);
  if (rich()){
    const cup = mug(PAL.paper);
    cup.position.set(0.10, 0.73, 0.04);
    g.add(cup);
  }
  return g;
}

/* 카페 의자 — 등받이 살이 보이는 나무 의자. 회의용 의자와 달리 팔걸이가 없고
   등받이가 **뚫려 있다**. 그 구멍이 두 의자를 가른다. */
export function cafeChair(turn = 0){
  const g = group(
    box(0.38, 0.05, 0.38, PAL.wood, 0, 0.44, 0),
    box(0.36, 0.05, 0.05, PAL.woodDark, 0, 0.78, -0.16),   // 등받이 윗살
  );
  if (rich()) for (let i = 0; i < 3; i++)
    g.add(box(0.05, 0.34, 0.04, PAL.woodDark, -0.12 + i * 0.12, 0.61, -0.16));
  else g.add(box(0.36, 0.34, 0.04, PAL.woodDark, 0, 0.61, -0.16));
  for (let i = 0; i < 4; i++)
    g.add(box(0.05, 0.44, 0.05, PAL.woodDark,
              (i % 2 ? 1 : -1) * 0.15, 0.22, (i < 2 ? -1 : 1) * 0.15));
  g.rotation.y = turn;
  return g;
}

/* ---------- 벽 ---------- */

/* 커튼 — 창 옆에 걸린다. 블라인드(windowUnit 안에 있다)와 겹치지 않게 **천 두 폭**만
   양쪽에 두고 가운데를 비운다. 다 덮으면 창이 안 보이고, 창은 이 게임의 시계다. */
export function curtain(w = 1.5, h = 1.2){
  const g = group(
    box(w + 0.20, 0.06, 0.10, PAL.woodDark, 0, h / 2 + 0.06, 0.06),   // 커튼봉
    box(0.05, 0.05, 0.05, PAL.metalDark, -(w + 0.20) / 2, h / 2 + 0.06, 0.06),
    box(0.05, 0.05, 0.05, PAL.metalDark,  (w + 0.20) / 2, h / 2 + 0.06, 0.06),
  );
  /* 주름 — 폭마다 세 겹씩 두께를 흔든다. 판 하나면 커튼이 아니라 벽지다. */
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++)
      g.add(box(0.12, h, 0.05 + (i % 2) * 0.03, i % 2 ? PAL.fabric : PAL.fabric2,
                s * (w / 2 - 0.06 - i * 0.12), 0, 0.07));
  return g;
}

/* 스티커 메모 — 벽에 붙인 포스트잇 몇 장. 액자와 달리 **틀이 없고 각도가 제각각**이라
   벽에서 「누가 붙여 둔 것」으로 읽힌다. */
export function stickyMemo(v = 0){
  const g = new THREE.Group();
  const cs = [0xF2D98C, 0xF0A9A0, 0xA8D3A0, 0xA8B8E0];
  for (let i = 0; i < 5; i++){
    const h = (v * 7 + i * 13) % 5;
    const n = box(0.16, 0.16, 0.012, cs[(v + i) % cs.length],
                  -0.20 + (i % 3) * 0.20, 0.14 - Math.floor(i / 3) * 0.20, 0);
    n.rotation.z = (h - 2) * 0.10;
    g.add(n);
  }
  return g;
}

/* 펜 홀더 — penCup() 이 이미 책상 잔물건으로 있다. 목록의 「펜 홀더」는 그것보다
   크고 칸을 하나 먹는 물건이라, 통을 나무 상자로 바꾸고 연필을 늘렸다. */
export function penHolder(){
  const g = group(
    box(0.26, 0.20, 0.20, PAL.woodDark, 0, 0.10, 0),
    box(0.22, 0.03, 0.16, PAL.wood, 0, 0.20, 0),
  );
  if (!rich()) return g;
  const cs = [PAL.fabric2, PAL.fabric, PAL.leafDark, PAL.pot];
  for (let i = 0; i < 4; i++){
    const p = box(0.025, 0.24, 0.025, cs[i % cs.length], -0.06 + i * 0.04, 0.30, (i % 2) * 0.03);
    p.rotation.z = (i - 1.5) * 0.10;
    g.add(p);
  }
  return g;
}

export function room(W, H, opt = {}){
  const g = new THREE.Group();
  const zoneAt = opt.zoneAt || (() => 0);

  const floor = new THREE.Group();
  for (let z = 0; z < H; z++){
    for (let x = 0; x < W; x++){
      const zone = zoneAt(x, z);
      const c = zone === 1 ? PAL.floorAlt : zone === 3 ? PAL.lounge : PAL.floor;
      const t = box(1, 0.1, 1, c, x + 0.5, -0.05, z + 0.5);
      t.castShadow = false;
      floor.add(t);
    }
  }
  floor.name = 'floor';
  g.add(floor);

  const WALL_H = 1.9, T = 0.16;
  /* 벽은 큰 판 하나였다. 판 하나짜리 벽은 로우폴리가 아니라 그냥 빈 면이라,
     허리 높이에 몰딩을 한 줄 두른다 — 벽 하나에 박스 하나 더 드는 값으로
     벽면이 위아래로 갈리고, 걸린 것들이 "붙어 있는" 것처럼 읽힌다.
     장식은 y 1.22 부터 걸리므로 0.92 는 아무것과도 안 부딪힌다. */
  const side = (name, w, h, d, x, y, z) => {
    const s = new THREE.Group();
    s.name = name;
    s.add(box(w, h, d, PAL.wall, x, y, z));
    s.add(box(w + 0.02, 0.13, d + 0.09, PAL.wallTrim, x, 0.065, z));  // 걸레받이
    /* 벽 두께보다 확실히 튀어나와야 빛을 받아 선이 생긴다. 0.02 로는 아무 일도 안 났다 */
    s.add(box(w + 0.02, 0.075, d + 0.08, PAL.wallTrim, x, 0.92, z));  // 허리 몰딩
    g.add(s);
    return s;
  };
  const wn = side('wallN', W + T*2, WALL_H, T, W/2, WALL_H/2, -T/2);
  side('wallS', W + T*2, WALL_H, T, W/2, WALL_H/2, H + T/2);
  const ww = side('wallW', T, WALL_H, H, -T/2, WALL_H/2, H/2);
  side('wallE', T, WALL_H, H,  W + T/2, WALL_H/2, H/2);

  /* 콘센트와 스위치 — 손톱만 하고 아무 기능도 없다. 그런데 이게 세 칸마다 하나씩
     박혀 있으면 벽이 벽지가 아니라 건물의 벽이 된다. 카메라가 보는 두 면에만 둔다. */
  if (rich()){
    for (let x = 2; x < W - 1; x += 3){
      const o = outlet(x % 6 === 2 ? 1 : 0);
      o.position.set(x + 0.5, x % 6 === 2 ? 1.05 : 0.30, 0.005);
      wn.add(o);
    }
    for (let z = 2; z < H - 1; z += 3){
      const o = outlet(z % 6 === 5 ? 1 : 0);
      o.position.set(0.005, z % 6 === 5 ? 1.05 : 0.30, z + 0.5);
      o.rotation.y = Math.PI / 2;
      ww.add(o);
    }
  }

  g.userData.walls = ['wallN','wallS','wallW','wallE'].map(n => g.getObjectByName(n));
  return g;
}

/* 카메라 쪽을 향한 벽을 숨긴다. 방향은 카메라가 어디 있느냐로만 정한다. */
export function cullWalls(roomGroup, camera){
  const w = roomGroup.userData.walls;
  if (!w) return;
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  const byName = Object.fromEntries(w.map(o => [o.name, o]));
  byName.wallS.visible = d.z < 0.15;
  byName.wallN.visible = d.z > -0.15;
  byName.wallE.visible = d.x < 0.15;
  byName.wallW.visible = d.x > -0.15;
}

/* ============================================================
   고양이 — 박스 14개짜리 리그.

   뼈대를 파일로 들고 오는 대신 관절을 직접 적는다. 상태가 4개뿐이라
   (대기 / 이동 / 근무 = 앉기 / 취침) 키프레임 대신 채널 8개를 목표값으로 두고
   현재값을 그쪽으로 당긴다. 상태 전환이 공짜로 부드러워진다.

   비율은 KIT.cat 이 정한다 — 머리를 키우고 다리를 줄이면 그대로 치비가 된다.
   ============================================================ */

const POSE = {
  //          몸높이  몸기울기  고개   다리흔들 다리접기 꼬리각  꼬리말림  귀
  idle:  { bodyY:0.00, pitch: 0.00, head: 0.00, swing:0.00, tuck:0.00, tail:-0.55, curl:0.30, ear:0.00 },
  walk:  { bodyY:0.00, pitch: 0.00, head:-0.06, swing:0.52, tuck:0.00, tail:-0.30, curl:0.10, ear:0.00 },
  sit:   { bodyY:-0.05, pitch:-0.30, head: 0.05, swing:0.00, tuck:1.30, tail: 0.10, curl:1.10, ear:0.10 },
  sleep: { bodyY:-0.11, pitch: 0.06, head: 0.55, swing:0.00, tuck:1.62, tail: 0.30, curl:1.70, ear:-0.35 },
};

export function cat(furColor = 0xC9A06A, opt = {}){
  const P = KIT.cat;
  const mix = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0x000000), k).getHex();
  const fur = furColor, furD = mix(furColor, 0.22);

  const legLen = 0.20 * P.leg;
  const hipY = 0.02 + legLen;
  const bodyY0 = hipY + 0.08 * P.body;
  const headY0 = bodyY0 + 0.10 + 0.08 * (P.head - 1);
  const headZ0 = 0.22 * P.body + 0.05 * P.head;

  const root = new THREE.Group();

  const body = group(box(0.24 * P.body, 0.21 * P.body, 0.44 * P.body, fur, 0, 0, 0));
  if (rich()) body.add(box(0.20 * P.body, 0.07, 0.38 * P.body, mix(furColor, -0.0), 0, -0.09 * P.body, 0.01));
  body.position.y = bodyY0;
  root.add(body);

  const head = group(box(0.21 * P.head, 0.19 * P.head, 0.19 * P.head, fur, 0, 0, 0));
  if (rich()) head.add(
    box(0.11 * P.head, 0.08, 0.06, mix(furColor, -0.35), 0, -0.04 * P.head, 0.10 * P.head),
    box(0.035, 0.035, 0.02, PAL.ink, -0.055 * P.head, 0.02 * P.head, 0.095 * P.head),
    box(0.035, 0.035, 0.02, PAL.ink,  0.055 * P.head, 0.02 * P.head, 0.095 * P.head),
    box(0.035, 0.025, 0.02, 0xE59BA8, 0, -0.02 * P.head, 0.135 * P.head),
  );
  head.position.set(0, headY0, headZ0);
  root.add(head);

  const eh = 0.09 * P.ear * P.head;
  const earL = box(0.07 * P.ear, eh, 0.035, furD, -0.065 * P.head, 0.095 * P.head + eh/2, -0.01);
  const earR = box(0.07 * P.ear, eh, 0.035, furD,  0.065 * P.head, 0.095 * P.head + eh/2, -0.01);
  earL.rotation.z = 0.18; earR.rotation.z = -0.18;
  head.add(earL, earR);

  /* 다리는 엉덩이/어깨에 회전축을 둔다. 박스 자체를 돌리면 발이 바닥을 파고든다. */
  const legs = [];
  const lz = 0.15 * P.body;
  for (const [lx, lzz] of [[-0.085, lz], [0.085, lz], [-0.085, -lz], [0.085, -lz]]){
    const hip = new THREE.Group();
    hip.position.set(lx, hipY, lzz);
    hip.add(box(0.075, legLen, 0.075, furD, 0, -legLen / 2, 0));
    if (rich()) hip.add(box(0.085, 0.045, 0.095, mix(furColor, 0.35), 0, -legLen + 0.02, 0.01));
    root.add(hip);
    legs.push(hip);
  }

  // 꼬리 — 3마디를 겹쳐 달아야 휘어진다. 한 덩어리면 막대기다.
  const tl = 0.14 * P.tail;
  const t1 = new THREE.Group(); t1.position.set(0, bodyY0 + 0.04, -0.22 * P.body);
  const t2 = new THREE.Group(); t2.position.set(0, 0, -tl);
  const t3 = new THREE.Group(); t3.position.set(0, 0, -tl * 0.9);
  t1.add(box(0.06, 0.06, tl, furD, 0, 0, -tl / 2));
  t2.add(box(0.055, 0.055, tl * 0.9, furD, 0, 0, -tl * 0.45));
  t3.add(box(0.05, 0.05, tl * 0.85, mix(furColor, 0.4), 0, 0, -tl * 0.42));
  t2.add(t3); t1.add(t2); root.add(t1);

  const cur = { ...POSE.idle };
  let target = POSE.idle, state = 'idle', t = 0;
  const phase = ((furColor * 7919) % 1000) / 1000 * 100;   // 마리마다 다른 호흡. 난수는 안 쓴다

  const api = {
    root, state,
    setState(s){
      if (!POSE[s] || s === state) return;
      state = api.state = s;
      target = POSE[s];
    },
    /* 털색 갈아끼우기 — 2D 에서 hue-rotate 로 겨우 24종 만들던 걸 여기선 그냥 값으로 준다. */
    setFur(hex){
      const d = mix(hex, 0.22);
      body.children[0].material = mat(hex);
      head.children[0].material = mat(hex);
      earL.material = earR.material = mat(d);
      legs.forEach(l => { l.children[0].material = mat(d); });
      [t1, t2].forEach(seg => { seg.children[0].material = mat(d); });
    },
    update(dt){
      t += dt;
      const k = Math.min(1, dt * 7);
      for (const key in cur) cur[key] += (target[key] - cur[key]) * k;

      const breathe = Math.sin((t + phase) * (state === 'sleep' ? 1.1 : 2.4)) * (state === 'sleep' ? 0.012 : 0.006);
      body.position.y = bodyY0 + cur.bodyY + breathe;
      body.rotation.x = cur.pitch;
      head.position.y = headY0 + cur.bodyY * 1.3 + breathe;
      head.position.z = headZ0 - cur.pitch * 0.10;
      head.rotation.x = cur.head + cur.pitch * 0.5;

      const gait = Math.sin((t + phase) * 9);
      legs.forEach((hip, i) => {
        const dir = (i === 0 || i === 3) ? 1 : -1;
        hip.rotation.x = gait * cur.swing * dir - cur.tuck * 0.9;
        hip.position.y = hipY + cur.bodyY - cur.tuck * 0.06;
      });

      const sway = Math.sin((t + phase) * (state === 'walk' ? 5 : 1.6));
      t1.position.y = bodyY0 + 0.04 + cur.bodyY;
      t1.rotation.x = cur.tail;
      t1.rotation.y = sway * (state === 'sleep' ? 0.03 : 0.18);
      t2.rotation.x = cur.curl * 0.7;
      t3.rotation.x = cur.curl * 0.8;
      t2.rotation.y = sway * 0.12;

      earL.rotation.x = earR.rotation.x = cur.ear + (Math.sin((t + phase) * 0.7) > 0.985 ? 0.4 : 0);
    },
  };
  api.setFur(fur);
  void opt;
  return api;
}

/* 조명. 로우폴리는 면이 커서 빛 하나만 있으면 평평해 보인다 — 채움광이 필요하다. */
export function lights(scene, opt = {}){
  const hemi = new THREE.HemisphereLight(0xFFF4E2, 0x8A7F73, opt.hemi ?? 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xFFE9C9, opt.sun ?? 1.5);
  sun.position.set(6, 12, 4);
  sun.castShadow = opt.shadow !== false;
  sun.shadow.mapSize.set(1024, 1024);
  const s = opt.span ?? 16;
  Object.assign(sun.shadow.camera, { left:-s, right:s, top:s, bottom:-s, near:0.5, far:40 });
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xBFD4FF, opt.fill ?? 0.35);
  fill.position.set(-8, 5, -6);
  scene.add(fill);

  return { hemi, sun, fill };
}
