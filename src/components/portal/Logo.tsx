/** Marca de BHI. Reemplazar por logo-long.webp / logo-short.svg cuando estén disponibles. */
export function LogoShort({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-on-main/40 font-display text-sm font-bold text-on-main ${className}`}
      aria-hidden
    >
      BHI
    </span>
  );
}

export function LogoLong({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-on-main ${className}`}>
      <LogoShort />
      <span className="font-display text-sm leading-tight">
        BHI <span className="opacity-80">Consultora Regional</span>
      </span>
    </span>
  );
}
