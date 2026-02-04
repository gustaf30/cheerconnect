"use client";

import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConnectionSearch } from "@/components/messages/connection-search";

export default function MessagesPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversations List */}
      <Card className="lg:col-span-1 h-fit lg:h-[calc(100vh-8rem)]">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Connection Search Section */}
          <div className="border-b">
            <ConnectionSearch />
          </div>
          {/* Conversations List Section */}
          <div className="overflow-y-auto max-h-[calc(100vh-24rem)]">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">
              Conversas Recentes
            </div>
            <ConversationList />
          </div>
        </CardContent>
      </Card>

      {/* Empty State - Desktop */}
      <Card className="hidden lg:flex lg:col-span-2 h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <div className="rounded-full bg-muted p-6 mx-auto w-fit mb-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Suas mensagens</h2>
          <p className="text-muted-foreground max-w-sm">
            Selecione uma conversa para ver as mensagens ou inicie uma nova conversa
            através do perfil de um usuário conectado.
          </p>
        </div>
      </Card>
    </div>
  );
}
