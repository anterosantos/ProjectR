# Story 3.9: Direito de Limitação do Tratamento — Estado de Congelamento

**Status:** ready-for-dev

**Story ID:** 3.9
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR
**Criado:** 2026-05-22
**Story anterior:** 3-8-right-to-rectification-staff-mediated-with-audit-log

---

## User Story

Como um titular adulto (ou Encarregado de Educação),
Quero marcar a minha conta como "tratamento limitado" para o sistema parar de recolher e processar os meus dados sem apagar o histórico,
Para que possa pausar a atividade do sistema sobre mim sem perder registos passados (RGPD Art. 18).

---

## Acceptance Criteria

### AC #1: Migração — colunas em `profiles` e `players`

**Given** migração `000195_processing_restrictions.sql`
**When** aplicada
**Then** `profiles` tem `processing_restricted boolean NOT NULL DEFAULT false` e `restricted_at timestamptz`
**And** `players` tem `processing_restricted boolean NOT NULL DEFAULT false` e `restricted_at timestamptz` (para jogadores sem perfil direto — menores geridos pelo Encarregado via token)
**And** RLS permite que o próprio sujeito ou service-role actualize estas colunas (FR49)

---

### AC #2: Activar limitação — página autenticada `/configuracoes/direitos/limitar`

**Given** um titular autenticado na página `/configuracoes/direitos/limitar`
**When** a página carrega
**Then** o estado actual de limitação é lido (`processing_restricted` de `profiles`)
**And** se `false`: mostra explicação + botão "Limitar o meu tratamento" (destructive)
**And** se `true`: mostra estado activo + data de activação + botão "Remover limitação" (ghost)

---

### AC #3: Confirmação via Dialog destructivo

**Given** o titular clica "Limitar o meu tratamento"
**When** o `<Dialog>` destructivo (UX-DR33) abre
**Then** o utilizador confirma via botão "Confirmar limitação"
**When** confirmado
**Then** Server Action `restrictProcessing()` é chamada
**And** `profiles.processing_restricted=true`, `restricted_at=now()` são escritos
**And** entrada `audit_logs` com `action='subject.restricted'` é criada
**And** `<CalmConfirmation>` "Tratamento limitado a partir de agora. O histórico foi preservado." é mostrado
**And** a alteração tem efeito imediato (NFR29)

---

### AC #4: Desactivar limitação

**Given** o titular clica "Remover limitação"
**When** confirmado via Dialog
**Then** Server Action `unrestrictProcessing()` é chamada
**And** `processing_restricted=false`, `restricted_at=null` são escritos
**And** entrada `audit_logs` com `action='subject.unrestricted'` é criada
**And** `<CalmConfirmation>` "Limitação removida. Os teus dados voltam a ser processados normalmente." é mostrado

---

### AC #5: Limitação via token público `/direitos/[token]/limitar`

**Given** um Encarregado acede a `/direitos/[token]/limitar` com token válido
**When** a página carrega
**Then** o estado actual de limitação do menor é lido (`players.processing_restricted`)
**And** o mesmo fluxo de activar/desactivar está disponível via Server Actions `restrictProcessingByToken` / `unrestrictProcessingByToken`

**Given** token inválido ou expirado
**Then** `<EmptyState>` é mostrado (padrão de Story 3.7/3.8)

---

### AC #6: Enforcement — escritas rejeitadas quando restrito

**Given** um jogador tem `processing_restricted=true`
**When** qualquer Server Action tenta escrever novos dados de saúde (fatigue submission, events, etc.)
**Then** a operação é rejeitada com `err({ code: 'processing_restricted', message: 'Tratamento limitado — não podemos registar novos dados' })`
**And** leituras de dados históricos continuam a funcionar normalmente

---

### AC #7: Acessibilidade

**Given** as páginas de limitação renderizam
**When** testadas com axe-core
**Then** zero violações a11y
**And** botões de confirmação têm `aria-busy` durante loading
**And** o `<Dialog>` tem focus trap e ESC fecha (UX-DR33)

---

## Tasks / Subtasks

### Task 1: Migração `000195_processing_restrictions.sql` (AC #1)

- [ ] 1.1 Criar `sparta/supabase/migrations/000195_processing_restrictions.sql`
- [ ] 1.2 Adicionar colunas à tabela `profiles`:
  ```sql
  ALTER TABLE profiles
    ADD COLUMN processing_restricted boolean NOT NULL DEFAULT false,
    ADD COLUMN restricted_at timestamptz;

  CREATE INDEX idx_profiles_processing_restricted ON profiles(processing_restricted)
    WHERE processing_restricted = true;
  ```
