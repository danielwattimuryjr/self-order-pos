import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { builtInTemplates } from "@/lib/catalog/built-in-templates";
import { mapConfiguration } from "@/lib/catalog/configuration";
import { createClient } from "@/lib/supabase/server";
import { menuConfigurationSchema } from "@/lib/validation/catalog";

const idSchema = z.uuid();
const applySchema = z.object({ templateId: z.string().min(1), mode: z.enum(["REPLACE_ALL", "REPLACE_BY_TYPE"]), confirmed: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ menuId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { menuId } = await context.params;
  if (!idSchema.safeParse(menuId).success) return failure("VALIDATION_ERROR", "ID menu tidak valid.", 422);
  const parsed = applySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Pilihan template tidak valid.", 422);
  const supabase = await createClient();
  let rawConfiguration: unknown;
  if (parsed.data.templateId.startsWith("builtin-")) {
    const template = builtInTemplates.find((item) => item.id === parsed.data.templateId);
    if (!template) return failure("TEMPLATE_NOT_FOUND", "Template tidak ditemukan.", 404);
    rawConfiguration = template.configuration;
  } else {
    const { data } = await supabase.from("option_templates").select("configuration").eq("id", parsed.data.templateId).maybeSingle();
    if (!data) return failure("TEMPLATE_NOT_FOUND", "Template tidak ditemukan.", 404);
    rawConfiguration = data.configuration;
  }
  const templateParsed = menuConfigurationSchema.safeParse(rawConfiguration);
  if (!templateParsed.success) return failure("TEMPLATE_INVALID", "Template tidak valid dan tidak dapat diterapkan.", 422);
  const { data: menu } = await supabase.from("menus").select("*").eq("id", menuId).maybeSingle();
  if (!menu) return failure("MENU_NOT_FOUND", "Menu tidak ditemukan.", 404);
  const [{ data: groups, error: variantError }, { data: addons, error: addonError }] = await Promise.all([
    supabase.from("menu_variant_groups").select("*, menu_variant_options(*)").eq("menu_id", menuId).order("sort_order"),
    supabase.from("menu_addon_groups").select("*, menu_addon_options(*)").eq("menu_id", menuId).order("sort_order"),
  ]);
  if (variantError || addonError) return failure("MENU_CONFIGURATION_UNAVAILABLE", "Konfigurasi menu tidak tersedia.", 500);
  const current = mapConfiguration(groups ?? [], addons ?? []);
  const hasExisting = current.variants.length + current.addons.length > 0;
  if (hasExisting && !parsed.data.confirmed) return failure("CONFIRMATION_REQUIRED", "Konfirmasi penggantian konfigurasi menu diperlukan.", 409);
  const template = templateParsed.data;
  const configuration = parsed.data.mode === "REPLACE_ALL" ? template : {
    variants: template.variants.length ? template.variants : current.variants,
    addons: template.addons.length ? template.addons : current.addons,
  };
  const validatedConfiguration = menuConfigurationSchema.safeParse(configuration);
  if (!validatedConfiguration.success) return failure("CONFIGURATION_INVALID", "Konfigurasi gabungan tidak valid.", 422);
  const { data, error } = await supabase.rpc("admin_save_menu", {
    p_menu_id: menu.id,
    p_payload: {
      categoryId: menu.category_id, name: menu.name, description: menu.description, price: menu.price,
      imagePath: menu.image_path, isActive: menu.is_active, sortOrder: menu.sort_order,
      configuration: validatedConfiguration.data,
    },
  });
  if (error || !data) return failure("TEMPLATE_APPLY_FAILED", "Template belum dapat diterapkan.", 500);
  try { await recordCatalogAudit(supabase, "TEMPLATE_APPLIED", "menu", menuId, current, { templateId: parsed.data.templateId, mode: parsed.data.mode, configuration: validatedConfiguration.data }); }
  catch { return failure("TEMPLATE_AUDIT_FAILED", "Template diterapkan, tetapi pencatatan audit gagal.", 500); }
  return success(data, "Konfigurasi template diterapkan ke menu.");
}
