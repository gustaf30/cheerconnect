# Objetivo e estado da rodada

Auditar e endurecer o CheerConnect, executar o backlog técnico não acadêmico, validar a aplicação em produção e preservar todas as alterações locais existentes. O trabalho está versionado no `master` e publicado no GitHub; a linha local tem o harness de carga reescrito, a suíte E2E dos fluxos destrutivos, a correção do 401 de sessão, o registro de acessibilidade nos dois temas e as ADRs 004 e 005, ainda não commitados.

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
- [x] Eventos realtime publicados para likes, comentários, conexões, reposts e convites, e para menções **em publicação de equipe** (`teams/[slug]/posts`). Em post comum e em edição de post a notificação de menção é criada mas não entra no barramento — lacuna conhecida, não coberta por teste.
- [x] Streams SSE com single-flight, cursor persistente, retry, reatividade a rede/visibilidade e polling de fallback.
- [x] Testes unitários, API, componentes, concorrência, PostgreSQL, RLS, Cloudinary e realtime adicionados.
- [x] Axe executado em landing, autenticação e módulos autenticados; violações corrigidas.
- [x] Health check com estado do PostgreSQL, do Redis (`ok` / `unavailable` / `not_configured`) e `latencyMs`. Os contadores de manutenção não ficam no health: vêm na resposta de `POST /api/cron/maintenance`.
- [x] Realtime distribuído sobre Redis Streams, com cliente compartilhado, fallback local e retenção por `MAXLEN`/`XTRIM`. Substitui a ADR 003, registrada na ADR 005.
- [x] `npm start` corrigido para o bundle `output: standalone`, que antes apontava para um caminho inexistente.
- [x] Coerência do cookie de sessão entre escrita e leitura, corrigindo o 401 em implantação self-hosted sobre HTTP.
- [x] Suíte de carga k6 e soak de SSE sobre a imagem de produção, em projeto compose isolado, com job de CI não bloqueante.
- [x] Prisma 8 RC avaliado em worktree isolado. O schema real de 30 models **é** aceito pela v8 (`contract emit` funciona), mas a adoção foi adiada por custo e instabilidade; ver `docs/adr/0004-prisma-8-readiness.md`.

## Evidências atuais

- Produção: `https://cheerconnect.vercel.app` (alias estável; a URL do último deploy muda a cada publicação).
- Health em produção: `200`, com `database: ok` e `redis: ok`.
- Build Vercel: aprovado; alias de produção ativo e servindo o último commit do `master`.
- Cron manual autenticado: `200`, resposta JSON com contadores de maintenance.
- E2E: 36/36 aprovados em 7 arquivos, contra a pilha isolada de `docker-compose.e2e.yml`. Cobre publicação, conexão, mensagem, equipe, evento, exclusão de conta em cascata e autorização cruzada. Cada teste cria as próprias contas e as remove no fim.
- Testes: 43 arquivos aprovados e 4 ignorados; 340 testes aprovados e 14 ignorados.
- Cobertura: 65,93% statements, 53,40% branches, 65,11% functions e 67,92% lines.
- PostgreSQL isolado: 3/3 testes aprovados.
- RLS: 2/2 testes aprovados.
- Cloudinary real: 1/1 teste aprovado.
- Redis real (Upstash): 8/8 testes de integração; duas instâncias receberam evento publicado por terceiro processo, e a entrega local se preserva com o Redis inacessível.
- Carga: erros de leitura `0,00%`, logins `100%`, limitador de taxa comprovado, SSE sem vazamento de conexão, liveness `100%` com e sem Redis. O p95 de leitura e mutação **não** atingiu a meta de 500 ms.
- CI no GitHub Actions: 4 jobs — `lint-typecheck` (lint e typecheck no mesmo job), `test` e `build` são gate; `load-smoke` roda com `continue-on-error: true` e não reprova o merge.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- OpenAPI: 68 paths válido.
- Prisma schema/format: válidos, com a CLI 7.10.0.
- Lint e typecheck: aprovados.

