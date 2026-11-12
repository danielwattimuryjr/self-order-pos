import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";

export function mapConfiguration(variantGroups: Array<Record<string, unknown>>, addonGroups: Array<Record<string, unknown>>): MenuConfiguration {
  return {
    variants: variantGroups.map((group) => ({
      id: String(group.id),
      name: String(group.name),
      required: Boolean(group.required),
      sortOrder: Number(group.sort_order),
      options: ((group.menu_variant_options ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((option) => ({
          id: String(option.id),
          name: String(option.name),
          pricingMode: option.pricing_mode as "ADJUSTMENT" | "OVERRIDE",
          priceValue: Number(option.price_value),
          isActive: Boolean(option.is_active),
          sortOrder: Number(option.sort_order),
        })),
    })),
    addons: addonGroups.map((group) => ({
      id: String(group.id),
      name: String(group.name),
      required: Boolean(group.required),
      minSelect: Number(group.min_select),
      maxSelect: Number(group.max_select),
      sortOrder: Number(group.sort_order),
      options: ((group.menu_addon_options ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((option) => ({
          id: String(option.id),
          name: String(option.name),
          unitPrice: Number(option.unit_price),
          isActive: Boolean(option.is_active),
          sortOrder: Number(option.sort_order),
        })),
    })),
  };
}
