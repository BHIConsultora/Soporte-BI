/**
 * Validación de adjuntos por contenido (magic bytes), nunca por el tipo que declara el navegador.
 * Permitidos: PNG, JPEG, WebP, PDF, XLSX y CSV. Se rechaza todo lo demás (SVG, XLSM, ejecutables…).
 */

export const MAX_ADJUNTOS = 3;
export const MAX_BYTES_ADJUNTO = 4 * 1024 * 1024;
export const MAX_BYTES_REQUEST = 10 * 1024 * 1024;

export const TIPOS_ADJUNTO = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
} as const;
export type FormatoAdjunto = keyof typeof TIPOS_ADJUNTO;

const EXTENSIONES: Record<string, FormatoAdjunto> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  webp: "webp",
  pdf: "pdf",
  xlsx: "xlsx",
  csv: "csv",
};

/** Para el atributo `accept` de los inputs (solo ayuda visual; el servidor valida igual). */
export const ACCEPT_ADJUNTOS = ".png,.jpg,.jpeg,.webp,.pdf,.xlsx,.csv";

export interface ArchivoEntrante {
  nombre: string;
  datos: Uint8Array;
}

export interface ArchivoValidado {
  nombre: string;
  formato: FormatoAdjunto;
  tipo: string;
  datos: Uint8Array;
}

export type ErrorAdjunto =
  | { code: "demasiados_adjuntos"; status: 422 }
  | { code: "adjunto_muy_grande"; status: 413; nombre: string }
  | { code: "request_muy_grande"; status: 413 }
  | { code: "tipo_no_permitido"; status: 422; nombre: string };

const empiezaCon = (d: Uint8Array, bytes: number[], desde = 0) => bytes.every((b, i) => d[desde + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function contieneAscii(d: Uint8Array, texto: string): boolean {
  const patron = ascii(texto);
  const primero = patron[0];
  outer: for (let i = d.indexOf(primero!); i !== -1 && i <= d.length - patron.length; i = d.indexOf(primero!, i + 1)) {
    for (let j = 1; j < patron.length; j++) if (d[i + j] !== patron[j]) continue outer;
    return true;
  }
  return false;
}

function esCsvValido(d: Uint8Array): boolean {
  if (d.length === 0 || d.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(d);
    return true;
  } catch {
    return false;
  }
}

/** Detecta el formato real por contenido. `null` si no es un formato permitido. */
export function detectarFormato(datos: Uint8Array, extension: string): FormatoAdjunto | null {
  if (empiezaCon(datos, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (empiezaCon(datos, [0xff, 0xd8, 0xff])) return "jpeg";
  if (empiezaCon(datos, ascii("RIFF")) && empiezaCon(datos, ascii("WEBP"), 8)) return "webp";
  if (empiezaCon(datos, ascii("%PDF-"))) return "pdf";
  if (empiezaCon(datos, [0x50, 0x4b, 0x03, 0x04])) {
    // XLSX: ZIP de Office con hoja de cálculo y sin macros (XLSM trae vbaProject.bin).
    const esOffice = contieneAscii(datos, "[Content_Types].xml") && contieneAscii(datos, "xl/");
    return esOffice && !contieneAscii(datos, "vbaProject.bin") ? "xlsx" : null;
  }
  if (extension === "csv" && esCsvValido(datos)) return "csv";
  return null;
}

function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i === -1 ? "" : nombre.slice(i + 1).toLowerCase();
}

/** Nombre original saneado para mostrar (el archivo se guarda con un UUID). */
export function sanearNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? "archivo";
  const limpio = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").trim();
  return (limpio || "archivo").slice(0, 120);
}

export function validarAdjuntos(
  archivos: readonly ArchivoEntrante[],
): { ok: true; archivos: ArchivoValidado[] } | { ok: false; error: ErrorAdjunto } {
  if (archivos.length > MAX_ADJUNTOS) return { ok: false, error: { code: "demasiados_adjuntos", status: 422 } };
  const total = archivos.reduce((s, a) => s + a.datos.byteLength, 0);
  if (total > MAX_BYTES_REQUEST) return { ok: false, error: { code: "request_muy_grande", status: 413 } };

  const validados: ArchivoValidado[] = [];
  for (const a of archivos) {
    const nombre = sanearNombre(a.nombre);
    if (a.datos.byteLength > MAX_BYTES_ADJUNTO) {
      return { ok: false, error: { code: "adjunto_muy_grande", status: 413, nombre } };
    }
    const extension = extensionDe(nombre);
    const esperado = EXTENSIONES[extension];
    const formato = detectarFormato(a.datos, extension);
    if (!esperado || formato !== esperado) {
      return { ok: false, error: { code: "tipo_no_permitido", status: 422, nombre } };
    }
    validados.push({ nombre, formato, tipo: TIPOS_ADJUNTO[formato], datos: a.datos });
  }
  return { ok: true, archivos: validados };
}

export const MENSAJE_ERROR_ADJUNTO: Record<ErrorAdjunto["code"], string> = {
  demasiados_adjuntos: `Podés adjuntar hasta ${MAX_ADJUNTOS} archivos por mensaje.`,
  adjunto_muy_grande: "Cada archivo puede pesar hasta 4 MB.",
  request_muy_grande: "Entre todos los archivos no pueden superar 10 MB.",
  tipo_no_permitido: "Solo se aceptan imágenes PNG, JPG o WebP, PDF, Excel (.xlsx) y CSV.",
};
