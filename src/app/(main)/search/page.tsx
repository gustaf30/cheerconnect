"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, MapPin, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CitySelector } from "@/components/ui/city-selector";

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

const positionLabels: Record<string, string> = {
  FLYER: "Flyer",
  BASE: "Base",
  BACKSPOT: "Backspot",
  FRONTSPOT: "Frontspot",
  TUMBLER: "Tumbler",
  COACH: "Técnico",
  CHOREOGRAPHER: "Coreógrafo",
  JUDGE: "Juiz",
  OTHER: "Outro",
};

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
  const urlQuery = searchParams.get("q"); // Extract value to avoid infinite loop

  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [filterByUserLocation, setFilterByUserLocation] = useState(true);
  const [isLoadingUserLocation, setIsLoadingUserLocation] = useState(true);

  const handleSearchWithQuery = useCallback(
    async (
      searchQuery: string,
      searchPosition: string,
      searchLocation: string,
      useUserLocation: boolean,
      currentUserLocation: string | null
    ) => {
      setIsLoading(true);
      setHasSearched(true);

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (searchPosition && searchPosition !== " ")
          params.set("position", searchPosition);

        // Use location filter or user's location
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
        console.error("Search error");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Fetch user location on mount
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
        console.error("Error fetching user location");
      } finally {
        setIsLoadingUserLocation(false);
      }
    };
    fetchUserLocation();
  }, []);

  // Load query from URL on mount (depends only on urlQuery value, not searchParams object)
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
      <h1 className="text-2xl font-bold">Buscar</h1>

      {/* Search form */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nome ou username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
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
        </CardContent>
      </Card>

      {/* Location filter banner */}
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

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hasSearched ? (
        users.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum usuário encontrado. Tente outros termos de busca.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <Link key={user.id} href={`/profile/${user.username}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14 shrink-0">
                        <AvatarImage
                          src={user.avatar || undefined}
                          alt={user.name}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{user.name}</h3>
                          <span className="text-sm text-muted-foreground">
                            @{user.username}
                          </span>
                        </div>
                        {user.positions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.positions.map((pos) => (
                              <Badge
                                key={pos}
                                variant="secondary"
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
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Use a busca acima para encontrar atletas, técnicos e outros membros
            da comunidade.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><h1 className="text-2xl font-bold">Buscar</h1></div>}>
      <SearchContent />
    </Suspense>
  );
}
