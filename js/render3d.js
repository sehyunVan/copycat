/* ============================================================
   render3d.js — 사무실을 3D 로 그리는 렌더러.

   ui.js 의 도트 렌더러를 대체하지 않고 **나란히** 산다. 아직 확인 안 된 것이
   하나 남아 있기 때문이다 — WebGL 캔버스가 Document PiP 창을 건너가서도
   사는가(spike/1-pip.html). 그게 안 되면 위젯 모드가 죽고, 위젯 모드는
   이 게임의 존재 이유다. 그래서 도트 렌더러를 지우지 않는다.

   이 파일이 지키는 계약은 ui.js 가 부르는 다섯 개뿐이다:
     build()   정적 사무실 다시 세우기 (renderTiles 대응)
     sync()    매 프레임 고양이·서류 (syncActors 대응)
     fit()     크기 맞추기 (fitWorld 대응)
     night()   시간대 색 (renderNight 대응)
     say/float 월드 좌표에 붙는 말풍선·숫자

   시뮬레이션은 한 줄도 안 건드린다. world.js 의 격자와 sim.js 의 고양이를
   그대로 읽어서 그린다 — 렌더러는 읽기만 한다.

   좌표: 월드 격자 (x, y) → 3D (x + 0.5, 0, y + 0.5). 타일 한 칸이 1 유닛.
   ============================================================ */

import * as THREE from './three/vendor/three.module.min.js';
import * as LP from './three/lowpoly.js';
import { cat3 } from './three/cat3.js';
import { cutoutFrom } from './three/doodle.js';
import * as CS from './three/catsculpt.js';
import * as FP from './three/facepaint.js';
import { collapse } from './three/merge.js';
import * as EERIE from './three/eerie.js';
import * as OUTRO from './three/outro.js';
import * as PARCEL from './three/parcel.js';
import { DRAWS } from '../assets/cats_drawn/list.js';

/* s3 에서 고른 파스텔. spike/lib/pastel.js 와 같은 값이다. */
const PASTEL = {
  floor:0xF3E9DE, floorAlt:0xEBDCCF, lounge:0xE7BFB8,
  wall:0xFDF8F3, wallTrim:0xEADCD0,
  wood:0xE0B48A, woodDark:0xC59B78,
  metal:0xCBD4DE, metalDark:0x9AA6B4,
  screen:0xA8C4D8, fabric:0xA8B8E0, fabric2:0xF0A9A0,
  leaf:0xA8D3A0, leafDark:0x86BC8A, pot:0xE8A98C,
  paper:0xFFFDF8, ink:0x6B6560, catnip:0xA9DE9C, glow:0xFFC672, sky:0xBBD9F0,
};

/* ---------- 벽지·바닥 ----------
   무늬는 js/decor.js 가 캔버스에 그리고 여기서 텍스처로 감기만 한다.
   두 렌더러(3D·도트)가 **같은 그림 함수**를 쓰는 게 이 배선의 요점이다 —
   견본책에서 본 것과 방에 깔린 것이 다르면 그건 상점이 아니라 사기다.

   벽은 덩어리마다 제 길이로 굽고 바닥은 방 하나를 통째로 굽는다. 그래서 이음매가
   없고, 무늬가 칸 격자에 정확히 맞는다(체커·다다미가 반 칸씩 밀리면 다 무너진다).

   **collapse 에서 빠져야 한다**(userData.dynamic). 정적 병합은 색을 정점에 구워
   머티리얼을 하나로 만드는 최적화라, 여기 오면 텍스처가 통째로 사라진다. */
const WALL_PPU = 96, FLOOR_PPU = 64;
const _dtex = new Map();
function decorTex(kind, id, w, h, ppu, opt){
  const key = `${kind}|${id}|${w.toFixed(2)}|${h.toFixed(2)}|${ppu}|${(opt && opt.dadoH) || 0}`;
  let t = _dtex.get(key);
  if (!t){
    const D = window.DECOR;
    if (!D) return null;
    const cv = kind === 'floor' ? D.floorCanvas(id, w, h, ppu)
             : kind === 'rug'   ? D.rugCanvas(id, ppu)
             : D.wallCanvas(id, w, h, ppu, opt);
    if (!cv) return null;
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = Math.min(4, renderer ? renderer.capabilities.getMaxAnisotropy() : 1);
    _dtex.set(key, t);
  }
  return t;
}
/* 벽지를 갈면 옛 텍스처는 버린다 — 안 버리면 벌 수만큼 VRAM 이 곱해진다
   (TODO 34 의 「머티리얼 수가 벌 수만큼 곱해지지 않는지」가 이 줄이다) */
function decorReset(){
  _dtex.forEach(t => t.dispose());
  _dtex.clear();
}
let decorKey = '';

/* 무늬 있는 벽 한 덩어리. 여섯 면 중 **보이는 네 면**에만 벽지를 붙이고 위·아래는
   밑색으로 둔다 — 벽 윗마감에 무늬가 늘어붙으면 벽지가 아니라 얼룩이다. */
function wallBox(bw, h, bd, x, y, z){
  const id = window.DECOR ? window.DECOR.cur().wall : 'plain';
  const tex = decorTex('wall', id, Math.max(bw, bd), h, WALL_PPU, { dadoH: h >= 2 ? 0.95 : 0 });
  const plain = LP.mat(LP.PAL.wall);
  if (!tex) return LP.box(bw, h, bd, LP.PAL.wall, x, y, z);
  const side = new THREE.MeshLambertMaterial({ map: tex, flatShading: false });
  const m = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd),
                           [side, side, plain, plain, side, side]);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.dynamic = true;
  return m;
}


/* 러그 한 장 — TODO 49.

   **판이 아니라 얇은 상자다.** 바닥판(위의 큰 판 하나) 위에 0.01 띄운 판을 얹으면
   각도에 따라 z-fighting 이 나고, 그건 「가끔 지지직거리는 바닥」으로 보인다.
   두께를 주면 그 문제가 아예 없고, 옆면이 한 겹 보이는 게 실제로 러그처럼 읽힌다.

   그림자는 안 만든다 — 바닥에 붙은 물건이 제 그림자를 만들면 러그가 아니라 얼룩이다
   (LP.rug 가 처음부터 castShadow=false 로 적혀 있었다. 그 판단을 그대로 가져온다).

   원형은 원기둥이다. 알파를 안 쓰는 이유는 투명한 판이 그림자·정렬에서 늘 한 가지씩
   더 챙겨야 하기 때문이고, 원기둥의 윗면 UV 가 정사각 캔버스에 내접하는 원이라
   **같은 캔버스를 그대로** 쓸 수 있다. */
const RUG_PPU = 72, RUG_H = 0.026;
/* 깔린 러그의 메시. debug() 가 읽는다 — 「그 칸에 러그가 있나」를 geomAt 으로 재면
   같은 칸의 의자·책상 정점이 같이 잡혀서 두께가 0.88 로 나온다(41번에서 오락기 키를
   벽에서 재다 틀린 것과 같은 함정이다). 러그는 러그 메시에서 재야 한다. */
let rugMeshes = [];
/* 「작동하는 가구」 표시로 붙인 것들 — debug() 가 센다(TODO 35 실험) */
let marks35 = [], markPts = [];
/* 문에 심은 점광원 — 사무실을 다시 세울 때 같이 걷어야 한다(안 걷으면 겹쳐 쌓인다) */
let doorLights = [];
function rugMesh(r){
  const D = window.DECOR;
  if (!D || !D.rugById) return null;
  const it = D.rugById[r.id];
  if (!it) return null;
  const tex = decorTex('rug', r.id, it.w, it.h, RUG_PPU);
  const top = tex ? new THREE.MeshLambertMaterial({ map: tex, flatShading: false })
                  : LP.mat(LP.PAL.lounge);
  const side = LP.mat(parseInt(it.base.slice(1), 16));
  const m = it.round
    ? new THREE.Mesh(new THREE.CylinderGeometry(Math.min(it.w, it.h) / 2, Math.min(it.w, it.h) / 2, RUG_H, 28),
                     [side, top, side])
    : new THREE.Mesh(new THREE.BoxGeometry(it.w, RUG_H, it.h),
                     [side, side, top, side, side, side]);
  /* rot 은 90° 단위. 발자국이 바뀌지만 **아무 칸도 안 막으므로** 검증할 것이 없다 —
     1번이 두 칸짜리 회전을 자른 이유가 여기서는 아예 안 생긴다. */
  const rot = (r.rot | 0) % 4;
  const sw = rot % 2 ? it.h : it.w, sh = rot % 2 ? it.w : it.h;
  m.position.set(r.x + sw / 2, RUG_H / 2, r.y + sh / 2);
  m.rotation.y = rot * (Math.PI / 2);
  m.castShadow = false; m.receiveShadow = true;
  m.userData.dynamic = true;                  // 병합되면 무늬가 죽는다
  return m;
}

/* 시간대 — 실시간 시계를 따라간다. 낮에만 예쁜 팔레트는 이 게임에서 못 쓴다. */
/* pane: 창밖 색과 발광 세기. 창은 벽에 뚫린 구멍이 아니라 밝은 판이라
   (lowpoly.windowUnit 참고) 시간대는 이 색 하나로 말한다. 블라인드를 다 내려 두었으므로
   살 틈으로 보이는 이 색이 **창이 하는 일의 전부**다 — 방으로 들어오는 빛 자락(win)은
   2026-08-25 에 없앴다. */
const TIME = {
  /* 아침은 낮보다 어둡다 — eerie 쪽 표(three/eerie.js)와 같은 판단이다.
     해를 낮게 걸고(y 13 → 6) 형광등을 켜 둔다. 이 표는 도트 폴백 쪽 파스텔이지만
     같은 시각을 두 그림체가 다르게 말하면 스크린샷이 서로를 부정한다. */
  /* **lampColor 가 이 표에 없었다.** 그래서 mixTime 이 기본값(흰색)을 돌려주고,
     night() 의 `if (p.lampColor)` 가 그 흰색을 그대로 등에 칠했다 — 파스텔 판에서는
     책상등도 천장등도 **순백**이었다는 뜻이다. 조명 색을 손보다가 발견했고,
     eerie 표와 같은 값을 넣어 고쳤다. 두 그림체가 같은 시각을 다르게 말하면 안 된다는
     이 표의 첫 줄이 색에도 그대로 걸린다. */
  morning: { tint:0xF0E4DC, bg:0xCFC6D4, hemi:[0xF4F0F4, 0xBEB6C0, 1.00], sun:[0xFFEEDA, 0.85, [9, 6, -2]],
             fill:[0xD8E4FF, 0.52], lamp:0.45, lampColor:0xFFC47C, pane:[0xF6C49C, 0.30] },
  day:     { bg:0xEDE9F2, hemi:[0xFFFFFF, 0xD8D2DC, 1.30], sun:[0xFFFAF0, 1.30, [6, 15, 0]],
             fill:[0xD8E4FF, 0.42], lamp:0, lampColor:0xFFC069, pane:[0x9FCDEE, 0.30] },
  /* 오후 — 시간대가 다섯이 되면서 생긴 칸(sim.js SKY_AT). 파스텔판은 폴백이므로
     eerie 처럼 필름을 갈지 않고 **빛만** 낮과 저녁 사이에 앉힌다. */
  afternoon:{ tint:0xFFE4CC, bg:0xF0E0DA, hemi:[0xFFF4E6, 0xDCC8BA, 1.18], sun:[0xFFE0B4, 1.30, [7, 11, 1]],
             fill:[0xD0DCFF, 0.40], lamp:0.18, lampColor:0xFFB050, pane:[0xE8CCA4, 0.32] },
  evening: { tint:0xFFCBA6, bg:0xF0D2C8, hemi:[0xFFEFE2, 0xD6BCB2, 1.10], sun:[0xFFC49A, 1.35, [10, 3.5, 2]],
             fill:[0xC6D2FF, 0.40], lamp:0.35, lampColor:0xFFA742, screen:0xB6CFE0, pane:[0xFF9A68, 0.42] },
  night:   { bg:0x8E93C4, hemi:[0xB9BEE8, 0x6F74A0, 0.80], sun:[0x9FA8E0, 0.50, [-3, 9, -6]],
             fill:[0xC0B0E0, 0.40], lamp:1, lampColor:0xFFCE8A, screen:0xCDEAF2, pane:[0x2E3A78, 0.55] },
};

/* 책상 등이 닿는 거리(칸). **5.5 였다가 3.2 로 줄였다.**

   세기 문제가 아니라 반경 문제였다: 반경 5.5칸짜리 등이 자리마다 하나씩 있으면
   여섯 개가 11×9 사무실을 통째로 덮는다. 그러면 등을 아무리 밝게 해도 웅덩이가
   안 생기고 방 전체가 고르게 따뜻해진다 — 「따뜻한 등불」이 아니라 「따뜻한 형광등」이다.
   낮 화면의 밝기 폭이 27밖에 안 되던 이유의 절반이 여기 있었다(spike/shot-tone.js).

   3.2 는 웅덩이 한가운데를 안 건드린다. three 의 감쇠(decay 2)는 거리 제한을
   **꼬리에서만** 자르기 때문이다 — 등 바로 밑(0.44칸)은 0.1% 도 안 어두워지고,
   두 칸 밖이 26%, 세 칸 밖이 사실상 0 이 된다. 책상 위는 그대로 두고 통로만 식힌다.

   2.2 까지 줄여 봤고 거기서 깨진다: 어두운 영역이 화면의 52%(밤 67%)가 되면서
   통로를 지나는 고양이가 실루엣으로만 남는다. 이 게임은 곁눈질하는 화면이라
   그건 분위기가 아니라 정보 손실이다.

   시간대표가 lampR 을 주면 그쪽이 이긴다(three/tone.js 의 ?lr= 다이얼).
   **아래 night() 의 `* 5.5` 와는 다른 수다** — 그건 세기 배율이고 이건 거리다. */
const LAMP_R = 3.2;

/* ============================================================
   문에는 불이 들어와 있다 (TODO 35)

   💿 CD 플레이어 · 📅 벽걸이 달력 · 📌 제휴 게시판 · 📕 도배 견본책 — 이 넷은
   고양이의 숫자를 바꾸는 가구가 아니라 **설정을 바꾸는 문**이고, 이 게임의 UI 를
   일부러 방 안에 놓은 것들이다(「조작은 UI 패널이 아니라 세계 안의 물건에」).
   첫 출근 안내(32번)가 한 번 소개하고 나면 **다시 알려 주는 자리가 없었다.**

   2번의 「반짝이는 가구 금지」와는 안 부딪힌다. 그 규칙은 **숨겨 둔 일회성 단서**를
   찍어 주지 말라는 것이었고(찍어 주면 조사가 「빛나는 걸 누르기」가 된다), 문은
   숨긴 것이 아니다. 오히려 단서는 장식에도 붙어 있어서(벽시계의 Q22) 문에 표시를
   달면 단서 찾는 눈은 **표시 없는 쪽**으로 간다 — 그 규칙이 걱정한 방향과 반대다.

   ── 네 안을 만들어서 재고 골랐다 ──

   같은 자리에서 찍어 픽셀로 쟀다(spike/shot-doors.js · shot-zoom.js).
   표시 자리의 24×24 평균 rgb, 기준선은 (125,118,106):

     손잡이(형태)        (125,119,107)   +1     벽이 이미 작은 물건으로 가득해서 하나 더는 안 읽힌다
     발광 테두리(빛 흉내) (125,118,106)    0     **픽셀 단위로 아무 일도 안 한다**
     색표(채도)          (113,95,85)     채도만  읽히긴 하나 어두우면 죽는다
     광원(진짜 빛)        (189,177,155)  +64    **이것만 낮에도 밤에도 읽힌다**

   테두리가 0 이었던 이유가 나머지를 설명한다: 그건 광원이 아니라 **반투명 껍데기**였다.
   이 방에서 눈에 걸리는 것은 전부 점광원(모니터·스탠드·창)이고, 공통점은 빛을 더한 게
   아니라 **주변을 밝히는 것**이다. **안개는 웅덩이를 못 만든다** — 그래서 안개가
   흉내낼 수 없는 유일한 신호다.

   ── 그래서 스탠드와 같은 구조다 ──

   작은 발광판 + 그 자리의 PointLight. lowpoly.lamp 의 유리판과 render3d 의 등불이
   정확히 이 짝이다. 다만 **시간대에 안 매단다**: 스탠드는 `p.lamp` 가 0 인 낮에 꺼지는데,
   문 표시는 낮에도 「누를 수 있다」를 말해야 한다.

   세기와 반경은 클로즈업에서 재서 잘랐다 — 처음 값(1.8 · 1.5칸)은 벽 한 면을 태웠고
   그건 표시등이 아니라 조명이다. 지금은 물건 언저리에서 끝난다.

   `?mark=off` 로 끌 수 있다. 저장하지 않는다 — 비교 사진을 찍는 도구가 쓰는 손잡이이고
   (`?debug=1`·`?style=pastel` 과 같은 규칙), 설정이 아니다.
   ============================================================ */
const DOOR_MARK = !/[?&]mark=off/.test(location.search);
const DOOR_LAMP = 0xFF9F6B;      // UI 의 강조색 — 화면에서 「누를 수 있는 것」이 이미 이 색이다
/* 문 넷 — story.js 가 조사 창으로 안 보내고 **모달을 여는** 것들이 곧 이 목록이다.
   그 조건이 story.js 에 이미 있으므로 여기 적는 것은 사본이 아니라 같은 사실이고,
   문을 하나 더 만들 때 **두 곳을 같이 고쳐야 한다**(안 그러면 표시가 거짓말을 한다). */
function doorTiles(TILE){
  if (!doorsInWorld()) return new Set();
  return new Set([TILE.JUKE, TILE.CAL, TILE.BOARD, TILE.BINDER]);
}

/* 방 안의 물건이 아직 「문」인가.
   폰(M4)에서는 달력·게시판·CD·배치가 **화면 오른쪽 세로 열**로 나와 있다(js/cozy.js).
   그러면 방 안의 표시등은 같은 일을 두 번 하는 것이고, 등 넷이 켜져 있는 사무실은
   어두운 방의 그림체를 깎는다 — 그래서 폰에서는 표시등도 점광원도 만들지 않고,
   눌렀을 때 모달을 여는 것도 story.js 에서 같이 끈다(물건은 조사 대상으로 돌아간다).

   넓은 판에서는 그대로 둔다. 거기엔 세로 열이 없고, **이 물건이 그 기능으로 들어가는
   유일한 문**이다. 지우면 달력·게시판·음악·견본책에 들어갈 길이 아예 없어진다. */
function doorsInWorld(){
  const a = document.getElementById('app');
  return !(a && a.classList.contains('tabbar'));
}

/* 물건의 **제 좌표계**에서 부피를 잰다. setFromObject 는 월드로 재므로, 그 값을
   자식의 로컬 좌표에 그대로 넣으면 표시가 물건에서 몇 유닛 떨어진 데로 날아간다
   (실제로 그렇게 만들어 놓고 「표시가 안 보인다」고 읽었다). 변환을 잠깐 걷어 내고 잰다. */
const _lbBox = new THREE.Box3();
function localBox(o){
  const pp = o.position.clone(), rr = o.rotation.clone();
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0);
  o.updateMatrixWorld(true);
  _lbBox.setFromObject(o);
  o.position.copy(pp); o.rotation.copy(rr);
  o.updateMatrixWorld(true);
  return _lbBox;
}

/* 표시등 — **물건의 한가운데**에 앉는다. 처음에는 아래 모서리에 달았는데,
   그러면 웅덩이가 물건 밖으로 새서 「이 물건」이 아니라 「이 언저리」를 가리킨다.
   가운데면 빛이 물건을 감싸고, 무엇을 가리키는지가 한 번에 읽힌다.
   CD 플레이어처럼 바닥에 서는 문은 앞면이 상판에 가리므로 **윗면 쪽으로** 올린다. */
function doorLampOf(o, floor){
  const b = localBox(o);
  if (!isFinite(b.min.x)) return null;
  const g = new THREE.Group();
  const s = 0.085;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s * 0.5, s * 0.34),
                               LP.matGlow(DOOR_LAMP, 0.95));
  plate.userData.dynamic = true;      // 병합에서 빠진다 — 색을 정점에 구우면 빛이 아니라 페인트다
  plate.userData.mark = 'door';
  const base = LP.box(s * 1.8, s * 0.26, s * 0.26, LP.PAL.metalDark, 0, -s * 0.38, -s * 0.04);
  base.userData.dynamic = true;
  base.userData.mark = 'door';
  g.add(plate, base);
  const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
  g.position.set(cx, floor ? b.max.y + s * 0.4 : cy, b.max.z + 0.03);
  g.userData.dynamic = true;
  return g;
}

/* 문 하나에 표시를 단다. 바닥 가구(CD 플레이어)와 벽에 건 것(달력·게시판·견본책)이
   서로 다른 자리에서 만들어지므로 붙이는 곳도 둘이다 — 그래서 함수로 뺀다. */
function markDoor(g, o, tile, DOORS, floor){
  if (!DOORS.has(tile)) return;
  /* 표시를 끈 판(?mark=off)에서도 **자리는 찍는다** — 비교 사진이 같은 픽셀을 재야 한다 */
  { const v = new THREE.Vector3();
    o.updateMatrixWorld(true); o.getWorldPosition(v);
    markPts.push([+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]); }
  if (!DOOR_MARK) return;
  const l = doorLampOf(o, floor);
  if (!l) return;
  o.add(l);
  marks35.push(l);
  /* 점광원은 씬에 직접 단다 — 물건의 자식으로 두면 병합·회전에 같이 끌려간다.
     자리는 발광판의 **월드 좌표**다. 반경 0.85칸이라 벽에 웅덩이 하나만 만든다. */
  o.updateMatrixWorld(true);
  const wp = new THREE.Vector3();
  l.getWorldPosition(wp);
  const pl = new THREE.PointLight(DOOR_LAMP, 0.55, 0.85, 2);
  pl.position.copy(wp);
  scene.add(pl);
  doorLights.push(pl);
}

/* 격자 타일 → 3D 가구.
   b: 만드는 함수 · w: 가로로 차지하는 칸 수 · wall: 벽에 거는 것 · skip: 안 그림
   대응물이 없는 것은 비슷한 덩치로 대신 세웠다. 전용 모델은 나중에. */
/* 이 칸에서 어느 방향이 벽인가 — 벽 쉼터처럼 등을 대야 하는 물건이 쓴다.
   모델은 -z 쪽에 기둥이 있으므로 그 방향이 벽을 향하도록 회전각을 돌려준다. */
/* 책상 위 잔물건. 자리마다 다르게 놓되 **격자 좌표로 정한다** —
   난수를 쓰면 사무실을 다시 그릴 때마다 물건이 이사한다.
   휑한 책상은 "가구를 배치한 곳"으로 보이고, 잔물건이 얹혀야 "쓰는 책상"이 된다. */
function deskProps(g, x, z){
  const TOP = 0.65;
  const put = (o, dx, dz, ry = 0, y = TOP) => {
    o.position.set(x + dx, y, z + dz);
    o.rotation.y = ry;
    g.add(o);
    return o;
  };
  const h = (a, b) => ((x * 7 + z * 13 + a * 31) % b + b) % b;

  /* 자리마다 키보드 하나 — 모니터 앞이다 */
  put(LP.keyboard(), 0.55, 0.72, 0.05);
  put(LP.keyboard(), 1.45, 0.72, -0.04);
  /* 마우스도 자리마다 하나씩. 키보드만 있고 마우스가 없는 책상은 어딘가 비어 보인다 */
  put(LP.mouse(), 0.86, 0.70, 0.10);
  put(LP.mouse(), 1.76, 0.70, -0.08);

  /* 나머지는 자리마다 다르게. 여섯 칸에서 넷을 고른다. */
  const slots = [
    [0.22, 0.36], [0.90, 0.30], [1.18, 0.66], [1.76, 0.34], [0.62, 0.18], [1.42, 0.16],
    [0.34, 0.66], [1.06, 0.16], [1.62, 0.62],
  ];
  const kinds = [
    () => LP.mug([0xF0A9A0, 0xA8B8E0, 0xA8D3A0, 0xE8CBA0][h(1, 4)]),
    () => LP.penCup(),
    () => LP.sticky(2 + h(2, 3)),
    () => LP.succulent(),
    () => LP.docStack(2 + h(3, 3)),
    () => LP.papers(0, 0),
    () => LP.deskFrame(),
    () => LP.stapler(),
  ];
  const n = 4 + h(4, 3);
  for (let i = 0; i < n; i++){
    const s = slots[(h(5 + i, slots.length) + i) % slots.length];
    const k = kinds[(h(9 + i * 3, kinds.length) + i) % kinds.length];
    const o = k();
    /* 소품은 두 규약이 섞여 있다. 대부분은 발밑 y=0 이라 책상 높이(TOP)를 더해 줘야 하고,
       papers 는 모니터와 같이 **자기 안에 이미 책상 높이를 갖고 있다**. 후자에 TOP 을 또 더하면
       책상 위 66cm 허공에 종이가 뜬다. 그래서 그것만 y=0 으로 놓는다.
       (전에는 이 보정을 z 축에 걸었다 — 그래서 뜬 채로 벽 쪽에 물러나 있었다.) */
    const ownY = o.children[0] && o.children[0].position.y > 0.5;
    put(o, s[0], s[1], h(i, 5) * 0.3, ownY ? 0 : TOP);
  }
}

