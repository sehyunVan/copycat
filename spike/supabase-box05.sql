-- box_5 를 Play 에서 지웠다 → 그 코드는 그 앱에서 다시 못 쓴다(구글 정책).
-- 다섯 개짜리는 box_05 로 간다. Supabase SQL 편집기에 그대로 붙여 넣는다.

-- 1) 새 코드로 판다
insert into public.parcel_products (product_id, boxes, label, sort, live)
values ('box_05', 5, '상자 5개', 1, true)
on conflict (product_id) do update
  set boxes = excluded.boxes, label = excluded.label,
      sort  = excluded.sort,  live  = true;

-- 2) 옛 코드는 **지우지 않고 내린다.** 지우면 그 코드로 결제한 웹훅이 늦게 왔을 때
--    purchase_apply 가 unknown_product 로 떨어진다. 안 팔리게만 한다.
update public.parcel_products set live = false where product_id = 'box_5';

-- 3) 확인 — 파는 것 셋이 스토어에 등록한 코드와 같아야 한다
select product_id, boxes, sort, live from public.parcel_products order by sort;
