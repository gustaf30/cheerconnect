"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Trash2, Trophy, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: string;
  category: string | null;
}

interface AchievementSectionProps {
  slug: string;
  teamName: string;
  achievements: Achievement[];
  setAchievements: (achievements: Achievement[]) => void;
}

export function AchievementSection({
  slug,
  teamName,
  achievements,
  setAchievements,
}: AchievementSectionProps) {
  const [achievementDialogOpen, setAchievementDialogOpen] = useState(false);
  const [isAddingAchievement, setIsAddingAchievement] = useState(false);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    description: "",
    date: "",
    category: "",
  });

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePostContent, setSharePostContent] = useState("");
  const [isSharing, setIsSharing] = useState(false);

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

      const dateFormatted = new Date(achievementForm.date).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      let postContent = `🏆 Nova conquista da ${teamName}!\n\n${achievementForm.title}`;
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

  return (
    <div className="space-y-4">
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

      {/* Dialog de Conquista */}
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

      {/* Dialog de Compartilhar Conquista */}
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
    </div>
  );
}
