/**
 * Extrai hashtags de um conteúdo de texto.
 * Retorna nomes em lowercase, sem o #.
 * Suporta caracteres acentuados (português).
 */
export function extractHashtags(content: string): string[] {
  const regex = /#([a-zA-Z0-9_\u00C0-\u024F]+)/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

/**
 * Extrai menções (@username) de um conteúdo de texto.
 * Retorna usernames sem o @.
 */
export function extractMentions(content: string): string[] {
  const regex = /@([a-zA-Z0-9_]+)/g;
  const mentions = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.add(match[1]);
  }
  return Array.from(mentions);
}
