// Gera os diagramas de classe UML a partir do schema Prisma e das rotas reais.
//
// Duas propriedades importam aqui:
//
// 1. Os atributos e os relacionamentos sao lidos do schema, nao digitados a mao.
//    Mudar uma coluna no schema muda o diagrama.
//
// 2. As operacoes vem de uma tabela, mas cada linha e conferida contra o disco:
//    se a rota ou o metodo sumirem, o gerador falha em vez de gerar um diagrama
//    descrevendo uma API que nao existe mais.
//
// Uso: node scripts/generate-diagrams.mjs [--check]

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const CHECK_ONLY = process.argv.includes("--check");
const DIAGRAM_DIR = "docs/diagrams";
const PNG_DIR = "docs/diagrams/png";

// ---------------------------------------------------------------------------
// Dominios: como as 30 entidades se agrupam em 5 diagramas legiveis.
// A soma tem de dar 30 e nenhuma entidade pode aparecer duas vezes; o
// gerador verifica.
// ---------------------------------------------------------------------------
const DOMINIOS = [
  {
    nome: "identidade",
    titulo: "Identidade, acesso e privacidade",
    entidades: ["User", "Account", "Session", "VerificationToken", "AccountReauthChallenge", "PrivacyRequest"],
  },
  {
    nome: "curriculo",
    titulo: "Curriculo atletico e conquistas",
    entidades: ["CareerHistory", "Achievement"],
  },
  {
    nome: "publicacoes",
    titulo: "Publicacoes e interacao",
    entidades: ["Post", "PostEdit", "Tag", "PostTag", "Mention", "Comment", "CommentLike", "Like"],
  },
  {
    nome: "equipes",
    titulo: "Equipes, membros e conquistas coletivas",
    entidades: ["Team", "TeamMember", "TeamFollow", "TeamAchievement", "TeamInvite"],
  },
  {
    nome: "conexoes",
    titulo: "Conexoes e comunicacao em tempo real",
    entidades: ["Connection", "Conversation", "Message", "Notification"],
  },
  {
    nome: "eventos-moderacao",
    titulo: "Eventos, denuncias, bloqueios, midia e auditoria",
    entidades: ["Event", "Report", "Block", "ActivityLog", "MediaAsset"],
  },
];

