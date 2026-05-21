import { describe, it, expect, vi, afterEach } from "vitest";
import { ageInYears } from "@/lib/utils/age";
import { maskEmail } from "@/lib/utils/mask-email";

// ─── ageInYears ──────────────────────────────────────────────────────────────

describe("ageInYears", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calcula correctamente 14 anos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20"));
    expect(ageInYears("2012-03-15")).toBe(14);
  });

  it("calcula 15 anos antes do aniversário (ainda 14)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20"));
    expect(ageInYears("2011-12-01")).toBe(14);
  });

  it("calcula 16 anos exactamente no aniversário", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20"));
    expect(ageInYears("2010-05-20")).toBe(16);
  });

  it("boundary 15→16: um dia antes do aniversário ainda é 15", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19"));
    expect(ageInYears("2010-05-20")).toBe(15);
  });

  it("calcula 0 para bebé nascido hoje", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20"));
    expect(ageInYears("2026-05-20")).toBe(0);
  });
});

// ─── maskEmail ───────────────────────────────────────────────────────────────

describe("maskEmail", () => {
  it("mascara email normal: e***@mail.com", () => {
    expect(maskEmail("email@mail.com")).toBe("e***@mail.com");
  });

  it("mascara email longo: s***@example.org", () => {
    expect(maskEmail("sandra@example.org")).toBe("s***@example.org");
  });

  it("retorna email sem alteração se não tem @", () => {
    expect(maskEmail("invalidemail")).toBe("invalidemail");
  });

  it("retorna email sem alteração se @ está na primeira posição", () => {
    expect(maskEmail("@domain.com")).toBe("@domain.com");
  });

  it("mascara email de um caracter local: a***@b.com", () => {
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
  });
});
