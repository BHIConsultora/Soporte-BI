import type { RolBhi, RolCliente } from "@/dominio/catalogos";
import { supabase } from "@/integrations/supabase/client";
import { crearSupabaseRepo } from "@/repositorio/supabase";
import { armarAccesoCliente, type Acceso } from "@/servicios/acceso";
import type { Backend } from "./tipos";
import { guardarVolver, tomarVolver } from "./volver";

const SIN_PERMISO: Acceso = { tipo: "denegado", code: "sin_permiso" };

/**
 * Backend sobre Supabase (Lovable Cloud). Login con Microsoft por el proveedor `azure` de
 * Supabase Auth (con las apps de Entra ID ya registradas); permisos en RLS y `acceso_actual()`.
 */
export function crearBackendSupabase(): Backend {
  const repo = crearSupabaseRepo(supabase);

  return {
    repo,
    usuario: async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) return null;
      const meta = u.user_metadata as { full_name?: string; name?: string };
      return { oid: u.id, email: u.email ?? "", nombre: meta.full_name ?? meta.name ?? u.email ?? "" };
    },
    acceso: async () => {
      const { data: a, error } = await supabase.rpc("acceso_actual");
      if (error) throw new Error(`Supabase: ${error.message}`);
      switch (a.tipo) {
        case "bhi":
          return { tipo: "bhi", rol: a.rol as RolBhi };
        case "cliente": {
          const cliente = a.cliente_id === null ? null : await repo.clientes.obtener(a.cliente_id);
          if (!cliente) return SIN_PERMISO;
          const [areas, tableros] = await Promise.all([
            repo.areas.listarPorCliente(cliente.id),
            repo.tableros.listarPorCliente(cliente.id),
          ]);
          return armarAccesoCliente(a.rol as RolCliente, cliente, areas, tableros, a.areas_lideradas ?? []);
        }
        case "elegir_cliente": {
          // RLS ya limita `cliente` a los satélites a los que pertenece.
          const ids = new Set(a.clientes ?? []);
          return { tipo: "elegir_cliente", clientes: (await repo.clientes.listar()).filter((c) => ids.has(c.id)) };
        }
        case "denegado":
          return a.codigo === "tenant_no_habilitado" ? { tipo: "denegado", code: "tenant_no_habilitado" } : SIN_PERMISO;
        default:
          return SIN_PERMISO;
      }
    },
    iniciarSesion: async (volver) => {
      guardarVolver(volver);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "openid profile email",
          redirectTo: `${window.location.origin}/auth/callback`,
          // Deja elegir cuenta (sirve para "Salir y entrar con otra cuenta").
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw new Error(`Supabase: ${error.message}`);
      return false;
    },
    completarLogin: async () => {
      // supabase-js canjea el `?code=` de la URL al iniciarse; getSession espera a que termine.
      await supabase.auth.getSession();
      return tomarVolver();
    },
    cerrarSesion: async () => {
      await supabase.rpc("olvidar_cliente_elegido");
      await supabase.auth.signOut();
    },
    elegirCliente: async (clienteId) => {
      const { data, error } = await supabase.rpc("elegir_cliente", { p_cliente_id: clienteId });
      if (error) throw new Error(`Supabase: ${error.message}`);
      return data;
    },
    registrarSolicitudAcceso: async () => {
      await supabase.rpc("registrar_solicitud_acceso");
    },
    alCambiarSesion: (cb) => {
      const { data } = supabase.auth.onAuthStateChange((evento) => {
        // No llamar a Supabase dentro del callback (puede trabarse): se difiere.
        if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") setTimeout(cb, 0);
      });
      return () => data.subscription.unsubscribe();
    },
    demo: null,
  };
}
