import { ESTADOS_ABIERTOS, PRIORIDAD_INICIAL } from "@/dominio/catalogos";
import { calcularVenceSLA } from "@/dominio/sla";
import type {
  Area,
  Cliente,
  EntradaHistorial,
  Feriado,
  SolicitudAcceso,
  Tablero,
  Ticket,
} from "@/dominio/entidades";

/**
 * Datos ficticios para el modo demo y los tests. Todos los dominios son `example.com`.
 * Las fechas son relativas a `ahora` para que la demo se vea "viva".
 */

import {
  DEMO_BHI_TENANT_ID,
  DEMO_GRUPO_PATAGONIA,
  DEMO_GRUPO_PILOTO,
  DEMO_TENANT_ANDINA,
  DEMO_TENANT_LITORAL,
  DEMO_TENANT_NO_HABILITADO,
} from "./constantes";

export * from "./constantes";

export const CLIENTE = { piloto: 1, andina: 2, litoral: 3, patagonia: 4 } as const;
export const AREA = { comercial: 10, finanzas: 11, logistica: 12, produccion: 20, operaciones: 30 } as const;

/** Personas de la demo: identidad tal como llegaría en el ID token de Entra. */
export interface IdentidadDemo {
  clave: string;
  descripcion: string;
  oid: string;
  tid: string;
  email: string;
  nombre: string;
  appRoles: string[];
  grupos: string[];
  esInvitado: boolean;
}

const oid = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

export const PERSONAS_DEMO: IdentidadDemo[] = [
  { clave: "usuario", descripcion: "Usuario · Distribuidora Andina", oid: oid(1), tid: DEMO_TENANT_ANDINA, email: "ulises.usuario@andina.example.com", nombre: "Ulises Usuario", appRoles: [], grupos: [], esInvitado: false },
  { clave: "usuario2", descripcion: "Otra usuaria · Distribuidora Andina", oid: oid(2), tid: DEMO_TENANT_ANDINA, email: "paula.perez@andina.example.com", nombre: "Paula Pérez", appRoles: [], grupos: [], esInvitado: false },
  { clave: "lider", descripcion: "Líder de Comercial · Distribuidora Andina", oid: oid(3), tid: DEMO_TENANT_ANDINA, email: "lucia.lider@andina.example.com", nombre: "Lucía Líder", appRoles: [], grupos: [], esInvitado: false },
  { clave: "referente", descripcion: "Referente general · Distribuidora Andina", oid: oid(4), tid: DEMO_TENANT_ANDINA, email: "ramiro.referente@andina.example.com", nombre: "Ramiro Referente", appRoles: [], grupos: [], esInvitado: false },
  { clave: "litoral", descripcion: "Usuaria · Cooperativa del Litoral", oid: oid(5), tid: DEMO_TENANT_LITORAL, email: "camila.coop@litoral.example.com", nombre: "Camila Cooperativa", appRoles: [], grupos: [], esInvitado: false },
  { clave: "satelite", descripcion: "Usuario satélite · Estudio Patagonia", oid: oid(6), tid: DEMO_BHI_TENANT_ID, email: "santiago.patagonia@bhi.example.com", nombre: "Santiago Satélite", appRoles: [], grupos: [DEMO_GRUPO_PATAGONIA], esInvitado: false },
  { clave: "satelite-multi", descripcion: "Satélite en dos clientes (elige cliente)", oid: oid(7), tid: DEMO_BHI_TENANT_ID, email: "mara.multi@bhi.example.com", nombre: "Mara Multi", appRoles: [], grupos: [DEMO_GRUPO_PATAGONIA, DEMO_GRUPO_PILOTO], esInvitado: false },
  { clave: "soporte", descripcion: "Soporte · BHI", oid: oid(8), tid: DEMO_BHI_TENANT_ID, email: "sofia.soporte@bhi.example.com", nombre: "Sofía Soporte", appRoles: ["Soporte"], grupos: [], esInvitado: false },
  { clave: "admin", descripcion: "Admin · BHI", oid: oid(9), tid: DEMO_BHI_TENANT_ID, email: "martina.admin@bhi.example.com", nombre: "Martina Admin", appRoles: ["Admin"], grupos: [], esInvitado: false },
  { clave: "invitado", descripcion: "Invitado B2B en BHI (sin acceso)", oid: oid(10), tid: DEMO_BHI_TENANT_ID, email: "invitado@externo.example.com", nombre: "Iván Invitado", appRoles: ["Soporte"], grupos: [], esInvitado: true },
  { clave: "no-habilitado", descripcion: "Tenant no habilitado", oid: oid(11), tid: DEMO_TENANT_NO_HABILITADO, email: "nadia@otra.example.com", nombre: "Nadia Nueva", appRoles: [], grupos: [], esInvitado: false },
];

