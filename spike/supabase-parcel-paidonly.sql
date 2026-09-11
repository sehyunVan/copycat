-- ============================================================
--  상자는 **사는 것이다** — 서버에 남아 있던 공짜 길을 닫는다 (2026-09-11)
--
--  게임 쪽은 이미 닫아 뒀다: 결재 보상 · 하루 한 번 무료 · 누적 보상 셋을 다 뺐고
--  로컬 시작값도 0 이다(js/gacha.js 머리말). 그런데 **서버는 그대로였다** —
--  스토어용 사진을 찍다가 새 계정의 상자가 3 개로 뜨는 것을 보고 알았다.
--
--  서버에 남아 있던 길 넷:
--    ① tickets.balance  default 3        — 새 계정마다 세 개
--    ② ticket_free()                     — 하루 한 번
--    ③ ticket_work()                     — 결재 N건마다 한 개
--    ④ parcel_open 안의 누적 보상 루프    — 깐 횟수가 차면 balance 를 더한다
--
--  ②③은 게임이 더 이상 안 부른다. 그래도 지운다 — **부를 수 있으면 열려 있는 것**이다.
--  RPC 는 로그인한 사람이면 콘솔에서 그냥 부를 수 있다.
--
--  ── 이미 받은 것은 뺏지 않는다 ──
--  balance 를 0 으로 밀지 않는다. 규칙을 바꾸는 것과 준 것을 회수하는 것은 다르다.
--  기본값만 바꾸므로 **다음 계정부터** 0 에서 시작한다.
--
--  실행: Supabase → SQL Editor 에 붙여넣고 Run.
-- ============================================================

-- ① 새 계정은 0 에서 시작한다
alter table public.tickets alter column balance set default 0;

-- ②③ 공짜로 주던 함수 둘을 내린다
drop function if exists public.ticket_free();
drop function if exists public.ticket_work();

-- ④ p_free 갈래와 누적 보상 루프를 뺀 parcel_open.
--    인자 p_free 는 **남겨 둔다** — 옛 앱이 아직 그 자리에 false 를 넘긴다(js/parcel.js).
--    받되 무시한다: 서명이 바뀌면 그 앱들이 그 자리에서 404 를 받는다.
create or replace function public.parcel_open(p_n int, p_free boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  c json := public.parcel_cfg();
  t public.tickets;
  i int; need boolean; got_hi boolean := false;
  it public.parcel_pool;
  items json[] := '{}';
  bricks_add int := 0;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  if p_n is null or p_n not in (1, 10) then return json_build_object('ok', false, 'why', 'bad_n'); end if;
  t := public.ticket_row();

  -- 공짜로 까는 길은 없다. p_free 가 참으로 와도 **잔액에서 뺀다**.
  if t.balance < p_n then return json_build_object('ok', false, 'why', 'empty'); end if;
  update public.tickets set balance = balance - p_n where user_id = auth.uid();

  for i in 1..p_n loop
    need := (p_n >= (c->>'ten')::int) and (i = p_n) and not got_hi;
    it := public.parcel_roll(case when need then (c->>'floor')::int else 0 end);
    if it.star >= (c->>'floor')::int then got_hi := true; end if;
    if it.kind = 'brick' then bricks_add := bricks_add + 1; end if;
    items := items || json_build_object('id', it.id, 'kind', it.kind,
                                        'star', it.star, 'amount', it.amount, 'name', it.name);
  end loop;

  update public.tickets
     set pulls = pulls + p_n, bricks = bricks + bricks_add, updated_at = now()
   where user_id = auth.uid()
   returning * into t;

  -- 누적 보상은 없다. `granted` 는 **빈 배열로 계속 돌려준다** — 옛 앱이 그 칸을 읽는다.
  return json_build_object('ok', true, 'items', array_to_json(items),
    'balance', t.balance, 'bricks', t.bricks, 'pulls', t.pulls,
    'granted', '[]'::json);
end $$;

-- 확인
--   select column_default from information_schema.columns
--    where table_name = 'tickets' and column_name = 'balance';        -- 0 이어야 한다
--   select proname from pg_proc where proname in ('ticket_free','ticket_work');  -- 0행
