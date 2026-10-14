import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useOutletContext } from "react-router";
import { useSesion } from "@/app/sesion";
import { AppShell } from "@/components/layout/app-shell";
import type { ContextoAutorizado } from "@/servicios/tickets";

/**
 * Pantallas con sesión: manda a login, a "no habilitado" o al selector de cliente
 * según corresponda (era `requerirContexto()` + el layout de `(portal)` en Next).
 */
export function PortalLayout() {
  const { backend, usuario, acceso } = useSesion();
  const { pathname, search } = useLocation();
  const volver = pathname + search;

  const ctx = useMemo<ContextoAutorizado | null>(
    () => (usuario && (acceso?.tipo === "bhi" || acceso?.tipo === "cliente") ? { identidad: usuario, acceso } : null),
    [usuario, acceso],
  );

  if (!usuario) return <Navigate to={`/bienvenida?volver=${encodeURIComponent(volver)}`} replace />;
  if (!acceso || acceso.tipo === "denegado") return <Navigate to={`/no-habilitado?motivo=${acceso?.code ?? "sin_permiso"}`} replace />;
  if (acceso.tipo === "elegir_cliente") return <Navigate to="/elegir-cliente" replace />;
  if (!ctx) return null;

  return (
    <AppShell identidad={ctx.identidad} acceso={ctx.acceso} demo={backend.demo ? { volver } : null}>
      <Outlet context={ctx} />
    </AppShell>
  );
}

/** Contexto autorizado para las páginas dentro del portal. */
export function useContextoPortal(): ContextoAutorizado {
  return useOutletContext<ContextoAutorizado>();
}
