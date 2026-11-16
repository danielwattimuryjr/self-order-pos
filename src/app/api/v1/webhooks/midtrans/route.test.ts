import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTransactionStatus: vi.fn(),
  verifyNotificationSignature: vi.fn(),
  publishPaymentStatus: vi.fn(),
  sendReceiptEmail: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/payments/midtrans", () => ({
  getTransactionStatus: mocks.getTransactionStatus,
  verifyNotificationSignature: mocks.verifyNotificationSignature,
}));
vi.mock("@/lib/payments/realtime", () => ({
  publishPaymentStatus: mocks.publishPaymentStatus,
}));
vi.mock("@/lib/receipts/email", () => ({ sendReceiptEmail: mocks.sendReceiptEmail }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { POST } from "./route";

const testNotification = {
  order_id: "payment_notif_test_M543621358_93a044a7-d4a0-4477-9777-3ea5c2b65a0e",
  merchant_id: "M543621358",
  transaction_id: "513f1f01-c9da-474c-9fc9-d5c64364b709",
  transaction_time: "2023-11-15 18:45:13",
  settlement_time: "2023-11-15 22:45:13",
  payment_type: "gopay",
  transaction_status: "settlement",
  status_message: "midtrans payment notification",
  status_code: "200",
  gross_amount: "105000.00",
  currency: "IDR",
  fraud_status: "accept",
  signature_key: "a".repeat(128),
};

describe("Midtrans webhook URL test notification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acknowledges a valid synthetic test without querying or changing payment state", async () => {
    mocks.verifyNotificationSignature.mockReturnValue(true);

    const response = await POST(new Request("https://example.test/api/v1/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testNotification),
    }));

    expect(response.status).toBe(200);
    expect(mocks.verifyNotificationSignature).toHaveBeenCalledWith({
      orderId: testNotification.order_id,
      statusCode: testNotification.status_code,
      grossAmount: testNotification.gross_amount,
      signature: testNotification.signature_key,
    });
    expect(mocks.getTransactionStatus).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.publishPaymentStatus).not.toHaveBeenCalled();
  });

  it("rejects a synthetic test with an invalid signature", async () => {
    mocks.verifyNotificationSignature.mockReturnValue(false);

    const response = await POST(new Request("https://example.test/api/v1/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testNotification),
    }));

    expect(response.status).toBe(401);
    expect(mocks.getTransactionStatus).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("attempts the checkout receipt email after a verified settlement without changing the webhook result on email failure", async () => {
    const orderId = "a4b4f429-febd-4a4a-8a6c-d19f0b9f7196";
    mocks.verifyNotificationSignature.mockReturnValue(true);
    mocks.getTransactionStatus.mockResolvedValue({
      order_id: "provider-order-1", transaction_id: "provider-transaction-1", status_code: "200",
      gross_amount: "15000.00", transaction_status: "settlement", fraud_status: "accept",
    });
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { paymentStatus: "PAID", orderStatus: "PAID" }, error: null }),
      from: vi.fn((table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => table === "payments"
          ? { data: { order_id: orderId } }
          : { data: { access_token_hash: "a".repeat(64) } } }) }),
      })),
    });
    mocks.sendReceiptEmail.mockResolvedValue({ sent: false, reason: "DELIVERY_FAILED" });
    const notification = { ...testNotification, order_id: "provider-order-1", transaction_id: "provider-transaction-1", gross_amount: "15000.00" };
    const response = await POST(new Request("https://example.test/api/v1/webhooks/midtrans", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notification),
    }));
    expect(response.status).toBe(200);
    expect(mocks.sendReceiptEmail).toHaveBeenCalledWith(orderId, null, true);
  });
});
