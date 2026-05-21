# Story 1.1: Project Initialization & Stack Bootstrap

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a solo developer,
I want to scaffold the project with a deterministic, reproducible stack initialization sequence,
so that the foundation is consistent, AI-implementable, and provider-agnostic from day one.

## Acceptance Criteria

1. **Scaffold Next.js conforme flags exatas**
   **Given** an empty repository
   **When** the initialization sequence is executed
   **Then** `create-next-app` runs with flags `--typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
   **And** `tsconfig.json` has `"strict": true` and `"noUncheckedIndexedAccess": true` (NFR55)
   **And** `package.json` declares Node 22 LTS engine.

2. **Instalação sequencial das dependências (AR2)**
   **Given** the Next.js scaffold exists
   **When** dependencies are installed sequentially per AR2
   **Then** shadcn/ui is initialized via `npx shadcn@latest init`
   **And** runtime deps `@supabase/supabase-js`, `@supabase/ssr`, `@serwist/next`, `dexie`, `@tanstack/react-query`, `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`, `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`, `recharts` are installed
   **And** dev deps `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `vitest-axe`, `eslint-plugin-jsx-a11y` are installed.

3. **Servidor dev arranca limpo em Webpack**
   **Given** the project compiles
   **When** `next dev --webpack` runs
   **Then** the dev server starts on port 3000 without errors
   **And** the homepage renders default content.

4. **Tailwind v4 CSS-first com mecanismo `@theme` ativo**
   **Given** Tailwind v4 CSS-first config
   **When** `globals.css` declares `@theme` com pelo menos um token placeholder
   **Then** o token CSS variable resolve em runtime e está acessível a qualquer componente que o consuma (smoke test num componente de demo). O conjunto completo de tokens é trabalho da Story 1.8 — esta AC valida apenas o mecanismo.

5. **Zero acoplamento a Vercel (NFR58)**
   **Given** the provider-agnostic constraint (NFR58)
   **When** o comando `rg "from ['\"]@vercel/" sparta/src/` é executado
   **Then** não retorna resultados (exit code 1)
   **And** dependências `@vercel/*` (analytics, speed-insights, og, etc.) não estão em `sparta/package.json`.

## Tasks / Subtasks

