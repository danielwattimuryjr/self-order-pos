import { failure, success } from "@/lib/api-response";
import { mapConfiguration } from "@/lib/catalog/configuration";
import { priceForMenuChoice } from "@/lib/catalog/price";
import { checkPublicOrderRateLimit } from "@/lib/security/public-order-rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateVoucher } from "@/lib/vouchers/eligibility";
import { voucherValidationRequestSchema } from "@/lib/validation/vouchers";

export async function POST(request: Request) {
  const parsed = voucherValidationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data voucher atau keranjang tidak valid.", 422);
  const limited = await checkPublicOrderRateLimit(request, parsed.data.tableCode);
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data: session, error: sessionError } = await supabase.rpc("get_active_table_session", {
    p_table_code: parsed.data.tableCode, p_session_id: parsed.data.sessionId,
  });
  if (sessionError || !session?.length) return failure("SESSION_EXPIRED", "Sesi meja telah berakhir. Pindai ulang QR meja.", 409);
  const menuIds = [...new Set(parsed.data.items.map((item) => item.menuId))];
  const [{ data: categories, error: categoryError }, { data: menus, error: menuError },
    { data: variants, error: variantError }, { data: addons, error: addonError },
    { data: voucher, error: voucherError }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active").eq("is_active", true),
    supabase.from("menus").select("id, category_id, name, price, is_active").in("id", menuIds).eq("is_active", true),
    supabase.from("menu_variant_groups").select("*, menu_variant_options(*)").order("sort_order"),
    supabase.from("menu_addon_groups").select("*, menu_addon_options(*)").order("sort_order"),
    supabase.from("vouchers").select("*, voucher_category_scopes(category_id)").eq("code", parsed.data.code).maybeSingle(),
  ]);
  if (categoryError || menuError || variantError || addonError || voucherError) return failure("VOUCHER_VALIDATION_UNAVAILABLE", "Voucher belum dapat diperiksa.", 500);
  if (!voucher) return success({ valid: false, reason: "Kode voucher tidak ditemukan." }, "Voucher tidak valid.");

  const activeCategoryIds = new Set((categories ?? []).map((category) => category.id));
  const activeMenus = new Map((menus ?? []).filter((menu) => activeCategoryIds.has(menu.category_id)).map((menu) => [menu.id, menu]));
  const items = [];
  for (const item of parsed.data.items) {
    const menu = activeMenus.get(item.menuId);
    if (!menu) return success({ valid: false, reason: "Ada menu yang sudah tidak tersedia. Perbarui keranjang." }, "Voucher tidak dapat diterapkan.");
    const configuration = mapConfiguration(
      (variants ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
      (addons ?? []).filter((group) => group.menu_id === menu.id) as Array<Record<string, unknown>>,
    );
    const priced = priceForMenuChoice(Number(menu.price), configuration, item);
    if (!priced.valid) return success({ valid: false, reason: priced.reason }, "Voucher tidak dapat diterapkan.");
    items.push({ categoryId: menu.category_id, quantity: item.quantity, unitPrice: priced.unitPrice });
  }

  const { count, error: reservationError } = await supabase.from("voucher_reservations")
    .select("id", { count: "exact", head: true }).eq("voucher_id", voucher.id).eq("status", "RESERVED");
  if (reservationError) return failure("VOUCHER_VALIDATION_UNAVAILABLE", "Voucher belum dapat diperiksa.", 500);
  const { voucher_category_scopes: scopes, ...rule } = voucher;
  const evaluation = evaluateVoucher(rule, items, (scopes as Array<{ category_id: string }>).map((scope) => scope.category_id), count ?? 0);
  if (!evaluation.valid) return success({ valid: false, reason: evaluation.reason }, "Voucher tidak valid.");
  return success({ ...evaluation }, "Voucher berhasil diterapkan.");
}
