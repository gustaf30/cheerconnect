import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true, bio: true },
  });
  if (!user) return { title: "Perfil | CheerConnect" };
  return {
    title: `${user.name} | CheerConnect`,
    description: user.bio
      ? user.bio.length > 160 ? user.bio.slice(0, 160) + "..." : user.bio
      : `Perfil de ${user.name} na comunidade de cheerleading CheerConnect.`,
  };
}

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const session = await getServerSession(authOptions);

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      achievements: {
        orderBy: { date: "desc" },
        take: 10,
      },
      careerHistory: {
        orderBy: { startDate: "desc" },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
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
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
          originalPost: {
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
              team: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logo: true,
                },
              },
              _count: {
                select: {
                  likes: true,
                  comments: true,
                  reposts: true,
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
          _count: {
            select: {
              likes: true,
              comments: true,
              reposts: true,
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
      _count: {
        select: {
          posts: true,
          sentConnections: {
            where: { status: "ACCEPTED" },
          },
          receivedConnections: {
            where: { status: "ACCEPTED" },
          },
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const isOwnProfile = session?.user?.id === user.id;

  // Verificar status da conexão
  let connectionStatus: "none" | "pending" | "connected" | "received" = "none";
  if (session?.user?.id && !isOwnProfile) {
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: user.id },
          { senderId: user.id, receiverId: session.user.id },
        ],
      },
    });

    if (connection) {
      if (connection.status === "ACCEPTED") {
        connectionStatus = "connected";
      } else if (connection.status === "PENDING") {
        connectionStatus =
          connection.senderId === session.user.id ? "pending" : "received";
      }
    }
  }

  const connectionsCount =
    user._count.sentConnections + user._count.receivedConnections;

  // Enforce profile visibility for non-connected users
  if (
    user.profileVisibility === "CONNECTIONS_ONLY" &&
    !isOwnProfile &&
    connectionStatus !== "connected"
  ) {
    return (
      <div className="space-y-6">
        <ProfileHeader
          user={{
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            banner: user.banner,
            bio: null,
            location: null,
            positions: user.positions,
            experience: null,
            skills: [],
          }}
          isOwnProfile={false}
          connectionStatus={connectionStatus}
          connectionsCount={connectionsCount}
          postsCount={user._count.posts}
        />
        <div className="bento-card-static p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <h2 className="heading-card">Perfil privado</h2>
            <p className="text-muted-foreground font-body">
              Conecte-se com {user.name} para ver o perfil completo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const posts = user.posts.map((post) => ({
    ...post,
    isLiked: Array.isArray(post.likes) && post.likes.length > 0,
    likes: undefined,
    originalPost: post.originalPost
      ? {
          ...post.originalPost,
          isLiked:
            Array.isArray(post.originalPost.likes) &&
            post.originalPost.likes.length > 0,
          likes: undefined,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <ProfileHeader
        user={{
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          banner: user.banner,
          bio: user.bio,
          location: user.location,
          positions: user.positions,
          experience: user.experience,
          skills: user.skills,
        }}
        isOwnProfile={isOwnProfile}
        connectionStatus={connectionStatus}
        connectionsCount={connectionsCount}
        postsCount={user._count.posts}
      />
      <ProfileTabs
        user={{
          id: user.id,
          bio: user.bio,
          skills: user.skills,
          achievements: user.achievements,
          careerHistory: user.careerHistory,
        }}
        posts={posts}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
}
