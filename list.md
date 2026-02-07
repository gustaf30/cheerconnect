│ CheerConnect - Auditoria Completa & Tarefas de Melhoria                                                    │
│                                                                                                            │
│ Context                                                                                                    │
│                                                                                                            │
│ Auditoria rigorosa de todo o projeto CheerConnect cobrindo: UI/UX, acessibilidade, seguranca, performance, │
│  navegabilidade, consistencia de design, e qualidade de codigo. O objetivo e criar um todo.md abrangente   │
│ com todas as melhorias organizadas por prioridade.                                                         │
│                                                                                                            │
│ ---                                                                                                        │
│ Plano: Escrever todo.md com todas as tarefas identificadas                                                 │
│                                                                                                            │
│ O arquivo todo.md sera organizado nas seguintes categorias:                                                │
│                                                                                                            │
│ Estrutura do todo.md                                                                                       │
│                                                                                                            │
│ P0 - CRITICO (Seguranca, Bugs, Dados)                                                                      │
│ P1 - ALTO (UX Quebrada, Acessibilidade, Navegabilidade)                                                    │
│ P2 - MEDIO (Polish, Consistencia, Performance)                                                             │
│ P3 - BAIXO (Nice-to-have, Features futuras)                                                                │
│                                                                                                            │
│ ---                                                                                                        │
│ P0 - CRITICO                                                                                               │
│                                                                                                            │
│ 1. Middleware matcher incompleto (src/middleware.ts)                                                       │
│   - /messages e /settings NAO estao no matcher - podem ser acessados sem auth                              │
│   - Adicionar todas as rotas protegidas ao matcher                                                         │
│ 2. Notificacoes ignoram preferencias do usuario                                                            │
│   - POST_LIKED, POST_COMMENTED, CONNECTION_REQUEST criam notificacoes sem checar settings                  │
│   - Unica implementacao correta: MESSAGE_RECEIVED em /api/conversations/[id]/messages                      │
│   - Arquivos: todos os endpoints que criam notificacoes                                                    │
│ 3. Visibilidade do perfil nao enforced                                                                     │
│   - /api/users (search) ignora profileVisibility: CONNECTIONS_ONLY                                         │
│   - Usuarios com perfil privado aparecem normalmente na busca                                              │
│ 4. Imagens base64 no banco de dados                                                                        │
│   - Avatar e banner salvos como base64 direto no User (ate 7MB por campo)                                  │
│   - Posts usam Cloudinary corretamente, mas avatar/banner nao                                              │
│   - Arquivos: /api/users/me/avatar, /api/users/me/banner                                                   │
│ 5. Assets do Cloudinary nunca deletados                                                                    │
│   - Ao trocar avatar/banner ou deletar post, assets antigos ficam no Cloudinary                            │
│   - Custo de storage cresce indefinidamente                                                                │
│ 6. Missing database indexes (prisma/schema.prisma)                                                         │
│   - Post.authorId, Post.teamId, Post.createdAt sem index                                                   │
│   - Connection.status sem index                                                                            │
│   - Like.postId sem index individual                                                                       │
│   - TeamMember.userId sem index                                                                            │
│   - Event.startDate, Event.type sem index                                                                  │
│   - Performance degrada significativamente com escala                                                      │
│ 7. Sem sanitizacao de input (risco XSS)                                                                    │
│   - Conteudo de posts, comentarios, mensagens, nomes de times armazenados sem sanitizacao                  │
│   - Afeta: /api/posts, /api/comments, /api/conversations/[id]/messages, /api/teams                         │
│ 8. Race condition: ultimo admin de time                                                                    │
│   - Check de "ultimo admin" nao e atomico em /api/teams/[slug]/members/[memberId]                          │
│   - Duas requests simultaneas podem remover todos os admins                                                │
│                                                                                                            │
│ ---                                                                                                        │
│ P1 - ALTO (Navegabilidade & UX)                                                                            │
│                                                                                                            │
│ 9. Mensagens e Configuracoes NAO estao na sidebar                                                          │
│   - /messages so e acessivel pelo icone no header                                                          │
│   - /settings so e acessivel pelo dropdown do avatar                                                       │
│   - Ambos deveriam ter links na sidebar (nav principal)                                                    │
│ 10. Sem paginacao/infinite scroll no feed                                                                  │
│   - post-list.tsx carrega todos os posts de uma vez                                                        │
│   - Sem "carregar mais" ou scroll infinito                                                                 │
│   - Performance degrada com muitos posts                                                                   │
│ 11. Sem paginacao em endpoints criticos                                                                    │
│   - GET /api/achievements - sem limite                                                                     │
│   - GET /api/career - sem limite                                                                           │
│   - GET /api/teams/[slug]/members - sem limite                                                             │
│   - GET /api/comments/[id]/replies - offset-based (deveria ser cursor)                                     │
│ 12. confirm() do browser em vez de Dialog customizado                                                      │
│   - Usado em: delete post, delete comment, remove connection, delete event                                 │
│   - Nao e acessivel, nao segue design system                                                               │
│   - Substituir por AlertDialog do shadcn/ui                                                                │
│ 13. Empty states fracos e nao-acionaveis                                                                   │
│   - Feed: "Nenhum post" sem sugerir acoes                                                                  │
│   - Conexoes: sem sugestoes de pessoas                                                                     │
│   - Times: sem explicacao de como encontrar times                                                          │
│   - Mensagens: estado vazio no mobile nao mostra nada                                                      │
│   - Todos deveriam ter CTAs claros                                                                         │
│ 14. <img> em vez de Next.js <Image>                                                                        │
│   - post-card.tsx linha ~330: imagens de posts                                                             │
│   - profile-header.tsx linha ~140: banner                                                                  │
│   - Sem otimizacao, lazy loading, ou dimensionamento automatico                                            │
│ 15. Funcoes duplicadas em 10+ componentes                                                                  │
│   - getInitials() duplicada em: sidebar, header, post-card, comment-item, profile-header, etc.             │
│   - positionLabels / roleLabels duplicados em 5+ arquivos                                                  │
│   - Formatacao de tempo duplicada em 4+ componentes                                                        │
│   - Extrair para src/lib/utils.ts ou arquivos de constantes                                                │
│ 16. Sem tratamento de erro visual em muitas paginas                                                        │
│   - Sidebar: silenciosamente falha (mostra 0 em stats)                                                     │
│   - Header: fetch de perfil falha sem feedback                                                             │
│   - Post list: erro so no console.log                                                                      │
│   - Implementar estados de erro inline com retry                                                           │
│ 17. Filter/tab state nao persiste na URL                                                                   │
│   - Feed: filtro "seguindo"/"todos" nao esta na URL                                                        │
│   - Conexoes: tab ativa nao esta na URL                                                                    │
│   - Nao da pra compartilhar ou usar back/forward do browser                                                │
│ 18. Sem "Esqueci minha senha"                                                                              │
│   - Pagina de login nao tem link de recuperacao                                                            │
│   - Usuarios com senha esquecida ficam trancados fora                                                      │
│ 19. Sem verificacao de email                                                                               │
│   - Registro aceita qualquer email sem verificar                                                           │
│   - Permite contas fake com emails invalidos                                                               │
│ 20. Sem soft delete para usuarios                                                                          │
│   - DELETE /api/users/me faz hard delete imediato                                                          │
│   - Sem periodo de graca ou backup                                                                         │
│   - Posts/comentarios cascadeiam e desaparecem                                                             │
│                                                                                                            │
│ ---                                                                                                        │
│ P2 - MEDIO (Consistencia, Performance, Polish)                                                             │
│                                                                                                            │
│ 21. Polling agressivo sem WebSocket                                                                        │
│   - Mensagens: polling a cada 5s (message-list.tsx)                                                        │
│   - Conversas: polling a cada 30s                                                                          │
│   - Notificacoes: polling a cada 10s                                                                       │
│   - Alto consumo de recursos; migrar para WebSocket ou SSE                                                 │
│ 22. useCallback/useEffect com dependencias incorretas                                                      │
│   - Teams page: fetchTeams com deps faltando                                                               │
│   - Events page: similar                                                                                   │
│   - Search page: handleSearchWithQuery warning                                                             │
│   - Pode causar loops infinitos ou dados stale                                                             │
│ 23. Respostas de erro da API inconsistentes                                                                │
│   - Alguns retornam { error: string }, outros { message: string }                                          │
│   - Sem codigos de erro padronizados                                                                       │
│   - Frontend tem que lidar com formatos arbitrarios                                                        │
│ 24. Notification type e String, nao enum                                                                   │
│   - schema.prisma: type String permite valores arbitrarios                                                 │
│   - "POST_REPOSTED" criado mas nao documentado                                                             │
│   - Migrar para enum Prisma                                                                                │
│ 25. Cards inconsistentes: Card shadcn vs bento-card divs                                                   │
│   - Profile tabs usa Card components                                                                       │
│   - Resto da app usa div.bento-card / div.bento-card-static                                                │
│   - Design system inconsistente                                                                            │
│ 26. Acessibilidade: botoes sem aria-label                                                                  │
│   - Botao de menu (header)                                                                                 │
│   - Botao de busca (header link)                                                                           │
│   - Botoes de like/repost/comment (post-card)                                                              │
│   - Botoes de remover midia (create-post-card)                                                             │
│   - Botao de enviar mensagem (message-input)                                                               │
│   - Botao de notificacoes (notification-dropdown)                                                          │
│ 27. Acessibilidade: heading hierarchy quebrada                                                             │
│   - Multiplos <h1> em algumas paginas                                                                      │
│   - Niveis pulados (h2 direto para h4)                                                                     │
│   - Sem skip-to-content link                                                                               │
│ 28. Acessibilidade: falta <time> semantico                                                                 │
│   - Timestamps em posts, comentarios, mensagens usam <span>                                                │
│   - Deveria usar <time datetime="..."> para semantica e SEO                                                │
│ 29. Conversas duplicadas: constraint insuficiente                                                          │
│   - @@unique([participant1Id, participant2Id]) nao previne (B,A) sendo duplicata de (A,B)                  │
│   - API faz check mas DB nao garante                                                                       │
│ 30. Sem metadata SEO por pagina                                                                            │
│   - Apenas root layout tem metadata                                                                        │
│   - Paginas individuais nao tem titulo/descricao unicos                                                    │
│ 31. Espacamento e border-radius inconsistentes                                                             │
│   - Cards misturam p-4, p-5, p-6                                                                           │
│   - Border radius mistura rounded-xl, rounded-2xl, rounded-lg sem padrao claro                             │
│ 32. Self-update de role em times                                                                           │
│   - Membros podem mudar o proprio titulo/role sem restricao                                                │
│   - Permissoes sao bloqueadas, mas role nao                                                                │
│ 33. Upload: validacao de tipo de arquivo fraca                                                             │
│   - Apenas checa MIME type prefix (image/*, video/*)                                                       │
│   - Nao valida conteudo real do arquivo (magic bytes)                                                      │
│                                                                                                            │
│ ---                                                                                                        │
│ P3 - BAIXO (Nice-to-have)                                                                                  │
│                                                                                                            │
│ 34. Sem dark mode toggle (usa system preference apenas)                                                    │
│ 35. Sem busca dentro de conexoes/mensagens                                                                 │
│ 36. Sem mencoes (@usuario) em posts/comentarios                                                            │
│ 37. Sem hashtags                                                                                           │
│ 38. Sem salvar/favoritar posts                                                                             │
│ 39. Sem editar post (so delete)                                                                            │
│ 40. Sem indicador de digitacao nas mensagens                                                               │
│ 41. Sem emoji picker                                                                                       │
│ 42. Sem anexar arquivos nas mensagens                                                                      │
│ 43. Sem pagina de notificacoes (so dropdown)                                                               │
│ 44. Sem bloquear usuarios                                                                                  │
│ 45. Sem sistema de report/denuncia                                                                         │
│ 46. Sem exportar dados (LGPD)                                                                              │
│ 47. Sem vista de calendario para eventos                                                                   │
│ 48. Sem adicionar ao calendario (Google/Apple)                                                             │
│ 49. Sem RSVP/confirmacao de presenca em eventos                                                            │
│ 50. Sem suporte offline/PWA                                                                                │
│ 51. Sem atalhos de teclado                                                                                 │
│ 52. Sem i18n (texto hardcoded em portugues)                                                                │
│ 53. Sem virtual scrolling para listas longas                                                               │
│ 54. Sem 2FA                                                                                                │
│ 55. Sem .env.example                                                                                       │
│                                                                                                            │
│ ---                                                                                                        │
│ Arquivos Criticos a Modificar                                                                              │
│ ┌────────────────────────────────────────────┬────────────────────────────────────┐                        │
│ │                  Arquivo                   │              Tarefas               │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/middleware.ts                          │ #1                                 │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ prisma/schema.prisma                       │ #6, #24, #29                       │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/shared/sidebar.tsx          │ #9, #15                            │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/feed/post-card.tsx          │ #12, #14, #15, #26                 │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/feed/post-list.tsx          │ #10, #13, #16                      │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/feed/comment-item.tsx       │ #12, #15                           │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/feed/create-post-card.tsx   │ #26                                │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/shared/header.tsx           │ #15, #26                           │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/profile/profile-header.tsx  │ #14, #15                           │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/messages/message-list.tsx   │ #21                                │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/components/messages/message-input.tsx  │ #26                                │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/app/(main)/feed/page.tsx               │ #13, #17                           │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/app/(main)/connections/page.tsx        │ #12, #13, #17                      │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/app/(main)/events/page.tsx             │ #12, #22                           │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/app/(main)/teams/page.tsx              │ #22                                │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/app/(main)/search/page.tsx             │ #22                                │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/app/(auth)/login/page.tsx              │ #18                                │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ src/lib/utils.ts                           │ #15 (novas funcoes compartilhadas) │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ Todos os API routes que criam notificacoes │ #2                                 │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ /api/users (search)                        │ #3                                 │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ /api/users/me/avatar, /api/users/me/banner │ #4                                 │                        │
│ ├────────────────────────────────────────────┼────────────────────────────────────┤                        │
│ │ /api/upload                                │ #5, #33                            │                        │
│ └────────────────────────────────────────────┴────────────────────────────────────┘                        │
│ Verificacao                                                                                                │
│                                                                                                            │
│ Apos escrever o todo.md:                                                                                   │
│ 1. Revisar se todas as tarefas sao acionaveis e especificas                                                │
│ 2. Verificar que os arquivos referenciados existem    