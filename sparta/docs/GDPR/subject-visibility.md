# Visibilidade do Titular — Quem Consultou os Meus Dados

**Referência:** FR51, NFR20, RGPD Art. 15  
**Story:** 3.12 — Subject Visibility: Who Accessed My Health Data

---

## O que são os registos de acesso?

Cada vez que um membro do staff (treinador ou analista) consulta dados de saúde de um jogador, o sistema regista automaticamente:

- **Quem** acedeu (nome e papel do staff)
- **O quê** foi consultado (tipo de dado)
- **Quando** aconteceu (data e hora exatas)

Estes registos ficam disponíveis para consulta pelo titular e pelo Encarregado de Educação durante 12 meses.

---

## Como consultar os registos

### Titular (adulto autenticado ≥16 anos)

1. Entrar em **Configurações → Os meus direitos**
2. Clicar em **"Quem consultou os meus dados"**
3. Rota: `/configuracoes/direitos/acessos`

### Encarregado de Educação (via link de token)

1. Abrir o link recebido por email
2. Navegar para **"Quem consultou os dados"**
3. Rota: `/direitos/[token]/acessos`

---

## Mapeamento de ações (PT-PT)

| Código interno | Texto apresentado |
|---|---|
| `viewed_fatigue_response` | Consultou questionário de fadiga |
| `read_match_events` | Consultou eventos de jogo |
| `read_readiness_snapshot` | Consultou painel de prontidão |
| `read_session_metrics` | Consultou métricas da sessão |
| `subject.exported` | Solicitou exportação de dados |
| `subject.withdrew` | Retirou consentimento |
| `subject.restricted` | Limitou o tratamento de dados |
| `subject.unrestricted` | Removeu limitação de tratamento |
| `subject.rectified` | Solicitou retificação de dados |
| `health_data.read` | Consultou dados de saúde |
| `fatigue.submitted` | Submeteu questionário de fadiga |
| `event.recorded` | Registou evento de jogo |
| `decision.marked` | Marcou decisão de prontidão |
| `export.requested` | Pediu exportação de dados |
| `erasure.requested` | Pediu apagamento de dados |

Ações desconhecidas são apresentadas pelo código interno (fallback sem tradução).

---

## Mapeamento de tipos de dado (PT-PT)

| Código interno | Texto apresentado |
|---|---|
| `fatigue_response` | Questionário de fadiga |
| `match_event` | Evento de jogo |
| `readiness_snapshot` | Painel de prontidão |
| `session_metrics` | Métricas da sessão |
| `player` | Perfil |
| `profile` | Perfil |

---

## RLS e segurança

A política `audit_logs_player_read` (Story 1.12) garante:

- **Titular autenticado**: só vê entradas onde `target_id = auth.uid()` e o seu papel é `player`
- **Encarregado via token**: usa service-role para contornar RLS; o token é validado via Edge Function `validate-subject-token`; a query filtra por `target_id IN (player.id, player.profile_id)` para cobrir ambos os tipos de identificador

Não existe fugas entre sujeitos: um titular não pode ver os registos de outro.

---

## Janela de retenção

Os registos são retidos por **12 meses** (NFR20). A query filtra automaticamente:

```sql
occurred_at >= now() - interval '12 months'
```

Após 12 meses os registos são apagados pelo job `pg_cron` configurado na Story 1.12.

---

## Exportação

O botão "Exportar este histórico" chama a infraestrutura da Story 3.6:

- **Titular**: `requestDataExportForSelf()` — exporta todos os dados do titular
- **Encarregado**: `requestDataExportByToken(token)` — exporta todos os dados do menor

O ficheiro exportado inclui **todos os dados do titular**, não apenas os registos de acesso.

---

## Ficheiros relevantes

| Ficheiro | Descrição |
|---|---|
| `src/lib/actions/audit-visibility.ts` | Server Actions: `getAuditLogForSubject`, `getAuditLogForSubjectByToken` |
| `src/lib/i18n/audit-actions.ts` | Mapeamento PT-PT para ações e tipos de dado |
| `src/lib/format/date-time.ts` | Formatação de datas em PT-PT via `date-fns` |
| `src/components/domain/AuditLogList.tsx` | Componente principal de listagem |
| `src/components/patterns/Pagination.tsx` | Componente de paginação reutilizável |
| `src/app/configuracoes/(subject-rights)/direitos/acessos/page.tsx` | Rota titular |
| `src/app/(public)/direitos/[token]/acessos/page.tsx` | Rota Encarregado |
| `supabase/migrations/000080_audit_logs.sql` | Schema e RLS da tabela `audit_logs` |
