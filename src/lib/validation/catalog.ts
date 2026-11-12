import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional(),
});

const variantOptionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  pricingMode: z.enum(["ADJUSTMENT", "OVERRIDE"]),
  priceValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const variantGroupSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  required: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(variantOptionSchema).min(1),
});

const addonOptionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  unitPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const addonGroupSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(0),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(addonOptionSchema).min(1),
}).refine((group) => group.minSelect <= group.maxSelect && group.maxSelect <= group.options.length, {
  message: "Batas pilihan add-on tidak valid.",
}).refine((group) => !group.required || group.minSelect >= 1, {
  message: "Grup add-on wajib harus meminta minimal satu pilihan.",
});

export const menuConfigurationSchema = z.object({
  variants: z.array(variantGroupSchema).default([]),
  addons: z.array(addonGroupSchema).default([]),
}).refine((configuration) => configuration.variants.filter((group) => group.options.some((option) => option.pricingMode === "OVERRIDE")).length <= 1, {
  message: "Hanya satu grup varian boleh menggunakan harga override.",
});

export const menuSchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  imagePath: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  configuration: menuConfigurationSchema.default({ variants: [], addons: [] }),
});

export const templateConfigurationSchema = menuConfigurationSchema.refine(
  (configuration) => configuration.variants.length + configuration.addons.length > 0,
  { message: "Template harus berisi minimal satu grup." },
);

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.uuid().nullable().optional(),
  configuration: templateConfigurationSchema,
});

export const templateUpdateSchema = templateCreateSchema.extend({
  version: z.number().int().positive(),
});

export const templateCategorySchema = z.object({ name: z.string().trim().min(1).max(100) });

export const templateApplySchema = z.object({
  mode: z.enum(["REPLACE_ALL", "REPLACE_BY_TYPE"]),
  configuration: templateConfigurationSchema,
  hasExistingConfiguration: z.boolean(),
  confirmed: z.boolean(),
}).refine((value) => !value.hasExistingConfiguration || value.confirmed, {
  message: "Konfirmasi penggantian konfigurasi diperlukan.",
});

