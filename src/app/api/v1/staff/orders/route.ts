import { failure, success } from "@/lib/api-response";
import { requireStaffApi } from "@/lib/auth/staff-api";
import { readTransactionPage } from "@/lib/transactions/read";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const result = await readTransactionPage(createServiceClient(), request.url);
  if (result.error === "VALIDATION_ERROR") return failure(result.error, "Filter transaksi tidak valid.", 422);
  if (result.error) return failure(result.error, "Daftar transaksi belum dapat dimuat.", 503);
  return success(result.data);
}
