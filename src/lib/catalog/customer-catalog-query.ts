import { z } from "zod";

export const CUSTOMER_CATALOG_PAGE_SIZE = 12;
export const CUSTOMER_CATALOG_MAX_RETAINED_MENU_IDS = 101;

const customerCatalogQuerySchema = z.object({
  search: z.string().trim().max(200).default(""),
  category: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  retainMenuId: z
    .array(z.uuid())
    .max(CUSTOMER_CATALOG_MAX_RETAINED_MENU_IDS)
    .default([]),
});

export type CustomerCatalogQuery = z.infer<typeof customerCatalogQuerySchema>;

function getSingleValue(
  params: URLSearchParams,
  name: string,
): string | undefined | string[] {
  const values = params.getAll(name);
  if (values.length > 1) return values;
  return values[0];
}

export function parseCustomerCatalogQuery(params: URLSearchParams) {
  return customerCatalogQuerySchema.safeParse({
    search: getSingleValue(params, "search"),
    category: getSingleValue(params, "category"),
    page: getSingleValue(params, "page"),
    retainMenuId: [...new Set(params.getAll("retainMenuId"))],
  });
}

export function buildCatalogIlikePattern(query: string): string {
  const escapedLikeValue = query.trim().replace(/[\\%_]/g, "\\$&");
  const escapedPostgrestValue = escapedLikeValue
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
  return `"%${escapedPostgrestValue}%"`;
}