function wallFacing(world, TILE, x, z){
  const at = (xx, zz) => (xx < 0 || zz < 0 || xx >= world.W || zz >= world.H)
    ? TILE.WALL : world.grid[zz * world.W + xx];
  if (at(x, z - 1) === TILE.WALL) return 0;
  if (at(x + 1, z) === TILE.WALL) return Math.PI / 2;
  if (at(x, z + 1) === TILE.WALL) return Math.PI;
  if (at(x - 1, z) === TILE.WALL) return -Math.PI / 2;
  return 0;
}

function furnTable(T){
  const F = {};
  const put = (tile, b, o = {}) => { if (tile !== undefined) F[tile] = { b, ...o }; };

  put(T.DESK,      () => LP.desk(), { w:2 });
  put(T.DESK_R,    null, { skip:true });        // 2칸 책상의 오른쪽 — 왼쪽이 통째로 그린다
  put(T.FILLER,    null, { skip:true });
  put(T.LEGAL,     () => LP.desk(), { w:2 });
  put(T.MEETING,   () => LP.meetingTable(), { w:2 });

  put(T.INBOX,     () => LP.inbox());
  put(T.BED,       () => LP.napBox());
  put(T.LITTER,    () => LP.cardboard(true));
  put(T.COOLER,    () => LP.cooler());
  put(T.PLANT,     () => LP.plant());
  put(T.SHELF,     () => LP.shelf());

  /* 여기부터가 상점 비품. 전에는 넷이 같은 자판기로 그려져서
     사무실을 꾸며도 꾸민 티가 안 났다 — 이제 전부 다른 물건이다. */
  put(T.COFFEE,    () => LP.coffee());
  put(T.COPIER,    () => LP.copier());
  put(T.SERVER,    () => LP.dryer());
  put(T.LAB,       () => LP.refinery());
  put(T.GYM,       () => LP.gymRig());
  put(T.ROCKET,    () => LP.rocket());
  put(T.FEEDER,    () => LP.feeder());
  put(T.TOWER,     () => LP.catTower(),  { perch:0.76 });
  put(T.SCRATCH,   () => LP.scratcher());
  put(T.PERCH,     () => LP.wallPerch(), { perch:1.16, toWall:true });
  put(T.HAMMOCK,   () => LP.hammock(),   { perch:0.56 });
  put(T.SNACK,     () => LP.snackBar());
  /* 벽에 등을 댄다 — 뒷면을 안 만들었고, 무엇보다 방 한가운데 선 오디오는 이상하다 */
  put(T.JUKE,      () => LP.cdPlayer(), { toWall:true });
  put(T.YARN,      () => LP.yarnBall());
  put(T.TOY,       () => LP.featherToy());
  /* 오락기도 벽에 등을 댄다 — 뒤가 배선이고, 무엇보다 화면이 벽을 보면 아무도 못 본다 */
  put(T.GAME,      () => LP.arcade(),   { toWall:true });

  /* 벽에 거는 것. b 는 wallDecor 항목을 받는다 — 액자마다 다른 그림을 걸려면
     어느 액자인지 알아야 한다(d.v 가 그 변주값이고, 저장에 같이 실려 있다). */
  put(T.WHITEBOARD,() => LP.whiteboard(1.6), { wall:true, y:1.35 });
  /* d.v 는 액자마다 다른 변주값. 옛 저장에는 없으므로 0 으로 떨어뜨린다(전부 같은 그림이 되지만 안 깨진다). */
  /* DECOR 는 **한 가지가 아니다.** 액자만 여덟 개 걸린 벽은 액자가 아니라 벽지고,
     새 타일을 여덟 개 만들면 저장 포맷·상점·편집 UI 가 다 같이 늘어난다.
     d.v(0~63)는 이미 저장에 실려 있으므로 그걸로 **무엇이 걸릴지까지** 정한다 —
     타일은 하나 그대로, 벽에 걸리는 물건만 여섯 가지가 된다. */
  put(T.DECOR,     d => {
    const v = d.v | 0;
    switch (v % 9){
      case 4:  return LP.corkBoard(0.80);
      case 5:  return LP.calendar();
      case 6:  return LP.certificate();          // 이 회사를 지키는 유일한 종이
      case 7:  return LP.poster(v >> 3);
      case 8:  return (v & 8) ? LP.vent() : (v & 16) ? LP.pipes() : LP.fireExt();
      default: return LP.wallArt(0.52 + (v % 3) * 0.06, 0.42 + (v % 2) * 0.06,
                                 ART_BG[v % ART_BG.length], v >> 2);
    }
  }, { wall:true, y:1.5 });
  /* push — 벽면에서 얼마나 튀어나오는가. 두께가 있는 것(선반·캣워크)을 벽면에 딱
     맞춰 놓으면 절반이 벽 속에 묻힌다. 액자처럼 얇은 것은 0 이어도 티가 안 난다. */
  put(T.WINDOW,    () => LP.windowUnit(1.46, 1.12), { wall:true, y:1.42, pane:1 });
  put(T.CLOCK,     () => LP.wallClock(),  { wall:true, y:1.62 });
  /* 벽걸이 달력. 메시는 원래 DECOR 변주 중 하나로만 걸려 있던 것 그대로다 —
     그림이 물건이 되었을 뿐이라 벽의 모양은 안 바뀐다 (world.js TILE.CAL). */
  put(T.CAL,       () => LP.calendar(),   { wall:true, y:1.5 });
  /* 제휴 게시판. 이것도 원래 DECOR 변주(코르크 게시판)로 걸려 있던 메시 그대로다. */
  put(T.BOARD,     () => LP.corkBoard(0.86), { wall:true, y:1.48 });
  put(T.BINDER,    () => LP.sampleBinder(), { wall:true, y:1.46 });
  put(T.WALLSHELF, () => LP.wallShelf(0.84, { free:0.40 }), { wall:true, y:1.22, push:0.15 });
  put(T.CATWALK,   () => LP.catwalk(2.6), { wall:true, y:1.88, push:0.18 });

  /* ---------- 가구 카탈로그 (2026-09-01) ----------
     레퍼런스 「사무실 가구 목록」 스물넷. 위의 비품들과 달리 **숫자를 안 건드린다** —
     쾌적도 하나에만 기여하고(game.js comfort), 여기서는 그냥 놓이기만 한다.

     toWall 이 붙은 것은 벽을 등져야 하는 것들이다. 뒷면을 안 만들어서가 아니라
     (전부 사방이 있다) **그게 그 가구가 실제로 놓이는 방식**이라서다 — 방 한가운데
     선 락커는 가구가 아니라 장애물이고, 그건 CD 플레이어를 벽에 붙인 것과 같은 판단이다. */
  put(T.DRAWER,    () => LP.drawerUnit(),  { toWall:true });
  put(T.FILECAB,   () => LP.fileCabinet(), { toWall:true });
  put(T.MEETCHAIR, () => LP.meetChair());
  put(T.LOCKER,    () => LP.locker(),      { toWall:true });
  put(T.CABINET,   () => LP.cabinet(),     { toWall:true });
  put(T.OPENSHELF, () => LP.openShelf(),   { toWall:true });
  put(T.BOOKRACK,  () => LP.bookRack(),    { toWall:true });
  put(T.PAPERTRAY, () => LP.paperTray());
  put(T.BOX,       () => LP.cardboard(true));
  put(T.BIN,       () => LP.trashBin());
  put(T.PLANT_S,   () => LP.plantSm());
  put(T.PLANT_L,   () => LP.plantLg());
  put(T.CANDLE,    () => LP.candles(3));
  put(T.PENHOLDER, () => LP.penHolder());
  put(T.LOWTABLE,  () => LP.lowTable());
  put(T.CAFETABLE, () => LP.cafeTable());
  put(T.CAFECHAIR, () => LP.cafeChair());
  /* 앉는 것들. perch 는 「고양이가 이 칸에 오면 몇 유닛 위에 앉는가」다 —
     소파 좌판이 0.35, 빈백 윗면이 0.46 이라 그 값을 그대로 준다.
     이걸 빼면 고양이가 소파를 **뚫고** 바닥에 앉는다. */
  put(T.SOFA1,     () => LP.sofa1(),       { toWall:true, perch:0.42 });
  put(T.SOFA2,     () => LP.sofa2(),       { toWall:true, perch:0.42, w:2 });
  put(T.ARMCHAIR,  () => LP.loungeChair(), { toWall:true, perch:0.50 });
  put(T.BEANBAG,   () => LP.beanBag(),     { perch:0.46 });
  /* 스탠드 조명·랜턴은 **진짜 광원을 받는다**(아래 buildCozy 가 자동으로 놓는 것과
     같은 기구다). 사서 놓은 등이 안 켜지면 그건 등이 아니라 등 모양 가구다. */
  put(T.FLOORLAMP, () => LP.floorLamp(0), { lit:'lamp' });
  put(T.LANTERN,   () => LP.lantern(),    { lit:'lantern' });

  /* 벽에 거는 둘 */
  put(T.CURTAIN,   () => LP.curtain(1.5, 1.2), { wall:true, y:1.42, push:0.06 });
  /* d 를 안 받는 호출이 하나 있다 — 목록 모형(furnPortrait)은 F.b() 를 인자 없이
     부른다. 여기서 d.v 를 그냥 읽으면 그 한 곳에서만 터지고, 터진 자리는 조용히
     이모지로 내려가서 **격자에서 이것만 그림이 없다**로 나타난다. */
  put(T.MEMO,      d => LP.stickyMemo((d && d.v) | 0), { wall:true, y:1.46 });
  return F;
}
/* 액자 바탕색 — 벽에 같은 색 액자가 줄지어 걸리면 그건 장식이 아니라 벽지다. */
const ART_BG = [PASTEL.fabric2, PASTEL.fabric, PASTEL.leaf, PASTEL.paper, PASTEL.catnip, PASTEL.pot];

/* ============================================================ */

let renderer, scene, camera, canvas;
let statics = null, actors = new Map(), docs = new Map();
let sun, hemi, fill, lampLights = [], screens = [], glows = [], panes = [];
/* 천장등 — 광원(ceilLights) · 벽 스위치(ceilSwitch). 갓과 빛 원뿔은 안 그린다(2026-08-25).
   개수는 방 크기를 따라간다(build 참고). 스위치는 하나이고 전부를 같이 끈다 —
   등마다 스위치를 두면 그건 조명이 아니라 조명 설정이다.
   책상등과 달리 **끌 수 있다** — 그게 이 물건의 절반이다. */
let ceilLights = [], ceilSwitch = null, ceilOn = true;
let ceilConeMat = null;
/* 창에서 들어오는 빛 자락. 창유리만 밝히면 "그림이 밝다" 이고, 바닥에 빛이 깔려야
   "빛이 들어온다" 가 된다 — lowpoly.js windowUnit 의 주석이 적어 두고 배선만 안 했던 것.

   광원을 창마다 두지 않은 이유: 방 전체 색은 이미 hemi·sun 이 시간대를 따라가고 있어서
   빠진 건 색이 아니라 **방향감**이다. 그리고 하루 종일 켜 두는 게임에 동적 광원을
   창 수만큼 늘리면 프래그먼트 비용이 창 수에 비례해 붙는다. */
let W = 0, D = 0, ready = false;
/* 마지막으로 **세운** 사무실의 크기. 이전(移轉)과 단순 재구성을 가르는 값이다 */
let builtW = 0, builtD = 0;
/* 자리(책상 앞 의자) 칸 목록. 2D 에는 높이가 없어서 시뮬은 (x,y)만 준다.
   그대로 y=0 에 세우면 근무 중인 고양이가 의자 등받이 뒤에 통째로 숨는다. */
const seatCells = new Set();
const SEAT_Y = 0.47;
/* 자리칸 → 그 자리의 의자. 택배 컷신이 의자를 고양이와 같이 물리는 데 쓴다. */
const seatChairs = new Map();
/* 시설 위에 올라앉는 높이. 시뮬은 (x,y)만 주므로 어디에 올라탔는지는 렌더러가 격자에서 본다. */
const perchCells = new Map();
const tmp = new THREE.Vector3();
/* 벽시계 바늘. 이 게임은 **당신의 데스크톱 시계로 돈다** — 당신의 정오에 고양이가
   점심을 먹으러 가고 6시에 배웅한다. 그런데 벽에 걸린 시계가 그 말을 안 하고 있었다.
   바늘은 병합에서 빼 뒀으므로(lowpoly.wallClock 의 keep) 여기서 돌리면 된다.
   분에 한 번만 손대면 되지만, 두 개 돌리는 값이 조건 하나보다 싸다. */
const clockHands = [];
function tickClocks(){
  if (!clockHands.length) return;
  const d = new Date();
  const m = d.getMinutes() + d.getSeconds() / 60;
  const h = (d.getHours() % 12) + m / 60;
  const mr = -m / 60 * Math.PI * 2, hr = -h / 12 * Math.PI * 2;
  for (const c of clockHands){ c.min.rotation.z = mr; c.hour.rotation.z = hr; }
}

/* ---------- 촛불 ----------
   **광원이 아니라 발광면을 흔든다**(lowpoly.candles 머리말). 촛불 하나가 방을 밝히지는
   않고, 이 방에서 초가 하는 일은 「가만하지 않은 점이 하나 있다」이다. 그 일에
   셰이더 루프를 한 칸 쓰는 것은 비싸다.

   **초마다 위상을 어긋나게 한다.** 같이 떨면 그건 촛불 셋이 아니라 깜빡이는
   형광등이다. 황금각(2.39rad)으로 벌리면 몇 개를 놓든 위상이 안 겹친다.

   **세기를 여덟 단계로 끊는다.** matGlow 가 (색, 세기)로 재질을 캐시하므로 연속값을
   주면 프레임마다 새 재질이 생기고, three 에서 새 재질은 곧 셰이더 컴파일이다.
   여덟 단계면 재질이 여덟 개로 고정되고, 60fps 에서 그 계단은 눈에 안 보인다.

   키도 같이 흔든다 — 세기만 바꾸면 「밝기가 변하는 조각」이고, 길이가 같이 흔들려야
   불꽃이다. 폭은 좁게 둔다(±8%): 원뿔이 가운데를 기준으로 늘어나므로 크게 흔들면
   불꽃이 심지 아래로 파고든다. */
let flameT = 0;
/* **프레임 수가 아니라 흐른 시간으로 센다.** 폰에서 30장으로 끊고 나서(js/main.js)
   1/60 씩 더하면 초가 절반 속도로 가고, 촛불이 느려진다 — 불꽃은 화면이 몇 장을
   그리는지와 상관없는 물건이다. */
function tickFlames(dt){
  if (!flames.length) return;
  flameT += dt;
  for (let i = 0; i < flames.length; i++){
    const f = flames[i], ph = i * 2.39;
    const k = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(flameT * 5.3 + ph))
                   + 0.10 * Math.sin(flameT * 11.7 + ph * 1.7);
    const q = Math.round(k * 8) / 8;
    if (f.userData.q !== q){
      f.userData.q = q;
      f.material = LP.matGlow(COZY_HUE, Math.min(1.6, q * f.userData.lit * 1.3));
      f.scale.y = 0.92 + q * 0.16;
    }
  }
}
let catTint = 0xFFFFFF;      // 지금 시간대의 빛깔. 새로 만든 고양이에게도 바로 입힌다

/* 카메라 — 벽은 북(-z)·서(-x) 두 면만 세우므로 반드시 +x/+z 쪽에서 본다.
   반대편으로 돌리면 벽 바깥면이 화면의 절반을 덮는다. */
const CAM = { az: 0.72, el: 0.56, zoom: 1, pad: 0.4 };
const look = new THREE.Vector3();

/* 카메라는 기본적으로 고양이를 번갈아 따라간다 — 사무실 전체를 멀리서 보면
   고양이가 15px 이 되고, 그러면 표정도 개체 구분도 사라진다(spike/c8).
   사용자가 드래그하는 순간 자동 추적을 끄고 그 자리에 그대로 둔다. 방해하지 않는 게 우선이다. */
const FOLLOW = { on:true, i:0, t:0, every:9, zoom:0.30 };
const wantLook = new THREE.Vector3();
let dragged = 0;

/* 드래그 직후의 클릭은 삼킨다 — 안 그러면 시점을 돌리다 놓는 순간
   배치 모드가 그 칸에 가구를 놓아 버린다. */
export function justDragged(){ return performance.now() < dragged; }
export function followOn(on){
  FOLLOW.on = on !== false;
  if (FOLLOW.on) FOLLOW.t = FOLLOW.every;      // 바로 다음 고양이로
  return FOLLOW.on;
}
export function following(){ return FOLLOW.on; }

/* 추적 중의 거리. **camSet 으로는 못 바꾼다** — 추적이 도는 동안 매 프레임
   `CAM.zoom = FOLLOW.zoom` 으로 덮어쓰기 때문이다(아래 followTick). 그래서 손잡이를
   따로 낸다. 인자 없이 부르면 지금 값을 읽는다(시작화면이 원래대로 돌려놓을 때 쓴다).
   숫자는 거리다 — 작을수록 가까이 붙는다. */
export function followZoom(z){
  if (z == null) return FOLLOW.zoom;
  FOLLOW.zoom = Math.max(0.16, Math.min(1.9, z));
  if (FOLLOW.on && ready){ CAM.zoom = FOLLOW.zoom; fit(); }
  return FOLLOW.zoom;
}

/* ============================================================
   카메라 조작

   ── 왜 다시 만들었나 ──

   손잡이가 둘뿐이었다: 드래그로 **돌리기**, 휠로 **줌**.
   그래서 화면에 안 잡힌 구석은 **갈 방법이 없었다.** 사무실이 9×7 일 때는 문제가
   아니었는데(전부가 한 화면에 들어온다) 냥타워는 15×15 다. 저쪽 회의실을 보고 싶으면
   할 수 있는 게 각도를 비틀어 억지로 걸치는 것뿐이었고, 그건 조작이 아니라 요행이다.

   게다가 줌이 **화면 한가운데 기준**이라 "저기를 확대"가 안 됐다. 확대할수록
   보고 싶던 것이 화면 밖으로 밀려난다.

   그래서 셋을 더한다:
     · **팬** — **왼쪽 드래그** / 한 손가락. 세상을 손으로 끌어온다
     · **커서 기준 줌** — 휠 아래 있던 칸이 제자리에 남는다. 지도 앱과 같은 규약
     · **키보드** — 방향키·WASD 로 팬, Q·E 로 45° 스냅, 0 으로 전체 보기

   ── 좌·우를 뒤집었다 (2026-08-20) ──
   처음에는 왼쪽 드래그가 회전이었다. 뒤집은 이유: **제일 흔한 손짓이 제일 흔한 일을
   해야 한다.** 이 사무실에서 사람이 계속 하는 건 "저기를 보자"(팬)이고 각도를 비트는
   일은 드물다. 그리고 지도 앱이 전부 그 규약이다 — 한 손가락으로 지도를 끌고,
   두 손가락으로 돌린다. 회전은 오른쪽·가운데 드래그와 Shift+드래그로 남는다.
   ============================================================ */

/* 화면 우측 방향과 "화면 위쪽"을 바닥에 투영한 방향. 팬은 이 둘의 조합이다.
   (three 의 lookAt 기저에서 x축 = normalize(cross(up, eye-target)) 로 떨어지는 값) */
const camRightOf = az => [Math.sin(az), -Math.cos(az)];
const camFwdOf   = az => [-Math.cos(az), -Math.sin(az)];

/* 픽셀 하나가 바닥에서 몇 유닛인가. 그래야 끌어온 만큼 딱 따라온다.
   세로는 바닥이 비스듬해서 더 넓다 — 고도가 낮을수록 한 픽셀이 먹는 바닥이 커진다. */
function panPerPx(){
  const box = canvas && canvas.parentElement;
  const h = (box && box.clientHeight) || 1;
  const d = camera.userData.dist || 20;
  const k = 2 * d * Math.tan(camera.fov * Math.PI / 360) / h;
  return [k, k / Math.max(0.30, Math.sin(CAM.el))];
}

/* 사무실 밖으로 날아가지 않게. 완전히 가두면 모서리를 못 보므로 한 칸 여유를 준다. */
function clampLook(){
  look.x = Math.max(-1, Math.min(W + 1, look.x));
  look.z = Math.max(-1, Math.min(D + 1, look.z));
}

/* 화면을 픽셀만큼 끈다. 세상이 손가락을 따라오는 방향 — 즉 시선은 반대로 간다.

   ── 가로를 한 번 뒤집었다가 되돌렸다 (2026-09-01) ──
   「두 손가락으로 밀면 좌우가 손과 반대」라는 신고를 받고 여기 부호를 뒤집었는데,
   **여기는 두 손가락이 지나는 길이 아니었다.** 이 게임의 규약은 지도 앱과 같다:
     한 손가락 = 팬(이 함수)  ·  두 손가락 = 회전 + 줌(orbitPixels · zoomBy)
   그래서 뒤집힌 것은 한 손가락 팬이었고, 그쪽은 원래가 맞았다. 되돌렸다.
   두 손가락의 방향을 손볼 일이 생기면 그건 orbitPixels 쪽이다. */
function panPixels(dx, dy){
  const [kx, kz] = panPerPx();
  const r = camRightOf(CAM.az), f = camFwdOf(CAM.az);
  look.x += -r[0] * dx * kx + f[0] * dy * kz;
  look.z += -r[1] * dx * kx + f[1] * dy * kz;
  clampLook();
}

/* 커서 아래의 바닥점. 하늘을 가리켰으면 null */
function groundAt(cx, cy){
  if (!ready || !canvas || !aim(cx, cy)) return null;
  if (!ray.ray.intersectPlane(GROUND, hitPt)) return null;
  return { x: hitPt.x, z: hitPt.z };
}

/* 줌. anchor 를 주면 **그 점이 화면 제자리에 남는다** — 거리가 s 배로 줄면
   시선도 그 점 쪽으로 (1-s) 만큼 다가가야 화면상의 위치가 보존된다. */
function zoomBy(mul, anchor){
  const before = CAM.zoom;
  CAM.zoom = Math.max(0.16, Math.min(1.9, CAM.zoom * mul));
  const s = CAM.zoom / before;
  if (s !== 1 && anchor){
    look.x += (anchor.x - look.x) * (1 - s);
    look.z += (anchor.z - look.z) * (1 - s);
    clampLook();
  }
  fit();
}

/* 전체 보기로 되돌린다. 길을 잃었을 때의 탈출구 — 0 키와 🎥 버튼이 부른다. */
export function camReset(follow){
  CAM.zoom = 1; CAM.az = 0.72; CAM.el = 0.56;
  look.set(W / 2, 0.5, D / 2);
  wantLook.copy(look);
  FOLLOW.on = !!follow;
  if (FOLLOW.on) FOLLOW.t = FOLLOW.every;
  fit();
}
/* 카메라를 직접 세운다. 사진을 찍을 때 쓴다 — 「위에서 본 사무실」은 각도가 값이라,
   그 각도를 부르는 쪽이 정해야 한다 (js/visit.js 의 썸네일). 준 값만 바꾼다. */
export function camSet(o){
  if (!ready || !o) return;
  if (o.az != null) CAM.az = o.az;
  if (o.el != null) CAM.el = Math.max(0.12, Math.min(1.45, o.el));
  if (o.zoom != null) CAM.zoom = Math.max(0.16, Math.min(1.9, o.zoom));
  if (o.center){ look.set(W / 2, 0.5, D / 2); wantLook.copy(look); }
  /* 한 칸을 본다. 첫 출근 안내의 가구 클로즈업이 쓰던 길인데 그 걸음들을 뺐다(tutor.js) —
     남겨 둔다: 벽 물건은 눈높이가 달라 up 을 받는 이 규칙이 다시 필요할 때 다시 쓴다. */
  if (o.at){
    look.set(o.at.x + 0.5, o.at.up != null ? o.at.up : 0.5, o.at.y + 0.5);
    wantLook.copy(look);
  }
  if (o.follow != null) FOLLOW.on = !!o.follow;
  fit();
}

/* 45° 스냅. 자유 회전은 늘 어중간한 각에서 멈춘다 — 벽이 화면과 나란한 각이 제일 잘 보인다. */
export function camTurn(dir){
  const q = Math.PI / 4;
  FOLLOW.on = false;
  CAM.az = Math.round(CAM.az / q + dir) * q;
}

