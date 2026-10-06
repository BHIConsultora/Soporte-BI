import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { obtenerContexto } from "@/infra/contexto";
import { tokenCsrfPagina } from "@/infra/csrf-pagina";

export const metadata: Metadata = { title: "Elegí el cliente" };

export default async function ElegirClientePage() {
  const ctx = await obtenerContexto();
  if (!ctx) redirect("/bienvenida");
  if (ctx.acceso.tipo !== "elegir_cliente") redirect("/");

  return (
    <PublicShell>
      <Card className="space-y-5">
        <h1 className="font-display text-2xl font-semibold text-main">¿Con qué cliente vas a trabajar?</h1>
        <p className="text-muted-foreground">Tu cuenta está habilitada en más de un cliente. Lo podés cambiar después saliendo y volviendo a entrar.</p>
        <form method="post" action="/api/sesion/cliente" className="space-y-4">
          <input type="hidden" name="csrf" value={await tokenCsrfPagina()} />
          <fieldset className="space-y-2">
            <legend className="sr-only">Cliente</legend>
            {ctx.acceso.clientes.map((c, i) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 has-checked:border-main">
                <input type="radio" name="clienteId" value={c.id} defaultChecked={i === 0} className="accent-main" />
                {c.nombre}
              </label>
            ))}
          </fieldset>
          <Button type="submit" className="w-full">
            Continuar
          </Button>
        </form>
      </Card>
    </PublicShell>
  );
}
