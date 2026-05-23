# Story 4.3: Sub-14 Linguistically Adapted Version

**Status:** done

**Story ID:** 4.3
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)
**Criado:** 2026-05-23
**Story anterior:** 4-2 (fatigue-questionnaire-ui-5-sliders-with-snap-single-view)

---

## Story

As a Jogador aged 13–15,
I want the questionnaire copy to be simplified and warmer,
So that I can answer accurately without feeling judged or confused by clinical language.

---

## Acceptance Criteria

**AC #1 — Adaptação de copy nos sliders para u14/u15**

**Given** a player whose `age_group` is `u14` or `u15` (FR22, NFR43)
**When** the questionnaire loads
**Then** `<FatigueSlider>` receives `ageGroup="u14"` and uses simplified copy:
- dim_energy: "Como te sentes de energia?" / "Cansado | Cheio de energia"
- dim_focus: "Estás atento?" / "Distraído | Atento"
- dim_sleep: "Como dormiste?" / "Dormi mal | Dormi bem"
- dim_soreness: "Tens dor em algum sítio?" / "Tenho dor | Sem dor"
- dim_mood: "Como estás de humor?" / "Triste/zangado | Bem-disposto"
**And** dimension titles use plain words em frase completa, sem termos médicos (UX-DR32)

**AC #2 — Texto do botão de submissão para sub-14**

**Given** the submit button copy
**When** rendered for sub-14 (`ageGroup="u14"`)
**Then** the copy reads "Pronto, terminámos" instead of "Submeter" (UX-DR32)
**And** the loading state reads "A registar…" instead of "A submeter…"

**AC #3 — Texto de ajuda para sub-14**

**Given** help text
**When** the page renders for a sub-14 player
**Then** a single-sentence introduction "Não há respostas certas. O que importa é como te sentes mesmo." appears above the sliders (NFR42)
**And** this help text is NOT shown for senior players

**AC #4 — Testes de snapshot e acessibilidade**

**Given** test coverage
**When** tests run with `ageGroup="u14"` and `ageGroup="senior"` (or without ageGroup)
**Then** the rendered copy differs exactly as specified in AC #1–#3
**And** axe-core passes zero violations on both variants (NFR37)
**And** the tests cover both `<FatigueSlider>` and `<FatigueQuestionnaire>` with ageGroup prop

---

## Tasks / Subtasks

