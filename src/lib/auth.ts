import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import logger from "./logger";
import { logSecurityEvent } from "./security-events";

const TOKEN_VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      profile(profile) {
        const emailPart = (profile.email || "user").split("@")[0];
        const base = emailPart.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 20) || "user";
        const suffix = profile.sub ? `_${profile.sub.slice(-6).replace(/[^a-z0-9]/gi, "")}` : "";
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          username: `${base}${suffix}`.slice(0, 30),
        };
      },
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
          logSecurityEvent("auth.login_failed", { reason: "invalid_credentials" });
          throw new Error("Usuário não encontrado");
        }

        if (!user.emailVerified) {
          logSecurityEvent("auth.email_unverified", { userId: user.id });
          throw new Error("Verifique seu email antes de fazer login");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          logSecurityEvent("auth.login_failed", { userId: user.id, reason: "invalid_password" });
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
    maxAge: 30 * 24 * 60 * 60,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  // Não usar bloco cookies customizado - defaults do NextAuth são otimizados
  callbacks: {
    async signIn({ user, account, profile }) {
      const providerVerified = Boolean(
        profile &&
          typeof profile === "object" &&
          "email_verified" in profile &&
          (profile.email_verified === true || profile.email_verified === "true")
      );

      if (!user.id) {
        return account?.provider === "google" && providerVerified;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { emailVerified: true },
      });

      if (!dbUser) {
        return account?.provider === "google" && providerVerified;
      }

      if (account?.provider === "google" && providerVerified && !dbUser.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
        return true;
      }

      return Boolean(dbUser.emailVerified);
    },
    async redirect({ url, baseUrl }) {
      // Permite URLs relativas
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Permite URLs de mesma origem
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user }) {
      // Armazenar APENAS o ID no token - mantém JWT pequeno
      // Buscar resto dos dados do banco quando precisar
      if (user) {
        token.id = user.id;
        // Busca tokenVersion no login inicial
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
             select: { tokenVersion: true, isAdmin: true },
           });
           token.tokenVersion = dbUser?.tokenVersion ?? 0;
           token.isAdmin = dbUser?.isAdmin ?? false;

        } catch {
          token.tokenVersion = 0;
        }
        token.tokenVersionCheckedAt = Date.now();
      } else {
        // Re-checagem periódica de tokenVersion
        const checkedAt = (token.tokenVersionCheckedAt as number) ?? 0;
        if (Date.now() - checkedAt > TOKEN_VERSION_CHECK_INTERVAL) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { tokenVersion: true },
            });
            if (!dbUser) {
              return {} as JWT;
            }

            if (dbUser.tokenVersion !== (token.tokenVersion as number)) {
              return {} as JWT;
            }
            token.tokenVersionCheckedAt = Date.now();
          } catch (error) {
            // Em falha do DB, manter token atual para evitar logout em massa
            // Só invalida com query bem-sucedida e tokenVersion diferente (tratado acima)
            logger.warn(
              { err: error },
              "[auth] falha na checagem de tokenVersion, mantendo token atual"
            );
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.tokenVersion = token.tokenVersion as number | undefined;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.id) return;
      const verified = Boolean(
        profile &&
          typeof profile === "object" &&
          "email_verified" in profile &&
          (profile.email_verified === true || profile.email_verified === "true")
      );
      if (verified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
  },
};
