import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { builtInTemplates } from "@/lib/catalog/built-in-templates";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ templateId: z.string().min(1), name: z.string().trim().min(1).max(120), categoryId: z.uuid().nullable().optional() });

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data duplikasi template tidak valid.", 422);
  const supabase = await createClient();
  let configuration: unknown;
  if (parsed.data.templateId.startsWith("builtin-")) {
    const source = builtInTemplates.find((template) => template.id === parsed.data.templateId);
    if (!source) return failure("TEMPLATE_NOT_FOUND", "Template tidak ditemukan.", 404);
    configuration = source.configuration;
  } else {
    const { data: source } = await supabase.from("option_templates").select("configuration").eq("id", parsed.data.templateId).maybeSingle();
    if (!source) return failure("TEMPLATE_NOT_FOUND", "Template tidak ditemukan.", 404);
    configuration = source.configuration;
  }
  const { data, error } = await supabase.from("option_templates").insert({
    name: parsed.data.name, category_id: parsed.data.categoryId ?? null, configuration,
    created_by: auth.staff.id, updated_by: auth.staff.id,
  }).select().single();
  if (error || !data) return failure("TEMPLATE_DUPLICATE_FAILED", "Template belum dapat diduplikasi.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_DUPLICATED", "option_template", data.id, null, data); }
  catch { return failure("TEMPLATE_AUDIT_FAILED", "Template diduplikasi, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Template diduplikasi.");
}
