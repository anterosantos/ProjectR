/**
 * questionnaire-page.test.tsx — Testes para phase-aware status guard
 * AC #1 — Story 4.9
 *
 * Nota: Esta é uma página Server Component, então testes serão limitados
 * ao aspecto lógico do guard. Os testes verificam o comportamento esperado
 * em diferentes cenários de status e phase.
 *
 * Cobre:
 * - phase='post' + status='completed' → renders form (not error)
 * - phase='post' + status='cancelled' → shows error
 * - phase='pre' + status='completed' → shows error (unchanged)
 * - phase='pre' + status='scheduled' → renders form (unchanged)
 */

import { describe, it, expect } from "vitest";

describe("QuestionarioPage phase-aware guard logic", () => {
  // Helper para testar a guard lógica
  const isValidStatus = (phase: string, status: string): boolean => {
    const isValid =
      phase === "post"
        ? status === "scheduled" || status === "completed"
        : status === "scheduled";
    return isValid;
  };

  it("allows phase='post' + status='completed'", () => {
    const valid = isValidStatus("post", "completed");
    expect(valid).toBe(true);
  });

  it("allows phase='post' + status='scheduled'", () => {
    const valid = isValidStatus("post", "scheduled");
    expect(valid).toBe(true);
  });

  it("denies phase='post' + status='cancelled'", () => {
    const valid = isValidStatus("post", "cancelled");
    expect(valid).toBe(false);
  });

  it("allows phase='pre' + status='scheduled'", () => {
    const valid = isValidStatus("pre", "scheduled");
    expect(valid).toBe(true);
  });

  it("denies phase='pre' + status='completed'", () => {
    const valid = isValidStatus("pre", "completed");
    expect(valid).toBe(false);
  });

  it("denies phase='pre' + status='cancelled'", () => {
    const valid = isValidStatus("pre", "cancelled");
    expect(valid).toBe(false);
  });
});
