import type { RolBhi, RolCliente } from "@/dominio/catalogos";
import type { Area, Cliente, Tablero } from "@/dominio/entidades";

/** Usuario con sesión, tal como lo muestra la UI. */
export interface Identidad {
  /** Identificador estable (en Supabase, `auth.users.id`). */
  oid: string;
  email: string;
  nombre: string;
}

/** Identidad + tenant de Entra del login. Solo la usa `resolverAcceso` (modo demo y tests). */
export interface IdentidadEntra extends Identidad {
  tid: string;
}

export type Acceso =
  | { tipo: "bhi"; rol: RolBhi }
  | {
      tipo: "cliente";
      rol: RolCliente;
      cliente: Cliente;
      /** Áreas activas que lidera, con sus tableros (vacío si no es líder). */
      areasLideradas: AreaLiderada[];
      /** Unión de los tableros de esas áreas (un tablero puede estar en varias). */
      tablerosDeAreas: string[];
    }
  | { tipo: "elegir_cliente"; clientes: Cliente[] }
  | { tipo: "denegado"; code: "tenant_no_habilitado" | "sin_permiso" };

export type AreaLiderada = Area & { tableroIds: string[] };

/** Lo que necesita `resolverAcceso`. En Supabase la misma regla vive en la función SQL `acceso_actual()`. */
export interface FuenteAcceso {
  clientes: {
    buscarPorTenant(tenantId: string): Promise<Cliente | null>;
    /** Clientes satélite en los que figura ese email (cuentas del tenant de BHI). */
    listarSatelitesDe(email: string): Promise<Cliente[]>;
  };
  personalBhi: {
    /** Rol del personal activo de BHI con ese email, o `null`. */
    rolDe(email: string): Promise<RolBhi | null>;
  };
  areas: { listarPorCliente(clienteId: number): Promise<Area[]> };
  tableros: { listarPorCliente(clienteId: number): Promise<Tablero[]> };
}

export interface OpcionesAcceso {
  bhiTenantId: string;
  /** Cliente elegido en la sesión (solo relevante para satélites en varios clientes). */
  clienteElegidoId?: number | null;
}

const lower = (s: string) => s.trim().toLowerCase();

/**
 * Resuelve rol y alcance según §4.3 del contexto. Es la especificación ejecutable de
 * `acceso_actual()` (SQL): los tests comparan ambas sobre los mismos datos.
 */
export async function resolverAcceso(
  identidad: IdentidadEntra,
  fuente: FuenteAcceso,
  { bhiTenantId, clienteElegidoId = null }: OpcionesAcceso,
): Promise<Acceso> {
  let cliente: Cliente | null;

  if (lower(identidad.tid) === lower(bhiTenantId)) {
    const rolBhi = await fuente.personalBhi.rolDe(lower(identidad.email));
    if (rolBhi) return { tipo: "bhi", rol: rolBhi };

    const satelites = (await fuente.clientes.listarSatelitesDe(lower(identidad.email))).filter((c) => c.activo);
    if (satelites.length === 0) return { tipo: "denegado", code: "sin_permiso" };
    if (satelites.length === 1) {
      cliente = satelites[0]!;
    } else {
      // Varios satélites: la elección guardada se revalida contra las membresías actuales.
      cliente = satelites.find((c) => c.id === clienteElegidoId) ?? null;
      if (!cliente) return { tipo: "elegir_cliente", clientes: satelites };
    }
  } else {
    cliente = await fuente.clientes.buscarPorTenant(identidad.tid);
    if (!cliente?.activo) return { tipo: "denegado", code: "tenant_no_habilitado" };
  }

  const yo = lower(identidad.email);
  const [areas, tableros] = await Promise.all([
    fuente.areas.listarPorCliente(cliente.id),
    fuente.tableros.listarPorCliente(cliente.id),
  ]);
  const lideradas = areas.filter((a) => a.activo && a.lideres.some((l) => lower(l) === yo)).map((a) => a.id);
  const esReferente = cliente.referentesGenerales.some((r) => lower(r) === yo);
  const rol: RolCliente = esReferente ? "referente" : lideradas.length > 0 ? "lider" : "usuario";

  return armarAccesoCliente(rol, cliente, areas, tableros, lideradas);
}

/** Arma el acceso de un rol de cliente a partir de las áreas que lidera. Lo usan la demo y Supabase. */
export function armarAccesoCliente(
  rol: RolCliente,
  cliente: Cliente,
  areas: Area[],
  tableros: Tablero[],
  areaIdsLideradas: readonly number[],
): Extract<Acceso, { tipo: "cliente" }> {
  const areasLideradas: AreaLiderada[] = areas
    .filter((a) => areaIdsLideradas.includes(a.id))
    .map((a) => ({ ...a, tableroIds: tableros.filter((t) => t.areaIds.includes(a.id)).map((t) => t.tableroId) }));
  const tablerosDeAreas = [...new Set(areasLideradas.flatMap((a) => a.tableroIds))];
  return { tipo: "cliente", rol, cliente, areasLideradas, tablerosDeAreas };
}
