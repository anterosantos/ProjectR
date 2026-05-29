<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## TypeScript: Path Aliases (@/*)

The project uses TypeScript path aliases for clean imports. All `@/*` imports resolve to the `src/` directory.

**Configuration:**
- `tsconfig.json`: `"@/*": ["./src/*"]`
- `vitest.config.ts`: Absolute path via `path.resolve(__dirname, "./src")`
- `components.json` (shadcn): `"@/components"`, `"@/lib"`, `"@/hooks"`, etc.

**Rules:**
- Tests must run from `sparta/` directory (not repo root) for alias resolution
- Verify with: `npm run test --run`
- Import from aliases in tests: `import { cn } from "@/lib/utils"`

**Examples:**
```typescript
// ✅ Correct
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCustomHook } from "@/hooks/useCustomHook";

// ❌ Avoid relative imports (harder to refactor)
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
```

---

## React 19: Automatic JSX Transform

React 19 uses automatic JSX transform. You do NOT need to import React in `.tsx` files.

**Configuration:**
- `tsconfig.json`: `"jsx": "react-jsx"`
- `@vitejs/plugin-react`: Handles JSX for vitest/jsdom environment

**Rules:**
- No `import React from "react"` needed
- Vitest and Next.js dev server may render JSX differently; ensure compatibility
- See `__tests__/jsx-compat.test.tsx` for consistency test (if added)

**Examples:**
```typescript
// ✅ Correct (no React import needed)
export function MyComponent() {
  return <div>Hello</div>;
}

// ⚠️ Avoid (React import unnecessary in React 19)
import React from "react";
export function MyComponent() {
  return <div>Hello</div>;
}
```

---

## TypeScript: noUncheckedIndexedAccess (NFR55)

The project uses TypeScript strict mode with `noUncheckedIndexedAccess: true`. This means index access (array[i], object[key]) requires explicit type narrowing.

**The Rule:**
- Array/object index access must be guarded
- Use optional chaining (`?.`) + nullish coalescing (`??`)
- Or use explicit `in` checks / type guards

**Pattern: Optional Chaining + Nullish Coalescing**
```typescript
const arr = [1, 2, 3];
const value = arr?.[0] ?? 0; // ✅ Correct: safe fallback

const obj = { a: 1 };
const val = obj?.["key"] ?? undefined; // ✅ Correct

const key = "name";
const name = obj?.[key] ?? "Unknown"; // ✅ Correct
```

**Anti-Patterns:**
```typescript
// ❌ Error: may be undefined
const first = arr[0];

// ❌ Error: no guard
const val = obj[key];

// ❌ Error: no fallback
const name = obj?.[key]; // Still needs ?? fallback
```

**Type Guards:**
```typescript
// ✅ Correct: explicit check
if (arr[0] !== undefined) {
  console.log(arr[0]);
}

// ✅ Correct: in operator for objects
if ("key" in obj && obj.key) {
  console.log(obj.key);
}
```

See: [TypeScript noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess)

---

## Running Tests

Tests must be run from the `sparta/` directory for correct alias and setup resolution.

**From sparta/:**
```bash
npm run test          # Watch mode
npm run test --run    # Single run
npm run test:watch    # Explicit watch
```

**From repo root (monorepo style):**
```bash
npm run -w sparta test       # Watch mode
npm run -w sparta test --run # Single run
```

Vitest setup files are configured with absolute paths for compatibility.

---

## Environment Variables

Use `.env.local` (gitignored) for local development secrets. Template: `.env.example`

**Setup:**
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

**Required variables (Story 1.2):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (renamed from `ANON_KEY` in 2025+)

Public variables (prefixed `NEXT_PUBLIC_`) are exposed to the browser; never put secrets there.

---

## Architectural Patterns & Implementation Rules

Padrões estabelecidos durante o desenvolvimento — violações causam bugs silenciosos ou falhas de CI.

### 1. Service Role para Server Actions chamadas de Client Components

**Regra:** Server Actions invocadas de `useEffect`, `useCallback`, ou qualquer hook de ciclo de vida de client components DEVEM usar `getServiceRoleClient()` para queries a dados, NÃO `createServerClient()`.

**Porquê:** O JWT do utilizador não propaga corretamente através de RLS policies com `EXISTS (SELECT FROM profiles...)` quando o contexto assíncrono é iniciado pelo lado do cliente. O service role contorna este problema.

