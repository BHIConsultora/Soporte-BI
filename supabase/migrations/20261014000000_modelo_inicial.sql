-- =====================================================================
-- Portal de Soporte BI · Modelo de datos inicial (Supabase / Lovable Cloud)
--
-- Refleja el dominio del frontend (`src/dominio/`): mismos valores de catálogo,
-- IDs numéricos para clientes, áreas y tickets, y slug de texto para tableros.
--
-- Autorización: TODA lectura pasa por RLS. El acceso se resuelve en
-- `acceso_actual()` con la misma regla que `resolverAcceso` (src/servicios/acceso.ts);
-- los tests de `tests/supabase/` comparan ambas sobre los mismos datos.
--
-- Identidad: login con Microsoft vía Supabase Auth (proveedor `azure`). El tenant (`tid`)
-- y el email se leen de `auth.identities`, que escribe Supabase Auth con lo que manda
-- Entra ID y el usuario no puede modificar (a diferencia de `user_metadata`).
-- =====================================================================

-- ---------- Catálogos (ver src/dominio/catalogos.ts) ----------
create type public.tipo_ticket as enum (
  'Dato incorrecto', 'El tablero no se actualiza', 'Acceso / permisos',
  'Error visual o de carga', 'Pedido de mejora', 'Consulta', 'Otro'
);
create type public.urgencia_ticket as enum ('Baja', 'Media', 'Alta', 'Crítica');
create type public.estado_ticket as enum ('Nuevo', 'En análisis', 'Esperando al cliente', 'Resuelto', 'Cerrado');
create type public.prioridad_ticket as enum ('P1', 'P2', 'P3', 'P4');
create type public.tipo_historial as enum (
  'estado', 'comentario', 'nota_interna', 'borrador_respuesta', 'asignacion', 'prioridad'
);
create type public.estado_borrador as enum ('pendiente', 'publicado', 'descartado');
create type public.tipo_cliente as enum ('tenant', 'satelite');
create type public.estado_solicitud as enum ('pendiente', 'aprobada', 'rechazada');
create type public.rol_bhi as enum ('soporte', 'admin');

-- ---------- Configuración (una sola fila) ----------
-- Cargar después de aplicar la migración (ver docs/DEPLOY.md):
--   insert into public.configuracion (bhi_tenant_id) values ('<tenant id de BHI>');
create table public.configuracion (
  id             boolean primary key default true check (id),
  bhi_tenant_id  uuid not null
);

