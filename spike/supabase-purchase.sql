-- ============================================================
-- 결제로 들어온 상자 — **영수증을 검증한 서버만** 지급한다
--   (supabase-parcel.sql 다음에 실행)
--
-- 여기 있는 것 셋:
--   parcel_products  무엇을 파는가 (상품 코드 → 상자 몇 개). **표에 둔다** —
--                    함수에 박아 두면 값을 바꿀 때마다 함수를 다시 올려야 한다
--   purchases        이미 처리한 결제. **여기가 중복 방지의 전부**다
--   purchase_apply() 웹훅이 부르는 유일한 문
--
-- ── 왜 중복 방지가 표에 있나 ──
-- 스토어 웹훅은 **여러 번 온다**(실패로 보이면 재시도한다). 그때 함수가 그냥 더해 주면
-- 한 번 산 사람이 두 번 받는다. 거래 번호를 기본키로 둔 표에 먼저 넣어 보고,
-- 이미 있으면 지급하지 않는다 — 판정이 데이터베이스 안에 있어야 동시에 두 번 와도 안전하다.
--
-- ── 누가 부를 수 있나 ──
-- 아무도 못 부른다. `service_role` 만 실행할 수 있고, 그 열쇠는 Edge Function 에만 있다.
-- 게임에는 그 열쇠가 없다(publishable 키만 실린다).
-- ============================================================

create table if not exists public.parcel_products (
  product_id text primary key,      -- 스토어에 등록한 상품 코드
  boxes      int  not null,
  label      text,
  sort       int  not null default 0,
  live       boolean not null default true
);
alter table public.parcel_products enable row level security;
-- 파는 목록은 **누구나 읽는다** — 상점 화면이 이걸로 그려지고, 감출 이유가 없다.
drop policy if exists "상품은 읽기만" on public.parcel_products;
create policy "상품은 읽기만" on public.parcel_products for select using (live);
grant select on public.parcel_products to anon, authenticated;
revoke insert, update, delete on public.parcel_products from anon, authenticated;

-- 처음 한 벌. 스토어에 등록할 때 이 코드를 그대로 쓴다.
insert into public.parcel_products (product_id, boxes, label, sort) values
  ('box_5',  5,  '상자 5개',  1),
  ('box_12', 12, '상자 12개', 2),
  ('box_30', 30, '상자 30개', 3)
on conflict (product_id) do nothing;

create table if not exists public.purchases (
  txn_id     text primary key,      -- 스토어 거래 번호 (중복 방지의 열쇠)
  user_id    uuid not null references auth.users on delete cascade,
  product_id text not null,
  boxes      int  not null,
  store      text,
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
-- 내 결제 내역은 내가 본다(문의가 오면 사람이 확인할 수 있어야 한다). 쓰기는 아무도 못 한다.
drop policy if exists "내 결제 읽기" on public.purchases;
create policy "내 결제 읽기" on public.purchases for select using (auth.uid() = user_id);
grant select on public.purchases to authenticated;
revoke insert, update, delete on public.purchases from anon, authenticated;

-- ---------- 웹훅이 부르는 유일한 문 ----------
create or replace function public.purchase_apply(
  p_user uuid, p_txn text, p_product text, p_store text default null)
returns json language plpgsql security definer set search_path = public as $$
declare n int; t public.tickets;
begin
  if p_user is null or p_txn is null or p_product is null then
    return json_build_object('ok', false, 'why', 'bad_args');
  end if;

  select boxes into n from public.parcel_products where product_id = p_product and live;
  if n is null then return json_build_object('ok', false, 'why', 'unknown_product'); end if;

  /* **먼저 넣어 본다.** 이미 있으면 아무것도 안 준다 — 웹훅이 다시 와도, 두 번이
     동시에 와도 여기서 한 번만 통과한다. */
  insert into public.purchases(txn_id, user_id, product_id, boxes, store)
       values (p_txn, p_user, p_product, n, p_store)
  on conflict (txn_id) do nothing;
  if not found then
    return json_build_object('ok', true, 'already', true);
  end if;

  insert into public.tickets(user_id) values (p_user) on conflict (user_id) do nothing;
  update public.tickets set balance = balance + n, updated_at = now()
   where user_id = p_user returning * into t;

  return json_build_object('ok', true, 'already', false, 'boxes', n, 'balance', t.balance);
end $$;

-- 환불. 상자를 이미 써 버렸으면 **음수로 만들지 않는다** — 장부가 음수가 되면
-- 그 뒤의 모든 판정이 이상해진다. 남은 만큼만 거둬들이고 그 사실을 적는다.
create or replace function public.purchase_refund(p_txn text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.purchases; back int; t public.tickets;
begin
  select * into r from public.purchases where txn_id = p_txn;
  if r is null then return json_build_object('ok', false, 'why', 'notfound'); end if;
  select * into t from public.tickets where user_id = r.user_id;
  back := least(coalesce(t.balance, 0), r.boxes);
  update public.tickets set balance = balance - back, updated_at = now()
   where user_id = r.user_id returning * into t;
  delete from public.purchases where txn_id = p_txn;
  return json_build_object('ok', true, 'taken', back, 'of', r.boxes, 'balance', t.balance);
end $$;

revoke all on function public.purchase_apply(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.purchase_refund(text)                  from public, anon, authenticated;
grant execute on function public.purchase_apply(uuid, text, text, text) to service_role;
grant execute on function public.purchase_refund(text)                  to service_role;
