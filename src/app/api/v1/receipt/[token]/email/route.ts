import { failure } from "@/lib/api-response";
import { sendReceiptEmail } from "@/lib/receipts/email";
import { loadAuthorizedReceipt } from "@/lib/receipts/receipt-data";
import { hashOrderAccessToken } from "@/lib/security/order-access-token";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const privateResponse = (response: Response) => { for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value); return response; };

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const loaded = await loadAuthorizedReceipt(request, token);
  if (!loaded.ok) return privateResponse(loaded.response);
  if (!loaded.data.receipt_email) return privateResponse(failure("RECEIPT_EMAIL_NOT_PROVIDED", "Email struk tidak diberikan saat checkout.", 409));
  const result = await sendReceiptEmail(loaded.data.id, hashOrderAccessToken(token), false);
  if (result.sent || result.reason === "ALREADY_SENT") {
    return Response.json({ status: "success", message: result.sent ? "Struk berhasil dikirim." : "Struk sudah pernah dikirim.", data: { sent: true } }, { headers: privateHeaders });
  }
  if (result.reason === "IN_PROGRESS") return privateResponse(failure("RECEIPT_EMAIL_IN_PROGRESS", "Pengiriman struk sedang diproses.", 409));
  if (result.reason === "NO_EMAIL") return privateResponse(failure("RECEIPT_EMAIL_NOT_PROVIDED", "Email struk tidak diberikan saat checkout.", 409));
  return privateResponse(failure("RECEIPT_EMAIL_FAILED", "Email struk belum berhasil dikirim. Coba lagi beberapa saat.", 502));
}
