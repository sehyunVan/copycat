/* ============================================================
   merge.js — 드로우콜을 줄인다.

   지금 병목은 삼각형이 아니라 드로우콜이다(스파이크 2). 로우폴리의 비용은
   "박스 하나 = 메시 하나" 에 있고, 사무실 하나에 1,300개가 나온다.

   보통은 같은 머티리얼끼리 묶는데, 여기서는 색이 곧 물건이라 머티리얼이 수십 개다.
   그래서 **색을 정점에 구워 넣는다.** 색이 지오메트리 안으로 들어가면 머티리얼이
   하나로 통일되고, 하나로 통일되면 전부 한 번에 그려진다.

   규칙 둘:
     · userData.dynamic — 런타임에 머티리얼이 바뀌는 것(모니터 화면, 전구). 합치지 않는다
     · userData.keep    — 따로 움직여야 하는 하위 묶음(눈·꼬리 마디). 거기서 하강을 멈춘다
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

const _m = new THREE.Matrix4();

/* 한 묶음의 메시들을 정점 색이 구워진 지오메트리 하나로 합친다. */
export function bake(meshes, base){
  if (!meshes.length) return null;
  base.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(base.matrixWorld).invert();

  let total = 0;
  const parts = [];
  for (const o of meshes){
    const src = o.geometry;
    const g = (src.index ? src.toNonIndexed() : src.clone());
    _m.copy(inv).multiply(o.matrixWorld);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    total += n;
    parts.push({ g, n, c: o.material.color });
  }

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let off = 0;
  for (const { g, n, c } of parts){
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    for (let i = 0; i < n; i++){
      col[(off + i) * 3]     = c.r;
      col[(off + i) * 3 + 1] = c.g;
      col[(off + i) * 3 + 2] = c.b;
    }
    off += n;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/* 하위 트리를 훑되 dynamic 은 건너뛰고 keep 에서는 멈춘다. */
function gather(node, out, isRoot = true){
  if (!isRoot && node.userData.keep) return;
  if (node.isMesh && !node.userData.dynamic) out.push(node);
  for (const c of node.children) gather(c, out, false);
}

/* 노드의 하위 메시들을 하나로 합쳐서 그 자리에 되돌려 놓는다.
   flatShading 은 원본을 따른다 — 캐릭터는 flat, 가구는 smooth 였으므로. */
export function collapse(node, opts = {}){
  const found = [];
  gather(node, found);
  if (found.length < 2) return 0;

  const geo = bake(found, node);
  if (!geo) return 0;

  const flat = opts.flatShading ?? (found[0].material.flatShading !== false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: flat,
  }));
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;

  const saved = found.length;
  for (const o of found) o.parent && o.parent.remove(o);
  node.add(mesh);
  return saved - 1;              // 줄어든 드로우콜 수
}

/* 여러 노드를 한꺼번에. 줄어든 총합을 돌려준다. */
export function collapseAll(nodes, opts){
  let saved = 0;
  for (const n of nodes) saved += collapse(n, opts);
  return saved;
}
