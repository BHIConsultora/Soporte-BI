import { describe, expect, it } from "vitest";
import { assertDemoModeAllowed, isDemoFlag } from "@/infra/demo-guard";

describe("guardia del modo demo", () => {
  it("solo se activa con VITE_DEMO_MODE=true exacto", () => {
    expect(isDemoFlag({ VITE_DEMO_MODE: "true" })).toBe(true);
    expect(isDemoFlag({ VITE_DEMO_MODE: "1" })).toBe(false);
    expect(isDemoFlag({})).toBe(false);
  });

  it("falla si el modo demo convive con Supabase configurado", () => {
    expect(() => assertDemoModeAllowed({ VITE_DEMO_MODE: "true", VITE_SUPABASE_URL: "https://x.supabase.co" })).toThrow(
      /VITE_DEMO_MODE/,
    );
  });

  it("permite demo sin Supabase y Supabase sin demo", () => {
    expect(() => assertDemoModeAllowed({ VITE_DEMO_MODE: "true" })).not.toThrow();
    expect(() => assertDemoModeAllowed({ VITE_SUPABASE_URL: "https://x.supabase.co" })).not.toThrow();
  });
});
