"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSession } from "next-auth/react";
import { MapPin, Calendar, Filter, Plus, Loader2, MoreHorizontal, Pencil, Trash2, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CitySelector } from "@/components/ui/city-selector";

interface Event {
  id: string;
  name: string;
  description: string | null;
  location: string;
  startDate: string;
  endDate: string | null;
  type: string;
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

const eventTypeLabels: Record<string, string> = {
  COMPETITION: "Competição",
  TRYOUT: "Tryout",
  CAMP: "Camp",
  WORKSHOP: "Workshop",
  SHOWCASE: "Showcase",
  OTHER: "Outro",
};

const eventTypes = [
  { value: "COMPETITION", label: "Competição" },
  { value: "TRYOUT", label: "Tryout" },
  { value: "CAMP", label: "Camp" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "SHOWCASE", label: "Showcase" },
  { value: "OTHER", label: "Outro" },
];

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // User location for automatic filtering
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [filterByUserLocation, setFilterByUserLocation] = useState(true);
  const [isLoadingUserLocation, setIsLoadingUserLocation] = useState(true);

  // Create event dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

  // Edit event dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    location: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    type: "COMPETITION",
  });

  // Fetch user location on mount
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.location) {
            setUserLocation(data.user.location);
          }
        }
      } catch {
        console.error("Error fetching user location");
      } finally {
        setIsLoadingUserLocation(false);
      }
    };
    fetchUserLocation();
  }, []);

  const fetchEvents = useCallback(async (useUserLocationFilter?: boolean) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== " ") params.set("type", typeFilter);
      if (searchQuery) params.set("q", searchQuery);

      // Use user location as default filter if enabled and no manual location filter
      const shouldUseUserLocation = useUserLocationFilter ?? filterByUserLocation;
      if (locationFilter) {
        params.set("location", locationFilter);
      } else if (shouldUseUserLocation && userLocation) {
        params.set("location", userLocation);
      }

      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) throw new Error();

      const data = await response.json();
      setEvents(data.events);
    } catch {
      console.error("Error fetching events");
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, searchQuery, locationFilter, filterByUserLocation, userLocation]);

  // Fetch events once user location is loaded
  useEffect(() => {
    if (!isLoadingUserLocation) {
      fetchEvents();
    }
  }, [isLoadingUserLocation, fetchEvents]);

  const handleCreateEvent = async () => {
    if (!eventForm.name.trim()) {
      toast.error("Nome do evento é obrigatório");
      return;
    }
    if (!eventForm.location.trim()) {
      toast.error("Localização é obrigatória");
      return;
    }
    if (!eventForm.startDate || !eventForm.startTime) {
      toast.error("Data e hora de início são obrigatórias");
      return;
    }

    setIsCreating(true);
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
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar evento");
      }

      toast.success("Evento criado com sucesso!");
      setCreateDialogOpen(false);
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
      fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar evento");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
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
    });
    setEditDialogOpen(true);
  };

  const handleEditEvent = async () => {
    if (!editingEvent) return;

    if (!editForm.name.trim()) {
      toast.error("Nome do evento é obrigatório");
      return;
    }
    if (!editForm.location.trim()) {
      toast.error("Localização é obrigatória");
      return;
    }
    if (!editForm.startDate || !editForm.startTime) {
      toast.error("Data e hora de início são obrigatórias");
      return;
    }

    setIsEditing(true);
    try {
      const startDateTime = new Date(`${editForm.startDate}T${editForm.startTime}`);
      let endDateTime = null;
      if (editForm.endDate && editForm.endTime) {
        endDateTime = new Date(`${editForm.endDate}T${editForm.endTime}`);
      }

      const response = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          location: editForm.location,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime?.toISOString() || null,
          type: editForm.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao editar evento");
      }

      toast.success("Evento atualizado!");
      setEditDialogOpen(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao editar evento");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir evento");
      }

      toast.success("Evento excluído!");
      fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir evento");
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

  // Group events by month
  const groupedEvents = events.reduce(
    (groups, event) => {
      const month = format(new Date(event.startDate), "MMMM yyyy", {
        locale: ptBR,
      });
      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(event);
      return groups;
    },
    {} as Record<string, Event[]>
  );

  const handleSearch = () => {
    fetchEvents();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Evento
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Linha 1: Busca grande */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar eventos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-12 h-12 text-base"
            />
          </div>

          {/* Linha 2: Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-auto">
              <CitySelector
                value={locationFilter}
                onChange={setLocationFilter}
                placeholder="Filtrar por local"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todos os tipos</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Location filter indicator */}
      {filterByUserLocation && userLocation && !locationFilter && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <MapPin className="h-4 w-4" />
          <span>Mostrando eventos em <strong>{userLocation}</strong></span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-auto py-1 px-2"
            onClick={() => {
              setFilterByUserLocation(false);
              fetchEvents(false);
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Ver todos
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum evento próximo encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold mb-4 capitalize">{month}</h2>
              <div className="space-y-3">
                {monthEvents.map((event) => {
                  const isCreator = session?.user?.id === event.creatorId;

                  return (
                    <Card key={event.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="shrink-0 w-16 h-16 bg-primary/10 rounded-lg flex flex-col items-center justify-center">
                            <div className="text-2xl font-bold text-primary">
                              {format(new Date(event.startDate), "dd")}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase">
                              {format(new Date(event.startDate), "EEE", {
                                locale: ptBR,
                              })}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold">{event.name}</h3>
                                <Badge variant="secondary" className="text-xs">
                                  {eventTypeLabels[event.type] || event.type}
                                </Badge>
                              </div>

                              {isCreator && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(event)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteEvent(event.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>

                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(event.startDate), "HH:mm", {
                                  locale: ptBR,
                                })}
                                {event.endDate &&
                                  ` - ${format(new Date(event.endDate), "HH:mm", {
                                    locale: ptBR,
                                  })}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 mt-3">
                              {event.team ? (
                                <Link
                                  href={`/teams/${event.team.slug}`}
                                  className="flex items-center gap-2 hover:opacity-80"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={event.team.logo || undefined}
                                      alt={event.team.name}
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                      {getInitials(event.team.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">por {event.team.name}</span>
                                </Link>
                              ) : event.creator && (
                                <Link
                                  href={`/profile/${event.creator.username}`}
                                  className="flex items-center gap-2 hover:opacity-80"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={event.creator.avatar || undefined}
                                      alt={event.creator.name}
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="text-xs bg-muted">
                                      {getInitials(event.creator.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-muted-foreground">
                                    por {event.creator.name}
                                  </span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Evento *</label>
              <Input
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="Ex: Campeonato Nacional"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Detalhes sobre o evento..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo *</label>
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
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEvent} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
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
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ex: Campeonato Nacional"
              />
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
                onChange={(value) => setEditForm({ ...editForm, location: value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Início *</label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora de Início *</label>
                <Input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Término</label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
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
    </div>
  );
}
