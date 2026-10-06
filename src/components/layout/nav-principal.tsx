"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavPrincipal({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" || ruta.startsWith("/tickets") : ruta.startsWith(href));
  return (
    <nav aria-label="Principal" className="border-t border-on-main/15">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4">
        {enlaces.map((e) => (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={activo(e.href) ? "page" : undefined}
              className={cn(
                "inline-block border-b-2 px-3 py-2 font-display text-sm whitespace-nowrap",
                activo(e.href) ? "border-on-main" : "border-transparent opacity-85 hover:opacity-100",
              )}
            >
              {e.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
