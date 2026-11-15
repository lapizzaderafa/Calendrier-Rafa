-- Phase test, seuil de lancement validé par Rafa : 25 pizzas au total par jeudi.
-- La capacité de production (3 pizzas/20 min) reste séparée de ce maximum commercial.
create or replace function public.rafa_jeudis_capacity_candidate(
 p_date date,
 p_time text default null,
 p_qty integer default 0
)
returns boolean
language plpgsql volatile security definer
set search_path=''
as $$
declare
 v_total integer;
 v_slot text;
 v_i integer;
 v_used integer;
 v_cars integer;
 v_windows integer[] := array_fill(0,array[12],array[0]);
 v_job record;
 v_left integer;
 v_take integer;
 v_idx integer;
begin
 if p_date is null or (p_time is not null and
   (p_time !~ '^(17|18|19|20):(00|20|40)$' or p_qty<1))
   or (p_time is null and p_qty<>0) then return false;end if;
 select coalesce(sum(o.pizza_qty),0)+p_qty into v_total
 from public.rafa_jeudis_orders o
 where o.pickup_date=p_date and o.status<>'cancelled';
 -- Ce n'est pas un plafond marketing, mais la capacité théorique
 -- de 12 périodes de 20 minutes avec un débit de 3 pizzas chacune.
 if v_total>25 or v_total<0 then return false;end if;
 for v_i in 0..11 loop
  v_slot:=to_char((time '17:00'+v_i*interval '20 minutes')::time,'HH24:MI');
  select coalesce(sum((p.value->>'qty')::integer),0)::integer,
   count(distinct o.id)::integer
   into v_used,v_cars
  from public.rafa_jeudis_orders o
  cross join lateral jsonb_array_elements(o.pickups) p(value)
  where o.pickup_date=p_date and o.status<>'cancelled'
    and p.value->>'time'=v_slot;
  if p_time=v_slot then v_cars:=v_cars+1;end if;
  if v_cars>2 then return false;end if;
 end loop;

 -- Chaque commande utilise les périodes de travail à compter de
 -- son créneau, et peut occuper les créneaux suivants.
 -- Exemple : 20 pizzas à 17 h occupent 7 périodes (17h à 19h20).
 for v_job in
  select (((split_part(p.value->>'time',':',1)::integer-17)*60
           +split_part(p.value->>'time',':',2)::integer)/20) as idx,
         (p.value->>'qty')::integer as qty
  from public.rafa_jeudis_orders o
  cross join lateral jsonb_array_elements(o.pickups) p(value)
  where o.pickup_date=p_date and o.status<>'cancelled'
  union all
  select (((split_part(p_time,':',1)::integer-17)*60
           +split_part(p_time,':',2)::integer)/20) as idx,
         p_qty as qty
  where p_time is not null and p_qty>0
  order by idx
 loop
  if v_job.idx not between 0 and 11 or v_job.qty<1 then return false;end if;
  v_left:=v_job.qty;
  for v_idx in v_job.idx..11 loop
   v_take:=least(v_left,greatest(0,3-coalesce(v_windows[v_idx],0)));
   v_windows[v_idx]:=coalesce(v_windows[v_idx],0)+v_take;
   v_left:=v_left-v_take;
   exit when v_left=0;
  end loop;
  if v_left>0 then return false;end if;
 end loop;
 return true;
end;
$$;
revoke all on function public.rafa_jeudis_capacity_candidate(date,text,integer)
 from public,anon,authenticated;

create or replace function public.rafa_jeudis_availability(p_date date)
returns table (
 pickup_time text,
 pizzas_used integer,
 cars_used integer,
 pizzas_left integer,
 day_left integer,
 blocked boolean
)
language plpgsql volatile security definer
set search_path=''
as $$
declare
 v_settings public.rafa_jeudis_settings%rowtype;
 v_total integer;
 v_i integer;
 v_slot text;
 v_paused boolean;
 v_low integer;
 v_high integer;
 v_mid integer;
begin
 select coalesce(sum(o.pizza_qty),0)::integer into v_total
 from public.rafa_jeudis_orders o
 where o.pickup_date=p_date and o.status<>'cancelled';
 select * into v_settings from public.rafa_jeudis_settings s where s.pickup_date=p_date;
 for v_i in 0..11 loop
  v_slot:=to_char((time '17:00'+v_i*interval '20 minutes')::time,'HH24:MI');
  v_paused:=coalesce(v_settings.paused,false)
    or v_slot=any(coalesce(v_settings.closed_slots,'{}'::text[]));
  v_low:=0;
  if not v_paused then
   v_high:=greatest(0,25-v_total);
   -- Recherche binaire : quantité maximale qui peut réellement
   -- tenir dans le planning à partir de ce créneau.
   while v_low<v_high loop
    v_mid:=(v_low+v_high+1)/2;
    if public.rafa_jeudis_capacity_candidate(p_date,v_slot,v_mid) then
     v_low:=v_mid;
    else
     v_high:=v_mid-1;
    end if;
   end loop;
  end if;
  return query
  select v_slot,
    coalesce(sum((p.value->>'qty')::integer),0)::integer,
    count(distinct o.id)::integer,
    v_low,
    greatest(0,25-v_total)::integer,
    v_paused
  from public.rafa_jeudis_orders o
  cross join lateral jsonb_array_elements(o.pickups) p(value)
  where o.pickup_date=p_date and o.status<>'cancelled'
    and p.value->>'time'=v_slot;
 end loop;
end;
$$;
revoke all on function public.rafa_jeudis_availability(date)
 from public,anon,authenticated;
grant execute on function public.rafa_jeudis_availability(date) to anon,authenticated;

