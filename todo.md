# CheerConnect — Auditoria Completa (Fev 2026)

> 60 tarefas priorizadas. P0 = crítico para produção, P1 = alto impacto, P2 = médio, P3 = baixo/futuro.

---

## P0 — Crítico (8 tarefas)

### Segurança

- [x] **1. Adicionar verificação de ownership nas rotas de career/achievements/events (IDOR)**
  - `src/app/api/career/[id]/route.ts`, `achievements/[id]/route.ts`, `events/[id]/route.ts`
  - Qualquer usuário autenticado pode editar/deletar registros de outros usuários
  - Solução: comparar `session.user.id` com o `userId` do registro antes de permitir PUT/DELETE

- [x] **2. Corrigir escalação de privilégios na gestão de membros de equipe**
  - `src/app/api/teams/[slug]/members/[memberId]/route.ts`
  - Membros com `hasPermission` podem alterar membros com `isAdmin`
  - Solução: verificar se o alvo tem `isAdmin` e bloquear se o solicitante não for admin

- [x] **3. Adicionar constraint unique para reposts no schema**
  - `prisma/schema.prisma`
  - A regra "um repost por usuário por post" é verificada apenas em código, não no banco
  - Solução: `@@unique([authorId, originalPostId])` no modelo Post

- [x] **4. Adicionar rate limiting nos endpoints críticos**
  - Endpoints: `/api/auth/register`, `/api/posts`, `/api/conversations/[id]/messages`, `/api/upload`
  - Sem rate limiting, vulnerável a spam e abuso
  - Solução: middleware com rate limiting por IP (ex: `upstash/ratelimit` ou implementação com Map em memória)

### Infraestrutura

- [x] **5. Adicionar error.tsx nas route groups**
  - Faltam em: `src/app/(main)/error.tsx`, `src/app/(auth)/error.tsx`, `src/app/error.tsx`
  - Erros não tratados mostram tela branca ou erro genérico do Next.js
  - Solução: criar componentes error.tsx com UI amigável e botão de retry

- [x] **6. Adicionar not-found.tsx customizado na raiz**
  - `src/app/not-found.tsx`
  - Página 404 usa o padrão do Next.js
  - Solução: criar página 404 estilizada com navegação de volta

- [x] **7. Adicionar loading.tsx nas route groups**
  - Faltam em: `src/app/(main)/loading.tsx`, `src/app/(auth)/loading.tsx`
  - Navegação entre páginas não mostra feedback visual
  - Solução: criar componentes loading.tsx com skeleton/spinner usando classes existentes (`.animate-shimmer-premium`)

### Performance

- [x] **8. Adicionar índices compostos no Prisma schema**
  - `prisma/schema.prisma`
  - Queries frequentes fazem full table scan sem índices adequados
  - Índices necessários:
    - `Post`: `@@index([authorId, createdAt])`, `@@index([teamId, createdAt])`
    - `Message`: `@@index([conversationId, createdAt])`
    - `TeamMember`: `@@index([teamId, userId])`
    - `Notification`: `@@index([userId, read, createdAt])`
    - `Connection`: `@@index([senderId, status])`, `@@index([receiverId, status])`

---

## P1 — Alto (12 tarefas)

### Infraestrutura

- [x] **9. Adicionar healthcheck endpoint (GET /api/health)**
  - Não existe endpoint para verificar se a aplicação está saudável
  - Solução: criar `/api/health/route.ts` que verifica conexão com DB e retorna status

- [x] **10. Adicionar healthcheck no container Docker do app**
  - `docker-compose.yml`
  - Container pode parecer "up" mesmo com app travado
  - Solução: adicionar `healthcheck` apontando para `/api/health` (depende da tarefa 9)

- [x] **11. Configurar remotePatterns do Cloudinary no next.config**
  - `next.config.ts`
  - Imagens do Cloudinary são servidas com `<img>` em vez de `<Image />` por falta de configuração
  - Solução: adicionar `images.remotePatterns` para `res.cloudinary.com`

