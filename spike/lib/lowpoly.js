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

import * as THREE from 'three';

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
  glow:     0xFFD9A0,     // 밤에 켜지는 것들
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
export function wallArt(w = 0.5, h = 0.4, color = PAL.fabric2){
  return group(
    box(w, h, 0.05, PAL.woodDark, 0, 0, 0),
    box(w - 0.08, h - 0.08, 0.03, color, 0, 0, 0.02),
  );
}

export function wallShelf(w = 1.2){
  const g = group(
    box(w, 0.07, 0.28, PAL.wood, 0, 0, 0),
    box(0.07, 0.20, 0.24, PAL.woodDark, -w / 2 + 0.08, -0.13, -0.02),
    box(0.07, 0.20, 0.24, PAL.woodDark,  w / 2 - 0.08, -0.13, -0.02),
  );
  if (!rich()) return g;
  const things = [PAL.pot, PAL.fabric, PAL.leaf, PAL.fabric2, PAL.screen];
  for (let i = 0; i < 4; i++){
    const x = -w / 2 + 0.25 + i * (w - 0.5) / 3;
    g.add(box(0.14, 0.16 + (i % 3) * 0.04, 0.14, things[i % things.length], x, 0.12 + (i % 3) * 0.02, 0));
  }
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

/* 창 — 벽에 구멍을 뚫는 대신 밝은 판을 붙인다. 디오라마에서는 이걸로 충분히 읽히고,
   벽을 조각내지 않아도 된다. 바닥에 빛 자국(sunPatch)을 같이 깔면 채광이 완성된다. */
export function windowUnit(w = 1.4, h = 1.1){
  return group(
    box(w + 0.16, h + 0.16, 0.08, PAL.wall, 0, 0, 0.02),
    box(w, h, 0.04, PAL.sky, 0, 0, 0.05),
    box(0.06, h, 0.05, PAL.wall, 0, 0, 0.07),
    box(w, 0.06, 0.05, PAL.wall, 0, 0, 0.07),
    box(w + 0.26, 0.08, 0.22, PAL.wood, 0, -h / 2 - 0.12, 0.08),
  );
}
export function sunPatch(w, d){
  const m = box(w, 0.02, d, PAL.glow, 0, 0.02, 0);
  m.castShadow = false;
  m.material = matGlow(PAL.glow, 0.25);
  return m;
}

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

export function wallClock(){
  return group(
    box(0.34, 0.34, 0.06, PAL.woodDark, 0, 0, 0),
    box(0.26, 0.26, 0.03, PAL.paper, 0, 0, 0.03),
    box(0.03, 0.10, 0.02, PAL.ink, 0, 0.04, 0.05),
    box(0.08, 0.03, 0.02, PAL.ink, 0.03, 0, 0.05),
  );
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

/* ---------- 방 ----------
   벽을 네 덩어리로 따로 만든다. 카메라를 돌리면 앞벽이 씬을 가리기 때문에
   면마다 통째로 껐다 켤 수 있어야 한다 (2D 에서 "양옆 벽을 안 그리던" 트릭의 3D 판). */
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
  const side = (name, w, h, d, x, y, z) => {
    const s = new THREE.Group();
    s.name = name;
    s.add(box(w, h, d, PAL.wall, x, y, z));
    s.add(box(w + 0.02, 0.10, d + 0.02, PAL.wallTrim, x, 0.05, z));   // 걸레받이
    g.add(s);
    return s;
  };
  side('wallN', W + T*2, WALL_H, T, W/2, WALL_H/2, -T/2);
  side('wallS', W + T*2, WALL_H, T, W/2, WALL_H/2, H + T/2);
  side('wallW', T, WALL_H, H, -T/2, WALL_H/2, H/2);
  side('wallE', T, WALL_H, H,  W + T/2, WALL_H/2, H/2);

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
