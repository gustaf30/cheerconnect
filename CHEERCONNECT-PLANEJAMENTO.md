# CheerConnect - Rede Social para Cheerleading

## Planejamento Completo do TCC

---

## 1. Visão Geral do Projeto

### 1.1 Descrição
**CheerConnect** é uma rede social especializada para a comunidade de cheerleading, conectando atletas, técnicos, equipes e entusiastas. Similar ao LinkedIn, mas focada no universo do cheerleading brasileiro e internacional.

### 1.2 Problema a Resolver
- Falta de plataforma centralizada para networking no cheerleading
- Dificuldade de atletas encontrarem equipes e oportunidades
- Ausência de espaço para compartilhar conquistas e experiências
- Equipes com dificuldade de recrutar novos membros

### 1.3 Público-Alvo
- Atletas de cheerleading (iniciantes a profissionais)
- Técnicos e coreógrafos
- Equipes e academias
- Organizadores de eventos e competições
- Entusiastas e familiares

---

## 2. Stack Tecnológica Recomendada

### 2.1 Frontend + Backend (Full-stack)
| Tecnologia | Justificativa |
|------------|---------------|
| **Next.js 14+** | Framework React full-stack, App Router, Server Components |
| **TypeScript** | Tipagem estática, menos bugs, melhor DX |
| **Tailwind CSS** | Estilização rápida e responsiva |
| **shadcn/ui** | Componentes prontos e customizáveis |

### 2.2 Backend & Banco de Dados
| Tecnologia | Justificativa |
|------------|---------------|
| **PostgreSQL** | Banco relacional robusto, gratuito |
| **Prisma ORM** | Produtividade, migrations, type-safety |
| **NextAuth.js** | Autenticação completa (Google, email) |

### 2.3 Infraestrutura
| Tecnologia | Justificativa |
|------------|---------------|
| **Vercel** | Deploy gratuito para Next.js |
| **Supabase** | PostgreSQL gratuito + Storage |
| **Cloudinary** | Upload de imagens/vídeos (free tier) |

### 2.4 Ferramentas de Desenvolvimento
- **Git + GitHub** - Controle de versão
- **ESLint + Prettier** - Qualidade de código
- **Figma** - Prototipação (opcional)

---

## 3. Arquitetura do Sistema

### 3.1 Arquitetura Geral
```
┌─────────────────────────────────────────────────────────┐
│                      Cliente (Browser)                   │
│                    Next.js (React + SSR)                │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                    Next.js API Routes                    │
│              (Server Actions / Route Handlers)           │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                      Prisma ORM                          │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  PostgreSQL (Supabase)                   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Estrutura de Pastas (Next.js App Router)
```
cheerconnect/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (main)/
│   │   ├── feed/
│   │   ├── profile/
│   │   │   └── [username]/
│   │   ├── teams/
│   │   ├── events/
│   │   ├── search/
│   │   └── connections/
│   ├── api/
│   │   ├── auth/
│   │   ├── posts/
│   │   ├── users/
│   │   └── teams/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── feed/
│   ├── profile/
│   └── shared/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
└── public/
```

---

## 4. Modelagem de Dados (Schema Prisma)

### 4.1 Diagrama ER Simplificado
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────<│  TeamMember │>────│    Team     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │ 1:N                                   │ 1:N
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│    Post     │                         │    Event    │
└─────────────┘                         └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐
│   Comment   │
└─────────────┘

┌─────────────┐     ┌───────────────┐
│ Connection  │     │ CareerHistory │  (Currículo)
│(User<->User)│     │ (User -> Team)│
└─────────────┘     └───────────────┘
```

