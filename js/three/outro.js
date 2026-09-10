/* ============================================================
   outro.js — 마지막 장면. **줌아웃하면 지점들이 깔리고, 경찰의 뒷모습이 보이며 끝난다.**
   대본은 ../../STORY.md 의 「줌아웃 (Q28 · 엔딩 둘의 공통 장면)」.

   ── 프롤로그와 정반대로 만든다 ──
   opening.js 는 **자기 렌더러와 자기 씬**을 갖는다. 골목과 텅 빈 방은 게임 격자와 아무
   상관이 없으니 그게 맞았다. 아웃트로는 반대다: 이 장면의 내용이 곧 **당신의 사무실**이고,
   그 방은 이미 render3d 가 세워 놓았다(벽지·바닥·가구 톤·산 가구·놓은 자리·앉아 있는
   고양이·고른 간판까지). 렌더러를 따로 두면 그 방을 처음부터 다시 만들어야 하고,
   그 순간부터 두 방은 서로 달라지기 시작한다.

   그래서 이 파일은 **씬을 안 만든다.** render3d 의 씬을 받아서
     · 우리 방 **주위에** 복제 판을 깔고
     · 그 격자의 한가운데에 냥찰청을 세우고
     · 그 옥상에 둘을 세워 두고
     · 카메라 세 장을 돌려준다
   방은 손대지 않는다. 첫 컷에 나오는 것은 진짜 그 방이다.

   ── 복제 판은 왜 진짜 방이 아닌가 ──
   그게 이 장면의 뜻이다. 우리 방만 진짜고 나머지는 **같은 평면도에 간판만 갈아 끼운 것**이다.
   그리고 실제로도 그래야 한다 — 스물넷을 진짜로 세우면 가구가 방마다 스물다섯 종이다.

   ── 판 간격은 방 크기에서 끌어온다 ──
   사무실은 등급마다 커진다(12×10 → 17×15). 간격을 상수로 박아 두면 등급에 따라 판이
   겹치거나 벌어진다. 그래서 전부 W·D 로 잰다.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';
import * as LP from './lowpoly.js';
import * as CS from './catsculpt.js';

/* 5×5 였다. **7×7 로 넓혔다**(2026-09-10) — 스물넷은 「여러 개」로 읽히고, 이 컷이
   말해야 하는 것은 「무수히 많다」다. 마흔일곱 개면 화면 끝까지 판이 깔려서 격자가
   프레임 안에서 안 끝난다: 끝이 안 보이는 것이 곧 「하나였다」는 말이다.
   대신 바깥 두 겹은 **가구를 안 넣는다**(plate 의 far) — 거기는 어차피 점 하나 크기고,
   마흔일곱 방에 책상을 스무 개씩 세우면 그건 장면이 아니라 부하다. */
const GRID = 7;                 // 7×7 — 가운데가 냥찰청이므로 지점은 47개
const FAR_RING = 2;             // 청사에서 이 겹 밖은 덩어리와 등불만
/* 우리 방은 가운데 열의 **맨 뒷줄**이다(북쪽). 처음엔 맨 앞줄(r:4)에 뒀는데,
   그러면 냥찰청이 우리 방의 북쪽에 서고 카메라도 거기서 남쪽을 본다 — 즉 **우리 방을
   뒤에서** 보게 된다. 이 게임의 방은 남쪽(+z)이 트여 있고 북쪽에 벽이 있어서
   (render3d 가 옆벽과 아래 벽줄을 안 그린다), 북에서 보면 벽 등짝만 보이고 안이 안 보인다.
   방을 맨 뒤에 두면 청사가 남쪽에 서고, 거기서 북쪽을 보게 되어 **방 안이 보인다.** */
const CEN = { c: (GRID - 1) / 2, r: (GRID - 1) / 2 };   // 냥찰청 — 격자 한가운데
const OUR = { c: CEN.c, r: CEN.r - 2 };                // 청사에서 두 줄 북쪽
const GAP = 5;                  // 방과 방 사이

/* 옥상 높이. **낮아야 아래가 보인다** — 높이면 카메라가 아무리 숙여도 격자가 프레임
   밖으로 밀리고, 더 숙이면 이번엔 고양이를 위에서 내려다보게 된다(뒷모습이 아니라 정수리).
   9.5 는 그 사이에서 잡은 값이다: 카메라를 옥상 바닥보다 3.45 위에 두면 시선이 바닥 끝을
   33° 로 넘어가고, 앞줄 지점이 그보다 얕은 각에 들어온다. 이 값을 올릴 때는 3장의
   카메라 높이(CH 의 watch)도 같이 올려야 한다 — 둘은 한 쌍이다. */
const ROOF = 9.5;

let ctx = null;                 // { scene, W, D }
let root = null;                // 이 파일이 만든 것 전부. 끝나면 통째로 버린다
let cops = [], lamp = null;
let CH = [], DUR = 0, VISTA = null;

const smooth = k => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- 복제 판 하나 ----------
   멀리서 보이는 것은 **덩어리와 등불**뿐이다. 그 이상 채우면 프레임만 잡아먹는다.
   자리를 씨앗으로 조금씩 흩는 이유: 스물넷이 완전히 같으면 「복제된 지점」이 아니라
   「덜 만든 장면」으로 보인다. */
