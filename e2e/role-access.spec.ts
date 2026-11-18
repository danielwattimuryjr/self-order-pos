import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const staffEmail = process.env.E2E_STAFF_EMAIL;
const staffPassword = process.env.E2E_STAFF_PASSWORD;

test("Admin dapat membuka dashboard dan daftar transaksi lokal", async ({
  page,
}) => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set kredensial akun Admin khusus pada Supabase lokal untuk menjalankan tes role.",
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail!);
  await page.getByLabel("Kata sandi").fill(adminPassword!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Dashboard Admin" }),
  ).toBeVisible();
  await page.goto("/admin/transactions");
  await expect(page.getByRole("heading", { name: "Transaksi" })).toBeVisible();
});

test("Staff dapat membuka antrean tetapi ditolak dari analytics Admin", async ({
  page,
}) => {
  test.skip(
    !staffEmail || !staffPassword,
    "Set kredensial akun Staff khusus pada Supabase lokal untuk menjalankan tes role.",
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill(staffEmail!);
  await page.getByLabel("Kata sandi").fill(staffPassword!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/staff\/queue$/);
  await expect(
    page.getByRole("heading", { name: "Antrean Pesanan" }),
  ).toBeVisible();

  const response = await page.request.get(
    "/api/v1/admin/analytics/summary?from=2026-11-01&to=2026-11-01",
  );
  expect(response.status()).toBe(403);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/staff\/queue$/);
});