### 4.2 Schema Prisma Completo
```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ USUÁRIOS ============
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  username      String    @unique
  password      String?   // null se usar OAuth
  avatar        String?
  banner        String?
  bio           String?
  location      String?
  birthDate     DateTime?

  // Perfil de Cheerleading
  positions     Position[]  // Array: atleta pode ser Flyer E Base, coach pode ser atleta
  experience    Int?        // Anos de experiência
  skills        String[]    // Tumbling, Stunts, etc.
  achievements  Achievement[]

  // Currículo - histórico de times
  careerHistory CareerHistory[]

  // Relações
  posts         Post[]
  comments      Comment[]
  likes         Like[]
  teamMembers   TeamMember[]  // Equipes ATUAIS

  // Conexões (relacionamento N:N consigo mesmo)
  sentConnections     Connection[] @relation("ConnectionSender")
  receivedConnections Connection[] @relation("ConnectionReceiver")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum Position {
  FLYER
  BASE
  BACKSPOT
  FRONTSPOT
  TUMBLER
  COACH
  CHOREOGRAPHER
  JUDGE
  OTHER
}

// ============ CURRÍCULO (Histórico de Times) ============
model CareerHistory {
  id          String         @id @default(cuid())

  // Função no time
  role        CareerRole     // Atleta, Coach, Coreógrafo, etc.
  positions   Position[]     // Posições que exerceu nesse time

  // Período
  startDate   DateTime
  endDate     DateTime?      // null = ainda está no time
  isCurrent   Boolean        @default(false)

  // Detalhes
  teamName    String         // Nome do time (pode não estar cadastrado)
  teamId      String?        // Link opcional se o time existir no sistema
  team        Team?          @relation(fields: [teamId], references: [id], onDelete: SetNull)

  description String?        // Descrição livre: conquistas, responsabilidades
  location    String?        // Cidade/Estado do time

  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

enum CareerRole {
  ATHLETE
  COACH
  ASSISTANT_COACH
  CHOREOGRAPHER
  TEAM_MANAGER
  JUDGE
  OTHER
}

model Achievement {
  id          String   @id @default(cuid())
  title       String   // "Campeão Nacional 2023"
  description String?
  date        DateTime
  category    String?  // Competição, Certificação, etc.

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ============ CONEXÕES ============
model Connection {
  id         String           @id @default(cuid())
  status     ConnectionStatus @default(PENDING)

  senderId   String
  sender     User             @relation("ConnectionSender", fields: [senderId], references: [id], onDelete: Cascade)

  receiverId String
  receiver   User             @relation("ConnectionReceiver", fields: [receiverId], references: [id], onDelete: Cascade)

  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@unique([senderId, receiverId])
}

enum ConnectionStatus {
  PENDING
  ACCEPTED
  REJECTED
}

// ============ POSTS/FEED ============
model Post {
  id        String    @id @default(cuid())
  content   String
  images    String[]
  videoUrl  String?

  authorId  String
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)

  teamId    String?   // Post pode ser de uma equipe
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)

  comments  Comment[]
  likes     Like[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Comment {
  id        String   @id @default(cuid())
  content   String

  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
}

model Like {
  id        String   @id @default(cuid())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, postId])
}

// ============ EQUIPES ============
model Team {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  description String?
  logo        String?
  banner      String?
  location    String?
  foundedAt   DateTime?
  website     String?
  instagram   String?

  category    TeamCategory @default(ALLSTAR)
  level       String?      // Level 1-6, etc.

  members       TeamMember[]
  posts         Post[]
  events        Event[]
  careerEntries CareerHistory[]  // Usuários que passaram por este time

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

enum TeamCategory {
  ALLSTAR
  SCHOOL
  COLLEGE
  RECREATIONAL
  PROFESSIONAL
}

model TeamMember {
  id        String     @id @default(cuid())
  role      TeamRole   @default(ATHLETE)
  position  String?
  joinedAt  DateTime   @default(now())
  leftAt    DateTime?
  isActive  Boolean    @default(true)

  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  teamId    String
  team      Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
}

enum TeamRole {
  OWNER
  ADMIN
  COACH
  ATHLETE
}

// ============ EVENTOS ============
model Event {
  id          String    @id @default(cuid())
  name        String
  description String?
  location    String
  startDate   DateTime
  endDate     DateTime?
  type        EventType

  teamId      String?
  team        Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum EventType {
  COMPETITION
  TRYOUT
  CAMP
  WORKSHOP
  SHOWCASE
  OTHER
}
```

---

## 5. Funcionalidades Detalhadas

### 5.1 MVP (Escopo para TCC - 3 meses)

#### Autenticação
- [ ] Cadastro com email/senha
- [ ] Login com email/senha
- [ ] Login com Google (OAuth)
- [ ] Recuperação de senha
- [ ] Proteção de rotas

#### Perfil de Usuário
- [ ] Criar/editar perfil completo
- [ ] Upload de foto de perfil e banner
- [ ] Múltiplas posições (atleta pode ser Flyer + Base, coach pode ser atleta)
- [ ] Informações de cheerleading (experiência, skills)
- [ ] Adicionar conquistas/certificações
- [ ] Visualizar perfil de outros usuários

