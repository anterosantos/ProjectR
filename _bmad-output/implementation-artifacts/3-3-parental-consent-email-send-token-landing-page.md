# Story 3.3: Consentimento Parental — Envio de Email & Página de Confirmação por Token

**Status:** review

**Story ID:** 3.3
**Epic:** Epic 3 — Consentimento Parental & Direitos GDPR
**Created:** 2026-05-20

---

## Story

Como Encarregado de Educação,
Quero receber um email com um link de um clique que confirme o meu consentimento sem criar conta,
Para que possa autorizar a participação do meu filho com o mínimo de fricção.

---

## Acceptance Criteria

### AC #1: Edge Function `send-parental-consent` envia email via Resend

**Given** uma linha em `parental_consents` com `status='pending'`
**When** a Edge Function `send-parental-consent` é invocada com `{ consentId: string }`
**Then** a Resend EU envia o email para `parent_email`
**And** o email usa o template HTML inline-CSS `ParentalConsentEmail` (UX-DR23): ≤50KB, fallback plain-text, B1 PT-PT, ≤200 palavras, CTA único "Confirmar consentimento"
**And** o email inclui o link `https://<host>/consentimento/<token>`
**And** o subject é "Consentimento parental — SPARTA"

---

### AC #2: Página `/consentimento/[token]` — renderização server-side

**Given** o Encarregado clica o link
**When** a rota `/consentimento/[token]` é pedida
**Then** a página é Server Component, renderizada no servidor, funcional sem JavaScript (progressive enhancement)
**And** a página chama a Edge Function `consent-validate?token=xxx` no lado do servidor para obter o estado

---

### AC #3: Estado "válido" — exibe política e botões

**Given** o token é válido, `status='pending'` e não expirado
**When** a página renderiza
**Then** mostra o nome do menor
**And** mostra o `body_full_md` da política de privacidade actual renderizado como Markdown
**And** mostra botão primário "Confirmo o consentimento" e botão ghost "Recusar" (UX-DR30)
**And** a UI funciona com ou sem JavaScript — formulário HTML nativo com Server Action

---

### AC #4: Estados de erro/expirado/já processado

**Given** o token está no estado `expired` (>90 dias), `confirmed`, `withdrawn`, ou é inválido/não encontrado
**When** a página renderiza
**Then** mostra `<EmptyState>` (UX-DR8) com mensagem apropriada em PT-PT B1
**And** não revela informação de validade além do que o utilizador pode inferir (sem enumeration leak)
**And** sem botões de ação

---

### AC #5: Confirmação do consentimento

**Given** o Encarregado submete "Confirmo o consentimento"
**When** a Server Action processa a submissão
**Then** a Server Action invoca `consent-validate` com `{ token, action: 'confirm', ip: string }`
**And** a Edge Function atualiza `parental_consents SET status='confirmed', confirmed_at=now(), confirmed_ip=<ip>` (FR6)
**And** `profiles.consent_status = 'granted'` para o `profile_id` do jogador
**And** regista em `audit_logs`: `action='consent.confirmed'`, `target_kind='player'`, `target_id=playerId`
**And** envia email de confirmação via Resend: "Consentimento registado em DD/MM/YYYY" (template `ConsentConfirmationEmail`)
**And** o jogador pode agora aceder à app (middleware da Story 3.2 deixa passar)
**And** a página redireciona para `/consentimento/[token]` → que agora mostra estado `confirmed` com `<EmptyState>`

---

### AC #6: Recusa do consentimento

**Given** o Encarregado submete "Recusar"
**When** a Server Action processa
**Then** a Edge Function atualiza `parental_consents SET status='withdrawn', confirmed_at=now()`
**And** `profiles.consent_status = 'revoked'`
**And** regista em `audit_logs`: `action='consent.withdrawn'`, `target_kind='player'`, `target_id=playerId`
**And** a app permanece bloqueada para o jogador
**And** a página redireciona para `/consentimento/[token]` → que mostra estado `withdrawn` com `<EmptyState>`

---

### AC #7: `resendConsentEmail` — envio real (substituição do stub)

**Given** o staff clica "Reenviar email" na página `/aguardar-consentimento`
**When** `resendConsentEmail` é chamado
**Then** invoca a Edge Function `send-parental-consent` com `{ consentId }` do registo `pending` actual
**And** retorna `ok({ message: 'Email de consentimento reenviado.' })`
**And** a Edge Function envia o email com o mesmo template

---

### AC #8: `initiateParentalConsent` — dispara email após criação

**Given** `initiateParentalConsent` cria com sucesso uma linha em `parental_consents`
**When** a inserção é bem-sucedida
**Then** chama `send-parental-consent` Edge Function (fire-and-forget, não bloqueia o retorno da Server Action)

---

### AC #9: Residência UE e sem trackers

**Given** o requisito de residência EU (NFR30, NFR22)
**When** o Resend é invocado
**Then** é usada a instância EU de Resend (`https://api.resend.com/emails` com conta configurada para EU)
**And** o template HTML não contém tracking pixels, scripts externos ou CDN links

