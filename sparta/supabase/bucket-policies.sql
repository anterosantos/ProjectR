-- Supabase Storage Bucket Policies
-- These policies should be created manually via Supabase Console or executed in the SQL Editor
-- Bucket: player-photos (private, EU region)
-- Path pattern: <club_id>/<player_id>.<ext>

-- Policy 1: Authenticated users can read photos from their club
CREATE POLICY "Read own club photos" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = public.club_id()::text
  );

-- Policy 2: Analysts and coaches can upload photos to their club
CREATE POLICY "Upload to own club" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = public.club_id()::text
    AND public.user_role() IN ('coach', 'analyst')
  );

-- Policy 3: Analysts and coaches can update photos in their club
CREATE POLICY "Update own club photos" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = public.club_id()::text
    AND public.user_role() IN ('coach', 'analyst')
  );

-- Policy 4: Analysts and coaches can delete photos from their club
CREATE POLICY "Delete own club photos" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = public.club_id()::text
    AND public.user_role() IN ('coach', 'analyst')
  );

-- MANUAL SETUP STEPS:
-- 1. Create bucket in Supabase Console:
--    - Storage > Buckets > New Bucket
--    - Name: player-photos
--    - Private: YES
--    - Region: EU (ensure fra1 or similar)
--
-- 2. Execute these policies in Supabase SQL Editor:
--    - Copy policies above (or create via RLS console)
--    - Run in SQL Editor
--
-- 3. Verify RLS is enabled:
--    - SELECT * FROM storage.buckets WHERE name = 'player-photos';
--    - Should show public = false
