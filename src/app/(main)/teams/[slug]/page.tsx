import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Globe, Instagram, Calendar, Users, Settings, Trophy, UserPlus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/feed/post-card";
import { FollowButton } from "@/components/teams/follow-button";

interface TeamPageProps {
  params: Promise<{ slug: string }>;
}

const categoryLabels: Record<string, string> = {
  ALLSTAR: "All Star",
  SCHOOL: "Escolar",
  COLLEGE: "Universitário",
  RECREATIONAL: "Recreativo",
  PROFESSIONAL: "Profissional",
};

const roleLabels: Record<string, string> = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  COACH: "Técnico",
  ATHLETE: "Atleta",
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

const eventTypeLabels: Record<string, string> = {
  COMPETITION: "Competição",
  TRYOUT: "Tryout",
  CAMP: "Camp",
  WORKSHOP: "Workshop",
  SHOWCASE: "Showcase",
  OTHER: "Outro",
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      members: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              positions: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
      achievements: {
        orderBy: { date: "desc" },
        take: 10,
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              positions: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: session?.user?.id
            ? {
                where: { userId: session.user.id },
                select: { id: true },
              }
            : false,
        },
      },
      events: {
        where: {
          startDate: { gte: new Date() },
        },
        orderBy: { startDate: "asc" },
        take: 5,
      },
      _count: {
        select: {
          members: { where: { isActive: true } },
          followers: true,
          posts: true,
        },
      },
    },
  });

  // Check if current user is admin/owner
  const currentUserMember = session?.user?.id
    ? team?.members.find((m) => m.user.id === session.user.id)
    : null;
  const isAdmin = currentUserMember?.role === "OWNER" || currentUserMember?.role === "ADMIN";
  const isMember = !!currentUserMember;

  if (!team) {
    notFound();
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const posts = team.posts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
    isLiked: Array.isArray(post.likes) && post.likes.length > 0,
    likes: undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Team header */}
      <Card>
        <div className="h-32 sm:h-48 bg-gradient-to-r from-primary/30 to-primary/10 relative rounded-t-xl">
          {team.banner && (
            <img
              src={team.banner}
              alt=""
              className="w-full h-full object-cover rounded-t-xl"
            />
          )}
        </div>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-16">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 rounded-xl border-4 border-background">
              <AvatarImage src={team.logo || undefined} alt={team.name} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-primary text-primary-foreground text-2xl sm:text-4xl">
                {getInitials(team.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2 sm:mt-16">
              {isAdmin && (
                <Link href={`/teams/${team.slug}/edit`}>
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Gerenciar
                  </Button>
                </Link>
              )}
              <FollowButton teamSlug={team.slug} isMember={isMember} />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {categoryLabels[team.category] || team.category}
                </Badge>
                {team.level && <Badge variant="outline">{team.level}</Badge>}
              </div>
            </div>

            {team.description && (
              <p className="text-muted-foreground">{team.description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {team.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {team.location}
                </span>
              )}
              {team.foundedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Fundada em{" "}
                  {format(new Date(team.foundedAt), "yyyy", { locale: ptBR })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {team._count.members} membros
              </span>
              <span className="flex items-center gap-1">
                <UserPlus className="h-4 w-4" />
                {team._count.followers} seguidores
              </span>
            </div>

            {(team.website || team.instagram) && (
              <div className="flex gap-4">
                {team.website && (
                  <a
                    href={team.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
                {team.instagram && (
                  <a
                    href={`https://instagram.com/${team.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Instagram className="h-4 w-4" />@{team.instagram}
                  </a>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Publicações</TabsTrigger>
          <TabsTrigger value="members">Membros ({team._count.members})</TabsTrigger>
          <TabsTrigger value="achievements">Conquistas</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4 space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma publicação ainda.
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {team.members.map((member) => (
                  <Link
                    key={member.id}
                    href={`/profile/${member.user.username}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={member.user.avatar || undefined}
                          alt={member.user.name}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          @{member.user.username}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {roleLabels[member.role] || member.role}
                      </Badge>
                      {member.position && (
                        <Badge variant="secondary">{member.position}</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {team.achievements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma conquista registrada.
                </p>
              ) : (
                <div className="space-y-4">
                  {team.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                    >
                      <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {team.events.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum evento próximo.
                </p>
              ) : (
                <div className="space-y-4">
                  {team.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                    >
                      <div className="shrink-0 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {format(new Date(event.startDate), "dd")}
                        </div>
                        <div className="text-sm text-muted-foreground uppercase">
                          {format(new Date(event.startDate), "MMM", {
                            locale: ptBR,
                          })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{event.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {eventTypeLabels[event.type] || event.type}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {event.location}
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
    </div>
  );
}
