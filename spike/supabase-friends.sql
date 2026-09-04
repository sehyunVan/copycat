-- ============================================================
-- 제휴 지점(친구) — Supabase SQL Editor 에 붙여넣고 한 번 실행
--
-- 표 둘과 함수 하나다.
--   branches  남에게 보이는 내 사무실 한 줄 (js/friends.js 의 mine() 그대로)
--   friends   누가 누구를 보는가 (한 방향씩 두 줄 = 서로 본다)
--   friend_add(코드)  코드로 서로를 친구로 넣는 유일한 문
--
-- ── 왜 함수가 필요한가 ──
-- 평소 규칙은 「친구의 줄만 읽는다」인데, 친구를 맺으려면 **아직 친구가 아닌 사람의
-- 줄을 코드로 찾아야** 한다. 그 한 걸음만 서버 함수 안에서 연다(security definer) —
-- 코드를 정확히 맞힌 사람에게, 서로를 친구로 넣는 일까지만. 목록을 훑거나 남의
-- 코드를 캐는 길은 열리지 않는다.
-- ============================================================

create table if not exists public.branches (
  user_id    uuid primary key references auth.users on delete cascade,
  code       text unique not null,
  snap       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.branches enable row level security;

create table if not exists public.friends (
  owner_id   uuid not null references auth.users on delete cascade,
  friend_id  uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);
alter table public.friends enable row level security;

-- 내 지점은 내가 쓴다
drop policy if exists "내 지점 읽기" on public.branches;
create policy "내 지점 읽기" on public.branches
  for select using (auth.uid() = user_id);
drop policy if exists "내 지점 만들기" on public.branches;
create policy "내 지점 만들기" on public.branches
  for insert with check (auth.uid() = user_id);
drop policy if exists "내 지점 고치기" on public.branches;
create policy "내 지점 고치기" on public.branches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 친구의 지점도 읽는다 (그 외에는 못 읽는다)
drop policy if exists "친구 지점 읽기" on public.branches;
create policy "친구 지점 읽기" on public.branches
  for select using (exists (
    select 1 from public.friends f
     where f.owner_id = auth.uid() and f.friend_id = branches.user_id));

-- 친구 목록은 내 것만 보이고, 끊는 것도 내 쪽만
drop policy if exists "내 친구 읽기" on public.friends;
create policy "내 친구 읽기" on public.friends
  for select using (auth.uid() = owner_id);
drop policy if exists "내 친구 끊기" on public.friends;
create policy "내 친구 끊기" on public.friends
  for delete using (auth.uid() = owner_id);
-- insert 정책은 **일부러 없다.** 친구를 맺는 길은 아래 함수 하나뿐이다.

create or replace function public.friend_add(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  tgt uuid;
  nm  text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'why', 'noauth');
  end if;

  select user_id, coalesce(snap->>'name', '?')
    into tgt, nm
    from public.branches
   where upper(code) = upper(btrim(p_code));

  if tgt is null then
    return json_build_object('ok', false, 'why', 'notfound');
  end if;
  if tgt = auth.uid() then
    return json_build_object('ok', false, 'why', 'self');
  end if;

  -- 서로 넣는다. 한쪽만 넣으면 저쪽 화면에 내가 안 보이고, 그건 제휴가 아니라 구독이다.
  insert into public.friends(owner_id, friend_id)
       values (auth.uid(), tgt) on conflict do nothing;
  insert into public.friends(owner_id, friend_id)
       values (tgt, auth.uid()) on conflict do nothing;

  return json_build_object('ok', true, 'name', nm);
end;
$$;

revoke all on function public.friend_add(text) from public;
grant execute on function public.friend_add(text) to authenticated;
