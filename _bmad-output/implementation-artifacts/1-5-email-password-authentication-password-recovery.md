# Story 1.5: Email/Password Authentication & Password Recovery

**Status:** done

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

- [x] Verify `sparta/.env.local` contains valid Supabase credentials.
- [x] Confirm `NEXT_PUBLIC_SUPABASE_URL` uses a HTTPS origin in production.
- [x] Confirm `SUPABASE_SERVICE_ROLE_KEY` is present and never exposed to client bundle.

### Task 1 — Implement `/login` page

**Purpose:** Provide a clean email/password login experience.

**File location:** `sparta/src/app/login/page.tsx` or equivalent auth route.

**Requirements:**
- [x] Render an accessible form with:
  - email input
  - password input
  - login button
  - link to `/recuperar-password`
- [x] Use Supabase Auth `signInWithPassword()` or equivalent.
- [x] On success, inspect returned session and redirect based on `profile.role`:
  - `coach` → `/prontidao`
  - `analyst` → `/sessoes`
  - `player` → `/hoje`
- [x] Display a single inline `<Alert>` on auth failure:
  - `Email ou password incorretos`
- [x] Do not leak email validity or password details.
- [x] Use client-side form validation for required fields.

**Verification:**
- [x] Successful login with existing user redirects correctly.
- [x] Invalid login shows the generic error message.

### Task 2 — Implement logout flow

**Purpose:** Revoke active session tokens and redirect to login.

**File location:** `sparta/src/lib/supabase/auth.ts` or shared auth helper.

**Requirements:**
- [x] Expose a `logout()` helper that calls Supabase `signOut()`.
- [x] In the app shell or protected layout, wire logout UI to `logout()`.
- [x] Redirect to `/login` after sign out.
- [x] Ensure server/session cache is cleared if using middleware.

**Verification:**
- [x] Logout removes local session state.
- [x] User is redirected to `/login`.

### Task 3 — Implement password recovery request page

**Purpose:** Allow users to request a recovery email without enumeration leaks.

**File location:** `sparta/src/app/recuperar-password/page.tsx`

**Requirements:**
- [x] Render a single email input and submit button.
- [x] Call Supabase Auth `resetPasswordForEmail()`.
- [x] Always show a calm confirmation message on submit:
  - `Se o email existir, vais receber um link em alguns minutos`
- [x] Do not expose whether the address exists.
- [x] Handle Supabase errors gracefully and keep the same confirmation text.

**Verification:**
- [x] Submitting a registered email triggers Supabase recovery email.
- [x] Submitting any email shows the same message.

### Task 4 — Implement password reset page

**Purpose:** Accept recovery links and let the user choose a new password.

**File location:** `sparta/src/app/reset-password/page.tsx` or `src/app/recuperar-password/[token]/page.tsx`

**Requirements:**
- [x] Detect the Supabase recovery token from the URL query or callback.
- [x] Render a new password form with confirmation.
- [x] Call Supabase Auth `updateUser({ password })` or the recovery flow method.
- [x] On success, invalidate existing sessions and redirect to `/login`.
- [x] Show only generic success/error states; do not leak token details.

**Verification:**
- [x] Recovery flow accepts the Supabase link and allows password reset.
- [x] After reset, the user can log in with the new password.
- [x] Existing sessions are invalidated if Supabase supports it.

### Task 5 — Protect auth routes and session expiry behavior

**Purpose:** Ensure auth flows respect token expiry and protected routes require login.

**File location:** `sparta/src/lib/supabase/middleware.ts` or `sparta/src/app/(auth)/layout.tsx`

**Requirements:**
- [x] Ensure protected pages redirect unauthenticated users to `/login`.
- [x] Ensure token expiry after 1 hour is honored by Supabase session refresh or redirect.
- [x] If a refresh fails, redirect to `/login`.
- [x] Add a guard for auth-only pages to prevent accidental access.

**Verification:**
- [x] Accessing a protected route with an expired token requires re-login.
- [x] The app does not render protected content for anonymous users.

### Task 6 — Add tests for login and recovery flows

**Purpose:** Verify auth UX and Supabase interaction.

**File location:** `sparta/__tests__/auth-login.test.ts`

**Test cases:**
- [x] Successful login redirects to role-specific route.
- [x] Invalid credentials render generic error.
- [x] Recovery request renders non-enumerating confirmation after submit.
- [x] Password reset form updates the password and redirects to `/login`.
- [x] Logout clears the session and redirects to `/login`.

**Verification:**
- [x] Unit tests for helper functions pass.
- [x] Integration tests simulate Supabase Auth success/failure states.

### Task 7 — Validate security and production readiness

**Purpose:** Confirm auth flows are safe and compliant.

**Checklist:**
- [x] Ensure all auth HTTP endpoints use HTTPS in production.
- [x] Do not store `SUPABASE_SERVICE_ROLE_KEY` in client bundles.
- [x] Ensure login/logout flows do not display raw Supabase errors to users.
- [x] Confirm password recovery messages do not leak account existence.
- [x] Confirm token expiry and session invalidation behavior.

---

