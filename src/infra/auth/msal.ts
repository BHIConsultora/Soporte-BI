import "server-only";
import { ConfidentialClientApplication, LogLevel, type Configuration } from "@azure/msal-node";
import { log } from "../logger";
import { AUTORIDAD, type ConfigAuth } from "./config";
import { clientAssertion } from "./credencial";

/**
 * Cliente MSAL de la app "Soporte BI – Portal" (multi-tenant, autoridad `organizations`).
 * Se crea uno por login: su caché de tokens en memoria nunca mezcla usuarios y se descarta.
 * No guardamos tokens de Microsoft: del login solo se usa el ID token para armar la sesión.
 */
export function clientePortal(cfg: ConfigAuth): ConfidentialClientApplication {
  const configuracion: Configuration = {
    auth: {
      clientId: cfg.clientId,
      authority: AUTORIDAD,
      clientAssertion: () => clientAssertion(),
    },
    system: {
      loggerOptions: {
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning,
        loggerCallback: (nivel, mensaje, conPii) => {
          if (conPii) return;
          if (nivel <= LogLevel.Warning) log(nivel === LogLevel.Error ? "error" : "warn", "msal", { detalle: mensaje.slice(0, 300) });
        },
      },
    },
  };
  return new ConfidentialClientApplication(configuracion);
}
