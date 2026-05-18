# Story 2.10: Player Invite — Email & Account Linking

**Status:** ready-for-dev

**Story ID:** 2.10
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-18

---

## Story

Como Analista,
Quero convidar um jogador por email a partir da sua ficha no plantel,
Para que o jogador receba as credenciais de acesso à app e fique ligado ao registo que criei.

---

## Acceptance Criteria

### AC #1: Migração `000095_player_invite.sql`

**Given** a migração `000095_player_invite.sql` é aplicada
**When** `supabase db reset` corre sem erros
**Then** a tabela `players` tem duas novas colunas:
- `email text NULLABLE` — email do jogador usado no convite
- `invite_sent_at timestamptz NULLABLE` — timestamp do último convite enviado

**And** índice `idx_players_email_club` em `(club_id, email)` WHERE email IS NOT NULL existe (para detetar email duplicado no clube)

**And** `database.types.ts` é atualizado para refletir as novas colunas (`email: string | null`, `invite_sent_at: string | null`)

---

### AC #2: Server Action `invitePlayer` — Happy Path

**Given** Analista autenticado em `/plantel/[id]`
**When** preenche o email do jogador e submete o formulário de convite
**Then** `invitePlayer({ playerId, email })` executa:
1. Valida `email` via Zod (`z.string().email()`) e `playerId` (`z.string().uuid()`)
2. Verifica que o jogador pertence ao mesmo clube do analista e não está arquivado
3. Verifica que o email não está já associado a outro jogador do mesmo clube
4. Chama `serviceRoleClient.auth.admin.inviteUserByEmail(email, { data: { club_id, role: 'player', player_id: playerId } })`
5. Cria a linha `profiles`: `{ id: user.id, club_id, role: 'player', full_name: player.full_name }`
6. Atualiza `players`: `profile_id = user.id, email = email, invite_sent_at = now()`
7. Chama `logAccess('player.invited', 'player', playerId)` (FR50)
8. Redireciona para `/plantel/[id]?invited=1`

**And** o jogador recebe o email de convite do Supabase com link de activação

---

### AC #3: Tratamento de erros do `invitePlayer`

**Given** Analista tenta convidar um jogador
**When** o email já está registado no sistema (duplicado em `auth.users`)
**Then** `invitePlayer` retorna `{ ok: false, error: { code: 'email_conflict', ... } }`
**And** o formulário mostra erro inline: "Este email já tem uma conta no sistema"

**When** a criação do perfil falha após o convite ser enviado
**Then** a action compensa: deleta o `auth.users` criado via `serviceRoleClient.auth.admin.deleteUser(user.id)`
**And** retorna `{ ok: false, error: { code: 'profile_creation_failed', ... } }`

**When** o email já está associado a outro jogador do mesmo clube
**Then** retorna `{ ok: false, error: { code: 'email_in_use', ... } }` antes de chamar o Supabase
**And** o formulário mostra erro inline: "Este email já está associado a outro jogador neste clube"

---

### AC #4: Server Action `resendPlayerInvite`

**Given** jogador já tem email registado (`players.email IS NOT NULL`) mas não acedeu à app
**When** Analista clica "Re-enviar convite"
**Then** `resendPlayerInvite({ playerId })` executa:
1. Valida `playerId`
2. Verifica que `players.email IS NOT NULL` (pré-condição)
3. Chama `serviceRoleClient.auth.admin.inviteUserByEmail(email, { data: { ... } })` com o mesmo email
4. Atualiza `players.invite_sent_at = now()`
5. Chama `logAccess('player.invite_resent', 'player', playerId)`
6. Redireciona para `/plantel/[id]?resent=1`

---

### AC #5: Secção "Acesso à app" em `/plantel/[id]`

**Given** Analista em `/plantel/[id]`
**When** `players.email IS NULL` (sem convite enviado)
**Then** é exibida a secção "Acesso à app" com:
- Label "Sem acesso"
- `<InvitePlayerSheet>` com botão "Convidar jogador"
- Para jogadores com `age_group IN ('u14','u15')`: aviso inline "Confirma o consentimento parental (Epic 3) antes de convidar"

**When** `players.invite_sent_at IS NOT NULL` (convite já enviado)
**Then** é exibida a secção "Acesso à app" com:
- Label "Convite enviado em [data formatada]"
- Botão "Re-enviar convite" (`<ResendInviteButton>`)

