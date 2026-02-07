# CheerConnect — Auditoria Completa & Tarefas de Melhoria

> Auditoria rigorosa cobrindo segurança, bugs, UX, acessibilidade, performance, consistência e qualidade de código.

## Legenda de Prioridade

| Tag | Significado |
|-----|-------------|
| **P0** | CRÍTICO — Segurança, bugs de dados, falhas de auth |
| **P1** | ALTO — UX quebrada, acessibilidade, navegabilidade |
| **P2** | MÉDIO — Polish, consistência, performance |
| **P3** | BAIXO — Nice-to-have, features futuras |

## Legenda de Status

- ✅ = Concluído
- 🔧 = Em progresso
- ⬚ = Pendente

---

## P0 — CRÍTICO

### ✅ 1. Middleware matcher incompleto
- **Status:** CONCLUÍDO (Sprint 0C)
- **Arquivo:** `src/middleware.ts`
- **Fix aplicado:** Adicionados `/messages/:path*` e `/settings/:path*` ao array `matcher`

### ✅ 2. Notificações ignoram preferências do usuário
- **Status:** CONCLUÍDO (Sprint 0A schema + Sprint 1A code)
- **Arquivos afetados (6 endpoints):** Todos os 6 endpoints agora checam preferências do usuário antes de criar notificação.
- **Fix aplicado:**
  - Schema: adicionados campos `notifyPostReposted` e `notifyTeamInvite` ao model User
  - Code: cada endpoint busca a preferência do usuário-alvo e só cria notificação se habilitada
  - Padrão: `Promise.all` para buscar info do currentUser + preferências do target em paralelo

### ✅ 3. Visibilidade do perfil não enforced
- **Status:** CONCLUÍDO (Sprint 1B)
- **Arquivo:** `src/app/api/users/route.ts`
- **Fix aplicado:** Busca IDs de conexões aceitas, filtra: `profileVisibility: PUBLIC` OR `id in connectedUserIds`

### ✅ 4. Imagens base64 no banco de dados
- **Status:** CONCLUÍDO (Sprint 2)
- **Arquivos modificados:**
  - `prisma/schema.prisma` — adicionados campos `avatarPublicId` e `bannerPublicId` ao model User
  - `src/lib/cloudinary.ts` — adicionados helpers `extractPublicId()`, `deleteCloudinaryAsset()`, `deletePostAssets()`
  - `src/app/api/users/me/avatar/route.ts` — reescrito: aceita FormData, upload para Cloudinary (`cheerconnect/avatars`), salva URL + publicId, deleta asset antigo
  - `src/app/api/users/me/banner/route.ts` — reescrito: mesmo padrão, folder `cheerconnect/banners`
  - `src/app/(main)/profile/edit/page.tsx` — `handleAvatarChange` e `handleBannerChange` agora usam FormData em vez de FileReader/base64
- **Migration:** `20260207141358_avatar_banner_cloudinary`

