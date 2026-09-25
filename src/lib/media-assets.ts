import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { MediaAssetStatus, MediaPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteCloudinaryAsset, extractPublicId, getCloudinaryAsset } from "@/lib/cloudinary";
import { canonicalMediaFolder, isCloudinaryUrl } from "@/lib/media-url";
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from "@/lib/constants";

function isOwnedCloudinaryUrl(url: string, ownerId: string): boolean {
  const publicId = extractPublicId(url);
  return Boolean(publicId && isCloudinaryUrl(url) && publicId.startsWith(`${canonicalMediaFolder(ownerId)}/`));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(expectedHash: string, token: string): boolean {
  const actualHash = hashToken(token);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createPendingMediaAsset(input: {
  ownerId: string;
  purpose: MediaPurpose;
  resourceType: "image" | "video";
}) {
  const uploadToken = randomBytes(32).toString("base64url");
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId: input.ownerId,
      purpose: input.purpose,
      resourceType: input.resourceType,
      status: MediaAssetStatus.PENDING,
      uploadTokenHash: hashToken(uploadToken),
    },
    select: { id: true },
  });

  return { assetId: asset.id, uploadToken };
}

export async function completePendingMediaAsset(input: {
  assetId: string;
  ownerId: string;
  uploadToken: string;
  url: string;
  publicId?: string;
  bytes?: number;
  width?: number;
  height?: number;
  mimeType?: string;
}) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: input.assetId },
  });

  if (
    !asset ||
    !asset.ownerId ||
    asset.ownerId !== input.ownerId ||
    !asset.uploadTokenHash ||
    asset.status !== MediaAssetStatus.PENDING ||
    !tokensMatch(asset.uploadTokenHash, input.uploadToken)
  ) {
    throw new Error("Upload inválido ou expirado");
  }

  if (!isCloudinaryUrl(input.url)) {
    throw new Error("URL de asset inválida");
  }

  const extractedPublicId = extractPublicId(input.url);
  const publicId = input.publicId || extractedPublicId;
  if (input.publicId && extractedPublicId !== input.publicId) {
    throw new Error("URL e public ID do asset não conferem");
  }
  if (!publicId || !publicId.startsWith(`${canonicalMediaFolder(asset.ownerId)}/`)) {
    throw new Error("Asset não pertence ao usuário");
  }

  const remoteAsset = await getCloudinaryAsset(
    publicId,
    asset.resourceType === "video" ? "video" : "image"
  );
  if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && !remoteAsset) {
    throw new Error("Não foi possível validar o asset no Cloudinary");
  }
  if (remoteAsset) {
    if (remoteAsset.public_id !== publicId || remoteAsset.secure_url !== input.url) {
      throw new Error("Metadata do asset não confere com o Cloudinary");
    }
  }
  const verifiedBytes = remoteAsset?.bytes ?? input.bytes;
  const verifiedWidth = remoteAsset?.width ?? input.width;
  const verifiedHeight = remoteAsset?.height ?? input.height;

  const maxBytes = asset.resourceType === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (
    typeof verifiedBytes !== "number" ||
    !Number.isInteger(verifiedBytes) ||
    verifiedBytes <= 0 ||
    verifiedBytes > maxBytes
  ) {
    throw new Error("Tamanho de asset inválido");
  }

  if (
    (verifiedWidth !== undefined && verifiedWidth <= 0) ||
    (verifiedHeight !== undefined && verifiedHeight <= 0)
  ) {
    throw new Error("Dimensões de asset inválidas");
  }

  if (asset.resourceType === "image") {
    if (!verifiedWidth || !verifiedHeight) {
      throw new Error("Dimensões de imagem são obrigatórias");
    }
    if (
      verifiedWidth > MAX_IMAGE_DIMENSION ||
      verifiedHeight > MAX_IMAGE_DIMENSION ||
      verifiedWidth * verifiedHeight > MAX_IMAGE_PIXELS
    ) {
      throw new Error("Dimensões de imagem grandes demais");
    }
  }

  const updated = await prisma.mediaAsset.updateMany({
    where: {
      id: asset.id,
      ownerId: input.ownerId,
      status: MediaAssetStatus.PENDING,
      uploadTokenHash: asset.uploadTokenHash,
    },
    data: {
      url: input.url,
      publicId,
      bytes: verifiedBytes,
      width: verifiedWidth,
      height: verifiedHeight,
      mimeType: input.mimeType,
      status: MediaAssetStatus.COMPLETED,
      completedAt: new Date(),
      uploadTokenHash: null,
    },
  });
  if (updated.count !== 1) {
    throw new Error("Upload já foi concluído ou invalidado");
  }
  return prisma.mediaAsset.findUnique({ where: { id: asset.id } });
}

