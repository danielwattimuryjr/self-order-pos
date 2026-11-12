import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { tableMutationSchema } from "@/lib/validation/restaurant-settings";

const idSchema = z.uuid();

export async function PATCH(request: Request, context: { params: Promise<{ tableId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { tableId } = await context.params;
  if (!idSchema.safeParse(tableId).success) return failure("VALIDATION_ERROR", "ID meja tidak valid.", 422);
  const parsed = tableMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Perubahan meja tidak valid.", 422);
  const supabase = await createClient();
  const operation = parsed.data.tableNumber !== undefined
    ? supabase.rpc("admin_update_table", { p_table_id: tableId, p_table_number: parsed.data.tableNumber })
    : supabase.rpc("admin_set_table_active", { p_table_id: tableId, p_is_active: parsed.data.isActive });
  const { data, error } = await operation;
  if (error) return failure(error.code === "23505" ? "TABLE_NUMBER_IN_USE" : "TABLE_UPDATE_FAILED", "Meja belum dapat diperbarui.", error.code === "23505" ? 409 : 500);
  return success(data, "Nomor meja diperbarui.");
}

export async function DELETE(_request: Request, context: { params: Promise<{ tableId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { tableId } = await context.params;
  if (!idSchema.safeParse(tableId).success) return failure("VALIDATION_ERROR", "ID meja tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_table_active", { p_table_id: tableId, p_is_active: false });
  if (error) return failure("TABLE_DEACTIVATE_FAILED", "Meja belum dapat dinonaktifkan.", 500);
  return success(data, "Meja dinonaktifkan.");
}
