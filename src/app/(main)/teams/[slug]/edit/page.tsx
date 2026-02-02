"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Send,
  Plus,
  Trash2,
  Trophy,
  Calendar,
  MapPin,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  location: string | null;
  category: string;
  level: string | null;
  website: string | null;
  instagram: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: string;
  category: string | null;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  location: string;
  startDate: string;
  endDate: string | null;
  type: string;
}

const categories = [
  { value: "ALLSTAR", label: "All Star" },
  { value: "SCHOOL", label: "Escolar" },
  { value: "COLLEGE", label: "Universitário" },
  { value: "RECREATIONAL", label: "Recreativo" },
  { value: "PROFESSIONAL", label: "Profissional" },
];

const eventTypes = [
  { value: "COMPETITION", label: "Competição" },
  { value: "TRYOUT", label: "Tryout" },
  { value: "CAMP", label: "Camp" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "SHOWCASE", label: "Showcase" },
  { value: "OTHER", label: "Outro" },
];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function TeamEditPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    category: "ALLSTAR",
    level: "",
    website: "",
    instagram: "",
  });

  // Post state
  const [postContent, setPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Achievement dialog
  const [achievementDialogOpen, setAchievementDialogOpen] = useState(false);
  const [isAddingAchievement, setIsAddingAchievement] = useState(false);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    description: "",
    date: "",
    category: "",
  });

  // Event dialog
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    location: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    type: "COMPETITION",
  });

  // Delete team
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTeam();
    fetchAchievements();
  }, [slug]);

  const fetchTeam = async () => {
    try {
      const response = await fetch(`/api/teams/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/teams");
          return;
        }
        throw new Error();
      }

      const data = await response.json();

      // Check if user is admin
      const userMember = data.team.members?.find((m: { userId: string }) => m.userId);
      if (!userMember || !["OWNER", "ADMIN"].includes(userMember.role)) {
        toast.error("Você não tem permissão para editar esta equipe");
        router.push(`/teams/${slug}`);
        return;
      }

      setTeam(data.team);
      setFormData({
        name: data.team.name || "",
        description: data.team.description || "",
        location: data.team.location || "",
        category: data.team.category || "ALLSTAR",
        level: data.team.level || "",
        website: data.team.website || "",
        instagram: data.team.instagram || "",
      });
    } catch {
      toast.error("Erro ao carregar equipe");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAchievements = async () => {
    try {
      const response = await fetch(`/api/teams/${slug}/achievements`);
      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements);
      }
    } catch {
      console.error("Error fetching achievements");
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/teams/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast.success("Equipe atualizada!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;

      try {
        const response = await fetch(`/api/teams/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logo: base64 }),
        });

        if (!response.ok) throw new Error();

        setTeam((prev) => prev ? { ...prev, logo: base64 } : null);
        toast.success("Logo atualizado!");
      } catch {
        toast.error("Erro ao atualizar logo");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      toast.error("Escreva algo para publicar");
      return;
    }

    setIsPosting(true);
    try {
      const response = await fetch(`/api/teams/${slug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postContent }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      setPostContent("");
      toast.success("Post publicado!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao publicar");
    } finally {
      setIsPosting(false);
    }
  };

  const handleAddAchievement = async () => {
    if (!achievementForm.title.trim() || !achievementForm.date) {
      toast.error("Título e data são obrigatórios");
      return;
    }

    setIsAddingAchievement(true);
    try {
      const response = await fetch(`/api/teams/${slug}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(achievementForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data = await response.json();
      setAchievements([data.achievement, ...achievements]);
      setAchievementDialogOpen(false);
      setAchievementForm({ title: "", description: "", date: "", category: "" });
      toast.success("Conquista adicionada!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar");
    } finally {
      setIsAddingAchievement(false);
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    try {
      const response = await fetch(`/api/teams/${slug}/achievements/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setAchievements(achievements.filter((a) => a.id !== id));
      toast.success("Conquista removida");
    } catch {
      toast.error("Erro ao remover conquista");
    }
  };

  const handleAddEvent = async () => {
    if (!eventForm.name.trim() || !eventForm.location.trim() || !eventForm.startDate || !eventForm.startTime) {
      toast.error("Nome, localização, data e hora são obrigatórios");
      return;
    }

    setIsAddingEvent(true);
    try {
      const startDateTime = new Date(`${eventForm.startDate}T${eventForm.startTime}`);
      let endDateTime = null;
      if (eventForm.endDate && eventForm.endTime) {
        endDateTime = new Date(`${eventForm.endDate}T${eventForm.endTime}`);
      }

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventForm.name,
          description: eventForm.description || null,
          location: eventForm.location,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime?.toISOString() || null,
          type: eventForm.type,
          teamId: team?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      setEventDialogOpen(false);
      setEventForm({
        name: "",
        description: "",
        location: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        type: "COMPETITION",
      });
      toast.success("Evento criado!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar evento");
    } finally {
      setIsAddingEvent(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirm("Tem certeza que deseja excluir esta equipe? Esta ação não pode ser desfeita.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/teams/${slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir equipe");
      }

      toast.success("Equipe excluída!");
      router.push("/teams");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir equipe");
    } finally {
      setIsDeleting(false);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-32 w-32 rounded-xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/teams/${slug}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Gerenciar Equipe</h1>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="posts">Publicar</TabsTrigger>
          <TabsTrigger value="achievements">Conquistas</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logo da Equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-32 w-32 rounded-xl">
                    <AvatarImage src={team.logo || undefined} alt={team.name} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-primary text-primary-foreground text-3xl">
                      {getInitials(team.name)}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                    <Camera className="h-4 w-4 text-primary-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Clique no ícone para alterar o logo.</p>
                  <p>Tamanho máximo: 5MB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Equipe *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Nível</label>
                  <Input
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    placeholder="Ex: Level 4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Localização</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: São Paulo, SP"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Instagram</label>
                  <Input
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    placeholder="@equipe"
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Publicar como {team.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Compartilhe novidades da equipe..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={4}
              />
              <Button onClick={handleCreatePost} disabled={isPosting || !postContent.trim()}>
                {isPosting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Publicar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Conquistas da Equipe</h3>
            <Button onClick={() => setAchievementDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {achievements.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma conquista registrada ainda.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {achievements.map((achievement) => (
                <Card key={achievement.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Trophy className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{achievement.title}</h4>
                            {achievement.category && (
                              <Badge variant="secondary" className="text-xs">
                                {achievement.category}
                              </Badge>
                            )}
                          </div>
                          {achievement.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {achievement.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(achievement.date), "dd 'de' MMMM 'de' yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAchievement(achievement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Eventos da Equipe</h3>
            <Button onClick={() => setEventDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Evento
            </Button>
          </div>

          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Os eventos criados aqui aparecerão na página da equipe e na lista geral de eventos.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Excluir equipe</p>
              <p className="text-sm text-muted-foreground">
                Esta ação é irreversível. Todos os dados da equipe serão perdidos.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteTeam}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Equipe
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Dialog */}
      <Dialog open={achievementDialogOpen} onOpenChange={setAchievementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Conquista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                placeholder="Ex: 1º Lugar Nacional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={achievementForm.description}
                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                placeholder="Detalhes sobre a conquista..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data *</label>
                <Input
                  type="date"
                  value={achievementForm.date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <Input
                  value={achievementForm.category}
                  onChange={(e) => setAchievementForm({ ...achievementForm, category: e.target.value })}
                  placeholder="Ex: Competição"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAchievementDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddAchievement} disabled={isAddingAchievement}>
              {isAddingAchievement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Evento da Equipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Evento *</label>
              <Input
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="Ex: Tryout 2026"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Detalhes do evento..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={eventForm.type}
                onValueChange={(value) => setEventForm({ ...eventForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Localização *</label>
              <Input
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="Ex: São Paulo, SP"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Início *</label>
                <Input
                  type="date"
                  value={eventForm.startDate}
                  onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora de Início *</label>
                <Input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Término</label>
                <Input
                  type="date"
                  value={eventForm.endDate}
                  onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora de Término</label>
                <Input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddEvent} disabled={isAddingEvent}>
              {isAddingEvent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
