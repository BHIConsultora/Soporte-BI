import { cambiarPersonaConSelector, entrarComo, expect, idsVisibles, ORIGEN, sinScrollHorizontal, sinViolacionesSerias, test, tokenCsrf } from "./helpers";

test.describe("base · sesión, roles y seguridad", () => {
  test("sin sesión redirige a bienvenida conservando la URL", async ({ page }) => {
    await page.goto("/?vista=org");
    await expect(page).toHaveURL(/\/bienvenida\?volver=%2F%3Fvista%3Dorg$/);
    await expect(page.getByRole("link", { name: "Iniciar sesión con Microsoft" })).toBeVisible();
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);
  });

  test("el selector flotante del modo demo cambia de persona", async ({ page }) => {
    await page.goto("/api/auth/login?volver=%2F");
    await expect(page.getByRole("heading", { name: "Mis reclamos" })).toBeVisible();
    await cambiarPersonaConSelector(page, "soporte");
    await expect(page).toHaveURL(/\/soporte$/);
    await expect(page.getByRole("heading", { name: "Reclamos" })).toBeVisible();
  });

  test("usuario ve solo sus reclamos", async ({ page }) => {
    await entrarComo(page, "usuario");
    await expect(page.getByRole("heading", { name: "Mis reclamos" })).toBeVisible();
    expect(await idsVisibles(page)).toEqual(["TCK-0001", "TCK-0002", "TCK-0008"]);
    await expect(page.getByRole("navigation", { name: "Qué reclamos ver" })).toHaveCount(0);
    // Pedir la vista de organización por URL no amplía nada.
    await page.goto("/?vista=org");
    expect(await idsVisibles(page)).toEqual(["TCK-0001", "TCK-0002", "TCK-0008"]);
    await sinViolacionesSerias(page);
    await sinScrollHorizontal(page);
  });

  test("invitado de BHI queda afuera", async ({ page }) => {
    await entrarComo(page, "invitado");
    await expect(page).toHaveURL(/\/no-habilitado\?motivo=sin_permiso/);
    await expect(page.getByRole("heading", { name: "Tu cuenta no tiene acceso al portal" })).toBeVisible();
  });

  test("tenant no habilitado ve el aviso y queda registrada la solicitud", async ({ page }) => {
    await entrarComo(page, "no-habilitado");
    await expect(page).toHaveURL(/motivo=tenant_no_habilitado/);
    await sinViolacionesSerias(page);
    await entrarComo(page, "admin", "/admin?seccion=solicitudes");
    await expect(page.getByText("nadia@otra.example.com")).toBeVisible();
  });

  test("satélite en dos clientes elige con cuál trabajar", async ({ page }) => {
    await entrarComo(page, "satelite-multi");
    await expect(page).toHaveURL(/\/elegir-cliente$/);
    await page.getByLabel("Estudio Patagonia").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Mis reclamos" })).toBeVisible();
    expect(await idsVisibles(page)).toEqual(["TCK-0013"]);
  });

  test("cerrar sesión vuelve a bienvenida", async ({ page }) => {
    await entrarComo(page, "usuario");
    await page.getByRole("link", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/bienvenida$/);
  });

  test("un cliente no ve las pantallas de soporte ni de admin (404)", async ({ page }) => {
    await entrarComo(page, "referente");
    for (const url of ["/soporte", "/soporte/tickets/TCK-0001", "/admin"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    }
  });

  test("soporte no ve admin (404)", async ({ page }) => {
    await entrarComo(page, "soporte", "/admin");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
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

  test("la API rechaza mutaciones de otro origen y pedidos sin sesión", async ({ request }) => {
    const otroOrigen = await request.post("/api/demo/persona", {
      form: { persona: "admin", volver: "/" },
      headers: { origin: "https://malo.example.com" },
      maxRedirects: 0,
    });
    expect(otroOrigen.status()).toBe(403);
    expect(await otroOrigen.json()).toMatchObject({ code: "sin_permiso", requestId: expect.any(String) });

    const sinSesion = await request.get("/api/tickets");
    expect(sinSesion.status()).toBe(401);
    const crearSinOrigen = await request.post("/api/tickets", { multipart: { tableroId: "ventas-dtc" } });
    expect(crearSinOrigen.status()).toBe(403);
    expect((await request.post("/api/demo/reiniciar", { headers: { origin: ORIGEN } })).status()).toBe(204);
  });

  test("API: un ticket ajeno da 404 y el DTO de cliente no trae internos", async ({ page }) => {
    await entrarComo(page, "usuario");
    const ajeno = await page.request.get("/api/tickets/TCK-0009");
    expect(ajeno.status()).toBe(404);
    const propio = await page.request.get("/api/tickets/TCK-0002");
    const json = await propio.json();
    expect(json).not.toHaveProperty("resumenIA");
    expect(JSON.stringify(json)).not.toContain("Claude");
    const adjunto = await page.request.get("/api/adjuntos/00000000-0000-4000-a000-000000000001");
    expect(adjunto.status()).toBe(200);
    expect(adjunto.headers()["content-disposition"]).toContain("attachment");
    expect(adjunto.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("CSRF: una mutación sin el token de doble envío se rechaza aunque tenga sesión y origen", async ({ page }) => {
    await entrarComo(page, "soporte");
    const sinToken = await page.request.patch("/api/tickets/TCK-0001", { data: { estado: "Cerrado" }, headers: { origin: ORIGEN } });
    expect(sinToken.status()).toBe(403);
    expect(await sinToken.json()).toMatchObject({ code: "csrf" });
    const conToken = await page.request.patch("/api/tickets/TCK-0001", {
      data: { prioridad: "P1" },
      headers: { origin: ORIGEN, "x-csrf-token": await tokenCsrf(page) },
    });
    expect(conToken.status()).toBe(200);
  });

  test("el selector demo sin token CSRF se rechaza", async ({ page }) => {
    await page.goto("/bienvenida");
    const r = await page.request.post("/api/demo/persona", { form: { persona: "admin", volver: "/" }, headers: { origin: ORIGEN }, maxRedirects: 0 });
    expect(r.status()).toBe(403);
  });

  test("cookies de sesión y CSRF con prefijo __Host- y atributos seguros", async ({ page }) => {
    await entrarComo(page, "usuario");
    const cookies = await page.context().cookies();
    const sesion = cookies.find((c) => c.name === "__Host-sbi_sesion")!;
    expect(sesion).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect(sesion.expires - Date.now() / 1000).toBeLessThanOrEqual(8 * 3600 + 5);
    const csrf = cookies.find((c) => c.name === "__Host-sbi_csrf")!;
    expect(csrf).toMatchObject({ httpOnly: false, secure: true, sameSite: "Lax" });
  });

  test("sin variables de Entra, el login real responde 503 y el callback vuelve a bienvenida", async ({ page }) => {
    const login = await page.request.get("/api/auth/login?modo=microsoft", { maxRedirects: 0 });
    expect(login.status()).toBe(503);
    await page.goto("/api/auth/callback?code=x&state=y");
    await expect(page).toHaveURL(/\/bienvenida\?error=login/);
    await expect(page.getByText("No pudimos completar el inicio de sesión")).toBeVisible();
  });
});
