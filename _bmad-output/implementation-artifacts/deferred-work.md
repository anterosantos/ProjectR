# Deferred Work Tracker

Items deferred from code reviews — pre-existing issues, out-of-scope work, or items blocked by future stories.

## Deferred from: code review of story-1.3 (2026-05-09)

- **clubs has no INSERT policy — first-club bootstrap requires admin tooling**: With `enable_signup = false` and only `service_role` able to insert clubs, the entire signup path is non-functional today. Needs a dedicated admin/seed story before Story 1.4 ships. [Sources: Blind Hunter HIGH, Edge Hunter HIGH-2]

- **`ON DELETE CASCADE` without audit trail**: When a club or `auth.users` row is deleted, profiles vanish silently with no entry in audit logs. Acceptable for now since audit logging is Story 1.12; revisit triggers when `audit_logs` table exists. [Source: Edge Hunter MED-3]

- **Migration numbering deviates from architecture**: `architecture.md` (lines 1105-1118) documents migrations as `000130_rls_policies.sql` (consolidated) and `000160_audit_triggers.sql`. Implementation uses per-table `000010-000040`. Architecture-level decision; reconcile in a future doc-pass. [Source: Edge Hunter LOW-1]

## Deferred from: code review of 1-12-audit-logs-telemetry-foundation-tables (2026-05-16)

- **`audit_logs_player_read` nunca matches `target_id IS NULL`**: Ações agregadas futuras (ex: `panel.viewed` sem target específico) não serão visíveis ao jogador via FR51. Sem impacto no MVP atual mas afeta Stories 3.11 e 3.12. Corrigir quando essas stories forem implementadas adicionando `OR (target_id IS NULL AND actor_id = auth.uid())`.
- **Sem threshold de cobertura configurado em `vitest.config.ts`**: AC #8 diz "build fails if coverage drops below threshold" mas não está implementado. Configurar `coverage.thresholds` em vitest.config.ts — deferred para Story 1-13 (CI pipeline).
- **`pg_cron` DELETE sem LIMIT em audit_logs**: O job mensal `DELETE FROM audit_logs WHERE occurred_at < NOW() - INTERVAL '12 months'` não tem LIMIT, podendo bloquear a tabela por minutos em volumes altos. Sem impacto no MVP. Usar batch delete quando o volume justificar.
- **`occurred_at` definido no código da aplicação**: Ambos os helpers inserem `occurred_at: new Date().toISOString()` explicitamente, mas a BD já tem `DEFAULT now()`. Omitir o campo do insert para deixar a BD atribuir o timestamp (mais trustworthy). Baixo impacto, melhoria futura.

## Deferred from: code review of 1-14-github-actions-heartbeat-workflow (2026-05-17)

- **`actions/checkout@v4` usa floating major version tag** [.github/workflows/heartbeat.yml:14]: Supply chain concern — tag pointer pode mover silenciosamente. Aplica-se a todos os workflows (ci.yml, heartbeat.yml). Endereçar numa passagem dedicada de security hardening com SHA pinning.
- **`postgresql-client` sem version pin** [.github/workflows/heartbeat.yml:18-20]: `apt-get install postgresql-client` instala a versão padrão do runner, não determinística entre image updates. Padrão comum em Actions; fixar versão quando estabilidade do psql se tornar crítica.

## Deferred from: code review of story-1.5 (2026-05-12)

- **Rota `/` pública sem redirect para utilizadores autenticados** (`project-r/src/app/page.tsx`): TODO já documentado no código; homepage mostra scaffold Next.js em vez de redirecionar para a home do role. Abordado em story futura de navegação/shell.
- **NFR17/NFR14 (1h token expiry e HTTPS) não configurados em código**: Dependem de configuração no dashboard Supabase e plataforma de deploy (Vercel/Cloudflare). Não são responsabilidade desta story; verificar antes do go-live.
- **Alert `success` variant não é standard shadcn/ui** (`project-r/src/components/ui/alert.tsx:847`): Variant custom adicionada. Se `npx shadcn@latest add alert` for executado, será sobrescrita silenciosamente. Extrair para design token ou documentar como override quando o Design System for formalizado (Story 1.8).

## Deferred from: code review of 2-2-player-photo-upload (2026-05-17)

- **Rate limiting no server action `uploadPlayerPhoto`**: Utilizador autenticado pode chamar a action em loop, consumindo quota de Storage. Cross-cutting concern — endereçar numa story de hardening de infra.
- **Race condition leve: preview FileReader pode aparecer após reset de estado no upload muito rápido**: `reader.onload` e `setPhotoPreview(null)` no sucesso correm de forma assíncrona. Impacto UX mínimo — irrelevante para volumes reais.
- **Race condition de uploads concorrentes para o mesmo jogador**: Dois calls simultâneos de `uploadPlayerPhoto` podem sobrescrever-se no Storage (upsert) com resultado inconsistente no DB. Baixa probabilidade num app de staff desportivo; endereçar com locking otimista se necessário.
- **URL assinada gerada com sucesso para objeto já eliminado do bucket**: `createSignedUrl` não valida existência do objeto; a URL é válida mas o browser recebe 404. Comportamento esperado do Supabase; documentar se necessário.
- **Mock de teste devolve `Uint8Array` em vez de `Buffer` do Node.js**: Discrepância baixo impacto — não quebra testes atuais mas não valida tipos de buffer reais. Corrigir numa passagem de hardening de testes.
- **Padrão N+1 em `getPlayerPhotoUrl`**: Lista de 30 jogadores faz 30 chamadas RPC separadas para gerar URLs assinadas. Otimizar com batch signing quando o volume justificar.

## Deferred from: code review of 1-16-accessibility-foundation-skip-link-focus-rings-reduced-motion-alt-text (2026-05-17)

- **`text-3rd` typo em `recuperar-password/page.tsx`**: Provavelmente `text-3xl` — bug pre-existente no bloco `submitted` da página de recuperação de password. Corrigir na próxima edição deste ficheiro. [src/app/recuperar-password/page.tsx]
- **`meta="Sáb 16:00"` hardcoded em `StaffLayout`**: Stub de desenvolvimento pre-existente — staff vê sempre "Sáb 16:00" independente do dia/hora real. Substituir por data dinâmica quando o StickyHeader for evoluído. [src/app/(staff)/layout.tsx]
- **`ErrorBoundary` fallback sem `main#main-content`**: Quando o ErrorBoundary captura um erro, o fallback renderiza um `<div>` simples sem id — o skip link aponta para o nada nesse estado. Estado de erro extremo e pre-existente; endereçar se o ErrorBoundary for revisto para incluir layout semântico.
