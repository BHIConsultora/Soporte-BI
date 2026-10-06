"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import type { TipoCliente } from "@/dominio/catalogos";
import type { Cliente } from "@/dominio/entidades";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Aviso, Ayuda, Input, Label, Textarea } from "@/components/ui/form";
import { llamarApi } from "@/lib/api-cliente";
import { EstadoActivo, textoEmails, useGuardar } from "./comun";

export function AdminClientes({ clientes }: { clientes: Cliente[] }) {
  const [editando, setEditando] = useState<Cliente | "nuevo" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nuevo")}>
          <Plus aria-hidden />
          Nuevo cliente
        </Button>
      </div>
      <ul className="grid gap-3 md:grid-cols-2" aria-label="Clientes">
        {clientes.map((c) => (
          <li key={c.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display font-semibold">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {c.tipo === "tenant" ? "Tenant propio" : "Satélite (grupo en BHI)"} · {c.dominio ?? "sin dominio"}
                </p>
              </div>
              <EstadoActivo activo={c.activo} />
            </div>
            <p className="text-xs break-all text-muted-foreground">
              {c.tipo === "tenant" ? `TenantId: ${c.tenantId}` : `GrupoId: ${c.grupoId}`}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Referentes: </span>
              {c.referentesGenerales.length ? textoEmails(c.referentesGenerales) : "ninguno"}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setEditando(c)} aria-label={`Editar ${c.nombre}`}>
              <Pencil aria-hidden />
              Editar
            </Button>
          </li>
        ))}
      </ul>
      <Dialogo abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === "nuevo" ? "Nuevo cliente" : "Editar cliente"}>
        {editando !== null && <FormCliente cliente={editando === "nuevo" ? null : editando} onListo={() => setEditando(null)} />}
      </Dialogo>
    </div>
  );
}

function FormCliente({ cliente, onListo }: { cliente: Cliente | null; onListo: () => void }) {
  const { guardar, ocupado, error, setError } = useGuardar();
  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo ?? "tenant");
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [dominio, setDominio] = useState(cliente?.dominio ?? "");
  const [tenantId, setTenantId] = useState(cliente?.tenantId ?? "");
  const [grupoId, setGrupoId] = useState(cliente?.grupoId ?? "");
  const [referentes, setReferentes] = useState(textoEmails(cliente?.referentesGenerales ?? []));
  const [notas, setNotas] = useState(cliente?.notasContexto ?? "");
  const [activo, setActivo] = useState(cliente?.activo ?? true);
  const [buscando, setBuscando] = useState(false);

  const buscarTenant = async () => {
    setBuscando(true);
    const r = await llamarApi<{ tenantId: string }>("/api/admin/resolver-tenant", { method: "POST", json: { dominio } });
    setBuscando(false);
    if (!r.ok) return setError(r.error);
    setError(null);
    setTenantId(r.datos.tenantId);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const json = {
          nombre,
          tipo,
          tenantId: tipo === "tenant" ? tenantId.trim() || null : null,
          grupoId: tipo === "satelite" ? grupoId.trim() || null : null,
          dominio: dominio.trim() || null,
          activo,
          referentesGenerales: referentes,
          notasContexto: notas,
        };
        const okk = cliente ? await guardar(`/api/admin/clientes/${cliente.id}`, "PATCH", json) : await guardar("/api/admin/clientes", "POST", json);
        if (okk) onListo();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Tipo</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="tipo" className="accent-main" checked={tipo === "tenant"} onChange={() => setTipo("tenant")} />
            Con tenant propio
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="tipo" className="accent-main" checked={tipo === "satelite"} onChange={() => setTipo("satelite")} />
            Satélite (cuentas en el tenant de BHI)
          </label>
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="cl-nombre">Nombre</Label>
        <Input id="cl-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cl-dominio">Dominio</Label>
        <div className="flex gap-2">
          <Input id="cl-dominio" value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="empresa.com.ar" maxLength={120} />
          {tipo === "tenant" && (
            <Button type="button" variant="outline" onClick={buscarTenant} disabled={!dominio.trim() || buscando}>
              <Search aria-hidden />
              {buscando ? "Buscando…" : "Buscar TenantId"}
            </Button>
          )}
        </div>
      </div>
      {tipo === "tenant" ? (
        <div className="space-y-1">
          <Label htmlFor="cl-tenant">TenantId</Label>
          <Input id="cl-tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
          <Ayuda>Se completa solo con &quot;Buscar TenantId&quot; a partir del dominio.</Ayuda>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="cl-grupo">GrupoId (grupo de seguridad de Entra)</Label>
          <Input id="cl-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
          <Ayuda>El grupo tiene que estar asignado a la app &quot;Soporte BI – Portal&quot;.</Ayuda>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="cl-ref">Referentes generales</Label>
        <Textarea id="cl-ref" value={referentes} onChange={(e) => setReferentes(e.target.value)} rows={2} placeholder="ana@empresa.com; juan@empresa.com" />
        <Ayuda>Emails separados por punto y coma. Ven todos los reclamos de la organización.</Ayuda>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cl-notas">Notas de contexto (para soporte y Claude)</Label>
        <Textarea id="cl-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={4000} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-main" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activo
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
