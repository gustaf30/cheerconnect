// Tipos compartilhados do CheerConnect

export interface PostAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
}

export interface PostTeam {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

export interface PostData {
  id: string;
  content: string;
  images: string[];
  videoUrl?: string | null;
  createdAt: string | Date;
  author: PostAuthor;
  team?: PostTeam | null;
  originalPostId?: string | null;
  originalPost?: PostData | null;
  _count: {
    likes: number;
    comments: number;
    reposts?: number;
  };
  isLiked: boolean;
}

export interface ConnectionUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  positions: string[];
  location: string | null;
}

export interface UserProfile {
  name: string;
  username: string;
  avatar: string | null;
}
