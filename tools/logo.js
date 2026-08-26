/* ============================================================
   logo.js — copycat 의 얼굴을 **쓰는 곳마다 맞는 모양으로** 낸다.

   그림 자체는 여기서 그리지 않는다. **게임이 구운 검은 고양이**(assets/logo-cat.png,
   tools/bake-logo.js 가 게임 렌더러로 굽는다)를 받아서, 그 위에 eerie 의 나머지 절반인
   **어두운 방**을 씌운다. 구운 고양이만으로는 eerie 가 아니다 — 그 그림체는
   "스탠드 하나 켠 방" 이고, 방이 없으면 조명만 남는다.

   손으로 그린 로고를 안 쓰는 이유: 게임 안 고양이와 안 닮고, 그림체를 바꿀 때 로고만
   안 따라온다. 실제로 그랬다 — eerie 로 옮긴 뒤에도 상단바에 주황색 스티커가 남아 있었다.

   ── 쓰는 곳이 요구하는 모양이 다르다 ──
     · 웹·안드로이드 일반   둥근 모서리 그대로
     · 안드로이드 maskable  런처가 원·물방울로 깎는다 → 내용을 안쪽으로 크게 물린다
     · 아이폰               iOS 가 모서리를 직접 깎는다 → **각진 정사각형**
     · 상단바               모서리는 CSS 가 깎는다 → 각진 판으로 주고 CSS 가 자른다

   실행:
     node tools/logo.js            아이콘을 쓰고, index.html·style.css 의 표시 구간을
                                   갈아 끼운다 (세 곳이 갈리지 않게)
     node tools/logo.js --print    상단바용 데이터 URI 만 찍는다
   ============================================================ */
const fs = require('fs'), path = require('path');
const { decodePNG, encodePNG, resample } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'logo-cat.png');

/* ---------- 색 ----------
   js/three/eerie.js 의 팔레트와 같은 계열. 판을 순검정으로 두지 않는 이유는 둘이다:
   홈 화면에서 아이콘이 구멍처럼 보이고, 검은 고양이의 실루엣이 대비를 잃는다.
   (게임도 같은 이유로 검정 털을 0x4A4550 으로 쓴다 — "순검정은 형태가 아니라 구멍이 된다") */
/* 판은 **사무실 바닥색**이다(eerie PALETTE 의 floor 0xC7BAA7, 따뜻한 오트밀).
   처음엔 어두운 판(0x241C15)에 얹었는데 **검은 고양이가 덩어리로 읽혔다** —
   검정은 어두운 데서 형태를 잃는다. 게임에서 이 고양이가 실제로 어디에 서 있는지 보면
   답이 나온다: 밝은 오트밀 바닥이다. 그 대비를 그대로 가져오면 eerie 를 벗어나지 않고
   16px 에서도 실루엣이 산다. */
const PLATE = [0xC7, 0xBA, 0xA7];
const VIGNETTE = 0.20;      // 구석을 떨어뜨린다 — 방의 안개. eerie 후처리의 서명이다

let _src = null;
function src(){
  if (_src) return _src;
  if (!fs.existsSync(SRC))
    throw new Error('assets/logo-cat.png 이 없다 — node tools/bake-logo.js 먼저 (서버가 떠 있어야 한다)');
  _src = decodePNG(fs.readFileSync(SRC));
  return _src;
}

/* 아이콘 한 장을 RGBA 로.
   pad    고양이를 안쪽으로 물리는 비율(0~0.4)
   round  판 모서리 반지름 비율. 0 이면 각진 정사각형
   plate  false 면 판을 안 칠하고 고양이만 남긴다 */
