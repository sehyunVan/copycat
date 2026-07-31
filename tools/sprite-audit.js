// 타일에서 시작해 이어진 픽셀 덩어리를 추적 → 스프라이트의 진짜 경계를 구한다.
const fs = require('fs'), zlib = require('zlib'), vm = require('vm');

function decodePNG(file){
  const d = fs.readFileSync(file);
  let p = 8, w=0, h=0, bd=0, ct=0, idat=[], plte=null, trns=null;
  while (p < d.length){
    const len = d.readUInt32BE(p), type = d.toString('ascii', p+4, p+8);
    const data = d.subarray(p+8, p+8+len);
    if (type==='IHDR'){ w=data.readUInt32BE(0); h=data.readUInt32BE(4); bd=data[8]; ct=data[9]; }
    else if (type==='IDAT') idat.push(data);
    else if (type==='PLTE') plte=data;
    else if (type==='tRNS') trns=data;
    else if (type==='IEND') break;
    p += 12 + len;
  }
  const ch = {0:1,2:3,3:1,4:2,6:4}[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w*ch, out = Buffer.alloc(h*stride);
  const paeth=(a,b,c)=>{const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);
    return (pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);};
  for (let y=0;y<h;y++){
    const ft = raw[y*(stride+1)];
    const line = raw.subarray(y*(stride+1)+1, y*(stride+1)+1+stride);
    for (let i=0;i<stride;i++){
      const a = i>=ch ? out[y*stride+i-ch] : 0;
      const b = y>0 ? out[(y-1)*stride+i] : 0;
      const c = (i>=ch&&y>0) ? out[(y-1)*stride+i-ch] : 0;
      let v = line[i];
      if (ft===1) v+=a; else if (ft===2) v+=b; else if (ft===3) v+=(a+b)>>1; else if (ft===4) v+=paeth(a,b,c);
      out[y*stride+i] = v & 0xff;
    }
  }
  const alpha = new Uint8Array(w*h);
  for (let i=0;i<w*h;i++){
    if (ct===6) alpha[i]=out[i*4+3];
    else if (ct===4) alpha[i]=out[i*2+1];
    else if (ct===3){ const idx=out[i]; alpha[i]= trns && idx<trns.length ? trns[idx] : 255; }
    else alpha[i]=255;
  }
  return { w, h, alpha };
}

const ROOT = 'c:/Users/sehyu/playground/copycat/';
const src = ['js/world.js','js/cats.js','js/sprite.js'].map(f=>fs.readFileSync(ROOT+f,'utf8')).join('\n');
const ctx = { console, Math, Object, Map, Set, Array, String, Number,
  document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}}),toDataURL:()=>'data:,'})} };
vm.createContext(ctx); vm.runInContext(src, ctx);
const R = e => vm.runInContext(e, ctx);

const S = decodePNG(ROOT + 'assets/modern_office/Modern_Office_Shadowless_16x16.png');
const T = 16;
const on = (x,y) => x>=0 && y>=0 && x<S.w && y<S.h && S.alpha[y*S.w+x] > 8;

/* 타일 안의 모든 채워진 픽셀에서 8방향 flood fill → 이어진 덩어리의 바운딩 박스 */
function extent(col, row){
  const seen = new Uint8Array(S.w*S.h);
  const stack = [];
  for (let y=0;y<T;y++) for (let x=0;x<T;x++){
    const px = col*T+x, py = row*T+y;
    if (on(px,py) && !seen[py*S.w+px]){ seen[py*S.w+px]=1; stack.push([px,py]); }
  }
  if (!stack.length) return null;
  let x0=S.w, y0=S.h, x1=-1, y1=-1;
  while (stack.length){
    const [x,y] = stack.pop();
    if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
      const nx=x+dx, ny=y+dy;
      if (on(nx,ny) && !seen[ny*S.w+nx]){ seen[ny*S.w+nx]=1; stack.push([nx,ny]); }
    }
  }
  return { c0: Math.floor(x0/T), r0: Math.floor(y0/T), c1: Math.floor(x1/T), r1: Math.floor(y1/T) };
}

const NM = JSON.parse(R('JSON.stringify(Object.fromEntries(Object.keys(FURN).map(t=>[t,(TILE_INFO[t]||{}).n||t])))'));
const furn = JSON.parse(R('JSON.stringify(FURN)'));
const deskTops = JSON.parse(R('JSON.stringify(DESK_TOPS)'));

/* flood fill이 못 가르는 경우 — 시트에서 물건끼리 픽셀이 맞닿아 있으면
   한 덩어리로 합쳐진다. 안락의자 줄(3~6열, 15~16행)이 그렇다.
   눈으로 확인해서 각각 1x2가 맞는 것들은 예외로 둔다. */
const MERGED_OK = new Set(['3,16', '6,16']);

console.log('타일'.padEnd(14), '고른좌표'.padEnd(11), '현재'.padEnd(7), '실제범위'.padEnd(18), '판정');
console.log('-'.repeat(88));
let bad = 0;
function check(label, col, row, tall, wide){
  tall=tall||1; wide=wide||1;
  const e = extent(col, row);
  if (!e){ console.log(label.padEnd(14), `(${col},${row})`.padEnd(11), '—', '빈 타일'); bad++; return; }
  const needTall = row - e.r0 + 1, needWide = e.c1 - col + 1;
  const anchorOk = (e.c0 === col) && (e.r1 === row);       // 우리가 왼쪽-아래 모서리를 잡았는가
  const ok = MERGED_OK.has(col + ',' + row) || (anchorOk && needTall === tall && needWide === wide);
  const range = MERGED_OK.has(col + ',' + row) ? '이웃과 붙어 있음(확인함)' : `(${e.c0},${e.r0})~(${e.c1},${e.r1})`;
  let verdict = 'ok';
  if (!ok){
    bad++;
    const fix = [];
    if (!anchorOk) fix.push(`기준칸을 (${e.c0},${e.r1})로`);
    if (needTall !== tall) fix.push(`tall ${tall}→${Math.max(1,row-e.r0+1)}`);
    if (needWide !== wide) fix.push(`wide ${wide}→${Math.max(1,e.c1-e.c0+1)}`);
    verdict = '⚠ ' + fix.join(', ');
  }
  console.log(label.padEnd(14), `(${col},${row})`.padEnd(11), `t${tall} w${wide}`.padEnd(7), range.padEnd(18), verdict);
}
Object.keys(furn).forEach(t => { const d = furn[t]; if (d.col !== undefined) check(NM[t], d.col, d.row, d.tall, d.wide); });
console.log('\n[책상 위 소품]');
deskTops.forEach(([c,r]) => check('소품', c, r, 1, 1));
JSON.parse(R('JSON.stringify(DESK_SIDE)')).forEach(([c,r]) => check('곁들이', c, r, 1, 1));

console.log('\n[의자 · 잡동사니]');
JSON.parse(R('JSON.stringify(CHAIRS)')).forEach(([c,r]) => check('의자', c, r, 2, 1));
JSON.parse(R('JSON.stringify(CLUTTER)')).forEach(d => check('잡동사니', d.col, d.row, d.tall, d.wide));
console.log('\n문제 ' + bad + '건');
