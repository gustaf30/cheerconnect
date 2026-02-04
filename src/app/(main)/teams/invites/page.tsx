"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  X,
  Shield,
  ShieldCheck,
  Loader2,
  Users,
  Briefcase,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface TeamInvite {
  id: string;
  role: string;
  hasPermission: boolean;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  team: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
}

const roleMapping: Record<string, string> = {
  "Atleta": "ATHLETE",
  "Técnico": "COACH",
  "Assistente": "ASSISTANT_COACH",
  "Coreógrafo": "CHOREOGRAPHER",
  "Diretor": "TEAM_MANAGER",
  "Presidente": "TEAM_MANAGER",
  "Marketing": "OTHER",
  "Outro": "OTHER",
  "": "ATHLETE",
};

export default function TeamInvitesPage() {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Accept dialog state
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<TeamInvite | null>(null);
  const [addToCareer, setAddToCareer] = useState(true);
  const [careerRole, setCareerRole] = useState("ATHLETE");
  const [isAccepting, setIsAccepting] = useState(false);

  const fetchInvites = useCallback(async () => {
    try {
      const response = await fetch("/api/teams/invites");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setInvites(data.invites);
    } catch {
      toast.error("Erro ao carregar convites");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const openAcceptDialog = (invite: TeamInvite) => {
    setSelectedInvite(invite);
    // Map the invite role to a career role
    const mappedRole = roleMapping[invite.role] || "ATHLETE";
    setCareerRole(mappedRole);
    setAddToCareer(true);
    setAcceptDialogOpen(true);
  };

  const handleAccept = async () => {
    if (!selectedInvite) return;

    setIsAccepting(true);
    try {
      // Accept the invite
      const acceptResponse = await fetch(`/api/teams/invites/${selectedInvite.id}/accept`, {
        method: "POST",
      });

      if (!acceptResponse.ok) {
        const error = await acceptResponse.json();
        throw new Error(error.error || "Erro ao aceitar convite");
      }

      // If user wants to add to career, create career entry
      if (addToCareer) {
        const careerResponse = await fetch("/api/career", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: careerRole,
            positions: [],
            startDate: new Date().toISOString(),
            endDate: null,
            isCurrent: true,
            teamName: selectedInvite.team.name,
            teamId: selectedInvite.team.id,
            description: null,
            location: null,
          }),
        });

        if (!careerResponse.ok) {
          // Don't fail the whole operation, just notify
          toast.error("Convite aceito, mas houve erro ao adicionar ao currículo");
        } else {
          toast.success(`Você entrou em ${selectedInvite.team.name} e a equipe foi adicionada ao seu currículo!`);
        }
      } else {
        toast.success(`Você entrou em ${selectedInvite.team.name}!`);
      }

      setInvites(invites.filter((i) => i.id !== selectedInvite.id));
      setAcceptDialogOpen(false);
      setSelectedInvite(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao aceitar convite");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async (inviteId: string) => {
    setProcessingId(inviteId);
    try {
      const response = await fetch(`/api/teams/invites/${inviteId}/reject`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao recusar convite");
      }

      setInvites(invites.filter((i) => i.id !== inviteId));
      toast.success("Convite recusado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao recusar convite");
    } finally {
      setProcessingId(null);
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
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Convites de Equipe</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie seus convites pendentes
          </p>
        </div>
      </div>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Nenhum convite pendente
            </h3>
            <p className="text-muted-foreground mb-4">
              Quando você receber convites de equipes, eles aparecerão aqui.
            </p>
            <Link href="/teams">
              <Button variant="outline">Explorar equipes</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => (
            <Card key={invite.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Link href={`/teams/${invite.team.slug}`}>
                    <Avatar className="h-14 w-14 rounded-xl">
                      <AvatarImage
                        src={invite.team.logo || undefined}
                        alt={invite.team.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-xl bg-primary text-primary-foreground text-lg">
                        {getInitials(invite.team.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/teams/${invite.team.slug}`}
                      className="font-semibold hover:underline"
                    >
                      {invite.team.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {invite.role && (
                        <Badge variant="secondary">{invite.role}</Badge>
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
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recebido em{" "}
                      {format(new Date(invite.createdAt), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(invite.id)}
                      disabled={processingId === invite.id}
                    >
                      {processingId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      Recusar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openAcceptDialog(invite)}
                      disabled={processingId === invite.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aceitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Accept Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Aceitar convite
            </DialogTitle>
            <DialogDescription>
              Você está entrando em {selectedInvite?.team.name}. Deseja adicionar
              esta equipe ao seu currículo?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 rounded-xl">
                <AvatarImage
                  src={selectedInvite?.team.logo || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-xl bg-primary text-primary-foreground">
                  {selectedInvite?.team.name
                    ? getInitials(selectedInvite.team.name)
                    : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedInvite?.team.name}</p>
                {selectedInvite?.role && (
                  <p className="text-sm text-muted-foreground">
                    Função: {selectedInvite.role}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Adicionar ao currículo</p>
                  <p className="text-sm text-muted-foreground">
                    A equipe aparecerá no seu histórico de carreira
                  </p>
                </div>
                <Button
                  variant={addToCareer ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAddToCareer(!addToCareer)}
                >
                  {addToCareer ? "Sim" : "Não"}
                </Button>
              </div>

              {addToCareer && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tipo de função no currículo
                  </label>
                  <Select value={careerRole} onValueChange={setCareerRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATHLETE">Atleta</SelectItem>
                      <SelectItem value="COACH">Técnico(a)</SelectItem>
                      <SelectItem value="ASSISTANT_COACH">
                        Técnico(a) Assistente
                      </SelectItem>
                      <SelectItem value="CHOREOGRAPHER">
                        Coreógrafo(a)
                      </SelectItem>
                      <SelectItem value="TEAM_MANAGER">Diretor(a)</SelectItem>
                      <SelectItem value="JUDGE">Juiz(a)</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptDialogOpen(false)}
              disabled={isAccepting}
            >
              Cancelar
            </Button>
            <Button onClick={handleAccept} disabled={isAccepting}>
              {isAccepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