**When** `?invited=1` nos searchParams
**Then** `<CalmConfirmation message="Convite enviado">` é exibido

**When** `?resent=1` nos searchParams
**Then** `<CalmConfirmation message="Convite reenviado">` é exibido

---

### AC #6: `<InvitePlayerSheet>` — formulário e validação

**Given** Analista abre o sheet de convite
**Then** o sheet contém:
- Campo `email` obrigatório, tipo `email`, validado on-blur (UX-DR31)
- Mensagem de ajuda: "O jogador receberá um email para definir a sua password"
- Botão primário "Enviar convite" (loading state durante submit)
- Botão ghost "Cancelar"

**When** o campo é abandonado vazio
**Then** erro inline: "Email obrigatório"

**When** o email tem formato inválido
**Then** erro inline: "Email inválido"

**When** o submit é bem-sucedido
**Then** o sheet fecha e `<CalmConfirmation>` aparece

---

### AC #7: Template PT-PT do email de convite

**Given** a configuração em `supabase/config.toml`
**When** `inviteUserByEmail` é chamado
**Then** o jogador recebe o email com:
- Assunto: "Convite para a app do clube"
- Corpo: texto simples em PT-PT com link de activação
- Template em `supabase/templates/invite.html`

---

### AC #8: Auth Hook — JWT claims após aceitação do convite

