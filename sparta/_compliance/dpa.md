# Data Processing Agreement (DPA) — SPARTA × Supabase

> **Status:** ✅ Accepted by reference — Supabase Free tier incorporates the DPA into the Terms of Service.
> **Standard DPA URL:** https://supabase.com/legal/dpa (verified accessible 2026-05-09, HTTP 200)
> **Accepted on:** 2026-05-09 (via SPARTA organization signup ToS acceptance)
> **Story:** 1.2 (Foundation — pre-pilot compliance gate)
>
> **Note for Free tier (current):** Supabase does not require explicit per-customer DPA execution at this tier. The standard DPA at the URL above applies automatically once the Terms of Service are accepted. This is a common pattern for cloud providers (cf. AWS, GCP free tiers).
>
> **For paid plans (Pro/Team/Enterprise):** A signed counter-party DPA may be requested via Supabase Support — recommended before scaling beyond the pilot squad if budget allows.

---

## 1. Parties

| Role | Entity | Contact |
|------|--------|---------|
| **Data Controller** | Antero Santos (sole proprietor — SPARTA) | antero.rsantos@gmail.com |
| **Data Processor** | Supabase Inc. | https://supabase.com/agreements |
| **Sub-processors** | AWS (infra Supabase Dublin/Amsterdam), Vercel Inc. (`fra1`), Resend Inc. (EU) | (each with own DPA) |

## 2. Scope of Processing

**Purpose:** Hosting and processing of personal and health data for the SPARTA athlete performance management application — a youth football club platform tracking fatigue, readiness, and performance metrics for athletes aged 13–18.

**Categories of Data:**

- **Identity:** name, email, phone (optional), date of birth (or age range)
- **Roles:** Treinador (Coach), Analista (Analyst), Jogador (Player), Encarregado de Educação (Parent/Guardian — non-account)
- **Health (GDPR Art. 9):** fatigue questionnaire responses (5 dimensions × 1–5 scale), Session-RPE, weight/height time series, performance event statistics
- **Behavioural:** training attendance, session participation, app interaction telemetry (privacy-preserving — no third-party analytics)
- **Consent records:** parental consent timestamps + IP + policy version (FR6)

**Categories of Data Subjects:**

- Minor athletes 13–15 years (parental consent required — FR4, FR5)
- Minor athletes 16–17 years (own consent + parental notification)
- Adult users 18+ (Treinador, Analista, Jogador adulto)
- Encarregados de Educação (Parents/Guardians) — process consent only, no account

**Legal Basis (GDPR):**

- Art. 6(1)(a) and Art. 9(2)(a) — explicit consent (versioned policy stored with each record)
- Art. 8 (children) — parental authorization for under-16

## 3. Geographical Scope

**Primary processing region:** EU (Ireland or Amsterdam — Supabase EU instance — NFR30)
**Secondary regions:**

- Vercel `fra1` (Frankfurt — application edge)
- Resend EU (transactional email)
- GitHub Actions (CI/CD only — no PII processed)

**Data transfers outside EU:** Not permitted in MVP. If future need arises, requires Standard Contractual Clauses (SCC) and DPIA amendment.

## 4. Security Measures (Art. 32 GDPR)

Supabase commits to:

- **Encryption in transit:** TLS 1.3+ (NFR14)
- **Encryption at rest:** AES-256 (Postgres + AWS RDS)
- **Access control:** Project-level + database-level (RLS) — NFR16
- **Network isolation:** Private VPC, firewall rules
- **Backups:** Automated daily; encrypted; retained per Supabase plan terms
- **Audit logging:** Authentication and management plane events
- **Vulnerability management:** Regular security audits; patched CVEs; SOC 2 Type II

SPARTA additionally enforces (controller-side, on top of processor measures):

- **Row-Level Security:** ALL tables with personal/health data — AR8, NFR16
- **Audit logs:** Every staff read of health data logged (FR50, AR21, NFR20)
- **Service-role key:** Stored as Vercel/GitHub Secret; never in client code (AR13)
- **Backup encryption:** Separate `BACKUP_ENCRYPTION_KEY` for weekly snapshots (Story 1.15)
- **MFA available:** Coach/Analyst opt-in MVP, mandatory in Growth phase (FR11, NFR19)

## 5. Sub-processors