- [x] **12. Adicionar headers de segurança no next.config**
  - Headers faltantes: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
  - Solução: configurar `headers()` no `next.config.ts`

- [x] **13. Adicionar validação de variáveis de ambiente na inicialização**
  - Variáveis críticas (`DATABASE_URL`, `NEXTAUTH_SECRET`, etc.) não são validadas
  - App pode iniciar com vars faltantes e falhar silenciosamente
  - Solução: criar `src/lib/env.ts` com validação via Zod no startup

### Performance

- [x] **14. Corrigir N+1 query no feed endpoint**
  - `src/app/api/posts/route.ts`
  - Feed carrega posts e depois faz queries individuais para likes/comments
  - Solução: usar `include` do Prisma com `_count` para agregar em uma query

### Segurança

- [x] **15. Limitar tamanho de arrays nos inputs da API**
  - Campos como `skills[]`, `images[]`, `positions[]` não têm limite máximo
  - Possível enviar arrays enormes causando DoS
  - Solução: validar `.max(10)` (ou limite adequado) em todos os arrays de input

### SEO / Metadata

- [x] **16. Adicionar metadata OG/Twitter no layout raiz**
  - `src/app/layout.tsx`
  - Compartilhar links do app não mostra preview rico
  - Solução: adicionar `openGraph` e `twitter` no objeto `metadata`

### UX / Acessibilidade

- [x] **17. Remover h1 duplicados**
  - `src/app/(main)/connections/page.tsx`, `src/app/(main)/search/page.tsx`
  - Múltiplos `<h1>` na mesma página prejudica acessibilidade e SEO
  - Solução: manter apenas um `<h1>` por página, converter extras para `<h2>`

- [x] **18. Adicionar alt text descritivo nas imagens**
  - `src/components/feed/post-card.tsx`, `src/components/profile/profile-header.tsx`
  - Imagens com `alt=""` ou sem alt text
  - Solução: usar `alt={post.author.name + "'s post image"}` ou similar contextual

- [x] **19. Adicionar aria-label nos botões de ícone**
  - `src/components/shared/message-button.tsx` e outros botões só com ícone
  - Screen readers não conseguem identificar a função do botão
  - Solução: adicionar `aria-label="Mensagens"` etc.

### Qualidade de Código

- [x] **20. Padronizar formato de respostas da API (envelope consistente)**
  - Algumas rotas retornam `{ data }`, outras retornam o objeto direto, outras `{ error }`
  - Solução: definir envelope padrão `{ data, error, meta }` e aplicar gradualmente

---

## P2 — Médio (18 tarefas)

### Funcionalidades

- [x] **21. Implementar edição de posts (PUT /api/posts/[id])**
  - Usuários não podem editar posts após publicação
  - Solução: adicionar rota PUT com verificação de ownership, campo `updatedAt` visível na UI

- [x] **22. Implementar endpoint de denúncia (POST /api/reports)**
  - Não existe mecanismo para denunciar conteúdo impróprio
  - Solução: criar modelo `Report` no Prisma + endpoint + botão na UI do post-card

- [x] **23. Implementar bloqueio de usuários (POST /api/users/[id]/block)**
  - Não existe mecanismo para bloquear outros usuários
  - Solução: criar modelo `Block` no Prisma + endpoint + filtrar conteúdo de usuários bloqueados

- [x] **24. Substituir polling por SSE/WebSocket nas mensagens**
  - `src/components/messages/message-list.tsx`
  - Mensagens usam polling com intervalo fixo (desperdício de recursos)
  - Solução: implementar SSE (Server-Sent Events) para atualizações em tempo real

- [x] **25. Substituir polling por SSE nas notificações**
  - `src/components/shared/notification-dropdown.tsx`
  - Notificações usam polling similar às mensagens
  - Solução: SSE endpoint para push de notificações

- [x] **26. Adicionar endpoint de edição de comentários (PATCH /api/comments/[id])**
  - Comentários não podem ser editados após publicação
  - Solução: rota PATCH com verificação de ownership

### Qualidade de Código

