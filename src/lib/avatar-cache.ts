// Cache compartilhado do perfil do usuário logado (/api/users/me)
// Usado por CommentSection (avatar) e CreatePostCard (nome + avatar)

interface CachedProfile {
  name: string;
  username: string;
  avatar: string | null;
}

const TTL = 5 * 60 * 1000; // 5 minutos
let cached: CachedProfile | null = null;
let cachedAt = 0;
let fetchPromise: Promise<CachedProfile | null> | null = null;

/**
 * Retorna perfil do usuário logado com cache e dedup de requests.
 * TTL de 5 minutos — após expirar, busca novamente no próximo acesso.
 */
export async function fetchCachedUserProfile(): Promise<CachedProfile | null> {
  if (cached && Date.now() - cachedAt < TTL) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/users/me")
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        cached = {
          name: data.user.name,
          username: data.user.username,
          avatar: data.user.avatar ?? null,
        };
        cachedAt = Date.now();
        return cached;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

/**
 * Invalida o cache — chamar após atualizar avatar/perfil.
 */
export function invalidateUserProfileCache(): void {
  cached = null;
  cachedAt = 0;
}
