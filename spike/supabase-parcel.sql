-- ============================================================
-- 본사 택배 — 상자를 **서버가 센다**, 추첨도 **서버가 굴린다**
--   (supabase-parcel-pool.sql 을 먼저 실행해서 풀을 채운 뒤 이걸 실행한다)
--
-- 왜 서버로 옮기나 — 상자를 돈으로 팔기로 했기 때문이다. 그러면 상자는 재화가
-- 아니라 **장부**다. 로컬 저장에 두면 콘솔 한 줄로 999개가 되고, 그 순간
-- 결제한 사람과 안 한 사람이 같아진다.
--
-- 추첨까지 서버가 하는 이유 — 확률을 공시해 놓고 뽑기를 클라이언트가 굴리면
-- 그 표는 **증명할 수 없는 숫자**다. 표시한 확률과 실제로 도는 코드가 같은 자리에
-- 있어야 공시가 공시가 된다.
--
-- 여기 있는 것:
--   tickets        내 상자·벽돌·누적 (읽기만 가능, 쓰기는 아래 함수들만)
--   parcel_rates() 확률·확정·누적 보상 — **화면이 이걸 보고 그린다**
--   parcel_open()  상자를 까고 굴린다
--   ticket_free()  하루 한 번
--   ticket_work()  결재 보상 (검증할 수 없는 것이라 **하루 상한**을 둔다)
-- ============================================================

-- ---------- 잔액 ----------
create table if not exists public.tickets (
  user_id    uuid primary key references auth.users on delete cascade,
  balance    int  not null default 3,       -- 처음 세 개는 그냥 준다 (한 번은 까 봐야 안다)
  bricks     int  not null default 0,
  pulls      int  not null default 0,
  free_day   text,                          -- 무료를 받은 업무일
  work_day   text,                          -- 결재 보상을 센 업무일
  work_today int  not null default 0,       -- 그날 결재 보상으로 받은 수 (상한용)
  got        int[] not null default '{}',   -- 받은 누적 보상 지점
  updated_at timestamptz not null default now()
);
alter table public.tickets enable row level security;
-- **읽기만 연다.** 늘리고 줄이는 것은 아래 함수들뿐이다.
drop policy if exists "내 상자 읽기" on public.tickets;
create policy "내 상자 읽기" on public.tickets for select using (auth.uid() = user_id);

-- ---------- 값 ----------
-- 확률·확정·누적은 **여기가 원본**이다. 화면은 parcel_rates() 로 읽어 간다 —
-- 클라이언트에 같은 숫자를 또 적어 두면 언젠가 둘이 갈리고, 그때 공시가 거짓이 된다.
create or replace function public.parcel_cfg()
returns json language sql immutable as $$
  select json_build_object(
    'odds3', 0.025, 'odds2', 0.20,
    'floor', 2,                       -- 열 개를 한 번에 까면 ★2 이상 하나 확정
    'ten',   10,
    'work_every', 10,                 -- 결재 열 건마다 하나
    'work_cap',  5,                   -- 하루에 결재 보상으로 받을 수 있는 최대
    'mile', json_build_array(
      json_build_object('at', 10,  'tix', 2),
      json_build_object('at', 30,  'tix', 5),
      json_build_object('at', 50,  'tix', 8),
      json_build_object('at', 100, 'tix', 15))
  );
$$;

-- 지금 풀에서 **실제로 도는** 확률. 비어 있는 등급의 몫은 아래로 내려간다
-- (분류를 좁히지 않아도 카탈로그가 바뀌면 ★3 이 0장인 날이 올 수 있다).
create or replace function public.parcel_rates()
returns json language plpgsql stable as $$
declare
  c json := public.parcel_cfg();
  n3 int; n2 int; n1 int;
  r3 numeric := 0; r2 numeric := 0; r1 numeric := 0; spill numeric := 0;
