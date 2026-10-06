"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { Bot, GripVertical, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PRIORIDADES, type Estado, type Prioridad } from "@/dominio/catalogos";
import type { TicketKanban } from "@/dominio/dto";
import type { Semaforo } from "@/dominio/sla";
import { PrioridadBadge, SemaforoBadge } from "@/components/tickets/badges";
import { Button } from "@/components/ui/button";
import { Aviso, Label, Select } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";
import { cn } from "@/lib/utils";

export const COLUMNAS: Estado[] = ["Nuevo", "En análisis", "Esperando al cliente", "Resuelto"];

export type TarjetaKanban = TicketKanban & { semaforo: Semaforo | null };

interface Filtros {
  cliente: string;
  prioridad: Prioridad | "";
  mios: boolean;
  sinAsignar: boolean;
  conBorrador: boolean;
}

const nombreCorto = (email: string) => email.split("@")[0] ?? email;

/** Con teclado, ← y → saltan de columna en columna (por defecto dnd-kit mueve de a 25 px). */
const saltarDeColumna: KeyboardCoordinateGetter = (evento, { currentCoordinates, context: { active } }) => {
  if (evento.code !== "ArrowRight" && evento.code !== "ArrowLeft") return undefined;
  evento.preventDefault();
  const columnas = COLUMNAS.flatMap((id) => {
    const el = document.querySelector(`[data-columna="${id}"]`);
    return el ? [el.getBoundingClientRect()] : [];
  });
  const ancho = active?.rect.current.initial?.width ?? 0;
  const centro = currentCoordinates.x + ancho / 2;
  const actual = columnas.findIndex((r) => centro >= r.left && centro <= r.right);
  const paso = evento.code === "ArrowRight" ? 1 : -1;
  const destino = columnas[Math.min(columnas.length - 1, Math.max(0, (actual === -1 ? 0 : actual) + paso))];
  if (!destino) return undefined;
  return { x: destino.left + destino.width / 2 - ancho / 2, y: currentCoordinates.y };
};

