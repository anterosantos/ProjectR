-- Fix: Storage policies using direct profiles lookup instead of JWT claims
-- Run this in Supabase SQL Editor if the auth hook is not yet configured.
-- This version works without the auth-hook Edge Function.

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Read own club photos" ON storage.objects;
DROP POLICY IF EXISTS "Upload to own club" ON storage.objects;
DROP POLICY IF EXISTS "Update own club photos" ON storage.objects;
DROP POLICY IF EXISTS "Delete own club photos" ON storage.objects;

-- Policy 1: Read photos from own club (lookup via profiles)
CREATE POLICY "Read own club photos" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policy 2: Upload photos to own club (coach/analyst only)
CREATE POLICY "Upload to own club" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('coach', 'analyst')
  );

-- Policy 3: Update photos in own club (coach/analyst only)
CREATE POLICY "Update own club photos" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('coach', 'analyst')
  );

-- Policy 4: Delete photos in own club (coach/analyst only)
CREATE POLICY "Delete own club photos" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = (
      SELECT club_id::text FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('coach', 'analyst')
  );
