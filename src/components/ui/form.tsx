import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const claseCampo =
  "w-full rounded-xl border border-input bg-surface px-3 py-2 text-base sm:text-sm placeholder:text-muted-foreground focus-visible:border-main disabled:opacity-60 aria-invalid:border-destructive";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(claseCampo, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(claseCampo, "min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(claseCampo, "h-10", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-semibold", className)} {...props} />;
}

export function Ayuda({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function ErrorCampo({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm font-semibold text-destructive" role="alert">
      {children}
    </p>
  );
}

/** Mensaje de resultado de una acción (éxito o error), anunciado por lectores de pantalla. */
export function Aviso({ tipo, children }: { tipo: "ok" | "error"; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-3 py-2 text-sm",
        tipo === "error" ? "bg-destructive/10 font-semibold text-destructive" : "bg-st-resuelto text-st-resuelto-fg",
      )}
    >
      {children}
    </p>
  );
}
