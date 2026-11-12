import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";

export type MenuChoice = {
  variantSelections: Record<string, string>;
  addonSelections: Record<string, Record<string, number>>;
};

export type PriceResult = { valid: true; unitPrice: number } | { valid: false; reason: string };

export function priceForMenuChoice(basePrice: number, configuration: MenuConfiguration, choice: MenuChoice): PriceResult {
  const knownVariantGroups = new Set(configuration.variants.flatMap((group) => group.id ? [group.id] : []));
  const knownAddonGroups = new Set(configuration.addons.flatMap((group) => group.id ? [group.id] : []));
  if (Object.keys(choice.variantSelections).some((groupId) => !knownVariantGroups.has(groupId))) return { valid: false, reason: "Konfigurasi varian menu berubah. Periksa ulang pilihan." };
  if (Object.keys(choice.addonSelections).some((groupId) => !knownAddonGroups.has(groupId))) return { valid: false, reason: "Konfigurasi add-on menu berubah. Periksa ulang pilihan." };
  if (!Number.isSafeInteger(basePrice) || basePrice < 0) return { valid: false, reason: "Harga menu tidak valid." };
  let override: number | null = null;
  let adjustments = 0;
  for (const group of configuration.variants) {
    const selectedId = group.id ? choice.variantSelections[group.id] : undefined;
    if (!selectedId) {
      if (group.required) return { valid: false, reason: `Pilih ${group.name}.` };
      continue;
    }
    const option = group.options.find((candidate) => candidate.id === selectedId && candidate.isActive);
    if (!option) return { valid: false, reason: `Pilihan pada ${group.name} sudah tidak tersedia.` };
    if (option.pricingMode === "OVERRIDE") override = option.priceValue;
    else adjustments += option.priceValue;
  }

  let addonTotal = 0;
  for (const group of configuration.addons) {
    const selected = Object.entries(group.id ? choice.addonSelections[group.id] ?? {} : {});
    const validOptions = group.options.filter((option) => option.isActive);
    if (selected.some(([id, quantity]) => !validOptions.some((option) => option.id === id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)) {
      return { valid: false, reason: `Pilihan pada ${group.name} sudah tidak tersedia.` };
    }
    const count = selected.length;
    if (count < group.minSelect || count > group.maxSelect || (group.required && count === 0)) return { valid: false, reason: `Pilih ${group.minSelect}–${group.maxSelect} opsi pada ${group.name}.` };
    for (const [id, quantity] of selected) {
      const option = validOptions.find((candidate) => candidate.id === id);
      if (option) addonTotal += option.unitPrice * quantity;
    }
  }
  const unitPrice = (override ?? basePrice) + adjustments + addonTotal;
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) return { valid: false, reason: "Harga konfigurasi tidak valid." };
  return { valid: true, unitPrice };
}
