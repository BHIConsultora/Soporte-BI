import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccionesCliente } from "@/components/tickets/acciones-cliente";
import { EstadoBadge, PrioridadBadge } from "@/components/tickets/badges";
import { LineaTiempoCliente } from "@/components/tickets/linea-tiempo";
import { ResponderForm } from "@/components/tickets/responder-form";
import { Card } from "@/components/ui/card";
import { formatTicketId } from "@/dominio/ticket-id";
import { getDeps } from "@/infra/api";
import { requerirContexto } from "@/infra/contexto";
import { o404, ticketIdDePagina } from "@/infra/paginas";
import { formatearFecha } from "@/lib/fechas";
import { obtenerTicketCliente } from "@/servicios/tickets";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).id).toUpperCase() };
}

export default async function TicketClientePage({ params }: { params: Promise<{ id: string }> }) {
  const itemId = ticketIdDePagina((await params).id);
  const ctx = await requerirContexto();
  if (ctx.acceso.tipo === "bhi") redirect(`/soporte/tickets/${formatTicketId(itemId)}`);

  const t = await o404(async () => obtenerTicketCliente(ctx, await getDeps(), itemId));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-main hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mis reclamos
      </Link>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-main">{t.ticketId}</h1>
          <EstadoBadge estado={t.estado} />
          <PrioridadBadge prioridad={t.prioridad} />
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Dato titulo="Tablero">
            {t.tablero.nombre}
            {t.pagina && ` · ${t.pagina}`}
          </Dato>
          <Dato titulo="Tipo">{t.tipo}</Dato>
          <Dato titulo="Urgencia">{t.urgencia}</Dato>
          <Dato titulo="Creado por">{t.autorNombre}</Dato>
          <Dato titulo="Fecha">{formatearFecha(t.fechaAlta)}</Dato>
          <Dato titulo="Última novedad">{formatearFecha(t.ultimaActualizacion)}</Dato>
        </dl>
        <AccionesCliente ticketId={t.ticketId} puedeResolver={t.puedeResolver} puedeReabrir={t.puedeReabrir} />
      </Card>

      <section className="space-y-4" aria-labelledby="historial-titulo">
        <h2 id="historial-titulo" className="font-display text-lg font-semibold">
          Conversación
        </h2>
        <LineaTiempoCliente entradas={t.historial} descripcion={t.descripcion} />
      </section>

      {t.puedeComentar ? (
        <Card>
          <ResponderForm
            ticketId={t.ticketId}
            ayuda={t.estado === "Esperando al cliente" ? "El equipo está esperando tu respuesta." : undefined}
          />
        </Card>
      ) : (
        !t.esAutor && (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Solo quien creó el reclamo puede responder. Lo ves porque es de tu área u organización.
          </p>
        )
      )}
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
