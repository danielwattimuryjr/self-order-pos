import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { createClient } from "@/lib/supabase/server";
import { templateCategorySchema } from "@/lib/validation/catalog";

const idSchema = z.uuid();

export async function PATCH(request: Request, context: { params: Promise<{ categoryId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { categoryId } = await context.params;
  if (!idSchema.safeParse(categoryId).success) return failure("VALIDATION_ERROR", "ID kategori tidak valid.", 422);
  const parsed = templateCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Nama kategori template tidak valid.", 422);
  const supabase = await createClient();
  const { data: before } = await supabase.from("template_categories").select("*").eq("id", categoryId).maybeSingle();
  if (!before) return failure("TEMPLATE_CATEGORY_NOT_FOUND", "Kategori template tidak ditemukan.", 404);
  const { data, error } = await supabase.from("template_categories").update({ name: parsed.data.name, updated_by: auth.staff.id, updated_at: new Date().toISOString() }).eq("id", categoryId).select().single();
  if (error || !data) return failure("TEMPLATE_CATEGORY_UPDATE_FAILED", "Kategori template belum dapat diperbarui.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_CATEGORY_UPDATED", "template_category", categoryId, before, data); }
  catch { return failure("TEMPLATE_CATEGORY_AUDIT_FAILED", "Kategori diperbarui, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Kategori template diperbarui.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ categoryId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { categoryId } = await context.params;
  if (!idSchema.safeParse(categoryId).success) return failure("VALIDATION_ERROR", "ID kategori tidak valid.", 422);
  const supabase = await createClient();
  const { data: before } = await supabase.from("template_categories").select("*").eq("id", categoryId).maybeSingle();
  if (!before) return failure("TEMPLATE_CATEGORY_NOT_FOUND", "Kategori template tidak ditemukan.", 404);
  const { error } = await supabase.from("template_categories").delete().eq("id", categoryId);
  if (error) return failure("TEMPLATE_CATEGORY_DELETE_FAILED", "Kategori template belum dapat dihapus.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_CATEGORY_DELETED", "template_category", categoryId, before, null); }
  catch { return failure("TEMPLATE_CATEGORY_AUDIT_FAILED", "Kategori terhapus, tetapi pencatatan audit gagal.", 500); }
  return success({ id: categoryId }, "Kategori template dihapus. Template terkait dipindahkan ke Tanpa Kategori.");
}
