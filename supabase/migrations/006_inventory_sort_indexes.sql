-- Indexes to speed up common inventory sorts/filters
-- Safe to run multiple times.

create index if not exists inventory_items_user_purchase_date_idx
  on public.inventory_items (user_id, purchase_date desc);

create index if not exists inventory_items_user_status_idx
  on public.inventory_items (user_id, status);


