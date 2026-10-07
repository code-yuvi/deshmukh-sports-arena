create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  created_at timestamptz not null default now(),
  booking_date date not null,
  slots text[] not null,
  time_label text not null,
  hours integer not null,
  sport text not null,
  customer_name text not null,
  phone text not null default '',
  players text not null default '',
  message text not null default '',
  advance text not null,
  payment text not null check (payment in ('paid', 'unpaid')),
  status text not null check (status in ('inquiry', 'confirmed', 'cancelled')),
  source text not null check (source in ('website', 'admin'))
);

create table if not exists public.booking_slots (
  booking_date date not null,
  slot_id text not null,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  primary key (booking_date, slot_id)
);

alter table public.bookings enable row level security;
alter table public.booking_slots enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'yuvrajd568@gmail.com';
$$;

create or replace function public.taken_slots(from_date date, to_date date)
returns table (booking_date date, slot_id text)
language sql
stable
security definer
set search_path = public
as $$
  select s.booking_date, s.slot_id
  from public.booking_slots s
  where s.booking_date between from_date and to_date;
$$;

create or replace function public.next_order_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select coalesce(max(substring(order_code from 5)::integer), 1000) + 1
  into n
  from public.bookings
  where order_code ~ '^DSA-[0-9]+$';
  return 'DSA-' || n;
end;
$$;

create or replace function public.create_booking(
  p_date date,
  p_slots text[],
  p_time_label text,
  p_sport text,
  p_name text,
  p_phone text,
  p_players text,
  p_message text,
  p_advance text,
  p_payment text,
  p_status text,
  p_source text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.bookings;
  slot text;
  sorted text[];
begin
  if p_source = 'admin' and not public.is_admin() then
    raise exception 'Only staff can create a direct booking';
  end if;
  if p_source = 'website' and p_status <> 'inquiry' then
    raise exception 'Website bookings start as inquiries';
  end if;
  if p_status not in ('inquiry', 'confirmed') or p_payment not in ('paid', 'unpaid') then
    raise exception 'Invalid booking';
  end if;
  if p_source not in ('website', 'admin') then
    raise exception 'Invalid booking';
  end if;
  if coalesce(array_length(p_slots, 1), 0) < 1 or array_length(p_slots, 1) > 3 then
    raise exception 'Choose 1 to 3 hours';
  end if;

  select array_agg(item order by item) into sorted from unnest(p_slots) as item;

  insert into public.bookings (
    order_code, booking_date, slots, time_label, hours, sport,
    customer_name, phone, players, message, advance, payment, status, source
  ) values (
    public.next_order_code(), p_date, sorted, p_time_label, array_length(sorted, 1), p_sport,
    trim(p_name), trim(coalesce(p_phone, '')), coalesce(p_players, ''), coalesce(p_message, ''),
    p_advance, p_payment, p_status, p_source
  ) returning * into booking;

  foreach slot in array sorted loop
    insert into public.booking_slots (booking_date, slot_id, booking_id)
    values (p_date, slot, booking.id);
  end loop;

  return booking;
exception
  when unique_violation then
    raise exception 'That hour is already booked';
end;
$$;

create or replace function public.admin_bookings()
returns setof public.bookings
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;
  return query
  select * from public.bookings
  order by booking_date desc, created_at desc;
end;
$$;

create or replace function public.update_booking(p_id uuid, p_status text default null, p_payment text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.bookings;
  slot text;
begin
  if not public.is_admin() then
    raise exception 'Staff only';
  end if;

  select * into booking from public.bookings where id = p_id;
  if not found then
    raise exception 'Order not found';
  end if;
  if p_status is not null and p_status not in ('inquiry', 'confirmed', 'cancelled') then
    raise exception 'Invalid status';
  end if;
  if p_payment is not null and p_payment not in ('paid', 'unpaid') then
    raise exception 'Invalid payment';
  end if;

  if p_status is not null and p_status <> 'cancelled' and booking.status = 'cancelled' then
    foreach slot in array booking.slots loop
      insert into public.booking_slots (booking_date, slot_id, booking_id)
      values (booking.booking_date, slot, booking.id);
    end loop;
  end if;

  if p_status = 'cancelled' then
    delete from public.booking_slots where booking_id = booking.id;
  end if;

  update public.bookings
  set status = coalesce(p_status, status),
      payment = coalesce(p_payment, payment)
  where id = p_id
  returning * into booking;

  return booking;
exception
  when unique_violation then
    raise exception 'That hour is already taken by another order';
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.taken_slots(date, date) from public;
revoke all on function public.next_order_code() from public;
revoke all on function public.create_booking(date, text[], text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.admin_bookings() from public;
revoke all on function public.update_booking(uuid, text, text) from public;

grant execute on function public.taken_slots(date, date) to anon, authenticated;
grant execute on function public.create_booking(date, text[], text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_bookings() to authenticated;
grant execute on function public.update_booking(uuid, text, text) to authenticated;
