"use client";

import { useEffect, useState, use, useCallback } from "react";
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
  Share2,
  Users,
  X,
  UserPlus,
  Search,
  Pencil,
  Check,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CitySelector } from "@/components/ui/city-selector";
import { getInitials } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

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

interface ConnectedUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
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

const roleOptions = [
  "Atleta",
  "Técnico",
  "Assistente",
  "Coreógrafo",
  "Marketing",
  "Diretor",
  "Presidente",
  "Outro",
];

const CUSTOM_ROLE = "Outro";
const EMPTY_ROLE = "__none__";

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

  // Share achievement state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePostContent, setSharePostContent] = useState("");
  const [isSharing, setIsSharing] = useState(false);

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

  // Members state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConnectedUser | null>(null);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteCustomRole, setInviteCustomRole] = useState("");
  const [inviteHasPermission, setInviteHasPermission] = useState(false);
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberEditRole, setMemberEditRole] = useState("");
  const [memberEditCustomRole, setMemberEditCustomRole] = useState("");
  const [memberEditHasPermission, setMemberEditHasPermission] = useState(false);
  const [memberEditIsAdmin, setMemberEditIsAdmin] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTeamConfirmOpen, setDeleteTeamConfirmOpen] = useState(false);

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

      // Check if user has permission to edit
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
      console.error("Error fetching achievements");
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
      console.error("Error fetching members");
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
      console.error("Error fetching invites");
    }
  }, [slug]);

  useEffect(() => {
    fetchTeam();
    fetchAchievements();
    fetchMembers();
    fetchInvites();
  }, [fetchTeam, fetchAchievements, fetchMembers, fetchInvites]);

  const searchConnections = async (query: string) => {
    if (!query.trim()) {
      setConnectedUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("/api/connections");
      if (response.ok) {
        const data = await response.json();
        const acceptedConnections = data.connections.filter(
          (c: { status: string }) => c.status === "ACCEPTED"
        );

        // Get the other user from each connection
        const users: ConnectedUser[] = acceptedConnections.map(
          (c: { user: ConnectedUser }) => c.user
        );

        // Filter by query and exclude existing members
        const memberUserIds = new Set(members.map((m) => m.user.id));
        const inviteUserIds = new Set(invites.map((i) => i.user.id));

        const filtered = users.filter(
          (u) =>
            !memberUserIds.has(u.id) &&
            !inviteUserIds.has(u.id) &&
            (u.name.toLowerCase().includes(query.toLowerCase()) ||
              u.username.toLowerCase().includes(query.toLowerCase()))
        );

        setConnectedUsers(filtered.slice(0, 10));
      }
    } catch {
      console.error("Error searching connections");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedUser) return;

    // Determine the final role value
    let finalRole = inviteRole === CUSTOM_ROLE ? inviteCustomRole : inviteRole;
    if (finalRole === EMPTY_ROLE) finalRole = "";

    setIsSendingInvite(true);
    try {
      const response = await fetch(`/api/teams/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: finalRole,
          hasPermission: inviteHasPermission,
          isAdmin: inviteIsAdmin,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast.success(`Convite enviado para ${selectedUser.name}`);
      setInviteDialogOpen(false);
      setSelectedUser(null);
      setSearchQuery("");
      setConnectedUsers([]);
      setInviteRole("");
      setInviteCustomRole("");
      setInviteHasPermission(false);
      setInviteIsAdmin(false);
      fetchInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    // Check if current role is a predefined option or custom
    const isPredefinedRole = roleOptions.includes(member.role) && member.role !== CUSTOM_ROLE;
    if (isPredefinedRole) {
      setMemberEditRole(member.role);
      setMemberEditCustomRole("");
    } else if (member.role) {
      // Custom role
      setMemberEditRole(CUSTOM_ROLE);
      setMemberEditCustomRole(member.role);
    } else {
      // Empty role - use sentinel value
      setMemberEditRole(EMPTY_ROLE);
      setMemberEditCustomRole("");
    }
    setMemberEditHasPermission(member.hasPermission);
    setMemberEditIsAdmin(member.isAdmin);
  };

  const handleSaveMember = async (memberId: string) => {
    // Determine the final role value
    let finalRole = memberEditRole === CUSTOM_ROLE ? memberEditCustomRole : memberEditRole;
    if (finalRole === EMPTY_ROLE) finalRole = "";

    setIsSavingMember(true);
    try {
      const response = await fetch(`/api/teams/${slug}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: finalRole,
          hasPermission: memberEditHasPermission,
          isAdmin: memberEditIsAdmin,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data = await response.json();
      setMembers(members.map((m) => m.id === memberId ? data.member : m));
      setEditingMemberId(null);
      toast.success("Informações atualizadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setMemberEditRole("");
    setMemberEditCustomRole("");
    setMemberEditHasPermission(false);
    setMemberEditIsAdmin(false);
  };

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingInviteId(inviteId);
    try {
      const response = await fetch(`/api/teams/${slug}/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      setInvites(invites.filter((i) => i.id !== inviteId));
      toast.success("Convite cancelado");
    } catch {
      toast.error("Erro ao cancelar convite");
    } finally {
      setCancellingInviteId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setRemovingMemberId(removeMemberTarget.id);
    try {
      const response = await fetch(`/api/teams/${slug}/members/${removeMemberTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      setMembers(members.filter((m) => m.id !== removeMemberTarget.id));
      setRemoveMemberTarget(null);
      toast.success("Membro removido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover membro");
    } finally {
      setRemovingMemberId(null);
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

      // Prepare share dialog
      const dateFormatted = new Date(achievementForm.date).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      let postContent = `🏆 Nova conquista da ${team?.name}!\n\n${achievementForm.title}`;
      if (achievementForm.category) {
        postContent += ` (${achievementForm.category})`;
      }
      postContent += `\n📅 ${dateFormatted}`;
      if (achievementForm.description) {
        postContent += `\n\n${achievementForm.description}`;
      }

      setSharePostContent(postContent);
      setAchievementForm({ title: "", description: "", date: "", category: "" });
      toast.success("Conquista adicionada!");

      // Show share dialog
      setShareDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar");
    } finally {
      setIsAddingAchievement(false);
    }
  };

  const handleShareAchievement = async () => {
    if (!sharePostContent.trim()) {
      toast.error("Escreva algo para publicar");
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch(`/api/teams/${slug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sharePostContent }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast.success("Conquista compartilhada!");
      setShareDialogOpen(false);
      setSharePostContent("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao compartilhar");
    } finally {
      setIsSharing(false);
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

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4 space-y-6">
          <div className="bento-card-static">
            <div className="p-6 pb-2">
              <h2 className="heading-card font-display">Logo da Equipe</h2>
            </div>
            <div className="p-6 pt-0">
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
            </div>
          </div>

          <div className="bento-card-static">
            <div className="p-6 pb-2">
              <h2 className="heading-card font-display">Informações Básicas</h2>
            </div>
            <div className="p-6 pt-0 space-y-4">
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
                <CitySelector
                  value={formData.location}
                  onChange={(value) => setFormData({ ...formData, location: value })}
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
            </div>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4 space-y-6">
          {/* Invite Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Membros da Equipe</h3>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div className="bento-card-static">
              <div className="p-6 pb-2">
                <h2 className="heading-card font-display text-base">Convites Pendentes</h2>
              </div>
              <div className="p-6 pt-0 space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={invite.user.avatar || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(invite.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{invite.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          @{invite.user.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {invite.role && (
                        <Badge variant="secondary">
                          {invite.role}
                        </Badge>
                      )}
                      {invite.isAdmin && (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                      {invite.hasPermission && !invite.isAdmin && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Permissão
                        </Badge>
                      )}
                      <Badge variant="outline">Pendente</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={cancellingInviteId === invite.id}
                      >
                        {cancellingInviteId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Members */}
          <div className="bento-card-static">
            <div className="p-6 pb-2">
              <h2 className="heading-card font-display text-base">
                Membros Ativos ({members.length})
              </h2>
            </div>
            <div className="p-6 pt-0">
              {isLoadingMembers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum membro na equipe.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 rounded-lg bg-muted/50"
                    >
                      {editingMemberId === member.id ? (
                        // Editing mode
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={member.user.avatar || undefined}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.user.name}</p>
                              <p className="text-sm text-muted-foreground">
                                @{member.user.username}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3 pl-13">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Função (opcional)</label>
                              <Select value={memberEditRole} onValueChange={setMemberEditRole}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione uma função" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={EMPTY_ROLE}>Nenhuma</SelectItem>
                                  {roleOptions.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {memberEditRole === CUSTOM_ROLE && (
                                <Input
                                  placeholder="Digite a função customizada..."
                                  value={memberEditCustomRole}
                                  onChange={(e) => setMemberEditCustomRole(e.target.value)}
                                  className="mt-2"
                                />
                              )}
                            </div>
                            {currentUserIsAdmin && (
                              <>
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      Tem permissão
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                      Pode editar equipe, postar e convidar
                                    </p>
                                  </div>
                                  <Switch
                                    checked={memberEditHasPermission}
                                    onCheckedChange={setMemberEditHasPermission}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                      <ShieldCheck className="h-4 w-4" />
                                      É administrador
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                      Pode gerenciar outros membros com permissão
                                    </p>
                                  </div>
                                  <Switch
                                    checked={memberEditIsAdmin}
                                    onCheckedChange={(checked) => {
                                      setMemberEditIsAdmin(checked);
                                      if (checked) setMemberEditHasPermission(true);
                                    }}
                                  />
                                </div>
                              </>
                            )}
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveMember(member.id)}
                                disabled={isSavingMember}
                              >
                                {isSavingMember ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Check className="h-4 w-4 mr-2" />
                                )}
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={member.user.avatar || undefined}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.user.name}</p>
                              <p className="text-sm text-muted-foreground">
                                @{member.user.username}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.role && (
                              <Badge variant="secondary">
                                {member.role}
                              </Badge>
                            )}
                            {member.isAdmin && (
                              <Badge variant="default" className="gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                            {member.hasPermission && !member.isAdmin && (
                              <Badge variant="outline" className="gap-1">
                                <Shield className="h-3 w-3" />
                                Permissão
                              </Badge>
                            )}
                            {/* Can edit if: I'm admin, or I have permission and target doesn't have permission */}
                            {(currentUserIsAdmin || (!member.hasPermission && !member.isAdmin)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditMember(member)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Can remove if: I'm admin, or I have permission and target doesn't have permission */}
                            {(currentUserIsAdmin || (!member.hasPermission && !member.isAdmin)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setRemoveMemberTarget({ id: member.id, name: member.user.name })}
                                disabled={removingMemberId === member.id}
                              >
                                {removingMemberId === member.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Posts Tab */}
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
            <div className="bento-card-static">
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma conquista registrada ainda.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {achievements.map((achievement) => (
                <div key={achievement.id} className="bento-card-static">
                  <div className="p-4">
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
                  </div>
                </div>
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

          <div className="bento-card-static">
            <div className="p-8 text-center text-muted-foreground">
              Os eventos criados aqui aparecerão na página da equipe e na lista geral de eventos.
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
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
              Deseja compartilhar essa conquista no feed da equipe? Você pode editar o texto antes de publicar.
            </p>
            <Textarea
              value={sharePostContent}
              onChange={(e) => setSharePostContent(e.target.value)}
              placeholder="Escreva algo sobre a conquista..."
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

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) {
          setSelectedUser(null);
          setSearchQuery("");
          setConnectedUsers([]);
          setInviteRole("");
          setInviteCustomRole("");
          setInviteHasPermission(false);
          setInviteIsAdmin(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Convidar Membro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedUser ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Busque entre suas conexões para convidar alguém para a equipe.
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou username..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchConnections(e.target.value);
                    }}
                    className="pl-9"
                  />
                </div>
                {isSearching ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : connectedUsers.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {connectedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length > 0 ? (
                  <p className="text-center py-4 text-sm text-muted-foreground">
                    Nenhuma conexão encontrada.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(selectedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">
                      @{selectedUser.username}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Função na Equipe (opcional)</label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_ROLE}>Nenhuma</SelectItem>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inviteRole === CUSTOM_ROLE && (
                      <Input
                        placeholder="Digite a função customizada..."
                        value={inviteCustomRole}
                        onChange={(e) => setInviteCustomRole(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                  {currentUserIsAdmin && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Tem permissão
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Pode editar equipe, postar e convidar
                          </p>
                        </div>
                        <Switch
                          checked={inviteHasPermission}
                          onCheckedChange={setInviteHasPermission}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            É administrador
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Pode gerenciar outros membros com permissão
                          </p>
                        </div>
                        <Switch
                          checked={inviteIsAdmin}
                          onCheckedChange={(checked) => {
                            setInviteIsAdmin(checked);
                            if (checked) setInviteHasPermission(true);
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendInvite}
              disabled={!selectedUser || isSendingInvite}
            >
              {isSendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeMemberTarget}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
        title={`Remover ${removeMemberTarget?.name || ""} da equipe?`}
        confirmLabel="Remover"
        isLoading={!!removingMemberId}
        onConfirm={handleRemoveMember}
      />

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
