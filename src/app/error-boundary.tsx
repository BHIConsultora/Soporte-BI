import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { log } from "@/infra/logger";

/** Pantalla "Algo salió mal" (era `app/error.tsx` en Next). Nunca muestra detalles internos. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  override state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  override componentDidCatch(err: unknown) {
    log("error", "error no manejado", { nombre: err instanceof Error ? err.name : "desconocido" });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main id="contenido" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
        <div className="card space-y-4 p-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-main">Algo salió mal</h1>
          <p className="text-muted-foreground">Fue un problema nuestro. Probá de nuevo en unos segundos.</p>
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </div>
      </main>
    );
  }
}
