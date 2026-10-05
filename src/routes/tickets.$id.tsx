import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Bot, Loader2, Lock, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Protected } from "@/components/portal/AppShell";
import { EstadoBadge, PrioridadBadge } from "@/components/portal/Badges";
import { FileDrop, type Archivo } from "@/components/portal/FileDrop";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fechaHora } from "@/lib/format";
import { ESTADOS, PRIORIDADES, type Adjunto, type EntradaHistorial, type Estado, type Me, type Prioridad } from "@/lib/types";

export const Route = createFileRoute("/tickets/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} · Portal de Soporte BI` },
      { name: "description", content: `Detalle y seguimiento del ticket ${params.id}.` },
      { property: "og:title", content: `${params.id} · Portal de Soporte BI` },
      { property: "og:description", content: `Detalle y seguimiento del ticket ${params.id}.` },
    ],
  }),
  component: () => (
    <Protected>
      <Detalle />
    </Protected>
  ),
});

function Detalle() {
  const { id } = Route.useParams();
  const { me } = useSession() as { me: Me };
  const soporte = me.rol === "soporte";
  const qc = useQueryClient();
  const [zoom, setZoom] = useState<Adjunto | null>(null);
  const key = ["ticket", id, me.rol];
  const { data: t, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.getTicket(id) });

  const refresh = () => qc.invalidateQueries();
  const onError = (e: Error) => toast.error(e.message);

  const patch = useMutation({
    mutationFn: (b: { estado?: Estado; prioridad?: Prioridad }) => api.patchTicket(id, b),
    onSuccess: () => { toast.success("Ticket actualizado"); refresh(); },
    onError,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-main" /></div>;
  if (error || !t)
    return (
      <div className="card-soft p-8 text-center">
        <p className="text-destructive">{(error as Error)?.message ?? "No encontramos el ticket."}</p>
        <Link to="/" className="btn btn-secondary mt-4">Volver</Link>
      </div>
    );

  const historial = t.historial.filter((h) => soporte || h.tipo === "estado" || h.tipo === "comentario");

  return (
    <div className="space-y-6">
      <Link to="/" className="btn btn-ghost -ml-3 px-3 py-1.5"><ArrowLeft className="h-4 w-4" /> Mis tickets</Link>

      <section className="card-soft p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold text-main">{t.ticketId}</h1>
            <p className="mt-1 text-lg font-semibold">{t.tablero}{t.pagina && <span className="font-normal text-muted-foreground"> · {t.pagina}</span>}</p>
          </div>
          <div className="flex gap-2"><EstadoBadge estado={t.estado} /><PrioridadBadge prioridad={t.prioridad} /></div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Meta k="Tipo" v={t.tipo} />
          <Meta k="Urgencia" v={t.urgencia} />
          <Meta k="Alta" v={fechaHora(t.fechaAlta)} />
          <Meta k="Última actualización" v={fechaHora(t.ultimaActualizacion)} />
          {soporte && <Meta k="Cliente" v={t.cliente} />}
          {soporte && <Meta k="Reportó" v={t.autorNombre} />}
          {soporte && t.categoria && <Meta k="Categoría" v={t.categoria} />}
        </dl>

        {soporte && (
          <div className="mt-6 flex flex-wrap gap-4 rounded-xl bg-muted p-4">
            <div>
              <label htmlFor="cambiar-estado" className="mb-1 block text-xs font-semibold">Estado</label>
              <select id="cambiar-estado" className="field py-2" value={t.estado} disabled={patch.isPending} onChange={(e) => patch.mutate({ estado: e.target.value as Estado })}>
                {ESTADOS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cambiar-prio" className="mb-1 block text-xs font-semibold">Prioridad</label>
              <select id="cambiar-prio" className="field py-2" value={t.prioridad} disabled={patch.isPending} onChange={(e) => patch.mutate({ prioridad: e.target.value as Prioridad })}>
                {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            {t.resumenIA && (
              <div className="min-w-56 flex-1">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold"><Bot className="h-3.5 w-3.5" /> Resumen IA</p>
                <p className="text-sm text-muted-foreground">{t.resumenIA}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border-t pt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Descripción</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{t.descripcion}</p>
          <Thumbs adjuntos={t.adjuntos} onZoom={setZoom} />
        </div>
      </section>

      <section className="card-soft p-6 sm:p-8">
        <h2 className="mb-6 text-xl font-semibold">Historial</h2>
        <ol className="relative space-y-5 border-l pl-6">
          {historial.map((h) => <Entrada key={h.id} ticketId={id} h={h} onZoom={setZoom} onDone={refresh} />)}
        </ol>
        <Comentar ticketId={id} onDone={refresh} />
      </section>

      {zoom && (
        <div role="dialog" aria-modal aria-label={zoom.nombre} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4" onClick={() => setZoom(null)}>
          <button aria-label="Cerrar" className="absolute right-4 top-4 rounded-full bg-surface p-2"><X className="h-5 w-5" /></button>
          <img src={zoom.url ?? zoom.base64} alt={zoom.nombre} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function Thumbs({ adjuntos, onZoom }: { adjuntos?: Adjunto[] | undefined; onZoom: (a: Adjunto) => void }) {
  if (!adjuntos?.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {adjuntos.map((a, i) => (
        <button key={i} onClick={() => onZoom(a)} aria-label={`Ampliar ${a.nombre}`} className="rounded-lg">
          <img src={a.url ?? a.base64} alt={a.nombre} className="h-20 w-20 rounded-lg border object-cover" />
        </button>
      ))}
    </div>
  );
}

function Entrada({ ticketId, h, onZoom, onDone }: { ticketId: string; h: EntradaHistorial; onZoom: (a: Adjunto) => void; onDone: () => void }) {
  const interno = h.tipo === "nota_interna" || h.tipo === "borrador_respuesta";
  const ia = h.autor === "Claude";
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState(h.texto);
  const onError = (e: Error) => toast.error(e.message);
  const publicar = useMutation({ mutationFn: () => api.publishDraft(ticketId, h.id, texto), onSuccess: () => { toast.success("Respuesta publicada"); onDone(); }, onError });
  const descartar = useMutation({ mutationFn: () => api.deleteDraft(ticketId, h.id), onSuccess: () => { toast.success("Borrador descartado"); onDone(); }, onError });
  const busy = publicar.isPending || descartar.isPending;

  return (
    <li className="relative">
      <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-surface ${h.tipo === "estado" ? "bg-muted-foreground" : "bg-main"}`} aria-hidden />
      <div className={h.tipo === "estado" ? "" : `rounded-xl border p-4 ${interno ? "border-internal-border bg-internal" : "bg-surface"}`}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {ia && <Bot className="h-4 w-4 text-main" aria-hidden />}
          <span className="font-semibold">{h.autor}</span>
          <span className="text-muted-foreground">· {fechaHora(h.fecha)}</span>
          {interno && <span className="pill gap-1 bg-internal-border/50"><Lock className="h-3 w-3" /> Interno</span>}
          {h.tipo === "borrador_respuesta" && <span className="pill bg-accent text-main">Borrador de respuesta</span>}
          {ia && <span className="pill bg-accent text-main">Sugerido por IA</span>}
        </div>
        {editing ? (
          <>
            <label htmlFor={`edit-${h.id}`} className="sr-only">Editar borrador</label>
            <textarea id={`edit-${h.id}`} rows={4} className="field mt-2" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </>
        ) : (
          <p className={`mt-1 whitespace-pre-wrap ${h.tipo === "estado" ? "text-sm text-muted-foreground" : ""}`}>{texto}</p>
        )}
        <Thumbs adjuntos={h.adjuntos} onZoom={onZoom} />
        {h.tipo === "borrador_respuesta" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-secondary px-4 py-1.5" disabled={busy} onClick={() => setEditing((v) => !v)}>{editing ? "Listo" : "Editar"}</button>
            <button className="btn btn-primary px-4 py-1.5" disabled={busy || texto.trim().length === 0} onClick={() => publicar.mutate()}>
              {publicar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Publicar
            </button>
            <button className="btn btn-ghost px-4 py-1.5 text-destructive" disabled={busy} onClick={() => descartar.mutate()}>Descartar</button>
          </div>
        )}
      </div>
    </li>
  );
}

function Comentar({ ticketId, onDone }: { ticketId: string; onDone: () => void }) {
  const [texto, setTexto] = useState("");
  const [adjuntos, setAdjuntos] = useState<Archivo[]>([]);
  const [err, setErr] = useState("");
  const m = useMutation({
    mutationFn: () => api.addComment(ticketId, { texto: texto.trim(), adjuntos }),
    onSuccess: () => { setTexto(""); setAdjuntos([]); toast.success("Comentario agregado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      className="mt-8 space-y-3 border-t pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) { setErr("Escribí un comentario."); return; }
        setErr("");
        if (!m.isPending) m.mutate();
      }}
    >
      <label htmlFor="comentario" className="block font-display font-semibold">Agregar comentario</label>
      <textarea id="comentario" rows={3} className="field" value={texto} onChange={(e) => setTexto(e.target.value)} aria-invalid={!!err} aria-describedby="comentario-err" placeholder="Sumá información o respondé al equipo de soporte" />
      {err && <p id="comentario-err" className="text-sm text-destructive">{err}</p>}
      <FileDrop id="comentario-capturas" value={adjuntos} onChange={setAdjuntos} />
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar comentario
        </button>
      </div>
    </form>
  );
}
