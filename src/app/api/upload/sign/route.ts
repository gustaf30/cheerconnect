import { NextResponse } from "next/server";
import { requireAuth, internalError } from "@/lib/api-utils";
import { cloudinary } from "@/lib/cloudinary";

const UPLOAD_FOLDER = "cheerconnect/posts";

/**
 * POST /api/upload/sign
 * Generate a signed Cloudinary upload payload so the client can upload directly
 * to Cloudinary, bypassing Vercel's 4.5MB body size limit.
 */
export async function POST() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const timestamp = Math.round(Date.now() / 1000);
    const params = { timestamp, folder: UPLOAD_FOLDER };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
      folder: UPLOAD_FOLDER,
    });
  } catch (err) {
    return internalError("Erro ao gerar assinatura de upload", err);
  }
}
