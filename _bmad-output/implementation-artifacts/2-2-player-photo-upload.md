# Story 2.2: Player Photo Upload

**Status:** ready-for-dev

**Story ID:** 2.2
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)
**Created:** 2026-05-17

---

## Story

Como Analista,
Quero fazer upload de uma foto por jogador armazenada privativamente em Supabase Storage,
Para que o staff consiga identificar jogadores no Painel e touchscreen sem expor fotos publicamente.

---

## Acceptance Criteria

### AC #1: Bucket `player-photos` provisão & políticas

**Given** Supabase Storage é configurado
**When** o bucket `player-photos` é criado
**Then** bucket é private (nenhum acesso público anónimo)
**And** o bucket está em região EU (NFR30)
**And** políticas RLS enforce `select`/`insert`/`update`/`delete` apenas quando path prefix corresponde a `auth.club_id()`

**Given** um Analista do clube A tenta aceder à foto de jogador no clube B
**When** o URL assinado (ou unsigned) é requisitado
**Then** o acesso é negado pela política do bucket (multi-tenant isolation, FR3)

### AC #2: Migração `000085_players_photo.sql`

**Given** migração `000085_players_photo.sql` é aplicada
**When** `supabase db reset` corre sem erros
**Then** coluna `photo_path text nullable` é adicionada à tabela `players`
**And** formato esperado é `<club_id>/<player_id>.<ext>` (ex: `d8a3f5c1-2b4a-4e7f-9c1b-5d6e8f9a2c3d/a7f8c9e1-2b4a-4e7f-9c1b-5d6e8f9a2c3d.webp`)
**And** coluna é nullable (permitir jogadores sem foto)

### AC #3: Upload de foto em `/plantel/[id]/editar`

**Given** Analista em `/plantel/[id]/editar` carrega a página do formulário
**When** selecciona uma imagem (jpg/png/webp, ≤2MB)
**Then** o ficheiro é validado client-side (tipo MIME, tamanho)
**And** enviado via Server Action `uploadPlayerPhoto`
**And** redimensionado server-side para ≤512×512px (preservar aspect ratio)
**And** o caminho é salvo como `<club_id>/<player_id>.<ext>` em `players.photo_path`
**And** um `<CalmConfirmation message="Foto actualizada">` é mostrado

**Given** validação client-side falha (tipo inválido, ficheiro >2MB)
**When** o utilizador tenta submeter
**Then** mensagem de erro inline é mostrada junto ao input (UX-DR31)

### AC #4: Renderização com URL assinada (1h expiry)

**Given** a foto é renderizada (em `/plantel/[id]`, `/plantel`, touchscreen, painel, etc.)
**When** o componente renderiza a imagem
**Then** gera um URL assinado com 1h de expiry via `getSignedUrl()` (Supabase Storage)
**And** nunca expõe um URL público permanente (FR21 — sem dados de saúde públicos)
**And** o `<img>` `alt` atributo = `player.full_name` (NFR44)
**And** `loading="lazy"` está habilitado
**And** `<picture>` com srcset para 1×/2×/3× WebP + JPEG fallback (UX-DR45)

### AC #5: Arquivamento preserva foto

