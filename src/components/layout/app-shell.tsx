import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DemoSwitcher } from "@/components/demo/demo-switcher";
import { Button } from "@/components/ui/button";
import type { Acceso, Identidad } from "@/servicios/acceso";
import { Footer } from "./footer";
import { LogoLong, LogoShort } from "./logo";

const ETIQUETA_ROL = {
  usuario: "Usuario",
  lider: "Líder de área",
  referente: "Referente",
  soporte: "Soporte BHI",
  admin: "Admin BHI",
} as const;

interface Props {
  identidad: Identidad;
  acceso: Extract<Acceso, { tipo: "bhi" } | { tipo: "cliente" }>;
  demo: { volver: string } | null;
  children: ReactNode;
}

export function AppShell({ identidad, acceso, demo, children }: Props) {
  const organizacion = acceso.tipo === "cliente" ? acceso.cliente.nombre : "BHI Consultora";
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <header className="bg-main text-on-main">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3 rounded-lg">
            <LogoShort className="sm:hidden" />
            <LogoLong className="hidden sm:inline-flex" />
            <span className="border-l border-on-main/30 pl-3 font-display text-lg">Soporte BI</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold">{identidad.nombre}</p>
              <p className="text-xs opacity-80">
                {organizacion} · {ETIQUETA_ROL[acceso.rol]}
              </p>
            </div>
            <Button asChild variant="onMain" size="sm">
              <a href="/api/auth/logout">
                <LogOut aria-hidden />
                <span className="hidden sm:inline">Cerrar sesión</span>
                <span className="sr-only sm:hidden">Cerrar sesión</span>
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <Footer />
      {demo && <DemoSwitcher oidActual={identidad.oid} volver={demo.volver} />}
    </div>
  );
}
