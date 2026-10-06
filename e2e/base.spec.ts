import { expect, test } from "@playwright/test";
import { entrarComo, sinScrollHorizontal, sinViolacionesSerias } from "./helpers";

test.describe("etapa 0 · base en modo demo", () => {
  test("sin sesión redirige a bienvenida conservando la URL", async ({ page }) => {
    await page.goto("/?vista=org");
    await expect(page).toHaveURL(/\/bienvenida\?volver=%2F%3Fvista%3Dorg$/);
    await expect(page.getByRole("link", { name: "Iniciar sesión con Microsoft" })).toBeVisible();
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);
  });

  test("usuario ve solo sus reclamos", async ({ page }) => {
    await entrarComo(page, "usuario");
    await expect(page.getByRole("heading", { name: "Mis reclamos" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Reclamos" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("navigation", { name: "Qué reclamos ver" })).toHaveCount(0);
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);
  });

  test("referente ve toda su organización", async ({ page }) => {
    await entrarComo(page, "referente");
    await page.getByRole("link", { name: "De mi organización" }).click();
    await expect(page.getByRole("list", { name: "Reclamos" }).getByRole("listitem")).toHaveCount(9);
  });

  test("líder ve los tableros de su área", async ({ page }) => {
    await entrarComo(page, "lider");
    await page.getByRole("link", { name: "Comercial" }).click();
    await expect(page.getByRole("list", { name: "Reclamos" }).getByRole("listitem")).toHaveCount(5);
  });

  test("invitado de BHI queda afuera", async ({ page }) => {
    await entrarComo(page, "invitado");
    await expect(page).toHaveURL(/\/no-habilitado\?motivo=sin_permiso/);
    await expect(page.getByRole("heading", { name: "Tu cuenta no tiene acceso al portal" })).toBeVisible();
  });

  test("tenant no habilitado ve el aviso correspondiente", async ({ page }) => {
    await entrarComo(page, "no-habilitado");
    await expect(page).toHaveURL(/motivo=tenant_no_habilitado/);
    await sinViolacionesSerias(page);
  });

  test("satélite en dos clientes elige con cuál trabajar", async ({ page }) => {
    await entrarComo(page, "satelite-multi");
    await expect(page).toHaveURL(/\/elegir-cliente$/);
    await page.getByLabel("Estudio Patagonia").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Mis reclamos" })).toBeVisible();
    await expect(page.getByText("TCK-0013")).toBeVisible();
    await expect(page.getByText("TCK-0014")).toHaveCount(0);
  });

  test("cerrar sesión vuelve a bienvenida", async ({ page }) => {
    await entrarComo(page, "usuario");
    await page.getByRole("link", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/bienvenida$/);
  });

  test("headers de seguridad y CSP con nonce", async ({ page }) => {
    const res = await page.goto("/bienvenida");
    const h = res!.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("el cambio de persona rechaza otro origen", async ({ request }) => {
    const res = await request.post("/api/demo/persona", {
      form: { persona: "admin", volver: "/" },
      headers: { origin: "https://malo.example.com" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ code: "sin_permiso", requestId: expect.any(String) });
  });
});
