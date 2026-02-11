"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Trophy, Trash2, Pencil, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: string;
  category: string | null;
}

const categoryOptions = [
  { value: "COMPETITION", label: "Competição" },
  { value: "CERTIFICATION", label: "Certificação" },
  { value: "AWARD", label: "Prêmio" },
  { value: "OTHER", label: "Outro" },
];

interface AchievementSectionProps {
  achievements: Achievement[];
  fetchAchievements: () => void;
}

export function AchievementSection({ achievements, fetchAchievements }: AchievementSectionProps) {
  const [achievementDialogOpen, setAchievementDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    description: "",
    date: "",
    category: "",
  });
  const [isSavingAchievement, setIsSavingAchievement] = useState(false);
  const [deleteAchievementTargetId, setDeleteAchievementTargetId] = useState<string | null>(null);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePostContent, setSharePostContent] = useState("");
  const [isSharing, setIsSharing] = useState(false);

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

  const deleteAchievement = async () => {
    if (!deleteAchievementTargetId) return;
    try {
      const response = await fetch(`/api/achievements/${deleteAchievementTargetId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();

      toast.success("Conquista removida!");
      setDeleteAchievementTargetId(null);
      fetchAchievements();
    } catch {
      toast.error("Erro ao remover conquista");
    }
  };

  return (
    <>
      <div className="bento-card-static">
        <div className="p-6 pb-2 flex flex-row items-center justify-between">
          <h2 className="heading-card font-display flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Conquistas
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={() => openAchievementDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
        <div className="p-6 pt-0">
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
                      onClick={() => setDeleteAchievementTargetId(achievement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Conquista */}
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

      <ConfirmDialog
        open={!!deleteAchievementTargetId}
        onOpenChange={(open) => !open && setDeleteAchievementTargetId(null)}
        title="Remover esta conquista?"
        confirmLabel="Remover"
        onConfirm={deleteAchievement}
      />
    </>
  );
}
