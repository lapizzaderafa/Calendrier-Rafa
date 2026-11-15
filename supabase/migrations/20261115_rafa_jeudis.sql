-- Les Jeudis Rafa — MIGRATION À VALIDER EN ENVIRONNEMENT DE TEST
-- IMPORTANT: ne pas exécuter sur la production sans sauvegarde et approbation.
-- Modèle de production test : 3 pizzas / 20 minutes de travail,
-- une heure de retrait unique pour 1 à 6 pizzas ; chaque commande peut
-- utiliser les 40 minutes précédentes. 2 véhicules / heure de retrait,
-- 30 pizzas maximum par jeudi. Ces limites doivent être validées au four.
-- Les horaires sont validés par le serveur dans une transaction verrouillée.

create table if not exists public.rafa_jeudis_menu (
  pizza text primary key,
  description text not null default '',
  position integer not null default 100,
  active boolean not null default false
);

alter table public.rafa_jeudis_menu enable row level security;
revoke all on table public.rafa_jeudis_menu from anon, authenticated;
grant select on public.rafa_jeudis_menu to anon, authenticated;
grant insert, update, delete on public.rafa_jeudis_menu to authenticated;

create table if not exists public.rafa_jeudis_settings (
  pickup_date date primary key,
  paused boolean not null default false,
  closed_slots text[] not null default '{}'::text[],
  pickup_address text,
  pickup_instructions text
);

alter table public.rafa_jeudis_settings enable row level security;
revoke all on table public.rafa_jeudis_settings from anon, authenticated;
grant select, insert, update, delete on public.rafa_jeudis_settings to authenticated;