/* 여러 손가락을 동시에 본다. 하나면 회전, 둘이면 팬 + 핀치.
   버튼으로도 갈린다: 오른쪽·가운데 버튼과 Shift 는 팬이다. */
const pointers = new Map();
let gesture = null;      // { mode:'rot'|'pan', x, y, moved, dist }

/* 회전. 마우스(오른쪽 드래그)와 두 손가락이 **같은 함수**를 쓴다 —
   한쪽만 고치면 손가락과 마우스가 다른 속도로 도는 일이 생긴다. */
function orbitPixels(dx, dy){
  CAM.az -= dx * 0.008;
  CAM.el = Math.max(0.14, Math.min(1.35, CAM.el + dy * 0.006));
}

function pinchState(){
  const p = [...pointers.values()];
  const dx = p[0].x - p[1].x, dy = p[0].y - p[1].y;
  return { x:(p[0].x + p[1].x) / 2, y:(p[0].y + p[1].y) / 2, dist:Math.hypot(dx, dy) || 1 };
}

function bindCamera(cv){
  /* 터치에서 브라우저가 먼저 스크롤·확대를 가져가면 제스처가 아예 안 온다 */
  cv.style.touchAction = 'none';
  /* 오른쪽 드래그로 시점을 돌리는데 메뉴가 뜨면 회전이 거기서 끝난다 */
  cv.addEventListener('contextmenu', e => e.preventDefault());

  cv.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch(err){}
    if (pointers.size === 2){
      const s = pinchState();
      gesture = { mode:'rot', x:s.x, y:s.y, dist:s.dist, moved:true };
      FOLLOW.on = false;
      return;
    }
    if (pointers.size > 2) return;
    /* **왼쪽 = 팬**, 오른쪽·가운데·Shift = 회전. 제일 흔한 손짓이 제일 흔한 일을 한다.
       움직임이 5px 을 안 넘으면 아래에서 클릭으로 통과시키므로, 쓰다듬기는 그대로다. */
    const rot = e.button === 1 || e.button === 2 || e.shiftKey;
    gesture = { mode: rot ? 'rot' : 'pan', x:e.clientX, y:e.clientY, moved:false };
  });

  cv.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (!gesture) return;

    /* 두 손가락 — 가운데점이 **회전**, 벌어짐이 줌. 한 제스처 안에서 같이 일어난다.
       (한 손가락이 팬이 됐으므로 회전이 두 손가락으로 올라왔다 — 지도 앱과 같은 규약) */
    if (pointers.size >= 2){
      const s = pinchState();
      orbitPixels(s.x - gesture.x, s.y - gesture.y);
      if (Math.abs(s.dist - gesture.dist) > 0.5) zoomBy(gesture.dist / s.dist, null);
      gesture.x = s.x; gesture.y = s.y; gesture.dist = s.dist;
      dragged = performance.now() + 250;
      return;
    }

    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (!gesture.moved && Math.abs(dx) + Math.abs(dy) < 5) return;   // 클릭은 통과시킨다
    gesture.moved = true;
    FOLLOW.on = false;                       // 손을 대는 순간 추적을 끈다
    if (gesture.mode === 'pan') panPixels(dx, dy);
    else orbitPixels(dx, dy);
    gesture.x = e.clientX; gesture.y = e.clientY;
  });

  const end = e => {
    pointers.delete(e.pointerId);
    if (gesture && gesture.moved) dragged = performance.now() + 250;
    if (pointers.size >= 2){
      const s = pinchState();
      gesture = { mode:'rot', x:s.x, y:s.y, dist:s.dist, moved:true };
    } else if (pointers.size === 1){
      /* 두 손가락에서 하나가 남았다. 남은 하나가 뜻하는 건 팬이고, 마침 그게
         화면이 홱 돌지 않는 쪽이기도 하다 — 좌표를 남은 손가락으로 옮겨 잇는다. */
      const q = [...pointers.values()][0];
      gesture = { mode:'pan', x:q.x, y:q.y, moved:true };
    } else gesture = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  cv.addEventListener('wheel', e => {
    e.preventDefault();
    FOLLOW.on = false;
    /* 트랙패드는 한 번 굴려도 델타가 잘게 여러 번 온다. 부호만 쓰면 너무 거칠고,
       델타를 그대로 쓰면 마우스 휠에서 화면이 튄다 — 그 사이에서 자른다. */
    const step = Math.max(-0.22, Math.min(0.22, e.deltaY * 0.0016 + Math.sign(e.deltaY) * 0.055));
    zoomBy(1 + step, groundAt(e.clientX, e.clientY));
  }, { passive:false });

  /* 두 번 누르면 그 칸이 화면 한가운데로 온다. 팬을 모르는 사람에게 남는 마지막 손잡이 */
  cv.addEventListener('dblclick', e => {
    /* 고양이를 두 번 누른 건 기록증을 열라는 뜻이다(main.js). 시점까지 같이 옮기면
       카드가 덮은 뒤에서 화면이 혼자 움직이고, 카드를 닫으면 딴 데를 보고 있다. */
    if (pickCat(e.clientX, e.clientY)) return;
    const g = groundAt(e.clientX, e.clientY);
    if (!g) return;
    FOLLOW.on = false;
    look.x = g.x; look.z = g.z;
    clampLook();
  });

  /* 키보드. 결재함에 글자를 치는 중이면 손대지 않는다 — WASD 는 서류 제목에도 들어간다. */
  const typing = () => {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };
  document.addEventListener('keydown', e => {
    if (!ready || !statics || typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!canvas || !canvas.offsetParent) return;      // 도트 렌더러로 돌고 있으면 남의 화면이다
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    /* ── 배치 중의 방향키는 **카메라 것이 아니다** ──
       화살표는 고른 가구를 한 칸씩 민다(js/edit.js editNudge). 그런데 여기서도 같은 키로
       시선을 1.2씩 팬하고 있어서, 한 번 누를 때마다 **가구도 가고 화면도 갔다** —
       「상하좌우 누르면 화면이 같이 움직인다」의 정체가 이것이었다.
       배치 모드에서는 방향키를 저쪽에 넘긴다. WASD 는 그대로 둔다 — 그건 카메라 전용이고
       배치 중에도 방을 둘러볼 길이 있어야 한다. */
    const editing = (typeof EDIT !== 'undefined') && EDIT && EDIT.on;
    if (editing && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) return;
    const nudge = (nx, nz) => {
      FOLLOW.on = false;
      const r = camRightOf(CAM.az), f = camFwdOf(CAM.az), step = 1.2;
      look.x += (r[0] * nx + f[0] * nz) * step;
      look.z += (r[1] * nx + f[1] * nz) * step;
      clampLook();
    };
    switch (k){
      case 'ArrowLeft':  case 'a': nudge(-1, 0); break;
      case 'ArrowRight': case 'd': nudge(1, 0); break;
      case 'ArrowUp':    case 'w': nudge(0, 1); break;
      case 'ArrowDown':  case 's': nudge(0, -1); break;
      case 'q': camTurn(-1); break;
      case 'e': camTurn(1); break;
      case '+': case '=': FOLLOW.on = false; zoomBy(0.88, null); break;
      case '-': case '_': FOLLOW.on = false; zoomBy(1.14, null); break;
      case '0': camReset(false); break;
      default: return;
    }
    e.preventDefault();
  });
}

export function init(cv){
  canvas = cv;
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'low-power' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);

  hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_BIG, SHADOW_BIG);
  sun.shadow.bias = -0.0016;
  fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-6, 5, -5);
  scene.add(hemi, sun, sun.target, fill);

  /* 그림체 한 벌 갈아 끼우기. eerie 는 각지고·어둡고·안개 낀 쪽이다(three/eerie.js).
     여기 두 줄과 night()·fit()·draw() 의 세 줄이 전부다 — 나머지 코드는 모른다. */
  if (EERIE.ON){
    LP.setKit(EERIE.KIT);
    LP.setPalette(EERIE.PALETTE);
    EERIE.install(renderer, scene, camera);
  } else {
    LP.setKit({ prim:'round', bevel:0.055, shading:'smooth', detail:1 });
    LP.setPalette(PASTEL);
  }
  bindCamera(cv);
  /* 고양이 몸은 부팅에서 딱 두 벌 깎는다(서 있는 것·웅크린 것). 첫 프레임에 깎으면
     그 프레임만 60ms 튀고, 20마리가 각자 깎으면 1초가 멈춘다. */
  if (catLook === 'sculpt') CS.warm();
  ready = true;
  shadowFit();     // 폰이면 처음부터 작게 굽는다 — 큰 걸 한 번 굽고 버릴 이유가 없다
}

/* ============================================================
   불을 여기저기 놓는다 — 조명 배치 (2026-08-28)

   기구는 lowpoly.js 가 만들고(「불 켜진 것들」 절), **어디에 놓을지**와 진짜 점광원을
   몇 개 붙일지는 여기서 정한다. 나누는 이유는 배치가 방을 알아야 하기 때문이다 —
   어느 벽이 비었는지, 어느 구석이 죽었는지는 격자를 봐야 안다.

   ── 왜 늘리나 ──

   지금까지 이 방의 광원은 두 종류였다: 천장등(방을 고르게 든다)과 책상등(웅덩이를
   만든다). 그래서 「빛이 여기저기 고여 있다」가 나올 수가 없었다 — 고일 자리가 책상
   여섯 곳뿐이니까. 넓은 사무실일수록 심했다: 등급이 오르면 방은 커지는데 광원은
   책상 수만큼만 늘어서, 쉼터·복도·구석은 **불을 놓을 방법 자체가 없었다.**

   스탠드·전구줄·벽등·랜턴·양초가 붙으면 웅덩이가 방 곳곳에 생긴다. 그게 아늑한 방과
   조명이 잘 된 방의 차이다 — 아늑함은 밝기의 총합이 아니라 **분포**다.

   ── 문 표시등과는 다른 물건이다 ──

   문 넷(💿📅📌📕)에 달린 표시등은 「누를 수 있다」를 말하는 **신호**다(위 TODO 35 절).
   그래서 손톱만 하고(세기 0.55 · 반경 0.85칸), UI 강조색(0xFF9F6B)이고, 시간대를
   일부러 안 탄다. 여기 기구들은 **조명**이다: 반경이 두 배에서 다섯 배고, 세기가 한
   자리 수 위고, 색은 전구색(팔레트의 glow)이라 시간대를 따라 데워진다.

   둘을 섞으면 둘 다 죽는다. 표시등이 조명만큼 밝아지면 「누를 수 있는 것」이 방 안의
   수많은 밝은 점 중 하나가 되어 신호가 사라지고, 조명이 표시등만큼 어두워지면 그건
   조명이 아니다. **그래서 문 표시등은 한 줄도 안 건드렸다** — 색·세기·반경·자리·
   시간대 무관 전부 그대로다. 아래 값들은 그 넷과 겹치지 않도록 고른 것이다.
   기구를 놓는 자리도 문 넷을 피한다(doorTiles).

   ── 개수는 세어 가며 쓴다 ──

   발광면(matGlow)은 스무 개가 있어도 공짜지만 점광원은 아니다. Lambert 셰이더가
   광원 수만큼 픽셀마다 루프를 돌고, three 는 그 수가 바뀔 때마다 셰이더를 다시
   컴파일한다 — 등이 82개까지 쌓여 사무실이 버벅이던 일이 이 파일에 이미 적혀 있다
   (아래 build 의 ceilLights 걷어내기 절).

   그래서 종류마다 상한을 둔다. 전구줄이 그 판단의 좋은 예다: 알맹이가 열여섯 개인데
   광원은 처진 골마다 하나(최대 넷)만 얹는다. 열여섯을 다 광원으로 만들면 값은 네 배인데
   그림은 오히려 나빠진다 — 촘촘한 광원은 웅덩이를 안 만들고 벽을 고르게 데운다.
   이 파일이 「반경 5.5칸짜리 책상등 여섯 개」에서 배운 것과 같은 이야기다.
   ============================================================ */

/* 종류마다 몇 개까지. 합이 이 방의 새 점광원 상한이다(최대 13).
   기존 광원은 hemi·sun·fill 셋 + 천장등 1~4 + 책상등 ~6 + 문 표시등 4 이므로
   다 합쳐 서른 언저리에서 멈춘다. 셰이더가 실제로 도는 화면은 1/3.4 로 줄인 렌더
   타깃이라(eerie.pxFor) 이 정도는 프래그먼트에서 문제가 안 된다 — 82개일 때
   문제였던 것은 픽셀 비용보다 **셰이더 재컴파일**이었고, 상한을 두면 개수가 고정된다. */
const COZY_CAP = { lamp: 3, sconce: 4, string: 4, lantern: 2 };

/* 세기와 반경. 문 표시등(0.55 · 0.85칸)과 나란히 놓고 보면 차이가 한눈에 보인다.
   반경을 종류마다 다르게 주는 게 요점이다 — 다 같은 반경이면 웅덩이 크기가 같아서
   광원이 늘어도 그림은 「같은 등을 여러 개 놓았다」가 된다.

     스탠드   4.6칸  키가 크고 위로 쏘는 등이라 제일 넓게 퍼진다. 구석 하나를 통째로 맡는다
     벽등     2.9칸  벽면만 씻는다. 바닥까지 닿으면 벽등이 아니라 천장등이다
     전구줄   3.2칸  골마다 하나. 벽을 따라 일정 간격으로 고인다
     랜턴     2.0칸  발치만. 제일 작은 웅덩이라 「거기 뭔가 놓여 있다」로 읽힌다 */
/* **색을 데우면 세기를 그만큼 올려야 한다.** 전구색을 0xFFC07A 에서 0xFFB24E 로
   옮기면서 파란 채널이 122 → 78 로 빠졌는데, 휘도는 0.299R+0.587G+0.114B 라
   그 자체로 7% 어두워진다(203 → 190). 세기를 그대로 두면 「더 주황이고 더 어두운 방」이
   되고, 실제로 그렇게 나왔다 — 밝은 화소가 다섯 칸 전부에서 1~3%p 씩 빠졌다.
   아래 값은 그 7% 를 되돌리고 조금 더 준 것이다. 색만 바꾸는 손잡이는 없다. */
const COZY_LIGHT = {
  lamp:    { i: 7.6, r: 4.6 },
  sconce:  { i: 4.4, r: 2.9 },
  string:  { i: 3.35, r: 3.2 },
  lantern: { i: 2.3, r: 2.0 },
};

/* ---------- 전구색 ----------
   **시간대표의 lampColor 를 안 쓴다.** 처음엔 책상등처럼 표를 따라가게 했고, 찍어
   보고 되돌렸다: 밤 칸의 lampColor 가 0xFFF0DC(따뜻한 흰빛)라 웅덩이가 하얗게 나왔다.
   그 값은 옳다 — 책상등에 대해서는. 밤의 책상 웅덩이는 「모니터 앞에서 일하는 자리」라
   흰 편이 맞고, 주황이면 노을과 구별이 안 된다는 이유까지 표에 적혀 있다.

   그런데 이 한 벌이 하려는 일은 정반대다. 스탠드와 전구줄과 양초는 **일하는 빛이
   아니라 사는 빛**이고, 그 빛은 백열 전구다. 백열 전구는 해가 지든 말든 필라멘트
   색이 안 변한다. 시각에 따라 색이 도는 등은 전구가 아니라 무대 조명이다.

   **채도를 세 번 올렸다.** 크림빛(0xFFD2A0 · r−b 95)으로 시작했는데 아침 칸에서
   따뜻한 화소가 화면의 0.67% 밖에 안 나왔다 — 아침 그레이드가 채도를 빼기 때문이고
   (eerie.TIME.morning), 크림빛은 그 곱셈을 못 견딘다. 0xFFC07A(r−b 133)로 한 번,
   그리고 **주황–노랑 쪽으로 한 번 더**(0xFFB24E · r−b 177).

   마지막 두 걸음은 지표가 아니라 방의 성격이었다. 색차가 133 이면 「따뜻한 흰빛」이고
   177 이면 「전구빛」이고 197 이면 **「불」**이다. 앞엣것은 조명이 잘 된 사무실이고
   뒤엣것은 불을 켜 둔 방인데, 이 게임이 하려는 건 뒤쪽이다.

   ── 문 표시등과 어떻게 갈라지나 ──

   진해질수록 문 표시등(0xFF9F6B)과 가까워지는 게 걱정이었는데, **색상각을 재 보니
   오히려 벌어졌다.** 표시등은 21°(붉은 주황)이고 이쪽은 33.5°(호박빛 노랑)다 —
   같은 「주황」이라도 표시등은 빨강 쪽, 조명은 노랑 쪽이다. 진하게 만들면서 붉은 쪽으로
   갔으면 둘이 붙었겠지만 노란 쪽으로 갔으므로 그 반대다. 채도를 올릴 때 R 은 이미
   255 라 못 올리고 **G 와 B 를 어떻게 내리느냐**가 색상각을 정하는데, B 를 G 보다
   빠르게 내리면 노란 쪽으로 간다. 그 비율을 지키면 아무리 진해져도 표시등과 안 붙는다.
   크기도 그대로 다르다: 표시등은 반경 0.85칸짜리 **점**, 이쪽은 2~4.6칸짜리 **면**. */
const COZY_HUE = 0xFFA83A;

/* **시간대를 거의 안 탄다.** 이번 수정의 요구사항이 이 한 줄이다 — 「시간대 상관없이
   확실하게」. 낮이라고 꺼지는 등은 방에서 광원이 아니라 가구다.

   그래도 완전히 고정하지는 않는다(1.00~1.18). 밤에 18% 더 밝은 것은 밝기 차라기보다
   **눈이 어둠에 익는 것과 같은 방향**이고, 여기를 아예 상수로 못 박으면 이 방에서
   시간이 흐르는 것을 말하는 물건이 창과 필름 그레이드밖에 안 남는다.

   **바닥이 1.00 이다.** 0.88 로 뒀다가 낮 화면을 찍어 보고 올렸다: 오전 칸의 필름
   그레이드가 채도를 0.48 까지 빼는데(eerie.TIME.day) 그 위에서 12% 를 더 깎으면
   따뜻한 웅덩이가 「조금 밝은 회색」이 된다. 밤에 예쁜 값을 낮에 그대로 쓸 수 없다는
   것이 이 표 전체의 교훈이고, 여기서는 **낮 쪽을 기준으로 잡았다.** */
const COZY_BY_LAMP = [1.00, 1.18];

/* 등불의 바닥값 — **책상등도 꺼지지 않는다.**

   지금까지 책상등 세기는 시간대표의 lamp 를 그대로 썼는데, 그 표의 낮 칸이 0.34 라
   (eerie.TIME.day) 낮 화면에서 책상 웅덩이가 사실상 없었다. 표가 틀린 건 아니다 —
   그건 「해가 떠 있으니 등이 덜 필요하다」는 현실의 기술이다. 다만 이 게임의 화면은
   현실의 기록이 아니라 곁에 두는 방이고, 그 방은 **아침에도 등이 켜져 있는 방**이다.

   표를 고치지 않고 바닥만 깐 이유: lamp 값은 표에서 세기 말고도 발광면 세기(glow
   폴백)와 천장등 보간에 같이 쓰인다. 표를 만지면 그 셋이 한꺼번에 움직이고,
   무엇보다 표는 「그 시각의 바깥」을 적어 둔 문서라 그대로 읽히는 편이 낫다.
   바닥은 소비하는 자리에서 깐다. */
const LAMP_FLOOR = 0.92;
const lampK = p => Math.max(LAMP_FLOOR, p.lamp || 0);

/* 새 기구가 심은 것들. **사무실을 다시 세울 때 같이 걷어야 한다** —
   안 걷으면 쌓인다(ceilLights 가 82개까지 갔던 그 사고다). */
let cozyLights = [], cozyGlows = [], flames = [], cozyKinds = {};

function cozyClear(){
  cozyLights.forEach(l => scene.remove(l));
  cozyLights = []; cozyGlows = []; flames = [];
  cozyKinds = { lamp: 0, sconce: 0, string: 0, lantern: 0 };
}

/* 기구 하나를 등록한다. 발광면은 시간대가 다시 칠할 수 있게 모으고, 불꽃은 따로
   모은다(매 프레임 떨기 때문에 시간대 쪽 목록에 있으면 일을 두 번 한다). */
function cozyRegister(o){
  o.traverse(m => {
    if (!m.userData) return;
    if (m.userData.flame) flames.push(m);
    else if (m.userData.lit != null) cozyGlows.push(m);
  });
}

/* 기구의 userData.bulb(로컬 좌표)에 점광원을 얹는다.

   점광원은 **씬에 직접** 단다 — 기구의 자식으로 두면 정적 병합(collapse)과 회전에
   같이 끌려간다. 문 표시등이 같은 이유로 같은 짓을 한다(markDoor).
   상한을 넘으면 조용히 안 단다: 기구는 그대로 서 있고 발광면도 그대로 빛나므로
   그림에서 사라지는 것은 웅덩이 하나뿐이다. */
function cozyBulb(o, kind, local){
  if (cozyKinds[kind] >= COZY_CAP[kind]) return null;
  const c = COZY_LIGHT[kind];
  o.updateMatrixWorld(true);
  const wp = o.localToWorld((local || o.userData.bulb).clone());
  const pl = new THREE.PointLight(COZY_HUE, c.i, c.r, 2);
  pl.position.copy(wp);
  pl.userData.cozy = c.i;
  scene.add(pl);
  cozyLights.push(pl);
  cozyKinds[kind]++;
  return pl;
}

/* ---------- 배치 ----------
   격자를 읽어서 자리를 고른다. **난수를 안 쓴다** — 사무실을 다시 그릴 때마다
   (가구 하나 옮길 때마다·러그 깔 때마다) 등이 이사하면 그건 조명이 아니라 유령이다.
   deskProps 가 좌표 해시를 쓰는 것과 같은 규칙이다. */
