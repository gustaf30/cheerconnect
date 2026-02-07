"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Check, X, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { positionLabels } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";

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

function ConnectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";

  const [connections, setConnections] = useState<Connection[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Connection[]>([]);
  const [pendingSent, setPendingSent] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchConnections = useCallback(async () => {
    setError(null);
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
      setError("Erro ao carregar conexões");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

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

  const handleRemove = async () => {
    if (!removeTargetId) return;
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/connections/${removeTargetId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setConnections((prev) => prev.filter((c) => c.user.id !== removeTargetId));
      setRemoveTargetId(null);
      toast.success("Conexão removida");
    } catch {
      toast.error("Erro ao remover conexão");
    } finally {
      setIsRemoving(false);
    }
  };

  const ConnectionCard = ({
    connection,
    type,
  }: {
    connection: Connection;
    type: "connected" | "received" | "sent";
  }) => (
    <div className="flex items-center justify-between p-4 bento-card">
      <Link
        href={`/profile/${connection.user.username}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <Avatar className="h-12 w-12 shrink-0 avatar-glow">
          <AvatarImage
            src={connection.user.avatar || undefined}
            alt={connection.user.name}
          />
          <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold">
            {getInitials(connection.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-display font-semibold truncate">{connection.user.name}</div>
          <div className="text-sm text-muted-foreground truncate font-mono">
            @{connection.user.username}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {connection.user.positions.slice(0, 2).map((pos) => (
              <Badge key={pos} variant="gradient" className="text-xs">
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
            onClick={() => setRemoveTargetId(connection.user.id)}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="heading-section font-display">Conexões</h1>
        <div className="bento-card-static p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="heading-section font-display">Conexões</h1>
        <ErrorState message={error} onRetry={() => { setError(null); fetchConnections(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-5">
          <h1 className="heading-section font-display mb-4">Conexões</h1>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="font-mono text-2xl font-bold text-primary">{connections.length}</span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Conexões</p>
            </div>
            <div className="text-center border-x border-border/50">
              <span className="font-mono text-2xl font-bold text-primary">{pendingReceived.length}</span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Recebidas</p>
            </div>
            <div className="text-center">
              <span className="font-mono text-2xl font-bold text-primary">{pendingSent.length}</span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Enviadas</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => router.replace(`/connections?tab=${v}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="all">
            Todas
          </TabsTrigger>
          <TabsTrigger value="received">
            Recebidas
          </TabsTrigger>
          <TabsTrigger value="sent">
            Enviadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-3">
              {connections.length === 0 ? (
                <div className="bento-card-static p-8 text-center text-muted-foreground">
                  Você ainda não tem conexões. Comece a conectar-se com outros
                  atletas!
                </div>
              ) : (
                <div className="space-y-3 stagger-children">
                  {connections.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      type="connected"
                    />
                  ))}
                </div>
              )}
          </div>
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          <div className="space-y-3">
              {pendingReceived.length === 0 ? (
                <div className="bento-card-static p-8 text-center text-muted-foreground">
                  Nenhuma solicitação pendente.
                </div>
              ) : (
                <div className="space-y-3 stagger-children">
                  {pendingReceived.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      type="received"
                    />
                  ))}
                </div>
              )}
          </div>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <div className="space-y-3">
              {pendingSent.length === 0 ? (
                <div className="bento-card-static p-8 text-center text-muted-foreground">
                  Você não tem solicitações pendentes.
                </div>
              ) : (
                <div className="space-y-3 stagger-children">
                  {pendingSent.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      type="sent"
                    />
                  ))}
                </div>
              )}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!removeTargetId}
        onOpenChange={(open) => !open && setRemoveTargetId(null)}
        title="Remover esta conexão?"
        confirmLabel="Remover"
        isLoading={isRemoving}
        onConfirm={handleRemove}
      />
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsSkeleton />}>
      <ConnectionsContent />
    </Suspense>
  );
}

function ConnectionsSkeleton() {
  return (
    <div className="space-y-6">
      <h1 className="heading-section font-display">Conexões</h1>
      <div className="bento-card-static p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
