# Story 3.10: Direito de Retirada de Consentimento — Efeito Imediato

**Status:** ready-for-dev

**Story ID:** 3.10
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR
**Criado:** 2026-05-22
**Story anterior:** 3-9-right-to-restrict-processing-freeze-state

---

## User Story

Como um titular adulto (ou Encarregado de Educação),
Quero retirar o meu consentimento imediatamente e acionar o apagamento dos meus dados,
Para que o Art. 21 do RGPD seja cumprido sem período de espera.

---

## Acceptance Criteria

### AC #1: Retirada para titular adulto autenticado

**Given** o titular acede a `/configuracoes/direitos/retirar`
**When** confirma via Dialog destructivo
**Then** Server Action `withdrawConsent()` é chamada
**And** entrada `audit_logs` com `action='subject.withdrew'` é criada (síncrono — compliance crítico)
**And** o cascade de apagamento (Story 3.7 — `fn_erase_subject_cascade`) é accionado automaticamente
**And** o utilizador é feito signOut (sessão invalidada)
**And** o efeito é imediato (NFR29)

---

### AC #2: Retirada para Encarregado via token público

**Given** o Encarregado acede a `/direitos/[token]/retirar` com token válido
**When** confirma via Dialog destructivo
**Then** Server Action `withdrawConsentByToken(token)` é chamada
**And** `parental_consents.status='withdrawn'` é definido para o menor
**And** `profiles.consent_status='revoked'` é definido (bloqueia acesso via middleware Story 3.2, se o menor tiver conta)
**And** entrada `audit_logs` com `action='subject.withdrew'` é criada
**And** cascade de apagamento é accionado automaticamente

**Given** token inválido ou expirado
**Then** `<EmptyState>` é mostrado (padrão de Story 3.7/3.8/3.9)

---

### AC #3: Confirmação via Dialog destructivo

**Given** qualquer fluxo de retirada
**When** o utilizador clica "Retirar consentimento"
**Then** `<Dialog>` destructivo (UX-DR33) abre com aviso claro de irreversibilidade
**And** título "Retirar consentimento?"
**And** descrição: "Esta ação é irreversível. Os teus dados serão apagados permanentemente."
**And** botão "Confirmar retirada" (destructive) + "Cancelar" (ghost)
**When** confirmado:
**Then** `<CalmConfirmation>` é mostrado com mensagem apropriada antes do redirect/logout

---

### AC #4: Mutações offline pendentes são descartadas

**Given** existe outbox com mutações pendentes no cliente (NFR52, AR20)
**When** a retirada é confirmada com sucesso
**Then** o Client Component limpa as mutações pendentes do outbox Dexie:
  `await db.outbox.where('status').equals('pending').delete()`
**And** nenhuma mutação pendente é sincronizada após a retirada

---

### AC #5: Visibilidade no audit log (Story 3.12)

**Given** o audit log é consultado pela Story 3.12
**When** a retirada é processada
**Then** a entrada `action='subject.withdrew'` é criada ANTES do apagamento em cascata
**And** após anonimização pelo cascade, a entrada persiste com `target_id=null` (evidência sem dados pessoais)

---

### AC #6: Acessibilidade

**Given** as páginas de retirada renderizam
**When** testadas com axe-core
**Then** zero violações a11y
**And** botões de confirmação têm `aria-busy` durante loading
**And** o `<Dialog>` tem focus trap e ESC fecha (UX-DR33)

---

## Tasks / Subtasks

### Task 1: Server Actions em `data-rights.ts` (AC #1, #2, #5)