Supabase may use third-party sub-processors (current list at https://supabase.com/agreements). Material changes require 30-day prior notice.

SPARTA engages directly:

- **Vercel Inc.** — application hosting (`fra1`); DPA signed: ☐ pending
- **Resend Inc.** — transactional email (EU); DPA signed: ☐ pending
- **GitHub Inc.** — code repository + Actions (no PII); DPA: standard for paid plans (Free tier acceptable for MVP)

## 6. Data Subject Rights (Articles 15–22)

SPARTA commits to facilitating:

| Right | SLA | Implementation |
|-------|-----|----------------|
| Access (Art. 15) | ≤30 days | CSV export — Story 3.6, FR46, NFR27 |
| Rectification (Art. 16) | ≤7 days | Staff-mediated edit + audit log — Story 3.8, FR48, NFR28 |
| Erasure (Art. 17) | ≤30 days | Cascade deletion — Story 3.7, FR47, NFR26 |
| Restriction (Art. 18) | Immediate | Account freeze — Story 3.9, FR49 |
| Portability (Art. 20) | ≤30 days | Same as Access (CSV — structured) |
| Objection / Withdrawal (Art. 21) | Immediate | Story 3.10, FR8, FR9, NFR29 |
| Access logs visibility (custom) | Real-time | Player can see who viewed their health data — Story 3.12, FR51 |

## 7. Breach Notification

Supabase commits to notifying SPARTA **without undue delay** (target ≤24h) upon discovering a breach affecting personal data.

SPARTA commits to notifying the supervisory authority (CNPD — Comissão Nacional de Proteção de Dados, Portugal) within 72 hours where required by Art. 33 GDPR.

## 8. Retention & Deletion

- **Active player data:** retained while enrolled
- **Departed player history:** 5 seasons, then anonymized irreversibly (FR16, NFR16, NFR35) — automated via `pg_cron` (AR23)
- **18th-birthday re-confirmation:** if not reconfirmed within 90 days, anonymize (FR10, Story 7.1)
- **Audit logs:** 12 months (FR50, NFR20)
- **Backups:** 12 weeks (NFR51, AR28)
- **Telemetry events:** retain only product KPI aggregates; no personally-identifiable telemetry (NFR22, AR31)

Upon DPA termination, Supabase commits to deleting or returning all personal data within a defined timeframe (per Supabase's published terms).

## 9. Audit Rights

The Controller has the right to audit the Processor's compliance with this DPA, on reasonable notice and during business hours, including via independent third-party auditors. Supabase's published SOC 2 reports satisfy routine audit requirements unless extraordinary cause is shown.

## 10. Liability & Indemnification

Per the Master Service Agreement and the Supabase published DPA. This document does not derogate from those terms.

## 11. Term

This DPA enters into force upon signature and remains in effect for the duration of the Master Service Agreement between SPARTA and Supabase. Survival clauses (data deletion, audit obligations) extend post-termination per Supabase's published terms.

---

## Approval & Signatures

> **Free-tier acceptance model:** the Supabase standard DPA at https://supabase.com/legal/dpa is incorporated into the Terms of Service. Acceptance happens implicitly at organization signup. No counter-signed PDF is provided at this tier.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Data Controller (Antero)** | Antero Santos | accepted via Supabase ToS | 2026-05-09 |
| **Data Processor (Supabase Inc.)** | electronic acceptance via published DPA | https://supabase.com/legal/dpa | 2026-05-09 |

**Signed DPA reference:** https://supabase.com/legal/dpa (incorporated via Free-tier ToS; downloadable PDF available on the public page)

**If/when upgrading to Pro plan:** request a counter-signed DPA via support@supabase.com with subject "DPA execution request — SPARTA organization" and attach a copy of the standard text. Update this section with the signed PDF reference.

---

## Pre-Launch Checklist

Before pilot squad onboarding (pilot launch gate in Story 1.13):

- [x] **DPA with Supabase** — accepted via ToS (2026-05-09, Free tier model)
  - Standard DPA URL: https://supabase.com/legal/dpa ✅
- [ ] **DPA with Vercel** — review and accept
  - Standard DPA URL: https://vercel.com/legal/dpa
  - Action: If hosting on Vercel Pro/Team plan, request signed DPA or confirm ToS covers it
- [ ] **DPA with Resend** — review and accept (deferred to Story 1.5)
  - Standard DPA URL: https://resend.com/legal/dpa
  - Timing: After custom domain registration (Story 1.5), before real athlete data collection
- [ ] **DPIA signed by Controller** — Antero signature on `./dpia.md` (Section 9)
- [ ] **Privacy Policy** (Story 3.1) — versioned and linked from app footer
- [ ] **Audit logging operational** (Story 3.11) — every staff read of health data logged
- [ ] **Resend EU region configured** (Story 1.5) — `region: 'eu-west-1'` enforced in SDK before real data

---

## References

- **GDPR:** Regulation (EU) 2016/679
- **Supabase DPA:** https://supabase.com/agreements
- **Supabase Trust Center:** https://supabase.com/trust
- **CNPD (PT supervisor):** https://www.cnpd.pt
- **SPARTA Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **SPARTA DPIA:** `./dpia.md`