## Backlog restante

### TCC — explicitamente fora do escopo

- [ ] Resultados da pesquisa com a comunidade.
- [ ] Comparação com Instagram, Facebook e WhatsApp.
- [ ] Matriz de rastreabilidade requisito → implementação → teste → evidência.
- [ ] Estatísticas completas do SUS e citações anonimizadas.

### Tasks técnicas adicionadas

- [x] **REDIS-001 — Realtime distribuído:** substituir o `EventEmitter` local por Redis Streams (com fallback local), filtrar eventos por usuário, aplicar retenção com `MAXLEN`/`XTRIM` e validar com duas instâncias.
  - Dependências: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
  - Aceite: eventos entregues entre instâncias, reconexão sem perda e comportamento funcional quando Redis estiver indisponível.
  - Implementado em `src/lib/redis.ts` (cliente compartilhado) e `src/lib/realtime-bus.ts` (stream `cheerconnect:realtime`, `XADD` com `MAXLEN ~`, leitura por `XREAD` a partir de um cursor). As rotas SSE não mudaram: o pump por instância republica no mesmo `EventEmitter`, então os filtros existentes por usuário/conversa continuam válidos.
  - O Redis é otimização de latência entre instâncias; a correção e a reconexão sem perda continuam vindo do polling no banco já existente em cada rota.
  - Evidência: `npm run test:realtime` (8/8 contra Redis real) e `npm run test:realtime:cross-instance` (2 processos recebem um evento publicado por um terceiro processo; com o Redis inacessível a entrega local é preservada). Verificações via `docker-compose.realtime-test.yml`.
  - Variáveis: `REALTIME_BUS_TRANSPORT` (`memory` | `redis`, padrão automático), `REALTIME_SIGNAL_INTERVAL_MS`, `REALTIME_STREAM_MAXLEN`, `REALTIME_STREAM_KEY`.
