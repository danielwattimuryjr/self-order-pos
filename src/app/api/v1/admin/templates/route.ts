import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { builtInTemplates } from "@/lib/catalog/built-in-templates";
import { createClient } from "@/lib/supabase/server";
import { templateCreateSchema } from "@/lib/validation/catalog";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const [{ data: templates, error }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from("option_templates").select("*").order("updated_at", { ascending: false }),
    supabase.from("template_categories").select("*").order("sort_order").order("name"),
  ]);
  if (error || categoryError) return failure("TEMPLATES_UNAVAILABLE", "Daftar template tidak tersedia.", 500);
  return success({
    builtIns: builtInTemplates.map((template) => ({ ...template, source: "BUILT_IN", version: 1, categoryId: null })),
    custom: templates ?? [],
    categories: categories ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = templateCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data template tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.from("option_templates").insert({
    name: parsed.data.name,
    category_id: parsed.data.categoryId ?? null,
    configuration: parsed.data.configuration,
    created_by: auth.staff.id,
    updated_by: auth.staff.id,
  }).select().single();
  if (error || !data) return failure("TEMPLATE_CREATE_FAILED", "Template belum dapat disimpan.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_CREATED", "option_template", data.id, null, data); }
  catch { return failure("TEMPLATE_AUDIT_FAILED", "Template tersimpan, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Template dibuat.");
}
