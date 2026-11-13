import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export async function publishPaymentStatus(orderId: string, accessTokenHash: string) {
  const supabase = createServiceClient();
  const channel = supabase.channel(`customer-payment:${orderId}:${accessTokenHash}`);
  try {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    await channel.send({ type: "broadcast", event: "payment_status_changed", payload: { orderId } });
  } catch {
    // Realtime is an update hint; the customer status endpoint remains authoritative.
  } finally {
    try { await supabase.removeChannel(channel); } catch { /* Do not alter payment outcomes for notification cleanup. */ }
  }
}
