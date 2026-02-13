"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Briefcase, Trash2, Pencil } from "lucide-react";
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
import { CitySelector } from "@/components/ui/city-selector";
import { careerRoleOptions, positionOptions } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface CareerEntry {
  id: string;
  role: string;
  positions: string[];
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  teamName: string;
  description: string | null;
  location: string | null;
}

interface CareerSectionProps {
  careerHistory: CareerEntry[];
  fetchCareerHistory: () => void;
}

export function CareerSection({ careerHistory, fetchCareerHistory }: CareerSectionProps) {
  const [careerDialogOpen, setCareerDialogOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<CareerEntry | null>(null);
  const [careerForm, setCareerForm] = useState({
    role: "ATHLETE",
    positions: [] as string[],
    startDate: "",
    endDate: "",
    isCurrent: false,
    teamName: "",
    description: "",
    location: "",
  });
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const [deleteCareerTargetId, setDeleteCareerTargetId] = useState<string | null>(null);

  const openCareerDialog = (career?: CareerEntry) => {
    if (career) {
      setEditingCareer(career);
      setCareerForm({
        role: career.role,
        positions: career.positions,
        startDate: career.startDate.split("T")[0],
        endDate: career.endDate?.split("T")[0] || "",
        isCurrent: career.isCurrent,
        teamName: career.teamName,
        description: career.description || "",
        location: career.location || "",
      });
    } else {
      setEditingCareer(null);
      setCareerForm({
        role: "ATHLETE",
        positions: [],
        startDate: "",
        endDate: "",
        isCurrent: false,
        teamName: "",
        description: "",
        location: "",
      });
    }
    setCareerDialogOpen(true);
  };

  const saveCareer = async () => {
    if (!careerForm.teamName || !careerForm.startDate) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSavingCareer(true);
    try {
      const payload = {
        ...careerForm,
        endDate: careerForm.isCurrent ? null : careerForm.endDate || null,
      };

      const url = editingCareer ? `/api/career/${editingCareer.id}` : "/api/career";
      const method = editingCareer ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error();

      toast.success(editingCareer ? "Experiência atualizada!" : "Experiência adicionada!");
      setCareerDialogOpen(false);
      fetchCareerHistory();
    } catch {
      toast.error("Erro ao salvar experiência");
    } finally {
      setIsSavingCareer(false);
    }
  };

  const deleteCareer = async () => {
    if (!deleteCareerTargetId) return;
    try {
      const response = await fetch(`/api/career/${deleteCareerTargetId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();

      toast.success("Experiência removida!");
      setDeleteCareerTargetId(null);
      fetchCareerHistory();
    } catch {
      toast.error("Erro ao remover experiência");
    }
  };

  const toggleCareerPosition = (position: string) => {
    if (careerForm.positions.includes(position)) {
      setCareerForm({
        ...careerForm,
        positions: careerForm.positions.filter((p) => p !== position),
      });
    } else {
      setCareerForm({
        ...careerForm,
        positions: [...careerForm.positions, position],
      });
    }
  };

  return (
    <>
      <div className="bento-card-static">
        <div className="p-6 pb-2 flex flex-row items-center justify-between">
          <h2 className="heading-card font-display flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Currículo
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={() => openCareerDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
        <div className="p-6 pt-0">
          {careerHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adicione seu histórico em equipes de cheerleading.
            </p>
          ) : (
            <div className="space-y-4">
              {careerHistory.map((career) => (
                <div key={career.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{career.teamName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {careerRoleOptions.find((r) => r.value === career.role)?.label || career.role}
                      </Badge>
                      {career.isCurrent && (
                        <Badge variant="default" className="text-xs">Atual</Badge>
                      )}
                    </div>
                    {career.positions.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {career.positions
                          .map((p) => positionOptions.find((opt) => opt.value === p)?.label || p)
                          .join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      <time dateTime={new Date(career.startDate).toISOString()}>
                        {format(new Date(career.startDate), "MMM yyyy", { locale: ptBR })}
                      </time>
                      {" - "}
                      {career.isCurrent
                        ? "Presente"
                        : career.endDate
                        ? <time dateTime={new Date(career.endDate).toISOString()}>
                            {format(new Date(career.endDate), "MMM yyyy", { locale: ptBR })}
                          </time>
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openCareerDialog(career)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteCareerTargetId(career.id)}
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

      {/* Dialog de Currículo */}
      <Dialog open={careerDialogOpen} onOpenChange={setCareerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCareer ? "Editar Experiência" : "Adicionar Experiência"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Time *</label>
              <Input
                value={careerForm.teamName}
                onChange={(e) => setCareerForm({ ...careerForm, teamName: e.target.value })}
                placeholder="Ex: Sharks Allstars"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Função *</label>
              <Select
                value={careerForm.role}
                onValueChange={(value) => setCareerForm({ ...careerForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {careerRoleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Posições</label>
              <div className="flex flex-wrap gap-2">
                {positionOptions.map((pos) => (
                  <Badge
                    key={pos.value}
                    variant={careerForm.positions.includes(pos.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCareerPosition(pos.value)}
                  >
                    {pos.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Início *</label>
                <Input
                  type="date"
                  value={careerForm.startDate}
                  onChange={(e) => setCareerForm({ ...careerForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data de Término</label>
                <Input
                  type="date"
                  value={careerForm.endDate}
                  onChange={(e) => setCareerForm({ ...careerForm, endDate: e.target.value })}
                  disabled={careerForm.isCurrent}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrent"
                checked={careerForm.isCurrent}
                onChange={(e) =>
                  setCareerForm({ ...careerForm, isCurrent: e.target.checked, endDate: "" })
                }
                className="h-4 w-4"
              />
              <label htmlFor="isCurrent" className="text-sm">
                Atualmente neste time
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Localização</label>
              <CitySelector
                value={careerForm.location}
                onChange={(value) => setCareerForm({ ...careerForm, location: value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={careerForm.description}
                onChange={(e) => setCareerForm({ ...careerForm, description: e.target.value })}
                placeholder="Conquistas, responsabilidades..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCareerDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCareer} disabled={isSavingCareer}>
              {isSavingCareer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteCareerTargetId}
        onOpenChange={(open) => !open && setDeleteCareerTargetId(null)}
        title="Remover esta experiência?"
        confirmLabel="Remover"
        onConfirm={deleteCareer}
      />
    </>
  );
}