function drawRGBA(size, opt){
  const { pad = 0.06, round = 0.22, plate = true } = opt || {};
  const S = size, out = Buffer.alloc(S * S * 4);
  const R = round * S;
  const inRound = (x, y) => {
    if (R <= 0) return x >= 0 && y >= 0 && x < S && y < S;
    const cx = Math.min(Math.max(x, R), S - R), cy = Math.min(Math.max(y, R), S - R);
    return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
  };
  const cover = (x, y) => {
    let n = 0;
    for (let sy = 0; sy < 4; sy++)
      for (let sx = 0; sx < 4; sx++)
        if (inRound(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
    return n / 16;
  };

  /* 판 — 가운데가 밝고 구석이 떨어진다. 게임 화면의 비네트와 같은 문법이라
     아이콘과 화면이 같은 방에서 온 것으로 보인다. */
  if (plate){
    const half = S / 2;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++){
        const cov = cover(x, y);
        if (!cov) continue;
        const i = (y * S + x) * 4;
        const d = Math.hypot((x + 0.5 - half) / half, (y + 0.5 - half) / half) / Math.SQRT2;
        const k = 1 - VIGNETTE * d * d;
        out[i] = Math.round(PLATE[0] * k); out[i+1] = Math.round(PLATE[1] * k);
        out[i+2] = Math.round(PLATE[2] * k); out[i+3] = Math.round(255 * cov);
      }
  }

  /* 고양이를 얹는다. 판 밖으로는 안 나가게 자른다 — 각진 판에서 귀가 삐져나오면
     iOS 가 모서리를 깎을 때 그 자리에 잘린 획이 남는다. */
  const s = src();
  const inner = Math.max(1, Math.round(S * (1 - pad * 2))), off = Math.round(S * pad);
  const cat = resample(s.w, s.h, s.rgba, inner, inner);
  for (let y = 0; y < inner; y++)
    for (let x = 0; x < inner; x++){
      const dx = x + off, dy = y + off;
      if (dx < 0 || dy < 0 || dx >= S || dy >= S) continue;
      if (plate && !inRound(dx + 0.5, dy + 0.5)) continue;
      const si = (y * inner + x) * 4, di = (dy * S + dx) * 4;
      const a = cat[si + 3] / 255;
      if (a <= 0.002) continue;
      const ba = out[di + 3] / 255;
      const na = a + ba * (1 - a);
      for (let c = 0; c < 3; c++)
        out[di + c] = Math.round((cat[si + c] * a + out[di + c] * ba * (1 - a)) / na);
      out[di + 3] = Math.round(na * 255);
    }
  return out;
}

/* 시작 화면의 바탕 — **로딩 화면과 같은 크림**이다(style.css 의 --cream).
   전에는 어두운 #171310 이었는데, 로딩 화면이 크림이 되면서 폰의 실행 사슬이
   **어두운 스플래시 → 크림 로딩 → 어두운 게임**으로 가운데가 번쩍였다.
   스플래시가 로딩 화면과 같은 색·같은 그림이면 그 둘이 한 화면처럼 이어진다. */
const CREAM = [0xFF, 0xF6, 0xE9];
const LOADCAT = path.join(__dirname, '..', 'assets', 'loading-cat.png');

/* 아이폰 시작 화면. 없으면 켤 때마다 **흰 화면이 번쩍인다.**
   그림은 로딩 화면의 그 고양이를 그대로 쓴다 — 스피너와 글자만 없는 같은 화면이라,
   앱을 켜면 스플래시가 로딩 화면으로 **바뀌지 않고 이어진다**(스피너만 돌기 시작한다).

   pw/ph 는 기기 픽셀, cssW 는 그 기기의 CSS 폭이다. 셋 다 받는 이유는 고양이를
   **style.css 와 같은 비율**로 앉히기 위해서다 — 크기를 따로 정하면 스플래시에서
   로딩 화면으로 넘어갈 때 고양이가 한 번 튄다. */
function splashPNG(pw, ph, cssW){
  const rgba = Buffer.alloc(pw * ph * 4);
  for (let i = 0; i < pw * ph; i++){
    rgba[i*4] = CREAM[0]; rgba[i*4+1] = CREAM[1]; rgba[i*4+2] = CREAM[2]; rgba[i*4+3] = 255;
  }
  const blit = (S, W, H, src) => {   // src: RGBA W×H, 가운데에 얹는다(S 는 위로 밀 픽셀)
    const ox = Math.round((pw - W) / 2), oy = Math.round((ph - H) / 2 - S);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++){
        const sx = (y * W + x) * 4;
        const px = ox + x, py = oy + y;
        if (px < 0 || py < 0 || px >= pw || py >= ph) continue;
        const d = (py * pw + px) * 4, a = src[sx+3] / 255;
        for (let c = 0; c < 3; c++)
          rgba[d+c] = Math.round(rgba[d+c] * (1 - a) + src[sx+c] * a);
      }
  };

  let done = false;
  if (fs.existsSync(LOADCAT)){
    const { w, h, rgba: cat } = decodePNG(LOADCAT);
    /* style.css: .lcat 은 폭 236px, 700px 이하에서 190px. 그 비율을 그대로 옮긴다. */
    const cssCat = (cssW && cssW <= 700) ? 190 : 236;
    const k = pw / (cssW || pw);                     // 기기 픽셀 / CSS 픽셀
    const W = Math.max(8, Math.round(cssCat * k)), H = Math.round(W * h / w);
    /* 로딩 화면은 고양이 + 20px 틈 + 글자 한 줄을 한 기둥으로 가운데 세운다.
       그래서 고양이의 중심은 화면 가운데보다 그 절반만큼 **위**에 있다. */
    const up = Math.round((20 + 19) / 2 * k);
    blit(up, W, H, resample(w, h, cat, W, H));
    done = true;
  }
  /* 구운 그림이 없으면(bake-loading-cat.js 를 안 돌린 트리) 로고로 대신한다 —
     빌드가 멈추는 것보다 낫고, 색은 이미 크림이라 이어짐은 지켜진다. */
  if (!done){
    const S = Math.round(Math.min(pw, ph) * 0.26);
    blit(0, S, S, drawRGBA(S, { pad:0.10, round:0.22 }));
  }
  return encodePNG(pw, ph, rgba);
}