**Given** o perfil é criado antes da aceitação do convite (AC #2, passo 5)
**When** o jogador clica no link de convite, define a password e autentica pela primeira vez
**Then** o Auth Hook (Story 1.4) encontra o perfil em `profiles` com `role='player'` e `club_id` correcto
**And** o JWT é emitido com claims `{ club_id, role: 'player' }`
**And** as políticas RLS funcionam correctamente na primeira sessão do jogador

---

### AC #9: Cobertura de testes (NFR54)

**Given** os testes de integração correm
**When** `npm run test --run` executa em `project-r/`
**Then** os fluxos de `invitePlayer` e `resendPlayerInvite` têm ≥80% de cobertura incluindo:
- Happy path: convite enviado, perfil criado, players atualizado
- Email duplicado no sistema
- Email já usado noutro jogador do clube
- Compensação: falha na criação de perfil → deleteUser
- Jogador arquivado: convite bloqueado
- Resend: pré-condição `email IS NOT NULL`

---

## Tasks / Subtasks

- [ ] **Task 1: Migração `000095_player_invite.sql`** (AC #1)
  - [ ] 1.1 Criar `supabase/migrations/000095_player_invite.sql` com `ALTER TABLE players ADD COLUMN email text, ADD COLUMN invite_sent_at timestamptz`
  - [ ] 1.2 Criar índice `idx_players_email_club ON players(club_id, email) WHERE email IS NOT NULL`
  - [ ] 1.3 Adicionar `COMMENT ON COLUMN players.email` e `COMMENT ON COLUMN players.invite_sent_at`
  - [ ] 1.4 Validar: `supabase db reset` corre sem erros localmente

- [ ] **Task 2: Atualizar `database.types.ts`** (AC #1)
  - [ ] 2.1 Adicionar `email: string | null` e `invite_sent_at: string | null` ao tipo `players` (Row, Insert, Update)

- [ ] **Task 3: Atualizar `PlayerWithPositions` e Zod schemas** (AC #2, #4)
  - [ ] 3.1 Adicionar `email: string | null` e `invite_sent_at: string | null` ao interface `PlayerWithPositions` em `src/lib/actions/players.ts`
  - [ ] 3.2 Atualizar query `.select(...)` em `getPlayer()` para incluir `email, invite_sent_at`
  - [ ] 3.3 Criar `InvitePlayerSchema` em `src/lib/schemas/players.ts`: `{ playerId: z.string().uuid(), email: z.string().email("Email inválido") }`
  - [ ] 3.4 Criar `ResendInviteSchema`: `{ playerId: z.string().uuid() }`
  - [ ] 3.5 Exportar tipos `InvitePlayer` e `ResendInvite`

- [ ] **Task 4: Server Action `invitePlayer`** (AC #2, #3)
  - [ ] 4.1 Adicionar `invitePlayer(input: InvitePlayer)` a `src/lib/actions/players.ts` com `"use server"`
  - [ ] 4.2 Importar `serviceRoleClient` de `@/lib/supabase/service-role` (permitido em `src/lib/actions/**`)
  - [ ] 4.3 Validar: `auth.getUser()` → perfil do analista → `club_id`
  - [ ] 4.4 Verificar jogador pertence ao clube e não está arquivado
  - [ ] 4.5 Verificar unicidade de email no clube: `SELECT id FROM players WHERE club_id = X AND email = Y`
  - [ ] 4.6 Chamar `serviceRoleClient.auth.admin.inviteUserByEmail(email, { data: { club_id, role: 'player', player_id: playerId } })`
  - [ ] 4.7 Criar perfil: `serviceRoleClient.from('profiles').insert({ id: invitedUser.id, club_id, role: 'player', full_name: player.full_name })`
  - [ ] 4.8 Se criação do perfil falhar: compensar com `serviceRoleClient.auth.admin.deleteUser(invitedUser.id)`
  - [ ] 4.9 Atualizar `players`: `profile_id = invitedUser.id, email, invite_sent_at = new Date().toISOString()`
  - [ ] 4.10 Chamar `logAccess('player.invited', 'player', playerId)`
  - [ ] 4.11 `redirect(`/plantel/${playerId}?invited=1`)`

- [ ] **Task 5: Server Action `resendPlayerInvite`** (AC #4)
  - [ ] 5.1 Adicionar `resendPlayerInvite(input: ResendInvite)` a `src/lib/actions/players.ts`
  - [ ] 5.2 Verificar `players.email IS NOT NULL` (pré-condição) — retornar erro se não tiver email
  - [ ] 5.3 Chamar `serviceRoleClient.auth.admin.inviteUserByEmail(player.email, { data: {...} })`
  - [ ] 5.4 Atualizar `players.invite_sent_at = now()`
  - [ ] 5.5 Chamar `logAccess('player.invite_resent', 'player', playerId)`
  - [ ] 5.6 `redirect(`/plantel/${playerId}?resent=1`)`

- [ ] **Task 6: Componente `<InvitePlayerSheet>`** (AC #5, #6)
  - [ ] 6.1 Criar `src/app/(staff)/plantel/[id]/invite-player-sheet.tsx` como Client Component
  - [ ] 6.2 Usar `react-hook-form` + `zodResolver(InvitePlayerSchema)` com `mode: "onBlur"`
  - [ ] 6.3 Envolver com `<DrillDownSheet>` (padrão estabelecido em stories anteriores)
  - [ ] 6.4 Botão trigger: `<Button size="sm">Convidar jogador</Button>`
  - [ ] 6.5 Campo email com label, placeholder "jogador@email.com", error message inline
  - [ ] 6.6 Botões: primário "Enviar convite" (loading state) + ghost "Cancelar"
  - [ ] 6.7 Aviso para u14/u15: `<p className="text-sm text-signal-alert">Confirma o consentimento parental antes de convidar</p>`
  - [ ] 6.8 No submit: chamar `invitePlayer()`, tratar erros com `form.setError("email", ...)` conforme código de erro

- [ ] **Task 7: Componente `<ResendInviteButton>`** (AC #4, #5)
  - [ ] 7.1 Criar `src/app/(staff)/plantel/[id]/resend-invite-button.tsx` como Client Component
  - [ ] 7.2 Botão ghost "Re-enviar convite" com loading state
  - [ ] 7.3 Ao clicar: chamar `resendPlayerInvite({ playerId })` via Server Action

- [ ] **Task 8: Integrar secção "Acesso à app" em `/plantel/[id]/page.tsx`** (AC #5)
  - [ ] 8.1 Atualizar `src/app/(staff)/plantel/[id]/page.tsx`
  - [ ] 8.2 Adicionar `searchParams.invited` e `searchParams.resent` ao destructuring existente (mesmo padrão de `created` e `updated`)
  - [ ] 8.3 Renderizar `<CalmConfirmation message="Convite enviado" />` se `invited === "1"`
  - [ ] 8.4 Renderizar `<CalmConfirmation message="Convite reenviado" />` se `resent === "1"`
  - [ ] 8.5 Renderizar secção "Acesso à app" após a secção "Métricas físicas":
    - Se `player.invite_sent_at IS NULL`: `<InvitePlayerSheet playerId={player.id} ageGroup={player.age_group} />`
    - Senão: label com data + `<ResendInviteButton playerId={player.id} />`
  - [ ] 8.6 Formatar `invite_sent_at`: `format(new Date(player.invite_sent_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })`

- [ ] **Task 9: Template PT-PT do email de convite** (AC #7)
  - [ ] 9.1 Criar `project-r/supabase/templates/invite.html` com conteúdo PT-PT (ver Dev Notes para template)
  - [ ] 9.2 Descomentar e configurar `[auth.email.template.invite]` no `supabase/config.toml`

- [ ] **Task 10: Testes de integração** (AC #9)
  - [ ] 10.1 Criar `src/__tests__/lib/actions/invite.test.ts`
  - [ ] 10.2 Mockar `serviceRoleClient.auth.admin.inviteUserByEmail` e `serviceRoleClient.auth.admin.deleteUser`
  - [ ] 10.3 Testar happy path: convite enviado, perfil criado, players atualizado
  - [ ] 10.4 Testar email duplicado no sistema (Supabase retorna erro)
  - [ ] 10.5 Testar email já usado noutro jogador do clube
  - [ ] 10.6 Testar compensação: falha na criação de perfil → deleteUser chamado
  - [ ] 10.7 Testar jogador arquivado (convite bloqueado)
  - [ ] 10.8 Testar resend: pré-condição `email IS NOT NULL`
  - [ ] 10.9 Testar resend sem email: erro correcto

- [ ] **Task 11: Verificação final** (AC #1–#9)
  - [ ] 11.1 `npm run lint` — zero erros
  - [ ] 11.2 `npm run typecheck` — zero erros
  - [ ] 11.3 `npm run test --run` — todos os testes passam com ≥80% cobertura nos fluxos de convite
  - [ ] 11.4 `npm run build` — build limpa

---

## Dev Notes

### Arquitectura do fluxo de convite

O convite usa dois mecanismos Supabase em sequência:

```
Analista submete email
        ↓
serviceRoleClient.auth.admin.inviteUserByEmail(email, { data: { club_id, role, player_id } })
        ↓ retorna { user: { id: uuid, ... } }
serviceRoleClient.from('profiles').insert({ id: user.id, club_id, role: 'player', full_name })
        ↓
supabase.from('players').update({ profile_id, email, invite_sent_at })
        ↓
Jogador recebe email → clica link → define password
        ↓
Auth Hook (Story 1.4) → encontra profile → injeta claims no JWT
        ↓
Jogador usa a app com role='player' e club_id correcto
```

**Porquê criar o perfil ANTES da aceitação?**
O Auth Hook (Story 1.4) lê `profiles` durante a emissão do JWT. Se o perfil não existir na primeira autenticação (aceitação do convite), o hook faz graceful fallback — JWT sem claims → todas as RLS policies falham → o jogador não consegue usar a app. Criar o perfil no momento do envio do convite garante que na primeira autenticação o hook já encontra o perfil.

### Importação do `serviceRoleClient`

O `serviceRoleClient` é importável em `src/lib/actions/**` (regra ESLint whitelisted em `eslint.config.mjs:46-56`). Importar directamente em `src/lib/actions/players.ts`:

```ts
import { serviceRoleClient } from "@/lib/supabase/service-role";
```

### Migração `000095_player_invite.sql`

```sql
-- Migration: 000095_player_invite
-- Purpose: Add email + invite tracking columns to players table (Story 2.10)
-- Slot 000095 is free between 000090 (player_metrics) and 000100 (telemetry_events)

ALTER TABLE players
  ADD COLUMN email text,
  ADD COLUMN invite_sent_at timestamptz;

-- Index para verificação rápida de unicidade de email por clube
CREATE INDEX idx_players_email_club
  ON players(club_id, email)
  WHERE email IS NOT NULL;

COMMENT ON COLUMN players.email IS
  'Email do jogador usado no convite (nullable — preenchido quando convite é enviado).';
COMMENT ON COLUMN players.invite_sent_at IS
  'Timestamp do último convite enviado. NULL = sem convite enviado ainda.';
```

### Atualização de `database.types.ts`

Adicionar aos tipos `players.Row`, `players.Insert`, `players.Update`:

```ts
// Row
email: string | null
invite_sent_at: string | null

// Insert
email?: string | null
invite_sent_at?: string | null

// Update
email?: string | null
invite_sent_at?: string | null
```

### Atualização de `PlayerWithPositions` interface

Em `src/lib/actions/players.ts`, adicionar ao interface existente:

```ts
export interface PlayerWithPositions {
  // ... campos existentes ...
  email: string | null;        // NEW
  invite_sent_at: string | null; // NEW
}
```

E atualizar a query em `getPlayer()`:

```ts
.select("id, club_id, profile_id, jersey_num, full_name, birthdate, age_group, is_archived, photo_path, email, invite_sent_at, created_at, updated_at, positions(id, position, is_primary, sort_order)")
```

### Schemas Zod em `src/lib/schemas/players.ts`

```ts
export const InvitePlayerSchema = z.object({
  playerId: z.string().uuid("ID de jogador inválido"),
  email: z.string().email("Email inválido"),
});

export const ResendInviteSchema = z.object({
  playerId: z.string().uuid("ID de jogador inválido"),
});

export type InvitePlayer = z.infer<typeof InvitePlayerSchema>;
export type ResendInvite = z.infer<typeof ResendInviteSchema>;
```

### Server Action `invitePlayer` (esqueleto completo)

```ts
export async function invitePlayer(
  input: InvitePlayer
): Promise<Result<void, AppError>> {
  const validated = InvitePlayerSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: "Dados inválidos", details: { issues: validated.error.issues } });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();
  if (!staffProfile) return err({ code: "forbidden", message: "Perfil não encontrado" });
  if (!["coach", "analyst"].includes(staffProfile.role)) {
    return err({ code: "forbidden", message: "Sem permissão para convidar jogadores" });
  }

  // Verificar jogador pertence ao clube e não está arquivado
  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, age_group, email, is_archived, club_id")
    .eq("id", validated.data.playerId)
    .eq("club_id", staffProfile.club_id)
    .single();
  if (!player) return err({ code: "not_found", message: "Jogador não encontrado" });
  if (player.is_archived) return err({ code: "forbidden", message: "Não é possível convidar jogador arquivado" });

  // Verificar unicidade de email no clube
  const { data: existingByEmail } = await supabase
    .from("players")
    .select("id")
    .eq("club_id", staffProfile.club_id)
    .eq("email", validated.data.email)
    .neq("id", validated.data.playerId)
    .maybeSingle();
  if (existingByEmail) {
    return err({ code: "email_in_use", message: "Este email já está associado a outro jogador neste clube", details: { field: "email" } });
  }

  // Enviar convite via Admin API
  const { data: inviteData, error: inviteError } = await serviceRoleClient.auth.admin.inviteUserByEmail(
    validated.data.email,
    { data: { club_id: staffProfile.club_id, role: "player", player_id: validated.data.playerId } }
  );

  if (inviteError) {
    // Supabase retorna erro se email já existe em auth.users
    const isConflict = inviteError.message.toLowerCase().includes("already registered")
      || inviteError.message.toLowerCase().includes("already been registered");
    if (isConflict) {
      return err({ code: "email_conflict", message: "Este email já tem uma conta no sistema", details: { field: "email" } });
    }
    return err({ code: "unknown", message: inviteError.message });
  }

  if (!inviteData.user) {
    return err({ code: "unknown", message: "Falha ao criar utilizador no Supabase" });
  }

  // Criar perfil (ANTES da aceitação — garante que o Auth Hook injeta claims na primeira sessão)
  const { error: profileError } = await serviceRoleClient
    .from("profiles")
    .insert({
      id: inviteData.user.id,
      club_id: staffProfile.club_id,
      role: "player",
      full_name: player.full_name,
    });

  if (profileError) {
    // Compensação: eliminar o utilizador criado para manter estado consistente
    await serviceRoleClient.auth.admin.deleteUser(inviteData.user.id);
    return err({ code: "profile_creation_failed", message: "Erro ao criar perfil do jogador. Por favor tenta novamente." });
  }

  // Ligar profile_id ao registo do jogador
  const { error: updateError } = await supabase
    .from("players")
    .update({
      profile_id: inviteData.user.id,
      email: validated.data.email,
      invite_sent_at: new Date().toISOString(),
    })
    .eq("id", validated.data.playerId)
    .eq("club_id", staffProfile.club_id);

  if (updateError) {
    // Compensação parcial: perfil criado mas player não ligado — situação recuperável (admin pode religar)
    // Não eliminar o utilizador aqui pois o perfil foi criado com sucesso
    return err({ code: "link_failed", message: "Convite enviado mas não foi possível ligar o jogador. Contacta o suporte." });
  }

  await logAccess("player.invited", "player", validated.data.playerId);

  redirect(`/plantel/${validated.data.playerId}?invited=1`);
}
```

### Template PT-PT do email de convite

Criar `project-r/supabase/templates/invite.html`:

```html
<h2>Convite para a app do clube</h2>
<p>Foste convidado pela equipa técnica do clube para acederes à plataforma de gestão de performance.</p>
<p>Clica no botão abaixo para definir a tua password e começar:</p>
<p><a href="{{ .ConfirmationURL }}">Activar a minha conta</a></p>
<p>Se não reconheces este convite, podes ignorar este email.</p>
```

E em `supabase/config.toml`, descomentar:

```toml
[auth.email.template.invite]
subject = "Convite para a app do clube"
content_path = "./supabase/templates/invite.html"
```

### `<InvitePlayerSheet>` — estrutura de componente

```tsx
// src/app/(staff)/plantel/[id]/invite-player-sheet.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvitePlayerSchema } from "@/lib/schemas/players";
import type { InvitePlayer } from "@/lib/schemas/players";
import { invitePlayer } from "@/lib/actions/players";

interface InvitePlayerSheetProps {
  playerId: string;
  ageGroup: string;
}

export function InvitePlayerSheet({ playerId, ageGroup }: InvitePlayerSheetProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<InvitePlayer>({
    resolver: zodResolver(InvitePlayerSchema),
    defaultValues: { playerId, email: "" },
    mode: "onBlur",
  });

  async function onSubmit(data: InvitePlayer) {
    const result = await invitePlayer(data);
    if (!result.ok) {
      if (result.error.code === "email_conflict" || result.error.code === "email_in_use") {
        form.setError("email", { message: result.error.message });
      }
      // Para outros erros, mostrar no servidor (redirect não acontece)
    }
    // Se ok: invitePlayer faz redirect() — componente não continua
  }

  const isMinor = ageGroup === "u14" || ageGroup === "u15";

  return (
    <DrillDownSheet
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm" variant="ghost">Convidar jogador</Button>}
      title="Convidar jogador"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-6">
        {isMinor && (
          <p className="text-sm text-signal-alert">
            Confirma o consentimento parental antes de convidar jogadores sub-14 ou sub-15.
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor="email">Email do jogador *</Label>
          <Input
            id="email"
            type="email"
            placeholder="jogador@email.com"
            {...form.register("email")}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
          />
          {form.formState.errors.email && (
            <p id="email-error" className="text-sm text-signal-alert flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {form.formState.errors.email.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            O jogador receberá um email para definir a sua password
          </p>
        </div>
        <input type="hidden" {...form.register("playerId")} />
        <div className="flex gap-3">
          <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "A enviar..." : "Enviar convite"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </DrillDownSheet>
  );
}
```

### Secção "Acesso à app" em `/plantel/[id]/page.tsx`

O `page.tsx` já importa `searchParams` com `created` e `updated`. Adicionar `invited` e `resent`:

```tsx
// No destructuring existente:
const { created, updated, invited, resent } = await searchParams;

// Nas CalmConfirmation (junto às existentes):
{invited === "1" && <CalmConfirmation message="Convite enviado" />}
{resent === "1" && <CalmConfirmation message="Convite reenviado" />}

// Nova secção depois da secção "Métricas físicas":
<section className="space-y-3">
  <h2 className="text-base font-semibold">Acesso à app</h2>
  {player.invite_sent_at ? (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm text-muted-foreground">Convite enviado em</p>
        <p className="text-sm font-medium">
          {format(new Date(player.invite_sent_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
        </p>
      </div>
      <ResendInviteButton playerId={player.id} />
    </div>
  ) : (
    <InvitePlayerSheet playerId={player.id} ageGroup={player.age_group} />
  )}
</section>
```

### Padrão de testes — mockar Admin API

```ts
// src/__tests__/lib/actions/invite.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  serviceRoleClient: {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
```

### Estrutura de ficheiros

```text
project-r/
├── supabase/
│   ├── migrations/
│   │   └── 000095_player_invite.sql        ← NEW
│   ├── templates/
│   │   └── invite.html                     ← NEW
│   └── config.toml                         ← UPDATE (descomenta template invite)
└── src/
    ├── lib/
    │   ├── actions/
    │   │   └── players.ts                  ← UPDATE (invitePlayer, resendPlayerInvite)
    │   ├── schemas/
    │   │   └── players.ts                  ← UPDATE (InvitePlayerSchema, ResendInviteSchema)
    │   └── supabase/
    │       └── database.types.ts           ← UPDATE (email, invite_sent_at em players)
    ├── app/(staff)/plantel/[id]/
    │   ├── page.tsx                        ← UPDATE (secção acesso + CalmConfirmation)
    │   ├── invite-player-sheet.tsx         ← NEW
    │   └── resend-invite-button.tsx        ← NEW
    └── __tests__/lib/actions/
        └── invite.test.ts                  ← NEW
```

### Notas de segurança

- `serviceRoleClient.auth.admin.inviteUserByEmail` usa a service role key — bypass RLS total. Sempre verificar `club_id` via `staffProfile.club_id` ANTES de chamar (AC #2, passo 2-3).
- O `player_id` passado em `{ data: { player_id } }` serve apenas como metadado informativo para o auth hook. Não é usado para lógica de segurança no hook (que valida apenas pela presença de `profiles`).
- Emails de convite podem ser reenviados sem limite. Rate limiting é deferred (ver `deferred-work.md`).

### Tratamento de erros do `inviteUserByEmail`

O Supabase Admin API não retorna um código de erro estruturado para email duplicado — a mensagem varia. Detectar por string match:
```ts
const isConflict = inviteError.message.toLowerCase().includes("already registered")
  || inviteError.message.toLowerCase().includes("already been registered");
```
Se a API mudar, este check pode falhar silenciosamente. Testar com versão actual `@supabase/supabase-js@2.105.4`.

### Dependências de Epic 3

O fluxo de convite para menores (u14, u15) deveria ser bloqueado até confirmação do consentimento parental (FR4). Esta story **não implementa esse bloqueio** — exibe apenas um aviso visual. A gate técnica será implementada na **Story 3-2** (parental consent schema + access block). Documentar este comportamento interim no código.

---

## Previous Story Intelligence

**Story 2.3: Player Metrics Time Series** (review — 2026-05-18)
- `<DrillDownSheet>` já está em produção e funciona bem como padrão para sheets de acção em `/plantel/[id]`
- `getPlayer()` usa `.select("..., campo1, campo2, ...")` com lista explícita — manter padrão ao adicionar novos campos
- Locale `pt` (não `ptPT`) de `"date-fns/locale"` — versão 4.1.0 não tem `ptPT`
- `<CalmConfirmation>` importado de `@/components/ui/calm-confirmation`

**Story 2.2: Player Photo Upload** (done — 2026-05-17)
- `serviceRoleClient` já é importado em `src/lib/storage.ts` (em `src/lib/`) — verificar que `src/lib/actions/**` também é whitelisted (confirmado em `eslint.config.mjs:47`)
- Padrão de compensação já estabelecido: se operação secundária falha, reverter a primária

**Story 2.1: Player Records** (done — 2026-05-17)
- Interface `PlayerWithPositions` definida em `src/lib/actions/players.ts` — adicionar campos novos aqui
- `getPlayer()` usa select explícito — actualizar a lista de campos
- Padrão de `?created=1` / `?updated=1` para CalmConfirmation — seguir com `?invited=1` / `?resent=1`
- `redirect()` após server action bem-sucedida — não retornar resultado, apenas redirecionar

**Story 1.4: Auth Hook** (done — 2026-05-11)
- O hook lê `profiles` para injectar claims. Profile DEVE existir antes da primeira autenticação do jogador
- Graceful fallback: sem profile → JWT sem claims → RLS falha em tudo. Criar profile na mesma operação do invite

**Story 1.6: Role Assignment** (done — 2026-05-15)
- `profiles` INSERT é restrito a `service_role` (migration 000040 — P3 comment)
- Usar sempre `serviceRoleClient.from('profiles').insert(...)` para criar perfis

---

## Git Intelligence Summary

```
797045e feat: implement player photo upload functionality
5d16859 fix: improve migration execution logic in push-migrations.sh
723bb8c fix: improve error handling in push-migrations.sh
4cb2f0c feat: implement migration script for applying database migrations to Supabase
beae630 feat: update Supabase deployment workflow
```

Padrões de commit estabelecidos:
- `feat:` para novas funcionalidades
- `fix:` para correcções

---

## Latest Tech Information

### `@supabase/supabase-js@2.105.4` — Admin API

```ts
// Convidar utilizador (cria auth.users com status 'invited')
const { data, error } = await serviceRoleClient.auth.admin.inviteUserByEmail(
  "email@example.com",
  {
    data: { /* user_metadata — passado ao auth hook como raw_user_meta_data */ },
    redirectTo: "https://app.example.com/welcome", // opcional — URL pós-confirmação
  }
);
// data.user: { id: string, email: string, ... } | null
// error: AuthError | null

// Eliminar utilizador (para compensação)
await serviceRoleClient.auth.admin.deleteUser(userId);
```

**Nota:** `inviteUserByEmail` em Supabase envia um magic link de convite. O utilizador clica no link, é redirecionado para a app, e pode definir a sua password. O token expira em 24h por defeito (configurável em Supabase Dashboard → Auth → Email settings → Confirm email change expiry).

**Nota 2:** Se o email já existe em `auth.users` (mesmo sem convite anterior), a API retorna erro. Nunca envia convite para conta existente. O erro não tem código estruturado — só `message`.

### `react-hook-form@7.75.0` — padrão estabelecido

- `mode: "onBlur"` — validação on-blur (UX-DR31)
- `form.setError("campo", { message: "..." })` para erros de servidor
- `form.formState.isSubmitting` para loading state do botão

### `date-fns@4.1.0`

- Usar `pt` de `"date-fns/locale"` (não `ptPT` — não existe nesta versão)
- `format(date, "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })` para exibir `invite_sent_at`

---

## Project Context Reference

```
ProjectR/
└── project-r/                             ← working directory para npm commands
    ├── supabase/
    │   ├── migrations/
    │   │   ├── 000010–000090_*.sql        ← existentes
    │   │   └── 000095_player_invite.sql   ← NEW (slot livre entre 000090 e 000100)
    │   ├── templates/
    │   │   └── invite.html                ← NEW
    │   └── config.toml                    ← UPDATE (auth.email.template.invite)
    └── src/
        ├── lib/
        │   ├── supabase/
        │   │   ├── service-role.ts        ← USAR (serviceRoleClient.auth.admin)
        │   │   └── database.types.ts      ← UPDATE
        │   ├── actions/
        │   │   └── players.ts             ← UPDATE (invitePlayer, resendPlayerInvite)
        │   └── schemas/
        │       └── players.ts             ← UPDATE (InvitePlayerSchema, ResendInviteSchema)
        ├── app/(staff)/plantel/[id]/
        │   ├── page.tsx                   ← UPDATE
        │   ├── invite-player-sheet.tsx    ← NEW
        │   └── resend-invite-button.tsx   ← NEW
        └── __tests__/lib/actions/
            └── invite.test.ts             ← NEW
```

**Referências:**
- FR1: Jogador autentica com email + password
- FR2: Sistema atribui papel único por conta
- FR3: Jogador acede apenas aos próprios dados
- FR4: Acesso de menor bloqueado até consentimento parental (deferred para Epic 3)
- FR50: Audit trail para `player.invited`, `player.invite_resent`
- AR13: Service-role bypass apenas em Edge Functions, cron jobs, e Server Actions autorizadas
- AR15: Helpers Supabase em `lib/supabase/` provider-agnostic
- NFR54: Cobertura ≥80% nos fluxos críticos

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

### File List

- `project-r/supabase/migrations/000095_player_invite.sql` (NEW)
- `project-r/supabase/templates/invite.html` (NEW)
- `project-r/supabase/config.toml` (UPDATE — descomenta template invite)
- `project-r/src/lib/supabase/database.types.ts` (UPDATE — email, invite_sent_at em players)
- `project-r/src/lib/schemas/players.ts` (UPDATE — InvitePlayerSchema, ResendInviteSchema)
- `project-r/src/lib/actions/players.ts` (UPDATE — invitePlayer, resendPlayerInvite, PlayerWithPositions, getPlayer select)
- `project-r/src/app/(staff)/plantel/[id]/page.tsx` (UPDATE — secção Acesso à app, invited/resent searchParams)
- `project-r/src/app/(staff)/plantel/[id]/invite-player-sheet.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/[id]/resend-invite-button.tsx` (NEW)
- `project-r/src/__tests__/lib/actions/invite.test.ts` (NEW)

---

## Change Log

- 2026-05-18: Story 2.10 criada — player invite flow via serviceRoleClient.auth.admin.inviteUserByEmail, profile criado antes da aceitação, secção "Acesso à app" em /plantel/[id]
