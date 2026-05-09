-- Migration: 000020_clubs_profiles
-- Purpose: Create foundational multi-tenant tables (clubs & profiles) with RLS enabled
-- Scope: Multi-tenant scoping via club_id; every data table extends this pattern

-- Create 'clubs' table (multi-tenant container)
CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  country text,
  created_at timestamptz DEFAULT now()
);

-- Add index on created_at for audit queries (future stories)
CREATE INDEX idx_clubs_created_at ON clubs(created_at);

-- Add comment
COMMENT ON TABLE clubs IS 'Multi-tenant container. Each club has associated coaches, analysts, players.';
COMMENT ON COLUMN clubs.id IS 'UUIDv7 primary key - sortable and collision-resistant.';

-- Enable RLS on clubs
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

---

-- Create 'profiles' table (user identity & role scoping)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('coach', 'analyst', 'player')),
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for query performance
CREATE INDEX idx_profiles_club ON profiles(club_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Add comments
COMMENT ON TABLE profiles IS 'User profiles linked to auth.users. Scoped by club_id. Roles: coach, analyst, player.';
COMMENT ON COLUMN profiles.id IS 'Foreign key to auth.users.id - ensures 1:1 relationship with Supabase Auth.';
COMMENT ON COLUMN profiles.club_id IS 'Multi-tenant scoping column. Used in all RLS policies.';
COMMENT ON COLUMN profiles.role IS 'Role-based access control: coach (staff), analyst (staff), player (athlete).';

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add grant to service_role for migrations and admin tasks
GRANT SELECT, INSERT, UPDATE ON clubs TO service_role;
GRANT SELECT, INSERT, UPDATE ON profiles TO service_role;
