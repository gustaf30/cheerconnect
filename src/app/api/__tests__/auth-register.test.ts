// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = () => ({
    findUnique: fn(), findFirst: fn(), findMany: fn(),
    create: fn(), update: fn(), delete: fn(), count: fn(),
  });
  return {
    mockPrisma: {
      user: model(),
      post: model(),
      connection: model(),
      team: model(),
      teamMember: model(),
      teamFollow: { findMany: fn() },
      notification: { create: fn(), findMany: fn() },
      tag: { upsert: fn() },
      postTag: { create: fn(), deleteMany: fn() },
      mention: { create: fn(), deleteMany: fn() },
      block: { findFirst: fn(), findMany: fn() },
      $transaction: fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/auth/register/route";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with user data on valid registration", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "New User",
      email: "new@example.com",
      username: "newuser",
      password: "$2a$12$hashedpassword",
    });

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New User",
        email: "new@example.com",
        username: "newuser",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.user).toEqual({
      id: "new-user-id",
      name: "New User",
      email: "new@example.com",
      username: "newuser",
    });
    expect(data.user.password).toBeUndefined();
  });

  it("returns 400 when email already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-id",
      email: "existing@example.com",
    });

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User",
        email: "existing@example.com",
        username: "newuser",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("email");
  });

  it("returns 400 when username already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-id",
      username: "takenuser",
    });

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User",
        email: "new@example.com",
        username: "takenuser",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("username");
  });

  it("returns 400 when required fields are missing", async () => {
    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User",
        email: "not-an-email",
        username: "validuser",
        password: "password123",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for short password (less than 6 chars)", async () => {
    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User",
        email: "valid@example.com",
        username: "validuser",
        password: "12345",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("hashes the password before storing", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      name: "User",
      email: "user@example.com",
      username: "user",
      password: "$2a$12$hashedvalue",
    });

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User",
        email: "user@example.com",
        username: "user",
        password: "plainpassword",
      }),
    });

    await POST(request);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.password).not.toBe("plainpassword");
    expect(createCall.data.password).toMatch(/^\$2[ab]\$/);
  });
});
