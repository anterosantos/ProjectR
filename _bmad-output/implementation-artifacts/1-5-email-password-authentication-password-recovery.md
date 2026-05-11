# Story 1.5: Email/Password Authentication & Password Recovery

**Status:** ready-for-dev

**Story ID:** 1.5
**Epic:** Epic 1 - Fundação Técnica, Identidade & Acesso Multi-Clube
**Created:** 2026-05-11

---

## Story

As a Treinador, Analista or Jogador,
I want to log in with email and password and recover my password by email,
So that I can access the system independently and recover from forgotten credentials without admin help.

---

## Acceptance Criteria

### AC #1: Email/password login

**Given** a user on `/login`
**When** they submit valid email + password
**Then** they are authenticated via Supabase Auth
**And** redirected to their role's home route:
- `/prontidao` for coach
- `/sessoes` for analyst
- `/hoje` for player
(AR1 / FR1)

### AC #2: Invalid credentials error messaging

**Given** a user on `/login` with invalid credentials
**When** they submit
**Then** an inline `<Alert>` displays exactly:
- `Email ou password incorretos`
**And** the UI does not reveal whether email or password was wrong.

### AC #3: Logout revokes session

**Given** a logged-in user
**When** they trigger logout
**Then** session tokens are revoked
**And** the user is redirected to `/login`.

### AC #4: Password recovery request

**Given** a user on `/recuperar-password`
**When** they submit a registered email
**Then** Supabase Auth sends a recovery email
**And** the UI shows a calm confirmation message:
- `Se o email existir, vais receber um link em alguns minutos`
**And** the flow avoids account enumeration.

### AC #5: Password reset via recovery link

**Given** a recovery link is clicked
**When** the user submits a new password
**Then** the password is updated
**And** all existing sessions are invalidated (NFR18)
**And** the user is redirected to `/login`.

### AC #6: Session expiry + transport security

**Given** session inactivity
**When** 1 hour passes without activity
**Then** the access token expires (NFR17)
**And** the user is redirected to `/login` on next protected request.

**Given** the TLS requirement (NFR14)
**When** any auth request is made
**Then** it is over HTTPS only.

---

## Tasks / Subtasks

### Task 0 — Confirm Supabase Auth baseline

- [ ] Verify `project-r/.env.local` contains valid Supabase credentials.
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_URL` uses a HTTPS origin in production.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is present and never exposed to client bundle.

### Task 1 — Implement `/login` page

**Purpose:** Provide a clean email/password login experience.

**File location:** `project-r/src/app/login/page.tsx` or equivalent auth route.

**Requirements:**
- [ ] Render an accessible form with:
  - email input
  - password input
  - login button
  - link to `/recuperar-password`
- [ ] Use Supabase Auth `signInWithPassword()` or equivalent.
- [ ] On success, inspect returned session and redirect based on `profile.role`:
  - `coach` → `/prontidao`
  - `analyst` → `/sessoes`
  - `player` → `/hoje`
- [ ] Display a single inline `<Alert>` on auth failure:
  - `Email ou password incorretos`
- [ ] Do not leak email validity or password details.
- [ ] Use client-side form validation for required fields.

**Verification:**
- [ ] Successful login with existing user redirects correctly.
- [ ] Invalid login shows the generic error message.

### Task 2 — Implement logout flow

**Purpose:** Revoke active session tokens and redirect to login.

**File location:** `project-r/src/lib/supabase/auth.ts` or shared auth helper.

**Requirements:**
- [ ] Expose a `logout()` helper that calls Supabase `signOut()`.
- [ ] In the app shell or protected layout, wire logout UI to `logout()`.
- [ ] Redirect to `/login` after sign out.
- [ ] Ensure server/session cache is cleared if using middleware.

**Verification:**
- [ ] Logout removes local session state.
- [ ] User is redirected to `/login`.

### Task 3 — Implement password recovery request page

**Purpose:** Allow users to request a recovery email without enumeration leaks.

**File location:** `project-r/src/app/recuperar-password/page.tsx`

**Requirements:**
- [ ] Render a single email input and submit button.
- [ ] Call Supabase Auth `resetPasswordForEmail()`.
- [ ] Always show a calm confirmation message on submit:
  - `Se o email existir, vais receber um link em alguns minutos`
- [ ] Do not expose whether the address exists.
- [ ] Handle Supabase errors gracefully and keep the same confirmation text.

**Verification:**
- [ ] Submitting a registered email triggers Supabase recovery email.
- [ ] Submitting any email shows the same message.

### Task 4 — Implement password reset page

**Purpose:** Accept recovery links and let the user choose a new password.

**File location:** `project-r/src/app/reset-password/page.tsx` or `src/app/recuperar-password/[token]/page.tsx`

**Requirements:**
- [ ] Detect the Supabase recovery token from the URL query or callback.
- [ ] Render a new password form with confirmation.
- [ ] Call Supabase Auth `updateUser({ password })` or the recovery flow method.
- [ ] On success, invalidate existing sessions and redirect to `/login`.
- [ ] Show only generic success/error states; do not leak token details.

**Verification:**
- [ ] Recovery flow accepts the Supabase link and allows password reset.
- [ ] After reset, the user can log in with the new password.
- [ ] Existing sessions are invalidated if Supabase supports it.

### Task 5 — Protect auth routes and session expiry behavior

**Purpose:** Ensure auth flows respect token expiry and protected routes require login.

**File location:** `project-r/src/lib/supabase/middleware.ts` or `project-r/src/app/(auth)/layout.tsx`

**Requirements:**
- [ ] Ensure protected pages redirect unauthenticated users to `/login`.
- [ ] Ensure token expiry after 1 hour is honored by Supabase session refresh or redirect.
- [ ] If a refresh fails, redirect to `/login`.
- [ ] Add a guard for auth-only pages to prevent accidental access.

**Verification:**
- [ ] Accessing a protected route with an expired token requires re-login.
- [ ] The app does not render protected content for anonymous users.

### Task 6 — Add tests for login and recovery flows

**Purpose:** Verify auth UX and Supabase interaction.

**File location:** `project-r/__tests__/auth-login.test.ts`

**Test cases:**
- [ ] Successful login redirects to role-specific route.
- [ ] Invalid credentials render generic error.
- [ ] Recovery request renders non-enumerating confirmation after submit.
- [ ] Password reset form updates the password and redirects to `/login`.
- [ ] Logout clears the session and redirects to `/login`.

**Verification:**
- [ ] Unit tests for helper functions pass.
- [ ] Integration tests simulate Supabase Auth success/failure states.

### Task 7 — Validate security and production readiness

**Purpose:** Confirm auth flows are safe and compliant.

**Checklist:**
- [ ] Ensure all auth HTTP endpoints use HTTPS in production.
- [ ] Do not store `SUPABASE_SERVICE_ROLE_KEY` in client bundles.
- [ ] Ensure login/logout flows do not display raw Supabase errors to users.
- [ ] Confirm password recovery messages do not leak account existence.
- [ ] Confirm token expiry and session invalidation behavior.

---

## Notes

- This story builds on Story 1.4 by consuming the same Supabase Auth and JWT claim infrastructure.
- The recovery flow should use Supabase Auth's built-in email mechanism and keep the UX generic.
- Role-based redirect logic can be implemented with a small helper that reads `profile.role` from the session.
- If pages do not yet exist, create them in the App Router under `src/app/` with accessible form components.
