"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { llamarApi } from "@/lib/api-cliente";

/** Envía un cambio a la API de admin y refresca la pantalla. Devuelve el error (o null). */
export function useGuardar() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (url: string, method: "POST" | "PATCH" | "DELETE", json?: unknown): Promise<boolean> => {
    setOcupado(true);
    setError(null);
    const r = await llamarApi(url, { method, json });
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    router.refresh();
    return true;
  };

  return { guardar, ocupado, error, setError };
}

export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          setCopiado(false);
        }
      }}
    >
      {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copiado ? "¡Copiado!" : etiqueta}</span>
    </Button>
  );
}

export function EstadoActivo({ activo }: { activo: boolean }) {
  return <span className={activo ? "pill bg-st-resuelto text-st-resuelto-fg" : "pill bg-st-cerrado text-st-cerrado-fg"}>{activo ? "Activo" : "Inactivo"}</span>;
}

export const textoEmails = (emails: string[]) => emails.join("; ");