---

### AC #10: Cobertura de testes (NFR54)

**Given** `npm run test --run` em `sparta/`
**When** os testes correm
**Then** cobertura ≥80% inclui:
- Lógica da Server Action `submitConsentDecision`: confirm, withdraw, token inválido, token expirado
- Renderização da landing page: estado `valid`, `expired`, `confirmed`, `withdrawn`, `invalid`
- `resendConsentEmail` actualizado: chamada à Edge Function mockada
- `initiateParentalConsent` actualizado: verificar que Edge Function é chamada fire-and-forget

---

## Tasks / Subtasks

- [x] **Task 1: Edge Function `send-parental-consent`** (AC #1, #8)
  - [x] 1.1 Criar `sparta/supabase/functions/_shared/` (pasta partilhada)
  - [x] 1.2 Template HTML inline em `send-parental-consent/index.ts` (sem ficheiro externo necessário)
  - [x] 1.3 Criar `sparta/supabase/functions/send-parental-consent/deno.json` com imports `@supabase/supabase-js`
  - [x] 1.4 Criar `sparta/supabase/functions/send-parental-consent/index.ts`:
    - Aceitar POST `{ consentId: string }`
    - Obter `parental_consents` via service-role: `token`, `parent_email`, `player_id`, `token_expires_at`
    - Obter nome do jogador: `players WHERE id = player_id SELECT full_name`
    - Construir link: `${Deno.env.get('SITE_URL') || 'https://sparta.vercel.app'}/consentimento/${token}`
    - Renderizar HTML template `parentalConsentEmailHtml({ playerName, confirmUrl, expiresAt })`
    - Enviar via Resend API com `Authorization: Bearer ${RESEND_API_KEY}`
    - Retornar `{ ok: true }` ou erro estruturado

- [x] **Task 2: Edge Function `consent-validate`** (AC #2, #3, #4, #5, #6)
  - [x] 2.1 Criar `sparta/supabase/functions/consent-validate/deno.json`
  - [x] 2.2 Criar `sparta/supabase/functions/consent-validate/index.ts`:
    - **GET `?token=xxx`**: busca `parental_consents WHERE token = xxx` → retorna `{ state, playerName?, policyBody?, tokenExpiresAt? }`
    - **POST `{ token, action, ip }`**: valida token `pending`, executa `confirm` ou `withdraw`
    - Em `confirm`: UPDATE `parental_consents`, UPDATE `profiles`, INSERT `audit_logs`, chamar `send-confirmation-email`
    - Em `withdraw`: UPDATE `parental_consents`, UPDATE `profiles`, INSERT `audit_logs`
    - Tratar estados: `valid/pending`, `expired`, `confirmed`, `withdrawn`, `invalid`

- [x] **Task 3: Templates HTML de email** (AC #1, #5, #9)
  - [x] 3.1 Templates HTML inline em Edge Functions (sem CDN), max 50KB, PT-PT B1, sem tracking pixels, plain-text fallback obrigatório

- [x] **Task 4: Landing page `/consentimento/[token]`** (AC #2, #3, #4)
  - [x] 4.1 Criar `sparta/src/app/consentimento/[token]/page.tsx` (Server Component async):
    - Chamar Edge Function GET: `${SUPABASE_URL}/functions/v1/consent-validate?token=${token}` com `Authorization: Bearer ${SERVICE_ROLE_KEY}`
    - `cache: 'no-store'` (estado dinâmico)
    - Renderizar `<ConsentForm>` (valid), `<EmptyState>` (expired/confirmed/withdrawn/invalid)
  - [x] 4.2 Criar `sparta/src/app/consentimento/[token]/actions.ts` (Server Action):
    - `'use server'`; importar `headers` de `next/headers`
    - `submitConsentDecision(formData: FormData)`: extrai token/action, extrai IP, POST para Edge Function, redirect
  - [x] 4.3 Criar `sparta/src/app/consentimento/[token]/consent-form.tsx` (Client Component — progressive enhancement):
    - `<form action={submitConsentDecision}>` com hidden token, botão confirm e botão ghost withdraw
    - Exibe `body_full_md` via `<ReactMarkdown>`

- [x] **Task 5: Actualizar `consent.ts` — email real** (AC #7, #8)
  - [x] 5.1 Em `initiateParentalConsent`, após inserção: fire-and-forget `void fetch(send-parental-consent)` com `.catch`
  - [x] 5.2 Substituir `resendConsentEmail` stub: `await fetch(send-parental-consent)`, retorna `ok` ou `err({ code: 'internal' })`

- [x] **Task 6: Verificar dependência Story 3.2** (pré-condição)
  - [x] 6.1 Confirmado: `supabase/migrations/000170_parental_consents.sql` existe
  - [x] 6.2 Confirmado: `src/lib/actions/consent.ts` existe com `initiateParentalConsent` e `resendConsentEmail`
  - [x] 6.3 Confirmado: `profiles.consent_status` na migration 000170
  - [x] 6.4 Confirmado: `src/app/(player)/aguardar-consentimento/page.tsx` existe
  - [x] 6.5 Story 3.2 implementada — dependências satisfeitas

- [x] **Task 7: Variáveis de ambiente** (AC #1, #9)
  - [x] 7.1 `RESEND_API_KEY` já existia; adicionado `SITE_URL=https://sparta.vercel.app` ao `.env.example`
  - [x] 7.2 Documentado no `.env.example` que deve ser adicionado como secret nas Edge Functions
  - [x] 7.3 `SUPABASE_SERVICE_ROLE_KEY` já existe como secret das Edge Functions

- [x] **Task 8: Testes** (AC #10)
  - [x] 8.1 Testes de `initiateParentalConsent` (fire-and-forget) e `resendConsentEmail` (Edge Function call) em `consent.test.ts` actualizado
  - [x] 8.2 Criar `sparta/src/__tests__/app/consentimento/actions.test.ts`: confirm, withdraw, network error, token em falta (4 testes ✅)
  - [x] 8.3 Criar `sparta/src/__tests__/app/consentimento/page.test.tsx`: valid, expired, confirmed, withdrawn, invalid, fetch error, fallback playerName (7 testes ✅)

- [x] **Task 9: Verificação final**
  - [x] 9.1 `npm run lint` — zero erros (47 warnings pré-existentes)
  - [x] 9.2 `npm run typecheck` — zero erros
  - [x] 9.3 `npm run test --run` — 812 testes (796 ✅, 1 falha pré-existente anonymize-player timeout, 15 skip)
  - [x] 9.4 `npm run build` — build limpa ✅, `/consentimento/[token]` gerada

---

## Dev Notes

### DEPENDÊNCIA CRÍTICA: Story 3.2 deve ser implementada primeiro

Story 3.3 **não pode** ser implementada sem Story 3.2. Os seguintes artefactos devem existir antes de começar:

| Artefacto | Caminho | Fornecido por |
|-----------|---------|---------------|
| Migração `parental_consents` | `supabase/migrations/000170_parental_consents.sql` | Story 3.2 |
| Server action `consent.ts` | `src/lib/actions/consent.ts` | Story 3.2 |
| Tipos `parental_consents` | `src/lib/supabase/database.types.ts` | Story 3.2 |
| Utilitário `age.ts` | `src/lib/utils/age.ts` | Story 3.2 |
| Utilitário `mask-email.ts` | `src/lib/utils/mask-email.ts` | Story 3.2 |
| Página `/aguardar-consentimento` | `src/app/(player)/aguardar-consentimento/page.tsx` | Story 3.2 |
| Consent gate no `proxy.ts` | `src/proxy.ts` (bloco antes de `ROLE_ALLOWED_ROUTES`) | Story 3.2 |

**Se Story 3.2 ainda não foi implementada:** implementar Story 3.2 primeiro, usando o ficheiro `3-2-parental-consent-schema-token-generation-underage-access-block.md`.

---

### Padrão de Edge Functions neste projecto

Ver ficheiros existentes: `supabase/functions/auth-hook/index.ts` e `supabase/functions/anonymize-player-photos/index.ts`.

**Padrão correcto (export default handler, NÃO `serve()`):**
```ts
// supabase/functions/<name>/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

const handler = async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // lógica...
  
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
```

**deno.json padrão** (igual aos existentes):
```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.46.0"
  }
}
```

---

### `send-parental-consent` — estrutura completa

```ts
// supabase/functions/send-parental-consent/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const siteUrl = Deno.env.get("SITE_URL") || "https://sparta.vercel.app";

  const { consentId } = await req.json() as { consentId: string };
  if (!consentId) {
    return new Response(JSON.stringify({ error: "consentId required" }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch consent record
  const { data: consent, error: consentError } = await supabase
    .from("parental_consents")
    .select("token, parent_email, player_id, token_expires_at, status")
    .eq("id", consentId)
    .single();

  if (consentError || !consent) {
    return new Response(JSON.stringify({ error: "Consent not found" }), { status: 404 });
  }

  if (consent.status !== "pending") {
    return new Response(JSON.stringify({ error: "Consent is not pending" }), { status: 409 });
  }

  // Fetch player name
  const { data: player } = await supabase
    .from("players")
    .select("full_name")
    .eq("id", consent.player_id)
    .single();

  const playerName = player?.full_name ?? "o seu educando";
  const confirmUrl = `${siteUrl}/consentimento/${consent.token}`;
  const expiresAt = new Date(consent.token_expires_at).toLocaleDateString("pt-PT");

  // Render email HTML
  const { html, text } = parentalConsentEmailHtml({ playerName, confirmUrl, expiresAt });

  // Send via Resend
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SPARTA <noreply@sparta.app>",
      to: [consent.parent_email],
      subject: "Consentimento parental — SPARTA",
      html,
      text,
    }),
  });

  if (!resendRes.ok) {
    const body = await resendRes.text();
    console.error("[send-parental-consent] Resend error:", body);
    return new Response(JSON.stringify({ error: "Email send failed" }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// Email template (inline — sem dependência externa)
function parentalConsentEmailHtml({ playerName, confirmUrl, expiresAt }: {
  playerName: string;
  confirmUrl: string;
  expiresAt: string;
}): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Consentimento parental</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Pedido de consentimento parental</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Foi criada uma conta para <strong>${playerName}</strong> na plataforma SPARTA,
    utilizada pelo clube para gerir sessões desportivas e bem-estar dos atletas.
  </p>
  <p style="font-size:14px;line-height:1.6;margin-bottom:24px;">
    Para que ${playerName} possa aceder, precisamos da sua autorização como encarregado de educação.
    O link é válido até ${expiresAt}.
  </p>
  <a href="${confirmUrl}"
     style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
    Confirmar consentimento
  </a>
  <p style="font-size:12px;color:#737373;margin-top:24px;">
    Se não reconhece este pedido, pode ignorar este email. Os dados só serão recolhidos após confirmação.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA · Gestão desportiva · <a href="${confirmUrl}" style="color:#A3A3A3;">${confirmUrl}</a></p>
</body>
</html>`;

  const text = `Pedido de consentimento parental — SPARTA

Foi criada uma conta para ${playerName} na plataforma SPARTA.
Para autorizar o acesso, clique no link abaixo (válido até ${expiresAt}):

${confirmUrl}

Se não reconhece este pedido, ignore este email.`;

  return { html, text };
}

export default handler;
```

---

### `consent-validate` — estrutura completa

```ts
// supabase/functions/consent-validate/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

type ConsentState = "valid" | "expired" | "confirmed" | "withdrawn" | "invalid";

const handler = async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);

  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ state: "invalid" }), { status: 400 });

    const { data: consent } = await supabase
      .from("parental_consents")
      .select("id, status, player_id, token_expires_at, policy_version_id")
      .eq("token", token)
      .maybeSingle();

    if (!consent) {
      return jsonResponse({ state: "invalid" as ConsentState });
    }

    // Map status to state
    if (consent.status === "confirmed") return jsonResponse({ state: "confirmed" as ConsentState });
    if (consent.status === "withdrawn") return jsonResponse({ state: "withdrawn" as ConsentState });

    // Check expiry even if status is pending
    const isExpired = new Date(consent.token_expires_at) < new Date();
    if (consent.status === "expired" || isExpired) {
      // Update to expired if not already
      if (consent.status === "pending" && isExpired) {
        await supabase.from("parental_consents").update({ status: "expired" }).eq("id", consent.id);
      }
      return jsonResponse({ state: "expired" as ConsentState });
    }

    // Valid pending — fetch display data
    const { data: player } = await supabase
      .from("players")
      .select("full_name")
      .eq("id", consent.player_id)
      .single();

    const { data: policy } = await supabase
      .from("privacy_policies")
      .select("body_full_md")
      .eq("id", consent.policy_version_id)
      .single();

    return jsonResponse({
      state: "valid" as ConsentState,
      playerName: player?.full_name ?? "o seu educando",
      policyBody: policy?.body_full_md ?? "",
      tokenExpiresAt: consent.token_expires_at,
    });
  }

  if (req.method === "POST") {
    const { token, action, ip } = await req.json() as {
      token: string;
      action: "confirm" | "withdraw";
      ip?: string;
    };

    if (!token || !action) {
      return new Response(JSON.stringify({ error: "token and action required" }), { status: 400 });
    }

    // Fetch consent — must be pending and not expired
    const { data: consent } = await supabase
      .from("parental_consents")
      .select("id, player_id, club_id, parent_email, token_expires_at, policy_version_id")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (!consent) {
      return new Response(JSON.stringify({ error: "Consent not found or already processed" }), { status: 404 });
    }

    if (new Date(consent.token_expires_at) < new Date()) {
      await supabase.from("parental_consents").update({ status: "expired" }).eq("id", consent.id);
      return new Response(JSON.stringify({ error: "Token expired" }), { status: 410 });
    }

    // Fetch player profile_id
    const { data: player } = await supabase
      .from("players")
      .select("profile_id, full_name")
      .eq("id", consent.player_id)
      .single();

    if (action === "confirm") {
      await supabase.from("parental_consents").update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_ip: ip ?? null,
      }).eq("id", consent.id);

      if (player?.profile_id) {
        await supabase.from("profiles").update({ consent_status: "granted" }).eq("id", player.profile_id);
      }

      await supabase.from("audit_logs").insert({
        club_id: consent.club_id,
        action: "consent.confirmed",
        target_kind: "player",
        target_id: consent.player_id,
        payload: { consent_id: consent.id, confirmed_ip: ip ?? null },
      });

      // Send confirmation email
      const confirmedAt = new Date().toLocaleDateString("pt-PT");
      const playerName = player?.full_name ?? "o seu educando";
      await sendConfirmationEmail({ resendApiKey, parentEmail: consent.parent_email, playerName, confirmedAt });

      return jsonResponse({ ok: true, action: "confirmed" });
    }

    if (action === "withdraw") {
      await supabase.from("parental_consents").update({
        status: "withdrawn",
        confirmed_at: new Date().toISOString(),
      }).eq("id", consent.id);

      if (player?.profile_id) {
        await supabase.from("profiles").update({ consent_status: "revoked" }).eq("id", player.profile_id);
      }

      await supabase.from("audit_logs").insert({
        club_id: consent.club_id,
        action: "consent.withdrawn",
        target_kind: "player",
        target_id: consent.player_id,
        payload: { consent_id: consent.id },
      });

      // Staff notification deferred to Story 3.4 (pg_cron reminders + alerts)
      return jsonResponse({ ok: true, action: "withdrawn" });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  }

  return new Response("Method not allowed", { status: 405 });
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendConfirmationEmail({ resendApiKey, parentEmail, playerName, confirmedAt }: {
  resendApiKey: string;
  parentEmail: string;
  playerName: string;
  confirmedAt: string;
}): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Consentimento registado</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Consentimento registado</h1>
  <p style="font-size:14px;line-height:1.6;">
    O seu consentimento para <strong>${playerName}</strong> foi registado em ${confirmedAt}.
  </p>
  <p style="font-size:14px;line-height:1.6;margin-top:16px;">
    ${playerName} pode agora aceder à plataforma SPARTA.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA · Gestão desportiva</p>
