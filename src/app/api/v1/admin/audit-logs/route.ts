import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { auditQuerySchema } from "@/lib/validation/phase7";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = auditQuerySchema.safeParse(params);
  if (!parsed.success) return failure("VALIDATION_ERROR", "Filter Audit Log tidak valid.", 422);

  const { q, from, to, page } = parsed.data;
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select(
    "id, actor_staff_id, action, entity_type, entity_id, before_value, after_value, metadata, created_at",
    { count: "exact" },
  );
  if (q) {
    const escaped = q.replace(/[\\%_,()]/g, "\\$&");
    query = query.ilike("action", `%${escaped}%`);
  }
  if (from) query = query.gte("created_at", new Date(`${from}T00:00:00+07:00`).toISOString());
  if (to) query = query.lt("created_at", new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000).toISOString());
  const { data, count, error } = await query.order("created_at", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (error || !data) return failure("AUDIT_LOG_UNAVAILABLE", "Audit Log belum dapat dimuat.", 503);

  const actorIds = [...new Set(data.flatMap((entry) => entry.actor_staff_id ? [entry.actor_staff_id] : []))];
  const { data: actors, error: actorError } = actorIds.length
    ? await supabase.from("staff_profiles").select("id, name, email").in("id", actorIds)
    : { data: [], error: null };
  if (actorError) return failure("AUDIT_LOG_UNAVAILABLE", "Informasi Admin belum dapat dimuat.", 503);
  const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]));
  const total = count ?? 0;
  return success({
    entries: data.map((entry) => ({ ...entry, actor: entry.actor_staff_id ? actorById.get(entry.actor_staff_id) ?? null : null })),
    page,
    pageSize: 25,
    total,
    totalPages: Math.ceil(total / 25),
  });
}
