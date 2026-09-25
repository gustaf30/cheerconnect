# Objetivo e estado da rodada

Auditar e endurecer o CheerConnect, executar o backlog técnico não acadêmico, validar a aplicação em produção e preservar todas as alterações locais existentes. Nenhum commit foi criado.

## Critérios de aceite técnico

- Lint estrito, typecheck, testes, cobertura, OpenAPI, Prisma, build e `npm audit` aprovados.
- E2E público e autenticado executados; qualquer skip padrão fica justificado.
- E-mail verificado obrigatório e exclusão protegida por reautenticação.
- Upload Cloudinary com ownership, validação, exclusão idempotente, reconciliação e backfill seguro.
- PrivacyRequest com leases, retry, limite de tentativas e rejeição de solicitações antigas sem prova.
- RLS habilitada nas tabelas públicas e runtime em role dedicado sem `BYPASSRLS`.
- Bloqueios, preferências, datas, paginação, streams, acessibilidade e cron validados.

## Progresso concluído

- [x] Auditoria de segurança, privacidade, permissões, LGPD, uploads, rate limiting e proxy.
- [x] Verificação de e-mail no cadastro, login, OAuth, sessão, APIs e streams.
- [x] Challenge universal de reautenticação por e-mail, com hash, expiração, vínculo de `tokenVersion` e uso único.
- [x] Exclusão imediata e `PrivacyRequest DELETE` protegidas por username, e-mail verificado e challenge.
- [x] 30 migrations Prisma aplicadas; `prisma migrate status` up to date.
- [x] RLS habilitada nas 30 tabelas; policies restritas ao role `cheerconnect_app`; role runtime sem `BYPASSRLS` configurado na Vercel.
- [x] Runner de integração PostgreSQL com schema temporário, migrations isoladas, 3 testes destrutivos e cleanup.
- [x] Cloudinary real validado com upload, metadados, ownership de pasta, remoção e segunda remoção idempotente.
- [x] Reconciliação de assets remotos, cleanup de assets falhos e backfill idempotente de posts/perfis legados.
- [x] Cron real autenticado por `CRON_SECRET`, com métricas, logs estruturados, leases, retry, expiração e retenção.
- [x] Preferência `MENTION` exposta na UI e contrato PATCH completo.
- [x] Bloqueio/desbloqueio navegável, limpeza de convites e filtros de bloqueio em equipes, eventos, conquistas e streams.
- [x] Datas estritas, ordem de career/eventos, round-trip local de timezone e paginação por cursor corrigida.
- [x] Eventos realtime publicados para likes, comentários, menções, conexões, reposts e convites.
- [x] Streams SSE com single-flight, cursor persistente, retry, reatividade a rede/visibilidade e polling de fallback.
- [x] Testes unitários, API, componentes, concorrência, PostgreSQL, RLS, Cloudinary e realtime adicionados.
- [x] Axe executado em landing, autenticação e módulos autenticados; violações corrigidas.
- [x] Health check enriched e métricas de maintenance adicionados.
- [x] Prisma 8.0-rc avaliado; a nova CLI não expõe `validate` e não é compatível com o fluxo ORM atual, portanto a aplicação foi adiada.

## Evidências atuais

- Produção: `https://cheerconnect.vercel.app`.
- Último deploy promoteido: `https://cheerconnect-6ktg4h9c3-gustavos-projects-40107fba.vercel.app`.
- Build Vercel: aprovado; alias de produção ativo.
- Health: `200`, PostgreSQL `ok`.
- Cron manual autenticado: `200`, resposta JSON com contadores de maintenance.
- E2E com usuário temporário verificado: 6/6 aprovados; usuário removido após a execução.
- E2E sem credenciais: 5 aprovados e 1 skip justificado.
- Testes: 41 arquivos aprovados, 3 ignorados; 316 testes aprovados, 6 ignorados.
- Cobertura: 62,96% statements, 50,36% branches, 62,50% functions e 65,07% lines.
- PostgreSQL isolado: 3/3 testes aprovados.
- RLS: 2/2 testes aprovados.
- Cloudinary real: 1/1 teste aprovado.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- OpenAPI: 68 paths válido.
- Prisma schema/format: válidos.
- Lint e typecheck: aprovados.

## Backlog restante

### TCC — explicitamente fora do escopo

- [ ] Resultados da pesquisa com a comunidade.
- [ ] Comparação com Instagram, Facebook e WhatsApp.
- [ ] Matriz de rastreabilidade requisito → implementação → teste → evidência.
- [ ] Estatísticas completas do SUS e citações anonimizadas.

### Tasks técnicas adicionadas

- [x] **REDIS-001 — Realtime distribuído:** substituir o `EventEmitter` local por Redis Streams (com fallback local), filtrar eventos por usuário, aplicar retenção com `XTRIM` e validar com duas instâncias/regiões.
  - Dependências: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
  - Aceite: eventos entregues entre instâncias, reconexão sem perda e comportamento funcional quando Redis estiver indisponível.
  - Implementado em `src/lib/redis.ts` (cliente compartilhado) e `src/lib/realtime-bus.ts` (stream `cheerconnect:realtime`, `XADD` com `MAXLEN ~`, leitura por `XREAD` a partir de um cursor). As rotas SSE não mudaram: o pump por instância republica no mesmo `EventEmitter`, então os filtros existentes por usuário/conversa continuam válidos.
  - O Redis é otimização de latência entre instâncias; a correção e a reconexão sem perda continuam vindo do polling no banco já existente em cada rota.
  - Evidência: `npm run test:realtime` (8/8 contra Redis real) e `npm run test:realtime:cross-instance` (2 processos recebem um evento publicado por um terceiro processo; com o Redis inacessível a entrega local é preservada). Verificações via `docker-compose.realtime-test.yml`.
  - Variáveis: `REALTIME_BUS_TRANSPORT` (`memory` | `redis`, padrão automático), `REALTIME_SIGNAL_INTERVAL_MS`, `REALTIME_STREAM_MAXLEN`, `REALTIME_STREAM_KEY`.
