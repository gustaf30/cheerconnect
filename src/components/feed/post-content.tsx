"use client";

import Link from "next/link";
import Image from "next/image";
import { ZoomIn } from "lucide-react";

// Regex for #hashtags and @mentions — compiled once at module level
const CONTENT_LINK_REGEX = /(#[a-zA-Z0-9_\u00C0-\u024F]+)|(@[a-zA-Z0-9_]+)/g;

export function renderContentWithLinks(text: string): React.ReactNode {
  CONTENT_LINK_REGEX.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = CONTENT_LINK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("#")) {
      const tagName = token.slice(1).toLowerCase();
      parts.push(
        <Link
          key={`tag-${match.index}`}
          href={`/search?q=${encodeURIComponent("#" + tagName)}`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </Link>
      );
    } else if (token.startsWith("@")) {
      const username = token.slice(1);
      parts.push(
        <Link
          key={`mention-${match.index}`}
          href={`/profile/${username}`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </Link>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

interface PostContentProps {
  content: string;
  images: string[];
  videoUrl?: string | null;
  authorName?: string;
  onImageClick?: (image: string) => void;
}

export function PostContent({ content, images, videoUrl, authorName, onImageClick }: PostContentProps) {
  return (
    <>
      {content && <p className="whitespace-pre-wrap">{renderContentWithLinks(content)}</p>}

      {images.length > 0 && (
        <div className={`mt-3 grid gap-1 ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.map((image, index) => (
            <div
              key={index}
              className="relative group cursor-pointer overflow-hidden rounded-xl"
              onClick={() => onImageClick?.(image)}
            >
              <Image
                src={image}
                alt={`Imagem ${index + 1} do post de ${authorName || "usuário"}`}
                width={600}
                height={400}
                sizes="(max-width: 768px) 100vw, 600px"
                className="max-h-80 w-full object-contain bg-muted"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-base flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-base drop-shadow-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {videoUrl && (
        <div className="mt-3">
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            className="rounded-xl max-h-[32rem] w-full"
          >
            Seu navegador não suporta reprodução de vídeo.
          </video>
        </div>
      )}
    </>
  );
}