function buildCozy(g, world, TILE){
  const grid = world.grid;
  const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= D) ? TILE.WALL : grid[z * W + x];
  const walk = t => t === TILE.FLOOR || t === TILE.DOOR;

  /* 벽에 이미 걸린 것 — 칸 번호로 편다. 벽등은 빈 칸에만 걸고, 전구줄은 캣워크가
     지나는 칸을 건너뛴다(널판이 y 1.84~1.92 에 있어서 알맹이가 나무를 뚫는다). */
  const deco = new Map();
  (world.wallDecor || []).forEach(d => {
    const n = d.span || 1, base = (d.face === 'w' ? d.y : d.x);
    for (let i = 0; i < n; i++) deco.set(d.face + ':' + (base + i), d.tile);
  });

  /* ---------- 전구줄 ----------
     벽 하나에 한 줄. 이어진 벽 칸 중 **제일 긴 구간**에 건다 — 짧은 구간에 걸면
     처짐이 한 번밖에 안 나오고, 이 물건의 그림은 처짐이 반복되는 리듬이다.

     높이 2.12 · 벽에서 0.20칸. 둘 다 재서 정한 값이다: 벽에 걸린 것 중 제일 높이
     솟는 창틀 머리(y 1.91~2.01 · z 1.05~1.12)를 알맹이가 안 건드려야 한다.
     알맹이는 z 1.155~1.245 에 오고 제일 낮은 것이 y 1.853 이라 창틀 앞을 지나간다.
     캣워크(z 1.01~1.35)만은 그렇게 못 피해서 칸을 통째로 뺐다. */
  const STR_Y = 2.12, STR_OUT = 0.20;
  const runOf = (face, lo, hi, isWall) => {
    let best = null, s = -1;
    for (let i = lo; i <= hi + 1; i++){
      const ok = i <= hi && isWall(i) && deco.get(face + ':' + i) !== TILE.CATWALK;
      if (ok && s < 0) s = i;
      if (!ok && s >= 0){
        if (!best || i - s > best.b - best.a) best = { a: s, b: i };
        s = -1;
      }
    }
    return best && (best.b - best.a) >= 3 ? best : null;
  };
  [['n', runOf('n', 1, W - 2, i => at(i, 0) === TILE.WALL)],
   ['w', runOf('w', 1, D - 2, i => at(0, i) === TILE.WALL)]].forEach(([face, r]) => {
    if (!r) return;
    const len = (r.b - r.a) - 0.35;                 // 벽 끝에 딱 붙이지 않는다
    const mid = (r.a + r.b) / 2;
    const s = LP.stringLights(len, { sag: 0.16, gap: 0.34 });
    if (face === 'n') s.position.set(mid, STR_Y, 1.0 + STR_OUT);
    else { s.position.set(1.0 + STR_OUT, STR_Y, mid); s.rotation.y = Math.PI / 2; }
    g.add(s);
    cozyRegister(s);
    /* 골마다 하나씩, 양쪽 벽이 상한을 나눠 갖게 **번갈아** 얹는다. 앞에서부터
       채우면 북쪽 벽이 넷을 다 먹고 서쪽 벽은 알맹이만 빛나는 줄이 된다. */
    const hooks = s.userData.hooks || [];
    hooks.forEach((h, i) => {
      if (hooks.length > 2 && i % 2 !== (face === 'n' ? 0 : 1)) return;
      cozyBulb(s, 'string', h);
    });
  });

  /* ---------- 벽등 ----------
     「벽에 간간히」가 이 물건의 전부다. 세 칸마다 하나씩 후보를 세우고 상한만큼 쓴다.
     이미 뭔가 걸린 칸은 건너뛴다 — 액자 위에 등을 겹쳐 달면 그건 벽등이 아니라 사고다.
     높이 1.56 은 전구줄(제일 낮은 알맹이 1.853)과 벽 선반(윗면 1.44) 사이의 빈 띠다. */
  const SC_Y = 1.56;
  const scCand = [];
  for (let x = 2; x <= W - 3; x++)
    if (at(x, 0) === TILE.WALL && !deco.has('n:' + x)) scCand.push(['n', x]);
  for (let z = 2; z <= D - 3; z++)
    if (at(0, z) === TILE.WALL && !deco.has('w:' + z)) scCand.push(['w', z]);
  const scLast = { n: -9, w: -9 };
  scCand.forEach(([face, i]) => {
    if (i - scLast[face] < 3) return;
    if (cozyKinds.sconce >= COZY_CAP.sconce) return;
    scLast[face] = i;
    /* 두 벌을 번갈아 쓴다 — 같은 등이 넷이면 벽이 아니라 카탈로그다. */
    const o = LP.sconce(i % 2);
    if (face === 'n') o.position.set(i + 0.5, SC_Y, 1.005);
    else { o.position.set(1.005, SC_Y, i + 0.5); o.rotation.y = Math.PI / 2; }
    g.add(o);
    cozyRegister(o);
    cozyBulb(o, 'sconce');
  });

  /* ---------- 스탠딩 스탠드 ----------
     **죽은 구석에 세운다.** 이 방의 바닥은 전부 길이라(격자를 안 건드린다 — 렌더러는
     읽기만 한다) 어디에 세워도 고양이가 지나갈 수는 있다. 그래서 **덜 지나가는 칸**을
     고른다: 네 이웃 중 둘 이상이 길이 아닌 칸, 즉 구석과 벽 사이 오목한 자리다.
     그런 칸은 목적지가 없으므로 길찾기가 거의 안 지난다.

     이건 새 규칙이 아니다 — world.js 의 clutter 가 정확히 같은 조건으로 상자와
     서류더미를 바닥에 놓는다(「통로 한가운데 굴러다니면 이상하다」). 다만 등은 키가
     1.5칸이라 겹치면 더 눈에 띄므로, 칸 가운데가 아니라 **벽 쪽으로 물려서** 세운다.

     문 앞은 뺀다. 거기는 출퇴근 길목이라 하루에 스무 번 지나간다. */
  const lampCand = [];
  for (let z = 1; z <= D - 3; z++){
    for (let x = 1; x <= W - 2; x++){
      if (at(x, z) !== TILE.FLOOR) continue;
      if (seatCells.has(z * W + x)) continue;
      if ((world.clutter || []).some(c => c.x === x && c.y === z)) continue;
      if (world.door && Math.abs(x - world.door.x) < 2 && z >= D - 4) continue;
      const e = at(x + 1, z), w = at(x - 1, z), s = at(x, z + 1), n = at(x, z - 1);
      const dead = [e, w, s, n].filter(t => !walk(t)).length;
      if (dead < 2) continue;
      lampCand.push({
        x, z, dead,
        ox: !walk(w) ? 0.30 : !walk(e) ? 0.70 : 0.5,
        oz: !walk(n) ? 0.32 : !walk(s) ? 0.68 : 0.5,
      });
    }
  }
  /* ── 자리를 **한 번만** 고르고, 그다음부터는 목록을 따른다 ──
     예전에는 세울 때마다 여기서 자리를 다시 골랐다. 그래서 이 등들은 **아무도 못 만지는
     물건**이었다: 격자에 없으니 배치 모드가 고를 수 없고, 옮기지도 치우지도 못한다.
     방을 꾸미는 사람 눈에는 「지울 수 없는 가구」였다.

     이제 처음 한 번만 골라서 `world.lights` 에 적고(저장에 남는다), 그다음부터는
     그 목록대로 세운다. 목록이니 **하나씩 만질 수 있다** — 배치 모드가 고르고 옮기고
     치운다(js/edit.js 의 kind 'light'). 격자는 여전히 한 칸도 안 먹으므로 길과 무관하다.
     러그·얹은 소품과 같은 방식이다. */
  lampCand.sort((a, b) => b.dead - a.dead || a.z - b.z || a.x - b.x);
  if (!Array.isArray(world.lights)){
    const chosen = [], spread = (c, d) => chosen.every(p =>
      Math.abs(p.x - c.x) + Math.abs(p.y - c.z) >= d);
    let lamps = 0, lanterns = 0;
    lampCand.forEach(c => {
      if (lamps >= COZY_CAP.lamp || !spread(c, 4)) return;
      lamps++; chosen.push({ x:c.x, y:c.z, kind:'lamp', ox:c.ox, oz:c.oz });
    });
    lampCand.forEach(c => {
      if (lanterns >= COZY_CAP.lantern || !spread(c, 3)) return;
      lanterns++; chosen.push({ x:c.x, y:c.z, kind:'lantern', ox:c.ox, oz:c.oz });
    });
    world.lights = chosen;
    if (typeof snapshotWorld === 'function') snapshotWorld();
  }
  (world.lights || []).forEach(c => {
    const kind = c.kind === 'lantern' ? 'lantern' : 'lamp';
    if (cozyKinds[kind] >= COZY_CAP[kind]) return;
    const o = kind === 'lantern' ? LP.lantern() : LP.floorLamp((c.x + c.y) % 2);
    o.position.set(c.x + (c.ox != null ? c.ox : 0.5), 0, c.y + (c.oz != null ? c.oz : 0.5));
    g.add(o);
    cozyRegister(o);
    cozyBulb(o, kind);
  });

  /* ---------- 선반 위 ----------
     책장(TILE.SHELF)의 맨 윗칸은 늘 비어 있다(lowpoly.shelf 는 책을 아래 두 칸에만
     꽂는다). 거기에 양초를 올린다 — 눈높이보다 조금 위에서 떠는 점 하나가 방을
     제일 싸게 데운다. 광원은 안 붙인다(lowpoly.candles 머리말 참고). */
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++){
      if (grid[z * W + x] !== TILE.SHELF) continue;
      const o = LP.candles(2 + ((x + z) % 2));
      o.position.set(x + 0.5, 1.31, z + 0.5);
      g.add(o);
      cozyRegister(o);
    }
}

/* 벽 선반의 비운 자리에 등을 하나 올린다(lowpoly.wallShelf 의 opt.free).
   **선반의 자식으로 붙인다** — 북쪽 벽과 서쪽 벽에서 선반이 서로 다르게 돌아가 있고,
   자식으로 두면 그 회전을 공짜로 따라간다(밖에서 좌표를 다시 세면 한쪽 벽에서만
   등이 허공에 뜬다. 실제로 그렇게 만들어 보고 알았다). */
function shelfLamp(o, d){
  const f = o.userData.free;
  if (!f) return;
  o.updateMatrixWorld(true);        // 자식의 월드 좌표를 재려면 부모가 먼저 서 있어야 한다
  /* 선반마다 다른 것을 올린다 — 벽에 선반이 둘인데 같은 등이 올라가 있으면
     그건 선반이 아니라 복사본이다. v 는 world.js 가 저장에 실어 둔 변주 값이라
     사무실을 다시 열어도 같은 것이 올라가 있다. */
  const lit = ((d.v || 0) % 2) ? LP.candles(2) : LP.lantern();
  lit.position.copy(f);
  o.add(lit);
  cozyRegister(lit);
  if (lit.userData.bulb) cozyBulb(lit, 'lantern');
}

/* ---------- 정적 사무실 ----------
   world.js 의 격자를 그대로 읽는다. 배치 로직은 손대지 않는다. */
/* 마지막으로 세운 월드. 컷신이 **자리(책상)** 를 물어보는 데 쓴다.
   전역 W 를 짚을 수 없어서다 — 고전 스크립트가 `let W` 로 잡아 두면 그건 window 의
   속성이 아니라서 모듈에서 안 보인다(실측: window.W 가 undefined 였다). */
let WORLD = null;

export function build(world, TILE){
  if (!ready || !world) return;
  WORLD = world;
  /* 고른 벌을 팔레트에 한 겹 얹는다. 텍스처를 못 쓰는 자리(러그 기본색·액자 테두리·
     콘센트)가 이걸 읽는다 — 벽지를 갈았는데 그 자리들만 옛 색이면 방이 두 장으로 갈린다.
     그리고 벌이 바뀌었으면 옛 텍스처를 버린다. */
  if (window.DECOR){
    const c = window.DECOR.cur(), k = c.wall + '|' + c.floor;
    LP.setPalette(window.DECOR.pal());
    if (k !== decorKey){ decorReset(); decorKey = k; }
  }
  if (statics){ scene.remove(statics); statics = null; }
  screens = []; glows = []; panes = [];
  /* **씬에서도 걷는다.** 배열만 비우면 옛 광원이 씬에 그대로 남는다 — 바로 아랫줄의
     스탠드는 걷고 있는데 천장등만 빠져 있었다. 사무실을 다시 세우는 일은 자주 일어나므로
     (가구 하나 옮길 때마다·러그 깔 때마다·벽지 갈 때마다 renderTiles 가 돈다) 그때마다
     광원이 쌓였다. 등급 4 사무실에서 **82개**까지 갔다 — 있어야 할 수는 15개다.

     Lambert 셰이더는 광원 수만큼 루프를 돌고, three 는 그 수가 바뀔 때마다 셰이더를
     **다시 컴파일한다.** 「요소가 많아져서 버벅인다」의 정체가 이것이었다.
     그리고 성능만의 문제도 아니었다: 걷히지 않은 등은 night() 이 못 잡으므로 옛 세기를
     그대로 들고 있어서, 배치를 만질수록 방이 조용히 밝아졌다. */
  ceilLights.forEach(l => scene.remove(l));
  ceilLights = []; ceilSwitch = null;
  lampLights.forEach(l => scene.remove(l));
  lampLights = [];
  /* 새 조명 기구가 심은 점광원도 같이 걷는다 — 위 두 줄과 같은 이유다(buildCozy) */
  cozyClear();
  /* 창이 늘거나 줄었을 수 있다 — 다음 night() 이 반드시 다시 칠하게 자물쇠를 푼다 */
  lastSky = '';

  W = world.W; D = world.H;
  const F = furnTable(TILE);
  const g = new THREE.Group();

  /* ---------- 바닥 ----------
     칸을 가리지 않고 **전부** 깐다. 벽 칸이라고 건너뛰면 안 된다 —
     내부 칸막이는 얇게(0.26) 세우므로 그 칸 바닥을 빼면 방 한가운데에 구멍이 남는다.
     바깥벽 밑은 두꺼운 벽이 덮으니 깔아도 안 보이고, 공짜다(어차피 하나로 병합된다).

     예외는 잘라내는 가장자리 둘뿐이다 — 아래 벽줄(z=H-1)과 오른쪽 벽열(x=W-1).
     2D 판도 이 둘을 안 그린다. 좌우가 트여야 사무실이 넓어 보이고,
     아래 줄에는 출입문 한 칸만 바닥이라 그것만 남으면 방 밖으로 타일이 툭 튀어나온다.
     문은 격자에 그대로 살아 있고(NPC 등·퇴장 지점) 화면에만 없다. */
  /* 예전에는 칸마다 상자를 하나씩 깔았다(사무실 하나에 백 개 넘게). 무늬를 넣으려니
     그 배선으로는 체커밖에 못 만든다 — 나뭇결·다다미 테두리·테라조 조각은 칸 안에서
     일어나는 일이다. 그래서 **방 하나를 통째로 그린 판 한 장**으로 바꿨다.
     드로우콜이 백 개에서 하나로 줄고, 무늬는 무엇이든 들어간다.

     칸 격자와 정확히 맞는다: 판이 [0,W-1]×[0,D-1] 을 덮고 UV 가 0..1 이므로
     캔버스 1픽셀행 = 월드 z 0, 한 칸 = ppu 픽셀이다. (구역별 바닥은 없앴다 —
     이미 「구역은 가구가 말한다」로 통일해 둔 판단이고, 이제 바닥은 플레이어가 고른다.) */
  {
    const fw = W - 1, fd = D - 1;
    const fid = window.DECOR ? window.DECOR.cur().floor : 'carpet';
    const tex = decorTex('floor', fid, fw, fd, FLOOR_PPU);
    const fm = tex ? new THREE.MeshLambertMaterial({ map: tex, flatShading: false })
                   : LP.mat(LP.PAL.floor);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), fm);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(fw / 2, 0, fd / 2);
    pl.receiveShadow = true; pl.castShadow = false;
    pl.userData.dynamic = true;                 // 병합되면 텍스처가 죽는다
    g.add(pl);
  }

  /* ---------- 러그 ----------
     바닥판 위에 얹는 낱개 물건(TODO 49). **격자에 없다** — 시뮬은 이 목록을 아예
     모르고, 고양이는 러그를 밟고 지나간다. 그리는 쪽만 아는 정보다.
     남의 사무실을 구경할 때는 목록이 없으므로(js/visit.js) 자연히 안 깔린다. */
  rugMeshes = [];
  (world.rugs || []).forEach(r => {
    const m = rugMesh(r);
    if (m){ g.add(m); rugMeshes.push(m); }
  });

  /* ---------- 벽 ----------
     칸마다 상자를 하나씩 세우면 두 가지가 망가진다: 맞닿은 면에서 이음매가 보이고,
     상자 수만큼 정점이 늘어난다. 그래서 붙어 있는 벽 칸을 직사각형으로 묶어
     덩어리 하나로 세운다 (greedy rect merge).

     그리고 바깥벽과 내부 칸막이의 높이를 다르게 준다. world.js 는 휴게실·회의실을
     같은 TILE.WALL 로 나누는데, 2D 에서는 얇은 선이라 문제가 없었지만 3D 에서
     같은 높이로 세우면 사무실 절반이 그 뒤로 사라진다. 칸막이는 넘겨다볼 수 있어야 한다. */
  const WH = 2.3, PH = 0.95;
  const outer = (x, z) => x === 0 || z === 0 || x === W - 1 || z === D - 1;
  const isWall = (x, z) =>
    x >= 0 && z >= 0 && x < W && z < D && world.grid[z * W + x] === TILE.WALL
    /* 남쪽·동쪽 바깥벽은 세우지 않는다 — 카메라가 그쪽에 있어서 씬을 가린다.
       2D 판이 "양옆 벽과 아래 벽줄을 안 그리던" 것과 같은 이유다.
       문은 그 줄에 있고, NPC 등·퇴장 지점으로 여전히 살아 있다. */
    && z !== D - 1 && x !== W - 1;

  const used = new Uint8Array(W * D);
  for (let z = 0; z < D; z++){
    for (let x = 0; x < W; x++){
      const i = z * W + x;
      if (used[i] || !isWall(x, z)) continue;
      const h = outer(x, z) ? WH : PH;
      const same = (xx, zz) => isWall(xx, zz) && !used[zz * W + xx]
                            && (outer(xx, zz) ? WH : PH) === h;
      let w = 1;
      while (same(x + w, z)) w++;
      let d = 1;
      outer_loop:
      while (true){
        for (let k = 0; k < w; k++) if (!same(x + k, z + d)) break outer_loop;
        d++;
      }
      for (let dz = 0; dz < d; dz++)
        for (let dx = 0; dx < w; dx++) used[(z + dz) * W + x + dx] = 1;
      /* 격자에서 벽은 한 칸을 통째로 먹는다. 2D 에서는 그게 얇은 선으로 보였지만
         3D 에서 1칸 두께로 세우면 칸막이가 벽이 아니라 덩어리가 된다.
         바깥벽은 두꺼운 게 맞고, 내부 칸막이만 가늘게 줄인다. */
      const thin = h === PH ? 0.26 : 1;
      const bw = w === 1 ? thin : w, bd = d === 1 ? thin : d;
      g.add(wallBox(bw, h, bd, x + w / 2, h / 2, z + d / 2));
      /* 걸레받이와 허리 몰딩. 벽 두께보다 확실히 튀어나와야 빛을 받아 선이 생긴다 —
         +0.02 로는 아무 일도 안 일어난다(한 번 그렇게 넣고 화면에서 못 찾았다).
         큰 판 하나짜리 벽은 로우폴리가 아니라 그냥 빈 면이고, 가로줄 두 개면 벽이 된다. */
      g.add(LP.box(bw + 0.08, 0.13, bd + 0.08, LP.PAL.wallTrim, x + w / 2, 0.065, z + d / 2));
      if (h === WH)
        g.add(LP.box(bw + 0.07, 0.075, bd + 0.07, LP.PAL.wallTrim, x + w / 2, 0.95, z + d / 2));
    }
  }

  /* ---------- 천장등 ----------
     책상등이 여섯 개인데 천장등이 없었다. 그래서 넓은 사무실(냥타워, 14×12)에서
     책상 사이 통로가 통째로 어둠이 된다 — 등불 반경을 5.5 에서 3.2 로 줄이고 나서
     그게 드러났다(spike/verify-lamp.js: 통로의 고양이 둘이 배경에 녹았다).

     방 전체를 고르게 밝히는 건 이 등의 일이고, 책상 웅덩이를 만드는 건 책상등의 일이다.
     둘을 한 물건이 하려니까 「반경 5.5칸짜리 책상등」 같은 게 나왔던 것이다.

     반경은 방 크기를 따라간다 — 큰 사무실에 같은 등을 달면 구석이 안 닿는다.
     높이는 벽 끝(WH=2.3)에서 내려온다. 천장 자체는 안 그린다(카메라가 위에 있다).

     **끌 수 있다.** 그게 이 물건의 절반이다 — 아래 벽 스위치를 보라. */
  {
    /* 저장에서 켜짐/꺼짐을 되살린다. 스위치를 내려 두고 창을 닫았는데 다시 열었더니
       불이 켜져 있으면, 그건 스위치가 아니라 버튼이다.
       (window.DECOR 와 같은 결합이다 — 이 파일이 게임 상태를 보는 두 번째 자리) */
    if (typeof S !== 'undefined' && S && S.ceil !== undefined) ceilOn = !!S.ceil;
    /* 다시 지으면 시간대를 새 등에 다시 칠해야 한다. night() 은 같은 시각이면
       그냥 돌아가므로(lastSky), 캐시를 깨 두지 않으면 새 천장등이 꺼진 채 남는다. */
    lastSky = '';

    /* **개수는 방 크기를 따라간다.** 하나로 못 박았다가 냥타워(14×12)에서 걸렸다:
       밤에 통로의 절반이 어둠에 잠겼다(spike/verify-lamp.js 51.5%). 등 하나를 세게
       켜서 메우는 길도 있었는데, 그러면 방 한가운데만 하얗게 타고 구석은 그대로다 —
       빛은 거리 제곱으로 죽기 때문이다. 그리고 애초에 14×12 사무실에 형광등이
       하나인 게 이상하다. 그래서 **세기 대신 개수**를 늘린다.

       한 등이 대략 7칸을 맡는다. 10×8 은 둘, 14×12 는 넷. 격자로 고르게 나눠 걸되
       벽에 너무 붙지 않게 안쪽으로 물린다. */
    const nx = Math.max(1, Math.round(W / 7)), nz = Math.max(1, Math.round(D / 7));
    for (let iz = 0; iz < nz; iz++){
      for (let ix = 0; ix < nx; ix++){
        const cx = W * (ix + 0.5) / nx, cz = D * (iz + 0.5) / nz;
        /* **갓은 안 그린다**(2026-08-25). 카메라가 위에 있는 화면에서 천장에 매달린
           물건은 방을 가리는 일만 한다 — 등 밑의 고양이가 갓에 먹혔다.
           빛은 그대로 나온다. 여기서 없앤 것은 조명이 아니라 **조명 기구**다.
           켜짐/꺼짐은 벽 스위치가 말한다(lightSwitch 의 손잡이와 표시등). */
        const b = { x:0, y:-0.85, z:0 };        // 예전 pendant(0.55) 의 전구 자리
        const bulbY = 2.30 + b.y;
        /* 반경은 제가 맡은 구획보다 **넉넉히** — 이웃과 겹쳐야 한다.
           4.5칸으로 잡았다가 냥타워에서 걸렸다: 구획이 7×6 인데 반경이 4.5 라
           구석이 통째로 빠졌고, 밤 통로의 53%가 어둠이었다(verify-lamp.js).
           세기를 올려 메우면 등 밑만 하얗게 타므로(거리 제곱) **반경으로 메운다.** */
        const reach = Math.max(7.0, Math.max(W / nx, D / nz) * 1.5);
        const pl = new THREE.PointLight(0xFFCE8A, 0, reach, 2);
        pl.position.set(cx + b.x, bulbY, cz + b.z);
        /* 천장등은 그림자를 안 만든다. 방 한가운데서 사방으로 쏘는 그림자는 큐브맵
           여섯 면이라 비싸고, 위에서 내려다보는 화면에서는 거의 안 보인다. */
        scene.add(pl);
        ceilLights.push(pl);

        /* 빛 원뿔도 같이 빠졌다 — 매달린 것이 없는데 원뿔만 남으면 그건 채광이 아니라
           허공에서 쏘는 빛이다. 갓과 원뿔은 한 물건이었다. */
      }
    }

    /* 스위치는 **문에서 가장 가까운 보이는 벽**에 붙인다. 문은 남쪽 벽(z=D-1)에 있고
       그 벽은 카메라 쪽이라 안 그린다 — 그래서 서쪽 벽, 들어오자마자 손이 닿는 자리다.
       실제 사무실에서 스위치가 있는 곳이기도 하다.

       **자리를 고정하면 안 된다.** 처음엔 (1.02, D-2.5) 에 못 박았다가 두 번 걸렸다:
         · 정수기 뒤에 숨었다 — 사무실은 절차적으로 생성되므로 그 칸에 뭐가 설지 모른다
         · 화면 밖으로 나갔다 — 기본 시점에서 서쪽 벽의 **남쪽 끝은 잘린다**
           (verify-switch.js 가 화면 좌표 x=-121 을 물어 왔다)

       그래서 **북쪽 벽을 먼저 본다.** 문에서 먼 건 사실이지만 그쪽이 이 디오라마의
       뒷벽이라 어느 시점에서도 화면 안에 있다. 눌러야 하는 물건에서는 그게 먼저다 —
       안 보이는 스위치는 벽에 그린 그림이다.

       거는 자리 조건 둘: 벽 앞 칸이 빈 바닥이고(가구에 안 가리게),
       그 칸에 이미 벽에 걸린 것이 없어야 한다(창·화이트보드와 안 겹치게). */
    const taken = new Set((world.wallDecor || [])
      .filter(d => d.face !== 'w')
      .flatMap(d => { const n = d.span || 1; return Array.from({ length:n }, (_, i) => d.x + i); }));
    const wTaken = new Set((world.wallDecor || [])
      .filter(d => d.face === 'w')
      .flatMap(d => { const n = d.span || 1; return Array.from({ length:n }, (_, i) => d.y + i); }));
    let sw = null;
    for (let x = 1; x < W - 1 && !sw; x++)
      if (world.grid[1 * W + x] === TILE.FLOOR && !taken.has(x)) sw = { x:x + 0.5, z:1.02, ry:0 };
    for (let z = 1; z < D - 1 && !sw; z++)
      if (world.grid[z * W + 1] === TILE.FLOOR && !wTaken.has(z)) sw = { x:1.02, z:z + 0.5, ry:Math.PI / 2 };
    ceilSwitch = LP.lightSwitch(ceilOn);
    ceilSwitch.position.set(sw ? sw.x : 1.02, 1.18, sw ? sw.z : D - 2.5);
    ceilSwitch.rotation.y = sw ? sw.ry : Math.PI / 2;
    ceilSwitch.userData.dynamic = true;
    ceilSwitch.traverse(o => { o.userData.dynamic = true; o.userData.ceilSwitch = true; });
    g.add(ceilSwitch);
  }

  /* 콘센트와 스위치 — 손톱만 하고 아무 기능도 없다. 그런데 세 칸마다 하나씩 박혀 있으면
     벽이 벽지가 아니라 건물의 벽이 된다. 카메라가 보는 두 면(북·서)에만 둔다. */
  for (let x = 2; x < W - 1; x += 3){
    if (world.grid[x] !== TILE.WALL) continue;
    const up = x % 6 === 2;
    const o = LP.outlet(up ? 1 : 0);
    o.position.set(x + 0.5, up ? 1.10 : 0.30, 1.005);
    g.add(o);
  }
  for (let z = 2; z < D - 1; z += 3){
    if (world.grid[z * W] !== TILE.WALL) continue;
    const up = z % 6 === 5;
    const o = LP.outlet(up ? 1 : 0);
    o.position.set(1.005, up ? 1.10 : 0.30, z + 0.5);
    o.rotation.y = Math.PI / 2;
    g.add(o);
  }

  /* 가구 */
  const DOORS = doorTiles(TILE);
  marks35 = []; markPts = [];
  doorLights.forEach(l => scene.remove(l));
  doorLights = [];
  for (let z = 0; z < D; z++){
    for (let x = 0; x < W; x++){
      const t = world.grid[z * W + x];
      const def = F[t];
      if (!def || def.skip || def.wall) continue;
      const o = def.b();
      o.position.set(x + (def.w === 2 ? 1 : 0.5), 0, z + 0.5);
      /* 벽에 붙는 물건은 등을 벽에 대야 한다. 어느 쪽이 벽인지 격자에서 보고 돌린다.
         그 위에 플레이어가 돌려 둔 각을 **더한다**(배치 모드, world.rot).
         더하는 게 중요하다 — 0 이면 지금까지와 한 각도도 안 달라지고,
         벽 쉼터를 돌려도 "벽 기준에서 얼마나" 가 유지된다. */
      const turn = ((world.rot && world.rot[z * W + x]) | 0) * (Math.PI / 2);
      o.rotation.y = (def.toWall ? wallFacing(world, TILE, x, z) : 0) + turn;
      g.add(o);
      /* 「누르면 열리는 것」 표시 — 실험이다(TODO 35, ?mark=). 기본은 아무것도 안 붙는다.
         바닥에 서는 문은 CD 플레이어 하나뿐이지만, 여기서 걸러야 그 하나가 빠지지 않는다. */
      markDoor(g, o, t, DOORS, true);
      /* **사서 놓은 조명은 진짜로 켜진다.** 카탈로그의 스탠드·랜턴은 buildCozy 가
         저절로 놓는 것과 같은 기구인데, 여기서 광원을 안 달면 「등 모양 가구」가 된다.
         상한(COZY_CAP)을 같이 쓰므로 저절로 놓인 것과 합쳐 세어진다 — 방에 스탠드가
         열 개 서 있어도 셰이더가 도는 광원은 그대로 셋이다. */
      if (def.lit){
        cozyRegister(o);
        cozyBulb(o, def.lit);
      }
      /* 모델이 스스로 「여기가 화면」이라고 찍어 두면 시간대가 그 발광을 맡는다.
         책상 모니터는 아래에서 타일 종류로 집어 넣는데(그건 책상이 모니터를 따로
         얹기 때문이다), 자기 화면을 몸에 갖고 있는 물건은 여기서 걷어 온다 —
         가구가 늘 때마다 이 자리에 타일 이름을 하나씩 더 적지 않으려는 것이다. */
      o.traverse(m => {
        if (m.isMesh && m.userData && m.userData.screen){
          m.userData.dynamic = true;                // 병합에서 빠진다(merge.js)
          screens.push(m);
        }
      });
      if (t === TILE.DESK || t === TILE.LEGAL || t === TILE.MEETING){
        const m1 = LP.monitor(-0.45, -0.10, 0.14), m2 = LP.monitor(0.55, -0.10, -0.14);
        m1.position.x += x + 1; m1.position.z += z + 0.5;
        m2.position.x += x + 1; m2.position.z += z + 0.5;
        [m1, m2].forEach(m => {
          m.children[3].userData.dynamic = true;      // 시간대마다 발광이 바뀐다
          screens.push(m.children[3]);
          g.add(m);
        });
        deskProps(g, x, z);

        const lamp = LP.lamp();
        lamp.position.set(x + 1.75, 0.65, z + 0.4);
        g.add(lamp);
        const plate = lamp.children[3];
        plate.userData.dynamic = true;
        glows.push(plate);
        const pl = new THREE.PointLight(0xFFB65C, 0, LAMP_R, 2);
        pl.position.set(x + 1.81, 1.09, z + 0.4);
        scene.add(pl);
        lampLights.push(pl);
      }
    }
  }

  /* 자리마다 의자 — 그림만. 격자상 그 칸은 계속 걸어 다닐 수 있다.
     의자는 책상 쪽으로 조금 물린다. 칸 정중앙에 두면 등받이가 카메라와 고양이 사이에 선다. */
  seatCells.clear();
  perchCells.clear();
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++){
      const t = world.grid[z * W + x];
      if (t === TILE.BED){ perchCells.set(z * W + x, 0.14); continue; }   // 낮잠 상자 바닥
      const d = F[t];
      if (d && d.perch) perchCells.set(z * W + x, d.perch);
    }
  /* 의자는 **정적 병합에서 뺀다.** 택배 컷신이 고양이를 뒤로 물릴 때 의자도 같은 만큼
     따라가야 하는데(안 그러면 고양이가 의자 뒤 허공에 앉아 있다), 통째로 합쳐 놓으면
     그 하나만 움직일 수가 없다.

     대신 **의자 하나를 먼저 한 메시로 합친 뒤** keep 을 건다(merge.js 의 규칙).
     그래서 늘어나는 드로우콜은 「책상 수」뿐이다 — 의자 한 대가 박스 여섯 개였으므로
     합치지 않고 빼면 그 여섯 배가 됐다. */
  seatChairs.clear();
  (world.desks || []).forEach(d => {
    const ch = LP.chair(Math.PI);
    ch.position.set(d.seat.x + 0.5, 0, d.seat.y + 0.30);
    collapse(ch, { flatShading: false });
    ch.userData.keep = true;
    g.add(ch);
    seatCells.add(d.seat.y * W + d.seat.x);
    seatChairs.set(d.seat.y * W + d.seat.x, ch);
  });

  /* 벽에 거는 것 — 액자·창문·시계·선반·캣워크.
     북쪽 벽(face 'n')은 안쪽 면이 z=1.0, 서쪽 벽(face 'w')은 x=1.0 이다.
     두 칸 이상을 먹는 것은 그 칸들의 한가운데로 밀어 준다. */
  clockHands.length = 0;
  (world.wallDecor || []).forEach(d => {
    const def = F[d.tile];
    if (!def || !def.wall) return;
    const o = def.b(d);
    if (o.userData.clock) clockHands.push(o.userData.clock);
    // 옛 저장에는 span 이 없다. 그때 두 칸짜리는 화이트보드뿐이었다.
    const span = d.span || (d.tile === TILE.WHITEBOARD ? 2 : 1);
    const off = (span - 1) / 2, out = def.push || 0;
    if (d.face === 'w'){
      o.position.set(1.0 + out, def.y || 1.4, d.y + 0.5 + off);
      o.rotation.y = Math.PI / 2;                  // +z 를 보던 면이 +x(방 안쪽)를 본다
    } else {
      o.position.set(d.x + 0.5 + off, def.y || 1.4, d.y + 1.0 + out);
    }
    g.add(o);
    /* 벽에 걸린 문 셋(달력·게시판·견본책)도 같은 표시를 받는다 — 실험(TODO 35) */
    markDoor(g, o, d.tile, DOORS, false);
    /* 벽 선반은 오른쪽 끝을 비워 두고 나온다. 거기에 등을 하나 올린다. */
    if (d.tile === TILE.WALLSHELF) shelfLamp(o, d);
    /* 창밖은 시간대를 따라간다. 창이 늘 대낮이면 밤 사무실이 밤으로 안 보인다. */
    if (def.pane && o.children[1]){
      o.children[1].userData.dynamic = true;
      panes.push(o.children[1]);
      /* 창에서 방 안으로 들어오는 **빛 자락**이 여기 있었다(2026-08-25 에 없앴다).
         바닥에 십자로 갈라진 빛 웅덩이를 깔아서 「창에서 빛이 들어온다」를 만들던 것이고,
         잘 되던 물건이다. 없앤 이유는 고장이 아니라 **방을 닫아 두기로 한 것**이다 —
         블라인드도 다 내렸다(lowpoly.windowUnit). 창은 여전히 시간대를 말한다:
         살 틈으로 보이는 pane 색이 그 일을 한다. */
    }
  });

  /* ── 가구 **위에** 얹힌 소품 (world.tops) ──
     높이는 표로 적지 않는다. 물건마다 상판 높이를 손으로 적어 두면 가구를 고칠 때마다
     그 표가 조용히 틀리고, 틀린 표는 「초가 책상에 반쯤 박혀 있다」로 나타난다.
     대신 **그 자리에 실제로 선 물건의 상자를 재서** 그 위에 얹는다 — 재료가 이미 있다.

     책상은 예외다: 격자에서 두 칸(DESK+DESK_R)이고 상판이 0.65 로 정해져 있다
     (deskProps 가 쓰는 그 값). 두 번 재느니 그 값을 그대로 쓴다. */
  const topY = (o, tile) => {
    if (tile === TILE.DESK || tile === TILE.DESK_R) return 0.65;
    const b = new THREE.Box3().setFromObject(o);
    const h = b.max.y;
    return (isFinite(h) && h > 0.05) ? h : 0.5;
  };
  (world.tops || []).forEach(p => {
    const host = world.grid[p.y * W + p.x];
    const hd = F[host];
    const pd = F[p.tile];
    if (!hd || !pd || hd.wall || hd.skip) return;      // 받칠 것이 없어졌다 — 조용히 건너뛴다
    /* 상판을 재려면 그 가구를 한 번 세워 봐야 한다. 세운 것은 버린다 —
       방에 서 있는 그 물건은 위에서 이미 넣었다. */
    let y = 0.5;
    try { y = topY(hd.b(), host); } catch (e) {}
    const o = pd.b();
    o.position.set(p.x + (hd.w === 2 ? 1 : 0.5), y, p.y + 0.5);
    o.rotation.y = ((world.rot && world.rot[p.y * W + p.x]) | 0) * (Math.PI / 2);
    if (pd.lit){ cozyRegister(o); cozyBulb(o, pd.lit); }   // 위에 얹은 랜턴도 켜진다
    g.add(o);
  });

  /* 바닥 잡동사니는 **안 그린다**(world.js 가 더는 안 놓는다). 옛 저장에는 아직
     실려 있으므로 여기서도 막아야 그 방들에서 같이 사라진다 — 생성만 멈추면
     이미 만들어진 사무실은 그대로 어질러진 채 남는다. */

  /* 조명 기구 한 벌. **맨 끝에서 부른다** — 자리를 고르려면 격자·벽 장식·의자 칸이
     전부 정해져 있어야 하고, 그 셋이 위에서 채워진다. */
  buildCozy(g, world, TILE);

  scene.add(g);
  statics = g;

  /* 정적 병합 — 색을 정점에 구워 넣어 전부 한 번에 그린다.
     시간대마다 색이 바뀌는 것(모니터 화면·전구)만 dynamic 으로 빠진다. */
  collapse(g, { flatShading: false });

  const span = Math.max(W, D) * 0.9;
  Object.assign(sun.shadow.camera, { left:-span, right:span, top:span, bottom:-span, near:0.5, far:60 });
  sun.shadow.camera.updateProjectionMatrix();
  /* 시선은 **사무실이 바뀌었을 때만** 가운데로 돌린다.
     가구를 하나 옮기거나 돌릴 때마다 world:rebuilt 가 날아와 여기가 다시 도는데,
     그때마다 가운데로 끌려가면 팬으로 옮겨 둔 시점이 매번 초기화된다 —
     그리고 배치 모드가 팬을 제일 많이 쓰는 곳이다. */
  if (W !== builtW || D !== builtD){
    builtW = W; builtD = D;
    look.set(W / 2, 0.5, D / 2);
  }
  fit();
}