### ✅ 5. Assets do Cloudinary nunca deletados
- **Status:** CONCLUÍDO (Sprint 2)
- **Arquivos modificados:**
  - `src/lib/cloudinary.ts` — helper `deletePostAssets()` itera images[] + videoUrl, extrai publicIds, deleta em batch via `Promise.allSettled`
  - `src/app/api/posts/[id]/route.ts` — DELETE handler agora busca `images` e `videoUrl`, chama `deletePostAssets()` (fire-and-forget com try/catch) antes de deletar o post
  - Avatar/banner routes (task #4) — deletam asset antigo ao substituir ou remover

### ✅ 6. Missing database indexes
- **Status:** CONCLUÍDO (Sprint 0A)
- **Arquivo:** `prisma/schema.prisma`
- **Fix aplicado:** Adicionados `@@index` em Post (authorId, teamId, createdAt), Connection (senderId+status, receiverId+status), Like (postId), TeamMember (userId), Event (startDate, type), CareerHistory (userId), Achievement (userId)
- **Migration:** `20260207134210_indexes_notif_prefs`

### ✅ 7. Race condition: último admin de time
- **Status:** CONCLUÍDO (Sprint 1C PATCH + Sprint 2 DELETE)
- **Arquivo:** `src/app/api/teams/[slug]/members/[memberId]/route.ts`
- **Fix aplicado (PATCH):** Admin count check + update envolvidos em `prisma.$transaction()`. Erro "LAST_ADMIN" capturado no catch.
- **Fix aplicado (DELETE):** Mesmo padrão — admin count + soft delete dentro de `prisma.$transaction()`. Erro "LAST_ADMIN" capturado no catch com retorno 400.

---

## P1 — ALTO (Navegabilidade & UX)

### ✅ 8. Mensagens e Configurações NÃO estão na sidebar
- **Status:** CONCLUÍDO (Sprint 0C)
- **Arquivo:** `src/components/shared/sidebar.tsx`
- **Fix aplicado:** Adicionados itens "Mensagens" (/messages, MessageCircle) e "Configurações" (/settings, Settings) ao array `mainNavItems`. Grid 2x3 mantido.

### ✅ 9. Sem paginação/infinite scroll no feed
- **Status:** CONCLUÍDO (Sprint 2)
- **Arquivo:** `src/components/feed/post-list.tsx`
- **Fix aplicado:** Adicionados estados `nextCursor`, `isLoadingMore`, `hasMore`. Função `loadMore()` busca próxima página via `?cursor=&limit=20` e faz append. `IntersectionObserver` no div sentinela (200px rootMargin) dispara `loadMore()`. Spinner de loading no final da lista.

### ⬚ 10. Sem paginação em endpoints críticos
- **Status:** PENDENTE (Sprint 4A)
- **Fix planejado:** Adicionar cursor pagination em connections, achievements, conversations, users/me/teams, teams/invites.

### ✅ 11. `confirm()` do browser em vez de Dialog customizado
- **Status:** CONCLUÍDO (Sprint 3)
- **8 ocorrências em 6 arquivos** — Substituídas por `ConfirmDialog` (wrapper sobre AlertDialog).
- **Componente criado:** `src/components/shared/confirm-dialog.tsx`
- **Padrão:** Estado `targetId` (ou boolean) controla abertura; onConfirm executa ação; loading state no botão.
- **Arquivos modificados:** post-card.tsx, comment-item.tsx, connections/page.tsx, events/page.tsx, teams/[slug]/edit/page.tsx (2x), profile/edit/page.tsx (2x)

### ✅ 12. Empty states fracos e não-acionáveis
- **Status:** JÁ RESOLVIDO (pré-existente)
- **Nota:** Empty states já implementados adequadamente nas páginas.

### ✅ 13. Funções duplicadas em 20+ componentes
- **Status:** CONCLUÍDO (Sprint 0B)
- **Fix aplicado:**
  - `getInitials()` extraído para `src/lib/utils.ts` — 20 definições locais removidas, substituídas por import
  - `positionLabels` extraído para `src/lib/constants.ts` — 6 definições locais removidas
  - `careerRoleLabels` extraído para `src/lib/constants.ts` — 1 definição local removida (profile-tabs)
- **Verificação:** `npx next build` passou sem erros após todas as substituições.

### ✅ 14. Sem tratamento de erro visual em muitas páginas
- **Status:** CONCLUÍDO (Sprint 3)
- **Componente criado:** `src/components/shared/error-state.tsx` — bento-card-static + accent-bar + AlertCircle + botão "Tentar novamente"
- **Arquivos modificados:** post-list.tsx, connections/page.tsx, events/page.tsx, teams/page.tsx, search/page.tsx
- **Padrão:** `error` state, `setError()` no catch do fetch, render `<ErrorState onRetry={refetch} />`

### ✅ 15. Filter/tab state não persiste na URL
- **Status:** CONCLUÍDO (Sprint 2 feed + Sprint 3 connections)
- **Fix aplicado (feed):** `src/app/(main)/feed/page.tsx` — trocado `useState` por `useSearchParams()` + `router.replace()`. Filtro persiste na URL como `?filter=following|all`. Componente envolto em `<Suspense>` para SSG.
- **Fix aplicado (connections):** `src/app/(main)/connections/page.tsx` — tab via `useSearchParams().get("tab")`, `router.replace(/connections?tab=${v})`, envolto em `<Suspense>`.

### ⬚ 16. Sem "Esqueci minha senha"
- **Status:** DIFERIDO — Requer infraestrutura de email (Resend/SendGrid)

### ⬚ 17. Sem verificação de email
- **Status:** DIFERIDO — Mesma dependência de email

### ⬚ 18. Sem soft delete para usuários
- **Status:** DIFERIDO — Feature complexa, baixo impacto para TCC

---

## P2 — MÉDIO (Consistência, Performance, Polish)

### ⬚ 19. Polling agressivo sem WebSocket
- **Status:** DIFERIDO — Mudança arquitetural grande

### ✅ 20. useCallback/useEffect com dependências incorretas
- **Status:** CONCLUÍDO (Sprint 3)
- **Fix aplicado:** Funções de fetch envoltas em `useCallback` com deps corretas.
- **Arquivos:** connections/page.tsx (fetchConnections), profile/edit/page.tsx (fetchProfile, fetchCareerHistory, fetchAchievements), teams/[slug]/edit/page.tsx (fetchTeam, fetchMembers, fetchAchievements, fetchInvites com dep [slug])

### ✅ 21. Respostas de erro da API inconsistentes
- **Status:** JÁ RESOLVIDO (pré-existente)
- **Nota:** Padrão `{ error: string }` já consistente nos endpoints.

### ✅ 22. Notification type é String, não enum
- **Status:** CONCLUÍDO (Sprint 0A)
- **Arquivo:** `prisma/schema.prisma`
- **Fix aplicado:** Criado `enum NotificationType` com 8 valores (POST_LIKED, POST_COMMENTED, COMMENT_REPLIED, CONNECTION_REQUEST, CONNECTION_ACCEPTED, MESSAGE_RECEIVED, POST_REPOSTED, TEAM_INVITE). Campo `type` migrado de `String` para `NotificationType`.
- **Migration:** `20260207134232_notification_type_enum`
- **Também:** Adicionados ícones para COMMENT_REPLIED e POST_REPOSTED no `notification-item.tsx`.

### ✅ 23. Cards inconsistentes: Card shadcn vs bento-card divs
- **Status:** CONCLUÍDO (Sprint 3)
- **Fix aplicado:** Todos os Card/CardHeader/CardTitle/CardContent substituídos por `div.bento-card-static` + `div.accent-bar` + headings semânticos.
- **Arquivos:** profile/edit/page.tsx (~8 Cards), teams/[slug]/edit/page.tsx (~6 Cards), profile-tabs.tsx (~4 Cards), messages/[conversationId]/page.tsx (~1 Card), teams/invites/page.tsx (~2 Cards)
- **Import de Card removido** de todos os arquivos migrados.

### ✅ 24. Acessibilidade: botões sem aria-label
- **Status:** CONCLUÍDO (Sprint 3)
- **Fix aplicado:** aria-label adicionado em 10+ icon buttons.
- **Arquivos:** header.tsx ("Abrir menu"), create-post-card.tsx ("Remover mídia"), post-card.tsx ("Mais opções" x2, "Fechar imagem"), comment-item.tsx ("Opções do comentário"), comment-section.tsx ("Enviar comentário" x2, "Cancelar resposta"), events/page.tsx ("Opções do evento")

### ✅ 25. Acessibilidade: heading hierarchy
- **Status:** CONCLUÍDO (Sprint 3)
- **Fix aplicado:** h1 sr-only adicionado em feed/page.tsx e messages/page.tsx. Headings em profile/edit e teams/[slug]/edit normalizados para `heading-section font-display`.

### ✅ 26. Acessibilidade: `<time>` semântico
- **Status:** CONCLUÍDO (Sprint 3)
- **Fix aplicado:** Datas envoltas em `<time dateTime={ISO}>` sem mudança visual.
- **Arquivos:** post-card.tsx (2x), comment-item.tsx, notification-item.tsx, events/page.tsx (2x)

### ⬚ 27. Conversas duplicadas: constraint insuficiente
- **Status:** DIFERIDO — Baixo impacto

### ✅ 28. Metadata SEO por página
- **Status:** CONCLUÍDO (Sprint 3)
- **14 layout.tsx criados** com `export const metadata: Metadata = { title: "..." }` para rotas estáticas.
- **2 rotas dinâmicas** com `generateMetadata()`: profile/[username]/page.tsx, teams/[slug]/page.tsx
- **Rotas cobertas:** login, register, feed, connections, teams, events, messages, search, settings, profile, profile/edit, teams/invites, teams/[slug]/edit, messages/[conversationId]

### ⬚ 29. Espaçamento inconsistente em bento-cards
- **Status:** DIFERIDO — Cosmético

### ✅ 30. Self-update de role em times
- **Status:** JÁ RESOLVIDO (pré-existente)
- **Nota:** PATCH handler já bloqueia alteração de próprias permissões.

### ⬚ 31. Upload: validação de tipo de arquivo fraca
- **Status:** DIFERIDO — Hardening secundário

### ✅ 32. .env.example incompleto
- **Status:** CONCLUÍDO (Sprint 0C)
- **Arquivo:** `.env.example`
- **Fix aplicado:** Adicionadas variáveis `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

---

## P3 — BAIXO (Nice-to-have)

### ⬚ 33. Sem dark mode toggle (usa system preference apenas)
### ⬚ 34. Sem busca dentro de conexões/mensagens
### ⬚ 35. Sem menções (@usuario) em posts/comentários
### ⬚ 36. Sem hashtags
### ⬚ 37. Sem salvar/favoritar posts
### ⬚ 38. Sem editar post (só delete)
### ⬚ 39. Sem indicador de digitação nas mensagens
### ⬚ 40. Sem emoji picker
### ⬚ 41. Sem anexar arquivos nas mensagens
### ⬚ 42. Sem página dedicada de notificações (só dropdown)
### ⬚ 43. Sem bloquear usuários
### ⬚ 44. Sem sistema de report/denúncia
### ⬚ 45. Sem exportar dados (LGPD compliance)
### ⬚ 46. Sem vista de calendário para eventos
### ⬚ 47. Sem adicionar ao calendário (Google/Apple)
### ⬚ 48. Sem RSVP/confirmação de presença em eventos
### ⬚ 49. Sem suporte offline/PWA
### ⬚ 50. Sem atalhos de teclado
### ⬚ 51. Sem i18n (texto hardcoded em português)
### ⬚ 52. Sem virtual scrolling para listas longas
### ⬚ 53. Sem 2FA (autenticação de dois fatores)

---

## Progresso por Sprint

| Sprint | Status | Tarefas |
|--------|--------|---------|
| **0 — Fundação** | ✅ Concluído | #1, #6, #8, #13, #22, #32 |
| **1 — Segurança** | ✅ Concluído | ✅ #2, ✅ #3, ✅ #7 |
| **2 — Mídia + Feed** | ✅ Concluído | ✅ #4, ✅ #5, ✅ #7-DELETE, ✅ #9, ✅ #15-feed |
| **3 — UX + A11y** | ✅ Concluído | ✅ #11, ✅ #14, ✅ #15-conn, ✅ #20, ✅ #23, ✅ #24, ✅ #25, ✅ #26, ✅ #28 |
| **4 — API + Consistência** | ⬚ Pendente | #10 |

### Última verificação de build
- `npx next build` — ✅ PASSOU (após Sprint 3 completo)
- Próxima verificação: após Sprint 4 completo

---

## Estatísticas da Auditoria

| Prioridade | Total | Concluído | Em progresso | Pendente | Diferido |
|------------|-------|-----------|--------------|----------|----------|
| **P0** | 7 | 7 | 0 | 0 | 0 |
| **P1** | 11 | 7 | 0 | 1 | 3 |
| **P2** | 14 | 10 | 0 | 0 | 4 |
| **P3** | 21 | 0 | 0 | 21 | 0 |
| **Total** | **53** | **24** | **0** | **22** | **7** |

## Arquivos Criados/Modificados

### Sprint 0 — Fundação
#### Novos arquivos
- `src/lib/constants.ts` — positionLabels, careerRoleLabels
- `prisma/migrations/20260207134210_indexes_notif_prefs/migration.sql`
- `prisma/migrations/20260207134232_notification_type_enum/migration.sql`

#### Arquivos modificados
- `prisma/schema.prisma` — indexes, notifyPostReposted, notifyTeamInvite, NotificationType enum
- `src/lib/utils.ts` — adicionada função `getInitials()`
- `src/middleware.ts` — matcher expandido
- `.env.example` — variáveis Cloudinary
- `src/components/shared/sidebar.tsx` — nav items Mensagens/Configurações, getInitials importado
- `src/components/shared/notification-item.tsx` — ícones COMMENT_REPLIED/POST_REPOSTED, getInitials importado
- 20 arquivos — getInitials local removido, import de `@/lib/utils` adicionado
- 6 arquivos — positionLabels local removido, import de `@/lib/constants` adicionado

### Sprint 1 — Segurança
- `src/app/api/posts/[id]/like/route.ts` — preference check notifyPostLiked
- `src/app/api/posts/[id]/comments/route.ts` — preference check notifyPostCommented/notifyCommentReplied
- `src/app/api/connections/route.ts` — preference check notifyConnectionRequest
- `src/app/api/connections/[id]/accept/route.ts` — preference check notifyConnectionAccepted
- `src/app/api/posts/[id]/repost/route.ts` — preference check notifyPostReposted
- `src/app/api/teams/[slug]/invites/route.ts` — preference check notifyTeamInvite
- `src/app/api/users/route.ts` — profile visibility filter
- `src/app/api/teams/[slug]/members/[memberId]/route.ts` — PATCH race condition fix (transaction)

### Sprint 2 — Mídia + Feed
#### Novos arquivos
- `prisma/migrations/20260207141358_avatar_banner_cloudinary/migration.sql`

#### Arquivos modificados
- `prisma/schema.prisma` — adicionados `avatarPublicId`, `bannerPublicId` ao model User
- `prisma/seed.ts` — corrigido tipo de notificações: string → `NotificationType` enum
- `src/lib/cloudinary.ts` — adicionados helpers `extractPublicId()`, `deleteCloudinaryAsset()`, `deletePostAssets()`
- `src/app/api/users/me/avatar/route.ts` — reescrito para Cloudinary (FormData upload, cleanup de assets antigos)
- `src/app/api/users/me/banner/route.ts` — reescrito para Cloudinary (FormData upload, cleanup de assets antigos)
- `src/app/(main)/profile/edit/page.tsx` — handleAvatarChange/handleBannerChange: base64 → FormData
- `src/app/api/posts/[id]/route.ts` — DELETE handler: cleanup de assets Cloudinary antes de deletar post
- `src/app/api/teams/[slug]/members/[memberId]/route.ts` — DELETE handler: race condition fix (transaction)
- `src/components/feed/post-list.tsx` — infinite scroll com IntersectionObserver + cursor pagination
- `src/app/(main)/feed/page.tsx` — filtro via useSearchParams + Suspense boundary

### Sprint 3 — UX + Acessibilidade
#### Novos arquivos
- `src/components/shared/confirm-dialog.tsx` — ConfirmDialog wrapper sobre AlertDialog (#11)
- `src/components/shared/error-state.tsx` — ErrorState com retry (#14)
- 14x `layout.tsx` com metadata SEO: login, register, feed, connections, teams, events, messages, search, settings, profile, profile/edit, teams/invites, teams/[slug]/edit, messages/[conversationId] (#28)

#### Arquivos modificados
- `src/components/shared/header.tsx` — aria-label "Abrir menu" (#24)
- `src/components/feed/create-post-card.tsx` — aria-label "Remover mídia" (#24)
- `src/components/feed/post-card.tsx` — aria-labels (#24), `<time>` semântico (#26), ConfirmDialog delete (#11)
- `src/components/feed/comment-item.tsx` — aria-label (#24), `<time>` (#26), ConfirmDialog delete (#11)
- `src/components/feed/comment-section.tsx` — aria-labels (#24)
- `src/components/feed/post-list.tsx` — ErrorState com retry (#14)
- `src/components/shared/notification-item.tsx` — `<time>` semântico (#26)
- `src/components/profile/profile-tabs.tsx` — Card→bento-card (#23)
- `src/app/(main)/feed/page.tsx` — h1 sr-only (#25)
- `src/app/(main)/messages/page.tsx` — h1 sr-only (#25)
- `src/app/(main)/connections/page.tsx` — ConfirmDialog (#11), ErrorState (#14), URL tabs (#15), useCallback (#20)
- `src/app/(main)/events/page.tsx` — aria-label (#24), `<time>` (#26), ConfirmDialog (#11), ErrorState (#14)
- `src/app/(main)/teams/page.tsx` — ErrorState (#14)
- `src/app/(main)/search/page.tsx` — ErrorState (#14)
- `src/app/(main)/teams/[slug]/edit/page.tsx` — ConfirmDialog 2x (#11), useCallback (#20), Card→bento (#23), heading (#25)
- `src/app/(main)/teams/invites/page.tsx` — Card→bento (#23)
- `src/app/(main)/profile/edit/page.tsx` — ConfirmDialog 2x (#11), useCallback (#20), Card→bento (#23), heading (#25)
- `src/app/(main)/profile/[username]/page.tsx` — generateMetadata SEO (#28)
- `src/app/(main)/teams/[slug]/page.tsx` — generateMetadata SEO (#28)
- `src/app/(main)/messages/[conversationId]/page.tsx` — Card→bento (#23)
