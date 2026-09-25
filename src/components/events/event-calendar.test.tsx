import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventCalendar } from "@/components/events/event-calendar";

describe("EventCalendar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{
          id: "event-1",
          name: "Copa de Inverno",
          startDate: "2026-09-24T10:00:00.000Z",
          endDate: null,
          type: "COMPETITION",
          location: "São Paulo",
        }],
      }),
    }));
  });

  it("loads events and exposes day selection with an accessible name", async () => {
    render(<EventCalendar />);
    await waitFor(() => expect(screen.getAllByText("Copa de Inverno").length).toBeGreaterThan(0));
    const day = screen.getByRole("button", { name: /24 de setembro, 1 eventos/i });
     fireEvent.click(day);
     await waitFor(() => expect(screen.getByRole("link", { name: /Copa de Inverno/ })).toBeInTheDocument());
  });

  it("switches to a week view", async () => {
    render(<EventCalendar />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument();
  });
});
