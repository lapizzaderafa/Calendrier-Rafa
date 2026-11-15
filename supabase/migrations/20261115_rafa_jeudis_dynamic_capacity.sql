-- Rafa Jeudis — réservation dynamique de la capacité de production.
-- Environnement de test UNIQUEMENT. Aucune limite arbitraire par commande.
-- Capacité physique expérimentale : 3 pizzas / 20 min × 12 plages.
-- Une grosse commande réserve une plage de travail de durée variable
-- à partir de l'heure choisie; les plages suivantes deviennent indisponibles.
-- Les remises de gros volume doivent être validées opérationnellement.
alter table public.rafa_jeudis_orders
 drop constraint if exists rafa_jeudis_orders_pizza_qty_check;
alter table public.rafa_jeudis_orders
 add constraint rafa_jeudis_orders_pizza_qty_check check (pizza_qty>=1);

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
 if v_total>36 or v_total<0 then return false;end if;
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
   v_high:=greatest(0,36-v_total);
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
    greatest(0,36-v_total)::integer,
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

create or replace function public.rafa_jeudis_reserve(
 p_date date,
 p_pickups jsonb,
 p_items jsonb,
 p_name text,
 p_email text,
 p_phone text,
 p_payment text,
 p_request_id uuid
)
returns uuid
language plpgsql volatile security definer
set search_path=''
as $$
declare
 v_local timestamp := transaction_timestamp() at time zone 'America/Toronto';
 v_dow integer;
 v_delta integer;
 v_target date;
 v_settings public.rafa_jeudis_settings%rowtype;
 v_qty integer:=0;
 v_pick_qty integer:=0;
 v_name text;
 v_n integer;
 v_item jsonb;
 v_part jsonb;
 v_time text;
 v_exists uuid;
 v_new uuid;
begin
 if p_request_id is null then raise exception 'request_id_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('rafa-jeudis:'||p_date::text,0));
 select id into v_exists from public.rafa_jeudis_orders where request_id=p_request_id;
 if v_exists is not null then return v_exists;end if;
 v_dow:=extract(dow from v_local)::integer;
 v_delta:=(4-v_dow+7)%7;
 if v_delta=0 then v_delta:=7;end if;
 v_target:=v_local::date+v_delta;
 if p_date<>v_target or (v_dow=3 and v_local::time>=time '12:00') then
  raise exception 'booking_window_closed';
 end if;
 if length(trim(coalesce(p_name,'')))<2 or length(p_name)>120
    or length(trim(coalesce(p_email,'')))<5 or length(p_email)>180
    or position('@' in p_email)<2
    or length(trim(coalesce(p_phone,'')))<7 or length(p_phone)>35 then
  raise exception 'invalid_contact';
 end if;
 if p_payment not in ('cash','interac') then raise exception 'invalid_payment';end if;
 select * into v_settings from public.rafa_jeudis_settings where pickup_date=p_date;
 if coalesce(v_settings.paused,false) then raise exception 'bookings_paused';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then
  raise exception 'invalid_items';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item)<>'object' then raise exception 'invalid_item';end if;
  v_name:=v_item->>'pizza';
  if v_name is null or not exists (
   select 1 from public.rafa_jeudis_menu m where m.pizza=v_name and m.active
  ) then raise exception 'pizza_not_on_menu';end if;
  if coalesce(v_item->>'qty','') !~ '^[1-9][0-9]{0,3}$' then
   raise exception 'invalid_quantity';end if;
  v_n:=(v_item->>'qty')::integer;
  v_qty:=v_qty+v_n;
 end loop;
 if v_qty<1 then raise exception 'invalid_quantity';end if;
 if jsonb_typeof(p_pickups)<>'array' or jsonb_array_length(p_pickups)<>1 then
  raise exception 'invalid_pickups';end if;
 v_part:=p_pickups->0;
 v_time:=v_part->>'time';
 if v_time is null or v_time !~ '^(17|18|19|20):(00|20|40)$' then
  raise exception 'invalid_pickup_time';end if;
 if coalesce(v_part->>'qty','') !~ '^[1-9][0-9]{0,3}$' then
  raise exception 'invalid_pickup_quantity';end if;
 v_pick_qty:=(v_part->>'qty')::integer;
 if v_pick_qty<>v_qty then raise exception 'allocation_mismatch';end if;
 if v_time=any(coalesce(v_settings.closed_slots,'{}'::text[])) then
  raise exception 'slot_closed';end if;
 if not public.rafa_jeudis_capacity_candidate(p_date,v_time,v_qty) then
  raise exception 'slot_no_longer_available';end if;
 insert into public.rafa_jeudis_orders
  (request_id,pickup_date,pickups,items,pizza_qty,customer_name,customer_email,customer_phone,payment_method,total_cents)
 values
  (p_request_id,p_date,p_pickups,p_items,v_qty,trim(p_name),
   lower(trim(p_email)),trim(p_phone),p_payment,v_qty*2700)
 returning id into v_new;
 return v_new;
end;
$$;
revoke all on function public.rafa_jeudis_reserve(date,jsonb,jsonb,text,text,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.rafa_jeudis_reserve(date,jsonb,jsonb,text,text,text,text,uuid)
 to anon,authenticated;
