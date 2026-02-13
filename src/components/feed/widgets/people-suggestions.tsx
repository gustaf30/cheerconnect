"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { positionLabels } from "@/lib/constants";
import { getInitials } from "@/lib/utils";

interface UserSuggestion {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
}

export function PeopleSuggestions() {
  const [users, setUsers] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?mode=suggestions");
      if (res.ok) {
        const data = await res.json();
        setUsers((data.users || []).slice(0, 3));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleConnect = async (userId: string) => {
    if (connectingId || connectedIds.has(userId)) return;
    setConnectingId(userId);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId }),
      });
      if (res.ok || res.status === 409) {
        setConnectedIds((prev) => new Set(prev).add(userId));
      }
    } catch {
      // silent
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="bento-card-static shadow-depth-1 p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-sm">Sugestões para você</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhuma sugestão no momento
        </p>
      ) : (
        <div className="space-y-2.5">
          {users.map((user) => {
            const isConnected = connectedIds.has(user.id);
            const isConnecting = connectingId === user.id;
            const firstPosition = user.positions?.[0];

            return (
              <div key={user.id} className="flex items-center gap-2.5">
                <Link href={`/profile/${user.username}`} className="shrink-0">
                  <Avatar className="h-9 w-9 rounded-lg avatar-glow">
                    <AvatarImage
                      src={user.avatar || undefined}
                      alt={user.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-display font-semibold text-xs rounded-lg">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/profile/${user.username}`}
                    className="text-xs font-medium truncate block hover:text-primary transition-fast"
                  >
                    {user.name}
                  </Link>
                  {firstPosition && (
                    <span className="text-[10px] text-muted-foreground">
                      {positionLabels[firstPosition] || firstPosition}
                    </span>
                  )}
                </div>

                <Button
                  variant={isConnected ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 px-3 text-[11px] rounded-full shrink-0"
                  disabled={isConnecting || isConnected}
                  onClick={() => handleConnect(user.id)}
                >
                  {isConnected
                    ? "Enviado"
                    : isConnecting
                      ? "..."
                      : "Conectar"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
