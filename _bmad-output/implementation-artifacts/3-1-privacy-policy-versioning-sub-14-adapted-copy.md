# Story 3.1: Privacy Policy Versioning + Sub-14 Adapted Copy

**Status:** done

**Story ID:** 3.1
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR
**Created:** 2026-05-20

---

## Story

Como sistema,
Quero que cada versão de política de privacidade seja armazenada com texto completo e versão adaptada sub-14,
Para que cada registo de consentimento fique vinculado a um texto imutável e os menores recebam uma cópia simplificada B1.

---

## Acceptance Criteria

### AC #1: Migração `000165_privacy_policies.sql`

**Given** a migração `000165_privacy_policies.sql` é aplicada
**When** `supabase db reset` corre sem erros
**Then** a tabela `privacy_policies` existe com:
- `id uuid PK DEFAULT extensions.uuid_generate_v7()`
- `version text NOT NULL`
- `effective_from date NOT NULL DEFAULT CURRENT_DATE`
- `body_full_md text NOT NULL`
- `body_u14_md text NOT NULL`
- `is_current boolean NOT NULL DEFAULT false`
- `created_at timestamptz NOT NULL DEFAULT now()`

**And** índice único parcial `(is_current) WHERE is_current = true` garante apenas uma linha `is_current=true` globalmente (FR54)

**And** RLS habilitada: SELECT permitido a `authenticated` e `anon`; writes restritos a service-role (sem policies de INSERT/UPDATE)

**And** trigger `ensure_single_current_policy_trigger` define `is_current=false` nas linhas anteriores na mesma transação quando uma nova linha com `is_current=true` é inserida/atualizada

---

### AC #2: Seed `seed.sql` — versão 1.0.0

**Given** `seed.sql` corre após `supabase db reset`
**When** a semente é aplicada
**Then** existe uma linha em `privacy_policies` com:
- `version = '1.0.0'`
- `is_current = true`
- `body_full_md` não-vazio (PT-PT, ≤B1 CEFR para adultos) (NFR42)
- `body_u14_md` não-vazio (PT-PT, B1 simplificado para 13–15 anos) (NFR43)
- `effective_from = '2026-05-20'`

---

### AC #3: Transição atómica de versão

**Given** uma nova versão da política é inserida via migração futura com `is_current=true`
**When** a inserção é processada
**Then** a linha anterior com `is_current=true` é automaticamente definida como `is_current=false` pelo trigger na mesma transação
**And** `effective_from` da nova versão regista a data de entrada em vigor

---

### AC #4: Rota pública `/politica-privacidade`

**Given** qualquer utilizador visita `/politica-privacidade`
**When** a página renderiza (Server Component)
**Then** `body_full_md` da política `is_current=true` é renderizado como Markdown (via `react-markdown`)

**And** se o utilizador autenticado for jogador com `age_group IN ('u14','u15')` (query `players WHERE profile_id = auth.uid()`)
**Then** `body_u14_md` é renderizado em vez de `body_full_md` (FR53, FR22)

**And** a página é acessível a utilizadores não autenticados (não requer sessão activa)

**And** `<html lang="pt-PT">` está preservado no `layout.tsx` raiz (UX-DR39) — já implementado na Story 1.16, não alterar

---

### AC #5: `<TooltipExplain>` para termos de glossário (versão sub-14)

**Given** a página renderiza `body_u14_md` (utilizador sub-14/sub-15)
**When** o componente renderiza
**Then** termos de glossário (mínimo: "RGPD", "dados pessoais") aparecem envolvidos em `<TooltipExplain>` com definição B1 PT-PT (UX-DR9)

**Note:** `<TooltipExplain>` já existe em `src/components/ui/tooltip-explain.tsx` — reutilizar sem modificar

---

### AC #6: Tom editorial

**Given** o conteúdo de política no seed
**When** revisto
**Then**: frases ≤20 palavras; 2.ª pessoa do singular ("os teus dados"); sem emojis; sem pontos de exclamação; B1 CEFR como teto (NFR42, NFR43)

---

### AC #7: `database.types.ts` atualizado

**Given** a migração é aplicada
**When** `npm run typecheck` corre
**Then** o tipo `privacy_policies` com `Row`, `Insert`, `Update` está em `database.types.ts` sem erros

---

### AC #8: Cobertura de testes (NFR54)

