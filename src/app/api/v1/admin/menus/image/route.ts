import { randomUUID } from "node:crypto";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function matchesImageSignature(mime: string, bytes: Uint8Array) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mime === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 2 * 1024 * 1024) return failure("INVALID_IMAGE", "Pilih foto dengan ukuran maksimal 2 MB.", 422);
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) return failure("INVALID_IMAGE", "Format foto harus JPG, PNG, atau WebP.", 422);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(file.type, bytes)) return failure("INVALID_IMAGE", "Isi file tidak cocok dengan format foto yang dipilih.", 422);
  const path = `${randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("menu-images").upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) return failure("IMAGE_UPLOAD_FAILED", "Foto belum dapat diunggah.", 500);
  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  return success({ path, publicUrl: data.publicUrl }, "Foto berhasil diunggah.");
}
