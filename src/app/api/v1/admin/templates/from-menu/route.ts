import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { mapConfiguration } from "@/lib/catalog/configuration";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ menuId: z.uuid(), name: z.string().trim().min(1).max(120), categoryId: z.uuid().nullable().optional() });

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data template dari menu tidak valid.", 422);
  const supabase = await createClient();
  const [{ data: groups, error: variantError }, { data: addons, error: addonError }] = await Promise.all([
    supabase.from("menu_variant_groups").select("*, menu_variant_options(*)").eq("menu_id", parsed.data.menuId).order("sort_order"),
    supabase.from("menu_addon_groups").select("*, menu_addon_options(*)").eq("menu_id", parsed.data.menuId).order("sort_order"),
  ]);
  if (variantError || addonError) return failure("MENU_CONFIGURATION_UNAVAILABLE", "Konfigurasi menu tidak tersedia.", 500);
  const configuration = mapConfiguration(groups ?? [], addons ?? []);
  if (configuration.variants.length + configuration.addons.length === 0) return failure("EMPTY_MENU_CONFIGURATION", "Menu ini belum memiliki konfigurasi untuk disimpan.", 422);
  const { data, error } = await supabase.from("option_templates").insert({
    name: parsed.data.name, category_id: parsed.data.categoryId ?? null, configuration,
    created_by: auth.staff.id, updated_by: auth.staff.id,
  }).select().single();
  if (error || !data) return failure("TEMPLATE_CREATE_FAILED", "Template belum dapat dibuat.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_SAVED_FROM_MENU", "option_template", data.id, null, data); }
  catch { return failure("TEMPLATE_AUDIT_FAILED", "Template tersimpan, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Konfigurasi disimpan sebagai template.");
}
