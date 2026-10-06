import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

export const ORIGEN = "http://localhost:3100";

/** Cada test arranca con los datos demo iniciales. */
export const test = base.extend<{ demoLimpia: void }>({
  demoLimpia: [
    async ({ request }, usar) => {
      const r = await request.post("/api/demo/reiniciar", { headers: { origin: ORIGEN } });
      expect(r.status()).toBe(204);
      await usar();
    },
    { auto: true },
  ],
});
export { expect };

/** Token CSRF de doble envío del navegador (lo pone el servidor al abrir cualquier página). */
export async function tokenCsrf(page: Page): Promise<string> {
  let cookie = (await page.context().cookies()).find((c) => c.name === "__Host-sbi_csrf");
  if (!cookie) {
    await page.goto("/bienvenida");
    cookie = (await page.context().cookies()).find((c) => c.name === "__Host-sbi_csrf");
  }
  expect(cookie, "falta la cookie CSRF").toBeTruthy();
  return cookie!.value;
}

/** Inicia sesión como una persona demo (rápido: sin pasar por el selector flotante). */
export async function entrarComo(page: Page, persona: string, volver = "/") {
  const r = await page.request.post("/api/demo/persona", {
    form: { persona, volver, csrf: await tokenCsrf(page) },
    headers: { origin: ORIGEN },
    maxRedirects: 0,
  });
  expect(r.status()).toBe(303);
  await page.goto(volver);
}

/** Entra con el selector flotante del modo demo, como lo haría una persona. */
export async function cambiarPersonaConSelector(page: Page, persona: string) {
  await page.getByText("Modo demo · cambiar persona").click();
  await page.getByLabel("Entrar como").selectOption(persona);
  await page.getByRole("button", { name: "Cambiar" }).click();
}

/** Links visibles a tickets (tabla en escritorio, tarjetas en mobile). */
export const linksTickets = (page: Page) => page.getByRole("link", { name: /^TCK-\d{4}$/ });

export async function idsVisibles(page: Page): Promise<string[]> {
  return (await linksTickets(page).allTextContents()).sort();
}

export async function sinViolacionesSerias(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serias = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serias.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function sinScrollHorizontal(page: Page) {
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(desborda).toBe(false);
}

export const esMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;