create table if not exists public.rafa_jeudis_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  pickup_date date not null,
  pickups jsonb not null check (jsonb_typeof(pickups) = 'array'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  pizza_qty integer not null check (pizza_qty between 1 and 6),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  payment_method text not null check (payment_method in ('cash','interac')),
  paid boolean not null default false,
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'pending' check(status in ('pending','preparing','ready','delivered','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  delivered_at timestamptz
);

create index if not exists rafa_jeudis_orders_date_status
  on public.rafa_jeudis_orders(pickup_date,status);

alter table public.rafa_jeudis_orders enable row level security;
revoke all on table public.rafa_jeudis_orders from anon, authenticated;
grant select on public.rafa_jeudis_orders to authenticated;

-- Vérifie le vrai utilisateur connecté, pas simplement une adresse saisie dans un formulaire.
create or replace function public.rafa_jeudis_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from auth.users u
  where u.id = auth.uid()
    and lower(u.email) = 'raphael.frenette@gmail.com'
 );
$$;

revoke all on function public.rafa_jeudis_is_admin() from public;
grant execute on function public.rafa_jeudis_is_admin() to authenticated;

drop policy if exists rafa_jeudis_orders_admin_read on public.rafa_jeudis_orders;
create policy rafa_jeudis_orders_admin_read on public.rafa_jeudis_orders
  for select to authenticated using (public.rafa_jeudis_is_admin());

drop policy if exists rafa_jeudis_settings_admin on public.rafa_jeudis_settings;
create policy rafa_jeudis_settings_admin on public.rafa_jeudis_settings
  for all to authenticated
  using (public.rafa_jeudis_is_admin())
  with check (public.rafa_jeudis_is_admin());

drop policy if exists rafa_jeudis_menu_public_read on public.rafa_jeudis_menu;
create policy rafa_jeudis_menu_public_read on public.rafa_jeudis_menu
  for select to anon,authenticated using (active);

drop policy if exists rafa_jeudis_menu_admin_read on public.rafa_jeudis_menu;
create policy rafa_jeudis_menu_admin_read on public.rafa_jeudis_menu
  for select to authenticated using (public.rafa_jeudis_is_admin());

drop policy if exists rafa_jeudis_menu_admin_write on public.rafa_jeudis_menu;
create policy rafa_jeudis_menu_admin_write on public.rafa_jeudis_menu
  for all to authenticated
  using (public.rafa_jeudis_is_admin())
  with check (public.rafa_jeudis_is_admin());

-- Les 4 recettes sont une SÉLECTION TEST; l'administrateur peut les changer.
insert into public.rafa_jeudis_menu(pizza,description,position,active) values
 ('Margherita','Mozza fraîche, basilic, parmesan',1,true),
 ('New York','Mozza fraîche, pepperoni finement tranché',2,true),
 ('Mortadella','Mozza fraîche, mortadelle, pistaches, ricotta citronnée',3,true),
 ('Speck','Crème de parmesan, mozza fraîche, speck, noisettes, huile d’olive',4,true)
on conflict (pizza) do nothing;

-- Capacité : inclut les commandes remises car elles ont réellement occupé le créneau.
-- Les commandes ANNULÉES sont exclues. Les suppressions les effacent entièrement.
-- Vérification de capacité avec ou sans une réservation hypothétique.
-- Cette fonction est interne : les rôles publics ne peuvent pas l'appeler directement.
create or replace function public.rafa_jeudis_capacity_candidate(
 p_date date,
 p_time text default null,
 p_qty integer default 0
)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_i integer;
  v_slot text;
  v_qty integer;
  v_cars integer;
  v_windows integer[] := array_fill(0, ARRAY[14], ARRAY[-2]);
  v_job record;
  v_left integer;
  v_win integer;
  v_free integer;
  v_take integer;
begin
 if p_time is not null
   and (p_time !~ '^(17|18|19|20):(00|20|40)$' or p_qty not between 1 and 6)
 then return false; end if;

 select coalesce(sum(o.pizza_qty),0) + p_qty into v_total
 from public.rafa_jeudis_orders o
 where o.pickup_date=p_date and o.status<>'cancelled';
 if v_total>30 then return false;end if;

 for v_i in 0..11 loop
  v_slot:=to_char((time '17:00'+v_i*interval '20 minutes')::time,'HH24:MI');
  select coalesce(sum((p.value->>'qty')::integer),0)::integer,
         count(distinct o.id)::integer
    into v_qty,v_cars
  from public.rafa_jeudis_orders o
  cross join lateral jsonb_array_elements(o.pickups) p(value)
  where o.pickup_date=p_date and o.status<>'cancelled'
    and p.value->>'time'=v_slot;
  if p_time=v_slot then
    v_qty:=v_qty+p_qty;
    v_cars:=v_cars+1;
  end if;
  if v_qty>6 or v_cars>2 then return false; end if;
 end loop;

 -- Affecter des tâches aux 2 tranches de 20 minutes AVANT la cueillette.
 -- Le tri par heure limite le risque de vendre une plage déjà nécessaire
 -- à une remise antérieure.
 for v_job in
   select ((((split_part(p.value->>'time',':',1))::integer-17)*60
               +(split_part(p.value->>'time',':',2))::integer)/20) as idx,
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
   if v_job.idx not between 0 and 11 or v_job.qty not between 1 and 6 then return false; end if;
   v_left:=v_job.qty;
   for v_win in (v_job.idx-2)..(v_job.idx-1) loop
     v_free:=greatest(0,3-coalesce(v_windows[v_win],0));
     v_take:=least(v_left,v_free);
     v_windows[v_win]:=coalesce(v_windows[v_win],0)+v_take;
     v_left:=v_left-v_take;
     exit when v_left=0;
   end loop;
   if v_left>0 then return false; end if;
 end loop;
 return true;
end;
$$;
revoke all on function public.rafa_jeudis_capacity_candidate(date,text,integer) from public;

create or replace function public.rafa_jeudis_capacity_ok(p_date date)
returns boolean
language sql volatile security definer
set search_path = ''
as $$
 select public.rafa_jeudis_capacity_candidate(p_date,null,0);
$$;
revoke all on function public.rafa_jeudis_capacity_ok(date) from public;

-- Cette fonction est publique, mais ne renvoie AUCUN nom, téléphone ni courriel.
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
set search_path = ''
as $$
declare
  v_settings public.rafa_jeudis_settings%rowtype;
  v_slot text;
  v_i integer;
  v_total integer;
  v_max integer;
  v_n integer;
  v_paused boolean;
begin
 select coalesce(sum(o.pizza_qty),0)::integer into v_total
 from public.rafa_jeudis_orders o where o.pickup_date=p_date and o.status<>'cancelled';
 select * into v_settings from public.rafa_jeudis_settings s where s.pickup_date=p_date;
 for v_i in 0..11 loop
  v_slot:=to_char((time '17:00'+v_i*interval '20 minutes')::time,'HH24:MI');
  v_paused:=coalesce(v_settings.paused,false) or v_slot=any(coalesce(v_settings.closed_slots,'{}'::text[]));
  v_max:=0;
  if not v_paused then
   for v_n in reverse 6..1 loop
    if public.rafa_jeudis_capacity_candidate(p_date,v_slot,v_n) then
     v_max:=v_n;exit;
    end if;
   end loop;
  end if;
  return query
   select v_slot,
     coalesce(sum((p.value->>'qty')::integer),0)::integer,
     count(distinct o.id)::integer,
     v_max,
     greatest(0,30-v_total)::integer,
     v_paused
   from public.rafa_jeudis_orders o
   cross join lateral jsonb_array_elements(o.pickups) p(value)
   where o.pickup_date=p_date and o.status<>'cancelled' and p.value->>'time'=v_slot;
 end loop;
end;
$$;

revoke all on function public.rafa_jeudis_availability(date) from public;
grant execute on function public.rafa_jeudis_availability(date) to anon,authenticated;

-- Seule entrée publique pour enregistrer une commande; requête idempotente.
-- Toutes les disponibilités sont revalidées APRÈS verrouillage de la date.
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
set search_path = ''
as $$
declare
 v_local timestamp := transaction_timestamp() at time zone 'America/Toronto';
 v_dow integer;
 v_delta integer;
 v_target date;
 v_settings public.rafa_jeudis_settings%rowtype;
 v_qty integer:=0;
 v_pick_qty integer:=0;
 v_pick_count integer:=0;
 v_last_index integer:=-1;
 v_index integer;
 v_name text;
 v_n integer;
 v_item jsonb;
 v_part jsonb;
 v_time text;
 v_exists uuid;
 v_new uuid;
begin
 if p_request_id is null then raise exception 'request_id_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rafa-jeudis:'||p_date::text,0));

 select id into v_exists from public.rafa_jeudis_orders where request_id=p_request_id;
 if v_exists is not null then return v_exists; end if;

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

 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 6 then
  raise exception 'invalid_items';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item)<>'object' then raise exception 'invalid_item';end if;
  v_name:=v_item->>'pizza';
  if v_name is null or not exists(select 1 from public.rafa_jeudis_menu m where m.pizza=v_name and m.active) then
   raise exception 'pizza_not_on_menu';
  end if;
  if coalesce(v_item->>'qty','') !~ '^[1-9][0-9]*$' then raise exception 'invalid_quantity';end if;
  v_n:=(v_item->>'qty')::integer;
  v_qty:=v_qty+v_n;
 end loop;
 if v_qty<1 or v_qty>6 then raise exception 'order_too_large';end if;

 if jsonb_typeof(p_pickups)<>'array' or jsonb_array_length(p_pickups) <> 1 then
  raise exception 'invalid_pickups';end if;
 for v_part in select value from jsonb_array_elements(p_pickups) loop
   v_time:=v_part->>'time';
   if v_time is null or v_time !~ '^(17|18|19|20):(00|20|40)$' then
    raise exception 'invalid_pickup_time';
   end if;
   v_index:=((split_part(v_time,':',1)::integer-17)*60+split_part(v_time,':',2)::integer)/20;
   if v_last_index>=0 and v_index<>v_last_index+1 then raise exception 'pickups_not_consecutive';end if;
   v_last_index:=v_index;
   if coalesce(v_part->>'qty','') !~ '^[1-6] then raise exception 'invalid_pickup_quantity';end if;
   v_pick_qty:=v_pick_qty+(v_part->>'qty')::integer;
   v_pick_count:=v_pick_count+1;
   if v_time=any(coalesce(v_settings.closed_slots,'{}'::text[])) then raise exception 'slot_closed';end if;
 end loop;
 if v_pick_qty<>v_qty or v_pick_count<>1 then
   raise exception 'allocation_mismatch';
 end if;

 insert into public.rafa_jeudis_orders
  (request_id,pickup_date,pickups,items,pizza_qty,customer_name,customer_email,customer_phone,payment_method,total_cents)
 values
  (p_request_id,p_date,p_pickups,p_items,v_qty,trim(p_name),lower(trim(p_email)),trim(p_phone),p_payment,v_qty*2700)
 returning id into v_new;
 if not public.rafa_jeudis_capacity_ok(p_date) then
  raise exception 'slot_no_longer_available';
 end if;
 return v_new;
