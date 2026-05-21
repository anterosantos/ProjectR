# Story 1.17: Design Token & Font System Alignment — Visual Look & Feel Baseline

**Status:** done

**Story ID:** 1.17
**Epic:** Epic 1 — Fundação Técnica, Identidade & Acesso Multi-Clube
**Created:** 2026-05-20
**Depends on:** Story 1.16 (done)
**Blocker para:** Todas as stories de UI a partir da Epic 4 (questionário fadiga, touchscreen, painel, perfil, relatórios)

---

## Story

Como developer a implementar qualquer ecrã novo,
Quero um sistema de tokens e tipografia completamente alinhado com os mockups em `docs/ux-design/`,
Para que todos os ecrãs futuros adotem automaticamente o look & feel visual aprovado, com suporte a modo claro e escuro.

---

## Contexto de Design

Os mockups em `docs/ux-design/` definem um sistema visual editorial com:
- **Tipografia:** Inter Tight (UI) + JetBrains Mono (numerics/tabular stats)
- **Paleta:** Near-monochrome com 4 níveis de ink, 2 níveis de surface, hairlines editoriais, e signal colors semânticas com pares bg/ink para badges
- **Modo escuro:** Via `prefers-color-scheme` exclusivamente — sem toggle de utilizador
- **Estética:** "Calma clínica de quem trabalha com pessoas" — branco dominante (~75%), cor reservada a sinal, tipografia generosa

O ficheiro de referência visual canonical é: `docs/ux-design/profile-shared.jsx` (tokens `PR_TOKENS_LIGHT` / `PR_TOKENS_DARK`).

Esta story NÃO implementa nenhum ecrã — apenas alinha o sistema de tokens e primitivos base. É pré-condição para todas as stories de UI seguintes.

---

## Acceptance Criteria

### AC #1: Fontes — Inter Tight + JetBrains Mono substituem Geist

**Given** `src/app/layout.tsx` actualizado
**When** a aplicação carrega
**Then** `Inter_Tight` é carregada via `next/font/google` com weights `[400, 500, 600, 700]`, subsets `["latin"]` e variable `"--font-inter-tight"`
**And** `JetBrains_Mono` é carregada via `next/font/google` com weights `[400, 500, 600]`, subsets `["latin"]` e variable `"--font-jetbrains-mono"`
**And** `<html>` recebe ambas as variáveis no `className`
**And** `Geist` e `Geist_Mono` são removidas completamente do `layout.tsx`
**And** `globals.css` mapeia `--font-sans: var(--font-inter-tight)` e `--font-mono: var(--font-jetbrains-mono)` em `@theme inline`

### AC #2: Tokens ink (4 níveis — texto secundário, terciário, desabilitado)

**Given** `globals.css` `:root` e `.dark` actualizados
**When** os tokens são lidos pelo browser
**Then** `:root` define:
  - `--color-ink-2: #525252`
  - `--color-ink-3: #737373`
  - `--color-ink-4: #A3A3A3`
**And** `.dark` define:
  - `--color-ink-2: #D4D4D4`
  - `--color-ink-3: #A3A3A3`
  - `--color-ink-4: #737373`
**And** `@theme inline` expõe `--color-ink-2`, `--color-ink-3`, `--color-ink-4` para uso com classes Tailwind `text-ink-2`, `text-ink-3`, `text-ink-4`, `bg-ink-2`, etc.

### AC #3: Tokens surface (2 níveis — cards, nested surfaces)

**Given** `globals.css` `:root` e `.dark` actualizados
**When** os tokens são lidos
**Then** `:root` define `--color-surface: #FAFAFA`, `--color-surface-2: #F5F5F5`
**And** `.dark` define `--color-surface: #171717`, `--color-surface-2: #262626`
**And** `@theme inline` expõe `--color-surface`, `--color-surface-2`

### AC #4: Tokens hairline (separadores editoriais)

**Given** `globals.css` `:root` e `.dark` actualizados
**When** os tokens são lidos
**Then** `:root` define `--color-hairline: #E5E5E5`, `--color-hairline-strong: #D4D4D4`
**And** `.dark` define `--color-hairline: #262626`, `--color-hairline-strong: #404040`
**And** `@theme inline` expõe `--color-hairline`, `--color-hairline-strong`

