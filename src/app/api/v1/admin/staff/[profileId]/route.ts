import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { staffUpdateSchema } from "@/lib/validation/phase7";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { profileId } = await context.params;
  if (!z.uuid().safeParse(profileId).success)
    return failure("STAFF_NOT_FOUND", "Akun Staff tidak ditemukan.", 404);
  const parsed = staffUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return failure(
      "VALIDATION_ERROR",
      "Perubahan akun Staff tidak valid.",
      422,
    );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_staff_profile", {
    p_profile_id: profileId,
    p_auth_user_id: null,
    p_email: null,
    p_name: parsed.data.name,
    p_role: parsed.data.role,
    p_is_active: parsed.data.isActive,
  });
  if (error) {
    if (error.message === "STAFF_NOT_FOUND")
      return failure("STAFF_NOT_FOUND", "Akun Staff tidak ditemukan.", 404);
    if (error.message === "CANNOT_CHANGE_SELF_ACCESS")
      return failure(
        "CANNOT_CHANGE_SELF_ACCESS",
        "Anda tidak dapat mengubah role atau menonaktifkan akun sendiri.",
        409,
      );
    if (error.message === "LAST_ACTIVE_ADMIN")
      return failure(
        "LAST_ACTIVE_ADMIN",
        "Sistem harus memiliki minimal satu Admin aktif.",
        409,
      );
    if (error.code === "42501")
      return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure(
      "STAFF_UPDATE_FAILED",
      "Perubahan akun Staff belum dapat disimpan.",
      500,
    );
  }
  return success(
    {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      is_active: data.is_active,
    },
    "Akun Staff diperbarui.",
  );
}
