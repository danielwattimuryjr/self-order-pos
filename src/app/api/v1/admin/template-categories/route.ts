import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { createClient } from "@/lib/supabase/server";
import { templateCategorySchema } from "@/lib/validation/catalog";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const { data, error } = await supabase.from("template_categories").select("*").order("sort_order").order("name");
  if (error) return failure("TEMPLATE_CATEGORIES_UNAVAILABLE", "Kategori template tidak tersedia.", 500);
  return success(data);
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = templateCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Nama kategori template tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.from("template_categories").insert({ name: parsed.data.name, created_by: auth.staff.id, updated_by: auth.staff.id }).select().single();
  if (error || !data) return failure("TEMPLATE_CATEGORY_CREATE_FAILED", "Kategori template belum dapat dibuat.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_CATEGORY_CREATED", "template_category", data.id, null, data); }
  catch { return failure("TEMPLATE_CATEGORY_AUDIT_FAILED", "Kategori dibuat, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Kategori template dibuat.");
}