#### Currículo (Career History)
- [ ] Adicionar experiências em times (como atleta, coach, etc.)
- [ ] Período de atuação (data início/fim ou "atual")
- [ ] Posições exercidas em cada time
- [ ] Descrição de conquistas e responsabilidades
- [ ] Link opcional para página do time (se cadastrado)
- [ ] Exibição cronológica no perfil (estilo LinkedIn)

#### Feed/Timeline
- [ ] Criar posts (texto + imagens)
- [ ] Feed com posts das conexões
- [ ] Curtir posts
- [ ] Comentar em posts
- [ ] Excluir próprios posts/comentários

#### Conexões/Networking
- [ ] Enviar solicitação de conexão
- [ ] Aceitar/rejeitar solicitações
- [ ] Lista de conexões
- [ ] Remover conexão
- [ ] Sugestões de conexões

#### Busca
- [ ] Buscar usuários por nome/username
- [ ] Buscar equipes por nome
- [ ] Filtros básicos (posição, localização)

#### Equipes (Básico)
- [ ] Visualizar página de equipe
- [ ] Lista de membros da equipe
- [ ] Posts da equipe no feed

### 5.2 Funcionalidades Futuras (Pós-TCC)
- Mensagens diretas (chat)
- Vídeos no feed
- Sistema de notificações push
- Calendário de eventos
- Sistema de vagas/recrutamento
- Verificação de perfis
- App mobile (React Native)

---

## 6. Cronograma Sugerido (12 semanas)

### Fase 1: Setup e Fundação (Semanas 1-2)
| Tarefa | Descrição |
|--------|-----------|
| Setup do projeto | Next.js, TypeScript, Tailwind, shadcn/ui |
| Configurar banco | Supabase + Prisma schema |
| Autenticação | NextAuth.js com email e Google |
| Layout base | Header, sidebar, estrutura de páginas |

### Fase 2: Core Features (Semanas 3-6)
| Tarefa | Descrição |
|--------|-----------|
| Perfil de usuário | CRUD completo, upload de imagens |
| Currículo | CRUD do histórico de times |
| Sistema de posts | Criar, listar, curtir, comentar |
| Feed | Timeline com posts das conexões |
| Conexões | Solicitar, aceitar, listar conexões |

### Fase 3: Features Secundárias (Semanas 7-9)
| Tarefa | Descrição |
|--------|-----------|
| Busca | Buscar usuários e equipes |
| Páginas de equipe | Visualização básica |
| Conquistas | CRUD no perfil |
| Responsividade | Ajustes mobile |

### Fase 4: Polimento e Documentação (Semanas 10-12)
| Tarefa | Descrição |
|--------|-----------|
| Testes manuais | QA completo |
| Correção de bugs | Ajustes finais |
| Deploy produção | Vercel + domínio |
| Documentação TCC | Monografia, slides, apresentação |

---

## 7. Wireframes/Fluxos Principais

### 7.1 Telas Principais
```
┌──────────────────────────────────────────┐
│  LANDING PAGE                            │
│  - Hero section                          │
│  - Features                              │
│  - CTA: Cadastre-se / Entre              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  FEED (Página Principal Logado)          │
│  ┌────────┬────────────────┬──────────┐  │
│  │Sidebar │    Feed        │ Sugestões│  │
│  │- Perfil│    - Posts     │ - Conexões│ │
│  │- Menu  │    - Criar     │ - Equipes│  │
│  │        │                │          │  │
│  └────────┴────────────────┴──────────┘  │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  PERFIL DO USUÁRIO                       │
│  ┌──────────────────────────────────┐    │
│  │ Banner + Avatar                  │    │
│  │ Nome | @username | Posições      │    │
│  │ Bio | Localização                │    │
│  │ [Conectar] [Mensagem]            │    │
│  ├──────────────────────────────────┤    │
│  │ Tabs: Posts | Currículo | Conquistas│ │
│  │                                  │    │
│  │ Conteúdo da tab selecionada      │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  ABA CURRÍCULO (no Perfil)               │
│  ┌──────────────────────────────────┐    │
│  │ + Adicionar experiência          │    │
│  ├──────────────────────────────────┤    │
│  │ [Logo] Team Sharks               │    │
│  │        Atleta • Flyer, Base      │    │
│  │        Jan 2022 - Presente       │    │
│  │        São Paulo, SP             │    │
│  │        "Bicampeão estadual..."   │    │
│  ├──────────────────────────────────┤    │
│  │ [Logo] Cheer Academy             │    │
│  │        Coach                     │    │
│  │        Mar 2020 - Dez 2021       │    │
│  │        Rio de Janeiro, RJ        │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### 7.2 Fluxo de Conexão
```
Usuário A                    Usuário B
    │                            │
    │──── Envia solicitação ────>│
    │                            │
    │                   [Aceita / Rejeita]
    │                            │
    │<─── Notificação aceito ────│
    │                            │
    │     Agora são conexões     │
    │     (veem posts um do outro)│