end;
$$;

revoke all on function public.rafa_jeudis_reserve(date,jsonb,jsonb,text,text,text,text,uuid) from public;
grant execute on function public.rafa_jeudis_reserve(date,jsonb,jsonb,text,text,text,text,uuid) to anon,authenticated;

-- Retrouver sa confirmation à partir de la clé unique connue du client.
-- Ne retourne pas les coordonnées personnelles; adresse seulement après réservation.
create or replace function public.rafa_jeudis_confirmation(p_request_id uuid)
returns table (
  order_id uuid,
  pickup_date date,
  pickups jsonb,
  items jsonb,
  total_cents integer,
  status text,
  pickup_address text,
  pickup_instructions text
)
language sql stable security definer
set search_path = ''
as $$
 select o.id,o.pickup_date,o.pickups,o.items,o.total_cents,o.status,
        s.pickup_address,s.pickup_instructions
 from public.rafa_jeudis_orders o
 left join public.rafa_jeudis_settings s on s.pickup_date=o.pickup_date
 where o.request_id=p_request_id;
$$;
revoke all on function public.rafa_jeudis_confirmation(uuid) from public;
grant execute on function public.rafa_jeudis_confirmation(uuid) to anon,authenticated;

-- Actions de gestion : annulation conservée, suppression irréversible,
-- remise, paiement, rétablissement sous verrou et contrôle de capacité.
create or replace function public.rafa_jeudis_admin_action(
 p_id uuid, p_action text
)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_date date;
  v_status text;
