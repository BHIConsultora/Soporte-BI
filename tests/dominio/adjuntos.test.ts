import { describe, expect, it } from "vitest";
import { detectarFormato, MAX_BYTES_ADJUNTO, sanearNombre, validarAdjuntos } from "@/dominio/adjuntos";

const bytes = (...partes: (number[] | string)[]) =>
  new Uint8Array(partes.flatMap((p) => (typeof p === "string" ? [...new TextEncoder().encode(p)] : p)));

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "resto");
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "resto");
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const PDF = bytes("%PDF-1.7\n");
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const XLSX = bytes(ZIP, "....[Content_Types].xml....xl/workbook.xml....");
const XLSM = bytes(ZIP, "....[Content_Types].xml....xl/workbook.xml....xl/vbaProject.bin....");
const DOCX = bytes(ZIP, "....[Content_Types].xml....word/document.xml....");
const CSV = bytes("zona;ventas\nNOA;1.234,50\nCórdoba;99\n");
const EXE = bytes("MZ", [0x90, 0, 3, 0]);
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');

const archivo = (nombre: string, datos: Uint8Array) => ({ nombre, datos });

describe("detección por magic bytes", () => {
  it.each([
    ["png", PNG, "png"],
    ["jpg", JPEG, "jpeg"],
    ["webp", WEBP, "webp"],
    ["pdf", PDF, "pdf"],
    ["xlsx", XLSX, "xlsx"],
    ["csv", CSV, "csv"],
  ])("%s", (ext, datos, esperado) => {
    expect(detectarFormato(datos, ext)).toBe(esperado);
  });

  it.each([
    ["XLSM (macros)", XLSM, "xlsx"],
    ["DOCX (ZIP de Office sin hoja)", DOCX, "xlsx"],
    ["ejecutable", EXE, "png"],
    ["SVG", SVG, "svg"],
    ["CSV con bytes nulos", bytes("a,b\n", [0], "c"), "csv"],
    ["CSV con UTF-8 inválido", bytes("a,b\n", [0xc3, 0x28]), "csv"],
    ["CSV vacío", new Uint8Array(), "csv"],
  ])("rechaza %s", (_n, datos, ext) => {
    expect(detectarFormato(datos, ext)).toBeNull();
  });
});

describe("validarAdjuntos", () => {
  it("acepta los formatos permitidos y devuelve el tipo real", () => {
    const r = validarAdjuntos([archivo("captura.PNG", PNG), archivo("datos.xlsx", XLSX), archivo("export.csv", CSV)]);
    expect(r.ok && r.archivos.map((a) => a.tipo)).toEqual([
      "image/png",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ]);
  });

  it.each([
    ["SVG", archivo("logo.svg", SVG)],
    ["XLSM renombrado a .xlsx", archivo("planilla.xlsx", XLSM)],
    ["XLSM con su extensión", archivo("planilla.xlsm", XLSM)],
    ["ejecutable renombrado a .png", archivo("foto.png", EXE)],
    ["PNG con extensión de PDF", archivo("doc.pdf", PNG)],
    ["CSV binario", archivo("x.csv", bytes([0, 1, 2, 3]))],
    ["sin extensión", archivo("captura", PNG)],
  ])("rechaza %s (422)", (_n, a) => {
    const r = validarAdjuntos([a]);
    expect(r).toMatchObject({ ok: false, error: { code: "tipo_no_permitido", status: 422 } });
  });

  it("máximo 3 archivos", () => {
    const r = validarAdjuntos([1, 2, 3, 4].map((i) => archivo(`c${i}.png`, PNG)));
    expect(r).toMatchObject({ ok: false, error: { code: "demasiados_adjuntos" } });
  });

  it("máximo 4 MB por archivo (413)", () => {
    const grande = new Uint8Array(MAX_BYTES_ADJUNTO + 1);
    grande.set(PNG);
    expect(validarAdjuntos([archivo("g.png", grande)])).toMatchObject({ ok: false, error: { code: "adjunto_muy_grande", status: 413 } });
    const justo = new Uint8Array(MAX_BYTES_ADJUNTO);
    justo.set(PNG);
    expect(validarAdjuntos([archivo("j.png", justo)]).ok).toBe(true);
  });

  it("máximo 10 MB por request (413)", () => {
    const pdf = new Uint8Array(3.5 * 1024 * 1024);
    pdf.set(PDF);
    const r = validarAdjuntos([archivo("a.pdf", pdf), archivo("b.pdf", pdf), archivo("c.pdf", pdf)]);
    expect(r).toMatchObject({ ok: false, error: { code: "request_muy_grande", status: 413 } });
  });

  it("sanea el nombre original (sin rutas ni caracteres de control)", () => {
    expect(sanearNombre("C:\\Users\\x\\..\\captura<1>.png")).toBe("captura_1_.png");
    expect(sanearNombre("../../etc/passwd")).toBe("passwd");
    expect(sanearNombre("a\u0000b.csv")).toBe("a_b.csv");
    expect(sanearNombre("")).toBe("archivo");
  });
});
