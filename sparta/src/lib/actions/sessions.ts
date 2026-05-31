"use server";

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAccess } from "@/lib/actions/audit";
import { getCurrentSeason } from "@/lib/actions/seasons";
import {
  SessionCreateSchema,
  SessionUpdateSchema,
} from "@/lib/schemas/sessions";
import type { SessionCreate, SessionUpdate, Session } from "@/lib/schemas/sessions";
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
    .select("club_id, id")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

const SessionFiltersSchema = z.object({
  season_id: z.string().uuid().optional(),
  status: z.enum(["scheduled", "cancelled", "completed"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.enum(["training", "match", "friendly"]).optional(),
});

export type SessionFilters = z.infer<typeof SessionFiltersSchema>;

export async function getSessionsForClub(
  filters?: SessionFilters
): Promise<Result<Session[], AppError>> {
  const validated = SessionFiltersSchema.safeParse(filters ?? {});
  if (!validated.success) {
    return err({ code: "validation", message: "Filtros inválidos" });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  let query = supabase
    .from("sessions")
    .select("*")
    .eq("club_id", profile.club_id);

  if (validated.data.season_id) {
    query = query.eq("season_id", validated.data.season_id);
  }
  if (validated.data.status) {
    query = query.eq("status", validated.data.status);
  }
  if (validated.data.type) {
    query = query.eq("type", validated.data.type);
  }
  if (validated.data.from) {
    query = query.gte("scheduled_at", validated.data.from);
  }
  if (validated.data.to) {
    query = query.lte("scheduled_at", validated.data.to);
  }

  const { data, error } = await query.order("scheduled_at", { ascending: true });
  if (error) return err({ code: "unknown", message: error.message });
  return ok((data ?? []) as Session[]);
}

export async function getSessionById(
  sessionId: string
): Promise<Result<Session, AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .maybeSingle();

  if (error) return err({ code: "unknown", message: error.message });
  if (!data) return err({ code: "not_found", message: "Sessão não encontrada" });
  return ok(data as Session);
}

export async function createSession(
  input: SessionCreate
): Promise<Result<Session, AppError>> {
  const validated = SessionCreateSchema.safeParse(input);
  if (!validated.success) {
    const messages = validated.error.issues
      .map((issue) => issue.message)
      .join("; ");
    return err({ code: "validation", message: messages || "Dados inválidos" });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const seasonResult = await getCurrentSeason();
  if (!seasonResult.ok)
    return err({
      code: "unknown",
      message: `Erro ao obter época: ${seasonResult.error.message}`,
    });
  if (!seasonResult.data)
    return err({
      code: "no_season",
      message:
        "Sem época actual definida. Configure em /configuracoes/epocas.",
    });

  const serviceRole = getServiceRoleClient();
  const { data, error } = await serviceRole
    .from("sessions")
    .insert({
      club_id: profile.club_id,
      season_id: seasonResult.data.id,
      type: validated.data.type,
      scheduled_at: validated.data.scheduledAt,
      duration_min: validated.data.durationMin,
      location: validated.data.location ?? null,
      notes: validated.data.notes ?? null,
      created_by: profile.id,
    })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("season_id")) {
      return err({ code: "no_season", message: "Época foi removida" });
    }
    if (error.message.includes("club_id")) {
      return err({ code: "forbidden", message: "Seu clube foi removido" });
    }
    return err({ code: "unknown", message: "Erro ao guardar sessão" });
  }
  const session = data as Session;

  logAccess("session.created", "session", session.id).catch((e) => {
    console.error("audit log failed (non-blocking)", e);
  });

  return ok(session);
}

export async function updateSession(
  input: SessionUpdate
): Promise<Result<Session, AppError>> {
  const validated = SessionUpdateSchema.safeParse(input);
  if (!validated.success) {
    const messages = validated.error.issues
      .map((issue) => issue.message)
      .join("; ");
    return err({ code: "validation", message: messages || "Dados inválidos" });
  }

  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  // Check if session is editable (not cancelled/completed)
  const existingResult = await getSessionById(validated.data.id);
  if (!existingResult.ok) return existingResult;

  if (
    existingResult.data.status === "cancelled" ||
    existingResult.data.status === "completed"
  ) {
    return err({
      code: "forbidden",
      message: "Esta sessão não pode ser editada (cancelada/concluída)",
    });
  }

  const serviceRole = getServiceRoleClient();
  const { data, error } = await serviceRole
    .from("sessions")
    .update({
      type: validated.data.type,
      scheduled_at: validated.data.scheduledAt,
      duration_min: validated.data.durationMin,
      location: validated.data.location ?? null,
      notes: validated.data.notes ?? null,
    })
    .eq("id", validated.data.id)
    .eq("club_id", profile.club_id)
    .eq("status", "scheduled")
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("No rows found")) {
      return err({ code: "not_found", message: "Sessão não encontrada ou não pode ser editada (cancelada/concluída)" });
    }
    return err({ code: "unknown", message: "Erro ao atualizar sessão" });
  }
  const session = data as Session;

  logAccess("session.updated", "session", session.id).catch((e) => {
    console.error("audit log failed (non-blocking)", e);
  });

  return ok(session);
}

export async function cancelSession(
  sessionId: string
): Promise<Result<Session, AppError>> {
  const { supabase, user, profile } = await getAuthContext();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  if (!profile?.club_id)
    return err({ code: "forbidden", message: "Perfil não encontrado" });

  const existingResult = await getSessionById(sessionId);
  if (!existingResult.ok) return existingResult;

  if (existingResult.data.status !== "scheduled") {
    return err({
      code: "forbidden",
      message: "Só sessões agendadas podem ser canceladas",
    });
  }

  const serviceRole = getServiceRoleClient();
  const { data, error } = await serviceRole
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId)
    .eq("club_id", profile.club_id)
    .eq("status", "scheduled")
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("No rows found")) {
      return err({ code: "forbidden", message: "Sessão não encontrada ou já não pode ser cancelada" });
    }
    return err({ code: "unknown", message: "Erro ao cancelar sessão" });
  }
  const session = data as Session;

  logAccess("session.cancelled", "session", session.id).catch((e) => {
    console.error("audit log failed (non-blocking)", e);
  });

  return ok(session);
}
