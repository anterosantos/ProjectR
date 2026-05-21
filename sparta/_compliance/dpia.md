# Data Protection Impact Assessment (DPIA) — SPARTA

> **Status:** ⏳ Draft v0.1 — sign-off required before pilot launch.
> **Story:** 1.2 — initial documentation; refined as the system matures.
> **Trigger:** GDPR Art. 35(3)(a) and (b) — large-scale processing of special category data (Art. 9 health data) AND data of children.

| Field | Value |
|-------|-------|
| Date created | 2026-05-08 |
| Author | Antero Santos |
| Version | 0.1 (Draft) |
| Last reviewed | 2026-05-08 |
| Next review | Before pilot launch |
| Controller | Antero Santos (SPARTA) |
| DPO | None appointed (small-scale pilot — re-evaluate when scaling beyond 1 club) |

---

## 1. Processing Overview

SPARTA is a Progressive Web App for youth football clubs (sub-14 to senior amateur) enabling staff to monitor athlete fatigue, training load, and performance through a single integrated platform.

The system collects:

- **Identification & demographics** (name, age range, role, position, club)
- **Health data — GDPR Art. 9** (subjective fatigue questionnaire 5-dimensions, weight/height time series, Session-RPE, derived metrics like ACWR)
- **Performance statistics** (events captured during matches: shots, passes, defensive actions, etc.)
- **Behavioural** (attendance, session participation, in-app interaction telemetry — privacy-preserving)
- **Consent records** (parental consent timestamps, IP address, policy version accepted)

Processing is conducted by:

- **Staff** (Treinador, Analista) — read/write access to athlete data within their own club
- **Athletes (Jogador)** — submit fatigue self-reports; cannot access processed analytics ("dados mediados")
- **Parents/Guardians (Encarregado de Educação)** — confirm/withdraw consent; no system account
- **System (automated)** — derived calculations (ACWR, sRPE), retention/anonymization (`pg_cron`), audit logging

## 2. Necessity & Proportionality

### 2.1 Necessity

Health monitoring is **necessary** for:

- Injury prevention (sports science standard of care for youth athletes)
- Fatigue-based training load management (evidence-based ACWR thresholds)
- Compliance with duty-of-care obligations toward youth athletes

Without these data, decisions are made on coach intuition alone — measurably less safe.

### 2.2 Proportionality

The data collected is **minimal relative to the purpose**:

| Collected | Purpose | Justification |
|-----------|---------|---------------|
| Fatigue 5-dim questionnaire | Readiness analytics | Standard sports-science instrument; subjective, low burden |
| Weight, height (time series) | Load-relative metrics (ACWR per kg) | Coach already measures these manually |
| Performance events | Coaching decisions | Replaces manual notes; analyst already does this on paper |
| Attendance | Squad management | Operationally necessary |

**Explicitly NOT collected:**

- Geolocation
- Health conditions (unless voluntarily disclosed in free-text "nota livre")
- Contacts
- Social media activity
- Third-party analytics fingerprints (NFR22)

### 2.3 Risk-mitigating design decisions ("dados mediados")

A defining design choice: **the player NEVER sees their own processed analytics** (Painel de Prontidão, Curva de Recuperação, processed reports — FR26). Health insights are mediated by qualified staff. This:

- Prevents anxiety from raw fatigue scores or readiness "alarms"
- Keeps interpretation in human hands (medical/coaching judgment)
- Reduces psychological risk profile compared to consumer fitness trackers

## 3. Legal Basis (GDPR Art. 6 + Art. 9)

### Primary basis

**Art. 6(1)(a) + Art. 9(2)(a) — Explicit Consent**

Operationalised as:

- Privacy policy versioned (Story 3.1, FR53, FR54) — accepted record stored with timestamp + IP
- For minors 13–15: parental consent via tokenized email link, no account required (FR4, FR5, FR6)
- For minors 16–17: own consent + parental notification
- For adults 18+: own consent
- Withdrawal: always possible, immediate effect (FR8, FR9, NFR29)

### Children-specific safeguards (Art. 8)

- Linguistically adapted policy & questionnaire for sub-14 (NFR43, FR22, FR53)
- Tokenized parental confirmation, no separate account creation friction (FR5)
- Reminders day 7 + day 14 if not confirmed; staff alerted after day 14 (FR7)
- 18th-birthday re-confirmation; auto-anonymize after 90 days non-response (FR10)

### Why NOT other bases

- **Art. 6(1)(b) Contract:** N/A — no commercial contract with athletes (free pilot)
- **Art. 6(1)(c) Legal obligation:** N/A — no statutory mandate
- **Art. 6(1)(d) Vital interests:** Not primary — could become relevant only in emergencies
- **Art. 6(1)(e) Public task:** N/A — private club
- **Art. 6(1)(f) Legitimate interests:** Not used — children + Art. 9 data require explicit consent

