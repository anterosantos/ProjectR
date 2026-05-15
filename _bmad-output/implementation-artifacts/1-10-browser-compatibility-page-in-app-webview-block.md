# Story 1.10: Browser Compatibility Page & In-App WebView Block

**Status:** ready-for-dev

**Story ID:** 1.10
**Epic:** Epic 1 — Fundação Técnica, Identidade & Acesso Multi-Clube
**Created:** 2026-05-16

---

## Story

As any user trying to access the app from an unsupported environment,
I want a clear, helpful message explaining what to do,
so that I can switch to a compatible browser instead of seeing a broken app.

---

## Acceptance Criteria

### AC #1: Browsers incompatíveis sem Service Worker — página de fallback

**Given** a user opens the app in IE 11, Opera Mini, UC Browser, or any browser without Service Worker support
**When** the page loads
**Then** a blocking page renders with: "Este site precisa de um browser moderno"
**And** lists the supported browsers
**And** instructs how to open in a compatible one (FR57, NFR60)

### AC #2: WebView in-app — página de bloqueio

**Given** a user opens the app inside Facebook, Instagram, or WhatsApp in-app WebView
**When** user-agent or detection identifies the WebView
**Then** a blocking page renders: "Abre o Project R no teu browser principal"
**And** shows a "Copiar link" button
**And** shows step-by-step instructions for iOS and Android (FR58)

### AC #3: Browsers suportados — sem bloqueio

**Given** a user opens the app in Chrome (last 2), Safari iOS 16.4+, Safari macOS (last 2), Firefox (last 2), Edge (last 2), or Samsung Internet (last 2)
**When** the page loads
**Then** no blocking page is shown
**And** the app proceeds normally (NFR59)

### AC #4: Testes unitários com user-agents simulados

**Given** the detection logic in `lib/pwa/webview-detection.ts`
**When** unit tests run with mocked user-agent strings
**Then** each unsupported case is covered ≥80% (NFR54)
**And** each WebView case (FB, IG, WhatsApp) is individually tested

### AC #5: Acessibilidade

**Given** the fallback/block pages render
**When** `vitest-axe` runs
**Then** zero WCAG violations reported
**And** copy is B1 PT-PT (NFR42, UX-DR38)
**And** keyboard navigation works (Tab, Enter)
**And** "Copiar link" button has visible focus indicator

---

## Tasks / Subtasks

