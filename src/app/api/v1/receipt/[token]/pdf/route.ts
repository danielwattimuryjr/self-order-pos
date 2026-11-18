import { loadAuthorizedReceipt } from "@/lib/receipts/receipt-data";
import { createReceiptPdf } from "@/lib/receipts/pdf";

const privateResponse = (response: Response) => {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const loaded = await loadAuthorizedReceipt(request, token);
  if (!loaded.ok) return privateResponse(loaded.response);
  const bytes = await createReceiptPdf(loaded.data);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="struk-${loaded.data.order_number}.pdf"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