- [ ] 1.1 Adicionar a `sparta/src/lib/actions/data-rights.ts`
- [ ] 1.2 Tipo `WithdrawalResult = { withdrawn: true }`
- [ ] 1.3 Função `withdrawConsent(): Promise<Result<WithdrawalResult, AppError>>`
  - [ ] 1.3.1 `auth.getUser()` — se não autenticado: `err({ code: 'unauthorized' })`
  - [ ] 1.3.2 Via service-role: obter `player` com `profile_id = user.id` (campos: `id`, `club_id`)
  - [ ] 1.3.3 Se `!player?.id`: `err({ code: 'not_found', message: 'Sem registo de jogador para este utilizador' })`
  - [ ] 1.3.4 Inserir `audit_logs` com `action='subject.withdrew'`, `actor_id=user.id`, `target_kind='player'`, `target_id=player.id` **(síncrono — antes do cascade)**
  - [ ] 1.3.5 Chamar `callEraseCascade(player.id, user.id)` — função já existente no mesmo ficheiro
  - [ ] 1.3.6 Se cascade falhou: retornar o erro (o audit log de withdrew já foi criado — não reverter)
  - [ ] 1.3.7 Sign out: `await supabase.auth.signOut()` (try/catch com warn — igual a `requestDataErasureForSelf`)
  - [ ] 1.3.8 Retornar `ok({ withdrawn: true })`
- [ ] 1.4 Função `withdrawConsentByToken(token: string): Promise<Result<WithdrawalResult, AppError>>`
  - [ ] 1.4.1 Chamar `validateToken(token)` — função já existente em `data-rights.ts`
  - [ ] 1.4.2 Se token inválido: retornar o erro
  - [ ] 1.4.3 Extrair `playerId` da resposta
  - [ ] 1.4.4 Via service-role: obter `player` com campos `id`, `club_id`, `profile_id`
  - [ ] 1.4.5 Se menor tem `profile_id`: definir `parental_consents.status='withdrawn'` WHERE `player_id = playerId AND status IN ('pending','confirmed')`
  - [ ] 1.4.6 Se menor tem `profile_id`: definir `profiles.consent_status='revoked'` WHERE `id = profile_id` (bloqueia acesso middleware Story 3.2)
  - [ ] 1.4.7 Inserir `audit_logs` com `action='subject.withdrew'`, `actor_id=null` (acção pública/anónima), `target_kind='player'`, `target_id=playerId` **(síncrono — antes do cascade)**
  - [ ] 1.4.8 Chamar `callEraseCascade(playerId, playerId)` — igual a `requestDataErasureByToken`
  - [ ] 1.4.9 Retornar `ok({ withdrawn: true })`

---

### Task 2: Página autenticada `/configuracoes/direitos/retirar` (AC #1, #3, #4, #6)

- [ ] 2.1 Substituir `<PageInDevelopment>` em `sparta/src/app/configuracoes/(subject-rights)/direitos/retirar/page.tsx`
- [ ] 2.2 Server Component: `createServerClient()` → `auth.getUser()`; se não logado: `redirect('/login'); return null`
- [ ] 2.3 Renderizar `<RetirarAuthClient />`
- [ ] 2.4 Criar `sparta/src/app/configuracoes/(subject-rights)/direitos/retirar/_components/retirar-auth-client.tsx`
  - [ ] `'use client'`
  - [ ] Estado: `idle | loading | success | error`
  - [ ] Layout `idle`:
    - Info box com aviso: "Ao retirar o consentimento, os teus dados serão apagados permanentemente. Esta ação é irreversível."
    - Botão "Retirar consentimento" (destructive)
  - [ ] Dialog destructivo (UX-DR33):
    - Título: "Retirar consentimento?"
    - Descrição: "Esta ação é irreversível. Os teus dados serão apagados permanentemente. O teu acesso à plataforma será terminado."
    - Botão "Confirmar retirada" (destructive, `aria-busy={isLoading}`) + "Cancelar" (ghost, disabled durante loading)
  - [ ] `handleWithdraw()`:
    1. Chama `withdrawConsent()` Server Action
    2. Se sucesso: limpa outbox — `await db.outbox.where('status').equals('pending').delete()`
    3. `<CalmConfirmation>` "Consentimento retirado. Os teus dados estão a ser apagados."
    4. `router.push('/login')` após breve delay (1500ms) — a sessão já foi invalidada server-side
  - [ ] `aria-busy` nos botões de submit durante loading
  - [ ] `import { db } from '@/lib/outbox/db'` para limpeza de outbox

