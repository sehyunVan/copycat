/* ============================================================
   gif.js — 애니메이션 GIF 인코더 (의존성 없음)

   이 저장소는 빌드도 라이브러리도 안 쓴다는 규칙으로 굴러간다. 스토어에 올릴
   "고양이가 서류를 물고 가는" 한 장면을 만들자고 그 규칙을 깨고 싶지 않아서 직접 쓴다.

   크기를 줄이는 수단이 둘이다. 사무실 장면은 대부분 정지해 있고 고양이만 움직인다.
     1) 프레임마다 바뀐 영역의 사각형만 담는다
     2) 그 안에서도 앞 프레임과 같은 픽셀은 투명으로 비운다 (dispose=1, 남겨 두기)
   덕분에 LZW가 긴 런을 만나 파일이 몇 배로 작아진다.
   ============================================================ */

/* ---------- 팔레트 ---------- */
/* 도트 그림이라 색 수가 적다. 256색 안이면 그대로 쓰고, 넘치면 median cut 으로 줄인다. */
function buildPalette(frames, reserveTransparent){
  const want = reserveTransparent ? 255 : 256;
  const counts = new Map();
  for (const f of frames)
    for (let i = 0; i < f.length; i += 4)
      { const k = (f[i] << 16) | (f[i+1] << 8) | f[i+2]; counts.set(k, (counts.get(k) || 0) + 1); }

  let pal;
  if (counts.size <= want){
    pal = [...counts.keys()].map(k => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
  } else {
    // median cut — 가장 넓게 퍼진 채널로 상자를 반씩 가른다
    let boxes = [[...counts.keys()]];
    while (boxes.length < want){
      let bi = -1, bs = -1;
      boxes.forEach((b, i) => {
        if (b.length < 2) return;
        const s = spread(b);
        if (s.range > bs){ bs = s.range; bi = i; }
      });
      if (bi < 0) break;
      const b = boxes[bi], s = spread(b);
      b.sort((p, q) => ((p >> s.shift) & 255) - ((q >> s.shift) & 255));
      boxes.splice(bi, 1, b.slice(0, b.length >> 1), b.slice(b.length >> 1));
    }
    pal = boxes.map(b => {
      let r = 0, g = 0, bl = 0, n = 0;
      for (const k of b){ const w = counts.get(k); r += ((k >> 16) & 255) * w; g += ((k >> 8) & 255) * w; bl += (k & 255) * w; n += w; }
      return [Math.round(r/n), Math.round(g/n), Math.round(bl/n)];
    });
  }
  function spread(b){
    let lo = [255,255,255], hi = [0,0,0];
    for (const k of b){
      const c = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
      for (let i = 0; i < 3; i++){ if (c[i] < lo[i]) lo[i] = c[i]; if (c[i] > hi[i]) hi[i] = c[i]; }
    }
    const d = [hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]];
    const m = d.indexOf(Math.max(...d));
    return { range: d[m], shift: [16, 8, 0][m] };
  }

  /* 정확히 같은 색은 캐시로 바로 찾는다. 도트 그림은 거의 다 캐시에 걸린다. */
  const cache = new Map();
  pal.forEach((c, i) => cache.set((c[0] << 16) | (c[1] << 8) | c[2], i));
  const lookup = k => {
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pal.length; i++){
      const d = (pal[i][0]-r)**2 + (pal[i][1]-g)**2 + (pal[i][2]-b)**2;
      if (d < bd){ bd = d; best = i; }
    }
    cache.set(k, best);
    return best;
  };
  return { pal, lookup };
}

