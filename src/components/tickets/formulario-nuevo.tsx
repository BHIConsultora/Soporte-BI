"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { TIPOS_TICKET, URGENCIAS, type TipoTicket, type Urgencia } from "@/dominio/catalogos";
import { DESCRIPCION_MAX, DESCRIPCION_MIN, nuevoTicketSchema, type NuevoTicketInput } from "@/dominio/esquemas";
import { AdjuntosInput } from "@/components/tickets/adjuntos-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Aviso, Ayuda, ErrorCampo, Input, Label, Select, Textarea } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";
import { cn } from "@/lib/utils";
import type { TableroDTO } from "@/servicios/tableros";

const AYUDA_TIPO: Record<TipoTicket, string> = {
  "Dato incorrecto": "Contanos qué número ves, cuál esperabas y de dónde sale (filtros, fecha, página).",
  "El tablero no se actualiza": "¿Desde cuándo ves datos viejos? ¿Qué fecha muestra la última actualización?",
  "Acceso / permisos": "¿Quién no puede entrar y qué mensaje le aparece?",
  "Error visual o de carga": "¿Qué gráfico falla y en qué dispositivo o navegador? Una captura ayuda mucho.",
  "Pedido de mejora": "Contanos qué te gustaría ver y para qué lo usarías.",
  Consulta: "Escribí tu pregunta con el mayor detalle posible.",
  Otro: "Contanos qué pasa con el mayor detalle posible.",
};

const AYUDA_URGENCIA: Record<Urgencia, string> = {
  Baja: "Puede esperar: no frena tu trabajo.",
  Media: "Te complica, pero tenés cómo seguir.",
  Alta: "Te frena una tarea importante.",
  Crítica: "Nadie puede usar el tablero o hay una decisión urgente en juego.",
};

const CLAVE_BORRADOR = "sbi:borrador-nuevo";

type Valores = Omit<NuevoTicketInput, "tipo" | "urgencia"> & { tipo: TipoTicket | ""; urgencia: Urgencia | "" };

function leerBorrador(): Partial<Valores> | null {
  try {
    const raw = window.localStorage.getItem(CLAVE_BORRADOR);
    return raw ? (JSON.parse(raw) as Partial<Valores>) : null;
  } catch {
    return null;
  }
}

function guardarBorrador(v: Partial<Valores>) {
  try {
    window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(v));
  } catch {
    // Sin almacenamiento local (modo privado): el formulario funciona igual.
  }
}

function borrarBorrador() {
  try {
    window.localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    // idem
  }
}

interface Props {
  tableros: TableroDTO[];
  /** Tablero validado en el servidor (pertenece al cliente) o `null`. */
  tableroInicial: string | null;
  paginaInicial: string | null;
  /** `ctx` ya validado, serializado. */
  contexto: string | null;
  contextoVisible: Record<string, string> | null;
}

