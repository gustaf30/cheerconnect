"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ImagePlus, Video, Send, X, Loader2 } from "lucide-react";
import { isDuplicateSubmission } from "@/lib/dedup";
import { reportError } from "@/lib/error-reporter";
import { scaleIn, noMotion } from "@/lib/animations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_IMAGES_PER_POST } from "@/lib/constants";
import { POST_PLACEHOLDERS } from "@/lib/placeholders";
import { UserProfile } from "@/types";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

// Limites de compressão
const COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
};

// Timeouts de upload
const IMAGE_UPLOAD_TIMEOUT = 30_000; // 30s
const VIDEO_UPLOAD_TIMEOUT = 120_000; // 120s

// Retry config
const MAX_RETRIES = 3;

interface UploadError extends Error {
  status?: number;
}
const INITIAL_BACKOFF_MS = 1_000;

// Concorrência máxima de uploads
const MAX_CONCURRENT_UPLOADS = 3;

interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

/** Erros recuperáveis que podem ser retentados */
function isRecoverableError(status: number | null): boolean {
  if (status === null) return true; // erro de rede
  if (status === 0) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}

export function CreatePostCard({ onPostCreated }: { onPostCreated?: () => void }) {
  const { data: session } = useSession();
  const shouldReduceMotion = useReducedMotion();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isFocused, setIsFocused] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session]);

  // Limpar URLs de preview ao desmontar
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
          username: data.user.username,
          avatar: data.user.avatar,
        });
      }
    } catch (error) {
      reportError(error, "CreatePostCard.fetchUserProfile");
    }
  };

  /** Comprime imagem se maior que o threshold */
  const compressImage = useCallback(async (file: File): Promise<File> => {
    if (file.size <= COMPRESSION_THRESHOLD) return file;

    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      return compressed as File;
    } catch (err) {
      console.warn("Falha na compressão, usando arquivo original:", err);
      return file;
    }
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const hasVideo = mediaFiles.some((m) => m.type === "video");
    if (hasVideo) {
      toast.error("Remova o vídeo antes de adicionar imagens");
      return;
    }

    const remainingSlots = MAX_IMAGES_PER_POST - mediaFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES_PER_POST} imagens por post`);
      return;
    }

    const newFiles: MediaFile[] = [];
    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name} é muito grande. Máximo: ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
        continue;
      }

      // Comprime imagens grandes no cliente antes do upload
      const compressed = await compressImage(file);

      newFiles.push({
        file: compressed,
        preview: URL.createObjectURL(compressed),
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
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error(`Vídeo muito grande. Máximo: ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`);
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

  /** Upload com XMLHttpRequest para progresso, AbortController para timeout, e retry com backoff */
  const uploadMedia = useCallback(
    async (
      media: MediaFile,
      onProgress?: (loaded: number, total: number) => void,
    ): Promise<{ url: string; type: "image" | "video" }> => {
      const timeout = media.type === "video" ? VIDEO_UPLOAD_TIMEOUT : IMAGE_UPLOAD_TIMEOUT;

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await new Promise<{ url: string; type: "image" | "video" }>(
            (resolve, reject) => {
              const xhr = new XMLHttpRequest();
              const timer = setTimeout(() => {
                xhr.abort();
                reject(new Error("Upload expirou. Verifique sua conexão e tente novamente."));
              }, timeout);

              xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable && onProgress) {
                  onProgress(e.loaded, e.total);
                }
              });

              xhr.addEventListener("load", () => {
                clearTimeout(timer);
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    resolve(JSON.parse(xhr.responseText));
                  } catch {
                    reject(new Error("Resposta inválida do servidor"));
                  }
                } else {
                  const err = new Error(
                    xhr.status === 413
                      ? "Arquivo muito grande para o servidor"
                      : `Erro no upload (${xhr.status})`,
                  );
                  (err as UploadError).status = xhr.status;
                  reject(err);
                }
              });

              xhr.addEventListener("error", () => {
                clearTimeout(timer);
                reject(new Error("Erro de rede durante o upload"));
              });

              xhr.addEventListener("abort", () => {
                clearTimeout(timer);
                // Abort via timeout já rejeita acima
              });

              const formData = new FormData();
              formData.append("file", media.file);

              xhr.open("POST", "/api/upload");
              xhr.send(formData);
            },
          );

          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const status = (lastError as UploadError).status ?? null;

          // Não retentar erros fatais (400, 413, etc.)
          if (!isRecoverableError(status)) {
            throw lastError;
          }

          // Backoff exponencial antes de retentar
          if (attempt < MAX_RETRIES - 1) {
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, backoff));
          }
        }
      }

      throw lastError ?? new Error("Erro no upload após múltiplas tentativas");
    },
    [],
  );

  /** Upload paralelo com limite de concorrência */
  const uploadAllMedia = useCallback(
    async (files: MediaFile[]): Promise<{ url: string; type: "image" | "video" }[]> => {
      if (files.length === 0) return [];

      const results: { url: string; type: "image" | "video" }[] = new Array(files.length);
      const progressPerFile: number[] = new Array(files.length).fill(0);
      const totalSizes = files.map((f) => f.file.size);
      const totalSize = totalSizes.reduce((a, b) => a + b, 0);

      const updateTotalProgress = () => {
        const loaded = progressPerFile.reduce((a, b) => a + b, 0);
        setUploadProgress(totalSize > 0 ? Math.round((loaded / totalSize) * 100) : 0);
      };

      // Limita concorrência com pool simples
      let cursor = 0;
      const workers: Promise<void>[] = [];

      const processNext = async (): Promise<void> => {
        while (cursor < files.length) {
          const idx = cursor++;
          const media = files[idx];
          const result = await uploadMedia(media, (loaded) => {
            progressPerFile[idx] = loaded;
            updateTotalProgress();
          });
          results[idx] = result;
        }
      };

      const concurrency = Math.min(MAX_CONCURRENT_UPLOADS, files.length);
      for (let i = 0; i < concurrency; i++) {
        workers.push(processNext());
      }

      await Promise.all(workers);
      return results;
    },
    [uploadMedia],
  );

  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error("Escreva algo ou adicione mídia para publicar");
      return;
    }

    if (isDuplicateSubmission(content)) return;

    setIsLoading(true);
    setIsUploading(mediaFiles.length > 0);
    setUploadProgress(0);

    try {
      const uploadedMedia = await uploadAllMedia(mediaFiles);

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
      setUploadProgress(0);
    }
  };

  if (!session?.user) return null;

  const displayName = userProfile?.name || session.user.name || "";
  const displayAvatar = userProfile?.avatar || session.user.image || undefined;
  const hasVideo = mediaFiles.some((m) => m.type === "video");
  const canAddImages = !hasVideo && mediaFiles.length < MAX_IMAGES_PER_POST;
  const canAddVideo = mediaFiles.length === 0;

  return (
    <div className={`bento-card-static shadow-depth-1 transition-base ${isFocused ? 'ring-2 ring-primary/20 shadow-lg' : ''}`}>
      <div className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-12 w-12 shrink-0 rounded-lg">
            <AvatarImage
              src={displayAvatar}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold rounded-lg">
              {displayName ? getInitials(displayName) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <textarea
              placeholder={POST_PLACEHOLDERS[Math.floor(Math.random() * POST_PLACEHOLDERS.length)]}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full min-h-[80px] resize-none border-0 bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground font-body"
            />

            {/* Preview de mídia */}
            {mediaFiles.length > 0 && (
              <div className={`grid gap-2 ${mediaFiles.length > 1 ? "grid-cols-2" : ""}`}>
                <AnimatePresence>
                  {mediaFiles.map((media, index) => (
                    <motion.div
                      key={media.preview}
                      variants={shouldReduceMotion ? noMotion : scaleIn}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group"
                    >
                      {media.type === "image" ? (
                        <img
                          src={media.preview}
                          alt={`Prévia da imagem ${index + 1}`}
                          className="rounded-xl w-full h-40 sm:h-32 object-cover"
                        />
                      ) : (
                        <video
                          src={media.preview}
                          className="rounded-xl w-full h-40 sm:h-32 object-cover bg-black"
                          playsInline
                          preload="metadata"
                          muted
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        aria-label="Remover mídia"
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-base hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Barra de progresso de upload */}
            {isUploading && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>Enviando mídia...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <div className="flex gap-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!canAddImages || isLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent/50 transition-base disabled:opacity-40"
                >
                  <ImagePlus className="h-[18px] w-[18px] text-blue-500" />
                  Foto
                </button>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={!canAddVideo || isLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent/50 transition-base disabled:opacity-40"
                >
                  <Video className="h-[18px] w-[18px] text-emerald-500" />
                  Vídeo
                </button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || (!content.trim() && mediaFiles.length === 0)}
                size="sm"
                className="bg-primary hover:bg-primary-hover text-white font-bold rounded-lg px-4"
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
