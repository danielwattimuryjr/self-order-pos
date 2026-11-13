import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { voucherCreateSchema } from "@/lib/validation/vouchers";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const [{ data: vouchers, error }, { data: categories, error: categoryError }, { data: reservations, error: reservationError }] = await Promise.all([
    supabase.from("vouchers").select("*, voucher_category_scopes(category_id)").order("updated_at", { ascending: false }),
    supabase.from("categories").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("voucher_reservations").select("voucher_id").eq("status", "RESERVED"),
  ]);
  if (error || categoryError || reservationError) return failure("VOUCHERS_UNAVAILABLE", "Daftar voucher belum dapat dimuat.", 500);
  const reservationCounts = new Map<string, number>();
  for (const reservation of reservations ?? []) {
    if (reservation.voucher_id) reservationCounts.set(reservation.voucher_id, (reservationCounts.get(reservation.voucher_id) ?? 0) + 1);
  }
  return success({
    vouchers: (vouchers ?? []).map((voucher) => ({
      ...voucher,
      categoryIds: (voucher.voucher_category_scopes as Array<{ category_id: string }>).map((scope) => scope.category_id),
      reservedCount: reservationCounts.get(voucher.id) ?? 0,
      voucher_category_scopes: undefined,
    })),
    categories: categories ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = voucherCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data voucher tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_voucher", { p_voucher_id: null, p_payload: parsed.data });
  if (error) {
    if (error.code === "23505") return failure("VOUCHER_CODE_EXISTS", "Kode voucher sudah digunakan.", 409);
    if (error.code === "42501") return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure("VOUCHER_CREATE_FAILED", "Voucher belum dapat disimpan.", 500);
  }
  return success(data, "Voucher dibuat.");
}
