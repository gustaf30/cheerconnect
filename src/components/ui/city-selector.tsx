"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CitySelectorProps {
  value?: string; // "Cidade, UF"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

interface City {
  id: number;
  nome: string;
}

const BRAZILIAN_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

export function CitySelector({
  value,
  onChange,
  placeholder = "Selecione a localização",
  disabled = false,
}: CitySelectorProps) {
  const [selectedUF, setSelectedUF] = React.useState<string>("");
  const [selectedCity, setSelectedCity] = React.useState<string>("");
  const [cities, setCities] = React.useState<City[]>([]);
  const [loadingCities, setLoadingCities] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Parse existing value on mount/change
  React.useEffect(() => {
    if (value) {
      const match = value.match(/^(.+),\s*([A-Z]{2})$/);
      if (match) {
        const [, city, uf] = match;
        setSelectedCity(city);
        if (uf !== selectedUF) {
          setSelectedUF(uf);
        }
      }
    } else {
      setSelectedCity("");
      setSelectedUF("");
    }
  }, [value, selectedUF]);

  // Fetch cities when state changes
  React.useEffect(() => {
    if (!selectedUF) {
      setCities([]);
      return;
    }

    const fetchCities = async () => {
      setLoadingCities(true);
      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUF}/municipios?orderBy=nome`
        );
        if (response.ok) {
          const data: City[] = await response.json();
          setCities(data);
        }
      } catch (error) {
        console.error("Error fetching cities:", error);
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    };

    fetchCities();
  }, [selectedUF]);

  const handleStateChange = (uf: string) => {
    setSelectedUF(uf);
    setSelectedCity("");
    // Don't call onChange yet - wait for city selection
  };

  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    setOpen(false);
    onChange(`${cityName}, ${selectedUF}`);
  };

  return (
    <div className="flex gap-2">
      {/* State selector */}
      <Select
        value={selectedUF}
        onValueChange={handleStateChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent className="!z-[100]">
          {BRAZILIAN_STATES.map((state) => (
            <SelectItem key={state.uf} value={state.uf}>
              {state.uf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* City combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
            disabled={disabled || !selectedUF}
          >
            {selectedCity || placeholder}
            {loadingCities ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 !z-[100]" align="start">
          <Command>
            <CommandInput placeholder="Buscar cidade..." />
            <CommandList>
              <CommandEmpty>
                {loadingCities ? "Carregando..." : "Nenhuma cidade encontrada."}
              </CommandEmpty>
              <CommandGroup>
                {cities.map((city) => (
                  <CommandItem
                    key={city.id}
                    value={city.nome}
                    onSelect={handleCitySelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCity === city.nome ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {city.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
