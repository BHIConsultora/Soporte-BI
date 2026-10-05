import type { Adjunto, Estado, Me, NuevoTicket, Prioridad, Rol, Scope, Ticket, TicketDetalle } from "./types";

const delay = <T>(v: T, ms = 800) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));

let rol: Rol = "usuario";
export function getMockRole() {
  return rol;
}
export function setMockRole(r: Rol) {
  rol = r;
}

function meFor(r: Rol): Me {
  if (r === "soporte")
    return { nombre: "Lucía Fernández", email: "lfernandez@bhiconsultora.com.ar", cliente: "BHI Consultora Regional", rol: r };
  return { nombre: "Martina López", email: "mlopez@laboratorioena.com.ar", cliente: "Laboratorio ENA", rol: r };
}

const d = (daysAgo: number, h = 10) => {
  const x = new Date();
  x.setDate(x.getDate() - daysAgo);
  x.setHours(h, 15, 0, 0);
  return x.toISOString();
};

let seq = 1043;
const tickets: TicketDetalle[] = [
  {
    ticketId: "TCK-1042", cliente: "Laboratorio ENA", tablero: "Ventas por Región", pagina: "Resumen mensual",
    tipo: "Dato incorrecto", descripcion: "El total de ventas de agosto para la región Sur no coincide con lo que tenemos en el ERP. El tablero muestra $12,4 M y el ERP $13,1 M. Tenía aplicado el filtro de canal 'Mayorista'.",
    urgencia: "Alta", estado: "En análisis", prioridad: "P2", categoria: "Calidad de datos",
    resumenIA: "Diferencia de ~5% en ventas Sur/agosto vs ERP, filtro Mayorista.", procesadoIA: true, borradoresPendientes: 1,
    autorNombre: "Martina López", autorEmail: "mlopez@laboratorioena.com.ar", fechaAlta: d(3), ultimaActualizacion: d(0, 9),
    historial: [
      { id: "h1", tipo: "estado", autor: "Sistema", fecha: d(3), texto: "Ticket creado en estado Nuevo" },
      { id: "h2", tipo: "nota_interna", autor: "Claude", fecha: d(3, 11), texto: "Posible causa: notas de crédito de agosto cargadas con fecha de septiembre en el ERP. Revisar la medida [Ventas Netas] y la relación con la tabla de NC." },
      { id: "h3", tipo: "estado", autor: "Lucía Fernández", fecha: d(2), texto: "Cambió el estado a En análisis" },
      { id: "h4", tipo: "borrador_respuesta", autor: "Claude", fecha: d(0, 9), texto: "Hola Martina, gracias por avisarnos. Estamos revisando la diferencia y todo indica que se debe a notas de crédito registradas con fecha posterior. Te vamos a confirmar a la brevedad." },
    ],
  },
  {
    ticketId: "TCK-1039", cliente: "Laboratorio ENA", tablero: "Stock de Insumos", tipo: "El tablero no se actualiza",
    descripcion: "Desde el lunes el tablero muestra la fecha de última actualización del viernes. Los datos de stock no se refrescan.",
    urgencia: "Crítica", estado: "Esperando al cliente", prioridad: "P1", categoria: "Actualización", resumenIA: "Refresh programado detenido desde el viernes.",
    procesadoIA: true, borradoresPendientes: 0, autorNombre: "Martina López", autorEmail: "mlopez@laboratorioena.com.ar", fechaAlta: d(6), ultimaActualizacion: d(1),
    historial: [
      { id: "h1", tipo: "estado", autor: "Sistema", fecha: d(6), texto: "Ticket creado en estado Nuevo" },
      { id: "h2", tipo: "comentario", autor: "Lucía Fernández", fecha: d(1), texto: "Hola Martina, vemos que la credencial del gateway venció. ¿Nos podés confirmar si cambiaron la contraseña del usuario de base de datos?" },
      { id: "h3", tipo: "estado", autor: "Lucía Fernández", fecha: d(1), texto: "Cambió el estado a Esperando al cliente" },
    ],
  },
  {
    ticketId: "TCK-1031", cliente: "Laboratorio ENA", tablero: "Ventas por Región", tipo: "Pedido de mejora",
    descripcion: "Nos gustaría poder ver la evolución de ventas por vendedor en la misma página del resumen mensual.",
    urgencia: "Baja", estado: "Resuelto", prioridad: "P4", categoria: "Mejora", resumenIA: "Agregar evolución por vendedor en resumen.",
    procesadoIA: true, borradoresPendientes: 0, autorNombre: "Martina López", autorEmail: "mlopez@laboratorioena.com.ar", fechaAlta: d(15), ultimaActualizacion: d(2),
    historial: [
      { id: "h1", tipo: "estado", autor: "Sistema", fecha: d(15), texto: "Ticket creado en estado Nuevo" },
      { id: "h2", tipo: "comentario", autor: "Lucía Fernández", fecha: d(2), texto: "¡Listo! Ya agregamos el visual de evolución por vendedor. Cualquier cosa nos avisás." },
      { id: "h3", tipo: "estado", autor: "Lucía Fernández", fecha: d(2), texto: "Cambió el estado a Resuelto" },
    ],
  },
  {
    ticketId: "TCK-1036", cliente: "Laboratorio ENA", tablero: "Recursos Humanos", tipo: "Acceso / permisos",
    descripcion: "Una persona nueva del equipo de RR. HH. no puede ver el tablero, le aparece que no tiene permisos.",
    urgencia: "Media", estado: "Nuevo", prioridad: "P3", categoria: "Accesos", resumenIA: "Alta de permisos para usuario nuevo de RR. HH.",
    procesadoIA: true, borradoresPendientes: 1, autorNombre: "Pablo Giménez", autorEmail: "pgimenez@laboratorioena.com.ar", fechaAlta: d(1), ultimaActualizacion: d(1),
    historial: [
      { id: "h1", tipo: "estado", autor: "Sistema", fecha: d(1), texto: "Ticket creado en estado Nuevo" },
      { id: "h2", tipo: "borrador_respuesta", autor: "Claude", fecha: d(1, 12), texto: "Hola Pablo, ¿nos pasás el email de la persona así le damos acceso al área de trabajo de RR. HH.?" },
    ],
  },
  {
    ticketId: "TCK-1040", cliente: "Alimentos Crecer", tablero: "Producción Diaria", pagina: "Mermas",
    tipo: "Error visual o de carga", descripcion: "El gráfico de mermas por línea queda cargando y finalmente muestra 'No se pudo mostrar el visual'.",
    urgencia: "Alta", estado: "En análisis", prioridad: "P2", categoria: "Rendimiento", resumenIA: "Visual de mermas falla por timeout.",
    procesadoIA: true, borradoresPendientes: 0, autorNombre: "Diego Ríos", autorEmail: "drios@alimentoscrecer.com", fechaAlta: d(4), ultimaActualizacion: d(1),
    historial: [{ id: "h1", tipo: "estado", autor: "Sistema", fecha: d(4), texto: "Ticket creado en estado Nuevo" }],
  },
  {
    ticketId: "TCK-1022", cliente: "Alimentos Crecer", tablero: "Finanzas", tipo: "Consulta",
    descripcion: "¿Cómo se calcula el margen bruto que aparece en la tarjeta principal? Queremos validarlo con contaduría.",
    urgencia: "Baja", estado: "Cerrado", prioridad: "P4", categoria: "Consulta", resumenIA: "Consulta sobre fórmula de margen bruto.",
    procesadoIA: true, borradoresPendientes: 0, autorNombre: "Diego Ríos", autorEmail: "drios@alimentoscrecer.com", fechaAlta: d(40), ultimaActualizacion: d(33),
    historial: [{ id: "h1", tipo: "estado", autor: "Sistema", fecha: d(40), texto: "Ticket creado en estado Nuevo" }],
  },
];

