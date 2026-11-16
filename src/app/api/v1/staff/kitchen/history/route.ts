import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireStaffApi } from "@/lib/auth/staff-api";
import { createServiceClient } from "@/lib/supabase/service";

const querySchema = z.object({
  q: z.string().trim().max(50).optional(),
  table: z.coerce.number().int().positive().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).refine((query) => !query.from || !query.to || query.from <= query.to);

export async function GET(request: Request) {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return failure("VALIDATION_ERROR", "Filter riwayat tidak valid.", 422);
  const supabase = createServiceClient();
  const { error: archiveError } = await supabase.rpc("archive_due_kitchen_tickets");
  if (archiveError) return failure("KITCHEN_HISTORY_UNAVAILABLE", "Riwayat belum dapat disinkronkan.", 503);
  const { q, table, from, to, page } = parsed.data;
  let query = supabase.from("kitchen_tickets").select("id, order_id, paid_at, operational_date, ticket_payload_snapshot", { count: "exact" }).not("archived_at", "is", null);
  if (q) query = query.ilike("ticket_payload_snapshot->>orderNumber", `%${q}%`);
  if (table) query = query.eq("ticket_payload_snapshot->>tableNumber", String(table));
  if (from) query = query.gte("operational_date", from);
  if (to) query = query.lte("operational_date", to);
  const { data, count, error } = await query.order("operational_date", { ascending: false }).order("paid_at", { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (error || !data) return failure("KITCHEN_HISTORY_UNAVAILABLE", "Riwayat belum dapat dimuat.", 503);
  return success({ tickets: data, page, pageSize: 20, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / 20) });
}
