"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  ArrowLeft,
  Camera,
  Plus,
  Briefcase,
  Trophy,
  Trash2,
  Pencil,
  X,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CitySelector } from "@/components/ui/city-selector";

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  bio: z.string().max(500, "Bio deve ter no máximo 500 caracteres").optional(),
  location: z.string().max(100).optional(),
  experience: z.number().min(0).max(50).optional().nullable(),
  skills: z.array(z.string()),
  positions: z.array(z.string()),
});

type ProfileForm = z.infer<typeof profileSchema>;

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

const positionOptions = [
  { value: "FLYER", label: "Flyer" },
  { value: "BASE", label: "Base" },
  { value: "BACKSPOT", label: "Backspot" },
  { value: "FRONTSPOT", label: "Frontspot" },
  { value: "TUMBLER", label: "Tumbler" },
  { value: "COACH", label: "Técnico" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "JUDGE", label: "Juiz" },
  { value: "OTHER", label: "Outro" },
];

const roleOptions = [
  { value: "ATHLETE", label: "Atleta" },
  { value: "COACH", label: "Técnico" },
  { value: "ASSISTANT_COACH", label: "Técnico Assistente" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "TEAM_MANAGER", label: "Gestor de Equipe" },
  { value: "JUDGE", label: "Juiz" },
  { value: "OTHER", label: "Outro" },
];

const categoryOptions = [
  { value: "COMPETITION", label: "Competição" },
  { value: "CERTIFICATION", label: "Certificação" },
  { value: "AWARD", label: "Prêmio" },
  { value: "OTHER", label: "Outro" },
];

