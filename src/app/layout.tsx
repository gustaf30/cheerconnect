import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Sans_3, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["200", "400", "700", "800"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-editorial",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
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
      <body className={`${bricolage.variable} ${sourceSans.variable} ${jetbrains.variable} ${newsreader.variable} font-body antialiased`}>
        <SessionProvider>
          {children}
          <Toaster position="top-center" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
