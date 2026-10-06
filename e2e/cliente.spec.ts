import { entrarComo, esMobile, expect, idsVisibles, sinScrollHorizontal, sinViolacionesSerias, test } from "./helpers";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("cliente · usuario", () => {
  test("alta desde el botón de Power BI (?tablero=) pasando por el login", async ({ page }) => {
    const link = "/nuevo?tablero=ventas-dtc&pagina=por-zona&ctx=" + encodeURIComponent(JSON.stringify({ Zona: "NOA" }));
    await page.goto(link);
    await expect(page).toHaveURL(/\/bienvenida\?volver=/);
    await page.getByRole("link", { name: "Iniciar sesión con Microsoft" }).click();

    // Vuelve al formulario con el tablero y la página precargados.
    await expect(page).toHaveURL(/\/nuevo\?tablero=ventas-dtc/);
    await expect(page.getByText("Ventas DTC", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Página")).toHaveValue("por-zona");
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);

    // Validaciones en castellano.
    await page.getByRole("button", { name: "Enviar reclamo" }).click();
    await expect(page.getByText("Elegí qué tipo de problema es.")).toBeVisible();

    await page.getByText("Dato incorrecto", { exact: true }).click();
    await page.getByLabel("Contanos el detalle").fill("Las ventas de NOA de septiembre no coinciden con el ERP.");
    await page.getByText("Alta", { exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "captura.png", mimeType: "image/png", buffer: PNG_1X1 });
    await expect(page.getByRole("list", { name: "Archivos adjuntos" })).toContainText("captura.png");
    await page.getByRole("button", { name: "Enviar reclamo" }).click();

    await expect(page.getByRole("heading", { name: "¡Listo! Recibimos tu reclamo" })).toBeVisible();
    await expect(page.getByText("TCK-0016")).toBeVisible();
    await page.getByRole("link", { name: "Ver el reclamo" }).click();

    await expect(page.getByRole("heading", { name: "TCK-0016" })).toBeVisible();
    await expect(page.getByText("Las ventas de NOA de septiembre")).toBeVisible();
    await expect(page.getByRole("link", { name: /captura\.png/ })).toBeVisible();
    await sinViolacionesSerias(page);
  });

  test("un tablero de otro cliente en el link se ignora y aparece el selector", async ({ page }) => {
    await entrarComo(page, "usuario", "/nuevo?tablero=acopio-granos");
    const selector = page.getByLabel("Tablero", { exact: true });
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue("");
    await expect(selector.locator("option")).toHaveText(["Elegí un tablero", "Cobranzas", "Margen por canal", "Stock por depósito", "Ventas DTC"]);
  });

  test("autoguarda el borrador del formulario", async ({ page }) => {
    await entrarComo(page, "usuario", "/nuevo");
    await page.getByLabel("Contanos el detalle").fill("Texto que no quiero perder si se cierra la pestaña.");
    await page.reload();
    await expect(page.getByText("Recuperamos lo que habías escrito.")).toBeVisible();
    await expect(page.getByLabel("Contanos el detalle")).toHaveValue("Texto que no quiero perder si se cierra la pestaña.");
    await page.getByRole("button", { name: "Empezar de cero" }).click();
    await expect(page.getByLabel("Contanos el detalle")).toHaveValue("");
  });

  test("resumen, búsqueda y filtro por estado", async ({ page }) => {
    await entrarComo(page, "usuario2");
    const resumen = page.getByRole("region", { name: "Resumen de tus reclamos" });
    await expect(resumen).toContainText("3Abiertos");
    await expect(resumen).toContainText("1Esperando tu respuesta");

    await page.getByLabel("Estado").selectOption("Nuevo");
    await page.getByRole("button", { name: "Buscar" }).click();
    expect(await idsVisibles(page)).toEqual(["TCK-0004"]);
    // El resumen no cambia con el filtro.
    await expect(resumen).toContainText("3Abiertos");

    await page.goto("/");
    await page.getByLabel("Buscar").fill("margen");
    await page.getByRole("button", { name: "Buscar" }).click();
    expect(await idsVisibles(page)).toEqual(["TCK-0003", "TCK-0007"]);
  });

  test("responder, marcar como resuelto y reabrir", async ({ page }) => {
    await entrarComo(page, "usuario2", "/tickets/TCK-0003");
    await expect(page.getByText("El equipo está esperando tu respuesta.")).toBeVisible();
    await page.getByLabel("Responder").fill("¡Sí, gracias! Con la nota alcanza.");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByText("¡Sí, gracias! Con la nota alcanza.")).toBeVisible();
    // Al responder vuelve a análisis.
    await expect(page.getByText("En análisis").first()).toBeVisible();

    await page.getByRole("button", { name: "Se resolvió" }).click();
    const dialogo = page.getByRole("dialog", { name: "¿Se resolvió tu problema?" });
    await expect(dialogo).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();

    await page.getByRole("button", { name: "Se resolvió" }).click();
    await dialogo.getByRole("button", { name: "Sí, se resolvió" }).click();
    await expect(page.getByRole("button", { name: "Reabrir" })).toBeVisible();

    await page.getByRole("button", { name: "Reabrir" }).click();
    await page.getByRole("dialog", { name: "¿Reabrir el reclamo?" }).getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("button", { name: "Se resolvió" })).toBeVisible();
  });

  test("un ticket ajeno da la página de no encontrado", async ({ page }) => {
    await entrarComo(page, "usuario", "/tickets/TCK-0009");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});

test.describe("cliente · líder y referente", () => {
  test("líder: ve el tablero compartido de su área pero solo responde los suyos", async ({ page }) => {
    await entrarComo(page, "lider");
    await page.getByRole("link", { name: "Comercial" }).click();
    expect(await idsVisibles(page)).toEqual(["TCK-0001", "TCK-0002", "TCK-0003", "TCK-0006", "TCK-0007"]);
    await page.goto("/tickets/TCK-0003");
    await expect(page.getByRole("heading", { name: "TCK-0003" })).toBeVisible();
    await expect(page.getByText("Solo quien creó el reclamo puede responder.")).toBeVisible();
    await expect(page.getByLabel("Responder")).toHaveCount(0);
    // TCK-0004 es de Finanzas (no lo lidera).
    await page.goto("/tickets/TCK-0004");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });

  test("referente: ve toda su organización y nada de otra", async ({ page }) => {
    await entrarComo(page, "referente");
    await page.getByRole("link", { name: "De mi organización" }).click();
    expect(await idsVisibles(page)).toHaveLength(9);
    await page.goto("/tickets/TCK-0009");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await page.goto("/tickets/TCK-0001");
    await expect(page.getByText("Solo quien creó el reclamo puede responder.")).toBeVisible();
    await sinViolacionesSerias(page);
  });

  test("mobile: tarjetas en lugar de tabla", async ({ page }) => {
    await entrarComo(page, "referente", "/?vista=org");
    if (esMobile(page)) {
      await expect(page.getByRole("table")).toBeHidden();
      await expect(page.getByRole("list", { name: "Reclamos" })).toBeVisible();
    } else {
      await expect(page.getByRole("table")).toBeVisible();
    }
    await sinScrollHorizontal(page);
  });
});