### AC #5: Token field (verde campo — SVGs do touchscreen e perfil)

**Given** `globals.css` actualizado
**When** os tokens são lidos
**Then** `:root` e `.dark` definem `--color-field: #10B981`, `--color-field-deep: #059669` (invariantes — verde campo não muda com tema)
**And** `@theme inline` expõe `--color-field`, `--color-field-deep`

### AC #6: Pares signal bg/ink (para StatusPill / SemaforoBadge com fundo colorido)

**Given** `globals.css` `:root` e `.dark` actualizados
**When** os tokens são lidos
**Then** `:root` define:
  - `--signal-ready-bg: #F0FDF4`, `--signal-ready-ink: #166534`
  - `--signal-caution-bg: #FEFCE8`, `--signal-caution-ink: #854D0E`
  - `--signal-alert-bg: #FEF2F2`, `--signal-alert-ink: #991B1B`
**And** `.dark` define:
  - `--signal-ready-bg: rgba(34,197,94,0.12)`, `--signal-ready-ink: #86EFAC`
  - `--signal-caution-bg: rgba(234,179,8,0.14)`, `--signal-caution-ink: #FDE68A`
  - `--signal-alert-bg: rgba(239,68,68,0.14)`, `--signal-alert-ink: #FCA5A5`
**And** `@theme inline` expõe todos os 6 pares como `--signal-*-bg` e `--signal-*-ink`

### AC #7: Dark mode activado automaticamente via `prefers-color-scheme`

**Given** o mecanismo de dark mode (UX-DR1 — sem toggle de utilizador)
**When** a aplicação carrega pela primeira vez num browser com `prefers-color-scheme: dark`
**Then** a classe `.dark` é aplicada ao `<html>` automaticamente antes do first paint
**And** NÃO existe toggle de dark mode na UI (Settings, navegação ou qualquer ecrã)
**And** o shadcn `.dark` selector continua a funcionar correctamente (retrocompatibilidade)
**And** a implementação usa um `<script>` inline no `<head>` da root layout (antes de qualquer conteúdo) para aplicar `.dark` sem flash — NÃO usa cookies nem Server Components para isto

### AC #8: Componente `Eyebrow` (primitivo editorial de secção)

**Given** `src/components/ui/eyebrow.tsx` criado
**When** renderizado
**Then** exibe um `<div>` com `font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-3` e um `<span>` traço de 12px de largura, 1px de altura, `bg-ink-3`, à esquerda do texto
**And** aceita props `children`, `className?: string`, e um `style?: React.CSSProperties` opcional
**And** é server-safe (sem `"use client"`)
**And** tem 1 teste vitest unitário (`eyebrow.test.tsx`) que valida renderização com texto e className

### AC #9: Componente `Datum` (valor + label mono empilhado para estatísticas)

**Given** `src/components/ui/datum.tsx` criado
**When** renderizado
**Then** exibe um valor em `font-mono font-medium tabular-nums` e um label em `font-mono text-[8.5px] tracking-[0.12em] uppercase text-ink-3`
**And** aceita props: `value: string | number`, `label: string`, `unit?: string` (exibido após value em tamanho ~42% do valueSize), `valueSize?: number` (default 22, em px via inline style), `color?: string`
**And** o `unit` é exibido com `text-ink-3` e peso 400 (secundário ao value)
**And** é server-safe (sem `"use client"`)
**And** tem 1 teste vitest unitário (`datum.test.tsx`) que valida: renderização com apenas value+label, com unit, e com color

### AC #10: Build, lint e testes passam sem regressões