export function FormularioNuevo({ tableros, tableroInicial, paginaInicial, contexto, contextoVisible }: Props) {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const [cambiarTablero, setCambiarTablero] = useState(!tableroInicial);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(nuevoTicketSchema) as never,
    defaultValues: {
      tableroId: tableroInicial ?? "",
      pagina: paginaInicial ?? "",
      tipo: "",
      descripcion: "",
      urgencia: "",
      contexto: contexto ?? undefined,
    },
  });

  const valores = useWatch({ control });
  const tablero = tableros.find((t) => t.tableroId === valores.tableroId);

  // Restaurar el borrador guardado (sin pisar el tablero que vino del link de Power BI).
  useEffect(() => {
    const b = leerBorrador();
    if (!b || (!b.descripcion && !b.tipo)) return;
    if (b.tipo) setValue("tipo", b.tipo);
    if (b.urgencia) setValue("urgencia", b.urgencia);
    if (b.descripcion) setValue("descripcion", b.descripcion);
    if (!tableroInicial && b.tableroId && tableros.some((t) => t.tableroId === b.tableroId)) {
      setValue("tableroId", b.tableroId);
      if (b.pagina) setValue("pagina", b.pagina);
    }
    // localStorage solo existe en el navegador: leerlo después de montar es el caso de uso de un effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBorradorRestaurado(true);
  }, [setValue, tableroInicial, tableros]);

  useEffect(() => {
    if (creado) return;
    const { tableroId, pagina, tipo, descripcion, urgencia } = valores;
    if (tipo || descripcion) guardarBorrador({ tableroId, pagina, tipo, descripcion, urgencia });
  }, [valores, creado]);

  const enviar = handleSubmit(async (datos) => {
    setErrorEnvio(null);
    const form = new FormData();
    for (const [k, v] of Object.entries(datos)) if (v !== undefined && v !== "") form.append(k, String(v));
    for (const f of archivos) form.append("adjuntos", f);
    const r = await llamarApi<{ ticketId: string }>("/api/tickets", { method: "POST", form });
    if (!r.ok) {
      setErrorEnvio(r.error);
      return;
    }
    borrarBorrador();
    setCreado(r.datos.ticketId);
    window.scrollTo({ top: 0 });
  });

  if (creado) {
    return (
      <Card className="space-y-4 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-st-resuelto-fg" aria-hidden />
        <h2 className="font-display text-2xl font-semibold text-main">¡Listo! Recibimos tu reclamo</h2>
        <p>
          Tu número es <strong className="font-display text-lg">{creado}</strong>. Te vamos a avisar por correo cuando tengamos novedades.
        </p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href={`/tickets/${creado}`}>Ver el reclamo</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreado(null);
              setArchivos([]);
              reset({ tableroId: valores.tableroId ?? "", pagina: "", tipo: "", descripcion: "", urgencia: "", contexto: undefined });
            }}
          >
            Cargar otro
          </Button>
        </div>
      </Card>
    );
  }

  const largo = valores.descripcion?.trim().length ?? 0;

  return (
    <form ref={formRef} onSubmit={enviar} noValidate className="space-y-6">
      {borradorRestaurado && (
        <Aviso tipo="ok">
          Recuperamos lo que habías escrito.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              borrarBorrador();
              reset({ tableroId: tableroInicial ?? "", pagina: paginaInicial ?? "", tipo: "", descripcion: "", urgencia: "", contexto: contexto ?? undefined });
              setBorradorRestaurado(false);
            }}
          >
            Empezar de cero
          </button>
        </Aviso>
      )}

      {/* Tablero */}
      <Card className="space-y-4">
        <h2 className="font-display text-lg font-semibold">¿Sobre qué tablero?</h2>
        {!cambiarTablero && tablero ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-display text-main">
              <LayoutDashboard className="size-4" aria-hidden />
              {tablero.nombre}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCambiarTablero(true)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="tableroId">Tablero</Label>
            {tableros.length === 0 ? (
              <Aviso tipo="error">Tu organización todavía no tiene tableros cargados. Avisale al equipo de BHI.</Aviso>
            ) : (
              <Select
                id="tableroId"
                {...register("tableroId", { onChange: () => setValue("pagina", "") })}
                aria-invalid={!!errors.tableroId}
                aria-describedby="tableroId-error"
              >
                <option value="">Elegí un tablero</option>
                {tableros.map((t) => (
                  <option key={t.tableroId} value={t.tableroId}>
                    {t.nombre}
                  </option>
                ))}
              </Select>
            )}
            <ErrorCampo id="tableroId-error">{errors.tableroId && "Elegí un tablero."}</ErrorCampo>
          </div>
        )}

        {tablero && (
          <div className="space-y-1.5">
            <Label htmlFor="pagina">
              Página <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            {tablero.paginas.length > 0 ? (
              <Select id="pagina" {...register("pagina")}>
                <option value="">No sé / varias</option>
                {tablero.paginas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="pagina" {...register("pagina")} maxLength={100} placeholder="Ej.: resumen" />
            )}
          </div>
        )}

        {contextoVisible && (
          <details className="text-sm">
            <summary className="cursor-pointer text-main">Filtros que tenías aplicados en Power BI</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {Object.entries(contextoVisible).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </Card>

      {/* Tipo */}
      <Card className="space-y-4">
        <fieldset className="space-y-3" aria-describedby="tipo-error">
          <legend className="font-display text-lg font-semibold">¿Qué pasa?</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_TICKET.map((t) => (
              <label
                key={t}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-2 text-sm has-focus-visible:outline-2 has-focus-visible:outline-main",
                  valores.tipo === t ? "border-main bg-main text-on-main" : "border-main/30 bg-surface text-main hover:bg-accent",
                )}
              >
                <input type="radio" value={t} {...register("tipo")} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
          <ErrorCampo id="tipo-error">{errors.tipo && "Elegí qué tipo de problema es."}</ErrorCampo>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Contanos el detalle</Label>
          <Ayuda id="descripcion-ayuda">{valores.tipo ? AYUDA_TIPO[valores.tipo] : "Cuanto más detalle, más rápido lo resolvemos."}</Ayuda>
          <Textarea
            id="descripcion"
            rows={6}
            maxLength={DESCRIPCION_MAX}
            {...register("descripcion")}
            aria-invalid={!!errors.descripcion}
            aria-describedby="descripcion-ayuda descripcion-contador descripcion-error"
          />
          <p id="descripcion-contador" className="text-right text-xs text-muted-foreground">
            {largo < DESCRIPCION_MIN ? `Faltan ${DESCRIPCION_MIN - largo} caracteres` : `${largo} / ${DESCRIPCION_MAX}`}
          </p>
          <ErrorCampo id="descripcion-error">{errors.descripcion?.message}</ErrorCampo>
        </div>
      </Card>

      {/* Urgencia */}
      <Card className="space-y-3">
        <fieldset className="space-y-3" aria-describedby="urgencia-ayuda urgencia-error">
          <legend className="font-display text-lg font-semibold">¿Qué tan urgente es?</legend>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:grid-cols-4">
            {URGENCIAS.map((u) => (
              <label
                key={u}
                className={cn(
                  "cursor-pointer rounded-xl px-3 py-2 text-center font-display text-sm has-focus-visible:outline-2 has-focus-visible:outline-main",
                  valores.urgencia === u ? "bg-main text-on-main shadow" : "text-foreground hover:bg-surface",
                )}
              >
                <input type="radio" value={u} {...register("urgencia")} className="sr-only" />
                {u}
              </label>
            ))}
          </div>
          <Ayuda id="urgencia-ayuda">
            {valores.urgencia ? AYUDA_URGENCIA[valores.urgencia] : "Elegí la opción que mejor describa el impacto en tu trabajo."}
          </Ayuda>
          <ErrorCampo id="urgencia-error">{errors.urgencia && "Elegí la urgencia."}</ErrorCampo>
        </fieldset>
      </Card>

      {/* Adjuntos */}
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">
          Capturas o archivos <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
        </h2>
        <AdjuntosInput archivos={archivos} onCambio={setArchivos} zonaPegado={formRef} />
      </Card>

      <Aviso tipo="error">{errorEnvio}</Aviso>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Enviando…" : "Enviar reclamo"}
        </Button>
      </div>
    </form>
  );
}
