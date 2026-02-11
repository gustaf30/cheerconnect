"use client";

import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { CitySelector } from "@/components/ui/city-selector";
import { getInitials } from "@/lib/utils";

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

interface FormData {
  name: string;
  description: string;
  location: string;
  category: string;
  level: string;
  website: string;
  instagram: string;
}

const categories = [
  { value: "ALLSTAR", label: "All Star" },
  { value: "SCHOOL", label: "Escolar" },
  { value: "COLLEGE", label: "Universitário" },
  { value: "RECREATIONAL", label: "Recreativo" },
  { value: "PROFESSIONAL", label: "Profissional" },
];

interface TeamInfoFormProps {
  team: Team;
  formData: FormData;
  setFormData: (data: FormData) => void;
  isSaving: boolean;
  onSave: () => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TeamInfoForm({
  team,
  formData,
  setFormData,
  isSaving,
  onSave,
  onLogoUpload,
}: TeamInfoFormProps) {
  return (
    <div className="space-y-6">
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
                  onChange={onLogoUpload}
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

          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
