export type MenuConfiguration = {
  variants: Array<{
    id?: string;
    name: string;
    required: boolean;
    sortOrder: number;
    options: Array<{
      id?: string;
      name: string;
      pricingMode: "ADJUSTMENT" | "OVERRIDE";
      priceValue: number;
      isActive: boolean;
      sortOrder: number;
    }>;
  }>;
  addons: Array<{
    id?: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    sortOrder: number;
    options: Array<{
      id?: string;
      name: string;
      unitPrice: number;
      isActive: boolean;
      sortOrder: number;
    }>;
  }>;
};

function variantTemplate(name: string, options: string[]): MenuConfiguration {
  return {
    variants: [{
      name,
      required: false,
      sortOrder: 0,
      options: options.map((option, sortOrder) => ({
        name: option,
        pricingMode: "ADJUSTMENT",
        priceValue: 0,
        isActive: true,
        sortOrder,
      })),
    }],
    addons: [],
  };
}

export const builtInTemplates = [
  { id: "builtin-spice-level", name: "Level pedas", configuration: variantTemplate("Level pedas", ["Tidak pedas", "Sedang", "Pedas"]) },
  { id: "builtin-sugar-level", name: "Tingkat gula", configuration: variantTemplate("Tingkat gula", ["Normal", "Kurang manis", "Tanpa gula"]) },
  { id: "builtin-ice-level", name: "Es batu", configuration: variantTemplate("Es batu", ["Normal", "Sedikit", "Tanpa es"]) },
] as const;