export default function EditProfilePage() {
  const router = useRouter();
  const { update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isDeletingBanner, setIsDeletingBanner] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  // Career state
  const [careerHistory, setCareerHistory] = useState<CareerEntry[]>([]);
  const [careerDialogOpen, setCareerDialogOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<CareerEntry | null>(null);
  const [careerForm, setCareerForm] = useState({
    role: "ATHLETE",
    positions: [] as string[],
    startDate: "",
    endDate: "",
    isCurrent: false,
    teamName: "",
    description: "",
    location: "",
  });
  const [isSavingCareer, setIsSavingCareer] = useState(false);

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementDialogOpen, setAchievementDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    description: "",
    date: "",
    category: "",
  });
  const [isSavingAchievement, setIsSavingAchievement] = useState(false);

  // Share achievement state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePostContent, setSharePostContent] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const form = useForm<ProfileForm>({
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

  useEffect(() => {
    fetchProfile();
    fetchCareerHistory();
    fetchAchievements();
  }, []);

  const fetchProfile = async () => {
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
  };

  const fetchCareerHistory = async () => {
    try {
      const response = await fetch("/api/career");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCareerHistory(data.careerHistory);
    } catch {
      console.error("Error fetching career history");
    }
  };

  const fetchAchievements = async () => {
    try {
      const response = await fetch("/api/achievements");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setAchievements(data.achievements);
    } catch {
      console.error("Error fetching achievements");
    }
  };

  const onSubmit = async (data: ProfileForm) => {
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
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        const response = await fetch("/api/users/me/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: base64 }),
        });

        if (!response.ok) throw new Error();

        setAvatarUrl(base64);
        toast.success("Foto atualizada!");
      };
      reader.readAsDataURL(file);
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
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        const response = await fetch("/api/users/me/banner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ banner: base64 }),
        });

        if (!response.ok) throw new Error();

        setBannerUrl(base64);
        toast.success("Capa atualizada!");
      };
      reader.readAsDataURL(file);
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

  const togglePosition = (position: string) => {
    const current = form.getValues("positions");
    if (current.includes(position)) {
      form.setValue("positions", current.filter((p) => p !== position));
    } else {
      form.setValue("positions", [...current, position]);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    const current = form.getValues("skills");
    if (!current.includes(newSkill.trim())) {
      form.setValue("skills", [...current, newSkill.trim()]);
    }
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    const current = form.getValues("skills");
    form.setValue("skills", current.filter((s) => s !== skill));
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Career handlers
  const openCareerDialog = (career?: CareerEntry) => {
    if (career) {
      setEditingCareer(career);
      setCareerForm({
        role: career.role,
        positions: career.positions,
        startDate: career.startDate.split("T")[0],
        endDate: career.endDate?.split("T")[0] || "",
        isCurrent: career.isCurrent,
        teamName: career.teamName,
        description: career.description || "",
        location: career.location || "",
      });
    } else {
      setEditingCareer(null);
      setCareerForm({
        role: "ATHLETE",
        positions: [],
        startDate: "",
        endDate: "",
        isCurrent: false,
        teamName: "",
        description: "",
        location: "",
      });
    }
    setCareerDialogOpen(true);
  };

  const saveCareer = async () => {
    if (!careerForm.teamName || !careerForm.startDate) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSavingCareer(true);
    try {
      const payload = {
        ...careerForm,
        endDate: careerForm.isCurrent ? null : careerForm.endDate || null,
      };

      const url = editingCareer ? `/api/career/${editingCareer.id}` : "/api/career";
      const method = editingCareer ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error();

      toast.success(editingCareer ? "Experiência atualizada!" : "Experiência adicionada!");
      setCareerDialogOpen(false);
      fetchCareerHistory();
    } catch {
      toast.error("Erro ao salvar experiência");
    } finally {
      setIsSavingCareer(false);
    }
  };

  const deleteCareer = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta experiência?")) return;

    try {
      const response = await fetch(`/api/career/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();

      toast.success("Experiência removida!");
      fetchCareerHistory();
    } catch {
      toast.error("Erro ao remover experiência");
    }
  };

  // Achievement handlers
  const openAchievementDialog = (achievement?: Achievement) => {
    if (achievement) {
      setEditingAchievement(achievement);
      setAchievementForm({
        title: achievement.title,
        description: achievement.description || "",
        date: achievement.date.split("T")[0],
        category: achievement.category || "",
      });
    } else {
      setEditingAchievement(null);
      setAchievementForm({
        title: "",
        description: "",
        date: "",
        category: "",
      });
    }
    setAchievementDialogOpen(true);
  };

  const saveAchievement = async () => {
    if (!achievementForm.title || !achievementForm.date) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSavingAchievement(true);
    try {
      const url = editingAchievement
        ? `/api/achievements/${editingAchievement.id}`
        : "/api/achievements";
      const method = editingAchievement ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(achievementForm),
      });

      if (!response.ok) throw new Error();

      const isNewAchievement = !editingAchievement;
      toast.success(editingAchievement ? "Conquista atualizada!" : "Conquista adicionada!");
      setAchievementDialogOpen(false);
      fetchAchievements();

      // Offer to share new achievements
      if (isNewAchievement) {
        const categoryLabel = categoryOptions.find((c) => c.value === achievementForm.category)?.label;
        const dateFormatted = new Date(achievementForm.date).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });

        let postContent = `🏆 Nova conquista desbloqueada!\n\n${achievementForm.title}`;
        if (categoryLabel) {
          postContent += ` (${categoryLabel})`;
        }
        postContent += `\n📅 ${dateFormatted}`;
        if (achievementForm.description) {
          postContent += `\n\n${achievementForm.description}`;
        }

        setSharePostContent(postContent);
        setShareDialogOpen(true);
      }
    } catch {
      toast.error("Erro ao salvar conquista");
    } finally {
      setIsSavingAchievement(false);
    }
  };

  const handleShareAchievement = async () => {
    if (!sharePostContent.trim()) {
      toast.error("Escreva algo para publicar");
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sharePostContent }),
      });

      if (!response.ok) throw new Error();

      toast.success("Conquista compartilhada!");
      setShareDialogOpen(false);
      setSharePostContent("");
    } catch {
      toast.error("Erro ao compartilhar conquista");
    } finally {
      setIsSharing(false);
    }
  };

  const deleteAchievement = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta conquista?")) return;

    try {
      const response = await fetch(`/api/achievements/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();

      toast.success("Conquista removida!");
      fetchAchievements();
    } catch {
      toast.error("Erro ao remover conquista");
    }
  };

  const toggleCareerPosition = (position: string) => {
    if (careerForm.positions.includes(position)) {
      setCareerForm({
        ...careerForm,
        positions: careerForm.positions.filter((p) => p !== position),
      });
    } else {
      setCareerForm({
        ...careerForm,
        positions: [...careerForm.positions, position],
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
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
        <h1 className="text-2xl font-bold">Editar Perfil</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Photo Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Foto de Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl || undefined} alt={form.getValues("name")} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {form.getValues("name") ? getInitials(form.getValues("name")) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
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
                      onClick={handleDeleteAvatar}
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
            </CardContent>
          </Card>

          {/* Banner Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Foto de Capa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                  {bannerUrl ? (
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
                    onChange={handleBannerChange}
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
                      onClick={handleDeleteBanner}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Conte um pouco sobre você..."
                        className="resize-none"
                        rows={4}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/500 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização</FormLabel>
                    <FormControl>
                      <CitySelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anos de experiência</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Posições</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="positions"
                render={({ field }) => (
                  <FormItem>
                    <FormDescription className="mb-3">
                      Selecione todas as posições que você desempenha
                    </FormDescription>
                    <div className="flex flex-wrap gap-2">
                      {positionOptions.map((pos) => (
                        <Badge
                          key={pos.value}
                          variant={field.value.includes(pos.value) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => togglePosition(pos.value)}
                        >
                          {pos.label}
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Habilidades</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormDescription className="mb-3">
                      Adicione suas habilidades (tumbling, stunts, etc.)
                    </FormDescription>
                    <div className="flex gap-2 mb-3">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Nova habilidade..."
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.preventDefault(), addSkill())
                        }
                      />
                      <Button type="button" onClick={addSkill}>
                        Adicionar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {field.value.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeSkill(skill)}
                        >
                          {skill} ×
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Career History Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Currículo
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => openCareerDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {careerHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Adicione seu histórico em equipes de cheerleading.
                </p>
              ) : (
                <div className="space-y-4">
                  {careerHistory.map((career) => (
                    <div key={career.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{career.teamName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {roleOptions.find((r) => r.value === career.role)?.label || career.role}
                          </Badge>
                          {career.isCurrent && (
                            <Badge variant="default" className="text-xs">Atual</Badge>
                          )}
                        </div>
                        {career.positions.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {career.positions
                              .map((p) => positionOptions.find((opt) => opt.value === p)?.label || p)
                              .join(", ")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(career.startDate), "MMM yyyy", { locale: ptBR })}
                          {" - "}
                          {career.isCurrent
                            ? "Presente"
                            : career.endDate
                            ? format(new Date(career.endDate), "MMM yyyy", { locale: ptBR })
                            : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openCareerDialog(career)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteCareer(career.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievements Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Conquistas
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => openAchievementDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Registre suas conquistas e títulos.
                </p>
              ) : (
                <div className="space-y-4">
                  {achievements.map((achievement) => (
                    <div key={achievement.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{achievement.title}</span>
                          {achievement.category && (
                            <Badge variant="secondary" className="text-xs">
                              {categoryOptions.find((c) => c.value === achievement.category)?.label ||
                                achievement.category}
                            </Badge>
                          )}
                        </div>
                        {achievement.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {achievement.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(achievement.date), "MMMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openAchievementDialog(achievement)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteAchievement(achievement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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

      {/* Career Dialog */}
      <Dialog open={careerDialogOpen} onOpenChange={setCareerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCareer ? "Editar Experiência" : "Adicionar Experiência"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Time *</label>
              <Input
                value={careerForm.teamName}
                onChange={(e) => setCareerForm({ ...careerForm, teamName: e.target.value })}
                placeholder="Ex: Sharks Allstars"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Função *</label>
              <Select
                value={careerForm.role}
                onValueChange={(value) => setCareerForm({ ...careerForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Posições</label>
              <div className="flex flex-wrap gap-2">
                {positionOptions.map((pos) => (
                  <Badge
                    key={pos.value}
                    variant={careerForm.positions.includes(pos.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCareerPosition(pos.value)}
                  >
                    {pos.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Início *</label>
                <Input
                  type="date"
                  value={careerForm.startDate}
                  onChange={(e) => setCareerForm({ ...careerForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Término</label>
                <Input
                  type="date"
                  value={careerForm.endDate}
                  onChange={(e) => setCareerForm({ ...careerForm, endDate: e.target.value })}
                  disabled={careerForm.isCurrent}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrent"
                checked={careerForm.isCurrent}
                onChange={(e) =>
                  setCareerForm({ ...careerForm, isCurrent: e.target.checked, endDate: "" })
                }
                className="h-4 w-4"
              />
              <label htmlFor="isCurrent" className="text-sm">
                Atualmente neste time
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Localização</label>
              <CitySelector
                value={careerForm.location}
                onChange={(value) => setCareerForm({ ...careerForm, location: value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={careerForm.description}
                onChange={(e) => setCareerForm({ ...careerForm, description: e.target.value })}
                placeholder="Conquistas, responsabilidades..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCareerDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCareer} disabled={isSavingCareer}>
              {isSavingCareer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Achievement Dialog */}
      <Dialog open={achievementDialogOpen} onOpenChange={setAchievementDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAchievement ? "Editar Conquista" : "Adicionar Conquista"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                placeholder="Ex: Campeão Nacional 2024"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={achievementForm.category}
                onValueChange={(value) => setAchievementForm({ ...achievementForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data *</label>
              <Input
                type="date"
                value={achievementForm.date}
                onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={achievementForm.description}
                onChange={(e) =>
                  setAchievementForm({ ...achievementForm, description: e.target.value })
                }
                placeholder="Detalhes sobre a conquista..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAchievementDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAchievement} disabled={isSavingAchievement}>
              {isSavingAchievement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Achievement Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Compartilhar Conquista
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Deseja compartilhar essa conquista no seu feed? Você pode editar o texto antes de publicar.
            </p>
            <Textarea
              value={sharePostContent}
              onChange={(e) => setSharePostContent(e.target.value)}
              placeholder="Escreva algo sobre sua conquista..."
              rows={6}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Não compartilhar
            </Button>
            <Button onClick={handleShareAchievement} disabled={isSharing || !sharePostContent.trim()}>
              {isSharing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Share2 className="mr-2 h-4 w-4" />
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