export async function registerCompletedMediaAsset(input: {
  ownerId: string;
  url: string;
  publicId: string;
  purpose: MediaPurpose;
  resourceType: "image" | "video";
  bytes?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  postId?: string;
  teamId?: string;
}) {
  if (!isCloudinaryUrl(input.url)) {
    throw new Error("URL de asset inválida");
  }
  if (
    !input.publicId ||
    extractPublicId(input.url) !== input.publicId ||
    !input.publicId.startsWith(`${canonicalMediaFolder(input.ownerId)}/`)
  ) {
    throw new Error("Asset não pertence ao usuário");
  }

  const existing = await prisma.mediaAsset.findFirst({
    where: { url: input.url },
    select: {
      id: true,
      ownerId: true,
      purpose: true,
      postId: true,
      teamId: true,
    },
  });

  if (existing) {
    if (
      existing.ownerId !== input.ownerId ||
      existing.purpose !== input.purpose ||
      existing.postId !== (input.postId ?? null) ||
      existing.teamId !== (input.teamId ?? null)
    ) {
      throw new Error("Asset já está vinculado a outro recurso");
    }
    return prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        status: MediaAssetStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  return prisma.mediaAsset.create({
    data: {
      ownerId: input.ownerId,
      url: input.url,
      publicId: input.publicId,
      purpose: input.purpose,
      resourceType: input.resourceType,
      bytes: input.bytes,
      width: input.width,
      height: input.height,
      mimeType: input.mimeType,
      postId: input.postId,
      teamId: input.teamId,
      status: MediaAssetStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}

export async function linkPostMediaAssets(
  postId: string,
  ownerId: string,
  urls: string[]
): Promise<void> {
  if (urls.length === 0) return;

  const assets = await prisma.mediaAsset.findMany({
    where: {
      ownerId,
      url: { in: urls },
      status: MediaAssetStatus.COMPLETED,
      purpose: MediaPurpose.POST,
      postId: null,
      teamId: null,
    },
    select: { id: true, url: true },
  });

  if (assets.length !== urls.length) {
    throw new Error("Um ou mais arquivos não pertencem ao usuário");
  }

  const updated = await prisma.mediaAsset.updateMany({
    where: {
      id: { in: assets.map((asset) => asset.id) },
      ownerId,
      status: MediaAssetStatus.COMPLETED,
      purpose: MediaPurpose.POST,
      postId: null,
      teamId: null,
    },
    data: { postId },
  });
  if (updated.count !== assets.length) {
    throw new Error("Um ou mais assets já foram vinculados");
  }
}

export async function deletePostMediaAssets(
  postId: string,
  ownerId: string
): Promise<void> {
  const [assets, post] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { postId, ownerId },
      select: { id: true, publicId: true, resourceType: true },
    }),
    prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, images: true, videoUrl: true },
    }),
  ]);

  const legacyAssets = post?.authorId === ownerId
    ? [
        ...(post.images || []).map((url) => ({ url, resourceType: "image" as const })),
        ...(post.videoUrl ? [{ url: post.videoUrl, resourceType: "video" as const }] : []),
      ].filter((asset) => isOwnedCloudinaryUrl(asset.url, ownerId))
    : [];
  const knownUrls = new Set(assets.map((asset) => asset.publicId).filter(Boolean));
  const legacyPublicIds = legacyAssets
    .map((asset) => ({ publicId: extractPublicId(asset.url), resourceType: asset.resourceType }))
    .filter((asset): asset is { publicId: string; resourceType: "image" | "video" } =>
      Boolean(asset.publicId) && !knownUrls.has(asset.publicId as string)
    );

  const deletionResults = await Promise.allSettled([
    ...assets
      .filter((asset) => asset.publicId)
      .map((asset) =>
        deleteCloudinaryAsset(
          asset.publicId as string,
          asset.resourceType === "video" ? "video" : "image"
        )
      ),
    ...legacyPublicIds.map((asset) => deleteCloudinaryAsset(asset.publicId, asset.resourceType)),
  ]);
  if (deletionResults.some((result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value))) {
    throw new Error("Não foi possível remover todos os assets externos");
  }

  await prisma.mediaAsset.deleteMany({ where: { postId, ownerId } });
}

export async function deleteUserMediaAssets(userId: string): Promise<void> {
  const [user, assets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarPublicId: true,
        bannerPublicId: true,
        posts: { select: { images: true, videoUrl: true } },
      },
    }),
    prisma.mediaAsset.findMany({
      where: { ownerId: userId, teamId: null },
      select: { publicId: true, resourceType: true, url: true },
    }),
  ]);

  const assetsToDelete = assets.filter((asset) => asset.publicId);
  const knownUrls = new Set(assets.map((asset) => asset.url).filter(Boolean));
  const legacyAssets = (user?.posts || []).flatMap((post) => [
    ...post.images.map((url) => ({ url, resourceType: "image" as const })),
    ...(post.videoUrl ? [{ url: post.videoUrl, resourceType: "video" as const }] : []),
  ]).filter((asset) => isOwnedCloudinaryUrl(asset.url, userId));
  const legacyPublicIds = legacyAssets
    .filter((asset) => !knownUrls.has(asset.url))
    .map((asset) => ({ publicId: extractPublicId(asset.url), resourceType: asset.resourceType }))
    .filter((asset): asset is { publicId: string; resourceType: "image" | "video" } => Boolean(asset.publicId));
  const profilePublicIds = new Set<string>();
  if (user?.avatarPublicId) profilePublicIds.add(user.avatarPublicId);
  if (user?.bannerPublicId) profilePublicIds.add(user.bannerPublicId);

  const deletionResults = await Promise.allSettled([
    ...assetsToDelete.map((asset) =>
      deleteCloudinaryAsset(
        asset.publicId as string,
        asset.resourceType === "video" ? "video" : "image"
      )
    ),
    ...legacyPublicIds.map((asset) => deleteCloudinaryAsset(asset.publicId, asset.resourceType)),
    ...[...profilePublicIds].map((publicId) => deleteCloudinaryAsset(publicId, "image")),
  ]);
  if (deletionResults.some((result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value))) {
    throw new Error("Não foi possível remover todos os assets externos");
  }

  await prisma.mediaAsset.deleteMany({ where: { ownerId: userId, teamId: null } });
  await prisma.mediaAsset.updateMany({
    where: { ownerId: userId, teamId: { not: null } },
    data: { ownerId: null },
  });
}