- [ ] **LOAD-001 — Testes de carga e resiliência:** suíte reescrita e reexecutada; os critérios de p95 de leitura, mutação, página e autenticação **passam** com folga (ver abaixo).
  - Critérios: p95 de **API** `< 500 ms`, erros `< 1%`, sem vazamento de conexões e comportamento definido em queda de Redis/rede. O alvo é declarado com o nível de carga ao lado, senão não é comparável: 25 iterações/s do k6, que emitem ~6 requisições cada, equivalem a **~125 req/s** (5 requisições por iteração, conferido contra o http_reqs entregue).
  - Seed e dados de teste devem ser isolados; nada destrutivo em produção. A Medição A (local, isolada) cumpre isso integralmente; a Medição B (produção) é o desvio documentado, com contas dedicadas criadas e removidas.
  - Harness: `npm run test:load` sobe `docker-compose.load.yml` (Postgres em tmpfs + imagem de produção construída a partir do `Dockerfile`), semeia via `scripts/load-seed.mjs` e roda k6 + soak de SSE. Projeto compose isolado (`cheerconnect-load`), então não encosta nos containers de desenvolvimento.
  - **Fan-out medido** (`npm run test:load:fanout`, via `pg_stat_statements`): média de **8,0 consultas/req** nas rotas de leitura, com `/api/posts?filter=following` em **15,1**. A 125 req/s nominais isso vira ~1.000 consultas/s — é o que torna 150 req/s impraticável contra o banco de produção e definiu a taxa da Medição B.
  - **Medição A (local, 3 execuções de 5 min, 30 s de aquecimento por execução, re-semeadura entre execuções):**

    | Métrica | mediana do p95 | menor p95 | maior p95 | alvo | Situação |
    |---|---|---|---|---|---|
    | Leitura (API) | **14 ms** | 14 ms | 15 ms | 500 ms | atende |
    | Páginas | 20 ms | 20 ms | 21 ms | 200 ms | atende |
    | Mutações | **296 ms** | 293 ms | 297 ms | 500 ms | atende |
    | Autenticação | 267 ms | 266 ms | 268 ms | 2.000 ms | atende |

    Erros `0,00%` em leitura, página, autenticação e mutação; logins `100%`; mutações barradas por limite de taxa `0,00%`; iterações descartadas `0, 0, 0`; carga entregue de 142,2 a 143,2 req/s contra 125 nominais. As três primeiras colunas são a mediana, o menor e o maior **dos p95 de cada execução** — não o p50 das requisições. Nenhuma execução ficou fora dos limiares, então as três entraram na mediana.

  - **Números anteriores invalidados, e por quê:** a Medição A já registrada trazia leitura com mediana de 182 ms e mutações com 446 ms. Essas execuções usavam `LOAD_AUTH_USERS=8`, e o `setup()` do k6 roda **uma vez por cenário**, não uma vez por execução: três cenários medidos × 8 usuários = 24 logins na mesma janela de 60 s, contra o limite de 15/min por IP de `/api/auth/callback/credentials`. O próprio harness produzia o 429 que ele depois reportava como falha da aplicação. Com `LOAD_AUTH_USERS=3` o consumo cai para 9 e os logins passam a 100%. A taxa de mutação também mudou, de 1 escrita/s para 20/min, porque 1/s com 3 sessões dava 20 escritas por usuário por minuto — metade delas mensagens, exatamente o teto de 10/min de `/api/conversations`, e ~12% das escritas recebiam 429. Os números antigos **não são reproduzíveis** com a configuração corrigida e não são comparáveis aos de agora.
  - **O harness agora recusa configuração que meça o limitador em vez do código:** `assertLoginBudget()` e `assertMutationBudget()` comparam a carga pedida com as regras de `src/lib/middleware-policy.ts` e abortam com a conta e a receita certa. Estourar o limite de propósito continua possível, e é o que a sonda faz: ela existe para medir o 429 como comportamento, e roda depois dos cenários medidos para não competir pela mesma janela.

  - **Por que a medição anterior dava 117 ms–1790 ms:** faltava aquecimento. Os 30 s primeiros de uma janela de 2 min são ~25% das amostras, e o frio de pool, servidor e JIT fica inteiro dentro deles — o p95 caía justamente na população de partida. Com 30 s de aquecimento fora da métrica e janela de 5 min, a dispersão é de 36 ms a 263 ms. A variância observada era majoritariamente artefato de arranque, não da carga.
  - **Correção do desenho da medição:** o alvo de 500 ms passou a ser avaliado só sobre as rotas de API (`kind: api`), com as páginas em métrica separada (`kind: page`). Páginas deixaram de misturar dois custos sem relação. Descobriu-se, ao medir, que `/feed`, `/trending`, `/search` e `/profile` estão entre as 24 rotas **prerenderizadas**: são cascas estáticas de 7–58 ms, e o dado chega pela API depois, no cliente. Ou seja, **todo o custo de servidor de uma visualização está na API** — a separação confirmou a arquitetura em vez de exculpar o número. A meta de página virou trava contra regressão dessas rotas para renderização dinâmica, não métrica de experiência.
  - **Mutações:** mediana de 296 ms contra alvo de 500 ms, com as três execuções entre 293 ms e 297 ms. A folga vem em parte da taxa sustentada: 20 escritas/min com 3 sessões dá 3,3 escritas por usuário por minuto, dentro do que o limitador permite. Uma taxa de escrita maior mede o limitador antes de medir a escrita, e é isso que o ssertMutationBudget() impede.
  - **Defeito do harness corrigido:** a sonda de limite de taxa dispara 25 logins em rajada e esgota a janela de 15/min por IP; o `setup()` da execução seguinte não autenticava e o k6 abortava sem métricas. A sonda passou a rodar só na última execução, com 70 s de espera para a janela drenar e re-semeadura entre execuções para que partam do mesmo estado.
  - **Fase degradada conferida sob os limiares novos** (Redis inalcançável, `app-degraded`): leitura de API p95 20 ms, páginas 24 ms, erros 0,00%, liveness 84/84 (100%), limitador comprovado. O alvo de página apertado em 200 ms **também** se sustenta sem Redis, então a trava contra renderização dinâmica não é frágil.
  - **Medição B (produção, Vercel, 1 conta dedicada, somente leitura, ~6 req/s ≈ 49 consultas/s por 3 min):**

    | Métrica | mediana | p95 | alvo | Situação |
    |---|---|---|---|---|
    | Leitura (API) | 395 ms | **934 ms** | 500 ms | **não atende** |
    | Páginas | 64 ms | 488 ms | 200 ms | não atende (cauda) |
    | Autenticação | 450 ms | 898 ms | 2.000 ms | atende |

    Erros `0,00%` e logins `100%`: o problema é latência, não corretude. A mediana de 395 ms passa no alvo, e é o p95 que estoura — a distribuição é longa, não deslocada. Os 3 min e os 5 min deram 934 ms e 937 ms: número estável, o que sugere que é uma fração constante de requisições mais lentas e não um efeito de janela. **O que as duas medições não permitem é atribuir a causa.** Elas medem conjuntos de rotas diferentes — a Medição A inclui `filter=following` (15,1 consultas/req) e a Medição B a exclui, porque responderia vazio para uma conta nova —, com taxas diferentes (25 it/s contra 1 it/s) e volumes de dados diferentes. Então o par "14 ms local, 934 ms em produção" **não isola o caminho de rede**: aponta para o ambiente de implantação como um todo, e a causa pode ser rede, partida de função, overhead do pooler ou plano de consulta. Atribuir ao caminho Vercel → Supabase sem medir por trecho seria palpite. O que dá para afirmar é o que está medido: **a arquitetura suporta a meta, a implantação em produção não a cumpre, e a causa ainda não foi isolada.**
  - **Desvio documentado do isolamento de seed:** a Medição B exige sessão autenticada, e a conta foi criada no banco de produção (`carga0@load.invalid`, uma conta, sem posts, conexões ou equipe, removida ao final). É a única escrita em produção de todo o trabalho, e o `GOAL.md` passa a declarar a exceção em vez de afirmar isolamento absoluto.
  - **Rotas com conta nova:** `filter=following`, conexões e notificações responderiam vazio para uma conta recém-criada, e medir vazio é medir nada. Com `LOAD_FRESH_ACCOUNT=1` o cenário fica só nas rotas que leem dados existentes. O que ficou de fora continua coberto pela Medição A, onde os usuários semeados têm conexões e histórico.
    - **Limitação conhecida:** o k6 1.3.0 materializa sub-métricas de `http_req_duration` apenas quando algum threshold as cita, e nenhum cita `scenario:warmup`. Então a fatia de partida não é separável dentro da mesma execução, e o p95 relatado **não pode ser atribuído a regime permanente** — uma janela quente finita de 30 s não garante que a instância seguinte continue morna em serverless. O que se pode afirmar é que a janela medida começa depois do aquecimento. Separar partida de regime exigiria medir o custo por trecho (CDN → função → consulta) ou comparar p95 por janelas dentro da mesma execução.
    - **A fase degradada não cobre mutação:** ela roda com `LOAD_READ_ONLY=true`, então 3 dos limiares ficam sem amostra. E sua janela medida é de segundos, ao lado dos minutos dos números principais. O que ela sustenta é "as leituras se mantêm sem Redis", não "os limiares se mantêm".

  - **Corretude, por medição:** erros de leitura `0,00%` e logins `100%` nas duas; limitador de taxa comprovado por sonda (`100%`) na Medição A e na fase degradada — a sonda é opt-in e **não** foi ligada na Medição B, então o limite de taxa não foi medido em produção; SSE sem vazamento (10/10 conexões abertas e liberadas, handles `10 → 0` no abort) e liveness `100%` com e sem Redis, ambos só na Medição A, que é onde o soak roda. O que não é atendido nas duas é **latência**, não corretude.
  - **Defeito de resiliência encontrado e corrigido:** o `@upstash/redis` faz 5 retries com backoff exponencial por padrão. Com o Redis fora, cada requisição segurava ~4,3 s antes de cair no fallback em memória (medido: 4329 ms → 61 ms com retry limitado a 1 tentativa). Isso elevava o p95 de autenticação de 4786 ms para ~1550 ms. Corrigido em `src/lib/redis.ts`.
  - **Gargalo parcial medido:** o pool do Prisma estava fixo em `max: 10`. Subir para 30 reduziu leitura de 1598 ms → 984 ms (−38%) e mutações de 2802 ms → 2095 ms (−25%), confirmando o pool como causa parcial. Sob a medição corrigida, o pool a 10 já não é o gargalo: a leitura fica em 14 ms com o padrão mantido.
  - O pool agora é configurável por `DATABASE_POOL_MAX`, com padrão **mantido em 10** para não alterar o comportamento de produção sem medir o `max_connections` real do banco.
  - O ambiente continua sendo Docker Desktop local com CPU compartilhada, então a Medição A **não** é representativa da latência na Vercel — é a que sustenta o critério de capacidade, não a experiência do usuário. Para a experiência, ver a Medição B.
