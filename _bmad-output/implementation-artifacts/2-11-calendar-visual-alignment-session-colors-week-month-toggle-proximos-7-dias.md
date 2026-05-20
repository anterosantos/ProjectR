# Story 2.11: Calendar Visual Alignment — Session Block Colors, Week/Month Toggle & "Próximos 7 Dias"

**Status:** ready-for-dev

**Story ID:** 2.11
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-20
**Depends on:** Story 1-17 (tokens ink/surface/hairline — deve estar done antes deste), Story 2-6 (done), Story 2-7 (done)
**Referência visual:** `docs/ux-design/Variação A Semana (timeline + agenda).png` + `Variação B Mês (grid heatmap + agenda).png`

---

## Story

Como Treinador ou Analista,
Quero o Calendário com o look & feel aprovado nos mockups (blocos de sessão coloridos por tipo, toggle Semana/Mês, e lista "Próximos 7 Dias"),
Para que a aplicação seja visualmente coerente com o design system definido e fácil de interpretar num relance.

---

## Contexto

As Stories 2-6 e 2-7 implementaram a camada de dados e a estrutura base do Calendário. Esta story adiciona a camada visual definida nos mockups, que não estava coberta pelas stories anteriores.

**O que existe actualmente em `/calendario`:**
- Server Component `CalendarioPage` que agrupa sessões por semana
- `SessionCard` — card simples com ícone + data + tipo + local
- `SeasonToggle` (cumulativo / época)
- Lista linear de sessões agrupadas por semana

**O que os mockups adicionam:**
- Strip de chips de dia (vista semana) com dot de sessão por baixo
- Blocos de sessão coloridos por tipo (azul=treino, vermelho=jogo, amarelo=amigável)
- Grelha de mês com dots coloridos por dia (vista mês)
- Toggle Semana/Mês no header
- Secção "Próximos 7 Dias" como lista com borda colorida à esquerda

**Tipos de sessão actuais:** `training` | `match` | `friendly` (sem alteração ao schema)

---

## Acceptance Criteria

### AC #1: Toggle Semana/Mês no header

**Given** a página `/calendario` carregada por Treinador ou Analista
**When** o header renderiza
**Then** um segmented control "Semana | Mês" está visível à direita do título
**And** o estado seleccionado tem `aria-selected="true"` e estilo activo (bg foreground, text background)
**And** o estado seleccionado persiste via URL query param `?vista=semana` (default) ou `?vista=mes` para que o link seja partilhável e sobreviva a reload
**And** o toggle usa `role="tablist"` com `role="tab"` para cada opção (acessibilidade)

### AC #2: Vista Semana — Strip de dias com dots de sessão

**Given** vista Semana activa
**When** a semana actual é renderizada
**Then** um strip horizontal com 7 chips de dia aparece no topo: formato `"SEX\n11"` (abreviatura do dia da semana + número do dia)
**And** o dia actual tem um pill sólido (bg-foreground, text-background) em volta
**And** por baixo de cada chip, um dot colorido indica se há sessão nesse dia: dot azul (training), dot vermelho (match), dot amarelo (friendly), ou nenhum dot se não houver sessão
**And** clicar/tap num chip de dia rola para as sessões desse dia na lista abaixo
**And** o chip do dia seleccionado tem `aria-current="true"`

### AC #3: Vista Semana — Blocos de sessão coloridos

**Given** vista Semana com sessões do dia seleccionado
**When** as sessões renderizam
**Then** cada sessão é um bloco full-width com fundo colorido e texto branco (ou adequado para contraste):
  - `training` → fundo `#2563EB` (azul, = signal-info / --color-field equivalente)
  - `match` → fundo `#DC2626` (vermelho, = signal-alert)
  - `friendly` → fundo `#CA8A04` (amarelo escuro, = signal-caution)
**And** cada bloco mostra: tipo de sessão (label em texto), horário (HH:mm), duração em minutos, e local (se definido)
**And** tap no bloco navega para `/sessoes/[id]` (comportamento existente preservado)
**And** sessões canceladas mostram o bloco com opacidade reduzida (50%) e o label "Cancelada"

### AC #4: Vista Semana — "Próximos 7 Dias" lista

