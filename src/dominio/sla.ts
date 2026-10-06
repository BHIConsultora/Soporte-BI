import { TZDate } from "@date-fns/tz";
import type { Prioridad } from "./catalogos";

/**
 * SLA en horario hábil: lunes a viernes de 9 a 18 h en Buenos Aires, sin feriados.
 * - P1: fin del mismo día hábil (si entra fuera de horario, fin del siguiente día hábil).
 * - P2: 24 horas hábiles. P3: 72 horas hábiles. P4: sin vencimiento (próxima planificación).
 * Funciones puras: reciben `feriados` como fechas `yyyy-MM-dd` (hora de Buenos Aires).
 */

export const ZONA_SLA = "America/Argentina/Buenos_Aires";
const HORA_INICIO = 9;
const HORA_FIN = 18;
const MINUTOS_POR_DIA = (HORA_FIN - HORA_INICIO) * 60;

export const HORAS_HABILES: Record<Exclude<Prioridad, "P1" | "P4">, number> = { P2: 24, P3: 72 };

export type Semaforo = "verde" | "amarillo" | "rojo";

const pad = (n: number) => String(n).padStart(2, "0");

function claveDia(d: TZDate): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function esDiaHabil(d: TZDate, feriados: ReadonlySet<string>): boolean {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6 && !feriados.has(claveDia(d));
}

/** Mismo día a la hora indicada (en Buenos Aires). */
function aLas(d: TZDate, hora: number): TZDate {
  return new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0, ZONA_SLA);
}

function siguienteDiaHabil(d: TZDate, feriados: ReadonlySet<string>): TZDate {
  let x = new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + 1, HORA_INICIO, 0, 0, 0, ZONA_SLA);
  while (!esDiaHabil(x, feriados)) {
    x = new TZDate(x.getFullYear(), x.getMonth(), x.getDate() + 1, HORA_INICIO, 0, 0, 0, ZONA_SLA);
  }
  return x;
}

/** Lleva un instante al próximo momento hábil (o lo deja igual si ya lo es). */
function normalizar(fecha: Date, feriados: ReadonlySet<string>): TZDate {
  const d = new TZDate(fecha.getTime(), ZONA_SLA);
  if (!esDiaHabil(d, feriados) || d.getTime() >= aLas(d, HORA_FIN).getTime()) return siguienteDiaHabil(d, feriados);
  if (d.getTime() < aLas(d, HORA_INICIO).getTime()) return aLas(d, HORA_INICIO);
  return d;
}

export function sumarHorasHabiles(inicio: Date, horas: number, feriados: ReadonlySet<string>): Date {
  let restante = Math.round(horas * 60);
  let t = normalizar(inicio, feriados);
  for (;;) {
    const fin = aLas(t, HORA_FIN);
    const disponible = (fin.getTime() - t.getTime()) / 60_000;
    if (restante <= disponible) return new Date(t.getTime() + restante * 60_000);
    restante -= disponible;
    t = siguienteDiaHabil(t, feriados);
  }
}

/** Minutos hábiles entre `desde` y `hasta` (0 si `hasta <= desde`). */
export function minutosHabilesEntre(desde: Date, hasta: Date, feriados: ReadonlySet<string>): number {
  if (hasta.getTime() <= desde.getTime()) return 0;
  let t = normalizar(desde, feriados);
  let total = 0;
  while (t.getTime() < hasta.getTime()) {
    const fin = aLas(t, HORA_FIN);
    if (hasta.getTime() <= fin.getTime()) return total + (hasta.getTime() - t.getTime()) / 60_000;
    total += (fin.getTime() - t.getTime()) / 60_000;
    t = siguienteDiaHabil(t, feriados);
  }
  return total;
}

export function calcularVenceSLA(inicio: Date, prioridad: Prioridad, feriados: ReadonlySet<string>): Date | null {
  switch (prioridad) {
    case "P1": {
      // Date plano (no TZDate): su toISOString tiene que salir en UTC.
      return new Date(aLas(normalizar(inicio, feriados), HORA_FIN).getTime());
    }
    case "P2":
    case "P3":
      return sumarHorasHabiles(inicio, HORAS_HABILES[prioridad], feriados);
    case "P4":
      return null;
  }
}

/** Verde > 50 % del tiempo hábil restante, amarillo ≤ 50 %, rojo vencido. */
export function semaforoSLA(inicio: Date, vence: Date, ahora: Date, feriados: ReadonlySet<string>): Semaforo {
  if (ahora.getTime() >= vence.getTime()) return "rojo";
  const total = minutosHabilesEntre(inicio, vence, feriados);
  if (total <= 0) return "rojo";
  const restante = minutosHabilesEntre(ahora, vence, feriados);
  return restante / total > 0.5 ? "verde" : "amarillo";
}

export const MINUTOS_HABILES_POR_DIA = MINUTOS_POR_DIA;