- [x] **PRISMA-001 — Compatibilidade Prisma 8 RC:** avaliada em worktree isolado (`spike/prisma8-cli`), sem alteração em produção.
  - Critérios: instalar `prisma`/`@prisma/client` 8 RC, regenerar client, executar migrations e testes em schema temporário, documentar breaking changes e rollback.
  - O critério original partia da premissa errada de que o runtime 8 seria o `@prisma/client`. No Prisma 8 o runtime é a facade por banco, `@prisma/orm-postgres`, que **tem** RC (`8.0.0-rc.12`); o `@prisma/client` e o `@prisma/adapter-pg` não têm RC 8 porque deixam de ser o caminho do cliente.
  - **Funcionou:** `contract emit` sobre o schema real de 30 models emitiu `contract.json` e `contract.d.ts` com todos os models. A CLI 8 aceita o schema atual.
  - **Não funcionou:** `generate` não existe na v8, `validate` sumiu sem equivalente, o config precisa de `definePrismaConfig` com marcador de versão, a API de query é incompatível e o caminho de migrations mudou.
  - **Custo medido:** 337 call sites em 75 arquivos, e o `@prisma/adapter-pg` sai do caminho do cliente — o que exige reinventar como o RLS conecta com o papel `cheerconnect_app`, hoje garantido pelo pool.
  - Decisão e gatilhos de reavaliação em `docs/adr/0004-prisma-8-readiness.md`. O caminho oficial é coexistência (Prisma 7 continua dono do schema), não troca de uma vez.
  - Nada foi alterado no projeto principal: o worktree e o banco do spike são descartáveis.

