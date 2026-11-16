import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireStaffApi } from "@/lib/auth/staff-api";
import { createServiceClient } from "@/lib/supabase/service";

const idSchema = z.uuid();

export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const { ticketId } = await context.params;
  if (!idSchema.safeParse(ticketId).success) return failure("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);
  const supabase = createServiceClient();
  const { error: archiveError } = await supabase.rpc("archive_due_kitchen_tickets");
  if (archiveError) return failure("TICKET_UNAVAILABLE", "Detail tiket belum dapat dimuat.", 503);
  const { data: ticket, error } = await supabase.from("kitchen_tickets").select("id, order_id, paid_at, operational_date, archived_at, ticket_payload_snapshot").eq("id", ticketId).maybeSingle();
  if (error || !ticket) return failure("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);
  const { data: read } = await supabase.from("kitchen_ticket_reads").select("ticket_id").eq("ticket_id", ticketId).eq("staff_profile_id", auth.staff.id).maybeSingle();
  if (!ticket.archived_at) return success({ ...ticket, isNew: !read });
  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: payment, error: paymentError }] = await Promise.all([
    supabase.from("orders").select("order_number, table_number_snapshot, customer_name, order_notes, subtotal, discount_amount, total_amount, paid_at, operational_date").eq("id", ticket.order_id).maybeSingle(),
    supabase.from("order_items").select("menu_name_snapshot, quantity, item_note, unit_price_snapshot, line_total, variant_snapshot, addon_snapshot").eq("order_id", ticket.order_id).order("created_at").order("id"),
    supabase.from("payments").select("method, status, paid_at").eq("order_id", ticket.order_id).eq("status", "PAID").order("attempt_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (orderError || itemsError || paymentError || !order || !items) return failure("TICKET_UNAVAILABLE", "Detail riwayat belum dapat dimuat.", 503);
  return success({ ...ticket, isNew: false, order, items, payment });
}
