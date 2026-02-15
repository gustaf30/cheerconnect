"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { reportError } from "@/lib/error-reporter";
import { toast } from "sonner";
import { AvatarBannerSection } from "@/components/profile/edit/AvatarBannerSection";
import { ProfileForm } from "@/components/profile/edit/ProfileForm";
import { CareerSection } from "@/components/profile/edit/CareerSection";
import { AchievementSection } from "@/components/profile/edit/AchievementSection";

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  bio: z.string().max(500, "Bio deve ter no máximo 500 caracteres").optional(),
  location: z.string().max(100).optional(),
  experience: z.number().min(0).max(50).optional().nullable(),
  skills: z.array(z.string()),
  positions: z.array(z.string()),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface CareerEntry {
  id: string;
  role: string;
  positions: string[];
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  teamName: string;
  description: string | null;
  location: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: string;
  category: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { update } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isDeletingBanner, setIsDeletingBanner] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const [careerHistory, setCareerHistory] = useState<CareerEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      bio: "",
      location: "",
      experience: null,
      skills: [],
      positions: [],
    },
  });

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/users/me");
      if (!response.ok) throw new Error();

      const data = await response.json();
      setAvatarUrl(data.user.avatar);
      setBannerUrl(data.user.banner);
      form.reset({
        name: data.user.name || "",
        bio: data.user.bio || "",
        location: data.user.location || "",
        experience: data.user.experience,
        skills: data.user.skills || [],
        positions: data.user.positions || [],
      });
    } catch {
      toast.error("Erro ao carregar perfil");
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  const fetchCareerHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/career");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCareerHistory(data.careerHistory);
    } catch (error) {
      reportError(error, "EditProfilePage.fetchCareerHistory");
    }
  }, []);

  const fetchAchievements = useCallback(async () => {
    try {
      const response = await fetch("/api/achievements");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setAchievements(data.achievements);
    } catch (error) {
      reportError(error, "EditProfilePage.fetchAchievements");
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchCareerHistory();
    fetchAchievements();
  }, [fetchProfile, fetchCareerHistory, fetchAchievements]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error();

      await update();
      toast.success("Perfil atualizado!");
      router.push("/profile");
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo: 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo deve ser uma imagem");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      setAvatarUrl(data.user.avatar);
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao atualizar foto");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarUrl) return;

    setIsDeletingAvatar(true);
    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setAvatarUrl(null);
      toast.success("Foto removida!");
    } catch {
      toast.error("Erro ao remover foto");
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo: 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo deve ser uma imagem");
      return;
    }

    setIsUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/me/banner", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      setBannerUrl(data.user.banner);
      toast.success("Capa atualizada!");
    } catch {
      toast.error("Erro ao atualizar capa");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!bannerUrl) return;

    setIsDeletingBanner(true);
    try {
      const response = await fetch("/api/users/me/banner", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setBannerUrl(null);
      toast.success("Capa removida!");
    } catch {
      toast.error("Erro ao remover capa");
    } finally {
      setIsDeletingBanner(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="bento-card-static">
          <div className="p-6 space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="heading-section font-display">Editar Perfil</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <AvatarBannerSection
            name={form.getValues("name")}
            avatarUrl={avatarUrl}
            bannerUrl={bannerUrl}
            isUploadingAvatar={isUploadingAvatar}
            isDeletingAvatar={isDeletingAvatar}
            isUploadingBanner={isUploadingBanner}
            isDeletingBanner={isDeletingBanner}
            onAvatarChange={handleAvatarChange}
            onDeleteAvatar={handleDeleteAvatar}
            onBannerChange={handleBannerChange}
            onDeleteBanner={handleDeleteBanner}
          />

          <ProfileForm form={form} />

          <CareerSection
            careerHistory={careerHistory}
            fetchCareerHistory={fetchCareerHistory}
          />

          <AchievementSection
            achievements={achievements}
            fetchAchievements={fetchAchievements}
          />

          <div className="flex justify-end gap-3">
            <Link href="/profile">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
