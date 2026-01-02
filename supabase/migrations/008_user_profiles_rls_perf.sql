-- Optimize user_profiles RLS policies by preventing per-row re-evaluation of auth.* calls.
-- Safe to run multiple times.

do $$
begin
  -- SELECT
  begin
    execute format('alter policy %I on public.user_profiles using ((select auth.uid()) = id);', 'Users can view their own profile');
  exception when undefined_object then null;
  end;

  -- INSERT
  begin
    execute format('alter policy %I on public.user_profiles with check ((select auth.uid()) = id);', 'Users can insert their own profile');
  exception when undefined_object then null;
  end;

  -- UPDATE
  begin
    execute format('alter policy %I on public.user_profiles using ((select auth.uid()) = id);', 'Users can update their own profile');
  exception when undefined_object then null;
  end;
end $$;


