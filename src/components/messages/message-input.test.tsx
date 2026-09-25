import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageInput } from "@/components/messages/message-input";

vi.mock("@/hooks/use-keyboard-height", () => ({ useKeyboardHeight: () => 0 }));

describe("MessageInput", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: { id: "1" } }) }));
  });

  it("has an accessible label and sends trimmed content", async () => {
    const onMessageSent = vi.fn();
    render(<MessageInput conversationId="conversation-1" onMessageSent={onMessageSent} />);
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "  olá  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    await waitFor(() => expect(onMessageSent).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith("/api/conversations/conversation-1/messages", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ content: "olá" }),
    }));
  });
});