function plate(seed, W, D, far){
  const g = new THREE.Group();
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);

  g.add(LP.box(W, 0.18, D, 0x1B1A19, W / 2, -0.09, D / 2));
  /* 안에서 켜진 등불 — 점광원 대신 발광 바닥 한 장. 지점이 스물넷이라 방마다 등을 켜면
     광원이 스물넷이다(52번에서 이미 겪었다: 만질수록 느려지는 사무실). */
  /* 등불은 **한참 눕혀 둔다**(0.6 → 0.34 → 0.16 → 0.055).
     복제 판은 **잘 안 보여야 한다.** 진짜로 만든 방이 아니라 같은 평면도를 복제한 것이라,
     밝히면 밝힐수록 「대충 만든 사무실」이 또렷해진다 — 화면에 필요한 것은 방의 내용이
     아니라 **저기에도 하나, 저기에도 하나**라는 사실뿐이다.
     그래서 켜진 흔적만 남긴다: 어둠 속의 흐린 호박색 자국. 색도 크림에서 호박으로
     데운다 — 창이 켜진 사무실은 흰빛이 아니라 노란빛이고, 그래야 청사의 찬 창빛과 갈린다.

     **다만 0.055 는 너무 눌렀다**(2026-09-10). 3장에서 격자가 통째로 검은 바닥이 되어,
     화면에 켜진 방이 우리 방 하나뿐이었다 — 그러면 이 컷이 말하려던 「저기에도 하나,
     저기에도 하나」가 화면에 없다. 0.22 면 판은 여전히 안 읽히는데(가구는 안 보인다)
     **켜져 있다는 것만** 보인다. 그 둘의 차이가 이 장면의 전부다. */
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 2.2, D - 2.2), LP.matGlow(0xC4894A, 0.22));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(W / 2, 0.012, D / 2);
  g.add(glow);
  /* 벽은 두 면만. 네 면으로 두르면 위에서 볼 때 상자가 되고, 상자는 사무실로 안 읽힌다.
     (게임의 방도 같은 이유로 옆벽을 안 그린다 — render3d 의 카메라 주석) */
  g.add(LP.box(W, 1.1, 0.22, 0x232019, W / 2, 0.55, 0));
  g.add(LP.box(0.22, 1.1, D, 0x232019, 0, 0.55, D / 2));

  /* 판 하나가 방 하나만큼 크다(17×15). 5칸 간격으로 놓았더니 **빈 창고**로 보였다 —
     진짜 방은 가구가 스물다섯 종 들어차 있으니 옆에 놓고 보면 그 차이가 그대로 보인다.
     3.6칸 간격이면 「사무실인데 우리 방은 아닌 곳」으로 읽힌다. */
  /* **빈 판을 두지 않는다**(2026-09-10). 한 번 바깥 두 겹의 가구를 통째로 뺐다가
     되돌렸다 — 부하는 줄었는데 화면에 **책상도 의자도 없는 사무실**이 스물네 개 생겼고,
     그건 「복제된 지점」이 아니라 「아직 안 만든 곳」으로 보인다. 이 장면이 말하려는 것은
     저기도 우리와 같은 방이라는 것이므로, 비면 그 말이 통째로 어긋난다.
     대신 먼 판은 **성기게** 놓고 모니터를 뺀다 — 그 거리에서 모니터는 한 픽셀이다. */
  const cols = Math.max(3, Math.round(W / 3.6)), rows = Math.max(2, Math.round(D / 3.6));
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++){
      if (far && ((i + j) & 1)) continue;
      const x = 1.8 + i * (W - 3.4) / Math.max(1, cols - 1) + rnd() * 0.4;
      const z = 2.2 + j * (D - 4.4) / Math.max(1, rows - 1) + rnd() * 0.4;
      const d = LP.desk(); d.position.set(x, 0, z); g.add(d);
      const c = LP.chair(Math.PI); c.position.set(x, 0, z + 0.85); g.add(c);
      if (!far) g.add(LP.monitor(x, z - 0.1, 0));
    }

  /* 간판. 지점을 가르는 유일한 표시다 — 여기가 59번에서 고른 그 간판이 들어갈 자리고,
     지금은 밝기만 조금씩 다른 판이다. */
  const sign = LP.box(2.4, 0.52, 0.14, 0x8A7A64, W / 2, 1.3, D + 0.12);
  sign.material = LP.matGlow(0xC79A5E, 0.13 + rnd() * 0.08);
  g.add(sign);
  g.add(LP.box(0.14, 1.3, 0.14, 0x232019, W / 2 - 1.05, 0.65, D + 0.12));
  g.add(LP.box(0.14, 1.3, 0.14, 0x232019, W / 2 + 1.05, 0.65, D + 0.12));
  return g;
}

/* ---------- 냥찰청 ----------
   격자 한가운데. 지점은 등을 켜고 이쪽은 **창 몇 짝만** 켜져 있어야
   「보는 쪽」과 「보이는 쪽」이 갈린다.

   ── 관공서로 읽히게 ──
   처음엔 창 몇 개 뚫은 검은 상자였다. 판들 사이에 놓으니 「큰 지점」으로 보였다 —
   중심에 있는 것이 그냥 더 큰 사무실이면 이 장면의 뜻이 없어진다. 그래서 관공서가
   가진 것들을 붙였다. 전부 상자와 원기둥이지만 넷이 모이면 청사로 읽힌다:

     · **기단(基壇)** — 본체보다 넓은 받침. 관공서는 땅에서 한 단 올라가 있다
     · **줄 맞은 창** — 층이 보이는 격자. 지점의 창은 제멋대로고 이쪽은 줄이 맞는다
     · **현관 차양과 등 둘** — 사람이 드나드는 정문. 지점에는 없는 것이다
     · **간판 띠와 문장(紋章)** — 위쪽에 발광 띠 한 줄, 그 가운데 귀 둘 달린 원반.
       글자를 못 쓰므로(3D 에 글꼴이 없다) 이 게임의 고양이 귀로 대신한다
     · **안테나** — 옥상 위로 솟은 기둥과 붉은 표시등. 높이를 옥상에 안 얹고 **위로** 준다
       (옥상 높이 ROOF 는 3장 카메라와 한 쌍이라 못 건드린다 — 그 주석 참고)

   위층은 **열린 옥상**이다. 한 번 실내(사방 벽 + 창틀)로 만들었다가 걷었다 — 실내는
   등을 켜면 실루엣이 죽고 안 켜면 아무것도 안 보이며, 무엇보다 창턱이 시야를 잘라서
   **아래의 격자가 프레임에 안 들어왔다.** 이 장면의 요점이 「내려다보고 있다」인데. */
