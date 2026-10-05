import { useSession } from "@/lib/session";
import type { Rol } from "@/lib/types";

const ROLES: Rol[] = ["usuario", "referente", "soporte"];

export function RoleSwitcher() {
  const { me, switchMockRole } = useSession();
  return (
    <div className="card-soft fixed bottom-4 right-4 z-50 p-3 text-xs">
      <p className="mb-2 font-display font-semibold">Modo de prueba · rol</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rol de prueba">
        {ROLES.map((r) => (
          <button
            key={r}
            role="radio"
            aria-checked={me?.rol === r}
            onClick={() => switchMockRole(r)}
            className={`rounded-full px-3 py-1 capitalize ${me?.rol === r ? "bg-main text-on-main" : "bg-muted hover:bg-accent"}`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