**Given** um jogador é arquivado (AC #6 de Story 2.1)
**When** `is_archived=true` é definido
**Then** `players.photo_path` não é deletado automaticamente
**And** a foto permanece em Storage (anonimização vem em Story 2.9)

### AC #6: Cobertura de testes (NFR54)

**Given** os testes correm
**When** `npm run test --run` executa
**Then** upload, redimensionamento e renderização assinada têm ≥80% cobertura incluindo edge cases

---

## Tasks / Subtasks

- [ ] Task 1: Criar bucket `player-photos` em Supabase Storage (AC #1)
  - [ ] 1.1 Provisionar bucket privado em região EU via Supabase Console (Storage > Buckets > New)
  - [ ] 1.2 Executar as políticas RLS em `supabase/bucket-policies.sql` via Supabase SQL Editor
  - [ ] 1.3 Testar cross-club isolation (ex: user de club A não consegue aceder a foto de jogador de club B)

- [ ] Task 2: Aplicar migração `000085_players_photo.sql` (AC #2)
  - [ ] 2.1 Migração já criada em `project-r/supabase/migrations/000085_players_photo.sql`
  - [ ] 2.2 Executar `supabase db reset` localmente para validação
  - [ ] 2.3 Confirmar coluna `photo_path` foi adicionada a `players`

- [ ] Task 3: Criar Server Action `uploadPlayerPhoto` (AC #3, #4)
  - [ ] 3.1 Validar tipo MIME (jpg/png/webp), tamanho ≤2MB
  - [ ] 3.2 Gerar `newId()` para player_id (se não existir em contexto)
  - [ ] 3.3 Redimensionar imagem para ≤512×512px server-side (usar `sharp` ou similar)
  - [ ] 3.4 Upload para `player-photos/<club_id>/<player_id>.<ext>`
  - [ ] 3.5 Actualizar `players.photo_path`
  - [ ] 3.6 Logado como `logAccess('player.photo_updated', 'player', playerId)` (FR50)
  - [ ] 3.7 Tratar erros: validação, upload failures, atomic update

- [ ] Task 4: Criar hook `usePlayerPhotoUrl` para URL assinada (AC #4)
  - [ ] 4.1 Servidor-side: função helper `getPlayerPhotoUrl(photoPath: string): Promise<string>` que chama Supabase `getSignedUrl` com 1h expiry
  - [ ] 4.2 Cliente-side: usar em componentes que renderizam fotos (getServerSideProps / Server Component)
  - [ ] 4.3 Fallback para `<img src={noPhotoPlaceholder} />` se `photo_path` é null

- [ ] Task 5: Actualizar página `/plantel/[id]/editar` (AC #3, #4)
  - [ ] 5.1 Adicionar file input com validação client-side (tipo, tamanho)
  - [ ] 5.2 Mostrar preview imagem antes de submeter
  - [ ] 5.3 Submit chama `uploadPlayerPhoto` server action
  - [ ] 5.4 Renderizar foto actual (se existe) com URL assinada + alt text
  - [ ] 5.5 Spinner de loading durante upload
  - [ ] 5.6 Mostrar `<CalmConfirmation>` após sucesso

- [ ] Task 6: Actualizar `/plantel` lista (AC #4)
  - [ ] 6.1 Renderizar foto por jogador com URL assinada + `loading="lazy"`
  - [ ] 6.2 Redimensionar thumbnail no HTML via `picture` + srcset

- [ ] Task 7: Actualizar `/plantel/[id]` detalhe (AC #4, #5)
  - [ ] 7.1 Renderizar foto grande com URL assinada
  - [ ] 7.2 Se arquivado: foto preservada, sem placeholder de anonimização (vem em Story 2.9)
  - [ ] 7.3 Link para editar foto em `/plantel/[id]/editar`

- [ ] Task 8: Preparar placeholder sem foto (AC #4)
  - [ ] 8.1 Criar placeholder SVG/icon neutro (lucide `User` ou `CircleUser`)
  - [ ] 8.2 Usar como fallback quando `photo_path` é null

- [ ] Task 9: Escrever testes (AC #6)
  - [ ] 9.1 Unit tests: validação MIME/tamanho em `uploadPlayerPhoto`
  - [ ] 9.2 Mock Supabase Storage `upload()` e `getSignedUrl()`
  - [ ] 9.3 Testar cross-club isolation (Analista A não consegue aceder a foto de Analista B)
  - [ ] 9.4 Integration tests: full flow upload → renderização

- [ ] Task 10: Verificação final (AC #1–#6)
  - [ ] 10.1 `npm run lint` — zero erros
  - [ ] 10.2 `npm run typecheck` — zero erros
  - [ ] 10.3 `npm run test --run` — todos os testes passam com ≥80% cobertura
  - [ ] 10.4 `npm run build` — build limpa

---

## Dev Notes

### Inventário de Ficheiros

| Ficheiro | Tipo | Mudança |
|---------|------|---------|
| `supabase/migrations/000085_players_photo.sql` | NEW | Adicionar coluna `photo_path` a `players` |
| `supabase/bucket-policies.sql` | NEW | Políticas RLS para bucket `player-photos` |
| `src/lib/supabase/database.types.ts` | UPDATE | Reflectir tipo `photo_path: string \| null` |
| `src/lib/actions/players.ts` | UPDATE | Adicionar `uploadPlayerPhoto`, atualizar `getPlayer`, `getPlayers` |
| `src/lib/storage.ts` | NEW | Helper `getPlayerPhotoUrl()`, `uploadPlayerPhotoFile()` |
| `src/app/(staff)/plantel/[id]/editar/page.tsx` | UPDATE | Adicionar file input com preview |
| `src/app/(staff)/plantel/[id]/page.tsx` | UPDATE | Renderizar foto com URL assinada |
| `src/app/(staff)/plantel/page.tsx` | UPDATE | Renderizar thumbnails com URL assinada |
| `src/components/ui/player-photo.tsx` | NEW | Componente reutilizável de foto com fallback |
| `__tests__/lib/actions/players.photo.test.ts` | NEW | Testes upload + isolation |

### Migração: `000085_players_photo.sql`

**Localização:** `project-r/supabase/migrations/000085_players_photo.sql`

**Conteúdo:**

```sql
-- Migration: 000085_players_photo
-- Purpose: Add photo storage path to players (FR12, FR13, NFR44)

ALTER TABLE players ADD COLUMN photo_path text;

COMMENT ON COLUMN players.photo_path IS
  'Storage path in format club_id/player_id.ext, null if no photo uploaded. Photos stored privately in Supabase Storage bucket "player-photos" with RLS policies.';
```

**Execução:**

```bash
cd project-r
supabase db reset  # Aplica todas as migrações (000010–000085)
```

**Nota:** Migração já foi criada. Bucket `player-photos` é criado manualmente via Supabase Console (ver `bucket-policies.sql` para instruções).

### Bucket Policies (Supabase Console / SQL)

```sql
-- Bucket: player-photos (private)
-- Path pattern: <club_id>/<player_id>.<ext>

CREATE POLICY "Authenticated users can read own club photos" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'player-photos' AND (storage.foldername(name))[1] = auth.club_id()::text);

CREATE POLICY "Analyst can upload to own club" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = auth.club_id()::text
    AND auth.user_role() IN ('coach', 'analyst')
  );

CREATE POLICY "Analyst can update own club photos" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = auth.club_id()::text
    AND auth.user_role() IN ('coach', 'analyst')
  );

CREATE POLICY "Analyst can delete own club photos" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND (storage.foldername(name))[1] = auth.club_id()::text
    AND auth.user_role() IN ('coach', 'analyst')
  );
```

**NOTA:** `auth.club_id()` é disponível porque a migração 000030 (`auth_helpers.sql`) define a função (Story 1.4).

**Extração de club_id do path:** `(storage.foldername(name))[1]` extrai o primeiro segmento (club_id) do caminho. Para `d8a3f5c1-2b4a-4e7f-9c1b-5d6e8f9a2c3d/a7f8c9e1-2b4a-4e7f-9c1b-5d6e8f9a2c3d.webp`, retorna `d8a3f5c1-2b4a-4e7f-9c1b-5d6e8f9a2c3d`.

### Storage Helper: `src/lib/storage.ts`

```ts
import { createServerClient } from "@/lib/supabase/server";
import type { AppError, Result } from "@/lib/types";
import { ok, err } from "@/lib/types";

export async function getPlayerPhotoUrl(
  photoPath: string | null | undefined
): Promise<string | null> {
  if (!photoPath) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("player-photos")
    .createSignedUrl(photoPath, 3600); // 1h expiry

  if (error || !data?.signedUrl) {
    console.warn(`[getPlayerPhotoUrl] Failed to sign URL for ${photoPath}:`, error?.message);
    return null;
  }

  return data.signedUrl;
}

export async function uploadPlayerPhotoFile(
  clubId: string,
  playerId: string,
  file: File
): Promise<Result<{ photoPath: string }, AppError>> {
  // Validação client-side (double-check server-side)
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return err({
      code: "validation",
      message: "Tipo de ficheiro inválido. Use JPG, PNG ou WebP.",
    });
  }

  if (file.size > 2 * 1024 * 1024) {
    // 2MB
    return err({
      code: "validation",
      message: "Ficheiro demasiado grande (máximo 2MB).",
    });
  }

  // Redimensionar via server-side — usar `sharp`
  const sharp = require("sharp"); // ou importar no topo
  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const buffer = await file.arrayBuffer();
  const resized = await sharp(buffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  // Upload para Storage
  const photoPath = `${clubId}/${playerId}.${ext}`;
  const supabase = await createServerClient();

  const { error: uploadError } = await supabase.storage
    .from("player-photos")
    .upload(photoPath, resized, {
      contentType: `image/${ext}`,
      upsert: true, // sobrescrever se já existe
    });

  if (uploadError) {
    return err({
      code: "unknown",
      message: `Erro ao fazer upload: ${uploadError.message}`,
    });
  }

  return ok({ photoPath });
}
```

**Nota sobre `sharp`:** Instalar com `npm install sharp`. Em Vercel/Supabase Functions, `sharp` está pré-instalado.

### Server Action: `uploadPlayerPhoto` (adicionar a `src/lib/actions/players.ts`)

```ts
export async function uploadPlayerPhoto(
  playerId: string,
  file: File
): Promise<Result<{ photoPath: string }, AppError>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  // Validar que o jogador pertence ao clube
  const { data: player } = await supabase
    .from("players")
    .select("club_id, photo_path")
    .eq("id", playerId)
    .eq("club_id", profile.club_id)
    .single();
  if (!player) return err({ code: "forbidden", message: "Jogador não encontrado" });

  // Upload file
  const uploadResult = await uploadPlayerPhotoFile(profile.club_id, playerId, file);
  if (!uploadResult.ok) return uploadResult;

  // Atualizar players.photo_path
  const { error: updateError } = await supabase
    .from("players")
    .update({ photo_path: uploadResult.value.photoPath })
    .eq("id", playerId)
    .eq("club_id", profile.club_id);

  if (updateError) {
    // Compensação: deletar ficheiro enviado
    await supabase.storage
      .from("player-photos")
      .remove([uploadResult.value.photoPath]);
    return err({ code: "unknown", message: updateError.message });
  }

  // Log de auditoria
  await logAccess("player.photo_updated", "player", playerId);

  return ok({ photoPath: uploadResult.value.photoPath });
}
```

### Componente: `src/components/ui/player-photo.tsx`

```tsx
import { getPlayerPhotoUrl } from "@/lib/storage";
import { User } from "lucide-react";
import Image from "next/image";

interface PlayerPhotoProps {
  photoPath: string | null | undefined;
  fullName: string;
  size?: "sm" | "md" | "lg"; // 32, 48, 96px
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 96,
};

export async function PlayerPhoto({
  photoPath,
  fullName,
  size = "md",
}: PlayerPhotoProps) {
  const photoUrl = await getPlayerPhotoUrl(photoPath);
  const sizePixels = sizeMap[size];

  if (!photoUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-neutral-100"
        style={{ width: sizePixels, height: sizePixels }}
      >
        <User className="text-neutral-400" size={size === "sm" ? 16 : size === "md" ? 24 : 48} />
      </div>
    );
  }

  return (
    <picture>
      <source srcSet={`${photoUrl}&quality=webp`} type="image/webp" />
      <Image
        src={photoUrl}
        alt={fullName}
        width={sizePixels}
        height={sizePixels}
        className="rounded-full object-cover"
        loading="lazy"
      />
    </picture>
  );
}
```

**Nota:** Este é um Server Component. Para uso em Client Components, criar uma wrapper:

```tsx
"use client";
import { PlayerPhoto as ServerPlayerPhoto } from "@/components/ui/player-photo";
export function PlayerPhotoClient(props) {
  return <Suspense fallback={<div>...</div>}><ServerPlayerPhoto {...props} /></Suspense>;
}
```

### Formulário de edição `/plantel/[id]/editar`

```tsx
// Adicionar ao form existente (react-hook-form)
import { getPlayerPhotoUrl } from "@/lib/storage";
import { PlayerPhoto } from "@/components/ui/player-photo";

export default function EditPlayerForm({ playerId, currentPhotoPath, ...formProps }) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    // Client-side validation
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      // Mostrar erro inline
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      // Mostrar erro inline
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (evt) => setPhotoPreview(evt.target?.result as string);
    reader.readAsDataURL(file);

    // Upload server action
    setUploadingPhoto(true);
    const result = await uploadPlayerPhoto(playerId, file);
    setUploadingPhoto(false);

    if (result.ok) {
      // Refetch player para atualizar photo_path
      // ou mostrar CalmConfirmation
    } else {
      // Mostrar erro
    }
  }

  return (
    <form>
      {/* ... outros campos ... */}
      
      <div className="space-y-2">
        <label>Foto do Jogador</label>
        
        {/* Preview (com URL assinada) */}
        {photoPreview ? (
          <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded" />
        ) : currentPhotoPath ? (
          <Suspense fallback={<div className="w-32 h-32 bg-neutral-100" />}>
            <PlayerPhoto photoPath={currentPhotoPath} fullName={playerName} size="lg" />
          </Suspense>
        ) : null}

        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          disabled={uploadingPhoto}
        />

        {uploadingPhoto && <Spinner />}
      </div>
    </form>
  );
}
```

### Teste: cross-club isolation

```ts
// __tests__/lib/storage/player-photo.test.ts
import { describe, it, expect, vi } from "vitest";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-a" } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              id: "player-1",
              club_id: "club-a",
              full_name: "Player A",
            },
          })),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://..." },
        })),
      })),
    },
  })),
}));

describe("uploadPlayerPhoto", () => {
  it("should reject upload from different club", async () => {
    // Configurar mock: user from club-b, player from club-a
    // Esperar rejeição
  });

  it("should accept upload from same club", async () => {
    // Configurar mock: user from club-a, player from club-a
    // Esperar sucesso
  });

  it("should reject invalid file type", async () => {
    const file = new File(["data"], "file.txt", { type: "text/plain" });
    // Esperar erro de validação
  });

  it("should reject file > 2MB", async () => {
    const largeFile = new File([new Uint8Array(3 * 1024 * 1024)], "large.jpg");
    // Esperar erro de validação
  });
});
```

---

## Previous Story Intelligence

**Story 2.1: Player Records & Plantel List** (done — 2026-05-17)

- Migrações `000070_players_positions.sql` e `000075_player_rpc.sql` implementadas
- Server Actions em `src/lib/actions/players.ts`: `createPlayer`, `updatePlayer`, `archivePlayer`, `getPlayers`, `getPlayer`
- Zod schemas em `src/lib/schemas/players.ts`
- RLS policies padrão estabelecidas (club isolation + staff write)
- Componentes: `<SemaforoBadge>`, `<CalmConfirmation>`, `<Dialog>` já estão testados
- **Padrão estabelecido:** Server Actions nunca lanç exceções ao cliente — usar `Result<T, AppError>`
- **Padrão de audit:** `logAccess()` em `src/lib/actions/audit.ts`
- Índices em `club_id` para performance (NFR1)

**Story 1.12: Audit Logs & Telemetry** (done)

- `logAccess()` está em `src/lib/actions/audit.ts`
- Chamar com `await logAccess('player.photo_updated', 'player', playerId)`
- Fire-and-forget — não bloqueia se falhar

**Story 1.8: Design System** (done)

- `<CalmConfirmation>`, `<Dialog>`, `<EmptyState>` já existem
- Padrão: 3 variantes de Button (primary, ghost, destructive)
- Touch targets ≥44×44px

---

## Git Intelligence Summary

```
7e141a4 Refactor audit logging schema and update database types
5d5f14c chore(2-1): mark story as done — 366 tests passing
cfba2bb feat(2-1): player records & plantel list with code review fixes
e6ce1fd feat: enhance accessibility with skip link and main content IDs
```

### Padrões Estabelecidos

1. **Migrações:** `000XXX_name.sql` sequencial (próxima = `000080`)
2. **Server Actions:** `"use server"` no topo, validação Zod, `Result<T, AppError>`
3. **Storage:** Caminho privado, URLs assinadas com expiry
4. **Redimensionamento:** `sharp` para processamento server-side
5. **Audit:** `logAccess()` para todas as operações de dados pessoais
6. **Testing:** Mockar Supabase, não precisar DB local para unit tests

---

## Latest Tech Information

### Supabase Storage JS v2.105.4

- `.upload(path, file, { contentType, upsert })` — upsert sobre-escreve se existe
- `.createSignedUrl(path, expiresIn)` — expiresIn em segundos (3600 = 1h)
- Políticas via RLS no bucket (SQL ou console UI)
- `(storage.foldername(name))[1]` extrai primeiro segmento do path para club_id

### Sharp v0.33.0+

- `sharp(buffer).resize(512, 512, { fit: "inside", withoutEnlargement: true })` — mantém aspect ratio
- `.toBuffer()` ou `.toFormat('webp')` para diferentes formatos
- Instalado por defeito em Vercel/Supabase Functions

### Next.js 16 Image Component

- `<Image>` com `loading="lazy"`, `sizes`, srcset automático
- `<picture>` para WebP + fallback (manual ou via `<Image>` priority)

---

## Project Context Reference

```
ProjectR/ (git root)
├── project-r/
│   ├── supabase/
│   │   └── migrations/
│   │       ├── 000070–000075_*.sql    (Story 2.1)
│   │       └── 000080_players_photo.sql   ← NEW
│   └── src/
│       ├── lib/
│       │   ├── actions/
│       │   │   ├── audit.ts           ← logAccess()
│       │   │   ├── players.ts         ← UPDATE (adicionar uploadPlayerPhoto)
│       │   ├── storage.ts             ← NEW (helpers)
│       │   ├── schemas/players.ts     ← já existe
│       │   └── supabase/database.types.ts ← UPDATE
│       ├── components/ui/
│       │   ├── player-photo.tsx       ← NEW (componente reutilizável)
│       │   ├── calm-confirmation.tsx  ← usar
│       │   └── dialog.tsx             ← usar
│       └── app/(staff)/plantel/
│           ├── page.tsx               ← UPDATE (thumbnails)
│           ├── [id]/page.tsx          ← UPDATE (foto grande)
│           └── [id]/editar/page.tsx   ← UPDATE (file input)
│
│── _bmad-output/
│   ├── planning-artifacts/
│   │   └── epics.md
│   └── implementation-artifacts/
│       ├── 2-1-player-records-plantel-list.md (referência)
│       └── 2-2-player-photo-upload.md ← THIS FILE
```

**Referências:**
- FR12: Analista pode gerenciar dados de jogador (incluindo foto)
- FR13: Dados de jogador em múltiplas leituras (fotos são leituras visuais)
- FR21: Dados de saúde nunca públicos → URLs assinadas (NFR21)
- FR3: Isolamento multi-tenant → políticas RLS no bucket
- NFR30: Residência EU → bucket em região EU
- NFR44: Alt text obrigatório em imagens = full_name
- NFR54: Cobertura ≥80% em funções críticas

---

## Dev Agent Record

### Completion Status

- **Status:** ready-for-dev
- **Created:** 2026-05-17
- **Ultimate context engine analysis:** Completed ✅
- **Developer is ready to implement:** Yes

### Key Implementation Notes

1. **Bucket RLS:** Políticas baseadas em path prefix (club_id) — validar que `auth.club_id()` está acessível (Story 1.4)
2. **URL Assinada:** `getPlayerPhotoUrl()` é Server Function (chama Supabase) — usar em Server Components ou `getServerSideProps`
3. **Redimensionamento:** Servidor-side com `sharp` — cliente apenas valida tipo/tamanho
4. **Atomicidade:** Upload → Store → Update player — compensação se Update falhar
5. **Isolamento:** Explícito `.eq("club_id", profile.club_id)` + implícito nas políticas RLS
6. **Telemetria:** `logAccess()` fire-and-forget após Update bem-sucedido
7. **Fallback:** Componente `<PlayerPhoto>` renderiza ícone `<User>` se sem foto
8. **Performance:** `loading="lazy"` + srcset para diferentes densidades de pixel

---

## File List

- `project-r/supabase/migrations/000080_players_photo.sql` (NEW)
- `project-r/src/lib/supabase/database.types.ts` (UPDATE)
- `project-r/src/lib/storage.ts` (NEW)
- `project-r/src/lib/actions/players.ts` (UPDATE)
- `project-r/src/components/ui/player-photo.tsx` (NEW)
- `project-r/src/app/(staff)/plantel/page.tsx` (UPDATE)
- `project-r/src/app/(staff)/plantel/[id]/page.tsx` (UPDATE)
- `project-r/src/app/(staff)/plantel/[id]/editar/page.tsx` (UPDATE)
- `project-r/__tests__/lib/storage/player-photo.test.ts` (NEW)

---

## Change Log

- 2026-05-17: Story 2.2 (player-photo-upload) criada — bucket RLS, migração, Server Actions, componentes, testes