export function persona(clave: string): IdentidadDemo {
  const p = PERSONAS_DEMO.find((x) => x.clave === clave);
  if (!p) throw new Error(`Persona demo desconocida: ${clave}`);
  return p;
}

export interface DatosDemo {
  clientes: Cliente[];
  areas: Area[];
  tableros: Tablero[];
  tickets: Ticket[];
  historial: EntradaHistorial[];
  feriados: Feriado[];
  solicitudes: SolicitudAcceso[];
}

export function crearDatosDemo(ahora: Date = new Date()): DatosDemo {
  const hace = (dias: number, horas = 0) =>
    new Date(ahora.getTime() - (dias * 24 + horas) * 3_600_000).toISOString();

  const clientes: Cliente[] = [
    { id: CLIENTE.piloto, nombre: "BHI Consultora (piloto)", tipo: "satelite", tenantId: null, grupoId: DEMO_GRUPO_PILOTO, dominio: "bhi.example.com", activo: true, referentesGenerales: [], notasContexto: "Piloto interno para probar el circuito completo." },
    { id: CLIENTE.andina, nombre: "Distribuidora Andina", tipo: "tenant", tenantId: DEMO_TENANT_ANDINA, grupoId: null, dominio: "andina.example.com", activo: true, referentesGenerales: ["ramiro.referente@andina.example.com"], notasContexto: "Distribuidora de consumo masivo. Los tableros se actualizan a las 7 h desde el ERP. Cierre contable el día 5." },
    { id: CLIENTE.litoral, nombre: "Cooperativa del Litoral", tipo: "tenant", tenantId: DEMO_TENANT_LITORAL, grupoId: null, dominio: "litoral.example.com", activo: true, referentesGenerales: [], notasContexto: "Cooperativa agrícola. Gateway on-premise que a veces se cae los lunes." },
    { id: CLIENTE.patagonia, nombre: "Estudio Patagonia", tipo: "satelite", tenantId: null, grupoId: DEMO_GRUPO_PATAGONIA, dominio: "patagonia.example.com", activo: true, referentesGenerales: [], notasContexto: "Cliente satélite: sus usuarios son cuentas del tenant de BHI." },
  ];

  const areas: Area[] = [
    { id: AREA.comercial, clienteId: CLIENTE.andina, nombre: "Comercial", lideres: ["lucia.lider@andina.example.com"], activo: true },
    { id: AREA.finanzas, clienteId: CLIENTE.andina, nombre: "Finanzas", lideres: ["fernando.finanzas@andina.example.com"], activo: true },
    { id: AREA.logistica, clienteId: CLIENTE.andina, nombre: "Logística", lideres: [], activo: true },
    { id: AREA.produccion, clienteId: CLIENTE.litoral, nombre: "Producción", lideres: [], activo: true },
    { id: AREA.operaciones, clienteId: CLIENTE.patagonia, nombre: "Operaciones", lideres: [], activo: true },
  ];

  const tableros: Tablero[] = [
    { tableroId: "ventas-dtc", nombre: "Ventas DTC", clienteId: CLIENTE.andina, areaIds: [AREA.comercial], paginas: ["resumen", "por-vendedor", "por-zona"], activo: true },
    { tableroId: "margen-por-canal", nombre: "Margen por canal", clienteId: CLIENTE.andina, areaIds: [AREA.comercial, AREA.finanzas], paginas: ["resumen", "detalle"], activo: true },
    { tableroId: "cobranzas", nombre: "Cobranzas", clienteId: CLIENTE.andina, areaIds: [AREA.finanzas], paginas: [], activo: true },
    { tableroId: "stock-depositos", nombre: "Stock por depósito", clienteId: CLIENTE.andina, areaIds: [AREA.logistica], paginas: [], activo: true },
    { tableroId: "acopio-granos", nombre: "Acopio de granos", clienteId: CLIENTE.litoral, areaIds: [AREA.produccion], paginas: ["campana-actual"], activo: true },
    { tableroId: "liquidaciones", nombre: "Liquidaciones a productores", clienteId: CLIENTE.litoral, areaIds: [AREA.produccion], paginas: [], activo: true },
    { tableroId: "ocupacion-hotelera", nombre: "Ocupación hotelera", clienteId: CLIENTE.patagonia, areaIds: [AREA.operaciones], paginas: [], activo: true },
    { tableroId: "piloto-soporte", nombre: "Tablero piloto", clienteId: CLIENTE.piloto, areaIds: [], paginas: [], activo: true },
  ];

  const ulises = persona("usuario");
  const paula = persona("usuario2");
  const lucia = persona("lider");
  const ramiro = persona("referente");
  const camila = persona("litoral");
  const santiago = persona("satelite");
  const mara = persona("satelite-multi");
  const sofia = persona("soporte");

  type Base = Pick<Ticket, "clienteId" | "tableroId" | "tipo" | "descripcion" | "urgencia" | "estado"> &
    Partial<Ticket> & { autor: IdentidadDemo; alta: string };

  const t = (itemId: number, b: Base): Ticket => {
    const { autor, alta, ...resto } = b;
    return {
      itemId,
      pagina: null,
      contexto: null,
      prioridad: PRIORIDAD_INICIAL[b.urgencia],
      categoria: null,
      resumenIA: null,
      procesadoIA: false,
      autorOid: autor.oid,
      autorNombre: autor.nombre,
      autorEmail: autor.email,
      asignadoA: null,
      fechaAlta: alta,
      ultimaActualizacion: alta,
      fechaResuelto: null,
      venceSLA: null,
      ...resto,
    };
  };

  const tickets: Ticket[] = [
    t(1, { clienteId: CLIENTE.andina, tableroId: "ventas-dtc", pagina: "por-zona", contexto: { Zona: "NOA", Mes: "2026-09" }, tipo: "Dato incorrecto", descripcion: "Las ventas de la zona NOA de septiembre no coinciden con el reporte del ERP: faltan unos 2 millones.", urgencia: "Alta", estado: "Nuevo", autor: ulises, alta: hace(0, 3) }),
    t(2, { clienteId: CLIENTE.andina, tableroId: "ventas-dtc", tipo: "El tablero no se actualiza", descripcion: "Desde ayer el tablero muestra datos del viernes. ¿Se cortó la actualización programada?", urgencia: "Crítica", estado: "En análisis", autor: ulises, alta: hace(1, 2), prioridad: "P1", categoria: "El tablero no se actualiza", resumenIA: "Falla de actualización programada; probable credencial vencida del origen.", procesadoIA: true, asignadoA: sofia.email }),
    t(3, { clienteId: CLIENTE.andina, tableroId: "margen-por-canal", pagina: "detalle", tipo: "Consulta", descripcion: "¿Cómo se calcula el margen del canal mayorista? Necesito explicarlo en la reunión de directorio.", urgencia: "Media", estado: "Esperando al cliente", autor: paula, alta: hace(4), categoria: "Consulta", resumenIA: "Consulta sobre la fórmula del margen mayorista.", procesadoIA: true, asignadoA: sofia.email }),
    t(4, { clienteId: CLIENTE.andina, tableroId: "cobranzas", tipo: "Error visual o de carga", descripcion: "El gráfico de antigüedad de deuda queda en blanco cuando filtro por sucursal Mendoza.", urgencia: "Media", estado: "Nuevo", autor: paula, alta: hace(0, 6) }),
    t(5, { clienteId: CLIENTE.andina, tableroId: "stock-depositos", tipo: "Acceso / permisos", descripcion: "Una persona nueva del depósito de Rosario no puede abrir el tablero, le aparece que no tiene permisos.", urgencia: "Alta", estado: "Resuelto", autor: ramiro, alta: hace(6), prioridad: "P2", categoria: "Acceso / permisos", procesadoIA: true, fechaResuelto: hace(3), asignadoA: sofia.email }),
    t(6, { clienteId: CLIENTE.andina, tableroId: "ventas-dtc", tipo: "Pedido de mejora", descripcion: "Estaría bueno poder ver las ventas comparadas contra el mismo mes del año anterior.", urgencia: "Baja", estado: "Cerrado", autor: lucia, alta: hace(40), fechaResuelto: hace(30), categoria: "Pedido de mejora", procesadoIA: true }),
    t(7, { clienteId: CLIENTE.andina, tableroId: "margen-por-canal", tipo: "Dato incorrecto", descripcion: "El margen de supermercados aparece negativo en agosto, y no tiene sentido con lo facturado.", urgencia: "Alta", estado: "En análisis", autor: paula, alta: hace(2), prioridad: "P2", procesadoIA: true, categoria: "Dato incorrecto", resumenIA: "Margen negativo en supermercados, agosto. Revisar notas de crédito." }),
    t(8, { clienteId: CLIENTE.andina, tableroId: "cobranzas", tipo: "Otro", descripcion: "Necesitamos que el tablero de cobranzas se pueda exportar a Excel con el detalle por cliente.", urgencia: "Baja", estado: "Resuelto", autor: ulises, alta: hace(25), fechaResuelto: hace(20), procesadoIA: true, categoria: "Pedido de mejora" }),
    t(9, { clienteId: CLIENTE.litoral, tableroId: "acopio-granos", pagina: "campana-actual", tipo: "El tablero no se actualiza", descripcion: "El acopio de soja no se actualiza desde el lunes. ¿Puede ser el gateway?", urgencia: "Crítica", estado: "Nuevo", autor: camila, alta: hace(0, 1) }),
    t(10, { clienteId: CLIENTE.litoral, tableroId: "liquidaciones", tipo: "Dato incorrecto", descripcion: "La liquidación del productor 1045 muestra el doble de kilos que el remito.", urgencia: "Alta", estado: "Esperando al cliente", autor: camila, alta: hace(3), prioridad: "P2", procesadoIA: true, categoria: "Dato incorrecto", asignadoA: sofia.email }),
    t(11, { clienteId: CLIENTE.litoral, tableroId: "acopio-granos", tipo: "Consulta", descripcion: "¿Qué significa la columna 'humedad ajustada'? Nadie del equipo lo sabe.", urgencia: "Baja", estado: "Cerrado", autor: camila, alta: hace(60), fechaResuelto: hace(55), procesadoIA: true, categoria: "Consulta" }),
    t(12, { clienteId: CLIENTE.patagonia, tableroId: "ocupacion-hotelera", tipo: "Error visual o de carga", descripcion: "En el celular el mapa de ocupación no carga, en la compu sí.", urgencia: "Media", estado: "Nuevo", autor: santiago, alta: hace(1, 5) }),
    t(13, { clienteId: CLIENTE.patagonia, tableroId: "ocupacion-hotelera", tipo: "Pedido de mejora", descripcion: "Queremos agregar la temporada de invierno como filtro rápido en la portada.", urgencia: "Baja", estado: "En análisis", autor: mara, alta: hace(8), procesadoIA: true, categoria: "Pedido de mejora" }),
    t(14, { clienteId: CLIENTE.piloto, tableroId: "piloto-soporte", tipo: "Consulta", descripcion: "Ticket de prueba del piloto interno para validar el circuito de correo.", urgencia: "Media", estado: "Resuelto", autor: mara, alta: hace(12), fechaResuelto: hace(10) }),
    t(15, { clienteId: CLIENTE.andina, tableroId: "stock-depositos", tipo: "El tablero no se actualiza", descripcion: "El stock de Córdoba sigue igual desde hace dos días aunque hubo movimientos.", urgencia: "Media", estado: "Nuevo", autor: ramiro, alta: hace(0, 20) }),
  ];

  let h = 0;
  const e = (ticketItemId: number, x: Omit<EntradaHistorial, "id" | "ticketItemId" | "adjuntos" | "estadoBorrador" | "autorEmail"> & Partial<EntradaHistorial>): EntradaHistorial => ({
    id: ++h,
    ticketItemId,
    autorEmail: null,
    estadoBorrador: null,
    adjuntos: [],
    ...x,
  });

  const claude = { autor: "Claude", autorEsIA: true, visible: false } as const;

  const historial: EntradaHistorial[] = [
    ...tickets.map((tk) =>
      e(tk.itemId, {
        tipo: "estado",
        autor: tk.autorNombre,
        autorEmail: tk.autorEmail,
        autorEsIA: false,
        fecha: tk.fechaAlta,
        texto: "Nuevo",
        visible: true,
        adjuntos: tk.itemId === 1 ? [{ id: "00000000-0000-4000-a000-000000000001", nombre: "ventas-noa-erp.csv", tipo: "text/csv", tamano: 18 }] : [],
      }),
    ),
    e(2, { ...claude, tipo: "nota_interna", fecha: hace(1, 1), texto: "La actualización programada falla desde el sábado con error de credenciales del origen SQL. Revisar la cuenta de servicio del gateway." }),
    e(2, { ...claude, tipo: "borrador_respuesta", fecha: hace(1, 1), texto: "¡Hola Ulises! Ya estamos revisando la actualización del tablero: encontramos un problema con la conexión al origen de datos. Te avisamos por acá apenas quede resuelto.", estadoBorrador: "pendiente" }),
    e(2, { tipo: "asignacion", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(1), texto: sofia.email, visible: false }),
    e(2, { tipo: "estado", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(1), texto: "En análisis", visible: true }),
    e(3, { tipo: "comentario", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(3), texto: "¡Hola Paula! El margen mayorista es (ventas netas − costo) / ventas netas, sin incluir bonificaciones de fin de mes. ¿Te sirve que agreguemos una nota explicativa en la página?", visible: true }),
    e(3, { tipo: "estado", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(3), texto: "Esperando al cliente", visible: true }),
    e(5, { tipo: "comentario", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(3), texto: "Listo, ya le dimos acceso. Puede tardar unos minutos en verlo.", visible: true }),
    e(5, { tipo: "estado", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(3), texto: "Resuelto", visible: true }),
    e(7, { ...claude, tipo: "nota_interna", fecha: hace(1, 20), texto: "Las notas de crédito de agosto se cargaron con signo invertido en el origen. Sugiero validar con Finanzas antes de corregir." }),
    e(7, { ...claude, tipo: "borrador_respuesta", fecha: hace(1, 20), texto: "¡Hola Paula! Estamos revisando el margen de supermercados de agosto. Parece que algunas notas de crédito quedaron mal registradas; te confirmamos en cuanto lo validemos.", estadoBorrador: "pendiente" }),
    e(9, { ...claude, tipo: "nota_interna", fecha: hace(0, 0.5), texto: "Coincide con el patrón conocido del gateway on-premise de los lunes (ver notas del cliente)." }),
    e(10, { tipo: "comentario", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(2), texto: "¿Nos podés pasar una foto del remito del productor 1045 para compararlo?", visible: true }),
    e(13, { ...claude, tipo: "borrador_respuesta", fecha: hace(7), texto: "¡Hola Mara! Tomamos el pedido del filtro de temporada de invierno. Lo vamos a evaluar en la próxima planificación.", estadoBorrador: "descartado" }),
    e(14, { tipo: "comentario", autor: sofia.nombre, autorEmail: sofia.email, autorEsIA: false, fecha: hace(10), texto: "El correo llegó bien. Damos por resuelto el piloto.", visible: true }),
  ];

  const anio = ahora.getUTCFullYear();
  const feriados: Feriado[] = [
    { id: 1, fecha: `${anio}-10-12`, descripcion: "Día del Respeto a la Diversidad Cultural" },
    { id: 2, fecha: `${anio}-11-20`, descripcion: "Día de la Soberanía Nacional" },
    { id: 3, fecha: `${anio}-12-08`, descripcion: "Inmaculada Concepción de María" },
    { id: 4, fecha: `${anio}-12-25`, descripcion: "Navidad" },
  ];

  const solicitudes: SolicitudAcceso[] = [
    { id: 1, tenantId: DEMO_TENANT_NO_HABILITADO, dominio: "otra.example.com", email: "nadia@otra.example.com", nombre: "Nadia Nueva", fecha: hace(2), estado: "pendiente" },
  ];

  // El vencimiento se calcula con la misma función que usa la app (desde la fecha de alta).
  const diasFeriado = new Set(feriados.map((f) => f.fecha));
  for (const tk of tickets) {
    if (!ESTADOS_ABIERTOS.includes(tk.estado)) continue;
    tk.venceSLA = calcularVenceSLA(new Date(tk.fechaAlta), tk.prioridad, diasFeriado)?.toISOString() ?? null;
  }

  return { clientes, areas, tableros, tickets, historial, feriados, solicitudes };
}
