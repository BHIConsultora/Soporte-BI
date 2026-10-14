import type { Repositorio } from "@/repositorio/tipos";
import type { Acceso, Identidad } from "@/servicios/acceso";

export interface PersonaDemo {
  clave: string;
  nombre: string;
  descripcion: string;
}

/**
 * Lo que la UI necesita del backend. Reemplaza a los route handlers de la versión Next.js.
 * Implementaciones: `supabase.ts` (Lovable Cloud) y `demo.ts` (en memoria, `VITE_DEMO_MODE=true`).
 */
export interface Backend {
  repo: Repositorio;
  /** Usuario con sesión, o `null`. */
  usuario(): Promise<Identidad | null>;
  /** Acceso recalculado en el backend (en Supabase, la función SQL `acceso_actual()`). */
  acceso(): Promise<Acceso>;
  /** Arranca el login. `true` si la sesión ya quedó lista (demo); `false` si se fue a Microsoft. */
  iniciarSesion(volver: string): Promise<boolean>;
  /** Termina el login al volver de Microsoft. Devuelve la ruta interna a la que volver. */
  completarLogin(): Promise<string>;
  cerrarSesion(): Promise<void>;
  /** Guarda el cliente elegido (satélite en varios clientes). `false` si no pertenece a ese cliente. */
  elegirCliente(clienteId: number): Promise<boolean>;
  /** Deja registrado el pedido de acceso cuando el tenant no está habilitado. */
  registrarSolicitudAcceso(): Promise<void>;
  /** Avisa cuando la sesión cambia (login, logout u otra pestaña). Devuelve la desuscripción. */
  alCambiarSesion(cb: () => void): () => void;
  /** Solo en modo demo: selector de persona. */
  demo: null | {
    personas: PersonaDemo[];
    personaActual(): string | null;
    cambiarPersona(clave: string): Promise<boolean>;
  };
}
