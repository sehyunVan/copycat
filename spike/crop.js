/* 스크린샷 일부를 잘라 확대한다. 조형은 100px 짜리로는 판정이 안 된다.
   node spike/crop.js <png> <x> <y> <w> <h> [배율] */
const fs = require('fs'), path = require('path');
const { decodePNG, encodePNG } = require('../tools/png.js');
const [file, X, Y, CW, CH, K] = process.argv.slice(2);
const k = Number(K) || 3;
const img = decodePNG(fs.readFileSync(file));
const x0 = Number(X), y0 = Number(Y), cw = Number(CW), ch = Number(CH);
const out = Buffer.alloc(cw * k * ch * k * 4);
for (let y = 0; y < ch * k; y++)
  for (let x = 0; x < cw * k; x++){
    const sx = Math.min(img.w - 1, x0 + Math.floor(x / k));
    const sy = Math.min(img.h - 1, y0 + Math.floor(y / k));
    const s = (sy * img.w + sx) * 4, d = (y * cw * k + x) * 4;
    img.rgba.copy(out, d, s, s + 4);
  }
const dst = file.replace(/\.png$/, '-crop.png');
fs.writeFileSync(dst, encodePNG(cw * k, ch * k, out));
console.log('→', dst, cw * k + 'x' + ch * k);