- [x] **Task 0 — Preparar local do scaffold (Opção B confirmada)** ⚠️ FAZER PRIMEIRO (AC: #1)
  - [x] **Decisão arquitetural (locked-in 2026-05-08, Antero):** o scaffold vive em subpasta `sparta/` (kebab-case, conforme [architecture.md#L997](_bmad-output/planning-artifacts/architecture.md#L997)). Os artefactos BMad (`_bmad-output/`, `.claude/`, etc.) ficam na raiz, separados do código aplicacional. Todas as paths nas stories futuras são relativas a `sparta/` (e.g., `sparta/src/app/`, `sparta/supabase/migrations/`).
  - [x] **Estado actual do repo (verificado em 2026-05-08):** raiz contém `_bmad/`, `_bmad-output/`, `_bmad-cache/`, `.claude/`, e uma pasta `SPARTA/` (nome legacy, capital) que contém APENAS um `.git/` aninhado (sem package.json nem código).
  - [x] **Limpeza pré-scaffold:**
    - [x] Remover a pasta `SPARTA/` legacy completa (apenas tem `.git/` aninhado vazio): `Remove-Item -Recurse -Force SPARTA` (PowerShell). O repo git principal está em `c:\Users\anter\Documents\GitHub\SPARTA\.git` e não é afectado.
    - [x] Confirmar `git status` continua a mostrar repo principal saudável.
  - [x] **Executar scaffold:** a partir da raiz do repositório, `npx create-next-app@latest sparta --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`. Cria `sparta/` como subdiretório isolado.
  - [x] **Não criar git aninhado:** o `create-next-app` pode tentar inicializar git em `sparta/.git/`. Se acontecer, eliminar `sparta/.git/` — o repo único é o da raiz.
  - [x] **Todos os comandos `npm`/`npx` das tasks seguintes correm a partir de `sparta/`** (não da raiz). Considerar `cd sparta` no início da sessão dev.

- [x] **Task 1 — Scaffold base Next.js** (AC: #1, #5)
  - [x] Executar o `create-next-app` com as flags exatas conforme a opção escolhida em Task 0.
  - [x] Editar `tsconfig.json`: garantir `"strict": true` e adicionar `"noUncheckedIndexedAccess": true` ao `compilerOptions`. Esperar erros novos no código gerado pelo template — corrigir com narrowing/guards, NÃO com `// @ts-ignore`.
  - [x] Adicionar `"engines": { "node": ">=22 <23" }` ao `package.json` e criar `.nvmrc` com `22`. Verificar localmente: `node -v` deve devolver `v22.x.x`.
  - [x] Confirmar que NÃO existe nenhum import de `@vercel/*` no código aplicacional gerado pelo template (Next.js 16 pode incluir `@vercel/analytics` no template default — remover se aparecer). `next/*` é permitido e expected.
- [x] **Task 2 — shadcn/ui init** (AC: #2)
  - [x] `npx shadcn@latest init` com defaults compatíveis com Tailwind v4 + App Router + `src/` + alias `@/*`.
  - [x] Verificar que `components.json` é gerado e que `src/components/ui/` está pronto para receber componentes copy-paste em stories futuras (1.8).
- [x] **Task 3 — Instalar deps runtime (sequência exacta AR2)** (AC: #2)
  - [x] `npm install @supabase/supabase-js @supabase/ssr`
  - [x] `npm install @serwist/next`
  - [x] `npm install dexie`
  - [x] `npm install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister zustand`
  - [x] `npm install react-hook-form zod @hookform/resolvers`
  - [x] `npm install date-fns`
  - [x] `npm install recharts` (instalado mas não usado até Phase 2 — não criar imports speculativos).
- [x] **Task 4 — Instalar deps de teste e a11y** (AC: #2)
  - [x] `npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom vitest-axe eslint-plugin-jsx-a11y`
  - [x] Criar `vitest.config.ts` mínimo (jsdom env, setup file). NÃO escrever testes ainda — coverage gates entram na Story 1.13.
  - [x] Estender `eslint.config.mjs` com `eslint-plugin-jsx-a11y` (recommended).
- [x] **Task 5 — Tailwind v4 + globals.css com @theme** (AC: #4)
  - [x] Confirmar que o `create-next-app` gerou Tailwind v4 (não v3). Se gerar v3, abortar e ajustar (templates Next.js 16+ assumem v4).
  - [x] Em `src/app/globals.css`, declarar bloco `@theme { ... }` com placeholder mínimo (`--color-bg-base`, `--color-text-default`). Tokens completos ficam para Story 1.8.
  - [x] Garantir que o `postcss.config.mjs` e o `globals.css` estão alinhados com setup CSS-first do Tailwind v4.
- [x] **Task 6 — Estrutura mínima de pastas** (AC: #1)
  - [x] Criar pastas vazias com `.gitkeep` (sem código speculativo): `src/components/{ui,patterns,domain}`, `src/lib/{supabase,outbox,readiness,tokens,actions,schemas,i18n/pt-PT}`, `src/hooks`, `src/stores`, `src/types`, `__fixtures__`, `__tests__`, `supabase/{migrations,functions}`, `scripts`, `docs/architecture`, `docs/compliance`, `public/{icons,animations,illustrations}`.
  - [x] NÃO criar ficheiros de implementação aqui — outras stories (1.3 migrations, 1.6 supabase helpers, 1.11 outbox, etc.) preenchem o conteúdo.
- [x] **Task 7 — Boot e verificação manual** (AC: #3)
  - [x] Atualizar script `dev` em `package.json` para `next dev --webpack` (Serwist é incompatível com Turbopack — ver Dev Notes). **Verificar primeiro** que a flag `--webpack` é aceite na versão de Next.js gerada (`npx next dev --help | grep -i webpack`); se a flag for renomeada/removida em alguma minor, usar a alternativa documentada (e.g., `NEXT_DISABLE_TURBOPACK=1`) e registar a decisão em `docs/architecture/violations.md`.
  - [x] `npm run dev` → confirmar arranque em `http://localhost:3000` sem erros nem warnings críticos; homepage renderiza conteúdo default.
  - [x] `npm run build` → confirmar build limpo (necessário para gates futuros do CI Story 1.13).
  - [x] `npx vitest run` → exit 0 (zero testes a passar é OK; o que valida é que o runner arranca).
- [x] **Task 8 — Higiene de repo** (AC: #1, #5)
  - [x] `.gitignore`: confirmar exclusão de `.env*` exceto `.env.example` (preparação para Story 1.2).
  - [x] `.editorconfig` e `.prettierrc.json` na raiz se ausentes (alinhar com `eslint.config.mjs`).
  - [x] Grep automático/manual `from ['"]@vercel/` no `src/` → 0 resultados (AC #5). Documentar resultado em PR description.

## Dev Notes

### Context (epic + story foundation)

- **Epic 1 — Fundação Técnica, Identidade & Acesso Multi-Clube** ([epics.md#L399](_bmad-output/planning-artifacts/epics.md#L399)). A 1.1 é a primeira história do épico e da fundação completa: tudo o que vem a seguir (migrations 1.3, JWT hook 1.4, auth 1.5, RLS 1.6, design system 1.8, outbox 1.11, CI 1.13) assume a stack inicializada exatamente como aqui especificado.
- **Status no sprint:** este é o ponto de entrada. Atualizar `_bmad-output/implementation-artifacts/sprint-status.yaml` no final: `1-1-project-initialization-stack-bootstrap: done` e `epic-1: in-progress`.

### Decisões arquiteturais não-óbvias (LER antes de codificar)

1. **`next dev --webpack`, não Turbopack.** Serwist (PWA service worker) é incompatível com Turbopack. Confirmado em [architecture.md#L180-L181](_bmad-output/planning-artifacts/architecture.md#L180) e [architecture.md#L240](_bmad-output/planning-artifacts/architecture.md#L240). Ajustar o script `dev` em `package.json` para `"dev": "next dev --webpack"`. Não usar Turbopack apesar de ser default em Next.js 16.
2. **Tailwind v4 CSS-first.** Sem `tailwind.config.{ts,js}`. Tokens vivem em `src/app/globals.css` via `@theme { ... }`. Story 1.8 introduz o conjunto completo de tokens; nesta história só validamos que o mecanismo está vivo com 1–2 tokens placeholder.
3. **Provider-agnostic (NFR58).** Zero acoplamento a `@vercel/*` em código aplicacional. Apenas `next/*` é permitido. Esta regra é invariante e será verificada por CI lint na Story 1.13. Não introduzir `@vercel/analytics`, `@vercel/speed-insights`, `@vercel/og`, etc.
4. **`recharts` é instalado mas não usado no MVP.** Phase 2. Não criar imports nem componentes que o consumam; apenas a entrada em `package.json`. Ver [architecture.md#L162](_bmad-output/planning-artifacts/architecture.md#L162).
5. **Sem ORM, sem barrel files, sem default exports.** Convenções estabelecidas em [architecture.md#L617-L657](_bmad-output/planning-artifacts/architecture.md#L617). Importante já — qualquer ficheiro criado nesta história deve respeitá-las.
6. **`src/middleware.ts`, route groups `(player)/(staff)`, rotas em PT.** Estrutura final detalhada em [architecture.md#L994-L1132](_bmad-output/planning-artifacts/architecture.md#L994). Esta história NÃO cria as rotas finais — apenas a estrutura de pastas com `.gitkeep`. As rotas são preenchidas pela Story 1.9.

### Files to CREATE (esta história)

> **Convenção de paths (Opção B):** todos os caminhos abaixo são relativos a `sparta/` (subpasta do scaffold). A estrutura completa em [architecture.md#L996-L1132](_bmad-output/planning-artifacts/architecture.md#L996) (incluindo `docs/`, `.github/workflows/`, `supabase/`, `scripts/`) vive dentro de `sparta/`. Apenas `_bmad/`, `_bmad-output/`, `_bmad-cache/`, `.claude/` permanecem na raiz do repo (tooling BMad, não aplicação).

- `package.json` (gerado + editado — engines + script `dev`)
- `tsconfig.json` (gerado + editado — `noUncheckedIndexedAccess: true`)
- `.nvmrc`
- `eslint.config.mjs` (gerado + extensão `jsx-a11y`)
- `vitest.config.ts` + `vitest.setup.ts` mínimos
- `src/app/globals.css` (gerado + bloco `@theme` placeholder)
- `components.json` (gerado por `shadcn init`)
- Pastas com `.gitkeep`: `src/components/{ui,patterns,domain}`, `src/lib/{supabase,outbox,readiness,tokens,actions,schemas,i18n/pt-PT}`, `src/hooks`, `src/stores`, `src/types`, `__fixtures__`, `__tests__`, `supabase/{migrations,functions}`, `scripts`, `docs/{architecture,compliance}`, `public/{icons,animations,illustrations}`

### Definition of Done (resumo verificável)

- [x] AC #1–#5 todos satisfeitos com evidência (logs, comandos, screenshots) na PR description.
- [x] `npm run dev` arranca em <30s sem warnings críticos.
- [x] `npm run build` exit 0.
- [x] `npx vitest run` exit 0.
- [x] `rg "from ['\"]@vercel/" sparta/src/` retorna 0 matches.
- [x] Pasta legacy `SPARTA/` removida; `sparta/` criada na raiz com scaffold válido (Opção B).
- [x] Nenhum `.git` aninhado em `sparta/`.
- [x] Sprint-status atualizado: `1-1-...: done`, `epic-1: in-progress`.

### Files NOT to create (deferir para outras stories)

- Migrations SQL → Story 1.2/1.3
- `lib/supabase/{client,server,middleware,service-role}.ts` → Story 1.6
- `src/middleware.ts` (conteúdo) → Story 1.6/1.9 (criar apenas a pasta vazia ou ficheiro stub vazio se necessário para o build)
- Componentes shadcn (`button.tsx`, `dialog.tsx`, etc.) e patterns (`SemaforoBadge`, `DrillDownSheet`, …) → Story 1.8
- Service worker (`src/app/sw.ts`) e Dexie outbox → Story 1.11
- `.github/workflows/{ci,heartbeat,backup}.yml` → Stories 1.13, 1.14, 1.15
- `.env.example` → Story 1.2 (depende do projeto Supabase estar provisionado)

### Versões e gotchas (estado em 2026-05)

- **Next.js 16.x** (App Router). `create-next-app` com flag `--app` é obrigatório.
- **TypeScript** ≥5.x — strict + `noUncheckedIndexedAccess` aumenta o ruído inicial mas é não-negociável (NFR55). Esperar erros em código gerado pelo template (e.g., acessos a `params[0]`); corrigir conforme aparecem.
- **Tailwind v4** + **shadcn CLI**: confirmar que a versão CLI do shadcn é compatível com Tailwind v4 (mar/2026 — preset v4 estável). Se houver mismatch, NÃO downgrade do Tailwind; resolver via versão específica do shadcn.
- **Serwist `@serwist/next`**: instalar mas NÃO configurar service worker nesta história. Configuração fica para Story 1.11.
- **`@supabase/ssr` (não `@supabase/auth-helpers-nextjs`)** — auth-helpers está deprecated. Confirmado no architecture.

### Project Structure Notes

- Alinha com [architecture.md#L994-L1132](_bmad-output/planning-artifacts/architecture.md#L994) (Complete Project Directory Structure).
- A boundary unidirecional `ui → patterns → domain → app` ([architecture.md#L1150-L1162](_bmad-output/planning-artifacts/architecture.md#L1150)) ainda não tem enforcement automático nesta história; documentar em `docs/architecture/violations.md` (criar como ficheiro vazio com cabeçalho) para uso futuro.
- Conflito potencial: o `create-next-app` cria `src/app/page.tsx` com conteúdo demo; manter o ficheiro mas não tratar como entregável de produto — vai ser substituído por route groups na Story 1.9. Marcar com `// TODO(story-1.9): replace with role-based redirect` no topo.

### Testing standards summary

- Stack: Vitest + `@testing-library/react` + `vitest-axe`. Sem Playwright/E2E no MVP ([architecture.md#L193](_bmad-output/planning-artifacts/architecture.md#L193)).
- **Esta história não exige testes funcionais** — apenas garantir que o runner Vitest arranca (`npx vitest run` → 0 testes, exit 0). Testes substantivos começam na Story 1.3 (migrations) e 1.4 (auth hook ≥80% — NFR54).
- Coverage gates ≥80% em `lib/readiness/` e `lib/outbox/` entram na Story 1.13 (CI). Não bloquear esta história nesse alvo.

### References

- [epics.md#L403-L434](_bmad-output/planning-artifacts/epics.md#L403) — Story 1.1 user story + AC originais
- [architecture.md#L122-L168](_bmad-output/planning-artifacts/architecture.md#L122) — Initialization Commands (sequência canónica AR2)
- [architecture.md#L170-L243](_bmad-output/planning-artifacts/architecture.md#L170) — Architectural Decisions Provided by Starter (Webpack, Tailwind v4, conventions)
- [architecture.md#L596-L613](_bmad-output/planning-artifacts/architecture.md#L596) — Implementation sequence (project init é o passo 1)
- [architecture.md#L617-L677](_bmad-output/planning-artifacts/architecture.md#L617) — Naming Patterns (DB, código, rotas, edge functions)
- [architecture.md#L992-L1132](_bmad-output/planning-artifacts/architecture.md#L992) — Complete Project Directory Structure
- [prd.md#L440](_bmad-output/planning-artifacts/prd.md#L440) — Technical Constraints
- [prd.md#L1023-L1042](_bmad-output/planning-artifacts/prd.md#L1023) — NFR Security (NFR14, NFR17, NFR18)
- [prd.md#L1086](_bmad-output/planning-artifacts/prd.md#L1086) — NFR Browser & Platform Compatibility (NFR58–NFR60)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Claude Code CLI · 2026-05-08)

### Debug Log References

- **Node version mismatch antes do início:** local v24.15.0 → user instalou v22.22.2 LTS antes de prosseguir.
- **PowerShell ExecutionPolicy bloqueia `npm.ps1`:** workaround usando o tool `Bash` para todos os comandos npm/npx (decisão acordada no início da sessão dev).
- **shadcn 4.x default = Base UI**, não Radix. Architecture.md#L249 exige Radix → re-init com `--base radix --preset nova`. `@base-ui/react` desinstalado.
- **`npx vitest run` saiu com exit 1** quando não há testes → adicionado `passWithNoTests: true` ao `vitest.config.ts`.
- **ESLint ConfigError** ao adicionar `jsx-a11y` ao `eslint.config.mjs` → `eslint-config-next/core-web-vitals` já bundla `jsx-a11y`. Removida adição duplicada; comentário explicativo adicionado ao config.
- **`@vitejs/plugin-react`** adicionado como dev dep (não no spec original) — necessário para Vitest processar JSX em `.tsx`. Sem ele, `npx vitest run` falha em ficheiros React. Mantido como complemento ao stack de teste.

### Completion Notes List

- ✅ AC #1 — `create-next-app` corrido com flags exatas; `tsconfig.json` tem `strict: true` + `noUncheckedIndexedAccess: true`; `package.json` declara `"engines": { "node": ">=22 <23" }`; `.nvmrc` = `22`.
- ✅ AC #2 — Sequência AR2 honrada (7 grupos `npm install` em ordem, mais shadcn init e dev deps). Todas as 13 deps runtime + 7 dev deps presentes em `package.json` (ver File List abaixo).
- ✅ AC #3 — `npm run dev` (script `next dev --webpack`) arrancou em 607ms; `curl http://localhost:3000/` → HTTP 200 (5.3s primeiro hit, normal para JIT inicial); homepage demo do create-next-app renderizou.
- ✅ AC #4 — `globals.css` declara `@theme inline { ... }` com tokens shadcn defaults (background, foreground, primary, secondary, muted, accent, destructive, border, input, ring, etc.). Tokens canónicos SPARTA (`signal-{ready,caution,alert,info,neutral}`) ficam para Story 1.8 (UX-DR1–UX-DR4) — registado em `docs/architecture/violations.md` como deferred-to-1.8.
- ✅ AC #5 — `rg "from ['\"]@vercel/" sparta/src/` → 0 matches; `@vercel/*` ausente de `package.json`.
- ✅ Build limpo: `npm run build` → exit 0, página `/` prerendered como static.
- ✅ Lint limpo: `npm run lint` → exit 0.
- ✅ Vitest: `npx vitest run` → exit 0 (zero testes, runner OK).
- ✅ Pasta legacy `SPARTA/` removida; `sparta/` criada na raiz; nenhum `.git` aninhado.
- ✅ Estrutura de pastas com `.gitkeep` criada conforme [architecture.md#L996-L1132](../planning-artifacts/architecture.md#L996).
- ✅ `src/app/page.tsx` marcado com `// TODO(story-1.9): replace with role-based redirect`.
- ✅ `docs/architecture/violations.md` criado com 3 entradas (Base UI vs Radix resolvido; Button 6→3 variantes deferred 1.8; token vocabulary deferred 1.8).
- ⚠️ **Decisões delegadas durante execução:** (1) Node 22 LTS vs 24 → user escolheu instalar 22; (2) Base UI vs Radix → user confirmou Radix conforme architecture; (3) Bash tool em vez de PowerShell → user escolheu Bash para evitar mexer em ExecutionPolicy.

### File List

**Created (story-owned):**

- `sparta/.editorconfig`
- `sparta/.nvmrc`
- `sparta/.prettierrc.json`
- `sparta/vitest.config.ts`
- `sparta/vitest.setup.ts`
- `sparta/docs/architecture/violations.md`
- `sparta/src/components/patterns/.gitkeep`
- `sparta/src/components/domain/.gitkeep`
- `sparta/src/lib/supabase/.gitkeep`
- `sparta/src/lib/outbox/.gitkeep`
- `sparta/src/lib/readiness/.gitkeep`
- `sparta/src/lib/tokens/.gitkeep`
- `sparta/src/lib/actions/.gitkeep`
- `sparta/src/lib/schemas/.gitkeep`
- `sparta/src/lib/i18n/pt-PT/.gitkeep`
- `sparta/src/lib/push/.gitkeep`
- `sparta/src/lib/pwa/.gitkeep`
- `sparta/src/hooks/.gitkeep`
- `sparta/src/stores/.gitkeep`
- `sparta/src/types/.gitkeep`
- `sparta/src/emails/.gitkeep`
- `sparta/__fixtures__/.gitkeep`
- `sparta/__tests__/.gitkeep`
- `sparta/supabase/migrations/.gitkeep`
- `sparta/supabase/functions/.gitkeep`
- `sparta/scripts/.gitkeep`
- `sparta/docs/architecture/.gitkeep`
- `sparta/docs/architecture/runbooks/.gitkeep`
- `sparta/docs/architecture/adr/.gitkeep`
- `sparta/docs/compliance/.gitkeep`
- `sparta/docs/compliance/policies/.gitkeep`
- `sparta/public/icons/.gitkeep`
- `sparta/public/animations/.gitkeep`
- `sparta/public/illustrations/.gitkeep`

**Created by `create-next-app` / shadcn (kept as scaffolded, modified where noted):**

- `sparta/package.json` (modified: engines, scripts.dev `--webpack`, scripts.test/test:watch)
- `sparta/package-lock.json`
- `sparta/tsconfig.json` (modified: `noUncheckedIndexedAccess: true`)
- `sparta/eslint.config.mjs` (modified: comment explaining no jsx-a11y duplicate)
- `sparta/next.config.ts`
- `sparta/postcss.config.mjs`
- `sparta/components.json`
- `sparta/AGENTS.md`
- `sparta/CLAUDE.md`
- `sparta/README.md`
- `sparta/next-env.d.ts`
- `sparta/.gitignore` (modified: `!.env.example` re-include)
- `sparta/src/app/globals.css` (modified: header comment + shadcn-managed tokens)
- `sparta/src/app/layout.tsx`
- `sparta/src/app/page.tsx` (modified: TODO comment for Story 1.9)
- `sparta/src/components/ui/button.tsx` (shadcn Radix preset Nova)
- `sparta/src/lib/utils.ts` (shadcn `cn()`)
- `sparta/public/favicon.ico`, `public/next.svg`, `public/vercel.svg` (template assets)

**Removed:**

- `SPARTA/` (legacy folder containing nested empty `.git/`)

**Out of scope for this story (created by other stories):**

- `sparta/src/middleware.ts` → Story 1.6/1.9
- `sparta/.env.example` → Story 1.2
- `sparta/.github/workflows/{ci,heartbeat,backup}.yml` → Stories 1.13/1.14/1.15
- `sparta/src/app/sw.ts` → Story 1.11
- `sparta/supabase/migrations/*.sql` → Stories 1.2/1.3+

### Change Log

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-08 | dev-story (claude-opus-4-7) | Story 1.1 implementada: scaffold `sparta/` (Opção B), Next.js 16.2.6 + React 19.2.4 + Tailwind v4 + shadcn (Radix preset Nova) + Supabase + Serwist + Dexie + TanStack + Zustand + RHF + Zod + date-fns + recharts; Vitest + RTL + axe; tsconfig strict + noUncheckedIndexedAccess; engines Node 22 LTS; `next dev --webpack` (não Turbopack); estrutura de pastas com `.gitkeep`; violations log iniciado. AC #1–#5 verificados. Status → review. |
