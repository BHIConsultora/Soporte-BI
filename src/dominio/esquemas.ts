import { z } from "zod";
import { ESTADOS, ESTADOS_SOLICITUD, PRIORIDADES, TIPOS_CLIENTE, TIPOS_TICKET, URGENCIAS } from "./catalogos";

/** Esquemas compartidos entre formularios (cliente) y route handlers (servidor). */

export const DESCRIPCION_MIN = 20;
export const DESCRIPCION_MAX = 4000;
export const TEXTO_MAX = 4000;

export const slugSchema = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(60, "Máximo 60 caracteres")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones (ej. ventas-dtc)");

/** Contexto que manda el botón de Power BI: objeto plano de strings cortos (dato no confiable). */
export const contextoSchema = z
  .record(z.string().trim().min(1).max(50), z.string().max(200))
  .refine((o) => Object.keys(o).length <= 20, "Demasiados filtros")
  .refine((o) => JSON.stringify(o).length <= 2000, "Contexto demasiado largo");

/** Parsea `ctx` de la URL. Cualquier cosa inválida se descarta (devuelve `null`). */
export function parsearContexto(raw: string | null | undefined): Record<string, string> | null {
  if (!raw || raw.length > 4000) return null;
  try {
    const valor: unknown = JSON.parse(raw);
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
    const r = contextoSchema.safeParse(valor);
    return r.success && Object.keys(r.data).length > 0 ? r.data : null;
  } catch {
    return null;
  }
}

export const nuevoTicketSchema = z.object({
  tableroId: slugSchema,
  pagina: z.string().trim().max(100).optional(),
  tipo: z.enum(TIPOS_TICKET, { error: "Elegí qué tipo de problema es" }),
  descripcion: z
    .string()
    .trim()
    .min(DESCRIPCION_MIN, `Contanos un poco más (mínimo ${DESCRIPCION_MIN} caracteres)`)
    .max(DESCRIPCION_MAX, `Máximo ${DESCRIPCION_MAX} caracteres`),
  urgencia: z.enum(URGENCIAS, { error: "Elegí la urgencia" }),
  contexto: z.string().max(4000).optional(),
});
export type NuevoTicketInput = z.infer<typeof nuevoTicketSchema>;

export const textoSchema = z
  .string()
  .trim()
  .min(1, "Escribí un mensaje")
  .max(TEXTO_MAX, `Máximo ${TEXTO_MAX} caracteres`);

export const comentarioSchema = z.object({ texto: textoSchema });

export const cambiosSoporteSchema = z
  .object({
    estado: z.enum(ESTADOS).optional(),
    prioridad: z.enum(PRIORIDADES).optional(),
    asignadoA: z.union([z.email().max(200).transform((e) => e.toLowerCase()), z.null()]).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, "No hay cambios");
export type CambiosSoporte = z.infer<typeof cambiosSoporteSchema>;

export const publicarBorradorSchema = z.object({ texto: textoSchema }).strict();

/** Listas de emails separadas por `;`, `,` o saltos de línea. */
export const listaEmailsSchema = z
  .string()
  .max(4000)
  .transform((s) =>
    s
      .split(/[;,\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.email("Hay un email inválido")).max(50));

const guid = z.uuid("Tiene que ser un GUID");

export const clienteSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    tipo: z.enum(TIPOS_CLIENTE),
    tenantId: guid.nullable().optional(),
    grupoId: guid.nullable().optional(),
    dominio: z.string().trim().toLowerCase().max(120).nullable().optional(),
    activo: z.boolean(),
    referentesGenerales: listaEmailsSchema,
    notasContexto: z.string().max(4000),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.tipo === "tenant" && !c.tenantId) ctx.addIssue({ code: "custom", path: ["tenantId"], message: "Falta el TenantId" });
    if (c.tipo === "satelite" && !c.grupoId) ctx.addIssue({ code: "custom", path: ["grupoId"], message: "Falta el GrupoId" });
  });
export type ClienteInput = z.infer<typeof clienteSchema>;

export const areaSchema = z
  .object({
    clienteId: z.number().int().positive(),
    nombre: z.string().trim().min(2).max(80),
    lideres: listaEmailsSchema,
    activo: z.boolean(),
  })
  .strict();
export type AreaInput = z.infer<typeof areaSchema>;

export const tableroSchema = z
  .object({
    tableroId: slugSchema,
    nombre: z.string().trim().min(2).max(120),
    clienteId: z.number().int().positive(),
    areaIds: z.array(z.number().int().positive()).max(20),
    paginas: z.array(slugSchema).max(30),
    activo: z.boolean(),
  })
  .strict();
export type TableroInput = z.infer<typeof tableroSchema>;

export const feriadoSchema = z
  .object({
    fecha: z.iso.date("Fecha inválida"),
    descripcion: z.string().trim().min(2).max(120),
  })
  .strict();

export const solicitudSchema = z.object({ estado: z.enum(ESTADOS_SOLICITUD).exclude(["pendiente"]) }).strict();

export const dominioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,120}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "Dominio inválido (ej. empresa.com.ar)");
