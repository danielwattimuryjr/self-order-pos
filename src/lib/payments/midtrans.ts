import "server-only";
import { getServerEnv } from "@/lib/server-env";
import { verifyMidtransSignature } from "@/lib/payments/signature";

export type MidtransCharge = {
  order_id: string;
  transaction_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  fraud_status?: string;
  expiry_time?: string;
  actions?: Array<{ name: string; method?: string; url: string }>;
};

export class MidtransRequestError extends Error {
  constructor(
    readonly code:
      | "MIDTRANS_NOT_CONFIGURED"
      | "MIDTRANS_NETWORK_ERROR"
      | "MIDTRANS_HTTP_ERROR",
    readonly httpStatus?: number,
    readonly contentType?: string,
    readonly server?: string,
    readonly providerErrorCategory?: string,
    readonly responseBodyKeys?: string[],
    readonly providerErrorDetail?: string,
  ) {
    super(code);
    this.name = "MidtransRequestError";
  }
}

function summarizeProviderError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { category: "EMPTY_OR_NON_JSON", keys: [] as string[] };
  }
  const body = payload as Record<string, unknown>;
  const keys = Object.keys(body).slice(0, 12);
  const candidates = [
    body.status_message,
    body.statusMessage,
    body.message,
    body.error,
    body.error_messages,
    body.detail,
  ]
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        return [nested.message, nested.error, nested.detail].filter(
          (item): item is string => typeof item === "string",
        );
      }
      return [];
    })
    .join(" ")
    .toLowerCase();

  const rawDetail = [
    body.status_message,
    body.statusMessage,
    body.message,
    body.error,
    body.error_messages,
    body.detail,
  ]
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        return [nested.message, nested.error, nested.detail].filter(
          (item): item is string => typeof item === "string",
        );
      }
      return [];
    })
    .join("; ")
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, "[redacted authorization]")
    .replace(/SB-Mid-(?:server|client)-[A-Za-z0-9_-]+/gi, "[redacted key]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted email]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[redacted token]")
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 200);

  let category = "UNCLASSIFIED_RESPONSE";
  if (/rbac.{0,30}access denied/.test(candidates)) category = "ENVOY_RBAC_DENIED";
  else if (/accept|content.?type|representation|format/.test(candidates)) category = "CONTENT_NEGOTIATION_REJECTED";
  else if (/server key|api key|credential|unauthorized|authentication/.test(candidates)) category = "AUTHORIZATION_REJECTED";
  else if (/policy|permission|forbidden|access denied/.test(candidates)) category = "POLICY_OR_ACCESS_DENIED";
  return {
    category,
    keys,
    detail: rawDetail || undefined,
  };
}

function configuration() {
  const env = getServerEnv();
  if (!env.MIDTRANS_SERVER_KEY)
    throw new MidtransRequestError("MIDTRANS_NOT_CONFIGURED");
  return {
    serverKey: env.MIDTRANS_SERVER_KEY,
    baseUrl:
      env.MIDTRANS_IS_PRODUCTION === "true"
        ? "https://api.midtrans.com"
        : "https://api.sandbox.midtrans.com",
  };
}

function midtransOrderTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} +0700`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { serverKey, baseUrl } = configuration();
  const authorization = Buffer.from(`${serverKey}:`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MidtransRequestError("MIDTRANS_NETWORK_ERROR");
  }
  const payload = (await response.json().catch(() => null)) as
    | (T & { error_messages?: string[]; status_message?: string })
    | null;
  if (!response.ok || !payload) {
    const errorSummary = summarizeProviderError(payload);
    throw new MidtransRequestError(
      "MIDTRANS_HTTP_ERROR",
      response.status,
      response.headers.get("content-type")?.split(";")[0],
      response.headers.get("server") ?? undefined,
      errorSummary.category,
      errorSummary.keys,
      errorSummary.detail,
    );
  }
  return payload;
}

export function createQrisCharge(input: {
  providerOrderId: string;
  amount: number;
  itemDetails: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  customerName?: string | null;
  customerEmail?: string | null;
  expiresAt: string;
}) {
  const now = new Date();
  const expiryMinutes = Math.max(
    1,
    Math.min(
      15,
      Math.ceil((new Date(input.expiresAt).getTime() - now.getTime()) / 60_000),
    ),
  );
  return request<MidtransCharge>("/v2/charge", {
    method: "POST",
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: {
        order_id: input.providerOrderId,
        gross_amount: input.amount,
      },
      item_details: input.itemDetails.map((item) => ({
        id: item.id.slice(0, 50),
        price: item.price,
        quantity: item.quantity,
        name: item.name.slice(0, 50),
      })),
      customer_details: {
        first_name: input.customerName ?? undefined,
        email: input.customerEmail ?? undefined,
      },
      custom_expiry: {
        order_time: midtransOrderTime(now),
        expiry_duration: expiryMinutes,
        unit: "minute",
      },
    }),
  });
}

export function getTransactionStatus(providerOrderId: string) {
  return request<MidtransCharge>(
    `/v2/${encodeURIComponent(providerOrderId)}/status`,
  );
}

export function cancelTransaction(providerOrderId: string) {
  return request<MidtransCharge>(
    `/v2/${encodeURIComponent(providerOrderId)}/cancel`,
    { method: "POST", body: "{}" },
  );
}

export function verifyNotificationSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signature: string;
}) {
  const { serverKey } = configuration();
  return verifyMidtransSignature({ ...input, serverKey });
}
