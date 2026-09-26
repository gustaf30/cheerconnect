# ADR 004: Prontidão para o Prisma 8

## Status

Aceito. Adoção do runtime adiada até o Prisma 8 chegar à estabilidade.

## Contexto

A PRISMA-001 do `GOAL.md` pedia avaliar a CLI RC do Prisma 8 em branch isolada, sem
alterar produção, documentando breaking changes e rollback. O critério original —
"instalar `prisma`/`@prisma/client` 8 RC" — partia da premissa de que o runtime do
Prisma 8 seria o `@prisma/client`. **Essa premissa está errada**, e a avaliação
abaixo foi feita para descobrir o que realmente existe.

Versões em uso hoje: `prisma` 7.10.0, `@prisma/client` 7.10.0,
`@prisma/adapter-pg` 7.10.0, com 30 models, 30 migrations, RLS habilitada e um papel
dedicado de runtime (`cheerconnect_app`).

## O que foi verificado

Avaliação feita em um `git worktree` descartável (`spike/prisma8-cli`), sobre a CLI
`prisma@8.0.0-rc.17`, sem instalar nada no projeto principal. `master` não foi
alterado.

### Estado real dos pacotes

| pacote | `latest` | linha 8.x |
|---|---|---|
| `prisma` (CLI) | 7.10.0 | `8.0.0-rc.17` |
| `@prisma/orm-postgres` (facade) | **`8.0.0-rc.12`** | RC disponível |
| `@prisma/client` | 7.10.0 | apenas `8.1.0-dev.1..7` |
| `@prisma/adapter-pg` | 7.10.0 | apenas `8.1.0-dev.7` |

O `@prisma/client` não tem RC 8 porque **ele deixa de ser o pacote do runtime**: no
Prisma 8 cada banco tem uma facade própria, e o Postgres passa a ser
`@prisma/orm-postgres`. Logo, "não existe RC" não era a verdade completa — existe,
mas em outro pacote, com outra API.

### O que funcionou

- `contract emit` sobre o schema real de 30 models: **funcionou**. Emitiu
  `contract.json` e `contract.d.ts` (8.618 linhas, com todos os models) e três
  hashes (`storageHash`, `executionHash`, `profileHash`).
- O scaffold oficial `prisma orm init --from-prisma7-schema` reconhece o schema
  existente como fonte do contract e gera a configuração nova.
- A CLI lê o mesmo nome de arquivo, `prisma.config.ts`.

### Breaking changes encontrados

1. **Configuração reescrita.** O config v7 (`defineConfig` de `prisma/config`) é
   recusado com `CLI.CONFIG_MISSING_MARKER`: a v8 exige `definePrismaConfig` de
   `@prisma/cli-engine`, que grava um marcador de versão. As chaves passam a ser
   `adapter`, `family`, `target` e `contract`, todas objetos — nada se parece
   com `schema`/`migrations`/`datasource`.
2. **`generate` não existe.** O `postinstall`, o CI e o `Dockerfile` dependem dele.
   O equivalente é `contract emit`, que grava o client gerado dentro da árvore de
   fontes (`src/prisma/`), e não em `node_modules`.
3. **Os comandos da ORM desceram um nível.** `validate` sumiu e não tem equivalente
   direto; `migrate deploy` virou `db migrate` com `--db <url>`; `migrate dev` virou
   `migration plan`.
4. **Saída em JSON.** A CLI v8 emite envelopes JSON por padrão, com `--format
   human|json|markdown` para trocar. Scripts que fazem parse de texto quebram.
5. **Caminho de migrations mudou.** `migration list` reportou
   `migrations/app/`, e o `migration check` passou sem enxergar nada. As 30
   migrations em `prisma/migrations/` não são visíveis por padrão.
6. **API de query incompatível.** v7: `prisma.user.findUnique({ where })`. v8:
   `db.orm.public.User.where({ email }).first()`, com o client criado por
   `postgres<Contract>({ contractJson, url })` em vez de
   `new PrismaClient({ adapter: new PrismaPg(pool) })`.
7. **PostgreSQL 15 ou superior**, e o CLI só conecta ao banco com consentimento
   explícito.

## Custo de migração medido

- **392 call sites de Prisma em 77 arquivos**, concentrados em `user` (78),
  `team` (32) e `mediaAsset` (27). A API incompatível do item 6 exige reescrever
  todos, não só adaptar imports.
- `@prisma/adapter-pg` e o `pg.Pool` desaparecem do caminho do cliente. Como o
  RLS depende de conectar com o papel `cheerconnect_app`, **a forma de garantir
  esse papel precisa ser reinventada e revalidada** — a suíte `test:rls` teria de
  ser reescrita, não apenas executada.
- Os hashes do contract mudam entre versões de RC, então migrar agora significa
  reemitir e versionar artefatos que ainda vão mudar.

## Decisão

Não adotar o runtime agora. Permanecer no Prisma 7.10.0.

A decisão **não** é "o Prisma 8 é incompatível" — o schema real compila sem
problema. É que a adoção, hoje, custa uma reescrita de 392 call sites mais a
reconstrução do controle de papel do RLS, sobre artefatos que ainda mudam a cada RC.

## O que destrava a reavaliação

1. `@prisma/orm-postgres` em versão estável (não RC).
2. Prisma 8 fora do RC, para que `contract.json` pare de mudar de hash.
3. Um padrão documentado para o papel de runtime do RLS na nova API.
4. Requisito de runtime: Node 22.12+ (README). Nao ha campo `engines` no package.json, o Dockerfile usa `node:22-alpine` sem minor fixado e o CI pede `node-version: 22` (o projeto usa 24.15.0 localmente, mas o CI usa
   `node-version: 22` sem fixar minor).

## Rollback

Não aplicável: nada foi alterado no projeto principal. O worktree
`spike/prisma8-cli` e o banco efêmero do spike são descartáveis por construção.

## Consequências

- O `package.json` continua com `prisma@7.10.0`, `@prisma/client@7.10.0` e
  `@prisma/adapter-pg@7.10.0`, e o fluxo atual (`prisma validate`, `generate`,
  `migrate deploy`) segue intacto.
- Fica registrado que o caminho oficial é a coexistência: o Prisma 7 continua
  dono do schema e das migrations, e as rotas migram uma a uma para o client novo.
  Quando a decisão for revista, esse é o caminho a seguir, não uma troca de uma
  vez.