// ---------------------------------------------------------------------------
// Operacoes por entidade. `rota` e `metodo` sao conferidos contra o disco;
// `nome` e o que aparece no diagrama.
// ---------------------------------------------------------------------------
const OPERACOES = [
  // Identidade
  { entidade: "User", rota: "/api/auth/register", metodo: "POST", nome: "registrar()" },
  { entidade: "User", rota: "/api/auth/verify-email", metodo: "GET", nome: "verificarEmail()" },
  { entidade: "User", rota: "/api/users/me", metodo: "GET", nome: "perfil()" },
  { entidade: "User", rota: "/api/users/me", metodo: "PATCH", nome: "atualizarPerfil()" },
  { entidade: "User", rota: "/api/users/me", metodo: "DELETE", nome: "excluirConta()" },
  { entidade: "User", rota: "/api/users", metodo: "GET", nome: "buscar()" },
  { entidade: "User", rota: "/api/users/[id]/block", metodo: "POST", nome: "bloquear()" },
  { entidade: "User", rota: "/api/users/[id]/block", metodo: "DELETE", nome: "desbloquear()" },
  { entidade: "User", rota: "/api/users/me/avatar", metodo: "POST", nome: "enviarAvatar()" },
  { entidade: "User", rota: "/api/users/me/banner", metodo: "POST", nome: "enviarBanner()" },
  { entidade: "User", rota: "/api/users/me/reauthenticate", metodo: "POST", nome: "reatenticar()" },
  { entidade: "User", rota: "/api/users/me/teams", metodo: "GET", nome: "minhasEquipes()" },
  { entidade: "User", rota: "/api/settings", metodo: "PATCH", nome: "alterarPreferencias()" },
  { entidade: "User", rota: "/api/settings/username", metodo: "GET", nome: "verificarUsername()" },
  { entidade: "User", rota: "/api/settings/password", metodo: "POST", nome: "alterarSenha()" },
  { entidade: "Account", rota: "/api/auth/register", metodo: "POST", nome: "vincular()" },
  { entidade: "Session", nota: "criada e destruida pelo NextAuth a cada login" },
  { entidade: "VerificationToken", nota: "usado na verificacao de e-mail" },
  { entidade: "AccountReauthChallenge", nota: "emitido em operacoes sensiveis" },
  { entidade: "PrivacyRequest", rota: "/api/privacy/request", metodo: "POST", nome: "solicitar()" },
  { entidade: "PrivacyRequest", rota: "/api/privacy/export", metodo: "GET", nome: "exportarDados()" },
  { entidade: "PrivacyRequest", rota: "/api/cron/maintenance", metodo: "POST", nome: "processarFila()" },

  // Curriculo
  { entidade: "CareerHistory", rota: "/api/career", metodo: "GET", nome: "listar()" },
  { entidade: "CareerHistory", rota: "/api/career", metodo: "POST", nome: "registrarVinculo()" },
  { entidade: "CareerHistory", rota: "/api/career/[id]", metodo: "GET", nome: "buscar()" },
  { entidade: "CareerHistory", rota: "/api/career/[id]", metodo: "PATCH", nome: "atualizar()" },
  { entidade: "CareerHistory", rota: "/api/career/[id]", metodo: "DELETE", nome: "remover()" },
  { entidade: "Achievement", rota: "/api/achievements", metodo: "GET", nome: "listar()" },
  { entidade: "Achievement", rota: "/api/achievements", metodo: "POST", nome: "registrar()" },
  { entidade: "Achievement", rota: "/api/achievements/[id]", metodo: "PATCH", nome: "atualizar()" },
  { entidade: "Achievement", rota: "/api/achievements/[id]", metodo: "DELETE", nome: "remover()" },

  // Publicacoes
  { entidade: "Post", rota: "/api/posts", metodo: "GET", nome: "feed()" },
  { entidade: "Post", rota: "/api/posts", metodo: "POST", nome: "publicar()" },
  { entidade: "Post", rota: "/api/posts/[id]", metodo: "GET", nome: "buscar()" },
  { entidade: "Post", rota: "/api/posts/[id]", metodo: "PUT", nome: "atualizar()" },
  { entidade: "Post", rota: "/api/posts/[id]", metodo: "DELETE", nome: "excluir()" },
  { entidade: "Post", rota: "/api/posts/[id]/like", metodo: "POST", nome: "curtir()" },
  { entidade: "Post", rota: "/api/posts/[id]/like", metodo: "DELETE", nome: "descurtir()" },
  { entidade: "Post", rota: "/api/posts/[id]/repost", metodo: "POST", nome: "repostar()" },
  { entidade: "Post", rota: "/api/posts/[id]/repost", metodo: "DELETE", nome: "cancelarRepost()" },
  { entidade: "Post", nota: "storedField evidencia o historico de edicoes" },
  { entidade: "PostEdit", rota: "/api/posts/[id]/edits", metodo: "GET", nome: "historico()" },
  { entidade: "Comment", rota: "/api/posts/[id]/comments", metodo: "GET", nome: "listar()" },
  { entidade: "Comment", rota: "/api/posts/[id]/comments", metodo: "POST", nome: "comentar()" },
  { entidade: "Comment", rota: "/api/comments/[id]", metodo: "PATCH", nome: "editar()" },
  { entidade: "Comment", rota: "/api/comments/[id]", metodo: "DELETE", nome: "excluir()" },
  { entidade: "Comment", rota: "/api/comments/[id]/replies", metodo: "GET", nome: "responder()" },
  { entidade: "Comment", rota: "/api/comments/[id]/like", metodo: "POST", nome: "curtir()" },
  { entidade: "Comment", rota: "/api/comments/[id]/like", metodo: "DELETE", nome: "descurtir()" },
  { entidade: "Tag", rota: "/api/tags/[name]", metodo: "GET", nome: "listarPublicacoes()" },
  { entidade: "Tag", rota: "/api/tags/trending", metodo: "GET", nome: "emAlta()" },
  { entidade: "Mention", nota: "criada junto da publicacao, remove em cascata" },
  { entidade: "PostTag", nota: "ligacao entre publicacao e tag" },
  { entidade: "Like", nota: "unica por (usuario, publicacao)" },
  { entidade: "CommentLike", nota: "unica por (usuario, comentario)" },

  // Equipes
  { entidade: "Team", rota: "/api/teams", metodo: "GET", nome: "listar()" },
  { entidade: "Team", rota: "/api/teams", metodo: "POST", nome: "criar()" },
  { entidade: "Team", rota: "/api/teams/[slug]", metodo: "GET", nome: "buscar()" },
  { entidade: "Team", rota: "/api/teams/[slug]", metodo: "PATCH", nome: "atualizar()" },
  { entidade: "Team", rota: "/api/teams/[slug]", metodo: "DELETE", nome: "excluir()" },
  { entidade: "Team", rota: "/api/teams/[slug]/posts", metodo: "POST", nome: "publicar()" },
  { entidade: "Team", rota: "/api/teams/[slug]/media", metodo: "POST", nome: "enviarMidia()" },
  { entidade: "TeamMember", rota: "/api/teams/[slug]/members", metodo: "GET", nome: "listar()" },
  { entidade: "TeamMember", rota: "/api/teams/[slug]/members/[memberId]", metodo: "PATCH", nome: "alterarFuncao()" },
  { entidade: "TeamMember", rota: "/api/teams/[slug]/members/[memberId]", metodo: "DELETE", nome: "remover()" },
  { entidade: "TeamInvite", rota: "/api/teams/[slug]/invites", metodo: "GET", nome: "listar()" },
  { entidade: "TeamInvite", rota: "/api/teams/[slug]/invites", metodo: "POST", nome: "convidar()" },
  { entidade: "TeamInvite", rota: "/api/teams/invites/[id]/accept", metodo: "POST", nome: "aceitar()" },
  { entidade: "TeamInvite", rota: "/api/teams/invites/[id]/reject", metodo: "POST", nome: "recusar()" },
  { entidade: "TeamInvite", rota: "/api/teams/[slug]/invites/[id]", metodo: "DELETE", nome: "revogar()" },
  { entidade: "TeamInvite", rota: "/api/cron/cleanup-invites", metodo: "POST", nome: "expirarPendentes()" },
  { entidade: "TeamFollow", rota: "/api/teams/[slug]/follow", metodo: "POST", nome: "seguir()" },
  { entidade: "TeamFollow", rota: "/api/teams/[slug]/follow", metodo: "DELETE", nome: "deixarDeSeguir()" },
  { entidade: "TeamAchievement", rota: "/api/teams/[slug]/achievements", metodo: "GET", nome: "listar()" },
  { entidade: "TeamAchievement", rota: "/api/teams/[slug]/achievements", metodo: "POST", nome: "registrar()" },
  { entidade: "TeamAchievement", rota: "/api/teams/[slug]/achievements/[id]", metodo: "DELETE", nome: "remover()" },

  // Comunicacao
  { entidade: "Connection", rota: "/api/connections", metodo: "GET", nome: "listar()" },
  { entidade: "Connection", rota: "/api/connections", metodo: "POST", nome: "solicitar()" },
  { entidade: "Connection", rota: "/api/connections/[id]/accept", metodo: "POST", nome: "aceitar()" },
  { entidade: "Connection", rota: "/api/connections/[id]", metodo: "DELETE", nome: "remover()" },
  { entidade: "Conversation", rota: "/api/conversations", metodo: "GET", nome: "listar()" },
  { entidade: "Conversation", rota: "/api/conversations", metodo: "POST", nome: "abrir()" },
  { entidade: "Conversation", rota: "/api/conversations/[id]", metodo: "GET", nome: "buscar()" },
  { entidade: "Conversation", rota: "/api/conversations/[id]", metodo: "DELETE", nome: "excluir()" },
  { entidade: "Message", rota: "/api/conversations/[id]/messages", metodo: "GET", nome: "listar()" },
  { entidade: "Message", rota: "/api/conversations/[id]/messages", metodo: "POST", nome: "enviar()" },
  { entidade: "Message", rota: "/api/conversations/[id]/messages/read", metodo: "POST", nome: "marcarLidas()" },
  { entidade: "Message", rota: "/api/conversations/[id]/messages/stream", metodo: "GET", nome: "assinarStream()" },
  { entidade: "Message", rota: "/api/messages/count", metodo: "GET", nome: "contarNaoLidas()" },
  { entidade: "Notification", rota: "/api/notifications", metodo: "GET", nome: "listar()" },
  { entidade: "Notification", rota: "/api/notifications", metodo: "PATCH", nome: "marcarLidas()" },
  { entidade: "Notification", rota: "/api/notifications/count", metodo: "GET", nome: "contarNaoLidas()" },
  { entidade: "Notification", rota: "/api/notifications/stream", metodo: "GET", nome: "assinarStream()" },
  { entidade: "Event", rota: "/api/events", metodo: "GET", nome: "listar()" },
  { entidade: "Event", rota: "/api/events", metodo: "POST", nome: "criar()" },
  { entidade: "Event", rota: "/api/events/[id]", metodo: "GET", nome: "buscar()" },
  { entidade: "Event", rota: "/api/events/[id]", metodo: "PATCH", nome: "atualizar()" },
  { entidade: "Event", rota: "/api/events/[id]", metodo: "DELETE", nome: "excluir()" },
  { entidade: "Report", rota: "/api/reports", metodo: "POST", nome: "denunciar()" },
  { entidade: "Report", rota: "/api/reports", metodo: "GET", nome: "listar()" },
  { entidade: "Report", rota: "/api/reports", metodo: "PATCH", nome: "resolver()" },
  { entidade: "Block", nota: "bloqueio bidirecional em cascata" },
  { entidade: "ActivityLog", nota: "trilha de auditoria de acoes sensiveis" },
  { entidade: "MediaAsset", rota: "/api/upload", metodo: "POST", nome: "enviar()" },
  { entidade: "MediaAsset", rota: "/api/upload/complete", metodo: "POST", nome: "concluir()" },
  { entidade: "MediaAsset", rota: "/api/upload/sign", metodo: "POST", nome: "assinarEnvioDireto()" },
];

