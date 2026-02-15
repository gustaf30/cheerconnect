import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const TOKEN_VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha são obrigatórios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            emailVerified: true,
            tokenVersion: true,
          },
        });

        if (!user || !user.password) {
          throw new Error("Usuário não encontrado");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Senha incorreta");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Avatar NÃO é incluído aqui para evitar JWT gigante (HTTP 431)
          // O avatar será buscado via GET /api/users/me quando necessário
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  // Não usar bloco cookies customizado - defaults do NextAuth são otimizados
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin URLs
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user }) {
      // Armazenar APENAS o ID no token - mantém JWT pequeno
      // Buscar resto dos dados do banco quando precisar
      if (user) {
        token.id = user.id;
        // Fetch tokenVersion on initial login
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { tokenVersion: true },
          });
          token.tokenVersion = dbUser?.tokenVersion ?? 0;
        } catch {
          token.tokenVersion = 0;
        }
        token.tokenVersionCheckedAt = Date.now();
      } else {
        // Periodic re-check of tokenVersion
        const checkedAt = (token.tokenVersionCheckedAt as number) ?? 0;
        if (Date.now() - checkedAt > TOKEN_VERSION_CHECK_INTERVAL) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { tokenVersion: true },
            });
            if (
              dbUser &&
              dbUser.tokenVersion !== (token.tokenVersion as number)
            ) {
              // Token version mismatch — force re-login
              return {} as JWT;
            }
            token.tokenVersionCheckedAt = Date.now();
          } catch (error) {
            // On DB failure, keep existing token to avoid mass-logout
            // Only a successful query with mismatched tokenVersion should invalidate (handled above)
            console.warn(
              "[auth] tokenVersion check failed, keeping current token:",
              error instanceof Error ? error.message : "unknown error"
            );
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
  },
};
