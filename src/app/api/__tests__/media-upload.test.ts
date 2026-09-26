// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Writable } from "node:stream";
import { NextRequest } from "next/server";
import { mockSession } from "@/test/api-helpers";
import { MediaPurpose } from "@prisma/client";

const {
  mockPrisma, mockGetServerSession, mockValidateFileType, mockUpload,
  mockDeleteCloudinaryAsset, mockRegisterAsset, mockCompleteAsset, mockUploadStream,
  mockDestroy, mockLoggerError,
} = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockPrisma: { user: { findUnique: fn(), update: fn() }, team: { findUnique: fn() } },
    mockGetServerSession: fn(),
    mockValidateFileType: fn(),
    mockUpload: fn(),
    mockDeleteCloudinaryAsset: fn(),
    mockRegisterAsset: fn(),
    mockCompleteAsset: fn(),
    mockUploadStream: fn(),
    mockDestroy: fn(),
    mockLoggerError: fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/logger", () => ({
  default: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/file-validation", () => ({ validateFileType: mockValidateFileType }));
vi.mock("@/lib/media-assets", () => ({
  registerCompletedMediaAsset: mockRegisterAsset,
  completePendingMediaAsset: mockCompleteAsset,
}));
vi.mock("@/lib/cloudinary", () => ({
  // destroy entra porque a rota o usa para apagar o arquivo no Cloudinary caso
  // o registro do ativo no banco falhe depois do upload.
  cloudinary: { uploader: { upload: mockUpload, upload_stream: mockUploadStream, destroy: mockDestroy } },
  deleteCloudinaryAsset: mockDeleteCloudinaryAsset,
}));

import { POST as AVATAR_POST, DELETE as AVATAR_DELETE } from "@/app/api/users/me/avatar/route";
import { POST as BANNER_POST, DELETE as BANNER_DELETE } from "@/app/api/users/me/banner/route";
import { POST as UPLOAD } from "@/app/api/upload/route";
import { POST as TEAM_MEDIA } from "@/app/api/teams/[slug]/media/route";
import { POST as UPLOAD_COMPLETE } from "@/app/api/upload/complete/route";

const image = { valid: true, detectedType: "image", mimeType: "image/png", width: 800, height: 600 };

/** FormData com um arquivo, do jeito que o handler consome. */
function uploadRequest(field = "file", name = "avatar.png", type = "image/png", sizeBytes = 1024) {
  const form = new FormData();
  const data = new Uint8Array(sizeBytes).fill(7);
  form.append(field, new File([data], name, { type }));
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}

/**
 * Avatar e banner são a mesma rota com nomes de campo diferentes — 143 linhas
 * idênticas exceto por avatar/banner, avatarPublicId/bannerPublicId e a pasta.
 * Parametrizar os dois e mais barato que dois arquivos, e passa a servir
 * de alarme: se alguém corrigir um e não o outro, a asserção diverge aqui.
 */
const PERFIL = [
  {
    rotulo: "avatar",
    post: AVATAR_POST,
    del: AVATAR_DELETE,
    campo: "avatar",
    campoPublicId: "avatarPublicId",
    purpose: MediaPurpose.AVATAR,
    pasta: "avatar",
  },
  {
    rotulo: "banner",
    post: BANNER_POST,
    del: BANNER_DELETE,
    campo: "banner",
    campoPublicId: "bannerPublicId",
    purpose: MediaPurpose.BANNER,
    pasta: "banner",
  },
] as const;

