import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Tests that verify Prisma schema cascade deletion rules are correctly defined.
 *
 * Instead of hitting a real database, we parse the schema file and check that
 * every relation that should cascade on delete has `onDelete: Cascade`, and
 * relations that should not cascade use `SetNull` or have no onDelete.
 *
 * This catches accidental schema changes that could break cascade behavior.
 */

const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

/**
 * Extracts relation definitions from the Prisma schema for a given model.
 * Returns array of { field, relatedModel, onDelete } objects.
 */
function getRelations(modelName: string): Array<{
  field: string;
  relatedModel: string;
  onDelete: string | null;
}> {
  // Match the model block
  const modelRegex = new RegExp(
    `model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`,
    "m"
  );
  const match = schema.match(modelRegex);
  if (!match) return [];

  const modelBody = match[1];
  const relations: Array<{
    field: string;
    relatedModel: string;
    onDelete: string | null;
  }> = [];

  // Match lines with @relation(..., onDelete: ...)
  // Format: fieldName  Type  @relation(..., onDelete: Cascade)
  const lines = modelBody.split("\n");
  for (const line of lines) {
    const relationMatch = line.match(
      /^\s+(\w+)\s+\w+\??\s+@relation\(([^)]+)\)/
    );
    if (!relationMatch) continue;

    const field = relationMatch[1];
    const relationArgs = relationMatch[2];

    // Extract related model from the field type
    const typeMatch = line.match(/^\s+\w+\s+(\w+)\??/);
    const relatedModel = typeMatch ? typeMatch[1] : "unknown";

    // Extract onDelete
    const onDeleteMatch = relationArgs.match(/onDelete:\s*(\w+)/);
    const onDelete = onDeleteMatch ? onDeleteMatch[1] : null;

    relations.push({ field, relatedModel, onDelete });
  }

  return relations;
}

/**
 * Helper: asserts a specific relation has the expected onDelete behavior.
 */
function expectOnDelete(
  modelName: string,
  fieldName: string,
  expectedOnDelete: string
) {
  const relations = getRelations(modelName);
  const relation = relations.find((r) => r.field === fieldName);
  expect(
    relation,
    `Expected relation '${fieldName}' on model '${modelName}' to exist`
  ).toBeDefined();
  expect(relation!.onDelete).toBe(expectedOnDelete);
}

describe("Cascade Deletion - Post", () => {
  it("post deletion cascades to reposts (originalPost relation)", () => {
    expectOnDelete("Post", "originalPost", "Cascade");
  });

  it("post deletion cascades to comments", () => {
    expectOnDelete("Comment", "post", "Cascade");
  });

  it("post deletion cascades to likes", () => {
    expectOnDelete("Like", "post", "Cascade");
  });

  it("post deletion cascades to PostTag entries", () => {
    expectOnDelete("PostTag", "post", "Cascade");
  });

  it("post deletion cascades to Mention entries", () => {
    expectOnDelete("Mention", "post", "Cascade");
  });

  it("post deletion cascades to PostEdit entries", () => {
    expectOnDelete("PostEdit", "post", "Cascade");
  });

  it("post's author relation cascades on user delete", () => {
    expectOnDelete("Post", "author", "Cascade");
  });

  it("post's team relation uses SetNull on team delete", () => {
    expectOnDelete("Post", "team", "SetNull");
  });
});

