import { z } from "zod";

export const voucherCreateSchema = z.object({
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  minTransaction: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  maxDiscount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  quota: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  startsTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endsTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean().default(true),
  categoryIds: z.array(z.uuid()).max(100).default([]),
}).refine((value) => value.startsOn <= value.endsOn, { path: ["endsOn"], message: "Tanggal akhir harus sama atau setelah tanggal mulai." })
  .refine((value) => value.startsTime !== value.endsTime, { path: ["endsTime"], message: "Jam mulai dan akhir tidak boleh sama." })
  .refine((value) => value.discountType !== "PERCENT" || value.discountValue <= 100, { path: ["discountValue"], message: "Diskon persentase maksimal 100%." })
  .refine((value) => new Set(value.categoryIds).size === value.categoryIds.length, { path: ["categoryIds"], message: "Kategori voucher tidak boleh duplikat." });

export const voucherUpdateSchema = voucherCreateSchema;

export const voucherCartLineSchema = z.object({
  menuId: z.uuid(),
  quantity: z.number().int().min(1).max(99),
  note: z.string().max(500).default(""),
  variantSelections: z.record(z.uuid(), z.uuid()).default({}),
  addonSelections: z.record(z.uuid(), z.record(z.uuid(), z.number().int().min(1).max(99))).default({}),
});

export const voucherValidationRequestSchema = z.object({
  tableCode: z.uuid(),
  sessionId: z.uuid(),
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  items: z.array(voucherCartLineSchema).min(1).max(100),
});

export const createOrderRequestSchema = z.object({
  tableCode: z.uuid(),
  idempotencyKey: z.uuid(),
  accessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  customerName: z.string().trim().max(120).optional().default(""),
  receiptEmail: z.email().max(254).optional().nullable(),
  orderNotes: z.string().trim().max(1000).optional().default(""),
  voucherCode: z.string().trim().max(40).transform((value) => value ? value.toUpperCase() : null).optional().nullable(),
  items: z.array(voucherCartLineSchema).min(1).max(100),
});

export type VoucherCartLine = z.infer<typeof voucherCartLineSchema>;