function precinct(W, D){
  /* 지점 판이 방 크기(17×15)만큼 크므로 청사도 그만큼이어야 한다 — 처음엔 W*0.5 로
     뒀더니 판들 사이에 놓인 **작은 검은 상자**였다. 「중심」으로 읽히려면 덩치가 있어야 한다. */
  const bw = Math.max(9, W * 0.62), bd = Math.max(7, D * 0.52);
  const g = new THREE.Group();
  const STONE = 0x2B3038, STONE_D = 0x22262E, TRIM = 0x3A4150;

  /* 기단 — 본체보다 한 단 넓고 낮다 */
  g.add(LP.box(bw + 2.6, 0.7, bd + 2.2, STONE_D, 0, 0.35, 0));
  g.add(LP.box(bw + 1.4, 0.28, bd + 1.2, TRIM, 0, 0.84, 0));
  /* 본체 */
  g.add(LP.box(bw, ROOF - 1, bd, STONE, 0, (ROOF - 1) / 2 + 1, 0));
  /* 모서리 기둥 넷 — 밋밋한 상자에 세로선이 생긴다 */
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.add(LP.box(0.5, ROOF - 1, 0.5, TRIM, sx * (bw / 2 - 0.2), (ROOF - 1) / 2 + 1, sz * (bd / 2 - 0.2)));

  /* 줄 맞은 창. 앞면(+z)과 옆면 둘. 켜진 칸은 셋에 하나 —
     전부 켜면 이쪽도 사무실이고, 다 끄면 폐건물이다. */
  const COLS = 5, ROWS = 3;
  const lit = (i) => i % 3 === 0;
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let i = 0; i < COLS; i++){
      const y = 2.2 + r * ((ROOF - 3.4) / Math.max(1, ROWS - 1));
      const x = -bw * 0.34 + i * (bw * 0.68 / (COLS - 1));
      const on = lit(n++);
      const w = LP.box(0.86, 1.0, 0.12, on ? 0xCFE0F2 : 0x171A20, x, y, bd / 2 + 0.02);
      if (on) w.material = LP.matGlow(0xBFD4EA, 0.5);
      g.add(w);
    }
  for (const sx of [-1, 1])
    for (let r = 0; r < ROWS; r++)
      for (let i = 0; i < 3; i++){
        const y = 2.2 + r * ((ROOF - 3.4) / Math.max(1, ROWS - 1));
        const z = -bd * 0.26 + i * (bd * 0.26);
        const on = lit(n++);
        const w = LP.box(0.12, 1.0, 0.8, on ? 0xCFE0F2 : 0x171A20, sx * (bw / 2 + 0.02), y, z);
        if (on) w.material = LP.matGlow(0xBFD4EA, 0.42);
        g.add(w);
      }

  /* 현관 — 차양과 등 둘. 지점에는 없는 것이라 이것 하나로 「드나드는 곳」이 생긴다. */
  g.add(LP.box(bw * 0.42, 0.26, 1.9, TRIM, 0, 2.5, bd / 2 + 0.95));
  g.add(LP.box(0.28, 2.3, 0.28, TRIM, -bw * 0.19, 1.35, bd / 2 + 1.75));
  g.add(LP.box(0.28, 2.3, 0.28, TRIM,  bw * 0.19, 1.35, bd / 2 + 1.75));
  for (const sx of [-1, 1]){
    const b = LP.box(0.34, 0.34, 0.34, 0xFFE6B4, sx * bw * 0.19, 2.28, bd / 2 + 1.75);
    b.material = LP.matGlow(0xFFE0A8, 0.9);
    g.add(b);
  }
  const door = new THREE.PointLight(0xFFD9A0, 1.1, 9, 2);
  door.position.set(0, 2.1, bd / 2 + 1.6);
  g.add(door);

  /* 간판 띠와 문장. 글자를 못 쓰므로 **귀 둘 달린 원반** 하나로 대신한다 —
     이 게임에서 고양이 귀는 이미 표지다(로고·아이콘·이름표). */
  const band = LP.box(bw * 0.86, 0.5, 0.1, 0x1A1E26, 0, ROOF - 0.9, bd / 2 + 0.03);
  band.material = LP.mat(0x1A1E26);
  g.add(band);
  const emb = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), LP.matGlow(0xE7D6A8, 0.95));
  emb.position.set(0, ROOF - 0.9, bd / 2 + 0.1);
  g.add(emb);
  for (const sx of [-1, 1]){
    const ear = LP.cone(0.19, 0.3, 0xE7D6A8, 3);
    ear.material = LP.matGlow(0xE7D6A8, 0.95);
    ear.position.set(sx * 0.26, ROOF - 0.56, bd / 2 + 0.1);
    g.add(ear);
  }

  /* 옥상 — 바닥과 낮은 난간뿐이다.
     **테라스는 -z 쪽에 낸다**(정면의 반대). 격자가 그쪽에 있고 둘은 격자를 보아야 하는데,
     정면까지 그쪽으로 돌리면 화면에는 건물 뒤통수만 남는다(위 build 의 주석).
     한 번 옥상에 방을 한 채 얹어 봤다가 걷었다 — 카메라와 둘 사이에 서면 프레임을
     막고, 둘 너머에 서면 격자를 가린다. 옥상은 비어 있는 편이 낫다. */
  g.add(LP.box(bw + 1.6, 0.3, bd + 2.0, 0x2E333C, 0, ROOF + 0.15, -0.6));
  /* 안테나 — 높이를 옥상에 안 얹고 위로 준다. 붉은 표시등은 관공서의 표지다. */
  /* **왼쪽 끝으로 밀어 둔다.** 가운데 가까이 세웠더니 앞모습 컷에서 둘 사이로 기둥이
     하나 솟았다 — 이 파일이 옥상의 방과 등 기구를 걷어낸 그 이유가 또 나왔다. */
  g.add(LP.box(0.22, 5.4, 0.22, TRIM, -bw * 0.46, ROOF + 3.0, -bd * 0.34));
  const beacon = LP.box(0.3, 0.3, 0.3, 0xFF6B5A, -bw * 0.46, ROOF + 5.8, -bd * 0.34);
  beacon.material = LP.matGlow(0xFF6B5A, 1.0);
  g.add(beacon);

  const ez = -(bd / 2 + 1.55);                    // 옥상에서 격자를 보는 끝 (-z)
  const rail = (w, d, x, z) => {
    g.add(LP.box(w, 0.09, d, 0x4A5060, x, ROOF + 0.80, z));
    g.add(LP.box(w, 0.07, d, 0x434958, x, ROOF + 0.50, z));
  };
  rail(bw + 1.6, 0.16, 0, ez);
  rail(0.16, bd + 2.0, -(bw + 1.6) / 2, -0.6);
  rail(0.16, bd + 2.0,  (bw + 1.6) / 2, -0.6);
  for (let i = 0; i <= 5; i++)
    g.add(LP.box(0.13, 0.84, 0.13, 0x434958, -(bw + 1.6) / 2 + i * (bw + 1.6) / 5, ROOF + 0.44, ez));

  /* ── 앞마당 ── (2026-09-10)
     여기까지가 「관공서」였다. **「냥찰청」**으로 읽히게 하는 것은 건물이 아니라
     그 앞에 서 있는 것들이다. 넷을 세운다 — 넷 다 상자지만 같이 서면 청사 앞마당이다:
       · 순찰차 둘 — 정문 양쪽에 비스듬히. 경광등 빨강·파랑이 밤에 제일 먼저 보인다
       · 차단봉과 초소 — 아무나 못 들어가는 곳이라는 표시. 사무실 앞에는 이런 게 없다
       · 깃대 둘 — 관공서의 그것
       · 파란 띠 — 정면을 가로지르는 한 줄. 지점의 간판은 호박색이고 여기만 파랗다 */
  const front = bd / 2;
  const band2 = LP.box(bw * 0.9, 0.16, 0.1, 0x3E6BD6, 0, ROOF - 1.35, front + 0.05);
  band2.material = LP.matGlow(0x4E7BEA, 0.85);
  g.add(band2);
  /* 앞마당 바닥 — 판이 없으면 차가 허공에 뜬 것으로 보인다 */
  g.add(LP.box(bw + 6.0, 0.14, 7.4, 0x24272E, 0, 0.07, front + 4.2));

  const carL = patrolCar(Math.PI * 0.06);
  carL.position.set(-bw * 0.42, 0, front + 3.1);
  g.add(carL);
  const carR = patrolCar(Math.PI * 1.04);
  carR.position.set(bw * 0.44, 0, front + 5.2);
  g.add(carR);

  /* 차단봉 — 기둥 둘과 그 사이의 가로대(빨강·흰색). 올라가 있다. */
  for (const sx of [-1, 1]) g.add(LP.box(0.22, 1.05, 0.22, 0x30343C, sx * 2.5, 0.55, front + 7.0));
  for (let i = 0; i < 5; i++)
    g.add(LP.box(0.94, 0.16, 0.16, i % 2 ? 0xE24B3A : 0xF0EDE6,
      -2.0 + i * 1.0, 1.02, front + 7.0));
  /* 초소 — 한 칸짜리 상자에 불 켜진 창 하나 */
  g.add(LP.box(1.5, 2.1, 1.4, 0x2B3038, -bw * 0.66, 1.05, front + 7.0));
  g.add(LP.box(1.62, 0.18, 1.52, 0x3A4150, -bw * 0.66, 2.18, front + 7.0));
  const booth = LP.box(0.9, 0.7, 0.06, 0xCFE0F2, -bw * 0.66, 1.35, front + 7.72);
  booth.material = LP.matGlow(0xBFD4EA, 0.55);
  g.add(booth);

  /* 깃대 둘 */
  for (const sx of [-1, 1]){
    g.add(LP.box(0.12, 4.2, 0.12, 0x8A8F99, sx * (bw * 0.30), 2.1, front + 2.0));
    const flag = LP.box(0.08, 0.62, 1.0, sx < 0 ? 0xD8DEE9 : 0x3E6BD6,
      sx * (bw * 0.30) + 0.06, 3.62, front + 2.5);
    g.add(flag);
  }

  g.userData.edgeZ = ez;
  return g;
}

