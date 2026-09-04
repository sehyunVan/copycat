-- ============================================================
-- 사회 기능과 계정 정리 — SQL Editor 에 붙여넣고 한 번 실행
-- (supabase-friends.sql 을 먼저 돌린 뒤에 이걸 돌린다)
--
-- 여기서 여는 것 넷:
--   friend_reqs  **수락 절차.** 코드를 아는 것만으로 서로 보이면 안 된다
--   blocks       끊고 다시 못 걸게
--   greets       🐟 인사를 **저쪽 화면에** 남긴다 (여태 내 저장에만 있었다)
--   account_delete()  계정과 흔적을 지운다 — 스토어의 필수 요건이다
--
-- 규칙 하나가 관통한다: **표를 직접 쓰게 두지 않는다.** 친구를 맺고·수락하고·
-- 차단하는 일은 전부 함수를 지난다(security definer). 코드로 남의 줄을 찾는 것,
-- 두 방향을 한꺼번에 넣는 것, 차단된 사람을 막는 것이 한 자리에서만 일어나야
-- 나중에 규칙이 갈리지 않는다.
-- ============================================================

-- ---------- 표 셋 ----------
create table if not exists public.friend_reqs (
  from_id    uuid not null references auth.users on delete cascade,
  to_id      uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
alter table public.friend_reqs enable row level security;

create table if not exists public.blocks (
  owner_id   uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, blocked_id)
);
alter table public.blocks enable row level security;

create table if not exists public.greets (
  to_id      uuid not null references auth.users on delete cascade,
  from_id    uuid not null references auth.users on delete cascade,
  day        text not null,                    -- 업무일 키 (하루에 한 번)
  kind       text not null default 'fish',
  note       text,
  created_at timestamptz not null default now(),
  primary key (to_id, from_id, day)
);
alter table public.greets enable row level security;

-- 요청은 **당사자 둘만** 본다
drop policy if exists "내게 온 요청 · 내가 보낸 요청" on public.friend_reqs;
create policy "내게 온 요청 · 내가 보낸 요청" on public.friend_reqs
  for select using (auth.uid() = to_id or auth.uid() = from_id);
drop policy if exists "내가 보낸 요청 거두기" on public.friend_reqs;
create policy "내가 보낸 요청 거두기" on public.friend_reqs
  for delete using (auth.uid() = from_id);

-- 차단 목록은 **내 것만**. 차단당한 쪽은 자기가 차단됐는지 모른다(그게 맞다)
drop policy if exists "내 차단 목록" on public.blocks;
create policy "내 차단 목록" on public.blocks
  for select using (auth.uid() = owner_id);
drop policy if exists "내 차단 풀기" on public.blocks;
create policy "내 차단 풀기" on public.blocks
  for delete using (auth.uid() = owner_id);

-- 인사: 받은 것과 보낸 것을 본다. 넣는 것은 **친구 사이일 때만**
drop policy if exists "받은 인사 · 보낸 인사" on public.greets;
create policy "받은 인사 · 보낸 인사" on public.greets
  for select using (auth.uid() = to_id or auth.uid() = from_id);
drop policy if exists "친구에게만 인사" on public.greets;
create policy "친구에게만 인사" on public.greets
  for insert with check (
    auth.uid() = from_id
    and exists (select 1 from public.friends f
                 where f.owner_id = auth.uid() and f.friend_id = greets.to_id)
    and not exists (select 1 from public.blocks b
                     where b.owner_id = greets.to_id and b.blocked_id = auth.uid())
  );

-- ---------- 친구 맺기 — 이제 **요청**이다 ----------
-- 코드를 넣으면 바로 서로가 보이던 것을 고친다. 코드는 옮겨 적기 쉬운 물건이라
-- (SNS 에 한 번 올리면 끝이다) 그 자체를 동의로 칠 수 없다.
create or replace function public.friend_add(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare tgt uuid; nm text; me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'why', 'noauth'); end if;

  select user_id, coalesce(snap->>'name', '?') into tgt, nm
    from public.branches where upper(code) = upper(btrim(p_code));

  if tgt is null then return json_build_object('ok', false, 'why', 'notfound'); end if;
  if tgt = me   then return json_build_object('ok', false, 'why', 'self'); end if;

  -- 저쪽이 나를 차단했으면 **없는 코드처럼** 답한다. 「차단당했다」를 알려 주면
  -- 그 자체가 저쪽의 소식이 되고, 차단은 조용해야 쓸모가 있다.
  if exists (select 1 from public.blocks where owner_id = tgt and blocked_id = me)
    then return json_build_object('ok', false, 'why', 'notfound'); end if;
  -- 내가 차단해 둔 사람이면 먼저 풀어야 한다
  if exists (select 1 from public.blocks where owner_id = me and blocked_id = tgt)
    then return json_build_object('ok', false, 'why', 'blocked'); end if;

  if exists (select 1 from public.friends where owner_id = me and friend_id = tgt)
    then return json_build_object('ok', false, 'why', 'already', 'name', nm); end if;

  -- 저쪽이 이미 나에게 보내 두었으면 **그 자리에서 맺는다** — 서로 코드를 주고받은
  -- 상황이고, 그때 또 수락을 누르게 하면 그건 절차를 위한 절차다.
  if exists (select 1 from public.friend_reqs where from_id = tgt and to_id = me) then
    delete from public.friend_reqs where (from_id = tgt and to_id = me) or (from_id = me and to_id = tgt);
    insert into public.friends(owner_id, friend_id) values (me, tgt) on conflict do nothing;
    insert into public.friends(owner_id, friend_id) values (tgt, me) on conflict do nothing;
    return json_build_object('ok', true, 'linked', true, 'name', nm);
  end if;

  insert into public.friend_reqs(from_id, to_id) values (me, tgt) on conflict do nothing;
  return json_build_object('ok', true, 'linked', false, 'name', nm);
