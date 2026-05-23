# Story 4.2: Fatigue Questionnaire UI — 5 Sliders with Snap, Single View

**Status:** ready-for-dev

**Story ID:** 4.2
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)
**Criado:** 2026-05-23
**Story anterior:** 4-1 (fatigue-response-schema-idempotent-server-action)

---

## User Story

As a Jogador,
I want a single-page questionnaire with 5 sliders (1–5, snap discrete) before and after each session,
So that I can fulfill my contribution to the team's data without complex navigation.

---

## Acceptance Criteria

### AC #1: Route & Page Guard

**Given** the route `/questionario/[sessionId]/[phase]` inside the `(player)` route group
**When** an authenticated player opens the page
**Then** the Server Component validates:
  - `phase` is exactly `'pre'` or `'post'` (redirect to `/hoje` if not)
  - `sessionId` is a valid UUID (redirect to `/hoje` if not)
  - Session exists and belongs to the player's club and is `status='scheduled'` (redirect to `/hoje` if not)
**And** the page renders the `<FatigueQuestionnaire>` Client Component with `session`, `player`, and `phase` props

---

### AC #2: Single-View Questionnaire — 5 Sliders (UX-DR16, UX-DR17, UX-DR47)

**Given** the questionnaire page renders for a player
**When** the page loads
**Then** all 5 `<FatigueSlider>` components are shown stacked in a single view (no pagination, no wizard)
**And** each slider shows its dimension title and the two extreme labels in PT-PT:
  - `dim_energy`: "Energia muscular" — ("Esgotado | Pleno")
  - `dim_focus`: "Concentração" — ("Disperso | Concentrado")
  - `dim_sleep`: "Sono" — ("Mau | Excelente sono")
  - `dim_soreness`: "Desconforto físico" — ("Muito dor | Sem dor")
  - `dim_mood`: "Estado emocional" — ("Mau | Bom estado")
**And** sliders snap to integer positions 1/2/3/4/5 only — no continuous values (native `<input type="range" step={1}>`)
**And** tapping anywhere on the track immediately sets the position to the nearest integer

---

### AC #3: IndexedDB Autosave + Restore (UX-DR16)

**Given** the player changes any slider value
**When** the value changes
**Then** the partial state is debounced 800ms and persisted in `db.cache` (existing Dexie store, Story 1.11):
  - Key: `draft:questionnaire:${sessionId}:${phase}:${playerId}`
  - Payload: `{ id: string, dim_energy?, dim_focus?, dim_sleep?, dim_soreness?, dim_mood?, srpe_value? }`
  - The `id` field is the UUIDv7 for this submission attempt (stored with the draft)

**Given** the player closes and reopens the questionnaire page
**When** the component mounts
**Then** partial answers are restored from `db.cache` using the draft key
**And** if a draft exists, the restored `id` field is used (same UUIDv7 for idempotent resubmission)
**And** if no draft exists, a fresh `newId()` is generated

---

### AC #4: Submit Button & Submission Flow (UX-DR30)

**Given** a primary "Submeter" button at the bottom of the page
**When** fewer than all 5 dimensions are set
**Then** the button is disabled (`disabled` attribute + visual opacity)

**When** all 5 are set and the button is tapped
**Then** `submitFatigueResponse(payload)` is called (Story 4.1) with:
  - `id`: the draft's UUIDv7 (or freshly generated)
  - All 5 dimension values
  - `phase`, `player_id`, `session_id`
  - `submitted_via: 'online'`
  - `srpe_value`: as captured (or `null` if not set)
**And** on success: `db.cache.delete(draftKey)` clears the draft
**And** `<CalmConfirmation message="Registado, bom treino" />` is displayed (UX-DR11)
**And** after `<CalmConfirmation>` dismisses (`onDismiss`), the player is redirected to `/hoje`

---

### AC #5: Session-RPE for Post Phase

