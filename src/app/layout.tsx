import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CheerConnect - Rede Social para Cheerleading",
  description:
    "Conecte-se com atletas, técnicos e equipes de cheerleading. Encontre oportunidades, compartilhe conquistas e faça parte da comunidade.",
  keywords: [
    "cheerleading",
    "cheerleader",
    "rede social",
    "atletas",
    "equipes",
    "competições",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
          <Toaster position="top-center" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
