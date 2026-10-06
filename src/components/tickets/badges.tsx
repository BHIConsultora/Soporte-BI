import type { Estado, Prioridad } from "@/dominio/catalogos";
import { PRIORIDAD_DESCRIPCION } from "@/dominio/catalogos";
import type { Semaforo } from "@/dominio/sla";
import { cn } from "@/lib/utils";

const estadoCls: Record<Estado, string> = {
  Nuevo: "bg-st-nuevo text-st-nuevo-fg",
  "En análisis": "bg-st-analisis text-st-analisis-fg",
  "Esperando al cliente": "bg-st-esperando text-st-esperando-fg",
  Resuelto: "bg-st-resuelto text-st-resuelto-fg",
  Cerrado: "bg-st-cerrado text-st-cerrado-fg",
};

const prioridadCls: Record<Prioridad, string> = {
  P1: "bg-p1 text-p1-fg",
  P2: "bg-p2 text-p2-fg",
  P3: "bg-p3 text-p3-fg",
  P4: "bg-p4 text-p4-fg",
};

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  return <span className={cn("pill", estadoCls[estado], className)}>{estado}</span>;
}

export function PrioridadBadge({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  return (
    <span className={cn("pill font-display", prioridadCls[prioridad], className)} title={PRIORIDAD_DESCRIPCION[prioridad]}>
      {prioridad}
    </span>
  );
}

const semaforoCls: Record<Semaforo, { cls: string; texto: string }> = {
  verde: { cls: "bg-st-resuelto text-st-resuelto-fg", texto: "En plazo" },
  amarillo: { cls: "bg-st-esperando text-st-esperando-fg", texto: "Por vencer" },
  rojo: { cls: "bg-p1 text-p1-fg", texto: "Vencido" },
};

/** Semáforo de SLA: color + texto (no depende solo del color). */
export function SemaforoBadge({ semaforo }: { semaforo: Semaforo }) {
  const { cls, texto } = semaforoCls[semaforo];
  return (
    <span className={cn("pill", cls)}>
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {texto}
    </span>
  );
}
