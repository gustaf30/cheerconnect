"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ImagePlus, Video, Send, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface UserProfile {
  name: string;
  avatar: string | null;
}

interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

export function CreatePostCard({ onPostCreated }: { onPostCreated?: () => void }) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      mediaFiles.forEach((media) => URL.revokeObjectURL(media.preview));
    };
  }, [mediaFiles]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Check if adding a video when images exist or vice versa
    const hasVideo = mediaFiles.some((m) => m.type === "video");
    if (hasVideo) {
      toast.error("Remova o vídeo antes de adicionar imagens");
      return;
    }

    // Limit to 4 images total
    const remainingSlots = 4 - mediaFiles.length;
    if (remainingSlots <= 0) {
      toast.error("Máximo de 4 imagens por post");
      return;
    }

    const newFiles: MediaFile[] = [];
    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo: 10MB`);
        continue;
      }
      newFiles.push({
        file,
        preview: URL.createObjectURL(file),
        type: "image",
      });
    }

    setMediaFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Cannot add video if there are images
    if (mediaFiles.length > 0) {
      toast.error("Remova as imagens antes de adicionar um vídeo");
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Vídeo muito grande. Máximo: 100MB");
      return;
    }

    setMediaFiles([{
      file,
      preview: URL.createObjectURL(file),
      type: "video",
    }]);
    e.target.value = "";
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadMedia = async (media: MediaFile): Promise<{ url: string; type: "image" | "video" }> => {
    const formData = new FormData();
    formData.append("file", media.file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro no upload");
    }

    return response.json();
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error("Escreva algo ou adicione mídia para publicar");
      return;
    }

    setIsLoading(true);
    setIsUploading(mediaFiles.length > 0);

    try {
      // Upload all media files to Cloudinary
      const uploadedMedia: { url: string; type: "image" | "video" }[] = [];

      for (const media of mediaFiles) {
        const result = await uploadMedia(media);
        uploadedMedia.push(result);
      }

      // Prepare post data
      const images = uploadedMedia.filter((m) => m.type === "image").map((m) => m.url);
      const video = uploadedMedia.find((m) => m.type === "video");

      const postData: { content: string; images?: string[]; videoUrl?: string } = {
        content: content.trim() || " ", // API requires content
      };

      if (images.length > 0) {
        postData.images = images;
      }
      if (video) {
        postData.videoUrl = video.url;
      }

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar post");
      }

      // Reset form
      setContent("");
      mediaFiles.forEach((media) => URL.revokeObjectURL(media.preview));
      setMediaFiles([]);
      toast.success("Post publicado!");
      onPostCreated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao publicar. Tente novamente.";
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  if (!session?.user) return null;

  const displayName = userProfile?.name || session.user.name || "";
  const displayAvatar = userProfile?.avatar || session.user.image || undefined;
  const hasVideo = mediaFiles.some((m) => m.type === "video");
  const canAddImages = !hasVideo && mediaFiles.length < 4;
  const canAddVideo = mediaFiles.length === 0;

  return (
    <Card className={`transition-all duration-300 ${isFocused ? 'shadow-depth-2 border-primary/30' : 'hover:shadow-lg'}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-transparent hover:ring-primary/30 transition-all duration-300">
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
            <div className="relative">
              <Textarea
                placeholder="Compartilhe algo com a comunidade..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="min-h-[80px] resize-none border-0 bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-300"
              />
              {isFocused && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-[oklch(0.65_0.18_30)] animate-scale-in" />
              )}
            </div>

            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div className={`grid gap-2 ${mediaFiles.length > 1 ? "grid-cols-2" : ""}`}>
                {mediaFiles.map((media, index) => (
                  <div key={index} className="relative group animate-scale-in">
                    {media.type === "image" ? (
                      <img
                        src={media.preview}
                        alt=""
                        className="rounded-lg w-full h-32 object-cover transition-all duration-300 group-hover:brightness-95"
                      />
                    ) : (
                      <video
                        src={media.preview}
                        className="rounded-lg w-full h-32 object-cover"
                        controls
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!canAddImages || isLoading}
                  className="hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                >
                  <ImagePlus className="h-4 w-4 mr-1" />
                  Foto
                </Button>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={!canAddVideo || isLoading}
                  className="hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                >
                  <Video className="h-4 w-4 mr-1" />
                  Vídeo
                </Button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || (!content.trim() && mediaFiles.length === 0)}
                size="sm"
                className="group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {isUploading ? "Enviando..." : "Publicando..."}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:translate-x-0.5" />
                    Publicar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
