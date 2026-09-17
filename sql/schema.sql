-- SeatBook database schema and security
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text default '',
  venue text not null check (length(trim(venue)) > 0),
  starts_at timestamptz not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  rows integer not null check (rows between 1 and 20),
  cols integer not null check (cols between 1 and 20),
  created_at timestamptz not null default now(),
  check (starts_at > created_at)
);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  unique(event_id,label)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'booked' check(status in ('booked','cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists one_active_booking_per_seat
on public.bookings(seat_id) where status='booked';

alter table public.events enable row level security;
alter table public.seats enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Anyone can read events" on public.events;
create policy "Anyone can read events" on public.events for select using (true);

drop policy if exists "Owner can update events" on public.events;
create policy "Owner can update events" on public.events for update using (auth.uid()=owner_id) with check (auth.uid()=owner_id);

drop policy if exists "Owner can delete events" on public.events;
create policy "Owner can delete events" on public.events for delete using (auth.uid()=owner_id);

drop policy if exists "Anyone can read seats" on public.seats;
create policy "Anyone can read seats" on public.seats for select using (true);

drop policy if exists "Users read own bookings" on public.bookings;
create policy "Users read own bookings" on public.bookings for select using (auth.uid()=user_id);

drop policy if exists "Owners read event bookings" on public.bookings;
create policy "Owners read event bookings" on public.bookings for select using (
  exists(select 1 from public.events e where e.id=bookings.event_id and e.owner_id=auth.uid())
);

-- All event/seat creation is performed by this function.
create or replace function public.create_event_with_seats(
  p_title text,p_description text,p_venue text,p_starts_at timestamptz,
  p_price numeric,p_rows integer,p_cols integer
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare eid uuid; r integer; c integer;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  if p_starts_at <= now() then raise exception 'Event date must be in the future.'; end if;
  if p_price < 0 then raise exception 'Price must be 0 or more.'; end if;
  if p_rows not between 1 and 20 or p_cols not between 1 and 20 then raise exception 'Rows and columns must be between 1 and 20.'; end if;
  if length(trim(p_title))=0 or length(trim(p_venue))=0 then raise exception 'Title and venue are required.'; end if;

  insert into public.events(owner_id,title,description,venue,starts_at,price,rows,cols)
  values(auth.uid(),trim(p_title),coalesce(p_description,''),trim(p_venue),p_starts_at,p_price,p_rows,p_cols)
  returning id into eid;

  for r in 1..p_rows loop
    for c in 1..p_cols loop
      insert into public.seats(event_id,label)
      values(eid, chr(64+r)||c);
    end loop;
  end loop;
  return eid;
end $$;

grant execute on function public.create_event_with_seats(text,text,text,timestamptz,numeric,integer,integer) to authenticated;

create or replace function public.book_seats(p_event_id uuid,p_seat_ids uuid[])
returns json
language plpgsql security definer set search_path=public
as $$
declare n integer; s uuid; label text; eid uuid; result json;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  n := coalesce(array_length(p_seat_ids,1),0);
  if n < 1 then raise exception 'Select at least one seat.'; end if;
  if n > 4 then raise exception 'Maximum 4 seats per booking.'; end if;
  if exists(select 1 from public.events where id=p_event_id and starts_at<=now()) then raise exception 'You cannot book a past event.'; end if;
  if not exists(select 1 from public.events where id=p_event_id) then raise exception 'Event not found.'; end if;
  if exists(select 1 from unnest(p_seat_ids) x group by x having count(*)>1) then raise exception 'A seat was selected more than once.'; end if;
  if exists(select 1 from unnest(p_seat_ids) x where not exists(select 1 from public.seats where id=x and event_id=p_event_id)) then raise exception 'One or more seats do not belong to this event.'; end if;

  -- The partial unique index is the final concurrency guarantee.
  -- If two transactions race for the same seat, PostgreSQL allows only one
  -- active row to exist; the losing transaction aborts atomically.
  begin
    insert into public.bookings(seat_id,event_id,user_id,status)
    select x,p_event_id,auth.uid(),'booked' from unnest(p_seat_ids) x;
  exception when unique_violation then
    select s.label into label from public.seats s
    join public.bookings b on b.seat_id=s.id
    where b.event_id=p_event_id and b.status='booked'
      and s.id = any(p_seat_ids) limit 1;
    raise exception 'Seat % was just booked by someone else.', coalesce(label,'one of your selected seats');
  end;
  return json_build_object('success',true,'count',n);
end $$;

grant execute on function public.book_seats(uuid,uuid[]) to authenticated;

create or replace function public.cancel_booking(p_booking_id uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare st text; starts timestamptz;
begin
  select b.status,e.starts_at into st,starts
  from public.bookings b join public.events e on e.id=b.event_id
  where b.id=p_booking_id and b.user_id=auth.uid()
  for update;
  if not found then raise exception 'Booking not found.'; end if;
  if st <> 'booked' then raise exception 'Booking is already cancelled.'; end if;
  if starts <= now() then raise exception 'Bookings cannot be cancelled after the event starts.'; end if;
  update public.bookings set status='cancelled' where id=p_booking_id and user_id=auth.uid();
  return true;
end $$;

grant execute on function public.cancel_booking(uuid) to authenticated;