begin
  select count(*) filter (where star = 3), count(*) filter (where star = 2),
         count(*) filter (where star = 1)
    into n3, n2, n1 from public.parcel_pool;

  spill := 0;
  if n3 > 0 then r3 := (c->>'odds3')::numeric; else spill := (c->>'odds3')::numeric; end if;
  if n2 > 0 then r2 := (c->>'odds2')::numeric + spill; spill := 0;
  else spill := spill + (c->>'odds2')::numeric; end if;
  if n1 > 0 then r1 := 1 - r3 - r2; end if;

  return json_build_object(
    'rates', json_build_object('3', r3, '2', r2, '1', r1),
    'counts', json_build_object('3', n3, '2', n2, '1', n1),
    'pool', n3 + n2 + n1,
    'floor', (c->>'floor')::int,
    'ten', (c->>'ten')::int,
    'mile', c->'mile');
end $$;

-- ---------- 잔액 한 줄 보장 ----------
create or replace function public.ticket_row()
returns public.tickets language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  insert into public.tickets(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into t from public.tickets where user_id = auth.uid();
  return t;
end $$;

create or replace function public.ticket_state()
returns json language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  t := public.ticket_row();
  return json_build_object('ok', true, 'balance', t.balance, 'bricks', t.bricks,
    'pulls', t.pulls, 'free_day', t.free_day, 'got', t.got);
end $$;

-- ---------- 한 장 굴린다 ----------
-- floor 를 주면 그 등급 이상에서만 고른다. 확정 안에서도 등급 비율은 지킨다 —
-- 확정이 곧 최고 등급이 되면 ★3 이 열 번마다 한 번씩 나온다.
create or replace function public.parcel_roll(p_floor int default 0)
returns public.parcel_pool language plpgsql volatile set search_path = public as $$
declare
  r json := public.parcel_rates();
  x numeric := random();
  pick int := 0; s int; acc numeric := 0; tot numeric := 0;
  it public.parcel_pool;
begin
  if p_floor > 0 then
    for s in reverse 3..1 loop
      if s >= p_floor and (r->'counts'->>s::text)::int > 0 then
        tot := tot + (r->'rates'->>s::text)::numeric;
      end if;
    end loop;
    x := random() * greatest(tot, 0.000001);
    for s in reverse 3..1 loop
      if s >= p_floor and (r->'counts'->>s::text)::int > 0 then
        acc := acc + (r->'rates'->>s::text)::numeric;
        if x <= acc then pick := s; exit; end if;
      end if;
    end loop;
    if pick = 0 then
      select max(star) into pick from public.parcel_pool where star >= p_floor;
    end if;
  else
    for s in reverse 3..1 loop
      acc := acc + (r->'rates'->>s::text)::numeric;
      if x <= acc and (r->'counts'->>s::text)::int > 0 then pick := s; exit; end if;
    end loop;
    if pick = 0 then select max(star) into pick from public.parcel_pool; end if;
  end if;

  select * into it from public.parcel_pool where star = pick order by random() limit 1;
  return it;
end $$;

-- ---------- 상자를 깐다 ----------
create or replace function public.parcel_open(p_n int, p_free boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  c json := public.parcel_cfg();
  t public.tickets;
  today text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
  i int; need boolean; got_hi boolean := false;
  it public.parcel_pool;
  items json[] := '{}';
  bricks_add int := 0;
  m json; granted json[] := '{}';
begin
  if auth.uid() is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  if p_n is null or p_n not in (1, 10) then return json_build_object('ok', false, 'why', 'bad_n'); end if;
  t := public.ticket_row();

  if p_free then
    if p_n <> 1 then return json_build_object('ok', false, 'why', 'bad_n'); end if;
    if t.free_day = today then return json_build_object('ok', false, 'why', 'used'); end if;
    update public.tickets set free_day = today where user_id = auth.uid();
  else
    if t.balance < p_n then return json_build_object('ok', false, 'why', 'empty'); end if;
    update public.tickets set balance = balance - p_n where user_id = auth.uid();
  end if;

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

  -- 누적 보상 — 깐 자리에서 바로 준다(「받기」 단추를 하나 더 만들면 그건 심부름이다)
  for m in select * from json_array_elements(c->'mile') loop
    if t.pulls >= (m->>'at')::int and not ((m->>'at')::int = any(t.got)) then
      update public.tickets
         set got = array_append(got, (m->>'at')::int),
             balance = balance + (m->>'tix')::int
       where user_id = auth.uid() returning * into t;
      granted := granted || m;
    end if;
  end loop;

  return json_build_object('ok', true, 'items', array_to_json(items),
    'balance', t.balance, 'bricks', t.bricks, 'pulls', t.pulls,
    'granted', array_to_json(granted));
end $$;

-- ---------- 상자가 들어오는 길 ----------
create or replace function public.ticket_free()
returns json language plpgsql security definer set search_path = public as $$
begin
  return public.parcel_open(1, true);
end $$;

-- 벽돌은 **재화가 아니다.** 한때 ticket_bricks() 가 열 개를 상자 하나로 바꿔 줬는데,
-- 그러면 꽝이 꽝이 아니라 느린 상자가 된다(js/gacha.js 머리말). 그래서 지웠다.
-- 이미 올려 둔 서버가 있으면 **이 줄이 그걸 내린다** — 함수만 지우고 tickets.bricks 는
-- 그대로 둔다: 몇 개 받았는지는 계속 세고, 다만 그 숫자로 살 수 있는 것이 없을 뿐이다.
drop function if exists public.ticket_bricks();

-- 결재 보상. **서버가 검증할 수 없는 유일한 길이다** — 할 일 목록은 그 기계 안에만
-- 있으므로 「열 건을 했다」는 클라이언트의 말이다. 그래서 막지 않고 **하루 상한**을
-- 둔다: 정직한 사람은 상한에 안 닿고, 그렇지 않은 사람도 하루치를 못 넘는다.
create or replace function public.ticket_work()
returns json language plpgsql security definer set search_path = public as $$
declare
  c json := public.parcel_cfg(); t public.tickets;
  today text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
begin
  if auth.uid() is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  t := public.ticket_row();
  if t.work_day is distinct from today then
    update public.tickets set work_day = today, work_today = 0 where user_id = auth.uid()
      returning * into t;
  end if;
  if t.work_today >= (c->>'work_cap')::int then
    return json_build_object('ok', false, 'why', 'cap', 'balance', t.balance);
  end if;
  update public.tickets set work_today = work_today + 1, balance = balance + 1, updated_at = now()
   where user_id = auth.uid() returning * into t;
  return json_build_object('ok', true, 'balance', t.balance);
end $$;

-- ---------- 유료 지급 자리 ----------
-- 결제는 **여기로만** 들어온다. 클라이언트가 부를 수 없다(권한을 안 준다) —
-- 스토어 영수증을 검증한 서버(Edge Function · RevenueCat 웹훅)만 부른다.
-- 지금은 자리만 비워 둔다: 앱에서 돈을 받는 것은 스토어 계정이 선 뒤의 일이다.
create or replace function public.ticket_purchase(p_user uuid, p_n int, p_receipt text)
returns json language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  if p_n is null or p_n <= 0 or p_n > 500 then return json_build_object('ok', false, 'why', 'bad_n'); end if;
  insert into public.tickets(user_id) values (p_user) on conflict (user_id) do nothing;
  update public.tickets set balance = balance + p_n, updated_at = now()
   where user_id = p_user returning * into t;
  return json_build_object('ok', true, 'balance', t.balance);
end $$;

revoke all on function public.parcel_open(int, boolean) from public;
revoke all on function public.parcel_rates()            from public;
revoke all on function public.ticket_state()            from public;
revoke all on function public.ticket_free()             from public;
revoke all on function public.ticket_work()             from public;
revoke all on function public.ticket_purchase(uuid, int, text) from public, authenticated, anon;
grant execute on function public.parcel_open(int, boolean) to authenticated;
grant execute on function public.parcel_rates()            to authenticated, anon;
grant execute on function public.ticket_state()            to authenticated;
grant execute on function public.ticket_free()             to authenticated;
grant execute on function public.ticket_work()             to authenticated;

-- ---------- 표 자체의 권한 ----------
-- RLS 에 정책이 없으면 어차피 막히지만, **막혀 있다는 사실을 파일에 적어 둔다.**
-- 「왜 못 고치지」를 나중에 다시 추적하지 않으려는 것이다.
grant select on public.parcel_pool to anon, authenticated;
grant select on public.tickets     to authenticated;
revoke insert, update, delete on public.tickets     from anon, authenticated;
revoke insert, update, delete on public.parcel_pool from anon, authenticated;
