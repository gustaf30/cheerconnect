"use client";

import { useRef } from "react";
import { Loader2, Camera, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

interface AvatarBannerSectionProps {
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  isUploadingBanner: boolean;
  isDeletingBanner: boolean;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAvatar: () => void;
  onBannerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteBanner: () => void;
}

export function AvatarBannerSection({
  name,
  avatarUrl,
  bannerUrl,
  isUploadingAvatar,
  isDeletingAvatar,
  isUploadingBanner,
  isDeletingBanner,
  onAvatarChange,
  onDeleteAvatar,
  onBannerChange,
  onDeleteBanner,
}: AvatarBannerSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Card de Upload de Foto */}
      <div className="bento-card-static">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display">Foto de Perfil</h2>
        </div>
        <div className="p-6 pt-0">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {name ? getInitials(name) : "U"}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                Clique no ícone da câmera para alterar sua foto de perfil.
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB.
              </p>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onDeleteAvatar}
                  disabled={isDeletingAvatar}
                >
                  {isDeletingAvatar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remover foto
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card de Upload de Capa */}
      <div className="bento-card-static">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display">Foto de Capa</h2>
        </div>
        <div className="p-6 pt-0">
          <div className="space-y-4">
            <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
              {bannerUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={bannerUrl}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="h-8 w-8" />
                </div>
              )}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onBannerChange}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
              >
                {isUploadingBanner ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {bannerUrl ? "Alterar capa" : "Adicionar capa"}
              </Button>
              {bannerUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onDeleteBanner}
                  disabled={isDeletingBanner}
                >
                  {isDeletingBanner ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remover capa
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Recomendado: 1200x300 pixels. Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
