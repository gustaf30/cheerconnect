"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, MapPin, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer, fadeSlideUp, noMotion, noMotionContainer, stagger } from "@/lib/animations";
import { CitySelector } from "@/components/ui/city-selector";
import { getInitials } from "@/lib/utils";
import { positionLabels } from "@/lib/constants";
import { ErrorState } from "@/components/shared/error-state";

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  positions: string[];
  experience: number | null;
}

const positions = [
  { value: "FLYER", label: "Flyer" },
  { value: "BASE", label: "Base" },
  { value: "BACKSPOT", label: "Backspot" },
  { value: "FRONTSPOT", label: "Frontspot" },
  { value: "TUMBLER", label: "Tumbler" },
  { value: "COACH", label: "Técnico" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "JUDGE", label: "Juiz" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q"); // Extrair valor para evitar loop infinito

  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [filterByUserLocation, setFilterByUserLocation] = useState(true);
  const [isLoadingUserLocation, setIsLoadingUserLocation] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  const handleSearchWithQuery = useCallback(
    async (
      searchQuery: string,
      searchPosition: string,
      searchLocation: string,
      useUserLocation: boolean,
      currentUserLocation: string | null
    ) => {
      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (searchPosition && searchPosition !== " ")
          params.set("position", searchPosition);

        // Usar filtro de localização ou localização do usuário
        if (searchLocation) {
          params.set("location", searchLocation);
        } else if (useUserLocation && currentUserLocation) {
          params.set("location", currentUserLocation);
        }

        const response = await fetch(`/api/users?${params.toString()}`);
        if (!response.ok) throw new Error();

        const data = await response.json();
        setUsers(data.users);
      } catch {
        setError("Erro ao buscar. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Buscar localização do usuário ao montar
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
        console.error("Erro ao buscar localização do usuário");
      } finally {
        setIsLoadingUserLocation(false);
      }
    };
    fetchUserLocation();
  }, []);

  // Carregar busca da URL ao montar (depende apenas do valor urlQuery, não do objeto searchParams)
  useEffect(() => {
    if (urlQuery) {
      setQuery(urlQuery);
      handleSearchWithQuery(urlQuery, "", "", filterByUserLocation, userLocation);
    }
  }, [urlQuery, handleSearchWithQuery, filterByUserLocation, userLocation]);

  const handleSearch = () => {
    handleSearchWithQuery(
      query,
      position,
      locationFilter,
      filterByUserLocation,
      userLocation
    );
  };

  const clearLocationFilter = () => {
    setFilterByUserLocation(false);
    setLocationFilter("");
    handleSearchWithQuery(query, position, "", false, null);
  };

  return (
    <div className="space-y-6">
      <h1 className="heading-section font-display">Buscar</h1>

      {/* Formulário de busca */}
      <div className="bento-card-static p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nome ou username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 input-premium"
              />
            </div>
            <div className="w-full sm:w-auto">
              <CitySelector
                value={locationFilter}
                onChange={setLocationFilter}
                placeholder="Filtrar por local"
              />
            </div>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Posição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todas as posições</SelectItem>
                {positions.map((pos) => (
                  <SelectItem key={pos.value} value={pos.value}>
                    {pos.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={isLoading}>
              <SearchIcon className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
      </div>

      {/* Banner de filtro por localização */}
      {!isLoadingUserLocation &&
        filterByUserLocation &&
        userLocation &&
        !locationFilter && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
            <MapPin className="h-4 w-4" />
            <span>
              Mostrando pessoas em <strong>{userLocation}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-auto py-1 px-2"
              onClick={clearLocationFilter}
            >
              <X className="h-3 w-3 mr-1" />
              Ver todos
            </Button>
          </div>
        )}

      {/* Resultados */}
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); handleSearch(); }} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bento-card-static p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : hasSearched ? (
        users.length === 0 ? (
          <div className="bento-card-static p-8 text-center text-muted-foreground">
            Nenhum usuário encontrado. Tente outros termos de busca.
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={shouldReduceMotion ? noMotionContainer : staggerContainer(0.06)}
            initial="hidden"
            animate="visible"
          >
            {users.map((user) => (
              <motion.div key={user.id} variants={shouldReduceMotion ? noMotion : fadeSlideUp}>
              <Link href={`/profile/${user.username}`}>
                <div className="bento-card">
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14 shrink-0 avatar-glow">
                        <AvatarImage
                          src={user.avatar || undefined}
                          alt={user.name}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground font-display font-semibold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-semibold">{user.name}</h3>
                          <span className="text-sm text-muted-foreground font-mono">
                            @{user.username}
                          </span>
                        </div>
                        {user.positions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.positions.map((pos) => (
                              <Badge
                                key={pos}
                                variant="gradient"
                                className="text-xs"
                              >
                                {positionLabels[pos] || pos}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {user.bio && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {user.bio}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {user.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {user.location}
                            </span>
                          )}
                          {user.experience && (
                            <span>
                              {user.experience}{" "}
                              {user.experience === 1 ? "ano" : "anos"} de
                              experiência
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              </motion.div>
            ))}
          </motion.div>
        )
      ) : (
        <div className="bento-card-static p-8 text-center text-muted-foreground">
          Use a busca acima para encontrar atletas, técnicos e outros membros
          da comunidade.
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><h2 className="text-2xl font-bold">Buscar</h2></div>}>
      <SearchContent />
    </Suspense>
  );
}
