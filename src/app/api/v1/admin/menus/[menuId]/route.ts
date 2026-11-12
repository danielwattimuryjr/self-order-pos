import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { menuSchema } from "@/lib/validation/catalog";

const idSchema = z.uuid();

export async function PATCH(request: Request, context: { params: Promise<{ menuId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { menuId } = await context.params;
  if (!idSchema.safeParse(menuId).success) return failure("VALIDATION_ERROR", "ID menu tidak valid.", 422);
  const parsed = menuSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data menu atau konfigurasi tidak valid.", 422);
  if (parsed.data.imagePath && !/^[0-9a-f]{8}-[0-9a-f-]{27,}\.(?:jpg|png|webp)$/i.test(parsed.data.imagePath)) return failure("VALIDATION_ERROR", "Path gambar tidak valid.", 422);
  const supabase = await createClient();
  const { data: old } = await supabase.from("menus").select("image_path").eq("id", menuId).maybeSingle();
  if (!old) return failure("MENU_NOT_FOUND", "Menu tidak ditemukan.", 404);
  const { data, error } = await supabase.rpc("admin_save_menu", {
    p_menu_id: menuId,
    p_payload: {
      categoryId: parsed.data.categoryId, name: parsed.data.name, description: parsed.data.description,
      price: parsed.data.price, imagePath: parsed.data.imagePath ?? null, isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder, configuration: parsed.data.configuration,
    },
  });
  if (error || !data) return failure("MENU_SAVE_FAILED", "Menu belum dapat disimpan.", error?.code === "23503" ? 409 : 500);
  if (old.image_path && old.image_path !== (parsed.data.imagePath ?? null)) await supabase.storage.from("menu-images").remove([old.image_path]);
  return success(data, "Menu diperbarui.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ menuId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { menuId } = await context.params;
  if (!idSchema.safeParse(menuId).success) return failure("VALIDATION_ERROR", "ID menu tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_menu", { p_menu_id: menuId });
  if (error) return failure(error.code === "P0002" ? "MENU_NOT_FOUND" : "MENU_HAS_HISTORY_OR_DELETE_FAILED", "Menu tidak dapat dihapus. Nonaktifkan menu jika sudah memiliki transaksi.", error.code === "P0002" ? 404 : 409);
  if (data?.image_path) await supabase.storage.from("menu-images").remove([data.image_path]);
  return success({ id: menuId }, "Menu dihapus.");
}
