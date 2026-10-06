"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { TEXTO_MAX } from "@/dominio/esquemas";
import { Button } from "@/components/ui/button";
import { Aviso, Label, Textarea } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";
import { AdjuntosInput } from "./adjuntos-input";

/** Comentario visible (con adjuntos). Lo usan el autor del ticket y soporte. */
export function ResponderForm({
  ticketId,
  etiqueta = "Responder",
  ayuda,
}: {
  ticketId: string;
  etiqueta?: string;
  ayuda?: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!texto.trim()) {
          setError("Escribí un mensaje.");
          return;
        }
        setEnviando(true);
        setError(null);
        setOk(null);
        const form = new FormData();
        form.append("texto", texto);
        for (const f of archivos) form.append("adjuntos", f);
        const r = await llamarApi(`/api/tickets/${ticketId}/comentarios`, { method: "POST", form });
        setEnviando(false);
        if (!r.ok) return setError(r.error);
        setTexto("");
        setArchivos([]);
        setOk("Mensaje enviado.");
        router.refresh();
      }}
    >
      <Label htmlFor={id}>{etiqueta}</Label>
      {ayuda && <p className="text-sm text-muted-foreground">{ayuda}</p>}
      <Textarea id={id} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={TEXTO_MAX} rows={4} />
      <AdjuntosInput archivos={archivos} onCambio={setArchivos} zonaPegado={formRef} />
      <Aviso tipo="error">{error}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      <div className="flex justify-end">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
