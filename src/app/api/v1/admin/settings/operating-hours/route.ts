import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { operatingHoursSchema } from "@/lib/validation/restaurant-settings";
import { getRestaurantOperatingStatus } from "@/lib/time/restaurant-hours";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const { data, error } = await supabase.from("restaurant_settings").select("*").eq("singleton", true).single();
  if (error) return failure("SETTINGS_UNAVAILABLE", "Pengaturan restoran tidak tersedia.", 500);
  return success({ ...data, operatingStatus: getRestaurantOperatingStatus(data) });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = operatingHoursSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Jam operasional tidak valid.", 422);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_operating_hours", {
    p_opening_time: parsed.data.openingTime,
    p_closing_time: parsed.data.closingTime,
  });
  if (error) return failure(error.code === "42501" ? "FORBIDDEN" : "SETTINGS_UPDATE_FAILED", "Jam operasional belum dapat disimpan.", error.code === "42501" ? 403 : 500);
  return success(data, "Jam operasional diperbarui.");
}
