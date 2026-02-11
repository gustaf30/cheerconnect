"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Send,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { CitySelector } from "@/components/ui/city-selector";
import { eventTypes } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TeamInfoForm } from "@/components/teams/edit/TeamInfoForm";
import { MemberList } from "@/components/teams/edit/MemberList";
import { AchievementSection } from "@/components/teams/edit/AchievementSection";

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

interface TeamMember {
  id: string;
  role: string;
  hasPermission: boolean;
  isAdmin: boolean;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    positions: string[];
  };
}

interface TeamInvite {
  id: string;
  role: string;
  hasPermission: boolean;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
}

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

  // Estado do formulário
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    category: "ALLSTAR",
    level: "",
    website: "",
    instagram: "",
  });

  // Estado de publicação
  const [postContent, setPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Dialog de evento
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

  // Excluir equipe
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTeamConfirmOpen, setDeleteTeamConfirmOpen] = useState(false);

  // Estado de membros
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);

  const fetchTeam = useCallback(async () => {
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

      const userMember = data.team.members?.find((m: { userId: string; hasPermission: boolean }) => m.hasPermission);
      if (!userMember) {
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
  }, [slug, router]);

  const fetchAchievements = useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/${slug}/achievements`);
      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements);
      }
    } catch {
      console.error("Erro ao buscar conquistas");
    }
  }, [slug]);

  const fetchMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/teams/${slug}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
        setCurrentUserIsAdmin(data.isAdmin);
      }
    } catch {
      console.error("Erro ao buscar membros");
    } finally {
      setIsLoadingMembers(false);
    }
  }, [slug]);

  const fetchInvites = useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/${slug}/invites`);
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites);
      }
    } catch {
      console.error("Erro ao buscar convites");
    }
  }, [slug]);

  useEffect(() => {
    fetchTeam();
    fetchAchievements();
    fetchMembers();
    fetchInvites();
  }, [fetchTeam, fetchAchievements, fetchMembers, fetchInvites]);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="bento-card-static">
          <div className="p-6 space-y-4">
            <Skeleton className="h-32 w-32 rounded-xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
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
        <h1 className="heading-section font-display">Gerenciar Equipe</h1>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="posts">Publicar</TabsTrigger>
          <TabsTrigger value="achievements">Conquistas</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>

        {/* Aba Informações */}
        <TabsContent value="info" className="mt-4">
          <TeamInfoForm
            team={team}
            formData={formData}
            setFormData={setFormData}
            isSaving={isSaving}
            onSave={handleSave}
            onLogoUpload={handleLogoUpload}
          />
        </TabsContent>

        {/* Aba Membros */}
        <TabsContent value="members" className="mt-4">
          <MemberList
            slug={slug}
            members={members}
            setMembers={setMembers}
            invites={invites}
            setInvites={setInvites}
            isLoadingMembers={isLoadingMembers}
            currentUserIsAdmin={currentUserIsAdmin}
            fetchInvites={fetchInvites}
          />
        </TabsContent>

        {/* Aba Publicações */}
        <TabsContent value="posts" className="mt-4">
          <div className="bento-card-static">
            <div className="p-6 pb-2">
              <h2 className="heading-card font-display">Publicar como {team.name}</h2>
            </div>
            <div className="p-6 pt-0 space-y-4">
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
            </div>
          </div>
        </TabsContent>

        {/* Aba Conquistas */}
        <TabsContent value="achievements" className="mt-4">
          <AchievementSection
            slug={slug}
            teamName={team.name}
            achievements={achievements}
            setAchievements={setAchievements}
          />
        </TabsContent>

        {/* Aba Eventos */}
        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Eventos da Equipe</h3>
            <Button onClick={() => setEventDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Evento
            </Button>
          </div>

          <div className="bento-card-static">
            <div className="p-8 text-center text-muted-foreground">
              Os eventos criados aqui aparecerão na página da equipe e na lista geral de eventos.
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Zona de Perigo */}
      <div className="bento-card-static border-destructive/30">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display text-destructive">Zona de Perigo</h2>
        </div>
        <div className="p-6 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Excluir equipe</p>
              <p className="text-sm text-muted-foreground">
                Esta ação é irreversível. Todos os dados da equipe serão perdidos.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setDeleteTeamConfirmOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Equipe
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de Evento */}
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
              <CitySelector
                value={eventForm.location}
                onChange={(value) => setEventForm({ ...eventForm, location: value })}
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

      <ConfirmDialog
        open={deleteTeamConfirmOpen}
        onOpenChange={setDeleteTeamConfirmOpen}
        title="Excluir esta equipe?"
        description="Esta ação é irreversível. Todos os dados da equipe serão perdidos."
        confirmLabel="Excluir equipe"
        isLoading={isDeleting}
        onConfirm={handleDeleteTeam}
      />
    </div>
  );
}
