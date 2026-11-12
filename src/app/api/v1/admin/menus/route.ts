import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { mapConfiguration } from "@/lib/catalog/configuration";
import { createClient } from "@/lib/supabase/server";
import { menuSchema } from "@/lib/validation/catalog";

const idSchema = z.uuid();

async function getMenus(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: menus, error } = await supabase.from("menus").select("*, categories(name)").order("category_id").order("sort_order");
  if (error) throw error;
  const { data: variantGroups, error: variantError } = await supabase.from("menu_variant_groups").select("*, menu_variant_options(*)").order("sort_order");
  if (variantError) throw variantError;
  const { data: addonGroups, error: addonError } = await supabase.from("menu_addon_groups").select("*, menu_addon_options(*)").order("sort_order");
  if (addonError) throw addonError;
  return menus.map((menu) => ({
    ...menu,
    categoryName: menu.categories?.name ?? "",
    configuration: mapConfiguration(
      (variantGroups ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
      (addonGroups ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
    ),
  }));
}

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  try { return success(await getMenus(supabase)); }
  catch { return failure("MENUS_UNAVAILABLE", "Daftar menu tidak tersedia.", 500); }
}

async function saveMenu(request: Request, menuId: string | null) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  if (menuId && !idSchema.safeParse(menuId).success) return failure("VALIDATION_ERROR", "ID menu tidak valid.", 422);
  const parsed = menuSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data menu atau konfigurasi tidak valid.", 422);
  if (parsed.data.imagePath && !/^[0-9a-f]{8}-[0-9a-f-]{27,}\.(?:jpg|png|webp)$/i.test(parsed.data.imagePath)) {
    return failure("VALIDATION_ERROR", "Path gambar tidak valid.", 422);
  }
  const supabase = await createClient();
  let oldImagePath: string | null = null;
  if (menuId) {
    const { data: old } = await supabase.from("menus").select("image_path").eq("id", menuId).maybeSingle();
    if (!old) return failure("MENU_NOT_FOUND", "Menu tidak ditemukan.", 404);
    oldImagePath = old.image_path;
  }
  const { data, error } = await supabase.rpc("admin_save_menu", {
    p_menu_id: menuId,
    p_payload: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      imagePath: parsed.data.imagePath ?? null,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
      configuration: parsed.data.configuration,
    },
  });
  if (error || !data) {
    if (error?.code === "P0002") return failure("MENU_NOT_FOUND", "Menu tidak ditemukan.", 404);
    return failure("MENU_SAVE_FAILED", "Menu belum dapat disimpan.", error?.code === "23503" ? 409 : 500);
  }
  const newImagePath = parsed.data.imagePath ?? null;
  if (oldImagePath && oldImagePath !== newImagePath) await supabase.storage.from("menu-images").remove([oldImagePath]);
  return success(data, menuId ? "Menu diperbarui." : "Menu ditambahkan.");
}

export async function POST(request: Request) { return saveMenu(request, null); }

