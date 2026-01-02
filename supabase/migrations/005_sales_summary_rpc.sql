-- Fast dashboard aggregates via SQL (avoids large table fetch + avoids PostgREST aggregate edge cases)
-- Safe to run multiple times.

create or replace function public.po_sales_summary(p_user_id uuid)
returns table (
  total_profit numeric,
  total_revenue numeric,
  total_sales bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(coalesce(profit, 0)), 0) as total_profit,
    coalesce(sum(coalesce(selling_price, sale_price, 0)), 0) as total_revenue,
    count(*)::bigint as total_sales
  from public.sales
  where user_id = p_user_id
    and deleted_at is null;
$$;


