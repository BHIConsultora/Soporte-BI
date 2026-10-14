import { BrowserRouter, Route, Routes } from "react-router";
import { CallbackPage, LoginPage, LogoutPage } from "@/paginas/auth";
import { MisReclamosPage } from "@/paginas/mis-reclamos";
import { PortalLayout } from "@/paginas/portal-layout";
import { BienvenidaPage, ElegirClientePage, NoHabilitadoPage, NotFoundPage } from "@/paginas/publicas";
import { ErrorBoundary } from "./error-boundary";
import { SesionProvider } from "./sesion";

/** Rutas: mismas URLs que la versión Next; `/api/auth/*` pasó a `/auth/*` (ya no hay servidor propio). */
export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SesionProvider>
          <Routes>
            <Route element={<PortalLayout />}>
              <Route index element={<MisReclamosPage />} />
            </Route>
            <Route path="bienvenida" element={<BienvenidaPage />} />
            <Route path="elegir-cliente" element={<ElegirClientePage />} />
            <Route path="no-habilitado" element={<NoHabilitadoPage />} />
            <Route path="auth/login" element={<LoginPage />} />
            <Route path="auth/callback" element={<CallbackPage />} />
            <Route path="auth/logout" element={<LogoutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </SesionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
