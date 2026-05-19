"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { newId } from "@/lib/uuid";
import { logAccess } from "@/lib/actions/audit";
import { uploadPlayerPhotoFile } from "@/lib/storage";
import {
  PlayerCreateSchema,
  PlayerUpdateSchema,
  ArchivePlayerSchema,
  MarkInactiveSchema,
  ReactivatePlayerSchema,
  InvitePlayerSchema,
  ResendInviteSchema,
  AGE_GROUPS,
} from "@/lib/schemas/players";
import type { PlayerCreate, PlayerUpdate, ArchivePlayer, MarkInactive, ReactivatePlayer, InvitePlayer, ResendInvite, AgeGroup } from "@/lib/schemas/players";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";

export interface PlayerPosition {
  id: string;
  position: string;
  is_primary: boolean;
  sort_order: number;
}

export interface PlayerWithPositions {
  id: string;
  club_id: string;
  profile_id: string | null;
  jersey_num: number;
  full_name: string;
  birthdate: string;
  age_group: string;
  is_archived: boolean;
  archived_at: string | null;
  is_active: boolean;
  inactive_reason: string | null;
  photo_path: string | null;
  email: string | null;
  invite_sent_at: string | null;
  created_at: string;
  updated_at: string;
  positions: PlayerPosition[];
}

export type GroupedPlayers = Record<AgeGroup, PlayerWithPositions[]>;

function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

const AGE_GROUP_ORDER: Record<string, number> = {
  u14: 0,
  u15: 1,
  u17: 2,
  u19: 3,
  senior: 4,
};

export async function getPlayers(
  options?: { showInactive?: boolean }
): Promise<Result<GroupedPlayers, AppError>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("players")
    .select("*, positions(*)")
    .eq("club_id", profile.club_id)
    .eq("is_archived", false)
    .eq("is_active", options?.showInactive ? false : true)
    .order("full_name");

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  const players = (data ?? []) as PlayerWithPositions[];

  const sorted = [...players].sort((a, b) =>
    lastNameOf(a.full_name).localeCompare(lastNameOf(b.full_name), "pt")
  );

  const grouped = AGE_GROUPS.reduce<GroupedPlayers>((acc, group) => {
    acc[group] = [];
    return acc;
  }, {} as GroupedPlayers);

  for (const player of sorted) {
    if (!AGE_GROUPS.includes(player.age_group as AgeGroup)) {
      console.warn(`[getPlayers] Player ${player.id} has invalid age_group: ${player.age_group}`);
      continue;
    }
    const group = player.age_group as AgeGroup;
    grouped[group]?.push(player);
  }

  return ok(grouped);
}

export async function getPlayer(
  playerId: string
): Promise<Result<PlayerWithPositions, AppError>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("players")
    .select("id, club_id, profile_id, jersey_num, full_name, birthdate, age_group, is_archived, archived_at, is_active, inactive_reason, photo_path, email, invite_sent_at, created_at, updated_at, positions(id, position, is_primary, sort_order)")
    .eq("id", playerId)
    .eq("club_id", profile.club_id)
    .single();

  if (error || !data) {
    return err({ code: "not_found", message: "Jogador não encontrado" });
  }

  return ok(data as PlayerWithPositions);
}

export async function createPlayer(
  input: PlayerCreate
): Promise<Result<{ id: string }, AppError>> {
  const validated = PlayerCreateSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: "Dados inválidos",
      details: { issues: validated.error.issues },
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const playerId = newId();

  const { error: insertError } = await supabase.from("players").insert({
    id: playerId,
    club_id: profile.club_id,
    full_name: validated.data.fullName,
    birthdate: validated.data.birthdate,
    jersey_num: validated.data.jerseyNum,
    age_group: validated.data.ageGroup,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return err({
        code: "conflict",
        message: "Número de camisola já usado neste clube",
        details: { field: "jerseyNum" },
      });
    }
    return err({ code: "unknown", message: insertError.message });
  }

  const positionsJson = validated.data.positions.map((p, i) => ({
    position: p.position,
    is_primary: p.isPrimary,
    sort_order: i,
  }));

  const { error: rpcError } = await supabase.rpc("upsert_player_positions", {
    p_player_id: playerId,
    p_positions: positionsJson as unknown as Json,
  });

  if (rpcError) {
    // Compensate: delete player if positions RPC fails (ensures atomicity)
    const { error: deleteError } = await supabase.from("players").delete().eq("id", playerId);
    if (deleteError) {
      // Log both errors for investigation; return RPC error as primary
      console.error("RPC and compensating delete both failed", { rpcError, deleteError });
    }
    return err({ code: "unknown", message: rpcError.message });
  }

  redirect(`/plantel/${playerId}?created=1`);
}