**Requisito obrigatório:** Antes de qualquer `getServiceRoleClient()`, chamar `requireStaffRole()` para verificação de autenticação e papel a nível da aplicação. Nunca service role sem este guard.

**Filtros explícitos:** Como o service role bypassa RLS, todos os queries DEVEM incluir filtros explícitos `club_id` + identificador do recurso para garantir isolamento multi-tenant.

```typescript
// ✅ Correcto
export async function getPlayerData(playerId: string) {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();
  const { data } = await serviceRole
    .from('fatigue_responses')
    .select('...')
    .eq('player_id', playerId)
    .eq('club_id', clubId); // isolamento explícito
}

// ❌ Errado — JWT pode não propagar via useEffect
const supabase = await createServerClient();
const { data } = await supabase.from('fatigue_responses')...
```

Ver `sparta/src/lib/actions/readiness.ts` (`getPlayerDrillDownData`) e `sparta/src/lib/actions/decisions-server.ts` para exemplos canónicos.

---

### 2. Ficheiros "use server" — apenas funções async

**Regra:** Ficheiros com `"use server"` no topo APENAS podem exportar funções async. Qualquer export não-async (schemas Zod, constantes, tipos, objectos) causa **build error em produção**.

**Solução:** Extrair schemas e tipos para `src/lib/schemas/` ou `src/lib/types/`.

```typescript
// ❌ Causa build error
"use server";
export const MySchema = z.object({ ... }); // objecto, não função async

// ✅ Correcto
// src/lib/schemas/my-schema.ts (sem "use server")
export const MySchema = z.object({ ... });

// src/lib/actions/my-action.ts
"use server";
import { MySchema } from "@/lib/schemas/my-schema";
export async function myAction() { ... }
```

---

### 3. RLS Policies — padrão EXISTS/profiles (nunca auth.club_id())

**Regra:** Todas as RLS policies devem usar o padrão `EXISTS (SELECT 1 FROM profiles ...)`. Nunca usar `auth.club_id()`, `auth.jwt()`, ou claims JWT directamente.

**Porquê:** `auth.club_id()` é uma função de JWT hook configurada apenas em produção. O Supabase local (usado em CI) não tem o hook configurado — qualquer migration que use esta função passa em produção mas **falha em CI**. Este é o pior tipo de regressão.

```sql
-- ✅ Correcto — funciona em CI e produção
CREATE POLICY "staff read" ON my_table
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'analyst')
        AND club_id = my_table.club_id
    )
  );

-- ❌ Falha em CI — auth.club_id() não existe em Supabase local
CREATE POLICY "staff read" ON my_table
  FOR SELECT TO authenticated
  USING (club_id = auth.club_id() AND ...);
```

---

### 4. Caminho de Migrations

**Regra:** Todas as migrations DEVEM estar em `sparta/supabase/migrations/`. O directório raiz `supabase/migrations/` (fora de `sparta/`) **não é monitorizado pelo CI**.

**Convenção de naming:** `000NNN_descricao_em_snake_case.sql` — NNN é sequencial com três dígitos (ex: `000260_data_decisions.sql`).

**Função UUID:** Usar sempre `uuidv7()` (definida em migration `000010`). Nunca `uuid_generate_v7()` (não existe no schema do projecto).

```sql
-- ✅ Correcto
id uuid PRIMARY KEY DEFAULT uuidv7()

-- ❌ Falha em CI e produção
id uuid PRIMARY KEY DEFAULT uuid_generate_v7()
```

---

### 5. Readiness Snapshots — Refresh Explícito Obrigatório

**Regra:** `getReadinessPanelData()` lê snapshots existentes do DB — não recalcula. Para obter dados frescos, chamar `refreshUpcomingReadiness(sessionId)` ANTES de `getReadinessPanelData()`.

**Contextos onde o refresh deve ocorrer:**
- Carregamento da página `/prontidao` (server component)
- Botão ↻ no painel (client component `handleManualRefresh`)

```typescript
// ✅ Correcto — recalcula depois lê
await refreshUpcomingReadiness(sessionId);
const result = await getReadinessPanelData(sessionId);

// ❌ Errado — lê snapshots potencialmente stale
const result = await getReadinessPanelData(sessionId);
```
