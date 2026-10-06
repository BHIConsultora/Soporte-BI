"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Modal con `<dialog>` nativo: foco atrapado, fondo inerte y Escape cierra sin JS extra.
 * Se prefiere a Radix Dialog porque este inyecta `<style>` sin nonce (CSP).
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDesc = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDesc : undefined}
      onClose={onCerrar}
      onClick={(e) => {
        // Click en el fondo (fuera del contenido) cierra.
        if (e.target === ref.current) onCerrar();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={idTitulo} className="font-display text-lg font-semibold text-main">
            {titulo}
          </h2>
          <Button variant="ghost" size="icon" className="-mt-2 -mr-2 size-9" onClick={onCerrar} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>
        {descripcion && (
          <p id={idDesc} className="text-muted-foreground">
            {descripcion}
          </p>
        )}
        {abierto && children}
      </div>
    </dialog>
  );
}

/** Confirmación de una acción delicada (p. ej. publicar algo que verá el cliente). */
export function Confirmar({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  textoConfirmar,
  onConfirmar,
  ocupado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion: string;
  textoConfirmar: string;
  onConfirmar: () => void;
  ocupado?: boolean;
}) {
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={titulo} descripcion={descripcion}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button onClick={onConfirmar} disabled={ocupado} autoFocus>
          {ocupado ? "Un momento…" : textoConfirmar}
        </Button>
      </div>
    </Dialogo>
  );
}
