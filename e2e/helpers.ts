import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Entra con la persona por defecto y, si hace falta, cambia a otra desde el selector demo. */
export async function entrarComo(page: Page, persona: string, volver = "/") {
  await page.goto(`/api/auth/login?volver=${encodeURIComponent(volver)}`);
  if (persona === "usuario") return;
  await page.getByText("Modo demo · cambiar persona").click();
  await page.getByLabel("Entrar como").selectOption(persona);
  await page.getByRole("button", { name: "Cambiar" }).click();
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