## 4. Risk Assessment

### Methodology

Each risk: **Likelihood × Impact** → Risk Level. Likelihood = (Low/Med/High). Impact = (Low/Med/High/Critical). Risk = matrix.

### Risk 1: Unauthorised access to health data by another club's staff

- **Likelihood:** LOW (RLS enforced at DB level; lint check forbids service-role outside server)
- **Impact:** HIGH (Art. 9 data of minors)
- **Risk Level:** **MEDIUM**
- **Mitigation:**
  - RLS policies in every health/PII table (NFR16, AR8) — verified by integration tests with seeded multi-tenant fixtures (Story 1.6 AC #1)
  - `with check` clause prevents cross-tenant inserts (AR10)
  - Service-role key import restricted by lint rule (AR13)
  - JWT custom claims (`club_id`) injected on every token (AR11)

### Risk 2: Data breach at Supabase (sub-processor compromise)

- **Likelihood:** LOW (Supabase SOC 2 Type II; AWS underlying infra; published incidents none-material)
- **Impact:** CRITICAL (potential exposure of all athletes' Art. 9 data)
- **Risk Level:** **MEDIUM**
- **Mitigation:**
  - DPA signed (commits Supabase to ≤24h breach notification)
  - Encryption at rest (AES-256)
  - Backup encryption with separate key (`BACKUP_ENCRYPTION_KEY`) — Story 1.15
  - 72-hour CNPD notification protocol if material
  - Subjects notified per Art. 34 if high-risk to rights/freedoms

### Risk 3: Parental consent obtained improperly or absent

- **Likelihood:** MEDIUM (onboarding error, lost email, expired token)
- **Impact:** MEDIUM-HIGH (processing minor's health data without lawful basis)
- **Risk Level:** **MEDIUM-HIGH**
- **Mitigation:**
  - Underage account blocked from system access until consent confirmed (FR4, Story 3.2)
  - Tokenized consent link with audit trail (timestamp, IP, policy version) — FR6
  - Reminders day 7 + 14; staff alerted day 14 (FR7)
  - Player onboarding gate: cannot submit fatigue data without confirmed consent
  - Privacy policy versioned; consent always linked to specific version accepted

### Risk 4: Push notifications leaking health data

- **Likelihood:** LOW (architectural decision)
- **Impact:** HIGH (Art. 9 leakage to lock screen / OS)
- **Risk Level:** **LOW-MEDIUM**
- **Mitigation:**
  - Push payload is opaque ("Lembrete: questionário disponível") with deep link only — FR43, NFR21
  - Health data NEVER in push body
  - Player can unsubscribe at any time (FR44)

### Risk 5: Player viewing their own processed analytics inadvertently

- **Likelihood:** LOW (architectural — RLS forbids)
- **Impact:** MEDIUM (dados-mediados philosophy violated; potential anxiety)
- **Risk Level:** **LOW**
- **Mitigation:**
  - RLS policy in `readiness_snapshots` and aggregated tables denies player role
  - UI route group `(player)` does not surface processed-data routes
  - Staff-mediated reporting (Story 4.6, Story 7.6 PDF generation)

### Risk 6: Excessive retention beyond 5 seasons

- **Likelihood:** LOW (automated)
- **Impact:** LOW (anonymization, not breach — but technically GDPR violation)
- **Risk Level:** **LOW**
- **Mitigation:**
  - `pg_cron` job monthly anonymizes departed players past 5 seasons (AR23, FR16)
  - Audit log entry per anonymization run
  - Quarterly manual review of `pg_cron` logs

### Risk 7: Loss of device with offline outbox containing unsent data

- **Likelihood:** MEDIUM (real-world device loss/theft)
- **Impact:** LOW-MEDIUM (data already encrypted at rest by IndexedDB; user-scoped)
- **Risk Level:** **LOW-MEDIUM**
- **Mitigation:**
  - Outbox detection on next login; orphan warning (NFR52)
  - User can wipe local data via app settings
  - All data idempotent (UUIDv7) — no duplicate risk on resync
  - PWA scoped to authenticated origin; no cross-app leakage

## 5. Stakeholder Consultation

For this MVP pilot phase, formal external consultation is not undertaken. Pre-pilot review recommended:

- Pilot club director / coordinator review of consent flow and privacy policy
- Optional: external GDPR consultant review before scaling beyond pilot
- Mandatory: appoint a DPO if scaling to ≥4 clubs OR processing exceeds CNPD's small-scale threshold

## 6. Mitigation Summary (cross-cutting controls)

| Control | Where Implemented | Stories |
|---------|-------------------|---------|
| Row-Level Security on every PII/health table | Postgres | 1.3, 1.6 |
| JWT custom claims (`club_id`, `role`) | Supabase Auth Hook | 1.4 |
| TLS 1.3+ everywhere | Vercel + Supabase | infra-default |
| Audit logging on health-data reads | Postgres triggers | 3.11, 3.12 |
| Versioned privacy policy with consent linkage | App + DB | 3.1 |
| Parental consent gating | Server Action + RLS | 3.2, 3.3 |
| Subject rights endpoints (export/erase/restrict/withdraw) | Edge Functions + Server Actions | 3.5–3.10 |
| Backup encryption (separate key) | GitHub Actions | 1.15 |
| MFA for staff (opt-in MVP, mandatory Growth) | Supabase Auth MFA | 1.7 |
| Heartbeat (DB liveness) | GitHub Actions | 1.14 |
| Browser/WebView block | App page | 1.10 |
| Telemetry without third parties | Postgres `telemetry_events` | 1.12 |

## 7. Residual Risk & Acceptability

After controls, residual risks are assessed:

| Risk | Residual Level | Acceptable? |
|------|----------------|-------------|
| Cross-club access | LOW | ✅ Yes (RLS + tests + lint) |
| Sub-processor breach | LOW (notification + backups + DPA) | ✅ Yes |
| Consent absence | LOW (gating + reminders + audit) | ✅ Yes |
| Push leakage | NEGLIGIBLE | ✅ Yes |
| Player accessing own analytics | NEGLIGIBLE | ✅ Yes |
| Over-retention | NEGLIGIBLE (`pg_cron`) | ✅ Yes |
| Offline outbox loss | LOW (idempotent + orphan detection) | ✅ Yes |

**Overall residual risk:** LOW. Processing may proceed once technical controls are validated and consent flows operational.

## 8. Review Cadence

- **Monthly:** Audit `pg_cron` retention/anonymization logs
- **Quarterly:** Review audit log access patterns; sample data subject right requests
- **Pre-pilot launch:** Final DPIA sign-off (this document)
- **Annually:** Full DPIA refresh + legal basis re-evaluation
- **On material change:** New data category, new sub-processor, new processing purpose, new region

## 9. Approval & Sign-Off

This DPIA is reviewed and approved **before pilot squad onboarding** (when real health data collection begins).

### Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Data Controller** | Antero Santos | _____________________ | __________ |
| **Reviewer** (optional, DPO/legal) | _____________________ | _____________________ | __________ |

**Procedure to sign this DPIA:**
1. Print this document (`sparta/_compliance/dpia.md`)
2. Sign and date in the Controller row above (blue ink preferred for scan authenticity)
3. Upload signed PDF to `sparta/_compliance/dpia-signed-2026-XX-XX.pdf` (date in filename)
4. Commit: `git add _compliance/dpia-signed-*.pdf && git commit -m "DPIA signed by Controller (Antero) — pilot launch gate"`
5. Add entry to this file's Change Log (Section 8, Monitoring & Review)

### Pre-Launch Checklist (must all be ✅ before pilot)

- [ ] **DPIA signed by Controller** (Antero) — **DUE: before pilot squad onboarding** (before Story 1.13 CI gate)
- [ ] All technical controls implemented and verified (Stories 1.3 → 1.16, 3.x complete)
- [ ] DPA signed with Supabase (`./dpa.md`) — signed 2026-05-09 ✅
- [ ] Vercel DPA reviewed and accepted (https://vercel.com/legal/dpa)
- [ ] Resend DPA reviewed and accepted (https://resend.com/legal/dpa) — deferred to Story 1.5/domain registration
- [ ] Privacy Policy versioned and live (Story 3.1)
- [ ] Parental consent flow operational (Story 3.3, 3.4)
- [ ] Subject rights endpoints operational (Stories 3.6–3.10)
- [ ] Audit logging operational and verified (Story 3.11)
- [ ] Heartbeat + backup workflows running (Stories 1.14, 1.15)
- [ ] Resend EU region configured post-domain registration (Story 1.5 — before real athlete data collection)

---

## References

- **GDPR:** Regulation (EU) 2016/679 — Articles 6, 8, 9, 32, 33, 34, 35, 36
- **CNPD (PT supervisor):** https://www.cnpd.pt
- **WP29/EDPB DPIA Guidelines:** WP248rev.01
- **SPARTA Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **SPARTA PRD:** `_bmad-output/planning-artifacts/prd.md`
- **SPARTA DPA:** `./dpa.md`
