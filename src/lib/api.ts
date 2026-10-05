import { getApiToken, isMockMode } from "./auth";
import { mock } from "./mock";
import type { Estado, Me, NuevoTicket, Prioridad, Scope, Ticket, TicketDetalle, Adjunto } from "./types";

const API_BASE = (import.meta.env["VITE_API_BASE"] as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getApiToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* sin cuerpo */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  getMe: (): Promise<Me> => (isMockMode ? mock.getMe() : request("/me")),

  listTickets: (p: { scope: Scope; estado?: string; q?: string }): Promise<Ticket[]> => {
    if (isMockMode) return mock.listTickets(p);
    const qs = new URLSearchParams({ scope: p.scope, estado: p.estado ?? "", q: p.q ?? "" });
    return request(`/tickets?${qs}`);
  },

  createTicket: (body: NuevoTicket): Promise<{ ticketId: string }> =>
    isMockMode ? mock.createTicket(body) : request("/tickets", { method: "POST", body: JSON.stringify(body) }),

  getTicket: (id: string): Promise<TicketDetalle> =>
    isMockMode ? mock.getTicket(id) : request(`/tickets/${encodeURIComponent(id)}`),

  addComment: (id: string, body: { texto: string; adjuntos: Adjunto[] }): Promise<void> =>
    isMockMode
      ? mock.addComment(id, body)
      : request(`/tickets/${encodeURIComponent(id)}/comentarios`, { method: "POST", body: JSON.stringify(body) }),

  patchTicket: (id: string, body: { estado?: Estado; prioridad?: Prioridad }): Promise<void> =>
    isMockMode
      ? mock.patchTicket(id, body)
      : request(`/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),

  publishDraft: (id: string, bid: string, texto: string): Promise<void> =>
    isMockMode
      ? mock.publishDraft(id, bid, texto)
      : request(`/tickets/${encodeURIComponent(id)}/borradores/${encodeURIComponent(bid)}/publicar`, {
          method: "POST",
          body: JSON.stringify({ texto }),
        }),

  deleteDraft: (id: string, bid: string): Promise<void> =>
    isMockMode
      ? mock.deleteDraft(id, bid)
      : request(`/tickets/${encodeURIComponent(id)}/borradores/${encodeURIComponent(bid)}`, { method: "DELETE" }),
};
