import { describe, it, expect } from "vitest";
import {
  calculateSrpeLoad,
  isSrpeInputValid,
  SRPE_VALUE_MIN,
  SRPE_VALUE_MAX,
  DURATION_MIN_MIN,
  DURATION_MIN_MAX,
} from "../srpe";

// ─── calculateSrpeLoad ────────────────────────────────────────────────────────

describe("calculateSrpeLoad", () => {
  it("calcula carga correcta para valor típico (srpe=7, dur=90)", () => {
    expect(calculateSrpeLoad(7, 90)).toBe(630);
  });

  it("boundary mínimo: srpe=1, dur=15 → 15", () => {
    expect(calculateSrpeLoad(SRPE_VALUE_MIN, DURATION_MIN_MIN)).toBe(15);
  });

  it("boundary máximo: srpe=10, dur=240 → 2400", () => {
    expect(calculateSrpeLoad(SRPE_VALUE_MAX, DURATION_MIN_MAX)).toBe(2400);
  });

  it("srpe=5, dur=60 → 300", () => {
    expect(calculateSrpeLoad(5, 60)).toBe(300);
  });

  it("srpe=3, dur=45 → 135", () => {
    expect(calculateSrpeLoad(3, 45)).toBe(135);
  });

  it("srpe=10, dur=15 → 150 (carga alta, sessão curta)", () => {
    expect(calculateSrpeLoad(10, 15)).toBe(150);
  });

  it("srpe=1, dur=240 → 240 (carga baixa, sessão longa)", () => {
    expect(calculateSrpeLoad(1, 240)).toBe(240);
  });

  it("é uma função pura — mesmo input dá sempre mesmo output", () => {
    const a = calculateSrpeLoad(6, 80);
    const b = calculateSrpeLoad(6, 80);
    expect(a).toBe(b);
    expect(a).toBe(480);
  });
});

// ─── isSrpeInputValid ─────────────────────────────────────────────────────────

describe("isSrpeInputValid", () => {
  // Casos válidos
  it("retorna true para inputs válidos típicos (srpe=7, dur=90)", () => {
    expect(isSrpeInputValid(7, 90)).toBe(true);
  });

  it("retorna true para boundary mínimo (srpe=1, dur=15)", () => {
    expect(isSrpeInputValid(SRPE_VALUE_MIN, DURATION_MIN_MIN)).toBe(true);
  });

  it("retorna true para boundary máximo (srpe=10, dur=240)", () => {
    expect(isSrpeInputValid(SRPE_VALUE_MAX, DURATION_MIN_MAX)).toBe(true);
  });

  it("retorna true para srpe=1 (mínimo da escala Foster)", () => {
    expect(isSrpeInputValid(1, 60)).toBe(true);
  });

  it("retorna true para srpe=10 (máximo da escala Foster)", () => {
    expect(isSrpeInputValid(10, 60)).toBe(true);
  });

  it("retorna true para dur=15 (sessão mínima)", () => {
    expect(isSrpeInputValid(5, 15)).toBe(true);
  });

  it("retorna true para dur=240 (sessão máxima)", () => {
    expect(isSrpeInputValid(5, 240)).toBe(true);
  });

  // srpe fora de range
  it("retorna false para srpe=0 (abaixo de 1)", () => {
    expect(isSrpeInputValid(0, 90)).toBe(false);
  });

  it("retorna false para srpe=11 (acima de 10)", () => {
    expect(isSrpeInputValid(11, 90)).toBe(false);
  });

  it("retorna false para srpe negativo", () => {
    expect(isSrpeInputValid(-1, 90)).toBe(false);
  });

  // duration fora de range
  it("retorna false para dur=14 (abaixo de 15)", () => {
    expect(isSrpeInputValid(7, 14)).toBe(false);
  });

  it("retorna false para dur=241 (acima de 240)", () => {
    expect(isSrpeInputValid(7, 241)).toBe(false);
  });

  it("retorna false para dur=0", () => {
    expect(isSrpeInputValid(7, 0)).toBe(false);
  });

  // Tipos errados
  it("retorna false quando srpeValue é string", () => {
    expect(isSrpeInputValid("7", 90)).toBe(false);
  });

  it("retorna false quando durationMin é string", () => {
    expect(isSrpeInputValid(7, "90")).toBe(false);
  });

  it("retorna false quando srpeValue é null", () => {
    expect(isSrpeInputValid(null, 90)).toBe(false);
  });

  it("retorna false quando durationMin é null", () => {
    expect(isSrpeInputValid(7, null)).toBe(false);
  });

  it("retorna false quando srpeValue é undefined", () => {
    expect(isSrpeInputValid(undefined, 90)).toBe(false);
  });

  it("retorna false quando ambos são undefined", () => {
    expect(isSrpeInputValid(undefined, undefined)).toBe(false);
  });

  it("retorna false para número não-inteiro (float)", () => {
    expect(isSrpeInputValid(7.5, 90)).toBe(false);
  });

  it("retorna false para durationMin não-inteiro (float)", () => {
    expect(isSrpeInputValid(7, 90.5)).toBe(false);
  });

  it("retorna false quando srpeValue é NaN", () => {
    expect(isSrpeInputValid(NaN, 90)).toBe(false);
  });
});
