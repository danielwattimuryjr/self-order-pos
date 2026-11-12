import { z } from "zod";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Format waktu harus HH:mm.");

export const operatingHoursSchema = z.object({
  openingTime: time,
  closingTime: time,
}).refine((value) => value.openingTime !== value.closingTime, {
  message: "Jam buka dan tutup tidak boleh sama.",
});

export const temporaryCloseSchema = z.object({
  reason: z.enum(["STOCK_OUT", "OPERATIONAL_ISSUE", "EMERGENCY", "OTHER"]),
  otherReason: z.string().trim().max(500).optional(),
}).refine((value) => value.reason !== "OTHER" || Boolean(value.otherReason), {
  path: ["otherReason"], message: "Alasan lainnya wajib diisi.",
});

export const createTableSchema = z.object({ tableNumber: z.number().int().positive() });
export const updateTableSchema = z.object({ tableNumber: z.number().int().positive() });
export const tableMutationSchema = z.object({
  tableNumber: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => value.tableNumber !== undefined || value.isActive !== undefined);
