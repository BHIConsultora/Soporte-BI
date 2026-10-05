import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { getMsal, isMockMode, loginScopes } from "./auth";
import { setMockRole } from "./mock";
import type { Me, Rol } from "./types";

type Status = "loading" | "anon" | "authed" | "forbidden";

interface SessionCtx {
  status: Status;
  me: Me | null;
  login: (redirect?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchMockRole: (r: Rol) => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);
const MOCK_FLAG = "bhi-mock-session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const m = await api.getMe();
      setMe(m);
      setStatus("authed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setStatus("forbidden");
      else setStatus("anon");
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (isMockMode) {
        if (sessionStorage.getItem(MOCK_FLAG)) await loadMe();
        else setStatus("anon");
        return;
      }
      try {
        const app = await getMsal();
        const result = await app.handleRedirectPromise();
        if (result?.account) {
          app.setActiveAccount(result.account);
          await loadMe();
          if (result.state) router.history.push(result.state);
          return;
        }
        const acc = app.getAllAccounts()[0];
        if (acc) {
          app.setActiveAccount(acc);
          await loadMe();
          return;
        }
        const silent = await app.ssoSilent({ scopes: loginScopes });
        app.setActiveAccount(silent.account);
        await loadMe();
      } catch {
        setStatus("anon");
      }
    })();
  }, [loadMe, router]);

  const login = useCallback(
    async (redirect = "/") => {
      if (isMockMode) {
        sessionStorage.setItem(MOCK_FLAG, "1");
        setStatus("loading");
        await loadMe();
        router.history.push(redirect);
        return;
      }
      const app = await getMsal();
      await app.loginRedirect({ scopes: loginScopes, state: redirect });
    },
    [loadMe, router],
  );

  const logout = useCallback(async () => {
    qc.clear();
    if (isMockMode) {
      sessionStorage.removeItem(MOCK_FLAG);
      setMe(null);
      setStatus("anon");
      router.history.replace("/bienvenida");
      return;
    }
    const app = await getMsal();
    await app.logoutRedirect({ postLogoutRedirectUri: `${window.location.origin}/bienvenida` });
  }, [qc, router]);

  const switchMockRole = useCallback(
    async (r: Rol) => {
      setMockRole(r);
      await loadMe();
      await qc.invalidateQueries();
    },
    [loadMe, qc],
  );

  return <Ctx.Provider value={{ status, me, login, logout, switchMockRole }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession fuera de SessionProvider");
  return c;
}
