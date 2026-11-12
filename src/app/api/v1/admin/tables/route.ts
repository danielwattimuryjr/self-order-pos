import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { createTableSchema } from "@/lib/validation/restaurant-settings";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const { data, error } = await supabase.from("dining_tables").select("id, table_code, table_number, is_active, created_at, updated_at").order("table_number");
  if (error) return failure("TABLES_UNAVAILABLE", "Daftar meja tidak tersedia.", 500);
  return success(data);
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = createTableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Nomor meja tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_table", { p_table_number: parsed.data.tableNumber });
  if (error) return failure(error.code === "23505" ? "TABLE_NUMBER_IN_USE" : "TABLE_CREATE_FAILED", "Meja belum dapat dibuat. Pastikan nomor belum pernah digunakan.", error.code === "23505" ? 409 : 500);
  return success(data, "Meja ditambahkan.");
}
