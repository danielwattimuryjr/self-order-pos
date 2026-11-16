import type { SupabaseClient } from "@supabase/supabase-js";
import { transactionQuerySchema } from "@/lib/validation/phase7";

export async function readTransactionPage(supabase: SupabaseClient, url: string) {
  const params = Object.fromEntries(new URL(url).searchParams);
  const parsed = transactionQuerySchema.safeParse(params);
  if (!parsed.success) return { error: "VALIDATION_ERROR" as const };
  const { q, status, from, to, page } = parsed.data;
  let query = supabase.from("orders").select(
    "id, order_number, table_number_snapshot, customer_name, order_status, payment_status, subtotal, discount_amount, total_amount, operational_date, created_at, paid_at, cancelled_at, cancellation_reason, payments(method, status, amount, paid_at, attempt_number)",
    { count: "exact" },
  );
  if (q) query = query.ilike("order_number", `%${q}%`);
  if (status) query = query.eq("payment_status", status);
  if (from) query = query.gte("operational_date", from);
  if (to) query = query.lte("operational_date", to);
  const { data, count, error } = await query
    .order("operational_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error || !data) return { error: "TRANSACTIONS_UNAVAILABLE" as const };
  return {
    data: {
      transactions: data,
      page,
      pageSize: 20,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / 20),
    },
  };
}

export async function readTransaction(supabase: SupabaseClient, orderId: string) {
  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("orders").select(
      "id, order_number, table_number_snapshot, customer_name, order_notes, order_status, payment_status, subtotal, discount_amount, total_amount, voucher_snapshot, operational_date, created_at, expires_at, paid_at, cancelled_at, cancellation_reason",
    ).eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select(
      "id, menu_name_snapshot, category_name_snapshot, menu_description_snapshot, base_price_snapshot, unit_price_snapshot, quantity, item_note, variant_snapshot, addon_snapshot, line_total",
    ).eq("order_id", orderId).order("created_at").order("id"),
    supabase.from("payments").select(
      "id, attempt_number, method, status, amount, provider_transaction_id, created_at, expires_at, paid_at",
    ).eq("order_id", orderId).order("attempt_number", { ascending: false }),
  ]);
  if (orderError || itemsError || paymentsError || !order) return null;
  return { order, items: items ?? [], payments: payments ?? [] };
}