describe.each(PERFIL)("/api/users/me/$rotulo", ({ post, del, campo, campoPublicId, purpose, pasta }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockValidateFileType.mockReturnValue(image);
    mockUpload.mockResolvedValue({
      secure_url: "https://cdn.example.com/novo.png",
      public_id: "pasta/novo",
      width: 800,
      height: 600,
    });
    mockPrisma.user.findUnique.mockResolvedValue({ [campoPublicId]: "pasta/antigo" });
    mockPrisma.user.update.mockResolvedValue({ id: "test-user-id", [campo]: "https://cdn.example.com/novo.png" });
    mockRegisterAsset.mockResolvedValue({ id: "ma1" });
    // A rota encadeia .catch() no resultado, então o mock precisa devolver uma
    // promise — um undefined faria a chamada cair no
    // internalError e a falha apareceria como 500 sem causa aparente.
    mockDeleteCloudinaryAsset.mockResolvedValue(undefined);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await post(uploadRequest());

    expect(response.status).toBe(401);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a request with no file", async () => {
    const form = new FormData();

    const response = await post(new Request("http://localhost/api/upload", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a file over 5MB", async () => {
    const response = await post(uploadRequest("file", "grande.png", "image/png", 5 * 1024 * 1024 + 1));

    // O limite é verificado pelo tamanho declarado, antes de ler o arquivo
    // inteiro em memória.
    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a file whose magic bytes are not an image", async () => {
    mockValidateFileType.mockReturnValue({ valid: true, detectedType: "video", mimeType: "video/mp4" });

    const response = await post(uploadRequest("file", "video.mp4", "video/mp4"));

    // Um video não é aceito aqui mesmo passando no tipo detectado: a rota é
    // específica de imagem.
    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses an invalid file type", async () => {
    mockValidateFileType.mockReturnValue({ valid: false, detectedType: "unknown" });

    expect((await post(uploadRequest())).status).toBe(400);
  });

  it("refuses an image with no readable dimensions", async () => {
    mockValidateFileType.mockReturnValue({ ...image, width: undefined });

    expect((await post(uploadRequest())).status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("uploads and stores the new file, and returns it", async () => {
    const response = await post(uploadRequest());

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user[campo]).toBe("https://cdn.example.com/novo.png");
  });

  it("sends the validated mime type, not the one the client claimed", async () => {
    await post(uploadRequest("file", "x.png", "image/svg+xml"));

    // O data URL é montado com o tipo detectado pelos magic bytes; usar o
    // file.type do cliente deixaria passar um SVG disfarçado.
    const sent = mockUpload.mock.calls[0][0] as string;
    expect(sent.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("files under the owner's folder for this kind", async () => {
    await post(uploadRequest());

    expect(mockUpload.mock.calls[0][1].folder).toContain(`/${pasta}`);
    expect(mockUpload.mock.calls[0][1].resource_type).toBe("image");
  });

  it("records the asset with the right purpose", async () => {
    await post(uploadRequest());

    expect(mockRegisterAsset).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "test-user-id", purpose, resourceType: "image" }),
    );
  });

  it("stores both the url and the public id, so the old file can be deleted later", async () => {
    await post(uploadRequest());

    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
      [campo]: "https://cdn.example.com/novo.png",
      [campoPublicId]: "pasta/novo",
    });
  });

  it("deletes the previous file from Cloudinary after replacing it", async () => {
    await post(uploadRequest());

    // Sem isto, cada troca de avatar deixaria um órfão no Cloudinary, e o
    // plano gratuito tem cota de armazenamento.
    expect(mockDeleteCloudinaryAsset).toHaveBeenCalledWith("pasta/antigo");
  });

  it("does not call the delete when the user had no previous file", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ [campoPublicId]: null });

    const response = await post(uploadRequest());

    expect(response.status).toBe(200);
    expect(mockDeleteCloudinaryAsset).not.toHaveBeenCalled();
  });

  it("keeps the new file even when deleting the old one fails", async () => {
    mockDeleteCloudinaryAsset.mockRejectedValue(new Error("cloudinary fora do ar"));

    const response = await post(uploadRequest());

    // A limpeza é best-effort: falhar nela não pode desfazer um upload que
    // deu certo, senão o usuário ficaria sem avatar.
    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("clears the field and deletes the file on removal", async () => {
    const response = await del();

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
      [campo]: null,
      [campoPublicId]: null,
    });
    expect(mockDeleteCloudinaryAsset).toHaveBeenCalledWith("pasta/antigo");
  });

  it("returns 401 on removal without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await del();

    expect(response.status).toBe(401);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("skips the delete on removal when there is nothing stored", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ [campoPublicId]: null });

    await del();

    expect(mockDeleteCloudinaryAsset).not.toHaveBeenCalled();
  });
});

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockValidateFileType.mockReturnValue(image);
    mockRegisterAsset.mockResolvedValue({ id: "ma1" });
    // upload_stream precisa devolver algo que aceite .pipe(), então o mock
    // entrega um Writable de verdade e chama o callback no fim.
    mockUploadStream.mockImplementation(
      (_options: unknown, callback: (err: unknown, result: unknown) => void) =>
        new Writable({
          write(_chunk, _enc, next) {
            next();
          },
          final(next) {
            callback(null, {
              secure_url: "https://cdn.example.com/enviado.png",
              public_id: "pasta/enviado",
              width: 800,
              height: 600,
            });
            next();
          },
        }),
    );
  });

  const withLength = (req: Request, bytes: number) => {
    // Copiar os cabeçalhos é obrigatório: o content-type gerado pelo FormData
    // carrega o boundary da parte multipart, e sem ele formData() recusa o
    // corpo. O duplex é exigido ao repassar um stream como body.
    const headers = new Headers(req.headers);
    headers.set("content-length", String(bytes));
    return new NextRequest(req.url, { method: "POST", body: req.body, duplex: "half", headers } as ConstructorParameters<typeof NextRequest>[1]);
  };

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await UPLOAD(withLength(uploadRequest(), 2048));

    expect(response.status).toBe(401);
  });

  it("returns 413 when the declared content-length is over the maximum", async () => {
    const response = await UPLOAD(withLength(uploadRequest(), 200 * 1024 * 1024));

    // Checar o cabeçalho antes de autenticar e antes de ler o corpo evita
    // consumir a requisição inteira só para recusá-la.
    expect(response.status).toBe(413);
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("refuses a request with no file", async () => {
    const form = new FormData();
    const response = await UPLOAD(withLength(new Request("http://localhost/api/upload", { method: "POST", body: form }), 10));

    expect(response.status).toBe(400);
  });

  it("refuses a file the magic bytes reject", async () => {
    mockValidateFileType.mockReturnValue({ valid: false, detectedType: "unknown" });

    const response = await UPLOAD(withLength(uploadRequest(), 2048));

    expect(response.status).toBe(400);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it("accepts an image and registers the asset", async () => {
    const response = await UPLOAD(withLength(uploadRequest(), 2048));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toBe("https://cdn.example.com/enviado.png");
    expect(mockRegisterAsset).toHaveBeenCalled();
  });

  it("removes the uploaded file from Cloudinary when the asset record fails", async () => {
    mockRegisterAsset.mockRejectedValue(new Error("banco fora"));

    const response = await UPLOAD(withLength(uploadRequest(), 2048));

    // O arquivo já está no Cloudinary quando o registro falha; sem a limpeza,
    // toda retentativa deixaria um órfão ocupando cota do plano gratuito.
    expect(response.status).toBe(500);
    expect(mockDestroy).toHaveBeenCalledWith("pasta/enviado", { resource_type: "image" });
  });

  it("streams the file instead of buffering it as base64", async () => {
    await UPLOAD(withLength(uploadRequest(), 2048));

    // Base64 acrescentaria ~33% de memória por requisição; o stream entrega o
    // arquivo direto ao Cloudinary.
    expect(mockUploadStream).toHaveBeenCalled();
  });

  it("puts the file under the posts folder of the owner", async () => {
    await UPLOAD(withLength(uploadRequest(), 2048));

    expect(mockUploadStream.mock.calls[0][0].folder).toContain("/posts");
  });
});

describe("POST /api/teams/[slug]/media", () => {
  const SLUG = "cheer-squad";
  const TEAM_ID = "t1";
  const slugParams = { params: Promise.resolve({ slug: SLUG }) };
  const canEdit = { role: "COACH", canEdit: true, canPost: true, canInvite: true, canManageMembers: true, canDeleteTeam: false };

  function mediaRequest(kind: string | null = "logo", name = "logo.png") {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(512).fill(3)], name, { type: "image/png" }));
    if (kind !== null) form.append("kind", kind);
    return new NextRequest(`http://localhost/api/teams/${SLUG}/media`, { method: "POST", body: form } as ConstructorParameters<typeof NextRequest>[1]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockValidateFileType.mockReturnValue(image);
    mockUpload.mockResolvedValue({
      secure_url: "https://cdn.example.com/logo.png",
      public_id: "pasta/logo",
      width: 600,
      height: 600,
    });
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [canEdit] });
    mockRegisterAsset.mockResolvedValue({ id: "ma2" });
    mockDeleteCloudinaryAsset.mockResolvedValue(undefined);
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await TEAM_MEDIA(mediaRequest(), slugParams)).status).toBe(401);
  });

  it("refuses a request with no file", async () => {
    const form = new FormData();
    form.append("kind", "logo");

    const response = await TEAM_MEDIA(
      new NextRequest(`http://localhost/api/teams/${SLUG}/media`, { method: "POST", body: form } as ConstructorParameters<typeof NextRequest>[1]),
      slugParams,
    );

    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a request with no kind, since logo and banner are stored differently", async () => {
    const response = await TEAM_MEDIA(mediaRequest(null), slugParams);

    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a kind outside the allowed set", async () => {
    expect((await TEAM_MEDIA(mediaRequest("capa"), slugParams)).status).toBe(400);
  });

  it("answers 404 for an unknown slug", async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    expect((await TEAM_MEDIA(mediaRequest(), slugParams)).status).toBe(404);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("answers 403 for a member who cannot edit, and uploads nothing", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, members: [] });

    const response = await TEAM_MEDIA(mediaRequest(), slugParams);

    // O filtro canEdit está dentro da query, então um membro sem permissão
    // volta com members vazio e a rota traduz isso em 403.
    expect(response.status).toBe(403);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockRegisterAsset).not.toHaveBeenCalled();
  });

  it("registers a logo with the team logo purpose", async () => {
    await TEAM_MEDIA(mediaRequest("logo"), slugParams);

    expect(mockRegisterAsset).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: MediaPurpose.TEAM_LOGO, ownerId: "test-user-id" }),
    );
  });

  it("registers a banner with the team banner purpose", async () => {
    await TEAM_MEDIA(mediaRequest("banner"), slugParams);

    expect(mockRegisterAsset).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: MediaPurpose.TEAM_BANNER }),
    );
  });

  it("files the asset under the team folder of the owner", async () => {
    await TEAM_MEDIA(mediaRequest(), slugParams);

    expect(mockUpload.mock.calls[0][1].folder).toContain(`/teams/${TEAM_ID}`);
  });

  it("refuses a file whose magic bytes are not an image", async () => {
    mockValidateFileType.mockReturnValue({ valid: false, detectedType: "unknown" });

    expect((await TEAM_MEDIA(mediaRequest(), slugParams)).status).toBe(400);
  });
});

