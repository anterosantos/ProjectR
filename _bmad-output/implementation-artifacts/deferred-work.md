# Deferred Work Tracker

Items deferred from code reviews — pre-existing issues, out-of-scope work, or items blocked by future stories.

## Deferred from: code review of 6-8-session-rpe-entry-per-player-at-end-of-session (2026-05-31)

- **Fire-and-forget audit log pode perder-se** [`session-srpe.ts:185-205`]: Se o processo terminar antes das micro-tasks de audit_log e readiness refresh completarem, ambos são silenciosamente perdidos. Padrão pré-existente em todo o projecto (fatigue.ts, attendance.ts); resolver quando durabilidade de audit logs for standardizada.
- **Sem guarda de estado de sessão** [`session-srpe.ts`]: sRPE pode ser registado para sessões futuras ou canceladas (nenhuma query verifica session state). Decisão de design — spec não exige guarda; todos os jogadores activos são mostrados por design (AC#5 fallback). Reavaliar quando lógica de estado de sessão for formalizada.
- **Handler `fatigue.submit` em drain usa cast unsafe** [`drain.ts`]: `const fatiguePayload = payload as FatigueResponseInput` sem validação Zod prévia, ao contrário de todos os outros handlers. Padrão inconsistente pré-existente; fora do scope da Story 6.8.

## Deferred from: code review of 5-8-analista-dashboard-individual-4-week-fatigue-trends-multi-player-overview (2026-05-28)

- **Double `createServerClient()`** [`trends.ts:49, 100`]: `requireStaffRole()` e `getFatigueTrendsData()` criam dois clientes Supabase separados por request. Refactorizar para retornar o cliente de `requireStaffRole` ou passá-lo como argumento. Code smell sem impacto funcional em SSR com cookies imutáveis.
- **Dead code: filtros server-side em `getFatigueTrendsData`** [`trends.ts:237-252`]: A página chama a server action sem filtros (todos os filtros são aplicados no cliente em `TrendsDashboard`). O código de filtragem server-side é dead code que induz em erro — remover quando a arquitectura de filtros for consolidada.
- **`auditedRead()` com callback de dados pré-carregados** [`trends.ts:157-167`]: Padrão correcto é `auditedRead(metadata, () => supabase.from(...).select(...))` com a query real no callback. Aqui o callback devolve dados já carregados. AC #3 (fire-and-forget) está satisfeito; rever se `auditedRead` se tornar sensível ao padrão de invocação.
- **Delta nulo para jogadores com dados apenas recentes** [`trends.ts:207-224`]: Jogador com submissões apenas nos últimos 7 dias tem `prev21` vazio, resultando em `delta=null` — indistinguível de "sem dados" no UI. Considerar label ou tooltip diferenciado em iteração UX futura.
- **Off-by-one na fronteira dos 7 dias** [`trends.ts:217`]: Resposta submetida exactamente há 7 dias é incluída em `last7` (condição `<=`), enquanto a query de 28 dias usa `>=`. Fronteiras inconsistentes mas impacto negligenciável na prática.

## Deferred from: code review of 5-4-painel-de-prontidao-lista-por-posicao-default-view (2026-05-25)

- **D-1: Calls DB em série N×2 em `refreshSnapshotForSession`** [`sparta/src/lib/readiness/snapshot.ts:144`]: Loop sequencial sobre todos os jogadores do clube — 2N round-trips de DB (computeAcwr + fatigue_responses por jogador). Operação background fire-and-forget; não bloqueia render da página. Otimizar com `Promise.all` batching quando Story 5.7 (realtime) for implementada.
- **D-2: `requireStaffRole()` chamado duas vezes por render — 7 round-trips de DB** [`sparta/src/lib/actions/readiness.ts`]: `getUpcomingSession` e `getReadinessPanelData` fazem auth+profile lookup independentes. Concern arquitectural sistémico; otimizar com `cache()` do Next.js quando a camada de actions for centralizada.
- **D-3: `computeRecentFatigueAvg` descarta toda a resposta com uma dimensão inválida** [`sparta/src/lib/readiness/snapshot.ts:53`]: Comportamento conservador (descartar dado parcialmente corrompido) mas pode mascarar fadiga se várias respostas tiverem dados parcialmente inválidos. Rever com contexto desportivo.
- **D-4: Desvio de relógio (`asOf`) para squads grandes no loop de players** [`sparta/src/lib/readiness/snapshot.ts:141`]: `asOf` calculado uma vez antes do loop; late players têm janela de 7 dias ligeiramente diferente. Segundos de desvio aceitáveis para squad típico.
- **D-5: `acwr numeric(4,2)` overflow para ACWR ≥ 100** [`supabase/migrations/000250_readiness_snapshots.sql:17`]: ACWR ≥ 100 é fisicamente irrealista (carga crónica próxima de zero). Concern da Story 5.2 se `computeAcwr` devolver tal valor; snapshot silenciosamente perdido.
- **D-6: Jogador arquivado após snapshot → linha "Jogador/0" fantasma no painel** [`sparta/src/lib/actions/readiness.ts:377`]: Jogador arquivado entre snapshot e render aparece como nome "Jogador" e camisola 0. Janela de race muito pequena; próximo refresh elimina.
- **D-7: PostgrestError em logs pode conter nomes de tabelas/colunas/constraints** [`sparta/src/lib/readiness/snapshot.ts`]: Informação de schema interna visível nos logs de aplicação. Padrão sistémico em todo o projecto; resolver quando log sanitization for standardizada.
- **D-8: Formatação de data do servidor ignora timezone do utilizador** [`sparta/src/app/(staff)/prontidao/page.tsx:52`]: `new Date(scheduledAt).toLocaleDateString("pt-PT", ...)` usa timezone do servidor. Necessita estratégia de timezone global.
- **D-9: TanStack Query (staleTime: 30s) não implementado** [`sparta/src/components/domain/readiness/readiness-panel-list.tsx:59`]: AC #6 especifica caching com staleTime:30s durante janela 4h pré-sessão. `sessionId` está reservado com `_` para uso futuro. Explicitamente deferido para Story 5.7 (realtime updates).
- **D-10: `getPlayerAcwrTrend` stub sem marcação "não implementado"** [`sparta/src/lib/actions/readiness.ts:139`]: Retorna `{ trend: null }` sem distinguir "sem dados" de "stub não implementado". Pre-existente da Story 4.6; atualizar quando Story 5.5 implementar drill-down.
- **D-11: TOCTOU em `refreshUpcomingReadiness` — verificação de clube e refresh separados** [`sparta/src/lib/actions/readiness.ts:194`]: Sessão verificada no scope outer mas `refreshSnapshotForSession` re-faz lookup sem re-verificar clube. Probabilidade próxima de zero — sessões não mudam de clube.

## Deferred from: code review of 4-9-post-session-questionnaire-fallback-access + 4-10-hoje-questionnaire-answered-state-feedback (2026-05-24)

- **D1: Padrão de renderização de erros em debug-style no questionário** [`sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx`]: Todos os erros da página do questionário usam `<p className="text-red-600 font-mono text-sm">` — padrão de debug exposto a utilizadores finais. Pre-existente da Story 4.2; resolver quando os componentes de erro forem padronizados.
- **D2: Dois `Promise.all` sequenciais em `/hoje` — fatigue status não corre em paralelo com session queries** [`sparta/src/app/(player)/hoje/page.tsx`]: Constrangimento arquitectural — os IDs das sessões só são conhecidos após o primeiro `await`. Optimizar se o TTFB se tornar perceptível.
- **D3: Edge case "post respondido, pre não respondido, sem próxima sessão" mostra empty state "Sem sessões"** [`sparta/src/app/(player)/hoje/page.tsx`]: Jogador que respondeu ao pós-sessão sem ter respondido ao pré, sem sessão futura, vê empty state genérico em vez de estado significativo. Caso fora do âmbito das Stories 4.9 e 4.10.
- **D4: Lookup redundante de player em `getSessionFatigueStatus` quando chamada duas vezes em paralelo** [`sparta/src/lib/actions/fatigue.ts`]: 4 round-trips de DB para dados de autenticação idênticos. Optimizar com cache de sessão ou injeção de player_id quando a camada de acções for centralizada.

## Deferred from: code review of 4-8-pre-post-session-push-notifications-with-configurable-x-y (2026-05-24)

- **W1: N+1 queries em `schedule-session-pushes`** [`supabase/functions/schedule-session-pushes/index.ts`]: Uma query por sessão para `notification_settings` e outra para `push_subscriptions`. Impacto apenas com muitas sessões simultâneas. Otimizar via batch queries quando o volume justificar.
- **W2: Middleware-level blocking em `/configuracoes/notificacoes-clube`** [`src/app/(staff)/configuracoes/notificacoes-clube/page.tsx`]: AC#5 especifica bloqueio via middleware; implementação usa page-level redirect. Funciona para segurança mas middleware seria mais performante (evita render). Alinhar quando o middleware for revisto.
- **W3: PGRST116 semântica ambígua entre versões PostgREST** [`supabase/functions/schedule-session-pushes/index.ts:60`]: O código assume PGRST116 = "no rows" mas em algumas versões significa "multiple rows". Verificar versão PostgREST em uso no projecto.
- **W4: Aviso de alterações não guardadas ao navegar com form dirty** [`src/app/(staff)/configuracoes/notificacoes-clube/notification-settings-form.tsx`]: Sem `beforeunload` ou `router.events` guard; alterações perdidas silenciosamente. Padrão não implementado noutras páginas — resolver quando UX de formulários for padronizada.

## Deferred from: code review of 4-6-dados-mediados-block-player-has-no-self-access-to-processed-data (2026-05-24)

- **W1: `requireStaffRole()` retorna mesmo código "unauthorized" para erros de DB e negação de acesso** [`sparta/src/lib/actions/readiness.ts:~28`]: Erros de infra transitórios silenciosamente negam acesso a staff legítimo sem propagação de erro retriable. Melhorar quando a camada de error handling for alinhada.
- **W2: `requireStaffRole()` usa cliente anon em vez de service role para query de profiles** [`sparta/src/lib/actions/readiness.ts:~40`]: Pattern padrão em Server Actions; risco só materializa com sessões expiradas, capturadas upstream pelo middleware. Rever quando a camada Supabase for centralizada.
- **W3: `formatSubmittedAt` engole excepções silenciosamente sem logging** [`sparta/src/app/(player)/historico/page.tsx:~22`]: Falhas de parsing de data são silenciosas em produção. Adicionar `console.error` quando logging estruturado estiver disponível no componente layer.
- **W4: `assertNoMetricLeakage` pode ter falsos positivos em valores que contenham substrings de keys proibidas** [`sparta/src/__tests__/dados-mediados-block.test.ts:~86`]: Substring matching no JSON serializado completo pode disparar em valores de string. Risco muito baixo em prática; melhorar para key-path matching quando a test infra o suportar.
- **W5: `/relatorios` ausente de `ROLE_ALLOWED_ROUTES` para roles de staff** [`sparta/src/proxy.ts:~18`]: Funcionalidade /relatorios planeada para Epic 7 (Growth); staff recebe redirect para default route em vez de 404. Adicionar a ROLE_ALLOWED_ROUTES quando a feature for implementada.

## Deferred from: code review of 3-12-subject-visibility-who-accessed-my-health-data (2026-05-23)

- **W-1: Cache `tokenValidationCache` serve tokens revogados durante 5 min** [`sparta/src/lib/actions/data-rights.ts`]: Comportamento herdado de Story 3.10; sem mecanismo de invalidação; tokens revogados podem continuar a aceder ao audit log do menor durante até 5 minutos. Mitigar com Redis/Supabase KV quando o volume justificar.
- **W-2: `createServerClient()` chamado duas vezes em `getAuditLogForSubject`** [`sparta/src/lib/actions/audit-visibility.ts`]: Pattern estabelecido nas stories anteriores; risco de race de sessão negligenciável em condições normais. Refactorizar quando a camada de Supabase for centralizada.
- **W-3: Campo `hasMore` calculado mas não usado pela paginação** [`sparta/src/lib/actions/audit-visibility.ts`, `sparta/src/components/domain/AuditLogList.tsx`]: Paginação usa `totalCount` directamente; `hasMore` é redundante e induz confusão em leitores futuros. Remover ou usar consistentemente numa refactorização futura.
- **W-4: Teste de wiring do botão Export a nível de integração em falta** [`sparta/src/components/domain/AuditLogList.test.tsx`]: Wiring testado a nível de componente (prop `onExport`); integração end-to-end requer DB real. Implementar quando infra de testes de integração estiver disponível.
- **W-5: Teste de isolamento RLS (policy real) em falta** [`sparta/src/lib/actions/audit-visibility.integration.test.ts`]: Testes actuais verificam a guarda aplicacional (`user.id !== subjectId`), não a policy RLS em si. Requer DB Supabase com seed; implementar quando infra de integração estiver pronta.

## Deferred from: code review of 3-11-health-data-access-audit-logging-auto-wrapper-for-staff-reads (2026-05-22)

- **W-1: Testes de integração todos `.skip`** [`src/lib/data/audited.integration.test.ts`]: Scaffolding presente mas testes não executam — requerem DB Supabase de testes real com seed data, autenticação e acesso a pg_cron. Implementar quando a infra de testes de integração estiver disponível.
- **W-2: Over-logging com resposta Supabase `{ data, error }`** [`src/lib/data/audited.ts:74`]: `fn()` retorna `{ data: null, error: ... }` (pattern Supabase) sem lançar excepção — o audit é inserido mesmo sem dados retornados. Comportamento aceitável (audita tentativas); documentar na doc de uso.
- **W-3: `payload` sem limite de tamanho** [`src/lib/data/audited.ts:19`]: Sem cap de tamanho na camada da aplicação. Restrições de coluna do DB (se existirem) tratam overflows; adicionar validação explícita quando o volume real de `audit_logs` justificar.
- **W-4: ESLint rule não detecta cliente Supabase com alias** [`eslint-rules/no-direct-health-data-read.js`]: `const db = supabase; db.from('fatigue_responses').select()` escapa a regra. Limitação conhecida de análise estática sem type-awareness; mitigar com convention de nomenclatura de clientes.
- **W-5: ESLint rule falsos positivos/negativos em RPCs** [`eslint-rules/no-direct-health-data-read.js:68`]: Keywords heurísticas causam false positives (`check_payment_readiness`) e false negatives (`get_athlete_load`). Melhorar com lista explícita de RPCs proibidas quando o namespace RPC estabilizar.
- **W-6: `actor_id` re-resolved via `getUser()` em vez de passado pelo caller** [`src/lib/data/audited.ts:93`]: Risco teórico em edge cases extremos (sessão alterada entre leitura e audit). Mitigar passando `actorId` como parâmetro opcional se surgirem problemas em prod.

## Deferred from: code review of 3-5-subject-rights-hub-routing-for-adult-titular-encarregado (2026-05-21)

- **Rate limit em memória reset em cada cold start de Edge Function** [`supabase/functions/validate-subject-token/index.ts`]: Spec documenta "básico; Redis preferido, fallback em memória" — limitação conhecida e aceite. Implementar com Redis/Supabase KV quando o volume de GDPR requests justificar.
- **`x-forwarded-for` trivialmente spoofable para contornar rate limit** [`supabase/functions/validate-subject-token/index.ts`]: Spec diz "básico com headers" como abordagem intencional. Mitigar com Redis + WAF quando o endpoint for exposto a volume real.
- **Sub-pages de ações `(public)/[token]/` não revalidam token** [`src/app/(public)/direitos/[token]/exportar|apagar|retificar|limitar|retirar`]: Stubs placeholder; cada história 3.6–3.10 deverá incluir validação do token na implementação concreta.

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

- **Rota `/` pública sem redirect para utilizadores autenticados** (`sparta/src/app/page.tsx`): TODO já documentado no código; homepage mostra scaffold Next.js em vez de redirecionar para a home do role. Abordado em story futura de navegação/shell.
- **NFR17/NFR14 (1h token expiry e HTTPS) não configurados em código**: Dependem de configuração no dashboard Supabase e plataforma de deploy (Vercel/Cloudflare). Não são responsabilidade desta story; verificar antes do go-live.
- **Alert `success` variant não é standard shadcn/ui** (`sparta/src/components/ui/alert.tsx:847`): Variant custom adicionada. Se `npx shadcn@latest add alert` for executado, será sobrescrita silenciosamente. Extrair para design token ou documentar como override quando o Design System for formalizado (Story 1.8).

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

## Deferred from: code review of 1-17-design-token-font-system-alignment-visual-look-feel-baseline (2026-05-20)

- **`--font-mono` declarado duas vezes em `@theme inline`** [sparta/src/app/globals.css]: Redundância pré-existente — linhas ~17 e ~66 do bloco `@theme inline` declaram `--font-mono` com o mesmo valor. CSS last-write-wins; harmless mas confuso para manutenção. Limpar numa passagem de consolidação do globals.css.
- **Sem nonce/CSP para o script de dark mode inline** [sparta/src/app/layout.tsx]: O `<script dangerouslySetInnerHTML>` não tem nonce. Se o projecto adoptar uma Content Security Policy restrita (`script-src 'nonce-...'`), o script será bloqueado. Endereçar numa story dedicada de security hardening com headers de CSP.
- **`Datum` com `value=""` (string vazia) produz layout quebrado** [sparta/src/components/ui/datum.tsx]: Quando `value` é string vazia e `unit` está presente, o unit é renderizado sem número. Responsabilidade do caller por agora; adicionar validação se o componente for reutilizado em contextos dinâmicos.
- **`Datum` com `valueSize` ≤ 0 torna o texto invisível** [sparta/src/components/ui/datum.tsx]: Prop sem validação de mínimo — `valueSize={0}` ou negativo produz `fontSize: 0` que browsers ignoram. Adicionar `Math.max(1, valueSize)` se callers externos não controlarem o valor.
- **`Eyebrow` com `children` null/false renderiza apenas traço decorativo** [sparta/src/components/ui/eyebrow.tsx]: `React.ReactNode` aceita null/false; resulta em `<div>` com apenas `<span>` decorativo sem texto. Sem impacto no MVP — componente é primitivo interno; adicionar guard se tornar público.
- **Contagem de testes no AC #10 obsoleta** [1-17-design-token-font-system-alignment-visual-look-feel-baseline.md]: AC #10 refere "≥ 384 testes anteriores" mas a baseline real é ~748. Actualizar a spec da próxima story que referir contagem de testes.

## Deferred from: code review of 3-1-privacy-policy-versioning-sub-14-adapted-copy (2026-05-20)

- **Sem constraint UNIQUE na coluna `version`** [supabase/migrations/000165_privacy_policies.sql]: Versões duplicadas são possíveis se seed for executado múltiplas vezes sem reset completo. Aceitável por agora pois seed corre após `supabase db reset`. Adicionar `UNIQUE(version)` numa migration futura se a tabela crescer.
- **`effective_from DEFAULT CURRENT_DATE` dependente de timezone da sessão** [supabase/migrations/000165_privacy_policies.sql]: Tipo `date` vs `timestamptz`; `CURRENT_DATE` depende da timezone da sessão Postgres. Sem impacto em deployment UTC; relevante apenas se o servidor mudar de timezone.
- **Múltiplas linhas `players` por `profile_id` causariam excepção em `maybeSingle()`** [src/app/politica-privacidade/page.tsx:33]: Se `profile_id` não tiver constraint único na tabela `players`, `maybeSingle()` lança PGRST116. Dependente de constraint estabelecido na Story 2.1 — verificar se existe antes de considerar risco real.
- **Regex em `renderWithGlossary` não escapa caracteres especiais em termos do GLOSSARY** [src/app/politica-privacidade/policy-content.tsx:53]: GLOSSARY actual sem caracteres problemáticos (`RGPD`, `dados pessoais`). Risco latente para termos futuros com parênteses ou pontos. Usar `term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` quando novos termos forem adicionados.
- **`content` vazio passado a ReactMarkdown renderiza página em branco sem feedback** [src/app/politica-privacidade/policy-content.tsx:19]: Coluna `body_full_md` é NOT NULL e seed não-vazio; improvável em produção com constraints actuais. Adicionar guard `if (!content)` se o componente for reutilizado noutros contextos.
