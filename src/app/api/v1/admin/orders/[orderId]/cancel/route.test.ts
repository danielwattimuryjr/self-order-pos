import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  getTransactionStatus: vi.fn(),
  cancelTransaction: vi.fn(),
  publishPaymentStatus: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  authenticatedRpc: vi.fn(),
  serviceRpc: vi.fn(),
  order: { id: "a4b4f429-febd-4a4a-8a6c-d19f0b9f7196", order_number: "ORD-151126001", order_status: "PENDING_PAYMENT", payment_status: "PENDING", access_token_hash: "a".repeat(64) },
  attempt: null as { provider_order_id: string } | null,
}));

vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApi: mocks.requireAdminApi }));
vi.mock("@/lib/payments/midtrans", () => ({
  cancelTransaction: mocks.cancelTransaction,
  getTransactionStatus: mocks.getTransactionStatus,
  MidtransRequestError: class MidtransRequestError extends Error { httpStatus?: number },
}));
vi.mock("@/lib/payments/realtime", () => ({ publishPaymentStatus: mocks.publishPaymentStatus }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));

import { POST } from "./route";

function makeServiceClient() {
  return {
    rpc: mocks.serviceRpc,
    from(table: string) {
      return {
        select: () => ({
        eq: () => table === "orders"
            ? { maybeSingle: async () => ({ data: mocks.order, error: null }) }
            : { eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: mocks.attempt, error: null }) }) }) }) },
        }),
      };
    },
  };
}

describe("Admin unpaid order cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order = { id: "a4b4f429-febd-4a4a-8a6c-d19f0b9f7196", order_number: "ORD-151126001", order_status: "PENDING_PAYMENT", payment_status: "PENDING", access_token_hash: "a".repeat(64) };
    mocks.attempt = null;
    mocks.requireAdminApi.mockResolvedValue({ staff: { id: "admin-1", role: "ADMIN" } });
    mocks.serviceRpc.mockResolvedValue({ data: {}, error: null });
    mocks.authenticatedRpc.mockResolvedValue({ data: { orderId: mocks.order.id, orderStatus: "CANCELLED", paymentStatus: "CANCELLED" }, error: null });
    mocks.createServiceClient.mockReturnValue(makeServiceClient());
    mocks.createClient.mockResolvedValue({ rpc: mocks.authenticatedRpc });
    mocks.publishPaymentStatus.mockResolvedValue(undefined);
  });

  it("requires an explanation for the OTHER reason", async () => {
    const response = await POST(new Request("https://local.test", { method: "POST", body: JSON.stringify({ reasonCode: "OTHER" }) }), { params: Promise.resolve({ orderId: mocks.order.id }) });
    expect(response?.status).toBe(422);
    expect(mocks.authenticatedRpc).not.toHaveBeenCalled();
  });

  it("cancels unpaid orders through the atomic reason-and-audit RPC", async () => {
    const response = await POST(new Request("https://local.test", { method: "POST", body: JSON.stringify({ reasonCode: "DUPLICATE_ORDER" }) }), { params: Promise.resolve({ orderId: mocks.order.id }) });
    expect(response?.status).toBe(200);
    expect(mocks.authenticatedRpc).toHaveBeenCalledWith("admin_cancel_unpaid_order", {
      p_order_id: mocks.order.id,
      p_reason_code: "DUPLICATE_ORDER",
      p_reason_other: null,
    });
  });

  it("reconciles a settlement and refuses cancellation", async () => {
    mocks.attempt = { provider_order_id: "provider-order-1" };
    mocks.getTransactionStatus.mockResolvedValue({
      order_id: "provider-order-1", transaction_id: "provider-transaction-1",
      transaction_status: "settlement", status_code: "200", gross_amount: "16000.00",
    });
    const response = await POST(new Request("https://local.test", { method: "POST", body: JSON.stringify({ reasonCode: "OTHER", reasonOther: "sudah dibayar" }) }), { params: Promise.resolve({ orderId: mocks.order.id }) });
    expect(response?.status).toBe(409);
    expect(mocks.serviceRpc).toHaveBeenCalledWith("process_midtrans_payment_event", expect.objectContaining({
      p_provider_status: "settlement", p_provider_order_id: "provider-order-1",
    }));
    expect(mocks.authenticatedRpc).not.toHaveBeenCalled();
  });
});