**Given** `phase === 'post'`
**When** the page renders
**Then** a 6th `<FatigueSlider>` for Session-RPE appears below the 5 dimensions:
  - Label: "Esforço percebido da sessão (sRPE)"
  - Scale: 1–10 (not 1–5)
  - Extremes: "Muito fácil | Máximo esforço"
  - Optional — does NOT block submission if unset
**And** if unset, `srpe_value` is `null` in the payload

---

### AC #6: Keyboard Navigation & Accessibility (NFR38, UX-DR17, UX-DR40)

**Given** a `<FatigueSlider>` component receives focus
**When** the user uses the keyboard
**Then** Left/Right (or Down/Up) arrow keys decrement/increment the value by 1 (native range input behavior)
**And** `aria-valuetext` reads `"${value} de ${max} — ${dimensionLabel}"` (e.g., `"3 de 5 — médio"`)
**And** all sliders have `aria-label` equal to the dimension title (e.g., "Energia muscular")
**And** the submit button has minimum touch target 44×44px (NFR40)
**And** page has `<h1>` "Questionário — [session type] [date]" (no hierarchy skips, UX-DR39)

---

### AC #7: Accessibility Tests (NFR37, UX-DR42)

**Given** tests run with `vitest-axe`
**When** `<FatigueQuestionnaire>` and `<FatigueSlider>` are rendered
**Then** zero axe-core violations are reported

---

## Tasks / Subtasks

### Task 1: Create `<FatigueSlider>` Component (AC #2, #5, #6)

- [x] 1.1 Create `sparta/src/components/ui/fatigue-slider.tsx`
  ```tsx
  'use client'
  // Interface:
  interface FatigueSliderProps {
    id: string                     // HTML id for label association
    label: string                  // e.g. "Energia muscular"
    minLabel: string               // e.g. "Esgotado"
    maxLabel: string               // e.g. "Pleno"
    min?: number                   // default 1
    max?: number                   // default 5
    value: number | null           // null = unset
    onChange: (value: number) => void
    disabled?: boolean
  }
  ```
- [x] 1.2 Render as native `<input type="range">`:
  - `min={min}`, `max={max}`, `step={1}` — enforces integer snapping natively
  - `value={value ?? ''}` — empty when unset
  - `aria-label={label}`
  - `aria-valuemin={min}`, `aria-valuemax={max}`, `aria-valuenow={value ?? undefined}`
  - `aria-valuetext={value ? `${value} de ${max} — ${getValueLabel(value, max)}` : 'Não definido'}`
  - `onChange`: parse `parseInt(e.target.value)` and call `props.onChange`
- [x] 1.3 Helper `getValueLabel(value: number, max: number): string`:
  - For 1–5 scale: `{ 1: 'mínimo', 2: 'baixo', 3: 'médio', 4: 'alto', 5: 'máximo' }`
  - For 1–10 scale: `{ 1–2: 'muito fácil', 3–4: 'fácil', 5–6: 'moderado', 7–8: 'difícil', 9–10: 'máximo' }`
- [x] 1.4 Visual layout: label row top-left, min/max labels at extremes, track full-width
  - Use Tailwind: `w-full`, accent colour for filled portion (via CSS custom property or `accent-color`)
  - Touch target: track height ≥44px container height (NFR40)
  - `motion-reduce:transition-none` on thumb animation (UX-DR3)
- [x] 1.5 Create test file `sparta/src/__tests__/components/ui/fatigue-slider.test.tsx`
  - Renders with correct aria attributes
  - onChange fires with correct integer value
  - axe-core zero violations (vitest-axe)

---

### Task 2: Create `<FatigueQuestionnaire>` Client Component (AC #2, #3, #4, #5)

- [x] 2.1 Create `sparta/src/components/ui/fatigue-questionnaire.tsx` with `'use client'`
- [x] 2.2 Props interface:
  ```tsx
  interface FatigueQuestionnaireProps {
    sessionId: string
    sessionType: 'training' | 'match' | 'friendly'
    sessionDate: string          // ISO string — display formatted
    phase: 'pre' | 'post'
    playerId: string
  }
  ```
