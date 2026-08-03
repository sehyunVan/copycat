// CDP 드라이버: 기기 폭을 강제 에뮬레이션해 오버플로를 측정하고 스크린샷을 남긴다.
//
// 먼저 디버그 포트를 열고 크롬을 띄운다 (한 번만):
//   chrome --headless=new --disable-gpu --remote-debugging-port=9222 \
//          --user-data-dir=/tmp/cdp about:blank &
// 그 다음:
//   node shot.mjs <url> <width> <height> <outPng> [light|dark]
//
// --window-size 만으로는 모바일 검증이 안 된다 — 헤드리스 크롬은 레이아웃 폭을 497px
// 아래로 내리지 않으므로 좁은 스크린샷은 "잘린 것"이지 "깨진 것"이 아니다.
// Emulation.setDeviceMetricsOverride 를 거쳐야 진짜 360px 레이아웃을 본다.
import { writeFileSync } from 'node:fs';

const [url, W, H, out, mode] = process.argv.slice(2);
const width = Number(W), height = Number(H);

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise(res => ws.addEventListener('open', res));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
if (mode) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
await send('Page.navigate', { url });
await new Promise(r => setTimeout(r, 1800));

const probe = `(() => {
  const vw = document.documentElement.clientWidth, bad = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.width > vw + 1)
      bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 30) + ' w=' + Math.round(r.width) + ' right=' + Math.round(r.right));
  });
  return JSON.stringify({ vw, scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight, bad: bad.slice(0, 12) });
})()`;
const ev = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
const info = JSON.parse(ev.result.value);
console.log(`w=${width} viewport=${info.vw} scrollWidth=${info.scrollW} ` +
  (info.scrollW > info.vw ? `>>> HORIZONTAL OVERFLOW <<<` : 'no h-overflow'));
info.bad.forEach(b => console.log('   overflow:', b));

if (out) {
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: Math.min(info.scrollH, 12000), scale: 1 },
  });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('   wrote', out, `(${width}x${Math.min(info.scrollH, 12000)})`);
}
ws.close();