export async function updatePlayer(
  input: PlayerUpdate
): Promise<Result<{ id: string }, AppError>> {
  const validated = PlayerUpdateSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: "Dados inválidos",
      details: { issues: validated.error.issues },
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  // Fetch current player state before update (for potential rollback)
  const { data: currentPlayer } = await supabase
    .from("players")
    .select("full_name, birthdate, jersey_num, age_group")
    .eq("id", validated.data.playerId)
    .single();

  const { error: updateError } = await supabase
    .from("players")
    .update({
      full_name: validated.data.fullName,
      birthdate: validated.data.birthdate,
      jersey_num: validated.data.jerseyNum,
      age_group: validated.data.ageGroup,
    })
    .eq("id", validated.data.playerId);

  if (updateError) {
    if (updateError.code === "23505") {
      return err({
        code: "conflict",
        message: "Número de camisola já usado neste clube",
        details: { field: "jerseyNum" },
      });
    }
    return err({ code: "unknown", message: updateError.message });
  }

  const positionsJson = validated.data.positions.map((p, i) => ({
    position: p.position,
    is_primary: p.isPrimary,
    sort_order: i,
  }));

  const { error: rpcError } = await supabase.rpc("upsert_player_positions", {
    p_player_id: validated.data.playerId,
    p_positions: positionsJson as unknown as Json,
  });

  if (rpcError) {
    // Compensate: revert player update if positions RPC fails
    if (currentPlayer) {
      await supabase
        .from("players")
        .update({
          full_name: currentPlayer.full_name,
          birthdate: currentPlayer.birthdate,
          jersey_num: currentPlayer.jersey_num,
          age_group: currentPlayer.age_group,
        })
        .eq("id", validated.data.playerId);
    }
    return err({ code: "unknown", message: rpcError.message });
  }

  await logAccess("player.updated", "player", validated.data.playerId);

  redirect(`/plantel/${validated.data.playerId}?updated=1`);
}

export async function archivePlayer(
  input: ArchivePlayer
): Promise<Result<void, AppError>> {
  const validated = ArchivePlayerSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: "ID de jogador inválido",
      details: { issues: validated.error.issues },
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { error } = await supabase
    .from("players")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id);

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  await logAccess("player.archived", "player", validated.data.playerId);

  redirect("/plantel");
}

export async function markPlayerInactive(
  input: MarkInactive
): Promise<Result<void, AppError>> {
  const validated = MarkInactiveSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_archived, is_active")
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id)
    .single();

  if (!currentPlayer) {
    return err({ code: "not_found", message: "Jogador não encontrado" });
  }

  if (currentPlayer.is_archived) {
    return err({ code: "forbidden", message: "Não é possível marcar jogador arquivado como inactivo" });
  }

  if (!currentPlayer.is_active) {
    return err({ code: "conflict", message: "Jogador já está inactivo" });
  }

  const { error } = await supabase
    .from("players")
    .update({
      is_active: false,
      inactive_reason: validated.data.inactive_reason ?? null,
    })
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id)
    .select("is_active")
    .single();

  if (error) return err({ code: "unknown", message: error.message });

  try {
    await logAccess("player.marked_inactive", "player", validated.data.playerId);
  } catch (logError) {
    console.error("[markPlayerInactive] Audit log failed:", logError);
  }

  redirect("/plantel");
}

export async function reactivatePlayer(
  input: ReactivatePlayer
): Promise<Result<void, AppError>> {
  const validated = ReactivatePlayerSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_active")
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id)
    .single();

  if (!currentPlayer) {
    return err({ code: "not_found", message: "Jogador não encontrado" });
  }

  if (currentPlayer.is_active) {
    return err({ code: "conflict", message: "Jogador já está activo" });
  }

  const { error } = await supabase
    .from("players")
    .update({
      is_active: true,
      inactive_reason: null,
    })
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id)
    .select("is_active")
    .single();

  if (error) return err({ code: "unknown", message: error.message });

  try {
    await logAccess("player.reactivated", "player", validated.data.playerId);
  } catch (logError) {
    console.error("[reactivatePlayer] Audit log failed:", logError);
  }

  redirect(`/plantel/${validated.data.playerId}?reativado=1`);
}

