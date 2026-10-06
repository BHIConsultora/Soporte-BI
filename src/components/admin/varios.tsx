"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Feriado, SolicitudAcceso } from "@/dominio/entidades";
import { Button } from "@/components/ui/button";
import { Aviso, Ayuda, Input, Label } from "@/components/ui/form";
import { formatearFecha } from "@/lib/fechas";
import { BotonCopiar, useGuardar } from "./comun";

export function AdminSolicitudes({ solicitudes }: { solicitudes: SolicitudAcceso[] }) {
  const { guardar, ocupado, error } = useGuardar();
  if (solicitudes.length === 0) return <p className="text-muted-foreground">No hay solicitudes de acceso.</p>;
  return (
    <div className="space-y-3">
      <Aviso tipo="error">{error}</Aviso>
      <ul className="grid gap-3" aria-label="Solicitudes de acceso">
        {solicitudes.map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">
                {s.nombre} · <span className="font-normal break-all">{s.email}</span>
              </p>
              <p className="text-xs break-all text-muted-foreground">
                {s.dominio ?? "sin dominio"} · Tenant {s.tenantId} · {formatearFecha(s.fecha)}
              </p>
            </div>
            {s.estado === "pendiente" ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={ocupado} onClick={() => guardar(`/api/admin/solicitudes/${s.id}`, "PATCH", { estado: "aprobada" })} aria-label={`Aprobar la solicitud de ${s.email}`}>
                  <Check aria-hidden />
                  Aprobar
                </Button>
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => guardar(`/api/admin/solicitudes/${s.id}`, "PATCH", { estado: "rechazada" })} aria-label={`Rechazar la solicitud de ${s.email}`}>
                  <X aria-hidden />
                  Rechazar
                </Button>
              </div>
            ) : (
              <span className={s.estado === "aprobada" ? "pill bg-st-resuelto text-st-resuelto-fg" : "pill bg-st-cerrado text-st-cerrado-fg"}>
                {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
              </span>
            )}
          </li>
        ))}
      </ul>
      <Ayuda>Al aprobar se crea el cliente con ese tenant. Después completá su nombre, referentes, áreas y tableros.</Ayuda>
    </div>
  );
}

export function AdminFeriados({ feriados }: { feriados: Feriado[] }) {
  const { guardar, ocupado, error } = useGuardar();
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await guardar("/api/admin/feriados", "POST", { fecha, descripcion })) {
            setFecha("");
            setDescripcion("");
          }
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="fe-fecha">Fecha</Label>
          <Input id="fe-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="fe-desc">Descripción</Label>
          <Input id="fe-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required maxLength={120} />
        </div>
        <Button type="submit" disabled={ocupado}>
          <Plus aria-hidden />
          Agregar
        </Button>
      </form>
      <Aviso tipo="error">{error}</Aviso>
      <ul className="card divide-y" aria-label="Feriados">
        {feriados.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-2">
            <span>
              <strong className="font-display">{f.fecha.split("-").reverse().join("/")}</strong> · {f.descripcion}
            </span>
            <Button variant="ghost" size="icon" disabled={ocupado} aria-label={`Quitar el feriado ${f.descripcion}`} onClick={() => guardar(`/api/admin/feriados/${f.id}`, "DELETE")}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Ayuda>Los feriados se descuentan del horario hábil para calcular los vencimientos (SLA).</Ayuda>
    </div>
  );
}

export function AdminConsentimiento({ link }: { link: string | null }) {
  return (
    <div className="card space-y-3 p-5">
      <p>
        Cuando una organización nueva entra por primera vez, un administrador de Microsoft 365 de esa organización tiene que dar su
        consentimiento a la app &quot;Soporte BI – Portal&quot;. Mandale este link:
      </p>
      {link ? (
        <>
          <code className="block rounded-xl bg-muted p-3 text-xs break-all">{link}</code>
          <BotonCopiar texto={link} etiqueta="Copiar link" />
        </>
      ) : (
        <Aviso tipo="error">En modo demo no hay app de Entra configurada. El link aparece cuando se carga PORTAL_CLIENT_ID.</Aviso>
      )}
    </div>
  );
}
