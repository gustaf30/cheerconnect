import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Position, CareerRole, ConnectionStatus, TeamCategory, EventType, InviteStatus, ProfileVisibility } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper para datas relativas
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // 1. Limpar dados existentes (ordem reversa de dependências)
  console.log("🗑️  Limpando dados existentes...");
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.commentLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.post.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.teamFollow.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.teamAchievement.deleteMany();
  await prisma.team.deleteMany();
  await prisma.careerHistory.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.event.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // 2. Criar usuários
  console.log("👥 Criando usuários...");
  const password = await bcrypt.hash("123456", 12);

  const usersData = [
    {
      email: "gustavo@test.com",
      name: "Gustavo Silva",
      username: "gustavo",
      password,
      avatar: "https://i.pravatar.cc/150?u=gustavo",
      banner: "https://picsum.photos/seed/gustavo/1200/400",
      bio: "Atleta de cheerleading há 5 anos. Apaixonado por stunts e pirâmides! 🎀",
      location: "São Paulo, SP",
      birthDate: new Date("1998-05-15"),
      positions: [Position.BASE, Position.BACKSPOT],
      experience: 5,
      skills: ["Stunts", "Pirâmides", "Tosses", "Baskets"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "maria@test.com",
      name: "Maria Santos",
      username: "maria_cheer",
      password,
      avatar: "https://i.pravatar.cc/150?u=maria",
      banner: "https://picsum.photos/seed/maria/1200/400",
      bio: "Flyer desde sempre! ✨ Competidora nacional.",
      location: "Rio de Janeiro, RJ",
      birthDate: new Date("2001-08-22"),
      positions: [Position.FLYER],
      experience: 6,
      skills: ["Flexibility", "Body positions", "Stunts", "Tumbling"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "joao@test.com",
      name: "João Oliveira",
      username: "joao_base",
      password,
      avatar: "https://i.pravatar.cc/150?u=joao",
      bio: "Main base e tumbler 💪",
      location: "Belo Horizonte, MG",
      positions: [Position.BASE, Position.TUMBLER],
      experience: 4,
      skills: ["Tumbling", "Stunts", "Conditioning"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "ana@test.com",
      name: "Ana Costa",
      username: "ana_coach",
      password,
      avatar: "https://i.pravatar.cc/150?u=ana",
      banner: "https://picsum.photos/seed/ana/1200/400",
      bio: "Técnica certificada USASF Level 5. Formando campeões há 10 anos.",
      location: "Curitiba, PR",
      birthDate: new Date("1985-03-10"),
      positions: [Position.COACH],
      experience: 15,
      skills: ["Coaching", "Choreography", "Team Management", "Safety"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "lucas@test.com",
      name: "Lucas Ferreira",
      username: "lucas_tumbler",
      password,
      avatar: "https://i.pravatar.cc/150?u=lucas",
      bio: "Especialista em tumbling 🤸‍♂️ Full twist e além!",
      location: "Porto Alegre, RS",
      positions: [Position.TUMBLER, Position.BASE],
      experience: 7,
      skills: ["Tumbling", "Standing tumbling", "Running tumbling"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "julia@test.com",
      name: "Julia Lima",
      username: "julia_flyer",
      password,
      avatar: "https://i.pravatar.cc/150?u=julia",
      bio: "Flyer competitiva 🌟",
      location: "Salvador, BA",
      birthDate: new Date("2003-11-28"),
      positions: [Position.FLYER],
      experience: 3,
      skills: ["Flexibility", "Stunts"],
      profileVisibility: ProfileVisibility.CONNECTIONS_ONLY,
    },
    {
      email: "pedro@test.com",
      name: "Pedro Souza",
      username: "pedro_back",
      password,
      avatar: "https://i.pravatar.cc/150?u=pedro",
      bio: "Backspot dedicado! Segurança em primeiro lugar.",
      location: "Recife, PE",
      positions: [Position.BACKSPOT, Position.FRONTSPOT],
      experience: 4,
      skills: ["Spotting", "Safety", "Stunts"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "carla@test.com",
      name: "Carla Mendes",
      username: "carla_choreo",
      password,
      avatar: "https://i.pravatar.cc/150?u=carla",
      banner: "https://picsum.photos/seed/carla/1200/400",
      bio: "Coreógrafa profissional 💃 Criando rotinas premiadas.",
      location: "Florianópolis, SC",
      birthDate: new Date("1990-07-05"),
      positions: [Position.CHOREOGRAPHER],
      experience: 12,
      skills: ["Choreography", "Dance", "Music editing", "Creativity"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "rafael@test.com",
      name: "Rafael Alves",
      username: "rafa_cheer",
      password,
      avatar: "https://i.pravatar.cc/150?u=rafael",
      bio: "Novo no cheerleading, aprendendo muito! 🚀",
      location: "Brasília, DF",
      positions: [Position.OTHER],
      experience: 1,
      skills: ["Dance", "Conditioning"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
    {
      email: "fernanda@test.com",
      name: "Fernanda Rocha",
      username: "fer_judge",
      password,
      avatar: "https://i.pravatar.cc/150?u=fernanda",
      bio: "Juíza credenciada. Ex-atleta, agora avaliando talentos.",
      location: "Fortaleza, CE",
      birthDate: new Date("1982-01-20"),
      positions: [Position.JUDGE],
      experience: 20,
      skills: ["Judging", "Rules knowledge", "Scoring"],
      profileVisibility: ProfileVisibility.PUBLIC,
    },
  ];

  const users = await Promise.all(
    usersData.map((data) => prisma.user.create({ data }))
  );

  const [gustavo, maria, joao, ana, lucas, julia, pedro, carla, rafael, fernanda] = users;

  // 3. Criar conexões
  console.log("🤝 Criando conexões...");
  const connectionsData = [
    // Gustavo conectado com vários
    { senderId: gustavo.id, receiverId: maria.id, status: ConnectionStatus.ACCEPTED },
    { senderId: gustavo.id, receiverId: joao.id, status: ConnectionStatus.ACCEPTED },
    { senderId: gustavo.id, receiverId: ana.id, status: ConnectionStatus.ACCEPTED },
    { senderId: gustavo.id, receiverId: lucas.id, status: ConnectionStatus.ACCEPTED },
    { senderId: gustavo.id, receiverId: carla.id, status: ConnectionStatus.ACCEPTED },
    // Conexões pendentes para Gustavo
    { senderId: julia.id, receiverId: gustavo.id, status: ConnectionStatus.PENDING },
    { senderId: rafael.id, receiverId: gustavo.id, status: ConnectionStatus.PENDING },
    // Outras conexões aceitas
    { senderId: maria.id, receiverId: joao.id, status: ConnectionStatus.ACCEPTED },
    { senderId: maria.id, receiverId: ana.id, status: ConnectionStatus.ACCEPTED },
    { senderId: maria.id, receiverId: lucas.id, status: ConnectionStatus.ACCEPTED },
    { senderId: joao.id, receiverId: lucas.id, status: ConnectionStatus.ACCEPTED },
    { senderId: ana.id, receiverId: carla.id, status: ConnectionStatus.ACCEPTED },
    { senderId: ana.id, receiverId: fernanda.id, status: ConnectionStatus.ACCEPTED },
    { senderId: pedro.id, receiverId: joao.id, status: ConnectionStatus.ACCEPTED },
    { senderId: pedro.id, receiverId: lucas.id, status: ConnectionStatus.ACCEPTED },
    // Mais pendentes
    { senderId: fernanda.id, receiverId: maria.id, status: ConnectionStatus.PENDING },
    { senderId: carla.id, receiverId: julia.id, status: ConnectionStatus.PENDING },
  ];

  await Promise.all(
    connectionsData.map((data) => prisma.connection.create({ data }))
  );

  // 4. Criar equipes
  console.log("🏆 Criando equipes...");
  const teamsData = [
    {
      name: "Thunder Allstars",
      slug: "thunder-allstars",
      description: "Equipe competitiva de cheerleading allstar. Campeões estaduais 2023! Treinamos atletas de todos os níveis.",
      logo: "https://api.dicebear.com/7.x/shapes/svg?seed=thunder",
      banner: "https://picsum.photos/seed/thunder/1200/400",
      location: "São Paulo, SP",
      foundedAt: new Date("2015-03-01"),
      website: "https://thunderallstars.com.br",
      instagram: "@thunderallstars",
      category: TeamCategory.ALLSTAR,
      level: "Level 5",
    },
    {
      name: "Eagles Cheer",
      slug: "eagles-cheer",
      description: "Time universitário de cheerleading. Go Eagles! 🦅",
      logo: "https://api.dicebear.com/7.x/shapes/svg?seed=eagles",
      banner: "https://picsum.photos/seed/eagles/1200/400",
      location: "Rio de Janeiro, RJ",
      foundedAt: new Date("2018-08-15"),
      instagram: "@eaglescheer",
      category: TeamCategory.COLLEGE,
      level: "Level 3",
    },
    {
      name: "Spark Youth",
      slug: "spark-youth",
      description: "Cheerleading recreativo para jovens. Diversão e aprendizado!",
      logo: "https://api.dicebear.com/7.x/shapes/svg?seed=spark",
      location: "Curitiba, PR",
      foundedAt: new Date("2020-01-10"),
      category: TeamCategory.RECREATIONAL,
    },
    {
      name: "Lions School Team",
      slug: "lions-school",
      description: "Time de cheerleading do Colégio Lions. Representando nossa escola!",
      logo: "https://api.dicebear.com/7.x/shapes/svg?seed=lions",
      banner: "https://picsum.photos/seed/lions/1200/400",
      location: "Belo Horizonte, MG",
      foundedAt: new Date("2019-02-20"),
      category: TeamCategory.SCHOOL,
      level: "Level 2",
    },
    {
      name: "Elite Cheer Brasil",
      slug: "elite-cheer-brasil",
      description: "Equipe profissional de cheerleading. Representamos o Brasil em competições internacionais.",
      logo: "https://api.dicebear.com/7.x/shapes/svg?seed=elite",
      banner: "https://picsum.photos/seed/elite/1200/400",
      location: "São Paulo, SP",
      foundedAt: new Date("2010-05-01"),
      website: "https://elitecheer.com.br",
      instagram: "@elitecheerbrasil",
      category: TeamCategory.PROFESSIONAL,
      level: "Level 6",
    },
  ];

  const teams = await Promise.all(
    teamsData.map((data) => prisma.team.create({ data }))
  );

  const [thunder, eagles, spark, lions, elite] = teams;

  // 5. Criar membros de equipe
  console.log("👥 Adicionando membros às equipes...");
  const teamMembersData = [
    // Thunder Allstars
    { userId: gustavo.id, teamId: thunder.id, role: "Atleta", position: "Base", isAdmin: false, hasPermission: false },
    { userId: maria.id, teamId: thunder.id, role: "Atleta", position: "Flyer", isAdmin: false, hasPermission: false },
    { userId: ana.id, teamId: thunder.id, role: "Técnica", isAdmin: true, hasPermission: true },
    { userId: lucas.id, teamId: thunder.id, role: "Atleta", position: "Tumbler", isAdmin: false, hasPermission: false },
    { userId: carla.id, teamId: thunder.id, role: "Coreógrafa", isAdmin: false, hasPermission: true },
    // Eagles Cheer
    { userId: maria.id, teamId: eagles.id, role: "Capitã", position: "Flyer", isAdmin: true, hasPermission: true },
    { userId: joao.id, teamId: eagles.id, role: "Atleta", position: "Base", isAdmin: false, hasPermission: false },
    { userId: pedro.id, teamId: eagles.id, role: "Atleta", position: "Backspot", isAdmin: false, hasPermission: false },
    // Spark Youth
    { userId: ana.id, teamId: spark.id, role: "Técnica", isAdmin: true, hasPermission: true },
    { userId: rafael.id, teamId: spark.id, role: "Atleta", isAdmin: false, hasPermission: false },
    // Lions School
    { userId: joao.id, teamId: lions.id, role: "Capitão", position: "Base", isAdmin: true, hasPermission: true },
    { userId: julia.id, teamId: lions.id, role: "Atleta", position: "Flyer", isAdmin: false, hasPermission: false },
    // Elite Cheer Brasil
    { userId: lucas.id, teamId: elite.id, role: "Atleta Principal", position: "Tumbler", isAdmin: false, hasPermission: true },
    { userId: fernanda.id, teamId: elite.id, role: "Diretora", isAdmin: true, hasPermission: true },
    // Membro inativo
    { userId: pedro.id, teamId: thunder.id, role: "Ex-Atleta", position: "Backspot", isAdmin: false, hasPermission: false, isActive: false, leftAt: daysAgo(60) },
  ];

  await Promise.all(
    teamMembersData.map((data) => prisma.teamMember.create({ data }))
  );

  // 6. Criar team follows
  console.log("➕ Criando follows de equipes...");
  const teamFollowsData = [
    { userId: gustavo.id, teamId: eagles.id },
    { userId: gustavo.id, teamId: elite.id },
    { userId: maria.id, teamId: spark.id },
    { userId: joao.id, teamId: thunder.id },
    { userId: rafael.id, teamId: thunder.id },
    { userId: rafael.id, teamId: eagles.id },
    { userId: julia.id, teamId: thunder.id },
    { userId: pedro.id, teamId: elite.id },
  ];

  await Promise.all(
    teamFollowsData.map((data) => prisma.teamFollow.create({ data }))
  );

  // 7. Criar posts
  console.log("📝 Criando posts...");
  const postsData = [
    // Posts do Gustavo
    {
      content: "Primeiro treino do ano! Animado para a temporada 2024. Vamos com tudo Thunder! ⚡🎀",
      authorId: gustavo.id,
      images: ["https://picsum.photos/seed/post1/800/600"],
      createdAt: daysAgo(15),
    },
    {
      content: "Conseguimos fazer a pirâmide perfeita hoje! Muito orgulho do time. 🏆",
      authorId: gustavo.id,
      createdAt: daysAgo(10),
    },
    {
      content: "Treino intenso hoje. Stunts level 5 finalmente saindo! 💪",
      authorId: gustavo.id,
      images: [
        "https://picsum.photos/seed/post3a/800/600",
        "https://picsum.photos/seed/post3b/800/600",
      ],
      createdAt: daysAgo(5),
    },
    // Posts da Maria
    {
      content: "Novo stretch routine que estou fazendo todos os dias. Flexibilidade é tudo para uma flyer! 🧘‍♀️",
      authorId: maria.id,
      videoUrl: "https://www.youtube.com/watch?v=example",
      createdAt: daysAgo(12),
    },
    {
      content: "Amando fazer parte do Eagles! Melhor decisão que tomei 🦅💙",
      authorId: maria.id,
      teamId: eagles.id,
      createdAt: daysAgo(8),
    },
    {
      content: "Liberty hoje estava perfeita! Cada dia evoluindo mais ✨",
      authorId: maria.id,
      images: ["https://picsum.photos/seed/post6/800/600"],
      createdAt: daysAgo(3),
    },
    // Posts do João
    {
      content: "Dica de base: mantenham os cotovelos travados e o core ativado. Faz toda a diferença! 💡",
      authorId: joao.id,
      createdAt: daysAgo(20),
    },
    {
      content: "Competição no próximo mês! Quem mais vai estar lá? 🏆",
      authorId: joao.id,
      createdAt: daysAgo(7),
    },
    // Posts da Ana (técnica)
    {
      content: "Dicas para técnicos: sempre priorizem a segurança. Progressão é melhor que pressa.",
      authorId: ana.id,
      createdAt: daysAgo(18),
    },
    {
      content: "Workshop de stunts neste sábado no Thunder! Vagas limitadas. 📚",
      authorId: ana.id,
      teamId: thunder.id,
      images: [
        "https://picsum.photos/seed/post10a/800/600",
        "https://picsum.photos/seed/post10b/800/600",
        "https://picsum.photos/seed/post10c/800/600",
      ],
      createdAt: daysAgo(4),
    },
    // Posts do Lucas
    {
      content: "Full twist finalmente saindo consistente! Foram meses de treino 🤸‍♂️",
      authorId: lucas.id,
      videoUrl: "https://www.youtube.com/watch?v=example2",
      createdAt: daysAgo(14),
    },
    {
      content: "Quem precisa de spotting para tumbling? Posso ajudar no próximo open gym!",
      authorId: lucas.id,
      createdAt: daysAgo(2),
    },
    // Posts de equipe
    {
      content: "Thunder Allstars: Inscrições abertas para a temporada 2024! Venha fazer parte da nossa família. Link na bio 🌟",
      authorId: ana.id,
      teamId: thunder.id,
      images: [
        "https://picsum.photos/seed/post13a/800/600",
        "https://picsum.photos/seed/post13b/800/600",
        "https://picsum.photos/seed/post13c/800/600",
        "https://picsum.photos/seed/post13d/800/600",
      ],
      createdAt: daysAgo(25),
    },
    {
      content: "Eagles Cheer busca novos talentos! Seletiva dia 15. Venha mostrar seu potencial! 🦅",
      authorId: maria.id,
      teamId: eagles.id,
      createdAt: daysAgo(6),
    },
    // Mais posts variados
    {
      content: "Alguém tem recomendação de tênis bom para tumbling? O meu já está acabando 👟",
      authorId: pedro.id,
      createdAt: daysAgo(9),
    },
    {
      content: "Elite Cheer Brasil classificado para o mundial! 🇧🇷🏆",
      authorId: fernanda.id,
      teamId: elite.id,
      images: ["https://picsum.photos/seed/post16/800/600"],
      createdAt: daysAgo(1),
    },
    {
      content: "Primeira semana de treino concluída! Estou exausto mas muito feliz 😅",
      authorId: rafael.id,
      createdAt: daysAgo(11),
    },
    {
      content: "Coreografia nova ficou incrível! Mal posso esperar para mostrar na competição 💃",
      authorId: carla.id,
      createdAt: daysAgo(3),
    },
    {
      content: "Parabéns ao Thunder pelo título estadual! Orgulho de fazer parte dessa história.",
      authorId: gustavo.id,
      teamId: thunder.id,
      createdAt: daysAgo(30),
    },
    {
      content: "Treino de conditioning hoje foi pesado, mas necessário. No pain no gain! 🔥",
      authorId: julia.id,
      createdAt: daysAgo(5),
    },
  ];

  const posts = await Promise.all(
    postsData.map((data) => prisma.post.create({ data }))
  );

  // 8. Criar reposts
  console.log("🔄 Criando reposts...");
  const repostsData = [
    {
      content: "Isso mesmo! 👏",
      authorId: maria.id,
      originalPostId: posts[0].id, // Repost do primeiro post do Gustavo
      createdAt: daysAgo(14),
    },
    {
      content: "Melhor equipe! ⚡",
      authorId: lucas.id,
      originalPostId: posts[12].id, // Repost do post de inscrições do Thunder
      createdAt: daysAgo(24),
    },
    {
      content: "",
      authorId: joao.id,
      originalPostId: posts[15].id, // Repost do Elite mundial
      createdAt: daysAgo(0),
    },
  ];

  await Promise.all(
    repostsData.map((data) => prisma.post.create({ data }))
  );

  // 9. Criar comentários
  console.log("💬 Criando comentários...");
  const commentsData = [
    // Comentários no primeiro post do Gustavo
    { content: "Vamos arrasar! 💪", authorId: maria.id, postId: posts[0].id, createdAt: daysAgo(14) },
    { content: "Bora time!", authorId: joao.id, postId: posts[0].id, createdAt: daysAgo(14) },
    { content: "Contando os dias pro primeiro campeonato!", authorId: lucas.id, postId: posts[0].id, createdAt: daysAgo(13) },
    // Comentários no post da pirâmide
    { content: "Ficou linda demais! 😍", authorId: ana.id, postId: posts[1].id, createdAt: daysAgo(9) },
    { content: "Parabéns equipe!", authorId: carla.id, postId: posts[1].id, createdAt: daysAgo(9) },
    // Comentários no post de stretch da Maria
    { content: "Pode compartilhar a rotina completa?", authorId: julia.id, postId: posts[3].id, createdAt: daysAgo(11) },
    { content: "Também quero saber!", authorId: rafael.id, postId: posts[3].id, createdAt: daysAgo(11) },
    // Comentários no post de dica do João
    { content: "Ótima dica! Vou prestar mais atenção nisso.", authorId: gustavo.id, postId: posts[6].id, createdAt: daysAgo(19) },
    { content: "Core ativado é fundamental mesmo!", authorId: pedro.id, postId: posts[6].id, createdAt: daysAgo(18) },
    // Comentários no workshop
    { content: "Já me inscrevi! 🙋‍♀️", authorId: maria.id, postId: posts[9].id, createdAt: daysAgo(3) },
    { content: "Vagas ainda disponíveis?", authorId: julia.id, postId: posts[9].id, createdAt: daysAgo(3) },
    { content: "Ainda temos algumas!", authorId: ana.id, postId: posts[9].id, createdAt: daysAgo(2) },
    // Comentários no full twist do Lucas
    { content: "Sensacional! 🔥", authorId: gustavo.id, postId: posts[10].id, createdAt: daysAgo(13) },
    { content: "Parabéns pela evolução!", authorId: ana.id, postId: posts[10].id, createdAt: daysAgo(13) },
    { content: "Goals! 😍", authorId: rafael.id, postId: posts[10].id, createdAt: daysAgo(12) },
    // Comentários no post de inscrições
    { content: "Melhor equipe de SP!", authorId: gustavo.id, postId: posts[12].id, createdAt: daysAgo(24) },
    { content: "Recomendo demais! Ambiente incrível.", authorId: maria.id, postId: posts[12].id, createdAt: daysAgo(23) },
    // Comentários no post do tênis
    { content: "Nfinity é ótimo!", authorId: maria.id, postId: posts[14].id, createdAt: daysAgo(8) },
    { content: "Eu uso Varsity, muito bom também.", authorId: lucas.id, postId: posts[14].id, createdAt: daysAgo(8) },
    { content: "Obrigado pelas dicas!", authorId: pedro.id, postId: posts[14].id, createdAt: daysAgo(7) },
    // Comentários no mundial
    { content: "Que orgulho do Brasil! 🇧🇷", authorId: gustavo.id, postId: posts[15].id, createdAt: daysAgo(0) },
    { content: "Merecidíssimo!", authorId: ana.id, postId: posts[15].id, createdAt: daysAgo(0) },
    { content: "Vamos torcer muito!", authorId: maria.id, postId: posts[15].id, createdAt: daysAgo(0) },
    { content: "Elite sempre representando!", authorId: lucas.id, postId: posts[15].id, createdAt: daysAgo(0) },
  ];

  const comments = await Promise.all(
    commentsData.map((data) => prisma.comment.create({ data }))
  );

  // 10. Criar respostas a comentários
  console.log("↩️  Criando respostas a comentários...");
  const repliesData = [
    { content: "Sim! Vou fazer um post detalhado 😊", authorId: maria.id, postId: posts[3].id, parentId: comments[5].id },
    { content: "Perfeito, obrigada!", authorId: julia.id, postId: posts[3].id, parentId: comments[5].id },
    { content: "@julia_flyer sim, corre lá no site!", authorId: ana.id, postId: posts[9].id, parentId: comments[10].id },
    { content: "Valeu! Acabei de comprar!", authorId: pedro.id, postId: posts[14].id, parentId: comments[17].id },
  ];

  await Promise.all(
    repliesData.map((data) => prisma.comment.create({ data }))
  );

  // 11. Criar likes em posts
  console.log("❤️  Criando likes em posts...");
  const likesData = [
    // Muitos likes no primeiro post do Gustavo
    { userId: maria.id, postId: posts[0].id },
    { userId: joao.id, postId: posts[0].id },
    { userId: ana.id, postId: posts[0].id },
    { userId: lucas.id, postId: posts[0].id },
    { userId: carla.id, postId: posts[0].id },
    { userId: pedro.id, postId: posts[0].id },
    // Likes no post da pirâmide
    { userId: maria.id, postId: posts[1].id },
    { userId: ana.id, postId: posts[1].id },
    { userId: lucas.id, postId: posts[1].id },
    // Likes no stretch da Maria
    { userId: gustavo.id, postId: posts[3].id },
    { userId: julia.id, postId: posts[3].id },
    { userId: ana.id, postId: posts[3].id },
    // Likes variados
    { userId: gustavo.id, postId: posts[4].id },
    { userId: gustavo.id, postId: posts[10].id },
    { userId: maria.id, postId: posts[10].id },
    { userId: joao.id, postId: posts[10].id },
    { userId: ana.id, postId: posts[10].id },
    { userId: gustavo.id, postId: posts[12].id },
    { userId: maria.id, postId: posts[12].id },
    { userId: lucas.id, postId: posts[12].id },
    { userId: joao.id, postId: posts[12].id },
    { userId: pedro.id, postId: posts[12].id },
    { userId: rafael.id, postId: posts[12].id },
    { userId: gustavo.id, postId: posts[15].id },
    { userId: maria.id, postId: posts[15].id },
    { userId: joao.id, postId: posts[15].id },
    { userId: ana.id, postId: posts[15].id },
    { userId: lucas.id, postId: posts[15].id },
    { userId: carla.id, postId: posts[15].id },
    { userId: pedro.id, postId: posts[15].id },
    { userId: rafael.id, postId: posts[15].id },
    // Mais likes
    { userId: maria.id, postId: posts[2].id },
    { userId: gustavo.id, postId: posts[5].id },
    { userId: gustavo.id, postId: posts[17].id },
    { userId: maria.id, postId: posts[17].id },
  ];

  await Promise.all(
    likesData.map((data) => prisma.like.create({ data }))
  );

  // 12. Criar likes em comentários
  console.log("💕 Criando likes em comentários...");
  const commentLikesData = [
    { userId: gustavo.id, commentId: comments[0].id },
    { userId: joao.id, commentId: comments[0].id },
    { userId: maria.id, commentId: comments[3].id },
    { userId: gustavo.id, commentId: comments[3].id },
    { userId: ana.id, commentId: comments[12].id },
    { userId: maria.id, commentId: comments[12].id },
    { userId: gustavo.id, commentId: comments[20].id },
    { userId: maria.id, commentId: comments[20].id },
    { userId: lucas.id, commentId: comments[20].id },
  ];

  await Promise.all(
    commentLikesData.map((data) => prisma.commentLike.create({ data }))
  );

  // 13. Criar eventos
  console.log("📅 Criando eventos...");
  const eventsData = [
    // Eventos passados
    {
      name: "Campeonato Estadual de Cheerleading SP 2024",
      description: "O maior campeonato estadual de cheerleading de São Paulo. Equipes de todos os níveis competindo pelo título.",
      location: "Ginásio do Ibirapuera, São Paulo, SP",
      startDate: daysAgo(30),
      endDate: daysAgo(29),
      type: EventType.COMPETITION,
      creatorId: ana.id,
      teamId: thunder.id,
    },
    {
      name: "Workshop de Tumbling Avançado",
      description: "Workshop focado em tumbling de nível avançado. Full, Double Full e mais.",
      location: "Thunder Gym, São Paulo, SP",
      startDate: daysAgo(14),
      type: EventType.WORKSHOP,
      creatorId: lucas.id,
      teamId: thunder.id,
    },
    // Eventos futuros
    {
      name: "Seletiva Eagles Cheer 2024",
      description: "Seletiva para novos atletas do Eagles Cheer. Traga roupa de treino e muita energia!",
      location: "Universidade Federal, Rio de Janeiro, RJ",
      startDate: daysFromNow(15),
      type: EventType.TRYOUT,
      creatorId: maria.id,
      teamId: eagles.id,
    },
    {
      name: "Camp de Verão CheerBrasil",
      description: "Uma semana intensiva de treinamento com os melhores técnicos do país. Stunts, tumbling, dança e muito mais!",
      location: "Resort Costa Verde, Angra dos Reis, RJ",
      startDate: daysFromNow(45),
      endDate: daysFromNow(52),
      type: EventType.CAMP,
      creatorId: fernanda.id,
    },
    {
      name: "Showcase Thunder Allstars",
      description: "Apresentação de fim de temporada do Thunder Allstars. Venha assistir nossas rotinas!",
      location: "Teatro Municipal, São Paulo, SP",
      startDate: daysFromNow(7),
      type: EventType.SHOWCASE,
      creatorId: ana.id,
      teamId: thunder.id,
    },
    {
      name: "Campeonato Nacional de Cheerleading 2024",
      description: "O maior evento de cheerleading do Brasil. As melhores equipes do país competindo pelo título nacional.",
      location: "Arena Multiuso, Brasília, DF",
      startDate: daysFromNow(60),
      endDate: daysFromNow(62),
      type: EventType.COMPETITION,
      creatorId: fernanda.id,
    },
    {
      name: "Workshop de Coreografia",
      description: "Aprenda técnicas de coreografia com Carla Mendes. Do conceito à execução.",
      location: "Studio Dance, Florianópolis, SC",
      startDate: daysFromNow(20),
      type: EventType.WORKSHOP,
      creatorId: carla.id,
    },
    {
      name: "Open Gym Elite",
      description: "Treino aberto para atletas de todos os níveis. Venha treinar com o Elite!",
      location: "Elite Gym, São Paulo, SP",
      startDate: daysFromNow(3),
      type: EventType.OTHER,
      creatorId: lucas.id,
      teamId: elite.id,
    },
  ];

  await Promise.all(
    eventsData.map((data) => prisma.event.create({ data }))
  );

  // 14. Criar histórico de carreira
  console.log("📋 Criando histórico de carreira...");
  const careerData = [
    // Gustavo
    {
      userId: gustavo.id,
      role: CareerRole.ATHLETE,
      positions: [Position.BASE, Position.BACKSPOT],
      teamName: "Thunder Allstars",
      teamId: thunder.id,
      startDate: new Date("2019-03-01"),
      isCurrent: true,
      location: "São Paulo, SP",
      description: "Atleta de base e backspot. Participação em campeonatos estaduais e nacionais.",
    },
    {
      userId: gustavo.id,
      role: CareerRole.ATHLETE,
      positions: [Position.BASE],
      teamName: "Iniciantes Cheer",
      startDate: new Date("2017-01-01"),
      endDate: new Date("2019-02-28"),
      isCurrent: false,
      location: "São Paulo, SP",
      description: "Primeiros passos no cheerleading.",
    },
    // Maria
    {
      userId: maria.id,
      role: CareerRole.ATHLETE,
      positions: [Position.FLYER],
      teamName: "Thunder Allstars",
      teamId: thunder.id,
      startDate: new Date("2020-01-01"),
      isCurrent: true,
      location: "São Paulo, SP",
    },
    {
      userId: maria.id,
      role: CareerRole.ATHLETE,
      positions: [Position.FLYER],
      teamName: "Eagles Cheer",
      teamId: eagles.id,
      startDate: new Date("2018-08-01"),
      isCurrent: true,
      location: "Rio de Janeiro, RJ",
      description: "Capitã da equipe universitária.",
    },
    // Ana
    {
      userId: ana.id,
      role: CareerRole.COACH,
      positions: [Position.COACH],
      teamName: "Thunder Allstars",
      teamId: thunder.id,
      startDate: new Date("2015-03-01"),
      isCurrent: true,
      location: "São Paulo, SP",
      description: "Head Coach. Certificação USASF Level 5.",
    },
    {
      userId: ana.id,
      role: CareerRole.ATHLETE,
      positions: [Position.FLYER, Position.BASE],
      teamName: "Champions Cheer",
      startDate: new Date("2000-01-01"),
      endDate: new Date("2012-12-31"),
      isCurrent: false,
      location: "Curitiba, PR",
      description: "Carreira como atleta antes de se tornar técnica.",
    },
    // Lucas
    {
      userId: lucas.id,
      role: CareerRole.ATHLETE,
      positions: [Position.TUMBLER, Position.BASE],
      teamName: "Elite Cheer Brasil",
      teamId: elite.id,
      startDate: new Date("2022-01-01"),
      isCurrent: true,
      location: "São Paulo, SP",
    },
    // Fernanda
    {
      userId: fernanda.id,
      role: CareerRole.JUDGE,
      positions: [Position.JUDGE],
      teamName: "Federação Brasileira de Cheerleading",
      startDate: new Date("2015-01-01"),
      isCurrent: true,
      location: "Fortaleza, CE",
      description: "Juíza credenciada nível nacional.",
    },
    {
      userId: fernanda.id,
      role: CareerRole.ATHLETE,
      positions: [Position.FLYER],
      teamName: "Stars Cheer",
      startDate: new Date("1995-01-01"),
      endDate: new Date("2010-12-31"),
      isCurrent: false,
      location: "Fortaleza, CE",
      description: "15 anos como atleta competitiva.",
    },
    // Carla
    {
      userId: carla.id,
      role: CareerRole.CHOREOGRAPHER,
      positions: [Position.CHOREOGRAPHER],
      teamName: "Thunder Allstars",
      teamId: thunder.id,
      startDate: new Date("2018-01-01"),
      isCurrent: true,
      location: "São Paulo, SP",
      description: "Responsável pelas coreografias das rotinas de competição.",
    },
  ];

  await Promise.all(
    careerData.map((data) => prisma.careerHistory.create({ data }))
  );

  // 15. Criar conquistas pessoais
  console.log("🏅 Criando conquistas pessoais...");
  const achievementsData = [
    { userId: gustavo.id, title: "Campeão Estadual SP 2023", description: "1º lugar com Thunder Allstars", date: new Date("2023-11-15"), category: "Competição" },
    { userId: gustavo.id, title: "Melhor Stunt Group", description: "Prêmio especial no Campeonato Regional", date: new Date("2022-09-20"), category: "Prêmio" },
    { userId: maria.id, title: "Campeã Nacional 2022", description: "1º lugar categoria Senior Level 5", date: new Date("2022-11-10"), category: "Competição" },
    { userId: maria.id, title: "Melhor Flyer", description: "Destaque individual no Campeonato Estadual RJ", date: new Date("2023-10-05"), category: "Prêmio" },
    { userId: lucas.id, title: "Campeão de Tumbling", description: "1º lugar categoria Elite no Tumbling Fest", date: new Date("2023-07-15"), category: "Competição" },
    { userId: ana.id, title: "Técnica do Ano 2022", description: "Reconhecimento da Federação Estadual", date: new Date("2022-12-01"), category: "Prêmio" },
    { userId: fernanda.id, title: "Credenciamento Internacional", description: "Certificação de juíza internacional", date: new Date("2020-03-10"), category: "Certificação" },
  ];

  await Promise.all(
    achievementsData.map((data) => prisma.achievement.create({ data }))
  );

  // 16. Criar conquistas de equipe
  console.log("🏆 Criando conquistas de equipes...");
  const teamAchievementsData = [
    { teamId: thunder.id, title: "Campeão Estadual SP 2023", description: "1º lugar categoria Senior Level 5", date: new Date("2023-11-15"), category: "Competição" },
    { teamId: thunder.id, title: "Vice-Campeão Nacional 2023", description: "2º lugar no Campeonato Nacional", date: new Date("2023-12-10"), category: "Competição" },
    { teamId: thunder.id, title: "Melhor Coreografia 2022", description: "Prêmio especial pela coreografia criativa", date: new Date("2022-11-20"), category: "Prêmio" },
    { teamId: eagles.id, title: "Campeão Universitário RJ 2023", description: "1º lugar na liga universitária", date: new Date("2023-10-25"), category: "Competição" },
    { teamId: elite.id, title: "Representante Brasil Worlds 2024", description: "Classificado para o mundial", date: new Date("2024-01-15"), category: "Classificação" },
    { teamId: elite.id, title: "Tricampeão Nacional", description: "3 títulos consecutivos", date: new Date("2023-12-10"), category: "Competição" },
  ];

  await Promise.all(
    teamAchievementsData.map((data) => prisma.teamAchievement.create({ data }))
  );

  // 17. Criar conversas e mensagens
  console.log("💬 Criando conversas e mensagens...");

  // Conversa 1: Gustavo e Maria
  const conv1 = await prisma.conversation.create({
    data: {
      participant1Id: gustavo.id,
      participant2Id: maria.id,
      lastMessageAt: daysAgo(0),
      lastMessagePreview: "Combinado! Até amanhã então 😊",
    },
  });

  const conv1Messages = [
    { conversationId: conv1.id, senderId: gustavo.id, content: "Oi Maria! Tudo bem?", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv1.id, senderId: maria.id, content: "Oi Gustavo! Tudo ótimo e você?", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv1.id, senderId: gustavo.id, content: "Bem também! Vi que você vai no workshop de sábado", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv1.id, senderId: maria.id, content: "Sim! Super animada. Você também vai?", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv1.id, senderId: gustavo.id, content: "Vou sim! A Ana organizou tudo muito bem", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv1.id, senderId: maria.id, content: "Ela é incrível mesmo. Podemos ir juntos se quiser", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv1.id, senderId: gustavo.id, content: "Boa ideia! Te encontro na entrada às 9h?", isRead: true, createdAt: daysAgo(0) },
    { conversationId: conv1.id, senderId: maria.id, content: "Combinado! Até amanhã então 😊", isRead: true, createdAt: daysAgo(0) },
  ];

  await Promise.all(conv1Messages.map((data) => prisma.message.create({ data })));

  // Conversa 2: Gustavo e Ana
  const conv2 = await prisma.conversation.create({
    data: {
      participant1Id: gustavo.id,
      participant2Id: ana.id,
      lastMessageAt: daysAgo(1),
      lastMessagePreview: "Perfeito, obrigado Ana!",
    },
  });

  const conv2Messages = [
    { conversationId: conv2.id, senderId: ana.id, content: "Gustavo, preciso falar sobre o treino de quinta", isRead: true, createdAt: daysAgo(3) },
    { conversationId: conv2.id, senderId: gustavo.id, content: "Claro! O que houve?", isRead: true, createdAt: daysAgo(3) },
    { conversationId: conv2.id, senderId: ana.id, content: "Vamos focar em tosses. Preciso que você esteja 100%", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv2.id, senderId: gustavo.id, content: "Pode deixar! Vou descansar bem antes", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv2.id, senderId: ana.id, content: "Ótimo! Também vamos revisar as transições da rotina", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv2.id, senderId: gustavo.id, content: "Perfeito, obrigado Ana!", isRead: true, createdAt: daysAgo(1) },
  ];

  await Promise.all(conv2Messages.map((data) => prisma.message.create({ data })));

  // Conversa 3: Gustavo e Lucas (com mensagens não lidas)
  const conv3 = await prisma.conversation.create({
    data: {
      participant1Id: gustavo.id,
      participant2Id: lucas.id,
      lastMessageAt: daysAgo(0),
      lastMessagePreview: "Bora treinar junto essa semana?",
    },
  });

  const conv3Messages = [
    { conversationId: conv3.id, senderId: gustavo.id, content: "E aí Lucas! Parabéns pelo full twist!", isRead: true, createdAt: daysAgo(5) },
    { conversationId: conv3.id, senderId: lucas.id, content: "Valeu mano! Demorou mas saiu kkk", isRead: true, createdAt: daysAgo(5) },
    { conversationId: conv3.id, senderId: gustavo.id, content: "O importante é que saiu! Muito top", isRead: true, createdAt: daysAgo(4) },
    { conversationId: conv3.id, senderId: lucas.id, content: "Bora treinar junto essa semana?", isRead: false, createdAt: daysAgo(0) },
  ];

  await Promise.all(conv3Messages.map((data) => prisma.message.create({ data })));

  // Conversa 4: Gustavo e Carla
  const conv4 = await prisma.conversation.create({
    data: {
      participant1Id: gustavo.id,
      participant2Id: carla.id,
      lastMessageAt: daysAgo(3),
      lastMessagePreview: "Vou te mandar o vídeo da contagem",
    },
  });

  const conv4Messages = [
    { conversationId: conv4.id, senderId: carla.id, content: "Gustavo, você lembra a contagem da segunda parte?", isRead: true, createdAt: daysAgo(4) },
    { conversationId: conv4.id, senderId: gustavo.id, content: "Mais ou menos... era 5-6-7-8 e depois a transição né?", isRead: true, createdAt: daysAgo(4) },
    { conversationId: conv4.id, senderId: carla.id, content: "Isso! Mas mudou um pouco. Vou te mandar o vídeo da contagem", isRead: true, createdAt: daysAgo(3) },
  ];

  await Promise.all(conv4Messages.map((data) => prisma.message.create({ data })));

  // Conversa 5: Maria e Joao
  const conv5 = await prisma.conversation.create({
    data: {
      participant1Id: maria.id,
      participant2Id: joao.id,
      lastMessageAt: daysAgo(1),
      lastMessagePreview: "Te vejo no treino!",
    },
  });

  const conv5Messages = [
    { conversationId: conv5.id, senderId: maria.id, content: "João, você consegue treinar domingo?", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv5.id, senderId: joao.id, content: "Consigo sim! Que horas?", isRead: true, createdAt: daysAgo(2) },
    { conversationId: conv5.id, senderId: maria.id, content: "Às 14h tá bom?", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv5.id, senderId: joao.id, content: "Perfeito!", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv5.id, senderId: maria.id, content: "Te vejo no treino!", isRead: true, createdAt: daysAgo(1) },
  ];

  await Promise.all(conv5Messages.map((data) => prisma.message.create({ data })));

  // Conversa 6: Ana e Carla
  const conv6 = await prisma.conversation.create({
    data: {
      participant1Id: ana.id,
      participant2Id: carla.id,
      lastMessageAt: daysAgo(0),
      lastMessagePreview: "A coreografia ficou perfeita! 💃",
    },
  });

  const conv6Messages = [
    { conversationId: conv6.id, senderId: ana.id, content: "Carla, a rotina nova ficou incrível!", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv6.id, senderId: carla.id, content: "Obrigada! Trabalhei muito nela", isRead: true, createdAt: daysAgo(1) },
    { conversationId: conv6.id, senderId: ana.id, content: "Os atletas amaram as transições", isRead: true, createdAt: daysAgo(0) },
    { conversationId: conv6.id, senderId: carla.id, content: "A coreografia ficou perfeita! 💃", isRead: false, createdAt: daysAgo(0) },
  ];

  await Promise.all(conv6Messages.map((data) => prisma.message.create({ data })));

  // 18. Criar notificações
  console.log("🔔 Criando notificações...");
  const notificationsData = [
    // Notificações para Gustavo
    { userId: gustavo.id, type: "POST_LIKED", message: "Maria Santos curtiu seu post", actorId: maria.id, relatedId: posts[0].id, relatedType: "post", isRead: true, createdAt: daysAgo(14) },
    { userId: gustavo.id, type: "POST_LIKED", message: "João Oliveira curtiu seu post", actorId: joao.id, relatedId: posts[0].id, relatedType: "post", isRead: true, createdAt: daysAgo(14) },
    { userId: gustavo.id, type: "POST_COMMENTED", message: "Maria Santos comentou no seu post", actorId: maria.id, relatedId: posts[0].id, relatedType: "post", isRead: true, createdAt: daysAgo(14) },
    { userId: gustavo.id, type: "CONNECTION_REQUEST", message: "Julia Lima quer se conectar com você", actorId: julia.id, isRead: false, createdAt: daysAgo(5) },
    { userId: gustavo.id, type: "CONNECTION_REQUEST", message: "Rafael Alves quer se conectar com você", actorId: rafael.id, isRead: false, createdAt: daysAgo(3) },
    { userId: gustavo.id, type: "MESSAGE_RECEIVED", message: "Lucas Ferreira enviou uma mensagem", actorId: lucas.id, relatedId: conv3.id, relatedType: "conversation", isRead: false, createdAt: daysAgo(0) },
    // Notificações para Maria
    { userId: maria.id, type: "POST_LIKED", message: "Gustavo Silva curtiu seu post", actorId: gustavo.id, relatedId: posts[3].id, relatedType: "post", isRead: true, createdAt: daysAgo(11) },
    { userId: maria.id, type: "POST_COMMENTED", message: "Julia Lima comentou no seu post", actorId: julia.id, relatedId: posts[3].id, relatedType: "post", isRead: true, createdAt: daysAgo(11) },
    { userId: maria.id, type: "CONNECTION_REQUEST", message: "Fernanda Rocha quer se conectar com você", actorId: fernanda.id, isRead: false, createdAt: daysAgo(2) },
    // Notificações para Lucas
    { userId: lucas.id, type: "POST_LIKED", message: "Gustavo Silva curtiu seu post", actorId: gustavo.id, relatedId: posts[10].id, relatedType: "post", isRead: true, createdAt: daysAgo(13) },
    { userId: lucas.id, type: "POST_COMMENTED", message: "Ana Costa comentou no seu post", actorId: ana.id, relatedId: posts[10].id, relatedType: "post", isRead: true, createdAt: daysAgo(13) },
    // Notificações para Ana
    { userId: ana.id, type: "POST_COMMENTED", message: "Maria Santos comentou no seu post", actorId: maria.id, relatedId: posts[9].id, relatedType: "post", isRead: true, createdAt: daysAgo(3) },
    { userId: ana.id, type: "MESSAGE_RECEIVED", message: "Carla Mendes enviou uma mensagem", actorId: carla.id, relatedId: conv6.id, relatedType: "conversation", isRead: false, createdAt: daysAgo(0) },
    // Notificações para Pedro
    { userId: pedro.id, type: "POST_COMMENTED", message: "Maria Santos comentou no seu post", actorId: maria.id, relatedId: posts[14].id, relatedType: "post", isRead: true, createdAt: daysAgo(8) },
    { userId: pedro.id, type: "COMMENT_REPLIED", message: "Lucas Ferreira respondeu seu comentário", actorId: lucas.id, relatedId: posts[14].id, relatedType: "post", isRead: false, createdAt: daysAgo(8) },
    // Notificações variadas
    { userId: joao.id, type: "CONNECTION_ACCEPTED", message: "Gustavo Silva aceitou sua conexão", actorId: gustavo.id, isRead: true, createdAt: daysAgo(20) },
    { userId: julia.id, type: "CONNECTION_REQUEST", message: "Carla Mendes quer se conectar com você", actorId: carla.id, isRead: false, createdAt: daysAgo(1) },
  ];

  await Promise.all(
    notificationsData.map((data) => prisma.notification.create({ data }))
  );

  // 19. Criar convites de equipe
  console.log("📨 Criando convites de equipe...");
  const teamInvitesData = [
    // Convite pendente para Gustavo
    { teamId: elite.id, userId: gustavo.id, role: "Atleta", hasPermission: false, isAdmin: false, status: InviteStatus.PENDING, expiresAt: daysFromNow(14) },
    // Convite pendente para Maria
    { teamId: spark.id, userId: maria.id, role: "Instrutora", hasPermission: true, isAdmin: false, status: InviteStatus.PENDING, expiresAt: daysFromNow(7) },
    // Convite pendente para Pedro
    { teamId: thunder.id, userId: pedro.id, role: "Atleta", hasPermission: false, isAdmin: false, status: InviteStatus.PENDING, expiresAt: daysFromNow(10) },
    // Convite pendente para Rafael
    { teamId: lions.id, userId: rafael.id, role: "Atleta", hasPermission: false, isAdmin: false, status: InviteStatus.PENDING },
  ];

  await Promise.all(
    teamInvitesData.map((data) => prisma.teamInvite.create({ data }))
  );

  console.log("✅ Seed concluído com sucesso!");
  console.log("\n📊 Resumo dos dados criados:");
  console.log(`   👥 ${users.length} usuários`);
  console.log(`   🤝 ${connectionsData.length} conexões`);
  console.log(`   🏆 ${teams.length} equipes`);
  console.log(`   👤 ${teamMembersData.length} membros de equipe`);
  console.log(`   ➕ ${teamFollowsData.length} follows de equipe`);
  console.log(`   📝 ${posts.length + repostsData.length} posts (incluindo reposts)`);
  console.log(`   💬 ${commentsData.length + repliesData.length} comentários`);
  console.log(`   ❤️  ${likesData.length} likes em posts`);
  console.log(`   💕 ${commentLikesData.length} likes em comentários`);
  console.log(`   📅 ${eventsData.length} eventos`);
  console.log(`   📋 ${careerData.length} entradas de carreira`);
  console.log(`   🏅 ${achievementsData.length} conquistas pessoais`);
  console.log(`   🏆 ${teamAchievementsData.length} conquistas de equipe`);
  console.log(`   💬 6 conversas com mensagens`);
  console.log(`   🔔 ${notificationsData.length} notificações`);
  console.log(`   📨 ${teamInvitesData.length} convites de equipe`);
  console.log("\n🔑 Login de teste: gustavo@test.com / 123456");
}

main()
  .catch((e) => {
    console.error("❌ Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
