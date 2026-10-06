import { describe, expect, it } from "vitest";
import { generarMedidaDax } from "@/dominio/dax";
import { listaEmailsSchema, nuevoTicketSchema, parsearContexto, slugSchema } from "@/dominio/esquemas";

describe("contexto del botón de Power BI (ctx)", () => {
  it("acepta un objeto plano de strings", () => {
    expect(parsearContexto('{"Zona":"NOA","Mes":"2026-09"}')).toEqual({ Zona: "NOA", Mes: "2026-09" });
  });

  it.each([
    ["no JSON", "zona=NOA"],
    ["array", "[1,2]"],
    ["valor no string", '{"a":1}'],
    ["objeto anidado", '{"a":{"b":"c"}}'],
    ["vacío", "{}"],
    ["null", "null"],
    ["valor demasiado largo", JSON.stringify({ a: "x".repeat(201) })],
    ["demasiadas claves", JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"])))],
  ])("descarta %s", (_n, raw) => {
    expect(parsearContexto(raw)).toBeNull();
  });
});

describe("esquemas", () => {
  it("descripción mínima de 20 caracteres", () => {
    const base = { tableroId: "ventas-dtc", tipo: "Consulta", urgencia: "Baja" };
    expect(nuevoTicketSchema.safeParse({ ...base, descripcion: "muy corto" }).success).toBe(false);
    expect(nuevoTicketSchema.safeParse({ ...base, descripcion: "Esto tiene más de veinte caracteres" }).success).toBe(true);
    expect(nuevoTicketSchema.safeParse({ ...base, descripcion: "Esto tiene más de veinte caracteres", tipo: "Inventado" }).success).toBe(false);
  });

  it("slugs de tableros", () => {
    expect(slugSchema.safeParse("ventas-dtc").success).toBe(true);
    for (const malo of ["Ventas", "ventas dtc", "-ventas", "ventas--dtc", "campaña", "a"]) expect(slugSchema.safeParse(malo).success).toBe(false);
  });

  it("listas de emails: separa, normaliza y valida", () => {
    expect(listaEmailsSchema.parse(" Ana@Empresa.com ; juan@empresa.com,\npedro@empresa.com ")).toEqual([
      "ana@empresa.com",
      "juan@empresa.com",
      "pedro@empresa.com",
    ]);
    expect(listaEmailsSchema.safeParse("ana@empresa.com; no-es-email").success).toBe(false);
    expect(listaEmailsSchema.parse("")).toEqual([]);
  });
});

describe("medida DAX del botón", () => {
  it("sin filtros: URL con tablero y página", () => {
    const dax = generarMedidaDax({ appUrl: "https://soporte.example.com/", tableroId: "ventas-dtc", pagina: "resumen" });
    expect(dax).toContain('VAR _base = "https://soporte.example.com/nuevo?tablero=ventas-dtc&pagina=resumen"');
    expect(dax).toMatch(/RETURN\n {4}_base$/);
  });

  it("con filtros: arma ctx en JSON y lo codifica", () => {
    const dax = generarMedidaDax({
      appUrl: "https://soporte.example.com",
      tableroId: "ventas-dtc",
      filtros: [
        { clave: "Zona", columna: "'Dim Zona'[Zona]" },
        { clave: "Mes", columna: "'Calendario'[Mes]" },
      ],
    });
    expect(dax).toContain("SELECTEDVALUE ( 'Dim Zona'[Zona], \"\" )");
    expect(dax).toContain('"{""Zona"":""" & _f0');
    expect(dax).toContain('",""Mes"":""" & _f1');
    expect(dax).toContain('_base & "&ctx=" & SUBSTITUTE');
    expect(dax).toContain('"%22"');
  });

  it("ignora filtros incompletos y limpia comillas de la clave", () => {
    const dax = generarMedidaDax({
      appUrl: "https://x.example.com",
      tableroId: "t1",
      filtros: [
        { clave: "", columna: "'T'[c]" },
        { clave: 'Zo"na', columna: "'T'[z]" },
      ],
    });
    expect(dax).toContain('"{""Zona"":"""');
    expect(dax).not.toContain("_f1");
  });
});
