import { describe, expect, it } from "vitest";
import { buildCsp } from "@/proxy";

describe("CSP", () => {
  const csp = buildCsp("abc123", false);

  it("tiene las directivas obligatorias", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self' https://login.microsoftonline.com");
  });

  it("no permite unsafe-eval ni unsafe-inline en scripts fuera de desarrollo", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(buildCsp("x", true)).toContain("'unsafe-eval'");
  });
});