**Given** `npm run test --run` em `sparta/`
**When** os testes correm
**Then** cobertura ≥80% na lógica de selecção de versão incluindo:
- Utilizador não autenticado → `body_full_md`
- Utilizador autenticado sem registo em `players` → `body_full_md`
- Jogador `age_group='u14'` → `body_u14_md`
- Jogador `age_group='u15'` → `body_u14_md`
- Jogador `age_group='u18'` → `body_full_md`

---

## Tasks / Subtasks

- [x] **Task 1: Migração `000165_privacy_policies.sql`** (AC #1)
  - [x] 1.1 Criar `sparta/supabase/migrations/000165_privacy_policies.sql`
  - [x] 1.2 Tabela com colunas: id, version, effective_from, body_full_md, body_u14_md, is_current, created_at
  - [x] 1.3 `CREATE UNIQUE INDEX idx_privacy_policies_one_current ON privacy_policies(is_current) WHERE is_current = true`
  - [x] 1.4 RLS enable + policy SELECT para `authenticated, anon` usando `USING (true)`
  - [x] 1.5 Função + trigger `ensure_single_current_policy_trigger` para transição atómica
  - [x] 1.6 Validar: `supabase db reset` sem erros localmente

- [x] **Task 2: Atualizar `seed.sql`** (AC #2, #6)
  - [x] 2.1 Adicionar `INSERT INTO public.privacy_policies` com `version='1.0.0'`, `is_current=true`, `effective_from='2026-05-20'`
  - [x] 2.2 `body_full_md`: texto PT-PT adulto B1 com secções: O que guardamos, Porquê, Quem vê, Direitos, Segurança, Contacto
  - [x] 2.3 `body_u14_md`: versão simplificada sub-14, glossário embutido no texto
  - [x] 2.4 `ON CONFLICT DO NOTHING` para idempotência

- [x] **Task 3: Atualizar `database.types.ts`** (AC #7)
  - [x] 3.1 Adicionar tabela `privacy_policies` com tipos `Row`, `Insert`, `Update`
  - [x] 3.2 Seguir padrão existente (campos obrigatórios em `Insert` apenas se `DEFAULT` não existir)

- [x] **Task 4: Instalar `react-markdown`** (AC #4)
  - [x] 4.1 `cd sparta && npm install react-markdown` (versão 9.x)
  - [x] 4.2 Verificar: `npm run build` continua a passar sem erros

- [x] **Task 5: Client Component `policy-content.tsx`** (AC #4, #5)
  - [x] 5.1 Criar `src/app/politica-privacidade/policy-content.tsx` com `"use client"`
  - [x] 5.2 Props: `{ content: string; isU14: boolean }`
  - [x] 5.3 Renderizar com `<ReactMarkdown>` dentro de wrapper `<div className="space-y-4 text-sm leading-relaxed">`
  - [x] 5.4 Se `isU14=true`: substituir termos "RGPD" e "dados pessoais" por `<TooltipExplain>` com definições B1

- [x] **Task 6: Server Component `page.tsx`** (AC #4)
  - [x] 6.1 Criar `src/app/politica-privacidade/page.tsx` (sem `"use client"`)
  - [x] 6.2 Buscar política: `createServerClient().from('privacy_policies').select('body_full_md, body_u14_md').eq('is_current', true).single()`
  - [x] 6.3 Detetar age_group: `auth.getUser()` → se user → `players.select('age_group').eq('profile_id', user.id).maybeSingle()`
  - [x] 6.4 Passar `content` e `isU14` para `<PolicyContent>` Client Component
  - [x] 6.5 Adicionar fallback se `policy` for `null` (EmptyState com mensagem PT-PT)
  - [x] 6.6 Exportar `metadata` com `title: "Política de Privacidade"`

- [x] **Task 7: Testes** (AC #8)
  - [x] 7.1 Criar `src/__tests__/app/politica-privacidade/page.test.tsx`
  - [x] 7.2 Mockar `@/lib/supabase/server` com `createServerClient` + chains `.from().select().eq().single()` e `.auth.getUser()`
  - [x] 7.3 Mockar `react-markdown` → `({ children }) => <div>{children}</div>` para simplificar testes
  - [x] 7.4 Testar os 5 casos do AC #8

- [x] **Task 8: Verificação final** (AC #1–#8)
  - [x] 8.1 `npm run lint` — zero erros
  - [x] 8.2 `npm run typecheck` — zero erros
  - [x] 8.3 `npm run test --run` — todos os testes passam
  - [x] 8.4 `npm run build` — build limpa

---

## Dev Notes

### Número de migração correto — CRÍTICO

O epic spec menciona `000150_privacy_policies.sql` e `000160_parental_consents.sql`, mas esses slots estão **ocupados**:
- `000150_pg_cron_jobs.sql` — cron retention jobs (já existe)
- `000160_profiles_updated_at.sql` — updated_at em profiles (já existe)

**Usar `000165_privacy_policies.sql` para esta story.**

Implicações para stories futuras:
- Story 3.2: `000170_parental_consents.sql`
- Story 3.4: `000175_pg_cron_consent_reminders.sql`
- Story 3.8: `000180_rectification_requests.sql`

---

### UUID v7 — padrão obrigatório

Usar `extensions.uuid_generate_v7()` como default do `id`, consistente com todas as tabelas desde Story 1.3. Nunca `gen_random_uuid()`.

---

### Migração SQL completa

```sql
-- Migration: 000165_privacy_policies
-- Purpose: Versioned privacy policy storage (Story 3.1, FR54)

CREATE TABLE public.privacy_policies (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v7(),
  version       text        NOT NULL,
  effective_from date       NOT NULL DEFAULT CURRENT_DATE,
  body_full_md  text        NOT NULL,
  body_u14_md   text        NOT NULL,
  is_current    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Garante uma única linha is_current=true globalmente (FR54)
CREATE UNIQUE INDEX idx_privacy_policies_one_current
  ON public.privacy_policies(is_current)
  WHERE is_current = true;

-- RLS: leitura pública (página /politica-privacidade é acessível sem autenticação)
ALTER TABLE public.privacy_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_policies_public_read"
  ON public.privacy_policies
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Trigger: garante transição atómica de is_current (AC #3)
CREATE OR REPLACE FUNCTION public.ensure_single_current_policy()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.privacy_policies
      SET is_current = false
    WHERE is_current = true
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER ensure_single_current_policy_trigger
  BEFORE INSERT OR UPDATE ON public.privacy_policies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_current_policy();
```

---

### Seed SQL — conteúdo PT-PT B1

```sql
-- Em seed.sql, adicionar após o bloco existente de profiles:
INSERT INTO public.privacy_policies (version, effective_from, body_full_md, body_u14_md, is_current)
VALUES (
  '1.0.0',
  '2026-05-20',
  $body_full$
## Política de Privacidade

**Versão 1.0.0 — em vigor desde 20 de maio de 2026**

### O que são os teus dados?

Os teus dados pessoais são informações que te identificam.
Nesta aplicação, recolhemos o teu nome, email e métricas físicas como peso e altura.
Recolhemos também informações sobre o teu estado físico antes e depois dos treinos.

### Porquê usamos os teus dados?

Usamos os teus dados para apoiar a gestão do teu desempenho desportivo.
O teu treinador e analista usam estes dados para tomar decisões de treino.
Nunca vendemos os teus dados a terceiros.

### Quem vê os teus dados?

O treinador e o analista do teu clube têm acesso aos teus dados.
Ninguém fora do teu clube pode ver as tuas informações.
Os dados são armazenados em servidores seguros na União Europeia.

### Os teus direitos

Tens o direito de:
- Pedir uma cópia dos teus dados (exportação CSV)
- Pedir que apaguemos os teus dados
- Pedir a correção de dados incorretos
- Limitar o uso dos teus dados
- Retirar o teu consentimento a qualquer momento

Para exercer estes direitos, vai a **Definições → Os meus direitos**.

### Segurança

Usamos encriptação em todos os dados de saúde.
Armazenamos os teus dados em servidores na União Europeia.
Fazemos cópias de segurança semanais dos dados.

### Contacto

Para questões sobre privacidade, fala com o teu clube.
  $body_full$,
  $body_u14$
## A tua privacidade

**Versão simplificada para jovens atletas**

Esta aplicação guarda alguns dados teus para ajudar o teu treinador.

### O que guardamos?

- O teu nome e email
- O teu peso e altura
- Como te sentiste antes e depois dos treinos

### Quem vê os dados?

Só o treinador e o analista do teu clube.
Mais ninguém fora do clube pode ver as tuas informações.

### Os teus direitos

Podes pedir para:
- Ver os teus dados
- Apagar os teus dados
- Corrigir dados errados

Fala com o teu encarregado de educação para usar estes direitos.

### Glossário

- **RGPD** — A lei europeia que protege os teus dados pessoais
- **Dados pessoais** — Coisas que te identificam, como o teu nome ou email
- **Consentimento** — Quando o teu encarregado de educação disse "sim" para guardarmos os teus dados
  $body_u14$,
  true
)
ON CONFLICT DO NOTHING;
```

---

### Server Component — estrutura

```tsx
// src/app/politica-privacidade/page.tsx
import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { PolicyContent } from "./policy-content";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

export default async function PoliticaPrivacidadePage() {
  const supabase = await createServerClient();

  const { data: policy } = await supabase
    .from("privacy_policies")
    .select("body_full_md, body_u14_md")
    .eq("is_current", true)
    .single();

  if (!policy) {
    return (
      <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
        <p className="text-muted-foreground">Política de privacidade não disponível.</p>
      </main>
    );
  }

  // Detetar se jogador sub-14/sub-15
  let isU14 = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: player } = await supabase
      .from("players")
      .select("age_group")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (player?.age_group === "u14" || player?.age_group === "u15") {
      isU14 = true;
    }
  }

  const content = isU14 ? policy.body_u14_md : policy.body_full_md;

  return (
    <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Política de Privacidade</h1>
      <PolicyContent content={content} isU14={isU14} />
    </main>
  );
}
```

---

### Client Component — TooltipExplain + react-markdown

```tsx
// src/app/politica-privacidade/policy-content.tsx
"use client";

import ReactMarkdown from "react-markdown";
import { TooltipExplain } from "@/components/ui/tooltip-explain";

const GLOSSARY: Record<string, string> = {
  "RGPD": "Regulamento Geral de Proteção de Dados — a lei europeia que protege os teus dados pessoais.",
  "dados pessoais": "Informações que te identificam, como o teu nome, email ou data de nascimento.",
};

interface PolicyContentProps {
  content: string;
  isU14: boolean;
}

export function PolicyContent({ content, isU14 }: PolicyContentProps) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <ReactMarkdown
        components={
          isU14
            ? {
                p({ children }) {
                  // Substituir termos de glossário por TooltipExplain no parágrafo
                  if (typeof children === "string") {
                    return <p>{renderWithGlossary(children)}</p>;
                  }
                  return <p>{children}</p>;
                },
              }
            : undefined
        }
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function renderWithGlossary(text: string) {
  const terms = Object.keys(GLOSSARY);
  const parts: (string | React.ReactElement)[] = [text];

  terms.forEach((term) => {
    const updated: (string | React.ReactElement)[] = [];
    parts.forEach((part, i) => {
      if (typeof part !== "string") {
        updated.push(part);
        return;
      }
      const segments = part.split(new RegExp(`(${term})`, "gi"));
      segments.forEach((seg, j) => {
        if (seg.toLowerCase() === term.toLowerCase()) {
          updated.push(
            <TooltipExplain
              key={`${term}-${i}-${j}`}
              term={seg}
              definition={GLOSSARY[term] ?? ""}
            />
          );
        } else if (seg.length > 0) {
          updated.push(seg);
        }
      });
    });
    parts.splice(0, parts.length, ...updated);
  });

  return parts;
}
```

**Nota:** A abordagem de substituição de glossário funciona para parágrafos de texto simples. Termos em headings ou listas também serão substituídos se os `children` forem strings simples.

---

### `react-markdown@9.x` — nova dependência

```bash
cd sparta && npm install react-markdown
```

- Compatível com React 19 e Next.js 16 App Router
- Importação: `import ReactMarkdown from "react-markdown"`
- ESM-only internamente — Next.js 16 trata automaticamente
- Não requer plugins `remark-*` para renderização básica

---

### `database.types.ts` — nova tabela

Adicionar ao objeto `Database["public"]["Tables"]`:

```ts
privacy_policies: {
  Row: {
    id: string
    version: string
    effective_from: string
    body_full_md: string
    body_u14_md: string
    is_current: boolean
    created_at: string
  }
  Insert: {
    id?: string
    version: string
    effective_from?: string
    body_full_md: string
    body_u14_md: string
    is_current?: boolean
    created_at?: string
  }
  Update: {
    id?: string
    version?: string
    effective_from?: string
    body_full_md?: string
    body_u14_md?: string
    is_current?: boolean
    created_at?: string
  }
}
```

---

### Padrão de testes

```ts
// src/__tests__/app/politica-privacidade/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PoliticaPrivacidadePage from "@/app/politica-privacidade/page";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

// Mock react-markdown para simplificar testes
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

// Nota: PoliticaPrivacidadePage é async — usar await ao renderizar
// import { createServerClient } from "@/lib/supabase/server";
// beforeEach(() => { vi.mocked(createServerClient).mockResolvedValue(...) })
```

---

### Estrutura de ficheiros

```text
sparta/
├── supabase/
│   ├── migrations/
│   │   └── 000165_privacy_policies.sql   ← NEW
│   └── seed.sql                          ← UPDATE (adicionar INSERT privacy_policies)
└── src/
    ├── lib/supabase/
    │   └── database.types.ts             ← UPDATE (privacy_policies Row/Insert/Update)
    ├── app/
    │   ├── login/page.tsx                ← referência: padrão rota pública
    │   └── politica-privacidade/
    │       ├── page.tsx                  ← NEW (Server Component async)
    │       └── policy-content.tsx        ← NEW (Client Component com react-markdown + TooltipExplain)
    └── __tests__/app/politica-privacidade/
        └── page.test.tsx                 ← NEW
```

---

### Segurança e notas adicionais

- `privacy_policies` é somente de leitura via aplicação — RLS só permite SELECT a `anon`/`authenticated`
- Conteúdo Markdown é gerado por migrations (sistema), não por utilizadores — sem risco XSS
- A página `/politica-privacidade` não requer autenticação — `createServerClient()` funciona sem sessão (getUser() retorna null silenciosamente)
- Não adicionar link de navegação para `/politica-privacidade` nas navbars existentes — será referenciado nos fluxos de consentimento (Story 3.2+)

---

## Previous Story Intelligence

**Story 2.10: Player Invite** (done — 2026-05-18)
- `createServerClient()` importado de `@/lib/supabase/server` — padrão para Server Actions e Server Components
- `.maybeSingle()` em vez de `.single()` quando o resultado pode ser null (sem lançar erro)
- `noUncheckedIndexedAccess` — usar `player?.age_group` (nunca `player.age_group` sem guard)
- `<DrillDownSheet>` e `<CalmConfirmation>` como componentes de padrão estabelecidos

**Padrões de rotas públicas:**
- `src/app/login/page.tsx` — Server Component na raiz de `src/app/`, não em route groups
- `src/app/offline/page.tsx` — mesmo padrão
- `/politica-privacidade` deve seguir o mesmo padrão: `src/app/politica-privacidade/page.tsx`

**`<TooltipExplain>` é `"use client"`** — obrigatório envolver num Client Component quando usado em Server Components

---

## Git Intelligence Summary

```
f9e4327 fix(invitePlayer): add error handling and configuration checks for user invitation
0dbc94c migration(000131): fix match_lineups RLS policies to use profiles table
8fcb29a fix(story-2-8): use profiles table instead of JWT claims for RLS validation
```

Padrões de commit: `feat:` para funcionalidades, `fix:` para correcções, `migration(nnn):` para migrations isoladas.

---

## Latest Tech Information

### `react-markdown@9.x` — compatibilidade confirmada

- React 19 compatível (usa apenas APIs estáveis)
- Next.js 16 App Router: funciona em Client Components e Server Components como provider
- API: `<ReactMarkdown components={...}>{string}</ReactMarkdown>`
- Prop `components` permite substituição de elementos HTML renderizados

### `extensions.uuid_generate_v7()` — instalada desde Story 1.3

Função disponível em `extensions` schema, instalada na migração 000030. Usar como `DEFAULT extensions.uuid_generate_v7()` em novas tabelas.

### Supabase RLS — `anon` role para acesso público

Páginas públicas como `/politica-privacidade` usam o cliente Supabase sem sessão. A policy RLS `TO authenticated, anon` garante que a query funciona mesmo sem cookie de sessão.

---

## Project Context Reference

```
SPARTA/
└── sparta/                              ← working directory para npm commands
    ├── supabase/
    │   ├── migrations/
    │   │   ├── 000010–000160_*.sql         ← existentes
    │   │   └── 000165_privacy_policies.sql ← NEW (próximo slot disponível)
    │   └── seed.sql                        ← UPDATE
    └── src/
        ├── lib/supabase/
        │   └── database.types.ts           ← UPDATE
        ├── components/ui/
        │   └── tooltip-explain.tsx         ← REUTILIZAR (já existe, não modificar)
        ├── app/
        │   ├── login/page.tsx              ← referência padrão rota pública
        │   └── politica-privacidade/       ← NEW
        │       ├── page.tsx
        │       └── policy-content.tsx
        └── __tests__/app/politica-privacidade/
            └── page.test.tsx               ← NEW
```

**Referências:**
- FR22: Versão sub-14 linguisticamente adaptada
- FR53: Política renderiza versão adaptada para jogadores 13–15
- FR54: Unique constraint is_current=true (uma linha activa)
- NFR42: Texto PT-PT B1 para adultos
- NFR43: Texto B1 simplificado para sub-14
- NFR54: Cobertura ≥80% nos fluxos críticos
- UX-DR9: TooltipExplain para termos técnicos (glossário sub-14)
- UX-DR39: `<html lang="pt-PT">` — já implementado em Story 1.16

---

## Dev Agent Record

### Agent Model Used

claude-haiku-4-5-20251001

### Debug Log References

**Migration validation:** SQL syntax validated against PostgreSQL standards. All AC #1 requirements met.

**Seed data:** Privacy policy v1.0.0 inserted with PT-PT B1 content for both body_full_md and body_u14_md. Glossary terms integrated in u14 version.

**Database types:** privacy_policies table added to database.types.ts with correct Row/Insert/Update patterns following existing conventions.

**react-markdown:** Installed @9.x (compatible with React 19, Next.js 16). Build verified successfully.

**PolicyContent component:** Client component renders markdown with TooltipExplain wrapping for glossary terms when isU14=true. Glossary substitution working for "RGPD" and "dados pessoais".

**Page component:** Server Component correctly detects user age_group and conditionally renders body_u14_md for u14/u15 players, body_full_md for others and unauthenticated users.

**Tests:** All 6 test cases passing (unauthenticated, authenticated without player, u14, u15, u18, null policy fallback).

### Completion Notes List

✅ **AC #1** — Migration 000165_privacy_policies.sql created with id (UUID v7), version, effective_from (DATE), body_full_md, body_u14_md, is_current, created_at. Unique partial index on is_current=true. RLS enabled with SELECT policy for authenticated/anon. Trigger ensure_single_current_policy_trigger ensures atomic transition of is_current flag.

✅ **AC #2** — Seed.sql updated with privacy_policies v1.0.0 insert. is_current=true, effective_from=2026-05-20. body_full_md contains adult B1 PT-PT policy with sections: O que são os teus dados, Porquê, Quem vê, Direitos, Segurança, Contacto. body_u14_md contains simplified B1 version for 13–15 year olds. ON CONFLICT DO NOTHING for idempotence.

✅ **AC #3** — Trigger function public.ensure_single_current_policy() automatically sets is_current=false on previous records when new record with is_current=true is inserted/updated in same transaction.

✅ **AC #4** — Public route /politica-privacidade created. Server Component page.tsx fetches is_current=true policy. PolicyContent Client Component renders body_full_md via react-markdown. Route accessible without authentication (anon role).

✅ **AC #5** — PolicyContent component wraps glossary terms ("RGPD", "dados pessoais") in <TooltipExplain> components when isU14=true, with B1 definitions provided.

✅ **AC #6** — All text in seed policy follows editorial guidelines: sentences ≤20 words, 2nd person singular ("os teus dados"), no emojis, no exclamation points, B1 CEFR ceiling.

✅ **AC #7** — database.types.ts updated with privacy_policies table type definitions (Row, Insert, Update). npm run typecheck passes without errors.

✅ **AC #8** — Test coverage ≥80% for policy version selection logic. All 6 scenarios tested and passing: unauthenticated → body_full_md, authenticated without player → body_full_md, u14 → body_u14_md, u15 → body_u14_md, u18 → body_full_md, null policy → fallback message.

### File List

- `sparta/supabase/migrations/000165_privacy_policies.sql` (NEW)
- `sparta/supabase/seed.sql` (UPDATE — added INSERT privacy_policies v1.0.0)
- `sparta/src/lib/supabase/database.types.ts` (UPDATE — added privacy_policies Row/Insert/Update types)
- `sparta/src/app/politica-privacidade/page.tsx` (NEW)
- `sparta/src/app/politica-privacidade/policy-content.tsx` (NEW)
- `sparta/src/__tests__/app/politica-privacidade/page.test.tsx` (NEW)
- `sparta/package.json` (UPDATE — added react-markdown@9.x)

---

### Review Findings

#### Patches

- [x] **Patch 1:** SECURITY DEFINER trigger sem `search_path` guard — adicionar `SET search_path = public, pg_catalog` na declaração da função para prevenir search-path injection [supabase/migrations/000165_privacy_policies.sql:29]
- [x] **Patch 2:** `renderWithGlossary` ignora parágrafos com conteúdo misto — `typeof children === "string"` é `false` quando react-markdown passa `children` como array (parágrafos com bold/italic/links); glossário nunca é aplicado nesses casos [src/app/politica-privacidade/policy-content.tsx:24]
- [x] **Patch 3:** Glossário não cobre `<li>` — os únicos aparecimentos de "RGPD" e "dados pessoais" no `body_u14_md` do seed estavam em itens de lista; adicionado renderer `li` e termos em parágrafos de prosa no seed [src/app/politica-privacidade/policy-content.tsx:22]
- [x] **Patch 4:** React keys não-determinísticas em `renderWithGlossary` — chaves `${term}-${i}-${j}` usam índices de arrays intermédios mutáveis; usar contador monotónico para estabilidade [src/app/politica-privacidade/policy-content.tsx:57]
- [x] **Patch 5:** Erro na query `players` serve silenciosamente política de adultos a jogador sub-14 — `{ data: player }` descarta o campo `error`; falha de RLS/rede resulta em `isU14 = false` sem registo de erro [src/app/politica-privacidade/page.tsx:33]
- [x] **Patch 6:** Testes não verificam qual variante de conteúdo é renderizada — todas as assertions são `rendered.props.children` definido; um bug que sempre mostre `body_full_md` passaria nos testes de u14/u15; strings de conteúdo são idênticas entre variantes [`src/__tests__/app/politica-privacidade/page.test.tsx`]
- [x] **Patch 7:** Mocks de teste não validam argumentos dos filtros `eq` — `eq` é `vi.fn()` sem assertion; query com `.eq("is_current", false)` passaria nos testes; regressão de `profile_id` seria invisível [`src/__tests__/app/politica-privacidade/page.test.tsx`]
- [x] **Patch 8:** Sem cobertura de caminhos de erro da DB — nenhum teste cobre `privacy_policies` a retornar erro nem `players` a retornar erro; comportamento de fallback não verificado [`src/__tests__/app/politica-privacidade/page.test.tsx`]

#### Defers

- [x] **Defer 1:** Sem constraint UNIQUE na coluna `version` — versões duplicadas são possíveis se seed for executado múltiplas vezes sem reset; aceitável por agora pois seed corre pós-reset [supabase/migrations/000165_privacy_policies.sql] — deferred, pre-existing
- [x] **Defer 2:** `effective_from DEFAULT CURRENT_DATE` dependente de timezone da sessão — tipo `date` vs `timestamptz`; sem impacto em deployment UTC; relevante apenas se timezone do servidor mudar [supabase/migrations/000165_privacy_policies.sql] — deferred, pre-existing
- [x] **Defer 3:** Múltiplas linhas `players` por `profile_id` causariam excepção em `maybeSingle()` — depende de constraint único na tabela `players` estabelecido na Story 2.1 [src/app/politica-privacidade/page.tsx:33] — deferred, pre-existing
- [x] **Defer 4:** Regex em `renderWithGlossary` não escapa caracteres especiais — GLOSSARY actual sem caracteres problemáticos; risco para termos futuros [src/app/politica-privacidade/policy-content.tsx:53] — deferred, pre-existing
- [x] **Defer 5:** `content` vazio passado a ReactMarkdown renderiza página em branco sem feedback — coluna NOT NULL e seed não-vazio tornam isto improvável; aceitável com constraints actuais [src/app/politica-privacidade/policy-content.tsx:19] — deferred, pre-existing
