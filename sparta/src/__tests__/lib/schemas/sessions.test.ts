import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionCreateSchema, SessionUpdateSchema } from "@/lib/schemas/sessions";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// A datetime 30 minutes from now — always within the 24h window
function futureISO(offsetMinutes = 30): string {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}

// A datetime-local string (what the form sends)
function futureDatetimeLocal(offsetMinutes = 30): string {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe("SessionCreateSchema", () => {
  const valid = {
    type: "training" as const,
    scheduledAt: futureISO(),
    durationMin: 90,
    location: "Campo Municipal",
    notes: "Sessão normal",
  };

  it("aceita dados válidos (tipo treino)", () => {
    const result = SessionCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("aceita tipo 'match'", () => {
    const result = SessionCreateSchema.safeParse({ ...valid, type: "match" });
    expect(result.success).toBe(true);
  });

  it("aceita tipo 'friendly'", () => {
    const result = SessionCreateSchema.safeParse({ ...valid, type: "friendly" });
    expect(result.success).toBe(true);
  });

  it("aplica durationMin=90 por defeito", () => {
    const { durationMin: _, ...withoutDuration } = valid;
    const result = SessionCreateSchema.safeParse(withoutDuration);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.durationMin).toBe(90);
  });

  it("aceita sem location e notes (opcionais)", () => {
    const { location: _l, notes: _n, ...minimal } = valid;
    const result = SessionCreateSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("rejeita tipo inválido", () => {
    const result = SessionCreateSchema.safeParse({ ...valid, type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejeita scheduledAt vazio", () => {
    const result = SessionCreateSchema.safeParse({ ...valid, scheduledAt: "" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toMatch(/obrigatória/i);
  });

  it("rejeita data passada a mais de 24h", () => {
    const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = SessionCreateSchema.safeParse({
      ...valid,
      scheduledAt: pastDate,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("retaguarda 24h");
  });

  it("aceita data passada a menos de 24h", () => {
    const recentPast = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const result = SessionCreateSchema.safeParse({
      ...valid,
      scheduledAt: recentPast,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita durationMin < 15", () => {
    const result = SessionCreateSchema.safeParse({
      ...valid,
      durationMin: 14,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("15");
  });

  it("rejeita durationMin > 240", () => {
    const result = SessionCreateSchema.safeParse({
      ...valid,
      durationMin: 241,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("240");
  });

  it("aceita durationMin=15 (limite inferior)", () => {
    const result = SessionCreateSchema.safeParse({ ...valid, durationMin: 15 });
    expect(result.success).toBe(true);
  });

  it("aceita durationMin=240 (limite superior)", () => {
    const result = SessionCreateSchema.safeParse({ ...valid, durationMin: 240 });
    expect(result.success).toBe(true);
  });

  it("rejeita location com mais de 100 caracteres", () => {
    const result = SessionCreateSchema.safeParse({
      ...valid,
      location: "x".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("100");
  });

  it("rejeita notes com mais de 500 caracteres", () => {
    const result = SessionCreateSchema.safeParse({
      ...valid,
      notes: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("500");
  });
});

describe("SessionUpdateSchema", () => {
  const valid = {
    id: VALID_UUID,
    type: "training" as const,
    scheduledAt: futureISO(),
    durationMin: 60,
  };

  it("aceita dados válidos de actualização", () => {
    expect(SessionUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita sem id", () => {
    const { id: _id, ...withoutId } = valid;
    const result = SessionUpdateSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("rejeita id com formato inválido", () => {
    const result = SessionUpdateSchema.safeParse({ ...valid, id: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toMatch(/inválido/i);
  });

  it("rejeita data passada a mais de 24h", () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const result = SessionUpdateSchema.safeParse({
      ...valid,
      scheduledAt: oldDate,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toContain("retaguarda 24h");
  });

  it("rejeita durationMin fora do intervalo 15-240", () => {
    const r1 = SessionUpdateSchema.safeParse({ ...valid, durationMin: 10 });
    const r2 = SessionUpdateSchema.safeParse({ ...valid, durationMin: 300 });
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
  });
});
