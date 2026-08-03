/* ============================================================
   png.js — PNG 읽기/쓰기. 의존성 없음.

   이 폴더의 도구 셋(아틀라스 빌더 · 스프라이트 감사 · 스토어 캡처)이 전부 PNG를
   뜯어봐야 해서 여기 한 벌만 둔다. 복사본이 세 개가 되면 언젠가 하나만 고치게 된다.
   ============================================================ */
const fs = require('fs'), zlib = require('zlib');

/* 어떤 컬러 타입으로 저장돼 있든 RGBA 한 가지로 통일해서 돌려준다. */
function decodePNG(fileOrBuffer){
  const d = Buffer.isBuffer(fileOrBuffer) ? fileOrBuffer : fs.readFileSync(fileOrBuffer);
  let p = 8, w = 0, h = 0, bd = 0, ct = 0, idat = [], plte = null, trns = null;
  while (p < d.length){
    const len = d.readUInt32BE(p), type = d.toString('ascii', p + 4, p + 8);
    const data = d.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('8비트 채널만 지원한다 (bitDepth=' + bd + ')');
  const ch = { 0:1, 2:3, 3:1, 4:2, 6:4 }[ct];
  if (!ch) throw new Error('지원하지 않는 컬러 타입 ' + ct);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
  };
  for (let y = 0; y < h; y++){
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++){
      const a = i >= ch ? out[y * stride + i - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = (i >= ch && y > 0) ? out[(y - 1) * stride + i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1; else if (ft === 4) v += paeth(a, b, c);
      out[y * stride + i] = v & 0xff;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++){
    let r, g, b, a = 255;
    if (ct === 6){ r = out[i*4]; g = out[i*4+1]; b = out[i*4+2]; a = out[i*4+3]; }
    else if (ct === 2){ r = out[i*3]; g = out[i*3+1]; b = out[i*3+2]; }
    else if (ct === 4){ r = g = b = out[i*2]; a = out[i*2+1]; }
    else if (ct === 0){ r = g = b = out[i]; }
    else { const x = out[i]; r = plte[x*3]; g = plte[x*3+1]; b = plte[x*3+2];
           a = trns && x < trns.length ? trns[x] : 255; }
    rgba[i*4] = r; rgba[i*4+1] = g; rgba[i*4+2] = b; rgba[i*4+3] = a;
  }
  return { w, h, rgba };
}

const CRC_TBL = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf){
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data){
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/* 필터는 전부 0(None). 도트 그림은 색 수가 적어 deflate만으로 충분히 줄고,
   필터를 고르는 코드가 없는 편이 읽기 쉽다. */
function encodePNG(w, h, rgba){
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++){
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { decodePNG, encodePNG, crc32 };