- [ ] Task 1: Criar `lib/pwa/webview-detection.ts` com lógica de detecção pura (AC: #1, #2, #3, #4)
  - [ ] 1.1 Implementar `isWebView(ua: string): boolean` — deteta FB/IG/WhatsApp via UA string
  - [ ] 1.2 Implementar `isUnsupportedBrowser(ua: string): boolean` — deteta IE11/Opera Mini/UC Browser via UA string
  - [ ] 1.3 Implementar `isServiceWorkerSupported(): boolean` — `'serviceWorker' in navigator` (runtime check, separado do UA)
  - [ ] 1.4 Exportar `BrowserEnvironment` type: `{ type: 'webview' | 'unsupported' | 'supported'; webViewSource?: 'facebook' | 'instagram' | 'whatsapp' | 'other' }`
  - [ ] 1.5 Implementar `detectBrowserEnvironment(ua: string): BrowserEnvironment`

- [ ] Task 2: Testes unitários para `webview-detection.ts` (AC: #4)
  - [ ] 2.1 Escrever testes com UA strings reais de FB, IG, WhatsApp (iOS e Android)
  - [ ] 2.2 Escrever testes com UA strings de IE11, Opera Mini, UC Browser
  - [ ] 2.3 Escrever testes com UA strings de browsers suportados (Chrome, Safari, Firefox, Edge, Samsung)
  - [ ] 2.4 Garantir ≥80% de cobertura das funções

- [ ] Task 3: Criar componente `BrowserGate.tsx` — Client Component de intercepção (AC: #1, #2, #3)
  - [ ] 3.1 Criar `src/components/patterns/BrowserGate.tsx` com `"use client"`
  - [ ] 3.2 Ler `navigator.userAgent` no cliente via `useEffect` (SSR-safe — sem acesso no servidor)
  - [ ] 3.3 Enquanto detecta: mostrar nada (não flash de conteúdo)
  - [ ] 3.4 Se WebView → renderizar `<WebViewBlockPage />`
  - [ ] 3.5 Se unsupported → renderizar `<UnsupportedBrowserPage />`
  - [ ] 3.6 Se supported → renderizar `{children}` normalmente

- [ ] Task 4: Criar `<WebViewBlockPage />` (AC: #2, #5)
  - [ ] 4.1 Criar `src/components/patterns/WebViewBlockPage.tsx`
  - [ ] 4.2 Título: "Abre o Project R no teu browser principal"
  - [ ] 4.3 Botão "Copiar link" com `navigator.clipboard.writeText(window.location.href)` — fallback gracioso se clipboard não disponível
  - [ ] 4.4 Instruções passo-a-passo: iOS ("Toca nos três pontos → Abrir no Safari") e Android ("Toca nos três pontos → Abrir no Chrome")
  - [ ] 4.5 Ícone de aviso (lucide `ExternalLink` ou similar)
  - [ ] 4.6 Layout minimalista, sem navigation shell (fora de route groups)

- [ ] Task 5: Criar `<UnsupportedBrowserPage />` (AC: #1, #5)
  - [ ] 5.1 Criar `src/components/patterns/UnsupportedBrowserPage.tsx`
  - [ ] 5.2 Título: "Este site precisa de um browser moderno"
  - [ ] 5.3 Lista de browsers suportados com nomes (Chrome, Safari, Firefox, Edge, Samsung Internet)
  - [ ] 5.4 Instrução: "Por favor, abre esta página num destes browsers"
  - [ ] 5.5 Ícone (lucide `AlertCircle` ou similar)

- [ ] Task 6: Integrar `BrowserGate` no root layout (AC: #1, #2, #3)
  - [ ] 6.1 Modificar `src/app/layout.tsx` para envolver `{children}` com `<BrowserGate>`
  - [ ] 6.2 `BrowserGate` fica DENTRO do `<body>` mas antes de qualquer route group
  - [ ] 6.3 Garantir que SSR não quebra (useEffect + estado inicial: sem bloqueio)

- [ ] Task 7: Testes de componentes com `vitest-axe` (AC: #5)
  - [ ] 7.1 Teste de `BrowserGate` — renderiza children quando suportado
  - [ ] 7.2 Teste de `BrowserGate` — renderiza `WebViewBlockPage` quando UA é Facebook
  - [ ] 7.3 Teste de `BrowserGate` — renderiza `UnsupportedBrowserPage` quando UA é IE11
  - [ ] 7.4 `axe()` em `WebViewBlockPage` — zero violações
  - [ ] 7.5 `axe()` em `UnsupportedBrowserPage` — zero violações
  - [ ] 7.6 Teste de botão "Copiar link" — verifica `aria-label` e focus

- [ ] Task 8: Build, lint e verificação final
  - [ ] 8.1 `npm run build` sem erros
  - [ ] 8.2 `npm run test --run` — todos os testes passam (incluindo testes anteriores)
  - [ ] 8.3 `npm run lint` — 0 erros

---

## Dev Notes

### Arquitectura da Intercepção — DECISÃO CRÍTICA

A detecção tem de acontecer **no cliente** porque:
- `navigator.userAgent` e `'serviceWorker' in navigator` só existem no browser
- O `proxy.ts` (Edge runtime) NÃO tem acesso a `navigator`
- Server Components também não têm acesso ao UA do cliente de forma confiável

**Padrão correto:**
```
root layout.tsx (Server Component)
  └── <BrowserGate> (Client Component — "use client")
        └── children (app content)
```

`BrowserGate` usa `useEffect` para:
1. Ler `navigator.userAgent`
2. Chamar `detectBrowserEnvironment(ua)`
3. Definir `state: 'checking' | 'blocked-webview' | 'blocked-unsupported' | 'ok'`
4. Renderizar o conteúdo adequado

**Estado inicial = `null` (não bloqueado):** evita flash de conteúdo bloqueado em SSR.

### lib/pwa/webview-detection.ts — Lógica de Detecção

**A função recebe a UA string como argumento** (não lê `navigator.userAgent` diretamente) para permitir unit tests sem mock do DOM.

```typescript
// Padrões de WebView — UA strings conhecidas
const WEBVIEW_PATTERNS = [
  /FBAN|FBAV|FB_IAB|FB4A|FBBV/i,   // Facebook
  /Instagram/i,                     // Instagram
  /WhatsApp/i,                      // WhatsApp
];

// Padrões de browsers não suportados
const UNSUPPORTED_PATTERNS = [
  /Trident\/7/i,     // IE 11
  /Opera Mini/i,     // Opera Mini
  /UCBrowser/i,      // UC Browser
];
```

**ATENÇÃO:** `isWebView` verifica ANTES de `isUnsupportedBrowser`. Um WhatsApp browser pode falhar ambas.

**Service Worker check:** É separado do UA check — feito em `BrowserGate` via `'serviceWorker' in navigator` em runtime. Se falhar (e não for já bloqueado por UA), tratar como `unsupported`.

### SSR Safety — Sem Erros de Hidratação

**Problema:** `BrowserGate` usa `useEffect`, por isso em SSR renderiza `null` para o estado de intercepção. O servidor renderiza o children normalmente; o cliente re-avalia e substitui se necessário.

**Não usar `typeof window !== 'undefined'` no render** — causa hydration mismatch. Usar sempre `useEffect`:

```typescript
// ✅ Correto
const [env, setEnv] = useState<BrowserEnvironment | null>(null);
useEffect(() => {
  setEnv(detectBrowserEnvironment(navigator.userAgent));
}, []);

if (env === null) return <>{children}</>; // SSR + primeiro render cliente
if (env.type === 'webview') return <WebViewBlockPage />;
if (env.type === 'unsupported') return <UnsupportedBrowserPage />;
return <>{children}</>;
```

**Por que `null` inicial renderiza children:** evita flash de "tela em branco" em SSR — o conteúdo aparece imediatamente e é substituído se necessário no cliente. Para WebViews/IE, o utilizador verá uma breve flash do conteúdo mas o bloqueio substitui rapidamente.

### Ficheiro `lib/pwa/webview-detection.ts` — Sem Dependências DOM

Este ficheiro deve:
- Exportar funções puras (sem efeitos secundários)
- Não importar React, Next.js, nem qualquer lib de browser
- Aceitar `ua: string` como argumento (testável sem mock do DOM)
- Ser importável em Server Components se necessário no futuro

### Botão "Copiar link" — Clipboard API

```typescript
const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    // Mostrar feedback: "Link copiado!" (estado local, sem toast)
  } catch {
    // Fallback gracioso: não fazer nada silenciosamente
  }
};
```

**Não usar `vibrateButton` / `HapticButton`** aqui — WebView pode não ter acesso à Vibration API.

### Copy B1 PT-PT (NFR42, UX-DR38)

Todo o texto das páginas de bloqueio deve ser B1 PT-PT (vocabulário simples, frases curtas):

**WebView block:**
- Título: "Abre o Project R no teu browser principal"
- Subtítulo: "Estás a usar esta aplicação dentro de outro programa. Para funcionar corretamente, precisas de a abrir no teu browser."
- Botão: "Copiar link"
- iOS instructions: "1. Toca nos três pontos (···) no canto superior direito\n2. Escolhe 'Abrir no Safari'"
- Android instructions: "1. Toca nos três pontos (⋮) no canto superior direito\n2. Escolhe 'Abrir no Chrome'"

**Unsupported browser:**
- Título: "Este site precisa de um browser moderno"
- Body: "O teu browser não é compatível com esta aplicação. Por favor, abre esta página num dos browsers abaixo:"
- Lista: Chrome, Safari, Firefox, Microsoft Edge, Samsung Internet

### Estrutura de Ficheiros

```
project-r/src/
├── lib/
│   └── pwa/
│       └── webview-detection.ts        [NEW] Detecção pura (sem DOM)
├── components/
│   └── patterns/
│       ├── BrowserGate.tsx             [NEW] Client Component intercepção
│       ├── WebViewBlockPage.tsx        [NEW] UI de bloqueio WebView
│       └── UnsupportedBrowserPage.tsx  [NEW] UI de browser incompatível
├── app/
│   └── layout.tsx                      [UPDATE] Envolver children com <BrowserGate>
├── __tests__/
│   └── lib/
│       └── pwa/
│           └── webview-detection.test.ts   [NEW] Testes unitários de detecção
```

Componentes de teste:
```
project-r/src/components/patterns/
├── BrowserGate.test.tsx                [NEW]
├── WebViewBlockPage.test.tsx           [NEW]
└── UnsupportedBrowserPage.test.tsx     [NEW]
```

### Localização dos Testes

Seguir padrão do projeto:
- Testes de lib: `src/__tests__/lib/pwa/webview-detection.test.ts`
- Testes de components: colocados ao lado do componente (`*.test.tsx`) — verificar padrão atual do projeto

### Integração com `proxy.ts`

**NÃO modificar `proxy.ts`** para este story. O bloqueio de WebView/browser é feito no cliente, não no Edge runtime. `proxy.ts` continua a gerir autenticação e routing de roles.

Se um WebView conseguir autenticar-se, será bloqueado pelo `BrowserGate` antes de ver qualquer conteúdo do app.

---

## Architecture Compliance

### Tailwind v4 e Design System (Story 1.8)

- Usar tokens de `globals.css`: `bg/base`, `text/primary`, `border/default`, `signal/alert`
- Usar `cn()` de `@/lib/utils` para className conditionals
- Usar `lucide-react` para ícones
- **Não usar shadcn components** nestes ecrãs — são páginas de erro fora da UI normal
- Botão "Copiar link": usar `<Button variant="primary">` do sistema de design 1.8 (ou implementar inline simples se shadcn não estiver disponível fora de route groups)

### TypeScript Strict (NFR55)

- `noUncheckedIndexedAccess: true` — usar `?.` e `?? ` em acesso a arrays/objetos
- Sem `any` types
- Usar `@/` path aliases em todos os imports

### React 19

- Sem `import React` no topo dos ficheiros `.tsx`
- Automatic JSX transform ativo

### Next.js 16 App Router

- `BrowserGate` com `"use client"` no topo do ficheiro
- Root layout continua Server Component — só `BrowserGate` (importado por ele) é client
- Não usar `useRouter()` nas páginas de bloqueio — utilizador não deve navegar, deve abrir browser externo

### Testing (NFR54, NFR37)

- Vitest + `@testing-library/react`
- `vitest-axe` para accessibility checks (padrão do projeto desde Story 1.6+)
- Cobertura ≥80% para `lib/pwa/webview-detection.ts`
- Correr testes de `project-r/` com `npm run test --run`

---

## Previous Story Intelligence

### Story 1.9 → 1.10 Learnings

**CRÍTICO: Next.js 16 usa `src/proxy.ts`, NÃO `middleware.ts`**
- `proxy.ts` com `export function proxy` é o padrão para Next.js 16
- `middleware.ts` causa build error nesta versão
- Story 1.10 NÃO deve criar/modificar `middleware.ts`

**Padrão de Client Components:**
- `"use client"` no topo do ficheiro (não como comentário dentro do componente)
- `usePathname()` e `useRouter()` de `next/navigation` (não `next/router`)
- `BottomTabNav.tsx` é um bom exemplo do padrão de client component

**Tailwind v4 e tokens:**
- Todos os tokens em `globals.css` — usar `bg/base`, `text/primary`, etc.
- `z-sticky` existe para z-index de sticky elements
- NÃO hardcode cores — sempre usar tokens

**Padrões de código estabelecidos (Stories 1.5–1.9):**
- Imports com `@/` aliases sempre
- `cn()` de `@/lib/utils` para classNames condicionais
- TypeScript strict — sem `any`, `?.` em index access
- Server Components por defeito; `"use client"` apenas quando necessário

**Correção crítica do Code Review 1.9 (aplicar aqui):**
- Validar inputs e fallbacks explícitos — não assumir que valores existem
- Clipboard API pode falhar silenciosamente — sempre try-catch
- `aria-current="page"` e foco visible em elementos interativos

**Build atual:** 185+ testes passando após code review de 1.9. Manter baseline.

**`lib/pwa/` folder já existe** mas está vazia — criar `webview-detection.ts` dentro.

### Git Intelligence (Commits Recentes)

- `62facfa` — JWT claims para role-based routing (proxy.ts pattern)
- `1b8479c` — Code review patches 1.9 (13 patches aplicados, build ✅)
- `00d31ea` — Route groups (player)/(staff) implementados
- Padrão de commits: `feat: 1.X description`

---

## Testing Requirements

### Testes Unitários — `webview-detection.test.ts`

```typescript
// UA strings para testes (reais, coletadas de dispositivos)
const UA_FACEBOOK_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/...]"
const UA_FACEBOOK_ANDROID = "Mozilla/5.0 (Linux; Android 13; ...) ... FBAN/FBIOS;FBDV/..."
const UA_INSTAGRAM_IOS = "Mozilla/5.0 ... Instagram 123.0.0.0.0"
const UA_WHATSAPP_IOS = "Mozilla/5.0 ... WhatsApp/2.23.25.79"
const UA_IE11 = "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko"
const UA_OPERA_MINI = "Opera/9.80 (Android; Opera Mini/8.0.1807/28.204; ..."
const UA_UC_BROWSER = "Mozilla/5.0 ... UCBrowser/13.4.0.1306..."
const UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ... Chrome/120.0..."
const UA_SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 ... Safari/604.1"
```

### Testes de Componentes — `BrowserGate.test.tsx`

Mockar `navigator.userAgent` usando `Object.defineProperty(navigator, 'userAgent', ...)` ou via vitest mock.

### Accessibility — `vitest-axe`

```typescript
import { axe } from 'vitest-axe';
// ...
const { container } = render(<WebViewBlockPage />);
const results = await axe(container);
expect(results).toHaveNoViolations();
```

---

## Project Context

- **App root:** `project-r/` (subfolder dentro do repo — todos os comandos de `npm` de dentro de `project-r/`)
- **Linguagem UI:** Português PT-PT (B1)
- **Código/APIs:** Inglês
- **Design system:** Tailwind v4 + shadcn/ui + lucide-react (Story 1.8)
- **Auth:** Supabase (Stories 1.4, 1.5, 1.6)
- **Routing:** Next.js 16 App Router com proxy.ts (Story 1.9)
- **Story 1.10 posição:** Fora de todos os route groups — intercepção a nível de root layout

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
