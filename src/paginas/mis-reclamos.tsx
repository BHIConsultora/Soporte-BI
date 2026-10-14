import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSesion, useTitulo } from "@/app/sesion";
import { EstadoBadge, PrioridadBadge } from "@/components/tickets/badges";
import { Card } from "@/components/ui/card";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { listarTickets, type ContextoAutorizado } from "@/servicios/tickets";
import { useContextoPortal } from "./portal-layout";

type Items = Awaited<ReturnType<typeof listarTickets>>["items"];

function vistasDisponibles({ acceso }: ContextoAutorizado): { id: string; etiqueta: string }[] {
  if (acceso.tipo === "bhi") return [];
  const vistas = [{ id: "mios", etiqueta: "Míos" }];
  for (const a of acceso.areasLideradas) vistas.push({ id: `area:${a.id}`, etiqueta: a.nombre });
  if (acceso.rol !== "usuario") vistas.push({ id: "org", etiqueta: "De mi organización" });
  return vistas;
}

export function MisReclamosPage() {
  useTitulo("Mis reclamos");
  const ctx = useContextoPortal();
  const { backend } = useSesion();
  const [params] = useSearchParams();
  const vistas = vistasDisponibles(ctx);
  const pedida = params.get("vista");
  const vista = vistas.some((v) => v.id === pedida) ? pedida! : "mios";

  const [items, setItems] = useState<Items | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let vigente = true;
    listarTickets(ctx, backend.repo, { vista }).then(
      ({ items }) => vigente && setItems(items),
      (e: unknown) => vigente && setError(e),
    );
    return () => {
      vigente = false;
    };
  }, [ctx, backend, vista]);

  if (error) throw error;
  // Igual que el render en el servidor: la página aparece completa, no a medias.
  if (!items) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-main sm:text-3xl">Mis reclamos</h1>

      {vistas.length > 1 && (
        <nav aria-label="Qué reclamos ver" className="flex flex-wrap gap-2">
          {vistas.map((v) => (
            <Link
              key={v.id}
              to={`/?vista=${encodeURIComponent(v.id)}`}
              aria-current={v.id === vista ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-1.5 font-display text-sm",
                v.id === vista ? "border-main bg-main text-on-main" : "border-main/30 bg-surface text-main hover:bg-accent",
              )}
            >
              {v.etiqueta}
            </Link>
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-muted-foreground">Todavía no hay reclamos para mostrar.</Card>
      ) : (
        <ul className="grid gap-3" aria-label="Reclamos">
          {items.map((t) => (
            <li key={t.ticketId}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-semibold text-main">{t.ticketId}</span>
                  <EstadoBadge estado={t.estado} />
                  <PrioridadBadge prioridad={t.prioridad} />
                  <span className="text-sm text-muted-foreground">
                    {t.tablero.nombre}
                    {ctx.acceso.tipo === "bhi" && ` · ${t.cliente}`}
                  </span>
                </div>
                <p className="line-clamp-2">{t.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  {t.autorNombre} · actualizado {formatearFecha(t.ultimaActualizacion)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
