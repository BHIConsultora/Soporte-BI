import type { RolBhi, RolCliente } from "@/dominio/catalogos";
import type { Area, Cliente } from "@/dominio/entidades";
import type { Repositorio } from "@/repositorio/tipos";

/** Identidad tal como sale del ID token validado (nunca del body/query/headers del cliente). */
export interface Identidad {
  oid: string;
  tid: string;
  email: string;
  nombre: string;
  /** Claim `roles` (app roles de la app Portal). Solo se tienen en cuenta en el tenant de BHI. */
  appRoles: readonly string[];
  /** Claim `groups` (solo grupos asignados a la app). */
  grupos: readonly string[];
  /** `acct == 1` o `userType == Guest`. */
  esInvitado: boolean;
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

export type AccesoCliente = Extract<Acceso, { tipo: "cliente" }>;
export type AccesoBhi = Extract<Acceso, { tipo: "bhi" }>;

/** Contexto ya autenticado y con acceso resuelto (nunca `denegado` ni `elegir_cliente`). */
export interface ContextoAutorizado {
  identidad: Identidad;
  acceso: AccesoBhi | AccesoCliente;
}

export interface OpcionesAcceso {
  /** Tenant(s) de BHI. En el preview conviven el ficticio de la demo y el real. */
  bhiTenantIds: readonly string[];
  /** Cliente elegido en la sesión (solo relevante para satélites en varios grupos). */
  clienteElegidoId?: number | null;
}

const lower = (s: string) => s.trim().toLowerCase();

/**
 * Resuelve rol y alcance según §4.3 del contexto. Se llama en cada request
 * (con caché corta) para que las bajas en SharePoint impacten rápido.
 */
export async function resolverAcceso(
  identidad: Identidad,
  repo: Repositorio,
  { bhiTenantIds, clienteElegidoId = null }: OpcionesAcceso,
): Promise<Acceso> {
  let cliente: Cliente | null;

  if (bhiTenantIds.some((t) => lower(t) === lower(identidad.tid))) {
    if (identidad.esInvitado) return { tipo: "denegado", code: "sin_permiso" };
    if (identidad.appRoles.includes("Admin")) return { tipo: "bhi", rol: "admin" };
    if (identidad.appRoles.includes("Soporte")) return { tipo: "bhi", rol: "soporte" };

    const satelites = (await repo.clientes.buscarPorGrupos(identidad.grupos)).filter((c) => c.activo);
    if (satelites.length === 0) return { tipo: "denegado", code: "sin_permiso" };
    if (satelites.length === 1) {
      cliente = satelites[0]!;
    } else {
      // Varios satélites: la elección guardada en la sesión se revalida contra los grupos actuales.
      cliente = satelites.find((c) => c.id === clienteElegidoId) ?? null;
      if (!cliente) return { tipo: "elegir_cliente", clientes: satelites };
    }
  } else {
    cliente = await repo.clientes.buscarPorTenant(identidad.tid);
    if (!cliente?.activo) return { tipo: "denegado", code: "tenant_no_habilitado" };
  }

  return rolDeCliente(identidad.email, cliente, repo);
}

async function rolDeCliente(email: string, cliente: Cliente, repo: Repositorio): Promise<Acceso> {
  const yo = lower(email);
  const areas = await repo.areas.listarPorCliente(cliente.id);
  const tableros = await repo.tableros.listarPorCliente(cliente.id);
  const areasLideradas: AreaLiderada[] = areas
    .filter((a) => a.activo && a.lideres.some((l) => lower(l) === yo))
    .map((a) => ({ ...a, tableroIds: tableros.filter((t) => t.areaIds.includes(a.id)).map((t) => t.tableroId) }));
  const tablerosDeAreas = [...new Set(areasLideradas.flatMap((a) => a.tableroIds))];

  const esReferente = cliente.referentesGenerales.some((r) => lower(r) === yo);
  const rol: RolCliente = esReferente ? "referente" : areasLideradas.length > 0 ? "lider" : "usuario";

  return { tipo: "cliente", rol, cliente, areasLideradas, tablerosDeAreas };
}

/**
 * Si el tenant no está habilitado, deja una solicitud de acceso pendiente (una por email y tenant).
 * Se llama al iniciar sesión, no en cada request.
 */
export async function registrarSolicitudSiCorresponde(
  identidad: Identidad,
  acceso: Acceso,
  repo: Repositorio,
  ahora: Date = new Date(),
): Promise<void> {
  if (acceso.tipo !== "denegado" || acceso.code !== "tenant_no_habilitado") return;
  const email = lower(identidad.email);
  const existentes = await repo.solicitudes.listar();
  const yaPendiente = existentes.some(
    (s) => s.estado === "pendiente" && lower(s.email) === email && lower(s.tenantId) === lower(identidad.tid),
  );
  if (yaPendiente) return;
  await repo.solicitudes.crear({
    tenantId: identidad.tid,
    dominio: email.split("@")[1] ?? null,
    email,
    nombre: identidad.nombre,
    fecha: ahora.toISOString(),
    estado: "pendiente",
  });
}