export async function uploadPlayerPhoto(
  playerId: string,
  file: File
): Promise<Result<{ photoPath: string }, AppError>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile) return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data: player } = await supabase
    .from("players")
    .select("club_id, photo_path")
    .eq("id", playerId)
    .eq("club_id", profile.club_id)
    .single();
  if (!player) return err({ code: "forbidden", message: "Jogador não encontrado" });

  const uploadResult = await uploadPlayerPhotoFile(profile.club_id, playerId, file);
  if (!uploadResult.ok) return uploadResult;

  const { error: updateError } = await supabase
    .from("players")
    .update({ photo_path: uploadResult.data.photoPath })
    .eq("id", playerId)
    .eq("club_id", profile.club_id);

  if (updateError) {
    const { error: removeError } = await supabase.storage
      .from("player-photos")
      .remove([uploadResult.data.photoPath]);
    if (removeError) {
      console.error("[uploadPlayerPhoto] Rollback failed — orphaned file:", removeError.message);
    }
    return err({ code: "unknown", message: updateError.message });
  }

  // Remove old photo if extension changed (prevents orphaned files in Storage)
  if (player.photo_path && player.photo_path !== uploadResult.data.photoPath) {
    await supabase.storage.from("player-photos").remove([player.photo_path]);
  }

  await logAccess("player.photo_updated", "player", playerId);

  return ok({ photoPath: uploadResult.data.photoPath });
}

export async function invitePlayer(
  input: InvitePlayer
): Promise<Result<void, AppError>> {
  const validated = InvitePlayerSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: "Dados inválidos",
      details: { issues: validated.error.issues },
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();
  if (!staffProfile) return err({ code: "forbidden", message: "Perfil não encontrado" });
  if (!["coach", "analyst"].includes(staffProfile.role)) {
    return err({
      code: "forbidden",
      message: "Sem permissão para convidar jogadores",
    });
  }

  // Verificar jogador pertence ao clube e não está arquivado
  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, age_group, email, is_archived, club_id")
    .eq("id", validated.data.playerId)
    .eq("club_id", staffProfile.club_id)
    .single();
  if (!player) return err({ code: "not_found", message: "Jogador não encontrado" });
  if (player.is_archived) {
    return err({
      code: "forbidden",
      message: "Não é possível convidar jogador arquivado",
    });
  }

  // Verificar unicidade de email no clube
  const { data: existingByEmail } = await supabase
    .from("players")
    .select("id")
    .eq("club_id", staffProfile.club_id)
    .eq("email", validated.data.email)
    .neq("id", validated.data.playerId)
    .maybeSingle();
  if (existingByEmail) {
    return err({
      code: "email_in_use",
      message: "Este email já está associado a outro jogador neste clube",
      details: { field: "email" },
    });
  }

  // Guardar na variável para evitar null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return err({ code: "unknown", message: "Configuração do servidor em falta. Contacta o suporte." });
  }

  // Enviar convite via Admin API
  const serviceRole = getServiceRoleClient();
  let inviteData: Awaited<ReturnType<typeof serviceRole.auth.admin.inviteUserByEmail>>["data"];
  let inviteError: Awaited<ReturnType<typeof serviceRole.auth.admin.inviteUserByEmail>>["error"];
  try {
    ({ data: inviteData, error: inviteError } =
      await serviceRole.auth.admin.inviteUserByEmail(
        validated.data.email,
        {
          data: {
            club_id: staffProfile.club_id,
            role: "player",
            player_id: validated.data.playerId,
          },
        }
      ));
  } catch (e) {
    return err({ code: "unknown", message: `Erro ao enviar convite: ${e instanceof Error ? e.message : String(e)}` });
  }

  if (inviteError) {
    // Supabase retorna erro se email já existe em auth.users
    const msg = inviteError.message.toLowerCase();
    const isConflict =
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      msg.includes("user already exists");
    if (isConflict) {
      return err({
        code: "email_conflict",
        message: "Este email já tem uma conta no sistema",
        details: { field: "email" },
      });
    }
    return err({ code: "unknown", message: inviteError.message });
  }

  if (!inviteData.user) {
    return err({
      code: "unknown",
      message: "Falha ao criar utilizador no Supabase",
    });
  }

  // Criar perfil (ANTES da aceitação — garante que o Auth Hook injeta claims na primeira sessão)
  const { error: profileError } = await serviceRole
    .from("profiles")
    .insert({
      id: inviteData.user.id,
      club_id: staffProfile.club_id,
      role: "player",
      full_name: player.full_name,
    });

  if (profileError) {
    // Compensação: eliminar o utilizador criado para manter estado consistente
    const deleteResult = await serviceRole.auth.admin.deleteUser(inviteData.user.id);
    if (deleteResult.error) {
      // Falha crítica: auth user criado mas não conseguimos deleter e perfil não criou
      console.error("[invitePlayer] Critical: orphaned auth user", {
        userId: inviteData.user.id,
        playerId: validated.data.playerId,
        deleteError: deleteResult.error.message,
      });
    }
    return err({
      code: "profile_creation_failed",
      message:
        "Erro ao criar perfil do jogador. Por favor tenta novamente.",
    });
  }

  // Ligar profile_id ao registo do jogador (usar now() para timestamp consistente)
  const { error: updateError } = await supabase
    .from("players")
    .update({
      profile_id: inviteData.user.id,
      email: validated.data.email,
      invite_sent_at: new Date().toISOString(),
    })
    .eq("id", validated.data.playerId)
    .eq("club_id", staffProfile.club_id)
    .is("profile_id", null);

  if (updateError) {
    return err({
      code: "link_failed",
      message:
        "Convite enviado mas não foi possível ligar o jogador. Contacta o suporte.",
    });
  }

  await logAccess("player.invited", "player", validated.data.playerId);

  redirect(`/plantel/${validated.data.playerId}?invited=1`);
}