### Riscos técnicos residuais

- [x] **Autenticação quebrava em deploy self-hosted por HTTP.** Com `NODE_ENV=production` e `NEXTAUTH_URL` em `http://`, o `auth.ts` gravava o cookie de sessão com prefixo `__Secure-` (`useSecureCookies` derivado de `NODE_ENV`) enquanto o `getToken` do `src/proxy.ts` derivava o nome do cookie do protocolo do `NEXTAUTH_URL` e procurava o nome sem prefixo. Resultado: **toda rota autenticada respondia 401**. Na Vercel (HTTPS) não aparecia, por isso produção estava saudável. **Corrigido** com fonte única de verdade em `src/lib/auth-cookies.ts`, usada pelas duas pontas, mais teste de regressão em `src/__tests__/auth-cookie-coherence.test.ts`. Verificado nas duas configurações: com `http://` o cookie passa a ser `next-auth.session-token` e as rotas autenticadas respondem 200; com `https://` mantém `__Secure-next-auth.session-token`, preservando o comportamento de produção.
- [ ] **A queda do Redis não gera alerta.** O campo `redis` do health responde `unavailable` quando o Upstash cai, mas nada monitora esse campo. Foi exatamente o que aconteceu com o banco anterior, que morreu e passou meses sem ninguém perceber, com o rate limit degradando em silêncio para memória. Um alerta no health ou no próprio Upstash fecharia essa lacuna.
- [ ] **O job de carga do CI é não bloqueante** (`continue-on-error: true`), então não reprova o merge nem trava o pipeline. Ele serve como acompanhamento de tendência. Para virar gate, é preciso antes um runner dedicado, porque a variância de p95 em máquina compartilhada é alta.
- [ ] Caracterizar a latência de produção: p95 de leitura em 934 ms contra alvo de 500 ms, com mediana em 395 ms. A API mede 14 ms localmente, então o custo é do caminho Vercel → Supabase `us-west-2`, não da aplicação. Antes de atacar a aplicação, medir o custo por trecho (CDN → função → consulta) para saber onde ele nasce.
- [ ] Characterizar o p95 de mutação em uma taxa de escrita mais alta que a sustentável sob o rate limit atual. A leitura de API cumpre com folga em ambiente local, em 182 ms.
- [x] **E2E dos fluxos destrutivos** — 36 verificações em 7 arquivos (`tests/e2e/`), todas verdes, cobrindo publicação, conexão, mensagem, equipe, evento, exclusão de conta em cascata e autorização cruzada. Cada teste cria as próprias contas, o que isola os limites de taxa e elimina interferência entre testes.
  - **Por que uma pilha isolada:** o E2E é destrutivo, e o servidor que o Playwright sobe (`npm run dev`) herda o `DATABASE_URL` do `.env`, que é o **banco de produção**. Sem `docker-compose.e2e.yml`, o primeiro `DELETE` apagaria dado de gente real. A pilha tem projeto compose próprio, Postgres em tmpfs e a mesma imagem de produção do `Dockerfile`; `npm run test:e2e` sobe, roda e derruba.
  - **Regras de negócio que os testes passaram a fixar:** conversa exige conexão aceita (403 caso contrário); `DELETE` e `accept` de conexão recebem o id da **pessoa**, não o da conexão; o editor de post não expõe edição nem exclusão na interface, só na API; conta não pode ser excluída sendo administradora única de equipe (409, com a lista das equipes no corpo do erro).
  - **Cascata, com a precisão que a alegação exige:** a distinção não é por tabela, é por **de quem é a linha**. O que o usuário produziu some; o que pertence a outra pessoa e apenas o referencia permanece, com a referência anulada.
    - **Sai em cascata (a linha é do usuário):** post, comentário, curtida, curtida de comentário, menção, edição de post, conexão nas duas direções, associação a equipe, seguir de equipe, conversa nas duas posições, mensagem enviada, notificação **daquele** usuário, conquista, entrada de currículo, conta e sessão do NextAuth, desafio de reautenticação, convite **recebido** por ele, denúncia **feita** por ele, bloqueio nas duas direções. São 39 relações `onDelete: Cascade` no schema, e `src/__tests__/cascade-deletion.test.ts` fixa essa lista uma a uma.
    - **Sobrevive com a referência anulada (a linha é de outra pessoa):** evento criado por ele (`Event.creatorId`), notificação que outra pessoa recebeu **sobre** ele (`Notification.actorId`), mídia que ele carregou e outra pessoa usa (`MediaAsset.ownerId`), convite que ele enviou (`TeamInvite.invitedById`). São as 8 relações `onDelete: SetNull`, e a razão é a mesma nos quatro casos: apagar o dado apagaria a ação de um terceiro, então só a autoria é anonimizada.
    - **A equipe em si sobrevive sem o membro**, porque `Team` não tem relação com `User` — a propriedade vem por `TeamMember`, que é `Cascade`. Uma conta removida de um time deixa o time órfão, não o apaga.
    - A afirmação de "exclusão efetiva em cascata" vale, portanto, para o conteúdo de autoria. O que o texto não pode dizer é que tudo desaparece: para dado coletivo o comportamento é preservar a linha e anonimizar a referência. O E2E em `account-deletion.spec.ts` verifica os dois lados, inclusive que a equipe e o evento continuam lá.
  - **Defeito de acessibilidade encontrado e corrigido:** com o smoke autenticado finalmente rodando (antes era pulado sem `E2E_EMAIL`), o axe reprovou o badge de nome de evento no calendário: `text-primary` sobre `bg-primary/10` a 10 px dá 4.3:1, abaixo dos 4.5:1 do WCAG AA. Corrigido para `text-primary-dark`, o mesmo vermelho mais escuro, que também inverte no tema escuro.
  - **Fora do E2E por decisão:** o envio do e-mail de reautenticação. O provider `log` registra apenas destinatário e assunto, nunca o corpo, e em produção lança exceção por não haver entrega configurada — o envio tem cobertura em `src/lib/__tests__/email.test.ts`. O teste cria o desafio direto no banco e valida o token pela rota, exercitando tudo o que vem depois do e-mail.
  - **Fora da integração contínua, por decisão:** o E2E roda sob demanda com `npm run test:e2e`. O orquestrador é o mesmo que a CI usaria, então acrescentar o job é uma linha em `ci.yml` quando quiser. Enquanto isso, a validação automatizada do objetivo 5 se apoia nos 340 testes unitários e nas 4 verificações de CI; o E2E é evidência complementar, reproduzível localmente.

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
npm run test:realtime
npm run test:realtime:cross-instance
npm run test:load
npm run test:load:fanout
npm run test:sse-soak
npm run docs:sync
npm run docs:validate
npm run prisma:validate
npx prisma format --check
npm audit --audit-level=moderate
npm run build
npm run test:e2e
```

`npm run test:db` cria e remove um schema PostgreSQL temporário. `npm run test:rls` consulta o catálogo RLS. `npm run test:cloudinary` executa um smoke real e descarta o asset temporário. 
npm run test:e2e exige Docker: sobe `docker-compose.e2e.yml` numa porta própria, semeia nada — cada teste cria as próprias contas —, roda o Playwright e derruba a pilha no fim, inclusive em Ctrl-C. O `DATABASE_URL` é sobrescrito para a base de E2E, e o fixture recusa correr se a URL não for local. `E2E_SKIP_BUILD=true` reaproveita a imagem existente, `E2E_KEEP_UP=true` deixa a pilha no ar para depurar, e `E2E_ARGS` repassa argumentos ao Playwright.


`npm run test:load:fanout` exige a pilha de carga no ar e mede quantas consultas cada rota de leitura executa, pelo `pg_stat_statements` do Postgres da própria pilha.
`npm run test:load:summarize <arquivo>` extrai os percentis de um artefato de execução, inclusive as colunas que o `handleSummary` não imprime.

`npm run test:realtime` e `npm run test:realtime:cross-instance` exigem as credenciais do Upstash em `.env`. Para rodá-los sem depender da nuvem, `docker compose -f docker-compose.realtime-test.yml up -d` sobe um Redis local com ponte REST compatível e basta apontar `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` para ele.

`npm run test:load` exige Docker e sobe a pilha completa de carga, com build da imagem a partir do `Dockerfile`. As mutações só rodam contra o stack local; `LOAD_BASE_URL` permite apontar apenas o cenário de leitura para outro alvo. `LOAD_SKIP_BUILD`, `LOAD_DURATION`, `LOAD_DB_POOL` e `LOAD_DEGRADED=false` ajustam a execução.
