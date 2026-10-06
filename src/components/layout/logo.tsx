import { cn } from "@/lib/utils";

/** Marca de BHI. Reemplazar por el logo oficial cuando esté disponible. */
export function LogoShort({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border border-current/40 font-display text-sm font-bold",
        className,
      )}
      aria-hidden
    >
      BHI
    </span>
  );
}

export function LogoLong({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoShort />
      <span className="font-display text-sm leading-tight">
        BHI <span className="opacity-80">Consultora Regional</span>
      </span>
    </span>
  );
}
