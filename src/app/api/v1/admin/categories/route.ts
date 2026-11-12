import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { recordCatalogAudit } from "@/lib/catalog/audit";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation/catalog";

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*, menus(id)").order("sort_order").order("name");
  if (error) return failure("CATEGORIES_UNAVAILABLE", "Daftar kategori tidak tersedia.", 500);
  return success(data.map((category) => ({ ...category, menuCount: category.menus.length })));
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Data kategori tidak valid.", 422);
  const supabase = await createClient();
  let sortOrder = parsed.data.sortOrder;
  if (sortOrder === undefined) {
    const { data: lastCategory } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    sortOrder = (lastCategory?.sort_order ?? -1) + 1;
  }
  const { data, error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    is_active: parsed.data.isActive,
    sort_order: sortOrder,
  }).select().single();
  if (error || !data) return failure("CATEGORY_CREATE_FAILED", "Kategori belum dapat dibuat.", 500);
  try { await recordCatalogAudit(supabase, "CATEGORY_CREATED", "category", data.id, null, data); }
  catch { return failure("CATEGORY_AUDIT_FAILED", "Kategori tersimpan, tetapi pencatatan audit gagal. Hubungi Admin sistem.", 500); }
  return success(data, "Kategori ditambahkan.");
}
