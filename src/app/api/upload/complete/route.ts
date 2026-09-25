import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, internalError } from "@/lib/api-utils";
import { completePendingMediaAsset } from "@/lib/media-assets";

const completeSchema = z.object({
  assetId: z.string().min(1),
  uploadToken: z.string().min(20),
  url: z.string().url(),
  publicId: z.string().min(1).optional(),
  bytes: z.number().int().positive().max(100 * 1024 * 1024).optional(),
  width: z.number().int().positive().max(12000).optional(),
  height: z.number().int().positive().max(12000).optional(),
  mimeType: z.string().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const data = completeSchema.parse(await request.json());
    const asset = await completePendingMediaAsset({
      ...data,
      ownerId: session.user.id,
    });

    return NextResponse.json({ asset });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return internalError("Erro ao concluir upload", err);
  }
}
