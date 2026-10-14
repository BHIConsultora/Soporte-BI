import { useEffect, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useSesion, useTitulo } from "@/app/sesion";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rutaInternaSegura } from "@/infra/rutas";

export function BienvenidaPage() {
  useTitulo("Bienvenida");
  const { backend, usuario } = useSesion();
  const volver = rutaInternaSegura(useSearchParams()[0].get("volver"));
  if (usuario) return <Navigate to={volver} replace />;

  return (
    <PublicShell>
      <Card className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-main">Soporte de tableros BI</h1>
          <p className="text-muted-foreground">
            Contanos qué pasa con tu tablero de Power BI y seguí la respuesta del equipo de BHI.
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={`/auth/login?volver=${encodeURIComponent(volver)}`}>Iniciar sesión con Microsoft</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Usá tu cuenta de trabajo. No hace falta crear un usuario.</p>
        {backend.demo && (
          <p className="rounded-xl bg-internal px-3 py-2 text-sm">
            <strong>Modo demo:</strong> entrás con una persona de prueba y después la podés cambiar desde el botón flotante.
          </p>
        )}
      </Card>
    </PublicShell>
  );
}

export function ElegirClientePage() {
  useTitulo("Elegí el cliente");
  const { backend, usuario, acceso, recargar } = useSesion();

  if (!usuario) return <Navigate to="/bienvenida" replace />;
  if (acceso?.tipo !== "elegir_cliente") return <Navigate to="/" replace />;

  async function continuar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clienteId = Number(new FormData(e.currentTarget).get("clienteId"));
    // El backend valida contra las membresías actuales: elegir un cliente ajeno no abre nada.
    // Con el acceso ya resuelto, esta misma página redirige a "/".
    if (Number.isSafeInteger(clienteId)) await backend.elegirCliente(clienteId);
    await recargar();
  }

  return (
    <PublicShell>
      <Card className="space-y-5">
        <h1 className="font-display text-2xl font-semibold text-main">¿Con qué cliente vas a trabajar?</h1>
        <p className="text-muted-foreground">Tu cuenta está habilitada en más de un cliente. Lo podés cambiar después saliendo y volviendo a entrar.</p>
        <form onSubmit={continuar} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="sr-only">Cliente</legend>
            {acceso.clientes.map((c, i) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 has-checked:border-main">
                <input type="radio" name="clienteId" value={c.id} defaultChecked={i === 0} className="accent-main" />
                {c.nombre}
              </label>
            ))}
          </fieldset>
          <Button type="submit" className="w-full">
            Continuar
          </Button>
        </form>
      </Card>
    </PublicShell>
  );
}

const MENSAJES = {
  tenant_no_habilitado: {
    titulo: "Tu organización todavía no está habilitada",
    texto: "Registramos tu pedido de acceso. El equipo de BHI lo va a revisar y te avisamos cuando esté listo.",
  },
  sin_permiso: {
    titulo: "Tu cuenta no tiene acceso al portal",
    texto: "Si creés que es un error, pedile a tu referente o al equipo de BHI que te habilite.",
  },
} as const;

export function NoHabilitadoPage() {
  useTitulo("Acceso no habilitado");
  const { backend, acceso } = useSesion();
  const motivo = useSearchParams()[0].get("motivo") === "tenant_no_habilitado" ? "tenant_no_habilitado" : "sin_permiso";
  const { titulo, texto } = MENSAJES[motivo];

  // El pedido se registra según el acceso real, no según el parámetro de la URL.
  const tenantNoHabilitado = acceso?.tipo === "denegado" && acceso.code === "tenant_no_habilitado";
  useEffect(() => {
    if (tenantNoHabilitado) void backend.registrarSolicitudAcceso();
  }, [backend, tenantNoHabilitado]);

  return (
    <PublicShell>
      <Card className="space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-main">{titulo}</h1>
        <p className="text-muted-foreground">{texto}</p>
        <Button asChild variant="outline">
          <Link to="/auth/logout">Salir y entrar con otra cuenta</Link>
        </Button>
      </Card>
    </PublicShell>
  );
}

export function NotFoundPage() {
  useTitulo();
  return (
    <PublicShell>
      <Card className="space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-main">No encontramos esta página</h1>
        <p className="text-muted-foreground">Puede que el link esté mal o que no tengas acceso a lo que buscás.</p>
        <Button asChild>
          <Link to="/">Ir a mis reclamos</Link>
        </Button>
      </Card>
    </PublicShell>
  );
}
