# CheerConnect

**Rede social para a comunidade de cheerleading.** Conecte-se com atletas, técnicos e equipes. Compartilhe conquistas, organize eventos e acompanhe sua carreira no esporte.

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=flat-square&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5 |
| Estilização | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Banco de Dados | PostgreSQL |
| ORM | Prisma 7 (com driver adapter `@prisma/adapter-pg`) |
| Autenticação | NextAuth.js (JWT + Prisma Adapter) |
| Upload de Mídia | Cloudinary |
| Animações | Framer Motion |
| Rate Limiting | Upstash Redis |
| Email | Resend |
| Testes | Vitest + Testing Library |
| Containerização | Docker + Docker Compose |
| Analytics | Vercel Analytics + Speed Insights |

---

## Funcionalidades

### Social

- **Feed** com filtros (seguindo / todos) e scroll infinito
- **Posts** com texto, imagens (até 4) ou vídeo (1 por post)
- **Likes** e **comentários** com respostas aninhadas
- **Reposts** com comentário opcional (não é possível repostar o próprio post nem repostar um repost)
- **Hashtags** (`#tag`) com link para busca e página de trending
- **Menções** (`@usuario`) com notificação automática
- **Edição e exclusão** de posts (com histórico de edições)

### Conexões

- Enviar, aceitar e rejeitar solicitações de conexão
- Conexões bidirecionais (PENDING → ACCEPTED / REJECTED)
- Gating: mensagens privadas só entre usuários conectados

### Mensagens

- Conversas privadas entre dois usuários
- Status de leitura por mensagem
- Atualização em tempo real via SSE (Server-Sent Events)
- Contador de mensagens não lidas no header

### Equipes

- Criação de equipes com nome, slug, descrição e logo
- **Papéis flexíveis** (texto livre: "Atleta", "Técnico", "Coreógrafo", etc.)
- **Sistema de permissões**: `hasPermission` (editar equipe, postar como equipe, convidar membros) e `isAdmin` (gerenciar permissões, excluir equipe)
- Convites com papel e nível de permissão pré-definidos
- Conquistas da equipe
- Posts como equipe
- Seguir equipes

### Eventos

- Criação de eventos com tipo (competição, workshop, camp, tryout, etc.)
- Detalhes com data, local, descrição e equipe organizadora
- Listagem com eventos futuros e passados

### Perfil

- Avatar e banner com crop de imagem (react-easy-crop)
- Múltiplas posições de cheerleading (Flyer, Base, Backspot, etc.)
- **Currículo**: histórico de carreira com equipes e datas
- **Conquistas pessoais**: títulos, prêmios e certificações
- Bio e informações de contato

### Notificações

- Atualização em tempo real via SSE
- **10+ tipos**: like, comentário, conexão, menção, convite de equipe, mensagem, etc.
- Preferências configuráveis por tipo (ativar/desativar individualmente)
- Marcar como lida (individual e em lote)

### Trending

- Hashtags mais populares
- Página dedicada (`/trending`) com ranking

### Busca

- Busca de usuários por nome e username
- Busca de posts por conteúdo
- Busca por hashtag

### Configurações

- Alterar senha e username
- Preferências de notificação (por tipo)
- Configurações de privacidade

### Segurança

- **Rate limiting** com Upstash Redis (fallback para memória)
- **Bloqueio de usuários**
- **Sistema de denúncias** (reports)
- Middleware de autenticação protegendo rotas
- Validação e sanitização de inputs com Zod

---

