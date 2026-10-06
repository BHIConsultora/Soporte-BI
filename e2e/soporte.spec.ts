import { entrarComo, esMobile, expect, sinScrollHorizontal, sinViolacionesSerias, test } from "./helpers";

test.describe("soporte", () => {
  test("kanban: columnas, filtros, tomar y mover con teclado", async ({ page }) => {
    await entrarComo(page, "soporte", "/soporte");
    for (const col of ["Nuevo (5)", "En análisis (3)", "Esperando al cliente (2)", "Resuelto (3)"]) {
      await expect(page.getByRole("region", { name: col })).toBeVisible();
    }
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);

    // Filtros.
    await page.getByText("Con borrador pendiente").click();
    await expect(page.getByRole("link", { name: /^TCK-\d{4}$/ })).toHaveCount(2);
    await page.getByText("Con borrador pendiente").click();
    await page.getByLabel("Cliente", { exact: true }).selectOption("Cooperativa del Litoral");
    await expect(page.getByRole("link", { name: /^TCK-\d{4}$/ })).toHaveCount(2);
    await page.getByLabel("Cliente", { exact: true }).selectOption("");

    // Tomar.
    await page.getByRole("button", { name: "Tomar TCK-0009" }).click();
    await page.getByText("Míos").click();
    await expect(page.getByRole("link", { name: "TCK-0009" })).toBeVisible();
    await page.getByText("Míos").click();

    // Mover con teclado: Espacio, flecha derecha, Espacio. En mobile las columnas están en un
    // carrusel horizontal y el cambio de estado accesible es desde el detalle (otro test).
    if (esMobile(page)) return;
    await page.getByRole("button", { name: "Mover TCK-0001" }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(page.getByRole("region", { name: "En análisis (4)" })).toContainText("TCK-0001");
    await page.reload();
    await expect(page.getByRole("region", { name: "En análisis (4)" })).toContainText("TCK-0001");
  });

  test("detalle: publicar borrador de Claude y el cliente lo ve", async ({ page }) => {
    await entrarComo(page, "soporte", "/soporte/tickets/TCK-0002");
    const bloque = page.getByRole("region", { name: "Claude · IA · Interno: Borrador de respuesta" });
    await expect(bloque).toBeVisible();
    await expect(page.getByRole("region", { name: "Claude · IA · Interno: Nota interna" })).toBeVisible();
    await sinViolacionesSerias(page);

    await bloque.getByRole("textbox").fill("¡Hola Ulises! Ya encontramos el problema con la conexión. Te avisamos cuando quede resuelto.");
    await bloque.getByRole("button", { name: "Publicar" }).click();
    const confirmar = page.getByRole("dialog", { name: "¿Publicar la respuesta?" });
    await expect(confirmar).toContainText("Esto lo va a ver el cliente");
    await page.keyboard.press("Escape");
    await expect(confirmar).toBeHidden();
    await bloque.getByRole("button", { name: "Publicar" }).click();
    await confirmar.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Publicado")).toBeVisible();

    // Nota interna.
    await page.getByRole("textbox", { name: "Nota interna" }).fill("Revisar la cuenta de servicio del gateway.");
    await page.getByRole("button", { name: "Agregar nota" }).click();
    await expect(page.getByText("Revisar la cuenta de servicio del gateway.")).toBeVisible();

    // El cliente ve la respuesta publicada pero no la nota ni nada de Claude.
    await entrarComo(page, "usuario", "/tickets/TCK-0002");
    await expect(page.getByText("Ya encontramos el problema con la conexión")).toBeVisible();
    await expect(page.getByText("Revisar la cuenta de servicio")).toHaveCount(0);
    await expect(page.getByText("Claude")).toHaveCount(0);
  });

  test("detalle: cambiar estado, prioridad y asignación", async ({ page }) => {
    await entrarComo(page, "soporte", "/soporte/tickets/TCK-0004");
    await page.getByLabel("Estado").selectOption("Esperando al cliente");
    await page.getByLabel("Prioridad").selectOption("P2");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Prioridad: P3 → P2")).toBeVisible();
    await page.getByRole("button", { name: "Tomar" }).click();
    await expect(page.getByText("Asignado a: sofia.soporte@bhi.example.com")).toBeVisible();

    await entrarComo(page, "usuario2", "/tickets/TCK-0004");
    await expect(page.getByText("El equipo está esperando tu respuesta.")).toBeVisible();
    await expect(page.getByText("sofia.soporte@bhi.example.com")).toHaveCount(0);
  });

  test("descartar un borrador", async ({ page }) => {
    await entrarComo(page, "soporte", "/soporte/tickets/TCK-0007");
    await page.getByRole("button", { name: "Descartar" }).click();
    await page.getByRole("dialog", { name: "¿Descartar el borrador?" }).getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByText("Descartado")).toBeVisible();
  });

  test("el contexto de Power BI se muestra como dato", async ({ page }) => {
    await entrarComo(page, "soporte", "/soporte/tickets/TCK-0001");
    await expect(page.getByRole("heading", { name: "Contexto de Power BI" })).toBeVisible();
    await expect(page.getByText("NOA", { exact: true })).toBeVisible();
  });
});
