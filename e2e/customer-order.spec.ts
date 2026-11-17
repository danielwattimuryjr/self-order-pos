import { expect, test, type Page } from "@playwright/test";

const tableCode = "46d77d6c-32b0-4dd2-b6e0-020001317344";
const categoryId = "a82e9e6d-6b8c-44ab-a399-2f614ea141b5";
const nasiId = "d6479f59-576b-44ed-bf73-d5138d09b5bd";
const mieId = "f27802fb-c234-41a7-92a9-a24ec7b2b84c";
const sessionId = "c9ec5c5d-3579-405d-9396-40780d3f73ca";
const orderId = "7f4a09f3-a6c2-4f3d-9a72-19a97d8be231";
const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
const qrUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WQAAAAASUVORK5CYII=";

const catalogMenu = (id: string, name: string, price: number) => ({
  id,
  categoryId,
  name,
  description: `${name} test fixture`,
  price,
  imageUrl: null,
  sortOrder: 1,
  configuration: { variants: [], addons: [] },
});

function catalogPayload(search = "") {
  const allMenus = [catalogMenu(nasiId, "Nasi Goreng E2E", 25000), catalogMenu(mieId, "Mie Goreng E2E", 22000)];
  const menus = allMenus.filter((menu) => !search || menu.name.toLowerCase().includes(search.toLowerCase()));
  return {
    status: "success",
    message: "Katalog tersedia.",
    data: {
      table: { id: "908e240a-42e5-4fbc-b557-795fe5a9343e", tableNumber: 7 },
      session: { id: sessionId, expiresAt },
      operatingStatus: { status: "OPEN" },
      temporaryCloseReason: null,
      categories: [{ id: categoryId, name: "Menu E2E", sortOrder: 1, menus }],
      retainedMenus: [],
      pagination: { page: 1, pageSize: 12, totalItems: menus.length, totalPages: menus.length ? 1 : 0 },
    },
  };
}

async function mockCustomerApis(page: Page) {
  await page.route("**/api/v1/tables/*/catalog**", async (route) => {
    const search = new URL(route.request().url()).searchParams.get("search") ?? "";
    await route.fulfill({ json: catalogPayload(search) });
  });
}

test("pelanggan mencari menu, menambahkan ke keranjang, dan membuat order dengan email opsional", async ({ page }) => {
  await mockCustomerApis(page);
  let checkoutBody: Record<string, unknown> | undefined;

  await page.route("**/api/v1/sessions/*/orders", async (route) => {
    checkoutBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    await route.fulfill({
      json: {
        status: "success",
        message: "Pesanan dibuat dan menunggu pembayaran.",
        data: { id: orderId, orderNumber: "ORD-E2E-0001", status: "PENDING_PAYMENT", totalAmount: 25000, expiresAt, accessToken: "e2e-customer-order-token" },
      },
    });
  });
  await page.route("**/api/v1/orders/*/payment-attempts", async (route) => {
    await route.fulfill({
      json: { status: "success", message: "QRIS siap.", data: { qrUrl, status: "PENDING", expiresAt } },
    });
  });
  await page.route("**/api/v1/orders/*/payment-status", async (route) => {
    await route.fulfill({
      json: { status: "success", data: { qrUrl, paymentStatus: "PENDING", attemptStatus: "PENDING", expiresAt, paidAt: null } },
    });
  });

  await page.goto(`/order/${tableCode}`);
  await expect(page.getByRole("heading", { name: "Menu · Meja 07" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Cari menu berdasarkan nama atau deskripsi" }).fill("Nasi");
  await expect(page.getByRole("button", { name: /Nasi Goreng E2E/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mie Goreng E2E/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Nasi Goreng E2E/ }).click();
  await page.getByRole("button", { name: "Tambah ke keranjang" }).click();
  await expect(page.getByRole("dialog", { name: "Keranjang" })).toBeVisible();
  await page.getByRole("button", { name: "Buat pesanan" }).click();

  await expect(page.getByText("Pembayaran · ORD-E2E-0001")).toBeVisible();
  await expect(page.getByRole("img", { name: "Kode QRIS untuk pembayaran" })).toBeVisible();
  expect(checkoutBody).toBeDefined();
  expect(checkoutBody?.receiptEmail).toBeNull();
  expect(checkoutBody?.items).toMatchObject([{ menuId: nasiId, quantity: 1 }]);
});

test("pesan pencarian tidak menemukan menu yang tidak cocok", async ({ page }) => {
  await mockCustomerApis(page);
  await page.goto(`/order/${tableCode}`);
  await page.getByRole("searchbox", { name: "Cari menu berdasarkan nama atau deskripsi" }).fill("Menu yang tidak ada");
  await expect(page.getByText("Tidak ada menu yang cocok dengan pencarian atau filter Anda.")).toBeVisible();
});