- [ ] 1.3 Adicionar colunas à tabela `players`:
  ```sql
  ALTER TABLE players
    ADD COLUMN processing_restricted boolean NOT NULL DEFAULT false,
    ADD COLUMN restricted_at timestamptz;

  CREATE INDEX idx_players_processing_restricted ON players(processing_restricted)
    WHERE processing_restricted = true;
  ```
- [ ] 1.4 RLS — policy para `profiles`: o próprio utilizador pode fazer UPDATE de `processing_restricted` e `restricted_at` onde `id = auth.uid()`
  ```sql
  CREATE POLICY "self_update_restriction" ON profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
  ```
  (policy adicional à policy `self update` existente se necessário — verificar se já cobre UPDATE destas colunas)
- [ ] 1.5 RLS — policy para `players`: service_role pode UPDATE (o titular não tem acesso directo a `players`, usa Server Actions)
- [ ] 1.6 GRANTs: `GRANT SELECT, UPDATE (processing_restricted, restricted_at) ON profiles TO authenticated; GRANT ALL ON players TO service_role;`

---

### Task 2: Server Actions em `data-rights.ts` (AC #3, #4, #5, #6)

- [ ] 2.1 Adicionar a `sparta/src/lib/actions/data-rights.ts`
- [ ] 2.2 Tipo `RestrictionResult = { restricted: boolean }`
- [ ] 2.3 Função `getRestrictionStatus(): Promise<Result<{ restricted: boolean; restrictedAt: string | null }, AppError>>`
  - [ ] 2.3.1 `auth.getUser()` — se não autenticado: `err({ code: 'unauthorized' })`
  - [ ] 2.3.2 Query `profiles` com `id = user.id` — retornar `processing_restricted`, `restricted_at`
- [ ] 2.4 Função `restrictProcessing(): Promise<Result<RestrictionResult, AppError>>`
  - [ ] 2.4.1 `auth.getUser()` — se não autenticado: `err({ code: 'unauthorized' })`
  - [ ] 2.4.2 Usar service-role: `UPDATE profiles SET processing_restricted=true, restricted_at=now() WHERE id=user.id`
  - [ ] 2.4.3 Inserir `audit_logs`: `action='subject.restricted'`, `target_kind='profile'`, `target_id=user.id`
  - [ ] 2.4.4 Retornar `ok({ restricted: true })`
- [ ] 2.5 Função `unrestrictProcessing(): Promise<Result<RestrictionResult, AppError>>`
  - [ ] 2.5.1 `auth.getUser()` — se não autenticado: `err({ code: 'unauthorized' })`
  - [ ] 2.5.2 Usar service-role: `UPDATE profiles SET processing_restricted=false, restricted_at=null WHERE id=user.id`
  - [ ] 2.5.3 Inserir `audit_logs`: `action='subject.unrestricted'`, `target_kind='profile'`, `target_id=user.id`
  - [ ] 2.5.4 Retornar `ok({ restricted: false })`
- [ ] 2.6 Função `restrictProcessingByToken(token: string): Promise<Result<RestrictionResult, AppError>>`
  - [ ] 2.6.1 Validar token via `validateToken(token)` (função existente em `data-rights.ts`)
  - [ ] 2.6.2 Extrair `playerId` da resposta
  - [ ] 2.6.3 Usar service-role: `UPDATE players SET processing_restricted=true, restricted_at=now() WHERE id=playerId`
  - [ ] 2.6.4 Inserir `audit_logs`: `action='subject.restricted'`, `target_kind='player'`, `target_id=playerId`
  - [ ] 2.6.5 Retornar `ok({ restricted: true })`
- [ ] 2.7 Função `unrestrictProcessingByToken(token: string): Promise<Result<RestrictionResult, AppError>>`
  - [ ] Similar a 2.6 mas set `false, null`; `action='subject.unrestricted'`
