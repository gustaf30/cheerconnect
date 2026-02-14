import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://cheerconnect.com");

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Dynamic team routes
  let teamRoutes: MetadataRoute.Sitemap = [];
  try {
    const teams = await prisma.team.findMany({
      select: { slug: true, updatedAt: true },
    });
    teamRoutes = teams.map((team) => ({
      url: `${baseUrl}/teams/${team.slug}`,
      lastModified: team.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB unavailable during build — skip dynamic routes
  }

  // Dynamic public profile routes
  let profileRoutes: MetadataRoute.Sitemap = [];
  try {
    const users = await prisma.user.findMany({
      where: { profileVisibility: "PUBLIC" },
      select: { username: true, updatedAt: true },
    });
    profileRoutes = users
      .filter((u) => u.username)
      .map((user) => ({
        url: `${baseUrl}/profile/${user.username}`,
        lastModified: user.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
  } catch {
    // DB unavailable during build — skip dynamic routes
  }

  return [...staticRoutes, ...teamRoutes, ...profileRoutes];
}
