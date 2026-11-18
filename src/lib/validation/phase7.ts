import { z } from "zod";

export const paymentStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

const dateRange = {
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

export const transactionQuerySchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    status: paymentStatusSchema.optional(),
    ...dateRange,
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "Rentang tanggal tidak valid.",
  });

export const auditQuerySchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    ...dateRange,
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "Rentang tanggal tidak valid.",
  });

export const analyticsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    granularity: z.enum(["hour", "day", "week"]).optional(),
  })
  .refine((query) => query.from <= query.to, {
    message: "Rentang tanggal tidak valid.",
  })
  .refine(
    (query) => {
      const from = Date.parse(`${query.from}T00:00:00Z`);
      const to = Date.parse(`${query.to}T00:00:00Z`);
      return (to - from) / 86_400_000 <= 366;
    },
    { message: "Rentang laporan maksimal 367 hari." },
  );

export const adminCancellationSchema = z
  .object({
    reasonCode: z.enum([
      "CUSTOMER_REQUEST",
      "DUPLICATE_ORDER",
      "ITEM_UNAVAILABLE",
      "OPERATIONAL_ISSUE",
      "OTHER",
    ]),
    reasonOther: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.reasonCode === "OTHER" && !value.reasonOther) {
      context.addIssue({
        code: "custom",
        path: ["reasonOther"],
        message: "Isi alasan pembatalan.",
      });
    }
    if (value.reasonCode !== "OTHER" && value.reasonOther) {
      context.addIssue({
        code: "custom",
        path: ["reasonOther"],
        message: "Teks tambahan hanya untuk alasan Lainnya.",
      });
    }
  });

export const staffInviteSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["ADMIN", "STAFF"]),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.enum(["ADMIN", "STAFF"]),
  isActive: z.boolean(),
});
