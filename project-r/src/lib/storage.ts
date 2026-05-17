import { createServerClient } from "@/lib/supabase/server";
import type { AppError, Result } from "@/lib/types";
import { ok, err } from "@/lib/types";
import sharp from "sharp";

export async function getPlayerPhotoUrl(
  photoPath: string | null | undefined
): Promise<string | null> {
  if (!photoPath) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("player-photos")
    .createSignedUrl(photoPath, 3600);

  if (error || !data?.signedUrl) {
    console.warn("[getPlayerPhotoUrl] Failed to generate signed URL:", error?.message);
    return null;
  }

  return data.signedUrl;
}

export async function uploadPlayerPhotoFile(
  clubId: string,
  playerId: string,
  file: File
): Promise<Result<{ photoPath: string }, AppError>> {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return err({
      code: "validation",
      message: "Tipo de ficheiro inválido. Use JPG, PNG ou WebP.",
    });
  }

  if (file.size === 0) {
    return err({
      code: "validation",
      message: "Ficheiro vazio. Selecciona uma imagem válida.",
    });
  }

  if (file.size > 2 * 1024 * 1024) {
    return err({
      code: "validation",
      message: "Ficheiro demasiado grande (máximo 2MB).",
    });
  }

  try {
    const buffer = await file.arrayBuffer();
    const ext =
      file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";

    const pipeline = sharp(buffer).resize(512, 512, { fit: "inside", withoutEnlargement: true });
    const resized = await (
      ext === "webp" ? pipeline.webp() :
      ext === "png" ? pipeline.png() :
      pipeline.jpeg()
    ).toBuffer();

    const photoPath = `${clubId}/${playerId}.${ext}`;
    const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    const supabase = await createServerClient();

    const { error: uploadError } = await supabase.storage
      .from("player-photos")
      .upload(photoPath, resized, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      return err({
        code: "unknown",
        message: `Erro ao fazer upload: ${uploadError.message}`,
      });
    }

    return ok({ photoPath });
  } catch (uploadException) {
    const message = uploadException instanceof Error ? uploadException.message : "Unknown error";
    return err({
      code: "unknown",
      message: `Erro ao processar imagem: ${message}`,
    });
  }
}
