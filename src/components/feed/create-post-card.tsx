"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ImagePlus, Video, Send, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const hasVideo = mediaFiles.some((m) => m.type === "video");
    if (hasVideo) {
      toast.error("Remova o vídeo antes de adicionar imagens");
      return;
    }

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
      const uploadedMedia: { url: string; type: "image" | "video" }[] = [];

      for (const media of mediaFiles) {
        const result = await uploadMedia(media);
        uploadedMedia.push(result);
      }

      const images = uploadedMedia.filter((m) => m.type === "image").map((m) => m.url);
      const video = uploadedMedia.find((m) => m.type === "video");

      const postData: { content: string; images?: string[]; videoUrl?: string } = {
        content: content.trim() || " ",
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
    <div className={`bento-card-static transition-all duration-200 ${isFocused ? 'ring-2 ring-primary/20 shadow-lg' : ''}`}>
      <div className="accent-bar" />
      <div className="p-5">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0 rounded-xl">
            <AvatarImage
              src={displayAvatar}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold rounded-xl">
              {displayName ? getInitials(displayName) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <textarea
              placeholder="Compartilhe algo com a comunidade..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full min-h-[80px] resize-none border-0 bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground font-body"
            />

            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div className={`grid gap-2 ${mediaFiles.length > 1 ? "grid-cols-2" : ""}`}>
                {mediaFiles.map((media, index) => (
                  <div key={index} className="relative group animate-scale-in">
                    {media.type === "image" ? (
                      <img
                        src={media.preview}
                        alt=""
                        className="rounded-xl w-full h-32 object-cover"
                      />
                    ) : (
                      <video
                        src={media.preview}
                        className="rounded-xl w-full h-32 object-cover"
                        controls
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      aria-label="Remover mídia"
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <div className="flex gap-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!canAddImages || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-40"
                >
                  <ImagePlus className="h-4 w-4" />
                  Foto
                </button>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={!canAddVideo || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-40"
                >
                  <Video className="h-4 w-4" />
                  Vídeo
                </button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || (!content.trim() && mediaFiles.length === 0)}
                size="sm"
                className="bg-primary hover:bg-[oklch(0.40_0.18_25)] text-white font-bold rounded-lg px-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {isUploading ? "Enviando..." : "Publicando..."}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Publicar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
