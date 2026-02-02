"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Check, X, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ConnectionUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
  location: string | null;
}

interface Connection {
  id: string;
  status: string;
  createdAt: string;
  user: ConnectionUser;
  isSender: boolean;
}

const positionLabels: Record<string, string> = {
  FLYER: "Flyer",
  BASE: "Base",
  BACKSPOT: "Backspot",
  FRONTSPOT: "Frontspot",
  TUMBLER: "Tumbler",
  COACH: "Técnico",
  CHOREOGRAPHER: "Coreógrafo",
  JUDGE: "Juiz",
  OTHER: "Outro",
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Connection[]>([]);
  const [pendingSent, setPendingSent] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const [acceptedRes, pendingRes] = await Promise.all([
        fetch("/api/connections?status=ACCEPTED"),
        fetch("/api/connections?status=PENDING"),
      ]);

      if (!acceptedRes.ok || !pendingRes.ok) throw new Error();

      const acceptedData = await acceptedRes.json();
      const pendingData = await pendingRes.json();

      setConnections(acceptedData.connections);
      setPendingReceived(
        pendingData.connections.filter((c: Connection) => !c.isSender)
      );
      setPendingSent(
        pendingData.connections.filter((c: Connection) => c.isSender)
      );
    } catch {
      toast.error("Erro ao carregar conexões");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (userId: string) => {
    try {
      const response = await fetch(`/api/connections/${userId}/accept`, {
        method: "POST",
      });

      if (!response.ok) throw new Error();

      const accepted = pendingReceived.find((c) => c.user.id === userId);
      if (accepted) {
        setPendingReceived((prev) =>
          prev.filter((c) => c.user.id !== userId)
        );
        setConnections((prev) => [
          { ...accepted, status: "ACCEPTED" },
          ...prev,
        ]);
      }

      toast.success("Conexão aceita!");
    } catch {
      toast.error("Erro ao aceitar conexão");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const response = await fetch(`/api/connections/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setPendingReceived((prev) =>
        prev.filter((c) => c.user.id !== userId)
      );
      toast.success("Solicitação rejeitada");
    } catch {
      toast.error("Erro ao rejeitar solicitação");
    }
  };

  const handleCancel = async (userId: string) => {
    try {
      const response = await fetch(`/api/connections/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setPendingSent((prev) => prev.filter((c) => c.user.id !== userId));
      toast.success("Solicitação cancelada");
    } catch {
      toast.error("Erro ao cancelar solicitação");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover esta conexão?")) return;

    try {
      const response = await fetch(`/api/connections/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setConnections((prev) => prev.filter((c) => c.user.id !== userId));
      toast.success("Conexão removida");
    } catch {
      toast.error("Erro ao remover conexão");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const ConnectionCard = ({
    connection,
    type,
  }: {
    connection: Connection;
    type: "connected" | "received" | "sent";
  }) => (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <Link
        href={`/profile/${connection.user.username}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage
            src={connection.user.avatar || undefined}
            alt={connection.user.name}
          />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(connection.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-semibold truncate">{connection.user.name}</div>
          <div className="text-sm text-muted-foreground truncate">
            @{connection.user.username}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {connection.user.positions.slice(0, 2).map((pos) => (
              <Badge key={pos} variant="secondary" className="text-xs">
                {positionLabels[pos] || pos}
              </Badge>
            ))}
          </div>
        </div>
      </Link>

      <div className="flex gap-2 ml-4">
        {type === "received" && (
          <>
            <Button
              size="sm"
              onClick={() => handleAccept(connection.user.id)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(connection.user.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {type === "sent" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCancel(connection.user.id)}
          >
            Cancelar
          </Button>
        )}
        {type === "connected" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleRemove(connection.user.id)}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Conexões</h1>
        <Card>
          <CardContent className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conexões</h1>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            Todas ({connections.length})
          </TabsTrigger>
          <TabsTrigger value="received">
            Recebidas ({pendingReceived.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Enviadas ({pendingSent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {connections.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Você ainda não tem conexões. Comece a conectar-se com outros
                  atletas!
                </p>
              ) : (
                <div className="space-y-3">
                  {connections.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      type="connected"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {pendingReceived.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma solicitação pendente.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingReceived.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      type="received"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {pendingSent.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Você não tem solicitações pendentes.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingSent.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      type="sent"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
