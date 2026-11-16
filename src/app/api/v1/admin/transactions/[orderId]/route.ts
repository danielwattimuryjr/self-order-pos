import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { readTransaction } from "@/lib/transactions/read";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { orderId } = await context.params;
  if (!z.uuid().safeParse(orderId).success) return failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
  const result = await readTransaction(await createClient(), orderId);
  return result ? success(result) : failure("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404);
}
