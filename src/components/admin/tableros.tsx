"use client";

import { Code2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Area, Cliente, Tablero } from "@/dominio/entidades";
import { generarMedidaDax, type FiltroDax } from "@/dominio/dax";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Aviso, Ayuda, Input, Label, Select } from "@/components/ui/form";
import { BotonCopiar, EstadoActivo, useGuardar } from "./comun";

interface Props {
  tableros: Tablero[];
  areas: Area[];
  clientes: Cliente[];
  appUrl: string;
}

export function AdminTableros({ tableros, areas, clientes, appUrl }: Props) {
  const [editando, setEditando] = useState<Tablero | "nuevo" | null>(null);
  const [dax, setDax] = useState<Tablero | null>(null);
  const nombreCliente = (id: number) => clientes.find((c) => c.id === id)?.nombre ?? "—";
  const nombreArea = (id: number) => areas.find((a) => a.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nuevo")}>
          <Plus aria-hidden />
          Nuevo tablero
        </Button>
      </div>
      <ul className="grid gap-3 md:grid-cols-2" aria-label="Tableros">
        {tableros.map((t) => (
          <li key={t.tableroId} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display font-semibold">{t.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{t.tableroId}</code> · {nombreCliente(t.clienteId)}
                </p>
              </div>
              <EstadoActivo activo={t.activo} />
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Áreas: </span>
              {t.areaIds.length ? t.areaIds.map(nombreArea).join(", ") : "ninguna"}
            </p>
            {t.paginas.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Páginas: </span>
                {t.paginas.join(", ")}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditando(t)} aria-label={`Editar ${t.nombre}`}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDax(t)} aria-label={`Medida DAX de ${t.nombre}`}>
                <Code2 aria-hidden />
                Medida DAX
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialogo abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === "nuevo" ? "Nuevo tablero" : "Editar tablero"}>
        {editando !== null && (
          <FormTablero tablero={editando === "nuevo" ? null : editando} clientes={clientes} areas={areas} onListo={() => setEditando(null)} />
        )}
      </Dialogo>
      <Dialogo
        abierto={dax !== null}
        onCerrar={() => setDax(null)}
        titulo={`Botón "Reportar un problema" · ${dax?.nombre ?? ""}`}
        descripcion="Creá esta medida en el modelo y usala como URL web (formato condicional) de un botón."
      >
        {dax && <GeneradorDax tablero={dax} appUrl={appUrl} />}
      </Dialogo>
    </div>
  );
}

function FormTablero({ tablero, clientes, areas, onListo }: { tablero: Tablero | null; clientes: Cliente[]; areas: Area[]; onListo: () => void }) {
  const { guardar, ocupado, error } = useGuardar();
  const [clienteId, setClienteId] = useState(tablero?.clienteId ?? clientes[0]?.id ?? 0);
  const [tableroId, setTableroId] = useState(tablero?.tableroId ?? "");
  const [nombre, setNombre] = useState(tablero?.nombre ?? "");
  const [areaIds, setAreaIds] = useState<number[]>(tablero?.areaIds ?? []);
  const [paginas, setPaginas] = useState((tablero?.paginas ?? []).join(", "));
  const [activo, setActivo] = useState(tablero?.activo ?? true);
  const areasCliente = areas.filter((a) => a.clienteId === clienteId);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const json = {
          tableroId: tableroId.trim(),
          nombre,
          clienteId,
          areaIds,
          paginas: paginas
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
          activo,
        };
        const ok = tablero
          ? await guardar(`/api/admin/tableros/${tablero.tableroId}`, "PATCH", json)
          : await guardar("/api/admin/tableros", "POST", json);
        if (ok) onListo();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="tb-cliente">Cliente</Label>
        <Select
          id="tb-cliente"
          value={clienteId}
          onChange={(e) => {
            setClienteId(Number(e.target.value));
            setAreaIds([]);
          }}
          disabled={!!tablero}
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tb-nombre">Nombre</Label>
        <Input id="tb-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tb-id">Identificador</Label>
        <Input id="tb-id" value={tableroId} onChange={(e) => setTableroId(e.target.value)} placeholder="ventas-dtc" disabled={!!tablero} required />
        <Ayuda>Minúsculas, números y guiones. No se puede cambiar después: lo usan los botones de Power BI.</Ayuda>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Áreas</legend>
        {areasCliente.length === 0 ? (
          <Ayuda>Este cliente no tiene áreas cargadas.</Ayuda>
        ) : (
          <div className="flex flex-wrap gap-2">
            {areasCliente.map((a) => (
              <label key={a.id} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-checked:border-main has-checked:bg-accent">
                <input
                  type="checkbox"
                  className="accent-main"
                  checked={areaIds.includes(a.id)}
                  onChange={(e) => setAreaIds(e.target.checked ? [...areaIds, a.id] : areaIds.filter((x) => x !== a.id))}
                />
                {a.nombre}
              </label>
            ))}
          </div>
        )}
        <Ayuda>Un tablero puede estar en varias áreas: lo ven los líderes de todas.</Ayuda>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="tb-paginas">
          Páginas <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="tb-paginas" value={paginas} onChange={(e) => setPaginas(e.target.value)} placeholder="resumen, por-vendedor" />
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

function GeneradorDax({ tablero, appUrl }: { tablero: Tablero; appUrl: string }) {
  const [pagina, setPagina] = useState("");
  const [filtros, setFiltros] = useState<FiltroDax[]>([]);
  const medida = generarMedidaDax({ appUrl, tableroId: tablero.tableroId, pagina: pagina || null, filtros });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="dax-pagina">Página</Label>
        {tablero.paginas.length > 0 ? (
          <Select id="dax-pagina" value={pagina} onChange={(e) => setPagina(e.target.value)}>
            <option value="">Sin página</option>
            {tablero.paginas.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        ) : (
          <Input id="dax-pagina" value={pagina} onChange={(e) => setPagina(e.target.value.replace(/[^a-z0-9-]/g, ""))} placeholder="resumen" />
        )}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Filtros a enviar (opcional)</legend>
        {filtros.map((f, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={`Nombre del filtro ${i + 1}`}
              value={f.clave}
              placeholder="Zona"
              onChange={(e) => setFiltros(filtros.map((x, j) => (j === i ? { ...x, clave: e.target.value } : x)))}
            />
            <Input
              aria-label={`Columna del filtro ${i + 1}`}
              value={f.columna}
              placeholder="'Dim Zona'[Zona]"
              onChange={(e) => setFiltros(filtros.map((x, j) => (j === i ? { ...x, columna: e.target.value } : x)))}
            />
            <Button type="button" variant="ghost" size="icon" aria-label={`Quitar filtro ${i + 1}`} onClick={() => setFiltros(filtros.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setFiltros([...filtros, { clave: "", columna: "" }])} disabled={filtros.length >= 10}>
          <Plus aria-hidden />
          Agregar filtro
        </Button>
      </fieldset>
      <pre className="max-h-64 overflow-auto rounded-xl bg-foreground p-3 text-xs text-surface" aria-label="Medida DAX">
        <code>{medida}</code>
      </pre>
      <div className="flex justify-end">
        <BotonCopiar texto={medida} etiqueta="Copiar medida" />
      </div>
    </div>
  );
}