const strip = ({ historial: _h, ...t }: TicketDetalle): Ticket => t;
const find = (id: string) => {
  const t = tickets.find((x) => x.ticketId === id);
  if (!t) throw Object.assign(new Error("No encontramos ese ticket."), { status: 404 });
  return t;
};
const touch = (t: TicketDetalle) => {
  t.ultimaActualizacion = new Date().toISOString();
  t.borradoresPendientes = t.historial.filter((h) => h.tipo === "borrador_respuesta").length;
};

export const mock = {
  getMe: () => delay(meFor(rol)),
  listTickets: ({ scope, estado, q }: { scope: Scope; estado?: string; q?: string }) => {
    const me = meFor(rol);
    let list = tickets.filter((t) =>
      scope === "all" && rol === "soporte" ? true : scope === "org" ? t.cliente === me.cliente : t.autorEmail === me.email,
    );
    if (estado) list = list.filter((t) => t.estado === estado);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((t) => [t.ticketId, t.tablero, t.tipo, t.descripcion, t.cliente].join(" ").toLowerCase().includes(s));
    }
    return delay(list.map(strip).sort((a, b) => b.ultimaActualizacion.localeCompare(a.ultimaActualizacion)));
  },
  getTicket: async (id: string) => {
    await delay(null);
    const t = find(id);
    const copy = structuredClone(t);
    if (rol !== "soporte") copy.historial = copy.historial.filter((h) => h.tipo === "estado" || h.tipo === "comentario");
    return copy;
  },
  createTicket: (b: NuevoTicket) => {
    const me = meFor(rol);
    const now = new Date().toISOString();
    const ticketId = `TCK-${seq++}`;
    tickets.unshift({
      ticketId, cliente: me.cliente, tablero: b.tablero, pagina: b.pagina, tipo: b.tipo, descripcion: b.descripcion,
      urgencia: b.urgencia, estado: "Nuevo", prioridad: b.urgencia === "Crítica" ? "P1" : b.urgencia === "Alta" ? "P2" : b.urgencia === "Media" ? "P3" : "P4",
      procesadoIA: false, borradoresPendientes: 0, autorNombre: me.nombre, autorEmail: me.email, fechaAlta: now, ultimaActualizacion: now,
      adjuntos: b.adjuntos.map((a) => ({ nombre: a.nombre, url: a.base64 })),
      historial: [{ id: crypto.randomUUID(), tipo: "estado", autor: "Sistema", fecha: now, texto: "Ticket creado en estado Nuevo" }],
    });
    return delay({ ticketId });
  },
  addComment: async (id: string, b: { texto: string; adjuntos: Adjunto[] }) => {
    const t = find(id);
    t.historial.push({ id: crypto.randomUUID(), tipo: "comentario", autor: meFor(rol).nombre, fecha: new Date().toISOString(), texto: b.texto, adjuntos: b.adjuntos.map((a) => ({ nombre: a.nombre, url: a.base64 })) });
    touch(t);
    await delay(null);
  },
  patchTicket: async (id: string, b: { estado?: Estado; prioridad?: Prioridad }) => {
    const t = find(id);
    const autor = meFor(rol).nombre;
    if (b.estado && b.estado !== t.estado) {
      t.estado = b.estado;
      t.historial.push({ id: crypto.randomUUID(), tipo: "estado", autor, fecha: new Date().toISOString(), texto: `Cambió el estado a ${b.estado}` });
    }
    if (b.prioridad && b.prioridad !== t.prioridad) {
      t.prioridad = b.prioridad;
      t.historial.push({ id: crypto.randomUUID(), tipo: "estado", autor, fecha: new Date().toISOString(), texto: `Cambió la prioridad a ${b.prioridad}` });
    }
    touch(t);
    await delay(null);
  },
  publishDraft: async (id: string, bid: string, texto: string) => {
    const t = find(id);
    t.historial = t.historial.filter((h) => h.id !== bid);
    t.historial.push({ id: crypto.randomUUID(), tipo: "comentario", autor: meFor(rol).nombre, fecha: new Date().toISOString(), texto });
    touch(t);
    await delay(null);
  },
  deleteDraft: async (id: string, bid: string) => {
    const t = find(id);
    t.historial = t.historial.filter((h) => h.id !== bid);
    touch(t);
    await delay(null);
  },
};
