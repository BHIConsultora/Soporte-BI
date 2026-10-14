import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { DEMO_BHI_TENANT_ID, PERSONAS_DEMO, crearDatosDemo, persona } from "@/repositorio/demo/datos";
import { AHORA } from "../servicios/helpers";

/**
 * Postgres en memoria (PGlite) con lo mínimo de Supabase que usa la migración:
 * roles `anon`/`authenticated`, `auth.users`, `auth.identities`, `auth.uid()` y `storage`.
 * Imita también los privilegios por defecto que Supabase da sobre `public`.
 */
const STUB_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create table auth.identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    provider text not null,
    provider_id text not null,
    identity_data jsonb not null,
    last_sign_in_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select on storage.objects to anon, authenticated;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const DIR_MIGRACIONES = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

export function leerMigraciones(): string[] {
  return readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(DIR_MIGRACIONES + f, "utf8"));
}

/** Base con la migración aplicada y cargada con los mismos datos del modo demo. */
export async function crearBaseDemo(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB_SUPABASE);
  for (const sql of leerMigraciones()) await db.exec(sql);
  await cargarDatosDemo(db);
  return db;
}

async function cargarDatosDemo(db: PGlite) {
  const d = crearDatosDemo(AHORA);
  const q = (sql: string, params: unknown[] = []) => db.query(sql, params);

  await q("insert into public.configuracion (bhi_tenant_id) values ($1)", [DEMO_BHI_TENANT_ID]);

  for (const p of PERSONAS_DEMO) {
    await q("insert into auth.users (id, email) values ($1, $2)", [p.oid, p.email]);
    await q("insert into auth.identities (user_id, provider, provider_id, identity_data) values ($1, 'azure', $2, $3)", [
      p.oid,
      p.oid,
      { iss: `https://login.microsoftonline.com/${p.tid}/v2.0`, email: p.email, full_name: p.nombre },
    ]);
  }

  for (const p of d.personalBhi) await q("insert into public.personal_bhi (email, rol, activo) values ($1, $2, $3)", [p.email, p.rol, p.activo]);

  for (const c of d.clientes) {
    await q(
      `insert into public.cliente (id, nombre, tipo, tenant_id, dominio, activo, referentes, notas_contexto)
       overriding system value values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [c.id, c.nombre, c.tipo, c.tenantId, c.dominio, c.activo, c.referentesGenerales, c.notasContexto],
    );
  }
  for (const m of d.miembros) await q("insert into public.cliente_miembro (cliente_id, email) values ($1, $2)", [m.clienteId, m.email]);

  for (const a of d.areas) {
    await q("insert into public.area (id, cliente_id, nombre, lideres, activo) overriding system value values ($1, $2, $3, $4, $5)", [
      a.id, a.clienteId, a.nombre, a.lideres, a.activo,
    ]);
  }

  for (const t of d.tableros) {
    await q("insert into public.tablero (id, cliente_id, nombre, paginas, activo) values ($1, $2, $3, $4, $5)", [
      t.tableroId, t.clienteId, t.nombre, t.paginas, t.activo,
    ]);
    for (const areaId of t.areaIds) {
      await q("insert into public.tablero_area (tablero_id, area_id, cliente_id) values ($1, $2, $3)", [t.tableroId, areaId, t.clienteId]);
    }
  }

  for (const t of d.tickets) {
    await q(
      `insert into public.ticket (id, cliente_id, tablero_id, pagina, tipo, descripcion, urgencia, estado, prioridad,
         autor_id, autor_nombre, fecha_alta, ultima_actualizacion, fecha_resuelto)
       overriding system value values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [t.itemId, t.clienteId, t.tableroId, t.pagina, t.tipo, t.descripcion, t.urgencia, t.estado, t.prioridad,
        t.autorOid, t.autorNombre, t.fechaAlta, t.ultimaActualizacion, t.fechaResuelto],
    );
    await q(
      `insert into public.ticket_soporte (ticket_id, autor_email, contexto, categoria, resumen_ia, procesado_ia, asignado_a, vence_sla)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [t.itemId, t.autorEmail, t.contexto, t.categoria, t.resumenIA, t.procesadoIA, t.asignadoA, t.venceSLA],
    );
  }

  for (const h of d.historial) {
    await q(
      `insert into public.historial (id, ticket_id, tipo, autor, autor_email, autor_es_ia, fecha, texto, visible, estado_borrador)
       overriding system value values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [h.id, h.ticketItemId, h.tipo, h.autor, h.autorEmail, h.autorEsIA, h.fecha, h.texto, h.visible, h.estadoBorrador],
    );
  }
  // Las secuencias de identidad siguen después de los IDs cargados a mano.
  for (const tabla of ["cliente", "area", "ticket", "historial"]) {
    await db.exec(`select setval(pg_get_serial_sequence('public.${tabla}', 'id'), (select max(id) from public.${tabla}))`);
  }
}

/**
 * Ejecuta `fn` como la persona demo, con el rol `authenticated` (igual que una request
 * de supabase-js con sesión). `null` = rol `anon`.
 */
export async function como<T>(db: PGlite, clave: string | null, fn: () => Promise<T>): Promise<T> {
  const uid = clave ? persona(clave).oid : "";
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec(`set role ${clave ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
