import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

const positionEnum = z.enum(["FLYER", "BASE", "BACKSPOT", "FRONTSPOT", "TUMBLER", "COACH", "CHOREOGRAPHER", "JUDGE", "OTHER"]);

const careerSchema = z.object({
  role: z.enum(["ATHLETE", "COACH", "ASSISTANT_COACH", "CHOREOGRAPHER", "TEAM_MANAGER", "JUDGE", "OTHER"]),
  positions: z.array(positionEnum).default([]),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  isCurrent: z.boolean().default(false),
  teamName: z.string().min(1, "Nome do time é obrigatório"),
  teamId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

// GET /api/career - Get user's career history
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const careerHistory = await prisma.careerHistory.findMany({
      where: { userId: session.user.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
      orderBy: [
        { isCurrent: "desc" },
        { startDate: "desc" },
      ],
    });

    return NextResponse.json({ careerHistory });
  } catch (error) {
    console.error("Get career error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/career - Add career entry
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = careerSchema.parse(body);

    // Handle teamId and positions separately for Prisma's relation/enum types
    const { teamId, positions, ...restData } = parsed;

    const career = await prisma.careerHistory.create({
      data: {
        ...restData,
        positions: positions as Position[],
        userId: session.user.id,
        ...(teamId && { teamId }),
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    return NextResponse.json({ career }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Create career error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
