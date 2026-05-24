# Story 4.4: Offline Submission + Pendentes Badge + Force Sync

**Status:** in-progress

**Story ID:** 4.4
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)
**Criado:** 2026-05-23
**Story anterior:** 4-3-sub-14-linguistically-adapted-version

---

## Story

As a Jogador,
I want to submit the questionnaire even when I have no connectivity, see how many submissions are pending, and force a manual sync,
So that I never lose my answers and I have visibility into the offline state.

---

## Acceptance Criteria

**AC #1 — Submissão offline com UUIDv7**

**Given** the player taps "Submeter" while offline
**When** the action is invoked
**Then** the payload (with UUIDv7 id) is enqueued in the Dexie outbox (`kind='fatigue.submit'`) (Story 1.11, FR23, AR18)
**And** `<CalmConfirmation>` shows "Em modo offline. Os teus dados estão seguros e vão ser enviados quando voltares a ter rede." (UX-DR38)

**AC #2 — Drain automático ao recuperar conectividade**

**Given** connectivity returns
**When** the foreground drain runs
**Then** queued submissions are sent to `submitFatigueResponse()` (Story 4.1)
**And** server upserts dedupe by UUIDv7 (NFR48)
**And** `submitted_via='offline-drain'` is recorded in the database
**And** the drain completes ≤5s for up to 50 entries on 4G (NFR3, NFR47)

**AC #3 — PendingBadge no "Hoje"**

**Given** the player's `<PendingBadge>` (UX-DR7)
**When** the outbox count > 0
**Then** the bottom tab "Hoje" shows "X pendentes" in `signal/info` blue with `aria-live="polite"` (FR24)
**When** count = 0
**Then** the badge is hidden

**AC #4 — Force sync manualmente**

**Given** the badge is tapped / visible
**When** the user is on `/hoje`
**Then** a "Sincronizar agora" ghost button is visible
**When** tapped
**Then** the drain runs immediately (foreground)
**And** completion shows the badge updating to the new count (or hiding if zero) (FR24)

**AC #5 — Proteção de outbox órfã no logout**

**Given** orphan-outbox protection (NFR52, AR20, Story 1.11)
**When** the player tries to log out with pending fatigue submissions
**Then** the warning `<Dialog>` lists the pending count
**And** offers a destructive "Sair mesmo assim" + ghost "Cancelar" (UX-DR33)

**AC #6 — Cobertura de testes**

**Given** test coverage (NFR54)
**When** integration tests run
**Then** offline submit, replay, dedupe, and force-sync are covered ≥80%

---

## Tasks / Subtasks

### Grupo 1: Extensão da camada de outbox (Dexie)

