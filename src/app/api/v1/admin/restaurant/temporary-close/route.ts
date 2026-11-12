import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { temporaryCloseSchema } from "@/lib/validation/restaurant-settings";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = temporaryCloseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Alasan tutup sementara tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_temporary_close", {
    p_reason: parsed.data.reason,
    p_other: parsed.data.otherReason ?? null,
  });
  if (error) return failure("TEMPORARY_CLOSE_FAILED", "Restoran belum dapat ditutup sementara.", 500);
  return success(data, "Restoran ditutup sementara.");
}
