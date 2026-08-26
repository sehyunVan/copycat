/* ============================================================
   vignette.js — 스타일 프로토타입의 틀.

   같은 장면을 세 번 그린다: 오전 · 퇴근 무렵 · 야근.
   copycat 은 실제 시계로 도는 게임이라 톤은 하루를 버텨야 한다.
   낮에만 예쁜 팔레트는 이 게임에서 쓸 수 없다.

   스타일 파일은 이 함수에 색(pal)과 빛(panels), 그리고 그림체(kit)만 넘긴다.
   장면은 손대지 않는다 — 그래야 여럿을 나란히 놓고 한 축씩만 비교할 수 있다.
   ============================================================ */

import * as THREE from 'three';
import { hud, frameStats } from './hud.js';
import * as LP from './lowpoly.js';

const CSS = `
  #stage{right:340px !important;background:#0b0d12}
  #panels{position:absolute;inset:0;pointer-events:none;display:flex}
  #panels .p{flex:1;position:relative;border-right:1px solid #0006}
  #panels .p:last-child{border-right:0}
  #panels .lab{position:absolute;left:10px;top:9px;font:11px ui-monospace,monospace;
    letter-spacing:.06em;padding:2px 7px;border-radius:4px;background:#0009;color:#fff;
    border:1px solid #ffffff22}
  .sw{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 2px}
  .sw i{width:22px;height:22px;border-radius:4px;border:1px solid #ffffff22;display:block}
  .name{font-size:14px;color:#fff;margin:2px 0 4px;letter-spacing:.02em}
  .note{color:#8f9ab3;line-height:1.5;margin-bottom:6px}
  .ref{color:#6f7b93;line-height:1.5;margin:0 0 8px;font-style:italic}
`;

