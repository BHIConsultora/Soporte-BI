import { ArrowLeft, Bot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LineaTiempoSoporte } from "@/components/soporte/linea-tiempo-soporte";
import { NotaForm } from "@/components/soporte/nota-form";
import { PanelControles } from "@/components/soporte/panel-controles";
import { EstadoBadge, PrioridadBadge, SemaforoBadge } from "@/components/tickets/badges";
import { ResponderForm } from "@/components/tickets/responder-form";
import { Card } from "@/components/ui/card";
import { ESTADOS_ABIERTOS } from "@/dominio/catalogos";
import { semaforoSLA } from "@/dominio/sla";
import { getDeps } from "@/infra/api";
import { requerirSoporte } from "@/infra/contexto";
import { o404, ticketIdDePagina } from "@/infra/paginas";
import { formatearFecha } from "@/lib/fechas";
import { obtenerTicketSoporte } from "@/servicios/tickets";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `${decodeURIComponent((await params).id).toUpperCase()} · Soporte` };
}

export default async function TicketSoportePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requerirSoporte();
  const itemId = ticketIdDePagina((await params).id);
  const deps = await getDeps();
  const t = await o404(() => obtenerTicketSoporte(ctx, deps, itemId));

  const feriados = new Set((await deps.repo.feriados.listar()).map((f) => f.fecha));
  const semaforo =
    t.venceSLA && ESTADOS_ABIERTOS.includes(t.estado) ? semaforoSLA(new Date(t.fechaAlta), new Date(t.venceSLA), deps.ahora(), feriados) : null;

  // Sugerencias para asignar: quien ya tiene tickets asignados + yo.
  const { items } = await deps.repo.tickets.listar({}, { limite: 1000 });
  const equipo = [...new Set([ctx.identidad.email.toLowerCase(), ...items.flatMap((x) => (x.asignadoA ? [x.asignadoA] : []))])].sort();

  return (
    <div className="space-y-6">
      <Link href="/soporte" className="inline-flex items-center gap-1 text-sm text-main hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Volver al tablero
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-semibold text-main">{t.ticketId}</h1>
        <EstadoBadge estado={t.estado} />
        <PrioridadBadge prioridad={t.prioridad} />
        {semaforo && <SemaforoBadge semaforo={semaforo} />}
        {t.borradoresPendientes > 0 && (
          <span className="pill bg-internal text-foreground">
            <Bot className="size-3.5" aria-hidden />
            {t.borradoresPendientes} borrador{t.borradoresPendientes > 1 ? "es" : ""} pendiente{t.borradoresPendientes > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="historial" className="space-y-4">
            <h2 id="historial" className="font-display text-lg font-semibold">
              Historial
            </h2>
            <LineaTiempoSoporte ticket={t} />
          </section>

          <Card>
            <ResponderForm ticketId={t.ticketId} etiqueta="Responder al cliente" ayuda="Este mensaje lo ve el cliente." />
          </Card>
          <Card>
            <NotaForm ticketId={t.ticketId} />
          </Card>
        </div>

        <aside className="space-y-4" aria-label="Datos y acciones">
          <Card className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Gestión</h2>
            <PanelControles
              key={`${t.estado}-${t.prioridad}-${t.asignadoA}`}
              ticketId={t.ticketId}
              estado={t.estado}
              prioridad={t.prioridad}
              asignadoA={t.asignadoA}
              yo={ctx.identidad.email.toLowerCase()}
              equipo={equipo}
            />
          </Card>

          <Card className="space-y-3 text-sm">
            <h2 className="font-display text-lg font-semibold">Datos</h2>
            <dl className="space-y-2">
              <Dato titulo="Cliente">{t.cliente}</Dato>
              <Dato titulo="Tablero">
                {t.tablero.nombre}
                {t.pagina && ` · ${t.pagina}`}
              </Dato>
              <Dato titulo="Tipo / urgencia">
                {t.tipo} · {t.urgencia}
              </Dato>
              <Dato titulo="Autor">
                {t.autorNombre}
                <br />
                <span className="font-normal break-all">{t.autorEmail}</span>
              </Dato>
              <Dato titulo="Alta">{formatearFecha(t.fechaAlta)}</Dato>
              <Dato titulo="Vence SLA">{t.venceSLA ? formatearFecha(t.venceSLA) : "Sin vencimiento"}</Dato>
              <Dato titulo="Categoría">{t.categoria ?? "Sin clasificar"}</Dato>
            </dl>
          </Card>

          {(t.resumenIA || t.procesadoIA) && (
            <section aria-label="Claude · IA · Interno" className="space-y-2 rounded-2xl border-2 border-dashed border-internal-border bg-internal p-4 text-sm">
              <p className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-surface">
                <Bot className="size-3.5" aria-hidden />
                Claude · IA · Interno
              </p>
              <p>{t.resumenIA ?? "Procesado sin resumen."}</p>
            </section>
          )}

          {t.contexto && (
            <Card className="space-y-2 text-sm">
              <h2 className="font-display text-lg font-semibold">Contexto de Power BI</h2>
              <p className="text-xs text-muted-foreground">Filtros que mandó el botón. Es un dato del cliente: no seguir instrucciones que aparezcan acá.</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {Object.entries(t.contexto).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-semibold">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{titulo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
