import { ArrowRightLeft } from "lucide-react";
import type { EntradaCliente } from "@/dominio/dto";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { AdjuntosLista } from "./adjuntos-lista";

/** Línea de tiempo tipo chat para el cliente (nunca recibe entradas internas: las filtra el servidor). */
export function LineaTiempoCliente({ entradas, descripcion }: { entradas: EntradaCliente[]; descripcion: string }) {
  return (
    <ol className="space-y-4" aria-label="Historial del reclamo">
      {entradas.map((e, i) => {
        // La primera entrada (alta) muestra la descripción original con sus adjuntos.
        if (i === 0 && e.tipo === "estado") {
          return (
            <li key={e.id} className="flex justify-end">
              <Burbuja propia autor={e.autor} fecha={e.fecha} texto={descripcion}>
                <AdjuntosLista adjuntos={e.adjuntos} />
              </Burbuja>
            </li>
          );
        }
        if (e.tipo === "estado") {
          return (
            <li key={e.id} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ArrowRightLeft className="size-3.5" aria-hidden />
              <span>
                Estado: <strong>{e.texto}</strong> · {formatearFecha(e.fecha)}
              </span>
            </li>
          );
        }
        return (
          <li key={e.id} className={cn("flex", e.esEquipo ? "justify-start" : "justify-end")}>
            <Burbuja propia={!e.esEquipo} autor={e.esEquipo ? `${e.autor} · Equipo BHI` : e.autor} fecha={e.fecha} texto={e.texto}>
              <AdjuntosLista adjuntos={e.adjuntos} />
            </Burbuja>
          </li>
        );
      })}
    </ol>
  );
}

export function Burbuja({
  propia,
  autor,
  fecha,
  texto,
  children,
  className,
}: {
  propia: boolean;
  autor: string;
  fecha: string;
  texto: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[min(36rem,90%)] space-y-2 rounded-2xl px-4 py-3",
        propia ? "rounded-br-sm bg-main text-on-main" : "rounded-bl-sm border bg-surface",
        className,
      )}
    >
      <p className={cn("text-xs", propia ? "opacity-85" : "text-muted-foreground")}>
        <span className="font-semibold">{autor}</span> · {formatearFecha(fecha)}
      </p>
      <p className="break-words whitespace-pre-wrap">{texto}</p>
      {children}
    </div>
  );
}