export function run(spec){
  LP.setKit(spec.kit || {});          // 그림체 먼저 — 캐시를 비운다
  LP.setPalette(spec.pal || {});

  const H = hud(spec.name);
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  H.el.querySelector('h1').insertAdjacentHTML('afterend',
    `<div class="name">${spec.name}</div><div class="note">${spec.note || ''}</div>
     ${spec.ref ? `<div class="ref">참고: ${spec.ref}</div>` : ''}
     <div class="sw">${Object.entries(spec.pal || {}).map(([k, v]) =>
       `<i style="background:#${v.toString(16).padStart(6,'0')}" title="${k} #${v.toString(16)}"></i>`).join('')}</div>`);

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('cv');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  renderer.toneMapping = spec.tone === 'aces' ? THREE.ACESFilmicToneMapping
                       : spec.tone === 'neutral' ? THREE.NeutralToneMapping
                       : THREE.NoToneMapping;
  renderer.toneMappingExposure = spec.exposure ?? 1;

  /* ---------- 빛 ---------- */
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left:-6, right:6, top:6, bottom:-6, near:0.5, far:30 });
  sun.shadow.bias = -0.0015;
  sun.shadow.radius = spec.softShadow ?? 1;
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-6, 4, -5);
  const lampLight = new THREE.PointLight(0xFFD9A0, 0, 6, 2);
  const monLight = new THREE.PointLight(0x9FD8FF, 0, 4, 2);
  scene.add(hemi, sun, sun.target, fill, lampLight, monLight);

  /* ---------- 장면 ---------- */
  const screens = [], neonParts = [], cats = [], props = [];
  const built = buildVignette(screens, neonParts, cats, props);
  scene.add(built);

  const lampObj = built.getObjectByName('lamp');
  lampLight.position.copy(lampObj.userData.bulb).add(lampObj.position);
  monLight.position.set(-0.2, 1.05, -1.3);

  /* 윤곽선 — 로우폴리에서 제일 큰 그림체 레버. 면을 그대로 두고 선만 얹는다. */
  const outlines = [];
  if (spec.outline){
    const edgeCache = new Map();
    const lm = new THREE.LineBasicMaterial({
      color: spec.outline.color ?? 0x000000,
      transparent: true, opacity: spec.outline.opacity ?? 0.55,
    });
    built.traverse(o => {
      if (!o.isMesh) return;
      let e = edgeCache.get(o.geometry.uuid);
      if (!e){ e = new THREE.EdgesGeometry(o.geometry, spec.outline.angle ?? 25); edgeCache.set(o.geometry.uuid, e); }
      const l = new THREE.LineSegments(e, lm);
      o.add(l);
      outlines.push(l);
    });
  }

  /* ---------- 카메라 ---------- */
  /* 벽은 북쪽(-z)과 서쪽(-x) 두 면뿐이다. 그래서 카메라는 반드시 +x/+z 쪽에 둔다 —
     반대편으로 돌리면 벽 바깥면이 화면의 절반을 덮는다. 드래그로 돌려보면 바로 보인다. */
  const CAM = { ortho:false, az:0.72, el:0.60, radius:3.9, fov:32, ...(spec.camera || {}) };
  const target = new THREE.Vector3(-0.1, 0.5, -0.7);
  let az = CAM.az, el = CAM.el, zoom = 1, spinning = false;
  let camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.5, 120);
  let ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -30, 60);
  const cam = () => CAM.ortho ? ortho : camera;

  function frame(aspect){
    const R = CAM.radius * zoom;
    if (CAM.ortho){
      const hH = aspect >= 1 ? R : R / aspect;
      ortho.left = -hH * aspect; ortho.right = hH * aspect;
      ortho.top = hH; ortho.bottom = -hH;
      ortho.updateProjectionMatrix();
    } else {
      const vh = 2 * Math.tan(camera.fov * Math.PI / 360);
      camera.aspect = aspect;
      camera.userData.dist = R / (Math.min(vh, vh * aspect) / 2);
      camera.updateProjectionMatrix();
    }
  }
  function placeCam(){
    const c = cam();
    const d = CAM.ortho ? 16 : camera.userData.dist;
    c.position.set(
      target.x + Math.cos(az) * Math.cos(el) * d,
      target.y + Math.sin(el) * d,
      target.z + Math.sin(az) * Math.cos(el) * d);
    c.lookAt(target);
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
    zoom = Math.max(0.45, Math.min(2.4, zoom * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive:false });

  /* ---------- 패널 ---------- */
  const panels = spec.panels;
  let solo = -1;
  const bar = document.createElement('div');
  bar.id = 'panels';
  bar.innerHTML = panels.map((p, i) =>
    `<div class="p" data-i="${i}"><div class="lab">${p.label}</div></div>`).join('');
  stage.appendChild(bar);
  bar.style.pointerEvents = 'auto';
  bar.querySelectorAll('.p').forEach(el => el.onclick = () => {
    solo = solo === +el.dataset.i ? -1 : +el.dataset.i;
    layout();
  });
  const layout = () => bar.querySelectorAll('.p').forEach((el, i) => {
    el.style.display = (solo < 0 || solo === i) ? '' : 'none';
  });

  function applyPanel(p){
    scene.fog = p.fog ? new THREE.Fog(p.fog[0], p.fog[1], p.fog[2]) : null;
    hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]); hemi.intensity = p.hemi[2];
    sun.color.setHex(p.sun[0]); sun.intensity = p.sun[1];
    const sp = p.sun[2] || [6, 11, 5];
    sun.position.set(sp[0], sp[1], sp[2]);
    sun.target.position.set(0, 0, -0.5);
    sun.target.updateMatrixWorld();
    fill.color.setHex(p.fill[0]); fill.intensity = p.fill[1];
    lampLight.intensity = (p.lamp || 0) * 6;
    monLight.intensity = (p.lamp || 0) * 1.6;

    /* 발광은 광원과 따로 다룬다. 광원만 줄이면 "어두운 화면"이 되고,
       발광 면이 살아 있어야 "불이 켜진 사무실"이 된다. */
    const sc = p.screen ?? LP.PAL.screen;
    const gk = p.glow ?? (p.lamp ? 0.85 : 0.10);
    screens.forEach(m => { m.material = LP.matGlow(sc, gk); });
    lampObj.children[3].material = p.lamp
      ? LP.matGlow(LP.PAL.glow, 0.9 * p.lamp) : LP.mat(LP.PAL.metal);
    if (spec.neon) neonParts.forEach(m => { m.material = LP.matGlow(LP.PAL.catnip, 0.75); });
  }

  /* ---------- 루프 ---------- */
  const fs = frameStats(1000);
  let last = performance.now();
  function loop(){
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    cats.forEach(c => c.update(dt));
    pace(cats, dt);
    if (spinning) az += dt * 0.12;

    /* 종이 인형 모드 — 방은 3D 로 두고 물건만 납작하게 눌러 카메라를 보게 한다.
       지금 게임의 스프라이트가 3D 공간에 서 있는 상태와 같다. 도트를 버리지 않고
       조명·깊이·그림자만 얻는 길이 있는지 보는 것. */
    if (spec.cutout){
      /* 물체의 local +z 가 카메라를 향해야 한다.
         카메라는 az 방향(cos az, sin az)에 있고, rotation.y=θ 인 물체의 +z 는 (sin θ, cos θ) 다.
         두 개를 같게 두면 θ = π/2 − az. 부호를 뒤집으면 전부 옆날로 서서 판이 사라진다. */
      const yaw = Math.PI / 2 - az;
      props.forEach(p => { p.rotation.y = yaw; p.scale.z = 0.05; });
    }

    const W = stage.clientWidth, Hh = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, Hh, false);

    const list = solo < 0 ? panels.map((p, i) => i) : [solo];
    const pw = W / list.length;
    frame(pw / Hh);
    placeCam();

    renderer.setScissorTest(true);
    list.forEach((pi, slot) => {
      const x = Math.round(slot * pw), w = Math.round(pw);
      renderer.setViewport(x, 0, w, Hh);
      renderer.setScissor(x, 0, w, Hh);
      applyPanel(panels[pi]);
      renderer.setClearColor(panels[pi].bg, 1);
      renderer.clear();
      renderer.render(scene, cam());
    });
    renderer.setScissorTest(false);

    const s = fs.tick();
    if (s){
      H.set('fps', s.fps.toFixed(1), s.fps < 30 ? 'warn' : 'ok');
      H.set(`draw call (${list.length}패널)`, String(renderer.info.render.calls));
      H.set('삼각형', renderer.info.render.triangles.toLocaleString());
    }
  }

  /* ---------- 조작 ---------- */
  H.btn('자동 회전', () => (spinning = !spinning));
  H.btn('원근 ⇄ 직교', b => {
    CAM.ortho = !CAM.ortho;
    b.textContent = CAM.ortho ? '직교 ⇄ 원근' : '원근 ⇄ 직교';
    return CAM.ortho;
  }, CAM.ortho);
  if (outlines.length) H.btn('윤곽선', () => {
    const on = !outlines[0].visible;
    outlines.forEach(l => { l.visible = on; });
    return on;
  }, true);
  H.btn('그림자', () => {
    renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
    sun.castShadow = renderer.shadowMap.enabled;
    scene.traverse(o => { if (o.isMesh) o.material.needsUpdate = true; });
    return renderer.shadowMap.enabled;
  }, true);
  H.btn('위에서 ⇄ 눈높이', () => { el = el > 0.5 ? 0.28 : CAM.el; });
  H.log('패널을 클릭하면 그 시간만 크게 본다. 드래그 회전 · 휠 확대.');

  layout();
  loop();
  return { scene, renderer, cats, H };
}

