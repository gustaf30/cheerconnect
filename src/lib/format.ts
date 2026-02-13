const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_WEEK = 604800;

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < SECONDS_PER_MINUTE) return "Agora";
  if (diffInSeconds < SECONDS_PER_HOUR) return `${Math.floor(diffInSeconds / SECONDS_PER_MINUTE)}m`;
  if (diffInSeconds < SECONDS_PER_DAY) return `${Math.floor(diffInSeconds / SECONDS_PER_HOUR)}h`;
  if (diffInSeconds < SECONDS_PER_WEEK) return `${Math.floor(diffInSeconds / SECONDS_PER_DAY)}d`;
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
