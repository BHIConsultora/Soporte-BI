/**
 * Genera la medida DAX para el botón "Reportar un problema" de un tablero/página.
 * El botón de Power BI usa la medida como "URL web" (formato condicional de la acción).
 */

export interface FiltroDax {
  /** Clave que se verá en el portal (ej. "Zona"). */
  clave: string;
  /** Columna de la que se toma el valor seleccionado (ej. 'Dim Zona'[Zona]). */
  columna: string;
}

export interface OpcionesDax {
  appUrl: string;
  tableroId: string;
  pagina?: string | null;
  filtros?: readonly FiltroDax[];
  nombreMedida?: string;
}

const comillasDax = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** URL-encode en DAX (no tiene función nativa): reemplaza los caracteres problemáticos. */
function encodeDax(expr: string): string {
  const reemplazos: [string, string][] = [
    ["%", "%25"],
    [" ", "%20"],
    ["&", "%26"],
    ["#", "%23"],
    ["+", "%2B"],
    ['"', "%22"],
    ["{", "%7B"],
    ["}", "%7D"],
    ["?", "%3F"],
    ["=", "%3D"],
  ];
  return reemplazos.reduce((acc, [de, a]) => `SUBSTITUTE ( ${acc}, ${comillasDax(de)}, ${comillasDax(a)} )`, expr);
}

/** Escapa un valor para que sea un string JSON válido dentro del `ctx`. */
const jsonValorDax = (expr: string) => `SUBSTITUTE ( SUBSTITUTE ( ${expr}, "\\", "\\\\" ), """", "\\""" )`;

export function generarMedidaDax({ appUrl, tableroId, pagina, filtros = [], nombreMedida = "URL Reportar problema" }: OpcionesDax): string {
  const base = `${appUrl.replace(/\/+$/, "")}/nuevo?tablero=${tableroId}${pagina ? `&pagina=${pagina}` : ""}`;
  const lineas = [`${nombreMedida} =`, `VAR _base = ${comillasDax(base)}`];

  const validos = filtros.filter((f) => f.clave.trim() && f.columna.trim());
  if (validos.length === 0) {
    lineas.push("RETURN", "    _base");
    return lineas.join("\n");
  }

  validos.forEach((f, i) => {
    lineas.push(`VAR _f${i} = ${jsonValorDax(`SELECTEDVALUE ( ${f.columna.trim()}, "" )`)}`);
  });
  const partes = validos
    .map((f, i) => `${comillasDax(`${i === 0 ? "{" : ","}"${f.clave.trim().replace(/["\\]/g, "")}":"`)} & _f${i} & """"`)
    .join(" & ");
  lineas.push(`VAR _ctx = ${partes} & "}"`);
  lineas.push("RETURN", `    _base & "&ctx=" & ${encodeDax("_ctx")}`);
  return lineas.join("\n");
}
