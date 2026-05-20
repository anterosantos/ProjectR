# Story 3.4: Consentimento Parental — Lembretes Dia 7/14 & Alerta Staff

**Status:** ready-for-dev

**Story ID:** 3.4  
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR  
**Created:** 2026-05-20

---

## Story

Como um sistema automático,
Quero reenviar o pedido de consentimento parental ao 7º e 14º dia sem resposta, e alertar o staff após 14 dias,
Para que o consentimento não expire silenciosamente e o staff possa intervir junto da família se necessário.

---

## Acceptance Criteria

### AC #1: pg_cron job `parental_consent_reminders` executa diariamente

**Given** a migração `000170_pg_cron_consent_reminders.sql` é aplicada  
**When** o PostgreSQL inicia  
**Then** um job `parental_consent_reminders` está agendado para correr todos os dias às 08:00 UTC  
**And** o job é idempotente (não falha se já existe)

---

### AC #2: Lembrete ao 7º dia

**Given** uma linha em `parental_consents` com `status='pending'` e `created_at` = hoje - 7 dias  
**When** o job `parental_consent_reminders` corre  
**Then** a Edge Function `send-parental-consent` é invocada com `{ consentId, includePrefix: true, prefixText: '[Lembrete]' }`  
**And** o email é reenviado com subject "Lembrete: Consentimento parental — Project R"  
**And** o template HTML personaliza a copy com "Se já confirmou, pode ignorar este lembrete"  
**And** um registo em `parental_consent_reminders_log` marca a tentativa (idempotência 24h)

---

### AC #3: Lembrete ao 14º dia

**Given** uma linha em `parental_consents` com `status='pending'` e `created_at` = hoje - 14 dias  
**When** o job `parental_consent_reminders` corre  
**Then** a Edge Function `send-parental-consent` é invocada com subject "2º Lembrete: Consentimento parental — Project R"  
**And** a copy enfatiza urgência ("Esta é a última tentativa de reenvio automático")  
**And** um registo em `parental_consent_reminders_log` marca a tentativa

---

### AC #4: Alerta staff após 14+ dias

**Given** uma linha em `parental_consents` com `status='pending'` e `created_at` é ≥14 dias atrás  
**When** o job `parental_consent_reminders` corre E nenhum alerta foi enviado ainda  
**Then** um email é enviado para os coach + analistas do clube via Resend EU  
**And** o subject é "Project R — Consentimento parental pendente"  
**And** a copy é: "X jogadores têm consentimento parental por confirmar. Contacta as famílias ou rejeita a participação na plataforma."  
**And** um registo em `parental_consent_reminders_log` com `kind='staff_alert'` marca o envio  
**And** o template inclui lista de nomes dos jogadores (até 5, depois "... e mais X")

---

### AC #5: Banner in-app no `/plantel` para staff

**Given** o staff visualiza a página `/plantel` (rota staff-only)  
**When** existem consentimentos pendentes ≥14 dias para jogadores desse clube  
**Then** um banner alerta (amarelo/warning) é renderizado no topo: "X jogadores com consentimento parental por confirmar"  
**And** o banner lista os nomes dos jogadores (scroll se necessário)  
**And** cada jogador tem um botão "Reenviar manualmente"  
**And** clicar dispara `resendConsentEmail` imediatamente, com rate-limit de 1 por 5 minutos por linha  
**And** feedback visual "Email reenviado" é mostrado após sucesso  
**And** se a ação falha, um toast "Falha ao reenviar — tenta novamente" é exibido

---

### AC #6: Idempotência — tabela `parental_consent_reminders_log`

**Given** a migração cria a tabela `parental_consent_reminders_log`  
**When** consultada  
**Then** possui campos: `id (uuid)`, `consent_id (uuid)`, `kind (text: 'day_7', 'day_14', 'staff_alert')`, `sent_at (timestamptz)`  
**And** RLS é ativa (apenas service-role pode INSERT)  
**And** uma constraint `UNIQUE (consent_id, kind, DATE(sent_at))` previne lembretes duplos no mesmo dia  
**And** o job verifica esta tabela antes de enviar

---

### AC #7: Protecção de rate-limit no botão manual

**Given** o staff clica "Reenviar manualmente" para um jogador  
**When** a Server Action `resendConsentEmail` é invocada  
**Then** uma chave redis `resend:consent:{consentId}:{timestamp_floor_5min}` é verificada  
**And** se existir, um erro é retornado: "Pode reenviar novamente em X minutos"  
**And** se não existir, o email é reenviado E a chave é definida com TTL 5min  
**And** sem redis, um fallback simples registra `last_manual_send` na tabela (aceitável para MVP)