// ---------------------------------------------------------------------------
// Leitura do schema
// ---------------------------------------------------------------------------
function lerModelos() {
  const src = readFileSync("prisma/schema.prisma", "utf8");
  const modelos = new Map();
  const blocos = src.split(/^model\s+/m).slice(1);
  for (const bloco of blocos) {
    const nome = bloco.match(/^(\w+)/)[1];
    // O bloco vai ate o proximo `model`, entao incluiria declaracoes de enum
    // intermedias — e `enum CareerRole {` casaria com o padrao de campo,
    // virando um atributo chamado "enum". Corta na chave de fechamento.
    const abre = bloco.indexOf("{");
    const fecha = bloco.indexOf("}", abre);
    const corpo = bloco.slice(abre + 1, fecha);
    const campos = [];
    for (const linha of corpo.split("\n")) {
      const t = linha.trim();
      if (!t || t.startsWith("//") || t.startsWith("@@")) continue;
      const m = t.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!m) continue;
      const [, campo, tipo, lista, opcional, resto] = m;
      const pk = /@id/.test(resto) ? " PK" : "";
      const uk = /@unique/.test(resto) ? " UK" : "";
      const relacao = resto.includes("@relation");
      campos.push({
        nome: campo,
        tipo: `${tipo}${lista ? "[]" : ""}${opcional ? "?" : ""}`,
        chave: pk || uk,
        relacao,
      });
    }
    modelos.set(nome, campos);
  }
  return modelos;
}

