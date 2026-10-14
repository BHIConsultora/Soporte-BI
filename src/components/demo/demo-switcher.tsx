import { FlaskConical } from "lucide-react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSesion } from "@/app/sesion";
import { Button } from "@/components/ui/button";
import { rutaInternaSegura } from "@/infra/rutas";

/** Selector flotante de persona (solo modo demo). */
export function DemoSwitcher({ volver }: { volver: string }) {
  const { backend, recargar } = useSesion();
  const navigate = useNavigate();
  if (!backend.demo) return null;
  const { personas, personaActual, cambiarPersona } = backend.demo;

  async function cambiar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const panel = e.currentTarget.closest("details");
    if (!(await cambiarPersona(String(form.get("persona") ?? "")))) return;
    // El original recargaba la página (POST + 303): el panel vuelve a quedar cerrado.
    panel?.removeAttribute("open");
    // Primero se vuelve a la página y después se recarga el acceso: si la persona nueva
    // no tiene acceso a esa página, el guard del portal la redirige (como el 303 original).
    navigate(rutaInternaSegura(String(form.get("volver") ?? "/")), { replace: true });
    await recargar();
  }

  return (
    <details className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-surface shadow-lg open:p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 font-display text-sm text-main [&::-webkit-details-marker]:hidden">
        <FlaskConical className="size-4" aria-hidden />
        Modo demo · cambiar persona
      </summary>
      <form onSubmit={cambiar} className="mt-3 space-y-3">
        <input type="hidden" name="volver" value={volver} />
        <label htmlFor="demo-persona" className="block text-sm font-semibold">
          Entrar como
        </label>
        <select
          id="demo-persona"
          name="persona"
          defaultValue={personaActual() ?? "usuario"}
          className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
        >
          {personas.map((p) => (
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
