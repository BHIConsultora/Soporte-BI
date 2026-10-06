import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Aviso } from "@/components/ui/form";
import { configAuth } from "@/infra/auth/config";
import { rutaInternaSegura } from "@/infra/csrf";
import { isDemoMode } from "@/infra/env";
import { leerSesion } from "@/infra/sesion";

export const metadata: Metadata = { title: "Bienvenida" };

const ERRORES: Record<string, string> = {
  cancelado: "Se canceló el inicio de sesión. Cuando quieras, probá de nuevo.",
  vencido: "El inicio de sesión tardó demasiado o se abrió en otra pestaña. Probá de nuevo.",
  login: "No pudimos completar el inicio de sesión con Microsoft. Probá de nuevo en unos minutos.",
};

export default async function BienvenidaPage({ searchParams }: { searchParams: Promise<{ volver?: string; error?: string }> }) {
  const sp = await searchParams;
  const volver = rutaInternaSegura(sp.volver);
  if (await leerSesion()) redirect(volver);

  const demo = isDemoMode();
  const microsoft = configAuth() !== null;
  const error = sp.error ? ERRORES[sp.error] : undefined;
  const destino = encodeURIComponent(volver);

  return (
    <PublicShell>
      <Card className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-main">Soporte de tableros BI</h1>
          <p className="text-muted-foreground">Contanos qué pasa con tu tablero de Power BI y seguí la respuesta del equipo de BHI.</p>
        </div>
        <Aviso tipo="error">{error}</Aviso>
        <div className="flex flex-col items-center gap-3">
          {(microsoft || !demo) && (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href={`/api/auth/login?modo=microsoft&volver=${destino}`}>Iniciar sesión con Microsoft</a>
            </Button>
          )}
          {demo && (
            <Button asChild size="lg" variant={microsoft ? "outline" : "primary"} className="w-full sm:w-auto">
              <a href={`/api/auth/login?volver=${destino}`}>{microsoft ? "Entrar con una persona demo" : "Iniciar sesión con Microsoft"}</a>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Usá tu cuenta de trabajo. No hace falta crear un usuario.</p>
        {demo && (
          <p className="rounded-xl bg-internal px-3 py-2 text-sm">
            <strong>Modo demo:</strong> los datos son ficticios.{" "}
            {microsoft
              ? "Podés entrar con tu cuenta real de Microsoft (para probar el login) o con una persona de prueba."
              : "Entrás con una persona de prueba y después la podés cambiar desde el botón flotante."}
          </p>
        )}
      </Card>
    </PublicShell>
  );
}
