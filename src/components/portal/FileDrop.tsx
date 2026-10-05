import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

export interface Archivo {
  nombre: string;
  base64: string;
}

const MAX = 3;
const MAX_BYTES = 4 * 1024 * 1024;

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export function FileDrop({ id, value, onChange }: { id: string; value: Archivo[]; onChange: (v: Archivo[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");

  async function add(files: FileList | null) {
    if (!files) return;
    setError("");
    const next = [...value];
    for (const f of Array.from(files)) {
      if (next.length >= MAX) { setError(`Podés adjuntar hasta ${MAX} imágenes.`); break; }
      if (!f.type.startsWith("image/")) { setError(`"${f.name}" no es una imagen.`); continue; }
      if (f.size > MAX_BYTES) { setError(`"${f.name}" supera los 4 MB.`); continue; }
      next.push({ nombre: f.name, base64: await toBase64(f) });
    }
    onChange(next);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors ${drag ? "border-main bg-accent" : "border-input"}`}
      >
        <ImagePlus className="h-6 w-6 text-main" aria-hidden />
        <p className="text-muted-foreground">
          Arrastrá imágenes acá o{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-semibold text-main underline">
            elegilas de tu equipo
          </button>
        </p>
        <p className="text-xs text-muted-foreground">Hasta 3 imágenes de 4 MB cada una</p>
        <input id={id} ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {value.map((a, i) => (
            <li key={i} className="relative">
              <img src={a.base64} alt={a.nombre} className="h-20 w-20 rounded-lg border object-cover" />
              <button
                type="button"
                aria-label={`Quitar ${a.nombre}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
