import { describe, it, expect } from "vitest";
import { SeasonCreateSchema, SeasonUpdateSchema } from "@/lib/schemas/seasons";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("SeasonCreateSchema", () => {
  const valid = {
    name: "2026/27",
    startDate: "2026-08-01",
    endDate: "2027-06-30",
    setAsCurrent: false,
  };

  it("aceita dados válidos", () => {
    expect(SeasonCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("aplica setAsCurrent=false por defeito", () => {
    const result = SeasonCreateSchema.safeParse({
      name: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setAsCurrent).toBe(false);
    }
  });

  it("rejeita nome vazio", () => {
    const result = SeasonCreateSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/obrigatório/i);
    }
  });

  it("rejeita nome com mais de 50 caracteres", () => {
    const result = SeasonCreateSchema.safeParse({
      ...valid,
      name: "x".repeat(51),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/longo/i);
    }
  });

  it("rejeita quando endDate <= startDate (igual)", () => {
    const result = SeasonCreateSchema.safeParse({
      ...valid,
      startDate: "2026-08-01",
      endDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("posterior");
    }
  });

  it("rejeita quando endDate < startDate", () => {
    const result = SeasonCreateSchema.safeParse({
      ...valid,
      startDate: "2026-08-01",
      endDate: "2026-07-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("posterior");
    }
  });

  it("rejeita data inválida", () => {
    const result = SeasonCreateSchema.safeParse({
      ...valid,
      startDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("SeasonUpdateSchema", () => {
  const valid = {
    id: VALID_UUID,
    name: "2026/27 Actualizada",
    startDate: "2026-08-01",
    endDate: "2027-06-30",
    setAsCurrent: true,
  };

  it("aceita dados válidos de actualização", () => {
    expect(SeasonUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita sem id", () => {
    const { id: _id, ...withoutId } = valid;
    const result = SeasonUpdateSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("rejeita id com formato inválido", () => {
    const result = SeasonUpdateSchema.safeParse({ ...valid, id: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/inválido/i);
    }
  });

  it("rejeita quando endDate <= startDate", () => {
    const result = SeasonUpdateSchema.safeParse({
      ...valid,
      startDate: "2026-08-01",
      endDate: "2026-07-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("posterior");
    }
  });
});
