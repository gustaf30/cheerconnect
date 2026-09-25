import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import process from "node:process";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const USERS = Number(process.env.LOAD_USERS ?? 50);
const PASSWORD = process.env.LOAD_PASSWORD ?? "123456";
const POSTS_PER_USER = Number(process.env.LOAD_POSTS_PER_USER ?? 3);
const MESSAGES_PER_CONVERSATION = Number(process.env.LOAD_MESSAGES_PER_CONVERSATION ?? 4);

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
  console.log(`Populando base de carga: ${USERS} usuários...`);

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.commentLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.post.deleteMany();
  await prisma.event.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Custo 12 igual ao seed principal, para que a latência de login medida
  // pela carga represente o custo real de verificação de senha.
  const password = await bcrypt.hash(PASSWORD, 12);

  const users = [];
  for (let i = 0; i < USERS; i++) {
    users.push(
      await prisma.user.create({
        data: {
          email: `load${i}@load.test`,
          name: `Load User ${i}`,
          username: `load_user_${i}`,
          password,
          emailVerified: new Date(),
          profileVisibility: "PUBLIC",
        },
      })
    );
  }
  console.log(`  ${users.length} usuários criados`);

  const connections = [];
  for (let i = 0; i < users.length; i++) {
    const next = users[(i + 1) % users.length];
    if (next.id === users[i].id) continue;
    connections.push({
      senderId: users[i].id,
      receiverId: next.id,
      pairKey: pairKey(users[i].id, next.id),
      status: "ACCEPTED",
    });
  }
  await prisma.connection.createMany({ data: connections });
  console.log(`  ${connections.length} conexões criadas`);

  const posts = [];
  for (const user of users) {
    for (let p = 0; p < POSTS_PER_USER; p++) {
      posts.push(
        await prisma.post.create({
          data: {
            content: `Post de carga ${p} de ${user.username}`,
            authorId: user.id,
            createdAt: daysAgo(p + 1),
          },
        })
      );
    }
  }
  console.log(`  ${posts.length} posts criados`);

  const conversations = [];
  for (let i = 0; i < users.length; i++) {
    const other = users[(i + 1) % users.length];
    if (other.id === users[i].id) continue;
    const conversation = await prisma.conversation.create({
      data: {
        participant1Id: users[i].id,
        participant2Id: other.id,
        pairKey: pairKey(users[i].id, other.id),
        lastMessageAt: daysAgo(0),
        lastMessagePreview: "Mensagem de carga",
      },
    });
    conversations.push(conversation);

    for (let m = 0; m < MESSAGES_PER_CONVERSATION; m++) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: m % 2 === 0 ? users[i].id : other.id,
          content: `Mensagem de carga ${m}`,
          isRead: true,
          createdAt: daysAgo(m + 1),
        },
      });
    }
  }
  console.log(`  ${conversations.length} conversas criadas`);

  const notifications = users.flatMap((user, index) => [
    {
      userId: user.id,
      type: "POST_LIKED",
      message: "Alguém curtiu seu post",
      actorId: users[(index + 1) % users.length].id,
      isRead: false,
      createdAt: daysAgo(0),
    },
  ]);
  await prisma.notification.createMany({ data: notifications });
  console.log(`  ${notifications.length} notificações criadas`);

  // Sem eventos as rotas /api/events medem consulta a tabela vazia, o que não
  // diz nada sobre a leitura real.
  const events = [];
  for (let i = 0; i < users.length; i++) {
    const past = i % 2 === 0;
    events.push({
      name: `Evento de carga ${i}`,
      description: `Evento de carga ${i} para exercitar a leitura de eventos`,
      location: `Local ${i}`,
      startDate: past ? daysAgo(5) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      type: "COMPETITION",
      creatorId: users[i].id,
    });
  }
  await prisma.event.createMany({ data: events });
  console.log(`  ${events.length} eventos criados`);

  // Curtidas e comentários dão volume às consultas de feed e perfil.
  const likes = posts
    .filter((_, index) => index % 2 === 0)
    .flatMap((post) => [
      { userId: users[0].id, postId: post.id },
      { userId: users[1].id, postId: post.id },
    ]);
  await prisma.like.createMany({ data: likes });
  console.log(`  ${likes.length} curtidas criadas`);

  console.log(`Login de carga: load0@load.test / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Falha ao popular a base de carga:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