- [ ] 2.8 Helper exportado `checkProcessingRestricted(playerId: string): Promise<boolean>` via service-role — para enforcement em outras Server Actions (AC #6)
  - [ ] Query `players.processing_restricted WHERE id = playerId`
  - [ ] Retornar `boolean` (não Result — é um guard interno)

---

### Task 3: Página autenticada `/configuracoes/direitos/limitar` (AC #2, #3, #4, #7)

- [ ] 3.1 Substituir `<PageInDevelopment>` em `sparta/src/app/configuracoes/(subject-rights)/direitos/limitar/page.tsx`
- [ ] 3.2 Server Component: `createServerClient()` → `auth.getUser()`; se não logado: `redirect('/login')`
- [ ] 3.3 Chamar `getRestrictionStatus()` no Server Component para passar estado inicial ao Client Component (evita flash)
- [ ] 3.4 Renderizar Client Component `<LimitarAuthClient initialRestricted={restricted} initialRestrictedAt={restrictedAt} />`
- [ ] 3.5 Criar `sparta/src/app/configuracoes/(subject-rights)/direitos/limitar/_components/limitar-auth-client.tsx`
  - [ ] `'use client'` — props: `initialRestricted: boolean`, `initialRestrictedAt: string | null`
  - [ ] Estado: `idle | loading | success-on | success-off | error`
  - [ ] Layout quando `restricted=false`:
    - Info box explicativo: "Ao limitar o tratamento, o SPARTA deixa de recolher novos dados teus. O histórico existente é mantido."
    - Botão "Limitar o meu tratamento" (destructive)
  - [ ] Layout quando `restricted=true`:
    - Info box `signal/info`: "Tratamento limitado desde {date}. Não estão a ser recolhidos novos dados."
    - Botão "Remover limitação" (ghost)
  - [ ] Dialog destructivo para activar (UX-DR33): título "Limitar tratamento?", descrição, botão "Confirmar limitação" (destructive) + "Cancelar" (ghost)
  - [ ] Dialog para desactivar: "Remover limitação?", botão "Confirmar" (primary) + "Cancelar"
  - [ ] Após sucesso: `<CalmConfirmation>` com mensagem apropriada
  - [ ] `aria-busy` nos botões de submit durante loading (AC #7)

---

### Task 4: Página pública `/direitos/[token]/limitar` (AC #5, #7)

- [ ] 4.1 Substituir `<PageInDevelopment>` em `sparta/src/app/(public)/direitos/[token]/limitar/page.tsx`
- [ ] 4.2 Server Component: re-validar token (copiar padrão de `/direitos/[token]/retificar/page.tsx` de Story 3.8)
  ```tsx
  // Padrão: await params, validateToken local, EmptyState se inválido
  const { token } = await params
  const validation = await validateToken(token)
  if (!validation.valid) return <EmptyState .../>
  ```
- [ ] 4.3 Obter estado actual do menor: query `players.processing_restricted WHERE id = validation.playerId` via service-role
- [ ] 4.4 Renderizar `<LimitarTokenClient token={token} playerName={validation.playerName} initialRestricted={restricted} />`
- [ ] 4.5 Criar `sparta/src/app/(public)/direitos/[token]/limitar/_components/limitar-token-client.tsx`
  - [ ] Props: `token: string`, `playerName: string`, `initialRestricted: boolean`
  - [ ] Mesma lógica que `LimitarAuthClient` mas chama `restrictProcessingByToken(token)` / `unrestrictProcessingByToken(token)`
  - [ ] Título: "Limitar tratamento de {playerName}"

---

### Task 5: Testes (AC #1–#7)

- [ ] 5.1 `sparta/src/__tests__/lib/actions/data-rights.test.ts` — adicionar 5 testes:
  - [ ] `restrictProcessing` sucesso → `restricted: true` + audit log inserido
  - [ ] `unrestrictProcessing` sucesso → `restricted: false` + audit log inserido
  - [ ] `restrictProcessing` não autenticado → `err unauthorized`
  - [ ] `restrictProcessingByToken` token válido → `restricted: true`
  - [ ] `checkProcessingRestricted` retorna boolean correcto
- [ ] 5.2 `sparta/src/__tests__/app/configuracoes/direitos/limitar/page.test.tsx` — 3 testes:
  - [ ] Renderiza botão "Limitar" quando `restricted=false`
  - [ ] Renderiza estado activo quando `restricted=true`
  - [ ] Redirect para `/login` quando não autenticado
- [ ] 5.3 `sparta/src/__tests__/app/public/direitos/token/limitar/page.test.tsx` — 2 testes:
  - [ ] Token válido → mostra estado de limitação
  - [ ] Token inválido → `<EmptyState>`
- [ ] 5.4 **Total: ≥10 novos testes**

---

### Task 6: Verificação final

- [ ] 6.1 `npm run lint` — zero erros novos
- [ ] 6.2 `npm run typecheck` — zero erros
- [ ] 6.3 `npm run test --run` — todos os testes passando, ≥10 novos
- [ ] 6.4 `npm run build` — build sucesso

---

## Dev Notes

### CRÍTICO: Número da migração

A última migração existente é `000185_erase_cascade_audit_safety.sql`. A Story 3.8 usa `000190_rectification_requests.sql`. A migração da Story 3.9 deve ser **`000195_processing_restrictions.sql`**.

O epics menciona `000190_processing_restrictions.sql`, mas esse número já está ocupado pela Story 3.8. Usar **000195**.

---

### CRÍTICO: Duas tabelas precisam de ser actualizadas

O estado de "tratamento limitado" precisa de ser armazenado em **dois lugares**:

| Sujeito | Tabela | Coluna |
|---------|--------|--------|
| Titular adulto (autenticado) | `profiles` | `processing_restricted`, `restricted_at` |
| Menor (gerido por Encarregado via token) | `players` | `processing_restricted`, `restricted_at` |

Não existe uma coluna em `players` ligada ao `profiles` do Encarregado — o Encarregado age directamente sobre o registo `players` do menor via token público.

---

### CRÍTICO: `validateToken` já existe — reutilizar

A função `validateToken` é exportada de `data-rights.ts` (introduzida em Story 3.5). **Não recriar.** As funções `restrictProcessingByToken` e `unrestrictProcessingByToken` devem chamá-la directamente.

```ts
// ✅ Reutilizar — já existe em data-rights.ts
const validation = await validateToken(token)
if (!validation.valid) return err({ code: 'unauthorized', message: 'Token inválido' })
```

---

### CRÍTICO: `service-role` NÃO pode ser importado em Server Components de páginas

```ts
// ✅ Em Server Component (page.tsx) — só para ler estado inicial
const supabase = await createServerClient()
// ou chamar getRestrictionStatus() Server Action

// ✅ Em Server Action (actions/data-rights.ts)
const serviceRole = getServiceRoleClient()
```

No entanto, para ler o estado inicial do jogador (menor) na página token, o Server Component pode usar service-role **apenas para leitura** (não escrita). Alternativa mais segura: criar `getPlayerRestrictionStatus(token)` Server Action e chamá-la.

---

### CRÍTICO: Enforcement em outras Server Actions (AC #6)

O dev agent deve adicionar verificação de `processing_restricted` nas Server Actions que escrevem dados de saúde. Contudo, **esta story não implementa o enforcement em futuras stories** (Epic 4, 5, 6) — elas ainda não existem. O enforcement em stories futuras é responsabilidade das suas próprias stories.

O que ESTA story deve implementar:
1. A função `checkProcessingRestricted(playerId: string)` helper exportada
2. Documentar no Dev Notes que futuras stories devem chamá-la

```ts
// Padrão de enforcement para stories futuras:
import { checkProcessingRestricted } from '@/lib/actions/data-rights'

// No início de qualquer Server Action que escreva dados de um player:
const isRestricted = await checkProcessingRestricted(playerId)
if (isRestricted) {
  return err({ code: 'processing_restricted', message: 'Tratamento limitado — não podemos registar novos dados' })
}
```

---

### CRÍTICO: Entry point — sem Edge Function nesta story

Esta story **não requer Edge Functions**. Tudo é feito via Server Actions. As acções são simples UPDATE em `profiles`/`players` + INSERT em `audit_logs`.

---

### CRÍTICO: Padrão do Audit Log

Seguir o padrão de `audit_logs` (Story 1.12) com `actor_id` como o próprio utilizador (é uma auto-acção):

```ts
await serviceRole.from('audit_logs').insert({
  id: crypto.randomUUID(),
  club_id: profile.club_id,
  actor_id: user.id,         // o próprio titular é o actor
  action: 'subject.restricted',  // ou 'subject.unrestricted'
  target_kind: 'profile',
  target_id: user.id,
  metadata: {
    restricted_at: new Date().toISOString(),
  },
  created_at: new Date().toISOString(),
})
```

Para o fluxo de token (menor), `actor_id` é o `user.id` do Encarregado — mas neste fluxo não há `auth.uid()` pois é público. Usar `null` para `actor_id` neste caso:

```ts
// Para fluxo token: actor_id = null (acção anónima/pública)
await serviceRole.from('audit_logs').insert({
  ...
  actor_id: null,
  action: 'subject.restricted',
  target_kind: 'player',
  target_id: playerId,
  ...
})
```

---

### CRÍTICO: Estado inicial no Server Component

Para evitar flash de conteúdo (ver/não ver o estado correcto), o Server Component deve ler o estado actual e passá-lo como props ao Client Component:

```tsx
// page.tsx (Server Component)
const restrictionResult = await getRestrictionStatus()
const restricted = restrictionResult.ok ? restrictionResult.data.restricted : false
const restrictedAt = restrictionResult.ok ? restrictionResult.data.restrictedAt : null

return <LimitarAuthClient initialRestricted={restricted} initialRestrictedAt={restrictedAt} />
```

---

### CRÍTICO: Brevo — NÃO é necessário nesta story

Esta story **não envia emails**. A limitação tem efeito imediato e silencioso. Sem notificações ao staff (ao contrário da retificação). Apenas:
- `<CalmConfirmation>` in-app
- Entrada em `audit_logs`

---

### CRÍTICO: `Date.now()` é "impuro" no React ESLint

Usar `new Date()` em Server Components. (Aprendido em Story 3.7/3.8)

```ts
// ✅ Correcto
const now = new Date()

// ❌ Evitar em Server Components
const now = Date.now()
```

---

### CRÍTICO: `redirect()` em testes não lança excepção

Guard o código pós-redirect com condição:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  redirect('/login')
  return null // guard necessário para testes
}
```

---

### CRÍTICO: `params` é uma Promise no Next.js App Router

```tsx
// ✅ Correcto (App Router)
interface Props { params: Promise<{ token: string }> }
export default async function Page({ params }: Props) {
  const { token } = await params
  ...
}
```

---

### CRÍTICO: Verificar policy RLS existente em `profiles`

A migração `000040_profiles_rls.sql` criou:
- `"self update"`: `USING (id = auth.uid()) WITH CHECK (id = auth.uid())`

Esta policy pode já cobrir o UPDATE de `processing_restricted`. Verificar se é necessária policy adicional ou se a existente é suficiente. Se já existe, **não duplicar**.

---

### CRÍTICO: `noUncheckedIndexedAccess` (NFR55)

```ts
// ✅ Correcto
const profile = data?.profiles?.[0] ?? null

// ❌ Erro de typecheck
const profile = data.profiles[0]
```

---

### UX: Padrão visual do Dialog destructivo (UX-DR33)

```tsx
// Activar limitação — Dialog destructivo
<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Limitar tratamento?</DialogTitle>
      <DialogDescription>
        O SPARTA deixa de recolher novos dados teus. O histórico existente é mantido.
        Podes remover esta limitação a qualquer momento.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
        Cancelar
      </Button>
      <Button
        variant="destructive"
        onClick={handleRestrict}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'A processar...' : 'Confirmar limitação'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
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
export function LimitarAuthClient() { return <div>...</div> }

// ❌ Errado
import React from 'react'
import { Button } from '../../../components/ui/button'
```

---

### Estrutura de Ficheiros

```
sparta/
├── supabase/
│   └── migrations/
│       └── 000195_processing_restrictions.sql
└── src/
    ├── lib/
    │   └── actions/
    │       └── data-rights.ts (+ getRestrictionStatus, restrictProcessing, unrestrictProcessing, restrictProcessingByToken, unrestrictProcessingByToken, checkProcessingRestricted)
    ├── app/
    │   ├── configuracoes/
    │   │   └── (subject-rights)/direitos/limitar/
    │   │       ├── page.tsx (substituir PageInDevelopment)
    │   │       └── _components/
    │   │           └── limitar-auth-client.tsx  [NOVO]
    │   └── (public)/direitos/[token]/limitar/
    │       ├── page.tsx (substituir PageInDevelopment)
    │       └── _components/
    │           └── limitar-token-client.tsx  [NOVO]
    └── __tests__/
        ├── lib/actions/data-rights.test.ts (+ 5 testes)
        ├── app/configuracoes/direitos/limitar/
        │   └── page.test.tsx  [NOVO]
        └── app/public/direitos/token/limitar/
            └── page.test.tsx  [NOVO]
```

---

### NFRs Relevantes

- **NFR29:** Retirada/limitação de consentimento processada de forma imediata
- **NFR54:** Cobertura de testes ≥80% em funções críticas
- **NFR55:** `noUncheckedIndexedAccess` — todos os acessos por índice devem ser guardados
- **AR13:** Service-role bypassa RLS — usar apenas em Server Actions
- **FR49:** Titular pode marcar conta como "tratamento limitado" — sistema congela operações sem apagar histórico

---

### Notificações push e email quando restrito (AC referência futura)

A Story 3.9 implementa o estado. As stories futuras devem verificá-lo:

- **Story 4.8** (push notifications): verificar `player.processing_restricted` antes de enviar push (NFR21)
- **Epic 4 Server Actions** (fatigue submission): chamar `checkProcessingRestricted` no início
- **Epic 6 Server Actions** (performance events): chamar `checkProcessingRestricted` no início

---

### Context from Previous Stories

**Story 3.8 (rectification)** estabeleceu padrões para:
- `validateToken()` — função partilhada em `data-rights.ts` (reutilizar directamente)
- `submitRectificationRequestByToken` como modelo para `restrictProcessingByToken`
- Page pattern: Server Component verifica auth/token, delega a Client Component
- `<CalmConfirmation>` + `onDismiss` callback
- audit log `metadata` (jsonb) com valores before/after

**Story 3.7 (erasure)** estabeleceu padrões para:
- Página token: `await params`, `validateToken` local, `<EmptyState>` se inválido
- `router.push()` vs `window.location.href` (usar `router.push()` para flows não-destructivos)
- `actor_id` como `auth.uid()` no audit log

**Story 3.6 (export-csv)** e **Story 1.12 (audit logs)**:
- Schema de `audit_logs`: `actor_id`, `action`, `target_kind`, `target_id`, `metadata` (jsonb)
- Fire-and-forget para logs não-críticos

---

## File List

### Novos Ficheiros
- `sparta/supabase/migrations/000195_processing_restrictions.sql`
- `sparta/src/app/configuracoes/(subject-rights)/direitos/limitar/_components/limitar-auth-client.tsx`
- `sparta/src/app/(public)/direitos/[token]/limitar/_components/limitar-token-client.tsx`
- `sparta/src/__tests__/app/configuracoes/direitos/limitar/page.test.tsx`
- `sparta/src/__tests__/app/public/direitos/token/limitar/page.test.tsx`

### Ficheiros Modificados
- `sparta/src/lib/actions/data-rights.ts` (+ getRestrictionStatus, restrictProcessing, unrestrictProcessing, restrictProcessingByToken, unrestrictProcessingByToken, checkProcessingRestricted)
- `sparta/src/app/configuracoes/(subject-rights)/direitos/limitar/page.tsx` (substituir PageInDevelopment)
- `sparta/src/app/(public)/direitos/[token]/limitar/page.tsx` (substituir PageInDevelopment)
- `sparta/src/__tests__/lib/actions/data-rights.test.ts` (+ 5 testes)

---

## Change Log

- 2026-05-22: Story 3.9 criada — Direito de Limitação do Tratamento; migração 000195, colunas `processing_restricted`/`restricted_at` em `profiles` e `players`, Server Actions (restrictProcessing, unrestrictProcessing, byToken, checkProcessingRestricted), páginas /limitar (auth + token), helper enforcement para stories futuras; ≥10 testes novos

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### Acceptance Criteria Mapping

| AC # | Tasks | Testes |
|------|-------|--------|
| AC #1 | Task 1 | (migration — validação via typecheck/build) |
| AC #2 | Task 3 | 5.2 (auth page) |
| AC #3 | Task 2.4, 3.5 | 5.1 (restrictProcessing), 5.2 (Dialog) |
| AC #4 | Task 2.5, 3.5 | 5.1 (unrestrictProcessing) |
| AC #5 | Task 2.6, 2.7, 4 | 5.1 (byToken), 5.3 (token page) |
| AC #6 | Task 2.8 | 5.1 (checkProcessingRestricted) |
| AC #7 | Task 3.5, 4.5 | axe-core (inline nos testes) |

---

## Architecture Alignment

- **AR13:** service-role client em Server Actions para bypass RLS ✅
- **NFR29:** Efeito imediato — UPDATE síncrono em Server Action ✅
- **FR49:** `processing_restricted` + `restricted_at` em `profiles` e `players` ✅
- **UX-DR33:** Dialog destructivo para confirmação de activação ✅
- **UX-DR8:** `<EmptyState>` para token inválido ✅
- **UX-DR11:** `<CalmConfirmation>` para feedback de sucesso ✅

---

## Story Completion Status

**Ready for dev: YES**

Todos os acceptance criteria definidos, tasks detalhadas, padrões de stories anteriores integrados, arquitectura alinhada, testes especificados. Número de migração corrigido (000195, não 000190 que está ocupado pela Story 3.8).

**Próximo passo:** `/bmad-dev-story 3-9-right-to-restrict-processing-freeze-state.md`