/* ============================================================
   장면 — 스타일마다 똑같다. 이 게임의 한 문장이 한 화면에 들어가야 한다:
   한 마리는 자리에서 일하고, 한 마리는 돌아다니고, 한 마리는 상자에서 잔다.
   그리고 구석에 캣닢 상자와 안 치운 서류가 있다.
   ============================================================ */
function buildVignette(screens, neon, cats, props){
  const g = new THREE.Group();

  for (let z = -3; z <= 1; z++)
    for (let x = -3; x <= 2; x++){
      const t = LP.box(1, 0.1, 1, ((x + z) % 2) ? LP.PAL.floor : LP.PAL.floorAlt, x + 0.5, -0.05, z + 0.5);
      t.castShadow = false;
      g.add(t);
    }

  g.add(LP.box(6.3, 2.0, 0.16, LP.PAL.wall, 0, 1.0, -3.08));
  g.add(LP.box(0.16, 2.0, 5.3, LP.PAL.wall, -3.08, 1.0, -0.5));
  g.add(LP.box(6.3, 0.11, 0.19, LP.PAL.wallTrim, 0, 0.055, -3.06));
  g.add(LP.box(0.19, 0.11, 5.3, LP.PAL.wallTrim, -3.06, 0.055, -0.5));

  // 바닥·벽은 put 을 안 거친다 — 종이 인형 모드에서 무대는 3D 로 남아야 하기 때문
  const put = (o, x, z, ry = 0, y = 0) => {
    o.position.set(x, y, z); o.rotation.y = ry; g.add(o); props.push(o); return o;
  };

  put(LP.desk(), 0.2, -1.5);
  // 회전은 put 이 덮어쓰므로 여기서 준다 — 빌더에 넘기면 조용히 0 이 된다
  const m1 = put(LP.monitor(), -0.25, -1.68, 0.14);
  const m2 = put(LP.monitor(), 0.75, -1.68, -0.14);
  screens.push(m1.children[3], m2.children[3]);
  put(LP.papers(), 0.25, -1.15, 0.3);

  const lamp = LP.lamp();
  lamp.name = 'lamp';
  put(lamp, 1.15, -1.78, 0, 0.65);

  put(LP.chair(Math.PI), 0.2, -0.52);
  put(LP.shelf(), -1.75, -2.68);
  put(LP.plant(), -2.45, -2.45);
  put(LP.napBox(), -2.2, 0.35, 0.28);
  put(LP.catnip(neon), 1.75, 0.45, -0.3);
  put(LP.docStack(6), -0.85, 0.6);

  const mk = (fur, x, y, z, ry, state) => {
    const c = LP.cat(fur);
    c.root.position.set(x, y, z);
    c.root.rotation.y = ry;
    c.root.scale.setScalar(1.25);
    c.setState(state);
    g.add(c.root);
    cats.push(c);
    props.push(c.root);
    return c;
  };
  mk(0xC9A06A, 0.2, 0.44, -0.60, Math.PI, 'sit');          // 자리에서 근무
  mk(0xF2EDE4, -2.2, 0.12, 0.35, 0.5, 'sleep');            // 낮잠 상자
  const walker = mk(0x3B3733, 1.3, 0, -0.3, -1.9, 'walk'); // 돌아다니는 중
  walker.a = new THREE.Vector3(1.5, 0, -0.5);
  walker.b = new THREE.Vector3(-1.1, 0, 0.8);
  walker.to = walker.b;

  return g;
}

/* 걷는 고양이 하나만 왕복시킨다. 정지 화면이면 로우폴리가 조립 설명서처럼 보인다. */
function pace(cats, dt){
  const c = cats[2];
  if (!c) return;
  const d = c.to.clone().sub(c.root.position).setY(0);
  if (d.length() < 0.25) c.to = c.to === c.a ? c.b : c.a;
  d.normalize();
  c.root.position.addScaledVector(d, dt * 0.6);
  let diff = Math.atan2(d.x, d.z) - c.root.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  c.root.rotation.y += diff * Math.min(1, dt * 4);
}