---

### AC #8: Cobertura de testes ≥80% (NFR54)

**Given** `npm run test --run` é executado  
**When** os testes correm  
**Then** cobertura inclui:
- Teste unitário: cálculo de "hoje - 7 dias" vs. `created_at`
- Teste unitário: cálculo de "hoje - 14 dias"
- Teste unitário: construção de copy de email com nomes de jogadores
- Teste unitário: construção de query para staff que receberá email (coaches do clube)
- Teste de integração: mock do job cron com data simulada, verifica que `parental_consent_reminders_log` tem entradas corretas
- Teste de integração: duplicação prevenida (executar job 2x, verificar que 1 email)
- Teste E2E: banner renderiza, botão "Reenviar" dispara fetch, feedback visual
- **Mínimo 6 testes** para cobrir os 3 branches principais (day 7, day 14, staff alert)

---

## Tasks / Subtasks

- [ ] **Task 1: Migração `000170_pg_cron_consent_reminders.sql`** (AC #1)
  - [ ] 1.1 Criar tabela `parental_consent_reminders_log` (id uuid, consent_id uuid, kind text, sent_at timestamptz)
  - [ ] 1.2 Adicionar constraint UNIQUE por (consent_id, kind, DATE(sent_at))
  - [ ] 1.3 Habilitar RLS; somente service-role pode INSERT
  - [ ] 1.4 Criar função `parental_consent_reminders()` em PL/pgSQL:
    - Consultar `parental_consents` com `status='pending'`
    - Filtrar por `created_at::date = CURRENT_DATE - INTERVAL '7 days'` (dia 7)
    - Filtrar por `created_at::date = CURRENT_DATE - INTERVAL '14 days'` (dia 14)
    - Filtrar por `created_at < CURRENT_DATE - INTERVAL '14 days'` (≥14 dias, sem alerta ainda)
    - Fazer HTTP POST para Edge Function `send-parental-consent` com includePrefix
    - Inserir em `parental_consent_reminders_log`
    - Tratar erros (retry lógica simples: 3 tentativas)
  - [ ] 1.5 Registar job no pg_cron: `SELECT cron.schedule('parental_consent_reminders', '0 8 * * *', 'SELECT parental_consent_reminders();');`

- [ ] **Task 2: Atualizar Edge Function `send-parental-consent`** (AC #2, #3, #4)
  - [ ] 2.1 Adicionar parâmetros opcionais ao request: `{ consentId, includePrefix?: boolean, prefixText?: string }`
  - [ ] 2.2 Se `includePrefix=true`, personalizar o email:
    - Subject: `${prefixText} Consentimento parental — Project R`
    - Copy adicional: "Se já confirmou, pode ignorar."
  - [ ] 2.3 Verificar `parental_consent_reminders_log` antes de enviar (verificação de idempotência)
  - [ ] 2.4 Se já foi enviado no mesmo dia, retornar `{ ok: true, skipped: true, reason: 'already_sent_today' }`

- [ ] **Task 3: Criar Edge Function `staff-alert-consent` (ou reutilizar `send-parental-consent` com modo staff)** (AC #4)
  - [ ] 3.1 Endpoint separado OU flag em `send-parental-consent`
  - [ ] 3.2 Aceitar `{ consentIds: uuid[] }` ou query por `created_at < today - 14d`
  - [ ] 3.3 Agrupar por `club_id`
  - [ ] 3.4 Para cada clube, obter emails dos coaches + analistas via RLS:
    ```sql
    SELECT DISTINCT p.email FROM profiles p
    WHERE p.club_id = :club_id AND p.role IN ('coach', 'analyst')
    ```
  - [ ] 3.5 Enviar email para cada staff com lista de jogadores afectados
  - [ ] 3.6 Registar em `parental_consent_reminders_log` com `kind='staff_alert'`

- [ ] **Task 4: Actualizar `src/lib/actions/consent.ts` para suportar rate-limit manual** (AC #7)
  - [ ] 4.1 Em `resendConsentEmail`, verificar rate-limit:
    - Se redis disponível: usar chave `resend:consent:{consentId}:{timestamp_floor_5min}`
    - Se redis indisponível: usar coluna `last_manual_resend_at` em `parental_consents` (adicionar em migration anterior se necessário)
  - [ ] 4.2 Se rate-limitado, retornar `err({ code: 'rate_limited', message: 'Pode reenviar novamente em X minutos' })`
  - [ ] 4.3 Insira entry em `parental_consent_reminders_log` com `kind='manual_resend'`

- [ ] **Task 5: Criar banner no `/plantel` para alertar staff** (AC #5)
  - [ ] 5.1 Server Component `/plantel/pending-consents-banner.tsx`:
    - Chamar `getServiceRoleClient().from('parental_consents').select(...).eq('status', 'pending').lt('created_at', today - 14 days)`
    - Agrupar por jogador
    - Renderizar `<Banner>` se houver resultados
  - [ ] 5.2 Banner UI:
    - Cor de aviso (amarelo)
    - Texto: "X jogadores com consentimento parental por confirmar"
    - Lista de nomes (scrollable se >5)
    - Botão "Reenviar manualmente" para cada
  - [ ] 5.3 Client Component para "Reenviar manualmente":
    - Botão dispara `resendConsentEmail(consentId)`
    - Toast feedback ("Email reenviado" ou erro)
    - Rate-limit feedback ("Pode reenviar novamente em 5 minutos")

- [ ] **Task 6: Testes unitários** (AC #8)
  - [ ] 6.1 `__tests__/lib/cron/parental_consent_reminders.test.ts`:
    - Mock data: jogador criado há 7, 14, 20 dias
    - Teste: função calcula corretamente quais devem receber dia 7
    - Teste: função calcula corretamente quais devem receber dia 14
    - Teste: função identifica staff para alerta
    - Teste: `parental_consent_reminders_log` previne duplicatas
  - [ ] 6.2 `__tests__/lib/actions/consent.test.ts` — adicionar:
    - Teste: `resendConsentEmail` com rate-limit ativo
    - Teste: rate-limit permite resend após 5 minutos

- [ ] **Task 7: Testes E2E** (AC #5, #8)
  - [ ] 7.1 `__tests__/app/plantel/pending-consents-banner.test.tsx`:
    - Render com 2 consentimentos pendentes >14 dias
    - Verificar que banner renderiza
    - Verificar que lista nomes
    - Clicar "Reenviar" → mock fetch → toast "Email reenviado"

- [ ] **Task 8: Migração update (se necessário para `last_manual_resend_at`)** 
  - [ ] 8.1 Se redis não estiver disponível, adicionar coluna a `parental_consents` (migration separada `000171_add_resend_tracking.sql`):
    ```sql
    ALTER TABLE parental_consents ADD COLUMN last_manual_resend_at TIMESTAMPTZ DEFAULT NULL;
    ```

- [ ] **Task 9: Verificação final**
  - [ ] 9.1 `npm run lint` — zero erros
  - [ ] 9.2 `npm run typecheck` — zero erros
  - [ ] 9.3 `npm run test --run` — 80%+ cobertura + todos os novos testes verdes
  - [ ] 9.4 `npm run build` — build sucesso
  - [ ] 9.5 Validar `supabase db reset` com migration `000170_*`

---

## Dev Notes

### Dependências Críticas

Story 3-4 **requer** que as seguintes histórias estejam completadas:
- ✅ **Story 3-2:** `parental_consents` tabela, migration `000170_parental_consents.sql`, `profiles.consent_status`
- ✅ **Story 3-3:** Edge Function `send-parental-consent`, Edge Function `consent-validate`, Server Action `resendConsentEmail` stub

Verificar em `src/lib/actions/consent.ts` e `supabase/migrations/` que todos os artefatos estão presentes.

### Padrão pg_cron neste projeto

Ver `_bmad-output/implementation-artifacts/1-12-audit-logs-telemetry-foundation-tables.md` (Story 1-12) para o padrão de `pg_cron` com:
- Função PL/pgSQL sem `CREATE EXTENSION pg_cron` (já existe)
- RLS na tabela de logs
- Tratamento de erros com `EXCEPTION` e logging via `RAISE WARNING`

**NÃO usar `DO` blocks ou `CALL` — usar migrations standard com `SELECT cron.schedule`.**

### Padrão de email neste projeto

Ver Story 3-3: templates HTML inline, sem CDN, Resend EU, plain-text fallback.

Mesmo padrão para:
- Email do lembrete (AC #2, #3): adicionar `includePrefix` ao template existente
- Email de alerta staff (AC #4): novo template `staffAlertConsentEmail()` (similar, mas sem links de confirmação)

### Rate-limit — sem Redis no MVP

Se redis não está configurado (verificar `process.env.REDIS_URL`):
- Usar coluna `last_manual_resend_at` em `parental_consents`
- Validação simples: `if (last_manual_resend_at && now() - last_manual_resend_at < 5min) → reject`
- Atualizar coluna na `resendConsentEmail`

**Preferência:** redis (melhor para scale), fallback: coluna (MVP simples).

### Contexto Anterior — Story 3-3 Learnings

De [3-3 code review](3-3-parental-consent-email-send-token-landing-page.md):
- ✅ Email validation: `parent_email` sempre existe (validado no insert em Story 3-2)
- ✅ Token expiration: já tratado em Edge Function `consent-validate`
- ✅ Fire-and-forget em `initiateParentalConsent`: uso de `.catch()` para logging
- ⚠️ Edge Function error handling: `sendConfirmationEmail` usa try-catch — replicar aqui
- 📌 Template personalização: usar helper function `parentalConsentEmailHtml()` com parâmetros

### Commits Recentes — Padrões de Implementação

Últimos 3 commits (conforme git log):
```
ee3482b docs: mark Story 3-3 as review-complete after adversarial code review
388032b feat: implement parental consent flow with security patches
620fe5e fix: replace pg_uuidv7 extension with public.uuidv7 for UUID generation
```

Padrões observados:
- ✅ Migrations em `supabase/migrations/000XXX_*.sql` com números sequenciais
- ✅ Edge Functions em `supabase/functions/{name}/index.ts` + `deno.json`
- ✅ Server Actions em `src/lib/actions/*.ts` com Result<T, E> pattern
- ✅ Testes em `src/__tests__/lib/actions/*.test.ts` com vitest + vi.mock
- ✅ Commits detalhados listando patches específicos no corpo

Replicar este padrão para Story 3-4.

---

## Ficheiros a Criar/Modificar

| Artefato | Path | Tipo |
|----------|------|------|
| Migration 1 | `supabase/migrations/000172_pg_cron_consent_reminders.sql` | NEW |
| Migration 2 (opcional) | `supabase/migrations/000173_add_resend_tracking.sql` | NEW (se sem redis) |
| Edge Function | `supabase/functions/send-parental-consent/index.ts` | UPDATE (adicionar prefix lógica) |
| Server Action | `src/lib/actions/consent.ts` | UPDATE (`resendConsentEmail` rate-limit) |
| Banner Component | `src/app/(staff)/plantel/pending-consents-banner.tsx` | NEW |
| Banner Test | `src/__tests__/app/plantel/pending-consents-banner.test.tsx` | NEW |
| Cron Test | `src/__tests__/lib/cron/parental_consent_reminders.test.ts` | NEW |
| Consent Test | `src/__tests__/lib/actions/consent.test.ts` | UPDATE (rate-limit testes) |

---

## Architecture Compliance Checklist

- [ ] **Path Aliases:** Todos os imports usam `@/...` (não relativos)
- [ ] **React 19:** Sem `import React` desnecessária; JSX automático
- [ ] **TypeScript noUncheckedIndexedAccess:** Toda a indexação guarded com `?.` e `??`
- [ ] **RLS:** Tabela `parental_consent_reminders_log` tem RLS ativo
- [ ] **Service-role uso:** Edge Functions usam service-role; server actions usam cliente autenticado
- [ ] **Testes:** Vitest + vi.mock de Next.js/Supabase
- [ ] **Commits:** Cada patch é clear com AC e evidência

---

## Test Coverage Breakdown

| Feature | Tests | Coverage |
|---------|-------|----------|
| Day 7 reminder calculation | 2 | 100% |
| Day 14 reminder calculation | 2 | 100% |
| Staff alert logic | 2 | 100% |
| Idempotency (parental_consent_reminders_log) | 2 | 100% |
| Rate-limit (manual resend) | 2 | 100% |
| Banner rendering | 2 | 100% |
| Email template personalization | 1 | 100% |
| **TOTAL** | **13 tests** | **≥80%** |

Target: **796+ testes passing** (atual) + 13 novos = **809+ passing**

---

## Non-Functional Requirements (Referência)

- **NFR7:** First Contentful Paint ≤1,5s — banner não impacta (Server Component)
- **NFR14:** HTTPS — emails via Resend EU
- **NFR22:** Sem third-party analytics — conforme
- **NFR27:** Export SLA — não aplicável aqui
- **NFR50:** Database heartbeat — existente (Story 1-14)
- **NFR54:** Test coverage ≥80% — **atingido nesta story**
- **NFR56:** Structured logs — `parental_consent_reminders_log` para auditoria

---

## Completion Status

**Story file creation:** ✅ Complete  
**Context analysis:** ✅ Complete  
**Architecture compliance verified:** ✅ Yes  
**Ready for dev-story:** ✅ Yes

**Next:** Run `dev-story 3-4-parental-consent-reminders-day-7-14-staff-alert` to begin implementation.
