import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { mapConfiguration } from "@/lib/catalog/configuration";
import { checkCatalogRateLimit } from "@/lib/security/catalog-rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRestaurantOperatingStatus } from "@/lib/time/restaurant-hours";

const tableCodeSchema = z.uuid().refine((value) => value[14] === "4", "Kode meja tidak valid.");

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ tableCode: string }> }) {
  const requestUrl = new URL(_request.url);
  const sessionId = requestUrl.searchParams.get("sessionId");
  const { tableCode } = await context.params;
  if (!tableCodeSchema.safeParse(tableCode).success) return failure("TABLE_UNAVAILABLE", "QR meja tidak valid atau tidak tersedia.", 404);
  const rateLimitResponse = await checkCatalogRateLimit(_request, tableCode);
  if (rateLimitResponse) return rateLimitResponse;
  if (sessionId && !z.uuid().safeParse(sessionId).success) return failure("SESSION_EXPIRED", "Sesi meja tidak valid. Pindai ulang QR meja.", 409);
  const serviceSupabase = createServiceClient();
  const { data: resolution, error: sessionError } = sessionId
    ? await serviceSupabase.rpc("get_active_table_session", { p_table_code: tableCode, p_session_id: sessionId })
    : await serviceSupabase.rpc("resolve_table_session", { p_table_code: tableCode });
  const session = resolution?.[0];
  if (sessionError || !session) return sessionId
    ? failure("SESSION_EXPIRED", "Sesi meja telah berakhir. Pindai ulang QR meja untuk memulai sesi baru.", 409)
    : failure("TABLE_UNAVAILABLE", "Meja tidak aktif atau tidak tersedia.", 404);

  const supabase = await createClient();
  const [{ data: categories, error: categoryError }, { data: menus, error: menuError },
    { data: variants, error: variantError }, { data: addons, error: addonError },
    { data: settingsData, error: settingsError }] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("menus").select("id, category_id, name, description, price, image_path, is_active, sort_order").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("menu_variant_groups").select("*, menu_variant_options(*)").order("sort_order"),
    supabase.from("menu_addon_groups").select("*, menu_addon_options(*)").order("sort_order"),
    supabase.from("restaurant_public_status").select("opening_time, closing_time, temporary_closed, temporary_close_reason, temporary_close_other, temporary_closed_at").eq("singleton", true).maybeSingle(),
  ]);
  if (categoryError || menuError || variantError || addonError || settingsError) return failure("CATALOG_UNAVAILABLE", "Katalog belum dapat dimuat. Coba beberapa saat lagi.", 500);

  const categoryIds = new Set((categories ?? []).map((category) => category.id));
  const activeMenus = (menus ?? []).filter((menu) => categoryIds.has(menu.category_id));
  const data = {
    table: { id: session.table_id, tableNumber: session.table_number },
    session: { id: session.session_id, expiresAt: session.session_expires_at },
    operatingStatus: settingsData ? getRestaurantOperatingStatus(settingsData) : { status: "NOT_CONFIGURED" as const },
    temporaryCloseReason: settingsData?.temporary_close_reason === "OTHER"
      ? settingsData.temporary_close_other
      : ({ STOCK_OUT: "Stok habis", OPERATIONAL_ISSUE: "Gangguan operasional", EMERGENCY: "Keadaan darurat" } as Record<string, string>)[settingsData?.temporary_close_reason ?? ""] ?? null,
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
      menus: activeMenus.filter((menu) => menu.category_id === category.id).map((menu) => ({
        id: menu.id,
        categoryId: menu.category_id,
        name: menu.name,
        description: menu.description,
        price: Number(menu.price),
        imageUrl: menu.image_path ? supabase.storage.from("menu-images").getPublicUrl(menu.image_path).data.publicUrl : null,
        sortOrder: menu.sort_order,
        configuration: mapConfiguration(
          (variants ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
          (addons ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
        ),
      })),
    })),
  };
  return success(data, "Katalog tersedia.");
}
