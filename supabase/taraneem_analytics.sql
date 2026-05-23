-- Taraneem Elsoora analytics schema (run in your existing Supabase project)
--
-- REQUIRED after running this SQL (fixes PGRST106 "schema must be one of: public, graphql_public"):
--   Dashboard → Project Settings → API → "Exposed schemas"
--   Add: taraneem_analytics   (keep public and graphql_public checked)
--   Click Save
-- Wait ~1 minute, then restart the app.

create extension if not exists "pgcrypto";

create schema if not exists taraneem_analytics;

grant usage on schema taraneem_analytics to anon, authenticated, service_role;
grant all on all tables in schema taraneem_analytics to service_role;
alter default privileges in schema taraneem_analytics
  grant insert on tables to anon;
alter default privileges in schema taraneem_analytics
  grant select, insert, update, delete on tables to service_role;

create table if not exists taraneem_analytics.devices (
  device_id          uuid primary key,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  app_version        text,
  platform           text,
  arch               text,
  locale             text,
  timezone           text,
  display_count      smallint,
  country_code       text,
  region_name        text,
  city               text,
  geo_source         text,
  geo_updated_at     timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists taraneem_analytics.sessions (
  session_id         uuid primary key,
  device_id          uuid not null references taraneem_analytics.devices(device_id) on delete cascade,
  started_at         timestamptz not null,
  ended_at           timestamptz,
  duration_sec       integer,
  app_version        text,
  synced_at          timestamptz default now(),
  created_at         timestamptz not null default now()
);
create index if not exists sessions_device_started on taraneem_analytics.sessions (device_id, started_at desc);

create table if not exists taraneem_analytics.content_events (
  event_id           uuid primary key,
  device_id          uuid not null references taraneem_analytics.devices(device_id) on delete cascade,
  session_id         uuid not null references taraneem_analytics.sessions(session_id) on delete cascade,
  content_type       text not null check (content_type in ('song','bible_chapter','bible_verse','blank')),
  content_ref        text not null,
  title              text,
  verse_number       text,
  started_at         timestamptz not null,
  ended_at           timestamptz,
  duration_ms        integer not null default 0,
  app_version        text,
  created_at         timestamptz not null default now()
);
create index if not exists content_events_device_session on taraneem_analytics.content_events (device_id, session_id);
create index if not exists content_events_ref on taraneem_analytics.content_events (content_ref);

create table if not exists taraneem_analytics.local_song_events (
  event_id           uuid primary key,
  device_id          uuid not null references taraneem_analytics.devices(device_id) on delete cascade,
  local_song_id      text not null,
  action             text not null check (action in ('create','update','delete')),
  title              text,
  chorus_first       boolean,
  has_chorus         boolean,
  chorus             jsonb,
  verses             jsonb,
  occurred_at        timestamptz not null,
  app_version        text,
  created_at         timestamptz not null default now()
);
create index if not exists local_song_events_device on taraneem_analytics.local_song_events (device_id, occurred_at desc);
create index if not exists local_song_events_song on taraneem_analytics.local_song_events (local_song_id);

-- Table-level grants (SELECT needed for PostgREST upsert conflict checks)
grant select, insert, update on all tables in schema taraneem_analytics to anon;
grant insert, update on taraneem_analytics.devices to anon;
grant insert, update on taraneem_analytics.sessions to anon;
grant insert on taraneem_analytics.content_events to anon;
grant insert on taraneem_analytics.local_song_events to anon;

alter table taraneem_analytics.devices enable row level security;
alter table taraneem_analytics.sessions enable row level security;
alter table taraneem_analytics.content_events enable row level security;
alter table taraneem_analytics.local_song_events enable row level security;

drop policy if exists "te_devices_insert" on taraneem_analytics.devices;
create policy "te_devices_insert" on taraneem_analytics.devices
  for insert to anon with check (true);

drop policy if exists "te_devices_update" on taraneem_analytics.devices;
create policy "te_devices_update" on taraneem_analytics.devices
  for update to anon using (true) with check (true);

drop policy if exists "te_sessions_insert" on taraneem_analytics.sessions;
create policy "te_sessions_insert" on taraneem_analytics.sessions
  for insert to anon with check (true);

drop policy if exists "te_sessions_update" on taraneem_analytics.sessions;
create policy "te_sessions_update" on taraneem_analytics.sessions
  for update to anon using (true) with check (true);

drop policy if exists "te_content_insert" on taraneem_analytics.content_events;
create policy "te_content_insert" on taraneem_analytics.content_events
  for insert to anon with check (true);

drop policy if exists "te_local_songs_insert" on taraneem_analytics.local_song_events;
create policy "te_local_songs_insert" on taraneem_analytics.local_song_events
  for insert to anon with check (true);