- [x] **27. Dividir teams/[slug]/edit/page.tsx em sub-componentes**
  - `src/app/(main)/teams/[slug]/edit/page.tsx` — ~1700 linhas
  - Arquivo muito grande, difícil de manter
  - Solução: extrair seções (info geral, membros, conquistas, convites) em componentes separados

- [x] **28. Dividir profile/edit/page.tsx em sub-componentes**
  - `src/app/(main)/profile/edit/page.tsx` — ~1300 linhas
  - Solução: extrair seções (dados pessoais, carreira, conquistas, avatar/banner) em componentes

- [x] **29. Converter `<img>` para `<Image />` do Next.js**
  - Arquivos: `post-card.tsx`, `profile-header.tsx`, `create-post-card.tsx`
  - `<img>` não otimiza imagens (lazy loading, formatos modernos, resize)
  - Solução: substituir por `<Image />` com `width`/`height` ou `fill` (depende da tarefa 11)

- [x] **30. Padronizar padrão de paginação em todos os endpoints**
  - Alguns endpoints usam cursor, outros offset, alguns não paginam
  - Solução: definir padrão (cursor-based) e aplicar uniformemente

- [x] **31. Melhorar sort "popular" de comentários**
  - `src/components/feed/comment-section.tsx`
  - Ordenação "popular" é feita em memória no client após buscar todos os comentários
  - Solução: mover ordenação para o banco com `orderBy` no endpoint

### Performance

- [x] **32. Adicionar full-text search com tsvector do PostgreSQL**
  - Busca atual usa `contains` (LIKE %term%) — lento e sem relevância
  - Solução: adicionar coluna tsvector + índice GIN para busca eficiente

### Infraestrutura

- [x] **33. Adicionar tratamento de race condition na geração de slug de equipe**
  - `src/app/api/teams/route.ts`
  - Duas equipes criadas simultaneamente com mesmo nome podem gerar conflito
  - Solução: usar `try/catch` com retry no `P2002` (unique violation) do Prisma

- [x] **34. Tratar expiração de convites de equipe**
  - Modelo `TeamInvite` tem campo `expiresAt` mas não é verificado em nenhum lugar
  - Solução: filtrar convites expirados nos endpoints de listagem e aceitação

- [x] **35. Adicionar NODE_ENV=production no docker-compose**
  - `docker-compose.yml` — app roda sem NODE_ENV definido
  - Solução: adicionar `environment: - NODE_ENV=production`

- [x] **36. Adicionar restart policy no container do app**
  - `docker-compose.yml` — container não reinicia após crash
  - Solução: adicionar `restart: unless-stopped`

### DX

- [x] **37. Adicionar .editorconfig para consistência de formatação**
  - Não existe `.editorconfig` no projeto
  - Solução: criar com indent_style=space, indent_size=2, end_of_line=lf

### SEO

- [x] **38. Adicionar sitemap.ts e robots.ts**
  - Não existem `src/app/sitemap.ts` e `src/app/robots.ts`
  - Solução: criar usando a API de metadata do Next.js

---

## P3 — Baixo / Futuro (22 tarefas)

### Testes

- [x] **39. Adicionar infraestrutura de testes (Vitest + Testing Library)**
  - Projeto não tem nenhum teste automatizado
  - Solução: configurar Vitest + React Testing Library + mocks do Prisma

