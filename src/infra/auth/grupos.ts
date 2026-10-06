import "server-only";
import { getEnv } from "../env";
import { graph, type OpcionesGraph } from "../graph/cliente";
import { log } from "../logger";

/**
 * Overage de grupos: si el usuario pertenece a demasiados grupos, el ID token no trae la lista
 * (`_claim_names.groups`). Con el claim limitado a "grupos asignados a la aplicación" es casi
 * imposible, pero si pasa se consulta Graph `checkMemberGroups` SOLO por los grupos satélite
 * configurados en "Clientes BI" (nada más del directorio).
 *
 * Requiere el permiso de aplicación `GroupMember.Read.All` en la app "Soporte BI – Datos".
 * Si no está configurado, se registra un aviso y se sigue sin grupos (el usuario verá "no habilitado").
 */
export async function gruposPorOverage(oid: string, gruposConfigurados: readonly string[], opciones?: OpcionesGraph): Promise<string[]> {
  if (gruposConfigurados.length === 0) return [];
  if (!getEnv().DATA_CLIENT_ID) {
    log("warn", "overage de grupos sin app de datos configurada");
    return [];
  }
  const encontrados: string[] = [];
  try {
    // checkMemberGroups acepta hasta 20 grupos por llamada.
    for (let i = 0; i < gruposConfigurados.length; i += 20) {
      const groupIds = gruposConfigurados.slice(i, i + 20);
      const r = await graph<{ value: string[] }>(
        `/users/${encodeURIComponent(oid)}/checkMemberGroups`,
        { method: "POST", body: JSON.stringify({ groupIds }) },
        opciones,
      );
      encontrados.push(...r.value.map((g) => g.toLowerCase()));
    }
  } catch (err) {
    log("warn", "no se pudieron resolver los grupos por overage", { error: err instanceof Error ? err.message : "desconocido" });
    return [];
  }
  return encontrados;
}
