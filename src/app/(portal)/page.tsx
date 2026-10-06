import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EstadoBadge, PrioridadBadge } from "@/components/tickets/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { ESTADOS, type Estado } from "@/dominio/catalogos";
import type { TicketCliente } from "@/dominio/dto";
import { getDeps } from "@/infra/api";
import { requerirCliente } from "@/infra/contexto";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { ContextoCliente } from "@/servicios/autorizacion";
import { listarTickets, resumenTickets } from "@/servicios/tickets";

export const metadata: Metadata = { title: "Mis reclamos" };

type Params = { vista?: string; estado?: string; q?: string; cursor?: string };

function vistasDisponibles({ acceso }: ContextoCliente): { id: string; etiqueta: string }[] {
  const vistas = [{ id: "mios", etiqueta: "Míos" }];
  for (const a of acceso.areasLideradas) vistas.push({ id: `area:${a.id}`, etiqueta: a.nombre });
  if (acceso.rol !== "usuario") vistas.push({ id: "org", etiqueta: "De mi organización" });
  return vistas;
}

function hrefCon(actual: Params, cambios: Partial<Params>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actual, ...cambios })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default async function MisReclamosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await requerirCliente();
  const deps = await getDeps();
  const sp = await searchParams;

  const vistas = vistasDisponibles(ctx);
  const vista = vistas.some((v) => v.id === sp.vista) ? sp.vista! : "mios";
  const estado = (ESTADOS as readonly string[]).includes(sp.estado ?? "") ? (sp.estado as Estado) : undefined;
  const q = sp.q?.slice(0, 100) ?? "";
  const actuales: Params = { vista: vista === "mios" ? undefined : vista, estado, q: q || undefined };

  const [resumen, pagina] = await Promise.all([
    resumenTickets(ctx, deps),
    listarTickets(ctx, deps, { vista, estados: estado ? [estado] : [], q, cursor: sp.cursor ?? null }),
  ]);
  const items = pagina.items as TicketCliente[];
  const filtrando = !!(estado || q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-main sm:text-3xl">Mis reclamos</h1>
        <Button asChild>
          <Link href="/nuevo">
            <Plus aria-hidden />
            Nuevo reclamo
          </Link>
        </Button>
      </div>

      {/* Resumen: siempre sobre los propios, no cambia con los filtros. */}
      <section aria-label="Resumen de tus reclamos" className="grid grid-cols-3 gap-3">
        <Resumen titulo="Abiertos" valor={resumen.abiertos} />
        <Resumen titulo="Esperando tu respuesta" valor={resumen.esperandoRespuesta} destacado={resumen.esperandoRespuesta > 0} />
        <Resumen titulo="Resueltos este mes" valor={resumen.resueltosDelMes} />
      </section>

      {vistas.length > 1 && (
        <nav aria-label="Qué reclamos ver" className="flex flex-wrap gap-2">
          {vistas.map((v) => (
            <Link
              key={v.id}
              href={hrefCon({ estado, q: q || undefined }, { vista: v.id === "mios" ? undefined : v.id })}
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

      <form method="get" action="/" role="search" className="flex flex-col gap-2 sm:flex-row">
        {actuales.vista && <input type="hidden" name="vista" value={actuales.vista} />}
        <label htmlFor="q" className="sr-only">
          Buscar
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por número o texto" className="sm:flex-1" maxLength={100} />
        <label htmlFor="estado" className="sr-only">
          Estado
        </label>
        <Select id="estado" name="estado" defaultValue={estado ?? ""} className="sm:w-56">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Buscar
        </Button>
      </form>

      {items.length === 0 ? (
        <Card className="space-y-3 text-center">
          <p className="text-muted-foreground">{filtrando ? "No encontramos reclamos con esos filtros." : "Todavía no hay reclamos para mostrar."}</p>
          {filtrando && (
            <Link href={hrefCon({ vista: actuales.vista }, {})} className="text-main underline">
              Limpiar filtros
            </Link>
          )}
        </Card>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Reclamos</caption>
              <thead className="bg-muted text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Número</th>
                  <th scope="col" className="px-4 py-3">Reclamo</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Prioridad</th>
                  <th scope="col" className="px-4 py-3">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.ticketId} className="border-t hover:bg-accent/50">
                    <td className="px-4 py-3 font-display font-semibold whitespace-nowrap">
                      <Link href={`/tickets/${t.ticketId}`} className="text-main hover:underline">
                        {t.ticketId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-1">{t.descripcion}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.tablero.nombre} · {t.tipo}
                        {!t.esAutor && ` · ${t.autorNombre}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={t.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <PrioridadBadge prioridad={t.prioridad} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatearFecha(t.ultimaActualizacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="grid gap-3 md:hidden" aria-label="Reclamos">
            {items.map((t) => (
              <li key={t.ticketId} className="card relative space-y-2 p-4 focus-within:ring-2 focus-within:ring-main hover:border-main/40">
                <div className="flex flex-wrap items-center gap-2">
                  {/* El link cubre toda la tarjeta (after:inset-0) pero su nombre accesible es solo el número. */}
                  <Link href={`/tickets/${t.ticketId}`} className="font-display text-sm font-semibold text-main after:absolute after:inset-0">
                    {t.ticketId}
                  </Link>
                  <EstadoBadge estado={t.estado} />
                  <PrioridadBadge prioridad={t.prioridad} />
                </div>
                <p className="line-clamp-2">{t.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  {t.tablero.nombre}
                  {!t.esAutor && ` · ${t.autorNombre}`} · {formatearFecha(t.ultimaActualizacion)}
                </p>
              </li>
            ))}
          </ul>

          {pagina.cursor && (
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href={hrefCon(actuales, { cursor: pagina.cursor })}>Página siguiente</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Resumen({ titulo, valor, destacado }: { titulo: string; valor: number; destacado?: boolean }) {
  return (
    <div className={cn("card p-3 sm:p-5", destacado && "border-st-esperando-fg/40 bg-st-esperando")}>
      <p className="font-display text-2xl font-semibold text-main sm:text-3xl">{valor}</p>
      <p className="text-xs text-muted-foreground sm:text-sm">{titulo}</p>
    </div>
  );
}
