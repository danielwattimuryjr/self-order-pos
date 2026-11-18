import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireStaffApi } from "@/lib/auth/staff-api";
import { createServiceClient } from "@/lib/supabase/service";

const idSchema = z.uuid();

export async function POST(
  _request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const { ticketId } = await context.params;
  if (!idSchema.safeParse(ticketId).success)
    return failure("TICKET_NOT_FOUND", "Tiket tidak ditemukan.", 404);
  const supabase = createServiceClient();
  const { error: archiveError } = await supabase.rpc(
    "archive_due_kitchen_tickets",
  );
  if (archiveError)
    return failure(
      "TICKET_UNAVAILABLE",
      "Status tiket belum dapat diperbarui.",
      503,
    );
  const { data, error } = await supabase.rpc("mark_kitchen_ticket_read", {
    p_ticket_id: ticketId,
    p_staff_profile_id: auth.staff.id,
  });
  if (error)
    return failure(
      error.message === "FORBIDDEN" ? "FORBIDDEN" : "TICKET_NOT_FOUND",
      "Status tiket belum dapat diperbarui.",
      error.message === "FORBIDDEN" ? 403 : 404,
    );
  return success({ read: Boolean(data) }, "Tiket ditandai telah dilihat.");
}