</body>
</html>`;

  const text = `Consentimento registado — SPARTA\n\nO seu consentimento para ${playerName} foi registado em ${confirmedAt}.\n${playerName} pode agora aceder à plataforma.`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SPARTA <noreply@sparta.app>",
      to: [parentEmail],
      subject: `Consentimento registado em ${confirmedAt}`,
      html,
      text,
    }),
  });
}

export default handler;
```

---

### Landing page `/consentimento/[token]` — estrutura completa

```tsx
// src/app/consentimento/[token]/page.tsx
import type { Metadata } from "next";
import { EmptyState } from "@/components/patterns/EmptyState";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Confirmação de consentimento parental" };

type ConsentState = "valid" | "expired" | "confirmed" | "withdrawn" | "invalid";

interface ConsentValidateResponse {
  state: ConsentState;
  playerName?: string;
  policyBody?: string;
  tokenExpiresAt?: string;
}

async function getConsentState(token: string): Promise<ConsentValidateResponse> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/consent-validate?token=${encodeURIComponent(token)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return { state: "invalid" };
    return (await res.json()) as ConsentValidateResponse;
  } catch {
    return { state: "invalid" };
  }
}

const STATE_MESSAGES: Record<Exclude<ConsentState, "valid">, { title: string; description: string }> = {
  expired: {
    title: "Link expirado",
    description: "O link de consentimento expirou ao fim de 90 dias. Contacte o clube para receber um novo pedido.",
  },
  confirmed: {
    title: "Consentimento já confirmado",
    description: "O consentimento parental já foi registado. O seu educando pode aceder à plataforma.",
  },
  withdrawn: {
    title: "Consentimento recusado",
    description: "O consentimento foi recusado. O acesso do seu educando permanece bloqueado. Contacte o clube se mudou de ideias.",
  },
  invalid: {
    title: "Link inválido",
    description: "Este link não é válido. Verifique se copiou o link completo do email.",
  },
};

export default async function ConsentimentoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getConsentState(token);

  if (data.state !== "valid") {
    const msg = STATE_MESSAGES[data.state];
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <EmptyState
            title={msg.title}
            description={msg.description}
          />
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="max-w-prose mx-auto px-4 py-8">
      <ConsentForm
        token={token}
        playerName={data.playerName ?? "o seu educando"}
        policyBody={data.policyBody ?? ""}
        tokenExpiresAt={data.tokenExpiresAt}
      />
    </main>
  );
}
```

