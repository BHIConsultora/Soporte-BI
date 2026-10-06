/**
 * Traduce un error de Entra ID (en la vuelta del login o al canjear el código) a qué pantalla mostrar.
 * Los códigos AADSTS vienen en `error_description` o en el mensaje de MSAL.
 */
export type DestinoError = "consentimiento" | "no_asignado" | "cancelado" | "reintentar";

const CONSENTIMIENTO = [
  "AADSTS65001", // el usuario o el admin no dio consentimiento
  "AADSTS65004", // el usuario rechazó el consentimiento
  "AADSTS90094", // hace falta consentimiento de administrador
  "AADSTS90008", // el admin de la organización tiene que autorizar la app
  "AADSTS650052", // la organización no tiene la app/servicio habilitado
  "AADSTS700016", // la app no existe en el tenant del usuario (sin consentimiento previo)
];

export function destinoPorError(error: string | null | undefined, descripcion: string | null | undefined): DestinoError {
  const texto = `${error ?? ""} ${descripcion ?? ""}`;
  if (error === "consent_required" || CONSENTIMIENTO.some((c) => texto.includes(c))) return "consentimiento";
  // Usuario no asignado a la app (50105) o cuenta personal / de otro proveedor (50020).
  if (texto.includes("AADSTS50105") || texto.includes("AADSTS50020")) return "no_asignado";
  // El usuario cerró o canceló la pantalla de Microsoft.
  if (error === "access_denied" || error === "user_cancelled") return "cancelado";
  return "reintentar";
}

/** URL interna a la que se redirige según el destino. */
export function urlPorDestino(destino: DestinoError): string {
  switch (destino) {
    case "consentimiento":
      return "/consentimiento";
    case "no_asignado":
      return "/no-habilitado?motivo=sin_permiso";
    case "cancelado":
      return "/bienvenida?error=cancelado";
    case "reintentar":
      return "/bienvenida?error=login";
  }
}
