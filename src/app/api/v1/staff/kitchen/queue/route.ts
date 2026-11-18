import { failure, success } from "@/lib/api-response";
import { requireStaffApi } from "@/lib/auth/staff-api";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const supabase = createServiceClient();
  const { error: archiveError } = await supabase.rpc(
    "archive_due_kitchen_tickets",
  );
  if (archiveError)
    return failure(
      "KITCHEN_QUEUE_UNAVAILABLE",
      "Antrean belum dapat disinkronkan.",
      503,
    );
  const { data: tickets, error } = await supabase
    .from("kitchen_tickets")
    .select("id, order_id, paid_at, operational_date, ticket_payload_snapshot")
    .is("archived_at", null)
    .order("paid_at")
    .order("id");
  if (error || !tickets)
    return failure(
      "KITCHEN_QUEUE_UNAVAILABLE",
      "Antrean belum dapat dimuat.",
      503,
    );
  const { data: reads, error: readError } = tickets.length
    ? await supabase
        .from("kitchen_ticket_reads")
        .select("ticket_id")
        .eq("staff_profile_id", auth.staff.id)
        .in(
          "ticket_id",
          tickets.map((ticket) => ticket.id),
        )
    : { data: [], error: null };
  if (readError)
    return failure(
      "KITCHEN_QUEUE_UNAVAILABLE",
      "Antrean belum dapat dimuat.",
      503,
    );
  const readIds = new Set((reads ?? []).map((read) => read.ticket_id));
  return success({
    tickets: tickets.map((ticket) => ({
      ...ticket,
      isNew: !readIds.has(ticket.id),
    })),
  });
}
