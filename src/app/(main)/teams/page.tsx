"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, MapPin, Users, Plus, Loader2, User, Mail, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CitySelector } from "@/components/ui/city-selector";
import { getInitials } from "@/lib/utils";
import { categoryLabels } from "@/lib/constants";
import { ErrorState } from "@/components/shared/error-state";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface Team {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  location: string | null;
  category: string;
  level: string | null;
  _count: {
    members: number;
  };
}

const categories = [
  { value: "ALLSTAR", label: "All Star" },
  { value: "SCHOOL", label: "Escolar" },
  { value: "COLLEGE", label: "Universitário" },
  { value: "RECREATIONAL", label: "Recreativo" },
  { value: "PROFESSIONAL", label: "Profissional" },
];

export default function TeamsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showMyTeams, setShowMyTeams] = useState(false);

  // Sugestões
  const [suggestions, setSuggestions] = useState<Team[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [showingSuggestions, setShowingSuggestions] = useState(true);

  // Refs estáveis para valores de filtro usados em fetchFn
  const filtersRef = useRef({ query: "", category: "", locationFilter: "", showMyTeams: false });
  filtersRef.current = { query, category, locationFilter, showMyTeams };

  // Dialog de criação de equipe
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    location: "",
    category: "ALLSTAR",
    level: "",
    instagram: "",
  });

  // Buscar sugestões ao montar
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/teams?mode=suggestions");
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.teams);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, []);

  const fetchTeams = useCallback(async (cursor: string | null) => {
    const f = filtersRef.current;
    const params = new URLSearchParams();
    if (f.query) params.set("q", f.query);
    if (f.category && f.category.trim()) params.set("category", f.category);
    if (f.locationFilter) params.set("location", f.locationFilter);
    if (cursor) params.set("cursor", cursor);

    const endpoint = f.showMyTeams ? "/api/users/me/teams" : "/api/teams";
    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { items: data.teams as Team[], nextCursor: data.nextCursor as string | null };
  }, []);

  const {
    items: teams,
    isLoading,
    isLoadingMore,
    error,
    sentinelRef,
    reset,
  } = useInfiniteScroll({ fetchFn: fetchTeams, enabled: !showingSuggestions });

  const handleSearch = () => {
    const f = filtersRef.current;
    const hasFilters = f.query || (f.category && f.category.trim()) || f.locationFilter || f.showMyTeams;
    if (!hasFilters) {
      setShowingSuggestions(true);
      return;
    }
    setShowingSuggestions(false);
    setTimeout(reset, 0);
  };

  const toggleMyTeams = () => {
    const newVal = !showMyTeams;
    setShowMyTeams(newVal);
    if (!newVal && !query && (!category || !category.trim()) && !locationFilter) {
      setShowingSuggestions(true);
      return;
    }
    setShowingSuggestions(false);
    setTimeout(reset, 0);
  };

  const handleCreateTeam = async () => {
    if (!teamForm.name.trim()) {
      toast.error("Nome da equipe é obrigatório");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar equipe");
      }

      toast.success("Equipe criada com sucesso!");
      setCreateDialogOpen(false);
      setTeamForm({
        name: "",
        description: "",
        location: "",
        category: "ALLSTAR",
        level: "",
        instagram: "",
      });
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar equipe");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading-section font-display">Equipes</h1>
        <div className="flex gap-2">
          <Link href="/teams/invites">
            <Button variant="outline" className="hover-glow">
              <Mail className="h-4 w-4 mr-2" />
              Convites
            </Button>
          </Link>
          <Button variant="premium" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Equipe
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="bento-card-static p-4 space-y-4">
          {/* Linha 1: Busca grande */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar equipes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-12 h-12 text-base input-premium"
            />
          </div>

          {/* Linha 2: Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todas as categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-full sm:w-auto sm:flex-1">
              <CitySelector
                value={locationFilter}
                onChange={setLocationFilter}
                placeholder="Cidade"
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button
              variant={showMyTeams ? "default" : "outline"}
              onClick={toggleMyTeams}
            >
              <User className="h-4 w-4 mr-2" />
              Meus Times
            </Button>
          </div>
      </div>

      {/* Grid de equipes */}
      {showingSuggestions ? (
        isLoadingSuggestions ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bento-card-static p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : suggestions.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">Sugestões para você</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4 stagger-children">
              {suggestions.map((team, index) => (
                <Link key={team.id} href={`/teams/${team.slug}`}>
                  <div className="bento-card h-full" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="accent-bar" />
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16 rounded-lg shrink-0 avatar-glow">
                          <AvatarImage src={team.logo || undefined} alt={team.name} />
                          <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-lg font-display font-bold">
                            {getInitials(team.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold truncate">{team.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="gradient" className="text-xs">
                              {categoryLabels[team.category] || team.category}
                            </Badge>
                            {team.level && (
                              <Badge variant="subtle" className="text-xs">
                                {team.level}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {team.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {team.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span className="stat-number">{team._count.members}</span> membros
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="bento-card-static p-8 text-center text-muted-foreground">
            Nenhuma equipe encontrada. Tente outros filtros ou crie uma nova equipe.
          </div>
        )
      ) : error ? (
        <ErrorState message={error} onRetry={reset} />
      ) : isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bento-card-static p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="bento-card-static p-8 text-center text-muted-foreground">
          Nenhuma equipe encontrada. Tente outros filtros ou crie uma nova equipe.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4 stagger-children">
            {teams.map((team, index) => (
              <Link key={team.id} href={`/teams/${team.slug}`}>
                <div className="bento-card h-full" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="accent-bar" />
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 rounded-lg shrink-0 avatar-glow">
                        <AvatarImage src={team.logo || undefined} alt={team.name} />
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-lg font-display font-bold">
                          {getInitials(team.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold truncate">{team.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="gradient" className="text-xs">
                            {categoryLabels[team.category] || team.category}
                          </Badge>
                          {team.level && (
                            <Badge variant="subtle" className="text-xs">
                              {team.level}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {team.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {team.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span className="stat-number">{team._count.members}</span> membros
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div ref={sentinelRef} />
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}

      {/* Dialog de criação de equipe */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Nova Equipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Equipe *</label>
              <Input
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="Ex: Sharks Allstars"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={teamForm.description}
                onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                placeholder="Sobre a equipe..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria *</label>
                <Select
                  value={teamForm.category}
                  onValueChange={(value) => setTeamForm({ ...teamForm, category: value })}
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
                  value={teamForm.level}
                  onChange={(e) => setTeamForm({ ...teamForm, level: e.target.value })}
                  placeholder="Ex: Level 4"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Localização</label>
              <CitySelector
                value={teamForm.location}
                onChange={(value) => setTeamForm({ ...teamForm, location: value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram</label>
              <Input
                value={teamForm.instagram}
                onChange={(e) => setTeamForm({ ...teamForm, instagram: e.target.value })}
                placeholder="@equipe"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="premium" onClick={handleCreateTeam} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
