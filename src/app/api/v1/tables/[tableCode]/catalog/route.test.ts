import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkCatalogRateLimit: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/security/catalog-rate-limit", () => ({
  checkCatalogRateLimit: mocks.checkCatalogRateLimit,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET } from "./route";

const tableCode = "f77a6e4d-a7e5-45a4-8a55-4486ddad2f11";
const categoryId = "8d2e815e-65a5-41ce-a9b2-0fd4ae5f6879";
const pageMenuId = "46370f6c-7371-45cb-91dd-d7925fe16e14";
const retainedMenuId = "fa62f132-af2b-4daf-861e-e82e4d32c9cb";

function queryBuilder(data: unknown, count: number | null = null) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "or", "in", "range"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }));
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, count, error: null }).then(resolve, reject);
  return { builder, calls };
}

type TestMenu = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_path: string | null;
  sort_order: number;
};

function setupCatalogClient({
  menuRows = [],
  retainedRows = [],
  count = 0,
}: { menuRows?: TestMenu[]; retainedRows?: TestMenu[]; count?: number } = {}) {
  const categoriesQuery = queryBuilder([
    { id: categoryId, name: "Main Course", sort_order: 1 },
  ]);
  const pagedMenusQuery = queryBuilder(menuRows, count);
  const retainedMenusQuery = queryBuilder(retainedRows);
  const variantsQuery = queryBuilder([]);
  const addonsQuery = queryBuilder([]);
  const settingsQuery = queryBuilder({
    opening_time: "09:00:00",
    closing_time: "22:00:00",
    temporary_closed: false,
    temporary_close_reason: null,
    temporary_close_other: null,
    temporary_closed_at: null,
  });
  let menuQueryCount = 0;
  const client = {
    from: vi.fn((table: string) => {
      if (table === "categories") return categoriesQuery.builder;
      if (table === "menus") {
        const firstMenuQuery = menuQueryCount++ === 0;
        return retainedRows.length && firstMenuQuery
          ? retainedMenusQuery.builder
          : pagedMenusQuery.builder;
      }
      if (table === "menu_variant_groups") return variantsQuery.builder;
      if (table === "menu_addon_groups") return addonsQuery.builder;
      if (table === "restaurant_public_status") return settingsQuery.builder;
      if (table === "menu-images")
        return {
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://images.example/${path}` },
          }),
        };
      throw new Error(`Unexpected table ${table}`);
    }),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://${bucket}.example/${path}` },
        }),
      }),
    },
  };
  mocks.createClient.mockResolvedValue(client);
  mocks.createServiceClient.mockReturnValue({
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          table_id: "table-1",
          table_number: 4,
          session_id: "session-1",
          session_expires_at: "2026-11-15T17:00:00.000Z",
        },
      ],
      error: null,
    }),
  });
  return {
    client,
    categoriesQuery,
    pagedMenusQuery,
    retainedMenusQuery,
    variantsQuery,
    addonsQuery,
  };
}

describe("customer catalog search and pagination API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCatalogRateLimit.mockResolvedValue(null);
  });

  it("applies search, category, active visibility, and page range in Supabase while preserving cart menu data separately", async () => {
    const pageMenu = {
      id: pageMenuId,
      category_id: categoryId,
      name: "Chicken Rice",
      description: "Roast chicken",
      price: 25000,
      image_path: null,
      sort_order: 2,
    };
    const retainedMenu = {
      id: retainedMenuId,
      category_id: categoryId,
      name: "Iced Tea",
      description: "Tea",
      price: 8000,
      image_path: null,
      sort_order: 3,
    };
    const queries = setupCatalogClient({
      menuRows: [pageMenu],
      retainedRows: [retainedMenu],
      count: 14,
    });
    const response = await GET(
      new Request(
        `https://example.test/api/v1/tables/${tableCode}/catalog?search=CHICKEN&category=${categoryId}&page=2&retainMenuId=${retainedMenuId}`,
      ),
      {
        params: Promise.resolve({ tableCode }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.data.categories[0].menus.map((menu: { id: string }) => menu.id),
    ).toEqual([pageMenuId]);
    expect(
      body.data.retainedMenus.map((menu: { id: string }) => menu.id),
    ).toEqual([retainedMenuId]);
    expect(body.data.pagination).toEqual({
      page: 2,
      pageSize: 12,
      totalItems: 14,
      totalPages: 2,
    });
    expect(queries.pagedMenusQuery.calls).toContainEqual({
      method: "eq",
      args: ["is_active", true],
    });
    expect(queries.pagedMenusQuery.calls).toContainEqual({
      method: "eq",
      args: ["categories.is_active", true],
    });
    expect(queries.pagedMenusQuery.calls).toContainEqual({
      method: "eq",
      args: ["category_id", categoryId],
    });
    expect(queries.pagedMenusQuery.calls).toContainEqual({
      method: "or",
      args: ['name.ilike."%CHICKEN%",description.ilike."%CHICKEN%"'],
    });
    expect(queries.pagedMenusQuery.calls).toContainEqual({
      method: "range",
      args: [12, 23],
    });
    expect(queries.retainedMenusQuery.calls).toContainEqual({
      method: "in",
      args: ["id", [retainedMenuId]],
    });
  });

  it("rejects malformed query parameters before creating privileged session access", async () => {
    const response = await GET(
      new Request(
        `https://example.test/api/v1/tables/${tableCode}/catalog?page=0`,
      ),
      {
        params: Promise.resolve({ tableCode }),
      },
    );
    expect(response.status).toBe(422);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns only active catalog data through the anonymous database client", async () => {
    const menu = {
      id: pageMenuId,
      category_id: categoryId,
      name: "Soup",
      description: "Chicken soup",
      price: 18000,
      image_path: null,
      sort_order: 1,
    };
    const queries = setupCatalogClient({ menuRows: [menu], count: 1 });
    const response = await GET(
      new Request(`https://example.test/api/v1/tables/${tableCode}/catalog`),
      {
        params: Promise.resolve({ tableCode }),
      },
    );
    expect(response.status).toBe(200);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(queries.pagedMenusQuery.calls).toContainEqual({
      method: "eq",
      args: ["is_active", true],
    });
  });
});
