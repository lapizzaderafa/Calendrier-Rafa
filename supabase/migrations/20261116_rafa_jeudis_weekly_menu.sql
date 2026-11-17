-- Les Jeudis Rafa: permanent menu and weekly pizza by Thursday. TEST ONLY.
insert into public.rafa_jeudis_menu(pizza,description,position,active)
values
  ('Margherita','Mozza fraîche, basilic, parmesan',101,false),
  ('New York','Mozza fraîche, pepperoni finement tranché',102,false),
  ('Sicilia','Mozza fraîche, jambon, olives Kalamata, artichauts grillés, ricotta citronnée, origan',103,false),
  ('’Nduja e miel','Mozza fraîche, saucisson épicé de Calabre, gorgonzola, miel épicé',104,false),
  ('Parma','Mozza fraîche, prosciutto, roquette, parmesan, balsamique',105,false),
  ('Jardin','Tomates, ail confit, stracciatella, pesto de basilic',106,false),
  ('Pesca Rossa','Pêches grillées, chèvre, amandes effilées, basilic, balsamique',107,false),
  ('Montréal','Mozza fraîche, smoked meat du Québec, cornichons, crème à la moutarde, aneth',108,false),
  ('Bosco','Pesto de basilic, chanterelles, capocollo, stracciatella',109,false),
  ('Quattro','Mozza fraîche, pecorino, gorgonzola, comté, poivre noir',110,false),
  ('Fungus','Champignons du moment, stracciatella, ciboulette',111,false),
  ('Patata','Mozza fraîche, pommes de terre dorées, pecorino, romarin',112,false),
  ('Cipolla','Mozza fraîche, bacon fumé, confit d''oignon, thym',113,false),
  ('Figus','Mozza fraîche, guanciale, confit de figues, romarin',114,false),
  ('Acciuga','Mozza fraîche, tomates cerises confites, anchois, stracciatella, basilic',115,false),
  ('Mortadella','Mozza fraîche, mortadelle, pistaches, ricotta citronnée',116,false),
  ('Zucca e Salsiccia','Crème de courge butternut, mozza fraîche, saucisse italienne, sauge',117,false),
  ('Speck','Crème de parmesan, mozza fraîche, speck, noisettes concassées et huile d''olive',118,false)
on conflict(pizza) do nothing;

insert into public.rafa_jeudis_menu(pizza,description,position,active)
values ('Fungus','Champignons du moment, stracciatella, ciboulette',5,true)
on conflict(pizza) do update set description=excluded.description,position=excluded.position,active=true;

create table if not exists public.rafa_jeudis_weekly(
 pickup_date date primary key,
 pizza text not null references public.rafa_jeudis_menu(pizza) on update cascade on delete restrict,
 updated_at timestamptz not null default now(),
 constraint rafa_jeudis_weekly_thursday check (extract(dow from pickup_date)=4)
);
alter table public.rafa_jeudis_weekly enable row level security;
revoke all on table public.rafa_jeudis_weekly from public,anon,authenticated;
grant select,insert,update,delete on table public.rafa_jeudis_weekly to authenticated;
drop policy if exists rafa_jeudis_weekly_admin on public.rafa_jeudis_weekly;
create policy rafa_jeudis_weekly_admin on public.rafa_jeudis_weekly for all to authenticated
using (public.rafa_jeudis_is_admin()) with check (public.rafa_jeudis_is_admin());

insert into public.rafa_jeudis_weekly(pickup_date,pizza)
values ('2026-11-19','Quattro')
on conflict(pickup_date) do update set pizza=excluded.pizza,updated_at=now();

create or replace function public.rafa_jeudis_menu_for_date(p_date date)
returns table(pizza text,description text,"position" integer,is_weekly boolean)
language sql stable security definer set search_path=''
as $$
 select m.pizza,m.description,
        (case when w.pizza is not null then 0 else m.position end)::integer as position,
        (w.pizza is not null) as is_weekly
 from public.rafa_jeudis_menu m
 left join public.rafa_jeudis_weekly w on w.pickup_date=p_date and w.pizza=m.pizza
 where m.active or w.pizza is not null
 order by (w.pizza is not null) desc,m.position,m.pizza
$$;
revoke all on function public.rafa_jeudis_menu_for_date(date) from public,anon,authenticated;
grant execute on function public.rafa_jeudis_menu_for_date(date) to anon,authenticated;

-- Weekly-only names are accepted by the reservation RPC only for this pickup date.
CREATE OR REPLACE FUNCTION public.rafa_jeudis_reserve(p_date date, p_pickups jsonb, p_items jsonb, p_name text, p_email text, p_phone text, p_payment text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   select 1 from public.rafa_jeudis_menu m
   where m.pizza=v_name and (m.active or exists (
     select 1 from public.rafa_jeudis_weekly w
     where w.pickup_date=p_date and w.pizza=m.pizza
   ))
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
$function$

