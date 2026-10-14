import { describe, expect, it } from "vitest";
import { buildCsp } from "@/infra/csp";

describe("CSP", () => {
  const csp = buildCsp("https://abcd.supabase.co/");

  it("tiene las directivas obligatorias", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("solo habilita conexiones al proyecto de Supabase (HTTP y realtime)", () => {
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co;");
    expect(buildCsp()).toContain("connect-src 'self';");
  });

  it("no permite unsafe-eval ni unsafe-inline en scripts", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
