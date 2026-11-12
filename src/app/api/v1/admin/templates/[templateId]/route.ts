import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { createClient } from "@/lib/supabase/server";
import { templateUpdateSchema } from "@/lib/validation/catalog";

const idSchema = z.uuid();

export async function PATCH(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { templateId } = await context.params;
  if (!idSchema.safeParse(templateId).success) return failure("VALIDATION_ERROR", "ID template tidak valid.", 422);
  const parsed = templateUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data template tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_option_template", {
    p_template_id: templateId,
    p_expected_version: parsed.data.version,
    p_name: parsed.data.name,
    p_category_id: parsed.data.categoryId ?? null,
    p_configuration: parsed.data.configuration,
  });
  if (error?.code === "40001") return failure("TEMPLATE_VERSION_CONFLICT", "Template telah diubah Admin lain. Muat ulang sebelum menyimpan.", 409);
  if (error?.code === "P0002") return failure("TEMPLATE_NOT_FOUND", "Template tidak ditemukan.", 404);
  if (error || !data) return failure("TEMPLATE_UPDATE_FAILED", "Template belum dapat disimpan.", 500);
  return success(data, "Template diperbarui.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ templateId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { templateId } = await context.params;
  if (!idSchema.safeParse(templateId).success) return failure("VALIDATION_ERROR", "ID template tidak valid.", 422);
  const supabase = await createClient();
  const { data: before } = await supabase.from("option_templates").select("*").eq("id", templateId).maybeSingle();
  if (!before) return failure("TEMPLATE_NOT_FOUND", "Template tidak ditemukan.", 404);
  const { error } = await supabase.from("option_templates").delete().eq("id", templateId);
  if (error) return failure("TEMPLATE_DELETE_FAILED", "Template belum dapat dihapus.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_DELETED", "option_template", templateId, before, null); }
  catch { return failure("TEMPLATE_AUDIT_FAILED", "Template terhapus, tetapi pencatatan audit gagal.", 500); }
  return success({ id: templateId }, "Template dihapus.");
}
