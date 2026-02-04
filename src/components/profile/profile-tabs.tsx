"use client";

import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Briefcase, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "@/components/feed/post-card";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  category: string | null;
}

interface CareerEntry {
  id: string;
  role: string;
  positions: string[];
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  teamName: string;
  description: string | null;
  location: string | null;
  team: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
}

interface PostTeam {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

interface PostAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
}

interface Post {
  id: string;
  content: string;
  images: string[];
  videoUrl?: string | null;
  createdAt: Date;
  author: PostAuthor;
  team?: PostTeam | null;
  originalPostId?: string | null;
  originalPost?: {
    id: string;
    content: string;
    images: string[];
    videoUrl?: string | null;
    createdAt: Date;
    author: PostAuthor;
    team?: PostTeam | null;
    _count: {
      likes: number;
      comments: number;
      reposts?: number;
    };
    isLiked: boolean;
  } | null;
  _count: {
    likes: number;
    comments: number;
    reposts?: number;
  };
  isLiked: boolean;
}

interface ProfileTabsProps {
  user: {
    id: string;
    bio: string | null;
    skills: string[];
    achievements: Achievement[];
    careerHistory: CareerEntry[];
  };
  posts: Post[];
  isOwnProfile: boolean;
}

const roleLabels: Record<string, string> = {
  ATHLETE: "Atleta",
  COACH: "Técnico",
  ASSISTANT_COACH: "Técnico Assistente",
  CHOREOGRAPHER: "Coreógrafo",
  TEAM_MANAGER: "Coordenador",
  JUDGE: "Juiz",
  OTHER: "Outro",
};

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

export function ProfileTabs({ user, posts, isOwnProfile }: ProfileTabsProps) {
  return (
    <Tabs defaultValue="posts" className="w-full">
      <TabsList className="w-full justify-start bg-card border rounded-lg p-1 h-auto flex-wrap">
        <TabsTrigger value="posts" className="flex-1 sm:flex-none">
          Publicações
        </TabsTrigger>
        <TabsTrigger value="about" className="flex-1 sm:flex-none">
          Sobre
        </TabsTrigger>
        <TabsTrigger value="career" className="flex-1 sm:flex-none">
          Carreira
        </TabsTrigger>
        <TabsTrigger value="achievements" className="flex-1 sm:flex-none">
          Conquistas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="mt-4 space-y-4">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {isOwnProfile
                ? "Você ainda não fez nenhuma publicação."
                : "Nenhuma publicação ainda."}
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                ...post,
                createdAt: post.createdAt.toISOString(),
                originalPost: post.originalPost
                  ? {
                      ...post.originalPost,
                      createdAt: post.originalPost.createdAt.toISOString(),
                    }
                  : null,
              }}
            />
          ))
        )}
      </TabsContent>

      <TabsContent value="about" className="mt-4">
        <Card>
          <CardContent className="p-6 space-y-6">
            {user.bio && (
              <div>
                <h3 className="font-semibold mb-2">Sobre</h3>
                <p className="text-muted-foreground">{user.bio}</p>
              </div>
            )}

            {user.skills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Habilidades</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!user.bio && user.skills.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                {isOwnProfile
                  ? "Adicione informações sobre você no seu perfil."
                  : "Nenhuma informação adicional."}
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="career" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Histórico de Carreira
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.careerHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {isOwnProfile
                  ? "Adicione sua experiência em equipes."
                  : "Nenhuma experiência cadastrada."}
              </p>
            ) : (
              <div className="space-y-6">
                {user.careerHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="relative pl-6 pb-6 last:pb-0 border-l-2 border-muted last:border-transparent"
                  >
                    <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-primary" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {roleLabels[entry.role] || entry.role}
                        </span>
                        {entry.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Atual
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{entry.teamName}</span>
                        {entry.location && <span>• {entry.location}</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(entry.startDate), "MMM yyyy", {
                          locale: ptBR,
                        })}{" "}
                        -{" "}
                        {entry.endDate
                          ? format(new Date(entry.endDate), "MMM yyyy", {
                              locale: ptBR,
                            })
                          : "Presente"}
                      </div>
                      {entry.positions.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {entry.positions.map((pos) => (
                            <Badge key={pos} variant="secondary" className="text-xs">
                              {positionLabels[pos] || pos}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {entry.description && (
                        <p className="text-sm mt-2">{entry.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="achievements" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.achievements.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {isOwnProfile
                  ? "Adicione suas conquistas e certificações."
                  : "Nenhuma conquista cadastrada."}
              </p>
            ) : (
              <div className="space-y-4">
                {user.achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex gap-4 p-4 rounded-lg bg-muted/50"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{achievement.title}</h4>
                      {achievement.description && (
                        <p className="text-sm text-muted-foreground">
                          {achievement.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>
                          {format(new Date(achievement.date), "MMMM yyyy", {
                            locale: ptBR,
                          })}
                        </span>
                        {achievement.category && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {achievement.category}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
