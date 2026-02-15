"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MapPin,
  Calendar,
  ArrowLeft,
  ExternalLink,
  Pencil,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { motion, useReducedMotion } from "framer-motion";
import { fadeSlideUp, noMotion } from "@/lib/animations";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { eventTypeLabels, eventTypes } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CitySelector } from "@/components/ui/city-selector";

interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  location: string;
  startDate: string;
  endDate: string | null;
  type: string;
  registrationUrl: string | null;
  creatorId: string | null;
  creator: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const itemVariants = shouldReduceMotion ? noMotion : fadeSlideUp;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    location: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    type: "COMPETITION",
    registrationUrl: "",
  });

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${params.id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvent(data.event);
      setIsCreator(data.isCreator);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const openEditDialog = () => {
    if (!event) return;
    const startDate = new Date(event.startDate);
    const endDate = event.endDate ? new Date(event.endDate) : null;

    setEditForm({
      name: event.name,
      description: event.description || "",
      location: event.location,
      startDate: startDate.toISOString().split("T")[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endDate: endDate ? endDate.toISOString().split("T")[0] : "",
      endTime: endDate ? endDate.toTimeString().slice(0, 5) : "",
      type: event.type,
      registrationUrl: event.registrationUrl || "",
    });
    setEditFormErrors({});
    setEditDialogOpen(true);
  };

  const handleEditEvent = async () => {
    if (!event) return;

    const errors: Record<string, string> = {};
    if (!editForm.name || editForm.name.trim().length < 2) {
      errors.name = "Nome do evento é obrigatório (mínimo 2 caracteres)";
    }
    if (!editForm.location.trim()) {
      errors.location = "Localização é obrigatória";
    }
    if (!editForm.startDate) {
      errors.startDate = "Data de início é obrigatória";
    }
    if (!editForm.startTime) {
      errors.startTime = "Hora de início é obrigatória";
    }
    if (editForm.endDate && editForm.startDate && editForm.endDate < editForm.startDate) {
      errors.endDate = "Data de término deve ser igual ou posterior à data de início";
    }
    setEditFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsEditing(true);
    try {
      const startDateTime = new Date(`${editForm.startDate}T${editForm.startTime}`);
      let endDateTime = null;
      if (editForm.endDate && editForm.endTime) {
        endDateTime = new Date(`${editForm.endDate}T${editForm.endTime}`);
      }

      const response = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          location: editForm.location,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime?.toISOString() || null,
          type: editForm.type,
          registrationUrl: editForm.registrationUrl || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao editar evento");
      }

      const data = await response.json();
      setEvent(data.event);
      toast.success("Evento atualizado!");
      setEditDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao editar evento");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir evento");
      }

      toast.success("Evento excluído!");
      router.push("/events");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir evento");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="bento-card-static p-6 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="space-y-6">
        <Link href="/events">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Eventos
          </Button>
        </Link>
        <div className="bento-card-static p-12 text-center space-y-3">
          <p className="text-lg font-display font-semibold">Evento não encontrado</p>
          <p className="text-sm text-muted-foreground">
            Este evento pode ter sido removido ou o link está incorreto.
          </p>
        </div>
      </div>
    );
  }

  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : null;
  const isPast = startDate < new Date();

  return (
    <div className="space-y-6">
      <Link href="/events">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Eventos
        </Button>
      </Link>

      <motion.div
        className="bento-card-static overflow-hidden"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Accent bar */}
        <div className="accent-bar" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header: Name + Badge + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="heading-section font-display">{event.name}</h1>
                <Badge variant="gradient">
                  {eventTypeLabels[event.type] || event.type}
                </Badge>
                {isPast && (
                  <Badge variant="secondary" className="text-xs">Encerrado</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {event.registrationUrl && !isPast && (
                <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="premium">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Inscrever-se
                  </Button>
                </a>
              )}
              {isCreator && (
                <>
                  <Button variant="outline" size="icon" onClick={openEditDialog} aria-label="Editar evento">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setDeleteDialogOpen(true)} aria-label="Excluir evento" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-editorial text-muted-foreground whitespace-pre-wrap">
              {event.description}
            </p>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 glass rounded-xl">
              <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium font-display">Data de Início</p>
                <time dateTime={startDate.toISOString()} className="text-sm text-muted-foreground">
                  {format(startDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </time>
              </div>
            </div>

            {endDate && (
              <div className="flex items-start gap-3 p-4 glass rounded-xl">
                <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium font-display">Data de Término</p>
                  <time dateTime={endDate.toISOString()} className="text-sm text-muted-foreground">
                    {format(endDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </time>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 glass rounded-xl">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium font-display">Localização</p>
                <p className="text-sm text-muted-foreground">{event.location}</p>
              </div>
            </div>

            {event.registrationUrl && (
              <div className="flex items-start gap-3 p-4 glass rounded-xl">
                <ExternalLink className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium font-display">Link de Inscrição</p>
                  <a
                    href={event.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate block"
                  >
                    {event.registrationUrl}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Organizer */}
          <div className="border-t pt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-display mb-3">Organizador</p>
            {event.team ? (
              <Link
                href={`/teams/${event.team.slug}`}
                className="flex items-center gap-3 hover:opacity-80 transition-fast w-fit"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={event.team.logo || undefined}
                    alt={event.team.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-display">
                    {getInitials(event.team.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-display font-semibold text-sm">{event.team.name}</p>
                  <p className="text-xs text-muted-foreground">Equipe</p>
                </div>
              </Link>
            ) : event.creator ? (
              <Link
                href={`/profile/${event.creator.username}`}
                className="flex items-center gap-3 hover:opacity-80 transition-fast w-fit"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={event.creator.avatar || undefined}
                    alt={event.creator.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted font-display">
                    {getInitials(event.creator.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-display font-semibold text-sm">{event.creator.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">@{event.creator.username}</p>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Organizador desconhecido</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Evento *</label>
              <Input
                value={editForm.name}
                onChange={(e) => {
                  setEditForm({ ...editForm, name: e.target.value });
                  if (editFormErrors.name) setEditFormErrors((prev) => { const { name: _, ...rest } = prev; return rest; });
                }}
                placeholder="Ex: Campeonato Nacional"
              />
              {editFormErrors.name && <p className="text-xs text-destructive mt-1">{editFormErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Detalhes sobre o evento..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Link de Inscrição</label>
              <Input
                type="url"
                value={editForm.registrationUrl}
                onChange={(e) => setEditForm({ ...editForm, registrationUrl: e.target.value })}
                placeholder="https://forms.google.com/..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo *</label>
              <Select
                value={editForm.type}
                onValueChange={(value) => setEditForm({ ...editForm, type: value })}
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
                value={editForm.location}
                onChange={(value) => {
                  setEditForm({ ...editForm, location: value });
                  if (editFormErrors.location) setEditFormErrors((prev) => { const { location: _, ...rest } = prev; return rest; });
                }}
              />
              {editFormErrors.location && <p className="text-xs text-destructive mt-1">{editFormErrors.location}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Início *</label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => {
                    setEditForm({ ...editForm, startDate: e.target.value });
                    if (editFormErrors.startDate) setEditFormErrors((prev) => { const { startDate: _, ...rest } = prev; return rest; });
                  }}
                />
                {editFormErrors.startDate && <p className="text-xs text-destructive mt-1">{editFormErrors.startDate}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora de Início *</label>
                <Input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => {
                    setEditForm({ ...editForm, startTime: e.target.value });
                    if (editFormErrors.startTime) setEditFormErrors((prev) => { const { startTime: _, ...rest } = prev; return rest; });
                  }}
                />
                {editFormErrors.startTime && <p className="text-xs text-destructive mt-1">{editFormErrors.startTime}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Término</label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => {
                    setEditForm({ ...editForm, endDate: e.target.value });
                    if (editFormErrors.endDate) setEditFormErrors((prev) => { const { endDate: _, ...rest } = prev; return rest; });
                  }}
                />
                {editFormErrors.endDate && <p className="text-xs text-destructive mt-1">{editFormErrors.endDate}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora de Término</label>
                <Input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditEvent} disabled={isEditing}>
              {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir este evento?"
        confirmLabel="Excluir"
        isLoading={isDeleting}
        onConfirm={handleDeleteEvent}
      />
    </div>
  );
}
