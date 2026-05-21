"use server";

import { createServerClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { logAccess } from "@/lib/actions/audit";
import {
  PlayerMetricCreateSchema,
  PlayerMetricUpdateSchema,
  type PlayerMetricCreate,
  type PlayerMetricUpdate,
} from "@/lib/schemas/metrics";

export interface PlayerMetric {
  id: string;
  player_id: string;
  club_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  recorded_at: string;
  created_by: string;
  created_at: string;
}

export async function addPlayerMetric(
  input: PlayerMetricCreate
): Promise<Result<{ id: string }, AppError>> {
  const validated = PlayerMetricCreateSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: validated.error.issues[0]?.message ?? "Dados inválidos",
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("id", validated.data.player_id)
    .single();
  if (!player)
    return err({ code: "forbidden", message: "Jogador não encontrado" });

  const { data, error } = await supabase
    .from("player_metrics")
    .insert({
      player_id: validated.data.player_id,
      club_id: player.club_id,
      weight_kg: validated.data.weight_kg ?? null,
      height_cm: validated.data.height_cm ?? null,
      recorded_at: validated.data.recorded_at,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return err({
      code: "unknown",
      message: error?.message ?? "Erro ao guardar leitura",
    });
  }

  await logAccess("metric.created", "player", validated.data.player_id);
  return ok({ id: data.id });
}

export async function getPlayerMetrics(
  playerId: string
): Promise<Result<PlayerMetric[], AppError>> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("player_metrics")
    .select("*")
    .eq("player_id", playerId)
    .order("recorded_at", { ascending: true });

  if (error) {
    return err({ code: "unknown", message: error.message });
  }

  if (!data) {
    return ok([]);
  }

  return ok(data as PlayerMetric[]);
}

export async function updatePlayerMetric(
  input: PlayerMetricUpdate
): Promise<Result<void, AppError>> {
  const validated = PlayerMetricUpdateSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "validation",
      message: validated.error.issues[0]?.message ?? "Dados inválidos",
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: existing } = await supabase
    .from("player_metrics")
    .select("id, player_id, recorded_at")
    .eq("id", validated.data.id)
    .single();

  if (!existing)
    return err({ code: "not_found", message: "Leitura não encontrada" });

  const recordedAt = new Date(existing.recorded_at as string);
  if (isNaN(recordedAt.getTime())) {
    return err({
      code: "forbidden",
      message: "Data de leitura inválida",
    });
  }
  const hoursSince = (Date.now() - recordedAt.getTime()) / 1000 / 3600;
  if (hoursSince > 24) {
    return err({
      code: "forbidden",
      message: "Só é possível editar leituras das últimas 24 horas",
    });
  }

  const updatePayload: {
    weight_kg?: number | null;
    height_cm?: number | null;
    recorded_at?: string;
  } = {};
  if (validated.data.weight_kg !== undefined)
    updatePayload.weight_kg = validated.data.weight_kg;
  if (validated.data.height_cm !== undefined)
    updatePayload.height_cm = validated.data.height_cm;
  if (validated.data.recorded_at !== undefined)
    updatePayload.recorded_at = validated.data.recorded_at;

  const { error } = await supabase
    .from("player_metrics")
    .update(updatePayload)
    .eq("id", validated.data.id);

  if (error) return err({ code: "unknown", message: error.message });

  await logAccess(
    "metric.updated",
    "player",
    existing.player_id as string
  );
  return ok(undefined);
}