const png = (size, opt) => encodePNG(size, size, drawRGBA(size, opt));
const dataURI = (size, opt) => 'data:image/png;base64,' + png(size, opt).toString('base64');

module.exports = { PLATE, drawRGBA, png, dataURI, splashPNG };

/* ---------- 쓰는 곳을 갈아 끼운다 ----------
   표시 주석(LOGO:BEGIN/END) 사이만 바꾼다. 손으로 세 곳을 맞추던 것을 도구가 맞추게 하는 것이
   이 파일이 있는 이유다 — build-atlas.js 가 js/atlas.js 를 쓰는 것과 같은 규칙이다. */
if (require.main === module){
  if (process.argv.includes('--print')){ console.log(dataURI(80, { pad: 0.02, plate: false })); process.exit(0); }

  const ICONS = path.join(ROOT, 'assets', 'icons');
  fs.mkdirSync(ICONS, { recursive: true });
  const JOBS = [
    /* 여백 0.10 — 0.06 은 귀가 위 테두리에 닿았다 */
    /* 웹·PWA 아이콘 — **투명.** 크롬은 알파를 그대로 받는다 */
    ['icon-192.png',              192,  { pad:0.06, plate:false }],
    ['icon-512.png',              512,  { pad:0.06, plate:false }],
    /* maskable 은 **정의상 꽉 찬 배경**이 필요하다 — 런처가 원·물방울로 깎으면서
       그 자리를 자기 색으로 안 메운다. 그래서 여기만 판을 남긴다. */
    ['icon-maskable-192.png',     192,  { pad:0.22, round:0 }],
    ['icon-maskable-512.png',     512,  { pad:0.22, round:0 }],
    /* 아이폰도 판을 남긴다 — iOS 는 apple-touch-icon 의 알파를 **검정으로 깔아 버린다.**
       어두운 고양이가 검정 위에 앉으면 홈 화면에서 그냥 사라진다. */
    ['apple-touch-icon.png',      180,  { pad:0.10, round:0 }],
    ['apple-touch-icon-1024.png', 1024, { pad:0.10, round:0 }],
  ];
  for (const [name, size, opt] of JOBS){
    const buf = png(size, opt);
    fs.writeFileSync(path.join(ICONS, name), buf);
    console.log('  ' + name.padEnd(28) + size + '×' + size + '  ' + (buf.length / 1024).toFixed(1) + 'KB');
  }

  const patch = (file, begin, end, body) => {
    const p = path.join(ROOT, file);
    const s = fs.readFileSync(p, 'utf8');
    const i = s.indexOf(begin), j = s.indexOf(end);
    if (i < 0 || j < 0) throw new Error(file + ' 에 ' + begin + ' 표시가 없다');
    fs.writeFileSync(p, s.slice(0, i + begin.length) + '\n' + body + '\n' + s.slice(j));
    console.log('  ' + file);
  };

  /* 파비콘은 32px 로 뜨지만 2배 화면을 위해 64 로 낸다. 자기 모서리를 갖는다(CSS 가 없는 자리다). */
  patch('index.html', '<!-- LOGO:BEGIN 생성: node tools/logo.js -->', '<!-- LOGO:END -->',
        '<link rel="icon" href="' + dataURI(64, { pad: 0.02, plate: false }) + '">');

  /* 상단바는 36px(위젯 20px)에 3배 화면까지 있으므로 80px 로 낸다.
     **테두리와 그림자를 뺐다.** 배경이 투명해졌으니 테두리는 아무것도 안 감싸는 액자가 되고,
     그림자는 고양이가 아니라 빈 네모에 걸린다. 고양이가 상단바에 직접 앉는다. */
  patch('style.css', '/* LOGO:BEGIN 생성: node tools/logo.js */', '/* LOGO:END */',
        '.brand .logo{width:36px;height:36px;flex:0 0 auto;'
      + '  background:url("' + dataURI(80, { pad: 0.02, plate: false }) + '") center/100% 100% no-repeat}');
}
