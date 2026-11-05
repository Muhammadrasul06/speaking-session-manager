create table if not exists profiles (
  user_id text primary key,
  full_name text,
  surname text,
  group_code text,
  role text not null default 'STUDENT',
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id serial primary key,
  name text not null
);

insert into locations (id, name)
select 1, 'Location A' where not exists (select 1 from locations where id = 1);
insert into locations (id, name)
select 2, 'Location B' where not exists (select 1 from locations where id = 2);

create table if not exists sessions (
  id serial primary key,
  title text not null,
  session_date date not null,
  start_time text not null,
  end_time text not null,
  duration_minutes integer not null,
  break_minutes integer not null default 0,
  booking_status text not null default 'CLOSED',
  location_id integer,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists slots (
  id serial primary key,
  session_id integer not null references sessions(id) on delete cascade,
  start_time text not null,
  end_time text not null,
  is_available boolean not null default true
);

create table if not exists bookings (
  id serial primary key,
  slot_id integer not null unique references slots(id),
  session_id integer not null references sessions(id) on delete cascade,
  student_id text not null,
  full_name text not null,
  surname text not null,
  group_code text not null,
  status text not null default 'BOOKED',
  score numeric,
  admin_note text,
  actual_start timestamptz,
  actual_end timestamptz,
  booked_at timestamptz not null default now()
);

create table if not exists notifications (
  id serial primary key,
  user_id text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id);
