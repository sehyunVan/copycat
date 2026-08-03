/* ============================================================
   i18n.js — 언어. 한국어 / English / 日本語.
   빌드가 없는 프로젝트라 사전 파일 대신, 문자열이 쓰이는 자리마다
   L({ko,en,ja}) 로 세 언어를 나란히 둔다 — 키 불일치가 원천적으로 없다.
   언어를 바꾸면 저장 후 새로고침한다. 토스트·로그·열린 모달에
   옛 언어가 어중간하게 남는 걸 막는 가장 확실한 방법이다.
   (지난 사보 기사는 그때 언어로 남는다 — 신문 아카이브니까.)
   ============================================================ */

const LANG_KEY = 'copycat.lang';
const LANGS = [['ko', '한국어'], ['en', 'English'], ['ja', '日本語']];

const LANG = (() => {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'en' || v === 'ja' || v === 'ko') return v;
  } catch (e) {}
  return 'ko';
})();

function setLang(l) {
  if (l === LANG) return;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  try { save(); } catch (e) {}
  location.reload();
}

/* 세 언어를 담은 객체에서 현재 언어를 고른다. 없으면 ko로 폴백.
   문자열이나 배열이 그대로 오면 통과시킨다. */
function L(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v[LANG] != null ? v[LANG] : v.ko;
  }
  return v;
}