- [x] 2.3 State:
  ```tsx
  const [values, setValues] = useState<DraftValues>({
    id: '',                    // filled on mount
    dim_energy: null,
    dim_focus: null,
    dim_sleep: null,
    dim_soreness: null,
    dim_mood: null,
    srpe_value: null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  ```
- [x] 2.4 Draft key: `const draftKey = \`draft:questionnaire:${sessionId}:${phase}:${playerId}\``
- [x] 2.5 Mount effect — restore from IndexedDB (com cancelled guard para cleanup)
- [x] 2.6 Autosave effect — debounce 800ms on `values` change (guarda apenas quando `values.id` está definido)
- [x] 2.7 Submit handler com guard `isSubmitting`, chamada `submitFatigueResponse`, limpeza draft, CalmConfirmation, e error handling
- [x] 2.8 All 5 set guard: `const allSet = [...].every(v => v !== null)`
- [x] 2.9 Render: h1 com contexto, 5 FatigueSliders, sRPE opcional (post), botão Submeter, CalmConfirmation, error alert
- [x] 2.10 Use `useRouter` from `next/navigation` para redirect no dismiss
- [x] 2.11 Create test file `sparta/src/__tests__/components/ui/fatigue-questionnaire.test.tsx`

---

### Task 3: Create Server Component Page (AC #1)

- [x] 3.1 Create directory `sparta/src/app/(player)/questionario/[sessionId]/[phase]/`
- [x] 3.2 Create `page.tsx` (Server Component — no `'use client'`):
  - Guards: phase (pre/post), UUID regex, autenticação, role=player, registo de jogador, sessão scheduled
  - Usa cliente regular (não service-role) para lookup do jogador — RLS permite ao jogador ler os seus dados
  - ESLint no-restricted-imports resolvido (service-role não é permitido fora de src/lib/actions/)
  - Inclui backHref="/hoje" no StickyHeader
- [x] 3.3 Next.js 15: `await params` implementado correctamente

---

### Task 4: Unit & A11y Tests (AC #7)

- [x] 4.1 `sparta/src/__tests__/components/ui/fatigue-slider.test.tsx`:
  - Renders label + min/max labels ✅
  - `aria-label` equals dimension label ✅
  - `aria-valuemin={1}`, `aria-valuemax={5}` present ✅
  - onChange called with integer on change event ✅
  - axe-core zero violations (vitest-axe) ✅
  - getValueLabel helper testado indirectamente via aria-valuetext ✅
  - 18/18 testes passam ✅
- [x] 4.2 `sparta/src/__tests__/components/ui/fatigue-questionnaire.test.tsx`:
  - `import 'fake-indexeddb/auto'` como primeiro import ✅
  - Mocks: `@/lib/actions/fatigue`, `@/lib/uuid`, `next/navigation` ✅
  - Submit button disabled quando <5 dimensões ✅
  - Submit button activo quando todas as 5 definidas ✅
  - Calls `submitFatigueResponse` com payload correcto ✅
  - Shows `<CalmConfirmation>` no sucesso ✅
  - Shows sRPE slider só em `phase='post'` ✅
  - sRPE não bloqueia submissão quando não definido ✅
  - axe-core zero violations (vitest-axe) ✅
  - Draft restore: valores de `db.cache` restaurados ao montar ✅
  - Draft save: `db.cache` actualizado após debounce 800ms ✅
  - 18/18 testes passam ✅

---

## Dev Notes

### Critical: `params` in Next.js 15

In Next.js 15, route params are a `Promise`. Always `await params`:
```tsx
// ✅ Correct (Next.js 15)
export default async function Page({ params }: { params: Promise<{ sessionId: string; phase: string }> }) {
  const { sessionId, phase } = await params
}
// ❌ Wrong (older pattern)
export default async function Page({ params }: { params: { sessionId: string; phase: string } }) {
  const { sessionId } = params  // will be Promise object, not string
}
```

