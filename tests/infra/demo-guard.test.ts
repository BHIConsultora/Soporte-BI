import { describe, expect, it } from "vitest";
import { assertDemoModeAllowed, isDemoFlag } from "@/infra/demo-guard";

describe("guardia del modo demo", () => {
  it("solo se activa con DEMO_MODE=true exacto", () => {
    expect(isDemoFlag({ DEMO_MODE: "true" })).toBe(true);
    expect(isDemoFlag({ DEMO_MODE: "1" })).toBe(false);
    expect(isDemoFlag({})).toBe(false);
  });

  it("falla con DEMO_MODE=true en producción de Vercel", () => {
    expect(() => assertDemoModeAllowed({ DEMO_MODE: "true", VERCEL_ENV: "production" })).toThrow(/DEMO_MODE/);
  });

  it("permite demo en preview y desarrollo, y producción sin demo", () => {
    expect(() => assertDemoModeAllowed({ DEMO_MODE: "true", VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertDemoModeAllowed({ DEMO_MODE: "true" })).not.toThrow();
    expect(() => assertDemoModeAllowed({ VERCEL_ENV: "production" })).not.toThrow();
  });
});
