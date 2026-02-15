"use client";

import { useState } from "react";
import { MessageSquareHeart, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar feedback");
      }

      toast.success("Feedback enviado! Obrigado pela sua contribuição.");
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao enviar feedback"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="bento-card-static shadow-depth-1 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquareHeart className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-sm">Feedback</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Nos ajude a melhorar o CheerConnect
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          Enviar feedback
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Feedback</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva sua sugestão, problema ou elogio..."
              maxLength={2000}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {message.length}/2000
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
