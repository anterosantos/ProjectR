# Auth Hook Configuration Diagnostic Guide

## Current Issue
JWT missing `user_role` and `club_id` custom claims after user login, causing RLS policy failures (403 Forbidden) on player_metrics insertion.

## Quick Verification Checklist

### Step 1: Verify Auth Hook Configuration in Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your SPARTA project
3. Navigate to **Authentication** → **Hooks** tab (if this tab doesn't exist, the hook may not be configured yet)
4. Look for **Custom Access Token Hook** section
5. Verify:
   - [ ] Hook is **enabled** (toggle should be ON/green)
   - [ ] Hook type is **Edge Function**
   - [ ] Selected function is **auth-hook**
   - [ ] Webhook URL is displayed

**If hook doesn't exist:**
1. Click **Create Hook** or **+ Add Hook**
2. Select **Custom Access Token Hook**
3. Choose **Edge Function** as type
4. Select **auth-hook** from the dropdown
5. Click **Save**

### Step 2: Check Edge Functions Logs

1. Still in Supabase Dashboard
2. Navigate to **Edge Functions** section
3. Select **auth-hook** function
4. Click **Logs** tab
5. Look for recent invocations when you logged in
6. Check for:
   - [ ] Function invoked during login
   - [ ] Any error messages (red text)
   - [ ] Response status: should be 200

**If logs show errors:**
- Note the error message
- Common errors:
  - `Missing Supabase environment variables` → Environment variables not set
  - `Could not fetch profile` → Profile doesn't exist for user
  - Database connection errors → Profiles table might be inaccessible

### Step 3: Verify User Profile Data

1. Navigate to **SQL Editor** in Supabase Dashboard
2. Run this query (replace email with test user's email):

```sql
SELECT id, club_id, role 
FROM profiles 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'coach@test.test'
);
```

Expected result: One row with:
- `id`: UUID (user ID)
- `club_id`: UUID (club ID)
- `role`: One of 'coach', 'analyst', 'player'

**If no results:**
- The user has no profile entry
- Auth Hook will gracefully skip claim injection (by design)
- Create profile using:

```sql
INSERT INTO profiles (id, club_id, role, full_name) 
SELECT 
  id,
  '019e1666-1339-7f13-b30f-f582c7887d63'::uuid, -- Replace with valid club_id
  'coach',  -- or 'analyst', 'player'
  'Test User'
FROM auth.users 
WHERE email = 'coach@test.test'
ON CONFLICT (id) DO NOTHING;
```

### Step 4: Test JWT Claims Injection

1. Open browser **DevTools** (F12)
2. Go to **Application** → **Local Storage**
3. Log out completely
4. Log back in
5. Find the auth token (usually in localStorage as `sb-<project-id>-auth-token`)
6. Copy the JWT (the `access_token` value, which starts with `eyJ`)
7. Go to [jwt.io](https://jwt.io)
8. Paste JWT in "Encoded" section
9. Look at "Decoded" section → **Payload** tab
10. Check for:
    - [ ] `club_id` field (should be UUID)
    - [ ] `user_role` field (should be 'coach', 'analyst', or 'player')
    - [ ] `sub` field (user ID)

**If claims are missing:**
- Auth Hook is either not being called or not injecting claims
- Check Edge Function logs (Step 2)
- Verify Auth Hook is enabled (Step 1)

## Troubleshooting Steps

### If Auth Hook isn't enabled in Dashboard:

```bash
# You can verify via Supabase CLI
supabase auth hooks list

# Should show something like:
# id                                    type                    function_name
# 019e1666...                          custom_access_token     auth-hook
```

### If hook needs redeployment:

```bash
cd sparta

# Check if hook is deployed
supabase functions list

# Redeploy the auth hook
supabase functions deploy auth-hook --project-id <YOUR_PROJECT_ID>
```

### If profile data is missing:

Use SQL Editor to verify and create profiles for test users:

```sql
-- Check all users without profiles
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Create profiles for missing users
INSERT INTO profiles (id, club_id, role, full_name)
SELECT 
  u.id,
  c.id,  -- First club's ID, or specific club
  'coach',
  u.email
FROM auth.users u
CROSS JOIN (SELECT id FROM clubs LIMIT 1) c
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = u.id)
ON CONFLICT (id) DO NOTHING;
```

## Expected JWT Claims After Fix

```json
{
  "sub": "user-id-uuid",
  "email": "user@test.test",
  "club_id": "club-id-uuid",
  "user_role": "coach",
  "role": "authenticated",
  "aud": "authenticated",
  "exp": 1715960000
}
```

## Next Steps After Verification

1. ✅ Confirm Auth Hook is enabled and function is auth-hook
2. ✅ Verify user profile exists with valid club_id and role
3. ✅ Check Edge Function logs show successful invocations
4. ✅ Decode JWT and verify `club_id` and `user_role` claims present
5. ✅ Test RLS policy with claim-injected JWT (should succeed for valid queries)

## Related Issues

- **Issue 4 (Fixed):** `user_role()` function now queries correct JWT claim name
- **Current Issue:** JWT missing claims, suggesting Auth Hook not working
- **RLS Policy:** Requires both `club_id` and `user_role` claims for multi-tenant isolation

---

**Note:** All diagnostic steps use standard Supabase Dashboard UI. No CLI commands required for verification, only for redeployment if needed.
