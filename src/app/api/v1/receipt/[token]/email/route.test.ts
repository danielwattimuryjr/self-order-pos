import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptData } from "@/lib/receipts/receipt-data";

const mocks = vi.hoisted(() => ({
  loadAuthorizedReceipt: vi.fn(),
  sendReceiptEmail: vi.fn(),
}));

vi.mock("@/lib/receipts/receipt-data", () => ({
  loadAuthorizedReceipt: mocks.loadAuthorizedReceipt,
}));
vi.mock("@/lib/receipts/email", () => ({
  sendReceiptEmail: mocks.sendReceiptEmail,
}));

import { POST } from "./route";

const token = "a".repeat(43);
const receipt = (email: string | null) =>
  ({
    id: "6f313828-c428-45e9-a05c-99e22f866b02",
    receipt_email: email,
  }) as ReceiptData;

describe("manual receipt email retry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not offer or send an email when checkout omitted the address", async () => {
    mocks.loadAuthorizedReceipt.mockResolvedValue({
      ok: true,
      data: receipt(null),
    });
    const response = await POST(
      new Request("https://example.test/api/v1/receipt/token/email", {
        method: "POST",
      }),
      { params: Promise.resolve({ token }) },
    );
    expect(response.status).toBe(409);
    expect(mocks.sendReceiptEmail).not.toHaveBeenCalled();
  });

  it("retries only to the email address saved at checkout", async () => {
    mocks.loadAuthorizedReceipt.mockResolvedValue({
      ok: true,
      data: receipt("checkout@example.test"),
    });
    mocks.sendReceiptEmail.mockResolvedValue({ sent: true, reason: null });
    const response = await POST(
      new Request("https://example.test/api/v1/receipt/token/email", {
        method: "POST",
      }),
      { params: Promise.resolve({ token }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.sendReceiptEmail).toHaveBeenCalledWith(
      receipt("checkout@example.test").id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      false,
    );
  });
});