---

### Task 3: Página pública `/direitos/[token]/retirar` (AC #2, #3, #4, #6)

- [ ] 3.1 Substituir `<PageInDevelopment>` em `sparta/src/app/(public)/direitos/[token]/retirar/page.tsx`
- [ ] 3.2 Server Component: re-validar token (copiar padrão de `/direitos/[token]/limitar/page.tsx` de Story 3.9)
  ```tsx
  interface Props { params: Promise<{ token: string }> }
  export default async function Page({ params }: Props) {
    const { token } = await params
    // Validação do token via fetch para validate-subject-token Edge Function
    // (igual ao padrão de retificar/page.tsx e limitar/page.tsx)
    ...
    if (!validation.valid) return <EmptyState .../>
    return <RetirarTokenClient token={token} playerName={validation.playerName} />
  }
  ```
- [ ] 3.3 Criar `sparta/src/app/(public)/direitos/[token]/retirar/_components/retirar-token-client.tsx`
  - [ ] Props: `token: string`, `playerName: string`
  - [ ] Mesma lógica que `RetirarAuthClient` mas:
    - Chama `withdrawConsentByToken(token)` Server Action
    - Título: "Retirar consentimento de {playerName}"
    - Após sucesso: `<CalmConfirmation>` "Consentimento retirado. Os dados de {playerName} estão a ser apagados."
    - Sem redirect (não há sessão a terminar)
    - Outbox: também limpar `await db.outbox.where('status').equals('pending').delete()` (caso o Encarregado use este dispositivo para o menor)

---

### Task 4: Testes (AC #1–#6)

- [ ] 4.1 `sparta/src/__tests__/lib/actions/data-rights.test.ts` — adicionar 5 testes:
  - [ ] `withdrawConsent` sucesso → `withdrawn: true` + audit log `subject.withdrew` inserido + cascade chamado
  - [ ] `withdrawConsent` não autenticado → `err unauthorized`
  - [ ] `withdrawConsent` sem player → `err not_found`
  - [ ] `withdrawConsentByToken` token válido → `withdrawn: true` + parental_consent status + audit log
  - [ ] `withdrawConsentByToken` token inválido → `err unauthorized`
- [ ] 4.2 `sparta/src/__tests__/app/configuracoes/direitos/retirar/page.test.tsx` — 3 testes:
  - [ ] Renderiza botão "Retirar consentimento" quando autenticado
  - [ ] Redirect para `/login` quando não autenticado
  - [ ] Mostra aviso de irreversibilidade no layout inicial
- [ ] 4.3 `sparta/src/__tests__/app/public/direitos/token/retirar/page.test.tsx` — 2 testes:
  - [ ] Token válido → mostra formulário com nome do menor
  - [ ] Token inválido/expirado → `<EmptyState>`
- [ ] 4.4 **Total: ≥10 novos testes**

---

### Task 5: Verificação final

- [ ] 5.1 `npm run lint` — zero erros novos
- [ ] 5.2 `npm run typecheck` — zero erros
- [ ] 5.3 `npm run test --run` — todos os testes passando, ≥10 novos
- [ ] 5.4 `npm run build` — build sucesso

---

## Dev Notes

### CRÍTICO: Sem nova migração necessária

Esta story **não requer migração SQL**. Toda a infra de schema já existe:
- `parental_consents.status CHECK ('pending','confirmed','withdrawn','expired')` — `'withdrawn'` já é valor válido
- `profiles.consent_status CHECK ('not_required','pending','granted','revoked')` — `'revoked'` já é valor válido
- `fn_erase_subject_cascade` já apaga `parental_consents` como parte do cascade
- Tabelas `audit_logs` já suportam `action` livre