/* ---------- 액터 ----------
   고양이는 손그림이다. 폴리곤으로 깎은 것보다 이 게임에 맞는다 —
   캣닢 조직이라는 농담과 결이 같고, 사람이 그은 선은 흉내낼 수 없다.

   그림 한 장을 판에 붙여 3D 공간에 세우고 카메라를 보게 한다(빌보드).
   판이라서 마리당 드로우콜이 1이고, 조명을 받으므로 저녁·야근의 색이 그림에도 얹힌다.

   같은 고양이의 앞·뒤 그림이 생기면 방향에 따라 갈아 끼우면 된다 — DRAW 를 늘리고
   pickDraw 만 고치면 되게 해 뒀다. */
/* 고양이 그림 목록. assets/cats_drawn/list.js 가 곧 목록이고,
   그건 tools/split-doodles.js 가 만든다 — 그림을 더 그려 넣고 그 도구만 다시 돌리면
   채용 화면의 선택지가 저절로 늘어난다. 코드에 파일 이름을 적어두지 않는 이유다.

   fetch 가 아니라 **정적 import** 인 이유: 예전엔 index.json 을 받아 왔는데,
   그 사이에 만들어진 고양이가 전부 첫 그림으로 굳었다. 렌더가 무거우면 응답 처리가
   메인 스레드에서 밀려서(헤드리스 실측 5~12초) 목록이 늦게 온다. import 는 첫 프레임 전이다.

   방향(앞·뒤·옆)으로 갈아 끼우는 것은 뺐다. 한 마리 = 한 그림이다 —
   그래야 그림마다 다른 고양이가 되고, 채용할 때 고르는 대상이 생긴다. */
/* 경로는 assets.js 의 표를 지난다 — 도트 시트가 그러는 것과 같은 규약이다.
   파일 하나로 묶은 배포본에서는 여기서 data: URI 가 나온다. 그게 필요한 이유는
   크기가 아니라 **캔버스 오염**이다: file:// 에서 불러온 그림을 캔버스에 그리면
   getImageData 가 막히고, 손그림은 그 단계에서 밝기를 올린다(doodle.js). */
const drawURL = n => assetURL(`assets/cats_drawn/${n}`);
window.CAT_DRAWS = DRAWS;          // 채용 화면(ui.js)이 이 목록에서 고른다

const drawIdx = c => {
  const n = DRAWS.length || 1;
  if (c.draw != null) return ((c.draw % n) + n) % n;
  return (((c.fur || 0) * 3 + Math.abs(Math.round((c.hue || 0) / 60))) % n + n) % n;
};
const drawOf = c => drawURL(DRAWS[drawIdx(c)] || 'cat-1.png');

/* ---------- 고양이 그림체 ----------
   'sculpt'  깎아서 만든 진짜 3D 고양이 (spike/m1 에서 확정한 조형)
   'doodle'  손그림 판. **지운 게 아니라 보험이다** — 위젯·PiP 경로가 아직 미확인이고,
             그림체를 되돌릴 자리를 남겨 두는 편이 싸다.
   설정에서 고르고 localStorage 에 남는다. */
/* 앉은 고양이가 보는 쪽 — 책상이다.

   책상은 자리의 -z 쪽이다(의자를 그리로 물려 뒀다). 한 번은 3/4 로 틀어 봤다.
   근무 중인 고양이가 전부 등을 보이니 얼굴이 안 보인다는 이유였는데, 그러면
   **아무도 모니터를 안 보는 사무실**이 된다. 일하는 그림이 아니라 딴짓하는 그림이 되고,
   이 게임에서 근무는 농담의 근거라서 그게 더 손해다.
   얼굴은 직원 목록의 초상과 고양이 카드에서 본다 — 거기서는 늘 정면이다. */
const SEAT_YAW = Math.PI;

/* 자리에서 칸 안 어디에 서는가.
   손그림 판은 종잇장이라 의자 **앞으로** 밀어야 했다 — 등받이에 가리면 통째로 사라진다.
   조형은 의자에 **제대로 올라앉는다.** 좌판을 실제로 재서 값을 정했다:
   lowpoly.chair 의 좌판은 칸 기준 z +0.09~+0.51, 등받이는 +0.45~+0.53(카메라 쪽), 높이 0.88.
   0.56 은 좌판 앞 모서리 바깥이라 의자에 걸터앉은 게 아니라 허공에 뜬 그림이 됐다 —
   처음에 어색했던 게 이거다. 좌판 한가운데(0.28)로 옮기니 앉기는 하는데
   **꼬리 뿌리가 등받이 판 안에 들어갔다.** 그래서 0.20 — 등받이 앞면(+0.45)에서
   꼬리 굵기만큼 떨어지는 자리다. 머리가 책상 쪽으로 조금 나가지만 그건 오히려
   모니터로 몸을 기울인 그림이 된다. */
const SEAT_Z = { doodle: 0.62, sculpt: 0.20 };

/* **깎은 조형으로 고정.** 설정의 "고양이 그림체" 스위치를 뺐으므로 저장값도 안 읽는다.
   손그림 판(doodle)은 지우지 않았다 — ?cat=doodle 로 부를 수 있고, 채용창의
   그림 고르기(ui.js lookSection)가 그 경로를 아직 쓴다. */
let catLook = 'sculpt';
if (/[?&]cat=doodle/.test(location.search)) catLook = 'doodle';

/* 그 고양이의 털색 한 값. 화면 쪽이 **같은 색으로 무언가를 더 그릴 때** 쓴다 —
   택배 뜯는 장면의 앞발이 그렇다(js/gacha.js). 초상만 주면 앞발이 남의 색이 된다. */
export function catFur(c){ return c ? furOf(c) : null; }

/* 무늬(획 목록) — 저장에 있는 그대로 넘긴다. 없으면 빈 목록이고, 그건 「안 그린 고양이」다.
   기본값을 여기서 지어내지 않는다: 안 그린 것과 흰 획 하나는 다른 고양이다. */
const marksOf = c => (c && Array.isArray(c.marks)) ? c.marks : null;
/* 고정 표정 { e, m }. 없으면 「눈은 상태를 따르고 입은 기본」이라 지금까지와 같다. */
const faceOf = c => FP.normFaceObj(c && c.face);

export function getCatLook(){ return catLook; }
export function setCatLook(v){
  catLook = v === 'doodle' ? 'doodle' : 'sculpt';
  try { localStorage.setItem('copycat.catlook', catLook); } catch(e){}
  /* 배우를 통째로 버린다. 다음 sync 가 새 그림체로 다시 만든다 —
     둘의 계약이 같아서 그 자리에서 바꿔 끼울 필요가 없다. */
  actors.forEach(a => scene.remove(a.root));
  actors.clear();
  if (catLook === 'sculpt') CS.warm();
}

/* 털색 — **이름과 색이 맞아야 한다.**
   손그림 시절에는 그림 파일이 곧 그 고양이라 fur/hue 가 아무 일도 안 했고, 그래서 여기가
   색표를 대충 섞어 쓰고 있었다. 채용창에서 [검정]을 눌렀는데 흰 고양이가 나오면 그건 고장이다.
   조형으로 오면서 색이 uniform 하나가 됐으므로, cats.js 의 네 이름을 그대로 색으로 옮긴다. */
const FUR_BASE = [
  0x4A4550,   // 검정 — 순검정은 형태가 아니라 구멍이 된다
  0x9A6B4A,   // 갈색
  0xE8A657,   // 치즈
  0xF0E9DE,   // 백묘
];
/* 색조는 cats.js 의 HUE_CHOICES(도 단위)를 그대로 받는다. HSL 로 돌리고 캐시한다 —
   sync 가 매 프레임 마리마다 부르는 자리라 Color 를 새로 만들면 안 된다. */
/* 색조 여섯 칸의 **도착점**을 직접 적는다.
   각도를 그대로 돌리면 두 군데서 어긋난다: 18·30도는 주황에서 출발해 올리브로 넘어가고
   (노란끼가 이끼색이 된다), 190도는 채도가 높은 치즈에서 형광 파랑이 된다.
   [목표 색상, 채도 가산, 채도 상한] — 이름이 말하는 색에 실제로 도착하는 값이다. */
const HUE_TINT = {
   18: [0.098, 0.05, 0.44,  0.02],  // 노란끼 — 살짝 따뜻하게만
  '-18':[0.035, 0.08, 0.50,  0.02],  // 붉은끼
   30: [0.115, 0.18, 0.56,  0.08],   // 금빛 — 밝기까지 올려야 노란끼와 갈린다
  '-28':[0.012, 0.12, 0.50, -0.04],  // 적갈 — 어두워야 적'갈'이다
  190: [0.575, 0.06, 0.26,  0.02],   // 회청 — 러시안블루. 채도를 눌러야 "회"청이 된다
};
const _furCache = new Map();
const _furTmp = new THREE.Color();
const _hsl = {};
/* 냥찰청은 늘 같은 두 마리가 온다(sim.js 의 POLICE). 그런데 여기서 경찰이면 무조건
   한 색으로 칠하고 있어서 **도 경찰과 김 경찰이 구분이 안 됐다** — 얼굴이 고정되어야
   "또 왔네"가 되는데 같은 얼굴 둘이 오면 그냥 경찰 두 마리다. fur 로 갈라 준다. */
/* 도 경찰만 제복 남색으로 못 박는다. 김 경찰은 sim.js 의 POLICE 표가 정한 fur/hue 를
   보통 고양이와 같은 규칙으로 통과시킨다(치즈 · 노란끼) — 색을 두 군데서 정하지 않는다. */
const POLICE_FUR = { 0: 0x6E7BA8 };
function furOf(c){
  if (c.npc === 'police' && POLICE_FUR[c.fur | 0] !== undefined) return POLICE_FUR[c.fur | 0];
  if (c.npc === 'legal')  return 0x8A8580;
  if (c.npc === 'rival')  return 0xB98A5E;
  const fi = (((c.fur | 0) % FUR_BASE.length) + FUR_BASE.length) % FUR_BASE.length;
  const h = c.hue | 0;
  const key = fi * 1000 + h;
  const hit = _furCache.get(key);
  if (hit !== undefined) return hit;
  const base = FUR_BASE[fi];
  let out = base;
  if (h){
    _furTmp.setHex(base).getHSL(_hsl);
    const t = HUE_TINT[h];
    if (t){
      _furTmp.setHSL(t[0], Math.max(0.06, Math.min(t[2], _hsl.s + t[1])),
                     Math.max(0.12, Math.min(0.92, _hsl.l + (t[3] || 0))));
    } else {
      _furTmp.setHSL(((0.083 + h / 360) % 1 + 1) % 1,
                     Math.min(0.50, _hsl.s + 0.12), _hsl.l);
    }
    out = _furTmp.getHex();
  }
  _furCache.set(key, out);
  return out;
}
/* 경찰냥은 제복이 기본이다. 시뮬은 NPC 에게 장비를 주지 않으므로 렌더러가 입힌다 —
   잡으러 오는 쪽이 한눈에 갈려야 이 게임의 농담이 선다. */
const POLICE_EQUIP = { head:'police', neck:'tie' };
/* 착용은 **NPC 만** 한다. 직원의 장비 체계는 없앴다(js/cats.js 머리말) —
   냥찰의 모자는 능력치가 아니라 「누구인지」를 말하는 그림이라 남는다. */
const equipOf = c => c.npc === 'police' ? POLICE_EQUIP : (c.npc ? (c.equip || null) : null);

const stateOf = c => {
  const s = c.act && c.act.s;
  if (s === 'walk') return 'walk';
  if (s === 'sleep') return 'sleep';
  if (s === 'work' || s === 'stamp') return 'sit';
  return 'idle';
};

