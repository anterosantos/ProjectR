# Secrets Rotation Policy

**Status:** Policy established 2026-05-09 (Code Review, Story 1.2)  
**Next Review:** 2026-08-09 (quarterly)

---

## Secret Rotation Schedule

| Secret | Rotation Cadence | Trigger | Owner | Notes |
|--------|------------------|---------|-------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Quarterly (90 days) | **Immediate** if exposed | Antero | Full DB access; highest risk. Update Vercel + GitHub Actions secrets. |
| `RESEND_API_KEY` | Quarterly (90 days) | **Immediate** if exposed | Antero | Email sending; scope-limited. Update Vercel env vars. |
| `VAPID_PUBLIC_KEY` | Before Phase 2 launch | Scheduled | Antero | Web push; public-facing. Regenerate with `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | Before Phase 2 launch | Scheduled | Antero | Web push; private. Regenerate with `npx web-push generate-vapid-keys`. |
| `BACKUP_ENCRYPTION_KEY` | After each restore test | On-demand | Antero | Backup encryption. Rotate after validating restore procedure. Generate via `openssl rand -base64 32`. |

---

## Rotation Procedure

### Supabase Service Role Key

1. **Supabase Dashboard:** Settings → API → copy **new** service_role key
2. **Vercel:** Settings → Environment Variables → update `SUPABASE_SERVICE_ROLE_KEY`
3. **GitHub Actions:** Secrets & Variables → update `SUPABASE_SERVICE_ROLE_KEY`
4. **Local dev:** Update `sparta/.env.local` SUPABASE_SERVICE_ROLE_KEY value
5. **Verification:** Run `npm run test --run` to confirm API access works
6. **Documentation:** Update this file with rotation date

### Resend API Key

1. **Resend Dashboard:** API Keys → create **new** key (or rotate existing)
2. **Vercel:** Settings → Environment Variables → update `RESEND_API_KEY`
3. **GitHub Actions:** Secrets & Variables → update `RESEND_API_KEY` (if used in workflows)
4. **Local dev:** Update `sparta/.env.local` RESEND_API_KEY value
5. **Verification:** Test email send via Story 1.5+ endpoint
6. **Documentation:** Update this file with rotation date

### VAPID Keys (Web Push)

1. **Local:** `npx web-push generate-vapid-keys` → copy new public + private keys
2. **Update:** `sparta/.env.local` and Vercel environment variables
3. **Notification:** All clients subscribed to push via old public key must re-subscribe with new key
4. **Timing:** Coordinate before Phase 2 to minimize disruption

### Backup Encryption Key

1. **Generate:** `openssl rand -base64 32` → 256-bit key
2. **Update:** `sparta/.env.local` and GitHub Actions secrets (`BACKUP_ENCRYPTION_KEY`)
3. **Test:** Restore from encrypted backup to validate key works
4. **Timing:** After quarterly backup restore drill (Story 1.15 testing)

---

## Incident Response: Exposed Secret

If a secret is exposed (committed to git, visible in logs, shared accidentally):

1. **Immediate:** Rotate the secret using the procedure above
2. **Audit:** Check git history for exposure timeline (when was it committed?)
3. **Revoke:** If in Supabase/Vercel/Resend, revoke old key at provider
4. **Notify:** If multi-member team, notify team of rotation
5. **Document:** Update Change Log below with date, secret type, and action taken

---

## Change Log

| Date | Secret | Action | Notes |
|------|--------|--------|-------|
| 2026-05-09 | All | Policy established | Created as part of Code Review (Story 1.2) |
