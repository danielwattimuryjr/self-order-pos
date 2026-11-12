import { getCurrentStaff } from "@/lib/auth/current-staff";
import { failure } from "@/lib/api-response";

export async function requireAdminApi() {
  const staff = await getCurrentStaff();
  if (!staff) return { response: failure("UNAUTHENTICATED", "Login diperlukan.", 401) } as const;
  if (staff.role !== "ADMIN") return { response: failure("FORBIDDEN", "Akses Admin diperlukan.", 403) } as const;
  return { staff } as const;
}