export function sync(list, docList, dt){
  if (!ready || !statics) return;
  /* 택배 컷신 동안에는 배우를 안 건드린다. 시뮬은 계속 돌고 있어서 그대로 두면
     자리에 앉혀 둔 고양이를 다음 틱에 다시 복도로 걸어가게 만든다 — 카메라가
     클로즈업인 그 2~3초 동안 주인공이 프레임 밖으로 나간다. */
  if (PC) return;
  const seen = new Set();
  let mate = null;                     // 짝을 향해 돌 때 쓰는 자리 (아래 방향 규칙)
  for (const c of list){
    seen.add(c.id);
    let a = actors.get(c.id);
    /* 그림이 바뀌었으면 판을 다시 만든다. 처음에는 만들 때만 그림을 읽었는데,
       그러면 **근로계약서에서 고른 그림이 화면에 안 온다** — 1번 사원의 배우는
       계약서를 쓰기 전에 이미 만들어져 있어서 첫 그림으로 굳어 있었다.
       (채용은 새 id 라서 이 문제가 없었고, 그래서 계약서에서만 티가 났다.) */
    if (a && (a.look !== catLook || (a.look === 'doodle' && a.drawn !== drawIdx(c)))){
      scene.remove(a.root);
      actors.delete(c.id);
      a = null;
    }
    if (!a){
      if (catLook === 'sculpt'){
        a = CS.sculptActor({ fur: furOf(c), marks: marksOf(c), face: faceOf(c) });
        a.fur = furOf(c);
        a.marks = CS.markKey(marksOf(c));
        a.face = FP.faceKey(c && c.face);
        a.setTint(catTint);
      } else {
        a = cutoutFrom(drawOf(c), { h: 0.72 });
        a.drawn = drawIdx(c);
        a.plane.material.color.setHex(catTint);
      }
      a.look = catLook;
      scene.add(a.root);
      actors.set(c.id, a);
    }
    /* 털색은 계약서·채용에서 바뀐다. 조형은 색이 uniform 이라 갈아 끼울 필요가 없다. */
    if (a.look === 'sculpt' && a.fur !== furOf(c)){ a.fur = furOf(c); a.setFur(a.fur); }
    /* 무늬도 창에서 언제든 바뀐다(면접창·인사 파일). 털색과 같은 방식으로 걸러 낸다 —
       열쇠가 같으면 uniform 을 다시 안 쓴다. */
    if (a.look === 'sculpt' && a.setMarks){
      const mk = CS.markKey(marksOf(c));
      if (a.marks !== mk){ a.marks = mk; a.setMarks(marksOf(c)); }
    }
    /* 표정도 창에서 바뀐다. 상태 연동으로 되돌리는 것(0)까지 같은 길로 온다. */
    if (a.look === 'sculpt' && a.setFace){
      const fk = FP.faceKey(c && c.face);
      if (a.face !== fk){ a.face = fk; a.setFace(faceOf(c)); }
    }
    /* 장비 — 끼고 빼는 건 UI 에서 언제든 일어난다. setGear 가 열쇠로 걸러 낸다 */
    if (a.setGear) a.setGear(equipOf(c));
    /* 시뮬은 격자 좌표로 움직인다. 칸 중앙에 세우고, 진행 방향으로 돌린다.
       자리에 앉아 근무 중이면 의자 위로 올린다 — 바닥에 두면 등받이에 가려 안 보인다.
       2D 에는 없던 축이라 시뮬이 안 알려주는 정보고, 렌더러가 격자에서 유도한다. */
    const st = stateOf(c);
    const cell = c.y * W + c.x;
    const seated = st === 'sit' && seatCells.has(cell);

    /* 가구를 쓰는 중이면 **가구 위에** 그린다.
       시뮬에서 고양이는 가구 칸에 못 들어간다(WALKABLE 은 바닥·문뿐). 그래서 캣타워를
       사도 해먹을 사도 고양이는 늘 그 옆 바닥에 서 있었고, 산 사람 눈에는 아무도 안 쓰는
       가구였다. 격자를 바꾸면 길찾기가 통째로 흔들리므로, 시뮬은 옆 칸에 두고
       **보여주는 것만** 올린다 — 위치는 렌더러가 알아도 되는 정보다. */
    const use = c.act && c.act.use;
    const upon = use ? perchCells.get(use.y * W + use.x) : undefined;
    const perch = upon !== undefined ? upon : (perchCells.get(cell) || 0);
    const on = upon !== undefined && (st === 'sleep' || st === 'sit' || st === 'idle');
    const nx = (on ? use.x : c.x) + 0.5;
    const nz = (on ? use.y : c.y) + (seated && !on ? SEAT_Z[catLook] : 0.5);
    const ny = on ? perch : seated ? SEAT_Y : perch;
    const dx = nx - a.root.position.x, dz = nz - a.root.position.z;
    a.baseY = ny;                       // 종잇장은 update 가 y 를 만지므로 값으로 넘긴다
    a.onFurn = on;                      // 가구 **위에** 올라가 있나 (아래 방향 규칙과 검사가 읽는다)
    a.root.position.set(nx, ny, nz);
    /* 걸음은 시계가 아니라 **간 거리**로 돌린다. 그래야 빠른 고양이도 느린 고양이도
       발이 안 미끄러진다 — 어차피 얼마나 옮겼는지는 여기서만 알 수 있는 값이다.
       (손그림 판에는 setStep 이 없다. 그쪽은 2D 프레임이 알아서 돈다.) */
    if (a.setStep) a.setStep(Math.hypot(dx, dz));

    /* 손그림 판은 빌보드라 늘 카메라를 보지만, 조형은 진짜 3D 라서 제 방향을 봐야 한다.
       규칙 셋, 순서가 곧 우선순위다:

         앉아 있으면   책상 쪽(-z)
         걷는 중이면   가는 쪽
         **짝이 있으면 짝 쪽**
         **가구를 쓰는 중이면 그 가구 쪽**

       셋째가 없던 동안 고양이는 **도착할 때 걸어온 방향 그대로 굳었다.** 정수기를
       옆으로 지나쳐 도착하면 정수기에 등을 대고 서 있고, 그 위에 「물 마시는 중」
       말풍선이 뜬다(36번). 무엇을 하는지 말은 하는데 그림이 그걸 부정하고 있었다.

       걷는 동안에는 목적지가 아니라 **가는 쪽**을 봐야 한다 — 목적지를 보면
       길이 꺾일 때마다 게걸음이 된다. 그래서 걷는 중은 셋째보다 앞에 둔다.
       가구 **위에** 올라간 경우(캣타워·해먹)는 뺀다: 밟고 선 물건을 내려다보는
       고양이가 되고, 그건 방향이 아니라 고장으로 보인다.

       넷째(짝)가 가구보다 앞이다. 같은 소파에 둘이 앉으면 셋째 규칙으로는 둘 다
       소파를 보는데, 그러면 나란히 서서 각자 앞을 보는 그림이다 — 말풍선이 오가도
       둘이 같이 있는 걸로 안 읽힌다. 짝은 시뮬이 매 틱 다시 세므로(sim.js pairUp)
       한쪽이 일어서는 순간 이 규칙은 저절로 꺼지고 가구 쪽으로 돌아간다. */
    if (a.setHeading){
      if (seated || st === 'sit') a.setHeading(SEAT_YAW);
      else if (st === 'walk' && dx * dx + dz * dz > 1e-6) a.setHeading(Math.atan2(dx, dz));
      else if (c._with && !on && (mate = list.find(o => o.id === c._with))){
        const fx = mate.x + 0.5 - nx, fz = mate.y + 0.5 - nz;
        if (fx * fx + fz * fz > 1e-6) a.setHeading(Math.atan2(fx, fz));
      }
      else if (use && !on){
        const fx = use.x + 0.5 - nx, fz = use.y + 0.5 - nz;
        if (fx * fx + fz * fz > 1e-6) a.setHeading(Math.atan2(fx, fz));
      }
      else if (dx * dx + dz * dz > 1e-6) a.setHeading(Math.atan2(dx, dz));
    }
    a.setState(st);
    a.seatDbg = seated ? 'seat' : st;          // debug() 가 읽는다
    a.update(dt, camera);
  }
  actors.forEach((a, id) => {
    if (seen.has(id)) return;
    scene.remove(a.root);
    actors.delete(id);
  });

  const dseen = new Set();
  for (const d of docList){
    dseen.add(d.id);
    let o = docs.get(d.id);
    if (!o){ o = LP.docStack(2); scene.add(o); docs.set(d.id, o); }
    o.position.set(d.x + 0.5, d.state === 'carry' ? 0.42 : 0, d.y + 0.5);
  }
  docs.forEach((o, id) => { if (!dseen.has(id)){ scene.remove(o); docs.delete(id); } });

  syncTags(list);

  /* ---------- 카메라 추적 ---------- */
  if (FOLLOW.on && list.length){
    FOLLOW.t += dt;
    if (FOLLOW.t >= FOLLOW.every){ FOLLOW.t = 0; FOLLOW.i = (FOLLOW.i + 1) % list.length; }
    const c = list[Math.min(FOLLOW.i, list.length - 1)];
    const a = actors.get(c.id);
    wantLook.set(c.x + 0.5, (a ? a.root.position.y : 0) + 0.5, c.y + 0.5);
    if (CAM.zoom !== FOLLOW.zoom){ CAM.zoom = FOLLOW.zoom; fit(); }
  } else {
    wantLook.set(W / 2, 0.5, D / 2);
    if (!FOLLOW.on) wantLook.copy(look);      // 손댄 자리는 그대로 둔다
  }
  /* 부드럽게. 순간이동하면 옆에 띄워 둔 창에서 시선을 뺏는다. */
  look.lerp(wantLook, Math.min(1, dt * 1.8));
}

/* ---------- 이름표 ----------
   도트판에는 액터 DOM 에 붙어 있었다. 3D 에는 액터 DOM 이 없으니 투영해서 얹는다.
   글자는 계속 DOM 이어야 한다 — 3D 안에 넣으면 글꼴도 i18n 도 잃는다.

   ── 왜 다시 만들었나 ──

   처음엔 흰 알약에 테두리를 두른 칩이었다. 도트판에서 옮겨 온 모양인데,
   3D 사무실에 얹으니 **스무 개가 공중에 떠서 화면을 덮었다.** 파스텔로 맞춰 둔 방을
   글자 상자가 통째로 가린다. 이름은 보조 정보인데 제일 눈에 띄는 것이 되어 있었다.

   그래서 칩을 버린다. 이름은 **고양이 발밑 바닥에 적힌 글자**가 된다 —
   상자도 테두리도 없고, 사무실 잉크색으로 흐리게, 자간만 넓혀서.
   대신 일이 생긴 고양이 하나만 진해진다: **카메라가 지금 따라다니는 고양이.**
   그러면 스무 개가 동시에 떠드는 대신 한 마리만 이름을 말한다. */
let tagBox = null;
const tagEls = new Map();
/* 이름표가 뜨는 높이 — 고양이 키(0.74) 위. 정수리에 딱 붙이면 귀에 걸린다. */
const TAG_UP = 0.92;
function syncTags(list){
  if (!canvas) return;
  if (!tagBox){
    tagBox = document.createElement('div');
    tagBox.id = 'tags3d';
    tagBox.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20';
    canvas.parentElement.appendChild(tagBox);
  }
  const box = canvas.parentElement;
  const bw = box.clientWidth, bh = box.clientHeight;
  const seen = new Set();
  for (const c of list){
    seen.add(c.id);
    let el = tagEls.get(c.id);
    if (!el){
      el = document.createElement('div');
      el.className = 'tag3d';
      el.dataset.cat = c.id;          // 어느 고양이 것인지 — 화면을 밖에서 검사할 때 쓴다
      el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);white-space:nowrap;'
        + 'font:10px/1 inherit;letter-spacing:.10em;font-weight:700;color:#FFFFFF;'
        /* 흰 글씨는 밝은 바닥 위에서 그대로 사라진다. 상자를 두르는 대신 **어두운 그림자**로
           읽히게 한다 — 알약이 스무 개 떠 있는 화면으로 돌아가지 않으면서 흰색을 쓰는 방법이
           이것뿐이다. 네 방향으로 얇게, 아래로 한 번 더 진하게. */
        + 'text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 4px rgba(0,0,0,.6),'
        + '1px 0 2px rgba(0,0,0,.5),-1px 0 2px rgba(0,0,0,.5);'
        + 'transition:opacity .5s,font-size .3s;will-change:transform';
      tagBox.appendChild(el);
      tagEls.set(c.id, el);
    }
    if (el.textContent !== c.name) el.textContent = c.name;
    const a = actors.get(c.id);
    /* **머리 위.** 한동안 발밑에 뒀었다 — 위에 띄우면 가구와 겹쳐 떠다닌다는 이유였는데,
       발밑 글자는 그 고양이의 것인지 옆 고양이의 것인지가 헷갈린다(둘이 붙어 서면 특히).
       이름은 가리키는 대상이 분명해야 이름이다. 겹침은 흰 글씨 + 어두운 그림자로 푼다. */
    const ax = a ? a.root.position.x : c.x + 0.5;
    const az = a ? a.root.position.z : c.y + 0.5;
    const ay = (a ? a.baseY : 0) + TAG_UP;
    tmp.set(ax, ay, az).project(camera);
    const on = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
    el.style.display = on ? '' : 'none';
    if (!on) continue;
    el.style.transform =
      `translate(-50%,-100%) translate(${((tmp.x + 1) / 2 * bw).toFixed(1)}px,${((1 - tmp.y) / 2 * bh - 2).toFixed(1)}px)`;
    /* 지금 카메라가 보고 있는 고양이만 또렷하다. 나머지는 있는 줄만 알면 된다. */
    const lead = FOLLOW.on && list[Math.min(FOLLOW.i, list.length - 1)] === c;
    /* 흰 글씨는 잉크색보다 눈에 잘 띈다 — 0.30 으로 두면 나머지가 아예 안 읽힌다.
       그렇다고 전부 또렷하면 스무 마리가 동시에 떠든다. 사이를 좁혀서 둘 다 산다. */
    el.style.opacity = lead ? '1' : '0.62';
    el.style.fontSize = lead ? '11.5px' : '10px';
  }
  tagEls.forEach((el, id) => { if (!seen.has(id)){ el.remove(); tagEls.delete(id); } });
}

/* 귀 한 번 튕기기 — 밖에서 부르는 문 (TODO 39).
   주기가 아니라 **사건**이라 시뮬 쪽에서 「무슨 일이 났다」고 알려 줘야 한다.
   말풍선이 뜰 때(ui.js sayAt)와 가구에 도착할 때(sim.js 의 cat:use)가 그 자리다. */
export function flick(id){
  const a = actors.get(id);
  if (a && a.flick) a.flick();
}
/* 지금 이 고양이가 어떤 장면을 밟고 있는가 — 검사가 읽는다.
   「움직였다고 코드가 말하는 것」과 「화면이 달라지는 것」은 다른 일이라(TODO 39)
   둘 다 재야 하는데, 앞쪽은 이 문 없이는 잴 방법이 없다.
   꼬리 폭까지 같이 돌려준다: 지오메트리의 x 범위가 곧 꼬리가 흘러나간 폭이다. */
export function catShape(id){
  const a = actors.get(id);
  if (!a || !a.mesh) return null;
  const g = a.mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const s = a.mesh.scale.x || 1;
  return { key: a.shape ? a.shape() : null, heading: +a.root.rotation.y.toFixed(3),
           onFurn: !!a.onFurn,
           minX: +(g.boundingBox.min.x * s).toFixed(4),
           maxX: +(g.boundingBox.max.x * s).toFixed(4),
           maxY: +(g.boundingBox.max.y * s).toFixed(4) };
}
/* 시뮬의 버스는 클래식 스크립트의 전역이다 — 모듈은 항상 늦게 도므로 여기서 걸어도
   늦지 않는다. 없으면 조용히 지나간다(모듈만 따로 띄우는 스파이크가 있다). */
try {
  if (typeof bus !== 'undefined' && bus && bus.on)
    bus.on('cat:use', e => { if (e && e.cat) flick(e.cat.id); });
} catch(e){}

export function clearTags(){ tagEls.forEach(e => e.remove()); tagEls.clear(); }

/* ---------- 시간대 ---------- */
/* 색 두 개를 섞는다. 시간대 표가 네 칸이라 계단으로 갈아타면 노을이 시작되는
   순간 방 전체 색이 한 프레임에 튀는데, 켜 두고 곁눈질하는 화면에서 그건 사고로 읽힌다. */
const mix1 = (a, b, t) => a + (b - a) * t;
function mixHex(a, b, t){
  if (t <= 0) return a;
  if (t >= 1) return b;
  return (Math.round(mix1((a >> 16) & 255, (b >> 16) & 255, t)) << 16)
       | (Math.round(mix1((a >> 8) & 255, (b >> 8) & 255, t)) << 8)
       |  Math.round(mix1(a & 255, b & 255, t));
}
/* 시간대 표 두 칸을 섞어 **한 칸처럼** 만든다. 필드를 하나하나 적는 이유:
   값이 색(hex)·수·배열이 섞여 있어서 일반적인 순회로는 색을 수처럼 섞게 된다. */
function mixTime(A, B, t){
  if (t <= 0 || A === B) return A;
  if (t >= 1) return B;
  const H = (k, d) => mixHex(A[k] ?? d, B[k] ?? d, t);
  const N = (k, d) => mix1(A[k] ?? d, B[k] ?? d, t);
  const pair = (k, d) => {
    const a = A[k] || d, b = B[k] || d;
    return [mixHex(a[0], b[0], t), mix1(a[1], b[1], t)];
  };
  const nums = (k, d) => {
    const a = A[k] || d, b = B[k] || d;
    return a.map((v, i) => mix1(v, b[i], t));
  };
  const sa = A.sun, sb = B.sun;
  return {
    tint: H('tint', 0xFFFFFF),
    bg: H('bg', 0x000000),
    hemi: [mixHex(A.hemi[0], B.hemi[0], t), mixHex(A.hemi[1], B.hemi[1], t), mix1(A.hemi[2], B.hemi[2], t)],
    sun: [mixHex(sa[0], sb[0], t), mix1(sa[1], sb[1], t),
          sa[2].map((v, i) => mix1(v, sb[2][i], t))],
    fill: pair('fill', [0xFFFFFF, 0]),
    lamp: N('lamp', 0),
    lampR: N('lampR', 0),
    lampColor: H('lampColor', 0xFFFFFF),
    pane: pair('pane', [0xFFFFFF, 0.4]),
    screen: H('screen', 0xFFFFFF),
    glow: N('glow', 0.4),
    fog: nums('fog', [0.5, 1.5]),
    /* 그레이드도 섞는다. 이걸 빼면 시간대는 부드럽게 건너가는데 **필름만 툭 바뀐다** —
       채도가 0.52 에서 0.92 로 한 프레임에 뛰면 그건 전환이 아니라 사고다.
       색(hex)이 아니라 0~1 짜리 수와 벡터라서 위의 H/N 과 따로 다뤄야 한다. */
    grade: mixGrade(A.grade, B.grade, t),
  };
}

/* 필름 룩 한 벌을 섞는다. 한쪽에 없으면 기본값과 섞는다 —
   tone.js 실험판처럼 grade 를 안 가진 표가 섞여 들어와도 튀지 않는다. */
function mixGrade(a, b, t){
  const G0 = EERIE.GRADE0;
  const A = { ...G0, ...(a || {}) }, B = { ...G0, ...(b || {}) };
  if (t <= 0) return A;
  if (t >= 1) return B;
  const n = k => mix1(A[k], B[k], t);
  const v = k => A[k].map((x, i) => mix1(x, B[k][i], t));
  return { exp:n('exp'), sat:n('sat'), con:n('con'), vig:n('vig'), grain:n('grain'),
           lift:v('lift'), gain:v('gain'),
           /* 색 입히기도 섞는다. 여기를 빼면 하루 내내 색만 툭툭 갈린다 —
              하필 제일 눈에 띄는 값이라 그 한 칸이 전환을 통째로 망친다. */
           tint:v('tint'), tintAmt:n('tintAmt'), floor:v('floor') };
}

/* 지금 칠해 둔 시간대. 이 함수는 **매 프레임** 불린다(main.js frame → renderNight) —
   안 바뀌었으면 그냥 돌아간다. 그래야 보간을 켜도 머티리얼 캐시가 터지지 않는다.
   t 를 48 단계로 묶는 이유가 그것이다: 표는 부드럽게 지나가되 캐시 키는 48 종이다.
   (노을이 2.2시간짜리라 한 단계가 약 3분이고, 그 사이 색차는 눈에 안 띈다) */
let lastSky = '';

/* ---------- 천장등 ----------
   시간대(p)와 사람이 누른 스위치(ceilOn)를 곱해서 최종 세기를 낸다.
   시간대만 보면 스위치가 무의미하고, 스위치만 보면 대낮에도 형광등이 최대로 켜진다.

   **낮에도 0 이 아니다**(0.35). 사무실 형광등은 해가 떠 있어도 켜져 있고, 무엇보다
   0 으로 두면 「껐다」와 「낮이다」가 구별이 안 돼서 스위치가 고장 난 것으로 읽힌다. */
/* **밤에 세게 켜면 「딥 블루 나이트」가 안 나온다.** 앞판은 [0.35, 1.15] 였고,
   밤에 방 한가운데서 4.8 짜리 따뜻한 광원이 바닥을 통째로 데워서 남색이 설 자리가
   없었다. 천장등은 「통로가 안 보이는 것」을 막는 물건이지 방을 데우는 물건이 아니다 —
   최소는 그대로 두고 **최대만 눌렀다**(1.15 → 0.62). 통로 밝기는 verify-lamp.js 가 본다. */
const CEIL_BY_LAMP = [0.35, 0.36];      // [최소, 최대] — p.lamp 로 그 사이를 오간다
/* 세기 배율. 4.2 → 4.5 는 **밝기를 올린 게 아니라 색을 데운 값을 되돌린 것**이다
   (lampColor 가 주황 쪽으로 가면서 휘도가 7% 빠졌다). 밤에 방을 데우면 안 된다는
   위 문단의 판단은 그대로다 — 눈에 보이는 밝기는 앞판과 같다. */
const CEIL_K = 4.7;

function applyCeiling(p){
  if (!ceilLights.length) return;
  const t = Math.min(1, Math.max(0, p.lamp || 0));
  const k = CEIL_BY_LAMP[0] + (CEIL_BY_LAMP[1] - CEIL_BY_LAMP[0]) * t;
  ceilLights.forEach(l => {
    l.intensity = ceilOn ? k * CEIL_K : 0;
    if (p.lampColor) l.color.setHex(p.lampColor);
  });
  /* 갓의 밑판·천을 빛나게 하고 빛 원뿔의 세기를 맞추던 절이 여기 있었다.
     기구를 안 그리기로 한 2026-08-25 에 같이 빠졌다 — 켜졌는지는 이제
     **벽 스위치**가 말한다(setCeiling 아래). 빛의 세기는 위 두 줄이 전부다. */
}

/* 스위치 하나가 두 가지를 해야 한다: 불을 끄고, **꺼진 것이 벽에서 보이게** 하기.
   손잡이가 내려가고 표시등이 죽는다. 이게 없으면 어두운 방에서 스위치를 찾아
   눌렀는데 아무 일도 안 난 것처럼 보인다(이미 꺼져 있었을 때). */
export function setCeiling(on){
  ceilOn = !!on;
  if (ceilSwitch){
    const PAL = EERIE.ON ? EERIE.PALETTE : PASTEL;
    const { rock, led } = ceilSwitch.userData;
    if (rock) rock.position.y = ceilOn ? 0.055 : -0.055;
    /* 꺼졌을 때 빛난다(lowpoly.lightSwitch 참고). 그냥 색만 바꾸면 어두운 방에서
       안 보이므로 발광 재질을 쓴다 — 이게 불 끈 사무실에서 스위치를 찾는 표시다. */
    if (led) led.material = ceilOn ? LP.mat(PAL.metalDark) : LP.matGlow(PAL.glow, 0.85);
  }
  lastSky = '';                     // 시간대 캐시를 깨야 applyCeiling 이 다시 돈다
  return ceilOn;
}
export const ceiling = () => ceilOn;
/* 스위치가 방 어디에 붙었는지 — 자리를 절차적으로 고르므로 밖에서는 알 수 없다.

   **화면 좌표를 여기서 같이 낸다.** project() 로 옮기면 안 된다 — 그쪽은 **격자** 좌표를
   받아 칸 중앙(+0.5)으로 옮기는 함수라 월드 좌표를 넣으면 반 칸 어긋나고, 게다가
   뷰포트 상자 기준 좌표를 돌려준다. pickSwitch 는 창 기준 좌표(clientX/Y)를 받는다.
   두 공간이 다르다는 걸 검사 스크립트가 40px 어긋난 클릭으로 알려 줬다.
   여기서 내주는 sx·sy 는 **pickSwitch 에 그대로 넣을 수 있는** 좌표다. */
export function switchAt(){
  if (!ceilSwitch || !canvas) return null;
  const p = ceilSwitch.position;
  tmp.set(p.x, p.y, p.z).project(camera);
  const r = canvas.getBoundingClientRect();
  return {
    x: p.x, y: p.y, z: p.z,
    onScreen: Math.abs(tmp.x) <= 1 && Math.abs(tmp.y) <= 1 && tmp.z < 1,
    sx: r.left + (tmp.x + 1) / 2 * r.width,
    sy: r.top + (1 - tmp.y) / 2 * r.height,
  };
}

/* 벽 스위치를 눌렀는가. 타일 집기(pickTile)로는 못 잡는다 — 스위치는 벽 **면**에
   붙어 있어서 그 광선이 벽 칸을 물고, 벽 칸은 아무 물건도 아니기 때문이다.
   그래서 고양이(pickCat)처럼 메시를 직접 맞춘다. */
export function pickSwitch(cx, cy){
  if (!ready || !ceilSwitch || !aim(cx, cy)) return false;
  return ray.intersectObject(ceilSwitch, true).length > 0;
}