```tsx
// src/app/consentimento/[token]/consent-form.tsx
"use client";

import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { submitConsentDecision } from "./actions";

interface Props {
  token: string;
  playerName: string;
  policyBody: string;
  tokenExpiresAt?: string;
}

export function ConsentForm({ token, playerName, policyBody, tokenExpiresAt }: Props) {
  const expiresAt = tokenExpiresAt
    ? new Date(tokenExpiresAt).toLocaleDateString("pt-PT")
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pedido de consentimento parental</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Para autorizar o acesso de <strong>{playerName}</strong> à plataforma, leia a política abaixo e confirme o seu consentimento.
        </p>
        {expiresAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Este link é válido até {expiresAt}.
          </p>
        )}
      </div>

      <div className="prose prose-sm max-w-none border rounded-md p-4 max-h-96 overflow-y-auto bg-surface">
        <ReactMarkdown>{policyBody}</ReactMarkdown>
      </div>

      <form action={submitConsentDecision} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          name="action"
          value="confirm"
          className="w-full"
        >
          Confirmo o consentimento
        </Button>
        <Button
          type="submit"
          name="action"
          value="withdraw"
          variant="ghost"
          className="w-full"
        >
          Recusar
        </Button>
      </form>
    </div>
  );
}
```

```ts
// src/app/consentimento/[token]/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function submitConsentDecision(formData: FormData): Promise<void> {
  const token = formData.get("token") as string;
  const action = formData.get("action") as "confirm" | "withdraw";

  if (!token || !action) {
    redirect(`/consentimento/${token ?? ""}`);
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-real-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/consent-validate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ token, action, ip }),
      }
    );
  } catch (e) {
    console.error("[consent] consent-validate Edge Function failed:", e);
  }

  // Redirect always — page will show updated state from Edge Function GET
  redirect(`/consentimento/${token}`);
}
```