describe("POST /api/upload/complete", () => {
  const valid = {
    assetId: "asset-1",
    uploadToken: "t".repeat(24),
    url: "https://cdn.example.com/x.png",
    publicId: "pasta/x",
  };

  function completeRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession());
    mockCompleteAsset.mockResolvedValue({ id: "asset-1", status: "COMPLETED" });
  });

  it("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);

    expect((await UPLOAD_COMPLETE(completeRequest(valid))).status).toBe(401);
  });

  it("marks the pending asset as completed for its owner", async () => {
    const response = await UPLOAD_COMPLETE(completeRequest(valid));

    expect(response.status).toBe(200);
    expect((await response.json()).asset.status).toBe("COMPLETED");
    // ownerId vem da sessão, nunca do corpo: o cliente não pode concluir o
    // upload de um ativo de outra pessoa.
    expect(mockCompleteAsset.mock.calls[0][0].ownerId).toBe("test-user-id");
  });

  it("refuses a body without an asset id", async () => {
    const response = await UPLOAD_COMPLETE(completeRequest({ ...valid, assetId: "" }));

    expect(response.status).toBe(400);
    expect(mockCompleteAsset).not.toHaveBeenCalled();
  });

  it("refuses a url that is not a url", async () => {
    const response = await UPLOAD_COMPLETE(completeRequest({ ...valid, url: "nao-e-url" }));

    expect(response.status).toBe(400);
    expect(mockCompleteAsset).not.toHaveBeenCalled();
  });

  it("refuses a suspiciously short upload token", async () => {
    const response = await UPLOAD_COMPLETE(completeRequest({ ...valid, uploadToken: "curto" }));

    expect(response.status).toBe(400);
  });

  it("surfaces a rejected token as 400 rather than 500", async () => {
    mockCompleteAsset.mockRejectedValue(new Error("token inválido"));

    const response = await UPLOAD_COMPLETE(completeRequest(valid));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("token inválido");
  });
});