## Quick Start

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Docker](https://www.docker.com/) (para PostgreSQL)

### Configuração

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/cheerconnect.git
cd cheerconnect

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais (veja a seção "Variáveis de Ambiente")

# 4. Inicie o PostgreSQL
docker compose up -d

# 5. Execute as migrações
npx prisma migrate dev

# 6. Popule com dados de teste
npx prisma db seed

# 7. Inicie o servidor
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

**Conta de teste**: `gustavo@test.com` / `123456`

### Docker (app + banco)

```bash
docker compose up -d          # Inicia app + PostgreSQL
docker compose logs -f app    # Acompanha logs da aplicação
docker compose down           # Para os containers
```

---

## Comandos de Desenvolvimento

```bash
# Servidor
npm run dev          # Inicia servidor de desenvolvimento (localhost:3000)
npm run build        # Build para produção
npm run start        # Inicia servidor de produção
npm run lint         # Executa ESLint

# Testes
npm run test         # Vitest em modo watch
npm run test:run     # Vitest execução única

# Banco de dados (Prisma)
npx prisma migrate dev       # Cria e executa migrações
npx prisma generate          # Regenera o Prisma Client
npx prisma studio            # GUI para inspecionar o banco
npx prisma db seed            # Popula com dados de teste

# Docker
docker compose up -d                                          # Inicia containers
docker compose down                                           # Para containers
docker compose exec app npx prisma migrate deploy             # Migrações em container
```

---

## Estrutura do Projeto

```
cheerconnect/
├── prisma/
│   ├── schema.prisma              # Schema do banco de dados (30+ modelos)
│   ├── seed.ts                    # Script de seed com dados de teste
│   └── migrations/                # Migrações do banco
├── public/                        # Arquivos estáticos
├── src/
│   ├── app/
│   │   ├── (auth)/                # Páginas públicas de autenticação
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── verify-email/
│   │   ├── (main)/                # Páginas protegidas (requer autenticação)
│   │   │   ├── connections/
│   │   │   ├── events/
│   │   │   ├── feed/
│   │   │   ├── messages/
│   │   │   ├── notifications/
│   │   │   ├── post/
│   │   │   ├── profile/
│   │   │   ├── search/
│   │   │   ├── settings/
│   │   │   ├── teams/
│   │   │   └── trending/
│   │   ├── api/                   # API Routes
│   │   │   ├── achievements/
│   │   │   ├── auth/              # NextAuth + registro + verificação
│   │   │   ├── career/
│   │   │   ├── comments/
│   │   │   ├── connections/
│   │   │   ├── conversations/
│   │   │   ├── cron/
│   │   │   ├── events/
│   │   │   ├── feedback/
│   │   │   ├── health/
│   │   │   ├── messages/
│   │   │   ├── notifications/
│   │   │   ├── posts/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   ├── tags/
│   │   │   ├── teams/
│   │   │   ├── upload/
│   │   │   └── users/
│   │   ├── globals.css            # Estilos globais + design system
│   │   ├── layout.tsx             # Layout raiz (fontes, providers)
│   │   └── page.tsx               # Landing page
│   ├── components/
│   │   ├── feed/                  # Feed e posts
│   │   ├── messages/              # UI de mensagens
│   │   ├── profile/               # Componentes do perfil
│   │   ├── providers/             # Providers (session, theme)
│   │   ├── shared/                # Componentes reutilizáveis
│   │   ├── teams/                 # Páginas de equipe
│   │   └── ui/                    # Componentes base (shadcn/ui)
│   ├── hooks/                     # Custom hooks
│   │   ├── use-animated-number.ts
│   │   ├── use-infinite-scroll.ts
│   │   ├── use-is-mounted.ts
│   │   ├── use-keyboard-height.ts
│   │   └── use-realtime.tsx       # SSE para atualizações em tempo real
│   ├── lib/                       # Utilitários e configurações
│   │   ├── auth.ts                # Configuração NextAuth
│   │   ├── cloudinary.ts          # SDK Cloudinary
│   │   ├── constants.ts           # Constantes (senha, limites)
│   │   ├── parsers.ts             # Extração de hashtags e menções
│   │   ├── prisma.ts              # Singleton do Prisma Client
│   │   ├── rate-limit.ts          # Rate limiting (Upstash / in-memory)
│   │   └── ...                    # Outros utilitários
│   ├── middleware.ts              # Proteção de rotas
│   ├── test/                      # Helpers de teste
│   └── types/                     # Tipos TypeScript
├── docker-compose.yml
├── Dockerfile
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (ou copie de `.env.example`):

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | Sim | URL de conexão PostgreSQL |
| `NEXTAUTH_SECRET` | Sim | Chave secreta para JWT do NextAuth |
| `NEXTAUTH_URL` | Não* | URL base da aplicação (`http://localhost:3000` em dev) |
| `CLOUDINARY_CLOUD_NAME` | Sim | Cloud name do Cloudinary (upload de mídia) |
| `CLOUDINARY_API_KEY` | Sim | API key do Cloudinary |
| `CLOUDINARY_API_SECRET` | Sim | API secret do Cloudinary |
| `GOOGLE_CLIENT_ID` | Não | Client ID para login com Google |
| `GOOGLE_CLIENT_SECRET` | Não | Client secret para login com Google |
| `UPSTASH_REDIS_REST_URL` | Não | URL do Upstash Redis (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Não | Token do Upstash Redis |
| `RESEND_API_KEY` | Não | API key do Resend (envio de emails) |

\* Auto-detectada na Vercel via `VERCEL_URL`.

Variáveis opcionais possuem fallback: rate limiting usa memória, email loga no console, e Google OAuth simplesmente não aparece na tela de login.

---

## Testes

O projeto usa [Vitest](https://vitest.dev/) com [Testing Library](https://testing-library.com/).

```bash
npm run test         # Modo watch (re-executa ao salvar)
npm run test:run     # Execução única
```

Estrutura de testes:

```
src/
├── __tests__/              # Testes unitários (lib, utils)
├── app/api/__tests__/      # Testes de API routes
└── test/                   # Helpers e setup de teste
```

---

## Deploy

### Stack de Produção

| Serviço | Provedor |
|---------|----------|
| Frontend + API | [Vercel](https://vercel.com) (serverless) |
| Banco de Dados | [Supabase](https://supabase.com) (PostgreSQL) |
| Upload de Mídia | [Cloudinary](https://cloudinary.com) |
| Rate Limiting | [Upstash](https://upstash.com) (Redis) |
| Email | [Resend](https://resend.com) |

### Notas Importantes

- **Supabase**: Use a URL do pooler em **Transaction mode** (porta `6543`), **NÃO** Session mode (porta `5432`). Session mode causa `MaxClientsInSessionMode` em serverless.
  ```
  postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- **Senha com caracteres especiais**: URL-encode caracteres como `$` → `%24` na DATABASE_URL.
- **Migrações**: Execute `npx prisma migrate deploy` contra o banco de produção antes do primeiro deploy.
- **Vercel**: Desative "Vercel Authentication" em Settings → Deployment Protection para acesso público.

---

## Dados de Teste (Seed)

O seed (`npx prisma db seed`) popula o banco com:

- **10 usuários** (atletas, técnicos, coreógrafos, juízes) — senha: `123456`
- **17 conexões** (ACCEPTED e PENDING)
- **5 equipes** (Allstar, College, Recreational, School, Professional)
- **15 membros** de equipe com diferentes papéis
- **23 posts** (incluindo reposts, posts de equipe, com imagens/vídeos)
- **28 comentários** com respostas
- **35 likes** em posts e comentários
- **8 eventos** (passados e futuros)
- **6 conversas** com mensagens
- **17 notificações**
- **4 convites** de equipe pendentes

---

## Licença

Projeto de TCC — Todos os direitos reservados.
