/* ============================================================
   catlab.js — 고양이만 놓고 보는 대조대.

   사무실도 가구도 없다. 조형 하나를 판단할 때 배경이 있으면
   배경이 대신 답한다. 여기서는 같은 조명·같은 각도·같은 크기로 나란히 세우고
   얼굴만 다르게 한다.

   run({ name, note, cols, variants:[{label, ...cat3 params}] })
   ============================================================ */

import * as THREE from 'three';
import { hud, frameStats } from './hud.js';
import * as LP from './lowpoly.js';
import { cat3 } from './cat3.js';
import { PASTEL } from './pastel.js';

const CSS = `
  #stage{right:340px !important;background:#0b0d12}
  #stage.widget{right:auto !important;left:24px;top:24px;width:380px;height:300px}
  #tags{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  #tags .t{position:absolute;transform:translate(-50%,0);white-space:nowrap;
    font:11px/1.5 ui-monospace,monospace;color:#3d3730;background:#ffffffcc;
    border:1px solid #00000018;border-radius:5px;padding:1px 7px}
  .name{font-size:14px;color:#fff;margin:2px 0 4px;letter-spacing:.02em}
  .note{color:#8f9ab3;line-height:1.5;margin-bottom:8px}
`;

/* 레퍼런스 그리드의 색조 — 회색·라벤더·크림 위주의 저채도 */
export const FURS = [
  0xE8E2DA, 0xC9BFC9, 0x9A93A4, 0xE8C9A0, 0xD8A9A0, 0x7E7887, 0xE8A657, 0xB7C6D8,
];

