type Nivel = "debug" | "info" | "warn" | "error";

/**
 * Logs estructurados en una línea JSON. Regla: nunca tokens, contenido de tickets
 * ni emails completos (usar `enmascararEmail`). Siempre con `requestId` cuando lo hay.
 */
export function log(nivel: Nivel, mensaje: string, datos: Record<string, string | number | boolean | null> = {}): void {
  const linea = JSON.stringify({ nivel, mensaje, ts: new Date().toISOString(), ...datos });
  if (nivel === "error") console.error(linea);
  else if (nivel === "warn") console.warn(linea);
  else console.log(linea);
}

/** `ulises.usuario@andina.example.com` → `u***@andina.example.com`. */
export function enmascararEmail(email: string): string {
  const [local = "", dominio = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${dominio}`;
}
