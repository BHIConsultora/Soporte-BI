import { describe, expect, it } from "vitest";
import { calcularVenceSLA, minutosHabilesEntre, semaforoSLA, sumarHorasHabiles } from "@/dominio/sla";

/** Hora de Buenos Aires (UTC-3, sin horario de verano) → Date. */
const ba = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`);
const iso = (d: Date | null) => d?.toISOString() ?? null;
const SIN_FERIADOS = new Set<string>();
const CON_FERIADO_12 = new Set(["2026-10-12"]);

describe("SLA en horario hábil (lun–vie 9–18, Buenos Aires)", () => {
  describe("P1: fin del mismo día hábil", () => {
    it.each([
      ["martes 12:00", ba("2026-10-06", "12:00"), ba("2026-10-06", "18:00")],
      ["martes 09:00 justo", ba("2026-10-06", "09:00"), ba("2026-10-06", "18:00")],
      ["martes 07:00 (antes de hora)", ba("2026-10-06", "07:00"), ba("2026-10-06", "18:00")],
      ["martes 18:00 justo (ya cerró)", ba("2026-10-06", "18:00"), ba("2026-10-07", "18:00")],
      ["martes 20:00", ba("2026-10-06", "20:00"), ba("2026-10-07", "18:00")],
      ["viernes 19:00 → lunes", ba("2026-10-09", "19:00"), ba("2026-10-12", "18:00")],
      ["sábado → lunes", ba("2026-10-10", "11:00"), ba("2026-10-12", "18:00")],
    ])("%s", (_n, inicio, esperado) => {
      expect(iso(calcularVenceSLA(inicio, "P1", SIN_FERIADOS))).toBe(iso(esperado));
    });

    it("saltea feriados", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-10", "11:00"), "P1", CON_FERIADO_12))).toBe(iso(ba("2026-10-13", "18:00")));
    });
  });

  describe("P2: 24 horas hábiles", () => {
    it("martes 12:00 → jueves 18:00 (6 + 9 + 9)", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-06", "12:00"), "P2", SIN_FERIADOS))).toBe(iso(ba("2026-10-08", "18:00")));
    });
    it("martes 07:00 arranca a las 9 → jueves 15:00", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-06", "07:00"), "P2", SIN_FERIADOS))).toBe(iso(ba("2026-10-08", "15:00")));
    });
    it("viernes 17:00 cruza el fin de semana → miércoles 14:00", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-09", "17:00"), "P2", SIN_FERIADOS))).toBe(iso(ba("2026-10-14", "14:00")));
    });
    it("viernes 17:00 con feriado el lunes → jueves 14:00", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-09", "17:00"), "P2", CON_FERIADO_12))).toBe(iso(ba("2026-10-15", "14:00")));
    });
  });

  describe("P3: 72 horas hábiles", () => {
    it("martes 12:00 → viernes 16/10 12:00", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-06", "12:00"), "P3", SIN_FERIADOS))).toBe(iso(ba("2026-10-16", "12:00")));
    });
    it("con feriado en el medio → lunes 19/10 12:00", () => {
      expect(iso(calcularVenceSLA(ba("2026-10-06", "12:00"), "P3", CON_FERIADO_12))).toBe(iso(ba("2026-10-19", "12:00")));
    });
  });

  it("P4 no vence", () => {
    expect(calcularVenceSLA(ba("2026-10-06", "12:00"), "P4", SIN_FERIADOS)).toBeNull();
  });

  it("cambiar la prioridad cambia el vencimiento (se recalcula desde el alta)", () => {
    const alta = ba("2026-10-06", "12:00");
    const p3 = calcularVenceSLA(alta, "P3", SIN_FERIADOS)!;
    const p1 = calcularVenceSLA(alta, "P1", SIN_FERIADOS)!;
    expect(p1.getTime()).toBeLessThan(p3.getTime());
  });

  it("sumar horas hábiles que terminan justo a las 18 no pasa al día siguiente", () => {
    expect(iso(sumarHorasHabiles(ba("2026-10-06", "09:00"), 9, SIN_FERIADOS))).toBe(iso(ba("2026-10-06", "18:00")));
  });

  describe("minutos hábiles entre dos instantes", () => {
    it("mismo día", () => {
      expect(minutosHabilesEntre(ba("2026-10-06", "10:00"), ba("2026-10-06", "12:30"), SIN_FERIADOS)).toBe(150);
    });
    it("cruza fin de semana", () => {
      // Viernes 17 → lunes 10 = 1 h + 1 h.
      expect(minutosHabilesEntre(ba("2026-10-09", "17:00"), ba("2026-10-12", "10:00"), SIN_FERIADOS)).toBe(120);
    });
    it("fuera de horario cuenta 0", () => {
      expect(minutosHabilesEntre(ba("2026-10-10", "10:00"), ba("2026-10-11", "20:00"), SIN_FERIADOS)).toBe(0);
    });
    it("hasta antes que desde → 0", () => {
      expect(minutosHabilesEntre(ba("2026-10-06", "12:00"), ba("2026-10-06", "10:00"), SIN_FERIADOS)).toBe(0);
    });
  });

  describe("semáforo", () => {
    const inicio = ba("2026-10-06", "09:00");
    const vence = ba("2026-10-06", "18:00");
    it.each([
      ["recién creado", ba("2026-10-06", "09:30"), "verde"],
      ["más de la mitad restante", ba("2026-10-06", "13:00"), "verde"],
      ["justo la mitad", ba("2026-10-06", "13:30"), "amarillo"],
      ["menos de la mitad", ba("2026-10-06", "16:00"), "amarillo"],
      ["vencido", ba("2026-10-06", "18:00"), "rojo"],
      ["muy vencido", ba("2026-10-08", "10:00"), "rojo"],
    ])("%s → %s", (_n, ahora, esperado) => {
      expect(semaforoSLA(inicio, vence, ahora, SIN_FERIADOS)).toBe(esperado);
    });

    it("el fin de semana no consume SLA", () => {
      // Alta viernes 17, P2 vence miércoles 14. El domingo sigue quedando 23 de 24 h → verde.
      const alta = ba("2026-10-09", "17:00");
      const v = calcularVenceSLA(alta, "P2", SIN_FERIADOS)!;
      expect(semaforoSLA(alta, v, ba("2026-10-11", "12:00"), SIN_FERIADOS)).toBe("verde");
    });
  });
});
