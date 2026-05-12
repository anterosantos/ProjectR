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
- Tests must run from `project-r/` directory (not repo root) for alias resolution
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

Tests must be run from the `project-r/` directory for correct alias and setup resolution.

**From project-r/:**
```bash
npm run test          # Watch mode
npm run test --run    # Single run
npm run test:watch    # Explicit watch
```

**From repo root (monorepo style):**
```bash
npm run -w project-r test       # Watch mode
npm run -w project-r test --run # Single run
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