export function night(a, b, t){
  if (!ready) return;
  const T = EERIE.ON ? EERIE.TIME : TIME;
  if (typeof b !== 'string'){ b = a; t = 0; }          // 옛 호출: 이름 하나
  t = Math.max(0, Math.min(1, t || 0));
  const q = Math.round(t * 48);
  const sig = a + '|' + b + '|' + q + '|' + (EERIE.ON ? 1 : 0);
  if (sig === lastSky) return;
  lastSky = sig;
  const p = mixTime(T[a] || T.day, T[b] || T.day, q / 48);
  renderer.setClearColor(p.bg, 1);
  EERIE.phase(p);
  hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]);
  hemi.intensity = p.hemi[2] * 0.80;
  sun.color.setHex(p.sun[0]); sun.intensity = p.sun[1] * 1.30;
  sun.position.set(W / 2 + p.sun[2][0], p.sun[2][1], D / 2 + p.sun[2][2]);
  sun.target.position.set(W / 2, 0, D / 2);
  sun.target.updateMatrixWorld();
  fill.color.setHex(p.fill[0]); fill.intensity = p.fill[1];
  /* **바닥값을 깐다**(lampK · LAMP_FLOOR). 표의 낮 칸이 0.34 라 여태 낮 화면에는
     책상 웅덩이가 사실상 없었다 — 그 이유와 판단은 LAMP_FLOOR 옆에 적어 뒀다. */
  const lk = lampK(p);
  lampLights.forEach(l => {
    /* 5.5 → 6.0 — 위 COZY_LIGHT 와 같은 보정이다. 시간대표의 lampColor 도 같이
       주황 쪽으로 옮겼으므로(eerie.TIME) 책상등도 그만큼 휘도를 잃었다. */
    l.intensity = lk * 6.3;
    if (p.lampColor) l.color.setHex(p.lampColor);
    /* 등불의 **반경**. 세기만 올리면 웅덩이가 안 생긴다 — 반경 5.5칸짜리 등이 여섯 개면
       방을 통째로 덮어서 「따뜻한 등불」이 아니라 「따뜻한 형광등」이 된다.
       three/tone.js 가 이 값을 준다. 안 주면 지금까지의 5.5 그대로. */
    if (p.lampR) l.distance = p.lampR;
  });

  /* 그림도 빛을 받아야 한다. 빌보드는 늘 카메라를 보므로 법선이 사실상 고정이고,
     그래서 광원을 아무리 바꿔도 그림만 혼자 대낮이다. 시간대 색을 재질에 직접 입힌다 —
     저녁엔 주황이 돌고 야근엔 푸르러진다. */
  catTint = p.tint ?? 0xFFFFFF;
  actors.forEach(a => {
    if (a.plane) a.plane.material.color.setHex(catTint);
    else if (a.setTint) a.setTint(catTint);
  });

  const PAL = EERIE.ON ? EERIE.PALETTE : PASTEL;
  const sc = p.screen ?? PAL.screen;
  const gk = p.glow ?? (p.lamp ? 0.85 : 0.10);
  screens.forEach(m => { m.material = LP.matGlow(sc, gk); });
  /* 스탠드 유리판. 세기와 짝을 맞춘다 — 광원은 켜져 있는데 판이 회색이면
     「불이 켜진 등」이 아니라 「빛이 새는 책상」이다. */
  glows.forEach(m => { m.material = LP.matGlow(PAL.glow, 0.9 * Math.min(1, lk)); });
  applyCeiling(p);
  /* ---------- 새 조명 기구 ----------
     **시간대를 거의 안 탄다**(COZY_BY_LAMP). 천장등·책상등이 표를 따라 오르내리는
     것과 다른 규칙이고, 그게 이 한 벌의 존재 이유다 — 아침에 방을 밝히는 것은
     해가 아니라 이 등들이어야 한다.

     색은 시간대를 따라간다(lampColor). 세기는 안 변하고 색만 변하면 「하루 종일
     같은 등이 켜져 있는데 저녁엔 조금 더 붉다」가 되고, 그건 실제 방의 모습이다. */
  {
    const t = Math.min(1, Math.max(0, p.lamp || 0));
    const ck = COZY_BY_LAMP[0] + (COZY_BY_LAMP[1] - COZY_BY_LAMP[0]) * t;
    /* 색은 안 건드린다 — COZY_HUE 옆에 적어 둔 이유다(전구는 시각에 따라 안 변한다). */
    cozyLights.forEach(l => { l.intensity = l.userData.cozy * ck; });
    /* 발광면. 세기를 1.35 곱해 올린다 — 그냥 lit 을 쓰면 「밝은 조각」이고, 이 정도는
       올라가야 「빛나는 알맹이」가 된다. 1.6 에서 자르는 건 그 위가 화면에서 흰 조각이
       되기 때문이다: 흰 조각은 전구가 아니라 구멍으로 보인다. */
    cozyGlows.forEach(m => { m.material = LP.matGlow(COZY_HUE, Math.min(1.6, m.userData.lit * ck * 1.35)); });
  }
  const pane = p.pane || [PAL.sky, 0.55];
  panes.forEach(m => { m.material = LP.matGlow(pane[0], pane[1]); });

}

/* 빛 자락. 벽에서 방 안쪽(+z)으로 뻗고 멀어질수록 넓게 퍼진다.

   **네 조각으로 갈라 놓는다** — 창은 가운데 세로살과 가로살이 있는 격자창이므로
   바닥에 떨어지는 빛도 십자로 갈라진다(lowpoly.windowUnit 의 살 두 개가 그것이다).
   이 한 가지가 "바닥이 좀 밝다" 를 "창에서 빛이 들어온다" 로 바꾼다.

   **끝으로 갈수록 정점 색이 검어진다.** 가산 합성이라 검정은 아무것도 더하지 않으므로
   알파를 쓰지 않고 사라진다 — 반투명 정렬 문제를 만들지 않는다. */

/* 자락 전부가 **머티리얼 하나**를 나눠 쓴다. night() 이 매 프레임 도는 함수라
   시간대마다 새 머티리얼을 만들면 셰이더가 계속 다시 컴파일된다 —
   색과 세기만 이 하나에 써 넣는다. */

/* ---------- 그림자 맵 크기 ----------
   **그림자 맵은 매 장 다시 굽는다.** 폰 화면 크기(824×1740)로 재 보면 한 장에
   8.8ms 가 드는데 그 중 4.5ms 가 이것이다 — 그림자를 아예 끄면 4.3ms 다.
   두 기기에서 「사무실 탭에 2분 두면 뜨겁다」로 돌아온 열의 절반이 여기 있었다
   (2026-09-21 제보).

   폰에서는 절반(1024)으로 굽는다 — 한 장이 6.7ms 가 되고(-24%), 화면이 작아서
   눈에 보이는 차이는 그림자 가장자리 한두 픽셀이다. 그리는 빈도까지 30장으로
   끊으면(js/main.js) 1초에 쓰는 시간이 529ms → 201ms 가 된다.

   **재는 법**: 두 크기를 번갈아 일곱 번 오가며 중앙값을 본다. 한 번씩만 재면
   기계가 데워지는 것과 섞여서 같은 설정을 두 번 재도 값이 달라진다(실제로 그랬다).
   절대값은 이 PC 의 GPU 것이라 폰과 다르지만, **비율은 기기를 안 탄다.**

   폰인지는 **배치가 안다**(js/col.js) — 창 폭 조건을 여기에 한 벌 더 적으면
   두 곳이 갈리고, 그때는 화면을 보고도 원인을 못 찾는다. */
const SHADOW_BIG = 2048, SHADOW_PHONE = 1024;
function shadowFit(){
  if (!sun) return;
  let want = SHADOW_BIG;
  try { if (typeof colMode === 'function' && colMode() === 'm4') want = SHADOW_PHONE; } catch(e){}
  if (sun.shadow.mapSize.width !== want) shadowPx(want);
}

/* ---------- 크기 · 그리기 ---------- */
export function fit(){
  if (!ready || !canvas) return;
  const box = canvas.parentElement;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  /* 화면을 맞추는 자리에서 그림자도 같이 맞춘다 — 가로세로를 돌리거나 창을 넓히면
     배치가 바뀌고(폰↔데스크톱), 그때 그림자만 옛 크기로 남으면 안 된다. */
  shadowFit();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  EERIE.resize(w, h);
  const aspect = w / h;
  const R = (Math.max(W, D) * 0.60 + CAM.pad) * CAM.zoom;
  const vh = 2 * Math.tan(camera.fov * Math.PI / 360);
  camera.aspect = aspect;
  camera.userData.dist = R / (Math.min(vh, vh * aspect) / 2);
  camera.updateProjectionMatrix();
}

/* 한 장과 다음 장 사이에 실제로 흐른 시간. 촛불과 필름 그레인이 이걸 쓴다 —
   둘 다 「몇 장째」가 아니라 「몇 초째」인 물건이라, 그리는 빈도가 바뀌어도
   같은 속도로 흔들려야 한다. */
let lastDrawMs = 0;
export function draw(){
  if (!ready || !statics) return;
  const nowMs = performance.now();
  const ddt = lastDrawMs ? Math.min(0.2, (nowMs - lastDrawMs) / 1000) : 1 / 60;
  lastDrawMs = nowMs;
  tickClocks();
  tickFlames(ddt);
  /* 아웃트로가 카메라를 잡고 있으면 궤도(CAM)를 안 쓴다 — 그 장면은 궤도가 아니라
     정해진 길을 지나간다(js/three/outro.js). 방·조명·후처리는 그대로다. */
  /* 택배 컷신도 같은 길을 쓴다 — 다만 이쪽은 방 **안**이라 조명도 천장도 그대로다. */
  if (PC){
    camera.position.set(PC.pos[0], PC.pos[1], PC.pos[2]);
    camera.lookAt(PC.look[0], PC.look[1], PC.look[2]);
    if (EERIE.ON) EERIE.render(ddt); else renderer.render(scene, camera);
    return;
  }
  if (OUT){
    camera.position.set(OUT.pos[0], OUT.pos[1], OUT.pos[2]);
    camera.lookAt(OUT.target[0], OUT.target[1], OUT.target[2]);
    if (EERIE.ON) EERIE.render(ddt); else renderer.render(scene, camera);
    return;
  }
  const d = camera.userData.dist || 20;
  camera.position.set(
    look.x + Math.cos(CAM.az) * Math.cos(CAM.el) * d,
    look.y + Math.sin(CAM.el) * d,
    look.z + Math.sin(CAM.az) * Math.cos(CAM.el) * d);
  camera.lookAt(look);
  if (EERIE.ON) EERIE.render(ddt);
  else renderer.render(scene, camera);
}

/* 월드 좌표가 화면 어디인지 — 말풍선·숫자는 계속 DOM 이다.
   3D 위에 DOM 을 얹는 건 그대로 되고, 그래야 글꼴과 i18n 이 살아 있다. */
export function project(x, y, up = 0.8){
  if (!ready || !canvas) return null;
  tmp.set(x + 0.5, up, y + 0.5).project(camera);
  if (tmp.z > 1) return null;
  const box = canvas.parentElement;
  return { x: (tmp.x + 1) / 2 * box.clientWidth, y: (1 - tmp.y) / 2 * box.clientHeight };
}

/* ---------- 집기 (raycast) ----------
   2D 에서는 고양이가 DOM 이라 클릭이 그냥 됐다. 3D 에서는 광선을 쏴야 한다.
   바닥은 평면 하나로 충분하고(격자가 y=0 에 깔려 있으므로), 고양이는 실제 메시를 맞춘다. */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPt = new THREE.Vector3();
const pickNrm = new THREE.Vector3(), nrmMat = new THREE.Matrix3();

function aim(cx, cy){
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return true;
}

export function pickTile(cx, cy){
  if (!ready || !statics || !aim(cx, cy)) return null;

  /* 벽에 걸린 것(액자·화이트보드)도 집을 수 있어야 한다.
     바닥 평면만 쏘면 벽을 클릭해도 그 뒤 바닥 칸이 잡혀서 벽 물건을 영영 못 고른다.

     그래서 실제 사무실 메시를 먼저 맞춰 보고, 맞은 지점이 허리 위(y>0.6)이면
     벽이나 키 큰 물건으로 본다. 그때는 조금 밀어 넣어야 벽 **면**이 아니라
     벽 **칸**이 나온다 — 면은 두 칸의 경계에 있기 때문이다.

     밀어 넣는 방향은 광선이 아니라 **맞은 면의 법선 반대쪽**이다. 광선을 따라 밀면
     비스듬히 볼 때 옆 칸으로 넘어간다(실측: 3번 칸을 눌렀는데 2번이 잡혔다).
     법선은 시점과 무관하게 늘 그 면을 가진 칸 안쪽을 가리킨다.
     윗면을 맞았을 때는 y 만 내려가므로 키 큰 가구도 자기 칸이 그대로 나온다. */
  const hits = ray.intersectObject(statics, true);
  if (hits.length){
    hitPt.copy(hits[0].point);
    if (hitPt.y > 0.6){
      if (hits[0].face){
        /* 면 법선은 그 물체의 좌표계 값이다 — 월드로 옮겨야 방향이 맞는다.
           (병합된 정적 메시는 단위 행렬이지만, 안 병합된 것도 섞여 있다) */
        pickNrm.copy(hits[0].face.normal)
               .applyNormalMatrix(nrmMat.getNormalMatrix(hits[0].object.matrixWorld)).normalize();
        hitPt.addScaledVector(pickNrm, -0.3);
      } else hitPt.addScaledVector(ray.ray.direction, 0.22);
    }
    /* 허리 아래를 맞았으면 **맞은 자리가 곧 그 물건의 칸**이다. 밀어 넣을 이유가 없다 —
       낮은 물건의 옆면은 두 칸의 경계가 아니라 그 칸 안이다.

       전에는 여기서 아래 바닥 평면으로 넘겼다. 그러면 광선이 그 물건을 **뚫고 지나가**
       뒤쪽 바닥을 물고, 결국 **한 칸 뒤가 잡힌다.** 키가 0.6 을 못 넘는 가구
       (CD 플레이어·털뭉치·낚싯대·간식 그릇)가 전부 "눌러도 아무 일도 안 나는" 상태였고,
       CD 플레이어를 넣고 나서야 드러났다 — 그전까지 그 가구들은 눌러야 할 일이 없었다. */
    const wx = Math.floor(hitPt.x), wy = Math.floor(hitPt.z);
    if (wx >= 0 && wy >= 0 && wx < W && wy < D) return { x:wx, y:wy };
  }

  if (!ray.ray.intersectPlane(GROUND, hitPt)) return null;
  const x = Math.floor(hitPt.x), y = Math.floor(hitPt.z);
  if (x < 0 || y < 0 || x >= W || y >= D) return null;
  return { x, y };
}

export function pickCat(cx, cy){
  if (!ready || !aim(cx, cy)) return null;
  const roots = [];
  actors.forEach((a, id) => { a.root.userData.catId = id; roots.push(a.root); });
  const hits = ray.intersectObjects(roots, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.catId) o = o.parent;
  return o ? o.userData.catId : null;
}

/* 배치 모드 표시판 — 바닥에 얹는 납작한 판.
   2D 는 DOM 사각형으로 그렸지만 3D 에서 화면 사각형은 격자와 안 맞는다(원근).
   씬 안에 그려야 옮기려는 칸과 실제로 겹친다. */
const MARK_COLOR = { sel:0x4C6EF5, pick:0x8A93A8, ok:0x5FBF7A, bad:0xE06A6A };
const marks = {};
export function marker(which, box, tone){
  if (!ready) return;
  let m = marks[which];
  if (!box){ if (m) m.visible = false; return; }
  if (!m){
    m = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.04, 1),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.5, depthWrite:false }));
    m.renderOrder = 5;
    scene.add(m);
    marks[which] = m;
  }
  m.visible = true;
  m.material.color.setHex(MARK_COLOR[tone] || MARK_COLOR.pick);
  m.material.opacity = which === 'sel' ? 0.32 : 0.5;
  m.scale.set(box.w, 1, box.h);
  m.position.set(box.x + box.w / 2, 0.03, box.y + box.h / 2);
}

/* ---------- 초상 ----------
   오른쪽 직원 목록의 그림이 도트인 채로 남으면 화면 안에서 두 그림체가 싸운다.
   같은 cat3 로 한 마리를 작은 캔버스에 한 번 렌더해서 PNG 로 굽고 캐시한다.
   털색마다 한 번씩만 굽히면 되므로 20마리여도 굽는 건 몇 장뿐이다. */
let pRend = null, pScene = null, pCam = null;
const pCache = new Map();

export function portrait(cat, size = 84, opt){
  /* 조형이면 같은 고양이를 작은 캔버스에 한 번 굽는다 — 털색 가짓수만큼만 굽힌다.
     손그림이면 그 그림 파일 그대로다. 구울 것도 캐시할 것도 없다.
     opt 는 안 주면 초상의 기본(감은 눈 · 3/4 컷)이다 — 로고만 뜬 눈·정면으로 굽는다. */
  if (catLook === 'sculpt'){
    /* 무늬는 **초상에도 나와야 한다** — 목록·사원증·로딩 화면의 얼굴이 사무실의
       고양이와 다르면 그건 딴 고양이다. 재질이 같으니 값 하나 더 넘기는 일이다. */
    const url = CS.sculptPortrait(furOf(cat), Math.max(64, Math.round(size)), equipOf(cat),
                                  { ...(opt || {}), marks: (opt && opt.marks) || marksOf(cat),
                                    face: (opt && opt.face != null) ? opt.face : faceOf(cat) });
    if (url) return url;
  }
  return drawOf(cat);
}

/* ---------- 무늬 작업대 (TODO 73) ----------
   화면 쪽(js/ui.js)이 부른다. 여기서 여는 이유는 조형이 이 모듈의 것이기 때문이다 —
   ui.js 는 모듈이 아니라 import 를 못 한다. 손그림 판에서는 열지 않는다:
   그림 파일이 곧 그 고양이라 얹을 자리가 없다. */
export function studio(opt){
  if (catLook !== 'sculpt') return null;
  return CS.sculptStudio(opt || {});
}
export function markPalette(){ return FP.MARK_INK.slice(); }
export function faceSets(){ return { eyes: FP.EYE_SET.slice(), mouths: FP.MOUTH_SET.slice() }; }
export function faceNorm(v){ return FP.normFaceObj(v); }
/* 이 획 목록이 몸의 몇 텍셀을 덮는가. 콘솔과 검사가 읽는 자다 —
   「지웠다」를 초상 그림으로 판정하면 무엇이 달라졌는지가 안 보인다. */
export function paintCoverage(list){
  const t = FP.paintFor(list);
  if (!t || !t.image || !t.image.data) return 0;
  const d = t.image.data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  return n;
}

/* ---------- 가구 초상 ----------
   목록에 **실제 물건**을 보여 준다. 그리기 표(furnTable)가 이미 칸마다 무엇을 세우는지
   들고 있으므로, 그 표의 물건 하나를 작은 장면에 세워 한 장 굽는다.

   ── 왜 렌더 타깃인가 ──
   화면에 쓰는 캔버스에 그리면 그 프레임이 망가진다(한 칸 동안 사무실 대신 의자가 뜬다).
   그래서 **WebGLRenderTarget** 에 그리고 픽셀을 읽어 온다 — 화면은 한 픽셀도 안 건드린다.
   컨텍스트도 하나 그대로다(예전에 지운 tonePortrait 는 렌더러를 따로 세워서 무거웠다).

   ── 배경은 비운다 ──
   clearAlpha 0 으로 구워서 물건만 남는다. 목록 칸의 색이 무엇이든 그 위에 얹힌다.
   상태를 바꿨으니 원래대로 되돌리는 것까지가 이 함수의 일이다.

   ── 아래에서 위로 읽는다 ──
   readRenderTargetPixels 는 OpenGL 순서(아래가 0)로 주고 캔버스는 위가 0이다.
   한 줄씩 뒤집어 넣는다 — 안 하면 가구가 거꾸로 선다.

   같은 물건을 두 번 굽지 않는다(furnShots). 물건 수가 20 남짓이라 캐시가 곧 전부다. */
const furnShots = new Map();
export function furnPortrait(tile, size = 96){
  if (!ready || !renderer || tile === undefined || tile === null) return null;
  const key = tile + '@' + size;
  if (furnShots.has(key)) return furnShots.get(key);
  furnShots.set(key, null);                       // 실패해도 다시 안 굽는다

  const F = furnTable(TILE)[tile];
  if (!F || !F.b || F.skip) return null;
  let obj = null;
  try { obj = F.b(); } catch(e){ return null; }
  if (!obj) return null;

  const sc = new THREE.Scene();
  /* 방의 빛을 그대로 쓰지 않는다 — 목록은 시간대와 무관하게 늘 같아야 한다.
     낮의 사무실쯤으로 고정한다. */
  sc.add(new THREE.HemisphereLight(0xFFF4E6, 0x8B7A66, 1.25));
  const key1 = new THREE.DirectionalLight(0xFFF0DC, 1.15);
  key1.position.set(2.2, 3.4, 2.6);
  sc.add(key1);
  const fill = new THREE.DirectionalLight(0xD8E2F2, 0.35);
  fill.position.set(-2.4, 1.4, -1.6);
  sc.add(fill);
  sc.add(obj);

  /* 물건이 프레임을 꽉 채우게 — 크기가 제각각(깃털 장난감과 로켓)이라 상자를 재서 맞춘다 */
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  const r = Math.max(sz.x, sz.y, sz.z, 0.4);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  cam.position.set(c.x + r * 1.35, c.y + r * 1.05, c.z + r * 1.75);
  cam.lookAt(c.x, c.y + r * 0.02, c.z);

  const rt = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
  });
  const prevRT = renderer.getRenderTarget();
  const prevAlpha = renderer.getClearAlpha();
  let url = null;
  try {
    renderer.setRenderTarget(rt);
    renderer.setClearAlpha(0);
    renderer.clear(true, true, true);
    renderer.render(sc, cam);
    const buf = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++)
      img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0);
    url = cv.toDataURL('image/png');
  } catch(e){ url = null; }
  renderer.setClearAlpha(prevAlpha);
  renderer.setRenderTarget(prevRT);
  rt.dispose();
  /* 장면에서 떼고 지운다 — 굽는 물건이 씬에 남으면 다음 물건과 겹친다 */
  sc.remove(obj);
  obj.traverse(o => { if (o.isMesh && o.geometry && o.geometry.dispose) o.geometry.dispose(); });

  furnShots.set(key, url);
  return url;
}

/* (여기에 가구 톤 카드를 3D 로 굽는 tonePortrait 가 있었다. 두 번 고쳐 봤지만
   따로 세운 작은 장면은 아무리 손봐도 「모형」이었고, 카드에서 보고 싶은 것은 벌이
   적용된 **이 게임의 사무실**이었다. 그래서 spike/shot-tones.js 가 실제 게임을 찍어
   assets/tones/<id>.jpg 로 내고 견본책이 그걸 그대로 쓴다 — 아홉 칸 대조 사진과
   같은 그림이다. 굽는 렌더러 하나와 WebGL 컨텍스트 하나가 같이 빠졌다.) */

/* 표시가 정말 씬에 있나 — **자리를 숫자로 답하는 문.**
   치수를 짐작으로 키우면서 「안 보인다」를 반복하고 있었다. 그건 안을 잰 게 아니라
   내 짐작을 잰 것이다. 씬을 직접 훑어서 표시 메시가 몇 개고 어디 있고 화면 어디에
   투영되는지 돌려준다. 안 보이는 이유가 「없다」인지 「작다」인지 「가려졌다」인지를
   이 셋으로 가른다. */
