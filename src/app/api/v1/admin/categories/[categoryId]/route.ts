import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation/catalog";

const idSchema = z.uuid();

export async function PATCH(request: Request, context: { params: Promise<{ categoryId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { categoryId } = await context.params;
  if (!idSchema.safeParse(categoryId).success) return failure("VALIDATION_ERROR", "ID kategori tidak valid.", 422);
  const parsed = categorySchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return failure("VALIDATION_ERROR", "Perubahan kategori tidak valid.", 422);
  const supabase = await createClient();
  const { data: before } = await supabase.from("categories").select("*").eq("id", categoryId).maybeSingle();
  if (!before) return failure("CATEGORY_NOT_FOUND", "Kategori tidak ditemukan.", 404);
  const patch = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.isActive !== undefined ? { is_active: parsed.data.isActive } : {}),
    ...(parsed.data.sortOrder !== undefined ? { sort_order: parsed.data.sortOrder } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("categories").update(patch).eq("id", categoryId).select().single();
  if (error || !data) return failure("CATEGORY_UPDATE_FAILED", "Kategori belum dapat diperbarui.", 500);
  try { await recordCatalogAudit(supabase, "CATEGORY_UPDATED", "category", categoryId, before, data); }
  catch { return failure("CATEGORY_AUDIT_FAILED", "Kategori tersimpan, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Kategori diperbarui.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ categoryId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { categoryId } = await context.params;
  if (!idSchema.safeParse(categoryId).success) return failure("VALIDATION_ERROR", "ID kategori tidak valid.", 422);
  const supabase = await createClient();
  const { data: before } = await supabase.from("categories").select("*").eq("id", categoryId).maybeSingle();
  if (!before) return failure("CATEGORY_NOT_FOUND", "Kategori tidak ditemukan.", 404);
  const { count, error: countError } = await supabase.from("menus").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
  if (countError) return failure("CATEGORY_CHECK_FAILED", "Kategori belum dapat diperiksa.", 500);
  if ((count ?? 0) > 0) return failure("CATEGORY_HAS_MENUS", "Pindahkan menu dari kategori ini sebelum menghapusnya.", 409);
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return failure("CATEGORY_DELETE_FAILED", "Kategori belum dapat dihapus.", 409);
  try { await recordCatalogAudit(supabase, "CATEGORY_DELETED", "category", categoryId, before, null); }
  catch { return failure("CATEGORY_AUDIT_FAILED", "Kategori terhapus, tetapi pencatatan audit gagal.", 500); }
  return success({ id: categoryId }, "Kategori dihapus.");
}
