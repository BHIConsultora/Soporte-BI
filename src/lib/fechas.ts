import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/** `2026-10-06T12:00:00Z` → `6 oct 2026, 09:00` (hora de Buenos Aires). */
export function formatearFecha(iso: string): string {
  return format(new TZDate(iso, ZONA_HORARIA), "d MMM yyyy, HH:mm", { locale: es });
}
