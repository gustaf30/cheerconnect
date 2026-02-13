// Labels de posições de cheerleading
export const positionLabels: Record<string, string> = {
  FLYER: "Flyer",
  BASE: "Base",
  BACKSPOT: "Backspot",
  FRONTSPOT: "Frontspot",
  TUMBLER: "Tumbler",
  COACH: "Técnico",
  CHOREOGRAPHER: "Coreógrafo",
  JUDGE: "Juiz",
  OTHER: "Outro",
};

// Labels de papéis de carreira
export const careerRoleLabels: Record<string, string> = {
  ATHLETE: "Atleta",
  COACH: "Técnico",
  ASSISTANT_COACH: "Técnico Assistente",
  CHOREOGRAPHER: "Coreógrafo",
  TEAM_MANAGER: "Coordenador",
  JUDGE: "Juiz",
  OTHER: "Outro",
};

// Labels de categorias de equipes
export const categoryLabels: Record<string, string> = {
  ALLSTAR: "All Star",
  SCHOOL: "Escolar",
  COLLEGE: "Universitário",
  RECREATIONAL: "Recreativo",
  PROFESSIONAL: "Profissional",
};

// Labels de tipos de eventos
export const eventTypeLabels: Record<string, string> = {
  COMPETITION: "Competição",
  TRYOUT: "Tryout",
  CAMP: "Camp",
  WORKSHOP: "Workshop",
  SHOWCASE: "Showcase",
  OTHER: "Outro",
};

// Opções de tipos de eventos (para selects/filtros)
export const eventTypes = [
  { value: "COMPETITION", label: "Competição" },
  { value: "TRYOUT", label: "Tryout" },
  { value: "CAMP", label: "Camp" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "SHOWCASE", label: "Showcase" },
  { value: "OTHER", label: "Outro" },
] as const;

// Opções de posições de cheerleading (para selects/badges)
export const positionOptions = [
  { value: "FLYER", label: "Flyer" },
  { value: "BASE", label: "Base" },
  { value: "BACKSPOT", label: "Backspot" },
  { value: "FRONTSPOT", label: "Frontspot" },
  { value: "TUMBLER", label: "Tumbler" },
  { value: "COACH", label: "Técnico" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "JUDGE", label: "Juiz" },
  { value: "OTHER", label: "Outro" },
] as const;

// Opções de categorias de conquistas (para selects)
export const achievementCategoryOptions = [
  { value: "COMPETITION", label: "Competição" },
  { value: "CERTIFICATION", label: "Certificação" },
  { value: "AWARD", label: "Prêmio" },
  { value: "OTHER", label: "Outro" },
] as const;

// Política de senha
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const PASSWORD_ERROR =
  "Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número";

// Limites de upload de mídia
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_IMAGES_PER_POST = 4;

// Limites de paginação
export const COMMENTS_PER_PAGE = 3;
export const COMMENTS_EXPANDED_PER_PAGE = 10;
export const REPLIES_LOAD_LIMIT = 10;

// Opções de papéis em equipes (para selects de membros)
export const teamRoleOptions = [
  "Atleta",
  "Técnico",
  "Assistente",
  "Coreógrafo",
  "Marketing",
  "Diretor",
  "Presidente",
  "Outro",
] as const;

// Opções de papéis de carreira (para selects de histórico)
export const careerRoleOptions = [
  { value: "ATHLETE", label: "Atleta" },
  { value: "COACH", label: "Técnico" },
  { value: "ASSISTANT_COACH", label: "Técnico Assistente" },
  { value: "CHOREOGRAPHER", label: "Coreógrafo" },
  { value: "TEAM_MANAGER", label: "Gestor de Equipe" },
  { value: "JUDGE", label: "Juiz" },
  { value: "OTHER", label: "Outro" },
] as const;
