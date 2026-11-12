import { describe, expect, it } from "vitest";
import { priceForMenuChoice } from "../catalog/price";
import { menuConfigurationSchema, templateConfigurationSchema } from "./catalog";

const configuration = {
  variants: [{ id: "10000000-0000-4000-8000-000000000001", name: "Ukuran", required: true, sortOrder: 0, options: [
    { id: "10000000-0000-4000-8000-000000000002", name: "Besar", pricingMode: "ADJUSTMENT" as const, priceValue: 3000, isActive: true, sortOrder: 0 },
  ] }],
  addons: [{ id: "10000000-0000-4000-8000-000000000003", name: "Tambahan", required: false, minSelect: 0, maxSelect: 1, sortOrder: 0, options: [
    { id: "10000000-0000-4000-8000-000000000004", name: "Keju", unitPrice: 2000, isActive: true, sortOrder: 0 },
  ] }],
};

describe("catalog configuration validation", () => {
  it("accepts valid menu configuration and rejects empty groups", () => {
    expect(menuConfigurationSchema.safeParse(configuration).success).toBe(true);
    expect(menuConfigurationSchema.safeParse({ variants: [{ name: "Size", required: false, options: [] }], addons: [] }).success).toBe(false);
  });

  it("allows no more than one variant group containing override prices", () => {
    const twoOverrides = { variants: [
      { name: "Ukuran", required: false, options: [{ name: "Besar", pricingMode: "OVERRIDE", priceValue: 10000 }] },
      { name: "Paket", required: false, options: [{ name: "Komplit", pricingMode: "OVERRIDE", priceValue: 12000 }] },
    ], addons: [] };
    expect(menuConfigurationSchema.safeParse(twoOverrides).success).toBe(false);
  });

  it("requires at least one group for a template", () => {
    expect(templateConfigurationSchema.safeParse({ variants: [], addons: [] }).success).toBe(false);
    expect(templateConfigurationSchema.safeParse(configuration).success).toBe(true);
  });
});

describe("customer catalog prices", () => {
  it("adds adjustments and add-on quantity before multiplying menu quantity", () => {
    const result = priceForMenuChoice(10000, configuration, {
      variantSelections: { [configuration.variants[0].id]: configuration.variants[0].options[0].id },
      addonSelections: { [configuration.addons[0].id]: { [configuration.addons[0].options[0].id]: 2 } },
    });
    expect(result).toEqual({ valid: true, unitPrice: 17000 });
  });

  it("uses override as the base price and adds other adjustment groups", () => {
    const withOverride = {
      variants: [
        { id: "20000000-0000-4000-8000-000000000001", name: "Size", required: true, sortOrder: 0, options: [{ id: "20000000-0000-4000-8000-000000000002", name: "Large", pricingMode: "OVERRIDE" as const, priceValue: 15000, isActive: true, sortOrder: 0 }] },
        { id: "20000000-0000-4000-8000-000000000003", name: "Extra", required: true, sortOrder: 1, options: [{ id: "20000000-0000-4000-8000-000000000004", name: "Special", pricingMode: "ADJUSTMENT" as const, priceValue: 1000, isActive: true, sortOrder: 0 }] },
      ], addons: [],
    };
    const result = priceForMenuChoice(10000, withOverride, { variantSelections: {
      [withOverride.variants[0].id]: withOverride.variants[0].options[0].id,
      [withOverride.variants[1].id]: withOverride.variants[1].options[0].id,
    }, addonSelections: {} });
    expect(result).toEqual({ valid: true, unitPrice: 16000 });
  });

  it("rejects missing required selections and options no longer active", () => {
    expect(priceForMenuChoice(10000, configuration, { variantSelections: {}, addonSelections: {} })).toMatchObject({ valid: false });
    const choice = { variantSelections: { [configuration.variants[0].id]: configuration.variants[0].options[0].id }, addonSelections: {} };
    const inactive = { ...configuration, variants: [{ ...configuration.variants[0], options: [{ ...configuration.variants[0].options[0], isActive: false }] }] };
    expect(priceForMenuChoice(10000, inactive, choice)).toMatchObject({ valid: false });
  });
});
