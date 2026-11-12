import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reopen_restaurant");
  if (error) return failure("REOPEN_FAILED", "Restoran belum dapat dibuka kembali.", 500);
  return success(data, "Status tutup sementara dibatalkan.");
}