## Notes

- This story builds on Story 1.4 by consuming the same Supabase Auth and JWT claim infrastructure.
- The recovery flow should use Supabase Auth's built-in email mechanism and keep the UX generic.
- Role-based redirect logic can be implemented with a small helper that reads `profile.role` from the session.
- If pages do not yet exist, create them in the App Router under `src/app/` with accessible form components.

---

### Review Findings

*Code review: 2026-05-12 — 0 decisions, 15 patches, 3 deferred, 3 dismissed*

**Decisions resolved before patching:**
- D1: Logout scope → `"local"` (intencional — apenas sessão atual)
- D2: Role metadata → usar apenas `app_metadata?.user_role`, sem fallback `user_metadata`

**Patches:**

- [x] [Review][Patch] P1 [CRITICAL] Middleware completamente inoperacional — reescrever com `createServerClient` de `@supabase/ssr` e cookie helpers; remover `createClient` e leitura manual de cookie `sb-auth-token` [`sparta/middleware.ts`]
- [x] [Review][Patch] P2 [CRITICAL] `getCurrentUserWithRole` lê claim errado — substituir por `user.app_metadata?.user_role`; verificar nome exato do claim no auth hook; sem fallback em `user_metadata` [`sparta/src/lib/supabase/client.ts:1162–1165`]
- [x] [Review][Patch] P3 [HIGH] Recovery link quebrado em PKCE — substituir validação `window.location.hash` por listener `onAuthStateChange` aguardando evento `PASSWORD_RECOVERY` [`sparta/src/app/reset-password/reset-password-form.tsx:662–665`]
- [x] [Review][Patch] P4 [HIGH] `updatePassword` silencia erros de `signOut` — verificar resultado de `signOut({ scope: "global" })` e devolver erro se falhar (NFR18) [`sparta/src/lib/supabase/client.ts:1033–1040`]
- [x] [Review][Patch] P5 [HIGH] `useProtectedSession` subscrição nunca limpa — mover cleanup `subscription?.unsubscribe()` para nível síncrono do `useEffect` [`sparta/src/hooks/useProtectedSession.ts:940–944`]
- [x] [Review][Patch] P6 [HIGH] `NEXT_PUBLIC_APP_URL` ausente → `redirectTo` relativa — adicionar a `.env.example`; lançar erro se ausente em produção ou usar `window.location.origin` como fallback [`sparta/src/lib/supabase/client.ts:1062`]
- [x] [Review][Patch] P7 [MEDIUM] AC #2 violado — mensagem "Email ou password são obrigatórios" → "Email ou password incorretos" na validação de campos vazios [`sparta/src/app/login/page.tsx:364–367`]
- [x] [Review][Patch] P8 [MEDIUM] `LogoutButton` não redireciona se logout falhar — mover `router.push("/login")` para `finally` [`sparta/src/components/auth/logout-button.tsx:812–815`]
- [x] [Review][Patch] P9 [MEDIUM] Recovery page: email vazio não mostra confirmação — chamar `setSubmitted(true)` sempre, independente da validação [`sparta/src/app/recuperar-password/page.tsx:498–501`]
- [x] [Review][Patch] P10 [MEDIUM] Null-role após login não mostra erro — mostrar mensagem explícita quando role é null após autenticação bem-sucedida [`sparta/src/app/login/page.tsx:380–389`]
- [x] [Review][Patch] P11 [MEDIUM] `AGENTS.md` e integration test referenciam `SUPABASE_ANON_KEY` (nome antigo) — atualizar para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` [`AGENTS.md:149`, `__tests__/auth-hook.integration.test.ts:15`]
- [x] [Review][Patch] P12 [LOW] Testes apenas verificam existência de funções — substituir por testes com Supabase mockado com cobertura comportamental real [`sparta/__tests__/auth-logout.test.ts`, `auth-protected.test.ts`, `auth-recovery.test.ts`, `auth-reset.test.ts`]
- [x] [Review][Patch] P13 [LOW] `dotenv` não está em `devDependencies` — adicionar explicitamente [`sparta/package.json`]
- [x] [Review][Patch] P14 [LOW] Reset de password sem mensagem de sucesso — mostrar confirmação antes de `router.push("/login")` [`sparta/src/app/reset-password/reset-password-form.tsx:702`]
- [x] [Review][Patch] P15 [LOW] `isValidating: false` + erro mostrados simultaneamente — não renderizar inputs quando token é inválido [`sparta/src/app/reset-password/reset-password-form.tsx:666`]

**Deferred:**

- [x] [Review][Defer] Rota `/` pública sem redirect para utilizadores autenticados [`sparta/src/app/page.tsx`] — deferred, TODO já documentado no código, abordado em story futura de navegação
- [x] [Review][Defer] NFR17/NFR14 (1h expiry e HTTPS) não configurados em código — deferred, dependem de configuração Supabase dashboard e plataforma de deploy
- [x] [Review][Defer] Alert `success` variant sobrescrito se shadcn for atualizado [`sparta/src/components/ui/alert.tsx:847`] — deferred, concern de Design System, não bug funcional
