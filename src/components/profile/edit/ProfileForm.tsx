"use client";

import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CitySelector } from "@/components/ui/city-selector";

interface ProfileFormData {
  name: string;
  bio?: string;
  location?: string;
  experience?: number | null;
  skills: string[];
  positions: string[];
}

const positionOptions = [
  { value: "FLYER", label: "Flyer" },
  { value: "BASE", label: "Base" },
  { value: "BACKSPOT", label: "Backspot" },
  { value: "FRONTSPOT", label: "Frontspot" },
  { value: "TUMBLER", label: "Tumbler" },
  { value: "COACH", label: "Técnico" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "JUDGE", label: "Juiz" },
  { value: "OTHER", label: "Outro" },
];

interface ProfileFormProps {
  form: UseFormReturn<ProfileFormData>;
}

export function ProfileForm({ form }: ProfileFormProps) {
  const [newSkill, setNewSkill] = useState("");

  const togglePosition = (position: string) => {
    const current = form.getValues("positions");
    if (current.includes(position)) {
      form.setValue("positions", current.filter((p) => p !== position));
    } else {
      form.setValue("positions", [...current, position]);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    const current = form.getValues("skills");
    if (!current.includes(newSkill.trim())) {
      form.setValue("skills", [...current, newSkill.trim()]);
    }
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    const current = form.getValues("skills");
    form.setValue("skills", current.filter((s) => s !== skill));
  };

  return (
    <>
      <div className="bento-card-static">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display">Informações Básicas</h2>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Conte um pouco sobre você..."
                    className="resize-none"
                    rows={4}
                  />
                </FormControl>
                <FormDescription>
                  {field.value?.length || 0}/500 caracteres
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localização</FormLabel>
                <FormControl>
                  <CitySelector
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="experience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anos de experiência</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value) : null)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="bento-card-static">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display">Posições</h2>
        </div>
        <div className="p-6 pt-0">
          <FormField
            control={form.control}
            name="positions"
            render={({ field }) => (
              <FormItem>
                <FormDescription className="mb-3">
                  Selecione todas as posições que você desempenha
                </FormDescription>
                <div className="flex flex-wrap gap-2">
                  {positionOptions.map((pos) => (
                    <Badge
                      key={pos.value}
                      variant={field.value.includes(pos.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => togglePosition(pos.value)}
                    >
                      {pos.label}
                    </Badge>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="bento-card-static">
        <div className="p-6 pb-2">
          <h2 className="heading-card font-display">Habilidades</h2>
        </div>
        <div className="p-6 pt-0">
          <FormField
            control={form.control}
            name="skills"
            render={({ field }) => (
              <FormItem>
                <FormDescription className="mb-3">
                  Adicione suas habilidades (tumbling, stunts, etc.)
                </FormDescription>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Nova habilidade..."
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addSkill())
                    }
                  />
                  <Button type="button" onClick={addSkill}>
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {field.value.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeSkill(skill)}
                    >
                      {skill} ×
                    </Badge>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}