- [x] **40. Adicionar testes unitários para api-utils e lib/**
  - `src/lib/api-utils.ts`, `src/lib/constants.ts`, `src/lib/prisma.ts`
  - Funções utilitárias sem cobertura de testes
  - Solução: testes unitários para funções puras

- [x] **41. Adicionar testes de integração para API routes críticas**
  - Rotas de auth, posts, connections, teams sem testes
  - Solução: testes de integração com DB de teste

### Funcionalidades

- [x] **42. Implementar sistema de hashtags (#tag em posts)**
  - Posts não suportam hashtags
  - Solução: parser de hashtags + modelo `Tag` + link para busca por tag

- [x] **43. Implementar menções (@username em posts)**
  - Posts não suportam menções
  - Solução: parser de menções + notificação ao mencionado + link para perfil

- [ ] **44. Implementar sistema de moderação de conteúdo**
  - Não existe painel de moderação
  - Solução: role de moderador + painel admin + ações de moderação (depende da tarefa 22)

- [x] **45. Adicionar histórico de edição de posts (modelo PostEdit)**
  - Se edição for implementada (tarefa 21), não há registro do conteúdo original
  - Solução: modelo `PostEdit` que salva versões anteriores

- [ ] **46. Implementar notificações por email**
  - Todas as notificações são apenas in-app
  - Solução: integrar serviço de email (Resend/SendGrid) para notificações críticas

- [x] **47. Adicionar endpoint GET /api/posts/[id] para post individual**
  - Não existe rota para buscar um post específico por ID
  - Solução: criar rota GET com includes necessários

- [x] **48. Adicionar opção de privacidade PRIVATE no perfil**
  - Todos os perfis são públicos
  - Solução: campo `visibility` no User + filtros nos endpoints

- [x] **49. Implementar silenciar usuários/equipes (mute)**
  - Não existe mecanismo para silenciar conteúdo sem bloquear
  - Solução: modelo `Mute` + filtro no feed

### Infraestrutura / Observabilidade

- [ ] **50. Configurar Sentry ou similar para monitoramento de erros**
  - Erros em produção não são rastreados
  - Solução: integrar `@sentry/nextjs` com source maps

- [x] **51. Adicionar logging estruturado (pino/winston)**
  - Logs são `console.log` sem estrutura
  - Solução: configurar pino com níveis e formatação JSON

- [x] **52. Adicionar signal handling no Dockerfile (graceful shutdown)**
  - `Dockerfile` — container pode não encerrar graciosamente
  - Solução: usar `tini` como init process ou trap signals no entrypoint

### DX / Qualidade

- [x] **53. Remover `skipLibCheck: true` do tsconfig.json**
  - `tsconfig.json` — esconde erros de tipo em dependências
  - Solução: remover e corrigir erros que surgirem

- [x] **54. Adicionar noUnusedLocals e noUnusedParameters no tsconfig**
  - Variáveis e parâmetros não usados não geram erro
  - Solução: habilitar flags + limpar código existente

- [x] **55. Limpar dependências não utilizadas**
  - Possíveis deps não usadas: `cmdk`, `dotenv`
  - Solução: verificar uso e remover do `package.json`

- [x] **56. Adicionar documentação de API (OpenAPI/Swagger)**
  - API não tem documentação formal
  - Solução: gerar spec OpenAPI a partir das rotas

- [ ] **57. Adicionar guia de contribuição no README**
  - README não tem instruções para contribuidores
  - Solução: seção de contributing com setup, convenções, PR guidelines

### i18n

- [ ] **58. Adicionar i18n framework (next-intl)**
  - App só suporta português
  - Solução: configurar next-intl para internacionalização futura

### SEO

- [x] **59. Adicionar metadata dinâmica por página**
  - Páginas de perfil, posts e equipes não têm metadata específica
  - Solução: `generateMetadata()` em cada page.tsx com dados dinâmicos

### Auditoria

- [x] **60. Adicionar audit log (modelo ActivityLog)**
  - Ações administrativas não são registradas
  - Solução: modelo `ActivityLog` + hooks nos endpoints de admin/moderação

---

## Resumo

| Prioridade | Quantidade | Foco Principal |
|------------|------------|----------------|
| P0 | 8 | Segurança (IDOR, rate limit), infraestrutura básica (error/loading/404), performance (índices) |
| P1 | 12 | Healthcheck, headers de segurança, N+1, SEO, acessibilidade |
| P2 | 18 | Funcionalidades (edição, denúncia, bloqueio), real-time, refatoração, DX |
| P3 | 22 | Testes, funcionalidades futuras, observabilidade, i18n |
| **Total** | **60** | |

---

*Gerado pela auditoria completa de Fev 2026. Atualizar conforme tarefas forem concluídas.*