Próxima migração disponível seria `000196` ou `000200` (reservar para Story 3.11).

---

### CRÍTICO: `callEraseCascade` está no mesmo ficheiro — reutilizar

A função `callEraseCascade(playerId, actorId)` em `data-rights.ts` é uma função privada (não exportada). As novas funções `withdrawConsent` e `withdrawConsentByToken` devem chamá-la directamente, pois estão no mesmo ficheiro.

```ts
// ✅ Já existe em data-rights.ts — chamar directamente
const cascadeResult = await callEraseCascade(playerId, actorId)
if (!cascadeResult.ok) {
  // O audit log 'subject.withdrew' já foi inserido — não reverter
  return err(cascadeResult.error)
}
```

---

### CRÍTICO: Ordem das operações (sequência compliance)

**Para `withdrawConsent()` (adulto):**
1. `auth.getUser()` — verificar autenticação
2. Obter `player.id` e `player.club_id` via service-role
3. **INSERT `audit_logs` `action='subject.withdrew'`** ← síncrono, ANTES do cascade
4. `callEraseCascade(player.id, user.id)` ← apaga tudo + cria `subject.erased` log
5. `supabase.auth.signOut()` ← com try/catch

**Para `withdrawConsentByToken()` (Encarregado):**
1. `validateToken(token)` → `playerId`
2. Obter `player.id`, `player.club_id`, `player.profile_id` via service-role
3. Se `profile_id` existe: UPDATE `parental_consents.status='withdrawn'`
4. Se `profile_id` existe: UPDATE `profiles.consent_status='revoked'`
5. **INSERT `audit_logs` `action='subject.withdrew'`** ← síncrono, ANTES do cascade
6. `callEraseCascade(playerId, playerId)` ← apaga tudo

A razão: o audit log `subject.withdrew` precisa de ser escrito como evidência antes do apagamento que o vai anonimizar.

---

### CRÍTICO: `audit_logs` — `actor_id` null no fluxo token

Para o fluxo público via token, o Encarregado não tem `auth.uid()`. O `actor_id` deve ser `null`:

```ts
await serviceRole.from('audit_logs').insert({
  id: crypto.randomUUID(),
  club_id: player.club_id,
  actor_id: null,              // acção pública/anónima
  action: 'subject.withdrew',
  target_kind: 'player',
  target_id: playerId,
  payload: { withdrawn_at: new Date().toISOString(), via: 'token' },
  created_at: new Date().toISOString(),
})
```

Para o fluxo autenticado, `actor_id = user.id` (o próprio titular).

---

### CRÍTICO: Limpeza do outbox é client-side

A Dexie database (`@/lib/outbox/db`) reside no IndexedDB do browser. O server não pode limpá-la. O Client Component deve importar `db` e limpar após confirmar sucesso:

```ts
// Em retirar-auth-client.tsx (Client Component)
import { db } from '@/lib/outbox/db'

async function handleWithdraw() {
  setIsLoading(true)
  const result = await withdrawConsent()
  
  if (result.ok) {
    // Limpar mutações pendentes ANTES do redirect
    try {
      await db.outbox.where('status').equals('pending').delete()
    } catch {
      // não bloquear o fluxo se a limpeza falhar
    }
    setState('success')
    // Pequeno delay para o utilizador ver o CalmConfirmation
    setTimeout(() => router.push('/login'), 1500)
  } else {
    setError(result.error.message)
    setState('error')
  }
  setIsLoading(false)
}
```

Nota: Dexie só funciona no browser — nunca importar `db` em Server Components.

---

### CRÍTICO: SignOut server-side + redirect client-side

A Server Action `withdrawConsent()` chama `supabase.auth.signOut()` server-side. Após o `ok({ withdrawn: true })` retornar ao client, a sessão já foi invalidada. O Client Component não precisa de chamar signOut de novo — só precisa de redirect para `/login`.