---

### Chamada à Edge Function em `consent.ts` — padrão correcto

```ts
// Em initiateParentalConsent, após ok({ consentId }):
// (inserir ANTES do return para garantir fire-and-forget)

// Disparar envio de email (fire-and-forget — não bloqueia)
void fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-parental-consent`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ consentId: consent.id }),
}).catch((e) => console.error("[consent] send-parental-consent failed:", e));

return ok({ consentId: consent.id });
```

**Porquê `void` e não `.catch` sem `await`?** — `void` suprime o warning de "promise ignorada" no TypeScript estrito, enquanto `.catch` garante que erros são logados. Ambos são necessários.

---

### Sem `serve()` — aviso importante

`serve()` de `https://deno.land/std@0.168.0/http/server.ts` está a ser abandonado em favor de `export default handler`. Ver `auth-hook/index.ts` como referência — esse ficheiro AINDA usa `serve()` mas é um padrão antigo. Novos Edge Functions devem usar `export default handler`.

---

### Rota `/consentimento/[token]` — localização correcta

- A rota está em `src/app/consentimento/[token]/page.tsx` (NÃO em `(player)` ou `(staff)`)
- O proxy já permite paths `/consentimento/*` sem autenticação (ver `proxy.ts` linha 28)
- NÃO adicionar `/consentimento` a `ROLE_ALLOWED_ROUTES` — está em `PUBLIC_PATHS`