```

---

## 8. APIs Principais

### 8.1 Rotas de API
```
POST   /api/auth/register     - Cadastro
POST   /api/auth/login        - Login
GET    /api/auth/me           - Usuário atual

GET    /api/users             - Listar/buscar usuários
GET    /api/users/:username   - Perfil do usuário
PATCH  /api/users/:id         - Atualizar perfil

GET    /api/career            - Listar histórico do usuário
POST   /api/career            - Adicionar experiência
PATCH  /api/career/:id        - Editar experiência
DELETE /api/career/:id        - Remover experiência

GET    /api/posts             - Feed de posts
POST   /api/posts             - Criar post
DELETE /api/posts/:id         - Deletar post
POST   /api/posts/:id/like    - Curtir post
DELETE /api/posts/:id/like    - Descurtir
POST   /api/posts/:id/comments - Comentar
DELETE /api/comments/:id      - Deletar comentário

GET    /api/connections       - Minhas conexões
POST   /api/connections       - Enviar solicitação
PATCH  /api/connections/:id   - Aceitar/rejeitar
DELETE /api/connections/:id   - Remover conexão

GET    /api/teams             - Listar equipes
GET    /api/teams/:slug       - Página da equipe
```

---

## 9. Considerações para o TCC

### 9.1 Justificativa Acadêmica
- Aplicação prática de engenharia de software
- Desenvolvimento full-stack moderno
- Modelagem de dados relacional
- Autenticação e segurança
- UX/UI responsivo
- Deploy em nuvem

### 9.2 Possíveis Capítulos da Monografia
1. Introdução (problema, objetivos, justificativa)
2. Fundamentação Teórica (redes sociais, cheerleading, tecnologias)
3. Metodologia (processo de desenvolvimento, ferramentas)
4. Desenvolvimento (arquitetura, implementação, telas)
5. Resultados (sistema funcionando, testes)
6. Conclusão (objetivos alcançados, trabalhos futuros)

### 9.3 Diferenciais do Projeto
- Nicho específico (cheerleading) pouco explorado
- Foco em networking profissional esportivo
- Perfis especializados com múltiplas posições e currículo
- Sistema de currículo similar ao LinkedIn
- Potencial de expansão real após TCC

---

## 10. Próximos Passos Imediatos

### Para começar o desenvolvimento:

1. **Criar repositório GitHub**
   ```bash
   mkdir cheerconnect
   cd cheerconnect
   git init
   ```

2. **Inicializar Next.js**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
   ```

3. **Instalar dependências**
   ```bash
   npm install prisma @prisma/client next-auth @auth/prisma-adapter
   npm install -D prisma
   npx prisma init
   ```

4. **Configurar Supabase**
   - Criar conta em supabase.com
   - Criar novo projeto
   - Copiar DATABASE_URL para .env

5. **Configurar shadcn/ui**
   ```bash
   npx shadcn-ui@latest init
   ```

---

## 11. Verificação do Plano

Para validar que o plano está adequado:

- [x] Stack tecnológica é apropriada para o prazo de 3 meses
- [x] MVP cobre as funcionalidades essenciais solicitadas
- [x] Modelagem de dados suporta as features planejadas (incluindo múltiplas posições e currículo)
- [x] Cronograma reserva tempo para documentação do TCC
- [x] Arquitetura é simples o suficiente para um desenvolvedor

---

**Documento criado para o TCC de Gustavo**
**Projeto: CheerConnect - Rede Social para Cheerleading**
