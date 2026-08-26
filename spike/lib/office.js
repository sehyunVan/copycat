/* ============================================================
   office.js — 사무실 전체 프로토타입의 틀.

   그림체는 f3(라운디드 소프트)으로, 색은 s3(파스텔)로 고정한다.
   이제 움직이는 축은 하나뿐이다: **배치**.

   한 화면만 그린다. 시간대는 버튼으로 갈아 끼운다 — 볼 것이 톤이 아니라
   "이 사무실이 아늑한가" 이기 때문에 화면을 셋으로 쪼개면 오히려 안 보인다.

   프로토타입 파일은 build(ctx) 안에서 물건을 놓기만 한다.
   방·카메라·빛·계기판은 전부 여기가 맡는다.
   ============================================================ */

import * as THREE from 'three';
import { hud, frameStats } from './hud.js';
import * as LP from './lowpoly.js';
import { cat3 } from './cat3.js';
import { collapse } from './merge.js';
import { PASTEL, PASTEL_PANELS } from './pastel.js';

const CSS = `
  #stage{right:340px !important;background:#0b0d12}
  #stage.widget{right:auto !important;left:24px;top:24px;width:380px;height:300px}
  .name{font-size:14px;color:#fff;margin:2px 0 4px;letter-spacing:.02em}
  .note{color:#8f9ab3;line-height:1.5;margin-bottom:8px}
  #tlab{position:absolute;left:12px;top:11px;font:11px ui-monospace,monospace;
    letter-spacing:.06em;padding:3px 8px;border-radius:5px;background:#0009;color:#fff;
    border:1px solid #ffffff22;pointer-events:none}
`;

/* f3 에서 고른 그림체. 프로토타입이 kit 을 넘기면 그 위에 덮는다. */
const SOFT = { prim:'round', bevel:0.055, shading:'smooth', detail:1 };