export function run(spec){
  /* 캐릭터는 flat 으로 간다. 가구는 smooth 가 맞았지만, 다면체 머리를 스무스로 칠하면
     면이 사라져서 로우폴리가 아니라 그냥 뿌연 공이 된다. 참조 피규어의 매력이 면이었다. */
  LP.setKit({ prim:'round', bevel:0.05, shading: spec.shading ?? 'flat', detail:1 });
  LP.setPalette(PASTEL);

  const H = hud(spec.name);
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  H.el.querySelector('h1').insertAdjacentHTML('afterend',
    `<div class="name">${spec.name}</div><div class="note">${spec.note || ''}</div>`);

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('cv');
  const tagBox = document.createElement('div');
  tagBox.id = 'tags';
  stage.appendChild(tagBox);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = spec.exposure ?? 1.06;
  renderer.setClearColor(spec.bg ?? 0xEDE4F0, 1);

  const scene = new THREE.Scene();

  /* 빛 — 얼굴을 보는 화면이라 정면 채움광을 조금 더 준다.
     사무실 조명(측광 위주)을 그대로 쓰면 얼굴이 그늘에 들어가 조형이 안 보인다. */
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xC8C0CC, 1.05));
  const sun = new THREE.DirectionalLight(0xFFF6E8, 1.55);
  sun.position.set(3.5, 6, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left:-6, right:6, top:6, bottom:-6, near:0.5, far:30 });
  sun.shadow.bias = -0.0012;
  scene.add(sun, sun.target);
  const key = new THREE.DirectionalLight(0xE4ECFF, 0.42);
  key.position.set(-4, 2.4, 4);
  scene.add(key);

  const ground = LP.box(40, 0.2, 40, spec.ground ?? 0xF3E9DE, 0, -0.1, 0);
  ground.castShadow = false;
  scene.add(ground);

  /* ---------- 배치 ---------- */
  /* 한 줄로 세운다. 두 줄로 놓으면 3/4 시점에서 뒷줄이 앞줄 사이로 끼어들어
     실루엣이 겹치고, 겹치는 순간 조형 비교라는 목적 자체가 무너진다. */
  const cols = spec.cols ?? 8;
  const gapX = spec.gapX ?? 0.74;      // 머리 지름 + 귀보다 넉넉해야 실루엣이 안 겹친다
  const gapZ = spec.gapZ ?? 1.15;
  const rows = Math.ceil(spec.variants.length / cols);
  let cats = [], holder = new THREE.Group();
  scene.add(holder);

  let furShift = 0;
  function build(){
    scene.remove(holder);
    holder = new THREE.Group();
    scene.add(holder);
    cats = spec.variants.map((v, i) => {
      const c = cat3({ fur: FURS[(i + furShift) % FURS.length], ...v });
      const cx = (i % cols - (cols - 1) / 2) * gapX;
      const cz = (Math.floor(i / cols) - (rows - 1) / 2) * gapZ;
      c.root.position.set(cx, 0, cz);
      c.label = v.label || `#${i + 1}`;
      holder.add(c.root);
      return c;
    });
    tagBox.innerHTML = '';
    cats.forEach(c => {
      const t = document.createElement('div');
      t.className = 't';
      t.textContent = c.label;
      tagBox.appendChild(t);
      c.tag = t;
    });
    sun.target.position.set(0, 0.3, 0);
    sun.target.updateMatrixWorld();
  }
  build();

  /* ---------- 카메라 ---------- */
  /* 정면. 조금이라도 틀면 한 줄이 비스듬해지고, 화각이 넓어서 끝쪽이 왜곡되어 잘린다.
     각도가 보고 싶으면 드래그하거나 [정면 ⇄ 45°] 를 누르면 된다. */
  const CAM = { az: Math.PI / 2, el: 0.18, pad: 0.40, ...(spec.camera || {}) };
  let az = CAM.az, el = CAM.el, zoom = 1, spinning = false;
  const target = new THREE.Vector3(0, spec.lookY ?? 0.30, 0);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.2, 100);

  /* 가로와 세로를 따로 맞춘다. 격자 대각선 하나로 거리를 잡으면
     가로로 긴 화면에서 세로 여백만 잔뜩 남고 대상이 작아진다. */
  function frame(aspect){
    const vfov = camera.fov * Math.PI / 180;
    const halfW = (cols * gapX) / 2 + CAM.pad;
    const halfV = (rows * gapZ * Math.sin(el)) / 2 + 0.42 + CAM.pad * 0.5;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    camera.aspect = aspect;
    camera.userData.dist = Math.max(
      halfV / Math.tan(vfov / 2),
      halfW / Math.tan(hfov / 2)) * zoom;
    camera.updateProjectionMatrix();
  }
  function placeCam(){
    const d = camera.userData.dist;
    camera.position.set(
      target.x + Math.cos(az) * Math.cos(el) * d,
      target.y + Math.sin(el) * d,
      target.z + Math.sin(az) * Math.cos(el) * d);
    camera.lookAt(target);
  }

  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x:e.clientX, y:e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    az -= (e.clientX - drag.x) * 0.008;
    el = Math.max(-0.05, Math.min(1.25, el + (e.clientY - drag.y) * 0.005));
    drag = { x:e.clientX, y:e.clientY };
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = Math.max(0.35, Math.min(2.2, zoom * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive:false });

  /* ---------- 루프 ---------- */
  const v3 = new THREE.Vector3();
  const fs = frameStats(1000);
  let last = performance.now();
  function loop(){
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    cats.forEach(c => c.update(dt));
    if (spinning) az += dt * 0.35;

    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    frame(w / h);
    placeCam();
    renderer.render(scene, camera);

    cats.forEach(c => {
      v3.copy(c.root.position).setY(-0.02).project(camera);
      const on = v3.z < 1;
      c.tag.style.display = on ? '' : 'none';
      if (on) c.tag.style.transform =
        `translate(-50%,0) translate(${((v3.x + 1) / 2 * w).toFixed(1)}px,${((1 - v3.y) / 2 * h).toFixed(1)}px)`;
    });

    const s = fs.tick();
    if (s){
      H.set('fps', s.fps.toFixed(1), s.fps < 30 ? 'warn' : 'ok');
      H.set('draw call', String(renderer.info.render.calls));
      H.set('삼각형 / 마리', `${renderer.info.render.triangles.toLocaleString()} / ${cats.length}`);
    }
  }

  /* ---------- 조작 ---------- */
  const STATES = ['idle', 'walk', 'sit', 'sleep'];
  let si = STATES.indexOf(spec.state || 'idle');
  const applyState = () => cats.forEach(c => c.setState(STATES[si]));
  applyState();
  H.btn(`상태: ${STATES[si]} ▸`, b => {
    si = (si + 1) % 4;
    applyState();
    b.textContent = `상태: ${STATES[si]} ▸`;
  });
  H.btn('정면 ⇄ 45°', () => { az = Math.abs(az - Math.PI / 2) < 0.02 ? Math.PI / 2 - 0.55 : Math.PI / 2; });
  H.btn('눈높이 ⇄ 위에서', () => { el = el < 0.4 ? 0.62 : 0.26; });
  H.btn('털색 바꾸기', () => { furShift++; build(); applyState(); });
  H.btn('자동 회전', () => (spinning = !spinning));
  H.btn('그림자', () => {
    renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
    sun.castShadow = renderer.shadowMap.enabled;
    scene.traverse(o => { if (o.isMesh) o.material.needsUpdate = true; });
    return renderer.shadowMap.enabled;
  }, true);
  H.btn('작게 보기 380px', () => {
    const on = !stage.classList.contains('widget');
    stage.classList.toggle('widget', on);
    return on;
  });
  H.log('작게 보기로 줄였을 때도 얼굴이 구분되는지가 실제 기준이다.');

  loop();
  return { scene, renderer, cats, H };
}
