import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Protected } from "@/components/portal/AppShell";
import { FileDrop, type Archivo } from "@/components/portal/FileDrop";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { TIPOS, URGENCIAS, type Me, type Urgencia } from "@/lib/types";

export const Route = createFileRoute("/nuevo")({
  validateSearch: (s: Record<string, unknown>) => ({
    tablero: typeof s["tablero"] === "string" ? s["tablero"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nuevo reclamo · Portal de Soporte BI" },
      { name: "description", content: "Contanos qué pasó con tu tablero de Power BI." },
      { property: "og:title", content: "Nuevo reclamo · Portal de Soporte BI" },
      { property: "og:description", content: "Contanos qué pasó con tu tablero de Power BI." },
    ],
  }),
  component: () => (
    <Protected>
      <Nuevo />
    </Protected>
  ),
});

const urgDesc: Record<Urgencia, string> = {
  Baja: "Puede esperar",
  Media: "Me complica un poco",
  Alta: "Afecta mi trabajo",
  Crítica: "No puedo trabajar",
};

type Errors = Partial<Record<"tablero" | "tipo" | "descripcion" | "urgencia", string>>;

function Nuevo() {
  const { me } = useSession() as { me: Me };
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tablero, setTablero] = useState(search.tablero ?? "");
  const [pagina, setPagina] = useState("");
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState<Urgencia | "">("");
  const [adjuntos, setAdjuntos] = useState<Archivo[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  function validate(): Errors {
    const e: Errors = {};
    if (!tablero.trim()) e.tablero = "Indicá en qué tablero ves el problema.";
    if (!tipo) e.tipo = "Elegí el tipo de problema.";
    if (descripcion.trim().length < 20) e.descripcion = "Contanos un poco más (mínimo 20 caracteres).";
    if (!urgencia) e.urgencia = "Elegí qué tan urgente es.";
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (sending) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    try {
      const { ticketId } = await api.createTicket({
        tablero: tablero.trim(),
        pagina: pagina.trim(),
        tipo,
        descripcion: descripcion.trim(),
        urgencia: urgencia as Urgencia,
        adjuntos,
      });
      toast.success(`Recibimos tu reclamo ${ticketId}`, { description: "Te vamos a responder a la brevedad." });
      navigate({ to: "/tickets/$id", params: { id: ticketId } });
    } catch (err) {
      toast.error((err as Error).message);
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="btn btn-ghost -ml-3 mb-4 px-3 py-1.5"><ArrowLeft className="h-4 w-4" /> Mis tickets</Link>
      <h1 className="text-3xl font-semibold">Contanos qué pasó</h1>
      <p className="mt-2 text-muted-foreground">
        Vas a reportar como <strong className="text-foreground">{me.nombre}</strong> ({me.email}).
      </p>

      <form onSubmit={submit} noValidate className="card-soft mt-6 space-y-6 p-6 sm:p-8">
        <Field id="tablero" label="Tablero" required error={errors["tablero"]}>
          <input id="tablero" className="field" value={tablero} onChange={(e) => setTablero(e.target.value)} aria-invalid={!!errors["tablero"]} aria-describedby="tablero-err" placeholder="Ej.: Ventas por Región" />
        </Field>
        <Field id="pagina" label="Página o visual afectado">
          <input id="pagina" className="field" value={pagina} onChange={(e) => setPagina(e.target.value)} placeholder="Ej.: Resumen mensual · gráfico de barras" />
        </Field>
        <Field id="tipo" label="Tipo de problema" required error={errors.tipo}>
          <select id="tipo" className="field" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-invalid={!!errors.tipo} aria-describedby="tipo-err">
            <option value="">Elegí una opción</option>
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field id="descripcion" label="Descripción" required error={errors.descripcion} help="¿Qué ves, qué esperabas ver, qué filtros tenías aplicados?">
          <textarea id="descripcion" rows={5} className="field" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} aria-invalid={!!errors.descripcion} aria-describedby="descripcion-help descripcion-err" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Urgencia <span className="text-destructive">*</span></legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-describedby="urgencia-err">
            {URGENCIAS.map((u) => (
              <label key={u} className={`cursor-pointer rounded-xl border p-3 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-main ${urgencia === u ? "border-main bg-accent" : "hover:border-foreground/25"}`}>
                <input type="radio" name="urgencia" value={u} className="sr-only" checked={urgencia === u} onChange={() => setUrgencia(u)} />
                <span className="block font-display font-semibold">{u}</span>
                <span className="block text-xs text-muted-foreground">{urgDesc[u]}</span>
              </label>
            ))}
          </div>
          {errors.urgencia && <p id="urgencia-err" className="mt-1 text-sm text-destructive">{errors.urgencia}</p>}
        </fieldset>
        <Field id="capturas" label="Capturas">
          <FileDrop id="capturas" value={adjuntos} onChange={setAdjuntos} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Link to="/" className="btn btn-secondary">Cancelar</Link>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} {sending ? "Enviando…" : "Enviar reclamo"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, required, error, help, children }: { id: string; label: string; required?: boolean; error?: string | undefined; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} {required ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(opcional)</span>}
      </label>
      {help && <p id={`${id}-help`} className="mb-1.5 text-sm text-muted-foreground">{help}</p>}
      {children}
      {error && <p id={`${id}-err`} className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
