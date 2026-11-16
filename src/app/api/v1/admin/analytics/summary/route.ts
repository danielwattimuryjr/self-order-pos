import { requireAdminApi } from "@/lib/auth/admin-api";
import { readAnalytics } from "@/lib/analytics/read";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  return readAnalytics(request, "summary");
}
