/* ============================================================
   doodle.js — 손그림 고양이.

   두 가지 길을 다 만든다.

   ① 종잇장 — 그림 한 장을 판에 붙여 3D 공간에 세운다. 손그림의 선이 그대로 산다.
      실제 그림 파일이 있으면 그걸 쓰고, 없으면 여기서 캔버스에 흉내내어 그린다.
      (흉내는 자리를 지키기 위한 것이다. 진짜는 사람이 그린 선이다.)
   ② 조잡 폴리곤 — 폴리곤으로 만들되 정점을 흔들어 반듯함을 깨뜨린다.
      로우폴리가 "정확해서" 매끈해 보이는 것이므로, 부정확하게 만들면 손맛이 난다.

   손그림처럼 보이게 하는 것은 사실 하나다: **선이 떨려야 한다.**
   자로 그은 선은 아무리 삐뚤어도 도면으로 보이고, 떨리는 선은 아무리 단정해도 손으로 보인다.
   그래서 이 파일의 핵심은 그리기가 아니라 jitter 다.
   ============================================================ */

import * as THREE from './vendor/three.module.min.js';

/* 씨앗 있는 난수 — 같은 고양이는 늘 같은 모양으로 떨려야 한다.
   매 프레임 새로 흔들면 그림이 부글거린다. */
function rng(seed){
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   ① 종잇장 — 캔버스에 그리는 손그림 흉내
   ============================================================ */

/* 점들을 이어 그리되 각 점을 조금씩 흔든다. 손으로 그은 선의 정체가 이것이다. */
function wobble(ctx, pts, r, amp, close){
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * amp, jy = y + (r() - 0.5) * amp;
    if (i === 0) ctx.moveTo(jx, jy);
    else ctx.lineTo(jx, jy);
  });
  if (close) ctx.closePath();
}

/* 옆모습 고양이 한 마리. 오른쪽을 본다.
   원본 그림의 골격을 따랐다 — 큰 삼각 귀, 납작한 머리, 길쭉한 몸, 막대 다리, 올린 꼬리. */
export function drawCat(ctx, W, H, opt = {}){
  const fur = opt.fur || '#F3EBD3';
  const ink = opt.ink || '#3A342E';
  const r = rng(opt.seed || 7);
  const amp = opt.amp ?? 3.2;

  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = opt.line ?? 2.2;
  ctx.strokeStyle = ink;
  ctx.fillStyle = fur;

  const S = Math.min(W, H) / 100;      // 100 단위 좌표계로 그린다
  const P = pts => pts.map(([x, y]) => [x * S, y * S]);

  /* 몸통 + 머리를 한 덩어리로 — 손그림은 부위를 따로 안 그린다 */
  const body = P([
    [18, 62], [16, 50], [22, 46], [40, 45],       // 엉덩이 · 등
    [46, 30], [52, 44], [58, 28], [66, 45],       // 귀 둘
    [82, 46], [90, 54], [86, 62], [74, 64],       // 머리 앞 · 턱
    [70, 72], [64, 64], [40, 64], [34, 74], [28, 64],
  ]);
  wobble(ctx, body, r, amp, true);
  ctx.fill();
  ctx.stroke();

  /* 다리 — 막대 네 개. 두 개는 앞, 두 개는 뒤. */
  ctx.lineWidth = (opt.line ?? 2.2) * 0.9;
  [[30, 64, 30, 82], [38, 64, 37, 80], [62, 64, 63, 82], [70, 64, 69, 79]].forEach(([x1,y1,x2,y2]) => {
    wobble(ctx, P([[x1,y1],[x2,y2]]), r, amp * 0.7, false);
    ctx.stroke();
  });

  /* 꼬리 — 뒤에서 올라간다 */
  ctx.lineWidth = (opt.line ?? 2.2) * 1.6;
  wobble(ctx, P([[18, 58], [10, 46], [8, 30], [12, 22]]), r, amp * 0.8, false);
  ctx.stroke();

  /* 얼굴 — 점눈 둘과 W 입. 조잡할수록 좋다. */
  ctx.lineWidth = (opt.line ?? 2.2) * 0.85;
  ctx.fillStyle = ink;
  [[68, 53], [82, 53]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.ellipse(x * S + (r() - 0.5) * 2, y * S + (r() - 0.5) * 2, 2.2 * S, 2.0 * S, 0, 0, 7);
    ctx.fill();
  });
  wobble(ctx, P([[73, 57], [75, 60], [77, 57], [79, 60], [81, 57]]), r, amp * 0.5, false);
  ctx.stroke();
}