export function run(spec){
  LP.setKit({ ...SOFT, ...(spec.kit || {}) });
  LP.setPalette({ ...PASTEL, ...(spec.pal || {}) });

  const H = hud(spec.name);
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  H.el.querySelector('h1').insertAdjacentHTML('afterend',
    `<div class="name">${spec.name}</div><div class="note">${spec.note || ''}</div>`);

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('cv');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = spec.exposure ?? 1.04;

  const scene = new THREE.Scene();
  const W = spec.room.W, D = spec.room.D, WH = spec.room.wallH ?? 2.2;
  const mid = new THREE.Vector3(W / 2, 0.5, D / 2);

  /* ---------- 빛 ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sp = Math.max(W, D) * 0.85;
  Object.assign(sun.shadow.camera, { left:-sp, right:sp, top:sp, bottom:-sp, near:0.5, far:60 });
  sun.shadow.bias = -0.0016;
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-6, 5, -5);
  scene.add(hemi, sun, sun.target, fill);

  /* ---------- 방 ---------- */
  const world = new THREE.Group();      // 정적인 것 — 통째로 합쳐진다
  const actors = new THREE.Group();     // 움직이는 것 — 합치지 않는다
  scene.add(world, actors);

  const floorAt = spec.floorAt || (() => LP.PAL.floor);
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++){
      const t = LP.box(1, 0.12, 1, floorAt(x, z), x + 0.5, -0.06, z + 0.5);
      t.castShadow = false;
      world.add(t);
    }

  const T = 0.18;
  world.add(LP.box(W + T * 2, WH, T, LP.PAL.wall, W / 2, WH / 2, -T / 2));
  world.add(LP.box(T, WH, D + T, LP.PAL.wall, -T / 2, WH / 2, D / 2 - T / 2));
  world.add(LP.box(W + T * 2, 0.13, T + 0.03, LP.PAL.wallTrim, W / 2, 0.065, -T / 2 + 0.01));
  world.add(LP.box(T + 0.03, 0.13, D + T, LP.PAL.wallTrim, -T / 2 + 0.01, 0.065, D / 2 - T / 2));

  /* ---------- 프로토타입이 쓰는 도구 ---------- */
  const screens = [], lamps = [], cats = [], glows = [];

  const ctx = {
    LP, W, D, WH, wallT: T,
    /* 물건 하나 놓기. 회전은 여기서 준다 — 빌더에 넘기면 덮어써진다. */
    put(o, x, z, ry = 0, y = 0){ o.position.set(x, y, z); o.rotation.y = ry; world.add(o); return o; },
    /* 북쪽 벽(z=0)에 거는 것 */
    onWallN(o, x, y){ o.position.set(x, y, 0.01); o.rotation.y = 0; world.add(o); return o; },
    /* 서쪽 벽(x=0)에 거는 것 */
    onWallW(o, z, y){ o.position.set(0.01, y, z); o.rotation.y = Math.PI / 2; world.add(o); return o; },
    /* 책상 한 짝 — 배치 프로토타입이 제일 많이 쓰는 덩어리라 묶어 둔다 */
    pod(x, z, ry = 0){
      const g = new THREE.Group();
      g.add(LP.desk());
      const m1 = LP.monitor(-0.45, -0.1, 0.14), m2 = LP.monitor(0.55, -0.1, -0.14);
      g.add(m1, m2);
      m1.children[3].userData.dynamic = true;   // 시간대마다 발광이 바뀐다
      m2.children[3].userData.dynamic = true;
      screens.push(m1.children[3], m2.children[3]);
      const p = LP.papers(0.05, 0.22); g.add(p);
      const c1 = LP.chair(Math.PI); c1.position.set(-0.45, 0, 1.05); g.add(c1);
      const c2 = LP.chair(Math.PI); c2.position.set(0.55, 0, 1.05); g.add(c2);
      g.userData.seats = [{ x:-0.45, z:1.05 }, { x:0.55, z:1.05 }];
      return ctx.put(g, x, z, ry);
    },
    /* 빛나는 것을 등록한다 — 시간대가 바뀌면 같이 켜지고 꺼진다 */
    lamp(o){
      const l = new THREE.PointLight(0xFFD9A0, 0, 5.5, 2);
      const p = o.userData.bulb ? o.userData.bulb.clone() : new THREE.Vector3();
      world.updateMatrixWorld(true);          // 부모까지 갱신해야 localToWorld 가 맞는다
      l.position.copy(o.localToWorld(p));
      scene.add(l);
      lamps.push(l);
      const plate = o.children.find(c => c.isMesh && c.material === LP.mat(LP.PAL.glow));
      if (plate){ plate.userData.dynamic = true; glows.push(plate); }
      return o;
    },
    cat(fur, x, z, ry = 0, state = 'idle', y = 0){
      const c = cat3({ fur, scale: spec.catScale ?? 0.82, ...(spec.catParams || {}) });
      c.root.position.set(x, y, z);
      c.root.rotation.y = ry;
      c.setState(state);
      actors.add(c.root);
      cats.push(c);
      return c;
    },
    /* 돌아다니는 고양이 — 두 점 사이를 왕복한다 */
    walker(fur, ax, az_, bx, bz){
      const c = ctx.cat(fur, ax, az_, 0, 'walk');
      c.a = new THREE.Vector3(ax, 0, az_);
      c.b = new THREE.Vector3(bx, 0, bz);
      c.to = c.b;
      return c;
    },
  };

  spec.build(ctx);

  /* 정적 병합 — 바닥·벽·가구를 정점 색이 구워진 메시 하나로 만든다.
     색이 지오메트리 안으로 들어가므로 머티리얼이 하나가 되고, 전부 한 번에 그려진다.
     시간대마다 색이 바뀌는 것(모니터 화면·전구)만 dynamic 으로 남겨 뒀다. */
  let mergedSaved = 0;
  if (spec.merge !== false) mergedSaved = collapse(world, { flatShading: false });

  /* ---------- 카메라 ---------- */
  const CAM = { az:0.72, el:0.62, pad:1.0, ortho:false, fov:32, ...(spec.camera || {}) };
  const radius = Math.max(W, D) * 0.60 + CAM.pad;
  let az = CAM.az, el = CAM.el, zoom = 1, spinning = false;
  const persp = new THREE.PerspectiveCamera(CAM.fov, 1, 0.5, 200);
  const orth = new THREE.OrthographicCamera(-1, 1, 1, -1, -60, 120);
  const cam = () => CAM.ortho ? orth : persp;

  function frame(aspect){
    const R = radius * zoom;
    if (CAM.ortho){
      const hH = aspect >= 1 ? R : R / aspect;
      orth.left = -hH * aspect; orth.right = hH * aspect;
      orth.top = hH; orth.bottom = -hH;
      orth.updateProjectionMatrix();
    } else {
      const vh = 2 * Math.tan(persp.fov * Math.PI / 360);
      persp.aspect = aspect;
      persp.userData.dist = R / (Math.min(vh, vh * aspect) / 2);
      persp.updateProjectionMatrix();
    }
  }
  const look = mid.clone();          // 카메라가 보는 점. 위젯 카메라가 이걸 옮긴다
  function placeCam(){
    const c = cam(), d = CAM.ortho ? Math.max(W, D) * 1.6 : persp.userData.dist;
    c.position.set(
      look.x + Math.cos(az) * Math.cos(el) * d,
      look.y + Math.sin(el) * d,
      look.z + Math.sin(az) * Math.cos(el) * d);
    c.lookAt(look);
  }

  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x:e.clientX, y:e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    az -= (e.clientX - drag.x) * 0.008;
    el = Math.max(0.10, Math.min(1.40, el + (e.clientY - drag.y) * 0.006));
    drag = { x:e.clientX, y:e.clientY };
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = Math.max(0.4, Math.min(2.2, zoom * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive:false });

  /* ---------- 시간대 ---------- */
  if (spec.widget) stage.classList.add('widget');   // 처음부터 380px 로 띄운다

  const tlab = document.createElement('div');
  tlab.id = 'tlab';
  stage.appendChild(tlab);
  let ti = spec.time ?? 1;

  function applyTime(){
    const p = PASTEL_PANELS[ti];
    tlab.textContent = p.label;
    renderer.setClearColor(p.bg, 1);
    /* 안개는 안 쓴다. 거리를 방 크기로 잡았더니 카메라가 그 안에 들어와서
       사무실 전체가 배경색으로 씻겨 나갔다. 디오라마는 배경색만으로 충분하다. */
    scene.fog = null;
    hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]);
    /* 하늘빛을 조금 낮추고 태양을 올린다 — 채움광이 세면 로우폴리의 각이 죽어서
       파스텔이 "뿌옇다"가 된다. 대비는 태양이 만든다. */
    hemi.intensity = p.hemi[2] * (spec.hemiScale ?? 0.80);
    sun.color.setHex(p.sun[0]); sun.intensity = p.sun[1] * (spec.sunScale ?? 1.30);
    const s = p.sun[2];
    sun.position.set(mid.x + s[0], s[1], mid.z + s[2]);
    sun.target.position.copy(mid);
    sun.target.updateMatrixWorld();
    fill.color.setHex(p.fill[0]); fill.intensity = p.fill[1];
    lamps.forEach(l => { l.intensity = (p.lamp || 0) * 5.5; });

    const sc = p.screen ?? LP.PAL.screen;
    const gk = p.glow ?? (p.lamp ? 0.85 : 0.10);
    screens.forEach(m => { m.material = LP.matGlow(sc, gk); });
    glows.forEach(m => { m.material = p.lamp ? LP.matGlow(LP.PAL.glow, 0.9 * p.lamp) : LP.mat(LP.PAL.metal); });
  }
  applyTime();

  /* 위젯 카메라용 손잡이. 전체 화면과 위젯이 같은 씬을 쓰되
     "무엇을 보느냐" 만 달라야 하므로, 보는 점과 배율만 밖으로 낸다. */
  const camApi = {
    look, cats, W, D,
    get zoom(){ return zoom; },
    set zoom(v){ zoom = Math.max(0.12, Math.min(2.2, v)); },
    get az(){ return az; },  set az(v){ az = v; },
    get el(){ return el; },  set el(v){ el = v; },
    camera: () => cam(),
    size: () => ({ w: stage.clientWidth, h: stage.clientHeight }),
  };

  /* ---------- 루프 ---------- */
  const fs = frameStats(1000);
  let last = performance.now();
  function loop(){
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (spec.onFrame) spec.onFrame(dt, camApi);

    cats.forEach(c => {
      c.update(dt);
      if (!c.to) return;
      const d = c.to.clone().sub(c.root.position).setY(0);
      if (d.length() < 0.25) c.to = c.to === c.a ? c.b : c.a;
      d.normalize();
      c.root.position.addScaledVector(d, dt * 0.65);
      let diff = Math.atan2(d.x, d.z) - c.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.root.rotation.y += diff * Math.min(1, dt * 4);
    });
    if (spinning) az += dt * 0.1;

    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    frame(w / h);
    placeCam();
    renderer.render(scene, cam());

    const s = fs.tick();
    if (s){
      H.set('fps', s.fps.toFixed(1), s.fps < 30 ? 'warn' : 'ok');
      H.set('draw call', String(renderer.info.render.calls), renderer.info.render.calls > 900 ? 'warn' : '');
      H.set('삼각형', renderer.info.render.triangles.toLocaleString());
      H.set('사무실 / 고양이', `${W}×${D} / ${cats.length}`);
      if (mergedSaved) H.set('병합으로 줄인 콜', '-' + mergedSaved, 'ok');
    }
  }

  /* ---------- 조작 ---------- */
  H.btn('시간 ▸', b => {
    ti = (ti + 1) % 3;
    applyTime();
    b.textContent = PASTEL_PANELS[ti].label + ' ▸';
  });
  H.btn('원근 ⇄ 직교', b => {
    CAM.ortho = !CAM.ortho;
    b.textContent = CAM.ortho ? '직교 ⇄ 원근' : '원근 ⇄ 직교';
    return CAM.ortho;
  }, CAM.ortho);
  H.btn('위젯 380px', () => {
    const on = !stage.classList.contains('widget');
    stage.classList.toggle('widget', on);
    return on;
  });
  H.btn('그림자', () => {
    renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
    sun.castShadow = renderer.shadowMap.enabled;
    scene.traverse(o => { if (o.isMesh) o.material.needsUpdate = true; });
    return renderer.shadowMap.enabled;
  }, true);
  H.btn('자동 회전', () => (spinning = !spinning));
  H.btn('위에서 ⇄ 눈높이', () => { el = el > 0.5 ? 0.26 : CAM.el; });
  H.log('시간 버튼으로 아침·저녁·야근을 갈아 끼운다. 드래그 회전 · 휠 확대.');

  loop();
  return { scene, renderer, cats, H, ctx };
}