export function markInfo(){
  if (!statics) return { ready:false };
  const out = [];
  const v = new THREE.Vector3();
  statics.updateMatrixWorld(true);
  statics.traverse(o => {
    if (!o.isMesh || !o.userData || !o.userData.mark) return;
    o.getWorldPosition(v);
    const w = [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
    const p = project(v.x - 0.5, v.z - 0.5, v.y);
    /* 카메라 앞에 있나(뒤면 project 가 null) · 화면 안인가 */
    const box = canvas && canvas.parentElement;
    const on = !!(p && box && p.x >= 0 && p.y >= 0 && p.x <= box.clientWidth && p.y <= box.clientHeight);
    /* 안 보이는 이유를 가르는 값들 — 켜져 있나 · 조상이 켜져 있나 · 재질이 보이나 ·
       배율이 0 이 아닌가 · 씬에 아직 붙어 있나. 하나라도 걸리면 거기가 원인이다. */
    let anc = true, n = o.parent, root = false;
    while (n){ if (!n.visible) anc = false; if (n === scene) root = true; n = n.parent; }
    const sc = new THREE.Vector3(); o.getWorldScale(sc);
    const mt = Array.isArray(o.material) ? o.material[0] : o.material;
    out.push({ mark:o.userData.mark, w, s: p ? [Math.round(p.x), Math.round(p.y)] : null, 화면안: on,
               보임:o.visible, 조상보임:anc, 씬에붙음:root,
               배율:+sc.x.toFixed(3), 재질:!!mt && mt.visible,
               불투명:mt ? +(mt.opacity != null ? mt.opacity : 1).toFixed(2) : null,
               색: mt && mt.color ? '#' + mt.color.getHexString() : null });
  });
  return { mode: DOOR_MARK ? 'on' : 'off', 메시: out.length, 화면안: out.filter(q => q.화면안).length, list: out.slice(0, 8) };
}

export function hideStatics(on){ if (statics) statics.visible = !on; }

/* 고양이가 화면에 없을 때 어디까지 갔는지 보는 창. */
/* 지금 이 방이 어느 빛인가. 콘솔에서 바로 물어봐야 판정이 되는 값이다 — info()·debug() 와 같은 규칙.
   창에서 들어오는 빛 자락을 재던 칸 넷이 여기 있었다(2026-08-25 에 그 빛을 없앴다). */
export function skyInfo(){
  return { sky: lastSky, 창: panes.length, 천장등: ceilOn, 등수: ceilLights.length,
           새등: { ...cozyKinds }, 새등수: cozyLights.length, 발광면: cozyGlows.length, 촛불: flames.length };
}

export function debug(){
  if (!ready) return { ready:false };
  const out = { actors: actors.size, statics: !!statics, follow: FOLLOW.on,
                look: look.toArray().map(v => +v.toFixed(2)),
                /* 카메라에 손잡이가 늘었으니(팬·커서 줌·스냅) 여기서도 다 보여야 한다.
                   "안 움직인다" 를 진단하려면 각도와 배율이 같이 보여야 한다. */
                cam: { az:+CAM.az.toFixed(3), el:+CAM.el.toFixed(3), zoom:+CAM.zoom.toFixed(3) },
                /* 벽지·바닥. tex 는 **한 벌만 살아 있어야 한다** — 벌을 갈 때마다 쌓이면
                   VRAM 이 벌 수만큼 곱해진다(TODO 34 의 실측 항목). 벽 덩어리 크기마다
                   한 장씩이므로 보통 서넛이고, 벌을 갈아도 그 수가 늘지 않아야 맞다. */
                decor: window.DECOR ? { ...window.DECOR.cur(), tex: _dtex.size } : null,
                /* 가구 톤이 **실제로 렌더러까지 왔는가**(TODO 34 뒷 절반).
                   DECOR.pal() 이 뭘 돌려주는지는 카탈로그 이야기고, 여기 값은
                   가구가 색을 집을 때 실제로 읽는 표다. 둘이 갈리면 견본과 방이 갈린다. */
                pal: { wood: LP.PAL.wood, woodDark: LP.PAL.woodDark, metal: LP.PAL.metal,
                       metalDark: LP.PAL.metalDark, fabric: LP.PAL.fabric, fabric2: LP.PAL.fabric2,
                       pot: LP.PAL.pot, floor: LP.PAL.floor, wall: LP.PAL.wall,
                       /* 벌을 **안 타야** 하는 둘. 잎이 회색이 되면 화분이 죽은 것이고,
                          털뭉치가 회색이 되면 회색 사무실의 유일한 색이 사라진 것이다. */
                       leaf: LP.PAL.leaf, toy: LP.PAL.toy },
                /* 표시를 붙인 자리의 **월드 좌표**. 검사가 이걸 화면에 투영해서
                   그 자리의 국부 대비를 잰다 — 차분으로는 못 잰다(프레임마다 다른
                   필름 그레인이 있다). 22번이 안개를 잴 때 쓴 방법과 같은 축이다. */
                mark: { mode: DOOR_MARK ? 'on' : 'off', n: marks35.length, pts: markPts },
                rugs: rugMeshes.map(m => {
                  const b = new THREE.Box3().setFromObject(m);
                  return { x:+b.min.x.toFixed(2), y:+b.min.z.toFixed(2),
                           w:+(b.max.x-b.min.x).toFixed(2), h:+(b.max.z-b.min.z).toFixed(2),
                           thick:+(b.max.y-b.min.y).toFixed(3), y0:+b.min.y.toFixed(3) };
                }),
                cats: [] };
  actors.forEach((a, id) => {
    const p = tmp.copy(a.root.position).setY(0.4).project(camera);
    out.cats.push({
      id, pos: a.root.position.toArray().map(v => +v.toFixed(2)),
      drawn: a.drawn || null, look: a.look || null,
      /* 털색 — **가구 톤과 아무 관계가 없어야 한다.** 벌을 갈았는데 이 값이 따라
         바뀌면 인테리어가 아니라 직원이 바뀐 것이다(레퍼런스 아홉 장이 그랬다).
         화면 픽셀로 재면 빛이 섞여서 못 가르므로, 재질에 실제로 실린 값을 본다. */
      fur: a.fur != null ? a.fur : null,
      pose: a.pose ? a.pose() : null, seat: a.seatDbg,
      step: a.frame ? a.frame() : null,        // 걸음의 몇 번째 장면인가 (-1 = 안 걷는 중)
      shape: a.shape ? a.shape() : null,       // 지금 걸린 장면의 이름 (걸음·꼬리·귀 — TODO 39)
      yaw: +a.root.rotation.y.toFixed(3),
      visible: a.root.visible && (!a.plane || a.plane.visible),
      tex: a.plane && a.plane.material.map && a.plane.material.map.image
           ? [a.plane.material.map.image.width, a.plane.material.map.image.height] : null,
      ndc: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      onScreen: Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1,
    });
  });
  return out;
}

/* 프레임을 재는 문 — **어디가 느린지 모르고 고치면 그건 최적화가 아니라 추측이다.**
   그리는 쪽의 비용은 셋으로 갈린다: 드로우콜 · 광원 수 · 그림자. 그리고 셋 다
   three 가 이미 세고 있으므로 여기서는 그 값을 꺼내 주기만 한다.
   프로그램 수가 같이 필요한 이유: 광원 수가 바뀌면 three 는 셰이더를 **다시 컴파일**한다.
   그 순간이 곧 튀는 프레임이고, 숫자로 보이는 자리가 여기뿐이다. */
export function perf(){
  if (!renderer) return null;
  const r = renderer.info;
  let lights = 0, meshes = 0, shadowed = 0;
  scene.traverse(o => {
    if (o.isLight) lights++;
    if (o.isMesh){ meshes++; if (o.castShadow) shadowed++; }
  });
  return {
    calls: r.render.calls, tris: r.render.triangles,
    geometries: r.memory.geometries, textures: r.memory.textures,
    programs: renderer.info.programs ? renderer.info.programs.length : null,
    lights, meshes, shadowed,
    그림자: { on: renderer.shadowMap.enabled, map: sun ? sun.shadow.mapSize.width : null },
    문등: doorLights.length, 스탠드: lampLights.length,
    이름표: tagEls.size, 화면: canvas ? [canvas.width, canvas.height] : null,
    pixelRatio: renderer.getPixelRatio(),
  };
}
/* 그리는 쪽만 따로 껐다 켜 본다 — 무엇이 비용인지 **빼 보고** 확인하는 자리다.
   전부 디버그 전용이고 저장하지 않는다. */
/* 그림자 맵을 다시 굽는 크기로 갈아 끼운다. 이미 구워 둔 텍스처는 버려야
   three 가 새 크기로 다시 만든다 — 안 버리면 mapSize 만 바뀌고 그림은 그대로다. */
export function shadowPx(n){
  if (!sun) return null;
  sun.shadow.mapSize.set(n, n);
  if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
  return perf();
}
export function perfToggle(what, on){
  if (what === 'shadow'){ renderer.shadowMap.enabled = !!on; scene.traverse(o => { if (o.isMesh) o.material && (o.material.needsUpdate = true); }); }
  if (what === 'doorlight') doorLights.forEach(l => l.visible = !!on);
  if (what === 'lamplight') lampLights.forEach(l => l.visible = !!on);
  if (what === 'ceillight') ceilLights.forEach(l => l.visible = !!on);
  if (what === 'tags' && !on) clearTags();
  return perf();
}

export function info(){
  if (!renderer) return null;
  const shown = Object.keys(marks).filter(k => marks[k].visible);
  return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, marks: shown };
}

/* 한 칸 위에 실제로 뭔가 서 있는가. "샀는데 안 보인다" 는 신고가 반복되는데,
   정적 가구는 전부 한 덩어리로 병합돼 있어서 눈으로도 씬 그래프로도 못 센다.
   그래서 병합된 정점을 칸으로 되짚어 센다 — 격자에 있는데 여기서 0이면 그리는 쪽 문제고,
   여기서 나오는데 화면에 없으면 카메라나 가림 문제다. 원인을 반으로 가른다. */
export function geomAt(gx, gz){
  if (!statics) return null;
  let n = 0, minY = Infinity, maxY = -Infinity;
  statics.traverse(o => {
    const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
    if (!pos) return;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < pos.count; i++){
      tmp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (tmp.x < gx || tmp.x > gx + 1 || tmp.z < gz || tmp.z > gz + 1) continue;
      n++;
      if (tmp.y < minY) minY = tmp.y;
      if (tmp.y > maxY) maxY = tmp.y;
    }
  });
  return { verts:n, minY:n ? +minY.toFixed(2) : null, maxY:n ? +maxY.toFixed(2) : null };
}

/* ui.js 는 전역으로 부른다 (게임 나머지가 클래식 스크립트라서). */
/* ============================================================
   아웃트로 — 마지막 장면 (STORY.md 의 줌아웃)
   ------------------------------------------------------------
   **이 방을 다시 만들지 않는다.** 첫 컷에 나오는 사무실은 지금 화면에 서 있는 그 방이고,
   그래서 사람이 산 가구와 바른 벽지와 앉아 있는 고양이가 그대로 나온다.
   outro.js 는 그 **주위에** 복제 판과 냥찰청을 깔고 카메라 길만 돌려준다.

   빌려 가는 것 넷을 여기서 갈아 끼우고 끝나면 돌려준다:
     천장   열어야 위에서 방이 보인다
     안개   게임의 안개는 20~60 이라 격자가 통째로 먹힌다
     far    200 이면 격자 뒤쪽이 잘린다
     추적   FOLLOW 가 켜져 있으면 카메라를 서로 잡아당긴다
   ============================================================ */
let OUT = null, OUT_SAVE = null;

/* ── 이 장면은 **언제 보든 밤이다** ──
   컷신이 열리는 시각은 사람마다 다르다(분기 28 에 낮에 닿을 수도 있다). 그런데 이 장면은
   「무수한 창이 켜져 있고 그 위에서 둘이 내려다본다」이고, 그건 낮에는 성립하지 않는다 —
   대낮의 격자는 그냥 주차장이다.

   그래서 시각을 고정하는 것으로는 부족하다(고정해도 그 시간대의 전역광이 밝다).
   **전역광을 직접 눌러 둔다**: 방바닥의 등불과 창빛은 발광 재질이라 그대로 남고,
   하늘·해·보조광만 내려간다. 그러면 어디가 켜져 있는지가 화면의 전부가 된다.
   매 프레임 다시 세운다 — 컷신 도중 시간대가 바뀌어 renderNight 이 돌아도 안 흔들리게. */
const OUT_LIGHT = { hemi: 0.30, sun: 0.16, fill: 0.10 };

export function outroBuild(){
  if (!ready || !statics) return null;
  if (!OUT_SAVE){
    OUT_SAVE = { fov: camera.fov, far: camera.far, fog: EERIE.fog(), follow: FOLLOW.on,
                 ceil: ceiling(), expo: renderer.toneMappingExposure,
                 hemi: hemi.intensity, sun: sun.intensity, fill: fill.intensity };
  }
  setCeiling(false);
  EERIE.fog(false);
  camera.far = 600; camera.updateProjectionMatrix();
  FOLLOW.on = false;
  clearTags();
  const info = OUTRO.build({ scene, W, D });
  OUT = OUTRO.seek(0);
  return info;
}
/* 시각을 준다. 그 순간의 자막·암전을 돌려주므로 부르는 쪽이 화면에 얹는다. */
export function outroSeek(t, dt){
  if (!OUTRO.playing()) return null;
  hemi.intensity = OUT_LIGHT.hemi; sun.intensity = OUT_LIGHT.sun; fill.intensity = OUT_LIGHT.fill;
  OUT = OUTRO.seek(t);
  OUTRO.tick(dt || 0.03, camera);
  const want = OUT.fov || (OUT_SAVE ? OUT_SAVE.fov : camera.fov);
  if (camera.fov !== want){ camera.fov = want; camera.updateProjectionMatrix(); }
  renderer.toneMappingExposure = OUT.expo || (OUT_SAVE ? OUT_SAVE.expo : 1.04);
  return OUT;
}
/* 아웃트로가 끝나도 **격자는 남겨 둘 수 있다** — 시작화면이 그 정경을 쓴다(js/title.js).
   keep 을 주면 카메라만 놓고 판은 그대로 둔다. */
export function outroStop(keep){
  OUT = null;
  if (!keep) OUTRO.clear();
  if (OUT_SAVE){
    camera.fov = OUT_SAVE.fov; camera.far = OUT_SAVE.far;
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = OUT_SAVE.expo;
    hemi.intensity = OUT_SAVE.hemi; sun.intensity = OUT_SAVE.sun; fill.intensity = OUT_SAVE.fill;
    /* 밝기를 돌려주는 것만으로는 부족하다 — 그 사이에 시간대가 바뀌었을 수 있다.
       renderNight 이 있으면 그쪽에 다시 물어보는 편이 맞다. */
    try { if (typeof window !== 'undefined' && window.renderNight) window.renderNight(); } catch(e){}
    EERIE.fog(OUT_SAVE.fog);
    setCeiling(OUT_SAVE.ceil);
    FOLLOW.on = OUT_SAVE.follow;
    OUT_SAVE = null;
    fit();
  }
}
/* 시작화면의 정경 — 엔딩을 본 사람의 첫 화면이다(js/title.js).
   아웃트로의 마지막 장을 **정지 화면으로** 세운다: 격자가 다 올라온 상태에서
   옥상의 둘 뒤에 카메라를 놓고 그대로 둔다. 자막도 암전도 없다. */
export function outroVista(){
  if (!ready || !statics) return false;
  if (!OUTRO.playing()) outroBuild();
  const v = OUTRO.vista();
  if (!v) return false;
  hemi.intensity = OUT_LIGHT.hemi; sun.intensity = OUT_LIGHT.sun; fill.intensity = OUT_LIGHT.fill;
  OUT = v;
  OUTRO.tick(0.03, camera);
  if (OUT.fov){ camera.fov = OUT.fov; camera.updateProjectionMatrix(); }
  renderer.toneMappingExposure = OUT.expo || 1.04;
  return true;
}
export function outroInfo(){
  return { on: !!OUT, built: OUTRO.playing(), dur: OUTRO.dur(), chapters: OUTRO.chapters() };
}

/* ============================================================
   택배 컷신 — js/three/parcel.js

   아웃트로와 같은 형태다: 이 파일은 **자리와 카메라만** 넘기고, 장면은 저쪽이 짠다.
   다른 점 하나 — 아웃트로는 방 밖으로 나가지만 이건 **방 안으로 들어온다.**
   그래서 조명도 천장도 안개도 그대로 둔다: 사람이 꾸민 사무실이 이 컷의 배경이다.

   ── 왜 고양이를 옮기나 ──
   뜯는 고양이는 **앉아 있어야** 한다(앞발 장면이 앉은 자세로만 깎여 있다 — catsculpt).
   그런데 그 순간 그 냥이가 복도를 걷고 있을 수 있다. 그래서 컷신 동안만 자리에 앉힌다.
   원래 자리와 상태는 적어 두고 끝나면 되돌린다 — 시뮬은 계속 돌고 있으므로 다음 틱에
   저절로 제자리를 찾아간다.
   ============================================================ */
let PC = null;             // 지금 프레임의 카메라 (parcel.seek 의 결과)
let PC_SAVE = null;        // { id, pos, yaw, state } — 되돌릴 것
let PC_CHAIR = null;       // { chair, z } — 같이 물린 의자를 되돌릴 것
let PC_INFO = null;        // 검사가 읽는 자리값

/* 뜯을 고양이와 그 책상. 대표를 먼저 찾고, 없으면 아무나 — 자리가 있는 냥이여야 한다. */
function parcelPick(list){
  /* 책상 목록은 월드가 들고 있다(js/world.js). build 때 받아 둔 것을 본다. */
  const desks = (WORLD && WORLD.desks) || [];
  if (!desks.length) return null;
  const cats = list || [];
  const cat = cats.find(c => c.founder) || cats[0];
  if (!cat) return null;
  /* 그 냥이가 앉아 있던 자리를 먼저 쓴다. 아니면 첫 번째 책상. */
  const mine = desks.find(d => d.seat.x === cat.x && d.seat.y === cat.y) || desks[0];
  return { cat, desk: mine };
}

/* 왜 못 세웠는지 적어 둔다. 못 세우면 화면 쪽이 **조용히** 평면 장면으로 내려가는데
   (js/gacha.js), 조용한 폴백은 「어느 날 갑자기 예전 것이 나온다」로 나타난다.
   콘솔을 못 여는 기기에서도 R3.parcelWhy() 하나로 답이 나오게 둔다. */
let PC_WHY = '';
export function parcelWhy(){ return PC_WHY; }

export function parcelBuild(list){
  PC_WHY = '';
  if (!ready || !statics){ PC_WHY = '렌더러가 안 섰다'; return null; }
  const pick = parcelPick(list);
  if (!pick){ PC_WHY = '자리(책상)나 고양이가 없다'; return null; }
  const a = actors.get(pick.cat.id);
  if (!a){ PC_WHY = '그 고양이의 배우가 아직 없다 (' + pick.cat.id + ')'; return null; }
  if (!a.setTap){ PC_WHY = '손그림 배우라 앞발 장면이 없다'; return null; }

  CS.warmTap();                                   // 세 장을 미리 깎는다(첫 프레임이 튀지 않게)

  PC_SAVE = { id: pick.cat.id, pos: a.root.position.clone(), rot: a.root.rotation.y,
              follow: FOLLOW.on };
  FOLLOW.on = false;
  clearTags();

  /* 자리에 앉힌다. 의자는 책상 쪽으로 물려 있으므로(build 의 chair) 그 자리에 맞춘다. */
  const s = pick.desk.seat;
  a.setState('sit');
  if (a.setHeading) a.setHeading(SEAT_YAW);
  a.root.rotation.y = SEAT_YAW;

  /* 앉은 자리는 sync 가 쓰는 값(SEAT_Z 0.20)에서 **조금 뒤로** 물린다.
     그 값은 모니터를 보고 일하는 자리라 책상에 바싹 붙어 있는데, 상자를 올려놓으면
     고양이 얼굴이 상자에 처박힌다 — 앉은 자세의 머리가 몸보다 0.285 앞으로 나와 있어서다.
     0.42 면 코끝과 상자 사이가 한 뼘쯤 뜨고, 앞발은 여전히 상자 턱에 닿는다. */
  const BACK = 0.42 - SEAT_Z[catLook];         // 물린 거리 (0.22)
  a.root.position.set(s.x + 0.5, SEAT_Y, s.y + 0.42);
  a.baseY = SEAT_Y;
  /* **의자도 같은 만큼** 물린다. 고양이만 물리면 의자가 코앞에 남아서, 고양이가
     의자 등받이 뒤 허공에 앉아 있는 그림이 된다. */
  const chair = seatChairs.get(s.y * W + s.x);
  if (chair){
    PC_CHAIR = { chair, z: chair.position.z };
    chair.position.z += BACK;
  }

  /* 상자는 **키보드 자리**에 얹는다(deskProps 의 dz 0.72 · 상판 0.65).
     자리마다 키보드가 하나씩 놓여 있어서, 그 앞에 두면 상자가 책상 밖으로 반쯤 나가고
     안쪽에 두면 키보드 너머로 손을 뻗는 그림이 된다. 그래서 **그 위에 놓아 덮는다** —
     상자가 키보드보다 넓고(BW 0.52 > 0.46) 깊어서 통째로 가린다.
     병합된 정적 묶음이라 키보드만 숨길 수는 없다(js/three/merge.js) — 덮는 것이 답이다. */
  const d = pick.desk.desk;
  const boxAt = { x: d.x + 0.5, y: 0.66, z: d.y + 0.70 };
  const catAt = { x: a.root.position.x, y: SEAT_Y, z: a.root.position.z };
  /* 검사가 읽을 수 있게 남긴다 — 의자가 고양이와 같이 물렸는지는 눈보다 숫자가 낫다. */
  PC_INFO = { back: BACK, catZ: a.root.position.z,
              chairZ: chair ? chair.position.z : null,
              chairZ0: PC_CHAIR ? PC_CHAIR.z : null };
  /* 가려짐을 재려면 **방을 넘겨야 한다** — 정적 묶음이 통째로 하나라 광선 한 방이면 된다. */
  const info = PARCEL.build({ scene, box: boxAt, cat: catAt, yaw: SEAT_YAW,
                              roomW: W, roomD: D, occluder: statics });
  PC = PARCEL.seek(0);
  parcelPose(PC);
  return { dur: info.dur, cat: pick.cat.id, name: pick.cat.name };
}

/* 앞발 위상을 그 배우에게 넘긴다. 컷신의 시계로 돌린다 — 고양이의 시계로 돌리면
   카메라가 멈춘 순간에도 발만 따로 움직인다. */
function parcelPose(st){
  if (!st || !PC_SAVE) return;
  const a = actors.get(PC_SAVE.id);
  if (a && a.setTap) a.setTap(st.tap);
}

export function parcelSeek(t, dt){
  if (!PARCEL.playing()) return null;
  PC = PARCEL.seek(t);
  parcelPose(PC);
  /* 이 컷은 방 안이라 배우도 계속 돌아야 한다(꼬리·표정). 시뮬은 멈춰 있으므로
     여기서 한 번 밀어 준다 — 안 하면 고양이가 통째로 정지 화면이 된다. */
  const a = actors.get(PC_SAVE && PC_SAVE.id);
  if (a && a.update) a.update(dt || 0.03, camera);
  return PC;
}

export function parcelStop(){
  PC = null;
  PARCEL.stop();
  if (PC_CHAIR){ PC_CHAIR.chair.position.z = PC_CHAIR.z; PC_CHAIR = null; }
  if (PC_SAVE){
    const a = actors.get(PC_SAVE.id);
    if (a){
      if (a.setTap) a.setTap(null);
      a.root.position.copy(PC_SAVE.pos);
      a.root.rotation.y = PC_SAVE.rot;
    }
    FOLLOW.on = PC_SAVE.follow;
    PC_SAVE = null;
  }
  fit();
}
export function parcelOn(){ return !!PC; }
export function parcelInfo(){ return PC_INFO; }

window.R3 = { init, build, sync, night, fit, draw, project, info, skyInfo, furnPortrait,
              pickTile, pickCat, pickSwitch, setCeiling, ceiling, switchAt, doorsInWorld,
              marker, justDragged, followOn, following, followZoom,
              camReset, camTurn, camSet,
              portrait, markInfo, perf, perfToggle, debug, geomAt, hideStatics, clearTags, flick, catShape,
              outroBuild, outroSeek, outroStop, outroVista, outroInfo,
              parcelBuild, parcelSeek, parcelStop, parcelOn, parcelInfo, parcelWhy,
              getCatLook, setCatLook, catFur, catStats: CS.stats,
              studio, markPalette, markKey: CS.markKey, faceSets, faceNorm, faceKey: CS.faceKey,
              paintCoverage, shadowPx, ready:false };
window.R3E = EERIE;      // 그림체 손잡이는 콘솔에서 바로 돌려야 판정이 된다

/* 이 모듈은 클래식 스크립트가 전부 돈 뒤에 실행된다(모듈은 항상 지연된다).
   그때까지 ui.js 는 빈 무대를 들고 기다리고 있으므로, 여기서 켜고 다시 그리라고 알린다.
   (`?3d=0` 로 켜지 않는 길이 있었다. 떨어질 도트판이 없어진 2026-08-24 에 같이 지웠다.) */
(function autostart(){
  const cv = document.getElementById('gl');
  if (!cv){ window.__r3fail = 1; return; }
  /* init 이 던지는 건 실제로 있는 일이다 — WebGL 이 없는 기계, 컨텍스트 수 한계에
     걸린 탭. 그때 조용히 죽으면 ui.js 가 "무대가 오는 중" 이라고 믿고 빈 무대를
     계속 보여준다. 실패를 말해야 못 그렸다는 판이 뜬다(ui.js stageFail). */
  try { init(cv); }
  catch(e){
    /* 깃발만 세운다. 다시 그리는 건 ui.js 의 renderNight 이 매 프레임 걸러 낸다 —
       빠져나오는 길이 셋이라 여기서 각자 부르면 하나를 빼먹는다(실제로 빼먹었다). */
    window.__r3fail = 1;
    console.warn('[copycat] 3D 를 못 켰다.', e);
    return;
  }
  window.R3.ready = true;
  if (typeof renderTiles === 'function'){ renderTiles(); renderNight(); }
  /* 직원 목록은 이미 도트 초상으로 한 번 그려진 뒤다 — 손그림으로 다시 그린다. */
  if (typeof renderRight === 'function') renderRight();
  addEventListener('resize', fit);
})();