```tsx
// ✅ Client Component — apenas redirect após sucesso
if (result.ok) {
  await clearOutbox()
  setState('success')
  setTimeout(() => router.push('/login'), 1500)
}
```

---

### CRÍTICO: `parental_consents` — apenas um registo activo por jogador

O índice `idx_parental_consents_active_per_player` permite só um registo `pending` ou `confirmed` por jogador. O UPDATE para `withdrawn` não quebra este índice (withdrawn não está no WHERE da constraint).

```sql
-- O índice partial só cobre 'pending' e 'confirmed':
CREATE UNIQUE INDEX idx_parental_consents_active_per_player
  ON public.parental_consents(player_id)
  WHERE status IN ('pending','confirmed');
```

Portanto, o UPDATE de `status='withdrawn'` pode ser feito sem conflito de índice.

---

### CRÍTICO: Menor sem `profile_id` — cenário válido

Um menor pode não ter `profile_id` se ainda não foi convidado para criar conta. Neste caso:
- Não é possível fazer UPDATE a `profiles.consent_status` (não há perfil)
- Mas o `callEraseCascade` ainda funciona — apaga o registo `players` e `parental_consents`

```ts
// ✅ Guard — só actualiza profiles se profile_id existe
if (player.profile_id) {
  await serviceRole
    .from('parental_consents')
    .update({ status: 'withdrawn' })
    .eq('player_id', playerId)
    .in('status', ['pending', 'confirmed'])
  
  await serviceRole
    .from('profiles')
    .update({ consent_status: 'revoked' })
    .eq('id', player.profile_id as string)
}
```

---

### CRÍTICO: Distinção de Story 3.7 (apagamento) vs Story 3.10 (retirada)

| Aspecto | Story 3.7 (Erasure) | Story 3.10 (Withdrawal) |
|---------|---------------------|------------------------|
| Ação inicial | `requestDataErasureForSelf` | `withdrawConsent` |
| Audit log | `subject.erased` (dentro de fn_erase) | `subject.withdrew` + `subject.erased` |
| Parental consent | N/A (adulto) / removido por cascade | Marcado como `withdrawn` ANTES do cascade |
| `consent_status` | Não alterado | Set a `revoked` (se minor com profile) |
| Trigger | Directo pelo utilizador | RGPD Art. 21 — downstream de withdraw |

A UI das duas páginas é visualmente similar (Dialog destructivo, CalmConfirmation). A diferença está na Server Action.

---

### CRÍTICO: `fn_erase_subject_cascade` já cria `subject.erased`

A função PL/pgSQL `fn_erase_subject_cascade` cria automaticamente um `audit_logs` com `action='subject.erased'`. Story 3.10 cria um `action='subject.withdrew'` ANTES de chamar o cascade. O resultado são dois audit logs:
1. `subject.withdrew` — evidência da retirada de consentimento
2. `subject.erased` — evidência do apagamento técnico

Ambos ficam com `target_id=null` após anonimização (este comportamento já existe no cascade — vide linha 55 de 000185).

---

### CRÍTICO: Comparação com `processConsentDecision` (consent.ts)

A função `processConsentDecision(token, 'withdraw', ip)` em `consent.ts` é chamada do **formulário de consentimento parental** (`/consentimento/[token]`). Ela apenas marca o status como `withdrawn` — NÃO aciona erasure. Esta é uma distinção intencional: o Encarregado pode retirar o consentimento no momento inicial sem apagar dados (o jogador ainda não tem dados).

A Story 3.10 é diferente: é o exercício do direito RGPD Art. 21 pelo titular (ou Encarregado) já com dados existentes, que acarreta erasure automático.

**Não modificar `processConsentDecision` nesta story.**

---

### CRÍTICO: `noUncheckedIndexedAccess` (NFR55)

