import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import { useSession } from "@/lib/session";
import { isMockMode } from "@/lib/auth";
import { LogoLong, LogoShort } from "./Logo";
import { RoleSwitcher } from "./RoleSwitcher";

export function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Cargando">
      <Loader2 className="h-8 w-8 animate-spin text-main" />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <p>BHI Consultora Regional · Soporte de Tableros BI</p>
      <a className="text-main hover:underline" href="mailto:mejoracontinua@bhiconsultora.com.ar">
        mejoracontinua@bhiconsultora.com.ar
      </a>
    </footer>
  );
}

/** Envuelve las pantallas que requieren sesión. */
export function Protected({ children }: { children: ReactNode }) {
  const { status, me, logout } = useSession();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const hrefRef = useRef(href);
  hrefRef.current = href;
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === status) return;
    if (status === "anon" && !hrefRef.current.startsWith("/bienvenida")) {
      sent.current = status;
      navigate({ to: "/bienvenida", search: { redirect: hrefRef.current }, replace: true });
    }
    if (status === "forbidden") {
      sent.current = status;
      navigate({ to: "/no-habilitado", replace: true });
    }
    if (status === "authed") sent.current = null;
  }, [status, navigate]);

  if (status !== "authed" || !me) return <FullLoader />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-main text-on-main">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 rounded-lg">
            <LogoShort className="sm:hidden" />
            <LogoLong className="hidden sm:inline-flex" />
            <span className="border-l border-on-main/30 pl-3 font-display text-lg">Soporte BI</span>
          </Link>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold">{me.nombre}</p>
              <p className="text-xs opacity-75">{me.cliente}</p>
            </div>
            <button
              onClick={logout}
              className="btn rounded-full border border-on-main/30 px-3 py-1.5 text-xs text-on-main hover:bg-main-hover"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sr-only sm:hidden">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Footer />
      {isMockMode && <RoleSwitcher />}
    </div>
  );
}
