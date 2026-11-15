-- New test project only: limit function access to the intended API operations.
revoke all on function public.rafa_jeudis_is_admin() from public,anon,authenticated;
revoke all on function public.rafa_jeudis_capacity_candidate(date,text,integer) from public,anon,authenticated;
revoke all on function public.rafa_jeudis_capacity_ok(date) from public,anon,authenticated;
revoke all on function public.rafa_jeudis_admin_action(uuid,text) from public,anon,authenticated;
revoke all on function public.rafa_jeudis_availability(date) from public,anon,authenticated;
revoke all on function public.rafa_jeudis_reserve(date,jsonb,jsonb,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.rafa_jeudis_confirmation(uuid) from public,anon,authenticated;
grant execute on function public.rafa_jeudis_is_admin() to authenticated;
grant execute on function public.rafa_jeudis_admin_action(uuid,text) to authenticated;
grant execute on function public.rafa_jeudis_availability(date) to anon,authenticated;
grant execute on function public.rafa_jeudis_reserve(date,jsonb,jsonb,text,text,text,text,uuid) to anon,authenticated;
grant execute on function public.rafa_jeudis_confirmation(uuid) to anon,authenticated;