```ts
// ✅ Correcto
const player = data?.players?.[0] ?? null

// ❌ Erro de typecheck
const player = data.players[0]
```

---

### CRÍTICO: AGENTS.md — Regras do projecto

1. **Path aliases `@/*`** resolvem para `src/` — usar SEMPRE em imports
2. **React 19 automatic JSX** — NÃO importar React em ficheiros `.tsx`
3. **Testes correm a partir de `sparta/`**: `npm run test --run`
4. **Next.js breaking changes** — `params` é Promise no App Router

```ts
// ✅ Correcto (React 19 + path alias)
import { Button } from '@/components/ui/button'
export function RetirarAuthClient() { return <div>...</div> }

// ❌ Errado
import React from 'react'
import { Button } from '../../../components/ui/button'
```

---

### UX: Layout da página autenticada

```tsx
// Estado idle (sem retirada activa)
<div>
  <InfoBox variant="signal/warning">
    Ao retirar o consentimento, os teus dados serão apagados permanentemente.
    Esta ação é irreversível e terminará o teu acesso à plataforma.
  </InfoBox>
  <Button variant="destructive" onClick={() => setIsDialogOpen(true)}>
    Retirar consentimento
  </Button>
</div>
```

---

### UX: Dialog destructivo (UX-DR33)

```tsx
<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Retirar consentimento?</DialogTitle>
      <DialogDescription>
        Esta ação é irreversível. Os teus dados serão apagados permanentemente
        e o teu acesso à plataforma será terminado.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
        Cancelar
      </Button>
      <Button
        variant="destructive"
        onClick={handleWithdraw}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'A processar...' : 'Confirmar retirada'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### UX: CalmConfirmation após sucesso

```tsx
// Adulto autenticado
<CalmConfirmation onDismiss={() => router.push('/login')}>
  Consentimento retirado. Os teus dados estão a ser apagados.
</CalmConfirmation>

// Encarregado via token
<CalmConfirmation>
  Consentimento de {playerName} retirado. Os dados estão a ser apagados.
</CalmConfirmation>
```

---

### Estrutura de Ficheiros

```
sparta/
└── src/
    ├── lib/
    │   └── actions/
    │       └── data-rights.ts (+ withdrawConsent, withdrawConsentByToken)
    ├── app/
    │   ├── configuracoes/
    │   │   └── (subject-rights)/direitos/retirar/
    │   │       ├── page.tsx (substituir PageInDevelopment)
    │   │       └── _components/
    │   │           └── retirar-auth-client.tsx  [NOVO]
    │   └── (public)/direitos/[token]/retirar/
    │       ├── page.tsx (substituir PageInDevelopment)
    │       └── _components/
    │           └── retirar-token-client.tsx  [NOVO]
    └── __tests__/
        ├── lib/actions/data-rights.test.ts (+ 5 testes)
        ├── app/configuracoes/direitos/retirar/
        │   └── page.test.tsx  [NOVO]
        └── app/public/direitos/token/retirar/
            └── page.test.tsx  [NOVO]
