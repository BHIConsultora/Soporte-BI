"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { ACCEPT_ADJUNTOS, MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, MAX_BYTES_REQUEST } from "@/dominio/adjuntos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatearTamano } from "@/lib/formato";

const EXT_OK = /\.(png|jpe?g|webp|pdf|xlsx|csv)$/i;

/** Valida en el navegador solo para dar feedback rápido; el servidor revisa el contenido real. */
function problema(actuales: File[], nuevos: File[]): string | null {
  const todos = [...actuales, ...nuevos];
  if (todos.length > MAX_ADJUNTOS) return `Podés adjuntar hasta ${MAX_ADJUNTOS} archivos.`;
  const malo = nuevos.find((f) => !EXT_OK.test(f.name));
  if (malo) return `"${malo.name}" no es un tipo permitido (PNG, JPG, WebP, PDF, XLSX o CSV).`;
  const grande = nuevos.find((f) => f.size > MAX_BYTES_ADJUNTO);
  if (grande) return `"${grande.name}" pesa más de 4 MB.`;
  if (todos.reduce((s, f) => s + f.size, 0) > MAX_BYTES_REQUEST) return "Entre todos los archivos no pueden superar 10 MB.";
  return null;
}

/** Nombre para imágenes pegadas desde el portapapeles (vienen como "image.png"). */
function renombrarPegado(f: File, i: number): File {
  if (!/^image\.(png|jpe?g|webp)$/i.test(f.name)) return f;
  const ext = f.name.split(".").pop();
  return new File([f], `captura-${Date.now()}-${i}.${ext}`, { type: f.type });
}

export function AdjuntosInput({
  archivos,
  onCambio,
  zonaPegado,
}: {
  archivos: File[];
  onCambio: (archivos: File[]) => void;
  /** Elemento donde Ctrl+V agrega capturas (por defecto, el documento). */
  zonaPegado?: React.RefObject<HTMLElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const idAyuda = useId();
  const agregar = (nuevos: File[]) => {
    if (nuevos.length === 0) return;
    const p = problema(archivos, nuevos);
    setError(p);
    if (!p) onCambio([...archivos, ...nuevos]);
  };

  // Lee siempre la última lista de archivos sin volver a suscribirse al pegado.
  const alPegar = useEffectEvent((e: Event) => {
    const files = [...((e as ClipboardEvent).clipboardData?.files ?? [])];
    if (files.length === 0) return;
    e.preventDefault();
    agregar(files.map(renombrarPegado));
  });

  useEffect(() => {
    const destino: HTMLElement | Document = zonaPegado?.current ?? document;
    const escuchar = (e: Event) => alPegar(e);
    destino.addEventListener("paste", escuchar);
    return () => destino.removeEventListener("paste", escuchar);
  }, [zonaPegado]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-center text-sm",
          arrastrando ? "border-main bg-accent" : "border-input",
        )}
      >
        <Paperclip className="size-5 text-main" aria-hidden />
        <p>
          Arrastrá archivos acá, pegá una captura con <kbd className="rounded border px-1 font-sans">Ctrl</kbd>+
          <kbd className="rounded border px-1 font-sans">V</kbd> o
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} aria-describedby={idAyuda}>
          Elegir archivos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ADJUNTOS}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            agregar([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <p id={idAyuda} className="text-xs text-muted-foreground">
          Hasta {MAX_ADJUNTOS} archivos de 4 MB: imágenes, PDF, Excel (.xlsx) o CSV.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {archivos.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3" aria-label="Archivos adjuntos">
          {archivos.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border bg-surface p-2">
              <Vista archivo={f} />
              <div className="min-w-0 flex-1 text-xs">
                <p className="truncate font-semibold">{f.name}</p>
                <p className="text-muted-foreground">{formatearTamano(f.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Quitar ${f.name}`}
                onClick={() => onCambio(archivos.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Vista({ archivo }: { archivo: File }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const esImagen = archivo.type.startsWith("image/");
  // La URL blob: se crea y se libera junto con el elemento (no hace falta estado).
  useEffect(() => {
    if (!esImagen || !imgRef.current) return;
    const u = URL.createObjectURL(archivo);
    imgRef.current.src = u;
    return () => URL.revokeObjectURL(u);
  }, [archivo, esImagen]);
  if (esImagen) {
    // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
    return <img ref={imgRef} alt="" className="size-10 rounded-lg bg-muted object-cover" />;
  }
  return <FileText className="size-10 shrink-0 p-2 text-main" aria-hidden />;
}
