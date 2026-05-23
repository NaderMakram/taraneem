-- Run this in Supabase SQL Editor if you see:
--   permission denied for table devices | 42501
--
-- Safe to run multiple times.

GRANT USAGE ON SCHEMA taraneem_analytics TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA taraneem_analytics TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA taraneem_analytics
  GRANT INSERT, UPDATE ON TABLES TO anon;

-- RLS (re-apply)
ALTER TABLE taraneem_analytics.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE taraneem_analytics.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taraneem_analytics.content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE taraneem_analytics.local_song_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "te_devices_insert" ON taraneem_analytics.devices;
DROP POLICY IF EXISTS "te_devices_update" ON taraneem_analytics.devices;
CREATE POLICY "te_devices_anon_all" ON taraneem_analytics.devices
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "te_sessions_insert" ON taraneem_analytics.sessions;
DROP POLICY IF EXISTS "te_sessions_update" ON taraneem_analytics.sessions;
CREATE POLICY "te_sessions_anon_all" ON taraneem_analytics.sessions
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "te_content_insert" ON taraneem_analytics.content_events;
CREATE POLICY "te_content_anon_all" ON taraneem_analytics.content_events
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "te_local_songs_insert" ON taraneem_analytics.local_song_events;
CREATE POLICY "te_local_songs_anon_all" ON taraneem_analytics.local_song_events
  FOR ALL TO anon USING (true) WITH CHECK (true);