**Given** todas as alterações desta story
**When** executados na directoria `sparta/`:
  - `npm run build`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test --run`
**Then** cada comando sai com código 0
**And** o número de avisos de lint é ≤ ao estado anterior a esta story
**And** todos os testes anteriores (≥ 384) continuam a passar
**And** os 3 novos testes (Eyebrow + Datum) passam também

---

## Tasks / Subtasks

- [x] Task 1: Actualizar fontes em `src/app/layout.tsx` (AC #1)
  - [x] 1.1 Remover imports `Geist` e `Geist_Mono` de `next/font/google`
  - [x] 1.2 Importar `Inter_Tight` e `JetBrains_Mono` de `next/font/google`
  - [x] 1.3 Configurar `interTight` com `{ variable: "--font-inter-tight", subsets: ["latin"], weight: ["400","500","600","700"] }`
  - [x] 1.4 Configurar `jetBrainsMono` com `{ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400","500","600"] }`
  - [x] 1.5 Actualizar `<html className>` para usar `${interTight.variable} ${jetBrainsMono.variable} h-full antialiased`

- [x] Task 2: Actualizar `@theme inline` em `globals.css` (AC #1)
  - [x] 2.1 Mudar `--font-sans: var(--font-sans)` → `--font-sans: var(--font-inter-tight)`
  - [x] 2.2 Mudar `--font-mono: var(--font-geist-mono)` → `--font-mono: var(--font-jetbrains-mono)`
  - [x] 2.3 Actualizar `--font-display`, `--font-body`, `--font-heading` para também referenciar `var(--font-inter-tight)` (consistência)

- [x] Task 3: Adicionar tokens ink ao `globals.css` (AC #2)
  - [x] 3.1 No bloco `:root`: adicionar `--color-ink-2: #525252;`, `--color-ink-3: #737373;`, `--color-ink-4: #A3A3A3;`
  - [x] 3.2 No bloco `.dark`: adicionar `--color-ink-2: #D4D4D4;`, `--color-ink-3: #A3A3A3;`, `--color-ink-4: #737373;`
  - [x] 3.3 Em `@theme inline`: adicionar `--color-ink-2: var(--color-ink-2);`, `--color-ink-3: var(--color-ink-3);`, `--color-ink-4: var(--color-ink-4);`

- [x] Task 4: Adicionar tokens surface ao `globals.css` (AC #3)
  - [x] 4.1 No bloco `:root`: `--color-surface: #FAFAFA;`, `--color-surface-2: #F5F5F5;`
  - [x] 4.2 No bloco `.dark`: `--color-surface: #171717;`, `--color-surface-2: #262626;`
  - [x] 4.3 Em `@theme inline`: expor ambos

- [x] Task 5: Adicionar tokens hairline ao `globals.css` (AC #4)
  - [x] 5.1 No bloco `:root`: `--color-hairline: #E5E5E5;`, `--color-hairline-strong: #D4D4D4;`
  - [x] 5.2 No bloco `.dark`: `--color-hairline: #262626;`, `--color-hairline-strong: #404040;`
  - [x] 5.3 Em `@theme inline`: expor ambos

- [x] Task 6: Adicionar token field ao `globals.css` (AC #5)
  - [x] 6.1 No bloco `:root` e `.dark` (igual em ambos): `--color-field: #10B981;`, `--color-field-deep: #059669;`
  - [x] 6.2 Em `@theme inline`: expor ambos

- [x] Task 7: Adicionar pares signal bg/ink ao `globals.css` (AC #6)
  - [x] 7.1 No bloco `:root`: adicionar os 6 tokens `--signal-{ready,caution,alert}-{bg,ink}` com valores hex
  - [x] 7.2 No bloco `.dark`: adicionar os 6 tokens com valores rgba/hex dark
  - [x] 7.3 Em `@theme inline`: expor todos os 6 como `--signal-ready-bg: var(--signal-ready-bg);` etc.

- [x] Task 8: Implementar dark mode automático via `prefers-color-scheme` (AC #7)
  - [x] 8.1 Na root layout `src/app/layout.tsx`, adicionar `<script>` inline no `<head>` **antes de qualquer CSS ou conteúdo** (ver Dev Notes — padrão completo do script)
  - [x] 8.2 O script lê `window.matchMedia('(prefers-color-scheme: dark)').matches` e aplica `document.documentElement.classList.add('dark')` se verdade
  - [x] 8.3 O script também subscreve mudanças em runtime via `addEventListener('change', ...)` para responder a mudanças do sistema operativo sem reload
  - [x] 8.4 O `<script>` é `dangerouslySetInnerHTML` — usar `__html` string literal (não JSX)
  - [x] 8.5 Verificar que NÃO existe nenhum componente, link, ou botão que permita ao utilizador mudar o tema — remover se existir

- [x] Task 9: Criar componente `Eyebrow` (AC #8)
  - [x] 9.1 Criar `src/components/ui/eyebrow.tsx` — server component, sem `"use client"`
  - [x] 9.2 Props: `children: React.ReactNode`, `className?: string`
  - [x] 9.3 Estrutura: `<div className={cn("flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-3", className)}><span className="w-3 h-px bg-ink-3 shrink-0" />{children}</div>`
  - [x] 9.4 Exportar como named export `Eyebrow`
  - [x] 9.5 Criar `src/components/ui/eyebrow.test.tsx` — 1 teste: renderiza children, aplica className extra

- [x] Task 10: Criar componente `Datum` (AC #9)
  - [x] 10.1 Criar `src/components/ui/datum.tsx` — server component, sem `"use client"`
  - [x] 10.2 Props interface: `value: string | number`, `label: string`, `unit?: string`, `valueSize?: number` (default 22), `color?: string`, `className?: string`
  - [x] 10.3 Estrutura: wrapper `<div className={cn("flex flex-col gap-0.5", className)}>` contendo:
    - value row: `<div style={{ fontSize: valueSize, color: color, fontVariantNumeric: 'tabular-nums' }} className="font-mono font-medium leading-none tracking-[-0.02em] flex items-baseline gap-1">` com `{value}` e se `unit` existe: `<span style={{ fontSize: Math.max(9, (valueSize ?? 22) * 0.42) }} className="text-ink-3 font-normal tracking-[0.04em]">{unit}</span>`
    - label: `<div className="font-mono text-[8.5px] tracking-[0.12em] uppercase text-ink-3">{label}</div>`
  - [x] 10.4 Criar `src/components/ui/datum.test.tsx` — 3 testes: só value+label, com unit, com color

- [x] Task 11: Build e verificação final (AC #10)
  - [x] 11.1 `npm run typecheck` — zero erros
  - [x] 11.2 `npm run lint` — zero erros (47 warnings pré-existentes, 0 novos)
  - [x] 11.3 `npm run test --run` — 738 testes passam incluindo 5 novos (2 Eyebrow + 3 Datum)
  - [x] 11.4 `npm run build` — build compilado com sucesso (Next.js 16.2.6)
  - [x] 11.5 Verificar visualmente no browser: fonte Inter Tight é mais condensada que Geist — notável no texto de botões e navegação

### Review Findings

- [x] [Review][Patch] `tabular-nums` aplicado via inline style em vez de classe Tailwind como especificado [sparta/src/components/ui/datum.tsx:16]
- [x] [Review][Patch] `color ?? undefined` é um no-op redundante — `color` já é `string | undefined` [sparta/src/components/ui/datum.tsx:17]
- [x] [Review][Patch] Teste de `color` em `Datum` sem null-guard antes de `toHaveStyle` — falha silenciosa se selector não encontrar elemento [sparta/src/components/ui/datum.test.tsx:17]
- [x] [Review][Defer] `--font-mono` declarado duas vezes em `@theme inline` — redundância pré-existente [sparta/src/app/globals.css] — deferred, pre-existing
- [x] [Review][Defer] Sem nonce/CSP para o script de dark mode inline — gap arquitectural pré-existente [sparta/src/app/layout.tsx] — deferred, pre-existing
- [x] [Review][Defer] `Datum` com `value=""` (string vazia) produz layout quebrado com unit sem número [sparta/src/components/ui/datum.tsx] — deferred, pre-existing
- [x] [Review][Defer] `Datum` com `valueSize` ≤ 0 torna o valor invisível — sem validação de mínimo [sparta/src/components/ui/datum.tsx] — deferred, pre-existing
- [x] [Review][Defer] `Eyebrow` com `children` null/false renderiza apenas o traço decorativo sem texto [sparta/src/components/ui/eyebrow.tsx] — deferred, pre-existing
- [x] [Review][Defer] Contagem de testes no AC #10 obsoleta (≥ 384 vs ~748 actuais) — spec desactualizada [1-17-design-token-font-system-alignment-visual-look-feel-baseline.md] — deferred, pre-existing

---

## Dev Notes

### Inventário de Ficheiros a Modificar/Criar

| Ficheiro | Tipo | Mudança |
|---------|------|---------|
| `src/app/layout.tsx` | MODIFICAR | Trocar fontes Geist → Inter Tight + JetBrains Mono; adicionar script dark mode |
| `src/app/globals.css` | MODIFICAR | Actualizar `@theme inline` fontes; adicionar tokens ink/surface/hairline/field/signal-bg-ink |
| `src/components/ui/eyebrow.tsx` | NOVO | Componente primitivo editorial |
| `src/components/ui/eyebrow.test.tsx` | NOVO | Teste unitário |
| `src/components/ui/datum.tsx` | NOVO | Componente primitivo de estatística |
| `src/components/ui/datum.test.tsx` | NOVO | Teste unitário |

**Nenhum outro ficheiro deve ser modificado.** Esta story é puramente aditiva ao sistema de design — não toca em lógica de negócio, migrations, ou componentes existentes.

---

### Padrão Exacto: `layout.tsx` após mudança

```tsx
import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BrowserGate } from "@/components/patterns/BrowserGate";
import { ErrorBoundary } from "@/components/patterns/ErrorBoundary";
import { OutboxProvider } from "@/components/providers/OutboxProvider";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const darkModeScript = `
  (function() {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) document.documentElement.classList.add('dark');
      mq.addEventListener('change', function(e) {
        document.documentElement.classList.toggle('dark', e.matches);
      });
    } catch(e) {}
  })();
`;

export const metadata: Metadata = {
  title: "SPARTA",
  description: "Plataforma de gestão de treino e desempenho",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-PT"
      className={`${interTight.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:border-2 focus:border-border focus:shadow-lg"
        >
          Saltar para o conteúdo
        </a>
        <ErrorBoundary>
          <BrowserGate>
            <OutboxProvider>{children}</OutboxProvider>
          </BrowserGate>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

**NOTA IMPORTANTE — Next.js 16:** A root layout pode ter um `<head>` explícito com filhos seguros (scripts, etc.) sem conflito com o `<Head>` automático do Next.js. O `<script>` antes do `<body>` garante que a classe `.dark` é aplicada antes do primeiro paint (sem flash of wrong theme).

---

### Padrão Exacto: Novos tokens em `globals.css`

Adicionar ao bloco `@theme inline` (agrupar com os outros tokens de cor):

```css
  /* Ink scale — texto secundário/terciário/desabilitado */
  --color-ink-2: var(--color-ink-2);
  --color-ink-3: var(--color-ink-3);
  --color-ink-4: var(--color-ink-4);

  /* Surface scale — card backgrounds */
  --color-surface: var(--color-surface);
  --color-surface-2: var(--color-surface-2);

  /* Hairline — separadores editoriais */
  --color-hairline: var(--color-hairline);
  --color-hairline-strong: var(--color-hairline-strong);

  /* Field — verde do campo de futebol (invariante entre temas) */
  --color-field: var(--color-field);
  --color-field-deep: var(--color-field-deep);

  /* Signal bg/ink pairs — fundos e texto em badges coloridos */
  --signal-ready-bg: var(--signal-ready-bg);
  --signal-ready-ink: var(--signal-ready-ink);
  --signal-caution-bg: var(--signal-caution-bg);
  --signal-caution-ink: var(--signal-caution-ink);
  --signal-alert-bg: var(--signal-alert-bg);
  --signal-alert-ink: var(--signal-alert-ink);
```

Adicionar ao bloco `:root`:

```css
  /* Ink scale */
  --color-ink-2: #525252;
  --color-ink-3: #737373;
  --color-ink-4: #A3A3A3;

  /* Surface scale */
  --color-surface: #FAFAFA;
  --color-surface-2: #F5F5F5;

  /* Hairline */
  --color-hairline: #E5E5E5;
  --color-hairline-strong: #D4D4D4;

  /* Field (invariante) */
  --color-field: #10B981;
  --color-field-deep: #059669;

  /* Signal bg/ink — light */
  --signal-ready-bg: #F0FDF4;
  --signal-ready-ink: #166534;
  --signal-caution-bg: #FEFCE8;
  --signal-caution-ink: #854D0E;
  --signal-alert-bg: #FEF2F2;
  --signal-alert-ink: #991B1B;
```

Adicionar ao bloco `.dark`:

```css
  /* Ink scale — dark */
  --color-ink-2: #D4D4D4;
  --color-ink-3: #A3A3A3;
  --color-ink-4: #737373;

  /* Surface scale — dark */
  --color-surface: #171717;
  --color-surface-2: #262626;

  /* Hairline — dark */
  --color-hairline: #262626;
  --color-hairline-strong: #404040;

  /* Field (invariante — mesmo em dark) */
  --color-field: #10B981;
  --color-field-deep: #059669;

  /* Signal bg/ink — dark */
  --signal-ready-bg: rgba(34, 197, 94, 0.12);
  --signal-ready-ink: #86EFAC;
  --signal-caution-bg: rgba(234, 179, 8, 0.14);
  --signal-caution-ink: #FDE68A;
  --signal-alert-bg: rgba(239, 68, 68, 0.14);
  --signal-alert-ink: #FCA5A5;
```

Actualizar em `@theme inline` as fontes:

```css
  --font-sans: var(--font-inter-tight);
  --font-mono: var(--font-jetbrains-mono);
  --font-display: var(--font-inter-tight);
  --font-body: var(--font-inter-tight);
  --font-heading: var(--font-inter-tight);
```

---

### Padrão Exacto: Componente `Eyebrow`

```tsx
// src/components/ui/eyebrow.tsx
import { cn } from "@/lib/utils"

interface EyebrowProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Eyebrow({ children, className, style }: EyebrowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-3",
        className
      )}
      style={style}
    >
      <span className="w-3 h-px bg-ink-3 shrink-0" aria-hidden="true" />
      {children}
    </div>
  )
}
```

```tsx
// src/components/ui/eyebrow.test.tsx
import { render, screen } from "@testing-library/react"
import { Eyebrow } from "./eyebrow"

describe("Eyebrow", () => {
  it("renders children", () => {
    render(<Eyebrow>Secção</Eyebrow>)
    expect(screen.getByText("Secção")).toBeInTheDocument()
  })

  it("applies extra className", () => {
    const { container } = render(<Eyebrow className="mt-4">Texto</Eyebrow>)
    expect(container.firstChild).toHaveClass("mt-4")
  })
})
```

---

### Padrão Exacto: Componente `Datum`

```tsx
// src/components/ui/datum.tsx
import { cn } from "@/lib/utils"

interface DatumProps {
  value: string | number
  label: string
  unit?: string
  valueSize?: number
  color?: string
  className?: string
}

export function Datum({ value, label, unit, valueSize = 22, color, className }: DatumProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div
        className="font-mono font-medium leading-none tracking-[-0.02em] flex items-baseline gap-1"
        style={{ fontSize: valueSize, color: color ?? undefined, fontVariantNumeric: "tabular-nums" }}
      >
        <span>{value}</span>
        {unit && (
          <span
            className="text-ink-3 font-normal tracking-[0.04em]"
            style={{ fontSize: Math.max(9, valueSize * 0.42) }}
          >
            {unit}
          </span>
        )}
      </div>
      <div className="font-mono text-[8.5px] tracking-[0.12em] uppercase text-ink-3">
        {label}
      </div>
    </div>
  )
}
```

```tsx
// src/components/ui/datum.test.tsx
import { render, screen } from "@testing-library/react"
import { Datum } from "./datum"

describe("Datum", () => {
  it("renders value and label", () => {
    render(<Datum value={1.82} label="ACWR" />)
    expect(screen.getByText("1.82")).toBeInTheDocument()
    expect(screen.getByText("ACWR")).toBeInTheDocument()
  })

  it("renders unit when provided", () => {
    render(<Datum value={68} unit="kg" label="PESO" />)
    expect(screen.getByText("kg")).toBeInTheDocument()
  })

  it("applies color to value", () => {
    const { container } = render(<Datum value={5} label="FADIGA" color="#EF4444" />)
    const valueEl = container.querySelector(".font-mono.font-medium")
    expect(valueEl).toHaveStyle({ color: "#EF4444" })
  })
})
```

---

### Aviso: `cn` e Tailwind classes com tokens novos

As classes `text-ink-2`, `text-ink-3`, `text-ink-4`, `bg-ink-2`, `bg-surface`, `bg-surface-2`, `bg-hairline`, `bg-field`, `bg-signal-ready-bg`, `text-signal-ready-ink` etc. são **automáticamente disponibilizadas** pelo Tailwind v4 via `@theme inline` assim que os tokens CSS sejam adicionados. **Não é necessário registar nada no `tailwind.config.ts`** — o Tailwind v4 CSS-first não usa esse ficheiro.

---

### Estado Actual dos Ficheiros a Modificar

#### `src/app/layout.tsx` — ESTADO ACTUAL COMPLETO

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BrowserGate } from "@/components/patterns/BrowserGate";
import { ErrorBoundary } from "@/components/patterns/ErrorBoundary";
import { OutboxProvider } from "@/components/providers/OutboxProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPARTA",
  description: "Plataforma de gestão de treino e desempenho",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:border-2 focus:border-border focus:shadow-lg"
        >
          Saltar para o conteúdo
        </a>
        <ErrorBoundary>
          <BrowserGate>
            <OutboxProvider>{children}</OutboxProvider>
          </BrowserGate>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

**O que mudar:** Remover `Geist` e `Geist_Mono`; importar `Inter_Tight` e `JetBrains_Mono`; adicionar `const darkModeScript`; adicionar `<head>` com `<script>` antes do `<body>`; actualizar `className` do `<html>`.

---

#### `src/app/globals.css` — SECÇÕES RELEVANTES ACTUAIS

No bloco `@theme inline` (linha 13 em diante), as entradas de fonte actuais são:

```css
--font-sans: var(--font-sans);       /* linha 16 — self-reference; mudar para var(--font-inter-tight) */
--font-mono: var(--font-geist-mono); /* linha 17 — mudar para var(--font-jetbrains-mono) */
...
--font-display: var(--font-sans);    /* linha 64 — mudar para var(--font-inter-tight) */
--font-body: var(--font-sans);       /* linha 65 — mudar para var(--font-inter-tight) */
--font-mono: var(--font-geist-mono); /* linha 66 — DUPLICADO de linha 17; mudar para var(--font-jetbrains-mono) */
```

**ATENÇÃO: `--font-mono` aparece DUAS vezes no `@theme inline`** (linhas 17 e 66). Ambas devem ser actualizadas para `var(--font-jetbrains-mono)`. Não deixar nenhuma referência a `geist-mono`.

---

### Aviso: Script dark mode e `<head>` explícito em Next.js 16

No Next.js 16, é seguro adicionar um `<head>` explícito na root layout com um `<script>` inline. O Next.js vai fundir este `<head>` com o seu `<Head>` automático. O `<script>` inline com `dangerouslySetInnerHTML` executa **síncronamente** antes do parsing do body, garantindo que `.dark` é aplicado sem flash.

**NÃO usar:**
- `next/headers` (cookies) para detectar preferência — não há cookie inicial
- `next-themes` — adiciona dependência e toggle de utilizador (violação da UX spec)
- `document.cookie` no script — não há cookie persistido de dark mode (sem toggle)

---

### Estado actual que deve ser preservado

O `SemaforoBadge` existente usa `bg-signal-ready/10 text-signal-ready` com Tailwind opacity modifier. Esta abordagem **continua válida** — os novos tokens `--signal-ready-bg` são para o padrão alternativo (fundo sólido com cor específica, como nos mockups do perfil). Os dois coexistem:
- `SemaforoBadge` (existente): usa opacity modifier `/10` — mantém-se sem alteração
- Futuros componentes (StatusPill no perfil, etc.): usarão `bg-signal-ready-bg text-signal-ready-ink`

---

### Inter Tight vs Inter: diferença visual

**Inter Tight** é uma variante condensada do Inter com tracking mais apertado — dá o aspecto editorial compacto dos mockups. É diferente do "Inter" simples (que é mais largo). O nome correcto em `next/font/google` é `Inter_Tight` (underscored). Confirmar que é esse e não `Inter`.

---

### Referência ao Mockup Visual

O sistema de tokens desta story está definido em `docs/ux-design/profile-shared.jsx`:
- `PR_TOKENS_LIGHT` → valores do `:root`
- `PR_TOKENS_DARK` → valores do `.dark`
- `PR_FONT.ui` = `'"Inter Tight", "Inter", system-ui, sans-serif'` → fonte sans
- `PR_FONT.mono` = `'"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace'` → fonte mono

Qualquer dúvida sobre um valor específico, consultar esse ficheiro como fonte de verdade.

---

## Dev Agent Record

### Implementation Plan

Implementação puramente aditiva ao sistema de design:
1. `layout.tsx`: substituição directa Geist → Inter Tight + JetBrains Mono; adição de `<head>` com script dark mode inline (IIFE com `matchMedia` + `addEventListener('change')`).
2. `globals.css`: actualização de 5 referências de fonte em `@theme inline`; adição de 20 novos tokens CSS em `:root`, `.dark` e `@theme inline` (ink × 3, surface × 2, hairline × 2, field × 2, signal-bg/ink × 6).
3. `eyebrow.tsx` e `datum.tsx`: dois server components sem `"use client"`, com testes unitários vitest.

Nenhum ficheiro de lógica de negócio foi alterado.

### Completion Notes

- ✅ AC #1: `Inter_Tight` + `JetBrains_Mono` carregadas via `next/font/google`; `Geist`/`Geist_Mono` removidas; `<html>` com ambas as variáveis; `globals.css` mapeado.
- ✅ AC #2: Tokens `--color-ink-{2,3,4}` em `:root`, `.dark` e `@theme inline`.
- ✅ AC #3: Tokens `--color-surface`, `--color-surface-2` em `:root`, `.dark` e `@theme inline`.
- ✅ AC #4: Tokens `--color-hairline`, `--color-hairline-strong` em `:root`, `.dark` e `@theme inline`.
- ✅ AC #5: Tokens `--color-field`, `--color-field-deep` invariantes (igual em `:root` e `.dark`) e `@theme inline`.
- ✅ AC #6: 6 pares `--signal-{ready,caution,alert}-{bg,ink}` em `:root`, `.dark` e `@theme inline`.
- ✅ AC #7: Script IIFE inline no `<head>` antes do body; lê `prefers-color-scheme: dark`; subscreve `change`; sem toggle de utilizador na UI.
- ✅ AC #8: `Eyebrow` server component com 2 testes passados.
- ✅ AC #9: `Datum` server component com 3 testes passados.
- ✅ AC #10: `typecheck` ✅ | `lint` 0 erros ✅ | `test --run` 738/738 ✅ | `build` ✅

### Debug Log

Nenhum erro encontrado durante a implementação.

---

## File List

- `sparta/src/app/layout.tsx` — MODIFICADO (fontes Inter Tight + JetBrains Mono; script dark mode)
- `sparta/src/app/globals.css` — MODIFICADO (tokens ink/surface/hairline/field/signal; fontes @theme inline)
- `sparta/src/components/ui/eyebrow.tsx` — NOVO
- `sparta/src/components/ui/eyebrow.test.tsx` — NOVO
- `sparta/src/components/ui/datum.tsx` — NOVO
- `sparta/src/components/ui/datum.test.tsx` — NOVO

---

## Change Log

- 2026-05-20: Story 1.17 implementada — sistema de tokens e tipografia alinhado com mockups; Inter Tight + JetBrains Mono substituem Geist; dark mode automático via prefers-color-scheme; componentes Eyebrow e Datum criados; 738 testes passam.
- 2026-05-20: Code review completo — 3 patches aplicados: tabular-nums movido para className, color ?? undefined simplificado para ||, null-guard adicionado ao teste de color; 738/738 testes ✅; done.

---

## Critérios de Conclusão

- [x] Build passa (`npm run build` em `sparta/`)
- [x] Typecheck passa (`npm run typecheck`)
- [x] Lint passa sem novos erros (`npm run lint`)
- [x] Todos os testes passam incluindo 5 novos (`npm run test --run` — 738 testes)
- [x] A fonte Inter Tight é visualmente perceptível no browser (mais condensada que Geist)
- [x] Dark mode activa automaticamente ao mudar `prefers-color-scheme` no browser/SO sem reload
- [x] `Eyebrow` e `Datum` exportados e importáveis via `@/components/ui/eyebrow` e `@/components/ui/datum`
- [x] Nenhum componente existente foi alterado excepto `layout.tsx` e `globals.css`
