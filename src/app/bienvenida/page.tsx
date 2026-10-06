import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rutaInternaSegura } from "@/infra/csrf";
import { isDemoMode } from "@/infra/env";
import { leerSesion } from "@/infra/sesion";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function BienvenidaPage({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const volver = rutaInternaSegura((await searchParams).volver);
  if (await leerSesion()) redirect(volver);

  return (
    <PublicShell>
      <Card className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-main">Soporte de tableros BI</h1>
          <p className="text-muted-foreground">
            Contanos qué pasa con tu tablero de Power BI y seguí la respuesta del equipo de BHI.
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <a href={`/api/auth/login?volver=${encodeURIComponent(volver)}`}>Iniciar sesión con Microsoft</a>
        </Button>
        <p className="text-sm text-muted-foreground">Usá tu cuenta de trabajo. No hace falta crear un usuario.</p>
        {isDemoMode() && (
          <p className="rounded-xl bg-internal px-3 py-2 text-sm">
            <strong>Modo demo:</strong> entrás con una persona de prueba y después la podés cambiar desde el botón flotante.
          </p>
        )}
      </Card>
    </PublicShell>
  );
}
