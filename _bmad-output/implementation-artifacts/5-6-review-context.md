# Story 5.6 Code Review Context

## Spec File
Localização: `_bmad-output/implementation-artifacts/5-6-painel-field-formation-4-3-3-view-with-toggle.md`
Status: review
Tasks: 6/6 completadas

## Acceptance Criteria
- AC #1: Toggle "Formação" ativa vista de formação 4-3-3
- AC #2: `getFormationData()` com fallback a lineup recente
- AC #3: Fallback funciona quando sessão não tem lineup definida
- AC #4: Chips no campo agrupados por posição (GR/DEF/MED/AVA)
- AC #5: Grelha de banco abaixo do campo com SemaforoBadges
- AC #7: Selector de formação shows "4-3-3" ativo; outros disabled "Em breve"
- AC #8: aria-label em botões + SVG + chips
- AC #9: ≥80% cobertura testes (43 novos testes adicionados)

## Ficheiros Modificados

### 1. readiness.ts
- Novas interfaces: `FormationEntry`, `FormationResult`
- Nova função: `getFormationData(sessionId: string)`
- Padrão: `requireStaffRole()` no início
- Fallback: query últimas 5 sessões de match/friendly

### 2. readiness-panel-header.tsx
- Botão "Formação" ativado (remover `disabled`)
- `aria-pressed={view === "formation"}`
- `onClick={() => onViewChange("formation")}`

### 3. readiness-panel.tsx
- Placeholder substituído por `<ReadinessPanelFormation>`
- Importar novo componente

### 4. prontidao.test.tsx
- Mock `ReadinessPanelFormation`
- 4 novos testes Story 5.6

## Ficheiros Novos

### 1. field-formation.tsx
- SVG campo 4-3-3
- Chips botões com jersey num + nome
- Posicionamento absoluto por linha de posição
- aria-label pattern: Estado, nome, posição, ACWR

### 2. readiness-panel-formation.tsx
- Client Component com useEffect + getFormationData
- Estados: loading, loaded, error
- EmptyState quando source='none'
- Merge lineup com players array
- Separar starters/bench
- PlayerDrillDownSheet

### 3. field-formation.test.tsx
- 9 testes de FieldFormation
- Teste de positioning
- axe-core accessibility

### 4. readiness-panel-formation.test.tsx
- 12 testes de ReadinessPanelFormation
- Mocks de getFormationData, PlayerDrillDownSheet, recharts
- sessionStorage.clear() em beforeEach
- axe-core violations check

## Estatísticas

- 6 ficheiros modificados
- 4 ficheiros novos
- +279 linhas, -69 linhas
- 43 novos testes adicionados
- 1454/1454 testes ✅
- typecheck ✅
- lint 0 erros

## Key Code Patterns to Check

1. **Formation Data Fetch**: `(supabase.from as any)('match_lineups')` pattern (linha readiness.ts:520)
2. **SVG Accessibility**: `role="img" aria-label=` no SVG, não no div container (field-formation.tsx:84)
3. **State Transitions**: `startTransition` em todos os setState dentro useEffect (readiness-panel-formation.tsx:35)
4. **Empty State**: `EmptyState` com `icon`, `title`, `description` props (readiness-panel-formation.tsx:90)
5. **Lineup Merge**: filter + map + filter para type narrowing (readiness-panel-formation.tsx:100-108)
