import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Selector flotante de persona (solo modo demo). Formulario HTML simple: funciona sin JS. */
export async function DemoSwitcher({ oidActual, volver }: { oidActual: string; volver: string }) {
  const { PERSONAS_DEMO } = await import("@/repositorio/demo/datos");
  const actual = PERSONAS_DEMO.find((p) => p.oid === oidActual)?.clave ?? "usuario";
  return (
    <details className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-surface shadow-lg open:p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 font-display text-sm text-main [&::-webkit-details-marker]:hidden">
        <FlaskConical className="size-4" aria-hidden />
        Modo demo · cambiar persona
      </summary>
      <form method="post" action="/api/demo/persona" className="mt-3 space-y-3">
        <input type="hidden" name="volver" value={volver} />
        <label htmlFor="demo-persona" className="block text-sm font-semibold">
          Entrar como
        </label>
        <select
          id="demo-persona"
          name="persona"
          defaultValue={actual}
          className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
        >
          {PERSONAS_DEMO.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.nombre} — {p.descripcion}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="w-full">
          Cambiar
        </Button>
        <p className="text-xs text-muted-foreground">Datos ficticios. Nada de esto llega a SharePoint ni envía correos.</p>
      </form>
    </details>
  );
}