/** Relations do schema, com a regra de exclusao, para virar associacao UML. */
function lerRelacoes() {
  const src = readFileSync("prisma/schema.prisma", "utf8");
  const relacoes = [];
  const modelos = [...src.matchAll(/^model\s+(\w+)\s*\{/gm)];
  for (let i = 0; i < modelos.length; i += 1) {
    const nome = modelos[i][1];
    const inicio = modelos[i].index + modelos[i][0].length;
    const fim = modelos[i + 1] ? modelos[i + 1].index : src.length;
    const corpo = src.slice(inicio, fim);
    // A relacao pode ser nomeada — @relation("ConnectionSender", fields: ...) —
    // e nesse caso o campo da chave estrangeira e o segundo elemento de fields,
    // nao o atributo que carrega o @relation.
    const padrao =
      /^\s{2}(\w+)\s+(\w+)(\[\])?\??\s+@relation\((?:"[^"]*",\s*)?fields:\s*\[([\w.]+)\][^)]*?(?:onDelete:\s*(\w+))?\)/gm;
    for (const c of corpo.matchAll(padrao)) {
      // Grupos do padrao: 1 atributo, 2 tipo (o modelo de destino), 3 lista,
      // 4 chave estrangeira, 5 onDelete. O destino vem do tipo — em
      // `sender User @relation(fields: [senderId])` o alvo e User, nao senderId.
      const [, attr, alvo, , fk, onDelete] = c;
      if (!fk) continue;
      relacoes.push({ de: nome, attr, fk, alvo, onDelete: onDelete ?? "NoAction" });
    }
  }
  return relacoes;
}

// ---------------------------------------------------------------------------
// Regras de poda: o que NAO aparece no diagrama, e por que.
//
// Um diagrama que mostra tudo vira despejo de migracao: a versao anterior
// media 104 membros no dominio identidade, com o User ocupando 55 linhas.
// As regras abaixo cortam o ruido mecanico e ficam escritas aqui — e no
// README de docs/diagrams — para que o leitor saiba que a omissao e
// deliberada, nao esquecimento:
//
// 1. Listas reversas (posts Post[], sessions Session[]): redundantes com a
//    seta de composicao/associacao que ja parte da outra ponta.
// 2. createdAt/updatedAt: uniformes em todas as entidades, nao distinguem nada.
// 3. notify* no User: 9 booleanos colapsados em uma linha.
// 4. *PublicId: detalhe de escrituracao do Cloudinary, nao do dominio.
// 5. Payload opaco do OAuth no Account: so type/provider/providerAccountId
//    identificam a conta; o resto e carga do provedor.
// 6. Operacoes saem como nome() METODO, sem o caminho: a rastreabilidade
//    rota->operacao continua verificada pelo gerador e mora no Quadro 5.
// 7. Setas sem rotulo: o atributo FK ja diz o destino.
// ---------------------------------------------------------------------------
const PODA_TIMESTAMPS = new Set(["createdAt", "updatedAt"]);
const PODA_PUBLICID = /PublicId$/;
const PODA_OAUTH = new Set([
  "refresh_token", "access_token", "expires_at", "token_type",
  "scope", "id_token", "session_state",
]);

// ---------------------------------------------------------------------------
// Leitura das rotas, para conferir as operacoes
// ---------------------------------------------------------------------------
function lerRotas() {
  const base = "src/app/api";
  const arquivos = [];
  const anda = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name === "route.ts") arquivos.push(p);
    }
  };
  anda(base);
  const mapa = new Map();
  for (const arq of arquivos) {
    // Caminho publico da rota, com o prefixo /api que o cliente chama.
    const rota = "/api/" + relative(base, arq).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
    const src = readFileSync(arq, "utf8");
    const metodos = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)].map((m) => m[1]);
    mapa.set(rota, metodos);
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Geracao
// ---------------------------------------------------------------------------
function conferirOperacoes(rotas) {
  const erros = [];
  for (const op of OPERACOES) {
    if (!op.rota) continue;
    const metodos = rotas.get(op.rota);
    if (!metodos) {
      erros.push(`${op.entidade}.${op.nome}: a rota ${op.rota} nao existe mais`);
    } else if (!metodos.includes(op.metodo)) {
      erros.push(`${op.entidade}.${op.nome}: ${op.metodo} nao existe em ${op.rota} (hoje: ${metodos.join(", ") || "nenhum"})`);
    }
  }
  return erros;
}

