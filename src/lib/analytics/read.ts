import { failure, success } from "@/lib/api-response";
import { analyticsQuerySchema } from "@/lib/validation/phase7";
import { createClient } from "@/lib/supabase/server";

type AnalyticsResource =
  "summary" | "sales_chart" | "top_menus" | "payment_methods";

export async function readAnalytics(
  request: Request,
  resource: AnalyticsResource,
) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = analyticsQuerySchema.safeParse(query);
  if (!parsed.success)
    return failure("VALIDATION_ERROR", "Rentang laporan tidak valid.", 422);
  const supabase = await createClient();
  const args: Record<string, string> = {
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  };
  let rpcName: string;
  if (resource === "summary") rpcName = "admin_analytics_summary";
  else if (resource === "top_menus") rpcName = "admin_analytics_top_menus";
  else if (resource === "payment_methods")
    rpcName = "admin_analytics_payment_methods";
  else {
    rpcName = "admin_analytics_sales_chart";
    const granularity = parsed.data.granularity ?? "day";
    args.p_granularity = granularity;
  }
  const { data, error } = await supabase.rpc(rpcName, args);
  if (error) {
    if (error.code === "42501")
      return failure("FORBIDDEN", "Akses Admin diperlukan.", 403);
    return failure(
      "ANALYTICS_UNAVAILABLE",
      "Data laporan belum dapat dimuat.",
      503,
    );
  }
  const key =
    resource === "sales_chart"
      ? "points"
      : resource === "top_menus"
        ? "menus"
        : resource === "payment_methods"
          ? "methods"
          : "summary";
  return success({ [key]: data });
}
