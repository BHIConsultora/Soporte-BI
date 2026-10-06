import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requerirContexto } from "@/infra/contexto";
import { isDemoMode } from "@/infra/env";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { identidad, acceso } = await requerirContexto();
  const volver = (await headers()).get("x-url") ?? "/";
  return (
    <AppShell identidad={identidad} acceso={acceso} demo={isDemoMode() ? { volver } : null}>
      {children}
    </AppShell>
  );
}
