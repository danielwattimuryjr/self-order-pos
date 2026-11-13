import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { voucherUpdateSchema } from "@/lib/validation/vouchers";

const idSchema = z.uuid();

export async function PATCH(request: Request, context: { params: Promise<{ voucherId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { voucherId } = await context.params;
  if (!idSchema.safeParse(voucherId).success) return failure("VOUCHER_NOT_FOUND", "Voucher tidak ditemukan.", 404);
  const parsed = voucherUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data voucher tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_voucher", { p_voucher_id: voucherId, p_payload: parsed.data });
  if (error) {
    if (error.code === "23505") return failure("VOUCHER_CODE_EXISTS", "Kode voucher sudah digunakan.", 409);
    if (error.code === "P0002") return failure("VOUCHER_NOT_FOUND", "Voucher tidak ditemukan.", 404);
    if (error.code === "42501") return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure("VOUCHER_UPDATE_FAILED", "Voucher belum dapat diperbarui.", 500);
  }
  return success(data, "Voucher diperbarui.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ voucherId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { voucherId } = await context.params;
  if (!idSchema.safeParse(voucherId).success) return failure("VOUCHER_NOT_FOUND", "Voucher tidak ditemukan.", 404);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_voucher", { p_voucher_id: voucherId });
  if (error) {
    if (error.code === "P0002") return failure("VOUCHER_NOT_FOUND", "Voucher tidak ditemukan.", 404);
    if (error.code === "42501") return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure("VOUCHER_DELETE_FAILED", "Voucher belum dapat dihapus.", 500);
  }
  return success({ id: voucherId, result: data }, data === "DEACTIVATED" ? "Voucher memiliki order aktif atau riwayat pemakaian dan dinonaktifkan." : "Voucher dihapus.");
}
