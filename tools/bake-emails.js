/* supabase/emails/*.html 을 함수가 읽을 수 있는 한 덩어리로 굽는다.

   왜 굽나: 메일 본문의 진짜 원본은 `supabase/emails/*.html` 이다 — 브라우저로
   열어 보면서 고치는 물건이라 HTML 파일이어야 한다. 그런데 엣지 함수는 Deno 로
   올라가고, Deno 는 .html 을 import 하지 못한다. 런타임에 파일을 읽는 길도 있지만
   그건 **배포 방식이 바뀌면 조용히 빈 메일이 나가는** 종류의 의존이다.

   그래서 굽는다. 원본은 하나로 두고, 함수가 들고 갈 사본을 여기서 만든다.
   본문을 고쳤으면 이걸 다시 돌린다 — 안 돌리면 검사가 잡는다(spike/verify-email.js).

     node tools/bake-emails.js
*/
const fs = require('fs'), path = require('path');

const SRC = path.join(__dirname, '..', 'supabase', 'emails');
const OUT = path.join(__dirname, '..', 'supabase', 'functions', 'auth-email', 'templates.js');

const NAMES = ['magic', 'confirm', 'change'];

const body = NAMES.map(n => {
  const html = fs.readFileSync(path.join(SRC, n + '.html'), 'utf8').trim();
  if (!html.includes('{{ .ConfirmationURL }}'))
    throw new Error(`${n}.html 에 {{ .ConfirmationURL }} 이 없다 — 아무도 못 들어온다`);
  return `  ${n}: ${JSON.stringify(html)},`;
}).join('\n');

fs.writeFileSync(OUT, `/* 자동 생성 — 고치지 말 것. 원본은 supabase/emails/*.html 이고,
   고친 뒤에는 \`node tools/bake-emails.js\` 를 돌린다. */
export const TEMPLATES = {
${body}
};
`, 'utf8');

console.log(`구웠다 → ${path.relative(process.cwd(), OUT)}  (${NAMES.join(' · ')})`);
