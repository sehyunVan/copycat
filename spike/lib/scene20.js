/* c7 의 장면 정의. 전체 화면판(c7)과 위젯판(c8)이 같은 사무실을 봐야 하므로
   한 군데 두고 둘이 가져다 쓴다. */

const FUR = [0xE8E2DA, 0xC9BFC9, 0x9A93A4, 0xE8C9A0, 0xD8A9A0, 0x7E7887, 0xE8A657, 0xB7C6D8];

export const SCENE = {
  name: 'c7 · 20마리 실전 (수직 활용)',
  note: 'c4 배치 + k8 ⑧ 캐릭터 + 고양이 20마리. 380px 에서 읽히는가, 드로우콜은 몇인가.',
  room: { W:10, D:8, wallH:2.8 },
  camera: { az:0.72, el:0.50, pad:0.3 },
  /* 2D 판도 같은 거짓말을 한다 — 실제 비율대로 두면 한 칸의 절반이라 안 읽힌다.
     3D 에서는 가구가 물리적으로 가리기까지 해서 더 키워야 한다. */
  catScale: 1.05,
  floorAt: (x, z) => (x >= 6 && z >= 5) ? 0xE7BFB8 : ((x + z) % 2 ? 0xF3E9DE : 0xEBDCCF),

  build(c){
    const { LP, put } = c;

    /* --- 위쪽 --- */
    c.onWallN(LP.catwalk(4.2), 2.6, 1.75);
    c.onWallN(LP.catwalk(2.6), 7.6, 2.15);
    c.onWallW(LP.catwalk(3.4), 2.4, 1.95);
    c.onWallW(LP.wallShelf(1.4), 5.6, 1.45);
    c.onWallN(LP.wallShelf(1.3), 5.6, 1.30);
    c.onWallN(LP.wallClock(), 6.9, 2.55);
    c.onWallW(LP.wallArt(0.5, 0.6, 0xA8B8E0), 6.9, 1.95);

    c.lamp(put(LP.pendant(0.9), 3.0, 2.2, 0, 2.8));
    c.lamp(put(LP.pendant(1.1), 6.6, 2.2, 0, 2.8));
    c.lamp(put(LP.pendant(0.8), 8.0, 6.0, 0, 2.8));

    const towerA = put(LP.catTower(), 9.2, 3.4, -0.6);
    const towerB = put(LP.catTower(), 1.0, 6.9, 0.5);

    /* --- 바닥 --- */
    const pods = [c.pod(2.6, 1.4), c.pod(6.2, 1.4), c.pod(2.6, 4.0), c.pod(6.2, 4.0)];
    c.lamp(put(LP.lamp(), 3.7, 1.3, -0.4, 0.65));
    c.lamp(put(LP.lamp(), 7.3, 4.0, -0.4, 0.65));
    put(LP.mug(0xA8D3A0), 2.0, 1.3, 0, 0.67);
    put(LP.mug(0xF0A9A0), 5.6, 1.3, 0, 0.67);

    put(LP.rug(2.8, 2.2, 0xE7BFB8), 7.8, 6.2);
    put(LP.napBox(), 6.6, 6.4, 0.3);
    put(LP.cushion(0xA8B8E0), 8.6, 6.6, 0.2);
    put(LP.blanket(0xF0A9A0), 8.0, 7.2, -0.3);
    put(LP.coffee(), 0.8, 3.4, 0.4);
    put(LP.cooler(), 0.7, 4.6, 0.3);
    put(LP.shelf(), 4.6, 0.45);
    put(LP.docStack(5), 4.8, 6.4, 0.3);
    put(LP.catnip(), 9.2, 7.2, -0.4);
    put(LP.inbox(), 9.3, 5.2, -0.5);
    put(LP.plant(), 0.7, 0.8);
    put(LP.plant(), 9.3, 0.8, 0.4);
    put(LP.plant(), 3.4, 7.3, -0.2);
    put(LP.snackBowl(), 5.4, 7.4);

    /* --- 20마리 ---
       8은 자리에서 근무, 4는 캣워크 위, 2는 캣타워, 2는 자는 중, 4는 돌아다닌다.
       "고양이가 전부 화장실에 가 있으면 서류는 그냥 쌓인다" 가 이 게임의 규칙이다. */
    let n = 0;
    const F = () => FUR[n++ % FUR.length];

    pods.forEach(p => [-0.45, 0.55].forEach(dx => {
      /* 의자보다 살짝 앞에 앉힌다. 같은 자리에 두면 등받이가 카메라와 고양이 사이에 서서
         직원이 통째로 사라진다 — 2D 에서는 깊이 정렬로 해결되던 문제다. */
      c.cat(F(), p.position.x + dx, p.position.z + 0.86, Math.PI, 'sit', 0.47);
    }));

    // 캣워크 — 3D 로 가면 생기는 자리. 여기 앉은 애들은 가구에 안 가린다
    c.cat(F(), 2.0, 0.30, 2.3, 'sit', 1.79);
    c.cat(F(), 3.9, 0.30, 1.9, 'sleep', 1.79);
    c.cat(F(), 7.4, 0.30, 2.6, 'idle', 2.19);
    c.cat(F(), 0.30, 2.0, 1.4, 'sit', 1.99);

    c.cat(F(), towerA.position.x + 0.16, towerA.position.z + 0.10, -1.1, 'sit', 1.34);
    c.cat(F(), towerB.position.x - 0.18, towerB.position.z, 0.7, 'sleep', 0.78);

    c.cat(F(), 6.6, 6.4, 0.4, 'sleep', 0.12);
    c.cat(F(), 8.6, 6.6, -0.5, 'sleep', 0.16);

    c.walker(F(), 5.4, 5.4, 2.4, 3.0);
    c.walker(F(), 8.6, 2.2, 4.6, 7.0);
    c.walker(F(), 1.4, 5.6, 6.0, 2.6);
    c.walker(F(), 7.0, 7.4, 2.0, 2.4);
  },
};
