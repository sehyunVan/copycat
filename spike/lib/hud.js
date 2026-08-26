/* 계기판. 스파이크 셋이 같이 쓴다 — 값을 읽는 게 목적이라 꾸미지 않는다. */

const CSS = `
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#0d0f14;color:#d7dbe3;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;overflow:hidden}
  #stage{position:fixed;inset:0;overflow:hidden}
  #stage.widget{inset:auto;left:24px;top:24px;width:380px;height:300px;
    outline:2px solid #2a3040;border-radius:8px}
  /* 캔버스의 CSS 크기는 여기서 정한다. setSize(w,h,false) 는 드로잉 버퍼만 건드리므로
     이 규칙이 없으면 DPR 2 화면에서 캔버스가 2배로 커진 채 왼쪽 위 귀퉁이만 보인다. */
  #stage canvas{display:block;width:100%;height:100%}
  .hud{position:fixed;right:0;top:0;width:340px;max-height:100vh;overflow:auto;
    background:#12151c;border-left:1px solid #232838;padding:12px 14px;z-index:99}
  .hud h1{margin:0 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7f8aa3}
  .row{display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid #191d27}
  .row b{color:#fff;font-weight:600;font-variant-numeric:tabular-nums}
  .row.warn b{color:#ffb454}.row.bad b{color:#ff6b81}.row.ok b{color:#6ee7a0}
  .btns{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
  button{background:#1c2231;color:#d7dbe3;border:1px solid #2c3446;border-radius:6px;
    padding:5px 9px;font:inherit;cursor:pointer}
  button:hover{background:#252d40}
  button.on{background:#3b5bdb;border-color:#4c6ef5;color:#fff}
  #log{margin-top:10px;height:220px;overflow:auto;background:#0a0c11;border:1px solid #1c2130;
    border-radius:6px;padding:8px;white-space:pre-wrap;font-size:11px;line-height:1.45}
  #log .t{color:#5b6479}
  #log .e{color:#ff6b81}
  #log .g{color:#6ee7a0}
`;

export function hud(title){
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `<h1>${title}</h1><div id="rows"></div><div class="btns" id="btns"></div><div id="log"></div>`;
  document.body.appendChild(el);

  const rows = el.querySelector('#rows'), btns = el.querySelector('#btns'), logEl = el.querySelector('#log');
  const cells = new Map();
  const t0 = performance.now();

  const api = {
    el,
    /* 한 줄 값. 같은 키를 다시 부르면 그 자리를 갱신한다. */
    set(k, v, tone){
      let c = cells.get(k);
      if (!c){
        const r = document.createElement('div');
        r.className = 'row';
        r.innerHTML = `<span>${k}</span><b></b>`;
        rows.appendChild(r);
        c = { row:r, b:r.querySelector('b') };
        cells.set(k, c);
      }
      c.b.textContent = v;
      c.row.className = 'row' + (tone ? ' ' + tone : '');
    },
    btn(label, fn, toggled){
      const b = document.createElement('button');
      b.textContent = label;
      if (toggled) b.classList.add('on');
      b.onclick = () => { const on = fn(b); if (on !== undefined) b.classList.toggle('on', !!on); };
      btns.appendChild(b);
      return b;
    },
    log(msg, kind){
      const t = ((performance.now() - t0) / 1000).toFixed(2).padStart(7);
      const line = document.createElement('div');
      line.innerHTML = `<span class="t">${t}</span> <span class="${kind || ''}">${msg}</span>`;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
      console.log(`[${t}] ${msg}`);
    },
    ok:  m => api.log(m, 'g'),
    err: m => api.log(m, 'e'),
  };
  return api;
}

/* 프레임 시간 통계 — 평균은 튀는 프레임을 감추니 p95도 같이 본다. */
export function frameStats(windowMs = 1000){
  let samples = [], last = performance.now(), acc = 0, frames = 0;
  return {
    tick(){
      const now = performance.now(), dt = now - last;
      last = now; frames++; acc += dt;
      samples.push(dt);
      if (acc >= windowMs){
        const s = samples.slice().sort((a, b) => a - b);
        const out = {
          fps: frames / (acc / 1000),
          avg: acc / frames,
          p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
          max: s[s.length - 1],
        };
        samples = []; acc = 0; frames = 0;
        return out;
      }
      return null;
    },
    get dt(){ return last; },
  };
}

export const fmt = {
  ms: v => v.toFixed(2) + ' ms',
  mb: v => (v / 1048576).toFixed(1) + ' MB',
  hms: s => {
    s = Math.floor(s);
    return `${String(Math.floor(s / 3600)).padStart(2,'0')}:${String(Math.floor(s / 60) % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  },
};
