import { Download } from "lucide-react";
import type { AdjuntoDTO } from "@/dominio/dto";
import { formatearTamano } from "@/lib/formato";

/** Links de descarga: siempre por el proxy autorizado `/api/adjuntos/:id`. */
export function AdjuntosLista({ adjuntos }: { adjuntos: AdjuntoDTO[] }) {
  if (adjuntos.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Archivos">
      {adjuntos.map((a) => (
        <li key={a.id}>
          <a
            href={`/api/adjuntos/${a.id}`}
            download
            className="inline-flex items-center gap-1.5 rounded-full border border-main/30 bg-surface px-3 py-1 text-xs text-main hover:bg-accent"
          >
            <Download className="size-3.5" aria-hidden />
            {a.nombre}
            <span className="text-muted-foreground">({formatearTamano(a.tamano)})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