```

**Sem migração SQL** — toda a infra de schema já existe.

---

### NFRs Relevantes

- **NFR29:** Retirada de consentimento processada de forma imediata
- **NFR52:** Outbox — mutações offline pendentes descartadas após retirada
- **NFR54:** Cobertura de testes ≥80% em funções críticas
- **NFR55:** `noUncheckedIndexedAccess` — todos os acessos por índice devem ser guardados
- **AR13:** Service-role bypassa RLS — usar apenas em Server Actions
- **AR20:** Outbox — gestão de mutações offline
- **FR8:** Encarregado pode retirar consentimento do menor (via token)
- **FR9:** Titular adulto pode retirar o seu próprio consentimento (autenticado)

---

### Context from Previous Stories

**Story 3.7 (erasure)** estabeleceu:
- `callEraseCascade(playerId, actorId)` — função privada no mesmo ficheiro
- `requestDataErasureForSelf` como modelo para `withdrawConsent` (mesma estrutura + audit log adicional)
- `requestDataErasureByToken` como modelo para `withdrawConsentByToken`
- signOut pattern: `try { await supabase.auth.signOut() } catch (e) { console.warn(...) }`

**Story 3.8 (rectification)** e **Story 3.9 (restriction)** estabeleceram padrões para:
- `validateToken()` — reutilizar directamente
- Página token: `await params`, fetch validate-subject-token, `<EmptyState>` se inválido
- `<CalmConfirmation>` + `onDismiss` callback
- audit log com `actor_id=null` para fluxo token

**Story 3.5 (subject rights hub)** criou as páginas como `PageInDevelopment`:
- `/configuracoes/(subject-rights)/direitos/retirar/page.tsx`
- `/(public)/direitos/[token]/retirar/page.tsx`

---

## File List

### Novos Ficheiros
- `sparta/src/app/configuracoes/(subject-rights)/direitos/retirar/_components/retirar-auth-client.tsx`
- `sparta/src/app/(public)/direitos/[token]/retirar/_components/retirar-token-client.tsx`
- `sparta/src/__tests__/app/configuracoes/direitos/retirar/page.test.tsx`
- `sparta/src/__tests__/app/public/direitos/token/retirar/page.test.tsx`

### Ficheiros Modificados
- `sparta/src/lib/actions/data-rights.ts` (+ withdrawConsent, withdrawConsentByToken)
- `sparta/src/app/configuracoes/(subject-rights)/direitos/retirar/page.tsx` (substituir PageInDevelopment)
- `sparta/src/app/(public)/direitos/[token]/retirar/page.tsx` (substituir PageInDevelopment)
- `sparta/src/__tests__/lib/actions/data-rights.test.ts` (+ 5 testes)

---

## Change Log

- 2026-05-22: Story 3.10 criada — Direito de Retirada de Consentimento; sem migração SQL; Server Actions withdrawConsent + withdrawConsentByToken; páginas /retirar (auth + token); limpeza de outbox Dexie client-side; ≥10 testes novos

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### Acceptance Criteria Mapping

| AC # | Tasks | Testes |
|------|-------|--------|
| AC #1 | Task 1.3, 2 | 4.1 (withdrawConsent), 4.2 (auth page) |
| AC #2 | Task 1.4, 3 | 4.1 (withdrawConsentByToken), 4.3 (token page) |
| AC #3 | Task 2.4, 3.3 | 4.2 (Dialog), 4.3 (Dialog token) |
| AC #4 | Task 2.4, 3.3 | (client-side — não testável server) |
| AC #5 | Task 1.3.4, 1.4.7 | 4.1 (audit log before cascade) |
| AC #6 | Task 2.4, 3.3 | axe-core inline nos testes |

---

## Architecture Alignment

- **AR13:** service-role client em Server Actions para bypass RLS ✅
- **NFR29:** Efeito imediato — audit log + cascade síncrono em Server Action ✅
- **FR8/FR9:** withdrawConsent (adulto) + withdrawConsentByToken (Encarregado) ✅
- **UX-DR33:** Dialog destructivo para confirmação ✅
- **UX-DR8:** `<EmptyState>` para token inválido ✅
- **UX-DR11:** `<CalmConfirmation>` para feedback de sucesso ✅
- **NFR52/AR20:** Limpeza do outbox Dexie client-side ✅

---

## Story Completion Status

**Ready for dev: YES**

Todos os acceptance criteria definidos, tasks detalhadas, padrões de stories anteriores integrados, arquitectura alinhada, testes especificados. **Sem nova migração necessária** — toda a infra de schema já existe nas migrações anteriores.

**Próximo passo:** `/bmad-dev-story 3-10-right-to-withdraw-consent-immediate-effect.md`