### Critical: IndexedDB is Client-Only

`db` from `@/lib/outbox/db` uses Dexie which requires the browser environment. `FatigueQuestionnaire` is a Client Component, so Dexie works correctly. Do NOT import `db` in Server Components or Server Actions.

### Critical: `db.cache` Already Exists — No New Dexie Store Needed

The `cache` table is already defined in `src/lib/outbox/db.ts`:
```ts
cache: Table<CacheEntry, string>  // CacheEntry: { key, payload, updatedAt }
```
Use this for autosave drafts. Do NOT create a new Dexie database or new table. Draft key convention: `draft:questionnaire:${sessionId}:${phase}:${playerId}`.

### Critical: Story 4.1 Must Be Done First

`submitFatigueResponse()` is defined in `src/lib/actions/fatigue.ts` (Story 4.1). Import:
```ts
import { submitFatigueResponse } from '@/lib/actions/fatigue'
```
If Story 4.1 hasn't been implemented yet, create a stub:
```ts
// temporary stub - remove when 4-1 is merged
async function submitFatigueResponse(_: unknown) { return { ok: true as const, data: { id: '' } } }
```

### Native Range Input vs Custom Slider

Use `<input type="range">` (NOT a custom div-based slider). Reasons:
- Native ARIA role="slider" built-in
- Left/Right arrow keys work without custom event handling (AC #6)
- `step={1}` enforces integer snapping (AC #2)
- Accessibility is correct by default

Style via CSS `accent-color` or a small Tailwind plugin, not via `appearance: none` + complex pseudo-selectors (which break across browsers).

### Session "Live" Window — Simplified for Story 4.2

Story 4.2 does NOT enforce strict time windows. It only checks `status='scheduled'`. The Story 4.8 push notification system will define the X/Y minute windows. This is a deliberate simplification — document in completion notes when done.

### Route Location in `(player)` Group

```
src/app/(player)/questionario/[sessionId]/[phase]/page.tsx
```
This inherits the player layout (`src/app/(player)/layout.tsx`) which includes `<BottomTabNav role="player" />`. Do NOT add another `<BottomTabNav>` or another layout.

### `(player)` Layout Already Wraps in `<main id="main-content">`

The player layout wraps `{children}` in `<main id="main-content">`. The `/hoje/page.tsx` pattern adds ANOTHER `<main id="main-content">` inside — this is a pre-existing quirk. Follow the same pattern as `hoje/page.tsx` for consistency (adds `<main id="main-content">` in the page body). **Do not attempt to fix this pre-existing nested-main issue in Story 4.2.**

### File Locations

```
sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx   ← NEW Server Component
sparta/src/components/ui/fatigue-slider.tsx                          ← NEW
sparta/src/components/ui/fatigue-questionnaire.tsx                   ← NEW
sparta/src/__tests__/components/ui/fatigue-slider.test.tsx           ← NEW
sparta/src/__tests__/components/ui/fatigue-questionnaire.test.tsx    ← NEW
```

No existing files are modified in this story.

### Imports Reference

```ts
// Client components
import { db } from '@/lib/outbox/db'           // Dexie cache store
import { newId } from '@/lib/uuid'             // UUIDv7 generation
import { submitFatigueResponse } from '@/lib/actions/fatigue'  // Story 4.1
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import { useRouter } from 'next/navigation'

// Server component
import { createServerClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { getSessionById } from '@/lib/actions/sessions'         // Story 2.6
import { StickyHeader } from '@/components/patterns/StickyHeader'
import { redirect } from 'next/navigation'
```

### Test Setup — Dexie Mocking

```ts
import 'fake-indexeddb/auto'   // MUST be first import in test file
import { db } from '@/lib/outbox/db'

beforeEach(async () => {
  await db.cache.clear()  // reset between tests
})
```

### Dimensions Copy Table (Senior)

| Dimension | Title | minLabel | maxLabel |
|-----------|-------|----------|----------|
| `dim_energy` | Energia muscular | Esgotado | Pleno |
| `dim_focus` | Concentração | Disperso | Concentrado |
| `dim_sleep` | Sono | Mau | Excelente sono |
| `dim_soreness` | Desconforto físico | Muito dor | Sem dor |
| `dim_mood` | Estado emocional | Mau | Bom estado |
| sRPE (post only) | Esforço percebido da sessão (sRPE) | Muito fácil | Máximo esforço |

*Story 4.3 adds the sub-14 copy variant — don't implement it here, but accept `ageGroup` prop on `<FatigueSlider>` for forward compatibility.*

### Design Tokens to Use

```css
--color-ink-2     /* labels */
--color-surface   /* card backgrounds */
--color-hairline  /* separator lines */
--signal-ready-bg / --signal-ready-ink  /* for "all set" visual cue */
```

Components follow `prefers-color-scheme` via `globals.css` (Story 1.17). No inline `style={{ color: '#...' }}`.

### Dependency Chain

```
Story 2.6 (getSessionById) ← Story 4.2 (page) → Story 4.1 (submitFatigueResponse)
Story 1.11 (db.cache)      ← Story 4.2 (autosave)
Story 4.2 (FatigueSlider)  ← Story 4.3 (sub-14 ageGroup prop)
Story 4.2 (FatigueQuestionnaire) ← Story 4.4 (offline: enqueue instead of direct submit)
```

### References

- **FR21:** Questionário 5 dimensões — [epics.md#L50]
- **FR22:** Versão sub-14 linguisticamente adaptada — [epics.md#L54] (Story 4.3 handles this)
- **FR23:** Offline submission — [epics.md#L55] (Story 4.4 handles this)
- **NFR2:** Submissão ≤500ms (P95) — [epics.md#L122]
- **NFR48:** Sem duplicados — UUIDv7 idempotente — [epics.md#L183]
- **UX-DR16:** `<FatigueQuestionnaire>` spec — [epics.md#L421]
- **UX-DR17:** `<FatigueSlider>` spec — [epics.md#L422]
- **UX-DR30:** Button hierarchy — [epics.md#L440]
- **UX-DR36:** Date formatting PT-PT — [epics.md#L446]
- **UX-DR47:** Questionnaire direction B (slider 1–5 single view) — [epics.md#L467]
- **Story 4.1:** `submitFatigueResponse()` + `FatigueResponseSchema` — [4-1-fatigue-response-schema-idempotent-server-action.md]
- **Story 2.6:** `getSessionById()` at `src/lib/actions/sessions.ts` — [2-6-session-management-create-edit-cancel-treino-jogo-amigavel.md]
- **Story 1.11:** `db.cache` Dexie table — [1-11-outbox-foundation-dexie-uuidv7-generation-service-worker-serwist.md]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- **FatigueSlider** (`src/components/ui/fatigue-slider.tsx`): componente nativo `<input type="range" step={1}>` com ARIA completo (aria-label, aria-valuemin/max/now/text), helper `getValueLabel()` para duas escalas (1–5 e 1–10), container `min-h-[44px]` para NFR40, `motion-reduce:transition-none`. Exporta `getValueLabel` para uso futuro em testes.
- **FatigueQuestionnaire** (`src/components/ui/fatigue-questionnaire.tsx`): Client Component com 5 dimensões em vista única, sRPE opcional só em `phase='post'`, autosave Dexie debounce 800ms, restore de draft ao montar (com cancelled guard), submit handler idempotente via `values.id` UUIDv7, `CalmConfirmation` com redirect `/hoje` via `onDismiss`, error display com `role="alert"`.
- **Page** (`src/app/(player)/questionario/[sessionId]/[phase]/page.tsx`): Server Component com 5 guards (phase, UUID, auth, role=player, session scheduled). Usa cliente regular (sem service-role) para lookup do jogador — ESLint no-restricted-imports satisfeito. `await params` correcto para Next.js 15. Inclui `backHref="/hoje"` no StickyHeader.
- **Simplificação documentada**: página verifica apenas `status='scheduled'` — janela X/Y minutos pré/pós sessão implementada em Story 4.8 (push notifications).
- **Testes**: 36 novos testes (18 FatigueSlider + 18 FatigueQuestionnaire). `renderAndSettle()` helper para flush do useEffect async inicial. `waitFor` para assertions de estado dinâmico. Debounce testado com `waitFor` (timeout 2000ms, interval 100ms) em vez de fake timers (que causavam deadlock com IndexedDB). `afterEach(() => vi.useRealTimers())` como cleanup defensivo.
- **Regressões**: 0. Falhas pré-existentes (proxy.test.ts x3, rls-policies.integration.test.ts) mantêm-se sem alteração.

### File List

**Ficheiros novos:**
- `sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx`
- `sparta/src/components/ui/fatigue-slider.tsx`
- `sparta/src/components/ui/fatigue-questionnaire.tsx`
- `sparta/src/__tests__/components/ui/fatigue-slider.test.tsx`
- `sparta/src/__tests__/components/ui/fatigue-questionnaire.test.tsx`

**Ficheiros modificados:** Nenhum.

**Change Log:**
- 2026-05-23: Story 4.2 implementada — FatigueSlider + FatigueQuestionnaire + página /questionario/[sessionId]/[phase]; 36 testes novos; lint ✅; typecheck ✅; build ✅; AC #1–#7 verificados

---

### Review Findings

#### Patches Applied (8 fixed)

- [x] [Review][Patch] Missing range validation on FatigueSlider values [fatigue-slider.tsx:107] — added min/max bounds check in onChange handler
- [x] [Review][Patch] aria-valuenow undefined when value is null [fatigue-slider.tsx:102] — conditional ARIA attribute only when value !== null
- [x] [Review][Patch] IndexedDB payload not validated before using [fatigue-questionnaire.tsx:136-137] — added DraftValuesSchema safeParse validation on restore
- [x] [Review][Patch] Silently swallowed Dexie quota errors [fatigue-questionnaire.tsx:152-156] — added .catch() with console.warn fallback
- [x] [Review][Patch] Unhandled exceptions in submitFatigueResponse call [fatigue-questionnaire.tsx:205-232] — wrapped in try-catch with error propagation
- [x] [Review][Patch] db.cache.delete not error-handled [fatigue-questionnaire.tsx:227] — added nested try-catch (non-critical to submission)
- [x] [Review][Patch] Router.push failure unhandled [fatigue-questionnaire.tsx:281-288] — added error catch with window.location fallback

#### Deferred (3 pre-existing)

- [x] [Review][Defer] Missing validation on server-side submission payload [fatigue-questionnaire.tsx:187-199] — deferred, pre-existing: Server Action (Story 4.1) implements Zod validation
- [x] [Review][Defer] Draft mutation without optimistic locking [fatigue-questionnaire.tsx:152-156] — deferred, pre-existing: Dexie versioning is Story 1.11 platform concern
- [x] [Review][Defer] No timeout on server-side session lookup [page.tsx:70] — deferred, pre-existing: getSessionById (Story 2.6) pattern

#### Note: Multi-Tab Race Condition (Patch 1)

The race condition in draft autosave across multiple tabs (when player opens questionnaire in 2+ tabs) is noted but requires architectural coordination. Current mitigation: submission clears draft on success; stale draft on secondary tab would re-submit same UUID (idempotent via Story 4.1). Full fix deferred to Story 4.4 (offline-first) when outbox coordination will handle multi-tab state.

---

## Story Status

**Status:** in-progress
**Última atualização:** 2026-05-23
**Próximos passos:** Run tests, lint, typecheck, and build to verify patches. Resolve any test failures if patches affect test assertions.
