// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_DB_TESTS === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("PostgreSQL integration", () => {
  let prisma: typeof import("@/lib/prisma").prisma;

  beforeAll(async () => {
    prisma = (await import("@/lib/prisma")).prisma;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rolls back a failed transaction and preserves uniqueness constraints", async () => {
    const suffix = randomUUID();
    const email = `integration-${suffix}@example.com`;
    const username = `integration-${suffix}`.slice(0, 28);

    await expect(prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { email, username, name: "Integration" } });
      throw new Error("rollback");
    })).rejects.toThrow("rollback");

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();

    const user = await prisma.user.create({ data: { email, username, name: "Integration" } });
    await expect(prisma.user.create({ data: { email, username: `${username}-2`, name: "Duplicate" } })).rejects.toThrow();
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("prevents duplicate reverse pairs and concurrent invitations", async () => {
    const suffix = randomUUID();
    const first = await prisma.user.create({ data: { email: `pair-a-${suffix}@example.com`, username: `pair-a-${suffix}`.slice(0, 28), name: "A" } });
    const second = await prisma.user.create({ data: { email: `pair-b-${suffix}@example.com`, username: `pair-b-${suffix}`.slice(0, 28), name: "B" } });
    const pairKey = [first.id, second.id].sort().join(":");

    const connectionResults = await Promise.allSettled([
      prisma.connection.create({ data: { senderId: first.id, receiverId: second.id, pairKey } }),
      prisma.connection.create({ data: { senderId: second.id, receiverId: first.id, pairKey } }),
    ]);
    expect(connectionResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);

    const conversationResults = await Promise.allSettled([
      prisma.conversation.create({ data: { participant1Id: first.id, participant2Id: second.id, pairKey } }),
      prisma.conversation.create({ data: { participant1Id: second.id, participant2Id: first.id, pairKey } }),
    ]);
    expect(conversationResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);

    const team = await prisma.team.create({ data: { name: `Team ${suffix}`, slug: `team-${suffix}`.slice(0, 28) } });
    await Promise.all([
      prisma.teamInvite.upsert({ where: { teamId_userId: { teamId: team.id, userId: first.id } }, update: { role: "Coach" }, create: { teamId: team.id, userId: first.id, role: "Coach" } }),
      prisma.teamInvite.upsert({ where: { teamId_userId: { teamId: team.id, userId: first.id } }, update: { role: "Coach" }, create: { teamId: team.id, userId: first.id, role: "Coach" } }),
    ]);
    expect(await prisma.teamInvite.count({ where: { teamId: team.id, userId: first.id } })).toBe(1);

    await prisma.user.deleteMany({ where: { id: { in: [first.id, second.id] } } });
    await prisma.team.delete({ where: { id: team.id } });
  });

  it("removes owned content through the user cascade", async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `cascade-${suffix}@example.com`,
        username: `cascade-${suffix}`.slice(0, 28),
        name: "Cascade",
      },
    });
    const post = await prisma.post.create({
      data: { authorId: user.id, content: "integration post" },
    });

    await prisma.user.delete({ where: { id: user.id } });
    await expect(prisma.post.findUnique({ where: { id: post.id } })).resolves.toBeNull();
  });
});