export function Kanban({ tickets: iniciales, yo, clientes }: { tickets: TarjetaKanban[]; yo: string; clientes: string[] }) {
  const router = useRouter();
  const [tickets, setTickets] = useState(iniciales);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>({ cliente: "", prioridad: "", mios: false, sinAsignar: false, conBorrador: false });

  // Si el servidor manda datos nuevos (router.refresh), se toman.
  const [previos, setPrevios] = useState(iniciales);
  if (previos !== iniciales) {
    setPrevios(iniciales);
    setTickets(iniciales);
  }

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: saltarDeColumna }));

  const visibles = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (!filtros.cliente || t.cliente === filtros.cliente) &&
          (!filtros.prioridad || t.prioridad === filtros.prioridad) &&
          (!filtros.mios || t.asignadoA === yo) &&
          (!filtros.sinAsignar || t.asignadoA === null) &&
          (!filtros.conBorrador || t.borradorPendiente),
      ),
    [tickets, filtros, yo],
  );

  const mover = async (ticketId: string, estado: Estado) => {
    const anterior = tickets.find((t) => t.ticketId === ticketId);
    if (!anterior || anterior.estado === estado) return;
    setTickets((ts) => ts.map((t) => (t.ticketId === ticketId ? { ...t, estado } : t)));
    const r = await llamarApi(`/api/tickets/${ticketId}`, { method: "PATCH", json: { estado } });
    if (!r.ok) {
      setTickets((ts) => ts.map((t) => (t.ticketId === ticketId ? anterior : t)));
      setError(`${ticketId}: ${r.error}`);
      return;
    }
    setError(null);
    router.refresh();
  };

  const tomar = async (ticketId: string) => {
    const r = await llamarApi(`/api/tickets/${ticketId}/tomar`, { method: "POST" });
    if (!r.ok) return setError(`${ticketId}: ${r.error}`);
    setTickets((ts) => ts.map((t) => (t.ticketId === ticketId ? { ...t, asignadoA: yo } : t)));
    router.refresh();
  };

  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (over) void mover(String(active.id), over.id as Estado);
  };

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Agarraste ${active.id}. Usá las flechas para elegir columna y Espacio para soltar.`,
    onDragOver: ({ active, over }) => (over ? `${active.id} está sobre la columna ${over.id}.` : `${active.id} no está sobre ninguna columna.`),
    onDragEnd: ({ active, over }) => (over ? `${active.id} se movió a ${over.id}.` : `${active.id} volvió a su lugar.`),
    onDragCancel: ({ active }) => `Se canceló el movimiento de ${active.id}.`,
  };

  return (
    <div className="space-y-4">
      <fieldset className="card flex flex-wrap items-end gap-3 p-4">
        <legend className="sr-only">Filtros</legend>
        <div className="space-y-1">
          <Label htmlFor="f-cliente">Cliente</Label>
          <Select id="f-cliente" value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })} className="w-52">
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-prioridad">Prioridad</Label>
          <Select
            id="f-prioridad"
            value={filtros.prioridad}
            onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value as Prioridad | "" })}
            className="w-32"
          >
            <option value="">Todas</option>
            {PRIORIDADES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </div>
        {(
          [
            ["mios", "Míos"],
            ["sinAsignar", "Sin asignar"],
            ["conBorrador", "Con borrador pendiente"],
          ] as const
        ).map(([clave, texto]) => (
          <label key={clave} className="flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm has-checked:border-main has-checked:bg-accent">
            <input
              type="checkbox"
              className="accent-main"
              checked={filtros[clave]}
              onChange={(e) => setFiltros({ ...filtros, [clave]: e.target.checked })}
            />
            {texto}
          </label>
        ))}
      </fieldset>

      <Aviso tipo="error">{error}</Aviso>

      <DndContext
        sensors={sensores}
        onDragEnd={alSoltar}
        accessibility={{ announcements: anuncios, screenReaderInstructions: {
            draggable: "Para mover el reclamo con el teclado: Espacio para agarrarlo, flechas izquierda y derecha para elegir la columna, Espacio para soltar y Escape para cancelar.",
          }, }}
      >
        <div className="relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {COLUMNAS.map((estado) => (
            <Columna key={estado} estado={estado} tickets={visibles.filter((t) => t.estado === estado)} yo={yo} onTomar={tomar} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Columna({ estado, tickets, yo, onTomar }: { estado: Estado; tickets: TarjetaKanban[]; yo: string; onTomar: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section
      ref={setNodeRef}
      data-columna={estado}
      aria-label={`${estado} (${tickets.length})`}
      className={cn("w-[80vw] max-w-xs shrink-0 snap-start space-y-3 rounded-2xl bg-muted p-3 lg:w-auto lg:max-w-none", isOver && "ring-2 ring-main")}
    >
      <h2 className="flex items-center justify-between font-display text-sm font-semibold">
        {estado}
        <span className="rounded-full bg-surface px-2 text-xs">{tickets.length}</span>
      </h2>
      <ul className="min-h-24 space-y-2">
        {tickets.map((t) => (
          <Tarjeta key={t.ticketId} t={t} yo={yo} onTomar={onTomar} />
        ))}
      </ul>
    </section>
  );
}

function Tarjeta({ t, yo, onTomar }: { t: TarjetaKanban; yo: string; onTomar: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.ticketId });
  const estilo = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <li ref={setNodeRef} style={estilo} className={cn("card space-y-2 p-3 text-sm", isDragging && "z-10 shadow-lg ring-2 ring-main")}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="-ml-1 cursor-grab touch-none rounded-lg p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label={`Mover ${t.ticketId}`}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/soporte/tickets/${t.ticketId}`} className="font-display font-semibold text-main hover:underline">
              {t.ticketId}
            </Link>
            <PrioridadBadge prioridad={t.prioridad} />
            {t.borradorPendiente && (
              <span className="pill bg-internal text-foreground" title="Tiene un borrador de respuesta pendiente">
                <Bot className="size-3.5" aria-hidden />
                Borrador
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {t.cliente} · {t.tablero.nombre}
          </p>
        </div>
      </div>
      <p className="line-clamp-2">{t.descripcion}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {t.semaforo ? <SemaforoBadge semaforo={t.semaforo} /> : <span />}
        {t.asignadoA ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="size-3.5" aria-hidden />
            <span className="sr-only">Asignado a</span>
            {t.asignadoA === yo ? "Vos" : nombreCorto(t.asignadoA)}
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onTomar(t.ticketId)} aria-label={`Tomar ${t.ticketId}`}>
            Tomar
          </Button>
        )}
      </div>
    </li>
  );
}