begin
 if not public.rafa_jeudis_is_admin() then raise exception 'admin_only';end if;
 select pickup_date,status into v_date,v_status from public.rafa_jeudis_orders where id=p_id;
 if not found then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('rafa-jeudis:'||v_date::text,0));
 select status into v_status from public.rafa_jeudis_orders where id=p_id for update;
 if p_action='cancel' then
  if v_status='delivered' then raise exception 'already_delivered';end if;
  update public.rafa_jeudis_orders
  set status='cancelled',cancelled_at=now() where id=p_id;
 elsif p_action='restore' then
  if v_status<>'cancelled' then raise exception 'not_cancelled';end if;
  update public.rafa_jeudis_orders
  set status='pending',cancelled_at=null where id=p_id;
  if not public.rafa_jeudis_capacity_ok(v_date) then raise exception 'restore_would_overbook';end if;
 elsif p_action='delete' then
  delete from public.rafa_jeudis_orders where id=p_id;
 elsif p_action='delivered' then
  if v_status='cancelled' then raise exception 'cancelled_order';end if;
  update public.rafa_jeudis_orders
  set status='delivered',delivered_at=now() where id=p_id;
 elsif p_action='preparing' then
  if v_status='cancelled' then raise exception 'cancelled_order';end if;
  update public.rafa_jeudis_orders set status='preparing' where id=p_id;
 elsif p_action='ready' then
  if v_status='cancelled' then raise exception 'cancelled_order';end if;
  update public.rafa_jeudis_orders set status='ready' where id=p_id;
 elsif p_action='paid' then
  update public.rafa_jeudis_orders set paid=true where id=p_id;
 elsif p_action='unpaid' then
  update public.rafa_jeudis_orders set paid=false where id=p_id;
 else
  raise exception 'invalid_admin_action';
 end if;
 return true;
end;
$$;

revoke all on function public.rafa_jeudis_admin_action(uuid,text) from public;
grant execute on function public.rafa_jeudis_admin_action(uuid,text) to authenticated;

comment on table public.rafa_jeudis_orders is 'Les Jeudis Rafa: utiliser uniquement les fonctions RPC pour les écritures; tester avant production.';
