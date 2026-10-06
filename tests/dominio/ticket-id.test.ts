import { describe, expect, it } from "vitest";
import { formatTicketId, parseTicketId } from "@/dominio/ticket-id";

describe("ID visible de ticket", () => {
  it("rellena con ceros a 4 dígitos", () => {
    expect(formatTicketId(42)).toBe("TCK-0042");
    expect(formatTicketId(12345)).toBe("TCK-12345");
  });

  it("parsea el formato visible y el numérico", () => {
    expect(parseTicketId("TCK-0042")).toBe(42);
    expect(parseTicketId("tck-7")).toBe(7);
    expect(parseTicketId("42")).toBe(42);
  });

  it.each(["", "TCK-", "TCK-0", "0", "-1", "TCK-12a", "1 OR 1=1", "TCK-0042'", "9999999999"])(
    "rechaza %j",
    (valor) => expect(parseTicketId(valor)).toBeNull(),
  );
});
