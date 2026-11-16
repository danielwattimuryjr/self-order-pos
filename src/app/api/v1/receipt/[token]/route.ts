import { success } from "@/lib/api-response";
import { loadAuthorizedReceipt } from "@/lib/receipts/receipt-data";
import { createServiceClient } from "@/lib/supabase/service";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const privateResponse = (response: Response) => { for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value); return response; };

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const loaded = await loadAuthorizedReceipt(request, token);
  if (!loaded.ok) return privateResponse(loaded.response);
  const { data: receipt } = loaded;
  const supabase = createServiceClient();
  const [{ data: table }, { data: session }] = await Promise.all([
    supabase.from("dining_tables").select("table_code").eq("id", receipt.table_id).maybeSingle(),
    supabase.from("table_sessions").select("expires_at, closed_at, status").eq("id", receipt.session_id).maybeSingle(),
  ]);
  const sessionActive = Boolean(session && session.status === "ACTIVE" && !session.closed_at && new Date(session.expires_at).getTime() > Date.now());
  const response = success({
    orderNumber: receipt.order_number,
    tableNumber: receipt.table_number_snapshot,
    customerName: receipt.customer_name,
    orderNotes: receipt.order_notes,
    subtotal: receipt.subtotal,
    discountAmount: receipt.discount_amount,
    totalAmount: receipt.total_amount,
    paidAt: receipt.paid_at,
    paymentMethod: receipt.payment_method,
    items: receipt.items.map((item) => ({
      name: item.menu_name_snapshot, quantity: item.quantity, note: item.item_note,
      unitPrice: item.unit_price_snapshot, lineTotal: item.line_total,
      variants: item.variant_snapshot, addons: item.addon_snapshot,
    })),
    emailStatus: receipt.receipt?.email_status ?? (receipt.receipt_email ? "PENDING" : "NOT_REQUESTED"),
    emailRequested: Boolean(receipt.receipt_email),
    emailSentAt: receipt.receipt?.email_sent_at ?? null,
    orderAgainUrl: sessionActive && table?.table_code ? `/order/${table.table_code}` : null,
  }, "Struk pembayaran dimuat.");
  for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
  return response;
}
