import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSesion } from "@/app/sesion";
import { rutaInternaSegura } from "@/infra/rutas";

/** Corre `accion` una sola vez (StrictMode monta dos veces en desarrollo). */
function useUnaVez(accion: () => Promise<void>) {
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    void accion();
  });
}

/** `/auth/login?volver=`: arranca el login (en Supabase redirige a Microsoft). */
export function LoginPage() {
  const { backend, recargar } = useSesion();
  const navigate = useNavigate();
  const volver = rutaInternaSegura(useSearchParams()[0].get("volver"));

  useUnaVez(async () => {
    const lista = await backend.iniciarSesion(volver);
    if (!lista) return;
    await recargar();
    navigate(await backend.completarLogin(), { replace: true });
  });
  return null;
}

/** `/auth/callback`: vuelta de Microsoft (redirect URI configurado en Supabase Auth). */
export function CallbackPage() {
  const { backend, recargar } = useSesion();
  const navigate = useNavigate();

  useUnaVez(async () => {
    const volver = await backend.completarLogin();
    await recargar();
    navigate(volver, { replace: true });
  });
  return null;
}

/** `/auth/logout`: cierra la sesión y vuelve a bienvenida. */
export function LogoutPage() {
  const { backend, recargar } = useSesion();
  const navigate = useNavigate();

  useUnaVez(async () => {
    await backend.cerrarSesion();
    await recargar();
    navigate("/bienvenida", { replace: true });
  });
  return null;
}
