-- ============================================================
-- 택배 풀 — **자동 생성 파일이다. 손으로 고치지 말 것.**
--   node tools/parcel-pool.js   (게임에서 gaPool() 을 그대로 꺼내 굽는다)
--
-- 생성 2026-09-03 · 30장
--   가구 23 · 멸치 3 · 장비 0 · 벽돌 4
--   ★3 4 · ★2 12 · ★1 14
--
-- 가구 카탈로그나 장비를 고쳤으면 이 도구를 다시 돌린다 — 서버만 옛 표를 들고
-- 있으면 공시한 확률과 실제로 나오는 것이 갈린다.
-- ============================================================

create table if not exists public.parcel_pool (
  id     text primary key,
  kind   text not null,        -- furn | fish | gear | brick
  star   int  not null,
  amount int,                  -- 멸치만 (액수)
  name   text
);
alter table public.parcel_pool enable row level security;
-- 풀은 **누구나 읽는다** — 확률 공시의 근거라 감출 이유가 없다. 쓰기는 아무도 못 한다.
drop policy if exists "풀은 읽기만" on public.parcel_pool;
create policy "풀은 읽기만" on public.parcel_pool for select using (true);

truncate public.parcel_pool;
insert into public.parcel_pool (id, kind, star, amount, name) values
  ('f_box', 'furn', 1, null, '박스'),
  ('f_bin', 'furn', 1, null, '휴지통'),
  ('f_penholder', 'furn', 1, null, '펜 홀더'),
  ('f_plantS', 'furn', 1, null, '화분 (소)'),
  ('f_papertray', 'furn', 1, null, '서류 트레이'),
  ('f_candle', 'furn', 1, null, '캔들'),
  ('f_cafechair', 'furn', 1, null, '카페 의자'),
  ('f_meetchair', 'furn', 1, null, '회의용 의자'),
  ('f_lantern', 'furn', 1, null, '랜턴'),
  ('f_bookrack', 'furn', 2, null, '책꽂이'),
  ('f_drawer', 'furn', 2, null, '서랍장'),
  ('f_plantL', 'furn', 2, null, '화분 (대)'),
  ('f_openshelf', 'furn', 2, null, '오픈 선반'),
  ('f_lowtable', 'furn', 2, null, '테이블'),
  ('f_cafetable', 'furn', 2, null, '카페 테이블'),
  ('f_beanbag', 'furn', 2, null, '빈백'),
  ('f_floorlamp', 'furn', 2, null, '스탠드 조명'),
  ('f_cabinet', 'furn', 2, null, '수납장'),
  ('f_filecab', 'furn', 2, null, '파일 캐비닛'),
  ('f_locker', 'furn', 2, null, '락커'),
  ('f_armchair', 'furn', 3, null, '안락 의자'),
  ('f_sofa1', 'furn', 3, null, '소파 (1인)'),
  ('f_sofa2', 'furn', 3, null, '소파 (2인)'),
  ('fish1', 'fish', 1, 120, '멸치 한 줌'),
  ('fish2', 'fish', 2, 340, '멸치 한 봉지'),
  ('fish3', 'fish', 3, 900, '멸치 한 상자'),
  ('brick0', 'brick', 1, null, '벽돌'),
  ('brick1', 'brick', 1, null, '벽돌'),
  ('brick2', 'brick', 1, null, '벽돌'),
  ('brick3', 'brick', 1, null, '벽돌');
