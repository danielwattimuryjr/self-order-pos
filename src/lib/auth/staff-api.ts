import { failure } from "@/lib/api-response";
import { getCurrentStaff } from "@/lib/auth/current-staff";

export async function requireStaffApi() {
  const staff = await getCurrentStaff();
  if (!staff)
    return {
      response: failure("UNAUTHENTICATED", "Login diperlukan.", 401),
    } as const;
  if (staff.role !== "STAFF")
    return {
      response: failure("FORBIDDEN", "Akses Staff diperlukan.", 403),
    } as const;
  return { staff } as const;
}
