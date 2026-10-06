import type { Metadata } from "next";
import { BotonCopiar } from "@/components/admin/comun";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { linkConsentimiento } from "@/infra/entra";

export const metadata: Metadata = { title: "Falta un permiso" };

/** Se muestra cuando el login falla por falta de consentimiento (AADSTS65001 y similares). */
export default function ConsentimientoPage() {
  const link = linkConsentimiento();
  return (
    <PublicShell>
      <Card className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-main">Falta un permiso de tu organización</h1>
        <p>
          Para entrar al portal con tu cuenta de trabajo, un administrador de Microsoft 365 de tu organización tiene que aprobar la
          aplicación <strong>&quot;Soporte BI – Portal&quot;</strong> una sola vez. Solo pide ver tu nombre y tu email.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Copiá el link de abajo.</li>
          <li>Mandáselo a la persona que administra Microsoft 365 en tu organización (suele ser el área de sistemas).</li>
          <li>Cuando lo apruebe, volvé a entrar.</li>
        </ol>
        {link ? (
          <div className="space-y-2">
            <code className="block rounded-xl bg-muted p-3 text-xs break-all">{link}</code>
            <BotonCopiar texto={link} etiqueta="Copiar link para el administrador" />
          </div>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">En modo demo no hay link de consentimiento.</p>
        )}
        <Button asChild variant="outline">
          <a href="/bienvenida">Volver a intentar</a>
        </Button>
      </Card>
    </PublicShell>
  );
}
