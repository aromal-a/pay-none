-- Set search_path on update_updated_at_column and lock down execute privileges
create or replace function public.update_updated_at_column()
returns trigger language plpgsql
security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.credit_tokens(uuid, integer) from public, anon, authenticated;