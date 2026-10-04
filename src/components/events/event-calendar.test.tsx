import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventCalendar } from "@/components/events/event-calendar";

// Dia 15 do mes corrente, as 10h locais: o calendario abre no mes atual, entao
// uma data fixa quebraria todo mes — foi o que aconteceu em outubro, com o
// evento mockado em 24 de setembro sumindo da grade. O dia 15 nao encosta em
// fronteira de mes em nenhum fuso.
function dataDoEvento() {
  const dia = new Date();
  dia.setDate(15);
  dia.setHours(10, 0, 0, 0);
  return dia;
}

function nomeDoDia(dia: Date) {
  return `${format(dia, "d 'de' MMMM", { locale: ptBR })}, 1 eventos`;
}

describe("EventCalendar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{
          id: "event-1",
          name: "Copa de Inverno",
          startDate: dataDoEvento().toISOString(),
          endDate: null,
          type: "COMPETITION",
          location: "São Paulo",
        }],
      }),
    }));
  });

  it("loads events and exposes day selection with an accessible name", async () => {
    const dia = dataDoEvento();
    render(<EventCalendar />);
    await waitFor(() => expect(screen.getAllByText("Copa de Inverno").length).toBeGreaterThan(0));
    const botao = screen.getByRole("button", { name: new RegExp(nomeDoDia(dia), "i") });
    fireEvent.click(botao);
    await waitFor(() => expect(screen.getByRole("link", { name: /Copa de Inverno/ })).toBeInTheDocument());
  });

  it("switches to a week view", async () => {
    render(<EventCalendar />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument();
  });
});
