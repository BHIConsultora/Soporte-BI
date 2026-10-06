/** El ID visible se deriva del ID de SharePoint; no se guarda. */
export function formatTicketId(itemId: number): string {
  return `TCK-${String(itemId).padStart(4, "0")}`;
}

const TICKET_ID_RE = /^TCK-(\d{1,9})$/i;

/** Acepta `TCK-0042` o `42`. Devuelve `null` si no es un ID válido. */
export function parseTicketId(value: string): number | null {
  const trimmed = value.trim();
  const match = TICKET_ID_RE.exec(trimmed) ?? /^(\d{1,9})$/.exec(trimmed);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