export async function backfillLegacyMediaAssets(limit = 100): Promise<{
  candidates: number;
  created: number;
  skipped: number;
}> {
  const [posts, users] = await Promise.all([
    prisma.post.findMany({
      select: { id: true, authorId: true, images: true, videoUrl: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    }),
    prisma.user.findMany({
      select: { id: true, avatar: true, banner: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    }),
  ]);

  const candidates = [
    ...posts.flatMap((post) => [
      ...post.images.map((url) => ({ url, ownerId: post.authorId, purpose: MediaPurpose.POST, resourceType: "image" as const, postId: post.id })),
      ...(post.videoUrl ? [{ url: post.videoUrl, ownerId: post.authorId, purpose: MediaPurpose.POST, resourceType: "video" as const, postId: post.id }] : []),
    ]),
    ...users.flatMap((user) => [
      ...(user.avatar ? [{ url: user.avatar, ownerId: user.id, purpose: MediaPurpose.AVATAR, resourceType: "image" as const }] : []),
      ...(user.banner ? [{ url: user.banner, ownerId: user.id, purpose: MediaPurpose.BANNER, resourceType: "image" as const }] : []),
    ]),
  ].filter((candidate) => isOwnedCloudinaryUrl(candidate.url, candidate.ownerId));

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()];
  if (uniqueCandidates.length === 0) return { candidates: 0, created: 0, skipped: 0 };

  const existing = await prisma.mediaAsset.findMany({
    where: { url: { in: uniqueCandidates.map((candidate) => candidate.url) } },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((asset) => asset.url));
  const missing = uniqueCandidates.filter((candidate) => !existingUrls.has(candidate.url));
  const created = missing.length === 0
    ? 0
    : (await prisma.mediaAsset.createMany({
        data: missing.map((candidate) => ({
          url: candidate.url,
          publicId: extractPublicId(candidate.url),
          ownerId: candidate.ownerId,
          postId: "postId" in candidate ? candidate.postId : undefined,
          purpose: candidate.purpose,
          resourceType: candidate.resourceType,
          status: MediaAssetStatus.COMPLETED,
          completedAt: new Date(),
        })),
        skipDuplicates: true,
      })).count;

  return {
    candidates: candidates.length,
    created,
    skipped: candidates.length - uniqueCandidates.length + existingUrls.size,
  };
}

export async function reconcileCompletedMediaAssets(limit = 25): Promise<{
  checked: number;
  missing: number;
  errors: number;
}> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return { checked: 0, missing: 0, errors: 0 };
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const assets = await prisma.mediaAsset.findMany({
    where: {
      status: MediaAssetStatus.COMPLETED,
      publicId: { not: null },
      completedAt: { lt: cutoff },
    },
    select: { id: true, publicId: true, resourceType: true },
    orderBy: { completedAt: "asc" },
    take: limit,
  });
  let missing = 0;
  let errors = 0;

  for (const asset of assets) {
    if (!asset.publicId) continue;
    try {
      const remote = await getCloudinaryAsset(asset.publicId, asset.resourceType === "video" ? "video" : "image");
      if (remote === null) {
        await prisma.mediaAsset.updateMany({
          where: { id: asset.id, status: MediaAssetStatus.COMPLETED },
          data: { status: MediaAssetStatus.FAILED },
        });
        missing++;
      }
    } catch {
      errors++;
    }
  }

  return { checked: assets.length, missing, errors };
}

export async function deleteTeamMediaAssets(teamId: string): Promise<void> {
  const assets = await prisma.mediaAsset.findMany({
    where: { teamId },
    select: { publicId: true, resourceType: true },
  });
  const deletionResults = await Promise.allSettled(
    assets
      .filter((asset) => asset.publicId)
      .map((asset) =>
        deleteCloudinaryAsset(
          asset.publicId as string,
          asset.resourceType === "video" ? "video" : "image"
        )
      )
  );
  if (deletionResults.some((result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value))) {
    throw new Error("Não foi possível remover todos os assets externos");
  }
  await prisma.mediaAsset.deleteMany({ where: { teamId } });
}