export async function resendPlayerInvite(
  input: ResendInvite
): Promise<Result<void, AppError>> {
  const validated = ResendInviteSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: "Dados inválidos",
      details: { issues: validated.error.issues },
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();
  if (!staffProfile) return err({ code: "forbidden", message: "Perfil não encontrado" });
  if (!["coach", "analyst"].includes(staffProfile.role)) {
    return err({
      code: "forbidden",
      message: "Sem permissão para reenviar convites",
    });
  }

  // Verificar jogador pertence ao clube e não está arquivado
  const { data: player } = await supabase
    .from("players")
    .select("id, email, club_id, is_archived")
    .eq("id", validated.data.playerId)
    .eq("club_id", staffProfile.club_id)
    .single();
  if (!player) return err({ code: "not_found", message: "Jogador não encontrado" });
  if (player.is_archived) {
    return err({
      code: "forbidden",
      message: "Não é possível reenviar convite para jogador arquivado",
    });
  }

  // Verificar que jogador tem email registado (pré-condição)
  if (!player.email) {
    return err({
      code: "no_email",
      message: "Jogador não tem email registado. Enviar convite primeiro.",
    });
  }

  // Reenviar convite via Admin API
  const serviceRole = getServiceRoleClient();
  const { error: resendError } =
    await serviceRole.auth.admin.inviteUserByEmail(player.email, {
      data: {
        club_id: staffProfile.club_id,
        role: "player",
        player_id: validated.data.playerId,
      },
    });

  if (resendError) {
    return err({ code: "unknown", message: resendError.message });
  }

  // Atualizar invite_sent_at
  const { error: updateError } = await supabase
    .from("players")
    .update({ invite_sent_at: new Date().toISOString() })
    .eq("id", validated.data.playerId)
    .eq("club_id", staffProfile.club_id)
    .not("email", "is", null);

  if (updateError) {
    return err({
      code: "update_failed",
      message: "Convite reenviado mas não foi possível registar. Tenta novamente.",
    });
  }

  await logAccess("player.invite_resent", "player", validated.data.playerId);

  redirect(`/plantel/${validated.data.playerId}?resent=1`);
}

async function triggerPhotoCleanup(supabaseUrl: string, serviceKey: string, maxRetries = 3): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/anonymize-player-photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return; // Success
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Log final failure but don't throw (cleanup is best-effort)
  console.error("[anonymizePlayer] Photo cleanup failed after retries:", lastError?.message || "Unknown error");
}

export async function anonymizePlayer(
  playerId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Não autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { success: false, message: "Perfil não encontrado" };

  if (!["coach", "analyst"].includes(profile.role)) {
    return { success: false, message: "Sem permissão para anonimizar jogadores" };
  }

  const { data, error } = await supabase.rpc("anonymize_archived_player", {
    p_player_id: playerId,
  });

  if (error) {
    return { success: false, message: `Anonimização falhou: ${error.message}` };
  }

  if (data === false) {
    return { success: false, message: "Jogador não elegível para anonimização (não arquivado, já anonimizado, ou < 5 épocas)" };
  }

  await logAccess("player.anonymized", "player", playerId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    // Trigger photo cleanup with retry logic (best-effort, non-blocking)
    triggerPhotoCleanup(supabaseUrl, serviceKey).catch((e: unknown) => {
      console.error("[anonymizePlayer] Photo cleanup error:", e instanceof Error ? e.message : String(e));
    });
  }

  return { success: true, message: "Jogador anonimizado com sucesso" };
}

