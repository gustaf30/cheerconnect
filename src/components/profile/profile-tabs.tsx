"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Briefcase, Building2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tabContent, noMotion } from "@/lib/animations";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "@/components/feed/post-card";
import { positionLabels, careerRoleLabels } from "@/lib/constants";
import { PostData } from "@/types";
import { AchievementList } from "./achievement-list";

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

interface ProfileTabsProps {
  user: {
    id: string;
    bio: string | null;
    skills: string[];
    achievements: Achievement[];
    careerHistory: CareerEntry[];
  };
  posts: PostData[];
  isOwnProfile: boolean;
  achievementLimit?: number;
}

export function ProfileTabs({ user, posts, isOwnProfile, achievementLimit = 10 }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState("posts");
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? noMotion : tabContent;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <TabsContent value="posts" className="mt-4 space-y-4">
            {posts.length === 0 ? (
              <div className="bento-card-static">
                <div className="p-8 text-center text-muted-foreground">
                  {isOwnProfile
                    ? "Você ainda não fez nenhuma publicação."
                    : "Nenhuma publicação ainda."}
                </div>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    ...post,
                    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
                    originalPost: post.originalPost
                      ? {
                          ...post.originalPost,
                          createdAt: post.originalPost.createdAt instanceof Date ? post.originalPost.createdAt.toISOString() : post.originalPost.createdAt,
                        }
                      : null,
                  }}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-4">
            <div className="bento-card-static">
              <div className="p-6 space-y-6">
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="career" className="mt-4">
            <div className="bento-card-static">
              <div className="p-6 pb-2">
                <h2 className="heading-card font-display text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Histórico de Carreira
                </h2>
              </div>
              <div className="p-6 pt-0">
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
                              {careerRoleLabels[entry.role] || entry.role}
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
                            <time dateTime={new Date(entry.startDate).toISOString()}>
                              {format(new Date(entry.startDate), "MMM yyyy", {
                                locale: ptBR,
                              })}
                            </time>{" "}
                            -{" "}
                            {entry.endDate
                              ? <time dateTime={new Date(entry.endDate).toISOString()}>
                                  {format(new Date(entry.endDate), "MMM yyyy", {
                                    locale: ptBR,
                                  })}
                                </time>
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-4">
            <div className="bento-card-static">
              <div className="p-6 pb-2">
                <h2 className="heading-card font-display text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Conquistas
                </h2>
              </div>
              <div className="p-6 pt-0">
                <AchievementList
                  initialAchievements={user.achievements}
                  initialLimit={achievementLimit}
                  userId={user.id}
                  emptyMessage={
                    isOwnProfile
                      ? "Adicione suas conquistas e certificações."
                      : "Nenhuma conquista cadastrada."
                  }
                />
              </div>
            </div>
          </TabsContent>
        </motion.div>
      </AnimatePresence>
    </Tabs>
  );
}