/* 그림 한 장 → 3D 공간에 세운 판. */
export function cutout(opt = {}){
  const W = opt.px || 256, H = Math.round(W * 0.62);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  drawCat(cv.getContext('2d'), W, H, opt);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;

  return build(tex, H / W, opt);
}

/* 파일이 있으면 그걸 쓴다 — 진짜 손그림.

   종이에 그린 그림은 배경이 흰색이다. 그대로 붙이면 고양이가 아니라 흰 판이 서 있게 된다.
   그래서 밝은 픽셀을 투명으로 뺀다(keyWhite). 이러면 그림 파일을 손대지 않고
   그냥 저장만 해도 바로 쓸 수 있다 — 편집을 요구하지 않는 게 중요하다.

   가장자리를 한 겹 부드럽게 빼서 계단이 안 생기게 한다. */
export function cutoutFrom(url, opt = {}){
  /* 자리를 먼저 잡아 두고, 그림이 오면 텍스처를 **새로 만들어 끼운다.**
     같은 캔버스를 키워서 needsUpdate 만 세우면 GPU 쪽은 처음의 빈 텍스처를 계속 들고 있다 —
     크기가 바뀐 캔버스는 갱신이 아니라 교체로 다뤄야 한다. */
  const api = build(blankTex(), 0.62, opt);
  api.plane.visible = false;                 // 그림이 오기 전에는 안 보인다

  const finish = (cv) => {
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    const old = api.plane.material.map;
    api.plane.material.map = tex;
    api.plane.material.emissiveMap = tex;
    api.plane.material.needsUpdate = true;
    if (old) old.dispose();

    const h = opt.h || 0.62;
    api.plane.geometry.dispose();
    const g = new THREE.PlaneGeometry(h * cv.width / cv.height, h);
    g.translate(0, h / 2, 0);                // 발밑이 y=0
    api.plane.geometry = g;
    api.plane.visible = true;
    if (opt.onload) opt.onload(api);
  };

  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently:true });
    ctx.drawImage(img, 0, 0);
    /* 종이에 그린 그림은 배경이 흰색이다. 그대로 붙이면 흰 판이 서 있게 되므로 빼준다.
       (tools/split-doodles.js 를 거친 그림은 이미 투명하니 이 단계가 아무 일도 안 한다.) */
    /* 이미 투명 배경이 있는 그림에는 흰색 제거를 걸지 않는다.
       크림색처럼 밝게 칠한 고양이는 밝기가 배경과 비슷해서, 한 번 더 걸면
       칠한 부분이 통째로 지워진다 (치즈가 반투명해지던 이유). */
    let hasAlpha = false;
    {
      const probe = ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < probe.length; i += 4 * 7) if (probe[i] < 250){ hasAlpha = true; break; }
    }
    if (opt.keyWhite !== false && !hasAlpha){
      const d = ctx.getImageData(0, 0, cv.width, cv.height);
      const px = d.data;
      const hi = opt.whiteAt ?? 236, lo = opt.whiteSoft ?? 208;
      for (let i = 0; i < px.length; i += 4){
        if (px[i+3] === 0) continue;
        const L = 0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2];
        if (L >= hi) px[i+3] = 0;
        else if (L > lo) px[i+3] = Math.round(px[i+3] * (hi - L) / (hi - lo));
      }
      ctx.putImageData(d, 0, 0);
    }
    brighten(ctx, cv.width, cv.height, opt);
    finish(cv);
  };
  /* 파일이 없으면 조용히 흉내 그림으로 대체한다. 자리를 비워 두면
     "안 그려진 건지 못 찾은 건지" 를 구분할 수 없다. */
  img.onerror = () => {
    console.warn('[doodle] 그림을 못 읽었다 — 흉내로 대체:', url);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 159;
    drawCat(cv.getContext('2d'), cv.width, cv.height, opt);
    finish(cv);
  };
  img.src = url;
  return api;
}

