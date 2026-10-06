"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <div className="card space-y-4 p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-main">Algo salió mal</h1>
        <p className="text-muted-foreground">Fue un problema nuestro. Probá de nuevo en unos segundos.</p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </main>
  );
}
