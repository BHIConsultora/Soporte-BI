import type { ReactNode } from "react";
import { Footer } from "./footer";
import { LogoLong } from "./logo";

/** Marco para pantallas sin sesión (bienvenida, errores, no habilitado). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-main text-on-main">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <LogoLong />
          <span className="border-l border-on-main/30 pl-3 font-display text-lg">Soporte BI</span>
        </div>
      </header>
      <main id="contenido" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