/* ============================================================
   방향 세트 — 한 고양이의 앞·뒤·옆 그림을 한 벌로 묶는다.

   옆모습은 한 장만 그리고 좌우로 뒤집어 쓴다. 2D 게임이 늘 하던 방식이고,
   손그림에서는 특히 중요하다 — 좌우를 따로 그리면 선이 미묘하게 달라져서
   방향이 바뀔 때마다 다른 고양이로 보인다.
   ============================================================ */
export function cutoutSet(urls, opt = {}){
  const api = build(blankTex(), 0.62, opt);
  api.plane.visible = false;
  api.kind = 'cutoutSet';

  const tex = {}, ratio = {};
  let view = null, flip = 1;

  const apply = () => {
    const k = tex[view] ? view : (tex.side ? 'side' : Object.keys(tex)[0]);
    if (!k) return;
    api.plane.material.map = tex[k];
    api.plane.material.needsUpdate = true;
    const h = opt.h || 0.62;
    api.plane.geometry.dispose();
    const g = new THREE.PlaneGeometry(h * ratio[k], h);
    g.translate(0, h / 2, 0);
    api.plane.geometry = g;
    /* 옆모습만 뒤집는다. 앞·뒤를 뒤집으면 그림이 거울상이 되어 어색해진다. */
    api.plane.scale.x = (k === 'side' ? flip : 1);
    api.plane.visible = true;
  };

  Object.keys(urls).forEach(key => {
    loadDrawing(urls[key], opt, cv => {
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
      tex[key] = t;
      ratio[key] = cv.width / cv.height;
      if (!view) view = key;
      apply();
    });
  });

  api.setView = k => { if (k !== view && tex[k]){ view = k; apply(); } };
  api.setFlip = f => {
    const nf = f < 0 ? -1 : 1;
    if (nf === flip) return;
    flip = nf;
    if (view === 'side') api.plane.scale.x = flip;
  };
  api.view = () => view;
  return api;
}

/* 그림 한 장을 읽어 캔버스로 넘긴다. 못 읽으면 흉내 그림으로 대체한다. */
function loadDrawing(url, opt, done){
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently:true });
    ctx.drawImage(img, 0, 0);
    let hasAlpha = false;
    const probe = ctx.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < probe.length; i += 4 * 7) if (probe[i] < 250){ hasAlpha = true; break; }
    if (opt.keyWhite !== false && !hasAlpha){
      const d = ctx.getImageData(0, 0, cv.width, cv.height), px = d.data;
      const hi = opt.whiteAt ?? 236, lo = opt.whiteSoft ?? 208;
      for (let i = 0; i < px.length; i += 4){
        const L = 0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2];
        if (L >= hi) px[i+3] = 0;
        else if (L > lo) px[i+3] = Math.round(px[i+3] * (hi - L) / (hi - lo));
      }
      ctx.putImageData(d, 0, 0);
    }
    brighten(ctx, cv.width, cv.height, opt);
    done(cv);
  };
  img.onerror = () => {
    console.warn('[doodle] 그림을 못 읽었다 — 흉내로 대체:', url);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 159;
    drawCat(cv.getContext('2d'), cv.width, cv.height, opt);
    done(cv);
  };
  img.src = url;
}


/* 손그림은 종이에 그린 것이라 그대로 쓰면 3D 조명 아래서 칙칙해진다.
   채도를 올리고 전체를 흰쪽으로 조금 들어 올린다 — 선(어두운 픽셀)은 거의 그대로 두고
   칠한 면만 밝아지도록, 밝을수록 더 들어 올린다. */
