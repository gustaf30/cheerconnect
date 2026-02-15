"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { isDuplicateSubmission } from "@/lib/dedup";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";

interface MessageInputProps {
  conversationId: string;
  onMessageSent?: () => void;
}

export function MessageInput({ conversationId, onMessageSent }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyboardHeight = useKeyboardHeight();

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    if (isDuplicateSubmission(trimmedContent)) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao enviar mensagem");
      }

      setContent("");
      onMessageSent?.();
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex items-end gap-2 p-4 border-t bg-background"
      style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}
    >
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite sua mensagem..."
        className="min-h-[44px] max-h-32 resize-none"
        rows={1}
        disabled={isSending}
      />
      <Button
        onClick={handleSend}
        disabled={!content.trim() || isSending}
        size="icon"
        className="shrink-0 h-11 w-11"
        aria-label="Enviar mensagem"
      >
        {isSending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
