"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { TEXTO_MAX } from "@/dominio/esquemas";
import { Button } from "@/components/ui/button";
import { Aviso, Label, Textarea } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";

/** Nota interna: nunca la ve el cliente. */
export function NotaForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!texto.trim()) return setError("Escribí la nota.");
        setOcupado(true);
        const r = await llamarApi(`/api/tickets/${ticketId}/notas`, { method: "POST", json: { texto } });
        setOcupado(false);
        if (!r.ok) return setError(r.error);
        setError(null);
        setTexto("");
        router.refresh();
      }}
    >
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Lock className="size-4" aria-hidden />
        Nota interna
      </Label>
      <p className="text-sm text-muted-foreground">Solo la ve el equipo de BHI.</p>
      <Textarea id={id} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={TEXTO_MAX} rows={3} className="bg-internal" />
      <Aviso tipo="error">{error}</Aviso>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={ocupado}>
          {ocupado ? "Guardando…" : "Agregar nota"}
        </Button>
      </div>
    </form>
  );
}
