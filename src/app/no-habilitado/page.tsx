import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Acceso no habilitado" };

const MENSAJES = {
  tenant_no_habilitado: {
    titulo: "Tu organización todavía no está habilitada",
    texto: "Registramos tu pedido de acceso. El equipo de BHI lo va a revisar y te avisamos cuando esté listo.",
  },
  sin_permiso: {
    titulo: "Tu cuenta no tiene acceso al portal",
    texto: "Si creés que es un error, pedile a tu referente o al equipo de BHI que te habilite.",
  },
} as const;

export default async function NoHabilitadoPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const motivo = (await searchParams).motivo === "tenant_no_habilitado" ? "tenant_no_habilitado" : "sin_permiso";
  const { titulo, texto } = MENSAJES[motivo];
  return (
    <PublicShell>
      <Card className="space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-main">{titulo}</h1>
        <p className="text-muted-foreground">{texto}</p>
        <Button asChild variant="outline">
          <a href="/api/auth/logout">Salir y entrar con otra cuenta</a>
        </Button>
      </Card>
    </PublicShell>
  );
}
