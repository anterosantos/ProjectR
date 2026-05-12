# Deferred Work Tracker

Items deferred from code reviews — pre-existing issues, out-of-scope work, or items blocked by future stories.

## Deferred from: code review of story-1.3 (2026-05-09)

- **clubs has no INSERT policy — first-club bootstrap requires admin tooling**: With `enable_signup = false` and only `service_role` able to insert clubs, the entire signup path is non-functional today. Needs a dedicated admin/seed story before Story 1.4 ships. [Sources: Blind Hunter HIGH, Edge Hunter HIGH-2]

- **`ON DELETE CASCADE` without audit trail**: When a club or `auth.users` row is deleted, profiles vanish silently with no entry in audit logs. Acceptable for now since audit logging is Story 1.12; revisit triggers when `audit_logs` table exists. [Source: Edge Hunter MED-3]

- **Migration numbering deviates from architecture**: `architecture.md` (lines 1105-1118) documents migrations as `000130_rls_policies.sql` (consolidated) and `000160_audit_triggers.sql`. Implementation uses per-table `000010-000040`. Architecture-level decision; reconcile in a future doc-pass. [Source: Edge Hunter LOW-1]

## Deferred from: code review of story-1.5 (2026-05-12)

- **Rota `/` pública sem redirect para utilizadores autenticados** (`project-r/src/app/page.tsx`): TODO já documentado no código; homepage mostra scaffold Next.js em vez de redirecionar para a home do role. Abordado em story futura de navegação/shell.
- **NFR17/NFR14 (1h token expiry e HTTPS) não configurados em código**: Dependem de configuração no dashboard Supabase e plataforma de deploy (Vercel/Cloudflare). Não são responsabilidade desta story; verificar antes do go-live.
- **Alert `success` variant não é standard shadcn/ui** (`project-r/src/components/ui/alert.tsx:847`): Variant custom adicionada. Se `npx shadcn@latest add alert` for executado, será sobrescrita silenciosamente. Extrair para design token ou documentar como override quando o Design System for formalizado (Story 1.8).