describe("Cascade Deletion - User", () => {
  it("user deletion cascades to posts", () => {
    expectOnDelete("Post", "author", "Cascade");
  });

  it("user deletion cascades to comments", () => {
    expectOnDelete("Comment", "author", "Cascade");
  });

  it("user deletion cascades to likes", () => {
    expectOnDelete("Like", "user", "Cascade");
  });

  it("user deletion cascades to comment likes", () => {
    expectOnDelete("CommentLike", "user", "Cascade");
  });

  it("user deletion cascades to sent connections", () => {
    expectOnDelete("Connection", "sender", "Cascade");
  });

  it("user deletion cascades to received connections", () => {
    expectOnDelete("Connection", "receiver", "Cascade");
  });

  it("user deletion cascades to team memberships", () => {
    expectOnDelete("TeamMember", "user", "Cascade");
  });

  it("user deletion cascades to team follows", () => {
    expectOnDelete("TeamFollow", "user", "Cascade");
  });

  it("user deletion cascades to conversations (participant1)", () => {
    expectOnDelete("Conversation", "participant1", "Cascade");
  });

  it("user deletion cascades to conversations (participant2)", () => {
    expectOnDelete("Conversation", "participant2", "Cascade");
  });

  it("user deletion cascades to sent messages", () => {
    expectOnDelete("Message", "sender", "Cascade");
  });

  it("user deletion cascades to notifications", () => {
    expectOnDelete("Notification", "user", "Cascade");
  });

  it("user deletion cascades to achievements", () => {
    expectOnDelete("Achievement", "user", "Cascade");
  });

  it("user deletion cascades to career history", () => {
    expectOnDelete("CareerHistory", "user", "Cascade");
  });

  it("user deletion cascades to accounts (NextAuth)", () => {
    expectOnDelete("Account", "user", "Cascade");
  });

  it("user deletion cascades to sessions (NextAuth)", () => {
    expectOnDelete("Session", "user", "Cascade");
  });

  it("user deletion cascades to mentions", () => {
    expectOnDelete("Mention", "mentionedUser", "Cascade");
  });

  it("user deletion cascades to team invites", () => {
    expectOnDelete("TeamInvite", "user", "Cascade");
  });

  it("user deletion cascades to reports", () => {
    expectOnDelete("Report", "reporter", "Cascade");
  });

  it("user deletion cascades to blocks made", () => {
    expectOnDelete("Block", "user", "Cascade");
  });

  it("user deletion cascades to blocks received", () => {
    expectOnDelete("Block", "blockedUser", "Cascade");
  });

  it("notification actor uses SetNull on user delete (not cascade)", () => {
    expectOnDelete("Notification", "actor", "SetNull");
  });

  it("event creator uses SetNull on user delete (not cascade)", () => {
    expectOnDelete("Event", "creator", "SetNull");
  });
});

describe("Cascade Deletion - Team", () => {
  it("team deletion cascades to team members", () => {
    expectOnDelete("TeamMember", "team", "Cascade");
  });

  it("team deletion cascades to team follows", () => {
    expectOnDelete("TeamFollow", "team", "Cascade");
  });

  it("team deletion cascades to team achievements", () => {
    expectOnDelete("TeamAchievement", "team", "Cascade");
  });

  it("team deletion cascades to team invites", () => {
    expectOnDelete("TeamInvite", "team", "Cascade");
  });

  it("team deletion uses SetNull for career history entries", () => {
    expectOnDelete("CareerHistory", "team", "SetNull");
  });

  it("team deletion uses SetNull for events", () => {
    expectOnDelete("Event", "team", "SetNull");
  });

  it("team deletion uses SetNull for posts", () => {
    expectOnDelete("Post", "team", "SetNull");
  });
});

describe("Cascade Deletion - Comment", () => {
  it("comment deletion cascades to replies (self-referential)", () => {
    expectOnDelete("Comment", "parent", "Cascade");
  });

  it("comment deletion cascades to comment likes", () => {
    expectOnDelete("CommentLike", "comment", "Cascade");
  });
});

describe("Cascade Deletion - Repost chain", () => {
  it("original post deletion cascades to all reposts", () => {
    // The Post model has: originalPost Post? @relation("PostReposts", ..., onDelete: Cascade)
    // This means when the original post is deleted, all reposts are deleted too
    expectOnDelete("Post", "originalPost", "Cascade");
  });
});

describe("Cascade Deletion - Tag relations", () => {
  it("PostTag cascades when tag is deleted", () => {
    expectOnDelete("PostTag", "tag", "Cascade");
  });

  it("PostTag cascades when post is deleted", () => {
    expectOnDelete("PostTag", "post", "Cascade");
  });
});

describe("Cascade Deletion - Message/Conversation", () => {
  it("message deletion cascades when conversation is deleted", () => {
    expectOnDelete("Message", "conversation", "Cascade");
  });

  it("message sender cascades when user is deleted", () => {
    expectOnDelete("Message", "sender", "Cascade");
  });
});

describe("Schema completeness - all relations have explicit onDelete", () => {
  it("no relation with fields/references is missing onDelete", () => {
    // Find all @relation() annotations that have fields: and references:
    // These should all have onDelete specified
    const relationRegex =
      /@relation\([^)]*fields:\s*\[[^\]]+\][^)]*references:\s*\[[^\]]+\][^)]*\)/g;
    const allRelations = schema.match(relationRegex) || [];

    const missingOnDelete = allRelations.filter(
      (r) => !r.includes("onDelete")
    );

    expect(
      missingOnDelete,
      `Found relations missing onDelete: ${missingOnDelete.join("\n")}`
    ).toHaveLength(0);
  });
});