function brighten(ctx, w, h, opt){
  const sat = opt.saturate ?? 1.35, lift = opt.lift ?? 0.16;
  const d = ctx.getImageData(0, 0, w, h), px = d.data;
  for (let i = 0; i < px.length; i += 4){
    if (px[i+3] === 0) continue;
    const L = 0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2];
    const k = lift * Math.min(1, L / 200);          // 어두운 선은 덜 든다
    for (let c = 0; c < 3; c++){
      let v = L + (px[i+c] - L) * sat;              // 채도
      v = v + (255 - v) * k;                        // 밝기
      px[i+c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  ctx.putImageData(d, 0, 0);
}

function blankTex(){
  const cv = document.createElement('canvas');
  cv.width = cv.height = 2;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function build(tex, ratio, opt){
  const h = opt.h || 0.62;
  const geo = new THREE.PlaneGeometry(h / ratio, h);
  geo.translate(0, h / 2, 0);                      // 발밑이 y=0
  /* emissiveMap 으로 제 색을 조금 스스로 낸다. 순수 Lambert 로만 두면
     그늘에 들어간 고양이가 회색 덩어리가 된다 — 그림은 계속 읽혀야 한다. */
  const mat = new THREE.MeshLambertMaterial({
    map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    emissiveMap: tex, emissive: new THREE.Color(0x555555),
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.castShadow = true;
  plane.receiveShadow = false;

  const root = new THREE.Group();
  root.add(plane);

  let t = 0, state = 'idle', face = 1;
  const api = {
    root, plane, kind: 'cutout',
    /* 발이 닿는 높이. 의자에 앉거나 캣타워에 올라가면 렌더러가 여기에 값을 넣는다.
       update 가 y 를 통째로 덮어쓰면 올려놓은 높이가 매 프레임 0 으로 돌아간다. */
    baseY: 0,
    /* 빌보드 = 늘 카메라를 본다. 끄면 진행 방향을 본다(2D 스프라이트처럼 좌우 반전). */
    billboard: opt.billboard !== false,
    setState(s){ state = s; },
    setFacing(f){ face = f < 0 ? -1 : 1; },
    update(dt, camera){
      t += dt;
      if (api.billboard && camera){
        root.rotation.y = Math.atan2(
          camera.position.x - root.position.x, camera.position.z - root.position.z);
      }
      /* 방향 세트는 자기 반전을 직접 관리한다 — 여기서 덮어쓰면 매 프레임 풀린다. */
      if (api.kind !== 'cutoutSet')
        plane.scale.x = Math.abs(plane.scale.x) * (api.billboard ? face : 1);
      /* 살아 있게 보이는 최소한 — 걸을 땐 통통 튀고, 잘 땐 숨만 쉰다.
         종잇장이라 관절이 없으니 전체를 흔드는 수밖에 없다. 그게 또 손그림답다. */
      if (state === 'walk'){
        root.position.y = api.baseY + Math.abs(Math.sin(t * 9)) * 0.035;
        root.rotation.z = Math.sin(t * 9) * 0.05;
      } else if (state === 'sleep'){
        root.position.y = api.baseY;
        root.rotation.z = 1.35;                    // 옆으로 누인다
      } else {
        root.position.y = api.baseY;
        root.rotation.z = Math.sin(t * 1.8) * 0.02;
      }
    },
  };
  return api;
}

/* ============================================================
   ② 조잡 폴리곤 — 정점을 흔들어 반듯함을 깬다
   ============================================================ */

/* 로우폴리가 매끈해 보이는 건 정확하기 때문이다. 정점을 조금씩 밀면
   같은 형태가 손으로 깎은 것처럼 보인다. 씨앗을 고정해 부글거리지 않게 한다. */
export function jitter(root, amount = 0.02, seed = 3){
  const r = rng(seed);
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || o.userData.jittered) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const p = g.attributes.position;
    /* 같은 자리의 정점은 같이 움직여야 면이 안 벌어진다 — 좌표를 키로 묶는다. */
    const moved = new Map();
    for (let i = 0; i < p.count; i++){
      const k = `${p.getX(i).toFixed(3)}|${p.getY(i).toFixed(3)}|${p.getZ(i).toFixed(3)}`;
      let d = moved.get(k);
      if (!d){
        d = [(r() - 0.5) * amount, (r() - 0.5) * amount, (r() - 0.5) * amount];
        moved.set(k, d);
      }
      p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
    g.computeVertexNormals();
    o.geometry = g;
    o.userData.jittered = true;
  });
  return root;
}

/* 굵은 윤곽선 — 손그림의 선을 흉내낸다. 뒷면을 키워서 그리는 고전적인 방법이라
   추가 패스 없이 드로우콜 하나로 끝난다. */
export function outline(root, color = 0x3A342E, thickness = 0.02){
  const add = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.isOutline) return;
    const m = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({
      color, side: THREE.BackSide,
    }));
    m.userData.isOutline = true;
    m.scale.setScalar(1 + thickness / Math.max(0.05, o.scale.x));
    m.castShadow = false;
    add.push([o, m]);
  });
  add.forEach(([o, m]) => o.add(m));
  return root;
}
