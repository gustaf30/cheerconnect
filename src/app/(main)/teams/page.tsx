"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Users, Plus, Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

const categoryLabels: Record<string, string> = {
  ALLSTAR: "All Star",
  SCHOOL: "Escolar",
  COLLEGE: "Universitário",
  RECREATIONAL: "Recreativo",
  PROFESSIONAL: "Profissional",
};

const categories = [
  { value: "ALLSTAR", label: "All Star" },
  { value: "SCHOOL", label: "Escolar" },
  { value: "COLLEGE", label: "Universitário" },
  { value: "RECREATIONAL", label: "Recreativo" },
  { value: "PROFESSIONAL", label: "Profissional" },
];

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [showMyTeams, setShowMyTeams] = useState(false);

  // Create team dialog
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

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async (searchQuery?: string, searchCategory?: string, myTeamsOnly?: boolean) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery || query) params.set("q", searchQuery || query);
      if (searchCategory || category)
        params.set("category", searchCategory || category);

      const useMyTeams = myTeamsOnly !== undefined ? myTeamsOnly : showMyTeams;
      const endpoint = useMyTeams ? "/api/users/me/teams" : "/api/teams";
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) throw new Error();

      const data = await response.json();
      setTeams(data.teams);
    } catch {
      console.error("Error fetching teams");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTeams(query, category);
  };

  const toggleMyTeams = () => {
    const newValue = !showMyTeams;
    setShowMyTeams(newValue);
    fetchTeams(query, category, newValue);
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
      fetchTeams();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar equipe");
    } finally {
      setIsCreating(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Equipes</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Equipe
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar equipes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Teams grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma equipe encontrada. Tente outros filtros ou crie uma nova equipe.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.slug}`}>
              <Card className="hover:bg-muted/50 transition-colors h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 rounded-lg shrink-0">
                      <AvatarImage src={team.logo || undefined} alt={team.name} />
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-lg">
                        {getInitials(team.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{team.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {categoryLabels[team.category] || team.category}
                        </Badge>
                        {team.level && (
                          <Badge variant="outline" className="text-xs">
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
                          {team._count.members} membros
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
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
              <Input
                value={teamForm.location}
                onChange={(e) => setTeamForm({ ...teamForm, location: e.target.value })}
                placeholder="Ex: São Paulo, SP"
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
            <Button onClick={handleCreateTeam} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
