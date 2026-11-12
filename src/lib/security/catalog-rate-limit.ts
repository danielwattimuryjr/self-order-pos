import "server-only";
import { createHash } from "node:crypto";
import { failure } from "@/lib/api-response";
import { createServiceClient } from "@/lib/supabase/service";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkCatalogRateLimit(request: Request, tableCode: string): Promise<Response | null> {
  const clientIp = (request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    ?? "local-development").trim().slice(0, 128) || "local-development";
  const keys = [hash(`qr-catalog-ip:${clientIp}`), hash(`qr-catalog-table:${tableCode}`)];
  try {
    const supabase = createServiceClient();
    for (const key of keys) {
      const { data, error } = await supabase.rpc("consume_api_rate_limit", { p_key_hash: key, p_limit: 60, p_window_seconds: 60 });
      if (error || !data?.[0]) return failure("RATE_LIMIT_UNAVAILABLE", "Katalog belum dapat dimuat. Coba beberapa saat lagi.", 503);
      if (!data[0].allowed) {
        return Response.json({ status: "error", message: "Terlalu banyak permintaan. Coba beberapa saat lagi.", error: { code: "RATE_LIMITED" } }, {
          status: 429,
          headers: { "Retry-After": String(data[0].retry_after_seconds) },
        });
      }
    }
  } catch {
    return failure("RATE_LIMIT_UNAVAILABLE", "Katalog belum dapat dimuat. Coba beberapa saat lagi.", 503);
  }
  return null;
}