---

### `EmptyState` — componente existente

Ver `src/components/patterns/EmptyState.tsx` (criado na Story 1.8). Props: `title: string`, `description: string`, `cta?: { label: string, href: string }`. NÃO reinventar.

---

### `ReactMarkdown` — já instalado

`react-markdown@^9.1.0` está em `package.json`. Ver padrão de uso em `src/app/politica-privacidade/policy-content.tsx`. Importar como:
```ts
import ReactMarkdown from "react-markdown";
```

---

### Sem migração nova — tudo vem da Story 3.2

Story 3.3 não cria novas migrações. Toda a estrutura de base de dados vem de:
- `000165_privacy_policies.sql` (Story 3.1 — done)
- `000170_parental_consents.sql` (Story 3.2 — ready-for-dev)

---

### Tabela de ficheiros criados nesta story

| Ficheiro | Estado | Notas |
|----------|--------|-------|
| `supabase/functions/_shared/` | NEW (pasta) | Shared utilities |
| `supabase/functions/send-parental-consent/index.ts` | NEW | Deno Edge Function |
| `supabase/functions/send-parental-consent/deno.json` | NEW | Imports |
| `supabase/functions/consent-validate/index.ts` | NEW | Deno Edge Function |
| `supabase/functions/consent-validate/deno.json` | NEW | Imports |
| `src/app/consentimento/[token]/page.tsx` | NEW | Server Component |
| `src/app/consentimento/[token]/consent-form.tsx` | NEW | Client Component |
| `src/app/consentimento/[token]/actions.ts` | NEW | Server Actions |
| `src/lib/actions/consent.ts` | UPDATE | Substituir stub + trigger email |
| `.env.example` | UPDATE | Adicionar `RESEND_API_KEY`, `SITE_URL` |
| `src/__tests__/lib/actions/consent-email.test.ts` | NEW | |
| `src/__tests__/app/consentimento/actions.test.ts` | NEW | |
| `src/__tests__/app/consentimento/page.test.tsx` | NEW | |

---

### Segredos nas Edge Functions — Supabase Dashboard

Os seguintes secrets devem existir no Supabase Dashboard → Functions → Secrets:
- `SUPABASE_URL` (automático em Edge Functions)
- `SUPABASE_SERVICE_ROLE_KEY` (automático em Edge Functions)
- `RESEND_API_KEY` (adicionar manualmente)
- `SITE_URL` (adicionar manualmente, ex: `https://sparta.vercel.app`)

**Localmente**: adicionar ao `.env.local` para que o `supabase functions serve` funcione.

---

### `audit_logs` — estrutura de insert