-- ---------- Personal de BHI (reemplaza los app roles de Entra) ----------
create table public.personal_bhi (
  email      text primary key check (email = lower(email)),
  nombre     text not null default '',
  rol        public.rol_bhi not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- ---------- Cliente ----------
-- `tenant`: organización con su propio tenant de Entra (tenant_id = lista de permitidos).
-- `satelite`: sus usuarios son cuentas del tenant de BHI (ver cliente_miembro).
create table public.cliente (
  id              bigint generated always as identity primary key,
  nombre          text not null,
  tipo            public.tipo_cliente not null,
  tenant_id       uuid unique,
  dominio         text,
  activo          boolean not null default true,
  -- Emails de referentes generales (ven toda la organización). Internos: no se exponen a clientes.
  referentes      text[] not null default '{}',
  -- Contexto para el triage (Claude / soporte). Interno.
  notas_contexto  text not null default '',
  creado_en       timestamptz not null default now(),
  constraint cliente_tenant_segun_tipo check ((tipo = 'tenant') = (tenant_id is not null))
);

-- Membresía de cuentas del tenant de BHI en clientes satélite (reemplaza los grupos de Entra).
create table public.cliente_miembro (
  cliente_id  bigint not null references public.cliente(id) on delete cascade,
  email       text not null check (email = lower(email)),
  primary key (cliente_id, email)
);
create index on public.cliente_miembro (email);

-- Cliente elegido por un satélite que pertenece a varios (se revalida en cada acceso).
create table public.cliente_elegido (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  cliente_id  bigint not null references public.cliente(id) on delete cascade,
  elegido_en  timestamptz not null default now()
);

-- ---------- Área ----------
create table public.area (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references public.cliente(id) on delete cascade,
  nombre      text not null,
  -- Emails de los líderes del área (ven los tickets de los tableros del área).
  lideres     text[] not null default '{}',
  activo      boolean not null default true,
  unique (id, cliente_id)
);
create index on public.area (cliente_id);

-- ---------- Tablero ----------
-- Reporte de Power BI (origen del botón "Reportar un problema").
create table public.tablero (
  id                 text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cliente_id         bigint not null references public.cliente(id) on delete cascade,
  nombre             text not null,
  paginas            text[] not null default '{}',
  powerbi_report_id  text,
  activo             boolean not null default true,
  unique (id, cliente_id)
);
create index on public.tablero (cliente_id);

-- Un tablero puede pertenecer a varias áreas del mismo cliente.
create table public.tablero_area (
  tablero_id  text not null,
  area_id     bigint not null,
  cliente_id  bigint not null,
  primary key (tablero_id, area_id),
  foreign key (tablero_id, cliente_id) references public.tablero(id, cliente_id) on delete cascade,
  foreign key (area_id, cliente_id) references public.area(id, cliente_id) on delete cascade
);
create index on public.tablero_area (area_id);

-- ---------- Ticket ----------
-- Lo que ve cualquier rol con acceso al ticket. Los campos internos van en ticket_soporte.
create table public.ticket (
  id                    bigint generated always as identity primary key,
  cliente_id            bigint not null references public.cliente(id),
  tablero_id            text not null,
  pagina                text,
  tipo                  public.tipo_ticket not null,
  descripcion           text not null check (char_length(descripcion) between 1 and 5000),
  urgencia              public.urgencia_ticket not null,
  estado                public.estado_ticket not null default 'Nuevo',
  prioridad             public.prioridad_ticket not null,
  autor_id              uuid not null references auth.users(id),
  autor_nombre          text not null,
  fecha_alta            timestamptz not null default now(),
  ultima_actualizacion  timestamptz not null default now(),
  fecha_resuelto        timestamptz,
  foreign key (tablero_id, cliente_id) references public.tablero(id, cliente_id)
);
create index on public.ticket (cliente_id, estado);
create index on public.ticket (autor_id);
create index on public.ticket (tablero_id);
create index on public.ticket (ultima_actualizacion desc, id desc);

-- Campos que solo ve soporte de BHI (TicketSoporte en src/dominio/dto.ts).
create table public.ticket_soporte (
  ticket_id     bigint primary key references public.ticket(id) on delete cascade,
  autor_email   text not null,
  -- Filtros que mandó el botón de Power BI (dato no confiable).
  contexto      jsonb check (contexto is null or jsonb_typeof(contexto) = 'object'),
  categoria     public.tipo_ticket,
  resumen_ia    text,
  procesado_ia  boolean not null default false,
  asignado_a    text,
  vence_sla     timestamptz
);
create index on public.ticket_soporte (asignado_a);
create index on public.ticket_soporte (procesado_ia) where not procesado_ia;

-- ---------- Historial (línea de tiempo) ----------
-- `nota_interna` y `borrador_respuesta` nunca son visibles para clientes.
create table public.historial (
  id               bigint generated always as identity primary key,
  ticket_id        bigint not null references public.ticket(id) on delete cascade,
  tipo             public.tipo_historial not null,
  autor            text not null,
  autor_email      text,
  autor_es_ia      boolean not null default false,
  fecha            timestamptz not null default now(),
  texto            text not null,
  visible          boolean not null default false,
  estado_borrador  public.estado_borrador,
  constraint historial_borrador check ((tipo = 'borrador_respuesta') = (estado_borrador is not null)),
  constraint historial_internos_ocultos check (tipo not in ('nota_interna', 'borrador_respuesta') or not visible)
);
create index on public.historial (ticket_id, fecha);

-- ---------- Adjuntos ----------
-- El archivo vive en Storage (bucket privado `adjuntos`, ruta `<ticket_id>/<id>`); acá la metadata.
create table public.adjunto (
  id             uuid primary key default gen_random_uuid(),
  historial_id   bigint not null references public.historial(id) on delete cascade,
  nombre         text not null,
  tipo_mime      text not null,
  tamano_bytes   bigint not null check (tamano_bytes > 0),
  storage_path   text not null unique,
  creado_en      timestamptz not null default now()
);
create index on public.adjunto (historial_id);

-- ---------- Feriados (cálculo de SLA en horas hábiles) ----------
create table public.feriado (
  id           bigint generated always as identity primary key,
  -- Día en hora de Buenos Aires.
  fecha        date not null unique,
  descripcion  text not null
);

-- ---------- Solicitudes de acceso (tenants todavía no habilitados) ----------
create table public.solicitud_acceso (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null,
  dominio    text,
  email      text not null,
  nombre     text not null default '',
  fecha      timestamptz not null default now(),
  estado     public.estado_solicitud not null default 'pendiente',
  unique (tenant_id, email)
);

-- ---------- ultima_actualizacion automática ----------
create function public.tocar_ultima_actualizacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ultima_actualizacion := now();
  return new;
end;
$$;

create trigger ticket_ultima_actualizacion
  before update on public.ticket
  for each row execute function public.tocar_ultima_actualizacion();

-- =====================================================================
-- Identidad y acceso
-- =====================================================================

-- Tenant, email y nombre del login de Microsoft del usuario actual.
create function public.mi_identidad_entra(out tid uuid, out email text, out nombre text)
language sql stable security definer set search_path = '' as $$
  with ident as (
    select
      coalesce(
        i.identity_data -> 'custom_claims' ->> 'tid',
        substring(i.identity_data ->> 'iss' from 'login\.microsoftonline\.com/([^/]+)/')
      ) as tid_texto,
      lower(coalesce(u.email, i.identity_data ->> 'email')) as email,
      coalesce(i.identity_data ->> 'full_name', i.identity_data ->> 'name', '') as nombre
    from auth.identities i
    join auth.users u on u.id = i.user_id
    where i.user_id = auth.uid() and i.provider = 'azure'
    order by i.last_sign_in_at desc nulls last
    limit 1
  )
  select
    case when tid_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then tid_texto::uuid end,
    email,
    nombre
  from ident;
$$;

-- Resultado de la resolución de acceso (Acceso en src/servicios/acceso.ts).
create type public.acceso_resuelto as (
  -- 'bhi' | 'cliente' | 'elegir_cliente' | 'denegado' | 'anonimo'
  tipo               text,
  -- bhi: 'soporte' | 'admin' · cliente: 'usuario' | 'lider' | 'referente'
  rol                text,
  -- denegado: 'tenant_no_habilitado' | 'sin_permiso'
  codigo             text,
  cliente_id         bigint,
  areas_lideradas    bigint[],
  tableros_de_areas  text[],
  -- Satélites a los que pertenece (si son varios, puede elegir entre ellos).
  clientes           bigint[]
);

-- Resuelve rol y alcance según §4.3 del contexto (misma regla que resolverAcceso).
create function public.acceso_actual()
returns public.acceso_resuelto
language plpgsql stable security definer set search_path = '' as $$
declare
  r          public.acceso_resuelto;
  v_tid      uuid;
  v_email    text;
  v_bhi      uuid;
  v_rol_bhi  public.rol_bhi;
  v_cliente  public.cliente;
begin
  if auth.uid() is null then
    r.tipo := 'anonimo';
    return r;
  end if;

  select i.tid, i.email into v_tid, v_email from public.mi_identidad_entra() i;
  if v_tid is null or v_email is null then
    r.tipo := 'denegado'; r.codigo := 'sin_permiso';
    return r;
  end if;

  select c.bhi_tenant_id into v_bhi from public.configuracion c;

  if v_tid = v_bhi then
    -- Personal de BHI: solo cuenta dentro del tenant de BHI.
    select p.rol into v_rol_bhi from public.personal_bhi p where p.email = v_email and p.activo;
    if v_rol_bhi is not null then
      r.tipo := 'bhi'; r.rol := v_rol_bhi::text;
      return r;
    end if;

    select coalesce(array_agg(c.id order by c.nombre), '{}') into r.clientes
    from public.cliente c
    join public.cliente_miembro m on m.cliente_id = c.id
    where c.tipo = 'satelite' and c.activo and m.email = v_email;

    if cardinality(r.clientes) = 0 then
      r.tipo := 'denegado'; r.codigo := 'sin_permiso';
      return r;
    elsif cardinality(r.clientes) = 1 then
      select c.* into v_cliente from public.cliente c where c.id = r.clientes[1];
    else
      -- Varios satélites: la elección guardada se revalida contra las membresías actuales.
      select c.* into v_cliente
      from public.cliente c
      join public.cliente_elegido e on e.cliente_id = c.id
      where e.user_id = auth.uid() and c.id = any (r.clientes);
      if not found then
        r.tipo := 'elegir_cliente';
        return r;
      end if;
    end if;
  else
    select c.* into v_cliente from public.cliente c where c.tipo = 'tenant' and c.tenant_id = v_tid;
    if not found or not v_cliente.activo then
      r.tipo := 'denegado'; r.codigo := 'tenant_no_habilitado';
      return r;
    end if;
  end if;

  r.tipo := 'cliente';
  r.cliente_id := v_cliente.id;

  select coalesce(array_agg(a.id order by a.id), '{}') into r.areas_lideradas
  from public.area a
  where a.cliente_id = v_cliente.id
    and a.activo
    and exists (select 1 from unnest(a.lideres) l where lower(trim(l)) = v_email);

  select coalesce(array_agg(distinct ta.tablero_id), '{}') into r.tableros_de_areas
  from public.tablero_area ta
  where ta.area_id = any (r.areas_lideradas);

  r.rol := case
    when exists (select 1 from unnest(v_cliente.referentes) x where lower(trim(x)) = v_email) then 'referente'
    when cardinality(r.areas_lideradas) > 0 then 'lider'
    else 'usuario'
  end;
  return r;
end;
$$;

-- Atajos para las políticas. Se usan como `(select public.x())` para que Postgres
-- los evalúe una vez por consulta y no una vez por fila.
create function public.es_bhi() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((public.acceso_actual()).tipo = 'bhi', false);
$$;

create function public.mi_cliente_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select (public.acceso_actual()).cliente_id;
$$;

create function public.mi_rol_cliente() returns text
language sql stable security definer set search_path = '' as $$
  select a.rol from public.acceso_actual() a where a.tipo = 'cliente';
$$;

create function public.mis_tableros_de_areas() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce((public.acceso_actual()).tableros_de_areas, '{}');
$$;

create function public.mis_clientes_elegibles() returns bigint[]
language sql stable security definer set search_path = '' as $$
  select coalesce((public.acceso_actual()).clientes, '{}');
$$;

-- =====================================================================
-- Row Level Security
-- Sin política de escritura = solo se escribe por las funciones de abajo.
-- =====================================================================

alter table public.configuracion     enable row level security;
alter table public.personal_bhi      enable row level security;
alter table public.cliente           enable row level security;
alter table public.cliente_miembro   enable row level security;
alter table public.cliente_elegido   enable row level security;
alter table public.area              enable row level security;
alter table public.tablero           enable row level security;
alter table public.tablero_area      enable row level security;
alter table public.ticket            enable row level security;
alter table public.ticket_soporte    enable row level security;
alter table public.historial         enable row level security;
alter table public.adjunto           enable row level security;
alter table public.feriado           enable row level security;
alter table public.solicitud_acceso  enable row level security;

create policy "bhi lee personal" on public.personal_bhi
  for select to authenticated using ((select public.es_bhi()));

create policy "lee su cliente" on public.cliente
  for select to authenticated using (
    (select public.es_bhi())
    or id = (select public.mi_cliente_id())
    or id = any ((select public.mis_clientes_elegibles())::bigint[])
  );

-- Referentes y notas de contexto son internos: un rol de cliente no los lee ni con su propia fila.
revoke select on public.cliente from anon, authenticated;
grant select (id, nombre, tipo, tenant_id, dominio, activo, creado_en) on public.cliente to authenticated;

create policy "bhi lee miembros" on public.cliente_miembro
  for select to authenticated using ((select public.es_bhi()));

create policy "lee areas de su cliente" on public.area
  for select to authenticated using ((select public.es_bhi()) or cliente_id = (select public.mi_cliente_id()));

create policy "lee tableros de su cliente" on public.tablero
  for select to authenticated using ((select public.es_bhi()) or cliente_id = (select public.mi_cliente_id()));

create policy "lee tablero_area de su cliente" on public.tablero_area
  for select to authenticated using ((select public.es_bhi()) or cliente_id = (select public.mi_cliente_id()));

-- §5: usuario → los suyos; líder → los suyos + tableros de sus áreas; referente → todo su cliente; BHI → todo.
create policy "lee tickets segun rol" on public.ticket
  for select to authenticated using (
    (select public.es_bhi())
    or (
      cliente_id = (select public.mi_cliente_id())
      and (
        autor_id = (select auth.uid())
        or (select public.mi_rol_cliente()) = 'referente'
        or tablero_id = any ((select public.mis_tableros_de_areas())::text[])
      )
    )
  );

create policy "bhi actualiza tickets" on public.ticket
  for update to authenticated using ((select public.es_bhi())) with check ((select public.es_bhi()));

create policy "bhi lee ticket_soporte" on public.ticket_soporte
  for select to authenticated using ((select public.es_bhi()));

create policy "bhi actualiza ticket_soporte" on public.ticket_soporte
  for update to authenticated using ((select public.es_bhi())) with check ((select public.es_bhi()));

-- La subconsulta sobre `ticket` aplica su propia RLS: solo entradas de tickets que puede ver.
create policy "lee historial visible" on public.historial
  for select to authenticated using (
    exists (select 1 from public.ticket t where t.id = ticket_id)
    and (
      (select public.es_bhi())
      or (visible and tipo not in ('nota_interna', 'borrador_respuesta'))
    )
  );

create policy "bhi escribe historial" on public.historial
  for insert to authenticated with check ((select public.es_bhi()));

create policy "bhi actualiza historial" on public.historial
  for update to authenticated using ((select public.es_bhi())) with check ((select public.es_bhi()));

create policy "lee adjuntos de historial visible" on public.adjunto
  for select to authenticated using (exists (select 1 from public.historial h where h.id = historial_id));

create policy "autenticados leen feriados" on public.feriado
  for select to authenticated using (true);

create policy "bhi lee solicitudes" on public.solicitud_acceso
  for select to authenticated using ((select public.es_bhi()));

create policy "bhi actualiza solicitudes" on public.solicitud_acceso
  for update to authenticated using ((select public.es_bhi())) with check ((select public.es_bhi()));

-- =====================================================================
-- Funciones que llama el frontend (supabase.rpc)
-- =====================================================================

-- Guarda el cliente elegido por un satélite. `false` si no pertenece a ese cliente.
create function public.elegir_cliente(p_cliente_id bigint) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (p_cliente_id = any (public.mis_clientes_elegibles())) then
    return false;
  end if;
  insert into public.cliente_elegido (user_id, cliente_id) values (auth.uid(), p_cliente_id)
  on conflict (user_id) do update set cliente_id = excluded.cliente_id, elegido_en = now();
  return true;
end;
$$;

-- Al cerrar sesión se olvida la elección ("lo podés cambiar saliendo y volviendo a entrar").
create function public.olvidar_cliente_elegido() returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.cliente_elegido where user_id = auth.uid();
$$;

-- Registra el pedido de acceso cuando el tenant del usuario no está habilitado.
create function public.registrar_solicitud_acceso() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  a  public.acceso_resuelto := public.acceso_actual();
  i  record;
begin
  if a.tipo <> 'denegado' or a.codigo <> 'tenant_no_habilitado' then
    return;
  end if;
  select * into i from public.mi_identidad_entra();
  insert into public.solicitud_acceso (tenant_id, dominio, email, nombre)
  values (i.tid, split_part(i.email, '@', 2), i.email, i.nombre)
  on conflict (tenant_id, email) do nothing;
end;
$$;

-- Alta de reclamo. Autor, cliente, estado y prioridad se derivan acá, nunca del navegador.
create function public.crear_ticket(
  p_tablero_id   text,
  p_tipo         public.tipo_ticket,
  p_descripcion  text,
  p_urgencia     public.urgencia_ticket,
  p_pagina       text default null,
  p_contexto     jsonb default null
) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  a          public.acceso_resuelto := public.acceso_actual();
  i          record;
  v_tablero  public.tablero;
  v_id       bigint;
begin
  if a.tipo <> 'cliente' then
    raise exception 'Tu cuenta no puede crear reclamos.' using errcode = '42501';
  end if;

  select * into v_tablero from public.tablero t
  where t.id = p_tablero_id and t.cliente_id = a.cliente_id and t.activo;
  if not found then
    raise exception 'Tablero inexistente.' using errcode = 'P0002';
  end if;

  if char_length(trim(coalesce(p_descripcion, ''))) < 20 then
    raise exception 'La descripción tiene que tener al menos 20 caracteres.' using errcode = '22023';
  end if;

  if p_contexto is not null and (jsonb_typeof(p_contexto) <> 'object' or length(p_contexto::text) > 2000) then
    p_contexto := null;
  end if;

  select * into i from public.mi_identidad_entra();

  insert into public.ticket (cliente_id, tablero_id, pagina, tipo, descripcion, urgencia, prioridad, autor_id, autor_nombre)
  values (
    a.cliente_id,
    v_tablero.id,
    case when p_pagina = any (v_tablero.paginas) then p_pagina end,
    p_tipo,
    trim(p_descripcion),
    p_urgencia,
    -- PRIORIDAD_INICIAL en src/dominio/catalogos.ts
    (case p_urgencia when 'Crítica' then 'P1' when 'Alta' then 'P2' when 'Media' then 'P3' else 'P4' end)::public.prioridad_ticket,
    auth.uid(),
    coalesce(nullif(i.nombre, ''), i.email)
  )
  returning id into v_id;

  insert into public.ticket_soporte (ticket_id, autor_email, contexto) values (v_id, i.email, p_contexto);

  insert into public.historial (ticket_id, tipo, autor, autor_email, texto, visible)
  values (v_id, 'estado', coalesce(nullif(i.nombre, ''), i.email), i.email, 'Nuevo', true);

  return v_id;
end;
$$;

-- Las funciones solo las llama un usuario con sesión.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.acceso_actual(),
  public.elegir_cliente(bigint),
  public.olvidar_cliente_elegido(),
  public.registrar_solicitud_acceso(),
  public.crear_ticket(text, public.tipo_ticket, text, public.urgencia_ticket, text, jsonb),
  public.es_bhi(),
  public.mi_cliente_id(),
  public.mi_rol_cliente(),
  public.mis_tableros_de_areas(),
  public.mis_clientes_elegibles()
to authenticated;

-- =====================================================================
-- Storage: bucket privado de adjuntos
-- Se lee si existe la fila de `adjunto` y su historial es visible para el usuario (RLS encadenada).
-- La subida se habilita en la etapa 1 (con validación de tipo y tamaño).
-- =====================================================================
insert into storage.buckets (id, name, public) values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

create policy "lee adjuntos visibles" on storage.objects
  for select to authenticated using (
    bucket_id = 'adjuntos'
    and exists (select 1 from public.adjunto a where a.storage_path = name)
  );
