"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FollowButtonProps {
  teamSlug: string;
  isMember?: boolean;
}

export function FollowButton({ teamSlug, isMember }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    checkFollowStatus();
  }, [teamSlug]);

  const checkFollowStatus = async () => {
    try {
      const response = await fetch(`/api/teams/${teamSlug}/follow`);
      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.isFollowing);
      }
    } catch {
      console.error("Error checking follow status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/teams/${teamSlug}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      });

      if (!response.ok) {
        throw new Error();
      }

      setIsFollowing(!isFollowing);
      toast.success(isFollowing ? "Deixou de seguir a equipe" : "Agora você segue esta equipe!");
    } catch {
      toast.error("Erro ao processar solicitação");
    } finally {
      setIsUpdating(false);
    }
  };

  // Don't show follow button if user is a member
  if (isMember) {
    return null;
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      onClick={handleFollow}
      disabled={isUpdating}
    >
      {isUpdating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : isFollowing ? (
        <UserMinus className="h-4 w-4 mr-2" />
      ) : (
        <UserPlus className="h-4 w-4 mr-2" />
      )}
      {isFollowing ? "Seguindo" : "Seguir"}
    </Button>
  );
}
