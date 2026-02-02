# CheerConnect

Rede social para a comunidade de cheerleading. Conecte-se com atletas, técnicos e equipes.

## Stack Tecnológica

- **Framework**: Next.js 16 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS + shadcn/ui
- **Banco de Dados**: PostgreSQL
- **ORM**: Prisma
- **Autenticação**: NextAuth.js

## Funcionalidades

- Autenticação (email/senha e Google OAuth)
- Perfil de usuário com posições de cheerleading
- Histórico de carreira (currículo)
- Feed de publicações
- Sistema de conexões
- Busca de usuários
- Páginas de equipes
- Calendário de eventos

## Configuração do Ambiente

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="sua-chave-secreta"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

4. Execute as migrações do banco:

```bash
npx prisma migrate dev
```

5. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/          # Páginas de autenticação
│   │   ├── login/
│   │   └── register/
│   ├── (main)/          # Páginas principais (autenticadas)
│   │   ├── feed/
│   │   ├── profile/
│   │   ├── connections/
│   │   ├── teams/
│   │   ├── events/
│   │   └── search/
│   └── api/             # API Routes
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   ├── feed/            # Componentes do feed
│   ├── profile/         # Componentes do perfil
│   └── shared/          # Componentes compartilhados
├── lib/
│   ├── auth.ts          # Configuração NextAuth
│   ├── prisma.ts        # Cliente Prisma
│   └── utils.ts         # Utilitários
└── types/               # Tipos TypeScript
```

## Deploy

O projeto está configurado para deploy na Vercel com PostgreSQL do Supabase.

## Licença

Projeto de TCC - Todos os direitos reservados.
