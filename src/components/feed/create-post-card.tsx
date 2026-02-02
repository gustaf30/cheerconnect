"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ImagePlus, Video, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface UserProfile {
  name: string;
  avatar: string | null;
}

export function CreatePostCard({ onPostCreated }: { onPostCreated?: () => void }) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setUserProfile({
          name: data.user.name,
          avatar: data.user.avatar,
        });
      }
    } catch {
      console.error("Error fetching user profile");
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

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Escreva algo para publicar");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar post");
      }

      setContent("");
      toast.success("Post publicado!");
      onPostCreated?.();
    } catch {
      toast.error("Erro ao publicar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!session?.user) return null;

  const displayName = userProfile?.name || session.user.name || "";
  const displayAvatar = userProfile?.avatar || session.user.image || undefined;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage
              src={displayAvatar}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {displayName ? getInitials(displayName) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="Compartilhe algo com a comunidade..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled>
                  <ImagePlus className="h-4 w-4 mr-1" />
                  Foto
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  <Video className="h-4 w-4 mr-1" />
                  Vídeo
                </Button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !content.trim()}
                size="sm"
              >
                <Send className="h-4 w-4 mr-1" />
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
