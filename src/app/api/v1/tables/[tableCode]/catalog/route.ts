import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { mapConfiguration } from "@/lib/catalog/configuration";
import {
  buildCatalogIlikePattern,
  CUSTOMER_CATALOG_PAGE_SIZE,
  parseCustomerCatalogQuery,
} from "@/lib/catalog/customer-catalog-query";
import { checkCatalogRateLimit } from "@/lib/security/catalog-rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRestaurantOperatingStatus } from "@/lib/time/restaurant-hours";

const tableCodeSchema = z.uuid().refine((value) => value[14] === "4", "Kode meja tidak valid.");
const menuColumns = "id, category_id, name, description, price, image_path, sort_order";
type CatalogMenuRow = { id: string; category_id: string; name: string; description: string; price: number | string; image_path: string | null; sort_order: number };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ tableCode: string }> }) {
  const requestUrl = new URL(request.url);
  const { tableCode } = await context.params;
  if (!tableCodeSchema.safeParse(tableCode).success) return failure("TABLE_UNAVAILABLE", "QR meja tidak valid atau tidak tersedia.", 404);

  const rateLimitResponse = await checkCatalogRateLimit(request, tableCode);
  if (rateLimitResponse) return rateLimitResponse;

  const parsedQuery = parseCustomerCatalogQuery(requestUrl.searchParams);
  if (!parsedQuery.success) return failure("INVALID_CATALOG_QUERY", "Filter katalog tidak valid.", 422);
  const { search, category, page, retainMenuId } = parsedQuery.data;
  const sessionId = requestUrl.searchParams.get("sessionId");
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
  const buildPagedMenuQuery = (requestedPage: number) => {
    let query = supabase.from("menus")
      .select(`${menuColumns}, categories!inner(sort_order,name)`, { count: "exact" })
      .eq("is_active", true)
      .eq("categories.is_active", true);
    if (category) query = query.eq("category_id", category);
    if (search) {
      const pattern = buildCatalogIlikePattern(search);
      query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
    }
    return query
      .order("sort_order", { referencedTable: "categories", ascending: true })
      .order("name", { referencedTable: "categories", ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range((requestedPage - 1) * CUSTOMER_CATALOG_PAGE_SIZE, requestedPage * CUSTOMER_CATALOG_PAGE_SIZE - 1);
  };

  const retainedMenuQuery = retainMenuId.length
    ? supabase.from("menus").select(menuColumns).in("id", retainMenuId).eq("is_active", true)
    : Promise.resolve({ data: [], error: null });

  const [categoryResult, menuResult, retainedMenuResult, settingsResult] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").eq("is_active", true).order("sort_order").order("name"),
    buildPagedMenuQuery(page),
    retainedMenuQuery,
    supabase.from("restaurant_public_status").select("opening_time, closing_time, temporary_closed, temporary_close_reason, temporary_close_other, temporary_closed_at").eq("singleton", true).maybeSingle(),
  ]);
  const { data: categories, error: categoryError } = categoryResult;
  const { data: menus, error: menuError, count: totalItems } = menuResult;
  const { data: retainedMenus, error: retainedMenuError } = retainedMenuResult;
  const { data: settingsData, error: settingsError } = settingsResult;
  if (categoryError || menuError || retainedMenuError || settingsError) return failure("CATALOG_UNAVAILABLE", "Katalog belum dapat dimuat. Coba beberapa saat lagi.", 500);

  const visibleCategoryIds = new Set((categories ?? []).map((item) => item.id));
  const pageMenus = (menus ?? []).filter((menu) => visibleCategoryIds.has(menu.category_id));
  const pageMenuIds = new Set(pageMenus.map((menu) => menu.id));
  const preservedMenus = (retainedMenus ?? []).filter((menu) => visibleCategoryIds.has(menu.category_id) && !pageMenuIds.has(menu.id));
  const configurationMenuIds = [...new Set([...pageMenus, ...preservedMenus].map((menu) => menu.id))];
  const [variantsResult, addonsResult] = configurationMenuIds.length
    ? await Promise.all([
      supabase.from("menu_variant_groups").select("*, menu_variant_options(*)").in("menu_id", configurationMenuIds).order("sort_order"),
      supabase.from("menu_addon_groups").select("*, menu_addon_options(*)").in("menu_id", configurationMenuIds).order("sort_order"),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (variantsResult.error || addonsResult.error) return failure("CATALOG_UNAVAILABLE", "Katalog belum dapat dimuat. Coba beberapa saat lagi.", 500);

  const toCustomerMenu = (menu: CatalogMenuRow) => ({
    id: menu.id,
    categoryId: menu.category_id,
    name: menu.name,
    description: menu.description,
    price: Number(menu.price),
    imageUrl: menu.image_path ? supabase.storage.from("menu-images").getPublicUrl(menu.image_path).data.publicUrl : null,
    sortOrder: menu.sort_order,
    configuration: mapConfiguration(
      (variantsResult.data ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
      (addonsResult.data ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
    ),
  });

  const data = {
    table: { id: session.table_id, tableNumber: session.table_number },
    session: { id: session.session_id, expiresAt: session.session_expires_at },
    operatingStatus: settingsData ? getRestaurantOperatingStatus(settingsData) : { status: "NOT_CONFIGURED" as const },
    temporaryCloseReason: settingsData?.temporary_close_reason === "OTHER"
      ? settingsData.temporary_close_other
      : ({ STOCK_OUT: "Stok habis", OPERATIONAL_ISSUE: "Gangguan operasional", EMERGENCY: "Keadaan darurat" } as Record<string, string>)[settingsData?.temporary_close_reason ?? ""] ?? null,
    categories: (categories ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      sortOrder: item.sort_order,
      menus: pageMenus.filter((menu) => menu.category_id === item.id).map(toCustomerMenu),
    })),
    retainedMenus: preservedMenus.map(toCustomerMenu),
    pagination: {
      page,
      pageSize: CUSTOMER_CATALOG_PAGE_SIZE,
      totalItems: totalItems ?? 0,
      totalPages: Math.ceil((totalItems ?? 0) / CUSTOMER_CATALOG_PAGE_SIZE),
    },
  };
  return success(data, "Katalog tersedia.");
}