/* ---------- 취조등 ----------
   옥상의 둘 위에 **등 하나.** 이 컷의 문제는 「둘이 안 보인다」였다 — 검은 고양이를
   밤 옥상에 세워 두면 난간과 구별이 안 된다. 그렇다고 앞에서 비추면 실루엣이 죽는다.

   그래서 **위에서 하나**다. 취조실의 그 등이다: 갓이 좁아서 빛이 원뿔로 떨어지고,
   바닥에 동그란 웅덩이가 생기고, 그 안에 둘만 서 있다. 밝히는 것과 동시에
   **여기가 어떤 곳인지**를 말한다 — 냥찰청 옥상에서 내려다보는 둘이다.

   빛 웅덩이는 광원 하나로 안 된다(바닥이 어두우면 감쇠만으로는 원이 안 생긴다).
   발광 원반을 바닥에 깔아 원을 그리고, 그 위에 짧은 점광원을 얹어 고양이를 세운다. */
/* ---------- 순찰차 ----------
   **청사를 청사로 읽히게 하는 것은 건물이 아니라 그 앞에 선 물건이다.**
   기단·창 격자·차양·문장까지 붙여도 「좀 큰 사무실」로 보였다(위 precinct 머리말의
   그 문제가 절반만 풀렸다). 관공서 중에서도 **어디**인지를 말하는 건 결국 순찰차다 —
   상자 다섯 개와 경광등 두 칸이면 그 실루엣이 나온다.
   경광등은 좌우가 **빨강과 파랑**이다. 이 게임에서 그 두 색이 나란히 있는 자리는
   여기뿐이라, 색만으로도 다른 어떤 물건과 안 헷갈린다. */
function patrolCar(dir){
  const g = new THREE.Group();
  const BODY = 0xE8E9EC, DARK = 0x1B1E24, GLASS = 0x2B3A4A;
  g.add(LP.box(3.5, 0.62, 1.62, BODY, 0, 0.58, 0));          // 아래 몸통
  g.add(LP.box(2.0, 0.60, 1.50, BODY, -0.15, 1.16, 0));      // 지붕
  g.add(LP.box(1.86, 0.42, 1.54, GLASS, -0.15, 1.12, 0));    // 유리띠
  g.add(LP.box(3.54, 0.30, 1.64, DARK, 0, 0.86, 0));         // 옆구리 띠 — 흑백 순찰차
  for (const sx of [-1.2, 1.2])
    for (const sz of [-1, 1]){
      const w = LP.box(0.34, 0.56, 0.30, DARK, sx, 0.32, sz * 0.78);
      g.add(w);
    }
  /* 경광등 — 지붕 위 한 줄. 발광이라 밤에 이것만 또렷하게 남는다. */
  const bar = LP.box(1.30, 0.13, 0.44, DARK, -0.15, 1.52, 0);
  g.add(bar);
  const red = LP.box(0.56, 0.20, 0.40, 0xFF4A3A, -0.47, 1.55, 0);
  red.material = LP.matGlow(0xFF4A3A, 1.0);
  g.add(red);
  const blu = LP.box(0.56, 0.20, 0.40, 0x4A7BFF, 0.17, 1.55, 0);
  blu.material = LP.matGlow(0x5A8CFF, 1.0);
  g.add(blu);
  /* 전조등 둘 — 켜 두면 「세워 둔 차」가 아니라 「방금 선 차」가 된다 */
  for (const sz of [-0.52, 0.52]){
    const h = LP.box(0.10, 0.20, 0.34, 0xFFF3D0, 1.74, 0.62, sz);
    h.material = LP.matGlow(0xFFF0C8, 0.9);
    g.add(h);
  }
  g.rotation.y = dir || 0;
  return g;
}