function conferirDominios(modelos) {
  const erros = [];
  const vistas = DOMINIOS.flatMap((d) => d.entidades);
  const repetidas = vistas.filter((e, i) => vistas.indexOf(e) !== i);
  if (repetidas.length) erros.push(`entidades em mais de um dominio: ${[...new Set(repetidas)].join(", ")}`);
  const faltando = [...modelos.keys()].filter((m) => !vistas.includes(m));
  if (faltando.length) erros.push(`entidades fora de qualquer dominio: ${faltando.join(", ")}`);
  const fantasma = vistas.filter((e) => !modelos.has(e));
  if (fantasma.length) erros.push(`entidades listadas que nao existem no schema: ${fantasma.join(", ")}`);
  return erros;
}

function gerarDominio(dominio, modelos, relacoes) {
  const linhas = [];
  linhas.push("%% Gerado por scripts/generate-diagrams.mjs — nao editar a mao.");
  linhas.push("%% Fonte: prisma/schema.prisma e src/app/api/**/route.ts");
  linhas.push("classDiagram");
  linhas.push("  direction LR");

  for (const nome of dominio.entidades) {
    const campos = modelos.get(nome) || [];
    const ops = OPERACOES.filter((o) => o.entidade === nome);
    // As chaves estrangeiras entram como atributo, com o destino anotado. Se
    // fossem omitidas, uma entidade que so aponta para outro dominio — e o
    // caso de Connection, Notification, Event, Report e Block, que apontam para
    // User — apareceria sem nenhuma ligacao no diagrama.
    const fks = new Map(relacoes.filter((r) => r.de === nome).map((r) => [r.fk, r.alvo]));
    const ehModelo = (tipo) => modelos.has(tipo.replace(/\[\]$/, "").replace(/\?$/, ""));
    const notifies = campos.filter((c) => c.nome.startsWith("notify") && !c.relacao);
    linhas.push(`  class ${nome} {`);
    if (notifies.length > 1) {
      linhas.push(`    +Boolean notify* (${notifies.length} prefs.)`);
    }
    for (const c of campos) {
      const tipo = c.tipo.replace(/\?$/, "");
      const base = tipo.replace(/\[\]$/, "");
      // Regra 1: lista reversa (Post[], Session[]) — a seta ja diz isso.
      if (!c.relacao && tipo.endsWith("[]") && ehModelo(base)) continue;
      // Regra 3 (segunda parte): os 9 notify sairam na linha colapsada acima.
      if (c.nome.startsWith("notify") && !c.relacao && notifies.length > 1) continue;
      // Regra 2: carimbo uniforme de auditoria.
      if (PODA_TIMESTAMPS.has(c.nome)) continue;
      // Regra 4: escrituracao do Cloudinary.
      if (PODA_PUBLICID.test(c.nome)) continue;
      // Regra 5: carga opaca do provedor OAuth.
      if (nome === "Account" && PODA_OAUTH.has(c.nome)) continue;
      const destino = fks.get(c.nome);
      if (destino) {
        // Chave estrangeira: e o atributo que leva a ligacao, e o alvo vem de
        // outro dominio. Anotar o destino mantem a informacao no diagrama sem
        // precisar trazer a entidade de fora.
        linhas.push(`    +${tipo} ${c.nome} FK -> ${destino}`);
        continue;
      }
      if (c.relacao) continue;
      linhas.push(`    +${tipo} ${c.nome}${c.chave}`);
    }
    // Entradas com rota viram operacao; entradas so com nota nao sao operacao,
    // e sim uma observacao sobre a classe. Colocadas como membro, apareceriam
    // no diagrama como se fossem atributos.
    for (const op of ops) {
      if (!op.nome) continue;
      // Regra 6: sem o caminho — ele mora no Quadro 5 e aqui so alarga a caixa.
      linhas.push(`    +${op.nome}${op.rota ? ` ${op.metodo}` : ""}`);
    }
    linhas.push("  }");
  }

  for (const nome of dominio.entidades) {
    const notas = OPERACOES.filter((o) => o.entidade === nome && !o.nome && o.nota);
    if (notas.length) {
      linhas.push(`  note for ${nome} "${notas.map((o) => o.nota).join(". ")}"`);
    }
  }

  for (const rel of relacoes) {
    if (!dominio.entidades.includes(rel.de)) continue;
    if (!dominio.entidades.includes(rel.alvo)) continue;
    // onDelete Cascade e composicao: o filho nao existe sem o pai. As demais
    // relacoes sao associacoes. No Mermaid a cardinalidade precisa de aspas, e
    // a composicao e o losango cheio, escrito *--.
    const seta = rel.onDelete === "Cascade" ? '*--' : '--';
    // Regra 7: sem rotulo na seta — o atributo FK na caixa ja diz o destino,
    // e rotulos repetidos ("user", "user") so empilham texto na borda.
    linhas.push(`  ${rel.de} "1" ${seta} "*" ${rel.alvo}`);
  }

  return linhas.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
function main() {
  const modelos = lerModelos();
  const relacoes = lerRelacoes();
  const rotas = lerRotas();

  const erros = [...conferirDominios(modelos), ...conferirOperacoes(rotas)];
  if (erros.length) {
    console.error(" diagrama fora de sincronia com o codigo:");
    for (const e of erros) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  if (!CHECK_ONLY) {
    mkdirSync(DIAGRAM_DIR, { recursive: true });
    mkdirSync(PNG_DIR, { recursive: true });
  }

  console.log(` entidades: ${modelos.size} | rotas: ${rotas.size} | operacoes: ${OPERACOES.length}`);
  console.log(` relacoes com chave estrangeira: ${relacoes.length}`);

  for (const dominio of DOMINIOS) {
    const mmd = gerarDominio(dominio, modelos, relacoes);
    const arquivo = join(DIAGRAM_DIR, `classe-${dominio.nome}.mmd`);
    if (CHECK_ONLY) {
      const atual = (() => { try { return readFileSync(arquivo, "utf8"); } catch { return null; } })();
      if (atual !== mmd) {
        console.error(`  - ${arquivo} esta desatualizado`);
        process.exitCode = 1;
      } else {
        console.log(`  ok  ${arquivo}`);
      }
    } else {
      writeFileSync(arquivo, mmd, "utf8");
      console.log(`  escrito  ${arquivo}`);
    }
  }
}

main();