```ts
// Padrão correcto (da Story 1.12, implementado na Story 3.2):
await supabase.from("audit_logs").insert({
  club_id: consent.club_id,    // ← obrigatório
  action: "consent.confirmed",
  target_kind: "player",
  target_id: consent.player_id,
  payload: { consent_id: consent.id, confirmed_ip: ip ?? null },
  // actor_id: null (Encarregado não tem account — deixar NULL)
});
```

---

### Testes — mock de Edge Function (fetch global)

```ts
// No teste, mockar o fetch global:
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubGlobal("fetch", vi.fn());

describe("submitConsentDecision", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });
  // ...
});
```

---

### `next/navigation` redirect — mock em testes

```ts
// vitest.config.ts ou no setup do teste:
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));
```

---

### Padrão de commit para esta story

Seguindo os commits anteriores:
```
feat(story-3-3): implement parental consent email send and token landing page
```

---

## Previous Story Intelligence

**Story 3.2: Parental Consent Schema & Underage Block** (ready-for-dev)

- `initiateParentalConsent` em `consent.ts`: token UUIDv7, TTL 90 dias, service-role apenas, conflito detection, audit log `consent.initiate`
- `resendConsentEmail` actualmente é stub — retorna placeholder. Story 3.3 substitui pela chamada real à Edge Function
- Middleware consent gate no `proxy.ts`: bloqueia player com `consent_status='pending'` → redireciona `/aguardar-consentimento` (excepto se já está nessa rota)
- `/aguardar-consentimento/resend-button.tsx` chama `resendConsentEmail` — que Story 3.3 torna funcional
- `getPlayerConsentStatus(profileId)` disponível em `consent.ts` para Server Components
- `ageInYears()` em `src/lib/utils/age.ts` — não duplicar
- `maskEmail()` em `src/lib/utils/mask-email.ts` — não duplicar
- `ROLE_ALLOWED_ROUTES.player` inclui `/aguardar-consentimento` (Story 3.2 adiciona)

**Story 3.1: Privacy Policy Versioning** (done)

- `privacy_policies` tabela com `body_full_md` (texto completo), `body_u14_md` (adaptado sub-14), `is_current: boolean`
- `is_current = true` é singleton — query `.single()` é segura
- `react-markdown` usado em `src/app/politica-privacidade/policy-content.tsx` — reusar padrão
- `000165_privacy_policies.sql` migration aplicada localmente

**Story 2.10: Player Invite** (done)

- `invitePlayer` usa fetch para chamar Supabase Auth API — mesmo padrão de chamada HTTP no lado do servidor
- Lição: validar config antes de chamadas de email; não assumir que env vars existem

---

## Git Intelligence Summary

```
beaaa93 feat: add versioned privacy policy storage and implement privacy policy page  ← Story 3.1
c1c9eb8 feat(story-3-2): implement parental consent schema, token generation, and underage access block  ← Story file criado, código não implementado
f9e4327 fix(invitePlayer): add error handling and configuration checks for user invitation
```

Padrão: Edge Functions existentes (`auth-hook`, `anonymize-player-photos`) usam `export default handler` e import directo de `https://esm.sh/@supabase/supabase-js@2.46.0`.

---

## Latest Tech Information

### Resend EU Region

Resend EU usa a mesma API endpoint `https://api.resend.com/emails`. A região EU é configurada na conta Resend (dashboard → Settings → Region). Não há endpoint alternativo para EU — a chave da API determina a região. Sender domain deve ser verificado na conta.

### Edge Functions Deno Runtime

Supabase Edge Functions correm em Deno. Não suportam `node_modules`. Usar apenas:
- `https://esm.sh/` para bibliotecas npm (ex: `@supabase/supabase-js`)
- `https://deno.land/std@*/` para stdlib Deno
- O padrão `export default handler` é o correcto para Supabase Edge Functions actuais

### `headers()` em Next.js 16 Server Actions

`import { headers } from 'next/headers'` retorna uma Promise em Next.js 16 — usar `await headers()`. O IP do cliente vem de `x-real-ip` (Vercel) ou `x-forwarded-for` (proxy genérico).

### Button com `name`/`value` em React

React suporta `name` e `value` em `<button type="submit">`. Ao clicar, o FormData incluirá o valor do botão clicado. Funciona com Server Actions sem JavaScript adicional — progressive enhancement real.

---

## Project Context Reference