- [ ] **Task 1.1: Expandir schema Dexie para `fatigue.submit`** (AC: #1)
  - [ ] Abrir `src/lib/outbox/db.ts` (criado em Story 1.11)
  - [ ] Verificar que o store `pending_mutations` existe com schema `{ id: '&uuid', kind: 'text', payload: 'json', created_at: 'number', status: 'text', retry_count: 'number', submitted_via?: 'text' }`
  - [ ] Adicionar index `[kind, created_at]` se não existir (para queries rápidas de `fatigue.submit`)
  - [ ] Documentar no JSDoc que `kind='fatigue.submit'` tem payload com shape `{ sessionId: uuid, phase: 'pre'|'post', dimensions: {dim_energy..dim_mood: 1-5}, srpe_value?: 1-10 }`

- [ ] **Task 1.2: Implementar enqueue offline com retry-logic** (AC: #1)
  - [ ] Criar ou atualizar `src/lib/outbox/enqueue.ts` com função `enqueueFatigueSubmit({ sessionId, phase, dimensions, srpe_value? })`
  - [ ] Gerar UUIDv7 via `import { v7 as uuidv7 } from 'uuid'`
  - [ ] Enfileirar na Dexie com `db.pending_mutations.add({ id: newId, kind: 'fatigue.submit', payload, created_at: Date.now(), status: 'pending', retry_count: 0 })`
  - [ ] Retornar o UUID gerado (para server deduping) e o status offline
  - [ ] Não lançar exceção se Dexie falhar (graceful fallback: user+console.error)

### Grupo 2: Integração de offline na `<FatigueQuestionnaire>`

- [ ] **Task 2.1: Detetar conexão online/offline** (AC: #1, #2)
  - [ ] Usar `window.navigator.onLine` como fonte inicial
  - [ ] Usar event listeners `'online'` e `'offline'` para tracking dinâmico
  - [ ] Guardar estado em hook `useOnlineStatus()` que retorna `{ isOnline: boolean, isDrain?: boolean }`
  - [ ] Armazenar em estado local React: `const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true)`

- [ ] **Task 2.2: Modificar lógica de submit para offline** (AC: #1)
  - [ ] No handler `onSubmit`, antes de chamar `submitFatigueResponse()`, verificar `if (!isOnline)`
  - [ ] Se offline: chamar `enqueueFatigueSubmit()` em vez de server action (ou wrap a server action com try-catch que fallback para enqueue)
  - [ ] Mostrar `<CalmConfirmation>` com mensagem offline em português (AC #1)
  - [ ] Limpar o formulário ou redirecionar para `/hoje` após sucesso (ambos offline e online)
  - [ ] NÃO bloquear UI durante enqueue Dexie — é síncrono/rápido

- [ ] **Task 2.3: Armazenar state de autosave offline (complementar Story 4.2)** (AC: #1)
  - [ ] Garantir que IndexedDB recovery é compatível com outbox: se submit falha e re-abre a página, a resposta parcial está em IndexedDB, não no outbox
  - [ ] Documentar a hierarquia: IndexedDB cache (respostas parciais) vs. Dexie outbox (submissões completadas mas não enviadas)

### Grupo 3: Drain foreground (execução ao recuperar conectividade)

- [ ] **Task 3.1: Implementar drain service** (AC: #2)
  - [ ] Criar `src/lib/outbox/drain.ts` com função `drainPendingMutations(kind?: string)` que retorna `Promise<{ drained: number, failed: number, errors: Error[] }>`
  - [ ] Ler todas as rows de `pending_mutations` com `status='pending'` (filtrar por `kind='fatigue.submit'` se providenciado)
  - [ ] Para cada row, chamar `submitFatigueResponse()` (Server Action com `submitted_via='offline-drain'`)
  - [ ] No sucesso: marcar row como `status='done'`, ou remover imediatamente
  - [ ] No erro (network, validation): incrementar `retry_count`, manter como `status='pending'` para retry futuro
  - [ ] Falhas de validação (ex: jogador apagado): remover row com `status='error'` sem retry infinito
  - [ ] Timing: operações devem completar ≤5s para 50 entries (NFR3)
  - [ ] Fire-and-forget: erros não propagam para UI; apenas log de quantas falharam e quais

- [ ] **Task 3.2: Hook para ativar drain no foreground** (AC: #2)
  - [ ] Criar `useOutboxDrain()` hook que:
    - Deteta transição `isOnline` de false → true via event listeners
    - Invoca `drainPendingMutations()` no primeiro ato de conectividade
    - Pode ser forçada manualmente via `drain()` retornado pelo hook
    - Retorna `{ pendingCount: number, isDraining: boolean, drain: () => Promise<...> }`
  - [ ] Integrar em layout de jogador (Story 1.9) para rodar globalmente: `useOutboxDrain()` na root `(player)/layout.tsx`
  - [ ] Garantir que drain não corre durante logout (AC #5)

### Grupo 4: PendingBadge e UI de sincronização

- [ ] **Task 4.1: Implementar `<PendingBadge>` (referência UX-DR7)** (AC: #3, #4)
  - [ ] Criar componente `src/components/domain/PendingBadge.tsx`
  - [ ] Props: `count: number`, `isDraining?: boolean`, `onSyncClick?: () => void`
  - [ ] Renderizar "X pendentes" apenas se `count > 0`
  - [ ] Cor: `signal/info` azul (`--signal-info-bg`, `--signal-info-ink`)
  - [ ] Layout: ícone pequeno (lucide `AlertCircle` ou `Clock`) + texto "X pendentes"
  - [ ] `aria-live="polite"` para a11y (regiões dinâmicas)
  - [ ] Se `isDraining=true`, substituir ícone por spinner inline
  - [ ] Dimensões: toque ≥44×44px (NFR40)

- [ ] **Task 4.2: Integração do badge no tab "Hoje"** (AC: #3, #4)
  - [ ] Abrir `src/app/(player)/hoje/layout.tsx` ou o ficheiro de navegação player
  - [ ] Renderizar `<PendingBadge count={outboxCount} isDraining={isDraining} onSyncClick={handleSync} />`
  - [ ] Buscar `outboxCount` e `isDraining` do hook `useOutboxDrain()`
  - [ ] `handleSync` chama `drain()` do hook e aguarda conclusão
  - [ ] Após conclusão, badge deve esconder-se automaticamente (count → 0)

- [ ] **Task 4.3: Botão "Sincronizar agora" em `/hoje`** (AC: #4)
  - [ ] Quando badge é visível, mostrar ghost button (variant secondary/outline) com texto "Sincronizar agora"
  - [ ] Botão ativa apenas se `isDraining=false`
  - [ ] Ao clicar, invoca `drain()` e desabilita o botão até conclusão
  - [ ] Após sucesso ou erro, mostra feedback: `<CalmConfirmation>` "Sincronizado" ou "Erro ao sincronizar"
  - [ ] Colocação: perto do badge ou em `<EmptyState>` quando a lista de fatiga está vazia

### Grupo 5: Proteção de outbox órfã no logout

- [ ] **Task 5.1: Adicionar guarda de logout com verificação de outbox** (AC: #5)
  - [ ] Na função `handleLogout()` (Story 1.5, ou middleware de logout)
  - [ ] Antes de revogar session, chamar `db.pending_mutations.count(row => row.kind === 'fatigue.submit' && row.status === 'pending')`
  - [ ] Se count > 0, mostrar `<Dialog>` (destructive) com mensagem: "Tens X submissões por enviar. Sair sem sincronizar?"
  - [ ] Botões: "Sair mesmo assim" (destructive) + "Cancelar" (ghost)
  - [ ] Se "Sair mesmo assim", prosseguir com logout; senão, fechar dialog e manter sessão ativa
  - [ ] Documentar no story que é implementação complementar do orphan-outbox pattern de Story 1.11

### Grupo 6: Server Action `submitFatigueResponse` — modificações para `submitted_via`

- [ ] **Task 6.1: Adicionar coluna `submitted_via` à tabela `fatigue_responses`** (AC: #2)
  - [ ] Verificar migração `000200_fatigue_responses.sql` (Story 4.1): coluna `submitted_via text CHECK in ('online','offline-drain')` já existe?
  - [ ] Se não, criar migração `000201_fatigue_responses_submitted_via.sql` com:
    ```sql
    ALTER TABLE fatigue_responses
    ADD COLUMN submitted_via text NOT NULL DEFAULT 'online' 
        CHECK (submitted_via IN ('online', 'offline-drain'));
    ```
  - [ ] Atualizar `lib/actions/fatigue.ts` para aceitar `submitted_via?` no payload
  - [ ] Padrão: se não providenciado, defaults a `'online'`; drain sempre passa `'offline-drain'`

- [ ] **Task 6.2: Documentar deduplica por UUIDv7 no Server Action** (AC: #2)
  - [ ] Confirmar que `submitFatigueResponse()` usa `on conflict (id) do update`
  - [ ] Adicionar comentário JSDoc: "Chamadas repetidas com o mesmo UUID são idempotentes (NFR48)"
  - [ ] Exemplificar: retry de offline-drain com mesmo UUIDs não cria duplicados

### Grupo 7: Testes de integração

- [ ] **Task 7.1: Teste offline submit flow** (AC: #1, #6)
  - [ ] Ficheiro: `src/lib/outbox/drain.test.ts` e/ou adicionar a `fatigue.test.ts`
  - [ ] Mock `window.navigator.onLine = false`
  - [ ] Preencher form `/questionario/[sessionId]/pre`
  - [ ] Toque "Submeter" → `enqueueFatigueSubmit()` é chamado
  - [ ] Dexie tem 1 row com `kind='fatigue.submit'`, `status='pending'`
  - [ ] UI mostra confirmation offline
  - [ ] Server Action `submitFatigueResponse()` NÃO é chamado (ainda offline)

- [ ] **Task 7.2: Teste drain completo** (AC: #2, #6)
  - [ ] Enfileirar 5 submissões offline
  - [ ] Simular transição `isOnline: false → true`
  - [ ] `drainPendingMutations('fatigue.submit')` é invocado automaticamente
  - [ ] Cada UUIDv7 chega ao Server Action
  - [ ] Servidor upserta com `submitted_via='offline-drain'`
  - [ ] Dexie rows são marcadas `status='done'` ou removidas
  - [ ] Timing validado: 5 submissões completam <5s em mock environment

- [ ] **Task 7.3: Teste dedupe** (AC: #2, #6)
  - [ ] Enfileirar 1 submissão com UUID `abc123`
  - [ ] Drain executa, chama server com UUID `abc123`, sucesso, marca como done
  - [ ] Simular retry acidental (drain roda novamente)
  - [ ] Database tem apenas 1 row com `id=abc123` (não 2, não erro)

- [ ] **Task 7.4: Teste badge dinâmica** (AC: #3, #6)
  - [ ] Renderizar página `/hoje`
  - [ ] Badge não é visível (count=0)
  - [ ] Enfileirar 1 submissão offline
  - [ ] Hook `useOutboxDrain()` re-render, badge aparece "1 pendentes"
  - [ ] Toque botão "Sincronizar agora"
  - [ ] Drain completa, badge desaparece

- [ ] **Task 7.5: Teste logout guard** (AC: #5, #6)
  - [ ] Enfileirar submissões
  - [ ] Chamar logout
  - [ ] Dialog appears com contagem
  - [ ] Clicar "Cancelar" → dialog fecha, sessão mantém-se
  - [ ] Clicar "Sair mesmo assim" → logout prossegue, session revogada

---

## Dev Notes

### Dependências de Story 1.11 (Outbox Foundation)

Story 1.11 estabelece:
- Dexie database inicializada com `pending_mutations` store
- UUIDv7 via `uuid` v9+ package
- Service worker (Serwist) com offline support
- Hook `useOutboxDrain()` básico (pode estar já parcialmente implementado)

**Verificar antes de começar:**
- Existe `src/lib/outbox/db.ts` com schema Dexie definido?
- Existe `src/lib/uuid.ts` com `newId()`?
- Service worker pré-caching está funcional?

Se não, Story 1.11 deve ser completada **antes** desta (dependência crítica).

### Padrão Dexie — store polymórfico

O `pending_mutations` store é genérico:

```typescript
// src/lib/outbox/db.ts (já existe de Story 1.11)
export const db = new Dexie('sparta');
db.version(1).stores({
  pending_mutations: '&id, [kind+created_at], status'
});

export interface PendingMutation {
  id: string; // UUIDv7
  kind: 'fatigue.submit' | 'match.event' | /* future kinds */;
  payload: unknown; // polymórfico
  created_at: number; // timestamp ms
  status: 'pending' | 'done' | 'error';
  retry_count: number;
  submitted_via?: 'online' | 'offline-drain'; // adicionado em 4.4
}
```

**Foco em 4.4:** só `kind='fatigue.submit'` é enfileirado. Outras kinds são deixadas para futures stories (touchscreen events, etc.).

### Fluxo de navegação online/offline

```
User opens /hoje (Story 1.9, (player) layout)
    ↓
useOutboxDrain() hook inicia
    ↓
Check window.navigator.onLine
    ├─ true: scan Dexie, skip if empty
    └─ false: listen para 'online' event
    ↓
/questionario submit → offline?
    ├─ YES: enqueueFatigueSubmit(payload) → Dexie
    │        show "Em modo offline…"
    │        return (não chamar server action)
    └─ NO: submitFatigueResponse() → server (online)
    ↓
Evento 'online' dispara (ou manual "Sincronizar agora")
    ↓
drainPendingMutations() inicia
    ├─ Ler Dexie rows
    ├─ Para cada: submitFatigueResponse(payload + submitted_via='offline-drain')
    ├─ Mark done or remove
    └─ Return { drained, failed, errors }
    ↓
Badge atualiza (count → 0 se sucesso)
```

### Tratamento de erros do drain

**Erros de rede / timeout:**
- Increment `retry_count`
- Deixar `status='pending'` para retry futuro
- Não falhar toda a operação

**Erros de validação (Zod):**
- Remover row com `status='error'`
- Logar erro para debug
- Não retry

**Falhas de autenticação (401, 403):**
- Remover row (session expirou)
- Alertar user: "Sessão expirou. Faz login novamente e sincroniza."

### Performance: ≤5s para 50 entradas

Cada submissão é:
1. Ler row Dexie (~1ms)
2. Chamar Server Action `submitFatigueResponse()` (~50-100ms local + network latency)
3. Mark done (~1ms)

Em offline test com mock, esperado:
- 50 × ~100ms = 5000ms ✓
- Real 4G: network latency pode variar; validar em CI com mocked delays

**Otimização se necessário:**
- Batch `submitFatigueResponse()` em bulk action (POST /api/fatigue/batch)
- Implementar em Future (Story 4.5+)

### Integrações com outras stories

- **Story 1.11 (Outbox Foundation):** fornece base Dexie, UUIDv7, Service Worker
- **Story 4.1 (Fatigue Response Schema):** `submitFatigueResponse()` Server Action
- **Story 4.2 (Questionnaire UI):** componente que invoca submit
- **Story 4.3 (Sub-14 Adaptation):** compatível, sem alterações
- **Story 3.11 (Audit Logs):** drain não invoca `auditedRead()`, pois é background — logs criados por `submitFatigueResponse()` quando invocado via drain

### Offline-first philosophy

SPARTA assume que rede é flaky, especialmente em ambientes de treino com várias pessoas em WiFi partilhado. Guarantias:

1. **Dados nunca se perdem** — offline enqueue sempre sucede (síncrono em Dexie)
2. **Deduplica automaticamente** — UUIDv7 client-side + upsert server-side
3. **Sem UI bloqueante** — drain roda em background
4. **Feedback claro** — badge + manual sync button deixam user no controlo

---

## Testing Strategy

### Unit Tests (`src/lib/outbox/enqueue.test.ts`, `src/lib/outbox/drain.test.ts`)

- Enqueue: gera UUID, insere em Dexie, retorna id
- Drain: lê rows, simula Server Action calls, marca como done
- Dedupe: mesma UUID não cria linhas duplicadas

### Integration Tests (`src/app/(player)/hoje/offline.integration.test.ts`)

- Full flow: offline submit → drain → badge update
- Orphan outbox: logout com pending

### E2E (Playwright — Phase 2)

- Real browser offline simulation
- Network throttling
- Multi-tab sync (localStorage cross-tab sync)

---

## Checklist pré-implementação

- [ ] Story 1.11 (Outbox Foundation) **done** ou pronta para merge
- [ ] Story 4.1 (Fatigue Response Schema) **done**
- [ ] Story 4.2 (Questionnaire UI) **done**
- [ ] Story 4.3 (Sub-14 Adaptation) **done**
- [ ] Arquivo `src/lib/outbox/db.ts` existe e compilável
- [ ] Arquivo `src/lib/uuid.ts` com `newId()` existe
- [ ] UX-DR7 (`<PendingBadge>`) e UX-DR33 (Dialog) componentes shadcn disponíveis (Story 1.8)

---

## Acceptance Criteria Summary

| AC | Foco | Status |
|----|------|--------|
| #1 | Offline submit com UUIDv7 → Dexie | Implementar Task 1.1–1.2, 2.1–2.2 |
| #2 | Drain automático + dedupe | Implementar Task 3.1–3.2, 6.1–6.2 |
| #3 | Badge mostra pendentes | Implementar Task 4.1–4.2 |
| #4 | Force sync manual | Implementar Task 4.3 |
| #5 | Logout guard | Implementar Task 5.1 |
| #6 | Cobertura testes | Implementar Task 7.1–7.5 |

---

## Review Findings

### Decision-Needed

- [ ] [Review][Decision] **window.navigator.onLine unreliability** — Online detection relies on unreliable browser API that does not confirm actual server connectivity. Corporate networks, metered connections, and proxies can report "online" while actual API calls fail. Need decision: (A) Implement real connectivity test (fetch with timeout) in handler, (B) Accept unreliability and document as NFR limitation, (C) Hybrid approach with fallback to actual fetch if navigator.onLine is stale.

### Patches

- [ ] [Review][Patch] **Draining flag can get stuck true** [drain.ts:31,87] — Global `draining` flag not reset if uncaught error occurs outside try-finally. Future refactors could break this. Use per-call lock or ensure finally always executes.
- [ ] [Review][Patch] **Dexie transaction not guaranteed before browser close** [enqueue.ts:38-42] — Promise resolves before IndexedDB write physically commits to disk. User closes tab after confirmation message shown, data lost. Document limitation or implement client-side timestamp tracking.
- [ ] [Review][Patch] **Concurrent drain race on update completion** [drain.ts:50-60] — Handler errors trigger update, but draining flag reset before all pending updates finish. Second drain reads stale retry counts, causes double-processing. Move `draining = false` to end of updates.
- [ ] [Review][Patch] **isOnline stale during form submission** [fatigue-questionnaire.tsx:189-253] — User clicks submit while online, network drops before `enqueueFatigueSubmit()` call. Server action invoked despite offline, fails, draft not cleared. Re-check `isOnline` just before branching.
- [ ] [Review][Patch] **Multiple scan intervals accumulate on re-mounts** [useOutboxDrain.ts:28-47] — Effect creates new interval without deduplicating existing ones. Multiple mounts/unmounts create N intervals scanning every 2s. Add interval cleanup or deduplication.
- [ ] [Review][Patch] **Unregistered handler skips without retry or error** [drain.ts:42-48] — Mutations with no registered handler stay pending indefinitely. No max retry limit, no status update to `failed`. Add retry counter check and fail after 3 attempts.
- [ ] [Review][Patch] **Payload validation missing in drain path** [drain.ts:101-107, enqueue.ts:23-43] — Handler blindly casts `payload as FatigueResponseInput` without Zod validation. If outbox corrupted or manually edited, invalid data reaches server. Validate payload shape before handler invocation.
- [ ] [Review][Patch] **Error classification fragile (substring matching)** [drain.ts:61-82] — Code distinguishes error types by checking if error message contains "validation". Brittle: real network error with "validation" substring gets marked unrecoverable. Use structured error codes or `.code` property.
- [ ] [Review][Patch] **Race on offline→online transition state** [useOutboxDrain.ts:51-78] — `hasScannedOnline` state updated without atomic check. User flaky network → online→offline rapidly. Multiple drains fire before all complete, state becomes stale. Use ref-based guard or lock.
- [ ] [Review][Patch] **Pending count increases after successful drain** [drain.ts:66-71] — Recount pending mutations post-drain to update UI. Under concurrent write, new mutations added by another tab. Count goes up after successful drain (confusing UX). Document or use versioned snapshot.
- [ ] [Review][Patch] **Retries fire rapidly without exponential backoff** [drain.ts:71-76] — Retry logic increments counter immediately on error, no minimum backoff. Flaky network → 3 rapid retries before marking failed. Server sees 3× submissions, dedupe mechanism overwhelmed. Add exponential backoff (100ms → 500ms → 2s).
- [ ] [Review][Patch] **Performance: Dexie query filters in JavaScript** [useOutboxDrain.ts:29-40] — Count query uses `.and(m => m.status === 'pending')` applying JS filter after fetch. Large outbox (thousands of rows) fetches all into memory before filtering. Chain queries to use compound index.
- [ ] [Review][Patch] **Draft cleanup failure causes duplicate submissions** [fatigue-questionnaire.tsx:210-214] — IndexedDB delete error caught but not surfaced to user. Draft persists, next mount restores old draft, user resubmits. Show error in UI or retry delete.
- [ ] [Review][Patch] **Stale pendingCount after manual drain** [today-outbox-badge.tsx:17-22] — Drain completes, badge queries pendingCount synchronously but interval updates async (2s delay). Badge shows stale count. Return updated count from drain function.
- [ ] [Review][Patch] **Count scan continues after unmount** [useOutboxDrain.ts:28-48] — Periodic interval query completes after component unmount, calls setState on unmounted component. React warning, potential memory leak. Add mounted ref or cleanup flag check.
- [ ] [Review][Patch] **Type safety: Unknown payload cast without validation** [enqueue.ts:31] — Payload stored as `unknown` in Dexie, cast to `FatigueResponseInput` on drain without runtime check. TypeScript hides IndexedDB corruption risk. Use Zod parse before cast.

### Deferred

- [x] [Review][Defer] **No explicit 4G performance test** [test suite] — deferred, architecture supports ≤5s claim but not empirically tested on real 4G. Add slow-network CI test in future.
- [x] [Review][Defer] **Offline message not in i18n bundle** [fatigue-questionnaire.tsx:217] — deferred, hardcoded Portuguese string. Align with Story 4.3 i18n strategy in future iteration.

---

## Next Steps (após implementation)

1. Run `npm run build && npm run test --run` para validação local
2. Verificar Lighthouse CI em PR (bundle ≤200KB preservado)
3. Code review com foco em: error handling, race conditions, offline resilience
4. Merge para `main`
5. Proceder para Story 4.5 (Staff Read — Individual Responses & 4-Week Trends)

---

**Ultimate Context Engine Complete.** 🚀

Desenvolvedor tem tudo o que precisa para implementar flawlessly:
✅ Requirement clarity (6 ACs, 7 task groups)
✅ Code references (paths, file names, imports)
✅ Architecture decisions (Dexie polymorphic, drain logic, error handling)
✅ Dependencies mapped (Stories 1.11, 4.1, 4.2, 4.3)
✅ Testing strategy (unit, integration, E2E phase 2)
✅ Performance guardrails (≤5s drain, ≥44px touch, NFR compliance)
✅ UX references (UX-DR7, UX-DR33, UX-DR38)
