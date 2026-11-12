import QRCode from "qrcode";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { failure } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const { data: tables, error } = await supabase.from("dining_tables")
    .select("table_code, table_number").eq("is_active", true).order("table_number");
  if (error) return failure("TABLES_UNAVAILABLE", "Daftar meja tidak tersedia.", 500);
  if (!tables?.length) return failure("NO_ACTIVE_TABLES", "Belum ada meja aktif untuk dibuatkan QR.", 404);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const cells = [{ x: 45, y: 430 }, { x: 315, y: 430 }, { x: 45, y: 90 }, { x: 315, y: 90 }];

  for (let i = 0; i < tables.length; i++) {
    const cellIndex = i % cells.length;
    const page = cellIndex === 0 ? pdf.addPage([pageWidth, pageHeight]) : pdf.getPages().at(-1)!;
    const { x, y } = cells[cellIndex];
    const table = tables[i];
    const url = new URL(`/order/${table.table_code}`, new URL(request.url).origin).toString();
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "H", margin: 2, width: 300 });
    const image = await pdf.embedPng(png);
    page.drawText(`Meja ${String(table.table_number).padStart(2, "0")}`, { x, y: y + 285, size: 20, font });
    page.drawImage(image, { x, y, width: 220, height: 220 });
  }

  const bytes = await pdf.save();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="qr-meja.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
