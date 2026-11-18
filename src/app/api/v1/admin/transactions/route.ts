import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { readTransactionPage } from "@/lib/transactions/read";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const result = await readTransactionPage(await createClient(), request.url);
  if (result.error === "VALIDATION_ERROR")
    return failure(result.error, "Filter transaksi tidak valid.", 422);
  if (result.error)
    return failure(result.error, "Daftar transaksi belum dapat dimuat.", 503);
  return success(result.data);
}
