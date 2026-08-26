/* ============================================================
   wav.js — BGM 경량화.

   aquarium.wav 는 44.1kHz 스테레오 16비트 2분짜리 원본이라 21MB다. 게임 코드가
   200KB 남짓인데 배경음악 하나가 그 백 배인 셈이고, 웹에서 처음 열어 보는 사람에게는
   그 숫자가 곧 이탈이다. 모노 22.05kHz로 줄이면 5MB가 된다.

   그냥 한 칸씩 건너뛰면 11kHz 위쪽이 접혀 들어와 쇳소리가 난다. 자르기 전에
   저역통과를 한 번 먹인다 (해밍 창 sinc, 21탭). 원본 파일은 건드리지 않는다.
   ============================================================ */

function lighten(buf){
  let p = 12, fmt = null, data = null;
  while (p < buf.length - 8){
    const id = buf.toString('ascii', p, p + 4), len = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    else if (id === 'data') data = buf.subarray(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('16비트 PCM WAV 만 줄일 수 있다');
  /* 이미 줄여 둔 파일은 그대로 돌려준다. 쥬크박스가 생기면서 저장소에 들어온 곡들은
     처음부터 모노 22.05kHz 로 넣었는데(전부 원본이면 68MB다), 여기를 한 번 더 지나면
     11kHz 가 되어 리코더가 전화기 소리로 바뀐다. 줄이는 건 한 번뿐이어야 한다. */
  if (fmt.ch === 1 && fmt.rate <= 24000) return buf;

  const n = data.length / 2 / fmt.ch;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++){
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2);
    mono[i] = s / fmt.ch;
  }

  const TAPS = 21, taps = new Float32Array(TAPS);
  let sum = 0;
  for (let i = 0; i < TAPS; i++){
    const x = i - (TAPS - 1) / 2;
    const sinc = x === 0 ? 0.5 : Math.sin(Math.PI * 0.5 * x) / (Math.PI * x);   // 차단 = 나이퀴스트/2
    taps[i] = sinc * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (TAPS - 1)));
    sum += taps[i];
  }
  for (let i = 0; i < TAPS; i++) taps[i] /= sum;

  const m = Math.floor(n / 2), out = Buffer.alloc(m * 2);
  for (let i = 0; i < m; i++){
    let acc = 0;
    for (let k = 0; k < TAPS; k++){
      const j = i * 2 + k - ((TAPS - 1) >> 1);
      if (j >= 0 && j < n) acc += mono[j] * taps[k];
    }
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(acc))), i * 2);
  }

  const rate = Math.round(fmt.rate / 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + out.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(out.length, 40);
  return Buffer.concat([head, out]);
}

module.exports = { lighten };