- [ ] **LOAD-001 — Testes de carga e resiliência:** suíte executada; **critério de p95 de leitura/mutação não atingido** (pendência real, ver abaixo).
  - Critérios: p95 `< 500 ms`, erros `< 1%`, sem vazamento de conexões e comportamento definido em queda de Redis/rede.
  - Seed e dados de teste devem ser isolados; nada destrutivo em produção.
  - Harness: `npm run test:load` sobe `docker-compose.load.yml` (Postgres em tmpfs + imagem de produção construída a partir do `Dockerfile`), semeia via `scripts/load-seed.mjs` e roda k6 + soak de SSE. Projeto compose isolado (`cheerconnect-load`), então não encosta nos containers de desenvolvimento.
  - **Atendidos:** erros de leitura `0,00%`; logins aceitos `100%`; limitador de taxa comprovado por sonda (`100%`); SSE sem vazamento (10/10 conexões abertas e liberadas, handles `10 → 0` no abort); liveness `100%` com e sem Redis.
  - **Não atendido:** p95 de leitura e de mutação ficam acima de 500 ms (medições de 90 s a 2 min, 25 req/s, 30 usuários).
  - Latência de autenticação fica em ~1,5 s, coerente com o custo do bcrypt (custo 12).
  - **Defeito de resiliência encontrado e corrigido:** o `@upstash/redis` faz 5 retries com backoff exponencial por padrão. Com o Redis fora, cada requisição passava por rate limit segurava ~4,3 s antes de cair no fallback em memória (medido: 4329 ms → 61 ms com retry limitado a 1 tentativa). Isso elevava o p95 de autenticação de 4786 ms para ~1550 ms. Corrigido em `src/lib/redis.ts`.
  - **Gargalo parcial medido:** o pool do Prisma estava fixo em `max: 10`. Subir para 30 reduziu leitura de 1598 ms → 984 ms (−38%) e mutações de 2802 ms → 2095 ms (−25%), confirmando o pool como causa parcial, não total. O restante está no stack de renderização do Next.js neste ambiente.
  - O pool agora é configurável por `DATABASE_POOL_MAX`, com padrão **mantido em 10** para não alterar o comportamento de produção sem medir o `max_connections` real do banco.
  - **Variância alta entre execuções** (leitura p95 entre 117 ms e 1790 ms em rodadas equivalentes). O ambiente é Docker Desktop local com CPU compartilhada, então os números servem para detectar regressão relativa, não como absolutos, e não são representativos da latência na Vercel. Isolar a máquina ou rodar em runner dedicado é pré-requisito para medir p95 de forma confiável.
- [ ] **PRISMA-001 — Compatibilidade Prisma 8 RC:** avaliar a CLI RC em branch isolada, sem alterar produção.
  - Critérios: instalar `prisma`/`@prisma/client` 8 RC, regenerar client, executar migrations e testes em schema temporário, documentar breaking changes e rollback.
  - Não aplicar enquanto `prisma validate`/adapter não forem compatíveis com o fluxo atual.

### Riscos técnicos residuais

- [ ] **Autenticação quebra em deploy self-hosted por HTTP.** Com `NODE_ENV=production` e `NEXTAUTH_URL` em `http://`, o `auth.ts` grava o cookie de sessão com prefixo `__Secure-` (`useSecureCookies` é forçado para `true`) enquanto o `getToken` do `src/proxy.ts` deriva o nome do cookie do protocolo do `NEXTAUTH_URL` e procura `next-auth.session-token` — sem prefixo. Resultado: **toda rota autenticada responde 401**. Na Vercel (HTTPS) não aparece, por isso produção está saudável. O `docker-compose.yml` do projeto cai exatamente nesse caso. Correção possível: derivar `useSecureCookies` do `NEXTAUTH_URL`, ou passar `secureCookie` explicitamente ao `getToken`.
- [ ] Ampliar E2E para todos os fluxos destrutivos de publicação, conexão, mensagem, equipe, evento e exclusão.
- [x] Validar o comportamento do realtime distribuído sob múltiplas instâncias após a REDIS-001.

## Comandos

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:coverage
npm run test:db
npm run test:rls
npm run test:cloudinary
npm run docs:sync
npm run docs:validate
npm run prisma:validate
npx prisma format --check
npm audit --audit-level=moderate
npm run build
npm run test:e2e
```

`npm run test:db` cria e remove um schema PostgreSQL temporário. `npm run test:rls` consulta o catálogo RLS. `npm run test:cloudinary` executa um smoke real e descarta o asset temporário. O E2E autenticado usa `E2E_EMAIL` e `E2E_PASSWORD` somente no ambiente de execução.
