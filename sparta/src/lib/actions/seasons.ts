"use server";

import { createServerClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/actions/audit";
import { SeasonCreateSchema, SeasonUpdateSchema } from "@/lib/schemas/seasons";
import type { SeasonCreate, SeasonUpdate, Season } from "@/lib/schemas/seasons";
import type { Result, AppError } from "@/lib/types";
import { ok, err } from "@/lib/types";

async function getAuthContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

export async function getSeasonsForClub(): Promise<Result<Season[], AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("club_id", profile.club_id)
    .order("start_date", { ascending: false });

  if (error) return err({ code: "unknown", message: error.message });
  return ok((data ?? []) as Season[]);
}

export async function getCurrentSeason(): Promise<
  Result<Season | null, AppError>
> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("club_id", profile.club_id)
    .eq("is_current", true)
    .maybeSingle();

  if (error) return err({ code: "unknown", message: error.message });
  return ok(data as Season | null);
}

export async function createSeason(
  input: SeasonCreate
): Promise<Result<Season, AppError>> {
  const validated = SeasonCreateSchema.safeParse(input);
  if (!validated.success) {
    const messages = validated.error.issues
      .map((issue) => issue.message)
      .join("; ");
    return err({
      code: "validation",
      message: messages || "Dados inválidos",
    });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .insert({
      club_id: profile.club_id,
      name: validated.data.name,
      start_date: validated.data.startDate,
      end_date: validated.data.endDate,
      is_current: false,
    })
    .select("*")
    .single();

  if (error) return err({ code: "unknown", message: error.message });
  const season = data as Season;

  if (validated.data.setAsCurrent) {
    const { error: rpcError } = await supabase.rpc("set_current_season", {
      p_season_id: season.id,
    });
    if (rpcError) {
      await supabase.from("seasons").delete().eq("id", season.id);
      return err({
        code: "unknown",
        message: `RPC falhou: ${rpcError.message}`,
      });
    }
  }

  try {
    await logAccess("season.created", "season", season.id);
  } catch (e) {
    console.error("audit log failed", e);
  }

  return ok(season);
}

export async function updateSeason(
  input: SeasonUpdate
): Promise<Result<Season, AppError>> {
  const validated = SeasonUpdateSchema.safeParse(input);
  if (!validated.success) {
    const messages = validated.error.issues
      .map((issue) => issue.message)
      .join("; ");
    return err({
      code: "validation",
      message: messages || "Dados inválidos",
    });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("seasons")
    .update({
      name: validated.data.name,
      start_date: validated.data.startDate,
      end_date: validated.data.endDate,
      is_current: validated.data.setAsCurrent ? true : false,
    })
    .eq("id", validated.data.id)
    .eq("club_id", profile.club_id)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("No rows found")) {
      return err({ code: "not_found", message: "Época não encontrada" });
    }
    return err({ code: "unknown", message: error.message });
  }
  const season = data as Season;

  if (validated.data.setAsCurrent && !season.is_current) {
    const { error: rpcError } = await supabase.rpc("set_current_season", {
      p_season_id: season.id,
    });
    if (rpcError) return err({ code: "unknown", message: rpcError.message });
  }

  try {
    await logAccess("season.updated", "season", season.id);
  } catch (e) {
    console.error("audit log failed", e);
  }

  return ok(season);
}
