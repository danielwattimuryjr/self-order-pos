import { describe, expect, it } from "vitest";
import {
  buildCatalogIlikePattern,
  CUSTOMER_CATALOG_MAX_RETAINED_MENU_IDS,
  CUSTOMER_CATALOG_PAGE_SIZE,
  parseCustomerCatalogQuery,
} from "./customer-catalog-query";

const categoryId = "8d2e815e-65a5-41ce-a9b2-0fd4ae5f6879";

describe("customer catalog query validation", () => {
  it("defaults to the first page with no search or category", () => {
    expect(parseCustomerCatalogQuery(new URLSearchParams()).data).toEqual({
      search: "",
      page: 1,
      retainMenuId: [],
    });
    expect(CUSTOMER_CATALOG_PAGE_SIZE).toBe(12);
  });

  it("trims search whitespace and accepts category and page parameters", () => {
    const parsed = parseCustomerCatalogQuery(new URLSearchParams(`search=%20%20Nasi%20%20&category=${categoryId}&page=3`));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ search: "Nasi", category: categoryId, page: 3, retainMenuId: [] });
  });

  it("rejects malformed filters, repeated scalar parameters, and excessive retained IDs", () => {
    expect(parseCustomerCatalogQuery(new URLSearchParams("category=not-a-uuid")).success).toBe(false);
    expect(parseCustomerCatalogQuery(new URLSearchParams("page=1&page=2")).success).toBe(false);
    const ids = Array.from({ length: CUSTOMER_CATALOG_MAX_RETAINED_MENU_IDS + 1 }, (_, index) =>
      `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );
    const params = new URLSearchParams();
    ids.forEach((id) => params.append("retainMenuId", id));
    expect(parseCustomerCatalogQuery(params).success).toBe(false);
  });

  it("builds a quoted, literal ILIKE pattern for PostgREST search syntax", () => {
    const pattern = buildCatalogIlikePattern(`  nasi, (ayam) "%_\\  `);
    expect(pattern).toMatch(/^".*"$/);
    expect(pattern).toContain("nasi, (ayam)");
    expect(pattern).toContain("\\%");
    expect(pattern).toContain("\\_");
    expect(pattern).toContain("\\\\");
  });
});
