"use client";

import { MessageSquare } from "lucide-react";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConnectionSearch } from "@/components/messages/connection-search";

export default function MessagesPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <h1 className="sr-only">Mensagens</h1>
      {/* Lista de Conversas */}
      <div className="bento-card-static lg:col-span-1 h-fit lg:h-[calc(100dvh-8rem)] flex flex-col">
        <div className="border-b border-border/50 p-4">
          <h2 className="flex items-center gap-2 font-display font-bold">
            <MessageSquare className="h-5 w-5 text-primary" />
            Mensagens
          </h2>
        </div>
        <div className="border-b border-border/50">
          <ConnectionSearch />
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2">
            Conversas Recentes
          </div>
          <ConversationList />
        </div>
      </div>

      {/* Estado Vazio - Desktop */}
      <div className="hidden lg:flex lg:col-span-2 bento-card-static h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="rounded-2xl bg-primary/10 p-6 mx-auto w-fit mb-4">
            <MessageSquare className="h-12 w-12 text-primary" />
          </div>
          <h2 className="heading-section font-display mb-2">Suas mensagens</h2>
          <p className="text-muted-foreground max-w-sm">
            Selecione uma conversa para ver as mensagens ou inicie uma nova conversa
            através do perfil de um usuário conectado.
          </p>
        </div>
      </div>
    </div>
  );
}
