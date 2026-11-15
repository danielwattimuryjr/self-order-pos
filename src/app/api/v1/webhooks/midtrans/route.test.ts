import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTransactionStatus: vi.fn(),
  verifyNotificationSignature: vi.fn(),
  publishPaymentStatus: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/payments/midtrans", () => ({
  getTransactionStatus: mocks.getTransactionStatus,
  verifyNotificationSignature: mocks.verifyNotificationSignature,
}));
vi.mock("@/lib/payments/realtime", () => ({
  publishPaymentStatus: mocks.publishPaymentStatus,
}));
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
});
