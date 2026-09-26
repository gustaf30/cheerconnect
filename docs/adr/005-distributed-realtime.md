# ADR 005: Realtime distribuído sobre Redis Streams

## Status

Aceito. Substitui a ADR 003, cujo escopo se limitava a implantações de instância única.

## Contexto

A ADR 003 adotou um barramento de eventos em processo, atrás de
`src/lib/realtime-bus.ts`, para invalidar o polling das rotas SSE logo após uma
escrita. A própria decisão registrava que um adaptador de Redis Streams poderia
substituí-la sem alterar os contratos das rotas, e que o intervalo de polling
deveria ser revisto quando um broker distribuído fosse introduzido.

O cenário que motivou a revisão foi o funcionamento em serverless, em que as
instâncias não são permanentes nem compartilhadas. Um evento publicado na instância
A não alcançava a instância B, de modo que um usuário conectado a B só percebia a
mudança no ciclo seguinte do polling, de 15 a 30 segundos. O comportamento permanecia
correto, porque o polling no banco é a fonte de verdade, mas a latência deixava de
cumprir a promessa de tempo real.

Restrições considered: manter o custo operacional zero, não introduzir servidor
de processo persistente e não alterar os contratos das rotas de API.

## Decisão

Adotar Redis Streams como canal de propagação entre instâncias, mantendo o
barramento em processo como caminho de recuo. A implementação está em
`src/lib/redis.ts`, que passou a ser o cliente compartilhado, e em
`src/lib/realtime-bus.ts`, que ganhou o transporte de stream.

- **Escrita:** cada publicação emite localmente de forma síncrona e, em seguida,
  acrescenta ao stream `cheerconnect:realtime` por `XADD`, com retenção
  configurada por `MAXLEN` e corte aproximado (`~`). O corte aproximado troca
  precisão por custo: o stream pode passar do limite por algumas entradas, o que
  é irrelevante para um canal de invalidação, onde a fonte de verdade é o banco.
- **Leitura:** cada instância mantém um cursor e lê o stream por `XREAD`,
  republicando no mesmo `EventEmitter` local.
- **Sem duplicidade:** cada entrada carrega o identificador da instância de origem
  e as publicações de origem própria são descartadas na leitura, de modo que um
  evento não é entregue duas vezes à mesma instância.
- **Degradação:** toda falha de Redis é absorvida. O barramento local continua
  funcionando e o ganho de distribuição é perdido, nunca o contrário.

## Alternativas preteridas

- **Pub/Sub do Redis:** entrega é efêmera. Um assinante que reconecta não
  recupera o evento perdido, e a API REST do Upstash expõe o canal por Server-Sent
  Events, o que deslocaria o problema para um consumidor adicional por conexão.
- **QStash:** resolve entrega com retentativa, mas introduz um serviço e um modelo
  de invocação por webhook, desproporcionado para sinalização de invalidação.
- **WebSockets:** exige servidor de processo persistente, incompatível com a
  premissa serverless, conforme já registrado na ADR 003.

## Consequências

- A latência de propagação entre instâncias deixa de depender do intervalo de
  polling, que passa a ser apenas a rede de segurança.
- As rotas SSE não sofreram alteração: como o pump republica no mesmo
  `EventEmitter`, os filtros por usuário e por conversa continuam válidos. Essa
  era a condição prevista na ADR 003 para permitir a troca.
- O barramento distribuído é otimização de latência, não de correção. A
  reconexão sem perda e a consistência continuam vindo do polling no banco, o que
  limita o pior caso ao comportamento anterior.
- A dependência de Redis no caminho crítico introduziu um risco próprio: a
  degradação foi validada com o serviço inacessível, e o cliente teve a política de
  retentativas limitada para que a falha não acrescente segundos de latência à
  degradação.
- O custo passa a ser proporcional ao número de instâncias e ao volume de
  eventos, dado que cada instância lê o stream periodicamente.

## Validação

- `npm run test:realtime`: 8 de 8 testes de integração contra um Redis real,
  incluindo escrita, leitura, retenção por `MAXLEN` e por `XTRIM`.
- `npm run test:realtime:cross-instance`: duas instâncias isoladas recebem um
  evento publicado por um terceiro processo, e a entrega local é preservada
  quando o Redis está inacessível.
