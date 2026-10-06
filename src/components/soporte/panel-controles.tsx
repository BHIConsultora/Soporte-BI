"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ESTADOS, PRIORIDAD_DESCRIPCION, PRIORIDADES, type Estado, type Prioridad } from "@/dominio/catalogos";
import { Button } from "@/components/ui/button";
import { Aviso, Input, Label, Select } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";

interface Props {
  ticketId: string;
  estado: Estado;
  prioridad: Prioridad;
  asignadoA: string | null;
  yo: string;
  /** Emails sugeridos para asignar (equipo conocido). */
  equipo: string[];
}

export function PanelControles({ ticketId, estado: e0, prioridad: p0, asignadoA: a0, yo, equipo }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState(e0);
  const [prioridad, setPrioridad] = useState(p0);
  const [asignadoA, setAsignadoA] = useState(a0 ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cambios = {
    ...(estado !== e0 && { estado }),
    ...(prioridad !== p0 && { prioridad }),
    ...(asignadoA.trim().toLowerCase() !== (a0 ?? "") && { asignadoA: asignadoA.trim() ? asignadoA.trim().toLowerCase() : null }),
  };
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async (json: object) => {
    setOcupado(true);
    const r = await llamarApi(`/api/tickets/${ticketId}`, { method: "PATCH", json });
    setOcupado(false);
    if (!r.ok) return setAviso({ tipo: "error", texto: r.error });
    setAviso({ tipo: "ok", texto: "Cambios guardados." });
    router.refresh();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (hayCambios) void guardar(cambios);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="c-estado">Estado</Label>
        <Select id="c-estado" value={estado} onChange={(ev) => setEstado(ev.target.value as Estado)}>
          {ESTADOS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="c-prioridad">Prioridad</Label>
        <Select id="c-prioridad" value={prioridad} onChange={(ev) => setPrioridad(ev.target.value as Prioridad)}>
          {PRIORIDADES.map((x) => (
            <option key={x} value={x}>
              {x} · {PRIORIDAD_DESCRIPCION[x]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="c-asignado">Asignado a</Label>
        <div className="flex gap-2">
          <Input
            id="c-asignado"
            type="email"
            list="c-equipo"
            value={asignadoA}
            onChange={(ev) => setAsignadoA(ev.target.value)}
            placeholder="Sin asignar"
            autoComplete="off"
          />
          {a0 !== yo && (
            <Button type="button" variant="outline" disabled={ocupado} onClick={() => guardar({ asignadoA: yo })}>
              Tomar
            </Button>
          )}
        </div>
        <datalist id="c-equipo">
          {equipo.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <Aviso tipo={aviso?.tipo ?? "ok"}>{aviso?.texto}</Aviso>
      <Button type="submit" className="w-full" disabled={!hayCambios || ocupado}>
        {ocupado ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
