import { entrarComo, expect, sinScrollHorizontal, sinViolacionesSerias, test } from "./helpers";

test.describe("admin", () => {
  test("alta de cliente por dominio (TenantId resuelto)", async ({ page }) => {
    await entrarComo(page, "admin", "/admin");
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);

    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    const dialogo = page.getByRole("dialog", { name: "Nuevo cliente" });
    await dialogo.getByLabel("Nombre").fill("Frigorífico del Sur");
    await dialogo.getByLabel("Dominio").fill("frigorifico.example.com");
    await dialogo.getByRole("button", { name: "Buscar TenantId" }).click();
    await expect(dialogo.getByLabel("TenantId")).toHaveValue(/^[0-9a-f-]{36}$/);
    await dialogo.getByLabel("Referentes generales").fill("gerencia@frigorifico.example.com");
    await dialogo.getByRole("button", { name: "Guardar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText("Frigorífico del Sur")).toBeVisible();
  });

  test("alta de tablero multi-área y medida DAX", async ({ page }) => {
    await entrarComo(page, "admin", "/admin?seccion=tableros");
    await page.getByRole("button", { name: "Nuevo tablero" }).click();
    const dialogo = page.getByRole("dialog", { name: "Nuevo tablero" });
    await dialogo.getByLabel("Cliente").selectOption({ label: "Distribuidora Andina" });
    await dialogo.getByLabel("Nombre").fill("Rentabilidad");
    await dialogo.getByLabel("Identificador").fill("rentabilidad");
    await dialogo.getByLabel("Comercial").check();
    await dialogo.getByLabel("Finanzas").check();
    await dialogo.getByLabel("Páginas").fill("resumen, detalle");
    await dialogo.getByRole("button", { name: "Guardar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText("Rentabilidad", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Medida DAX de Rentabilidad" }).click();
    const dax = page.getByRole("dialog", { name: /Rentabilidad/ });
    await dax.getByLabel("Página").selectOption("detalle");
    await expect(dax.getByLabel("Medida DAX")).toContainText("/nuevo?tablero=rentabilidad&pagina=detalle");
    await dax.getByRole("button", { name: "Agregar filtro" }).click();
    await dax.getByLabel("Nombre del filtro 1").fill("Zona");
    await dax.getByLabel("Columna del filtro 1").fill("'Dim Zona'[Zona]");
    await expect(dax.getByLabel("Medida DAX")).toContainText("SELECTEDVALUE ( 'Dim Zona'[Zona]");
    await page.keyboard.press("Escape");
    await expect(dax).toBeHidden();

    // El líder de Comercial ya puede reportar sobre el tablero nuevo.
    await entrarComo(page, "lider", "/nuevo?tablero=rentabilidad");
    await expect(page.getByText("Rentabilidad", { exact: true })).toBeVisible();
  });

  test("áreas y líderes", async ({ page }) => {
    await entrarComo(page, "admin", "/admin?seccion=areas");
    await page.getByRole("button", { name: "Editar área Logística de Distribuidora Andina" }).click();
    const dialogo = page.getByRole("dialog", { name: "Editar área" });
    await dialogo.getByLabel("Líderes").fill("paula.perez@andina.example.com");
    await dialogo.getByRole("button", { name: "Guardar" }).click();
    await expect(dialogo).toBeHidden();

    // Paula ahora es líder de Logística y ve sus tableros.
    await entrarComo(page, "usuario2");
    await expect(page.getByRole("link", { name: "Logística" })).toBeVisible();
  });

  test("aprobar una solicitud de acceso habilita la organización", async ({ page }) => {
    await entrarComo(page, "admin", "/admin?seccion=solicitudes");
    await page.getByRole("button", { name: "Aprobar la solicitud de nadia@otra.example.com" }).click();
    await expect(page.getByText("Aprobada")).toBeVisible();
    await entrarComo(page, "no-habilitado");
    await expect(page.getByRole("heading", { name: "Mis reclamos" })).toBeVisible();
  });

  test("feriados", async ({ page }) => {
    await entrarComo(page, "admin", "/admin?seccion=feriados");
    await page.getByLabel("Fecha").fill("2026-11-23");
    await page.getByLabel("Descripción").fill("Feriado puente");
    await page.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByText("23/11/2026")).toBeVisible();
    await page.getByRole("button", { name: "Quitar el feriado Feriado puente" }).click();
    await expect(page.getByText("23/11/2026")).toHaveCount(0);
  });

  test("consentimiento: pantalla y sección de admin", async ({ page }) => {
    await page.goto("/consentimiento");
    await expect(page.getByRole("heading", { name: "Falta un permiso de tu organización" })).toBeVisible();
    await sinViolacionesSerias(page);
    await entrarComo(page, "admin", "/admin?seccion=consentimiento");
    await expect(page.getByText("En modo demo no hay app de Entra configurada.")).toBeVisible();
  });
});
