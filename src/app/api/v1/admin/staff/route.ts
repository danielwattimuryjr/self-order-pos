import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { staffInviteSchema } from "@/lib/validation/phase7";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { data, error } = await createServiceClient()
    .from("staff_profiles")
    .select("id, name, email, role, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error || !data)
    return failure("STAFF_UNAVAILABLE", "Daftar akun belum dapat dimuat.", 503);
  return success({ staff: data });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = staffInviteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return failure("VALIDATION_ERROR", "Data undangan Staff tidak valid.", 422);

  const service = createServiceClient();
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const { data: invited, error: inviteError } =
    await service.auth.admin.inviteUserByEmail(
      parsed.data.email.trim().toLowerCase(),
      {
        data: { name: parsed.data.name.trim(), role: parsed.data.role },
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      },
    );
  if (inviteError || !invited.user) {
    return failure(
      "STAFF_INVITE_FAILED",
      "Undangan tidak dapat dikirim. Periksa email atau coba lagi.",
      inviteError?.status === 422 ? 409 : 502,
    );
  }

  const authenticated = await createClient();
  const { data, error } = await authenticated.rpc("admin_save_staff_profile", {
    p_profile_id: null,
    p_auth_user_id: invited.user.id,
    p_email: parsed.data.email.trim().toLowerCase(),
    p_name: parsed.data.name.trim(),
    p_role: parsed.data.role,
    p_is_active: true,
  });
  if (error) {
    await service.auth.admin.deleteUser(invited.user.id);
    if (error.code === "23505")
      return failure(
        "STAFF_ALREADY_EXISTS",
        "Akun dengan email tersebut sudah terdaftar.",
        409,
      );
    if (error.code === "42501")
      return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure(
      "STAFF_PROFILE_FAILED",
      "Profil Staff belum dapat disimpan. Undangan dibatalkan.",
      500,
    );
  }
  return Response.json(
    {
      status: "success",
      message: "Undangan Staff dikirim melalui email.",
      data: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
      },
    },
    { status: 201 },
  );
}
