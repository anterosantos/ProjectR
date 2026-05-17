"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { newId } from "@/lib/uuid";
import { logAccess } from "@/lib/actions/audit";
import { uploadPlayerPhotoFile } from "@/lib/storage";
import {
  PlayerCreateSchema,
  PlayerUpdateSchema,
  ArchivePlayerSchema,
  AGE_GROUPS,
} from "@/lib/schemas/players";
import type { PlayerCreate, PlayerUpdate, ArchivePlayer, AgeGroup } from "@/lib/schemas/players";
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
  photo_path: string | null;
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

export async function getPlayers(): Promise<Result<GroupedPlayers, AppError>> {
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
    const group = player.age_group as AgeGroup;
    if (group in grouped) {
      grouped[group]?.push(player);
    }
  }

  return ok(grouped);
}

export async function getPlayer(
  playerId: string
): Promise<Result<PlayerWithPositions, AppError>> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, club_id, profile_id, jersey_num, full_name, birthdate, age_group, is_archived, photo_path, created_at, updated_at, positions(id, position, is_primary, sort_order)")
    .eq("id", playerId)
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
    .update({ is_archived: true })
    .eq("id", validated.data.playerId)
    .eq("club_id", profile.club_id);

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  await logAccess("player.archived", "player", validated.data.playerId);

  redirect("/plantel");
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

