# Authentication Testing Guide

## Overview
This guide documents how to test the authentication flow to ensure we don't regress on the fixed issues.

## Test Suite Structure

### 1. Middleware Tests (`src/__tests__/middleware.test.ts`)
Tests the proxy middleware that handles route access control and user authentication.

**What it validates:**
- ✅ Unauthenticated users are redirected to `/login`
- ✅ Authenticated users without `user_role` claim can navigate to protected routes
- ✅ Authenticated users with `user_role` claim have their route access validated
- ✅ Role-based route validation works (coach → /prontidao, analyst → /sessoes, player → /hoje)
- ✅ Users accessing unauthorized routes are redirected to their role's default route
- ✅ Public routes (/login, /recuperar-password, /consentimento) don't require authentication

**Key Regression Test:**
```typescript
it("should allow authenticated user to navigate to /sessoes even without user_role claim")
```
This specifically validates the fix for the login blocking issue.

### 2. Login Flow Tests (`src/__tests__/auth/login-flow.test.ts`)
Tests the entire login flow and related functions.

**What it validates:**
- ✅ getRoleHomePath function returns correct route for each role
- ✅ API endpoint contract (/api/auth/user-role)
- ✅ Session persistence in localStorage
- ✅ Error handling for various failure scenarios
- ✅ Middleware doesn't block authenticated users
- ✅ Button behavior during loading state

## Running Tests

### Run all tests
```bash
cd sparta
npm run test
```

### Run specific test file
```bash
npm run test -- middleware.test.ts
npm run test -- login-flow.test.ts
```

### Run with coverage
```bash
npm run test -- --coverage
```

### Run in watch mode
```bash
npm run test:watch
```

## Manual Testing Checklist

### Login Happy Path
1. [ ] Go to `/login`
2. [ ] Enter email: `testanalyst@test.test`
3. [ ] Enter password: (check password in Supabase)
4. [ ] Click "Entrar"
5. [ ] Check console logs appear in order:
   - `[Login] redirectToHome called`
   - `[Login] API response status: 200`
   - `[Login] API returned: {user: ..., role: 'analyst', error: undefined}`
   - `[Login] Redirecting to: /sessoes`
   - `[Login] Before router.push() - calling navigation`
   - `[Login] After router.push() - called successfully`
6. [ ] Page redirects to `/sessoes`
7. [ ] Button changes state back to "Entrar"
8. [ ] Session token exists in localStorage: `sb-<project-id>-auth-token`

### Login Error Scenarios
1. [ ] Invalid email → Shows "Email ou password incorretos"
2. [ ] Invalid password → Shows "Email ou password incorretos"
3. [ ] Valid auth but no profile → Shows "Perfil não configurado"
4. [ ] Valid auth but API fails → Shows "Erro ao recuperar dados de sessão"
5. [ ] Page refresh after login → User remains authenticated

### Route Access Tests
1. [ ] Analyst can access: /sessoes, /plantel, /tendencias, /configuracoes
2. [ ] Analyst redirected from: /prontidao (→ /sessoes), /hoje (→ /sessoes)
3. [ ] Coach can access: /prontidao, /calendario, /plantel, /configuracoes
4. [ ] Coach redirected from: /sessoes (→ /prontidao), /hoje (→ /prontidao)
5. [ ] Player can access: /hoje, /historico, /configuracoes
6. [ ] Player redirected from: /sessoes (→ /hoje), /prontidao (→ /hoje)

### Public Route Tests
1. [ ] Can access `/login` without authentication
2. [ ] Can access `/recuperar-password` without authentication
3. [ ] Can access `/reset-password` without authentication
4. [ ] Can access `/consentimento/*` without authentication

### Network Tab Verification
1. [ ] POST `/api/auth/signin` - 200 (password auth)
2. [ ] GET `/api/auth/user-role` - 200 (profile fetch)
3. [ ] Document request and response for each API call

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- [ ] Pull requests
- [ ] Commits to main branch
- [ ] Pre-deployment checks

### Local Pre-commit Hook
```bash
# Before committing auth-related changes
npm run test -- middleware.test.ts login-flow.test.ts
npm run build
```

## Known Issues & Workarounds

### Issue 1: Auth Hook Not Injecting JWT Claims
**Symptom:** `user_role` missing from JWT claims
**Status:** Workaround implemented (middleware tolerates missing claims)
**Permanent Fix:** Configure Auth Hook in Supabase Dashboard

**How to verify:**
1. Decode JWT at [jwt.io](https://jwt.io)
2. Look for `user_role` in payload
3. If missing, Auth Hook needs configuration

### Issue 2: Session Lost on Page Refresh
**Symptom:** User logged in but session lost after refresh
**Status:** Should not happen (Supabase client handles persistence)
**Verify:**
1. Login successfully
2. Refresh page (Ctrl+R or F5)
3. Page should show authenticated state
4. If redirected to /login, session was lost (investigate)

## Future Improvements

1. **Add E2E Tests** - Use Playwright/Cypress for full flow testing
2. **Configure Auth Hook** - Properly inject `user_role` claim to JWT
3. **Add Performance Tests** - Measure redirect time and API response time
4. **Monitor Login Funnel** - Track login attempts, failures, redirects
5. **Add Rate Limiting** - Prevent brute force attacks on login endpoint

## Debugging

### Enable verbose logging
In `src/app/login/page.tsx`, logs are already added. Check browser DevTools:
- Console tab: All `[Login]` logs
- Network tab: API calls and responses
- Application tab: Local storage (session token)
- Storage tab: Cookies (Supabase session)

### Common Issues to Check

**Button stuck at "A entrar..."**
- Check if all console logs appear through "After router.push()"
- Check Network tab for pending requests
- Check if middleware is blocking navigation (look for 307 redirects)
- Verify user_role claim or user profile exists

**Session not persisting**
- Check if localStorage has `sb-...-auth-token` key
- Check if cookies have Supabase session
- Verify API `/api/auth/user-role` returns 200

**Wrong role being used**
- Check profile in database: SELECT * FROM profiles WHERE id = <user-id>
- Verify API response has correct role
- Check getRoleHomePath maps role correctly

## Related Documentation
- [LOGIN_FIX_SUMMARY.md](./LOGIN_FIX_SUMMARY.md) - Technical details of the fix
- [AUTH_HOOK_DIAGNOSTIC.md](./AUTH_HOOK_DIAGNOSTIC.md) - How to configure Auth Hook
- Story 1.4 - JWT Authentication implementation
- Story 1.9 - Multi-tenant access control
