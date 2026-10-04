# Diagramas UML

Diagramas do trabalho, em Mermaid. Duas fontes:

- **Diagramas de classe** são gerados por `scripts/generate-diagrams.mjs` a partir de
  `prisma/schema.prisma` e das rotas em `src/app/api/**/route.ts`. Não editar à mão:
  o arquivo carrega um cabeçalho que pede o contrário, e o `--check` falha se o
  diagrama ficar defasado.
- **Diagramas de sequência e de estado** são escritos à mão e conferidos contra o
  código. O roteiro de cada um está no cabeçalho do próprio arquivo.

## Como regenerar

```bash
npm run docs:diagrams          # gera os .mmd a partir do codigo
npm run docs:diagrams:check    # falha se algum .mmd estiver desatualizado
npm run docs:diagrams:render   # gera os .mmd e renderiza os PNG
```

O `render` precisa do Chromium. O projeto reaproveita o do Playwright, então não
baixa um navegador extra:

```bash
# Windows
$env:PUPPETEER_EXECUTABLE_PATH = "$env:LOCALAPPDATA\ms-playwright\chromium-1208\chrome-win64\chrome.exe"
npm run docs:diagrams:render
```

## Índice

### Classes, por domínio

| Arquivo | Domínio | Entidades |
|---|---|---|
| `classe-identidade.mmd` | Identidade, acesso e privacidade | User, Account, Session, VerificationToken, AccountReauthChallenge, PrivacyRequest |
| `classe-curriculo.mmd` | Currículo atlético e conquistas | CareerHistory, Achievement |
| `classe-publicacoes.mmd` | Publicações e interação | Post, PostEdit, Tag, PostTag, Mention, Comment, CommentLike, Like |
| `classe-equipes.mmd` | Equipes, membros e conquistas | Team, TeamMember, TeamFollow, TeamAchievement, TeamInvite |
| `classe-conexoes.mmd` | Conexões e comunicação | Connection, Conversation, Message, Notification |
| `classe-eventos-moderacao.mmd` | Eventos, denúncias, bloqueios, mídia e auditoria | Event, Report, Block, ActivityLog, MediaAsset |

São 30 entidades em 6 diagramas, porque um diagrama só com as 30 fica ilegível.
Chaves estrangeiras que apontam para outro domínio aparecem como atributo
(`+String userId FK -> User`) em vez de seta, para que a informação não se perca
com o recorte.

### Sequências

| Arquivo | Fluxo |
|---|---|
| `seq-autenticacao.mmd` | Login por credenciais e o caminho do cookie de sessão |
| `seq-feed-leitura-publicar.mmd` | Leitura com cursor e publicação |
| `seq-feed-curtir-comentar.mmd` | Curtida e comentário |
| `seq-conexoes.mmd` | Solicitação, aceitação e recusa de conexão |
| `seq-mensagem-enviar-entregar.mmd` | Abertura do stream, envio e entrega entre instâncias |
| `seq-mensagem-heartbeat-invalidar.mmd` | Heartbeat e encerramento por sessão invalidada |
| `seq-convite-criar-aceitar.mmd` | Criação, aceite, recusa e negativa a terceiro |
| `seq-convite-revogar-expirar.mmd` | Revogação e expiração pela rotina agendada |
| `seq-privacidade-lgpd.mmd` | Exclusão em cascata, solicitação do titular e exportação de dados |

As sequências ficam em duas partes quando passam de ~20 mensagens ou 7
lifelines: num diagrama sozinho o texto some ao reduzir para a largura da
página. Cada parte indica no cabeçalho de onde continua.

### Estado

| Arquivo | Máquina |
|---|---|
| `estado-convite-equipe.mmd` | Convite: pendente, aceito, recusado e expirado |

## Notas para o documento

- Os diagramas de classe acrescentam **comportamento** ao ERD: o ERD diz que
  `Comment` tem `authorId`, o diagrama diz que `Comment` tem `editar()`,
  `excluir()`, `curtir()` e `responder()`, com o verbo HTTP e a rota de origem.
- A distinção **400** e **409** na recusa de convite aparece em
    `seq-convite-criar-aceitar.mmd` e em `estado-convite-equipe.mmd`: 400 quando o convite
  não está mais pendente, 409 quando o update condicional não alterou nenhuma
  linha, o que significa que outra pessoa agiu entre a leitura e a escrita.
- Identidade visual **não é um diagrama UML**. Paleta, tipografia e componentes
  pertencem a uma seção de design tokens, não a este conjunto.

**Referencial: Autoria própria (2026).**
