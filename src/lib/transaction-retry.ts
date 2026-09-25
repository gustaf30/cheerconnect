import { Prisma } from "@prisma/client";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt >= maxAttempts) throw error;
      await wait(25 * 2 ** (attempt - 1));
    }
  }
}
