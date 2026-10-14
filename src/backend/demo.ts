import { crearDemoRepo } from "@/repositorio/demo";
import { DEMO_BHI_TENANT_ID, PERSONAS_DEMO, crearDatosDemo } from "@/repositorio/demo/datos";
import { resolverAcceso } from "@/servicios/acceso";
import type { Backend } from "./tipos";
import { guardarVolver, tomarVolver } from "./volver";

const CLAVE_PERSONA = "sbi_demo_persona";
const CLAVE_CLIENTE = "sbi_demo_cliente";

function leer(clave: string): string | null {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string | null): void {
  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch {
    // Sin storage la demo funciona igual, solo que no recuerda la persona al recargar.
  }
}

/**
 * Backend en memoria: datos ficticios y una "sesión" (persona demo) en sessionStorage.
 * Corre `resolverAcceso`, la misma regla que la función SQL `acceso_actual()`.
 */
export function crearBackendDemo(): Backend {
  const repo = crearDemoRepo(crearDatosDemo());
  const personaActual = () => PERSONAS_DEMO.find((p) => p.clave === leer(CLAVE_PERSONA)) ?? null;

  const accesoDe = async (clienteElegidoId: number | null) => {
    const p = personaActual();
    if (!p) throw new Error("Sin sesión demo.");
    return resolverAcceso(p, repo, { bhiTenantId: DEMO_BHI_TENANT_ID, clienteElegidoId });
  };

  return {
    repo,
    usuario: async () => {
      const p = personaActual();
      return p ? { oid: p.oid, email: p.email, nombre: p.nombre } : null;
    },
    acceso: () => accesoDe(Number(leer(CLAVE_CLIENTE)) || null),
    iniciarSesion: async (volver) => {
      guardarVolver(volver);
      escribir(CLAVE_PERSONA, "usuario");
      escribir(CLAVE_CLIENTE, null);
      return true;
    },
    completarLogin: async () => tomarVolver(),
    cerrarSesion: async () => {
      escribir(CLAVE_PERSONA, null);
      escribir(CLAVE_CLIENTE, null);
    },
    elegirCliente: async (clienteId) => {
      // Se valida contra las membresías: la elección no puede abrir un cliente ajeno.
      const acceso = await accesoDe(clienteId);
      if (acceso.tipo !== "cliente" || acceso.cliente.id !== clienteId) return false;
      escribir(CLAVE_CLIENTE, String(clienteId));
      return true;
    },
    registrarSolicitudAcceso: async () => {},
    alCambiarSesion: () => () => {},
    demo: {
      personas: PERSONAS_DEMO.map(({ clave, nombre, descripcion }) => ({ clave, nombre, descripcion })),
      personaActual: () => personaActual()?.clave ?? null,
      cambiarPersona: async (clave) => {
        if (!PERSONAS_DEMO.some((p) => p.clave === clave)) return false;
        escribir(CLAVE_PERSONA, clave);
        escribir(CLAVE_CLIENTE, null);
        return true;
      },
    },
  };
}
