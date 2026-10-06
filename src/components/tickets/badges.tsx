import type { Estado, Prioridad } from "@/dominio/catalogos";
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
  return <span className={cn("pill font-display", prioridadCls[prioridad], className)}>{prioridad}</span>;
}
