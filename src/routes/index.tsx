import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bot, Plus, Search, Inbox } from "lucide-react";
import { Protected } from "@/components/portal/AppShell";
import { EstadoBadge, PrioridadBadge } from "@/components/portal/Badges";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fecha, hace } from "@/lib/format";
import { ESTADOS, type Me, type Scope } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mis tickets · Portal de Soporte BI" },
      { name: "description", content: "Seguí el estado de tus reclamos sobre tableros de Power BI." },
      { property: "og:title", content: "Mis tickets · Portal de Soporte BI" },
      { property: "og:description", content: "Seguí el estado de tus reclamos sobre tableros de Power BI." },
    ],
  }),
  component: () => (
    <Protected>
      <MisTickets />
    </Protected>
  ),
});

function MisTickets() {
  const { me } = useSession() as { me: Me };
  const navigate = useNavigate();
  const soporte = me.rol === "soporte";
  const [verTodos, setVerTodos] = useState(soporte);
  useEffect(() => setVerTodos(soporte), [soporte]);
  const [estado, setEstado] = useState("");
  const [q, setQ] = useState("");
  const [soloBorradores, setSoloBorradores] = useState(false);

  const scope: Scope = me.rol === "soporte" && verTodos ? "all" : me.rol === "referente" && verTodos ? "org" : "mine";

  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", me.rol, scope, estado, q],
    queryFn: () => api.listTickets({ scope, estado, q }),
  });

  const list = useMemo(
    () => (data ?? []).filter((t) => !soloBorradores || (t.borradoresPendientes ?? 0) > 0),
    [data, soloBorradores],
  );

  const stats = useMemo(() => {
    const all = data ?? [];
    const now = new Date();
    return {
      abiertos: all.filter((t) => t.estado !== "Resuelto" && t.estado !== "Cerrado").length,
      esperando: all.filter((t) => t.estado === "Esperando al cliente").length,
      resueltos: all.filter((t) => {
        const d = new Date(t.ultimaActualizacion);
        return t.estado === "Resuelto" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      borradores: all.reduce((s, t) => s + (t.borradoresPendientes ?? 0), 0),
    };
  }, [data]);

  const open = (id: string) => navigate({ to: "/tickets/$id", params: { id } });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Mis tickets</h1>
        <Link to="/nuevo" search={{ tablero: undefined }} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> Nuevo reclamo
        </Link>
      </div>

      <div className={`grid gap-4 ${soporte ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Stat label="Abiertos" value={stats.abiertos} />
        <Stat label="Esperando tu respuesta" value={stats.esperando} />
        <Stat label="Resueltos este mes" value={stats.resueltos} />
        {soporte && <Stat label="Borradores por revisar" value={stats.borradores} highlight />}
      </div>

      <div className="card-soft p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor="buscar" className="sr-only">Buscar</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input id="buscar" className="field pl-9" placeholder="Buscar por número, tablero o descripción" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label htmlFor="estado" className="sr-only">Estado</label>
            <select id="estado" className="field lg:w-56" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
          {me.rol !== "usuario" && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={verTodos} onCheckedChange={setVerTodos} />
              {soporte ? "Ver todos" : "Ver todos los de mi organización"}
            </label>
          )}
          {soporte && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soloBorradores} onCheckedChange={setSoloBorradores} />
              Con borrador pendiente
            </label>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => <div key={i} className="card-soft h-16 animate-pulse" />)}
        </div>
      ) : error ? (
        <p className="card-soft p-6 text-destructive">{(error as Error).message}</p>
      ) : list.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-12 text-center">
          <Inbox className="h-10 w-10 text-main" aria-hidden />
          <p className="max-w-sm text-muted-foreground">
            {q || estado || soloBorradores
              ? "No hay tickets que coincidan con los filtros."
              : "Todavía no cargaste reclamos. Si ves algo raro en un tablero, contanos."}
          </p>
          <Link to="/nuevo" search={{ tablero: undefined }} className="btn btn-primary mt-2">Nuevo reclamo</Link>
        </div>
      ) : (
        <>
          {/* Mobile: tarjetas */}
          <ul className="space-y-3 md:hidden">
            {list.map((t) => (
              <li key={t.ticketId}>
                <Link to="/tickets/$id" params={{ id: t.ticketId }} className="card-soft block p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold text-main">{t.ticketId}</span>
                    <div className="flex gap-1.5"><EstadoBadge estado={t.estado} /><PrioridadBadge prioridad={t.prioridad} /></div>
                  </div>
                  <p className="mt-2 font-semibold">{t.tablero}</p>
                  <p className="text-sm text-muted-foreground">{t.tipo}{soporte && ` · ${t.cliente}`}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Alta {fecha(t.fechaAlta)} · actualizado {hace(t.ultimaActualizacion)}</p>
                </Link>
              </li>
            ))}
          </ul>
          {/* Escritorio: tabla */}
          <div className="card-soft hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">N°</th>
                  {soporte && <th className="px-4 py-3 font-semibold">Cliente</th>}
                  <th className="px-4 py-3 font-semibold">Tablero</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  {soporte && <th className="px-4 py-3 font-semibold">Categoría</th>}
                  {soporte && <th className="px-4 py-3 font-semibold">Resumen IA</th>}
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Prioridad</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                  <th className="px-4 py-3 font-semibold">Última act.</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr
                    key={t.ticketId}
                    tabIndex={0}
                    onClick={() => open(t.ticketId)}
                    onKeyDown={(e) => e.key === "Enter" && open(t.ticketId)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent focus-visible:bg-accent"
                  >
                    <td className="px-4 py-3 font-display font-semibold text-main">
                      <span className="inline-flex items-center gap-1.5">
                        {t.ticketId}
                        {soporte && (t.borradoresPendientes ?? 0) > 0 && (
                          <Bot className="h-3.5 w-3.5" aria-label="Borrador pendiente" />
                        )}
                      </span>
                    </td>
                    {soporte && <td className="px-4 py-3">{t.cliente}</td>}
                    <td className="px-4 py-3 font-semibold">{t.tablero}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.tipo}</td>
                    {soporte && <td className="px-4 py-3 text-muted-foreground">{t.categoria ?? "—"}</td>}
                    {soporte && <td className="max-w-56 truncate px-4 py-3 text-muted-foreground" title={t.resumenIA}>{t.resumenIA ?? "—"}</td>}
                    <td className="px-4 py-3"><EstadoBadge estado={t.estado} /></td>
                    <td className="px-4 py-3"><PrioridadBadge prioridad={t.prioridad} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fecha(t.fechaAlta)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{hace(t.ultimaActualizacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-5 ${highlight ? "rounded-2xl bg-main text-on-main" : "card-soft"}`}>
      <p className={`text-sm ${highlight ? "opacity-85" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}
