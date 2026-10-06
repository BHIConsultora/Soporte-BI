"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DIAS_PARA_REABRIR } from "@/dominio/catalogos";
import { Button } from "@/components/ui/button";
import { Confirmar } from "@/components/ui/dialogo";
import { Aviso } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";

export function AccionesCliente({ ticketId, puedeResolver, puedeReabrir }: { ticketId: string; puedeResolver: boolean; puedeReabrir: boolean }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState<"resolver" | "reabrir" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!puedeResolver && !puedeReabrir) return null;

  const ejecutar = async () => {
    if (!confirmar) return;
    setOcupado(true);
    const r = await llamarApi(`/api/tickets/${ticketId}/${confirmar}`, { method: "POST" });
    setOcupado(false);
    setConfirmar(null);
    if (!r.ok) return setError(r.error);
    setError(null);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {puedeResolver && (
          <Button variant="outline" onClick={() => setConfirmar("resolver")}>
            <CheckCircle2 aria-hidden />
            Se resolvió
          </Button>
        )}
        {puedeReabrir && (
          <Button variant="outline" onClick={() => setConfirmar("reabrir")}>
            <RotateCcw aria-hidden />
            Reabrir
          </Button>
        )}
      </div>
      <Aviso tipo="error">{error}</Aviso>
      <Confirmar
        abierto={confirmar === "resolver"}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Se resolvió tu problema?"
        descripcion={`Vamos a marcar el reclamo como resuelto. Si vuelve a pasar, lo podés reabrir durante ${DIAS_PARA_REABRIR} días.`}
        textoConfirmar="Sí, se resolvió"
        onConfirmar={ejecutar}
        ocupado={ocupado}
      />
      <Confirmar
        abierto={confirmar === "reabrir"}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Reabrir el reclamo?"
        descripcion="El equipo de BHI lo va a volver a revisar. Contanos en un mensaje qué sigue pasando."
        textoConfirmar="Reabrir"
        onConfirmar={ejecutar}
        ocupado={ocupado}
      />
    </div>
  );
}