/* 빛 웅덩이의 그림. 한 장 구워서 계속 쓴다 — 등은 하나뿐이지만 습관이다.
   가운데를 완전히 하얗게 두지 않는다(0.72): 태우면 다시 「흰 판」이 된다. */
let _poolTex = null;
function poolTex(){
  if (_poolTex) return _poolTex;
  const N = 256;
  const cv = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (!cv) return null;
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  rg.addColorStop(0.00, 'rgba(255,236,198,0.72)');
  rg.addColorStop(0.28, 'rgba(255,226,176,0.40)');
  rg.addColorStop(0.58, 'rgba(255,214,150,0.13)');
  rg.addColorStop(1.00, 'rgba(255,208,140,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, N, N);
  _poolTex = new THREE.CanvasTexture(cv);
  _poolTex.colorSpace = THREE.SRGBColorSpace;
  return _poolTex;
}

function interrogationLamp(x, y, z, sgn){
  const g = new THREE.Group();
  /* 등에 **기구가 없다.** 기둥·팔·갓·전구를 다 만들었다가 지웠다 —
     이 컷에서 그 물건들이 한 일은 전부 방해였다:
       · 전구를 낮게 달면 크레인 카메라의 눈높이에 와서 **렌즈 앞을 막는다**
       · 높이 달면 화면 위쪽에 걸리는데, 그 자리가 하필 **저 아래 우리 사무실 위**라
         「사무실 천장에 등이 하나 떠 있다」로 읽힌다(실제로 그렇게 보였다)
       · 기둥은 화면을 대각선으로 가른다
     빛의 출처를 안 보여도 **빛이 무엇을 하는지는 그대로 보인다** — 위에서 떨어지는
     좁은 빛과 그 안의 둘. 취조실의 그 느낌은 기구가 아니라 그 빛이 만든다.

     sgn 은 카메라가 어느 쪽에 있나(+1 이면 z 가 큰 쪽). 보조광이 그쪽에 서야 한다. */
  /* ── 등은 **멀리, 세게** ── (2026-09-10)
     처음엔 둘 바로 위 3.8m 에 약한 등을 달았다. 가까운 광원은 감쇠(decay 2)가 급해서
     정수리만 하얗게 타고 어깨 아래가 그대로 검다 — 「위에 등이 있다」가 아니라
     「머리에 점이 찍혔다」로 보인다. 멀리 놓고 그만큼 세게 하면 빛이 **고르게** 떨어져서
     둘의 몸 전체가 같은 빛 아래 선다. 취조등이 천장 높이 달려 있는 이유와 같다. */
  const l = new THREE.PointLight(0xFFEBC2, 1500, 38, 2);
  l.position.set(x, y + 8.4, z - 1.2);
  g.add(l);
  /* ── 카메라 쪽에서 하나 더 ──
     위에서만 비추면 빛이 닿는 곳은 둘의 **정수리와 반대편**이다. 카메라가 보는 면(등과
     뒷머리)은 그늘에 남고, 그래서 아무리 세게 비춰도 검은 덩어리 둘이다.
     등을 단 이유가 「냥찰인지 알아보게」였으므로 그건 실패다.
     그래서 카메라 쪽에 하나 더 둔다 — 등과 뒷머리와 **모자**에 걸릴 만큼. */
  /* 카메라 쪽에서 하나 더. 이쪽도 **화면 밖 멀리**다 — 3m 앞에 두었더니 그 광원이
     둘보다 카메라에 가까워서, 셋 중 제일 밝은 것이 아무것도 아닌 허공이었다. */
  const back = new THREE.PointLight(0xC6D6EC, 1250, 50, 2);
  back.position.set(x, y + 6.2, z + 9.5 * (sgn || 1));
  g.add(back);

  /* ── 빛을 **보이게** 한다 (2026-09-10) ──
     광원만 두면 둘의 뒷모습이 여전히 밤 옥상의 검은 덩어리 둘이었다. 광원은 물체를 밝힐 뿐
     공기를 밝히지 않아서, 화면에는 「빛이 있다」는 표시가 아무것도 안 남는다.
     그래서 빛이 하는 일을 **두 장의 판**으로 그린다 — 기구는 여전히 안 만든다
     (위 머리말: 기둥도 갓도 이 컷에서는 렌즈를 막았다).
       · 바닥의 웅덩이 — 옥상 바닥에 깔린 발광 원반. 둘이 그 안에 서 있다
       · 빛기둥 — 위에서 내려오는 옆이 뚫린 원뿔. 아주 옅게(0.055) 얹는다.
         진하게 하면 이게 물건으로 보이고, 그러면 옥상에 원뿔이 하나 서 있는 것이다 */
  /* ── 웅덩이는 **가장자리가 없어야 한다** ──
     처음엔 발광 원반 한 장이었다. 그러면 빛이 아니라 **바닥에 붙인 흰 종이**다 —
     동그란 테두리가 또렷하게 보이고, 그 선은 이 세상에 없는 선이다.
     그래서 가운데가 밝고 밖으로 갈수록 사라지는 그림을 한 장 구워서 얹는다.
     더하기 합성(Additive)이라 어두운 옥상 위에 **빛만 더해진다** — 판이 안 생긴다. */
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4),
    new THREE.MeshBasicMaterial({ map: poolTex(), transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, y + 0.015, z);   // 옥상 슬래브 윗면(ROOF+0.30) 바로 위
  g.add(pool);

  /* 빛기둥(옆이 뚫린 원뿔)도 한 번 얹었다가 **뺐다**(2026-09-10). 카메라가 둘에서
     4.75m 앞이라 반지름 2.35 짜리 원뿔이 화면을 통째로 덮는 삼각형이 됐다 —
     이 파일 머리말이 기둥·갓을 뺀 이유와 같은 실패를 모양만 바꿔서 또 한 것이다.
     웅덩이 하나면 「위에서 빛이 떨어진다」는 다 말한다. */
  return g;
}

/* ============================================================
   세우기
   ============================================================ */
export function build(c){
  clear();
  ctx = c;
  const { scene, W, D } = ctx;
  const px = W + GAP, pz = D + GAP;              // 판 간격
  root = new THREE.Group();
  scene.add(root);

  let seed = 1;
  for (let r = 0; r < GRID; r++)
    for (let cc = 0; cc < GRID; cc++){
      if (cc === CEN.c && r === CEN.r) continue;  // 가운데는 냥찰청
      if (cc === OUR.c && r === OUR.r) continue;  // 여기는 **진짜 방**이 이미 서 있다
      const far = Math.max(Math.abs(cc - CEN.c), Math.abs(r - CEN.r)) > FAR_RING;
      const g = plate(seed++, W, D, far);
      g.position.set((cc - OUR.c) * px, 0, (r - OUR.r) * pz);
      /* 링(체비셰프 거리)으로 솟아오른다 — 가까운 것부터 한 겹씩 */
      g.userData.ring = Math.max(Math.abs(cc - OUR.c), Math.abs(r - OUR.r));
      root.add(g);
    }

  const cen = { x: W / 2 + (CEN.c - OUR.c) * px, z: D / 2 + (CEN.r - OUR.r) * pz };
  const twr = precinct(W, D);
  twr.position.set(cen.x, 0, cen.z);
  /* 청사는 **안 돌린다.** 한 번 반 바퀴 돌려 봤다 — 테라스를 격자 쪽으로 보내려고 한
     건데, 그러면 정면(창 격자·현관·문장)이 통째로 카메라 반대편으로 가서 화면에는
     **건물 뒤통수**만 남는다. 정면은 카메라를 보고, 테라스만 반대쪽에 낸다(precinct). */
  root.add(twr);

  /* ── 창가의 둘 ──
     도 경찰과 김 경찰. **뒷모습이다** — 3장의 카메라가 이 둘의 뒤에 선다.
     조형은 실제 고양이 크기인데 이 컷은 카메라가 크레인에 올라가 있어서, 그대로 두면
     **모자 두 개**로만 읽힌다. 반 배쯤 키운다 — 아무도 재지 않는다. */
  /* 테라스 끝은 -z 쪽이다(edgeZ 가 음수). 둘은 그 끝에서 한 걸음 안쪽에 선다. */
  const cz = cen.z + twr.userData.edgeZ + 1.45;
  /* 취조등은 **둘 바로 위**다. 기구는 없고 빛만 있다(위 함수의 머리말).
     보조광은 카메라 쪽(+z)에 선다. */
  lamp = interrogationLamp(cen.x, ROOF + 0.31, cz - 0.15, +1);
  /* **3장에서만 켠다.** 안 그러면 2장(격자가 솟는 동안) 내내 아직 서지도 않은 청사
     옥상 높이에 흰 웅덩이가 하나 떠 있다 — 실제로 그렇게 나왔다(2026-09-10). */
  lamp.visible = false;
  root.add(lamp);
  cops = [-1.3, 1.3].map(dx => {
    /* 털색은 **순검정이 아니다**(2026-09-10). fur:0 으로 두었더니 등을 아무리 세게 켜도
       둘이 검은 실루엣 그대로였다 — 검정에 빛을 곱하면 검정이다. 등을 3000 까지 올려
       바닥이 하얗게 타는데도 둘만 어두웠던 게 그 이유다.
       숯색이면 밤에는 여전히 검은 고양이로 읽히면서 **빛이 닿은 면과 안 닿은 면**이 생긴다. */
    const a = CS.sculptActor({ fur: 0x363B44 });
    if (a.setGear) a.setGear({ head:'police', neck:'tie' });
    a.setState('idle');
    a.baseY = ROOF + 0.3;
    a.root.scale.setScalar(1.5);
    a.root.position.set(cen.x + dx, a.baseY, cz);
    a.setHeading(Math.PI);              // -z 를 본다 = 격자 쪽 = 카메라 반대쪽
    /* **그 자리에서 못 박는다.** setHeading 은 「그쪽으로 돌아라」이고, 실제 각도는
       update() 가 매 프레임 조금씩 따라간다(dt*9). 그런데 이 둘은 3장에 가서야 보이기
       시작하고 tick 은 보이는 동안만 도니까, 화면에 나타나는 순간의 각도가 0(정면)이고
       거기서부터 반 바퀴 **고양이가 돈다** — 카메라가 도는 장면인데 피사체가 돌면
       무엇이 도는지 알 수 없다. dt 를 크게 한 번 먹이면 그 자리에서 각도가 붙는다. */
    a.update(1);
    root.add(a.root);
    return a;
  });

  /* ---------- 장 ----------
     from/to 는 [카메라 x,y,z, 과녁 x,y,z]. opening.js 의 CH 표와 같은 형식이다.
     좌표는 전부 방 크기로 잰다 — 등급마다 방이 커지므로 상수를 박으면 한 등급에서만 맞는다. */
  const R = { x: W / 2, z: D / 2 };               // 우리 방 가운데
  CH = [
    /* 1. **진짜 우리 방 안.** 낮은 카메라 — 이 게임의 평소 시선이다.
       사람이 산 가구와 바른 벽지가 여기 그대로 있고, 고양이도 앉아 있다. */
    { id:'room', dur:5.0, fadeIn:1.6,
      from:[R.x + W * 0.30, 1.35, R.z + D * 0.34,  R.x - W * 0.06, 0.75, R.z - D * 0.16],
      to:  [R.x + W * 0.40, 3.20, R.z + D * 0.52,  R.x - W * 0.04, 0.62, R.z - D * 0.14],
      sub: null },
    /* 2. 위로 빠진다. 링이 하나씩 솟아오르고, 끝에서 냥찰청이 화면 가운데에 온다.
       **높이보다 거리를 먼저 준다** — 곧바로 위로 뜨면 도면을 보는 것이 되고,
       도면에는 「내 방이 저기 있다」가 없다. */
    { id:'grid', dur:11.0,
      from:[R.x + W * 0.40, 3.20, R.z + D * 0.52,  R.x - W * 0.04, 0.62, R.z - D * 0.14],
      to:  [cen.x + px * 0.10, (W + D) * 2.05, cen.z + pz * 3.05,  cen.x, 4.0, cen.z - pz * 0.75],
      sub: { at:6.4, text:{ ko:'…우리 지점은 서른두 번째였다.',
                            en:'…ours was the thirty-second branch.',
                            ja:'…うちの支店は三十二番目だった。' } } },
    /* 3. 냥찰청 옥상. 카메라는 둘의 **뒤**, 옥상 바닥보다 3.4m 위다.
       ── 이 컷을 세 번 고쳤다. 기하가 걸려 있다 ──
       ① 과녁을 옥상 높이에 두니 화면의 5분의 4가 빈 밤하늘이었다 — 둘은 보이는데
          무엇을 보고 있는지가 안 보인다.
       ② 과녁을 지면으로 내리니 **옥상 바닥이 화면 아래 절반을 먹었다.** 난간 뒤에 서서
          바로 아래를 볼 수는 없다 — 눈높이가 바닥에서 1m 뿐이면 아래를 향한 시선이
          전부 자기가 선 바닥에 막힌다.
       ③ 그래서 카메라를 바닥보다 높이 올렸다. 크레인 숏이다. 둘은 여전히 뒷모습이고,
          그 어깨 위로 난간이 지나가고, 난간 위로 격자가 깔린다.
       화면을 위에서 아래로 읽으면 **밤 → 격자 → 난간 → 둘의 등**이다.
       ④ 그런데 둘에 너무 붙어 있었다(3.3m). 그 거리에서는 **발치의 것이 화면에서 제일 크다** —
          빛 웅덩이든 난간이든 아래 절반을 덮는다.
       ⑤ 6.2m 로 물러섰더니 이번엔 둘이 화면 아래 끝에 **점 두 개**로 남았다.
          4.75m 가 그 사이다: 둘은 아래 삼분의 일에 서고, 등이 그 위에 걸리고,
          그 너머로 격자가 세 줄 들어온다.
       카메라는 거의 안 움직인다 — 여기서 움직이면 「보고 있다」가 「지나간다」가 된다. */
    /* 3. **앞모습 한 번, 그리고 돌아선다.**
       ── 왜 앞을 먼저 보나 ──
       이 컷의 마지막 문장은 「우리는 모두 한낱 카피캣이었다」이고, 그 말을 듣는 자리는
       둘의 **등 뒤**다. 그런데 곧바로 등부터 보여 주면 저 둘이 누구인지 모르는 채로
       끝난다 — 모자 둘이 난간 앞에 서 있는 그림이다. 얼굴을 한 번 보고 나면 그 다음의
       뒷모습이 「등을 보이고 있다」가 된다.
       카메라는 둘 앞(격자 쪽)에서 낮게 시작해 **반 바퀴 돌아** 뒤로 넘어간다.
       직선으로 옮기면 둘을 뚫고 지나가므로, 이 장만 원호로 돈다(seek 의 ch.arc). */
    { id:'face', dur:7.4, cut:true, fov:52, expo:2.0,
      /* turn 앞은 **정면에서 멈춰 서 있다**(2.2초). 처음부터 돌기 시작하면 앞모습이
         스치듯 지나가서, 얼굴을 보여 주려던 장이 「위에서 내려다보는 정수리」로 끝난다.
         눈높이도 그때까지 그대로다 — 높이를 같이 올리면 도는 동안 계속 내려다본다. */
      /* 거리는 **5.6m**. 3.2m 에서는 둘이 화면 좌우 밖으로 나갔다 — 화각 52 의 가로
         반폭이 그 거리에서 1.2m 인데 둘은 중심에서 1.3m 씩 떨어져 서 있다. */
      arc: { cx: cen.x, cz: cz, a0: Math.PI, a1: Math.PI * 0.04,
             r0: 4.9, r1: 5.9, y0: ROOF + 1.45, y1: ROOF + 5.60, hold: 0.66, turn: 0.30 },
      from:[0, 0, 0,  cen.x, ROOF + 1.15, cz],
      to:  [0, 0, 0,  cen.x + 0.2, 0.7, cen.z - pz * 2.10],
      sub: null },
    /* 4. 등 뒤. 3장이 끝난 그 자리에서 이어진다 — 여기서 끊으면 방금 돈 것이 헛돈 것이 된다. */
    { id:'watch', dur:8.6, fadeOut:2.6, fov:56, expo:2.0,
      /* ⑥ 격자를 7×7 로 넓히면서 한 번 더 물러섰다(2026-09-10). 4.75m 에서는 프레임에
         들어오는 줄이 둘뿐이라, 판을 스물세 개 더 세워 놓고도 화면은 그대로였다.
         5.9m·화각 56 이면 둘의 어깨 너머로 **네 줄**이 들어오고 좌우로도 끝이 안 보인다. */
      from:[cen.x + Math.sin(Math.PI * 0.04) * 5.9, ROOF + 5.60, cz + Math.cos(Math.PI * 0.04) * 5.9,
            cen.x + 0.2, 0.7, cen.z - pz * 2.10],
      to:  [cen.x - 0.12, ROOF + 5.35, cz + 5.20,  cen.x + 0.2, 0.5, cen.z - pz * 2.20],
      sub: { at:3.0, text:{ ko:'우리는 모두 한낱 카피캣에 불과했다.',
                            en:'We were all only copycats.',
                            ja:'私たちは皆、ただのコピーキャットだった。' } } },
  ];
  DUR = CH.reduce((a, x) => a + x.dur, 0);

  /* ── 시작화면의 정경 (컷신에 안 들어간다) ──
     엔딩을 본 사람의 첫 화면이다(js/title.js). **엔딩의 마지막 장면 그대로**다:
     둘의 뒷모습이 제일 가까이 있고, 그 너머로 무수한 사무실이 깔린다.

     한 번은 높이 떠서 격자만 내려다보는 그림으로 잡아 봤다. 격자는 잘 보이는데
     **그 컷에는 보는 사람이 없다** — 이 게임의 마지막 화면은 「사무실이 많다」가 아니라
     「누군가 그걸 보고 있다」이므로, 둘이 프레임 안에 있어야 한다.

     3장의 카메라를 그대로 쓰지는 않는다: 그건 컷신의 마지막 호흡이라 둘에 붙어 있고
     격자가 두 줄뿐이다. 여기서는 **더 높이·더 뒤로** 물러서 둘을 아래 삼분의 일에 두고
     그 너머로 세 줄이 들어오게 한다. 로고는 그 사이의 어두운 하늘에 앉는다. */
  VISTA = {
    pos: [cen.x - 0.10, ROOF + 6.9, cz + 6.7],
    target: [cen.x + 0.20, 0.5, cen.z - pz * 2.3],
    fov: 60, expo: 2.0,
  };
  seek(0);
  return { dur: DUR, plates: root.children.length, cell:[px, pz] };
}

/* 링이 솟아오르는 시각(2장 기준 초). 1장에서 옆방이 올라오면
   「내 방 하나뿐」이라는 시작이 깨진다.
   격자를 7×7 로 넓히면서 표를 **셈으로** 바꿨다 — 겹 수가 방 위치에 따라 달라지므로
   (우리 방은 가운데가 아니다) 상수 다섯 개짜리 표는 바깥 겹에서 그냥 undefined 였다.
   뒤로 갈수록 간격을 좁힌다: 마지막 겹까지 같은 박자로 세면 2장이 안 끝난다. */
const RISE_DUR = 2.2;
const riseAt = ring => ring <= 0 ? 0 : 1.1 + (ring - 1) * 1.45;

/* 시각 하나를 주면 그 순간의 카메라·자막·암전을 돌려준다.
   **그리지는 않는다** — 그리는 것은 render3d 의 draw() 다(그 방을 그리는 그 손). */
export function seek(t){
  if (!root) return null;
  t = Math.max(0, Math.min(DUR, t));
  let acc = 0, ch = CH[0], local = 0;
  for (const c of CH){
    if (t < acc + c.dur || c === CH[CH.length - 1]){ ch = c; local = t - acc; break; }
    acc += c.dur;
  }
  local = Math.max(0, Math.min(ch.dur, local));
  const k = smooth(local / ch.dur);

  const gridT = ch.id === 'room' ? 0 : (ch.id === 'grid' ? local : 99);
  /* 옥상의 둘과 등은 **3장(앞모습)부터** 보인다. 4장만으로 잡아 두면 카메라가 이미
     옥상에 올라와 있는데 옥상이 비어 있다. */
  const onRoof = ch.id === 'face' || ch.id === 'watch';
  for (const g of root.children){
    if (g.userData.ring === undefined) continue;
    const p = Math.max(0, Math.min(1, (gridT - riseAt(g.userData.ring)) / RISE_DUR));
    g.visible = p > 0;
    g.position.y = lerp(-4.0, 0, smooth(p));
  }
  /* 냥찰청은 링 둘이 올라온 다음에 선다 — 마지막에 남는 것이라 마지막에 온다 */
  const twr = root.children.find(o => o.userData.edgeZ !== undefined);
  if (twr){
    const tp = Math.max(0, Math.min(1, (gridT - 3.8) / 3.0));
    twr.visible = tp > 0 || onRoof;
    twr.position.y = onRoof ? 0 : lerp(-ROOF - 1, 0, smooth(tp));
  }
  for (const a of cops) a.root.visible = onRoof;
  if (lamp) lamp.visible = onRoof;

  let fade = 0;
  if (ch.fadeIn && local < ch.fadeIn) fade = 1 - local / ch.fadeIn;
  if (ch.cut && local < 0.9) fade = Math.max(fade, 1 - local / 0.9);
  if (ch.fadeOut && local > ch.dur - ch.fadeOut) fade = Math.max(fade, (local - (ch.dur - ch.fadeOut)) / ch.fadeOut);

  /* 카메라 자리. 보통은 두 점 사이를 잇지만, 원호가 적힌 장은 **둘을 중심으로 돈다** —
     앞에서 뒤로 직선으로 가면 그 선이 둘을 관통한다(3장의 주석). */
  const A = ch.arc;
  const ease = (v, from) => smooth(Math.max(0, Math.min(1, (v - from) / (1 - from))));
  const pos = A
    ? (() => { const a = ease(k, A.turn || 0);
               const ang = lerp(A.a0, A.a1, a), rr = lerp(A.r0, A.r1, a);
               return [A.cx + Math.sin(ang) * rr, lerp(A.y0, A.y1, a), A.cz + Math.cos(ang) * rr]; })()
    : [lerp(ch.from[0], ch.to[0], k), lerp(ch.from[1], ch.to[1], k), lerp(ch.from[2], ch.to[2], k)];

  /* 과녁은 **원호가 거의 다 돌 때까지 둘에 머문다.** 자리와 같은 속도로 옮기면 반 바퀴의
     중간에서 과녁이 카메라 뒤로 넘어간다 — 카메라는 옥상 앞에 있는데 시선은 격자 쪽을
     향해서, 앞모습을 보여 주기로 한 장이 **판때기만 비추고 지나갔다**(실측 2026-09-10). */
  const tk = A ? ease(k, A.hold || 0.6) : k;

  return {
    id: ch.id,
    pos,
    target: [lerp(ch.from[3], ch.to[3], tk), lerp(ch.from[4], ch.to[4], tk), lerp(ch.from[5], ch.to[5], tk)],
    fov: ch.fov || null, expo: ch.expo || null, fade,
    sub: (ch.sub && local >= ch.sub.at) ? ch.sub.text : null,
    done: t >= DUR - 0.001,
  };
}

/* 고양이 숨쉬기·꼬리. 옥상의 둘만 움직인다 — 방 안의 고양이는 게임이 돌린다. */
export function tick(dt, camera){
  for (const a of cops) if (a.root.visible) a.update(dt, camera);
}

/* 정지 정경 한 컷. 격자와 청사를 다 올려 두고 카메라만 돌려준다. */
export function vista(){
  if (!root || !VISTA) return null;
  for (const g of root.children){
    if (g.userData.ring === undefined) continue;
    g.visible = true; g.position.y = 0;
  }
  const twr = root.children.find(o => o.userData.edgeZ !== undefined);
  if (twr){ twr.visible = true; twr.position.y = 0; }
  for (const a of cops) a.root.visible = true;
  if (lamp) lamp.visible = true;
  return { id:'vista', pos:VISTA.pos, target:VISTA.target, fov:VISTA.fov, expo:VISTA.expo,
           fade:0, sub:null, done:false };
}

export function dur(){ return DUR; }
export function chapters(){ return CH.map(c => ({ id:c.id, dur:c.dur })); }
export function playing(){ return !!root; }

export function clear(){
  if (root && ctx) ctx.scene.remove(root);
  root = null; cops = []; lamp = null; CH = []; DUR = 0; VISTA = null; ctx = null;
}