**Given** vista Semana activa
**When** a secção abaixo dos blocos do dia renderiza
**Then** uma secção "PRÓXIMOS 7 DIAS" (Eyebrow — componente da Story 1-17) lista as sessões dos próximos 7 dias a partir de hoje
**And** cada item tem uma borda colorida à esquerda (4px, cor por tipo igual ao AC #3), fundo surface, e mostra: label do tipo, data+hora, local
**And** sessões de hoje aparecem no topo com label "Hoje" antes da data
**And** os itens são clicáveis e navegam para `/sessoes/[id]`

### AC #5: Vista Mês — Grelha heatmap

**Given** toggle "Mês" activado
**When** o mês actual renderiza
**Then** uma grelha de calendário mensal aparece com colunas DOM a SÁB (7 colunas)
**And** cada célula de dia mostra: número do dia e até 3 dots coloridos (um por sessão, cor por tipo)
**And** se existirem mais de 3 sessões num dia, exibe "+N" em vez do 4º dot em diante
**And** o dia actual tem uma borda de 1px solid foreground na célula (não filled, para não competir com os dots)
**And** dias sem sessões têm a célula vazia (apenas o número)
**And** dias de outros meses (padding da grelha) são exibidos com opacidade reduzida (30%)

### AC #6: Vista Mês — tap numa célula abre agenda do dia

**Given** vista Mês activa
**When** utilizador toca/clica numa célula com sessões
**Then** a secção "PRÓXIMOS 7 DIAS" (que existe também na vista mês) mostra as sessões desse dia em destaque
**And** o scroll é automático para a secção de agenda se a grelha estiver acima do fold

### AC #7: Dark mode (depende de Story 1-17)

**Given** `prefers-color-scheme: dark` activo
**When** o Calendário renderiza
**Then** os blocos de sessão coloridos usam versões com 80% de opacidade no fundo escuro (ex: `rgba(37, 99, 235, 0.8)`) para não serem demasiado saturados sobre `--color-surface`
**And** a lista "Próximos 7 Dias" usa `--color-surface` como fundo dos itens
**And** os strips de dia e a grelha de mês usam `--color-hairline` para as linhas de separação
**And** contraste ≥4.5:1 para todo o texto-on-background

### AC #8: Vista Jogador em `/hoje` — não afectada

**Given** um Jogador autenticado em `/hoje`
**When** a vista carrega
**Then** o comportamento e visual existente (Story 2-7) é preservado sem alterações
**And** a Story 2-11 NÃO modifica `/hoje` — apenas `/calendario` e `/sessoes` (staff views)

### AC #9: Acessibilidade

**When** o Calendário renderiza
**Then** cada chip de dia tem `aria-label="[dia da semana], [data completa], [N sessões]"`
**And** cada bloco de sessão tem `aria-label="[tipo], [horário], [local ou sem local]"`
**And** o toggle usa `role="tablist"` / `role="tab"` com `aria-selected`
**And** a grelha de mês tem `role="grid"` com `role="gridcell"` em cada célula

### AC #10: Testes e não-regressão

**When** `npm run test --run` executa em `project-r/`
**Then** todos os testes anteriores continuam a passar
**And** ≥ 6 novos testes cobrem:
  - Mapeamento de cor por tipo de sessão (training→azul, match→vermelho, friendly→amarelo)
  - Toggle URL param `?vista=semana` / `?vista=mes`
  - Strip de dias: número de chips = 7
  - Dot de sessão aparece no dia correcto
  - Lista "Próximos 7 Dias" filtra sessões dos próximos 7 dias a partir de hoje
  - Vista mês: grelha tem número correcto de células para o mês

---

## Tasks / Subtasks

- [ ] Task 1: Criar constantes de cor por tipo de sessão (AC #2, #3, #4, #7)
  - [ ] 1.1 Criar `src/lib/constants/session-colors.ts` com `SESSION_TYPE_COLORS` — um objecto com chaves `training`, `match`, `friendly` e valores `{ bg: string, bgDark: string, label: string }`
  - [ ] 1.2 `training`: `{ bg: '#2563EB', bgDark: 'rgba(37,99,235,0.8)', label: 'Treino' }`
  - [ ] 1.3 `match`: `{ bg: '#DC2626', bgDark: 'rgba(220,38,38,0.8)', label: 'Jogo' }`
  - [ ] 1.4 `friendly`: `{ bg: '#CA8A04', bgDark: 'rgba(202,138,4,0.8)', label: 'Jogo Amigável' }`
  - [ ] 1.5 Exportar tipo `SessionColorConfig`

- [ ] Task 2: Criar `CalendarViewToggle` client component (AC #1)
  - [ ] 2.1 Criar `src/components/ui/calendar-view-toggle.tsx` com `"use client"`
  - [ ] 2.2 Lê `?vista` do URL e usa `useRouter` / `useSearchParams` para alternar
  - [ ] 2.3 Renderiza `role="tablist"` com 2 tabs: "Semana" e "Mês"
  - [ ] 2.4 Tab activa: `className="bg-foreground text-background rounded px-3 py-1 text-sm font-medium"`, inactiva: `"text-ink-3 px-3 py-1 text-sm"` 

- [ ] Task 3: Criar `DayChipStrip` client component (AC #2)
  - [ ] 3.1 Criar `src/components/ui/day-chip-strip.tsx` com `"use client"`
  - [ ] 3.2 Recebe: `weekDays: { date: Date; sessions: Session[] }[]`, `selectedDate: Date`, `onSelectDay: (date: Date) => void`
  - [ ] 3.3 Cada chip: abreviatura do dia (`"SEX"`) + número (`"11"`); se `isToday` → pill `bg-foreground text-background rounded-full`; dot colorido abaixo se há sessões (cor do primeiro tipo)
  - [ ] 3.4 `aria-label` = `"[DiaDaSemana], [DD de MMM], [N sessões]"`; `aria-current="true"` no seleccionado
  - [ ] 3.5 Scroll horizontal se 7 chips não cabem em viewport estreito

- [ ] Task 4: Criar `SessionBlock` component (AC #3, #7)
  - [ ] 4.1 Criar `src/components/ui/session-block.tsx` — client component (tem estado de dark mode via CSS)
  - [ ] 4.2 Recebe `session: Session`
  - [ ] 4.3 Fundo colorido via `style={{ backgroundColor: config.bg }}` — **NOTA:** usar inline style porque as cores não são tokens Tailwind estáticos (são hex dinâmicos)
  - [ ] 4.4 Mostra: label de tipo, horário `HH:mm` (de `session.scheduled_at`), duração `"${session.duration_min} min"`, local (se `session.location` existir)
  - [ ] 4.5 Texto branco `text-white` sempre (contraste validado ≥4.5:1 sobre as 3 cores de fundo)
  - [ ] 4.6 Sessões canceladas: `opacity-50` + label adicional "Cancelada"
  - [ ] 4.7 Preserva navegação `href="/sessoes/[id]"` via `<Link>` (comportamento existente)
  - [ ] 4.8 **Não modificar `SessionCard` existente** — mantê-lo para outros contextos (lista /sessoes do analista)

- [ ] Task 5: Criar `NextSevenDaysList` component (AC #4)
  - [ ] 5.1 Criar `src/components/ui/next-seven-days-list.tsx` — server-safe (sem state)
  - [ ] 5.2 Recebe `sessions: Session[]` (já filtradas para os próximos 7 dias)
  - [ ] 5.3 Header: `<Eyebrow>Próximos 7 Dias</Eyebrow>` (importar de `@/components/ui/eyebrow` — Story 1-17)
  - [ ] 5.4 Cada item: `border-l-4` na cor do tipo (via inline style `borderLeftColor: config.bg`), fundo `bg-surface`, padding `p-3`, mostra data (com "Hoje" se for hoje), hora, label tipo, local
  - [ ] 5.5 Clicável → `<Link href="/sessoes/[id]">`

- [ ] Task 6: Criar `MonthGrid` client component (AC #5, #6)
  - [ ] 6.1 Criar `src/components/ui/month-grid.tsx` com `"use client"`
  - [ ] 6.2 Recebe `sessions: Session[]`, `month: Date`, `onSelectDay: (date: Date) => void`
  - [ ] 6.3 Calcular células: primeiro dia do mês → dia da semana → padding com dias do mês anterior; preencher até completar semanas
  - [ ] 6.4 Cada célula `role="gridcell"`: número do dia, dots (círculos 6px, cor por tipo), "+N" se > 3 sessões
  - [ ] 6.5 Dia actual: `ring-1 ring-foreground ring-inset` (não filled)
  - [ ] 6.6 Dias de outros meses: `opacity-30`
  - [ ] 6.7 Tap numa célula: chama `onSelectDay` com a data correspondente
  - [ ] 6.8 Header da grelha: "DOM | SEG | TER | QUA | QUI | SEX | SÁB" em `font-mono text-[9px] uppercase text-ink-3`

- [ ] Task 7: Refactorizar `CalendarioPage` para orquestrar as novas views (AC #1–#7)
  - [ ] 7.1 `src/app/(staff)/calendario/page.tsx` — estender `searchParams` para receber `vista` além do `cumulativo` já existente:
    ```tsx
    searchParams?: Promise<{ cumulativo?: string; vista?: string }>
    ```
  - [ ] 7.2 Extrair lógica de dados para função auxiliar; manter `getSessionsForClub` e `getCurrentSeason` como estão
  - [ ] 7.3 Adicionar imports de date-fns ainda não presentes (os existentes são `format, startOfWeek, endOfWeek, isWithinInterval, startOfDay, endOfDay`):
    ```ts
    import { addDays, startOfMonth, endOfMonth } from "date-fns";
    ```
  - [ ] 7.4 Calcular dados para ambas as views no Server Component:
    - `weekSessions`: sessões da semana actual (para vista semana)
    - `next7Days`: sessões entre hoje e hoje+7 (para a lista de ambas as views)
    - `monthSessions`: sessões do mês actual (para vista mês)
  - [ ] 7.5 Colocar `CalendarViewToggle` **na mesma linha que `SeasonToggle`** (o `StickyHeader` actual só tem `title`, `meta`, `backHref` — NÃO tem `action` prop):
    ```tsx
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <SeasonToggle isCumulative={isCumulative} />
      <CalendarViewToggle />  {/* adicionar aqui */}
      {isCoach && <Button>Nova sessão</Button>}
    </div>
    ```
  - [ ] 7.6 Condicionar view baseado em `params?.vista`:
    - `"semana"` (default): `DayChipStrip` + `SessionBlock` para o dia seleccionado + `NextSevenDaysList`
    - `"mes"`: `MonthGrid` + `NextSevenDaysList`
  - [ ] 7.7 O `DayChipStrip` e a selecção do dia são Client Components; o restante pode ser Server Component com os dados pre-calculados
  - [ ] 7.8 **Preservar comportamento existente:** `SeasonToggle` (cumulativo), `EmptyState`, navegação para `/sessoes/[id]`, botão "Nova sessão" para coach
  - [ ] 7.9 **Não modificar** `/sessoes` (analista) nem `/hoje` (jogador) — apenas `/calendario`

- [ ] Task 8: Testes (AC #10)
  - [ ] 8.1 Criar `src/components/ui/session-block.test.tsx`:
    - Cor de fundo correcta para `training` → `#2563EB`
    - Cor de fundo correcta para `match` → `#DC2626`
    - Cor de fundo correcta para `friendly` → `#CA8A04`
    - Sessão cancelada tem `opacity-50`
  - [ ] 8.2 Criar `src/components/ui/day-chip-strip.test.tsx`:
    - Renderiza sempre 7 chips
    - Chip do dia actual tem `aria-current="true"`
  - [ ] 8.3 Criar `src/components/ui/next-seven-days-list.test.tsx`:
    - Só mostra sessões entre hoje e hoje+7
    - Sessão de hoje mostra "Hoje"
  - [ ] 8.4 `npm run test --run` — ≥ 6 novos testes + todos os anteriores passam

- [ ] Task 9: Build e verificação final
  - [ ] 9.1 `npm run typecheck` — zero erros
  - [ ] 9.2 `npm run lint` — zero erros
  - [ ] 9.3 `npm run build` — build sem erros
  - [ ] 9.4 Verificar visualmente no browser:
    - Vista Semana: strip de dias, blocos coloridos, "Próximos 7 Dias"
    - Vista Mês: grelha com dots coloridos, tap numa célula actualiza a lista
    - Toggle URL: copiar URL com `?vista=mes` e abrir em nova tab preserva a vista

---

## Dev Notes

### Inventário de Ficheiros a Modificar/Criar

| Ficheiro | Tipo | Mudança |
|---------|------|---------|
| `src/lib/constants/session-colors.ts` | NOVO | Constantes de cor por tipo |
| `src/components/ui/calendar-view-toggle.tsx` | NOVO | Toggle Semana/Mês |
| `src/components/ui/day-chip-strip.tsx` | NOVO | Strip de chips de dia |
| `src/components/ui/session-block.tsx` | NOVO | Bloco colorido por tipo |
| `src/components/ui/next-seven-days-list.tsx` | NOVO | Lista "Próximos 7 Dias" |
| `src/components/ui/month-grid.tsx` | NOVO | Grelha de mês heatmap |
| `src/app/(staff)/calendario/page.tsx` | MODIFICAR | Orquestração das novas views |
| `src/components/ui/session-block.test.tsx` | NOVO | Testes |
| `src/components/ui/day-chip-strip.test.tsx` | NOVO | Testes |
| `src/components/ui/next-seven-days-list.test.tsx` | NOVO | Testes |

**NÃO modificar:**
- `src/components/ui/session-card.tsx` — mantido para `/sessoes` (analista)
- `src/app/(staff)/sessoes/page.tsx` — não é o alvo desta story
- `src/app/(player)/hoje/page.tsx` — não é o alvo desta story
- `src/lib/schemas/sessions.ts` — sem alterações ao schema

---

### Estado Actual dos Ficheiros a Modificar

#### `src/app/(staff)/calendario/page.tsx` — ESTADO ACTUAL

**Imports actuais (relevantes):**
```tsx
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { pt } from "date-fns/locale";
import type { Session } from "@/lib/schemas/sessions";
// Componentes: StickyHeader, SeasonToggle, EmptyState, SessionCard, Button
```

**`searchParams` actual:**
```tsx
searchParams?: Promise<{ cumulativo?: string }>
```
→ Adicionar `vista?: string` sem remover `cumulativo`.

**Função auxiliar existente:** `groupSessionsByWeek()` pode ser mantida ou removida conforme o refactor. As novas views não a usam (substituem-na por lógica de semana/mês).

**`StickyHeader` interface actual:**
```tsx
interface StickyHeaderProps {
  title: string;
  meta?: string;
  backHref?: string;
}
```
**NÃO tem `action` prop.** O `CalendarViewToggle` vai na área de conteúdo abaixo do header, na mesma linha do `SeasonToggle`.

#### `src/lib/schemas/sessions.ts` — Tipo `Session` (campos relevantes)

```ts
export type Session = {
  id: string;
  type: SessionType;           // "training" | "match" | "friendly"
  scheduled_at: string;        // ISO date string
  duration_min: number;        // ← é duration_min, NÃO duration_minutes
  location: string | null;
  status: SessionStatus;       // "scheduled" | "cancelled" | "completed"
  // ...outros campos
};
```

---

### Cores por Tipo — Decisão de Design

Os tokens Tailwind `signal-alert`, `signal-caution`, `signal-info` existentes têm os valores correctos para os backgrounds dos blocos, mas as versões dark requerem opacidade. Por isso, usar **inline styles** com os hex/rgba directamente em vez de classes Tailwind — as cores são fixas por tipo e não variam com o tema (apenas a opacidade/saturação em dark).

```ts
// src/lib/constants/session-colors.ts
import type { SessionType } from "@/lib/schemas/sessions"

export interface SessionColorConfig {
  bg: string        // usado como background do bloco (light)
  bgDark: string    // idem em dark mode (rgba com opacidade)
  label: string     // label PT-PT
}

export const SESSION_TYPE_COLORS: Record<SessionType, SessionColorConfig> = {
  training: { bg: "#2563EB", bgDark: "rgba(37,99,235,0.8)", label: "Treino" },
  match:    { bg: "#DC2626", bgDark: "rgba(220,38,38,0.8)",  label: "Jogo"   },
  friendly: { bg: "#CA8A04", bgDark: "rgba(202,138,4,0.8)",  label: "Amigável" },
}
```

---

### Detecção dark mode nos Client Components

Para aplicar `bgDark` em client components, usar:

```tsx
const isDark = typeof window !== "undefined"
  && window.matchMedia("(prefers-color-scheme: dark)").matches

const bgColor = isDark ? config.bgDark : config.bg
```

Ou usar um hook simples:

```tsx
// src/hooks/useDarkMode.ts
"use client"
import { useEffect, useState } from "react"

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setIsDark(mq.matches)
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener("change", h)
    return () => mq.removeEventListener("change", h)
  }, [])
  return isDark
}
```

---

### Estrutura de dados para os 3 views

```tsx
// No CalendarioPage (Server Component):

// Semana actual
const today = new Date()
const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // segunda
const weekEnd = endOfWeek(today, { weekStartsOn: 1 })     // domingo

// Para DayChipStrip: sessions da semana actual
const weekSessions = sessions.filter(s => {
  const d = new Date(s.scheduled_at)
  return d >= weekStart && d <= weekEnd
})

// Para NextSevenDaysList: sessions dos próximos 7 dias (inclusive hoje)
const next7End = addDays(today, 7)
const next7Sessions = sessions.filter(s => {
  const d = new Date(s.scheduled_at)
  return d >= startOfDay(today) && d <= endOfDay(next7End)
}).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

// Para MonthGrid: sessions do mês actual
const monthStart = startOfMonth(today)
const monthEnd = endOfMonth(today)
const monthSessions = sessions.filter(s => {
  const d = new Date(s.scheduled_at)
  return d >= monthStart && d <= monthEnd
})
```

---

### Preservar comportamento existente

O `CalendarioPage` actual tem:
1. `SeasonToggle` — **manter** (cumulativo / época actual)
2. `getSessionsForClub()` / `getCurrentSeason()` — **manter** sem alteração
3. Botão "Nova sessão" para coach — **manter**
4. `EmptyState` quando não há sessões — **manter**
5. Navegação para `/sessoes/[id]` — **manter** em todos os novos componentes

A refactorização é aditiva: adicionar as novas views sem remover o que existe. O `SessionCard` continua a ser usado em `/sessoes` (analista) — não modificar.

---

### Referência ao Mockup

Consultar `docs/ux-design/Variação A Semana (timeline + agenda).png` e `Variação B Mês (grid heatmap + agenda).png` para:
- Layout exacto do strip de dias (chips com abreviatura + número + dot)
- Formato dos blocos de sessão (informação exibida, tamanho do texto)
- Formato da grelha de mês (proporções das células, alinhamento)
- Formato da lista "Próximos 7 Dias" (borda esquerda colorida, espaçamento)

Os mockups mostram também "Fisioterapia" como tipo de sessão — este tipo **não existe no schema actual** e NÃO deve ser adicionado nesta story. Usar apenas `training`, `match`, `friendly`.

---

### Dependência de Story 1-17

Esta story usa os seguintes tokens novos introduzidos em Story 1-17:
- `--color-surface` (bg dos itens da lista)
- `--color-hairline` (separadores)
- `--color-ink-3` (texto terciário nos headers da grelha)
- Componente `Eyebrow` (header "Próximos 7 Dias")

**Se Story 1-17 não estiver done**, estes tokens não existem e os testes de CSS vão falhar. Garantir que 1-17 está done antes de iniciar esta story.

---

## Critérios de Conclusão

- [ ] Build passa (`npm run build` em `project-r/`)
- [ ] Typecheck passa (`npm run typecheck`)
- [ ] Lint passa sem novos erros (`npm run lint`)
- [ ] Todos os testes passam incluindo ≥ 6 novos (`npm run test --run`)
- [ ] Vista Semana: strip de 7 dias + blocos coloridos + lista "Próximos 7 Dias" visíveis no browser
- [ ] Vista Mês: grelha com dots coloridos + tap numa célula actualiza a secção de agenda
- [ ] Toggle `?vista=semana` / `?vista=mes` persiste no URL
- [ ] Dark mode: cores ligeiramente mais escuras/transparentes mas ainda identificáveis
- [ ] `/sessoes` (analista) e `/hoje` (jogador) não foram modificados
- [ ] `SessionCard` original está intacto