/* ---------- LZW ---------- */
function lzw(minCodeSize, indices){
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let codeSize = minCodeSize + 1, next = eoi + 1;
  let dict = new Map();
  const out = [];
  let cur = 0, bits = 0;
  const emit = c => {
    cur |= c << bits; bits += codeSize;
    while (bits >= 8){ out.push(cur & 0xff); cur >>>= 8; bits -= 8; }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++){
    const k = indices[i], key = prefix * 4096 + k;
    const hit = dict.get(key);
    if (hit !== undefined){ prefix = hit; continue; }
    emit(prefix);
    if (next === 4096){                       // 사전이 꽉 찼다 — 비우고 다시
      emit(clear); dict = new Map(); next = eoi + 1; codeSize = minCodeSize + 1;
    } else {
      // 폭을 넓히는 시점이 디코더와 한 칸이라도 어긋나면 스트림 전체가 깨진다.
      // 새 코드를 넣기 "전에" 넓힌다 — 디코더가 기대하는 순서가 이쪽이다.
      if (next >= (1 << codeSize) && codeSize < 12) codeSize++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) out.push(cur & 0xff);
  return Buffer.from(out);
}
function subBlocks(data){
  const parts = [];
  for (let p = 0; p < data.length; p += 255){
    const s = data.subarray(p, p + 255);
    parts.push(Buffer.from([s.length]), s);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

/* ---------- 조립 ----------
   frames: [{ rgba(Buffer), delayMs }]  · 전부 같은 w×h */
function encodeGIF(w, h, frames, { loop = 0, diff = true } = {}){
  const { pal, lookup } = buildPalette(frames.map(f => f.rgba), diff);
  const TRANS = diff ? pal.length : -1;                  // 투명은 팔레트 맨 뒤 한 칸
  const size = Math.max(2, Math.ceil(Math.log2(Math.max(2, pal.length + (diff ? 1 : 0)))));
  const gctLen = 1 << size;

  const gct = Buffer.alloc(gctLen * 3);
  pal.forEach((c, i) => { gct[i*3] = c[0]; gct[i*3+1] = c[1]; gct[i*3+2] = c[2]; });

  const head = Buffer.alloc(13);
  head.write('GIF89a', 0);
  head.writeUInt16LE(w, 6); head.writeUInt16LE(h, 8);
  head[10] = 0x80 | ((size - 1) & 7);                    // GCT 있음 + 크기
  head[11] = 0; head[12] = 0;

  const netscape = Buffer.from([
    0x21, 0xFF, 0x0B, ...Buffer.from('NETSCAPE2.0', 'ascii'),
    0x03, 0x01, loop & 255, (loop >> 8) & 255, 0x00,
  ]);

  const parts = [head, gct, netscape];
  let prev = null;
  for (const f of frames){
    // 바뀐 영역만 — 앞 프레임과 다른 픽셀의 바운딩 박스
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    if (prev && diff){
      x0 = w; y0 = h; x1 = -1; y1 = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++){
          const o = (y * w + x) * 4;
          if (f.rgba[o] !== prev[o] || f.rgba[o+1] !== prev[o+1] || f.rgba[o+2] !== prev[o+2]){
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      if (x1 < 0){ x0 = y0 = 0; x1 = y1 = 0; }           // 완전히 같은 프레임 — 1px만 담는다
    }
    const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
    const idx = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++){
        const o = ((y + y0) * w + (x + x0)) * 4;
        const same = prev && diff && f.rgba[o] === prev[o] && f.rgba[o+1] === prev[o+1] && f.rgba[o+2] === prev[o+2];
        idx[y * fw + x] = same ? TRANS : lookup((f.rgba[o] << 16) | (f.rgba[o+1] << 8) | f.rgba[o+2]);
      }

    const delay = Math.max(2, Math.round(f.delayMs / 10));   // 1/100초
    const gce = Buffer.from([
      0x21, 0xF9, 0x04,
      (diff ? 1 : 2) << 2 | (diff ? 1 : 0),                  // dispose=남겨두기 + 투명색 사용
      delay & 255, (delay >> 8) & 255,
      diff ? TRANS : 0, 0x00,
    ]);
    const desc = Buffer.alloc(10);
    desc[0] = 0x2C;
    desc.writeUInt16LE(x0, 1); desc.writeUInt16LE(y0, 3);
    desc.writeUInt16LE(fw, 5); desc.writeUInt16LE(fh, 7);
    desc[9] = 0;                                             // 지역 팔레트 없음
    const minCode = Math.max(2, size);
    parts.push(gce, desc, Buffer.from([minCode]), subBlocks(lzw(minCode, idx)));
    prev = f.rgba;
  }
  parts.push(Buffer.from([0x3B]));
  return Buffer.concat(parts);
}

module.exports = { encodeGIF };
