import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Zod validation tests for the lineup submission schema
 * These tests validate the input validation logic without requiring database mocks.
 */

describe("Lineup Validation Schema", () => {
  const SubmitLineupSchema = z.object({
    sessionId: z.string().uuid("ID de sessão inválido"),
    players: z
      .array(
        z.object({
          playerId: z.string().uuid("ID de jogador inválido"),
          role: z.enum(["starter", "bench"]),
          shirtNum: z.number().int().positive().max(99).nullable().optional(),
        })
      )
      .min(1, "Pelo menos um jogador é necessário")
      .refine(
        (players) => {
          const starterCount = players.filter((p) => p.role === "starter").length;
          return starterCount === 11;
        },
        {
          message: "Deve seleccionar exactamente 11 titulares",
        }
      ),
  });

  describe("Valid inputs", () => {
    it("should accept exactly 11 starters", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const validData = {
        sessionId,
        players: Array.from({ length: 11 }, (_, i) => {
          const paddedI = String(i).padStart(4, "0");
          return {
            playerId: `550e8400-e29b-41d4-a716-44665544${paddedI}`,
            role: "starter" as const,
            shirtNum: i + 1,
          };
        }),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept 11 starters + benches", () => {
      const players = Array.from({ length: 11 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        role: "starter" as const,
        shirtNum: i + 1,
      })).concat(
        Array.from({ length: 3 }, (_, i) => ({
          playerId: `550e8400-e29b-41d4-a716-446655441${String(i).padStart(3, "0")}`,
          role: "bench" as const,
        }))
      );

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(true);
    });

    it("should accept optional shirtNum", () => {
      const validData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: Array.from({ length: 11 }, (_, i) => ({
          playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
          role: "starter" as const,
          // shirtNum omitted
        })),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid inputs - starter count", () => {
    it("should reject <11 starters", () => {
      const invalidData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [
          { playerId: "550e8400-e29b-41d4-a716-446655440001", role: "starter" as const },
        ],
      };

      const result = SubmitLineupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("11 titulares");
      }
    });

    it("should reject >11 starters", () => {
      const players = Array.from({ length: 12 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        role: "starter" as const,
      }));

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero players", () => {
      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Invalid inputs - UUID format", () => {
    it("should reject invalid sessionId", () => {
      const invalidData = {
        sessionId: "not-a-uuid",
        players: Array.from({ length: 11 }, (_, i) => ({
          playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
          role: "starter" as const,
        })),
      };

      const result = SubmitLineupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("sessão");
      }
    });

    it("should reject invalid playerId", () => {
      const invalidData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [
          { playerId: "invalid-uuid", role: "starter" as const },
        ],
      };

      const result = SubmitLineupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Invalid inputs - shirtNum constraints", () => {
    it("should reject zero shirtNum", () => {
      const players = Array.from({ length: 11 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        role: "starter" as const,
        shirtNum: i === 0 ? 0 : i + 1, // First player has 0
      }));

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(false);
    });

    it("should reject shirtNum > 99", () => {
      const players = Array.from({ length: 11 }, (_, i) => ({
        playerId: `550e8400-e29b-41d4-a716-446655440${String(i).padStart(3, "0")}`,
        role: "starter" as const,
        shirtNum: i === 0 ? 100 : i + 1,
      }));

      const result = SubmitLineupSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players,
      });

      expect(result.success).toBe(false);
    });

    it("should accept shirtNum 1-99", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const validData = {
        sessionId,
        players: Array.from({ length: 11 }, (_, i) => {
          const paddedI = String(i).padStart(4, "0");
          return {
            playerId: `550e8400-e29b-41d4-a716-44665544${paddedI}`,
            role: "starter" as const,
            shirtNum: i + 1,
          };
        }),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("Role validation", () => {
    it("should accept starter role", () => {
      const validData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: Array.from({ length: 11 }, (_, i) => {
          const paddedI = String(i).padStart(4, "0");
          return {
            playerId: `550e8400-e29b-41d4-a716-44665544${paddedI}`,
            role: "starter" as const,
            shirtNum: i + 1,
          };
        }),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept bench role", () => {
      const validData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: Array.from({ length: 12 }, (_, i) => {
          const paddedI = String(i).padStart(4, "0");
          const player: any = {
            playerId: `550e8400-e29b-41d4-a716-44665544${paddedI}`,
            role: i < 11 ? ("starter" as const) : ("bench" as const),
          };
          if (i < 11) {
            player.shirtNum = i + 1;
          }
          return player;
        }),
      };

      const result = SubmitLineupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid role", () => {
      const invalidData = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        players: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { playerId: "550e8400-e29b-41d4-a716-446655440001", role: "invalid" as any },
        ],
      };

      const result = SubmitLineupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
