"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { Area, Cliente } from "@/dominio/entidades";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Aviso, Ayuda, Input, Label, Select, Textarea } from "@/components/ui/form";
import { EstadoActivo, textoEmails, useGuardar } from "./comun";

export function AdminAreas({ areas, clientes }: { areas: Area[]; clientes: Cliente[] }) {
  const [editando, setEditando] = useState<Area | "nueva" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nueva")}>
          <Plus aria-hidden />
          Nueva área
        </Button>
      </div>
      {clientes.map((c) => {
        const delCliente = areas.filter((a) => a.clienteId === c.id);
        if (delCliente.length === 0) return null;
        return (
          <section key={c.id} className="space-y-2" aria-label={`Áreas de ${c.nombre}`}>
            <h3 className="font-display font-semibold">{c.nombre}</h3>
            <ul className="grid gap-2 md:grid-cols-2">
              {delCliente.map((a) => (
                <li key={a.id} className="card flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{a.nombre}</p>
                    <p className="text-sm break-words text-muted-foreground">Líderes: {a.lideres.length ? textoEmails(a.lideres) : "ninguno"}</p>
                    <EstadoActivo activo={a.activo} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditando(a)} aria-label={`Editar área ${a.nombre} de ${c.nombre}`}>
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Dialogo abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === "nueva" ? "Nueva área" : "Editar área"}>
        {editando !== null && <FormArea area={editando === "nueva" ? null : editando} clientes={clientes} onListo={() => setEditando(null)} />}
      </Dialogo>
    </div>
  );
}

function FormArea({ area, clientes, onListo }: { area: Area | null; clientes: Cliente[]; onListo: () => void }) {
  const { guardar, ocupado, error } = useGuardar();
  const [clienteId, setClienteId] = useState(area?.clienteId ?? clientes[0]?.id ?? 0);
  const [nombre, setNombre] = useState(area?.nombre ?? "");
  const [lideres, setLideres] = useState(textoEmails(area?.lideres ?? []));
  const [activo, setActivo] = useState(area?.activo ?? true);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const json = { clienteId, nombre, lideres, activo };
        const ok = area ? await guardar(`/api/admin/areas/${area.id}`, "PATCH", json) : await guardar("/api/admin/areas", "POST", json);
        if (ok) onListo();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="ar-cliente">Cliente</Label>
        <Select id="ar-cliente" value={clienteId} onChange={(e) => setClienteId(Number(e.target.value))} disabled={!!area}>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ar-nombre">Nombre del área</Label>
        <Input id="ar-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ar-lideres">Líderes</Label>
        <Textarea id="ar-lideres" value={lideres} onChange={(e) => setLideres(e.target.value)} rows={2} />
        <Ayuda>Emails separados por punto y coma. Ven los reclamos de los tableros de esta área.</Ayuda>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-main" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activa
      </label>
      <Aviso tipo="error">{error}</Aviso>
      <div className="flex justify-end">
        <Button type="submit" disabled={ocupado}>
          {ocupado ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
