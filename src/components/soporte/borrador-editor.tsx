"use client";

import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { TEXTO_MAX } from "@/dominio/esquemas";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";
import { Aviso, Label, Textarea } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";

/** Borrador de Claude editable. Publicar exige confirmación: lo va a ver el cliente. */
export function BorradorEditor({ ticketId, borradorId, textoInicial }: { ticketId: string; borradorId: number; textoInicial: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoInicial);
  const [confirmar, setConfirmar] = useState<"publicar" | "descartar" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const ejecutar = async () => {
    setOcupado(true);
    const url = `/api/tickets/${ticketId}/borradores/${borradorId}`;
    const r =
      confirmar === "publicar"
        ? await llamarApi(`${url}/publicar`, { method: "POST", json: { texto } })
        : await llamarApi(url, { method: "DELETE" });
    setOcupado(false);
    setConfirmar(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="sr-only">
        Texto del borrador
      </Label>
      <Textarea id={id} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={TEXTO_MAX} rows={5} className="bg-surface" />
      <Aviso tipo="error">{error}</Aviso>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirmar("descartar")}>
          <Trash2 aria-hidden />
          Descartar
        </Button>
        <Button size="sm" onClick={() => setConfirmar("publicar")} disabled={!texto.trim()}>
          <Send aria-hidden />
          Publicar
        </Button>
      </div>
      <Confirmar
        abierto={confirmar === "publicar"}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Publicar la respuesta?"
        descripcion="Esto lo va a ver el cliente y le llega por correo. Revisá que el texto esté bien."
        textoConfirmar="Publicar"
        onConfirmar={ejecutar}
        ocupado={ocupado}
      />
      <Confirmar
        abierto={confirmar === "descartar"}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Descartar el borrador?"
        descripcion="El borrador queda en el historial como descartado y el cliente no lo ve."
        textoConfirmar="Descartar"
        onConfirmar={ejecutar}
        ocupado={ocupado}
      />
    </div>
  );
}