end $$;

-- 수락 — 이때 비로소 서로가 보인다
create or replace function public.friend_accept(p_from uuid)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  if not exists (select 1 from public.friend_reqs where from_id = p_from and to_id = me)
    then return json_build_object('ok', false, 'why', 'notfound'); end if;
  delete from public.friend_reqs where (from_id = p_from and to_id = me) or (from_id = me and to_id = p_from);
  insert into public.friends(owner_id, friend_id) values (me, p_from) on conflict do nothing;
  insert into public.friends(owner_id, friend_id) values (p_from, me) on conflict do nothing;
  return json_build_object('ok', true);
end $$;

create or replace function public.friend_reject(p_from uuid)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  delete from public.friend_reqs where from_id = p_from and to_id = me;
  return json_build_object('ok', true);
end $$;

-- 차단 — 끊고, 요청도 지우고, 다시 못 걸게 한다
create or replace function public.friend_block(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  delete from public.friends    where (owner_id = me and friend_id = p_id) or (owner_id = p_id and friend_id = me);
  delete from public.friend_reqs where (from_id = me and to_id = p_id) or (from_id = p_id and to_id = me);
  insert into public.blocks(owner_id, blocked_id) values (me, p_id) on conflict do nothing;
  return json_build_object('ok', true);
end $$;

-- 요청 목록에 **이름**을 붙여 준다. 요청은 아직 친구가 아니라서 저쪽 지점(branches)을
-- 못 읽는다 — 그러니 이름 한 줄만 이 함수가 꺼내 준다(사무실도 결재함도 안 준다).
create or replace function public.friend_reqs_in()
returns table(from_id uuid, name text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select r.from_id, coalesce(b.snap->>'name', '?'), r.created_at
    from public.friend_reqs r
    left join public.branches b on b.user_id = r.from_id
   where r.to_id = auth.uid()
   order by r.created_at desc
   limit 50;
$$;

-- ---------- 계정 삭제 ----------
-- 스토어가 요구하는 그것이다(App Store 5.1.1(v) · Google Play). 남기는 것 없이 지운다:
-- 저장 · 지점 · 친구 관계 양쪽 · 요청 · 차단 · 인사, 그리고 계정 자체.
-- auth.users 를 지우면 나머지는 on delete cascade 로 따라가지만, 관계 표는 **상대방
-- 쪽 줄**까지 지워야 해서 명시한다.
create or replace function public.account_delete()
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return json_build_object('ok', false, 'why', 'noauth'); end if;
  delete from public.greets      where to_id = me or from_id = me;
  delete from public.friend_reqs where to_id = me or from_id = me;
  delete from public.blocks      where owner_id = me or blocked_id = me;
  delete from public.friends     where owner_id = me or friend_id = me;
  delete from public.branches    where user_id = me;
  delete from public.saves       where user_id = me;
  delete from auth.users         where id = me;
  return json_build_object('ok', true);
end $$;

revoke all on function public.friend_add(text)        from public;
revoke all on function public.friend_accept(uuid)     from public;
revoke all on function public.friend_reject(uuid)     from public;
revoke all on function public.friend_block(uuid)      from public;
revoke all on function public.friend_reqs_in()        from public;
revoke all on function public.account_delete()        from public;
grant execute on function public.friend_add(text)     to authenticated;
grant execute on function public.friend_accept(uuid)  to authenticated;
grant execute on function public.friend_reject(uuid)  to authenticated;
grant execute on function public.friend_block(uuid)   to authenticated;
grant execute on function public.friend_reqs_in()     to authenticated;
grant execute on function public.account_delete()     to authenticated;
