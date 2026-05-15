-- Multi-tenant seed data for Story 1.6 RLS integration tests
-- Creates 2 clubs × 3 roles × 2 users = 12 test accounts.
-- Run after: supabase db reset

-- =============================================================================
-- CLUBS
-- =============================================================================

INSERT INTO public.clubs (id, name, country, created_at) VALUES
  ('00000000-0000-7000-a000-000000000001', 'Club Alpha', 'PT', now()),
  ('00000000-0000-7000-a000-000000000002', 'Club Beta',  'PT', now())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- AUTH USERS (service-role only — created via Supabase Admin API in real tests)
-- These UUIDs are deterministic for repeatable test fixtures.
-- =============================================================================

-- Club Alpha users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-7000-b000-000000000001', 'coach-a@test.test',   crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000002', 'analyst-a@test.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000003', 'player-a@test.test',  crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
-- Club Beta users
  ('00000000-0000-7000-b000-000000000004', 'coach-b@test.test',   crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000005', 'analyst-b@test.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000006', 'player-b@test.test',  crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PROFILES (created by service-role, mirrors auth hook behaviour)
-- =============================================================================

INSERT INTO public.profiles (id, club_id, role, full_name, created_at, updated_at) VALUES
  ('00000000-0000-7000-b000-000000000001', '00000000-0000-7000-a000-000000000001', 'coach',   'Coach Alpha',   now(), now()),
  ('00000000-0000-7000-b000-000000000002', '00000000-0000-7000-a000-000000000001', 'analyst', 'Analyst Alpha', now(), now()),
  ('00000000-0000-7000-b000-000000000003', '00000000-0000-7000-a000-000000000001', 'player',  'Player Alpha',  now(), now()),
  ('00000000-0000-7000-b000-000000000004', '00000000-0000-7000-a000-000000000002', 'coach',   'Coach Beta',    now(), now()),
  ('00000000-0000-7000-b000-000000000005', '00000000-0000-7000-a000-000000000002', 'analyst', 'Analyst Beta',  now(), now()),
  ('00000000-0000-7000-b000-000000000006', '00000000-0000-7000-a000-000000000002', 'player',  'Player Beta',   now(), now())
ON CONFLICT (id) DO NOTHING;
