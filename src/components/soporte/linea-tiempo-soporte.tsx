import { ArrowRightLeft, Bot, EyeOff, Flag, Lock, UserRound } from "lucide-react";
import type { EntradaSoporte, TicketDetalleSoporte } from "@/dominio/dto";
import { AdjuntosLista } from "@/components/tickets/adjuntos-lista";
import { Burbuja } from "@/components/tickets/linea-tiempo";
import { formatearFecha } from "@/lib/fechas";
import { BorradorEditor } from "./borrador-editor";

/** Historial completo con internos. Lo escrito por Claude se ve en un bloque claramente distinto. */
export function LineaTiempoSoporte({ ticket }: { ticket: TicketDetalleSoporte }) {
  return (
    <ol className="space-y-4" aria-label="Historial completo">
      {ticket.historial.map((e, i) => (
        <li key={e.id}>
          <Entrada e={e} ticket={ticket} primera={i === 0} />
        </li>
      ))}
    </ol>
  );
}

function Entrada({ e, ticket, primera }: { e: EntradaSoporte; ticket: TicketDetalleSoporte; primera: boolean }) {
  const delCliente = (e.autorEmail ?? "").toLowerCase() === ticket.autorEmail.toLowerCase();

  if (primera && e.tipo === "estado") {
    return (
      <div className="flex justify-start">
        <Burbuja propia={false} autor={`${e.autor} · Cliente`} fecha={e.fecha} texto={ticket.descripcion}>
          <AdjuntosLista adjuntos={e.adjuntos} />
        </Burbuja>
      </div>
    );
  }

  if (e.autorEsIA) return <BloqueClaude e={e} ticketId={ticket.ticketId} />;

  switch (e.tipo) {
    case "comentario":
      return (
        <div className={delCliente ? "flex justify-start" : "flex justify-end"}>
          <Burbuja propia={!delCliente} autor={delCliente ? `${e.autor} · Cliente` : e.autor} fecha={e.fecha} texto={e.texto}>
            <AdjuntosLista adjuntos={e.adjuntos} />
          </Burbuja>
        </div>
      );
    case "nota_interna":
      return (
        <div className="space-y-1 rounded-2xl border border-internal-border bg-internal px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Lock className="size-3.5" aria-hidden />
            Nota interna · {e.autor} · {formatearFecha(e.fecha)}
          </p>
          <p className="whitespace-pre-wrap">{e.texto}</p>
        </div>
      );
    default: {
      const Icono = e.tipo === "estado" ? ArrowRightLeft : e.tipo === "prioridad" ? Flag : e.tipo === "asignacion" ? UserRound : EyeOff;
      const etiqueta = { estado: "Estado", prioridad: "Prioridad", asignacion: "Asignado a", borrador_respuesta: "Borrador" }[e.tipo as string] ?? e.tipo;
      return (
        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Icono className="size-3.5 shrink-0" aria-hidden />
          <span>
            {etiqueta}: <strong>{e.texto}</strong> · {e.autor} · {formatearFecha(e.fecha)}
            {!e.visible && " · interno"}
          </span>
        </p>
      );
    }
  }
}

function BloqueClaude({ e, ticketId }: { e: EntradaSoporte; ticketId: string }) {
  const titulo = e.tipo === "borrador_respuesta" ? "Borrador de respuesta" : e.tipo === "nota_interna" ? "Nota interna" : e.tipo;
  return (
    <section
      aria-label={`Claude · IA · Interno: ${titulo}`}
      className="space-y-2 rounded-2xl border-2 border-dashed border-internal-border bg-internal px-4 py-3"
    >
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-surface">
          <Bot className="size-3.5" aria-hidden />
          Claude · IA · Interno
        </span>
        <span>{titulo}</span>
        <span className="font-normal text-muted-foreground">{formatearFecha(e.fecha)}</span>
        {e.estadoBorrador && e.estadoBorrador !== "pendiente" && (
          <span className="pill bg-st-cerrado text-st-cerrado-fg">{e.estadoBorrador === "publicado" ? "Publicado" : "Descartado"}</span>
        )}
      </p>
      {e.tipo === "borrador_respuesta" && e.estadoBorrador === "pendiente" ? (
        <BorradorEditor ticketId={ticketId} borradorId={e.id} textoInicial={e.texto} />
      ) : (
        <p className="whitespace-pre-wrap">{e.texto}</p>
      )}
    </section>
  );
}