```
SPARTA/
└── sparta/
    ├── supabase/
    │   ├── migrations/
    │   │   ├── 000165_privacy_policies.sql        ← done (Story 3.1)
    │   │   └── 000170_parental_consents.sql       ← ready-for-dev (Story 3.2)
    │   └── functions/
    │       ├── auth-hook/                         ← existente
    │       ├── anonymize-player-photos/           ← existente
    │       ├── _shared/                           ← NEW esta story
    │       ├── send-parental-consent/             ← NEW esta story
    │       └── consent-validate/                  ← NEW esta story
    └── src/
        ├── proxy.ts                               ← NÃO tocar (Story 3.2 já adiciona consent gate)
        ├── app/
        │   ├── (player)/
        │   │   └── aguardar-consentimento/        ← Story 3.2 (dependência)
        │   ├── consentimento/
        │   │   └── [token]/
        │   │       ├── page.tsx                   ← NEW Server Component
        │   │       ├── consent-form.tsx           ← NEW Client Component
        │   │       └── actions.ts                 ← NEW Server Actions
        │   └── politica-privacidade/
        │       └── policy-content.tsx             ← existente, ver padrão ReactMarkdown
        ├── components/patterns/
        │   └── EmptyState.tsx                     ← existente, reusar
        └── lib/
            └── actions/
                └── consent.ts                     ← UPDATE (Story 3.2 cria, Story 3.3 actualiza)
```

**Referências:**
- FR5: Encarregado confirma consentimento via link tokenizado sem criar conta
- FR6: Registo com timestamp, IP e versão da política
- FR45: Email transacional via Resend
- AR13: service-role bypassa RLS — obrigatório para Edge Functions de consentimento
- UX-DR23: `<ParentalConsentEmail>` — template ≤50KB inline-CSS, plain-text fallback, B1, ≤200 palavras
- UX-DR24: `<ConsentLandingPage>` — server-rendered, progressively enhanced, estados valid/expired/invalid
- UX-DR30: Apenas 3 variantes de Button; botão "Recusar" é ghost (não destructive — não há dado a eliminar)
- NFR30: Resend EU region
- NFR54: Cobertura ≥80% em fluxos críticos

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- EmptyState está em `@/components/ui/empty-state` (não `patterns/EmptyState`) e requer prop `icon: React.ReactNode` — ícones lucide-react usados por estado
- Template HTML inline nas Edge Functions em vez de ficheiro `_shared/email-templates.ts` — simplifica o deploy Deno sem imports adicionais

### Completion Notes List

- ✅ Edge Function `send-parental-consent`: POST com consentId, busca parental_consents + players, envia via Resend com template HTML inline-CSS PT-PT B1, retorna `{ ok: true }` ou erro estruturado (AC #1)
- ✅ Edge Function `consent-validate`: GET (5 estados: valid/expired/confirmed/withdrawn/invalid) + POST (confirm/withdraw com UPDATE parental_consents + profiles + audit_logs + email confirmação) (AC #2-#6)
- ✅ Landing page `/consentimento/[token]`: Server Component, `cache: 'no-store'`, progressive enhancement, `EmptyState` com ícone por estado (AC #2-#4)
- ✅ `ConsentForm`: Client Component com `<form action={submitConsentDecision}>`, botão confirm (primary) + botão withdraw (ghost), ReactMarkdown para política (AC #3)
- ✅ `submitConsentDecision`: Server Action com extracção de IP (x-real-ip / x-forwarded-for), POST para consent-validate, redirect incondicionalmente (AC #5, #6)
- ✅ `initiateParentalConsent` actualizado: `void fetch(send-parental-consent).catch(...)` fire-and-forget após inserção (AC #8)
- ✅ `resendConsentEmail` actualizado: stub substituído por `await fetch(send-parental-consent)` com tratamento de erro (AC #7)
- ✅ `.env.example`: `SITE_URL` adicionado; `RESEND_API_KEY` já existia (AC #9)
- ✅ 22 novos testes + actualizações nos testes existentes de consent.ts — 796 testes passam
- ✅ lint 0 erros, typecheck ✅, build ✅

### Change Log

- 2026-05-20: dev-story completa; Edge Functions send-parental-consent + consent-validate criadas; landing page /consentimento/[token] implementada; consent.ts stub substituído; 22 testes novos; lint 0 erros; typecheck ✅; build ✅; AC #1-#10 verificados

### File List

- `sparta/supabase/functions/_shared/` (NEW — pasta criada)
- `sparta/supabase/functions/send-parental-consent/index.ts` (NEW)
- `sparta/supabase/functions/send-parental-consent/deno.json` (NEW)
- `sparta/supabase/functions/consent-validate/index.ts` (NEW)
- `sparta/supabase/functions/consent-validate/deno.json` (NEW)
- `sparta/src/app/consentimento/[token]/page.tsx` (NEW)
- `sparta/src/app/consentimento/[token]/consent-form.tsx` (NEW)
- `sparta/src/app/consentimento/[token]/actions.ts` (NEW)
- `sparta/src/lib/actions/consent.ts` (UPDATE — fire-and-forget em initiateParentalConsent + substituição do stub em resendConsentEmail)
- `sparta/.env.example` (UPDATE — SITE_URL adicionado)
- `sparta/src/__tests__/lib/actions/consent.test.ts` (UPDATE — resendConsentEmail: stub tests → Edge Function tests + fire-and-forget test)
- `sparta/src/__tests__/app/consentimento/actions.test.ts` (NEW)
- `sparta/src/__tests__/app/consentimento/page.test.tsx` (NEW)
