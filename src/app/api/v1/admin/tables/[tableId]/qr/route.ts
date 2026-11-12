import QRCode from "qrcode";
import { z } from "zod";
import { failure } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ tableId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { tableId } = await context.params;
  if (!z.uuid().safeParse(tableId).success) return failure("VALIDATION_ERROR", "ID meja tidak valid.", 422);
  const supabase = await createClient();
  const { data: table, error } = await supabase.from("dining_tables").select("table_code, table_number")
    .eq("id", tableId).eq("is_active", true).maybeSingle();
  if (error || !table) return failure("TABLE_NOT_FOUND", "Meja aktif tidak ditemukan.", 404);
  const origin = new URL(request.url).origin;
  const url = new URL(`/order/${table.table_code}`, origin).toString();
  const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "H", margin: 2, width: 600 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="meja-${table.table_number}-qr.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