- [x] **Task 1: Criar ficheiro de i18n `src/lib/i18n/pt-PT/fatigue.ts`** (AC: #1, #2, #3)
  - [x] Exportar constante `FATIGUE_COPY` com chaves `senior` e `u14`
  - [x] Cada chave contém: `dimensions[]` (key, label, minLabel, maxLabel), `submitLabel`, `submittingLabel`, `helpText` (null | string), `confirmationMessage`
  - [x] Exportar função utilitária `getFatigueCopy(ageGroup?: string)` que mapeia "u14"|"u15" → u14 copy, qualquer outro valor → senior copy
  - [x] Usar `as const` para inferência de tipos estrita

- [x] **Task 2: Estender `<FatigueSlider>` com prop `ageGroup`** (AC: #1, #4)
  - [x] Adicionar prop opcional `ageGroup?: "senior" | "u14"` a `FatigueSliderProps`
  - [x] A prop é informacional/pass-through — os labels já chegam correctos do componente pai
  - [x] Documentar no JSDoc que o componente pai (`FatigueQuestionnaire`) controla os labels via i18n
  - [x] Não quebrar qualquer teste existente de `fatigue-slider.test.tsx`

- [x] **Task 3: Estender `<FatigueQuestionnaire>` com prop `ageGroup`** (AC: #1, #2, #3)
  - [x] Adicionar prop opcional `ageGroup?: "senior" | "u14"` a `FatigueQuestionnaireProps` (default: `"senior"`)
  - [x] Substituir a constante `DIMENSIONS` hardcoded por `getFatigueCopy(ageGroup).dimensions`
  - [x] Substituir o texto do botão "Submeter" por `getFatigueCopy(ageGroup).submitLabel`
  - [x] Substituir o texto "A submeter…" por `getFatigueCopy(ageGroup).submittingLabel`
  - [x] Renderizar `helpText` acima dos sliders quando `getFatigueCopy(ageGroup).helpText !== null`
  - [x] Passar `ageGroup` para cada `<FatigueSlider>` renderizado
  - [x] Manter `confirmationMessage` de `getFatigueCopy(ageGroup).confirmationMessage` para `<CalmConfirmation>`
  - [x] Não quebrar qualquer teste existente de `fatigue-questionnaire.test.tsx`

- [x] **Task 4: Atualizar `page.tsx` para derivar e passar `ageGroup`** (AC: #1)
  - [x] Derivar `const ageGroup: "senior" | "u14" = player.age_group === "u14" || player.age_group === "u15" ? "u14" : "senior"`
  - [x] Passar `ageGroup={ageGroup}` para `<FatigueQuestionnaire>`
  - [x] Sem alterações na lógica de autenticação ou guards (já funcional da Story 4.2)

- [x] **Task 5: Testes para `<FatigueSlider>` com `ageGroup` prop** (AC: #4)
  - [x] Adicionar `describe("adaptação sub-14", ...)` ao ficheiro existente `fatigue-slider.test.tsx`
  - [x] Teste: renderiza sem erro com `ageGroup="u14"` passado
  - [x] Teste: prop `ageGroup` não altera ARIA quando labels correctos são passados pelo pai
  - [x] Teste: axe-core passa com `ageGroup="u14"` e labels sub-14

- [x] **Task 6: Testes para `<FatigueQuestionnaire>` com `ageGroup="u14"`** (AC: #1, #2, #3, #4)
  - [x] Adicionar `describe("variante sub-14 (ageGroup='u14')", ...)` ao ficheiro existente `fatigue-questionnaire.test.tsx`
  - [x] Teste: renderiza label "Como te sentes de energia?" (não "Energia muscular")
  - [x] Teste: renderiza "Cansado" e "Cheio de energia" como extremos
  - [x] Teste: renderiza "Distraído" e "Atento" para dim_focus
  - [x] Teste: renderiza "Triste/zangado" e "Bem-disposto" para dim_mood
  - [x] Teste: botão de submissão diz "Pronto, terminámos" (não "Submeter")
  - [x] Teste: help text "Não há respostas certas…" está visível
  - [x] Teste: helper text NÃO aparece na variante senior
  - [x] Teste: axe-core passa com `ageGroup="u14"`
  - [x] Teste: axe-core passa com `ageGroup="senior"` (ou sem prop)

---

## Dev Notes

### Ficheiro i18n `src/lib/i18n/pt-PT/fatigue.ts`

Este ficheiro materializa o requisito de arquitectura (`lib/i18n/pt-PT/` com chaves `senior`/`u14`). O directório `src/lib/i18n/pt-PT/` existe com `.gitkeep`. Criar o ficheiro directamente lá.

```typescript
// src/lib/i18n/pt-PT/fatigue.ts

export interface FatigueDimensionCopy {
  key: "dim_energy" | "dim_focus" | "dim_sleep" | "dim_soreness" | "dim_mood";
  label: string;
  minLabel: string;
  maxLabel: string;
}

export interface FatigueCopySet {
  dimensions: readonly FatigueDimensionCopy[];
  submitLabel: string;
  submittingLabel: string;
  helpText: string | null;
  confirmationMessage: string;
}

export const FATIGUE_COPY = {
  senior: {
    dimensions: [
      { key: "dim_energy", label: "Energia muscular", minLabel: "Esgotado", maxLabel: "Pleno" },
      { key: "dim_focus", label: "Concentração", minLabel: "Disperso", maxLabel: "Concentrado" },
      { key: "dim_sleep", label: "Sono", minLabel: "Mau", maxLabel: "Excelente sono" },
      { key: "dim_soreness", label: "Desconforto físico", minLabel: "Muito dor", maxLabel: "Sem dor" },
      { key: "dim_mood", label: "Estado emocional", minLabel: "Mau", maxLabel: "Bom estado" },
    ],
    submitLabel: "Submeter",
    submittingLabel: "A submeter…",
    helpText: null,
    confirmationMessage: "Registado, bom treino",
  },
  u14: {
    dimensions: [
      { key: "dim_energy", label: "Como te sentes de energia?", minLabel: "Cansado", maxLabel: "Cheio de energia" },
      { key: "dim_focus", label: "Estás atento?", minLabel: "Distraído", maxLabel: "Atento" },
      { key: "dim_sleep", label: "Como dormiste?", minLabel: "Dormi mal", maxLabel: "Dormi bem" },
      { key: "dim_soreness", label: "Tens dor em algum sítio?", minLabel: "Tenho dor", maxLabel: "Sem dor" },
      { key: "dim_mood", label: "Como estás de humor?", minLabel: "Triste/zangado", maxLabel: "Bem-disposto" },
    ],
    submitLabel: "Pronto, terminámos",
    submittingLabel: "A registar…",
    helpText: "Não há respostas certas. O que importa é como te sentes mesmo.",
    confirmationMessage: "Registado, bom treino",
  },
} as const satisfies Record<string, FatigueCopySet>;

/**
 * Devolve o conjunto de copy de fadiga para o grupo etário do jogador.
 * age_group "u14" ou "u15" → versão simplificada sub-14.
 * Qualquer outro valor (incluindo undefined) → versão senior.
 */
export function getFatigueCopy(ageGroup?: string): FatigueCopySet {
  if (ageGroup === "u14" || ageGroup === "u15") return FATIGUE_COPY.u14;
  return FATIGUE_COPY.senior;
}
```

### Modificações em `<FatigueSlider>` (mínimas)

Adicionar apenas a prop `ageGroup` à interface — não muda lógica de render porque os labels vêm todos como props do componente pai:

```typescript
export interface FatigueSliderProps {
  // ... props existentes ...
  /**
   * Grupo etário do jogador — passado pelo FatigueQuestionnaire para
   * consistência. Os labels já chegam adaptados via i18n; esta prop é
   * informacional e pode ser usada por testes standalone ou futuros
   * consumidores do componente.
   */
  ageGroup?: "senior" | "u14";
}
```

### Modificações em `<FatigueQuestionnaire>`

Remover `DIMENSIONS` constante hardcoded e substituir por chamada à função `getFatigueCopy`:

```typescript
// Antes (Story 4.2 — remover):
const DIMENSIONS = [
  { key: "dim_energy" as const, label: "Energia muscular", minLabel: "Esgotado", maxLabel: "Pleno" },
  // ...
] as const;

// Depois (Story 4.3 — usar i18n):
// Na assinatura do componente:
export interface FatigueQuestionnaireProps {
  // ... props existentes ...
  ageGroup?: "senior" | "u14";  // default: "senior"
}

// No corpo do componente:
const copy = getFatigueCopy(ageGroup);
```

O JSX muda assim:

```tsx
{/* Help text sub-14 — só quando existe (AC #3) */}
{copy.helpText && (
  <p className="text-sm text-[var(--color-ink-2,theme(colors.gray.600))]">
    {copy.helpText}
  </p>
)}

{/* 5 sliders de dimensão — copy vem do i18n */}
{copy.dimensions.map((dim) => (
  <FatigueSlider
    key={dim.key}
    id={`slider-${dim.key}`}
    label={dim.label}
    minLabel={dim.minLabel}
    maxLabel={dim.maxLabel}
    min={1}
    max={5}
    value={values[dim.key]}
    onChange={(v) => handleChange(dim.key, v)}
    disabled={isSubmitting}
    ageGroup={ageGroup ?? "senior"}
  />
))}

{/* Botão — copy adaptado (AC #2) */}
<button ...>
  {isSubmitting ? copy.submittingLabel : copy.submitLabel}
</button>

{/* Confirmação — copy do i18n */}
{showConfirmation && (
  <CalmConfirmation
    message={copy.confirmationMessage}
    onDismiss={...}
  />
)}
```

### Modificações em `page.tsx` (mínimas)

O `page.tsx` já faz `select("id, age_group")` da tabela `players`. Apenas derivar o ageGroup e passar:

```typescript
// Derivar grupo etário para adaptação linguística (Story 4.3)
const ageGroup: "senior" | "u14" =
  player.age_group === "u14" || player.age_group === "u15" ? "u14" : "senior";

// No JSX:
<FatigueQuestionnaire
  sessionId={sessionId}
  sessionType={session.type}
  sessionDate={session.scheduled_at}
  phase={phase as "pre" | "post"}
  playerId={player.id}
  ageGroup={ageGroup}  // ← adicionar
/>
```

### Padrão de Testes — Adições a Ficheiros Existentes

**IMPORTANTE:** Adicionar blocos `describe` aos ficheiros de teste existentes, **não criar novos ficheiros de teste** para evitar duplicação de contexto de mocks e setup. Os ficheiros existentes já têm `fake-indexeddb/auto`, mocks e helpers configurados.

**Em `fatigue-slider.test.tsx`**, adicionar no final:

```typescript
describe("adaptação sub-14 (ageGroup prop)", () => {
  it("aceita prop ageGroup='u14' sem erro", () => {
    render(
      <FatigueSlider
        {...defaultProps}
        ageGroup="u14"
        label="Como te sentes de energia?"
        minLabel="Cansado"
        maxLabel="Cheio de energia"
      />
    );
    expect(screen.getByText("Como te sentes de energia?")).toBeInTheDocument();
    expect(screen.getByText("Cansado")).toBeInTheDocument();
    expect(screen.getByText("Cheio de energia")).toBeInTheDocument();
  });

  it("sem violações axe-core com ageGroup='u14'", async () => {
    const { container } = render(
      <FatigueSlider
        {...defaultProps}
        ageGroup="u14"
        label="Como te sentes de energia?"
        minLabel="Cansado"
        maxLabel="Cheio de energia"
        value={3}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Em `fatigue-questionnaire.test.tsx`**, adicionar no final (após os describes existentes):

```typescript
describe("variante sub-14 (ageGroup='u14')", () => {
  it("renderiza labels simplificados para dim_energy", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByText("Como te sentes de energia?")).toBeInTheDocument();
    expect(screen.getByText("Cansado")).toBeInTheDocument();
    expect(screen.getByText("Cheio de energia")).toBeInTheDocument();
  });

  it("renderiza labels simplificados para dim_focus", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByText("Estás atento?")).toBeInTheDocument();
    expect(screen.getByText("Distraído")).toBeInTheDocument();
    expect(screen.getByText("Atento")).toBeInTheDocument();
  });

  it("renderiza labels simplificados para dim_mood", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByText("Como estás de humor?")).toBeInTheDocument();
    expect(screen.getByText("Triste/zangado")).toBeInTheDocument();
    expect(screen.getByText("Bem-disposto")).toBeInTheDocument();
  });

  it("botão de submissão diz 'Pronto, terminámos'", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.getByRole("button", { name: /Pronto, terminámos/i })).toBeInTheDocument();
  });

  it("botão 'Submeter' NÃO aparece na variante u14", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.queryByRole("button", { name: /^Submeter$/i })).not.toBeInTheDocument();
  });

  it("exibe help text para sub-14", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(
      screen.getByText("Não há respostas certas. O que importa é como te sentes mesmo.")
    ).toBeInTheDocument();
  });

  it("NÃO exibe help text para senior (sem prop ageGroup)", async () => {
    await renderAndSettle(BASE_PROPS); // sem ageGroup
    expect(
      screen.queryByText("Não há respostas certas. O que importa é como te sentes mesmo.")
    ).not.toBeInTheDocument();
  });

  it("NÃO renderiza 'Energia muscular' na variante u14", async () => {
    await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
    expect(screen.queryByText("Energia muscular")).not.toBeInTheDocument();
  });

  it("sem violações axe-core com ageGroup='u14'", async () => {
    const { container } = render(
      <FatigueQuestionnaire {...BASE_PROPS} ageGroup="u14" />
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("sem violações axe-core com ageGroup='senior'", async () => {
    const { container } = render(
      <FatigueQuestionnaire {...BASE_PROPS} ageGroup="senior" />
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Regras críticas de arquitectura a cumprir

1. **Sem barrel files** — importar de `@/lib/i18n/pt-PT/fatigue` directamente, nunca via index.ts
2. **Sem `console.log`** — usar apenas `logger.warn` quando necessário (não será preciso nesta story)
3. **`noUncheckedIndexedAccess`** — ao aceder a arrays de `copy.dimensions`, usar `.map()` (seguro) em vez de índice
4. **Testes a partir de `sparta/`** — `npm run test --run` a partir do directório `sparta/`
5. **React 19** — sem `import React from "react"` — automático via JSX transform
6. **`as const satisfies`** — usar para `FATIGUE_COPY` para preservar tipos literais e validação contra a interface

### O que NÃO fazer

- ❌ Não criar sistema de tradução dinâmico ou `next-intl` — copy estático em PT-PT é suficiente
- ❌ Não modificar a migração SQL nem o schema da tabela `fatigue_responses` — não há novas colunas
- ❌ Não modificar `submitFatigueResponse` — a Story 4.1 é independente de ageGroup
- ❌ Não criar um "modo infantil" visual separado — apenas copy diferente (UX-DR: "linguagem dual sem fragmentação")
- ❌ Não adicionar lógica de routing baseada em ageGroup — a mesma rota `/questionario/[sessionId]/[phase]` serve ambos
- ❌ Não tocar nos mocks ou configuração de testes existentes — apenas adicionar novos `describe` blocks

### Dependências já cumpridas

| Dependência | Story | Status |
|---|---|---|
| `players.age_group` column | 2.1 | ✅ done |
| `FatigueSlider` component | 4.2 | ✅ in-progress (done) |
| `FatigueQuestionnaire` component | 4.2 | ✅ in-progress (done) |
| `page.tsx` already fetches `age_group` | 4.2 | ✅ (linha 63 já tem `select("id, age_group")`) |
| `src/lib/i18n/pt-PT/` directory | 1.x | ✅ (`.gitkeep` existe) |

### Intelligence da Story 4.2 (aprendizagens relevantes)

- **`renderAndSettle()`** helper é obrigatório em testes de `FatigueQuestionnaire` — sem ele o `useEffect` de mount não corre e o id fica vazio
- **`fake-indexeddb/auto`** deve ser o **primeiro import** em qualquer ficheiro de teste que use `db`
- **`waitFor`** com `{ timeout: 2000, interval: 100 }` para debounce (não usar fake timers)
- **`afterEach(() => vi.useRealTimers())`** — limpar timers após testes que os usam
- **`noUncheckedIndexedAccess`** — ao aceder a `mock.calls[0]?.[0]` usar `?.` obrigatoriamente
- **Dexie `db.cache.clear()`** no `beforeEach` para isolamento de testes
- A prop `ageGroup` no `FatigueQuestionnaire` deve ter `default "senior"` para não quebrar testes existentes que não a passam

### Refs

- [Epics.md — Story 4.3 ACs completos](../_bmad-output/planning-artifacts/epics.md)
- [UX Spec — UX-DR17, UX-DR32, UX-DR43](../_bmad-output/planning-artifacts/ux-design-specification.md)
- [Architecture — lib/i18n/pt-PT/, cross-cutting concern #8](../_bmad-output/planning-artifacts/architecture.md)
- [fatigue-slider.tsx:12](sparta/src/components/ui/fatigue-slider.tsx#L12) — comentário "Story 4.3 adicionará variante sub-14"
- [fatigue-questionnaire.tsx:60](sparta/src/components/ui/fatigue-questionnaire.tsx#L60) — DIMENSIONS array a substituir
- [page.tsx:63](sparta/src/app/(player)/questionario/%5BsessionId%5D/%5Bphase%5D/page.tsx#L63) — já selecciona `age_group`

---

---

## Review Findings

**Code review completed:** 0 `decision-needed`, 2 `patch`, 1 `defer`, 6 dismissed as noise.

Findings written by parallel adversarial review layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

### Action Items

- [x] [Review][Patch] Test "NÃO renderiza Energia muscular" should include positive assertion — renamed test to "renderiza label u14 ('Como te sentes de energia?') e NÃO renderiza senior ('Energia muscular')" + added positive assertion [fatigue-questionnaire.test.tsx:428]

- [x] [Review][Patch] Add integration test for null age_group fallback — added "defaults to senior variant quando ageGroup prop é undefined" test that verifies senior labels appear when ageGroup is not passed [fatigue-questionnaire.test.tsx:460–479]

- [x] [Review][Defer] Hard-coded Portuguese ARIA labels not localized — future i18n story (out of scope for 4-3) — [fatigue-slider.tsx:48–81]

---

## Dev Agent Record

### Agent Model Used

claude-haiku-4-5-20251001 (bmad-code-review)

### Debug Log References

N/A

### Completion Notes List

_A preencher pelo agente de dev após implementação._

### File List

**Novos ficheiros:**
- `sparta/src/lib/i18n/pt-PT/fatigue.ts` ← NEW

**Ficheiros modificados:**
- `sparta/src/components/ui/fatigue-slider.tsx` ← UPDATE (adicionar prop `ageGroup?`)
- `sparta/src/components/ui/fatigue-questionnaire.tsx` ← UPDATE (adicionar prop `ageGroup?`, integrar i18n)
- `sparta/src/app/(player)/questionario/[sessionId]/[phase]/page.tsx` ← UPDATE (derivar + passar `ageGroup`)
- `sparta/src/__tests__/components/ui/fatigue-slider.test.tsx` ← UPDATE (adicionar describe sub-14)
- `sparta/src/__tests__/components/ui/fatigue-questionnaire.test.tsx` ← UPDATE (adicionar describe sub-14)
