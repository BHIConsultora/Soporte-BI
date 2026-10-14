import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getBackend, type Backend } from "@/backend";
import type { Acceso, Identidad } from "@/servicios/acceso";

interface Sesion {
  backend: Backend;
  usuario: Identidad | null;
  /** `null` solo si no hay usuario. */
  acceso: Acceso | null;
  /** Vuelve a leer usuario y acceso (después de login, logout o elegir cliente). */
  recargar(): Promise<void>;
}

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error"; error: unknown }
  | { tipo: "listo"; backend: Backend; usuario: Identidad | null; acceso: Acceso | null };

const Contexto = createContext<Sesion | null>(null);

async function leer(backend: Backend): Promise<Estado> {
  const usuario = await backend.usuario();
  const acceso = usuario ? await backend.acceso() : null;
  return { tipo: "listo", backend, usuario, acceso };
}

/**
 * Sesión y acceso resueltos por el backend. Equivale a lo que hacía `requerirContexto()` en el
 * servidor: hasta tenerlo no se muestra nada, así ninguna pantalla aparece con datos a medias.
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  const actualizar = useCallback(async (backend: Backend) => {
    try {
      setEstado(await leer(backend));
    } catch (error) {
      setEstado({ tipo: "error", error });
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    let desuscribir = () => {};
    getBackend().then(
      async (backend) => {
        if (!vivo) return;
        desuscribir = backend.alCambiarSesion(() => void actualizar(backend));
        await actualizar(backend);
      },
      (error: unknown) => vivo && setEstado({ tipo: "error", error }),
    );
    return () => {
      vivo = false;
      desuscribir();
    };
  }, [actualizar]);

  if (estado.tipo === "error") throw estado.error;
  if (estado.tipo === "cargando") return null;

  const { backend, usuario, acceso } = estado;
  return (
    <Contexto.Provider value={{ backend, usuario, acceso, recargar: () => actualizar(backend) }}>{children}</Contexto.Provider>
  );
}

export function useSesion(): Sesion {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error("useSesion fuera de <SesionProvider>.");
  return sesion;
}

/** Título de la pestaña con el mismo formato que tenía la versión Next (`%s · Soporte BI`). */
export function useTitulo(titulo?: string): void {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Soporte BI` : "Soporte BI · BHI Consultora";
  }, [titulo]);
}
